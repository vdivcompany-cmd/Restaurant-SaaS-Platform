# Restaurant SaaS Platform — Project Overview

Multi-tenant restaurant management SaaS for the Egyptian market. Deployed on a single
Hostinger VPS as the final step, using PM2 (not Docker) in production. Redis, RabbitMQ, and
Firebase Firestore are included from day one, not deferred.

This file is the shared reference for every phase file. Read this first before starting any
phase.

---

## 1. Full Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js (via `nvm`) | — |
| Framework | Express.js | — |
| Language | TypeScript | — |
| ODM | Mongoose | — |
| Database | MongoDB, single instance to start | Replica set once failover/Change-Streams matter |
| Multi-tenancy | `tenantId` on every document + tenant/RBAC middleware | Non-negotiable at any scale |
| Auth | JWT + refresh tokens + RBAC | — |
| Cache | `CacheService` interface → **Redis** implementation | Sessions, rate limiting, locks, idempotency, cached lookups |
| Background jobs | `QueueService` interface → **Upstash QStash** implementation | Serverless push-based queue via Vercel job routes (`/api/v1/jobs/*`) |
| Realtime | `RealtimeService` interface → **Firebase Firestore** implementation | Projection layer only — MongoDB stays source of truth |
| Deployment | **Vercel Serverless** | Automated git deploys (Root Directory = `backend/`; `backend/vercel.json` is authoritative, root `vercel.json` must not exist) |
| Automation | **n8n / External Workers** — customer workflows & AI menu file OCR parsing | Independent processes, talks to backend API endpoints only |
| Payments | Paymob | Webhook signature verification from day one |
| File storage | Cloudinary | Product photos, branding logos, and PDF menu documents (only URLs stored in DB) |
| Backups | `mongodump` cron → off-server storage | Plus Redis AOF, RabbitMQ definitions export |
| Monitoring | `/health`, `/ready`, `/live` + PM2 monit + external uptime checker | Redis, RabbitMQ queue depth, MongoDB, Firebase write failures |
| AI Stack | Decoupled Vision LLMs + Upstash Vector / MongoDB Vector Search | Automated PDF menu bulk ingestion, multi-tenant RAG, and conversational table assistants |

**Interface layer principle:** business logic (`modules/orders`, `modules/subscriptions`,
etc.) only ever calls `cacheService.get()`, `queueService.enqueue()`,
`realtimeService.publish()` — never `redis.get()`, `amqp.publish()`, or the Firestore SDK
directly. This keeps the codebase testable and keeps any one implementation swappable without
touching business logic.

---

## 2. Project Structure

```text
restaurant-saas/
│
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   │
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   ├── rabbitmq.ts
│   │   │   ├── firebase.ts
│   │   │   └── ai.ts
│   │   │
│   │   ├── ai/
│   │   │   ├── agents/
│   │   │   ├── prompts/
│   │   │   ├── tools/
│   │   │   └── vectorstore/
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── tenants/
│   │   │   ├── subscriptions/
│   │   │   ├── billing/
│   │   │   ├── restaurants/
│   │   │   ├── branches/
│   │   │   ├── menu/                 ← single source of truth for all menu data
│   │   │   │   ├── parsers/          ← csv, pdf, docx, image parsers
│   │   │   │   ├── model.ts          ← MenuModel + sourceDocuments audit trail
│   │   │   │   ├── upload-status.model.ts
│   │   │   │   ├── vision.client.ts  ← NIM vision/chat for OCR extraction
│   │   │   │   └── (controller, upload.controller, service, repository, routes, validation)
│   │   │   ├── categories/
│   │   │   ├── variants/
│   │   │   ├── coupons/
│   │   │   ├── orders/
│   │   │   ├── tables/
│   │   │   ├── employees/
│   │   │   ├── customers/
│   │   │   ├── feedback/
│   │   │   ├── reports/
│   │   │   └── notifications/
│   │   │       └── (each: controller.ts, service.ts, routes.ts, model.ts,
│   │   │            validation.ts, tests/)
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── tenant.middleware.ts
│   │   │   ├── rbac.middleware.ts
│   │   │   ├── subscription-guard.middleware.ts
│   │   │   ├── rateLimit.middleware.ts
│   │   │   ├── errorHandler.middleware.ts
│   │   │   └── requestLogger.middleware.ts
│   │   │
│   │   ├── services/
│   │   │   ├── cache/
│   │   │   │   ├── cache.interface.ts
│   │   │   │   ├── redis-cache.service.ts
│   │   │   │   └── memory-cache.service.ts      # unit tests only
│   │   │   ├── queue/
│   │   │   │   ├── queue.interface.ts
│   │   │   │   ├── rabbitmq-queue.service.ts
│   │   │   │   └── queue-definitions.ts
│   │   │   └── realtime/
│   │   │       ├── realtime.interface.ts
│   │   │       └── firestore-realtime.service.ts
│   │   │
│   │   ├── workers/
│   │   │   ├── email.worker.ts
│   │   │   ├── telegram.worker.ts
│   │   │   ├── invoice.worker.ts
│   │   │   ├── subscription-check.worker.ts
│   │   │   ├── payment-retry.worker.ts
│   │   │   └── backup.worker.ts
│   │   │
│   │   ├── integrations/
│   │   │   ├── paymob/
│   │   │   ├── cloudinary/
│   │   │   └── n8n/
│   │   │
│   │   ├── shared/
│   │   │   ├── constants/
│   │   │   ├── types/
│   │   │   └── dtos/
│   │   │
│   │   └── utils/
│   │       ├── logger.ts
│   │       ├── pagination.ts
│   │       └── idempotency.ts
│   │
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   │
│   ├── scripts/
│   │   ├── backup.sh
│   │   ├── restore-drill.sh
│   │   └── deploy.sh
│   │
│   ├── ecosystem.config.js
│   ├── .env.production
│   ├── package.json
│   └── tsconfig.json
│
├── nginx/
│   └── sites-available/
│       ├── api.conf
│       └── n8n.conf
│
├── infra/
│   ├── redis/redis.conf
│   ├── rabbitmq/definitions.json
│   └── mongodb/replica-set-init.js
│
└── docs/
    ├── architecture.md
    └── runbook.md
```

