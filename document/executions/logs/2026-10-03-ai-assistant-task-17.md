# Task 17: Ánh xạ lỗi stream và bộ lọc chunk

Plan: [Task 17](../../plans/2026-10-03-ai-assistant-plan.md#task-17-ánh-xạ-lỗi-stream-và-bộ-lọc-chunk). Spec: [AI-R22, AI-R24, AI-R58](../../specs/2026-10-02-ai-assistant-design.md) (mục 5 "Response").

## 2026-10-03 20:16 — ai-engineer — Xong

- **Đã làm**
  - `ai-stream-errors.ts`: `AiTurnInvalidError` (có `name` riêng) và `toAiStreamErrorCode(error: unknown): AiStreamErrorCode`. Thứ tự: `AiTurnInvalidError` → `ai-output-invalid`; `RetryError.isInstance` → đệ quy với `lastError`; `APICallError.isInstance` có `statusCode` 429 hoặc 503 → `ai-upstream-busy`; `DOMException` tên `TimeoutError` → `ai-timeout`; `AISDKError.isInstance` → `ai-upstream-failed`; còn lại → `internal-error`. Không đọc `error.message`.
  - `ai-stream-filter.ts`: `AI_ALLOWED_CHUNK_TYPES` (`start`, `text-start`, `text-delta`, `text-end`, `error`) và `createAiChunkFilter()` (`TransformStream<UIMessageChunk, UIMessageChunk>`) dựng chunk mới chỉ với trường cho phép; mọi loại khác bị bỏ.
  - TDD: viết hai file spec trước; chạy với file chưa có (lỗi import), rồi với stub trả `internal-error` và `TransformStream` rỗng: 37 test đỏ đúng lý do (`expected 'internal-error' to be 'ai-upstream-busy'`, …). Sau khi cài đặt: 44 test xanh.
  - **Lỗi timeout của `streamText` trong `ai` 7.0.126** (đọc `node_modules/ai/dist/index.js`): `totalMs` đi qua `mergeAbortSignals` → `AbortSignal.timeout(ms)`; `stepMs` (và `firstChunkMs`, `chunkMs`) đi qua `setAbortTimeout` → `abortController.abort(new DOMException("<label> timeout of <ms>ms exceeded", "TimeoutError"))`. Cả hai cho lý do hủy là **`DOMException` với `name === "TimeoutError"`**. Lưu ý quan trọng cho Task 18: timeout **không** đi qua `onError` hay chunk `error`. Trong `DefaultStreamTextResult` (dòng ~9141–9169), khi signal đã hủy và lỗi là `isAbortError` (gồm `TimeoutError`), stream phát part `{ type: "abort", reason: getErrorMessage(reason) }` rồi đóng, và gọi `onAbort({ reason })` với chính `DOMException`. `toUIMessageStream` chuyển nguyên part `abort` (dòng 7300). `retryWithExponentialBackoff` ném lại lỗi abort không bọc trong `RetryError`.
  - Test `maps the stream timeout error to ai-timeout` chạy `streamText` thật với `MockLanguageModelV4` treo đến khi bị hủy, `timeout: { totalMs: 5 }` và `{ stepMs: 5 }`, lấy `event.reason` của `onAbort` rồi ánh xạ; không dựng tay lỗi.
- **File thay đổi**
  - `backend/src/modules/ai/ai-stream-errors.ts` (mới)
  - `backend/src/modules/ai/ai-stream-errors.spec.ts` (mới)
  - `backend/src/modules/ai/ai-stream-filter.ts` (mới)
  - `backend/src/modules/ai/ai-stream-filter.spec.ts` (mới)
  - `document/executions/logs/2026-10-03-ai-assistant-task-17.md` (log này)
- **Kiểm tra**
  - `.claude/scripts/worktree-setup.sh <worktree>`: `RESULT: PASS`; `pnpm --filter @schemaforge/api-contract build`, `pnpm --filter @schemaforge/backend generate`: thành công.
  - RED: `pnpm --filter @schemaforge/backend exec vitest run src/modules/ai/` với stub: `Failed Tests 37`.
  - GREEN: cùng lệnh: `Tests 44 passed (44)`.
  - `.claude/scripts/verify.sh backend --build`: lần đầu `RESULT: FAIL (backend typecheck, backend lint)` (`TimeoutConfiguration` cần tham số generic; `prefer-promise-reject-errors`; `switch-exhaustiveness-check` không nhận `default`), đã sửa; lần cuối typecheck, lint, test (`Tests 351 passed (351)`, coverage dòng toàn backend 97.61%), build đều PASS, `RESULT: PASS`.
  - Coverage riêng hai file mới (`--coverage.include` hai file): 100% dòng, 100% nhánh.
  - `pnpm exec prettier --check` bốn file: `All files formatted correctly`.
- **Quyết định**
  - `ai-timeout` chỉ khi `error instanceof DOMException && error.name === "TimeoutError"`: đúng lỗi `ai` 7.0.126 dùng cho `totalMs`/`stepMs`; hủy do client ngắt (`AbortError`) ra `internal-error` (có test), Task 18 không ghi chunk khi client đã ngắt.
  - Kiểm tra timeout đặt trước `AISDKError` và kiểm tra 429/503 đặt trước `AISDKError` vì `RetryError`, `APICallError` đều là `AISDKError`.
  - Bộ lọc dùng chuỗi `if` thay `switch`: luật `switch-exhaustiveness-check` không chấp nhận `default`, mà liệt kê 23 loại cần bỏ sẽ không bỏ được loại mới của AI SDK sau này (Vấn đề 45).
  - Chunk `error` có `errorText` không thuộc `AI_STREAM_ERROR_CODES` được thay bằng `internal-error`: phòng thủ thêm cho AI-R24 nếu `onError` bị quên ở nơi gọi (mặc định AI SDK là `"An error occurred."`).
  - `messageMetadata` của `start` cũng bị bỏ (plan chỉ cho `type`, `messageId`).
  - Test loại chunk tương lai dùng `Object.assign` ghi đè `type` lúc chạy vì union `UIMessageChunk` không biểu diễn được loại chưa có, và luật cấm `as`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Coverage: `backend/vitest.config.ts` chưa có glob `src/modules/ai/ai-*.ts` (thuộc Task 14), nên hai file mới chưa được tính vào coverage toàn backend; sau khi Task 14 merge chúng được tính (đo riêng hiện là 100%).
  - Task 18: timeout tới dưới dạng part `abort` của model stream (bộ lọc bỏ part này, nên `reason` chứa thông báo không rời backend) và callback `onAbort` của `streamText`, không qua `onError`. Để gửi chunk `error` `ai-timeout`, service cần đọc `event.reason` trong `onAbort` (hoặc `abortSignal.reason` của signal gộp) và gọi `toAiStreamErrorCode`, phân biệt với client ngắt (`AbortError` → không ghi gì).
