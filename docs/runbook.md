# Platform Disaster Recovery & Service Reliability Runbook

This document is the official operational runbook for disaster recovery, service failure mitigation, and infrastructure restoration for the Restaurant SaaS Platform.

---

## 1. Architecture Overview & Storage Tiering

The platform operates on Vercel Serverless coupled with cloud-managed stateful services:

| Infrastructure Service | Deployment Mode | Storage Purpose | Recovery Priority |
|---|---|---|---|
| **MongoDB** | MongoDB Atlas | Source of Truth (Tenants, Users, Orders, Menus, Billing) | P0 (Critical) |
| **Redis** | Upstash Redis (REST) | Sessions, Rate Limits, Locks, Idempotency | P1 (High) |
| **QStash** | Upstash QStash (HTTP) | Asynchronous Task Queues & Cron Schedules | P1 (High) |
| **Firestore** | Firebase Admin SDK | Real-time POS & Kitchen Display Projections | P2 (Medium) |

---

## 2. Disaster Recovery & Service Failure Manuals

### A. MongoDB Atlas Failure & Point-In-Time Restore (P0)

**Failure Mode:** Atlas database cluster unreachable, corrupt collection, or data loss incident.

**Impact:** `/ready` returns `503 Service Unavailable`. Core API mutations and queries fail.

**Mitigation & Recovery Steps:**
1. **Verify Connectivity:**
   ```bash
   curl -sf http://localhost:3000/ready | grep mongodb
   ```
2. **Access Atlas Control Panel:** Log in to MongoDB Atlas Cloud Portal → Database Deployments.
3. **Initiate Point-in-Time Restore (Continuous Backup):**
   - Click **...** next to Cluster0 → Select **Restore**.
   - Choose **Point-in-Time Restore** or select the latest automated snapshot.
   - Select target cluster or restore to a new cluster URI.
4. **Update App Configuration (if URI changed):**
   ```bash
   nano /var/www/restaurant-saas/backend/.env.production
   # Update MONGODB_URI=...
   ```
5. **Reload API Service:**
   ```bash
   pm2 reload api --update-env
   ```
6. **Verify API Health:**
   ```bash
   curl -sf http://localhost:3000/ready
   # Status must return 200 OK
   ```

---

### B. Upstash Redis Outage (P1)

**Failure Mode:** Upstash REST endpoint down or token expired.

**Impact:** Rate limiter falls back to in-memory store automatically (handled in `rateLimit.middleware.ts`). Distributed locks and session verification fail gracefully.

**Mitigation & Recovery Steps:**
1. **Verify Connectivity:**
   ```bash
   curl -sf http://localhost:3000/ready | grep redis
   ```
2. **Inspect Upstash Dashboard:** Check Upstash Console → Database Status & Daily Request Cap limits.
3. **Emergency Fallback / Token Renewal:**
   - If REST Token was compromised, rotate token in Upstash console.
   - Update `UPSTASH_REDIS_REST_TOKEN` in `.env`.
4. **Data Restoration Note:** Cache data (sessions, rate-limit counters) is ephemeral and auto-regenerated on cache miss. Zero permanent loss occurs.

---

### C. Upstash QStash Schedule & Destination Recovery (P2)

**Failure Mode:** Upstash QStash schedule token invalidation or deleted recurring schedules.

**Impact:** Background job enqueueing fails or recurring cron triggers stop firing.

**Mitigation & Recovery Steps:**
1. **Verify QStash Readiness Probe:**
   ```bash
   curl -sf http://localhost:3000/ready | grep qstash
   ```
2. **Re-register Recurring Schedules:**
   Run the QStash schedule setup script to re-create recurring cron triggers (daily backups, table history cleanup):
   ```bash
   cd backend && npm run setup:qstash-schedules
   ```
3. **Verify Job Endpoints:**
   QStash delivers jobs via HTTPS POST requests to Vercel job routes (`/api/v1/jobs/*`). Verify endpoint signature validation and secret tokens in environment variables (`QSTASH_CURRENT_SIGNING_KEY`).

---

### D. Firebase Firestore Outage & Projection Retry (P2)

**Failure Mode:** Firebase service outage or network disruption during Firestore projection write.

**Impact:** Primary MongoDB writes succeed uninterrupted (MongoDB-first Rule #3). `FirestoreRealtimeService.publishSafe()` catches the exception and enqueues a retry job.

**Mitigation & Recovery Steps:**
1. **Check Log Output:**
   Inspect Vercel serverless logs for "Firestore publish failed".
2. **Automatic Recovery:** Once Firebase service returns to normal, queued background jobs retry and update Firestore projections without manual intervention.
3. **Manual Projection Resync Drill (if needed):**
   If Firestore projections fall out of sync with MongoDB source of truth, run test verification:
   ```bash
   cd backend && npm run test
   ```

---

## 3. Restore & Verification Procedure

To verify health and readiness of the deployment:

1. **Validate Infrastructure Health Endpoint:**
   ```bash
   curl -sf http://localhost:3000/ready
   ```

Expected Response:
```json
{
  "status": "ok",
  "services": {
    "mongodb": { "status": "ok" },
    "redis": { "status": "ok" },
    "qstash": { "status": "ok" },
    "firebase": { "status": "ok" }
  },
  "timestamp": "2026-08-04T09:00:00.000Z"
}
```

---

## 4. Local QStash Development & QR Table Session Operations

### Local QStash Development
QStash publishes to a public destination URL, so local development requires either:
1. npx @upstash/qstash-cli dev (local emulator that runs jobs synchronously, no signing needed), or
2. A tunnel (ngrok http 3000) with PUBLIC_API_BASE_URL pointed at the tunnel URL for full signature-verified end-to-end testing against real Upstash QStash.

### QR Table Session Fraud Prevention
- Scan: GET /api/v1/tables/qr/:token validates signed QR JWT and opens a 90-minute Redis session (table_session:{tenantId}:{tableId}). Returns sessionId to client.
- Order: POST /api/v1/orders/qr validates tableSessionId before allowing customer order creation.
- Closure: Session automatically deleted on order payment (PAID) or cancellation (CANCELLED), or after 90 minutes TTL.
