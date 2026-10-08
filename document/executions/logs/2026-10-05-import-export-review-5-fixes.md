# Sửa theo review 5 của Task 12 (importer SQL)

Không thuộc task riêng trong plan; sửa các phát hiện của [review 5](2026-10-05-import-export-review-5.md) cho Task 12 trong [plan phần 7](../../plans/2026-10-03-import-export-plan.md), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md) (bản sửa lần 2, [log](2026-10-05-import-export-spec-amendment-2.md)).

## 2026-10-08 20:40 — core-engineer — Xong

- **Đã làm**
  - Agent trước (dừng vì lỗi API, không để lại log) đã làm phần lớn trong worktree `agent-a6065ce83187832be`; lần chạy này kiểm tra lại từng phát hiện, hoàn tất F4 và dọn code.
  - F1: `readSqlTableDefinition` đọc phần tử `[FULLTEXT | SPATIAL] KEY | INDEX [n] (…)` của MySQL thành `keys`; `classifyTableKey` báo `index-option-dropped` (độ dài tiền tố, `DESC`) và `index-type-dropped` (`FULLTEXT`, `SPATIAL`), vị trí tại bảng như ràng buộc `UNIQUE` trong `CREATE TABLE`. Fixture `mysqldump` thêm bốn khóa như vậy.
  - F2: `findStatementsOnMissingTables` (`sql-missing-tables.ts`) che câu `ALTER TABLE` dành cho parser mà bảng đích hoặc bảng sau `REFERENCES` không có `CREATE TABLE`; `import-sql.ts` báo `reference-not-found` tại câu lệnh. Test cho khóa ngoại tới bảng không có (PostgreSQL, MySQL, SQL Server), `PRIMARY KEY`/`UNIQUE`/khóa ngoại trên bảng không có, `CREATE INDEX` trên bảng không có, và test ghi lại hạn chế đã biết (5) (`syntax-error` tại 1:2).
  - F3: `isAutoIncrementIndex` chỉ bỏ `KEY <t>_<c>_idx` khi không khóa nào khác (khóa chính, cột unique, index khác) bắt đầu bằng cột đó (`hasOtherKeyStartingWith`), khớp `findAutoIncrementIndexColumnIds`.
  - F4: tách `resolveScannerStatements` (`applyColumnChanges`, `applyDescriptions`), `translateColumn` (`sql-draft-column-codes.ts`: `translateDefault`, `reportColumnCodes`), `draftParsedSql` (`readScannerParts`, `selectParserStatements`, `toParserSource`); `sql-draft-columns.ts` còn 267 dòng. Lần này tách thêm `sql-table-keys.ts` (ràng buộc `UNIQUE`, khóa MySQL trong `CREATE TABLE`, `readAddedUniqueConstraint`) khỏi `sql-column-definitions.ts` (400 → 266 dòng), chuyển test `readAddedUniqueConstraint` sang `sql-table-keys.test.ts`. Không còn hàm nào trong `importers/sql` và `importers/shared` quá 40 dòng.
  - N1: `SqlElementLocations.foreignKey` và `.check` đặt diagnostic của quan hệ và CHECK tại câu `ALTER TABLE … ADD [CONSTRAINT n] FOREIGN KEY | CHECK` chứa chúng (CHECK theo tên ràng buộc), không có thì tại bảng.
  - N2: comment về enum SQL Server ở `import-sql.roundtrip.test.ts` chuyển về trên `CASES`.
  - B: loại câu `sqlserverAddDefault`; `readSqlServerAddDefault` (`sqlserver-add-default.ts`) đọc `ALTER TABLE t [WITH CHECK|NOCHECK] ADD [CONSTRAINT n] DEFAULT <biểu thức> FOR c` thành `ColumnChange` dùng chung với `ALTER COLUMN … SET DEFAULT` của PostgreSQL, giá trị qua `mapSqlDefault`; đích không có hoặc câu không đọc được thì `statement-not-supported`. Fixture SSMS thêm `ADD DEFAULT ((0)) FOR [Total]`, `CreatedAt` có `currentTimestamp`.
  - Bỏ alias `PostgresqlAlterColumn`, dùng thẳng `ColumnChange`; `tokensText` chuyển sang `sql-token-reading.ts` để hai reader dùng chung.
