# External Server Setup Guide

## ⚠️ CRITICAL: This app does NOT run on Vercel

This application is specifically designed for deployment on external servers. It uses Co-operative Bank M-Pesa as the primary payment gateway and requires specific environment variable configurations.

**Do NOT deploy to Vercel.** Use:
- Your own Linux/Unix server
- Docker containers on any cloud provider
- PM2 for process management
- Nginx/Apache as reverse proxy

---

## Quick Start (5 minutes)

### 1. Clone the Repository
```bash
git clone https://github.com/iantech-cloud/sandy.git
cd sandy
```

### 2. Setup Environment
```bash
cp .env.example .env.local
# Edit .env.local with your actual credentials (see below)
nano .env.local
```

### 3. Run Deployment Script
```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

Done! Application should be running on `http://localhost:5000`

---

## Environment Variables - CRITICAL ⚠️

### Must-Have Names (Exact Spelling Required)

These variables **MUST** be named exactly as shown or payments will fail:

```bash
# Co-operative Bank M-Pesa (PRIMARY PAYMENT GATEWAY)
# ⚠️ NOTE: No BANK_ in the names!
COOP_CLIENT_ID=your-client-id
COOP_CLIENT_SECRET=your-client-secret
COOP_OPERATOR_CODE=your-operator-code
COOP_BASE_URL=https://openapi.co-opbank.co.ke
COOP_TOKEN_URL=https://openapi.co-opbank.co.ke/token
COOP_STK_PUSH_URL=https://openapi.co-opbank.co.ke/FT/stk/1.0.0
COOP_STK_STATUS_URL=https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/

# Other Required Variables
NEXTAUTH_SECRET=your-secret-key-here  # Generate: openssl rand -base64 32
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_BASE_URL=https://your-domain.com
MONGODB_URI=mongodb+srv://...
RESEND_API_KEY=your-resend-key
EMAIL_FROM_ADDRESS=noreply@your-domain.com
```

### Common Mistakes (Do NOT Use)

```bash
# ❌ WRONG - These will FAIL
COOP_BANK_CLIENT_ID=...       # Should be COOP_CLIENT_ID
COOP_BANK_CLIENT_SECRET=...   # Should be COOP_CLIENT_SECRET
COOP_BANK_OPERATOR_CODE=...   # Should be COOP_OPERATOR_CODE
COOP_BANK_ENVIRONMENT=...     # Remove this entirely

# ✓ RIGHT - These will work
COOP_CLIENT_ID=...
COOP_CLIENT_SECRET=...
COOP_OPERATOR_CODE=...
```

---

## Installation Methods

### Method 1: Manual Installation (Recommended for Testing)

```bash
# 1. Install dependencies
pnpm install

# 2. Build the application
pnpm build

# 3. Start the server
pnpm start
```

**Application runs on:** `http://localhost:5000`

### Method 2: Using PM2 (Recommended for Production)

```bash
# 1. Install PM2 globally (one-time)
npm install -g pm2

# 2. Make deploy script executable
chmod +x scripts/deploy.sh

# 3. Run deployment
./scripts/deploy.sh production

# 4. Check status
pm2 list
pm2 logs sandy-app
```

**Application runs on:** `http://localhost:5000`

**Auto-restart enabled:** Yes (if process crashes)

**Auto-start on reboot:** Run this once:
```bash
pm2 startup
pm2 save
```

### Method 3: Docker

Create `Dockerfile`:
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production
EXPOSE 5000
CMD ["pnpm", "start"]
```

Build and run:
```bash
docker build -t sandy-app .
docker run -p 5000:5000 \
  --env-file .env.local \
  -v /var/log/sandy:/var/log/sandy \
  sandy-app
```

### Method 4: Systemd Service (Recommended for Linux)

Create `/etc/systemd/system/sandy.service`:
```ini
[Unit]
Description=Sandy Payment Application
After=network.target mongodb.service

[Service]
Type=simple
User=appuser
WorkingDirectory=/var/www/sandy
EnvironmentFile=/var/www/sandy/.env.local
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10
StandardOutput=append:/var/log/sandy/out.log
StandardError=append:/var/log/sandy/error.log

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sandy
sudo systemctl start sandy
sudo systemctl status sandy
```

---

## Verifying Your Setup

### 1. Check Application is Running
```bash
curl http://localhost:5000
# Should return HTML (homepage)
```

### 2. Check API Health
```bash
curl http://localhost:5000/api/auth/check
# Should return JSON response
```

### 3. Validate Environment Variables
```bash
node scripts/validate-env.js
# All checks should pass with ✓
```

### 4. Check Co-operative Bank Connection
Look for these logs:
```bash
pm2 logs sandy-app | grep -i "coop"
# Should show successful token requests
```

### 5. Test Payment Initiation
The application won't start payments without proper auth, but the endpoint should be accessible:
```bash
curl -X POST http://localhost:5000/api/payments/coop-bank/stk-push \
  -H "Content-Type: application/json" \
  -d '{"amount": 10, "phoneNumber": "2547XXXXXXXX"}'
# Should return 401 (Unauthorized) or error about missing payment details
# Not an error about missing COOP_CLIENT_ID
```

---

## Reverse Proxy Setup (For Production)

### Using Nginx

Create `/etc/nginx/sites-available/sandy`:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com;

    # SSL Certificate (Get from Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Proxy settings
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Callback endpoint (important for payments)
    location /api/payments/coop-bank/callback {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/sandy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Using Let's Encrypt SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# Follow the prompts
# Renewal is automatic
```

