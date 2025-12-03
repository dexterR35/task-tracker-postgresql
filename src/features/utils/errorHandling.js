import { logger } from "@/utils/logger";
import { showError, showSuccess } from "@/utils/toast";
import { ERROR_SYSTEM } from '@/constants';

/**
 * Standardized error handling utilities
 * Provides consistent error handling patterns across the application
 */

// Re-export constants from centralized location for backward compatibility
export const ERROR_TYPES = ERROR_SYSTEM.TYPES;
export const ERROR_SEVERITY = ERROR_SYSTEM.SEVERITY;

/**
 * Standard error response structure - ensures all values are serializable
 */
export const createErrorResponse = (type, message, details = null, severity = ERROR_SEVERITY.MEDIUM) => {
  // Ensure details is serializable (no functions, classes, or complex objects)
  let serializableDetails = null;
  if (details) {
    if (typeof details === 'object' && details !== null) {
      try {
        // Only include primitive values and plain objects, handle circular references
        serializableDetails = JSON.parse(JSON.stringify(details, (key, value) => {
          // Skip HTML elements and other non-serializable objects
          if (value instanceof HTMLElement ||
              value instanceof Node ||
              typeof value === 'function' ||
              (typeof value === 'object' && value.constructor && value.constructor.name === 'FiberNode')) {
            return '[Circular Reference]';
          }
          return value;
        }));
      } catch (error) {
        // If serialization still fails, create a safe representation
        serializableDetails = {
          error: 'Failed to serialize details',
          type: typeof details,
          constructor: details.constructor?.name || 'Unknown'
        };
      }
    } else if (typeof details === 'string' || typeof details === 'number' || typeof details === 'boolean') {
      serializableDetails = details;
    }
  }

  return {
    type,
    message,
    details: serializableDetails,
    severity,
    timestamp: new Date().toISOString(),
    id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
};

/**
 * Parse API errors into standardized format
 * @param {Error} error - The error object
 * @returns {Object} - Standardized error response
 */
export const parseFirebaseError = (error) => {
  // Keep function name for backward compatibility, but now handles API errors
  if (!error) {
    return createErrorResponse(ERROR_TYPES.UNKNOWN, 'An unknown error occurred');
  }

  const errorCode = error.code || error.error?.code;
  const errorMessage = error.message || error.error?.message || 'An error occurred';
  const status = error.status || error.error?.status;

  // HTTP status code errors
  if (status) {
    switch (status) {
      case 401:
        return createErrorResponse(ERROR_TYPES.AUTHENTICATION, 'Authentication required. Please log in again.', null, ERROR_SEVERITY.HIGH);
      case 403:
        return createErrorResponse(ERROR_TYPES.AUTHORIZATION, 'You do not have permission to perform this action.', null, ERROR_SEVERITY.HIGH);
      case 404:
        return createErrorResponse(ERROR_TYPES.NOT_FOUND, 'The requested resource was not found.', null, ERROR_SEVERITY.MEDIUM);
      case 409:
        return createErrorResponse(ERROR_TYPES.VALIDATION, 'This resource already exists or conflicts with existing data.', null, ERROR_SEVERITY.MEDIUM);
      case 400:
        return createErrorResponse(ERROR_TYPES.VALIDATION, errorMessage || 'Invalid request. Please check your input.', null, ERROR_SEVERITY.LOW);
      case 500:
      case 502:
      case 503:
        return createErrorResponse(ERROR_TYPES.SERVER, 'Server error. Please try again later.', null, ERROR_SEVERITY.HIGH);
      default:
        if (status >= 400 && status < 500) {
          return createErrorResponse(ERROR_TYPES.VALIDATION, errorMessage, { status }, ERROR_SEVERITY.MEDIUM);
        }
        if (status >= 500) {
          return createErrorResponse(ERROR_TYPES.SERVER, errorMessage, { status }, ERROR_SEVERITY.HIGH);
        }
    }
  }

  // PostgreSQL error codes
  if (errorCode) {
    switch (errorCode) {
      case '23505': // Unique violation
        return createErrorResponse(ERROR_TYPES.VALIDATION, 'This resource already exists.', null, ERROR_SEVERITY.MEDIUM);
      case '23503': // Foreign key violation
        return createErrorResponse(ERROR_TYPES.VALIDATION, 'Referenced record does not exist.', null, ERROR_SEVERITY.MEDIUM);
      case '23502': // Not null violation
        return createErrorResponse(ERROR_TYPES.VALIDATION, 'Required field is missing.', null, ERROR_SEVERITY.LOW);
    }
  }

  // Handle generic permission errors (including "Missing or insufficient permissions")
  if (errorMessage?.includes('Missing or insufficient permissions') ||
      errorMessage?.includes('permission') ||
      errorCode === 'permission-denied') {
    return createErrorResponse(ERROR_TYPES.AUTHORIZATION, 'You do not have permission to perform this action.', { code: errorCode }, ERROR_SEVERITY.HIGH);
  }

  // Network errors
  if (errorCode === 'NETWORK_ERROR' || errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return createErrorResponse(ERROR_TYPES.NETWORK, 'Network error. Please check your connection and try again.', null, ERROR_SEVERITY.HIGH);
  }

  // RTK Query errors
  if (error?.data) {
    return createErrorResponse(ERROR_TYPES.SERVER, error.data.message || errorMessage, error.data, ERROR_SEVERITY.MEDIUM);
  }

  // Generic errors
  return createErrorResponse(ERROR_TYPES.UNKNOWN, errorMessage, { originalError: error }, ERROR_SEVERITY.MEDIUM);
};

/**
 * Handle API errors with standardized response
 * @param {Error} error - The error object
 * @param {string} operation - The operation that failed (for logging)
 * @param {Object} options - Additional options
 * @returns {Object} - Standardized error response
 */
export const handleApiError = (error, operation = 'API operation', options = {}) => {
  const { showToast = true, logError = true } = options;

  const errorResponse = parseFirebaseError(error);

  if (logError) {
    logger.error(`[${operation}] Error:`, {
      error: errorResponse,
      originalError: error,
      operation
    });
  }

  if (showToast) {
    showError(errorResponse.message);
  }

  return errorResponse;
};

/**
 * Handle form validation errors
 * @param {Object} errors - Form errors object
 * @param {string} formName - Name of the form (for logging)
 * @returns {Object} - Standardized error response
 */
export const handleValidationError = (errors, formName = 'form') => {
  const errorFields = Object.keys(errors);

  // Safely extract error messages, avoiding circular references
  const errorMessages = errorFields.map(field => {
    const error = errors[field];
    if (error && typeof error === 'object') {
      // Extract only the message property, avoiding HTML elements
      return error.message || error.type || 'Validation error';
    }
    return error || 'Validation error';
  });

  const errorResponse = createErrorResponse(
    ERROR_TYPES.VALIDATION,
    `Validation failed for ${errorFields.length} field(s)`,
    { fields: errorFields, messages: errorMessages },
    ERROR_SEVERITY.LOW
  );

  logger.warn(`[${formName}] Validation errors:`, errorResponse);

  return errorResponse;
};

/**
 * Handle success responses
 * @param {string} message - Success message
 * @param {Object} data - Success data
 * @param {string} operation - The operation that succeeded
 * @returns {Object} - Standardized success response
 */
export const handleSuccess = (message, data = null, operation = 'operation') => {
  const successResponse = {
    type: 'SUCCESS',
    message,
    data,
    timestamp: new Date().toISOString(),
    operation
  };

  showSuccess(message);

  return successResponse;
};

/**
 * Create a standardized async error handler
 * @param {Function} operation - The async operation to execute
 * @param {Object} options - Error handling options
 * @returns {Function} - Wrapped function with error handling
 */
export const withErrorHandling = (operation, options = {}) => {
  return async (...args) => {
    try {
      return await operation(...args);
    } catch (error) {
      const { operationName = 'operation', showToast = true, logError = true } = options;
      return handleApiError(error, operationName, { showToast, logError });
    }
  };
};

/**
 * Create a standardized async operation wrapper for RTK Query
 * @param {Function} mutationFn - The RTK Query mutation function
 * @param {Object} options - Error handling options
 * @returns {Function} - Wrapped mutation function
 */
export const withMutationErrorHandling = (mutationFn, options = {}) => {
  return async (arg) => {
    try {
      const result = await mutationFn(arg).unwrap();
      const { successMessage, operationName = 'mutation' } = options;

      if (successMessage) {
        handleSuccess(successMessage, result, operationName);
      }

      return result;
    } catch (error) {
      const { operationName = 'mutation', showToast = true, logError = true } = options;
      throw handleApiError(error, operationName, { showToast, logError });
    }
  };
};

/**
 * Error boundary helper for React components
 * @param {Error} error - The error object
 * @param {string} componentName - Name of the component
 * @returns {Object} - Error information for display
 */
export const getErrorBoundaryInfo = (error, componentName = 'Component') => {
  const errorResponse = parseFirebaseError(error);

  logger.error(`[${componentName}] Error boundary caught error:`, {
    error: errorResponse,
    componentName,
    stack: error.stack
  });

  return {
    title: 'Something went wrong',
    message: errorResponse.message,
    details: errorResponse.details,
    severity: errorResponse.severity,
    componentName
  };
};
