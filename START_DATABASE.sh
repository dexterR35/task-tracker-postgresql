#!/bin/bash
# Start PostgreSQL Database

# Function to check if docker command works without sudo
check_docker_access() {
    if docker ps > /dev/null 2>&1; then
        return 0  # Docker works without sudo
    else
        return 1  # Docker requires sudo
    fi
}

# Determine if we need sudo
if check_docker_access; then
    DOCKER_CMD="docker"
    echo "✅ Docker accessible without sudo"
else
    DOCKER_CMD="sudo docker"
    echo "⚠️  Docker requires sudo permissions"
    
    # Check if we're in a non-interactive environment
    if [ ! -t 0 ]; then
        echo ""
        echo "❌ ERROR: Cannot prompt for sudo password in non-interactive environment"
        echo ""
        echo "🔧 SOLUTION: Add your user to the docker group (one-time setup):"
        echo "   sudo usermod -aG docker $USER"
        echo "   newgrp docker  # Or logout and login again"
        echo ""
        echo "   Then run this script again without sudo."
        echo ""
        echo "   OR run manually in a terminal:"
        echo "   sudo docker compose up -d"
        exit 1
    fi
fi

echo "🐳 Starting PostgreSQL database..."
cd "$(dirname "$0")"
$DOCKER_CMD compose up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Failed to start Docker containers"
    echo "   Make sure Docker is running: sudo systemctl status docker"
    exit 1
fi

echo ""
echo "⏳ Waiting for database to initialize..."
sleep 5

echo ""
echo "✅ Checking database status..."
$DOCKER_CMD compose ps

echo ""
echo "📋 Next steps:"
echo "1. Create admin user: cd server && npm run create-admin admin@example.com admin123 'Admin User'"
echo "2. Access app at: http://localhost:5173"

