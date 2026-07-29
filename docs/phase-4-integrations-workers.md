# Phase 4 — Integrations & Background Workers

**Prerequisite:** Phase 3 complete (core domain modules working, order events being enqueued).
**Reference:** see `00-project-overview.md` Section 2 for the PM2 process layout.

## Goal
Wire up external integrations (Paymob, Cloudinary) and build the consumer side of the queues
defined in Phase 2 — one dedicated worker process per queue, plus n8n for customer-facing
automation.

## Steps

1. **Paymob integration** (`integrations/paymob/`):
   - Payment initiation endpoint.
   - Webhook endpoint with signature verification — reject any webhook that doesn't verify,
     no exceptions.
   - On successful payment webhook, update order/subscription status and enqueue any
     downstream notification via `QueueService`.
2. **Cloudinary integration** (`integrations/cloudinary/`):
   - Upload helper for product images, restaurant logos.
   - Only store the returned URL in MongoDB — never binary data.
3. **Background workers** — one file per queue defined in Phase 2, each a standalone
   PM2-managed process (not bundled into the API process):
   - `workers/email.worker.ts` — consumes `emails` queue
   - `workers/telegram.worker.ts` — consumes `telegram` queue
   - `workers/invoice.worker.ts` — consumes `invoices` queue
   - `workers/subscription-check.worker.ts` — consumes `subscription-checks` queue
   - `workers/payment-retry.worker.ts` — consumes `payment-retries` queue
   - `workers/backup.worker.ts` — consumes `backups` queue (trigger only; actual backup
     execution can shell out to `scripts/backup.sh`, built in Phase 6)
   - Each worker should be independently restartable — a stuck invoice worker must never
     block email delivery. Verify this by killing one worker process and confirming the
     others keep consuming their queues.
4. **n8n**:
   - Install n8n, run it as its own PM2 process (added to `ecosystem.config.js`).
   - n8n never talks to MongoDB directly — it triggers backend API endpoints via webhook, and
     the backend does any MongoDB write.
   - Build the first workflow here: order-confirmation notification, triggered by the
     `telegram` queue event from Phase 3's order creation.

## Deliverable
Placing an order end-to-end results in: stock deducted (Phase 3), Firestore updated (Phase 3),
a queue message consumed by the correct worker, and an n8n-triggered notification actually
sent — with each worker verified to be independently crash-safe.
