# Phase 11 — Secure, Server-Priced, AI-Orderable QR Ordering

**Prerequisite:** Phase 10 complete (Upstash QStash migration, QR session fraud prevention, PM2 removal).
**Reference:** see `00-project-overview.md` for the tenant data model and `PROJECT_RULES.md` for the non-negotiable rules (tenant scoping, service interface layer, Zod validation, domain events).

## Goal

Make the public order-placement surface (`POST /api/v1/orders/qr`) immune to client-supplied pricing, structurally restrict it to `DINE_IN` channel only, and enrich vector search metadata so an n8n AI agent (or chatbot) can look up real product, price, and variant data and place a fully-priced order without ever supplying a client price.

---

## 11.1 — Server-side price calculation & minimal public item schema

**Problem:** `createOrderSchema` currently requires the client to send `unitPrice`, `totalPrice`, `subtotal`, and `totalAmount`. A malicious client or an AI agent could submit arbitrary prices, which `OrderService.createOrder()` previously accepted without server-side validation against `MenuModel.products`.

**Fix plan:**
1. `backend/src/modules/orders/validation.ts` — Add `publicOrderItemSchema` and `createPublicQrOrderSchema` with `.strict()`. These schemas accept only `{productId, quantity, variantId?, selectedOptionNames?, notes?}` and reject any price fields or extraneous properties.
2. `backend/src/modules/menu/pricing.service.ts` — Implement `priceOrderItems(tenantId, rawItems)`. Looks up each product in `MenuModel.products` via `MenuRepository.findProductById()`, checks availability, validates variant/option selections against `minSelect`/`maxSelect`, calculates `unitPrice = basePrice + sum(priceDeltas)` and `totalPrice`, and returns authoritative `subtotal` and `totalAmount`.
3. `backend/src/modules/orders/controller.ts` — Update `createQrOrderHandler` to parse requests with `createPublicQrOrderSchema`, calculate prices using `priceOrderItems`, and pass the server-computed values to `service.createOrder()`. Hardcode `channel: 'DINE_IN'`.

**Tests to add (`backend/tests/integration/public-qr-order-pricing.test.ts`):**
- Valid QR order placement computes prices strictly server-side.
- Injected `unitPrice` / `totalPrice` fields cause a `400` validation error (`.strict()` enforcement).
- Orders with variants calculate correct price deltas and enforce `minSelect`/`maxSelect` constraints.
- Injected `channel` field is rejected or overridden to `DINE_IN`.
- Unknown or unavailable products return `404` or `400` respectively.

---

## 11.2 — Vector metadata enrichment for AI ordering

**Problem:** AI ordering flows need to know product IDs, base prices, variant IDs, and variant option price deltas upfront from semantic search results to present options to customers and build valid order payloads.

**Fix plan:**
1. `backend/src/modules/vector/embedding.service.ts` — Enrich `buildProductMetadata()` to include a structured `variants` field containing `variantId`, `name`, `minSelect`, `maxSelect`, and option `priceDelta` entries.

**Tests to add (`backend/tests/integration/public-qr-order-pricing.test.ts`):**
- `POST /api/v1/chat-sessions/search` returns `productId`, `basePrice`, and enriched `variants` metadata.

---

## Deliverable

A public, unauthenticated `POST /api/v1/orders/qr` endpoint that accepts only `{tenantId, branchId, tableId, tableSessionId, items: [{productId, quantity, variantId?, selectedOptionNames?}]}`, hardcodes `channel: 'DINE_IN'`, calculates all prices server-side from `MenuModel.products`, and rejects any client-supplied pricing. Vector search is enriched with variant pricing metadata to support AI agent order placement.
