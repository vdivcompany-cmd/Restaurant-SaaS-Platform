# Postman Collection & API Endpoints Guide

This document serves as the master **Postman Reference & Integration Manual** for the Restaurant SaaS Platform. It provides exact endpoint URLs, required authentication headers, query parameters, and copy-pasteable JSON request/response payloads grouped by operational user role.

> [!IMPORTANT]
> **Living Documentation Rule:** This file MUST be updated at the conclusion of every development phase whenever new routes, webhooks, or features are introduced. Every endpoint must include clear descriptions, roles allowed, and practical JSON code examples.

---

## 🛠️ Postman Environment Configuration

Create a dedicated Postman Environment named **`Restaurant SaaS (Local / Staging)`** and add the following core variables. Using `{{variable_name}}` syntax in your URLs and headers allows you to seamlessly switch between local testing and production servers without rewriting requests.

| Variable Name | Initial Value | Description |
|---|---|---|
| `base_url` | `http://localhost:3000/api/v1` | Root base API path |
| `tenant_id` | `6a6b3e8447dedf5d12fef0c5` | Active test restaurant MongoDB ObjectID |
| `tenant_slug` | `burger-house` | Readable URL-friendly identifier for headers/links |
| `super_admin_token` | `eyJhbGciOi...` | JWT Access Token for Platform Super Admin |
| `manager_token` | `eyJhbGciOi...` | JWT Access Token for Restaurant Owner/Manager |
| `cashier_token` | `eyJhbGciOi...` | JWT Access Token for POS Register/Cashier |
| `branch_id` | `6a6b3e8447dedf5d12fef0c4` | Created store branch ObjectID |
| `category_id` | `6a6b3e8447dedf5d12fef0c3` | Created menu category ObjectID |
| `variant_id` | `6a6b3e8447dedf5d12fef0c2` | Created customization variant ObjectID |
| `product_id` | `6a6b3e8447dedf5d12fef0c1` | Created food dish SKU ObjectID |
| `table_id` | `6a6b3e8447dedf5d12fef0c0` | Created dining table ObjectID |
| `qr_code_token` | `qr_8f9e2a1c4b7d5f6a9e2c1b` | Automatically generated cryptographically signed QR token |
| `order_id` | `6a6b3e8447dedf5d12fef0bf` | Active ticket order ObjectID |

---

## 📁 Folder 1: 🛡️ Platform Super Admin (Ecosystem Owner)

As the creator and owner of the SaaS ecosystem, the `super_admin` role possesses overriding privileges across all tenant environments. Super Admins bypass standard RBAC barriers and can target any client restaurant by passing custom headers (`X-Target-Tenant-Id` or `X-Tenant-Id`).

