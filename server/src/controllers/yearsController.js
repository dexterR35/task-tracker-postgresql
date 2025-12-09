import pool from '../config/database.js';

/**
 * Get all years
 */
export const getYears = async (req, res, next) => {
  try {
    const { department_id, is_active } = req.query;

    let query = `
      SELECT y.*, d.name as department_name, d.display_name as department_display_name
      FROM years y
      JOIN departments d ON y.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (department_id) {
      query += ` AND y.department_id = $${paramIndex}`;
      params.push(department_id);
      paramIndex++;
    }

    if (is_active !== undefined) {
      query += ` AND y.is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ' ORDER BY y.year DESC';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single year by ID
 */
export const getYearById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT y.*, d.name as department_name, d.display_name as department_display_name
       FROM years y
       JOIN departments d ON y.department_id = d.id
       WHERE y.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Year not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new year
 */
export const createYear = async (req, res, next) => {
  try {
    const { department_id, year, is_active } = req.body;

    if (!department_id || !year) {
      return res.status(400).json({ error: 'Department ID and year are required' });
    }

    // Validate year range
    if (year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Year must be between 2000 and 2100' });
    }

    const result = await pool.query(
      `INSERT INTO years (department_id, year, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [department_id, year, is_active !== undefined ? is_active : true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Year already exists for this department' });
    }
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Invalid department ID' });
    }
    next(error);
  }
};

/**
 * Update year
 */
export const updateYear = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { year, is_active } = req.body;

    // Validate year range if provided
    if (year && (year < 2000 || year > 2100)) {
      return res.status(400).json({ error: 'Year must be between 2000 and 2100' });
    }

    const result = await pool.query(
      `UPDATE years 
       SET year = COALESCE($1, year),
           is_active = COALESCE($2, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [year, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Year not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Year already exists for this department' });
    }
    next(error);
  }
};

/**
 * Delete year (soft delete by setting is_active = false)
 */
export const deleteYear = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hard_delete } = req.query;

    if (hard_delete === 'true') {
      // Check if year has months
      const monthCheck = await pool.query(
        'SELECT COUNT(*) as count FROM months WHERE year_id = $1',
        [id]
      );

      if (parseInt(monthCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete year with existing months. Delete months first.' 
        });
      }

      // Hard delete
      const result = await pool.query(
        'DELETE FROM years WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Year not found' });
      }

      res.json({ message: 'Year deleted successfully', year: result.rows[0] });
    } else {
      // Soft delete
      const result = await pool.query(
        'UPDATE years SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Year not found' });
      }

      res.json({ message: 'Year deactivated successfully', year: result.rows[0] });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get months for a specific year
 */
export const getYearMonths = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT m.* FROM months m
       WHERE m.year_id = $1
       ORDER BY m.month ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Get or create year for department
 * This is useful for automatic year creation
 */
export const getOrCreateYear = async (req, res, next) => {
  try {
    const { department_id, year } = req.body;

    if (!department_id || !year) {
      return res.status(400).json({ error: 'Department ID and year are required' });
    }

    // Try to find existing year
    let result = await pool.query(
      'SELECT * FROM years WHERE department_id = $1 AND year = $2',
      [department_id, year]
    );

    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }

    // Create new year if not exists
    result = await pool.query(
      `INSERT INTO years (department_id, year, is_active)
       VALUES ($1, $2, true)
       RETURNING *`,
      [department_id, year]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Invalid department ID' });
    }
    next(error);
  }
};

