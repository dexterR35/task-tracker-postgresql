# Tasks Controller Update Guide

## Critical Changes Needed

### 1. Required Fields
- `deliverable_id` (UUID FK) - REQUIRED
- `department_id` (UUID FK) - Set from user's department_id
- `month_id` (UUID) - Already handled

### 2. Access Control
- **Regular users**: Can only see tasks where `task.department_id = user.department_id`
- **Admin users**: Can see ALL tasks (no filter)

### 3. Market Handling
- Old: `task_markets.market` (VARCHAR) - market code like 'ro', 'com'
- New: `task_markets.market_id` (UUID FK) - references markets.id

### 4. Task Deliverables Structure
- Old: Multiple deliverables per task with `deliverable_name`
- New: One task_deliverables record per task (one-to-one)
- Purpose: Store count and variations for analytics
- Deliverable name accessed via: `task.deliverable_id → deliverables.name`

## Implementation Plan

### buildTaskWithRelatedData() - Update Query
```javascript
// OLD - queries task_markets for market (VARCHAR)
pool.query('SELECT market FROM task_markets WHERE task_id = $1', [task.id])

// NEW - join with markets table to get code
pool.query(`
  SELECT m.code as market 
  FROM task_markets tm 
  JOIN markets m ON tm.market_id = m.id 
  WHERE tm.task_id = $1
`, [task.id])

// OLD - gets deliverable_name from task_deliverables
pool.query('SELECT deliverable_name, count, ... FROM task_deliverables WHERE task_id = $1', [task.id])

// NEW - gets deliverable name from task.deliverable_id
pool.query(`
  SELECT d.name as deliverable_name, td.count, td.variations_enabled, td.variations_count
  FROM task_deliverables td
  JOIN tasks t ON td.task_id = t.id
  JOIN deliverables d ON t.deliverable_id = d.id
  WHERE td.task_id = $1
`, [task.id])
```

### getTasks() - Add Department Filtering
```javascript
export const getTasks = async (req, res, next) => {
  // ... existing code ...
  
  let query = `
    SELECT DISTINCT t.* 
    FROM tasks t
    WHERE 1=1
  `;
  
  // ADD: Department-based filtering for regular users
  if (user.role === 'user') {
    query += ` AND t.department_id = $${paramCount++}`;
    params.push(user.department_id); // From JWT token
  }
  // Admin users see ALL tasks (no filter)
  
  // ... rest of filters ...
};
```

