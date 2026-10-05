# Task 30: Menu Export trên toolbar

- Plan: `document/plans/2026-10-03-import-export-plan.md` (Task 30)
- Spec: `document/specs/2026-09-15-import-export-design.md` (mục 9–11, 12)

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**: thêm `ExportMenu` (JSON, PNG, SVG, "ZIP…" disabled) và hook `useExportActions`; đặt menu ngay sau nhóm thêm bảng/enum trên toolbar.
- **File thay đổi**:
  - `frontend/src/features/editor/import-export/use-export-actions.ts` (mới)
  - `frontend/src/features/editor/import-export/export-menu.tsx` (mới)
  - `frontend/src/features/editor/import-export/export-menu.test.tsx` (mới)
  - `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`
  - `frontend/src/features/editor/components/toolbar/editor-toolbar.test.tsx`
- **Kiểm tra**: xem báo cáo của agent (verify.sh frontend --build --format, secret-scan).
- **Quyết định**
  - Test mock `captureCanvasImage`, `downloadBlob`, `useNotify` ở biên (module mock); gốc chụp ảnh lấy bằng `document.querySelector("[data-export-root]")` vì toolbar và canvas là anh em.
  - Mục menu tự đóng khi chọn, nên nhãn "Generating image…" hiện khi mở lại menu; hook cũng chặn lần chụp thứ hai.
  - `ExportMenu` nằm cùng nhóm nút với AddButtons (không thêm separator), Task 28 đặt Import cạnh nó.
  - Lỗi chụp không log; chỉ `notify` `importExport:export.failed`.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: Task 31 bỏ `disabled` ở mục "ZIP…" trong `export-menu.tsx` và mở `ZipDialog`. Cần kiểm tra bằng trình duyệt thật: tải PNG/SVG thật từ menu, focus trả về nút Export sau khi menu đóng, độ tương phản menu ở cả hai theme.
