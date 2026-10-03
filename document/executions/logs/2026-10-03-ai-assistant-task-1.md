# Core `diffSchemas`

- Plan: [Task 1](../../plans/2026-10-03-ai-assistant-plan.md) (mục "Task 1: Core `diffSchemas`")
- Spec: [ai-assistant-design](../../specs/2026-10-02-ai-assistant-design.md) (mục 7 "Diff trong core", AI-R32)

## 2026-10-03 19:20 — core-engineer — Xong

- **Đã làm**: thêm `diffSchemas(before, after): SchemaDiff` cùng type `SchemaDiff`, `ElementChanges` ở entry chính của core. So theo id cho `tables`, `columns`, `relations`, `indexes`, `enums`; bỏ qua subject area và ghi chú; bảng bỏ qua `position` và `columnIds` nhưng vẫn `changed` khi thứ tự tương đối của các cột có ở cả hai bên đổi. TDD: viết `diff-schemas.test.ts` trước (đỏ vì chưa có module), cài đặt (xanh); thêm `"diffSchemas"` vào danh sách export của `index.test.ts` (đỏ: thiếu `diffSchemas`), thêm export (xanh).
- **File thay đổi**:
  - `packages/core/src/diff/diff-schemas.ts` (tạo)
  - `packages/core/src/diff/diff-schemas.test.ts` (tạo, 17 test)
  - `packages/core/src/index.ts` (export `diffSchemas`, type `SchemaDiff`, `ElementChanges`)
  - `packages/core/src/index.test.ts` (thêm `diffSchemas` vào danh sách export lúc chạy)
- **Kiểm tra**:
  - Đỏ: `.claude/scripts/test-file.sh core packages/core/src/diff/diff-schemas.test.ts` → `Cannot find module './diff-schemas.js'`; `.claude/scripts/test-file.sh core packages/core/src/index.test.ts` → `AssertionError` thiếu `"diffSchemas"`.
  - Xanh: hai lệnh trên → `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS`; 2659 test pass; coverage dòng 97.64% (`diff-schemas.ts` 100% dòng).
  - `pnpm typecheck` ở root sau khi build core → 8/8 task thành công (frontend, backend không vỡ).
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**:
  - Dùng lại `isJsonEqual` của `src/operations/json-equal.ts` (plan yêu cầu không viết hàm so sánh thứ hai).
  - Bỏ qua `position` và `columnIds` của bảng bằng cách gán cả hai về `null` ở hai bên trước khi so: chỉ bảng có `position` trong năm loại phần tử được so, nên không cần hàm bỏ trường tổng quát.
  - Thứ tự cột: `sortTables` của tài liệu tương ứng rồi thứ tự trong `columnIds`; `added`, `changed` theo `after`, `removed` theo `before` (đúng plan).
  - Độ phức tạp O(n log n) do sắp xếp (plan ghi O(n log n); spec ghi O(n) — theo plan vì thứ tự xác định cần sắp xếp).
  - Thêm 3 test ngoài danh sách tối thiểu: bỏ qua subject area và ghi chú, thứ tự cột theo bảng rồi vị trí trong bảng, `removed` theo thứ tự của `before` — để mỗi quy tắc trong "Chữ ký và hành vi" có test riêng.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: nhánh `column === undefined` trong `sortColumns` là phòng thủ (bất biến cấu trúc bảo đảm mọi id trong `columnIds` có cột), nên không có test riêng; coverage nhánh của file là 83.33%. Spec mục 7 ghi "O(n)", plan ghi "O(n log n)"; nếu cần, spec-writer sửa spec cho khớp.
