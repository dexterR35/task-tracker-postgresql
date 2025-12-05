# PostgreSQL Upgrade Guide: 16 → 18

## Current Status
- **Current Version:** PostgreSQL 16.11
- **Target Version:** PostgreSQL 18
- **Backup File:** `mydata.sql` (already created)

## Upgrade Steps

### 1. Stop the current database container
```bash
docker compose down
```

### 2. Backup your data (already done)
Your backup is saved in `mydata.sql`

### 3. Update docker-compose.yml
Already updated to use `postgres:18-alpine`

### 4. Start with PostgreSQL 18
```bash
docker compose up -d
```

### 5. Verify the upgrade
```bash
docker exec task-tracker-db psql -U tasktracker -d tasktracker -c "SELECT version();"
```

## Important Notes

⚠️ **PostgreSQL major version upgrades require data migration**

Since you're upgrading from 16 to 18, you have two options:

### Option A: Fresh Start (Recommended for development)
1. Stop container: `docker compose down`
2. Remove volume: `docker volume rm task-tracker-app_postgres_data`
3. Start fresh: `docker compose up -d`
4. Restore data: `docker exec -i task-tracker-db psql -U tasktracker -d tasktracker < mydata.sql`

### Option B: Use pg_upgrade (For production)
PostgreSQL provides `pg_upgrade` tool for in-place upgrades, but it's more complex and requires careful handling.

## Verification Commands

After upgrade, verify everything works:
```bash
# Check version
docker exec task-tracker-db psql -U tasktracker -d tasktracker -c "SELECT version();"

# Check tables
docker exec task-tracker-db psql -U tasktracker -d tasktracker -c "\dt"

# Check data
docker exec task-tracker-db psql -U tasktracker -d tasktracker -c "SELECT COUNT(*) FROM tasks;"
```

