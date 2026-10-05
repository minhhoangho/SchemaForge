# Tải file và nút "Tải file" trong code panel

- Plan: `document/plans/2026-10-03-import-export-plan.md`, Task 23
- Spec: `document/specs/2026-09-15-import-export-design.md`, mục 9

## 2026-10-05 — frontend-engineer — Xong (còn 1 dòng eslint.config.mjs chờ devops-engineer)

- **Đã làm**
  - `downloadBlob` (`OBJECT_URL_REVOKE_DELAY_MS = 10_000`, môi trường tiêm được), `toDownloadBaseName`, `download-file-names.ts` (MIME, tên file code, JSON, ảnh, ZIP).
  - `CodeView` thêm nút "Tải file" (`importExport:download.file`) cạnh Copy, disable khi `isBusy`; `CodePanel` truyền `schemaName` và `request`.
  - Chuyển `ai-sample-data-card.tsx` sang `downloadBlob` (hành vi giữ nguyên, nhưng object URL nay được thu hồi sau 10 giây).
- **File thay đổi**: xem danh sách trong báo cáo; mọi file nằm trong `frontend/src/lib/download/`, `frontend/src/lib/import-export/`, `frontend/src/features/editor/code-generator/`, `ai-sample-data-card(.test).tsx`.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --build --format` PASS (5175 test); `pnpm lint` ở root PASS; `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Key i18n nằm trong `import-export.ts` (namespace `importExport`), dùng key có sẵn `download.file`.
  - Test của `ai-sample-data-card` đổi sang fake timers vì `revokeObjectURL` giờ chạy sau 10 giây.
  - Test "focusable code region" của `CodeView` thêm một lần `tab` vì có thêm nút.
- **Việc còn lại**
  - [ ] Hook `config-protection` chặn sửa `eslint.config.mjs`: devops-engineer xóa mục `frontend/src/features/editor/components/ai-panel/ai-sample-data-card.tsx` (và comment "Temporary") khỏi `files` của khối miễn trừ `URL.createObjectURL` (khoảng dòng 451-456), giữ `download-blob.ts`.
- **Ghi chú cho người tiếp theo**: kiểm tra thật trên trình duyệt (Safari/Chrome) việc tải file qua `a[download]` với CSP.
