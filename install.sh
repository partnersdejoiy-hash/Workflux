#!/bin/bash
# Workflux Installation Script
# Run: cd /var/www/workflux && bash install.sh

echo "=== Workflux Installation ==="

# Step 1: Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Step 2: Build the application
echo "Building Vite production build..."
npm run build

# Step 3: Setup environment variables
echo "Configuring environment variables..."

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Created .env from .env.example"
        echo "Please edit .env with your Convex deployment URL"
    else
        echo "Creating basic .env..."
        cat > .env << 'EOF'
VITE_CONVEX_URL=http://127.0.0.1:3210
CONVEX_SITE_URL=http://localhost:5173
CONVEX_DEPLOYMENT=anonymous:anonymous-Workflux
EOF
    fi
fi

# Step 4: Initialize Convex development
echo "Initializing Convex backend..."
npx convex dev

echo ""
echo "=== Installation Complete ==="
echo ""
echo "Next steps:"
echo "1. Update .env with your Convex deployment URL"
echo "2. Log in using seeded credentials:"
echo "   - Super Admin: deepak.sharma@dejoiy.com"
echo "   - Employee: raghvi.sharma@test.com"
echo "2. Access the application at http://localhost:5173"
echo "3. Access Convex dashboard at http://localhost:3210"
echo "4. Run npm run dev for development mode"
echo "5. Run npm run build && npx serve -s dist for production"