# Security review lượt 3: Task 14–18 (`POST /ai/chat`) của phần 5

Liên kết: [Plan](../../plans/2026-10-03-ai-assistant-plan.md), [Spec](../../specs/2026-10-02-ai-assistant-design.md), [lượt 2](2026-10-03-ai-assistant-security-review-2.md)

## 2026-10-04 — ecc:security-reviewer — Xong

- **Đã làm**: review tĩnh lượt ba cho Task 14–18, không chạy test. Đã đọc `ai-chat.service`, `ai-chat-turn`, `ai-turn-parts`, `ai.controller`, `ai-stream-response`, `ai.module`, cùng `ai-capacity`, `ai-model.provider`, `ai-prompt`, `ai-stream-filter`, `ai-stream-errors`, dto, rate-limit và `api-exception.filter`. Verdict: accept-with-fixes, không có Critical hay High; 2 Medium, 3 Low. Đã xác nhận:
  - Route private: `OriginGuard`, `JwtAuthGuard`, `RateLimit` "ai" (người dùng 10/phút 100/giờ, IP 20/phút 200/giờ).
  - Không log `error`, `cause`, `requestBodyValues`, prompt, `messages`, schema hay key; `AI_SDK_LOG_WARNINGS=false`.
  - Stream filter chỉ cho qua `start`, `text-*`, `error` và ép `errorText` không phải mã về `internal-error`; lỗi ánh xạ chỉ theo lớp và status.
  - Kiểm tra cả lượt (`buildAiTurnParts`) trước mọi data part; kiểm tra rẻ trước ngân sách toàn cục; 413 trước khi gọi model.
  - Body tối đa 2 MB, DTO có giới hạn; abort truyền vào `streamText`, timeout 90 giây tổng và 45 giây mỗi bước.
- **File thay đổi**: không (review tĩnh).
- **Kiểm tra**: không chạy test.
- **Quyết định**: chấp nhận việc trả khóa khi abort (mỗi lần kết nối lại vẫn tốn rate limit và một điểm ngân sách; abort hủy fetch của Gemini). M2 giữ nguyên giới hạn theo người dùng như rủi ro còn lại của AI-R55.
  - Phát hiện:
    - **M1 (Medium)**: client ngắt kết nối trước khi handler gắn listener `close` thì không bao giờ bị phát hiện, nên vẫn gọi Gemini đầy đủ, giữ khóa và tiêu ngân sách. Sửa: abort ngay trong `linkAbort` nếu `response.destroyed`; kiểm tra `abortSignal.aborted` trước khi lấy khóa và tiêu ngân sách; spec cho trường hợp response đã đóng.
    - **M2 (Medium)**: ngân sách toàn cục (mặc định 1000/giờ) bị cạn bởi khoảng 10 tài khoản, mỗi tài khoản 100/giờ; `503` không có `Retry-After`; `ai.budget.exhausted` log mỗi request. Sửa: `Retry-After` từ `msBeforeNext`, log một lần mỗi cửa sổ; đã cân nhắc trần theo người dùng.
    - **L1 (Low)**: khóa bị giữ khi client còn kết nối nhưng không đọc; giới hạn bởi 90 giây, không sửa.
    - **L2 (Low)**: văn bản được chuyển tiếp trước khi kiểm tra cả lượt xong; frontend không được coi văn bản đứng trước chunk lỗi là thành công.
    - **L3 (Low)**: model có thể lặp lại chỉ dẫn hệ thống (không có bí mật trong đó), không sửa.
  - Orchestrator: M1 và phần Retry-After/log một lần của M2 giao agent Task 18 sửa trước khi merge; L2 giao Task 23 (lượt có text rồi chunk lỗi phải là lượt thất bại, có test); L1, L3 không sửa.
- **Việc còn lại**:
  - [ ] M1: sửa `linkAbort` và kiểm tra `abortSignal.aborted` trước khóa và ngân sách (Task 18).
  - [ ] M2: thêm `Retry-After` từ `msBeforeNext` cho `503 ai-unavailable` do hết ngân sách; log `ai.budget.exhausted` một lần mỗi cửa sổ (Task 18).
  - [ ] L2: frontend coi lượt có text rồi chunk lỗi là lượt thất bại, có test (Task 23).
  - [ ] L1 (tùy chọn): idle timeout cho stream mà client không đọc.
- **Ghi chú cho người tiếp theo**: khóa và ngân sách chỉ có trong từng process (ghi chú `ponytail` trong `ai-capacity.ts`); chạy nhiều instance cần store dùng chung (spec mục 12, Rủi ro 11).
