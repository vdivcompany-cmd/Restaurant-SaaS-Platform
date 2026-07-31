#!/usr/bin/env bash

# ─────────────────────────────────────────────────────────────────────────────
# Platform Backup Script — Configuration, Environment & Infrastructure Topology
# ─────────────────────────────────────────────────────────────────────────────
# Usage: ./scripts/backup.sh
# Creates timestamped backup archives of app configuration, PM2 dumps, and
# Nginx site definitions. Managed DBs (MongoDB Atlas, Upstash Redis) handle data snapshots.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# WARNING: The resulting backup archive contains .env which holds real production secrets. 
# It is unencrypted. Store securely off-server and ensure strict file permissions.

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/restaurant-saas}"
ARCHIVE_NAME="restaurant_saas_backup_${TIMESTAMP}.tar.gz"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "[BACKUP] Starting backup routine at $(date)..."

# Ensure backup destination directory exists
mkdir -p "$BACKUP_DIR"
TMP_DIR=$(mktemp -d)

trap 'rm -rf "$TMP_DIR"' EXIT

echo "[BACKUP] Collecting environment and process configurations..."

# 1. Export PM2 process dump
if command -v pm2 &> /dev/null; then
    pm2 save
    if [ -f "$HOME/.pm2/dump.pm2" ]; then
        cp "$HOME/.pm2/dump.pm2" "$TMP_DIR/dump.pm2"
    fi
fi

# 2. Copy application ecosystem configuration and env (if present)
if [ -f "$PROJECT_DIR/.env" ]; then
    cp "$PROJECT_DIR/.env" "$TMP_DIR/.env.backup"
fi

if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
    cp "$PROJECT_DIR/ecosystem.config.js" "$TMP_DIR/ecosystem.config.js"
fi

# 3. Copy Nginx virtual host configurations if available
if [ -d "/etc/nginx/sites-available" ]; then
    mkdir -p "$TMP_DIR/nginx"
    cp -r /etc/nginx/sites-available "$TMP_DIR/nginx/" 2>/dev/null || true
elif [ -d "$PROJECT_DIR/../nginx/sites-available" ]; then
    mkdir -p "$TMP_DIR/nginx"
    cp -r "$PROJECT_DIR/../nginx/sites-available" "$TMP_DIR/nginx/" 2>/dev/null || true
fi

# 4. Copy Infra definitions
if [ -d "$PROJECT_DIR/../infra" ]; then
    mkdir -p "$TMP_DIR/infra"
    cp -r "$PROJECT_DIR/../infra" "$TMP_DIR/" 2>/dev/null || true
fi

# Create compressed archive
tar -czf "${BACKUP_DIR}/${ARCHIVE_NAME}" -C "$TMP_DIR" .

echo "[BACKUP] Backup archive successfully created at: ${BACKUP_DIR}/${ARCHIVE_NAME}"

# Retention policy: remove backup archives older than 30 days
find "$BACKUP_DIR" -name "restaurant_saas_backup_*.tar.gz" -mtime +30 -delete 2>/dev/null || true

echo "[BACKUP] Backup completed successfully."
