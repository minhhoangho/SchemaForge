#!/usr/bin/env bash
# _lib.sh - shared helpers for .claude/scripts/*.sh
#
# This file is sourced, not executed. It must stay compatible with macOS's
# /bin/bash 3.2: no associative arrays, no mapfile/readarray, no ${var,,},
# no &>>, and every array expansion must be guarded for `set -u`.
#
# A script uses it as:
#   # shellcheck source=_lib.sh
#   source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)/_lib.sh"

# ---------------------------------------------------------------------------
# Repo root resolution
# ---------------------------------------------------------------------------

# Resolves the repo root from THIS file's own location (.claude/scripts/../..)
# so callers work the same way from the main tree and from inside a git
# worktree. Sets and exports REPO_ROOT, and cd's the caller into it.
_lib_script_dir() {
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P
}

LIB_SCRIPT_DIR="$(_lib_script_dir)"
REPO_ROOT="$(cd -- "${LIB_SCRIPT_DIR}/../.." >/dev/null 2>&1 && pwd -P)"

if [ -z "${REPO_ROOT}" ] || [ ! -e "${REPO_ROOT}/.git" ]; then
  echo "error: could not resolve repo root from ${LIB_SCRIPT_DIR}" >&2
  exit 1
fi

cd -- "${REPO_ROOT}"

# ---------------------------------------------------------------------------
# Node / nvm
# ---------------------------------------------------------------------------

# Sources ~/.nvm/nvm.sh, runs `nvm use --silent` (reads .nvmrc at REPO_ROOT),
# then fails clearly unless the resulting `node -v` major version is 24.
ensure_node() {
  local nvm_sh="${HOME}/.nvm/nvm.sh"
  if [ ! -s "${nvm_sh}" ]; then
    echo "error: ${nvm_sh} not found; install nvm or load Node 24 some other way" >&2
    return 1
  fi

  # shellcheck source=/dev/null
  source "${nvm_sh}"

  if ! nvm use --silent >/dev/null 2>&1; then
    echo "error: 'nvm use' failed (check .nvmrc at repo root)" >&2
    return 1
  fi

  if ! command -v node >/dev/null 2>&1; then
    echo "error: node not found on PATH after 'nvm use'" >&2
    return 1
  fi

  local node_version major
  node_version="$(node -v)"
  major="$(printf '%s' "${node_version}" | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "${major}" != "24" ]; then
    echo "error: Node 24 required, got ${node_version} (non-interactive shells default to Node 22 on this machine)" >&2
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Package validation
# ---------------------------------------------------------------------------

# resolve_package <core|frontend|backend>
# Sets PKG_FILTER (pnpm --filter name) and PKG_DIR (relative to REPO_ROOT).
# Returns 2 and prints an error for anything else.
resolve_package() {
  local pkg="${1:-}"
  case "${pkg}" in
    core)
      PKG_FILTER="@schemaforge/core"
      PKG_DIR="packages/core"
      ;;
    frontend)
      PKG_FILTER="@schemaforge/frontend"
      PKG_DIR="frontend"
      ;;
    backend)
      PKG_FILTER="@schemaforge/backend"
      PKG_DIR="backend"
      ;;
    *)
      echo "error: unknown package '${pkg}' (expected core, frontend, or backend)" >&2
      return 2
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Step runner
# ---------------------------------------------------------------------------

# One shared log directory per script invocation, created lazily. Removed on
# a clean exit (see _cleanup_log_dir_on_exit below) if every run_step call in
# the process passed; kept when any step failed, so the failure can be
# inspected. Logs are raw, unredacted tool output (they can contain anything
# the underlying command printed) - never paste them somewhere else without
# checking their contents first.
_agent_log_dir=""
_run_step_failures=0

_ensure_agent_log_dir() {
  if [ -z "${_agent_log_dir}" ]; then
    _agent_log_dir="$(mktemp -d "${TMPDIR:-/tmp}/schemaforge-agent-scripts.XXXXXX")"
    trap _cleanup_log_dir_on_exit EXIT
  fi
}

_cleanup_log_dir_on_exit() {
  if [ -n "${_agent_log_dir}" ] && [ "${_run_step_failures}" -eq 0 ]; then
    rm -rf -- "${_agent_log_dir}" || true
  fi
}

# run_step <label> <cmd> [args...]
# Runs the command with output captured to a log file, prints one compact
# PASS/FAIL line plus the log path, and on failure the last N lines
# (AGENT_LOG_TAIL, default 60). Returns the command's exit status.
# Sets LAST_RUN_LOG to the log file path used for this call.
run_step() {
  if [ "$#" -lt 2 ]; then
    echo "run_step: usage: run_step <label> <cmd> [args...]" >&2
    return 2
  fi

  local label="$1"
  shift

  _ensure_agent_log_dir
  local safe_label
  safe_label="$(printf '%s' "${label}" | tr -c 'A-Za-z0-9_-' '_')"
  LAST_RUN_LOG="${_agent_log_dir}/${safe_label}.log"

  local start_ts end_ts secs status_word rc
  start_ts="$(date +%s)"
  if "$@" >"${LAST_RUN_LOG}" 2>&1; then
    rc=0
    status_word="PASS"
  else
    rc=$?
    status_word="FAIL"
    _run_step_failures=$((_run_step_failures + 1))
  fi
  end_ts="$(date +%s)"
  secs=$((end_ts - start_ts))

  echo "${status_word} ${label} (${secs}s)"
  if [ "${status_word}" = "FAIL" ]; then
    local tail_n="${AGENT_LOG_TAIL:-60}"
    echo "--- last ${tail_n} line(s): ${label} ---"
    tail -n "${tail_n}" "${LAST_RUN_LOG}" || true
  fi
  echo "log: ${LAST_RUN_LOG}"

  return "${rc}"
}

# ---------------------------------------------------------------------------
# Misc helpers
# ---------------------------------------------------------------------------

# is_env_file <path>
# True for any ".env" or ".env.*" file (matched case-insensitively, so
# ".ENV" and ".Env.local" count too), except one ending in ".example"
# (also matched case-insensitively, so ".env.EXAMPLE" is excluded).
is_env_file() {
  local base lower
  base="$(basename -- "$1")"
  lower="$(printf '%s' "${base}" | tr '[:upper:]' '[:lower:]')"
  case "${lower}" in
    .env|.env.*)
      case "${lower}" in
        *.example) return 1 ;;
        *) return 0 ;;
      esac
      ;;
    *) return 1 ;;
  esac
}

# array_has <needle> <haystack items...>
array_has() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [ "${item}" = "${needle}" ]; then
      return 0
    fi
  done
  return 1
}
