# Task Tracker Database Schema Diagram

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    USERS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id                    UUID                                             │
│ UK  user_UID              VARCHAR(255)                                      │
│ UK  email                 VARCHAR(255)                                     │
│     name                  VARCHAR(255)                                      │
│     role                  VARCHAR(50)  DEFAULT 'user'                       │
│     password_hash          VARCHAR(255)                                     │
│     color_set             VARCHAR(7)                                        │
│     is_active             BOOLEAN     DEFAULT true                          │
│     occupation            VARCHAR(100)                                      │
│     created_at            TIMESTAMP   DEFAULT NOW                          │
│ FK  created_by_UID        VARCHAR(255) → users.user_UID                    │
│     updated_at            TIMESTAMP   DEFAULT NOW                          │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ├──────────────────────────────────────────────┐
                              │                                              │
                              ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  MONTHS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id                    UUID                                             │
│ UK  month_id              VARCHAR(50)                                      │
│     year_id               VARCHAR(10)                                      │
│     department            VARCHAR(100) DEFAULT 'design'                   │
│     status                VARCHAR(50)  DEFAULT 'active'                     │
│     month_name            VARCHAR(100)                                     │
│     start_date            DATE                                            │
│     end_date              DATE                                            │
│     days_in_month         INTEGER                                         │
│     board_id              VARCHAR(255)                                     │
│     month                 INTEGER                                         │
│     year                  INTEGER                                         │
│     created_at            TIMESTAMP   DEFAULT NOW                         │
│     updated_at            TIMESTAMP   DEFAULT NOW                         │
│ FK  created_by_UID        VARCHAR(255) → users.user_UID                   │
│ FK  updated_by_UID        VARCHAR(255) → users.user_UID                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   TASKS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id                    UUID                                             │
│ FK  month_id              VARCHAR(50)  → months.month_id                   │
│ FK  user_UID              VARCHAR(255) → users.user_UID                    │
│     board_id              VARCHAR(255)                                     │
│     task_name             VARCHAR(255)                                    │
│     products              VARCHAR(255)                                     │
│     time_in_hours         DECIMAL(10,2)                                    │
│     department            VARCHAR(100)                                     │
│     start_date            DATE                                            │
│     end_date              DATE                                            │
│     observations          TEXT                                            │
│     is_vip                BOOLEAN     DEFAULT false                        │
│     reworked              BOOLEAN     DEFAULT false                        │
│     use_shutterstock      BOOLEAN     DEFAULT false                        │
│ FK  reporter_UID          VARCHAR(255) → reporters.reporter_UID          │
│     reporter_name         VARCHAR(255)                                     │
│     created_at            TIMESTAMP   DEFAULT NOW                         │
│     updated_at            TIMESTAMP   DEFAULT NOW                         │
│ FK  created_by_UID         VARCHAR(255) → users.user_UID                   │
│ FK  updated_by_UID         VARCHAR(255) → users.user_UID                   │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ├──────────────────────────────────────────────┐
                              │                                              │
                              ▼                                              ▼
        ┌──────────────────────────┐              ┌──────────────────────────┐
        │     TASK_MARKETS         │              │   TASK_DEPARTMENTS       │
        ├──────────────────────────┤              ├──────────────────────────┤
        │ PK  id            UUID   │              │ PK  id            UUID   │
        │ FK  task_id       UUID   │              │ FK  task_id       UUID   │
        │     market        VARCHAR│              │     department    VARCHAR │
        │     created_at    TIMESTAMP│            │     created_at    TIMESTAMP│
        └──────────────────────────┘              └──────────────────────────┘
                              │                                              │
                              │ 1:N                                          │ 1:N
                              ▼                                              ▼
        ┌──────────────────────────┐              ┌──────────────────────────┐
        │   TASK_DELIVERABLES      │              │     TASK_AI_USAGE        │
        ├──────────────────────────┤              ├──────────────────────────┤
        │ PK  id            UUID   │              │ PK  id            UUID   │
        │ FK  task_id       UUID   │              │ FK  task_id       UUID   │
        │     deliverable_name VARCHAR│            │     ai_models     TEXT[] │
        │     count          INTEGER│             │     ai_time       DECIMAL│
        │     variations_enabled BOOL│            │     created_at    TIMESTAMP│
        │     variations_count INTEGER│           └──────────────────────────┘
        │     created_at    TIMESTAMP│
        └──────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                 REPORTERS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id                    UUID                                             │
│ UK  reporter_UID          VARCHAR(255)                                     │
│     name                  VARCHAR(255)                                      │
│     email                 VARCHAR(255)                                     │
│     department            VARCHAR(100)                                     │
│     channel               VARCHAR(100)                                     │
│     channel_name          VARCHAR(100)                                      │
│     country               VARCHAR(10)                                      │
│     created_at            TIMESTAMP   DEFAULT NOW                          │
│     updated_at            TIMESTAMP   DEFAULT NOW                           │
│ FK  created_by_UID        VARCHAR(255) → users.user_UID                    │
│ FK  updated_by_UID        VARCHAR(255) → users.user_UID                    │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
                        (referenced by tasks.reporter_UID)

