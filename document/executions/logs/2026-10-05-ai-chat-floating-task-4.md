# Sửa theo review cửa sổ chat AI nổi + bubble (task 4)

Không thuộc task nào trong plan. Sửa các phát hiện của `project-reviewer`, `ui-a11y-reviewer`, `react-reviewer` trên thay đổi chưa push của cửa sổ chat AI nổi và bubble. Thiết kế: `document/ui_reference/ai-chat-bubble-mockup.html`. Log trước: [task 1](2026-10-05-ai-chat-floating-task-1.md), [task 2](2026-10-05-ai-chat-floating-task-2.md), [task 3](2026-10-05-ai-chat-floating-task-3.md). Spec: `document/specs/2026-10-02-ai-assistant-design.md` (AI-R1, AI-R3, AI-R51 và ghi chú 2026-10-05, mục 14, 15).

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm** (theo số mục của review)
  1. Giờ tin nhắn: `AiUserMessage`/`AiAssistantMessage` có `createdAt` (epoch ms) do store chat đóng dấu bằng clock tiêm vào (`now` trong `CreateAiChatStoreInput`, provider truyền `Date.now`). Bỏ `useState(() => new Date())` và render-prop `children(sentAt)`. Giờ luôn hiện (chữ nhỏ, `text-muted-foreground`) dưới tin cuối của mỗi nhóm người gửi, không còn chỉ hiện khi hover/focus.
  2. Bản nháp: `draft` + `setDraft` trong store chat; xóa khi gửi (chỉ khi lượt thật sự bắt đầu) và khi `reset` (Cuộc trò chuyện mới, đổi tài khoản). `AiComposer` thành controlled (`draft`, `onDraftChange`).
  3. Dưới 640px: cửa sổ mở và không thu nhỏ là sheet modal (`aria-modal="true"`); workspace đặt `inert` cho header (toolbar), panel trái, `<main>`, panel code/thuộc tính. Launcher không render khi cửa sổ mở trên màn hẹp (cả khi thu nhỏ). Đóng/Escape dùng `closeToLauncher` (`flushSync` rồi focus launcher), nên focus vẫn về launcher dù launcher vừa render lại.
  4. Chế độ code dưới `lg`: `AiTurnStatus` render ở gốc layout workspace (luôn có, ngoài mọi phần bị ẩn/inert). Launcher + cửa sổ là anh em của `<main>` trong một wrapper `relative`; ở chế độ code wrapper có `max-lg:contents`, nên khi `<main>` bị `max-lg:hidden` chúng định vị theo hàng (`relative`) và nổi trên panel code.
  5. Escape bỏ qua khi `event.isComposing` (hook `use-close-on-escape.ts`).
  6. Màn rộng: mở rộng hook có sẵn `use-reveal-focused-element.ts`: khung cửa sổ mở và không thu nhỏ có thuộc tính `data-ai-window-overlay`; node/edge được focus bằng bàn phím mà chạm vào khung thì viewport `setCenter` để node nằm giữa phần canvas bên trái cửa sổ. `editor-canvas.tsx` không cần sửa.
  7. Hàng quick actions compact: `-m-1 p-1` thay `pb-0.5` để ring + offset không bị cắt.
  8. Launcher: tên ổn định `panel.toggle` ("AI assistant"), có phản hồi chưa đọc thì `panel.unreadReply` ("AI assistant, new reply"); `aria-expanded` mang trạng thái; `aria-controls` chỉ khi mở. Id cửa sổ chuyển từ `section` sang khung (tồn tại đúng khi mount). Chưa đọc chỉ khi lượt kết thúc với status `done`, cả khi cửa sổ thu nhỏ; xóa khi mở và khi Khôi phục. Theo dõi lượt chuyển từ launcher sang `AiTurnStatus` (luôn mount, vì launcher không render khi mở trên màn hẹp).
  9. Animation đóng: hook `useExitAnimation` trong `ai-panel-loader.tsx` nghe native `animationend` + `animationcancel` (React không có `onAnimationCancel`) và `setTimeout` dự phòng 250 ms, đều dọn khi mở lại/unmount. `closeAiWindow` không reset `isMinimized` nữa; `openAiWindow` reset. Mở lại trong lúc animation: `use-focus-body-on-reopen.ts` focus composer (hoặc link/nút đầu tiên của thân). `setTimeout` của `onDecided` được clear khi unmount.
  10. Live region: `AiTurnStatus` nhớ (pattern "state từ render trước") log có đang hiện (mở, không thu nhỏ) lúc status đổi; nếu có thì lỗi do hộp lỗi trong `role="log"` đọc, vùng status để trống; nếu không thì vùng status đọc lỗi. `done` luôn do vùng status đọc. Mở/đóng sau đó không đọc lại.
  11. Hiệu năng: `MessageRow` bọc `memo`; callback của `Conversation` ổn định bằng `useCallback`; `Intl.DateTimeFormat` cache theo ngôn ngữ (Map cấp module); `AiTurnStatus` chọn primitive (status cuối) và object `failure` (tham chiếu ổn định) thay vì cả mảng `messages`.
  12. Tách `ai-message-list.tsx` (349 → 93 dòng): `MessageRow`, `AssistantMessage`, `ProposalSlot`, `FailureNotice` sang `ai-message-row.tsx` (283 dòng); bỏ fragment rỗng. `ai-panel.tsx` 271 dòng sau khi tách hai hook.
  13. `AI_SMALL_TEXT_CLASS_NAME` trong `ai-text-styles.ts`, dùng ở 6 chỗ (5 file).
  14. Bỏ vòng `for` trong test giờ của `ai-message-list.test.tsx` (test mới theo text/thẻ `time`).
  15. Thêm entry vào log task 2 với kết quả kiểm tra.
