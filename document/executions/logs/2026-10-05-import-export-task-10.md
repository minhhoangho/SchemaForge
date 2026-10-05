# Task 10: Ánh xạ kiểu và giá trị mặc định SQL

Plan: [Task 10](../../plans/2026-10-03-import-export-plan.md#task-10-ánh-xạ-kiểu-và-giá-trị-mặc-định-sql). Spec: [mục 5 "Ánh xạ kiểu", "Giá trị mặc định"; mục 6; mục 7](../../specs/2026-09-15-import-export-design.md).

## 2026-10-05 18:52 — core-engineer — Xong

- **Đã làm**
  - `mapSqlType`, `splitSqlServerIdentity` (`sql-type-mapping.ts`): tách tên kiểu bằng `tokenizeSql` (bỏ quote, gộp khoảng trắng, không phân biệt hoa thường, bỏ tiền tố schema `public.`), tra bảng kiểu theo dialect, rồi enum theo `enumNameKeys`, rồi `custom` nguyên văn (đã `trim`) nếu `isSafeCustomTypeName`, ngược lại `text` + `type-not-supported`.
  - Bảng kiểu ba dialect đúng từng ô của spec mục 5 (`sql-type-rules.ts`), các hàm dựng luật (`sql-type-rule-builders.ts`).
  - `mapSqlDefault` (`sql-default-mapping.ts`): chuẩn hóa biểu thức (bỏ mọi cặp ngoặc bao ngoài trong một lượt, ép kiểu `::` ở mức ngoài, tiền tố `N` do lexer xử lý), phân loại literal / `NULL` / hàm; bảng hàm (`sql-default-functions.ts`) theo dialect, `"any"` nhận hợp ba dialect.
  - TDD: RED cả hai file test do thiếu module (`Cannot find module './sql-type-mapping.js'`, `'./sql-default-mapping.js'`), rồi GREEN (155 và 67 test).
  - Đợt hai, theo kết quả probe Task 8 do orchestrator gửi: viết test trước, RED 20 test (`Failed Tests 20`: unescape chuỗi, khoảng trắng nhiều dòng, alias bị dính chữ, modifier MySQL), rồi GREEN 256 test cho hai file.
- **File thay đổi** (đều mới, trong `packages/core/src/importers/shared/`)
  - `sql-type-mapping.ts` (224 dòng), `sql-type-mapping.test.ts` (461)
  - `sql-type-rules.ts` (238), `sql-type-rule-builders.ts` (155): tách thêm vì vượt ~300 dòng (ngoại lệ đã được orchestrator duyệt)
  - `sql-default-mapping.ts` (238), `sql-default-mapping.test.ts` (303)
  - `sql-default-functions.ts` (210): tách thêm, phần lớn là bảng dữ liệu
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3593 test pass, coverage dòng 97.65%, không có dòng dưới ngưỡng, build, prettier).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `git status --porcelain`: chỉ 7 file trên cùng log này.
- **Quyết định**
  - Thứ tự tra kiểu: bảng kiểu chung trước, enum sau, rồi custom. Enum trùng tên kiểu có sẵn (ví dụ enum tên `date`) là trường hợp bệnh lý.
  - Tra enum không phụ thuộc dialect (plan ghi PostgreSQL), vì DBML cũng tra tên enum và SQL Server không có enum nên `enumNameKeys` rỗng.
  - Bỏ tiền tố schema trước khi tra (`public.status`, `pg_catalog.int4`) vì `pg_dump` đặt `search_path` rỗng và ghi tên kiểu, tên hàm có schema. Tên custom vẫn giữ nguyên văn, nên `public.citext` không qua cú pháp an toàn và thành `text` + `type-not-supported`.
  - Tham số ngoài miền của model (`varchar(0)`, `float(54)`, `numeric(0,0)`, nhiều đối số) thì không khớp bảng, nên kiểu thành `custom` nguyên văn.
  - `numeric(p)`, `DECIMAL(p)` thành `decimal(p, 0)`, đúng ngữ nghĩa của cả ba dialect. `numeric`, `DECIMAL` không tham số vẫn là `custom` theo spec.
  - Độ rộng hiển thị số nguyên MySQL (`INT(11)`) cho thêm `type-parameter-dropped`. `BINARY(n)`, `VARBINARY(n)` chỉ có `type-approximated`, vì độ dài đã nằm trong phần gần đúng.
  - Độ chính xác giây ngầm định: PostgreSQL 6, MySQL 0 (nên `TIME`, `DATETIME` không tham số có `type-parameter-dropped`), SQL Server 7.
  - `float(n)` cho PostgreSQL và SQL Server: 1–24 thành `real`, 25–53 thành `double`. SQL Server `float` không tham số là `double`.
  - Kiểu trong danh sách thì khớp, kiểu ngoài danh sách (`TINYINT UNSIGNED`, `MEDIUMINT UNSIGNED`, PostgreSQL `float` không tham số, `char` không độ dài) thành `custom`, giữ round-trip trên cùng dialect.
  - Giá trị mặc định: với `string`, `text` là giá trị không có quote. Với `number`, `boolean`, `expression`, `text` là văn bản nguồn và được lex lại. Số giữ văn bản, không qua `Number`.
  - Số `1`/`0` trên cột `boolean` thành `true`/`false` ở **mọi** dialect (plan chỉ ghi SQL Server), vì với MySQL `TINYINT(1)`, 1/0 chính là literal boolean, còn PostgreSQL vốn không cho `boolean DEFAULT 1`. Số khác (`2`) giữ nguyên và sẽ thành issue `column-default-invalid`.
  - Hàm mặc định nhận đối số độ chính xác (`now(6)`, `CURRENT_TIMESTAMP(3)`). Dạng không ngoặc chỉ cho từ khóa (`CURRENT_TIMESTAMP`, `LOCALTIMESTAMP`). Hàm của dialect khác thì `default-not-supported`.
  - Ép kiểu `::` được bỏ ở mọi dialect (MySQL, SQL Server không sinh dạng này nên kết quả không đổi). Lex cho `"any"` dùng quy tắc PostgreSQL.
  - Chống input xấu: bỏ mọi lớp ngoặc trong một lượt O(n) (test 20 000 cặp ngoặc), tối đa 8 bước chuẩn hóa ngoặc/ép kiểu, `reduce` thay cho `Math.min(...spread)`.
  - `isSqlSymbol` export từ `sql-default-functions.ts` và dùng chung cho hai file mapping thay vì chép.
  - **Từ probe Task 8, orchestrator quyết định:**
    - `rawType` là văn bản nguồn do scanner đọc lại. Tên nhiều từ nhận mọi khoảng trắng và hoa thường. Tên custom được gộp khoảng trắng (`bit\nvarying(8)` thành `bit varying(8)`) để có thể qua cú pháp an toàn. `time with time zone`, `bit varying` thành `custom` (spec: `timetz` là custom).
    - Alias tên bị parser viết dính: `doubleprecision` (PostgreSQL, MySQL) thành `double`; `bitvarying` (PostgreSQL) thành `custom` `bit varying`, kèm tham số nếu có.
    - Modifier MySQL `UNSIGNED`, `ZEROFILL` sau kiểu: thêm `type-approximated`; `ZEROFILL` (MySQL coi là kèm `UNSIGNED`) thêm `type-parameter-dropped`. **Lệch với chữ của orchestrator, có cân nhắc:** orchestrator ghi "cùng loại với kiểu có dấu", nhưng spec mục 5 có ô riêng cho `INT UNSIGNED` → `bigint`, `SMALLINT UNSIGNED` → `integer`, `BIGINT UNSIGNED` → `decimal(20, 0)` (plan: "đúng từng ô"; rộng hơn để không mất giá trị). Vì vậy ba ô này giữ theo spec (thêm alias `INTEGER UNSIGNED`), còn mọi kiểu khác (`TINYINT`, `MEDIUMINT`, `DECIMAL`, `DOUBLE`…) theo quy tắc của orchestrator.
    - `mapSqlDefault`: `null` ở mọi kind trừ `string` (ví dụ `{ kind: "boolean", text: "null" }`) là không có mặc định. Chuỗi `'null'` vẫn là literal, vì trong nguồn nó có quote. Đây cũng là chỗ lệch nhỏ với chữ "in any kind".
    - Biểu thức là số có dấu (`-5`, `- 5`) thành literal số, giữ văn bản (bỏ khoảng trắng giữa dấu và số). SQL Server `((0))` đã đúng sau khi bỏ ngoặc.
    - Chuỗi: `text` vẫn giữ escape SQL. Phần nội dung được bọc lại bằng `'…'` rồi lex theo dialect (`''` với cả ba dialect; `\'`, `\\` với MySQL). Nội dung không tạo đúng một token chuỗi thì giữ nguyên. Với `"any"` (DBML) thì không unescape, vì parser DBML đã unescape.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 12: gọi `splitSqlServerIdentity` trước `mapSqlType`. Tính `hasUuidDefault` cho MySQL `CHAR(36)` bằng cách gọi `mapSqlDefault` với `columnType: { kind: "uuid" }` rồi kiểm tra kết quả có phải `generateUuid` không.
  - Task 20 (conformance `mysqldump`): `mysqldump` ghi `DEFAULT '1'` (chuỗi) cho `tinyint(1)`, và chuỗi luôn giữ là literal, nên sẽ thành `column-default-invalid`. Nếu conformance gặp trường hợp này, cần quyết định thêm chuyển chuỗi `'1'`/`'0'` trên cột boolean.
  - `mysqldump` ghi `ON UPDATE CURRENT_TIMESTAMP` ngoài biểu thức mặc định: `on-update-not-supported` thuộc importer (Task 12), không thuộc bảng này.
  - Hai file test dài 461 và 303 dòng, phần lớn là bảng `it.each` theo từng ô của spec. Mọi file nguồn đều dưới 300 dòng.
  - Chạy lần đầu bị gián đoạn vì máy ngủ. Khi chạy tiếp, worktree chỉ có `sql-type-mapping.test.ts`, và việc tiếp tục từ đó.
