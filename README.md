# Sandy - HustleHub Africa

A comprehensive platform connecting users with various earning opportunities including content writing, academic writing, research surveys, sales & marketing, and global chat services.

## Quick Links

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment and operations guide
- **[TECHNICAL_REFERENCE.md](./TECHNICAL_REFERENCE.md)** - Technical architecture and implementation details

## Features

- User authentication with email/password
- Multi-service earning platform
- M-Pesa payments via Co-op Bank integration
- Real-time transaction status tracking
- Admin dashboard with analytics
- Dark/Light theme support
- WhatsApp training channel integration
- Responsive mobile and desktop design

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **Backend**: Next.js API Routes + Server Actions
- **Database**: MongoDB with Mongoose
- **Authentication**: Better Auth
- **Payments**: Co-op Bank M-Pesa API
- **Deployment**: PM2 on Linux servers

## Quick Start - Local Development

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values

# Run development server
pnpm dev

# Open browser
open http://localhost:3000
```

## Production Deployment

### First-Time Setup

```bash
# SSH into your server
ssh user@your-server.com

# Clone repository
git clone git@github.com:iantech-cloud/sandy.git
cd sandy

# Setup environment
cp .env.example .env.production.local
# Edit with your production values

# Install PM2 globally
npm install -g pm2

# Make deploy script executable
chmod +x scripts/deploy.sh

# Run fresh deployment
./scripts/deploy.sh production
```

### Ongoing Deployments

After code changes are pushed to GitHub:

```bash
# SSH into server
ssh user@your-server.com
cd /var/www/sandy

# Deploy new changes
./scripts/deploy.sh production

# Script automatically:
# 1. Pulls latest from GitHub
# 2. Installs dependencies
# 3. Builds application
# 4. Restarts PM2 process
# 5. Verifies health
```

## Environment Setup

### Required Environment Variables

```bash
# Co-op Bank Integration (CRITICAL for payments)
COOP_BANK_BASIC_AUTH=Basic <base64-credentials>
COOP_BANK_OPERATOR_CODE=OPERATOR
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/stk-push
COOP_BANK_STK_STATUS_ENDPOINT=/stk-status

# Application
NODE_ENV=production
PORT=5000
DATABASE_URL=mongodb://...
JWT_SECRET=your-secret-key

# Optional Services
AI_GATEWAY_API_KEY=your-key-if-using-ai
BLOB_READ_WRITE_TOKEN=your-blob-token
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete configuration guide.

## PM2 Management

```bash
# View status
pm2 status

# View logs
pm2 logs sandy-app

# Restart application
pm2 restart sandy-app

# Stop/start
pm2 stop sandy-app
pm2 start ecosystem.config.js --env production

# Setup auto-restart on reboot
sudo env PATH=$PATH:/usr/local/bin pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))
pm2 save
```

## Payment System

The application uses Co-op Bank's M-Pesa API for deposits and withdrawals.

### Key Features
- **Token Caching**: Reduces API calls by ~95% and prevents rate limiting
- **Dual Ledger**: Tracks both M-Pesa responses and user transactions
- **Automatic Recovery**: Cron job reconciles stuck transactions
- **Webhook Support**: Real-time payment status updates

### Payment Flow
1. User initiates payment → STK prompt
2. User enters M-Pesa PIN → Payment processed
3. Co-op Bank confirms → Dashboard updated
4. Status tracked in real-time

See [TECHNICAL_REFERENCE.md](./TECHNICAL_REFERENCE.md#payment-system-architecture) for detailed architecture.

## Monitoring

### Health Check Endpoint
```bash
curl http://localhost:5000/api/auth/check
```

### View Application Logs
```bash
pm2 logs sandy-app

# Last 50 lines
pm2 logs sandy-app --lines 50

# Real-time monitoring
pm2 monit
```

### Key Metrics
- Token cache hit rate (should be >95%)
- Payment success rate (should be >95%)
- Memory usage (should be <500MB)
- API response times (<200ms)

## Troubleshooting

### Application won't start
1. Check logs: `pm2 logs sandy-app`
2. Verify .env file: `ls -la .env.local`
3. Check port availability: `lsof -i :5000`
4. Restart PM2: `pm2 restart sandy-app`

### Payment timeout errors
1. Verify Co-op Bank credentials are correct
2. Check token caching is working: Look for "Using cached token" in logs
3. Confirm network connectivity to Co-op Bank
4. Check M-Pesa is properly formatted (254712345678)

### High memory usage
1. Restart application: `pm2 restart sandy-app`
2. Check for memory leaks in logs
3. Monitor with: `pm2 monit`

See [DEPLOYMENT.md](./DEPLOYMENT.md#troubleshooting) for detailed troubleshooting.

## Project Structure

```
sandy/
├── app/
│   ├── api/              # API routes and webhooks
│   ├── dashboard/        # User dashboard pages
│   ├── admin/           # Admin dashboard pages
│   ├── ui/              # Reusable components
│   └── lib/             # Utilities and services
├── scripts/             # Deployment and maintenance scripts
│   └── deploy.sh        # Main deployment script (pulls from GitHub + builds)
├── public/              # Static assets
├── ecosystem.config.js  # PM2 configuration
├── DEPLOYMENT.md        # Deployment & operations guide
├── TECHNICAL_REFERENCE.md # Technical architecture guide
└── README.md            # This file
```

## Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally: `pnpm dev`
3. Commit changes: `git commit -am "feat: description"`
4. Push to GitHub: `git push origin feature/your-feature`
5. Create Pull Request on GitHub
6. After merge to main, deploy: `./scripts/deploy.sh production`

## Security

- All payment credentials stored in environment variables
- HTTPS/SSL configured with reverse proxy (Nginx/Apache)
- Rate limiting on sensitive endpoints
- CSRF protection on state-changing operations
- Input validation on all API endpoints
- Parameterized database queries

## Performance

- Token caching reduces API calls by ~95%
- Database connection pooling
- Code splitting for faster page loads
- Automatic image optimization
- Compression and caching headers
- Memory monitoring with auto-restart at 500MB

## Support

For issues or questions:
1. Check logs: `pm2 logs sandy-app --err`
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md) and [TECHNICAL_REFERENCE.md](./TECHNICAL_REFERENCE.md)
3. Contact DevOps team

## License

Proprietary - HustleHub Africa
