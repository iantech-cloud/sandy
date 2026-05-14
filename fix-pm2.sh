#!/bin/bash

# HustleHub PM2 Fix Script
# This script fixes all PM2 startup issues

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     HustleHub PM2 Startup Fix Script                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Determine the correct directory
if [ -f "/var/www/hustlehub/package.json" ]; then
    PROJECT_DIR="/var/www/hustlehub"
    echo "✓ Found project at: $PROJECT_DIR"
else
    echo "✗ Could not find /var/www/hustlehub/package.json"
    echo "Make sure you've deployed the project to /var/www/hustlehub first"
    exit 1
fi

cd "$PROJECT_DIR"

echo ""
echo "Step 1: Stopping any existing PM2 processes..."
pm2 stop hustlehub 2>/dev/null || true
pm2 delete hustlehub 2>/dev/null || true
echo "✓ Stopped existing processes"

echo ""
echo "Step 2: Checking/installing dependencies..."
if [ ! -d "node_modules" ] || [ ! -f "pnpm-lock.yaml" ]; then
    echo "  Installing with pnpm..."
    pnpm install
    echo "✓ Dependencies installed"
else
    echo "  Verifying dependencies..."
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    echo "✓ Dependencies verified"
fi

echo ""
echo "Step 3: Building Next.js application..."
echo "  This may take a few minutes..."
rm -rf .next
pnpm run build
if [ -d ".next" ]; then
    echo "✓ Build successful - .next directory created"
else
    echo "✗ Build failed - .next directory not found"
    exit 1
fi

echo ""
echo "Step 4: Copying ecosystem config..."
if [ ! -f "ecosystem.config.js" ]; then
    # Create ecosystem config if it doesn't exist
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'hustlehub',
      script: 'node_modules/.bin/next',
      args: 'start -p 5000 -H 0.0.0.0',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '0.0.0.0',
      },
      error_file: '/var/log/hustlehub-error.log',
      out_file: '/var/log/hustlehub-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      merge_logs: true,
    },
  ],
};
EOF
    echo "✓ Created ecosystem.config.js"
else
    echo "✓ ecosystem.config.js already exists"
fi

echo ""
echo "Step 5: Starting with PM2..."
pm2 start ecosystem.config.js --env production
echo "✓ Started with PM2"

echo ""
echo "Step 6: Saving PM2 startup config..."
pm2 save
pm2 startup 2>/dev/null || true
echo "✓ Saved PM2 configuration"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   ✓ Setup Complete!                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Your HustleHub server is now running!"
echo ""
echo "Quick checks:"
echo "  • View processes:    pm2 list"
echo "  • View logs:         pm2 logs hustlehub"
echo "  • Monitor server:    curl http://localhost:5000"
echo ""
echo "If you still have issues:"
echo "  1. Check logs: pm2 logs hustlehub --err"
echo "  2. Verify environment variables in .env.production.local"
echo "  3. Ensure port 5000 is available: lsof -i :5000"
echo ""
