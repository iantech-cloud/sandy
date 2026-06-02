# Quick Reference - External Server Deployment

## 🚀 TL;DR - Get Running in 5 Minutes

### Option A: Using Deploy Script (Recommended)
```bash
cp .env.example .env.local
# Edit .env.local with your credentials (see critical vars below)

chmod +x scripts/deploy.sh
./scripts/deploy.sh production

# Done! App runs on http://localhost:5000
pm2 list
pm2 logs sandy-app
```

### Option B: Manual
```bash
cp .env.example .env.local
# Edit .env.local

pnpm install
pnpm build
pnpm start
# App runs on http://localhost:5000
```

### Option C: With PM2
```bash
cp .env.example .env.local
# Edit .env.local

pnpm install
pnpm build
npm install -g pm2  # If not installed
pm2 start ecosystem.config.js
pm2 logs sandy-app
```

---

## ⚠️ CRITICAL - Environment Variables

### Exact Names Required (Copy-Paste Carefully)

```bash
# Co-operative Bank M-Pesa (REQUIRED)
COOP_CLIENT_ID=your-id-from-bank
COOP_CLIENT_SECRET=your-secret-from-bank
COOP_OPERATOR_CODE=your-operator-code
COOP_BASE_URL=https://openapi.co-opbank.co.ke
COOP_TOKEN_URL=https://openapi.co-opbank.co.ke/token
COOP_STK_PUSH_URL=https://openapi.co-opbank.co.ke/FT/stk/1.0.0
COOP_STK_STATUS_URL=https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/

# Application (REQUIRED)
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_BASE_URL=https://your-domain.com
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
RESEND_API_KEY=your-email-api-key
EMAIL_FROM_ADDRESS=noreply@your-domain.com
```

### Common MISTAKES (Do NOT Use)

```bash
# ❌ WRONG - Will cause payment failures
COOP_BANK_CLIENT_ID=...      # Remove the BANK_
COOP_BANK_CLIENT_SECRET=...  # Remove the BANK_
COOP_BANK_OPERATOR_CODE=...  # Remove the BANK_

# ✓ RIGHT - Use these names
COOP_CLIENT_ID=...
COOP_CLIENT_SECRET=...
COOP_OPERATOR_CODE=...
```

---

## ✅ Validation

Before deploying, run:
```bash
node scripts/validate-env.js
```

Should see:
```
✅ All critical variables are configured correctly
✨ You are ready to deploy!
```

If not, check environment variable names and values.

---

## 📋 Essential Commands

### Start/Stop
```bash
pm2 start ecosystem.config.js      # Start
pm2 stop sandy-app                 # Stop
pm2 restart sandy-app              # Restart
pm2 delete sandy-app               # Remove from PM2
```

### Monitoring
```bash
pm2 list                           # Show all processes
pm2 info sandy-app                 # Detailed info
pm2 logs sandy-app                 # View logs
pm2 logs sandy-app --err           # Only errors
pm2 logs sandy-app --lines 100     # Last 100 lines
pm2 monit                          # Real-time monitoring
```

### Maintenance
```bash
pm2 save                           # Save current state
pm2 startup                        # Auto-start on reboot
pm2 unstartup                      # Disable auto-start
pm2 describe sandy-app             # Process details
```

---

## 🔍 Quick Troubleshooting

### "Missing env var: COOP_CLIENT_ID"
```bash
# Check .env.local has exact name
cat .env.local | grep COOP_CLIENT_ID

# Restart if needed
pm2 restart sandy-app
```

### "Cannot find module 'next'"
```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
pnpm build
pm2 restart sandy-app
```

### "Port 5000 already in use"
```bash
lsof -i :5000
kill -9 <PID>
pm2 restart sandy-app
```

### "Could not find a production build"
```bash
pnpm build
pm2 restart sandy-app
```

### Payment failing with "bank rejected"
```bash
# Check logs
pm2 logs sandy-app | grep -i "coop"

# Verify credentials with Co-op Bank
# Test in their sandbox environment
```

---

## 📚 Full Documentation

For detailed information, see:

