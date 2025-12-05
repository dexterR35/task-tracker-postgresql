/**
 * Months API (REST API with WebSocket)
 *
 * @fileoverview REST API hooks for month board management
 * @author Senior Developer
 * @version 4.0.0
 */

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/apiClient";
import wsClient from "@/services/websocketClient";
import { logger } from "@/utils/logger";
// No cache - always fetch fresh data
import { getMonthInfo } from "@/utils/monthUtils.jsx";
import { getCurrentYear } from "@/utils/dateUtils";

// Global fetch lock to prevent concurrent fetches
const fetchLocks = new Map();

/**
 * Current Month Hook
 */
export const useCurrentMonth = (userUID = null, role = 'user', _userData = null) => {
  const [currentMonth, setCurrentMonth] = useState(null);
  const [boardExists, setBoardExists] = useState(false);
  const [currentMonthBoard, setCurrentMonthBoard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCurrentMonth = async () => {
      // Check if user is authenticated before making API calls
      const token = apiClient.getToken();
      if (!token) {
        setIsLoading(false);
        setCurrentMonth(null);
        setBoardExists(false);
        setCurrentMonthBoard(null);
        setError(null);
        return;
      }

      try {
        logger.log('🔍 [useCurrentMonth] Fetching months data', { userUID, role });
        setIsLoading(true);
        setError(null);

        const currentMonthInfo = getMonthInfo();
        const yearId = getCurrentYear();
        const cacheKey = `months_${yearId}`;

        // Check if fetch is already in progress
        if (fetchLocks.has(cacheKey)) {
          logger.log('🔍 [useCurrentMonth] Fetch already in progress, waiting...');
          const existingPromise = fetchLocks.get(cacheKey);
          try {
            const result = await existingPromise;
            setCurrentMonth(currentMonthInfo);
            setBoardExists(result.boardExists);
            setCurrentMonthBoard(result.currentMonthBoard);
            setIsLoading(false);
            return;
          } catch (err) {
            // Handle 401 gracefully
            if (err.isUnauthorized) {
              setCurrentMonth(null);
              setBoardExists(false);
              setCurrentMonthBoard(null);
              setIsLoading(false);
              setError(null);
              return;
            }
            setError(err);
            setIsLoading(false);
            return;
          }
        }

        logger.log('🔍 [useCurrentMonth] Fetching current month from API');

        const fetchPromise = (async () => {
          try {
            // Fetch current month
            let boardExistsResult = false;
            let currentMonthBoardResult = null;

            try {
              const monthData = await apiClient.get(`/months/${currentMonthInfo.monthId}`);
              boardExistsResult = true;
              const metadata = typeof monthData.metadata === 'string' 
                ? JSON.parse(monthData.metadata) 
                : monthData.metadata || {};
              
              currentMonthBoardResult = {
                ...monthData,
                monthId: monthData.month_id || monthData.monthId,
                metadata,
                // Extract metadata fields to top level for easy access
                monthName: monthData.monthName || metadata.monthName || null,
                startDate: monthData.startDate || metadata.startDate || null,
                endDate: monthData.endDate || metadata.endDate || null,
                daysInMonth: monthData.daysInMonth || metadata.daysInMonth || null,
                boardId: monthData.boardId || metadata.boardId || null
              };
            } catch (err) {
              if (err.status !== 404) {
                throw err;
              }
              // Month doesn't exist, which is fine
            }

            const cacheData = {
              boardExists: boardExistsResult,
              currentMonthBoard: currentMonthBoardResult
            };

            return cacheData;
          } finally {
            fetchLocks.delete(cacheKey);
          }
        })();

        fetchLocks.set(cacheKey, fetchPromise);
        const result = await fetchPromise;

        setCurrentMonth(currentMonthInfo);
        setBoardExists(result.boardExists);
        setCurrentMonthBoard(result.currentMonthBoard);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        // Handle 401 gracefully - user not logged in yet
        if (err.isUnauthorized) {
          setCurrentMonth(null);
          setBoardExists(false);
          setCurrentMonthBoard(null);
          setIsLoading(false);
          setError(null);
          return;
        }
        logger.error('❌ [useCurrentMonth] Fetch error:', err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchCurrentMonth();

    // Subscribe to WebSocket updates
    const handleMonthChange = (data) => {
      if (data.month && data.month.month_id === currentMonth?.monthId) {
        if (data.event === 'created' || data.event === 'updated') {
          setBoardExists(true);
          setCurrentMonthBoard({
            ...data.month,
            monthId: data.month.month_id,
            metadata: typeof data.month.metadata === 'string' 
              ? JSON.parse(data.month.metadata) 
              : data.month.metadata
          });
        }
      }
    };

    wsClient.on('month_change', handleMonthChange);
    wsClient.subscribe(['months']);

    return () => {
      wsClient.off('month_change', handleMonthChange);
    };
  }, []); // Remove userUID and role from dependencies - they're not used in the fetch logic

  return {
    currentMonth,
    boardExists,
    currentMonthBoard,
    isLoading,
    error
  };
};

/**
 * Available Months Hook
 */
export const useAvailableMonths = (yearId = null) => {
  const [months, setMonths] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMonths = async () => {
      // Check if user is authenticated before making API calls
      const token = apiClient.getToken();
      if (!token) {
        setIsLoading(false);
        setMonths([]);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const params = yearId ? { yearId } : {};
        const monthsData = await apiClient.get('/months', params);
        
        const formattedMonths = monthsData.map(month => {
          const metadata = typeof month.metadata === 'string' 
            ? JSON.parse(month.metadata) 
            : month.metadata || {};
          
          return {
            ...month,
            monthId: month.month_id || month.monthId,
            metadata,
            // Extract metadata fields to top level for easy access
            monthName: month.monthName || metadata.monthName || null,
            startDate: month.startDate || metadata.startDate || null,
            endDate: month.endDate || metadata.endDate || null,
            daysInMonth: month.daysInMonth || metadata.daysInMonth || null,
            boardId: month.boardId || metadata.boardId || null,
            boardExists: true // If month exists in DB, board exists
          };
        });

        setMonths(formattedMonths);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        // Handle 401 gracefully - user not logged in yet
        if (err.isUnauthorized) {
          setMonths([]);
          setIsLoading(false);
          setError(null);
          return;
        }
        logger.error('❌ [useAvailableMonths] Fetch error:', err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchMonths();

    // Subscribe to WebSocket updates for real-time month changes
    const handleMonthChange = (data) => {
      logger.log('🔔 [WebSocket] Month change event received:', data);
      
      if (data.event === 'created') {
        logger.log('✅ [WebSocket] Month created event received:', data.month);
        setMonths(prev => {
          // Check if month already exists
          const monthId = data.month.month_id || data.month.monthId;
          const exists = prev.some(m => (m.month_id || m.monthId) === monthId);
          
          if (exists) {
            // Update existing month
            logger.log('⚠️ [WebSocket] Month already exists, updating instead');
            return prev.map(m => {
              const mId = m.month_id || m.monthId;
              if (mId === monthId) {
                const metadata = typeof data.month.metadata === 'string' 
                  ? JSON.parse(data.month.metadata) 
                  : data.month.metadata || {};
                return {
                  ...data.month,
                  monthId: monthId,
                  metadata,
                  monthName: data.month.monthName || metadata.monthName || null,
                  startDate: data.month.startDate || metadata.startDate || null,
                  endDate: data.month.endDate || metadata.endDate || null,
                  daysInMonth: data.month.daysInMonth || metadata.daysInMonth || null,
                  boardId: data.month.boardId || metadata.boardId || null,
                  boardExists: true
                };
              }
              return m;
            });
          }
          
          // Add new month
          const metadata = typeof data.month.metadata === 'string' 
            ? JSON.parse(data.month.metadata) 
            : data.month.metadata || {};
          const newMonth = {
            ...data.month,
            monthId: monthId,
            metadata,
            monthName: data.month.monthName || metadata.monthName || null,
            startDate: data.month.startDate || metadata.startDate || null,
            endDate: data.month.endDate || metadata.endDate || null,
            daysInMonth: data.month.daysInMonth || metadata.daysInMonth || null,
            boardId: data.month.boardId || metadata.boardId || null,
            boardExists: true
          };
          
          // Filter by yearId if provided
          if (yearId && newMonth.year_id !== yearId) {
            return prev;
          }
          
          return [...prev, newMonth].sort((a, b) => {
            const aId = a.month_id || a.monthId || '';
            const bId = b.month_id || b.monthId || '';
            return bId.localeCompare(aId); // Sort descending (newest first)
          });
        });
      } else if (data.event === 'updated') {
        logger.log('✅ [WebSocket] Month updated event received:', data.month);
        setMonths(prev => {
          const monthId = data.month.month_id || data.month.monthId;
          const metadata = typeof data.month.metadata === 'string' 
            ? JSON.parse(data.month.metadata) 
            : data.month.metadata || {};
          return prev.map(m => {
            const mId = m.month_id || m.monthId;
            if (mId === monthId) {
              return {
                ...data.month,
                monthId: monthId,
                metadata,
                monthName: data.month.monthName || metadata.monthName || null,
                startDate: data.month.startDate || metadata.startDate || null,
                endDate: data.month.endDate || metadata.endDate || null,
                daysInMonth: data.month.daysInMonth || metadata.daysInMonth || null,
                boardId: data.month.boardId || metadata.boardId || null,
                boardExists: true
              };
            }
            return m;
          });
        });
      } else if (data.event === 'deleted') {
        logger.log('✅ [WebSocket] Month deleted event received:', data.month);
        setMonths(prev => {
          const monthId = data.month.month_id || data.month.monthId;
          return prev.filter(m => {
            const mId = m.month_id || m.monthId;
            return mId !== monthId;
          });
        });
      }
    };

    wsClient.on('month_change', handleMonthChange);
    wsClient.subscribe(['months']);

    return () => {
      wsClient.off('month_change', handleMonthChange);
    };
  }, [yearId]);

  return { months, isLoading, error };
};

/**
 * Create Month Hook
 */
export const useCreateMonth = () => {
  const createMonth = useCallback(async (monthData, userData) => {
    try {
      const result = await apiClient.post('/months', monthData);
      logger.log('Month created successfully:', result.month_id);
      return { success: true, data: result };
    } catch (err) {
      logger.error('Error creating month:', err);
      throw err;
    }
  }, []);

  return [createMonth];
};

// Export hooks for backward compatibility
export const useGetCurrentMonthQuery = useCurrentMonth;
export const useGetAvailableMonthsQuery = useAvailableMonths;
export const useCreateMonthMutation = useCreateMonth;
export const useCreateMonthBoard = useCreateMonth; // Alias for backward compatibility
