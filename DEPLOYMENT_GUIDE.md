# HustleHub Deployment & PM2 Setup Guide

## The Problem You Were Facing

When you run `pm2 start app.config.js`, Next.js tries to start with `next start` but fails because:
1. The `.next` build directory doesn't exist
2. Node modules may be incomplete or corrupted
3. PM2 needs to run `next build` first before `next start`

## Solution: Complete Deployment Setup

### Step 1: Ensure You Have All Files

Copy these files to your production server (`/var/www/hustlehub`):
- `ecosystem.config.js` (provided in this repo)
- `package.json`
- `package-lock.json` or `pnpm-lock.yaml`
- All source code files

### Step 2: On Your Production Server

```bash
# Navigate to the production directory
cd /var/www/hustlehub

# 1. Stop any existing PM2 process
pm2 stop hustlehub
pm2 delete hustlehub

# 2. Install dependencies (CRITICAL - this must be done first)
pnpm install

# 3. Build the Next.js application (CRITICAL - creates .next directory)
pnpm run build

# 4. Start with PM2 using the ecosystem config
pm2 start ecosystem.config.js --env production

# 5. Save PM2 config to start on server reboot
pm2 save
pm2 startup
```

### Step 3: Verify It's Running

```bash
# Check PM2 processes
pm2 list

# Monitor logs in real-time
pm2 logs hustlehub

# Check if the server is responding
curl http://localhost:5000
```

## Why This Works

1. **ecosystem.config.js** - Proper PM2 configuration with:
   - Correct startup command
   - Port and host settings
   - Error handling and restart policies
   - Log file locations
   - Graceful shutdown settings

2. **Build Process** - Before starting the server:
   - `pnpm install` - Ensures all dependencies are available
   - `pnpm run build` - Creates the `.next` directory with compiled code
   - `pm2 start` - Starts the pre-built application

## If You Still Get Errors

### Error: "Cannot find module 'next'"
```bash
# Solution: Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Error: "SWC package ENOENT"
```bash
# Solution: Clear Next.js cache and rebuild
rm -rf .next
pnpm run build
```

### Error: "Port already in use"
```bash
# Find and kill the process using port 5000
lsof -i :5000
kill -9 <PID>
pm2 start ecosystem.config.js --env production
```

### PM2 Not Starting on Boot
```bash
# Make PM2 run on startup
pm2 startup
pm2 save

# Verify it's set up
pm2 info hustlehub
```

## Environment Variables

Make sure you have a `.env.production.local` file in `/var/www/hustlehub`:

```bash
# Critical for emails
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM_NAME=HustleHub Africa
EMAIL_FROM_ADDRESS=noreply@hustlehubafrica.com

# Critical for Next Auth
NEXTAUTH_SECRET=your_secret_key_here
NEXTAUTH_URL=https://hustlehubafrica.com

# Database connections
MONGODB_URI=your_mongodb_connection_string
DATABASE_URL=your_database_url

# OAuth (Google, etc.)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Other services
MPESA_API_URL=your_mpesa_url
SOCKET_IO_URL=your_socket_io_url
```

## Quick Troubleshooting Checklist

- [ ] Are you in `/var/www/hustlehub` directory?
- [ ] Did you run `pnpm install`?
- [ ] Did you run `pnpm run build`?
- [ ] Does `.next` directory exist and has files?
- [ ] Is `ecosystem.config.js` in the project root?
- [ ] Are all environment variables set in `.env.production.local`?
- [ ] Is port 5000 available (not in use by another process)?
- [ ] Check logs: `pm2 logs hustlehub`

## Useful PM2 Commands

```bash
# View all running processes
pm2 list

# View detailed info about a process
pm2 info hustlehub

# View real-time logs
pm2 logs hustlehub

# View error logs only
pm2 logs hustlehub --err

# Stop the process
pm2 stop hustlehub

# Restart the process
pm2 restart hustlehub

# Reload (zero-downtime restart)
pm2 reload hustlehub

# Delete the process from PM2
pm2 delete hustlehub

# Save PM2 process list for startup
pm2 save

# Check startup configuration
pm2 startup
```

## Automated Deployment Script

If you want to automate this, create `deploy.sh`:

```bash
#!/bin/bash
cd /var/www/hustlehub
pm2 stop hustlehub || true
pm2 delete hustlehub || true
pnpm install
pnpm run build
pm2 start ecosystem.config.js --env production
pm2 save
echo "✓ Deployment complete"
```

Then run:
```bash
chmod +x deploy.sh
./deploy.sh
```

## Common Issues and Solutions

### Issue: "Could not find a production build"
- **Cause**: `.next` directory doesn't exist
- **Solution**: Run `pnpm run build` before `pm2 start`

### Issue: "ENOENT: Cannot cd into node_modules/.pnpm/..."
- **Cause**: Corrupted node_modules or incomplete installation
- **Solution**: 
  ```bash
  rm -rf node_modules pnpm-lock.yaml
  pnpm install
  pnpm run build
  ```

### Issue: "Port 5000 already in use"
- **Cause**: Another process is using the port
- **Solution**:
  ```bash
  lsof -i :5000
  kill -9 <PID from above>
  pm2 restart hustlehub
  ```

### Issue: PM2 not starting on server reboot
- **Cause**: PM2 startup not configured
- **Solution**:
  ```bash
  pm2 startup
  pm2 save
  ```

## For Development

If you want to run in development mode on a different port:

```bash
pnpm run dev
# Server runs on http://localhost:3000
```

## Support

If issues persist:
1. Check all logs: `pm2 logs hustlehub`
2. Verify all environment variables are set
3. Ensure your system has Node.js 18+ installed
4. Check disk space: `df -h`
5. Check memory: `free -h`
