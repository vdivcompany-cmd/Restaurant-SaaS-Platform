# Phase 4 / 5 / 6 Audit — Restaurant SaaS Platform

**Verdict: Not fully/correctly implemented.** Phase 3's deliverable (core domain + tests) is solid, but Phases 4–6 have several real bugs, orphaned artifacts, and requirements from their own phase docs that were silently dropped. None of these are "nitpicks" — several will actively break in production (standalone Mongo transaction crash, RabbitMQ topology file that doesn't match runtime, restore drill that tests nothing).

Severity key: 🔴 Blocking/incorrect · 🟠 Real gap vs phase doc · 🟡 Cleanup/consistency

---

## Phase 4 — Integrations & Background Workers

### 🔴 4.1 Menu bulk-import will crash on standalone MongoDB (no safe fallback)

`menu/service.ts` only starts a session/transaction when `NODE_ENV !== 'test'`, i.e. in staging/production — but per `00-project-overview.md`, MongoDB is a **single standalone instance until Phase 8**. Standalone Mongo does not support `session.startTransaction()` + multi-doc writes; the error surfaces on the *first write inside the transaction*, not on `startTransaction()` itself. The current try/catch only wraps `startTransaction()`, so it won't catch this — `repository.bulkImport()` will throw ("Transaction numbers are only allowed on a replica set member or mongos"), and `service.ts` just logs and re-throws.

Compare this to `orders/service.ts`, which does it correctly:
```ts
catch (err) {
  if (err.message.includes('replica set') || err.message.includes('Standalone')) {
    // fallback to non-transactional write
  } else { throw err; }
}
```
Menu's bulk-import has no equivalent fallback. **This means the flagship Phase 4 AI-onboarding endpoint (`POST /menu/bulk-import`) is broken in exactly the topology the project runs until Phase 8.**

**Fix plan:**
- Mirror the `OrderService.createOrder` pattern in `MenuService.bulkImportMenu`: catch transaction errors that indicate a non-replica-set topology and retry `repository.bulkImport()` without a session.
- Add an integration test that runs bulk-import against the real (standalone) test Mongo instance without mocking `NODE_ENV` — currently the transaction path is never exercised in tests because tests always run with `NODE_ENV=test`, which skips the transaction branch entirely. That's a coverage gap that let this bug ship.

---

### 🟠 4.2 Cloudinary integration file is empty — no upload helper exists

`backend/src/integrations/cloudinary/index.ts` has **zero content**. Phase 4 step 2 requires an "Upload helper for product images, restaurant branding logos, and Menu Documents." README documents this as a deviation ("Cloudinary uploads managed on the frontend"), which is a legitimate product decision — but:
- The file still exists as a dead stub, which is confusing (looks unfinished, not intentionally skipped).
- `cloudinary` npm package is still a listed dependency doing nothing.
- Because uploads never touch the backend, there is no `fileUrl` capture point to kick off the "AI Menu Onboarding" webhook flow described in Phase 4 step 3 — see 4.3 below, that requirement is unimplementable as currently architected.

**Fix plan:**
- Either delete `integrations/cloudinary/` and the `cloudinary` dependency, or implement the minimal helper (`uploadMenuDocument(buffer, tenantId): Promise<{url: string}>`) even if only called from an admin/manual endpoint. Leaving an empty file with no comment is worse than either choice.
- Update `docs/technology-install-guide.md` / `00-project-overview.md` to reflect the actual decision instead of listing Cloudinary as backend infra.

### 🟠 4.3 AI Menu Onboarding "external automation" webhook is never dispatched

Phase 4 step 3 requires: when a manager uploads a menu file, the backend dispatches a webhook `{ fileUrl, tenantId }` to an external AI/OCR pipeline. There is no call site anywhere in the codebase that does this — `integrations/n8n/index.ts` has a generic `dispatchN8nWebhook()` helper, but nothing invokes it for menu uploads. Combined with 4.2, the "Decoupled Processing" bullet of Phase 4 is entirely unbuilt, only the *receiving* end (`/integrations/n8n/webhook`) exists.

