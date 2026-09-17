#!/usr/bin/env bash
# review-diff.sh - read-only diff for review: stat first, then the diff body.
#
# Usage:
#   .claude/scripts/review-diff.sh [--range <A..B|A...B>] [--worktree <path>] [--package <core|frontend|backend|other>] [--stat-only] [--include-generated]
#
# Default (no --range): working tree vs HEAD, including untracked files.
# --range compares two validated refs instead.
#
# Always prints `git diff --stat` first, then the diff (--no-color, -U3),
# unless --stat-only. Excludes pnpm-lock.yaml, **/__snapshots__/**, dist/,
# .next/, coverage/ from the diff body (still listed in the stat) unless
# --include-generated. Never shows the contents of a .env* file other than
# *.example; such files are reported as "SKIPPED (env file)".
#
# Read-only: only git diff/status/log/rev-parse are used. Never mutates the
# working tree, the index, HEAD, or any ref.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

usage() {
  cat <<'EOF'
Usage: review-diff.sh [--range <A..B|A...B>] [--worktree <path>] [--package <pkg>] [--stat-only] [--include-generated]

Prints `git diff --stat` then the diff body (--no-color -U3). Defaults to
working tree vs HEAD including untracked files. --range compares two
validated refs. --package restricts to core/frontend/backend/other.
--stat-only skips the diff body. --include-generated stops excluding
pnpm-lock.yaml, __snapshots__/, dist/, .next/, coverage/ from the body.
.env* files (other than *.example) are never shown, only listed as
"SKIPPED (env file)".
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

RANGE=""
HAS_RANGE=0
WORKTREE_PATH=""
PACKAGE_FILTER=""
STAT_ONLY=0
INCLUDE_GENERATED=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --range)
      [ "$#" -ge 2 ] || { echo "error: --range requires a value" >&2; usage; exit 2; }
      RANGE="$2"
      HAS_RANGE=1
      shift 2
      ;;
    --worktree)
      [ "$#" -ge 2 ] || { echo "error: --worktree requires a path" >&2; usage; exit 2; }
      WORKTREE_PATH="$2"
      shift 2
      ;;
    --package)
      [ "$#" -ge 2 ] || { echo "error: --package requires a value" >&2; usage; exit 2; }
      case "$2" in
        core|frontend|backend|other) PACKAGE_FILTER="$2" ;;
        *) echo "error: --package must be core, frontend, backend, or other" >&2; exit 2 ;;
      esac
      shift 2
      ;;
    --stat-only)
      STAT_ONLY=1
      shift
      ;;
    --include-generated)
      INCLUDE_GENERATED=1
      shift
      ;;
    *)
      echo "error: unknown argument '$1'" >&2
      usage
      exit 2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Resolve git target: main tree or a validated worktree
# ---------------------------------------------------------------------------

GIT_TARGET_ROOT="${REPO_ROOT}"

if [ -n "${WORKTREE_PATH}" ]; then
  WT_ABS="$(cd -- "${WORKTREE_PATH}" >/dev/null 2>&1 && pwd -P)" || {
    echo "error: worktree path '${WORKTREE_PATH}' does not exist" >&2
    exit 2
  }
  FOUND=0
  while IFS= read -r line; do
    case "${line}" in
      "worktree "*)
        wt_line_path="${line#worktree }"
        [ "${wt_line_path}" = "${WT_ABS}" ] && FOUND=1
        ;;
    esac
  done < <(git -C "${REPO_ROOT}" worktree list --porcelain)
  if [ "${FOUND}" -ne 1 ]; then
    echo "error: '${WORKTREE_PATH}' is not a worktree of this repo" >&2
    exit 2
  fi
  GIT_TARGET_ROOT="${WT_ABS}"
fi

git_() {
  git -C "${GIT_TARGET_ROOT}" "$@"
}

# ---------------------------------------------------------------------------
# Validate --range parts
# ---------------------------------------------------------------------------

RANGE_LEFT=""
RANGE_RIGHT=""

