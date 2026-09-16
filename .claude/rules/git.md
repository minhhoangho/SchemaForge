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

## Before committing

- Run typecheck, lint, and tests for the packages you changed (once scaffolding adds these commands). Do not commit failing code.
- Never commit secrets, `.env` files, or build output.

## Pushing

- After a commit succeeds, push it right away with `git push`; no need to ask first. This applies to every branch, including `master`.
- If the branch has no upstream yet, use `git push -u origin <branch>`.
- Only push commits that passed the checks in the section above.
- If a push is rejected because the remote is ahead, stop and tell the user; never resolve it with `--force` or `--force-with-lease` on your own.
- Force-pushing and deleting a remote branch always need the user's confirmation first.
