# Backend Consistency & New Features — Implementation Plan

**Audience:** Implementing AI agent (Gemini 3.6 Flash) working directly in the repo.
**Scope:** Three requested features + a critical pre-existing bug that Feature 2 depends on,
plus a note on already-known issues from `docs/PROJECT_AUDIT_AND_FIX_PLAN.md` that intersect
with this work.

Read this whole document before touching code — Section 1 is a blocking prerequisite for
Section 3 (branch auto-creation "with mongo transaction" is not actually possible today
until Section 1 is fixed).

---

## 0. Priority Order

1. **Section 1** — Fix `withTransactionOrFallback` session pass-through (blocking bug).
2. **Section 2** — QR channel → `DINE_IN` unification + conditional `tableId` requirement.
3. **Section 3** — Auto-create default `Branch` on tenant signup, atomically.
4. **Section 4** — New daily/per-table order history report endpoint.
5. **Section 5** — Test updates required by the above.
6. **Section 6** — Docs to update.
7. **Section 7** — Pointers to pre-existing audit items that should be fixed alongside this
   work because they touch the same code paths (not required, but doing them now is cheaper
   than doing them later).

---

## 1. CRITICAL: Mongo transactions are not actually atomic today

**Files:** `backend/src/utils/withTransactionOrFallback.ts`, `backend/src/modules/tenants/service.ts`,
`backend/src/modules/tenants/repository.ts`, `backend/src/modules/subscriptions/repository.ts`,
`backend/src/utils/tenantQuery.ts`

### The bug

`withTransactionOrFallback(work)` correctly opens a Mongoose session and calls
`session.withTransaction(async () => { result = await work(session); })` — it hands the
`session` to the callback. But look at how it's actually used in `TenantService.createTenant`:

```ts
const tenant = await withTransactionOrFallback(async () => {   // <-- session param ignored!
  const createdTenant = await TenantRepository.create({ ... }); // no session passed
  await SubscriptionRepository.create(createdTenant._id.toString(), { ... }); // no session passed
  return createdTenant;
});
```

`TenantRepository.create` calls `TenantModel.create(data)` with no session option.
`SubscriptionRepository.create` calls `tenantQuery.create(SubscriptionModel, tenantId, data)`,
and `tenantQuery.create` itself has **no `session` parameter at all**:

```ts
// utils/tenantQuery.ts — current signature, no session support
create<T>(model: Model<T>, tenantId: string | undefined, docData: any) {
  if (!tenantId...) throw new TenantScopeError(...);
  return model.create({ ...docData, tenantId });
}
```

**Result:** the tenant + subscription writes are NOT inside the Mongo transaction, even
though the code is visually wrapped in `withTransactionOrFallback`. If the subscription
write failed today, the tenant document would NOT be rolled back — the "atomic" claim in
`docs/00-project-overview.md` §9.3 / README Phase 9 notes is currently false. This must be
fixed before Section 3 adds a third write (Branch) to the same flow, or the new branch
creation will have the same false-atomicity problem.

### The fix

**1. `backend/src/utils/tenantQuery.ts`** — add an optional `session` to `create`:

```ts
create<T>(
  model: Model<T>,
  tenantId: string | undefined,
  docData: any,
  options?: { session?: import('mongoose').ClientSession }
) {
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new TenantScopeError('TenantId scope missing for document creation.');
  }
  if (options?.session) {
    return model
      .create([{ ...docData, tenantId }], { session: options.session })
      .then(([doc]) => doc as any);
  }
  return model.create({ ...docData, tenantId });
}
```

**2. `backend/src/modules/tenants/repository.ts`** — add optional session to `create`:

```ts
public static async create(data: Partial<ITenant>, session?: ClientSession): Promise<ITenant> {
  if (session) {
    const [doc] = await TenantModel.create([data], { session });
    return doc as ITenant;
  }
  return TenantModel.create(data);
}
```
(Import `type { ClientSession } from 'mongoose'`.)

