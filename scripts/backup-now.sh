#!/usr/bin/env bash
# =============================================================================
# backup-now.sh — Trigger an immediate manual database backup
# =============================================================================
# Usage: bash scripts/backup-now.sh
# This runs the backup container's entrypoint on demand, outside the cron schedule.
# =============================================================================

set -euo pipefail

echo "📦 Triggering immediate database backup..."

docker exec photobooth-backup /backup.sh

echo "✅ Backup completed. Check ./backups/ for the latest dump."
