# Platform Disaster Recovery & Service Reliability Runbook

This document is the official operational runbook for disaster recovery, service failure mitigation, and infrastructure restoration for the Restaurant SaaS Platform.

---

## 1. Architecture Overview & Storage Tiering

The platform operates on a single Hostinger VPS running Node.js via PM2 and Nginx reverse proxy, coupled with cloud-managed stateful services:

| Infrastructure Service | Deployment Mode | Storage Purpose | Recovery Priority |
|---|---|---|---|
| **MongoDB** | MongoDB Atlas | Source of Truth (Tenants, Users, Orders, Menus, Billing) | P0 (Critical) |
| **Redis** | Upstash Redis (REST) | Sessions, Rate Limits, Locks, Idempotency | P1 (High) |
| **RabbitMQ** | CloudAMQP (amqps://) | Asynchronous Task Queues & DLQ Telemetry | P1 (High) |
| **Firestore** | Firebase Admin SDK | Real-time POS & Kitchen Display Projections | P2 (Medium) |
| **PM2 / App Config** | Local VPS | App Process Definitions & Environment File | P0 (Critical) |

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
   - Update `UPSTASH_REDIS_REST_TOKEN` in `.env.production`.
   - Reload process environment: `pm2 reload ecosystem.config.js --update-env`.
4. **Data Restoration Note:** Cache data (sessions, rate-limit counters) is ephemeral and auto-regenerated on cache miss. Zero permanent loss occurs.

---

### C. RabbitMQ Topology Loss & Re-creation (P1)

**Failure Mode:** CloudAMQP instance failure, queue deletion, or fresh VPS deployment without exchange definitions.

**Impact:** Background job enqueueing fails or consumer processes disconnect (`q.*` missing).

**Mitigation & Recovery Steps:**
1. **Verify RabbitMQ Readiness:**
   ```bash
   curl -sf http://localhost:3000/ready | grep rabbitmq
   ```
2. **Import Committed Topology Definitions:**
   Using `rabbitmqadmin` CLI tool against the new or reset RabbitMQ instance:
   ```bash
   rabbitmqadmin -H <amqp-host> -u <user> -p <password> import infra/rabbitmq/definitions.json
   ```
3. **Alternative Assertion via Code:**
   The backend queue service auto-asserts all exchanges (`ex.restaurant`, `ex.restaurant.dlx`) and queues on process startup. Restarting worker processes triggers full topology recreation automatically:
   ```bash
   pm2 restart ecosystem.config.js
   ```
   Active queue consumers:
   | Process | Queue |
   |---|---|
   | `worker-email` | `q.emails` |
   | `worker-telegram` | `q.telegram` |
   | `worker-invoice` | `q.invoices` |
   | `worker-subscription` | `q.subscription-checks` |
   | `worker-payment-retry` | `q.payment-retries` |
   | `worker-backup` | `q.backups` |
   | `worker-firestore-retry` | `q.firestore-retry` |

---

### D. Firebase Firestore Outage & Projection Retry (P2)

**Failure Mode:** Firebase service outage or network disruption during Firestore projection write.

**Impact:** Primary MongoDB writes succeed uninterrupted (MongoDB-first Rule #3). `FirestoreRealtimeService.publishSafe()` catches the exception and enqueues a retry message to `q.firestore-retry`.

**Mitigation & Recovery Steps:**
1. **Check Log Output:**
   ```bash
   pm2 logs api | grep "Firestore publish failed"
   ```
2. **Automatic Recovery:** Once Firebase service returns to normal, the background consumer processes messages from `q.firestore-retry` and updates Firestore projections without manual intervention.
3. **Manual Projection Resync Drill (if needed):**
   If Firestore projections fall out of sync with MongoDB source of truth, run the resync script:
   ```bash
   cd /var/www/restaurant-saas/backend
   npm run verify
   ```

---

## 3. Full Restore Drill Verification Procedure

To test restoring the application on a fresh VPS from a Phase 5 / Phase 6 backup archive:

1. **Locate Latest Archive:**
   ```bash
   ls -la /var/backups/restaurant-saas/
   ```
2. **Run Restore Verification Drill:**
   ```bash
   cd /var/www/restaurant-saas/backend
   bash scripts/restore-drill.sh
   ```
   Output must confirm clean extraction of `.env.backup`, `ecosystem.config.js`, `nginx/`, and `infra/` files.

3. **Validate Infrastructure Health Endpoint:**
   ```bash
   curl -sf http://localhost:3000/ready
   ```

Expected Response:
```json
{
  "status": "ok",
  "timestamp": "2026-07-31T11:15:00.000Z",
  "uptimeSeconds": 1420,
  "services": {
    "mongodb": { "status": "ok" },
    "redis": { "status": "ok" },
    "rabbitmq": { "status": "ok" },
    "firebase": { "status": "ok" }
  }
}
```
