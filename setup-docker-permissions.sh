#!/bin/bash
# One-time setup: Add user to docker group to avoid sudo

echo "🔧 Setting up Docker permissions..."
echo ""
echo "This will add your user ($USER) to the docker group."
echo "After this, you won't need sudo for Docker commands."
echo ""

# Check if user is already in docker group
if groups | grep -q docker; then
    echo "✅ You're already in the docker group!"
    echo "   If Docker still requires sudo, try: newgrp docker"
    exit 0
fi

# Add user to docker group
echo "Adding $USER to docker group..."
sudo usermod -aG docker $USER

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully added to docker group!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Run: newgrp docker"
    echo "   OR logout and login again"
    echo "2. Then run: ./START_DATABASE.sh"
    echo ""
    echo "⚠️  Note: You may need to restart your terminal or IDE for changes to take effect."
else
    echo ""
    echo "❌ Failed to add user to docker group"
    echo "   Make sure you have sudo permissions"
    exit 1
fi

