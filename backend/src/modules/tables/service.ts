import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import { TableRepository } from './repository.js';
import { TableModel, type ITable } from './model.js';
import { BranchModel } from '../branches/model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import type { CreateTableDto, UpdateTableDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export class TableService {
  private repo = new TableRepository();

  public async createTable(tenantId: string, dto: CreateTableDto): Promise<ITable> {
    // Create table first to get its ID
    const tempToken = `temp_${crypto.randomBytes(8).toString('hex')}`;
    let table = await this.repo.create(tenantId, { ...dto, qrCodeToken: tempToken });

    // Sign JWT with table identity
    const qrCodeToken = jwt.sign(
      {
        tenantId,
        branchId: dto.branchId,
        tableId: table._id.toString(),
        number: dto.number,
      },
      env.QR_TOKEN_SECRET
    );

    // Update with signed token
    table = await this.repo.update(tenantId, table._id.toString(), { qrCodeToken } as any) || table;

    // Increment branch table count
    await tenantQuery.updateOne(
      BranchModel,
      tenantId,
      { _id: dto.branchId },
      { $inc: { tableCount: 1 } }
    ).exec();

    return table;
  }

  public async listTables(tenantId: string, branchId?: string): Promise<ITable[]> {
    return await this.repo.findAll(tenantId, branchId);
  }

  public async getTable(tenantId: string, tableId: string): Promise<ITable> {
    const tbl = await this.repo.findById(tenantId, tableId);
    if (!tbl) throw new AppError('Table not found or out of scope', 404);
    return tbl;
  }

  public async resolveByQrToken(token: string): Promise<ITable & { tenantId: string; branchId: string }> {
    let payload: any;
    try {
      payload = jwt.verify(token, env.QR_TOKEN_SECRET);
    } catch {
      throw new AppError('Invalid QR code token', 404);
    }

    const { tenantId, branchId, tableId } = payload;
    if (!tenantId || !branchId || !tableId) {
      throw new AppError('Invalid QR code token', 404);
    }

    // Tenant-scoped lookup to prevent cross-tenant probing
    const table = await tenantQuery.findOne(TableModel, tenantId, {
      _id: tableId,
      branchId,
    });

    if (!table) {
      throw new AppError('Invalid QR code token', 404);
    }

    return {
      ...table.toObject(),
      tenantId,
      branchId,
    };
  }

  public async updateTable(tenantId: string, tableId: string, dto: UpdateTableDto): Promise<ITable> {
    const tbl = await this.repo.update(tenantId, tableId, dto);
    if (!tbl) throw new AppError('Table not found or out of scope', 404);
    return tbl;
  }

  public async deleteTable(tenantId: string, tableId: string): Promise<void> {
    const table = await this.repo.findById(tenantId, tableId);
    if (!table) throw new AppError('Table not found or out of scope', 404);

    const success = await this.repo.delete(tenantId, tableId);
    if (!success) throw new AppError('Table deletion failed', 500);

    // Decrement branch table count (guard against negative)
    await tenantQuery.updateOne(
      BranchModel,
      tenantId,
      { _id: table.branchId },
      { $inc: { tableCount: -1 } }
    ).exec();
  }

  public async getOrderHistory(
    tenantId: string,
    tableId: string,
    opts?: { limit?: number; sinceDate?: Date; channel?: string | undefined }
  ): Promise<any[]> {
    // Verify table exists and belongs to tenant
    const table = await this.repo.findById(tenantId, tableId);
    if (!table) throw new AppError('Table not found or out of scope', 404);

    // Import OrderModel dynamically to avoid circular dependencies
    const { OrderModel } = await import('../orders/model.js');

    const query: Record<string, unknown> = { tableId, tenantId };
    if (opts?.sinceDate) {
      query.createdAt = { $gte: opts.sinceDate };
    }
    if (opts?.channel) {
      query.channel = opts.channel;
    }

    return await tenantQuery
      .find(OrderModel, tenantId, query)
      .sort({ createdAt: -1 })
      .limit(opts?.limit ?? 50)
      .exec();
  }
}

