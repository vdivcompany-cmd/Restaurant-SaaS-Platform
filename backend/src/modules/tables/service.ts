import crypto from 'node:crypto';
import { TableRepository } from './repository.js';
import type { ITable } from './model.js';
import type { CreateTableDto, UpdateTableDto } from './validation.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

export class TableService {
  private repo = new TableRepository();

  public async createTable(tenantId: string, dto: CreateTableDto): Promise<ITable> {
    const qrCodeToken = `qr_${tenantId.substring(0, 6)}_${dto.branchId.substring(0, 6)}_${dto.number}_${crypto.randomBytes(4).toString('hex')}`;
    return await this.repo.create(tenantId, { ...dto, qrCodeToken });
  }

  public async listTables(tenantId: string, branchId?: string): Promise<ITable[]> {
    return await this.repo.findAll(tenantId, branchId);
  }

  public async getTable(tenantId: string, tableId: string): Promise<ITable> {
    const tbl = await this.repo.findById(tenantId, tableId);
    if (!tbl) throw new AppError('Table not found or out of scope', 404);
    return tbl;
  }

  public async resolveByQrToken(token: string): Promise<ITable> {
    const tbl = await this.repo.findByQrToken(token);
    if (!tbl) throw new AppError('Invalid QR code token', 404);
    return tbl;
  }

  public async updateTable(tenantId: string, tableId: string, dto: UpdateTableDto): Promise<ITable> {
    const tbl = await this.repo.update(tenantId, tableId, dto);
    if (!tbl) throw new AppError('Table not found or out of scope', 404);
    return tbl;
  }

  public async deleteTable(tenantId: string, tableId: string): Promise<void> {
    const success = await this.repo.delete(tenantId, tableId);
    if (!success) throw new AppError('Table not found or out of scope', 404);
  }
}
