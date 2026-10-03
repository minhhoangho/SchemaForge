# Task 24: Canvas ở chế độ xem trước

Plan: [Task 24](../../plans/2026-10-03-ai-assistant-plan.md#task-24-canvas-ở-chế-độ-xem-trước). Spec: [AI-R34](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-03 — frontend-engineer — Xong

- **Đã làm**
  - Canvas vẽ `selectCanvasDocument(state)` (bảng, cột, quan hệ, khóa, enum định dạng kiểu) thay cho `state.document`; huy hiệu issue và `hasIssue` của cạnh vẫn đọc `state.document` (Vấn đề 30).
  - Node bảng: viền 2 px token `--diff-*`, nhãn chữ `ai:diff.added|changed|removed` trong tiêu đề (chữ `foreground` trên nền `card`, viền token); `removed` thêm `opacity-60`.
  - Hàng cột: vạch trái + nền `bg-diff-*/10`, ký hiệu `+`, `~`, `−` `aria-hidden` kèm `sr-only` `ai:diff.column*`; cột bị xóa gạch ngang tên và kiểu.
  - Cạnh quan hệ bị xóa: nét đứt `2 4` (khác mẫu `6 4` của cạnh có issue) màu `var(--diff-removed)`.
  - Tên truy cập (`ariaLabel`) của node bảng và cạnh quan hệ có dấu diff được nối trạng thái qua khóa mới `ai:diff.elementLabel` ("{{label}}, {{state}}").
  - `editor-canvas.tsx`: `nodesDraggable`, `nodesConnectable`, `elementsSelectable` là `false` khi xem trước; zoom, pan, minimap giữ mặc định. Kích thước đo được lọc theo tài liệu hiển thị để bảng chỉ có khi xem trước vẫn lên minimap.
  - `use-editor-shortcuts.ts`: khi xem trước bỏ qua undo, redo, Delete và không `preventDefault`. `use-delete-selection.ts`: không làm gì khi xem trước (tránh toast "đã xóa" giả vì `dispatch` là no-op).
- **File thay đổi**
  - `frontend/src/features/editor/components/canvas/{table-node.tsx,table-node.test.tsx,column-row.tsx,relation-edge.tsx,relation-edge.test.tsx,editor-canvas.tsx,editor-canvas.test.tsx}`
  - `frontend/src/features/editor/hooks/{use-canvas-elements.ts,use-editor-shortcuts.ts,use-editor-shortcuts.test.tsx,use-delete-selection.ts,use-delete-selection.test.tsx}`
  - `frontend/src/lib/i18n/locales/{en,vi}/ai/diff.ts`
- **Kiểm tra**
  - RED: `pnpm --filter @schemaforge/frontend exec vitest run <5 file test>` → `Tests 14 failed | 66 passed (80)` (đúng các test mới).
  - GREEN: `pnpm --filter @schemaforge/frontend exec vitest run src/features/editor` → `Tests 1001 passed (1001)` (gồm `lib/node-reuse.perf.test.ts`).
  - `.claude/scripts/verify.sh frontend --build --format` → `RESULT: PASS`, line coverage 96.03%. Lần chạy đầu có 2 test `editor-workspace.test.tsx` ("in the cloud …") timeout dưới tải coverage; chạy riêng thì pass (64/64), lần verify thứ hai pass toàn bộ.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Thêm khóa `ai:diff.elementLabel` thay vì nối chuỗi ", " cứng: không có chuỗi hiển thị nào ngoài i18n.
  - Nối trạng thái diff vào `ariaLabel` của node và cạnh: nhãn hiển thị của cạnh bị `aria-hidden`, nên không có cách nào khác để trình đọc màn hình biết quan hệ bị xóa (WCAG 1.4.1).
  - Mẫu nét đứt riêng `2 4` cho quan hệ bị xóa: cạnh có issue đã dùng `6 4`, nên hai trạng thái khác nhau không chỉ bằng màu.
  - Phím tắt bị bỏ qua khi xem trước không `preventDefault`: phím vẫn tới React Flow; store đã chặn `undo`/`redo` nhưng log lỗi, nên chặn sớm ở hook để không sinh log `editor.proposal-locked`.
  - Lớp diff đặt sau lớp `selected` trong `cn` để viền diff thắng khi một bảng còn được chọn từ trước lúc xem trước.
  - Test "keeps viewport shortcuts during a preview" kiểm tra phím tắt không bị `preventDefault` khi xem trước: editor không có phím tắt khung nhìn riêng, khung nhìn do React Flow xử lý.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Kiểm tay: tương phản viền/nền `--diff-*` và nhãn diff trên tiêu đề bảng (màu accent) ở light và dark trong trình duyệt thật; độ rõ của nét đứt `2 4` ở các mức zoom.
  - Panel trái, panel thuộc tính, toolbar, nút tên schema chưa bị khóa khi xem trước: thuộc Task 27b.
  - `selection` cũ vẫn giữ trong lúc xem trước (store Task 22 không đổi selection); node có thể vẫn hiện viền chọn dưới viền diff.
