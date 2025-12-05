import { useMemo } from 'react';
import {
  getTaskMarkets,
  getTaskProducts,
  getTaskHours,
  getTaskUserUID,
  getUserName,
  normalizeMarket,
} from '@/components/Cards/configs/analyticsSharedConfig';

/**
 * Analytics Hooks
 * Reusable hooks for calculating analytics data per user, per market, per category
 * Each hook is independent and can be used separately
 */

/**
 * Check if a product string matches a category
 */
const isProductCategory = (products, category) => {
  if (!products || typeof products !== 'string') return false;
  const productsLower = products.toLowerCase().trim();
  
  switch (category) {
    case 'product':
      return productsLower.startsWith('product ');
    case 'acquisition':
      return productsLower.includes('acquisition') && 
             !productsLower.startsWith('product ') && 
             !productsLower.startsWith('marketing ') && 
             !productsLower.startsWith('misc ');
    case 'marketing':
      return productsLower.startsWith('marketing ') || 
             productsLower === 'marketing' ||
             (productsLower.includes('marketing') && 
              !productsLower.startsWith('product ') && 
              !productsLower.startsWith('acquisition ') && 
              !productsLower.startsWith('misc '));
    case 'misc':
      return productsLower.startsWith('misc ') || productsLower === 'misc';
    default:
      return false;
  }
};

/**
 * Filter tasks by various criteria
 */
const filterTasks = (tasks, filters = {}) => {
  if (!tasks || !Array.isArray(tasks)) return [];
  
  let filtered = tasks;

  if (filters.userId) {
    filtered = filtered.filter(task => {
      const userId = getTaskUserUID(task);
      return userId === filters.userId;
    });
  }

  if (filters.market) {
    filtered = filtered.filter(task => {
      const markets = getTaskMarkets(task);
      return markets.includes(filters.market);
    });
  }

  if (filters.category) {
    filtered = filtered.filter(task => {
      const products = getTaskProducts(task);
      return isProductCategory(products, filters.category);
    });
  }

  if (filters.monthId) {
    filtered = filtered.filter(task => task.monthId === filters.monthId);
  }

  return filtered;
};

/**
 * Hook: Calculate total tasks per user per market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Optional filters { userId, market, category, monthId }
 * @returns {Object} { totalTasks, tasksByUser, tasksByMarket, tasksByUserAndMarket }
 */
export const useTotalTasks = (tasks, users = [], filters = {}) => {
  return useMemo(() => {
    const filteredTasks = filterTasks(tasks, filters);
    
    if (filteredTasks.length === 0) {
      return {
        totalTasks: 0,
        tasksByUser: {},
        tasksByMarket: {},
        tasksByUserAndMarket: {},
      };
    }

    const totalTasks = filteredTasks.length;
    const tasksByUser = {};
    const tasksByMarket = {};
    const tasksByUserAndMarket = {};

    filteredTasks.forEach(task => {
      const userId = getTaskUserUID(task);
      const markets = getTaskMarkets(task);
      
      if (userId) {
        tasksByUser[userId] = (tasksByUser[userId] || 0) + 1;
        
        if (!tasksByUserAndMarket[userId]) {
          tasksByUserAndMarket[userId] = {};
        }
        
        markets.forEach(market => {
          if (market) {
            const normalizedMarket = normalizeMarket(market);
            tasksByMarket[normalizedMarket] = (tasksByMarket[normalizedMarket] || 0) + 1;
            tasksByUserAndMarket[userId][normalizedMarket] = 
              (tasksByUserAndMarket[userId][normalizedMarket] || 0) + 1;
          }
        });
      }
    });

    return {
      totalTasks,
      tasksByUser,
      tasksByMarket,
      tasksByUserAndMarket,
    };
  }, [tasks, users, filters.userId, filters.market, filters.category, filters.monthId]);
};

/**
 * Hook: Calculate total hours per user per market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Optional filters { userId, market, category, monthId }
 * @returns {Object} { totalHours, hoursByUser, hoursByMarket, hoursByUserAndMarket }
 */
