# Review bảo mật plan phần 5: AI Assistant

Plan: [2026-10-03-ai-assistant-plan.md](../../plans/2026-10-03-ai-assistant-plan.md). Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md). Log lập plan: [2026-10-03-ai-assistant-plan.md](2026-10-03-ai-assistant-plan.md).

## 2026-10-03 19:05 — ecc:security-reviewer (log do spec-writer ghi) — Xong

- **Đã làm**
  - Đọc đầy đủ Task 1–3, 6, 10–23, 29 của plan; các task khác đọc qua `grep`.
- **File thay đổi**: không (reviewer chỉ đọc). Spec-writer áp các sửa vào `document/plans/2026-10-03-ai-assistant-plan.md` cùng ngày (xem mục 19:05 của log lập plan).
- **Kiểm tra**
  - Đã xác nhận đúng trong plan: thứ tự guard `OriginGuard` → `JwtAuthGuard` → `RateLimitGuard`; trần số bước, token, timeout; `maxRetries` 1; telemetry tắt; ánh xạ lỗi không bao giờ đọc `error.message`; chỉ dẫn hệ thống, ranh giới thẻ và kiểm tra của core trước khi áp; văn bản AI render thành text node; lint chặn import `ai`; đồng ý theo `user.id`; e2e phủ route; test kiểm env.
- **Quyết định**
  - Kết luận: chấp nhận kèm sửa; không có mức CRITICAL. Orchestrator chấp nhận mọi phát hiện; spec-writer đã áp tất cả.
  - H1: khóa đồng thời trả hàm thả dùng một lần gắn token, `chat()` thả khóa trên mọi đường lỗi trước khi trả stream; test `releases the lock when building the prompt throws`, `releases the lock when the budget check rejects`, `a stale release does not free a newer lock` (Task 14, 18; Vấn đề 42).
  - H2: `buildAiMessages` trả chuỗi cuối, `<issues>` tối đa 50 mục cộng dòng số bị lược, khối `<schema>` cộng `<issues>` sau escape vượt `AI_MAX_SCHEMA_PROMPT_LENGTH` thì `AiPromptTooLargeError` → `413` trước khi trừ ngân sách; test `rejects 413 when escaping or issues push the prompt over the cap` (Task 15, 18; Vấn đề 43).
  - M1: trùng P1 của project-reviewer (lỗi escape ở Task 15; Vấn đề 41).
  - M2: bộ lọc chunk dựng lại chunk theo danh sách trường của từng loại; `data-*` không thuộc danh sách của model stream; test `drops providerMetadata from text chunks`, `drops data-* chunks coming from the model stream` (Task 17; Vấn đề 45).
  - M3: e2e rò rỉ assert body SSE thô chỉ có mã `ai-upstream-failed`, thêm ca lỗi ném trong `execute` của tool qua `ApiExceptionFilter` và logger Nest, assert không có logger body request (Task 19).
  - M4: lấy khóa trước, rồi parse tài liệu, đo kích thước, rồi trừ ngân sách; `413` trả khóa và không trừ ngân sách (Task 18; Vấn đề 44, khác thứ tự của spec mục 12, cần sửa spec).
  - M5: `AiChatMessagesRule` giới hạn tin cuối ≤ `AI_MAX_USER_MESSAGE_LENGTH` (4000); test `rejects a last user message over 4000 characters` (Task 14; Vấn đề 58).
  - M6: Task 26 test giá trị có `'`, `\`, `;--`, xuống dòng qua `serializeSeedDataset` cho mọi dialect; Task 29 thêm một chuỗi đối kháng ở AI-06; `AI_MAX_PROPOSAL_BYTES` áp cho cả `data-sample-data`, `data-findings` (Task 18; Vấn đề 59).
  - L1: comment `ponytail:` cho khóa và ngân sách theo process (Task 14; Vấn đề 55). L2: tool call sai không tính trần 30, bị chặn bởi 8 bước × 8192 token (Task 16; Vấn đề 56). L3: lỗi gửi stream sau khi đã gửi header thì kết thúc response, log chỉ mã (Task 18; Vấn đề 51). L4: `send` không kiểm tra đồng ý, dựa vào cổng giao diện theo spec (Task 23, 27b; Vấn đề 57). L5: test CSP `connect-src` có origin API đã có sẵn trong `content-security-policy.test.ts`, Task 21 chạy nó (Vấn đề 53). L6: chạy `.claude/scripts/secret-scan.sh` trên mẫu: gán thẳng chuỗi giả trong nháy vào `GEMINI_API_KEY` bị chặn (`generic-secret-assignment`); dạng hằng `FAKE_GEMINI_CREDENTIAL` thì `CLEAN`; Task 12, 14, 19 dùng dạng này (Vấn đề 54).
- **Ghi chú cho người tiếp theo**
  - Thứ tự kiểm tra mới (Vấn đề 44) và cách đo giới hạn prompt (Vấn đề 43) chặt hơn hoặc khác spec mục 12; orchestrator cần cho sửa spec để spec và plan không mâu thuẫn.
