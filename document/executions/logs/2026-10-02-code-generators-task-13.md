# Task 13: Mô hình DDL dùng chung cho ba dialect

- Plan: [Task 13](../../plans/2026-09-15-code-generators-plan.md#task-13-mô-hình-ddl-dùng-chung-cho-ba-dialect)
- Spec: [mục 4](../../specs/2026-09-14-code-generators-design.md#4-đích-không-biểu-diễn-được-một-khái-niệm), [CG-01](../../specs/2026-09-14-code-generators-design.md#cg-01-sql-ddl)

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Viết test trước (`sql-ddl-model.test.ts`, `sql-ddl-model-comments.test.ts`), chạy thấy đỏ vì chưa có module (`Cannot find module './sql-ddl-model.js'`, `'./sql-ddl-model-comments.js'`), rồi cài đặt tới khi xanh.
  - `buildSqlDdlModel(schema, dialect)` theo đúng 6 bước của plan: kiểu qua `resolveSchemaColumnTypes`, ràng buộc bị bỏ qua `findUnindexableConstraints(schema, dialect, types.types)`, tên qua `allocateConstraintNames` (cặp cột theo `orderColumnPairsByReferencedKey`), MySQL `allocateMysqlNames`, SQL Server `findCascadeConflicts`. Tên cột ghi ra luôn qua một hàm `columnName` duy nhất trong context.
  - Enum theo `sortEnums` (PostgreSQL bỏ U+0000 kèm `null-character-removed` tại `["enums", id, "values", i]`); bảng theo `sortTables`; index người dùng → index lọc từ cột `isUnique` (SQL Server) → index thay thế `AUTO_INCREMENT` (MySQL); khóa ngoại theo `sortRelations`.
  - `truncateCodePoints`, `truncateUtf16CodeUnits` và `resolveSqlComment` (MySQL 1024/2048 code point, SQL Server 3750 code unit không tách cặp surrogate, PostgreSQL bỏ U+0000).
- **File thay đổi** (đều mới, trong `packages/core/src/generators/shared/`)
  - `sql-ddl-model.ts`: type `SqlDdlModel`, `SqlEnumModel`, `SqlForeignKeyModel`, re-export type bảng và index, enum, khóa ngoại, `buildSqlDdlModel`.
  - `sql-ddl-model-context.ts`: `SqlDdlContext`, `Diagnosed`, `columnNamesOf`, `createSqlDdlContext`.
  - `sql-ddl-model-tables.ts`: type `SqlColumnModel`, `SqlUniqueModel`, `SqlEnumCheckModel`, `SqlTableModel`, `SqlIndexModel`; cột, khóa chính, unique, CHECK enum.
  - `sql-ddl-model-indexes.ts`: index người dùng và index thay thế `AUTO_INCREMENT`.
  - `sql-ddl-model-comments.ts`, `sql-ddl-model-comments.test.ts`, `sql-ddl-model.test.ts`.
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core …/sql-ddl-model.test.ts` và `…/sql-ddl-model-comments.test.ts`: PASS.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test (95 file, 1421 test pass, coverage dòng 98,04%), build, prettier đều PASS; `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Tách thành 5 file code vì bản đầu vượt 300 dòng (plan cho phép `sql-ddl-model-<phần>.ts`). Type công khai vẫn import được từ `sql-ddl-model.ts` như chữ ký của plan; tránh import vòng (`import-x/no-cycle`) bằng file context riêng.
  - File `-context`, `-tables`, `-indexes` được test qua `buildSqlDdlModel` (API công khai của task), không có file test riêng; `-comments` có test riêng vì export hàm thuần.
  - `SqlDdlModel.enums` có cho cả ba dialect (MySQL cần giá trị để ghi `ENUM(…)` trên cột); chỉ PostgreSQL bỏ U+0000.
  - Kiểu `enumChecks` đặt tên là `SqlEnumCheckModel` thay cho type inline trong plan, cùng hình dạng.
  - Index lọc sinh từ cột `isUnique` dùng chính tên ràng buộc `<bảng>_<cột>_key`, `filterColumnNames` là chính cột đó.
  - Cột `custom` không an toàn đổi thành `{ kind: "text" }` trước khi chọn bọc ngoặc giá trị mặc định MySQL, nên giá trị mặc định của nó cũng được bọc (khớp `LONGTEXT`).
  - `truncateCodePoints` đếm code point bằng `for…of` (lint cấm spread chuỗi); cắt theo code point, không theo grapheme, đúng cách MySQL đếm ký tự.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `findCascadeConflicts(schema)` được gọi trên mọi quan hệ như plan ghi, kể cả quan hệ SQL Server sẽ bỏ vì `key-column-type-not-indexable`; một quan hệ bị bỏ vẫn có thể làm quan hệ cascade khác bị hạ. Trường hợp hiếm, chưa sửa; cần thì đổi ở Task 11 hoặc ở đây sau khi orchestrator quyết định.
  - PostgreSQL bỏ U+0000 khỏi giá trị enum có thể làm hai giá trị trùng nhau (`"a\u0000"` và `"a"`), khiến `CREATE TYPE` lỗi; không có diagnostic riêng cho trường hợp này.
  - Task 14, 15, 16 chỉ cần in cú pháp từ `SqlDdlModel`; `defaultSql` đã quote, escape theo dialect, còn tên, comment, giá trị enum vẫn phải qua hàm quote của dialect khi in.
