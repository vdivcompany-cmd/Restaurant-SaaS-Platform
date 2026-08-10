import logger from '../utils/logger.js';

export interface PaymentRetryJobPayload {
  tenantId: string;
  invoiceId: string;
  attemptNumber: number;
}

export async function processPaymentRetryJob(payload: PaymentRetryJobPayload, headers?: Record<string, unknown>): Promise<void> {
  const tenantId = (headers?.['x-tenant-id'] as string) || payload.tenantId;
  logger.info({ tenantId, invoiceId: payload.invoiceId, attemptNumber: payload.attemptNumber }, 'Processing payment retry job');

  // Payment retry processing
}
