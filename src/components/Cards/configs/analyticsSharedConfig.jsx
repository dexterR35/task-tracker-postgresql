import React from "react";
import { CARD_SYSTEM, FORM_OPTIONS } from "@/constants";

/**
 * Shared Analytics Configuration
 * Contains colors, utilities, and common settings used across all analytics cards
 */

export const MARKETS_BY_USERS_CARD_TYPES = CARD_SYSTEM.ANALYTICS_CARD_TYPES;

// Chart data type constants (from CARD_SYSTEM)
export const CHART_DATA_TYPE = CARD_SYSTEM.CHART_DATA_TYPE;

// Extract product, market, AI model, and department names from FORM_OPTIONS
export const PRODUCT_NAMES = Object.fromEntries(
  FORM_OPTIONS.PRODUCTS.map((p) => [
    p.value.toUpperCase().replace(/\s+/g, '_'),
    p.value,
  ])
);
export const MARKET_CODES = Object.fromEntries(
  FORM_OPTIONS.MARKETS.map((m) => [m.value.toUpperCase(), m.value.toUpperCase()])
);
export const AI_MODEL_NAMES = Object.fromEntries(
  FORM_OPTIONS.AI_MODELS.map((a) => [
    a.value.toUpperCase().replace(/\s+/g, '_'),
    a.value,
  ])
);
export const DEPARTMENT_NAMES = Object.fromEntries(
  FORM_OPTIONS.REPORTER_DEPARTMENTS.map((d) => [
    d.value.toUpperCase().replace(/\s+/g, '_'),
    d.value,
  ])
);

export const CHART_COLORS = {
  DEFAULT: Object.values(CARD_SYSTEM.COLOR_HEX_MAP),
  USER_BY_TASK: Object.values(CARD_SYSTEM.COLOR_HEX_MAP).slice(0, 10),
};

// ============================================================================
// CHART COLOR MAPPING SYSTEM
// ============================================================================

// Base color palette from CARD_SYSTEM
const BASE_COLORS = Object.values(CARD_SYSTEM.COLOR_HEX_MAP);

// User-specific color palette - distinct vibrant colors for users
export const USER_COLORS = [
  '#2563eb', // Blue-500
  '#10b981', // Emerald-500
  '#84cc16', // lime-500
  '#f59e0b', // amber-500
  '#8b5cf6', // Violet-500
  '#db2777', // Pink-500
  '#06b6d4', // Cyan-500
  '#f97316', // Orange-500
  '#10b981', // green-500
  '#e11d48', // rose-500
];

// Market-specific color mapping (using constants from FORM_OPTIONS)
export const MARKET_COLOR_MAP = {
  [MARKET_CODES.RO]: '#e11d48',    // Yellow-600 - Romania (primary market)
  [MARKET_CODES.COM]: '#2563eb',   // Blue-600 - International
  [MARKET_CODES.UK]: '#f97316',    // orange-600 - United Kingdom
  [MARKET_CODES.IE]: '#22c55e',    // Green-500 - Ireland
  [MARKET_CODES.FI]: '#7c3aed',    // Purple-600 - Finland
  [MARKET_CODES.DK]: '#f59e0b',    // Amber-500 - Denmark
  [MARKET_CODES.DE]: '#10b981',    // Emerald-500 - Germany
  [MARKET_CODES.AT]: '#ef4444',    // red-500 - Austria
  [MARKET_CODES.IT]: '#06b6d4',    // Cyan-500 - Italy
  [MARKET_CODES.GR]: '#db2777',    // Pink-600 - Greece
  [MARKET_CODES.FR]: '#84cc16',    // Lime-500 - France
};

