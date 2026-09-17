#!/usr/bin/env bash
# worktree-setup.sh - bootstrap a freshly created git worktree of this repo.
#
# Usage:
#   .claude/scripts/worktree-setup.sh <worktree-path>
#
# <worktree-path> must already exist and be listed in
# `git worktree list --porcelain` for this repo, and must not be the main
# worktree. Runs, inside it: ensure_node, `pnpm install --frozen-lockfile`,
# and `pnpm --filter @schemaforge/core build`, each through run_step.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

usage() {
  cat <<'EOF'
Usage: worktree-setup.sh <worktree-path>

Bootstraps a git worktree of this repo: ensures Node 24, runs
`pnpm install --frozen-lockfile`, and builds @schemaforge/core. The path
must be a real, non-main worktree already listed by
`git worktree list --porcelain`.
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

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

WORKTREE_PATH="$1"

if [ ! -d "${WORKTREE_PATH}" ]; then
  echo "error: '${WORKTREE_PATH}' does not exist or is not a directory" >&2
  exit 2
fi

WT_ABS="$(cd -- "${WORKTREE_PATH}" >/dev/null 2>&1 && pwd -P)"
MAIN_ABS="${REPO_ROOT}"

if [ "${WT_ABS}" = "${MAIN_ABS}" ]; then
  echo "error: '${WORKTREE_PATH}' is the main worktree; refusing to run here" >&2
  exit 2
fi

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

# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------

cd -- "${WT_ABS}"

ensure_node

FAILED=0

if ! run_step "pnpm install --frozen-lockfile" pnpm install --frozen-lockfile; then
  FAILED=1
fi

if ! run_step "core build" pnpm --filter @schemaforge/core build; then
  FAILED=1
fi

if [ "${FAILED}" -eq 0 ]; then
  echo "RESULT: PASS"
  exit 0
else
  echo "RESULT: FAIL"
  exit 1
fi
