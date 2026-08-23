#!/usr/bin/env bash
# Vercel "Ignored Build Step" hook.
# Counterintuitive contract: exit 0 = SKIP the build, exit 1 = RUN it.
#
# Each Vercel project builds only its own production branch:
#   prod project -> main, uat project -> uat
# Preview deployments are skipped, so a push to one branch never triggers
# a build in the other project.

if [ "$VERCEL_ENV" = "production" ]; then
  echo "Production deploy of '$VERCEL_GIT_COMMIT_REF' - building."
  exit 1
fi

echo "Preview deploy of '$VERCEL_GIT_COMMIT_REF' - skipping build."
exit 0
