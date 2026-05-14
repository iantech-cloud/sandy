# PM2 Error Fix - Complete Solution

## TL;DR (2 Minute Fix)

Your PM2 server is failing because the `.next` build directory doesn't exist. Fix it now:

```bash
cd /var/www/hustlehub
bash fix-pm2.sh
```

Or manually:
```bash
cd /var/www/hustlehub && \
pm2 stop hustlehub 2>/dev/null || true && \
pm2 delete hustlehub 2>/dev/null || true && \
pnpm install && \
pnpm run build && \
pm2 start ecosystem.config.js --env production && \
pm2 save
```

Then verify:
```bash
pm2 list  # Should show hustlehub as "online"
pm2 logs hustlehub  # Should show "Ready in XXms"
curl http://localhost:5000  # Should return HTML
```

---

## The Problem

You see this error:
```
Error: Could not find a production build in the '.next' directory.
Try building your app with 'next build' before starting the production server.
```

**Why it happens:**
- Next.js production server needs the `.next` directory (created by `next build`)
- Your production server doesn't have this directory
- Dependencies may be incomplete or corrupted

---

## What Was Provided

### 1. **ecosystem.config.js** (New)
Proper PM2 configuration file with all settings

### 2. **PM2_ERROR_FIX.md**
Detailed explanation of the issue and fix

### 3. **DEPLOYMENT_GUIDE.md**
Complete deployment guide with troubleshooting

### 4. **PM2_SETUP_CHECKLIST.md**
Step-by-step checklist to verify everything

### 5. **fix-pm2.sh**
Automated bash script to fix everything

### 6. **PM2_QUICK_FIX.sh**
One-line command to fix it

---

## Step-by-Step Fix

### 1. Copy Files to Production Server
Make sure these files are in `/var/www/hustlehub`:
- `ecosystem.config.js`
- `package.json`
- `pnpm-lock.yaml`
- `.env.production.local`
- All source code

### 2. Run One of These

**Option A: Automated Script (Easiest)**
```bash
cd /var/www/hustlehub
bash fix-pm2.sh
```

**Option B: Manual Commands**
```bash
cd /var/www/hustlehub
pm2 stop hustlehub 2>/dev/null || true
pm2 delete hustlehub 2>/dev/null || true
pnpm install
pnpm run build
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 3. Verify It Works
```bash
pm2 list          # Check if running
pm2 logs hustlehub  # Check for errors
curl http://localhost:5000  # Test the server
```

---

## What Happens During Fix

1. **Stop PM2 Process** - Gracefully stops any running instances
2. **Install Dependencies** - Runs `pnpm install` to get all packages
3. **Build Application** - Runs `pnpm run build` to create `.next` directory
4. **Start PM2** - Starts the server with proper configuration
5. **Save Config** - Saves PM2 state for automatic startup on reboot

---

## Key Files Explained

### ecosystem.config.js
PM2 configuration with:
- Correct Next.js startup command
- Port 5000 binding
- Automatic restart on crashes
- Graceful shutdown
- Log file management

### .env.production.local
Must contain all required environment variables:
```bash
NODE_ENV=production
NEXTAUTH_SECRET=<value>
NEXTAUTH_URL=https://hustlehubafrica.com
RESEND_API_KEY=<value>
MONGODB_URI=<value>
```

---

## Common Issues

### "Still getting the same error"
- Verify `.next` directory exists: `ls -la /var/www/hustlehub/.next`
- Check logs for actual error: `pm2 logs hustlehub --err`
- Ensure build completed: `pnpm run build 2>&1 | tail`

### "Port 5000 already in use"
```bash
lsof -i :5000
kill -9 <PID>
pm2 restart hustlehub
```

### "Command not found: pnpm"
```bash
npm install -g pnpm
# Then retry the fix
```

### "Node modules corrupted"
```bash
cd /var/www/hustlehub
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm run build
pm2 restart hustlehub
```

---

## Documentation Index

Read these for more details:

1. **PM2_ERROR_FIX.md** - Detailed error explanation and fixes
2. **DEPLOYMENT_GUIDE.md** - Complete deployment instructions
3. **PM2_SETUP_CHECKLIST.md** - Step-by-step verification checklist
4. **fix-pm2.sh** - Automated fix script
5. **ecosystem.config.js** - PM2 configuration

---

## Testing the Fix

After running the fix, test with:

```bash
# 1. Check PM2 status
pm2 show hustlehub
# Should show:
# - status: online
# - uptime: some time value

# 2. Check logs for success
pm2 logs hustlehub --lines 5
# Should show "Ready in XXms"

# 3. Test HTTP connection
curl -I http://localhost:5000
# Should return "200 OK" or similar HTTP response

# 4. Full health check
pm2 list && echo "---" && curl http://localhost:5000 | head -20
```

---

## Monitoring Going Forward

Daily checks:
```bash
# Everything running?
pm2 list

# Any errors?
pm2 logs hustlehub --err --lines 20

# System resources OK?
pm2 monit
```

---

## Deployment Updates

When you push new code:

```bash
cd /var/www/hustlehub
git pull origin main      # Get latest code
pnpm install             # Update dependencies if needed
pnpm run build           # Rebuild
pm2 restart hustlehub    # Restart server
```

---

## Emergency Reset

If nothing works:

```bash
cd /var/www/hustlehub
pm2 delete hustlehub
rm -rf .next node_modules
pnpm install
pnpm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## Next Steps

1. Run the fix: `cd /var/www/hustlehub && bash fix-pm2.sh`
2. Verify it's working: `pm2 logs hustlehub`
3. Test the server: `curl http://localhost:5000`
4. Read DEPLOYMENT_GUIDE.md for complete details
5. Follow PM2_SETUP_CHECKLIST.md for ongoing maintenance

---

## Success Criteria

You've fixed the problem when:

✓ `pm2 list` shows hustlehub as "online"  
✓ `pm2 logs hustlehub` shows "Ready in XXms"  
✓ `curl http://localhost:5000` returns HTML (no connection error)  
✓ Website loads in browser at your domain  
✓ No crash/error messages in logs  

---

**Problem**: Missing `.next` build directory  
**Solution**: Run `pnpm build` and restart PM2  
**Time to Fix**: 2-5 minutes  
**Difficulty**: Easy (just run the script)  

You're all set! 🚀
