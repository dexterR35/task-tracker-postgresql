/**
 * Authentication Context
 * 
 * @fileoverview Context-based authentication state management with JWT
 * @author Senior Developer
 * @version 2.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '@/services/apiClient';
import wsClient from '@/services/websocketClient';
import { logger } from "@/utils/logger";
import { AUTH } from '@/constants';
// No cache - always fetch fresh data
import {
  isUserComplete,
  canAccessRole,
  canAccessTasks,
  canAccessCharts,
  hasPermission,
  canCreateTask,
  canUpdateTask,
  canDeleteTask,
  canViewTasks,
  canCreateBoard,
  canSubmitForms,
  canPerformTaskCRUD,
  hasAdminPermissions,
  getUserPermissionSummary
} from '@/features/utils/authUtils';
import {
  showLogoutSuccess,
  showAuthError,
  showSuccess,
} from '@/utils/toast';

const VALID_ROLES = AUTH.VALID_ROLES;

// Create Auth Context
const AuthContext = createContext();

// Auth Context Provider
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsAuthChecking(true);
        setIsLoading(true);

        const token = apiClient.getToken();
        if (!token) {
          setIsLoading(false);
          setIsAuthChecking(false);
          return;
        }

        // Verify token and get user data
        const response = await apiClient.get('/auth/verify');
        if (response.user) {
          setUser(response.user);
          // Connect WebSocket
          wsClient.setToken(token);
          wsClient.connect();
        } else {
          // Invalid token, clear it
          apiClient.setToken(null);
        }
      } catch (error) {
        logger.error("Error initializing auth:", error);
        apiClient.setToken(null);
        wsClient.disconnect();
      } finally {
        setIsLoading(false);
        setIsAuthChecking(false);
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = useCallback(async (credentials) => {
    try {
      setIsLoading(true);
      setError(null);

      const { email, password } = credentials;
      
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const response = await apiClient.post('/auth/login', { email, password });
      
      if (!response.token || !response.user) {
        throw new Error("Login failed - invalid response");
      }

      // Set token and user
      apiClient.setToken(response.token);
      setUser(response.user);

      // Connect WebSocket
      wsClient.setToken(response.token);
      wsClient.connect();

      setIsLoading(false);

      // Show welcome message
      if (response.user) {
        const welcomeMessage = `Welcome, ${response.user.name || response.user.email}! 👋`;
        showSuccess(welcomeMessage, { 
          autoClose: 3000,
          position: "top-center"
        });
      }

      return { user: response.user };
    } catch (error) {
      logger.error("Login error:", error);
      // Handle rate limiting with a better message
      if (error.isRateLimited) {
        const message = error.message || 'Too many login attempts. Please wait 15 minutes and try again.';
        setError(message);
        setIsLoading(false);
        showAuthError(message);
        throw error;
      }
      setError(error.message || "Login failed");
      setIsLoading(false);
      showAuthError(error?.message || error || 'Login failed');
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Disconnect WebSocket
      wsClient.disconnect();
      
      // Clear token and user
      apiClient.setToken(null);
      setUser(null);
      setIsLoading(false);

      // Clear the session-based user logging flag
      if (window._loggedUser) {
        delete window._loggedUser;
      }

      showLogoutSuccess();
    } catch (error) {
      logger.error("Logout error:", error);
      setError(error.message || "Logout failed");
      setIsLoading(false);
      showAuthError(error?.message || error || 'Logout failed');
    }
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Permission functions (memoized for performance)
  const permissionFunctions = {
    canAccess: (requiredRole) => {
      if (requiredRole === 'authenticated') {
        return !!user;
      }
      return canAccessRole(user, requiredRole);
    },
    
    hasPermission: (permission) => hasPermission(user, permission),
    canGenerate: () => canAccessCharts(user),
    canAccessTasks: () => canAccessTasks(user),
    canCreateTask: () => canCreateTask(user),
    canUpdateTask: () => canUpdateTask(user),
    canDeleteTask: () => canDeleteTask(user),
    canViewTasks: () => canViewTasks(user),
    canCreateBoard: () => canCreateBoard(user),
    canSubmitForms: () => canSubmitForms(user),
    canPerformTaskCRUD: () => canPerformTaskCRUD(user),
    hasAdminPermissions: () => hasAdminPermissions(user),
    getUserPermissionSummary: () => getUserPermissionSummary(user)
  };

  // Simplified auth status check
  const isReady = () => {
    return !isAuthChecking && !isLoading;
  };

  const value = {
    // Core state
    user,
    isLoading,
    isAuthChecking,
    error,
    
    // Permission functions
    ...permissionFunctions,
    
    // Auth actions
    login,
    logout,
    clearError,
    
    // Utility
    isReady,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
