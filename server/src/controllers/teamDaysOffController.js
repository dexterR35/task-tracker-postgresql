import pool from '../config/database.js';

// Helper to emit WebSocket events
const emitTeamDaysOffChange = (req, event, teamDaysOff) => {
  const wsManager = req.app.locals.wsManager;
  if (wsManager) {
    wsManager.notifyTeamDaysOffChange(event, teamDaysOff);
  }
};

export const getTeamDaysOff = async (req, res, next) => {
  try {
    const { userUID } = req.query;
    let query = 'SELECT * FROM team_days_off WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (userUID) {
      query += ` AND "user_UID" = $${paramCount++}`;
      params.push(userUID);
    }

    query += ' ORDER BY "user_UID"';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getDayOffById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM team_days_off WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Day off not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const createDayOff = async (req, res, next) => {
  try {
    const { userUID, userName, baseDays, daysOff, monthlyAccrual } = req.body;
    const user = req.user;

    if (!userUID) {
      return res.status(400).json({ error: 'userUID is required' });
    }

    const baseDaysValue = parseFloat(baseDays) || 0;
    const daysOffValue = parseFloat(daysOff) || 0;
    const monthlyAccrualValue = parseFloat(monthlyAccrual) || 1.75;
    
    // Calculate days_total and days_remaining
    const daysTotal = baseDaysValue + monthlyAccrualValue;
    const daysRemaining = daysTotal - daysOffValue;

    // Check if entry already exists for this user
    const existingCheck = await pool.query(
      'SELECT id FROM team_days_off WHERE "user_UID" = $1',
      [userUID]
    );

    const isUpdate = existingCheck.rows.length > 0;

    // Use INSERT ... ON CONFLICT to handle unique constraint on user_UID
    const result = await pool.query(
      `INSERT INTO team_days_off (
        "user_UID", 
        user_name, 
        base_days, 
        days_off, 
        days_remaining, 
        days_total, 
        monthly_accrual,
        created_by_uid, 
        created_by_name
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT ("user_UID") 
      DO UPDATE SET
        user_name = EXCLUDED.user_name,
        base_days = EXCLUDED.base_days,
        days_off = EXCLUDED.days_off,
        days_remaining = EXCLUDED.days_remaining,
        days_total = EXCLUDED.days_total,
        monthly_accrual = EXCLUDED.monthly_accrual,
        updated_by_uid = EXCLUDED.created_by_uid,
        updated_by_name = EXCLUDED.created_by_name,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userUID, 
        userName || '', 
        baseDaysValue, 
        daysOffValue, 
        daysRemaining, 
        daysTotal, 
        monthlyAccrualValue,
        user.userUID || '', 
        user.name || user.email
      ]
    );

    const dayOff = result.rows[0];
    // Emit correct event type based on whether it was insert or update
    emitTeamDaysOffChange(req, isUpdate ? 'updated' : 'created', dayOff);
    res.status(isUpdate ? 200 : 201).json(dayOff);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Team days off entry already exists for this user' });
    }
    next(error);
  }
};

export const updateDayOff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userName, baseDays, daysOff, monthlyAccrual, offDays } = req.body;
    const user = req.user;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (userName !== undefined) {
      updates.push(`user_name = $${paramCount++}`);
      params.push(userName);
    }
    if (baseDays !== undefined) {
      updates.push(`base_days = $${paramCount++}`);
      params.push(parseFloat(baseDays) || 0);
    }
    if (daysOff !== undefined) {
      updates.push(`days_off = $${paramCount++}`);
      params.push(parseFloat(daysOff) || 0);
    }
    if (monthlyAccrual !== undefined) {
      updates.push(`monthly_accrual = $${paramCount++}`);
      params.push(parseFloat(monthlyAccrual) || 1.75);
    }
    if (offDays !== undefined) {
      updates.push(`off_days = $${paramCount++}`);
      params.push(JSON.stringify(offDays));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Recalculate days_total and days_remaining if baseDays, daysOff, or monthlyAccrual changed
    if (baseDays !== undefined || daysOff !== undefined || monthlyAccrual !== undefined) {
      // Get current values to calculate
      const currentCheck = await pool.query('SELECT base_days, days_off, monthly_accrual FROM team_days_off WHERE id = $1', [id]);
      if (currentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Day off not found' });
      }
      
      const current = currentCheck.rows[0];
      const baseDaysValue = baseDays !== undefined ? parseFloat(baseDays) || 0 : parseFloat(current.base_days) || 0;
      const daysOffValue = daysOff !== undefined ? parseFloat(daysOff) || 0 : parseFloat(current.days_off) || 0;
      const monthlyAccrualValue = monthlyAccrual !== undefined ? parseFloat(monthlyAccrual) || 1.75 : parseFloat(current.monthly_accrual) || 1.75;
      
      const daysTotal = baseDaysValue + monthlyAccrualValue;
      const daysRemaining = daysTotal - daysOffValue;
      
      updates.push(`days_total = $${paramCount++}`);
      params.push(daysTotal);
      updates.push(`days_remaining = $${paramCount++}`);
      params.push(daysRemaining);
    }

    // Always update updated_by fields
    updates.push(`updated_by_uid = $${paramCount++}`);
    params.push(user.userUID || '');
    updates.push(`updated_by_name = $${paramCount++}`);
    params.push(user.name || user.email);

    params.push(id);

    const query = `
      UPDATE team_days_off
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Day off not found' });
    }

    const updatedDayOff = result.rows[0];
    emitTeamDaysOffChange(req, 'updated', updatedDayOff);
    res.json(updatedDayOff);
  } catch (error) {
    next(error);
  }
};

export const deleteDayOff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM team_days_off WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Day off not found' });
    }

    emitTeamDaysOffChange(req, 'deleted', { id: result.rows[0].id });
    res.json({ success: true, message: 'Day off deleted successfully' });
  } catch (error) {
    next(error);
  }
};

