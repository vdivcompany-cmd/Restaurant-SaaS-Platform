import axios, { AxiosInstance } from 'axios';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * NVIDIA NIM embedding client — OpenAI-compatible /embeddings endpoint.
 * Model: nvidia/nv-embedqa-e5-v5 (free tier, outputs 1024 dimensions for Upstash compatibility).
 */
export class NemotronClient {
  private http: AxiosInstance;

  constructor() {
    if (!env.NEMOTRON_API_KEY) {
      logger.warn('NEMOTRON_API_KEY unset — vector embedding calls will fail until configured');
    }
    this.http = axios.create({
      baseURL: env.NEMOTRON_BASE_URL,
      timeout: 30_000,
      headers: {
        Authorization: `Bearer ${env.NEMOTRON_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Embed one or many strings. Returns vectors in the same order.
   * For QA/retrieval models like nv-embedqa-e5-v5, specify inputType as 'passage' for indexing and 'query' for search.
   */
  public async embed(inputs: string[], inputType: 'passage' | 'query' = 'passage'): Promise<number[][]> {
    if (!env.NEMOTRON_API_KEY) {
      throw new Error('NEMOTRON_API_KEY is not configured');
    }
    if (inputs.length === 0) return [];

    try {
      const { data } = await this.http.post('/embeddings', {
        model: env.NEMOTRON_EMBED_MODEL,
        input: inputs,
        input_type: inputType, // NIM-specific: 'passage' for indexing documents, 'query' for searching
      });
      const vectors = (data?.data ?? []).map((row: any) => row.embedding as number[]);
      if (vectors.length !== inputs.length) {
        throw new Error(`Embedding count mismatch: got ${vectors.length}, expected ${inputs.length}`);
      }
      return vectors;
    } catch (err: any) {
      logger.error({ err: err?.response?.data ?? err?.message }, 'Nemotron embedding failed');
      throw new Error('Failed to compute embeddings');
    }
  }

  public async embedOne(input: string, inputType: 'passage' | 'query' = 'passage'): Promise<number[]> {
    const [vec] = await this.embed([input], inputType);
    if (!vec) throw new Error('Empty embedding response');
    return vec;
  }
}

export const nemotronClient = new NemotronClient();
