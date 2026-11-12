#!/usr/bin/env bash
# Clone production data into the UAT deployment.
#
#   npm run clone:uat -- --yes
#
# Joins pieces that already work: export:vps -> verify-convex-backup.py ->
# convex import --replace-all against UAT.
#
# SAFETY: the target deployment is hardcoded below and never taken from an
# argument or the environment. `convex import --replace-all` is the same verb
# that wipes production when pointed at .env.vps - the only thing separating
# "restore UAT" from "destroy prod" is which target it runs against, so that
# choice is not left to a caller, a flag, or an inherited CONVEX_DEPLOYMENT.

set -euo pipefail

readonly UAT_DEPLOYMENT="precious-magpie-647"
readonly PROD_ENV_FILE=".env.vps"

cd "$(dirname "$0")/.."

confirmed=""
for arg in "$@"; do
  case "$arg" in
    --yes) confirmed="yes" ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

echo ""
echo "  Clone PRODUCTION data -> UAT (${UAT_DEPLOYMENT})"
echo "  ------------------------------------------------------"

# ---------------------------------------------------------------------------
# 1. The guard must exist BEFORE the data does.
#
# Real member PII is about to land on a cloud deployment whose Resend key can
# send to the addresses in that very data. Without EMAIL_ALLOWLIST set, the
# wrapper in convex/emails.ts is a no-op and any notification a test triggers
# goes to real members.
# ---------------------------------------------------------------------------
echo ""
echo "  [1/6] Checking the email guard is armed on UAT..."

allowlist="$(CONVEX_DEPLOYMENT="$UAT_DEPLOYMENT" npx convex env get EMAIL_ALLOWLIST 2>/dev/null | tr -d '\r\n' || true)"

if [ -z "$allowlist" ]; then
  cat >&2 <<EOF

  X Refusing to clone: EMAIL_ALLOWLIST is not set on ${UAT_DEPLOYMENT}.

    Cloned data carries real member email addresses. Without the allowlist,
    a notification triggered during testing would reach real members.

    Fix:
      CONVEX_DEPLOYMENT=${UAT_DEPLOYMENT} npx convex env set EMAIL_ALLOWLIST you@example.com

EOF
  exit 1
fi
echo "        armed: ${allowlist}"

# A UAT deployment still holding the production frontend URL sends password
# reset links that point at production.
frontend="$(CONVEX_DEPLOYMENT="$UAT_DEPLOYMENT" npx convex env get FRONTEND_URL 2>/dev/null | tr -d '\r\n' || true)"
if [ -z "$frontend" ]; then
  echo "  X Refusing to clone: FRONTEND_URL is not set on UAT." >&2
  echo "    Reset links would point at production." >&2
  exit 1
fi
echo "        frontend: ${frontend}"

# ---------------------------------------------------------------------------
# 2. Export production (read-only).
# ---------------------------------------------------------------------------
echo ""
echo "  [2/6] Exporting production (read-only)..."

mkdir -p ./exports/convex
snapshot="./exports/convex/uat-clone-$(date +%Y%m%d-%H%M%S).zip"

npx convex export --env-file "$PROD_ENV_FILE" --include-file-storage --path "$snapshot"
echo "        wrote ${snapshot}"

# ---------------------------------------------------------------------------
# 3. Verify the snapshot before trusting it.
#
# Importing a truncated export with --replace-all would leave UAT holding less
# than it claims, which is a confusing state to debug a feature in.
# ---------------------------------------------------------------------------
echo ""
echo "  [3/6] Verifying the snapshot..."
./scripts/verify-convex-backup.py "$snapshot"

# ---------------------------------------------------------------------------
# 4. Save UAT's own push subscriptions.
#
# A push subscription is bound to the VAPID key pair of the deployment that
# created it, and UAT has its own pair. So production's rows are undeliverable
# here, and --replace-all would wipe the tester devices that do work - forcing
# the two or three UAT testers to unregister and re-register after every clone.
# Snapshot them now, restore them after the import.
#
# Only allowlisted testers' devices are kept, and never one of production's own
# endpoints. Without that filter, prod rows left behind by any earlier clone
# would be saved and restored as "UAT's own" on every clone after it.
# ---------------------------------------------------------------------------
echo ""
echo "  [4/6] Saving UAT's own push subscriptions..."

