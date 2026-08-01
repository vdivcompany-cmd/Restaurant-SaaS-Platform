export interface QueueDefinition {
  name: string;
  exchange: string;
  routingKey: string;
  dlqName: string;
  dlxExchange: string;
  maxRetries: number;
  messageTtlSeconds: number;
}

export type PlatformQueueName =
  | 'EMAILS'
  | 'TELEGRAM'
  | 'INVOICES'
  | 'SUBSCRIPTION_CHECKS'
  | 'PAYMENT_RETRIES'
  | 'REPORTS'
  | 'BACKUPS'
  | 'FIRESTORE_RETRY'
  | 'TABLE_HISTORY_CLEANUP';

export const PLATFORM_QUEUES: Record<PlatformQueueName, QueueDefinition> = {
  EMAILS: {
    name: 'q.emails',
    exchange: 'ex.restaurant',
    routingKey: 'email.send',
    dlqName: 'q.emails.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 3,
    messageTtlSeconds: 86400,
  },
  TELEGRAM: {
    name: 'q.telegram',
    exchange: 'ex.restaurant',
    routingKey: 'telegram.send',
    dlqName: 'q.telegram.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 3,
    messageTtlSeconds: 86400,
  },
  INVOICES: {
    name: 'q.invoices',
    exchange: 'ex.restaurant',
    routingKey: 'invoice.generate',
    dlqName: 'q.invoices.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 5,
    messageTtlSeconds: 86400 * 7,
  },
  SUBSCRIPTION_CHECKS: {
    name: 'q.subscription-checks',
    exchange: 'ex.restaurant',
    routingKey: 'subscription.check',
    dlqName: 'q.subscription-checks.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 3,
    messageTtlSeconds: 86400,
  },
  PAYMENT_RETRIES: {
    name: 'q.payment-retries',
    exchange: 'ex.restaurant',
    routingKey: 'payment.retry',
    dlqName: 'q.payment-retries.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 3,
    messageTtlSeconds: 86400 * 3,
  },
  REPORTS: {
    name: 'q.reports',
    exchange: 'ex.restaurant',
    routingKey: 'report.build',
    dlqName: 'q.reports.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 2,
    messageTtlSeconds: 3600,
  },
  BACKUPS: {
    name: 'q.backups',
    exchange: 'ex.restaurant',
    routingKey: 'backup.run',
    dlqName: 'q.backups.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 2,
    messageTtlSeconds: 86400,
  },
  FIRESTORE_RETRY: {
    name: 'q.firestore-retry',
    exchange: 'ex.restaurant',
    routingKey: 'firestore.retry',
    dlqName: 'q.firestore-retry.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 5,
    messageTtlSeconds: 86400,
  },
  TABLE_HISTORY_CLEANUP: {
    name: 'q.table-history-cleanup',
    exchange: 'ex.restaurant',
    routingKey: 'table.history.cleanup',
    dlqName: 'q.table-history-cleanup.dlq',
    dlxExchange: 'ex.restaurant.dlx',
    maxRetries: 2,
    messageTtlSeconds: 86400,
  },
};
