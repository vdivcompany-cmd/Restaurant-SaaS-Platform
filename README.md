# Restaurant SaaS Platform

Multi-tenant restaurant management SaaS for the Egyptian market.

---

## Progress Log

### ✅ Phase 0 — Local Environment — Completed 2026-07-29
**What was implemented:**
- Scaffolded Node.js/TypeScript Express project structure (`backend/src/`).
- Configured environment schema validation ([backend/src/config/env.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/config/env.ts)).
- Created connectivity verification script ([backend/scripts/verify-connections.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/scripts/verify-connections.ts)).
- Verified connectivity to MongoDB, Redis (Upstash), RabbitMQ (CloudAMQP), and Firebase Firestore.

**Deliverable achieved:**
- All four external infrastructure connections verified and reachable via environment variables.

**Notes / deviations from the plan:**
- Using Upstash Redis REST and CloudAMQP managed cloud instances for dev environment.
- Retained `backend/src/ai` and LangChain / Upstash Vector stack as an intentional feature across all phases.

**Next phase:** Phase 1 — Tenant & Auth Foundation
- Tenant middleware, RBAC, auth, and cross-tenant isolation tests.

---

### ✅ Phase 1 — Tenant & Auth Foundation — Completed 2026-07-30
**What was implemented:**
- Mandatory Mongoose query helper ([src/utils/tenantQuery.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/utils/tenantQuery.ts)) enforcing `{ tenantId: req.tenantId }` scope across all database operations.
- Tenants data model, Zod validation, service, controller, and routes ([src/modules/tenants/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/modules/tenants/)).
- Users data model with `tenantId` indexed as field #1, Auth service, JWT access tokens + refresh token rotation, bcrypt password hashing, and auth controller/routes ([src/modules/auth/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/modules/auth/)).
- Authentication middleware ([src/middleware/auth.middleware.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/middleware/auth.middleware.ts)), Tenant resolution middleware ([src/middleware/tenant.middleware.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/middleware/tenant.middleware.ts)), RBAC middleware ([src/middleware/rbac.middleware.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/middleware/rbac.middleware.ts)), and global error handler ([src/middleware/errorHandler.middleware.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/middleware/errorHandler.middleware.ts)).
- Subscriptions and Billing model skeletons ([src/modules/subscriptions/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/modules/subscriptions/), [src/modules/billing/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/modules/billing/)).
- Automated unit test for tenantQuery helper and integration tests for Auth, Tenants, and Users (`users.test.ts`), including mandatory cross-tenant isolation verification ([backend/tests/](file:///d:/Restaurant%20SaaS%20Platform/backend/tests/)).
- Enforced startup 32-char min length on JWT secrets ([src/config/env.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/config/env.ts)) and database verification on header tenant fallbacks ([src/middleware/tenant.middleware.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/middleware/tenant.middleware.ts)).
- Documented single-session-per-user refresh rotation behavior ([src/modules/auth/service.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/modules/auth/service.ts)).
- Updated API route documentation ([docs/API_ROUTES.md](file:///d:/Restaurant%20SaaS%20Platform/docs/API_ROUTES.md)).
- Introduced platform super administrator hierarchy (`super_admin`), locking restaurant provisioning (`POST /api/v1/tenants`) behind `requireSuperAdmin` RBAC checks.
- Implemented CLI seeder command (`npm run seed:admin` / [scripts/seed-superadmin.ts](file:///c:/Users/Mohand/Documents/GitHub/Restaurant-SaaS-Platform/backend/scripts/seed-superadmin.ts)) for automated setup of the initial Platform Operations tenant and ecosystem admin credentials.
- Enabled multi-tenant supervisory support mode allowing authenticated `super_admin` accounts to inspect specific tenant environments via `X-Target-Tenant-Id` headers without isolation rejection.
- Created typed in-process Domain Event Bus ([src/shared/events/index.ts](file:///c:/Users/Mohand/Documents/GitHub/Restaurant-SaaS-Platform/backend/src/shared/events/index.ts)) to enable asynchronous cross-module decoupling without dependency loops.
- Formalized enterprise scaling architecture rules in documentation: Brand vs. Storefront (`tenantId` + `branchId`) compound indexing, asynchronous event bus decoupling, and POS Offline-Sync batch recovery strategies (excluding Inventory module per requirement).

**Deliverable achieved:**
- Multi-tenant backend foundation with authentication and cross-tenant isolation verified mechanically via automated Vitest suite. Neither tenant A nor tenant B can read or modify each other's data through any endpoint. 16 / 16 integration tests passing.

**Notes / deviations from the plan:**
- Vitest configured for sequential file execution (`fileParallelism: false`) to ensure clean DB cleanup isolation during integration test runs.
- `subscriptions` and `billing` test suites are intentionally scheduled for Phase 4 (`phase-4-integrations-workers.md`) when full domain business logic and payment webhooks are implemented.

**Next phase:** Phase 2 — Service Interfaces
- Standardize CacheService (Redis), QueueService (RabbitMQ), and RealtimeService (Firestore) interfaces for abstract business logic integration.

---

### ✅ Phase 2 — Service Interfaces — Completed 2026-07-30
**What was implemented:**
- Extended `ICacheService` interface and Upstash Redis / in-memory implementations with distributed concurrency locking (`acquireLock`, `releaseLock`) and numeric counters (`incr`, `expire`) ([src/services/cache/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/services/cache/)).
- Refactored payment/webhook idempotency middleware ([src/utils/idempotency.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/utils/idempotency.ts)) to utilize `cacheService` abstraction instead of direct Redis SDK calls.
- Implemented `CacheRateLimitStore` inside rate limiting middleware ([src/middleware/rateLimit.middleware.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/middleware/rateLimit.middleware.ts)) to distribute rate limit tracking uniformly across multi-server and PM2 cluster topologies.
- Defined all 7 platform asynchronous queue topics with Dead Letter Exchange (DLX) and Dead Letter Queue (DLQ) binding configurations ([src/services/queue/queue-definitions.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/src/services/queue/queue-definitions.ts)).
- Created `QueueService` and `MemoryQueueService` twin with automatic topology assertion and tenant telemetry header injection ([src/services/queue/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/services/queue/)).
- Implemented `RealtimeService` and memory companion enforcing strictly namespaced Firestore UI document paths (`restaurants/{tenantId}/{collection}/{docId}`) with safe document merges ([src/services/realtime/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/services/realtime/)).
- Created real cloud infrastructure integration test suite verifying Upstash Redis locks, CloudAMQP queues, and Firebase Firestore publishing ([tests/integration/services.test.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/tests/integration/services.test.ts)).

**Deliverable achieved:**
- All three infrastructure service interfaces (Cache, Queue, Realtime) standardized, decoupled, and verified against both real cloud instances and in-memory test twins. 5 / 5 test suites (24 tests) passing cleanly.

**Notes / deviations from the plan:**
- None. All service interfaces strictly follow Interface Rule #2 and support zero-network unit test mock modes.

**Next phase:** Phase 3 — Core Domain Modules
- Build the restaurant management domain upon our multi-tenant and service foundations.

---

### ✅ Phase 3 — Core Domain Modules — Completed 2026-07-30
**What was implemented:**
- Constructed all 12 operational core domain modules: `Branches`, `Restaurants`, `Categories`, `Variants`, `Products`, `Menu`, `Tables`, `Orders`, `Coupons`, `Customers`, `Employees`, `Feedback`, `Reports`, and `Notifications` ([src/modules/](file:///c:/Users/Mohand/Documents/GitHub/Restaurant-SaaS-Platform/backend/src/modules/)).
- Enforced strict database isolation across all domain modules using `tenantQuery`, with explicit fallback parameters in `tenantMiddleware` allowing guest QR menu reads via URL query parameters (`?tenantId=...`).
- Decoupled **Platform Super Admin (`super_admin`)** from tenant restrictions ([src/modules/auth/](file:///c:/Users/Mohand/Documents/GitHub/Restaurant-SaaS-Platform/backend/src/modules/auth/)): Super Admin master accounts reside at the global root level with optional/null `tenantId`, logging in with email/password alone and targeting client workspaces on demand via custom headers or query arguments.
- Implemented **Automated Dining Floor Plan State Machine**: Orders automatically transition dining tables from `AVAILABLE` to `OCCUPIED` upon dine-in placement and return them to `AVAILABLE` upon bill checkout to `PAID`.
- Established **POS Offline-Sync & Duplicate Replay Defense**: Batched offline register sync arrays require unique `offlineGuid` markers, immediately identifying and ignoring duplicate retry transmissions (`{ synced: 1, skipped: 1 }`).
- Configured real-time Mongoose aggregation for sales reporting ([src/modules/reports/service.ts](file:///c:/Users/Mohand/Documents/GitHub/Restaurant-SaaS-Platform/backend/src/modules/reports/service.ts)) accommodating both string and `ObjectId` identifiers.
- Created comprehensive master Postman reference manual with copy-pasteable JSON payloads across all operational roles ([docs/POSTMAN_ENDPOINTS_GUIDE.md](file:///c:/Users/Mohand/Documents/GitHub/Restaurant-SaaS-Platform/docs/POSTMAN_ENDPOINTS_GUIDE.md)).
- Updated API routes catalog ([docs/API_ROUTES.md](file:///c:/Users/Mohand/Documents/GitHub/Restaurant-SaaS-Platform/docs/API_ROUTES.md)) to include Phase 3 routes and Phase 4 AI Menu Data Contracts.

**Deliverable achieved:**
- All 12 domain modules implemented without inventory overhead, completely integrated with Upstash Redis RAM menu caching, RabbitMQ message queues, and Firestore real-time mirroring. 6 / 6 test suites (25 tests) passing cleanly.

**Notes / deviations from the plan:**
- Zero inventory management bloat included per explicit architectural requirement.
- Created [POSTMAN_ENDPOINTS_GUIDE.md](file:///c:/Users/Mohand/Documents/GitHub/Restaurant-SaaS-Platform/docs/POSTMAN_ENDPOINTS_GUIDE.md) under a strict living rule requiring automatic updates after every newly engineered route or phase.

**Next phase:** Phase 4 — Integrations & Background Workers
- Wire up external payment (Paymob) and document upload (Cloudinary) pipelines.
- Build high-speed AI Menu Bulk Ingestion Gateway (`POST /api/v1/menu/bulk-import`) interfacing with decoupled external AI automation tools (n8n / Vision LLM OCR parsers).
- Deploy standalone PM2-managed consumer background worker processes per asynchronous queue topic.

---

### ✅ Phase 4 — Integrations & Background Workers — Completed 2026-07-30
**What was implemented:**
- Implemented **AI Menu Bulk Import Gateway** (`POST /api/v1/menu/bulk-import`) in `src/modules/menu/` with Zod schema validation, RBAC checks (`['super_admin', 'owner', 'manager']`), atomic Mongoose database sessions/transactions via `tenantQuery`, and Upstash Redis menu catalog cache invalidation (`menu:catalog:${tenantId}`).
- Created **AI Menu Ingestion & n8n Integration Services** ([src/integrations/n8n/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/integrations/n8n/), [src/integrations/ai-menu/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/integrations/ai-menu/)) with HMAC SHA-256 webhook signature verification (`POST /api/v1/integrations/n8n/webhook`) enforcing Rule #5.
- Created isolated **Paymob Integration Stubs** ([src/integrations/paymob/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/integrations/paymob/)) with HMAC SHA-512 verification logic prepared as a future feature stub, ensuring active checkout and billing flows exclusively rely on **Cash (`cash`)**.
- Extended queue service abstraction (`IQueueService`, `RabbitMQQueueService`, `MemoryQueueService`) with message `consume` subscription methods supporting auto-acknowledgment and Dead Letter Queue (DLQ) error routing ([src/services/queue/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/services/queue/)).
- Built all 6 **Standalone PM2 Background Workers** ([src/workers/](file:///d:/Restaurant%20SaaS%20Platform/backend/src/workers/)): `email.worker.ts`, `telegram.worker.ts`, `invoice.worker.ts`, `subscription-check.worker.ts`, `payment-retry.worker.ts`, and `backup.worker.ts`.
- Updated PM2 process ecosystem configuration ([backend/ecosystem.config.js](file:///d:/Restaurant%20SaaS%20Platform/backend/ecosystem.config.js)) to manage all 6 worker processes and the `n8n` workflow service as independent, restartable VPS processes.
- Created comprehensive integration & unit test suite ([tests/integration/phase4.test.ts](file:///d:/Restaurant%20SaaS%20Platform/backend/tests/integration/phase4.test.ts)) covering bulk menu import validation, atomic creation, cross-tenant isolation, n8n HMAC webhook verification, and queue worker consumption.
- Updated API routes documentation ([docs/API_ROUTES.md](file:///d:/Restaurant%20SaaS%20Platform/docs/API_ROUTES.md)).

**Deliverable achieved:**
- External AI onboarding pipelines, bulk import gateway, n8n webhook automation, and all 6 dedicated background workers implemented and verified with 100% test pass rate across unit, integration, and cross-tenant isolation test suites.

**Notes / deviations from the plan:**
- **Cloudinary Uploads**: Per user instruction, Cloudinary uploads are managed directly on the frontend client; no backend Cloudinary files are required.
- **Paymob Integration**: Per user instruction, Paymob is strictly isolated as a future feature stub and is not attached to active checkout or billing endpoints; active payments exclusively use normal cash (`cash`).

**Next phase:** Phase 5 — PM2, Nginx & Production VPS Deployment
- Configure production build pipelines, PM2 cluster management, Nginx reverse proxy, SSL certification, and deployment scripts.

---

### ✅ Phase 5 — PM2, Nginx & Deploy Tooling (Staging) — Completed 2026-07-31
**What was implemented:**
- Upgraded [backend/ecosystem.config.js](file:///d:/Restaurant%20SaaS%20Platform/backend/ecosystem.config.js) to production execution mode running compiled TypeScript JS output (`dist/`) for the API service, all 6 background workers (`worker-email`, `worker-telegram`, `worker-invoice`, `worker-subscription`, `worker-payment-retry`, `worker-backup`), and `n8n`.
- Enhanced [backend/package.json](file:///d:/Restaurant%20SaaS%20Platform/backend/package.json) with production clean build (`build:clean`, `build:prod`) and PM2 lifecycle management scripts (`pm2:start`, `pm2:reload`, `pm2:status`, `pm2:logs`).
- Created automated zero-downtime deployment script ([backend/scripts/deploy.sh](file:///d:/Restaurant%20SaaS%20Platform/backend/scripts/deploy.sh)) featuring fast-forward git pull, production dependency installation, TypeScript compilation, PM2 process reloading, and HTTP health check validation (`/health`).
- Built production-hardened Nginx virtual host proxy configurations for API ([nginx/sites-available/api.conf](file:///d:/Restaurant%20SaaS%20Platform/nginx/sites-available/api.conf)) with TLS Let's Encrypt placeholders, rate limiting, and security headers, and for n8n ([nginx/sites-available/n8n.conf](file:///d:/Restaurant%20SaaS%20Platform/nginx/sites-available/n8n.conf)) with WebSocket upgrades and IP allowlisting rules.
- Created comprehensive staging VPS operational guide ([docs/STAGING_RUNBOOK.md](file:///d:/Restaurant%20SaaS%20Platform/docs/STAGING_RUNBOOK.md)) covering Ubuntu 24.04 provisioning, UFW firewall rules, Node 20 LTS setup, Certbot SSL configuration, and end-to-end integration checklists.
- Implemented backup archival script ([backend/scripts/backup.sh](file:///d:/Restaurant%20SaaS%20Platform/backend/scripts/backup.sh)) and backup recovery verification drill script ([backend/scripts/restore-drill.sh](file:///d:/Restaurant%20SaaS%20Platform/backend/scripts/restore-drill.sh)).

**Deliverable achieved:**
- Full PM2 ecosystem, Nginx reverse proxy configurations, production build pipeline, automated deployment script, and staging VPS runbook engineered and verified — proving the zero-downtime deployment mechanism is complete and ready for staging rehearsals.

**Notes / deviations from the plan:**
- Managed cloud infrastructure services (MongoDB Atlas, Upstash Redis, CloudAMQP) are used across all environments, eliminating the need to install local Mongo/Redis/RabbitMQ instances on the VPS.

**Next phase:** Phase 6 — Backups & Reliability
- Configure automated cron backup jobs, health monitoring, failure handling, and disaster recovery restore drills.
