-- Migration: Auto-create user links (team_days_off and default permissions)
-- This ensures that when a user is created, they automatically get:
-- 1. A team_days_off record
-- 2. Default user_permissions for the default 'design' department

-- ============================================================================
-- FUNCTION: Auto-create team_days_off when user is created
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_create_team_days_off()
RETURNS TRIGGER AS $$
DECLARE
    default_dept_id UUID;
BEGIN
    -- Get the default 'design' department ID
    SELECT id INTO default_dept_id 
    FROM departments 
    WHERE name = 'design' AND is_active = true 
    LIMIT 1;
    
    -- Create team_days_off record for the new user
    INSERT INTO team_days_off (
        user_id,
        department_id,
        base_days,
        days_off,
        days_remaining,
        days_total,
        monthly_accrual,
        created_by_id
    ) VALUES (
        NEW.id,
        default_dept_id,
        0,
        0,
        0,
        0,
        1.75,
        NEW.created_by_id
    )
    ON CONFLICT (user_id) DO NOTHING; -- Prevent errors if record already exists
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Auto-create default user_permissions when user is created
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_create_default_permissions()
RETURNS TRIGGER AS $$
DECLARE
    default_dept_id UUID;
    default_permissions TEXT[] := ARRAY[
        'view_tasks',
        'create_tasks',
        'update_tasks',
        'view_analytics'
    ];
    perm TEXT;
BEGIN
    -- Get the default 'design' department ID
    SELECT id INTO default_dept_id 
    FROM departments 
    WHERE name = 'design' AND is_active = true 
    LIMIT 1;
    
    -- Only create default permissions if department exists
    IF default_dept_id IS NOT NULL THEN
        -- Create default permissions for the default department
        FOREACH perm IN ARRAY default_permissions
        LOOP
            INSERT INTO user_permissions (
                user_id,
                department_id,
                permission
            ) VALUES (
                NEW.id,
                default_dept_id,
                perm
            )
            ON CONFLICT (user_id, department_id, permission) DO NOTHING;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS: Execute after user creation
-- ============================================================================

-- Trigger to auto-create team_days_off
DROP TRIGGER IF EXISTS trigger_auto_create_team_days_off ON users;
CREATE TRIGGER trigger_auto_create_team_days_off
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_team_days_off();

-- Trigger to auto-create default permissions
DROP TRIGGER IF EXISTS trigger_auto_create_default_permissions ON users;
CREATE TRIGGER trigger_auto_create_default_permissions
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_default_permissions();

-- ============================================================================
-- NOTES:
-- ============================================================================
-- These triggers will automatically:
-- 1. Create a team_days_off record when a user is created
-- 2. Create default user_permissions for the 'design' department
--
-- The default permissions are:
--   - view_tasks
--   - create_tasks
--   - update_tasks
--   - view_analytics
--
-- Admins can later add more permissions or departments as needed.
-- The triggers use ON CONFLICT DO NOTHING to prevent errors if records
-- already exist (useful for manual inserts or migrations).



