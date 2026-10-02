# Task 27: Property test cho mọi generator

Plan: [Task 27](../../plans/2026-09-15-code-generators-plan.md#task-27-property-test-cho-mọi-generator). Spec: [mục 10 "Property test"](../../specs/2026-09-14-code-generators-design.md).

## 2026-10-03 — core-engineer — Xong

- **Đã làm**
  - Dựng worktree (`.claude/scripts/worktree-setup.sh <worktree>` → `RESULT: PASS`, Node v24.21.0), đọc rule, plan (Quy ước chung, Điểm nóng, Task 27), spec mục 10, `arbitraries.ts`, `apply-operation.properties.test.ts`, `validate-schema.properties.test.ts`, entry của 12 generator và helper quote/literal SQL.
  - `src/testing/generator-cases.ts`: `listGeneratorCases()` trả 18 case (3 SQL, Prisma × 3 provider, Drizzle × 2 dialect, TypeScript, Zod, Mock API, OpenAPI, seed × 4 `format` với `rowsPerTable: 3`, `seed: 1`, DBML, Markdown với nhãn tiếng Anh cố định). Không export qua `@schemaforge/core/testing`.
  - `generator-cases.test.ts`: ghim danh sách 18 tên đúng thứ tự (không trùng) và kiểm tra mỗi case gọi đúng generator qua `fileName` của output trên `createSampleSchema()`.
  - `generators/generators.properties.test.ts` (`describe.each(listGeneratorCases())`, 6 property × 18 case): không throw; gọi hai lần cùng kết quả; xáo khóa map (`withShuffledKeys`) cùng kết quả; hai thời điểm hệ thống (2001-01-01, 2099-12-31, `vi.useFakeTimers({ toFake: ["Date"] })`, `vi.useRealTimers()` trong `afterEach`) cùng kết quả; nội dung kết thúc bằng đúng một `\n`; diagnostic bằng `finalizeDiagnostics` của chính nó.
  - `generators/sql-safety.properties.test.ts`: 6 case (PostgreSQL, MySQL, SQL Server, seed SQL ba dialect) × 2 property. Văn bản thù địch = `§` + `fc.string` trên đơn vị `"`, `'`, `` ` ``, `[`, `]`, `\`, `*/`, `/*`, `--`, `;`, `\n`, `\r`, U+0000, `a`, `é`. `leaves no user text outside quoted identifiers and strings` thay tên schema, bảng, cột, index, enum, subject area, comment bảng và cột, giá trị enum, literal mặc định, tên kiểu custom; `writes no unsafe custom type name outside a string` đổi mọi cột sang kiểu custom có tên thù địch. Tài liệu dựng lại qua JSON rồi `parseSchemaDocument` (`unwrapOk`). Bỏ định danh và chuỗi đã quote bằng **một** regex alternation theo dialect (đúng regex của plan) để quét trái sang phải.
  - `generators/seed/seed.properties.test.ts`: `it.each` qua `sample`, `naming-edge`, `target-limit`; `fc.integer({ min: 0, max: 0xffffffff })` cho `seed` (đã kiểm fast-check 4 sinh giá trị > 2^31), `fc.integer({ min: 1, max: 20 })` cho `rowsPerTable`: dataset qua `validateSeedDataset` rỗng; cùng option cho cùng dataset (so với fixture dựng lại).
  - Kiểm tra test có thể đỏ: tạm bỏ bước strip regex → 6 test `leaves no user text…` fail với counterexample (ví dụ bảng `users` đổi tên `§`), rồi khôi phục file. Property custom vẫn xanh khi không strip: không generator SQL nào ghi tên kiểu custom không an toàn ở bất kỳ đâu trong output. Thăm dò `schemaDocumentArbitrary()` với `PROPERTY_SEED`, 200 mẫu: 656 bảng, 1133 cột, 515 quan hệ, 214 index, 52 enum, 137 cột custom, 345 literal mặc định, 190 bảng có khóa chính (file thăm dò tạm đã xóa).
  - **Không tìm thấy lỗi generator nào.** Không có counterexample.
- **File thay đổi**
  - `packages/core/src/testing/generator-cases.ts` (mới)
  - `packages/core/src/testing/generator-cases.test.ts` (mới)
  - `packages/core/src/generators/generators.properties.test.ts` (mới)
  - `packages/core/src/generators/sql-safety.properties.test.ts` (mới)
  - `packages/core/src/generators/seed/seed.properties.test.ts` (mới)
  - `document/executions/logs/2026-10-03-code-generators-task-27.md` (log này)
- **Kiểm tra**
  - Thời gian chạy riêng từng file (`pnpm exec vitest run <file>` trong `packages/core`): `generators.properties.test.ts` 5,84 s (108 test); `sql-safety.properties.test.ts` 1,10 s (12 test); `seed/seed.properties.test.ts` 3,04 s (6 test); bốn file cùng lúc 145 test, 5,97 s.
  - `.claude/scripts/verify.sh core --build --format`: lần đầu typecheck, lint, test (2525 test, 18 s, dòng 97,66 %), build PASS; format FAIL do `sql-safety.properties.test.ts` chưa Prettier và `packages/core/.vitest/json/output.json` (do một lần chạy `--reporter=json` của tôi tạo ra, đã xóa). Đã `prettier --write` file test. Chạy lại: typecheck, lint, test (2525 test pass, 21 s, dòng 97,66 %, không có dòng ngưỡng), build, format đều PASS → `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`. `git status --porcelain` chỉ còn 5 file của task và log này.
  - `pnpm --filter @schemaforge/core test` còn xa ngưỡng 5 phút, nên không giảm `numRuns` ở file nào; mọi file dùng `PROPERTY_RUNS` (200).
- **Quyết định**
  - Tên case: `<đích>` hoặc `<đích> <option chính>` (`prisma mysql`, `seed json`), giữ thứ tự `GENERATOR_TARGETS`.
  - Test của `generator-cases.ts` kiểm `fileName` thay vì chỉ "nội dung khác rỗng" (luôn đúng vì có `\n`), để bắt case nối nhầm generator.
  - Fake timer chỉ giả `Date` (`toFake: ["Date"]`), không đụng timer mà Vitest hay fast-check có thể dùng.
  - Văn bản thù địch luôn bắt đầu bằng `§`, nên mọi tên kiểu custom thay vào đều không an toàn theo `isSafeCustomTypeName` hiện tại và sau khi siết luật (luật song song chỉ thu hẹp tập an toàn). Test sql-safety dựng tài liệu qua `parseSchemaDocument` (chỉ cấu trúc), nên không phụ thuộc luật `custom-type-name` đang sửa ở worktree khác.
  - Không thay `notes[].text` (plan không liệt kê, generator SQL không xuất note); `relations` không có tên.
  - Văn bản thù địch được phát lần lượt từ một mảng 1–8 chuỗi (lặp vòng), để fast-check thu nhỏ được counterexample mà không cần arbitrary phụ thuộc vào số phần tử của schema.
  - Property "custom" đổi **mọi** cột sang kiểu custom (thay vì chọn ngẫu nhiên) để mỗi schema có cột đều kiểm được.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Không chạy `vitest --reporter=json` trong worktree: Vitest 5 ghi `packages/core/.vitest/json/output.json` và Prettier check sẽ fail.
  - Nếu cần thấy `console.log` trong test tạm, đầu ra của Vitest bị lọc; cách nhanh là ném `Error` chứa thông tin.
