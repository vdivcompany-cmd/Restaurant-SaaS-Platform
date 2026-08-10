# Phase 5 — PM2, Nginx & Deploy Tooling (Staging)

> ⚠️ **Superseded Document**  
> PM2 and Nginx deployment were replaced in Phase 10 with Vercel Serverless and Upstash QStash push queues. Retained for historical reference only. See `docs/phase-10-qstash-qr-session-pm2-removal.md`.

---

**Prerequisite:** Phase 4 complete (all workers and n8n running locally).
**Reference:** see `00-project-overview.md` Section 2 for the full PM2 process layout.

## Goal
Build and rehearse the entire deployment process against a cheap staging VPS — **not
Hostinger yet** — so the deploy mechanism is fully proven before it ever touches the real
domain in Phase 7.

## Steps

1. Write `ecosystem.config.js` covering every process: `api`, all six workers from Phase 4,
   and `n8n`. Single instance for `api` at this stage — no cluster mode yet (that's Phase 8).
2. Write `scripts/deploy.sh`: git pull, install dependencies, build, `pm2 reload
   ecosystem.config.js` for zero-downtime restarts.
3. Provision a cheap staging VPS (any provider — this is disposable and separate from the
   final Hostinger box).
4. On staging: install Node (pinned version from Phase 0), MongoDB, Redis, RabbitMQ, Nginx —
   same versions as local dev.
5. Run `deploy.sh` against staging. Fix anything that breaks here, not during the real
   Hostinger go-live.
6. Configure Nginx as a reverse proxy: `api.staging-domain.com` → the PM2 `api` process,
   `n8n.staging-domain.com` → the n8n process, behind basic auth or IP allowlisting.
7. Issue a staging TLS cert via Certbot (a cheap/free subdomain is fine here).
8. Confirm every integration (Paymob sandbox, Cloudinary, Firebase, Redis, RabbitMQ) actually
   works end-to-end against the staging box, not just locally — this catches
   environment-specific config issues (firewall rules, missing env vars, wrong bind addresses)
   early.
9. Run `deploy.sh` a second time to confirm re-deploys are safe and idempotent, not just the
   first install.

## Deliverable
A staging VPS that mirrors what Hostinger will look like in Phase 7, deployed and redeployed
successfully via `deploy.sh`, with every service reachable and every integration verified —
proof the deployment process itself works, independent of the final domain.