**3. `backend/src/modules/subscriptions/repository.ts`** — thread session through:

```ts
public static async create(
  tenantId: string,
  data: Partial<ISubscription>,
  session?: ClientSession
): Promise<ISubscription> {
  return tenantQuery.create(SubscriptionModel, tenantId, data, { session });
}
```
(Import `type { ClientSession } from 'mongoose'`.)

**4. `backend/src/modules/tenants/service.ts`** — actually pass the session down (this also
sets up the pattern Section 3 will extend):

```ts
const tenant = await withTransactionOrFallback(async (session) => {
  const createdTenant = await TenantRepository.create({
    name: data.name,
    slug: data.slug.toLowerCase(),
    contact: data.contact,
    settings: data.settings ? { ...defaultSettings, ...data.settings } : defaultSettings,
    status: 'trial',
    subscriptionPlan: 'free',
  }, session);

  await SubscriptionRepository.create(createdTenant._id.toString(), {
    plan: 'free',
    status: 'trialing',
  }, session);

  return createdTenant;
});
```

Do this fix first — everything in Section 3 builds on `session` actually being honored.

---

## 2. Feature 1 — Unify QR ordering under `DINE_IN`, make `tableId` conditional

**Goal:** the QR-scan self-service order flow should create orders with `channel: 'DINE_IN'`
instead of `channel: 'QR'`. Any order with `channel === 'DINE_IN'` must have `tableId`.
Any other channel must NOT require `tableId` (it stays optional, unchanged).

### 2.1 Validation schema

**File:** `backend/src/modules/orders/validation.ts`

Add a `.refine()` to `createOrderSchema` enforcing the conditional requirement. Since
`offlineSyncSchema` wraps `createOrderSchema` per array item, the refine automatically
applies there too — no separate change needed for offline sync.

```ts
export const createOrderSchema = z.object({
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID').optional(),
  channel: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'QR', 'WEB', 'TELEGRAM']).optional().default('DINE_IN'),
  tableId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  items: z.array(/* unchanged */ ...).min(1, 'Order must contain at least one item'),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0).optional().default(0),
  totalAmount: z.number().min(0),
  offlineGuid: z.string().optional(),
  tableSessionId: z.string().uuid().optional(),
}).refine(
  (data) => (data.channel === 'DINE_IN' ? Boolean(data.tableId) : true),
  { message: 'tableId is required when channel is DINE_IN', path: ['tableId'] }
);
```

Keep `'QR'` in the enum for now (backward compatibility with any already-stored orders /
external callers that still send it) — see 2.3 for how incoming `'QR'` gets normalized.

### 2.2 Controller — force DINE_IN on the QR self-service route

**File:** `backend/src/modules/orders/controller.ts`

```ts
export async function createQrOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createOrderSchema.parse({ ...req.body, channel: 'DINE_IN' });
    // Unauthenticated public customer order — session check MUST run (skipSessionCheck defaults to false)
    const order = await service.createOrder(tenantId, validated);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}
```

Note the channel override happens **before** `.parse()` so the refine validates against the
final `'DINE_IN'` value and correctly requires `tableId`.

### 2.3 Normalize legacy `'QR'` input on the general create route

**File:** `backend/src/modules/orders/controller.ts`, `createOrderHandler`

If any client still sends `channel: 'QR'` on `POST /api/v1/orders`, normalize it to
`'DINE_IN'` before validation so the same tableId rule applies consistently:

```ts
export async function createOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const normalizedBody = req.body?.channel === 'QR' ? { ...req.body, channel: 'DINE_IN' } : req.body;
    const validated = createOrderSchema.parse(normalizedBody);
    const isStaffInitiated = Boolean(req.user);
    const order = await service.createOrder(tenantId, validated, { skipSessionCheck: isStaffInitiated });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}
```

### 2.4 Service layer — simplify channel checks

**File:** `backend/src/modules/orders/service.ts`

Both places currently branch on `dto.channel === 'DINE_IN' || dto.channel === 'QR'`.
Since `'QR'` is normalized to `'DINE_IN'` before it ever reaches the service, simplify:

