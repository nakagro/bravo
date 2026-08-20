#!/usr/bin/env bash
# Nightly snapshot of the self-hosted Convex DB (VPS) into ./exports/convex.
# Equivalent to `npm run export:vps`, plus locking, verification and retention.
# Scheduled from root's crontab; see docs/CONVEX-BACKUP.md.
set -euo pipefail

PROJECT_DIR="/var/www/bravo"
EXPORT_DIR="$PROJECT_DIR/exports/convex/nightly"
RETAIN_DAYS="${RETAIN_DAYS:-30}"
export PATH="/root/.nvm/versions/node/v22.22.1/bin:$PATH"

cd "$PROJECT_DIR"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*"; }

# Single instance only - a slow export must not overlap the next night's run.
exec 9>/var/lock/bravo-convex-backup.lock
if ! flock -n 9; then
  log "SKIP: another backup run holds the lock"
  exit 0
fi

mkdir -p "$EXPORT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$EXPORT_DIR/vps-export-$STAMP.zip"

log "START export -> $TARGET"
if ! npx --no-install convex export --env-file .env.vps --include-file-storage --path "$TARGET"; then
  log "FAIL: convex export exited non-zero"
  rm -f "$TARGET"
  exit 1
fi

# A corrupt or partial snapshot is worse than no snapshot - prove it is sound
# now, not at restore time. Also compares table counts against last night to
# catch a snapshot that succeeded but came back suspiciously empty.
if ! "$PROJECT_DIR/scripts/verify-convex-backup.py" --latest --compare-previous; then
  log "FAIL: verification failed, discarding $TARGET"
  rm -f "$TARGET"
  exit 1
fi

SIZE="$(du -h "$TARGET" | cut -f1)"
log "OK: $TARGET ($SIZE)"

# Retention: drop nightly snapshots older than RETAIN_DAYS. Scoped to the
# nightly/ subdir so manual `npm run export:vps` archives are never touched.
DELETED="$(find "$EXPORT_DIR" -maxdepth 1 -name 'vps-export-*.zip' -type f -mtime "+$RETAIN_DAYS" -print -delete | wc -l)"
log "PRUNE: removed $DELETED snapshot(s) older than $RETAIN_DAYS days"
log "DONE: $(ls -1 "$EXPORT_DIR"/vps-export-*.zip 2>/dev/null | wc -l) snapshot(s) on disk, $(du -sh "$EXPORT_DIR" | cut -f1) total"
