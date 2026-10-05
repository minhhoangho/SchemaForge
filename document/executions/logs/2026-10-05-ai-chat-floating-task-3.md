# Tích hợp cửa sổ chat AI nổi và bubble (task 3)

Nối hai thay đổi đã merge: `document/executions/logs/2026-10-05-ai-chat-floating-task-1.md` (vỏ) và `...-task-2.md` (bubble). Thiết kế: `document/ui_reference/ai-chat-bubble-mockup.html`.

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**
  - `ai-panel.tsx` (`Conversation`): `AiQuickActions` luôn hiển thị, `variant` là `large` khi chưa có tin, `compact` khi đã có hội thoại.
  - Vùng `role="status"` của lượt chat chuyển ra ngoài cửa sổ: `ai-turn-status.tsx` (`AiTurnStatus`) được `AiLauncher` render cạnh nút (launcher luôn mount, nằm ở chunk editor). Bỏ vùng status khỏi `AiMessageList`, nên mỗi lượt chỉ có đúng một thông báo dù cửa sổ mở, thu nhỏ hay đóng. `role="log"` và `aria-busy` giữ nguyên.
  - `use-ai-failure-text.ts` (mới): `useAiFailureText` tách từ `ai-message-list.tsx`, dùng chung cho danh sách tin và `AiTurnStatus`.
  - `ai-panel-header.tsx` (mới): tách `HeaderButton` + header khỏi `ai-panel.tsx` (328 → ~270 dòng).
  - Composer: ô nhập dùng cùng kiểu focus với `Input`/`Textarea` chuẩn: `border-ring` + `ring-3 ring-ring` (trước chỉ có ring, không đổi viền), áp khi textarea `:focus-visible` (`has-[textarea:focus-visible]`), thêm transition như Input.
