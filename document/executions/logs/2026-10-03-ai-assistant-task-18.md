# Task 18: `AiChatService`, `AiController`, `AiModule`

Plan: [Task 18](../../plans/2026-10-03-ai-assistant-plan.md#task-18-aichatservice-aicontroller-aimodule). Spec: [mục 5, 6, 11, 12, 13; AI-R17, R19, R21–R24, R31, R50, R55, R56, R58, R62](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-04 00:50 — ai-engineer — Xong

- **Đã làm**
  - `POST /ai/chat` hoàn chỉnh. `AiChatService.chat` kiểm tra theo thứ tự của Vấn đề 44: model `null` → `503 ai-unavailable`; khóa stream (`tryAcquireStream`) → `429 too-many-requests` kèm `retryAfterSeconds: AI_BUSY_RETRY_AFTER_SECONDS`; rồi trong `try/catch` (catch gọi hàm thả rồi ném lại): `parseSchemaDocument` → `422 document-invalid` (cắt bằng `MAX_DOCUMENT_ERRORS` của `schemas.service.ts`); `buildAiMessages` → `AiPromptTooLargeError` thành `413 ai-schema-too-large`, `AiHistoryTooLargeError` thành `413 payload-too-large`; `tryConsumeGlobalBudget()` sai → `503 ai-unavailable`; sau cùng `createUIMessageStream({ execute, onError: toAiStreamErrorCode })`. Mọi kiểm tra và việc dựng prompt chạy trước khi gửi header SSE.
  - Khóa được thả ở ba chỗ, cùng một hàm thả dùng một lần: `catch` trước stream, `abortSignal` `abort` (tức `res.on("close")` khi `!writableFinished`, AI-R50), và `finally` của `execute`.
  - `runAiTurn` (`ai-chat-turn.ts`): `streamText` với `instructions: AI_INSTRUCTIONS`, `messages` dựng sẵn, `tools: buildAiTools(state, generateId)`, `stopWhen: isStepCount(AI_MAX_STEPS)`, `maxOutputTokens`, `maxRetries`, `timeout: AI_TIMEOUT`, `abortSignal`, `telemetry: { isEnabled: false }`, `onError` (chỉ log `{ event: "ai.chat.stream-error", code, errorName, statusCode }`), `onAbort` (giữ lý do và số bước). `toUIMessageStream({ sendReasoning: false, sendSources: false, sendStart: true, sendFinish: false, onError: toAiStreamErrorCode })` qua `createAiChunkFilter()`, đọc bằng `for await` và `writer.write` từng chunk (Vấn đề 6); gặp chunk `error` thì dừng, không ghi gì thêm (Vấn đề 7).
  - Cuối lượt: client ngắt → không ghi gì, kết quả `aborted`; timeout (không qua `onError`, phát hiện qua `onAbort` khi signal của request chưa bị hủy) → ghi chunk `error` với `toAiStreamErrorCode(reason)` = `ai-timeout`; thành công → `buildAiTurnParts` (`ai-turn-parts.ts`) kiểm cả lượt (`applyOperation` của batch, `findIntroducedIssues`, tài liệu sau khi áp ≤ `MAX_REQUEST_BODY_BYTES`, mỗi data part ≤ `AI_MAX_PROPOSAL_BYTES`), ghi `data-proposal` hoặc `data-sample-data`, rồi `data-findings`, rồi `finish`. Thất bại → log `error` `ai.chat.turn-invalid` kèm `reason`, ném `AiTurnInvalidError` để `createUIMessageStream` ghi chunk `ai-output-invalid` làm chunk cuối.
  - Một dòng log mỗi lượt (AI-R31): `ai.chat.completed` (`log`) hoặc `ai.chat.failed` (`warn`), kèm `userId`, `durationMs` (từ `Clock`), `stepCount`, `toolCallCount`, `successfulToolCallCount` (`operations.length`), `finishReason`, `inputTokens`, `outputTokens`, `outcome`, `errorCode`.
  - `AiStreamResponse`: `linkAbort` (abort khi `close` mà `!writableFinished`), `send` (`pipeUIMessageStreamToResponse`; lỗi sau header thì `end()` và log `warn` `ai.chat.response-failed` chỉ kèm mã; lỗi trước header thì ném lại cho `ApiExceptionFilter`).
  - `AiController` (`@Post("chat") @HttpCode(200) @RateLimit("ai")`, không `@Public()`), `AiModule` (`AI_PROVIDERS`, `AiCapacity`, `AiChatService`, `AiStreamResponse`; `onModuleInit` đặt `globalThis.AI_SDK_LOG_WARNINGS = false`), `AppModule` import `AiModule`, `PRIVATE_ROUTES` thêm `POST /ai/chat`.
  - TDD. ĐỎ: `.claude/scripts/test-file.sh backend src/modules/ai/ai-chat.service.spec.ts` → `Error: Cannot find module './ai-chat.service.js'`; `ai-stream-response.spec.ts` → `Error: Cannot find module './ai-stream-response.js'`. Lần chạy đầu sau khi cài đặt: `Tests 7 failed | 21 passed (28)`, do test sai (kiểu operation là `renameSchema`, không phải `rename-schema`; model treo của test không xử lý signal đã hủy sẵn; logger bị gọi thêm một lần bởi `Test.createTestingModule`), sửa test, không sửa code. XANH: cả bốn file spec `RESULT: PASS`.
- **File thay đổi**
  - Tạo: `backend/src/modules/ai/ai-chat.service.ts` (214 dòng), `ai-chat-turn.ts` (178), `ai-turn-parts.ts` (99), `ai-stream-response.ts` (50), `ai.controller.ts` (36), `ai.module.ts` (18), `ai-chat.service.spec.ts`, `ai-chat.service.limits.spec.ts`, `ai-stream-response.spec.ts`, `ai-turn-parts.spec.ts`, `ai.module.spec.ts`.
  - Sửa: `backend/src/app.module.ts` (import `AiModule`), `backend/test/security.e2e-spec.ts` (chỉ thêm `{ method: "POST", path: "/ai/chat" }` vào `PRIVATE_ROUTES`).
  - File mới ngoài danh sách sở hữu, tách để mỗi file nguồn dưới 300 dòng: `ai-chat-turn.ts`, `ai-turn-parts.ts` (và spec của nó), `ai-chat.service.limits.spec.ts`, `ai.module.spec.ts`.
- **Kiểm tra**
  - `.claude/scripts/worktree-setup.sh <worktree>` → `RESULT: PASS`. Prisma client sinh bằng `node backend/node_modules/prisma/build/index.js generate --schema backend/prisma/schema.prisma` (Node 24), vì service import `schemas.service.ts`, và file này kéo theo `src/generated/prisma`.
  - `.claude/scripts/verify.sh backend --build --format` → typecheck, lint, test (`Tests 552 passed (552)`), build, prettier đều PASS; `RESULT: PASS`. Coverage dòng toàn backend 98.03%. `auth-cookies.spec.ts` không chập chờn trong các lần chạy này.
  - `.claude/scripts/secret-scan.sh --all-changed` → `SECRET-SCAN: CLEAN`.
  - `pnpm --filter @schemaforge/backend exec vitest run --config vitest.e2e.config.ts test/security.e2e-spec.ts`: **chưa chạy**. Worktree không có `backend/.env.test` (gitignore), và agent không được tạo hay đọc file env thật. Orchestrator chạy lệnh này ở checkout chính sau khi merge.
- **Quyết định**
  - ⚠ Khóa stream cũng được thả ngay khi `abortSignal` bị hủy (client đóng response), không chỉ trong `finally`, theo yêu cầu MUST "thả khóa trong `finally` và khi `res.on("close")`". Hàm thả gắn với token, nên `finally` muộn của lượt cũ không mở khóa của lượt mới. Hệ quả: người dùng bấm Dừng thì có thể gửi ngay lượt mới trong lúc lượt cũ còn đang dừng lời gọi model.
  - ⚠ Timeout (`totalMs`, `stepMs`) được phát hiện trong `onAbort` khi signal của request chưa bị hủy, rồi ghi chunk `error` `ai-timeout`. Hai trường hợp được phân biệt bằng `abortSignal.aborted` của request, không dựa vào tên lỗi: client ngắt thì không ghi gì.
  - Lượt bị hủy log `ai.chat.completed` (`log`) với `outcome: "aborted"`: giữ đúng hai tên sự kiện của AI-R31; trường `outcome` phân biệt.
  - `onError` của `toUIMessageStream` chỉ ánh xạ mã, không log: AI SDK cũng gọi nó cho lỗi input tool (luồng bình thường, lỗi được trả lại cho model). Log lỗi stream nằm ở `onError` của `streamText`, chỉ có `{ event, code, errorName, statusCode }`, không có `userId`, để đúng danh sách trường của yêu cầu MUST. Dòng log cuối lượt mang `userId` và `errorCode` để đối chiếu.
  - Kiểm tra cả lượt trả `Result` với `reason` (`operation-rejected`, `issues-introduced`, `document-too-large`, `part-too-large`), được log để vận hành; mã gửi cho client chỉ là `ai-output-invalid` (đi qua `AiTurnInvalidError` và `onError` của `createUIMessageStream`), không log `error.message`.
  - `stoppedEarly` tính bằng `steps.length >= AI_MAX_STEPS` và bước cuối có `toolCalls`, không dựa vào `finishReason`, vì Gemini báo `STOP` cả khi có tool call.
  - Token lấy từ `result.usage` (tổng mọi bước), không dùng `totalUsage` vì `totalUsage` đã deprecated trong `ai` 7.0.126 (luật `no-deprecated`). Khi lỗi hay bị hủy, `inputTokens`, `outputTokens` là `undefined`; số bước khi hủy lấy từ `onAbort`.
  - `chat` nhận `AiChatRequest` của `api-contract` (DTO `implements` nó), để service không phụ thuộc lớp DTO của HTTP; controller vẫn truyền `AiChatRequestDto`.
  - `AiStreamResponse` nhận `ServerResponse` của `node:http` (Express `Response` kế thừa nó): đúng kiểu `pipeUIMessageStreamToResponse` cần, test dùng response thật của Node mà không cần ép kiểu.
  - Test giới hạn kích thước nằm ở file riêng `ai-chat.service.limits.spec.ts`, hạ `AI_MAX_PROPOSAL_BYTES` và `MAX_REQUEST_BODY_BYTES` bằng `vi.mock` có getter: input tool có `.max()` không bao giờ chạm 1 MiB hay 2 MiB thật, nhất là `data-findings`.
  - ⚠ `ai-chat.service.spec.ts` dài khoảng 740 dòng, vượt mức 300: đây là file test, giống tiền lệ `ai-tools.spec.ts` (616 dòng) và các spec service khác. Tách thêm thì phải chép hàm `setup` tới bản thứ ba, mà không có chỗ đặt helper dùng chung: helper trong `src/` sẽ bị build vào `dist/` và không import được `backend/test/mock-ai-model.ts` (`rootDir: src`). Mọi file nguồn đều dưới 300 dòng.
- **Việc còn lại**: không trong phạm vi task. Orchestrator chạy e2e `security` ở checkout chính (cần `local_postgres` và `backend/.env.test`).
- **Ghi chú cho người tiếp theo**
  - Task 19 (e2e): ghi đè `AI_LANGUAGE_MODEL` bằng model của `backend/test/mock-ai-model.ts`. Model treo cho test khóa đồng thời phải xử lý cả trường hợp signal **đã** bị hủy lúc gọi `doStream` (xem `createHangingModel` trong `ai-chat.service.spec.ts`), nếu không stream sẽ treo.
  - `createUIMessageStream` chạy `execute` ngay khi tạo stream, kể cả khi chưa ai đọc, nên `finally` (thả khóa, log) luôn chạy.
  - Worktree mới cần sinh Prisma client trước khi chạy test có import `schemas.service.ts`; hook `rtk` chặn `pnpm generate` khi có biến `PATH`, nên gọi thẳng `node backend/node_modules/prisma/build/index.js generate --schema backend/prisma/schema.prisma` bằng Node 24.
  - Spec mục 12 và AI-R31 nên ghi lại: thả khóa khi client ngắt, `aborted` log dưới `ai.chat.completed`, `AiHistoryTooLargeError` → `413 payload-too-large`.

## 2026-10-04 01:10 — ai-engineer — Xong

- **Đã làm** (sửa theo kết quả review: project-reviewer chấp nhận kèm nit, ecc:security-reviewer chấp nhận kèm sửa 2 lỗi Medium)
  - M1, client ngắt trước khi handler gắn listener:
    - `AiStreamResponse.linkAbort` hủy ngay khi `response.destroyed && !response.writableFinished`, cùng điều kiện với `writeToServerResponse` của `ai`.
    - `AiChatService.chat` kiểm `abortSignal.aborted` ngay sau kiểm tra model: request đã hủy nhận một stream rỗng đã đóng, không lấy khóa, không parse, không trừ ngân sách, không gọi model.
  - M2, ngân sách toàn cục:
    - `AiCapacity.tryConsumeGlobalBudget()` trả `AiBudgetResult` (`{ isAllowed: true }` hoặc `{ isAllowed: false, retryAfterSeconds }`), với `retryAfterSeconds = Math.ceil(msBeforeNext / 1000)`. Service truyền giá trị này vào `ApiException` của `503 ai-unavailable`, nên filter đặt `Retry-After`.
    - `ai.budget.exhausted` chỉ log ở lần từ chối đầu tiên của mỗi cửa sổ: `consumedPoints === budgetPerHour + 1`, vì `RateLimiterMemory` vẫn cộng điểm cho lần bị từ chối. Sửa `ai-capacity.ts` của Task 14 đã được orchestrator cho phép.
  - Nit:
    - `ai-chat.service.spec.ts` (739 dòng) tách thành ba file theo khối `describe`: `ai-chat.service.spec.ts` (luồng lượt, 226 dòng), `ai-chat.service.abort.spec.ts` (hủy và log, 138 dòng), `ai-chat.service.checks.spec.ts` (kiểm tra trước stream và khóa, 254 dòng). Fixture dùng chung chuyển sang `backend/test/ai-chat-fixtures.ts`: `setupChat`, `runChatTurn`, `createHangingModel` (xử lý cả signal đã hủy sẵn lúc gọi `doStream`), `createAbortingModel`, `createThrowingStreamModel`, `providerError`, `spyOnLogger`, `loggedText`, `documentWithTableComment` và các hằng.
    - `runAiTurn` tách phần kết thúc thành `finishCompleted(run, steps, usage)`.
    - Test "turns off reasoning and sources in the UI stream" giờ bọc `toUIMessageStream` thật bằng `vi.mock("ai")` và `vi.fn(original)`, rồi assert tham số `sendReasoning: false`, `sendSources: false`, `sendStart: true`, `sendFinish: false`. Test không còn dựa vào bộ lọc chunk.
  - TDD. ĐỎ: `ai-stream-response.spec.ts` → `× aborts at once when the response was closed before the handler ran` (`expected false to be true`); `ai-chat.service.checks.spec.ts` → `Tests 2 failed | 11 passed (13)` (`expected [ { type: 'start', …(1) } ] to strictly equal []`; `promise resolved "ReadableStream …" instead of rejecting`, vì object kết quả mới luôn truthy). XANH sau khi sửa code. Test của `ai-capacity.spec.ts` được viết cùng lúc với thay đổi kiểu trả về, không có vòng đỏ riêng.
- **File thay đổi**
  - Sửa: `backend/src/modules/ai/ai-capacity.ts`, `ai-capacity.spec.ts`, `ai-chat.service.ts`, `ai-chat-turn.ts`, `ai-stream-response.ts`, `ai-stream-response.spec.ts`, `ai-chat.service.spec.ts` (viết lại).
  - Tạo: `backend/src/modules/ai/ai-chat.service.abort.spec.ts`, `ai-chat.service.checks.spec.ts`, `backend/test/ai-chat-fixtures.ts`.
- **Kiểm tra**
  - `.claude/scripts/verify.sh backend --format` → typecheck, lint, test (`Tests 556 passed (556)`), prettier PASS; `RESULT: PASS`. Coverage dòng toàn backend 98.06%. Lần chạy đầu `RESULT: FAIL (backend lint)` (`no-unsafe-assignment` do `expect.any(Number)`), đã thay bằng assert có kiểu.
  - `.claude/scripts/verify.sh backend --build` → `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh --all-changed` → `SECRET-SCAN: CLEAN`.
  - e2e `security` vẫn chưa chạy trong worktree (không có `backend/.env.test`).
- **Quyết định**
  - ⚠ Request đã hủy trước handler trả stream rỗng thay vì ném lỗi: không ai còn đọc response, và ném `ApiException` sẽ bắt filter ghi JSON vào socket đã đóng. Stream rỗng đi qua `pipeUIMessageStreamToResponse`, hàm này tự bỏ qua response đã `destroyed`. Lượt này không ghi dòng log AI-R31, vì không có lượt nào chạy.
  - Chỉ kiểm `abortSignal.aborted` một lần, trước khi lấy khóa: từ chỗ kiểm tới `await tryConsumeGlobalBudget()` không có `await` nào, và listener `abort` được gắn trước `await` đó, nên mọi lần đóng sau đều được thấy và thả khóa. Ngân sách đã trừ khi client đóng trong lúc chờ `await` là chi phí chấp nhận được, vì lời gọi model bị hủy ngay sau đó.
  - Log `ai.budget.exhausted` mỗi cửa sổ một lần dựa vào `consumedPoints` của `RateLimiterRes`, không cần đồng hồ hay trạng thái riêng.
  - `test/ai-chat-fixtures.ts` nằm trong `backend/test/`, giống `mock-ai-model.ts`: không bị build vào `dist/`. `ai-chat.service.limits.spec.ts` giữ hàm dựng module riêng, vì file đó mock module, và một hàm nhỏ tại chỗ dễ đọc hơn.
- **Việc còn lại**: không trong phạm vi task. Orchestrator chạy e2e `security` ở checkout chính.
- **Ghi chú cho người tiếp theo**
  - Task 19 dùng lại `backend/test/ai-chat-fixtures.ts` (`createHangingModel`, `providerError` có chuỗi `SENTINEL`).
  - Nơi gọi `tryConsumeGlobalBudget()` phải đọc `isAllowed`: kết quả là object, không còn là boolean.
