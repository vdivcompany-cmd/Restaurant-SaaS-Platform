import { BillingRecordModel, type IBillingRecord } from './model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';

export class BillingRepository {
  public static async findAllByTenant(tenantId: string): Promise<IBillingRecord[]> {
    return tenantQuery.find(BillingRecordModel, tenantId, {}, undefined, { sort: { createdAt: -1 } });
  }

  public static async findById(tenantId: string, id: string): Promise<IBillingRecord | null> {
    return tenantQuery.findById(BillingRecordModel, tenantId, id);
  }

  public static async create(tenantId: string, data: Partial<IBillingRecord>): Promise<IBillingRecord> {
    return tenantQuery.create(BillingRecordModel, tenantId, data);
  }
}
