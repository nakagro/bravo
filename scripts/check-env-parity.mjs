#!/usr/bin/env node
/**
 * Check that a Convex deployment has the environment variables it needs.
 *
 *   npm run env:parity            # check UAT (precious-magpie-647)
 *   npm run env:parity -- --prod  # check production (read-only)
 *   npm run env:parity -- --compare
 *
 * Nothing else tells you a deployment is misconfigured until something fails at
 * runtime - usually as a silently swallowed email or a push that 403s. This is
 * the check that runs before that happens.
 *
 * `--compare` is the important one: it catches values that are supposed to
 * DIFFER between prod and UAT but don't. A shared CalDAV collection or a shared
 * VAPID keypair is not a missing variable, so a presence check cannot see it,
 * but either one lets a UAT action reach real members or real brigade data.
 */

import { execFileSync } from "node:child_process";

const UAT_DEPLOYMENT = "precious-magpie-647";
const PROD_ENV_FILE = ".env.vps";

/**
 * scope:
 *   both     - required on prod and UAT
 *   uat      - required on UAT only
 *   prod     - required on prod only
 *   optional - fine either way, reported for information
 */
const CANONICAL = [
  // Convex Auth signing pair. Provisioned per-deployment; prod and UAT
  // deliberately hold different pairs so tokens are mutually invalid.
  { name: "JWT_PRIVATE_KEY", scope: "both", secret: true },
  { name: "JWKS", scope: "both", secret: true },

  // Declared in convex/convex.config.ts as required typed env - a deploy FAILS
  // until all three are set.
  { name: "CALDAV_URL", scope: "both", mustDiffer: true },
  { name: "CALDAV_USERNAME", scope: "both" },
  { name: "CALDAV_PASSWORD", scope: "both", secret: true },

  { name: "RESEND_API_KEY", scope: "both", secret: true },

  // Cloned pushSubscriptions are bound to the prod VAPID public key, so UAT
  // must hold its OWN pair - that mismatch is what makes UAT pushes 403
  // instead of reaching real members' phones.
  { name: "VAPID_PUBLIC_KEY", scope: "both", mustDiffer: true },
  { name: "VAPID_PRIVATE_KEY", scope: "both", secret: true, mustDiffer: true },

  // The two guards that make an unscrubbed prod clone safe on UAT.
  {
    name: "EMAIL_ALLOWLIST",
    scope: "uat",
    forbiddenOnProd: true,
    note: "mail to anyone not listed is dropped; MUST stay unset on prod",
  },
  {
    name: "FRONTEND_URL",
    scope: "uat",
    mustDiffer: true,
    note: "without it, UAT password-reset links point at production",
  },

  // Built-in on BOTH tiers, so it never shows up in `convex env list` and must
  // not be treated as missing: Convex Cloud supplies it on UAT, and on the VPS
  // the backend container supplies it from its own docker env. The copy in
  // .env.vps is a CLI-local leftover the backend never reads.
  {
    name: "CONVEX_SITE_URL",
    scope: "optional",
    note: "platform built-in on both tiers; not user-set",
  },

  {
    name: "CONVEX_API_KEY",
    scope: "optional",
    mustDiffer: true,
    note: "unset on UAT = the external turnout SPA path fails closed there",
  },
  { name: "POSTHOG_API_KEY", scope: "optional", secret: true },
  { name: "POSTHOG_HOST", scope: "optional" },
  {
    name: "SIMULATION_ENABLED",
    scope: "optional",
    note: "turn OFF while verifying a feature on UAT",
  },
];

function readEnv(target) {
  const args =
    target === "prod"
      ? ["convex", "env", "list", "--env-file", PROD_ENV_FILE]
      : ["convex", "env", "list"];
  const options = {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env:
      target === "prod"
        ? process.env
        : { ...process.env, CONVEX_DEPLOYMENT: UAT_DEPLOYMENT },
  };

  let raw;
  try {
    raw = execFileSync("npx", args, options);
  } catch (error) {
    const detail = (error.stderr || error.message || "").toString().trim();
    console.error(`\n  Could not read env for ${target}:\n  ${detail}\n`);
    process.exit(2);
  }

  const values = new Map();
  for (const line of raw.split("\n")) {
    const index = line.indexOf("=");
    if (index === -1) continue;
    values.set(line.slice(0, index).trim(), line.slice(index + 1));
  }
  return values;
}

