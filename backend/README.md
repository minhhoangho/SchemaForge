# backend

API server for SchemaForge.

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

## Local database

Development uses the Docker container `local_postgres` (`postgres:16-alpine`), already running on the dev machine, with its existing superuser `postgres`. Three databases live in it: `schemaforge_dev`, `schemaforge_test`, and `schemaforge_shadow` (used only by `prisma migrate dev` as its shadow database).

1. Create the databases, owned by the container's existing `postgres` superuser:

   ```bash
   docker exec -i local_postgres psql -U postgres -c "CREATE DATABASE schemaforge_dev OWNER postgres;"
   docker exec -i local_postgres psql -U postgres -c "CREATE DATABASE schemaforge_test OWNER postgres;"
   docker exec -i local_postgres psql -U postgres -c "CREATE DATABASE schemaforge_shadow OWNER postgres;"
   ```

2. From `backend/`, copy the env templates and point them at the container: replace `user:password` with the container's actual credentials (for example `postgres:postgres`), set the database name in `DATABASE_URL` to `schemaforge_dev` (`schemaforge_test` in `.env.test`), and check that `SHADOW_DATABASE_URL` points at `schemaforge_shadow`:

   ```bash
   cp .env.example .env
   cp .env.test.example .env.test
   ```

3. From `backend/`, apply migrations:

   ```bash
   pnpm exec prisma migrate dev
   ```

### No Docker available

Prisma CLI ships a local dev database (`prisma dev`, backed by PGlite over the WebAssembly PostgreSQL protocol). It accepts only one connection at a time, so it is for local development only, never CI or production:

```bash
pnpm exec prisma dev --name schemaforge --detach
```

The command prints a connection string; put it in `DATABASE_URL` (and `SHADOW_DATABASE_URL`, since `migrate dev` still needs a shadow database) in `.env`. Switching between the Docker container and `prisma dev` is only a matter of changing the URLs in `.env`. Stop the instance with `pnpm exec prisma dev stop schemaforge` (list instances with `pnpm exec prisma dev ls`).

## Migrations

- Every `schema.prisma` change ships with a migration: `pnpm exec prisma migrate dev --name <snake_case_description>`. Never edit or delete a committed migration; add a new one instead.
- CI and deployment run `pnpm exec prisma migrate deploy` only (no shadow database needed).

## Cookies over `http://localhost`

Auth cookies are `Secure` in every environment (`AUTH_COOKIE_SECURE=true` by default), including local development over plain `http://localhost`. Most browsers still accept a `Secure` cookie on `localhost` because it is treated as a secure context. If a particular browser refuses it, set `AUTH_COOKIE_SECURE=false` in `.env` for local development only; production must keep it `true` (enforced by env validation).
