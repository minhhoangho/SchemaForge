# Task 14: Ánh xạ kiểu, giá trị mặc định và quan hệ Prisma

- Plan: [Task 14](../../plans/2026-10-03-import-export-plan.md#task-14-ánh-xạ-kiểu-giá-trị-mặc-định-và-quan-hệ-prisma)
- Spec: [mục 6 IE-02 Import Prisma](../../specs/2026-09-15-import-export-design.md#6-ie-02-import-prisma)

## 2026-10-05 19:20 — core-engineer — Xong

- **Đã làm**
  - `mapPrismaScalarField(field, context)`: bảng kiểu theo `provider` (kiểu mặc định khi không có `@db.*`), `@db.*` đọc qua `mapSqlType` của Task 10, `Unsupported` an toàn/không an toàn, danh sách `T[]` thành `custom` `<kiểu native>[]` kèm `scalar-list-as-custom`; giá trị mặc định (`autoincrement`, `now`, `uuid`/`uuid(4)`/`uuid(7)`, `cuid`/`nanoid`/`ulid`/`sequence` bỏ, `dbgenerated` qua `mapSqlDefault`, chuỗi, số, boolean, giá trị enum sau `@map`).
  - `buildPrismaRelations(blocks, context)`: ghép `fields`/`references` theo thứ tự với tên cột sau `@map`, loại theo trường ngược (khớp cả tên quan hệ, kể cả quan hệ tự thân), `back-relation-missing` kèm suy loại theo unique (`@id`, `@@id`, `@unique`, `@@unique`), hành động tường minh và mặc định theo provider, bỏ n-n ngầm (báo một lần cho cặp trường).
  - TDD: RED `Cannot find module './prisma-type-mapping.js'` và `'./prisma-relations.js'`; GREEN sau khi cài đặt.
- **File thay đổi**
  - `packages/core/src/importers/prisma/prisma-type-mapping.ts` (252 dòng), `prisma-type-mapping.test.ts` (424)
  - `packages/core/src/importers/prisma/prisma-default-mapping.ts` (136, tách từ type mapping cho file ngắn; test qua `prisma-type-mapping.test.ts`)
  - `packages/core/src/importers/prisma/prisma-relations.ts` (267), `prisma-relations.test.ts` (319)
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 3914 pass, build, prettier); coverage dòng toàn core 97.75%, không có dòng dưới ngưỡng.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `@db.*` luôn đi qua `mapSqlType` (văn bản SQL `tên(đối số)` viết thường) thay vì chỉ các dòng trong bảng spec: giữ được điểm bất động MySQL (`Bytes @db.LongBlob` → `binary`), và quy tắc độ chính xác, `char(36)` + `uuid()` khớp mục 5. Hệ quả: MySQL `@db.Text` → `text` kèm `type-approximated` (như SQL).
  - Tên Prisma `UnsignedInt`… của MySQL đổi sang `int unsigned`… trước khi gọi `mapSqlType`.
  - Kiểu native khác bảng thành `custom` tên viết thường (`@db.Inet` → `inet`).
  - Phần tử của danh sách: `@db.*` nếu có, tên enum trong database, `Unsupported`, hoặc kiểu native mặc định PostgreSQL của Prisma (`integer`, `double precision`, `decimal(65,30)`, `timestamp(3)`, `jsonb`, `bytea`…); áp cho mọi provider (Prisma chỉ cho danh sách trên PostgreSQL).
  - Kiểu vô hướng lạ (không phải scalar, enum, model) → `text` kèm `type-not-supported`; đối số `@db.*` không phải số/định danh → như vậy.
  - `@default` có tham số có tên (`map:` của SQL Server) bỏ qua tên đó; không có đối số vị trí → `default-not-supported`; `uuid(n)` với n khác 4, 7 → `default-not-supported`.
  - `fields`/`references` thiếu, rỗng, khác độ dài hoặc không phải định danh: bỏ quan hệ, `reference-not-found` tại vị trí `@relation`.
  - `onDelete`/`onUpdate` có giá trị lạ thì dùng mặc định của Prisma.
  - Vị trí: diagnostic kiểu ở `@db.*` (không có thì ở trường), diagnostic mặc định ở `@default`; `DraftRelation.location` là vị trí trường quan hệ; n-n ngầm ở trường gặp trước.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo** (Task 15)
  - Chỉ trường có kiểu là tên khối `model` mới là trường quan hệ (`buildPrismaRelations` tự lọc `kind === "model"`); Task 15 dùng cùng quy tắc khi bỏ trường quan hệ khỏi cột. Trường trỏ tới khối `type` hoặc `view` sẽ thành `text` + `type-not-supported` nếu gọi `mapPrismaScalarField`; Task 15 quyết định có báo `composite-type-not-supported` thay hay không.
  - `context.enumNamesByPrismaName` và `enumValuesByPrismaName` phải do Task 15 dựng từ `@@map`/`@map`; `tableNameByModel`, `columnNameByField` thiếu khóa thì dùng tên Prisma.
  - Chỉ nhận thuộc tính native có tiền tố `db.`; datasource tên khác `db` chưa hỗ trợ.
  - `@relation(map: …)` (tên khóa ngoại) bị bỏ qua, model không có tên ràng buộc.
