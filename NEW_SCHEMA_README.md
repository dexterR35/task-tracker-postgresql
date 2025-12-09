# Task Tracker PostgreSQL - New Schema Implementation

## Overview

This project has been upgraded with a new database schema based on `mydata_sqlflow.sql`. The new schema simplifies access control, improves data integrity, and provides better hierarchical organization.

## 📋 What's Been Completed

### ✅ Database Schema
- **Migration file** created: `server/db/migrate_new_schema.sql`
- New tables: `teams`, `years`, `markets`
- Updated tables: `users`, `departments`, `months`, `tasks`
- Removed: `user_permissions` table (simplified access control)

### ✅ Backend Controllers
- **New**: `teamsController.js`, `yearsController.js`, `marketsController.js`
- **Updated**: `authController.js`, `usersController.js`, `monthsController.js`
- **Documented**: `tasksController.js` (see TASKS_CONTROLLER_UPDATE.md)

### ✅ Backend Routes
- `/api/teams` - Team management
- `/api/years` - Year management  
- `/api/markets` - Market management
- All routes integrated in `server/src/routes/index.js`

### ✅ Documentation
- `IMPLEMENTATION_SUMMARY.md` - Complete overview of changes
- `TASKS_CONTROLLER_UPDATE.md` - Detailed tasks controller guide
- `DATABASE_RELATIONSHIP_FLOW.md` - Already exists
- `AUTO_USER_LINKS.md` - Already exists

## 🔄 Key Changes

### 1. Access Control Simplified
**Before:**
```javascript
// Check user_permissions table
const permissions = await fetchUserPermissions(userId, pool);
if (!permissions.includes('view_tasks')) { /* deny */ }
```

**After:**
```javascript
// Simple department-based check
if (user.role === 'user') {
  // Filter by user's department
  WHERE tasks.department_id = user.department_id
}
// Admin sees all tasks (no filter)
```

### 2. Hierarchical Structure
```
teams (e.g., 'racheta')
  └── departments (e.g., 'design', 'video', 'dev')
      ├── users (user.department_id = 'design')
      └── years (2024, 2025)
          └── months (1-12)
              └── tasks
```

### 3. Required Fields
- **users.department_id** - REQUIRED (determines task access)
- **tasks.deliverable_id** - REQUIRED (UUID FK to deliverables)
- **tasks.department_id** - Set from user's department when task created
- **months.year_id** - UUID FK to years table (not string)

### 4. Improved Relationships
- Markets: UUID FK instead of VARCHAR codes
- Task deliverables: One-to-one with tasks
- Proper foreign key constraints throughout

## 🚀 Getting Started

### Step 1: Run Migration

```bash
# Backup your database first!
pg_dump -U your_user your_database > backup.sql

# Run migration
cd server
psql -U your_user -d your_database -f db/migrate_new_schema.sql
```

### Step 2: Verify Migration

```bash
psql -U your_user -d your_database
```

```sql
-- Check new tables exist
\dt teams
\dt years  
\dt markets

-- Check users have department_id
SELECT COUNT(*) FROM users WHERE department_id IS NOT NULL;

-- Check months reference years
SELECT m.id, m.month, y.year 
FROM months m 
JOIN years y ON m.year_id = y.id 
LIMIT 5;

-- Check teams and departments
SELECT d.name as dept, t.name as team 
FROM departments d 
JOIN teams t ON d.team_id = t.id;
```

### Step 3: Insert Sample Data

```sql
-- Create a team
INSERT INTO teams (name, display_name, is_active) 
VALUES ('racheta', 'Racheta Team', true);

-- Check department has team_id
SELECT * FROM departments;

-- Create markets
INSERT INTO markets (code, name) VALUES
  ('ro', 'Romania'),
  ('com', 'International'),
  ('uk', 'United Kingdom'),
  ('de', 'Germany');

-- Create year for current year
INSERT INTO years (department_id, year, is_active)
SELECT id, 2024, true FROM departments WHERE name = 'design';
```

### Step 4: Test API Endpoints

```bash
# Start server
cd server
npm run dev

# Test new endpoints
curl http://localhost:5000/api/teams
curl http://localhost:5000/api/years
curl http://localhost:5000/api/markets

# Test updated endpoints
curl http://localhost:5000/api/users
curl http://localhost:5000/api/months
```

## 📝 Implementation Status

### Backend: ~90% Complete

| Component | Status | Notes |
|-----------|--------|-------|
| Database schema | ✅ | Migration file ready |
| Teams controller | ✅ | Full CRUD |
| Years controller | ✅ | Full CRUD + get-or-create |
| Markets controller | ✅ | Full CRUD |
| Auth controller | ✅ | Returns department info |
| Users controller | ✅ | Requires department_id |
| Months controller | ✅ | Uses years table |
| Tasks controller | ⚠️ | Needs updates (see guide) |
| Deliverables controller | ⚠️ | Needs department_id FK |
| Routes | ✅ | All routes added |

### Frontend: 0% Complete

| Component | Status | Next Steps |
|-----------|--------|------------|
| API clients | ⬜ | Create teams/years/markets APIs |
| User forms | ⬜ | Add department selector (required) |
| Task forms | ⬜ | Add deliverable selector (required) |
| Auth context | ⬜ | Store user.department_id |
| Filtering | ⬜ | Auto-filter by dept for regular users |
| Analytics | ⬜ | Update for new structure |

## 🔨 Next Steps

### Critical (Must Do First)