export const useTotalHours = (tasks, users = [], filters = {}) => {
  return useMemo(() => {
    const filteredTasks = filterTasks(tasks, filters);
    
    if (filteredTasks.length === 0) {
      return {
        totalHours: 0,
        hoursByUser: {},
        hoursByMarket: {},
        hoursByUserAndMarket: {},
      };
    }

    let totalHours = 0;
    const hoursByUser = {};
    const hoursByMarket = {};
    const hoursByUserAndMarket = {};

    filteredTasks.forEach(task => {
      const userId = getTaskUserUID(task);
      const markets = getTaskMarkets(task);
      const hours = getTaskHours(task);
      const hoursValue = typeof hours === 'number' ? hours : 0;
      
      totalHours += hoursValue;
      
      if (userId) {
        hoursByUser[userId] = (hoursByUser[userId] || 0) + hoursValue;
        
        if (!hoursByUserAndMarket[userId]) {
          hoursByUserAndMarket[userId] = {};
        }
        
        // Distribute hours across markets
        const hoursPerMarket = markets.length > 0 ? hoursValue / markets.length : 0;
        markets.forEach(market => {
          if (market) {
            const normalizedMarket = normalizeMarket(market);
            hoursByMarket[normalizedMarket] = (hoursByMarket[normalizedMarket] || 0) + hoursPerMarket;
            hoursByUserAndMarket[userId][normalizedMarket] = 
              (hoursByUserAndMarket[userId][normalizedMarket] || 0) + hoursPerMarket;
          }
        });
      }
    });

    const round = (val) => Math.round(val * 100) / 100;

    return {
      totalHours: round(totalHours),
      hoursByUser: Object.fromEntries(
        Object.entries(hoursByUser).map(([k, v]) => [k, round(v)])
      ),
      hoursByMarket: Object.fromEntries(
        Object.entries(hoursByMarket).map(([k, v]) => [k, round(v)])
      ),
      hoursByUserAndMarket: Object.fromEntries(
        Object.entries(hoursByUserAndMarket).map(([userId, markets]) => [
          userId,
          Object.fromEntries(
            Object.entries(markets).map(([market, hours]) => [market, round(hours)])
          )
        ])
      ),
    };
  }, [tasks, users, filters.userId, filters.market, filters.category, filters.monthId]);
};

/**
 * Hook: Calculate total deliverables per user per market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Optional filters { userId, market, category, monthId }
 * @returns {Object} { totalDeliverables, deliverablesByUser, deliverablesByMarket, deliverablesByUserAndMarket }
 */
export const useTotalDeliverables = (tasks, users = [], filters = {}) => {
  return useMemo(() => {
    const filteredTasks = filterTasks(tasks, filters);
    
    if (filteredTasks.length === 0) {
      return {
        totalDeliverables: 0,
        deliverablesByUser: {},
        deliverablesByMarket: {},
        deliverablesByUserAndMarket: {},
      };
    }

    let totalDeliverables = 0;
    const deliverablesByUser = {};
    const deliverablesByMarket = {};
    const deliverablesByUserAndMarket = {};

    filteredTasks.forEach(task => {
      const userId = getTaskUserUID(task);
      const markets = getTaskMarkets(task);
      const deliverables = task.data_task?.deliverablesUsed || task.deliverablesUsed || [];
      const deliverableCount = deliverables.reduce((delSum, del) => delSum + (del.count || 1), 0);
      
      totalDeliverables += deliverableCount;
      
      if (userId) {
        deliverablesByUser[userId] = (deliverablesByUser[userId] || 0) + deliverableCount;
        
        if (!deliverablesByUserAndMarket[userId]) {
          deliverablesByUserAndMarket[userId] = {};
        }
        
        markets.forEach(market => {
          if (market) {
            const normalizedMarket = normalizeMarket(market);
            deliverablesByMarket[normalizedMarket] = 
              (deliverablesByMarket[normalizedMarket] || 0) + deliverableCount;
            deliverablesByUserAndMarket[userId][normalizedMarket] = 
              (deliverablesByUserAndMarket[userId][normalizedMarket] || 0) + deliverableCount;
          }
        });
      }
    });

    return {
      totalDeliverables,
      deliverablesByUser,
      deliverablesByMarket,
      deliverablesByUserAndMarket,
    };
  }, [tasks, users, filters.userId, filters.market, filters.category, filters.monthId]);
};

/**
 * Hook: Calculate total variations per user per market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Optional filters { userId, market, category, monthId }
 * @returns {Object} { totalVariations, variationsByUser, variationsByMarket, variationsByUserAndMarket }
 */
