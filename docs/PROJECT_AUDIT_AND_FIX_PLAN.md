# Restaurant SaaS Platform — Cross-Module Consistency Audit & Fix Plan

**Scope:** This audit looks specifically at whether the backend's pieces still agree with
each other after the Phase 9/10 changes (body-based tenant context, QStash migration,
QR JWT + session layer, reservations, notifications enrichment) — not a general code
review. Each item below is something that will actually bite in practice: a security
gap, a runtime inconsistency, or a doc/code divergence that will mislead the next person
(or the next AI agent) working on this repo.

Severity key: 🔴 Blocking/security · 🟠 Real inconsistency · 🟡 Cleanup/drift

---

## 🔴 1. `tenantMiddleware` silently accepts a non-existent target tenant for authenticated/super_admin requests

**File:** `backend/src/middleware/tenant.middleware.ts`

For an authenticated `super_admin` request, the middleware tries to resolve an
impersonation target:

```ts
if (targetId) {
  const tenant = await TenantRepository.findById(targetId);
  if (tenant) {
    req.tenantId = tenant._id.toString();
    return next();
  }
}
// ... falls through if tenant is null instead of rejecting
if (req.user.tenantId) { req.tenantId = req.user.tenantId; }
return next();
```

If `targetId` doesn't resolve to a real tenant, the function **does not return an
error** — it just falls through and calls `next()` with `req.tenantId` set to the
super_admin's own (often platform/null) tenant, or left `undefined`. The request is
never rejected at the middleware layer.

This directly contradicts the behavior implied by `docs/phase-9-implementation-summary.md`
("super_admin + nonexistent tenantId → 404") and there is no test in
`backend/tests/integration/tenants.test.ts` or `phase9.test.ts` that actually exercises
"super_admin targets a tenantId that doesn't exist."

**Fix:** When `targetId` (or `targetSlug`) is present but resolves to nothing, return
`403`/`404` immediately instead of falling through — mirror the existing "public path"
branch below it, which *does* correctly 403 on an invalid tenant:

```ts
if (targetId) {
  const tenant = await TenantRepository.findById(targetId);
  if (!tenant) {
    res.status(404).json({ success: false, message: 'Target tenant not found' });
    return;
  }
  req.tenantId = tenant._id.toString();
  return next();
}
```

Do the same for `targetSlug`. Add a regression test: super_admin token + a well-formed
but nonexistent `tenantId` in body → `404`, for both `/subscriptions` and `/billing`.

---

## 🔴 2. Billing records can be created against a tenant that doesn't exist

**Files:** `backend/src/modules/billing/controller.ts`,
`backend/src/modules/billing/service.ts`, `backend/src/modules/billing/repository.ts`,
`backend/src/utils/tenantQuery.ts`

`BillingController.createRecord` validates the body with `CreateBillingRecordSchema`
(which only checks `tenantId` is a 24-char hex string — format, not existence) and then
calls `BillingService.createRecord(validated.tenantId, validated)` directly —
**it never reads `req.tenantId`**, so whatever `tenantMiddleware` resolved is irrelevant
here. `BillingRepository.create` → `tenantQuery.create` only throws if `tenantId` is
falsy/empty, never if the tenant doesn't actually exist.

Combined with Finding #1, a `super_admin` token with a syntactically valid but
non-existent `tenantId` in the body will successfully create a billing record for a
tenant that isn't real — an orphaned, unrecoverable data-integrity issue (nothing will
ever list/collect it correctly, and it silently passes validation).

Note that `SubscriptionController.updateSubscription` is *accidentally* safe today only
because `SubscriptionService.updateSubscription` calls
`SubscriptionRepository.findByTenant` and 404s if nothing comes back — that's incidental
protection from Phase 9's "every tenant gets an auto-created subscription" change, not a
deliberate existence check. Billing has no equivalent.

**Fix:**
1. In `BillingService.createRecord` (or `BillingController.createRecord`), look up the
   target tenant via `TenantRepository.findById(tenantId)` first and throw
   `AppError('Target tenant not found', 404)` if missing — mirror the pattern already
   used in `TenantService.updateTenantSettings`.
