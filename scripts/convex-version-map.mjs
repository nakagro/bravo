#!/usr/bin/env node

/**
 * Maps the `convex` npm package version onto self-hosted backend Docker images, and
 * reports where our stack sits against the latest of both.
 *
 * `convex/convex-backend` is a monorepo: it holds both the Rust backend and the
 * source of the npm package (`npm-packages/convex`). One commit therefore produces one
 * (backend, client) pair, and every published artifact names that same commit:
 *
 *   ghcr tag       ->  full 40-char commit SHA
 *   GitHub release ->  precompiled-<date>-<first 7 of that SHA>
 *   npm version    ->  npm-packages/convex/package.json at that commit
 *
 * See docs/CONVEX-SELF-HOST-VERSIONS.md for the long-form explanation.
 *
 * Usage:
 *   node scripts/convex-version-map.mjs                 # full stack status + upgrade path
 *   node scripts/convex-version-map.mjs --running <sha> # override the live backend commit
 *   node scripts/convex-version-map.mjs --version 1.44.0
 *   node scripts/convex-version-map.mjs --image <sha|precompiled-tag|latest>
 *   node scripts/convex-version-map.mjs --json
 *
 * The live backend cannot report its own build (self-hosted `/version` returns "unknown"),
 * so the running commit comes from `CONVEX_BACKEND_REV` in .env.vps or from --running.
 * Set GITHUB_TOKEN to lift the 60 requests/hour anonymous GitHub API limit.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const REPO = "convex/convex-backend";
const BACKEND_IMAGE = "ghcr.io/convex/convex-backend";
const DASHBOARD_IMAGE = "ghcr.io/convex/convex-dashboard";
const PKG_PATH = "npm-packages/convex/package.json";
const RELEASE_PAGES = 6; // 100 releases per page; paging stops early at the cutoff date
const COMMIT_PAGE_SIZE = 30; // larger pages make GitHub time out on the path-filtered query
const COMMIT_PAGES = 4;
const MIN_RELEASES = 12; // enough history to anchor a version and count the gap
const REV_ENV_VAR = "CONVEX_BACKEND_REV";

class Failure extends Error {}

/* ---------------------------------------------------------------- fetching */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GitHub serves an occasional 502/504 on the heavier endpoints, so transient
 * server errors are retried before being reported as a failure.
 */
async function getJson(url, { headers = {}, label, attempts = 3 } = {}) {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": "bravo-convex-version-map", ...headers },
    });

    if (response.status === 403 || response.status === 429) {
      if (response.headers.get("x-ratelimit-remaining") === "0") {
        throw new Failure(
          "GitHub API rate limit reached (60/hour unauthenticated). " +
            "Set GITHUB_TOKEN and retry, or use the manual curl recipes in " +
            "docs/CONVEX-SELF-HOST-VERSIONS.md",
        );
      }
    }

    if (response.ok) return response.json();

    lastStatus = response.status;
    if (response.status < 500 || attempt === attempts) break;
    await sleep(attempt * 750);
  }

  throw new Failure(`${label ?? url} returned HTTP ${lastStatus}`);
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const githubJson = (path, label) =>
  getJson(`https://api.github.com/repos/${REPO}${path}`, {
    headers: githubHeaders(),
    label,
  });

/* ------------------------------------------------------------ local config */

