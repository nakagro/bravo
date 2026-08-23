#!/usr/bin/env node
/**
 * Validates the frontmatter on every doc under docs/ and regenerates
 * docs/README.md from it.
 *
 *   npm run docs:index          validate + regenerate
 *   npm run docs:index -- --check   validate only, write nothing
 *
 * Exits non-zero on a validation error so this can be dropped into CI as-is.
 * Warnings (drift, dead links) report but do not fail.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { execSync } from "node:child_process";

const DOCS = "docs";
const SKIP_DIRS = new Set(["archive-pre-2026"]);
const OUT = join(DOCS, "README.md");

const KINDS = ["plan", "reference", "runbook", "audit"];
const STATUS_BY_KIND = {
  plan: ["planned", "in-progress", "partial", "implemented", "superseded", "abandoned"],
  reference: ["current", "outdated", "superseded"],
  runbook: ["current", "outdated", "superseded"],
  audit: ["current", "historical", "superseded"],
};
const DEPLOYED = ["pending", "done", "n-a", "unknown"];
const REQUIRED = ["title", "kind", "status", "deployed", "updated"];

const errors = [];
const warnings = [];
const noHistory = [];

// ── tiny frontmatter parser (scalars + [a, b] lists; no dependency) ─────────
function parseFrontmatter(raw, file) {
  if (!raw.startsWith("---\n")) {
    errors.push(`${file}: no frontmatter block`);
    return null;
  }
  const end = raw.indexOf("\n---\n", 4);
  if (end === -1) {
    errors.push(`${file}: frontmatter block is not closed`);
    return null;
  }
  const data = {};
  for (const line of raw.slice(4, end).split("\n")) {
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    let [, key, val] = m;
    val = val.trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      data[key] = inner ? inner.split(",").map((s) => s.trim()) : [];
    } else if (val === "null" || val === "") {
      data[key] = null;
    } else {
      data[key] = val.replace(/^"(.*)"$/, "$1");
    }
  }
  return { data, body: raw.slice(end + 5) };
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(join(dir, entry.name)));
    } else if (entry.name.endsWith(".md") && join(dir, entry.name) !== OUT) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

function lastCommitDate(file) {
  try {
    return execSync(`git log -1 --format=%ad --date=short -- "${file}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// ── collect ────────────────────────────────────────────────────────────────
const files = walk(DOCS).sort();
const docs = [];

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const parsed = parseFrontmatter(raw, file);
  if (!parsed) continue;
  const { data, body } = parsed;

  for (const key of REQUIRED) {
    if (data[key] == null) errors.push(`${file}: missing required field '${key}'`);
  }
  if (data.kind && !KINDS.includes(data.kind)) {
    errors.push(`${file}: unknown kind '${data.kind}' (expected ${KINDS.join(" | ")})`);
  } else if (data.kind && data.status && !STATUS_BY_KIND[data.kind].includes(data.status)) {
    errors.push(
      `${file}: status '${data.status}' is not valid for kind '${data.kind}' ` +
        `(expected ${STATUS_BY_KIND[data.kind].join(" | ")})`
    );
  }
  if (data.deployed && !DEPLOYED.includes(data.deployed)) {
    errors.push(`${file}: unknown deployed '${data.deployed}' (expected ${DEPLOYED.join(" | ")})`);
  }
  if (data.superseded_by) {
    const target = join(dirname(file), data.superseded_by);
    if (!existsSync(target)) {
      errors.push(`${file}: superseded_by points at a missing file '${data.superseded_by}'`);
    }
  }

  // Drift: frontmatter older than the file's last commit. Only meaningful once
  // the file has history at its current path — a staged-but-uncommitted rename
  // has none, so count those and report rather than skipping silently.
  const commit = lastCommitDate(file);
  if (!commit) {
    noHistory.push(file);
  } else if (data.updated && data.updated < commit) {
    warnings.push(
      `${file}: updated: ${data.updated} predates last commit ${commit} — frontmatter may be stale`
    );
  }

  // dead relative links
  for (const [, link] of body.matchAll(/\]\((\.{1,2}\/[^)\s#]+|[a-z0-9-]+\.md)[^)]*\)/gi)) {
    const target = resolve(dirname(file), link);
    if (!existsSync(target)) warnings.push(`${file}: link to missing file '${link}'`);
  }

  docs.push({ ...data, file, rel: relative(DOCS, file) });
}

// ── report ─────────────────────────────────────────────────────────────────
if (noHistory.length) {
  console.warn(
    `  note  ${noHistory.length} doc(s) have no committed history at their current path ` +
      `— drift check skipped for them (expected right after a rename; resolves once committed).`
  );
}
for (const w of warnings) console.warn(`  warn  ${w}`);
for (const e of errors) console.error(`  ERROR ${e}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s). docs/README.md not regenerated.`);
  process.exit(1);
}

if (process.argv.includes("--check")) {
  console.log(`${docs.length} docs valid${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`);
  process.exit(0);
}

// ── generate ───────────────────────────────────────────────────────────────
const byStatus = (...s) => docs.filter((d) => s.includes(d.status)).sort((a, b) => b.updated.localeCompare(a.updated));
const ofKind = (k, ...s) =>
  docs.filter((d) => d.kind === k && (s.length === 0 || s.includes(d.status)))
      .sort((a, b) => a.title.localeCompare(b.title));

const row = (d) => `| [${d.title}](${d.rel}) | ${d.status} | ${d.updated} |`;
const HEAD = "| Document | Status | Updated |\n|---|---|---|";

const L = [];
L.push("<!-- GENERATED by scripts/docs-index.mjs — do not edit by hand. -->");
L.push("<!-- Regenerate with: npm run docs:index -->");
L.push("");
L.push("# Documentation index");
L.push("");
L.push(
  `${docs.length} documents. Status lives in each file's frontmatter; this page is generated from it. ` +
    "Run `npm run docs:index` after adding or changing a doc."
);
L.push("");

const pending = docs.filter((d) => d.deployed === "pending");
L.push("## ⚠️ Awaiting VPS deploy");
L.push("");
if (pending.length) {
  L.push("Implemented and merged, but the backend is not yet on the VPS. Deploy with `npm run deploy:convex:vps`.");
  L.push("");
  L.push(HEAD);
  pending.forEach((d) => L.push(row(d)));
} else {
  L.push("Nothing outstanding — every implemented change is deployed.");
}
L.push("");

const active = byStatus("planned", "in-progress", "partial");
L.push("## Active plans");
L.push("");
if (active.length) {
  L.push(HEAD);
  active.forEach((d) => L.push(row(d)));
} else {
  L.push("_None._");
}
L.push("");

L.push("## Implemented plans");
L.push("");
L.push(HEAD);
ofKind("plan", "implemented").forEach((d) => L.push(row(d)));
L.push("");

for (const [kind, heading, blurb] of [
  ["reference", "Reference", "How things work today."],
  ["runbook", "Runbooks", "Operational procedures."],
  ["audit", "Audits & evaluations", "Point-in-time assessments."],
]) {
  const rows = ofKind(kind).filter((d) => d.status !== "superseded");
  if (!rows.length) continue;
  L.push(`## ${heading}`);
  L.push("");
  L.push(`${blurb}`);
  L.push("");
  L.push(HEAD);
  rows.forEach((d) => L.push(row(d)));
  L.push("");
}

const dead = byStatus("superseded", "abandoned", "outdated");
if (dead.length) {
  L.push("<details>");
  L.push(`<summary>Superseded &amp; abandoned (${dead.length})</summary>`);
  L.push("");
  L.push("| Document | Status | Superseded by |");
  L.push("|---|---|---|");
  dead.forEach((d) =>
    L.push(`| [${d.title}](${d.rel}) | ${d.status} | ${d.superseded_by ?? "—"} |`)
  );
  L.push("");
  L.push("</details>");
  L.push("");
}

writeFileSync(OUT, L.join("\n"));
console.log(
  `${docs.length} docs indexed → ${OUT}` +
    (warnings.length ? ` (${warnings.length} warning(s))` : "")
);