export const useTotalVariations = (tasks, users = [], filters = {}) => {
  return useMemo(() => {
    const filteredTasks = filterTasks(tasks, filters);
    
    if (filteredTasks.length === 0) {
      return {
        totalVariations: 0,
        variationsByUser: {},
        variationsByMarket: {},
        variationsByUserAndMarket: {},
      };
    }

    let totalVariations = 0;
    const variationsByUser = {};
    const variationsByMarket = {};
    const variationsByUserAndMarket = {};

    filteredTasks.forEach(task => {
      const userId = getTaskUserUID(task);
      const markets = getTaskMarkets(task);
      const deliverables = task.data_task?.deliverablesUsed || task.deliverablesUsed || [];
      const variationCount = deliverables.reduce((delSum, del) => 
        delSum + (del.variationsCount || del.variationsQuantity || 0), 0
      );
      
      totalVariations += variationCount;
      
      if (userId) {
        variationsByUser[userId] = (variationsByUser[userId] || 0) + variationCount;
        
        if (!variationsByUserAndMarket[userId]) {
          variationsByUserAndMarket[userId] = {};
        }
        
        markets.forEach(market => {
          if (market) {
            const normalizedMarket = normalizeMarket(market);
            variationsByMarket[normalizedMarket] = 
              (variationsByMarket[normalizedMarket] || 0) + variationCount;
            variationsByUserAndMarket[userId][normalizedMarket] = 
              (variationsByUserAndMarket[userId][normalizedMarket] || 0) + variationCount;
          }
        });
      }
    });

    return {
      totalVariations,
      variationsByUser,
      variationsByMarket,
      variationsByUserAndMarket,
    };
  }, [tasks, users, filters.userId, filters.market, filters.category, filters.monthId]);
};

/**
 * Hook: Calculate deliverables hours (base and with variations)
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Array} deliverablesOptions - Array of deliverable options with timePerUnit, etc.
 * @param {Object} filters - Optional filters { userId, market, category, monthId }
 * @returns {Object} { totalDeliverablesHours, totalDeliverablesWithVariationsHours, hoursByUser, hoursByMarket }
 */
