# PM2 Setup Checklist - HustleHub Production Server

## Pre-Flight Checks

### Server Access
- [ ] Can access `/var/www/hustlehub` directory
- [ ] Have write permissions in `/var/www/hustlehub`
- [ ] PM2 is installed globally (`pm2 -v`)
- [ ] pnpm is installed (`pnpm -v`)
- [ ] Node.js 18+ is installed (`node -v`)

### Disk Space
- [ ] At least 2GB free disk space (`df -h`)
- [ ] `/var/www/hustlehub` is not full
- [ ] `/root/.pm2` has space for logs

### Network & Ports
- [ ] Port 5000 is available (`lsof -i :5000` shows nothing)
- [ ] Can reach internet (for npm package downloads)
- [ ] Network connectivity to database servers

---

## Step 1: Project Deployment

Run these checks to ensure your project is properly deployed:

```bash
cd /var/www/hustlehub
```

- [ ] `package.json` exists
- [ ] `pnpm-lock.yaml` exists
- [ ] `.env.production.local` exists with all variables
- [ ] `ecosystem.config.js` exists

Check with:
```bash
ls -la /var/www/hustlehub/ | grep -E "package.json|pnpm-lock|.env|ecosystem"
```

---

## Step 2: Environment Variables

Verify `.env.production.local` contains:

### Critical Variables
- [ ] `NODE_ENV=production`
- [ ] `NEXTAUTH_SECRET=<value>`
- [ ] `NEXTAUTH_URL=https://hustlehubafrica.com`
- [ ] `RESEND_API_KEY=<value>`

### Database Variables
- [ ] `MONGODB_URI=<connection_string>`
- [ ] `DATABASE_URL=<connection_string>` (if using SQL)

### Optional but Recommended
- [ ] `GOOGLE_CLIENT_ID=<value>`
- [ ] `GOOGLE_CLIENT_SECRET=<value>`
- [ ] `MPESA_API_URL=<value>`

Check with:
```bash
cat /var/www/hustlehub/.env.production.local | grep -E "NEXTAUTH|RESEND"
```

---

## Step 3: Dependency Installation

- [ ] Stop any existing processes: `pm2 stop hustlehub 2>/dev/null || true`
- [ ] Delete from PM2: `pm2 delete hustlehub 2>/dev/null || true`
- [ ] Install dependencies:
  ```bash
  cd /var/www/hustlehub
  pnpm install
  ```
- [ ] Verify installation:
  ```bash
  ls -la node_modules/.bin/next
  # Should show the next binary exists
  ```

---

## Step 4: Build Application

- [ ] Remove old build: `rm -rf .next`
- [ ] Run build: `pnpm run build`
- [ ] Wait for build to complete (may take 2-5 minutes)
- [ ] Verify build succeeded:
  ```bash
  ls -la .next/
  # Should show: server, static, standalone, BUILD_ID, cache, etc.
  ```

Build output should show:
```
✓ Compiled successfully
```

---

## Step 5: Start with PM2

- [ ] ecosystem.config.js exists:
  ```bash
  cat /var/www/hustlehub/ecosystem.config.js | head -5
  ```
- [ ] Start PM2:
  ```bash
  cd /var/www/hustlehub
  pm2 start ecosystem.config.js --env production
  ```
- [ ] Check status:
  ```bash
  pm2 list
  # Should show hustlehub as "online"
  ```

---

## Step 6: Verify Server is Running

- [ ] Check PM2 status:
  ```bash
  pm2 show hustlehub
  # Should show status: online
  ```
- [ ] Check logs:
  ```bash
  pm2 logs hustlehub --lines 5
  # Should show "Ready in XXms"
  ```
- [ ] Test server:
  ```bash
  curl http://localhost:5000
  # Should return HTML (not connection error)
  ```

---

## Step 7: Setup Startup on Reboot

- [ ] Create startup script:
  ```bash
  pm2 startup
  # Follow the output instructions if needed
  ```
