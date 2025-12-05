-- Task Tracker Database Schema
-- PostgreSQL initialization script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Primary key (UUID)
    "user_UID" VARCHAR(255) UNIQUE NOT NULL, -- Application identifier (business key)
    email VARCHAR(255) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    password_hash VARCHAR(255) NOT NULL, -- Bcrypt hash (typically 60 chars, but allow up to 255 for future-proofing)
    color_set VARCHAR(7) CHECK (color_set IS NULL OR color_set ~* '^#[0-9A-Fa-f]{6}$'), -- Hex color code (e.g., "#3B82F6")
    is_active BOOLEAN DEFAULT true,
    occupation VARCHAR(100), -- e.g., "developer", "acq"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_UID VARCHAR(255), -- User UID who created the user
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Internal tracking (not returned in API)
);

-- Add self-referencing FK constraint after table creation (to avoid circular dependency)
ALTER TABLE users 
    ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by_UID) 
    REFERENCES users("user_UID") ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active); -- Useful for filtering active users
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users(email, is_active); -- Composite index for common query pattern
-- Note: user_UID is PRIMARY KEY, so it already has an index

-- Months table (month boards)
CREATE TABLE months (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_id VARCHAR(50) UNIQUE NOT NULL, -- Format: YYYY-MM
    year_id VARCHAR(10) NOT NULL, -- Format: YYYY
    department VARCHAR(100) DEFAULT 'design',
    status VARCHAR(50) DEFAULT 'active',
    -- Metadata fields
    month_name VARCHAR(100),
    start_date DATE,
    end_date DATE,
    days_in_month INTEGER,
    board_id VARCHAR(255),
    month INTEGER, -- 1-12
    year INTEGER, -- YYYY
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_UID VARCHAR(255), -- User UID who created the month board
    updated_by_UID VARCHAR(255), -- User UID who last updated the month board
    FOREIGN KEY (created_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL,
    FOREIGN KEY (updated_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_months_month_id ON months(month_id);
CREATE INDEX IF NOT EXISTS idx_months_year_id ON months(year_id);
CREATE INDEX IF NOT EXISTS idx_months_month_name ON months(month_name);
CREATE INDEX IF NOT EXISTS idx_months_start_date ON months(start_date);
CREATE INDEX IF NOT EXISTS idx_months_end_date ON months(end_date);
CREATE INDEX IF NOT EXISTS idx_months_board_id ON months(board_id);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_id VARCHAR(50) NOT NULL,
    "user_UID" VARCHAR(255) NOT NULL,
    board_id VARCHAR(255),
    -- Core task fields
    task_name VARCHAR(255),
    products VARCHAR(255),
    time_in_hours DECIMAL(10, 2),
    department VARCHAR(100),
    start_date DATE,
    end_date DATE,
    observations TEXT,
    -- Boolean flags
    is_vip BOOLEAN DEFAULT false,
    reworked BOOLEAN DEFAULT false,
    use_shutterstock BOOLEAN DEFAULT false,
    -- Reporter information
    "reporter_UID" VARCHAR(255),
    reporter_name VARCHAR(255),
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Auditing fields: UIDs are the source of truth
    created_by_UID VARCHAR(255), -- User UID who created the task
    updated_by_UID VARCHAR(255), -- User UID who last updated the task
    FOREIGN KEY (month_id) REFERENCES months(month_id) ON DELETE CASCADE,
    FOREIGN KEY ("user_UID") REFERENCES users("user_UID") ON DELETE NO ACTION,
    FOREIGN KEY ("reporter_UID") REFERENCES reporters("reporter_UID") ON DELETE SET NULL
);

-- Task Markets (many-to-many junction table)
CREATE TABLE task_markets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    market VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, market)
);

-- Task Departments (many-to-many junction table)
CREATE TABLE task_departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    department VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, department)
);

-- Task Deliverables (one-to-many)
CREATE TABLE task_deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    deliverable_name VARCHAR(255) NOT NULL,
    count INTEGER DEFAULT 1,
    variations_enabled BOOLEAN DEFAULT false,
    variations_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task AI Usage (one-to-many)
CREATE TABLE task_ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    ai_models TEXT[], -- Array of AI model names
    ai_time DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_month_id ON tasks(month_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_UID ON tasks("user_UID");
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_task_name ON tasks(task_name);
CREATE INDEX IF NOT EXISTS idx_tasks_products ON tasks(products);
CREATE INDEX IF NOT EXISTS idx_tasks_reporter_UID ON tasks("reporter_UID");
CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department);
CREATE INDEX IF NOT EXISTS idx_tasks_is_vip ON tasks(is_vip);
CREATE INDEX IF NOT EXISTS idx_tasks_reworked ON tasks(reworked);
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_tasks_end_date ON tasks(end_date);

