export interface QueueDefinition {
  name: string;
  jobRoute: string;
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
  | 'TABLE_HISTORY_CLEANUP'
  | 'VECTOR_SYNC'
  | 'MENU_INGESTION';

export const PLATFORM_QUEUES: Record<PlatformQueueName, QueueDefinition> = {
  EMAILS: {
    name: 'q.emails',
    jobRoute: 'emails',
    maxRetries: 3,
    messageTtlSeconds: 86400,
  },
  TELEGRAM: {
    name: 'q.telegram',
    jobRoute: 'telegram',
    maxRetries: 3,
    messageTtlSeconds: 86400,
  },
  INVOICES: {
    name: 'q.invoices',
    jobRoute: 'invoices',
    maxRetries: 5,
    messageTtlSeconds: 86400 * 7,
  },
  SUBSCRIPTION_CHECKS: {
    name: 'q.subscription-checks',
    jobRoute: 'subscription-checks',
    maxRetries: 3,
    messageTtlSeconds: 86400,
  },
  PAYMENT_RETRIES: {
    name: 'q.payment-retries',
    jobRoute: 'payment-retries',
    maxRetries: 3,
    messageTtlSeconds: 86400 * 3,
  },
  REPORTS: {
    name: 'q.reports',
    jobRoute: 'reports',
    maxRetries: 2,
    messageTtlSeconds: 3600,
  },
  BACKUPS: {
    name: 'q.backups',
    jobRoute: 'backups',
    maxRetries: 2,
    messageTtlSeconds: 86400,
  },
  FIRESTORE_RETRY: {
    name: 'q.firestore-retry',
    jobRoute: 'firestore-retry',
    maxRetries: 5,
    messageTtlSeconds: 86400,
  },
  TABLE_HISTORY_CLEANUP: {
    name: 'q.table-history-cleanup',
    jobRoute: 'table-history-cleanup',
    maxRetries: 2,
    messageTtlSeconds: 86400,
  },
  VECTOR_SYNC: {
    name: 'q.vector-sync',
    jobRoute: 'vector-sync',
    maxRetries: 5,
    messageTtlSeconds: 86400,
  },
  MENU_INGESTION: {
    name: 'q.menu-ingestion',
    jobRoute: 'menu-ingestion',
    maxRetries: 2,
    messageTtlSeconds: 86400,
  },
};
