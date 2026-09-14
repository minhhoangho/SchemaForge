---
paths:
  - "frontend/**/*"
---

# Next.js (frontend/)

## Structure

```text
frontend/src/
  app/                   routes only: page, layout, loading, error, not-found
  features/<feature>/    components, hooks, state, and API calls for one feature
  components/            shared UI used by several features
  lib/                   API client, config, and other framework-light helpers
```

- App Router only; no `pages/` directory.
- Route files stay thin: they read params, load what the route needs, and compose feature components.
- Use route groups `(name)` to organize routes without changing URLs, and `_name` private folders for non-route files inside `app/`.
- Features import from `components/` and `lib/`, never from another feature's internals.

## Server and client components

- Components are Server Components by default. Add `"use client"` only where state, effects, event handlers, or browser APIs are needed, and place it as low in the tree as possible.
- The canvas editor and anything that touches browser storage or editor state are client components; lazy-load heavy ones with `next/dynamic`.
- Modules that must never reach the browser start with `import "server-only"`.
- Props passed from server to client components must be serializable.
- `params` and `searchParams` are Promises; `await` them.

## Data and the backend

- `backend/` owns auth, persistence, sharing, version history, and AI. Route Handlers, Server Actions, and middleware contain no business logic, no database access, and no Gemini calls.
- All backend calls go through the typed API client in `src/lib/api/`. Components never build URLs or call `fetch` directly.
- Editing, code generation, and import/export run in the browser with `@schemaforge/core`; they never round-trip through the backend.
- Components never change schema state directly; they dispatch core operations (see CLAUDE.md).

## Configuration

- Only `NEXT_PUBLIC_*` variables reach the browser, and they never hold secrets. The frontend has no Gemini key.
- Read and validate env in one module under `src/lib/`; no `process.env` elsewhere.

## Built-in APIs

- `next/link` for internal navigation, `next/image` for images, `next/font` for fonts.
- Page titles and SEO through the Metadata API (`metadata` or `generateMetadata`).
- Add `loading.tsx` and `error.tsx` to route segments that load data or can fail.

## UI

- No hardcoded user-facing text, including `aria-label`s, toasts, and error messages: everything goes through i18n with `vi` and `en`.
- Support light and dark themes from the start. Colors come from theme tokens, never hardcoded values.
