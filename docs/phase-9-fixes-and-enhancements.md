# Phase 9 — Correctness Fixes, Tenant-Context Rework & New Domain Features

**Prerequisite:** Phase 8 complete (live on Vercel Serverless, `/ai-status` and `/rag-catalog` gateways operational).
**Reference:** see `00-project-overview.md` for the tenant data model and `PROJECT_RULES.md` for the non-negotiable rules (tenant scoping, service interface layer, Zod validation, domain events).

## Goal
Close ten concrete gaps found during review: two RBAC/data-model bugs (billing authority, missing auto-subscription), one architecture change (tenant context resolution moves from headers to body), three new/extended domain features (branch table counts, chatbot table reservations, QR token integrity + table order history with a retention cron), one cross-module audit (POS vs KDS), one audit-log enrichment, and one frontend backlog item (Cloudinary avatar upload). Every step below follows the existing module conventions: `controller.ts` stays thin, `service.ts` holds logic, `repository.ts` is the only place touching Mongoose via `tenantQuery`, and every new/changed endpoint gets a Zod schema plus a cross-tenant isolation test per Rule #9.

---

## 9.1 — Only `super_admin` may change a tenant's plan/billing (currently `owner` can)

**Problem:** `subscriptions/routes.ts` lets `owner` call `PATCH /api/v1/subscriptions` to change their own `plan`/`status`, and `billing/routes.ts` lets `owner` call `POST /api/v1/billing` to write billing records. A tenant should never be able to grant itself a higher plan or fabricate a "paid" billing record — plan/billing mutation is a platform-operator action.

**Fix plan:**
1. `backend/src/modules/subscriptions/routes.ts` — change the `PATCH /` route from `rbacMiddleware(['owner'])` to `requireSuperAdmin` (import from `middleware/rbac.middleware.js`, already exported). Keep `GET /` on `['owner', 'manager']` — tenants may still *view* their plan.
2. `backend/src/modules/subscriptions/controller.ts` — `updateSubscription` currently reads `req.tenantId` (resolved for the caller). Since only `super_admin` calls this now, resolve the **target** tenant explicitly: accept `tenantId` in the validated body (see §9.2 for how tenant context now travels in the body) rather than relying on `req.tenantId` of the caller, because a super_admin has no tenant of their own.
3. `backend/src/modules/subscriptions/validation.ts` — extend `UpdateSubscriptionSchema` with a required `tenantId: objectIdSchema` field (import from `shared/validation`).
4. `backend/src/modules/billing/routes.ts` — change `POST /` from `rbacMiddleware(['owner'])` to `requireSuperAdmin`. Keep `GET /` and `GET /:id` on `['owner', 'manager']` (tenants can view their own invoices/history).
5. `backend/src/modules/billing/controller.ts` / `validation.ts` — same pattern as subscriptions: `CreateBillingRecordSchema` gains a required `tenantId`, and `createRecord` uses that instead of `req.tenantId`.
6. Update `docs/API_ROUTES.md` and `docs/POSTMAN_ENDPOINTS_GUIDE.md`: mark both endpoints `Auth (super_admin)` instead of `Auth (owner)`.

**Tests to add (`backend/tests/integration/`):**
- `owner` token → `PATCH /api/v1/subscriptions` → expect `403`.
- `owner` token → `POST /api/v1/billing` → expect `403`.
- `super_admin` token with a valid target `tenantId` in body → both succeed (`200`/`201`).
- Cross-tenant: `super_admin` targeting a tenant that doesn't exist → `404`.

---

## 9.2 — Tenant context must travel in `req.body`, not headers

**Problem:** `tenant.middleware.ts` currently resolves `tenantId` from `X-Tenant-Id` / `X-Tenant-Slug` / `X-Target-Tenant-Id` headers (or `?tenantId=` query for GET). This is inconsistent with the requirement that tenant context be explicit in the request payload.

**Design decision (stated explicitly since GET has no body):**
- For `GET`/`DELETE`-with-no-body style requests, tenant context is read from the **query string** (`?tenantId=` / `?tenantSlug=`) — already partially true today, kept as-is.
- For `POST` / `PUT` / `PATCH` requests, tenant context is read from **`req.body.tenantId`** / **`req.body.tenantSlug`** — headers are no longer read at all for these methods.
- The authenticated-user path (JWT already carries `tenantId`) is unaffected — that remains the primary source for normal dashboard/staff traffic and always wins over anything in the body, except for the `super_admin` impersonation path below.
- `super_admin` impersonation (target-tenant override) now reads `tenantId`/`tenantSlug` from `req.body` (for mutating requests) or `req.query` (for GET), replacing `X-Target-Tenant-Id`/`X-Tenant-Id` headers.

