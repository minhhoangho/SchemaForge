# Review 4: Task 31 Tải ZIP

Task 31 trong [plan phần 7](../../plans/2026-10-03-import-export-plan.md), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md). `project-reviewer` (chỉ đọc) review commit `4f6d4e8`. Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của reviewer và quyết định của orchestrator.

## 2026-10-05 21:20 — project-reviewer — Xong

- **Đã làm**: review `4f6d4e8` (22 file, +1724/−37) theo `CLAUDE.md`, `.claude/rules/`, spec mục 8–12, plan Task 31, "Quy ước chung" và "Điểm nóng". Đã đọc `build-zip.ts`, `handle-zip-request.ts`, `use-build-zip.ts`, `zip-selection.ts`, `zip-dialog.tsx`, phần sửa của `worker-protocol.ts`, `code-generator.worker.ts`, `create-editor-store.ts`, `export-menu.tsx`, `use-export-actions.ts` và i18n.
  - Kết luận: approve with fixes, không có finding blocking.
  - Phần lõi khớp plan: sắp tên file bằng `<`, `zipSync` với `new Date(1980,0,1)` và mức nén 6/0, protocol bổ sung không đổi request cũ, `zipSelection` không lưu, mục "ZIP…" đã bật. Không vi phạm nguyên tắc kiến trúc.
  - Nên sửa (1): `use-build-zip.ts:118-122`, hàm `fail` giữ worker hỏng trong `workerRef`, nên lần "Tải" sau treo mãi ở "Đang tạo…". `useGeneratedCode` (`use-generated-code.ts:79-81`) có cùng lỗi tiềm ẩn.
  - Nên sửa (2): `zip-dialog.tsx` dài 407 dòng, `SelectionFields` khoảng 130 dòng; tách sang `zip-selection-fields.tsx`.
  - Nên sửa (3): `handle-zip-request.ts:26`, quy tắc PNG không nén và SVG nén chưa được test qua `handleZipRequest`.
  - Nit: `zip.summary` tiếng Anh không có số nhiều ("1 files, 1 notes"); `hasSelfRelation` lặp ở `use-build-zip.ts:74-76` và `use-export-actions.ts:64-66`; `diagnosticCount` cũ đứng cạnh `fileCount` mới; lỗi tạo ZIP không log `errorName`.
  - Phạm vi: agent thêm key `zip.filesOnly_one`/`zip.filesOnly_other` vào file i18n của Task 22 (lệch phạm vi, nội dung đúng). Commit gộp phần sửa review-3 cho menu Export (orchestrator đã cho phép).
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - vitest 9 file của task, coverage tắt: 9 file, 97 test pass.
  - `prettier --check`: pass.
  - `secret-scan.sh --range 4f6d4e8~1..4f6d4e8`: `SECRET-SCAN: CLEAN`.
  - Bỏ qua lint vì config ở cây chính hỏng (verify trong worktree của agent đã pass). Typecheck, toàn bộ test (222 file, 5235 test pass) và build do orchestrator chạy trên `master`.
- **Quyết định**
  - Reviewer chấp nhận cả 7 quyết định của agent: tên boolean theo plan kèm `eslint-disable` có lý do; PNG không nén, SVG và văn bản mức 6; `returnFocusRef`; `selectAllZip(codeOptions)` và `clearZip` bỏ cả JSON; chụp ảnh tuần tự với một worker; hộp thoại vẫn mở sau khi tải, Drizzle chỉ PostgreSQL và MySQL; không có nút mở issues.
  - Orchestrator: chấp nhận hồi tố key `zip.filesOnly`; sửa luôn `useGeneratedCode`; cho phép tạo `zip-selection-fields.tsx` và sửa locale cho `zip.summary`; không thêm gợi ý "dùng SVG" cho PNG trong ZIP (người dùng có thể chọn SVG ngay trong hộp thoại). Mọi sửa giao cho `frontend-engineer`, log `2026-10-05-import-export-review-4-fixes.md`.
- **Việc còn lại**
  - [ ] Should-fix (1): hủy worker hỏng trong `fail` ở `use-build-zip.ts` (`workerRef` không giữ worker lỗi), và sửa tương tự `useGeneratedCode` (`use-generated-code.ts`), kèm test.
  - [ ] Should-fix (2): tách `SelectionFields` sang `zip-selection-fields.tsx`.
  - [ ] Should-fix (3): thêm test qua `handleZipRequest` cho PNG không nén và SVG nén.
  - [ ] Nit: `zip.summary` có số nhiều trong locale `en`; gom `hasSelfRelation` về một chỗ; bỏ `diagnosticCount` cũ cạnh `fileCount`; log `errorName` khi tạo ZIP lỗi.
  - [ ] Theo dõi tiến độ trong log `2026-10-05-import-export-review-4-fixes.md`.
- **Ghi chú cho người tiếp theo**: lint ở cây chính hỏng do `eslint.config.mjs` có bản sửa chưa commit (`files: []`); chạy lint trong worktree sạch.
