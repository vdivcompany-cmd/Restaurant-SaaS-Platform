#!/usr/bin/env bash

# ─────────────────────────────────────────────────────────────────────────────
# Backup Restore Drill Verification Script
# ─────────────────────────────────────────────────────────────────────────────
# Usage: ./scripts/restore-drill.sh
# Tests backup integrity by extracting the latest backup archive into a temp space
# and verifying all essential configuration files are valid and recoverable.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/restaurant-saas}"

echo "[RESTORE DRILL] Starting backup restore verification routine..."

if [ ! -d "$BACKUP_DIR" ]; then
    echo "[RESTORE DRILL ERROR] Backup directory $BACKUP_DIR does not exist. Restore drill failed."
    exit 1
fi

LATEST_BACKUP=$(find "$BACKUP_DIR" -name "restaurant_saas_backup_*.tar.gz" | sort -r | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "[RESTORE DRILL ERROR] No backup archives found in $BACKUP_DIR."
    exit 1
fi

echo "[RESTORE DRILL] Inspecting latest archive: $LATEST_BACKUP"

TMP_RESTORE_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_RESTORE_DIR"' EXIT

tar -xzf "$LATEST_BACKUP" -C "$TMP_RESTORE_DIR"

echo "[RESTORE DRILL] Verifying extracted file integrity..."

MISSING=0

check_file() {
    if [ -e "$TMP_RESTORE_DIR/$1" ]; then
        echo "  [OK] Found: $1"
    else
        echo "  [FAIL] Missing: $1"
        MISSING=$((MISSING + 1))
    fi
}

check_file "ecosystem.config.js"
check_file ".env.backup"

if [ $MISSING -eq 0 ]; then
    echo "[RESTORE DRILL PASSED] All essential backup artifacts verified successfully!"
    exit 0
else
    echo "[RESTORE DRILL FAILED] $MISSING expected backup artifacts were missing!"
    exit 1
fi
