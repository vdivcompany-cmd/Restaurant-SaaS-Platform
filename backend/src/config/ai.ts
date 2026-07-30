import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import env from './env.js';
import logger from '../utils/logger.js';

/**
 * AI Stack configuration.
 *
 * Provides shared LangChain-compatible instances for:
 *   - Chat model (GPT-4o-mini by default — cost-efficient, fast)
 *   - Embeddings model (text-embedding-3-small)
 *
 * These are used by the AI agent layer (src/ai/).
 * If OPENAI_API_KEY is not set, a warning is logged and the instances
 * will fail at call time — this allows the server to start without
 * AI features configured (e.g. during early Phase 0/1 development).
 */

if (!env.OPENAI_API_KEY) {
  logger.warn('OPENAI_API_KEY is not set — AI features will be unavailable');
}

export const chatModel = new ChatOpenAI({
  apiKey: env.OPENAI_API_KEY || 'not-configured',
  model: 'gpt-4o-mini',
  temperature: 0.2,
});

export const embeddingsModel = new OpenAIEmbeddings({
  apiKey: env.OPENAI_API_KEY || 'not-configured',
  model: 'text-embedding-3-small',
});

logger.debug('AI config loaded (chat: gpt-4o-mini, embeddings: text-embedding-3-small)');