### 1.1 Register Super Admin Account
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/register/super-admin`
* **Auth:** Public (Testing)
* **Headers:** `Content-Type: application/json`

> [!TIP]
> **Global Root Scope:** Platform Super Admin accounts exist above client restaurants. Do NOT include a `tenantId` when creating or logging into your ecosystem master account!

**Request Body (JSON):**
```json
{
  "email": "superadmin@restaurant-saas-ecosystem.com",
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
      "email": "superadmin@restaurant-saas-ecosystem.com",
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

### 1.2 Login as Super Admin
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/login`
* **Auth:** Public
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "email": "superadmin@restaurant-saas-ecosystem.com",
  "password": "SuperSecretAdminPassword2026!"
}
```

### 1.3 Create New Restaurant Tenant (SaaS Client Onboarding)
* **Method:** `POST`
* **URL:** `{{base_url}}/tenants`
* **Auth:** Public or Super Admin
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

### 1.4 Super Admin: Cross-Tenant Menu Audit & Inspection
* **Method:** `GET`
* **URL:** `{{base_url}}/menu/catalog?tenantId={{tenant_id}}`
* **Auth:** Bearer `{{super_admin_token}}`
* **Description:** Retrieve the complete digital menu catalog for any target restaurant without logging in as their manager.

### 1.5 Super Admin: Override Restaurant Profile Settings
* **Method:** `PUT`
* **URL:** `{{base_url}}/restaurants/profile`
* **Auth:** Bearer `{{super_admin_token}}`
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Target-Tenant-Id: {{tenant_id}}`

**Request Body (JSON):**
```json
{
  "brandName": "Gourmet Stone Oven Pizza & Italian Kitchen",
  "cuisineType": "Italian & Mediterranean",
  "currency": "EGP",
  "description": "Authentic Neapolitan wood-fired dining experience."
}
```

---

## 📁 Folder 2: 👔 Restaurant Owner & Manager (`owner`, `manager`)

These endpoints power the management dashboard where business operators configure physical branch locations, hire employees, build digital menus, and monitor gross revenue.

### 2.1 Register Restaurant Manager Account
* **Method:** `POST`
* **URL:** `{{base_url}}/auth/register`
* **Auth:** Public
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "tenantId": "{{tenant_id}}",
  "email": "manager@gourmetpizza.eg",
  "password": "SecureManagerPassword123!",
  "role": "manager",
  "phone": "+201098765432"
}
```

### 2.2 Create Storefront Branch Location
* **Method:** `POST`
* **URL:** `{{base_url}}/branches`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

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

### 2.3 Create Menu Category
* **Method:** `POST`
* **URL:** `{{base_url}}/categories`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "name": "Wood-Fired Pizzas",
  "description": "Hand-stretched authentic sourdough crusts baked at 450°C",
  "displayOrder": 1
}
```

### 2.4 Create Customization Variant (Menu Modifiers)
* **Method:** `POST`
* **URL:** `{{base_url}}/variants`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "name": "Crust Style & Cheese stuffed",
  "minSelect": 1,
  "maxSelect": 1,
  "options": [
    { "name": "Classic Neapolitan Thin", "priceDelta": 0 },
    { "name": "Mozzarella Stuffed Crust", "priceDelta": 45 },
    { "name": "Gluten-Free Cauliflower Base", "priceDelta": 30 }
  ]
}
```

### 2.5 Create Dish Product SKU
* **Method:** `POST`
* **URL:** `{{base_url}}/products`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

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

### 2.6 Edit Existing Product Details (Manager / Super Admin)
* **Method:** `PUT`
* **URL:** `{{base_url}}/products/{{product_id}}`
* **Auth:** Bearer `{{manager_token}}` or `{{super_admin_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "basePrice": 350,
  "description": "Porcini mushrooms, premium fontina cheese, fresh oregano, and white truffle oil"
}
```

### 2.7 Create Dining Floor Table & Generate QR Code Token
* **Method:** `POST`
* **URL:** `{{base_url}}/tables`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "branchId": "{{branch_id}}",
  "number": 10,
  "capacity": 6,
  "status": "AVAILABLE"
}
```

### 2.8 Hire & Register Kitchen Employee Staff
* **Method:** `POST`
* **URL:** `{{base_url}}/employees`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

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

### 2.9 Create Promotional Discount Coupon
* **Method:** `POST`
* **URL:** `{{base_url}}/coupons`
* **Auth:** Bearer `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "code": "SUMMERPIZZA20",
  "discountPercentage": 20,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "isActive": true
}
```

### 2.10 Generate Real-Time Sales & Revenue Analytics
* **Method:** `GET`
* **URL:** `{{base_url}}/reports/sales?branchId={{branch_id}}`
* **Auth:** Bearer `{{manager_token}}` or `{{super_admin_token}}`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tenantId": "6a6b3e8447dedf5d12fef0c5",
    "branchId": "6a6b3e8447dedf5d12fef0c4",
    "totalOrders": 142,
    "paidOrders": 138,
    "totalRevenue": 48560
  }
}
```

---

## 📁 Folder 3: 🖥️ POS Terminal, Cashier & Kitchen Staff (`cashier`, `kitchen`, `waiter`)

These routes handle everyday dine-in ticket creation, checkout billing, table occupancy automation, and offline register synchronization.

### 3.1 Create Dine-In Table Order (Automated Table Lock)
* **Method:** `POST`
* **URL:** `{{base_url}}/orders`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

