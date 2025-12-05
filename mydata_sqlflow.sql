-- Task Tracker Database Schema for SQLFlow
-- Copy and paste this entire file into https://sqlflow.gudusoft.com/#/
-- Organized by dependency order for proper relational structure

-- ============================================================================
-- TIER 1: CORE FOUNDATION TABLES
-- ============================================================================

-- Users table (BASE TABLE - no dependencies)
-- ⚠️ NO DIRECT RELATIONS TO OTHER TABLES - all relations go through user_permissions
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    color_set VARCHAR(7),
    is_active BOOLEAN,
    occupation VARCHAR(100),
    created_at TIMESTAMP,
    created_by_id UUID,
    updated_at TIMESTAMP
);

-- Add self-referencing FK constraint
ALTER TABLE users 
    ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by_id) 
    REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- TIER 2: REFERENCE DATA TABLES (BASE - no dependencies)
-- ============================================================================

-- Departments table (BASE REFERENCE - no dependencies)
-- Base structure: department/design/year/month/taskdata/idtask
-- Multiple departments supported (design, marketing, development, etc.)
CREATE TABLE departments (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by_id UUID,
    updated_by_id UUID,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- TIER 3: USER-RELATED TABLES (depend on users and departments)
-- ============================================================================

-- User permissions table (ACCESS CONTROL - for filtering/showing data)
-- This table controls which users can access which departments
-- Used to filter/show months and tasks data based on user permissions
-- Structure: users.id (UUID) → user_permissions.user_id → departments.id
-- Logic: Check user → check department (is_active) → check user_permissions → show data
-- 
-- Access Control Logic:
--   - user_permissions.user_id + department_id → filter tasks by user_id and department_id
--   - user_permissions.department_id → filter months by department_id
--   - No direct FK relationships, used for query filtering only
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,  -- References users.id
    department_id UUID,      -- References departments.id (check is_active)
    permission VARCHAR(100) NOT NULL,
    created_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    UNIQUE(user_id, department_id, permission)
);

-- ============================================================================
-- TIER 4: DEPARTMENT-RELATED TABLES (depend on departments only)
-- ============================================================================
-- NO direct relations from users table - all relations go through departments
-- These tables link directly to departments (outside user_permissions)

