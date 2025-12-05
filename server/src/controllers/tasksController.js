import pool from '../config/database.js';

// Helper to parse JSONB fields and normalize field names to match Firebase EXACTLY
const parseTask = (task) => {
  if (!task) return task;
  
  // Parse data_task if it's a string, otherwise use the object or empty object
  const dataTask = typeof task.data_task === 'string' 
    ? JSON.parse(task.data_task) 
    : (task.data_task || {});
  
  // Format response to match old Firebase structure EXACTLY
  return {
    id: task.id, // Keep id for API operations
    boardId: task.board_id || task.boardId,
    createbyUID: task.created_by_UID || task["user_UID"] || task.userUID, // Note: Firebase uses "createbyUID" not "createdByUID"
    createdAt: task.created_at ? new Date(task.created_at).toISOString() : task.createdAt,
    data_task: dataTask,
    monthId: task.month_id || task.monthId,
    updatedAt: task.updated_at ? new Date(task.updated_at).toISOString() : task.updatedAt,
    userUID: task["user_UID"] || task.userUID
  };
};

export const getTasks = async (req, res, next) => {
  try {
    const { 
      monthId, 
      userUID, 
      reporterUID, 
      department, 
      startDate, 
      endDate,
      isVip,
      reworked,
      hasDeliverables,
      deliverableName
    } = req.query;
    const user = req.user;

    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Month filter
    if (monthId) {
      query += ` AND month_id = $${paramCount++}`;
      params.push(monthId);
    }

    // Role-based user filtering
    if (user.role === 'user') {
      // Regular users can only see their own tasks
      query += ` AND "user_UID" = $${paramCount++}`;
      params.push(user.userUID);
    } else if (user.role === 'admin' && userUID) {
      // Admin can filter by specific user
      query += ` AND "user_UID" = $${paramCount++}`;
      params.push(userUID);
    }
    // If admin and no userUID specified, show all tasks (no filter)

    // Date range filtering
    if (startDate) {
      query += ` AND created_at >= $${paramCount++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND created_at <= $${paramCount++}`;
      params.push(endDate);
    }

    // JSONB field filtering - use PostgreSQL JSONB queries for better performance
    // This matches Firebase path structure: /departments/design/2025/2025-12/taskdata/
    if (reporterUID) {
      query += ` AND (
        data_task->>'reporterUID' = $${paramCount} OR 
        data_task->>'reporters' = $${paramCount}
      )`;
      params.push(reporterUID);
      paramCount++;
    }

    if (department) {
      // Filter by department using JSONB query (matches Firebase path: /departments/design/2025/2025-12/taskdata/)
      // Departments can be an array or a single string in data_task
      query += ` AND (
        data_task->'departments' @> $${paramCount}::jsonb OR
        data_task->>'departments' = $${paramCount} OR
        EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(data_task->'departments') AS dept
          WHERE dept = $${paramCount}
        )
      )`;
      params.push(department);
      paramCount++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    let tasks = result.rows.map(parseTask);

    if (isVip !== undefined) {
      const isVipBool = isVip === 'true' || isVip === true;
      tasks = tasks.filter(task => {
        const dataTask = task.data_task || {};
        return dataTask.isVip === isVipBool;
      });
    }

    if (reworked !== undefined) {
      const reworkedBool = reworked === 'true' || reworked === true;
      tasks = tasks.filter(task => {
        const dataTask = task.data_task || {};
        return dataTask.reworked === reworkedBool;
      });
    }

    if (hasDeliverables !== undefined) {
      const hasDeliverablesBool = hasDeliverables === 'true' || hasDeliverables === true;
      tasks = tasks.filter(task => {
        const dataTask = task.data_task || {};
        const deliverables = dataTask.deliverablesUsed || [];
        return hasDeliverablesBool ? deliverables.length > 0 : deliverables.length === 0;
      });
    }

    if (deliverableName) {
      tasks = tasks.filter(task => {
        const dataTask = task.data_task || {};
        const deliverables = dataTask.deliverablesUsed || [];
        return deliverables.some(d => d.name === deliverableName);
      });
    }

    res.json(tasks);
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = parseTask(result.rows[0]);
    const user = req.user;

    // Check permissions
    if (user.role === 'user' && task["user_UID"] !== user.userUID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req, res, next) => {
  try {
    const { monthId, userUID, boardId, dataTask } = req.body;
    const user = req.user;

    if (!monthId || !dataTask) {
      return res.status(400).json({ error: 'monthId and dataTask are required' });
    }

    // Verify month exists
    const monthCheck = await pool.query('SELECT month_id FROM months WHERE month_id = $1', [monthId]);
    if (monthCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Month board not found' });
    }

    const taskUserUID = userUID || user.userUID;

    // Ensure dataTask is an object
    const taskData = typeof dataTask === 'object' ? dataTask : JSON.parse(dataTask);

    // Generate boardId if not provided (match old Firebase format: board_YYYY-MM_timestamp)
    const finalBoardId = boardId || `board_${monthId}_${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO tasks (month_id, "user_UID", board_id, data_task, created_by_UID)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        monthId,
        taskUserUID,
        finalBoardId,
        JSON.stringify(taskData),
        user.userUID || taskUserUID
      ]
    );

    const newTask = parseTask(result.rows[0]);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyTaskChange('created', newTask, monthId, taskUserUID);
    }

    res.status(201).json(newTask);
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { dataTask, monthId, userUID, boardId } = req.body;
    const user = req.user;

    // Check if task exists
    const taskCheck = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // Check permissions
    if (user.role === 'user' && task["user_UID"] !== user.userUID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (dataTask) {
      const taskData = typeof dataTask === 'object' ? dataTask : JSON.parse(dataTask);
      updates.push(`data_task = $${paramCount++}`);
      params.push(JSON.stringify(taskData));
    }
    if (monthId) {
      updates.push(`month_id = $${paramCount++}`);
      params.push(monthId);
    }
    if (userUID) {
      updates.push(`"user_UID" = $${paramCount++}`);
      params.push(userUID);
    }
    if (boardId !== undefined) {
      updates.push(`board_id = $${paramCount++}`);
      params.push(boardId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update updated_by_UID
    updates.push(`"updated_by_UID" = $${paramCount++}`);
    params.push(user.userUID || '');

    params.push(id);

    const query = `
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);
    const updatedTask = parseTask(result.rows[0]);
    
    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyTaskChange('updated', updatedTask, updatedTask.monthId || updatedTask.month_id, updatedTask.userUID);
    }
    
    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Check if task exists
    const taskCheck = await pool.query('SELECT "user_UID", month_id FROM tasks WHERE id = $1', [id]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // Check permissions
    if (user.role === 'user' && task["user_UID"] !== user.userUID) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    
    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyTaskChange('deleted', { id }, task.month_id, task["user_UID"]);
    }
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};
