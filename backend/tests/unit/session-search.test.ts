import { describe, it, expect } from 'vitest';
import { sessionSearchSchema } from '../../src/modules/vector/validation.js';

describe('sessionSearchSchema validation', () => {
  it('accepts sessionId without tenantId', () => {
    const parsed = sessionSearchSchema.safeParse({
      sessionId: 'sess_123',
      query: 'جامايكا',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts tenantId without sessionId', () => {
    const parsed = sessionSearchSchema.safeParse({
      tenantId: '6a85e588d0b508058fc5008c',
      query: 'جامايكا',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts both sessionId and tenantId', () => {
    const parsed = sessionSearchSchema.safeParse({
      sessionId: 'sess_123',
      tenantId: '6a85e588d0b508058fc5008c',
      query: 'جامايكا',
      topK: 5,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects if both sessionId and tenantId are missing', () => {
    const parsed = sessionSearchSchema.safeParse({
      query: 'جامايكا',
    });
    expect(parsed.success).toBe(false);
  });
});
