# Sửa các phát hiện review-4 của Task 31 "Tải ZIP"

- Plan: `document/plans/2026-10-03-import-export-plan.md` (Task 31)
- Spec: `document/specs/2026-09-15-import-export-design.md` mục 11
- Nguồn: `2026-10-05-import-export-review-4.md`, `2026-10-05-import-export-review-4-a11y.md`

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**: cả 10 mục.
  1. `useBuildZip` có `cancel()` (terminate worker, bỏ khỏi ref, reject build đang chờ bằng `BuildCancelledError`, reset `isBuilding`); `ZipDialog` gọi khi đóng dialog lúc đang build; không tải và không toast khi bị hủy.
  2. `fail` trong `use-build-zip.ts` và `use-generated-code.ts` terminate worker và đặt ref về `null`.
  3. Nút Tải: `disabled` chỉ khi `fileCount === 0`; khi build dùng `aria-disabled` + guard trong `onClick`; chỉ dòng `role="status"` thông báo tiến độ.
  4. Bỏ `aria-busy` ở trigger Export và assertion.
  5. Số lưu ý gắn với `selection` đã build, đổi selection hoặc đóng dialog thì mất.
  6. Tách `zip-selection-fields.tsx` (chỉ export `ZipSelectionFields`, mỗi nhóm một component nhỏ); `zip-dialog.tsx` còn khoảng 240 dòng.
  7. Test `handle-zip-request.test.ts`: png method 0, svg method 8 (đọc local header).
  8. i18n `zip.summary` ghép từ `filesOnly_*` và `notes_*` (`count`), cả `en` và `vi`.
  9. `hasSelfRelation(schema)` trong `compute-image-frame.ts`, dùng ở `use-build-zip.ts` và `use-export-actions.ts`, có test.
  10. `logger.error("export.zip-failed", { errorName })` trong hook (không log khi hủy).
- **File thay đổi**: `frontend/src/features/editor/code-generator/{use-build-zip.ts,use-build-zip.test.tsx,use-generated-code.ts,use-generated-code.test.tsx,handle-zip-request.test.ts}`, `frontend/src/features/editor/import-export/{zip-dialog.tsx,zip-dialog.test.tsx,zip-selection-fields.tsx,export-menu.tsx,export-menu.test.tsx,use-export-actions.ts,compute-image-frame.ts,compute-image-frame.test.ts}`, `frontend/src/lib/i18n/locales/{en,vi}/import-export.ts`.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` → `RESULT: PASS` (5251 test pass); `.claude/scripts/secret-scan.sh` sạch.
- **Quyết định**
  - Hủy bằng `BuildCancelledError` export từ hook: để dialog phân biệt hủy với lỗi mà không cần cờ phụ.
  - `buildGeneration` ref: hủy ở giai đoạn chụp ảnh (chưa có worker) cũng dừng, không post cho worker.
  - Log lỗi đặt trong hook: một chỗ, dialog không cần biết.
  - Diagnostic count suy ra từ `lastBuild.selection === selection`: không cần effect reset khi đổi selection.
  - `summary` = `"{{files}}, {{notes}}"` với hai phần đã chia số ít/nhiều; `vi` không phân biệt số ít/nhiều.
  - Nút aria-disabled thêm class `aria-disabled:opacity-50` để giữ dấu hiệu thị giác.
- **Ghi chú cho người tiếp theo**: kiểm tra thủ công với trình đọc màn hình rằng nút "Đang tạo…" không bị đọc lặp; kiểm tra trong trình duyệt thật rằng terminate worker lúc đang build không để lại lỗi console. `worktree-setup.sh` cần truyền đường dẫn tuyệt đối của worktree.
