# Phase 10 — Serverless Queue Migration (QStash), QR Session Fraud Prevention & PM2 Removal

**Prerequisite:** Phase 9 complete (RBAC fixes, body-based tenant context, reservations, QR JWT baseline, notification audit log).
**Reference:** `00-project-overview.md` §1 (interface-layer principle), `PROJECT_RULES.md` Rule #2 (never call infra SDKs directly from `modules/`), Rule #8 (background jobs go through `QueueService`).

This phase does three things, in order, because #2 and #3 depend on #1 being stable:

1. Replace RabbitMQ/CloudAMQP with Upstash QStash as the `IQueueService` implementation, and convert every `workers/*.worker.ts` consumer loop into a Vercel API route.
2. Close the QR replay fraud hole with a Redis-backed, short-lived table session layered on top of the permanent signed QR JWT.
3. Delete PM2 as a runtime concept from the repo now that nothing needs a long-running consumer process.

---

## 0. Why this order

- QStash migration must land first: workers currently run as PM2 `fork` processes calling `queueService.consume()`. On Vercel there is no long-running process, so this is not optional cleanup — it's a correctness fix for a codebase that's already deployed to Vercel (`backend/api/index.ts`, `backend/vercel.json`) but still ships `ecosystem.config.js` and worker files that will never actually run there today.
- QR session work is independent of the queue swap but reuses `CacheService` (already Redis/Upstash), so it slots in cleanly once queue mechanics aren't a moving target.
- PM2 removal is last and purely subtractive — only safe once nothing references `pm2`, `ecosystem.config.js`, or the `consume()`-loop worker files.

---

## 1. Swap RabbitMQ → Upstash QStash

### 1.1 Package changes

**File: `backend/package.json`**
- Remove: `amqplib`, `@types/amqplib`
- Add: `@upstash/qstash`

```bash
npm uninstall amqplib @types/amqplib
npm install @upstash/qstash
```

### 1.2 Env schema

**File: `backend/src/config/env.ts`**
- Remove `RABBITMQ_URL: url()`.
- Add:
```ts
// ─── QStash (Upstash serverless queue) ───────────────────────────────────
QSTASH_TOKEN: str(),
QSTASH_CURRENT_SIGNING_KEY: str(),
QSTASH_NEXT_SIGNING_KEY: str(),
// Base URL QStash uses to call back into this deployment (e.g. https://api.yourapp.com)
PUBLIC_API_BASE_URL: url(),
```

### 1.3 New QStash client config

**File: `backend/src/config/qstash.ts`** (new, replaces `config/rabbitmq.ts`)

```ts
import { Client } from '@upstash/qstash';
import env from './env.js';
import logger from '../utils/logger.js';

let _client: Client | null = null;

/**
 * Upstash QStash client — HTTP-based, push-driven queue.
 *
 * Unlike RabbitMQ, there is no persistent connection or channel to manage.
 * QStash calls back into a Vercel API route (POST /api/v1/jobs/:queueName)
 * as an HTTP webhook when a job is due, with signed headers verified by
 * qstashVerifyMiddleware (see middleware/qstash.middleware.ts).
 *
 * Business logic must never import this directly — it must go through
 * QueueService (services/queue/qstash-queue.service.ts).
 */
export function getQStashClient(): Client {
  if (_client) return _client;
  _client = new Client({ token: env.QSTASH_TOKEN });
  logger.info('Upstash QStash client initialized');
  return _client;
}
```

Delete `backend/src/config/rabbitmq.ts`.

### 1.4 New QueueService implementation

**File: `backend/src/services/queue/qstash-queue.service.ts`** (new, replaces `rabbitmq-queue.service.ts`)

```ts
import type { IQueueService, EnqueueOptions, MessageHandler } from './queue.interface.js';
import { PLATFORM_QUEUES } from './queue-definitions.js';
import { getQStashClient } from '../../config/qstash.js';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * QStash-backed QueueService.
 *
 * "Queues" here map to job routes: q.emails -> POST /api/v1/jobs/emails.
 * assertQueues() is a no-op — QStash has no exchange/queue topology to
 * declare; the destination URL IS the queue.
 * consume() is intentionally unsupported — see JOB_ROUTES.md. Workers become
 * Vercel API routes that QStash calls directly.
 */
export class QStashQueueService implements IQueueService {
  private get client() {
    return getQStashClient();
  }

  public async assertQueues(): Promise<void> {
    // No-op by design: QStash has no server-side topology to declare.
    logger.info('QStash: topology assertion skipped (push-based queue, no exchanges/queues to declare)');
  }

  public async enqueue<T = Record<string, unknown>>(
    queueName: string,
    payload: T,
    options?: EnqueueOptions
  ): Promise<boolean> {
    const def = Object.values(PLATFORM_QUEUES).find((q) => q.name === queueName);
    const routeSlug = def?.jobRoute ?? queueName.replace(/^q\./, '');
    const destinationUrl = `${env.PUBLIC_API_BASE_URL}/api/v1/jobs/${routeSlug}`;

    try {
      const headers: Record<string, string> = {};
      if (options?.tenantId) headers['x-tenant-id'] = options.tenantId;

      await this.client.publishJSON({
        url: destinationUrl,
        body: payload,
        headers,
        retries: def?.maxRetries ?? 3,
        ...(options?.delayMs ? { delay: Math.ceil(options.delayMs / 1000) } : {}),
        // Dead-letter behavior: QStash auto-routes exhausted-retry messages to
        // the Upstash Console DLQ view; no separate DLQ URL needed.
      });
      return true;
    } catch (err) {
      logger.error({ queueName, destinationUrl, err }, 'QStash publish failed');
      return false;
    }
  }

  public async consume<T = Record<string, unknown>>(
    _queueName: string,
    _handler: MessageHandler<T>
  ): Promise<void> {
    throw new Error(
      'QStashQueueService.consume() is not supported. QStash is push-based: ' +
        'implement the job as a Vercel API route under src/jobs/ instead. See JOB_ROUTES.md.'
    );
  }
}
```

