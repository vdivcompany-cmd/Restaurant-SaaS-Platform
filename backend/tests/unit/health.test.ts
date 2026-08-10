import { describe, it, expect } from 'vitest';
import { HealthService } from '../../src/health/health.service.js';

describe('HealthService Unit Tests', () => {
  it('should return ok for getLiveness', () => {
    const service = new HealthService();
    const liveness = service.getLiveness();
    expect(liveness.status).toBe('ok');
    expect(typeof liveness.timestamp).toBe('string');
    expect(new Date(liveness.timestamp).toISOString()).toBe(liveness.timestamp);
    expect(typeof liveness.uptimeSeconds).toBe('number');
    expect(liveness.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('should return a valid readiness result with all four services checked', async () => {
    const service = new HealthService();
    const result = await service.getReadiness();

    // Top-level shape
    expect(['ok', 'degraded']).toContain(result.status);
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptimeSeconds).toBe('number');

    // Each service must have a 'status' field of 'ok' or 'degraded'
    const requiredServices = ['mongodb', 'redis', 'qstash', 'firebase'];
    for (const svc of requiredServices) {
      const entry = result.services[svc];
      expect(entry, `services.${svc} must be defined`).toBeDefined();
      expect(['ok', 'degraded'], `services.${svc}.status must be valid`).toContain(entry!.status);
    }

    // Top-level status must be consistent: 'ok' only when all services are ok
    const allOk = Object.values(result.services).every((s) => s.status === 'ok');
    if (allOk) {
      expect(result.status).toBe('ok');
    } else {
      expect(result.status).toBe('degraded');
    }
  });

  it('should not expose any unexpected top-level keys in liveness response', () => {
    const service = new HealthService();
    const liveness = service.getLiveness();
    expect(Object.keys(liveness).sort()).toEqual(['status', 'timestamp', 'uptimeSeconds'].sort());
  });
});