/** .env.vps is gitignored and already holds the VPS connection details. */
function envVps() {
  const path = join(projectRoot, ".env.vps");
  if (!existsSync(path)) return {};

  const values = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function lockedNpmVersion() {
  const lock = JSON.parse(
    readFileSync(join(projectRoot, "package-lock.json"), "utf8"),
  );
  const version = lock.packages?.["node_modules/convex"]?.version;
  if (!version) throw new Failure("convex is not present in package-lock.json");
  return version;
}

async function latestNpmVersion() {
  const { version } = await getJson(
    "https://registry.npmjs.org/convex/latest",
    {
      label: "npm registry",
    },
  );
  return version;
}

/* ----------------------------------------------------------- ghcr registry */

let ghcrTokenCache = null;

async function ghcrToken(repository) {
  if (ghcrTokenCache) return ghcrTokenCache;
  const { token } = await getJson(
    `https://ghcr.io/token?scope=repository:${repository}:pull&service=ghcr.io`,
    { label: "ghcr token" },
  );
  ghcrTokenCache = token;
  return token;
}

async function ghcrTags(repository = "convex/convex-backend") {
  const token = await ghcrToken(repository);
  const { tags } = await getJson(
    `https://ghcr.io/v2/${repository}/tags/list?n=2000`,
    { headers: { Authorization: `Bearer ${token}` }, label: "ghcr tag list" },
  );
  return tags ?? [];
}

/**
 * `:latest` is re-pointed by hand through a workflow_dispatch, so it is not the newest
 * build. Resolve the commit it currently carries from the image's OCI revision label.
 */
async function resolveTagToCommit(
  tag,
  repository = "convex/convex-backend",
) {
  const token = await ghcrToken(repository);
  const auth = { Authorization: `Bearer ${token}` };
  const accept = [
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.docker.distribution.manifest.v2+json",
  ].join(",");

  let manifest = await getJson(
    `https://ghcr.io/v2/${repository}/manifests/${tag}`,
    { headers: { ...auth, Accept: accept }, label: `manifest for :${tag}` },
  );

  if (Array.isArray(manifest.manifests)) {
    const child =
      manifest.manifests.find((m) => m.platform?.architecture === "amd64") ??
      manifest.manifests[0];
    manifest = await getJson(
      `https://ghcr.io/v2/${repository}/manifests/${child.digest}`,
      {
        headers: { ...auth, Accept: accept },
        label: `child manifest for :${tag}`,
      },
    );
  }

  const config = await getJson(
    `https://ghcr.io/v2/${repository}/blobs/${manifest.config.digest}`,
    { headers: auth, label: `config blob for :${tag}` },
  );

  const revision =
    config?.config?.Labels?.["org.opencontainers.image.revision"];
  if (!revision) {
    throw new Failure(
      `:${tag} carries no org.opencontainers.image.revision label`,
    );
  }
  return { sha: revision, built: config.created?.slice(0, 10) ?? null };
}

/* ------------------------------------------------------------ repo lookups */

async function npmVersionAtSha(sha) {
  const response = await fetch(
    `https://raw.githubusercontent.com/${REPO}/${sha}/${PKG_PATH}`,
    { headers: { "User-Agent": "bravo-convex-version-map" } },
  );
  if (!response.ok) {
    throw new Failure(
      `no ${PKG_PATH} at commit ${short(sha)} (HTTP ${response.status})`,
    );
  }
  return JSON.parse(await response.text()).version;
}

/**
 * Convex lands a commit titled "npm release version X.Y.Z" for each release. One request
 * gives every recent release, which anchors both directions and counts the gap between
 * two versions without any further lookups.
 */
async function releaseCommits() {
  const commits = [];

  // per_page=100 on this path-filtered query times out server-side (HTTP 504),
  // so it is read in smaller pages until enough releases are in hand.
  for (let page = 1; page <= COMMIT_PAGES; page++) {
    const batch = await githubJson(
      `/commits?path=${encodeURIComponent(PKG_PATH)}&per_page=${COMMIT_PAGE_SIZE}&page=${page}`,
      "commit list",
    );
    commits.push(...batch);
    if (batch.length < COMMIT_PAGE_SIZE) break;
    if (countReleases(commits) >= MIN_RELEASES) break;
  }

  return commits.flatMap((commit) => {
    const subject = (commit.commit?.message ?? "").split("\n")[0];
    const version = /npm\s+(?:release\s+)?version\s+(\d+\.\d+\.\d+)/i.exec(
      subject,
    )?.[1];
    if (!version) return [];
    return [
      {
        version,
        sha: commit.sha,
        date: (
          commit.commit.committer?.date ?? commit.commit.author.date
        ).slice(0, 10),
        subject,
      },
    ];
  });
}

const RELEASE_SUBJECT = /npm\s+(?:release\s+)?version\s+(\d+\.\d+\.\d+)/i;

const countReleases = (commits) =>
  commits.filter((commit) =>
    RELEASE_SUBJECT.test((commit.commit?.message ?? "").split("\n")[0]),
  ).length;

function anchorFor(releases, version) {
  const anchor = releases.find((r) => r.version === version);
  if (!anchor) {
    throw new Failure(
      `no "npm release version ${version}" commit in the last ${COMMIT_PAGE_SIZE * COMMIT_PAGES} changes to ${PKG_PATH}. ` +
        "The release may predate that window; check the commit history by hand.",
    );
  }
  return anchor;
}

/** Releases carry the build date; ghcr says which of them actually have an image. */
async function builtCommits(tags, cutoffDate = null) {
  const byPrefix = new Map();
  for (const tag of tags) {
    if (/^[0-9a-f]{40}$/.test(tag)) byPrefix.set(tag.slice(0, 7), tag);
  }

  const builds = [];
  for (let page = 1; page <= RELEASE_PAGES; page++) {
    const releases = await githubJson(
      `/releases?per_page=100&page=${page}`,
      "release list",
    );
    if (releases.length === 0) break;

    for (const release of releases) {
      const prefix = /^precompiled-\d{4}-\d{2}-\d{2}-([0-9a-f]{7})$/.exec(
        release.tag_name,
      )?.[1];
      const sha = prefix && byPrefix.get(prefix);
      if (sha) {
        builds.push({
          sha,
          date: release.published_at.slice(0, 10),
          published: release.published_at,
        });
      }
    }

    // Releases come back newest first, so once a page ends before the cutoff we have
    // every build we could possibly recommend.
    const oldest = releases.at(-1)?.published_at?.slice(0, 10);
    if (cutoffDate && oldest && oldest < cutoffDate) break;
  }

  builds.sort((a, b) => a.published.localeCompare(b.published));
  return builds;
}

/**
 * Release dates are only accurate to the day, and builds land either side of the release
 * commit on the same day, so the candidate is confirmed by reading the version it actually
 * stamps rather than trusting the date.
 */
async function firstBuildAtOrAfter(builds, anchor, targetVersion, limit = 12) {
  const candidates = builds
    .filter((b) => b.date >= anchor.date)
    .slice(0, limit);
  for (const build of candidates) {
    const npmVersion = await npmVersionAtSha(build.sha);
    if (compareSemver(npmVersion, targetVersion) >= 0) {
      return { ...build, npmVersion };
    }
  }
  return null;
}

/* ------------------------------------------------------------- live backend */

/**
 * Self-hosted backends do not stamp `/version`, so this confirms reachability and
 * identity only. The build has to come from the image label on the VPS.
 */
async function probeBackend(url) {
  if (!url) return null;
  const read = async (path) => {
    try {
      const response = await fetch(`${url}${path}`, {
        signal: AbortSignal.timeout(8000),
      });
      return response.ok ? (await response.text()).trim() : null;
    } catch {
      return null;
    }
  };

  const [instance, version] = await Promise.all([
    read("/instance_name"),
    read("/version"),
  ]);
  if (instance === null && version === null) return { url, reachable: false };
  return { url, reachable: true, instance, version };
}

/* --------------------------------------------------------------- utilities */

const short = (sha) => (sha ? sha.slice(0, 7) : "unknown");

function compareSemver(a, b) {
  const parse = (v) => v.split("-")[0].split(".").map(Number);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0) ? -1 : 1;
  }
  return 0;
}

