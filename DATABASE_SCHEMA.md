# Task Tracker Database Schema

## Complete Table Structure

### 1. users
**Primary Key:** `id` (UUID)  
**Unique Keys:** `user_UID`, `email`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| user_UID | VARCHAR(255) | UNIQUE NOT NULL | Business identifier |
| email | VARCHAR(255) | UNIQUE NOT NULL | User email (validated) |
| name | VARCHAR(255) | NOT NULL | User full name |
| role | VARCHAR(50) | DEFAULT 'user' | 'admin' or 'user' |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hash |
| color_set | VARCHAR(7) | | Hex color code |
| is_active | BOOLEAN | DEFAULT true | Account status |
| occupation | VARCHAR(100) | | Job title |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| created_by_UID | VARCHAR(255) | FK → users.user_UID | Creator reference |
| updated_at | TIMESTAMP | DEFAULT NOW | Update timestamp |

---

### 2. months
**Primary Key:** `id` (UUID)  
**Unique Keys:** `month_id`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| month_id | VARCHAR(50) | UNIQUE NOT NULL | Format: YYYY-MM |
| year_id | VARCHAR(10) | NOT NULL | Format: YYYY |
| department | VARCHAR(100) | DEFAULT 'design' | Department name |
| status | VARCHAR(50) | DEFAULT 'active' | Board status |
| month_name | VARCHAR(100) | | Month display name |
| start_date | DATE | | Month start date |
| end_date | DATE | | Month end date |
| days_in_month | INTEGER | | Number of days |
| board_id | VARCHAR(255) | | Board identifier |
| month | INTEGER | | Month number (1-12) |
| year | INTEGER | | Year (YYYY) |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW | Update timestamp |
| created_by_UID | VARCHAR(255) | FK → users.user_UID | Creator reference |
| updated_by_UID | VARCHAR(255) | FK → users.user_UID | Updater reference |

---

### 3. tasks
**Primary Key:** `id` (UUID)  
**Foreign Keys:** `month_id`, `user_UID`, `reporter_UID`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| month_id | VARCHAR(50) | FK NOT NULL | References months.month_id |
| user_UID | VARCHAR(255) | FK NOT NULL | References users.user_UID |
| board_id | VARCHAR(255) | | Board identifier |
| task_name | VARCHAR(255) | | Task name/identifier |
| products | VARCHAR(255) | | Product name |
| time_in_hours | DECIMAL(10,2) | | Time spent |
| department | VARCHAR(100) | | Primary department |
| start_date | DATE | | Task start date |
| end_date | DATE | | Task end date |
| observations | TEXT | | Notes/observations |
| is_vip | BOOLEAN | DEFAULT false | VIP flag |
| reworked | BOOLEAN | DEFAULT false | Reworked flag |
| use_shutterstock | BOOLEAN | DEFAULT false | Shutterstock usage |
| reporter_UID | VARCHAR(255) | FK | References reporters.reporter_UID |
| reporter_name | VARCHAR(255) | | Reporter name |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW | Update timestamp |
| created_by_UID | VARCHAR(255) | FK → users.user_UID | Creator reference |
| updated_by_UID | VARCHAR(255) | FK → users.user_UID | Updater reference |

---

### 4. task_markets (Junction Table)
**Primary Key:** `id` (UUID)  
**Unique:** `(task_id, market)`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| task_id | UUID | FK NOT NULL | References tasks.id |
| market | VARCHAR(10) | NOT NULL | Market code (e.g., 'ro', 'com') |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

---

### 5. task_departments (Junction Table)
**Primary Key:** `id` (UUID)  
**Unique:** `(task_id, department)`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| task_id | UUID | FK NOT NULL | References tasks.id |
| department | VARCHAR(100) | NOT NULL | Department name |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

---

### 6. task_deliverables
**Primary Key:** `id` (UUID)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| task_id | UUID | FK NOT NULL | References tasks.id |
| deliverable_name | VARCHAR(255) | NOT NULL | Deliverable name |
| count | INTEGER | DEFAULT 1 | Quantity |
| variations_enabled | BOOLEAN | DEFAULT false | Variations flag |
| variations_count | INTEGER | DEFAULT 0 | Number of variations |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

---

### 7. task_ai_usage
**Primary Key:** `id` (UUID)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| task_id | UUID | FK NOT NULL | References tasks.id |
| ai_models | TEXT[] | | Array of AI model names |
| ai_time | DECIMAL(10,2) | DEFAULT 0 | Time spent on AI |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

---

