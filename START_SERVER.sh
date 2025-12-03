#!/bin/bash
# Start the Express Server

echo "🚀 Starting Task Tracker Server..."
echo ""

# Check if we're in the right directory
if [ ! -f "server/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if database is running
echo "🔍 Checking if database is running..."
if docker ps | grep -q task-tracker-db; then
    echo "✅ Database container is running"
else
    echo "⚠️  Warning: Database container not found"
    echo "   Run './START_DATABASE.sh' first to start PostgreSQL"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if .env file exists
if [ ! -f "server/.env" ]; then
    echo "⚠️  No .env file found in server/ directory"
    echo "   Creating default .env file..."
    cat > server/.env << EOF
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=tasktracker
DB_USER=tasktracker
DB_PASSWORD=tasktracker123

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
EOF
    echo "✅ Created server/.env with default values"
    echo "   ⚠️  Remember to change JWT_SECRET in production!"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing server dependencies..."
    cd server
    npm install
    cd ..
    echo ""
fi

# Start the server
echo "🚀 Starting server..."
echo ""
cd server
npm run dev

