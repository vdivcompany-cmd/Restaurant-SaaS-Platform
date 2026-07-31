# Postman Collection & API Endpoints Guide — Restaurant SaaS Platform

This document serves as the master **Postman Reference & Integration Manual** for the Restaurant SaaS Platform. It provides exact endpoint URLs, required authentication headers, query parameters, RBAC permissions, and copy-pasteable JSON request/response payloads grouped logically by operational domain and user role.

> [!IMPORTANT]
> **Living Documentation Rule:** This file MUST be updated whenever new routes, webhooks, or feature endpoints are introduced. Every endpoint must specify its required HTTP headers, authorization role requirements, and practical JSON examples.

---

## 🛠️ Postman Environment Configuration

Create a dedicated Postman Environment named **`Restaurant SaaS (Local / Staging)`** and add the following core variables. Using `{{variable_name}}` syntax in URLs and headers allows seamless switching between local development and cloud production deployments.

| Variable Name | Initial / Example Value | Description |
|---|---|---|
| `base_url` | `http://localhost:3000/api/v1` | Root API path prefix |
| `tenant_id` | `6a6b3e8447dedf5d12fef0c5` | Target restaurant tenant MongoDB ObjectId |
| `tenant_slug` | `burger-house` | Readable URL-friendly identifier for headers (`X-Tenant-Slug`) |
| `super_admin_token` | `eyJhbGciOi...` | JWT Access Token for Ecosystem Super Admin |
| `owner_token` | `eyJhbGciOi...` | JWT Access Token for Restaurant Owner |
| `manager_token` | `eyJhbGciOi...` | JWT Access Token for Restaurant Branch Manager |
| `cashier_token` | `eyJhbGciOi...` | JWT Access Token for POS Register Cashier |
| `branch_id` | `6a6b3e8447dedf5d12fef0c4` | Store branch MongoDB ObjectId |
| `category_id` | `6a6b3e8447dedf5d12fef0c3` | Menu category MongoDB ObjectId |
| `variant_id` | `6a6b3e8447dedf5d12fef0c2` | Customization variant option set ObjectId |
| `product_id` | `6a6b3e8447dedf5d12fef0c1` | Food item product SKU ObjectId |
| `table_id` | `6a6b3e8447dedf5d12fef0c0` | Dining table MongoDB ObjectId |
| `qr_code_token` | `qr_8f9e2a1c4b7d5f6a9e2c1b` | Cryptographically signed table QR token |
| `order_id` | `6a6b3e8447dedf5d12fef0bf` | Active ticket order ObjectId |
| `customer_id` | `6a6b3e8447dedf5d12fef0be` | Customer CRM profile ObjectId |
| `employee_id` | `6a6b3e8447dedf5d12fef0bd` | Staff employee ObjectId |
| `coupon_id` | `6a6b3e8447dedf5d12fef0bc` | Promo coupon ObjectId |

---

## 🌐 0. System Probes & Health Checks

These endpoints operate synchronously to provide instant uptime and readiness diagnostics for cloud load balancers and orchestrators.

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/` | Public | Root welcome route returning platform runtime metadata |
| `GET` | `/health` | Public | Fast container readiness probe |
| `GET` | `/live` | Public | Liveness probe checking Node.js event loop health |
| `GET` | `/ready` | Public | Full readiness probe checking MongoDB, Redis, RabbitMQ & Firebase connections |

### 0.1 Service Readiness Check
* **Method:** `GET`
* **URL:** `http://localhost:3000/ready`
* **Auth:** Public

**Response (200 OK):**
```json
{
  "status": "ok",
  "services": {
    "mongodb": { "status": "ok" },
    "redis": { "status": "ok", "latencyMs": 8 },
    "rabbitmq": { "status": "ok" },
    "firebase": { "status": "ok" }
  },
  "timestamp": "2026-07-31T21:55:00.000Z"
}
```

---

## 🛡️ 1. Platform Super Admin Operations (`super_admin`)

Super Admin accounts exist at the global ecosystem scope and manage tenant onboarding and platform operations.

### 1.1 Register Platform Super Admin Account
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/register/super-admin`
* **Auth:** Public (Initial Setup)
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "email": "superadmin@saas-ecosystem.com",
  "password": "SuperSecretAdminPassword2026!",
  "phone": "+201000000001"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6a6b48a90192837465012345",
      "email": "superadmin@saas-ecosystem.com",
      "role": "super_admin"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi...",
      "expiresIn": 900
    }
  }
}
```

### 1.2 Onboard New Restaurant Tenant
* **Method:** `POST`
* **URL:** `{{base_url}}/tenants`
* **Auth:** Bearer `{{super_admin_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "name": "Gourmet Stone Oven Pizza",
  "slug": "gourmet-pizza-cairo",
  "contact": {
    "phone": "+201122334455",
    "email": "owner@gourmetpizza.eg"
  },
  "settings": {
    "currency": "EGP",
    "timezone": "Africa/Cairo",
    "language": "en"
  }
}
```

