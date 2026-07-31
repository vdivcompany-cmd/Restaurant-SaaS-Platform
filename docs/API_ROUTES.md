# API Routes Reference — Restaurant SaaS Platform

This document maintains a living catalog of all completed API endpoints in the system. It is updated at the conclusion of every phase per [PROJECT_RULES.md](file:///d:/Restaurant%20SaaS%20Platform/docs/PROJECT_RULES.md).

---

## Overview

- **Base URL:** `/api/v1`
- **Authentication Header:** `Authorization: Bearer <access_token>`
- **Tenant Header (Bot / Public Context):** `X-Tenant-Slug: <tenant_slug>` or `X-Tenant-Id: <tenant_id>`

---

## Active Endpoints

### 🩺 Health & Reliability Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | Public | Liveness probe returning process status, uptime, and timestamp |
| `GET` | `/live` | Public | Liveness probe alias for container/k8s orchestration checks |
| `GET` | `/ready` | Public | Readiness probe checking live connectivity to MongoDB Atlas, Upstash Redis, CloudAMQP RabbitMQ, and Firebase Admin SDK |

---

### 🔑 Authentication Module (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register/super-admin` | Public | Register a new platform Super Admin account (testing) |
| `POST` | `/api/v1/auth/register/owner` | Auth (`super_admin`) | Create first owner account for a tenant |
| `POST` | `/api/v1/auth/register/staff` | Auth + Tenant (`owner`, `manager`, `super_admin`) | Invite staff member (manager, cashier, kitchen) to a tenant |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user via tenantId or tenantSlug |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token and issue new token pair |
| `POST` | `/api/v1/auth/logout` | Auth | Invalidate current user refresh token & access token |
| `POST` | `/api/v1/auth/change-password` | Auth + Tenant | Change current user password |

---

### 🏬 Tenants Module (`/api/v1/tenants`)

| Method | Endpoint | Auth | Roles Allowed | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/tenants` | Public | None | Create a new tenant (Trial mode) |
| `GET` | `/api/v1/tenants/me` | Auth + Tenant | `owner`, `manager` | Get current tenant profile |
| `GET` | `/api/v1/tenants/:id` | Auth + Tenant | `owner`, `manager` | Get tenant profile by ID (isolated) |
| `PATCH` | `/api/v1/tenants/settings` | Auth + Tenant | `owner` | Update current tenant settings & contact |
| `PATCH` | `/api/v1/tenants/:id/settings` | Auth + Tenant | `owner` | Update tenant settings by ID (isolated) |

---

### 📋 Subscriptions Module (`/api/v1/subscriptions`)

| Method | Endpoint | Auth | Roles Allowed | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/subscriptions` | Auth + Tenant | `owner`, `manager` | Get the active subscription for the current tenant |
| `PATCH` | `/api/v1/subscriptions` | Auth + Tenant | `owner` | Update subscription plan/status |

---

### 💳 Billing Module (`/api/v1/billing`)

| Method | Endpoint | Auth | Roles Allowed | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/billing` | Auth + Tenant | `owner`, `manager` | List all billing records (most recent first) |
| `GET` | `/api/v1/billing/:id` | Auth + Tenant | `owner`, `manager` | Get a specific billing record by ID |
| `POST` | `/api/v1/billing` | Auth + Tenant | `owner` | Create a billing record |

---

### 🍽️ Phase 3 — Core Domain Modules (`/api/v1/*`)

All domain endpoints require `Authorization: Bearer <token>` and `tenantMiddleware` scoping, except for guest QR digital menu retrieval and table resolving which resolve tenant context via URL query parameters or headers (`X-Tenant-Id` / `X-Tenant-Slug`).

| Module | Base Route | Key Operations | Roles Allowed / Public Note |
|---|---|---|---|
| **Branches** | `/api/v1/branches` | `POST`, `GET`, `PUT`, `DELETE` | `owner`, `manager` (Super Admin bypass) |
| **Restaurants** | `/api/v1/restaurants/profile` | `GET`, `PUT` | `owner`, `manager` |
| **Categories** | `/api/v1/categories` | `POST`, `GET`, `PUT`, `DELETE` | `owner`, `manager` |
| **Variants** | `/api/v1/variants` | `POST`, `GET`, `PUT`, `DELETE` | `owner`, `manager` |
| **Products** | `/api/v1/products` | `POST`, `GET`, `PUT`, `DELETE` | `owner`, `manager` (Full Manager & Super Admin editing) |
| **Menu Catalog** | `/api/v1/menu` or `/api/v1/menu/catalog` | `GET /api/v1/menu?tenantId=...` | **Public Guest Access** (Served via Upstash Redis cache) |
| **Tables & QR** | `/api/v1/tables` | `POST /api/v1/tables`, `GET /qr/:token` | `owner`, `manager` for management; `/qr/:token` is Public |
| **Orders & Sync**| `/api/v1/orders` | `POST /`, `PATCH /:id`, `POST /offline-sync` | Automated table state transitions & `offlineGuid` POS deduplication |
| **Coupons** | `/api/v1/coupons` | `POST /`, `GET /validate?code=...` | `owner`, `manager` for creation; Auth for validation |
| **Customers** | `/api/v1/customers` | `POST /`, `GET /` | Auth + Tenant scoping |
| **Employees** | `/api/v1/employees` | `POST /`, `GET /`, `PUT /`, `DELETE /` | `owner`, `manager` |
| **Feedback** | `/api/v1/feedback` | `POST /`, `GET /` | `POST` requires `X-Tenant-Id` header or query param |
| **Reports** | `/api/v1/reports/sales` | `GET /sales?branchId=...` | `owner`, `manager` (Real-time Mongoose aggregation) |

---

### ⚙️ Phase 4 — Integrations Gateway (`/api/v1/*`)

| Method | Endpoint | Auth | Roles Allowed | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/menu/bulk-import` | Auth + Tenant | `super_admin`, `owner`, `manager` | Atomic batch ingestion of Categories, Variants, and Products (manual or via external automation pipeline), clearing Redis menu cache. |
| `POST` | `/api/v1/integrations/n8n/webhook` | Webhook Signature | External n8n | Incoming n8n workflow callback endpoint protected by HMAC SHA-256 signature verification (`X-N8N-Signature`). |

#### Bulk Import Data Contract Example
```json
{
  "categories": [
    {
      "name": "Wood-Fired Pizzas",
      "displayOrder": 1,
      "products": [
        {
          "name": "Truffle Mushroom Pizza",
          "description": "Wild mushrooms, mozzarella, truffle oil spray",
          "basePrice": 280.00,
          "variants": [
            {
              "name": "Crust Selection",
              "minSelect": 1,
              "maxSelect": 1,
              "options": [
                { "name": "Classic Neapolitan", "priceDelta": 0 },
                { "name": "Cheese Stuffed Crust", "priceDelta": 35 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```
