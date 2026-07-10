# Sandy Application - Deployment & Operations Guide

## Quick Start Deployment

### Prerequisites
- Node.js 22.x
- pnpm package manager
- PM2 (global): `npm install -g pm2`
- Git for pulling changes
- MongoDB connection configured
- Co-op Bank API credentials in .env

### Fresh Deployment from GitHub

```bash
# Navigate to application directory
cd /var/www/sandy

# Pull latest changes
git pull origin main

# Deploy using script
chmod +x scripts/deploy.sh
./scripts/deploy.sh production
```

The script automatically:
1. Validates prerequisites
2. Installs dependencies with pnpm
3. Builds Next.js application
4. Starts/restarts PM2 process
5. Verifies deployment health
6. Shows status and logs

### PM2 Management Commands

```bash
# View application status
pm2 status

# View detailed process info
pm2 info sandy-app

# View application logs
pm2 logs sandy-app

# Restart application
pm2 restart sandy-app

# Stop application
pm2 stop sandy-app

# Start application
pm2 start ecosystem.config.js --env production

# Delete process
pm2 delete sandy-app

# Setup auto-startup on system reboot
sudo env PATH=$PATH:/usr/local/bin pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))
pm2 save
```

## Environment Configuration

Required environment variables in `.env.local` or `.env.production.local`:

```
# Co-op Bank Integration
COOP_BANK_BASIC_AUTH=Basic <base64-encoded-credentials>
COOP_BANK_OPERATOR_CODE=OPERATOR_CODE
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/stk-push
COOP_BANK_STK_STATUS_ENDPOINT=/stk-status
COOP_BANK_RECOVER_ENDPOINT=/recover

# Application
NODE_ENV=production
PORT=5000
DATABASE_URL=mongodb://...
JWT_SECRET=your-secret-key

# Payment
MPESA_SHORTCODE=123456
MPESA_PASSKEY=your-passkey
```

## Performance Tuning

### Memory Management
- Node.js max heap: 2GB (configured in ecosystem.config.js)
- PM2 auto-restart at 500MB memory usage
- Monitor with: `pm2 monitor` or `pm2 logs sandy-app`

### Token Caching
- Access tokens cached in memory with 60s expiry buffer
- Reduces Co-op Bank API calls by ~95%
- Prevents rate limiting on payment requests

### Database
- Connection pooling configured
- Transaction sessions for atomic operations
- Proper indexing on user and payment collections

## Health Checks

Application health endpoint: `GET /api/auth/check`

Check status:
```bash
curl http://localhost:5000/api/auth/check
```

## Troubleshooting

### Application won't start
```bash
# Check logs
pm2 logs sandy-app

# Verify .env file exists and is valid
ls -la .env.local .env.production.local

# Check port availability
lsof -i :5000

# Verify Node.js and pnpm installed
node --version
pnpm --version
```

### High memory usage
```bash
# Restart to clear memory
pm2 restart sandy-app

# Check for memory leaks in logs
pm2 logs sandy-app | grep -i memory
```

### Payment timeout issues
- Check Co-op Bank token is cached (should be logged)
- Verify COOP_BANK_BASIC_AUTH is properly formatted
- Check token endpoint is reachable
- Review payment logs for Co-op Bank response codes

## Monitoring & Maintenance

### Regular Tasks
- Monitor disk space: `df -h`
- Check memory usage: `free -h`
- Review error logs weekly: `pm2 logs sandy-app --err`
- Backup database regularly

### Production Checklist
- HTTPS/SSL configured with reverse proxy (Nginx/Apache)
- Firewall rules configured (allow :80, :443, block :5000)
- Regular database backups scheduled
- Monitoring alerts configured
- PM2 startup on system reboot enabled
- Application logs rotated to prevent disk bloat

## Reverse Proxy Setup (Nginx Example)

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then redirect HTTP to HTTPS and configure SSL certificate.