const minVersion = (a, b) => (compareSemver(a, b) <= 0 ? a : b);

/** How many npm releases sit between two versions, using the release commit list. */
function releasesBetween(releases, from, to) {
  const index = (v) => releases.findIndex((r) => r.version === v);
  const [a, b] = [index(to), index(from)];
  return a === -1 || b === -1 ? null : b - a;
}

/**
 * Backends tolerate older clients; a client newer than the backend is the breaking
 * direction, because the CLI calls API surface the backend does not have yet.
 */
function verdict(npmVersion, backendNpmVersion) {
  const order = compareSemver(npmVersion, backendNpmVersion);
  if (order < 0) {
    return {
      ok: true,
      text: `safe: npm ${npmVersion} is older than the backend's ${backendNpmVersion}`,
    };
  }
  if (order === 0) {
    return { ok: true, text: `exact match on ${npmVersion}` };
  }
  return {
    ok: false,
    text:
      `RISK: npm ${npmVersion} is NEWER than the backend's ${backendNpmVersion}. ` +
      "Upgrade the backend image before deploying functions.",
  };
}

const row = (label, value) => console.log(`  ${label.padEnd(23)}${value}`);
const heading = (text) => console.log(`\n${text}`);

/* ------------------------------------------------------------------- modes */

async function imageMode(reference) {
  const tags = await ghcrTags();
  let sha;
  let built = null;

  if (/^[0-9a-f]{40}$/.test(reference)) {
    sha = reference;
  } else if (/^precompiled-\d{4}-\d{2}-\d{2}-[0-9a-f]{7}$/.test(reference)) {
    const prefix = reference.slice(-7);
    sha = tags.find((t) => t.startsWith(prefix));
    if (!sha) throw new Failure(`release ${reference} has no image on ghcr`);
  } else {
    ({ sha, built } = await resolveTagToCommit(reference));
  }

  const npmVersion = await npmVersionAtSha(sha);
  const locked = lockedNpmVersion();
  const result = {
    reference,
    sha,
    built,
    npmVersion,
    lockedNpmVersion: locked,
    verdict: verdict(locked, npmVersion),
  };

  if (jsonOutput) return result;

  heading(`Convex image ${reference}\n`);
  row("commit", sha);
  if (built) row("built", built);
  row("npm version at commit", npmVersion);
  row("our locked npm", locked);
  row("compatibility", result.verdict.text);
  console.log(`\n  ${BACKEND_IMAGE}:${sha}`);
  console.log(`  ${DASHBOARD_IMAGE}:${sha}\n`);
  return result;
}