-- Indexes for junction tables
CREATE INDEX IF NOT EXISTS idx_task_markets_task_id ON task_markets(task_id);
CREATE INDEX IF NOT EXISTS idx_task_markets_market ON task_markets(market);
CREATE INDEX IF NOT EXISTS idx_task_departments_task_id ON task_departments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_departments_department ON task_departments(department);
CREATE INDEX IF NOT EXISTS idx_task_deliverables_task_id ON task_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_task_ai_usage_task_id ON task_ai_usage(task_id);

-- Reporters table
CREATE TABLE reporters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Primary key (UUID)
    "reporter_UID" VARCHAR(255) UNIQUE NOT NULL, -- Application identifier (business key, NOT for auth)
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(100), -- Also supports "departament" spelling in response
    channel VARCHAR(100),
    channel_name VARCHAR(100), -- Maps to "channelName" in response
    country VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_UID VARCHAR(255), -- User UID who created the reporter
    updated_by_UID VARCHAR(255), -- User UID who last updated the reporter
    FOREIGN KEY (created_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL,
    FOREIGN KEY (updated_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reporters_name ON reporters(name);

-- Deliverables table
CREATE TABLE deliverables (
    id VARCHAR(255) PRIMARY KEY, -- Custom ID format: deliverable_timestamp
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    department VARCHAR(100),
    time_per_unit DECIMAL(10, 2),
    time_unit VARCHAR(10) DEFAULT 'hr',
    variations_time DECIMAL(10, 2),
    variations_time_unit VARCHAR(10) DEFAULT 'min',
    declinari_time DECIMAL(10, 2),
    declinari_time_unit VARCHAR(10) DEFAULT 'min',
    requires_quantity BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_UID VARCHAR(255), -- User UID who created the deliverable
    updated_by_UID VARCHAR(255), -- User UID who last updated the deliverable
    FOREIGN KEY (created_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL,
    FOREIGN KEY (updated_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deliverables_name ON deliverables(name);

-- Team days off table
-- One record per user with calculated fields
CREATE TABLE team_days_off (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_UID" VARCHAR(255) NOT NULL UNIQUE,
    base_days DECIMAL(10, 2) DEFAULT 0, -- Base days allocated
    days_off DECIMAL(10, 2) DEFAULT 0, -- Days off used (calculated from team_days_off_dates)
    days_remaining DECIMAL(10, 2) DEFAULT 0, -- Days remaining (calculated)
    days_total DECIMAL(10, 2) DEFAULT 0, -- Total days available (base + monthly accrual)
    monthly_accrual DECIMAL(10, 2) DEFAULT 1.75, -- Monthly accrual rate (typically 1.75)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_UID VARCHAR(255), -- User UID who created the day off entry
    updated_by_UID VARCHAR(255), -- User UID who last updated the day off entry
    FOREIGN KEY ("user_UID") REFERENCES users("user_UID") ON DELETE NO ACTION,
    FOREIGN KEY (created_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL,
    FOREIGN KEY (updated_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_team_days_off_user_UID ON team_days_off("user_UID");

-- Team days off dates table
CREATE TABLE team_days_off_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_days_off_id UUID NOT NULL REFERENCES team_days_off(id) ON DELETE CASCADE,
    "user_UID" VARCHAR(255) NOT NULL REFERENCES users("user_UID") ON DELETE CASCADE,
    date_string VARCHAR(50) NOT NULL, -- ISO date string
    day INTEGER,
    month INTEGER,
    year INTEGER,
    timestamp BIGINT, -- Unix timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_days_off_id, date_string)
);

CREATE INDEX IF NOT EXISTS idx_team_days_off_dates_team_id ON team_days_off_dates(team_days_off_id);
CREATE INDEX IF NOT EXISTS idx_team_days_off_dates_user_UID ON team_days_off_dates("user_UID");
CREATE INDEX IF NOT EXISTS idx_team_days_off_dates_date_string ON team_days_off_dates(date_string);
CREATE INDEX IF NOT EXISTS idx_team_days_off_dates_year_month ON team_days_off_dates(year, month);

-- User permissions junction table
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "user_UID" VARCHAR(255) NOT NULL REFERENCES users("user_UID") ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE("user_UID", permission)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_UID ON user_permissions("user_UID");
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
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

