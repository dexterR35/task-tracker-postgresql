-- Task Tracker Database Schema
-- PostgreSQL initialization script
-- Organized by dependency order for proper relational structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TIER 1: CORE FOUNDATION TABLES
-- ============================================================================

-- Users table (BASE TABLE - no dependencies)
-- This must be created first as all other tables reference it
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    password_hash VARCHAR(255) NOT NULL,
    color_set VARCHAR(7) CHECK (color_set IS NULL OR color_set ~* '^#[0-9A-Fa-f]{6}$'),
    is_active BOOLEAN DEFAULT true,
    occupation VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID, -- Self-referencing FK (added after table creation)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add self-referencing FK constraint (users can be created by other users)
ALTER TABLE users 
    ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by_id) 
    REFERENCES users(id) ON DELETE SET NULL;

-- User indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_by_id ON users(created_by_id);

-- ============================================================================
-- TIER 2: REFERENCE DATA TABLES (BASE - no dependencies)
-- ============================================================================

-- Departments table (BASE REFERENCE - no dependencies)
-- Base structure: department/design/year/month/taskdata/idtask
-- Multiple departments supported (design, marketing, development, etc.)
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'design', 'marketing', 'development'
    display_name VARCHAR(255), -- e.g., 'Design Department'
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);

-- ============================================================================
-- TIER 3: USER-RELATED TABLES (depend on users and departments)
-- ============================================================================

-- User permissions table (CENTRAL RELATIONSHIP POINT)
-- This is the gateway that connects users to departments and controls access
-- Structure: users.id (UUID) → user_permissions.user_id → departments.id
-- Logic: Check user → check department (is_active) → check user_permissions → allow access
-- From user_permissions, relations to months and tasks start
-- UUID from user_permissions proves user can CRUD and see data
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- References users.id (UUID)
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,  -- References departments.id (check is_active)
    permission VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, department_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_department_id ON user_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_dept ON user_permissions(user_id, department_id);

-- ============================================================================
-- TIER 4: DEPARTMENT-RELATED TABLES (depend on departments only)
-- ============================================================================
-- NO direct relations from users table - all relations go through departments
-- These tables link directly to departments (outside user_permissions)