### 1.3 Provision First Restaurant Owner User Account
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/register/owner`
* **Auth:** Bearer `{{super_admin_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "tenantId": "{{tenant_id}}",
  "email": "owner@gourmetpizza.eg",
  "password": "SecureOwnerPassword2026!",
  "phone": "+201098765432"
}
```

---

## 👔 2. Restaurant Owner & Management (`owner`, `manager`)

### 2.1 Authenticate User (Login)
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/login`
* **Auth:** Public
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "email": "owner@gourmetpizza.eg",
  "password": "SecureOwnerPassword2026!",
  "tenantSlug": "gourmet-pizza-cairo"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6a6b48a90192837465012345",
      "email": "owner@gourmetpizza.eg",
      "role": "owner",
      "tenantId": "6a6b3e8447dedf5d12fef0c5"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

### 2.2 Register Staff Member Account (Manager, Cashier, Kitchen)
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/register/staff`
* **Auth:** Bearer `{{owner_token}}` or `{{manager_token}}`
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "email": "cashier.zamalek@gourmetpizza.eg",
  "password": "CashierPassword123!",
  "role": "cashier",
  "phone": "+201011223344"
}
```

### 2.3 Rotate Access & Refresh Tokens
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/refresh`
* **Auth:** Public
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

### 2.4 Logout Session
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/logout`
* **Auth:** Bearer `{{manager_token}}`

---

## 🏬 3. Tenant Workspace & Subscription Management

### 3.1 Get Tenant Workspace Details
* **Method:** `GET`
* **URL:** `{{base_url}}/tenants/me`
* **Auth:** Bearer `{{owner_token}}` or `{{manager_token}}`
* **Headers:** `X-Tenant-Id: {{tenant_id}}`

### 3.2 Update Tenant Settings
* **Method:** `PATCH`
* **URL:** `{{base_url}}/tenants/settings`
* **Auth:** Bearer `{{owner_token}}`
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "name": "Gourmet Wood-Fired Pizza & Kitchen",
  "settings": {
    "currency": "EGP",
    "timezone": "Africa/Cairo",
    "language": "ar"
  }
}
```

### 3.3 Retrieve Active Subscription
* **Method:** `GET`
* **URL:** `{{base_url}}/subscriptions`
* **Auth:** Bearer `{{owner_token}}` or `{{manager_token}}`
* **Headers:** `X-Tenant-Id: {{tenant_id}}`

### 3.4 Update Subscription Plan
* **Method:** `PATCH`
* **URL:** `{{base_url}}/subscriptions`
* **Auth:** Bearer `{{owner_token}}`
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "plan": "pro",
  "status": "active"
}
```

---

## 🍕 4. Restaurant Profile & AI Gateway Settings

### 4.1 Get Restaurant Profile
* **Method:** `GET`
* **URL:** `{{base_url}}/restaurants/profile`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `X-Tenant-Id: {{tenant_id}}`

### 4.2 Upsert Restaurant Profile & AI Settings
* **Method:** `PUT` (or `POST`)
* **URL:** `{{base_url}}/restaurants/profile`
* **Auth:** Bearer `{{owner_token}}` or `{{manager_token}}`
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "brandName": "Gourmet Stone Oven Pizza",
  "cuisineType": "Italian & Mediterranean",
  "description": "Authentic Neapolitan wood-fired pizza kitchen.",
  "isOpen": true,
  "isChatbotActive": true,
  "chatbotSettings": {
    "offlineMessage": "We are currently closed for online orders. Please check back during operating hours!",
    "aiModelPreference": "gpt-4o"
  }
}
```

### 4.3 n8n Cloud AI Status Probe (Public Gateway)
* **Method:** `GET`
* **URL:** `{{base_url}}/restaurants/{{tenant_id}}/ai-status`
* **Auth:** Public / n8n Cloud

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tenantId": "6a6b3e8447dedf5d12fef0c5",
    "brandName": "Gourmet Stone Oven Pizza",
    "currency": "EGP",
    "isOpen": true,
    "isChatbotActive": true,
    "canAnswer": true,
    "offlineReply": null,
    "aiModelPreference": "gpt-4o"
  }
}
```

---

## 🏢 5. Branch Location Management

