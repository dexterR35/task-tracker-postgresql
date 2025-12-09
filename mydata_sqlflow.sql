-- ============================================================================
-- TASK TRACKER DATABASE SCHEMA FOR SQLFLOW
-- ============================================================================
-
-- ============================================================================
-- TIER 1: REFERENCE DATA TABLES (BASE - no dependencies)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Teams Table (BASE REFERENCE - parent of departments)
-- ----------------------------------------------------------------------------
-- Purpose: Top-level organizational units
-- Examples: racheta, team1, team2
-- Dependencies: None (base reference table)
-- Usage:
--   - Departments: Link to teams (departments.team_id)
--   - Hierarchy: Teams → Departments → Users → Tasks
-- Note: Teams are the highest level organizational unit
-- ----------------------------------------------------------------------------
CREATE TABLE teams (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    name VARCHAR(100) UNIQUE NOT NULL,  -- Team name globally unique (e.g., 'racheta')
    display_name VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- Note: No created_by_id/updated_by_id to avoid circular dependency with users
);

-- ----------------------------------------------------------------------------
-- Departments Table (BASE REFERENCE - depends on teams)
-- ----------------------------------------------------------------------------
-- Purpose: ROLES/SKILLS/OCCUPATIONS - Reference table like a lookup
-- Examples: design, video, dev, marketing
-- Dependencies: teams (departments belong to teams)
-- Usage:
--   - Users: Their department/occupation (users.department_id) - REQUIRED
--   - Deliverables: Type of work (deliverables.department_id)
--   - Tasks: Filtered by user's department when fetching for authenticated user
-- Note: Department is like occupation for users - users must have a department
--       When fetching tasks for auth user, filter by user's department_id
--       If user is designer, they can only see designer tasks
--       Departments belong to teams (departments.team_id)
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    team_id UUID NOT NULL,  -- FK: Team this department belongs to
    name VARCHAR(100) NOT NULL,  -- Department name (unique per team)
    display_name VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE RESTRICT,
    UNIQUE(team_id, name)  -- Department name unique per team
    -- Note: No created_by_id/updated_by_id to avoid circular dependency with users
);

