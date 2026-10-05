# Task 9: Statement scanner SQL

Plan: [Task 9](../../plans/2026-10-03-import-export-plan.md#task-9-statement-scanner-sql). Spec: [2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md), mục 5 "Luồng xử lý", mục 13, mục "Rủi ro" (`DELIMITER`); Vấn đề 10 của plan.

## 2026-10-05 17:40 — core-engineer — Xong

- **Đã làm**
  - `tokenizeSql`, `scanSqlStatements`, `maskStatements` trong `statement-scanner.ts`: tokenizer một lượt trên ký tự, không regex trên input (chỉ `split(/\s+/)` trên một dòng để đọc lệnh `GO`/`DELIMITER`, và `replace(/[^\r\n]/g, " ")` khi che). Nhận biết comment `--`, `/* */` (lồng nhau với PostgreSQL), `#` (MySQL); chuỗi `'…'` với `''`, `N'…'`, `E'…'` (PostgreSQL, giải `\b \f \n \r \t`, bát phân, `\x`, `\u`, `\U`), `\` của MySQL (bảng escape của MySQL, giữ `\%`, `\_`); dollar quote `$tag$…$tag$`; định danh `"…"`, `` `…` `` (MySQL), `[…]` (SQL Server); `;` ở độ sâu 0; dòng `GO` (SQL Server); dòng `DELIMITER <chuỗi>` (MySQL, Vấn đề 10). Không bao giờ throw: chuỗi, comment, dollar quote, định danh không đóng trả `err({ offset })` tại vị trí mở.
  - `classifyStatement` trong `classify-statement.ts` theo bảng phân loại spec mục 5, bằng bảng luật theo từ khóa đầu câu.
- **File thay đổi**
  - `packages/core/src/importers/sql/statement-scanner.ts`, `statement-scanner.test.ts` (tạo)
  - `packages/core/src/importers/sql/classify-statement.ts`, `classify-statement.test.ts` (tạo)
  - `document/executions/logs/2026-10-05-import-export-task-9.md` (log này)
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core src/importers/sql/statement-scanner.test.ts` → `Error: Cannot find module './statement-scanner.js'`. Với `classify-statement`, cài đặt được viết trước khi chạy RED; bù lại bằng một đột biến tạm (`DROP` → `data`): 3 test fail, rồi hoàn nguyên.
  - GREEN: hai file test pass (131 test). Coverage số dòng: `statement-scanner.ts` 100%, `classify-statement.ts` 97,01%.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 3156 test, build, prettier); coverage số dòng toàn core 97,66%.
