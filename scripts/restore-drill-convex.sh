#!/usr/bin/env bash
# Restore drill: prove a nightly snapshot can actually rebuild the database.
#
# Structural verification (scripts/verify-convex-backup.py) proves the archive
# is intact. This proves it is *restorable*: it boots a throwaway self-hosted
# Convex backend in Docker, imports the snapshot into it, re-exports, and diffs
# the document counts against the original. Nothing touches the VPS.
#
# Usage:
#   scripts/restore-drill-convex.sh                 # newest nightly snapshot
#   scripts/restore-drill-convex.sh <snapshot.zip>
#   KEEP=1 scripts/restore-drill-convex.sh          # leave the backend running
set -euo pipefail

PROJECT_DIR="/var/www/bravo"
IMAGE="${IMAGE:-ghcr.io/get-convex/convex-backend:latest}"
PORT="${PORT:-3910}"
CONTAINER="bravo-restore-drill"
export PATH="/root/.nvm/versions/node/v24.22.1/bin:$PATH"

cd "$PROJECT_DIR"

SNAPSHOT="${1:-$(ls -1 exports/convex/nightly/vps-export-*.zip 2>/dev/null | tail -1)}"
[ -n "$SNAPSHOT" ] && [ -f "$SNAPSHOT" ] || { echo "no snapshot found"; exit 1; }
SNAPSHOT="$(realpath "$SNAPSHOT")"

WORK="$(mktemp -d)"
cleanup() {
  if [ "${KEEP:-0}" = "1" ]; then
    echo
    echo "KEEP=1: backend left running at http://127.0.0.1:$PORT (container $CONTAINER)"
    echo "  admin key: $(cat "$WORK/admin.key" 2>/dev/null || echo n/a)"
    echo "  tear down: docker rm -f $CONTAINER"
    return
  fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

say "Snapshot under test"
echo "  $SNAPSHOT ($(du -h "$SNAPSHOT" | cut -f1))"

say "Structural verification"
scripts/verify-convex-backup.py "$SNAPSHOT"

say "Booting throwaway backend ($IMAGE)"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
# Isolated instance: its own sqlite volume in $WORK, bound to loopback only.
docker run -d --name "$CONTAINER" \
  -p "127.0.0.1:$PORT:3210" \
  -e INSTANCE_NAME=convex-self-hosted \
  -e CONVEX_CLOUD_ORIGIN="http://127.0.0.1:$PORT" \
  -e CONVEX_SITE_ORIGIN="http://127.0.0.1:$((PORT + 1))" \
  -e DISABLE_BEACON=true \
  -v "$WORK/data:/convex/data" \
  "$IMAGE" >/dev/null

printf '  waiting for health'
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/version" >/dev/null 2>&1; then break; fi
  printf '.'; sleep 2
  [ "$i" = 60 ] && { echo; echo "backend never became healthy:"; docker logs "$CONTAINER" | tail -20; exit 1; }
done
echo " up"

docker exec "$CONTAINER" ./generate_admin_key.sh 2>/dev/null | tail -1 > "$WORK/admin.key"
ADMIN_KEY="$(cat "$WORK/admin.key")"
[ -n "$ADMIN_KEY" ] || { echo "could not generate an admin key"; exit 1; }

# .env.local sets CONVEX_DEPLOYMENT; the CLI refuses to mix that with
# self-hosted credentials, so blank it for this process only.
export CONVEX_DEPLOYMENT=""
export CONVEX_SELF_HOSTED_URL="http://127.0.0.1:$PORT"
export CONVEX_SELF_HOSTED_ADMIN_KEY="$ADMIN_KEY"

say "Importing snapshot into the throwaway backend"
npx --no-install convex import --replace-all --yes "$SNAPSHOT"

say "Re-exporting what was restored"
npx --no-install convex export --include-file-storage --path "$WORK/roundtrip.zip"

say "Comparing restored data against the snapshot"
python3 scripts/compare-convex-snapshots.py "$SNAPSHOT" "$WORK/roundtrip.zip"
