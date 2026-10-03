# Sửa lỗi a11y của AI Assistant Task 24–26

Nguồn: [review a11y](2026-10-04-ai-assistant-a11y-review-24-26.md). Spec: `document/specs/2026-10-02-ai-assistant-design.md` (AI-R34, AI-R36, AI-R43, AI-R44, mục 14).

## 2026-10-04 — frontend-engineer — Xong
- **Đã làm**: sửa các finding 1, 2, 3, 4, 6.
- **File thay đổi**: `frontend/src/features/editor/components/canvas/{table-node,column-row}.tsx`, `ai-panel/{ai-proposal-card,ai-sample-data-card}.tsx` và các file test cùng thư mục (`table-node`, `ai-proposal-card`, `ai-findings-card`, `ai-sample-data-card`).
- **Kiểm tra**: `verify.sh frontend --format`: typecheck, lint, prettier PASS. Test toàn bộ: 4329/4336 pass, 7 test timeout ở `editor-workspace.test.tsx` và `table-panel.test.tsx` (không liên quan thay đổi, máy tải ~90 do nhiều worktree); chạy lại riêng 2 file đó: 57/57 pass; chạy lại 32 file timeout lần trước: 301/301 pass. 4 file test đã sửa: 75/75 pass. `secret-scan.sh`: SECRET-SCAN: CLEAN.
- **Quyết định**
  - Bảng bị xóa: bỏ `opacity-60`, dùng `border-dashed` + `bg-diff-removed/10`; hiểu "node mờ" (AI-R34) là nét đứt + nền nhạt, vì opacity làm chữ dưới 4.5:1; nhãn "removed" đã báo trạng thái.
  - Hàng cột có diff dùng `text-foreground` cho kiểu dữ liệu và chip `U`/`AI`/`?`, giữ nguyên độ đậm nền để không đổi token.
  - `DiffLabel` và `CHIP_CLASS_NAME` đổi `text-[0.625rem]` thành `text-xs` (10px quá nhỏ; chip nằm trong hàng đã flex nên không vỡ layout).
  - Proposal card: `aria-describedby` trỏ đoạn trạng thái (trừ `preview`, nơi không có đoạn đó) và `role="status"` cho đoạn stale/invalid; không đổi focus (thuộc Task 27b).
  - Sample data: vùng cuộn dùng `aria-labelledby` trỏ `<caption>` thay vì `aria-label` (hết đọc đôi); thẻ hợp lệ là `role="group"` có tiêu đề `sampleData.title` (key đã có, không thêm key mới).
  - Thêm test axe theme tối cho proposal và findings card.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: tương phản chỉ được ước lượng; nên đo lại bằng trình duyệt thật với bảng bị xóa và hàng diff ở theme sáng/tối.
