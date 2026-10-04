# AI Assistant Task 19: e2e của `POST /ai/chat`

Plan: `document/plans/2026-10-03-ai-assistant-plan.md` (Task 19). Spec: `document/specs/2026-10-02-ai-assistant-design.md` mục 12.

## 2026-10-04 — backend-engineer — Xong
- **Đã làm**: thêm `overrideProviders` vào `createTestApp`; viết 16 test e2e của `POST /ai/chat` trong `backend/test/ai.e2e-spec.ts` (đủ danh sách của plan). Không đổi code production, không đổi `.env*`, không thêm biến env, migration hay endpoint.
- **File thay đổi**: `backend/test/create-test-app.ts`, `backend/test/ai.e2e-spec.ts`.
- **Kiểm tra**: `vitest run --config vitest.e2e.config.ts` toàn bộ: 4 file, 79 test xanh. `.claude/scripts/verify.sh backend --format`: `RESULT: PASS` (556 unit test). `secret-scan.sh` (toàn repo và `--files backend/test/ai.e2e-spec.ts`): `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Test giới hạn tốc độ gửi tài liệu rỗng `{}` (422 `document-invalid`): guard chạy trước handler nên vẫn đếm, không cần model hay ngân sách.
  - Hai test "stream song song" dùng model có cổng (`createGatedModel`, thả bằng `open()`), vì `createHangingModel` chỉ kết thúc khi abort.
  - Nest `TestingLogger` chỉ in lỗi, nên test bắt console gọi `app.useLogger(new ConsoleLogger())` rồi mới spy `process.stdout/stderr.write` và `console.*`; mỗi test khẳng định có dòng `ai.chat` để không thành vacuous.
  - Test "tool ném lỗi": `vi.mock("@schemaforge/core/ai")` bọc `applyAiEdit` để ném lỗi nội bộ có tên bảng khi test bật cờ (không có đường khác để làm `execute` ném). Kết quả thực tế: SDK biến lỗi thành tool-error, lượt vẫn kết thúc bình thường (`ai.chat.completed`); test khẳng định không có tên bảng/văn bản tin nhắn trong console và body.
  - Key giả `FAKE_GEMINI_CREDENTIAL` đặt trong `url` và `responseBody` của `APICallError` giả (không có key thật trong config test).
  - Test 413 dựng 200 bảng x 10 cột bằng `makeTable`/`makeColumn` (id cột phải có tiền tố `col_`).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: `vi.mock` ở đầu `ai.e2e-spec.ts` chỉ ảnh hưởng file này; cờ `coreAiControl.failWith` được reset trong `afterEach`.
