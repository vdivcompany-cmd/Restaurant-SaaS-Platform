import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import { TableRepository } from './repository.js';
import { TableModel, type ITable } from './model.js';
import { BranchModel } from '../branches/model.js';
import { tenantQuery } from '../../utils/tenantQuery.js';
import { cacheService } from '../../services/cache/index.js';
import type { CreateTableDto, UpdateTableDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

const SESSION_TTL_SECONDS = 90 * 60; // 90 minutes

export class TableService {
  private repo = new TableRepository();

  public async createTable(tenantId: string, dto: CreateTableDto): Promise<ITable> {
    let targetBranchId = dto.branchId;

    if (!targetBranchId) {
      const branches = await tenantQuery.find(BranchModel, tenantId, {}).exec();
      if (!branches || branches.length === 0) {
        throw new AppError('No branches found for this restaurant. Please create a branch first.', 400);
      }
      if (branches.length === 1 && branches[0]) {
        targetBranchId = branches[0]._id.toString();
      } else {
        throw new AppError('Multiple branches found for this restaurant. branchId is required.', 400);
      }
    }

    const finalBranchId = targetBranchId;
    const tablePayload = { ...dto, branchId: finalBranchId };

    // Create table first to get its ID
    const tempToken = `temp_${crypto.randomBytes(8).toString('hex')}`;
    let table = await this.repo.create(tenantId, { ...tablePayload, qrCodeToken: tempToken });

    // Sign JWT with table identity
    const qrCodeToken = jwt.sign(
      {
        tenantId,
        branchId: finalBranchId,
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
      { _id: finalBranchId },
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

  public async resolveByQrToken(token: string): Promise<ITable & { tenantId: string; branchId: string; sessionId: string }> {
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

    const sessionKey = `table_session:${tenantId}:${tableId}`;

    // One active session per table: if session open and table is OCCUPIED, reuse existing
    const existingSession = await cacheService.get<{ sessionId: string }>(sessionKey);
    if (existingSession && table.status === 'OCCUPIED') {
      return {
        ...table.toObject(),
        tenantId,
        branchId,
        sessionId: existingSession.sessionId,
      };
    }

    const sessionId = crypto.randomUUID();
    await cacheService.set(
      sessionKey,
      { sessionId, tenantId, branchId, startedAt: Date.now() },
      SESSION_TTL_SECONDS
    );

    return {
      ...table.toObject(),
      tenantId,
      branchId,
      sessionId,
    };
  }

  /**
   * Validates that a table session is currently open and matches the caller's claimed session.
   * Throws 403 if expired or invalid.
   */
  public async validateTableSession(tenantId: string, tableId: string, sessionId: string | undefined): Promise<void> {
    if (!sessionId) {
      throw new AppError('A table session is required to place this order — please scan the QR code again', 403);
    }
    const sessionKey = `table_session:${tenantId}:${tableId}`;
    const session = await cacheService.get<{ sessionId: string; tenantId: string }>(sessionKey);
    if (!session || session.sessionId !== sessionId || session.tenantId !== tenantId) {
      throw new AppError('Table session expired or invalid — please rescan the QR code', 403);
    }
  }

  /**
   * Closes a table session (on payment/cancellation, or explicit checkout).
   */
  public async closeTableSession(tenantId: string, tableId: string): Promise<void> {
    await cacheService.del(`table_session:${tenantId}:${tableId}`);
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
    opts?: { limit?: number; sinceDate?: Date }
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

    return await tenantQuery
      .find(OrderModel, tenantId, query)
      .sort({ createdAt: -1 })
      .limit(opts?.limit ?? 50)
      .exec();
  }
}