```ts
// in createOrder(), replace:
if (!opts?.skipSessionCheck && (dto.channel === 'DINE_IN' || dto.channel === 'QR') && dto.tableId) {
  await this.tableService.validateTableSession(tenantId, dto.tableId, dto.tableSessionId);
}
// with:
if (!opts?.skipSessionCheck && dto.channel === 'DINE_IN' && dto.tableId) {
  await this.tableService.validateTableSession(tenantId, dto.tableId, dto.tableSessionId);
}
```

```ts
// further down in createOrder(), the table-occupation block already checks:
if (dto.tableId && (dto.channel === 'DINE_IN' || dto.channel === 'QR')) {
// simplify to:
if (dto.tableId && dto.channel === 'DINE_IN') {
```

### 2.5 Routes — no change needed

`backend/src/modules/orders/routes.ts` already has `POST /qr` wired to
`tenantMiddleware, createQrOrderHandler`. No route change required.

### 2.6 What NOT to change

- Do not make `tableId` required for `TAKEAWAY`/`DELIVERY`/`WEB`/`TELEGRAM` — those stay
  fully optional per the existing schema, unaffected by the new refine.
- Do not remove `'QR'` from the `OrderChannel` type in `orders/model.ts` or from the Zod
  enum — keep it for schema/type backward compatibility with historical documents; it's
  just never written going forward.

---

## 3. Feature 2 — Auto-create a default Branch when a tenant signs up (atomic)

**Depends on:** Section 1 being done first (real session pass-through).

**Goal:** `TenantService.createTenant` should also create one default `Branch` document for
the new tenant, in the same Mongo transaction as the Tenant + Subscription writes (or, on
standalone Mongo without replica sets, in the same non-transactional fallback sequence —
`withTransactionOrFallback` already handles that distinction transparently once session is
threaded through correctly).

### 3.1 Extend `BranchRepository.create` to accept a session

**File:** `backend/src/modules/branches/repository.ts`

```ts
import type { ClientSession } from 'mongoose';
// ...
public async create(tenantId: string, data: CreateBranchDto, session?: ClientSession): Promise<IBranch> {
  return (await tenantQuery.create(BranchModel, tenantId, data, { session })) as IBranch;
}
```
(This relies on the `tenantQuery.create` session support added in Section 1.)

### 3.2 Wire it into `TenantService.createTenant`

**File:** `backend/src/modules/tenants/service.ts`

Add the import:
```ts
import { BranchRepository } from '../branches/repository.js';
```

Extend the transaction body (continuing from the Section 1 fix):

```ts
const branchRepo = new BranchRepository();

const tenant = await withTransactionOrFallback(async (session) => {
  const createdTenant = await TenantRepository.create({
    name: data.name,
    slug: data.slug.toLowerCase(),
    contact: data.contact,
    settings: data.settings ? { ...defaultSettings, ...data.settings } : defaultSettings,
    status: 'trial',
    subscriptionPlan: 'free',
  }, session);

  await SubscriptionRepository.create(createdTenant._id.toString(), {
    plan: 'free',
    status: 'trialing',
  }, session);

  // NEW: auto-provision a default branch so a new tenant always has somewhere
  // to attach tables/products/orders without a manual extra step.
  await branchRepo.create(createdTenant._id.toString(), {
    name: `${data.name} - Main Branch`,
    slug: 'main',
    address: 'Address not set — update in branch settings',
    phone: data.contact.phone,
    isActive: true,
    tableCount: 0,
  }, session);

  return createdTenant;
});
```

### 3.3 Validation notes

- `BranchSchema` (`branches/model.ts`) requires `name`, `slug`, `address`, `phone` — all are
  satisfied by the payload above. `address` min length in `createBranchSchema` Zod schema is
  5 chars — `'Address not set — update in branch settings'` clears that; if you use a
  shorter placeholder, keep it ≥ 5 chars.
