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
 * Phase 0 note: only the `api` process is active now.
 * Worker entries are defined here so the file is ready for Phase 4 —
 * each worker is commented out and will be uncommented when implemented.
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
      script: 'ts-node',
      args: '--require dotenv/config src/server.ts',
      cwd: __dirname,
      instances: 1, // Phase 8: change to 'max' for cluster mode
      exec_mode: 'fork',
      watch: false,
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
    // Uncomment each entry when the worker is implemented in Phase 4.
    // Each worker is an independent PM2 process — a crashed worker
    // does NOT affect the API or other workers.

    /*
    {
      name: 'worker-email',
      script: 'ts-node',
      args: '--require dotenv/config src/workers/email.worker.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      out_file: './logs/worker-email.out.log',
      error_file: './logs/worker-email.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-telegram',
      script: 'ts-node',
      args: '--require dotenv/config src/workers/telegram.worker.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      out_file: './logs/worker-telegram.out.log',
      error_file: './logs/worker-telegram.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-invoice',
      script: 'ts-node',
      args: '--require dotenv/config src/workers/invoice.worker.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      out_file: './logs/worker-invoice.out.log',
      error_file: './logs/worker-invoice.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-subscription',
      script: 'ts-node',
      args: '--require dotenv/config src/workers/subscription-check.worker.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      out_file: './logs/worker-subscription.out.log',
      error_file: './logs/worker-subscription.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-payment-retry',
      script: 'ts-node',
      args: '--require dotenv/config src/workers/payment-retry.worker.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      out_file: './logs/worker-payment-retry.out.log',
      error_file: './logs/worker-payment-retry.err.log',
      merge_logs: true,
    },
    {
      name: 'worker-backup',
      script: 'ts-node',
      args: '--require dotenv/config src/workers/backup.worker.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      out_file: './logs/worker-backup.out.log',
      error_file: './logs/worker-backup.err.log',
      merge_logs: true,
    },
    {
      name: 'n8n',
      script: 'n8n',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        N8N_PORT: 5678,
      },
      max_memory_restart: '512M',
      out_file: './logs/n8n.out.log',
      error_file: './logs/n8n.err.log',
      merge_logs: true,
    },
    */
  ],
};