┌─────────────────────────────────────────────────────────────────────────────┐
│                               DELIVERABLES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id                    VARCHAR(255)                                      │
│ UK  name                  VARCHAR(255)                                      │
│     description           TEXT                                             │
│     department            VARCHAR(100)                                     │
│     time_per_unit         DECIMAL(10,2)                                    │
│     time_unit             VARCHAR(10)  DEFAULT 'hr'                        │
│     variations_time       DECIMAL(10,2)                                    │
│     variations_time_unit  VARCHAR(10)  DEFAULT 'min'                      │
│     declinari_time        DECIMAL(10,2)                                    │
│     declinari_time_unit   VARCHAR(10)  DEFAULT 'min'                       │
│     requires_quantity     BOOLEAN      DEFAULT false                        │
│     created_at            TIMESTAMP    DEFAULT NOW                         │
│     updated_at            TIMESTAMP    DEFAULT NOW                          │
│ FK  created_by_UID        VARCHAR(255) → users.user_UID                    │
│ FK  updated_by_UID        VARCHAR(255) → users.user_UID                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              TEAM_DAYS_OFF                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id                    UUID                                             │
│ UK  user_UID              VARCHAR(255) → users.user_UID                     │
│     base_days             DECIMAL(10,2) DEFAULT 0                          │
│     days_off              DECIMAL(10,2) DEFAULT 0                          │
│     days_remaining        DECIMAL(10,2) DEFAULT 0                          │
│     days_total            DECIMAL(10,2) DEFAULT 0                          │
│     monthly_accrual       DECIMAL(10,2) DEFAULT 1.75                       │
│     created_at            TIMESTAMP   DEFAULT NOW                          │
│     updated_at            TIMESTAMP   DEFAULT NOW                           │
│ FK  created_by_UID        VARCHAR(255) → users.user_UID                    │
│ FK  updated_by_UID        VARCHAR(255) → users.user_UID                     │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TEAM_DAYS_OFF_DATES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id                    UUID                                             │
│ FK  team_days_off_id      UUID → team_days_off.id                          │
│ FK  user_UID              VARCHAR(255) → users.user_UID                      │
│     date_string           VARCHAR(50)                                      │
│     day                   INTEGER                                          │
│     month                 INTEGER                                          │
│     year                  INTEGER                                          │
│     timestamp             BIGINT                                           │
│     created_at            TIMESTAMP   DEFAULT NOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER_PERMISSIONS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ PK  id                    UUID                                             │
│ FK  user_id               UUID → users.id                                   │
│ FK  user_UID              VARCHAR(255) → users.user_UID                      │
│     permission            VARCHAR(100)                                     │
│     created_at            TIMESTAMP   DEFAULT NOW                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Relationships Summary

```
USERS (1) ────────→ (N) MONTHS          [creates]
USERS (1) ────────→ (N) TASKS           [owns]
USERS (1) ────────→ (N) REPORTERS       [creates]
USERS (1) ────────→ (N) DELIVERABLES     [creates]
USERS (1) ────────→ (N) TEAM_DAYS_OFF    [has]
USERS (1) ────────→ (N) USER_PERMISSIONS [has]
USERS (1) ────────→ (N) USERS            [created_by - self-reference]

MONTHS (1) ───────→ (N) TASKS            [contains]

REPORTERS (1) ────→ (N) TASKS            [assigned_to]

TASKS (1) ────────→ (N) TASK_MARKETS     [has]
TASKS (1) ────────→ (N) TASK_DEPARTMENTS [has]
TASKS (1) ────────→ (N) TASK_DELIVERABLES[has]
TASKS (1) ────────→ (N) TASK_AI_USAGE    [has]

TEAM_DAYS_OFF (1) ─→ (N) TEAM_DAYS_OFF_DATES [has]
```

## Tables Summary

### Core Tables (6)

1. **users** - User accounts and authentication (11 columns)
2. **months** - Month boards/periods (16 columns)
3. **tasks** - Main task records (21 columns)
4. **reporters** - Reporter/assignee information (12 columns)
5. **deliverables** - Deliverable templates (15 columns)
6. **team_days_off** - User vacation/time off records (10 columns)

### Junction/Related Tables (6)

7. **task_markets** - Many-to-many: Tasks ↔ Markets (4 columns)
8. **task_departments** - Many-to-many: Tasks ↔ Departments (4 columns)
9. **task_deliverables** - One-to-many: Tasks → Deliverables (7 columns)
10. **task_ai_usage** - One-to-many: Tasks → AI Usage (4 columns)
11. **team_days_off_dates** - One-to-many: Team Days Off → Dates (8 columns)
12. **user_permissions** - Many-to-many: Users ↔ Permissions (5 columns)

## Key Relationships

- **users** → **tasks** (one-to-many): Each user can have multiple tasks
- **months** → **tasks** (one-to-many): Each month board contains multiple tasks
- **reporters** → **tasks** (one-to-many): Each reporter can be assigned to multiple tasks
- **tasks** → **task_markets** (one-to-many): Each task can have multiple markets
- **tasks** → **task_departments** (one-to-many): Each task can belong to multiple departments
- **tasks** → **task_deliverables** (one-to-many): Each task can have multiple deliverables
- **tasks** → **task_ai_usage** (one-to-many): Each task can have AI usage records
- **users** → **user_permissions** (one-to-many): Each user can have multiple permissions
- **team_days_off** → **team_days_off_dates** (one-to-many): Each record can have multiple dates

## Field Legend

- **PK** = Primary Key
- **FK** = Foreign Key
- **UK** = Unique Key

## Indexes

All foreign keys are indexed. Additional indexes on:
- Frequently queried columns (email, role, status, dates)
- Search fields (name, task_name, products)
- Composite indexes for common query patterns

## Notes

- All tables use UUID primary keys (except `deliverables` which uses VARCHAR)
- Business identifiers use `_UID` suffix (VARCHAR)
- Foreign keys reference `user_UID` and `reporter_UID` (business keys)
- Cascade deletes configured for related records
- Timestamps auto-update via triggers