async function mapMode(version) {
  const releases = await releaseCommits();
  const anchor = anchorFor(releases, version);
  const tags = await ghcrTags();
  const builds = await builtCommits(tags, anchor.date);
  const match = tags.includes(anchor.sha)
    ? { sha: anchor.sha, date: anchor.date, npmVersion: version, exact: true }
    : await firstBuildAtOrAfter(builds, anchor, version);

  const result = {
    npmVersion: version,
    anchor,
    recommended: match
      ? { ...match, image: `${BACKEND_IMAGE}:${match.sha}` }
      : null,
  };

  if (jsonOutput) return result;

  heading(`Image map for convex@${version}\n`);
  row(
    "anchor commit",
    `${short(anchor.sha)}  ${anchor.date}  "${anchor.subject}"`,
  );
  if (match) {
    row(
      "matching image",
      `${short(match.sha)}  ${match.date}  npm ${match.npmVersion}` +
        (match.exact
          ? "  (built at the anchor commit)"
          : "  (first build at or past the anchor)"),
    );
    console.log("\n  Pin these together:");
    console.log(`    ${BACKEND_IMAGE}:${match.sha}`);
    console.log(`    ${DASHBOARD_IMAGE}:${match.sha}\n`);
  } else {
    row(
      "matching image",
      `no build at or after ${anchor.date} carries npm ${version}`,
    );
    console.log("");
  }
  return result;
}

/**
 * The whole-stack view: what we ship, what is running, what is available, and the
 * shortest safe path from one to the other.
 */
