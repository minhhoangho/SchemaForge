# Task 18: CG-03 Drizzle schema

Plan: [Task 18](../../plans/2026-09-15-code-generators-plan.md#task-18-cg-03-drizzle-schema). Spec: [CG-03](../../specs/2026-09-14-code-generators-design.md#cg-03-drizzle-schema).

## 2026-10-02 — core-engineer — Bị chặn

- **Đã làm**
  - Dựng worktree (`.claude/scripts/worktree-setup.sh <worktree>` → `RESULT: PASS`, Node v24.21.0), đọc rule, plan (Quy ước chung, Điểm nóng, Task 18, Vấn đề 18), spec (mục 3 "Drizzle", mục 4, mục 5, CG-03, Rủi ro) và generator Prisma cùng các file `generators/shared/` sẽ dùng.
  - Làm **bước kiểm chứng sớm** trước mọi test: viết tay `schema.ts` PostgreSQL và MySQL đúng dạng output của plan, gồm bảng `a` (khóa ngoại tới `b` khai báo sau), bảng `b` (khóa ngoại tới `a` trong callback cấu hình), bảng tự tham chiếu `c` (khóa ngoại hai cột qua `table.<key>`), bảng rỗng `pgTable("empty", {})`, `relations()` cho cả ba (`one` có `fields`/`references`/`relationName`, `one(a)` không config, `many` có và không có `relationName`), hai `customType` (`bytea`/`longblob` với `Uint8Array`, kiểu custom với `unknown`), một `pgEnum`, `mysqlEnum`, và mọi builder, option, mặc định ở mục "Kiểu" (`bigint` mode `bigint`, `numeric`/`decimal` precision, scale, `char`/`varchar` length, `time`/`timestamp` precision và `withTimezone`, `time`/`datetime`/`timestamp` `fsp`, `.notNull()`, `.generatedByDefaultAsIdentity()`, `.autoincrement()`, `.defaultNow()`, `.defaultRandom()`, `.default(<literal>)`, `.default(sql.raw("…"))`, `primaryKey`, `unique`, `uniqueIndex`, `index`, `foreignKey(…).onDelete(…).onUpdate(…)` với đủ năm hành động).
  - Chạy `typecheckFiles` (Task 8) qua một file test tạm `packages/codegen-conformance/src/drizzle-early-check.test.ts` (đã xóa, cùng thư mục `.tmp/`), với `drizzle-orm` 0.45.3 đã cài.
  - **Kết quả: typecheck có diagnostic, ở cả hai dialect.** Theo plan, dừng với trạng thái `Bị chặn`, không tự đổi cấu trúc output, chưa tạo file nào trong `packages/core`.
- **Diagnostic nguyên văn**
  - PostgreSQL:
    ```
    schema.ts(43,14): error TS7022: 'a' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
    schema.ts(67,3): error TS7024: Function implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.
    schema.ts(78,14): error TS7022: 'b' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
    schema.ts(84,3): error TS7024: Function implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.
    ```
  - MySQL:
    ```
    schema.ts(40,14): error TS7022: 'a' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
    schema.ts(63,3): error TS7024: Function implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.
    schema.ts(75,14): error TS7022: 'b' implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer.
    schema.ts(82,3): error TS7024: Function implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.
    ```
  - Dòng 43/40 và 78/75 là `export const a = …Table(`, `export const b = …Table(`; dòng 67/63 và 84/82 là callback `(table) => [` của `a` và `b`.
- **Thử thêm để khoanh vùng** (cùng file test tạm, không đổi output của generator)
  - Bỏ khóa ngoại `b → a` (chỉ còn tham chiếu tới bảng khai báo sau, không vòng): **không có diagnostic** ở cả hai dialect. Lỗi chỉ xuất hiện khi khóa ngoại của hai bảng tạo vòng.
  - Bảng tự tham chiếu qua `table.<key>`: không có diagnostic.
  - Giữ nguyên file, chỉ ghi kiểu trả về cho mọi callback: `(table): PgTableExtraConfigValue[] => [` (MySQL `MySqlTableExtraConfigValue[]`), thêm `type PgTableExtraConfigValue` (MySQL `type MySqlTableExtraConfigValue`) vào dòng import `drizzle-orm/pg-core` (`drizzle-orm/mysql-core`): **không có diagnostic** ở cả hai dialect (strict, `verbatimModuleSyntax`). Hai type này được export từ `drizzle-orm/pg-core/table.d.ts`, `drizzle-orm/mysql-core/table.d.ts` (0.45.3) và đúng là kiểu trả về `extraConfig` của `pgTable`/`mysqlTable`.
  - Chạy thật: import file viết tay rồi gọi `getTableConfig` (`drizzle-orm/pg-core`, `drizzle-orm/mysql-core`) cho `a`, `b`, `c`: tên khóa chính và khóa ngoại đúng, bảng đích đúng kể cả vòng `a ↔ b` và tự tham chiếu (PostgreSQL `a_b_id_fkey → b`, `b_a_id_fkey → a`, `c_parent_tenant_id_parent_id_fkey → c`; MySQL `a_b_id_fkey → b`, `b_a_tenant_id_a_id_fkey → a`, `c_parent_id_fkey → c`). Rủi ro "getTableConfig" của spec ổn; chỉ typecheck hỏng.
  - Typings: `RelationConfig` của `one` trong `drizzle-orm/relations.d.ts` 0.45.3 bắt buộc `fields` và `references` (đúng Vấn đề 18); `many` nhận `{ relationName }`. Mọi builder và option của mục "Kiểu" có trong typings (bản có ghi kiểu trả về qua typecheck đầy đủ).
- **File thay đổi**: chỉ log này. Không có file nào trong `packages/core` hay `packages/codegen-conformance` (file tạm đã xóa).
- **Kiểm tra**
  - `.claude/scripts/worktree-setup.sh <worktree>` → `RESULT: PASS`.
  - `pnpm --filter @schemaforge/codegen-conformance exec vitest run src/drizzle-early-check.test.ts` (file tạm) → typecheck bản gốc fail như trên; hai bản thử và `getTableConfig` như trên.
  - `.claude/scripts/secret-scan.sh`: xem báo cáo.
- **Quyết định**
  - Dừng `Bị chặn` đúng như plan yêu cầu; không tự thêm chú thích kiểu vào output vì đó là đổi cấu trúc output, dòng import và danh sách `DRIZZLE_IMPORT_NAMES` (tên biến dành riêng) mà plan đã chốt.
  - Đề xuất cho orchestrator (cần sửa plan Task 18 và spec CG-03 trước): mọi callback cấu hình bảng ghi kiểu trả về `PgTableExtraConfigValue[]` / `MySqlTableExtraConfigValue[]`, dòng import builder thêm `type PgTableExtraConfigValue` (`type MySqlTableExtraConfigValue`) khi có ít nhất một callback, và thêm tên type này vào `DRIZZLE_IMPORT_NAMES[dialect]` (kéo theo `reserved` của allocator). Ghi cho mọi bảng thay vì chỉ bảng nằm trong vòng: đơn giản, xác định, không cần phát hiện vòng. Phương án khác: chỉ ghi khi bảng nằm trong vòng khóa ngoại (output gọn hơn nhưng thêm logic, và tên biến/import đổi theo schema).
- **Việc còn lại**
  - [ ] Orchestrator chọn cách xử lý TS7022/TS7024 (đề xuất ở trên), sửa plan Task 18 (mục "Cấu trúc file" bước 1 và 4, `DRIZZLE_IMPORT_NAMES`, test `imports only used builders sorted by name`, thêm test cho chú thích kiểu callback) và spec CG-03 (bullet "Cấu trúc file", mục Rủi ro dòng Drizzle).
  - [ ] Sau khi plan được sửa: agent mới đọc log này, làm lại bước kiểm chứng sớm với dạng output mới (file viết tay ở mục "Đã làm": vòng `a ↔ b`, tự tham chiếu, `relations()`, `customType`, `pgEnum`), xác nhận typecheck sạch, rồi làm Task 18 theo TDD từ đầu (chưa có file nào trong `packages/core/src/generators/drizzle/`).
- **Ghi chú cho người tiếp theo**
  - `typecheckFiles` là file TS import `./temp-directory.js`, nên không chạy được bằng `node -e`; cách chạy được là một file `*.test.ts` tạm trong `packages/codegen-conformance/src/` với `pnpm --filter @schemaforge/codegen-conformance exec vitest run <file>`. Vitest 5 chỉ in `console.log` của test fail, nên dùng `expect` để xem kết quả. Nhớ xóa file tạm và `packages/codegen-conformance/.tmp/` nếu tự ghi vào đó.
  - Shell của agent worktree: `source ~/.nvm/nvm.sh` bị chặn; dùng `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"` trước lệnh `pnpm`. `worktree-setup.sh` cần đường dẫn worktree làm đối số.
  - Phần "Chuẩn bị" của Task 18 trùng gần hết `createSqlDdlContext` (`shared/sql-ddl-model-context.ts`) mà Prisma đã dùng; `resolveForeignKeyActions` (export từ `shared/sql-ddl-model.ts`) cho hành động khóa ngoại và diagnostic `referential-action-not-supported`.

## 2026-10-03 — core-engineer — Dừng giữa chừng

- **Đã làm**
  - Làm lại bước kiểm chứng sớm với dạng có chú thích kiểu (quyết định R21): file test tạm `packages/codegen-conformance/src/drizzle-early-check.test.ts` (đã xóa) viết tay `schema.ts` PostgreSQL và MySQL gồm vòng `a ↔ b`, bảng tự tham chiếu `c` (PostgreSQL hai cột), bảng rỗng, `relations()` (`one` có `fields`/`references`/`relationName`, `one(a)` không config, `many` có và không có `relationName`), `customType` `bytea`/`longblob` (`Uint8Array`) và kiểu custom (`unknown`), `pgEnum`, `mysqlEnum`, mọi builder và option của mục "Kiểu", mọi callback là `(table): PgTableExtraConfigValue[] => [` / `(table): MySqlTableExtraConfigValue[] => [`, import `type …ExtraConfigValue` đứng đầu dòng import. **Kết quả: 0 diagnostic ở cả hai dialect.** Đối chứng: cùng file PostgreSQL bỏ chú thích kiểu vẫn ra đúng TS7022/TS7024 như log trước, nên helper typecheck thật sự bắt lỗi.
  - TDD `drizzle-names`: viết `drizzle-names.test.ts` (RED: `Cannot find module './drizzle-names.js'`), rồi `drizzle-names.ts` (GREEN: `.claude/scripts/test-file.sh core src/generators/drizzle/drizzle-names.test.ts` → `RESULT: PASS`).
  - TDD `drizzle-columns`: viết `drizzle-columns.test.ts` đầy đủ, chạy thấy RED (`Cannot find module './drizzle-columns.js'`). **Chưa có `drizzle-columns.ts`**: bản viết dở đã bị xóa khi dừng để không để lại file nửa vời.
  - Dừng vì tín hiệu ngân sách context: ngữ cảnh khoảng 82%, khoảng 25 file đã đọc, và lượt chạy bị cắt nhiều lần (watchdog, máy ngủ).
- **File thay đổi** (chưa commit, đều trong `packages/core/src/generators/drizzle/`)
  - `drizzle-names.ts`: `DrizzleDialect`, `DRIZZLE_IMPORT_NAMES` (có `PgTableExtraConfigValue` / `MySqlTableExtraConfigValue` đứng đầu), `BINARY_DATA_TYPES`, `DrizzleVariableNames`, `customDataType`, `listWrittenRelations`, `hasInverseField`, `allocateDrizzleVariableNames`.
  - `drizzle-names.test.ts`: 7 nhóm test của plan (thêm case `relations`, `sql` vào test tham số callback; test import list gồm hai dialect).
  - `drizzle-columns.test.ts`: mọi test của plan cho `drizzle-columns` trừ `reports the type diagnostics of the dialect rules` (xem Quyết định), thêm `adds sql to the builders when a default uses sql.raw`.
- **Kiểm tra**
  - Bước kiểm chứng sớm: `pnpm --filter @schemaforge/codegen-conformance exec vitest run src/drizzle-early-check.test.ts` → `Tests 2 passed (2)`; bản đối chứng không chú thích → 1 failed với TS7022/TS7024.
  - `.claude/scripts/test-file.sh core src/generators/drizzle/drizzle-names.test.ts` → `RESULT: PASS`.
  - `.claude/scripts/test-file.sh core src/generators/drizzle/drizzle-columns.test.ts` → `RESULT: FAIL` (RED đúng lý do: thiếu module).
  - Chưa chạy `verify.sh`, `secret-scan.sh` (worktree đang đỏ có chủ đích vì test RED).
- **Quyết định**
  - `allocateDrizzleVariableNames` giữ đúng chữ ký hai tham số của plan; tự tính `dropped.relationIds` qua `resolveSchemaColumnTypes` + `findUnindexableConstraints` (hàm `listWrittenRelations`) để biết bảng nào có trường quan hệ. Lý do: không đổi chữ ký plan; giá phải tính hai lần là tuyến tính, chấp nhận được.
  - Trường quan hệ (cả phía khóa ngoại lẫn phía ngược) chỉ ghi cho quan hệ không bị bỏ (`dropped.relationIds`), giống `context.relations` của Prisma. Lý do: hai đích nhất quán.
  - Khóa `customTypeVariables` lấy từ `column.type` (`binary` → `bytea`/`longblob`, `custom` → tên kiểu); kiểu custom trùng tên `bytea`/`longblob` dùng chung biến với `binary`, `data` là `Uint8Array` khi `dataType` bằng `BINARY_DATA_TYPES[dialect]`, còn lại `unknown`.
  - Test `reports the type diagnostics of the dialect rules` chuyển sang `generate-drizzle.test.ts`: `renderDrizzleColumn` nhận kiểu đã phân giải nên không tự sinh diagnostic kiểu; diagnostic đó đến từ `createSqlDdlContext`.
  - `mysqlEnum` ghi giá trị bằng `values.map((value) => JSON.stringify(value)).join(", ")` (bản nháp dùng `replaceAll` đã bị loại vì sai khi giá trị chứa `","`).
- **Việc còn lại**
  - [ ] Viết `packages/core/src/generators/drizzle/drizzle-columns.ts` export `renderDrizzleColumn(input): { expression, builders, diagnostics }` cho tới khi `drizzle-columns.test.ts` xanh. Quy tắc: kiểu theo `type` đã phân giải (bảng trong test); PostgreSQL enum → biến enum, không tìm thấy → `text`; MySQL enum → `mysqlEnum("c", [<JSON.stringify từng giá trị, nối ", ">])`, không tìm thấy → `longtext`; `binary`/`custom` → biến `customTypeVariables` (`builders` không chứa gì cho biến); nối `.notNull()` khi không nullable; auto-increment → PostgreSQL `.generatedByDefaultAsIdentity()`, MySQL `.autoincrement()` và bỏ qua default; default: `findDefaultValueProblem` khác null → `default-omitted` tại `["columns", id, "defaultValue"]`; PostgreSQL `currentTimestamp` → `.defaultNow()`, `generateUuid` → `.defaultRandom()`; literal theo `type.kind`: `smallint`/`integer` → `.default(String(Number(v)))`, `boolean` → `.default(true|false)`, `char`/`varchar`/`keyText`/`uuid`/`decimal`/`enum` và `text` chỉ PostgreSQL → `.default(JSON.stringify(v))`; còn lại → `.default(sql.raw(JSON.stringify(formatSqlDefault({ dialect, column, enums, shouldParenthesizeLiteral: dialect === "mysql" && kind ∈ {text, json, binary} }).sql)))` và thêm `"sql"` vào `builders`. Không dùng `as`; hằng số tên cho 6 và 36.
  - [ ] Viết `generate-drizzle.test.ts` trước (mọi test của plan Task 18 bản mới trên master, gồm `imports only used builders sorted by name` với `type …ExtraConfigValue` đứng đầu chỉ khi có callback, `annotates every table config callback with the dialect extra config type`, `reports the type diagnostics of the dialect rules`, `throws RangeError for sqlserver` dùng `// @ts-expect-error` có lý do, snapshot `it.each` bốn fixture × hai dialect), rồi `generate-drizzle.ts` + `index.ts` (chỉ export `generateDrizzle`, type `DrizzleOptions`). Dùng `createSqlDdlContext` (types, dropped, names, `columnName`, `indexName`), `resolveForeignKeyActions` từ `shared/sql-ddl-model.ts`, `buildRelationFieldNames(schema, tableVariables)`, `listWrittenRelations`/`hasInverseField` của `drizzle-names.ts`. Callback chỉ có khi mảng ràng buộc không rỗng, luôn là `(table): PgTableExtraConfigValue[] => [` / `(table): MySqlTableExtraConfigValue[] => [`. Vượt 300 dòng thì tách `drizzle-tables.ts`, `drizzle-relations.ts` kèm test.
  - [ ] Ghi snapshot: `pnpm --filter @schemaforge/core exec vitest run src/generators/drizzle -u`, đọc lại từng file trong `src/generators/__snapshots__/drizzle/`.
  - [ ] Chạy `.claude/scripts/verify.sh core --build --format`, lệnh `node` với `@schemaforge/core/generators/drizzle` (mong đợi `function schema.ts`), `.claude/scripts/secret-scan.sh`, `git status --porcelain`.
- **Ghi chú cho người tiếp theo**
  - Đọc plan Task 18 bản mới ở tree chính (`document/plans/2026-09-15-code-generators-plan.md`, đã có R21), không đọc bản cũ trong worktree.
  - Shell: `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"`; `git` dùng `/usr/bin/git`. Log lỗi của `test-file.sh` nằm ở đường dẫn `log:` nó in ra.
  - `formatSqlLiteral` ném lỗi với `binary`, nhưng `findDefaultValueProblem` đã loại mọi literal `binary` trước đó.
  - `pgEnum`/`mysqlEnum` với enum không có giá trị không typecheck được (Drizzle cần tuple không rỗng); phần 2 cho `values` rỗng. Câu hỏi mở, chưa xử lý.

## 2026-10-03 04:23 — core-engineer — Xong

- **Đã làm**
  - GREEN `drizzle-columns`: viết `drizzle-columns.ts` (`renderDrizzleColumn`), test có sẵn từ lượt trước chuyển từ RED (`Cannot find module './drizzle-columns.js'`) sang `RESULT: PASS`. Phần giá trị mặc định tách ra `drizzle-defaults.ts` (`renderDrizzleDefault`) để file cột dưới 300 dòng; test của nó đi qua `renderDrizzleColumn` trong `drizzle-columns.test.ts`.
  - TDD `generateDrizzle`: viết `generate-drizzle.test.ts` trước, RED đúng lý do (`Cannot find module './generate-drizzle.js'`), rồi viết `drizzle-context.ts` (`createDrizzleContext`, `columnReference`), `drizzle-tables.ts` (block `pgTable`/`mysqlTable` và callback ràng buộc), `drizzle-relations.ts` (block `relations()`), `generate-drizzle.ts` (import, enum, customType, ghép file) và `index.ts` (chỉ `generateDrizzle`, type `DrizzleOptions`). GREEN: 41 test của file.
  - Mỗi quy tắc của Task 18 "Chữ ký và hành vi" và R21 có test riêng: import sắp theo tên với `type …ExtraConfigValue` đứng đầu chỉ khi có callback (hai dialect, có và không có callback); mọi callback có chú thích kiểu (vòng `a ↔ b`, tự tham chiếu, bảng không vòng: 4 callback chú thích, 0 callback trần); import `relations`/`sql` chỉ khi dùng (4 trường hợp); enum và customType trước bảng; khóa chính một và nhiều cột; unique, uniqueIndex, index, foreignKey; tên ràng buộc trùng `buildSqlDdlModel`; tự tham chiếu dùng `table.`; set default trên MySQL; khóa JSON bị bỏ; index cho cột auto-increment MySQL (R14, diagnostics rỗng); đổi tên cột MySQL; relations với `one`, `many`, `relationName`; bỏ trường ngược của 1-1 có tên; bảng chỉ có trường ngược bị bỏ thì không có block; JSDoc bảng/cột và escape `*/`; schema rỗng là `"\n"`; thứ tự key map; diagnostic kiểu theo quy tắc dialect; `RangeError` cho `sqlserver`; enum rỗng (quyết định orchestrator).
  - Ghi 16 file snapshot trong `src/generators/__snapshots__/drizzle/` (bốn fixture × hai dialect, mỗi cái `.ts` và `.diagnostics.txt`) và đọc lại từng file: bố cục đúng mục 4, 5 "Cấu trúc file"; tên ràng buộc trùng SQL; mặc định có kiểu và `sql.raw` đúng bảng plan (MySQL `longtext`/`json` có ngoặc, `CURRENT_TIMESTAMP(6)`, `(UUID())`, giây lẻ còn 6); `index("…_id_idx")` cho cột auto-increment MySQL; tên MySQL đổi (`ma2: varchar("má", …)`); escape JSDoc và chuỗi. Diagnostics của Drizzle bằng đúng diagnostics của Prisma cùng fixture và dialect, trừ `table-without-identifier` (mã riêng của Prisma).
  - Kiểm tra thêm ngoài plan: typecheck strict sáu snapshot không rỗng bằng `typecheckFiles` (file test tạm `packages/codegen-conformance/src/drizzle-tmp-check.test.ts`, đã xóa cùng thư mục `.tmp/` rỗng) → `Tests 6 passed (6)`, 0 diagnostic ở cả hai dialect với `drizzle-orm` đã cài.
- **File thay đổi** (chưa commit)
  - `packages/core/src/generators/drizzle/`: `drizzle-columns.ts` (mới), `drizzle-defaults.ts` (mới), `drizzle-context.ts` (mới), `drizzle-tables.ts` (mới), `drizzle-relations.ts` (mới), `generate-drizzle.ts` (mới), `index.ts` (mới), `generate-drizzle.test.ts` (mới), `drizzle-columns.test.ts` (đổi helper `modelType` từ `switch` có `default` sang `if` cho rule `switch-exhaustiveness-check`), `drizzle-names.ts`, `drizzle-names.test.ts` (từ lượt trước, không đổi).
  - `packages/core/src/generators/__snapshots__/drizzle/`: 16 file mới.
  - API công khai: subpath `@schemaforge/core/generators/drizzle` (đã có wildcard `./generators/*` từ Task 5) export `generateDrizzle` và type `DrizzleOptions`. Không đổi `src/index.ts`, `package.json`.
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core packages/core/src/generators/drizzle/drizzle-columns.test.ts` → `RESULT: PASS`.
  - `.claude/scripts/test-file.sh core packages/core/src/generators/drizzle/generate-drizzle.test.ts` → RED `Cannot find module './generate-drizzle.js'`, sau đó `RESULT: PASS`.
  - `pnpm --filter @schemaforge/core exec vitest run src/generators/drizzle --coverage.enabled=false` → `Test Files 3 passed (3)`, `Tests 126 passed (126)`.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test `Tests 2317 passed (2317)`, line coverage 97.99%, build, prettier --check).
  - `pnpm --filter @schemaforge/backend exec node --input-type=module -e '…generateDrizzle(testing.createSampleSchema(), { dialect: "postgresql" })…'` → `function schema.ts generateDrizzle`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Enum không có giá trị (quyết định orchestrator): ghi nguyên `pgEnum("name", [])` / `mysqlEnum("c", [])`, không thêm mã diagnostic (danh sách mã đã chốt); test `writes an enum without values as-is with no extra diagnostic` (hai dialect) khẳng định dòng output và diagnostics rỗng. **Giới hạn đã biết:** output này không typecheck được vì Drizzle cần tuple không rỗng; người dùng đã thấy `enum-values-empty` của phần 2. Không fixture conformance nào (`listConformanceFixtures`: sample, naming-edge, target-limit, empty) có enum rỗng.
  - Bảng có cột mà không có ràng buộc vẫn dùng bố cục nhiều dòng của mục 4 (`pgTable(\n  "t",\n  {\n    …\n  },\n);`), chỉ bỏ callback: một bố cục duy nhất, cột luôn thụt bốn khoảng như plan ghi cho JSDoc cột. Bảng không cột và không ràng buộc là `pgTable("t", {});` đúng plan.
  - Luôn ghi cả `.onDelete(…)` và `.onUpdate(…)` (như ví dụ của plan, kể cả `"no action"`), chuỗi hành động lấy từ `REFERENTIAL_ACTION_SQL[…].toLowerCase()` để không lặp bảng hành động.
  - Cột auto-increment bỏ qua `defaultValue` và không báo `default-omitted` ở cả hai dialect (giống `renderPrismaDefault`); plan chỉ ghi rõ cho MySQL, nhưng PostgreSQL `.generatedByDefaultAsIdentity()` cũng không đi với mặc định.
  - Test plan `renames a mysql column that differs only by an accent` đổi thành `renames a mysql column that differs only in case` (`ma`/`MA` → `MA_2`, key `ma2`): từ R20, `allocateMysqlNames` chỉ đổi tên khi trùng không phân biệt hoa thường (cặp chỉ khác dấu được giữ, xem `mysql-identifiers.test.ts`); Prisma và MySQL đã đổi tên test y như vậy.
  - `DRIZZLE_DIALECTS` khai báo `readonly string[]` để guard `RangeError` vẫn chạy cho caller không có kiểu mà không vướng `no-unnecessary-condition`.
  - Biến `customType` thiếu trong `customTypeVariables` là lỗi lập trình (allocator luôn cấp): `throw Error`, không lùi về `text`, vì `text` không có trong import MySQL.
  - `DrizzleColumnInput = DrizzleDefaultInput & { columnName, names }`: kiểu input của mặc định nằm ở `drizzle-defaults.ts` để không có vòng import giữa hai file.
- **Ghi chú cho người tiếp theo**
  - `drizzle-names.ts` tự tính lại `resolveSchemaColumnTypes` + `findUnindexableConstraints` trong `listWrittenRelations`; `createDrizzleContext` gọi nó thay vì lọc lại bằng `sql.dropped` để chỉ có một định nghĩa "quan hệ được ghi".
  - Cột có comment chứa U+0000 (fixture naming-edge) được ghi nguyên ký tự vào JSDoc qua `formatJsDocLines` (helper chung, giống TypeScript/Zod); typecheck vẫn sạch.
  - Typecheck đầy đủ trong CI là Task 30 (`src/drizzle.test.ts`).
