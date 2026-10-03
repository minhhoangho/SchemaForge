# Tối ưu hiệu năng sinh seed (generateSeed 100 dòng/bảng)

- Spec: [`document/specs/2026-09-14-code-generators-design.md`](../../specs/2026-09-14-code-generators-design.md) (CG-08, mục 9 mục tiêu hiệu năng)
- Plan: [`document/plans/2026-09-15-code-generators-plan.md`](../../plans/2026-09-15-code-generators-plan.md) (Task 21, 22, 28)
- Log trước: [`2026-10-03-code-generators-task-28.md`](2026-10-03-code-generators-task-28.md)

## 2026-10-03 11:30 — core-engineer — Xong

- **Đã làm**
  - Profile `generateSeed` (PostgreSQL, 100 dòng/bảng, `createLargeSchema({ tableCount: 200 })`) bằng `node --cpu-prof` trên `dist/`. Trước khi sửa: `fillDeferredRelations` chiếm 74% thời gian, trong đó self time của `isAllowed` (unique guard) là 62,6%: với mỗi dòng và mỗi dòng đích, guard sao chép `Map`/`Set` của dòng, gọi `copyFrom`, rồi dựng `SeedRow` bằng `Object.fromEntries` và `JSON.stringify` hai lần. Đây là chi phí bậc hai theo số dòng (100 dòng × 100 dòng đích × ~200 relation bị hoãn của vòng `next`).
  - Sau khi sửa guard, profile lần hai: `listCandidates`/`isCandidate` (quét toàn bộ dòng đích cho mỗi dòng mới, cả bước 4 và bước 6) chiếm ~25%, `listSeedUniqueKeys` (gọi `sortIndexes` cho từng bảng) ~5%, `toSeedRow` trong `generateAcceptedRow` ~7%.
  - Sửa nguyên nhân gốc, giữ nguyên đầu ra từng byte:
    - `createUniqueGuard`: đọc giá trị "sau khi copyFrom" tại chỗ (`readTrial`, cặp đầu tiên thắng như `copyFrom`) thay vì sao chép dòng; trả `ACCEPT_ANY_TARGET` khi không có unique key nào chứa cột nguồn; nhận `uniqueKeys` từ `RelationSource` thay vì tính lại.
    - `listCompleteTargets` (mới, nội bộ): chỉ số các dòng đích có đủ giá trị được tham chiếu, tính một lần cho mỗi relation (trong `planTable` cho bước 4, ngay trước vòng lặp cho bước 6). `listCandidates` trả thẳng danh sách này khi dòng không bị ràng buộc gì (không tự tham chiếu, chưa có lựa chọn oneToOne nào, không có guard, chưa gán cột nguồn nào); ngược lại lọc danh sách đó bằng đúng điều kiện cũ.
    - `generateAcceptedRow`: tính khóa unique trực tiếp từ `Map` qua `toSeedValuesKey` (tách từ `toSeedKey`), bỏ `toSeedRow` mỗi lần thử.
    - `buildSeedDataset`: `sortRelations` và `sortIndexes` một lần cho cả dataset; `listSeedUniqueKeys` nhận tham số tùy chọn `sortedIndexes` (mặc định vẫn là `sortIndexes(schema)`).
    - `drawBytes`: vòng lặp thay cho `Array.from({ length })`, cùng thứ tự rút PRNG.
  - Đặt `test.benchmark.suppressExportGetterWarnings: true` trong `packages/core/vitest.config.ts` (đã kiểm tra tùy chọn có trong Vitest 5.0.0 đã cài: `BenchmarkUserOptions.suppressExportGetterWarnings`).
  - Giảm `BENCH_TIMEOUT_MS` trong `generators.bench.ts` từ 900 000 xuống 300 000 (cả bộ bench giờ chạy ~57 s).
- **File thay đổi**
  - `packages/core/src/generators/seed/build-seed-dataset.ts`
  - `packages/core/src/generators/seed/seed-relations.ts`
  - `packages/core/src/generators/seed/seed-values.ts`
  - `packages/core/src/generators/seed/validate-seed-dataset.ts`
  - `packages/core/src/generators/generators.bench.ts`
  - `packages/core/vitest.config.ts`
