# Git

## Commits

Commit each part as soon as it is done; do not batch unrelated work into one commit.

Message format (Conventional Commits), a single line with no body:

```
<type>(<scope>): <subject>
```

- **type**: `feat` (new feature), `fix` (bug fix), `refactor` (no behavior change), `perf`, `test`, `docs`, `build` (tooling, dependencies), `ci`, `chore` (other maintenance).
- **scope**: `core`, `frontend`, or `backend`. Omit it when the change is repo-wide or docs-only.
- **subject**: English, imperative mood, lowercase first letter, no trailing period, header at most 72 characters. Say what changed, not how.
- No body, no list of changes, no `Co-Authored-By` or any other trailer.

Examples:

```
feat(core): add enum validation
fix(frontend): keep canvas zoom after undo
build: set up pnpm workspace and turborepo
docs: add schema operations spec
```
