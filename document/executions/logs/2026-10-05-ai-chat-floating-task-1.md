# Vỏ cửa sổ chat AI nổi (launcher + cửa sổ không modal)

Không thuộc task nào trong plan; làm theo mockup đã được người dùng duyệt `document/ui_reference/ai-chat-bubble-mockup.html` và log `document/executions/logs/2026-10-05-ai-chat-bubble-mockup.md`. Spec liên quan: `document/specs/2026-10-02-ai-assistant-design.md` (AI-R2, AI-R4, AI-R5, AI-R34, mục 15). Task song song (worktree khác) đổi giao diện bubble của danh sách tin, composer, quick actions, các thẻ và consent; task này chỉ làm phần vỏ.

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**
  - Bỏ panel AI dock bên phải (`rightPanelMode === "ai"`); `RightPanelMode` giờ chỉ còn `"properties" | "code"`. Gắn launcher + cửa sổ nổi vào vùng canvas (`<div className="relative ...">` trong `<main>`), panel thuộc tính/code vẫn chạy như cũ.
  - Editor store thêm `aiWindow` (`isOpen`, `isMinimized`, `isExpanded`, `hasUnreadReply`) và các action `openAiWindow`, `closeAiWindow`, `toggleAiWindowMinimized`, `toggleAiWindowExpanded`, `markAiReplyUnread`.
  - `ai-launcher.tsx` mới: nút tròn 56px, nền primary, icon sparkles (chevron-down khi mở), tooltip, `aria-expanded`, `aria-controls`; tên `panel.toggle` / `panel.close` / `panel.unreadReply`; chấm chưa đọc (`aria-hidden`, thông tin nằm trong tên truy cập). Launcher subscribe AI chat store: khi `isSending` chuyển true→false lúc cửa sổ đóng thì đánh dấu chưa đọc; mở cửa sổ thì xóa.
  - `ai-panel-loader.tsx`: component `AiWindow` (khung định vị + hiệu ứng scale/fade từ góc phải dưới, giữ mount trong lúc animation đóng rồi mới unmount; `motion-reduce:animate-none`; không có animation thì unmount ngay). Dưới 640px (`useIsNarrowViewport`, matchMedia) cửa sổ là sheet toàn màn hình, khi thu nhỏ là thanh ở đáy. `next/dynamic` vẫn lazy-load panel; placeholder loading/lỗi lấp đầy khung, trạng thái lỗi có nút đóng.
  - `ai-panel.tsx`: vỏ thành `role="dialog"` `aria-modal="false"` `aria-labelledby` tiêu đề; header gồm tiêu đề, Cuộc trò chuyện mới (icon), Thu nhỏ/Khôi phục, Mở rộng/Thu gọn (ẩn khi hẹp), Đóng. Escape (listener native trên section) đóng và trả focus về launcher. Thu nhỏ: phần thân dùng thuộc tính `hidden` (không unmount, giữ bản nháp).
  - `minimized-proposal-actions.tsx` mới: khi thu nhỏ và có preview đang chạy, hiện nhóm "Proposed changes" với Accept/Discard, dùng lại `AcceptProposalButton` (hộp xác nhận xóa), `acceptSafely`, `acceptProposal`/`discardProposal` của AI chat store; không có đường mutation mới.
  - Toolbar bỏ nút "AI assistant". `AI_PANEL_TOGGLE_ID` đổi thành `AI_LAUNCHER_ID`; `focusProposalCard` fallback về launcher khi thẻ không có hoặc nằm trong phần bị `hidden` (cửa sổ thu nhỏ).
  - `MiniMap position="bottom-left"`.
  - Locale `ai/panel.ts` (en + vi): thêm `unreadReply`, `minimize`, `restore`, `expand`, `shrink` theo bảng chuỗi mới của mockup.
