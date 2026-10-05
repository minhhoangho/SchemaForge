# Review 3 (UI, i18n, a11y): các task frontend phần 7 đã merge

Không thuộc task nào trong plan. `ui-a11y-reviewer` (chỉ đọc) review UI của các task frontend đã merge trong [plan phần 7](../../plans/2026-10-03-import-export-plan.md), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md); đi cùng [review 3](2026-10-05-import-export-review-3.md). Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của reviewer và quyết định của orchestrator.

## 2026-10-05 21:30 — ui-a11y-reviewer — Xong

- **Đã làm**: rà i18n, theme và WCAG 2.2 AA cho `3f4d344` (T22), `b8fcacb` (T29), `5a52d7a` (T23), `234c3be` (T27), `b648d4e` (T30). Đọc `export-menu.tsx`, `use-export-actions.ts`, `capture-canvas-image.ts`, `compute-image-frame.ts`, `code-view.tsx`, `schema-list-row.tsx`, `use-download-schema-json.ts`, `download-blob.ts`, `editor-flow-provider.tsx`, `viewport-controls.tsx`, `editor-canvas.tsx`, locale `en`/`vi` của `importExport` và `importDiagnostics`, khối CSS `data-exporting` trong `globals.css`, spec mục 8, 10, 12 và plan Task 30. Kết luận: approve with fixes; không có lỗi chặn; 3 should-fix, 2 nit.
  - Nên sửa: trạng thái đang tạo ảnh gần như không thấy được. Menu Radix đóng ngay khi chọn PNG/SVG, nút không có `aria-busy`, không có thông báo polite (WCAG 4.1.3). Vị trí: `export-menu.tsx:47-51`, `use-export-actions.ts:44-77`.
  - Nên sửa: test axe `export-menu.test.tsx:200-205` chỉ chạy theme light.
  - Nên sửa (khoảng trống kiểm chứng): ảnh không có vòng focus và chrome chỉ được kiểm gián tiếp vì jsdom không tính style; chưa chắc override `--tw-ring-color: transparent` có tác dụng với `ring-1 ring-primary` ở `table-node.tsx:141`.
  - Nit: `globals.css:984-987` node đang chọn giữ `shadow-md` khi export.
  - Nit: tên file bị cắt trong `code-view.tsx` không có tooltip.
  - Đã kiểm, ổn: i18n đủ hai locale cùng cấu trúc, `vi` dùng `satisfies`, không có chuỗi cứng; theme chỉ dùng token; menu Export, nút "Tải file", mục "Tải JSON" đúng quy ước; CSS `[data-exporting]` ẩn handle, badge, vòng chọn; chỉ clone `.react-flow__viewport`.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - `test-file.sh frontend` cho `export-menu.test.tsx`, `import-export-messages.test.ts`, `schema-list-row.test.tsx`, `code-view.test.tsx`: PASS.
  - `secret-scan.sh --files <6 file>`: `SECRET-SCAN: CLEAN`.
  - Không chạy typecheck, lint, trình duyệt.
- **Quyết định**
  - Reviewer: không đánh dấu blocking việc thiếu thông báo trạng thái, vì spec chỉ yêu cầu mục menu hiện "Đang tạo ảnh…".
  - Orchestrator: hai should-fix đầu gộp vào Task 31 (đang sở hữu `export-menu`); hai nit vào `2026-10-05-import-export-review-3-fixes.md`; kiểm tra trình duyệt vào Task 32.
- **Việc còn lại**
  - [ ] Thêm `aria-busy` cho nút trigger và thông báo polite dùng khóa `importExport:export.generatingImage` (Task 31).
  - [ ] Chạy axe ở cả hai theme trong `export-menu.test.tsx` (Task 31).
  - [ ] Kiểm tra ảnh PNG/SVG hai theme trên trình duyệt thật: không vòng chọn, không focus, không handle, không badge, không minimap; nền đúng theme; marker chân gà (Task 32).
  - [ ] Reset `box-shadow` của node đang chọn khi export trong `globals.css` (review-3-fixes).
  - [ ] Thêm tooltip cho tên file bị cắt trong `code-view.tsx` (review-3-fixes).
  - [ ] Kiểm tra tay: độ tương phản, thứ tự Tab, focus quay về trigger, trình đọc màn hình, kích thước mục tiêu, focus không bị che, CSP.
- **Ghi chú cho người tiếp theo**: Task 31 nằm ngoài phạm vi review này. Test chụp ảnh dùng `capture` giả nên CSS `[data-exporting]` chưa được kiểm tự động. Chạy test từng file bằng `.claude/scripts/test-file.sh frontend <đường dẫn>` sau `source ~/.nvm/nvm.sh && nvm use`; máy không có lệnh `timeout`.
