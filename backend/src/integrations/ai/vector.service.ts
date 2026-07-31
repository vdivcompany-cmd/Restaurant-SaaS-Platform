import { Index } from '@upstash/vector';
import logger from '../../utils/logger.js';
import { AppError } from '../../middleware/errorHandler.middleware.js';

/**
 * Interface representing a textual slice from an uploaded restaurant menu document.
 */
export interface MenuKnowledgeChunk {
  id: string;
  text: string;
  dishName?: string;
  category?: string;
  price?: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
}

export class RagVectorService {
  private client: Index | null = null;
  private isConfigured = false;

  constructor() {
    const url = process.env['UPSTASH_VECTOR_REST_URL'];
    const token = process.env['UPSTASH_VECTOR_REST_TOKEN'];

    if (url && token && url !== 'https://example-vector.upstash.io') {
      try {
        this.client = new Index({ url, token });
        this.isConfigured = true;
        logger.info('Upstash Vector REST client initialized for LLM RAG agent');
      } catch (err) {
        logger.warn({ err }, 'Failed to initialize Upstash Vector index client');
      }
    } else {
      logger.warn('UPSTASH_VECTOR_REST_URL or TOKEN unconfigured — running in local mock simulation mode');
    }
  }

  /**
   * Ingests and indexes restaurant menu knowledge chunks into Upstash Vector database.
   * Every chunk is securely tagged with the restaurant's tenantId in metadata.
   */
  public async upsertMenuKnowledge(tenantId: string, chunks: MenuKnowledgeChunk[]): Promise<number> {
    if (!chunks || chunks.length === 0) return 0;

    if (!this.isConfigured || !this.client) {
      logger.info({ tenantId, count: chunks.length }, '[SIMULATED RAG INGESTION] Menu knowledge vector embedding complete (Mock)');
      return chunks.length;
    }

    try {
      const records = chunks.map((chunk) => ({
        id: `${tenantId}_${chunk.id}`,
        data: chunk.text, // Upstash Vector auto-embeds text if an embedding model is configured on the index
        metadata: {
          tenantId,
          text: chunk.text,
          dishName: chunk.dishName || 'Unspecified Item',
          category: chunk.category || 'Menu Section',
          price: chunk.price ?? null,
        },
      }));

      await this.client.upsert(records);
      logger.info({ tenantId, count: chunks.length }, 'Successfully ingested menu knowledge chunks into Upstash Vector DB');
      return chunks.length;
    } catch (error) {
      logger.error({ tenantId, error }, 'Error ingesting menu chunks into Upstash Vector index');
      throw new AppError('Failed to synchronize restaurant menu with AI RAG knowledge base', 502);
    }
  }

  /**
   * Performs semantic vector retrieval for customer/staff AI RAG questions.
   * Strictly filters by tenantId so zero cross-restaurant catalog leakage occurs.
   */
  public async searchMenuKnowledge(tenantId: string, queryText: string, topK = 4): Promise<VectorSearchResult[]> {
    if (!this.isConfigured || !this.client) {
      logger.info({ tenantId, queryText }, '[SIMULATED RAG SEARCH] Returning fallback mock menu vector context');
      return [
        {
          id: `${tenantId}_mock_1`,
          score: 0.95,
          text: 'Mock Retrieved Item: Margherita Pizza - $12.50. Fresh mozzarella, tomato sauce, basil.',
          metadata: { tenantId, price: 12.5 },
        },
      ];
    }

    try {
      const results = await this.client.query({
        data: queryText,
        topK,
        includeMetadata: true,
        filter: `tenantId = '${tenantId}'`, // Immutable Row-Level Tenant Isolation
      });

      return results.map((item) => ({
        id: String(item.id),
        score: item.score || 0,
        text: String(item.metadata?.['text'] || ''),
        metadata: item.metadata || {},
      }));
    } catch (error) {
      logger.error({ tenantId, queryText, error }, 'Error searching Upstash Vector index during RAG query');
      return [];
    }
  }
}

export const ragVectorService = new RagVectorService();