- **Quyết định**
  - `SqlDialect` lấy từ `generators/shared/generator-types.ts` (như Task 8 ghi); không cần kiểu nào của Task 2.
  - `end` của câu kết thúc bằng dòng `GO` là ngay sau chữ `GO` (dòng `GO` thuộc câu, là "dấu kết thúc"); dòng `GO` sau câu đã có `;` không tạo câu nào.
  - `maskStatements` che mọi ký tự **ngoài** câu được giữ (không chỉ câu bị bỏ): dòng `DELIMITER`, comment giữa các câu và `/*!40101 … */;` rỗng không tới parser; dòng `GO` của câu được giữ vẫn còn. Lý do: dòng `DELIMITER` còn lại sẽ làm parser MySQL lỗi. Vị trí dòng, cột không đổi.
  - Lệnh `DELIMITER` chỉ được nhận khi câu hiện tại chưa có token (như client `mysql`), nên cột tên `delimiter` ở đầu dòng không bị hiểu nhầm; thiếu đối số thì dòng là văn bản SQL bình thường.
  - MySQL: nội dung comment thực thi `/*!50003 … */` được đọc như SQL (MySQL chạy nó); `*/` ngoài comment bị bỏ qua. Không có điều này, trigger và view của `mysqldump` (bọc hết trong `/*!…*/`) thành câu rỗng và bị bỏ âm thầm.
  - MySQL: `"…"` là chuỗi (mặc định không có `ANSI_QUOTES`). SQL Server: `@`, `#` là ký tự đầu của word (`@level1type`, `#temp`).
  - Độ sâu ngoặc không xuống dưới 0 khi gặp `)` thừa. `)` mang độ sâu bên ngoài, giống `(`.
  - `CREATE`: tìm từ khóa đối tượng đầu tiên, chỉ bỏ qua các từ bổ nghĩa đã biết (`OR REPLACE`, `OR ALTER`, `UNIQUE`, `CLUSTERED`, `NONCLUSTERED`, `MATERIALIZED`, `DEFINER=…`, `ALGORITHM=…`, `SQL SECURITY …`…); từ lạ (ví dụ `PUBLICATION`, `TEMPORARY`) → `unsupported`. `CREATE PROC` → `routine`; `CREATE DATABASE`, `SCHEMA`, `EXTENSION` → `ignored`.
  - `ALTER … OWNER TO` → `ignored` trước mọi luật khác (kể cả `ALTER SEQUENCE … OWNER TO`). `ALTER TABLE` đọc `[IF EXISTS] [ONLY] tên [*] [WITH CHECK|NOCHECK]` rồi hành động: `ADD` → `parser`; `DISABLE|ENABLE KEYS` → `data`; `ALTER [COLUMN] c ADD GENERATED|SET DEFAULT` chỉ với PostgreSQL → `postgresqlAlterColumn`; còn lại `unsupported`.
  - `EXEC`/`EXECUTE` với tên (có schema hoặc không, có quote hoặc không) kết thúc bằng `sp_addextendedproperty` chỉ với SQL Server → `sqlserverExtendedProperty`. `SELECT [pg_catalog.]set_config(` → `ignored`; `SELECT` khác → `unsupported`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `statement-scanner.ts` dài khoảng 540 dòng sau prettier, vượt mức khoảng 300 dòng của quy ước; tách phần lexer (`lexAt` và các hàm đọc token) sang file riêng, ví dụ `importers/sql/sql-lexer.ts`, cần orchestrator giao file đó (không nằm trong "File sở hữu" của Task 9).
  - Câu chưa có trong bảng phân loại của spec nên thành `unsupported` (gây diagnostic `statement-not-supported`): `ALTER TABLE … CHECK CONSTRAINT [fk]` (SSMS ghi sau mỗi khóa ngoại), `ALTER DATABASE … SET …` (SSMS), `ROLLBACK`, `CREATE UNLOGGED TABLE`, `CREATE TEMPORARY TABLE`. Task 12 cần quyết định có thêm vào nhóm "Không mô tả cấu trúc" (đổi spec) hay không.
  - `COPY … FROM stdin` của dump PostgreSQL có dữ liệu: các dòng dữ liệu sau nó không phải SQL và scanner không bỏ qua chúng (spec chỉ nhắm `pg_dump --schema-only`); dữ liệu có `'` có thể làm scanner trả lỗi chuỗi không đóng.
  - `DEFINER=root@localhost` không quote (khác dạng `mysqldump` ghi) làm `CREATE … TRIGGER` thành `unsupported` thay vì `trigger`; vẫn có diagnostic, không bị bỏ âm thầm.

## 2026-10-05 18:30 — core-engineer — Xong

Lượt hai, theo quyết định của orchestrator về các câu hỏi còn mở của lượt một.

