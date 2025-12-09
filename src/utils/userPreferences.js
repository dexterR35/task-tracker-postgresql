const PREFERENCES_PREFIX = 'user_preferences_';

const getUserPreferenceKey = (userId, preferenceKey) => {
  if (!userId) {
    // Fallback to generic key if no user ID
    return `${PREFERENCES_PREFIX}${preferenceKey}`;
  }
  return `${PREFERENCES_PREFIX}${userId}_${preferenceKey}`;
};

export const saveUserPreference = (userId, preferenceKey, value) => {
  try {
    const key = getUserPreferenceKey(userId, preferenceKey);
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save user preference:', error);
  }
};

export const loadUserPreference = (userId, preferenceKey, defaultValue = null) => {
  try {
    const key = getUserPreferenceKey(userId, preferenceKey);
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load user preference:', error);
  }
  return defaultValue;
};

/**
 * Clear user preference from localStorage
 * @param {string} userId - User ID
 * @param {string} preferenceKey - Preference key
 */
export const clearUserPreference = (userId, preferenceKey) => {
  try {
    const key = getUserPreferenceKey(userId, preferenceKey);
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear user preference:', error);
  }
};

/**
 * Clear all preferences for a user
 * @param {string} userId - User ID
 */
export const clearAllUserPreferences = (userId) => {
  try {
    if (!userId) return;
    
    const prefix = getUserPreferenceKey(userId, '');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Failed to clear all user preferences:', error);
  }
};

