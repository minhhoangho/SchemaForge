# Task 11: Phần scanner tự đọc của SQL

[Plan Task 11](../../plans/2026-10-03-import-export-plan.md#task-11-phần-scanner-tự-đọc-của-sql) · [Spec mục 5](../../specs/2026-09-15-import-export-design.md#5-ie-01-import-sql)

## 2026-10-05 20:05 — core-engineer — Xong

- **Đã làm**
  - `classify-statement.ts`: PostgreSQL, MySQL `ALTER TABLE … ADD COLUMN`, `ADD <định danh không phải từ khóa ràng buộc>` (kể cả `ADD IF NOT EXISTS c`) và MySQL `ADD (…)` thành `unsupported`; MySQL `ADD UNIQUE …`, `ADD CONSTRAINT [n] UNIQUE …` thành `unsupported`; SQL Server `ADD <cột>` và mọi `ADD PRIMARY KEY | FOREIGN KEY | CHECK | CONSTRAINT …` khác vẫn là `parser`.
  - Tách các hàm đọc token chung (`wordAt`, `isSymbolAt`, `isNameAt`, `readQualifiedName`, `findAlterTableAction`, thêm `findOpenParenthesis`, `readParenthesizedList`) từ `classify-statement.ts` sang file mới `sql-token-reading.ts` (theo phép tách file đã duyệt trước: `classify-statement.ts` thêm quy tắc `ADD` sẽ vượt khoảng 300 dòng, và năm reader mới dùng chung các hàm này). Không test riêng; test của `classifyStatement` và các reader phủ đủ. `findAlterTableAction` trả thêm `tableName`.
  - `postgresql-identity.ts`: `readPostgresqlAlterColumn`.
  - `sqlserver-extended-property.ts`: `readSqlServerDescription`.
  - `check-to-enum.ts`: `readCheckEnumValues`.
  - `sql-index-definitions.ts`: `readSqlIndexDefinition`, cùng `readIndexElements` (đọc danh sách cột của index và của ràng buộc `UNIQUE`, dùng chung với `sql-column-definitions.ts`).
  - `sql-column-definitions.ts`: `readSqlTableDefinition`, `readAddedUniqueConstraint`, hằng `COLUMN_CONSTRAINT_WORDS`.
  - Test cũ của `classify-statement.test.ts` ghim hành vi cũ, đã đổi: trong `classifies a structure statement the parser reads`, `["postgresql", "ALTER TABLE IF EXISTS t ADD COLUMN a int"]` thay bằng `ALTER TABLE IF EXISTS t ADD CONSTRAINT u UNIQUE (a, b)`, và `["mysql", "ALTER TABLE \`t\` ADD UNIQUE KEY \`u\` (\`a\`)"]` thay bằng `ALTER TABLE \`t\` ADD KEY \`k\` (\`a\`)`; hai câu cũ nay nằm trong `classifies add column on postgresql and mysql as unsupported` và `classifies a mysql add unique as unsupported`.
- **File thay đổi** (đều trong `packages/core/src/importers/sql/`)
  - Sửa: `classify-statement.ts` (269 dòng), `classify-statement.test.ts`.
  - Tạo: `sql-token-reading.ts`, `postgresql-identity.ts`, `sqlserver-extended-property.ts`, `check-to-enum.ts`, `sql-index-definitions.ts`, `sql-column-definitions.ts` và test cùng tên (trừ `sql-token-reading.ts`).
- **Kiểm tra**
  - Đỏ: `pnpm exec vitest run src/importers/sql/classify-statement.test.ts` → `Tests 12 failed | 104 passed (116)` trước khi sửa classifier; mỗi file test reader mới chạy trước khi có module → `Cannot find module './<reader>.js'`.
  - Xanh: `classify-statement` 116, `postgresql-identity` 17, `sqlserver-extended-property` 19, `check-to-enum` 27, `sql-index-definitions` 47, `sql-column-definitions` 98 test pass.
  - Thời gian tuyến tính: `CREATE TABLE` 2 340 018 ký tự, 20 000 cột: `readSqlTableDefinition` 195 ms trên bản build (scanner của Task 9 mất 1 000 ms cho cùng nguồn). Test `reads a 2 MiB create table with 20 000 columns in linear time` có timeout 5 000 ms.
  - `.claude/scripts/verify.sh core --build --format` lần 1: build, format, typecheck, lint pass; test `3 failed | 4275 passed (4278)` do ba test có sẵn quá thời gian khi máy tải rất nặng (load average ~336): `statement-scanner.test.ts > scans a 2 MiB source…`, `seed-dataset.test.ts > … very wide array`, `import-dbml.test.ts > reports too-many-elements…`. Chạy riêng ba file: `150 passed (150)`.
  - `verify.sh` lần 2 (load average ~362): typecheck, lint, build, format pass; test `1 failed | 4277 passed (4278)`, chỉ còn `import-dbml.test.ts > reports too-many-elements past the element limit` quá 60 000 ms (test có sẵn, pass khi chạy riêng). `RESULT: FAIL (core test)` vì lý do này; vitest không in bảng coverage toàn package khi có test lỗi.
  - Coverage thư mục `src/importers/sql/` (`vitest run src/importers/sql --coverage --coverage.include='src/importers/sql/**'`, 380 test): 99,34% số dòng; file mới 97,67–100%.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `readPostgresqlAlterColumn`: `raw.kind` là `string` chỉ khi biểu thức là đúng một chuỗi `'…'` (`text` là phần giữa hai dấu quote, còn escape, đúng hợp đồng `RawSqlDefault` của `mapSqlDefault`); `number`, `boolean` khi là đúng một token số, `true`/`false`; còn lại (kể cả `'a'::text`, `E'…'`, `-5`) là `expression` với toàn bộ văn bản. Lệch chữ "loại theo token đầu" của plan vì `mapSqlDefault` không bỏ được ép kiểu sau một `string`; nhánh `expression` của nó đọc lại đúng chuỗi, số, ép kiểu. Hàm không nhận `source` (chữ ký của plan), nên văn bản dựng lại từ token, khoảng giữa các token thành dấu cách (comment, xuống dòng thành dấu cách; vị trí tương đối giữ nguyên).
  - `readPostgresqlAlterColumn` trả `null` khi câu có hành động thứ hai (`, ALTER COLUMN …`) hoặc identity có phần thừa sau ngoặc tùy chọn.
  - `readSqlServerDescription`: so `@name` chính xác với `MS_Description`; `@level1type`, `@level2type` không phân biệt hoa thường; `@level2type = NULL` coi như không có; đối số không biết, lặp, đối số theo vị trí sau đối số có tên, hoặc quá 8 đối số → `null`; `@level0type` không bắt buộc.
  - `readCheckEnumValues` nhận thêm cột dạng `(cột)::text` (cách PostgreSQL in lại CHECK) và tiền tố charset MySQL `_utf8mb4'a'` (cách `SHOW CREATE TABLE` in CHECK); ép kiểu cột, giá trị có thể nhiều từ (`::character varying(20)`).
  - Phần tử cột của index và ràng buộc `UNIQUE`: tên, tùy chọn độ dài tiền tố ngay sau tên, rồi mỗi loại tùy chọn (`ASC | DESC`, `NULLS FIRST | LAST`, `COLLATE <tên>`, opclass có thể có schema) tối đa một lần; mọi dạng khác (gọi hàm, ép kiểu, hai opclass, `CASE …`) là biểu thức (`null`).
  - Ràng buộc `UNIQUE` có phần tử biểu thức (MySQL 8 `UNIQUE KEY ((lower(a)))`) hoặc dạng ngoài ngữ pháp (`UNIQUE KEY u USING BTREE (a)`, PostgreSQL `UNIQUE NULLS NOT DISTINCT (a)`) không được đọc (không có trong `uniqueConstraints`); phần sau danh sách cột của ràng buộc (`WITH (…)`, `ON [fg]`, `USING BTREE`, `INCLUDE`, `DEFERRABLE`) bị bỏ qua. Ngữ pháp nhận là hợp của hai dạng plan ghi: `UNIQUE [KEY | INDEX] [CLUSTERED | NONCLUSTERED] [n] [CLUSTERED | NONCLUSTERED] (…)`; khi có cả `CONSTRAINT c` và tên sau `UNIQUE KEY k`, tên là `k` (MySQL dùng tên index).
  - `readSqlTableDefinition` đòi `(` đứng ngay sau tên bảng (chặt hơn "cặp ngoặc đầu tiên ở độ sâu 0" của plan) để `CREATE TABLE t AS SELECT f(x)` trả `null` thay vì đọc nhầm; `readSqlIndexDefinition` dùng cặp ngoặc đầu tiên ở độ sâu 0 sau tên bảng (có `USING m` ở giữa).
  - `hasOnUpdate`: `ON UPDATE` sau `REFERENCES` chỉ là hành động khóa ngoại khi từ tiếp theo là `CASCADE`, `RESTRICT`, `SET`, `NO`; `REFERENCES u(id) ON UPDATE CURRENT_TIMESTAMP` vẫn bật `hasOnUpdate`.
  - `readSqlIndexDefinition`: đọc `INCLUDE` và `WHERE` ở độ sâu 0 sau danh sách cột; bộ lọc `IS NOT NULL` dừng ở `WITH`, `ON` hoặc hết câu.
  - Phân loại MySQL `ALTER TABLE … ADD (c int, …)` là `unsupported` (parser cũng bỏ âm thầm dạng này của `ADD COLUMN`); plan chỉ nêu `ADD COLUMN` và `ADD <định danh>`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo** (Task 12)
  - `readAddedUniqueConstraint` chỉ đọc ràng buộc đầu tiên của câu; PostgreSQL `ALTER TABLE t ADD CONSTRAINT a UNIQUE (x), ADD CONSTRAINT b UNIQUE (y)` cho ràng buộc `a` thôi.
  - `readSqlServerDescription` trả `tableName` là `@level1name` (không có schema); `@level0name` khác `dbo` không được báo ở đây.
  - Scanner của Task 9 quét 2,3 MB trong khoảng 1 s trên máy này; Task 19 (benchmark) nên đo lại.