export const useDeliverablesHours = (tasks, users = [], deliverablesOptions = [], filters = {}) => {
  return useMemo(() => {
    const filteredTasks = filterTasks(tasks, filters);
    
    if (filteredTasks.length === 0 || !deliverablesOptions || deliverablesOptions.length === 0) {
      return {
        totalDeliverablesHours: 0,
        totalDeliverablesWithVariationsHours: 0,
        hoursByUser: {},
        hoursByMarket: {},
        hoursByUserAndMarket: {},
      };
    }

    let totalDeliverablesHours = 0;
    let totalDeliverablesWithVariationsHours = 0;
    const hoursByUser = {};
    const hoursByMarket = {};
    const hoursByUserAndMarket = {};

    filteredTasks.forEach(task => {
      const userId = getTaskUserUID(task);
      const markets = getTaskMarkets(task);
      const deliverables = task.data_task?.deliverablesUsed || task.deliverablesUsed || [];
      
      if (!deliverables || deliverables.length === 0) return;

      deliverables.forEach(deliverable => {
        const deliverableName = deliverable?.name;
        const quantity = deliverable?.count || 1;
        const variationsQuantity = deliverable?.variationsCount || 
                                   deliverable?.variationsQuantity || 0;

        if (!deliverableName) return;

        const deliverableOption = deliverablesOptions.find(d =>
          d.value && d.value.toLowerCase().trim() === deliverableName.toLowerCase().trim()
        );

        if (deliverableOption) {
          const timePerUnit = deliverableOption.timePerUnit || 1;
          const timeUnit = deliverableOption.timeUnit || 'hr';
          const requiresQuantity = deliverableOption.requiresQuantity || false;

          // Convert base time to hours
          let baseTimeInHours = timePerUnit;
          if (timeUnit === 'min') baseTimeInHours = timePerUnit / 60;
          else if (timeUnit === 'hr') baseTimeInHours = timePerUnit;
          else if (timeUnit === 'day') baseTimeInHours = timePerUnit * 8;

          // Calculate base time for this deliverable
          const deliverableBaseHours = baseTimeInHours * quantity;
          totalDeliverablesHours += deliverableBaseHours;

          // Calculate variations time if applicable
          let variationsTimeInHours = 0;
          if (requiresQuantity && variationsQuantity > 0) {
            const variationsTime = deliverableOption.variationsTime || 0;
            const variationsTimeUnit = deliverableOption.variationsTimeUnit || 'min';

            let variationsTimePerUnitInHours = variationsTime;
            if (variationsTimeUnit === 'min') variationsTimePerUnitInHours = variationsTime / 60;
            else if (variationsTimeUnit === 'hr') variationsTimePerUnitInHours = variationsTime;
            else if (variationsTimeUnit === 'day') variationsTimePerUnitInHours = variationsTime * 8;

            variationsTimeInHours = variationsTimePerUnitInHours * variationsQuantity;
          }

          // Total time with variations
          const totalWithVariations = deliverableBaseHours + variationsTimeInHours;
          totalDeliverablesWithVariationsHours += totalWithVariations;

          // Track by user and market
          if (userId) {
            hoursByUser[userId] = (hoursByUser[userId] || 0) + totalWithVariations;
            
            if (!hoursByUserAndMarket[userId]) {
              hoursByUserAndMarket[userId] = {};
            }
            
            const hoursPerMarket = markets.length > 0 ? totalWithVariations / markets.length : 0;
            markets.forEach(market => {
              if (market) {
                const normalizedMarket = normalizeMarket(market);
                hoursByMarket[normalizedMarket] = (hoursByMarket[normalizedMarket] || 0) + hoursPerMarket;
                hoursByUserAndMarket[userId][normalizedMarket] = 
                  (hoursByUserAndMarket[userId][normalizedMarket] || 0) + hoursPerMarket;
              }
            });
          }
        }
      });
    });

    const round = (val) => Math.round(val * 100) / 100;

    return {
      totalDeliverablesHours: round(totalDeliverablesHours),
      totalDeliverablesWithVariationsHours: round(totalDeliverablesWithVariationsHours),
      hoursByUser: Object.fromEntries(
        Object.entries(hoursByUser).map(([k, v]) => [k, round(v)])
      ),
      hoursByMarket: Object.fromEntries(
        Object.entries(hoursByMarket).map(([k, v]) => [k, round(v)])
      ),
      hoursByUserAndMarket: Object.fromEntries(
        Object.entries(hoursByUserAndMarket).map(([userId, markets]) => [
          userId,
          Object.fromEntries(
            Object.entries(markets).map(([market, hours]) => [market, round(hours)])
          )
        ])
      ),
    };
  }, [tasks, users, deliverablesOptions, filters.userId, filters.market, filters.category, filters.monthId]);
};

/**
 * Hook: Calculate acquisition tasks per user per market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Optional filters { userId, market, monthId }
 * @returns {Object} { totalTasks, totalHours, tasksByUser, tasksByMarket, hoursByUser, hoursByMarket }
 */
export const useAcquisitionTasks = (tasks, users = [], filters = {}) => {
  const categoryFilters = { ...filters, category: 'acquisition' };
  const tasksData = useTotalTasks(tasks, users, categoryFilters);
  const hoursData = useTotalHours(tasks, users, categoryFilters);
  
  return useMemo(() => ({
    totalTasks: tasksData.totalTasks,
    totalHours: hoursData.totalHours,
    tasksByUser: tasksData.tasksByUser,
    tasksByMarket: tasksData.tasksByMarket,
    tasksByUserAndMarket: tasksData.tasksByUserAndMarket,
    hoursByUser: hoursData.hoursByUser,
    hoursByMarket: hoursData.hoursByMarket,
    hoursByUserAndMarket: hoursData.hoursByUserAndMarket,
  }), [tasksData, hoursData]);
};

/**
 * Hook: Calculate marketing tasks per user per market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Optional filters { userId, market, monthId }
 * @returns {Object} { totalTasks, totalHours, tasksByUser, tasksByMarket, hoursByUser, hoursByMarket }
 */
