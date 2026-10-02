# CG-08 `SeedDataset`, PRNG và kiểm tra dữ liệu mẫu

Plan: [Task 21](../../plans/2026-09-15-code-generators-plan.md#task-21-cg-08-seeddataset-prng-và-kiểm-tra-dữ-liệu-mẫu). Spec: [CG-08](../../specs/2026-09-14-code-generators-design.md#cg-08-seed-data).

## 2026-10-02 19:31 — core-engineer — Xong

- **Đã làm**
  - `seed-random.ts`: mulberry32 (`createSeedRandom`), luồng theo bảng (`createTableSeedRandom`, hash `fnv1a32Hex` của Task 9), `formatSeedDate` (bảng ngày của năm 2026, không `Date`), `formatSeedTime`, `encodeBase64` tự viết (RFC 4648), `formatUuidV4`.
  - `seed-dataset.ts`: type `SeedRow`, `SeedDataset`, `SeedIssue`, `SEED_ISSUE_CODES`, các hằng, `assertSeedDatasetOptions` (`RangeError`), `parseSeedDataset`: quét độ sâu bằng stack tường minh trước (`SEED_DATASET_MAX_DEPTH = 64`), sau đó `safeParse` shape Zod dựng ở cấp module, lỗi đi qua `toStructuralErrors`. Typings Zod 4.6.4 đã cài: `z.partialRecord(columnIdShape, z.json())` gán được vào `SeedRow`, không cần `as`.
  - `seed-values.ts`: `generateColumnValue` theo `toJsonFieldType`, `findFixedSeedValue` (custom, enum thiếu hoặc rỗng → `null`, `omit` hoặc `none`, không dùng PRNG), tỉ lệ null `SEED_NULL_RATE_DENOMINATOR = 5`.
  - `validate-seed-dataset.ts`: `validateSeedDataset` (đủ 5 mã, mọi nhánh của plan), `findDeferredSeedRelations`, cùng hai helper dùng chung với builder: `listSeedUniqueKeys`, `toSeedKey`.
  - `build-seed-dataset.ts`: các bước 1–7 của plan: bỏ bảng (`none` + chu trình bắt buộc + lan truyền), sinh dòng theo load order, quan hệ không hoãn theo `sortRelations` với điều kiện ứng viên phải khớp cột nguồn đã gán (trường hợp đa tenant), quy tắc null, tự tham chiếu (dòng trước, rồi chính dòng đó), 1-1 không lặp, unique, dừng bảng khi một dòng hết `SEED_MAX_ROW_ATTEMPTS` lượt (Vấn đề 20), quan hệ hoãn điền ở bước 6 bằng PRNG của bảng nguồn.
- **File thay đổi** (đều mới, trong `packages/core/src/generators/seed/`): `seed-dataset.ts`, `seed-random.ts`, `seed-values.ts`, `build-seed-dataset.ts`, `validate-seed-dataset.ts` và năm file `.test.ts` đi kèm. Không tạo `seed/index.ts`, không sửa `src/index.ts`, không có snapshot.
- **Kiểm tra**
  - RED: mỗi file test chạy trước khi có code, lỗi `Cannot find module './<file>.js'` (ví dụ `.claude/scripts/test-file.sh core src/generators/seed/seed-random.test.ts` → `RESULT: FAIL`).
  - GREEN: `seed-random` PASS, `seed-dataset` PASS, `seed-values` 37/37, `validate-seed-dataset` 19/19, `build-seed-dataset` 22/22.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 1494/1494, build, prettier). Coverage dòng toàn core 98.26%, thư mục `generators/seed` 99.47%.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
  - Giá trị mulberry32 với state 1 (`2693262067, 11749833, 2265367787, 4213581821, 4159151403`) tính bằng bản cài đặt tham chiếu chạy ngoài core (script trong scratchpad, đã bỏ).
- **Quyết định**
  - **(Quan trọng) `generateColumnValue` nhận thêm `isPrimaryKeyColumn`.** Chữ ký trong plan chỉ có `isKeyColumn` (gồm cả unique và cặp cột quan hệ), nhưng quy tắc đánh số theo `sequence` chỉ áp cho khóa chính và auto-increment; không có cách biết cột thuộc khóa chính từ `Column`. Hàm không thuộc API công khai.
  - **(Quan trọng) Thêm export `findFixedSeedValue` trong `seed-values.ts`** để bước 2 xác định bảng `none` mà không cần PRNG và dùng chung quy tắc với `generateColumnValue`; thêm export `listSeedUniqueKeys`, `toSeedKey` trong `validate-seed-dataset.ts` để builder và validator dùng đúng một định nghĩa khóa unique.
  - `SEED_MAX_ROW_ATTEMPTS = 20` là tổng số lần thử của một dòng, tính cả lần đầu (tên hằng là "attempts").
  - Sequence chỉ dùng cho kiểu `smallint`, `integer`, `bigint`; cột auto-increment kiểu khác (đã có issue ngữ nghĩa) sinh giá trị theo kiểu như thường, để giá trị luôn hợp lệ.
  - Bước 2 xét mọi cột của bảng (kể cả cột nguồn quan hệ) khi tìm cột `none`, đúng chữ "bảng có cột cho `none`".
  - Cột được quan hệ gán `null` (quy tắc null) vẫn tính là "đã gán", theo đúng chữ của plan bước 4; quan hệ sau dùng chung cột đó sẽ làm dòng thất bại. Chỉ xảy ra khi bảng đích không có dòng nào.
  - `validateSeedDataset`: bảng xuất hiện lần hai chỉ báo `seed-order-invalid` tại `tableId`, không kiểm tra dòng của lần xuất hiện đó; khóa ngoại không có dòng khớp báo `seed-foreign-key-missing`, có dòng khớp nhưng sai thứ tự báo `seed-order-invalid` (không báo cả hai); khóa ngoại có cột nguồn thiếu khóa (để database điền mặc định) không kiểm tra, giống cột `null`; issue trùng `code` và `path` (ví dụ cột vừa là khóa chính vừa `isUnique`) được gộp.
  - `nextInt` throw `RangeError` cả với cận không nguyên (plan chỉ nêu nhỏ hơn 1); `assertSeedDatasetOptions` test thêm seed `2^32`.