> [!TIP]
> **Automated Floor Plan Effect:** When an order is successfully placed for a table with channel `DINE_IN`, our system automatically alters the table's state from `AVAILABLE` to `OCCUPIED` without requiring extra API requests!

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
      "unitPrice": 350,
      "totalPrice": 700
    }
  ],
  "subtotal": 700,
  "taxAmount": 98,
  "totalAmount": 798
}
```

### 3.2 Kitchen Display System (KDS) Status Update
* **Method:** `PATCH`
* **URL:** `{{base_url}}/orders/{{order_id}}`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "status": "PREPARING"
}
```
*(Valid statuses: `PENDING`, `PREPARING`, `READY`, `SERVED`, `PAID`, `CANCELLED`)*

### 3.3 Settle Checkout Bill to PAID (Automated Table Release)
* **Method:** `PATCH`
* **URL:** `{{base_url}}/orders/{{order_id}}`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

> [!TIP]
> **Automated Table Release:** Updating an active table order's status to `PAID` automatically resets Table #10's status back to `AVAILABLE` and clears its `currentOrderId` hold!

**Request Body (JSON):**
```json
{
  "status": "PAID"
}
```

### 3.4 POS Offline-Sync & Duplicate Replay Defense
* **Method:** `POST`
* **URL:** `{{base_url}}/orders/offline-sync`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

> [!IMPORTANT]
> **Replay Deduplication Guarantee:** Every offline transaction MUST attach a unique `offlineGuid`. If poor WiFi causes a register to upload the exact same batch twice, our backend identifies duplicate GUIDs and ignores them (`{ "synced": 1, "skipped": 1 }`), ensuring zero double-billing!

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
          "name": "Truffle Pizza (Offline Ticket)",
          "quantity": 1,
          "unitPrice": 350,
          "totalPrice": 350
        }
      ],
      "subtotal": 350,
      "totalAmount": 350,
      "offlineGuid": "pos-guid-terminal01-txn-889977"
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

### 3.5 Register Customer CRM Profile
* **Method:** `POST`
* **URL:** `{{base_url}}/customers`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`
* **Headers:** `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "name": "Tariq Al-Mansour",
  "phone": "+201099887766",
  "email": "tariq@vipguest.eg"
}
```

### 3.6 Validate Promo Coupon at Checkout
* **Method:** `GET`
* **URL:** `{{base_url}}/coupons/validate?code=SUMMERPIZZA20`
* **Auth:** Bearer `{{cashier_token}}` or `{{manager_token}}`

---

## 📁 Folder 4: 📱 Unauthenticated Dining Guest (Public QR Code Scans)

> [!WARNING]
> **NO AUTHENTICATION REQUIRED:** Do NOT include a JWT Authorization Bearer token when executing these Postman calls. These endpoints represent customers using smartphone browsers to scan physical QR tags on their dining tables.

### 4.1 Scan Table QR Code Token (Resolve Floor Details)
* **Method:** `GET`
* **URL:** `{{base_url}}/tables/qr/{{qr_code_token}}`
* **Auth:** **None (Public)**

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "_id": "6a6b3e8447dedf5d12fef0c0",
    "number": 10,
    "capacity": 6,
    "status": "AVAILABLE",
    "qrCodeToken": "qr_8f9e2a1c4b7d5f6a9e2c1b"
  }
}
```

### 4.2 Retrieve Interactive Digital Menu (Served via Upstash Redis RAM)
* **Method:** `GET`
* **URL:** `{{base_url}}/menu/catalog?tenantId={{tenant_id}}`
* **Auth:** **None (Public)**

> [!TIP]
> **Tenant Resolution Fallback:** Our upgraded `tenantMiddleware` accepts the restaurant identifier either via custom headers (`X-Tenant-Id: {{tenant_id}}` / `X-Tenant-Slug: {{tenant_slug}}`) OR straight from the URL query parameter (`?tenantId={{tenant_id}}` / `?tenantSlug={{tenant_slug}}`).

### 4.3 Submit Guest Star Rating & Dining Feedback Review
* **Method:** `POST`
* **URL:** `{{base_url}}/feedback?tenantId={{tenant_id}}`
* **Auth:** **None (Public)**
* **Headers:** 
  * `Content-Type: application/json`
  * `X-Tenant-Id: {{tenant_id}}` *(or simply pass `?tenantId={{tenant_id}}` in URL)*

