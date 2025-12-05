/**
 * Utility functions for handling permissions
 */

/**
 * Fetch permissions from user_permissions table for a user
 * @param {string} userUID - User UID
 * @param {Object} pool - Database connection pool
 * @returns {Promise<Array>} Array of permission strings
 */
export const fetchUserPermissions = async (userUID, pool) => {
  try {
    const result = await pool.query(
      'SELECT permission FROM user_permissions WHERE "user_UID" = $1 ORDER BY permission',
      [userUID]
    );
    return result.rows.map(row => row.permission);
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
};

/**
 * Parse permissions from database (can be string, array, or null)
 * For backward compatibility
 * @param {string|Array|null} permissions - Permissions from database
 * @returns {Array} Parsed permissions array
 */
export const parsePermissions = (permissions) => {
  if (Array.isArray(permissions)) {
    return permissions;
  }
  if (typeof permissions === 'string') {
    try {
      return JSON.parse(permissions);
    } catch (e) {
      console.error('Error parsing permissions:', e);
      return [];
    }
  }
  return [];
};

/**
 * Check if user has a specific permission
 * @param {Object} user - User object with role and permissions
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
export const hasPermission = (user, permission) => {
  if (!user || !permission) return false;
  
  // Admins have all permissions
  if (user.role === 'admin') return true;
  
  // Check user's permissions array
  const permissions = user.permissions || [];
  return permissions.includes(permission);
};

/**
 * Set permissions for a user (replaces all existing permissions)
 * @param {string} userUID - User UID
 * @param {Array<string>} permissions - Array of permission strings
 * @param {Object} pool - Database connection pool
 * @returns {Promise<void>}
 */
export const setUserPermissions = async (userUID, permissions, pool) => {
  try {
    // Get user ID
    const userResult = await pool.query('SELECT id FROM users WHERE "user_UID" = $1', [userUID]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    const userId = userResult.rows[0].id;

    // Delete existing permissions
    await pool.query('DELETE FROM user_permissions WHERE "user_UID" = $1', [userUID]);

    // Insert new permissions
    if (permissions && permissions.length > 0) {
      const values = permissions.map((perm, index) => 
        `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`
      ).join(', ');
      
      const params = [];
      permissions.forEach(perm => {
        params.push(userId, userUID, perm);
      });

      await pool.query(
        `INSERT INTO user_permissions (user_id, "user_UID", permission) VALUES ${values}`,
        params
      );
    }
  } catch (error) {
    console.error('Error setting user permissions:', error);
    throw error;
  }
};
