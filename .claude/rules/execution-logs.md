# Execution logs and context budget

## Execution log

- Every agent with write access records what it did in an execution log under `document/executions/logs/` when its task finishes or stops. This is an explicit exception to `document/` being owned by `spec-writer`, limited to your own log file.
- One file per task run: `YYYY-MM-DD-<topic>-task-<N>.md` (`<topic>` = the plan's topic, `<N>` = the plan task number). Work without a plan task: `YYYY-MM-DD-<short-kebab-slug>.md`. Separate files keep parallel agents and worktrees from editing the same log.
- If the dispatcher's prompt names a log file (for example to continue a stopped task), append to that file instead of creating a new one.
- Write the log content in Vietnamese; paths, commands, and identifiers stay as they are.
- Format: a `# <Tên task>` header with links to the plan task and the spec, then one entry per run:

```
## YYYY-MM-DD HH:MM — <agent> — <Xong | Dừng giữa chừng | Bị chặn>
- **Đã làm**
- **File thay đổi**
- **Kiểm tra**: commands and results
- **Quyết định**
- **Việc còn lại**: checkbox list; required unless Xong. Each item must be concrete enough for a fresh agent that has read nothing.
- **Ghi chú cho người tiếp theo**: gotchas, failing tests, where to start
```

- Read-only agents (`project-reviewer`, `ui-a11y-reviewer`) write no files: they put the same sections in their report, and the orchestrator has the log written.
- The orchestrator cannot edit files: it has session-level handoff logs written by dispatching `spec-writer`.

## Plans are to-do lists only

- Never edit a plan to mark progress, tick boxes, or add status, notes, or handoff sections. Status lives in the logs and in `document/roadmap.md`.
- Handoff and state documents go to `document/executions/logs/` (for example `YYYY-MM-DD-<topic>-handoff.md`), never to `document/plans/`.
- Skill steps that write progress into plans (such as checkbox marking in `superpowers:executing-plans`) are overridden by this rule.

## Context budget

Overlong contexts cause hallucination. You cannot see an exact token count, so check these signals at every natural checkpoint (after finishing a sub-step, before starting the next file or module):

- an earlier part of the conversation was compacted or summarized;
- roughly 60+ tool calls in this run, or roughly 25+ files or 4000+ lines read;
- you re-read files because details are fuzzy, are unsure what you already changed, or catch yourself contradicting earlier output.

If any signal fires: finish or revert the current small edit so no file is half-written, run the quick checks that apply, write the log entry with status `Dừng giữa chừng` and a complete **Việc còn lại** list, then stop and report `status: partial` with the log path. Do not push on "just one more step". Stopping early with a good log beats finishing with guesses.

## Report and handoff

- Every report includes the log file path and a status: `done`, `partial` (stopped on the context budget), or `blocked`.
- On `partial`, the orchestrator dispatches a NEW agent (not SendMessage, because the old context is the problem) with the log path, telling it to read the log first and append to the same file.
- The orchestrator applies the same signals to itself: when its context is long, it has `spec-writer` write a session handoff log and tells the user to start a new session.
- Commit logs together with the work they describe; a docs-only log commit uses `docs:`.
