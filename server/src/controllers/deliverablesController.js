import pool from '../config/database.js';

// Helper to emit WebSocket events
const emitDeliverableChange = (req, event, deliverable) => {
  const wsManager = req.app.locals.wsManager;
  if (wsManager) {
    wsManager.notifyDeliverableChange(event, deliverable);
  }
};

export const getDeliverables = async (req, res, next) => {
  try {
    const { department, search, requiresQuantity } = req.query;
    
    let query = 'SELECT * FROM deliverables WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (department) {
      query += ` AND department = $${paramCount++}`;
      params.push(department);
    }

    if (search) {
      query += ` AND (LOWER(name) LIKE $${paramCount} OR LOWER(description) LIKE $${paramCount})`;
      params.push(`%${search.toLowerCase()}%`);
      paramCount++;
    }

    if (requiresQuantity !== undefined) {
      const requiresQuantityBool = requiresQuantity === 'true' || requiresQuantity === true;
      query += ` AND requires_quantity = $${paramCount++}`;
      params.push(requiresQuantityBool);
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    // Format response to match old Firebase structure EXACTLY
    const formatted = result.rows.map(row => {
      const deliverable = {
        id: row.id,
        name: row.name,
        department: row.department,
        timePerUnit: row.time_per_unit,
        timeUnit: row.time_unit,
        variationsTime: row.variations_time || 0,
        requiresQuantity: row.requires_quantity,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : row.createdAt,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt
      };
      
      // Only include declinariTime if it exists (optional in Firebase)
      if (row.declinari_time !== null && row.declinari_time !== undefined) {
        deliverable.declinariTime = row.declinari_time;
      }
      
      // Only include declinariTimeUnit if it exists (optional in Firebase, only one item had it)
      if (row.declinari_time_unit) {
        deliverable.declinariTimeUnit = row.declinari_time_unit;
      }
      
      // Only include updatedBy/updatedByName if they exist (optional in Firebase)
      if (row.updated_by_UID) {
        deliverable.updatedBy = row.updated_by_UID;
      }
      if (row.updated_by_name) {
        deliverable.updatedByName = row.updated_by_name;
      }
      
      return deliverable;
    });
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getDeliverableById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM deliverables WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    // Format response to match old Firebase structure EXACTLY
    const row = result.rows[0];
    const formatted = {
      id: row.id,
      name: row.name,
      department: row.department,
      timePerUnit: row.time_per_unit,
      timeUnit: row.time_unit,
      variationsTime: row.variations_time || 0,
      requiresQuantity: row.requires_quantity,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : row.createdAt,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt
    };
    
    // Only include declinariTime if it exists (optional in Firebase)
    if (row.declinari_time !== null && row.declinari_time !== undefined) {
      formatted.declinariTime = row.declinari_time;
    }
    
    // Only include declinariTimeUnit if it exists (optional in Firebase)
    if (row.declinari_time_unit) {
      formatted.declinariTimeUnit = row.declinari_time_unit;
    }
    
    // Only include updatedBy/updatedByName if they exist (optional in Firebase)
    if (row.updated_by_UID) {
      formatted.updatedBy = row.updated_by_UID;
    }
    if (row.updated_by_name) {
      formatted.updatedByName = row.updated_by_name;
    }

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const createDeliverable = async (req, res, next) => {
  try {
    const { 
      name, 
      description, 
      department, 
      timePerUnit, 
      timeUnit, 
      variationsTime, 
      variationsTimeUnit, 
      declinariTime,
      declinariTimeUnit,
      requiresQuantity,
      id // Allow custom ID (deliverable_timestamp format)
    } = req.body;
    const user = req.user;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Generate ID if not provided (match old Firebase format: deliverable_timestamp)
    const deliverableId = id || `deliverable_${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO deliverables (
        id, name, description, department, time_per_unit, time_unit, 
        variations_time, variations_time_unit, declinari_time, declinari_time_unit,
        requires_quantity, created_by_UID, created_by_name
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        deliverableId,
        name, 
        description, 
        department, 
        timePerUnit, 
        timeUnit || 'hr', 
        variationsTime, 
        variationsTimeUnit || 'min',
        declinariTime || null,
        declinariTimeUnit || 'min',
        requiresQuantity || false,
        user.userUID || '', // Use user_UID directly
        user.name || user.email
      ]
    );

    // Format response to match old Firebase structure EXACTLY
    const row = result.rows[0];
    const formatted = {
      id: row.id,
      name: row.name,
      department: row.department,
      timePerUnit: row.time_per_unit,
      timeUnit: row.time_unit,
      variationsTime: row.variations_time || 0,
      requiresQuantity: row.requires_quantity,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : row.createdAt,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt
    };
    
    // Only include declinariTime if it exists (optional in Firebase)
    if (row.declinari_time !== null && row.declinari_time !== undefined) {
      formatted.declinariTime = row.declinari_time;
    }
    
    // Only include declinariTimeUnit if it exists (optional in Firebase)
    if (row.declinari_time_unit) {
      formatted.declinariTimeUnit = row.declinari_time_unit;
    }
    
    // Only include updatedBy/updatedByName if they exist (optional in Firebase)
    if (row.updated_by_UID) {
      formatted.updatedBy = row.updated_by_UID;
    }
    if (row.updated_by_name) {
      formatted.updatedByName = row.updated_by_name;
    }

    emitDeliverableChange(req, 'created', formatted);
    res.status(201).json(formatted);
  } catch (error) {
    next(error);
  }
};

export const updateDeliverable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      department, 
      timePerUnit, 
      timeUnit, 
      variationsTime, 
      variationsTimeUnit,
      declinariTime,
      declinariTimeUnit,
      requiresQuantity 
    } = req.body;
    const user = req.user;

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      params.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      params.push(description);
    }
    if (department !== undefined) {
      updates.push(`department = $${paramCount++}`);
      params.push(department);
    }
    if (timePerUnit !== undefined) {
      updates.push(`time_per_unit = $${paramCount++}`);
      params.push(timePerUnit);
    }
    if (timeUnit !== undefined) {
      updates.push(`time_unit = $${paramCount++}`);
      params.push(timeUnit);
    }
    if (variationsTime !== undefined) {
      updates.push(`variations_time = $${paramCount++}`);
      params.push(variationsTime);
    }
    if (variationsTimeUnit !== undefined) {
      updates.push(`variations_time_unit = $${paramCount++}`);
      params.push(variationsTimeUnit);
    }
    if (declinariTime !== undefined) {
      updates.push(`declinari_time = $${paramCount++}`);
      params.push(declinariTime);
    }
    if (declinariTimeUnit !== undefined) {
      updates.push(`declinari_time_unit = $${paramCount++}`);
      params.push(declinariTimeUnit);
    }
    if (requiresQuantity !== undefined) {
      updates.push(`requires_quantity = $${paramCount++}`);
      params.push(requiresQuantity);
    }

    updates.push(`"updated_by_UID" = $${paramCount++}`);
    params.push(user.userUID || '');
    updates.push(`updated_by_name = $${paramCount++}`);
    params.push(user.name || user.email);

    if (updates.length === 2) { // Only updated_by and updated_by_name
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    const query = `
      UPDATE deliverables
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    // Format response to match old Firebase structure EXACTLY
    const row = result.rows[0];
    const formatted = {
      id: row.id,
      name: row.name,
      department: row.department,
      timePerUnit: row.time_per_unit,
      timeUnit: row.time_unit,
      variationsTime: row.variations_time || 0,
      requiresQuantity: row.requires_quantity,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : row.createdAt,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt
    };
    
    // Only include declinariTime if it exists (optional in Firebase)
    if (row.declinari_time !== null && row.declinari_time !== undefined) {
      formatted.declinariTime = row.declinari_time;
    }
    
    // Only include declinariTimeUnit if it exists (optional in Firebase)
    if (row.declinari_time_unit) {
      formatted.declinariTimeUnit = row.declinari_time_unit;
    }
    
    // Only include updatedBy/updatedByName if they exist (optional in Firebase)
    if (row.updated_by_UID) {
      formatted.updatedBy = row.updated_by_UID;
    }
    if (row.updated_by_name) {
      formatted.updatedByName = row.updated_by_name;
    }

    emitDeliverableChange(req, 'updated', formatted);
    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const deleteDeliverable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM deliverables WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deliverable not found' });
    }

    emitDeliverableChange(req, 'deleted', { id });
    res.json({ success: true, message: 'Deliverable deleted successfully' });
  } catch (error) {
    next(error);
  }
};

