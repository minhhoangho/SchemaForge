# i18n `importExport`, `importDiagnostics`

- Plan: [Task 22](../../plans/2026-10-03-import-export-plan.md)
- Spec: [import-export-design](../../specs/2026-09-15-import-export-design.md)

## 2026-10-05 19:05 — frontend-engineer — Xong
- **Đã làm**: viết test trước (RED: `import-export-messages.test.ts` fail vì chưa có namespace), rồi thêm hai namespace `importExport` và `importDiagnostics` bằng `vi` và `en`, đăng ký trong `resources.ts`. `importDiagnostics` có đúng 39 key, `satisfies Record<ImportDiagnosticCode, string>`, không có biến nội suy. `importExport` đúng cây key của Task 22; số nhiều theo `_one`/`_other` (vi giữ cả hai giá trị giống nhau).
- **File thay đổi**: `frontend/src/lib/i18n/locales/{en,vi}/import-export.ts`, `locales/{en,vi}/import-diagnostics.ts`, `import-export-messages.test.ts`, `resources.ts`, `resources.test.ts`.
- **Kiểm tra**: `verify.sh frontend --build --format`: typecheck PASS, lint PASS, build PASS; test: 20 fail ở lần chạy đầu và 3 fail ở lần hai, đều trong `editor-workspace.test.tsx` / `table-panel.test.tsx` (timeout khi tải nặng); chạy riêng bằng `test-file.sh` thì cả hai file PASS, cùng `import-export-messages.test.ts` và `resources.test.ts`. Prettier PASS sau khi `--write` hai file diagnostics. `secret-scan.sh`: CLEAN.
- **Quyết định**
  - `announceSuccess` không số nhiều (ba biến, không `count`); `announceFailure`, `zip.issueWarning`, `counts.*`, `*Heading`, `more`, `done` có `_one`/`_other`.
  - `provider-not-supported` chỉ nói provider không hỗ trợ hoặc thiếu datasource, không nêu kiểu thay thế (chưa xác minh hành vi importer).
  - Thông báo diagnostic mô tả sự việc ở dạng trung tính, không nêu tên phần tử (cột riêng ở Task 25).
  - Thuật ngữ vi theo namespace có sẵn: "Dialect", "Index", "Enum", "ghi chú", "quan hệ", "Tải ZIP".
  - `SSMS CHECK/NOCHECK`, `ALTER DATABASE … SET`, `ROLLBACK` bị bỏ qua im lặng: không thêm key.
- **Ghi chú cho người tiếp theo**: test kiểm tra coverage toàn bộ bị flaky timeout khi chạy cả bộ; xác minh bằng `test-file.sh`. Kiểm tra bằng mắt: câu chữ vi trong giao diện thật khi Task 25–28 dùng các key này.
