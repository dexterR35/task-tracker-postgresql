/**
 * Team Days Off API (REST API with WebSocket)
 *
 * @fileoverview REST API hooks for team days off with real-time updates
 * @author Senior Developer
 * @version 2.0.0
 */

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/apiClient";
import wsClient from "@/services/websocketClient";
import { logger } from "@/utils/logger";
// No cache - always fetch fresh data

export const useTeamDaysOff = () => {
  const [teamDaysOff, setTeamDaysOff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeamDaysOff = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await apiClient.get('/team-days-off');
        setTeamDaysOff(data);
        setIsLoading(false);
        setError(null);
        logger.log('✅ [useTeamDaysOff] Team days off fetched:', data.length);
      } catch (err) {
        logger.error('❌ [useTeamDaysOff] Fetch error:', err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchTeamDaysOff();

    // Subscribe to WebSocket updates
    const handleTeamDaysOffChange = (data) => {
      if (data.event === 'created') {
        logger.log('🔔 [WebSocket] Team days off created event received:', data.teamDaysOff);
        setTeamDaysOff(prev => {
          // Check by user_UID since that's the unique constraint
          const userUID = data.teamDaysOff.user_UID || data.teamDaysOff.userUID;
          const exists = prev.some(t => 
            (t.user_UID || t.userUID) === userUID || t.id === data.teamDaysOff.id
          );
          if (exists) {
            // If exists, update it instead of skipping (might be a race condition)
            logger.log('⚠️ [WebSocket] Team days off already exists, updating instead');
            return prev.map(t => 
              (t.user_UID || t.userUID) === userUID || t.id === data.teamDaysOff.id 
                ? data.teamDaysOff 
                : t
            );
          }
          return [...prev, data.teamDaysOff];
        });
      } else if (data.event === 'updated') {
        logger.log('🔔 [WebSocket] Team days off updated event received:', data.teamDaysOff);
        setTeamDaysOff(prev => {
          const userUID = data.teamDaysOff.user_UID || data.teamDaysOff.userUID;
          return prev.map(t => 
            (t.user_UID || t.userUID) === userUID || t.id === data.teamDaysOff.id
              ? data.teamDaysOff 
              : t
          );
        });
      } else if (data.event === 'deleted') {
        logger.log('🔔 [WebSocket] Team days off deleted event received:', data.teamDaysOff);
        setTeamDaysOff(prev => prev.filter(t => t.id !== data.teamDaysOff.id));
      }
    };

    wsClient.on('team_days_off_change', handleTeamDaysOffChange);
    wsClient.subscribe(['team_days_off']);

    return () => {
      wsClient.off('team_days_off_change', handleTeamDaysOffChange);
    };
  }, []);

  const createTeamDaysOff = useCallback(async (teamDaysOffData, adminUserData) => {
    try {
      const result = await apiClient.post('/team-days-off', teamDaysOffData);
      logger.log('Team days off entry created successfully:', result.id);
      return { success: true, id: result.id };
    } catch (err) {
      logger.error('Error creating team days off entry:', err);
      throw err;
    }
  }, []);

  const updateTeamDaysOff = useCallback(async (entryId, updateData, adminUserData) => {
    try {
      const result = await apiClient.put(`/team-days-off/${entryId}`, updateData);
      logger.log('Team days off entry updated successfully:', entryId);
      return { success: true };
    } catch (err) {
      logger.error('Error updating team days off entry:', err);
      throw err;
    }
  }, []);

  const deleteTeamDaysOff = useCallback(async (entryId, _adminUserData) => {
    try {
      await apiClient.delete(`/team-days-off/${entryId}`);
      logger.log('Team days off entry deleted successfully:', entryId);
      return { success: true };
    } catch (err) {
      logger.error('Error deleting team days off entry:', err);
      throw err;
    }
  }, []);

  return {
    teamDaysOff,
    isLoading,
    error,
    createTeamDaysOff,
    updateTeamDaysOff,
    deleteTeamDaysOff
  };
};
