# Task 17: CG-02 Prisma schema

Plan: [Task 17](../../plans/2026-09-15-code-generators-plan.md#task-17-cg-02-prisma-schema). Spec: [CG-02](../../specs/2026-09-14-code-generators-design.md#cg-02-prisma-schema).

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Tạo `generators/shared/sqlserver-enum-length.ts` (`SQLSERVER_MAX_NVARCHAR_LENGTH`, `sqlServerEnumLength`) cho Task 16 import.
  - Tạo generator `@schemaforge/core/generators/prisma`: `generatePrisma(schema, { provider })` in `schema.prisma` (khối `generator client`, `datasource db` không `url`, enum theo `sortEnums` trừ `sqlserver`, model theo `sortTables`).
  - Kiểu theo bảng spec mục 3 (`renderPrismaFieldType`), mặc định theo bốn quy tắc của plan theo đúng thứ tự (R19 trước, rồi số mũ `real`/`double`, rồi literal trần, rồi `dbgenerated` cho ngày giờ/custom), quan hệ hai phía, `@@id`/`@@unique`/`@@index`/`@@map`/`@@ignore`, index thay thế R14 trên MySQL, `@ignore` trên trường quan hệ trỏ tới model bị bỏ qua.
  - Snapshot 4 fixture × 3 provider (24 file trong `__snapshots__/prisma/`), đã đọc lại và đối chiếu với spec.
- **File thay đổi** (tất cả mới)
  - `packages/core/src/generators/shared/sqlserver-enum-length.ts`, `sqlserver-enum-length.test.ts`
  - `packages/core/src/generators/prisma/index.ts`, `generate-prisma.ts`, `generate-prisma.test.ts`, `prisma-field-type.ts`, `prisma-field-type.test.ts`, `prisma-model.ts`, `prisma-model.test.ts`
  - File tách thêm (quy tắc "vượt 300 dòng thì tách `prisma-<phần>.ts`"): `prisma-context.ts`, `prisma-default.ts`, `prisma-relation-fields.ts`; test của chúng nằm trong `generate-prisma.test.ts` và `prisma-model.test.ts` (đi qua `generatePrisma`).
  - `packages/core/src/generators/__snapshots__/prisma/{sample,naming-edge,target-limit,empty}.{postgresql,mysql,sqlserver}.{prisma,diagnostics.txt}`
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core <file>` cho từng file test trước khi có code → `Cannot find module './sqlserver-enum-length.js'`, `'./prisma-field-type.js'`, `'./generate-prisma.js'`. GREEN: cả bốn file `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 1658/1658, build, prettier); coverage dòng toàn package 98.01%.
  - `node --input-type=module -e 'import { generatePrisma } from "@schemaforge/core/generators/prisma"; …'` (chạy trong `packages/core`, Node v24.21.0) → `function schema.prisma`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
  - Conformance (`prisma validate`) chưa chạy: Task 30 chưa có.
- **Quyết định**
  - Dùng lại `createSqlDdlContext` (Task 13) cho phần "Chuẩn bị": nó gọi đúng `resolveSchemaColumnTypes`, `findUnindexableConstraints`, `allocateConstraintNames` với `orderColumnPairsByReferencedKey`, `allocateMysqlNames`, `findCascadeConflicts` và có sẵn hàm tra tên cột duy nhất, nên Prisma khớp SQL cùng dialect mà không chép lại.
  - `PRISMA_RESERVED_WORDS` đặt trong `prisma-context.ts` (không phải `generate-prisma.ts`) để tránh import vòng; vẫn không export qua `index.ts`.
  - `resolveActions` viết lại trong `prisma-relation-fields.ts` (bản của Task 13 không export, không được sửa file shared); cùng quy tắc: vòng cascade SQL Server → cả hai `NoAction`, còn lại `resolveReferentialAction`.
  - Bậc R19 gọi `formatSqlDefault({ dialect: "mysql", shouldParenthesizeLiteral: true })` như plan để cùng quy tắc ngoặc với Task 13.
  - `unique-nulls-restricted` chỉ báo cho unique thực sự được ghi (không báo cho unique đã bị bỏ vì `key-column-type-not-indexable`).
  - Trường của cột không có kiểu đã phân giải (không xảy ra với tài liệu đúng cấu trúc) bị bỏ thay vì throw.
  - Tên enum vẫn được cấp cả với `sqlserver` (plan gọi `allocateModelNames` một lần cho mọi provider), nên tên model không đổi giữa các provider.
  - Test "throws RangeError" truyền provider sai bằng `Reflect.apply` để không cần `as`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 16 import `sqlServerEnumLength` từ `generators/shared/sqlserver-enum-length.ts`.
  - Task 30 (conformance `prisma validate`) nên xem kỹ `target-limit.*.prisma`: model `@@ignore` có `autoincrement()` (`AutoWideKey` MySQL), cột `Unsupported` bắt buộc, và `@default(dbgenerated(…))` trên cột `Unsupported`.
