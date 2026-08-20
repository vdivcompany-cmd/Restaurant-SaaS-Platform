import type { IProductSubDoc } from '../menu/model.js';
import { MenuModel } from '../menu/model.js';
import { geminiEmbeddingClient } from './gemini.client.js';
import { getVectorIndex, tenantNamespace, productVectorId } from './upstash.client.js';
import { buildProductEmbeddingText, buildProductMetadata } from './embedding.service.js';
import logger from '../../utils/logger.js';

export class VectorSyncService {
  /**
   * Upsert a single product into the tenant's namespace.
   * Called from the vector-sync worker after a product create/update.
   */
  public async upsertProduct(tenantId: string, product: IProductSubDoc, menuId?: string): Promise<void> {
    const vector = await geminiEmbeddingClient.embedOne(buildProductEmbeddingText(product));
    await getVectorIndex().upsert(
      {
        id: productVectorId(product._id.toString()),
        vector,
        metadata: buildProductMetadata(tenantId, product, menuId),
      },
      { namespace: tenantNamespace(tenantId) }
    );
    logger.info({ tenantId, productId: product._id.toString(), menuId }, 'Vector upserted');
  }

  public async deleteProduct(tenantId: string, productId: string): Promise<void> {
    await getVectorIndex().delete([productVectorId(productId)], {
      namespace: tenantNamespace(tenantId),
    });
    logger.info({ tenantId, productId }, 'Vector deleted');
  }

  /**
   * Wipe and rebuild a tenant's entire vector namespace from Mongo.
   * Used for bulk-import replace-mode and for recovery.
   */
  public async rebuildTenant(tenantId: string): Promise<{ upserted: number }> {
    const index = getVectorIndex();
    const namespace = tenantNamespace(tenantId);

    // Wipe first — fresh state.
    await index.reset({ namespace });

    const menu = await MenuModel.findOne({ tenantId }).exec();
    if (!menu || menu.products.length === 0) {
      return { upserted: 0 };
    }

    const products = menu.products;
    const menuId = menu._id.toString();
    const texts = products.map((p) => buildProductEmbeddingText(p));
    const vectors = await geminiEmbeddingClient.embed(texts);

    const payload = products.map((p, i) => {
      const vec = vectors[i];
      if (!vec) throw new Error(`Missing embedding for product ${p._id.toString()}`);
      return {
        id: productVectorId(p._id.toString()),
        vector: vec,
        metadata: buildProductMetadata(tenantId, p, menuId),
      };
    });

    // Upstash supports batch upsert — send in chunks of 100 to stay safe.
    const CHUNK = 100;
    for (let i = 0; i < payload.length; i += CHUNK) {
      await index.upsert(payload.slice(i, i + CHUNK), { namespace });
    }

    logger.info({ tenantId, upserted: payload.length }, 'Tenant vector namespace rebuilt');
    return { upserted: payload.length };
  }

  /**
   * Semantic search inside a tenant's namespace — used by the chatbot.
   */
  public async searchProducts(
    tenantId: string,
    query: string,
    opts?: { topK?: number; menuId?: string }
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
    const vector = await geminiEmbeddingClient.embedOne(query, 'query');
    const results = await getVectorIndex().query(
      {
        vector,
        topK: opts?.topK ?? 5,
        includeMetadata: true,
        ...(opts?.menuId ? { filter: `menuId = '${opts.menuId}'` } : {}),
      },
      { namespace: tenantNamespace(tenantId) }
    );
    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
    }));
  }
}

export const vectorSyncService = new VectorSyncService();
