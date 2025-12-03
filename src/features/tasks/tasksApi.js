/**
 * Tasks API (REST API with WebSocket)
 *
 * @fileoverview REST API hooks for tasks with real-time updates via WebSocket
 * @author Senior Developer
 * @version 4.0.0
 */

import { useState, useEffect, useCallback } from "react";
import apiClient from "@/services/apiClient";
import wsClient from "@/services/websocketClient";
import { logger } from "@/utils/logger";
import { validateTaskPermissions } from '@/utils/permissionValidation';
import { getUserUID } from '@/features/utils/authUtils';

/**
 * Helper function to handle reporter name resolution with security validation
 */
const resolveReporterName = (reporters, reporterId, reporterName) => {
  if (!reporters || !Array.isArray(reporters)) {
    throw new Error("Invalid reporters data provided");
  }

  if (!reporterId || typeof reporterId !== 'string') {
    return reporterName;
  }

  const sanitizedReporterId = reporterId.trim();
  if (sanitizedReporterId.length === 0 || sanitizedReporterId.length > 100) {
    throw new Error("Invalid reporter ID format");
  }

  if (reporterId && !reporterName) {
    const selectedReporter = reporters.find(r => {
      if (!r || typeof r !== 'object') return false;
      const reporterIdField = r.reporterUID || r.id;
      return reporterIdField &&
             typeof reporterIdField === 'string' &&
             reporterIdField === sanitizedReporterId;
    });

    if (selectedReporter) {
      const name = selectedReporter.name || selectedReporter.reporterName;
      if (name && typeof name === 'string' && name.trim().length > 0) {
        return name.trim().substring(0, 100);
      }
    }

    throw new Error("Reporter not found for the selected ID");
  }

  return reporterName;
};

// No cache - always fetch fresh data for real-time updates

/**
 * Tasks Hook (REST API with WebSocket real-time updates)
 */
