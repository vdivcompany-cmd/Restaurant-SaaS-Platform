import { env } from './env';
import { ChatOpenAI } from '@langchain/openai';
import { Index } from '@upstash/vector';

// Initialize the Upstash Vector Database client
export const vectorDb = new Index({
    url: env.UPSTASH_VECTOR_REST_URL,
    token: env.UPSTASH_VECTOR_REST_TOKEN,
});

// Initialize the default LLM (OpenAI)
export const llm = new ChatOpenAI({
    openAIApiKey: env.OPENAI_API_KEY,
    modelName: 'gpt-4o-mini', // Configurable
    temperature: 0,
});
