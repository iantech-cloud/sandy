const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

module.exports = {
  apps: [
    {
      name: 'hustlehub',
      script: '.next/standalone/server.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '0.0.0.0',
      },
      // Logging
      error_file: '/var/log/hustlehub-error.log',
      out_file: '/var/log/hustlehub-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart policy
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      kill_timeout: 5000,
      // Merge logs
      merge_logs: true,
    },
  ],
  // Global settings
  deploy: {
    production: {
      user: 'root',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/iantech-cloud/sandy.git',
      path: '/var/www/hustlehub',
      'post-deploy': 'pnpm install && pnpm run build && pm2 reload ecosystem.config.js',
      'pre-deploy-local': 'echo "Deploying to production server"',
    },
  },
};