- [ ] Save PM2 config:
  ```bash
  pm2 save
  ```
- [ ] Verify it's saved:
  ```bash
  pm2 info hustlehub | grep "Restart after system restart"
  ```

---

## Step 8: Configure Log Files

- [ ] Ensure log directory exists:
  ```bash
  mkdir -p /var/log
  chmod 755 /var/log
  ```
- [ ] Verify logs are being written:
  ```bash
  ls -la /var/log/hustlehub-*.log 2>/dev/null || echo "Logs will be created on first error"
  ```

---

## Troubleshooting Checklist

### If Build Fails

- [ ] Check Node version: `node -v` (should be 18+)
- [ ] Check free disk space: `df -h`
- [ ] Clear Next.js cache: `rm -rf .next`
- [ ] Check build logs: `pnpm run build 2>&1 | tail -50`
- [ ] Verify dependencies: `pnpm list`

### If PM2 Won't Start

- [ ] Check port is free: `lsof -i :5000`
- [ ] Check ecosystem.config.js: `cat ecosystem.config.js`
- [ ] Check PM2 logs: `pm2 logs hustlehub --err`
- [ ] Try manual start: `node_modules/.bin/next start -p 5000`

### If Server Crashes Immediately

- [ ] Check environment variables: `env | grep NEXTAUTH`
- [ ] Check database connection: Test MongoDB/SQL connection string
- [ ] Check API keys: Verify RESEND_API_KEY is correct
- [ ] Check logs: `pm2 logs hustlehub --lines 50 --err`

### If You Need to Rebuild

```bash
cd /var/www/hustlehub
pm2 stop hustlehub
rm -rf node_modules .next
pnpm install --frozen-lockfile
pnpm run build
pm2 restart hustlehub
```

---

## Post-Deployment Checks

- [ ] Server is responding: `curl http://localhost:5000` ✓
- [ ] Email sending works (check Resend dashboard)
- [ ] Database queries work (check logs)
- [ ] Authentication works (test login)
- [ ] No high CPU usage: `pm2 monit`
- [ ] No high memory usage: `pm2 monit`

---

## Ongoing Monitoring

Daily checks:
```bash
# Check if running
pm2 list

# Check for errors
pm2 logs hustlehub --err --lines 20

# Check system resources
pm2 monit
```

---

## Update Deployment

When deploying updates:

```bash
cd /var/www/hustlehub

# Get latest code
git pull origin main

# Reinstall if dependencies changed
pnpm install

# Rebuild
pnpm run build

# Restart gracefully
pm2 restart hustlehub

# Verify
pm2 logs hustlehub --lines 5
```

---

## Emergency Recovery

If the server won't start:

```bash
# 1. Stop everything
pm2 stop hustlehub
pm2 delete hustlehub

# 2. Full clean rebuild
cd /var/www/hustlehub
rm -rf node_modules .next package-lock.json pnpm-lock.yaml
pnpm install
pnpm run build

# 3. Check it works
node_modules/.bin/next start -p 5000

# 4. If manual start works, restart PM2
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## Success Indicators

You'll know it's working when:

✓ `pm2 list` shows hustlehub as "online"
✓ `pm2 logs hustlehub` shows "Ready in XXms"
✓ `curl http://localhost:5000` returns HTML
✓ Website loads in browser at https://hustlehubafrica.com
✓ No errors in `pm2 logs hustlehub --err`

---

## Need Help?

1. Check all logs: `pm2 logs hustlehub`
2. Review DEPLOYMENT_GUIDE.md for detailed help
3. Review PM2_ERROR_FIX.md for common issues
4. Check environment variables are set correctly
5. Verify all required services (DB, email) are accessible

---

**Last Updated**: 2026-05-14
**Next.js Version**: 15.3.8
**PM2 Version**: Check with `pm2 -v`
**Node Version**: Should be 18+
