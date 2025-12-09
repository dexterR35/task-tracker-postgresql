import pool from '../config/database.js';

// Helper to build metadata object from columns and format response
const parseMonth = (month) => {
  if (!month) return month;
  
  // Build metadata object from columns (for backward compatibility)
  const metadata = {
    monthName: month.month_name || null,
    startDate: month.start_date ? new Date(month.start_date).toISOString() : null,
    endDate: month.end_date ? new Date(month.end_date).toISOString() : null,
    daysInMonth: month.days_in_month || null,
    boardId: month.board_id || null,
    month: month.month || null,
    year: month.year || null
  };
  
  // Format response to match structure
  return {
    id: month.id,
    month_id: month.month_id,
    monthId: month.month_id, // For backward compatibility
    year_id: month.year_id,
    yearId: month.year_id, // For backward compatibility
    department_id: month.department_id, // From years join
    department_name: month.department_name, // From joins
    is_active: month.is_active,
    created_at: month.created_at,
    updated_at: month.updated_at,
    created_by_id: month.created_by_id,
    updated_by_id: month.updated_by_id,
    metadata,
    // Extract metadata fields to top level for frontend compatibility
    monthName: month.month_name || null,
    startDate: month.start_date ? new Date(month.start_date).toISOString() : null,
    endDate: month.end_date ? new Date(month.end_date).toISOString() : null,
    daysInMonth: month.days_in_month || null,
    boardId: month.board_id || null,
    month: month.month || null,
    year: month.year || null
  };
};

export const getMonths = async (req, res, next) => {
  try {
    const { year_id, is_active, department_id, year, month } = req.query;
    
    let query = `
      SELECT m.*, y.department_id, y.year as year_number,
             d.name as department_name, d.display_name as department_display_name
      FROM months m
      JOIN years y ON m.year_id = y.id
      JOIN departments d ON y.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (year_id) {
      query += ` AND m.year_id = $${paramCount++}`;
      params.push(year_id);
    }

    if (department_id) {
      query += ` AND y.department_id = $${paramCount++}`;
      params.push(department_id);
    }

    if (is_active !== undefined) {
      query += ` AND m.is_active = $${paramCount++}`;
      params.push(is_active === 'true');
    }

    if (year) {
      query += ` AND y.year = $${paramCount++}`;
      params.push(parseInt(year));
    }

    if (month) {
      query += ` AND m.month = $${paramCount++}`;
      params.push(parseInt(month));
    }

    query += ' ORDER BY y.year DESC, m.month DESC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(parseMonth));
  } catch (error) {
    next(error);
  }
};

export const getMonthById = async (req, res, next) => {
  try {
    const { id } = req.params; // UUID id
    
    const result = await pool.query(
      `SELECT m.*, y.department_id, y.year as year_number,
              d.name as department_name, d.display_name as department_display_name
       FROM months m
       JOIN years y ON m.year_id = y.id
       JOIN departments d ON y.department_id = d.id
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Month not found' });
    }

    res.json(parseMonth(result.rows[0]));
  } catch (error) {
    next(error);
  }
};

