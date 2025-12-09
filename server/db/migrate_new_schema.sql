-- ============================================================================
-- MIGRATION: Complete Schema Upgrade to New Architecture
-- ============================================================================
-- This migration transforms the database from user_permissions-based access
-- to department-based access control with teams hierarchy
--
-- BREAKING CHANGES:
-- 1. user_permissions table will be dropped
-- 2. users.department_id becomes REQUIRED
-- 3. tasks.deliverable_id becomes REQUIRED
-- 4. New tables: teams, years, markets
-- 5. Access control now based on user.department_id
--
-- MIGRATION STEPS:
-- 1. Create new tables (teams, years, markets)
-- 2. Alter existing tables to add new fields
-- 3. Migrate data from old structure to new
-- 4. Drop deprecated tables and fields
-- 5. Update triggers and functions
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create New Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Teams Table (New - Top-level organizational units)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

-- ----------------------------------------------------------------------------
-- Years Table (New - Year management per department)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, year)
);

CREATE INDEX IF NOT EXISTS idx_years_department_id ON years(department_id);
CREATE INDEX IF NOT EXISTS idx_years_year ON years(year);
CREATE INDEX IF NOT EXISTS idx_years_is_active ON years(is_active);

-- ----------------------------------------------------------------------------
-- Markets Reference Table (New - Market codes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_markets_code ON markets(code);
CREATE INDEX IF NOT EXISTS idx_markets_is_active ON markets(is_active);

-- ============================================================================
-- STEP 2: Alter Existing Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Departments: Add team_id
-- ----------------------------------------------------------------------------
ALTER TABLE departments ADD COLUMN IF NOT EXISTS team_id UUID;

-- Will set foreign key after migrating data

-- ----------------------------------------------------------------------------
-- Users: Make department_id NOT NULL (if not already)
-- ----------------------------------------------------------------------------
-- First, ensure all users have a department_id
DO $$
DECLARE
    default_dept_id UUID;
BEGIN
    -- Get default 'design' department
    SELECT id INTO default_dept_id 
    FROM departments 
    WHERE name = 'design' AND is_active = true 
    LIMIT 1;
    
    -- If no default department, create one
    IF default_dept_id IS NULL THEN
        INSERT INTO departments (name, display_name, description, is_active)
        VALUES ('design', 'Design Department', 'Default design department', true)
        RETURNING id INTO default_dept_id;
    END IF;
    
    -- Update users without department_id
    UPDATE users 
    SET department_id = default_dept_id 
    WHERE department_id IS NULL;
END $$;

-- Now make it NOT NULL
ALTER TABLE users ALTER COLUMN department_id SET NOT NULL;

-- ----------------------------------------------------------------------------
-- Months: Add year_id and update structure
-- ----------------------------------------------------------------------------
-- Add year_id column
ALTER TABLE months ADD COLUMN IF NOT EXISTS year_id UUID;

-- Will populate year_id after creating years

-- ============================================================================
-- STEP 3: Migrate Data
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Create default team for existing departments
-- ----------------------------------------------------------------------------
INSERT INTO teams (name, display_name, description, is_active)
VALUES ('default', 'Default Team', 'Default team for existing departments', true)
ON CONFLICT (name) DO NOTHING;

-- Update departments to link to default team
DO $$
DECLARE
    default_team_id UUID;
BEGIN
    SELECT id INTO default_team_id FROM teams WHERE name = 'default' LIMIT 1;
    
    UPDATE departments 
    SET team_id = default_team_id 
    WHERE team_id IS NULL;
END $$;

-- Now add foreign key constraint
ALTER TABLE departments 
    ADD CONSTRAINT fk_departments_team_id 
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT;

ALTER TABLE departments ALTER COLUMN team_id SET NOT NULL;

-- ----------------------------------------------------------------------------
-- Create years from existing months data
-- ----------------------------------------------------------------------------
INSERT INTO years (department_id, year, is_active)
SELECT DISTINCT 
    m.department_id,
    m.year,
    true
FROM months m
WHERE m.year IS NOT NULL 
  AND m.department_id IS NOT NULL
ON CONFLICT (department_id, year) DO NOTHING;

-- Update months to link to years
UPDATE months m
SET year_id = y.id
FROM years y
WHERE m.year = y.year 
  AND m.department_id = y.department_id
  AND m.year_id IS NULL;

-- Make year_id NOT NULL and add foreign key
ALTER TABLE months ALTER COLUMN year_id SET NOT NULL;
ALTER TABLE months 
    ADD CONSTRAINT fk_months_year_id 
    FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE RESTRICT;

-- ----------------------------------------------------------------------------
-- Migrate markets from task_markets
-- ----------------------------------------------------------------------------
-- Extract unique markets from task_markets (if it has market as VARCHAR)
-- Note: This depends on your current task_markets structure
-- If task_markets.market is already a UUID FK, skip this

-- Check if task_markets.market is VARCHAR
DO $$
BEGIN
    -- Insert unique markets
    INSERT INTO markets (code, name, is_active)
    SELECT DISTINCT 
        market as code,
        UPPER(market) as name,
        true
    FROM task_markets
    WHERE market IS NOT NULL
    ON CONFLICT (code) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'task_markets might already use UUID references';
END $$;

-- ----------------------------------------------------------------------------
-- Tasks: Add deliverable_id if missing
-- ----------------------------------------------------------------------------
-- This assumes you have deliverables data
-- For tasks without deliverable_id, set to a default one
DO $$
DECLARE
    default_deliverable_id UUID;
BEGIN
    -- Get or create a default deliverable
    SELECT id INTO default_deliverable_id 
    FROM deliverables 
    WHERE name = 'General Task' 
    LIMIT 1;
    
    IF default_deliverable_id IS NULL THEN
        INSERT INTO deliverables (name, description, department_id, time_per_unit, time_unit)
        SELECT 
            'General Task',
            'Default deliverable for migrated tasks',
            id,
            1.0,
            'hr'
        FROM departments 
        WHERE name = 'design' 
        LIMIT 1
        RETURNING id INTO default_deliverable_id;
    END IF;
    
    -- Add deliverable_id column if not exists
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deliverable_id UUID;
    
    -- Update tasks without deliverable_id
    UPDATE tasks 
    SET deliverable_id = default_deliverable_id 
    WHERE deliverable_id IS NULL;
    
    -- Make it NOT NULL and add FK
    ALTER TABLE tasks ALTER COLUMN deliverable_id SET NOT NULL;
    ALTER TABLE tasks 
        ADD CONSTRAINT fk_tasks_deliverable_id 
        FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE RESTRICT;
END $$;

-- ============================================================================
-- STEP 4: Update Task Markets to use FK (if needed)
-- ============================================================================
DO $$
BEGIN
    -- Check if task_markets needs migration
    -- This adds market_id column if it doesn't exist
    ALTER TABLE task_markets ADD COLUMN IF NOT EXISTS market_id UUID;
    
    -- Migrate from VARCHAR market to UUID market_id
    UPDATE task_markets tm
    SET market_id = m.id
    FROM markets m
    WHERE tm.market = m.code 
      AND tm.market_id IS NULL;
    
    -- Drop old market column if it exists
    ALTER TABLE task_markets DROP COLUMN IF EXISTS market;
    
    -- Add foreign key
    ALTER TABLE task_markets 
        ADD CONSTRAINT fk_task_markets_market_id 
        FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE RESTRICT;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'task_markets might already be updated';
END $$;

-- ============================================================================
-- STEP 5: Update Task Deliverables Structure
-- ============================================================================
-- Make task_deliverables.task_id UNIQUE (one deliverable record per task)
DO $$
BEGIN
    -- Create unique index if not exists
    CREATE UNIQUE INDEX IF NOT EXISTS idx_task_deliverables_task_id_unique 
    ON task_deliverables(task_id);
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Unique constraint might already exist';
END $$;

-- Remove deliverable_name column as it's redundant (use task.deliverable_id)
ALTER TABLE task_deliverables DROP COLUMN IF EXISTS deliverable_name;

-- ============================================================================
-- STEP 6: Update Triggers
-- ============================================================================

-- Drop old auto-create triggers that depend on user_permissions
DROP TRIGGER IF EXISTS trigger_auto_create_default_permissions ON users;
DROP FUNCTION IF EXISTS auto_create_default_permissions();

-- Update auto_create_team_days_off to use users.department_id directly
CREATE OR REPLACE FUNCTION auto_create_team_days_off()
RETURNS TRIGGER AS $$
BEGIN
    -- Create team_days_off record for the new user using their department_id
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
        NEW.department_id,  -- Use user's department_id directly
        0,
        0,
        0,
        0,
        1.75,
        NEW.created_by_id
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for years.updated_at
CREATE TRIGGER update_years_updated_at BEFORE UPDATE ON years
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Drop Deprecated Tables (CAREFUL!)
-- ============================================================================
-- Only drop user_permissions after confirming all code is updated
-- UNCOMMENT THIS AFTER UPDATING ALL APPLICATION CODE:
-- DROP TABLE IF EXISTS user_permissions CASCADE;

-- ============================================================================
-- STEP 8: Insert Sample Data for New Tables
-- ============================================================================

-- Insert common markets
INSERT INTO markets (code, name, is_active) VALUES
    ('ro', 'Romania', true),
    ('com', 'International', true),
    ('uk', 'United Kingdom', true),
    ('de', 'Germany', true),
    ('it', 'Italy', true),
    ('br', 'Brazil', true),
    ('mx', 'Mexico', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- STEP 9: Add Comments for Documentation
-- ============================================================================
COMMENT ON TABLE teams IS 'Top-level organizational units (e.g., racheta)';
COMMENT ON TABLE years IS 'Year management per department for organizing months and tasks';
COMMENT ON TABLE markets IS 'Reference table for market codes used in task_markets';
COMMENT ON COLUMN users.department_id IS 'User''s department (occupation) - determines which tasks they can see';
COMMENT ON COLUMN tasks.deliverable_id IS 'Required deliverable for this task';
COMMENT ON COLUMN tasks.department_id IS 'Department from user - set when task is created';

-- ============================================================================
-- FINAL NOTES
-- ============================================================================
-- After running this migration:
-- 1. Update all controllers to use department-based filtering
-- 2. Update authController to remove user_permissions logic
-- 3. Update frontend to work with new structure
-- 4. Test thoroughly before dropping user_permissions table
-- ============================================================================

COMMIT;

