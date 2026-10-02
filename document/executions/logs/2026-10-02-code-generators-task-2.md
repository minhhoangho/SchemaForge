# Task 2: Kiểu chung, mã diagnostic và helper output

- Plan: [Task 2](../../plans/2026-09-15-code-generators-plan.md#task-2-kiểu-chung-mã-diagnostic-và-helper-output)
- Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md), mục 1 "Chữ ký" và mục 4 "Danh mục mã diagnostic"

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Tạo hợp đồng chung của generator: `GENERATOR_TARGETS`, `SQL_DIALECTS`, `NoOptions`, `MarkdownLabels` (23 khóa), `GeneratorOptions`, `OutputLanguage`, `GeneratedFile`, `GeneratorDiagnostic`, `GenerateResult`, `Generate<T>`.
  - `GENERATOR_DIAGNOSTIC_CODES` gồm **17** mã (theo quyết định ngày 2026-10-02: thêm `comment-truncated` sau `null-character-removed`, trước `seed-table-skipped`), kèm hợp đồng `path` cho từng mã ghi trong comment đầu file. 16 mã còn lại khớp đúng thứ tự bảng ở spec mục 4 trên đĩa.
  - `createDiagnostic`, `finalizeDiagnostics` (bỏ cặp `code`/`path` lặp, sắp bằng `sortByPathThenCode`), `renderFileContent`, `formatDiagnosticsSnapshot`.
  - TDD: viết 5 file test trước, chạy thấy đỏ (`Cannot find module './generator-types.js'`… cho cả 5 file), rồi cài đặt tới xanh (16 test).
- **File thay đổi** (tạo mới)
  - `packages/core/src/generators/shared/generator-types.ts`, `generator-types.test.ts`
  - `packages/core/src/generators/shared/diagnostic-codes.ts`, `diagnostic-codes.test.ts`
  - `packages/core/src/generators/shared/diagnostics.ts`, `diagnostics.test.ts`
  - `packages/core/src/generators/shared/render-file.ts`, `render-file.test.ts`
  - `packages/core/src/testing/generator-snapshot.ts`, `generator-snapshot.test.ts`
- **Kiểm tra**
  - `pnpm --filter @schemaforge/core exec vitest run src/generators/shared src/testing/generator-snapshot.test.ts`: đỏ (5 file không tìm thấy module), sau đó 16/16 pass.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 866/866, build, prettier); coverage dòng 98.09%.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Hợp đồng `path` ghi dưới dạng comment trong `diagnostic-codes.ts`, không thành dữ liệu lúc chạy: chưa có nơi nào cần đọc nó bằng code.
  - `finalizeDiagnostics` khử trùng bằng `Map` với khóa `JSON.stringify([code, path])`: một khóa duy nhất cho cặp, không nhập nhằng giữa `code` và phần tử đầu của `path`.
  - `renderFileContent` bỏ `\n` cuối bằng vòng quét thay vì regex `/\n+$/`, vì regex này backtrack bậc hai trên chuỗi dài nhiều `\n` không nằm ở cuối.
  - `formatDiagnosticsSnapshot` giữ thứ tự nhận vào (đúng plan), không tự sắp lại.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Frontend (Task 34) dùng `satisfies Record<GeneratorDiagnosticCode, string>`, nên bản dịch phải có cả `comment-truncated`.
  - Spec và bảng "Điểm nóng" của plan vẫn ghi 16 mã; việc cập nhật spec lên 17 mã đang được làm song song (không thuộc task này).
  - `generators/shared/` chưa có `index.ts` và chưa export qua entry point chính; Task 5 làm việc đó.