### 1.5 Queue definitions gain a `jobRoute`

**File: `backend/src/services/queue/queue-definitions.ts`**
Add a `jobRoute: string` field to `QueueDefinition` and to every entry (drop `exchange`, `routingKey`, `dlqName`, `dlxExchange` — QStash doesn't use them):

```ts
export interface QueueDefinition {
  name: string;        // logical name, unchanged for call-site compatibility (e.g. 'q.emails')
  jobRoute: string;     // URL slug QStash calls: /api/v1/jobs/{jobRoute}
  maxRetries: number;
  messageTtlSeconds: number; // informational only now; QStash doesn't expire jobs by TTL the same way
}
```

Update each entry, e.g.:
```ts
EMAILS: { name: 'q.emails', jobRoute: 'emails', maxRetries: 3, messageTtlSeconds: 86400 },
TELEGRAM: { name: 'q.telegram', jobRoute: 'telegram', maxRetries: 3, messageTtlSeconds: 86400 },
INVOICES: { name: 'q.invoices', jobRoute: 'invoices', maxRetries: 5, messageTtlSeconds: 86400 * 7 },
SUBSCRIPTION_CHECKS: { name: 'q.subscription-checks', jobRoute: 'subscription-checks', maxRetries: 3, messageTtlSeconds: 86400 },
PAYMENT_RETRIES: { name: 'q.payment-retries', jobRoute: 'payment-retries', maxRetries: 3, messageTtlSeconds: 86400 * 3 },
REPORTS: { name: 'q.reports', jobRoute: 'reports', maxRetries: 2, messageTtlSeconds: 3600 },
BACKUPS: { name: 'q.backups', jobRoute: 'backups', maxRetries: 2, messageTtlSeconds: 86400 },
FIRESTORE_RETRY: { name: 'q.firestore-retry', jobRoute: 'firestore-retry', maxRetries: 5, messageTtlSeconds: 86400 },
TABLE_HISTORY_CLEANUP: { name: 'q.table-history-cleanup', jobRoute: 'table-history-cleanup', maxRetries: 2, messageTtlSeconds: 86400 },
```

### 1.6 Queue service barrel

**File: `backend/src/services/queue/index.ts`**
```ts
import type { IQueueService } from './queue.interface.js';
import { QStashQueueService } from './qstash-queue.service.js';
import { MemoryQueueService } from './memory-queue.service.js';
import env from '../../config/env.js';

export * from './queue.interface.js';
export * from './queue-definitions.js';
export * from './qstash-queue.service.js';
export * from './memory-queue.service.js';

let queueInstance: IQueueService;

if (env.NODE_ENV === 'test') {
  queueInstance = new MemoryQueueService();
} else {
  queueInstance = new QStashQueueService();
}

export const queueService: IQueueService = queueInstance;
```
`MemoryQueueService` is unchanged — tests keep working exactly as before (Rule: unit tests must not require real infra).

### 1.7 Signature verification middleware

**File: `backend/src/middleware/qstash.middleware.ts`** (new)

```ts
import { Receiver } from '@upstash/qstash';
import type { Request, Response, NextFunction } from 'express';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const receiver = new Receiver({
  currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

/**
 * Verifies the Upstash-Signature header on incoming QStash job callbacks.
 * Mandatory on every /api/v1/jobs/* route — mirrors Rule #5 (webhook signature
 * verification) already applied to Paymob.
 * Requires the raw request body — mount express.raw() ahead of express.json()
 * for this route prefix (see app.ts §1.9).
 */
export async function qstashVerifyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const signature = req.headers['upstash-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(401).json({ success: false, message: 'Missing QStash signature' });
      return;
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      res.status(500).json({ success: false, message: 'Raw body not captured for signature verification' });
      return;
    }

    const isValid = await receiver.verify({
      signature,
      body: rawBody.toString(),
    });

    if (!isValid) {
      logger.warn({ url: req.originalUrl }, 'QStash signature verification failed — rejecting');
      res.status(401).json({ success: false, message: 'Invalid QStash signature' });
      return;
    }

    // Body was raw; parse it now that signature is verified
    req.body = JSON.parse(rawBody.toString() || '{}');
    next();
  } catch (err) {
    logger.error({ err }, 'QStash signature verification error');
    res.status(401).json({ success: false, message: 'Signature verification failed' });
  }
}
```

### 1.8 Job routes replace worker consumer loops

Each `workers/*.worker.ts` currently does two things: (a) a pure `processXJob()` handler function, (b) a `startXWorker()` that calls `queueService.consume()`. **Keep (a) verbatim — it's already decoupled business logic.** Delete (b) and add a thin Express route that QStash calls instead.

**File: `backend/src/jobs/index.ts`** (new — router mounted at `/api/v1/jobs`)

```ts
import { Router } from 'express';
import { qstashVerifyMiddleware } from '../middleware/qstash.middleware.js';
import { processEmailJob } from '../workers/email.worker.js';
import { processTelegramJob } from '../workers/telegram.worker.js';
import { processInvoiceJob } from '../workers/invoice.worker.js';
import { processSubscriptionCheckJob } from '../workers/subscription-check.worker.js';
import { processPaymentRetryJob } from '../workers/payment-retry.worker.js';
import { processBackupJob } from '../workers/backup.worker.js';
import { processFirestoreRetryJob } from '../workers/firestore-retry.worker.js';
import { handleTableHistoryCleanup } from '../workers/table-history-cleanup.worker.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(qstashVerifyMiddleware);

function jobRoute<T>(name: string, handler: (payload: T, headers?: Record<string, unknown>) => Promise<void>) {
  router.post(`/${name}`, async (req, res) => {
    try {
      await handler(req.body as T, req.headers as Record<string, unknown>);
      res.status(200).json({ success: true });
    } catch (err) {
      logger.error({ err, job: name }, 'Job handler threw — QStash will retry per maxRetries');
      // Non-2xx tells QStash to retry according to the queue's retry policy
      res.status(500).json({ success: false });
    }
  });
}

jobRoute('emails', processEmailJob);
jobRoute('telegram', processTelegramJob);
jobRoute('invoices', processInvoiceJob);
jobRoute('subscription-checks', processSubscriptionCheckJob);
jobRoute('payment-retries', processPaymentRetryJob);
jobRoute('backups', processBackupJob);
jobRoute('firestore-retry', processFirestoreRetryJob);
jobRoute('table-history-cleanup', (payload: { cutoffDate: string }) => handleTableHistoryCleanup(payload));

export default router;
```

**File: `backend/src/workers/*.worker.ts`** — for each of the 8 files, delete the `startXWorker()` function and the trailing `if (process.env['NODE_ENV'] !== 'test') { startXWorker() }` block. Keep only the exported `processXJob` / `handleX` function and its types. Example diff shape for `email.worker.ts`:

```diff
- export async function startEmailWorker(): Promise<void> {
-   try {
-     await connectDatabase();
-     await queueService.assertQueues();
-     logger.info(`Starting internal email queue consumer listening on: ${PLATFORM_QUEUES.EMAILS.name}`);
-     await queueService.consume<EmailJobPayload>(PLATFORM_QUEUES.EMAILS.name, async (payload, headers) => {
-       await processEmailJob(payload, headers);
-     });
-   } catch (error) {
-     logger.error({ error }, 'Error initializing Email Queue Consumer');
-   }
- }
-
- if (process.env['NODE_ENV'] !== 'test' && process.env['START_WORKERS_STANDALONE'] === 'true') {
-   startEmailWorker().catch(() => {});
- }
```
Apply the equivalent removal to: `telegram.worker.ts`, `invoice.worker.ts`, `subscription-check.worker.ts`, `payment-retry.worker.ts`, `backup.worker.ts`, `firestore-retry.worker.ts`.

**File: `backend/src/workers/table-history-cleanup.worker.ts`** — replace the `node-cron` schedule with a QStash **scheduled** publish (cron-style) since there's no long-running process to host `cron.schedule()` anymore:

```ts
// Remove processTableHistoryCleanupJob()'s cron.schedule() call entirely.
// Replace with a one-time setup script (see 1.9) that registers a QStash Schedule
// hitting POST /api/v1/jobs/table-history-cleanup on '0 3 1 * *'.
// Keep handleTableHistoryCleanup() unchanged — it's the actual job body.
```

### 1.9 Cron-style jobs → QStash Schedules

RabbitMQ + `node-cron` handled two recurring jobs: daily backup trigger (`backup.worker.ts`, `0 2 * * *`) and monthly table-history purge (`0 3 1 * *`). Neither `node-cron` survives on Vercel (no long-lived process to hold the timer). Replace both with **QStash Schedules**, created once via a setup script and calling the same job routes from §1.8.

**File: `backend/scripts/setup-qstash-schedules.ts`** (new)

```ts
import { Client } from '@upstash/qstash';
import env from '../src/config/env.js';

async function main() {
  const client = new Client({ token: env.QSTASH_TOKEN });

  await client.schedules.create({
    destination: `${env.PUBLIC_API_BASE_URL}/api/v1/jobs/backups`,
    cron: '0 2 * * *',
    body: JSON.stringify({ backupType: 'daily' }),
  });

  await client.schedules.create({
    destination: `${env.PUBLIC_API_BASE_URL}/api/v1/jobs/table-history-cleanup`,
    cron: '0 3 1 * *',
  });

  console.log('QStash schedules registered: daily backup (0 2 * * *), monthly table-history purge (0 3 1 * *)');
}

main().catch((err) => {
  console.error('Failed to register QStash schedules:', err);
  process.exit(1);
});
```

Add to `backend/package.json` scripts:
```json
"setup:qstash-schedules": "cross-env DOTENV_CONFIG_PATH=.env tsx -r dotenv/config scripts/setup-qstash-schedules.ts"
```
Run once per environment (local verification, staging, production) — idempotency note: re-running creates duplicate schedules, so check the Upstash Console before re-running, or extend the script to list-then-skip-if-exists.

### 1.10 App wiring changes

**File: `backend/src/app.ts`**
- Import and mount the new jobs router. Because `qstashVerifyMiddleware` needs the *raw* body, mount a raw-body capture **before** the global `express.json()` for this one route prefix only (same pattern flagged as a bug for n8n in the Phase 4/5/6 audit — don't repeat that mistake here):

```ts
import jobsRoutes from './jobs/index.js';

// ...after helmet/cors, BEFORE the global express.json() line...
app.use(
  '/api/v1/jobs',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => { (req as any).rawBody = req.body; next(); },
);

// ...existing express.json() for all other routes stays as-is; Express only
// applies body parsers to routes that haven't already consumed the body...

app.use('/api/v1/jobs', jobsRoutes);
```
- Remove the `emails` worker auto-start block from `backend/src/server.ts` (see §1.11) — jobs are no longer started in-process.

### 1.11 Server bootstrap changes

**File: `backend/src/server.ts`**
Remove entirely:
```ts
await getRabbitMQChannel();
if (env.NODE_ENV !== 'test') {
  try {
    const { queueService } = await import('./services/queue/index.js');
    await queueService.assertQueues();
    const { startEmailWorker } = await import('./workers/email.worker.js');
    await startEmailWorker();
    ...
  } catch (err) { ... }
}
```
And the corresponding `disconnectRabbitMQ()` call in the shutdown sequence. `server.ts` is retained only for local `npm run dev` convenience (Express dev server) — no queue bootstrap needed since QStash calls the deployed URL directly, not `localhost` (see §1.13 for local testing).

**File: `backend/api/index.ts`** — remove any RabbitMQ-related init if present (currently only Mongo/Redis/Firebase — no change needed here, confirm no residual import).

### 1.12 Health service changes

**File: `backend/src/health/health.service.ts`**
Replace the RabbitMQ channel check with a QStash reachability check (list schedules as a lightweight ping):

```ts
// 3. QStash Check (replaces RabbitMQ check)
try {
  const qstashStart = Date.now();
  const client = getQStashClient();
  await client.schedules.list(); // lightweight authenticated call
  services['qstash'] = { status: 'ok', latencyMs: Date.now() - qstashStart };
} catch (err: any) {
  services['qstash'] = { status: 'degraded', error: err?.message || 'QStash check failed' };
}
```
Update `requiredServices` list in `backend/tests/unit/health.test.ts` from `['mongodb', 'redis', 'rabbitmq', 'firebase']` to `['mongodb', 'redis', 'qstash', 'firebase']`.

### 1.13 Local development story

QStash calls a **public** URL, so `localhost:3000/api/v1/jobs/*` isn't directly reachable during local dev. Document and use the Upstash-provided local dev bridge:

**File: `docs/runbook.md`** — add a "Local QStash Development" subsection:
```markdown
### Local QStash Development
QStash publishes to a public destination URL, so local development requires either:
1. `npx @upstash/qstash-cli dev` (local emulator that runs jobs synchronously, no signing needed), or
2. A tunnel (`ngrok http 3000`) with `PUBLIC_API_BASE_URL` pointed at the tunnel URL for full
   signature-verified end-to-end testing against real Upstash QStash.
Recommended: use the CLI emulator for day-to-day dev, and the ngrok path once before any deploy
touching job routes, to confirm signature verification actually passes.
```

### 1.14 Files to delete

- `backend/src/config/rabbitmq.ts`
- `backend/src/services/queue/rabbitmq-queue.service.ts`
- `infra/rabbitmq/definitions.json`
- `infra/rabbitmq/` directory (if now empty)

### 1.15 Files/references to update (search-and-fix)

- `backend/tests/integration/services.test.ts` — replace the `RabbitMQQueueService` describe block (`'2. Queue Service & DLQ Architecture'`) with a `QStashQueueService` equivalent: call `enqueue()` against a real QStash token in a test environment and assert `true`/`false` return, since there's no `assertQueues()`/channel to inspect anymore. Keep the `MemoryQueueService` sub-tests unchanged.
- `backend/tests/integration/phase4.test.ts` — the `'executes background queue consumers reliably with MemoryQueueService'` test is unaffected (it exercises `MemoryQueueService`, not the real implementation) — **no change needed** there, but double check no stray `import { RabbitMQQueueService }` remains anywhere.
- `docs/00-project-overview.md` §1 (tech stack table) — change the "Background jobs" row from `QueueService interface → RabbitMQ implementation` to `QueueService interface → Upstash QStash implementation (push-based, no worker processes)`.
- `docs/00-project-overview.md` §2 (project structure) — remove `config/rabbitmq.ts`, `services/queue/rabbitmq-queue.service.ts`; add `config/qstash.ts`, `services/queue/qstash-queue.service.ts`, `src/jobs/`, `middleware/qstash.middleware.ts`.
- `docs/phase-2-service-interfaces.md`, `docs/phase-4-integrations-workers.md` — add a note at the top: "Superseded by Phase 10 for the QueueService implementation (RabbitMQ → QStash); the interface itself (`IQueueService`) is unchanged."
- `docs/runbook.md` §2.C ("RabbitMQ Topology Loss & Re-creation") — replace with a "QStash Schedule/Destination Loss" section: re-run `npm run setup:qstash-schedules`; job routes themselves need no re-registration since QStash calls them directly by URL, not by pre-declared topology.
- `docs/STAGING_RUNBOOK.md` — remove CloudAMQP references from §1 and the verification checklist table; add `QSTASH_TOKEN` / `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` / `PUBLIC_API_BASE_URL` to the managed-infra list, and add a checklist row: "QStash job route reachable — `curl -X POST https://api.your-domain/api/v1/jobs/emails` returns 401 (expected — unsigned request rejected), confirming route is live and signature verification is active."
- `README.md` — append a new Progress Log entry once implemented (see §4 Documentation Checklist below — do not backfill, write it when the work actually lands).
- `.env.production` template / `.env.local` — remove `RABBITMQ_URL`; add the four new QStash/base-URL vars.

### 1.16 Test plan — §1

| # | Test | File | Assertion |
|---|---|---|---|
| 1 | `QStashQueueService.enqueue` happy path | `tests/integration/services.test.ts` | Returns `true` for a valid job route + payload |
| 2 | `QStashQueueService.enqueue` unreachable/misconfigured token | same | Returns `false`, does not throw |
| 3 | `QStashQueueService.consume` throws | new unit test `tests/unit/qstash-queue.test.ts` | Calling `.consume()` rejects with the documented error message |
| 4 | `qstashVerifyMiddleware` rejects missing signature | `tests/unit/qstash-middleware.test.ts` (new) | 401, no handler invoked |
| 5 | `qstashVerifyMiddleware` rejects tampered body | same | 401 |
| 6 | `qstashVerifyMiddleware` accepts valid signature | same (use `Receiver` test helper / mock) | 200, `req.body` parsed correctly |
| 7 | Each job route (`/api/v1/jobs/emails`, `/telegram`, `/invoices`, `/subscription-checks`, `/payment-retries`, `/backups`, `/firestore-retry`, `/table-history-cleanup`) | `tests/integration/jobs.test.ts` (new) | Valid signed payload → 200 + handler side-effect verified (e.g. email job logs simulated send in test mode) |
| 8 | `/ready` reports `qstash` service key, not `rabbitmq` | `tests/unit/health.test.ts` (update existing) | `requiredServices` includes `qstash`; status ok/degraded logic unchanged |
| 9 | Table-history cleanup schedule triggers purge correctly | `tests/integration/jobs.test.ts` | Orders >30 days old deleted, `totalOrdersServed` untouched (mirrors existing Phase 9 intent, now via job route instead of cron) |

---

## 2. QR Session-Based Fraud Prevention

### 2.1 Cache key convention

`table_session:{tenantId}:{tableId}` → `{ sessionId: string, tenantId: string, branchId: string, startedAt: number }`, TTL 90 minutes (`SESSION_TTL_SECONDS = 90 * 60`). Namespacing by `tenantId` in the key (not just `tableId`) closes a theoretical cross-tenant key collision if two tenants ever reuse the same Mongo ObjectId space pattern — cheap insurance, consistent with Rule #1's spirit even though this is Redis, not Mongo.

### 2.2 Service layer changes

**File: `backend/src/modules/tables/service.ts`**

Add import: `import { cacheService } from '../../services/cache/index.js';`
Add constant: `const SESSION_TTL_SECONDS = 90 * 60;`

Modify `resolveByQrToken` to open a session after successful tenant-scoped lookup:

```ts
public async resolveByQrToken(token: string): Promise<ITable & { tenantId: string; branchId: string; sessionId: string }> {
  let payload: any;
  try {
    payload = jwt.verify(token, env.QR_TOKEN_SECRET);
  } catch {
    throw new AppError('Invalid QR code token', 404);
  }

  const { tenantId, branchId, tableId } = payload;
  if (!tenantId || !branchId || !tableId) {
    throw new AppError('Invalid QR code token', 404);
  }

  const table = await tenantQuery.findOne(TableModel, tenantId, { _id: tableId, branchId });
  if (!table) {
    throw new AppError('Invalid QR code token', 404);
  }

  const sessionKey = `table_session:${tenantId}:${tableId}`;

  // One active session per table: reject a second check-in while a session is
  // already open and the table isn't free, so two phones can't both "own" it.
  const existingSession = await cacheService.get<{ sessionId: string }>(sessionKey);
  if (existingSession && table.status === 'OCCUPIED') {
    // Table is mid-visit under a different session — do not silently reissue;
    // return the existing session instead of minting a competing one.
    return { ...table.toObject(), tenantId, branchId, sessionId: existingSession.sessionId };
  }

  const sessionId = crypto.randomUUID();
  await cacheService.set(
    sessionKey,
    { sessionId, tenantId, branchId, startedAt: Date.now() },
    SESSION_TTL_SECONDS
  );

  return { ...table.toObject(), tenantId, branchId, sessionId };
}

/**
 * Validates that a table session is currently open and matches the caller's
 * claimed session before allowing an order to be placed against that table.
 * Throws 403 if the session has expired (TTL) or was never opened (no scan).
 */
public async validateTableSession(tenantId: string, tableId: string, sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    throw new AppError('A table session is required to place this order — please scan the QR code again', 403);
  }
  const sessionKey = `table_session:${tenantId}:${tableId}`;
  const session = await cacheService.get<{ sessionId: string; tenantId: string }>(sessionKey);
  if (!session || session.sessionId !== sessionId || session.tenantId !== tenantId) {
    throw new AppError('Table session expired or invalid — please rescan the QR code', 403);
  }
}

/**
 * Closes a table session (on payment/cancellation, or explicit staff checkout).
 * Fire-and-forget from callers — a failed delete just means the session lives
 * out its TTL naturally, which is a safe default (fails closed, not open).
 */
public async closeTableSession(tenantId: string, tableId: string): Promise<void> {
  await cacheService.del(`table_session:${tenantId}:${tableId}`);
}
```

Add `import crypto from 'node:crypto';` if not already present (it already is, from the QR JWT `crypto.randomBytes` usage).

### 2.3 Controller change

**File: `backend/src/modules/tables/controller.ts`**
`resolveQrTableHandler` needs no structural change — `service.resolveByQrToken()` already returns the extra `sessionId` field, which flows through the existing `res.status(200).json({ success: true, data: tbl })` response unchanged. Frontend/QR-scan clients pick up `data.sessionId` from the response body.

### 2.4 Order validation & service changes

**File: `backend/src/modules/orders/validation.ts`**
Add optional field to `createOrderSchema`:
```ts
tableSessionId: z.string().uuid().optional(),
```
No `.refine()` conditional-required logic here — enforcement happens in the service layer (§2.5) where channel and tableId are both already resolved, keeping the Zod schema simple and the business rule in `service.ts` per `PROJECT_RULES.md` §2 (controllers/schemas thin, logic in services).

### 2.5 Order service changes

**File: `backend/src/modules/orders/service.ts`**

Add import: `import { TableService } from '../tables/service.js';`
Add instance: `private tableService = new TableService();` (inside `OrderService`)

In `createOrder`, before the transaction block, insert the session check for dine-in/QR channels:
```ts
public async createOrder(tenantId: string, dto: CreateOrderDto): Promise<IOrder> {
  if (dto.offlineGuid) {
    const existing = await this.repo.findByOfflineGuid(tenantId, dto.offlineGuid);
    if (existing) return existing;
  }

  // Fraud prevention: dine-in/QR orders require proof of an open table session
  // (see modules/tables/service.ts §resolveByQrToken) — closes the "scan once,
  // order days later from anywhere" replay hole on the permanent signed QR JWT.
  if ((dto.channel === 'DINE_IN' || dto.channel === 'QR') && dto.tableId) {
    await this.tableService.validateTableSession(tenantId, dto.tableId, dto.tableSessionId);
  }

  const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  // ...rest unchanged...
```

In `updateOrderStatus`, close the session on terminal states (mirrors the existing table-status-release logic already present):
```ts
if ((dto.status === 'PAID' || dto.status === 'CANCELLED') && order.tableId) {
  const updateQuery: Record<string, unknown> = { $set: { status: 'AVAILABLE', currentOrderId: null } };
  if (dto.status === 'PAID') updateQuery['$inc'] = { totalOrdersServed: 1 };
  await tenantQuery.updateOne(TableModel, tenantId, { _id: order.tableId }, updateQuery).exec();

  // Close the table session so a stale visit can't spawn further orders post-checkout.
  void this.tableService.closeTableSession(tenantId, order.tableId.toString()).catch(() => null);
}
```

### 2.6 POS offline-sync interaction

**File: `backend/src/modules/orders/service.ts`** — `syncOfflineOrders`
Offline-sync orders come from staff-operated POS terminals (cashier role), not customer QR scans, and already require `rbacMiddleware(['owner', 'manager', 'cashier'])` at the route level (`orders/routes.ts`). These are exempt from the session check because they're not the QR-replay threat model — a cashier-authenticated terminal isn't "someone who scanned a code days ago." No code change needed here beyond confirming the `channel` values used in offline batches (`TAKEAWAY` per the existing test fixtures) never hit the `DINE_IN`/`QR` branch. Document this exemption explicitly (see §2.9) so it isn't "rediscovered" as a bug later.

### 2.7 Staff-initiated dine-in orders (no customer QR scan)

Cashiers can also create `DINE_IN` orders directly from the dashboard/POS without a customer having scanned anything (e.g. walk-in seated by staff). To avoid blocking that legitimate flow, add a staff bypass: if the request is authenticated with role `owner`/`manager`/`cashier` (i.e. `req.user` is set and role-checked upstream), skip the session check.

**File: `backend/src/modules/orders/controller.ts`**
```ts
export async function createOrderHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.tenantId ?? '';
    const validated = createOrderSchema.parse(req.body);
    const isStaffInitiated = Boolean(req.user); // authMiddleware already ran for this route
    const order = await service.createOrder(tenantId, validated, { skipSessionCheck: isStaffInitiated });
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}
```
**File: `backend/src/modules/orders/service.ts`** — extend the method signature:
```ts
public async createOrder(
  tenantId: string,
  dto: CreateOrderDto,
  opts?: { skipSessionCheck?: boolean }
): Promise<IOrder> {
  ...
  if (!opts?.skipSessionCheck && (dto.channel === 'DINE_IN' || dto.channel === 'QR') && dto.tableId) {
    await this.tableService.validateTableSession(tenantId, dto.tableId, dto.tableSessionId);
  }
  ...
```
Note: `orders/routes.ts` already runs `authMiddleware, tenantMiddleware` ahead of `createOrderHandler` for the whole router (`router.use(authMiddleware, tenantMiddleware)`), so `req.user` is always populated for this route today — meaning **every** order creation currently goes through staff auth, and there's presently no true "unauthenticated customer scans QR and orders directly" path in the codebase. Two options, pick one explicitly before implementing:
- **Option A (recommended, matches current architecture):** All orders remain staff/cashier-mediated (customer shows QR/table number to staff, who rings it up) — in which case the session check still adds value for a *future* self-service ordering flow, but today it would immediately hit the staff bypass unconditionally. Implement the plumbing now, but it's inert until a public order-creation route exists.
- **Option B:** Add a new **public** endpoint (`POST /api/v1/orders/qr`, no `authMiddleware`) specifically for customer self-service QR ordering, where the session check is the *only* gate (no staff RBAC). This is the actual fraud-prevention surface the original request describes.

**This plan assumes Option B is the real target** (it's the only path where "days later, from anywhere" fraud is even possible) and specifies it fully below; Option A requires no further work beyond what's already in §2.5–§2.7.

**File: `backend/src/modules/orders/routes.ts`** — add before the `router.use(authMiddleware, tenantMiddleware)` line:
```ts
// Public customer self-service QR ordering — no staff auth, gated entirely by
// table session validation (see tables/service.ts validateTableSession).
router.post('/qr', tenantMiddleware, createOrderHandler);
```
And in `createOrderHandler`, treat `req.user` absence as "not staff-initiated" (already correct — `Boolean(req.user)` is `false` for this route, so the session check runs).

### 2.8 Frontend/client contract note (for the consuming app, not backend code)

Document, don't implement (no frontend in this repo): after `GET /tables/qr/:token`, the client must persist `data.sessionId` (e.g. in-memory or sessionStorage, not a cookie tied to staff auth) and send it as `tableSessionId` in the `POST /orders/qr` body for the duration of the visit. If the session expires mid-visit (customer lingers past 90 min), the client should re-hit `GET /tables/qr/:token` to mint a fresh session — this is a silent, transparent re-scan since the physical QR code itself never changes.

### 2.9 Documentation updates — §2

- `docs/runbook.md` — new subsection "QR Table Session Fraud Prevention" explaining the threat model (permanent QR + unbounded JWT = replay risk), the session TTL mechanism, and the explicit staff-bypass / offline-sync exemption from §2.6–§2.7 so it reads as a documented design decision, not a gap.
- `docs/API_ROUTES.md` — add `POST /api/v1/orders/qr` (Public, gated by `tableSessionId`) alongside the existing `POST /api/v1/orders` (Auth, staff roles) entry; note the new optional `tableSessionId` field on both.
- `docs/POSTMAN_ENDPOINTS_GUIDE.md` — add a "12a. Public QR Self-Service Ordering" example showing scan → `sessionId` → order-with-session flow.
- `docs/PROJECT_RULES.md` — no rule changes needed; this is a straightforward application of existing Rule #2 (`cacheService`, never raw Redis).
- `README.md` Progress Log — new entry once implemented, per protocol in `PROJECT_RULES.md` §4.

### 2.10 Test plan — §2

| # | Test | File | Assertion |
|---|---|---|---|
| 1 | Scanning QR opens a session | `tests/integration/tables-qr-session.test.ts` (new) | `GET /tables/qr/:token` response includes `sessionId` (uuid format) |
| 2 | Valid session allows order creation | same | `POST /orders/qr` with correct `tableSessionId` → 201 |
| 3 | Missing session ID rejected | same | `POST /orders/qr` with no `tableSessionId` → 403 |
| 4 | Wrong/expired session ID rejected | same | `POST /orders/qr` with a fabricated UUID → 403 |
| 5 | Session TTL expiry | same (use `MemoryCacheService`/fake timers or a short TTL override in test env) | After TTL elapses, previously valid `sessionId` → 403 on next order |
| 6 | Session closes on PAID | same | After `PATCH /orders/:id { status: 'PAID' }`, the old `sessionId` no longer validates |
| 7 | Session closes on CANCELLED | same | Same as #6 for `CANCELLED` |
| 8 | Staff-initiated `DINE_IN` order via `POST /orders` bypasses session check | `tests/integration/phase3-domain.test.ts` (existing suite — confirm no regression) | Existing staff order-creation test continues to pass unchanged |
| 9 | Offline-sync orders unaffected | existing `phase3-domain.test.ts` offline-sync tests | No regression; `channel: 'TAKEAWAY'` never triggers session check |
| 10 | Cross-tenant session isolation | new | Tenant A's `sessionId` cannot validate against Tenant B's `tableId` even if UUIDs collided (defense-in-depth on the `tenantId` check inside `validateTableSession`) |
| 11 | Concurrent scan while table OCCUPIED returns existing session, not a new one | `tests/integration/tables-qr-session.test.ts` | Two scans of the same QR while status is `OCCUPIED` yield the same `sessionId` |

---

## 3. Remove PM2 from the project

PM2 was the process manager for the abandoned VPS/Hostinger deployment path (Phases 5–7 pre-Vercel-pivot docs). The project has already moved to Vercel Serverless (per `backend/api/index.ts`, `backend/vercel.json`, and the Phase 7/8 docs), and §1 above removes the last reason anything needed a long-running process (RabbitMQ consumers). PM2 is now fully dead weight.

### 3.1 Files to delete

- `backend/ecosystem.config.js`
- `backend/scripts/deploy.sh` (PM2-specific zero-downtime reload logic; Vercel handles deploys via `git push` / dashboard — no custom script needed)
- `backend/scripts/backup.sh` (backs up `dump.pm2`, `ecosystem.config.js`, and Nginx configs — all now irrelevant; MongoDB Atlas continuous backups and Upstash-managed persistence already cover data per the Phase 6 notes)
- `backend/scripts/restore-drill.sh` (drills recovery of the files being deleted above)
- `nginx/` directory entirely (`nginx/sites-available/api.conf`, `nginx/sites-available/n8n.conf`) — no Nginx in front of Vercel
- `docs/STAGING_RUNBOOK.md` (entirely VPS/PM2/Nginx provisioning content, superseded by Vercel's own deploy flow)
- `docs/phase-5-pm2-nginx-deploy.md` (superseded by `docs/phase-7-hostinger-golive.md`'s Vercel approach — Phase 7 already documents this supersession; Phase 5 doc is now purely historical)

### 3.2 Files to edit (remove PM2 references, keep the rest)

**File: `backend/package.json`**
Remove scripts:
```diff
- "pm2:start": "pm2 start ecosystem.config.js",
- "pm2:reload": "pm2 reload ecosystem.config.js",
- "pm2:status": "pm2 status",
- "pm2:logs": "pm2 logs --lines 100",
```
Keep `build`, `build:clean`, `build:prod`, `start`, `verify`, `seed:admin`, `test`, and the new `setup:qstash-schedules` from §1.9. `"start": "node dist/server.js"` can stay as a local-only convenience command (not used by Vercel, which invokes `api/index.ts` directly).

**File: `backend/src/server.ts`**
Already being edited in §1.11 to drop RabbitMQ bootstrap — no PM2-specific code exists here (PM2 just spawns the file, doesn't get imported), so no additional change beyond §1.11.

**File: `docs/00-project-overview.md`**
- §1 tech stack table: remove the `Process manager | PM2 (...)` row entirely; remove the `Reverse proxy | Nginx + Certbot` row entirely; remove the `Automation | n8n / External Workers` row's PM2-process framing if it references PM2 specifically (n8n itself is out of scope for this phase — leave n8n integration code untouched, just drop the "own PM2 process" language and note it as a separately-hosted service, e.g. n8n Cloud, if still in use).
- §2 project structure tree: remove `ecosystem.config.js`, `nginx/` block, `infra/rabbitmq/` (already removed in §1.14), and the "PM2 process layout" code block at the bottom of that section.
- §4 Phase Index table: mark `phase-5-pm2-nginx-deploy.md` row as "**Superseded by Phase 10 — Vercel deploy replaces PM2/Nginx staging**" rather than deleting the row outright, preserving phase-history traceability.

**File: `docs/restaurant-saas-architecture.md`**
This is a large historical planning doc predating the Vercel pivot. Do not attempt to rewrite it wholesale (it's explicitly a point-in-time architecture snapshot per its own framing). Add a single banner at the very top:
```markdown
> **⚠️ Superseded:** This document describes the original PM2/Nginx/Hostinger VPS
> architecture. The project migrated to Vercel Serverless in Phase 7, and PM2 was
> fully removed in Phase 10. See `docs/00-project-overview.md` and
> `docs/phase-10-qstash-qr-session-pm2-removal.md` for the current architecture.
```

**File: `docs/PROJECT_RULES.md`**
Rule #10 currently reads: *"Don't install or wire up infrastructure ahead of the phase it belongs to... Section 8 of the overview file lists trigger-based exceptions."* No textual change required, but the §6 "Recommended Antigravity Skills" table row for `deployment / docker-or-vps-deploy` ("Relevant for Phase 5/7 — VPS + PM2 + Nginx deployment...") should be updated to: *"Relevant for Vercel deployment config and environment variable management (Phase 7/10) — VPS/PM2/Nginx path is retired."*

**File: `docs/runbook.md`**
- Remove the "PM2 / App Config" row from the §1 storage-tiering table (it references "Local VPS" — no longer applicable).
- §2 rewrite each recovery playbook's "reload the process" step from `pm2 reload api --update-env` to "redeploy via Vercel (git push to the deploy branch, or `vercel --prod` from the Vercel CLI) — environment variable changes take effect on next deploy automatically."
- §3 "Full Restore Drill" — since `restore-drill.sh` is deleted (§3.1), replace this section with: confirm `/ready` returns 200 after a fresh Vercel deploy from a clean environment variable set (documents the same intent — "does the app come back up clean" — without the now-nonexistent PM2/VPS artifacts).

**File: `docs/technology-install-guide.md`**
Remove the `npm install -g pm2 typescript ts-node` line from §1 and the accompanying note block about installing MongoDB/Redis/RabbitMQ "natively on your host machine or provisioned via a managed cloud provider" — replace with a note that all infra is managed-cloud-only (Atlas/Upstash/QStash) and there is no self-hosted install path in this architecture as of Phase 10.

### 3.3 Search-and-verify sweep

Before closing this phase, grep the repo for residual references and confirm each is either intentionally historical (inside a doc explicitly marked superseded) or removed:
```bash
grep -rn "pm2" --include="*.ts" --include="*.js" --include="*.json" backend/ | grep -v node_modules
grep -rln "ecosystem.config.js" . --include="*.md" --include="*.json" | grep -v node_modules
grep -rln "PM2" . --include="*.md" | grep -v node_modules
```
Expected remaining hits after cleanup: only inside `docs/restaurant-saas-architecture.md` (banner-flagged), `docs/00-project-overview.md` Phase Index superseded-note, and this phase's own plan file.

### 3.4 Test plan — §3

PM2 removal is subtractive infrastructure/tooling cleanup with no runtime business logic — no new Vitest cases are needed. Verification is manual/CI-script based:

| # | Check | Method |
|---|---|---|
| 1 | `npm run build:prod` still succeeds with `ecosystem.config.js` gone | CI build step |
| 2 | `npm test` (full Vitest suite) passes unchanged | CI test step — confirms nothing in `tests/` imported PM2-adjacent files |
| 3 | `backend/package.json` has no `pm2:*` scripts and no `amqplib`/`@types/amqplib` deps | `npm run` (lists scripts), `npm ls amqplib` (expect "not found") |
| 4 | Grep sweep (§3.3) returns only expected historical hits | manual, once, before merge |
| 5 | Vercel deploy from a clean checkout succeeds and `/ready` returns 200 with the new `qstash` service key present | staging Vercel deploy, `curl -sf https://<staging>.vercel.app/ready` |

---

## 4. Cross-Cutting Completion Checklist

- [ ] `amqplib` / `@types/amqplib` removed; `@upstash/qstash` added
- [ ] `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `PUBLIC_API_BASE_URL` added to `env.ts`, `.env.local`/`.env.production` templates
- [ ] `config/rabbitmq.ts` deleted; `config/qstash.ts` added
- [ ] `services/queue/rabbitmq-queue.service.ts` deleted; `services/queue/qstash-queue.service.ts` added, implements `IQueueService` unchanged
- [ ] `queue-definitions.ts` updated with `jobRoute` field on all 9 queues
- [ ] `src/jobs/index.ts` created; all 8 `workers/*.worker.ts` files stripped of `startXWorker()`/`consume()` blocks, `processXJob`/`handleX` kept intact
- [ ] `table-history-cleanup.worker.ts` cron logic replaced by QStash Schedule (`scripts/setup-qstash-schedules.ts`)
- [ ] `middleware/qstash.middleware.ts` created with raw-body signature verification
- [ ] `app.ts` mounts `/api/v1/jobs` with raw-body capture ahead of global `express.json()`
- [ ] `server.ts` RabbitMQ/worker bootstrap removed
- [ ] `health.service.ts` + `tests/unit/health.test.ts` updated: `rabbitmq` → `qstash` service key
- [ ] `infra/rabbitmq/` deleted
- [ ] Table session cache layer (`table_session:{tenantId}:{tableId}`) implemented in `tables/service.ts`: `resolveByQrToken` (opens session), `validateTableSession`, `closeTableSession`
- [ ] `orders/validation.ts` gains optional `tableSessionId`
- [ ] `orders/service.ts` `createOrder` validates session for `DINE_IN`/`QR` channel (with `skipSessionCheck` staff bypass), `updateOrderStatus` closes session on `PAID`/`CANCELLED`
- [ ] Public `POST /api/v1/orders/qr` route added for genuine customer self-service ordering (Option B decision documented in §2.7)
- [ ] `ecosystem.config.js`, `nginx/`, `scripts/deploy.sh`, `scripts/backup.sh`, `scripts/restore-drill.sh`, `docs/STAGING_RUNBOOK.md`, `docs/phase-5-pm2-nginx-deploy.md` deleted
- [ ] `package.json` `pm2:*` scripts removed
- [ ] `docs/00-project-overview.md`, `docs/runbook.md`, `docs/technology-install-guide.md`, `docs/PROJECT_RULES.md` §6 updated per §3.2
- [ ] `docs/restaurant-saas-architecture.md` superseded-banner added
- [ ] Grep sweep (§3.3) run and clean
- [ ] All new/updated tests from §1.16, §2.10 passing
- [ ] `docs/API_ROUTES.md` updated: `POST /api/v1/orders/qr`, `tableSessionId` field, job routes section (list all 8 `/api/v1/jobs/*` routes as "Internal — QStash signature required, not for direct client use")
- [ ] `docs/POSTMAN_ENDPOINTS_GUIDE.md` updated per §2.9
- [ ] Postman collection JSON (`docs/Restaurant_SaaS_Platform.postman_collection.json`) — add QR self-service order example, remove nothing (RabbitMQ was never Postman-exposed)
- [ ] `README.md` Progress Log entry appended (not written until implementation actually lands, per `PROJECT_RULES.md` §4 — do this last)

---

## 5. Suggested Implementation Order (within this phase)

1. §1.1–§1.7 (QStash plumbing: package, env, client, service, definitions, barrel, signature middleware) — get this compiling and unit-testable in isolation first.
2. §1.8–§1.11 (job routes, worker file trims, app/server wiring) — the actual cutover; run full test suite immediately after.
3. §1.12–§1.13 (health check, local dev story) — small, low-risk, do right after cutover while context is fresh.
4. §1.14–§1.16 (delete old files, fix stale references, write §1 tests) — cleanup + verification for the queue swap, closing out §1 before starting §2.
5. §2.1–§2.7 (QR session layer + order integration) — independent of §1, can theoretically be done in parallel by a second engineer, but sequenced after §1 here to avoid two moving infra pieces at once.
6. §2.8–§2.10 (docs, tests) — close out §2.
7. §3 in full — purely subtractive, do last so nothing mid-flight depends on files being deleted.
8. §4 checklist pass, then README Progress Log entry per `PROJECT_RULES.md` §4.