1. **Complete Tasks Controller** ⚠️
   - See `TASKS_CONTROLLER_UPDATE.md` for detailed guide
   - Add `deliverable_id` requirement
   - Add `department_id` from user
   - Update market handling (UUID FK)
   - Update task_deliverables (one-to-one)

2. **Update Deliverables Controller**
   - Change `department` VARCHAR to `department_id` UUID FK
   - Add validation for active departments

3. **Test Backend Thoroughly**
   - Create users with departments
   - Create tasks with deliverables
   - Verify regular users only see their dept tasks
   - Verify admin sees all tasks

### Frontend Implementation

4. **Create API Clients**
   ```javascript
   // src/features/teams/teamsApi.js
   // src/features/years/yearsApi.js
   // src/features/markets/marketsApi.js
   ```

5. **Update Existing API Clients**
   ```javascript
   // src/features/users/usersApi.js - add department_id
   // src/features/tasks/tasksApi.js - add deliverable_id
   // src/features/months/monthsApi.js - use year_id UUID
   ```

6. **Update Context Providers**
   ```javascript
   // src/context/AuthContext.jsx - add user.department_id
   // src/context/AppDataContext.jsx - add teams, years, markets
   ```

7. **Update Forms**
   - User create/edit: department selector (required)
   - Task create/edit: deliverable selector (required)
   - Month create: year selector

8. **Update Filtering**
   - Regular users: auto-filter by department
   - Admin users: show department filter
   - All: filter by years, months

## 📖 Documentation

- **IMPLEMENTATION_SUMMARY.md** - Complete overview
- **TASKS_CONTROLLER_UPDATE.md** - Tasks controller guide
- **DATABASE_RELATIONSHIP_FLOW.md** - Schema relationships
- **AUTO_USER_LINKS.md** - Auto-trigger documentation

## 🧪 Testing

### Backend Tests

```javascript
// Test user creation with department
POST /api/users
{
  "email": "designer@example.com",
  "name": "Designer User",
  "password": "password123",
  "department_id": "<uuid>", // REQUIRED
  "role": "user"
}

// Test task creation with deliverable
POST /api/tasks
{
  "monthId": "<uuid>",
  "deliverable_id": "<uuid>", // REQUIRED
  "dataTask": {
    "taskName": "Logo Design",
    "markets": ["ro", "com"],
    // ...
  }
}

// Test department filtering (as regular user)
GET /api/tasks
// Should only return tasks where department_id = user.department_id

// Test department filtering (as admin)
GET /api/tasks
// Should return ALL tasks
```

### Frontend Tests

1. **User Creation Flow**
   - Form requires department selection
   - Cannot submit without department
   - User saved with department_id

2. **Task Creation Flow**
   - Form requires deliverable selection
   - Cannot submit without deliverable
   - Task saved with deliverable_id and department_id

3. **Task Viewing**
   - Regular user sees only their department's tasks
   - Admin sees all tasks
   - Department filter works (admin only)

4. **Month Management**
   - Months grouped by years
   - Year selection works
   - Month creation requires year

## ⚠️ Breaking Changes

1. **User Creation**: `department_id` now required
2. **Task Creation**: `deliverable_id` now required
3. **Months**: `year_id` is UUID FK (not string)
4. **Access Control**: No more `user_permissions` table
5. **Markets**: Now UUID FK (not VARCHAR codes)

## 🐛 Troubleshooting

### "department_id cannot be null"
- Solution: All users must have a department
- Migration sets default 'design' department for existing users

### "deliverable_id cannot be null"  
- Solution: All tasks must have a deliverable
- Migration creates default "General Task" deliverable

### "year_id foreign key violation"
- Solution: Create year before creating month
- Use `/api/years/get-or-create` endpoint

### Regular users see no tasks
- Cause: No tasks for their department
- Solution: Create tasks with correct department_id
- Or: Change user's department_id to match existing tasks

## 💡 Best Practices

1. **Always create year before month**
   ```javascript
   await yearsApi.getOrCreateYear({ department_id, year: 2024 });
   ```

2. **Set department_id from user when creating tasks**
   ```javascript
   task.department_id = task_user.department_id;
   ```

3. **Filter by department for regular users**
   ```javascript
   if (user.role === 'user') {
     filters.department_id = user.department_id;
   }
   ```

4. **Use get-or-create for years**
   ```javascript
   const year = await yearsApi.getOrCreateYear({ department_id, year });
   const month = await monthsApi.create({ year_id: year.id, month: 1 });
   ```

## 📞 Support

For questions or issues:
1. Check documentation files
2. Review migration file comments
3. Check `TASKS_CONTROLLER_UPDATE.md` for detailed examples

## 🎯 Success Criteria

Backend is complete when:
- [ ] Migration runs successfully
- [ ] All new controllers work
- [ ] Tasks controller updated
- [ ] Users require department_id
- [ ] Tasks require deliverable_id
- [ ] Regular users see only their dept tasks
- [ ] Admin sees all tasks

Frontend is complete when:
- [ ] User forms require department
- [ ] Task forms require deliverable
- [ ] Department filtering works
- [ ] Years/months integration works
- [ ] Markets selection works
- [ ] All existing features still work

---

**Status**: Backend ~90% complete, Frontend not started  
**Priority**: Complete tasks controller, then start frontend  
**Estimated Time**: 
- Backend completion: 4-6 hours
- Frontend: 8-12 hours
- Testing: 4-6 hours

Good luck! 🚀

