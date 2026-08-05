import { Router } from 'express';
import {
  resolveSessionHandler,
  getByChannelHandler,
  closeSessionHandler,
} from './controller.js';

const router = Router();

// Public bootstrap endpoints — hit by bot webhooks and web chat frontends.
// Tokens are opaque and single-use; channel binding is the only trust anchor.
router.post('/resolve', resolveSessionHandler);
router.get('/by-channel', getByChannelHandler);
router.post('/close', closeSessionHandler);

export default router;
