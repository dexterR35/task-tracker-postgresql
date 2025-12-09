import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email with department info
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.password_hash, u.is_active, 
              u.department_id, u.color_set,
              d.name as department_name, d.display_name as department_display_name,
              d.is_active as department_is_active
       FROM users u
       JOIN departments d ON u.department_id = d.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive. Please contact an administrator.' });
    }

    // Check if department is active
    if (!user.department_is_active) {
      return res.status(403).json({ error: 'Your department is inactive. Please contact an administrator.' });
    }

    // Generate JWT token with department info
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Return user data (without password)
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      department_display_name: user.department_display_name,
      color_set: user.color_set
    };

    res.json({
      token,
      user: userData
    });
  } catch (error) {
    next(error);
  }
};

export const verifyToken = async (req, res, next) => {
  try {
    // User is already set by authenticateToken middleware
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.is_active,
              u.department_id, u.color_set,
              d.name as department_name, d.display_name as department_display_name,
              d.is_active as department_is_active
       FROM users u
       JOIN departments d ON u.department_id = d.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    // Check if department is active
    if (!user.department_is_active) {
      return res.status(403).json({ error: 'Your department is inactive' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department_id: user.department_id,
        department_name: user.department_name,
        department_display_name: user.department_display_name,
        color_set: user.color_set
      }
    });
  } catch (error) {
    next(error);
  }
};

