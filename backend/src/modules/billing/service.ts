import { BillingRepository } from './repository.js';
import type { IBillingRecord } from './model.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';
import type { CreateBillingRecordInput } from './validation.js';

export class BillingService {
  /**
   * Fetch all billing records for a tenant (most recent first).
   */
  public static async getRecords(tenantId: string): Promise<IBillingRecord[]> {
    return BillingRepository.findAllByTenant(tenantId);
  }

  /**
   * Get a specific billing record by ID, scoped to the tenant.
   */
  public static async getRecordById(tenantId: string, id: string): Promise<IBillingRecord> {
    const record = await BillingRepository.findById(tenantId, id);
    if (!record) {
      throw new AppError('Billing record not found', 404);
    }
    return record;
  }

  /**
   * Create a billing record (manually or via webhook/payment integration).
   */
  public static async createRecord(
    tenantId: string,
    data: CreateBillingRecordInput
  ): Promise<IBillingRecord> {
    return BillingRepository.create(tenantId, data);
  }
}
