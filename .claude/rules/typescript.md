---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript

## Compiler

- `strict: true` in every package, plus `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noFallthroughCasesInSwitch`.
- Never loosen compiler options for a file or folder to make code compile.

## Types

- No `any`. Use `unknown` and narrow it. If a third-party API forces `any`, contain it in one wrapper with a comment explaining why.
- No `as` casts or non-null `!` to silence the compiler; narrow with type guards instead. `as const` and `satisfies` are fine.
- No `@ts-ignore`. `@ts-expect-error` only with a comment giving the reason.
- Exported functions and public methods declare their return type.
- `type` by default; `interface` only when a class implements it or declaration merging is needed.
- Model variants as discriminated unions and handle them with an exhaustive `switch` ending in a `never` check.
- Use string literal unions or `as const` objects instead of the `enum` keyword (generated Prisma enums are fine).
- Mark data that must not change as `readonly`; never mutate function arguments.
- One source of truth per type: derive with `typeof`, `keyof`, `Pick`, `Omit`, `ReturnType` instead of redeclaring. Schema model types come from `@schemaforge/core`; never redefine them in `frontend/` or `backend/`.

## Modules

- Named exports only. Default exports only where a framework requires them (Next.js `page.tsx`, `layout.tsx`, config files).
- Use `import type` for type-only imports.
- No circular imports.
- `index.ts` barrels only at package entry points (such as `packages/core/src/index.ts`), not inside feature folders.
- Import another workspace package by its name (`@schemaforge/core`), never by a relative path into its `src/`.

## Naming

- Files and folders: `kebab-case` (`table-node.tsx`, `create-schema.dto.ts`).
- `camelCase` for variables and functions, `PascalCase` for types, classes, and React components, `UPPER_SNAKE_CASE` for module-level constants.
- Booleans start with `is`, `has`, `can`, or `should`.
- No `I` prefix on interfaces or `T` prefix on types; single-letter names only for generic parameters.
- Spell words out. Allowed abbreviations: `id`, `url`, `api`, `db`, `sql`, `dto`, `ai`.

## Async and errors

- No floating promises: `await` or `return` every promise, or prefix it with `void` and a comment when fire-and-forget is intended.
- Run independent async work with `Promise.all`, not sequential `await`s.
- Type caught errors as `unknown` and narrow before use.
- Throw `Error` instances or subclasses, never strings or plain objects; pass `{ cause }` when wrapping.
