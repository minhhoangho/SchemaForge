# Review a11y Task 27b: Panel AI, thanh xem trước và nối vào editor

Plan: [Task 27b](../../plans/2026-10-03-ai-assistant-plan.md#task-27b-panel-ai-thanh-báo-xem-trước-nút-trên-toolbar-khóa-editor-khi-xem-trước). Spec: [AI-R34, R36, R48, R50–R54, R60; mục 13, mục 14](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-04 — ui-a11y-reviewer — Xong

- **Đã làm**
  - Review chỉ đọc phần UI của Task 27b chưa commit trên `master`: i18n `vi`/`en`, token theme ở chế độ sáng và tối, và WCAG 2.2 AA.
  - Kết luận: chấp nhận kèm sửa, không có phát hiện chặn.
  - Đã kiểm đạt:
    - i18n `vi` và `en` đủ khóa: `messagesLabel`, `userMessage`, `assistantMessage`, `rateLimited_one`/`rateLimited_other`, trạng thái `responding`/`done`/`stopped`.
    - Chỉ dùng token theme, không có màu cứng.
    - Landmark và heading: panel dùng `h2`, khối đồng ý và khối dành cho khách dùng `h3`.
    - `role="log"` có tên; nhãn tác giả `sr-only`; lỗi không chỉ truyền bằng màu.
    - Nút bật panel dùng `aria-pressed`; nút trên thanh công cụ bị vô hiệu hóa khi xem trước; focus trả về nút bật khi đóng panel.
    - `inert` trên panel trái và panel thuộc tính.
    - Test axe cả hai theme trong test của panel.
- **File thay đổi**: không (reviewer chỉ đọc, không chạy lệnh).
- **Kiểm tra**: không chạy lệnh nào; chỉ đọc mã và test.
- **Quyết định**
  - Cần sửa:
    1. Focus rơi về `body` khi luồng kết thúc đúng lúc nút "Dừng" đang giữ focus.
    2. `focusProposalCard` mất focus khi panel AI bị đóng trong lúc xem trước; cần dự phòng đưa focus về nút bật panel.
    3. `role="log"` có thanh cuộn nhưng không tới được bằng bàn phím (WCAG 2.1.1).
    4. Thanh xem trước đặt `absolute` phủ đầu canvas, khi xuống dòng có thể che nội dung đang có focus (WCAG 2.4.11).
  - Nit: `aria-busy` nên đặt trên vùng log khi đang stream; focus của khối đồng ý đang rơi vào nút chứ không vào khối; thêm ca axe vào `ai-message-list.test.tsx`.
  - Orchestrator: sửa (1)–(4), `aria-busy` trên log và ca axe; giữ focus vào nút đồng ý.
- **Việc còn lại**
  - [ ] Sửa (1)–(4), `aria-busy` trên log và thêm ca axe cho `ai-message-list.test.tsx` (do agent Task 27b làm trước khi commit).
  - [ ] Kiểm tay độ tương phản ở cả hai theme: chữ muted trên `bg-background/95` và `bg-muted`, `border-diff-removed`, `border-destructive`.
  - [ ] Kiểm tay focus ring của mọi điều khiển mới và cuộn bàn phím của vùng log.
  - [ ] Kiểm tay WCAG 2.4.11 với thanh xem trước nhiều dòng ở `vi` và `en`.
  - [ ] Kiểm tay với trình đọc màn hình: log và status có đọc trùng không, focus trả về đâu sau `AlertDialog`.
  - [ ] Kiểm tay vùng bấm tối thiểu 24 px và chữ `vi` dài ở độ rộng hẹp.
- **Ghi chú cho người tiếp theo**
  - Các mục (1) và (2) trùng với phát hiện H2 và M1 của review React; sửa một lần.
