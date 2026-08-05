# API Routes & Integration Manual — Restaurant SaaS Platform

This document serves as the master API Routing manual for our Vercel Serverless cloud architecture. Every endpoint is cataloged below along with practical copy-pasteable JSON payload examples for developer integration.

---

## 🌐 Root & Serverless Infrastructure Probes
All health probes operate synchronously with zero database locking, allowing external uptime monitoring (Uptime Robot, Vercel Health, Vercel Edge) to verify system state.

| Method | Endpoint | Auth Required | Description & Response Example |
|---|---|---|---|
| `GET` | `/` | Public | Welcome operational root displaying server identification and status. |
| `GET` | `/health` | Public | Liveness probe returning process status, uptime, and timestamp. |
| `GET` | `/live` | Public | Liveness probe alias for container/orchestration checks. |
| `GET` | `/ready` | Public | Readiness probe checking live connectivity to MongoDB Atlas, Upstash Redis, Upstash QStash, and Firebase Admin SDK. |

**Example Response (`GET /ready` - 200 OK):**
```json
{
  "status": "ok",
  "services": {
    "mongodb": { "status": "ok" },
    "redis": { "status": "ok", "latencyMs": 12 },
    "qstash": { "status": "ok" },
    "firebase": { "status": "ok" }
  },
  "timestamp": "2026-07-31T18:15:00.000Z"
}
```

---

## 🤖 Phase 8 — Cloud AI & n8n RAG Automation Gateways
These endpoints are engineered explicitly for seamless integration with external automation architectures (n8n Cloud, Make.com, Upstash Vector DB) without embedding heavy workflow logic in our core backend.

| Method | Endpoint | Auth Required | Purpose & n8n Node Behavior |
|---|---|---|---|
| `GET` | `/api/v1/tenants/:tenantId/ai-status` | Public / n8n Cloud | **Node #1 in n8n Chatbot Workflow:** Verifies if kitchen is `isOpen` and `isChatbotActive`. If false, n8n aborts LLM inference immediately and emits `offlineReply`. |
| `GET` | `/api/v1/menu/rag-catalog/:tenantId` | Public / n8n Cloud | **Upstash Vector Ingestion Feed:** Exports active menu items in clean textual string summaries (`ragItems[*].text`) alongside precise pricing metadata. |

**Example Response (`GET /api/v1/tenants/6a6caa2fc2f7b5caa316ba3b/ai-status`):**
```json
{
  "success": true,
  "data": {
    "tenantId": "6a6caa2fc2f7b5caa316ba3b",
    "brandName": "Gourmet Burger House",
    "currency": "EGP",
    "isOpen": false,
    "isChatbotActive": true,
    "canAnswer": false,
    "offlineReply": "We are currently closed for orders or our chatbot is on a break. Please check back during operating hours!",
    "aiModelPreference": "gpt-4o"
  }
}
```

---

## 🔑 Authentication Module (`/api/v1/auth`)
Handles user onboarding, JWT access token issuance, secure refresh token rotation, and OTP password recovery.

