#!/usr/bin/env bash
# Update every agent skill in this repo, then drop the Claude Code copies that
# duplicate the user-level `convex@claude-plugins-official` plugin.
# Run after `npx convex ai-files install/update` too - both re-create the copies.
# See docs/AGENT_SKILLS.md.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# Topics the Convex plugin already covers as convex:<name>. Keeping both means
# two near-identical candidates for the same task, so the plugin wins here and
# the remaining ~20 ai-files skills (advisor, cost, insights, backup, ...) stay.
PLUGIN_DUPLICATES=(
  convex-add convex-agent convex-auth convex-authz convex-billing
  convex-crons convex-design convex-domains convex-env convex-expert
  convex-improve-convex-plugin convex-migrate convex-quickstart
  convex-reviewer convex-seed convex-suggest convex-test
)

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*"; }

if [[ "${SKIP_UPDATE:-0}" != "1" ]]; then
  log "Updating lock-managed skills (.agents/skills + .claude/skills)..."
  npx -y skills@latest update --project --yes

  log "Updating Convex AI files (guidelines.md, CLAUDE.md/AGENTS.md sections)..."
  npx convex ai-files update
fi

log "Pruning Claude Code copies duplicated by the Convex plugin..."
pruned=0
for skill in "${PLUGIN_DUPLICATES[@]}"; do
  if [[ -e ".claude/skills/$skill" ]]; then
    rm -rf ".claude/skills/$skill"
    pruned=$((pruned + 1))
  fi
done
log "Pruned $pruned duplicate(s); .agents/skills keeps them for Codex."

log "Skills visible to Claude Code: $(ls .claude/skills | wc -l)"
npx convex ai-files status
