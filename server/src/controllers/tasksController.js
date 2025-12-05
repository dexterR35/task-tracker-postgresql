import pool from '../config/database.js';

// Helper to build data_task object from normalized columns and related tables
// This maintains backward compatibility with frontend expecting data_task structure
const buildTaskWithRelatedData = async (task) => {
  if (!task) return null;

  // Fetch related data
  const [marketsResult, departmentsResult, deliverablesResult, aiUsageResult] = await Promise.all([
    pool.query('SELECT market FROM task_markets WHERE task_id = $1 ORDER BY market', [task.id]),
    pool.query('SELECT department FROM task_departments WHERE task_id = $1 ORDER BY department', [task.id]),
    pool.query('SELECT deliverable_name, count, variations_enabled, variations_count FROM task_deliverables WHERE task_id = $1', [task.id]),
    pool.query('SELECT ai_models, ai_time FROM task_ai_usage WHERE task_id = $1 LIMIT 1', [task.id])
  ]);

  // Build data_task object from columns and related tables
  const dataTask = {
    taskName: task.task_name,
    products: task.products,
    timeInHours: task.time_in_hours,
    isVip: task.is_vip || false,
    reworked: task.reworked || false,
    useShutterstock: task.use_shutterstock || false,
    observations: task.observations || '',
    reporters: task.reporter_id || '',
    reporterUID: task.reporter_id || '',
    reporterName: task.reporter_name || '',
    startDate: task.start_date ? new Date(task.start_date).toISOString() : null,
    endDate: task.end_date ? new Date(task.end_date).toISOString() : null,
    departments: departmentsResult.rows.map(r => r.department),
    markets: marketsResult.rows.map(r => r.market),
    deliverablesUsed: deliverablesResult.rows.map(r => ({
      name: r.deliverable_name,
      count: r.count,
      variationsEnabled: r.variations_enabled,
      variationsCount: r.variations_count
    })),
    aiUsed: aiUsageResult.rows.length > 0 ? [{
      aiModels: aiUsageResult.rows[0].ai_models || [],
      aiTime: aiUsageResult.rows[0].ai_time || 0
    }] : []
  };

  // Format response to match Firebase structure
  return {
    id: task.id,
    boardId: task.board_id || task.boardId,
    createbyUID: task.created_by_id || task.user_id,
    createdAt: task.created_at ? new Date(task.created_at).toISOString() : task.createdAt,
    data_task: dataTask,
    monthId: task.month_id || task.monthId,
    updatedAt: task.updated_at ? new Date(task.updated_at).toISOString() : task.updatedAt,
    userUID: task.user_id
  };
};

