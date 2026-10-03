# Review code phần 5 lượt 2 (b9f695a..c0325ad)

Liên kết: [Plan](../../plans/2026-10-03-ai-assistant-plan.md), [Spec](../../specs/2026-10-02-ai-assistant-design.md)

> **Log dựng lại.** Báo cáo gốc của lượt review này không được giữ lại. Log này được dựng lại ngày 2026-10-04 từ phần tóm tắt trong [handoff phiên 2](2026-10-03-ai-assistant-session-2-handoff.md) (mục 2.a, 2.b, 3.4, 4). Chỉ ghi những gì handoff có; không có chi tiết từng finding, mức độ hay giờ chạy chính xác. Muốn kiểm chứng, đối chiếu với các commit sửa và các log task liên quan.

## 2026-10-03 — project-reviewer — Xong

- **Đã làm**: lượt `project-reviewer` thứ hai, review chỉ đọc dải commit `b9f695a..c0325ad` trên `master`. Dải này kết thúc ở Task 24 (`c0325ad`, đánh dấu thay đổi của đề xuất AI trên canvas); theo bảng 2.b của handoff, nó gồm các task đã merge trong phiên 2 từ Task 20 đến Task 24. Kết luận: **accept-with-fixes**.

- **File thay đổi**: không (review chỉ đọc)

- **Kiểm tra**: không có số liệu trong handoff (lệnh và kết quả của reviewer không được ghi lại).

- **Quyết định**: accept-with-fixes. Các việc sửa được xử lý bằng ba commit sau review, theo mô tả ở mục 2.b của handoff:
  - F2 `d50b6f9`: tách `ai-chat-client.ts`, phần dựng request chuyển sang `ai-chat-request.ts` (file mới).
  - F3 `fa72455` `fix(core): report duplicate AI column names and split long translators` (log `2026-10-03-ai-edit-review-fixes.md`): `createTable` có tên cột trùng nay trả một lỗi `column-name-duplicate` tại `["columns", i, "name"]` (trước đây là hai issue ở đường dẫn của document); hành vi đổi này đã được chấp nhận. `ai-edit-tables.ts` (301 dòng) và `ai-edit-relations.ts` (300 dòng) đã chạm giới hạn kích thước, nên logic mới phải vào file mới.
  - F4 `7c1952c` `fix(backend): bound escaped AI history and strip forged outcome markers`: thêm `AI_MAX_ESCAPED_HISTORY_LENGTH` = 120 000 và `AiHistoryTooLargeError` trong `ai-prompt.ts`; gỡ marker kết quả giả mạo, kể cả giữa dòng. Khoảng hở đã chấp nhận: marker giả mạo bằng dấu kết hợp (ví dụ `thís`) không bị gỡ vì gỡ `\p{Mn}` sẽ phá tiếng Việt; tác động chỉ nằm trong lượt của chính người dùng.

- **Việc còn lại**:
  - [x] F2: tách `ai-chat-client.ts` thành `ai-chat-client.ts` và `ai-chat-request.ts` — `d50b6f9`
  - [x] F3: báo lỗi tên cột trùng của `createTable` và tách các translator dài — `fa72455`
  - [x] F4: giới hạn lịch sử đã thoát ký tự và gỡ marker kết quả giả mạo — `7c1952c`
  - [ ] Giữ quy ước `no-restricted-imports` bằng tay ở Task 28: lint không áp dụng quy tắc này cho `*.test.*` và `frontend/src/testing/**`, nên tiền đề của Vấn đề 34 trong plan là sai (handoff mục 3.4)
  - [ ] Khi Task 18 map `AiHistoryTooLargeError`: dùng `ApiErrorCode` `payload-too-large` (413) trước khi mở stream (xem [security review lượt 2](2026-10-03-ai-assistant-security-review-2.md))

- **Ghi chú cho người tiếp theo**:
  - Handoff không ghi rõ finding nào dẫn tới F2 so với F3/F4, và cũng không ghi mức độ từng finding; đừng suy diễn thêm từ log này.
  - Các mục "Việc còn lại" ngoài F2–F4 được lấy từ mục 3.4 của handoff, nơi nguồn gốc (review hay ghi chú task) không được tách rõ; kiểm tra lại với orchestrator nếu cần xác định chính xác.
