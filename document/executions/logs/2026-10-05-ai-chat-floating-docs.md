# Cập nhật tài liệu: focus ring mới và cửa sổ chat AI nổi

Không thuộc task nào trong plan. Ghi lại hai quyết định giao diện người dùng đã duyệt, theo [log task 1](2026-10-05-ai-chat-floating-task-1.md), [task 2](2026-10-05-ai-chat-floating-task-2.md), [task 3](2026-10-05-ai-chat-floating-task-3.md) và mockup `document/ui_reference/ai-chat-bubble-mockup.html`. Spec liên quan: [spec phần 5](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-05 — spec-writer — Xong
- **Đã làm**
  - `architecture.md`, hàng "Token viền và focus ring": light `--ring` là `var(--primary)` (`oklch(0.55 0.18 259)`, 4,49:1 đến 4,97:1 trên background, card, popover, muted, canvas), dark giữ `oklch(0.56 0.11 258)`; ghi ba kiểu focus (ô nhập `border-ring` + `ring-1`; control `ring-2` + `ring-offset-2 ring-offset-background`; hàng danh sách feature `ring-2` không offset); offset màu nền thay bảo đảm cũ "ring ≥3:1 trên nút chính", `globals.test.ts` không đo ring trên `--primary`; bỏ số 3,04:1 / 3,29:1 và lý do "6% còn 3,00:1"; hover 5% chỉ còn vì tương phản nhãn; ghi chú chạy lại `globals.test.ts` khi chỉnh `--ring` hay `--muted` của dark (bỏ `--primary`). Lý do: phản hồi người dùng 2026-10-05.
  - Spec phần 5: viết lại AI-R1 (launcher góc dưới phải canvas, cửa sổ nổi không modal), AI-R3 (gợi ý nhanh luôn hiện), AI-R51 (`role="dialog"` `aria-modal="false"`, header có Thu nhỏ, Mở rộng, token `--bubble-*`), gạch đầu dòng focus khi đóng cửa sổ (về launcher); thêm ghi chú "Đổi trong lúc cài đặt (2026-10-05; …)" dưới AI-R51; sửa "Cấu trúc thư mục" (bỏ "cột phải" và nút "Trợ lý AI", thêm file mới của cửa sổ nổi và `use-is-narrow-viewport.ts`).
- **File thay đổi**: `document/architecture.md`, `document/specs/2026-10-02-ai-assistant-design.md`, log này.
- **Kiểm tra**
  - Đọc `frontend/src/app/globals.css` (light `--ring: var(--primary)`, `--primary: oklch(0.55 0.18 259)`; dark `--ring: oklch(0.56 0.11 258)`), class focus trong `frontend/src/components/ui/*` và các file feature, `globals.test.ts` (không còn cặp ring trên primary).
  - Tính lại tương phản bằng chính `frontend/src/testing/contrast-ratio.ts` (chép vào scratchpad, chạy bằng Node 24): light ring trên background 4,829, card 4,969, popover 4,969, muted 4,491, canvas 4,557; dark ring trên muted 3,323 (hẹp nhất).
  - Hàng bảng sửa vẫn đủ 3 cột (đếm dấu `|`); các link tương đối trong ghi chú mới trỏ tới file có thật.
- **Quyết định**
  - Sửa trực tiếp câu của AI-R1, AI-R3, AI-R51, gạch đầu dòng focus và cây thư mục để spec không còn tả panel dock hay nút trên thanh công cụ; ghi chú "Đổi trong lúc cài đặt" đặt dưới AI-R51 (mục Bố cục) và ghi rõ thiết kế cũ, theo kiểu ghi chú của AI-R34.
  - Không thêm hàng mới vào `architecture.md` cho bố cục cửa sổ chat: đây là quyết định giao diện, không phải lựa chọn kỹ thuật; `architecture.md` không có câu nào tả panel AI dock.
  - Không sửa các nhắc tới "panel AI" chung chung (mục 2, 5, 15, tiêu chí hoàn thành): vẫn đúng với cửa sổ nổi.
- **Việc còn lại**: không có trong phạm vi.
- **Ghi chú cho người tiếp theo**: `document/specs/2026-10-01-visual-refresh-design.md` dòng 123 (`--ring` light `oklch(0.25 0.07 262)`) và dòng 210 (ring phải đạt 3:1 trên nền nút chính) giờ lệch với `architecture.md`; file đó ngoài phạm vi lần này, cần thêm một ghi chú cài đặt nếu muốn đồng bộ.

## 2026-10-05 — spec-writer — Xong (đồng bộ spec phần 10)
- **Đã làm**: thêm ghi chú "Đổi trong lúc cài đặt (2026-10-05; …)" vào `document/specs/2026-10-01-visual-refresh-design.md`: một ghi chú ngắn ngay sau bảng token (light `--ring` thành `var(--primary)`, trỏ tới hàng "Token viền và focus ring" của `architecture.md`), một ghi chú đầy đủ sau đoạn yêu cầu `--ring` 3:1 trên nền nút chính ở mục "Độ tương phản" (yêu cầu đó được thay bằng khe offset màu nền trên control, `globals.test.ts` bỏ case `ring` trên `primary`); thêm một câu vào rủi ro "Lề tương phản hẹp ở dark mode" để không còn nhắc lề ring trên primary như ràng buộc hiện hành.
- **File thay đổi**: `document/specs/2026-10-01-visual-refresh-design.md`, log này. Plan phần 10 không đổi.
- **Kiểm tra**: anchor `#độ-tương-phản` khớp heading duy nhất `### Độ tương phản`; link `../architecture.md` đúng đường dẫn.
- **Quyết định**: giữ nguyên bảng token và bảng tỉ lệ (lịch sử thiết kế), chỉ thêm ghi chú như kiểu của spec phần 5; sửa thêm câu rủi ro ở mục "Rủi ro" vì nó lặp lại ràng buộc đã bỏ.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**: `document/plans/2026-10-01-visual-refresh-plan.md` vẫn ghi giá trị ring cũ; plan là danh sách việc đã làm xong, không sửa.

## 2026-10-05 11:45 — spec-writer — Xong (sau review cửa sổ chat AI)
- **Đã làm**
  - `architecture.md`, hàng "Token viền và focus ring": dark `--ring` thành `oklch(0.58 0.11 258)`; ghi tỉ lệ `--ring` trên bảy nền (light / dark: background 4,83 / 4,33; card 4,97 / 3,98; popover 4,97 / 3,77; muted 4,49 / 3,61; canvas 4,56 / 4,48; accent 4,23 / 3,17; secondary 4,36 / 3,39); `ScrollArea` chuyển khỏi nhóm control dùng offset, viewport của nó và hàng trong vùng cuộn (`generator-diagnostic-list.tsx`) dùng `ring-2 ring-inset`; lề hẹp nhất thành ring trên `--accent` 3,17 ở dark; thêm lý do đổi dark ring (cũ 2,92:1 trên `--accent`).
  - `specs/2026-10-01-visual-refresh-design.md`: ghi chú sau bảng token và ghi chú ở "Độ tương phản" nêu dark ring mới, nền accent, secondary và `ring-inset` của `ScrollArea`; rủi ro "Lề tương phản hẹp ở dark mode" nêu lề mới (accent 3,17, muted 3,61).
  - `specs/2026-10-02-ai-assistant-design.md`: AI-R1 (không modal chỉ trên màn rộng, dưới 640px là sheet modal), AI-R51 (`aria-modal="true"` dưới 640px), ghi chú 2026-10-05 (chưa đọc chỉ khi `done`, cả khi thu nhỏ, xóa khi mở và Khôi phục; tên launcher ổn định, `aria-controls` chỉ khi mở; sheet modal với `inert`, launcher không render trên màn hẹp khi mở; bản nháp trong store chat; Escape bỏ qua khi IME; đóng giữ thu nhỏ, mở thì bỏ; `AiTurnStatus` ở gốc workspace, lỗi báo một nơi; giờ `createdAt` luôn hiện; pan node dưới cửa sổ; launcher và cửa sổ nổi trên panel code dưới `lg`), link log task 4 và review; "Cấu trúc thư mục" thêm file mới của task 4 và `use-reveal-focused-element.ts`.
  - Tạo `document/executions/logs/2026-10-05-ai-chat-floating-review-1.md` với ba entry reviewer.
- **File thay đổi**: `document/architecture.md`, `document/specs/2026-10-01-visual-refresh-design.md`, `document/specs/2026-10-02-ai-assistant-design.md`, `document/executions/logs/2026-10-05-ai-chat-floating-review-1.md`, log này.
- **Kiểm tra**
  - Tính lại tỉ lệ bằng `frontend/src/testing/contrast-ratio.ts` (chép vào scratchpad, Node 24) trên token đọc từ `frontend/src/app/globals.css`: khớp đúng các số ở trên. `globals.test.ts` có cặp ring trên `accent` và `secondary` cho cả hai theme.
  - Đọc class trong `scroll-area.tsx`, `generator-diagnostic-list.tsx` (`ring-inset`), `skip-to-panel-link.tsx` (`ring-offset-2`); `markAiReplyUnread` trong `create-editor-store.ts` chỉ đặt cờ khi đóng hoặc thu nhỏ.
  - Hàng sửa của `architecture.md` vẫn 3 cột; link tương đối tới log task 4, review, mockup trỏ tới file có thật.
- **Quyết định**: không thêm hàng mới vào `architecture.md`, chỉ sửa hàng có sẵn; ghi chú 2026-10-05 của spec phần 5 được sửa tại chỗ (không thêm ghi chú thứ hai) vì nó tả trạng thái hiện hành.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**: plan phần 10 và phần 5 vẫn ghi giá trị cũ; plan không sửa.

## 2026-10-05 — spec-writer — Xong (sau review lần 2 và task 6)
- **Đã làm**
  - Tạo `document/executions/logs/2026-10-05-ai-chat-floating-review-2.md` với hai entry reviewer (`ui-a11y-reviewer`, `project-reviewer`), cả hai duyệt kèm mục cần sửa; các mục mới đã sửa ở task 6.
  - `specs/2026-10-02-ai-assistant-design.md`, ghi chú 2026-10-05 dưới AI-R51: thêm link task 6 và review lần 2; (1) khi thu nhỏ và có phản hồi chưa đọc, nút Khôi phục hiện chấm và có tên `panel.restoreUnread` ("Restore, new reply" / "Khôi phục, có phản hồi mới"); (2) `AiWindowState`, `CLOSED_AI_WINDOW`, `createAiWindowActions` nằm ở `state/ai-window-actions.ts`; (3) focus sau Chấp nhận, Bỏ fallback thẻ, launcher, rồi nút Khôi phục (id cố định `AI_RESTORE_ID`). "Cấu trúc thư mục" thêm `ai-window-actions.ts`, `ai-window-actions.test.ts`.
- **File thay đổi**: `document/specs/2026-10-02-ai-assistant-design.md`, `document/executions/logs/2026-10-05-ai-chat-floating-review-2.md`, log này.
- **Kiểm tra**: đối chiếu với code: `AI_RESTORE_ID = "ai-assistant-restore"` trong `frontend/src/features/editor/components/ai-panel/ai-panel-ids.ts`; key `restoreUnread` có trong `frontend/src/lib/i18n/locales/{en,vi}/ai/panel.ts`; `frontend/src/features/editor/state/ai-window-actions.ts` và test có thật. Link tương đối trong log review lần 2 và spec trỏ tới file có thật.
- **Quyết định**: sửa ghi chú 2026-10-05 tại chỗ, không thêm ghi chú mới; `architecture.md` không đổi (không có quyết định kỹ thuật mới).
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**: còn mở ngoài phạm vi docs: tách `editor-workspace.tsx` (563 dòng) và `create-ai-chat-store.ts` (341 dòng); kiểm tay trên trình duyệt liệt kê trong log review lần 2.