// Helper to parse single task (always uses normalized columns)
const parseTask = async (task) => {
  if (!task) return task;
  
  // Build from normalized columns
  return await buildTaskWithRelatedData(task);
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

    // Build query with joins for filtering
    let query = `
      SELECT DISTINCT t.* 
      FROM tasks t
      LEFT JOIN task_markets tm ON t.id = tm.task_id
      LEFT JOIN task_departments td ON t.id = td.task_id
      LEFT JOIN task_deliverables tdel ON t.id = tdel.task_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Month filter
    if (monthId) {
      query += ` AND t.month_id = $${paramCount++}`;
      params.push(monthId);
    }

    // Role-based user filtering
    if (user.role === 'user') {
      query += ` AND t.user_id = $${paramCount++}`;
      params.push(user.id);
    } else if (user.role === 'admin' && userUID) {
      query += ` AND t.user_id = $${paramCount++}`;
      params.push(userUID);
    }

    // Date range filtering (using start_date/end_date columns)
    if (startDate) {
      query += ` AND (t.start_date >= $${paramCount} OR t.created_at >= $${paramCount})`;
      params.push(startDate);
      paramCount++;
    }
    if (endDate) {
      query += ` AND (t.end_date <= $${paramCount} OR t.created_at <= $${paramCount})`;
      params.push(endDate);
      paramCount++;
    }

    // Reporter filter (using column)
    if (reporterUID) {
      query += ` AND t.reporter_id = $${paramCount++}`;
      params.push(reporterUID);
    }

    // Department filter (using junction table)
    if (department) {
      query += ` AND (td.department = $${paramCount} OR t.department = $${paramCount})`;
      params.push(department);
      paramCount++;
    }

    // Boolean filters (using columns)
    if (isVip !== undefined) {
      const isVipBool = isVip === 'true' || isVip === true;
      query += ` AND t.is_vip = $${paramCount++}`;
      params.push(isVipBool);
    }

    if (reworked !== undefined) {
      const reworkedBool = reworked === 'true' || reworked === true;
      query += ` AND t.reworked = $${paramCount++}`;
      params.push(reworkedBool);
    }

    // Deliverables filter (using junction table)
    if (hasDeliverables !== undefined) {
      const hasDeliverablesBool = hasDeliverables === 'true' || hasDeliverables === true;
      if (hasDeliverablesBool) {
        query += ` AND tdel.id IS NOT NULL`;
      } else {
        query += ` AND tdel.id IS NULL`;
      }
    }

    if (deliverableName) {
      query += ` AND tdel.deliverable_name = $${paramCount++}`;
      params.push(deliverableName);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    
    // Build tasks with related data
    const tasks = await Promise.all(result.rows.map(task => buildTaskWithRelatedData(task)));

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

    const task = await parseTask(result.rows[0]);
    const user = req.user;

    // Check permissions
    if (user.role === 'user' && result.rows[0].user_id !== user.id) {
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

    // Get user ID from userUID if provided, otherwise use current user's ID
    let taskUserId = user.id;
    if (userUID) {
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userUID]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      taskUserId = userCheck.rows[0].id;
    }

    const taskData = typeof dataTask === 'object' ? dataTask : JSON.parse(dataTask);
    const finalBoardId = boardId || `board_${monthId}_${Date.now()}`;

    // Get reporter ID if reporterUID is provided
    let reporterId = null;
    if (taskData.reporterUID || taskData.reporters) {
      const reporterCheck = await pool.query('SELECT id FROM reporters WHERE id = $1', [taskData.reporterUID || taskData.reporters]);
      if (reporterCheck.rows.length > 0) {
        reporterId = reporterCheck.rows[0].id;
      }
    }

    // Insert main task record
    const result = await pool.query(
      `INSERT INTO tasks (
        month_id, user_id, board_id, 
        task_name, products, time_in_hours, department,
        start_date, end_date, observations,
        is_vip, reworked, use_shutterstock,
        reporter_id, reporter_name,
        created_by_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        monthId,
        taskUserId,
        finalBoardId,
        taskData.taskName || null,
        taskData.products || null,
        taskData.timeInHours || 0,
        Array.isArray(taskData.departments) ? taskData.departments[0] : (taskData.departments || null),
        taskData.startDate ? new Date(taskData.startDate).toISOString().split('T')[0] : null,
        taskData.endDate ? new Date(taskData.endDate).toISOString().split('T')[0] : null,
        taskData.observations || null,
        taskData.isVip || false,
        taskData.reworked || false,
        taskData.useShutterstock || false,
        reporterId,
        taskData.reporterName || null,
        user.id || taskUserId
      ]
    );

    const newTask = result.rows[0];

    // Insert related data
    // Markets
    if (taskData.markets && Array.isArray(taskData.markets)) {
      for (const market of taskData.markets) {
        await pool.query(
          'INSERT INTO task_markets (task_id, market) VALUES ($1, $2) ON CONFLICT (task_id, market) DO NOTHING',
          [newTask.id, market]
        );
      }
    }

    // Departments (beyond the first one stored in main column)
    if (taskData.departments && Array.isArray(taskData.departments)) {
      for (const dept of taskData.departments) {
        await pool.query(
          'INSERT INTO task_departments (task_id, department) VALUES ($1, $2) ON CONFLICT (task_id, department) DO NOTHING',
          [newTask.id, dept]
        );
      }
    }

    // Deliverables
    if (taskData.deliverablesUsed && Array.isArray(taskData.deliverablesUsed)) {
      for (const deliverable of taskData.deliverablesUsed) {
        await pool.query(
          'INSERT INTO task_deliverables (task_id, deliverable_name, count, variations_enabled, variations_count) VALUES ($1, $2, $3, $4, $5)',
          [
            newTask.id,
            deliverable.name,
            deliverable.count || 1,
            deliverable.variationsEnabled || false,
            deliverable.variationsCount || 0
          ]
        );
      }
    }

    // AI Usage
    if (taskData.aiUsed && Array.isArray(taskData.aiUsed) && taskData.aiUsed.length > 0) {
      const aiData = taskData.aiUsed[0];
      await pool.query(
        'INSERT INTO task_ai_usage (task_id, ai_models, ai_time) VALUES ($1, $2, $3)',
        [
          newTask.id,
          aiData.aiModels || [],
          aiData.aiTime || 0
        ]
      );
    }

    const formattedTask = await buildTaskWithRelatedData(newTask);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyTaskChange('created', formattedTask, monthId, taskUserId);
    }

    res.status(201).json(formattedTask);
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

    // Update main task columns if dataTask provided
    if (dataTask) {
      const taskData = typeof dataTask === 'object' ? dataTask : JSON.parse(dataTask);

      if (taskData.taskName !== undefined) {
        updates.push(`task_name = $${paramCount++}`);
        params.push(taskData.taskName);
      }
      if (taskData.products !== undefined) {
        updates.push(`products = $${paramCount++}`);
        params.push(taskData.products);
      }
      if (taskData.timeInHours !== undefined) {
        updates.push(`time_in_hours = $${paramCount++}`);
        params.push(taskData.timeInHours);
      }
      if (taskData.department !== undefined || (taskData.departments && taskData.departments[0])) {
        updates.push(`department = $${paramCount++}`);
        params.push(Array.isArray(taskData.departments) ? taskData.departments[0] : taskData.department);
      }
      if (taskData.startDate !== undefined) {
        updates.push(`start_date = $${paramCount++}`);
        params.push(taskData.startDate ? new Date(taskData.startDate).toISOString().split('T')[0] : null);
      }
      if (taskData.endDate !== undefined) {
        updates.push(`end_date = $${paramCount++}`);
        params.push(taskData.endDate ? new Date(taskData.endDate).toISOString().split('T')[0] : null);
      }
      if (taskData.observations !== undefined) {
        updates.push(`observations = $${paramCount++}`);
        params.push(taskData.observations);
      }
      if (taskData.isVip !== undefined) {
        updates.push(`is_vip = $${paramCount++}`);
        params.push(taskData.isVip);
      }
      if (taskData.reworked !== undefined) {
        updates.push(`reworked = $${paramCount++}`);
        params.push(taskData.reworked);
      }
      if (taskData.useShutterstock !== undefined) {
        updates.push(`use_shutterstock = $${paramCount++}`);
        params.push(taskData.useShutterstock);
      }
      if (taskData.reporterUID !== undefined || taskData.reporters !== undefined) {
        // Get reporter ID if reporterUID is provided
        let reporterId = null;
        const reporterUID = taskData.reporterUID || taskData.reporters;
        if (reporterUID) {
          const reporterCheck = await pool.query('SELECT id FROM reporters WHERE id = $1', [reporterUID]);
          if (reporterCheck.rows.length > 0) {
            reporterId = reporterCheck.rows[0].id;
          }
        }
        updates.push(`reporter_id = $${paramCount++}`);
        params.push(reporterId);
      }
      if (taskData.reporterName !== undefined) {
        updates.push(`reporter_name = $${paramCount++}`);
        params.push(taskData.reporterName);
      }
    }

    if (monthId) {
      updates.push(`month_id = $${paramCount++}`);
      params.push(monthId);
    }
    if (userUID) {
      // Verify user exists
      const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userUID]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      updates.push(`user_id = $${paramCount++}`);
      params.push(userUID);
    }
    if (boardId !== undefined) {
      updates.push(`board_id = $${paramCount++}`);
      params.push(boardId);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update updated_by_id
    updates.push(`updated_by_id = $${paramCount++}`);
    params.push(user.id || null);

    params.push(id);

    const query = `
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);
    const updatedTask = result.rows[0];

    // Update related tables if dataTask provided
    if (dataTask) {
      const taskData = typeof dataTask === 'object' ? dataTask : JSON.parse(dataTask);

      // Update markets
      if (taskData.markets !== undefined) {
        await pool.query('DELETE FROM task_markets WHERE task_id = $1', [id]);
        if (Array.isArray(taskData.markets)) {
          for (const market of taskData.markets) {
            await pool.query('INSERT INTO task_markets (task_id, market) VALUES ($1, $2)', [id, market]);
          }
        }
      }

      // Update departments
      if (taskData.departments !== undefined) {
        await pool.query('DELETE FROM task_departments WHERE task_id = $1', [id]);
        if (Array.isArray(taskData.departments)) {
          for (const dept of taskData.departments) {
            await pool.query('INSERT INTO task_departments (task_id, department) VALUES ($1, $2)', [id, dept]);
          }
        }
      }

      // Update deliverables
      if (taskData.deliverablesUsed !== undefined) {
        await pool.query('DELETE FROM task_deliverables WHERE task_id = $1', [id]);
        if (Array.isArray(taskData.deliverablesUsed)) {
          for (const deliverable of taskData.deliverablesUsed) {
            await pool.query(
              'INSERT INTO task_deliverables (task_id, deliverable_name, count, variations_enabled, variations_count) VALUES ($1, $2, $3, $4, $5)',
              [id, deliverable.name, deliverable.count || 1, deliverable.variationsEnabled || false, deliverable.variationsCount || 0]
            );
          }
        }
      }

      // Update AI usage
      if (taskData.aiUsed !== undefined) {
        await pool.query('DELETE FROM task_ai_usage WHERE task_id = $1', [id]);
        if (Array.isArray(taskData.aiUsed) && taskData.aiUsed.length > 0) {
          const aiData = taskData.aiUsed[0];
          await pool.query(
            'INSERT INTO task_ai_usage (task_id, ai_models, ai_time) VALUES ($1, $2, $3)',
            [id, aiData.aiModels || [], aiData.aiTime || 0]
          );
        }
      }
    }

    const formattedTask = await buildTaskWithRelatedData(updatedTask);
    
    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyTaskChange('updated', formattedTask, formattedTask.monthId || updatedTask.month_id, formattedTask.userUID);
    }
    
    res.json(formattedTask);
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Check if task exists
    const taskCheck = await pool.query('SELECT user_id, month_id FROM tasks WHERE id = $1', [id]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // Check permissions
    if (user.role === 'user' && task.user_id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete task (cascade will delete related records)
    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    
    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyTaskChange('deleted', { id }, task.month_id, task.user_id);
    }
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};
