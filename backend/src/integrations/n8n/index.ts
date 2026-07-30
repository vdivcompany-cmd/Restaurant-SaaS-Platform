import crypto from 'crypto';
import axios from 'axios';
import logger from '../../utils/logger.js';

export interface N8nEventPayload {
  event: string;
  tenantId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Verifies HMAC SHA-256 signature for incoming n8n webhooks.
 * Enforces PROJECT_RULES.md Rule #5: Webhooks must verify signatures before processing.
 */
export function verifyN8nSignature(signature: string, payload: string, secret: string): boolean {
  if (!signature || !secret || !payload) {
    return false;
  }

  try {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const bufA = Buffer.from(signature);
    const bufB = Buffer.from(expectedSignature);

    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  } catch (error) {
    logger.error({ error }, 'Failed to verify n8n webhook signature');
    return false;
  }
}

/**
 * Dispatches an outbound event payload to an n8n workflow endpoint.
 */
export async function dispatchN8nWebhook(webhookUrl: string, payload: N8nEventPayload, secret?: string): Promise<boolean> {
  try {
    const jsonBody = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      const signature = crypto.createHmac('sha256', secret).update(jsonBody).digest('hex');
      headers['X-N8N-Signature'] = signature;
    }

    const response = await axios.post(webhookUrl, jsonBody, { headers, timeout: 10000 });
    logger.info({ webhookUrl, status: response.status, event: payload.event }, 'Dispatched event to n8n successfully');
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    logger.error({ webhookUrl, error }, 'Error dispatching event to n8n webhook');
    return false;
  }
}