export const useTasks = (monthId, role = 'user', userUID = null) => {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check if user is authenticated before making API calls
    const token = apiClient.getToken();
    if (!token) {
      setTasks([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Always fetch fresh data - no cache
    setIsLoading(true);

    const fetchTasks = async () => {
      try {
        setError(null);
        const params = {};
        if (monthId) {
          params.monthId = monthId;
        }
        if (userUID) {
          params.userUID = userUID;
        }

        const tasksData = await apiClient.get('/tasks', params);
        
        // Parse data_task if it's a string and normalize field names
        const parsedTasks = tasksData.map(task => {
          // Ensure data_task exists and is properly parsed
          let dataTask = task.data_task;
          if (typeof dataTask === 'string') {
            try {
              dataTask = JSON.parse(dataTask);
            } catch (e) {
              logger.error('Error parsing data_task:', e);
              dataTask = {};
            }
          } else if (!dataTask) {
            dataTask = {};
          }
          
          return {
            ...task,
            monthId: task.month_id || task.monthId, // Normalize month_id to monthId
            userUID: task.userUID, // Use userUID from backend
            createbyUID: task.createbyUID || task.userUID, // Use createbyUID from backend
            createdByName: task.created_by_name || task.createdByName, // Normalize created_by_name
            data_task: dataTask
          };
        });

        // Update state
        setTasks(parsedTasks);
        setIsLoading(false);
        setError(null);
        logger.log('✅ [useTasks] Tasks fetched:', parsedTasks.length, 'tasks:', parsedTasks.map(t => ({ id: t.id, monthId: t.monthId, userUID: t.userUID })));
      } catch (err) {
        // Handle 401 gracefully - user not logged in yet
        if (err.isUnauthorized) {
          setTasks([]);
          setIsLoading(false);
          setError(null);
          return;
        }
        logger.error('❌ [useTasks] Fetch error:', err);
        setError(err);
        setIsLoading(false);
      }
    };

    fetchTasks();

    // Subscribe to WebSocket updates
    const handleTaskChange = (data) => {
      logger.log('🔔 [WebSocket] Task change event received:', { event: data.event, monthId: data.monthId, taskMonthId: data.task?.monthId, userUID: data.userUID });
      
      // Only process if it's for this month (or all if no monthId) and user
      const taskMonthId = data.monthId || data.task?.monthId || data.task?.month_id;
      if (!monthId || taskMonthId === monthId) {
        // For regular users, only show their own tasks
        if (role === 'user' && data.userUID !== userUID && data.task?.userUID !== userUID) {
          logger.log('⏭️ [WebSocket] Skipping task - not for this user');
          return; // Skip if not for this user
        }
        // For admins viewing a specific user, filter by that user
        if (role === 'admin' && userUID && data.userUID !== userUID && data.task?.userUID !== userUID) {
          logger.log('⏭️ [WebSocket] Skipping task - admin viewing specific user');
          return; // Skip if admin viewing specific user
        }

        if (data.event === 'created' || data.event === 'updated') {
          logger.log('✅ [WebSocket] Processing task', data.event, 'event');
          // Ensure data_task exists and is properly parsed
          let dataTask = data.task.data_task;
          if (typeof dataTask === 'string') {
            try {
              dataTask = JSON.parse(dataTask);
            } catch (e) {
              logger.error('Error parsing data_task in WebSocket:', e);
              dataTask = {};
            }
          } else if (!dataTask) {
            dataTask = {};
          }
          
          const task = {
            ...data.task,
            monthId: data.task.month_id || data.task.monthId, // Normalize month_id to monthId
            userUID: data.task.userUID, // Use userUID from backend
            createbyUID: data.task.createbyUID || data.task.userUID, // Use createbyUID from backend
            createdByName: data.task.created_by_name || data.task.createdByName, // Normalize created_by_name
            data_task: dataTask
          };

          setTasks(prev => {
            if (data.event === 'created') {
              const updated = [...prev, task];
              logger.log('✅ [WebSocket] Task added, new count:', updated.length);
              return updated;
            } else {
              const updated = prev.map(t => t.id === task.id ? task : t);
              logger.log('✅ [WebSocket] Task updated, count:', updated.length);
              return updated;
            }
          });
        } else if (data.event === 'deleted') {
          setTasks(prev => {
            const updated = prev.filter(t => t.id !== data.task.id);
            logger.log('✅ [WebSocket] Task deleted, new count:', updated.length);
            return updated;
          });
        }
      }
    };

    wsClient.on('task_change', handleTaskChange);
    // Subscribe to tasks - if monthId provided, subscribe to specific month, otherwise subscribe to all
    if (monthId) {
      wsClient.subscribe([`month:${monthId}`, 'tasks']);
    } else {
      wsClient.subscribe(['tasks']);
    }

    return () => {
      wsClient.off('task_change', handleTaskChange);
    };
  }, [monthId, role, userUID]); // Dependencies to prevent unnecessary re-renders

  return { tasks, isLoading, error };
};

const checkForDuplicateTask = async (tasks, task, userUID) => {
  try {
    if (!task.gimodear || !task.name) {
      return { isDuplicate: false, message: '' };
    }

    const duplicate = tasks.find(t => {
      const dataTask = t.data_task || t;
      return t.userUID === userUID &&
             dataTask.gimodear === task.gimodear &&
             dataTask.name === task.name;
    });

    if (duplicate) {
      return {
        isDuplicate: true,
        message: `A task with gimodear "${task.gimodear}" and name "${task.name}" already exists`
      };
    }

    return { isDuplicate: false, message: '' };
  } catch (error) {
    logger.error('Error checking for duplicate task:', error);
    return { isDuplicate: false, message: '' };
  }
};

/**
 * Create Task Hook
 */
export const useCreateTask = () => {
  const createTask = useCallback(async (task, userData, reporters = []) => {
    try {
      const permissionValidation = validateTaskPermissions(userData, 'create_tasks');
      if (!permissionValidation.isValid) {
        throw new Error(permissionValidation.errors.join(', '));
      }

      const monthId = task.monthId;
      if (!monthId) {
        throw new Error("Month ID is required");
      }

      // Verify month exists
      try {
        await apiClient.get(`/months/${monthId}`);
      } catch (err) {
        throw new Error(
          "Month board not available. Please contact an administrator to generate the month board for this period, or try selecting a different month."
        );
      }

      const currentUserUID = getUserUID(userData);
      const currentUserName = userData?.name || userData?.displayName || userData?.email || '';

      // Get existing tasks to check for duplicates
      const existingTasks = await apiClient.get('/tasks', { monthId, userUID: currentUserUID });
      const duplicateCheck = await checkForDuplicateTask(existingTasks, task, currentUserUID);
      if (duplicateCheck.isDuplicate) {
        throw new Error(`Duplicate task found: ${duplicateCheck.message}`);
      }

      // Auto-add reporter name if we have reporter ID but no name
      if (task.reporters && !task.reporterName) {
        task.reporterName = resolveReporterName(reporters, task.reporters, task.reporterName);
      }

      // Set reporterUID to match reporters ID for analytics consistency
      if (task.reporters && !task.reporterUID) {
        task.reporterUID = task.reporters;
      }

      const taskData = {
        monthId,
        userUID: currentUserUID,
        dataTask: task,
        boardId: monthId, // Can be updated if needed
      };

      const result = await apiClient.post('/tasks', taskData);

      logger.log('Task created successfully:', result.id);
      return { 
        success: true, 
        data: {
          ...result,
          monthId: result.month_id || result.monthId, // Normalize month_id to monthId
          userUID: result.userUID, // Use userUID from backend
          createbyUID: result.createbyUID || result.created_by_UID || result.userUID, // Use createbyUID from backend
          createdByName: result.created_by_name || result.createdByName, // Normalize created_by_name
          data_task: typeof result.data_task === 'string' 
            ? JSON.parse(result.data_task) 
            : result.data_task
        }
      };
    } catch (err) {
      logger.error('Error creating task:', err);
      throw err;
    }
  }, []);

  return [createTask];
};

/**
 * Update Task Hook
 */
export const useUpdateTask = () => {
  const updateTask = useCallback(async (monthId, taskId, updates, reporters = [], userData) => {
    try {
      const permissionValidation = validateTaskPermissions(userData, 'update_tasks');
      if (!permissionValidation.isValid) {
        throw new Error(permissionValidation.errors.join(', '));
      }

      // Fetch current task
      const currentTask = await apiClient.get(`/tasks/${taskId}`);
      if (!currentTask) {
        throw new Error("Task not found");
      }

      // Auto-add reporter name if we have reporter ID but no name
      if (updates.reporters && !updates.reporterName) {
        updates.reporterName = resolveReporterName(reporters, updates.reporters, updates.reporterName);
      }

      // Set reporterUID to match reporters ID for analytics consistency
      if (updates.reporters && !updates.reporterUID) {
        updates.reporterUID = updates.reporters;
      }

      const updateData = {
        dataTask: updates
      };

      const result = await apiClient.put(`/tasks/${taskId}`, updateData);

      logger.log('Task updated successfully:', taskId);
      return { 
        success: true, 
        data: {
          ...result,
          monthId: result.month_id || result.monthId, // Normalize month_id to monthId
          userUID: result.userUID, // Use userUID from backend
          createbyUID: result.createbyUID || result.created_by_UID || result.userUID, // Use createbyUID from backend
          createdByName: result.created_by_name || result.createdByName, // Normalize created_by_name
          data_task: typeof result.data_task === 'string' 
            ? JSON.parse(result.data_task) 
            : result.data_task
        }
      };
    } catch (err) {
      logger.error('Error updating task:', err);
      throw err;
    }
  }, []);

  return [updateTask];
};

/**
 * Delete Task Hook
 */
export const useDeleteTask = () => {
  const deleteTask = useCallback(async (monthId, taskId, userData) => {
    try {
      const permissionValidation = validateTaskPermissions(userData, 'delete_tasks');
      if (!permissionValidation.isValid) {
        throw new Error(permissionValidation.errors.join(', '));
      }

      await apiClient.delete(`/tasks/${taskId}`);

      logger.log('Task deleted successfully:', taskId);
      return { success: true, data: { id: taskId, monthId } };
    } catch (err) {
      logger.error('Error deleting task:', err);
      throw err;
    }
  }, []);

  return [deleteTask];
};

// Export hooks for backward compatibility
export const useGetMonthTasksQuery = useTasks;
export const useCreateTaskMutation = useCreateTask;
export const useUpdateTaskMutation = useUpdateTask;
export const useDeleteTaskMutation = useDeleteTask;
