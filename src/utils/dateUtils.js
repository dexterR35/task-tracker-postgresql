import { useCallback } from 'react';
import {
  format,
  formatDistanceToNow,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { ro } from 'date-fns/locale';
import { DATE_TIME } from '@/constants';


// Standalone date utility functions (can be used outside React components)

export const normalizeTimestamp = (value) => {
  if (!value) return null;

  // If it's already a Date object
  if (value instanceof Date) {
    return value;
  }

  // If it's a timestamp object (backward compatibility)
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }

  // If it's a number (milliseconds)
  if (typeof value === 'number') {
    return new Date(value);
  }

  // If it's a string, try to parse it
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // If it's an object with seconds/nanoseconds (backward compatibility)
  if (value && typeof value === 'object' && 'seconds' in value) {
    const milliseconds = value.seconds * 1000 + (value.nanoseconds || 0) / 1000000;
    return new Date(milliseconds);
  }

  return null;
};

export const toMs = (value) => {
  if (!value) return null;
  try {
    // Timestamp object - check for toDate method (backward compatibility)
    if (value && typeof value.toDate === 'function') {
      const d = value.toDate();
      return isValid(d) ? d.getTime() : null;
    }

    // Timestamp object - check for seconds/nanoseconds structure (backward compatibility)
    if (value && typeof value === 'object' && 'seconds' in value) {
      const milliseconds = value.seconds * 1000 + (value.nanoseconds || 0) / 1000000;
      return Number.isFinite(milliseconds) ? milliseconds : null;
    }

    // JS Date
    if (value instanceof Date) {
      return isValid(value) ? value.getTime() : null;
    }

    // Number (assumed ms)
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    // ISO or date-like string
    if (typeof value === 'string') {
      const parsed = parseISO(value);
      return isValid(parsed) ? parsed.getTime() : null;
    }
  } catch (error) {
    // toMs conversion error
  }
  return null;
};

export const formatDate = (value, pattern = 'yyyy-MM-dd HH:mm', useRomanianTimezone = true) => {
  const ms = toMs(value);
  if (!ms) return 'N/A';
  try {
    const date = new Date(ms);

    // Handle timezone consistently - always use local timezone
    // The useRomanianTimezone parameter is kept for backward compatibility but ignored
    return format(date, pattern);
  } catch (error) {
    logger.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

export const formatDateString = (date) => {
  if (!date) return '';
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1; // 1-12
  const day = dateObj.getDate();
  
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const fromNow = (value, useRomanianTimezone = true) => {
  const ms = toMs(value);
  if (!ms) return 'N/A';
  try {
    const date = new Date(ms);
    const options = { addSuffix: true };
    // Always use local timezone for relative time calculations
    return formatDistanceToNow(date, options);
  } catch (error) {
    logger.error('Date fromNow error:', error);
    return 'N/A';
  }
};

export const formatMonth = (monthId, useRomanianTimezone = true) => {
  if (!monthId) return 'N/A';
  try {
    const date = parseISO(monthId + '-01');
    // Keep US language for month display
    return format(date, 'MMMM yyyy');
  } catch {
    return 'Invalid Month';
  }
};

export const getCurrentYear = () => {
  const now = new Date();
  // Use the timezone from constants if needed
  return now.getFullYear().toString();
};

export const getCurrentMonthId = () => {
  return format(new Date(), 'yyyy-MM');
};

export const parseMonthId = (monthId) => {
  if (!monthId) return null;
  try {
    return parseISO(monthId + '-01');
  } catch {
    return null;
  }
};

export const getStartOfMonth = (date = new Date()) => {
  return startOfMonth(date);
};

export const getEndOfMonth = (date = new Date()) => {
  return endOfMonth(date);
};


const timestampCache = new WeakMap();

export const serializeTimestamps = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Check cache first to avoid redundant processing
  if (timestampCache.has(data)) {
    return timestampCache.get(data);
  }

  const serialized = Array.isArray(data) ? [] : {};

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object') {
      // Recursively serialize nested objects
      serialized[key] = serializeTimestamps(value);
    } else if (value && typeof value.toDate === 'function') {
      // Convert timestamp to ISO string
      serialized[key] = value.toDate().toISOString();
    } else if (value instanceof Date) {
      // Convert Date object to ISO string
      serialized[key] = value.toISOString();
    } else {
      // Keep other values as is
      serialized[key] = value;
    }
  }

  // Cache the result to avoid reprocessing
  timestampCache.set(data, serialized);
  return serialized;
};

// Backward compatibility alias
export const serializeTimestampsForContext = serializeTimestamps;

// React hook for date formatting (combines all the above utilities)
export const useFormat = () => {
  return {
    toMs,
    format: formatDate,
    formatDateString,
    fromNow,
    formatMonth,
    getCurrentMonthId,
    parseMonthId,
    normalizeTimestamp,
    serializeTimestampsForContext
  };
};

export default useFormat;

