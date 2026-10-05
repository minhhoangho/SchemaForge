# Task 15: IE-02 importer Prisma

- Plan: [Task 15](../../plans/2026-10-03-import-export-plan.md#task-15-ie-02-importer-prisma)
- Spec: [mục 6 IE-02 Import Prisma](../../specs/2026-09-15-import-export-design.md#6-ie-02-import-prisma), [mục 15 Test](../../specs/2026-09-15-import-export-design.md#15-test)

## 2026-10-05 20:05 — core-engineer — Xong

- **Đã làm**
  - `importPrisma: Importer` (subpath `@schemaforge/core/importers/prisma`): `checkSourceLength` → `parsePrismaSchema` (lỗi thì `syntax-error` tại token sai) → `buildPrismaDraft` → `assembleDocument`.
  - `buildPrismaDraft(schema: PrismaSchema): ImportDraft`: chọn provider từ `datasource` đầu tiên (thiếu hoặc khác ba dialect thì `postgresql` kèm `provider-not-supported`, vị trí là thuộc tính `provider`, rồi khối `datasource`, rồi `null`); bỏ qua `generator`; `view` → `view-not-supported`, `type` → `composite-type-not-supported` (cả khối bị bỏ); dựng các map tên `tableNameByModel`, `columnNameByField`, `enumNamesByPrismaName`, `enumValuesByPrismaName` theo `@@map`/`@map` rồi gọi `mapPrismaScalarField` và `buildPrismaRelations` của Task 14.
  - Model → bảng: trường có kiểu là model không thành cột; trường có kiểu là khối `type` bị bỏ kèm `composite-type-not-supported` tại trường (path `null`); trường có kiểu là `view` đi qua Task 14 (`text` kèm `type-not-supported`). `@id`/`@@id` (thứ tự giữ nguyên), `@unique`, `@@unique`/`@@index` (`map` là tên, không có thì `name: null`), tùy chọn `sort`, `length`, `type`, `ops`, `clustered` và mọi đối số có tên khác `map`/`name`/`fields` → `index-option-dropped` (path index, `["tables", id, "primaryKeyColumnIds"]` hoặc `["columns", id, "isUnique"]`); `@@ignore`/`@ignore` bỏ qua; `@@schema` → `namespace-dropped`; `@updatedAt` → `updated-at-not-supported`; `///` của model, trường thành comment; `///` của enum, giá trị enum → `comment-dropped` (path enum).
  - Fixture: `db-pull.fixture.ts` (dạng `prisma db pull` của DDL sample trên PostgreSQL, và ba bảng `tenants`, `users`, `orders` trên MySQL, kèm `…_EXPECTED`), `prisma-features.fixture.ts` (năm schema: PostgreSQL, MySQL, SQL Server, multi-schema, MongoDB), `fixtures/index.ts` (`PRISMA_IMPORT_FIXTURES`, bảy fixture). `PRISMA_IMPORT_FIXTURES` export qua `@schemaforge/core/testing` (Vấn đề 15).
  - Round-trip: PostgreSQL bằng nhau theo cấu trúc (sau khi bỏ tên schema, subject area, ghi chú) và không diagnostic với ba fixture; MySQL, SQL Server là điểm bất động với ba fixture.
- **File thay đổi** (tất cả trong `packages/core/src/`)
  - Tạo: `importers/prisma/index.ts`, `import-prisma.ts`, `import-prisma.test.ts`, `import-prisma.roundtrip.test.ts`, `prisma-draft.ts`, `prisma-draft.test.ts`, `prisma-draft-model.ts` (tách từ `prisma-draft.ts`), `prisma-attribute-args.ts` (tách, đọc đối số thuộc tính), `fixtures/db-pull.fixture.ts`, `fixtures/prisma-features.fixture.ts`, `fixtures/index.ts`.
  - Sửa: `testing/index.ts`, `testing/index.test.ts` (thêm `PRISMA_IMPORT_FIXTURES`).
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core src/importers/prisma/prisma-draft.test.ts` → FAIL (thiếu `prisma-draft.js`); `import-prisma.test.ts` → `Cannot find module './import-prisma.js'`; `testing/index.test.ts` → FAIL (thiếu export).
  - GREEN: ba file test trên và `import-prisma.roundtrip.test.ts` → PASS.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 4004/4004, line coverage 97.79%, build, prettier). Hai lần chạy trước có hai test không liên quan timeout do máy tải cao (load ~340): `statement-scanner.test.ts` "scans a 2 MiB source…", `seed-dataset.test.ts` "very wide array"; chạy riêng bằng `test-file.sh` đều PASS.
  - `pnpm typecheck` ở root → exit 0.
  - `grep -l "dbml"` trên các file `.js` của `dist/importers/prisma/` → không in gì; các file shared mà Prisma import chỉ nhắc `@dbml/core` trong comment.
  - `prisma validate` 7.10.0 (`packages/codegen-conformance/node_modules/.bin/prisma`) với cả bảy fixture (ghi ra scratchpad từ `dist/testing/index.js`) → đều "is valid".
- **Quyết định**
  - `comment-dropped` của giá trị enum có `location` là vị trí giá trị, path là enum; của enum là vị trí từ khóa `enum`.
  - `@@schema` trên enum → `namespace-dropped` path `["enums", id]` (bảng mã Task 2 chỉ ghi `["tables", id]`; không báo thì là bỏ cú pháp im lặng).
  - `@@fulltext` (MySQL) → index thường kèm `index-type-dropped` path `["indexes", id]`: spec mục 6 không nêu, nhưng `prisma db pull` sinh nó và không được bỏ im lặng.
  - Danh sách trường không đọc được (`@@index([])`, `@@unique` không đối số, mục không phải tên trường) → `reference-not-found` tại thuộc tính, path `null`, phần tử bị bỏ (khóa chính thành rỗng).
  - `map:` trên `@id`, `@@id`, `@unique` và `name:` trên `@@id`, `@@unique`, `@@index` bị bỏ im lặng như `@relation(map:)`: tên ràng buộc, tên accessor của Prisma Client không có chỗ trong model và không mất cấu trúc.
  - Thuộc tính khác ngoài danh sách spec (ví dụ `@@shardKey`) bị bỏ qua không diagnostic: không có mã phù hợp trong bảng 39 mã.
  - Round-trip PostgreSQL với `target-limit`: generator đã kẹp `pg_varchar` (`varchar(10485761)` → `text`) và `pg_decimal` (`precision 1001` → `1000`) kèm `type-parameter-out-of-range`; test so với fixture đã áp đúng hai kẹp này (hằng `POSTGRESQL_CLAMPED_TYPES` trong test).
  - So round-trip qua `withoutPrismaLosses(schema, name)` (export từ `db-pull.fixture.ts`, dùng chung cho `DB_PULL_POSTGRESQL_EXPECTED`): Prisma không có tên schema, subject area, ghi chú; test truyền `fallbackSchemaName: schema.name`.
  - Fixture PostgreSQL db pull giữ `Unsupported("geometry(Point, 4326)")` như sample (db pull thật có thể in `geometry(Point,4326)`; conformance Task 20 so trên database thật).
  - Hạn chế đã biết (theo quyết định orchestrator): chỉ tiền tố `db.` của thuộc tính native được hiểu.
- **Việc còn lại**: không trong phạm vi task. Câu hỏi mở cho orchestrator:
  - [ ] `prisma-type-mapping.ts` (Task 14) chỉ coi `@default(uuid())` là "có mặc định UUID", nên MySQL `String @default(dbgenerated("(uuid())")) @db.Char(36)` (dạng `prisma db pull` thật) thành `char(36)` và mặc định bị bỏ kèm `default-not-supported`, trái quy tắc `CHAR(36)` kèm `(UUID())` → `uuid` của spec mục 5 mà mục 6 dẫn tới. Test `imports the MySQL db pull fixture` và `DB_PULL_MYSQL_EXPECTED` đang ghi hành vi hiện tại (có comment); sửa ở Task 14 thì đổi hai chỗ này thành `uuid` + `generateUuid`, không diagnostic.
  - [ ] Task 20: dùng `PRISMA_IMPORT_FIXTURES` từ `@schemaforge/core/testing`; fixture `features-postgresql` cần `previewFeatures = ["views"]` (đã có), `features-mongodb` dùng provider `mongodb`.
- **Ghi chú cho người tiếp theo**
  - Id trong test diagnostic tính theo bộ đếm toàn cục của `createImportTestOptions()`: enum, bảng, cột từng bảng, index, quan hệ.
  - `buildPrismaRelations` chỉ xét khối `model`; trường kiểu `view` đi đường cột của Task 14.
