# Final PM2 Setup Guide - HustleHub Africa

## What Was Wrong

Your PM2 setup failed because:

1. **Missing `output: 'standalone'` in next.config.ts**
   - Next.js wasn't creating the standalone build needed for production
   - Without this, `.next/standalone/server.js` doesn't exist
   - PM2 tried to use `next start` which requires full build setup

2. **Environment variables not loading before app start**
   - ecosystem.config.js wasn't loading `.env.local` before starting the app
   - App crashed silently without the NEXTAUTH_SECRET and other critical variables

3. **Incorrect PM2 startup command**
   - Using `next start` instead of the standalone server
   - Added complexity and unnecessary dependencies

## What Was Fixed

### 1. Updated next.config.ts
Added `output: 'standalone'` at the top of the config to enable standalone build output.

### 2. Updated ecosystem.config.js
- Now loads environment variables from `.env.local` before starting
- Uses `.next/standalone/server.js` directly instead of `next start`
- Simplified configuration for better reliability

### 3. Created PRODUCTION_FIX.sh
Automated script that handles the complete fix process.

## How to Deploy Now

### Option A: Automated (Recommended)

```bash
cd /var/www/hustlehub
bash PRODUCTION_FIX.sh
```

This script will:
- Stop old PM2 processes
- Install dependencies
- Rebuild with standalone output
- Start with PM2
- Verify everything is working

### Option B: Manual

```bash
# Stop current process
pm2 stop hustlehub
pm2 delete hustlehub

# Install & build
cd /var/www/hustlehub
pnpm install
pnpm run build

# Verify standalone build
ls -la .next/standalone/server.js

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Verify
pm2 list
curl http://localhost:5000
```

## Verify It's Working

### Check 1: PM2 Status
```bash
pm2 list
# Should show: status = "online"
```

### Check 2: App Responding
```bash
curl http://localhost:5000
# Should return HTML (not connection error)
```

### Check 3: Logs
```bash
pm2 logs hustlehub --lines 20
# Should show: "Ready in XXms"
# Should NOT show errors
```

### Check 4: Port
```bash
netstat -tlnp | grep 5000
# Should show node process listening on 5000
```

## File Structure After Build

```
/var/www/hustlehub/
├── .next/
│   ├── standalone/
│   │   └── server.js          ← PM2 runs this
│   ├── static/
│   └── ... other build files
├── node_modules/
├── .env.local                 ← Must exist with variables
├── ecosystem.config.js        ← PM2 config
├── next.config.ts             ← Must have output: 'standalone'
└── package.json
```

## Critical Requirements

For this to work, you MUST have:

1. **next.config.ts with `output: 'standalone'`** ✓ DONE
   ```typescript
   const nextConfig: NextConfig = {
     output: 'standalone',
     // ... rest of config
   };
   ```

2. **.env.local file** (you need to create/verify)
   ```bash
   # Must contain at minimum:
   NEXTAUTH_SECRET=<your-secret>
   MONGODB_URI=<your-mongo-uri>
   RESEND_API_KEY=<your-resend-key>
   # ... see ENV_SETUP_CHECKLIST.md for all variables
   ```

3. **ecosystem.config.js** ✓ UPDATED
   - Now loads environment variables correctly
   - Uses standalone server

4. **Dependencies installed**
   ```bash
   pnpm install
   ```

## Troubleshooting

### App won't start
```bash
# Check the error
pm2 logs hustlehub --lines 50

# Or check log file directly
cat /var/log/hustlehub-error.log

# Common issues:
# - Missing NEXTAUTH_SECRET in .env.local
# - MongoDB connection string is invalid
# - Port 5000 already in use
```

### Standalone build didn't create
```bash
# Check next.config.ts
grep "output:" next.config.ts
# Should show: output: 'standalone',

# Rebuild
pnpm run build

# Verify
ls -la .next/standalone/server.js
```

### Environment variables not loading
```bash
# Check .env.local exists
ls -la .env.local

# Test loading manually
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.NEXTAUTH_SECRET)"
# Should print your secret, not empty
```

### Port 5000 already in use
```bash
# Find what's using it
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port in ecosystem.config.js
```

## Key Differences from Before

| Before | After | Why |
|--------|-------|-----|
| `next start` command | `.next/standalone/server.js` | Standalone is faster, more reliable |
| No env loading in PM2 | Loads `.env.local` in config | Variables available at startup |
| No `output: standalone` | Has `output: standalone` | Creates optimized production build |
| Manual restart needed | Auto-restart on crash | PM2 restart policy enabled |

## Success Indicators

You'll know it's working when:

✓ `pm2 list` shows "online" status
✓ `pm2 logs hustlehub` shows "Ready in XXms"
✓ `curl http://localhost:5000` returns HTML
✓ No errors in `/var/log/hustlehub-error.log`
✓ App responds to requests normally

## Next: Verify Everything

After setup completes, verify:

```bash
# 1. Check status
pm2 list

# 2. Check logs
pm2 logs hustlehub --lines 20

# 3. Test endpoint
curl http://localhost:5000

# 4. Check logs for issues
tail -f /var/log/hustlehub-error.log &
tail -f /var/log/hustlehub-out.log &

# 5. Generate some traffic
curl http://localhost:5000/api/auth/check
```

## Files Updated

- ✓ `next.config.ts` - Added `output: 'standalone'`
- ✓ `ecosystem.config.js` - Fixed PM2 configuration
- ✓ `PRODUCTION_FIX.sh` - Automated fix script
- ✓ `PRODUCTION_STARTUP_GUIDE.md` - Detailed setup guide

## Running the Fix

```bash
# Make script executable
chmod +x /var/www/hustlehub/PRODUCTION_FIX.sh

# Run it
cd /var/www/hustlehub
./PRODUCTION_FIX.sh

# Or simply
bash PRODUCTION_FIX.sh
```

The script will handle everything and verify the setup is working.
