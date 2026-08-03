import { Receiver } from '@upstash/qstash';
import type { Request, Response, NextFunction } from 'express';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

/**
 * Verifies the Upstash-Signature header on incoming QStash job callbacks.
 * Mandatory on every /api/v1/jobs/* route — mirrors Rule #5 (webhook signature
 * verification) already applied to Paymob.
 * Requires the raw request body — mount express.raw() ahead of express.json()
 * for this route prefix (see app.ts).
 */
export async function qstashVerifyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['upstash-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(401).json({ success: false, message: 'Missing QStash signature' });
      return;
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      res.status(500).json({ success: false, message: 'Raw body not captured for signature verification' });
      return;
    }

    const isValid = await receiver.verify({
      signature,
      body: rawBody.toString(),
    });

    if (!isValid) {
      logger.warn({ url: req.originalUrl }, 'QStash signature verification failed — rejecting');
      res.status(401).json({ success: false, message: 'Invalid QStash signature' });
      return;
    }

    // Body was raw; parse it now that signature is verified
    req.body = JSON.parse(rawBody.toString() || '{}');
    next();
  } catch (err) {
    logger.error({ err }, 'QStash signature verification error');
    res.status(401).json({ success: false, message: 'Signature verification failed' });
  }
}
