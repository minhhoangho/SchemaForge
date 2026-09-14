---
paths:
  - "backend/**/*"
---

# NestJS (backend/)

## Structure

```text
backend/
  src/
    main.ts
    app.module.ts
    config/              validated env and typed config
    common/              cross-cutting guards, filters, interceptors, decorators, pipes
    prisma/              PrismaModule and PrismaService
    modules/<feature>/
      <feature>.module.ts
      <feature>.controller.ts
      <feature>.service.ts
      <feature>.repository.ts   only when data access is non-trivial
      dto/
  test/                  e2e tests
```

- File names follow the Nest CLI pattern `<name>.<kind>.ts`: `schemas.controller.ts`, `create-schema.dto.ts`, `auth.guard.ts`.
- One module per feature. A module exports only the providers other modules need; other modules never import its internal files.
- No circular module dependencies. Needing `forwardRef` means the boundary is wrong; restructure instead.

## Layers

- Controllers handle routing, DTO binding, and decorators, then call a single service method. No business logic, no Prisma.
- Services hold business logic. Data access goes through `PrismaService`, directly or through a repository.
- Schema logic (model, validation, operations) comes from `@schemaforge/core`. The backend never reimplements it.
- Constructor injection with `private readonly`. Never instantiate providers with `new`.

## DTOs and validation

- Every body, query, and param is bound to a DTO class and validated by a global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.
- Use the built-in `Parse*Pipe`s for scalar route params.
- Request DTOs (`CreateSchemaDto`, and `UpdateSchemaDto` built with `PartialType`) are separate from response DTOs.
- Never return Prisma models from controllers; map them to response DTOs so internal fields never leak.

## Errors

- Expected failures throw Nest HTTP exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`) or subclasses of `HttpException`, never a bare `Error`.
- A global exception filter gives every error the same response shape.
- Translate Prisma errors (such as `P2002` unique violation and `P2025` record not found) into HTTP exceptions in one place, not in each service.

## Configuration

- Load env through `@nestjs/config` with a validation schema; the app refuses to start on missing or invalid values.
- No `process.env` outside `src/config/`. Inject typed config instead.

## HTTP API

- REST resources use plural nouns, kebab-case paths, the right verbs, and the right status codes (`201` on create, `204` on delete without a body).
- List endpoints are paginated with a maximum page size.
- Cross-cutting behavior (logging, response mapping, timeouts) lives in interceptors, guards, or middleware, not copied into controllers.

## Logging

- Use Nest's `Logger`, one per class: `private readonly logger = new Logger(SchemasService.name)`.
- Log events with context (ids, durations). Never log request bodies, schema contents, prompts, or secrets.

## Tests

- Unit test services with `Test.createTestingModule`, replacing `PrismaService` and the Gemini client with test doubles.
- e2e tests in `backend/test/` exercise the HTTP layer against a dedicated test database.
