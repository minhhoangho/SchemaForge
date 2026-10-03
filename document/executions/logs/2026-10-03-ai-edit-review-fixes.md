# Sửa theo review: `applyAiEdit` (bảng, cột, quan hệ)

- Plan: [Task 4](../../plans/2026-10-03-ai-assistant-plan.md#task-4-applyaiedit-cho-tool-sửa-bảng-cột-index-enum-schema), [Task 5](../../plans/2026-10-03-ai-assistant-plan.md#task-5-applyaiedit-cho-quan-hệ-export-phần-còn-lại-của-subpath)
- Spec: [AI-R9, AI-R10, danh mục tool sửa schema](../../specs/2026-10-02-ai-assistant-design.md#3-bộ-tool-và-ánh-xạ-sang-operation)
- Review: [2026-10-03-ai-assistant-review-2.md](2026-10-03-ai-assistant-review-2.md)

## 2026-10-03 22:42 — core-engineer — Xong

- **Đã làm**
  - Lỗi sai mã: `createTable` có hai cột trùng tên và nêu tên đó trong `primaryKey` từng trả `column-name-not-found` (vì `findSingleByName` coi hai kết quả khớp nguyên văn là không tìm thấy, giữ nguyên quyết định của Task 3). Nay `findDuplicateColumns` so tên bằng `toNameKey` và trả `column-name-duplicate` trước khi dịch `primaryKey`, `path = ["columns", <vị trí>, "name"]` (lần xuất hiện thứ hai trở đi), `at = columnAt(<bảng>, <tên>)`.
  - Rút ngắn hàm: tách `toNewColumns`, `findDuplicateColumns`, `resolveNewPrimaryKey`, `buildCreateTableOperations`, `toColumnChanges`, `translateSetPrimaryKey` (trong `ai-edit-tables.ts`) và `resolveColumnPairs` (trong `ai-edit-relations.ts`).
  - Thêm nhánh `default` với kiểm tra `never` cho `switch (edit.tool)` của `translateTableEdit`, giống `apply-ai-edit.ts`.
  - TDD: hai test mới trong `apply-ai-edit.test.ts` chạy đỏ trước khi sửa (`code: "column-name-not-found"`, `path: ["primaryKey", 0]` thay cho mã trùng tên; ca chỉ khác hoa thường nhận hai issue theo path tài liệu `["columns", "col_2", "name"]`), xanh sau khi sửa.
- **File thay đổi**
  - `packages/core/src/ai/ai-edit-tables.ts` (301 dòng; hàm dài nhất `translateCreateTable` 34 dòng)
  - `packages/core/src/ai/ai-edit-relations.ts` (300 dòng; hàm dài nhất `translateBuiltRelation` 32 dòng, `translatePairedRelation` còn khoảng 22 dòng)
  - `packages/core/src/ai/apply-ai-edit.test.ts` (thêm 2 test)
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core packages/core/src/ai/apply-ai-edit.test.ts --name "column-name-duplicate"`: đỏ (2 test fail đúng lý do) → xanh cả file.
  - `.claude/scripts/test-file.sh core packages/core/src/ai/ai-edit-relations.test.ts`: `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, 3003 test pass, coverage dòng 97,45 %, build, prettier).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Kiểm tra trùng tên chạy với mọi `createTable`, không chỉ khi `primaryKey` nêu tên trùng, để model nhận cùng một lỗi theo input. Hệ quả: `createTable` có cột trùng tên mà không nêu trong `primaryKey` giờ trả một lỗi `column-name-duplicate` theo path input (`["columns", i, "name"]`) thay vì hai issue từ `findIntroducedIssues` theo path tài liệu. Mã lỗi không đổi.
  - Lỗi kiểu cột (`column-type-invalid`…) vẫn báo trước lỗi trùng tên, vì cột được dựng trước khi dịch khóa chính.
  - Mã `column-name-duplicate` là `IssueCode` sẵn có trong `validation/issue-codes.ts`, `AiEditError` đã nhận `IssueCode`, nên không thêm mã mới.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `ai-edit-tables.ts` và `ai-edit-relations.ts` đều ở mức khoảng 300 dòng; thêm logic thì nên tách file.
  - File review `2026-10-03-ai-assistant-review-2.md` chưa có trong `document/executions/logs/` lúc viết log này; liên kết trên trỏ tới tên do orchestrator đưa.
