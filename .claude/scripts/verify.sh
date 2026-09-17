#!/usr/bin/env bash
# verify.sh - run typecheck/lint/test (and optionally build/format) for one
# or more SchemaForge packages, with compact PASS/FAIL output.
#
# Usage:
#   .claude/scripts/verify.sh <core|frontend|backend|all>... [--build] [--format] [--fail-fast]
#
# Examples:
#   .claude/scripts/verify.sh core
#   .claude/scripts/verify.sh core frontend --build --format
#   .claude/scripts/verify.sh all --fail-fast
#
# Behavior:
#   - Runs typecheck, lint, test for each selected package (build too with --build).
#   - If frontend or backend is selected and packages/core/dist is missing, or
#     core has working-tree changes, core is built first as its own step.
#   - After each package's test step, prints compact summary lines pulled from
#     the log: the vitest "Tests  N passed" line, the "All files" coverage
#     line, and any "does not meet global threshold" line.
#   - --format runs `pnpm exec prettier --check` on changed files (tracked
#     modified + untracked, not ignored) that belong to the selected packages,
#     excluding __snapshots__/. Skips gracefully if there are none.
#   - Continues through all steps by default; --fail-fast stops at the first
#     failure. Exits non-zero if any step failed.
#
# Never mutates the working tree, the index, HEAD, or any lockfile. Only
# writes to gitignored output (coverage/, dist/, .next/) and to a log
# directory under $TMPDIR.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

usage() {
  cat <<'EOF'
Usage: verify.sh <core|frontend|backend|all>... [--build] [--format] [--fail-fast]

Runs typecheck, lint, and test for each selected package (build too with
--build). Builds packages/core first when needed. --format checks formatting
of changed files in the selected packages. --fail-fast stops at the first
failing step. Prints "RESULT: PASS" or "RESULT: FAIL (<labels>)" at the end.
EOF
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

RAW_PACKAGES=()
DO_BUILD=0
DO_FORMAT=0
FAIL_FAST=0

if [ "$#" -eq 0 ]; then
  usage
  exit 2
fi

for arg in "$@"; do
  case "${arg}" in
    -h|--help)
      usage
      exit 0
      ;;
  esac
done

while [ "$#" -gt 0 ]; do
  case "$1" in
    core|frontend|backend|all)
      RAW_PACKAGES+=("$1")
      shift
      ;;
    --build)
      DO_BUILD=1
      shift
      ;;
    --format)
      DO_FORMAT=1
      shift
      ;;
    --fail-fast)
      FAIL_FAST=1
      shift
      ;;
    *)
      echo "error: unknown argument '$1'" >&2
      usage
      exit 2
      ;;
  esac
done

if [ "${#RAW_PACKAGES[@]}" -eq 0 ]; then
  echo "error: at least one of core, frontend, backend, or all is required" >&2
  usage
  exit 2
fi

SELECT_CORE=0
SELECT_FRONTEND=0
SELECT_BACKEND=0
for p in "${RAW_PACKAGES[@]}"; do
  case "${p}" in
    core) SELECT_CORE=1 ;;
    frontend) SELECT_FRONTEND=1 ;;
    backend) SELECT_BACKEND=1 ;;
    all) SELECT_CORE=1; SELECT_FRONTEND=1; SELECT_BACKEND=1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Step bookkeeping
# ---------------------------------------------------------------------------

FAILED_LABELS=()
ANY_FAILED=0

# step <label> <cmd...>
# Wraps run_step with FAIL_FAST bookkeeping. Never lets a failure abort the
# script early unless --fail-fast was passed.
step() {
  local label="$1"
  shift
  if run_step "${label}" "$@"; then
    return 0
  fi
  ANY_FAILED=1
  FAILED_LABELS+=("${label}")
  if [ "${FAIL_FAST}" -eq 1 ]; then
    print_result
    exit 1
  fi
  return 0
}

print_result() {
  if [ "${ANY_FAILED}" -eq 0 ]; then
    echo "RESULT: PASS"
  else
    local joined=""
    local l
    for l in "${FAILED_LABELS[@]}"; do
      if [ -z "${joined}" ]; then
        joined="${l}"
      else
        joined="${joined}, ${l}"
      fi
    done
    echo "RESULT: FAIL (${joined})"
  fi
}

# ---------------------------------------------------------------------------
# Node
# ---------------------------------------------------------------------------

ensure_node

# ---------------------------------------------------------------------------
# Build core first if a dependent package needs it
# ---------------------------------------------------------------------------

if [ "${SELECT_FRONTEND}" -eq 1 ] || [ "${SELECT_BACKEND}" -eq 1 ]; then
  NEEDS_CORE_BUILD=0
  if [ ! -d "${REPO_ROOT}/packages/core/dist" ]; then
    NEEDS_CORE_BUILD=1
  fi
  if [ -n "$(git status --porcelain -- packages/core 2>/dev/null || true)" ]; then
    NEEDS_CORE_BUILD=1
  fi
  if [ "${NEEDS_CORE_BUILD}" -eq 1 ]; then
    step "core build (dependency)" pnpm --filter @schemaforge/core build
  fi
