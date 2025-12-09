export const matchesUser = (task, userId) => {
  if (!userId) return false;
  // Convert both to strings for reliable comparison
  const taskUserUID = task.userUID ? String(task.userUID) : null;
  const taskCreatebyUID = task.createbyUID ? String(task.createbyUID) : null;
  const normalizedUserId = String(userId);
  return taskUserUID === normalizedUserId || taskCreatebyUID === normalizedUserId;
};

export const getTaskReporterId = (task) => {
  return task.data_task?.reporters || task.data_task?.reporterUID || task.reporters || task.reporterUID || null;
};

export const getTaskReporterName = (task) => {
  return task.data_task?.reporterName || task.reporterName || null;
};

export const matchesReporter = (task, reporterId) => {
  if (!reporterId) return false;
  const taskReporterId = getTaskReporterId(task);
  if (!taskReporterId) return false;
  // Convert both to strings for reliable comparison
  return String(taskReporterId) === String(reporterId);
};

export const matchesReporterName = (task, reporterName) => {
  if (!reporterName) return false;

  const taskReporterName = getTaskReporterName(task);
  if (taskReporterName && taskReporterName.toLowerCase() === reporterName.toLowerCase()) {
    return true;
  }

  const taskReporterId = getTaskReporterId(task);
  if (taskReporterId && String(taskReporterId).toLowerCase() === reporterName.toLowerCase()) {
    return true;
  }

  return false;
};

export const matchesUserName = (task, userName) => {
  if (!userName) return false;

  const userMatch = (
    task.createdByName === userName ||
    task.userName === userName ||
    (task.userUID && task.userUID.includes(userName)) ||
    (task.createbyUID && task.createbyUID.includes(userName)) ||
    (task.createdByName && task.createdByName.toLowerCase().includes(userName.toLowerCase())) ||
    (task.data_task?.createdByName && task.data_task.createdByName.toLowerCase().includes(userName.toLowerCase()))
  );

  return userMatch;
};

export const getTaskData = (task) => {
  return task.data_task || task;
};

export const filterTasksByUserAndReporter = (tasks, options = {}) => {
  const {
    selectedUserId = null,
    selectedReporterId = null,
    currentMonthId = null,
    isUserAdmin = false,
    currentUserUID = null,
  } = options;

  // Normalize empty strings to null for proper filtering
  const normalizedUserId = selectedUserId && selectedUserId.trim() !== "" ? selectedUserId : null;
  const normalizedReporterId = selectedReporterId && selectedReporterId.trim() !== "" ? selectedReporterId : null;

  if (!tasks || !Array.isArray(tasks)) {
    return [];
  }

  return tasks.filter((task) => {
    // Always filter by month first
    if (currentMonthId && task.monthId !== currentMonthId) {
      return false;
    }

    // Role-based filtering: Regular users can only see their own tasks
    if (!isUserAdmin) {
      // Check if this task belongs to the current user
      const isUserTask = currentUserUID && matchesUser(task, currentUserUID);
      if (!isUserTask) return false;

      // If reporter is selected, also filter by reporter
      if (normalizedReporterId) {
        return matchesReporter(task, normalizedReporterId);
      }

      // Regular users can ONLY see their own tasks
      return true;
    }

    // Admin filtering logic
    // If both user and reporter are selected, show tasks that match BOTH
    if (normalizedUserId && normalizedReporterId) {
      const matchesSelectedUser = matchesUser(task, normalizedUserId);
      const taskReporterId = getTaskReporterId(task);
      if (!taskReporterId) return false;
      // Compare task reporter ID directly with selectedReporterId (exact match)
      return matchesSelectedUser && String(taskReporterId) === String(normalizedReporterId);
    }

    // If only user is selected, show tasks for that user
    if (normalizedUserId && !normalizedReporterId) {
      return matchesUser(task, normalizedUserId);
    }

    // If only reporter is selected, show tasks for that reporter
    if (normalizedReporterId && !normalizedUserId) {
      const taskReporterId = getTaskReporterId(task);
      if (!taskReporterId) return false;
      // Compare task reporter ID directly with selectedReporterId (exact match)
      return String(taskReporterId) === String(normalizedReporterId);
    }

    // If neither user nor reporter is selected, admin sees all tasks
    return true;
  });
};

