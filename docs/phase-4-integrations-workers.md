# Phase 4 — Integrations & Background Workers

**Prerequisite:** Phase 3 complete (core domain modules working, order events being enqueued, automated dining table state machine verified).
**Reference:** see `00-project-overview.md` Section 2 for the PM2 process layout.

## Goal
Wire up external integrations (Paymob, Cloudinary, AI Menu Onboarding Pipelines) and build the consumer side of the queues defined in Phase 2 — one dedicated worker process per queue, plus external automated workflows (like n8n or custom AI sidecar agents) for customer-facing and restaurant-onboarding automation.

## Steps

1. **Paymob Integration** (`integrations/paymob/`):
   - Payment initiation endpoint.
   - Webhook endpoint with signature verification — reject any webhook that doesn't verify, no exceptions.
   - On successful payment webhook, update order/subscription status and enqueue any downstream notification via `QueueService`.

2. **Cloudinary Integration** (`integrations/cloudinary/`):
   - Upload helper for product images, restaurant branding logos, and **Menu Documents (PDF, DOCX, or High-Resolution Photos)** uploaded during restaurant onboarding.
   - Only store the returned URL in MongoDB — never store raw binary data in the database.

3. **AI Menu Onboarding & Bulk Ingestion Gateway** (`modules/menu/` & `integrations/ai-menu/`):
   - **Bulk Import API Gateway:** Implement `POST /api/v1/menu/bulk-import`, secured by RBAC (`['super_admin', 'owner', 'manager']`) or secret webhook API keys. This endpoint accepts a standardized, validated JSON schema containing an array of Categories, Products, and Variants, saving them simultaneously within an atomic database transaction and clearing the Upstash Redis menu cache.
   - **External AI Automation Workflow:** When a restaurant manager uploads a printed menu (PDF/DOCX/Image) to Cloudinary from the dashboard, a webhook event (`{ fileUrl, tenantId }`) is dispatched to an external AI automation service (e.g., n8n, Make, custom LangChain/Vision LLM pipeline).
   - **Decoupled Processing:** The external AI automation performs vision OCR, extracts menu structuring, generates semantic vector embeddings (for future conversational AI Waiter and dietary recommendation bots), formats the data into our strict bulk-import JSON contract, and submits it to `POST /api/v1/menu/bulk-import`.
   - **Human-in-the-Loop Oversight:** Once ingested, Restaurant Managers and Platform Super Admins review, refine prices, modify descriptions, or remove items using our standard Phase 3 CRUD endpoints (`PUT/DELETE /api/v1/products/:id`) before publishing the catalog to dining table QR displays.

4. **Background Workers** — one file per queue defined in Phase 2, each a standalone PM2-managed process (not bundled into the core API server):
   - `workers/email.worker.ts` — consumes `emails` queue
   - `workers/telegram.worker.ts` — consumes `telegram` queue
   - `workers/invoice.worker.ts` — consumes `invoices` queue
   - `workers/subscription-check.worker.ts` — consumes `subscription-checks` queue
   - `workers/payment-retry.worker.ts` — consumes `payment-retries` queue
   - `workers/backup.worker.ts` — consumes `backups` queue (trigger only; actual backup execution shells out to `scripts/backup.sh`, built in Phase 6)
   - Each worker is independently restartable — a stuck invoice worker must never block email delivery or menu ingestion. Verify this by killing one worker process and confirming the others keep consuming their queues.

5. **n8n & Workflow Automation**:
   - Install n8n, run it as its own PM2 process (added to `ecosystem.config.js`).
   - n8n and external workers never talk to MongoDB directly — they trigger backend API endpoints via webhook, and the backend handles all MongoDB writes through `tenantQuery`.
   - Build customer-facing workflows here: order-confirmation notifications triggered by the `telegram` queue event from Phase 3's order creation, and menu ingestion event coordination.

## Deliverable
Placing an order or onboarding a restaurant end-to-end results in: table state automated (Phase 3), Firestore updated (Phase 3), AI menus bulk-imported cleanly from PDF uploads, queue messages consumed by the correct worker, and external automated notifications sent — with each component verified to be independently crash-safe and zero inventory management bloat.
