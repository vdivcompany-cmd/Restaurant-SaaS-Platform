import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';

describe('QR Redirect Logic Unit Tests', () => {
  const secret = 'super-secret-qr-token-secret-32-chars-long';

  it('should format Telegram bot redirect URL with start parameter', () => {
    const token = jwt.sign(
      { tenantId: 'tenant123', branchId: 'branch456', tableId: 'table789', number: 5 },
      secret
    );

    const redirectBase = 'https://t.me/MyBot';
    const resolved = {
      tenantId: 'tenant123',
      branchId: 'branch456',
      number: 5,
      sessionId: 'sess-uuid-111',
    };

    const startPayload = `t_${resolved.tenantId}_b_${resolved.branchId}_tbl_${resolved.number}_s_${resolved.sessionId}`;
    const finalUrl = `${redirectBase}?start=${startPayload}`;

    expect(finalUrl).toBe('https://t.me/MyBot?start=t_tenant123_b_branch456_tbl_5_s_sess-uuid-111');
  });

  it('should format web chatbot redirect URL with query parameters', () => {
    const redirectBase = 'https://myrestaurant.com/chat';
    const resolved = {
      tenantId: 'tenant123',
      branchId: 'branch456',
      number: 5,
      sessionId: 'sess-uuid-222',
    };

    const urlObj = new URL(redirectBase);
    urlObj.searchParams.set('tenantId', resolved.tenantId);
    urlObj.searchParams.set('branchId', resolved.branchId);
    urlObj.searchParams.set('tableNumber', String(resolved.number));
    urlObj.searchParams.set('sessionId', resolved.sessionId);

    expect(urlObj.toString()).toBe('https://myrestaurant.com/chat?tenantId=tenant123&branchId=branch456&tableNumber=5&sessionId=sess-uuid-222');
  });
});
