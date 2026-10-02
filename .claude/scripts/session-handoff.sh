#!/usr/bin/env bash
# session-handoff.sh - SessionStart hook: after /clear or compaction, point the
# fresh context at the newest handoff log. Read-only, no network, always exit 0.
#
# Usage: session-handoff.sh [-h|--help]
# Env:   SESSION_HANDOFF_DIR  override the logs dir (for testing).
# Stdin (hook JSON) is intentionally ignored, so an empty or TTY stdin never blocks.
set -euo pipefail

case "${1:-}" in
  -h|--help)
    sed -n '2,7p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

# Never fail the session: any error below exits 0 silently.
trap 'exit 0' ERR

# shellcheck source=_lib.sh
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)/_lib.sh"

dir="${SESSION_HANDOFF_DIR:-document/executions/logs}"

# `ls -t` = newest mtime first; take a file only if its date prefix is strictly
# greater, so the highest date wins and ties go to the newest mtime.
best=""
best_date=""
for f in $(ls -t "${dir}"/*-handoff.md 2>/dev/null || true); do
  d="$(basename -- "${f}" | cut -c1-10)"
  if [ -z "${best}" ] || [[ "${d}" > "${best_date}" ]]; then
    best="${f}"
    best_date="${d}"
  fi
done

[ -n "${best}" ] || exit 0

echo "Latest handoff log: ${best} (date: ${best_date})"
echo "Context was cleared or compacted. If you are continuing earlier work, read this handoff log first, then \`git status\`, before acting. Ignore if the user starts unrelated work."
echo "Headings:"
grep -E '^#{1,2} ' "${best}" | head -n 12 || true
exit 0
