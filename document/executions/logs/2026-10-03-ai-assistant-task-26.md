# Thẻ dữ liệu mẫu (AI Assistant, Task 26)

Plan: `document/plans/2026-10-03-ai-assistant-plan.md` (Task 26). Spec: `document/specs/2026-10-02-ai-assistant-design.md` (AI-R42, AI-R43, AI-R44).

## 2026-10-03 20:55 — frontend-engineer — Xong
- **Đã làm**: thẻ `AiSampleDataCard` (nhập động `@schemaforge/core/generators/seed`, `Skeleton` khi chờ; `parseSeedDataset` + `validateSeedDataset` chạy lại theo `document` trong store; lỗi thì chỉ hiện `sampleData.outdated` và nút "Sinh lại"; hợp lệ thì `Tabs` mỗi bảng theo thứ tự nạp, bảng có `<caption>`, `th scope="col"`, vùng cuộn ngang focus được; chọn định dạng bằng `Select`; nhắc SQL do AI sinh; sao chép qua `useNotify`; tải xuống bằng `Blob` + thẻ `<a download>`).
- **File thay đổi**:
  - `frontend/src/features/editor/components/ai-panel/ai-sample-data-card.tsx`
  - `frontend/src/features/editor/components/ai-panel/ai-sample-data-card.test.tsx`
  - Không sửa `locales/{en,vi}/ai/sample-data.ts`: các key Task 20 đã đủ.
- **Kiểm tra**: test viết trước, đỏ (thiếu module), rồi xanh 21/21. `pnpm lint`, `pnpm typecheck` sạch. `verify.sh frontend --build --format` xem báo cáo cuối.
- **Quyết định**
  - Không đổi key i18n: đã đủ, tránh va chạm khi song song.
  - Nhãn tab là tên bảng kèm `rowCount` (đúng plan); vùng cuộn có `aria-label` bằng chú thích bảng.
  - Escape hoàn toàn do `serializeSeedDataset`; thẻ không escape gì.
  - Giá trị ô: chuỗi nguyên văn, `null` -> `NULL`, số/boolean qua `String`, object/mảng qua `JSON.stringify`.
  - Kết quả sao chép báo bằng toast (sonner có live region) giống `code-view.tsx`.
- **Ghi chú cho người tiếp theo**: `editor-workspace.test.tsx` có thể timeout khi cả bộ chạy song song nhưng chạy riêng thì qua (không liên quan). Cần kiểm tay độ tương phản chữ `text-muted-foreground` của dòng nhắc và tab trên Chrome.
