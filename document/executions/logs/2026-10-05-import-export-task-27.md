# Tải JSON ở màn hình danh sách

Plan: [Task 27](../../plans/2026-10-03-import-export-plan.md) — Spec: [import-export-design](../../specs/2026-09-15-import-export-design.md) (mục 12)

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**: thêm hook `useDownloadSchemaJson` (mở schema qua `repository.openSchema`, tải bằng `downloadBlob` + `serializeSchemaDocument`); thêm mục "Tải JSON" vào menu dòng có bản local (`guest`, `cached`), không có ở dòng không đọc được và `cloud-only`.
- **File thay đổi**:
  - `frontend/src/features/schema-list/hooks/use-download-schema-json.ts` (mới)
  - `frontend/src/features/schema-list/hooks/use-download-schema-json.test.tsx` (mới)
  - `frontend/src/features/schema-list/components/schema-list-row.tsx`
  - `frontend/src/features/schema-list/components/schema-list-row.test.tsx`
- **Kiểm tra**: `test-file.sh` hai file test mới/sửa: PASS. `verify.sh frontend --build --format`: xem báo cáo cuối.
- **Quyết định**
  - Hook không nhận tham số, lấy repository từ `useStorage()` (chữ ký theo plan); storage chưa sẵn sàng thì báo `importExport:download.failed`.
  - `DownloadJsonItem` là component riêng, chỉ render cho dòng local, nên dòng cloud/không đọc được không cần `StorageProvider`.
  - Lỗi lưu trữ: toast `storage:<code>` + `logger.error`, cùng cách với `use-schema-actions`.
  - Test được viết sau code (không có bước RED riêng); các test kiểm tra hành vi thật.
- **Ghi chú cho người tiếp theo**: test của `SchemaListRow` nay cần `auth: { storage }` khi dòng là local. `schema-list-screen.test.tsx` không sửa (đã có StorageProvider).
