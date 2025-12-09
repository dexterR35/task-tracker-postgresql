import pool from '../config/database.js';

// Helper to format user response with department info
const parseUser = (user) => {
  if (!user) return user;
  
  // Format response
  return {
    id: user.id, // UUID id (primary key)
    color_set: user.color_set || user.colorSet || null,
    createdAt: user.created_at ? new Date(user.created_at).toISOString() : user.createdAt,
    createdBy: user.created_by_id || user.createdBy, // User ID
    email: user.email,
    isActive: (() => {
      // Handle boolean from database
      if (user.is_active !== undefined) {
        return Boolean(user.is_active);
      }
      // Handle boolean from Firebase
      if (user.isActive !== undefined) {
        return Boolean(user.isActive);
      }
      // If it's a timestamp (from old Firebase), convert to boolean (true if exists)
      if (user.isActive && typeof user.isActive === 'string') {
        return true; // Timestamp exists means user is active
      }
      // Default to true
      return true;
    })(),
    name: user.name,
    occupation: user.occupation || null,
    role: user.role,
    // Department info
    department_id: user.department_id,
    department_name: user.department_name,
    department_display_name: user.department_display_name
  };
};

export const getUsers = async (req, res, next) => {
  try {
    const { role, search, active, department_id } = req.query;
    
    let query = `
      SELECT u.id, u.email, u.name, u.role, u.color_set, u.is_active, u.occupation, 
             u.created_at, u.created_by_id, u.department_id,
             d.name as department_name, d.display_name as department_display_name
      FROM users u
      JOIN departments d ON u.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Filter by role
    if (role) {
      query += ` AND u.role = $${paramCount++}`;
      params.push(role);
    }

    // Filter by department
    if (department_id) {
      query += ` AND u.department_id = $${paramCount++}`;
      params.push(department_id);
    }

    // Search by name or email
    if (search) {
      query += ` AND (LOWER(u.name) LIKE $${paramCount} OR LOWER(u.email) LIKE $${paramCount})`;
      params.push(`%${search.toLowerCase()}%`);
      paramCount++;
    }

    // Filter by active status
    if (active !== undefined) {
      const activeBool = active === 'true' || active === true;
      query += ` AND u.is_active = $${paramCount++}`;
      params.push(activeBool);
    }

    query += ' ORDER BY u.created_at DESC';

    const result = await pool.query(query, params);
    const users = result.rows.map(user => parseUser(user));
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params; // This is the UUID id
    const currentUser = req.user;

    // Authorization: Users can only view their own profile, admins can view any
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.color_set, u.is_active, u.occupation, 
              u.created_at, u.created_by_id, u.department_id,
              d.name as department_name, d.display_name as department_display_name
       FROM users u
       JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requestedUser = result.rows[0];
    
    // Check authorization: users can only see their own data, admins can see all
    if (currentUser.role !== 'admin' && requestedUser.id !== currentUser.id) {
      return res.status(403).json({ error: 'Insufficient permissions to view this user' });
    }

    res.json(parseUser(requestedUser));
  } catch (error) {
    next(error);
  }
};

export const getUserByUID = async (req, res, next) => {
  try {
    const { uid } = req.params; // This is now the UUID id
    const currentUser = req.user;

    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.color_set, u.is_active, u.occupation, 
              u.created_at, u.created_by_id, u.department_id,
              d.name as department_name, d.display_name as department_display_name
       FROM users u
       JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const requestedUser = result.rows[0];
    
    // Check authorization: users can only see their own data, admins can see all
    if (currentUser.role !== 'admin' && requestedUser.id !== currentUser.id) {
      return res.status(403).json({ error: 'Insufficient permissions to view this user' });
    }

    res.json(parseUser(requestedUser));
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { email, name, role, password, color_set, isActive, occupation, department_id } = req.body;
    const adminUser = req.user;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!department_id) {
      return res.status(400).json({ error: 'Department ID is required' });
    }

    // Check if email already exists
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Verify department exists and is active
    const deptCheck = await pool.query('SELECT id, is_active FROM departments WHERE id = $1', [department_id]);
    if (deptCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid department ID' });
    }
    if (!deptCheck.rows[0].is_active) {
      return res.status(400).json({ error: 'Cannot assign user to inactive department' });
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, name, role, password_hash, color_set, is_active, occupation, department_id, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, email, name, role, color_set, is_active, occupation, department_id, created_at, created_by_id`,
      [
        email.toLowerCase().trim(),
        name,
        role || 'user',
        passwordHash,
        color_set || null,
        isActive !== undefined ? isActive : true,
        occupation || null,
        department_id,
        adminUser.id || null
      ]
    );

    const newUser = result.rows[0];

    // Get department info for the response
    const userWithDept = await pool.query(
      `SELECT u.*, d.name as department_name, d.display_name as department_display_name
       FROM users u
       JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [newUser.id]
    );

    const formattedUser = parseUser(userWithDept.rows[0]);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyUserChange('created', formattedUser);
    }

    res.status(201).json(formattedUser);
  } catch (error) {
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Invalid department ID' });
    }
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, name, role, password, department_id } = req.body;
    const adminUser = req.user;

    // Check if user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being updated and if it already exists
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email.toLowerCase().trim(), id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }
    }

    // Verify department if being updated
    if (department_id) {
      const deptCheck = await pool.query('SELECT id, is_active FROM departments WHERE id = $1', [department_id]);
      if (deptCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid department ID' });
      }
      if (!deptCheck.rows[0].is_active) {
        return res.status(400).json({ error: 'Cannot assign user to inactive department' });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email.toLowerCase().trim());
    }
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (role) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (password) {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.default.hash(password, 10);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }
    if (req.body.color_set !== undefined) {
      updates.push(`color_set = $${paramCount++}`);
      values.push(req.body.color_set || null);
    }
    if (req.body.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(req.body.isActive);
    }
    if (req.body.occupation !== undefined) {
      updates.push(`occupation = $${paramCount++}`);
      values.push(req.body.occupation || null);
    }
    if (department_id) {
      updates.push(`department_id = $${paramCount++}`);
      values.push(department_id);
    }

    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, role, color_set, is_active, occupation, department_id, created_at, created_by_id
    `;

    const result = await pool.query(query, values);
    
    // Get department info for the response
    const userWithDept = await pool.query(
      `SELECT u.*, d.name as department_name, d.display_name as department_display_name
       FROM users u
       JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [id]
    );
    
    const updatedUser = parseUser(userWithDept.rows[0]);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyUserChange('updated', updatedUser);
    }

    res.json(updatedUser);
  } catch (error) {
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Invalid department ID' });
    }
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params; // This is the UUID id

    // Get user before deleting for WebSocket notification
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager && userCheck.rows.length > 0) {
      wsManager.notifyUserChange('deleted', { id: result.rows[0].id });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};
