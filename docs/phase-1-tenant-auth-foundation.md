# Phase 1 — Tenant & Auth Foundation

**Prerequisite:** Phase 0 complete (local environment running, structure scaffolded).
**Reference:** see `00-project-overview.md` Section 3 for the full tenant data model.

## Goal
Build the multi-tenant "room" enforcement layer and authentication before anything else. Every
later module depends on this being correct — this is the single hardest thing to retrofit if
it's wrong.

## Steps

1. Implement the `tenants` collection and model per the data model in the overview file.
2. Implement `tenant.middleware.ts`:
   - Resolves `tenantId` from the authenticated user's JWT for dashboard/staff requests.
   - Resolves `tenantId` from bot/channel context (e.g. Telegram bot tied to a tenant's
     `slug`) for non-dashboard requests.
   - Attaches the resolved value to `req.tenantId` on every request. Reject the request if no
     tenant can be resolved.
3. Implement `rbac.middleware.ts` with roles: `owner`, `manager`, `cashier`, `kitchen`.
   Permissions should be role-based and tenant-aware — a `manager` role only has authority
   within their own tenant.
4. Implement the `users` collection scoped by `tenantId`, with `role`.
5. Build the Mongoose query helper that automatically injects `{ tenantId: req.tenantId }`
   into every query. Enforce via code review / lint rule that no service in `modules/` is
   allowed to call `Model.find()`, `Model.findOne()`, etc. directly without going through this
   helper.
6. Build the `auth` module: JWT access tokens + refresh token rotation, password hashing
   (bcrypt or argon2), login/logout/refresh endpoints.
7. Build the `tenants` module (create tenant, update settings) and a minimal `subscriptions` +
   `billing` skeleton (status field only for now — full billing logic comes later).
8. Write cross-tenant isolation tests: create two tenants, authenticate as a user of tenant A,
   attempt to read/write tenant B's data, assert every attempt is rejected. Cover at minimum:
   users, orders (once scaffolded), and any collection with a list/detail endpoint.

## Deliverable
A backend where you can register two separate tenants, log in as a user of each, and
mechanically verify — via tests, not just manual checking — that neither can access the
other's data through any endpoint.
