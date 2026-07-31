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
| `GET` | `/ready` | Public | Readiness probe checking live connectivity to MongoDB Atlas, Upstash Redis, CloudAMQP RabbitMQ, and Firebase Admin SDK. |

**Example Response (`GET /ready` - 200 OK):**
```json
{
  "status": "ok",
  "services": {
    "mongodb": { "status": "ok" },
    "redis": { "status": "ok", "latencyMs": 12 },
    "rabbitmq": { "status": "ok" },
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
| `GET` | `/api/v1/restaurants/:tenantId/ai-status` | Public / n8n Cloud | **Node #1 in n8n Chatbot Workflow:** Verifies if kitchen is `isOpen` and `isChatbotActive`. If false, n8n aborts LLM inference immediately and emits `offlineReply`. |
| `GET` | `/api/v1/menu/rag-catalog/:tenantId` | Public / n8n Cloud | **Upstash Vector Ingestion Feed:** Exports active menu items in clean textual string summaries (`ragItems[*].text`) alongside precise pricing metadata. |

**Example Response (`GET /api/v1/restaurants/6a6caa2fc2f7b5caa316ba3b/ai-status`):**
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
Handles user onboarding, JWT access token issuance, and secure refresh token rotation (single-session per user per Rule #2).

| Method | Endpoint | Auth & RBAC | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register/super-admin` | Public | Register platform Super Admin account (root ecosystem scope). |
| `POST` | `/api/v1/auth/register/owner` | Auth (`super_admin`) | Provision first owner account for a client restaurant tenant. |
| `POST` | `/api/v1/auth/register/staff` | Auth (`owner`, `manager`) | Invite staff members (manager, cashier, kitchen) to tenant. |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user via email/password and return token pair. |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token and invalidate previous session token. |
| `POST` | `/api/v1/auth/logout` | Auth | Invalidate current refresh and access tokens immediately. |

**Example Login Request (`POST /api/v1/auth/login`):**
```json
{
  "email": "owner@burgerhouse.com",
  "password": "SecurePassword123!"
}
```
**Example Login Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6a6b48a90192837465012345",
      "email": "owner@burgerhouse.com",
      "role": "owner",
      "tenantId": "6a6b3e8447dedf5d12fef0c5"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

---

## 🏬 Tenant & Restaurant Management (`/api/v1/*`)
All domain queries enforce strict zero-bleed data isolation via our `tenantQuery` Mongoose wrapping engine.

| Method | Endpoint | Auth & RBAC | Description |
|---|---|---|---|
| `POST` | `/api/v1/tenants` | Public | Create a new tenant trial account (slug, brand name, currency). |
| `GET` | `/api/v1/tenants/me` | Auth (`owner`, `manager`) | Retrieve current tenant workspace configurations. |
| `GET` | `/api/v1/restaurants/profile` | Auth (`owner`, `manager`) | Retrieve dining restaurant profile and operational flags. |
| `PUT` | `/api/v1/restaurants/profile` | Auth (`owner`, `manager`) | Update profile, kitchen status (`isOpen`), and AI toggles (`isChatbotActive`). |

**Example Manager Override Request (`PUT /api/v1/restaurants/profile`):**
```json
{
  "brandName": "Gourmet Burger House",
  "isOpen": true,
  "isChatbotActive": false,
  "chatbotSettings": {
    "offlineMessage": "Kitchen is in peak rush hour! Our AI assistant is taking a 30-minute break. Please order from our cashier directly.",
    "aiModelPreference": "gpt-4o"
  }
}
```

---

## 🍽️ POS Menu & Kitchen Operations (`/api/v1/*`)

| Module & Route | Allowed Operations & RBAC | Description & Caching Mechanics |
|---|---|---|
| **Branches (`/api/v1/branches`)** | `POST`, `GET`, `PUT`, `DELETE` (`owner`, `manager`) | Storefront management with compound index (`tenantId` + `branchId`). |
| **Categories (`/api/v1/categories`)** | `POST`, `GET`, `PUT`, `DELETE` (`owner`, `manager`) | Menu organization sorted by `displayOrder`. |
| **Products (`/api/v1/products`)** | `POST`, `GET`, `PUT`, `DELETE` (`owner`, `manager`) | Dish items linked with pricing and customization variants. |
| **Menu Catalog (`/api/v1/menu/catalog`)**| `GET` (**Public Guest / QR Scanning**) | Returns full organized menu; automatically cached via Upstash Redis. |
| **Bulk Import (`/api/v1/menu/bulk-import`)**| `POST` (`super_admin`, `owner`, `manager`) | Atomic transactional insertion of categories, dishes, and variants in one request; invalidates menu cache instantly. |
| **Tables & QR (`/api/v1/tables`)** | `POST`, `GET`, `DELETE` (`owner`, `manager`); `GET /qr/:token` is Public | Dining tables paired with unforgeable SHA cryptographic QR tokens. |
| **POS Orders (`/api/v1/orders`)** | `POST /`, `PATCH /:id`, `POST /offline-sync` | POS checkout ticket lifecycle and offline batch synchronization recovery. |

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
