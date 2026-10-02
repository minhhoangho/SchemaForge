# CG-08 xuất seed data và `generateSeed`

Plan: [Task 22](../../plans/2026-09-15-code-generators-plan.md#task-22-cg-08-xuất-seed-data-và-generateseed). Spec: [CG-08](../../specs/2026-09-14-code-generators-design.md#cg-08-seed-data).

## 2026-10-02 19:48 — core-engineer — Xong

- **Đã làm**
  - `formatSeedSqlValue` (`seed-sql-values.ts`): `DEFAULT` cho khóa thiếu, `NULL` cho `null` hoặc giá trị sai biểu diễn (`isValidJsonValue`), số ghi trần, boolean/json/custom/chuỗi qua `formatSqlLiteral` của Task 7 (PostgreSQL bỏ U+0000 trước), binary base64 qua `decode` / `FROM_BASE64` / `CAST(N'' AS XML).value(...)`.
  - `serializeSeedDataset` (`serialize-seed-dataset.ts`): `seed.json` (mảng `{ table, rows }`, object dựng bằng `Object.fromEntries`, key là tên cột gốc theo `columnIds`); `seed.sql` cho ba dialect: một block mỗi bảng có dòng, tối đa 1000 dòng mỗi `INSERT`, `DEFAULT VALUES` / `() VALUES ()` khi không có cột, `SET IDENTITY_INSERT` trên SQL Server, `setval(pg_get_serial_sequence(...))` trên PostgreSQL, tên cột MySQL theo `allocateMysqlNames`, block `UPDATE` cuối cho quan hệ hoãn.
  - Cột chỉ thuộc quan hệ hoãn ghi `NULL` trong `INSERT`; cột dùng chung với quan hệ không hoãn giữ giá trị và không có trong `SET` của `UPDATE` (test `keeps a column shared with a non-deferred relation in the insert`).
  - `generateSeed` (`generate-seed.ts`): `RangeError` cho `format` lạ; option khác do `buildSeedDataset` kiểm tra.
  - `seed/index.ts` export `generateSeed`, `buildSeedDataset`, `validateSeedDataset`, `serializeSeedDataset`, `parseSeedDataset` và type `SeedOptions`, `SeedDataset`, `SeedRow`, `SeedIssue`, `SeedIssueCode`, `SeedDatasetOptions`. `src/index.ts` thêm đúng một dòng `export type { SeedDataset }`.
  - Snapshot: 4 fixture × 4 định dạng (`rowsPerTable: 3`, `seed: 1`).
- **File thay đổi**
  - Tạo `packages/core/src/generators/seed/{index.ts, generate-seed.ts, generate-seed.test.ts, serialize-seed-dataset.ts, serialize-seed-dataset.test.ts, seed-sql-values.ts, seed-sql-values.test.ts}`.
  - Tạo 32 file trong `packages/core/src/generators/__snapshots__/seed/`: `<fixture>.<postgresql|mysql|sqlserver>.sql`, `<fixture>.json.json` và `<fixture>.<format>.diagnostics.txt` cho `sample`, `naming-edge`, `target-limit`, `empty`.
  - Sửa `packages/core/src/index.ts` (một dòng export type).
- **Kiểm tra**
  - RED: ba file test đều fail với `Cannot find module './<module>.js'` trước khi viết code; GREEN bằng `.claude/scripts/test-file.sh core <file>`.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, 1744 test pass, coverage dòng 98.11%, build, prettier).
  - Lệnh `node` của plan in `function function seed.json`.
  - `pnpm --filter @schemaforge/frontend typecheck`: mã 0. `pnpm --filter @schemaforge/backend typecheck`: lần đầu fail vì worktree chưa có Prisma client (`Cannot find module '../generated/prisma/client.js'`, không liên quan core); sau `pnpm --filter @schemaforge/backend generate` (thư mục bị gitignore) thì mã 0.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Cột chỉ thuộc quan hệ hoãn mà dòng **không có khóa** vẫn ghi `DEFAULT` (không ép `NULL`), để `seed.sql` và `seed.json` khớp (JSON bỏ khóa đó). Dòng như vậy không có `UPDATE` (`toSeedKey` trả `null`).
  - Tập cột chỉ thuộc quan hệ hoãn tính một lần trên mọi quan hệ: bất biến cấu trúc bảo đảm cột nguồn thuộc `fromTableId`, nên tương đương với điều kiện "cùng `fromTableId`" của plan.
  - Bảng lặp lại trong dataset: `UPDATE` áp cho dòng của mọi entry cùng `tableId` (dataset như vậy đã có `seed-order-invalid`; output vẫn an toàn).
  - Base64 ghi thẳng trong nháy vì giá trị đã khớp `BASE64_PATTERN` (chỉ `A-Za-z0-9+/=`); SQL Server dùng đúng chuỗi của plan (`'xs:base64Binary("…")'` không có tiền tố `N`).
  - `generateSeed` là `function` thường (có option), không dùng const `Generate<"seed">`.
  - Test `throws RangeError for an unknown format` dùng `@ts-expect-error` có ghi lý do (rule TypeScript cho phép), không dùng `as`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Rủi ro chưa kiểm chứng (để Task 29 conformance bắt): literal `timestamptz` dạng `'2026-07-05T02:41:33Z'` trên MySQL đi qua `formatSqlLiteral` của Task 7 (cùng đường với giá trị mặc định); MySQL có thể không nhận hậu tố `Z`. Nếu fail thì sửa ở `sql-literals.ts`, không sửa ở seed.
  - Task 23 (Mock API) import `buildSeedDataset` từ `../seed/build-seed-dataset.js`, không qua `seed/index.ts`.
