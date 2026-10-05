# Sửa các phát hiện review-3 của part 7 (Import/Export)

Nguồn: [review-3](./2026-10-05-import-export-review-3.md). Plan: `document/plans/2026-10-03-import-export-plan.md` (Task 23). Spec: `document/specs/2026-09-15-import-export-design.md` (mục 9, 10).

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**: 9 mục fix.
  1. `ai-sample-data-card.test.tsx`: test `downloads the sample data through downloadBlob with the same file name`, mock `@/lib/download/download-blob`, kiểm tra `blob.text()` và tên file; bỏ test vá `URL` toàn cục.
  2. `code-view.test.tsx`, `code-panel.test.tsx`: mock module `download-blob`, bỏ `Object.assign(URL, …)`, `vi.unstubAllGlobals()` trong thân test.
  3. `mount-editor-journey.tsx`: sửa comment (unit 30 s, journey 60 s).
  4. `editor-workspace.test.tsx`, `relations.test.tsx`: bỏ field và biến `hasToast`.
  5. `download-file-names.ts`: `requiredOption` ném lỗi thay cho fallback `"prisma"`/`"default"`; thêm test.
  6. `schema-list-row.tsx`: `type DownloadJsonItemProps`.
  7. `to-download-base-name.ts`: regex dùng `̀-ͯ`.
  8. `globals.css`: `@apply shadow-sm` cho node đang chọn khi `[data-exporting]`.
  9. `code-view.tsx`: tên file bọc trong `Tooltip`.
- **File thay đổi**: các file trên, cùng `download-file-names.test.ts`.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend` → `RESULT: PASS`. Lần đầu typecheck lỗi do thiếu `dist` của `@schemaforge/api-contract` trong worktree; chạy `pnpm --filter @schemaforge/api-contract build` rồi chạy lại.
- **Quyết định**
  - Mock module `download-blob` (cách ưu tiên) thay vì chỉ chuyển cleanup: bỏ hẳn việc đụng global.
  - Mục 5 ném `Error` vì core luôn đặt option; test dùng `options: {}` để mô phỏng.
  - Mục 8 dùng `@apply shadow-sm` (đúng bóng của node chưa chọn, đã có trong file) thay vì hằng số mới.
  - Mục 9 theo đúng mẫu `table-node.tsx` (`TooltipTrigger asChild` trên span), không thêm tabIndex, không thêm chuỗi i18n.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: kiểm tra thủ công ảnh export có node đang chọn (bóng giống node khác) trong trình duyệt thật.
