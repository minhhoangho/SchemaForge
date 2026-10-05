# Task 17: Export ở entry point chính

- Plan: [Task 17](../../plans/2026-10-03-import-export-plan.md#task-17-export-ở-entry-point-chính)
- Spec: [mục 1 "Entry point"](../../specs/2026-09-15-import-export-design.md)

## 2026-10-05 17:30 — core-engineer — Xong

- **Đã làm**
  - Viết test trước `exports the import contract and helpers` trong `index.test.ts` (so từng giá trị export của `index.js` với giá trị gốc của module nguồn) và thêm bảy tên vào danh sách export đã ghim. Đỏ: `AssertionError: expected [ undefined, undefined, …(5) ] to strictly equal [ …(7) ]` và danh sách 34 so với 41 tên.
  - `src/index.ts` export thêm giá trị: `IMPORT_FORMATS`, `IMPORT_DIAGNOSTIC_CODES`, `MAX_IMPORT_SOURCE_LENGTH`, `MAX_IMPORTED_ELEMENTS`, `buildImportOperation`, `serializeSchemaDocument`, `finalizeImportDiagnostics`; type: `ImportDiagnostic`, `ImportDiagnosticCode`, `ImportFailure`, `ImportFormat`, `ImportMode`, `ImportOperationBuild`, `ImportOptions`, `ImportResult`, `ImportSuccess`, `Importer`, `LayoutMetrics`, `SourceLocation`. Xanh sau khi thêm.
- **File thay đổi**
  - `packages/core/src/index.ts`
  - `packages/core/src/index.test.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3338/3338, coverage dòng 97.73%, build, prettier).
  - `grep -c "@dbml/core\|dbml-core-adapter" packages/core/dist/index.js`: `0`.
  - `pnpm --filter @schemaforge/frontend typecheck`: thoát mã 0.
  - `pnpm typecheck` (root): `Tasks: 8 successful, 8 total`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Export thêm type `ImportOperationBuild` (không có trong danh sách type của Task 17): đó là kiểu trả về của `buildImportOperation` công khai, orchestrator yêu cầu, và theo cách đã làm với `AppliedOperation`.
  - Không export `SERIALIZED_FIELD_ORDER`, `pickUnusedName`, `remapMergedDocument`, `ImportDraft`, `checkSourceLength`, `countDocumentElements`, `createImportDiagnostic` hay hàm nào khác của `importers/shared/` (Task 17 cấm).
  - Test mới so bằng tham chiếu giá trị của module nguồn thay vì chỉ kiểm tra `typeof`, để bắt việc re-export nhầm module.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: thứ tự export trong `index.ts` theo đường dẫn module; danh sách ghim trong `index.test.ts` sắp theo code unit (chữ hoa trước, `MAX_IMPORTED_ELEMENTS` đứng trước `MAX_IMPORT_SOURCE_LENGTH`).
