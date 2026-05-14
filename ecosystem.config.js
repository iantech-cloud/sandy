module.exports = {
  apps: [
    {
      name: 'hustlehub',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 5000 -H 0.0.0.0',

      cwd: '/var/www/hustlehub',

      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      error_file: '/var/log/hustlehub-error.log',
      out_file: '/var/log/hustlehub-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,

      merge_logs: true,
    },
  ],
};