**Fix plan:**
- If Cloudinary uploads truly happen client-side (per README), add a small endpoint (e.g. `POST /api/v1/menu/onboarding-upload`) that the frontend calls after it uploads to Cloudinary, passing `{ fileUrl }`. That endpoint's only job is `dispatchN8nWebhook()` with `{ event: 'menu.upload', tenantId, data: { fileUrl } }`. Without this, there is no way for the OCR pipeline to ever be triggered.

### 🟠 4.4 Paymob is a stub with no endpoints, no webhook route, not wired into `app.ts`

`integrations/paymob/index.ts` only has type defs + HMAC verification helper. There is no payment initiation endpoint, no `routes.ts`, and `app.ts` never mounts a Paymob router. README documents this as intentional ("cash only for now"). This is a legitimate product call, but it means **Phase 4 step 1 is 0% implemented**, not "deferred" — worth being explicit about in project docs rather than letting it look finished because the HMAC helper exists.

**Fix plan:** No code change required if cash-only is final for now — just update `docs/00-project-overview.md` Phase 4 status and `PROJECT_RULES.md` to state Paymob is explicitly out of scope until a dated future phase, so it isn't mistaken for "done."

### 🔴 4.5 n8n webhook signature is verified against re-serialized JSON, not the raw request bytes

```ts
// integrations/n8n/routes.ts
const rawBody = JSON.stringify(req.body);
const isValid = verifyN8nSignature(signature, rawBody, webhookSecret);
```
`req.body` has already been parsed by `express.json()` by the time this runs. `JSON.stringify(req.body)` will **not** byte-for-byte reproduce what n8n originally signed if key order, whitespace, or number formatting differ even slightly (very common across JSON serializers). This means:
- Legitimate webhook calls can fail verification unpredictably (fragile, not just insecure).
- It's also the wrong general pattern for HMAC webhook verification — you must sign/verify the exact raw bytes received on the wire, never a reconstruction.

**Fix plan:**
- Capture the raw body for this route specifically, e.g. via `express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } })` applied before the n8n router, or mount a dedicated `express.raw({ type: 'application/json' })` middleware on `/api/v1/integrations/n8n/webhook` and parse JSON manually after verifying.
- Same scrutiny should be applied to the Paymob HMAC helper once/if that route is ever wired up — `verifyPaymobHMAC` correctly reconstructs from the parsed payload per Paymob's documented lexicographic scheme, so that one is fine by design (Paymob's spec expects field reconstruction, not raw bytes) — n8n's is the actual bug since generic HMAC-over-raw-body was almost certainly the intent.

### 🟠 4.6 `REPORTS` queue is defined but completely orphaned

`queue-definitions.ts` defines a `REPORTS` (`q.reports`) queue with its own DLQ/retry policy, but:
- No `workers/report.worker.ts` exists.
- Nothing anywhere calls `queueService.enqueue(PLATFORM_QUEUES.REPORTS.name, ...)`.
- `ecosystem.config.js` has no `worker-reports` process.

`ReportService.generateSalesReport()` runs synchronously via direct aggregation, which is fine for now — but then the `REPORTS` queue shouldn't exist as a defined-but-unused topology entry (dead config invites someone to assume it's wired up when it isn't, and it silently violates Phase 4's "one worker per queue defined in Phase 2" rule).

**Fix plan:** Pick one:
- (a) Remove `REPORTS` from `queue-definitions.ts` until there's an actual async report-generation use case, or
- (b) Build `workers/report.worker.ts` + `worker-reports` PM2 entry and route heavy/scheduled report generation (e.g. daily digest per Milestone 5) through it.
Either way, update `infra/rabbitmq/definitions.json` to match (see 6.3).

---

## Phase 5 — PM2, Nginx & Deploy Tooling

### 🟠 5.1 `ecosystem.config.js` is missing a process for the orphaned `REPORTS` queue

Direct consequence of 4.6 — if the queue is kept, Phase 5's own requirement ("`ecosystem.config.js` covering every process... and every queue from Phase 4") is violated by omission.

**Fix plan:** Resolve 4.6 first, then add the corresponding PM2 block if the queue is kept.