- The `{ tenantId, slug }` unique compound index on `BranchModel` is safe here because this
  is always the *first* branch for a brand-new tenant — `'main'` cannot collide within that
  tenant's scope.
- Do **not** go through `BranchService.createBranch` for this — that method doesn't accept
  a session and duplicates none of the transaction logic we need. Call `BranchRepository`
  directly from `TenantService`, matching how `SubscriptionRepository` is already called
  directly (cross-module repository calls at the orchestration layer are the existing
  pattern here; see `PROJECT_RULES.md` Rule #12 — this is fine because it's plain data
  provisioning, not business-logic coupling that belongs on the event bus).

### 3.4 Optional (not required, note only)

If useful later, emit a `branch.created` domain event via `eventBus` for auto-seeding
workers (menu templates, demo tables) to hook into — `DomainEventPayloads` in
`shared/events/index.ts` would need a new entry. Not required for this task; skip unless
asked.

---

## 4. Feature 3 — Daily order history, grouped by table

**Goal:** a new `GET` endpoint returning order history bucketed by day, and within each day,
bucketed by table — for a branch (or whole tenant) over a date range.

### 4.1 Where it lives

Add to the existing **reports** module (`backend/src/modules/reports/`) rather than the
tables module — this is cross-table aggregation/reporting, which is what `reports/` is for
(`ReportService`, `ReportRepository` already exist there), and keeps `tables/service.ts`
focused on single-table concerns.

### 4.2 Validation schema

**File:** `backend/src/modules/reports/validation.ts`

```ts
export const ordersByTableDailyQuerySchema = z.object({
  branchId: objectIdSchema.optional(),
  startDate: z.string().datetime({ message: 'Must be a valid ISO datetime' }).optional(),
  endDate: z.string().datetime({ message: 'Must be a valid ISO datetime' }).optional(),
});
export type OrdersByTableDailyQuery = z.infer<typeof ordersByTableDailyQuerySchema>;
```

### 4.3 Service — aggregation

**File:** `backend/src/modules/reports/service.ts`

Add a new method to `ReportService`. Uses `tenantQuery.aggregate` (already tenant-scoped by
that helper) grouped by day + table, then a `$lookup` against `tables` to attach the table
number so the response is human-usable without a second round trip.

```ts
export interface DailyTableOrdersBucket {
  date: string;               // 'YYYY-MM-DD'
  tables: Array<{
    tableId: string | null;   // null bucket = orders with no table (takeaway/delivery/etc.)
    tableNumber: number | null;
    orderCount: number;
    totalRevenue: number;     // sum of totalAmount for PAID orders only
  }>;
}

public async getOrdersHistoryByTable(
  tenantId: string,
  branchId?: string,
  startDate?: Date,
  endDate?: Date
): Promise<{ tenantId: string; branchId?: string; days: DailyTableOrdersBucket[] }> {
  const pipeline: PipelineStage[] = [];

  const matchStage: Record<string, unknown> = {};
  if (branchId) matchStage['branchId'] = Types.ObjectId.isValid(branchId) ? new Types.ObjectId(branchId) : branchId;
  if (startDate || endDate) {
    matchStage['createdAt'] = {
      ...(startDate ? { $gte: startDate } : {}),
      ...(endDate ? { $lte: endDate } : {}),
    };
  }
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  pipeline.push({
    $group: {
      _id: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        tableId: '$tableId',
      },
      orderCount: { $sum: 1 },
      totalRevenue: {
        $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$totalAmount', 0] },
      },
    },
  });
  pipeline.push({ $sort: { '_id.date': -1 } });

  const rows = await tenantQuery.aggregate<{
    _id: { date: string; tableId: Types.ObjectId | null };
    orderCount: number;
    totalRevenue: number;
  }>(OrderModel, tenantId, pipeline).exec();

  // Resolve table numbers in one pass (avoids N+1 lookups)
  const tableIds = [...new Set(rows.map((r) => r._id.tableId?.toString()).filter(Boolean))] as string[];
  const tables = tableIds.length > 0
    ? await tenantQuery.find(TableModel, tenantId, { _id: { $in: tableIds } }).exec()
    : [];
  const tableNumberById = new Map(tables.map((t) => [t._id.toString(), t.number]));

  const byDate = new Map<string, DailyTableOrdersBucket['tables']>();
  for (const row of rows) {
    const date = row._id.date;
    const tableIdStr = row._id.tableId ? row._id.tableId.toString() : null;
    const bucket = byDate.get(date) ?? [];
    bucket.push({
      tableId: tableIdStr,
      tableNumber: tableIdStr ? (tableNumberById.get(tableIdStr) ?? null) : null,
      orderCount: row.orderCount,
      totalRevenue: row.totalRevenue,
    });
    byDate.set(date, bucket);
  }

  const days: DailyTableOrdersBucket[] = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, tables]) => ({ date, tables }));

  return { tenantId, ...(branchId ? { branchId } : {}), days };
}
```