-- ============================================================================
-- TIER 2: CORE FOUNDATION TABLES (USERS FIRST - PRIMARY ENTITY)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Users Table (PRIMARY ENTITY - depends on departments)
-- ----------------------------------------------------------------------------
-- Purpose: System users - PRIMARY ENTITY
-- Dependencies: departments (for department_id)
-- 
-- KEY CONCEPT: Users come first, department is their occupation
-- - Users must have a department_id (REQUIRED) - this is their occupation
-- - When fetching tasks for authenticated user, filter by user's department_id
-- - If user is designer (department_id = 'design'), they only see designer tasks
-- 
-- User Creation Flow:
--   1. Create user with department_id (REQUIRED) - e.g., "design", "video", "dev"
--   2. User's department_id determines which tasks they can see
-- 
-- Task Fetching Flow:
--   1. Authenticate user → get user.department_id
--   2. Fetch tasks WHERE tasks.department_id = user.department_id
--   3. If user is designer → only see tasks where department_id = 'design'
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    password_hash VARCHAR(255) NOT NULL,
    color_set VARCHAR(7) CHECK (color_set IS NULL OR color_set ~* '^#[0-9A-Fa-f]{6}$'),
    is_active BOOLEAN DEFAULT true,  -- Soft delete support
    department_id UUID NOT NULL,  -- FK: User's department/occupation (REQUIRED) - determines task access
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Note: No updated_at/updated_by_id/created_by_id - users are created once and not updated
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- Reporters Table (BASE TABLE - standalone)
-- ----------------------------------------------------------------------------
-- Purpose: EXTERNAL/STANDALONE entities
-- Dependencies: users (for created_by_id/updated_by_id)
-- Permissions: Only admin users (role = 'admin') can create reporters
-- Usage: Task filtering - select reporter when creating/editing task
-- Note: Reporters are standalone and can be used across different departments
-- ----------------------------------------------------------------------------
CREATE TABLE reporters (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,  -- Email must be unique to prevent ambiguity
    channel VARCHAR(100),
    channel_name VARCHAR(100),
    country VARCHAR(10),
    is_active BOOLEAN DEFAULT true,  -- Soft delete support
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID,  -- FK: Admin user who created
    updated_by_id UUID,  -- FK: Admin user who updated
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- TIER 2: USER-RELATED TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Team Days Off Table
-- ----------------------------------------------------------------------------
-- Purpose: User vacation/time off tracking (parent table)
-- Dependencies: users, departments
-- Note: One record per user with calculated fields
-- ----------------------------------------------------------------------------
CREATE TABLE team_days_off (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    user_id UUID NOT NULL UNIQUE,  -- One record per user
    department_id UUID,  -- Optional: department-specific days off
    base_days DECIMAL(10, 2) DEFAULT 0 CHECK (base_days >= 0),
    days_off DECIMAL(10, 2) DEFAULT 0 CHECK (days_off >= 0),
    days_remaining DECIMAL(10, 2) DEFAULT 0,
    days_total DECIMAL(10, 2) DEFAULT 0 CHECK (days_total >= 0),
    monthly_accrual DECIMAL(10, 2) DEFAULT 1.75 CHECK (monthly_accrual >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID,
    updated_by_id UUID,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- Team Days Off Dates Table
-- ----------------------------------------------------------------------------
-- Purpose: User-specific time off dates (child table)
-- Dependencies: team_days_off, users
-- ----------------------------------------------------------------------------
CREATE TABLE team_days_off_dates (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    team_days_off_id UUID NOT NULL,
    date_string VARCHAR(50) NOT NULL,
    day INTEGER CHECK (day >= 1 AND day <= 31),
    month INTEGER CHECK (month >= 1 AND month <= 12),
    year INTEGER CHECK (year >= 2000 AND year <= 2100),
    timestamp BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_days_off_id) REFERENCES team_days_off(id) ON DELETE CASCADE,
    UNIQUE(team_days_off_id, date_string)  -- Prevent duplicate dates per user
    -- Note: user_id accessed through: team_days_off_id → team_days_off.user_id
);

-- ============================================================================
-- TIER 3: DEPARTMENT-RELATED TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Years Table
-- ----------------------------------------------------------------------------
-- Purpose: Year management per department (system-generated)
-- Structure: department/year
-- Dependencies: departments
-- Usage: Mandatory for fetching other years data independently
-- Note: Each department can have multiple years (2024, 2025, etc.)
--       Years are system-generated, not user-created
-- ----------------------------------------------------------------------------
CREATE TABLE years (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    department_id UUID NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    UNIQUE(department_id, year)  -- One year per department
);

-- ----------------------------------------------------------------------------
-- Months Table
-- ----------------------------------------------------------------------------
-- Purpose: Month management per year and department (system-generated)
-- Structure: department/year/month
-- Dependencies: years
-- Usage: Filtering months by department/deliverables/tasks
-- Note: Department accessed through: months.year_id → years.department_id
--       Months are system-generated, not user-created
-- ----------------------------------------------------------------------------
CREATE TABLE months (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    year_id UUID NOT NULL,
    month_name VARCHAR(100),
    start_date DATE,
    end_date DATE,
    days_in_month INTEGER,
    board_id VARCHAR(255),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE RESTRICT,
    UNIQUE(year_id, month),  -- One month per year
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- ----------------------------------------------------------------------------
-- Deliverables Table
-- ----------------------------------------------------------------------------
-- Purpose: Template definitions for deliverables used in tasks
-- Structure: department/deliverables
-- Dependencies: departments, users
-- Permissions: Only admin users (role = 'admin') can create deliverables
-- Usage: Users select deliverables from this table
-- Note: Each deliverable belongs to a department (design, video, dev)
-- ----------------------------------------------------------------------------
CREATE TABLE deliverables (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    name VARCHAR(255) NOT NULL,  -- Removed global UNIQUE - allows same name in different departments
    description TEXT,
    department_id UUID NOT NULL,
    time_per_unit DECIMAL(10, 2) CHECK (time_per_unit IS NULL OR time_per_unit >= 0),
    time_unit VARCHAR(10) DEFAULT 'hr',
    variations_time DECIMAL(10, 2) CHECK (variations_time IS NULL OR variations_time >= 0),
    variations_time_unit VARCHAR(10) DEFAULT 'min',
    requires_quantity BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,  -- Soft delete support
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID,
    updated_by_id UUID,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(department_id, name)  -- Name unique per department (allows "Logo Design" in multiple departments)
);

-- ============================================================================
-- TIER 4: MAIN DATA TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tasks Table
-- ----------------------------------------------------------------------------
-- Purpose: Core task records
-- Structure: department/year/month/taskdata/taskid
-- Dependencies: months, deliverables, users (for auditing)
-- 
-- IMPORTANT RELATIONSHIPS:
--   - PRIMARY LINK: tasks.month_id → months.id (FK)
--   - Tasks DO NOT have a direct year field - year is accessed through:
--     tasks.month_id → months.id → months.year_id → years.id
--   - Department Association:
--     tasks.deliverable_id → deliverables.id → deliverables.department_id → departments.id
-- 
-- ⭐ KEY CONCEPT: TASK FETCHING BY USER'S DEPARTMENT ⭐
--   When fetching tasks for authenticated user:
--   1. Get authenticated user → user.department_id (user's occupation)
--   2. Filter tasks WHERE tasks.deliverable_id IN 
--      (SELECT id FROM deliverables WHERE department_id = user.department_id)
--   3. If user is designer (department_id = 'design') → only see designer tasks
--   4. If user is video (department_id = 'video') → only see video tasks
-- 
-- TASK CREATION FLOW:
--   1. User selects year OR month (or both, or neither for default)
--   2. If only year selected:
--      - Find or create current month in that year
--      - Use that month_id for task creation
--   3. If only month selected:
--      - Use that month_id directly for task creation
--   4. If nothing selected (default):
--      - Use current year + current month
--      - tasks.month_id = current_month.id
--   5. Task is created with:
--      - tasks.month_id = selected_month_id (or default current month)
--      - tasks.user_id = current_user.id (for users) or selected_user_id (for admins)
--      - tasks.department_id = current_user.department_id (from users.department_id) - REQUIRED
--      - tasks.deliverable_id = selected_deliverable_id
--      - tasks.reporter_id = selected_reporter_id (optional)
-- 
-- DEFAULT VIEW:
--   - Default: Current year + Current month
--   - Admin: All tasks in current year/current month (can see all departments)
--   - User: Only tasks for their department (filtered by user.department_id) in current year/current month
-- 
-- ROLE-BASED ACCESS CONTROL WITH DEPARTMENT FILTERING:
--   - Admin role (users.role = 'admin'): Can see ALL tasks in table (all departments)
--   - User role (users.role = 'user'): Can only see tasks for their department
--     * Filter: tasks.deliverable_id IN 
--       (SELECT id FROM deliverables WHERE department_id = current_user.department_id)
--     * If designer → only see designer tasks
--     * If video → only see video tasks
--   - Both roles can CRUD tasks in any month/year (within their department for users)
-- 
-- FILTERING OPTIONS:
--   - By Year: Filter tasks where tasks.month_id IN (SELECT id FROM months WHERE year_id = selected_year_id)
--   - By Month: Filter tasks where tasks.month_id = selected_month_id
--   - By Tasks: Filter by task_name, board_id, products, etc.
--   - By Deliverables: Filter where tasks.deliverable_id = selected_deliverable_id
--   - By AI Used: Filter through task_ai_usage table (join with tasks)
--   - By Department: 
--     * Admin: Filter through tasks.department_id = selected_department_id
--     * User: Automatically filtered by tasks.department_id = user.department_id (can only see their department)
--   - Combined filters: Can combine any of the above filters
--   - Role-based: Admin sees all, User sees only tasks for their department
-- ----------------------------------------------------------------------------
CREATE TABLE tasks (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    
    -- Primary Relationships
    month_id UUID NOT NULL,            -- FK: PRIMARY LINK to months.id
    deliverable_id UUID NOT NULL,      -- FK: Direct reference to deliverables.id (REQUIRED)
    
    -- User and Reporter References (FK for data integrity)
    user_id UUID NOT NULL,             -- FK: User who owns/created the task
    department_id UUID NOT NULL,       -- FK: Department from user (users.department_id) - set when task is created
    reporter_id UUID,                  -- FK: Reporter assigned to task (optional)
    
    -- Task Identification
    board_id VARCHAR(255),
    task_name VARCHAR(255),
    products VARCHAR(255),
    
    -- Time Tracking
    time_in_hours DECIMAL(10, 2) CHECK (time_in_hours IS NULL OR time_in_hours >= 0),
    start_date DATE,
    end_date DATE,
    observations TEXT,
    
    -- Boolean Flags
    is_vip BOOLEAN DEFAULT false,
    reworked BOOLEAN DEFAULT false,
    use_shutterstock BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,  -- Soft delete support
    -- Removed reporter_name - redundant, use JOIN with reporters table
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Auditing
    created_by_id UUID,
    updated_by_id UUID,
    
    -- Foreign Key Constraints
    FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE RESTRICT,  -- Changed from CASCADE to RESTRICT
    FOREIGN KEY (deliverable_id) REFERENCES deliverables(id) ON DELETE RESTRICT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,  -- Prevent orphaned tasks
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,  -- FK: From user's department_id
    FOREIGN KEY (reporter_id) REFERENCES reporters(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Data integrity constraints
    CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- ============================================================================
-- TIER 5: TASK-RELATED JUNCTION TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Markets Reference Table (for data integrity)
-- ----------------------------------------------------------------------------
CREATE TABLE markets (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    code VARCHAR(10) UNIQUE NOT NULL,  -- e.g., 'ro', 'com', 'uk'
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- Task Markets (many-to-many: tasks ↔ markets)
-- ----------------------------------------------------------------------------
CREATE TABLE task_markets (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    task_id UUID NOT NULL,
    market_id UUID NOT NULL,  -- Changed from VARCHAR to FK reference
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE RESTRICT,
    UNIQUE(task_id, market_id)
);

-- ----------------------------------------------------------------------------
-- Task Departments (many-to-many: tasks ↔ departments)
-- ----------------------------------------------------------------------------
-- Note: This allows tasks to be associated with multiple departments
--       beyond the primary department (from tasks.department_id)
--       Department_id removed - tasks now have department_id directly from users
CREATE TABLE task_departments (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    task_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    -- Note: department_id removed - tasks.department_id is used instead (from users.department_id)
);

-- ----------------------------------------------------------------------------
-- Task Deliverables (one-to-many: tasks → task deliverable details)
-- ----------------------------------------------------------------------------
-- Purpose: Track quantities, variations, and metrics for analytics/calculations
-- Flow: task_deliverables.task_id → tasks.id → tasks.deliverable_id → deliverables.id
-- Note: This table tracks additional details about the task's primary deliverable
--       Deliverable is accessed through: task_deliverables.task_id → tasks.deliverable_id
-- Usage: Analytics calculations based on count, variations_count, variations_enabled
-- Example: Calculate total deliverables, variations per task, time estimates, etc.
-- ----------------------------------------------------------------------------
CREATE TABLE task_deliverables (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    task_id UUID NOT NULL UNIQUE,  -- One record per task (deliverable comes from task)
    count INTEGER DEFAULT 1 CHECK (count > 0),  -- Quantity of deliverables (must be positive)
    variations_enabled BOOLEAN DEFAULT false,  -- Whether variations are enabled
    variations_count INTEGER DEFAULT 0 CHECK (variations_count >= 0),  -- Number of variations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    -- Note: Deliverable is accessed through task: task_id → tasks.deliverable_id → deliverables.id
    -- Analytics: SUM(count), SUM(variations_count), etc.
);

-- ----------------------------------------------------------------------------
-- Task AI Usage (one-to-many: tasks → AI usage records)
-- ----------------------------------------------------------------------------
CREATE TABLE task_ai_usage (
    id UUID PRIMARY KEY,  -- In PostgreSQL: DEFAULT gen_random_uuid()
    task_id UUID NOT NULL,
    ai_models TEXT[],  -- Changed to array for multiple models
    ai_time DECIMAL(10, 2) CHECK (ai_time IS NULL OR ai_time >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ============================================================================
-- RELATIONSHIP SUMMARY
-- ============================================================================

-- Physical Foreign Key Relationships:
--   teams → departments (team_id) - RESTRICT
--   departments → users (department_id) - RESTRICT
--   departments → deliverables (department_id) - RESTRICT
--   departments → years (department_id) - RESTRICT
--   years → months (year_id) - months get department through years.department_id
--   departments → team_days_off (department_id) - SET NULL
--   departments → tasks (department_id) - RESTRICT (direct relationship)
--   years → months (year_id) - RESTRICT
--   months → tasks (month_id) - RESTRICT (changed from CASCADE)
--   deliverables → tasks (deliverable_id) - RESTRICT
--   tasks → task_deliverables (task_id) - one-to-one relationship
--   users → tasks (user_id) - RESTRICT (prevents orphaned tasks)
--   users → reporters (created_by_id, updated_by_id) - SET NULL
--   users → deliverables (created_by_id, updated_by_id) - SET NULL
--   users → tasks (created_by_id, updated_by_id) - SET NULL
--   Note: years and months are system-generated (no user audit fields)
--   users → team_days_off (user_id) - CASCADE
--   users → team_days_off_dates (user_id) - CASCADE
--   reporters → tasks (reporter_id) - SET NULL (optional)
--   markets → task_markets (market_id) - RESTRICT
--   tasks → task_markets (task_id) - CASCADE
--   tasks → task_departments (task_id) - CASCADE (note: task_departments.department_id removed)
--   tasks → task_deliverables (task_id) - CASCADE
--   tasks → task_ai_usage (task_id) - CASCADE
--   team_days_off → team_days_off_dates (team_days_off_id) - CASCADE

-- Cascading Strategy Summary:
--   CASCADE: Junction tables (task_markets, task_departments, task_deliverables, task_ai_usage)
--            Child records (team_days_off_dates)
--   RESTRICT: Core relationships (prevents accidental data loss)
--   SET NULL: Optional relationships and audit fields

-- Data Flow:
--   teams (reference) → departments (reference) → users (PRIMARY) → year → month → taskdata
--   Flow: Teams (reference) → Departments (reference) → Users (with department_id) → Years → Months → Tasks
--   Also: teams → departments → deliverables → tasks (via deliverable_id)
--   Task Filtering: tasks.department_id = user.department_id (from users.department_id)

-- ============================================================================
-- DEPENDENCY CHAIN
-- ============================================================================

-- 1. teams (BASE REFERENCE) - Top-level organizational units (e.g., 'racheta')
-- 2. departments (BASE REFERENCE) - Depends on teams (team_id REQUIRED), roles/skills/occupations
-- 3. users (PRIMARY ENTITY) - Depends on departments (department_id REQUIRED)
--    - Users come first, department is their occupation
--    - When fetching tasks for auth user, filter by user.department_id
-- 4. reporters - Depends on users (for created_by_id/updated_by_id)
-- 5. team_days_off - Depends on users, departments
-- 6. team_days_off_dates - Depends on team_days_off, users
-- 7. deliverables - Depends on departments (admin users can create)
-- 8. years - Depends on departments (system-generated)
-- 9. months - Depends on years (system-generated)
-- 10. tasks - Depends on months (PRIMARY), deliverables, users, reporters
--     - Filtered by user.department_id when fetching for authenticated user
-- 11. task_markets - Depends on tasks
-- 12. task_departments - Depends on tasks
-- 13. task_deliverables - Depends on tasks (one-to-one, deliverable accessed via task)
-- 14. task_ai_usage - Depends on tasks

-- ============================================================================
-- HIERARCHY STRUCTURE
-- ============================================================================

-- Data Hierarchy:
--   teams (reference) → departments (reference) → users (PRIMARY with department_id) → year → month → taskdata
--   Flow: Teams (reference) → Departments (reference) → Users (with department_id) → Years → Months → Tasks

-- Organization Structure:
--   - Teams: Top-level organizational units (e.g., 'racheta') - parent of departments
--   - Departments: Base reference data (roles/skills/occupations) - belong to teams (team_id)
--   - Users: PRIMARY ENTITY - assigned to department (department_id IS the occupation, REQUIRED)
--   - Each team can have multiple departments
--   - Each department can have multiple users
--   - When fetching tasks for authenticated user:
--     * Get user.department_id (user's occupation)
--     * Filter tasks: tasks.department_id = user.department_id
--     * tasks.department_id is set from users.department_id when task is created
--     * If user is designer → only see designer tasks
--     * If user is video → only see video tasks

-- Permissions:
--   - Super users: Can create users
--   - Admin users (role = 'admin'): Can create deliverables and reporters
--   - Reporters: Standalone - can be used across different departments
--   - Deliverables: Linked to departments - admin users can create them

-- Task Department Association:
--   tasks.department_id → departments.id (directly from users.department_id when task is created)
--   Also: tasks.deliverable_id → deliverables.id → deliverables.department_id → departments.id

-- ============================================================================
-- ACCESS CONTROL & FILTERING
-- ============================================================================

-- ROLE-BASED ACCESS CONTROL WITH DEPARTMENT FILTERING:
--   Admin Role (users.role = 'admin'):
--     - Can see ALL tasks in table (all departments, no department filter)
--     - Can CRUD tasks in any month/year (all departments)
--     - Can filter by month/year/reporter/deliverable/department
--   
--   User Role (users.role = 'user'):
--     - Can only see tasks for their department (filtered by user.department_id)
--     - Filter: tasks.deliverable_id IN 
--       (SELECT id FROM deliverables WHERE department_id = current_user.department_id)
--     - If user is designer → only see designer tasks
--     - If user is video → only see video tasks
--     - Can CRUD tasks in any month/year (but only for their department)
--     - Default view: Current month + tasks for their department
--     - Can filter by month/year/reporter/deliverable (within their department tasks)

-- MONTH/YEAR FILTERING:
--   - Month Filter: Select month from input → WHERE tasks.month_id = selected_month_id
--   - Year Filter: Select year from input → WHERE tasks.month_id IN (SELECT id FROM months WHERE year_id = selected_year_id)
--   - Combined Filter: Filter by year → get months → filter tasks by month_id
--   - Both admin and user roles can filter by month/year
--   - Users see filtered results within their own tasks (tasks.user_id = current_user.id)

-- DEFAULT VIEW:
--   - Default: Current year + Current month
--   - Admin: All tasks in current year/current month (can filter by month/year, all departments)
--   - User: Only tasks for their department (filtered by user.department_id) in current year/current month
--     * If designer → only see designer tasks
--     * If video → only see video tasks
--   - User can change month/year filter to see tasks in other months/years (still only their department)
--   - When adding a task: Default to current month (tasks.month_id = current_month.id)

-- CRUD OPERATIONS:
--   - Both admin and user roles can Create, Read, Update, Delete tasks
--   - Admin: Can CRUD any task in any month/year (all departments)
--   - User: Can CRUD tasks for their department (filtered by user.department_id) in any month/year
--     * Tasks are filtered by: tasks.department_id = current_user.department_id
--     * tasks.department_id is set from users.department_id when task is created
--   - Task creation: Must specify month_id, user_id, deliverable_id
--   - Task updates: Must respect role-based access (user can only update tasks for their department)

-- ============================================================================
-- QUERY PATTERNS
-- ============================================================================

-- BASE DATA QUERIES:
--   - Get all departments, reporters, deliverables
--   - Get user's department_id: SELECT department_id FROM users WHERE id = current_user.id
--   - Get all users with a specific department: WHERE users.department_id = ?
--   - Get tasks for user's department: tasks.department_id = current_user.department_id

-- USER CREATION:
--   - Users come first - department is their occupation
--   - Select department (design, video, dev) → department_id (REQUIRED) - this IS the occupation
--   - When user is created, they must have a department_id
--   - This department_id determines which tasks they can see when authenticated

-- TASK QUERIES (Primary Patterns with Department-Based Access):
-- 
-- ⭐ KEY: Users see tasks filtered by their department_id (occupation) ⭐
--   - Get user's department: SELECT department_id FROM users WHERE id = current_user.id
--   - Filter tasks by department: tasks.deliverable_id IN 
--     (SELECT id FROM deliverables WHERE department_id = current_user.department_id)
--   - If user is designer → only see designer tasks
--   - If user is video → only see video tasks
-- 
--   DEFAULT VIEW (Current Year + Current Month):
--     Admin: SELECT * FROM tasks 
--            WHERE tasks.month_id IN 
--              (SELECT id FROM months WHERE year_id IN 
--                (SELECT id FROM years WHERE year = CURRENT_YEAR))
--            AND tasks.month_id IN 
--              (SELECT id FROM months WHERE month = CURRENT_MONTH)
--     User:  Same query + AND tasks.department_id = current_user.department_id
--            -- User only sees tasks for their department (e.g., designer sees only designer tasks)
--            -- tasks.department_id is set from users.department_id when task is created
--
--   1. Fetch tasks by years (with department-based access):
--      Admin: SELECT * FROM tasks WHERE tasks.month_id IN 
--             (SELECT id FROM months WHERE year_id IN 
--              (SELECT id FROM years WHERE year = ? AND department_id = ?))
--      User:  Same query + AND tasks.department_id = current_user.department_id
--      Note: Tasks don't have year field - accessed through tasks.month_id → months.year_id → years.id
--
--   2. Fetch tasks by months (with department-based access):
--      Admin: SELECT * FROM tasks WHERE tasks.month_id = ? (UUID → months.id)
--      User:  SELECT * FROM tasks WHERE tasks.month_id = ? 
--             AND tasks.department_id = current_user.department_id
--      Default: Current month (tasks.month_id = current_month.id)
--
--   3. Fetch tasks per users (with department-based access):
--      Admin: Filter: tasks.user_id = ? (can see any user's tasks)
--      User:  Filter: tasks.user_id = current_user.id 
--             AND tasks.department_id = current_user.department_id
--      Join: tasks → months → years → users → departments
--
--   4. Fetch tasks per reporter (with department-based access):
--      Admin: Filter: tasks.reporter_id = ? (all tasks with this reporter)
--      User:  Filter: tasks.reporter_id = ? 
--             AND tasks.department_id = current_user.department_id
--      Can filter across years, months, etc.
--
--   5. Fetch tasks per user + reporter (with department-based access):
--      Admin: Filter: tasks.user_id = ? AND tasks.reporter_id = ?
--      User:  Filter: tasks.user_id = current_user.id AND tasks.reporter_id = ?
--             AND tasks.department_id = current_user.department_id
--      Combined filter for specific user and reporter
--
--   6. Fetch tasks per deliverable (with department-based access):
--      Admin: Filter: tasks.deliverable_id = ? (UUID → deliverables.id)
--      User:  Filter: tasks.deliverable_id = ? 
--             AND tasks.department_id = current_user.department_id
--      Or: task_deliverables.task_id IN (SELECT id FROM tasks WHERE deliverable_id = ?)
--      Join: tasks → deliverables → departments
--      Note: task_deliverables tracks details about the task's primary deliverable
--
--   7. Fetch tasks per AI used (with department-based access):
--      Admin: Filter: task_ai_usage.task_id IN (SELECT id FROM tasks WHERE ...)
--      User:  Filter: task_ai_usage.task_id IN 
--             (SELECT id FROM tasks WHERE ... 
--              AND tasks.department_id = current_user.department_id)
--      Filter: task_ai_usage.ai_models LIKE ? OR task_ai_usage.ai_time > ?
--      Join: tasks → task_ai_usage
--
--   8. Fetch tasks by department (with department-based access):
--      Admin: Filter: tasks.department_id = ? (direct filter on tasks table)
--      User:  Filter: tasks.department_id = current_user.department_id
--             -- User can only see their own department's tasks
--      Join: tasks → departments (direct relationship)
--
-- ROLE-BASED QUERY PATTERN:
--   Base Query: SELECT * FROM tasks WHERE [filters]
--   Admin Role: No additional filter (sees all tasks, all departments)
--   User Role: Add AND tasks.department_id = current_user.department_id
--              -- User only sees tasks for their department (occupation)
--              -- tasks.department_id is set from users.department_id when task is created

-- TASK CREATION FLOW (with role-based access):
-- ============================================
-- 
-- STEP 1: Year/Month Selection
--   User can select:
--     Option A: Year only
--       → System finds/creates current month in that year
--       → tasks.month_id = month_id from that year
--     
--     Option B: Month only
--       → Use that month directly
--       → tasks.month_id = selected_month_id
--     
--     Option C: Both year and month
--       → Use that specific month
--       → tasks.month_id = selected_month_id (must be in selected year)
--     
--     Option D: Neither (default)
--       → Use current year + current month
--       → tasks.month_id = current_month.id
-- 
-- STEP 2: Task Data Entry
--   Admin Role:
--     - Select year OR month (or both, or default)
--     - Select user_id (can be any user)
--     - Select deliverable_id (REQUIRED)
--     - Select reporter_id (optional)
--     - System automatically sets: tasks.month_id based on year/month selection
--   
--   User Role:
--     - Select year OR month (or both, or default)
--     - Select deliverable_id (REQUIRED)
--     - Select reporter_id (optional)
--     - System automatically sets:
--       * tasks.user_id = current_user.id
--       * tasks.month_id based on year/month selection
-- 
-- STEP 3: Task Creation
--   INSERT INTO tasks (
--     month_id,        -- Set from year/month selection or default
--     user_id,          -- current_user.id (users) or selected_user_id (admins)
--     deliverable_id,   -- Selected by user (REQUIRED)
--     reporter_id,      -- Selected by user (optional)
--     task_name,        -- User input
--     ... other fields
--   )
-- 
-- REQUIRED FIELDS:
--   - deliverable_id (must be selected by user) - FK constraint ensures valid deliverable
--   - month_id (set automatically based on year/month selection or default) - FK constraint ensures valid month
--   - user_id (set automatically for users, selected for admins) - FK constraint ensures valid user
--   - reporter_id (optional) - FK constraint ensures valid reporter if provided

-- TASK UPDATE/DELETE (with role-based access):
--   Admin: Can update/delete any task in any month/year
--   User: Can update/delete only their own tasks (tasks.user_id = current_user.id)
--   Both: Must respect month/year filters if applied

-- COMPLEX QUERIES (with role-based access):
--   - Get task's department via: tasks.department_id (directly from users.department_id when task created)
--     Also available: tasks.deliverable_id → deliverables.id → deliverables.department_id
--   - Get task's year via: tasks.month_id → months.id → months.year_id → years.id
--     (Tasks DON'T have direct year field - accessed through months)
--   - Join tasks with users, reporters, months, years, deliverables for display
--   - Users and reporters linked through months/years (NOT direct FK to tasks)
--   - Fetch pattern: year → month → task (users and reporters accessed through months/years)
--   - Join tasks with task_deliverables for analytics/calculations
--   - Analytics queries: SUM(task_deliverables.count), SUM(task_deliverables.variations_count)
--   - Calculate totals per deliverable, per department, per month/year
--   - Filter by task relationships (markets, departments via deliverables, deliverables)
--   - Filter team_days_off_dates by user_id
--   - Filter deliverables by department_id
--   - Filter years by department_id (months get department through years.department_id)
--   - All deliverable references use UUID for consistency and optimized FK joins
--   - Years table is mandatory for fetching other years data independently
--
-- ANALYTICS QUERIES (using task_deliverables):
--   - Total deliverables count: SELECT SUM(count) FROM task_deliverables WHERE task_id IN (...)
--   - Total variations: SELECT SUM(variations_count) FROM task_deliverables WHERE variations_enabled = true
--   - Deliverables per task: SELECT task_id, count FROM task_deliverables
--   - Deliverables per department: 
--     SELECT d.department_id, SUM(td.count) 
--     FROM task_deliverables td
--     JOIN tasks t ON td.task_id = t.id
--     JOIN deliverables d ON t.deliverable_id = d.id
--     GROUP BY d.department_id
--   - Deliverables per month/year: Join with tasks → months → years
--   - Time calculations: Use count * deliverables.time_per_unit for estimates
--
-- FILTERING SUMMARY:
--   Available Filters:
--     - By Year: tasks.month_id → months.year_id → years.id
--     - By Month: tasks.month_id = selected_month_id
--     - By Tasks: task_name, board_id, products, etc.
--     - By Deliverables: tasks.deliverable_id = selected_deliverable_id
--     - By AI Used: Join with task_ai_usage table
--     - By Department: tasks.deliverable_id → deliverables.department_id
--   - All filters can be combined
--   - Default view: Current year + Current month
--
-- ROLE-BASED FILTERING SUMMARY:
--   - Every task query must check user role:
--     * Admin: No user_id filter (sees all tasks)
--     * User: Always add AND tasks.user_id = current_user.id (sees only own tasks)
--   - Month/Year filters work for both roles
--   - Default view: Current year + Current month
--     * Admin: All tasks in current year/current month
--     * User: Only own tasks (tasks.user_id = current_user.id) in current year/current month
--   - CRUD operations respect role-based access control
--   - When adding task: Default to current month (tasks.month_id = current_month.id)

-- ============================================================================
-- PRODUCTION READINESS: INDEXES, CONSTRAINTS, AND OPTIMIZATIONS
-- ============================================================================

-- ============================================================================
-- INDEXES FOR FILTERING AND PERFORMANCE
-- ============================================================================
-- NOTE: SQLFlow doesn't support CREATE INDEX statements
-- Uncomment these in your actual PostgreSQL database for production use

-- Core Tables Indexes
-- Teams Indexes
-- CREATE INDEX idx_teams_name ON teams(name);
-- CREATE INDEX idx_teams_is_active ON teams(is_active);

-- Departments Indexes
-- CREATE INDEX idx_departments_team_id ON departments(team_id);
-- CREATE INDEX idx_departments_name ON departments(name);
-- CREATE INDEX idx_departments_is_active ON departments(is_active);
-- CREATE INDEX idx_departments_team_name ON departments(team_id, name);  -- Composite for unique constraint

-- Users Indexes
-- CREATE INDEX idx_users_email ON users(email);
-- CREATE INDEX idx_users_role ON users(role);
-- CREATE INDEX idx_users_is_active ON users(is_active);
-- CREATE INDEX idx_users_department_id ON users(department_id);
-- CREATE INDEX idx_reporters_name ON reporters(name);
-- CREATE INDEX idx_reporters_created_by_id ON reporters(created_by_id);

-- Years and Months Indexes (for filtering)
-- CREATE INDEX idx_years_department_id ON years(department_id);
-- CREATE INDEX idx_years_year ON years(year);
-- CREATE INDEX idx_years_department_year ON years(department_id, year);  -- Composite for unique constraint
-- CREATE INDEX idx_months_year_id ON months(year_id);
-- CREATE INDEX idx_months_month ON months(month);
-- CREATE INDEX idx_months_year_month ON months(year_id, month);  -- Composite for common queries
-- CREATE INDEX idx_months_start_date ON months(start_date);
-- CREATE INDEX idx_months_end_date ON months(end_date);

-- Deliverables Indexes
-- CREATE INDEX idx_deliverables_department_id ON deliverables(department_id);
-- CREATE INDEX idx_deliverables_name ON deliverables(name);

-- Tasks Indexes (OPTIMIZED - removed rarely-used boolean indexes)
-- Single column indexes for basic filtering
-- CREATE INDEX idx_tasks_month_id ON tasks(month_id);
-- CREATE INDEX idx_tasks_user_id ON tasks(user_id);
-- CREATE INDEX idx_tasks_department_id ON tasks(department_id);  -- Critical for filtering by user's department
-- CREATE INDEX idx_tasks_reporter_id ON tasks(reporter_id);
-- CREATE INDEX idx_tasks_deliverable_id ON tasks(deliverable_id);
-- CREATE INDEX idx_tasks_created_at ON tasks(created_at);
-- CREATE INDEX idx_tasks_start_date ON tasks(start_date);
-- CREATE INDEX idx_tasks_end_date ON tasks(end_date);
-- CREATE INDEX idx_tasks_is_active ON tasks(is_active);  -- For soft delete filtering
-- Removed: is_vip, reworked, use_shutterstock (rarely filtered, add if needed)

-- Composite indexes for common filter combinations (CRITICAL for performance)
-- Month + User (most common filter combination)
-- CREATE INDEX idx_tasks_month_user ON tasks(month_id, user_id);
-- Month + Department (for filtering tasks by department)
-- CREATE INDEX idx_tasks_month_department ON tasks(month_id, department_id);
-- Month + Reporter
-- CREATE INDEX idx_tasks_month_reporter ON tasks(month_id, reporter_id);
-- Month + Deliverable
-- CREATE INDEX idx_tasks_month_deliverable ON tasks(month_id, deliverable_id);
-- Department + User (for user's department tasks)
-- CREATE INDEX idx_tasks_department_user ON tasks(department_id, user_id);
-- User + Date range (for user analytics)
-- CREATE INDEX idx_tasks_user_date ON tasks(user_id, start_date);
-- User + Deliverable (for user performance by deliverable)
-- CREATE INDEX idx_tasks_user_deliverable ON tasks(user_id, deliverable_id);
-- Reporter + Deliverable (for reporter analytics)
-- CREATE INDEX idx_tasks_reporter_deliverable ON tasks(reporter_id, deliverable_id);
-- Month + Deliverable + User (for complex analytics)
-- CREATE INDEX idx_tasks_month_deliverable_user ON tasks(month_id, deliverable_id, user_id);

-- Markets Indexes
-- CREATE INDEX idx_markets_code ON markets(code);
-- CREATE INDEX idx_markets_is_active ON markets(is_active);

-- Junction Tables Indexes
-- CREATE INDEX idx_task_markets_task_id ON task_markets(task_id);
-- CREATE INDEX idx_task_markets_market_id ON task_markets(market_id);  -- Updated from market to market_id
-- CREATE INDEX idx_task_departments_task_id ON task_departments(task_id);
-- Note: No index for department_id - removed from task_departments table
-- CREATE INDEX idx_task_deliverables_task_id ON task_deliverables(task_id);  -- UNIQUE constraint already provides index
-- Analytics indexes for task_deliverables (for calculations)
-- CREATE INDEX idx_task_deliverables_count ON task_deliverables(count);
-- CREATE INDEX idx_task_deliverables_variations ON task_deliverables(variations_enabled, variations_count);
-- CREATE INDEX idx_task_ai_usage_task_id ON task_ai_usage(task_id);
-- CREATE INDEX idx_task_ai_usage_ai_time ON task_ai_usage(ai_time);

-- Team Days Off Indexes
-- CREATE INDEX idx_team_days_off_user_id ON team_days_off(user_id);
-- CREATE INDEX idx_team_days_off_department_id ON team_days_off(department_id);
-- CREATE INDEX idx_team_days_off_dates_team_id ON team_days_off_dates(team_days_off_id);
-- CREATE INDEX idx_team_days_off_dates_date_string ON team_days_off_dates(date_string);
-- CREATE INDEX idx_team_days_off_dates_year_month ON team_days_off_dates(year, month);

-- ============================================================================
-- DATA VALIDATION CONSTRAINTS
-- ============================================================================

-- Check constraints for data integrity
-- Note: All CHECK constraints are defined inline in table definitions for SQLFlow compatibility
-- - years.year CHECK constraint is defined in table definition
-- - months.month CHECK constraint is defined in table definition
-- - months date_range CHECK constraint is defined in table definition
-- - tasks.date_range and time_positive CHECK constraints are defined in table definition
-- - task_deliverables count and variations CHECK constraints are defined in table definition
-- - task_ai_usage.ai_time CHECK constraint is defined in table definition
-- - deliverables.time_per_unit and variations_time CHECK constraints are defined in table definition

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================
-- NOTE: SQLFlow doesn't support PostgreSQL functions/triggers
-- For production database, add these in your actual database setup:

-- Function to auto-update updated_at timestamp:
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = CURRENT_TIMESTAMP;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- Triggers for auto-updating updated_at:
-- CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_reporters_updated_at BEFORE UPDATE ON reporters
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Note: No trigger for users.updated_at - users table doesn't have updated_at field
-- Users are created once and not updated, so no need for updated_at/updated_by_id
-- CREATE TRIGGER update_years_updated_at BEFORE UPDATE ON years
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_months_updated_at BEFORE UPDATE ON months
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Note: years and months are system-generated, triggers optional
-- CREATE TRIGGER update_deliverables_updated_at BEFORE UPDATE ON deliverables
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- CREATE TRIGGER update_team_days_off_updated_at BEFORE UPDATE ON team_days_off
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PRODUCTION-ONLY: DEPARTMENT CONSISTENCY GUARD (NOT SUPPORTED BY SQLFLOW UI)
-- ============================================================================
-- Ensures tasks.department_id matches both deliverables.department_id and the
-- department implied by months.year_id. Marked DEFERRABLE so multi-statement
-- workflows can insert related rows before constraint checks.
-- Uncomment in real Postgres; leave commented for SQLFlow visualization.
--
-- CREATE OR REPLACE FUNCTION enforce_task_department()
-- RETURNS TRIGGER AS $$
-- DECLARE
--   deliverable_dept UUID;
--   month_dept UUID;
-- BEGIN
--   SELECT department_id INTO deliverable_dept
--   FROM deliverables
--   WHERE id = NEW.deliverable_id;
--
--   SELECT y.department_id INTO month_dept
--   FROM months m
--   JOIN years y ON m.year_id = y.id
--   WHERE m.id = NEW.month_id;
--
--   IF deliverable_dept IS NULL OR month_dept IS NULL THEN
--     RAISE EXCEPTION 'Invalid deliverable or month reference';
--   END IF;
--
--   IF NEW.department_id IS DISTINCT FROM deliverable_dept
--      OR NEW.department_id IS DISTINCT FROM month_dept THEN
--     RAISE EXCEPTION 'tasks.department_id must match deliverable and month/year department';
--   END IF;
--
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- DROP TRIGGER IF EXISTS trg_enforce_task_department ON tasks;
-- CREATE CONSTRAINT TRIGGER trg_enforce_task_department
-- AFTER INSERT OR UPDATE ON tasks
-- DEFERRABLE INITIALLY DEFERRED
-- FOR EACH ROW EXECUTE FUNCTION enforce_task_department();

-- ============================================================================
-- ANALYTICS AND CALCULATION SUPPORT
-- ============================================================================

-- The following indexes and structure support:
-- 1. Multiple filters: month, user, reporter, deliverable, department (via composite indexes)
-- 2. Calculations: SUM, COUNT, AVG on task_deliverables (count, variations_count)
-- 3. Percentages: Can calculate % of tasks, % of deliverables, % of variations
-- 4. Comparisons: Month-to-month, year-to-year, user-to-user (via date and user indexes)
-- 5. Time-based analytics: Date range queries (start_date, end_date indexes)
-- 6. Performance metrics: User performance (user_id + deliverable_id composite)
-- 7. Department analytics: Filter by deliverable → department (deliverable_id index)

-- Example Analytics Queries Supported:
-- - Filter by month + user: Uses idx_tasks_month_user
-- - Filter by month + deliverable: Uses idx_tasks_month_deliverable
-- - Calculate total deliverables: SUM(task_deliverables.count) with idx_task_deliverables_count
-- - Calculate percentages: COUNT(*) with GROUP BY using composite indexes
-- - Month-to-month comparison: Compare two months using month_id indexes
-- - User performance: Aggregate by user_id + deliverable_id using idx_tasks_user_deliverable
-- - Time range queries: Filter by start_date/end_date using date indexes

-- ============================================================================
-- PRODUCTION READINESS CHECKLIST
-- ============================================================================
-- ✅ UUID Primary Keys: For SQLFlow compatibility, DEFAULT removed
--    In production PostgreSQL, add DEFAULT gen_random_uuid() to all UUID PRIMARY KEY columns
-- ✅ Indexes: Added for all foreign keys and common filter columns
-- ✅ Composite Indexes: Added for common filter combinations (removed rarely-used boolean indexes)
-- ✅ Data Validation: Check constraints for data integrity (defined in table definitions)
-- ✅ Analytics Support: Indexes optimized for SUM, COUNT, GROUP BY queries
-- ✅ Filtering Support: Multiple filter combinations supported via composite indexes
-- ✅ Calculation Support: Indexes on numeric fields for aggregations
-- ✅ Comparison Support: Date and user indexes for period comparisons
-- ✅ Performance: Composite indexes reduce query execution time
-- ✅ Data Integrity: Foreign keys ensure referential integrity (user_id, reporter_id, deliverable_id)
-- ✅ Clean Structure: No redundant denormalized fields
-- ✅ Task Deliverables: Simplified - no redundant deliverable_id column (accessed via task relationship)
-- ✅ Team Days Off: Proper parent-child relationship with team_days_off → team_days_off_dates
-- ✅ Soft Delete: is_active fields added to users, reporters, tasks, months, years, deliverables
-- ✅ Consistent Auditing: created_by_id/updated_by_id added to departments
-- ✅ Reference Tables: markets table for data integrity (replaces string-based task_markets)
-- ✅ Department Consistency: FK-based task_departments (replaces string-based)
-- ✅ Email Uniqueness: reporters.email is UNIQUE to prevent ambiguity
-- ✅ Deliverable Names: Unique per department (allows same name in different departments)
-- ✅ Cascading Strategy: Standardized (CASCADE for junctions, RESTRICT for core, SET NULL for optional)
-- ✅ Simple Design: No forced business rules - application layer handles validation
-- ============================================================================

-- ============================================================================
-- SAMPLE DATA FOR ANALYTICS CALCULATIONS
-- ============================================================================
-- This data supports all analytics card calculations:
-- - Product Analytics: product casino, product sport, product poker, product lotto
-- - Marketing Analytics: marketing casino, marketing sport, marketing poker, marketing lotto
-- - Acquisition Analytics: acquisition casino, acquisition sport, acquisition poker, acquisition lotto
-- - AI Analytics: AI usage by user, models, time, markets, products
-- - Reporter Analytics: Tasks by reporter, hours, markets, products
-- - Shutterstock Analytics: Tasks using Shutterstock by user, markets
-- - Total Analytics: Total tasks, hours by category
-- ============================================================================

-- ============================================================================
-- TIER 1: REFERENCE DATA (Teams, Departments)
-- ============================================================================

-- Teams
INSERT INTO teams (id, name, display_name, description, is_active) VALUES
('11111111-1111-1111-1111-111111111111', 'racheta', 'Racheta Team', 'Main production team', true),
('22222222-2222-2222-2222-222222222222', 'team1', 'Team 1', 'Secondary team', true),
('33333333-3333-3333-3333-333333333333', 'team2', 'Team 2', 'Tertiary team', true);

-- Departments (design, video, dev)
INSERT INTO departments (id, team_id, name, display_name, description, is_active) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'design', 'Design Department', 'Graphic design and visual content', true),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'video', 'Video Department', 'Video production and editing', true),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'dev', 'Development Department', 'Software development', true);

-- ============================================================================
-- TIER 2: USERS AND REPORTERS
-- ============================================================================

-- Users (with different departments for analytics)
INSERT INTO users (id, email, name, role, password_hash, department_id, is_active) VALUES
('user1111-1111-1111-1111-111111111111', 'designer1@example.com', 'Alice Designer', 'user', 'hash1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true),
('user2222-2222-2222-2222-222222222222', 'designer2@example.com', 'Bob Designer', 'user', 'hash2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true),
('user3333-3333-3333-3333-333333333333', 'video1@example.com', 'Charlie Video', 'user', 'hash3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true),
('user4444-4444-4444-4444-444444444444', 'video2@example.com', 'Diana Video', 'user', 'hash4', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true),
('user5555-5555-5555-5555-555555555555', 'dev1@example.com', 'Eve Developer', 'user', 'hash5', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true),
('admin0000-0000-0000-0000-000000000000', 'admin@example.com', 'Admin User', 'admin', 'adminhash', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- Reporters (for reporter analytics)
INSERT INTO reporters (id, name, email, channel, channel_name, country, is_active, created_by_id) VALUES
('reporter1-1111-1111-1111-111111111111', 'John Reporter', 'john@reporter.com', 'email', 'Email Channel', 'RO', true, 'admin0000-0000-0000-0000-000000000000'),
('reporter2-2222-2222-2222-222222222222', 'Jane Reporter', 'jane@reporter.com', 'slack', 'Slack Channel', 'UK', true, 'admin0000-0000-0000-0000-000000000000'),
('reporter3-3333-3333-3333-333333333333', 'Mike Reporter', 'mike@reporter.com', 'email', 'Email Channel', 'IE', true, 'admin0000-0000-0000-0000-000000000000'),
('reporter4-4444-4444-4444-444444444444', 'Sarah Reporter', 'sarah@reporter.com', 'slack', 'Slack Channel', 'DE', true, 'admin0000-0000-0000-0000-000000000000');

-- ============================================================================
-- TIER 3: YEARS, MONTHS, DELIVERABLES
-- ============================================================================

-- Years (2024 for design department)
INSERT INTO years (id, department_id, year, is_active) VALUES
('year2024-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2024, true),
('year2024-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 2024, true),
('year2024-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 2024, true);

-- Months (January 2024 for design department)
INSERT INTO months (id, year_id, month_name, start_date, end_date, days_in_month, month, is_active) VALUES
('month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'year2024-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'January 2024', '2024-01-01', '2024-01-31', 31, 1, true),
('month2024-01-bbbb-bbbb-bbbbbbbbbbbb', 'year2024-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'January 2024', '2024-01-01', '2024-01-31', 31, 1, true),
('month2024-01-cccc-cccc-cccccccccccc', 'year2024-cccc-cccc-cccc-cccccccccccc', 'January 2024', '2024-01-01', '2024-01-31', 31, 1, true);

-- Additional months for month-over-month analytics (February 2024 for all departments)
INSERT INTO months (id, year_id, month_name, start_date, end_date, days_in_month, month, is_active) VALUES
('month2024-02-aaaa-aaaa-aaaaaaaaaaaa', 'year2024-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'February 2024', '2024-02-01', '2024-02-29', 29, 2, true),
('month2024-02-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'year2024-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'February 2024', '2024-02-01', '2024-02-29', 29, 2, true),
('month2024-02-cccc-cccc-cccc-cccccccccccc', 'year2024-cccc-cccc-cccc-cccccccccccc', 'February 2024', '2024-02-01', '2024-02-29', 29, 2, true);

-- Deliverables (for design department)
INSERT INTO deliverables (id, name, description, department_id, time_per_unit, time_unit, variations_time, variations_time_unit, requires_quantity, is_active, created_by_id) VALUES
('deliver1-1111-1111-1111-111111111111', 'Logo Design', 'Create logo designs', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 4.0, 'hr', 30.0, 'min', true, true, 'admin0000-0000-0000-0000-000000000000'),
('deliver2-2222-2222-2222-222222222222', 'Banner Design', 'Create banner designs', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2.5, 'hr', 15.0, 'min', true, true, 'admin0000-0000-0000-0000-000000000000'),
('deliver3-3333-3333-3333-333333333333', 'Social Media Post', 'Create social media posts', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1.5, 'hr', 10.0, 'min', true, true, 'admin0000-0000-0000-0000-000000000000'),
('deliver4-4444-4444-4444-444444444444', 'Video Edit', 'Edit video content', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 6.0, 'hr', 45.0, 'min', true, true, 'admin0000-0000-0000-0000-000000000000'),
('deliver5-5555-5555-5555-555555555555', 'Feature Development', 'Develop new features', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 8.0, 'hr', 0, 'min', false, true, 'admin0000-0000-0000-0000-000000000000');

-- ============================================================================
-- TIER 4: MARKETS (Reference Table)
-- ============================================================================

INSERT INTO markets (id, code, name, is_active) VALUES
('market-ro-1111-1111-1111-111111111111', 'ro', 'Romania', true),
('market-com-2222-2222-2222-222222222222', 'com', 'International', true),
('market-uk-3333-3333-3333-333333333333', 'uk', 'United Kingdom', true),
('market-ie-4444-4444-4444-444444444444', 'ie', 'Ireland', true),
('market-fi-5555-5555-5555-555555555555', 'fi', 'Finland', true),
('market-dk-6666-6666-6666-666666666666', 'dk', 'Denmark', true),
('market-de-7777-7777-7777-777777777777', 'de', 'Germany', true),
('market-at-8888-8888-8888-888888888888', 'at', 'Austria', true),
('market-it-9999-9999-9999-999999999999', 'it', 'Italy', true),
('market-gr-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'gr', 'Greece', true),
('market-fr-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'fr', 'France', true);

-- ============================================================================
-- TIER 5: TASKS WITH ANALYTICS DATA
-- ============================================================================

-- Product Casino Tasks (for Product Analytics)
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0001-0000-0000-0000-000000000001', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver1-1111-1111-1111-111111111111', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-001', 'Casino Logo Design', 'product casino', 4.5, '2024-01-05', '2024-01-07', false, false, false, true, 'user1111-1111-1111-1111-111111111111'),
('task0002-0000-0000-0000-000000000002', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver1-1111-1111-1111-111111111111', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-002', 'Casino Banner Design', 'product casino', 3.0, '2024-01-08', '2024-01-09', false, false, true, true, 'user1111-1111-1111-1111-111111111111'),
('task0003-0000-0000-0000-000000000003', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-003', 'Casino Social Post', 'product casino', 2.0, '2024-01-10', '2024-01-10', true, false, false, true, 'user2222-2222-2222-2222-222222222222'),
('task0004-0000-0000-0000-000000000004', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver1-1111-1111-1111-111111111111', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-004', 'Casino VIP Logo', 'product casino', 5.0, '2024-01-12', '2024-01-14', true, true, false, true, 'user2222-2222-2222-2222-222222222222');

-- Product Sport Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0005-0000-0000-0000-000000000005', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-005', 'Sport Banner Design', 'product sport', 2.5, '2024-01-15', '2024-01-16', false, false, false, true, 'user1111-1111-1111-1111-111111111111'),
('task0006-0000-0000-0000-000000000006', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter3-3333-3333-3333-333333333333', 'board-006', 'Sport Social Media', 'product sport', 1.8, '2024-01-17', '2024-01-17', false, false, true, true, 'user2222-2222-2222-2222-222222222222'),
('task0007-0000-0000-0000-000000000007', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver1-1111-1111-1111-111111111111', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-007', 'Sport Logo Design', 'product sport', 4.2, '2024-01-18', '2024-01-19', false, false, false, true, 'user1111-1111-1111-1111-111111111111');

-- Product Poker Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0008-0000-0000-0000-000000000008', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver1-1111-1111-1111-111111111111', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter3-3333-3333-3333-333333333333', 'board-008', 'Poker Logo Design', 'product poker', 4.0, '2024-01-20', '2024-01-22', false, false, false, true, 'user2222-2222-2222-2222-222222222222'),
('task0009-0000-0000-0000-000000000009', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter4-4444-4444-4444-444444444444', 'board-009', 'Poker Banner', 'product poker', 2.8, '2024-01-23', '2024-01-24', false, false, true, true, 'user1111-1111-1111-1111-111111111111');

-- Product Lotto Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0010-0000-0000-0000-000000000010', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver1-1111-1111-1111-111111111111', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-010', 'Lotto Logo Design', 'product lotto', 3.5, '2024-01-25', '2024-01-26', false, false, false, true, 'user2222-2222-2222-2222-222222222222');

-- Marketing Casino Tasks (for Marketing Analytics)
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0011-0000-0000-0000-000000000011', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-011', 'Marketing Casino Banner', 'marketing casino', 3.2, '2024-01-05', '2024-01-06', false, false, false, true, 'user1111-1111-1111-1111-111111111111'),
('task0012-0000-0000-0000-000000000012', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-012', 'Marketing Casino Post', 'marketing casino', 2.1, '2024-01-07', '2024-01-07', false, false, true, true, 'user2222-2222-2222-2222-222222222222'),
('task0013-0000-0000-0000-000000000013', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-013', 'Marketing Casino Ad', 'marketing casino', 2.8, '2024-01-08', '2024-01-09', false, false, false, true, 'user1111-1111-1111-1111-111111111111');

-- Marketing Sport Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0014-0000-0000-0000-000000000014', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter3-3333-3333-3333-333333333333', 'board-014', 'Marketing Sport Banner', 'marketing sport', 2.6, '2024-01-10', '2024-01-11', false, false, false, true, 'user2222-2222-2222-2222-222222222222'),
('task0015-0000-0000-0000-000000000015', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-015', 'Marketing Sport Post', 'marketing sport', 1.9, '2024-01-12', '2024-01-12', false, false, true, true, 'user1111-1111-1111-1111-111111111111');

-- Marketing Poker Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0016-0000-0000-0000-000000000016', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter4-4444-4444-4444-444444444444', 'board-016', 'Marketing Poker Banner', 'marketing poker', 2.4, '2024-01-13', '2024-01-14', false, false, false, true, 'user2222-2222-2222-2222-222222222222');

-- Marketing Lotto Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0017-0000-0000-0000-000000000017', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-017', 'Marketing Lotto Post', 'marketing lotto', 1.7, '2024-01-15', '2024-01-15', false, false, true, true, 'user1111-1111-1111-1111-111111111111');

-- Acquisition Casino Tasks (for Acquisition Analytics)
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0018-0000-0000-0000-000000000018', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-018', 'Acquisition Casino Banner', 'acquisition casino', 3.1, '2024-01-16', '2024-01-17', false, false, false, true, 'user2222-2222-2222-2222-222222222222'),
('task0019-0000-0000-0000-000000000019', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter3-3333-3333-3333-333333333333', 'board-019', 'Acquisition Casino Ad', 'acquisition casino', 2.3, '2024-01-18', '2024-01-18', false, false, true, true, 'user1111-1111-1111-1111-111111111111');

-- Acquisition Sport Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0020-0000-0000-0000-000000000020', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter4-4444-4444-4444-444444444444', 'board-020', 'Acquisition Sport Banner', 'acquisition sport', 2.9, '2024-01-19', '2024-01-20', false, false, false, true, 'user2222-2222-2222-2222-222222222222');

-- Misc Tasks (for Total Analytics)
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0021-0000-0000-0000-000000000021', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-021', 'Misc Design Task', 'misc', 1.5, '2024-01-21', '2024-01-21', false, false, false, true, 'user1111-1111-1111-1111-111111111111'),
('task0022-0000-0000-0000-000000000022', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-022', 'Misc Banner Task', 'misc', 2.0, '2024-01-22', '2024-01-23', false, false, true, true, 'user2222-2222-2222-2222-222222222222');

-- Additional Product Tasks for better analytics coverage
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0023-0000-0000-0000-000000000023', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver1-1111-1111-1111-111111111111', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter3-3333-3333-3333-333333333333', 'board-023', 'Casino Logo Redesign', 'product casino', 5.5, '2024-01-27', '2024-01-29', true, false, false, true, 'user1111-1111-1111-1111-111111111111'),
('task0024-0000-0000-0000-000000000024', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter4-4444-4444-4444-444444444444', 'board-024', 'Sport Banner Series', 'product sport', 4.2, '2024-01-28', '2024-01-30', false, false, true, true, 'user2222-2222-2222-2222-222222222222'),
('task0025-0000-0000-0000-000000000025', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-025', 'Poker Social Campaign', 'product poker', 3.8, '2024-01-29', '2024-01-31', false, false, false, true, 'user1111-1111-1111-1111-111111111111');

-- Additional Marketing Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0026-0000-0000-0000-000000000026', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-026', 'Marketing Casino Promo', 'marketing casino', 3.5, '2024-01-26', '2024-01-27', false, false, false, true, 'user2222-2222-2222-2222-222222222222'),
('task0027-0000-0000-0000-000000000027', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter3-3333-3333-3333-333333333333', 'board-027', 'Marketing Sport Ad', 'marketing sport', 2.4, '2024-01-28', '2024-01-28', false, false, true, true, 'user1111-1111-1111-1111-111111111111'),
('task0028-0000-0000-0000-000000000028', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter4-4444-4444-4444-444444444444', 'board-028', 'Marketing Lotto Banner', 'marketing lotto', 2.7, '2024-01-29', '2024-01-30', false, false, false, true, 'user2222-2222-2222-2222-222222222222');

-- Additional Acquisition Tasks
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('task0029-0000-0000-0000-000000000029', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter1-1111-1111-1111-111111111111', 'board-029', 'Acquisition Casino Post', 'acquisition casino', 2.0, '2024-01-27', '2024-01-27', false, false, true, true, 'user1111-1111-1111-1111-111111111111'),
('task0030-0000-0000-0000-000000000030', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-030', 'Acquisition Sport Ad', 'acquisition sport', 3.2, '2024-01-28', '2024-01-29', false, false, false, true, 'user2222-2222-2222-2222-222222222222'),
('task0031-0000-0000-0000-000000000031', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver1-1111-1111-1111-111111111111', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter3-3333-3333-3333-333333333333', 'board-031', 'Acquisition Poker Logo', 'acquisition poker', 4.8, '2024-01-30', '2024-01-31', false, true, false, true, 'user1111-1111-1111-1111-111111111111'),
('task0032-0000-0000-0000-000000000032', 'month2024-01-aaaa-aaaa-aaaaaaaaaaaa', 'deliver3-3333-3333-3333-333333333333', 'user2222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter4-4444-4444-4444-444444444444', 'board-032', 'Acquisition Lotto Post', 'acquisition lotto', 1.9, '2024-01-31', '2024-01-31', false, false, true, true, 'user2222-2222-2222-2222-222222222222');

-- Additional coverage: video/dev departments and February data for MoM/departmental analytics
INSERT INTO tasks (id, month_id, deliverable_id, user_id, department_id, reporter_id, board_id, task_name, products, time_in_hours, start_date, end_date, is_vip, reworked, use_shutterstock, is_active, created_by_id) VALUES
('taskv001-0000-0000-0000-000000000001', 'month2024-01-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'deliver4-4444-4444-4444-444444444444', 'user3333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'reporter2-2222-2222-2222-222222222222', 'board-v01', 'Video Edit Sport', 'product sport', 6.5, '2024-01-08', '2024-01-10', false, false, false, true, 'admin0000-0000-0000-0000-000000000000'),
('taskv002-0000-0000-0000-000000000002', 'month2024-02-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'deliver4-4444-4444-4444-444444444444', 'user4444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'reporter3-3333-3333-3333-333333333333', 'board-v02', 'Video Edit Casino', 'marketing casino', 7.0, '2024-02-05', '2024-02-07', true, false, true, true, 'admin0000-0000-0000-0000-000000000000'),
('taskd001-0000-0000-0000-000000000001', 'month2024-01-cccc-cccc-cccccccccccc', 'deliver5-5555-5555-5555-555555555555', 'user5555-5555-5555-5555-555555555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'reporter4-4444-4444-4444-444444444444', 'board-d01', 'Feature Dev Poker', 'product poker', 9.0, '2024-01-12', '2024-01-20', false, true, false, true, 'admin0000-0000-0000-0000-000000000000'),
('taskd002-0000-0000-0000-000000000002', 'month2024-02-cccc-cccc-cccccccccccc', 'deliver5-5555-5555-5555-555555555555', 'user5555-5555-5555-5555-555555555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'reporter1-1111-1111-1111-111111111111', 'board-d02', 'Feature Dev Lotto', 'acquisition lotto', 8.5, '2024-02-10', '2024-02-18', true, false, false, true, 'admin0000-0000-0000-0000-000000000000'),
('taskdsgf01-0000-0000-0000-000000000001', 'month2024-02-aaaa-aaaa-aaaaaaaaaaaa', 'deliver2-2222-2222-2222-222222222222', 'user1111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'reporter2-2222-2222-2222-222222222222', 'board-msa1', 'Marketing Sport Feb', 'marketing sport', 2.2, '2024-02-11', '2024-02-12', false, false, true, true, 'user1111-1111-1111-1111-111111111111');

-- ============================================================================
-- TIER 6: TASK MARKETS (Many-to-Many: Tasks ↔ Markets)
-- ============================================================================

-- Product Casino Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0001-0000-0000-0000-000000000001', 'task0001-0000-0000-0000-000000000001', 'market-ro-1111-1111-1111-111111111111'),
('tm0002-0000-0000-0000-000000000002', 'task0001-0000-0000-0000-000000000001', 'market-uk-3333-3333-3333-333333333333'),
('tm0003-0000-0000-0000-000000000003', 'task0002-0000-0000-0000-000000000002', 'market-com-2222-2222-2222-222222222222'),
('tm0004-0000-0000-0000-000000000004', 'task0002-0000-0000-0000-000000000002', 'market-ie-4444-4444-4444-444444444444'),
('tm0005-0000-0000-0000-000000000005', 'task0003-0000-0000-0000-000000000003', 'market-ro-1111-1111-1111-111111111111'),
('tm0006-0000-0000-0000-000000000006', 'task0004-0000-0000-0000-000000000004', 'market-de-7777-7777-7777-777777777777'),
('tm0007-0000-0000-0000-000000000007', 'task0004-0000-0000-0000-000000000004', 'market-at-8888-8888-8888-888888888888');

-- Product Sport Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0008-0000-0000-0000-000000000008', 'task0005-0000-0000-0000-000000000005', 'market-uk-3333-3333-3333-333333333333'),
('tm0009-0000-0000-0000-000000000009', 'task0005-0000-0000-0000-000000000005', 'market-ie-4444-4444-4444-444444444444'),
('tm0010-0000-0000-0000-000000000010', 'task0006-0000-0000-0000-000000000006', 'market-fi-5555-5555-5555-555555555555'),
('tm0011-0000-0000-0000-000000000011', 'task0007-0000-0000-0000-000000000007', 'market-dk-6666-6666-6666-666666666666'),
('tm0012-0000-0000-0000-000000000012', 'task0007-0000-0000-0000-000000000007', 'market-com-2222-2222-2222-222222222222');

-- Product Poker Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0013-0000-0000-0000-000000000013', 'task0008-0000-0000-0000-000000000008', 'market-it-9999-9999-9999-999999999999'),
('tm0014-0000-0000-0000-000000000014', 'task0009-0000-0000-0000-000000000009', 'market-gr-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('tm0015-0000-0000-0000-000000000015', 'task0009-0000-0000-0000-000000000009', 'market-fr-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Product Lotto Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0016-0000-0000-0000-000000000016', 'task0010-0000-0000-0000-000000000010', 'market-ro-1111-1111-1111-111111111111'),
('tm0017-0000-0000-0000-000000000017', 'task0010-0000-0000-0000-000000000010', 'market-com-2222-2222-2222-222222222222');

-- Marketing Casino Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0018-0000-0000-0000-000000000018', 'task0011-0000-0000-0000-000000000011', 'market-ro-1111-1111-1111-111111111111'),
('tm0019-0000-0000-0000-000000000019', 'task0011-0000-0000-0000-000000000011', 'market-uk-3333-3333-3333-333333333333'),
('tm0020-0000-0000-0000-000000000020', 'task0012-0000-0000-0000-000000000012', 'market-ie-4444-4444-4444-444444444444'),
('tm0021-0000-0000-0000-000000000021', 'task0013-0000-0000-0000-000000000013', 'market-de-7777-7777-7777-777777777777'),
('tm0022-0000-0000-0000-000000000022', 'task0013-0000-0000-0000-000000000013', 'market-at-8888-8888-8888-888888888888');

-- Marketing Sport Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0023-0000-0000-0000-000000000023', 'task0014-0000-0000-0000-000000000014', 'market-fi-5555-5555-5555-555555555555'),
('tm0024-0000-0000-0000-000000000024', 'task0014-0000-0000-0000-000000000014', 'market-dk-6666-6666-6666-666666666666'),
('tm0025-0000-0000-0000-000000000025', 'task0015-0000-0000-0000-000000000015', 'market-com-2222-2222-2222-222222222222');

-- Marketing Poker Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0026-0000-0000-0000-000000000026', 'task0016-0000-0000-0000-000000000016', 'market-it-9999-9999-9999-999999999999'),
('tm0027-0000-0000-0000-000000000027', 'task0016-0000-0000-0000-000000000016', 'market-gr-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Marketing Lotto Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0028-0000-0000-0000-000000000028', 'task0017-0000-0000-0000-000000000017', 'market-fr-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('tm0029-0000-0000-0000-000000000029', 'task0017-0000-0000-0000-000000000017', 'market-ro-1111-1111-1111-111111111111');

-- Acquisition Casino Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0030-0000-0000-0000-000000000030', 'task0018-0000-0000-0000-000000000018', 'market-uk-3333-3333-3333-333333333333'),
('tm0031-0000-0000-0000-000000000031', 'task0018-0000-0000-0000-000000000018', 'market-ie-4444-4444-4444-444444444444'),
('tm0032-0000-0000-0000-000000000032', 'task0019-0000-0000-0000-000000000019', 'market-com-2222-2222-2222-222222222222');

-- Acquisition Sport Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0033-0000-0000-0000-000000000033', 'task0020-0000-0000-0000-000000000020', 'market-fi-5555-5555-5555-555555555555'),
('tm0034-0000-0000-0000-000000000034', 'task0020-0000-0000-0000-000000000020', 'market-dk-6666-6666-6666-666666666666'),
('tm0035-0000-0000-0000-000000000035', 'task0020-0000-0000-0000-000000000020', 'market-de-7777-7777-7777-777777777777');

-- Misc Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0036-0000-0000-0000-000000000036', 'task0021-0000-0000-0000-000000000021', 'market-at-8888-8888-8888-888888888888'),
('tm0037-0000-0000-0000-000000000037', 'task0022-0000-0000-0000-000000000022', 'market-it-9999-9999-9999-999999999999');

-- Additional Product Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0038-0000-0000-0000-000000000038', 'task0023-0000-0000-0000-000000000023', 'market-ro-1111-1111-1111-111111111111'),
('tm0039-0000-0000-0000-000000000039', 'task0023-0000-0000-0000-000000000023', 'market-com-2222-2222-2222-222222222222'),
('tm0040-0000-0000-0000-000000000040', 'task0023-0000-0000-0000-000000000023', 'market-uk-3333-3333-3333-333333333333'),
('tm0041-0000-0000-0000-000000000041', 'task0024-0000-0000-0000-000000000024', 'market-fi-5555-5555-5555-555555555555'),
('tm0042-0000-0000-0000-000000000042', 'task0024-0000-0000-0000-000000000024', 'market-dk-6666-6666-6666-666666666666'),
('tm0043-0000-0000-0000-000000000043', 'task0025-0000-0000-0000-000000000025', 'market-it-9999-9999-9999-999999999999'),
('tm0044-0000-0000-0000-000000000044', 'task0025-0000-0000-0000-000000000025', 'market-gr-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Additional Marketing Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0045-0000-0000-0000-000000000045', 'task0026-0000-0000-0000-000000000026', 'market-de-7777-7777-7777-777777777777'),
('tm0046-0000-0000-0000-000000000046', 'task0026-0000-0000-0000-000000000026', 'market-at-8888-8888-8888-888888888888'),
('tm0047-0000-0000-0000-000000000047', 'task0027-0000-0000-0000-000000000027', 'market-com-2222-2222-2222-222222222222'),
('tm0048-0000-0000-0000-000000000048', 'task0028-0000-0000-0000-000000000028', 'market-fr-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('tm0049-0000-0000-0000-000000000049', 'task0028-0000-0000-0000-000000000028', 'market-ro-1111-1111-1111-111111111111');

-- Additional Acquisition Tasks Markets
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tm0050-0000-0000-0000-000000000050', 'task0029-0000-0000-0000-000000000029', 'market-ie-4444-4444-4444-444444444444'),
('tm0051-0000-0000-0000-000000000051', 'task0029-0000-0000-0000-000000000029', 'market-uk-3333-3333-3333-333333333333'),
('tm0052-0000-0000-0000-000000000052', 'task0030-0000-0000-0000-000000000030', 'market-fi-5555-5555-5555-555555555555'),
('tm0053-0000-0000-0000-000000000053', 'task0030-0000-0000-0000-000000000030', 'market-dk-6666-6666-6666-666666666666'),
('tm0054-0000-0000-0000-000000000054', 'task0031-0000-0000-0000-000000000031', 'market-it-9999-9999-9999-999999999999'),
('tm0055-0000-0000-0000-000000000055', 'task0031-0000-0000-0000-000000000031', 'market-gr-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('tm0056-0000-0000-0000-000000000056', 'task0032-0000-0000-0000-000000000032', 'market-fr-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- Markets for additional video/dev/February tasks
INSERT INTO task_markets (id, task_id, market_id) VALUES
('tmv001-0000-0000-0000-000000000001', 'taskv001-0000-0000-0000-000000000001', 'market-uk-3333-3333-3333-333333333333'),
('tmv002-0000-0000-0000-000000000002', 'taskv001-0000-0000-0000-000000000001', 'market-fi-5555-5555-5555-555555555555'),
('tmv003-0000-0000-0000-000000000003', 'taskv002-0000-0000-0000-000000000002', 'market-ro-1111-1111-1111-111111111111'),
('tmd001-0000-0000-0000-000000000001', 'taskd001-0000-0000-0000-000000000001', 'market-it-9999-9999-9999-999999999999'),
('tmd002-0000-0000-0000-000000000002', 'taskd002-0000-0000-0000-000000000002', 'market-com-2222-2222-2222-222222222222'),
('tmmsa1-0000-0000-0000-000000000001', 'taskdsgf01-0000-0000-0000-000000000001', 'market-de-7777-7777-7777-777777777777');

-- ============================================================================
-- TIER 7: TASK DELIVERABLES (One-to-One: Tasks → Deliverable Details)
-- ============================================================================

-- Task Deliverables with counts and variations (for analytics calculations)
INSERT INTO task_deliverables (id, task_id, count, variations_enabled, variations_count) VALUES
('td0001-0000-0000-0000-000000000001', 'task0001-0000-0000-0000-000000000001', 1, true, 3),
('td0002-0000-0000-0000-000000000002', 'task0002-0000-0000-0000-000000000002', 2, true, 2),
('td0003-0000-0000-0000-000000000003', 'task0003-0000-0000-0000-000000000003', 1, false, 0),
('td0004-0000-0000-0000-000000000004', 'task0004-0000-0000-0000-000000000004', 1, true, 4),
('td0005-0000-0000-0000-000000000005', 'task0005-0000-0000-0000-000000000005', 3, true, 1),
('td0006-0000-0000-0000-000000000006', 'task0006-0000-0000-0000-000000000006', 1, false, 0),
('td0007-0000-0000-0000-000000000007', 'task0007-0000-0000-0000-000000000007', 1, true, 2),
('td0008-0000-0000-0000-000000000008', 'task0008-0000-0000-0000-000000000008', 1, false, 0),
('td0009-0000-0000-0000-000000000009', 'task0009-0000-0000-0000-000000000009', 2, true, 1),
('td0010-0000-0000-0000-000000000010', 'task0010-0000-0000-0000-000000000010', 1, true, 3),
('td0011-0000-0000-0000-000000000011', 'task0011-0000-0000-0000-000000000011', 2, false, 0),
('td0012-0000-0000-0000-000000000012', 'task0012-0000-0000-0000-000000000012', 1, false, 0),
('td0013-0000-0000-0000-000000000013', 'task0013-0000-0000-0000-000000000013', 1, true, 1),
('td0014-0000-0000-0000-000000000014', 'task0014-0000-0000-0000-000000000014', 1, false, 0),
('td0015-0000-0000-0000-000000000015', 'task0015-0000-0000-0000-000000000015', 1, false, 0),
('td0016-0000-0000-0000-000000000016', 'task0016-0000-0000-0000-000000000016', 1, true, 2),
('td0017-0000-0000-0000-000000000017', 'task0017-0000-0000-0000-000000000017', 1, false, 0),
('td0018-0000-0000-0000-000000000018', 'task0018-0000-0000-0000-000000000018', 1, false, 0),
('td0019-0000-0000-0000-000000000019', 'task0019-0000-0000-0000-000000000019', 1, false, 0),
('td0020-0000-0000-0000-000000000020', 'task0020-0000-0000-0000-000000000020', 2, true, 1),
('td0021-0000-0000-0000-000000000021', 'task0021-0000-0000-0000-000000000021', 1, false, 0),
('td0022-0000-0000-0000-000000000022', 'task0022-0000-0000-0000-000000000022', 1, false, 0),
('td0023-0000-0000-0000-000000000023', 'task0023-0000-0000-0000-000000000023', 1, true, 5),
('td0024-0000-0000-0000-000000000024', 'task0024-0000-0000-0000-000000000024', 4, true, 2),
('td0025-0000-0000-0000-000000000025', 'task0025-0000-0000-0000-000000000025', 1, false, 0),
('td0026-0000-0000-0000-000000000026', 'task0026-0000-0000-0000-000000000026', 2, false, 0),
('td0027-0000-0000-0000-000000000027', 'task0027-0000-0000-0000-000000000027', 1, false, 0),
('td0028-0000-0000-0000-000000000028', 'task0028-0000-0000-0000-000000000028', 1, true, 1),
('td0029-0000-0000-0000-000000000029', 'task0029-0000-0000-0000-000000000029', 1, false, 0),
('td0030-0000-0000-0000-000000000030', 'task0030-0000-0000-0000-000000000030', 1, false, 0),
('td0031-0000-0000-0000-000000000031', 'task0031-0000-0000-0000-000000000031', 1, true, 3),
('td0032-0000-0000-0000-000000000032', 'task0032-0000-0000-0000-000000000032', 1, false, 0);

-- Task deliverables for added video/dev/February tasks
INSERT INTO task_deliverables (id, task_id, count, variations_enabled, variations_count) VALUES
('tdv001-0000-0000-0000-000000000001', 'taskv001-0000-0000-0000-000000000001', 1, false, 0),
('tdv002-0000-0000-0000-000000000002', 'taskv002-0000-0000-0000-000000000002', 1, true, 1),
('tdd001-0000-0000-0000-000000000001', 'taskd001-0000-0000-0000-000000000001', 1, true, 1),
('tdd002-0000-0000-0000-000000000002', 'taskd002-0000-0000-0000-000000000002', 1, false, 0),
('tdmsa1-0000-0000-0000-000000000001', 'taskdsgf01-0000-0000-0000-000000000001', 2, false, 0);

-- ============================================================================
-- TIER 8: TASK AI USAGE (One-to-Many: Tasks → AI Usage Records)
-- ============================================================================

-- AI Usage for various tasks (for AI Analytics)
INSERT INTO task_ai_usage (id, task_id, ai_models, ai_time) VALUES
('ai0001-0000-0000-0000-000000000001', 'task0002-0000-0000-0000-000000000002', ARRAY['Photoshop', 'Midjourney'], 1.5),
('ai0002-0000-0000-0000-000000000002', 'task0003-0000-0000-0000-000000000003', ARRAY['DALL-E'], 0.8),
('ai0003-0000-0000-0000-000000000003', 'task0006-0000-0000-0000-000000000006', ARRAY['Photoshop'], 0.5),
('ai0004-0000-0000-0000-000000000004', 'task0009-0000-0000-0000-000000000009', ARRAY['Midjourney', 'Stable Diffusion'], 2.0),
('ai0005-0000-0000-0000-000000000005', 'task0012-0000-0000-0000-000000000012', ARRAY['Photoshop'], 0.6),
('ai0006-0000-0000-0000-000000000006', 'task0015-0000-0000-0000-000000000015', ARRAY['DALL-E', 'Photoshop'], 1.2),
('ai0007-0000-0000-0000-000000000007', 'task0017-0000-0000-0000-000000000017', ARRAY['Midjourney'], 0.7),
('ai0008-0000-0000-0000-000000000008', 'task0019-0000-0000-0000-000000000019', ARRAY['Stable Diffusion'], 0.9),
('ai0009-0000-0000-0000-000000000009', 'task0022-0000-0000-0000-000000000022', ARRAY['Photoshop', 'DALL-E'], 1.1),
('ai0010-0000-0000-0000-000000000010', 'task0023-0000-0000-0000-000000000023', ARRAY['Midjourney'], 2.5),
('ai0011-0000-0000-0000-000000000011', 'task0024-0000-0000-0000-000000000024', ARRAY['Photoshop', 'Stable Diffusion'], 1.8),
('ai0012-0000-0000-0000-000000000012', 'task0027-0000-0000-0000-000000000027', ARRAY['DALL-E'], 0.9),
('ai0013-0000-0000-0000-000000000013', 'task0029-0000-0000-0000-000000000029', ARRAY['Photoshop'], 0.7),
('ai0014-0000-0000-0000-000000000014', 'task0032-0000-0000-0000-000000000032', ARRAY['Midjourney', 'DALL-E'], 1.3);

-- AI usage for added video/dev/February tasks
INSERT INTO task_ai_usage (id, task_id, ai_models, ai_time) VALUES
('aiv001-0000-0000-0000-000000000001', 'taskv001-0000-0000-0000-000000000001', ARRAY['Premiere Pro','After Effects'], 1.3),
('aiv002-0000-0000-0000-000000000002', 'taskv002-0000-0000-0000-000000000002', ARRAY['Premiere Pro'], 0.8),
('aid001-0000-0000-0000-000000000001', 'taskd001-0000-0000-0000-000000000001', ARRAY['Copilot'], 1.0),
('aid002-0000-0000-0000-000000000002', 'taskd002-0000-0000-0000-000000000002', ARRAY['Copilot','Cursor'], 1.5),
('aidmsa1-0000-0000-0000-000000000001', 'taskdsgf01-0000-0000-0000-000000000001', ARRAY['Photoshop'], 0.7);

-- ============================================================================
-- DATA SUMMARY FOR ANALYTICS
-- ============================================================================
-- Total Tasks: 37
--   - Product Casino: 5 tasks (including task0023)
--   - Product Sport: 5 tasks (including task0024, taskv001)
--   - Product Poker: 4 tasks (including task0025, taskd001)
--   - Product Lotto: 1 task
--   - Marketing Casino: 5 tasks (including task0026, taskv002)
--   - Marketing Sport: 4 tasks (including task0027, taskdsgf01)
--   - Marketing Poker: 1 task
--   - Marketing Lotto: 2 tasks (including task0028)
--   - Acquisition Casino: 3 tasks (including task0029)
--   - Acquisition Sport: 2 tasks (including task0030)
--   - Acquisition Poker: 1 task (task0031)
--   - Acquisition Lotto: 2 tasks (including task0032, taskd002)
--   - Misc: 2 tasks
--
-- Total Hours: ~110+ hours across all tasks
--
-- Markets Distribution:
--   - RO: 6 tasks
--   - UK: 5 tasks
--   - COM: 5 tasks
--   - IE: 3 tasks
--   - DE: 4 tasks
--   - FI: 3 tasks
--   - DK: 2 tasks
--   - AT: 2 tasks
--   - IT: 3 tasks
--   - GR: 2 tasks
--   - FR: 2 tasks
--
-- AI Usage: 20 tasks with AI (Photoshop, Midjourney, DALL-E, Stable Diffusion, Premiere Pro, After Effects, Copilot, Cursor)
-- Shutterstock Usage: 14 tasks using Shutterstock
-- Variations: 15 tasks with variations enabled
-- Deliverables Count: Total count across all tasks = 41+ deliverables
--
-- Reporter Distribution:
--   - Reporter 1 (John): 9 tasks
--   - Reporter 2 (Jane): 9 tasks
--   - Reporter 3 (Mike): 7 tasks
--   - Reporter 4 (Sarah): 6 tasks
--
-- User Distribution:
--   - User 1 (Alice Designer): 18 tasks
--   - User 2 (Bob Designer): 15 tasks
--   - User 3 (Charlie Video): 1 task
--   - User 4 (Diana Video): 1 task
--   - User 5 (Eve Developer): 2 tasks
--
-- This data supports all analytics calculations:
-- ✅ Product Analytics: Product category breakdown with markets
-- ✅ Marketing Analytics: Marketing category breakdown with markets
-- ✅ Acquisition Analytics: Acquisition category breakdown
-- ✅ AI Analytics: AI usage by user, model, time, markets, products
-- ✅ Reporter Analytics: Tasks by reporter, hours, markets, products
-- ✅ Shutterstock Analytics: Shutterstock usage by user, markets
-- ✅ Total Analytics: Total tasks and hours by category
-- ✅ Markets by Users: Market distribution per user
-- ✅ Month-to-Month Comparison: Ready for comparison with other months
-- ============================================================================
