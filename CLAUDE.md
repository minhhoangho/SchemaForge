# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

SchemaForge is a web-based database schema designer with an AI assistant at its core. Users design schemas on a canvas (tables, columns, relations, indexes, enums), describe or refine a schema in natural language (Vietnamese or English), and generate code from it (SQL DDL, Prisma, Drizzle, TypeScript, Zod, OpenAPI, DBML, and more).

Product overview, architecture, and roadmap live in `document/`, written in Vietnamese.

## Commands

Requires Node.js 24 (`.nvmrc`) and pnpm 12.4.1 (from `packageManager`, via corepack). Non-interactive shells on this machine default to Node 22, so run `source ~/.nvm/nvm.sh && nvm use` in the repo root first.

Root scripts are in `package.json`; `pnpm dev` runs the frontend on port 3000 and the backend on port 3001.

Run a script in one package: `pnpm --filter @schemaforge/core test`. Start the built backend: `pnpm --filter @schemaforge/backend start`.

## Repository layout

Monorepo: pnpm workspaces + Turborepo (`frontend/`, `backend/`, `packages/`, `document/`); roles and library choices are in `document/architecture.md`.

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

Commits are pushed to the remote automatically once the checks pass; see `.claude/rules/git.md` for the details.
