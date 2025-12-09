# Automatic User Links - Database Triggers

## Overview
When a user is created, the database now **automatically** creates related records to ensure proper linking and access control.

## What Gets Created Automatically

### 1. **team_days_off Record**
- Automatically created when a user is inserted
- Links to the default 'design' department
- Initialized with:
  - `base_days`: 0
  - `days_off`: 0
  - `days_remaining`: 0
  - `days_total`: 0
  - `monthly_accrual`: 1.75

### 2. **Default user_permissions**
- Automatically created for the default 'design' department
- Default permissions granted:
  - `view_tasks` - Can view tasks
  - `create_tasks` - Can create tasks
  - `update_tasks` - Can update tasks
  - `view_analytics` - Can view analytics

## Database Triggers

Two triggers are automatically executed after a user is created:

### Trigger 1: `trigger_auto_create_team_days_off`
- **When**: After INSERT on `users` table
- **What**: Creates a `team_days_off` record
- **Function**: `auto_create_team_days_off()`

### Trigger 2: `trigger_auto_create_default_permissions`
- **When**: After INSERT on `users` table
- **What**: Creates default `user_permissions` for the 'design' department
- **Function**: `auto_create_default_permissions()`

## Implementation Files

### 1. Database Schema (`server/db/init.sql`)
The triggers are included in the main schema file and will be created automatically when the database is initialized.

### 2. Migration File (`server/db/migrate_auto_user_links.sql`)
Standalone migration file for existing databases that need to add these triggers.

### 3. Updated Permissions Utility (`server/src/utils/permissions.js`)
- Updated `setUserPermissions()` to support `department_id`
- Updated `fetchUserPermissions()` to support department filtering
- Maintains backward compatibility with existing code

## Usage

### Creating a User (No Changes Needed)
The existing user creation code works as-is. The triggers handle everything automatically:

```javascript
// In usersController.js - no changes needed
const result = await pool.query(
  `INSERT INTO users (email, name, role, password_hash, ...)
   VALUES ($1, $2, $3, $4, ...)
   RETURNING id, ...`,
  [email, name, role, passwordHash, ...]
);

// Triggers automatically create:
// 1. team_days_off record
// 2. Default user_permissions for 'design' department
```

### Setting Custom Permissions
You can still set custom permissions, and they will include `department_id`:

```javascript
// Simple format (uses default 'design' department)
await setUserPermissions(userId, ['view_tasks', 'create_tasks'], pool);

// Advanced format (specify department)
await setUserPermissions(userId, [
  { permission: 'view_tasks', department_id: designDeptId },
  { permission: 'manage_users', department_id: adminDeptId }
], pool, designDeptId);
```

## Database Structure

### Before (Manual)
```
User Created → Manual steps required:
  1. Create team_days_off record
  2. Create user_permissions records
  3. Link to departments
```

### After (Automatic)
```
User Created → Triggers automatically:
  1. ✅ Create team_days_off record (linked to 'design' department)
  2. ✅ Create user_permissions (4 default permissions for 'design')
  3. ✅ All links established automatically
```

## Benefits

1. **Consistency**: Every user gets the same initial setup
2. **No Missing Links**: Prevents orphaned users without permissions or team_days_off
3. **Simplified Code**: No need to manually create these records in application code
4. **Data Integrity**: Ensures all users have proper relationships from the start

## Customization

### Changing Default Permissions
Edit the `default_permissions` array in `auto_create_default_permissions()` function:

```sql
default_permissions TEXT[] := ARRAY[
    'view_tasks',
    'create_tasks',
    'update_tasks',
    'view_analytics',
    'your_custom_permission'  -- Add more here
];
```

### Changing Default Department
The triggers use the 'design' department by default. To change this, modify the WHERE clause:

```sql
SELECT id INTO default_dept_id 
FROM departments 
WHERE name = 'your_department_name' AND is_active = true 
LIMIT 1;
```

## Migration Instructions

### For New Databases
The triggers are included in `init.sql`, so they'll be created automatically.

### For Existing Databases
Run the migration file:

```bash
psql -U your_user -d your_database -f server/db/migrate_auto_user_links.sql
```

Or use the migration file directly in your database client.

## Testing

After implementing, test by creating a new user:

```sql
-- Create a test user
INSERT INTO users (email, name, role, password_hash, created_by_id)
VALUES ('test@example.com', 'Test User', 'user', 'hashed_password', NULL)
RETURNING id;

-- Check if team_days_off was created
SELECT * FROM team_days_off WHERE user_id = '<user_id>';

-- Check if permissions were created
SELECT * FROM user_permissions WHERE user_id = '<user_id>';
```

Both queries should return records automatically created by the triggers.

## Notes

- Triggers use `ON CONFLICT DO NOTHING` to prevent errors if records already exist
- The default department must exist and be active for triggers to work
- Admins can still manually add/remove permissions after user creation
- The triggers only run on INSERT, not UPDATE

---

**Status**: ✅ Implemented and ready to use


