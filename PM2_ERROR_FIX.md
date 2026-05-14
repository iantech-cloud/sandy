# PM2 Error Fix: "Could not find a production build in the '.next' directory"

## What Went Wrong

You were getting this error:
```
[Error: Could not find a production build in the '.next' directory. 
Try building your app with 'next build' before starting the production server.]
```

And this error:
```
[CwdError: ENOENT: Cannot cd into '/var/www/hustlehub/node_modules/.pnpm/...' ]
```

### Root Cause

PM2 was trying to start a Next.js production server that doesn't have:
1. **`.next` directory** - The compiled application code (created by `next build`)
2. **Complete node_modules** - Dependencies may be missing or corrupted
3. **Proper configuration** - Missing or incorrect PM2/Next.js startup settings

## The Fix (Step-by-Step)

### Option A: Quick Fix Script (Recommended)

This script automates everything:

```bash
cd /var/www/hustlehub
bash fix-pm2.sh
```

The script will:
1. Stop any existing PM2 processes
2. Install all dependencies (`pnpm install`)
3. Build the application (`pnpm run build`)
4. Start the server with PM2
5. Configure PM2 for automatic startup on reboot

### Option B: Manual Steps

If you prefer to do it manually:

```bash
# 1. Navigate to your production directory
cd /var/www/hustlehub

# 2. Stop any running PM2 processes
pm2 stop hustlehub || true
pm2 delete hustlehub || true

# 3. Clean and reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# 4. Build the Next.js application (CRITICAL - creates .next directory)
pnpm run build

# 5. Verify the build was successful
ls -la .next

# 6. Start with PM2
pm2 start ecosystem.config.js --env production

# 7. Save PM2 configuration for startup on reboot
pm2 save
pm2 startup
```

## Files Provided

### 1. **ecosystem.config.js**
Proper PM2 configuration with:
- Correct startup command
- Port 5000 and 0.0.0.0 binding
- Error handling and restart policies
- Graceful shutdown
- Log file management

### 2. **DEPLOYMENT_GUIDE.md**
Complete deployment guide including:
- Detailed step-by-step instructions
- Environment variables checklist
- Troubleshooting for common errors
- Useful PM2 commands
- Automated deployment script

### 3. **fix-pm2.sh**
Automated fix script that runs all steps

## Verify It's Working

After running the fix, verify:

```bash
# Check if it's running
pm2 list

# Check the logs
pm2 logs hustlehub

# Test the server
curl http://localhost:5000
```

You should see:
- PM2 showing "hustlehub" as "online"
- Logs showing "Ready in XXms" 
- curl returning a successful response

## Why This Happens

When you deploy to a production server:
1. The source code is copied
2. But the `.next` directory (build output) is NOT copied (it's usually in .gitignore)
3. And node_modules can get corrupted during transfer

The fix ensures:
- ✓ All dependencies are fresh and correct
- ✓ The application is built
- ✓ PM2 is properly configured
- ✓ The server starts correctly

## Environment Variables

Make sure your `/var/www/hustlehub/.env.production.local` has:

```bash
NODE_ENV=production
NEXTAUTH_SECRET=<your_secret>
NEXTAUTH_URL=https://hustlehubafrica.com
RESEND_API_KEY=<your_resend_key>
# ... other variables
```

## If You Still Have Issues

### Check logs for actual errors
```bash
pm2 logs hustlehub --err
```

### Verify Next.js built correctly
```bash
cd /var/www/hustlehub
ls -la .next/
# Should contain: server, static, etc.
```

### Ensure dependencies are installed
```bash
pnpm list next
# Should show the installed version
```

### Check if port is in use
```bash
lsof -i :5000
# Should not return any processes
```

### Try a fresh install
```bash
cd /var/www/hustlehub
pm2 delete hustlehub
rm -rf node_modules .next
pnpm install
pnpm run build
pm2 start ecosystem.config.js --env production
```

## Production Checklist

Before deploying, ensure:
- [ ] All source code is in `/var/www/hustlehub`
- [ ] `package.json` and `pnpm-lock.yaml` exist
- [ ] `.env.production.local` has all required variables
- [ ] `ecosystem.config.js` is in the project root
- [ ] Port 5000 is available
- [ ] You have at least 2GB free disk space
- [ ] Node.js 18+ is installed (`node -v`)

## Quick Commands Reference

```bash
# Run the fix script
bash /var/www/hustlehub/fix-pm2.sh

# Manual build
cd /var/www/hustlehub && pnpm install && pnpm run build

# Start server
pm2 start ecosystem.config.js --env production

# View status
pm2 list && pm2 logs hustlehub

# Restart server
pm2 restart hustlehub

# Stop server
pm2 stop hustlehub
```

## Support

If you need to deploy changes:
```bash
cd /var/www/hustlehub
git pull origin main
pnpm install
pnpm run build
pm2 restart hustlehub
```

This is now your complete production setup! 🚀
