import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const projectRoot = process.cwd();
const productionRoots = ["src", "convex", "public", "index.html", "dist"];
const utf8EmDash = Buffer.from([0xe2, 0x80, 0x94]);

const forbiddenTextPatterns = [
  ["percent-encoded UTF-8", /%(?:25)*e2%(?:25)*80%(?:25)*94/i],
  ["HTML hexadecimal entity", /&#x0*2014;?/i],
  ["HTML decimal entity", /&#0*8212;?/i],
  ["Unicode escape", /\\u0*2014|\\u\{0*2014\}/i],
  ["Unicode code-point escape", /\\U0*00002014/i],
  ["byte escapes", /\\x[eE]2\\x80\\x94/i],
  ["CSS code-point escape", /\\0*2014(?:\s|[^0-9a-f])/i],
];

function walk(path) {
  if (path === join(projectRoot, "convex", "_generated")) return [];
  if (!statSync(path).isDirectory()) return [path];

  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    walk(join(path, entry.name)),
  );
}

function exists(path) {
  try {
    return statSync(path).isFile() || statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function findMatches(path) {
  const bytes = readFileSync(path);

  // Skip binary assets in public/dist while still scanning all text files.
  if (bytes.includes(0)) return [];

  const text = bytes.toString("utf8");
  const matches = [];

  if (bytes.includes(utf8EmDash)) matches.push("literal U+2014");

  for (const [label, pattern] of forbiddenTextPatterns) {
    if (pattern.test(text)) matches.push(label);
  }

  return matches;
}

const files = productionRoots
  .filter((root) => exists(join(projectRoot, root)))
  .flatMap((root) => walk(join(projectRoot, root)));

const violations = files.flatMap((file) => {
  const matches = findMatches(file);
  return matches.length > 0
    ? [{ file: relative(projectRoot, file), matches }]
    : [];
});

if (violations.length > 0) {
  console.error("Em dash representations found in production inputs:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.matches.join(", ")}`);
  }
  process.exitCode = 1;
} else {
  console.log("No em dash representations found in production inputs.");
}
