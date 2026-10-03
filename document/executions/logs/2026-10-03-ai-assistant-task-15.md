# Task 15: Chỉ dẫn hệ thống và dựng prompt

- Plan: [2026-10-03-ai-assistant-plan.md](../../plans/2026-10-03-ai-assistant-plan.md), mục "Task 15: Chỉ dẫn hệ thống và dựng prompt"
- Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md), AI-R28, AI-R29, AI-R30 (đo độ dài), AI-R39, AI-R59, S3

## 2026-10-03 20:40 — ai-engineer — Xong

- **Đã làm**
  - `ai.instructions.ts`: hằng `AI_INSTRUCTIONS` theo văn bản của plan, giữ đủ tám ý của AI-R28, cộng ba chỗ bổ sung (xem Quyết định).
  - `ai-prompt.ts`: `describeSchemaJson`, `stripOutcomeMarkers`, `AI_MAX_PROMPT_ISSUES = 50`, `AiPromptTooLargeError`, `buildAiMessages` (tin `user` cũ bọc `<user_message>`, tin `assistant` thêm dòng kết quả từ `proposalOutcome`, tin cuối mang `<schema>`, `<issues>`, `<ui_locale>`, `<user_message>`; vai trò giữ nguyên, không gộp).
  - Escape: `<` thành `<` (literal `"\\u003c"`, đã kiểm bằng `grep -n 'u003c'`) trong `<schema>`, `<issues>`; `<` thành `&lt;` trong văn bản người dùng và assistant. Dấu kết quả giả bị xóa khỏi mọi tin trước khi escape.
  - Giới hạn (Vấn đề 43): đo khối `<schema>` cộng khối `<issues>` (kể cả thẻ) sau escape; lớn hơn `AI_MAX_SCHEMA_PROMPT_LENGTH` thì ném `AiPromptTooLargeError`.
  - TDD: viết `ai-prompt.spec.ts` trước; đỏ vì `Cannot find module './ai-prompt.js'`; rồi cài đặt tới xanh.
- **File thay đổi**
  - `backend/src/modules/ai/ai.instructions.ts` (tạo)
  - `backend/src/modules/ai/ai-prompt.ts` (tạo)
  - `backend/src/modules/ai/ai-prompt.spec.ts` (tạo)
- **Kiểm tra**
  - Đỏ: `.claude/scripts/test-file.sh backend src/modules/ai/ai-prompt.spec.ts` → `Error: Cannot find module './ai-prompt.js'`.
  - Xanh: cùng lệnh → `RESULT: PASS`.
  - `.claude/scripts/verify.sh backend --build --format` → typecheck, lint, test (456 test pass), build, prettier đều PASS; `RESULT: PASS`. Coverage dòng toàn backend 97.65%, `ai-prompt.ts` 97.22% (dòng 121, nhánh không có tin nhắn nào, không chạy được vì DTO bắt ít nhất một tin).
  - `.claude/scripts/secret-scan.sh --files <ba file>` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Chỉ dẫn thêm `no "nullable" means NOT NULL` vào dòng định dạng `<schema>`: view của Task 6 chỉ ghi `nullable: true` khi cột cho phép NULL (orchestrator yêu cầu nói rõ).
  - Chỉ dẫn thêm một dòng giải thích các mã issue mà tool có thể sinh ra nhưng văn bản plan chưa nêu (`column-type-invalid-scale`, `column-custom-type-invalid`, `column-default-invalid`, `column-default-incompatible`, `table-columns-empty`, `enum-values-empty`, `table-multiple-auto-increment`) và hai mã `findings-limit`, `sample-rows-limit` của `AI_EDIT_ERROR_CODES`: test `instructions mention every error code a tool can return` đòi mọi mã đều được nêu hoặc khớp một wildcard (ví dụ `*-duplicate`).
  - Số dòng mẫu tối đa trong chỉ dẫn lấy từ `AI_MAX_SAMPLE_ROWS_PER_TABLE`, `AI_MAX_SAMPLE_ROWS_PER_TURN` của `@schemaforge/core/ai` thay vì viết cứng 20 và 200: một nguồn sự thật.
  - `stripOutcomeMarkers` chuẩn hóa cả khoảng trắng bên trong dòng (gộp nhiều khoảng trắng thành một), không chỉ đầu cuối: chặn biến thể `[The  user  accepted …]`. Chỉ xóa dòng mà cả dòng là dấu; dòng chỉ nhắc tới dấu giữa câu được giữ.
  - `AiPromptTooLargeError` có message cố định, không chứa dữ liệu schema hay tin nhắn.
  - Mã seed: `SEED_ISSUE_CODES` của core không được export công khai, nên test giữ danh sách sáu mã với `satisfies readonly SeedIssueCode[]` cộng kiểm kiểu `Exclude<…>` là `never` để danh sách luôn đủ.
  - Ba mã `ErrorCode` của core mà tool trả về (`relation-not-found`, `primary-key-missing`, `enum-in-use`) cũng được kiểm; các mã cấu trúc khác cần id hay vị trí do backend tự điền nên không tới model.
  - Dòng `<n> more issues omitted.` giữ đúng chữ của plan, kể cả khi `n = 1`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 18 bắt `AiPromptTooLargeError` (bằng `instanceof`) để trả `413 ai-schema-too-large`, và truyền `AI_INSTRUCTIONS` vào `instructions` của `streamText`.
  - Tin `assistant` mà sau khi xóa dấu giả còn rỗng và không có `proposalOutcome` sẽ thành `content: ""`; DTO bắt `text` ≥ 1 ký tự nên chỉ xảy ra khi client cố ý gửi tin chỉ có dấu giả. Task 29 (kiểm tay với Gemini thật) nên xác nhận Gemini không từ chối tin rỗng; nếu từ chối thì bỏ tin đó trong `buildAiMessages`.
  - Spec AI-R30 và đoạn chỉ dẫn mẫu trong plan Task 15 chưa ghi trường `nullable` dạng gọn và các dòng mã lỗi bổ sung; spec-writer cập nhật riêng.