| Method | Endpoint | Auth & RBAC | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register/super-admin` | Public | Register platform Super Admin account (root ecosystem scope). |
| `POST` | `/api/v1/auth/register/owner` | Auth (`super_admin`) | Provision first owner account for a client restaurant tenant. |
| `POST` | `/api/v1/auth/register/staff` | Auth (`owner`, `manager`) | Invite staff members (manager, cashier, kitchen) to tenant. |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user via email/password and return token pair. |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token and invalidate previous session token. |
| `POST` | `/api/v1/auth/forgot-password` | Public | Send 6-digit verification code OTP via Resend email worker (10-min TTL). |
| `POST` | `/api/v1/auth/verify-otp` | Public | Validate 6-digit OTP code and receive a short-lived reset token (15-min TTL). |
| `POST` | `/api/v1/auth/reset-password` | Public | Reset password using valid reset token and revoke active sessions. |
| `POST` | `/api/v1/auth/logout` | Auth | Invalidate current refresh and access tokens immediately. |

---

## 🏬 Tenant & Restaurant Profile Management (`/api/v1/tenants`)
All domain queries enforce strict zero-bleed data isolation via our `tenantQuery` Mongoose wrapping engine. The `Tenant` model holds both SaaS metadata and restaurant profile fields.

| Method | Endpoint | Auth & RBAC | Description |
|---|---|---|---|
| `POST` | `/api/v1/tenants` | Auth (`super_admin`) | Create a new tenant trial account (slug, brand name, currency). |
| `GET` | `/api/v1/tenants/me` | Auth (`owner`, `manager`) | Retrieve current tenant workspace configurations. |
| `GET` | `/api/v1/tenants/profile` | Auth (`owner`, `manager`) | Retrieve dining restaurant profile, `qrRedirectUrl`, and operational flags. |
| `PUT` / `POST` | `/api/v1/tenants/profile` | Auth (`owner`, `manager`) | Update profile, kitchen status (`isOpen`), `qrRedirectUrl`, and AI toggles (`isChatbotActive`). |

**Example Profile Update Request (`PUT /api/v1/tenants/profile`):**
```json
{
  "brandName": "Gourmet Burger House",
  "qrRedirectUrl": "https://t.me/resturanchatbot",
  "isOpen": true,
  "isChatbotActive": true,
  "chatbotSettings": {
    "offlineMessage": "Kitchen is in peak rush hour! Our AI assistant is taking a 30-minute break.",
    "aiModelPreference": "gpt-4o"
  }
}
```

---

## 🍽️ POS Menu, Tables & Kitchen Operations (`/api/v1/*`)

| Module & Route | Allowed Operations & RBAC | Description & Caching Mechanics |
|---|---|---|
| **Branches (`/api/v1/branches`)** | `POST`, `GET`, `PUT`, `DELETE` (`owner`, `manager`) | Storefront management with compound index (`tenantId` + `branchId`). |
| **Categories (`/api/v1/categories`)** | `POST`, `GET`, `PUT`, `DELETE` (`owner`, `manager`) | Menu organization sorted by `displayOrder`. |
| **Products (`/api/v1/products`)** | `POST`, `GET`, `PUT`, `DELETE` (`owner`, `manager`) | Dish items linked with pricing and customization variants. |
| **Menu Catalog (`/api/v1/menu/catalog`)**| `GET` (**Public Guest / QR Scanning**) | Returns full organized menu; automatically cached via Upstash Redis. |
| **Bulk Import (`/api/v1/menu/bulk-import`)**| `POST` (`super_admin`, `owner`, `manager`) | Atomic transactional insertion of categories, dishes, and variants in one request. |
| **Tables & QR (`/api/v1/tables`)** | `POST`, `GET`, `DELETE` (`owner`, `manager`); `GET /qr/:token`, `GET /scan/:token` are Public | Dining tables paired with SHA JWT QR tokens, session creation, and 302 auto-redirects to Telegram bot / Web chatbot. |
| **QR PNG Image (`/api/v1/tables/:id/qr-image`)** | `GET` (`owner`, `manager`, `cashier`) | Generates downloadable high-resolution PNG QR image on-the-fly. |
| **POS Orders (`/api/v1/orders`)** | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `POST /offline-sync` | POS checkout ticket lifecycle, branch-filtered order retrieval, and offline batch synchronization recovery. `branchId` query param is validated via `objectIdSchema`. |

**Example POS Order Creation Request (`POST /api/v1/orders`):**
```json
{
  "branchId": "6a6b3e8447dedf5d12fef0c4",
  "tableId": "6a6b3e8447dedf5d12fef0c0",
  "orderType": "dine-in",
  "paymentMethod": "cash",
  "items": [
    {
      "productId": "6a6cbb8a0192837465000111",
      "quantity": 2,
      "selectedVariants": [
        { "variantId": "6a6b3e8447dedf5d12fef0c2", "selectedOptionNames": ["Cheese Stuffed Crust"] }
      ],
      "notes": "Extra crispy crust please!"
    }
  ],
  "totalAmount": 710.00
}
```
**Example Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "6a6cbb8a0192837465099999",
    "orderNumber": "ORD-202607-0042",
    "status": "received",
    "tableId": "6a6b3e8447dedf5d12fef0c0",
    "totalAmount": 710.00,
    "createdAt": "2026-07-31T18:15:30.000Z"
  }
}
```

---

## 9. ⚙️ Shared Validation Kernel, Audit Telemetry & Analytical Snapshot Architecture

### 9.1 Shared Enterprise Kernel (`backend/src/shared/`)
To eliminate duplicate enums and ensure consistent validation across all feature domain modules, the platform utilizes a unified shared kernel:
* **`shared/constants/index.ts`**: Master collection of immutable system enums including `ROLES` (`super_admin`, `owner`, `manager`, `cashier`, `kitchen`, `table`), `SUBSCRIPTION_PLANS` (`free`, `starter`, `pro`, `enterprise`), `ORDER_STATUSES`, `PAYMENT_METHODS`, rate-limiting quotas, and default localization configurations (`EGP` currency, `Africa/Cairo` timezone, `ar` locale).
* **`shared/validation/index.ts`**: Reusable Zod schema building blocks utilized across controllers, featuring strict 24-character hex `objectIdSchema`, Egyptian/International `phoneSchema`, non-negative decimal `priceSchema`, URL slug formatters, and universal `paginationQuerySchema`.
* **`shared/index.ts`**: Root aggregator cleanly re-exporting constants, events, types, and validation primitives.

### 9.2 Serverless HTTP Request Telemetry (`requestLogger.middleware.ts`)
Mounted directly in `app.ts` ahead of route evaluations, this middleware monitors response latency without external cloud monitoring add-ons:
* Captures start timestamps via `Date.now()` and attaches completion listeners directly to Express output response streams.
* Automatically records execution duration in milliseconds (`durationMs`), HTTP status code, method, endpoint URL, and active tenant slug directly into cloud logs via Pino structured formatting.

### 9.3 Persistent Notification & OTP Audit Trail (`NotificationLogModel` & `Repository`)
Transforms ephemeral RabbitMQ CloudAMQP message publishing into an immutable audit ledger:
* **Schema Contract (`src/modules/notifications/model.ts`):** Stores `tenantId`, communication channel (`EMAIL`, `TELEGRAM`, `SMS`, `WHATSAPP`), target `recipient`, `messageSubject`, `messageBody`, delivery lifecycle `status` (`QUEUED`, `SENT`, `FAILED`), error tracking, and dispatch timestamps.
* **Repository:** `NotificationRepository.findByTenant()` allows restaurant managers to verify customer receipt deliveries and OTP dispatches from their administrative dashboards.

### 9.4 High-Speed Pre-Computed Analytical Snapshot Store (`ReportSnapshotModel` & `Repository`)
Mitigates database CPU contention (noisy-neighbor bottlenecks) caused by heavy operational aggregations during high-volume dining hours:
* **Schema Contract (`src/modules/reports/model.ts`):** Archives pre-calculated documents for `reportType` (`DAILY_SALES`, `SHIFT_RECONCILIATION`, `WEEKLY_AI_ADVISOR`, `TAX_SUMMARY`), storing total revenue, order volume, average order values, payment type splits, top-selling items, and custom AI advisory recommendation strings.
* **Performance Benefit:** Historical financial queries read pre-calculated snapshot records via `ReportRepository.getLatestSnapshots()` in **< 2ms**, completely bypassing live POS transaction tables!

### 9.5 Dynamic QR Menu Styling & Promotional Theme Config (`MenuLayoutModel`)
* **Schema Contract (`src/modules/menu/model.ts`):** Persists tenant-specific branding rules including custom hex palettes (`primaryColor`, `backgroundColor`), typography styling (`fontFamily: 'Cairo'`), food safety toggles (`showAllergens`, `showCaloricCount`), and top-of-menu marketing banners (`promotionBanner.active`, `bannerImageUrl`).

---

## ?? Phase 9 � Correctness Fixes & Tenant-Context Rework

### BREAKING CHANGE: Tenant Context Now in Request Body
All mutating endpoints (POST, PUT, PATCH, DELETE) now require tenant context in JSON body as \	enantId\ or \	enantSlug\, not X-Tenant-Id headers. GET requests continue to use query params (?tenantId=).

### 9.1 � Subscriptions & Billing (super_admin Only)
- PATCH /api/v1/subscriptions: Changed to require super_admin role; target tenantId in body
- POST /api/v1/billing: Changed to require super_admin role; target tenantId in body

### 9.5 � Reservations Module (/api/v1/reservations)
- POST /api/v1/reservations: Public endpoint for chatbot table booking
- GET /api/v1/reservations: List reservations (staff only)
- PATCH /api/v1/reservations/:id: Update status (staff only)
- DELETE /api/v1/reservations/:id: Cancel reservation (staff only)

### 9.6 � QR Code Tokens (JWT Signed)
- GET /api/v1/tables/qr/:token: Resolve JWT token; verify signature + tenant scope

### 9.7 � Table Order History
- GET /api/v1/tables/:id/history: Per-table order history (last 30 days, staff only)

### 9.9 � Notification Audit Logs
- POST /api/v1/notifications/dispatch: Send notification; logs branchId, tableNumber, actionMakerId
- GET /api/v1/notifications: List notification audit trail (staff only)

See full Phase 9 specification at docs/phase-9-implementation-summary.md

---

## 10. Phase 10 - Serverless Queue Migration, QR Session Fraud Prevention & PM2 Removal

### 10.1 Public Self-Service QR Ordering (POST /api/v1/orders/qr)
- **Method & Route:** POST /api/v1/orders/qr (Public, gated by 	ableSessionId)
- **Authentication:** Public (no staff auth required)
- **Description:** Customer places dine-in order after scanning table QR code. Requires 	ableSessionId obtained from GET /api/v1/tables/qr/:token.

### 10.2 QStash Webhook Job Endpoints (POST /api/v1/jobs/*)
- **Route Prefix:** POST /api/v1/jobs/:jobRoute
- **Authentication:** Protected by upstash-signature header (qstashVerifyMiddleware)
- **Available Job Routes:**
  - POST /api/v1/jobs/emails
  - POST /api/v1/jobs/telegram
  - POST /api/v1/jobs/invoices
  - POST /api/v1/jobs/subscription-checks
  - POST /api/v1/jobs/payment-retries
  - POST /api/v1/jobs/backups
  - POST /api/v1/jobs/firestore-retry
  - POST /api/v1/jobs/table-history-cleanup
