# Hạ tầng snapshot cho generator

- Plan: [Task 1](../../plans/2026-09-15-code-generators-plan.md) (mục "Task 1: Hạ tầng snapshot cho generator")
- Spec: [code-generators-design](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-02 — core-engineer — Xong

- **Đã làm**: loại `src/**/__snapshots__/**` khỏi typecheck, lint, Prettier, build và coverage; loại `src/**/*.bench.ts` khỏi build và coverage. Làm đúng thứ tự "Kiểm chứng viết trước": đo coverage nền, tạo file thăm dò, thấy typecheck và Prettier đỏ, sửa cấu hình, thấy xanh, xóa file thăm dò.
- **File thay đổi**: `packages/core/tsconfig.json`, `packages/core/tsconfig.build.json`, `packages/core/vitest.config.ts`, `eslint.config.mjs`, `.prettierignore`.
- **Kiểm tra**:
  - Trước khi sửa cấu hình, có file thăm dò: `pnpm --filter @schemaforge/core typecheck` đỏ (`TS2322` trong `sample.ts`); `pnpm exec prettier --check packages/core/src/generators` đỏ (2 file).
  - Sau khi sửa: `.claude/scripts/verify.sh core --build` → `RESULT: PASS` (typecheck, lint, test, build); 850 test pass; coverage số dòng 98.07%, bằng lúc đo nền; `pnpm format:check` pass; `packages/core/dist/generators` và `dist/probe.bench.js` không tồn tại.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `tsconfig.json` thêm `exclude` mới; `tsconfig.build.json` ghi đè `exclude` của file cha nên liệt kê đủ mục cũ cộng hai mục mới.
  - Không chạy `pnpm --filter ... lint` riêng lẻ mà dùng `verify.sh` (cùng lệnh bên dưới).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: `lint` của core chạy từ root `eslint.config.mjs`, nên `**/__snapshots__/` trong `globalIgnores` áp cho cả frontend và backend (không ảnh hưởng vì chưa có thư mục này ở đó).
