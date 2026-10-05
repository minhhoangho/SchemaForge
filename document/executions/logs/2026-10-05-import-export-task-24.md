# Worker import và client

- Plan: [Task 24](../../plans/2026-10-03-import-export-plan.md) (mục "Task 24: Worker import và client")
- Spec: [import-export-design](../../specs/2026-09-15-import-export-design.md) (mục 2, 4, 12, 13, "Rủi ro")

## 2026-10-05 22:05 — frontend-engineer — Xong

- **Đã làm**
  - Tạo bảy module trong `frontend/src/lib/import-export/`: `import-protocol.ts` (kiểu, `isImportRequest`, thêm `isImportResponse`), `importer-loaders.ts` (một `import()` literal cho mỗi subpath), `handle-import-request.ts`, `importer.worker.ts`, `importer-client.ts`, `decode-import-file.ts`, `import-layout.ts`, kèm test cạnh file.
  - Tạo `frontend/public/third-party-notices.txt` từ `node_modules/.pnpm` theo phiên bản của lockfile.
  - Chế độ `new`: batch dựng trên `createEmptySchema(imported.name)`, nên tên từ nguồn được giữ. Chế độ `merge` mà `target === null` trả `crashed`.
- **File thay đổi**: các file trên, và `frontend/public/third-party-notices.txt`.
- **Kiểm tra**
  - RED: `test-file.sh frontend .../import-protocol.test.ts` fail vì chưa có module.
  - `.claude/scripts/verify.sh frontend --format --build`: `RESULT: PASS`; 5313 test pass; coverage toàn bộ 96.15% dòng.
  - Build check: sau `pnpm --filter @schemaforge/frontend build`, `grep -rl "dbmlv2" frontend/.next/static/chunks` KHÔNG in gì khi chưa có module nào import `importer-client.ts` (worker chưa được bundle). Với một import tạm vào `schema-list-screen.tsx` (đã hoàn tác bằng `git checkout`), grep in đúng một chunk: `.next/static/chunks/2esw3bid_-0js.js`, 15.0 MB, gzip -9 xấp xỉ 2.65 MB.
  - `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `schedule` của `createImporterClient` trả về hàm hủy hẹn giờ và bỏ `cancelSchedule`: tránh ép kiểu handle của `setTimeout` (Node trả object, trình duyệt trả số) mà không dùng `as`.
  - `dispose` cùng hàm với `cancel` (terminate worker, trả `cancelled` cho lần chạy đang chờ).
  - `run` khi đang có lần chạy dở thì hủy lần đó (trả `cancelled`) rồi chạy lần mới; worker nhàn rỗi được dùng lại.
  - `onerror` và `onmessageerror` đều terminate và bỏ worker rồi trả `crashed` (như bản sửa của `use-build-zip.ts`).
  - Thêm `isImportResponse` để client không dùng `as` khi đọc message.
  - `antlr4` không có file license trong gói: dùng văn bản BSD-3-Clause chuẩn của ANTLR 4, ghi rõ trong file; các gói khác chép nguyên từ `node_modules`.
  - `IMPORT_LAYOUT_METRICS`: `tableWidth: 320`, `headerHeight: 37`, `columnRowHeight: 28`, `gap: 80`. Giá trị suy ra từ class của `TableNode`/`ColumnRow` (header `h-9` = 36px + viền thẻ 1px; hàng `h-7` = 28px), không đo trên trình duyệt; theme không đổi kích thước.
- **Việc còn lại**: không có trong phạm vi task. Cần cho task sau: xem phần ghi chú.
- **Ghi chú cho người tiếp theo**
  - Task 32 phải đo lại `headerHeight` và `columnRowHeight` trên trình duyệt (cả hai theme).
  - Chunk của parser DBML rất lớn (15.0 MB thô, khoảng 2.65 MB gzip). `@dbml/core` adapter dùng chung cho cả importer SQL và DBML nên cả hai tải chunk này; Prisma và JSON thì không. Cần quyết định ở mức spec/orchestrator (spec mục "Rủi ro" về kích thước bundle); hộp thoại (Task 25) nên chỉ tạo worker khi mở và có trạng thái chờ.
  - Chunk chỉ xuất hiện khi có module import `importer-client.ts` (Task 25), nên cần chạy lại grep `dbmlv2` sau Task 25.
  - Kiểm tra tay: chưa có (không chạm giao diện).
