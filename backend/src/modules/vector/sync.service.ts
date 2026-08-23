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
   * Includes automated MongoDB text fallback if vector index is empty or unavailable.
   */
  public async searchProducts(
    tenantId: string,
    query: string,
    opts?: { topK?: number; menuId?: string }
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
    const topK = opts?.topK ?? 5;
    try {
      const vector = await geminiEmbeddingClient.embedOne(query, 'query');
      const results = await getVectorIndex().query(
        {
          vector,
          topK,
          includeMetadata: true,
          ...(opts?.menuId ? { filter: `menuId = '${opts.menuId}'` } : {}),
        },
        { namespace: tenantNamespace(tenantId) }
      );
      if (results && results.length > 0) {
        return results.map((r) => {
          const rawId = String(r.id);
          const cleanProductId = (r.metadata?.productId as string) || rawId.replace(/^product:/i, '');
          return {
            id: cleanProductId,
            productId: cleanProductId,
            score: r.score,
            metadata: (r.metadata ?? {}) as Record<string, unknown>,
          };
        });
      }
    } catch (vectorErr) {
      logger.warn({ err: vectorErr, tenantId, query }, 'Vector search error, falling back to database search');
    }

    // Database text search fallback from MongoDB MenuModel
    const menu =
      (await MenuModel.findOne({ tenantId, isActive: true }).exec()) ||
      (await MenuModel.findOne({ tenantId }).exec());
    if (!menu || !menu.products || menu.products.length === 0) {
      return [];
    }

    const lowerQuery = query.toLowerCase().trim();
    const queryTokens = lowerQuery.split(/\s+/).filter(Boolean);

    const matches = menu.products
      .filter((p) => p.isAvailable !== false)
      .map((p) => {
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const cat = (p.categoryName || '').toLowerCase();

        let score = 0;
        if (name === lowerQuery) score += 1.0;
        else if (name.includes(lowerQuery)) score += 0.8;
        else {
          for (const token of queryTokens) {
            if (name.includes(token)) score += 0.4;
            if (desc.includes(token)) score += 0.2;
            if (cat.includes(token)) score += 0.1;
          }
        }
        return { product: p, score };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return matches.map(({ product: p, score }) => {
      const cleanId = p._id.toString();
      return {
        id: cleanId,
        productId: cleanId,
        score,
        metadata: buildProductMetadata(tenantId, p, menu._id.toString()),
      };
    });
  }
}

export const vectorSyncService = new VectorSyncService();
