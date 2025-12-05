-- Migration: Add department_id to user_permissions
-- This allows permission checking per department: user → department → permission → CRUD access

BEGIN;

-- Step 1: Add department_id column to user_permissions
ALTER TABLE user_permissions 
ADD COLUMN IF NOT EXISTS department_id UUID;

-- Step 2: Get the default 'design' department ID
DO $$
DECLARE
    design_dept_id UUID;
BEGIN
    SELECT id INTO design_dept_id FROM departments WHERE name = 'design' LIMIT 1;
    
    -- Step 3: Migrate existing permissions to default 'design' department
    -- This preserves existing permissions by assigning them to the design department
    UPDATE user_permissions 
    SET department_id = design_dept_id 
    WHERE department_id IS NULL;
    
    -- Step 4: Add foreign key constraint
    ALTER TABLE user_permissions
    ADD CONSTRAINT fk_user_permissions_department 
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;
    
    -- Step 5: Update unique constraint to include department_id
    -- Drop old unique constraint if it exists
    ALTER TABLE user_permissions 
    DROP CONSTRAINT IF EXISTS user_permissions_user_id_permission_key;
    
    -- Add new unique constraint with department_id
    ALTER TABLE user_permissions
    ADD CONSTRAINT user_permissions_user_dept_permission_unique 
    UNIQUE (user_id, department_id, permission);
    
    -- Step 6: Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_user_permissions_department_id 
    ON user_permissions(department_id);
    
    CREATE INDEX IF NOT EXISTS idx_user_permissions_user_dept 
    ON user_permissions(user_id, department_id);
END $$;

COMMIT;

-- Verification queries (run separately to check)
-- SELECT 'user_permissions with department_id' as check, COUNT(*) as count FROM user_permissions WHERE department_id IS NOT NULL;
-- SELECT user_id, department_id, permission FROM user_permissions ORDER BY user_id, department_id;

