# Task 15: CG-01 SQL DDL cho MySQL

- Plan: [Task 15](../../plans/2026-09-15-code-generators-plan.md#task-15-cg-01-sql-ddl-cho-mysql)
- Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md), CG-01, mục 3 ("SQL", cột MySQL), mục 4 (danh mục mã, ma trận), mục "Rủi ro", R20

## 2026-10-02 21:30 — core-engineer — Xong

- **Đã làm**
  - Tạo `@schemaforge/core/generators/mysql`: `generateMysql` (khai báo `const generateMysql: Generate<"mysql">`, gọi với `{}`), type `MysqlOptions`, và `renderMysqlType` (nội bộ, không export qua `index.ts`).
  - Generator chỉ in `SqlDdlModel` của `buildSqlDdlModel(schema, "mysql")`: mỗi bảng một `CREATE TABLE` (cột: kiểu, `AUTO_INCREMENT`, `NOT NULL`, `DEFAULT`, `COMMENT`; `PRIMARY KEY (…)` không tên; `CONSTRAINT … UNIQUE (…)`; đuôi `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci` và `COMMENT='…'` khi có), rồi index, rồi khóa ngoại `ALTER TABLE`. Không có block comment, `CREATE TYPE`, `DROP`, `BEGIN`, `COMMIT`.
  - Import `REFERENTIAL_ACTION_SQL` từ `shared/sql-referential-actions.ts`, `quoteSqlIdentifier`, `sqlStringLiteral`, `renderFileContent`; không viết lại hàm dùng chung nào.
  - Test nhắm từng quy tắc của plan, cộng snapshot cho 4 fixture.
- **File thay đổi**
  - Tạo: `packages/core/src/generators/mysql/{index.ts,generate-mysql.ts,generate-mysql.test.ts,render-mysql-type.ts,render-mysql-type.test.ts}`
  - Snapshot tạo mới (đã đọc lại, đối chiếu spec): `packages/core/src/generators/__snapshots__/mysql/{sample,naming-edge,target-limit,empty}.sql` và `.diagnostics.txt` tương ứng.
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core src/generators/mysql/render-mysql-type.test.ts` và `generate-mysql.test.ts` fail với `Cannot find module './render-mysql-type.js'` / `'./generate-mysql.js'`.
  - GREEN: hai file trên `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS`, `Tests  2245 passed (2245)`, line coverage 98.11%, không có dòng threshold.
  - Từ `backend/`: `node --input-type=module -e '…import("@schemaforge/core/generators/mysql")…'` in `function schema.sql generateMysql`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
  - Conformance MySQL (`packages/codegen-conformance/src/mysql.test.ts`) chưa tồn tại (Task 29), nên không chạy.
- **Quyết định**
  - Test `renames a column that differs only by an accent…` của plan đổi thành `renames a column that differs only by case…` (`ma`/`MA` → `MA_2`), thêm `keeps columns that differ only by an accent` (`ma`/`má` giữ nguyên). Lý do: R20, MySQL so định danh `caseInsensitive`.
  - Test `wraps literal defaults of LONGTEXT, JSON and LONGBLOB…` chỉ kiểm `LONGTEXT` và `JSON`: phần 2 không cho literal mặc định trên `binary` (`incompatible`), nên `LONGBLOB` không bao giờ có literal.
  - Thêm test `writes a UTC timestamptz default with a +00:00 offset` (R20), `writes an enum column as ENUM with its values`, `writes restrict as RESTRICT` (ma trận mục 4), `falls back to LONGTEXT for a missing enum`.
  - Bảng không có cột (đã là issue `table-columns-empty` của phần 2) in `CREATE TABLE \`t\` () ENGINE=…;` như mẫu PostgreSQL; output vẫn sinh khi schema có issue.
  - Kiểu `smallint`, `bigint`, `double`, `boolean`, `date`, `json` in bằng `kind.toUpperCase()` thay vì 6 chuỗi riêng; test `it.each` ghim từng kiểu.
- **Việc còn lại**: không có trong Task 15. Task 29 viết `packages/codegen-conformance/src/mysql.test.ts`.
- **Ghi chú cho người tiếp theo**
  - Snapshot `sample.sql` có cột `geometry(Point, 4326)` nguyên văn; conformance phải thay bằng `YEAR` (spec mục 7) trước khi chạy trên MySQL.
  - Comment bảng của `naming-edge` chứa xuống dòng và `-- ; DROP TABLE x` bên trong literal; đó là dữ liệu fixture, đã escape đúng.
  - Shell của agent cô lập worktree chặn lệnh `git` trần (hook `rtk` viết lại lệnh); `/usr/bin/git -C <worktree> status --porcelain` chạy được và chỉ liệt kê `packages/core/src/generators/mysql/`, `__snapshots__/mysql/` và file log này.