fi

# ---------------------------------------------------------------------------
# Test log summary extraction
# ---------------------------------------------------------------------------

print_test_summary() {
  local log_file="$1"
  local line
  grep -E '^[[:space:]]*Tests[[:space:]]+[0-9]+ passed' "${log_file}" 2>/dev/null | while IFS= read -r line; do
    echo "  ${line}"
  done || true
  grep -E '^All files' "${log_file}" 2>/dev/null | while IFS= read -r line; do
    echo "  ${line}"
  done || true
  grep -F 'does not meet global threshold' "${log_file}" 2>/dev/null | while IFS= read -r line; do
    echo "  ${line}"
  done || true
}

# ---------------------------------------------------------------------------
# Run checks per package, in a fixed order
# ---------------------------------------------------------------------------

run_package() {
  local pkg="$1"
  resolve_package "${pkg}"

  step "${pkg} typecheck" pnpm --filter "${PKG_FILTER}" typecheck
  step "${pkg} lint" pnpm --filter "${PKG_FILTER}" lint

  local test_log=""
  if run_step "${pkg} test" pnpm --filter "${PKG_FILTER}" test; then
    test_log="${LAST_RUN_LOG}"
  else
    ANY_FAILED=1
    FAILED_LABELS+=("${pkg} test")
    test_log="${LAST_RUN_LOG}"
    if [ "${FAIL_FAST}" -eq 1 ]; then
      print_test_summary "${test_log}"
      print_result
      exit 1
    fi
  fi
  print_test_summary "${test_log}"

  if [ "${DO_BUILD}" -eq 1 ]; then
    step "${pkg} build" pnpm --filter "${PKG_FILTER}" build
  fi
}

if [ "${SELECT_CORE}" -eq 1 ]; then
  run_package core
fi
if [ "${SELECT_FRONTEND}" -eq 1 ]; then
  run_package frontend
fi
if [ "${SELECT_BACKEND}" -eq 1 ]; then
  run_package backend
fi

# ---------------------------------------------------------------------------
# --format
# ---------------------------------------------------------------------------

if [ "${DO_FORMAT}" -eq 1 ]; then
  FORMAT_FILES=()

  PKG_PREFIXES=()
  [ "${SELECT_CORE}" -eq 1 ] && PKG_PREFIXES+=("packages/core/")
  [ "${SELECT_FRONTEND}" -eq 1 ] && PKG_PREFIXES+=("frontend/")
  [ "${SELECT_BACKEND}" -eq 1 ] && PKG_PREFIXES+=("backend/")

  CANDIDATES=()
  while IFS= read -r f; do
    [ -n "$f" ] && CANDIDATES+=("$f")
  done < <(git diff --name-only 2>/dev/null || true)
  while IFS= read -r f; do
    [ -n "$f" ] && CANDIDATES+=("$f")
  done < <(git diff --name-only --cached 2>/dev/null || true)
  while IFS= read -r f; do
    [ -n "$f" ] && CANDIDATES+=("$f")
  done < <(git status --porcelain --untracked-files=all 2>/dev/null | awk '/^\?\? /{print substr($0,4)}' || true)

  if [ "${#CANDIDATES[@]}" -gt 0 ]; then
    while IFS= read -r f; do
      [ -n "$f" ] && FORMAT_FILES+=("$f")
    done < <(printf '%s\n' "${CANDIDATES[@]}" | sort -u)
  fi

  MATCHED=()
  if [ "${#FORMAT_FILES[@]}" -gt 0 ] && [ "${#PKG_PREFIXES[@]}" -gt 0 ]; then
    for f in "${FORMAT_FILES[@]}"; do
      case "$f" in
        *__snapshots__*)
          continue
          ;;
      esac
      [ -f "${REPO_ROOT}/${f}" ] || continue
      for prefix in "${PKG_PREFIXES[@]}"; do
        case "$f" in
          "${prefix}"*)
            MATCHED+=("$f")
            break
            ;;
        esac
      done
    done
  fi

  if [ "${#MATCHED[@]}" -eq 0 ]; then
    echo "format: no changed files in the selected packages to check"
  else
    # Prefix every path with "./" so a filename that looks like a flag (for
    # example "-x.md") is never mistaken for an option, and use "--" so
    # prettier stops parsing options before the path list starts.
    PRETTIER_PATHS=()
    for f in "${MATCHED[@]}"; do
      PRETTIER_PATHS+=("./${f}")
    done
    step "format (prettier --check)" pnpm exec prettier --check -- "${PRETTIER_PATHS[@]}"
  fi
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------

print_result
if [ "${ANY_FAILED}" -eq 1 ]; then
  exit 1
fi
exit 0