---

## Monitoring & Logs

### View Application Logs
```bash
# Real-time logs
pm2 logs sandy-app

# Last 100 lines
pm2 logs sandy-app --lines 100

# Only errors
pm2 logs sandy-app --err

# Output to file
pm2 logs sandy-app > app.log
```

### Check Payment Logs
```bash
# All Co-op Bank related logs
pm2 logs sandy-app | grep -i "coop"

# Callback logs
pm2 logs sandy-app | grep "CoopCallback"

# STK Push logs
pm2 logs sandy-app | grep "STK"
```

### Monitor System Resources
```bash
# PM2 monitoring
pm2 monit

# System monitoring
top
htop
df -h
free -h
```

---

## Common Issues & Solutions

### Issue: "Missing env var: COOP_CLIENT_ID"
**Cause:** Wrong environment variable names used

**Solution:**
1. Check `.env.local` file
2. Ensure variable names are **exactly**: `COOP_CLIENT_ID`, `COOP_CLIENT_SECRET`, `COOP_OPERATOR_CODE`
3. Not `COOP_BANK_*` or any other variation
4. Restart: `pm2 restart sandy-app`

### Issue: "Cannot find module 'next'"
**Cause:** Dependencies not installed

**Solution:**
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
pm2 restart sandy-app
```

### Issue: Port 5000 Already in Use
**Solution:**
```bash
# Find the process
lsof -i :5000

# Kill it
kill -9 <PID>

# Or use a different port
PORT=5001 pnpm start
```

### Issue: "Could not find a production build"
**Cause:** `.next` directory doesn't exist

**Solution:**
```bash
pnpm build
# This creates the .next directory
pm2 restart sandy-app
```

### Issue: STK Push Returns Bank Error
**Cause:** Credentials or operator code incorrect

**Solution:**
1. Verify credentials with Co-operative Bank
2. Test in their sandbox environment first
3. Ensure operator code is registered with the bank
4. Check Co-op Bank API status
5. Review logs: `pm2 logs sandy-app | grep -i "token"`

### Issue: Callback Not Received
**Cause:** Callback URL not registered or firewall blocking

**Solution:**
1. Test callback URL is accessible: `curl https://your-domain.com/api/payments/coop-bank/callback`
2. Check firewall allows inbound on port 443
3. Verify with Co-op Bank that callback URL is registered
4. Check application logs for incoming requests

---

## Backup & Recovery

### Backup Database
```bash
# Backup MongoDB
mongodump --uri="mongodb+srv://..." --out=./backup

# Restore from backup
mongorestore ./backup
```

### Backup Application Code
```bash
# Git is your backup
git commit -am "pre-deployment backup"
git push origin main

# Restore if needed
git checkout <commit-hash>
pnpm build
pm2 restart sandy-app
```

### Backup Environment
```bash
# Securely backup .env.local (NEVER commit to git)
cp .env.local ~/.config/sandy.env.backup
chmod 600 ~/.config/sandy.env.backup
```

---

## Deployment Checklist

Before going live:

- [ ] Environment variables set correctly (run `node scripts/validate-env.js`)
- [ ] Application builds without errors (`pnpm build`)
- [ ] Application starts successfully (`pm2 start ecosystem.config.js`)
- [ ] Health check passes (`curl http://localhost:5000/api/auth/check`)
- [ ] Co-op Bank credentials tested
- [ ] Callback URL is publicly accessible
- [ ] HTTPS certificate installed
- [ ] Nginx/Apache reverse proxy configured
- [ ] PM2 startup configured for auto-reboot
- [ ] Monitoring and alerts set up
- [ ] Backups configured
- [ ] Team trained on basic troubleshooting

---

## Support & Troubleshooting

### Get Help
1. Check these logs:
   ```bash
   pm2 logs sandy-app --lines 200
   pm2 logs sandy-app --err
   ```

2. Run validation:
   ```bash
   node scripts/validate-env.js
   ```

3. Check Co-operative Bank API status manually:
   ```bash
   curl -v https://openapi.co-opbank.co.ke/token
   ```

4. Review documentation:
   - `DEPLOYMENT_GUIDE.md` - Comprehensive guide
   - `DEPLOYMENT_CHECKLIST.md` - Pre-deployment checklist
   - `EXTERNAL_SERVER_SETUP.md` - This file

### Emergency Restart
```bash
# Stop the app
pm2 stop sandy-app

# Check what's wrong
pm2 logs sandy-app --err

# Fix the issue

# Restart
pm2 start sandy-app
```

### Rollback to Previous Version
```bash
git checkout <previous-commit>
pnpm install
pnpm build
pm2 restart sandy-app
```

---

## Production Checklist

- [ ] Domain registered and DNS configured
- [ ] SSL certificate installed and valid
- [ ] Firewall configured (ports 80, 443 only for web)
- [ ] SSH key authentication enabled (password disabled)
- [ ] Application running behind reverse proxy
- [ ] PM2 auto-startup configured
- [ ] Monitoring dashboard set up
- [ ] Backup procedure tested
- [ ] Team has documentation and credentials
- [ ] Emergency contact list prepared

---

**Last Updated:** June 2024
**Version:** 1.0
**Maintained By:** Development Team
