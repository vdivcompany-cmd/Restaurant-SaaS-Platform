# Phase 8 — Scale Adjustments (Event-Driven, Not Scheduled)

**Prerequisite:** Phase 7 complete (live in production with at least one real restaurant).
**Reference:** see `00-project-overview.md` for the interfaces these adjustments plug into.

## Goal
Since Redis, RabbitMQ, and Firebase are already running from Phase 1–2, scaling from here is
tuning existing infrastructure, not adopting new technology. Nothing in this phase should be
done preemptively — each item has a specific trigger. Don't do the work until the trigger
condition is actually true.

## Steps (each independent, triggered separately)

### A — PM2 Cluster Mode
**Trigger:** a single CPU core is maxed out under real traffic.
1. Confirm Redis already holds shared session/rate-limit state (it does, from Phase 2) —
   cluster mode is only safe once state is shared across instances, not per-process.
2. Update `ecosystem.config.js`: `instances: 'max'`, `exec_mode: 'cluster'`.
3. `pm2 reload ecosystem.config.js` for zero-downtime rollout.
4. Verify load distribution with `pm2 monit`.

### B — MongoDB Replica Set / Change Streams
**Trigger:** failover matters, or you want MongoDB Change Streams as an addition/alternative
to the Firestore projection layer.
1. Convert to a 3-node replica set, or migrate to MongoDB Atlas.
2. Update `config/database.ts` connection string.
3. Re-test all Mongoose transactions against the replica set.
4. If adding Change Streams: implement `services/realtime/change-streams-realtime.service.ts`
   against the existing `realtime.interface.ts` — this can run alongside Firestore, or replace
   it for specific collections, without touching `modules/` code.

### C — RabbitMQ Worker Scaling
**Trigger:** a specific queue's depth is consistently backing up (visible in the monitoring
set up in Phase 6).
1. Identify which queue is backing up.
2. Increase the PM2 instance count for that specific worker only — not all workers.
3. Re-verify the retry/DLQ policy for that queue still behaves correctly with multiple
   consumers (no double-processing of the same message).

### D — Firestore Cost/Volume Review
**Trigger:** Firestore read/write costs or volume climbing noticeably.
1. Review which collections actually need realtime projection vs. which could fall back to
   periodic polling for lower-priority views (e.g. historical reports don't need realtime).
2. Narrow the projection scope in `firestore-realtime.service.ts` accordingly — this is a
   configuration change, not a rewrite, since `modules/` code only calls
   `realtimeService.publish()` and doesn't know or care what's behind it.

### E — n8n Workflow Expansion
**Trigger:** more restaurants onboard and want more automation.
1. Add workflows to the existing n8n instance — not a new technology, just more flows.
2. Version-control exported n8n workflow JSON alongside the repo for auditability.
3. If execution volume gets high, consider n8n queue mode — still doesn't require touching
   backend business logic.

## Deliverable
No fixed deliverable — this phase is a living reference. Revisit each trigger as real usage
data comes in, and only act on the one(s) that are actually true.
