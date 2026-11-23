#!/usr/bin/env bash
# Clone production data into the self-hosted workshop Convex deployment.
#
#   npm run clone:workshop -- --yes
#
# Joins: export:vps (read-only) -> verify-convex-backup.py ->
# convex import --replace-all against .env.workshop, then clears cloned
# production pushSubscriptions.
#
# SAFETY: the target env file (.env.workshop) is hardcoded below and verified
# not to point at production before any write runs.

set -euo pipefail

readonly WORKSHOP_ENV_FILE=".env.workshop"
readonly PROD_ENV_FILE=".env.vps"

cd "$(dirname "$0")/.."

confirmed=""
for arg in "$@"; do
  case "$arg" in
    --yes) confirmed="yes" ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -f "$WORKSHOP_ENV_FILE" ]; then
  echo "  X Missing ${WORKSHOP_ENV_FILE}. Create it before cloning." >&2
  exit 1
fi

workshop_url="$(grep -E '^CONVEX_SELF_HOSTED_URL=' "$WORKSHOP_ENV_FILE" | head -n1 | cut -d= -f2- | tr -d "\"'\r\n" || true)"
workshop_key_prefix="$(grep -E '^CONVEX_SELF_HOSTED_ADMIN_KEY=' "$WORKSHOP_ENV_FILE" | head -n1 | cut -d= -f2- | tr -d "\"'\r\n" | cut -d'|' -f1 || true)"
prod_url="$(grep -E '^CONVEX_SELF_HOSTED_URL=' "$PROD_ENV_FILE" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d "\"'\r\n" || true)"

if [ -z "$workshop_url" ]; then
  echo "  X Refusing to clone: CONVEX_SELF_HOSTED_URL is missing in ${WORKSHOP_ENV_FILE}." >&2
  exit 1
fi

if [ -z "$prod_url" ]; then
  echo "  X Refusing to clone: CONVEX_SELF_HOSTED_URL is missing in ${PROD_ENV_FILE}." >&2
  exit 1
fi

if [ "${workshop_url%/}" = "${prod_url%/}" ]; then
  echo "  X Refusing to clone: ${WORKSHOP_ENV_FILE} points at the same URL as ${PROD_ENV_FILE} (${workshop_url})." >&2
  exit 1
fi

if [ "$workshop_key_prefix" != "convex-workshop" ]; then
  echo "  X Refusing to clone: expected admin key prefix 'convex-workshop', got '${workshop_key_prefix}'." >&2
  exit 1
fi

echo ""
echo "  Clone PRODUCTION data -> WORKSHOP (${workshop_url})"
echo "  ------------------------------------------------------"

# ---------------------------------------------------------------------------
# 1. Verify guards are armed on workshop BEFORE prod data lands.
# ---------------------------------------------------------------------------
echo ""
echo "  [1/5] Checking guards on workshop..."

allowlist="$(CONVEX_DEPLOYMENT= npx convex env get EMAIL_ALLOWLIST --env-file "$WORKSHOP_ENV_FILE" 2>/dev/null | tr -d '\r\n' || true)"
if [ -z "$allowlist" ]; then
  cat >&2 <<EOF

  X Refusing to clone: EMAIL_ALLOWLIST is not set on workshop.

    Cloned data carries real member email addresses. Arm the guard first:
      CONVEX_DEPLOYMENT= npx convex env set EMAIL_ALLOWLIST you@example.com --env-file ${WORKSHOP_ENV_FILE}

EOF
  exit 1
fi
echo "        EMAIL_ALLOWLIST: armed"

frontend="$(CONVEX_DEPLOYMENT= npx convex env get FRONTEND_URL --env-file "$WORKSHOP_ENV_FILE" 2>/dev/null | tr -d '\r\n' || true)"
if [ -z "$frontend" ]; then
  echo "  X Refusing to clone: FRONTEND_URL is not set on workshop." >&2
  echo "    Reset links would point at production." >&2
  exit 1
fi
echo "        FRONTEND_URL:    ${frontend}"

# ---------------------------------------------------------------------------
# 2. Export production (read-only).
# ---------------------------------------------------------------------------
echo ""
echo "  [2/5] Exporting production (read-only)..."

mkdir -p ./exports/convex
snapshot="./exports/convex/workshop-clone-$(date +%Y%m%d-%H%M%S).zip"

CONVEX_DEPLOYMENT= npx convex export --env-file "$PROD_ENV_FILE" --include-file-storage --path "$snapshot"
echo "        wrote ${snapshot}"

# ---------------------------------------------------------------------------
# 3. Verify the snapshot before importing.
# ---------------------------------------------------------------------------
echo ""
echo "  [3/5] Verifying the snapshot..."
./scripts/verify-convex-backup.py "$snapshot"

# ---------------------------------------------------------------------------
# 4. Replace workshop data.
# ---------------------------------------------------------------------------
if [ "$confirmed" != "yes" ]; then
  cat <<EOF

  This will REPLACE ALL DATA on workshop (${workshop_url}) with the snapshot above.
  Production is untouched - it was only read.

  Re-run with --yes to proceed:
      npm run clone:workshop -- --yes

  The verified snapshot has been kept:
      ${snapshot}

EOF
  exit 0
fi

echo ""
echo "  [4/5] Importing into workshop (--replace-all)..."
CONVEX_DEPLOYMENT= npx convex import --env-file "$WORKSHOP_ENV_FILE" --replace-all --yes "$snapshot"

echo "        clearing cloned production pushSubscriptions..."
empty_push="./exports/convex/workshop-push-empty.jsonl"
: > "$empty_push"
if ! CONVEX_DEPLOYMENT= npx convex import --env-file "$WORKSHOP_ENV_FILE" \
    --table pushSubscriptions --replace --yes "$empty_push"; then
  echo "  ! Could not clear pushSubscriptions. Production rows remain (undeliverable on workshop)." >&2
fi
rm -f "$empty_push"

# ---------------------------------------------------------------------------
# 5. Report.
# ---------------------------------------------------------------------------
echo ""
echo "  [5/5] Done."
echo ""
echo "  Workshop now holds a copy of production data."
echo "    backend:   ${workshop_url}"
echo "    frontend:  ${frontend}"
echo "    snapshot:  ${snapshot}"
echo ""