### 8. reporters
**Primary Key:** `id` (UUID)  
**Unique Keys:** `reporter_UID`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| reporter_UID | VARCHAR(255) | UNIQUE NOT NULL | Business identifier |
| name | VARCHAR(255) | NOT NULL | Reporter name |
| email | VARCHAR(255) | | Email address |
| department | VARCHAR(100) | | Department |
| channel | VARCHAR(100) | | Channel name |
| channel_name | VARCHAR(100) | | Channel display name |
| country | VARCHAR(10) | | Country code |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW | Update timestamp |
| created_by_UID | VARCHAR(255) | FK → users.user_UID | Creator reference |
| updated_by_UID | VARCHAR(255) | FK → users.user_UID | Updater reference |

---

### 9. deliverables
**Primary Key:** `id` (VARCHAR)  
**Unique Keys:** `name`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(255) | PRIMARY KEY | Custom ID format |
| name | VARCHAR(255) | UNIQUE NOT NULL | Deliverable name |
| description | TEXT | | Description |
| department | VARCHAR(100) | | Department |
| time_per_unit | DECIMAL(10,2) | | Time per unit |
| time_unit | VARCHAR(10) | DEFAULT 'hr' | Time unit |
| variations_time | DECIMAL(10,2) | | Variations time |
| variations_time_unit | VARCHAR(10) | DEFAULT 'min' | Variations unit |
| declinari_time | DECIMAL(10,2) | | Declinari time |
| declinari_time_unit | VARCHAR(10) | DEFAULT 'min' | Declinari unit |
| requires_quantity | BOOLEAN | DEFAULT false | Quantity required flag |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW | Update timestamp |
| created_by_UID | VARCHAR(255) | FK → users.user_UID | Creator reference |
| updated_by_UID | VARCHAR(255) | FK → users.user_UID | Updater reference |

---

### 10. team_days_off
**Primary Key:** `id` (UUID)  
**Unique Keys:** `user_UID`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| user_UID | VARCHAR(255) | UNIQUE NOT NULL | References users.user_UID |
| base_days | DECIMAL(10,2) | DEFAULT 0 | Base allocated days |
| days_off | DECIMAL(10,2) | DEFAULT 0 | Days used |
| days_remaining | DECIMAL(10,2) | DEFAULT 0 | Days remaining |
| days_total | DECIMAL(10,2) | DEFAULT 0 | Total available days |
| monthly_accrual | DECIMAL(10,2) | DEFAULT 1.75 | Monthly accrual rate |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW | Update timestamp |
| created_by_UID | VARCHAR(255) | FK → users.user_UID | Creator reference |
| updated_by_UID | VARCHAR(255) | FK → users.user_UID | Updater reference |

---

### 11. team_days_off_dates
**Primary Key:** `id` (UUID)  
**Unique:** `(team_days_off_id, date_string)`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| team_days_off_id | UUID | FK NOT NULL | References team_days_off.id |
| user_UID | VARCHAR(255) | FK NOT NULL | References users.user_UID |
| date_string | VARCHAR(50) | NOT NULL | ISO date string |
| day | INTEGER | | Day number |
| month | INTEGER | | Month number |
| year | INTEGER | | Year |
| timestamp | BIGINT | | Unix timestamp |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

---

### 12. user_permissions (Junction Table)
**Primary Key:** `id` (UUID)  
**Unique:** `(user_UID, permission)`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Auto-generated UUID |
| user_id | UUID | FK NOT NULL | References users.id |
| user_UID | VARCHAR(255) | FK NOT NULL | References users.user_UID |
| permission | VARCHAR(100) | NOT NULL | Permission name |
| created_at | TIMESTAMP | DEFAULT NOW | Creation timestamp |

---

## Relationships Summary

```
users (1) ──→ (many) tasks
users (1) ──→ (many) months
users (1) ──→ (many) reporters
users (1) ──→ (many) deliverables
users (1) ──→ (many) team_days_off
users (1) ──→ (many) user_permissions
users (1) ──→ (many) users (self-reference: created_by)

months (1) ──→ (many) tasks

reporters (1) ──→ (many) tasks

tasks (1) ──→ (many) task_markets
tasks (1) ──→ (many) task_departments
tasks (1) ──→ (many) task_deliverables
tasks (1) ──→ (many) task_ai_usage

team_days_off (1) ──→ (many) team_days_off_dates
```

## Total Statistics

- **12 Tables** total
- **6 Core Tables**: users, months, tasks, reporters, deliverables, team_days_off
- **6 Junction/Related Tables**: task_markets, task_departments, task_deliverables, task_ai_usage, team_days_off_dates, user_permissions
- **All tables use UUID primary keys** (except `deliverables` which uses VARCHAR)
- **Foreign keys reference business identifiers** (`user_UID`, `reporter_UID`, `month_id`)

