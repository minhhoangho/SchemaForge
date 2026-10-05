# Task 31: Tải ZIP

- Plan: `document/plans/2026-10-03-import-export-plan.md` (Task 31)
- Spec: `document/specs/2026-09-15-import-export-design.md` (mục 11, 12)

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**: hộp thoại "Tải ZIP" (chọn nhóm, mục, provider/dialect/format), ZIP xác định từng byte bằng `zipSync` trong worker sinh code, mục "ZIP…" của menu Export mở hộp thoại; thêm phần review-3 (a11y menu Export, log chỉ tên lỗi).
- **File thay đổi**:
  - Mới: `frontend/src/features/editor/code-generator/{build-zip,handle-zip-request,use-build-zip}.ts(x)` và test; `frontend/src/features/editor/import-export/{zip-selection.ts,zip-dialog.tsx}` và test.
  - Sửa: `worker-protocol.ts(+test)`, `code-generator.worker.ts(+test)`, `state/create-editor-store.ts(+test)`, `import-export/export-menu.tsx(+test)`, `import-export/use-export-actions.ts`, `lib/i18n/locales/{en,vi}/import-export.ts` (thêm `zip.filesOnly`).
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` → `RESULT: PASS` (typecheck, lint, test 5233 test, prettier); `secret-scan.sh` → `SECRET-SCAN: CLEAN`. Cần build `@schemaforge/core` và `@schemaforge/api-contract` trong worktree trước (dist chưa có).
  - Quy tắc `naming-convention` đòi tiền tố `is/has` cho boolean, nhưng plan cố định tên `json`, `png`... và `includeJson`: dùng `eslint-disable` có lý do quanh `ZipSelection` và `includeJson` (quyết định đáng chú ý).
  - `ZipDialog` nhận `returnFocusRef` (nút Export) vì mục menu đã bị gỡ khi hộp thoại đóng, focus mặc định rơi về `body`.
- **Quyết định**
  - `ZipSelection` giữ trong store (`zipSelection`, `setZipSelection`), không lưu khi tải lại (spec mục 11).
  - `selectAllZip(codeOptions)` nhận option của code panel để provider/dialect/format mới chọn khớp code panel; `clearZip()` bỏ chọn cả JSON.
  - PNG lưu không nén, SVG và mọi text nén mức 6 (spec mục 11: "văn bản nén mức 6; PNG lưu không nén"; plan ghi "ảnh không nén" chung, spec cụ thể hơn).
  - `useBuildZip` đọc store (document, zipSelection, codeOptions) và chụp ảnh tuần tự trên luồng chính; `build()` reject khi lỗi, hộp thoại `notify` `export.failed` (dùng lại key có sẵn), không log nội dung.
  - Drizzle chỉ có PostgreSQL và MySQL trong hộp thoại (SQL Server chưa hỗ trợ).
  - Hộp thoại ở lại mở sau khi tải để dòng tóm tắt hiện số diagnostic của lần tạo gần nhất; dòng tóm tắt là `role="status"` và hiện "Đang tạo…" trong lúc tạo (thông báo cho trình đọc màn hình).
  - Thêm key `zip.filesOnly_one/_other` (số file khi chưa tạo; key `zip.summary` có sẵn cần cả diagnostic).
  - Cảnh báo issue của hộp thoại không có nút "Mở issues" (hộp thoại modal đang che).
  - Review-3: menu Export: `aria-busy` trên nút, `notify` info `export.generatingImage` khi bắt đầu chụp, log `export.image-failed` chỉ với `errorName`; test axe menu hai theme; bỏ vòng lặp trong test.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: cần kiểm tra bằng trình duyệt thật: ZIP giải nén được bằng công cụ của hệ điều hành trên ba trình duyệt, ảnh PNG/SVG trong ZIP, focus trả về nút Export sau khi đóng hộp thoại, độ tương phản hộp thoại ở hai theme, đo thời gian ZIP với `createLargeSchema` (Task 32).