// Product-specific color mapping (using constants from FORM_OPTIONS)
export const PRODUCT_COLOR_MAP = {
  [PRODUCT_NAMES.MARKETING_CASINO]: '#e11d48',    // Rose-600
  [PRODUCT_NAMES.MARKETING_SPORT]: '#2563eb',     // Blue-600
  [PRODUCT_NAMES.MARKETING_POKER]: '#7c3aed',     // Purple-600
  [PRODUCT_NAMES.MARKETING_LOTTO]: '#22c55e',     // Green-500
  [PRODUCT_NAMES.ACQUISITION_CASINO]: '#f59e0b',  // Amber-500
  [PRODUCT_NAMES.ACQUISITION_SPORT]: '#06b6d4',   // Cyan-500
  [PRODUCT_NAMES.ACQUISITION_POKER]: '#db2777',   // Pink-600
  [PRODUCT_NAMES.ACQUISITION_LOTTO]: '#84cc16',   // Lime-500
  [PRODUCT_NAMES.PRODUCT_CASINO]: '#f59e0b',      // amber-600
  [PRODUCT_NAMES.PRODUCT_SPORT]: '#22c55e',       // green-600
  [PRODUCT_NAMES.PRODUCT_POKER]: '#ef4444',       // Red-500
  [PRODUCT_NAMES.PRODUCT_LOTTO]: '#10b981',       // Emerald-500
  [PRODUCT_NAMES.MISC]: '#8C00FF',                // purple-500
};

// AI Model-specific color mapping (using constants from FORM_OPTIONS)
export const AI_MODEL_COLOR_MAP = {
  [AI_MODEL_NAMES.PHOTOSHOP]: '#e11d48',      // Rose-600
  [AI_MODEL_NAMES.FIREFLY]: '#2563eb',         // Blue-600
  [AI_MODEL_NAMES.CHATGPT]: '#7c3aed',        // Purple-600
  [AI_MODEL_NAMES.SHUTTERSTOCK]: '#22c55e',    // Green-500
  [AI_MODEL_NAMES.MIDJOURNEY]: '#f59e0b',      // Amber-500
  [AI_MODEL_NAMES.NIGHTCAFE]: '#06b6d4',      // Cyan-500
  [AI_MODEL_NAMES.FREEPICK]: '#db2777',        // Pink-600
  [AI_MODEL_NAMES.CURSOR]: '#84cc16',          // Lime-500
  [AI_MODEL_NAMES.RUN_DIFFUSION]: '#22c55e',   // Red-600
};

// Department-specific color mapping (using constants from FORM_OPTIONS)
export const DEPARTMENT_COLOR_MAP = {
  [DEPARTMENT_NAMES.VIDEO]: '#e11d48',           // Rose-600
  [DEPARTMENT_NAMES.DESIGN]: '#2563eb',          // Blue-600
  [DEPARTMENT_NAMES.DEVELOPER]: '#7c3aed',       // Purple-600
  [DEPARTMENT_NAMES.ACQ]: '#22c55e',             // Green-500
  [DEPARTMENT_NAMES.CRM]: '#f59e0b',             // Amber-500
  [DEPARTMENT_NAMES.GAMES_TEAM]: '#06b6d4',      // Cyan-500
  [DEPARTMENT_NAMES.OTHER]: '#db2777',           // Pink-600
  [DEPARTMENT_NAMES.PRODUCT]: '#84cc16',         // Lime-500
  [DEPARTMENT_NAMES.VIP]: '#dc2626',             // Red-600
  [DEPARTMENT_NAMES.CONTENT]: '#ca8a04',         // Yellow-600
  [DEPARTMENT_NAMES.PML]: '#ef4444',             // Red-500
  [DEPARTMENT_NAMES.MISC]: '#8C00FF',            // purple-500
  [DEPARTMENT_NAMES.HR]: '#10b981',              // Emerald-500
};

export const getMarketColor = (market) => {
  if (!market) return BASE_COLORS[0];
  const normalizedMarket = market.toUpperCase();
  return MARKET_COLOR_MAP[normalizedMarket] || BASE_COLORS[0];
};


export const getProductColor = (product) => {
  if (!product) return BASE_COLORS[0];
  const normalizedProduct = product.toLowerCase().trim();
  return PRODUCT_COLOR_MAP[normalizedProduct] || BASE_COLORS[0];
};


export const getAIModelColor = (model) => {
  if (!model) return BASE_COLORS[0];
  return AI_MODEL_COLOR_MAP[model] || BASE_COLORS[0];
};


export const getDepartmentColor = (department) => {
  if (!department) return BASE_COLORS[0];
  const normalizedDept = department.toLowerCase().trim();
  return DEPARTMENT_COLOR_MAP[normalizedDept] || BASE_COLORS[0];
};


