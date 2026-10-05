# Review cửa sổ chat AI nổi và bubble (lần 2)

Không thuộc task nào trong plan. Hai reviewer chỉ đọc (`ui-a11y-reviewer`, `project-reviewer`) xem lại thay đổi chưa push của cửa sổ chat AI nổi sau khi sửa theo [review lần 1](2026-10-05-ai-chat-floating-review-1.md) ở [task 4](2026-10-05-ai-chat-floating-task-4.md) và [task 5](2026-10-05-ai-chat-floating-task-5.md). Spec: [spec phần 5](../../specs/2026-10-02-ai-assistant-design.md) (AI-R1, AI-R51 và ghi chú 2026-10-05). Thiết kế: [ai-chat-bubble-mockup.html](../../ui_reference/ai-chat-bubble-mockup.html). Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của họ. Các phát hiện mới được sửa ở [task 6](2026-10-05-ai-chat-floating-task-6.md).

## 2026-10-05 — ui-a11y-reviewer — Xong
- **Đã làm**: review lại i18n, token theme và khả năng truy cập (WCAG 2.2 AA) của cửa sổ chat nổi. Kết luận: duyệt, kèm mục cần sửa.
  - Mọi phát hiện của lần 1 đã được xử lý: sheet màn hẹp là modal và phần còn lại của workspace mang `inert`; pan node bị cửa sổ che trên màn rộng; Escape bỏ qua khi `isComposing`; giờ gửi lưu ở `createdAt`; hàng trong vùng cuộn và `ScrollArea` dùng `ring-inset`; hàng chip có `-m-1 p-1` để ring không bị cắt; skip link dùng `ring-2`; dark `--ring` lên 0,58 kèm cặp kiểm tra trên `accent` và `secondary`; launcher có tên ổn định, `aria-expanded`, `aria-controls`, chấm chưa đọc chỉ khi lượt `done`; "đã trả lời xong" báo đúng một lần, vùng status ở gốc workspace, launcher và cửa sổ hiện ở chế độ code dưới `lg`.
  - Mới, nên sửa (2.4.3 Focus Order): trên màn hẹp khi cửa sổ thu nhỏ, sau Chấp nhận hoặc Bỏ focus rơi về `body` (không có thẻ đề xuất hiện và launcher không render).
  - Mới, nit: lúc animation đóng sheet, launcher thoáng nằm dưới sheet.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**: `.claude/scripts/verify.sh frontend`: PASS (4581 test, 96,2% dòng). Không kiểm trên trình duyệt.
- **Quyết định**: không có.
- **Việc còn lại**
  - [x] Focus về `body` sau Chấp nhận, Bỏ trên màn hẹp khi thu nhỏ: đã sửa ở [task 6](2026-10-05-ai-chat-floating-task-6.md) (fallback về nút Khôi phục).
  - [ ] Kiểm tay trên trình duyệt và trình đọc màn hình: màn hẹp (`inert`, focus quay về launcher, thanh thu nhỏ); pan node trên màn rộng với cửa sổ 380px và 520px; tương phản ring, kể cả hàng `ring-inset` khi hover; tên truy cập của launcher; lỗi chỉ được đọc một lần; ring của chip ở 320px; kích thước vùng bấm.
- **Ghi chú cho người tiếp theo**: nit launcher dưới sheet lúc animation đóng chưa được xử lý; chỉ ảnh hưởng hình ảnh trong vài trăm mili giây.

## 2026-10-05 — project-reviewer — Xong
- **Đã làm**: review lại theo nguyên tắc kiến trúc trong `CLAUDE.md`, các rule trong `.claude/rules/`, `document/architecture.md` và spec phần 5. Kết luận: duyệt, kèm mục cần sửa.
  - Mọi mục của lần 1 đã được xử lý: sheet modal và `inert` trên màn hẹp, chấm chưa đọc chỉ khi `done`, bản nháp trong store chat, `AiTurnStatus` ở gốc workspace, `createdAt` do store đóng dấu bằng clock tiêm vào, pan node dưới cửa sổ, token ring và `ring-inset`.
  - Mới, nên sửa:
    - S1: focus mất về `body` sau Chấp nhận, Bỏ trên màn hẹp khi thu nhỏ (2.4.3).
    - S2: chấm chưa đọc không thấy được trên màn hẹp khi thu nhỏ, vì launcher không render.
    - S3: `frontend/src/features/editor/state/create-editor-store.ts` dài 362 dòng, quá giới hạn 300 dòng.
  - Nit: `vi.useRealTimers()` gọi trong thân test thay vì `afterEach`; một dòng JSDoc quá dài.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend --build --format`: lần chạy test đầu bị chặn vì một lần chạy song song đang khóa thư mục coverage; chạy lại PASS (4581 test, 96,21% dòng).
  - `.claude/scripts/secret-scan.sh`: CLEAN.
  - Bundle: không có dấu hiệu của panel AI trong chunk entry của `/schemas/[schemaId]`.
- **Quyết định**: không có.
- **Việc còn lại**
  - [x] S1, S2, S3 và hai nit: đã sửa ở [task 6](2026-10-05-ai-chat-floating-task-6.md).
  - [ ] Tách `frontend/src/features/editor/components/editor-workspace.tsx` (563 dòng) và `frontend/src/features/editor/state/create-ai-chat-store.ts` (341 dòng) cho dưới 300 dòng; hai file này đã quá giới hạn từ trước thay đổi này, làm ở một lần refactor riêng.
- **Ghi chú cho người tiếp theo**: khi chạy `verify.sh` song song với agent khác, thư mục coverage có thể bị khóa; chạy lại sau khi lần kia xong.
