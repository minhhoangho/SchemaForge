# Task 2: Hợp đồng importer

- Plan: [2026-10-03-import-export-plan.md, Task 2](../../plans/2026-10-03-import-export-plan.md#task-2-hợp-đồng-importer)
- Spec: [2026-09-15-import-export-design.md, mục 1 và mục 3](../../specs/2026-09-15-import-export-design.md#1-giao-diện-importer-trong-core)

## 2026-10-05 16:59 — core-engineer — Xong

- **Đã làm**
  - Tạo hợp đồng importer dùng chung trong `packages/core/src/importers/shared/`: kiểu (`IMPORT_FORMATS`, `ImportFormat`, `SourceLocation`, `ImportDiagnostic`, `LayoutMetrics`, `ImportOptions`, `ImportSuccess`, `ImportFailure`, `ImportResult`, `Importer`), 39 mã `IMPORT_DIAGNOSTIC_CODES` đúng thứ tự bảng Task 2, `createImportDiagnostic`, `finalizeImportDiagnostics`, giới hạn (`MAX_IMPORT_SOURCE_LENGTH`, `MAX_IMPORTED_ELEMENTS`, `checkSourceLength`, `countDocumentElements`, `tooManyElementsFailure`), vị trí nguồn (`createLineStarts`, `toSourceLocation`, `fromParserPosition`) và kiểu `ImportDraft`.
  - Tạo `src/testing/import-test-options.ts` (`TEST_LAYOUT_METRICS`, `createImportTestOptions`), không export qua `@schemaforge/core/testing`.
  - TDD: viết 7 file test trước; RED: 6/7 file lỗi vì module chưa có (`import-draft.test.ts` chỉ kiểm tra type nên chạy qua, cổng thật của nó là typecheck); GREEN: 7 file, 30 test pass.
  - Không đổi API công khai: chưa export gì qua `src/index.ts` (Task 17 làm).
- **File thay đổi** (tất cả mới)
  - `packages/core/src/importers/shared/import-types.ts`, `import-types.test.ts`
  - `packages/core/src/importers/shared/import-diagnostic-codes.ts`, `import-diagnostic-codes.test.ts`
  - `packages/core/src/importers/shared/import-diagnostics.ts`, `import-diagnostics.test.ts`
  - `packages/core/src/importers/shared/import-limits.ts`, `import-limits.test.ts`
  - `packages/core/src/importers/shared/source-location.ts`, `source-location.test.ts`
  - `packages/core/src/importers/shared/import-draft.ts`, `import-draft.test.ts`
  - `packages/core/src/testing/import-test-options.ts`, `import-test-options.test.ts`
  - `document/executions/logs/2026-10-05-import-export-task-2.md`
- **Kiểm tra**
  - `pnpm --filter @schemaforge/core exec vitest run src/importers/shared src/testing/import-test-options.test.ts --coverage.enabled=false`: RED 6 file lỗi; GREEN 7 file, 30 test pass.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test (3055 test pass, coverage dòng 97.6%), build, prettier đều PASS; `RESULT: PASS`.
  - Coverage riêng các file mới: 100% dòng; hai nhánh `?? 0` trong `toSourceLocation` không chạm tới được (chỉ để thỏa `noUncheckedIndexedAccess`).
  - `pnpm --filter @schemaforge/frontend typecheck`: thoát mã 0.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `DraftNote` dùng trường `text` thay vì `content` như plan, vì model `Note` (`src/model/note.ts`) đặt tên `text`; plan cho phép đổi theo model. Các trường khác khớp model (`primaryKeyColumnNames`, `columnNames`, `subjectAreaName` thay cho trường id).
  - `finalizeImportDiagnostics` lấy khóa bỏ trùng bằng `JSON.stringify([code, [line, column] | null, path])` thay vì stringify object `location`, để thứ tự khóa của object không ảnh hưởng việc bỏ trùng.
  - `toSourceLocation` không biết độ dài nguồn (chữ ký chỉ nhận `lineStarts`), nên "offset vượt cuối" được hiểu là offset bằng `source.length` (cuối input) và cho vị trí ngay sau ký tự cuối; offset lớn hơn độ dài là lỗi lập trình của importer, không bị kẹp. Đơn giản hơn đổi chữ ký.
  - Thêm test ngoài danh sách plan: `createImportDiagnostic`, `tooManyElementsFailure`, giá trị hai hằng giới hạn, thứ tự `path` `null` cuối, `ImportDiagnostic["code"]` gồm mã cấu trúc, và `import-test-options` (counter mới mỗi lần gọi), để mỗi quy tắc "Chữ ký và hành vi" có test riêng.
  - So sánh trong `finalizeImportDiagnostics` dùng hàm so `<`/`>` cục bộ, vì `compareValues` của `document-path.ts` không export và file đó không thuộc task này.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 4 đổi `DraftTarget` sang `DocumentPath` theo cột `path` của bảng mã Task 2; `field` là phân đoạn cuối.
  - Mọi importer trả diagnostic qua `finalizeImportDiagnostics`; mã cấu trúc chỉ dùng ở importer JSON.
  - Test importer dùng `createImportTestOptions()` từ `src/testing/import-test-options.ts` (import thẳng file, không qua `testing/index.ts`).
