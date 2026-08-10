import type { Request, Response, NextFunction } from 'express';
import { TableService } from './service.js';
import { createTableSchema, updateTableSchema } from './validation.js';

const service = new TableService();

export async function createTableHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createTableSchema.parse(req.body);
    const tbl = await service.createTable(tenantId, validated);
    res.status(201).json({ success: true, data: tbl });
  } catch (err) {
    next(err);
  }
}

export async function listTablesHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const branchId = typeof req.query['branchId'] === 'string' ? req.query['branchId'] : undefined;
    const tables = await service.listTables(tenantId, branchId);
    res.status(200).json({ success: true, data: tables });
  } catch (err) {
    next(err);
  }
}

export async function getTableHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const tableId = String(req.params['id'] ?? '');
    const tbl = await service.getTable(tenantId, tableId);
    res.status(200).json({ success: true, data: tbl });
  } catch (err) {
    next(err);
  }
}

export async function resolveQrTableHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = String(req.params['token'] ?? '');
    const tbl = await service.resolveByQrToken(token);
    res.status(200).json({ success: true, data: tbl });
  } catch (err) {
    next(err);
  }
}

export async function scanQrTableHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = String(req.params['token'] ?? '');
    const { redirectUrl, resolvedData } = await service.handleScanRedirect(token);

    if (redirectUrl) {
      res.redirect(302, redirectUrl);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'QR code resolved. Configure qrRedirectUrl in tenant profile to redirect customers automatically.',
      data: resolvedData,
    });
  } catch (err) {
    next(err);
  }
}

export async function getQrImageHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const tableId = String(req.params['id'] ?? '');
    const imageBuffer = await service.generateQrImagePng(tenantId, tableId);
    res.setHeader('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (err) {
    next(err);
  }
}

export async function updateTableHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const tableId = String(req.params['id'] ?? '');
    const validated = updateTableSchema.parse(req.body);
    const tbl = await service.updateTable(tenantId, tableId, validated);
    res.status(200).json({ success: true, data: tbl });
  } catch (err) {
    next(err);
  }
}

export async function deleteTableHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const tableId = String(req.params['id'] ?? '');
    await service.deleteTable(tenantId, tableId);
    res.status(200).json({ success: true, message: 'Table deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getTableOrderHistoryHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const tableId = String(req.params['id'] ?? '');
    const limit = typeof req.query['limit'] === 'string' ? parseInt(req.query['limit'], 10) : 50;
    const channel = typeof req.query['channel'] === 'string' ? req.query['channel'] : undefined;

    if (!req.user) {
      if (channel !== 'DINE_IN') {
        res.status(401).json({ success: false, message: 'Authentication token required for non-dine-in order history' });
        return;
      }
    } else {
      const allowedRoles = ['owner', 'manager', 'cashier'];
      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({ success: false, message: 'Forbidden: Insufficient role permissions' });
        return;
      }
    }

    const orders = await service.getOrderHistory(tenantId, tableId, {
      limit,
      ...(channel ? { channel } : {}),
    });
    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

