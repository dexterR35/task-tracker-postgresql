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
  
  // Format response to match Firebase structure
  return {
    ...month,
    monthId: month.month_id,
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
    const { yearId, status, department } = req.query;
    let query = 'SELECT * FROM months WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (yearId) {
      query += ` AND year_id = $${paramCount++}`;
      params.push(yearId);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (department) {
      query += ` AND department = $${paramCount++}`;
      params.push(department);
    }

    query += ' ORDER BY month_id DESC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(parseMonth));
  } catch (error) {
    next(error);
  }
};

export const getMonthById = async (req, res, next) => {
  try {
    const { monthId } = req.params;
    const result = await pool.query('SELECT * FROM months WHERE month_id = $1', [monthId]);

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
    const { monthId, yearId, department, status, metadata } = req.body;
    const user = req.user;

    if (!monthId || !yearId) {
      return res.status(400).json({ error: 'monthId and yearId are required' });
    }

    // Check if month already exists
    const monthCheck = await pool.query('SELECT month_id FROM months WHERE month_id = $1', [monthId]);
    if (monthCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Month board already exists' });
    }

    // Extract metadata fields if provided
    const metadataObj = metadata || {};
    const monthName = metadataObj.monthName || null;
    const startDate = metadataObj.startDate ? new Date(metadataObj.startDate).toISOString().split('T')[0] : null;
    const endDate = metadataObj.endDate ? new Date(metadataObj.endDate).toISOString().split('T')[0] : null;
    const daysInMonth = metadataObj.daysInMonth || null;
    const boardId = metadataObj.boardId || null;
    const month = metadataObj.month || null;
    const year = metadataObj.year || null;

    const result = await pool.query(
      `INSERT INTO months (
        month_id, year_id, department, status,
        month_name, start_date, end_date, days_in_month, board_id, month, year,
        "created_by_UID"
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        monthId,
        yearId,
        department || 'design',
        status || 'active',
        monthName,
        startDate,
        endDate,
        daysInMonth,
        boardId,
        month,
        year,
        user.userUID || ''
      ]
    );

    const newMonth = parseMonth(result.rows[0]);

    // Emit WebSocket event
    const wsManager = req.app.locals.wsManager;
    if (wsManager) {
      wsManager.notifyMonthChange('created', newMonth);
    }

    res.status(201).json(newMonth);
  } catch (error) {
    next(error);
  }
};

export const updateMonth = async (req, res, next) => {
  try {
    const { monthId } = req.params;
    const { status, metadata } = req.body;
    const user = req.user;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (status) {
      updates.push(`status = $${paramCount++}`);
      params.push(status);
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
      if (metadata.month !== undefined) {
        updates.push(`month = $${paramCount++}`);
        params.push(metadata.month || null);
      }
      if (metadata.year !== undefined) {
        updates.push(`year = $${paramCount++}`);
        params.push(metadata.year || null);
      }
    }

    // Always update updated_by_UID to track who made the change
    updates.push(`"updated_by_UID" = $${paramCount++}`);
    params.push(user.userUID || '');

    if (updates.length === 1) { // Only updated_by_UID
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(monthId);

    const query = `
      UPDATE months
      SET ${updates.join(', ')}
      WHERE month_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Month not found' });
    }

    const updatedMonth = parseMonth(result.rows[0]);

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
