# Task 16: CG-01 SQL DDL cho SQL Server

- Plan: [Task 16](../../plans/2026-09-15-code-generators-plan.md#task-16-cg-01-sql-ddl-cho-sql-server)
- Spec: [CG-01, mục 3, mục 4](../../specs/2026-09-14-code-generators-design.md#cg-01-sql-ddl)

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Đọc kết quả probe SQL Server trong log Task 8: mọi probe khớp spec, riêng probe 3 (8 chữ số giây lẻ được nhận) không đổi quy tắc cắt về 7 chữ số của Vấn đề 8. Không có điểm nào phải dừng.
  - Viết test trước (`render-sqlserver-type.test.ts`, `generate-sqlserver.test.ts`), chạy thấy đỏ: `Error: Cannot find module './render-sqlserver-type.js'` và `Error: Cannot find module './generate-sqlserver.js'`.
  - Cài `renderSqlServerType` (bảng kiểu SQL Server của spec mục 3; enum `nvarchar(n)` qua `sqlServerEnumLength`, `null` hoặc enum không tìm thấy là `nvarchar(max)`).
  - Cài `generateSqlServer` (const `Generate<"sqlserver">`, không option): in từ `buildSqlDdlModel(schema, "sqlserver")` theo thứ tự `CREATE TABLE` (cột, khóa chính, unique, CHECK enum), index (kèm `WHERE … IS NOT NULL`), khóa ngoại, rồi block comment (`DECLARE @schema_name sysname = SCHEMA_NAME();` một lần, rồi `EXEC sys.sp_addextendedproperty` cho bảng trước cột). Thêm `type-parameter-out-of-range` tại `["columns", id, "type"]` cho cột enum có giá trị quá 4000 code unit, gộp với `model.diagnostics` bằng `finalizeDiagnostics`.
  - Tách bảng `REFERENTIAL_ACTION_SQL` từ `generate-postgresql.ts` sang `generators/shared/sql-referential-actions.ts`; PostgreSQL và SQL Server cùng import. Snapshot PostgreSQL không đổi.
  - `index.ts` chỉ export `generateSqlServer` và type `SqlServerOptions`.
  - Tạo 8 snapshot `__snapshots__/sqlserver/{sample,naming-edge,target-limit,empty}.{sql,diagnostics.txt}`, đọc lại đối chiếu spec: `NULL` tường minh, `IDENTITY(1, 1)`, `sysdatetimeoffset()`/`newid()`, CHECK enum bằng literal `N'…'`, tự tham chiếu và đường cascade thứ hai thành `NO ACTION` kèm `referential-action-cycle`, unique index lọc, comment nhiều dòng nằm gọn trong literal `N'…'`, không có `GO`, `USE`, `BEGIN`, `COMMIT`, `DROP`.
- **File thay đổi**
  - Tạo: `packages/core/src/generators/sqlserver/{index.ts,generate-sqlserver.ts,generate-sqlserver.test.ts,render-sqlserver-type.ts,render-sqlserver-type.test.ts}`
  - Tạo: `packages/core/src/generators/shared/sql-referential-actions.ts`
  - Tạo: `packages/core/src/generators/__snapshots__/sqlserver/` (8 file)
  - Sửa: `packages/core/src/generators/postgresql/generate-postgresql.ts` (import bảng hành động dùng chung)
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/generators/sqlserver/render-sqlserver-type.test.ts`: đỏ trước khi cài, `RESULT: PASS` sau.
  - `.claude/scripts/test-file.sh core src/generators/sqlserver/generate-sqlserver.test.ts`: đỏ trước khi cài, `RESULT: PASS` sau.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test (2111 test pass, 98.09% dòng), build, prettier đều PASS; `RESULT: PASS`.
  - `node --input-type=module -e '…generateSqlServer…'` (Node 24, chạy trong `backend/`): in `function schema.sql`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - **(quan trọng)** `REFERENTIAL_ACTION_SQL` chuyển sang `generators/shared/sql-referential-actions.ts` theo yêu cầu của orchestrator, thay vì chép lần hai trong `sqlserver/`. Lý do: một bảng từ khóa cho mọi dialect SQL; khác biệt dialect đã được model xử lý trước khi in. Task 15 (MySQL) nên import file này thay vì chép.
  - **(quan trọng)** Diagnostic `type-parameter-out-of-range` của enum quá dài chỉ thêm khi enum tồn tại; enum không tìm thấy ghi `nvarchar(max)` không diagnostic. Lý do: tài liệu qua `parseSchemaDocument` không có enum thiếu, và plan chỉ ghi diagnostic cho trường hợp `sqlServerEnumLength` trả `null`.
  - Bảng không cột ghi `CREATE TABLE [t] ();` như PostgreSQL. Lý do: spec mục 2 yêu cầu output an toàn, không throw; issue `table-columns-empty` của phần 2 đã báo người dùng.
  - Thêm vài test ngoài danh sách plan (`SET NULL`/`SET DEFAULT`, thứ tự comment bảng trước cột, index của người dùng trước index lọc, không `USE`/`BEGIN`/`COMMIT`/`DROP`, enum không tìm thấy). Lý do: mỗi quy tắc trong mục output của plan có test nhắm đúng.
  - Không chạy `pnpm typecheck` ở root: chỉ thêm subpath mới, không đổi export cũ, nên frontend và backend không bị ảnh hưởng.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Conformance trên SQL Server 2022 là Task 29 (`packages/codegen-conformance/src/sqlserver.test.ts`). Snapshot `sample.sql` có kiểu custom `geometry(Point, 4326)` ghi nguyên văn; helper conformance thay kiểu custom theo Vấn đề 3.
  - Trong worktree, hook chặn `source ~/.nvm/nvm.sh`; chạy Prettier bằng `/Users/hominhhoang/.nvm/versions/node/v24.21.0/bin/node node_modules/prettier/bin/prettier.cjs --write <file>`.

## 2026-10-02 — core-engineer — Xong

- **Đã làm**: orchestrator đã commit công việc (`feat(core): add sql server ddl generator`) và rebase lên master `1377870`. Master này có bản sửa R20: tên ràng buộc do generator đặt được so không phân biệt hoa thường nhưng phân biệt dấu. Sau rebase, test `matches the snapshot for naming-edge` đỏ. Diff chỉ có một dòng: `CONSTRAINT [người dùng_má_key_2]` thành `CONSTRAINT [người dùng_má_key]`, đúng kỳ vọng của R20. Đã cập nhật snapshot của riêng file này bằng `--update-snapshots` và đọc lại; `naming-edge.diagnostics.txt` không đổi.
- **File thay đổi**: `packages/core/src/generators/__snapshots__/sqlserver/naming-edge.sql`, file log này (chưa commit, orchestrator sẽ amend).
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/generators/sqlserver/generate-sqlserver.test.ts`: trước khi cập nhật thì 1 fail, 35 pass; sau khi cập nhật thì `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (2191 test pass, 98.09% dòng).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**: không có quyết định mới; thay đổi output chỉ do R20.
- **Ghi chú cho người tiếp theo**: `git diff` coi file `.sql` có tiếng Việt là file nhị phân; xem diff bằng `git diff --text`.
