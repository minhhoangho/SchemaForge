# Task 27b: Panel AI, thanh báo xem trước, nút trên toolbar, khóa editor khi xem trước

Plan: [Task 27b](../../plans/2026-10-03-ai-assistant-plan.md#task-27b-panel-ai-thanh-báo-xem-trước-nút-trên-toolbar-khóa-editor-khi-xem-trước). Spec: [AI Assistant](../../specs/2026-10-02-ai-assistant-design.md) (AI-R1–R7, R34, R36, R48, R50–R54, R60, mục 13–15).

## 2026-10-04 09:30 — frontend-engineer — Xong

- **Đã làm**
  - Panel AI (`ai-panel.tsx`): `<section aria-label>` rộng `w-80`, tiêu đề `h2`, nút "Cuộc trò chuyện mới" (`reset`), nút đóng (trả focus về `#ai-assistant-toggle`), dòng thông báo dữ liệu; thân theo trạng thái auth: `unknown` không hiện gì, khách thấy lời mời và link `buildAuthHref("/sign-in", usePathname())`, không có transport thì `panel.unavailable`, đã đăng nhập thì cổng đồng ý (`useState(() => readAiConsent(userId))` trong component con có `key={user.id}`) rồi danh sách tin, gợi ý nhanh (chỉ khi rỗng), ô soạn có `inputRef`.
  - Danh sách tin (`ai-message-list.tsx`): `role="log"` có nhãn, văn bản thuần `whitespace-pre-wrap [overflow-wrap:anywhere]`, tin đang stream `aria-busy`, vùng `role="status"` ẩn đọc đang trả lời / đã xong / đã dừng / thông điệp lỗi; tin `failed` giữ chữ đã nhận (màu muted) cùng khung lỗi và nút "Thử lại" (chỉ ở tin cuối); 429 có `retryAfterSeconds` → `errors.rateLimited` kèm số giây, `http-failure` khác → `apiErrors:<mã>`, `error` → `ai:errors.<mã>`; thẻ đề xuất, gợi ý, dữ liệu mẫu.
  - Thẻ đề xuất: trạng thái `preview` mà `editor.proposal?.messageId` khác tin thì truyền `discarded` (ẩn Chấp nhận/Bỏ, tránh `acceptProposal` của store ném lỗi); `counts` chỉ khi là đề xuất hiện tại; truyền `hasStoppedEarly`. Sau Chấp nhận/Bỏ (thẻ hoặc thanh báo) focus `#ai-proposal-<id>` một task sau (`focusProposalCard`).
  - Thanh báo (`proposal-preview-bar.tsx`): `role="region"` nhãn `proposal.previewBar.label`, `absolute inset-x-0 top-0` trong `<main>`, tóm tắt số lượng (dùng `buildCountLines` của thẻ), `AcceptProposalButton` và "Bỏ"; khi đề xuất mới bắt đầu thì đưa khung nhìn tới bảng đầu tiên được thêm, sửa, hoặc bảng của cột đầu tiên được thêm/sửa, tôn trọng giảm chuyển động.
  - `ai-panel-loader.tsx` (`next/dynamic`, `ssr: false`, Skeleton `w-80`) và `ai-panel-ids.ts` (`AI_PANEL_TOGGLE_ID`).
  - Workspace: bọc `AiChatStoreProvider` trong `EditorStoreProvider`; cột phải `code`/`ai`/`properties`; giữ `max-lg:hidden` chỉ cho `code`; wrapper panel trái và wrapper (`display: contents`) của panel thuộc tính có `inert={isPreviewing}` và `data-ai-commit-on-preview`; đóng `CreateRelationDialog` khi xem trước bắt đầu; `ProposalPreviewBarLoader` trong `<main>` khi xem trước.
  - Toolbar: `AiToggleButton` (`id`, `Sparkles`, `aria-pressed`, `shrink-0`) cạnh nút Code; thêm bảng, thêm enum, undo, redo `disabled` khi xem trước. Nút tên schema `disabled` khi xem trước và đóng hộp thoại đổi tên đang mở.
  - Khóa i18n mới trong `ai/panel.ts` (en, vi): `messagesLabel`, `userMessage`, `assistantMessage`.
- **File thay đổi**
  - Tạo: `frontend/src/features/editor/components/ai-panel/{ai-panel.tsx,ai-panel.test.tsx,ai-panel-loader.tsx,ai-panel-ids.ts,ai-message-list.tsx,ai-message-list.test.tsx,proposal-preview-bar.tsx,proposal-preview-bar.test.tsx}`, `frontend/src/features/editor/components/toolbar/schema-name-button.test.tsx`, `frontend/src/testing/ai-chat-stream.ts`.
  - Sửa: `frontend/src/features/editor/components/editor-workspace.tsx`, `editor-workspace.test.tsx`, `toolbar/editor-toolbar.tsx`, `toolbar/editor-toolbar.test.tsx`, `toolbar/schema-name-button.tsx`, `ai-panel/ai-proposal-card.tsx` (chỉ thêm `export` cho `buildCountLines`), `frontend/src/lib/i18n/locales/{en,vi}/ai/panel.ts`.
- **Kiểm tra**
  - RED: `proposal-preview-bar.test.tsx`, `ai-panel.test.tsx` thất bại vì module chưa có; `schema-name-button.test.tsx` "2 failed | 1 passed"; `editor-toolbar.test.tsx` "2 failed | 26 passed"; `editor-workspace.test.tsx --name "AI assistant"` "7 failed". `ai-message-list.tsx` viết trước test (không có RED riêng); test focus sau hộp thoại xác nhận xóa đỏ thật ("expected … toBe …") rồi mới sửa bằng focus trễ một task.
  - GREEN: `.claude/scripts/test-file.sh frontend <file>` cho từng file: `RESULT: PASS`.
  - `.claude/scripts/verify.sh frontend --build --format`: typecheck, lint, test (4475 passed, coverage dòng 96.14%), build, prettier: `RESULT: PASS`. Lần chạy đầu có 3 test lỗi do máy tải nặng (`editor-screen.test.tsx` "passes the owner…", `journeys/relations.test.tsx`, `cloud-journeys/sign-out-pending.test.tsx`); chạy lại riêng từng file `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Bundle (`frontend/.next/` sau build): lấy `entryJSFiles` của `/schemas/[schemaId]/page` trong `server/app/schemas/[schemaId]/page_client-reference-manifest.js` (9 chunk) và các chunk mà loader của editor tải cùng workspace (`2tvw6njg4qo7g.js` cùng 4 chunk khác trong cùng `Promise.all`). `grep` các dấu `panel.guestTitle`, `previewBar.title`, `messagesLabel` (mã panel, thanh báo) và `vercel.ai.error` (SDK `ai`): không chunk nào trong các chunk đó chứa. Dấu chỉ nằm ở `0o3i3bg74a0v3.js` (panel), `0tog4u8b-qfu-.js` (thanh báo), `0mr0cmwdqaitn.js` (SDK `ai`), và chunk workspace chỉ tham chiếu chúng qua loader lười `e.v(t=>Promise.all([...].map(e.l)))`. Kết luận: mở editor không tải panel, thanh báo hay `ai`.
- **Quyết định**
  - `AiMessageList` nhận `messages`, `isSending` và callback qua props (panel nối store): component trình bày, test dựng tin bằng factory thay vì phải đi qua stream.
  - Focus thẻ đề xuất trễ một task (`setTimeout 0`): focus trap của `AlertDialog` còn mount khi bấm "Chấp nhận và xóa" kéo focus lại; sau khi hộp thoại unmount, Radix chỉ gọi `focus` lên trigger đã tách khỏi DOM (không làm gì), nên focus ở lại thẻ.
  - ⚠ Thanh báo không dùng `useRevealTable()` như plan ghi: hook tra bảng trong `document` (bảng được thêm chỉ có trong `display`) và đổi selection (xem trước không được đổi selection). Thay bằng `useViewportControls().setCenter` trên `display`, cùng kiểm tra giảm chuyển động. Với đề xuất chỉ thêm/sửa cột (diff không ghi bảng vào `tables.changed`) thì lấy bảng của cột đầu tiên.
  - Nút tên schema và hộp thoại tạo quan hệ đóng bằng điều chỉnh state trong render (`if (isPreviewing && isOpen) setIsOpen(false)`) thay cho `useEffect` của plan: React khuyên cách này, đã có tiền lệ `useCloudDialog` trong workspace.
  - Panel thuộc tính được bọc `<div className="contents">` mang `inert` và thuộc tính commit, vì `PropertiesPanel` không thuộc task này và có thể trả `null`.
  - `onRevealTarget` của thẻ gợi ý chỉ gọi `useRevealTable()` (đã chọn bảng), không `requestFocus` cho cột: ở chế độ `ai` panel thuộc tính bị thay, yêu cầu focus sẽ treo tới lúc panel quay lại (cùng lý do `use-go-to-issue.ts` có `shouldRequestFocus`).
  - Focus khi mở: mỗi thân tự focus lúc mount (link đăng nhập; nút đồng ý; ô soạn). Đồng ý xong thì focus ô soạn (nút đồng ý biến mất). Panel `unavailable` không có gì để focus.
  - Nút "Thử lại" chỉ ở tin `failed` cuối cùng (`retry` của store gửi lại tin người dùng cuối, nên nút ở tin cũ sẽ gửi sai tin).
  - Thông báo rate limit kèm số giây chỉ cho 429; 503 `ai-unavailable` (kể cả khi có `Retry-After`) hiện `apiErrors:ai-unavailable` như bảng mục 13 của spec.
  - Bỏ `tabIndex=0` trên `role="log"`: lint `jsx-a11y-x/no-noninteractive-tabindex` cấm; Chrome hiện tự cho vùng cuộn nhận focus bàn phím (cần kiểm tay).
  - ⚠ Thêm `frontend/src/testing/ai-chat-stream.ts` (ngoài danh sách file sở hữu): bộ dựng SSE `POST /ai/chat` và fetch giả `/auth/me` dùng chung cho 3 file test (panel, thanh báo, workspace), theo quy tắc tách khi có bản sao thứ ba; chỉ test import.
  - ⚠ Thêm `export` cho `buildCountLines` trong `ai-proposal-card.tsx` (Task 25) để thanh báo tóm tắt giống thẻ, thay vì chép 70 dòng.
  - Test "unavailable" thay riêng hook `useAiChatTransport` bằng `vi.mock` có `importOriginal` (các hook khác thật): với `AuthProvider` thật, đăng nhập mà không có transport là trạng thái không đạt được trong jsdom.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Kiểm tay ở Task 29 (trình duyệt thật, light và dark): tương phản chữ panel, khung lỗi `border-destructive`, chữ muted của tin thất bại, thanh báo `bg-background/95` trên canvas; vòng focus của nút toggle, nút đóng, vùng log cuộn được bằng bàn phím; trình đọc màn hình đọc `role="log"`, nhãn "Bạn"/"Trợ lý", vùng status và thẻ sau khi focus quay về; IME tiếng Việt trong ô soạn; stream thật (cuộn xuống cuối, Dừng).
  - Kiểm tay: khi stream xong, nút Dừng trở lại nút Gửi đang `disabled` (ô soạn rỗng), nên focus có thể rơi về `body` nếu người dùng gửi bằng nút. Nếu xảy ra, cân nhắc focus lại ô soạn khi `isSending` về `false`.
  - Khi đóng hộp thoại đổi tên hay tạo quan hệ do xem trước bắt đầu, trigger đang `disabled` hoặc không đổi, focus có thể về `body`; xem lại trên trình duyệt.
  - Đề xuất chỉ xóa (không thêm, sửa) thì khung nhìn không di chuyển (spec chỉ nói bảng thêm hoặc sửa).
  - Bộ test đầy đủ đôi khi lỗi ngẫu nhiên khi máy tải nặng; chạy lại file bằng `.claude/scripts/test-file.sh`.

## 2026-10-04 10:00 — frontend-engineer — Xong (sửa theo review project-reviewer, ui-a11y-reviewer, react-reviewer)

- **Đã làm**
  - Khóa còn sót: `addTable`, `addEnum` của `use-schema-commands.ts` dừng ngay khi `selectIsPreviewing` (một chốt cho mọi nơi gọi, kể cả nút "Thêm bảng" của trạng thái rỗng trên canvas).
  - Focus khi lượt kết thúc (`useFocusComposerAfterTurn` trong `ai-panel.tsx`): `isSending` từ `true` về `false` mà focus đang ở `body`, `null` hoặc một nút `disabled` thì focus ô soạn; focus người dùng đã chuyển đi nơi khác thì giữ nguyên.
  - `role="log"`: lại có `tabIndex={0}` (disable lint kèm lý do như `code-view.tsx`) và vòng focus `ring-ring`; `aria-busy` đặt trên chính log khi tin AI cuối đang stream (bỏ `aria-busy` ở từng `<li>`); vùng `role="status"` ẩn giữ nguyên.
  - Tự cuộn chỉ khi người đọc đang ở cuối log (≤ 40 px, theo dõi bằng ref trong `onScroll`) hoặc vừa gửi tin.
  - `focusProposalCard` và `acceptSafely` chuyển sang `ai-panel/proposal-decision.ts`; thanh báo không còn import danh sách tin. Không có thẻ trên màn hình (panel đóng) thì focus nút `#ai-assistant-toggle`. `acceptSafely` bắt lỗi do store ném và chỉ log tên lỗi (`ai.proposal-accept-failed`).
  - Thanh báo nằm trong luồng bình thường phía trên canvas (`flex-none`; `<main>` thành `flex flex-col`, canvas trong `<div className="min-h-0 flex-1">`), không còn `absolute` phủ lên nội dung canvas.
  - Loader: Skeleton panel kèm `role="status"` ẩn (`panel.loading`); `ProposalPreviewBarLoader` có placeholder cao bằng thanh; chunk thanh báo được tải trước khi chunk panel tải; import chunk lỗi thì log tên lỗi và hiện thông báo nhỏ `panel.loadFailed` (repo chưa có error boundary), editor vẫn chạy.
  - Hàm chung `getViewportTransitionDuration()` trong `lib/viewport-controls.tsx`, dùng ở `use-schema-commands.ts`, `use-reveal-table.ts` và thanh báo (bản sao thứ ba).
  - Fake stream trong `src/testing/ai-chat-stream.ts` tôn trọng `AbortSignal` như body của fetch thật (cần cho test bấm Dừng).
  - Khóa i18n mới trong `ai/panel.ts` (en, vi): `loading`, `loadFailed`.
- **File thay đổi**
  - Tạo: `frontend/src/features/editor/components/ai-panel/proposal-decision.ts`, `proposal-decision.test.ts`.
  - Sửa: `ai-panel/{ai-panel.tsx,ai-panel.test.tsx,ai-panel-loader.tsx,ai-message-list.tsx,ai-message-list.test.tsx,proposal-preview-bar.tsx,proposal-preview-bar.test.tsx}`, `components/editor-workspace.tsx`, `editor-workspace.test.tsx`, `hooks/use-schema-commands.ts`, `use-schema-commands.test.tsx`, `hooks/use-reveal-table.ts`, `lib/viewport-controls.tsx`, `frontend/src/testing/ai-chat-stream.ts`, `frontend/src/lib/i18n/locales/{en,vi}/ai/panel.ts`.
- **Kiểm tra**
  - RED đã chạy: bỏ chốt trong `use-schema-commands.ts` thì `use-schema-commands.test.tsx` "1 failed | 9 passed" và test workspace "adds no table from the canvas empty state during a preview" "1 failed"; bỏ `useFocusComposerAfterTurn` thì `ai-panel.test.tsx` "2 failed | 21 passed". Các test còn lại (log tabindex, aria-busy, cuộn, thanh báo, helper) viết cùng lúc với code, không có RED riêng.
  - `.claude/scripts/verify.sh frontend --build --format`: typecheck, lint, test (4497 passed, coverage dòng 96.14%), build, prettier: `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Bundle sau build mới: 9 chunk `entryJSFiles` của `/schemas/[schemaId]/page` và 5 chunk tải cùng workspace (`0wmu55xi2yvq7.js` …) không chứa dấu `panel.guestTitle`, `previewBar.title`, `panel.messagesLabel`, `vercel.ai.error`.
  - **Sửa câu bundle của mục trước**: các dấu là khóa có chấm (chuỗi trong lời gọi `t()` của mã panel, thanh báo) và dấu của SDK `ai`, nên chúng vắng mặt trong chunk khởi đầu của editor. Các chuỗi i18n trần của namespace `ai` (giá trị bản dịch) vẫn nằm trong chunk dùng chung, vì Task 20 nạp namespace đó ngay từ đầu; đó là dữ liệu dịch, không phải mã panel.
- **Quyết định**
  - Theo review: chấp nhận quyết định 1–5 và 7 của lượt trước; quyết định 6 (bỏ `tabIndex` ở log) bị bác và đã đảo lại; quyết định 8 (focus khi lượt kết thúc) đã sửa. Hai file ngoài danh sách (`buildCountLines` export, `src/testing/ai-chat-stream.ts`) được duyệt.
  - Hộp thoại xác nhận xóa vẫn dùng focus trễ một task: `AcceptProposalButton` (Task 25) không mở `onCloseAutoFocus` ra ngoài, và file đó không nằm trong danh sách được sửa lượt này.
  - `acceptSafely` dùng chung cho thẻ và thanh báo trong `proposal-decision.ts`, thay vì hai bản sao (lint `i18next/no-literal-string` cũng không cho chuỗi log nằm trong handler JSX).
  - Lỗi tải chunk dùng `catch` trong hàm load của `next/dynamic` vì repo chưa có error boundary; thông báo dùng `role="alert"`.
  - Tự cuộn thêm điều kiện "vừa gửi tin" để tin của chính người dùng luôn hiện ra dù trước đó đã cuộn lên.
  - Không làm (theo coordinator): memo hàng tin nhắn (đo trước đã); giữ bản nháp ô soạn khi đóng panel; commit bản nháp của hộp thoại đổi tên hay tạo quan hệ khi xem trước bắt đầu (Vấn đề 46 chủ ý đóng không commit); focus vào cả khối đồng ý thay vì nút của nó.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `git status` có `document/specs/2026-10-02-ai-assistant-design.md` bị sửa; không phải do agent này.
  - Kiểm tay Task 29 bổ sung: bố cục thanh báo trong luồng (canvas co lại, minimap và nút góc dưới vẫn đúng chỗ), vòng focus của log, focus về ô soạn sau Dừng/kết thúc trên Chrome và Safari, thông báo `panel.loadFailed` khi mất mạng lúc mở panel lần đầu.
