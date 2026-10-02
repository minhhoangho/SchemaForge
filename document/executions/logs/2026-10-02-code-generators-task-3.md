# Task 3: Manifest và dependency của package conformance

- Plan: [Task 3](../../plans/2026-09-15-code-generators-plan.md)
- Spec: [2026-09-15-code-generators-design.md](../../specs/2026-09-15-code-generators-design.md) mục 7

## 2026-10-02 13:45 — devops-engineer — Xong

- **Đã làm**: tạo package `@schemaforge/codegen-conformance` (manifest đúng bảng "Phiên bản", `tsconfig.json`, `vitest.config.ts`, `.gitignore`, helper `withTempDirectory` có 3 test), cập nhật `allowBuilds`, ghi lockfile.
- **File thay đổi**: `packages/codegen-conformance/{package.json,tsconfig.json,vitest.config.ts,.gitignore}`, `packages/codegen-conformance/src/support/temp-directory.ts`, `temp-directory.test.ts`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`.
- **Kiểm tra**:
  - `pnpm install` rồi `pnpm install --frozen-lockfile`: đều pass, không còn `ERR_PNPM_IGNORED_BUILDS`.
  - Package: `typecheck`, `lint`, `test:conformance` (3 test pass), `prisma --version` = 7.10.0; root `pnpm typecheck` và `pnpm lint` (8/8 task) pass; prettier pass; `SECRET-SCAN: CLEAN`.
  - `verify.sh all --format`: `RESULT: FAIL (frontend test, backend typecheck, backend lint, backend test)`. Core pass. Lỗi không liên quan task: backend thiếu `src/generated/prisma/client.js` (client Prisma chưa generate trong worktree mới, `Cannot find module '../generated/prisma/client.js'`); frontend 2 test timeout 5000ms (`editor-screen.test.tsx`, `editor-workspace.test.tsx` axe) khi máy tải nặng.
- **Quyết định** (`allowBuilds`):
  - `prisma: true`, `@prisma/engines: true`: giữ nguyên, `prisma --version` chạy được.
  - `msw: false`: postinstall chỉ chép service worker cho trình duyệt, Node không cần.
  - `ssh2: false`, `cpu-features: false`: binding native tùy chọn, Testcontainers chạy không cần.
  - `protobufjs: false`: postinstall chỉ kiểm tra phiên bản, không cần để chạy (plan không nhắc, pnpm báo thêm).
  - Giữ `vite`, `typescript`, `vitest`, `zod`, `@types/node` là `catalog:`; `.tmp/` gốc không bị xóa sau test (chỉ thư mục `run-*` bị xóa), vì `mkdir` tạo thư mục gốc và đã nằm trong `.gitignore`.
- **Phiên bản cài**: `@dbml/core` 10.2.0, `@readme/openapi-parser` 9.0.0, `testcontainers` và `@testcontainers/*` 12.2.0, `drizzle-orm` 0.45.3, `msw` 2.15.0, `mysql2` 3.24.5, `mssql` 12.7.2, `@types/mssql` 12.3.0, `pg` 8.23.0, `@types/pg` 8.23.1, `openapi-types` 12.1.3, `prisma` 7.10.0, `zod` 4.6.4, `typescript` 6.0.3, `vitest` 5.0.0.
- **Ghi chú cho người tiếp theo**: worktree khác cần `pnpm install --frozen-lockfile` sau khi merge. Backend cần `prisma generate` thì typecheck mới xanh (ngoài phạm vi task).
