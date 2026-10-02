# Sửa generator theo kết quả probe MySQL 8.4

Liên quan: Task 8 (probe) trong [plan code generators](../../plans/2026-09-15-code-generators-plan.md); spec [code generators](../../specs/2026-09-14-code-generators-design.md) (R12, Vấn đề 7). Việc ngoài plan, do orchestrator giao trước Task 15, 18, 22.

## 2026-10-02 19:55 — core-engineer — Xong

- **Đã làm**
  - So định danh MySQL đổi từ `caseAndAccentInsensitive` sang `caseInsensitive` (phân biệt dấu) trong `allocateMysqlNames` và `allocateConstraintNames`. Probe mysql:8.4.11 cho thấy `ma`/`má`, `đ/d`, `ø/o`, `ł/l`, `ħ/h`, `ß/s`, `ð/d` là tên khác nhau; chỉ `ma`/`MA` bị lỗi 1060.
  - Xóa `caseAndAccentInsensitive`, bảng `STROKE_LETTER_FOLDS` (R12) và các test của chúng trong `name-allocator.ts` vì không còn ai dùng. `removeCombiningMarks` vẫn được `identifiers.ts` dùng nên giữ lại.
  - `formatSqlLiteral`: với `timestamptz` trên dialect `mysql`, đổi đuôi `Z` hoặc `-00:00` thành `+00:00` trước khi cắt phần lẻ giây. PostgreSQL và SQL Server giữ nguyên.
  - Export `resolveForeignKeyActions` (đổi tên từ `resolveActions` private) trong `shared/sql-ddl-model.ts`; Prisma gọi nó với `context.sql` rồi ánh xạ qua `PRISMA_ACTIONS`; xóa bản sao trong `prisma-relation-fields.ts`.
  - Theo yêu cầu bổ sung của orchestrator: rebase lên master (`6006957`, có Task 22 seed và Task 8), thêm test seed MySQL `timestamptz` không bao giờ kết thúc bằng `Z`. Rebase làm không qua `git stash` (stash dùng chung giữa các worktree): lưu diff ra patch trong scratchpad, `checkout`, `rebase master`, `apply` lại.
  - Grep mọi nơi gọi trước khi sửa: `allocateMysqlNames` (`sql-ddl-model-context.ts`, `seed/serialize-seed-dataset.ts`), `formatSqlLiteral` (`sql-literals.ts`, `seed/seed-sql-values.ts`), `caseAndAccentInsensitive` (chỉ hai file trên), `resolveActions` (hai bản). Không có consumer ngoài core.
- **File thay đổi**
  - `packages/core/src/generators/shared/name-allocator.ts`, `name-allocator.test.ts`
  - `packages/core/src/generators/shared/mysql-identifiers.ts`, `mysql-identifiers.test.ts`
  - `packages/core/src/generators/shared/constraint-names.ts`, `constraint-names.test.ts`
  - `packages/core/src/generators/shared/sql-literals.ts`, `sql-literals.test.ts`
  - `packages/core/src/generators/shared/sql-ddl-model.ts`, `sql-ddl-model.test.ts`
  - `packages/core/src/generators/prisma/prisma-relation-fields.ts`, `generate-prisma.test.ts`
  - `packages/core/src/generators/seed/generate-seed.test.ts`, `serialize-seed-dataset.test.ts` (chỉ test, không sửa logic seed)
  - Snapshot (đã đọc lại từng diff):
    - `__snapshots__/postgresql/naming-edge.sql`: `"người dùng_má_key_2"` thành `"người dùng_má_key"`; tên ràng buộc chỉ khác dấu không còn bị coi là trùng.
    - `__snapshots__/prisma/naming-edge.mysql.prisma`: `@map("má_2")` thành `@map("má")`; cột `má` không còn bị đổi tên trên MySQL.
    - `__snapshots__/prisma/naming-edge.mysql.diagnostics.txt`: bỏ `identifier-collision-renamed ["columns","col_8","name"]`, cùng lý do.
    - `__snapshots__/seed/naming-edge.mysql.sql`: cột `` `má_2` `` thành `` `má` `` trong INSERT, cùng lý do.
    - `__snapshots__/seed/sample.mysql.sql`, `__snapshots__/seed/target-limit.mysql.sql`: giá trị `timestamptz` `…Z'` thành `…+00:00'`; cột `timestamp` (không tz) không đổi.
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core src/generators/shared/mysql-identifiers.test.ts` báo `Tests  9 failed | 4 passed (13)`; `constraint-names.test.ts`: `1 failed | 21 passed (22)`; `sql-literals.test.ts`: `3 failed | 78 passed (81)`; `seed/generate-seed.test.ts`: `1 failed | 23 passed (24)`.
  - GREEN: `.claude/scripts/verify.sh core --build --format` cho `RESULT: PASS`, `Tests  2061 passed (2061)`, line coverage 98.06%.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Đổi tên `resolveActions` thành `resolveForeignKeyActions` khi export, vì tên chung chung không rõ nghĩa khi nhìn từ file khác. Hàm vẫn nhận `SqlDdlContext`; Prisma truyền `context.sql`, vốn được tạo với `dialect = provider`, nên kết quả không đổi (snapshot Prisma postgresql và sqlserver không đổi).
  - Viết lại test của `mysql-identifiers` trên các cặp chỉ khác hoa thường. Tên index trong fixture được chọn sao cho tên biến thể đứng sau theo `sortIndexes` (sắp theo tên: `IX` < `ix` < `íx`).
  - Ba test cũ mã hóa đúng hành vi cũ (Prisma `má_2`, DDL model `má_2`/`réf_2`, seed `má_2`) được đổi sang cặp `ma`/`MA` để vẫn kiểm tra đường đổi tên.
  - Rewrite offset chỉ áp cho `timestamptz`: chỉ kiểu này có offset theo `default-literals.ts` (mẫu chỉ nhận `Z` hoa).
  - `naming-edge-schema.test.ts` vẫn giữ cặp cột chỉ khác dấu; fixture này giờ kiểm tra trường hợp "không đổi tên".
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Spec (R12, Vấn đề 7, bảng mã `identifier-collision-renamed` mục 4) vẫn mô tả so không phân biệt dấu; spec-writer đang sửa song song. Agent này không sửa `document/specs` hay `document/plans`.
  - Task 15 (MySQL DDL) và 18 (Drizzle) dùng `allocateMysqlNames`, `allocateConstraintNames` và `formatSqlLiteral`, nên sẽ nhận các quy tắc mới mà không cần sửa thêm.