2. Apply the same guard to `SubscriptionService.updateSubscription` explicitly (don't
   rely on "subscription happens to not exist" as the only signal — a tenant could
   theoretically be deleted after its subscription row, or the lazy-create fallback in
   `SubscriptionService.getSubscription` could someday paper over it).
3. Add tests: `POST /billing` and `PATCH /subscriptions` with a well-formed but
   nonexistent `tenantId` → `404`, not `201`/`200`.

---

## 🟠 3. `menu/controller.ts` skips Zod validation, violating Rule #4

**File:** `backend/src/modules/menu/controller.ts`

`PROJECT_RULES.md` Rule #4 is explicit: *"Validate every request payload with Zod
before it reaches a service function. No unvalidated `req.body` access in any
controller."* Every other module's controllers do this. `menu/controller.ts` does not,
for its product sub-document handlers:

```ts
export async function addProductHandler(req, res, next) {
  const tenantId = req.tenantId ?? req.body?.tenantId ?? '';
  const product = await service.addOrUpdateProduct(tenantId, req.body); // raw body, no Zod
  ...
}
export async function updateProductHandler(req, res, next) { ...service.updateProduct(tenantId, productId, req.body)... }
export async function deleteProductHandler(...) // fine, no body needed
```

`menu/validation.ts` already defines `productSchema` / `categorySchema` / `variantSchema`
(used only by `bulkImportSchema`) but they're never applied to the single-product
`POST /api/v1/menu/products` and `PUT /api/v1/menu/products/:id` routes. This means
`POST /api/v1/menu/products` can currently accept a payload with a missing `name`,
negative `basePrice`, malformed `imageUrl`, etc. — none of which is caught before it's
written into `MenuModel.products`.

