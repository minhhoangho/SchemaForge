---
paths:
  - "packages/core/**/*"
---

# packages/core

Runs in both the browser and Node, and every feature depends on it. Correctness comes first.

## Boundaries

- No React, Next.js, NestJS, or Prisma imports. No browser-only or Node-only globals (`window`, `document`, `localStorage`, `fs`, `path`, `Buffer`, `process`).
- No network, storage, timers, or module-level mutable state.
- Ids, timestamps, and randomness are passed in (for example as an id generator argument), so every function is deterministic.
- Runtime dependencies must be pure and isomorphic; add one only when writing it ourselves is clearly worse.
- The public API is what `src/index.ts` and the subpath entry points declared in `package.json` export. Everything else is internal.

## Model and operations

- The schema model is plain JSON-serializable data: no classes, `Date`, `Map`, `Set`, or functions.
- Data is immutable. Operations return a new schema and never mutate their input.
- Every schema change is an operation: a serializable object with a `type` discriminant, carrying enough information to be undone.
- Applying an operation is a pure function of the schema and the operation. It either succeeds fully or returns an error; it never leaves a partially applied schema.
- Expected failures (invalid operation, validation issue, unparsable import) are returned as typed results, not thrown. Throw only for programmer errors.
- Validation issues carry a stable machine-readable `code` and a path to the offending element. Core returns no user-facing messages; the frontend translates codes through i18n.
- When a model concept is added or changed, update its types, validation, operations, and every generator and importer in the same change. A target that cannot express the concept emits a diagnostic instead of silently dropping it.

## Generators and importers

- One folder per target (`generators/postgresql/`, `importers/dbml/`), each implementing the shared generator or importer interface.
- Generators are pure `(schema, options) => output` with deterministic output: stable ordering, no timestamps.
- Quote and escape identifiers for the target dialect; never concatenate raw user-provided names into output.
- Importers treat input as untrusted: never `eval`, bound input size, and report unsupported or invalid syntax as diagnostics with line and column instead of throwing or skipping it silently.

## Tests

- Every operation, validation rule, generator, and importer has unit tests.
- Generators use snapshot tests per target. Importers have round-trip tests (import, generate, import again yields the same schema) wherever the format allows.
