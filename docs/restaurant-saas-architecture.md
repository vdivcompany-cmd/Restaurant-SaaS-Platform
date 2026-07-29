# Restaurant SaaS Platform — Full Architecture (Redis, RabbitMQ, Firebase Included From Day One)

Multi-tenant restaurant management SaaS for the Egyptian market. Built by a small team,
deployed on a single Hostinger VPS **as the last step**, using PM2 instead of Docker in
production.

**Update from the lean MVP version:** Redis, RabbitMQ, and Firebase are now built in from the
start rather than deferred. The `services/` interface layer (`CacheService`, `QueueService`,
`RealtimeService`) is kept regardless — it's good practice independent of when you adopt the
real infrastructure, since it keeps business logic swappable and testable. The difference is
that the *implementation* behind each interface is the real one (Redis, RabbitMQ, Firestore)
from Phase 1, not an in-memory placeholder.

**One thing worth stating plainly, once, so it's on record:** running three extra services
before you have real traffic means more to install, secure, monitor, back up, and debug — on a
single small VPS, with a small team. That's the cost of this decision. If early weeks feel
heavier than expected, that's this tradeoff showing up, not something going wrong. The
interface layer means you *could* still fall back to a simpler implementation per component
without touching business logic, if that ever becomes the practical choice.

---

## 1. Full Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Runtime | Node.js (via `nvm`) | — |
| Framework | Express.js | — |
| Language | TypeScript | — |
| ODM | Mongoose | — |
| Database | MongoDB, single instance to start | Replica set once failover/Change-Streams matter (Phase 6) |
| Multi-tenancy | `tenantId` on every document + tenant/RBAC middleware | Non-negotiable at any scale |
| Auth | JWT + refresh tokens + RBAC | — |
| Cache | `CacheService` interface → **Redis** implementation | Sessions, rate limiting, locks, idempotency, cached lookups |
| Background jobs | `QueueService` interface → **RabbitMQ** implementation | Retries, Dead Letter Queues, per-queue workers |
| Realtime | `RealtimeService` interface → **Firebase Firestore** implementation | Projection layer only — MongoDB stays source of truth |
| Process manager | PM2 (single instance to start; cluster mode once traffic needs it) | — |
| Automation | **n8n** — customer-facing workflows (Telegram ordering, notifications) | Own PM2 process, talks to backend API only |
| Payments | Paymob | Webhook signature verification from day one |
| File storage | Cloudinary | Only URLs stored in MongoDB |
| Reverse proxy | Nginx + Certbot | — |
| Backups | `mongodump` cron → off-server storage | Plus Redis AOF, RabbitMQ definitions export |
| Monitoring | `/health`, `/ready`, `/live` + PM2 monit + external uptime checker | Redis, RabbitMQ queue depth, MongoDB, Firebase write failures |

**Why the interface layer still matters even though the real infra is in from day one:**
business logic (`modules/orders`, `modules/subscriptions`, etc.) still only ever calls
`cacheService.get()`, `queueService.enqueue()`, `realtimeService.publish()` — never
`redis.get()` or `amqp.publish()` directly. This keeps the codebase testable (you can run
tests against an in-memory fake without spinning up Redis/RabbitMQ), and keeps the door open
to changing any one implementation later without a rewrite.

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
│   │   │   ├── env.ts                  # Validated env loading
│   │   │   ├── database.ts             # MongoDB connection
│   │   │   ├── redis.ts                # Redis client config
│   │   │   ├── rabbitmq.ts             # RabbitMQ connection + channel setup
│   │   │   └── firebase.ts             # Firebase Admin SDK init
│   │   │
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── tenants/
│   │   │   ├── subscriptions/
│   │   │   ├── billing/
│   │   │   ├── restaurants/
│   │   │   ├── branches/
│   │   │   ├── menu/
│   │   │   ├── categories/
│   │   │   ├── products/
│   │   │   ├── variants/
│   │   │   ├── coupons/
│   │   │   ├── orders/
│   │   │   ├── inventory/
│   │   │   ├── employees/
│   │   │   ├── customers/
│   │   │   ├── reports/
│   │   │   └── notifications/
│   │   │       └── (each: controller.ts, service.ts, routes.ts, model.ts,
│   │   │            validation.ts, tests/)
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── tenant.middleware.ts    # Non-negotiable at any scale
│   │   │   ├── rbac.middleware.ts      # Non-negotiable at any scale
│   │   │   ├── subscription-guard.middleware.ts
│   │   │   ├── rateLimit.middleware.ts # Redis-backed, per IP/user/tenant
│   │   │   ├── errorHandler.middleware.ts
│   │   │   └── requestLogger.middleware.ts
│   │   │
│   │   ├── services/                   # Interface layer — real infra behind it from day one
│   │   │   ├── cache/
│   │   │   │   ├── cache.interface.ts
│   │   │   │   ├── redis-cache.service.ts       # Real implementation
│   │   │   │   └── memory-cache.service.ts      # Kept for local tests only
│   │   │   ├── queue/
│   │   │   │   ├── queue.interface.ts
│   │   │   │   ├── rabbitmq-queue.service.ts    # Real implementation
│   │   │   │   └── queue-definitions.ts         # Queue names, DLQ, retry policy
│   │   │   └── realtime/
│   │   │       ├── realtime.interface.ts
│   │   │       └── firestore-realtime.service.ts # Real implementation
│   │   │
│   │   ├── workers/                    # Standalone PM2-managed consumer processes
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
│   │       └── idempotency.ts          # Redis-backed idempotency keys
│   │
│   ├── tests/
│   │   ├── unit/                       # Use memory-cache/fake-queue implementations here
│   │   ├── integration/
│   │   └── e2e/
│   │
│   ├── scripts/
│   │   ├── backup.sh                   # MongoDB + Redis AOF + RabbitMQ definitions
│   │   ├── restore-drill.sh
│   │   └── deploy.sh
│   │
│   ├── ecosystem.config.js             # PM2: api + each worker as a separate process
│   ├── .env.production                 # Not committed
│   ├── package.json
│   └── tsconfig.json
│
├── nginx/
│   └── sites-available/
│       ├── api.conf
│       └── n8n.conf
│
├── infra/
│   ├── redis/
│   │   └── redis.conf
│   ├── rabbitmq/
│   │   └── definitions.json            # Exported queues/exchanges for reproducibility
│   └── mongodb/
│       └── replica-set-init.js         # For Phase 6
│
└── docs/
    ├── architecture.md
    └── runbook.md
