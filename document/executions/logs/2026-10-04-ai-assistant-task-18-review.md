# Review Task 18: `AiChatService`, `AiController`, `AiModule`

Liên kết: [Plan, Task 18](../../plans/2026-10-03-ai-assistant-plan.md), [Spec, mục 12](../../specs/2026-10-02-ai-assistant-design.md)

## 2026-10-04 — project-reviewer — Xong

- **Đã làm**: review thay đổi chưa commit trong worktree (nền `13236f4`), đối chiếu với `CLAUDE.md`, `.claude/rules/`, plan Task 18 (Vấn đề 42, 44, 51) và spec mục 12. Đọc mã `ai` 7.0.126 trong `dist`: `usage` trả `totalUsage` (tổng mọi bước); `streamText` đổi lỗi thành `abort` khi signal đã abort nên client ngắt kết nối không gọi `onError`; `writeToServerResponse` hủy reader khi `close` và không ném lỗi. Đã xác minh mọi yêu cầu bổ sung:
  - `onError` tường minh trên cả `streamText` và `toUIMessageStream`, chỉ log `{ code, errorName, statusCode }`, có test sentinel.
  - Thứ tự: model → khóa → parse → prompt → ngân sách.
  - Khóa được trả trong `catch`, khi abort và trong `finally`.
  - `AiPromptTooLargeError` → 413 `ai-schema-too-large`; `AiHistoryTooLargeError` → 413 `payload-too-large`.
  - Client hủy thì im lặng; timeout → `ai-timeout` qua `onAbort`.
  - Route không có `@Public()`; `AiCapacity` nằm trong `providers`.
- **File thay đổi**: không.
- **Kiểm tra**:
  - `verify.sh backend --format`: PASS (552 test, lines 98,03%).
  - Backend build: PASS.
  - `secret-scan`: CLEAN.
  - E2E `security` chưa chạy trong worktree (không có `.env.test`); orchestrator chạy sau khi merge.
- **Quyết định**: chấp nhận cả 8 quyết định của implementer:
  1. Khóa cũng được trả khi abort, với hàm trả khóa dùng một lần. Lời gọi Gemini cũng bị hủy nên không vòng qua AI-R56; cần ghi chú vào spec (mục D của yêu cầu, đã làm).
  2. Phân biệt timeout với client hủy bằng `abortSignal.aborted` của chính request.
  3. Spec 739 dòng tạm chấp nhận, nhưng lý do "không có chỗ đặt helper" là sai (`backend/test/` import được).
  4. Lượt bị hủy log là `ai.chat.completed` với `outcome: "aborted"`.
  5. `stoppedEarly` suy ra từ số bước và tool call của bước cuối.
  6. Token lấy từ `result.usage`, đã xác minh là của cả lượt.
  7. Service nhận `AiChatRequest`; `AiStreamResponse` nhận `ServerResponse`.
  8. Hạ giới hạn trong test bằng getter của `vi.mock`.
  - File thêm ngoài dự kiến `ai-chat-turn.ts`, `ai-turn-parts.ts` (cùng spec), `ai-chat.service.limits.spec.ts`, `ai.module.spec.ts`: chấp nhận.
  - Orchestrator: giao tất cả nit cho agent Task 18 sửa trước khi merge.
- **Việc còn lại**:
  - [ ] `linkAbort`: xử lý response đã đóng sẵn (abort ngay nếu đã đóng) và kiểm tra `abortSignal.aborted` trước khi lấy khóa và tiêu ngân sách.
  - [ ] Tách spec của service, đặt helper dùng chung trong `backend/test/`.
  - [ ] Tách phần kết thúc (finish) của `runAiTurn` ra hàm riêng (khoảng 50 dòng).
  - [ ] Sửa test "turns off reasoning and sources" để spy `toUIMessageStream`.
  - [ ] Ghi chú vào spec (đã làm ở mục 12 và AI-R31; xem log `2026-10-04-ai-assistant-security-review-3.md`).
  - [ ] Orchestrator chạy e2e `security` sau khi merge.
- **Ghi chú cho người tiếp theo**: không có nit nào chặn merge; verdict là accept. Các nit nên xong cùng lượt sửa M1, M2 của security review lượt 3 vì cùng chạm `linkAbort` và nhánh ngân sách.