async function statusMode(runningOverride) {
  const env = envVps();
  const backendUrl = env.CONVEX_SELF_HOSTED_URL || env.VITE_CONVEX_URL || null;
  const revSource = runningOverride
    ? "--running"
    : process.env[REV_ENV_VAR]
      ? `${REV_ENV_VAR} (shell)`
      : env[REV_ENV_VAR]
        ? `${REV_ENV_VAR} (.env.vps)`
        : null;
  const revInput =
    runningOverride ?? process.env[REV_ENV_VAR] ?? env[REV_ENV_VAR] ?? null;

  const [installed, latestNpm, releases, tags, probe] = await Promise.all([
    lockedNpmVersion(),
    latestNpmVersion(),
    releaseCommits(),
    ghcrTags(),
    probeBackend(backendUrl),
  ]);

  const installedAnchor = anchorFor(releases, installed);
  const builds = await builtCommits(tags, installedAnchor.date);
  const newest = builds.at(-1) ?? null;
  const latestTag = await resolveTagToCommit("latest").catch(() => null);

  const runningSha = revInput
    ? /^[0-9a-f]{40}$/.test(revInput)
      ? revInput
      : (await resolveTagToCommit(revInput)).sha
    : null;

  const [runningNpm, latestTagNpm, newestNpm] = await Promise.all([
    runningSha ? npmVersionAtSha(runningSha) : null,
    latestTag ? npmVersionAtSha(latestTag.sha) : null,
    newest ? npmVersionAtSha(newest.sha) : null,
  ]);

  const runningBuild = builds.find((b) => b.sha === runningSha) ?? null;
  const forInstalled = tags.includes(installedAnchor.sha)
    ? {
        sha: installedAnchor.sha,
        date: installedAnchor.date,
        npmVersion: installed,
      }
    : await firstBuildAtOrAfter(builds, installedAnchor, installed);

  // Never advise an npm version the target image cannot serve.
  const targetImage = newest;
  const targetNpm = newestNpm ? minVersion(latestNpm, newestNpm) : installed;
  const npmBehind = releasesBetween(releases, installed, latestNpm);
  const check = runningNpm ? verdict(installed, runningNpm) : null;
  const backendCurrent =
    runningSha && targetImage && runningSha === targetImage.sha;
  const npmCurrent = compareSemver(installed, targetNpm) === 0;

  const result = {
    npm: { installed, latest: latestNpm, releasesBehind: npmBehind },
    backend: {
      url: backendUrl,
      reachable: probe?.reachable ?? null,
      instance: probe?.instance ?? null,
      running: runningSha,
      runningNpmVersion: runningNpm,
      runningSource: revSource,
    },
    images: {
      latestTag: latestTag ? { ...latestTag, npmVersion: latestTagNpm } : null,
      newest: newest ? { ...newest, npmVersion: newestNpm } : null,
      forInstalledNpm: forInstalled,
    },
    target: {
      image: targetImage ? `${BACKEND_IMAGE}:${targetImage.sha}` : null,
      dashboard: targetImage ? `${DASHBOARD_IMAGE}:${targetImage.sha}` : null,
      npmVersion: targetNpm,
      backendCurrent,
      npmCurrent,
    },
    verdict: check,
  };

  if (jsonOutput) return result;

  heading("Convex stack status");

  heading("  npm client");
  row("  installed (lock)", `${installed}   released ${installedAnchor.date}`);
  row(
    "  latest on npm",
    `${latestNpm}` +
      (npmBehind === null
        ? ""
        : npmBehind === 0
          ? "   up to date"
          : `   ${npmBehind} release${npmBehind === 1 ? "" : "s"} behind`),
  );

  heading(`  self-hosted backend${backendUrl ? `  ${backendUrl}` : ""}`);
  if (probe) {
    row(
      "  reachable",
      probe.reachable
        ? `yes${probe.instance ? `   instance ${probe.instance}` : ""}`
        : "no (could not reach the URL)",
    );
    if (probe.reachable) {
      row(
        "  /version says",
        `${probe.version || "?"}   (self-hosted builds do not stamp this)`,
      );
    }
  }
  if (runningSha) {
    row(
      "  running commit",
      `${short(runningSha)}  ${runningBuild?.date ?? latestTag?.built ?? "?"}  npm ${runningNpm}   [${revSource}]`,
    );
    row("  compatibility", check.text);
  } else {
    row("  running commit", "unknown");
    console.log(
      `\n    The backend cannot report its own build. Read it once on the VPS:\n` +
        `      docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' <container>\n` +
        `    then add ${REV_ENV_VAR}=<sha> to .env.vps (or pass --running <sha>).`,
    );
  }

  heading("  available images");
  if (latestTag) {
    row(
      "  :latest",
      `${short(latestTag.sha)}  ${latestTag.built ?? "?"}  npm ${latestTagNpm}`,
    );
  }
  if (newest) {
    row(
      "  newest build",
      `${short(newest.sha)}  ${newest.date}  npm ${newestNpm}`,
    );
  }
  if (forInstalled) {
    row(
      `  best for npm ${installed}`,
      `${short(forInstalled.sha)}  ${forInstalled.date}  npm ${forInstalled.npmVersion}`,
    );
  }

  heading("  to bring the stack up to spec");
  if (backendCurrent && npmCurrent) {
    console.log(
      "    Already on the newest build and the npm version it supports.",
    );
  } else {
    const steps = [];
    if (!backendCurrent && targetImage) {
      steps.push(
        "back up the database first:  npm run export:vps",
        "move backend and dashboard to the same commit:\n" +
          `       ${BACKEND_IMAGE}:${targetImage.sha}\n` +
          `       ${DASHBOARD_IMAGE}:${targetImage.sha}`,
      );
    }
    if (!npmCurrent) {
      steps.push(
        (backendCurrent
          ? "bump the client:"
          : "once the backend is up, bump the client:") +
          `  npm i convex@${targetNpm}` +
          (compareSemver(targetNpm, latestNpm) < 0
            ? `\n       (npm ${latestNpm} exists but no image carries it yet)`
            : ""),
      );
    }
    steps.forEach((step, index) => console.log(`    ${index + 1}. ${step}`));
    console.log("\n    Upgrade mechanics: docs/CONVEX-SELF-HOST-VERSIONS.md");
  }
  console.log("");
  return result;
}

