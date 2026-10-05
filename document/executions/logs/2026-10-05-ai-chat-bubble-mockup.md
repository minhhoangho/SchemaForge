# Mockup HTML: giao diện bubble chat cho panel trợ lý AI

Không thuộc task nào trong plan; yêu cầu của người dùng (xem trước khi sửa React). Tham chiếu: `document/ui_reference/visual-refresh-mockup.html`, `document/specs/2026-10-01-visual-refresh-design.md`.

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**: tạo `document/ui_reference/ai-chat-bubble-mockup.html` (một file, CSS/JS inline, không script ngoài; chỉ dùng Google Fonts như mockup trước, có font hệ thống dự phòng nên mở từ đĩa vẫn chạy). Khung editor gồm một mảnh canvas bên trái và panel AI bên phải (rộng 28rem). Thanh công cụ ngoài khung: Light/Dark, English/Tiếng Việt, 7 kịch bản (First use, Empty, Conversation, Proposal states, Findings and sample data, Streaming, Error). Chuỗi UI lấy từ namespace `ai` thật (vi và en); chuỗi mới nằm ở bảng "New strings" cuối trang.
- **File thay đổi**: `document/ui_reference/ai-chat-bubble-mockup.html`; không đụng `frontend/`.
- **Kiểm tra**: Chrome (chrome-devtools MCP) mở `file://`: không có lỗi console sau reload. Chạy script trong trang: chuyển qua 2 theme x 2 ngôn ngữ x 7 kịch bản, không có exception, tỉ lệ tương phản chữ/nền nhỏ nhất trong panel là 4.84:1 (sáng) và 6.46:1 (tối), đều >= 4.5. `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`. Không có `RESULT:` vì không chạy `verify.sh` (không đổi code).
- **Quyết định**:
  - Bubble người dùng: nền `--primary`, chữ `--primary-foreground` (đặc, 4.84:1 sáng). Bubble trợ lý: nền `--muted` + viền `--border`, chữ `--foreground`. Đề xuất thêm 4 token `--bubble-*` vào `globals.css` (mockup đang alias về token có sẵn).
  - Góc bất đối xứng: góc trên phía đuôi chỉ 4px ở bubble đầu nhóm; bubble tiếp theo trong nhóm bo tròn 16px. Nhóm = các tin liên tiếp cùng người gửi: cách nhau 2px, giữa các nhóm 16px; avatar trợ lý (sparkles) chỉ ở đầu nhóm, các tin sau dùng ô trống.
  - Một tin trợ lý gồm nhiều phần theo thứ tự (bubble văn bản, thẻ đề xuất/kết quả/dữ liệu mẫu, bubble kết); thẻ rộng đủ cột (không bị giới hạn 85%), bubble chữ có max-width khoảng 85% log.
  - Văn bản trợ lý vẫn là plain text; các dòng bắt đầu bằng "- " được hiển thị thành danh sách (không phải Markdown). Phương án dự phòng: giữ `whitespace-pre-wrap`.
  - Giờ gửi nằm cạnh bubble, chỉ hiện khi hover hoặc focus-within, chỗ đã chừa sẵn nên không nhảy layout. Thông tin này chỉ bổ sung (tên người gửi + `time` luôn có trong DOM cho trình đọc màn hình); log vẫn là một điểm dừng Tab, không thêm tabindex cho từng tin.
  - Nhận diện người gửi không chỉ bằng màu: căn trái/phải, avatar và nhãn `sr-only` dùng lại `panel.userMessage`/`panel.assistantMessage`; `role="log"` giữ `aria-label`, `aria-busy`, vùng `role="status"` cho `status.*`.
  - Trạng thái đề xuất: pending (viền primary, Accept/Discard, thanh preview + bảng "ghost" nét đứt trên canvas), accepted/discarded (badge có icon + chữ), stale và stoppedEarly (callout có icon + chữ, nền muted). Màu trạng thái chỉ dùng cho icon/viền, chữ luôn là `--foreground` hoặc `--muted-foreground`.
  - Lỗi: văn bản dở dang làm mờ + viền đứt, hộp lỗi (viền trái `--destructive`) kèm nút "Try again" chỉ ở lượt cuối; ghi chú "response was stopped" dưới bubble.
  - Quick actions: dạng chip lớn ở trạng thái rỗng; khi đã có hội thoại thu thành một hàng chip cuộn ngang, nằm phía trên composer. Composer là một khung duy nhất (textarea tự cao tối đa 120px, bộ đếm, Send/Stop trong khung), dính đáy, focus ring ở khung.
  - Chuyển động (dấu nháy, ba chấm) tắt khi `prefers-reduced-motion`.
  - Khác mockup trước: dark chỉ chọn bằng `[data-theme]` (JS đặt theo OS khi mở) để khỏi lặp khối token.