```

**PM2 process layout (`ecosystem.config.js`)** — each is a separate managed process so one
crashing doesn't take the others down:

```text
1. api                          (single instance to start; cluster mode later)
2. worker-email
3. worker-telegram
4. worker-invoice
5. worker-subscription-check
6. worker-payment-retry
7. worker-backup
8. n8n
```

---

## 3. Phased Plan

### Phase 0 — Local Environment
1. Node.js via `nvm`
2. Local MongoDB, Redis, and RabbitMQ — run these three via Docker Compose **for local dev
   only** (your app itself still runs natively via `nvm`, matching how it'll run on the VPS).
   This avoids hand-installing three stateful services on your laptop while keeping your app
   code environment-identical to production
3. Firebase project created (free Spark tier is enough for dev), service account key kept out
   of the repo, loaded via env var
4. `.env.local` with no hardcoded domains — everything comes from env
5. Scaffold the structure above

### Phase 1 — Tenant & Auth Foundation
1. `tenant.middleware.ts` + `rbac.middleware.ts` — get this right first, everything else
   depends on it
2. Auth module: JWT + refresh tokens
3. Tenants + Subscriptions + Billing skeleton
4. Cross-tenant isolation tests — deliberately try to access another tenant's data and assert
   it's rejected

### Phase 2 — Service Interfaces (Real Implementations)
1. `CacheService` interface + `redis-cache.service.ts` — sessions, rate limiting, distributed
   locks, idempotency keys, cached lookups (settings, menu, subscription status)
2. `QueueService` interface + `rabbitmq-queue.service.ts` — define queues up front: `emails`,
   `telegram`, `invoices`, `subscription-checks`, `payment-retries`, `reports`, `backups`, each
   with a retry policy and a Dead Letter Queue
3. `RealtimeService` interface + `firestore-realtime.service.ts` — backend writes to MongoDB
   first (source of truth), then projects the change to Firestore; dashboards subscribe to
   Firestore only
4. Keep `memory-cache.service.ts` and a fake queue implementation around, used only in
   `tests/unit` so tests don't need Redis/RabbitMQ running to pass
5. Every module built after this point uses the interfaces exclusively — never a direct
   `redis.get()`, `amqp.publish()`, or Firestore SDK call inside `modules/`

### Phase 3 — Core Domain Modules
1. Restaurants, Branches, Menu, Categories, Products, Variants, Coupons
2. Orders — Mongoose transactions for order + stock deduction, then a Firestore projection
   write, then a RabbitMQ event for downstream jobs (invoice, notifications, analytics)
3. Inventory, Employees, Customers
4. Reports, Notifications — routed through `QueueService`, consumed by dedicated workers

### Phase 4 — Integrations & Background Workers
1. Paymob, with webhook signature verification
2. Cloudinary for images
3. Each worker (`workers/*.worker.ts`) as its own PM2 process consuming one RabbitMQ queue —
   a stuck invoice worker should never block email delivery
4. n8n installed as its own PM2 process, reverse-proxied behind auth, triggering the backend
   API via webhook only — never touching MongoDB directly

### Phase 5 — PM2, Nginx & Deploy Tooling (build early, use on staging)
1. `ecosystem.config.js` covering `api` + all workers + `n8n`
2. `scripts/deploy.sh` (git pull, install, build, `pm2 reload`)
3. Test the whole flow — including Redis/RabbitMQ/Firestore connectivity — against a cheap
   staging VPS before Hostinger

### Phase 6 — Backups, Health & Reliability
1. `mongodump` cron → compressed → off-server storage
2. Redis: enable AOF persistence, since it now holds sessions and rate-limit state, not just
   disposable cache
3. RabbitMQ: export queue/exchange definitions to `infra/rabbitmq/definitions.json` so the
   setup is reproducible on a fresh box, not just remembered
4. Firestore write-failure handling: if a projection write fails, the order still succeeds —
   queue a retry via RabbitMQ rather than blocking the response
5. `/health`, `/ready`, `/live` endpoints checking MongoDB, Redis, RabbitMQ, and Firebase
   connectivity
6. Full restore drill on staging: MongoDB restore, Redis restore, RabbitMQ redefine, confirm
   the app comes back up clean
7. Once traffic justifies it: convert MongoDB to a replica set (or MongoDB Atlas) for
   failover and to unlock Change Streams as an alternative/complement to Firestore later

### Phase 7 — Hostinger Go-Live (final step)
1. Provision Hostinger VPS, harden it (UFW, fail2ban, SSH keys) — same steps proven on staging
2. Install Node, MongoDB, Redis, RabbitMQ (same pinned versions as staging)
3. Point DNS, run the already-tested `deploy.sh`
4. Nginx + Certbot for real TLS on both the API and n8n subdomains
5. Switch env vars from staging to production (CORS, Paymob webhook URL, Cloudinary callback,
   Firebase project)
6. Run the restore drill one more time, for real
7. Onboard first pilot restaurants

### Phase 8 — Scale Adjustments (event-driven, not scheduled)
The core infrastructure is already in place from Phase 1–2, so scaling from here is tuning,
not adopting new technology:

| Trigger | Action |
|---|---|
| Single core maxed out | Switch PM2 `api` to cluster mode (Redis already shared, so this is safe) |
| MongoDB failover matters, or Change Streams wanted | Convert to replica set / Atlas |
| RabbitMQ queue depth consistently backing up | Scale worker process count per queue |
| Firestore costs or read/write volume climbing | Review projection frequency, consider narrowing which collections project to Firestore vs. staying MongoDB-only with polling for low-priority views |
| More restaurants want more automation | Expand n8n workflows — same instance, more flows |

---

## 4. Restaurant "Room" Data Model (Build This First, Within Phase 1)

Every restaurant is a **tenant**. A tenant is not a separate database — it's a `tenantId` that
scopes every document across every collection. Each restaurant only ever sees documents tagged
with its own `tenantId`, enforced at the middleware level so no controller or service can
accidentally leak across rooms.

### Core collections and their tenant scoping

```text
tenants                    # one document per restaurant — the "room" itself
  _id
  name
  slug                     # used in URLs, Telegram bot routing, subdomains later
  status                   # active | suspended | trial
  subscriptionPlan
  subscriptionExpiresAt
  contact { phone, email }
  settings { currency, timezone, language: 'ar' | 'en' }
  createdAt

users                       # restaurant staff — every user belongs to exactly one tenant
  tenantId  ⟵ scoping key
  role                     # owner | manager | cashier | kitchen
  email / phone
  passwordHash

branches
  tenantId  ⟵ scoping key
  name
  address
  isActive

menu / categories / products / variants
  tenantId  ⟵ scoping key
  branchId (optional, if menu differs per branch)
  ...

orders
  tenantId  ⟵ scoping key
  branchId
  items[]
  status
  channel                  # telegram | web | qr | dine-in
  createdAt

customers
  tenantId  ⟵ scoping key
  phone
  name
  orderHistory[]

employees, inventory, reports, notifications, audit-logs
  tenantId  ⟵ scoping key   (same pattern throughout)
```

### The enforcement layer — this is what makes the "room" real
1. **`tenant.middleware.ts`** resolves `tenantId` from the authenticated user's JWT (staff
   dashboard) or from the bot/channel context (Telegram bot tied to a tenant's `slug`), and
   attaches it to `req.tenantId` on every request.
2. **Every Mongoose query goes through a query helper** that automatically injects
   `{ tenantId: req.tenantId }` into the filter — no service is allowed to hand-write a raw
   `Model.find({...})` without it. One missed `tenantId` filter is a real data leak between
   restaurants — this is the single most important rule in the whole system.
3. **Compound indexes** start with `tenantId` on every collection so queries stay fast as
   restaurant count grows.
4. **`tenantId` propagates everywhere, not just MongoDB:** RabbitMQ message payloads,
   Firestore document paths (`restaurants/{tenantId}/orders/...`), n8n webhook payloads, and
   log/audit entries all carry `tenantId` so isolation holds across every layer, not just the
   database.
5. **Tests written now, in Phase 1**, that deliberately try to access another tenant's data
   with a valid JWT from a different tenant, and assert it's rejected.

---

## 5. Weeks & Milestones Roadmap

### Milestone 1 — Backend Core + Full Infra (Weeks 1–4)
- Week 1: Project scaffold, local Redis/RabbitMQ/MongoDB via Docker Compose, Firebase project
  setup, `tenant.middleware.ts` + `rbac.middleware.ts`, tenant data model (Section 4), auth,
  cross-tenant isolation tests
- Week 2: `CacheService`/Redis, `QueueService`/RabbitMQ (queues + DLQ policy defined),
  `RealtimeService`/Firestore — all wired and tested against real local infra
- Week 3: Subscriptions + billing skeleton, restaurants/branches/menu/categories/products modules
- Week 4: Orders module with Mongoose transactions + Firestore projection + RabbitMQ event,
  inventory, employees, customers, Paymob integration with webhook verification

**Deliverable:** a backend you can hit with Postman/curl that fully manages one restaurant
end-to-end, with real caching, real background jobs, and real realtime projection running —
not placeholders.

### Milestone 2 — Owner Dashboard (Weeks 5–7)
- Week 5: Dashboard shell (Next.js), auth flow, tenant-aware routing
- Week 6: Menu/category/product management UI, order list subscribed to Firestore for live
  updates
- Week 7: Subscription/billing view, basic reports

**Deliverable:** a restaurant owner logs in, manages their menu, and watches orders update in
real time (via Firestore) without touching the database directly.

### Milestone 3 — Customer Ordering Channel (Weeks 8–9)
A new, independent Telegram bot for this platform — separate n8n instance and `tenantId` space
from Mono Store. Mono Store is referenced only as prior experience: the n8n routing and
session-persistence patterns you already solved apply here, not the workflow itself.
- Week 8: Multi-tenant Telegram bot — routes by tenant `slug`, backend API as the only thing
  touching MongoDB
- Week 9: Order confirmation flow, status updates back to customer via the same
  RabbitMQ/Firestore pipeline orders already use

**Deliverable:** a customer orders through Telegram, the owner sees it live on the dashboard,
kitchen status flows back to the customer.

### Milestone 4 — First Pilot Deployment (Week 10)
- Staging VPS rehearsal: PM2, Nginx, Redis, RabbitMQ, backups, full restore drill
- Hostinger go-live with one real pilot restaurant
- First real "show the business owner" moment — fully working, no AI yet

### Milestone 5 — n8n Workflow Expansion, Non-Agentic (Weeks 11–12)
- Low-stock alerts, subscription-expiry reminders, daily sales digest — rule-based automation
  via RabbitMQ-triggered n8n webhooks, no AI decision-making yet

### Milestone 6 — Agentic AI, Narrowly Scoped (Weeks 13+)
- One well-defined agent task first — e.g. a "help me choose a dish" assistant inside the
  Telegram flow, using the LangChain/LangGraph patterns from Rahal
- Layered onto a product that already works end-to-end, not a launch dependency
- Cost controls (capped tool-calling loop iterations) and a non-AI fallback

### Milestone 7 — Website Ordering-Cycle Chatbot (Weeks 15–18)
A second, broader agent: an embeddable chatbot on each restaurant's own website handling the
full order cycle — browse → decide → place order → track status → follow-up. Same agent
architecture as Milestone 6, wider scope, new channel, sequenced after Milestone 6 so the
narrow low-risk agent is proven first.
- Week 15: Define permitted agent actions as tools (`searchMenu`, `getRecommendation`,
  `createOrder`, `checkOrderStatus`, `applyCoupon`) — every action goes through the same
  backend API/service layer as every other channel
- Week 16: LangGraph conversation flow (state graph, not one long prompt) — pause for payment,
  resume after confirmation, hand off to human/cashier if stuck
- Week 17: Embeddable widget — one script tag per restaurant, `tenantId` passed via embed
  config, styled from `tenant.settings`
- Week 18: Guardrails — capped tool-calling loops, timeout fallback to plain menu browsing,
  every agent decision logged to `audit-logs` scoped by `tenantId`

**Note on scope:** this SaaS platform is fully separate from Mono Store — no shared
infrastructure, workflows, or data between them. Only debugging experience carries over.

**Why this order still holds:** infrastructure (Redis/RabbitMQ/Firebase) is now upfront in
Milestone 1 rather than deferred, but the *feature* sequencing is unchanged — dashboard before
ordering channel, ordering channel before AI, narrow agent before broad agent — because each
milestone should be usable by a real owner before the next one starts.