Add imports at the top of `reports/service.ts`: `import { TableModel } from '../tables/model.js';`
(`Types` and `PipelineStage` are already imported there.)

### 4.4 Controller

**File:** `backend/src/modules/reports/controller.ts`

```ts
export async function getOrdersHistoryByTableHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = ordersByTableDailyQuerySchema.parse(req.query);
    const startDate = validated.startDate ? new Date(validated.startDate) : undefined;
    const endDate = validated.endDate ? new Date(validated.endDate) : undefined;
    const result = await service.getOrdersHistoryByTable(tenantId, validated.branchId, startDate, endDate);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
```
(Import `ordersByTableDailyQuerySchema` from `./validation.js`.)

### 4.5 Route

**File:** `backend/src/modules/reports/routes.ts`

```ts
router.get('/orders-by-table', getOrdersHistoryByTableHandler);
```
Placed inside the existing `router.use(authMiddleware, tenantMiddleware, rbacMiddleware(['owner', 'manager']))`
block, alongside the existing `/sales` route — same auth/RBAC as the rest of the reports
module (staff-only, no new public surface).

Full route becomes: `GET /api/v1/reports/orders-by-table?branchId=&startDate=&endDate=`

### 4.6 Example response

```json
{
  "success": true,
  "data": {
    "tenantId": "6a6b3e8447dedf5d12fef0c5",
    "branchId": "6a6b3e8447dedf5d12fef0c4",
    "days": [
      {
        "date": "2026-08-04",
        "tables": [
          { "tableId": "6a6b3e8447dedf5d12fef0c0", "tableNumber": 10, "orderCount": 5, "totalRevenue": 2150 },
          { "tableId": null, "tableNumber": null, "orderCount": 2, "totalRevenue": 640 }
        ]
      },
      {
        "date": "2026-08-03",
        "tables": [
          { "tableId": "6a6b3e8447dedf5d12fef0c0", "tableNumber": 10, "orderCount": 3, "totalRevenue": 900 }
        ]
      }
    ]
  }
}
```

---

## 5. Tests to add / update

### 5.1 New tests

- `backend/tests/integration/reports.test.ts` (new, or extend an existing reports test if
  one is added later): seed a branch, a table, several orders across two different dates
  (backdate `createdAt` for the older one) and two different tables (including one with no
  `tableId`), call `GET /api/v1/reports/orders-by-table`, assert correct day/table grouping,
  correct `orderCount`/`totalRevenue` (only `PAID` orders count toward revenue), and a
  cross-tenant isolation check per `PROJECT_RULES.md` Rule #9.