/**
 * Get user object from users array by userId
 * Only uses userUID for matching (as per DB schema)
 */
export const getUserObject = (userId, users) => {
  if (!userId) {
    return null;
  }
  
  // Normalize userId for comparison (trim and ensure string)
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : String(userId);
  
  // If users array is not available or empty, return null
  if (!users || !Array.isArray(users) || users.length === 0) {
    return null;
  }
  
  // Try to find user by userUID (exact match, case-sensitive)
  const user = users.find((u) => {
    if (!u || typeof u !== 'object') return false;
    
    // Check userUID field (primary) - exact match
    if (u.userUID !== undefined && u.userUID !== null) {
      const userUID = typeof u.userUID === 'string' ? u.userUID.trim() : String(u.userUID);
      if (userUID === normalizedUserId) {
        return true;
      }
    }
    
    // Fallback: check id field if userUID doesn't exist
    if (u.id && u.id !== u.userUID) {
      const userIdFromId = typeof u.id === 'string' ? u.id.trim() : String(u.id);
      if (userIdFromId === normalizedUserId) {
        return true;
      }
    }
    
    return false;
  });
  
  return user || null;
};

/**
 * Get color from user's color_set field in database
 * Handles color with or without # prefix
 * Falls back to hash-based color if color_set not available
 */
