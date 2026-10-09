# Import dialog (Task 25)

- Plan: `document/plans/2026-10-03-import-export-plan.md` Task 25
- Spec: `document/specs/2026-09-15-import-export-design.md`

## 2026-10-09 10:50 — frontend-engineer (tiếp quản agent trước bị rate-limit) — Xong
- **Đã làm**: Rà soát phần agent trước để lại (hook, dialog, các bước, `importer-client` có `prepare`/`dispose`, fake client, i18n, test). Sửa 5 lỗi lint (bỏ `autoFocus`, tên boolean, `tabIndex` trên `<pre>`), chạy prettier.
- **Kiểm tra**: verify.sh frontend --format PASS; secret-scan CLEAN.

## 2026-10-09 11:40 — frontend-engineer — Xong (sửa theo review project-reviewer + ui-a11y-reviewer)
- **Đã làm**
  - BLOCKING: `use-import-dialog.ts` kiểm tra `runId` sau khi đọc file, không gọi `client.run` nếu đã đóng/huỷ/bị chặn. `importer-client.ts`: cờ `isDisposed`, sau `dispose` thì `prepare` không tạo worker và `run` trả `cancelled`; sửa comment cũ.
  - Nguồn rỗng sau trim -> lỗi `emptySource`; đổi input xoá lỗi nguồn; nút Analyze luôn bật, SQL thiếu dialect -> lỗi `dialectRequired` (role="alert") thay vì nút disabled.
  - Trạng thái analyzing + gợi ý loadingParser nằm trong `role="status"`; lỗi nguồn có `role="alert"`; dòng "đã chọn file" là `role="status"`; thông báo kết quả ghép từ các key số nhiều có sẵn.
  - Preview nhận focus khi vào (ô tên ở chế độ new, nút Import ở chế độ merge).
  - Tách `toNextState`, `FileSourceField`, `ImportModeField`, `FormatFields`, `SchemaNameField`, `IntroducedIssueList`, `pickChoice`; type props đặt tên `<Name>Props`; `ImportFileFormat` thay cho `string`.
  - Test: bỏ `TIMEOUT` cục bộ, đổi tên test escape, thêm test focus trả về opener, focus preview, alert, đánh dấu cột lỗi, race đọc file, dispose.
- **File thay đổi**: `frontend/src/components/import-dialog/*`, `frontend/src/testing/fake-importer-client.ts`, `frontend/src/lib/import-export/importer-client(.test).ts`, `frontend/src/lib/i18n/locales/{en,vi}/import-export.ts`.
- **Kiểm tra**: xem báo cáo cuối (verify.sh, secret-scan).
- **Quyết định** (đánh dấu * = đáng chú ý)
  - * Có sửa file của Task 24 (`importer-client.ts`: `isDisposed`, comment) và key i18n của Task 22 (`import-export.ts`): orchestrator đã duyệt vì spec mục 12 yêu cầu tạo worker khi mở dialog; thêm key `dialectRequired`, đổi `announceSuccess`.
  - * Không dùng được caret `^` + vùng cuộn có `tabIndex=0`: lint `jsx-a11y-x/no-noninteractive-tabindex` chặn, mà không được disable rule. Thay bằng `<mark>` (nền + gạch chân) trên ký tự ở cột lỗi, dòng được wrap. CẦN SỬA SPEC (spec mô tả caret).
  - * Analyze luôn bật (không disabled không lý do); lỗi hiện khi bấm.
  - * `ImportDialog` có prop `onReturnFocus?` (Radix chỉ trả focus cho DialogTrigger; cùng mẫu với `CreateSchemaDialog`). Chủ sở hữu phải truyền ở Task 28.
  - Hai dòng chữ hiển thị "Đang phân tích"/gợi ý parser để `aria-hidden` vì đã có trong vùng status.
  - Test cho lỗi race/dispose viết sau khi sửa code (không chứng minh RED riêng).
- **Việc còn lại** (kiểm tra thủ công, chưa làm)
  - [ ] Chọn file bằng bàn phím, kéo-thả file.
  - [ ] Huỷ khi đang phân tích, kiểm tra trình duyệt thật.
  - [ ] Tải chunk parser thật (~2.65 MB gzip) và trạng thái chờ.
  - [ ] Contrast `<mark>` và các text ở cả hai theme.
  - [ ] Focus trả về opener: phụ thuộc opener là `button` thường và Task 28 truyền `onReturnFocus`.
  - [ ] Task 28: gắn dialog, truyền `onReturnFocus`; cập nhật spec về `<mark>` thay caret.

## 2026-10-09 13:10 — frontend-engineer — Xong (code); kiểm tra thủ công hoãn sang Task 32
- **Đã làm**
  - Lỗi `dialectRequired` (thay đổi lúc 11:16/12:20): `aria-invalid` + `aria-describedby` chỉ trên trigger dialect, focus chuyển tới đó (hook `use-source-step-focus.ts`); ô file/textarea chỉ nhận cho các lỗi khác; `role="status"` của dòng file đã chọn giữ cố định.
  - `use-import-dialog.ts`: `.catch` khi đọc file lỗi (NotReadableError) -> `workerFailed` nếu run còn hiệu lực; kiểm tra đồng bộ (paste rỗng/quá lớn, thiếu file) chạy trước khi chuyển sang "analyzing".
  - `onReturnFocus` là prop BẮT BUỘC của `ImportDialog`: Task 26 VÀ Task 28 phải truyền.
  - `PasteSourceField`, `useSourceStepFocus` tách khỏi `ImportSourceStep`; `to-source-excerpt.ts` thay ký tự không an toàn bằng `REPLACEMENT_CHARACTER.repeat(match.length)` (giữ cột UTF-16), test ký tự tag ngoài BMP; tách test CRLF / quá cuối dòng.
  - Xoá file rỗng `2026-10-09-placeholder` (do nhầm lẫn khi append log).
- **File thay đổi**: trong `frontend/src/components/import-dialog/`: `use-import-dialog.ts`, `import-dialog.tsx`, `import-source-step.tsx`, `format-fields.tsx`, `file-source-field.tsx`, `paste-source-field.tsx` (mới), `use-source-step-focus.ts` (mới), `to-source-excerpt(.test).ts`, các test.
- **Kiểm tra**: kết quả verify.sh thật ghi trong báo cáo cuối (lần chạy nền trước đó bị tôi dừng giữa chừng nên không tính).
- **Quyết định**: Analyze luôn bật (đã được orchestrator duyệt).
- **Việc còn lại** (orchestrator hoãn sang Task 32)
  - [ ] Chọn file bằng bàn phím, kéo-thả; huỷ khi đang phân tích; tải chunk parser thật; contrast `<mark>` hai theme; focus trả về opener (opener phải là button thường).
  - [ ] Task 26 và Task 28 truyền `onReturnFocus`; spec cập nhật `<mark>` thay caret.
- **Ghi chú cho người tiếp theo**: dialog chưa được gắn ở đâu; `createClient` phải ổn định giữa các lần render.

## 2026-10-09 13:40 — frontend-engineer — Xong
- **Đã làm**: Đổi `caretColumn` -> `markColumn` (to-source-excerpt, source-excerpt, test); đổi tên/thêm test theo plan (analyze luôn bật + báo thiếu dialect, `<mark>` không có dòng caret, `onReturnFocus` được gọi khi đóng). `fake-importer-client.ts` giữ đuôi `.ts` (không có JSX).
- **Kiểm tra**: `verify.sh frontend --build --format` -> RESULT: PASS (kết quả cuối ghi trong báo cáo); secret-scan CLEAN.
