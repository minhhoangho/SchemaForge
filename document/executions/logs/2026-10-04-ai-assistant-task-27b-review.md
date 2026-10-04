# Review Task 27b: Panel AI, thanh xem trước và nối vào editor

Plan: [Task 27b](../../plans/2026-10-03-ai-assistant-plan.md#task-27b-panel-ai-thanh-báo-xem-trước-nút-trên-toolbar-khóa-editor-khi-xem-trước). Spec: [AI-R1–R7, R34, R36, R48, R50–R54, R60; mục 13, mục 14, mục 15](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-04 — project-reviewer — Xong

- **Đã làm**
  - Review chỉ đọc Task 27b chưa commit trên `master`, theo `CLAUDE.md`, `.claude/rules/`, plan Task 27b (Vấn đề 1, 16, 17, 26, 27, 31–33, 39, 40, 46, 57) và spec (AI-R1–R7, R34, R36, R48, R50–R54, R60; mục 13–15).
  - Kiểm tra khóa mọi đường sửa schema trong lúc xem trước: chỉ còn hở nút "Thêm bảng" ở trạng thái rỗng của canvas.
  - Kiểm tra bundle trên `frontend/.next` có sẵn (bản build mới hơn mã nguồn): chunk entry của editor và chunk workspace không chứa mã panel, thanh xem trước hay `ai`; khóa i18n dạng dấu chấm và dấu hiệu `vercel.ai` chỉ nằm ở các chunk tải trễ. Chuỗi i18n `ai` trần nằm ở chunk dùng chung vì Task 20 nạp namespace này sớm.
  - Kết luận: chấp nhận kèm sửa, không có phát hiện chặn.
- **File thay đổi**: không (reviewer chỉ đọc).
- **Kiểm tra**
  - `.claude/scripts/verify.sh frontend`: typecheck PASS, lint PASS; test có 1 lỗi do máy tải (`journeys/relations.test.tsx`), chạy lại thì PASS.
  - `pnpm --filter @schemaforge/frontend test` đầy đủ: 4475/4475, coverage dòng 96,14%.
  - Prettier: OK.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Chấp nhận quyết định 1 (thanh xem trước không dùng `useRevealTable`: chỉ đọc tài liệu đã lưu và đổi vùng chọn, không hợp với bảng chỉ có trong bản xem trước), 2 (hộp thoại đóng bằng cách chỉnh state trong lúc render, như `useCloudDialog`), 3 (wrapper `display: contents` với `inert` và `data-ai-commit-on-preview`), 4 (nút tên phần tử của gợi ý chỉ đưa khung nhìn tới và chọn bảng), 5 (nút "Thử lại" chỉ ở tin thất bại cuối), 7 (chỉ mock `useAiChatTransport`).
  - Bác quyết định 6: phải khôi phục `tabIndex={0}` trên `role="log"` kèm chú thích lý do tắt quy tắc lint.
  - Quyết định 8 (focus mất khi lượt kết thúc) phải sửa ngay trong task này.
  - Orchestrator: duyệt sửa `use-schema-commands.ts`, `use-reveal-table.ts`, `lib/viewport-controls.tsx` ngoài danh sách file; giao agent Task 27b sửa mọi mục trước khi commit; chấp nhận việc hộp thoại đổi tên và tạo quan hệ đóng mà không commit chữ đang gõ khi bắt đầu xem trước (đúng Vấn đề 46).
- **Việc còn lại**
  - [ ] `use-schema-commands.ts`: chặn `addTable` và `addEnum` khi `selectIsPreviewing` đúng (nút "Thêm bảng" ở trạng thái rỗng của canvas là đường hở duy nhất); thêm test ở `editor-workspace.test.tsx`.
  - [ ] Test của thanh xem trước: thêm ca đưa khung nhìn tới bảng được thêm (đọc từ tài liệu xem trước) và ca giảm chuyển động (chuyển không hiệu ứng).
  - [ ] Khôi phục `tabIndex={0}` trên phần tử `role="log"` (kèm chú thích vì sao tắt quy tắc lint).
  - [ ] `Conversation`: thêm effect đưa focus về ô soạn tin khi lượt kết thúc nếu focus đang rơi về `body` (quyết định 8).
  - [ ] (nit) Bỏ lệnh `if` trong test axe; gom bản sao thứ ba của logic giảm chuyển động thành helper trong `lib/viewport-controls.tsx`.
  - [ ] Spec: thêm ghi chú "Đổi trong lúc cài đặt" cạnh AI-R34 (đã làm bởi spec-writer cùng lượt).
- **Ghi chú cho người tiếp theo**
  - Test lỗi ở `journeys/relations.test.tsx` là do máy tải nặng, chạy lại thì PASS.
  - Review a11y và React/security của cùng task nằm ở `2026-10-04-ai-assistant-task-27b-a11y-review.md` và `2026-10-04-ai-assistant-task-27b-react-security-review.md`; các mục sửa của ba review chồng nhau ở phần focus, nên làm một lần.