- **Ghi chú cho người tiếp theo**
  - `build-seed-dataset.ts` dài khoảng 400 dòng sau Prettier, vượt mức khoảng 300 dòng của `code-quality.md`. Tách ra cần file mới ngoài danh sách sở hữu của Task 21 (ví dụ `seed-relations.ts` cho `assignRelation`, `listCandidates`, `fillDeferredRelations`); để orchestrator quyết định.
  - Bước 6 không kiểm tra lại unique: cột nguồn của quan hệ hoãn nếu `isUnique` mà quan hệ là `oneToMany` có thể trùng. Ba fixture và `createLargeSchema({ tableCount: 20 })` đều qua `validateSeedDataset`.
  - Chọn ứng viên quét toàn bộ dòng của bảng đích cho mỗi dòng nguồn (O(số dòng²) mỗi quan hệ, tối đa 1000 × 1000); Task 28 (benchmark) đo nếu cần.
  - Task 22 tạo `seed/index.ts`, export `buildSeedDataset`, `validateSeedDataset`, `parseSeedDataset`, type `SeedDataset`, `SeedIssue`, và dùng `findDeferredSeedRelations` cho câu `UPDATE` phá vòng.

## 2026-10-02 19:35 — core-engineer — Xong

- **Đã làm**: hai việc orchestrator giao thêm sau lượt đầu.
  - Tách `build-seed-dataset.ts` (khoảng 400 dòng) thành `build-seed-dataset.ts` (240 dòng: bỏ bảng, sinh dòng, unique bước 5) và file nội bộ mới `seed-relations.ts` (267 dòng: ứng viên bảng cha, quy tắc null, tự tham chiếu, 1-1, quan hệ hoãn bước 6). Test qua `buildSeedDataset`, không có file test riêng cho `seed-relations.ts`.
  - Sửa lỗi bước 6 (câu hỏi mở 2 của lượt đầu): cột nguồn của quan hệ hoãn thuộc khóa unique có thể nhận giá trị trùng, nên `validateSeedDataset` báo `seed-unique-violation`.
  - Rebase lên `master` (`168d2ff`), chạy lại `worktree-setup.sh` vì lockfile đổi (shiki).
- **File thay đổi**: `packages/core/src/generators/seed/build-seed-dataset.ts`, `build-seed-dataset.test.ts` (thêm test), `seed-relations.ts` (mới).
- **Kiểm tra**
  - RED: `pnpm exec vitest run src/generators/seed/build-seed-dataset.test.ts -t "unique deferred"`: `× keeps a unique deferred column unique`, issue `seed-unique-violation`.
  - GREEN: `vitest run src/generators/seed`: 131/131.
  - `.claude/scripts/verify.sh core --build --format` sau rebase: `RESULT: PASS` (test 1629/1629, coverage dòng 98.28%).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - **Tách file**: `seed-relations.ts` export `BuiltRow`, `Choice`, `RelationState`, `RelationSource`, `assignRelation`, `commitChoices`, `fillDeferredRelations`, `toSeedRow`; chỉ `build-seed-dataset.ts` import. `TablePlan` của builder mở rộng `RelationSource` (`table`, `random`).
  - **Unique ở bước 6**: với mỗi quan hệ hoãn, lấy các khóa trong `listSeedUniqueKeys` của bảng nguồn có chứa cột nguồn của quan hệ; dựng tập khóa đã dùng (`toSeedKey`) từ các dòng hiện có. Bảng cha ứng viên bị loại khi giá trị sao sang làm khóa của dòng trùng một khóa đã dùng (khóa không đổi so với trước thì vẫn cho). Không còn ứng viên thì cột hoãn giữ `NULL` (cột nullable; Task 13 dựng unique nullable trên SQL Server bằng filtered index nên nhiều `NULL` hợp lệ). Khóa mới của dòng được ghi vào tập ngay sau khi gán.
- **Ghi chú cho người tiếp theo**: thứ tự rút PRNG ở bước 6 không đổi khi không có khóa unique nào chứa cột hoãn, nên dataset của các schema khác giữ nguyên.
