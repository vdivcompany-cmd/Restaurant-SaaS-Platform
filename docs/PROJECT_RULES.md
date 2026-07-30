# Project Rules — Restaurant SaaS Platform

This file is the standing instruction set for Antigravity while working on this project.
Read this before every task. Reference `00-project-overview.md` and the phase files in
`/phases` for what to build; this file governs *how* to build it.

---

## 1. Non-Negotiable Rules

These apply to every file, every phase, no exceptions:

1. **Never query MongoDB without the tenant scope.** Every `Model.find`, `findOne`,
   `updateOne`, etc. must go through the tenant-scoped query helper that injects
   `{ tenantId: req.tenantId }`. If you write a raw query without it, stop and flag it — do
   not proceed silently. This is the single most important rule in the project.
2. **Never call Redis, RabbitMQ, or the Firestore SDK directly from `modules/`.** Always go
   through `services/cache`, `services/queue`, `services/realtime`. If a module needs
   something the current interface doesn't expose, extend the interface — don't reach around
   it.
3. **MongoDB is written before Firestore, never the reverse.** Firestore is a projection, not
   a source of truth. If a Firestore write fails, the operation must still succeed —
   queue a retry, don't block or roll back the MongoDB write.
4. **Validate every request payload with Zod** before it reaches a service function. No
   unvalidated `req.body` access in any controller.
5. **Webhook endpoints (Paymob, etc.) must verify signatures before processing.** Reject
   anything that doesn't verify — no exceptions, even in development.
6. **n8n never touches MongoDB directly.** It calls backend API endpoints via webhook. If a
   workflow seems to need direct DB access, that's a sign the backend needs a new endpoint,
   not a reason to bypass this rule.
7. **No hardcoded URLs, domains, or secrets anywhere in code.** Everything environment-specific
   comes from `.env` via the validated env schema. This is what makes the later move from
   local → staging → Hostinger a config change, not a code change.
8. **Every background job goes through `QueueService.enqueue()`, never fired inline in a
   request/response cycle.** If something takes more than a trivial amount of time or doesn't
   need to block the response, it's a queue job.
9. **Write the cross-tenant isolation test alongside any new module**, not after. If a new
   collection/endpoint is added, add a test that a different tenant's valid JWT cannot access
   it.
10. **Don't install or wire up infrastructure ahead of the phase it belongs to.** Follow the
    phase files in order — e.g. don't add PM2 cluster mode during Phase 2 just because it
    seems convenient. Section 8 of the overview file lists trigger-based exceptions.
11. **Brand vs. Physical Store Scopes (`tenantId` + `branchId`).** `tenantId` explicitly represents the corporate organization/brand (owning menus, products, employees, subscriptions, and billing). `branchId` represents the physical restaurant storefront location (owning dining tables, POS terminal sessions, order receipts, and shifts). All operational transaction models MUST implement compound indexing starting with `{ tenantId: 1, branchId: 1, createdAt: -1 }` to guarantee rapid POS transaction writes and isolated historical report scans.
12. **Inter-Module Decoupling & Domain Event Bus.** Modules must never tightly couple by importing and synchronously invoking disparate domain feature services (e.g. `OrderService` calling `NotificationService` or `LoyaltyService` inline). Use the typed Domain Event Bus (`src/shared/events`) to broadcast domain milestones (`order.completed`, `tenant.created`) for independent asynchronous reactions.

---

## 2. Code Style & Structure

- TypeScript strict mode on. No `any` without a comment explaining why it's unavoidable.
- Follow the exact folder structure in `00-project-overview.md` Section 2 — don't introduce
  new top-level folders without updating that file first.
- One module = one folder under `modules/`, each with `controller.ts`, `service.ts`, `repository.ts`, `routes.ts`, `model.ts`, `validation.ts`, `tests/`.
- Controllers stay thin — validation and orchestration only. Business logic lives in `service.ts`.
- All database operations for a module MUST be encapsulated inside `repository.ts` using the `tenantQuery` helper. `service.ts` must call `repository.ts` methods instead of directly interacting with Mongoose models or raw queries.
- Every collection's Mongoose schema starts with `tenantId` as the first field, indexed.
- Prefer small, composable functions over large ones. If a service function exceeds roughly
  40–50 lines, look for a natural place to split it.

---

## 3. Testing

- Every new module ships with at least: a happy-path test, a validation-failure test, and a
  cross-tenant isolation test.
- Unit tests use the in-memory `CacheService`/fake `QueueService` implementations — they must
  not require Redis or RabbitMQ to be running.
