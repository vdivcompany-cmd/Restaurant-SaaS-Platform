import logger from '../utils/logger.js';
import { MenuModel } from '../modules/menu/model.js';
import { vectorSyncService } from '../modules/vector/sync.service.js';

export type VectorSyncOp = 'upsert-product' | 'delete-product' | 'rebuild-tenant';

export interface VectorSyncJobPayload {
  op: VectorSyncOp;
  tenantId: string;
  productId?: string;
}

export async function processVectorSyncJob(payload: VectorSyncJobPayload): Promise<void> {
  const { op, tenantId, productId } = payload;
  logger.info({ op, tenantId, productId }, 'Processing vector sync job');

  switch (op) {
    case 'upsert-product': {
      if (!productId) throw new Error('productId required for upsert-product');
      const menu = await MenuModel.findOne({ tenantId }).exec();
      const product = menu?.products.id(productId);
      if (!product) {
        // Product was deleted between enqueue and processing — treat as delete.
        await vectorSyncService.deleteProduct(tenantId, productId);
        return;
      }
      await vectorSyncService.upsertProduct(tenantId, product, menu?._id.toString());
      return;
    }

    case 'delete-product': {
      if (!productId) throw new Error('productId required for delete-product');
      await vectorSyncService.deleteProduct(tenantId, productId);
      return;
    }

    case 'rebuild-tenant': {
      await vectorSyncService.rebuildTenant(tenantId);
      return;
    }

    default: {
      const _exhaustive: never = op;
      throw new Error(`Unknown vector sync op: ${_exhaustive}`);
    }
  }
}
