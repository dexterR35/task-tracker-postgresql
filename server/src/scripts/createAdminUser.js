/**
 * Script to create the first admin user
 * 
 * Usage: node src/scripts/createAdminUser.js <email> <password> <name>
 */

import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import dotenv from 'dotenv';
import { setUserPermissions } from '../utils/permissions.js';

dotenv.config();

const createAdminUser = async () => {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: node createAdminUser.js <email> <password> <name>');
    process.exit(1);
  }

  const [email, password, name] = args;

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT "user_UID" FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    
    if (existingUser.rows.length > 0) {
      console.error('❌ User with this email already exists');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate userUID
    const userUID = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // Create admin user with all permissions
    const allPermissions = [
      'create_tasks',
      'update_tasks',
      'delete_tasks',
      'view_tasks',
      'create_boards',
      'submit_forms',
      'delete_data',
      'view_analytics',
      'manage_users',
      'manage_reporters',
      'manage_deliverables',
      'has_permission'
    ];

    const result = await pool.query(
      `INSERT INTO users ("user_UID", email, name, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING "user_UID", email, name, role`,
      [
        userUID,
        email.toLowerCase().trim(),
        name,
        'admin',
        passwordHash
      ]
    );

    // Set permissions in normalized table
    await setUserPermissions(userUID, allPermissions, pool);

    console.log('✅ Admin user created successfully!');
    console.log('User UID:', result.rows[0]["user_UID"]);
    console.log('Email:', result.rows[0].email);
    console.log('Name:', result.rows[0].name);
    console.log('Role:', result.rows[0].role);
    console.log('Permissions:', allPermissions.length, 'permissions set');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();

