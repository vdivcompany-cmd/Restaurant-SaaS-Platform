import type { Request, Response } from 'express';
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/config/database.js';
import { getRedisClient } from '../src/config/redis.js';
import { initFirebase } from '../src/config/firebase.js';
import logger from '../src/utils/logger.js';

let appInstance: ReturnType<typeof createApp> | null = null;
let isInitialized = false;

async function bootstrapServerless(): Promise<ReturnType<typeof createApp>> {
  if (!isInitialized) {
    try {
      await connectDatabase();
      getRedisClient();
      try { initFirebase(); } catch (_fbErr) { /* ignore in serverless without credentials */ }
      isInitialized = true;
      logger.info('Vercel Serverless runtime MongoDB Atlas, Upstash Redis & Firebase initialized.');
    } catch (error) {
      logger.error({ error }, 'Error initializing database cloud connections inside Vercel Serverless runtime.');
    }
  }
  if (!appInstance) {
    appInstance = createApp();
  }
  return appInstance;
}

export default async function vercelHandler(req: Request, res: Response): Promise<void> {
  const app = await bootstrapServerless();
  app(req, res);
}