### 5.1 Create Store Branch
* **Method:** `POST`
* **URL:** `{{base_url}}/branches`
* **Auth:** Bearer `{{owner_token}}` or `{{manager_token}}`
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "name": "Zamalek Flagship Branch",
  "slug": "zamalek-flagship",
  "address": "26 July Street, Zamalek, Cairo",
  "phone": "+20227350000",
  "isActive": true
}
```

### 5.2 List All Branches
* **Method:** `GET`
* **URL:** `{{base_url}}/branches`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `X-Tenant-Id: {{tenant_id}}`

### 5.3 Update Branch
* **Method:** `PUT`
* **URL:** `{{base_url}}/branches/{{branch_id}}`
* **Auth:** Bearer `{{owner_token}}` or `{{manager_token}}`
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "phone": "+20227359999",
  "isActive": true
}
```

### 5.4 Delete Branch
* **Method:** `DELETE`
* **URL:** `{{base_url}}/branches/{{branch_id}}`
* **Auth:** Bearer `{{owner_token}}`
* **Headers:** `X-Tenant-Id: {{tenant_id}}`

---

## 📋 6. Menu Catalog, Categories, Variants & Products

### 6.1 Create Menu Category
* **Method:** `POST`
* **URL:** `{{base_url}}/categories`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "name": "Wood-Fired Pizzas",
  "description": "Hand-stretched sourdough crusts baked at 450°C",
  "displayOrder": 1
}
```

### 6.2 Create Customization Variant Option Set
* **Method:** `POST`
* **URL:** `{{base_url}}/variants`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "name": "Crust Style",
  "minSelect": 1,
  "maxSelect": 1,
  "options": [
    { "name": "Classic Neapolitan Thin", "priceDelta": 0 },
    { "name": "Mozzarella Stuffed Crust", "priceDelta": 45 },
    { "name": "Gluten-Free Cauliflower Base", "priceDelta": 30 }
  ]
}
```

### 6.3 Create Product SKU (Food Item)
* **Method:** `POST`
* **URL:** `{{base_url}}/products`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "categoryId": "{{category_id}}",
  "name": "Truffle & Wild Mushroom Pizza",
  "description": "Porcini mushrooms, fresh fontina cheese, thyme, and black truffle oil spray",
  "basePrice": 320,
  "imageUrl": "https://res.cloudinary.com/demo/image/upload/sample_pizza.jpg",
  "isAvailable": true,
  "variantIds": ["{{variant_id}}"]
}
```

### 6.4 Public Guest Digital Menu Catalog
* **Method:** `GET`
* **URL:** `{{base_url}}/menu/catalog?tenantId={{tenant_id}}`
* **Auth:** Public
* **Headers:** `X-Tenant-Id: {{tenant_id}}` (or query param `?tenantId=...`)

### 6.5 Bulk Import Full Menu (Atomic Transaction)
* **Method:** `POST`
* **URL:** `{{base_url}}/menu/bulk-import`
* **Auth:** Bearer `{{super_admin_token}}`, `{{owner_token}}`, or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "categories": [
    {
      "name": "Wood-Fired Pizzas",
      "displayOrder": 1,
      "products": [
        {
          "name": "Truffle Mushroom Pizza",
          "description": "Wild mushrooms, fontina, black truffle oil",
          "basePrice": 320,
          "variants": [
            {
              "name": "Crust Style",
              "minSelect": 1,
              "maxSelect": 1,
              "options": [
                { "name": "Classic Thin", "priceDelta": 0 },
                { "name": "Cheese Stuffed", "priceDelta": 45 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### 6.6 n8n Cloud RAG Vector Menu Extract
* **Method:** `GET`
* **URL:** `{{base_url}}/menu/rag-catalog/{{tenant_id}}`
* **Auth:** Public / n8n Cloud

---

## 🪑 7. Dining Tables & QR Token Resolution

### 7.1 Resolve QR Token to Dining Table (Public Scan)
* **Method:** `GET`
* **URL:** `{{base_url}}/tables/qr/{{qr_code_token}}`
* **Auth:** Public

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "6a6b3e8447dedf5d12fef0c0",
    "branchId": "6a6b3e8447dedf5d12fef0c4",
    "number": 10,
    "capacity": 6,
    "status": "AVAILABLE",
    "qrCodeToken": "qr_8f9e2a1c4b7d5f6a9e2c1b"
  }
}
```

### 7.2 Create Store Table & Generate QR Token
* **Method:** `POST`
* **URL:** `{{base_url}}/tables`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "branchId": "{{branch_id}}",
  "number": 10,
  "capacity": 6,
  "status": "AVAILABLE"
}
```

### 7.3 Update Table Status
* **Method:** `PUT`
* **URL:** `{{base_url}}/tables/{{table_id}}`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "status": "OCCUPIED"
}
```

---

## 🧾 8. POS Ticket Orders & KDS Workflow

