#!/usr/bin/env bash
# changed-files.sh - list changed files, grouped by package, compactly.
#
# Usage:
#   .claude/scripts/changed-files.sh [--base <ref>] [--package core|frontend|backend|other] [--worktree <path>]
#
# Without --base: working tree changes (staged, modified, untracked and not
# ignored, deleted). With --base: `git diff --name-status <ref>...HEAD` plus
# the same working tree changes.
#
# Output is grouped under "== core ==", "== frontend ==", "== backend ==",
# "== other ==" headings, one "<status> <path>" line per file. --package
# restricts output to one group.
#
# Read-only: only git status/diff/rev-parse/worktree-list are used.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

usage() {
  cat <<'EOF'
Usage: changed-files.sh [--base <ref>] [--package core|frontend|backend|other] [--worktree <path>]

Lists changed files grouped by package (core, frontend, backend, other).
Without --base, shows working tree changes. With --base, also shows
`git diff --name-status <ref>...HEAD`. --worktree runs against another
worktree of this repo (must appear in `git worktree list --porcelain`).
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

BASE_REF=""
HAS_BASE=0
PACKAGE_FILTER=""
WORKTREE_PATH=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      [ "$#" -ge 2 ] || { echo "error: --base requires a ref" >&2; usage; exit 2; }
      BASE_REF="$2"
      HAS_BASE=1
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
    --worktree)
      [ "$#" -ge 2 ] || { echo "error: --worktree requires a path" >&2; usage; exit 2; }
      WORKTREE_PATH="$2"
      shift 2
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
        if [ "${wt_line_path}" = "${WT_ABS}" ]; then
          FOUND=1
        fi
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

if [ "${HAS_BASE}" -eq 1 ]; then
  if ! git_ rev-parse --verify --quiet --end-of-options "${BASE_REF}" >/dev/null; then
    echo "error: '${BASE_REF}' is not a valid ref" >&2
    exit 2
  fi
fi

# ---------------------------------------------------------------------------
# Collect "<status> <path>" lines
# ---------------------------------------------------------------------------

ENTRIES=()

if [ "${HAS_BASE}" -eq 1 ]; then
  while IFS= read -r entry; do
    [ -n "${entry}" ] && ENTRIES+=("${entry}")
  done < <(git_ diff --name-status --end-of-options "${BASE_REF}...HEAD" 2>/dev/null | awk '{print $1" "$2}' || true)
fi

# Working tree: staged + unstaged (tracked) + untracked (not ignored)
while IFS= read -r line; do
  [ -n "${line}" ] || continue
  status="${line:0:2}"
  path="${line:3}"
  case "${status}" in
    "??")
      ENTRIES+=("?? ${path}")
      ;;
    *)
      # Trim to a single leading status letter for readability (prefer the
      # staged column, fall back to the worktree column).
      code="${status:0:1}"
      [ "${code}" = " " ] && code="${status:1:1}"
      case "${path}" in
        *" -> "*)
          path="${path#*-> }"
          code="R"
          ;;
      esac
      ENTRIES+=("${code} ${path}")
      ;;
  esac
done < <(git_ status --porcelain --untracked-files=all 2>/dev/null || true)

# ---------------------------------------------------------------------------
# Group and print
# ---------------------------------------------------------------------------

group_for_path() {
  case "$1" in
    packages/core/*) echo "core" ;;
    frontend/*) echo "frontend" ;;
    backend/*) echo "backend" ;;
    *) echo "other" ;;
  esac
}

print_group() {
  local group="$1"
  local printed_header=0
  local e status path g
  if [ "${#ENTRIES[@]}" -eq 0 ]; then
    return 0
  fi
  for e in "${ENTRIES[@]}"; do
    status="${e%% *}"
    path="${e#* }"
    g="$(group_for_path "${path}")"
    if [ "${g}" = "${group}" ]; then
      if [ "${printed_header}" -eq 0 ]; then
        echo "== ${group} =="
        printed_header=1
      fi
      echo "${status} ${path}"
    fi
  done
}

if [ -n "${PACKAGE_FILTER}" ]; then
  print_group "${PACKAGE_FILTER}"
else
  print_group "core"
  print_group "frontend"
  print_group "backend"
  print_group "other"
fi

if [ "${#ENTRIES[@]}" -eq 0 ]; then
  echo "(no changed files)"
fi