**PM2 process layout (`ecosystem.config.js`):**
```text
1. api
2. worker-email
3. worker-telegram
4. worker-invoice
5. worker-subscription-check
6. worker-payment-retry
7. worker-backup
8. n8n
```

---

## 3. Restaurant "Room" Data Model

Every restaurant is a **tenant**. Not a separate database — a `tenantId` that scopes every
document across every collection. Each restaurant only ever sees documents tagged with its own
`tenantId`, enforced at the middleware level.

```text
tenants
  _id, name, slug, status (active|suspended|trial)
  subscriptionPlan, subscriptionExpiresAt
  contact { phone, email }
  settings { currency, timezone, language: 'ar'|'en' }
  createdAt

users                       # tenantId ⟵ scoping key
  role (owner|manager|cashier|kitchen), email/phone, passwordHash

branches                    # tenantId ⟵ scoping key
  name, address, isActive

menu / categories / products / variants   # tenantId ⟵ scoping key
  branchId (optional)

orders                      # tenantId ⟵ scoping key
  branchId, items[], status, channel (telegram|web|qr|dine-in), createdAt

customers                   # tenantId ⟵ scoping key
  phone, name, orderHistory[]

feedback                    # tenantId ⟵ scoping key
  customerId, orderId, rating, comment, createdAt

employees, tables, reports, notifications, audit-logs   # tenantId ⟵ scoping key (all)
# Note: reports are aggregated at the restaurant (tenant) level.
```

### Enforcement rules (apply in every phase, not just Phase 1)
1. `tenant.middleware.ts` resolves `tenantId` from JWT (dashboard) or bot/channel context
   (Telegram), attaches it to `req.tenantId`.
2. Every Mongoose query goes through a helper that auto-injects `{ tenantId: req.tenantId }`.
   No raw `Model.find({...})` without it, anywhere. One missed filter is a real data leak
   between restaurants.
3. Compound indexes start with `tenantId` on every collection.
4. `tenantId` propagates beyond MongoDB: RabbitMQ payloads, Firestore paths
   (`restaurants/{tenantId}/orders/...`), n8n webhook payloads, logs, audit entries.
5. Tests deliberately attempt cross-tenant access with a valid JWT from a different tenant and
   assert rejection.

---

## 4. Phase Index

| File | Covers |
|---|---|
| `phase-0-local-environment.md` | Local dev setup — Node, MongoDB, Redis, RabbitMQ, Firebase |
| `phase-1-tenant-auth-foundation.md` | Tenant middleware, RBAC, auth, isolation tests |
| `phase-2-service-interfaces.md` | CacheService/Redis, QueueService/RabbitMQ, RealtimeService/Firestore |
| `phase-3-core-domain-modules.md` | Restaurants, menu, orders, tables, customers |
| `phase-4-integrations-workers.md` | Paymob, Cloudinary, background workers, n8n |
| `phase-5-pm2-nginx-deploy.md` | **Superseded by Phase 10** — Vercel deployment replaces PM2/Nginx VPS staging |
| `phase-6-backups-reliability.md` | Backups, health checks, failure handling, restore drills |
| `phase-7-hostinger-golive.md` | Vercel production deployment |
| `phase-8-scale-adjustments.md` | Cluster mode, replica set, worker scaling — event-driven |
| `phase-9-rbac-fix-reservation-qrjwt.md` | RBAC fixes, body-based tenant context, reservations, QR JWT baseline |
| `phase-10-qstash-qr-session-pm2-removal.md` | QStash serverless queue migration, QR session fraud prevention, PM2 removal |

Each phase file has: goal, prerequisites, steps, and a deliverable that should be true before
moving to the next phase.
