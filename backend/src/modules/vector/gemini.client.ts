import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * Google Gemini embedding client.
 * Model: text-embedding-004 (configured for 1024 dimensions to match Upstash index).
 */
export class GeminiEmbeddingClient {
  private aiInstance: any = null;

  private async getClient(): Promise<any> {
    if (!this.aiInstance) {
      if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
      }
      const { GoogleGenAI } = await import('@google/genai');
      this.aiInstance = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
    return this.aiInstance;
  }

  /**
   * Embed one or many strings. Returns vectors in the same order.
   * Specify inputType as 'passage' for indexing documents and 'query' for searching.
   */
  public async embed(
    inputs: string[],
    inputType: 'passage' | 'query' = 'passage'
  ): Promise<number[][]> {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    if (inputs.length === 0) return [];

    const client = await this.getClient();
    const taskType = inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';

    try {
      const results: number[][] = [];
      const CHUNK_SIZE = 10;

      for (let i = 0; i < inputs.length; i += CHUNK_SIZE) {
        const chunk = inputs.slice(i, i + CHUNK_SIZE);
        const chunkPromises = chunk.map(async (text) => {
          const res = await client.models.embedContent({
            model: env.GEMINI_EMBED_MODEL,
            contents: text,
            config: {
              outputDimensionality: 1024,
              taskType,
            },
          });
          const values = (res as any)?.embeddings?.[0]?.values ?? (res as any)?.embedding?.values;
          if (!values || !Array.isArray(values)) {
            throw new Error('Invalid embedding response from Gemini API');
          }
          return values;
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      }

      if (results.length !== inputs.length) {
        throw new Error(`Embedding count mismatch: got ${results.length}, expected ${inputs.length}`);
      }

      return results;
    } catch (err: any) {
      logger.error({ err: err?.message ?? err }, 'Gemini embedding failed');
      throw new Error('Failed to compute embeddings via Gemini API');
    }
  }

  public async embedOne(
    input: string,
    inputType: 'passage' | 'query' = 'passage'
  ): Promise<number[]> {
    const [vec] = await this.embed([input], inputType);
    if (!vec) throw new Error('Empty embedding response');
    return vec;
  }
}

export const geminiEmbeddingClient = new GeminiEmbeddingClient();
