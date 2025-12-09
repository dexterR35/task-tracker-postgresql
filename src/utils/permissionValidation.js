import { logger } from '@/utils/logger';

export const validatePermissions = (userData, requiredPermissions, options = {}) => {
  const {
    operation = 'unknown',
    logWarnings = true,
    requireActive = true,
    allowAdminBypass = false
  } = options;

  // Check if user data is provided
  if (!userData) {
    const error = "User data not provided for permission validation";
    if (logWarnings) {
      logger.warn(`[validatePermissions] ${error} for ${operation}`);
    }
    return { isValid: false, errors: [error], operation };
  }

  // Check if user is active (if required)
  if (requireActive && userData.isActive === false) {
    const error = "User account is not active";
    if (logWarnings) {
      logger.warn(`[validatePermissions] ${error} for ${operation}`);
    }
    return { isValid: false, errors: [error], operation };
  }

  // Admin bypass check (if enabled)
  if (allowAdminBypass && userData.role === 'admin') {
    return { isValid: true, errors: [], operation };
  }

  // Check permissions for ALL users (no admin bypass by default)
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  const hasRequiredPermission = permissions.some(permission => {
    // Check explicit permissions array
    if (userData.permissions && Array.isArray(userData.permissions)) {
      return userData.permissions.includes(permission);
    }

    // Fallback to role-based permissions
    return hasRoleBasedPermission(userData.role, permission);
  });

  if (!hasRequiredPermission) {
    const error = `User lacks required permissions for ${operation}`;
    if (logWarnings) {
      logger.warn(`[validatePermissions] ${error}:`, {
        userUID: userData.userUID,
        email: userData.email,
        role: userData.role,
        userPermissions: userData.permissions || [],
        requiredPermissions: permissions
      });
    }
    return { isValid: false, errors: [error], operation };
  }

  return { isValid: true, errors: [], operation };
};

const hasRoleBasedPermission = (role, permission) => {
  const rolePermissions = {
    admin: [
      'create_tasks', 'update_tasks', 'delete_tasks', 'view_tasks',
      'create_deliverables', 'update_deliverables', 'delete_deliverables', 'view_deliverables',
      'create_reporters', 'update_reporters', 'delete_reporters', 'view_reporters',
      'view_analytics', 'manage_users'
    ],
    user: [
      'view_tasks', 'view_deliverables', 'view_reporters'
    ]
  };

  return rolePermissions[role]?.includes(permission) || false;
};

export const validateTaskPermissions = (userData, operation) => {
  return validatePermissions(userData, operation, {
    operation: `task_${operation}`,
    logWarnings: true,
    requireActive: true,
    allowAdminBypass: false // Tasks require explicit permissions for all users
  });
};

export const validateDeliverablePermissions = (userData, operation) => {
  return validatePermissions(userData, operation, {
    operation: `deliverable_${operation}`,
    logWarnings: true,
    requireActive: true,
    allowAdminBypass: true // Admins can manage deliverables
  });
};

export const validateReporterPermissions = (userData, operation) => {
  return validatePermissions(userData, operation, {
    operation: `reporter_${operation}`,
    logWarnings: true,
    requireActive: true,
    allowAdminBypass: true // Admins can manage reporters
  });
};

export const validateAnalyticsPermissions = (userData) => {
  return validatePermissions(userData, 'view_analytics', {
    operation: 'view_analytics',
    logWarnings: true,
    requireActive: true,
    allowAdminBypass: true // Admins can view analytics
  });
};

export const withPermissionValidation = (requiredPermissions, options = {}) => {
  return (target, propertyKey, descriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      // Assume userData is the second argument (after the main data parameter)
      const userData = args[1];

      const validation = validatePermissions(userData, requiredPermissions, {
        operation: `${target.constructor.name}.${propertyKey}`,
        ...options
      });

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
};

export const usePermissionValidation = (userData, requiredPermissions, options = {}) => {
  const validation = validatePermissions(userData, requiredPermissions, options);

  return {
    isValid: validation.isValid,
    errors: validation.errors,
    hasPermission: validation.isValid,
    canPerform: validation.isValid
  };
};

export default {
  validatePermissions,
  validateTaskPermissions,
  validateDeliverablePermissions,
  validateReporterPermissions,
  validateAnalyticsPermissions,
  withPermissionValidation,
  usePermissionValidation
};
