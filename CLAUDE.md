# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

SchemaForge is a web-based database schema designer with an AI assistant at its core. Users design schemas on a canvas (tables, columns, relations, indexes, enums), describe or refine a schema in natural language (Vietnamese or English), and generate code from it (SQL DDL, Prisma, Drizzle, TypeScript, Zod, OpenAPI, DBML, and more).

Product overview, architecture, and roadmap live in `document/`, written in Vietnamese.

## Current status

Pre-scaffold. `frontend/`, `backend/`, and `packages/core/` contain only a README describing their planned role. There is no `package.json` and no build, lint, or test command yet. Do not invent commands; update this file when scaffolding lands.

## Repository layout

| Path | Role | Stack |
|---|---|---|
| `frontend/` | Web app: canvas editor, AI chat UI, code generation and import/export panels, local persistence | Next.js, TypeScript |
| `backend/` | API: auth, cloud storage, share links, version history, AI assistant | NestJS, TypeScript, PostgreSQL, Prisma, Google Gemini |
| `packages/core/` | Shared schema model, validation, schema operations, code generators, importers | Framework-free TypeScript |
| `document/` | Product overview, architecture, roadmap, specs, plans | Markdown (Vietnamese) |

Monorepo tooling: pnpm workspaces + Turborepo.

## Architecture principles

1. **`packages/core` is the source of truth.** The schema model, its validation, generators, and importers live there. Core must not import React, Next.js, NestJS, Prisma, or browser-only or Node-only APIs, so it runs in both environments.
2. **Local-first.** Editing, code generation, and import/export work entirely in the browser, without an account or a backend. Signing in adds cloud save, sharing, version history, and AI.
3. **One mutation path.** Every schema change, whether from the canvas, the AI, or an import, is expressed as a core operation. Undo/redo, AI edits, and version history all build on these operations; never mutate schema state ad hoc.
4. **AI edits are structured.** The AI changes a schema only through tool calls that map to core operations, and core validates the result before it is applied. Never feed free-form model output (such as raw SQL) straight into the schema.
5. **AI runs on Google Gemini through the backend and requires login.** Users never provide an API key. The Gemini API key lives only in the backend environment: never commit it, never send it to the client, never log it. The frontend talks to the backend, never to Gemini directly.

## Conventions

- Code, identifiers, and comments: English.
- Everything in `document/`: Vietnamese.
- User-facing text always goes through i18n with `vi` and `en` locales; no hardcoded UI strings.
- TypeScript strict mode in every package.
- Libraries not named above (canvas, state management, UI kit, i18n, auth, AI SDK) are not decided yet. Choose them in the spec of the sub-project that needs them, then record the decision in `document/architecture.md`. Candidates are listed there.

## Workflow

Work is split into the sub-projects in `document/roadmap.md`. Each one goes through:

1. Spec: `document/specs/YYYY-MM-DD-<topic>-design.md`
2. Plan: `document/plans/YYYY-MM-DD-<topic>-plan.md`
3. Implementation

When a technical decision or a sub-project's status changes, update `document/architecture.md` or `document/roadmap.md` in the same change.

## Commits

- Commit each part as soon as it is done; do not batch unrelated work into one commit.
- Message: one short English line (e.g. `Add schema validation for enums`). No body, no detailed list of changes.
- No `Co-Authored-By` or any other attribution trailer.
