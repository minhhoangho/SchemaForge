# Sửa hai phát hiện review của generator seed (CG-08)

- Plan: [`document/plans/2026-09-15-code-generators-plan.md`](../../plans/2026-09-15-code-generators-plan.md), Task 21–22
- Spec: [`document/specs/2026-09-14-code-generators-design.md`](../../specs/2026-09-14-code-generators-design.md), CG-08

## 2026-10-02 21:55 — core-engineer — Xong

- **Đã làm**
  - Phát hiện 1 (bảo mật): `findTooDeepPath` trong `seed-dataset.ts` dùng `stack.push(...children.toReversed())`, ném `RangeError: Maximum call stack size exceeded` với mảng rất rộng (`{ tables: new Array(150000).fill(0) }`), làm `parseSeedDataset` vi phạm hợp đồng "trả `Result`, không ném". Đổi sang đẩy từng phần tử bằng vòng lặp, giữ thứ tự đảo để vẫn báo container quá sâu đầu tiên theo thứ tự đọc.
  - Phát hiện 2 (đúng đắn): thêm mã `SeedIssue` mới `seed-identity-partial` vào `SEED_ISSUE_CODES` (đứng cuối, sau `seed-order-invalid`) và kiểm tra `checkIdentityColumns` trong `validateSeedDataset`: với mỗi cột `isAutoIncrement` của bảng, nếu có ít nhất một dòng đặt giá trị (kể cả `null`) thì mỗi dòng bỏ khóa đó bị báo.
  - **Hợp đồng `path`**: `['tables', i, 'rows', j, columnId]`, một issue cho mỗi dòng `j` bỏ cột auto-increment `columnId` trong khi dòng khác của cùng bảng `i` có đặt giá trị. Dòng có giá trị không bị báo. Bảng mà mọi dòng đều đặt, hoặc mọi dòng đều bỏ, không bị báo.
- **File thay đổi**
  - `packages/core/src/generators/seed/seed-dataset.ts`
  - `packages/core/src/generators/seed/seed-dataset.test.ts`
  - `packages/core/src/generators/seed/validate-seed-dataset.ts`
  - `packages/core/src/generators/seed/validate-seed-dataset.test.ts`
  - `document/executions/logs/2026-10-02-seed-review-fixes.md`
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core src/generators/seed/seed-dataset.test.ts` → `RangeError` tại `stack.push(...children.toReversed())`, `Tests 1 failed | 20 passed (21)`.
  - RED: `.claude/scripts/test-file.sh core src/generators/seed/validate-seed-dataset.test.ts` → thiếu `seed-identity-partial`, `Tests 1 failed | 21 passed (22)`.
  - GREEN: `pnpm --filter @schemaforge/core exec vitest run src/generators/seed` → `Tests 209 passed (209)`.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS`, `Tests 2249 passed (2249)`, line coverage 98.11%.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Tên mã `seed-identity-partial`: theo tiền tố `seed-` và dạng `<đối tượng>-<vấn đề>` của danh mục hiện có; "identity" khớp cách spec gọi cột auto-increment ở phần xuất SQL.
  - Báo trên dòng bỏ cột (không phải dòng có giá trị): đó là dòng sẽ nhận `DEFAULT` và gây lỗi; `path` đúng dạng spec quy định cho `SeedIssue`.
  - `null` tính là "có đặt": serializer cũng coi `null` là có mặt; `null` ở cột bắt buộc đã do `seed-value-null` báo.
  - Đặt mã mới cuối `SEED_ISSUE_CODES` để không đổi vị trí các mã cũ.
  - Không thêm giới hạn số bảng/cột cho phát hiện 1 (quyết định của orchestrator: sửa tối thiểu); spec chưa định nghĩa giới hạn nào như vậy.
  - Không thêm test riêng cho "`buildSeedDataset` không sinh `seed-identity-partial`": test sẵn có "passes validateSeedDataset for the %s fixture" chạy `validateSeedDataset` trên đầu ra của builder với bốn fixture (6 cột auto-increment), nay kiểm luôn mã mới. Builder chỉ bỏ cột khi kiểu custom có mặc định, quyết định theo cột nên luôn bỏ ở mọi dòng.
- **Việc còn lại**
  - [ ] spec-writer cập nhật spec CG-08 (dòng liệt kê mã `SeedIssue`, khoảng dòng 588): thêm `seed-identity-partial` (một số dòng của bảng đặt cột auto-increment, dòng khác bỏ; `path` là dòng bỏ cột) cùng lý do (SQL Server Msg 339 dưới `IDENTITY_INSERT`, sequence PostgreSQL trùng khóa trước `setval`).
- **Ghi chú cho người tiếp theo**
  - Danh mục `SeedIssue` không được export ở entry chính và chưa có bản dịch i18n (spec Vấn đề 11); phần 5 (AI-06) cần dịch cả mã mới khi hiển thị.
