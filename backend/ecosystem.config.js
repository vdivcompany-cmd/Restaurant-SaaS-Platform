module.exports = {
  apps: [
    {
      name: 'api',
      script: './dist/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'worker-email',
      script: './dist/workers/email.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/worker-email-error.log',
      out_file: './logs/worker-email-out.log',
    },
    {
      name: 'worker-telegram',
      script: './dist/workers/telegram.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/worker-telegram-error.log',
      out_file: './logs/worker-telegram-out.log',
    },
    {
      name: 'worker-invoice',
      script: './dist/workers/invoice.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/worker-invoice-error.log',
      out_file: './logs/worker-invoice-out.log',
    },
    {
      name: 'worker-subscription',
      script: './dist/workers/subscription-check.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/worker-subscription-error.log',
      out_file: './logs/worker-subscription-out.log',
    },
    {
      name: 'worker-payment-retry',
      script: './dist/workers/payment-retry.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/worker-payment-retry-error.log',
      out_file: './logs/worker-payment-retry-out.log',
    },
    {
      name: 'worker-backup',
      script: './dist/workers/backup.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/worker-backup-error.log',
      out_file: './logs/worker-backup-out.log',
    },
    {
      name: 'worker-table-history-cleanup',
      script: './dist/workers/table-history-cleanup.worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/worker-table-history-cleanup-error.log',
      out_file: './logs/worker-table-history-cleanup-out.log',
    },
  ],
};
