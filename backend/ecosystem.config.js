'use strict';

/**
 * PM2 Ecosystem Configuration
 *
 * Process layout (all processes managed by a single PM2 instance on the VPS):
 *   1. api                    — Express HTTP API
 *   2. worker-email           — RabbitMQ consumer: emails queue
 *   3. worker-telegram        — RabbitMQ consumer: telegram queue
 *   4. worker-invoice         — RabbitMQ consumer: invoices queue
 *   5. worker-subscription    — RabbitMQ consumer: subscription-checks queue
 *   6. worker-payment-retry   — RabbitMQ consumer: payment-retries queue
 *   7. worker-backup          — RabbitMQ consumer: backups queue
 *   8. n8n                    — Workflow automation (Phase 4+)
 *
 * Usage:
 *   pm2 start ecosystem.config.js           # start all
 *   pm2 start ecosystem.config.js --only api # start one process
 *   pm2 reload ecosystem.config.js          # zero-downtime reload (Phase 8: cluster mode)
 */

module.exports = {
  apps: [
    // ─── API Server ─────────────────────────────────────────────────────────
    {
      name: 'api',
      script: 'dist/server.js',
      node_args: '-r dotenv/config',
      cwd: __dirname,
      instances: 1, // Phase 8: change to 'max' for cluster mode
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      // Restart policy
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      // Logging
      out_file: './logs/api.out.log',
      error_file: './logs/api.err.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // ─── Background Workers (Phase 4) ───────────────────────────────────────
    {
      name: 'worker-email',
      script: 'dist/workers/email.worker.js',
      node_args: '-r dotenv/config',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '256M',
      out_file: './logs/worker-email.out.log',
      error_file: './logs/worker-email.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-telegram',
      script: 'dist/workers/telegram.worker.js',
      node_args: '-r dotenv/config',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '256M',
      out_file: './logs/worker-telegram.out.log',
      error_file: './logs/worker-telegram.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-invoice',
      script: 'dist/workers/invoice.worker.js',
      node_args: '-r dotenv/config',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '256M',
      out_file: './logs/worker-invoice.out.log',
      error_file: './logs/worker-invoice.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-subscription',
      script: 'dist/workers/subscription-check.worker.js',
      node_args: '-r dotenv/config',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '256M',
      out_file: './logs/worker-subscription.out.log',
      error_file: './logs/worker-subscription.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-payment-retry',
      script: 'dist/workers/payment-retry.worker.js',
      node_args: '-r dotenv/config',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '256M',
      out_file: './logs/worker-payment-retry.out.log',
      error_file: './logs/worker-payment-retry.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-backup',
      script: 'dist/workers/backup.worker.js',
      node_args: '-r dotenv/config',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '256M',
      out_file: './logs/worker-backup.out.log',
      error_file: './logs/worker-backup.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-firestore-retry',
      script: 'dist/workers/firestore-retry.worker.js',
      node_args: '-r dotenv/config',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: { NODE_ENV: 'production' },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '256M',
      out_file: './logs/worker-firestore-retry.out.log',
      error_file: './logs/worker-firestore-retry.err.log',
      merge_logs: true,
    },
    {
      name: 'n8n',
      script: 'n8n',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        N8N_PORT: 5678,
      },
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      out_file: './logs/n8n.out.log',
      error_file: './logs/n8n.err.log',
      merge_logs: true,
    },
  ],
};
