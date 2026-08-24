#!/usr/bin/env bash
# Pre-deploy safety snapshot of production.
#
#   npm run snapshot:prod
#
# Run this immediately before `npm run deploy:convex:vps`. Without it, rollback
# depends on the nightly backup, which can be up to 24h stale - so a bad deploy
# could cost a day of brigade data.
#
# Read-only against production, so deliberately NOT behind scripts/guard-prod.sh:
# nothing here writes, and a TTY check would stop it being usable from a script
# that is about to hand the actual deploy to a human.

set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p ./exports/convex/pre-deploy
snapshot="./exports/convex/pre-deploy/prod-$(date +%Y%m%d-%H%M%S).zip"

echo ""
echo "  Snapshotting PRODUCTION (read-only)..."
npx convex export --env-file .env.vps --include-file-storage --path "$snapshot"

echo ""
echo "  Verifying..."
./scripts/verify-convex-backup.py "$snapshot"

cat <<EOF

  Snapshot verified and ready as a rollback point:
      ${snapshot}

  To roll back (this WIPES prod and is human-only):
      npm run import:vps -- --replace-all ${snapshot}

EOF
