# Sửa spec phần 6 theo kết quả probe database thật

- Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md)
- Nguồn kết quả: log Task 8 `document/executions/logs/2026-10-02-code-generators-task-8.md` (trong worktree `agent-ad11aed1b31b8f0b7`, chưa merge lúc viết)

## 2026-10-02 18:10 — spec-writer — Xong

- **Đã làm**
  - Thêm dòng R20 vào bảng "Sửa sau review ngày 2026-10-02": bốn giả định bị probe bác (so định danh MySQL, `SET DEFAULT`, hậu tố `Z`/`-00:00`, 8 chữ số giây lẻ SQL Server) và danh sách mã lỗi đã xác nhận.
  - Đầu spec: câu "chưa thử database thật" thêm ghi chú đã probe ngày 2026-10-02, trỏ tới R20.
  - Mục 3: viết lại lý do cắt 7 chữ số giây lẻ trên SQL Server (căn theo độ chính xác `datetime2(7)`, SQL Server 2022 nhận 8 chữ số); thêm ghi chú probe 14 (MySQL nhận 9 chữ số); thêm đoạn "Độ lệch UTC của `timestamptz` trên MySQL" (đổi `Z`, `-00:00` thành `+00:00`, không diagnostic).
  - Mục 4: danh mục `referential-action-not-supported` đổi lý do; `identifier-collision-renamed` đổi điều kiện sang so không phân biệt hoa thường (chỉ xảy ra khi schema có issue); ma trận dòng `timestamptz` thêm quy tắc `+00:00` cho MySQL.
  - Mục 5: `NameComparison` còn `exact` và `caseInsensitive`; bảng không gian tên SQL so `caseInsensitive` ở mọi dialect; bullet tên ràng buộc viết lại theo kết quả probe 1–4, 18, bỏ danh sách gộp của R12.
  - Mục 10: thêm `identifier-collision-renamed` trên MySQL vào nhóm diagnostic chỉ xảy ra khi schema có issue.
  - Mục Rủi ro: hai bullet MySQL, SQL Server viết lại thành kết quả probe; giữ phần còn phải xác nhận bằng conformance test.
  - Bảng "Quyết định bổ sung": vấn đề 7, vấn đề 8 và R12 thêm ghi chú thay hoặc viết lại ở R20.
- **File thay đổi**: `document/specs/2026-09-14-code-generators-design.md`, file log này.
- **Kiểm tra**
  - `pnpm exec prettier --check document/specs/2026-09-14-code-generators-design.md` → `All matched files use Prettier code style!`
  - Script Python kiểm số cột từng bảng (bỏ code span, tính `\|`) → không lệch; mọi link `#anchor` trong spec trỏ tới heading có thật.
- **Quyết định**
  - Bỏ hẳn mức `caseAndAccentInsensitive` khỏi `NameComparison`, vì sau quyết định của orchestrator không còn nơi dùng (allocator MySQL và allocator tên ràng buộc đều chuyển sang `caseInsensitive`). Task core song song cần khớp điều này.
  - Không sửa bảng "Vấn đề phát hiện khi lập plan" của plan: dòng 7, 9 là vấn đề đã được Task 0 giải quyết, không phải mục còn mở.
  - Không sửa CG-01, CG-08: không lặp lại các quy tắc này (seed SQL dùng chung hàm literal với giá trị mặc định nên tự theo mục 3).
  - Không dẫn link Markdown tới log Task 8 vì file chưa merge; chỉ ghi đường dẫn trong code span.
- **Việc còn lại**: không có trong phạm vi task này.
- **Ghi chú cho người tiếp theo**
  - Thân task của plan còn mô tả quy tắc cũ. Task 29 (`mysql.test.ts`, dòng test `renames a column that differs only by an accent`) chưa làm và sẽ sai với spec mới: cần đổi thành kiểm tra bảng `người dùng` giữ cả `ma` lẫn `má`. Thân các task đã xong (allocator, tên ràng buộc, `mysql-identifiers`, probe Task 8) mô tả `caseAndAccentInsensitive`; task core song song thay code, plan không cần đánh dấu tiến độ.
  - Snapshot `packages/core/src/generators/__snapshots__/prisma/naming-edge.mysql.diagnostics.txt` đang có `identifier-collision-renamed` cho `col_8`; sẽ đổi khi task core song song chạy.

## 2026-10-02 18:30 — spec-writer — Xong

Orchestrator giao thêm hai việc trong cùng lượt.

- **Đã làm**
  - Plan Task 29 (chưa bắt đầu), mục test riêng của `mysql.test.ts`: thay `renames a column that differs only by an accent` bằng `keeps columns that differ only by an accent` (bảng `người dùng` có cả `ma` lẫn `má`, không đổi tên, theo R20). Không sửa thân các task đã xong (gồm test `generate-mysql.test.ts` của Task 17).
  - Viết handoff phiên `document/executions/logs/2026-10-02-codegen-session-2-handoff.md`, thay `2026-10-02-codegen-ai-session-handoff.md` làm handoff mới nhất.
- **File thay đổi**: `document/plans/2026-09-15-code-generators-plan.md` (một dòng của Task 29), `document/executions/logs/2026-10-02-codegen-session-2-handoff.md` (tạo), file log này.
- **Kiểm tra**: `pnpm exec prettier --check` trên plan, handoff và log này → `All matched files use Prettier code style!`
- **Quyết định**: handoff không ghi trạng thái phần 5 vì orchestrator không cung cấp; trỏ về mục 3 của handoff trước.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**: không có.
