# backend

API server for SchemaForge. Not scaffolded yet.

## Responsibilities

- Authentication
- Cloud storage of schemas, public/private share links, version history
- AI assistant: calls Google Gemini with the API key from the backend environment and validates AI tool calls with `packages/core`
- Validates every incoming schema with `packages/core`; no schema logic of its own

API key handling rules are in `CLAUDE.md` and `document/architecture.md`.

## Stack

- NestJS, TypeScript (strict)
- PostgreSQL + Prisma
- Google Gemini API