export const getUserColor = (userIdentifier, users = null) => {
  // If userIdentifier is already a user object, use it directly
  if (userIdentifier && typeof userIdentifier === 'object' && !Array.isArray(userIdentifier)) {
    const colorSet = userIdentifier.color_set || userIdentifier.colorSet;
    if (colorSet) {
      // Add # prefix if not present
      return colorSet.startsWith('#') ? colorSet : `#${colorSet}`;
    }
    // If no color_set, fall through to hash-based approach using name or userUID
    const name = userIdentifier.name || userIdentifier.displayName || userIdentifier.userUID || '';
    userIdentifier = name;
  }
  
  // If we have users array and userIdentifier is a string (userId or name), try to find user
  if (users && typeof userIdentifier === 'string') {
    const user = getUserObject(userIdentifier, users);
    if (user) {
      const colorSet = user.color_set || user.colorSet;
      if (colorSet) {
        // Add # prefix if not present
        return colorSet.startsWith('#') ? colorSet : `#${colorSet}`;
      }
    }
    
    // Also try to find by name if not found by userUID
    const userByName = users.find((u) => {
      if (!u || typeof u !== 'object') return false;
      const userName = u.name || u.displayName || '';
      return userName.toLowerCase() === userIdentifier.toLowerCase();
    });
    
    if (userByName) {
      const colorSet = userByName.color_set || userByName.colorSet;
      if (colorSet) {
        // Add # prefix if not present
        return colorSet.startsWith('#') ? colorSet : `#${colorSet}`;
      }
    }
  }
  
  // Fallback to hash-based color assignment if no color_set found
  if (!userIdentifier) return USER_COLORS[0];

  // Simple hash function to convert string to number
  let hash = 0;
  const identifier = typeof userIdentifier === 'string' ? userIdentifier : String(userIdentifier);
  for (let i = 0; i < identifier.length; i++) {
    const char = identifier.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get index from USER_COLORS palette
  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
};


export const addConsistentColors = (data, type = CHART_DATA_TYPE.MARKET, nameKey = 'name', users = null) => {
  if (!data || !Array.isArray(data)) return [];

  // For USER and REPORTER types, ensure unique colors within the dataset
  if (type === CHART_DATA_TYPE.USER || type === CHART_DATA_TYPE.REPORTER) {
    const usedColors = new Set();
    const nameToColorMap = new Map();

    return data.map(item => {
      // Preserve existing color if it's already set
      if (item.color) {
        usedColors.add(item.color);
        return item;
      }

      const name = item[nameKey] || item.name || item.label || '';
      const userId = item.userId || item.userUID || item.id || name;

      // Check if we've already assigned a color to this name
      if (nameToColorMap.has(name)) {
        return {
          ...item,
          color: nameToColorMap.get(name)
        };
      }
      
      // Try to get a unique color using hash, but ensure uniqueness
      // Use USER_COLORS for users, BASE_COLORS for reporters
      const colorPalette = type === CHART_DATA_TYPE.USER ? USER_COLORS : BASE_COLORS;
      
      // For USER type, try to get color from database color_set first
      let color;
      if (type === CHART_DATA_TYPE.USER && users) {
        // Try to get color from user's color_set in database
        color = getUserColor(userId, users);
        // If we got a color from database, check if it's already used
        // If used, we'll fall back to hash-based approach below
        if (usedColors.has(color)) {
          color = null; // Force fallback
        }
      }
      
      // Fallback to hash-based color if no database color or if color is already used
      if (!color) {
        color = type === CHART_DATA_TYPE.USER ? getUserColor(name, users) : getDepartmentColor(name);
        let attempts = 0;
        const maxAttempts = colorPalette.length * 2;

        // If color is already used, try next colors in sequence
        while (usedColors.has(color) && attempts < maxAttempts) {
          // Get next color index
          const currentIndex = colorPalette.indexOf(color);
          const nextIndex = (currentIndex + 1) % colorPalette.length;
          color = colorPalette[nextIndex];
          attempts++;
        }
      }

      // If still no unique color found (very unlikely), use the hash color anyway
      usedColors.add(color);
      nameToColorMap.set(name, color);

      return {
        ...item,
        color
      };
    });
  }

  // For other types, use the original logic
  return data.map(item => {
    // Preserve existing color if it's already set
    if (item.color) {
      return item;
    }

    const name = item[nameKey] || item.name || item.label || '';
    let color;

    switch (type) {
      case CHART_DATA_TYPE.MARKET:
        color = getMarketColor(name);
        break;
      case CHART_DATA_TYPE.PRODUCT:
        color = getProductColor(name);
        break;
      case CHART_DATA_TYPE.AI_MODEL:
        color = getAIModelColor(name);
        break;
      case CHART_DATA_TYPE.DEPARTMENT:
        color = getDepartmentColor(name);
        break;
      default:
        color = BASE_COLORS[0];
    }

    return {
      ...item,
      color
    };
  });
};

// Export all color maps for reference
export const COLOR_MAPS = {
  MARKET: MARKET_COLOR_MAP,
  PRODUCT: PRODUCT_COLOR_MAP,
  AI_MODEL: AI_MODEL_COLOR_MAP,
  DEPARTMENT: DEPARTMENT_COLOR_MAP,
};

// Export base colors for fallback
export const BASE_COLOR_PALETTE = BASE_COLORS;

export const calculateTotal = (dataObject, defaultValue = 0) => {
  if (!dataObject || typeof dataObject !== "object") {
    return defaultValue;
  }

  return Object.values(dataObject).reduce((sum, value) => {
    const numValue = typeof value === "number" ? value : 0;
    return sum + numValue;
  }, 0);
};


export const calculateUserDataTotals = (userData) => {
  const { userHours = {}, userTotals = {} } = userData;

  return {
    totalHours: calculateTotal(userHours),
    totalTasks: calculateTotal(userTotals),
  };
};

export const calculatePercentage = (value, total, decimals = 1) => {
  if (total === 0) return "0.0";

  const percentage = (value / total) * 100;
  // Cap at 100% maximum
  const cappedPercentage = Math.min(percentage, 100);
  return cappedPercentage.toFixed(decimals);
};


export const calculateCountWithPercentage = (count, total, allItems = null, currentKey = null) => {
  if (total === 0) return `${count} (0%)`;

  // If allItems provided, calculate percentages for entire group to sum to 100%
  if (allItems && currentKey) {
    // Calculate raw percentages and floor values
    const percentages = allItems.map(item => {
      const rawPercentage = (item.count / total) * 100;
      const floored = Math.floor(rawPercentage);
      const remainder = rawPercentage - floored;
      return {
        key: item.key,
        count: item.count,
        floored,
        remainder
      };
    });

    // Calculate sum of floored values
    const sumFloored = percentages.reduce((sum, p) => sum + p.floored, 0);
    const difference = 100 - sumFloored;

    // Sort by remainder (descending) to allocate extra points to largest remainders
    const sorted = [...percentages].sort((a, b) => b.remainder - a.remainder);
    const adjustedDifference = Math.max(0, Math.min(difference, percentages.length));
    // Allocate final percentages
    sorted.forEach((item, index) => {
      item.finalPercentage = index < adjustedDifference ? item.floored + 1 : item.floored;
    });

    // Find current item's percentage
    const currentItem = percentages.find(p => p.key === currentKey);
    const percentage = currentItem ? currentItem.finalPercentage : 0;
    return `${count} (${percentage}%)`;
  }

  // Fallback: calculate percentage normally (for single item cases)
  const percentage = (count / total) * 100;
  const cappedPercentage = Math.min(percentage, 100);
  return `${count} (${Math.round(cappedPercentage)}%)`;
};


export const renderCountWithPercentage = (value) => {
  if (typeof value === 'number') {
    return <span>{value}</span>;
  }

  if (typeof value !== 'string') {
    return <span>{String(value)}</span>;
  }

  // Match pattern like "2 (3%)" or "17 (21%)"
  const match = value.match(/^(\d+)\s*\((\d+)%\)$/);
  if (match) {
    const count = match[1];
    const percentage = match[2];
    const greenColor = CARD_SYSTEM.COLOR_HEX_MAP.amber;

    return (
      <span>
        {count} (<span className="font-bold" style={{ color: greenColor }}>{percentage}%</span>)
      </span>
    );
  }

  // If it doesn't match the pattern, return as-is
  return <span>{value}</span>;
};


// Extract markets from task (with normalization)
export const getTaskMarkets = (task) => {
  const markets = task.data_task?.markets || task.markets || [];
  if (!Array.isArray(markets)) return [];
  return markets.map(market => market?.trim().toUpperCase()).filter(Boolean);
};

// Extract products from task
export const getTaskProducts = (task) => {
  return task.data_task?.products || task.products || "";
};

// Extract time in hours from task
export const getTaskHours = (task) => {
  return task.data_task?.timeInHours || task.timeInHours || 0;
};

// Extract reporter name from task
export const getTaskReporterName = (task) => {
  return task.data_task?.reporterName || task.reporterName || "";
};

// Extract reporter UID from task
export const getTaskReporterUID = (task) => {
  return task.data_task?.reporterUID || task.data_task?.reporters || task.reporterUID || task.reporters || "";
};

// Extract user UID from task
export const getTaskUserUID = (task) => {
  return task.userUID || task.createbyUID || task.data_task?.userUID || task.data_task?.createbyUID || "";
};

// Extract AI used from task
export const getTaskAIUsed = (task) => {
  return task.data_task?.aiUsed || task.aiUsed || [];
};


export const addGrandTotalRow = (tableData, options = {}) => {
  if (!tableData || tableData.length === 0) {
    return tableData;
  }

  const {
    labelKey = 'category',
    labelValue = 'Grand Total',
    sumColumns = [],
    marketColumns = [],
    customValues = {},
  } = options;

  // Create grand total row
  const grandTotalRow = {
    [labelKey]: labelValue,
    bold: true,
    highlight: true,
  };

  // Sum numeric columns
  sumColumns.forEach((columnKey) => {
    const total = tableData.reduce((sum, row) => {
      const value = row[columnKey];
      if (typeof value === 'number') {
        return sum + value;
      }
      return sum;
    }, 0);

    // Round to 2 decimal places for hours/decimals
    if (columnKey.includes('Hours') || columnKey.includes('Time') || columnKey.includes('Percentage')) {
      grandTotalRow[columnKey] = Math.round(total * 100) / 100;
    } else {
      grandTotalRow[columnKey] = total;
    }
  });

  // Sum market columns (tasks with percentages)
  if (marketColumns.length > 0) {
    marketColumns.forEach((marketKey) => {
      const marketTotal = tableData.reduce((sum, row) => {
        const value = row[marketKey];
        if (typeof value === 'number') {
          return sum + value;
        }
        // Handle percentage strings like "5 (10%)"
        if (typeof value === 'string' && value.includes('(')) {
          const numMatch = value.match(/^\d+/);
          return sum + (numMatch ? parseInt(numMatch[0], 10) : 0);
        }
        return sum;
      }, 0);
      grandTotalRow[marketKey] = marketTotal;

      // Sum hours columns for this market
      const hoursKey = `${marketKey}_hours`;
      const hoursTotal = tableData.reduce((sum, row) => {
        const value = row[hoursKey];
        if (typeof value === 'number') {
          return sum + value;
        }
        return sum;
      }, 0);
      grandTotalRow[hoursKey] = Math.round(hoursTotal * 100) / 100;
    });
  } else {
    // Auto-detect market columns (columns that aren't in sumColumns and aren't the label)
    const firstRow = tableData[0];
    if (firstRow) {
      const detectedMarkets = new Set();
      Object.keys(firstRow).forEach((key) => {
        if (key !== labelKey && !sumColumns.includes(key) && key !== 'bold' && key !== 'highlight' && !key.endsWith('_hours')) {
          // Check if it's a market column (uppercase or contains market-like patterns)
          if (key.length <= 5 || /^[A-Z]{2,5}$/.test(key)) {
            detectedMarkets.add(key);
            const marketTotal = tableData.reduce((sum, row) => {
              const value = row[key];
              if (typeof value === 'number') {
                return sum + value;
              }
              if (typeof value === 'string' && value.includes('(')) {
                const numMatch = value.match(/^\d+/);
                return sum + (numMatch ? parseInt(numMatch[0], 10) : 0);
              }
              return sum;
            }, 0);
            grandTotalRow[key] = marketTotal;

            // Also handle hours column if it exists
            const hoursKey = `${key}_hours`;
            if (firstRow.hasOwnProperty(hoursKey)) {
              const hoursTotal = tableData.reduce((sum, row) => {
                const value = row[hoursKey];
                if (typeof value === 'number') {
                  return sum + value;
                }
                return sum;
              }, 0);
              grandTotalRow[hoursKey] = Math.round(hoursTotal * 100) / 100;
            }
          }
        }
      });
    }
  }

  // Add custom values (overrides calculated values)
  Object.assign(grandTotalRow, customValues);

  return [...tableData, grandTotalRow];
};

// ============================================================================
// SHARED USER UTILITIES
// ============================================================================

/**
 * Get user name from users array by userId
 * Only uses userUID for matching (as per DB schema)
 */
export const getUserName = (userId, users) => {
  if (!userId) {
    return 'Unknown User';
  }
  
  // Normalize userId for comparison (trim and ensure string)
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : String(userId);
  
  // If users array is not available or empty, return fallback
  if (!users || !Array.isArray(users) || users.length === 0) {
    return `User ${normalizedUserId.slice(0, 8)}`;
  }
  
  // Try to find user by userUID (exact match, case-sensitive)
  const user = users.find((u) => {
    if (!u || typeof u !== 'object') return false;
    
    // Check userUID field (primary) - exact match
    if (u.userUID !== undefined && u.userUID !== null) {
      const userUID = typeof u.userUID === 'string' ? u.userUID.trim() : String(u.userUID);
      if (userUID === normalizedUserId) {
        return true;
      }
    }
    
    // Fallback: check id field if userUID doesn't exist
    // Note: Firestore doc IDs are usually different from userUID, so this is a last resort
    if (u.id && u.id !== u.userUID) {
      const userIdFromId = typeof u.id === 'string' ? u.id.trim() : String(u.id);
      if (userIdFromId === normalizedUserId) {
        return true;
      }
    }
    
    return false;
  });
  
  if (!user) {
    return `User ${normalizedUserId.slice(0, 8)}`;
  }
  
  // Return user name in priority order: displayName > name > email > fallback
  // Ensure we return a string value
  const userName = user.displayName || user.name || user.email;
  if (userName && typeof userName === 'string' && userName.trim().length > 0) {
    return userName.trim();
  }
  
  return `User ${normalizedUserId.slice(0, 8)}`;
};

/**
 * Normalize market code (trim and uppercase)
 */
export const normalizeMarket = (market) => {
  if (!market || typeof market !== 'string') return '';
  return market.trim().toUpperCase();
};

// ============================================================================
// SHARED CALCULATION UTILITIES
// ============================================================================

/**
 * Calculate percentages for a group of counts, ensuring they sum to exactly 100%
 * @param {Array<{key: string, count: number}>} items - Array of items with key and count
 * @param {number} total - Total count
 * @returns {Object} - Object mapping keys to percentages that sum to 100%
 */
export const calculatePercentagesForGroup = (items, total) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {};
  }

  if (total === 0) {
    const result = {};
    items.forEach(item => {
      result[item.key] = 0;
    });
    return result;
  }

  // Calculate raw percentages and floor values
  const percentages = items.map(item => {
    const rawPercentage = (item.count / total) * 100;
    const floored = Math.floor(rawPercentage);
    const remainder = rawPercentage - floored;
    return {
      key: item.key,
      count: item.count,
      floored,
      remainder
    };
  });

  // Calculate sum of floored values
  const sumFloored = percentages.reduce((sum, p) => sum + p.floored, 0);
  const difference = 100 - sumFloored;

  // Sort by remainder (descending) to allocate extra points to largest remainders
  const sorted = [...percentages].sort((a, b) => b.remainder - a.remainder);
  const adjustedDifference = Math.max(0, Math.min(difference, percentages.length));
  
  // Allocate final percentages
  sorted.forEach((item, index) => {
    item.finalPercentage = index < adjustedDifference ? item.floored + 1 : item.floored;
  });

  // Create result object
  const result = {};
  percentages.forEach(p => {
    result[p.key] = p.finalPercentage;
  });

  return result;
};

