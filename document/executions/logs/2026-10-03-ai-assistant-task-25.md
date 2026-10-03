# Thẻ đề xuất, hộp thoại xác nhận xóa, thẻ gợi ý (AI Assistant, Task 25)

Plan: [2026-10-03-ai-assistant-plan.md](../../plans/2026-10-03-ai-assistant-plan.md) (Task 25). Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-03 20:58 — frontend-engineer — Xong
- **Đã làm**: viết test trước (đỏ vì thiếu module), rồi cài `AcceptProposalButton` (AlertDialog khi xóa bảng hoặc cột), `AiProposalCard` (năm trạng thái, số liệu `proposal.counts.*`, nhóm phá hủy chữ đậm kèm vạch `border-diff-removed`), `AiFindingsCard` (nhãn loại, nhóm, nút đích, "Áp dụng" hoặc "Sửa giúp tôi"). Khóa i18n `ai/proposal.ts`, `ai/findings.ts` đã đủ từ Task 20 nên không sửa.
- **File thay đổi**: `frontend/src/features/editor/components/ai-panel/{confirm-destructive-proposal-dialog,ai-proposal-card,ai-findings-card}.tsx` và ba file `.test.tsx` cạnh chúng.
- **Kiểm tra**: Vitest riêng 3 file: 29 test pass. `verify.sh frontend --build --format`: typecheck, lint, build, prettier đều PASS; coverage dòng 96.07%. Test đầy đủ chỉ rớt các test axe và timeout ở file không liên quan (máy tải load average ~200), chạy riêng `src/testing`, `editor-workspace.test.tsx`, `table-panel.test.tsx` đều pass. `secret-scan.sh`: CLEAN.
- **Quyết định**
  - Đổi tên prop `stoppedEarly` thành `hasStoppedEarly`: lint `naming-convention` bắt boolean bắt đầu bằng `is/has/can/should` và quy tắc cấm tắt lint. Task 27b truyền `hasStoppedEarly`.
  - Tên đích trong thẻ gợi ý tra bằng `Object.values(...).find(id === ...)` thay vì ép kiểu: hợp đồng dùng `string`, core dùng id có nhãn và chỉ có `isTableId`, không có `isColumnId`.
  - `{{tables}}` và `{{columns}}` của hộp thoại dựng từ `removedTables_*`, `removedColumns_*` theo yêu cầu; câu tiếng Anh thành "deletes 2 tables removed and 1 column removed" (hơi gượng, và hiện "0 columns removed" khi chỉ xóa bảng).
  - Test không dùng jest-dom (repo không cài): dùng `textContent`, `classList`, `document.activeElement`.
- **Việc còn lại**: không. Có thể cân nhắc thêm khóa `confirmDelete.tables_*`/`columns_*` (chỉ số + danh từ) để câu tự nhiên hơn và ẩn nhóm bằng 0.
- **Ghi chú cho người tiếp theo**: kiểm tay tương phản vạch `--diff-removed` và chữ đậm ở hai theme, và focus thực trên hộp thoại trong trình duyệt thật. Khi chạy full test lúc máy tải cao, vài test axe timeout; chạy lại riêng file.

## 2026-10-03 21:20 — frontend-engineer — Xong
- **Đã làm**: sửa câu hộp thoại xác nhận xóa. Thêm khóa `confirmDelete.tables_*`, `columns_*` và ba câu `bodyTablesAndColumns`, `bodyTables`, `bodyColumns` (thay `body`), chọn câu theo số khác 0, không còn in "0 columns". Không file nào khác tham chiếu `confirmDelete.body`.
- **File thay đổi**: `locales/{en,vi}/ai/proposal.ts`, `confirm-destructive-proposal-dialog.tsx`, `confirm-destructive-proposal-dialog.test.tsx` (it.each: chỉ bảng, chỉ cột, cả hai).
- **Kiểm tra**: `verify.sh frontend --build --format`: RESULT: PASS, 4267 test, coverage dòng 96.07%.
- **Việc còn lại**: không.