- Tenant creation now also creates a Branch: extend the existing Phase 9 atomic-provisioning
  tests (`backend/tests/integration/phase9.test.ts`, describe block "9.3 — Atomic Tenant
  Provisioning") with an assertion that exactly one `Branch` document exists for the new
  tenant immediately after `POST /api/v1/tenants`, with `slug: 'main'`.
- `createOrderSchema` refine: unit/integration test that `POST /api/v1/orders` (or
  `/orders/qr`) with `channel: 'DINE_IN'` and no `tableId` → `400` validation error; with
  `channel: 'TAKEAWAY'` and no `tableId` → succeeds.

### 5.2 Existing tests that must be updated

- **`backend/tests/integration/tables-qr-session.test.ts`** — tests 5, 6, and 9 currently
  create orders with `channel: 'QR'` (and test 5 expects a rejection with no session, test 6
  expects success with a valid session, test 9 expects rejection with an invalid session).
  Update all three to use `channel: 'DINE_IN'` instead — the session-validation behavior
  described in those tests is unchanged, only the channel literal changes. Test 7 already
  uses `'DINE_IN'` with `skipSessionCheck: true` and needs no change. Test 11 doesn't set an
  order channel, no change needed.
- Any other test file that creates an order with `channel: 'QR'` and no `tableId` (grep the
  test suite for `channel: 'QR'` and `channel: "QR"` to be sure none remain) — add a
  `tableId` or switch to a non-DINE_IN channel as appropriate for what the test is actually
  checking.
- `backend/tests/integration/phase3-domain.test.ts` and `phase9.test.ts` order-creation
  calls that use `channel: 'DINE_IN'` already include `tableId` — no change expected, but
  worth a quick grep-confirm after the refine lands, since a previously-passing test with
  `DINE_IN` and no `tableId` would now correctly start failing (which would mean the test
  itself was masking a gap — fix the test to include a `tableId`, don't loosen the schema).

---

## 6. Docs to update

- `docs/API_ROUTES.md` and `docs/POSTMAN_ENDPOINTS_GUIDE.md`:
  - Add `GET /api/v1/reports/orders-by-table` (Auth: `owner`, `manager`) with the query
    params and example response from Section 4.6.
  - Note on `POST /api/v1/orders` / `POST /api/v1/orders/qr`: `tableId` is now **required**
    when `channel` is `DINE_IN` (default channel), optional otherwise. QR self-service
    orders are always created with `channel: 'DINE_IN'` (previously `'QR'`).
  - Note in the Tenants section that `POST /api/v1/tenants` now also provisions a default
    `Branch` (`slug: 'main'`) atomically alongside the tenant and its free-tier subscription.
- `README.md` Progress Log — add a new dated entry once implemented, per the project's own
  documented protocol in `docs/PROJECT_RULES.md` §4 (don't skip this — it's how every prior
  phase in this repo has been tracked).
- `docs/phase-10-qstash-qr-session-pm2-removal.md` §2 describes the QR/`channel: 'QR'`
  design — add a short "Note: superseded" callout pointing at this change (channel is now
  `DINE_IN`, not `QR`; the session-fraud-prevention mechanics themselves are unchanged).

---

## 7. Pre-existing issues worth fixing alongside this work

These are from `docs/PROJECT_AUDIT_AND_FIX_PLAN.md` (already documented, not new findings)
but they sit directly in the code paths this task touches, so fixing them now is cheaper
than doing a second pass later. Not blocking, but strongly recommended in the same PR:

- **Audit #1** — `tenantMiddleware` silently falls through instead of rejecting when a
  `super_admin` targets a non-existent tenant. Directly relevant here because Section 3 adds
  a third document write keyed off tenant creation — if tenant resolution itself is silently
  wrong elsewhere in the app, branch auto-provisioning inherits that risk.
- **Audit #2** — `BillingService.createRecord` and (partially) `SubscriptionService.updateSubscription`
  don't verify the target tenant exists before writing. Same family of bug as the
  transaction issue fixed in Section 1 — worth reviewing together since you'll already be in
  `tenants/service.ts` and its repository neighbors.
- **Audit #8** — `CORS_ORIGIN` bypasses the validated env schema (`config/env.ts`). Small,
  unrelated to this feature set, but trivial to fix while in this area of the codebase.

Do not silently "fix" these as a side effect without calling them out in the PR description —
they're separate concerns from the three requested features and should be reviewable as
such, even if delivered in the same change set.
