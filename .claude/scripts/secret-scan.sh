#!/usr/bin/env bash
# secret-scan.sh - scan changed files for likely secrets, without ever
# printing the matched content.
#
# Usage:
#   .claude/scripts/secret-scan.sh [--staged | --range <A..B> | --all-changed] [--files <path>...]
#
# Default scope: changed files (tracked modified + staged + untracked and
# not ignored). Scans text files only; skips binaries, pnpm-lock.yaml, and
# node_modules/.
#
# Rules: Google API key, AWS access key, a private-key header, a GitHub
# token, a quoted secret-looking assignment, a connection string with inline
# credentials, console.log/debug in non-test source under
# packages/core/src, frontend/src, backend/src, and any changed or untracked
# .env* file that is not *.example (reported as a path only, never opened).
#
# Output is exactly "<rule> <file>:<line>" per finding - never the matched
# text or the line itself. Exit 1 if there are findings, 0 if clean.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

usage() {
  cat <<'EOF'
Usage: secret-scan.sh [--staged | --range <A..B> | --all-changed] [--files <path>...]

Scans changed files (or --files, or --staged, or --range A..B) for likely
secrets. Never prints matched content, only "<rule> <file>:<line>". Exits 1
if findings are reported, 0 if clean, 2 if a scan rule itself errored (never
treated as clean). Final line is "SECRET-SCAN: CLEAN", "SECRET-SCAN: <n>
finding(s)", or "SECRET-SCAN: ERROR".
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

MODE="default"
RANGE=""
EXPLICIT_FILES=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --staged)
      MODE="staged"
      shift
      ;;
    --all-changed)
      MODE="default"
      shift
      ;;
    --range)
      [ "$#" -ge 2 ] || { echo "error: --range requires a value" >&2; usage; exit 2; }
      MODE="range"
      RANGE="$2"
      shift 2
      ;;
    --files)
      shift
      while [ "$#" -gt 0 ]; do
        case "$1" in
          --*) break ;;
          *) EXPLICIT_FILES+=("$1"); shift ;;
        esac
      done
      ;;
    *)
      echo "error: unknown argument '$1'" >&2
      usage
      exit 2
      ;;
  esac
done

if [ "${MODE}" = "range" ]; then
  if ! git rev-parse --verify --quiet --end-of-options "${RANGE}" >/dev/null 2>&1; then
    # RANGE might be "A..B"; validate it as a diff range directly, and each
    # side individually for a clear error.
    case "${RANGE}" in
      *..*)
        left="${RANGE%%..*}"
        right="${RANGE##*..}"
        if [ -z "${left}" ] || [ -z "${right}" ]; then
          echo "error: --range must look like A..B" >&2
          exit 2
        fi
        if ! git rev-parse --verify --quiet --end-of-options "${left}" >/dev/null; then
          echo "error: '${left}' is not a valid ref" >&2
          exit 2
        fi
        if ! git rev-parse --verify --quiet --end-of-options "${right}" >/dev/null; then
          echo "error: '${right}' is not a valid ref" >&2
          exit 2
        fi
        ;;
      *)
        echo "error: --range must look like A..B" >&2
        exit 2
        ;;
    esac
  fi
fi

# ---------------------------------------------------------------------------
# Build the file list
# ---------------------------------------------------------------------------

FILES=()

if [ "${#EXPLICIT_FILES[@]}" -gt 0 ]; then
  FILES=("${EXPLICIT_FILES[@]}")
else
  case "${MODE}" in
    staged)
      while IFS= read -r f; do
        [ -n "${f}" ] && FILES+=("${f}")
      done < <(git diff --name-only --cached 2>/dev/null || true)
      ;;
    range)
      while IFS= read -r f; do
        [ -n "${f}" ] && FILES+=("${f}")
      done < <(git diff --name-only --end-of-options "${RANGE}" 2>/dev/null || true)
      ;;
    default)
      while IFS= read -r f; do
        [ -n "${f}" ] && FILES+=("${f}")
      done < <(git diff --name-only 2>/dev/null || true)
      while IFS= read -r f; do
        [ -n "${f}" ] && FILES+=("${f}")
      done < <(git diff --name-only --cached 2>/dev/null || true)
      while IFS= read -r f; do
        [ -n "${f}" ] && FILES+=("${f}")
      done < <(git status --porcelain --untracked-files=all 2>/dev/null | awk '/^\?\? /{print substr($0,4)}' || true)
      ;;
  esac
fi

DEDUPED=()
if [ "${#FILES[@]}" -gt 0 ]; then
  while IFS= read -r f; do
    [ -n "${f}" ] && DEDUPED+=("${f}")
  done < <(printf '%s\n' "${FILES[@]}" | sort -u)
fi
FILES=()
if [ "${#DEDUPED[@]}" -gt 0 ]; then
  FILES=("${DEDUPED[@]}")
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FINDINGS=0
SCAN_ERROR=0

