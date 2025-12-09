# Database Schema Implementation Summary

## Overview
This document summarizes the major database schema changes implemented based on `mydata_sqlflow.sql` and provides guidance on completing the implementation.

## Major Schema Changes

### 1. New Tables Added
- **teams**: Top-level organizational units (e.g., 'racheta')
- **years**: Year management per department
- **markets**: Reference table for market codes (ro, com, uk, etc.)

### 2. Structural Changes

#### users table
- ✅ `department_id` is now **REQUIRED** (NOT NULL)
- ✅ Users MUST have a department (their occupation/role)
- ✅ This determines which tasks they can see

#### departments table
- ✅ Now belongs to `teams` via `team_id` FK
- ✅ Structure: teams → departments → users

#### months table
- ✅ `year_id` is now UUID FK to `years` table (not a string)
- ✅ No more `department_id` field - accessed via `years.department_id`
- ✅ Structure: years → months → tasks

#### tasks table
- ⚠️ **NEEDS UPDATE** - `deliverable_id` must be REQUIRED (UUID FK)
- ⚠️ **NEEDS UPDATE** - `department_id` must be set from user's department
- ✅ `month_id` references `months.id` (UUID)
- ✅ `reporter_id` is optional (UUID FK)

#### task_markets table
- ⚠️ **NEEDS UPDATE** - `market_id` should be UUID FK to `markets` table (not VARCHAR)
- Current: stores market as VARCHAR
- New: stores market_id as UUID FK

#### task_deliverables table
- ⚠️ **NEEDS UPDATE** - Should be one-to-one with tasks (UNIQUE task_id)
- ⚠️ **NEEDS UPDATE** - Remove `deliverable_name` field (use task.deliverable_id)
- New purpose: Store count and variations data for analytics

### 3. Removed Tables
- ❌ `user_permissions` - Replaced with simple department-based access control

## Access Control Changes

### Old System (user_permissions)
```sql
-- Check if user has permission
SELECT permission FROM user_permissions 
WHERE user_id = ? AND department_id = ?
```

### New System (department-based)
```sql
-- Users see tasks for their department
SELECT * FROM tasks 
WHERE department_id = (SELECT department_id FROM users WHERE id = current_user_id)

-- Admins see all tasks
SELECT * FROM tasks -- no filter
```

### Rules
1. **Admin users** (`role = 'admin'`): Can see ALL tasks across all departments
2. **Regular users** (`role = 'user'`): Can only see tasks where `tasks.department_id = user.department_id`
3. Department is like occupation - designers see designer tasks, video editors see video tasks

## Backend Implementation Status

### ✅ Completed
1. **Migration file** (`migrate_new_schema.sql`)
   - Creates new tables (teams, years, markets)
   - Updates existing tables
   - Migrates data from old to new structure
   - Adds necessary FKs and constraints

2. **New Controllers**
   - `teamsController.js` - CRUD for teams
   - `yearsController.js` - CRUD for years, get-or-create endpoint
   - `marketsController.js` - CRUD for markets

3. **New Routes**
   - `/api/teams` - Teams management
   - `/api/years` - Years management
   - `/api/markets` - Markets management

4. **Updated Controllers**
   - ✅ `authController.js` - Returns department info instead of permissions
   - ✅ `usersController.js` - Requires department_id, includes dept info in responses
   - ✅ `monthsController.js` - Updated for years integration

### ⚠️ Needs Completion

1. **tasksController.js** - Critical updates needed:
   ```javascript
   // Current issues:
   // - deliverable_id not required
   // - department_id not set from user
   // - No department-based filtering for regular users
   // - market handling uses VARCHAR not UUID FK
   // - task_deliverables structure incorrect
   
   // Required changes:
   export const createTask = async (req, res, next) => {
     // 1. Require deliverable_id
     if (!deliverable_id) {
       return res.status(400).json({ error: 'deliverable_id is required' });
     }
     
     // 2. Set department_id from user
     const department_id = taskUserId_department_id; // Get from user
     
     // 3. Insert with department_id and deliverable_id
     INSERT INTO tasks (month_id, user_id, department_id, deliverable_id, ...)
     
     // 4. Handle markets as UUID FK
     for (const market_code of markets) {
       const market = await pool.query('SELECT id FROM markets WHERE code = $1', [market_code]);
       INSERT INTO task_markets (task_id, market_id) VALUES (?, market.id);
     }
     
     // 5. task_deliverables: one-to-one, no deliverable_name
     INSERT INTO task_deliverables (task_id, count, variations_enabled, variations_count)
   };
   
   export const getTasks = async (req, res, next) => {
     // 1. Add department-based filtering
     if (user.role === 'user') {
       query += ` AND t.department_id = $${paramCount++}`;
       params.push(user.department_id); // From JWT token
     }
     // Admin sees all tasks (no filter)
   };
   ```

