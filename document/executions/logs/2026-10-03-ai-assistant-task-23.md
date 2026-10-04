# Task 23: Store hội thoại AI

Plan: [Task 23](../../plans/2026-10-03-ai-assistant-plan.md#task-23-store-hội-thoại-ai). Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md) (AI-R4, R6, R7, R18, R46, R47, R54; mục 8, 13, 15).

## 2026-10-04 — frontend-engineer — Xong

- **Đã làm**
  - `create-ai-chat-store.ts`: `createAiChatStore` (send, stop, retry, reset, acceptProposal, discardProposal), các type theo plan. Văn bản stream gộp theo khung hình (`scheduleFrame`), kết thúc lượt ghi văn bản cuối và hủy khung đang hẹn. `stop` thành `stopped` bỏ data part; lỗi thành `failed`; có đề xuất thì `beforePreview()` rồi `editor.startProposalPreview`.
  - `build-ai-chat-history.ts`: lịch sử gửi lên (Vấn đề 28), tối đa 40 tin, 60000 ký tự, luôn kết thúc bằng tin `user`.
  - `ai-chat-store-provider.tsx`: `AiChatStoreProvider`, `useAiChatStore`, `useAiChatStoreApi`, `AI_COMMIT_ON_PREVIEW_ATTRIBUTE`, `commitPendingEdits`; `loadClient` nạp `ai-chat-client` bằng `import()` động; reset khi unmount và khi đăng xuất hoặc đổi tài khoản.
  - L4: trần văn bản stream `AI_MAX_STREAMED_TEXT_LENGTH = 32768` ký tự mỗi tin.
- **File thay đổi**
  - `frontend/src/features/editor/state/create-ai-chat-store.ts`, `create-ai-chat-store.test.ts`, `ai-chat-store-provider.tsx`, `ai-chat-store-provider.test.tsx` (mới)
  - `frontend/src/features/editor/lib/build-ai-chat-history.ts`, `build-ai-chat-history.test.ts` (mới)
  - `frontend/src/features/editor/lib/ai-turn-accumulator.ts` (mới, ngoài danh sách của plan; xem Quyết định)
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` → `RESULT: PASS` (4368 test, coverage dòng 96.19%); `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`. Các lần chạy trước có test hết thời gian ở `table-panel.test.tsx`, `relations.test.tsx` khi máy tải nặng (không thuộc task); chạy lại thì PASS.
- **Quyết định**
  - Trần văn bản stream 32768 ký tự (8192 token đầu ra của backend x 4 ký tự): vượt thì cắt bớt, ghi `logger.warn` một lần, lượt vẫn kết thúc bình thường (không coi là lỗi, vì phần văn bản đã nhận vẫn hữu ích và lịch sử gửi lại chỉ lấy 8000 ký tự).
  - Tách `lib/ai-turn-accumulator.ts` (bộ gom sự kiện của một lượt, `consumeStream`) để `create-ai-chat-store.ts` dưới 300 dòng và không lồng quá 3 cấp.
  - `acceptProposal` ném `Error` khi tin không ở `preview` hoặc editor không còn `proposal` của nó (lỗi lập trình, giống `editor.acceptProposal`); giao diện đã ẩn nút trong trường hợp đó (Vấn đề 27). `discardProposal` thì bỏ qua im lặng. `acceptProposal` thất bại ở editor thì thẻ thành `discarded` (editor đã xóa `proposal`).
  - `getLocale` lấy `i18n.language`, không hợp lệ thì `DEFAULT_LOCALE` (`en`).
  - `retry` khi tin cuối không phải tin AI `failed` vẫn gửi lại (lịch sử tự cắt tin AI cuối); khi đã `isSending` hoặc chưa có tin người dùng thì bỏ qua.
  - L2 (review bảo mật backend): lượt đã stream chữ rồi kết thúc bằng chunk `error` (`ai-output-invalid`, `ai-timeout`, lỗi nhà cung cấp) là tin AI `failed` với `failure` mang mã; tin không có đề xuất, dữ liệu mẫu hay findings và không bắt đầu xem trước dù trước đó đã nhận `data-proposal`. Văn bản đã nhận được giữ trong tin `failed` (giao diện hiển thị cùng nhãn lỗi và nút "Thử lại", Task 25/27b) thay vì bị bỏ, để người dùng không mất chữ đã thấy; không bao giờ coi nó là kết quả thành công. Lịch sử các lượt sau bỏ tin `failed` (Vấn đề 28), có test.
  - Lỗi bất ngờ từ `loadClient` hoặc từ stream (ném lỗi) thành `failed` với `internal-error`, chỉ log tên lỗi.
  - Tin AI rỗng chỉ có findings: lịch sử gửi riêng khối `[findings]` (không có dấu `\n\n` đầu).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 27b: đặt `AI_COMMIT_ON_PREVIEW_ATTRIBUTE` lên wrapper panel trái và panel thuộc tính; bọc `AiChatStoreProvider` trong `editor-workspace.tsx` (phải nằm trong `EditorStoreProvider`).
  - Test provider mock `@/components/auth-provider` và `react-i18next` (ranh giới); `requestAnimationFrame` dùng của jsdom.
  - Kiểm tra tay (Task 29): focus/blur thật trong trình duyệt khi preview bắt đầu; stream thật.

## 2026-10-04 — frontend-engineer — Xong (sửa theo review project-reviewer)
- **Đã làm**
  - `ai-chat-store-provider.test.tsx`: bỏ `vi.mock` của `@/components/auth-provider` và `react-i18next`; dùng `renderWithProviders` với `AuthProvider` thật, chỉ `fetchImpl` là giả. Thêm `sends the interface language as the request locale` và `sends through the real transport as a POST to /ai/chat` (phủ `loadAiChatClient`); đăng xuất và đổi tài khoản chạy qua store auth thật (`markSignedOut`, `signIn`).
  - `create-ai-chat-store.test.ts`: thêm `retry resends the last user message after a stale proposal`; test L2 gửi thêm `findings`, `sampleData` trước chunk `error`; tách các test kiểm hai hành vi (retry, bỏ qua send); thêm kiểm tra không hẹn khung hình khi văn bản bị cắt không đổi.
  - `ai-turn-accumulator.ts`: `Accumulator` bất biến, `collectEvent` trả giá trị mới và không export, `default` có `satisfies never`; `consumeStream` bắt lỗi stream và trả `Accumulator` cuối (giữ văn bản đã nhận).
  - `create-ai-chat-store.ts`: tách `runTurn` thành `beginTurn`, `readTurn`, `finishTurn`; `isSending: false` đặt trong `finally`; chú thích trần 32768 là trần an toàn phía client (`AI_MAX_OUTPUT_TOKENS` tính theo bước).
- **Quyết định**
  - Orchestrator: trần L4 chỉ nằm ở store, không sửa `ai-chat-client.ts` (backend đã chặn tổng đầu ra mỗi lượt bằng số bước x token tối đa mỗi bước, nên bộ nhớ client bị chặn).
  - Test "không có transport" render `AuthProvider` không truyền `dependencies`: jsdom không có Web Locks nên runtime là `null`.
  - Sau retry, tin AI cũ có đề xuất `stale` chuyển `discarded` (mọi đề xuất chưa `accepted` của tin cũ là trạng thái cuối, plan Vấn đề 27) và vẫn nằm trong danh sách.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` → `RESULT: PASS` (4373 test, coverage dòng 96.1%); `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN` (lần đầu cắt chuỗi mật khẩu giả trong test để qua quét). Các lần chạy trước có test hết thời gian ở `editor-workspace.test.tsx` khi máy tải nặng; chạy lại file đó PASS.
