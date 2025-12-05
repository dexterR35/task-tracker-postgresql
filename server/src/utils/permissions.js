/**
 * Utility functions for handling permissions
 */

/**
 * Fetch permissions from user_permissions table for a user
 * @param {string} userId - User ID (UUID)
 * @param {Object} pool - Database connection pool
 * @returns {Promise<Array>} Array of permission strings
 */
export const fetchUserPermissions = async (userId, pool) => {
  try {
    const result = await pool.query(
      'SELECT permission FROM user_permissions WHERE user_id = $1 ORDER BY permission',
      [userId]
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
 * @param {string} userId - User ID (UUID)
 * @param {Array<string>} permissions - Array of permission strings
 * @param {Object} pool - Database connection pool
 * @returns {Promise<void>}
 */
export const setUserPermissions = async (userId, permissions, pool) => {
  try {
    // Verify user exists
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    // Delete existing permissions
    await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);

    // Insert new permissions
    if (permissions && permissions.length > 0) {
      const values = permissions.map((perm, index) => 
        `($${index * 2 + 1}, $${index * 2 + 2})`
      ).join(', ');
      
      const params = [];
      permissions.forEach(perm => {
        params.push(userId, perm);
      });

      await pool.query(
        `INSERT INTO user_permissions (user_id, permission) VALUES ${values}`,
        params
      );
    }
  } catch (error) {
    console.error('Error setting user permissions:', error);
    throw error;
  }
};