**Request Body (JSON):**
```json
{
  "branchId": "{{branch_id}}",
  "customerName": "Tariq Al-Mansour",
  "rating": 5,
  "comment": "Incredible truffle wood-fired pizza and super responsive service on Table #10!"
}
```

---

## 📁 Folder 5: ⚙️ Phase 4 — Integrations Gateway

### 5.1 Bulk Menu Import Gateway
* **Method:** `POST`
* **URL:** `{{base_url}}/menu/bulk-import`
* **Auth:** Bearer `{{super_admin_token}}`, `{{manager_token}}`
* **Headers:** `Content-Type: application/json`
* **Purpose:** Atomic batch ingestion of Categories, Variants, and Products (manual or via external automation pipelines), clearing Upstash Redis menu cache.

**Expected Data Contract Body (JSON):**
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
          "basePrice": 320.00,
          "variants": [
            {
              "name": "Crust Selection",
              "minSelect": 1,
              "maxSelect": 1,
              "options": [
                { "name": "Classic Neapolitan Thin", "priceDelta": 0 },
                { "name": "Mozzarella Stuffed Crust", "priceDelta": 45 }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### 5.2 External Cloud Automations & AI Agentic Integration
* **Method:** Standard REST (`GET`, `POST`, `PATCH`, `DELETE`)
* **Authentication:** Bearer JWT Token (`Authorization: Bearer {{owner_token}}`)
* **Purpose:** External automation workflows (such as custom cloud AI agents, Make.com, or n8n cloud tasks) integrate directly against standard REST endpoints (e.g. `POST /api/v1/orders` or `POST /api/v1/menu/bulk-import`) without requiring specialized proprietary receiver sub-modules.
* **Storage & Caching Assurance:** All external API requests immediately invoke Upstash Redis caching layers and multi-tenant Cloudinary asset folder isolating logic (`SaaS_Restaurants/{tenantId}/...`).

### 5.3 n8n Cloud Chatbot Status & Manager Switch Query
* **Method:** `GET`
* **URL:** `{{base_url}}/restaurants/{{tenant_id}}/ai-status`
* **Auth:** Public / n8n Cloud Integration
* **Purpose:** Ultra-fast operational query executed as Node #1 in external n8n chatbot workflows. Verifies whether the restaurant kitchen is open (`isOpen`) and whether the manager has active AI chat enabled (`isChatbotActive`). If `canAnswer` is false, n8n immediately aborts without executing LLM inference or RAG database lookup!

**Response (200 OK - Active & Open):**
```json
{
  "success": true,
  "data": {
    "tenantId": "6a6caa2fc2f7b5caa316ba3b",
    "brandName": "Gourmet Burger House",
    "currency": "EGP",
    "isOpen": true,
    "isChatbotActive": true,
    "canAnswer": true,
    "offlineReply": null,
    "aiModelPreference": "gpt-4o"
  }
}
```

**Response (200 OK - Manager Paused Chatbot / Kitchen Closed):**
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

### 5.4 n8n Cloud RAG Vector Menu Catalog Synchronization
* **Method:** `GET`
* **URL:** `{{base_url}}/menu/rag-catalog/{{tenant_id}}` (or simply `{{base_url}}/menu/rag-catalog` with `X-Tenant-Id` header)
* **Auth:** Public / n8n Cloud Integration
* **Purpose:** Exports all available menu items in a clean, token-optimized textual embedding format (`ragItems[*].text`) alongside precise pricing and availability metadata for direct ingestion into Upstash Vector database namespaces.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tenantId": "6a6caa2fc2f7b5caa316ba3b",
    "count": 1,
    "ragItems": [
      {
        "id": "6a6cbb8a0192837465000111",
        "text": "Dish: Truffle Mushroom Pizza | Category: Wood-Fired Pizzas | Base Price: 320 EGP | Description: Wild mushrooms, mozzarella, truffle oil spray | Variants available: [Classic Neapolitan Thin (+0 EGP), Mozzarella Stuffed Crust (+45 EGP)] | Available: Yes",
        "metadata": {
          "productId": "6a6cbb8a0192837465000111",
          "categoryName": "Wood-Fired Pizzas",
          "basePrice": 320,
          "isAvailable": true,
          "tenantId": "6a6caa2fc2f7b5caa316ba3b"
        }
      }
    ]
  }
}
```

