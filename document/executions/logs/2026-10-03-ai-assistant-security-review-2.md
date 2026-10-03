# Security review lượt 2: Task 14, 15, 17, 21 của phần 5

Liên kết: [Plan](../../plans/2026-10-03-ai-assistant-plan.md), [Spec](../../specs/2026-10-02-ai-assistant-design.md)

> **Log dựng lại.** Báo cáo gốc của lượt review này không được giữ lại. Log này được dựng lại ngày 2026-10-04 từ phần tóm tắt trong [handoff phiên 2](2026-10-03-ai-assistant-session-2-handoff.md) (mục 2.a, 3.3, 3.4). Chỉ ghi những gì handoff có; không có mô tả chi tiết từng finding, mã dòng hay lệnh đã chạy.

## 2026-10-03 — ecc:security-reviewer — Xong

- **Đã làm**: lượt `ecc:security-reviewer` thứ hai, review chỉ đọc Task 14 (`c4f49d8`, nền module AI backend), Task 15 (`8500bab`, system instructions và prompt builder), Task 17 (`3296505`, map lỗi stream AI và lọc chunk stream) và Task 21 (`1821dc3`, stream client chat AI của frontend). Kết luận: **accept-with-fixes**, không có Critical hay High.

- **File thay đổi**: không (review chỉ đọc)

- **Kiểm tra**: không có số liệu trong handoff.

- **Quyết định**: accept-with-fixes. Các finding được chuyển thành yêu cầu bắt buộc cho Task 18 (route `POST /ai/chat`, chưa được dựng), cộng một Low cho frontend và một fix đã làm:
  - F4 `7c1952c` `fix(backend): bound escaped AI history and strip forged outcome markers` (giới hạn `AI_MAX_ESCAPED_HISTORY_LENGTH` = 120 000, `AiHistoryTooLargeError`).
  - Low L4 (tùy chọn): client chưa giới hạn tổng văn bản stream tích lũy.

- **Việc còn lại**:
  - [x] F4: giới hạn lịch sử đã thoát ký tự và gỡ marker kết quả giả mạo — `7c1952c`
  - [ ] (Task 18, PHẢI) Log lỗi: `streamText` và `toUIMessageStream` đều có `onError` tường minh, chỉ log `{ code, errorName, statusCode }` và trả về `toAiStreamErrorCode(error)`. Không bao giờ log đối tượng lỗi, `cause`, `lastError`, vì `APICallError` mang toàn bộ prompt trong `requestBodyValues`. Test bằng một `APICallError` giả có body chứa chuỗi sentinel
  - [ ] (Task 18, PHẢI) Thứ tự khóa stream theo người dùng, rồi rate limit theo người dùng, rồi ngân sách toàn cục; nhả khóa trong `finally` và trong `res.on("close")`, có test cho stream ném lỗi và cho client hủy giữa chừng; khóa null thì ném `ApiException` `too-many-requests` với `retryAfterSeconds: AI_BUSY_RETRY_AFTER_SECONDS`; thêm `AiCapacity` vào providers của module
  - [ ] (Task 18, PHẢI) Dựng prompt và gọi `parseSchemaDocument` TRƯỚC khi gửi header SSE
  - [ ] (Task 18, PHẢI) Map 413: `AiPromptTooLargeError` thành `413 ai-schema-too-large`; `AiHistoryTooLargeError` thành `ApiErrorCode` hiện có `payload-too-large` (413) trước khi mở stream (`validation-failed` không phù hợp vì body của nó cần `fields`)
  - [ ] (Task 18, PHẢI) Abort và timeout: client hủy (`AbortError`) im lặng, không gửi chunk lỗi; timeout không bao giờ vào `onError`, đọc lý do trong `onAbort` và gửi `ai-timeout` qua `toAiStreamErrorCode` (phát hiện của Task 17: `DOMException` tên `TimeoutError`)
  - [ ] (Task 18, PHẢI) Route AI không bao giờ `@Public`; thêm `{ method: "POST", path: "/ai/chat" }` vào `PRIVATE_ROUTES` trong `backend/test/security.e2e-spec.ts`
  - [ ] (Sau Task 14–18 vào master) Chạy `ecc:security-reviewer` (chỉ review) một lần nữa trên các task này
  - [ ] (Low L4, tùy chọn) Giới hạn phía client cho tổng văn bản stream tích lũy; làm ở Task 23 hoặc 27b

- **Ghi chú cho người tiếp theo**:
  - Yêu cầu cho Task 18 còn có hai ghi chú từ Task 16 (không phải finding của review này): `buildAiTools` trả `AiToolSet` với `execute` đồng bộ; nếu type `state.findings` là `AiFindingsData` thì phải copy readonly `targets` vào mảng có thể thay đổi.
  - Handoff không ghi mức độ từng finding ngoài "không Critical, không High" và Low L4; đừng suy diễn thêm.
