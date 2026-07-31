/**
 * Paymob Payment Integration — Future Feature Stub
 *
 * NOTE: As per project rules and user instructions, Paymob is NOT currently active
 * in any billing or checkout routes. The platform exclusively uses Cash ('cash').
 * This module contains type definitions and HMAC verification helpers prepared
 * for future payment gateway activation.
 */

import crypto from 'crypto';

export interface PaymobAuthResponse {
  token: string;
  profile: {
    id: number;
    user: {
      email: string;
    };
  };
}

export interface PaymobOrderResponse {
  id: number;
  created_at: string;
  delivery_needed: boolean;
  amount_cents: number;
  currency: string;
}

export interface PaymobPaymentKeyResponse {
  token: string;
}

export interface PaymobWebhookPayload {
  obj: {
    id: number;
    pending: boolean;
    amount_cents: number;
    success: boolean;
    is_auth: boolean;
    is_capture: boolean;
    is_standalone_payment: boolean;
    is_voided: boolean;
    is_refunded: boolean;
    error_occured: boolean;
    refunded_amount_cents: number;
    captured_amount: number;
    updated_at: string;
    currency: string;
    order: {
      id: number;
      merchant_order_id: string;
    };
    created_at?: string;
    has_parent_transaction?: boolean;
    integration_id?: number | string;
    is_3d_secure?: boolean;
    source_data?: {
      pan?: string;
      sub_type?: string;
      type?: string;
    };
    owner: number;
    data: Record<string, unknown>;
  };
  type: string;
}

/**
 * Verify Paymob HMAC SHA-512 signature for incoming webhooks.
 * Mandatory verification step required by Rule #5 in PROJECT_RULES.md.
 */
export function verifyPaymobHMAC(queryHMAC: string, payload: PaymobWebhookPayload, hmacSecret: string): boolean {
  if (!queryHMAC || !hmacSecret) {
    return false;
  }

  const obj = payload.obj;
  const lexicalValues = [
    obj.amount_cents,
    obj.created_at || '',
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction || false,
    obj.id,
    obj.integration_id || '',
    obj.is_3d_secure || false,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order?.id,
    obj.owner,
    obj.pending,
    obj.source_data?.pan || '',
    obj.source_data?.sub_type || '',
    obj.source_data?.type || '',
    obj.success,
  ];

  const concatenated = lexicalValues.map((v) => (v === undefined || v === null ? '' : String(v))).join('');
  const calculatedHMAC = crypto.createHmac('sha512', hmacSecret).update(concatenated).digest('hex');

  const bufA = Buffer.from(queryHMAC);
  const bufB = Buffer.from(calculatedHMAC);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