## 2026-10-03 22:43 — ai-engineer — Xong
- **Đã làm**
  - Sửa hai lỗi Medium M1, M2 của bản rà soát bảo mật `document/executions/logs/2026-10-03-ai-assistant-security-review-2.md` trong `ai-prompt.ts`.
  - M1: `buildAiMessages` escape văn bản mọi tin (lịch sử cộng tin user cuối, không tính khối `<schema>`/`<issues>`) một lần, cộng độ dài sau escape; vượt `AI_MAX_ESCAPED_HISTORY_LENGTH = 2 * AI_MAX_HISTORY_TEXT_LENGTH` (120.000) thì ném lỗi mới `AiHistoryTooLargeError` (message cố định, không chứa dữ liệu người dùng). Kiểm tra khối schema giữ nguyên.
  - M2: `stripOutcomeMarkers` tách dòng theo `/\r\n|[\r\n  \u0085\v\f]/`; `normalizeLine` áp `normalize("NFKC")` và xóa ký tự `\p{Cf}`; dấu kết quả bị xóa cả khi nằm giữa dòng (regex `giu`, giữa các từ là `\s+`), lặp tới khi ổn định để chặn dấu lồng nhau (`[The user acc[...]epted ...]`). Dòng không chứa dấu giữ nguyên như client viết; dòng chứa dấu giữ phần còn lại đã chuẩn hóa, hoặc bị bỏ nếu chỉ còn khoảng trắng.
  - TDD: thêm test trước. Đỏ: `.claude/scripts/test-file.sh backend src/modules/ai/ai-prompt.spec.ts` → `Tests  15 failed | 74 passed (89)` (thiếu export `AiHistoryTooLargeError`, `AI_MAX_ESCAPED_HISTORY_LENGTH`; dấu giữa dòng, sau U+2028/U+2029/U+0085/VT/FF, có U+200B/U+00AD/U+FEFF, dạng fullwidth, lồng nhau chưa bị xóa). Xanh: cùng lệnh → `RESULT: PASS`.
- **File thay đổi**
  - `backend/src/modules/ai/ai-prompt.ts`
  - `backend/src/modules/ai/ai-prompt.spec.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh backend --build --format` → typecheck, lint, test (474 test pass), build, prettier PASS; `RESULT: PASS`. Coverage dòng toàn backend 97.73%, `ai-prompt.ts` 98.24% (dòng 194: nhánh không có tin nhắn nào, DTO không cho xảy ra).
  - `.claude/scripts/secret-scan.sh --files` hai file → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Test cũ `keeps a line that only mentions a marker` được thay bằng test xóa dấu giữa dòng: một câu chỉ nhắc tới dấu (ví dụ `I wrote [The user accepted this proposal.] here`) giờ mất phần chữ của dấu (thành `I wrote  here`). Chấp nhận theo quyết định của orchestrator; dấu chỉ backend được viết.
  - Chỉ dòng có dấu mới bị chuẩn hóa NFKC và bỏ `\p{Cf}`; dòng khác giữ nguyên để không đổi văn bản người dùng (ví dụ ZWJ trong emoji, tiếng Việt). Các ký tự xuống dòng U+2028/U+2029/U+0085/VT/FF trong mọi tin được đổi thành `\n` khi nối lại.
  - Regex tuyến tính: chỉ có `\s+` giữa các chữ cố định, không lượng từ lồng nhau.
  - Giới hạn tính trên văn bản sau khi xóa dấu và escape, tức đúng thứ gửi tới Gemini (trừ thẻ `<user_message>` và dòng kết quả do backend thêm, độ dài cố định nhỏ).
  - Không thêm mã lỗi API. Đề xuất Task 18 ánh xạ `AiHistoryTooLargeError` sang `payload-too-large` (413, mã đơn giản không cần body thêm) trước khi mở stream; `validation-failed` không hợp vì body bắt buộc có `fields`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 18 phải bắt `AiHistoryTooLargeError` (bằng `instanceof`) cùng chỗ với `AiPromptTooLargeError`, trước khi mở stream.
  - Dấu giả chèn dấu kết hợp (`\p{Mn}`, ví dụ `thís`) không bị coi là dấu: NFKC ghép thành `thís`, khác dấu thật; không xóa `\p{Mn}` vì sẽ hỏng tiếng Việt.
