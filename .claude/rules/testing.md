---
paths:
  - "**/*.{test,spec}.{ts,tsx}"
  - "**/test/**/*"
  - "**/e2e/**/*"
---

# Testing

The test runner is chosen in the "Scaffold & tooling" spec. These rules apply whichever runner is used.

## Writing tests

- Test behavior through the public API, not implementation details such as private functions, internal state, or CSS classes.
- One behavior per test, named as a sentence: `returns an error when a relation references a missing column`.
- Arrange, act, assert. No loops or conditionals inside a test.
- Tests are independent and deterministic: no shared mutable state, no dependence on order, wall-clock time, randomness, or network. Inject clocks and id generators.
- Build test data with small factories that have sensible defaults; override only the fields the test is about.
- Mock only at boundaries: HTTP, Gemini, browser storage, and the database in unit tests. Never call the real Gemini API from any test.
- Frontend component tests query what users perceive (role, label, text), not component internals.

## Process

- A bug fix starts with a failing test that reproduces the bug.
- Never weaken, skip, or delete a failing test to get green. Fix the code, or explain why the test itself is wrong.

## Placement

- `packages/core` and `frontend/`: colocated `<name>.test.ts` or `<name>.test.tsx`.
- `backend/`: colocated `<name>.spec.ts` for unit tests (Nest CLI convention); e2e tests in `backend/test/`.
- Browser end-to-end tests: `frontend/e2e/`.

## Coverage

- `packages/core`: at least 90% line coverage.
- `backend/` and `frontend/`: at least 80% for logic (services, guards, hooks, stores, utilities).
- Coverage is a floor, not a goal: every assertion must check meaningful behavior.
