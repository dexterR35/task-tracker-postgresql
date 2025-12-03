/**
 * Reporters API (REST API with WebSocket)
 *
 * @fileoverview REST API hooks for reporters
 * @author Senior Developer
 * @version 4.0.0
 */

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/apiClient";
import wsClient from "@/services/websocketClient";
import { logger } from "@/utils/logger";
// No cache - always fetch fresh data

const fetchLocks = new Map();

export const useReporters = () => {
  const [reporters, setReporters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReporters = async () => {
      // Check if user is authenticated before making API calls
      const token = apiClient.getToken();
      if (!token) {
        setIsLoading(false);
        setReporters([]);
        setError(null);
        return;
      }

      try {
        const cacheKey = 'reporters_list';

        if (fetchLocks.has(cacheKey)) {
          logger.log('🔍 [useReporters] Fetch already in progress, waiting...');
          const existingPromise = fetchLocks.get(cacheKey);
          try {
            const result = await existingPromise;
            setReporters(result);
            setIsLoading(false);
            setError(null);
            return;
          } catch (err) {
            // Handle 401 gracefully
            if (err.isUnauthorized) {
              setReporters([]);
              setIsLoading(false);
              setError(null);
              return;
            }
            setError(err);
            setIsLoading(false);
            return;
          }
        }

        logger.log('🔍 [useReporters] Fetching reporters from API');
        setIsLoading(true);
        setError(null);

        const fetchPromise = (async () => {
          try {
            const reportersData = await apiClient.get('/reporters');
            return reportersData;
          } finally {
            fetchLocks.delete(cacheKey);
          }
        })();

        fetchLocks.set(cacheKey, fetchPromise);
        const reportersData = await fetchPromise;

        setReporters(reportersData);
        setIsLoading(false);
        setError(null);
        logger.log('✅ [useReporters] Reporters fetched and cached:', reportersData.length);
      } catch (err) {
        // Handle 401 gracefully - user not logged in yet
        if (err.isUnauthorized) {
          setReporters([]);
          setIsLoading(false);
          setError(null);
          return;
        }
        logger.error('❌ [useReporters] Fetch error:', err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchReporters();

    // Subscribe to WebSocket updates
    const handleReporterChange = (data) => {
      if (data.event === 'created') {
        logger.log('🔔 [WebSocket] Reporter created event received:', data.reporter);
        setReporters(prev => {
          // Check if reporter already exists (avoid duplicates)
          const exists = prev.some(r => r.id === data.reporter.id);
          if (exists) {
            logger.log('⚠️ [WebSocket] Reporter already exists, skipping');
            return prev;
          }
          const updated = [...prev, data.reporter].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          );
          logger.log('✅ [WebSocket] Added reporter via WebSocket, new count:', updated.length);
          return updated;
        });
      } else if (data.event === 'updated') {
        logger.log('🔔 [WebSocket] Reporter updated event received:', data.reporter);
        setReporters(prev =>
          prev.map(r => r.id === data.reporter.id ? data.reporter : r)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        );
      } else if (data.event === 'deleted') {
        logger.log('🔔 [WebSocket] Reporter deleted event received:', data.reporter);
        setReporters(prev => prev.filter(r => r.id !== data.reporter.id));
      }
    };

    wsClient.on('reporter_change', handleReporterChange);
    wsClient.subscribe(['reporters']);

    return () => {
      wsClient.off('reporter_change', handleReporterChange);
    };
  }, []); // Empty deps - only run once on mount

  const createReporter = useCallback(async (reporterData, _userData = null) => {
    try {
      const newReporter = await apiClient.post('/reporters', reporterData);
      logger.log('Reporter created successfully:', newReporter.id);
      return { success: true, id: newReporter.id };
    } catch (err) {
      logger.error('Error creating reporter:', err);
      throw err;
    }
  }, []);

  const updateReporter = useCallback(async (reporterId, updateData, _userData = null) => {
    try {
      await apiClient.put(`/reporters/${reporterId}`, updateData);
      logger.log('Reporter updated successfully:', reporterId);
      return { success: true };
    } catch (err) {
      logger.error('Error updating reporter:', err);
      throw err;
    }
  }, []);

  const deleteReporter = useCallback(async (reporterId, _userData = null) => {
    try {
      await apiClient.delete(`/reporters/${reporterId}`);
      logger.log('Reporter deleted successfully:', reporterId);
      return { success: true };
    } catch (err) {
      logger.error('Error deleting reporter:', err);
      throw err;
    }
  }, []);

  return {
    reporters,
    isLoading,
    error,
    createReporter,
    updateReporter,
    deleteReporter
  };
};

export const useGetReportersQuery = useReporters;
export const useCreateReporterMutation = () => {
  const { createReporter } = useReporters();
  return [createReporter];
};
export const useUpdateReporterMutation = () => {
  const { updateReporter } = useReporters();
  return [updateReporter];
};
export const useDeleteReporterMutation = () => {
  const { deleteReporter } = useReporters();
  return [deleteReporter];
};
