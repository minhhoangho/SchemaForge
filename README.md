# SchemaForge

SchemaForge is a web-based database schema designer with an AI assistant at its core. Design schemas visually on a canvas, describe or refine them in natural language (Vietnamese or English), and generate code from them.

> **Status: early development.** Scaffolding and tooling are in place. The core schema model, editor, auth and cloud storage, code generators, and import/export are in progress; the AI assistant, sharing, and version history have not started yet. See [`document/roadmap.md`](document/roadmap.md) for current progress.

## Key features

Planned functionality, grouped by area:

- **Visual editor** — tables, columns, relations, indexes, enums, and comments on a pan/zoom canvas, with undo/redo and dark mode.
- **AI assistant** — describe a schema in Vietnamese or English and have it generated or refined through multi-turn chat, with suggestions, explanations, and design-issue detection.
- **Code generators** — SQL DDL (PostgreSQL, MySQL, SQL Server), Prisma, Drizzle, TypeScript types, Zod schemas, mock REST APIs, OpenAPI, seed data, DBML, and Markdown docs.
- **Import & export** — import from SQL, Prisma, DBML, or JSON; export to any generator format, JSON, PNG/SVG, or a ZIP bundle.
- **Storage & sharing** — local-first storage in the browser, with optional cloud save, share links, and version history once signed in.

## Product principles

- **Local-first.** The editor, code generation, and import/export work fully in the browser, no account required.
- **Sign in for more.** Signing in adds cloud save, share links, version history, and the AI assistant.
- **No API key needed.** The AI assistant runs on Google Gemini through the backend; users never provide their own key.
- **Bilingual.** The UI supports Vietnamese and English throughout.

## Tech stack and repo layout

Monorepo managed with pnpm workspaces and Turborepo.

| Path             | Role                                                                                  | Stack                                                 |
| ---------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `frontend/`      | Web app: canvas editor, AI chat UI, code generation, import/export, local persistence | Next.js, TypeScript                                   |
| `backend/`       | API: auth, cloud storage, share links, version history, AI assistant                  | NestJS, TypeScript, PostgreSQL, Prisma, Google Gemini |
| `packages/core/` | Shared schema model, validation, operations, code generators, importers               | Framework-free TypeScript                             |
| `document/`      | Product overview, architecture, roadmap, specs, plans                                 | Markdown (Vietnamese)                                 |

## Getting started

Prerequisites: Node.js 24 (see [`.nvmrc`](.nvmrc)) and pnpm 12.4.1, enabled via corepack.

```bash
pnpm install   # install dependencies for the whole workspace
pnpm dev       # core in watch mode, frontend on port 3000, backend on port 3001
```

Other root scripts:

- `pnpm build` — build every package in dependency order
- `pnpm lint` — ESLint in every package
- `pnpm typecheck` — TypeScript in every package
- `pnpm test` — Vitest with coverage thresholds
- `pnpm format` / `pnpm format:check` — format or check formatting with Prettier

See [`CLAUDE.md`](CLAUDE.md) for the full command and architecture reference.

## Documentation

Product overview, architecture, roadmap, specs, and plans live in [`document/`](document/), written in Vietnamese:

- [`document/overview.md`](document/overview.md) — product and feature overview
- [`document/architecture.md`](document/architecture.md) — components, data flow, technical decisions
- [`document/roadmap.md`](document/roadmap.md) — project parts, dependencies, and status
- [`document/specs/`](document/specs/) and [`document/plans/`](document/plans/) — design specs and implementation plans per part
