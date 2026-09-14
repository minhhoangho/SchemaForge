# frontend

Web app for SchemaForge. Not scaffolded yet.

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
