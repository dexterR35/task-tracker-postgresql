-- Task Tracker Database Schema
-- PostgreSQL initialization script

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_UID" VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    permissions JSONB DEFAULT '[]'::jsonb,
    password_hash VARCHAR(255) NOT NULL,
    color_set VARCHAR(7), -- Hex color code (e.g., "3B82F6")
    is_active BOOLEAN DEFAULT true,
    occupation VARCHAR(100), -- e.g., "developer", "acq"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_UID VARCHAR(255), -- User UID who created the user
    created_by_name VARCHAR(255), -- Denormalized for performance
    updated_by_UID VARCHAR(255), -- User UID who last updated the user
    updated_by_name VARCHAR(255) -- Denormalized: may become stale if user name changes
);

-- Add self-referencing FK constraints after table creation (to avoid circular dependency)
ALTER TABLE users 
    ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by_UID) 
    REFERENCES users("user_UID") ON DELETE SET NULL;
ALTER TABLE users 
    ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by_UID) 
    REFERENCES users("user_UID") ON DELETE SET NULL;

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_UID ON users("user_UID");
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Months table (month boards)
CREATE TABLE months (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_id VARCHAR(50) UNIQUE NOT NULL, -- Format: YYYY-MM
    year_id VARCHAR(10) NOT NULL, -- Format: YYYY
    department VARCHAR(100) DEFAULT 'design',
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_UID VARCHAR(255), -- User UID who created the month board
    created_by_name VARCHAR(255), -- Denormalized for performance
    updated_by_UID VARCHAR(255), -- User UID who last updated the month board
    updated_by_name VARCHAR(255), -- Denormalized for performance
    FOREIGN KEY (created_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL,
    FOREIGN KEY (updated_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_months_month_id ON months(month_id);
CREATE INDEX IF NOT EXISTS idx_months_year_id ON months(year_id);

-- Tasks table
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_id VARCHAR(50) NOT NULL,
    "user_UID" VARCHAR(255) NOT NULL,
    board_id VARCHAR(255),
    -- JSONB provides flexibility for varying task structures but complicates complex queries
    -- Consider extracting frequently queried fields (taskName, timeInHours) to separate columns if needed
    data_task JSONB NOT NULL, -- Contains all task data (taskName, products, markets, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Auditing fields: UIDs are the source of truth, names are denormalized for performance
    created_by_UID VARCHAR(255), -- User UID who created the task
    created_by_name VARCHAR(255), -- Denormalized for performance
    updated_by_UID VARCHAR(255), -- User UID who last updated the task
    updated_by_name VARCHAR(255), -- Denormalized for performance
    FOREIGN KEY (month_id) REFERENCES months(month_id) ON DELETE CASCADE,
    -- Foreign key constraint ensures user_UID exists, but NO ACTION prevents cascading deletes
    -- This preserves task history even if user is deactivated
    FOREIGN KEY ("user_UID") REFERENCES users("user_UID") ON DELETE NO ACTION
);

CREATE INDEX IF NOT EXISTS idx_tasks_month_id ON tasks(month_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_UID ON tasks("user_UID");
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- Reporters table
CREATE TABLE reporters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(100), -- Also supports "departament" spelling in response
    channel VARCHAR(100),
    channel_name VARCHAR(100), -- Maps to "channelName" in response
    country VARCHAR(10),
    "reporter_UID" VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_UID VARCHAR(255), -- User UID who created the reporter
    created_by_name VARCHAR(255), -- Denormalized for performance
    updated_by_UID VARCHAR(255), -- User UID who last updated the reporter
    updated_by_name VARCHAR(255), -- Denormalized for performance
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
    created_by_name VARCHAR(255), -- Denormalized for performance
    updated_by_UID VARCHAR(255), -- User UID who last updated the deliverable
    updated_by_name VARCHAR(255), -- Denormalized for performance
    FOREIGN KEY (created_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL,
    FOREIGN KEY (updated_by_UID) REFERENCES users("user_UID") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deliverables_name ON deliverables(name);

-- Team days off table
-- One record per user with calculated fields and offDays array
CREATE TABLE team_days_off (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_UID" VARCHAR(255) NOT NULL UNIQUE,
    user_name VARCHAR(255), -- Denormalized user name for performance
    base_days DECIMAL(10, 2) DEFAULT 0, -- Base days allocated
    days_off DECIMAL(10, 2) DEFAULT 0, -- Days off used (calculated from offDays array)
    days_remaining DECIMAL(10, 2) DEFAULT 0, -- Days remaining (calculated)
    days_total DECIMAL(10, 2) DEFAULT 0, -- Total days available (base + monthly accrual)
    monthly_accrual DECIMAL(10, 2) DEFAULT 1.75, -- Monthly accrual rate (typically 1.75)
    off_days JSONB DEFAULT '[]'::jsonb, -- Array of selected dates: [{dateString, day, month, year, timestamp}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_uid VARCHAR(255), -- User UID who created the day off entry
    created_by_name VARCHAR(255), -- Denormalized for performance
    updated_by_uid VARCHAR(255), -- User UID who last updated the day off entry
    updated_by_name VARCHAR(255), -- Denormalized for performance
    FOREIGN KEY ("user_UID") REFERENCES users("user_UID") ON DELETE NO ACTION,
    FOREIGN KEY (created_by_uid) REFERENCES users("user_UID") ON DELETE SET NULL,
    FOREIGN KEY (updated_by_uid) REFERENCES users("user_UID") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_team_days_off_user_UID ON team_days_off("user_UID");
CREATE INDEX IF NOT EXISTS idx_team_days_off_off_days_gin ON team_days_off USING GIN (off_days); -- GIN index for JSONB array queries

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