export const useMarketingTasks = (tasks, users = [], filters = {}) => {
  const categoryFilters = { ...filters, category: 'marketing' };
  const tasksData = useTotalTasks(tasks, users, categoryFilters);
  const hoursData = useTotalHours(tasks, users, categoryFilters);
  
  return useMemo(() => ({
    totalTasks: tasksData.totalTasks,
    totalHours: hoursData.totalHours,
    tasksByUser: tasksData.tasksByUser,
    tasksByMarket: tasksData.tasksByMarket,
    tasksByUserAndMarket: tasksData.tasksByUserAndMarket,
    hoursByUser: hoursData.hoursByUser,
    hoursByMarket: hoursData.hoursByMarket,
    hoursByUserAndMarket: hoursData.hoursByUserAndMarket,
  }), [tasksData, hoursData]);
};

/**
 * Hook: Calculate product tasks per user per market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Optional filters { userId, market, monthId }
 * @returns {Object} { totalTasks, totalHours, tasksByUser, tasksByMarket, hoursByUser, hoursByMarket }
 */
export const useProductTasks = (tasks, users = [], filters = {}) => {
  const categoryFilters = { ...filters, category: 'product' };
  const tasksData = useTotalTasks(tasks, users, categoryFilters);
  const hoursData = useTotalHours(tasks, users, categoryFilters);
  
  return useMemo(() => ({
    totalTasks: tasksData.totalTasks,
    totalHours: hoursData.totalHours,
    tasksByUser: tasksData.tasksByUser,
    tasksByMarket: tasksData.tasksByMarket,
    tasksByUserAndMarket: tasksData.tasksByUserAndMarket,
    hoursByUser: hoursData.hoursByUser,
    hoursByMarket: hoursData.hoursByMarket,
    hoursByUserAndMarket: hoursData.hoursByUserAndMarket,
  }), [tasksData, hoursData]);
};

/**
 * Hook: Calculate misc tasks per user per market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {Object} filters - Optional filters { userId, market, monthId }
 * @returns {Object} { totalTasks, totalHours, tasksByUser, tasksByMarket, hoursByUser, hoursByMarket }
 */
export const useMiscTasks = (tasks, users = [], filters = {}) => {
  const categoryFilters = { ...filters, category: 'misc' };
  const tasksData = useTotalTasks(tasks, users, categoryFilters);
  const hoursData = useTotalHours(tasks, users, categoryFilters);
  
  return useMemo(() => ({
    totalTasks: tasksData.totalTasks,
    totalHours: hoursData.totalHours,
    tasksByUser: tasksData.tasksByUser,
    tasksByMarket: tasksData.tasksByMarket,
    tasksByUserAndMarket: tasksData.tasksByUserAndMarket,
    hoursByUser: hoursData.hoursByUser,
    hoursByMarket: hoursData.hoursByMarket,
    hoursByUserAndMarket: hoursData.hoursByUserAndMarket,
  }), [tasksData, hoursData]);
};

/**
 * Hook: Get analytics for a specific user and market
 * @param {Array} tasks - Array of tasks
 * @param {Array} users - Array of user objects
 * @param {string} userId - User ID
 * @param {string} market - Market code
 * @param {string} monthId - Optional month ID
 * @returns {Object} Complete analytics data
 */
export const useUserMarketAnalytics = (tasks, users = [], userId, market, monthId = null) => {
  const filters = useMemo(() => ({ userId, market, monthId }), [userId, market, monthId]);
  
  const totalTasks = useTotalTasks(tasks, users, filters);
  const totalHours = useTotalHours(tasks, users, filters);
  const totalDeliverables = useTotalDeliverables(tasks, users, filters);
  const acquisitionTasks = useAcquisitionTasks(tasks, users, filters);
  const marketingTasks = useMarketingTasks(tasks, users, filters);
  const productTasks = useProductTasks(tasks, users, filters);
  const miscTasks = useMiscTasks(tasks, users, filters);
  
  return useMemo(() => ({
    totalTasks: totalTasks.totalTasks,
    totalHours: totalHours.totalHours,
    totalDeliverables: totalDeliverables.totalDeliverables,
    acquisition: {
      tasks: acquisitionTasks.totalTasks,
      hours: acquisitionTasks.totalHours,
    },
    marketing: {
      tasks: marketingTasks.totalTasks,
      hours: marketingTasks.totalHours,
    },
    product: {
      tasks: productTasks.totalTasks,
      hours: productTasks.totalHours,
    },
    misc: {
      tasks: miscTasks.totalTasks,
      hours: miscTasks.totalHours,
    },
  }), [totalTasks, totalHours, totalDeliverables, acquisitionTasks, marketingTasks, productTasks, miscTasks]);
};
