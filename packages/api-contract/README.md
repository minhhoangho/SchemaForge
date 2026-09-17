# @schemaforge/api-contract

The shared HTTP contract between `frontend/` and `backend/`: the single source of request and response types, error codes, and limits.

## Contents

- Limits: `EMAIL_MAX_LENGTH`, `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, `MAX_REQUEST_BODY_BYTES`, `SCHEMA_LIST_DEFAULT_LIMIT`, `SCHEMA_LIST_MAX_LIMIT`, `MAX_SCHEMAS_PER_USER`
- Errors: `API_ERROR_CODES`, `API_ERROR_STATUS`, the `ApiErrorBody` union, and `parseApiErrorBody`
- Zod schemas for every response, with their inferred types, and types for every request

The backend implements the request types in its DTOs and returns the response types from its mappers. The frontend parses every response with the matching schema.

## Rules

- Depends only on `zod` and on `import type` from `@schemaforge/core`.
- No React, Next.js, NestJS, or Prisma imports, and no browser-only or Node-only globals; everything must run in both environments.
- Zod schemas are created when a module loads, so in the browser this package must load after `frontend/src/lib/zod-config.ts`, like `@schemaforge/core`.
