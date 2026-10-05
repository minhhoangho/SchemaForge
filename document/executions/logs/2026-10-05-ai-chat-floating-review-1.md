# Review cửa sổ chat AI nổi và bubble (lần 1)

Không thuộc task nào trong plan. Ba reviewer chỉ đọc (`project-reviewer`, `ui-a11y-reviewer`, `ecc:react-reviewer`) xem xét thay đổi chưa push của cửa sổ chat AI nổi, bubble chat và focus ring mới ([task 1](2026-10-05-ai-chat-floating-task-1.md), [task 2](2026-10-05-ai-chat-floating-task-2.md), [task 3](2026-10-05-ai-chat-floating-task-3.md)). Spec: [spec phần 5](../../specs/2026-10-02-ai-assistant-design.md) (AI-R1, AI-R51 và ghi chú 2026-10-05). Thiết kế: [ai-chat-bubble-mockup.html](../../ui_reference/ai-chat-bubble-mockup.html). Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của họ. Các phát hiện được sửa ở [task 4](2026-10-05-ai-chat-floating-task-4.md) (cửa sổ chat) và [task 5](2026-10-05-ai-chat-floating-task-5.md) (focus ring toàn app).

## 2026-10-05 11:43 — project-reviewer — Xong
- **Đã làm**: review thay đổi theo nguyên tắc kiến trúc trong `CLAUDE.md`, các rule trong `.claude/rules/`, `document/architecture.md` và spec phần 5. Kết luận: duyệt, kèm các mục cần sửa.
  - Nên sửa: giờ tin nhắn bị đặt lại mỗi lần mở lại cửa sổ; launcher, cửa sổ và vùng status bị ẩn ở chế độ code dưới `lg`; sheet dưới 640px không modal nên focus có thể nằm sau sheet (WCAG 2.2, tiêu chí 2.4.11); hàng chip gợi ý nhanh dạng gọn cắt mất focus ring.
  - Góp ý nhỏ: `ai-message-list.tsx` dài 349 dòng và có fragment rỗng; `skip-to-panel-link.tsx` dùng `ring-3` thay vì kiểu control; class `text-[0.8125rem]` lặp ở 4 file; vòng `for` trong test; log task 2 thiếu kết quả kiểm tra.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend --format`: PASS (typecheck, lint, 4556 test, coverage 96.2 / 92.79 / 98.44 / 96.14, prettier).
  - `.claude/scripts/secret-scan.sh` trên cả commit range và mọi file đã đổi: CLEAN.
  - Bundle: các dấu nhận diện của panel AI không có trong chunk entry của `/schemas/[schemaId]`.
- **Quyết định**: không có (reviewer chỉ đưa phát hiện).
- **Việc còn lại**: không có. Mọi mục nên sửa và góp ý nhỏ đã sửa ở [task 4](2026-10-05-ai-chat-floating-task-4.md) (giờ lưu `createdAt` trong store, launcher và cửa sổ nổi trên panel code, sheet modal, `-m-1 p-1` ở hàng chip, tách `ai-message-row.tsx`, `AI_SMALL_TEXT_CLASS_NAME`, bỏ vòng `for`, bổ sung log task 2) và [task 5](2026-10-05-ai-chat-floating-task-5.md) (skip link `ring-2` + `ring-offset-2`).
- **Ghi chú cho người tiếp theo**: kết quả kiểm tra ở trên là trước khi sửa; lần chạy sau sửa nằm trong log task 4 (4581 test, PASS).

## 2026-10-05 11:43 — ui-a11y-reviewer — Xong
- **Đã làm**: review i18n `vi`, `en`, token theme light, dark và tiếp cận theo WCAG 2.2 AA. Kết luận: yêu cầu sửa.
  - Chặn: sheet dưới 640px để focus đi ra phần workspace phía sau (2.4.11); thanh thu nhỏ của sheet che launcher.
  - Nên sửa: trên màn rộng, node được focus bằng bàn phím có thể nằm dưới cửa sổ (2.4.11); Escape đóng cửa sổ cả khi đang gõ bằng IME; giờ tin nhắn sai sau khi mở lại và chỉ hiện khi hover; vòng focus của hàng trong `generator-diagnostic-list.tsx` bị cắt; offset của vòng focus ở `ScrollArea` bị cắt.
  - Góp ý nhỏ: tên truy cập của launcher đổi theo trạng thái trùng với `aria-expanded`; lỗi lượt được đọc hai lần; cờ chưa đọc được đặt cả khi lượt bị dừng hoặc lỗi.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend`: PASS (4556 test).
  - `.claude/scripts/secret-scan.sh`: CLEAN.
  - Không kiểm trên trình duyệt.
