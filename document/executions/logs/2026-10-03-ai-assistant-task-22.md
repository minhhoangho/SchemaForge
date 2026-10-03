# Task 22: Xem trước đề xuất trong store editor

Plan: [Task 22](../../plans/2026-10-03-ai-assistant-plan.md#task-22-xem-trước-đề-xuất-trong-store-editor). Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md) (mục 7, AI-R33, AI-R60).

## 2026-10-03 — frontend-engineer — Xong

- **Đã làm**
  - `RightPanelMode` thêm `"ai"`; thêm `DiffMark`, `ProposalPreview`, `ProposalPreviewError`, trường `proposal` trong `EditorState`, ba action `startProposalPreview`, `acceptProposal`, `discardProposal`, selector `selectCanvasDocument`, `selectDiffMark`, `selectIsPreviewing` (export từ `create-editor-store.ts`, đúng tên mà plan phần 7 dùng).
  - `dispatch`, `undo`, `redo` khi đang xem trước: no-op, `logger.error("editor.proposal-locked", { action })`; `dispatch` trả `ok(undefined)` (Vấn đề 40). `replaceDocument` xóa `proposal`.
  - `lib/proposal-display.ts`: `buildProposalDisplay` (bảng, cột, quan hệ, enum bị xóa vẽ lại từ `base`; cột bị xóa chèn lại ở chỉ số cũ) và `countProposalChanges` (Vấn đề 29).
  - Chế độ `"ai"` không ẩn canvas dưới `lg`: `editor-workspace.tsx` vẫn chỉ ẩn khi `rightPanelMode === "code"` (không sửa file này).
- **File thay đổi**
  - `frontend/src/features/editor/state/create-editor-store.ts` (293 dòng)
  - `frontend/src/features/editor/state/create-editor-store.test.ts`
  - `frontend/src/features/editor/state/proposal-actions.ts` (mới)
  - `frontend/src/features/editor/lib/proposal-display.ts` (mới)
  - `frontend/src/features/editor/lib/proposal-display.test.ts` (mới)
- **Kiểm tra**
  - ĐỎ: `.claude/scripts/test-file.sh frontend src/features/editor/lib/proposal-display.test.ts` → `Failed to resolve import "./proposal-display"`; `.claude/scripts/test-file.sh frontend src/features/editor/state/create-editor-store.test.ts` → 12 test `proposal preview` thất bại (`startProposalPreview is not a function`).
  - XANH: hai lệnh trên → `RESULT: PASS`.
  - `.claude/scripts/verify.sh frontend --format` → `RESULT: PASS` (3870+ test, coverage dòng ~96%).
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Khóa `dispatch`/`undo`/`redo` qua helper `isProposalLocked` trong `proposal-actions.ts` để store dưới 300 dòng (Vấn đề 35).
  - Test dùng `addColumn` làm đề xuất hợp lệ: `addTable` một bảng rỗng sinh issue mới (bảng không cột) nên bị `stale`, đúng quy tắc.
  - Cột bị xóa của bảng còn lại được chèn theo chỉ số cũ tăng dần, nên nhiều cột bị xóa trong cùng bảng về đúng chỗ.
  - `startProposalPreview` lưu operation đã parse (không phải input `unknown`) vào `proposal.operation`.
  - Thêm test `throws when acceptProposal is called without a preview` và `selectDiffMark …` ngoài danh sách tối thiểu, để phủ quy tắc lỗi lập trình và selector.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 24: component canvas đọc `selectCanvasDocument`, `selectDiffMark`; huy hiệu issue vẫn đọc `state.document` (Vấn đề 30).
  - Cho tới Task 27b, `rightPanelMode === "ai"` vẫn render panel thuộc tính (workspace chưa có nhánh AI).