### 8.1 Create Dine-In / Takeaway Ticket Order
* **Method:** `POST`
* **URL:** `{{base_url}}/orders`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}` (or Public Guest with `X-Tenant-Id`)
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "branchId": "{{branch_id}}",
  "channel": "DINE_IN",
  "tableId": "{{table_id}}",
  "items": [
    {
      "productId": "{{product_id}}",
      "name": "Truffle & Wild Mushroom Pizza",
      "quantity": 2,
      "unitPrice": 320,
      "totalPrice": 640,
      "selectedVariants": [
        {
          "variantId": "{{variant_id}}",
          "selectedOptionNames": ["Mozzarella Stuffed Crust"]
        }
      ]
    }
  ],
  "subtotal": 640,
  "taxAmount": 89.6,
  "totalAmount": 729.6
}
```

### 8.2 Kitchen Display System (KDS) Order Status Transition
* **Method:** `PATCH`
* **URL:** `{{base_url}}/orders/{{order_id}}`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "status": "PREPARING"
}
```
*(Valid lifecycle statuses: `PENDING`, `PREPARING`, `READY`, `SERVED`, `PAID`, `CANCELLED`)*

### 8.3 POS Offline Batch Sync with Replay Deduplication
* **Method:** `POST`
* **URL:** `{{base_url}}/orders/offline-sync`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "branchId": "{{branch_id}}",
  "orders": [
    {
      "branchId": "{{branch_id}}",
      "channel": "TAKEAWAY",
      "items": [
        {
          "productId": "{{product_id}}",
          "quantity": 1,
          "unitPrice": 320,
          "totalPrice": 320
        }
      ],
      "subtotal": 320,
      "totalAmount": 320,
      "offlineGuid": "pos-terminal-01-tx-9921004"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "synced": 1,
    "skipped": 0
  }
}
```

---

## 🏷️ 9. Promotional Coupons & Customer CRM

### 9.1 Create Promo Coupon
* **Method:** `POST`
* **URL:** `{{base_url}}/coupons`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "code": "SUMMERPIZZA20",
  "discountPercentage": 20,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "isActive": true
}
```

### 9.2 Validate Promo Coupon at Checkout
* **Method:** `GET`
* **URL:** `{{base_url}}/coupons/validate?code=SUMMERPIZZA20`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `X-Tenant-Id: {{tenant_id}}`

### 9.3 Register Customer CRM Profile
* **Method:** `POST`
* **URL:** `{{base_url}}/customers`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "name": "Tariq Al-Mansour",
  "phone": "+201099887766",
  "email": "tariq@vipguest.eg"
}
```

---

## 👥 10. Staff Employees, Guest Feedback & Analytics

### 10.1 Hire & Register Store Employee
* **Method:** `POST`
* **URL:** `{{base_url}}/employees`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "branchId": "{{branch_id}}",
  "fullName": "Chef Marco Rossi",
  "position": "Head Pizzaiolo",
  "phone": "+201112223333",
  "hourlyRate": 180,
  "isActive": true
}
```

### 10.2 Submit Guest Dining Feedback & Rating (Public)
* **Method:** `POST`
* **URL:** `{{base_url}}/feedback`
* **Auth:** Public
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "branchId": "{{branch_id}}",
  "customerName": "Tariq Al-Mansour",
  "rating": 5,
  "comment": "Outstanding stone-oven crust pizza and fast staff service!"
}
```

### 10.3 Analytical Sales Report Snapshot
* **Method:** `GET`
* **URL:** `{{base_url}}/reports/sales?branchId={{branch_id}}&startDate=2026-07-01T00:00:00.000Z&endDate=2026-07-31T23:59:59.000Z`
* **Auth:** Bearer `{{owner_token}}` or `{{manager_token}}`
* **Headers:** `X-Tenant-Id: {{tenant_id}}`

### 10.4 Dispatch System Notification (Audit Trail Integration)
* **Method:** `POST`
* **URL:** `{{base_url}}/notifications/dispatch`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "channel": "EMAIL",
  "recipient": "guest.vip@gmail.com",
  "subject": "Table Reservation Confirmation",
  "message": "Your table reservation at Gourmet Stone Oven Pizza for 8:00 PM is confirmed!"
}
```

---

## 💳 11. Billing Invoices & Financial Ledger

### 11.1 List Tenant Billing Records
* **Method:** `GET`
* **URL:** `{{base_url}}/billing`
* **Auth:** Bearer `{{owner_token}}` or `{{manager_token}}`
* **Headers:** `X-Tenant-Id: {{tenant_id}}`

### 11.2 Create Billing Record
* **Method:** `POST`
* **URL:** `{{base_url}}/billing`
* **Auth:** Bearer `{{owner_token}}`
* **Headers:** `Content-Type: application/json`, `X-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "amount": 2499,
  "currency": "EGP",
  "status": "paid",
  "paymentMethod": "credit_card",
  "invoiceUrl": "https://billing.saas-platform.com/invoices/INV-2026-07-001.pdf"
}
```

---