# is_env_file is shared from _lib.sh (case-insensitive .env* detection).

is_excluded_path() {
  case "$1" in
    pnpm-lock.yaml) return 0 ;;
    node_modules/*|*/node_modules/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Known-safe test fixture: `export const TEST_PASSWORD = "..."` under
# backend/test/**, mandated by document/plans/2026-09-17-auth-cloud-plan.md
# Task 15 as a placeholder e2e password, never a real secret. Scoped to this
# exact declaration line, not the whole directory, so a real secret dropped
# anywhere else under backend/test/** still triggers.
is_allowlisted_test_password_line() {
  local file="$1" lineno="$2"
  case "${file}" in
    */backend/test/*|backend/test/*) ;;
    *) return 1 ;;
  esac
  local line
  line="$(sed -n "${lineno}p" -- "${file}" 2>/dev/null || true)"
  printf '%s' "${line}" | grep -Eq '^export const TEST_PASSWORD[[:space:]]*='
}

report_matches() {
  # report_matches <file> <rule> <pattern> [case-insensitive: 0|1]
  local file="$1" rule="$2" pattern="$3" ci="${4:-0}"
  local grep_opts=(-nEo)
  if [ "${ci}" = "1" ]; then
    grep_opts+=(-i)
  fi

  # Run grep on its own first so its real exit status is visible: 0 (match),
  # 1 (no match - the common case), or >=1 for a real error (bad file,
  # permission denied, and similarly for macOS grep). Piping straight into
  # `cut | sort || true`, as before, hid a >=2 error behind the same "no
  # findings" path as a clean scan.
  local output rc
  if output="$(grep "${grep_opts[@]}" -e "${pattern}" -- "${file}" 2>/dev/null)"; then
    rc=0
  else
    rc=$?
  fi

  if [ "${rc}" -ge 2 ]; then
    echo "ERROR ${rule} ${file}"
    SCAN_ERROR=1
    return 0
  fi
  if [ "${rc}" -eq 1 ]; then
    return 0
  fi

  local lineno
  while IFS= read -r lineno; do
    [ -n "${lineno}" ] || continue
    if [ "${rule}" = "generic-secret-assignment" ] && is_allowlisted_test_password_line "${file}" "${lineno}"; then
      continue
    fi
    echo "${rule} ${file}:${lineno}"
    FINDINGS=$((FINDINGS + 1))
  done < <(printf '%s\n' "${output}" | cut -d: -f1 | sort -un || true)
}

scan_file() {
  local file="$1"

  if is_env_file "${file}"; then
    echo "env-file ${file}"
    FINDINGS=$((FINDINGS + 1))
    return 0
  fi

  local enc
  enc="$(file -b --mime-encoding -- "${file}" 2>/dev/null || echo "unknown")"
  if [ "${enc}" = "binary" ]; then
    return 0
  fi

  report_matches "${file}" "google-api-key" 'AIza[0-9A-Za-z_-]{35}' 0
  report_matches "${file}" "aws-access-key" 'AKIA[0-9A-Z]{16}' 0
  report_matches "${file}" "private-key" '-----BEGIN [A-Z ]*PRIVATE KEY-----' 0
  report_matches "${file}" "github-token" 'gh[pousr]_[A-Za-z0-9]{36,}' 0
  report_matches "${file}" "generic-secret-assignment" \
    '[A-Za-z0-9_]*(api_key|apikey|secret|token|password|passwd)[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*"[^"]{12,}"' 1
  report_matches "${file}" "generic-secret-assignment" \
    "[A-Za-z0-9_]*(api_key|apikey|secret|token|password|passwd)[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*'[^']{12,}'" 1
  report_matches "${file}" "connection-string-credentials" '[a-z]+://[^/:@[:space:]]+:[^@[:space:]]+@' 0

  case "${file}" in
    packages/core/src/*|frontend/src/*|backend/src/*)
      case "${file}" in
        *.test.ts|*.test.tsx|*.spec.ts)
          ;;
        *)
          report_matches "${file}" "console-log" 'console\.(log|debug)' 0
          ;;
      esac
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

if [ "${#FILES[@]}" -gt 0 ]; then
  for f in "${FILES[@]}"; do
    [ -f "${REPO_ROOT}/${f}" ] || [ -f "${f}" ] || continue
    is_excluded_path "${f}" && continue

    target="${f}"
    if [ ! -f "${target}" ] && [ -f "${REPO_ROOT}/${f}" ]; then
      target="${REPO_ROOT}/${f}"
    fi
    scan_file "${target}"
  done
fi

if [ "${SCAN_ERROR}" -eq 1 ]; then
  echo "SECRET-SCAN: ERROR"
  exit 2
fi

if [ "${FINDINGS}" -eq 0 ]; then
  echo "SECRET-SCAN: CLEAN"
  exit 0
else
  echo "SECRET-SCAN: ${FINDINGS} finding(s)"
  exit 1
fi
