import pool from '../config/database.js';

/**
 * Get all markets
 */
export const getMarkets = async (req, res, next) => {
  try {
    const { is_active } = req.query;

    let query = 'SELECT * FROM markets';
    const params = [];

    if (is_active !== undefined) {
      query += ' WHERE is_active = $1';
      params.push(is_active === 'true');
    }

    query += ' ORDER BY code ASC';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single market by ID
 */
export const getMarketById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM markets WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * Get market by code
 */
export const getMarketByCode = async (req, res, next) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      'SELECT * FROM markets WHERE code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new market
 */
export const createMarket = async (req, res, next) => {
  try {
    const { code, name, is_active } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Market code and name are required' });
    }

    const result = await pool.query(
      `INSERT INTO markets (code, name, is_active)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [code, name, is_active !== undefined ? is_active : true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Market code already exists' });
    }
    next(error);
  }
};

/**
 * Update market
 */
export const updateMarket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, is_active } = req.body;

    const result = await pool.query(
      `UPDATE markets 
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING *`,
      [code, name, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Market code already exists' });
    }
    next(error);
  }
};

/**
 * Delete market (soft delete by setting is_active = false)
 */
export const deleteMarket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hard_delete } = req.query;

    if (hard_delete === 'true') {
      // Check if market is used in task_markets
      const taskCheck = await pool.query(
        'SELECT COUNT(*) as count FROM task_markets WHERE market_id = $1',
        [id]
      );

      if (parseInt(taskCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete market that is used in tasks. Deactivate instead.' 
        });
      }

      // Hard delete
      const result = await pool.query(
        'DELETE FROM markets WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Market not found' });
      }

      res.json({ message: 'Market deleted successfully', market: result.rows[0] });
    } else {
      // Soft delete
      const result = await pool.query(
        'UPDATE markets SET is_active = false WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Market not found' });
      }

      res.json({ message: 'Market deactivated successfully', market: result.rows[0] });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get tasks using a specific market
 */
export const getMarketTasks = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT DISTINCT t.* 
       FROM tasks t
       JOIN task_markets tm ON t.id = tm.task_id
       WHERE tm.market_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

