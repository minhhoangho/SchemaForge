# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

SchemaForge is a web-based database schema designer with an AI assistant at its core. Users design schemas on a canvas (tables, columns, relations, indexes, enums), describe or refine a schema in natural language (Vietnamese or English), and generate code from it (SQL DDL, Prisma, Drizzle, TypeScript, Zod, OpenAPI, DBML, and more).

Product overview, architecture, and roadmap live in `document/`, written in Vietnamese.

## Current status

Scaffold and tooling (roadmap part 1) are in place. `packages/core` (roadmap part 2) has the schema model, validation, operations, undo/redo history, and the `@schemaforge/core/testing` entry point. `frontend/` still shows a placeholder page while the editor infrastructure is in progress, and `backend/` validates its env but has no routes yet.

## Commands

Requires Node.js 24 (`.nvmrc`) and pnpm 12.4.1 (from `packageManager`, via corepack). Non-interactive shells on this machine default to Node 22, so run `source ~/.nvm/nvm.sh && nvm use` in the repo root first.

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies for the whole workspace |
| `pnpm dev` | Core in watch mode, frontend on port 3000, backend on port 3001 |
| `pnpm build` | Build every package in dependency order |
| `pnpm lint` | ESLint in every package |
| `pnpm typecheck` | TypeScript in every package |
| `pnpm test` | Vitest with coverage thresholds |
| `pnpm format` | Format the repo with Prettier |
| `pnpm format:check` | Check formatting (used in CI) |

Run a script in one package: `pnpm --filter @schemaforge/core test`. Start the built backend: `pnpm --filter @schemaforge/backend start`.

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
- Detailed rules live in `.claude/rules/`, one file per topic. Path-scoped rules load only after a matching file is read, so read the relevant rule file before creating the first files in an area.
- Library choices and their reasons are recorded in `document/architecture.md`. Use those libraries; propose a new or replacement library only in a spec, and record the decision in `document/architecture.md` in the same change.

## Workflow

Work is split into the sub-projects in `document/roadmap.md`. Each one goes through:

1. Spec: `document/specs/YYYY-MM-DD-<topic>-design.md`
2. Plan: `document/plans/YYYY-MM-DD-<topic>-plan.md`
3. Implementation

When a technical decision or a sub-project's status changes, update `document/architecture.md` or `document/roadmap.md` in the same change.