### createTask() - Major Updates
```javascript
export const createTask = async (req, res, next) => {
  const { monthId, userUID, boardId, dataTask, deliverable_id } = req.body;
  
  // 1. Validate deliverable_id (REQUIRED)
  if (!deliverable_id) {
    return res.status(400).json({ error: 'deliverable_id is required' });
  }
  
  // Verify deliverable exists
  const deliverableCheck = await pool.query(
    'SELECT id, department_id FROM deliverables WHERE id = $1',
    [deliverable_id]
  );
  if (deliverableCheck.rows.length === 0) {
    return res.status(400).json({ error: 'Invalid deliverable_id' });
  }
  
  // 2. Get user and their department_id
  let taskUserId = user.id;
  let userDepartmentId = user.department_id; // From JWT
  
  if (userUID) {
    const userCheck = await pool.query(
      'SELECT id, department_id FROM users WHERE id = $1',
      [userUID]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    taskUserId = userCheck.rows[0].id;
    userDepartmentId = userCheck.rows[0].department_id;
  }
  
  // 3. Insert task with deliverable_id and department_id
  const result = await pool.query(
    `INSERT INTO tasks (
      month_id, user_id, department_id, deliverable_id,
      board_id, task_name, products, time_in_hours,
      start_date, end_date, observations,
      is_vip, reworked, use_shutterstock,
      reporter_id, created_by_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      monthId,
      taskUserId,
      userDepartmentId, // Set from user
      deliverable_id, // REQUIRED
      finalBoardId,
      taskData.taskName || null,
      taskData.products || null,
      taskData.timeInHours || 0,
      taskData.startDate ? new Date(taskData.startDate).toISOString().split('T')[0] : null,
      taskData.endDate ? new Date(taskData.endDate).toISOString().split('T')[0] : null,
      taskData.observations || null,
      taskData.isVip || false,
      taskData.reworked || false,
      taskData.useShutterstock || false,
      reporterId,
      user.id || taskUserId
    ]
  );
  
  const newTask = result.rows[0];
  
  // 4. Handle markets with UUID FK
  if (taskData.markets && Array.isArray(taskData.markets)) {
    for (const marketCode of taskData.markets) {
      // Get market ID from code
      const marketResult = await pool.query(
        'SELECT id FROM markets WHERE code = $1',
        [marketCode]
      );
      
      if (marketResult.rows.length > 0) {
        await pool.query(
          'INSERT INTO task_markets (task_id, market_id) VALUES ($1, $2) ON CONFLICT (task_id, market_id) DO NOTHING',
          [newTask.id, marketResult.rows[0].id]
        );
      }
    }
  }
  
  // 5. Task deliverables - one-to-one, no deliverable_name
  if (taskData.deliverablesUsed && Array.isArray(taskData.deliverablesUsed)) {
    const deliverable = taskData.deliverablesUsed[0]; // Only first one
    await pool.query(
      'INSERT INTO task_deliverables (task_id, count, variations_enabled, variations_count) VALUES ($1, $2, $3, $4)',
      [
        newTask.id,
        deliverable.count || 1,
        deliverable.variationsEnabled || false,
        deliverable.variationsCount || 0
      ]
    );
  } else {
    // Create default task_deliverables record
    await pool.query(
      'INSERT INTO task_deliverables (task_id, count, variations_enabled, variations_count) VALUES ($1, 1, false, 0)',
      [newTask.id]
    );
  }
  
  // ... rest of function
};
```

### updateTask() - Similar Updates
```javascript
export const updateTask = async (req, res, next) => {
  const { deliverable_id } = req.body;
  
  // If deliverable_id is being updated, validate it
  if (deliverable_id) {
    const deliverableCheck = await pool.query(
      'SELECT id FROM deliverables WHERE id = $1',
      [deliverable_id]
    );
    if (deliverableCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid deliverable_id' });
    }
    
    updates.push(`deliverable_id = $${paramCount++}`);
    params.push(deliverable_id);
  }
  
  // Markets update - convert codes to UUIDs
  if (dataTask.markets && Array.isArray(dataTask.markets)) {
    // Delete existing markets
    await pool.query('DELETE FROM task_markets WHERE task_id = $1', [taskId]);
    
    // Insert new markets with UUID FK
    for (const marketCode of dataTask.markets) {
      const marketResult = await pool.query(
        'SELECT id FROM markets WHERE code = $1',
        [marketCode]
      );
      
      if (marketResult.rows.length > 0) {
        await pool.query(
          'INSERT INTO task_markets (task_id, market_id) VALUES ($1, $2)',
          [taskId, marketResult.rows[0].id]
        );
      }
    }
  }
  
  // Update task_deliverables (one-to-one)
  if (dataTask.deliverablesUsed && Array.isArray(dataTask.deliverablesUsed)) {
    const deliverable = dataTask.deliverablesUsed[0];
    await pool.query(
      `UPDATE task_deliverables 
       SET count = $1, variations_enabled = $2, variations_count = $3
       WHERE task_id = $4`,
      [
        deliverable.count || 1,
        deliverable.variationsEnabled || false,
        deliverable.variationsCount || 0,
        taskId
      ]
    );
  }
  
  // ... rest of function
};
```

## Frontend Changes Required

### Task Creation Form
```javascript
// Add deliverable selection
const [selectedDeliverable, setSelectedDeliverable] = useState(null);

// In form submission
const taskData = {
  monthId,
  userUID,
  deliverable_id: selectedDeliverable.id, // REQUIRED
  dataTask: {
    taskName,
    products,
    markets: ['ro', 'com'], // Still send codes, backend converts
    deliverablesUsed: [{ // Only one, for count/variations
      count: 1,
      variationsEnabled: false,
      variationsCount: 0
    }],
    // ... other fields
  }
};
```

### Task Display
```javascript
// Deliverable name from task.deliverable_id
<div>Deliverable: {task.deliverable_name}</div>

// Department filtering (automatic for regular users)
// Admin: show department filter dropdown
// User: automatically filtered by their department
```

## Database Changes Verification

After implementation, verify:

```sql
-- 1. All tasks have deliverable_id
SELECT COUNT(*) FROM tasks WHERE deliverable_id IS NULL;
-- Should return 0

-- 2. All tasks have department_id
SELECT COUNT(*) FROM tasks WHERE department_id IS NULL;
-- Should return 0

-- 3. task_markets uses UUID FK
SELECT tm.*, m.code 
FROM task_markets tm 
JOIN markets m ON tm.market_id = m.id 
LIMIT 5;
-- Should work

-- 4. task_deliverables is one-to-one
SELECT task_id, COUNT(*) as count 
FROM task_deliverables 
GROUP BY task_id 
HAVING COUNT(*) > 1;
-- Should return no rows
```

## Testing Scenarios

1. **Regular User Creates Task**
   - Must select deliverable
   - task.department_id = user.department_id
   - User can only see their department's tasks

2. **Admin Creates Task**
   - Must select deliverable
   - Can assign to any user
   - task.department_id = assigned_user.department_id
   - Admin sees all tasks

3. **Market Selection**
   - Frontend sends market codes ['ro', 'com']
   - Backend converts to market IDs
   - Stored as UUID FKs in task_markets

4. **Task Deliverables**
   - One record per task
   - Stores count and variations
   - Deliverable name accessed via task.deliverable_id

## Summary

**Key Points:**
1. `deliverable_id` is REQUIRED for all tasks
2. `department_id` is set from user's department
3. Regular users only see tasks for their department
4. Markets use UUID FK to markets table
5. task_deliverables is one-to-one with tasks

**Complexity:** High - touches multiple tables and changes core logic

**Priority:** Critical - must be done before frontend updates