-- Months table - links to departments
-- Structure: department/year/month
-- 
-- Access Control: user_permissions is used to filter/show months data
--   - Check user_permissions (user_id + department_id) → then show months for that department
--   - No direct FK relationship, user_permissions is for access control only
--
-- Physical FK (data integrity):
--   months.department_id → departments.id
CREATE TABLE months (
    id UUID PRIMARY KEY,
    month_id VARCHAR(50) UNIQUE NOT NULL,
    year_id VARCHAR(10) NOT NULL,
    department_id UUID NOT NULL,  -- Links to departments.id (access controlled via user_permissions)
    status VARCHAR(50),
    month_name VARCHAR(100),
    start_date DATE,
    end_date DATE,
    days_in_month INTEGER,
    board_id VARCHAR(255),
    month INTEGER,
    year INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by_id UUID,
    updated_by_id UUID,
    -- Foreign key for data integrity
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Reporters table - links to departments
-- Used for task assignment and filtering
CREATE TABLE reporters (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department_id UUID,  -- Links to departments.id
    channel VARCHAR(100),
    channel_name VARCHAR(100),
    country VARCHAR(10),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by_id UUID,
    updated_by_id UUID,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Deliverables table - links to departments
-- Template definitions for deliverables used in tasks
CREATE TABLE deliverables (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    department_id UUID,  -- Links to departments.id
    time_per_unit DECIMAL(10, 2),
    time_unit VARCHAR(10),
    variations_time DECIMAL(10, 2),
    variations_time_unit VARCHAR(10),
    requires_quantity BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by_id UUID,
    updated_by_id UUID,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Team days off table - links to departments
-- One record per user with calculated fields
-- Can be department-specific
CREATE TABLE team_days_off (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,  -- For user reference, but access via user_permissions
    department_id UUID,  -- Links to departments.id
    base_days DECIMAL(10, 2),
    days_off DECIMAL(10, 2),
    days_remaining DECIMAL(10, 2),
    days_total DECIMAL(10, 2),
    monthly_accrual DECIMAL(10, 2),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by_id UUID,
    updated_by_id UUID,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Team days off dates table (depends on team_days_off)
CREATE TABLE team_days_off_dates (
    id UUID PRIMARY KEY,
    team_days_off_id UUID NOT NULL,
    user_id UUID NOT NULL,
    date_string VARCHAR(50) NOT NULL,
    day INTEGER,
    month INTEGER,
    year INTEGER,
    timestamp BIGINT,
    created_at TIMESTAMP,
    FOREIGN KEY (team_days_off_id) REFERENCES team_days_off(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(team_days_off_id, date_string)
);

-- ============================================================================
-- TIER 5: MAIN DATA TABLES (access controlled via user_permissions)
-- ============================================================================

-- Tasks table - access controlled via user_permissions
-- Core task records with relationships
-- Structure: department/year/month/taskdata/idtask
-- 
-- Access Control: user_permissions is used to filter/show tasks data
--   - Check user_permissions (user_id + department_id) → then show tasks for that user/department
--   - No direct FK relationship, user_permissions is for access control only
--
-- Physical FKs (data integrity):
--   tasks.user_id → users.id
--   tasks.month_id → months.month_id
--   tasks.department_id → departments.id
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    -- Foreign key relationships
    month_id VARCHAR(50) NOT NULL,      -- Links to months.month_id
    user_id UUID NOT NULL,              -- Links to users.id (access controlled via user_permissions)
    reporter_id UUID,                   -- Links to reporters (which links to departments)
    department_id UUID,                  -- Links to departments.id (access controlled via user_permissions)
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
    is_vip BOOLEAN,
    reworked BOOLEAN,
    use_shutterstock BOOLEAN,
    reporter_name VARCHAR(255),
    -- Timestamps
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    -- Auditing
    created_by_id UUID,
    updated_by_id UUID,
    -- Foreign keys (data integrity)
    FOREIGN KEY (month_id) REFERENCES months(month_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
    FOREIGN KEY (reporter_id) REFERENCES reporters(id) ON DELETE SET NULL,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

-- ============================================================================
-- TIER 6: TASK-RELATED JUNCTION TABLES (depend on tasks)
-- ============================================================================

-- Task Markets (many-to-many: tasks ↔ markets)
CREATE TABLE task_markets (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL,
    market VARCHAR(10) NOT NULL,
    created_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, market)
);

-- Task Departments (many-to-many: tasks ↔ departments)
CREATE TABLE task_departments (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL,
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(task_id, department)
);

-- Task Deliverables (one-to-many: tasks → deliverables)
CREATE TABLE task_deliverables (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL,
    deliverable_name VARCHAR(255) NOT NULL,
    count INTEGER,
    variations_enabled BOOLEAN,
    variations_count INTEGER,
    created_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Task AI Usage (one-to-many: tasks → AI usage records)
CREATE TABLE task_ai_usage (
    id UUID PRIMARY KEY,
    task_id UUID NOT NULL,
    ai_models VARCHAR(500),
    ai_time DECIMAL(10, 2),
    created_at TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);


-- ============================================================================
-- ACCESS CONTROL LOGIC (user_permissions)
-- ============================================================================
-- 
-- user_permissions is used for ACCESS CONTROL only (filtering/showing data)
-- It does NOT have direct FK relationships to tasks or months
--
-- Access Control Flow:
--   1. Check user_permissions for user_id + department_id
--   2. If permission exists → show months for that department_id
--   3. If permission exists → show tasks for that user_id + department_id
--
-- Physical FK Relationships (shown in SQLFlow):
--   users → user_permissions (user_id)
--   departments → user_permissions (department_id)
--   departments → months (department_id)
--   departments → tasks (department_id)
--   users → tasks (user_id)
--   months → tasks (month_id)
--
-- user_permissions is used in queries to FILTER data, not as a FK constraint

-- ============================================================================
-- RELATIONSHIP SUMMARY
-- ============================================================================
-- 
-- DEPENDENCY CHAIN (with permission logic):
-- 1. users (base table) - NO DIRECT RELATIONS TO OTHER TABLES
-- 2. departments (base reference - 'design' default)
-- 3. user_permissions → users, departments (CHECK: user has permission for department)
-- 4. team_days_off → users, departments (after departments)
-- 5. team_days_off_dates → team_days_off, users
-- 6. months → departments (structure: department/year/month) - access via user_permissions
-- 7. reporters → departments
-- 8. deliverables → departments
-- 9. tasks → users, months, reporters, departments (structure: department/year/month/taskdata/idtask) - access via user_permissions
-- 10. task_markets → tasks
-- 11. task_departments → tasks (many-to-many for multiple departments per task)
-- 12. task_deliverables → tasks
-- 13. task_ai_usage → tasks
--
-- RELATIONSHIP FLOW:
-- 1. users table: id (UUID) - base user identifier
-- 2. departments table: id, is_active - base department reference
-- 3. user_permissions table: ACCESS CONTROL ONLY (for filtering/showing data)
--    - user_id (UUID) → references users.id
--    - department_id → references departments.id (check is_active)
--    - permission → CRUD permissions for everything
--    - NO direct FK relationships to tasks or months
--    - Used in queries to FILTER data based on permissions
--
-- 4. Physical FK Relationships (data integrity):
--    - users.id → tasks.user_id
--    - departments.id → months.department_id
--    - departments.id → tasks.department_id
--    - months.month_id → tasks.month_id
--
-- 5. From departments table:
--    - departments.id → deliverables.department_id
--    - departments.id → team_days_off.department_id
--    - departments.id → reporters.department_id
--    - departments.id → months.department_id
--
-- 6. Access Control (using user_permissions for filtering):
--    - Check user_permissions (user_id + department_id) → filter months by department_id
--    - Check user_permissions (user_id + department_id) → filter tasks by user_id + department_id
--
-- PERMISSION CHECK FLOW (for filtering/showing data):
-- 1. Check user exists (users.id)
-- 2. Check department exists and is_active (departments.id, is_active)
-- 3. Check user_permissions: user_id + department_id + permission → ALLOW ACCESS
-- 4. If permission exists → show months WHERE department_id matches
-- 5. If permission exists → show tasks WHERE user_id AND department_id match
-- 6. user_permissions is used in WHERE clauses, NOT as FK relationships
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
