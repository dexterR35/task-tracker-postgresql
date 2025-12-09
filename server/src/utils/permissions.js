/**
 * Utility functions for handling permissions
 */

/**
 * Fetch permissions from user_permissions table for a user
 * @param {string} userId - User ID (UUID)
 * @param {Object} pool - Database connection pool
 * @param {string} departmentId - Optional department ID to filter by
 * @returns {Promise<Array>} Array of permission strings (or objects with department_id if departmentId not provided)
 */
export const fetchUserPermissions = async (userId, pool, departmentId = null) => {
  try {
    let query = 'SELECT permission, department_id FROM user_permissions WHERE user_id = $1';
    const params = [userId];

    if (departmentId) {
      query += ' AND department_id = $2';
      params.push(departmentId);
    }

    query += ' ORDER BY department_id, permission';

    const result = await pool.query(query, params);
    
    // If departmentId is specified, return just permission strings
    // Otherwise return objects with both permission and department_id
    if (departmentId) {
      return result.rows.map(row => row.permission);
    } else {
      return result.rows.map(row => ({
        permission: row.permission,
        department_id: row.department_id
      }));
    }
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
 * @param {Array<string>|Array<Object>} permissions - Array of permission strings or objects with {permission, department_id}
 * @param {Object} pool - Database connection pool
 * @param {string} departmentId - Optional department ID (defaults to 'design' department)
 * @returns {Promise<void>}
 */
export const setUserPermissions = async (userId, permissions, pool, departmentId = null) => {
  try {
    // Verify user exists
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    // Get default department if not provided
    let defaultDeptId = departmentId;
    if (!defaultDeptId) {
      const deptResult = await pool.query(
        "SELECT id FROM departments WHERE name = 'design' AND is_active = true LIMIT 1"
      );
      if (deptResult.rows.length > 0) {
        defaultDeptId = deptResult.rows[0].id;
      }
    }

    // Delete existing permissions for the user (all departments)
    await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);

    // Insert new permissions
    if (permissions && permissions.length > 0) {
      const values = [];
      const params = [];
      let paramIndex = 1;

      permissions.forEach(perm => {
        // Support both string format and object format
        let permissionName;
        let deptId = defaultDeptId;

        if (typeof perm === 'string') {
          permissionName = perm;
        } else if (typeof perm === 'object' && perm.permission) {
          permissionName = perm.permission;
          deptId = perm.department_id || defaultDeptId;
        } else {
          return; // Skip invalid entries
        }

        if (permissionName && deptId) {
          values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
          params.push(userId, deptId, permissionName);
          paramIndex += 3;
        }
      });

      if (values.length > 0) {
        await pool.query(
          `INSERT INTO user_permissions (user_id, department_id, permission) VALUES ${values.join(', ')}`,
          params
        );
      }
    }
  } catch (error) {
    console.error('Error setting user permissions:', error);
    throw error;
  }
};
