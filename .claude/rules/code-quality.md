---
paths:
  - "**/*.{ts,tsx,js,mjs,cjs}"
---

# Code quality

## Design

- Read the surrounding code first and follow its patterns before introducing new ones.
- Build what the task needs. No speculative abstractions, options, or extension points. Extract a shared helper when the third copy appears, not the first.
- One responsibility per function and per module.
- Keep functions short (aim for under 40 lines) and files focused (split a file past about 300 lines).
- Nest at most 3 levels deep; use guard clauses and early returns.
- Keep logic pure. Push side effects (I/O, time, randomness, logging) to the edges and pass dependencies in, so logic is testable without mocks.

## Readability

- Names say what a thing is or does. No `data`, `info`, `temp`, `helper`, `manager`, or catch-all `utils.ts`.
- No magic numbers or strings; give them named constants.
- Comments explain why, not what. No commented-out code. No `TODO` without a reference to a plan or issue.
- Delete dead code, unused exports, and unused dependencies rather than leaving them behind.

## Errors

- Validate at system boundaries (HTTP input, imports, AI output, storage reads) and fail fast; trust data once it has been validated.
- Never swallow an error. Handle it, rethrow it with context, or let it propagate.
- Error messages are for developers and logs. Anything shown to users goes through i18n.

## Hygiene

- No `console.*` in committed code; use the app's logger.
- No secrets or real user data in code, tests, fixtures, or logs.
- Formatting and lint are enforced by tooling. Don't disable a lint rule inline without a comment giving the reason.
- Every change ships with tests for the behavior it adds or fixes (see `testing.md`).
