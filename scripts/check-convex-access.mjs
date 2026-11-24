#!/usr/bin/env node
// Every public Convex function must check who is calling. This fails the lint
// gate when an exported query, mutation or action has no recognised access
// check and isn't listed in scripts/convex-access-allowlist.json.
//
// A check is a call to one of the helpers in convex/lib/access.ts (or the
// module-specific helpers built on them), or to a local helper in the same
// file that makes one. A function that only calls getAuthUserId is scoped to
// the caller's own data at best, and still lets pending and disabled accounts
// through, so it must be listed under "self" deliberately.
//
// Usage: node scripts/check-convex-access.mjs [--list]   (--list prints every
// unguarded function, for refreshing the allowlist)

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const convexDir = path.join(root, "convex");
const allowlist = JSON.parse(
  fs.readFileSync(path.join(root, "scripts/convex-access-allowlist.json"), "utf8"),
);

const GUARDS = [
  // convex/lib/access.ts
  "requireUser", "requireAdmin", "requireSuperAdmin", "requireOfficer", "requireModule", "getActiveUser",
  "getModuleUser", "getAdmin", "getSuperAdmin", "getKioskServiceAccount",
  // module helpers built on them
  "requireModuleAccess", "requireKitAccess", "requireKitAdmin", "requireEventsAdmin",
  "requireEventManager", "eventManagerId", "hasEventsAdmin", "requireInventoryAdmin",
  "requireBookingsAdmin", "canCrewDeployments",
];
// Actions check through an internal query; assignment sources through senderId.
const ACTION_GUARD = /ctx\.runQuery\(\s*internal\.(access\.\w+|\w+\.assert\w+)|\.senderId\(/;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "_generated" || name === "node_modules") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    // Files with more than one dot are skipped by the Convex bundler.
    else if (name.endsWith(".ts") && name.split(".").length === 2) out.push(full);
  }
  return out;
}

/** Split a file into top-level declarations: [name, kind, body]. */
function declarations(src) {
  const starts = [...src.matchAll(/^(?:export )?(?:async function (\w+)|const (\w+)\s*=)/gm)];
  return starts.map((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
    const body = src.slice(m.index, end);
    const kind = /^(?:export )?const \w+\s*=\s*(query|mutation|action)\s*\(/.exec(body)?.[1];
    return { name: m[1] ?? m[2], kind, exported: body.startsWith("export"), body };
  });
}

const callsAny = (body, names) => names.some((n) => new RegExp(`\\b${n}\\(`).test(body));

const missing = [];
for (const file of walk(convexDir)) {
  const rel = path.relative(convexDir, file).replace(/\\/g, "/").replace(/\.ts$/, "");
  const src = fs.readFileSync(file, "utf8");
  const decls = declarations(src);

  // Local names for the access helpers (import { requireAdmin as x }).
  const aliases = [];
  for (const m of src.matchAll(/import \{([^}]*)\} from "(?:\.\.?\/)+lib\/access"/g)) {
    for (const part of m[1].split(",")) {
      const alias = /\w+\s+as\s+(\w+)/.exec(part.trim());
      if (alias) aliases.push(alias[1]);
    }
  }

  // Local helpers that make a check count as checks themselves (to a fixpoint).
  const guards = [...GUARDS, ...aliases];
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of decls) {
      if (d.kind || guards.includes(d.name)) continue;
      if (callsAny(d.body, guards) || ACTION_GUARD.test(d.body)) {
        guards.push(d.name);
        grew = true;
      }
    }
  }

  for (const d of decls) {
    if (!d.kind || !d.exported) continue;
    const id = `${rel}:${d.name}`;
    if (callsAny(d.body, guards) || ACTION_GUARD.test(d.body)) continue;
    if (allowlist.public[id] || allowlist.self[id]) continue;
    missing.push(id);
  }
}

const listed = [...Object.keys(allowlist.public), ...Object.keys(allowlist.self)];
if (process.argv.includes("--list")) {
  console.log(missing.join("\n"));
  process.exit(0);
}
if (missing.length > 0) {
  console.error("Public Convex functions with no access check:\n");
  for (const id of missing) console.error(`  ${id}`);
  console.error(
    "\nStart the handler with a helper from convex/lib/access.ts (requireUser, requireModule,\n" +
      "requireAdmin, ...). If it is genuinely public or self-scoped, add it to\n" +
      "scripts/convex-access-allowlist.json with the reason.",
  );
  process.exit(1);
}
console.log(`Convex access check: every public function is guarded (${listed.length} reviewed exceptions).`);
