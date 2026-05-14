#!/bin/bash

# HustleHub Africa - Production PM2 Fix Script
# This script fixes the PM2 startup issue by rebuilding with standalone output

set -e  # Exit on any error

echo "================================"
echo "HustleHub Africa - Production Fix"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found!"
    echo "Please run this script from the project root directory"
    exit 1
fi

echo "Step 1: Stopping PM2 process..."
pm2 stop hustlehub 2>/dev/null || true
pm2 delete hustlehub 2>/dev/null || true
echo "✓ PM2 process stopped"
echo ""

echo "Step 2: Installing dependencies..."
pnpm install
echo "✓ Dependencies installed"
echo ""

echo "Step 3: Rebuilding with standalone output..."
rm -rf .next  # Clean build
pnpm run build
echo "✓ Build completed successfully"
echo ""

echo "Step 4: Verifying standalone build..."
if [ -f ".next/standalone/server.js" ]; then
    echo "✓ Standalone server found at .next/standalone/server.js"
else
    echo "❌ Error: Standalone server not found!"
    echo "Please check next.config.ts has: output: 'standalone'"
    exit 1
fi
echo ""

echo "Step 5: Verifying environment variables..."
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: .env.local file not found!"
    echo "Please create .env.local with required variables"
    echo "See ENV_SETUP_CHECKLIST.md for details"
else
    echo "✓ .env.local file found"
    echo "  Variables configured:"
    grep -E "^[A-Z_]+" .env.local | sed 's/=.*/=***/' | head -5
    echo "  ..."
fi
echo ""

echo "Step 6: Starting with PM2..."
pm2 start ecosystem.config.js
echo "✓ PM2 process started"
echo ""

echo "Step 7: Saving PM2 configuration..."
pm2 save
echo "✓ PM2 configuration saved"
echo ""

echo "Step 8: Verifying startup..."
sleep 2
pm2 list
echo ""

echo "Step 9: Testing connectivity..."
sleep 2
if curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo "✓ App is responding on http://localhost:5000"
else
    echo "⚠️  App not responding yet. Check logs:"
    echo ""
    echo "  pm2 logs hustlehub"
    echo "  cat /var/log/hustlehub-error.log"
    echo "  cat /var/log/hustlehub-out.log"
fi
echo ""

echo "================================"
echo "✓ Fix Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Check PM2 status: pm2 list"
echo "2. View logs: pm2 logs hustlehub"
echo "3. Test app: curl http://localhost:5000"
echo ""
echo "For more help, see:"
echo "- PRODUCTION_STARTUP_GUIDE.md"
echo "- DEPLOYMENT_GUIDE.md"
echo "- PM2_SETUP_CHECKLIST.md"
