# Subpath `./generators/*` và export chung (Code generators, Task 5)

- Plan: [Task 5](../../plans/2026-09-15-code-generators-plan.md)
- Spec: [mục 1](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-02 13:20 — core-engineer — Xong

- **Đã làm**
  - Thêm pattern `"./generators/*"` vào `exports` của `packages/core/package.json`, sau `"./testing"`; giữ `"."` và `"./testing"`.
  - `src/index.ts` export thêm từ `generators/shared/generator-types.js` và `generators/shared/diagnostic-codes.js`:
    - giá trị: `GENERATOR_TARGETS`, `GENERATOR_DIAGNOSTIC_CODES`;
    - type: `GeneratorTarget`, `SqlDialect`, `NoOptions`, `GeneratorOptions`, `MarkdownLabels`, `OutputLanguage`, `GeneratedFile`, `GeneratorDiagnostic`, `GeneratorDiagnosticCode`, `GenerateResult`, `Generate`.
  - `src/index.test.ts`: thêm hai tên vào danh sách giá trị runtime; thêm test `exposes twelve generator targets and seventeen generator diagnostic codes` (12 và 17).
- **File thay đổi**: `packages/core/package.json`, `packages/core/src/index.ts`, `packages/core/src/index.test.ts`.
- **Kiểm tra**
  - Đỏ: `.claude/scripts/test-file.sh core src/index.test.ts` -> 2 failed (`GENERATOR_TARGETS` undefined; danh sách giá trị thiếu hai tên).
  - Xanh: cùng lệnh -> `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format` -> `RESULT: PASS` (typecheck, lint, test 867 pass, line coverage 98.09%, build, prettier).
  - `pnpm --filter @schemaforge/frontend typecheck` -> pass.
  - `pnpm --filter @schemaforge/backend typecheck` -> fail, nhưng mọi lỗi đều do thiếu `src/generated/prisma/client.js` (Prisma client chưa generate trong worktree mới), không có lỗi nào nhắc tới `@schemaforge/core`. Không liên quan thay đổi này.
  - Lệnh `node` của plan trong `backend`: in `12 17` rồi `ERR_MODULE_NOT_FOUND` (đúng mong đợi, trừ 17 thay vì 16).
  - `.claude/scripts/secret-scan.sh` -> `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Dùng 17 mã diagnostic (có `comment-truncated`) theo yêu cầu của orchestrator và `diagnostic-codes.ts`, không phải 16 như text plan.
  - Không export `SQL_DIALECTS` vì plan chỉ liệt kê `GENERATOR_TARGETS` và `GENERATOR_DIAGNOSTIC_CODES` là giá trị.
  - Bỏ qua mọi bước CI trong plan vì CI đã bị gỡ.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: import subpath thật được kiểm tra ở Task 14. Test backend typecheck cần `prisma generate` trước nếu muốn thấy xanh.
