#!/bin/bash

# QUICK FIX - Copy & Paste This Command
# This fixes the PM2 error in 2 minutes

cd /var/www/hustlehub && \
pm2 stop hustlehub 2>/dev/null || true && \
pm2 delete hustlehub 2>/dev/null || true && \
pnpm install && \
pnpm run build && \
pm2 start ecosystem.config.js --env production && \
pm2 save && \
pm2 logs hustlehub --lines 10

echo ""
echo "✓ Done! Your server should now be running."
echo "Check: pm2 list"
