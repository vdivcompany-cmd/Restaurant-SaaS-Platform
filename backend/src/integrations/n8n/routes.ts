import { Router, type Request, type Response } from 'express';
import { verifyN8nSignature } from './index.js';
import logger from '../../utils/logger.js';

const router = Router();

/**
 * POST /api/v1/integrations/n8n/webhook
 * Receives external workflow automation events from n8n.
 * Verifies signature before processing per Rule #5.
 */
router.post('/webhook', (req: Request, res: Response): void => {
  const signature = req.headers['x-n8n-signature'] as string;
  const webhookSecret = process.env['N8N_WEBHOOK_SECRET'] || 'default-n8n-secret-key-32chars-minimum';

  const rawBody = JSON.stringify(req.body);
  const isValid = verifyN8nSignature(signature, rawBody, webhookSecret);

  if (!isValid) {
    logger.warn({ signature }, 'Rejected unverified n8n webhook call');
    res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    return;
  }

  const { event, tenantId, data } = req.body;
  logger.info({ event, tenantId, data }, 'Successfully processed verified n8n webhook');

  res.status(200).json({ success: true, message: 'n8n webhook processed successfully', receivedAt: new Date().toISOString() });
});

export default router;
