import pool from '../config/database.js';

// Helper to parse JSONB fields and extract metadata fields to top level
const parseMonth = (month) => {
  if (!month) return month;
  
  const metadata = typeof month.metadata === 'string' 
    ? JSON.parse(month.metadata) 
    : month.metadata || {};
  
  // Extract metadata fields to top level for frontend compatibility
  return {
    ...month,
    monthId: month.month_id, // Normalize month_id to monthId
    metadata,
    // Extract common fields from metadata to top level
    monthName: metadata.monthName || null,
    startDate: metadata.startDate || null,
    endDate: metadata.endDate || null,
    daysInMonth: metadata.daysInMonth || null,
    boardId: metadata.boardId || null,
    month: metadata.month || null,
    year: metadata.year || null
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

    const result = await pool.query(
      `INSERT INTO months (month_id, year_id, department, status, metadata, created_by_UID)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        monthId,
        yearId,
        department || 'design',
        status || 'active',
        JSON.stringify(metadata || {}),
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
    if (metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      params.push(JSON.stringify(metadata));
    }

    // Always update updated_by_UID to track who made the change
    updates.push(`updated_by_UID = $${paramCount++}`);
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

