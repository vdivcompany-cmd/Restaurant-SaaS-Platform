import { Index } from '@upstash/vector';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

let indexInstance: Index | null = null;
let missingEnvWarned = false;

/**
 * Single Upstash Vector index — tenants are isolated via namespace = tenantId.
 * Cheap, simple, keeps ops small.
 */
export function getVectorIndex(): Index {
  if (!indexInstance) {
    if (!env.UPSTASH_VECTOR_REST_URL || !env.UPSTASH_VECTOR_REST_TOKEN) {
      if (!missingEnvWarned) {
        logger.warn('UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN unset — vector sync calls will fail');
        missingEnvWarned = true;
      }
      throw new Error('UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN not configured');
    }
    indexInstance = new Index({
      url: env.UPSTASH_VECTOR_REST_URL,
      token: env.UPSTASH_VECTOR_REST_TOKEN,
    });
  }
  return indexInstance;
}

export function tenantNamespace(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export function productVectorId(productId: string): string {
  return `product:${productId}`;
}
