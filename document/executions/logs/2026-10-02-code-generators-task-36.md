# Task 36: Hai issue mới của phần 2 và bản dịch

- Plan: [`document/plans/2026-09-15-code-generators-plan.md`, Task 36](../../plans/2026-09-15-code-generators-plan.md)
- Spec: [`document/specs/2026-09-14-code-generators-design.md`, mục 2 và "Vấn đề với các spec đã duyệt"](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-02 13:55 — core-engineer — Xong

- **Đã làm**
  - `ISSUE_CODES` từ 25 lên 27 mã: `index-name-conflicts-table` ngay sau `index-name-duplicate`, `table-columns-empty` ngay sau `subject-area-name-duplicate`.
  - Tạo `rules/tables.ts` với `validateTables` (issue `table-columns-empty` tại `["tables", id, "columnIds"]`); `validateSchema` gọi thêm hàm này.
  - `rules/names.ts`: thêm `findIndexTableConflicts` (so bằng `toNameKey`, bỏ qua tên rỗng, chỉ báo index, không so với enum), gọi trong `validateNames`.
  - `suggestIndexName`: tập tên đã dùng gồm tên index và tên bảng; thêm một dòng JSDoc.
  - Bản dịch `en`, `vi` cho hai mã mới trong `issues.ts`, đúng thứ tự `ISSUE_CODES`.
  - TDD: test mới chạy đỏ trước khi cài đặt (`tables.test.ts` lỗi `Cannot find module './tables.js'`; `names.test.ts` 2 đỏ; `suggest-index-name.test.ts` 2 đỏ; `issue-codes.test.ts` 1 đỏ; `validate-schema.test.ts` 1 đỏ; frontend `issue-and-error-messages.test.ts` 6 đỏ sau khi build core), rồi xanh sau khi cài đặt.
  - Sửa dữ liệu thử (thêm cột cho bảng rỗng) của các test có sẵn bị đỏ vì bảng không cột:
    - `packages/core/src/validation/validate-schema.test.ts` (test ED-01)
    - `packages/core/src/validation/find-introduced-issues.test.ts`
    - `frontend/src/features/editor/lib/issue-index.test.ts`
    - `frontend/src/features/editor/components/panels/issue-list-tab.test.tsx`
    - `frontend/src/features/editor/components/panels/left-panel.test.tsx` (thêm cột `id` cho `users`, kỳ vọng đổi từ `users 0 columns` thành `users 1 column`)
    - `frontend/src/features/editor/components/toolbar/editor-toolbar.test.tsx`
  - Sau khi orchestrator cho phép: `packages/core/src/index.test.ts` đổi `ISSUE_CODE_COUNT` từ 25 thành 27 và tên test thành `exposes twenty-seven issue codes and seventeen error codes`.
- **File thay đổi**: `packages/core/src/index.test.ts`, `packages/core/src/validation/{issue-codes.ts,issue-codes.test.ts,validate-schema.ts,validate-schema.test.ts,find-introduced-issues.test.ts}`, `packages/core/src/validation/rules/{names.ts,names.test.ts,tables.ts,tables.test.ts}`, `packages/core/src/operations/{suggest-index-name.ts,suggest-index-name.test.ts}`, `frontend/src/lib/i18n/locales/{en,vi}/issues.ts`, bốn file test frontend ở trên.
- **Kiểm tra**
  - Lần đầu `.claude/scripts/verify.sh core --build --format`: test FAIL đúng một test `src/index.test.ts > exposes twenty-five issue codes and seventeen error codes` (`AssertionError: expected [ 27, 17 ] to strictly equal [ 25, 17 ]`); khi loại file này: 875/875 pass, coverage dòng 98.1%.
  - Sau khi sửa `src/index.test.ts`: `.claude/scripts/verify.sh core --build --format` → typecheck, lint, test (878 test), build, format đều PASS, `RESULT: PASS`.
  - `.claude/scripts/verify.sh frontend`: RESULT: PASS (typecheck, lint, test).
  - `pnpm --filter @schemaforge/backend typecheck`: thoát 0 (cần chạy `pnpm --filter @schemaforge/backend generate` trước trong worktree mới; output nằm trong `backend/src/generated/`, đã gitignore).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `validateTables` duyệt `Object.values` rồi `sortByPathThenCode`, giống `validateEnums`: kết quả xác định không phụ thuộc thứ tự khóa.
  - `findIndexTableConflicts` dùng `Set` tên bảng theo `toNameKey`: O(n), không cần nhóm như `findDuplicateIssues` vì chỉ báo phía index.
  - Bảng có trong test không còn bảng rỗng: thêm cột vào dữ liệu thử thay vì thêm issue vào kỳ vọng, theo plan.
  - `src/index.test.ts` không có trong "File sở hữu" của Task 36 (đỏ do đếm số mã, không do dữ liệu thử): đã dừng và báo; orchestrator thêm file này vào phạm vi task cho đúng thay đổi số mã 25 → 27 và tên test.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: plan Task 36 thiếu `src/index.test.ts` trong "File sở hữu" (file ghim `ISSUE_CODES.length`). Trong worktree mới phải chạy `pnpm --filter @schemaforge/backend generate` trước `backend typecheck`.