**Fix:** Add a dedicated `singleProductSchema` (reuse `productSchema` minus the
`variants` requirement peculiarities, since bulk-import's `variantSchema` differs
slightly from `variants/validation.ts`'s `createVariantSchema`) and apply
`.parse(req.body)` in `addProductHandler` / `updateProductHandler` before calling the
service, exactly like every other controller in the repo does.

---

## 🟠 4. Two parallel "create a product" surfaces with different validation strictness, writing to the same underlying document

**Files:** `backend/src/modules/products/*`, `backend/src/modules/menu/*`,
`backend/src/modules/menu/repository.ts` (`MenuRepository.addOrUpdateProduct`)

There are two independently-routed ways to create/update a product, and both ultimately
write into the same `MenuModel.products` sub-document array via
`MenuRepository.addOrUpdateProduct`:

| Route | Validation | RBAC |
|---|---|---|
| `POST /api/v1/products` | `createProductSchema` — **requires** `categoryId` (regex-validated), requires `basePrice >= 0`, optional `variantIds[]` | `['owner','manager']` |
| `POST /api/v1/menu/products` | **none** (see Finding #3) | `['owner','manager']` |

`ProductModel` (`products/model.ts`) is a hand-rolled shim object (not a real Mongoose
model) that re-implements `findOne`/`find`/`create` by delegating to `MenuRepository` —
it exists only so `products/repository.ts` has something typed to import, and its own
`create()` method is effectively dead code (nothing calls `ProductModel.create`
directly; `ProductRepository.create` calls `menuRepo.addOrUpdateProduct` itself).

This duplication means: a client hitting `/menu/products` can create a product with no
`categoryId` and no validation at all, while a client hitting `/products` cannot — two
different sets of guarantees for what should be the same resource, and no single source
of truth for "what does a valid product look like."

**Fix (pick one, don't leave both as-is):**
- **Preferred:** Make `/api/v1/products` the only public-facing single-product CRUD
  surface; keep `/api/v1/menu/products` internal-only (or remove it) and have the
  `products` module be the one true entry point into `MenuRepository`. Delete the dead
  `ProductModel` shim once nothing needs it.
- **If both must stay** (e.g. for existing client compatibility per the Postman
  collection, which documents both under "9. Products" and "6.3"): apply the exact same
  Zod schema to both routes so their guarantees match, and add a code comment in both
  `controller.ts` files explicitly cross-referencing the other route so a future editor
  doesn't fix one and miss the other.

---

## 🟠 5. Conflicting `vercel.json` files at repo root vs. `backend/`

**Files:** `/vercel.json`, `/backend/vercel.json`

```json
// /vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/backend/api/index.ts" }] }

// /backend/vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/api/index.ts" }] }
```

These assume different deploy roots (repo root vs. `backend/` as the Vercel project
root) and are mutually exclusive — whichever one Vercel actually reads depends entirely
on which directory is configured as the project root in the Vercel dashboard, and
that's not something visible from the repo itself. If a teammate (or CI) ever points a
new Vercel project at the wrong root, it will silently 404 everything rather than fail
loudly.

**Fix:** Pick one deploy root (the existing `docs/phase-7-hostinger-golive.md` explicitly
instructs setting **Root Directory → `backend`** in Vercel's UI), delete the other
`vercel.json`, and add a one-line comment in `docs/00-project-overview.md` stating which
file is authoritative and why the other doesn't exist.

---

## 🟠 6. Two independent serverless bootstrap implementations that can drift

**Files:** `backend/api/index.ts` (`vercelHandler`), `backend/src/app.ts`
(`serverlessHandler`, default export)

Both files independently implement "connect Mongo, init Redis, init Firebase (best
effort), lazily construct the Express app, cache it in a module-level singleton" —
with **separate** `isInitialized`/`appInstance` state:

```ts
// api/index.ts
let appInstance = null; let isInitialized = false;
async function bootstrapServerless() { ... }
export default async function vercelHandler(req, res) { ... }

// app.ts
let serverlessAppInstance = null; let isServerlessInitialized = false;
export default async function serverlessHandler(req, res) { ... }
```

Given Finding #5, it's ambiguous which of these two handlers is actually the one Vercel
invokes in production. If it's `api/index.ts`, then `app.ts`'s `serverlessHandler` export
is dead code; if it's the reverse, `api/index.ts` is dead code. Either way, having two
near-identical bootstrap paths is a maintenance hazard — a fix applied to one (e.g. a
future retry-on-cold-start improvement, or an added service init step) is easy to forget
in the other.

**Fix:** Once Finding #5 picks the canonical deploy root, delete the unused handler and
have the remaining entry point be the single source of truth. If `backend/api/index.ts`
is kept (matches the documented Root Directory = `backend` setup), `app.ts` should only
export `createApp()` — drop its default `serverlessHandler` export entirely.

---

## 🟡 7. Documentation still describes the pre-Phase-10 RabbitMQ/PM2 stack

**Files:** `docs/API_ROUTES.md` (top `/ready` example still shows
`"rabbitmq": { "status": "ok" }`), `docs/POSTMAN_ENDPOINTS_GUIDE.md` (§0.1 same),
`docs/STAGING_RUNBOOK.md`, `docs/phase-5-pm2-nginx-deploy.md`,
`docs/restaurant-saas-architecture.md` (has a superseded-banner but the rest is
untouched), `README.md` (still links `ecosystem.config.js`, `backup.sh`,
`restore-drill.sh` as if they exist)

The actual code (`health.service.ts`, `env.ts`, `services/queue/*`) has fully migrated
to Upstash QStash — there is no `rabbitmq` key in the real `/ready` response anymore,
it's `qstash`. `docs/phase-10-qstash-qr-session-pm2-removal.md` §3 explicitly lists
`ecosystem.config.js`, `nginx/`, `scripts/deploy.sh`, `scripts/backup.sh`,
`scripts/restore-drill.sh`, `docs/STAGING_RUNBOOK.md`, and
`docs/phase-5-pm2-nginx-deploy.md` as files to **delete**, but per the current file set
they're still present and still cross-linked from `README.md`'s Phase 5/6 progress-log
entries.

This isn't cosmetic — an on-call engineer following `docs/runbook.md`'s "RabbitMQ
Topology Loss & Re-creation" section today would be debugging infrastructure that no
longer exists, and `docs/API_ROUTES.md`'s example response actively tells API consumers
to expect a `rabbitmq` field that will never appear.

**Fix:**
1. Update the `/ready` example JSON in `docs/API_ROUTES.md` and
   `docs/POSTMAN_ENDPOINTS_GUIDE.md` §0.1 to show `"qstash"` instead of `"rabbitmq"`.
2. Execute `docs/phase-10-qstash-qr-session-pm2-removal.md` §3.1's deletion list for
   real, or — if those files are being intentionally kept for historical reference —
   add the same "⚠️ Superseded" banner already used on
   `docs/restaurant-saas-architecture.md` to `docs/STAGING_RUNBOOK.md` and
   `docs/phase-5-pm2-nginx-deploy.md` so nobody follows them by mistake.
3. Replace `docs/runbook.md` §2.C ("RabbitMQ Topology Loss") with the QStash-schedule
   re-registration section already drafted in `docs/phase-10-...md` §3.2.

---

## 🟡 8. `CORS_ORIGIN` is read from raw `process.env`, not the validated env schema

**File:** `backend/src/app.ts`

```ts
origin: env.NODE_ENV === 'production'
  ? (process.env['CORS_ORIGIN'] ?? '').split(',')...
  : true,
```

Every other environment-specific value in the project goes through `config/env.ts`'s
`cleanEnv` validation (Rule #7: *"No hardcoded URLs, domains, or secrets anywhere in
code... everything environment-specific comes from `.env` via the validated env
schema"*). `CORS_ORIGIN` is the one exception — it's read directly, unvalidated, with a
silent empty-string fallback that would make production CORS reject every origin if the
var is simply unset, with no startup-time error to surface that misconfiguration.

**Fix:** Add `CORS_ORIGIN: str({ default: '' })` to `env.ts` and reference `env.CORS_ORIGIN`
in `app.ts`, consistent with every other config value.

---

## 🟡 9. `sendNotificationSchema` doesn't match its own documented request shape

**Files:** `backend/src/modules/notifications/validation.ts`,
`docs/POSTMAN_ENDPOINTS_GUIDE.md` §14.1

The Postman guide's example `POST /notifications/dispatch` body includes
`"tenantId"` and `"actionMakerId"` as fields the client is expected to send:

```json
{
  "tenantId": "{{tenant_id}}",
  "channel": "EMAIL",
  ...
  "actionMakerId": "{{employee_id}}"
}
```

But `sendNotificationSchema` has no `tenantId` or `actionMakerId` field (Zod's default
behavior on unknown keys with `z.object` is to strip them, not error, so this doesn't
break the request — but it does mean the documented `actionMakerId` in the request body
is silently ignored; the real `actionMakerId` comes from `req.user?.id` in the
controller). This is a doc/schema drift, not a functional bug, but it will confuse an
external integrator into thinking they can override the action-maker via the body when
they can't.

**Fix:** Update `docs/POSTMAN_ENDPOINTS_GUIDE.md` §14.1's example to drop `tenantId`
and `actionMakerId` from the request body (tenant comes from the JWT, action-maker from
`req.user`), since this route is authenticated-staff-only and doesn't need either in
body.

---

## Summary / Priority Order

1. 🔴 #1 — Fix `tenantMiddleware` to reject unresolvable impersonation targets (root cause).
2. 🔴 #2 — Add tenant-existence guard to `BillingService.createRecord` (and harden `SubscriptionService.updateSubscription` explicitly rather than relying on incidental protection).
3. 🟠 #3 — Add Zod validation to `menu/controller.ts`'s single-product handlers.
4. 🟠 #4 — Reconcile the two product-write surfaces (`/products` vs `/menu/products`).
5. 🟠 #5 / #6 — Pick one Vercel deploy root + one serverless bootstrap file; delete the other.
6. 🟡 #7 — Update stale RabbitMQ/PM2 docs or mark them superseded.
7. 🟡 #8 — Move `CORS_ORIGIN` into the validated env schema.
8. 🟡 #9 — Fix the notifications Postman example to match the real schema.

None of these are things that "many updates" broke in isolation — they're gaps that
predate this session's changes but compound with each other (e.g. #1 + #2 together are
what actually let a fake tenant get billing records). Fixing #1 first closes the most
paths at once.
