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

# Interactivity test: can we open the controlling terminal? Do NOT use `[ -t 0 ]`
# — npm and git hooks redirect stdio, so a human at a real prompt can look
# non-TTY. An agent or CI shell has no controlling terminal at all.
if ! (exec 3</dev/tty) 2>/dev/null; then
  cat >&2 <<EOF

  ✗ Refusing: ${ACTION} targets PRODUCTION and there is no controlling terminal.

    Production deploys are performed by a human, from a real terminal.
    If you are an AI agent: stop here and hand this step back to Shaun.
    Deploy to cloud/UAT instead — that path is unrestricted.

EOF
  exit 1
fi

echo
echo "  ⚠  ${ACTION} targets PRODUCTION (VPS Convex — live brigade data)."
echo
# Read from /dev/tty, not stdin, so the prompt works even when stdin is redirected.
printf "  Type '%s' to continue: " "${PHRASE}"
read -r answer </dev/tty

if [ "${answer:-}" != "${PHRASE}" ]; then
  echo "  Aborted." >&2
  exit 1
fi

echo "  Confirmed."