### 🟡 5.2 Nginx `Connection` header uses `$http_upgrade` directly (anti-pattern)

In `nginx/sites-available/api.conf`:
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $http_upgrade;
```
This is the well-known WebSocket-upgrade nginx anti-pattern. `$http_upgrade` is empty for ordinary HTTP requests, so `Connection` gets set to an empty string on every normal API request — this can degrade keep-alive behavior toward the upstream. The correct, standard pattern is:
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
# ...
proxy_set_header Connection $connection_upgrade;
```
(`n8n.conf` does this correctly by hardcoding `Connection "upgrade"` since n8n genuinely needs it; `api.conf` copied the pattern for a plain REST API that doesn't need it at all.)

**Fix plan:** In `api.conf`, either remove the `Upgrade`/`Connection` header overrides entirely (a REST API behind Nginx doesn't need them unless WebSockets are added later), or add the `map` block above if forward-compatibility with a future WS feature is desired.

### 🟡 5.3 Rate-limit bypass only covers `/health`, not `/ready` or `/live`

`api.conf`'s `location /health { ... }` bypass exists, but `/ready` (used by uptime checkers per Phase 6 step 6) and `/live` are not exempted from `limit_req_zone`. An external uptime monitor polling `/ready` frequently could get rate-limited by Nginx and produce false "down" alerts.

**Fix plan:** Add matching `location` blocks (or a regex location) for `/ready` and `/live` with `access_log off;` and no `limit_req`, same as `/health`.

### 🟡 5.4 `n8n.conf` admin IP allowlist is a literal placeholder

`allow YOUR_ADMIN_IP;` will `deny all` traffic until someone edits this by hand on the real box. Fine as a template, but it isn't currently called out as a required manual step anywhere in `STAGING_RUNBOOK.md`'s checklist.

**Fix plan:** Add an explicit line item to `STAGING_RUNBOOK.md` Section 4 ("Replace `YOUR_ADMIN_IP` in `n8n.conf` before first deploy — otherwise n8n UI is unreachable by everyone including you").

---

## Phase 6 — Backups, Health & Reliability

### 🔴 6.1 `backup.sh` never actually backs up the database

Phase 6 step 1 requires: `mongodump` cron → compressed → off-server storage. The actual `scripts/backup.sh` backs up **only**: PM2 process dump, `.env`, `ecosystem.config.js`, Nginx configs, and `infra/`. There is no `mongodump` call anywhere, no Redis data export, no RabbitMQ data export (only the static `definitions.json`, which is itself wrong — see 6.3).

README justifies this as "MongoDB Atlas continuous backups... eliminate self-hosted disk backup requirements" — but nothing in the code *enforces or verifies* that Atlas is actually in use. `config/env.ts` just validates `MONGODB_URI` as any URL, and `00-project-overview.md` still describes "MongoDB, single instance to start" as the baseline architecture. **If this project (or a fork of it) ever runs self-hosted MongoDB per the documented Phase 0 setup, there is currently zero backup of actual data** — only ops config gets backed up.

**Fix plan:**
- If Atlas is truly mandatory going forward, say so explicitly in `docs/00-project-overview.md` §1 and `phase-0-local-environment.md` (remove "install MongoDB natively" language), and add a startup assertion in `env.ts` or `database.ts` that warns/fails if `MONGODB_URI` doesn't look like an `atlas` host.
- Otherwise, add real `mongodump --uri="$MONGODB_URI" --archive="$TMP_DIR/mongo.dump" --gzip` to `backup.sh`, guarded so it's skipped only when explicitly configured for Atlas.

### 🔴 6.2 `restore-drill.sh` doesn't test data restoration at all

Phase 6 step 7 explicitly requires: "deliberately destroy the MongoDB data directory, Redis data, and RabbitMQ definitions, then restore all three from backup and confirm the app comes back up clean." The actual script only:
```bash
check_file "ecosystem.config.js"
check_file ".env.backup"
```
i.e. it verifies two config files exist inside the tar archive. **It does not touch MongoDB, Redis, or RabbitMQ in any way**, and does not start the app or hit `/ready` afterward. This is the single biggest gap relative to Phase 6's stated deliverable ("a documented, *rehearsed* restore process... not just a backup script that's never been tested").

**Fix plan:**
- Extend the script to actually: (1) restore the `mongodump` archive from 6.1 into a scratch database and run a basic query against it, (2) confirm RabbitMQ topology can be reasserted (the app already does this automatically on worker boot via `assertQueues()` — the drill should verify that by starting a worker against a fresh broker and checking `/ready`), (3) curl `/ready` and assert `200`.
- Document actual results of a real drill run in `docs/runbook.md` §3, per the phase's instruction to write the runbook "from an actual drill, not from theory" (currently `runbook.md` only shows a hypothetical expected response, not evidence of a drill having been run).

### 🔴 6.3 `infra/rabbitmq/definitions.json` does not match the runtime topology

Phase 6 step 3 requires exporting the **actual** queue/exchange definitions so a fresh box can be recreated identically. Compare:

| | Runtime (`queue-definitions.ts` + `rabbitmq-queue.service.ts`) | `infra/rabbitmq/definitions.json` |
|---|---|---|
| Primary exchange | `ex.restaurant` (direct) | ❌ not present |
| DLX exchange | `ex.restaurant.dlx` | `dlx` (different name) |
| Queue names | `q.emails`, `q.telegram`, ... `q.reports` | `emails`, `telegram`, ... (no `q.` prefix, **no `reports` queue at all**) |
| DLQ names | `q.emails.dlq` | `emails.dead` |
| Bindings | queue ⇄ `ex.restaurant` via per-queue routing key, DLQ ⇄ `ex.restaurant.dlx` | only DLQ bindings to a single `dlx` exchange; no bindings to the (missing) primary exchange at all |

This file, if actually used to provision a fresh RabbitMQ instance per the DR runbook, would produce a broker that **does not match what the app expects**, and the app would fail on first `assertQueues()` mismatch (RabbitMQ throws on exchange/queue argument mismatches between what's declared and what already exists). This directly contradicts the stated purpose of the file.

**Fix plan:**
- Regenerate `definitions.json` to mirror `queue-definitions.ts` exactly: `ex.restaurant` (direct, durable) + `ex.restaurant.dlx` (direct, durable), all 8 `q.*` queues with `x-dead-letter-exchange: ex.restaurant.dlx` args, all 8 `q.*.dlq` queues, and bindings for both exchanges.
- Better long-term fix: generate this file programmatically from `queue-definitions.ts` (a small script) instead of hand-maintaining two copies of the same topology that can drift again.
- Resolve 4.6 first (keep-or-drop `reports`) so this file is derived from a final source of truth.

### 🟡 6.4 `infra/redis/redis.conf` is dead configuration

The app exclusively talks to **Upstash Redis over REST** (`@upstash/redis`, no TCP socket, `config/redis.ts` explicitly documents "No connect/disconnect lifecycle needed"). `infra/redis/redis.conf` configures a *local, native* Redis server (`bind 127.0.0.1`, `appendonly yes`, `maxmemory`, etc.) that is never started or referenced by any script, worker, or config loader in this repo. It's leftover from an earlier architecture assumption and doesn't apply to the Upstash-based implementation that was actually built.

**Fix plan:** Delete `infra/redis/redis.conf` (Upstash manages its own persistence/AOF-equivalent server-side — there is nothing to configure locally), or, if there's a future plan to self-host Redis, add a comment at the top of the file and in `00-project-overview.md` clarifying it's inactive/reserved for a future migration path.

### 🟠 6.5 No RabbitMQ queue-depth monitoring implemented

Phase 6 step 6 requires tracking "RabbitMQ queue depth (a backing-up queue is an early warning sign before anything visibly breaks)." There is no code anywhere (health service, a metrics endpoint, or a scheduled check) that queries queue depth via the RabbitMQ management HTTP API or `channel.checkQueue()`. `/ready` only checks that a channel exists, not depth.

**Fix plan:** Add a lightweight `getQueueDepths()` to `RabbitMQQueueService` using `channel.checkQueue(queueName)` (returns `messageCount`) for each `PLATFORM_QUEUES` entry, expose it on a `/metrics` or extend `/ready` response with a `queues: { name: depth }` block, and wire an alert threshold externally (uptime checker or a simple cron that pages if any queue exceeds N messages).

### 🟡 6.6 `/health` and `/live` are shallow liveness checks, `/ready` is the only deep check

Phase 6 step 5 literally says "implement `/health`, `/ready`, `/live`, **each** checking real connectivity... not just 'the process is running.'" The actual implementation makes `/health` and `/live` pure process-liveness checks (`getLiveness()` — uptime + timestamp only), and only `/ready` calls `getReadiness()` with the four service checks. This is actually a defensible, common k8s-style split (liveness ≠ readiness by design) and arguably *better* practice than the literal phase wording — but it is a deviation from what the phase doc specifies, and should be called out as an intentional interpretation rather than left ambiguous, since `README.md`'s Phase 6 log doesn't mention this design choice at all.

**Fix plan:** No code change strictly required — just add a one-line note to `README.md`'s Phase 6 entry ("Notes / deviations") explaining `/health` and `/live` are intentionally shallow liveness probes and `/ready` is the sole deep dependency check, matching standard container-orchestration conventions.

---

## Cross-Cutting Issues (affect multiple phases)

### 🟡 X.1 Global DNS override as an import-time side effect

Both `backend/src/config/database.ts` and `backend/scripts/verify-connections.ts` run:
```ts
import dns from "dns"
dns.setServers(["8.8.8.8","8.8.4.4"])
```
at module load time. This mutates process-wide DNS resolution the instant the module is imported, with no guard, no env-conditional, and no comment explaining why (likely a workaround for a specific local/dev network's broken resolver for Atlas SRV records). In a production VPC with internal/private DNS (e.g. custom resolvers for internal services, split-horizon DNS, or a company VPN), this could silently break resolution of anything else the process needs to resolve.

**Fix plan:** Gate this behind an explicit env var (e.g. `FORCE_PUBLIC_DNS=true`) only set in local `.env.local`, and remove it from any path that could run in staging/production, or move it to a `if (env.NODE_ENV === 'development')` guard inside `database.ts` rather than an unconditional top-level import side effect.

### 🟠 X.2 Transaction-safety inconsistency between modules (root cause of 4.1)

`orders/service.ts` correctly handles the "not a replica set" failure mode with a fallback path. `menu/service.ts` does not. This is the kind of inconsistency that's easy to introduce when a pattern isn't extracted into a shared utility.

**Fix plan:** Extract a shared helper, e.g. `utils/withTransactionOrFallback.ts`:
```ts
export async function withTransactionOrFallback<T>(
  fn: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  if (process.env.NODE_ENV === 'test') return fn();
  const session = await mongoose.startSession().catch(() => null);
  if (!session) return fn();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    if (err instanceof Error && /replica set|standalone/i.test(err.message)) {
      return fn(); // retry without a session
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
```
Use this in both `OrderService.createOrder` and `MenuService.bulkImportMenu` so the safety logic lives in one place and can't drift between modules again.

---

## Priority Order to Fix

1. 🔴 4.1 — Menu bulk-import transaction fallback (will crash in real deployments today)
2. 🔴 4.5 — n8n HMAC verification on raw body (fragile/incorrect verification)
3. 🔴 6.2 — Restore drill must actually test data restoration
4. 🔴 6.3 — Regenerate `infra/rabbitmq/definitions.json` to match runtime topology
5. 🔴 6.1 — Decide Atlas-only vs. self-hosted Mongo, and back up real data accordingly
6. 🟠 4.6 / 5.1 / 6.3 — Resolve the orphaned `REPORTS` queue (drop or build worker) before regenerating RabbitMQ definitions
7. 🟠 4.2 / 4.3 — Either implement or formally cut the Cloudinary → n8n AI onboarding pipeline
8. 🟠 6.5 — Add RabbitMQ queue-depth monitoring
9. 🟡 Everything else (Nginx header pattern, dead redis.conf, doc notes)