- **Quyết định**: không có (reviewer chỉ đưa phát hiện).
- **Việc còn lại**: các phát hiện đã sửa ở [task 4](2026-10-05-ai-chat-floating-task-4.md) (sheet modal với `inert`, launcher không render trên màn hẹp khi cửa sổ mở, pan node dưới cửa sổ, bỏ qua Escape khi `isComposing`, giờ `createdAt` luôn hiện, tên launcher ổn định, lỗi báo một nơi, chưa đọc chỉ khi `done`) và [task 5](2026-10-05-ai-chat-floating-task-5.md) (`ring-inset` ở `generator-diagnostic-list.tsx` và viewport `ScrollArea`). Còn kiểm tay trên trình duyệt thật và trình đọc màn hình:
  - [ ] Dưới 640px: sheet modal giữ focus trong sheet (phần workspace phía sau `inert`), Đóng và Escape đưa focus về launcher, thanh thu nhỏ ở đáy không che control nào.
  - [ ] Dưới `lg` ở chế độ code: launcher và cửa sổ nổi trên panel code và dùng được bằng bàn phím.
  - [ ] Màn rộng: Tab tới node nằm dưới cửa sổ (cả khi mở rộng 520px) thì canvas pan để node hiện ra ngoài cửa sổ.
  - [ ] Giờ dưới bubble đọc được ở cả hai theme (`text-muted-foreground`).
  - [ ] Ở 320px, hàng chip gợi ý nhanh dạng gọn không cắt focus ring.
  - [ ] Vòng focus của hàng danh sách khi đang hover (nền `--accent`) thấy rõ ở cả hai theme.
  - [ ] Trình đọc màn hình (NVDA hoặc VoiceOver): lỗi lượt chỉ được đọc một lần khi cửa sổ mở và khi đóng; launcher đọc "AI assistant, new reply" khi có phản hồi chưa đọc.
- **Ghi chú cho người tiếp theo**: còn một khe ghi trong log task 4: trên màn hẹp khi cửa sổ thu nhỏ, Chấp nhận, Bỏ từ thanh báo xem trước có thể để focus rơi về `body` (thẻ đề xuất bị ẩn, launcher không render).

## 2026-10-05 11:43 — ecc:react-reviewer — Xong
- **Đã làm**: review đúng đắn của hook, chi phí render, ranh giới client và tiếp cận trong các component React của cửa sổ chat. Kết luận: cảnh báo.
  - HIGH: giờ tin nhắn lấy bằng `useState` lúc mount nên đổi mỗi lần mount lại; bản nháp ô soạn tin mất khi đóng cửa sổ.
  - MEDIUM: animation đóng có thể kẹt (không nghe `animationcancel`, không có timeout dự phòng); `isMinimized` bị đặt lại trong lúc animation đóng; chi phí render lại khi stream; `AiTurnStatus` chọn cả mảng `messages`; tên launcher trùng thông tin với `aria-expanded`; sheet hẹp không modal; không đánh dấu chưa đọc khi cửa sổ thu nhỏ.
  - LOW: mở lại trong lúc animation đóng không đưa focus vào cửa sổ; Escape không xét `isComposing`; `setTimeout` không được clear; không thử lại khi dynamic import lỗi; có thể đọc thông báo hai lần; `matchMedia` gọi mỗi lần render; fragment thừa.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**: không chạy lệnh nào (chỉ đọc code).
- **Quyết định**: không có (reviewer chỉ đưa phát hiện). Mục "không thử lại khi dynamic import lỗi" được chấp nhận, không sửa.
- **Việc còn lại**: không có. Các mục đã sửa ở [task 4](2026-10-05-ai-chat-floating-task-4.md): `createdAt` do store đóng dấu bằng clock tiêm vào, `draft` trong store chat, `useExitAnimation` nghe `animationend` + `animationcancel` kèm timeout 250 ms, `closeAiWindow` không đặt lại `isMinimized`, `memo` ở `MessageRow` và `useCallback` ở `Conversation`, `AiTurnStatus` chọn primitive, tên launcher ổn định, sheet modal, chưa đọc cả khi thu nhỏ, `use-focus-body-on-reopen.ts`, Escape xét `isComposing`, clear `setTimeout` của `onDecided`, lỗi báo một nơi, bỏ fragment.
- **Ghi chú cho người tiếp theo**: mục `matchMedia` gọi mỗi lần render chưa sửa: `getSnapshot` của `use-is-narrow-viewport.ts` (dùng `useSyncExternalStore`) vẫn gọi `window.matchMedia` mỗi lần đọc; chi phí nhỏ, có thể cache `MediaQueryList` ở cấp module nếu đo thấy đáng.
