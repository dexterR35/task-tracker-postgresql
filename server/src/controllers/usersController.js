import pool from '../config/database.js';

// Helper to parse JSONB fields and format to match Firebase EXACTLY
const parseUser = (user) => {
  if (!user) return user;
  
  // Parse permissions if it's a string
  const permissions = typeof user.permissions === 'string' 
    ? JSON.parse(user.permissions) 
    : user.permissions || [];
  
  // Format response to match old Firebase structure EXACTLY
  return {
    id: user.id, // Keep id for API operations
    color_set: user.color_set || user.colorSet || null,
    createdAt: user.created_at ? new Date(user.created_at).toISOString() : user.createdAt,
    createdBy: user.created_by_UID || user.createdBy, // User UID
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
    role: user.role,
    userUID: user["user_UID"] || user.userUID
    // Note: created_by_name, updated_by, updated_by_name, updated_at are NOT in Firebase structure
  };
};

export const getUsers = async (req, res, next) => {
  try {
    const { role, search, active } = req.query;
    
    let query = 'SELECT id, "user_UID", email, name, role, permissions, color_set, is_active, occupation, created_at, created_by_UID FROM users WHERE 1=1';
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
    res.json(result.rows.map(parseUser));
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, "user_UID", email, name, role, permissions, color_set, is_active, occupation, created_at, created_by_UID FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(parseUser(result.rows[0]));
  } catch (error) {
    next(error);
  }
};

export const getUserByUID = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const result = await pool.query(
      'SELECT id, "user_UID", email, name, role, permissions, color_set, is_active, occupation, created_at, created_by_UID FROM users WHERE "user_UID" = $1',
      [uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(parseUser(result.rows[0]));
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { email, name, role, permissions, password, userUID, color_set, isActive, occupation } = req.body;
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

    // Generate userUID if not provided
    const finalUserUID = userUID || `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const result = await pool.query(
      `INSERT INTO users ("user_UID", email, name, role, permissions, password_hash, color_set, is_active, occupation, created_by_UID, created_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, "user_UID", email, name, role, permissions, color_set, is_active, occupation, created_at, created_by_UID`,
      [
        finalUserUID,
        email.toLowerCase().trim(),
        name,
        role || 'user',
        JSON.stringify(permissions || []),
        passwordHash,
        color_set || null,
        isActive !== undefined ? isActive : true,
        occupation || null,
        adminUser.userUID || '',
        adminUser.name || adminUser.email
      ]
    );

    const newUser = parseUser(result.rows[0]);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyUserChange('created', newUser);
    }

    res.status(201).json(newUser);
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
    if (permissions !== undefined) {
      updates.push(`permissions = $${paramCount++}`);
      values.push(JSON.stringify(permissions));
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

    updates.push(`"updated_by_UID" = $${paramCount++}`);
    values.push(adminUser.userUID || '');
    updates.push(`updated_by_name = $${paramCount++}`);
    values.push(adminUser.name || adminUser.email);

    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, "user_UID", email, name, role, permissions, color_set, is_active, occupation, created_at, created_by_UID
    `;

    const result = await pool.query(query, values);
    const updatedUser = parseUser(result.rows[0]);

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
    const { id } = req.params;

    // Get user before deleting for WebSocket notification
    const userCheck = await pool.query('SELECT id, "user_UID" FROM users WHERE id = $1', [id]);
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager && userCheck.rows.length > 0) {
      wsManager.notifyUserChange('deleted', { id: userCheck.rows[0].id, userUID: userCheck.rows[0]["user_UID"] });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