/**
 * Calculate per-user charts by category (generic function for acquisition, marketing, product, etc.)
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {string} categoryName - Optional category name for display
 * @returns {Array} - Array of user chart objects with marketData
 */
export const calculateUsersChartsByCategory = (tasks, users, categoryName = null) => {
  if (!tasks || tasks.length === 0) return [];

  const userMarketStats = {}; // { userId: { userName: "...", markets: { "RO": { tasks, hours }, ... } } }

  tasks.forEach((task) => {
    const taskMarkets = getTaskMarkets(task);
    const taskHours = getTaskHours(task);
    const userId = getTaskUserUID(task);

    if (!userId || !taskMarkets || taskMarkets.length === 0) return;

    const userName = getUserName(userId, users || []);

    // Initialize user if not exists
    if (!userMarketStats[userId]) {
      userMarketStats[userId] = {
        userName,
        markets: {},
        totalTasks: 0,
        totalHours: 0,
      };
    }

    taskMarkets.forEach((market) => {
      if (market) {
        const normalizedMarket = normalizeMarket(market);
        if (!userMarketStats[userId].markets[normalizedMarket]) {
          userMarketStats[userId].markets[normalizedMarket] = {
            tasks: 0,
            hours: 0,
          };
        }
        userMarketStats[userId].markets[normalizedMarket].tasks += 1;
        userMarketStats[userId].markets[normalizedMarket].hours += taskHours;
      }
    });

    // Update user totals
    userMarketStats[userId].totalTasks += 1;
    userMarketStats[userId].totalHours += taskHours;
  });

  // Create separate chart data for each user
  return Object.entries(userMarketStats)
    .map(([userId, userData]) => {
      const marketData = Object.entries(userData.markets)
        .map(([market, stats]) => ({
          name: market,
          tasks: stats.tasks,
          hours: Math.round(stats.hours * 100) / 100,
          market: market, // Keep market reference for color mapping
        }))
        .filter((item) => item.tasks > 0 || item.hours > 0)
        .sort((a, b) => {
          // Sort by tasks first (descending), then by hours (descending)
          if (b.tasks !== a.tasks) {
            return b.tasks - a.tasks;
          }
          return b.hours - a.hours;
        })
        .map((item) => ({
          ...item,
          color: getMarketColor(item.market), // Use market color mapping
        }));

      return {
        userId,
        userName: userData.userName,
        ...(categoryName && { category: categoryName }),
        marketData,
        totalTasks: userData.totalTasks,
        totalHours: Math.round(userData.totalHours * 100) / 100,
      };
    })
    .filter((chart) => chart.marketData.length > 0) // Only include users with market data
    .sort((a, b) => {
      // Sort by total tasks first (descending), then by hours (descending)
      if (b.totalTasks !== a.totalTasks) {
        return b.totalTasks - a.totalTasks;
      }
      return b.totalHours - a.totalHours;
    });
};