- Integration tests may use real local Redis/RabbitMQ/MongoDB (via the Phase 0 Docker Compose
  setup).
- Don't mark a phase complete until its tests pass.

---

## 4. README Update Protocol

**After completing any phase (from the `/phases` folder), update `README.md` at the project
root with the following, in this exact structure:**

```markdown
## Progress Log

### ✅ Phase [N] — [Phase Name] — Completed [date]
**What was implemented:**
- [bullet list of what was actually built/changed]

**Deliverable achieved:**
- [state, in one or two sentences, whether the deliverable defined in the phase file was met —
  if partially met, say what's missing]

**Notes / deviations from the plan:**
- [anything that had to be done differently than the phase file described, and why]

**Next phase:** Phase [N+1] — [Next Phase Name]
[one-sentence description of what it covers, pulled from that phase file's Goal section]
```

Rules for this update:
- Append to the bottom of the Progress Log section — never rewrite or delete prior entries.
- Do this **immediately after finishing a phase**, before starting the next one, not in a
  batch at the end.
- If a phase is only partially done in a given session, note that explicitly rather than
  marking it ✅ — use `🔶 In Progress` instead, and list what remains.
- Keep the "What was implemented" bullets factual and specific (file/module names), not vague
  summaries.

---

## 5. API Route Documentation Protocol

**After completing any phase, update `docs/API_ROUTES.md` to document all newly finished API endpoints.**

Rules for `docs/API_ROUTES.md`:
- Document every active endpoint with: HTTP method, path, authentication required (Public / Auth / Roles), request payload / query parameters (Zod schema outline), and sample success response.
- Group endpoints logically by module (e.g. `Auth`, `Tenants`, `Users`, `Subscriptions`).
- Keep this document in sync with the codebase — update it immediately upon completing a phase before moving to the next phase.

---

## 6. Recommended Antigravity Skills

Antigravity uses the open Agent Skills format (`SKILL.md`), the same standard Claude uses.
Skills can be installed globally (`~/.gemini/config/skills/`, usable across all your projects)
or per-project (`<project-root>/.agents/skills/`, specific to this SaaS).

### Install the community skill pack (broad utility skills, one command)
```bash
npx antigravity-awesome-skills
```
This installs a large set of general-purpose skills (git workflows, code review, formatting,
etc.) globally. Verify with:
```bash
test -d ~/.gemini/antigravity/skills && echo "Skills installed"
```

### Skills specifically worth having active for this project

| Skill | Why it matters here |
|---|---|
| **security-review** | Run before any commit touching auth, webhooks, or payment code. Directly enforces Rules #1, #4, #5 above. |
| **api-design / rest-conventions** | Keeps the ~20 modules' route/controller structure consistent as the project grows. |
| **database-migration** | For the eventual MongoDB replica-set conversion (Phase 8) and any schema changes to tenant-scoped collections. |
| **git-commit / conventional-commits** | Useful given the multi-phase structure — commit messages that reference phase numbers make the README's Progress Log easy to cross-check against git history. |
| **testing / test-generation** | Speeds up writing the required cross-tenant isolation tests (Rule #9) consistently instead of ad hoc. |
| **deployment / docker-or-vps-deploy** | Relevant for Phase 5/7 — VPS + PM2 + Nginx deployment, even though this project isn't containerized in production. |

### Writing a project-specific skill (worth doing once, early)
Create `.agents/skills/tenant-scoping/SKILL.md` in the project root — a short, custom skill
that encodes Rule #1 (the tenant query helper pattern) with a code example. Since this is the
single most important and most easily violated rule in the project, having it as a
semantically-triggered skill (loaded whenever the agent touches a new MongoDB query) is more
reliable than relying on it remembering a system-prompt-style instruction across a long
session.

Minimal template:
```text
.agents/skills/tenant-scoping/
└── SKILL.md
```
```markdown
---
name: tenant-scoping
description: Use whenever writing or reviewing a MongoDB query in this project — ensures tenantId scoping is never omitted.
---
Every Mongoose query in this project must be scoped by tenantId. Never call Model.find(),
findOne(), updateOne(), deleteOne(), or similar directly with a raw filter. Always use the
project's tenant-scoped query helper, which injects { tenantId: req.tenantId } automatically.
A query missing this scope is a data leak between restaurants — treat it as a blocking issue,
not a style preference.
```

This is worth more than any general-purpose downloaded skill, since it encodes something
specific to this codebase that no generic skill pack will know about.
