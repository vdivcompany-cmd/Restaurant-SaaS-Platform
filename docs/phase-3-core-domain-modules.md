# Phase 3 — Core Domain Modules

**Prerequisite:** Phase 2 complete (CacheService/QueueService/RealtimeService working with
real Redis/RabbitMQ/Firestore behind them).
**Reference:** see `00-project-overview.md` Section 3 for the full tenant-scoped data model.

## Goal
Build the actual restaurant management domain — menu, orders, tables, customers, feedback — on top
of the tenant/auth foundation and service interfaces already in place.

## Steps

1. **Restaurants & Branches** — CRUD scoped by `tenantId`, with `branches` supporting
   multiple physical locations per restaurant.
2. **Menu, Categories, Products, Variants** — CRUD scoped by `tenantId` (and optionally
   `branchId` if menus differ per branch). Cache menu reads through `CacheService` with a
   defined TTL (e.g. 1 hour), invalidated immediately on any write — never wait for expiry.
3. **Coupons** — basic discount rules scoped by `tenantId`.
4. **Orders** — the most important module:
   - Use a Mongoose transaction for order creation + stock deduction together — both succeed
     or both fail, no partial state.
   - After the transaction commits, publish the change via `RealtimeService`
     (`restaurants/{tenantId}/orders/{orderId}`).
   - After the transaction commits, enqueue a `subscription-checks`-adjacent or dedicated
     order event via `QueueService` for downstream consumers (invoice generation,
     notifications, analytics) — these consumers are built in Phase 4, this phase only needs
     to publish the event.
   - Track `channel` on every order (`telegram | web | qr | dine-in`) even though only one
     channel exists yet — this avoids a schema migration when more channels are added later.
5. **Tables** — physical dining tables scoped by `tenantId`/`branchId`, tracked for dine-in orders and reservations.
6. **Employees** — scoped by `tenantId`, distinct from `users` (auth) if you need to track
   employees who aren't system users (e.g. kitchen staff without login access) — otherwise
   reuse `users` with role `kitchen`/`cashier`.
7. **Customers** — scoped by `tenantId`, with basic order history.
8. **Feedback** — scoped by `tenantId`, tied to `customerId` and `orderId`, allowing customers to review their orders.
9. **Reports & Notifications** — reports aggregate data for the restaurant (tenant-level); notifications
   must be routed through `QueueService`, never sent inline in a request/response cycle.

## Deliverable
A backend where, for a given tenant, you can: create a branch, build a menu, place an order
that correctly assigns a table (for dine-in) in a transaction, see that order reflected in Firestore under the
right tenant path, and confirm a queue message was enqueued for downstream processing.
