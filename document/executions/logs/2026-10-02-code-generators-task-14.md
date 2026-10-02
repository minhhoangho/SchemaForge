# Task 14: CG-01 SQL DDL cho PostgreSQL

- Plan: [Task 14](../../plans/2026-09-15-code-generators-plan.md#task-14-cg-01-sql-ddl-cho-postgresql)
- Spec: [CG-01](../../specs/2026-09-14-code-generators-design.md#cg-01-sql-ddl), mục 3 "SQL", mục 4 "Ma trận cho SQL, Prisma và Drizzle"

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Thêm `generatePostgresql` (subpath `@schemaforge/core/generators/postgresql`): in DDL PostgreSQL từ `buildSqlDdlModel(schema, "postgresql")` theo thứ tự `CREATE TYPE … AS ENUM`, `CREATE TABLE` (cột, khóa chính, unique), `CREATE [UNIQUE] INDEX`, `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` với đủ hai hành động, rồi `COMMENT ON TABLE` / `COMMENT ON COLUMN`. Không tính lại kiểu, tên hay ràng buộc; `diagnostics` là `model.diagnostics`.
  - Thêm `renderPostgresqlType` (nội bộ, không export qua `index.ts`).
  - TDD: viết test trước, chạy thấy đỏ vì thiếu module (`Cannot find module './render-postgresql-type.js'`, `Cannot find module './generate-postgresql.js'`), rồi cài đặt cho xanh.
  - Tạo 8 file snapshot trong `src/generators/__snapshots__/postgresql/` (`sample`, `naming-edge`, `target-limit`, `empty`, mỗi fixture `.sql` và `.diagnostics.txt`); đã đọc lại và đối chiếu với spec.
- **File thay đổi**
  - `packages/core/src/generators/postgresql/index.ts`
  - `packages/core/src/generators/postgresql/generate-postgresql.ts`, `generate-postgresql.test.ts`
  - `packages/core/src/generators/postgresql/render-postgresql-type.ts`, `render-postgresql-type.test.ts`
  - `packages/core/src/generators/__snapshots__/postgresql/{sample,naming-edge,target-limit,empty}.{sql,diagnostics.txt}`
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core …/render-postgresql-type.test.ts`: đỏ (thiếu module) → xanh.
  - `.claude/scripts/test-file.sh core …/generate-postgresql.test.ts`: đỏ (thiếu module) → xanh.
  - `.claude/scripts/verify.sh core --build --format`: PASS (typecheck, lint, test 1540/1540, coverage dòng 98.13%, build, prettier).
  - `pnpm --filter @schemaforge/backend exec node --input-type=module -e '…generatePostgresql…'`: in `function schema.sql`.
  - `.claude/scripts/secret-scan.sh`: xem báo cáo.
- **Quyết định**
  - `generatePostgresql` là `const` kiểu `Generate<"postgresql">` bỏ tham số option (mẫu của Task 19), vì CG-01 không có option và lint cấm tham số không dùng.
  - `numeric(p, s)` có dấu cách sau dấu phẩy, đúng cách viết trong spec mục 3 và plan.
  - Kiểu `enum` tra tên trong `schema.enums` (theo chữ ký của plan), không qua `model.enums`; enum không tìm thấy thì `text`.
  - Bảng không có phần tử nào ghi `CREATE TABLE "t" ();` (thêm test riêng); cột và ràng buộc cách nhau `,\n`, thụt hai dấu cách.
  - Khóa ngoại in trên một dòng, mỗi block (enum, từng bảng, index, khóa ngoại, comment) cách nhau một dòng trống qua `renderFileContent`.
  - Thêm test `writes a unique index with the UNIQUE keyword and every column` ngoài danh sách của plan để phủ nhánh `UNIQUE`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 15, 16 có thể theo đúng cấu trúc này (`render-<dialect>-type.ts` + `generate-<dialect>.ts`). Bảng hành động `REFERENTIAL_ACTION_SQL` hiện nằm trong `generate-postgresql.ts`; nếu MySQL và SQL Server cũng cần, đó là bản sao thứ ba và nên đưa vào `generators/shared/` qua một task nền.
  - Snapshot `naming-edge.sql` có comment chứa `-- ; DROP TABLE x` và xuống dòng nằm trong literal chuỗi: đó là dữ liệu đã escape, không phải câu lệnh.
