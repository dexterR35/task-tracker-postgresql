import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { parsePermissions } from '../utils/permissions.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email (including is_active for security check)
    const result = await pool.query(
      'SELECT "user_UID", email, name, role, permissions, password_hash, is_active FROM users WHERE email = $1',
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

    // Generate JWT token
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const token = jwt.sign(
      {
        userUID: user["user_UID"],
        email: user.email,
        role: user.role,
        permissions: parsePermissions(user.permissions)
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    // Parse permissions
    const permissions = parsePermissions(user.permissions);

    // Return user data (without password)
    const userData = {
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
      'SELECT "user_UID", email, name, role, permissions FROM users WHERE "user_UID" = $1',
      [req.user.userUID]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    
    // Parse permissions
    const permissions = parsePermissions(user.permissions);

    res.json({
      user: {
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

