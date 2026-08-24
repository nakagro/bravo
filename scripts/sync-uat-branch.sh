#!/usr/bin/env bash
# Re-point `uat` at `main` after something landed directly on main.
#
#   npm run sync:uat
#
# `uat` is a mirror of `main` plus whatever is being verified - never a
# long-lived divergent branch. Leaving it behind fails silently: the next
# feature branched from `uat` is missing commits, and the eventual uat -> main
# merge conflicts in ways that look unrelated to the cause.
#
# The check below is the reason this is a script rather than two lines in a doc:
# a force-update is only safe when `main` already contains every `uat` commit.
# If `uat` holds work that main does not, force-pushing would destroy it.

set -euo pipefail

cd "$(dirname "$0")/.."

echo ""
echo "  Sync uat -> main"
echo "  ----------------"

# Commits on uat that main does not have. Must be empty to force safely.
divergent="$(git log --oneline main..uat 2>/dev/null || true)"

if [ -n "$divergent" ]; then
  cat >&2 <<EOF

  X Refusing: 'uat' holds commits that 'main' does not.

$(echo "$divergent" | sed 's/^/      /')

    Force-updating would destroy them. This means uat has genuinely diverged
    rather than simply fallen behind, so merge instead and work out why:

        git switch main && git merge uat

EOF
  exit 1
fi

ahead="$(git log --oneline uat..main | wc -l | tr -d ' ')"

if [ "$ahead" = "0" ]; then
  echo "  uat already matches main ($(git rev-parse --short main)). Nothing to do."
  echo ""
  exit 0
fi

echo "  Fast-forwarding uat by ${ahead} commit(s) to $(git rev-parse --short main):"
git log --oneline uat..main | sed 's/^/    /'

git branch -f uat main
echo ""
echo "  Local uat updated. Pushing (this triggers the bravo-uat Vercel build)..."
git push --force-with-lease origin uat

echo ""
echo "  Done. uat and main are in step at $(git rev-parse --short main)."
echo ""