- **Kiểm tra**
  - `pnpm --filter @schemaforge/core bench --reporter=verbose` (máy đang tải nặng, load average ~45): bộ bench chạy 57 s. Kết quả (ms):

    | Tên | mean trước | p75 trước | mean sau | p75 sau | p99 sau |
    |---|---|---|---|---|---|
    | seed json (3 dòng/bảng) | 63.35 | 63.65 | 11.58 | 11.96 | 12.35 |
    | seed sqlserver (3 dòng/bảng) | 68.52 | 69.24 | 14.46 | 14.84 | 15.57 |
    | seed postgresql (3 dòng/bảng) | 69.23 | 69.52 | 15.32 | 15.81 | 16.99 |
    | seed mysql (3 dòng/bảng) | 69.76 | 69.65 | 16.24 | 16.65 | 18.74 |
    | mock-api | 78.99 | 78.96 | 21.46 | 21.57 | 36.48 |
    | **seed postgresql with 100 rows per table** | 2513.31 | 2527.78 | **346.43** | **355.52** | 403.15 |

    Các variant khác không chậm đi (p75 sau: typescript 1.32, zod 1.38, openapi 3.56, postgresql 6.45, mysql 9.28, sqlserver 10.70, prisma postgresql 11.61, prisma mysql 13.33, prisma sqlserver 14.65, dbml 14.98, drizzle postgresql 30.76, drizzle mysql 37.64, markdown 37.98). Mọi mục tiêu p75 đều đạt.
  - So sánh byte: script tạm trong scratchpad chạy `generateSeed` của bản build HEAD (`git archive HEAD`) và bản mới, so `JSON.stringify` của toàn bộ kết quả (file + diagnostics) trên `createLargeSchema` 10 bảng (seed {0, 1, 7, 4294967295} × rowsPerTable {1, 3, 100, 1000}), 50 bảng (cùng seed × {1, 3, 100}) và 200 bảng (seed 1 × {1, 3, 100}), mỗi tổ hợp × 4 định dạng: `checked 124 mismatches 0`. Hash SHA-256 của file PostgreSQL 100 dòng không đổi (`ad77159d…b3d1`) sau mỗi bước sửa.
  - `pnpm --filter @schemaforge/core exec vitest run src/generators`: 56 file, 1585 test pass; snapshot không đổi.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (2631 test, line coverage 97,67%).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Tối ưu chỉ những chỗ profile chỉ ra, không đổi thứ tự rút PRNG hay tập ứng viên, nên đầu ra giữ nguyên (hợp đồng tất định).
  - Không lưu cache ở cấp module (core cấm state module): `completeTargets` sống trong `TablePlan` và trong vòng lặp của `fillDeferredRelations`, chỉ dùng khi dòng đích (của bảng khác) không đổi.
  - Không đụng `generators/shared/` (ngoài phạm vi): phần còn lại của serialize (`isValidJsonValue`, `formatSqlLiteral`, `removeNullCharacters`) là việc tuyến tính, chiếm ~20%.
  - Không thêm test mới: thay đổi không đổi hành vi; test hiện có (gồm snapshot, property test) phủ 100% dòng của `seed-relations.ts`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Profile cuối: chi phí còn lại tuyến tính theo số dòng: sinh giá trị (`drawValue`, `nextInt`, `formatSequencedString` gọi `toAsciiWords` cho mỗi giá trị) ~30%, serialize SQL ~24%, `toSeedRow` (dựng dataset cuối) ~6%. Nếu cần nhanh hơn nữa: cache tên chuỗi theo cột trong `TablePlan` cho `formatSequencedString`.
  - Bench nhạy với tải máy; chạy lại khi máy yên tĩnh nếu cần số liệu chính xác.

## 2026-10-03 12:10 — core-engineer — Xong

- **Đã làm** (theo góp ý của `project-reviewer`)
  - Should-fix: thêm hai test vào `build-seed-dataset.test.ts` cho các nhánh của bộ lọc khóa thử:
    - "keeps a composite unique key that mixes a deferred source column with another column unique": chu trình nullable a.b_id → b, b.a_id → a; unique index `(col_a_b, col_a_flag)` với `flag` boolean; `rowsPerTable: 8, seed: 1`. Test này đi qua nhánh `toColumnId === undefined` (cột `flag`).
    - "keeps a unique deferred column that another relation already set unique": `col_a_b` (unique) còn là cột nguồn của relation a → c không bị hoãn, nên ở bước 6 cột đã được gán. Test này đi qua nhánh `row.assigned.has(columnId)`. Đã xác nhận bằng coverage JSON khi chỉ chạy test này: cond-expr dòng `readTrial` có nhánh đúng 8 lần, trong khi `toColumnId` luôn có giá trị.
  - Nit 1: thay map "cặp đầu tiên thắng" bằng `new Map(relation.columnPairs.map(...))` (`parseSchemaDocument` đã chặn `column-listed-twice`) và bỏ comment.
  - Nit 2: tách bộ lọc khóa thử khỏi `createUniqueGuard` thành `createTrialKeyFilter(relation, keys, used)`; `keyOf` thành hàm module `rowKeyOf`.
  - Bỏ `?? null` không thể chạm tới trong `readTrial`: bộ lọc chỉ chạy sau `isCandidate`, nên mọi giá trị được tham chiếu của dòng đích đều khác null/undefined. Coverage trước đó báo nhánh này không bao giờ chạy.
- **File thay đổi**: `packages/core/src/generators/seed/seed-relations.ts`, `packages/core/src/generators/seed/build-seed-dataset.test.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (2633 test, line coverage 97,67%). Lần chạy đầu FAIL ở prettier, đã chạy `prettier --write` cho hai file rồi chạy lại.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Snapshot không đổi. Hash SHA-256 của file PostgreSQL 100 dòng vẫn là `ad77159d…b3d1`. Không chạy lại bench: guard không nằm trên vòng lặp nóng của `createLargeSchema` (không có unique key nào chứa cột nguồn), và CPU time đo bằng `node` vẫn ~360–430 ms.
- **Quyết định**
  - Tách nhánh "đã gán" thành test riêng: một schema không thể chạm cả hai nhánh mà vẫn giữ đúng tên test reviewer đưa ra.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: V8 coverage không đếm riêng từng vế của `||`; muốn kiểm tra một vế, chạy riêng một test rồi đọc `coverage-final.json`.