- **File thay đổi** (tất cả trong `packages/core/src/importers/sql/`)
  - Sửa: `classify-statement.ts`, `classify-statement.test.ts`, `fixtures/mysqldump.fixture.ts`, `fixtures/ssms-script.fixture.ts`, `import-sql.ts`, `import-sql.test.ts`, `import-sql.roundtrip.test.ts`, `postgresql-identity.ts`, `postgresql-identity.test.ts`, `sql-column-definitions.ts`, `sql-column-definitions.test.ts`, `sql-draft.ts`, `sql-draft.test.ts`, `sql-draft-columns.ts`, `sql-draft-context.ts`, `sql-draft-index-rules.ts`, `sql-draft-indexes.ts`, `sql-draft-overrides.ts`, `sql-draft-relations.ts`, `sql-element-locations.ts`, `sql-parser-source.ts`, `sql-token-reading.ts`.
  - Mới: `sql-draft-column-codes.ts`, `sql-missing-tables.ts`, `sql-table-keys.ts`, `sql-table-keys.test.ts`, `sqlserver-add-default.ts`, `sqlserver-add-default.test.ts`.
  - Log này. Không đụng `statement-scanner.ts`, `sql-lexer.ts`.
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test, build, prettier đều PASS; `Tests 4569 passed (4569)`; coverage dòng 97,96% (statement 97,89%); `RESULT: PASS`, thoát mã 0.
  - Coverage các file mới của `importers/sql`: 100% statement.
  - `grep -rlE "from ['\"]@dbml/core|import\(['\"]@dbml/core" packages/core/dist --include='*.js'`: chỉ `dist/importers/shared/dbml-core-adapter.js`.
  - `.claude/scripts/secret-scan.sh`: xem báo cáo.
  - Bằng chứng RED của agent trước không được ghi lại (không có log); các test mới phụ thuộc hành vi mới (loại `sqlserverAddDefault`, `keys`, `foreignKey`/`check` của locations) không có ở commit gốc `6ed65ca`.
- **Quyết định**
  - Khóa MySQL trong `CREATE TABLE` đặt diagnostic tại bảng: cùng cách với ràng buộc `UNIQUE` trong `CREATE TABLE`, spec không đòi vị trí phần tử.
  - `hasOtherKeyStartingWith` tính cả cột `isUnique`: CG-01 tính `uniqueColumn` trong `keptKeys` khi quyết định ghi index `AUTO_INCREMENT`.
  - Che mọi câu `ALTER TABLE` dành cho parser trên bảng không có (kể cả `ADD CHECK`, SQL Server `ADD <cột>`), không chỉ khóa: parser không có chỗ gắn chúng, và mỗi câu vẫn có `reference-not-found`.
  - CHECK không tên thêm qua `ALTER TABLE` vẫn đặt tại bảng: không có cách khớp an toàn với CHECK của parser khi không có tên.
  - `ADD DEFAULT … FOR` dùng chung `ColumnChange` với `SET DEFAULT` của PostgreSQL: cùng một thay đổi cột, cùng đường áp dụng và báo lỗi.
  - Tách `sql-table-keys.ts` dù review chỉ nêu `sql-draft-columns.ts`: `sql-column-definitions.ts` đã vượt 300 dòng sau F1.
- **Việc còn lại**: không (A — dòng lệnh meta của psql — là task riêng sau khi merge bản sửa bảo mật của `statement-scanner.ts`).
- **Ghi chú cho người tiếp theo**
  - Nhánh dựa trên `6ed65ca`, chưa có `8d8644e` (SF1) của `master`; khi merge sẽ xung đột ở `import-sql.ts` (đoạn `parseSql`), giữ cả giới hạn chi phí của SF1 lẫn `selectParserStatements`/`toParserSource`.
  - Lint ở cây chính hỏng do `eslint.config.mjs` có bản sửa chưa commit của người dùng; lint trong worktree này dùng bản đã commit và pass.
