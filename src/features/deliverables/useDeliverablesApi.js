/**
 * Deliverables API (REST API)
 *
 * @fileoverview REST API hooks for deliverables
 * @author Senior Developer
 * @version 4.0.0
 */

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/apiClient";
import wsClient from "@/services/websocketClient";
import { logger } from "@/utils/logger";
// No cache - always fetch fresh data

const fetchLocks = new Map();

export const useDeliverables = () => {
  const [deliverables, setDeliverables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDeliverables = async () => {
      // Check if user is authenticated before making API calls
      const token = apiClient.getToken();
      if (!token) {
        setIsLoading(false);
        setDeliverables([]);
        setError(null);
        return;
      }

      try {
        const cacheKey = 'deliverables_list';

        if (fetchLocks.has(cacheKey)) {
          logger.log('🔍 [useDeliverables] Fetch already in progress, waiting...');
          const existingPromise = fetchLocks.get(cacheKey);
          try {
            const result = await existingPromise;
            setDeliverables(result);
            setIsLoading(false);
            setError(null);
            return;
          } catch (err) {
            // Handle 401 gracefully
            if (err.isUnauthorized) {
              setDeliverables([]);
              setIsLoading(false);
              setError(null);
              return;
            }
            setError(err);
            setIsLoading(false);
            return;
          }
        }

        logger.log('🔍 [useDeliverables] Fetching deliverables from API');
        setIsLoading(true);
        setError(null);

        const fetchPromise = (async () => {
          try {
            const deliverablesData = await apiClient.get('/deliverables');
            return deliverablesData;
          } finally {
            fetchLocks.delete(cacheKey);
          }
        })();

        fetchLocks.set(cacheKey, fetchPromise);
        const deliverablesData = await fetchPromise;

        setDeliverables(deliverablesData);
        setIsLoading(false);
        setError(null);
        logger.log('✅ [useDeliverables] Deliverables fetched and cached:', deliverablesData.length);
      } catch (err) {
        // Handle 401 gracefully - user not logged in yet
        if (err.isUnauthorized) {
          setDeliverables([]);
          setIsLoading(false);
          setError(null);
          return;
        }
        logger.error('❌ [useDeliverables] Fetch error:', err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchDeliverables();

    // Subscribe to WebSocket updates
    const handleDeliverableChange = (data) => {
      // Format deliverable to match frontend expectations
      const formatDeliverable = (deliverable) => {
        if (!deliverable) return deliverable;
        return {
          ...deliverable,
          timePerUnit: deliverable.time_per_unit ?? deliverable.timePerUnit,
          timeUnit: deliverable.time_unit ?? deliverable.timeUnit,
          variationsTime: deliverable.variations_time ?? deliverable.variationsTime,
          variationsTimeUnit: deliverable.variations_time_unit ?? deliverable.variationsTimeUnit,
          requiresQuantity: deliverable.requires_quantity ?? deliverable.requiresQuantity
        };
      };

      if (data.event === 'created') {
        logger.log('🔔 [WebSocket] Deliverable created event received:', data.deliverable);
        const formatted = formatDeliverable(data.deliverable);
        setDeliverables(prev => {
          logger.log('🔍 [WebSocket] Current deliverables before add:', prev.length);
          // Check if deliverable already exists (avoid duplicates)
          const exists = prev.some(d => d.id === formatted.id);
          if (exists) {
            logger.log('⚠️ [WebSocket] Deliverable already exists, skipping');
            return prev;
          }
          const updated = [...prev, formatted].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '')
          );
          logger.log('✅ [WebSocket] Added deliverable via WebSocket, new count:', updated.length);
          return updated;
        });
      } else if (data.event === 'updated') {
        const formatted = formatDeliverable(data.deliverable);
        setDeliverables(prev =>
          prev.map(d => d.id === formatted.id ? formatted : d)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        );
      } else if (data.event === 'deleted') {
        setDeliverables(prev => prev.filter(d => d.id !== data.deliverable.id));
      }
    };

    wsClient.on('deliverable_change', handleDeliverableChange);
    wsClient.subscribe(['deliverables']);

    return () => {
      wsClient.off('deliverable_change', handleDeliverableChange);
    };
  }, []); // Empty deps - only run once on mount

  const createDeliverable = useCallback(async (deliverableData, _userData = null) => {
    try {
      const newDeliverable = await apiClient.post('/deliverables', deliverableData);

      // Format the new deliverable to match frontend expectations
      const formatted = {
        ...newDeliverable,
        timePerUnit: newDeliverable.time_per_unit ?? newDeliverable.timePerUnit,
        timeUnit: newDeliverable.time_unit ?? newDeliverable.timeUnit,
        variationsTime: newDeliverable.variations_time ?? newDeliverable.variationsTime,
        variationsTimeUnit: newDeliverable.variations_time_unit ?? newDeliverable.variationsTimeUnit,
        requiresQuantity: newDeliverable.requires_quantity ?? newDeliverable.requiresQuantity
      };

      // Optimistically update the state immediately
      setDeliverables(prev => {
        logger.log('🔍 [createDeliverable] Current deliverables:', prev.length);
        // Check if deliverable already exists (avoid duplicates)
        const exists = prev.some(d => d.id === formatted.id);
        if (exists) {
          logger.log('⚠️ [createDeliverable] Deliverable already exists, skipping');
          return prev;
        }
        const updated = [...prev, formatted].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
        logger.log('✅ [createDeliverable] Added deliverable, new count:', updated.length);
        return updated;
      });

      logger.log('✅ [createDeliverable] Deliverable created successfully:', newDeliverable.id);
      return { success: true, id: newDeliverable.id, data: formatted };
    } catch (err) {
      logger.error('Error creating deliverable:', err);
      throw err;
    }
  }, []);

  const updateDeliverable = useCallback(async (deliverableId, updateData, _userData = null) => {
    try {
      await apiClient.put(`/deliverables/${deliverableId}`, updateData);
      logger.log('Deliverable updated successfully:', deliverableId);
      return { success: true };
    } catch (err) {
      logger.error('Error updating deliverable:', err);
      throw err;
    }
  }, []);

  const deleteDeliverable = useCallback(async (deliverableId, _userData = null) => {
    try {
      await apiClient.delete(`/deliverables/${deliverableId}`);
      logger.log('Deliverable deleted successfully:', deliverableId);
      return { success: true };
    } catch (err) {
      logger.error('Error deleting deliverable:', err);
      throw err;
    }
  }, []);

  return {
    deliverables,
    isLoading,
    error,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable
  };
};

// Export alias for backward compatibility
export const useDeliverablesApi = useDeliverables;

export const useGetDeliverablesQuery = useDeliverables;
export const useCreateDeliverableMutation = () => {
  const { createDeliverable } = useDeliverables();
  return [createDeliverable];
};
export const useUpdateDeliverableMutation = () => {
  const { updateDeliverable } = useDeliverables();
  return [updateDeliverable];
};
export const useDeleteDeliverableMutation = () => {
  const { deleteDeliverable } = useDeliverables();
  return [deleteDeliverable];
};
