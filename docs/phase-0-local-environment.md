# Phase 0 — Local Environment

**Prerequisite:** none. This is the first phase.
**Reference:** see `00-project-overview.md` for full stack and structure context.

## Goal
Set up a local development environment that mirrors production closely enough that nothing
learned locally becomes invalid once deployed — same Node version, same service versions for
MongoDB/Redis/RabbitMQ, same env-var-driven config.

## Steps

1. Install Node.js via `nvm`. Pin the exact version in `.nvmrc` at the repo root.
2. Install MongoDB, Redis, and RabbitMQ natively on your local machine. The application
   code itself runs natively via Node, matching how it will run on the Hostinger VPS later
   (PM2, no Docker in production).
   - Ensure the versions installed locally match what you intend to `apt install` on the
     VPS later. Version mismatches between dev and prod are a common source of subtle bugs.
3. Create a Firebase project (free Spark tier is sufficient for development). Generate a
   service account key. Do **not** commit it — load it via an environment variable
   (base64-encoded JSON or a file path outside the repo).
4. Create `.env.local` with every config value the app needs: MongoDB URI, Redis URL, RabbitMQ
   URL, Firebase credentials path, JWT secrets, Paymob keys (sandbox), Cloudinary keys.
   - No hardcoded domains anywhere in the codebase — everything (CORS origins, webhook
     callback URLs) must come from env, since the domain doesn't exist yet and won't until
     Phase 7.
5. Scaffold the project structure exactly as defined in `00-project-overview.md` Section 2.
6. Verify all four services (MongoDB, Redis, RabbitMQ, Firebase) are reachable from a simple
   Node script before writing any application code — catch connectivity/config issues here,
   not mid-feature.

## Deliverable
A local environment with MongoDB, Redis, and RabbitMQ installed natively; a
Node app that connects to all three plus Firebase using only env vars; the full folder
structure scaffolded and empty, ready for Phase 1.
