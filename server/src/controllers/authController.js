import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await pool.query(
      'SELECT id, "user_UID", email, name, role, permissions, password_hash FROM users WHERE email = $1',
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

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        userUID: user["user_UID"],
        email: user.email,
        role: user.role,
        permissions: user.permissions || []
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Parse permissions if it's a string
    const permissions = typeof user.permissions === 'string' 
      ? JSON.parse(user.permissions) 
      : user.permissions || [];

    // Return user data (without password)
    const userData = {
      id: user.id,
      userUID: user["user_UID"],
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: permissions
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
      'SELECT id, "user_UID", email, name, role, permissions FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    
    // Parse permissions if it's a string
    const permissions = typeof user.permissions === 'string' 
      ? JSON.parse(user.permissions) 
      : user.permissions || [];

    res.json({
      user: {
        id: user.id,
        userUID: user["user_UID"],
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: permissions
      }
    });
  } catch (error) {
    next(error);
  }
};