if [ "${HAS_RANGE}" -eq 1 ]; then
  case "${RANGE}" in
    *"..."*)
      RANGE_LEFT="${RANGE%%...*}"
      RANGE_RIGHT="${RANGE##*...}"
      ;;
    *".."*)
      RANGE_LEFT="${RANGE%%..*}"
      RANGE_RIGHT="${RANGE##*..}"
      ;;
    *)
      echo "error: --range must look like A..B or A...B" >&2
      exit 2
      ;;
  esac
  if [ -z "${RANGE_LEFT}" ] || [ -z "${RANGE_RIGHT}" ]; then
    echo "error: --range must name both sides (A..B or A...B)" >&2
    exit 2
  fi
  if ! git_ rev-parse --verify --quiet --end-of-options "${RANGE_LEFT}" >/dev/null; then
    echo "error: '${RANGE_LEFT}' is not a valid ref" >&2
    exit 2
  fi
  if ! git_ rev-parse --verify --quiet --end-of-options "${RANGE_RIGHT}" >/dev/null; then
    echo "error: '${RANGE_RIGHT}' is not a valid ref" >&2
    exit 2
  fi
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

package_of() {
  case "$1" in
    packages/core/*) echo "core" ;;
    frontend/*) echo "frontend" ;;
    backend/*) echo "backend" ;;
    *) echo "other" ;;
  esac
}

# is_env_file is shared from _lib.sh (case-insensitive .env* detection).

is_generated_path() {
  case "$1" in
    pnpm-lock.yaml) return 0 ;;
    *__snapshots__*) return 0 ;;
    dist/*|*/dist/*) return 0 ;;
    .next/*|*/.next/*) return 0 ;;
    coverage/*|*/coverage/*) return 0 ;;
    *) return 1 ;;
  esac
}

package_allowed() {
  [ -z "${PACKAGE_FILTER}" ] && return 0
  [ "$(package_of "$1")" = "${PACKAGE_FILTER}" ]
}

# ---------------------------------------------------------------------------
# Stat section
# ---------------------------------------------------------------------------

echo "## stat"
if [ "${HAS_RANGE}" -eq 1 ]; then
  git_ diff --stat --no-color --end-of-options "${RANGE}" || true
else
  git_ diff --stat --no-color HEAD || true
  # Untracked files never show up in `git diff --stat`; list them here.
  while IFS= read -r line; do
    case "${line}" in
      "?? "*)
        path="${line#?? }"
        if package_allowed "${path}"; then
          if is_env_file "${path}"; then
            echo " ${path} (untracked, SKIPPED (env file))"
          else
            echo " ${path} (untracked)"
          fi
        fi
        ;;
    esac
  done < <(git_ status --porcelain --untracked-files=all || true)
fi

if [ "${STAT_ONLY}" -eq 1 ]; then
  exit 0
fi

# ---------------------------------------------------------------------------
# Diff body, one file at a time
# ---------------------------------------------------------------------------

echo
echo "## diff"

TRACKED_ENTRIES=()
if [ "${HAS_RANGE}" -eq 1 ]; then
  while IFS= read -r entry; do
    [ -n "${entry}" ] && TRACKED_ENTRIES+=("${entry}")
  done < <(git_ diff --name-status --end-of-options "${RANGE}" 2>/dev/null || true)
else
  while IFS= read -r entry; do
    [ -n "${entry}" ] && TRACKED_ENTRIES+=("${entry}")
  done < <(git_ diff --name-status HEAD 2>/dev/null || true)
fi

if [ "${#TRACKED_ENTRIES[@]}" -gt 0 ]; then
  for entry in "${TRACKED_ENTRIES[@]}"; do
    path="$(printf '%s' "${entry}" | awk '{print $NF}')"
    package_allowed "${path}" || continue

    if is_env_file "${path}"; then
      echo "SKIPPED (env file) ${path}"
      continue
    fi
    if is_generated_path "${path}" && [ "${INCLUDE_GENERATED}" -eq 0 ]; then
      continue
    fi

    echo "--- ${path} ---"
    if [ "${HAS_RANGE}" -eq 1 ]; then
      git_ diff --no-color -U3 --end-of-options "${RANGE}" -- "${path}" || true
    else
      git_ diff --no-color -U3 HEAD -- "${path}" || true
    fi
    echo
  done
fi

if [ "${HAS_RANGE}" -eq 0 ]; then
  while IFS= read -r line; do
    case "${line}" in
      "?? "*)
        path="${line#?? }"
        package_allowed "${path}" || continue

        if is_env_file "${path}"; then
          echo "SKIPPED (env file) ${path}"
          continue
        fi
        if is_generated_path "${path}" && [ "${INCLUDE_GENERATED}" -eq 0 ]; then
          continue
        fi

        echo "--- ${path} (untracked) ---"
        git_ diff --no-color -U3 --no-index -- /dev/null "${path}" || true
        echo
        ;;
    esac
  done < <(git_ status --porcelain --untracked-files=all || true)
fi
