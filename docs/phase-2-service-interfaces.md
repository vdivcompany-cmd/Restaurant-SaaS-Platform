# Phase 2 — Service Interfaces (Redis, RabbitMQ, Firestore)

**Prerequisite:** Phase 1 complete (tenant/auth foundation working and tested).
**Reference:** see `00-project-overview.md` Section 1 for the interface-layer principle.

## Goal
Build the `CacheService`, `QueueService`, and `RealtimeService` interfaces with real
implementations behind them (Redis, RabbitMQ, Firestore) from the start. Every module built
after this phase must use these interfaces exclusively — never the underlying client directly.

## Steps

### CacheService (Redis)
1. Define `services/cache/cache.interface.ts` — methods: `get`, `set` (with TTL), `delete`,
   plus higher-level helpers for locks (`acquireLock`/`releaseLock`) and idempotency key
   checks.
2. Implement `services/cache/redis-cache.service.ts` against that interface.
3. Implement `services/cache/memory-cache.service.ts` as a second implementation, used only in
   `tests/unit` so unit tests don't require Redis running.
4. Wire Redis-backed session storage and `rateLimit.middleware.ts` (per IP / user / tenant)
   through `CacheService`.
5. Wire `utils/idempotency.ts` (for payment and webhook endpoints) through `CacheService`.

### QueueService (RabbitMQ)
1. Define `services/queue/queue.interface.ts` — method: `enqueue(jobName, payload)`.
2. Define `services/queue/queue-definitions.ts` — the full list of queues up front:
   `emails`, `telegram`, `invoices`, `subscription-checks`, `payment-retries`, `reports`,
   `backups`. For each: retry policy and Dead Letter Queue.
3. Implement `services/queue/rabbitmq-queue.service.ts` against the interface.
4. Do not build worker consumers yet — that's Phase 4. This phase is producer-side only:
   modules can call `queueService.enqueue(...)`.

### RealtimeService (Firestore)
1. Define `services/realtime/realtime.interface.ts` — method: `publish(path, data)`.
2. Implement `services/realtime/firestore-realtime.service.ts` using the Firebase Admin SDK.
3. Establish the document path convention: `restaurants/{tenantId}/orders/{orderId}`, etc. —
   tenant isolation must hold in Firestore paths just as it does in MongoDB queries.
4. Establish the rule in code and in review: MongoDB is written first (source of truth), then
   the Firestore projection is published — never the reverse. If the Firestore write fails,
   the operation must still succeed on the MongoDB side; failure handling for this is built in
   Phase 6, but the ordering rule applies from this phase onward.

## Deliverable
Three working interfaces, each with a real backing implementation, verified with a small
integration test per interface (cache round-trip, a message enqueued and visible in the
RabbitMQ management UI, a Firestore document actually appearing under the right tenant path).
No module code written yet — this phase is infrastructure only.