export const createMonth = async (req, res, next) => {
  try {
    const { year_id, month, metadata } = req.body;
    const user = req.user;

    if (!year_id || !month) {
      return res.status(400).json({ error: 'year_id and month are required' });
    }

    // Validate month range
    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }

    // Verify year exists
    const yearCheck = await pool.query('SELECT id, year FROM years WHERE id = $1', [year_id]);
    if (yearCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid year_id' });
    }

    const yearNumber = yearCheck.rows[0].year;

    // Check if month already exists for this year
    const monthCheck = await pool.query(
      'SELECT id FROM months WHERE year_id = $1 AND month = $2',
      [year_id, month]
    );
    if (monthCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Month already exists for this year' });
    }

    // Extract metadata fields if provided
    const metadataObj = metadata || {};
    const monthName = metadataObj.monthName || null;
    const startDate = metadataObj.startDate ? new Date(metadataObj.startDate).toISOString().split('T')[0] : null;
    const endDate = metadataObj.endDate ? new Date(metadataObj.endDate).toISOString().split('T')[0] : null;
    const daysInMonth = metadataObj.daysInMonth || null;
    const boardId = metadataObj.boardId || null;

    const result = await pool.query(
      `INSERT INTO months (
        year_id, month, month_name, start_date, end_date, 
        days_in_month, board_id, is_active, created_by_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        year_id,
        month,
        monthName,
        startDate,
        endDate,
        daysInMonth,
        boardId,
        true,
        user.id || null
      ]
    );

    // Get full month data with joins
    const fullMonth = await pool.query(
      `SELECT m.*, y.department_id, y.year as year_number,
              d.name as department_name, d.display_name as department_display_name
       FROM months m
       JOIN years y ON m.year_id = y.id
       JOIN departments d ON y.department_id = d.id
       WHERE m.id = $1`,
      [result.rows[0].id]
    );

    const newMonth = parseMonth(fullMonth.rows[0]);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyMonthChange('created', newMonth);
    }

    res.status(201).json(newMonth);
  } catch (error) {
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Invalid year_id' });
    }
    next(error);
  }
};

export const updateMonth = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active, metadata } = req.body;
    const user = req.user;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }
    
    // Update metadata fields if provided
    if (metadata !== undefined) {
      if (metadata.monthName !== undefined) {
        updates.push(`month_name = $${paramCount++}`);
        params.push(metadata.monthName || null);
      }
      if (metadata.startDate !== undefined) {
        updates.push(`start_date = $${paramCount++}`);
        params.push(metadata.startDate ? new Date(metadata.startDate).toISOString().split('T')[0] : null);
      }
      if (metadata.endDate !== undefined) {
        updates.push(`end_date = $${paramCount++}`);
        params.push(metadata.endDate ? new Date(metadata.endDate).toISOString().split('T')[0] : null);
      }
      if (metadata.daysInMonth !== undefined) {
        updates.push(`days_in_month = $${paramCount++}`);
        params.push(metadata.daysInMonth || null);
      }
      if (metadata.boardId !== undefined) {
        updates.push(`board_id = $${paramCount++}`);
        params.push(metadata.boardId || null);
      }
    }

    // Always update updated_by_id to track who made the change
    updates.push(`updated_by_id = $${paramCount++}`);
    params.push(user.id || null);

    if (updates.length === 1) { // Only updated_by_id
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    const query = `
      UPDATE months
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Month not found' });
    }

    // Get full month data with joins
    const fullMonth = await pool.query(
      `SELECT m.*, y.department_id, y.year as year_number,
              d.name as department_name, d.display_name as department_display_name
       FROM months m
       JOIN years y ON m.year_id = y.id
       JOIN departments d ON y.department_id = d.id
       WHERE m.id = $1`,
      [id]
    );

    const updatedMonth = parseMonth(fullMonth.rows[0]);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyMonthChange('updated', updatedMonth);
    }

    res.json(updatedMonth);
  } catch (error) {
    next(error);
  }
};

export const deleteMonth = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if month has tasks
    const taskCheck = await pool.query(
      'SELECT COUNT(*) as count FROM tasks WHERE month_id = $1',
      [id]
    );

    if (parseInt(taskCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete month with existing tasks. Delete tasks first or use soft delete (deactivate).' 
      });
    }

    const result = await pool.query('DELETE FROM months WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Month not found' });
    }

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyMonthChange('deleted', { id: result.rows[0].id });
    }

    res.json({ success: true, message: 'Month deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get or create month for a specific year
 * Useful for automatic month creation when creating tasks
 */
export const getOrCreateMonth = async (req, res, next) => {
  try {
    const { year_id, month } = req.body;
    const user = req.user;

    if (!year_id || !month) {
      return res.status(400).json({ error: 'year_id and month are required' });
    }

    // Try to find existing month
    let result = await pool.query(
      `SELECT m.*, y.department_id, y.year as year_number,
              d.name as department_name, d.display_name as department_display_name
       FROM months m
       JOIN years y ON m.year_id = y.id
       JOIN departments d ON y.department_id = d.id
       WHERE m.year_id = $1 AND m.month = $2`,
      [year_id, month]
    );

    if (result.rows.length > 0) {
      return res.json(parseMonth(result.rows[0]));
    }

    // Create new month if not exists
    const insertResult = await pool.query(
      `INSERT INTO months (year_id, month, is_active, created_by_id)
       VALUES ($1, $2, true, $3)
       RETURNING *`,
      [year_id, month, user.id || null]
    );

    // Get full month data with joins
    const fullMonth = await pool.query(
      `SELECT m.*, y.department_id, y.year as year_number,
              d.name as department_name, d.display_name as department_display_name
       FROM months m
       JOIN years y ON m.year_id = y.id
       JOIN departments d ON y.department_id = d.id
       WHERE m.id = $1`,
      [insertResult.rows[0].id]
    );

    res.status(201).json(parseMonth(fullMonth.rows[0]));
  } catch (error) {
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Invalid year_id' });
    }
    next(error);
  }
};
