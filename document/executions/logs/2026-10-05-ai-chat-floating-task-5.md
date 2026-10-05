# Sửa các phát hiện review về focus ring toàn app

Liên quan: [task 3](2026-10-05-ai-chat-floating-task-3.md), bản ghi quyết định "Token viền và focus ring" trong `document/architecture.md`.

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**
  - `generator-diagnostic-list.tsx`: hàng chẩn đoán dùng `ring-inset` để vòng focus không bị `overflow-y-auto` của `ul` cắt.
  - `scroll-area.tsx`: viewport dùng `focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`, bỏ offset và `outline-1` thừa.
  - `skip-to-panel-link.tsx`: `ring-3` thành `ring-2` kèm `ring-offset-2 ring-offset-background` (kiểu control).
  - `globals.test.ts`: thêm cặp `--ring` với `--accent` và `--secondary` cho light và dark.
  - `globals.css`: dark `--ring` từ `oklch(0.56 0.11 258)` thành `oklch(0.58 0.11 258)` (cặp với accent đo được 2.92:1, không đạt 3:1).
  - Rà `ring-offset-2` trong vùng cuộn: toolbar (`overflow-x-auto`, px-2, cao 48px, nút căn giữa), `code-panel` (p-3), `create-relation-dialog` (p-6 nằm trong chính vùng cuộn), list tab (`ul` p-2), properties panel (p-4), command/select/dropdown (p-1, mục dùng bg thay vì offset). Không chỗ nào bị cắt, không sửa thêm.
- **File thay đổi**: `frontend/src/app/globals.css`, `frontend/src/app/globals.test.ts`, `frontend/src/components/ui/scroll-area.tsx`, `frontend/src/features/editor/code-generator/generator-diagnostic-list.tsx`, `frontend/src/features/editor/components/skip-to-panel-link.tsx`.
- **Kiểm tra**: xem báo cáo (verify.sh, secret-scan.sh).
- **Quyết định**
  - `ring-inset` cho hàng trong danh sách cuộn và viewport ScrollArea; offset cho skip link (nằm ngoài vùng cuộn).
  - Chỉ chỉnh độ sáng dark `--ring` (+0.02), giữ hue và độ đục. Light dùng `--primary`, mọi cặp đã đạt.
  - Tỉ lệ ring với bg/card/popover/muted/canvas/accent/secondary: light 4.83/4.97/4.97/4.49/4.56/4.23/4.36; dark 4.33/3.98/3.77/3.61/4.48/3.17/3.39.
- **Việc còn lại**: spec-writer cập nhật giá trị dark `--ring` trong `document/architecture.md`.
- **Ghi chú cho người tiếp theo**: cần kiểm tra bằng mắt trên trình duyệt thật vòng focus của hàng danh sách khi hover cả hai theme.
