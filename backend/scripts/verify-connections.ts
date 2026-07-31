/**
 * Phase 0 Deliverable: Connectivity Verification Script
 *
 * Run BEFORE writing any application code to confirm all four external
 * services are reachable from your local machine using env var config.
 *
 * Usage:
 *   npm run verify
 *
 * Expected output: four ✅ lines and "All connections OK".
 * If any service is unreachable, the error is printed and the process exits 1.
 *
 * Services verified:
 *   - MongoDB      (MONGODB_URI)
 *   - Redis        (Upstash REST — UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *   - RabbitMQ     (CloudAMQP — RABBITMQ_URL with amqps://)
 *   - Firebase     (Firestore write/delete — FIREBASE_SERVICE_ACCOUNT_PATH or BASE64)
 */

// dotenv is preloaded via tsx -r dotenv/config (see package.json verify script).
// DOTENV_CONFIG_PATH points to ../.env.local (repo root).
import mongoose from 'mongoose';
import dns from 'dns';
if (process.env['FORCE_PUBLIC_DNS'] === 'true') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
import { Redis } from '@upstash/redis';
import amqplib from 'amqplib';
import { initializeApp, deleteApp, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin/app';
import { readFileSync } from 'fs';

// Pull env directly — avoid importing compiled env.ts since this script
// may be run before the TS build.
const {
  MONGODB_URI,
  UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN,
  RABBITMQ_URL,
  FIREBASE_SERVICE_ACCOUNT_PATH,
  FIREBASE_SERVICE_ACCOUNT_BASE64,
} = process.env;

const errors: string[] = [];

// ─── Helper ───────────────────────────────────────────────────────────────────

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
    // SET and GET a test key to verify read/write access
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

// ─── RabbitMQ (CloudAMQP) ─────────────────────────────────────────────────────

async function checkRabbitMQ(): Promise<void> {
  if (!RABBITMQ_URL) { fail('RabbitMQ (CloudAMQP)', 'RABBITMQ_URL is not set'); return; }
  let conn: Awaited<ReturnType<typeof amqplib.connect>> | undefined;
  try {
    conn = await amqplib.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    await ch.close();
    pass('RabbitMQ (CloudAMQP)', 'connection + channel OK');
  } catch (err) {
    fail('RabbitMQ (CloudAMQP)', err);
  } finally {
    await conn?.close().catch(() => undefined);
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
    // Write then immediately delete a sentinel document to confirm read/write access
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

  // Run all checks in parallel for speed
  await Promise.all([checkMongo(), checkRedis(), checkRabbitMQ(), checkFirebase()]);

  console.log('');

  if (errors.length === 0) {
    console.log('✨  All connections OK — Phase 0 deliverable confirmed.\n');
    process.exit(0);
  } else {
    console.error(`💥  ${errors.length} service(s) failed: ${errors.join(', ')}`);
    console.error('    Fix the above errors before proceeding to Phase 1.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error in verify-connections:', err);
  process.exit(1);
});
