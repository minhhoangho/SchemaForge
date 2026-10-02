# Task 30: Conformance Prisma, Drizzle, TypeScript, Zod

- Plan: [Task 30](../../plans/2026-09-15-code-generators-plan.md#task-30-conformance-prisma-drizzle-typescript-zod)
- Spec: [mục 7, CG-02 đến CG-05](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-03 04:55 — core-engineer — Bị chặn

- **Đã làm**
  - Viết bốn file conformance theo plan: `describe.each(listConformanceFixtures())`, fixture nguyên trạng (không `withDialectCustomTypes`), import bản build qua `@schemaforge/core/generators/<đích>`.
  - `prisma.test.ts`: `it.each` ba provider, `runPrismaValidate` có `exitCode` 0 và output không khớp `/warn/i`.
  - `drizzle.test.ts`: `it.each` `postgresql`, `mysql`: typecheck `schema.ts`; `builds table configs for every table`: import file sinh ra trong `withTempDirectory`, lọc export bằng `is(value, PgTable | MySqlTable)`, gọi `getTableConfig`; so `{ tableCount, foreignKeyCount }` với số bảng và số quan hệ trừ số diagnostic `key-column-type-not-indexable` tại `["relations", …]`.
  - `typescript.test.ts`: typecheck `types.ts`.
  - `zod.test.ts`: typecheck; parse từng dòng `generateSeed(schema, { format: "json", rowsPerTable: 5, seed: 1 })` bằng các export `ZodObject` có tập key `shape` bằng tập tên cột của bảng cùng tên; bảng không cột bị bỏ qua.
  - Bước đỏ: 39/40 test xanh ngay lần đầu, nên kiểm tra test bắt được lỗi bằng bản sao tạm `src/red-check-*.test.ts` (đã xóa): thêm lỗi kiểu vào output TypeScript, Zod, Drizzle; thêm model `Unknown` vào output Prisma; thêm một bảng Drizzle thừa. Kết quả 37 failed | 3 passed (3 test pass là test parse seed của Zod, không bị sửa).
- **File thay đổi**
  - `packages/codegen-conformance/src/prisma.test.ts` (mới)
  - `packages/codegen-conformance/src/drizzle.test.ts` (mới)
  - `packages/codegen-conformance/src/typescript.test.ts` (mới)
  - `packages/codegen-conformance/src/zod.test.ts` (mới)
  - `document/executions/logs/2026-10-03-code-generators-task-30.md` (mới)
- **Kiểm tra** (Node v24.21.0, `docker-ok`)
  - `pnpm --filter @schemaforge/core build`: pass.
  - `vitest run src/prisma.test.ts`: 12 passed (12), 7.14s. Phiên bản Prisma (`prisma --version`): `prisma : 7.10.0`, `@prisma/client : 7.10.0`.
  - `vitest run src/drizzle.test.ts`: 16 passed (16), 4.46s (`drizzle-orm` 0.45.3 đã cài).
  - `vitest run src/typescript.test.ts`: 4 passed (4), 1.17s.
  - `vitest run src/zod.test.ts`: **1 failed | 7 passed (8)**, 1.39s. Lỗi nguyên văn (rút gọn: 5 phần tử giống nhau, `rowIndex` 0 đến 4):

    ```
    FAIL  src/zod.test.ts > zod for target-limit > parses every seed json row with the schema of its table
    AssertionError: expected [ …(5) ] to strictly equal []
    + [
    +   {
    +     "issues": [
    +       {
    +         "code": "invalid_type",
    +         "expected": "nonoptional",
    +         "message": "Invalid input: expected nonoptional, received undefined",
    +         "path": [
    +           "address",
    +         ],
    +       },
    +     ],
    +     "rowIndex": 0,
    +     "table": "custom_values",
    +   },
    ```

  - `pnpm --filter @schemaforge/codegen-conformance typecheck`: pass. `lint`: pass. `prettier --check` bốn file: pass.
  - Không chạy `pnpm test:conformance` ở root (theo yêu cầu của orchestrator: test SQL Server của Task 29 không chạy được trên máy này).
- **Quyết định**
  - Prisma: một `toStrictEqual` trên `{ exitCode, hasWarning, output }` để khi đỏ diff in luôn output của CLI.
  - Drizzle: nhận diện export bảng bằng `is()` của `drizzle-orm` thay vì `instanceof`, vì đó là API chính thức để kiểm tra entity của Drizzle.
  - Drizzle: so số bảng, không so tên bảng, vì MySQL có thể đổi tên định danh (R12, R20) và test này chỉ cần biết mọi bảng dựng được config.
  - Zod: giữ dòng seed ở dạng `unknown` (không parse qua `z.record`), vì dựng lại object bằng phép gán sẽ biến cột `__proto__` thành prototype.
  - Zod: khi một dòng không hợp lệ, báo issue của mọi ứng viên để diff chỉ thẳng cột lỗi.
  - Không sửa test đỏ và không sửa core: conformance đỏ là lỗi generator (plan, Task 29).
- **Việc còn lại**
  - [ ] Orchestrator quyết định cách sửa xung đột CG-05/CG-08 rồi tạo task sửa generator. Nguyên nhân: fixture `target-limit` có bảng `custom_values` với cột `address` kiểu `custom` (`inet`), NOT NULL, có giá trị mặc định `127.0.0.1`. Theo spec CG-08 (dòng "Kiểu custom: … cột có giá trị mặc định bị bỏ khỏi dòng"), seed JSON không có key `address` (`findFixedSeedValue` trả `{ kind: "omit" }` trong `packages/core/src/generators/seed/seed-values.ts`). Schema Zod sinh `address: z.unknown()`, mà Zod 4.6 coi key thiếu là lỗi (`expected nonoptional`) với `z.unknown()` trong `z.object`. Hướng sửa có thể: (a) Zod ghi `.optional()` cho cột `custom` có giá trị mặc định, hoặc (b) seed JSON ghi giá trị cho cột này, hoặc (c) spec CG-05 nói rõ schema Zod là dạng đọc và conformance parse dòng sau khi điền cột bị bỏ. Đổi output thì cập nhật spec và snapshot của đích tương ứng.
  - [ ] Sau khi sửa: chạy lại `pnpm --filter @schemaforge/core build` và `pnpm --filter @schemaforge/codegen-conformance exec vitest run src/zod.test.ts`; mong đợi 8 passed.
- **Ghi chú cho người tiếp theo**
  - Chạy conformance bằng `pnpm exec vitest run src/<đích>.test.ts` trong `packages/codegen-conformance` sau khi build core; file sinh ra nằm trong `.tmp/` của package và tự xóa.
  - Đỏ chỉ ở `target-limit` (bảng `custom_values`); ba fixture còn lại xanh. Không có lỗi U+0000 trong comment `///` của Prisma (`naming-edge` xanh với cả ba provider).

## 2026-10-03 05:10 — core-engineer — Xong

- **Đã làm**
  - Theo quyết định của orchestrator (phương án (c), chỉ sửa test, không đổi core): `zod.test.ts` tính các cột mà seed bỏ theo CG-08 (kiểu `custom`, NOT NULL, có giá trị mặc định, giống nhánh `omit` của `findFixedSeedValue`; suy ra từ schema, không import nội bộ của seed) và parse mỗi dòng bằng ứng viên `candidate.partial({ [tên]: true, … })` chỉ cho đúng các key đó. Mọi key khác vẫn bắt buộc.
  - Comment trong test dẫn CG-08 và quyết định spec R27 (CG-05, mục 7; spec-writer ghi vào spec).
- **File thay đổi**
  - `packages/codegen-conformance/src/zod.test.ts` (sửa)
  - `document/executions/logs/2026-10-03-code-generators-task-30.md` (thêm mục này)
- **Kiểm tra** (Node v24.21.0)
  - `vitest run src/zod.test.ts`: 8 passed (8), 2.66s.
  - Kiểm tra đột biến: bản sao tạm `src/red-check-zod.test.ts` (đã xóa) bỏ key đầu tiên của mỗi dòng (key không thuộc nhóm bị bỏ) → 3 failed | 5 passed (đỏ ở `sample`, `naming-edge`, `target-limit`; `empty` không có dòng).
  - Ba file còn lại không đổi so với mục trước: prisma 12/12, drizzle 16/16, typescript 4/4.
  - `pnpm --filter @schemaforge/codegen-conformance typecheck`: pass. `lint`: pass. `prettier --check` bốn file: pass. `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Phương án (c) (orchestrator): schema Zod mô tả dòng đã lưu đầy đủ, còn seed JSON là dữ liệu chèn, bỏ cột custom có mặc định theo CG-08; nên test nới đúng các key đó thay vì đổi generator.
  - Mask khai báo kiểu `Record<string, true>`: `partial` của Zod 4 trên shape lỏng đòi key mask là `string`, còn index signature của `Object.fromEntries` thêm `number`.
  - Dựng mask bằng `Object.fromEntries` để cột `__proto__` vẫn là key thật.
- **Ghi chú cho người tiếp theo**
  - Nếu CG-08 thêm trường hợp bỏ cột mới, sửa `findSeedOmittedColumnNames` trong `zod.test.ts` cho khớp.
  - Spec-writer cần ghi R27 vào CG-05 và mục 7 của spec.
