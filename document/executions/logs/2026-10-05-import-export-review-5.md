# Review 5: Task 12 importer SQL

Task 12 trong [plan phần 7](../../plans/2026-10-03-import-export-plan.md), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md). `project-reviewer` (chỉ đọc) review commit `a9f3793` (merge `6ed65ca`). Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của reviewer và quyết định của orchestrator.

## 2026-10-05 22:03 — project-reviewer — Xong

- **Đã làm**: review `a9f3793` theo `CLAUDE.md`, `.claude/rules/`, spec mục 5, plan Task 12 và [log Task 12](2026-10-05-import-export-task-12.md).
  - Kết luận: request changes.
  - F1 (blocking): phần tử `KEY` thường, `FULLTEXT`, `SPATIAL` trong `CREATE TABLE` của MySQL mất tùy chọn của phần tử và loại index mà không có diagnostic (`sql-draft-index-rules.ts:194-201`).
  - F2: khóa ngoại, khóa chính, `UNIQUE` tới bảng không có trong file làm cả lần import thành `syntax-error` tại 1:2 (`import-sql.ts:152-155`); thiếu test "quan hệ tới bảng không có" của plan.
  - F3: `isAutoIncrementIndex` bỏ index của người dùng cả khi một khóa khác bắt đầu bằng cột đó (`sql-draft-index-rules.ts:156-170`).
  - F4: hàm và file dài: `resolveScannerStatements` 63 dòng, `translateColumn` 46 dòng, `draftParsedSql` 42 dòng, `sql-draft-columns.ts` 317 dòng.
  - F5 (quy trình): Task 12 sửa file của Task 9 và 11 (`classify-statement.ts`, `sql-column-definitions.ts`: `isAddedDefault`, `typeStart`, `defaultText`, `isQualified`) và thêm 8 file helper; orchestrator chấp nhận hồi tố.
  - N1: diagnostic của CHECK và quan hệ đặt tại `CREATE TABLE` thay vì câu `ALTER TABLE` chứa chúng.
  - N2: comment đặt sai chỗ ở `import-sql.roundtrip.test.ts:20-22`.
  - Quyết định 1–13 của task được chấp nhận, trừ quyết định 1 (siết lại theo F3) và 11 (bác một phần theo F2).
  - Trả lời câu hỏi của task: A đồng ý (dòng lệnh meta của psql kết thúc ở cuối dòng; hiện `\connect` nuốt câu tiếp theo và làm mất một bảng); B đồng ý (đọc SSMS `ADD DEFAULT … FOR`).
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - `pnpm --filter @schemaforge/core build`: pass.
  - `prettier --check` trên 29 file: pass.
  - grep câu import `@dbml/core` trong `packages/core/dist`: chỉ `dbml-core-adapter.js`.
  - `secret-scan.sh --range a9f3793~1..a9f3793`: `SECRET-SCAN: CLEAN`.
  - Typecheck và toàn bộ test do orchestrator chạy trên `master`: 190 file, 4518 test pass.
  - Không chạy lint vì `eslint.config.mjs` ở cây chính có bản sửa chưa commit của người dùng.
- **Quyết định** (orchestrator)
  - F1–F4, N1, N2 và B giao `core-engineer` sửa, log `2026-10-05-import-export-review-5-fixes.md`.
  - A hoãn tới khi bản sửa bảo mật của `statement-scanner.ts` ([rà soát bảo mật lần 1](2026-10-05-import-export-security-review-1.md)) được merge, vì cùng sửa file đó.
  - Các quy tắc mới ghi vào spec ở [lần sửa 2](2026-10-05-import-export-spec-amendment-2.md).
- **Việc còn lại**
  - [ ] F1: đọc phần tử `[FULLTEXT | SPATIAL] KEY | INDEX` trong `CREATE TABLE` của MySQL, báo `index-option-dropped` và `index-type-dropped`, kèm test.
  - [ ] F2: che câu `ALTER TABLE … ADD` tới hoặc trên bảng không có `CREATE TABLE` trong file, báo `reference-not-found` tại câu lệnh; thêm test "quan hệ tới bảng không có" và test `CREATE INDEX` trên bảng không có.
  - [ ] F3: `isAutoIncrementIndex` chỉ bỏ index khi không khóa nào khác của bảng bắt đầu bằng cột đó, kèm test.
  - [ ] F4: tách `resolveScannerStatements`, `translateColumn`, `draftParsedSql` và `sql-draft-columns.ts` theo giới hạn của `.claude/rules/code-quality.md`.
  - [ ] N1: đặt diagnostic của CHECK và quan hệ tại câu `ALTER TABLE` chứa chúng.
  - [ ] N2: chuyển comment ở `import-sql.roundtrip.test.ts:20-22` về đúng chỗ.
  - [ ] B: scanner đọc SQL Server `ALTER TABLE t ADD [CONSTRAINT n] DEFAULT <biểu thức> FOR c` qua `mapSqlDefault`, kèm test.
  - [ ] A (sau khi merge bản sửa bảo mật của `statement-scanner.ts`): dòng lệnh meta của psql kết thúc ở cuối dòng; `\restrict`, `\unrestrict`, `\connect`, `\c` bỏ qua không diagnostic, dòng khác `statement-not-supported`; kèm test `\connect` không nuốt câu tiếp theo.
- **Ghi chú cho người tiếp theo**: lint ở cây chính hỏng do `eslint.config.mjs` có bản sửa chưa commit; chạy lint trong worktree sạch. Lệnh grep literal `@dbml/core` khớp 9 file vì `tsc` giữ comment; dùng grep câu import ở plan Task 12.
