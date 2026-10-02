# Task 11: Đồ thị quan hệ và tên trường quan hệ

- Plan: [Task 11](../../plans/2026-09-15-code-generators-plan.md#task-11-đồ-thị-quan-hệ-và-tên-trường-quan-hệ)
- Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md), mục 4 ("Phát hiện vòng cascade trên SQL Server", Vấn đề 4), mục 5 ("Tên trường quan hệ"), CG-01 bước 4, CG-08 ("Sinh giá trị xác định")

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Tạo `relation-graph.ts`: `ReferencedKey`, `findReferencedKey` (khóa chính → cột `isUnique` → index unique đầu tiên theo `sortIndexes`, so như tập cùng kích thước), `orderColumnPairsByReferencedKey`, `findCascadeConflicts` (bỏ `noAction`/`restrict`; xung đột khi tự tham chiếu hoặc một tổ tiên của `toTableId` đã đi tới một hậu duệ của `fromTableId`), `LoadOrder`, `buildLoadOrder` (SCC Kosaraju lặp hai lượt, Kahn chọn bảng sẵn sàng đầu tiên theo `sortTables`), `propagateSkippedTables`. Mọi phép duyệt đồ thị dùng ngăn xếp tường minh.
  - Tạo `relation-field-names.ts`: `allocateModelNames`, `RelationFieldNames`, `buildRelationFieldNames`.
  - TDD: RED là `Cannot find module './relation-graph.js'` và `'./relation-field-names.js'`; GREEN 33 test của hai file.
- **File thay đổi**
  - `packages/core/src/generators/shared/relation-graph.ts`, `relation-graph.test.ts`
  - `packages/core/src/generators/shared/relation-field-names.ts`, `relation-field-names.test.ts`
  - Không sửa barrel, `src/index.ts` hay `package.json` (file `shared/` là nội bộ).
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/generators/shared/relation-graph.test.ts` → PASS; tương tự cho `relation-field-names.test.ts` → PASS.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 1183/1183, coverage dòng 98%, build, prettier).
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Không dùng lại `validation/column-uniqueness.ts`: hàm đó chỉ trả boolean, còn Task 11 cần biết loại khóa và thứ tự cột; sửa file của phần 2 nằm ngoài phạm vi.
  - `propagateSkippedTables` trả kết quả theo `sortTables` (bỏ id không có trong schema), nên `buildLoadOrder` dùng thẳng làm `skippedTableIds`.
  - Fallback tên trường là `field` cho cả trường cột, phía khóa ngoại và phía ngược (plan chỉ ghi fallback cho trường cột).
  - Hậu tố `_id`, ` id`, `Id` so phân biệt hoa thường đúng như spec (`user_ID` không bị bỏ hậu tố).
  - `buildRelationFieldNames` throw `RangeError` khi `tableModelNames` thiếu bảng nguồn của quan hệ cần tên: lỗi lập trình, không âm thầm sinh `_field`.
  - Thêm test ngoài danh sách plan: `drops a deferred relation that touches a skipped table` (quy tắc bước 5) và `throws when a table has no model name`.
  - Kahn quét O(n²) tìm bảng sẵn sàng kế tiếp (có comment `ponytail:`); đủ cho cỡ schema hiện tại.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `relation-graph.ts` dài khoảng 340 dòng sau Prettier, hơi quá mốc 300; plan cố định hai file nên chưa tách. Nếu cần tách, phần SCC/Kahn có thể sang file riêng (cần orchestrator giao).
  - Task 13, 17, 18, 21 import trực tiếp từ `generators/shared/relation-graph.js` và `relation-field-names.js`.
