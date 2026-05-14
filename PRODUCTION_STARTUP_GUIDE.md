# Production Startup Guide - HustleHub Africa

## Problem Summary
The PM2 process keeps failing because:
1. Next.js standalone build wasn't being used properly
2. Environment variables weren't being loaded before app start
3. Missing dotenv package for environment loading

## Fixed Solution

### Step 1: Ensure Dependencies
```bash
cd /var/www/hustlehub
pnpm install  # Installs dotenv and all deps
```

### Step 2: Build Production Version
```bash
pnpm run build
# This creates .next/standalone/server.js
```

### Step 3: Verify Environment Variables
```bash
# Check that .env.local exists and has required variables
cat .env.local | head -5

# Required variables:
# - NEXTAUTH_SECRET (for authentication)
# - MONGODB_URI (database connection)
# - RESEND_API_KEY (email service)
# - And others based on ENV_SETUP_CHECKLIST.md
```

### Step 4: Start with PM2
```bash
# Copy the fixed ecosystem.config.js
cp ecosystem.config.js /var/www/hustlehub/

# Stop old processes
pm2 stop all && pm2 delete all

# Start fresh
cd /var/www/hustlehub
pm2 start ecosystem.config.js

# Verify
pm2 status
pm2 logs hustlehub --lines 20
```

### Step 5: Verify It's Running
```bash
# Check PM2 status
pm2 list

# Check if app is responding
curl http://localhost:5000

# Check logs for errors
pm2 logs hustlehub
```

## Understanding the Standalone Build

Next.js builds a standalone server in `.next/standalone/` when output is set to standalone. This:
- Reduces dependencies needed in production
- Improves startup time
- Works better with PM2

The next.config.ts must have:
```typescript
output: 'standalone'
```

## Troubleshooting

### If app still won't start:
```bash
# Check what's in .next
ls -la .next/standalone/

# Try manual start to see error
node .next/standalone/server.js

# Check logs
cat /var/log/hustlehub-error.log
cat /var/log/hustlehub-out.log
```

### If environment variables aren't loading:
```bash
# Verify .env.local exists
ls -la .env.local

# Check it has content
wc -l .env.local

# Test loading manually
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.NEXTAUTH_SECRET ? 'LOADED' : 'MISSING')"
```

### If port 5000 is already in use:
```bash
# Find what's using port 5000
lsof -i :5000

# Kill it
kill -9 <PID>

# Or change port in ecosystem.config.js and restart
```

## Key Changes Made

1. **Changed from `next start` to standalone server**
   - Uses `.next/standalone/server.js` directly
   - More reliable and faster startup

2. **Added environment loading**
   - ecosystem.config.js now loads `.env.local` before starting
   - Requires `dotenv` package (included in dependencies)

3. **Simplified PM2 config**
   - Removed `wait_ready` and `listen_timeout` (not needed for standalone)
   - Kept restart policies for reliability
   - Proper logging to files

## next.config.ts Verification

Ensure your next.config.ts has this setting:
```typescript
const nextConfig = {
  output: 'standalone',  // <-- REQUIRED for PM2
  // ... other config
};
```

This tells Next.js to build a self-contained application that doesn't need the full node_modules directory.

## Full Startup Checklist

- [ ] `.env.local` file exists with all required variables
- [ ] next.config.ts has `output: 'standalone'`
- [ ] `pnpm install` completed successfully
- [ ] `pnpm run build` completed successfully
- [ ] `.next/standalone/server.js` exists
- [ ] ecosystem.config.js is in `/var/www/hustlehub/`
- [ ] `pm2 start ecosystem.config.js` succeeded
- [ ] `pm2 list` shows "online" status
- [ ] `curl http://localhost:5000` returns HTML (not connection error)
- [ ] `pm2 logs hustlehub` shows "Ready in XXms" (not errors)

## Common Success Indicators

```bash
# You should see something like:
pm2 list
┌────┬──────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name         │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼──────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ hustlehub    │ cluster  │ 0    │ online    │ 0%       │ 45.2 MB  │
└────┴──────────────┴──────────┴──────┴───────────┴──────────┴──────────┘

# And curl should work:
curl http://localhost:5000
# Returns: <!DOCTYPE html>... (HTML content, not connection error)
```

## Need More Help?

Check these files for reference:
- `DEPLOYMENT_GUIDE.md` - Full deployment instructions
- `ENV_SETUP_CHECKLIST.md` - All environment variables needed
- `PM2_SETUP_CHECKLIST.md` - Step-by-step PM2 setup
