#!/bin/bash
# Database Helper Script
# Quick commands to explore your PostgreSQL database

DB_CONTAINER="task-tracker-db"
DB_USER="tasktracker"
DB_NAME="tasktracker"

echo "📊 Task Tracker Database Helper"
echo "================================"
echo ""

case "$1" in
  "tables")
    echo "📋 All Tables:"
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "\dt"
    ;;
  "users")
    echo "👥 Users:"
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC;"
    ;;
  "tasks")
    echo "📝 Tasks (last 10):"
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT id, month_id, \"user_UID\", data_task->>'taskName' as task_name, created_at FROM tasks ORDER BY created_at DESC LIMIT 10;"
    ;;
  "reporters")
    echo "📰 Reporters:"
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT id, name, email, department, country FROM reporters ORDER BY name;"
    ;;
  "deliverables")
    echo "📦 Deliverables:"
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT id, name, department, time_per_unit, time_unit FROM deliverables ORDER BY name;"
    ;;
  "months")
    echo "📅 Months:"
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT id, month_id, year_id, department, status, created_at FROM months ORDER BY month_id DESC;"
    ;;
  "stats")
    echo "📊 Database Statistics:"
    docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "
      SELECT 
        'users' as table_name, COUNT(*) as count FROM users
      UNION ALL
        SELECT 'tasks', COUNT(*) FROM tasks
      UNION ALL
        SELECT 'reporters', COUNT(*) FROM reporters
      UNION ALL
        SELECT 'deliverables', COUNT(*) FROM deliverables
      UNION ALL
        SELECT 'months', COUNT(*) FROM months
      UNION ALL
        SELECT 'team_days_off', COUNT(*) FROM team_days_off;
    "
    ;;
  "schema")
    echo "🏗️  Table Schema:"
    if [ -z "$2" ]; then
      echo "Usage: ./db-helper.sh schema <table_name>"
      echo "Available tables: users, tasks, months, reporters, deliverables, team_days_off"
    else
      docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "\d $2"
    fi
    ;;
  "shell")
    echo "🔧 Opening PostgreSQL shell..."
    docker exec -it $DB_CONTAINER psql -U $DB_USER -d $DB_NAME
    ;;
  *)
    echo "Usage: ./db-helper.sh <command>"
    echo ""
    echo "Commands:"
    echo "  tables       - List all tables"
    echo "  users        - Show all users"
    echo "  tasks        - Show last 10 tasks"
    echo "  reporters    - Show all reporters"
    echo "  deliverables - Show all deliverables"
    echo "  months       - Show all months"
    echo "  stats        - Show row counts for all tables"
    echo "  schema <table> - Show schema for a table"
    echo "  shell        - Open interactive PostgreSQL shell"
    echo ""
    echo "Examples:"
    echo "  ./db-helper.sh tables"
    echo "  ./db-helper.sh schema users"
    echo "  ./db-helper.sh stats"
    ;;
esac