- **File thay đổi**
  - `frontend/src/features/editor/state/{create-ai-chat-store,create-editor-store,ai-chat-store-provider}.ts(x)` + `create-ai-chat-store.test.ts`, `create-editor-store.test.ts`
  - `frontend/src/features/editor/components/ai-panel/`: `ai-launcher.tsx`, `ai-turn-status.tsx`, `ai-panel.tsx`, `ai-panel-loader.tsx`, `ai-panel-ids.ts`, `ai-composer.tsx`, `ai-message-list.tsx`, `ai-message-bubble.tsx`, `ai-quick-actions.tsx`, `ai-findings-card.tsx`, `ai-consent.tsx`, `ai-proposal-card.tsx`, `ai-sample-data-card.tsx`; mới: `ai-message-row.tsx`, `ai-text-styles.ts`, `close-to-launcher.ts`, `use-close-on-escape.ts`, `use-focus-body-on-reopen.ts`; test: `ai-panel.test.tsx`, `ai-message-list.test.tsx`, `ai-composer.test.tsx`
  - `frontend/src/features/editor/components/editor-workspace.tsx`, `editor-workspace.test.tsx`
  - `frontend/src/features/editor/hooks/use-reveal-focused-element.ts`, `use-reveal-focused-element.test.tsx`
  - `frontend/src/features/editor/lib/build-ai-chat-history.test.ts` (fixture thêm `createdAt`)
  - `document/executions/logs/2026-10-05-ai-chat-floating-task-2.md` (entry bổ sung)
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend --format --build`: `RESULT: PASS` (typecheck, lint, 4581 test, coverage All files 96.2% dòng, build, prettier). Lần chạy đầu FAIL ở prettier (4 file) → `prettier --write` 4 file đó, chạy lại PASS.
  - `.claude/scripts/test-file.sh frontend src/features/editor/components/ai-panel/ai-panel.test.tsx`: `RESULT: PASS` (file lazy nặng nhất, chạy lại để chắc không flaky).
  - Bundle (`frontend/.next`, sau build): 12 chunk `entryJSFiles` của `/schemas/[schemaId]/page` không chứa dấu nào (`data-ai-window-overlay`, `status.responding`, `panel.messagesLabel`, `panel.guestTitle`, `panel.assistantMessage`, `"a[href], button:not(:disabled)"`, `proposal.previewBar.title`, `vercel.ai.error`). Launcher ở `383lr34i1f336.js`, `AiTurnStatus` ở `0qvqfss8shre3.js`; panel + hàng tin chỉ ở `2eknvvmto-o7q.js`, thanh báo ở `3eq0i-qkwaoqr.js`, SDK `ai` ở `0mr0cmwdqaitn.js`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Test viết cùng lúc với code (không có bước RED riêng); các test mới: giờ giữ nguyên sau đóng/mở (fake `Date`), bản nháp sau Escape, Escape khi IME, sheet modal + không có launcher trên màn hẹp, chưa đọc khi thu nhỏ/không đánh dấu khi lỗi, lỗi báo đúng một nơi khi mở/đóng, mở lại trong lúc animation đóng, `animationcancel`, timeout dự phòng, inert workspace trên màn hẹp, launcher/status ngoài `<main>` ở chế độ code, pan node dưới cửa sổ AI.
- **Quyết định**
  - Clock: `now: () => number` (epoch ms) trong input của store, cùng kiểu tiêm với `generateId`/`scheduleFrame`. Tin trợ lý đóng dấu lúc bắt đầu lượt (khi bubble xuất hiện), không phải lúc kết thúc.
  - Giờ đặt dưới phần tử cuối của hàng tin cuối nhóm (với trợ lý có thể là dưới thẻ đề xuất/kết quả), không gắn vào bubble. Bubble bỏ chỗ chừa 36px cho giờ.
  - Bản nháp chỉ xóa khi `send` thật sự chạy lượt; bị từ chối (rỗng, đang gửi) thì giữ.
  - `aria-controls` trỏ tới khung cửa sổ (chứa `dialog`) vì khung tồn tại đúng lúc mở; `section` không còn id. Trong lúc animation đóng không có `aria-controls`.
  - Màn hẹp: launcher không render (thay vì `inert`), vì header/thanh thu nhỏ đã có Đóng và Khôi phục. Workspace tính modal = hẹp && mở && không thu nhỏ; inert từng vùng (header, panel trái, `<main>`, panel phải), không bọc cả hàng vì cửa sổ nằm trong hàng.
  - Vị trí launcher/cửa sổ: wrapper `relative` quanh `<main>`, `max-lg:contents` ở chế độ code; hàng `relative`. Khung cửa sổ trừ thêm 3rem chiều cao khi thanh báo xem trước hiện (`selectIsPreviewing`), vì khung giờ định vị theo wrapper (gồm cả thanh báo) chứ không theo vùng canvas bên dưới thanh.
  - Mục 6 làm trong hook có sẵn `use-reveal-focused-element.ts` (đúng "một hook"), không thêm hook mới và không sửa `editor-canvas.tsx`. Điều kiện là chạm (giao nhau) với cửa sổ như task yêu cầu, chặt hơn 2.4.11 (chỉ cần không bị che hết). Không tính launcher (56px, nhỏ hơn node).
  - Mục 10: "một thông báo" nghĩa là kết thúc lượt được nghe một lần: `done` qua vùng status; lỗi qua hộp lỗi trong log khi log đang hiện, qua vùng status khi không. Văn bản trả lời vẫn do `role="log"` đọc như trước.
  - `useCallback` ở `Conversation` và `memo` ở `MessageRow` là ngoại lệ có lý do của `react.md` (cần tham chiếu ổn định để hàng tin không render lại khi stream).
  - Hằng class 13px là hằng TS (`ai-text-styles.ts`) vì `globals.css` thuộc task song song.
  - Mục 14: giữ các assert class còn lại cho thứ chỉ có hình (góc đuôi, avatar `aria-hidden`, dấu nháy, bubble nét đứt) vì jsdom không có cách khác; chỉ bỏ vòng lặp.
  - Không cần chuỗi i18n mới.
- **Việc còn lại**: không có trong phạm vi.
- **Ghi chú cho người tiếp theo**
  - Kiểm tay trên trình duyệt thật: sheet modal dưới 640px (inert, focus về launcher sau Đóng/Escape, thanh thu nhỏ ở đáy không che control); chế độ code dưới `lg` (launcher và cửa sổ nổi trên panel code); pan khi Tab tới node nằm dưới cửa sổ (cả khi mở rộng 520px); giờ dưới bubble ở cả hai theme (tương phản `text-muted-foreground`); hàng quick actions compact không cắt ring ở 320px; trình đọc màn hình: chỉ một thông báo lỗi khi cửa sổ mở/đóng, tên launcher "AI assistant, new reply".
  - Còn một khe nhỏ: trên màn hẹp khi cửa sổ thu nhỏ, Chấp nhận/Bỏ từ thanh báo xem trước gọi `focusProposalCard`; thẻ bị ẩn và launcher không render nên focus rơi về `body`. Có thể thêm fallback sang nút Khôi phục (id cố định) nếu cần.
  - `document/specs/2026-10-02-ai-assistant-design.md` ghi chú 2026-10-05 còn nói "chưa đọc chỉ khi cửa sổ đóng hẳn, thu nhỏ vẫn tính là mở", "status nằm cạnh launcher" và "Đóng thì bỏ trạng thái thu nhỏ"; cần `spec-writer` cập nhật theo các quyết định ở trên (chưa đọc cả khi thu nhỏ, chỉ khi `done`; `AiTurnStatus` ở gốc workspace; sheet modal dưới 640px; giờ luôn hiện; bản nháp trong store).
