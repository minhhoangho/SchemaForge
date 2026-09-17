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

- File names follow the Nest CLI pattern `<name>.<kind>.ts`: `schemas.controller.ts`, `create-schema.dto.ts`, `auth.guard.ts`. This pattern also covers `repository`, `mapper`, `strategy`, and `policy` (`auth.repository.ts`, `users.mapper.ts`, `jwt.strategy.ts`, `rate-limit.policy.ts`). A feature can have more than one repository when it owns more than one aggregate. Pure helpers with no Nest kind use plain kebab-case (`auth-cookies.ts`, `password-hasher.ts`), no `.<kind>` suffix.
- One module per feature. A module exports only the providers other modules need; other modules never import its internal files.
- No circular module dependencies. Needing `forwardRef` means the boundary is wrong; restructure instead.

## Layers

- Controllers handle routing, DTO binding, and decorators, then call a single service method. No business logic, no Prisma. A controller may pass that service call's result to a pure, injected helper that builds the HTTP response for a transport concern the service has no business knowing about, such as setting or clearing cookies (for example an `AuthCookies` provider with `set`/`clear`, injected and called after the single service call). The helper stays free of business logic; it only shapes the response.
- Services hold business logic. Data access goes through `PrismaService`, directly or through a repository.
- Schema logic (model, validation, operations) comes from `@schemaforge/core`. The backend never reimplements it.
- Constructor injection with `private readonly`. Never instantiate providers with `new`.

## DTOs and validation

- Every body, query, and param is bound to a DTO class and validated by a global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.
- Use the built-in `Parse*Pipe`s for scalar route params.
- Request DTOs are separate from response DTOs. `PartialType` is only for partial updates (`PATCH`); a `PUT` that replaces a whole resource gets its own DTO class with every field required, not `PartialType`.
- Never return Prisma models from controllers; map them to response DTOs so internal fields never leak.
- DTO class fields populated by `class-transformer` may use definite assignment (`readonly email!: string`) to satisfy `strictPropertyInitialization`. This is the only allowed use of `!` in the codebase (`typescript.md` otherwise bans it); it is limited to DTO class fields, never used to silence the compiler elsewhere.

## Errors

- Expected failures throw Nest HTTP exceptions (`NotFoundException`, `ForbiddenException`, `ConflictException`) or subclasses of `HttpException`, never a bare `Error`.
- A global exception filter gives every error the same response shape.
- Translate Prisma errors (such as `P2002` unique violation and `P2025` record not found) into HTTP exceptions in one place, not in each service.

## Configuration

- Load env through `@nestjs/config` with a validation schema; the app refuses to start on missing or invalid values.
- No `process.env` outside `src/config/`. Inject typed config instead. The only exceptions are tool config files that run outside the Nest app: `backend/prisma.config.ts`, `backend/vitest.e2e.config.ts`, and `backend/test/global-setup.ts`. `eslint.config.mjs` lists exactly these files alongside `src/config/**`.

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
