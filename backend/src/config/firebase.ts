import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore as _getFirestore, type Firestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import type { ServiceAccount } from 'firebase-admin/app';
import env from './env.js';
import logger from '../utils/logger.js';

let app: App | null = null;

/**
 * Initializes the Firebase Admin SDK once.
 *
 * Supports two credential methods (checked in order):
 *   1. FIREBASE_SERVICE_ACCOUNT_BASE64 — base64-encoded JSON (preferred for VPS env vars)
 *   2. FIREBASE_SERVICE_ACCOUNT_PATH   — path to a service account JSON file (local dev)
 *
 * Do NOT commit the service account JSON to source control.
 * Use .gitignore or store it outside the repo root.
 *
 * Business logic must never import the firebase-admin SDK directly —
 * it must go through RealtimeService (Phase 2).
 */
export function initFirebase(): void {
  // Avoid re-initializing if already done (e.g. hot reload in dev)
  if (app || getApps().length > 0) {
    app = getApps()[0] ?? null;
    return;
  }

  let serviceAccount: ServiceAccount;

  if (env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(json) as ServiceAccount;
    logger.info('Firebase: using base64-encoded service account credentials');
  } else if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const raw = readFileSync(env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf-8');
    serviceAccount = JSON.parse(raw) as ServiceAccount;
    logger.info({ path: env.FIREBASE_SERVICE_ACCOUNT_PATH }, 'Firebase: using service account file');
  } else {
    throw new Error(
      'Firebase credentials not configured. ' +
        'Set FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_PATH in your .env file.',
    );
  }

  app = initializeApp({ credential: cert(serviceAccount) });
  logger.info('Firebase Admin SDK initialized');
}

/**
 * Returns the Firestore database instance.
 * Throws if initFirebase() has not been called first.
 */
export function getFirestore(): Firestore {
  if (!app) {
    throw new Error('Firebase has not been initialized. Call initFirebase() first.');
  }
  return _getFirestore(app);
}
