#!/usr/bin/env node
/**
 * Pointer for npm scripts that were renamed from `:cloud` to `:uat`.
 *
 * precious-magpie-647 used to be a disposable sandbox; it is now the UAT tier
 * holding a clone of production data. Two names for the same deployment is
 * worse than one, so the `:cloud` names are retired - but silently deleting
 * them would leave muscle memory and old docs failing with a bare
 * "Missing script", which reads like a broken checkout rather than a rename.
 *
 * Exits non-zero on purpose: this must not look like the command succeeded.
 */

const [oldName, newName] = process.argv.slice(2);

console.error(`
  'npm run ${oldName}' has been renamed.

    use:  npm run ${newName}

  precious-magpie-647 is the UAT tier now, not a sandbox - it holds a clone of
  production data, so the ':cloud' naming was misleading about what it touches.
`);

process.exit(1);
