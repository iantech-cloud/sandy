# External Server Deployment Checklist

## Pre-Deployment Phase

### 1. Environment Variables ✓
- [ ] Obtain Co-operative Bank credentials from bank contact
- [ ] Copy `.env.example` to `.env.local` or `.env.production.local`
- [ ] Fill in ALL required variables:
  - [ ] `COOP_CLIENT_ID` ⚠️ (NOT `COOP_BANK_CLIENT_ID`)
  - [ ] `COOP_CLIENT_SECRET` ⚠️ (NOT `COOP_BANK_CLIENT_SECRET`)
  - [ ] `COOP_OPERATOR_CODE` ⚠️ (NOT `COOP_BANK_OPERATOR_CODE`)
  - [ ] `NEXTAUTH_SECRET` (generate: `openssl rand -base64 32`)
  - [ ] `NEXTAUTH_URL` (your domain)
  - [ ] `NEXT_PUBLIC_BASE_URL` (your domain)
  - [ ] `MONGODB_URI` (connection string)
  - [ ] `RESEND_API_KEY` (email service)
  - [ ] `EMAIL_FROM_ADDRESS` (email sender)
  - [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (if using OAuth)

### 2. Environment Validation ✓
- [ ] Run validation script:
  ```bash
  node scripts/validate-env.js
  ```
- [ ] All critical variables show ✓
- [ ] No common mistakes warnings ⚠️
- [ ] No errors reported

### 3. Server Prerequisites ✓
- [ ] Node.js 22.x installed: `node --version`
- [ ] pnpm installed: `pnpm --version`
- [ ] MongoDB connection tested
- [ ] Outbound HTTPS access available
- [ ] Port 5000 available (or configure alternate port)
- [ ] Log directory created: `mkdir -p /var/log/sandy`

### 4. Domain & HTTPS ✓
- [ ] Domain registered and DNS configured
- [ ] SSL certificate installed and valid
- [ ] HTTPS working: `curl -I https://your-domain.com`
- [ ] Callback URL will be: `https://your-domain.com/api/payments/coop-bank/callback`

### 5. Git Repository ✓
- [ ] Repository cloned to server
- [ ] Correct branch checked out
- [ ] `.env.local` is in `.gitignore`
- [ ] No secrets committed

## Deployment Phase

### 1. Install Dependencies ✓
```bash
cd /var/www/sandy
pnpm install --frozen-lockfile
# Verify no errors
pnpm list --depth=0
```

### 2. Build Application ✓
```bash
pnpm run build
# Should complete without errors and create .next directory
ls -la .next/
```

### 3. Setup PM2 ✓
```bash
npm install -g pm2
mkdir -p /var/log/sandy
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u appuser
sudo systemctl enable pm2-appuser
```

### 4. Verify Application ✓
```bash
# Check PM2 status
pm2 status

# Check process info
pm2 info sandy-app

# Test application responds
curl http://localhost:5000
curl http://localhost:5000/api/auth/check

# View logs
pm2 logs sandy-app --lines 50
```

### 5. Configure Nginx (Optional but Recommended) ✓
```bash
# Create /etc/nginx/sites-available/sandy
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable and test
sudo ln -s /etc/nginx/sites-available/sandy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Setup HTTPS with Let's Encrypt ✓
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Auto-renew should be set up automatically
sudo systemctl status certbot.timer
```

## Co-operative Bank Specific Setup

### 1. Credentials Verification ✓
- [ ] Bank has registered your callback URL
- [ ] Callback URL matches `NEXT_PUBLIC_BASE_URL/api/payments/coop-bank/callback`
- [ ] Credentials tested in sandbox first (if available)

### 2. Token Authentication ✓
- [ ] Base64 encoding working correctly
- [ ] Token endpoint accessible from server: `curl https://openapi.co-opbank.co.ke/token`
- [ ] STK Push endpoint accessible: `curl https://openapi.co-opbank.co.ke/FT/stk/1.0.0`

### 3. Callback Configuration ✓
- [ ] Callback URL is publicly accessible
- [ ] Firewall allows inbound requests from Co-op Bank IPs (if needed)
- [ ] MongoDB is receiving callback payloads
- [ ] Transaction status updates correctly

### 4. Test Payment Flow ✓
```bash
# Monitor logs
pm2 logs sandy-app --lines 100

# Initiate test payment (10 KES minimum)
curl -X POST http://localhost:5000/api/payments/coop-bank/stk-push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-auth-token>" \
  -d '{
    "amount": 10,
    "phoneNumber": "2547XXXXXXXX",
    "narration": "Test payment"
  }'

# Should receive messageReference in response
# Check MongoDB for transaction record
# Await callback to confirm status
```

## Post-Deployment Phase

### 1. Monitoring Setup ✓
- [ ] PM2 logging configured
- [ ] Error logs being captured: `/var/log/sandy/error.log`
- [ ] Application logs being captured: `/var/log/sandy/out.log`
- [ ] Log rotation configured (if needed)

### 2. Backup Strategy ✓
- [ ] MongoDB backups automated
- [ ] Backup location: Separate server/cloud storage
- [ ] Test restore procedure
- [ ] Backup retention policy set (e.g., 30 days)

### 3. Monitoring & Alerts ✓
- [ ] Application uptime monitoring
- [ ] Payment failure alerts configured
- [ ] Error rate monitoring
- [ ] Memory/CPU usage monitoring
- [ ] Database connection monitoring

### 4. Security Hardening ✓
- [ ] Firewall configured (allow ports 80, 443, 22 only)
- [ ] SSH key authentication enabled (password disabled)
- [ ] `.env.local` file permissions: `chmod 600`
- [ ] Application user has limited privileges
- [ ] Regular security updates scheduled
- [ ] SSL certificate auto-renewal tested

### 5. Performance Verification ✓
```bash
# Check application response time
curl -w "Time: %{time_total}s\n" https://your-domain.com

# Monitor memory usage
pm2 list

# Check database connection speed
# (From application logs or monitoring dashboard)
```

### 6. Documentation ✓
- [ ] Deployment procedure documented
- [ ] Emergency contacts documented
- [ ] Rollback procedure documented
- [ ] Team has access to:
  - [ ] Server credentials
  - [ ] Database credentials
  - [ ] Co-op Bank credentials (encrypted)
  - [ ] Monitoring dashboard

## Troubleshooting Reference

### Issue: STK Push Returns "Missing env var: COOP_CLIENT_ID"
**Solution:**
```bash
# Check env variables are loaded
pm2 info sandy-app | grep env
# Verify .env.local exists and has correct names
cat .env.local | grep COOP
# Restart PM2
pm2 restart sandy-app
```

### Issue: Payments Work in Sandbox but Not Production
**Solution:**
- [ ] Verify `COOP_CLIENT_ID` and `COOP_CLIENT_SECRET` are production credentials (not sandbox)
- [ ] Verify `COOP_BASE_URL` is production URL
- [ ] Check Co-op Bank account is active
- [ ] Verify operator code is registered

### Issue: Callback Not Received
**Solution:**
```bash
# Test callback URL accessibility
curl -v https://your-domain.com/api/payments/coop-bank/callback

# Check server logs for incoming requests
pm2 logs sandy-app | grep "CoopCallback"

# Check firewall allows inbound
sudo ufw status
sudo ufw allow from any to any port 443

# Test with Co-op Bank test tools or Postman
```

### Issue: Application Won't Start with PM2
**Solution:**
```bash
# Check logs for startup errors
pm2 logs sandy-app --err

# Verify build was successful
ls -la .next/

# Check Node.js version
node --version  # Should be 22.x

# Try starting in foreground
./node_modules/.bin/next start

# If that fails, rebuild
pnpm run build
pnpm start
```

### Issue: Port Already in Use
**Solution:**
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>

# Or use different port
pm2 start ecosystem.config.js --env production -- --port 5001
```

## Rollback Procedure

If something goes wrong:

```bash
# 1. Stop current process
pm2 stop sandy-app

# 2. Restore previous code (if using git)
git checkout <previous-commit>

# 3. Reinstall and rebuild (if dependencies changed)
pnpm install
pnpm run build

# 4. Restart
pm2 start sandy-app

# 5. If still broken, restore from backup
# (Have backup procedure ready)
```

## Sign-Off Checklist

- [ ] All environment variables validated
- [ ] Application builds successfully
- [ ] PM2 process running without crashes
- [ ] Database connected and responding
- [ ] Test payment initiated and completed successfully
- [ ] Callback received and transaction updated
- [ ] Production domain accessible via HTTPS
- [ ] Team trained on monitoring and troubleshooting
- [ ] Documentation updated with actual server details
- [ ] Monitoring alerts configured and tested

**Deployment Date:** ___________
**Deployed By:** ___________
**Verified By:** ___________
**Notes:** _________________________________________________________________
