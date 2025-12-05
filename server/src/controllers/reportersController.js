import pool from '../config/database.js';

// Helper to emit WebSocket events
const emitReporterChange = (req, event, reporter) => {
  const wsManager = req.app.locals.wsManager;
  if (wsManager) {
    wsManager.notifyReporterChange(event, reporter);
  }
};

export const getReporters = async (req, res, next) => {
  try {
    const { department, country, channel, search } = req.query;
    
    let query = 'SELECT id, name, email, department, channel, channel_name, country, created_at, updated_at, created_by_id, updated_by_id FROM reporters WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (department) {
      query += ` AND department = $${paramCount++}`;
      params.push(department);
    }

    if (country) {
      query += ` AND country = $${paramCount++}`;
      params.push(country);
    }

    if (channel) {
      query += ` AND (channel = $${paramCount} OR channel_name = $${paramCount})`;
      params.push(channel);
      paramCount++;
    }

    if (search) {
      query += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(email) LIKE $${paramCount})`;
      params.push(`%${search.toLowerCase()}%`);
      paramCount++;
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    // Format response to match Firebase structure
    const formatted = result.rows.map(row => ({
      id: row.id, // UUID id (primary key)
      name: row.name,
      email: row.email,
      departament: row.department, // Firebase uses "departament" spelling
      channelName: row.channel_name || row.channel,
      country: row.country,
      reporterUID: row.id, // Use id as reporterUID for backward compatibility
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : row.createdAt,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt,
      createdBy: row.created_by_id || row.createdBy, // User ID
    }));
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getReporterById = async (req, res, next) => {
  try {
    const { id } = req.params; // This is the UUID id
    const result = await pool.query('SELECT id, name, email, department, channel, channel_name, country, created_at, updated_at, created_by_id, updated_by_id FROM reporters WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    // Format response to match Firebase structure
    const row = result.rows[0];
    const formatted = {
      id: row.id, // UUID id (primary key)
      name: row.name,
      email: row.email,
      departament: row.department, // Firebase uses "departament" spelling
      channelName: row.channel_name || row.channel,
      country: row.country,
      reporterUID: row["reporter_UID"], // Business identifier (VARCHAR)
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : row.createdAt,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt,
      createdBy: row["created_by_UID"] || row.createdBy, // User UID
    };

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const createReporter = async (req, res, next) => {
  try {
    const { 
      name, 
      email, 
      department, 
      departament, 
      channel, 
      channelName, 
      country 
    } = req.body;
    const user = req.user;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Use departament if provided, otherwise department
    const finalDepartment = departament || department;
    // Use channelName if provided, otherwise channel
    const finalChannel = channelName || channel;

    const result = await pool.query(
      `INSERT INTO reporters (
        name, email, department, channel, channel_name, country,
        created_by_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name, 
        email, 
        finalDepartment, 
        finalChannel, 
        channelName || finalChannel, 
        country,
        user.id || null
      ]
    );

    // Format response to match Firebase structure
    const row = result.rows[0];
    const formatted = {
      id: row.id, // UUID id (primary key)
      name: row.name,
      email: row.email,
      departament: row.department, // Firebase uses "departament" spelling
      channelName: row.channel_name || row.channel,
      country: row.country,
      reporterUID: row.id, // Use id as reporterUID for backward compatibility
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : row.createdAt,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt,
      createdBy: row.created_by_id || row.createdBy, // User ID
    };

    emitReporterChange(req, 'created', formatted);
    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const updateReporter = async (req, res, next) => {
  try {
    const { id } = req.params; // This is the UUID id
    const { 
      name, 
      email, 
      department, 
      departament, 
      channel, 
      channelName, 
      country 
    } = req.body;
    const user = req.user;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      params.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      params.push(email);
    }
    if (department !== undefined || departament !== undefined) {
      updates.push(`department = $${paramCount++}`);
      params.push(departament || department);
    }
    if (channel !== undefined || channelName !== undefined) {
      updates.push(`channel = $${paramCount++}`);
      params.push(channelName || channel);
      if (channelName !== undefined) {
        updates.push(`channel_name = $${paramCount++}`);
        params.push(channelName);
      }
    }
    if (country !== undefined) {
      updates.push(`country = $${paramCount++}`);
      params.push(country);
    }

    updates.push(`updated_by_id = $${paramCount++}`);
    params.push(user.id || null);

    if (updates.length === 1) { // Only updated_by_id
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    const query = `
      UPDATE reporters
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    // Format response to match Firebase structure
    const row = result.rows[0];
    const formatted = {
      id: row.id, // UUID id (primary key)
      name: row.name,
      email: row.email,
      departament: row.department, // Firebase uses "departament" spelling
      channelName: row.channel_name || row.channel,
      country: row.country,
      reporterUID: row.id, // Use id as reporterUID for backward compatibility
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : row.createdAt,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt,
      createdBy: row.created_by_id || row.createdBy, // User ID
    };

    emitReporterChange(req, 'updated', formatted);
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const deleteReporter = async (req, res, next) => {
  try {
    const { id } = req.params; // This is the UUID id
    
    // Get reporter before deleting for WebSocket notification
    const reporterCheck = await pool.query('SELECT id FROM reporters WHERE id = $1', [id]);
    if (reporterCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    const result = await pool.query('DELETE FROM reporters WHERE id = $1 RETURNING id', [id]);

    // Send delete event with both id and reporterUID for compatibility
    emitReporterChange(req, 'deleted', { 
      id: result.rows[0].id,
      reporterUID: result.rows[0].id 
    });
    res.json({ success: true, message: 'Reporter deleted successfully' });
  } catch (error) {
    next(error);
  }
};