| Document | Purpose |
|----------|---------|
| `EXTERNAL_SERVER_SETUP.md` | Complete setup guide |
| `DEPLOYMENT_GUIDE.md` | Comprehensive guide |
| `DEPLOYMENT_CHECKLIST.md` | Pre/post deployment checks |
| `FIX_SUMMARY.md` | All fixes and improvements |
| `.env.example` | Environment variable template |

---

## 🌐 Reverse Proxy (For Production)

### Nginx Setup
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:
```bash
sudo ln -s /etc/nginx/sites-available/sandy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL Certificate
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 🔒 Security Checklist

- [ ] `.env.local` NOT in git (check `.gitignore`)
- [ ] HTTPS enabled in production
- [ ] SSH keys configured (password auth disabled)
- [ ] Firewall restricts ports (80, 443 only)
- [ ] PM2 logs don't expose credentials (they shouldn't after fixes)
- [ ] Database credentials in `.env.local` only
- [ ] Regular backups configured

---

## 📊 Monitoring Setup

### PM2 Plus (Optional)
```bash
pm2 install pm2-auto-pull
pm2 plus  # Enable optional monitoring
```

### System Monitoring
```bash
pm2 monit                    # Built-in monitoring
top                          # System resources
df -h                        # Disk space
free -h                      # Memory usage
```

### Application Health
```bash
# Test endpoint
curl http://localhost:5000/api/auth/check

# Check logs
pm2 logs sandy-app | head -50
```

---

## 💾 Backup Commands

### Database Backup
```bash
# MongoDB backup
mongodump --uri="mongodb+srv://..." --out=./backup

# Restore
mongorestore ./backup
```

### Git Backup
```bash
git commit -am "pre-deployment backup"
git push origin main
```

### Environment Backup
```bash
cp .env.local ~/.config/sandy.env.backup
chmod 600 ~/.config/sandy.env.backup
```

---

## 🚨 Emergency Procedures

### Application Won't Start
```bash
# 1. Check logs
pm2 logs sandy-app --err

# 2. Verify build
ls -la .next/

# 3. Rebuild if needed
pnpm build

# 4. Try manual start
./node_modules/.bin/next start

# 5. If still broken
git log --oneline -10
git checkout <previous-commit>
pnpm build
```

### Rollback to Previous Version
```bash
git checkout <previous-commit>
pnpm install
pnpm build
pm2 restart sandy-app
```

### Port Conflict
```bash
lsof -i :5000
kill -9 <PID>
pm2 restart sandy-app
```

---

## 📞 Getting Help

### Check These First
1. Run `node scripts/validate-env.js` - Validate environment
2. Check logs: `pm2 logs sandy-app --lines 200`
3. Review: `EXTERNAL_SERVER_SETUP.md` troubleshooting section
4. Search: `FIX_SUMMARY.md` for your issue

### Common Issues & Solutions
See "Quick Troubleshooting" section above or full `EXTERNAL_SERVER_SETUP.md`

### Collect Information for Support
```bash
# Environment validation
node scripts/validate-env.js

# Application logs (last 100 lines)
pm2 logs sandy-app --lines 100 > logs.txt

# System info
uname -a > system.txt
node --version >> system.txt
pnpm --version >> system.txt
pm2 --version >> system.txt
```

---

## ✨ Key Points to Remember

✓ Use exact environment variable names (COOP_*, not COOP_BANK_*)
✓ Never commit `.env.local` to git
✓ Validate before deploying: `node scripts/validate-env.js`
✓ Use PM2 for process management: `pm2 start ecosystem.config.js`
✓ Verify with: `pm2 list` and `pm2 logs sandy-app`
✓ Use reverse proxy (Nginx) for production
✓ Enable HTTPS with Let's Encrypt certificate
✓ Configure auto-startup: `pm2 startup` and `pm2 save`
✓ Monitor logs regularly: `pm2 logs sandy-app`
✓ Backup database and code regularly

---

**Status**: ✅ **READY FOR EXTERNAL SERVER DEPLOYMENT**

Start deploying! 🚀
