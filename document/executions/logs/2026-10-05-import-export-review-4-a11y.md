# Review 4 (UI, i18n, a11y): Task 31 Tải ZIP

Task 31 trong [plan phần 7](../../plans/2026-10-03-import-export-plan.md), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md). `ui-a11y-reviewer` (chỉ đọc) review commit `4f6d4e8`, song song với [Review 4](2026-10-05-import-export-review-4.md). Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của reviewer và quyết định của orchestrator.

## 2026-10-05 21:20 — ui-a11y-reviewer — Xong

- **Đã làm**: review `zip-dialog.tsx` (cùng test), `export-menu.tsx`, `use-export-actions.ts` và i18n `en`/`vi` `import-export.ts` theo spec mục 11, 12 và plan Task 31.
  - Kết luận: approve with fixes, không có finding blocking.
  - Nên sửa (1): Hủy, Escape hoặc nút X khi đang tạo chỉ đóng hộp thoại, build không dừng, nên ZIP vẫn tải về sau khi người dùng đã hủy (`zip-dialog.tsx` khoảng dòng 270 và 340; `use-build-zip.ts` khoảng dòng 89-135).
  - Nên sửa (2): nút "Tải" dùng `disabled={fileCount === 0 || isBuilding}` làm mất focus khi đang bấm, và nhãn "Đang tạo…" bị đọc hai lần; đề xuất `aria-disabled` cộng guard trong handler.
  - Nit: `aria-busy` trên nút Export gần như không được trình đọc màn hình đọc; `diagnosticCount` cũ còn lại; thiếu test trả focus và Escape ở mức hộp thoại (đã phủ ở mức menu).
  - Đã kiểm, ổn: i18n đủ hai locale, `vi` dùng `satisfies`, tiếng Việt tự nhiên; chỉ dùng token theme, axe pass ở cả hai theme; `Dialog` có tiêu đề, mô tả và focus trap; checkbox có `Label htmlFor`, nhóm dùng `fieldset`/`legend`, `Select` có tên; cảnh báo issue có icon và chữ; kích thước mục tiêu đạt 2.5.8.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - vitest `zip-dialog.test.tsx` và `export-menu.test.tsx`: 20/20 pass.
  - `secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Không chạy typecheck và lint.
- **Quyết định**: orchestrator gộp cả hai should-fix và các nit vào `2026-10-05-import-export-review-4-fixes.md`: bỏ `aria-busy` trên nút Export; reset `diagnosticCount` khi đổi lựa chọn hoặc khi đóng hộp thoại.
- **Việc còn lại**
  - [ ] Should-fix (1): Hủy, Escape và nút X khi đang tạo phải dừng build (bỏ kết quả, không tải ZIP), kèm test.
  - [ ] Should-fix (2): nút "Tải" dùng `aria-disabled` cộng guard thay cho `disabled` khi đang tạo, kèm test.
  - [ ] Nit: bỏ `aria-busy` trên nút Export; reset `diagnosticCount` khi đổi lựa chọn hoặc đóng; thêm test trả focus và Escape ở mức hộp thoại.
  - [ ] Kiểm tra tay trong trình duyệt (Task 32): focus trả về nút Export, `pointer-events` trên `body` sau khi đóng, độ tương phản ở hai theme, trình đọc màn hình, zoom 400% và chiều rộng 320 px, kích thước mục tiêu, chuỗi tiếng Việt dài.
- **Ghi chú cho người tiếp theo**: Radix `DropdownMenu` mở `Dialog` bằng state, cần xác nhận tay việc trả focus và `pointer-events` sau khi đóng hộp thoại.