uat_snapshot="./exports/convex/uat-push-$(date +%Y%m%d-%H%M%S).zip"
preserved_push=""

if CONVEX_DEPLOYMENT="$UAT_DEPLOYMENT" npx convex export --path "$uat_snapshot" >/dev/null 2>&1; then
  push_jsonl="${uat_snapshot%.zip}.jsonl"
  set +e
  ./scripts/extract-push-subscriptions.py "$uat_snapshot" "$push_jsonl" --users-from "$snapshot" --allow-emails "$allowlist"
  extract_status=$?
  set -e
  if [ "$extract_status" -eq 0 ]; then
    preserved_push="$push_jsonl"
  elif [ "$extract_status" -ne 3 ]; then
    echo "  X Refusing to clone: could not read UAT's push subscriptions." >&2
    echo "    Importing now would destroy them silently." >&2
    exit 1
  fi
  rm -f "$uat_snapshot"
else
  echo "        could not export UAT (empty or unreachable) - nothing to preserve"
  rm -f "$uat_snapshot"
fi

# ---------------------------------------------------------------------------
# 5. Replace UAT's data.
# ---------------------------------------------------------------------------
if [ "$confirmed" != "yes" ]; then
  cat <<EOF

  This will REPLACE ALL DATA on ${UAT_DEPLOYMENT} with the snapshot above.
  Production is untouched - it was only read.

  Re-run with --yes to proceed:
      npm run clone:uat -- --yes

  The verified snapshot has been kept:
      ${snapshot}

EOF
  exit 0
fi

echo ""
echo "  [5/6] Importing into ${UAT_DEPLOYMENT} (--replace-all)..."
CONVEX_DEPLOYMENT="$UAT_DEPLOYMENT" npx convex import --replace-all --yes "$snapshot"

# Put UAT's own subscriptions back, replacing the cloned production rows. The
# table ends up holding only devices registered against UAT's VAPID pair.
if [ -n "$preserved_push" ]; then
  echo "        restoring UAT push subscriptions..."
  CONVEX_DEPLOYMENT="$UAT_DEPLOYMENT" npx convex import \
    --table pushSubscriptions --replace --yes "$preserved_push"
  rm -f "$preserved_push"
else
  # Nothing of UAT's to keep, but the import just brought in every production
  # row. Empty the table rather than leave devices UAT can never deliver to.
  echo "        no UAT push subscriptions to keep - clearing the cloned production rows..."
  empty_push="./exports/convex/uat-push-empty.jsonl"
  : > "$empty_push"
  if ! CONVEX_DEPLOYMENT="$UAT_DEPLOYMENT" npx convex import \
      --table pushSubscriptions --replace --yes "$empty_push"; then
    echo "  ! Could not clear pushSubscriptions. Production rows remain (undeliverable on UAT)." >&2
  fi
  rm -f "$empty_push"
fi

# ---------------------------------------------------------------------------
# 6. Report.
# ---------------------------------------------------------------------------
echo ""
echo "  [6/6] Done."
echo ""
echo "  UAT now holds a copy of production data."
echo "    backend:   https://${UAT_DEPLOYMENT}.convex.cloud"
echo "    frontend:  ${frontend}"
echo "    snapshot:  ${snapshot}"
echo ""

simulation="$(CONVEX_DEPLOYMENT="$UAT_DEPLOYMENT" npx convex env get SIMULATION_ENABLED 2>/dev/null | tr -d '\r\n' || true)"
if [ "$simulation" = "true" ]; then
  cat <<EOF
  ! SIMULATION_ENABLED is ON. It rewrites ~20% of member statuses every 12
    minutes, which makes reproducing a bug harder. Turn it off while verifying:

      CONVEX_DEPLOYMENT=${UAT_DEPLOYMENT} npx convex env set SIMULATION_ENABLED false

EOF
fi

cat <<EOF
  Note: destructive crons start running against this clone immediately
  (messages.deleteAllMessages daily, availability.processStatusTransitions
  every 5 min). Re-run this script to reset rather than trusting an old clone.

EOF
