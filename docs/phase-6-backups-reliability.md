# Phase 6 — Backups, Health & Reliability

**Prerequisite:** Phase 5 complete (staging deploy proven and repeatable).
**Reference:** see `00-project-overview.md` Section 1 for the monitoring/backup stack.

## Goal
Make failure a planned, tested scenario rather than an unknown — backups that are actually
restorable, health checks that reflect real service state, and explicit handling for the
failure modes introduced by having three extra stateful services (Redis, RabbitMQ, Firestore).

## Steps

1. **MongoDB backups**: `mongodump` cron job → compressed → pushed to off-server storage
   (S3-compatible bucket or similar) — never rely on the VPS disk alone.
2. **Redis persistence**: enable AOF (append-only file) persistence, since Redis now holds
   sessions and rate-limit state, not just disposable cache — losing this on a crash is a real
   user-facing problem, not just a cache miss.
3. **RabbitMQ reproducibility**: export queue/exchange definitions to
   `infra/rabbitmq/definitions.json`, committed to the repo, so the exact queue setup can be
   recreated on a fresh box without relying on memory of what was clicked in the management UI.
4. **Firestore write-failure handling**: if a Firestore projection write fails after a
   MongoDB transaction commits, the customer-facing operation must still succeed — enqueue a
   retry via `QueueService` rather than blocking or failing the response. Write a test that
   simulates a Firestore failure and confirms the order still completes.
5. **Health endpoints**: implement `/health`, `/ready`, `/live`, each checking real
   connectivity to MongoDB, Redis, RabbitMQ, and Firebase — not just "the process is running."
6. **Monitoring**: hook `/health` to an external uptime checker. Track RabbitMQ queue depth
   (a backing-up queue is an early warning sign before anything visibly breaks).
7. **Restore drill**: on the staging VPS from Phase 5, deliberately destroy the MongoDB data
   directory, Redis data, and RabbitMQ definitions, then restore all three from backup and
   confirm the app comes back up clean with no data loss beyond the last backup interval.
   Document the exact restore steps in `docs/runbook.md` as you perform them — the runbook
   should be written from an actual drill, not from theory.
8. **MongoDB replica set** (only once justified by traffic or the need for Change Streams):
   convert from single instance to a 3-node replica set, or migrate to MongoDB Atlas. Re-test
   all Mongoose transactions against it afterward.

## Deliverable
A documented, rehearsed restore process (not just a backup script that's never been tested),
health checks that would actually catch a Redis or RabbitMQ outage, and a written runbook in
`docs/runbook.md` covering what to do when each service fails.
