# Task 8: Probe `@dbml/core` 10.2.0 và adapter

- Plan: [2026-10-03-import-export-plan.md, Task 8](../../plans/2026-10-03-import-export-plan.md#task-8-probe-dbmlcore-1020-và-adapter)
- Spec: [2026-09-15-import-export-design.md, mục 1, mục 5, mục 7, mục "Rủi ro"](../../specs/2026-09-15-import-export-design.md#5-ie-01-import-sql)

## 2026-10-05 18:15 — core-engineer — Xong (có điểm lệch spec, cần orchestrator quyết định trước Task 12, 16)

- **Đã làm**
  - Probe hành vi `@dbml/core` 10.2.0 (Node 24.21.0) bằng `Parser.parse` cho `postgres`, `mysql`, `mssql`, `dbmlv2`; ghi lại thành 83 test đặc tả trong `dbml-core-adapter.probe.test.ts` (mỗi điểm một `it`/`it.each`, ghi hành vi đang quan sát, kể cả hành vi lệch spec).
  - Viết adapter `dbml-core-adapter.ts`: `parseSqlWithDbmlCore`, `parseDbmlWithDbmlCore`, `toParseFailureDiagnostics`, type hẹp `CoreDatabase` (mọi trường `readonly`), đọc model như `unknown` và thu hẹp bằng type guard; mọi ngoại lệ của `Parser.parse` bị bắt trong một `try`.
  - TDD: RED `vitest run src/importers/shared/dbml-core-adapter.test.ts` → `Error: Cannot find module './dbml-core-adapter.js'`; GREEN sau khi viết adapter: thư mục `src/importers/shared/` 9 file, 141 test pass (adapter 16 test, probe 83 test).
  - Theo prompt của orchestrator (ghi đè câu "dừng ở trạng thái Bị chặn" của plan): ghi điểm lệch vào bảng dưới, vẫn viết adapter vì adapter không phụ thuộc vào các điểm lệch (adapter chỉ chuyển tiếp dữ liệu thô; việc bù là của scanner, Task 9, 10, 11, 12).

### Bảng kết quả probe

| Điểm | Spec ghi | Quan sát trên 10.2.0 | Kết luận |
|---|---|---|---|
| 1. Lỗi cú pháp, gốc cột | SQL: ném `{ diags: [{ text, location: { start } }] }`, cột từ 0; DBML: `{ message, code, location: { start, end } }`, cột từ 1; dòng từ 1 | Đúng như spec cho cả bốn parser. Thêm: (a) `mssql` **không** báo lỗi với `foo bar;` ở đầu dòng (bỏ qua âm thầm), lỗi ở đầu dòng của `mssql` thử bằng `) x;`; (b) lỗi nội bộ của parser `postgres`, `mysql` (ví dụ `CREATE TABLE t (a int REFERENCES);`, `COMMENT ON COLUMN` bảng không có, `ALTER TABLE` bảng không có) được ném dạng `diags: [Error]` không có vị trí; (c) lexer ANTLR của `mssql` in `token recognition error` ra console và nuốt ký tự lạ (không ném) | Khớp (adapter xử lý mục không vị trí thành `syntax-error` với `location: null`). (a), (c) là điểm mới: câu `mssql` không nhận ra có thể bị bỏ âm thầm nếu scanner (Task 9) không phân loại |
| 2. Tên không quote | Chưa thử | Giữ nguyên hoa thường ở cả ba dialect (`Users`, `Id`) | Khớp nhánh "giữ nguyên" của spec |
| 3. `UNIQUE` so với `CREATE UNIQUE INDEX` | Plan xác nhận model có phân biệt không; nếu không, scanner cung cấp danh sách tên index tạo bằng `CREATE INDEX` | `UNIQUE` trong cột → `field.unique = true`; ràng buộc cấp bảng `UNIQUE (b)` (một hoặc nhiều cột) và `CREATE UNIQUE INDEX` đều thành index `unique: true`, **không phân biệt được** ở cả ba dialect. `ALTER TABLE … ADD CONSTRAINT … UNIQUE (b)`: postgres → `field.unique`, mysql → **bị bỏ âm thầm**, mssql → index | Khác: dùng nhánh dự phòng spec đã ghi (scanner cung cấp tên index của `CREATE INDEX`). MySQL `ALTER TABLE ADD UNIQUE` bị mất: cần scanner phát hiện |
| 4. `ALTER TABLE` | Spec mục 5 xếp `ALTER TABLE … ADD` cột, `PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY`, `CHECK` vào "parser đọc" | `ALTER TABLE ONLY … ADD CONSTRAINT … PRIMARY KEY`, `FOREIGN KEY` (postgres) đọc đúng; khóa ngoại qua `ALTER TABLE` trên `mssql`, `mysql` đọc đúng; `ADD CHECK` đọc đúng cả ba; `ADD PRIMARY KEY` đọc đúng cả ba. **`ALTER TABLE … ADD COLUMN` bị bỏ âm thầm trên postgres và mysql** (mssql giữ). Cardinality đầu mút: postgres, mysql trả `"0..*"`, `"0..1"`; mssql và DBML trả `"*"`, `"1"` | Khác (ADD COLUMN pg/mysql; ADD UNIQUE mysql). Cardinality: adapter chuẩn hóa về `"1" \| "*"` theo cận trên |
| 5. Thông tin có thể bị bỏ | Spec: `on-update-not-supported` "nếu parser giữ lại"; `computed-column-not-supported`; collation, `DESC`, `WHERE` chưa thử | `ON UPDATE CURRENT_TIMESTAMP`: **bỏ âm thầm** (mặc định vẫn giữ). Cột tính toán: postgres, mysql đọc như cột thường **không dấu hiệu**; mssql `b AS (a * 2) PERSISTED` thành tên kiểu `AS a * 2 PERSISTED`. `COLLATE`: **bỏ âm thầm** cả ba. `DESC` của index: **bỏ âm thầm** cả ba. `WHERE` của index: **bỏ âm thầm** (postgres, mssql). `USING hash`: giữ (`type: "hash"`). Cột biểu thức: `type: "expression"`. Cột thường của `CREATE INDEX` postgres có `type: "string"` (các chỗ khác `"column"`) | Khác: các mục bỏ âm thầm cần scanner phát hiện và spec mục 5 phải bổ sung (mục "Rủi ro" đã dự liệu). Collation, `DESC`, `WHERE` chưa có mã diagnostic trong 39 mã |
| 6. Giá trị mặc định | `{ type: 'string' \| 'number' \| 'boolean' \| 'expression', value }`; `N'a'` là `expression` | Đúng dạng. Chi tiết: số giữ dạng chuỗi trong SQL (`"12345678901234567890.123"`, không mất độ chính xác); **số âm postgres `-5` là `expression`**; **`DEFAULT NULL` là `{ type: "boolean", value: "null" }`** (cả DBML `default: null`); chuỗi giữ escape gốc (`'it''s'` → `"it''s"`); `'a'::text` là `expression`; mssql `((0))` → `{ number, "0" }` (parser bỏ ngoặc); mysql `(UUID())` → `expression "UUID()"`; mssql `1` trên `bit` là `number` | Khớp dạng; Task 10, 12 phải xử lý `-5` dạng expression, `null` dạng boolean, chuỗi còn escape |
| 7. Kiểu | Tên kiểu gốc kèm tham số; `bigint IDENTITY(1,1)` lẫn trong tên kiểu; MySQL `ENUM(…)` → `<bảng>_<cột>_enum`; `CREATE TYPE … AS ENUM` | Đúng các điểm spec ghi (`character varying(255)`, `numeric(10,2)` đã gộp khoảng trắng; `int IDENTITY(10,5)`; `nvarchar(max)` → `nvarchar(MAX)`; `serial`, `GENERATED … AS IDENTITY`, `AUTO_INCREMENT` → `increment`; mssql identity không có `increment`). **Lệch nghiêm trọng:** postgres `timestamp with time zone` → `timestamp`, `time with time zone` → `time` (mất múi giờ; `pg_dump` ghi đúng dạng này); `double precision` → `doubleprecision`, `bit varying(4)` → `bitvarying(4)`, `interval day to second` → `intervaldaytosecond`; mysql **bỏ `UNSIGNED`** (`int unsigned` → `int`, `decimal(10,2) unsigned` → `decimal(10,2)`), `double precision` → `double` | Khác: bảng ánh xạ kiểu spec mục 5 (`timestamptz` từ `timestamp with time zone`, MySQL `… UNSIGNED`) không làm được chỉ từ model; cần scanner đọc lại văn bản kiểu |
| 8. Comment, CHECK | `COMMENT ON`, MySQL `COMMENT` đọc; `sp_addextendedproperty` không đọc; CHECK `expression` dạng văn bản | Đúng; thêm `table.checks[].name` (tên ràng buộc) | Khớp |
| 9. Câu bị bỏ âm thầm | View, trigger, sequence, function `$$…$$`, `DECLARE`, `EXEC`, `ALTER COLUMN … ADD GENERATED … AS IDENTITY` | Đúng, không lỗi, không cảnh báo | Khớp |
| 10. Vị trí | SQL không có `token`; DBML có | SQL: `token` là `undefined` trên bảng, cột, index. DBML: có `token.start/end`, cột từ 1. Bảng, enum, ref, group bị gom theo schema (schema `other` trước `public`), `id` theo thứ tự nguồn | Khớp; adapter sắp lại theo `id` để giữ thứ tự nguồn |
| 11. DBML | Tên kiểu trong nháy mất nháy; mặc định số là số JavaScript; `Project`, `TableGroup`, `Note`, `headercolor`, `type: hash`, tên và `color` của `Ref`, `Records`, `<>`, `checks` có trong model | Đúng tất cả (`"varchar(255)"` → `varchar(255)`; `12345678901234567890.123` → `12345678901234567000`; `<>` cho hai đầu `"*"`; `checks` có `name`). Thêm: `ref:` trên cột đặt **bảng được tham chiếu trước** trong `endpoints` (dạng `Ref:` độc lập giữ thứ tự trái phải, CG-09 dùng dạng này); `delete`, `update` là chữ thường trong DBML, chữ hoa trong SQL | Khớp; ghi chú cho Task 16 về thứ tự đầu mút của `ref: -` trên cột |

- **File thay đổi**
  - `packages/core/src/importers/shared/dbml-core-adapter.ts` (mới, adapter)
  - `packages/core/src/importers/shared/dbml-core-adapter.test.ts` (mới, 16 test)
  - `packages/core/src/importers/shared/dbml-core-adapter.probe.test.ts` (mới, 83 test đặc tả)
  - `document/executions/logs/2026-10-05-import-export-task-8.md` (log này)
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3262/3262 pass, coverage dòng 97.71%, build, prettier).
  - Một lần chạy trước đó khi máy quá tải (load average 212–288, nhiều worktree song song) báo 3 test quá thời gian (2 test probe `mssql`, 1 test property drizzle không thuộc task) và lỗi `Failed to start forks worker`; chạy riêng file probe: test `mssql` chậm nhất 1,3 giây.
  - `grep -rl "@dbml/core" packages/core/dist --include=*.js`: in `dist/importers/shared/dbml-core-adapter.js` và `dist/generators/dbml/dbml-strings.js`; file sau chỉ có chữ `@dbml/core` trong một comment có sẵn của CG-09, không import. Chỉ adapter import thư viện.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Tên trường boolean theo `typescript.md` (`isPrimaryKey`, `isUnique`, `isNotNull`, `isIncrement`), `dbdefault` → `defaultValue`, `fieldNames` → `columnNames`: plan cho phép đặt tên theo probe, rule đặt tên boolean thắng.
  - Đọc model như `unknown` thay vì dùng type của thư viện: type có `any` và vòng tham chiếu; không lộ type `@dbml/core` ra ngoài.
  - Bảng, ref, enum, group gom từ mọi schema và sắp theo `id` của thư viện: giữ thứ tự nguồn cho bước cấp id.
  - `relation` chuẩn hóa về `"1" | "*"` theo cận trên của cardinality (`"0..*"` → `"*"`).
  - Kiểu mặc định lạ được giữ dưới dạng `expression` để importer báo `default-not-supported`, không bỏ âm thầm; giá trị số DBML đổi thành chuỗi bằng `String` (Task 16 đọc lại văn bản gốc).
  - Adapter trả diagnostic qua `finalizeImportDiagnostics`; `{ diags: [] }` hoặc ngoại lệ không có `diags` thành đúng một `parse-failed`, nên kết quả lỗi luôn có ít nhất một diagnostic.
  - Không tìm được input làm parser ném lỗi không có `diags` (mọi lỗi đều bọc trong `diags`, kể cả `TypeError`); test `parse-failed` gọi `toParseFailureDiagnostics` trực tiếp với `RangeError`, chuỗi, `null`, `{ diags: [] }` như plan cho phép. Input lồng 20 000 ngoặc trên postgres không thử (spec ghi không xong sau 90 giây).
  - Các `describe` gọi parser SQL trong hai file test có `timeout: 30_000` riêng (parser ANTLR, nhất là `mssql`, mất tới khoảng 1 giây mỗi lần; khi máy tải nặng vượt 5 giây mặc định); không sửa cấu hình chung.
  - `tableGroups[].tableNames` chỉ giữ tên bảng (không tên schema), đúng plan.
  - File probe dài hơn khoảng 300 dòng sau prettier (bảng dữ liệu `it.each`): plan quy định một file probe duy nhất, nên giữ một file.
- **Việc còn lại** (cho orchestrator, ngoài phạm vi Task 8)
  - [ ] Quyết định và sửa spec mục 5 (và Task 9, 10, 11, 12) cho các điểm lệch: postgres mất `with time zone` và gộp chữ trong tên kiểu nhiều từ; MySQL mất `UNSIGNED`; postgres, mysql bỏ `ALTER TABLE … ADD COLUMN`; mysql bỏ `ALTER TABLE … ADD UNIQUE`; `ON UPDATE`, cột tính toán (postgres, mysql), `COLLATE`, `DESC`, `WHERE` của index bị bỏ âm thầm; mssql không báo lỗi câu không nhận ra.
  - [ ] Quyết định có cần mã diagnostic mới cho collation, chiều `DESC`, điều kiện `WHERE` của index (không có trong 39 mã; `index-option-dropped` có thể dùng cho `DESC`, `WHERE` nếu spec đồng ý).
  - [ ] Task 12, 16 chưa được bắt đầu cho tới khi orchestrator sửa spec theo bảng trên (điều kiện của plan).
- **Ghi chú cho người tiếp theo**
  - Probe test là đặc tả của 10.2.0: nâng `@dbml/core` mà hành vi đổi thì test đỏ; cập nhật test cùng spec.
  - Chạy parser `mssql` với ký tự lạ in `token recognition error` ra console (từ ANTLR), không phải từ code của core.
  - `CREATE INDEX` trên postgres có cột kiểu `"string"`, các chỗ khác `"column"`: adapter coi mọi loại khác `"expression"` là tên cột.

## 2026-10-05 18:56 — core-engineer — Xong

- **Đã làm**
  - Theo yêu cầu của orchestrator: chuyển mọi type `Core*` (`CoreParseResult`, `CoreToken`, `CoreDefaultValue`, `CoreCheck`, `CoreField`, `CoreIndexColumn`, `CoreIndex`, `CoreTable`, `CoreEndpoint`, `CoreRef`, `CoreEnum`, `CoreTableGroup`, `CoreDatabase`) sang file mới `dbml-core-adapter-types.ts`, không đổi hành vi. Adapter và test import type từ file mới; adapter không re-export type.
  - Orchestrator đã nhận các điểm lệch của probe và tự sửa spec, plan (scanner đọc lại định nghĩa cột; `ADD COLUMN` pg/mysql và MySQL `ADD UNIQUE` thành `statement-not-supported`).
- **File thay đổi**
  - `packages/core/src/importers/shared/dbml-core-adapter-types.ts` (mới, 115 dòng)
  - `packages/core/src/importers/shared/dbml-core-adapter.ts` (bỏ khai báo type, import từ file mới; 313 dòng)
  - `packages/core/src/importers/shared/dbml-core-adapter.test.ts` (import type từ file mới; 323 dòng)
  - `packages/core/src/importers/shared/dbml-core-adapter.probe.test.ts` (không đổi trong lần này; 795 dòng)
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3262/3262, coverage dòng 97.71%, build, prettier).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Adapter còn 313 dòng (khoảng 300 theo `code-quality.md`). Bớt thêm phải bỏ kiểu trả về của các hàm đọc phần tử, khi đó literal `"1" | "*"` và loại mặc định bị nới thành `string`, nên giữ nguyên.
- **Ghi chú cho người tiếp theo**
  - Task 12, 16 import type từ `../shared/dbml-core-adapter-types.js` và hàm từ `dbml-core-adapter.js` (lint chỉ cho `importers/sql/`, `importers/dbml/` import adapter).
