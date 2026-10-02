# Nhật ký thực thi

Thư mục `logs/` lưu nhật ký thực thi của các task và handoff phiên làm việc. Mỗi agent có quyền ghi file tự viết log của mình khi task xong hoặc dừng. Plans không ghi tiến độ; trạng thái nằm trong logs và `document/roadmap.md`. Quy tắc đầy đủ: [`.claude/rules/execution-logs.md`](../../.claude/rules/execution-logs.md).

## Quy ước

- **Tên file**: mỗi lần chạy một file riêng, để agent song song và worktree không sửa chung một log.
  - Task của plan: `YYYY-MM-DD-<topic>-task-<N>.md` (`<topic>` là topic của plan, `<N>` là số task).
  - Việc không thuộc plan: `YYYY-MM-DD-<slug>.md` (slug kebab-case, tiếng Anh).
  - Handoff phiên: `YYYY-MM-DD-<topic>-handoff.md`, nằm trong `logs/`, không bao giờ nằm trong `plans/`.
- **Nội dung**: tiếng Việt; đường dẫn, lệnh, identifier giữ nguyên. Header `# <Tên task>` kèm link tới task của plan và spec, sau đó mỗi lần chạy thêm một entry (xem ví dụ).
- Nếu prompt chỉ định sẵn một file log (ví dụ để làm tiếp task đã dừng), ghi tiếp vào file đó.
- Reviewer chỉ đọc (`project-reviewer`, `ui-a11y-reviewer`) không tự ghi log: đưa các mục tương tự vào báo cáo, orchestrator nhờ `spec-writer` ghi.

## Khi nào dừng

Kiểm tra tại mỗi điểm dừng tự nhiên (xong một bước nhỏ, trước khi sang file hoặc module tiếp theo). Dừng nếu có một trong các dấu hiệu:

- một phần hội thoại trước đã bị nén hoặc tóm tắt;
- khoảng 60+ lần gọi tool, hoặc khoảng 25+ file / 4000+ dòng đã đọc;
- phải đọc lại file vì chi tiết đã mờ, không chắc đã sửa gì, hoặc tự mâu thuẫn với output trước.

Khi đó: hoàn tất hoặc hoàn tác chỗ sửa nhỏ đang làm (không để file sửa dở), chạy các kiểm tra nhanh phù hợp, ghi entry `Dừng giữa chừng` với **Việc còn lại** đầy đủ, rồi báo `partial` kèm đường dẫn log.

## Báo cáo và tiếp tục

- Mọi báo cáo kèm đường dẫn log và status: `done`, `partial` (dừng vì ngân sách context) hoặc `blocked`.
- Khi `partial`, orchestrator giao việc cho một agent MỚI (không dùng SendMessage), yêu cầu đọc log trước và ghi tiếp vào cùng file.
- Subagent không commit; orchestrator commit log cùng với phần việc nó mô tả.

## Ví dụ

Các link `../../plans/...` và `../../specs/...` bên dưới chỉ là placeholder: plan và spec trong ví dụ không tồn tại.

````markdown
# Task 5: Endpoint tạo và cập nhật schema

> Plan: [task 5](../../plans/2026-01-01-example-plan.md#task-5) · Spec: [spec](../../specs/2026-01-01-example-design.md)

## 2026-10-02 14:30 — backend-engineer — Dừng giữa chừng
- **Đã làm**: thêm endpoint tạo schema và test cho nó.
- **File thay đổi**:
  - `backend/src/modules/schemas/schemas.controller.ts` (sửa)
  - `backend/src/modules/schemas/schemas.service.ts` (sửa)
  - `backend/src/modules/schemas/schemas.service.spec.ts` (sửa)
- **Kiểm tra**: `pnpm --filter @schemaforge/backend typecheck` → pass; `pnpm --filter @schemaforge/backend test` → pass.
- **Quyết định**: đặt kiểm tra revision trong service, không đặt trong controller.
- **Việc còn lại**:
  - [ ] Thêm endpoint cập nhật schema, kiểm tra `revision` gửi lên khớp bản đang lưu; lệch thì trả 409.
  - [ ] Viết e2e test cho endpoint cập nhật, gồm trường hợp 409.
- **Ghi chú cho người tiếp theo**: bắt đầu từ `SchemasService`; e2e test viết trong `backend/test/schemas.e2e-spec.ts`.
````
