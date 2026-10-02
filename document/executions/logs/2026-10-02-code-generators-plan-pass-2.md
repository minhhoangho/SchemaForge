# Plan code generators, lượt 2

- Plan: [2026-09-15-code-generators-plan.md](../../plans/2026-09-15-code-generators-plan.md)
- Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md) (đọc bản trên đĩa, có mục "Quyết định bổ sung 2026-10-02" R1–R18 và mục "Vấn đề với các spec đã duyệt")

## 2026-10-02 — spec-writer — Dừng giữa chừng

- **Đã làm**
  - Phần khung của plan: intro (lượt 2), "Mục tiêu" (conformance local), "Điều kiện tiên quyết" (P2-26, P2-27, P3 đã xong; đường dẫn thật của code phần 3; Docker cho Task 8, 29, 30, 31, 35), "Cách dùng plan" (không CI, cổng conformance R3, execution log), quy ước snapshot (Vitest local tự ghi snapshot thiếu), mục mới "Conformance của task generator" trong "Quy ước chung".
  - "Điểm nóng": 17 mã diagnostic; dòng mới cho file validation và `issues.ts` (Task 36); dòng mới cho file editor phần 3 mà Task 34 sửa; `turbo.json` và script root thay job CI; probe local thay "chỉ chạy trong CI"; package conformance (Task 3 tạo cả `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `temp-directory.ts`; Task 29, 30, 31 sở hữu file test theo đích).
  - "Phiên bản": bảng kiểm tra lại ngày 2026-10-02; hàng image trỏ về `src/support/containers.ts`.
  - "Bảng task": thêm Task 36 (đợt 1); Task 4 sang đợt 2 (phụ thuộc 36); Task 8 sang đợt 3; Task 14–17 phụ thuộc 36; Task 15, 16 phụ thuộc kết quả probe local trong log Task 8; Task 21 phụ thuộc thêm Task 9; Task 32 phụ thuộc Task 3; Task 34 phụ thuộc 36; Task 35 thêm spec phần 2 và chạy lại toàn bộ conformance.
  - Task đã viết sửa theo quyết định: Task 2 (17 mã), 4 (fixture R1, R10, R11, R13, R14, comment, giây lẻ), 5 (17 mã), 6 (R12), 7 (giây lẻ SQL Server 7, MySQL 6), 9 (hậu tố `idx`, `autoIncrementIndexes`), 12 (768/3072, R1, R2, R10, R11, R13, R14, `resolveSchemaColumnTypes`, `mysqlRowBytes`, `sqlServerFixedKeyBytes`), 13 (`comment-truncated`, index thay thế R14, kiểu từ `resolveSchemaColumnTypes`), 14, 15, 16 (test mới, phụ thuộc probe).
  - Bảng "Vấn đề": thêm cột "Quyết định" cho Vấn đề 1–12; thêm Vấn đề 13–17.
  - Viết thân Task 3, 8, 36 ở mục "Các task còn lại".
- **File thay đổi**: `document/plans/2026-09-15-code-generators-plan.md`, file log này.
- **Kiểm tra**: script Python đếm `|` không escape trên mọi dòng bảng của plan: số cột khớp ở mọi bảng. `npm view` ngày 2026-10-02 cho `msw`, `drizzle-orm`, `shiki`, `testcontainers`, `@testcontainers/*`, `@dbml/core`, `mysql2`, `prisma`, `pg`, `@types/pg`, `mssql`, `@types/mssql`, `openapi-types`, `@readme/openapi-parser`, `zod`, `typescript` (kết quả trong bảng "Kiểm tra lại ngày 2026-10-02" của plan).
- **Quyết định**
  - ⚠ Task 36 gộp core và bản dịch frontend trong một task, một commit không scope (`feat: …`): `issues.ts` dùng `satisfies Record<IssueCode, string>`, tách ra thì frontend không biên dịch được giữa hai commit.
  - ⚠ Vấn đề 14: code panel đặt ở `frontend/src/features/editor/code-generator/` (giữ tên bảy file của spec) vì `nextjs.md` cấm feature import phần bên trong của feature khác; Task 35 cho cập nhật đường dẫn ở spec mục 8.
  - Vấn đề 13: Task 3 tạo luôn `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/support/temp-directory.ts` có test, để `pnpm typecheck`, `pnpm lint` ở root không đỏ giữa Task 3 và Task 8.
  - Task `test:conformance` của Turborepo có cache như spec mục 7, thêm `passThroughEnv` cho biến Docker, Testcontainers (chế độ env strict của Turborepo).
  - Vitest của package conformance chạy file tuần tự (`fileParallelism: false`) để máy dev không giữ nhiều container SQL Server cùng lúc; thư mục tạm nằm trong package (`.tmp/`) để file `.ts` sinh ra resolve được `zod`, `drizzle-orm`, `msw`.
  - `withDialectCustomTypes` đổi cả literal mặc định của cột custom sang literal hợp lệ của kiểu thay thế (`127.0.0.1`, `2024`, `12.50`), qua `applyOperation` với `updateColumn`.
  - `resolveSchemaColumnTypes` (Task 12) là điểm vào duy nhất cho kiểu cột của Task 13, 17, 18, vì R10 và R13 cần nhìn cả schema chứ không từng cột.
  - `allocateConstraintNames` cấp `<bảng>_<cột>_idx` cho mọi cột auto-increment ở mọi dialect để tên giống nhau giữa các đích; chỉ MySQL dùng.
  - Quan hệ bị bỏ khi tập `toColumnId` bằng tập cột của một khóa đã bị bỏ ở bảng đích (Task 12 không phụ thuộc Task 11).
  - MSW 3 đã phát hành: giữ MSW 2 theo spec (Vấn đề 15).
- **Việc còn lại**
  - [ ] Viết thân Task 17 (Prisma) ở cuối plan, sau Task 36. Điểm chốt: `PRISMA_RESERVED_WORDS` = `String`, `Boolean`, `Int`, `BigInt`, `Float`, `Decimal`, `DateTime`, `Json`, `Bytes`, `Unsupported`, `PrismaClient`; kiểu lấy từ `resolveSchemaColumnTypes(schema, provider)` và `findUnindexableConstraints`; enum `sqlserver` là `String @db.NVarChar(n)` (n tính như Task 16, viết lại cục bộ, không import `sqlserver/`) kèm `enum-not-supported`; `json` `sqlserver` kèm `type-not-supported`; `unique-nulls-restricted` cho mọi unique có cột nullable khi `sqlserver`; `table-without-identifier` → `@@ignore` và `@ignore` trên trường trỏ tới; bảng không cột → `@@ignore` (R6); MySQL index thay thế `@@index([field], map: "<bảng>_<cột>_idx")` (R14); `dbgenerated("…")` dùng `formatSqlLiteral` của Task 7; chuỗi Prisma escape như `JSON.stringify`; thứ tự khối và thuộc tính theo spec CG-02. Không phụ thuộc Task 9 ngoài tên index thay thế (bảng task đã có Task 9 trong phụ thuộc của Task 17, cho `autoIncrementIndexes`).
  - [ ] Viết thân Task 18 (Drizzle): biến export camelCase qua một allocator (enum hậu tố `Enum`, `customType` hậu tố `Type`, bảng, `<bảng>Relations`), từ dành riêng = `JAVASCRIPT_RESERVED_WORDS` cộng mọi tên import từ `drizzle-orm`; giá trị mặc định không có API có kiểu thì dùng `sql.raw(JSON.stringify(sqlLiteral))` từ `formatSqlDefault`; ràng buộc trong callback theo spec CG-03 với tên của Task 9; index thay thế MySQL `index("<bảng>_<cột>_idx")`; `longtext` cho cột R13. Thêm phụ thuộc Task 8 và một bước kiểm chứng sớm bằng `typecheckFiles` rằng hai bảng tham chiếu vòng qua callback qua `tsc` strict (rủi ro TS7022, spec mục Rủi ro); lỗi thì dừng và báo.
  - [ ] Viết thân Task 19 (TypeScript, `types.ts`), 20 (Zod, `schemas.ts`, pattern qua `new RegExp(JSON.stringify(…))`, enum rỗng → `z.never()`), 21 (`SeedDataset`: PRNG mulberry32 trong closure, luồng mỗi bảng từ `seed ^ fnv1a32(tên bảng)`, ngày giờ tính từ 2026-01-01 không dùng `Date`, base64 tự mã hóa, cột thuộc unique không nhận null, `MAX_ROW_ATTEMPTS`, quan hệ hoãn trên bảng không khóa chính giữ null, bảng bị bỏ không có trong `dataset.tables`, `validateSeedDataset` không throw với mọi dataset đúng kiểu), 22 (`serializeSeedDataset`: `DEFAULT` cho khóa thiếu, `NULL` cho giá trị không qua `isValidJsonValue`, chia `VALUES` 1000 dòng, `setval(pg_get_serial_sequence(…))`, `SET IDENTITY_INSERT`, `UPDATE` cuối file cho quan hệ hoãn, tên cột MySQL đã đổi; export type `SeedDataset` ở `src/index.ts`), 23 (Mock API, comment đầu file qua `formatJsDocLines`, ghi `msw@^2`), 24 (OpenAPI), 25 (DBML; kiểm tra nhanh khối `Project` rỗng bằng `@dbml/core` trong package conformance), 26 (Markdown).
  - [ ] Viết thân Task 27 (property test: dấu `§` trong mọi tên, comment, giá trị để kiểm tra phần còn lại sau khi bỏ định danh và chuỗi đã quote; `vi.setSystemTime` hai thời điểm cho cùng output; seed trên ba fixture với nhiều `seed`), Task 28 (`vitest bench`, mục tiêu đọc theo `p75` ≤ 100 ms vì Vitest không in trung vị; script `bench` trong `packages/core/package.json`).
  - [ ] Viết thân Task 29, 30, 31 (conformance theo spec mục 7; file sở hữu như dòng "Package mới" của "Điểm nóng"; Task 29 gồm kiểm tra comment đã cắt, tên chỉ khác dấu, `sys.foreign_keys`; Task 30 khớp schema Zod với bảng seed theo tập key; Task 31 chạy CRUD theo thứ tự GET list, GET item, PUT, DELETE, GET 404, POST lại 201, POST 409, POST `[]` 400).
  - [ ] Viết thân Task 32 (`shiki` cho frontend), 33 (worker, `worker-protocol.ts`, `generator-registry.ts`, `highlight-code.ts`, `use-generated-code.ts` trong `features/editor/code-generator/`; dòng import đầu của worker là `zod-config`; kiểm tra đường import Shiki 4 trong typings đã cài), 34 (store `rightPanelMode`, đích và option; nút "Code" `aria-pressed`; `PropertiesPanel` hoặc `CodePanel` qua `next/dynamic`, độ rộng `w-[32rem]`; tách `useGoToIssue` ra `features/editor/hooks/use-go-to-issue.ts`, không gọi `requestFocus` khi ở chế độ code; namespace `codeGenerator` gồm 23 nhãn Markdown và `generatorDiagnostics` 17 mã; `worker-src 'self'`; biến `--code-*` trong `globals.css`), 35 (roadmap, architecture, `CLAUDE.md`, spec phần 2 mục 8 và mục 7, plan phần 2, spec phần 6 mục 8 đường dẫn, kết quả benchmark, chạy toàn bộ kiểm tra và `pnpm test:conformance`, kiểm tra tay).
  - [ ] Thêm mục `## Đối chiếu tiêu chí hoàn thành` ở cuối plan: bảng ánh xạ mọi tiêu chí trong mục "Tiêu chí hoàn thành" của spec (đọc bản trên đĩa, đã thêm tiêu chí probe và hai issue mới) sang task.
  - [ ] Sau khi viết xong, chạy lại script đếm cột bảng và kiểm tra liên kết `#anchor` trong plan.
- **Ghi chú cho người tiếp theo**
  - Đọc trước: mục "Quy ước chung", "Điểm nóng", "Bảng task", "Vấn đề phát hiện khi lập plan" (nhất là 13–17) và thân Task 12, 13 của plan; spec mục 3, 4, 5, CG-02 đến CG-10, mục 7–10, "Tiêu chí hoàn thành", "Quyết định bổ sung 2026-10-02".
  - Task 1, Task 2 đã merge (commit 69ba87e, 6ebd8ab); không ghi trạng thái vào plan.
  - Plan chỉ chứa việc cần làm: không thêm trạng thái, dấu tick hay ghi chú tiến độ.
  - Spec được một spec-writer khác sửa song song; khi viết thân task, đối chiếu lại spec trên đĩa.

## 2026-10-02 — spec-writer — Xong

- **Đã làm**
  - Viết thân Task 17–35 ở mục "Các task còn lại" của plan, cùng cấu trúc với các task đã có (Mục tiêu, Phụ thuộc/Đợt, File sở hữu, Chữ ký và hành vi, Test viết trước, Kiểm tra kèm cổng conformance R3 khi đã có test của đích, Commit).
  - Thêm mục `## Đối chiếu tiêu chí hoàn thành`: mọi tiêu chí "Chung" và "Theo tính năng" của spec ánh xạ sang task.
  - Thêm Vấn đề 18 (phía ngược 1-1 có tên trong Drizzle) và Vấn đề 19 (`parseSeedDataset`) vào bảng "Vấn đề"; câu dẫn của bảng đổi thành "Vấn đề 13–19".
  - Theo tin nhắn của orchestrator: `resolveSchemaColumnTypes`, `SchemaColumnTypes`, `mysqlRowBytes`, `MYSQL_MAX_ROW_BYTES` nằm ở `generators/shared/dialect-column-types.ts` (Task 12 đã merge): sửa dòng `generators/shared/*` của "Điểm nóng", file sở hữu và ghi chú của Task 12, chỗ import ở Task 13, 17, 18.
  - Bảng task: thêm phụ thuộc thật mà thân task dùng: Task 18 thêm 8; Task 19 thêm 11; Task 22 thêm 11, 12; Task 25, 26 thêm 7. Không đổi đợt.
- **File thay đổi**: `document/plans/2026-09-15-code-generators-plan.md`, file log này.
- **Kiểm tra**
  - Script Python đếm `|` không escape trên mọi dòng bảng ngoài khối code: không có dòng lệch số cột. Không có liên kết `#anchor` hỏng.
  - `pnpm exec prettier --check document/plans/2026-09-15-code-generators-plan.md`: pass.
  - `drizzle-orm` 0.45.3 đã cài, `relations.d.ts` dòng 162–168 (2026-10-02): `RelationConfig` bắt buộc `fields`, `references`.
  - `@dbml/core` 10.2.0 đã cài, `Parser.parse(…, "dbmlv2")` (2026-10-02): nhận khối `Project "…" {}` rỗng, `TableGroup` rỗng, index một cột dạng `("a")`, `Ref` nhiều cột có quote, default số âm và dạng mũ, chuỗi `'''…'''`; từ chối `Enum` rỗng và `Table` không cột (cả hai là schema có issue).
- **Quyết định**
  - ⚠ `parseSeedDataset` (yêu cầu từ duyệt spec phần 5) đặt ở Task 21 (`seed-dataset.ts`, cạnh type `SeedDataset`), export ở `seed/index.ts` của Task 22; trả `Result<SeedDataset, readonly StructuralError[]>`, chỉ kiểm tra hình dạng (`z.partialRecord(columnIdShape, z.json())`), mã `invalid-shape` qua `toStructuralErrors`: dùng lại đúng mẫu `parseOperation` của phần 2, còn kiểm tra theo schema đã có `validateSeedDataset`.
  - ⚠ Drizzle: quan hệ 1-1 có tên (tự tham chiếu hoặc nhiều quan hệ giữa hai bảng) không ghi trường phía ngược (Vấn đề 18), vì `one()` của 0.45 không nhận `relationName` khi thiếu `fields`; phía khóa ngoại đủ cho relational query.
  - ⚠ Seed: bảng dừng sinh khi một dòng hết `SEED_MAX_ROW_ATTEMPTS` (20) lượt, thay vì thử dòng sau: dòng sau gặp cùng giới hạn; tự tham chiếu trỏ tới dòng ngay trước; quan hệ hoãn trên bảng không khóa chính giữ `null`; `validateSeedDataset` cho phép tham chiếu tới bảng nạp sau chỉ khi mọi cột nguồn nullable và bảng nguồn có khóa chính, nên `serializeSeedDataset` tính quan hệ hoãn từ chính dataset (`findDeferredSeedRelations`), dùng được với dataset của AI-06.
  - ⚠ Code panel rộng `w-[32rem]` (PropertiesPanel giữ `w-80`): đủ cho dòng DDL thường gặp mà canvas còn chỗ.
  - Prisma: không căn cột như `prisma format`; trường quan hệ phía khóa ngoại trước, phía ngược sau; ngày giờ và custom dùng `dbgenerated` với literal SQL của Task 7; `@ignore` chỉ trên trường của model không bị `@@ignore` (tránh cảnh báo thừa); bảng không cột nhận `@@ignore` cùng `table-without-identifier` theo quy tắc chung.
  - Drizzle: dành riêng toàn bộ danh sách tên import của dialect để tên biến không đổi khi schema đổi; giá trị mặc định có API có kiểu chỉ cho số nguyên nhỏ, boolean và chuỗi, còn lại `sql.raw` với literal của `formatSqlDefault`.
  - TypeScript dùng `allocateModelNames(schema, ["JsonValue"])`; Zod đặt tên `<camelCase>Schema` với `z` dành riêng; pattern qua `new RegExp(JSON.stringify(…))`.
  - Mock API: comment đầu file tiếng Anh cố định ghi `msw@^2`; giá trị JSON ghi qua `renderJsValue` riêng vì `JSON.stringify` của object có khóa `__proto__` đặt prototype; biến dữ liệu `rows<TypeName>`.
  - OpenAPI: mô tả response cố định tiếng Anh; 409 chỉ khi bảng có khóa chính; tham số đường dẫn dùng schema cột khóa bỏ nullable.
  - DBML và Markdown: hàm escape riêng trong thư mục đích (không có hàm tương đương trong `shared/`); Markdown escape cả nhãn.
  - Benchmark đọc mục tiêu trung vị theo `p75` (Vitest không in trung vị); vượt mục tiêu thì dừng, task tối ưu riêng.
  - Conformance Mock API lấy đường dẫn từ `paths` của `generateOpenApi` cùng fixture, Zod khớp bảng seed theo tập key, để test không import nội bộ core.
  - Task 35 giao cho `spec-writer` (chỉ sửa `document/` và mục "Commands" của `CLAUDE.md`); orchestrator chạy kiểm tra cuối và kiểm tra tay.
- **Việc còn lại**: không có trong plan. Ngoài plan:
  - [ ] Spec phần 5 (`document/specs/2026-10-02-ai-assistant-design.md`, dòng bảng subpath `@schemaforge/core/ai` và mục 9) còn ghi `parseSeedDataset` thuộc `@schemaforge/core/ai`; cần sửa thành `@schemaforge/core/generators/seed` theo Vấn đề 19.
- **Ghi chú cho người tiếp theo**
  - Plan chỉ chứa việc cần làm; không thêm trạng thái.
  - Thân Task 18 có bước kiểm chứng sớm bằng `typecheckFiles` cho bảng tham chiếu vòng (TS7022); kết quả xấu thì task dừng `Bị chặn`.
  - Task 30 dừng và báo nếu `prisma validate` từ chối U+0000 trong comment `///` của `naming-edge`.

## 2026-10-02 14:27 — spec-writer — Xong (sửa sau review)

- **Đã làm**: áp kết luận `needs-fix` của project-reviewer ([log review](2026-10-02-code-generators-plan-review.md)) và hai mục thêm từ review code nền, theo quyết định của orchestrator.
  - B1: Task 17 ghi literal `real`, `double` chứa `e`/`E` thành `dbgenerated(<formatPrismaString(formatSqlLiteral(…))>)`; test `writes an exponent real default as dbgenerated`.
  - B2: Task 18 thêm `table`, `one`, `many` vào `reserved` của allocator biến Drizzle; test `appends 2 to a table named like a callback parameter` (`it.each` ba tên).
  - B3: phương án B. Task 17, 18 phụ thuộc Task 13; đợt 4 = 13, 19, 20, 21, 24; đợt 5 = 14, 15, 17, 18; Task 16 sang đợt 6 (xem Quyết định); đợt 6 = 16, 22, 23, 25, 26; đợt 7 = 27, 29, 30, 31, 32; Task 28 phụ thuộc 27, đợt 8 riêng; Task 33, 34, 35 giữ đợt 9, 10, 11. Sửa dòng "Phụ thuộc/Đợt" trong thân Task 16, 17, 18, 21, 24, 28, 32 và đường tới hạn.
  - B4: Task 33 `loadGenerator` dùng record ánh xạ `{ readonly [K in GeneratorTarget]: () => Promise<Generate<K>> }` và `return loaders[target]()`, mỗi mục một `import()` literal; bỏ chữ "một `switch`".
  - S5: Task 27 "đủ 18 tên" kèm phép đếm.
  - S6: Task 18 chọn `.default()` có kiểu hay `sql.raw` theo `DialectColumnType.kind`; MySQL `text`, `json`, `binary` luôn `sql.raw` trong ngoặc; test `uses sql.raw for a mysql varchar widened to longtext` và test cho `keyText`.
  - S7: Task 21 `parseSeedDataset` quét độ sâu bằng stack tường minh trước `safeParse` (như `parseOperation`), hằng `SEED_DATASET_MAX_DEPTH = 64`; `rows` có `.max(SEED_ROWS_PER_TABLE_MAXIMUM)`; test `returns invalid-shape instead of throwing for deeply nested values`, test giới hạn 1000 dòng và test độ sâu đúng giới hạn.
  - S8: Task 35 thêm vào phần spec phải sửa: mục 4 dòng "Quan hệ 1-1" và CG-03 "Relations v1" (Vấn đề 18), CG-08 "Quan hệ với AI-06" với `parseSeedDataset` (Vấn đề 19); xóa câu lỗi thời ở Vấn đề 19 về spec phần 5; cột "Ảnh hưởng" của Vấn đề 18, 19 thêm Task 35.
  - S9: Task 17 tạo `packages/core/src/generators/shared/sqlserver-enum-length.ts` (`SQLSERVER_MAX_NVARCHAR_LENGTH`, `sqlServerEnumLength`) kèm test; Task 16 import, không còn export `sqlServerEnumLength`, phụ thuộc Task 17; dòng `generators/shared/*` của "Điểm nóng" ghi ngoại lệ này.
  - N10: Task 25 ghi giới hạn `'''…'''` của `@dbml/core` 10.2; Task 31 loại chuỗi nhiều dòng mà mọi dòng bắt đầu bằng khoảng trắng khỏi phép so nội dung.
  - N11: Task 34 bắt buộc test mới `frontend/src/lib/i18n/code-generator-messages.test.ts` (thêm vào file sở hữu và dòng i18n của "Điểm nóng").
  - N12: Task 19 dành riêng `Record`; test `suffixes a table named Record so an empty table still uses the global Record`.
  - N13: Task 21 ghi `sequence` bắt đầu từ 1; test R14 của Task 17, 18 dùng khóa chính `(tenant_id, id)` và khẳng định `diagnostics` rỗng.
  - X1: Task 8 thêm probe MySQL 17 (`timestamptz` với `-00:00`) và 18 (`ß`/`s`, `ð`/`d` dưới `utf8mb3_general_ci`), đều là probe ghi kết quả, kèm việc tiếp theo nếu khác kỳ vọng (sửa `sql-literals.ts` đổi `Z`, `-00:00` thành `+00:00`; thêm ký tự vào danh sách gộp R12 trong `name-allocator.ts`); dòng probe của "Điểm nóng" ghi hai probe này không chặn Task 15, 16.
  - X2: spec phần 6 thêm R19 vào bảng "Sửa sau review ngày 2026-10-02", câu mặc định Prisma `mysql` ở mục 3, dòng ma trận mới ở mục 4; Task 17 ghi quy tắc và test `writes a mysql default on longtext, json and a varchar widened to longtext as a parenthesized dbgenerated`.
  - Ghi log review của project-reviewer: [2026-10-02-code-generators-plan-review.md](2026-10-02-code-generators-plan-review.md).
- **File thay đổi**: `document/plans/2026-09-15-code-generators-plan.md`, `document/specs/2026-09-14-code-generators-design.md` (chỉ R19), file log này, `document/executions/logs/2026-10-02-code-generators-plan-review.md` (mới).
- **Kiểm tra**: `pnpm exec prettier --check` trên plan, spec và hai log: đạt. Script Python đếm `|` không escape ngoài khối code: mọi bảng của bốn file khớp số cột. Mọi liên kết `#anchor` của plan và spec trỏ tới tiêu đề có thật; liên kết tương đối của hai log tồn tại. `grep` không còn `sqlServerStringEnumLength`, "đủ 20", "một `switch`" và câu lỗi thời ở Vấn đề 19. Kiểm tra lại từng đợt: mỗi đợt tối đa 5 task, phụ thuộc của mọi task nằm ở đợt trước, file sở hữu trong cùng đợt rời nhau.
- **Quyết định**
  - B1–B4, S5–S9, N10–N13, X1, X2: quyết định của orchestrator, áp nguyên văn như trên.
  - ⚠ Task 16 sang đợt 6, không ở đợt 5 như B3 ghi: S9 làm Task 16 phụ thuộc Task 17, mà hai task không thể chạy song song trong cùng đợt. Đợt 5 còn 4 task (14, 15, 17, 18); đợt 6 đủ 5 task. Orchestrator đổi lại được nếu muốn Task 16 dùng bản sao tạm thời thay vì chờ Task 17.
  - Task 32 lên đợt 7 (phụ thuộc chỉ P3, 3) để Task 28 đứng riêng ở đợt 8 theo B3; Task 33, 34, 35 giữ số đợt.
  - R19 dùng `formatSqlDefault({ …, shouldParenthesizeLiteral: true })` của Task 7 cho chuỗi trong `dbgenerated`, cùng hàm Task 13, 18 dùng, để ba đích chung một quy tắc ngoặc.
  - Quy tắc literal của Task 17 xét theo thứ tự: R19 trước, rồi số dạng mũ, rồi literal Prisma, rồi `dbgenerated` cho ngày giờ và custom.
  - `SEED_DATASET_MAX_DEPTH = 64`: đủ rộng cho mọi giá trị `json` hợp lý (dataset do `buildSeedDataset` dựng sâu nhất cấp 5), đủ nông để Zod không tràn stack. Test lồng sâu dựng input bằng `JSON.parse("[".repeat(…))` để test không có vòng lặp.
  - Test i18n mới đặt ở `frontend/src/lib/i18n/` cạnh các test i18n hiện có (không có test nào nằm trong `locales/`).
- **Việc còn lại**: không có. Mục ngoài plan của lượt trước (sửa spec phần 5 về `parseSeedDataset`) đã giải quyết: spec phần 5 đã commit ghi `@schemaforge/core/generators/seed` (dòng 25 của "Tóm tắt quyết định", AI-R43, bảng "Vấn đề với các spec đã duyệt" dòng 9).
- **Ghi chú cho người tiếp theo**
  - Plan chỉ chứa việc cần làm; không thêm trạng thái.
  - Probe MySQL 17, 18 của Task 8 không chặn; kết quả khác kỳ vọng sinh task tiếp theo chạy trước Task 15.

## 2026-10-02 14:50 — spec-writer — Xong (sửa sau duyệt lại)

- **Đã làm**: áp 7 phát hiện của lượt duyệt lại ([log review](2026-10-02-code-generators-plan-review.md), mục "Xong (duyệt lại)") theo quyết định của orchestrator.
  - 1 (chặn): Task 21 bước 4 viết lại: duyệt quan hệ không hoãn theo `sortRelations`; ứng viên là dòng đích có đủ `toColumnId` khác `null` và khớp (so bằng `JSON.stringify`) các cột nguồn đã được quan hệ trước gán trong cùng dòng; quy tắc null: chỉ gán `null` khi mọi cột nguồn chưa gán nullable và quan hệ chưa có cột nguồn nào được gán, nếu không thì dòng thất bại và bước 5 sinh lại. Tự tham chiếu dùng cùng điều kiện khớp. Bước 6 dùng cùng quy tắc cho quan hệ hoãn. Thêm test `picks a parent row that agrees with a column shared by two relations` (schema `tenants`, `users(tenant_id, id)`, `orders(tenant_id, user_id)` dựng bằng factory, khẳng định `validateSeedDataset` trả mảng rỗng).
  - 2: Task 4 ghi cột khóa ngoại của vòng `(i + 1) % tableCount` là nullable (vòng cascade vẫn còn cho SQL Server, seed coi là quan hệ hoãn). Task 28 khẳng định một lần ở cấp module, ngoài `bench`, rằng `buildSeedDataset(schema, { rowsPerTable: 100, seed: 1 }).dataset.tables` có ít nhất một bảng có dòng.
  - 3: Task 21 bước 5 giữ nguyên hành vi, dẫn tới Vấn đề 20 mới; câu dẫn bảng "Vấn đề" đổi thành "Vấn đề 13–20"; Task 35 thêm sửa bullet "Unique" của CG-08 (file sở hữu, mục tiêu, phần "Cài đặt").
  - 4: Vấn đề 19 bỏ câu lỗi thời, ghi "khớp với spec phần 5 (AI-R43)".
  - 5: Task 18 định nghĩa "bảng có trường quan hệ" là bảng có ít nhất một trường thật sự được ghi (trường phía ngược 1-1 có tên bị bỏ theo Vấn đề 18 không tính), dùng cho cả biến `…Relations` và block `relations()`; thêm test `writes no relations block for a table whose only field is an omitted named one-to-one inverse`.
  - 6: Task 31 chỉ chọn bảng có mọi cột khóa không phải `json` cho chuỗi CRUD; không sửa `hasKey`.
  - 7: Task 13 bước 1 ghi `findUnindexableConstraints(schema, dialect, types.types)`.
  - Ghi entry "Xong (duyệt lại)" của project-reviewer vào log review.
- **File thay đổi**: `document/plans/2026-09-15-code-generators-plan.md` (Task 4, 13, 18, 21, 22, 28, 31, 35, bảng "Vấn đề"), `document/executions/logs/2026-10-02-code-generators-plan-review.md`, file log này. Spec không đổi.
- **Kiểm tra**: `pnpm exec prettier --check` trên plan, spec và hai log: đạt. Script Python đếm `|` không escape ngoài khối code: mọi bảng của plan khớp số cột. Không thêm liên kết `#anchor` mới; liên kết tương đối tới log review tồn tại. `grep` không còn "13–19", "đầu tiên chứa cột", `core/ai` trong plan.
- **Quyết định**
  - Phát hiện 1–7: quyết định của orchestrator, áp như trên.
  - ⚠ Bước 6 (quan hệ hoãn) không sinh lại dòng vì dòng đã được bảng khác tham chiếu: khi quy tắc null không cho (cột nguồn chung đã được quan hệ khác gán, không có ứng viên khớp), các cột nguồn chưa gán của quan hệ hoãn giữ `null`. Hợp lệ vì mọi cột nguồn của quan hệ hoãn nullable và khóa ngoại có cột `null` không được kiểm tra (cả `validateSeedDataset` lẫn database).
  - Ở bước 4, quan hệ hoãn không tham gia duyệt; sau khi duyệt, cột nguồn của chúng chưa được quan hệ không hoãn nào gán nhận `null`. Như vậy cột dùng chung giữa quan hệ hoãn và quan hệ không hoãn luôn lấy giá trị từ quan hệ không hoãn.
  - ⚠ Task 22 (quyết định của orchestrator sau báo cáo): `INSERT` chỉ ghi `NULL` cho cột chỉ thuộc quan hệ hoãn (cột nguồn của quan hệ hoãn không là cột nguồn của quan hệ không hoãn nào cùng bảng); cột dùng chung giữ giá trị của dòng vì dòng cha của quan hệ không hoãn đã nạp trước; `UPDATE` hoãn chỉ `SET` các cột chỉ thuộc quan hệ hoãn, quan hệ không có cột nào như vậy thì không có `UPDATE`. Lý do: `seed.sql` và `seed.json` phải luôn khớp. Thêm test `keeps a column shared with a non-deferred relation in the insert` trong `serialize-seed-dataset.test.ts`.
  - Test đa tenant đặt `rowsPerTable` từ 5 trở lên và khẳng định thêm `orders` đủ số dòng, để test bắt được trường hợp dòng bị bỏ do thất bại liên tục.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**
  - Plan chỉ chứa việc cần làm; không thêm trạng thái.
  - Task 22 đã sửa theo quyết định ⚠ ở mục Quyết định: cột nguồn dùng chung giữa quan hệ hoãn và quan hệ không hoãn giữ giá trị trong `INSERT`, nên seed SQL và seed JSON khớp.
