# Task 30: Tài liệu cuối

[Plan phần 5, Task 30](../../plans/2026-10-03-ai-assistant-plan.md#task-30-tài-liệu-cuối) · [Spec phần 5, mục "Thay đổi cần ghi vào architecture.md"](../../specs/2026-10-02-ai-assistant-design.md#thay-đổi-cần-ghi-vào-architecturemd)

## 2026-10-05 — spec-writer — Xong

- **Đã làm**
  - Áp đủ 12 dòng của bảng "Thay đổi cần ghi vào architecture.md" vào `document/architecture.md`:
    - Dòng 1–4 sửa đúng dòng có sẵn của "Quyết định đã chốt": "SDK gọi Gemini" (phiên bản thật `ai` 7.0.126, `@ai-sdk/google` 4.0.87 lấy từ `backend/package.json`; frontend `ai` 7.0.126 từ `frontend/package.json`; không dùng `@ai-sdk/react`), "Model Gemini" (key tùy chọn, `503 ai-unavailable`, `GEMINI_MODEL` bắt buộc khi có key, `AI_MAX_RETRIES` 1, key trả phí là điều kiện deploy), "Giới hạn sử dụng AI" (10/100 theo người dùng, 20/200 theo IP, một stream mỗi người dùng, ngân sách toàn cục 1000, 30 tool call, 80.000 ký tự, theo từng process), "Rate limit (đăng nhập, đăng ký, refresh)" đổi tên thành "Rate limit (đăng nhập, đăng ký, refresh, AI)" và thay câu "xem lại khi thêm giới hạn cho AI ở phần 5".
    - Dòng 5–9 thêm năm dòng mới ngay sau "Xác nhận thay đổi của AI": "Tool của AI" (kèm hình dạng cặp `{ column, value }` của `proposeSampleData` theo Vấn đề 22), "Giao thức stream AI", "Lưu giữ hội thoại AI", "Hiển thị câu trả lời AI", "Diff schema".
    - Dòng 10 sửa bước 3, 4 và câu rate limit của "Luồng dữ liệu › AI Assistant".
    - Dòng 11 xóa dòng "DTO tương lai mang trường `document` phải có `@RawValue()`" khỏi "Hạn chế đã biết" (đã xác nhận `AiChatRequestDto` dùng `@RawValue()` và `backend/test/ai.e2e-spec.ts` có test `__proto__` trả `422`).
    - Dòng 12 thêm hai gạch đầu dòng vào "Bảo mật API key" (danh sách chunk cho phép, `sendReasoning`/`sendSources` tắt, `onError` chỉ log mã, telemetry tắt; proxy và APM không ghi body của `POST /ai/chat`).
  - Xóa 8 dòng "Phần 5" khỏi "Chưa chốt": Cách dùng AI SDK ở frontend, Cấu hình model Gemini, Con số giới hạn AI, Tool của AI, Giao thức stream AI, Lưu giữ hội thoại AI, Hiển thị câu trả lời AI, Diff schema.
  - Thêm ba ghi chú triển khai vào "Hạn chế đã biết" (theo handoff phiên 3, mục 3.2): `TRUST_PROXY_HOPS` khi deploy sau proxy, khóa IP theo IPv6 /64 (tùy chọn, chưa làm), trạng thái giới hạn AI theo từng process.
  - `document/roadmap.md`: trạng thái phần 5 thành `Xong`; thêm một đoạn ngắn về phần 5 cạnh đoạn của phần 4 và phần 6. Ghi chú thứ tự không đổi vì phụ thuộc không đổi.
- **File thay đổi**
  - `document/architecture.md`
  - `document/roadmap.md`
  - `document/executions/logs/2026-10-05-ai-assistant-task-30.md` (log này)
- **Kiểm tra**
  - Đối chiếu hằng với code: `backend/src/modules/rate-limit/rate-limit.policy.ts` (`ai-user-*` 10/100, `ai-ip-*` 20/200), `backend/src/modules/ai/ai.constants.ts` (`AI_MAX_RETRIES` 1, `AI_MAX_TOOL_CALLS_PER_TURN` 30, `AI_BUSY_RETRY_AFTER_SECONDS` 10), `packages/api-contract/src/limits.ts` (`AI_MAX_SCHEMA_PROMPT_LENGTH` 80.000), `backend/src/config/env.ts` (`AI_GLOBAL_REQUESTS_PER_HOUR` mặc định 1000, `TRUST_PROXY_HOPS` mặc định 0), `backend/src/modules/ai/ai-chat.service.ts` (`503` hết ngân sách có `retryAfterSeconds`).
  - Script đếm cột: mọi bảng của `architecture.md` và `roadmap.md` đúng số cột, không có `|` chưa escape.
  - `git status --porcelain`: chỉ `document/architecture.md`, `document/roadmap.md` và log này.
  - Đọc lại diff từng dòng đối chiếu bảng 12 dòng của spec.
- **Quyết định**
  - Hằng "30 tool call" và "80.000 ký tự" của dòng "Con số giới hạn AI" (Chưa chốt) gộp vào dòng "Giới hạn sử dụng AI", để xóa dòng Chưa chốt mà không mất thông tin.
  - Ghi `503` hết ngân sách "kèm `Retry-After`" và lượt đồng thời "`Retry-After: 10`" theo code thật (quyết định của handoff phiên 3, mục 4), không mâu thuẫn spec.
  - Ba ghi chú triển khai đặt ở "Hạn chế đã biết" (mục ghi giới hạn và việc cần làm khi deploy), không thêm mục mới.
  - Sửa thêm dòng "Khóa `__proto__` trong tài liệu gửi lên backend" để liệt kê `AiChatRequestDto` cùng hai DTO cũ, vì sau khi xóa dòng hạn chế (dòng 11) câu "`CreateSchemaDto` và `UpdateSchemaDto` đánh dấu `document`" thành thiếu.
  - Cột lý do của "Diff schema" (spec không ghi lý do) viết: một hàm diff trong core dùng chung cho hai tính năng, chạy được ở trình duyệt và backend.
  - Task 29 không đổi hằng nào (theo orchestrator), nên không có giá trị AI-R57 nào cần ghi khác spec.
- **Ghi chú cho người tiếp theo**
  - Commit theo plan: `docs: record AI assistant decisions and mark part 5 done`.
  - Log kiểm tra tay của Task 29 chưa có; khi có, có thể thêm link vào đoạn phần 5 của `roadmap.md`.