function isRequired(entry, target) {
  return entry.scope === "both" || entry.scope === target;
}

function checkOne(target, values) {
  const label = target === "prod" ? "PRODUCTION (VPS)" : `UAT (${UAT_DEPLOYMENT})`;
  console.log(`\n  ${label}\n  ${"-".repeat(label.length)}`);

  const missing = [];
  const warnings = [];

  for (const entry of CANONICAL) {
    const present = values.has(entry.name) && values.get(entry.name) !== "";

    if (entry.forbiddenOnProd && target === "prod" && present) {
      warnings.push(
        `${entry.name} is SET on production - real member mail is being dropped`
      );
      continue;
    }

    if (isRequired(entry, target)) {
      if (present) {
        console.log(`    ok       ${entry.name}`);
      } else {
        missing.push(entry);
        console.log(`    MISSING  ${entry.name}`);
      }
    } else if (present) {
      console.log(`    set      ${entry.name} (optional)`);
    } else {
      console.log(`    unset    ${entry.name} (optional)`);
    }
  }

  if (missing.length > 0) {
    console.log("");
    for (const entry of missing) {
      const hint = entry.note ? ` - ${entry.note}` : "";
      console.log(`    ! ${entry.name}${hint}`);
    }
  }

  for (const warning of warnings) {
    console.log(`\n    !! ${warning}`);
  }

  return missing.length + warnings.length;
}

/**
 * Values that must not match across deployments. A presence check passes
 * happily when prod and UAT share a CalDAV collection or a VAPID keypair -
 * and that is precisely the configuration that lets UAT reach real data.
 */
function compare(prodValues, uatValues) {
  console.log("\n  PROD vs UAT - values that must differ");
  console.log("  -------------------------------------");

  let problems = 0;

  for (const entry of CANONICAL.filter((candidate) => candidate.mustDiffer)) {
    const prodValue = prodValues.get(entry.name);
    const uatValue = uatValues.get(entry.name);

    if (prodValue === undefined || uatValue === undefined) {
      console.log(`    skip     ${entry.name} (not set on both)`);
      continue;
    }

    if (prodValue === uatValue) {
      console.log(`    SHARED   ${entry.name}  <-- must differ`);
      problems += 1;
      continue;
    }

    // A URL can differ by hostname and still address the same resource - the
    // UAT CalDAV entry did exactly that, pointing at the live brigade calendar
    // through a public hostname instead of the internal one.
    if (/^https?:\/\//.test(prodValue) && /^https?:\/\//.test(uatValue)) {
      try {
        const prodPath = new URL(prodValue).pathname.replace(/\/+$/, "");
        const uatPath = new URL(uatValue).pathname.replace(/\/+$/, "");
        if (prodPath !== "" && prodPath === uatPath) {
          console.log(
            `    SAME PATH ${entry.name}  <-- different host, same resource:\n` +
              `                 ${prodPath}`
          );
          problems += 1;
          continue;
        }
      } catch {
        // Not parseable as a URL; the plain inequality above is enough.
      }
    }

    console.log(`    ok       ${entry.name}`);
  }

  return problems;
}

const flags = process.argv.slice(2);
const wantProd = flags.includes("--prod");
const wantCompare = flags.includes("--compare");

console.log("\n  Convex environment parity");

let issues = 0;

if (wantCompare) {
  const prodValues = readEnv("prod");
  const uatValues = readEnv("uat");
  issues += checkOne("prod", prodValues);
  issues += checkOne("uat", uatValues);
  issues += compare(prodValues, uatValues);
} else if (wantProd) {
  issues += checkOne("prod", readEnv("prod"));
} else {
  issues += checkOne("uat", readEnv("uat"));
}

if (issues > 0) {
  console.log(`\n  ${issues} issue(s) found.\n`);
  process.exit(1);
}

console.log("\n  All good.\n");
