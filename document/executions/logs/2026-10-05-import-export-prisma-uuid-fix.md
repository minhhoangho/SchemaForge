# Sửa lỗi: importer Prisma nhận `dbgenerated("(uuid())")` là default UUID

- Plan: [Task 15](../../plans/2026-10-03-import-export-plan.md#task-15-ie-02-importer-prisma) (câu hỏi mở 1 trong [log Task 15](./2026-10-05-import-export-task-15.md))
- Spec: [mục 5 Import SQL](../../specs/2026-09-15-import-export-design.md) (quy tắc MySQL `CHAR(36) DEFAULT (UUID())` → `uuid`), [mục 6 IE-02 Import Prisma](../../specs/2026-09-15-import-export-design.md#6-ie-02-import-prisma)

## 2026-10-05 20:40 — core-engineer — Xong

- **Đã làm**
  - `mapPrismaScalarField` quyết định `hasUuidDefault` qua hàm mới `isUuidDefault`: ngoài `uuid()` như trước, một `@default(dbgenerated("…"))` có biểu thức mà `mapPrismaDefault` (tức `mapSqlDefault` với dialect của provider, `columnType: { kind: "uuid" }`) ánh xạ ra `generateUuid` cũng được tính là default UUID. Nhờ vậy dạng `prisma db pull` thật trên MySQL `String @default(dbgenerated("(uuid())")) @db.Char(36)` thành cột `uuid` với default `generateUuid`, không còn `default-not-supported`.
  - Test viết trước (RED): `.claude/scripts/test-file.sh core src/importers/prisma/prisma-type-mapping.test.ts` → `Tests  2 failed | 113 passed (115)`; sau khi sửa → `RESULT: PASS`.
  - Cập nhật kỳ vọng đã ghi nhận lỗ hổng: `DB_PULL_MYSQL_EXPECTED` (cột `tenants.id` thành `uuid` + `generateUuid`, bỏ comment mô tả lỗ hổng) và test db pull MySQL trong `import-prisma.test.ts` (không còn diagnostic nào).
- **File thay đổi**
  - `packages/core/src/importers/prisma/prisma-type-mapping.ts`
  - `packages/core/src/importers/prisma/prisma-type-mapping.test.ts`
  - `packages/core/src/importers/prisma/fixtures/db-pull.fixture.ts`
  - `packages/core/src/importers/prisma/import-prisma.test.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format` (lần cuối): typecheck, lint, build, format PASS; test `2 failed | 4354 passed (4356)` → `RESULT: FAIL (core test)`. Hai test hỏng là timeout do máy quá tải, không liên quan: `import-dbml.test.ts > reports too-many-elements past the element limit` (`Test timed out in 60000ms`) và `seed-dataset.test.ts > returns invalid-shape instead of throwing for a very wide array` (`Test timed out in 5000ms`). Lần chạy trước còn timeout thêm `statement-scanner.test.ts > scans a 2 MiB source`. Chạy riêng cả ba file bằng `.claude/scripts/test-file.sh` đều `RESULT: PASS`. Vì có test hỏng nên Vitest không in bảng coverage.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Giữ nguyên hành vi cũ cho mọi `uuid(...)` (kể cả đối số lạ); chỉ thêm nhánh `dbgenerated`. Biểu thức `dbgenerated` không ra UUID (ví dụ `(now())`, đối số không phải chuỗi) vẫn giữ kiểu `char(36)` như trước.
  - Dùng lại `mapPrismaDefault` thay vì gọi `mapSqlDefault` trực tiếp để không lặp lại việc đọc đối số của `dbgenerated`.
  - Cột khóa ngoại `users.tenant_id`/`orders.tenant_id` trong fixture vẫn là `char(36)` (không có default nên không áp dụng quy tắc), đúng với spec.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: máy rất tải; các test input lớn (2 MiB, mảng rất rộng, giới hạn phần tử) có thể timeout khi chạy cả bộ — chạy lại riêng file đó trước khi kết luận là lỗi.