- **File thay đổi**
  - `frontend/src/features/editor/state/create-editor-store.ts`, `create-editor-store.test.ts`
  - `frontend/src/features/editor/hooks/use-is-narrow-viewport.ts` (mới)
  - `frontend/src/features/editor/components/ai-panel/ai-launcher.tsx` (mới), `minimized-proposal-actions.tsx` (mới), `ai-panel.tsx`, `ai-panel-loader.tsx`, `ai-panel-ids.ts`, `proposal-decision.ts`, `ai-panel.test.tsx`, `proposal-decision.test.ts`, `proposal-preview-bar.test.tsx`
  - `frontend/src/features/editor/components/editor-workspace.tsx`, `editor-workspace.test.tsx`
  - `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`, `editor-toolbar.test.tsx`
  - `frontend/src/features/editor/components/canvas/editor-canvas.tsx`, `editor-canvas.test.tsx`
  - `frontend/src/features/editor/journeys/ai-assistant.test.tsx`
  - `frontend/src/lib/i18n/locales/en/ai/panel.ts`, `frontend/src/lib/i18n/locales/vi/ai/panel.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend --format --build`: typecheck, lint, test (4535 test), build PASS; format FAIL ở 5 file → chạy `prettier --write` cho 5 file đó.
  - `.claude/scripts/verify.sh frontend --format` (sau khi format): `RESULT: PASS`, coverage All files 96.19% dòng.
  - Kiểm tra đột biến: bỏ lời gọi `markAiReplyUnread()` → test "marks the launcher when a reply ends while the window is closed…" fail; đổi phím Escape → test "closes on Escape…" fail; khôi phục code, test pass lại.
  - Bundle (`frontend/.next` sau build): 12 chunk `entryJSFiles` của `/schemas/[schemaId]/page` không chứa dấu `panel.guestTitle`, `panel.minimize`, `previewBar.title`, `panel.messagesLabel`, `vercel.ai.error`, `panel.unreadReply`. Chunk workspace `2wc0xua141nx1.js` chứa launcher (`panel.unreadReply`) nhưng không chứa dấu nào của panel/thanh báo/SDK `ai`; các dấu panel chỉ ở `0zmbktkt-ehuy.js`, thanh báo ở `2op3mr0m-uj-d.js`, SDK `ai` ở `0mr0cmwdqaitn.js`. Hằng `AI_LAUNCHER_ID` nằm trong chunk UI dùng chung `08e8xj9wztj9k.js` (không có mã panel).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Trạng thái cửa sổ nằm trong editor store (cùng chỗ với `rightPanelMode`), không lưu lại khi tải trang. Đóng cửa sổ thì bỏ trạng thái thu nhỏ (mở lại thấy cả cửa sổ, focus vào composer), giữ trạng thái mở rộng.
  - Chưa đọc chỉ tính khi cửa sổ đóng hẳn; thu nhỏ vẫn tính là mở (giống mockup).
  - Launcher đứng trước cửa sổ trong DOM (như mockup) nên Shift+Tab từ header về launcher.
  - Nút Thu nhỏ chỉ đổi `aria-label` (Minimize/Restore), không thêm `aria-expanded` như mockup, để không báo trạng thái hai lần. Nút header không có tooltip (Escape đóng tooltip cũng sẽ đóng cửa sổ); launcher có tooltip bên trái.
  - "Cuộc trò chuyện mới" thành nút icon (SquarePen) có `aria-label`, như mockup.
  - Escape dùng listener native trên section thay vì `onKeyDown` của React: jsx-a11y cấm handler phím trên phần tử không tương tác, và listener native không nhận phím từ portal (hộp xác nhận xóa tự xử lý Escape của nó).
  - Sau Accept/Discard ở hàng thu nhỏ, focus về nút Khôi phục (một task sau, như `focusProposalCard`), gần hơn launcher.
  - Animation đóng: khung giữ mount + `inert` tới `animationend` (chỉ tính sự kiện của chính khung); nếu computed `animationName` rỗng hoặc `none` (reduced motion, jsdom) thì unmount ngay.
  - Kích thước: 380px × min(640px, chiều cao canvas − 6.5rem), mở rộng 520px × (chiều cao − 6.5rem); cách mép 1rem, đáy 5.5rem (trên launcher). Màu chỉ dùng token (`bg-background`, `border-border`, `bg-primary`, `bg-destructive`, `shadow-lg`).
  - Hàng Accept/Discard khi thu nhỏ là `role="group"` gắn nhãn "Proposed changes" (trùng nhãn thẻ đề xuất, nhưng thẻ khi đó bị `hidden`).
  - Viết test cùng lúc với code (không có bước RED riêng trước code); thay bằng kiểm tra đột biến ở trên.
- **Việc còn lại**: không có trong phạm vi task.
- **Ghi chú cho người tiếp theo**
  - Cần kiểm tra thủ công trên trình duyệt thật: animation mở/đóng và reduced motion; sheet toàn màn hình dưới 640px (và thanh thu nhỏ ở đáy); cửa sổ không che control khi focus (2.4.11) ở các kích thước canvas nhỏ; tương phản chấm chưa đọc (`bg-destructive` viền `border-background`) và tooltip ở cả hai theme; trình đọc màn hình đọc tên launcher thay đổi.
  - `status.done` hiện vẫn nằm trong danh sách tin (do task bubble sở hữu), nên khi cửa sổ đóng trình đọc màn hình không nghe "đã trả lời"; chỉ tên launcher đổi. Mockup đặt vùng `role="status"` ngoài cửa sổ; nên làm sau khi task bubble merge.
  - `ai-panel.tsx` dài 328 dòng (hơi quá mốc 300); nếu task bubble thêm nữa thì tách `HeaderButton`/header ra file riêng.
  - Khi merge với task bubble: xung đột có thể ở `ai-panel.tsx` (task này chỉ đổi phần `AiPanel` và import; `Conversation`/`SignedInBody` giữ nguyên) và `ai-panel.test.tsx` (harness giờ render `AiLauncher` + `AiWindow` thật, mở bằng launcher, tìm `role="dialog"`).
