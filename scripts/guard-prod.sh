#!/usr/bin/env bash
# Gate for commands that write to PRODUCTION (the self-hosted VPS Convex).
#
# Policy: production writes are a human action. Automated agents, CI and scripts
# must not be able to reach prod, even accidentally via a wrapper script.
#
# Two independent checks, both must pass:
#   1. stdin is an interactive terminal  — agent/CI shells are not TTYs
#   2. a human types the confirmation phrase
#
# Escape hatch for deliberate human scripting: BRAVO_ALLOW_PROD=1
# Do not set that variable in any committed script, hook, or CI config.

set -euo pipefail

ACTION="${1:-this production action}"
PHRASE="deploy to production"

if [ "${BRAVO_ALLOW_PROD:-}" = "1" ]; then
  echo "guard-prod: BRAVO_ALLOW_PROD=1 set — proceeding with ${ACTION}."
  exit 0
fi

if [ ! -t 0 ]; then
  cat >&2 <<EOF

  ✗ Refusing: ${ACTION} targets PRODUCTION and this is not an interactive terminal.

    Production deploys are performed by a human, from a real terminal.
    If you are an AI agent: stop here and hand this step back to Shaun.
    Deploy to cloud/UAT instead — that path is unrestricted.

EOF
  exit 1
fi

echo
echo "  ⚠  ${ACTION} targets PRODUCTION (VPS Convex — live brigade data)."
echo
read -r -p "  Type '${PHRASE}' to continue: " answer

if [ "${answer:-}" != "${PHRASE}" ]; then
  echo "  Aborted." >&2
  exit 1
fi

echo "  Confirmed."
