# frontend

Web app for SchemaForge.

## Responsibilities

- Canvas schema editor: tables, columns, relations, indexes, enums, comments, subject areas, notes
- AI assistant chat UI (AI calls go through `backend/`; the frontend never calls Gemini directly)
- Code generation and import/export, running `packages/core` in the browser
- Image export (PNG/SVG)
- Local persistence for guests; cloud save, sharing, and version history through `backend/` when signed in
- Vietnamese and English UI, light and dark themes

## Stack

- Next.js, TypeScript (strict)
- Other libraries are chosen in each sub-project's spec. Candidates are listed in `document/architecture.md`.

## Configuration

`NEXT_PUBLIC_API_URL` is the origin of `backend/` (default `http://localhost:3001`); it is embedded into the client bundle at build time and allowed in the frontend's Content Security Policy. If your backend runs at a different address, copy `.env.example` to `.env.local` and set it there.