- **File thay đổi**
  - `frontend/src/features/editor/components/ai-panel/{ai-panel,ai-launcher,ai-message-list,ai-composer}.tsx`, `ai-panel-header.tsx`, `ai-turn-status.tsx`, `use-ai-failure-text.ts` (mới)
  - Test: `ai-panel.test.tsx`, `ai-message-list.test.tsx`
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend --format --build`: `RESULT: PASS` (4558 test, coverage 96.2% dòng).
  - `.claude/scripts/test-file.sh frontend src/features/editor/components/ai-panel/ai-panel.test.tsx`: PASS.
  - Bundle (`frontend/.next/static/chunks`): chunk chứa launcher + `status.done`/`panel.unreadReply` là `10_lplckbbsxw.js`, không chứa dấu panel/thanh báo/SDK; `panel.guestTitle`/`panel.minimize`/`panel.messagesLabel` chỉ ở `2fop852naxykb.js`, `previewBar.title` ở `0n_j_nlwl4-lw.js`, `vercel.ai.error` ở `0mr0cmwdqaitn.js`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Đặt vùng status trong `AiLauncher` (không thêm vào `editor-workspace.tsx`): launcher đã mount cố định và đã subscribe store chat; `useAiFailureText` chỉ kéo `@/lib/api/api-failure` (có sẵn ở editor) và locale `apiErrors`, không kéo SDK `ai` hay mã panel.
  - Hàng quick actions compact chỉ còn kiểm bằng class (`overflow-x-auto`, không `flex-wrap`) trong test, vì jsdom không đo layout.
  - Test "một thông báo" dùng `getAllByText(...)` có độ dài 1 khi cửa sổ mở và khi đã đóng; vùng status nằm ngoài `dialog`.
  - Focus ring composer: chuẩn của app (Input/Textarea) cũng là `ring-3 ring-ring`; `globals.test.ts` cấm ring pha loãng (`ring-ring/50`) vì sẽ làm chỉ báo focus nhạt hơn token đã đo. Nên đồng bộ bằng cách thêm `border-ring` (đúng như Input) thay vì làm nhạt ring. Tương phản: token `--ring` đã được `globals.test.ts` đo ≥ 3:1 so với `--background` ở cả light và dark; viền `border-ring` cùng token nên giữ nguyên mức đó (1.4.11/2.4.7). Nền composer là `bg-card`/`bg-input/30`, cũng thuộc cặp đã đo. Chỉ cần kiểm bằng mắt thật.
  - Focus ring chỉ khi textarea `:focus-visible` (như Input), không còn hiện khi focus vào nút Send/Stop trong khung.
  - Cập nhật theo phản hồi người dùng (viền focus composer quá dày): chỉ composer dùng `border-ring` + `ring-1 ring-ring` (~2px, cùng token `--ring`, đặc, không opacity nên `globals.test.ts` vẫn đúng), giữ transition; `Input`/`Textarea` dùng chung không đổi. Lý do: WCAG 2.2 AA cần chỉ báo focus thấy được (2.4.7) với tương phản 3:1 (1.4.11, `--ring` đã được `globals.test.ts` đo); yêu cầu độ dày (2.4.13) chỉ ở mức AAA. Textarea khớp `:focus-visible` cả khi focus bằng chuột, chấp nhận được.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**
  - Kiểm thủ công: nghe thật bằng trình đọc màn hình "đã trả lời" khi cửa sổ đóng và khi mở (chỉ một lần); hàng quick actions compact cuộn ngang ở 320px (bản dịch vi); focus ring composer ở cả hai theme.

## 2026-10-05 — frontend-engineer — Xong (đổi focus ring toàn app)
- **Đã làm**: người dùng báo viền focus quá dày ở mọi component; gốc là `--ring` light gần đen dùng với `ring-3`. Đổi:
  - `globals.css`: light `--ring` `oklch(0.25 0.07 262)` → `var(--primary)` (= `oklch(0.55 0.18 259)`); dark giữ `oklch(0.56 0.11 258)`.
  - Ô nhập (`input`, `textarea`, `select`, ô lệnh của `command`; composer AI dùng cùng kiểu): `border-ring` + `ring-1 ring-ring` (~2px).
  - Control (`button`, `checkbox`, `radio-group`, `tabs`, `scroll-area`): `ring-2 ring-ring ring-offset-2 ring-offset-background`.
  - Feature (`issue-list-tab`, `table-list-tab`, `generator-diagnostic-list`, `ai-consent`, `ai-sample-data-card`, `code-view`): `ring-3` → `ring-2`, không offset (hàng nằm trong danh sách có overflow, offset sẽ bị cắt; không kề nền primary).
  - `globals.test.ts`: bỏ cặp `ring` trên `primary` (light và dark) và phép đo ring trên nút primary hover (vẫn giữ đo chữ 4.5:1).
- **File thay đổi**: `frontend/src/components/ui/{input,textarea,select,command,button,checkbox,radio-group,tabs,scroll-area}.tsx`, `frontend/src/app/globals.css`, `frontend/src/app/globals.test.ts`, 6 file feature nêu trên.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format --build` `RESULT: PASS` (4556 test); `secret-scan.sh` CLEAN; bundle: launcher + `status.done` ở chunk riêng, dấu panel/preview-bar/SDK `ai` vẫn ở chunk riêng như trước.
  - Tương phản light `--ring` (4.83 / 4.97 / 4.97 / 4.49 / 4.56): trên background / card / popover / muted / canvas, đều ≥ 3:1 (1.4.11); `globals.test.ts` vẫn đo các cặp này.
- **Quyết định**
  - Ring light là màu primary: ring xanh cạnh nút primary xanh sẽ 1:1, nên nút/checkbox/radio/tab dùng `ring-offset` màu nền để tách; offset thay cho bảo đảm "ring ≥3:1 trên nút primary" mà `document/architecture.md` dòng 137 từng dựa vào ring gần đen. Dòng này cần `spec-writer` cập nhật.
  - Dark giữ nguyên (ring 0.56 đã qua các phép đo); `--ring: var(--primary)` ở light để ring đi theo primary.
  - Độ dày (2.4.13) chỉ là AAA, không ràng buộc.
- **Việc còn lại**: `document/architecture.md` dòng 137 chưa sửa (ngoài phạm vi).
- **Ghi chú cho người tiếp theo**: kiểm tay hai theme: offset của nút trên nền card/muted, ring-offset trong tabs, ring `ring-2` của hàng danh sách ở panel hẹp.
