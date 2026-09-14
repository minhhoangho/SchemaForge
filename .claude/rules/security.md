---
paths:
  - "backend/**/*"
  - "frontend/**/*"
---

# Security

## Secrets

- Secrets (Gemini API key, database URL, auth secrets) come only from environment variables. The repo holds only `.env.example` with placeholder values.
- Never put a secret in logs, error messages, API responses, analytics, client bundles, or test fixtures.

## Authentication and authorization

- Backend routes are private by default: a global guard requires an authenticated user, and public routes (such as public share links) opt out explicitly.
- Authorize every access to a user-owned resource (schema, version, share link) on the server by checking ownership or share permission, not only that someone is signed in. Answer `404` for resources the caller may not see.
- Share link tokens are random (at least 128 bits), unguessable, and revocable.
- If auth uses cookies: `HttpOnly`, `Secure`, `SameSite=Lax` or stricter, plus CSRF protection on state-changing requests. Never keep auth tokens in `localStorage`.

## Untrusted input

- Treat request bodies, query strings, route params, imported files, and AI output as untrusted.
- Validate the shape at the boundary and validate schema content with `@schemaforge/core`.
- Cap request body and import file sizes; reject oversized input before parsing.
- Rate limit sign-in, sign-up, and AI endpoints.

## AI

- AI endpoints require a signed-in user and enforce the per-user usage limit.
- Model output is applied only as validated tool calls mapped to core operations. Never execute, `eval`, or run SQL from model output.
- Keep user content in clearly delimited data sections of the prompt so it cannot override system instructions. Never put secrets or another user's data in a prompt.

## Output

- No `dangerouslySetInnerHTML` with user or AI content (schema names, comments, notes, chat messages). Render Markdown through a sanitizing renderer.
- Error responses never expose stack traces, SQL, Prisma errors, or upstream Gemini errors.
- CORS allows only the configured frontend origins; never `*` together with credentials.
- Send security headers: Helmet on the backend, a Content Security Policy on the frontend.
