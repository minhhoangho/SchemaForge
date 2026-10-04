# Backend giả trả SSE và journey AI (Task 28)

Plan: `document/plans/2026-10-03-ai-assistant-plan.md` (Task 28). Spec: `document/specs/2026-10-02-ai-assistant-design.md` (AI-R22, mục 16).

## 2026-10-04 — frontend-engineer — Xong
- **Đã làm**: `buildAiChatSseResponse` (SSE viết tay, đúng thứ tự AI-R22, header `x-vercel-ai-ui-message-stream: v1`); route `POST /ai/chat` + hàng đợi `queueAiTurn` trong backend giả (hàng đợi rỗng trả lượt `internal-error`; chưa đăng nhập `401`); ba journey AI trên toàn editor (mô tả hệ thống → xem trước → chấp nhận → undo/redo; áp dụng gợi ý; gửi tin khi đang xem trước).
- **File thay đổi**: `frontend/src/testing/fake-ai-chat.ts`, `fake-ai-chat.test.ts`, `fake-api-backend.ts`, `fake-api-backend.test.ts`, `frontend/src/features/editor/journeys/ai-assistant.test.tsx`.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` → `RESULT: PASS` (typecheck, lint, 4505 test, format); `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**:
  - Không dùng lại `ai-chat-stream.ts`: nó chỉ có một khối văn bản, không có header, `data-findings`, chunk lỗi; viết builder riêng, giữ nguyên helper cũ.
  - `FakeAiTurn.proposal.isStoppedEarly` thay cho `stoppedEarly`: lint `naming-convention` bắt buộc tiền tố `is` cho boolean; trên dây vẫn là `stoppedEarly`.
  - Operation dựng bằng `makeColumn`/`makeRelation`/`makeEnum` và `createCounterIdGenerator` của core/testing, thêm `setPrimaryKey` vì thiếu khóa chính làm đề xuất bị coi là "stale".
  - `localStorage.clear()` trong `afterEach` vì sự đồng ý lưu theo tài khoản và `seedUser` cho cùng id mỗi test.
  - Chờ chunk panel lazy tới 10 giây ở lần tìm đầu tiên vì máy tải nặng.
  - Test viết cùng lúc với code (không có bước RED riêng); các hành vi đều được kiểm bằng assert cụ thể.
- **Ghi chú cho người tiếp theo**: không có lỗi sản phẩm nào lộ ra từ journey.
