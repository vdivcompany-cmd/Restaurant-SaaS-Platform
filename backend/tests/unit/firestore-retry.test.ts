import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirestoreRealtimeService } from '../../src/services/realtime/firestore-realtime.service.js';

// vi.hoisted() creates variables that are available inside vi.mock() factories.
// This is the correct Vitest pattern for mocking modules that reference top-level state.
const { mockEnqueue, capturedMessages } = vi.hoisted(() => {
  const capturedMessages: Array<{ queueName: string; payload: unknown }> = [];
  const mockEnqueue = vi.fn(async (queueName: string, payload: unknown) => {
    capturedMessages.push({ queueName, payload });
    return true;
  });
  return { mockEnqueue, capturedMessages };
});

vi.mock('../../src/services/queue/index.js', () => ({
  queueService: { enqueue: mockEnqueue },
  PLATFORM_QUEUES: {
    FIRESTORE_RETRY: { name: 'q.firestore-retry' },
  },
}));

describe('Firestore Write-Failure Resilience (Rule #3)', () => {
  beforeEach(() => {
    capturedMessages.length = 0;
    mockEnqueue.mockClear();
  });

  it('should catch Firestore publish errors and enqueue retry job without throwing', async () => {
    const service = new FirestoreRealtimeService();

    // Simulate a Firestore network outage
    vi.spyOn(service, 'publish').mockRejectedValueOnce(new Error('Firestore connection timeout'));

    const path = 'restaurants/tenant_999/orders/ord_123';
    const data = { orderId: 'ord_123', status: 'COMPLETED' };
    const tenantId = 'tenant_999';

    // publishSafe must NOT propagate the exception to the caller
    await expect(service.publishSafe(path, data, tenantId)).resolves.toBeUndefined();

    // A retry job must have been enqueued to q.firestore-retry
    expect(mockEnqueue).toHaveBeenCalledOnce();
    expect(mockEnqueue).toHaveBeenCalledWith(
      'q.firestore-retry',
      expect.objectContaining({ path, data }),
      expect.objectContaining({ tenantId }),
    );
  });

  it('should succeed silently when Firestore publish succeeds (no retry enqueued)', async () => {
    const service = new FirestoreRealtimeService();

    // Simulate successful write
    vi.spyOn(service, 'publish').mockResolvedValueOnce();

    await expect(
      service.publishSafe('restaurants/t1/orders/o1', { status: 'PAID' }, 't1'),
    ).resolves.toBeUndefined();

    // No retry jobs enqueued on success
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});

