-- Migration: Add Departments Table and Update Schema
-- This migration adds the departments table and updates existing tables
-- to use department_id foreign keys instead of VARCHAR department fields

BEGIN;

-- Step 1: Create departments table
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);

-- Step 2: Insert default 'design' department
INSERT INTO departments (name, display_name, description, is_active) 
VALUES ('design', 'Design Department', 'Default design department', true)
ON CONFLICT (name) DO NOTHING;

-- Get the design department ID for migration
DO $$
DECLARE
    design_dept_id UUID;
BEGIN
    SELECT id INTO design_dept_id FROM departments WHERE name = 'design' LIMIT 1;
    
    -- Step 3: Add department_id column to months table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'months' AND column_name = 'department_id') THEN
        ALTER TABLE months ADD COLUMN department_id UUID;
        
        -- Migrate existing data: set all existing months to 'design' department
        UPDATE months SET department_id = design_dept_id WHERE department_id IS NULL;
        
        -- Make it NOT NULL after migration
        ALTER TABLE months ALTER COLUMN department_id SET NOT NULL;
        ALTER TABLE months ADD CONSTRAINT fk_months_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_months_department_id ON months(department_id);
        CREATE INDEX IF NOT EXISTS idx_months_dept_year_month ON months(department_id, year, month);
    END IF;
    
    -- Step 4: Add department_id column to reporters table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reporters' AND column_name = 'department_id') THEN
        ALTER TABLE reporters ADD COLUMN department_id UUID;
        
        -- Migrate existing data: try to match department names, default to 'design'
        UPDATE reporters r
        SET department_id = COALESCE(
            (SELECT d.id FROM departments d WHERE LOWER(d.name) = LOWER(r.department) LIMIT 1),
            design_dept_id
        )
        WHERE r.department IS NOT NULL AND r.department_id IS NULL;
        
        -- Set remaining NULLs to design
        UPDATE reporters SET department_id = design_dept_id WHERE department_id IS NULL;
        
        ALTER TABLE reporters ADD CONSTRAINT fk_reporters_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_reporters_department_id ON reporters(department_id);
    END IF;
    
    -- Step 5: Add department_id column to deliverables table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deliverables' AND column_name = 'department_id') THEN
        ALTER TABLE deliverables ADD COLUMN department_id UUID;
        
        -- Migrate existing data: try to match department names, default to 'design'
        UPDATE deliverables d
        SET department_id = COALESCE(
            (SELECT dept.id FROM departments dept WHERE LOWER(dept.name) = LOWER(d.department) LIMIT 1),
            design_dept_id
        )
        WHERE d.department IS NOT NULL AND d.department_id IS NULL;
        
        -- Set remaining NULLs to design
        UPDATE deliverables SET department_id = design_dept_id WHERE department_id IS NULL;
        
        ALTER TABLE deliverables ADD CONSTRAINT fk_deliverables_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_deliverables_department_id ON deliverables(department_id);
    END IF;
    
    -- Step 6: Add department_id column to tasks table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'department_id') THEN
        ALTER TABLE tasks ADD COLUMN department_id UUID;
        
        -- Migrate existing data: try to match department names, default to 'design'
        UPDATE tasks t
        SET department_id = COALESCE(
            (SELECT dept.id FROM departments dept WHERE LOWER(dept.name) = LOWER(t.department) LIMIT 1),
            design_dept_id
        )
        WHERE t.department IS NOT NULL AND t.department_id IS NULL;
        
        -- Set remaining NULLs to design
        UPDATE tasks SET department_id = design_dept_id WHERE department_id IS NULL;
        
        ALTER TABLE tasks ADD CONSTRAINT fk_tasks_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_tasks_department_id ON tasks(department_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_month_department ON tasks(month_id, department_id);
        -- Note: Using user_UID for now since existing schema uses it
        CREATE INDEX IF NOT EXISTS idx_tasks_department_user ON tasks(department_id, "user_UID");
    END IF;
END $$;

-- Step 7: Add trigger for departments updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Verification queries (run separately to check)
-- SELECT 'departments' as table_name, COUNT(*) as count FROM departments;
-- SELECT 'months with department_id' as check, COUNT(*) as count FROM months WHERE department_id IS NOT NULL;
-- SELECT 'reporters with department_id' as check, COUNT(*) as count FROM reporters WHERE department_id IS NOT NULL;
-- SELECT 'deliverables with department_id' as check, COUNT(*) as count FROM deliverables WHERE department_id IS NOT NULL;
-- SELECT 'tasks with department_id' as check, COUNT(*) as count FROM tasks WHERE department_id IS NOT NULL;

