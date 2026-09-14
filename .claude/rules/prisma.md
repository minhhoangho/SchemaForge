---
paths:
  - "backend/**/*"
---

# Prisma and PostgreSQL

## Schema

- Models are `PascalCase` singular, fields `camelCase`. Map them to `snake_case` table and column names with `@@map` and `@map`.
- Every model has `id`, `createdAt`, and `updatedAt` (`@updatedAt`), with one id strategy across all models.
- Every relation sets `onDelete` explicitly.
- Index every foreign key and the columns used by frequent `where` and `orderBy` clauses.
- Schema documents are stored in a `Json` (JSONB) column and validated with `@schemaforge/core` before every write.

## Migrations

- Every change to `schema.prisma` ships with a migration from `prisma migrate dev --name <snake_case_description>`, committed together.
- Never edit or delete a committed migration; add a new one.
- Destructive changes (dropping or renaming a column, narrowing a type) use expand and contract across separate deployments.
- Deployed environments use `prisma migrate deploy` only. `prisma db push` is for throwaway local prototypes.

## Queries

- One `PrismaService` in `PrismaModule`. Nothing else creates a Prisma client.
- `select` only the fields you need; sensitive fields such as password hashes never leave the data layer.
- Avoid N+1 queries: load relations with `include` or `select`, or batch with `in`.
- Paginate every list query with a maximum page size.
- Writes that must succeed or fail together run in `$transaction`.
- Use `$queryRaw` tagged templates only when the query builder cannot express the query. Never use `$queryRawUnsafe` or `$executeRawUnsafe`.
