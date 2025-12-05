import pool from '../config/database.js';
import { fetchUserPermissions, setUserPermissions, parsePermissions } from '../utils/permissions.js';

// Helper to format user response (fetches permissions from normalized table)
const parseUser = async (user) => {
  if (!user) return user;
  
  // Fetch permissions from normalized table
  const permissions = await fetchUserPermissions(user.id, pool);
  
  // Format response to match Firebase structure
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
    permissions: permissions,
    role: user.role
  };
};

export const getUsers = async (req, res, next) => {
  try {
    const { role, search, active } = req.query;
    
    let query = 'SELECT id, email, name, role, color_set, is_active, occupation, created_at, created_by_id FROM users WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Filter by role
    if (role) {
      query += ` AND role = $${paramCount++}`;
      params.push(role);
    }

    // Search by name or email
    if (search) {
      query += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(email) LIKE $${paramCount})`;
      params.push(`%${search.toLowerCase()}%`);
      paramCount++;
    }

    // Filter by active status
    if (active !== undefined) {
      const activeBool = active === 'true' || active === true;
      query += ` AND is_active = $${paramCount++}`;
      params.push(activeBool);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    const users = await Promise.all(result.rows.map(user => parseUser(user)));
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
      'SELECT id, email, name, role, color_set, is_active, occupation, created_at, created_by_id FROM users WHERE id = $1',
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

    res.json(await parseUser(requestedUser));
  } catch (error) {
    next(error);
  }
};

export const getUserByUID = async (req, res, next) => {
  try {
    const { uid } = req.params; // This is now the UUID id
    const currentUser = req.user;

    const result = await pool.query(
      'SELECT id, email, name, role, color_set, is_active, occupation, created_at, created_by_id FROM users WHERE id = $1',
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

    res.json(await parseUser(requestedUser));
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { email, name, role, permissions, password, color_set, isActive, occupation } = req.body;
    const adminUser = req.user;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if email already exists
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.default.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, name, role, password_hash, color_set, is_active, occupation, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, name, role, color_set, is_active, occupation, created_at, created_by_id`,
      [
        email.toLowerCase().trim(),
        name,
        role || 'user',
        passwordHash,
        color_set || null,
        isActive !== undefined ? isActive : true,
        occupation || null,
        adminUser.id || null
      ]
    );

    const newUser = result.rows[0];

    // Set permissions in normalized table
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      await setUserPermissions(newUser.id, permissions, pool);
    }

    const formattedUser = await parseUser(newUser);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyUserChange('created', formattedUser);
    }

    res.status(201).json(formattedUser);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, name, role, permissions, password } = req.body;
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

    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, role, color_set, is_active, occupation, created_at, created_by_id
    `;

    const result = await pool.query(query, values);
    
    // Update permissions in normalized table if provided
    if (permissions !== undefined) {
      await setUserPermissions(id, permissions, pool);
    }
    
    const updatedUser = await parseUser(result.rows[0]);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyUserChange('updated', updatedUser);
    }

    res.json(updatedUser);
  } catch (error) {
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