- **Component cần đổi khi hiện thực** (trong `frontend/src/features/editor/components/ai-panel/`):
  - `ai-message-list.tsx`: bố cục hàng tin (avatar, bubble, nhóm theo người gửi, giờ, hàng "- " thành danh sách), bubble người dùng/trợ lý, văn bản dở dang, ghi chú stopped, `FailureNotice`.
  - `ai-panel.tsx`: nền panel/header, khu vực dock; `ai-composer.tsx`: khung chung cho textarea + đếm + nút; `ai-quick-actions.tsx`: chip trong trạng thái rỗng và hàng cuộn khi có hội thoại.
  - `ai-proposal-card.tsx`, `ai-findings-card.tsx`, `ai-sample-data-card.tsx`: bỏ lề/viền riêng, nằm trong cột trợ lý; `ai-consent.tsx`: thẻ trong log; `proposal-preview-bar.tsx`: không đổi hành vi.
  - `frontend/src/app/globals.css` (token `--bubble-*`) và locale `ai/panel.ts` (en và vi: `emptyTitle`, `emptyBody`); cần cập nhật các test snapshot/query liên quan.
  - Lưu ý chiều rộng: `ai-panel.tsx` hiện là `w-80` (320px), mockup dùng 28rem (~450px) theo yêu cầu; cần quyết định đổi hay không.
- **Việc còn lại**: không có (chờ người dùng duyệt mockup rồi mới tạo task React).
- **Ghi chú cho người tiếp theo**: mockup chỉ là minh họa, nút Accept/Discard/Apply/Retry không có hành vi; Send không thêm tin. Cần kiểm tra thủ công: trình đọc màn hình thật (cách đọc nhãn người gửi + giờ trong `role="log"`), tương phản chip/viền ở màn hình độ sáng thấp, độ rộng 320px nếu giữ `w-80`. Tương phản được đo bằng script tạm trong trình duyệt (chữ so với nền thực), không đo viền/icon (cần 3:1).

## 2026-10-05 — frontend-engineer — Xong (điều chỉnh theo điều phối)
- **Đã làm**: điều phối xác nhận 450px là nhầm; đặt `--panel-w` mặc định 20rem (320px, bằng `w-80` của production) và thêm nút "Panel width: 320px / 384px" (20rem / 24rem) trên thanh công cụ. Sửa CSS cho panel hẹp: `.log` padding ngang 8px, thẻ padding 10px, hàng Accept/Discard chia đều chiều ngang (`flex: 1 1 0`), vùng giờ 36px, bubble trợ lý `max-width: calc(100% - 40px)`.
- **File thay đổi**: `document/ui_reference/ai-chat-bubble-mockup.html`.
- **Kiểm tra**: reload trong Chrome, không có thông báo console. Script trong trang chạy 56 tổ hợp (2 độ rộng x 2 theme x 2 ngôn ngữ x 7 kịch bản): không exception; không phần tử nào tràn ra ngoài panel, log/dock không có cuộn ngang, không nút/chip nào xuống dòng (cao <= 40px). Chip quick-action ở hàng dock cuộn ngang có chủ đích. Đã xem ảnh chụp 320px (vi, sáng, Proposal states): bubble, thẻ đề xuất (đếm + Chấp nhận/Bỏ), composer không tràn. Findings và sample data được kiểm bằng script tràn (bảng mẫu cuộn ngang trong `.grid-wrap`). Tương phản đo lần đầu ở độ rộng cũ, chưa đo lại sau khi đổi padding (màu không đổi). `secret-scan.sh`: CLEAN (chạy trước thay đổi này, chạy lại khi báo cáo).
- **Quyết định**: mặc định 320px; giữ nút 384px để người dùng cân nhắc có đáng mở rộng panel hay không. Bỏ ghi chú "cần quyết định đổi chiều rộng" ở entry trước.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**: ở 320px chữ "Gửi/Send" và đếm ký tự vẫn vừa một hàng; với bản dịch dài hơn cần kiểm lại.
