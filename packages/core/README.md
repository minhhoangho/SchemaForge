# @schemaforge/core

Shared, framework-free TypeScript used by both `frontend/` and `backend/`.

## Responsibilities

- Schema model: tables, columns, relations, indexes, enums, comments, subject areas, notes
- Validation
- Operations: the only way to change a schema, whether from canvas edits, AI tool calls, or imports. Undo/redo and version history build on them.
- Code generators: SQL DDL (PostgreSQL, MySQL, SQL Server), Prisma, Drizzle, TypeScript, Zod, OpenAPI, mock REST API, seed data, DBML, Markdown
- Importers: SQL, Prisma, DBML, JSON

## Rules

- No React, Next.js, NestJS, or Prisma imports.
- No network calls, no storage, no browser-only or Node-only APIs; everything must run in both environments.
