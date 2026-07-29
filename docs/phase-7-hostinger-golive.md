# Phase 7 — Hostinger Go-Live (Final Step)

**Prerequisite:** Phase 6 complete (backups tested, restore drill successful on staging).
**Reference:** see `00-project-overview.md` for the full stack this phase deploys.

## Goal
Deploy to the real production domain. This should be close to anticlimactic — everything here
has already been rehearsed on staging in Phases 5 and 6.

## Steps

1. Provision the real Hostinger VPS (Ubuntu 22.04 LTS recommended).
2. Harden it exactly as done on staging: non-root deploy user, SSH key auth only, root login
   disabled, UFW firewall (allow only 22, 80, 443), fail2ban.
3. Install Node.js, MongoDB, Redis, RabbitMQ — the exact same pinned versions used on staging
   and local dev.
4. Point the real domain's DNS at the Hostinger VPS.
5. Run the already-tested `scripts/deploy.sh` against the new box.
6. Configure Nginx: `api.yourdomain.com` and `n8n.yourdomain.com` reverse proxies, same
   pattern as staging.
7. Issue real TLS certificates via Certbot for both subdomains. Force HTTP → HTTPS redirect,
   add security headers (HSTS, CSP, X-Frame-Options).
8. Switch every environment variable from staging values to production values: CORS allowed
   origins, Paymob webhook callback URL, Cloudinary callback URL, Firebase project
   credentials. Nothing in the codebase should have hardcoded staging URLs to find and change
   — if Phase 0 was done correctly, this is a `.env.production` file, not a code change.
9. Run the restore drill from Phase 6 one final time on the real box, to confirm backups work
   in the actual production environment, not just staging.
10. Onboard the first pilot restaurant.

## Deliverable
The platform running on the real domain, serving at least one real pilot restaurant, with
backups, health checks, and every integration confirmed working in production — not just
"deployed," but verified.
