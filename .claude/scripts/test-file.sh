#!/usr/bin/env bash
# test-file.sh - run a single test file for one SchemaForge package.
#
# Usage:
#   .claude/scripts/test-file.sh <core|frontend|backend> <test-file-path> [--name <pattern>] [--update-snapshots]
#
# <test-file-path> must exist, be a regular file (not a symlink) inside the
# package's own directory, and match *.test.ts, *.test.tsx, or *.spec.ts.
# It may be given relative to the repo root, relative to the package
# directory, or as an absolute path (repo-root-relative is tried first); ".."
# escapes and paths outside the package directory are rejected.
#
# Runs (coverage disabled, since this is for iterating on one file):
#   pnpm --filter <pkg> exec vitest run <path relative to package> --coverage.enabled=false [-t '<pattern>'] [-u]
#
# --update-snapshots writes snapshot files for this run; every other flag
# combination only writes gitignored output (coverage/, if re-enabled).

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

usage() {
  cat <<'EOF'
Usage: test-file.sh <core|frontend|backend> <test-file-path> [--name <pattern>] [--update-snapshots]

Runs one test file with `vitest run --coverage.enabled=false`. The path must
be a real, non-symlink file inside the given package's directory, matching
*.test.ts, *.test.tsx, or *.spec.ts. It may be given relative to the repo
root or relative to the package directory (repo-root-relative is tried
first). --name passes -t '<pattern>' to vitest. --update-snapshots passes
-u (writes snapshot files).
EOF
}

for arg in "$@"; do
  case "${arg}" in
    -h|--help)
      usage
      exit 0
      ;;
  esac
done

if [ "$#" -lt 2 ]; then
  usage
  exit 2
fi

PKG="$1"
TEST_PATH="$2"
shift 2

NAME_PATTERN=""
HAS_NAME=0
UPDATE_SNAPSHOTS=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --name)
      if [ "$#" -lt 2 ]; then
        echo "error: --name requires a pattern" >&2
        usage
        exit 2
      fi
      NAME_PATTERN="$2"
      HAS_NAME=1
      shift 2
      ;;
    --update-snapshots)
      UPDATE_SNAPSHOTS=1
      shift
      ;;
    *)
      echo "error: unknown argument '$1'" >&2
      usage
      exit 2
      ;;
  esac
done

resolve_package "${PKG}"

# ---------------------------------------------------------------------------
# Accept the path either relative to the repo root or relative to the
# package directory (or absolute). Repo-root-relative is tried first; if it
# doesn't exist there, fall back to resolving it against the package
# directory. Everything below still validates the result just as strictly
# either way (physical resolution, inside PKG_DIR, not a symlink, correct
# suffix).
# ---------------------------------------------------------------------------

if [ ! -e "${TEST_PATH}" ] && [ -e "${PKG_DIR}/${TEST_PATH}" ]; then
  TEST_PATH="${PKG_DIR}/${TEST_PATH}"
fi

# ---------------------------------------------------------------------------
# Validate the path: must exist, be a regular non-symlink file, resolve to
# inside PKG_DIR (rejecting ".." escapes), and match a test-file pattern.
# ---------------------------------------------------------------------------

if [ ! -e "${TEST_PATH}" ]; then
  echo "error: '${TEST_PATH}' does not exist" >&2
  exit 2
fi

if [ -L "${TEST_PATH}" ]; then
  echo "error: '${TEST_PATH}' is a symlink, which is not allowed" >&2
  exit 2
fi

if [ ! -f "${TEST_PATH}" ]; then
  echo "error: '${TEST_PATH}' is not a regular file" >&2
  exit 2
fi

TEST_DIR_PART="$(dirname -- "${TEST_PATH}")"
TEST_BASE_PART="$(basename -- "${TEST_PATH}")"
RESOLVED_DIR="$(cd -- "${TEST_DIR_PART}" >/dev/null 2>&1 && pwd -P)" || {
  echo "error: could not resolve directory of '${TEST_PATH}'" >&2
  exit 2
}
RESOLVED_PATH="${RESOLVED_DIR}/${TEST_BASE_PART}"

PKG_DIR_ABS="$(cd -- "${REPO_ROOT}/${PKG_DIR}" >/dev/null 2>&1 && pwd -P)"

case "${RESOLVED_PATH}" in
  "${PKG_DIR_ABS}/"*)
    ;;
  *)
    echo "error: '${TEST_PATH}' resolves outside package directory '${PKG_DIR}'" >&2
    exit 2
    ;;
esac

case "${TEST_BASE_PART}" in
  *.test.ts|*.test.tsx|*.spec.ts)
    ;;
  *)
    echo "error: '${TEST_PATH}' does not match *.test.ts, *.test.tsx, or *.spec.ts" >&2
    exit 2
    ;;
esac

RELATIVE_PATH="${RESOLVED_PATH#"${PKG_DIR_ABS}"/}"

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

ensure_node

# Prefix with "./" so a test file whose name looks like a flag (for example
# "-x.test.ts") is never mistaken for one. vitest's own flags follow, so "--"
# cannot be used here without also blocking those.
SAFE_RELATIVE_PATH="./${RELATIVE_PATH}"

CMD=(pnpm --filter "${PKG_FILTER}" exec vitest run "${SAFE_RELATIVE_PATH}" --coverage.enabled=false)
if [ "${HAS_NAME}" -eq 1 ]; then
  CMD+=(-t "${NAME_PATTERN}")
fi
if [ "${UPDATE_SNAPSHOTS}" -eq 1 ]; then
  CMD+=(-u)
fi

LABEL="${PKG} test-file ${RELATIVE_PATH}"
if run_step "${LABEL}" "${CMD[@]}"; then
  echo "RESULT: PASS"
  exit 0
else
  echo "RESULT: FAIL (${LABEL})"
  exit 1
fi
