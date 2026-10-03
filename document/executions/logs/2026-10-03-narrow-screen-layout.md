# Bố cục editor trên màn hình hẹp (code panel)

Không có plan task; spec liên quan: `document/specs/2026-09-14-code-generators-design.md` (code panel).

## 2026-10-03 — frontend-engineer — Xong
- **Đã làm**: dưới breakpoint `lg` (1024 px), code panel không còn rộng cố định 32rem mà chiếm phần còn lại của workspace (`min-w-0 flex-1`), còn canvas (`<main>`) bị ẩn bằng `max-lg:hidden` khi ở chế độ code; nút Code trên toolbar đưa canvas trở lại. Từ `lg` trở lên giữ nguyên `lg:w-[32rem] lg:flex-none`.
- **File thay đổi**: `frontend/src/features/editor/components/editor-workspace.tsx` (class của canvas và của placeholder khi tải), `frontend/src/features/editor/code-generator/code-panel.tsx`, `frontend/src/features/editor/components/editor-workspace.test.tsx` (test mới).
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` (xem kết quả trong báo cáo).
- **Quyết định**
  - Ẩn canvas thay vì co panel: đơn giản nhất, chỉ dùng CSS, không thêm chuỗi i18n mới (đã có nút toggle Code).
  - `max-lg:hidden` (display:none): không còn focus được khi ẩn, skip link nằm trong `<main>` nên biến mất cùng canvas, tab đi thẳng từ left panel sang code panel.
  - Giữ left panel như cũ (nút thu gọn đã có, `IssueWarning` vẫn cần mở tab issues): ở 500 px mà left panel mở, code panel còn ~212 px, có thể thu gọn left panel để rộng hơn.
  - Placeholder của `dynamic()` dùng cùng class với panel để không nhảy layout; lặp class thay vì import hằng số để không phá lazy-load.
  - Test chỉ kiểm tra class (jsdom không áp CSS media query).
- **Ghi chú cho người tiếp theo**: cần kiểm tra thủ công ở 500/768/1024/1440 px trên trình duyệt thật (jsdom không kiểm tra được). Ở 1024-1279 px canvas hẹp (~224 px khi left panel mở) nhưng khác 0.
