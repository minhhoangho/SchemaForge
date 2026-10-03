# Review UI/a11y AI Assistant, Task 24, 25, 26

Plan: [2026-10-03-ai-assistant-plan.md](../../plans/2026-10-03-ai-assistant-plan.md) (Task 24, 25, 26). Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md) (AI-R34, AI-R36, AI-R43, AI-R44, AI-R60, mục 14).

## 2026-10-04 — ui-a11y-reviewer — Xong
- **Đã làm**: đọc đủ `column-row.tsx`, `table-node.tsx`, `relation-edge.tsx`, `use-canvas-elements.ts`, ba thẻ AI (`ai-proposal-card`, `ai-findings-card`, `ai-sample-data-card`), `confirm-destructive-proposal-dialog.tsx`, locale vi/en `ai/{diff,proposal,sample-data}.ts`, token diff ở `globals.css` (commit `bb226eb`), và các mục spec/plan liên quan. Tính tương phản OKLCH cho `bg-diff-*/10` và `opacity-60` trong hai theme.
- **File thay đổi**: không (read-only).
- **Kiểm tra**: grep màu hardcode, chuỗi hardcode, `aria-live`; tính tương phản bằng script tạm ở scratchpad; không chạy verify.sh (commit đã merge, log Task 24 đến 26 ghi PASS); không chạy secret-scan.sh vì không có file nào bị tạo hay sửa; không chạy trình duyệt.
- **Quyết định**: verdict accept-with-fixes. Không có finding blocking; 2 lỗi tương phản chữ (WCAG 1.4.3) mức should-fix, cần đo lại trên trình duyệt thật. Orchestrator: sửa các mục 1–4 và 6 bằng task fix `2026-10-04-ai-diff-a11y-fixes`; mục focus sau Chấp nhận/Bỏ giao cho Task 27b; mục `elementLabel` viết hoa được chấp nhận giữ nguyên.
- **Việc còn lại**:
  - [ ] `table-node.tsx` `DIFF_CARD_CLASS_NAMES.removed`: bỏ `opacity-60` trên cả thẻ (chữ light còn khoảng 2.3:1); dùng viền nét đứt và tint nền, chỉ làm mờ lớp không chứa chữ.
  - [ ] `column-row.tsx`: ở hàng có diff, dùng `text-foreground` cho chữ kiểu và chip `U`/`AI` (dark, `muted-foreground` trên `bg-diff-changed/10` khoảng 3.97:1, added khoảng 4.21:1); hoặc giảm tint còn `/5`.
  - [ ] `table-node.tsx` `DiffLabel`: tăng `text-[0.625rem]` lên `text-xs`; cân nhắc gộp với `CHIP_CLASS_NAME`.
  - [ ] `ai-proposal-card.tsx`: thêm `aria-describedby` hoặc `role="status"` cho dòng trạng thái để trình đọc đọc được kết quả sau khi focus về thẻ.
  - [ ] Task 27b: sau Chấp nhận/Bỏ gọi focus vào `#ai-proposal-<messageId>` (AI-R34) và test; trigger của AlertDialog bị unmount nên Radix không tự trả focus.
  - [ ] Cân nhắc: bỏ `aria-label` hoặc `<caption>` trùng ở `SampleTable`; dùng khóa `sampleData.title` cho heading thẻ; thêm test axe theme dark cho `ai-proposal-card` và `ai-findings-card`.
  - [ ] Kiểm tay trong trình duyệt: tương phản thật, focus ring, thứ tự Tab ở chế độ xem trước, trình đọc màn hình đọc `ariaLabel` có trạng thái diff, focus hộp thoại xác nhận xóa.
- **Ghi chú cho người tiếp theo**: tương phản ở trên là ước tính tính toán (nền canvas giả định bằng `--background`, thẻ bằng `--card`); số thật có thể lệch vài phần. Vạch trái và viền `--diff-*` đạt ≥3:1 trên card ở cả light và dark nên không cần đổi token. `AiProposalCard`, `AiFindingsCard`, `AiSampleDataCard` chưa được panel dùng (chờ Task 27), nên các lỗi focus/status chỉ lộ khi nối vào panel.
