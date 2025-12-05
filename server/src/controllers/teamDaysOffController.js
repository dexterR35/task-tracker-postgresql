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
    const currentUser = req.user;
    
    let query = 'SELECT * FROM team_days_off WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Authorization: Regular users can only see their own, admins can see all
    if (currentUser.role !== 'admin') {
      query += ` AND "user_UID" = $${paramCount++}`;
      params.push(currentUser.userUID);
    } else if (userUID) {
      // Admin can filter by specific user
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
    const currentUser = req.user;
    
    const result = await pool.query('SELECT * FROM team_days_off WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Day off not found' });
    }

    const dayOff = result.rows[0];
    
    // Authorization: Users can only view their own, admins can view any
    if (currentUser.role !== 'admin' && dayOff["user_UID"] !== currentUser.userUID) {
      return res.status(403).json({ error: 'Insufficient permissions to view this record' });
    }

    res.json(dayOff);
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

    // Authorization: Regular users can only create for themselves, admins can create for anyone
    if (user.role !== 'admin' && userUID !== user.userUID) {
      return res.status(403).json({ error: 'You can only create days off for yourself' });
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
        base_days, 
        days_off, 
        days_remaining, 
        days_total, 
        monthly_accrual,
        created_by_UID
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT ("user_UID") 
      DO UPDATE SET
        base_days = EXCLUDED.base_days,
        days_off = EXCLUDED.days_off,
        days_remaining = EXCLUDED.days_remaining,
        days_total = EXCLUDED.days_total,
        monthly_accrual = EXCLUDED.monthly_accrual,
        updated_by_UID = EXCLUDED.created_by_UID,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userUID, 
        baseDaysValue, 
        daysOffValue, 
        daysRemaining, 
        daysTotal, 
        monthlyAccrualValue,
        user.userUID || ''
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

    // Check if record exists and verify authorization
    const existingCheck = await pool.query('SELECT "user_UID" FROM team_days_off WHERE id = $1', [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Day off not found' });
    }

    // Authorization: Regular users can only update their own, admins can update any
    if (user.role !== 'admin' && existingCheck.rows[0]["user_UID"] !== user.userUID) {
      return res.status(403).json({ error: 'You can only update your own days off' });
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

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

    // Always update updated_by_UID
    updates.push(`updated_by_UID = $${paramCount++}`);
    params.push(user.userUID || '');

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
    const user = req.user;

    // Check if record exists and verify authorization (only admins can delete)
    const existingCheck = await pool.query('SELECT "user_UID" FROM team_days_off WHERE id = $1', [id]);
    if (existingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Day off not found' });
    }

    // Authorization: Only admins can delete (enforced by route middleware, but double-check here)
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can delete days off records' });
    }

    const result = await pool.query('DELETE FROM team_days_off WHERE id = $1 RETURNING id', [id]);

    emitTeamDaysOffChange(req, 'deleted', { id: result.rows[0].id });
    res.json({ success: true, message: 'Day off deleted successfully' });
  } catch (error) {
    next(error);
  }
};

