# API Routes Reference — Restaurant SaaS Platform

This document maintains a living catalog of all completed API endpoints in the system. It is updated at the conclusion of every phase per [PROJECT_RULES.md](file:///d:/Restaurant%20SaaS%20Platform/docs/PROJECT_RULES.md).

---

## Overview

- **Base URL:** `/api/v1`
- **Authentication Header:** `Authorization: Bearer <access_token>`
- **Tenant Header (Bot / Public Context):** `X-Tenant-Slug: <tenant_slug>` or `X-Tenant-Id: <tenant_id>`

---

## Active Endpoints

### 🔑 Authentication Module (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register a new user under a specific tenant |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user via tenantId or tenantSlug |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token and issue new token pair |
| `POST` | `/api/v1/auth/logout` | Auth | Invalidate current user refresh token & access token |
| `POST` | `/api/v1/auth/change-password` | Auth + Tenant | Change current user password |

#### Payload & Response Examples

<details>
<summary><b>POST /api/v1/auth/register</b></summary>

**Request Body:**
```json
{
  "tenantId": "65f1a2b3c4d5e6f7a8b9c0d1",
  "email": "manager@restaurant.com",
  "password": "securepassword123",
  "role": "manager",
  "phone": "+201001234567"
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "tenantId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "email": "manager@restaurant.com",
      "role": "manager",
      "phone": "+201001234567"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": 900
    }
  }
}
```
</details>

<details>
<summary><b>POST /api/v1/auth/login</b></summary>

**Request Body:**
```json
{
  "tenantSlug": "burger-house",
  "email": "manager@restaurant.com",
  "password": "securepassword123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "tenantId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "email": "manager@restaurant.com",
      "role": "manager"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": 900
    }
  }
}
```
</details>

---

### 🏬 Tenants Module (`/api/v1/tenants`)

| Method | Endpoint | Auth | Roles Allowed | Description |
|---|---|---|---|---|
| `POST` | `/api/v1/tenants` | Public | None | Create a new tenant (Trial mode) |
| `GET` | `/api/v1/tenants/me` | Auth + Tenant | `owner`, `manager` | Get current tenant profile |
| `GET` | `/api/v1/tenants/:id` | Auth + Tenant | `owner`, `manager` | Get tenant profile by ID (isolated) |
| `PATCH` | `/api/v1/tenants/settings` | Auth + Tenant | `owner` | Update current tenant settings & contact |
| `PATCH` | `/api/v1/tenants/:id/settings` | Auth + Tenant | `owner` | Update tenant settings by ID (isolated) |

#### Payload & Response Examples

<details>
<summary><b>POST /api/v1/tenants</b></summary>

**Request Body:**
```json
{
  "name": "Burger House",
  "slug": "burger-house",
  "contact": {
    "phone": "+201001234567",
    "email": "info@burgerhouse.com"
  },
  "settings": {
    "currency": "EGP",
    "timezone": "Africa/Cairo",
    "language": "ar"
  }
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Burger House",
    "slug": "burger-house",
    "status": "trial",
    "subscriptionPlan": "free",
    "contact": {
      "phone": "+201001234567",
      "email": "info@burgerhouse.com"
    },
    "settings": {
      "currency": "EGP",
      "timezone": "Africa/Cairo",
      "language": "ar"
    },
    "createdAt": "2026-07-30T07:00:00.000Z"
  }
}
```
</details>

---

### 📋 Subscriptions Module (`/api/v1/subscriptions`)

| Method | Endpoint | Auth | Roles Allowed | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/subscriptions` | Auth + Tenant | `owner`, `manager` | Get the active subscription for the current tenant |
| `PATCH` | `/api/v1/subscriptions` | Auth + Tenant | `owner` | Update subscription plan/status |

<details>
<summary><b>GET /api/v1/subscriptions — Success Response (200 OK)</b></summary>

```json
{
  "success": true,
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d3",
    "tenantId": "65f1a2b3c4d5e6f7a8b9c0d1",
    "plan": "free",
    "status": "trialing",
    "createdAt": "2026-07-30T07:00:00.000Z"
  }
}
```
</details>

<details>
<summary><b>PATCH /api/v1/subscriptions — Request Body</b></summary>

**Request Body:**
```json
{
  "plan": "pro",
  "status": "active",
  "expiresAt": "2027-07-30T00:00:00.000Z"
}
```
</details>

---

### 💳 Billing Module (`/api/v1/billing`)

| Method | Endpoint | Auth | Roles Allowed | Description |
|---|---|---|---|---|
| `GET` | `/api/v1/billing` | Auth + Tenant | `owner`, `manager` | List all billing records (most recent first) |
| `GET` | `/api/v1/billing/:id` | Auth + Tenant | `owner`, `manager` | Get a specific billing record by ID |
| `POST` | `/api/v1/billing` | Auth + Tenant | `owner` | Create a billing record (after Paymob HMAC verification) |

> **Note:** Paymob webhook callbacks use a dedicated `POST /api/v1/webhooks/paymob` route with HMAC verification, added in the Paymob/billing phase.

<details>
<summary><b>GET /api/v1/billing — Success Response (200 OK)</b></summary>

```json
{
  "success": true,
  "data": [
    {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d4",
      "tenantId": "65f1a2b3c4d5e6f7a8b9c0d1",
      "amount": 2999,
      "currency": "EGP",
      "status": "paid",
      "provider": "paymob",
      "providerRef": "paymob_txn_123456",
      "createdAt": "2026-07-30T07:00:00.000Z"
    }
  ]
}
```
</details>
