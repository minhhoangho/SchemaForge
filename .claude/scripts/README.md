# `.claude/scripts/`

Vetted, allowlisted Bash scripts for agents to call directly instead of
hand-typing nvm setup, per-package checks, diff review, or secret greps.
Invoke them as `.claude/scripts/<name>.sh ...` (relative path from the repo
or worktree root) so the `Bash(.claude/scripts/*)` permission rule matches.

All scripts (except `_lib.sh`, which is sourced, not run) are
`#!/usr/bin/env bash`, `set -euo pipefail`, and compatible with macOS's
`/bin/bash` 3.2. Every script accepts `-h`/`--help`.

| Script | Purpose | Key flags | Writes what |
|---|---|---|---|
| `_lib.sh` | Shared helpers: repo-root resolution, `ensure_node`, `resolve_package`, `run_step`. Sourced by every other script, not run directly. | n/a | Nothing on its own; `run_step` writes log files under `$TMPDIR`. |
| `verify.sh` | Typecheck, lint, test (and optionally build/format) for one or more packages, with compact PASS/FAIL output and a `RESULT:` line. | `<core\|frontend\|backend\|all>...`, `--build`, `--format`, `--fail-fast` | Package build output (`dist/`, `.next/`) and test coverage (`coverage/`) — all gitignored. Logs under `$TMPDIR`. |
| `test-file.sh` | Runs one test file for one package (coverage disabled), with strict path validation. `<path>` may be repo-root-relative or package-relative (repo-root-relative is tried first). | `<core\|frontend\|backend> <path>`, `--name <pattern>`, `--update-snapshots` | Nothing, unless `--update-snapshots` is passed, which writes snapshot files next to the test. Logs under `$TMPDIR`. |
| `changed-files.sh` | Lists changed files grouped by package (core/frontend/backend/other), one `<status> <path>` per line. | `--base <ref>`, `--package <pkg>`, `--worktree <path>` | Nothing (read-only). |
| `review-diff.sh` | Read-only diff for review: `git diff --stat` then the diff body, skipping generated output and never showing `.env*` contents. | `--range <A..B\|A...B>`, `--worktree <path>`, `--package <pkg>`, `--stat-only`, `--include-generated` | Nothing (read-only). |
| `secret-scan.sh` | Scans changed files for likely secrets (API keys, tokens, private keys, connection strings, generic secret-looking assignments, stray `console.log`/`console.debug`, and any non-`*.example` `.env*` file). Never prints matched content. Prints `SECRET-SCAN: CLEAN` (exit 0), `SECRET-SCAN: <n> finding(s)` (exit 1), or `SECRET-SCAN: ERROR` (exit 2) if a scan rule itself errored. | `--staged`, `--range <A..B>`, `--all-changed`, `--files <path>...` | Nothing (read-only scan). |
| `worktree-setup.sh` | Bootstraps a freshly created worktree: Node 24, `pnpm install --frozen-lockfile`, builds `@schemaforge/core`. | `<worktree-path>` | `node_modules/` and `packages/core/dist/` inside that worktree only. |

## Safety

- **Read-only:** `changed-files.sh`, `review-diff.sh`, and `secret-scan.sh` never write to the working tree, the index, HEAD, or any file. `verify.sh` and `test-file.sh` only write gitignored output (`coverage/`, `dist/`, `.next/`), except `test-file.sh --update-snapshots`, which writes snapshot files.
- No script reads, prints, `source`s, or `cat`s a `.env*` file, and none prints environment variable values. `secret-scan.sh` reports a non-`*.example` `.env*` file only as a path, never its contents.
- No script makes network calls, and none passes unvalidated arguments to `eval` or an unquoted shell expansion.
- No git command used by any script mutates the index, HEAD, refs, or the working tree, except `worktree-setup.sh`, which only runs `pnpm install`/`pnpm build` inside the worktree it was pointed at (itself validated against `git worktree list --porcelain`, and never the main worktree).
- Every script rejects unknown flags and bad arguments with a usage message and exit code `2`, rather than passing them through to an arbitrary command.
- `run_step` (in `_lib.sh`) writes each step's raw, unredacted tool output to a log file under `$TMPDIR`. The whole log directory for a run is deleted automatically when every step in that run passed, and kept only when at least one step failed, so it can be inspected. Because these logs can contain anything the underlying command printed, never paste their contents into a commit, a PR, or a chat outside the task report without checking them first.
