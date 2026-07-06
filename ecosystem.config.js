/**
 * PM2 Ecosystem Configuration for External Server Deployment
 * 
 * This file configures how PM2 will manage the Next.js application on production servers.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 start ecosystem.config.js --env staging
 *   pm2 start ecosystem.config.js --env development
 * 
 * ⚠️  CRITICAL: Ensure .env.local or .env.production.local has correct variable names:
 *   - COOP_BANK_BASIC_AUTH (Pre-encoded "Basic <base64...>" auth header)
 *   - COOP_BANK_OPERATOR_CODE (Operator code like "SANDRA")
 *   - COOP_BANK_TOKEN_ENDPOINT (Token endpoint path)
 *   - COOP_BANK_STK_PUSH_ENDPOINT (STK push endpoint path)
 *   - COOP_BANK_STK_STATUS_ENDPOINT (Status check endpoint path)
 */

module.exports = {
  apps: [
    {
      // ===================================================================
      // Application Metadata
      // ===================================================================
      name: 'sandy-app',
      description: 'HustleHub Africa - Payment & Content Platform',
      
      // ===================================================================
      // Execution & Startup
      // ===================================================================
      script: './node_modules/.bin/next',
      args: 'start',
      
      // ===================================================================
      // Working Directory (update to your server path)
      // ===================================================================
      cwd: process.env.APP_DIR || '/var/www/sandy',

      // ===================================================================
      // Process Management
      // ===================================================================
      instances: 1,              // Single instance
      exec_mode: 'fork',         // Single fork mode
      watch: false,              // Don't watch files in production
      
      // ===================================================================
      // Environment Configuration
      // ===================================================================
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOSTNAME: '0.0.0.0',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOSTNAME: 'localhost',
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5000,
        HOSTNAME: '0.0.0.0',
      },

      // ===================================================================
      // Restart & Recovery Policies (Optimized for 2GB server)
      // ===================================================================
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      max_memory_restart: '900M',  // Restart if exceeds 900MB (safeguard for 2GB)

      // ===================================================================
      // Logging (Optimized log rotation)
      // ===================================================================
      error_file: '/var/log/sandy/error.log',
      out_file: '/var/log/sandy/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: false,
      max_file: 5242880,           // Max 5MB per log file
      max_restarts_log: '/var/log/sandy/restart.log',

      // ===================================================================
      // Graceful Shutdown
      // ===================================================================
      kill_timeout: 30000,        // 30 seconds for graceful shutdown

      // ===================================================================
      // Environment Files (PM2 will read in order)
      // ===================================================================
      env_file: [
        '.env.local',
        '.env.production.local',
        '.env',
      ],

      // ===================================================================
      // Node.js Options (Optimized for 2GB server)
      // ===================================================================
      node_args: [
        '--max-old-space-size=1400',  // 1.4GB old space (reserved 600MB for OS/system)
        '--max-semi-space-size=256',  // Smaller semi-space for GC efficiency
        '--nouse-strict',
      ],

      // ===================================================================
      // File Watching (Ignored paths)
      // ===================================================================
      ignore_watch: [
        'node_modules',
        '.next',
        'dist',
        'logs',
        '.git',
      ],
    },
  ],

  // ======================================================================
  // Deploy Configuration (for PM2 Deploy)
  // ======================================================================
  deploy: {
    production: {
      user: 'appuser',
      host: 'your.production.server',
      ref: 'origin/main',
      repo: 'git@github.com:iantech-cloud/sandy.git',
      path: '/var/www/sandy',
      'pre-deploy-local': 'echo "Deploying Sandy app..."',
      'post-deploy': 'pnpm install && pnpm run build && pm2 startOrRestart ecosystem.config.js --env production',
    },
    staging: {
      user: 'appuser',
      host: 'staging.server',
      ref: 'origin/staging',
      repo: 'git@github.com:iantech-cloud/sandy.git',
      path: '/var/www/sandy-staging',
      'post-deploy': 'pnpm install && pnpm run build && pm2 startOrRestart ecosystem.config.js --env staging',
    },
  },
};