/* -------------------------------------------------------------------- main */

const argv = process.argv.slice(2);
const jsonOutput = argv.includes("--json");

function optionValue(name) {
  const index = argv.indexOf(name);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Failure(`${name} needs a value`);
  }
  return value;
}

try {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(
      [
        "Usage:",
        "  node scripts/convex-version-map.mjs                  stack status + upgrade path",
        "  node scripts/convex-version-map.mjs --running <sha>  override the live backend commit",
        "  node scripts/convex-version-map.mjs --version 1.44.0 image map for one npm version",
        "  node scripts/convex-version-map.mjs --image <ref>    sha, precompiled-* tag, or latest",
        "  --json                                              machine-readable output",
        "",
        `The running backend commit is read from ${REV_ENV_VAR} in .env.vps when --running is`,
        "omitted; self-hosted backends do not report their own build.",
        "",
        "Background: docs/CONVEX-SELF-HOST-VERSIONS.md",
      ].join("\n"),
    );
    process.exit(0);
  }

  const image = optionValue("--image");
  const version = optionValue("--version");
  const running = optionValue("--running");

  const result = image
    ? await imageMode(image)
    : version
      ? await mapMode(version)
      : await statusMode(running);

  if (jsonOutput) console.log(JSON.stringify(result, null, 2));
  // Only a known-running backend gates the exit code; browsing modes stay at 0.
  if (result?.verdict?.ok === false && !image) process.exitCode = 1;
} catch (error) {
  if (error instanceof Failure) {
    console.error(`convex-version-map: ${error.message}`);
  } else {
    console.error("convex-version-map: unexpected failure");
    console.error(error);
  }
  process.exit(1);
}
