#!/usr/bin/env bash
# worktree-setup.sh - bootstrap a freshly created git worktree of this repo.
#
# Usage:
#   .claude/scripts/worktree-setup.sh <worktree-path>
#
# <worktree-path> must already exist and be listed in
# `git worktree list --porcelain` for this repo, and must not be the main
# worktree. Runs, inside it: ensure_node, `pnpm install --frozen-lockfile`,
# and `pnpm turbo run build` scoped to the workspace packages that
# frontend/backend depend on (currently @schemaforge/core and
# @schemaforge/api-contract), each through run_step.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
# shellcheck source=_lib.sh
source "${SCRIPT_DIR}/_lib.sh"

usage() {
  cat <<'EOF'
Usage: worktree-setup.sh <worktree-path>

Bootstraps a git worktree of this repo: ensures Node 24, runs
`pnpm install --frozen-lockfile`, and builds the internal workspace
packages that @schemaforge/frontend and @schemaforge/backend depend on
(via `pnpm turbo run build --filter '@schemaforge/frontend^...' --filter
'@schemaforge/backend^...'`). The path must be a real, non-main worktree
already listed by `git worktree list --porcelain`.
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

# Distinguish the main worktree from a linked one using WORKTREE_PATH's own
# git metadata, not this script's location: a copy of this file can live
# inside the very worktree being bootstrapped (every agent worktree carries
# its own .claude/scripts/), so deriving "main" from ${BASH_SOURCE[0]} would
# wrongly call that worktree "main". For the main worktree, `--git-dir` and
# `--git-common-dir` are the same path (both ".git"); for a linked worktree,
# `--git-dir` points under the main repo's `.git/worktrees/<name>` while
# `--git-common-dir` points at the shared main `.git` - so they differ.
if ! WT_GIT_DIR="$(git -C "${WT_ABS}" rev-parse --path-format=absolute --git-dir 2>/dev/null)"; then
  echo "error: '${WORKTREE_PATH}' is not inside a git working tree" >&2
  exit 2
fi
WT_COMMON_DIR="$(git -C "${WT_ABS}" rev-parse --path-format=absolute --git-common-dir)"

if [ "${WT_GIT_DIR}" = "${WT_COMMON_DIR}" ]; then
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
done < <(git -C "${WT_ABS}" worktree list --porcelain)

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

if ! run_step "build workspace dependencies" pnpm turbo run build \
  --filter '@schemaforge/frontend^...' --filter '@schemaforge/backend^...'; then
  FAILED=1
fi

if [ "${FAILED}" -eq 0 ]; then
  echo "RESULT: PASS"
  exit 0
else
  echo "RESULT: FAIL"
  exit 1
fi
