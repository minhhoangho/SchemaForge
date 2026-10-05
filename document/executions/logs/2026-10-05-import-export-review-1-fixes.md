# Sửa lỗi theo review 1 của phần 7 (Import / Export)

- Plan: [document/plans/2026-10-03-import-export-plan.md](../../plans/2026-10-03-import-export-plan.md)
- Spec: [document/specs/2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md) (mục 3, 13, 14)
- Review: project-reviewer trên dải commit `df2c3cc..6fa1e35`, kết luận "approve with fixes"

## 2026-10-05 19:20 — core-engineer — Dừng giữa chừng

- **Đã làm**
  - Fix 1 (đặt tên bậc hai): thêm `createNameClaimer` (nội bộ) trong `operations/pick-unused-name.ts`. Bộ claimer giữ tập name key đã dùng và `Map` lần thử kế tiếp cho từng dãy tên, nên tìm hậu tố tiếp tục từ chỗ dừng thay vì đếm lại từ 2. Thêm `claimIndexName(claimer, input)` (nội bộ) trong `operations/suggest-index-name.ts`; `suggestIndexName` giữ nguyên chữ ký và hành vi, giờ đi qua `claimIndexName`. `assemble-document.ts` `buildIndexes` dùng một claimer cho cả lượt import (tên index có sẵn được `reserve` theo thứ tự draft). `remap-merged-document.ts` dùng claimer cho cả ba namespace. Tên sinh ra giống hệt trước (test cũ không đổi).
  - Fix 2: khi merge, bảng import trùng tên (theo `toNameKey`) với một index của target cũng bị đổi tên, kèm `table-renamed`. Tên index của target được `reserve` vào claimer bảng/enum ngay sau khi xử lý enum, nên enum không bị ảnh hưởng.
  - Fix 3: `sql-default-mapping.ts`: với `dialect: "mysql"` và cột `boolean`, default chuỗi `'1'`/`'0'` thành literal `true`/`false`, không diagnostic.
  - Fix 5: chấp nhận như hiện tại, không sửa code (Task 33 ghi lại).
- **File thay đổi**
  - `packages/core/src/operations/pick-unused-name.ts` (+ `.test.ts`)
  - `packages/core/src/operations/suggest-index-name.ts` (+ `.test.ts`)
  - `packages/core/src/operations/remap-merged-document.ts`
  - `packages/core/src/operations/build-import-operation.test.ts`
  - `packages/core/src/importers/shared/assemble-document.ts` (+ `.test.ts`)
  - `packages/core/src/importers/shared/sql-default-mapping.ts` (+ `.test.ts`)
- **Kiểm tra**
  - RED: `assemble-document.test.ts` — test 5000 index không tên "Test timed out in 5000ms" (chạy 24068ms); `build-import-operation.test.ts` — 3 test mới fail (đổi tên khi trùng index, không thêm `index-name-conflicts-table`, 10000 bảng cùng tên mất ~25 s); `sql-default-mapping.test.ts` — 3 fail (`"1"`/`"0"` thay vì `"true"`/`"false"`).
  - GREEN: test 5000 index 58ms, test 10000 bảng 149ms.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS`, 3798 test, line coverage 97.76%.
  - `pnpm --filter @schemaforge/frontend typecheck` → exit 0.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Khóa cache theo tên gốc chính xác (không qua `toNameKey`) vì `toLowerCase` có trường hợp phụ thuộc ngữ cảnh (sigma cuối từ); khóa chính xác luôn đúng.
  - Claimer là closure tạo mới cho mỗi lần gọi, không có state cấp module và không sửa đối số.
  - Không dùng `performance.now()` trong test: core chưa có tiền lệ; timeout mặc định 5 s của Vitest là chốt chặn (code cũ mất 15–25 s, code mới < 0,2 s).
  - `remap-merged-document.ts` 309 dòng (trước đó 302): chấp nhận, quanh mức ~300.
- **Việc còn lại**
  - [ ] Fix 4: thêm "(import-export plan Task 23)" vào cuối comment "Temporary: part 5 code that predates downloadBlob…" trong `eslint.config.mjs` (dòng 453–454). Hook `config-protection` của plugin ecc chặn mọi Edit vào `eslint.config.mjs`; cần người dùng tạm tắt hook hoặc tự sửa. Sau khi sửa chạy `pnpm lint`.
- **Ghi chú cho người tiếp theo**
  - `createNameClaimer.claim` yêu cầu mọi lời gọi cùng `sequenceKey` dùng cùng hàm `candidateAt`; `claimIndexName` dùng khóa `${suffix}\u0000${stem}`.
