/**
 * Utility functions for handling permissions
 */

/**
 * Parse permissions from database (can be string or array)
 * @param {string|Array} permissions - Permissions from database
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
  if (!user) return false;
  if (user.role === 'admin') return true; // Admins have all permissions
  const permissions = parsePermissions(user.permissions);
  return permissions.includes(permission);
};

/**
 * Check if user has any of the specified roles
 * @param {Object} user - User object with role
 * @param {Array<string>} roles - Roles to check
 * @returns {boolean} True if user has one of the roles
 */
export const hasRole = (user, ...roles) => {
  if (!user || !user.role) return false;
  return roles.includes(user.role);
};