**Fix plan:**
1. Rewrite `backend/src/middleware/tenant.middleware.ts`:
   ```ts
   const bodyTenantId = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
     ? (req.body?.tenantId as string | undefined)
     : undefined;
   const bodyTenantSlug = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
     ? (req.body?.tenantSlug as string | undefined)
     : undefined;
   const queryTenantId = req.query['tenantId'] as string | undefined;
   const queryTenantSlug = req.query['tenantSlug'] as string | undefined;
   const targetId = bodyTenantId ?? queryTenantId;
   const targetSlug = bodyTenantSlug ?? queryTenantSlug;
   ```
   Replace every `req.headers['x-tenant-id']`, `req.headers['x-tenant-slug']`, `req.headers['x-target-tenant-id']` read with the resolved `targetId`/`targetSlug` above. Logic order stays the same (super_admin impersonation → authenticated user's own tenant → bot/channel/guest resolution → 403).
2. `backend/src/middleware/requestLogger.middleware.ts` — currently falls back to `req.headers['x-tenant-slug']` for the log line; change fallback to `req.body?.tenantSlug ?? 'public'` (best-effort only, logging doesn't need to be strict).
3. Every route that currently expects `X-Tenant-Id` on a GET-with-query-fallback (menu catalog, rag-catalog, ai-status, table QR resolve, feedback POST) — audit each:
   - `menu/routes.ts` `GET /catalog` — stays query-based (`?tenantId=`), no change needed.
   - `feedback/routes.ts` `POST /` — currently public with `tenantMiddleware` only; now must send `tenantId` in the JSON body instead of `X-Tenant-Id` header. Add `tenantId: objectIdSchema` to a lightweight body pass-through **before** Zod-validating the feedback payload itself (the middleware reads `req.body.tenantId` before the controller's `createFeedbackSchema.parse` runs — safe, since Zod validation happens after tenant resolution in the handler chain).
   - `menu/controller.ts` `getRagCatalogHandler` — already reads `req.params['tenantId'] || req.query['tenantId']`; no change (GET, public, param/query is fine).
4. Update every integration test that sets `.set('X-Tenant-Id', tenantId)` on a mutating request to instead put `tenantId` into `.send({ ..., tenantId })`. Affected test files: `tenants.test.ts`, `phase3-domain.test.ts`, `phase4.test.ts`, `users.test.ts` (indirectly via helper calls), and the Postman collection (`docs/Restaurant_SaaS_Platform.postman_collection.json`) — every request body gains `"tenantId": "{{tenant_id}}"` and the `X-Tenant-Id` header entries are removed for POST/PUT/PATCH/DELETE calls. GET-only calls keep `?tenantId={{tenant_id}}` in the URL where they already had it, or add it where the header was previously the only signal (e.g. billing `GET /`, employees `GET /`, etc. — these are authenticated staff calls so `req.user.tenantId` already covers them and no change is functionally required, but update Postman for consistency).
5. `docs/API_ROUTES.md` and `docs/POSTMAN_ENDPOINTS_GUIDE.md` — replace every `X-Tenant-Id: {{tenant_id}}` header row with a note that `tenantId` belongs in the JSON body for write operations.

**Backward-compatibility note:** this is a breaking change for any external caller (n8n workflows, POS terminals) currently sending `X-Tenant-Id`. Since `ai-status` and `rag-catalog` are GET-only public gateways, they are unaffected (query/param based). Document this explicitly in the PR description and in `README.md`'s Progress Log entry for this phase.

**Tests to add:**
- POST endpoint (e.g. `POST /api/v1/feedback`) with `tenantId` in body but no header → succeeds.
- Same endpoint with `tenantId` only in a header and not in body → now must be rejected (`403`, tenant context could not be resolved) — this is the regression test proving the header path is closed.
- `super_admin` impersonation via `req.body.tenantId` on a mutating route → succeeds without cross-tenant 403.

---

## 9.3 — Creating a tenant must also create its default subscription

**Problem:** `TenantService.createTenant` (`backend/src/modules/tenants/service.ts`) creates the `Tenant` document only. `SubscriptionRepository.create` is only ever invoked lazily, inside `SubscriptionService.getSubscription`, the first time someone calls `GET /api/v1/subscriptions`. Until then the tenant has no `Subscription` document at all, which is inconsistent (and would break §9.1's super_admin `PATCH /subscriptions`, which now requires an *existing* subscription to update, per current `SubscriptionService.updateSubscription` throwing `404` if none exists).

**Fix plan:**
1. `backend/src/modules/tenants/service.ts` — inside `TenantService.createTenant`, after `TenantRepository.create(...)` succeeds, call:
   ```ts
   await SubscriptionRepository.create(tenant._id.toString(), {
     plan: 'free',
     status: 'trialing',
   });
   ```
   Import `SubscriptionRepository` from `../subscriptions/repository.js`.
2. Wrap tenant + subscription creation in `withTransactionOrFallback` (already used elsewhere in the codebase — `utils/withTransactionOrFallback.js`) so a subscription-creation failure doesn't leave an orphan tenant. If the transaction path isn't available (standalone Mongo, matching the known Phase-4/6 audit finding), fall back to sequential non-transactional writes exactly like `OrderService.createOrder` does.
3. `backend/src/modules/subscriptions/service.ts` — `getSubscription` can keep its lazy-create fallback for tenants that predate this change (defensive), but it is no longer the primary creation path.
4. Emit a domain event `tenant.created` (already defined in `shared/events/index.ts` as `DomainEventPayloads['tenant.created']` but never actually emitted anywhere) right after the transaction commits, so future listeners (e.g. the "Zero-to-Value" auto-seeding worker from the roadmap doc) can react without `TenantService` needing to know about them.

**Tests to add:**
- `POST /api/v1/tenants` (super_admin) → immediately follow with `GET /api/v1/subscriptions` (as the new tenant's owner) → expect `plan: 'free'`, `status: 'trialing'`, no lazy-create side effect needed.
- Assert exactly one `Subscription` document exists for the tenant (no duplicate from the lazy-create fallback ever firing).

---

## 9.4 — Creating a table must increment the branch's `tableCount`

**Problem:** `BranchModel` has a `tableCount: number` field (`backend/src/modules/branches/model.ts`), but nothing ever writes to it. `TableService.createTable` (`backend/src/modules/tables/service.ts`) creates a `Table` document and never touches the branch.

**Fix plan:**
1. `backend/src/modules/tables/repository.ts` — no change needed here; the branch update belongs in the service layer since it crosses module boundaries (Rule #12 — inter-module coupling should go through events, not a direct repository-to-repository call from `tables/repository.ts` into `branches/model.ts`).
2. `backend/src/modules/tables/service.ts` — after `this.repo.create(...)` succeeds, increment the branch counter using `tenantQuery.updateOne(BranchModel, tenantId, { _id: dto.branchId }, { $inc: { tableCount: 1 } })`. Import `BranchModel` from `../branches/model.js` and `tenantQuery` from `../../utils/tenantQuery.js`.
3. `backend/src/modules/tables/service.ts` — mirror the decrement in `deleteTable`: `$inc: { tableCount: -1 }` after a successful delete (guard against going negative with `$max`/a floor check, or simply clamp: only decrement if `tableCount > 0` — simplest is `$inc: -1` plus a follow-up `updateOne(..., { tableCount: { $lt: 0 } }, { $set: { tableCount: 0 } })` — or, more simply, recompute via `countDocuments` if drift is ever suspected).
4. Alternative considered and rejected: recomputing `tableCount` via `countDocuments` on every table CRUD call. Rejected because it's an extra query on the hot path for zero benefit over an atomic `$inc`; keep `$inc` as the primary mechanism, and optionally add a one-off reconciliation script later if drift is ever observed (not required for this phase).

**Tests to add:**
- Create a branch → `tableCount` starts at `0` (schema default already `0`, still assert it after seeding via `createBranchSchema`).
- Create 3 tables against that branch → `GET /api/v1/branches/:id` shows `tableCount: 3`.
- Delete 1 table → `tableCount: 2`.

---

## 9.5 — Customers can reserve a table via the chatbot before arriving

**Problem:** No reservation concept exists today. `TableModel.status` only supports `AVAILABLE | OCCUPIED | RESERVED | BILL_REQUESTED` — `RESERVED` exists in the enum but nothing ever sets it, and there's no record of *who* reserved it or *when*.

**Fix plan — new `reservations` module** (`backend/src/modules/reservations/`, following the standard module shape):

1. **`model.ts`** — `IReservation`:
   ```ts
   tenantId: Types.ObjectId;
   branchId: Types.ObjectId;
   tableId?: Types.ObjectId;       // optional — may be assigned later by staff
   customerId?: Types.ObjectId;    // linked if the customer already exists in CRM
   customerName: string;
   customerPhone: string;
   partySize: number;
   reservedFor: Date;              // requested arrival time
   channel: 'TELEGRAM' | 'WEB' | 'WHATSAPP' | 'DASHBOARD';
   status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';
   notes?: string;
   ```
   Compound index `{ tenantId: 1, branchId: 1, reservedFor: 1 }` per Rule #11 (operational/storefront model).
2. **`validation.ts`** — `createReservationSchema` (tenantId, branchId, customerName, customerPhone via `phoneSchema`, partySize min 1, reservedFor as ISO datetime that must be in the future, channel defaulting to `TELEGRAM`, optional `tableId`). `updateReservationSchema` for staff (status transitions, table assignment).
3. **`repository.ts`** — standard `tenantQuery`-backed CRUD: `create`, `findAll` (filter by branch/status/date range), `findById`, `update`, `delete`.
4. **`service.ts`**:
   - `createReservation(tenantId, dto)` — public entry point for the chatbot. If `tableId` is supplied, verify via `tenantQuery` that the table belongs to the same tenant/branch and is not already `RESERVED`/`OCCUPIED` at an overlapping time window (simple overlap check against other `CONFIRMED`/`PENDING` reservations for that table within e.g. a 2-hour window — configurable constant). If no `tableId`, leave unassigned for staff to seat on arrival (`status: 'PENDING'`, no table lock yet).
   - `confirmReservation` / `assignTable` / `cancelReservation` / `markSeated` (transitions `Table.status` to `RESERVED` on confirm-with-table, and to `OCCUPIED` + sets `Table.currentOrderId` context on seat — reusing the existing table state-machine pattern from `OrderService`).
   - `markNoShow` — releases the table back to `AVAILABLE` if one was held.
   - On `markSeated`, emit nothing new; on `createReservation`, enqueue a confirmation notification via `QueueService` (`PLATFORM_QUEUES.TELEGRAM` or `EMAILS` depending on `channel`) — never send inline (Rule #8).
5. **`controller.ts`** + **`routes.ts`**:
   - `POST /api/v1/reservations` — **public** (chatbot/webhook origin, no `authMiddleware`), still goes through `tenantMiddleware` so tenant context resolves per §9.2 (tenantId in body). This is the endpoint n8n's Telegram/WhatsApp booking flow calls.
   - `GET /api/v1/reservations` — `authMiddleware` + `tenantMiddleware` + `rbacMiddleware(['owner','manager','cashier'])`, filterable by `branchId`/`status`/date range, for the dashboard's reservation board.
   - `PATCH /api/v1/reservations/:id` — staff-only (`['owner','manager','cashier']`) for confirm/assign/cancel/seat/no-show transitions.
6. Wire into `app.ts`: `import reservationRoutes from './modules/reservations/routes.js'; app.use('/api/v1/reservations', reservationRoutes);`
7. Update `docs/API_ROUTES.md` / Postman collection with the new module (mirror the "Guest Feedback Module" public-write pattern already documented there).

**Tests to add:**
- Chatbot books a table (no `tableId`) → `201`, `status: 'PENDING'`.
- Staff confirms + assigns a specific table → table flips to `RESERVED`.
- Double-booking the same table for an overlapping time window → rejected with a clear `409`.
- Cross-tenant isolation: tenant A cannot list/confirm/cancel tenant B's reservations.
- No-show flow releases the table back to `AVAILABLE`.

---

## 9.6 — QR token must encode (and the resolver must verify) `tenantId` + `branchId` + `table number`

**Problem:** `TableService.createTable` builds `qrCodeToken` as `qr_{tenantId.slice(0,6)}_{branchId.slice(0,6)}_{number}_{random}` — this *looks* like it encodes identity, but it's just a display convenience: `TableRepository.findByQrToken` does a raw, **non-tenant-scoped** `TableModel.findOne({ qrCodeToken: token })` and trusts whatever the database returns. Truncated 6-char ID fragments are not verifiable and not collision-safe, and nothing checks that the encoded fragments actually match the resolved document (i.e., the token's *claims* are never verified against its *payload*).

**Fix plan:**
1. Replace the ad-hoc string with a signed, self-describing token so tampering is detectable without a DB round trip for validation, while still keeping a DB round trip to fetch the live table (status can change):
   - Use `jsonwebtoken` (already a project dependency) with a **dedicated** signing secret (add `QR_TOKEN_SECRET: secureSecret()` to `config/env.ts`, reusing the existing `makeValidator` min-32-char rule — never reuse `JWT_SECRET`/`JWT_REFRESH_SECRET` for a different token purpose).
   - Payload: `{ tenantId, branchId, tableId, number }`. No `exp` — QR codes are printed and physically long-lived; if a table is deleted the resolver's DB lookup (`findById`) will simply 404 regardless of a still-valid signature.
   - `TableService.createTable`: after `this.repo.create(...)`, sign the token with the *real* `tableId` (needs a two-step create-then-update, or sign after obtaining the created document's `_id` and then update the row with the final token) and persist it as `qrCodeToken`.
2. `TableRepository.findByQrToken` (or a new `TableService.resolveByQrToken`) now:
   - `jwt.verify(token, env.QR_TOKEN_SECRET)` → on failure, throw `AppError('Invalid QR code token', 404)` (same external behavior as today for bad tokens, but now cryptographically enforced instead of a raw string miss).
   - Extract `{ tenantId, branchId, tableId }` from the verified payload.
   - Use **tenant-scoped** `tenantQuery.findOne(TableModel, tenantId, { _id: tableId, branchId })` instead of the current unscoped `TableModel.findOne({ qrCodeToken: token })` — this closes a real cross-tenant lookup gap where any valid-looking token string could be probed against the whole collection.
3. Keep the public route (`GET /api/v1/tables/qr/:token`) unauthenticated — the signature *is* the authorization for "this is a legitimate table from this restaurant," matching how QR-scan ordering is meant to work.
4. `TableService.resolveByQrToken` return payload should include `tenantId` and `branchId` explicitly in the response (not just the table fields) so the frontend/chatbot can immediately use them for the subsequent `POST /api/v1/orders` call's body-based tenant context (§9.2).

**Tests to add:**
- Create a table → decode `qrCodeToken` as a JWT → assert payload contains the same `tenantId`, `branchId`, `tableId`, `number`.
- Resolve via `GET /tables/qr/:token` → returns the table plus `tenantId`/`branchId`.
- A token signed for tenant A's table, replayed after tenant A's table is deleted → `404`, not a stale/incorrect table.
- A tampered token (flip one payload byte / re-sign with wrong secret) → `404` "Invalid QR code token", never leaks which part failed.

---

## 9.7 — Per-table order history (rolling 1-month), then a monthly cron purges detail but keeps the count

**Problem:** Nothing currently exposes "what has this table ordered recently" as a first-class view — you'd have to filter `GET /api/v1/orders?branchId=` client-side. There is also no retention/cleanup policy for per-table order detail, and no running "orders served" counter survives a purge.

**Fix plan:**
1. **`TableModel`** (`backend/src/modules/tables/model.ts`) — add `totalOrdersServed: number` (default `0`). This is the permanent counter that survives history purges (the "let only numbers of orders he created" requirement).
2. **Increment point:** `OrderService.updateOrderStatus` (`backend/src/modules/orders/service.ts`) already transitions a dine-in order's table back to `AVAILABLE` when `status === 'PAID'`. In that same branch, add `$inc: { totalOrdersServed: 1 }` to the existing `tenantQuery.updateOne(TableModel, tenantId, { _id: order.tableId }, { status: 'AVAILABLE', currentOrderId: null, $inc: { totalOrdersServed: 1 } })` — note Mongoose allows mixing `$set`-implicit fields and `$inc` in one update object as long as top-level keys don't collide; write it explicitly as `{ $set: { status: 'AVAILABLE', currentOrderId: null }, $inc: { totalOrdersServed: 1 } }` to be unambiguous.
3. **New history endpoint:** `GET /api/v1/tables/:id/history` (`backend/src/modules/tables/controller.ts` + `routes.ts`, `rbacMiddleware(['owner','manager','cashier'])`) — calls a new `TableService.getOrderHistory(tenantId, tableId, { limit, sinceDate })` which delegates to `OrderRepository`-style query: `tenantQuery.find(OrderModel, tenantId, { tableId }).sort({ createdAt: -1 }).limit(limit ?? 50)`. Since `OrderModel` already carries `tableId`, no schema change is needed here — this is a read-model composition, not a new collection. (Avoids the anti-pattern of duplicating order data into a separate "table history" table that could drift from the source of truth in `orders`.)
4. **Retention window:** "history" = `Order` documents with `tableId` set, `createdAt` within the last 30 days. Anything older is considered purged detail; the `totalOrdersServed` counter (already durable per step 2) is what remains queryable after purge.
5. **New monthly cron worker:** `backend/src/workers/table-history-cleanup.worker.ts`, following the exact shape of `backup.worker.ts` (its own `node-cron` schedule + a `PLATFORM_QUEUES` entry so it's also independently triggerable):
   - Add `TABLE_HISTORY_CLEANUP` to `queue-definitions.ts` (`q.table-history-cleanup`, standard DLX/DLQ pattern, `maxRetries: 2`).
   - `processTableHistoryCleanupJob()` — for orders where `tableId` exists and `status` is terminal (`PAID` or `CANCELLED`) and `createdAt < now - 30 days`: this is a platform-wide sweep (not tenant-scoped at the call site, since it's a scheduled system job — but the actual delete query still runs per-tenant in a loop over all active tenants, or as a single unscoped `deleteMany` restricted to `{ tableId: { $exists: true }, status: { $in: ['PAID','CANCELLED'] }, createdAt: { $lt: cutoff } }` — unscoped is acceptable here specifically because the filter has nothing to do with cross-tenant *read* exposure, it's a symmetric delete-everyone's-old-rows job, not a query whose *results* are returned to any tenant).
   - Schedule: `cron.schedule('0 3 1 * *', ...)` — 03:00 on the 1st of every month, mirroring the existing daily-backup pattern (`0 2 * * *`) already in `backup.worker.ts`.
   - Log a summary (`{ deletedCount }`) via the shared `logger`, matching the existing worker logging conventions.
6. Register the new worker in `ecosystem.config.js` (PM2 process `worker-table-history-cleanup`) and in `infra/rabbitmq/definitions.json` if that file is regenerated per the Phase 4/5/6 audit's recommendation (§6.3 of that audit) — otherwise note it as a known gap the same way `REPORTS` already is.

**Tests to add:**
- Pay an order tied to a table → `Table.totalOrdersServed` increments by 1.
- `GET /api/v1/tables/:id/history` returns orders newest-first, respects `limit`.
- Cron job unit test (call `processTableHistoryCleanupJob` directly, matching the existing pattern in `backend/tests/integration/phase4.test.ts` for the other worker handlers): seed one old `PAID` order (createdAt backdated 40 days) and one recent one → after running, only the recent one remains, and `totalOrdersServed` is untouched by the purge (already incremented at pay-time, independent of row survival).

---

## 9.8 — POS vs. KDS: conflict analysis and guardrails

**Problem statement (as requested):** verify whether the existing single `orders` module, used both for POS ticket creation and for Kitchen Display System status transitions, has any real conflict.

**Findings:**
1. **No structural conflict today.** POS (`POST /api/v1/orders`, `POST /api/v1/orders/offline-sync`) and KDS (`PATCH /api/v1/orders/:id` for status transitions) already share one `OrderModel`/`OrderService`, which is architecturally correct — both are views over the same order lifecycle, and Phase 3's design (`docs/phase-3-core-domain-modules.md` §4) explicitly intends this.
2. **RBAC is already reasonably separated:** `orders/routes.ts` allows `createOrderHandler` for any authenticated tenant role (POS terminals run as `cashier`), and gates `updateOrderStatusHandler` to `['owner','manager','cashier','kitchen']` — `kitchen` role exists specifically for KDS-only staff who should never need `POST /orders`. This is correct and requires **no change**.
3. **Real gap found — race condition on concurrent status writes:** `OrderRepository.updateStatus` does an unconditional `findOneAndUpdate` with no optimistic concurrency check. If a KDS terminal and a POS/cashier both PATCH the same order's status within the same instant (e.g., kitchen marks `READY` while cashier marks `CANCELLED` after a customer walked out), the last write silently wins with no conflict signal, and the table-state-machine side effects (`§9.7` above, and the existing `AVAILABLE`/`currentOrderId` reset logic) could run twice or against a status that's already been superseded.
   - **Fix:** add a lightweight optimistic lock. Add `__v`-based (Mongoose's built-in `versionKey`, already present by default) status guard: `OrderRepository.updateStatus` should accept an expected-current-status precondition where the caller cares (KDS UI already knows the status it's transitioning *from*), using `tenantQuery.findOneAndUpdate(OrderModel, tenantId, { _id: orderId, status: expectedCurrentStatus }, { status: newStatus }, { new: true })`. If the doc comes back `null`, throw a distinct `AppError('Order status has changed since you last viewed it — refresh and retry', 409)` instead of the generic "not found" 404, so the frontend can distinguish "someone else already moved this order" from "this order doesn't exist."
   - `updateOrderStatusSchema` (`orders/validation.ts`) gains an optional `expectedCurrentStatus` field; when supplied, the service enforces it; when omitted (e.g. a manager force-override), it behaves as today (last-write-wins) — this keeps the change backward-compatible.
4. **Second gap — offline-sync + KDS interplay:** `OrderService.syncOfflineOrders` creates orders (via `createOrder`) that immediately occupy a table if `channel === 'DINE_IN'` and `tableId` is set. If a POS terminal was offline long enough that the table was, in the meantime, manually reassigned or freed by KDS/staff on another terminal, a batch-synced offline order could silently re-occupy a table that a human already resolved differently. This is an inherent tradeoff of offline-first sync and is **out of scope to fully solve in this phase**, but the fix in point 3 (status preconditions) plus surfacing `synced`/`skipped` counts (already returned) is the current mitigation. Document this explicitly as a known limitation in `docs/runbook.md` under a new "Known Limitations" section rather than silently leaving it undocumented.
5. **No module split recommended.** Splitting `orders` into separate `pos` and `kds` modules was considered and rejected: they operate on the same aggregate (`Order`) with the same invariants (table state machine, Firestore projection path, `order.completed` event), and Rule #12 (domain event bus for decoupling) already provides the seam needed if a future dedicated KDS microservice is ever justified — no premature split needed now.

**Tests to add:**
- Two concurrent `PATCH` calls with the same `expectedCurrentStatus` racing — assert exactly one succeeds (`200`) and the other gets `409`.
- `PATCH` without `expectedCurrentStatus` still behaves exactly as before (regression test — no behavior change for existing KDS clients that haven't been updated yet).

---

## 9.9 — Notification audit log needs `tenantId`, `branchId`, table context, and the action-maker's `userId`

**Problem:** `NotificationLogModel` (`backend/src/modules/notifications/model.ts`) already has `tenantId`, but is missing: `branchId`, an optional table reference (number, for "table X's bill emailed" type notifications), and — critically — **who triggered the send** (`actionMakerId` / `userId`). `NotificationService.dispatchNotification` never persists a log row at all today; it only enqueues to RabbitMQ (`services/queue`) and returns a boolean. There is a `NotificationRepository.createLog` already built but **nothing calls it**.

**Fix plan:**
1. **`notifications/model.ts`** — add fields:
   ```ts
   branchId?: Schema.Types.ObjectId;   // ref: 'Branch', optional (not every notification is branch-scoped)
   tableNumber?: number;               // optional — set when the notification concerns a specific table (e.g. bill/receipt)
   actionMakerId?: Schema.Types.ObjectId; // ref: 'User' — who triggered this dispatch (manager clicking "send"), null for system/automated sends
   ```
   Add index `{ tenantId: 1, branchId: 1, dispatchedAt: -1 }` alongside the existing `{ tenantId: 1, dispatchedAt: -1 }`.
2. **`notifications/validation.ts`** — extend `sendNotificationSchema` with optional `branchId: objectIdSchema.optional()`, `tableNumber: z.number().int().min(1).optional()`.
3. **`notifications/controller.ts`** — `dispatchNotificationHandler` already has `req.user` (route is behind `authMiddleware`); pass `req.user!.id` through to the service as the action maker.
4. **`notifications/service.ts`** — `dispatchNotification(tenantId, dto, actionMakerId)`:
   - After a successful `queueService.enqueue(...)`, call `NotificationRepository.createLog({ tenantId, channel: dto.channel, recipient: dto.recipient, messageSubject: dto.subject, messageBody: dto.message, status: 'QUEUED', branchId: dto.branchId, tableNumber: dto.tableNumber, actionMakerId, dispatchedAt: new Date() })` — this finally wires up the previously-orphaned repository method (closing a real dead-code gap).
   - Return the created log's `_id` alongside the existing boolean so the controller can surface it if useful.
5. **New read endpoint:** `GET /api/v1/notifications` (currently only `POST /dispatch` exists) — `rbacMiddleware(['owner','manager'])`, delegates to `NotificationRepository.findByTenant(tenantId, limit)` (already implemented, just never routed). Add to `notifications/routes.ts` and `notifications/controller.ts` (`listNotificationsHandler`).
6. Update `docs/API_ROUTES.md` / Postman with the new `GET` route and the enriched request/response shape.

**Tests to add:**
- Manager dispatches a notification tied to `branchId` + `tableNumber` → the persisted log row has all four new fields populated, including `actionMakerId` matching the caller.
- `GET /api/v1/notifications` returns the log, newest first, scoped to the caller's tenant only (cross-tenant isolation test per Rule #9).

---

## 9.10 — (Backlog, not implemented this phase) User profile photo upload via Cloudinary — frontend-owned

**Decision:** This stays a documented backlog item, consistent with how Cloudinary uploads were already scoped in Phase 4 ("Cloudinary uploads managed on the frontend" — see `README.md` Phase 4 notes and `docs/phase-4-5-6-audit.md` §4.2/4.3). No backend work is required to *perform* the upload — the frontend uploads directly to Cloudinary and only sends the resulting URL to the backend.

**Minimal backend readiness (safe to do now, low risk, unblocks frontend work later):**
1. `backend/src/modules/auth/model.ts` (`IUser`) — add optional `photoUrl?: string`.
2. `backend/src/modules/auth/validation.ts` — no new endpoint needed yet; when the frontend feature ships, a small `PATCH /api/v1/auth/me/photo` accepting `{ photoUrl: imageUrlSchema }` (reusing `shared/validation`'s existing `imageUrlSchema`) is the expected shape — **not built in this phase**, just reserved so the schema field exists and doesn't require a migration later.
3. Explicitly out of scope for this phase: multer/Cloudinary upload middleware for user photos (the existing `integrations/cloudinary/index.ts` `uploadTenantMedia` helper already supports an `employees` folder type that could be reused later for staff/user avatars if a backend-mediated upload path is ever preferred over direct-to-Cloudinary).

---

## Cross-Cutting Checklist Before Marking This Phase Complete

- [ ] `SubscriptionService.updateSubscription` / `BillingService.createRecord` reachable only by `super_admin` (§9.1), with tests.
- [ ] All mutating endpoints resolve tenant context from `req.body.tenantId`/`tenantSlug`; header-based resolution removed for non-GET methods (§9.2), with a regression test proving header-only no longer works.
- [ ] `TenantService.createTenant` creates a `Subscription` row atomically (§9.3), with a test.
- [ ] `Branch.tableCount` stays accurate through table create/delete (§9.4), with tests.
- [ ] `reservations` module built, routed, tested, tenant-isolated (§9.5).
- [ ] QR tokens are signed JWTs verified against tenant-scoped lookups, not raw string matches (§9.6), with a tampering test.
- [ ] `Table.totalOrdersServed` counter + `GET /tables/:id/history` + monthly cleanup cron in place (§9.7), with a cron-behavior test.
- [ ] Optimistic-concurrency guard added to order status transitions; POS/KDS conflict analysis documented in `docs/runbook.md` (§9.8).
- [ ] `NotificationLogModel` enriched and `NotificationRepository.createLog` actually wired into `NotificationService.dispatchNotification`; new `GET /api/v1/notifications` route (§9.9).
- [ ] `IUser.photoUrl` field reserved; upload endpoint explicitly deferred and documented as frontend-owned (§9.10).
- [ ] `docs/API_ROUTES.md`, `docs/POSTMAN_ENDPOINTS_GUIDE.md`, and the Postman collection JSON all updated to match every change above.
- [ ] `README.md` Progress Log gets a new `### ✅ Phase 9 — ...` entry per `PROJECT_RULES.md` §4, including an explicit "Notes / deviations" callout for the header→body breaking change in §9.2.

## Deliverable
A backend where: billing/plan changes are provably super_admin-only; every write endpoint resolves its tenant strictly from the request body (not headers); creating a tenant always yields a usable subscription; branch table counts stay accurate automatically; a customer can reserve a table through the chatbot ahead of arrival with double-booking protection; QR codes are cryptographically verifiable and tenant-scoped on resolution; every table exposes a rolling 30-day order history plus a durable lifetime order-count that survives a monthly cleanup cron; POS/KDS concurrent status writes are conflict-safe; notification audit logs carry full operational + accountability context; and the Cloudinary avatar feature has a clear, low-risk landing spot for when the frontend is ready to build it.
