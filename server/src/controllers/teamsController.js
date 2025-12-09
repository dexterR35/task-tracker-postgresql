import pool from '../config/database.js';

/**
 * Get all teams
 */
export const getTeams = async (req, res, next) => {
  try {
    const { is_active } = req.query;

    let query = 'SELECT * FROM teams';
    const params = [];

    if (is_active !== undefined) {
      query += ' WHERE is_active = $1';
      params.push(is_active === 'true');
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single team by ID
 */
export const getTeamById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM teams WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new team
 */
export const createTeam = async (req, res, next) => {
  try {
    const { name, display_name, description, is_active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const result = await pool.query(
      `INSERT INTO teams (name, display_name, description, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, display_name, description, is_active !== undefined ? is_active : true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Team name already exists' });
    }
    next(error);
  }
};

/**
 * Update team
 */
export const updateTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, display_name, description, is_active } = req.body;

    const result = await pool.query(
      `UPDATE teams 
       SET name = COALESCE($1, name),
           display_name = COALESCE($2, display_name),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, display_name, description, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Team name already exists' });
    }
    next(error);
  }
};

/**
 * Delete team (soft delete by setting is_active = false)
 */
export const deleteTeam = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hard_delete } = req.query;

    if (hard_delete === 'true') {
      // Check if team has departments
      const deptCheck = await pool.query(
        'SELECT COUNT(*) as count FROM departments WHERE team_id = $1',
        [id]
      );

      if (parseInt(deptCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete team with existing departments. Delete or reassign departments first.' 
        });
      }

      // Hard delete
      const result = await pool.query(
        'DELETE FROM teams WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }

      res.json({ message: 'Team deleted successfully', team: result.rows[0] });
    } else {
      // Soft delete
      const result = await pool.query(
        'UPDATE teams SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Team not found' });
      }

      res.json({ message: 'Team deactivated successfully', team: result.rows[0] });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get departments for a specific team
 */
export const getTeamDepartments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT d.* FROM departments d
       WHERE d.team_id = $1
       ORDER BY d.name ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

