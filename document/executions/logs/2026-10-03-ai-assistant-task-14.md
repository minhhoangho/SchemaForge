# Task 14: Nền của `AiModule`

- Plan: [2026-10-03-ai-assistant-plan.md](../../plans/2026-10-03-ai-assistant-plan.md), mục "Task 14: Nền của `AiModule`"
- Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md), AI-R21, AI-R27, AI-R55, AI-R56, mục 6 "Model và tham số"

## 2026-10-03 20:15 — ai-engineer — Xong

- **Đã làm**
  - `ai.constants.ts`: chín hằng gọi model đúng chữ ký của plan (`AI_MAX_STEPS`, `AI_MAX_OUTPUT_TOKENS`, `AI_TIMEOUT`, `AI_BUSY_RETRY_AFTER_SECONDS`, `AI_MAX_PROPOSAL_BYTES`, `AI_MAX_RETRIES`, `AI_MAX_TOOL_CALLS_PER_TURN`, `AI_MAX_TOOL_ERRORS_PER_CALL`, `AI_GLOBAL_BUDGET_WINDOW_SECONDS`).
  - `ai-model.provider.ts`: token `AI_LANGUAGE_MODEL`, `AI_GENERATE_ID`, `AI_GLOBAL_REQUESTS_PER_HOUR`; `createAiLanguageModel` (key chỉ đi thẳng vào `createGoogle({ apiKey })`); `AI_PROVIDERS` đọc `ConfigService<Env, true>`; `AI_GENERATE_ID` là `() => randomUUID()`.
  - `ai-capacity.ts`: `AiCapacity` với `tryAcquireStream(userId)` trả hàm thả dùng một lần gắn token `Symbol()` (Vấn đề 42), và `tryConsumeGlobalBudget()` dùng `RateLimiterMemory` (`keyPrefix: "ai-global"`, một khóa cố định), hết điểm thì `warn` `ai.budget.exhausted` không kèm dữ liệu người dùng; comment `ponytail:` của Vấn đề 55.
  - `dto/ai-chat-request.dto.ts`: `AiChatRequestDto`, `AiChatMessageDto`, `AiChatMessagesRule` (constraint `aiChatMessages`) theo AI-R21 và Vấn đề 58.
  - `backend/vitest.config.ts`: thêm `"src/modules/ai/ai-*.ts"` vào `coverage.include`.
  - TDD: viết bốn file spec trước. RED: `pnpm --filter @schemaforge/backend exec vitest run src/modules/ai` → `Test Files  4 failed (4)` (`Cannot find module './ai-chat-request.dto.js'` và tương tự). GREEN: cùng lệnh → `Test Files  4 passed (4)`, `Tests  34 passed (34)`.
- **File thay đổi**
  - `backend/src/modules/ai/ai.constants.ts`, `ai.constants.spec.ts`
  - `backend/src/modules/ai/ai-model.provider.ts`, `ai-model.provider.spec.ts`
  - `backend/src/modules/ai/ai-capacity.ts`, `ai-capacity.spec.ts`
  - `backend/src/modules/ai/dto/ai-chat-request.dto.ts`, `ai-chat-request.dto.spec.ts`
  - `backend/vitest.config.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh backend --build` → typecheck, lint, test (341 test pass, coverage dòng 97.57%), build đều PASS; `RESULT: PASS`. `ai-capacity.ts` 94.73% dòng (dòng chưa phủ là nhánh ném lại lỗi không phải `RateLimiterRes`, cùng khuôn `rate-limit.store.ts`).
  - `pnpm exec prettier --check backend/src/modules/ai backend/vitest.config.ts` → `All files formatted correctly`.
  - `.claude/scripts/secret-scan.sh --all-changed` → `SECRET-SCAN: CLEAN`.
  - `git status --porcelain` → chỉ `backend/vitest.config.ts` và `backend/src/modules/ai/` (cộng file log này).
- **Quyết định**
  - `createAiLanguageModel` trả `null` cả khi thiếu `model` (không chỉ thiếu key): env đã bắt buộc `GEMINI_MODEL` khi có key, nhánh này chỉ để kiểu an toàn mà không cần `!` hay `as`.
  - Giữ kiểu trả về `LanguageModel | null` đúng plan, dù `LanguageModel` của `ai` gồm cả chuỗi id gateway; factory không bao giờ trả chuỗi.
  - `AI_PROVIDERS` không gồm `AiCapacity`: plan chỉ liệt kê ba token; Task 18 thêm `AiCapacity` vào `providers` của `AiModule`.
  - `AiChatMessagesRule` cho qua khi danh sách sai dạng (không phải mảng, rỗng, phần tử không phải `AiChatMessageDto`) vì `@IsArray`, `@ArrayMinSize`, `@ValidateNested` đã báo lỗi; tránh đọc trường của dữ liệu chưa kiểm.
  - Độ dài tính bằng `text.length` (đơn vị UTF-16) cho luật 4000 và 60000 ký tự; `@Length` của class-validator đếm cặp surrogate là một ký tự nên luật của rule chặt hơn một chút, chấp nhận được.
  - Tin nhắn lỗi của rule (`defaultMessage`) chỉ cho dev; client chỉ nhận `{ path: "messages", constraint: "aiChatMessages" }` qua `validation-failed`.
  - Ngân sách toàn cục: `503 ai-unavailable` do Task 18 ném khi `tryConsumeGlobalBudget()` trả `false`; `AiCapacity` không trả về hay log giá trị ngân sách, nên response không lộ con số.
  - Test thêm ngoài danh sách tối thiểu: `returns null without a model id`, bốn test resolve `AI_PROVIDERS` qua `Test.createTestingModule` với `ConfigService` giả (phủ factory), `allows requests up to the configured budget`, `keeps a separate budget per instance`, và vài test DTO (document không phải object, danh sách rỗng, text rỗng, đúng 4000 ký tự, role lạ, `proposalOutcome` lạ, trường lạ trên tin nhắn).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 18: lấy khóa bằng `capacity.tryAcquireStream(userId)`; `null` thì ném `ApiException` `too-many-requests` với `{ retryAfterSeconds: AI_BUSY_RETRY_AFTER_SECONDS }`. Hàm thả gọi được nhiều lần an toàn, gọi trong `catch` và trong `finally` của `execute`.
  - Test thay model bằng `{ provide: AI_LANGUAGE_MODEL, useValue: new MockLanguageModelV4(...) }`; e2e ghi đè `AI_GLOBAL_REQUESTS_PER_HOUR` bằng `2` (Vấn đề 5).
  - Hook `rtk` của máy chặn lệnh `git status` trong worktree; dùng `/usr/bin/git status --porcelain`.
