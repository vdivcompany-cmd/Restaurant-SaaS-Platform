import { Router } from 'express';
import {
  resolveSessionHandler,
  getByChannelHandler,
  closeSessionHandler,
} from './controller.js';
import { sessionSearchHandler } from '../vector/controller.js';

const router = Router();

// Public bootstrap endpoints — hit by bot webhooks and web chat frontends.
// Tokens are opaque and single-use; channel binding is the only trust anchor.
router.post('/resolve', resolveSessionHandler);
router.get('/by-channel', getByChannelHandler);
router.post('/close', closeSessionHandler);

// Session-scoped semantic search over the tenant's menu (public, tenant
// derived from sessionId). This is the endpoint chatbots hit for RAG.
router.post('/search', sessionSearchHandler);

export default router;