/**
 * Calculate user table data with markets (generic function)
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @returns {Object} - Object with tableData and tableColumns
 */
export const calculateUserTable = (tasks, users) => {
  if (!tasks || tasks.length === 0 || !users || users.length === 0) {
    return {
      tableData: [],
      tableColumns: [
        { key: "user", header: "User", align: "left" },
        {
          key: "totalTasks",
          header: "Total Tasks",
          align: "center",
          highlight: true,
        },
        {
          key: "totalHours",
          header: "Total Hours",
          align: "center",
          highlight: true,
        },
      ],
    };
  }

  const userMarketStats = {};
  const allMarkets = new Set();

  tasks.forEach((task) => {
    const taskMarkets = getTaskMarkets(task);
    const taskHours = getTaskHours(task);
    const userId = getTaskUserUID(task);

    if (!userId || !taskMarkets || taskMarkets.length === 0) return;

    const userName = getUserName(userId, users);

    if (!userMarketStats[userId]) {
      userMarketStats[userId] = {
        userName,
        markets: {},
        totalTasks: 0,
        totalHours: 0,
      };
    }

    taskMarkets.forEach((market) => {
      if (market) {
        const normalizedMarket = normalizeMarket(market);
        allMarkets.add(normalizedMarket);
        if (!userMarketStats[userId].markets[normalizedMarket]) {
          userMarketStats[userId].markets[normalizedMarket] = {
            tasks: 0,
            hours: 0,
          };
        }
        userMarketStats[userId].markets[normalizedMarket].tasks += 1;
        userMarketStats[userId].markets[normalizedMarket].hours += taskHours;
      }
    });

    userMarketStats[userId].totalTasks += 1;
    userMarketStats[userId].totalHours += taskHours;
  });

  const sortedMarkets = Array.from(allMarkets).sort();
  const tableData = Object.entries(userMarketStats)
    .map(([_userId, userData]) => {
      const row = {
        user: userData.userName,
        totalTasks: userData.totalTasks,
        totalHours: Math.round(userData.totalHours * 100) / 100,
      };

      // Calculate market items for percentage calculation
      const marketItems = sortedMarkets.map((market) => ({
        key: market,
        count: userData.markets[market]?.tasks || 0,
      }));

      // Calculate total market occurrences (sum of all market counts)
      // This ensures percentages sum to 100% across all markets
      const totalMarketOccurrences = marketItems.reduce((sum, item) => sum + item.count, 0);

      // Add market columns with percentages and hours
      sortedMarkets.forEach((market) => {
        const marketData = userData.markets[market] || { tasks: 0, hours: 0 };
        const marketCount = marketData.tasks || 0;
        row[market] = calculateCountWithPercentage(
          marketCount,
          totalMarketOccurrences || userData.totalTasks, // Use total market occurrences, fallback to totalTasks if 0
          marketItems,
          market
        );
        // Add hours column for this market
        row[`${market}_hours`] = Math.round(marketData.hours * 100) / 100;
      });

      return row;
    })
    .sort((a, b) => {
      if (b.totalTasks !== a.totalTasks) {
        return b.totalTasks - a.totalTasks;
      }
      return a.user.localeCompare(b.user);
    });

  // Add grand total row using shared utility
  const tableDataWithTotal = addGrandTotalRow(tableData, {
    labelKey: "user",
    labelValue: "Grand Total",
    sumColumns: ["totalTasks", "totalHours"],
    marketColumns: sortedMarkets,
  });

  const tableColumns = [
    { key: "user", header: "User", align: "left" },
    {
      key: "totalTasks",
      header: "Total Tasks",
      align: "center",
      highlight: true,
    },
    {
      key: "totalHours",
      header: "Total Hours",
      align: "center",
      highlight: true,
    },
  ];

  sortedMarkets.forEach((market) => {
    tableColumns.push({
      key: market,
      header: market.toUpperCase(),
      align: "center",
      render: renderCountWithPercentage,
    });
    // Add hours column for each market
    tableColumns.push({
      key: `${market}_hours`,
      header: `${market.toUpperCase()} Hours`,
      align: "center",
      highlight: false,
    });
  });

  return { tableData: tableDataWithTotal, tableColumns };
};

