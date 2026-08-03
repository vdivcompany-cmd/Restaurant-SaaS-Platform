import mongoose from 'mongoose';
import { getApps } from 'firebase-admin/app';
import { getRedisClient } from '../config/redis.js';
import { getQStashClient } from '../config/qstash.js';
import logger from '../utils/logger.js';

export interface ServiceHealth {
  status: 'ok' | 'degraded';
  latencyMs?: number;
  error?: string;
}

export interface HealthResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeSeconds: number;
  services: Record<string, ServiceHealth>;
}

export class HealthService {
  /**
   * Quick liveness check.
   */
  public getLiveness(): { status: 'ok'; timestamp: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  /**
   * Comprehensive readiness check verifying connectivity to MongoDB, Redis, QStash, and Firebase.
   */
  public async getReadiness(): Promise<HealthResult> {
    const services: Record<string, ServiceHealth> = {};

    // 1. MongoDB Check
    try {
      const mongoState = mongoose.connection.readyState;
      if (mongoState === 1) {
        services['mongodb'] = { status: 'ok' };
      } else {
        services['mongodb'] = { status: 'degraded', error: `MongoDB readyState is ${mongoState}` };
      }
    } catch (err: any) {
      services['mongodb'] = { status: 'degraded', error: err?.message || 'MongoDB check failed' };
    }

    // 2. Upstash Redis Check
    try {
      const redisStart = Date.now();
      const client = getRedisClient();
      await client.ping();
      services['redis'] = { status: 'ok', latencyMs: Date.now() - redisStart };
    } catch (err: any) {
      services['redis'] = { status: 'degraded', error: err?.message || 'Redis ping failed' };
    }

    // 3. QStash Check (replaces RabbitMQ check)
    try {
      const qstashStart = Date.now();
      const client = getQStashClient();
      await client.schedules.list();
      services['qstash'] = { status: 'ok', latencyMs: Date.now() - qstashStart };
    } catch (err: any) {
      services['qstash'] = { status: 'degraded', error: err?.message || 'QStash check failed' };
    }

    // 4. Firebase Admin SDK Check
    try {
      const apps = getApps();
      if (apps.length > 0) {
        services['firebase'] = { status: 'ok' };
      } else {
        services['firebase'] = { status: 'degraded', error: 'Firebase Admin SDK not initialized' };
      }
    } catch (err: any) {
      services['firebase'] = { status: 'degraded', error: err?.message || 'Firebase check failed' };
    }

    const isAllOk = Object.values(services).every((s) => s.status === 'ok');

    const result: HealthResult = {
      status: isAllOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      services,
    };

    if (!isAllOk) {
      logger.warn({ services }, 'Health readiness check reported degraded services');
    }

    return result;
  }
}

export const healthService = new HealthService();
