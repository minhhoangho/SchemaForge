# Task 21: Client stream `ai-chat-client.ts` và `useAiChatTransport`

Plan: [Task 21](../../plans/2026-10-03-ai-assistant-plan.md#task-21-client-stream-ai-chat-clientts-và-useaichattransport). Spec: [AI-R25](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-03 20:45 — frontend-engineer — Xong

- **Đã làm**
  - Tạo `ai-chat-client.ts`: `createAiChatClient(transport).stream(request, { signal })` trả async iterable `AiChatEvent`; `POST /ai/chat` qua `withAutoRefresh`; lỗi trước stream thành `http-failure` (kind `http`) hoặc `error` (`network`, `timeout`, `invalid-response`); body 2xx đọc bằng `parseJsonEventStream` + `uiMessageChunkSchema` → `TransformStream` chặn → `readUIMessageStream({ terminateOnError: true })`; văn bản cộng dồn; ba data part parse bằng schema của `@schemaforge/api-contract`, phát một lần; hai timeout bằng `setTimeout` + `AbortController` nội bộ; người gọi hủy thì kết thúc im lặng.
  - Thêm `export` cho `withAutoRefresh` (`api-client.ts`), `readJsonBody`, `parseErrorBody` (`api-transport.ts`), không đổi thân hàm (Vấn đề 24).
  - `auth-provider.tsx`: `AuthRuntime` và `AuthContextValue` có `aiChatTransport`; export `useAiChatTransport(): AiChatTransport | null`; chỉ `import type` từ `ai-chat-client.ts`.
  - TDD: RED `ai-chat-client.test.ts` (`Failed to resolve import "./ai-chat-client"`), RED `auth-provider.test.tsx` (`TypeError: useAiChatTransport is not a function`, 2 failed | 8 passed); GREEN 16/16 và 10/10.
- **File thay đổi**
  - `frontend/src/lib/api/ai-chat-client.ts` (mới), `frontend/src/lib/api/ai-chat-client.test.ts` (mới)
  - `frontend/src/lib/api/api-client.ts`, `frontend/src/lib/api/api-transport.ts` (chỉ thêm `export`)
  - `frontend/src/components/auth-provider.tsx`, `frontend/src/components/auth-provider.test.tsx`
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend --build --format` → `RESULT: PASS` (4236 test, coverage dòng 96.02%). Lần chạy trước đó có 4 test hỏng ở `table-panel.test.tsx` (axe, hết thời gian khi máy đang tải); chạy riêng file đó 18/18 pass, chạy lại toàn bộ thì PASS.
  - Coverage riêng `ai-chat-client.ts`: 96.15% dòng.
  - `pnpm lint` ở root: 8 successful.
  - `vitest run src/lib/security/content-security-policy.test.ts`: 20 passed.
  - Probe lint: `eslint --stdin --stdin-filename src/lib/api/ai-chat-client.ts < ai-chat-client.ts` exit 0 (cho phép `ai`); cùng import `ai` với tên `src/lib/api/api-client.ts` và `src/features/editor/components/editor-workspace.tsx` báo `no-restricted-imports` ("Import the AI SDK only in src/lib/api/ai-chat-client.ts (AI spec section 5)").
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Chunk `error` được chặn trong `TransformStream` (đổi thành `Error(<mã>)`, mã lạ thành `internal-error`) thay vì để `readUIMessageStream` báo qua `onError`: `Error` thường của SDK không phân biệt được với lỗi mất kết nối; kết quả quan sát được giống plan. Không truyền `onError` vì với `terminateOnError: true` iterator đã ném đúng lỗi đó.
  - Data part `data-*` lạ (ngoài ba loại) bị bỏ qua, không coi là lỗi: backend không gửi loại khác (Vấn đề 45), plan không nói.
  - Timer byte đầu bắt đầu lại cho mỗi lần `fetch` (kể cả lần gửi lại sau refresh); timer tổng chạy từ lúc bắt đầu lượt.
  - `dispose` hủy `AbortController` nội bộ trong `finally` để nhả kết nối khi người đọc dừng sớm.
  - Thêm 2 test ngoài danh sách tối thiểu: `yields invalid-response for a success response without a body`, `ends without another event when the caller aborts mid-stream`.
- **Ghi chú cho người tiếp theo**
  - File test frontend (`FRONTEND_TEST_FILES` trong `eslint.config.mjs`: `*.test.{ts,tsx}` và `src/testing/**`) không chịu `no-restricted-imports`, nên import `ai` trong test hay `src/testing/` **không** bị lint chặn, khác với giả định của Vấn đề 34 (vẫn nên giữ quy ước không import `ai` ở đó).
  - Task 23 nạp module bằng `import()` động; `AiChatTransport` lấy từ `useAiChatTransport()`.
  - Kiểm tra tay (Task 29): stream thật qua CSP `connect-src`, hủy giữa chừng trên trình duyệt thật nhả kết nối.

## 2026-10-03 21:30 — frontend-engineer — Xong (sửa theo review: tách file quá 300 dòng)
- **Đã làm**: `ai-chat-client.ts` (360 dòng) vượt giới hạn ~300 dòng. Chuyển phần không chạm AI SDK sang `frontend/src/lib/api/ai-chat-request.ts`: `startRun`, `TurnRun`, `buildRequestInit`, `readFailure`, `openStream`, hằng `AI_CHAT_ROUTE`, hai hằng timeout và type `AiChatTransport`. `ai-chat-client.ts` giữ `parseJsonEventStream`, `readUIMessageStream`, `uiMessageChunkSchema`, chặn chunk `error`, ánh xạ sự kiện. Hành vi không đổi.
- **File thay đổi**: `frontend/src/lib/api/ai-chat-client.ts` (360 → 244 dòng), `frontend/src/lib/api/ai-chat-request.ts` (mới, 130 dòng). `ai-chat-client.test.ts` và `auth-provider.tsx` không đổi.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --build --format` → `RESULT: PASS` (4326 test, coverage dòng 96.03%); `eslint src/lib/api/ai-chat-request.ts src/lib/api/ai-chat-client.ts` sạch; `ai-chat-request.ts` không import `ai` (kể cả `import type`).
- **Quyết định**: `AiChatTransport` và hai hằng timeout định nghĩa trong `ai-chat-request.ts` rồi re-export từ `ai-chat-client.ts` (tránh import vòng giữa hai file); `AiChatErrorCode`, `AiChatEvent`, `AiChatClient`, `createAiChatClient` vẫn ở `ai-chat-client.ts`. Không thêm test riêng: các hàm đã chuyển được test qua `ai-chat-client.test.ts`.