- **Đã làm**
  - Tách `statement-scanner.ts` (537 dòng) thành ba file, không đổi hành vi: `sql-quoted-text.ts` (chuỗi, dollar quote, định danh có quote, escape; cùng các hàm ký tự `isCharIn`, `skipChars`, `DECIMAL_DIGITS` dùng chung, đặt ở tầng dưới để không có import vòng), `sql-lexer.ts` (`SqlTokenKind`, `SqlToken`, `ScanFailure`, `LexedStep`, `lexNext`, `tokenizeSql`), `statement-scanner.ts` (`SqlStatement`, `scanSqlStatements`, `maskStatements`; re-export `tokenizeSql`, `SqlToken`, `SqlTokenKind`, `ScanFailure`, nên Task 10, 11, 12 vẫn import từ `statement-scanner.js`). Lexer cần tách thêm `sql-quoted-text.ts` vì riêng `sql-lexer.ts` sẽ khoảng 430 dòng.
  - **Quyết định quan trọng (mở rộng dòng "Không mô tả cấu trúc trong model" của spec mục 5; Task 33 cập nhật spec):** các câu sau thành `ignored`, không diagnostic: SQL Server `ALTER TABLE … [WITH CHECK|NOCHECK] CHECK CONSTRAINT …` và `ALTER TABLE … NOCHECK CONSTRAINT …` (SSMS ghi sau mỗi khóa ngoại); `ALTER DATABASE <tên> SET …` (mọi dialect); `ROLLBACK`. `ALTER DATABASE` dạng khác (ví dụ `MODIFY FILE`) và `CHECK CONSTRAINT` ngoài SQL Server vẫn `unsupported`. `CREATE UNLOGGED TABLE`, `CREATE TEMPORARY|TEMP TABLE` giữ `unsupported` (đã có test).
  - PostgreSQL `COPY … FROM stdin;`: các dòng dữ liệu sau câu, tới hết dòng `\.`, thuộc câu `COPY` đó (loại `data`) và không được lex; thiếu dòng `\.` thì dữ liệu tới hết nguồn. `COPY … FROM '<file>'` không bị ảnh hưởng.
  - `DEFINER=root@localhost` không quote của MySQL làm `CREATE … TRIGGER` thành `unsupported`: orchestrator chấp nhận giữ nguyên (vẫn có diagnostic).
- **File thay đổi**
  - `packages/core/src/importers/sql/sql-quoted-text.ts`, `sql-lexer.ts` (tạo, orchestrator giao)
  - `packages/core/src/importers/sql/statement-scanner.ts`, `statement-scanner.test.ts`, `classify-statement.ts`, `classify-statement.test.ts` (sửa)
  - log này
- **Kiểm tra**
  - RED trước khi cài đặt luật mới: `pnpm --filter @schemaforge/core exec vitest run src/importers/sql` → `Tests 9 failed | 136 passed (145)` (7 test `ignored` mới, 2 test `COPY … FROM stdin`).
  - GREEN: `Tests 145 passed (145)`. Coverage số dòng: `classify-statement.ts` 95,89%, `sql-lexer.ts` 100%, `sql-quoted-text.ts` 98,7%, `statement-scanner.ts` 100%.
  - Số dòng: `sql-quoted-text.ts` 224, `sql-lexer.ts` 219, `statement-scanner.ts` 185, `classify-statement.ts` 268.
  - `.claude/scripts/verify.sh core --build --format` → lần đầu `FAIL (core lint)`: `Switch is not exhaustive. Cases not matched: null` (`@typescript-eslint/switch-exhaustiveness-check`) ở `classifyAlter`; đổi `switch` thành chuỗi `if`, chạy lại → `RESULT: PASS` (typecheck, lint, test 3170 test, build, prettier); coverage số dòng toàn core 97,66%.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**: như trên; không có test riêng cho `sql-lexer.ts`, `sql-quoted-text.ts` vì test của `statement-scanner` đi qua `tokenizeSql` (re-export) và phủ đủ.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 33: thêm vào spec mục 5, dòng "Không mô tả cấu trúc trong model": `ROLLBACK`, `ALTER DATABASE … SET`, SQL Server `ALTER TABLE … CHECK|NOCHECK CONSTRAINT`; và ghi việc đọc dữ liệu `COPY … FROM stdin` tới dòng `\.`.
  - Import nội bộ mới nên dùng `sql-lexer.js` cho lexer; `statement-scanner.js` giữ re-export để không phải sửa nơi gọi.