2. **deliverablesController.js** - Update for department_id FK:
   ```javascript
   // deliverables.department is VARCHAR
   // Should be deliverables.department_id (UUID FK)
   ```

3. **reportersController.js** - Remove department_id if exists:
   ```javascript
   // reporters are standalone, no department_id
   ```

## Frontend Implementation Needed

### 1. API Clients
Create new API clients in `src/services/` or `src/features/`:
- `teamsApi.js` - Fetch teams
- `yearsApi.js` - Fetch years, create year if needed
- `marketsApi.js` - Fetch markets

### 2. Update Existing API Clients
- `usersApi.js` - Include department_id in user creation/update
- `tasksApi.js` - Include deliverable_id (required), handle new structure
- `monthsApi.js` - Use year_id (UUID) instead of year_id (string)

### 3. Context Updates
- `AuthContext.jsx` - Store user's department_id in context
- `AppDataContext.jsx` - Add teams, years, markets to global state

### 4. Form Updates
- User creation/edit forms - Add department selection (required)
- Task creation/edit forms - Add deliverable selection (required)
- Month creation forms - Select year from years list

### 5. Filtering Updates
- Tasks page - Filter by user's department (automatic for regular users)
- Analytics - Department-based filtering
- Months - Group by years

## Migration Steps

### Step 1: Run Migration
```bash
cd server
psql -U your_user -d your_database -f db/migrate_new_schema.sql
```

### Step 2: Verify Database
```sql
-- Check new tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
  AND tablename IN ('teams', 'years', 'markets');

-- Check users have department_id
SELECT COUNT(*) as users_with_dept FROM users WHERE department_id IS NOT NULL;

-- Check months use year_id FK
SELECT m.id, m.year_id, y.year FROM months m JOIN years y ON m.year_id = y.id LIMIT 5;
```

### Step 3: Update Remaining Controllers
- Complete tasksController updates
- Update deliverablesController for department_id FK
- Test all endpoints

### Step 4: Update Frontend
- Update API clients
- Update forms
- Update context providers
- Test user flows

### Step 5: Remove Deprecated Code
After everything works:
```sql
-- Drop user_permissions table
DROP TABLE IF EXISTS user_permissions CASCADE;

-- Remove any lingering VARCHAR fields
-- (already handled in migration)
```

## Testing Checklist

### Backend Tests
- [ ] Create team
- [ ] Create year for department
- [ ] Create month for year
- [ ] Create market
- [ ] Create user with department_id
- [ ] Create task with deliverable_id and department_id
- [ ] Regular user can only see their department's tasks
- [ ] Admin can see all tasks
- [ ] Task markets use UUID FK
- [ ] Task deliverables use one-to-one structure

### Frontend Tests
- [ ] User login shows department info
- [ ] User creation requires department
- [ ] Task creation requires deliverable
- [ ] Tasks filtered by user's department (regular users)
- [ ] Admins see all tasks
- [ ] Month selection shows years
- [ ] Market selection works
- [ ] Analytics work with new structure

## Key Benefits of New Schema

1. **Simplified Access Control**: No more complex permissions, just check user's department
2. **Referential Integrity**: All relationships use proper FK constraints
3. **Hierarchical Structure**: Clear team → dept → user → tasks flow
4. **Better Analytics**: Proper year management, department grouping
5. **Data Quality**: Required fields prevent incomplete records
6. **Scalability**: Normalized structure easier to extend

## Notes

- **Backward Compatibility**: Controllers return data in format expected by frontend where possible
- **WebSocket Events**: All create/update/delete operations emit WebSocket events for real-time updates
- **Error Handling**: All FK violations return helpful error messages
- **Soft Deletes**: Most tables support `is_active` for soft deletion

## Next Steps

1. ✅ Complete tasksController implementation (IN PROGRESS)
2. ⬜ Update deliverablesController
3. ⬜ Create frontend API clients
4. ⬜ Update frontend forms and components
5. ⬜ Test end-to-end workflows
6. ⬜ Run migration on production database

---

**Last Updated**: Implementation in progress  
**Status**: Backend 70% complete, Frontend 0% complete

