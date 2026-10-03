# Task 5: `applyAiEdit` cho quan hệ, export phần còn lại của subpath

- Plan: [Task 5](../../plans/2026-10-03-ai-assistant-plan.md#task-5-applyaiedit-cho-quan-hệ-export-phần-còn-lại-của-subpath)
- Spec: [Danh mục tool sửa schema dòng 9–11, AI-R10, AI-R11, AI-R13, AI-R15, AI-R16, AI-R63](../../specs/2026-10-02-ai-assistant-design.md#3-bộ-tool-và-ánh-xạ-sang-operation)

## 2026-10-03 20:45 — core-engineer — Xong

- **Đã làm**
  - `addRelation`: `manyToMany` gọi `buildManyToMany` (tên bảng nối là `junctionTable` hoặc `<fromTable>_<toTable>` theo tên model viết, vị trí `aiTablePosition(context.placement)`, `placedTables: 1`); có `fromColumns` dựng operation `addRelation` ghép từng cặp với `toColumns` hoặc khóa chính bảng đích (`relation-columns-mismatch` khi khác độ dài, `primary-key-missing` khi bảng đích không có khóa chính và không có `toColumns`), id qua `createRelationId`; không có `fromColumns` gọi `buildRelation` với `referencedColumnIds` từ `toColumns` (bỏ trường khi không có). `onDelete`, `onUpdate` mặc định `noAction`.
  - `updateRelation`, `removeRelation`: tìm bằng `findRelationsBetween` (thu hẹp bằng `fromColumns`); không có trả `relation-not-found`, nhiều hơn một trả `relation-ambiguous`; `updateRelation` chỉ đổi trường được truyền.
  - Tách `apply-ai-edit.ts` (464 dòng) thành bốn file, hành vi tool 1–8, 12–16 không đổi (test của Task 4 trong `apply-ai-edit.test.ts` không sửa, vẫn xanh).
  - `src/ai/index.ts` thêm `applyAiEdit`, `AiEditContext`, `AiEditSuccess`, `buildAiFindings`, `AiFinding`, `AiFindingTarget`, `buildAiSampleDataset`.
  - TDD: viết `ai-edit-relations.test.ts` trước; đỏ 25/25 với `Error: applyAiEdit does not translate addRelation yet` (và `updateRelation`, `removeRelation`); sau khi cài đặt xanh 25/25.
- **File thay đổi** (số dòng)
  - `packages/core/src/ai/apply-ai-edit.ts` (198, sửa): còn `applyAiEdit`, `translate` (dispatch), dịch index và enum; re-export type `AiEditContext`.
  - `packages/core/src/ai/ai-edit-resolve.ts` (112, mới): `AiEditContext`, `Resolved`, `Translation`, `tableAt`, `columnAt`, `enumAt`, `failWith`, `failInside`, `resolveTable` (thêm tham số `path`), `resolveColumn`, `resolveColumns`, `resolveEnumId`.
  - `packages/core/src/ai/ai-edit-tables.ts` (211, mới): dịch `createTable`, `updateTable`, `removeTable`, `setPrimaryKey`, `addColumn`, `updateColumn`, `removeColumn` (chuyển nguyên từ `apply-ai-edit.ts`).
  - `packages/core/src/ai/ai-edit-relations.ts` (287, mới): `translateRelationEdit`.
  - `packages/core/src/ai/ai-edit-relations.test.ts` (651, mới): 25 test.
  - `packages/core/src/ai/index.ts` (sửa).
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/ai/ai-edit-relations.test.ts`: đỏ trước khi cài đặt (25 failed); sau đó `pnpm --filter @schemaforge/core exec vitest run src/ai/`: 342 passed.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3001 passed, build, prettier); coverage dòng của core 97,48%, không có dòng "does not meet global threshold".
  - `packages/core/dist/ai/index.d.ts` có `applyAiEdit`, `buildAiFindings`, `buildAiSampleDataset`.
  - `pnpm typecheck` ở root: 8/8 task thành công (không consumer nào vỡ).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Tách `apply-ai-edit.ts` theo quyết định của orchestrator: `ai-edit-resolve.ts` (hàm tra tên, lỗi dùng chung, kèm type `AiEditContext`, `Translation` để `ai-edit-relations.ts` không import vòng từ `apply-ai-edit.ts`), `ai-edit-relations.ts` (ba tool quan hệ). Lý do: file vượt 300 dòng của `code-quality.md`.
  - Thêm file thứ ba `ai-edit-tables.ts` (ngoài danh sách orchestrator nêu): chỉ tách hai file thì `apply-ai-edit.ts` vẫn khoảng 370 dòng, không đạt điều kiện "mọi file dưới khoảng 300 dòng". Code chuyển nguyên, không đổi hành vi.
  - `at` của quan hệ: `relations.<from>(<fromColumns>)-><to>` khi có `fromColumns` (tên như model viết), không có thì `relations.<from>-><to>` (bỏ ngoặc). Lý do: plan ghi `relations.<from>(…)-><to>`, ngoặc rỗng dễ đọc nhầm là "không cột".
  - `relation-not-found`, `relation-ambiguous` có `path: []`: quan hệ được xác định bởi cả input, không có một trường riêng.
  - `relation-columns-mismatch` có `path: ["fromColumns"]` cả khi so với `toColumns` lẫn khi so với khóa chính bảng đích.
  - Lỗi của `buildRelation`, `buildManyToMany` giữ `code`, `path` của builder; `at` là bảng khi đường dẫn chỉ vào bảng (`fromTableId`, `leftTableId` → bảng nguồn; `toTableId`, `rightTableId` → bảng đích, ví dụ `primary-key-missing` tại `tables.notes`), ngược lại là `at` của quan hệ. Lý do: model chỉ thấy `code` và `at` (AI-R16), nên `at` phải chỉ đúng bảng thiếu khóa chính.
  - Tên bảng (`fromTable`, `toTable`) dịch tuần tự, dừng ở lỗi đầu như Task 4; danh sách cột (`fromColumns`, `toColumns`) gom mọi lỗi.
  - `manyToMany` bỏ qua `fromColumns`, `toColumns`, `onDelete`, `onUpdate` vì `buildManyToMany` không nhận chúng và spec chỉ định ánh xạ sang `buildManyToMany`; không thêm mã lỗi mới.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Test quan hệ ở `ai-edit-relations.test.ts` (không ở `apply-ai-edit.test.ts` vì file đó đã 861 dòng); test đi qua `applyAiEdit`, so operation với kết quả của `buildRelation`, `buildManyToMany` dùng cùng `createCounterIdGenerator`.
  - Task 9 (property test) dùng `applyAiEdit` qua đường dẫn tương đối hoặc `./index.js`; `AiEditContext` giờ khai báo ở `ai-edit-resolve.ts` và được re-export từ `apply-ai-edit.ts`.
  - Task 16 lưu ý: `manyToMany` với `fromColumns` hay `onDelete` không báo lỗi mà bỏ qua; chỉ dẫn hệ thống có thể nói rõ điều này.