-- Months table - links to departments
-- Structure: department/year/month
-- Access controlled via user_permissions, but table links to departments
CREATE TABLE months (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_id VARCHAR(50) UNIQUE NOT NULL, -- Format: YYYY-MM (business key)
    year_id VARCHAR(10) NOT NULL, -- Format: YYYY
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,  -- Links to departments.id
    status VARCHAR(50) DEFAULT 'active',
    month_name VARCHAR(100),
    start_date DATE,
    end_date DATE,
    days_in_month INTEGER,
    board_id VARCHAR(255),
    month INTEGER, -- 1-12
    year INTEGER, -- YYYY
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_months_month_id ON months(month_id);
CREATE INDEX IF NOT EXISTS idx_months_year_id ON months(year_id);
CREATE INDEX IF NOT EXISTS idx_months_department_id ON months(department_id);
CREATE INDEX IF NOT EXISTS idx_months_status ON months(status);
CREATE INDEX IF NOT EXISTS idx_months_start_date ON months(start_date);
CREATE INDEX IF NOT EXISTS idx_months_end_date ON months(end_date);
CREATE INDEX IF NOT EXISTS idx_months_year_month ON months(year, month);
-- Composite index for common query: department/year/month
CREATE INDEX IF NOT EXISTS idx_months_dept_year_month ON months(department_id, year, month);

-- Reporters table - links to departments
-- Used for task assignment and filtering
CREATE TABLE reporters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,  -- Links to departments.id
    channel VARCHAR(100),
    channel_name VARCHAR(100),
    country VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reporters_name ON reporters(name);
CREATE INDEX IF NOT EXISTS idx_reporters_department_id ON reporters(department_id);
CREATE INDEX IF NOT EXISTS idx_reporters_country ON reporters(country);

-- Deliverables table - links to departments
-- Template definitions for deliverables used in tasks
CREATE TABLE deliverables (
    id VARCHAR(255) PRIMARY KEY, -- Custom ID format: deliverable_timestamp
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,  -- Links to departments.id
    time_per_unit DECIMAL(10, 2),
    time_unit VARCHAR(10) DEFAULT 'hr',
    variations_time DECIMAL(10, 2),
    variations_time_unit VARCHAR(10) DEFAULT 'min',
    requires_quantity BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deliverables_name ON deliverables(name);
CREATE INDEX IF NOT EXISTS idx_deliverables_department_id ON deliverables(department_id);

-- Team days off table - links to departments
-- One record per user with calculated fields
-- Can be department-specific
CREATE TABLE team_days_off (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE NO ACTION,  -- For user reference, but access via user_permissions
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,  -- Links to departments.id
    base_days DECIMAL(10, 2) DEFAULT 0,
    days_off DECIMAL(10, 2) DEFAULT 0,
    days_remaining DECIMAL(10, 2) DEFAULT 0,
    days_total DECIMAL(10, 2) DEFAULT 0,
    monthly_accrual DECIMAL(10, 2) DEFAULT 1.75,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_team_days_off_user_id ON team_days_off(user_id);
CREATE INDEX IF NOT EXISTS idx_team_days_off_department_id ON team_days_off(department_id);

-- Team days off dates table (depends on team_days_off)
CREATE TABLE team_days_off_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_days_off_id UUID NOT NULL REFERENCES team_days_off(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_string VARCHAR(50) NOT NULL,
    day INTEGER,
    month INTEGER,
    year INTEGER,
    timestamp BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_days_off_id, date_string)
);

CREATE INDEX IF NOT EXISTS idx_team_days_off_dates_team_id ON team_days_off_dates(team_days_off_id);
CREATE INDEX IF NOT EXISTS idx_team_days_off_dates_user_id ON team_days_off_dates(user_id);
CREATE INDEX IF NOT EXISTS idx_team_days_off_dates_date_string ON team_days_off_dates(date_string);
CREATE INDEX IF NOT EXISTS idx_team_days_off_dates_year_month ON team_days_off_dates(year, month);

-- ============================================================================
-- TIER 5: MAIN DATA TABLES (access controlled via user_permissions)
-- ============================================================================

-- Tasks table - ALL RELATIONS START FROM user_permissions
-- Core task records with relationships
-- Structure: department/year/month/taskdata/idtask
-- Access: Check user_permissions (user_id + department_id) → then access tasks
-- Relations: user_permissions.user_id → tasks.user_id, user_permissions.department_id → tasks.department_id
-- NO direct relation from users table - only through user_permissions
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Foreign key relationships (all relations start from user_permissions)
    month_id VARCHAR(50) NOT NULL REFERENCES months(month_id) ON DELETE CASCADE,  -- Access via user_permissions → months.department_id
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE NO ACTION,  -- From user_permissions.user_id (NOT directly from users)
    reporter_id UUID REFERENCES reporters(id) ON DELETE SET NULL,  -- Links to reporters (which links to departments)
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,  -- Must match user_permissions.department_id for access
    -- Task identification
    board_id VARCHAR(255),
    task_name VARCHAR(255),
    products VARCHAR(255),
    -- Time tracking
    time_in_hours DECIMAL(10, 2),
    start_date DATE,
    end_date DATE,
    observations TEXT,
    -- Boolean flags
    is_vip BOOLEAN DEFAULT false,
    reworked BOOLEAN DEFAULT false,
    use_shutterstock BOOLEAN DEFAULT false,
    reporter_name VARCHAR(255), -- Denormalized for quick access
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Auditing
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Task indexes for filtering and queries
CREATE INDEX IF NOT EXISTS idx_tasks_month_id ON tasks(month_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reporter_id ON tasks(reporter_id);
CREATE INDEX IF NOT EXISTS idx_tasks_department_id ON tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_tasks_end_date ON tasks(end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_vip ON tasks(is_vip);
CREATE INDEX IF NOT EXISTS idx_tasks_reworked ON tasks(reworked);
-- Composite indexes for common query patterns
-- Structure: department/year/month/taskdata/idtask
CREATE INDEX IF NOT EXISTS idx_tasks_month_user ON tasks(month_id, user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_month_reporter ON tasks(month_id, reporter_id);
CREATE INDEX IF NOT EXISTS idx_tasks_month_department ON tasks(month_id, department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_tasks_department_user ON tasks(department_id, user_id);

-- ============================================================================
-- TIER 6: TASK-RELATED JUNCTION TABLES (depend on tasks)
-- ============================================================================

-- Task Markets (many-to-many: tasks ↔ markets)
CREATE TABLE task_markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    market VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, market)
);

CREATE INDEX IF NOT EXISTS idx_task_markets_task_id ON task_markets(task_id);
CREATE INDEX IF NOT EXISTS idx_task_markets_market ON task_markets(market);

-- Task Departments (many-to-many: tasks ↔ departments)
CREATE TABLE task_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, department)
);

CREATE INDEX IF NOT EXISTS idx_task_departments_task_id ON task_departments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_departments_department ON task_departments(department);

-- Task Deliverables (one-to-many: tasks → deliverables)
CREATE TABLE task_deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    deliverable_name VARCHAR(255) NOT NULL,
    count INTEGER DEFAULT 1,
    variations_enabled BOOLEAN DEFAULT false,
    variations_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_deliverables_task_id ON task_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deliverables_name ON task_deliverables(deliverable_name);

-- Task AI Usage (one-to-many: tasks → AI usage records)
CREATE TABLE task_ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    ai_models TEXT[], -- Array of AI model names
    ai_time DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_ai_usage_task_id ON task_ai_usage(task_id);

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_months_updated_at BEFORE UPDATE ON months
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reporters_updated_at BEFORE UPDATE ON reporters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliverables_updated_at BEFORE UPDATE ON deliverables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_days_off_updated_at BEFORE UPDATE ON team_days_off
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA: Default Department
-- ============================================================================

-- Insert default 'design' department (after all tables are created)
-- This is the base department for the hierarchy: department/design/year/month/taskdata/idtask
INSERT INTO departments (name, display_name, description, is_active) 
VALUES ('design', 'Design Department', 'Default design department', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- RELATIONSHIP SUMMARY
-- ============================================================================
-- 
-- DEPENDENCY CHAIN (with permission logic):
-- 1. users (base table)
-- 2. departments (base reference - 'design' default)
-- 3. user_permissions → users, departments (CHECK: user has permission for department)
-- 4. team_days_off → users, departments (after departments)
-- 5. team_days_off_dates → team_days_off, users
-- 6. months → departments, users (structure: department/year/month)
-- 7. reporters → departments, users
-- 8. deliverables → departments, users
-- 9. tasks → users, months, reporters, departments (structure: department/year/month/taskdata/idtask)
-- 10. task_markets → tasks
-- 11. task_departments → tasks (many-to-many for multiple departments per task)
-- 12. task_deliverables → tasks
-- 13. task_ai_usage → tasks
--
-- RELATIONSHIP FLOW (NO DIRECT RELATIONS FROM USERS TABLE):
-- 1. users table: id (UUID) - base user identifier only
-- 2. departments table: id, is_active - base department reference
-- 3. user_permissions table: CENTRAL RELATIONSHIP POINT
--    - user_id (UUID) → references users.id
--    - department_id → references departments.id (check is_active)
--    - permission → CRUD permissions for everything
--    ⭐ ALL RELATIONS TO TASKS AND MONTHS START FROM HERE ⭐
--
-- 4. From user_permissions (PRINCIPAL RELATION):
--    - user_id → tasks.user_id (can access tasks)
--    - department_id → months.department_id (can access months)
--    - department_id → tasks.department_id (can access tasks for that department)
--
-- 5. From departments table (OUTSIDE user_permissions):
--    - departments.id → deliverables.department_id
--    - departments.id → team_days_off.department_id
--    - departments.id → reporters.department_id
--    - departments.id → months.department_id
--
-- 6. UUID from user_permissions proves user can CRUD and see data
--
-- PERMISSION CHECK FLOW:
-- 1. Check user exists (users.id)
-- 2. Check department exists and is_active (departments.id, is_active)
-- 3. Check user_permissions: user_id + department_id + permission → ALLOW CRUD
-- 4. If permission OK → can access months for that department
-- 5. If permission OK → can access tasks for that month/department
-- 6. Tasks relation: user_permissions.user_id → tasks.user_id (principal relation)
--
-- HIERARCHY STRUCTURE:
-- department/design/year/month/taskdata/idtask
-- 
-- QUERY PATTERNS:
-- - Get departments first (design is default)
-- - Check user_permissions for user + department
-- - If permission granted → Get current month for department/year
-- - If permission granted → Filter tasks by month/department
-- - Filter tasks by department_id, user_id, reporter_id, month_id
-- - Join tasks with users, reporters, months, departments for display
-- - Filter by task relationships (markets, departments, deliverables)
--
-- ============================================================================
