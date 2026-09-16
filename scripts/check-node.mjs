// Root `preinstall` guard: stop an install that runs on a Node version outside
// `engines.node`. It runs before node_modules exists, so it must stay free of
// dependencies (no semver, no workspace imports) and use plain Node built-ins.
import { readFileSync } from "node:fs";

const rootPackageJson = new URL("../package.json", import.meta.url);
const requiredRange = JSON.parse(readFileSync(rootPackageJson, "utf8")).engines
  .node;

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)/;

/** Parse "24.15.0", "v24.15.0" or "25.0.0-nightly" into [major, minor, patch]. */
function parseVersion(version) {
  const match = VERSION_PATTERN.exec(version.trim());
  if (match === null) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Compare two [major, minor, patch] tuples: -1, 0 or 1. */
function compareVersions(left, right) {
  for (let part = 0; part < 3; part += 1) {
    if (left[part] !== right[part]) {
      return left[part] < right[part] ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Expand the range forms this repo uses ("^x.y.z" and ">=x.y.z") into an
 * inclusive minimum and an exclusive maximum.
 */
function parseRange(range) {
  const trimmed = range.trim();
  const operator = trimmed.startsWith("^")
    ? "^"
    : trimmed.startsWith(">=")
      ? ">="
      : null;
  if (operator === null) {
    return null;
  }

  const minimum = parseVersion(trimmed.slice(operator.length));
  if (minimum === null) {
    return null;
  }

  const [major, minor] = minimum;
  // `^0.y.z` stays inside the same 0.y line; `^x.y.z` stays inside major x.
  const exclusiveMaximum =
    operator === ">="
      ? null
      : major === 0
        ? [0, minor + 1, 0]
        : [major + 1, 0, 0];

  return { minimum, exclusiveMaximum };
}

function fail(lines) {
  process.stderr.write(`\n[schemaforge] ${lines.join("\n")}\n\n`);
  process.exit(1);
}

const wanted = parseRange(requiredRange);
if (wanted === null) {
  fail([
    `Unsupported engines.node range "${requiredRange}" in the root package.json.`,
    "Teach scripts/check-node.mjs how to read it before using this range.",
  ]);
}

const current = parseVersion(process.versions.node);
const satisfied =
  current !== null &&
  compareVersions(current, wanted.minimum) >= 0 &&
  (wanted.exclusiveMaximum === null ||
    compareVersions(current, wanted.exclusiveMaximum) < 0);

if (!satisfied) {
  fail([
    "This Node version cannot install the workspace.",
    "",
    `  required: ${requiredRange}  (engines.node, see .nvmrc)`,
    `  running:  ${process.versions.node}  (${process.execPath})`,
    "",
    "Fix it in the repo root, then install again:",
    "  source ~/.nvm/nvm.sh && nvm use     # switch to the .nvmrc version",
    "  nvm install                         # if that version is not installed yet",
  ]);
}
