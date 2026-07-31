#!/usr/bin/env bash

# ─────────────────────────────────────────────────────────────────────────────
# Deployment Script — Staging / Production VPS
# ─────────────────────────────────────────────────────────────────────────────
# Usage: ./backend/scripts/deploy.sh   (run from anywhere; self-locating)
# Safely pulls code, installs dependencies, builds dist/, reloads PM2,
# and verifies health check endpoint.
#
# Repository layout (all folders uploaded to GitHub as one repo root):
#   <repo-root>/
#     backend/
#       scripts/deploy.sh   ← this file
#       ecosystem.config.js
#     nginx/
#     infra/
#     docs/
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ─── Color helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}   $1"; }
log_error() { echo -e "${RED}[ERROR]${NC}  $1"; }

# ─── Resolve directories ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"  # .../backend/scripts/
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"                        # .../backend/
REPO_ROOT="$(dirname "$BACKEND_DIR")"                         # repo root (has .git)

export NODE_ENV=${NODE_ENV:-production}

log_info "Deploy starting — NODE_ENV=$NODE_ENV"
log_info "  Repo root : $REPO_ROOT"
log_info "  Backend   : $BACKEND_DIR"

# ─── 1. Git pull from repo root (where .git lives) ───────────────────────────
log_info "Pulling latest code from origin main..."
cd "$REPO_ROOT"
git fetch origin main
git pull origin main --ff-only

# ─── 2. Install ALL dependencies (needed for TypeScript compiler) ────────────
log_info "Installing all dependencies (including dev)..."
cd "$BACKEND_DIR"
npm ci

# ─── 3. Clean TypeScript build & prune dev dependencies ──────────────────────
log_info "Compiling TypeScript (build:prod)..."
npm run build:prod

log_info "Pruning dev dependencies for production..."
npm prune --omit=dev

# ─── 4. Ensure logs directory exists ─────────────────────────────────────────
mkdir -p logs

# ─── 5. Zero-downtime PM2 reload ─────────────────────────────────────────────
log_info "Reloading PM2 ecosystem..."
pm2 reload ecosystem.config.js --update-env \
  || pm2 start ecosystem.config.js

# ─── 6. Persist PM2 process list across reboots ──────────────────────────────
log_info "Saving PM2 state..."
pm2 save

# ─── 7. Health-check with retry backoff ──────────────────────────────────────
HEALTH_URL="http://127.0.0.1:3000/health"
log_info "Verifying service health at $HEALTH_URL..."

MAX_RETRIES=10
RETRY_COUNT=0
HEALTHY=false

while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
  if curl -sf "$HEALTH_URL" > /dev/null; then
    HEALTHY=true
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  log_warn "Health check $RETRY_COUNT/$MAX_RETRIES failed — retrying in 2 s..."
  sleep 2
done

if [ "$HEALTHY" = true ]; then
  log_info "Health check PASSED — service is operational."
else
  log_error "Health check FAILED after $MAX_RETRIES attempts."
  log_error "Run 'npm run pm2:logs' to diagnose."
  exit 1
fi

# ─── 8. Final status summary ──────────────────────────────────────────────────
log_info "PM2 Process Status:"
pm2 status

log_info "Deployment completed successfully!"
