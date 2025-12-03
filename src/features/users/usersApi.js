/**
 * Users API (REST API with WebSocket)
 *
 * @fileoverview REST API hooks for users with real-time updates via WebSocket
 * @author Senior Developer
 * @version 4.0.0
 */

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/apiClient";
import wsClient from "@/services/websocketClient";
import { logger } from "@/utils/logger";
// No cache - always fetch fresh data

// Global fetch lock to prevent concurrent fetches (handles StrictMode double renders)
const fetchLocks = new Map();

/**
 * Users Hook (One-time fetch - Users are relatively static data)
 */
export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      // Check if user is authenticated before making API calls
      const token = apiClient.getToken();
      if (!token) {
        setIsLoading(false);
        setUsers([]);
        setError(null);
        return;
      }

      try {
        const cacheKey = 'users_list';

        // Check if fetch is already in progress
        if (fetchLocks.has(cacheKey)) {
          logger.log('🔍 [useUsers] Fetch already in progress, waiting...');
          const existingPromise = fetchLocks.get(cacheKey);
          try {
            const result = await existingPromise;
            setUsers(result);
            setIsLoading(false);
            setError(null);
            return;
          } catch (err) {
            // Handle 401 gracefully
            if (err.isUnauthorized) {
              setUsers([]);
              setIsLoading(false);
              setError(null);
              return;
            }
            setError(err);
            setIsLoading(false);
            return;
          }
        }

        logger.log('🔍 [useUsers] Fetching users from API');
        setIsLoading(true);
        setError(null);

        // Create fetch promise and lock
        const fetchPromise = (async () => {
          try {
            const usersData = await apiClient.get('/users');
            return usersData;
          } finally {
            fetchLocks.delete(cacheKey);
          }
        })();

        fetchLocks.set(cacheKey, fetchPromise);
        const usersData = await fetchPromise;
        
        setUsers(usersData);
        setIsLoading(false);
        setError(null);
        logger.log('✅ [useUsers] Users fetched and cached:', usersData.length);
      } catch (err) {
        // Handle 401 gracefully - user not logged in yet
        if (err.isUnauthorized) {
          setUsers([]);
          setIsLoading(false);
          setError(null);
          return;
        }
        logger.error('❌ [useUsers] Fetch error:', err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchUsers();

    // Subscribe to WebSocket updates
    const handleUserChange = (data) => {
      if (data.event === 'created' || data.event === 'updated') {
        // Refetch users
        fetchUsers();
      } else if (data.event === 'deleted') {
        setUsers(prev => prev.filter(u => u.id !== data.user.id));
      }
    };

    wsClient.on('user_change', handleUserChange);
    wsClient.subscribe(['users']);

    return () => {
      wsClient.off('user_change', handleUserChange);
    };
  }, []); // Empty deps - only run once on mount

  // Create user
  const createUser = useCallback(async (userData, adminUserData) => {
    try {
      const newUser = await apiClient.post('/users', userData);
      
      logger.log('User created successfully:', newUser.id);
      return { success: true, id: newUser.id };
    } catch (err) {
      logger.error('Error creating user:', err);
      throw err;
    }
  }, []);

  // Update user
  const updateUser = useCallback(async (userId, updateData, adminUserData) => {
    try {
      const updatedUser = await apiClient.put(`/users/${userId}`, updateData);
      
      logger.log('User updated successfully:', userId);
      return { success: true };
    } catch (err) {
      logger.error('Error updating user:', err);
      throw err;
    }
  }, []);

  // Delete user
  const deleteUser = useCallback(async (userId, adminUserData) => {
    try {
      await apiClient.delete(`/users/${userId}`);
      
      logger.log('User deleted successfully:', userId);
      return { success: true };
    } catch (err) {
      logger.error('Error deleting user:', err);
      throw err;
    }
  }, []);

  return {
    // Data
    users,
    isLoading,
    error,

    // CRUD Operations
    createUser,
    updateUser,
    deleteUser
  };
};

/**
 * User by UID Hook (REST API with WebSocket)
 */
export const useUserByUID = (userUID) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userUID) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const userData = await apiClient.get(`/users/uid/${userUID}`);
        setUser(userData);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        logger.error('User by UID fetch error:', err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchUser();

    // Subscribe to WebSocket updates
    const handleUserChange = (data) => {
      if (data.user && data.user.userUID === userUID) {
        if (data.event === 'updated' || data.event === 'created') {
          fetchUser();
        } else if (data.event === 'deleted') {
          setUser(null);
        }
      }
    };

    wsClient.on('user_change', handleUserChange);
    wsClient.subscribe(['users']);

    return () => {
      wsClient.off('user_change', handleUserChange);
    };
  }, [userUID]);

  return { user, isLoading, error };
};

// Export hooks for backward compatibility
export const useGetUsersQuery = useUsers;
export const useGetUserByUIDQuery = useUserByUID;
export const useCreateUserMutation = () => {
  const { createUser } = useUsers();
  return [createUser];
};
export const useUpdateUserMutation = () => {
  const { updateUser } = useUsers();
  return [updateUser];
};
export const useDeleteUserMutation = () => {
  const { deleteUser } = useUsers();
  return [deleteUser];
};

/**
 * Fetch user by UID from API (direct function for AuthContext)
 * @param {string} userUID - User UID to fetch
 * @returns {Promise<Object|null>} - User data or null if not found
 */
export const fetchUserByUIDFromFirestore = async (userUID) => {
  try {
    if (!userUID) {
      logger.error('fetchUserByUIDFromFirestore: userUID is required');
      return null;
    }

    const userData = await apiClient.get(`/users/uid/${userUID}`);
    logger.log('fetchUserByUIDFromFirestore: User found:', userData.id);
    return userData;
  } catch (error) {
    logger.error('fetchUserByUIDFromFirestore: Error fetching user:', error);
    return null;
  }
};
