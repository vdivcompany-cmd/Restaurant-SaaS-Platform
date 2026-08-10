/**
 * Phase 0 Deliverable: Connectivity Verification Script
 * Updated in Phase 10: RabbitMQ replaced with Upstash QStash
 *
 * Usage:
 *   npm run verify
 *
 * Services verified:
 *   - MongoDB      (MONGODB_URI)
 *   - Redis        (Upstash REST — UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *   - QStash       (Upstash QStash — QSTASH_TOKEN)
 *   - Firebase     (Firestore write/delete — FIREBASE_SERVICE_ACCOUNT_PATH or BASE64)
 */

import '../src/config/loadEnv.js';
import mongoose from 'mongoose';
import dns from 'dns';
if (process.env['FORCE_PUBLIC_DNS'] === 'true') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
import { Redis } from '@upstash/redis';
import { Client as QStashClient } from '@upstash/qstash';
import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin/app';
import { readFileSync } from 'fs';

const {
  MONGODB_URI,
  UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN,
  QSTASH_TOKEN,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_SERVICE_ACCOUNT_BASE64,
} = process.env;

const errors: string[] = [];

function pass(service: string, detail = ''): void {
  console.log(`  ✅  ${service}${detail ? ` — ${detail}` : ''}`);
}

function fail(service: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`  ❌  ${service} — ${message}`);
  errors.push(service);
}

// ─── MongoDB ──────────────────────────────────────────────────────────────────

async function checkMongo(): Promise<void> {
  if (!MONGODB_URI) { fail('MongoDB', 'MONGODB_URI is not set'); return; }
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    const adminDb = mongoose.connection.db?.admin();
    const result = await adminDb?.ping() as { ok?: number } | undefined;
    if (result?.ok === 1) {
      pass('MongoDB', 'ping OK');
    } else {
      fail('MongoDB', 'ping returned unexpected result');
    }
  } catch (err) {
    fail('MongoDB', err);
  } finally {
    await mongoose.connection.close().catch(() => undefined);
  }
}

// ─── Redis (Upstash REST) ─────────────────────────────────────────────────────

async function checkRedis(): Promise<void> {
  if (!UPSTASH_REDIS_REST_URL) { fail('Redis (Upstash)', 'UPSTASH_REDIS_REST_URL is not set'); return; }
  if (!UPSTASH_REDIS_REST_TOKEN) { fail('Redis (Upstash)', 'UPSTASH_REDIS_REST_TOKEN is not set'); return; }
  try {
    const redis = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });
    await redis.set('__verify_ping__', 'pong', { ex: 10 });
    const value = await redis.get('__verify_ping__');
    await redis.del('__verify_ping__');
    if (value === 'pong') {
      pass('Redis (Upstash)', 'SET → GET → DEL OK');
    } else {
      fail('Redis (Upstash)', `unexpected GET value: ${String(value)}`);
    }
  } catch (err) {
    fail('Redis (Upstash)', err);
  }
}

// ─── QStash (Upstash) ─────────────────────────────────────────────────────────

async function checkQStash(): Promise<void> {
  if (!QSTASH_TOKEN) { fail('QStash (Upstash)', 'QSTASH_TOKEN is not set'); return; }
  try {
    const qstash = new QStashClient({ token: QSTASH_TOKEN });
    await qstash.schedules.list();
    pass('QStash (Upstash)', 'API authenticated OK');
  } catch (err) {
    fail('QStash (Upstash)', err);
  }
}

// ─── Firebase ─────────────────────────────────────────────────────────────────

async function checkFirebase(): Promise<void> {
  let serviceAccount: ServiceAccount | undefined;

  if (FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const json = Buffer.from(FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(json) as ServiceAccount;
    } catch (err) {
      fail('Firebase', `could not parse base64 credentials: ${err instanceof Error ? err.message : err}`);
      return;
    }
  } else if (FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const raw = readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf-8');
      serviceAccount = JSON.parse(raw) as ServiceAccount;
    } catch (err) {
      fail('Firebase', `could not read credentials file at "${FIREBASE_SERVICE_ACCOUNT_PATH}": ${err instanceof Error ? err.message : err}`);
      return;
    }
  } else {
    fail('Firebase', 'no credentials — set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_BASE64');
    return;
  }

  const appName = `verify-${Date.now()}`;
  let app: App | undefined;
  try {
    app = initializeApp({ credential: cert(serviceAccount) }, appName);
    const db = getFirestore(app);
    const ref = db.collection('_verify').doc('connectivity-check');
    await ref.set({ ts: Date.now() });
    await ref.delete();
    pass('Firebase', 'Firestore read/write OK');
  } catch (err) {
    fail('Firebase', err);
  } finally {
    await app?.delete().catch(() => undefined);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🔍  Verifying service connections...\n');
  await Promise.all([checkMongo(), checkRedis(), checkQStash(), checkFirebase()]);
  console.log('');

  if (errors.length === 0) {
    console.log('✨  All connections OK — deliverables confirmed.\n');
    process.exit(0);
  } else {
    console.error(`💥  ${errors.length} service(s) failed: ${errors.join(', ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error in verify-connections:', err);
  process.exit(1);
});
