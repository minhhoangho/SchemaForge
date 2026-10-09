# Sửa spec phần 7 theo quyết định về literal `timestamptz` của MySQL (lần 4)

Không thuộc task nào trong plan. Ghi quyết định (b) của orchestrator ngày 2026-10-09 cho câu hỏi còn mở của [lần 3](2026-10-08-import-export-spec-amendment-3.md), vào [spec phần 7](../../specs/2026-09-15-import-export-design.md). Plan không đổi.

## 2026-10-09 10:00 — spec-writer — Xong

- **Đã làm**
  - Spec: thêm dòng "Sửa 2026-10-09 lần 4 …" dưới dòng sửa lần 3, dẫn tới log này.
  - Spec mục 5, "Giá trị mặc định": dòng bảng cho chuỗi thời điểm thêm câu nói literal không có độ lệch trên cột `timestamptz` (dạng MySQL `TIMESTAMP(6)`) không bị đoán múi giờ, vẫn `column-default-invalid`, dẫn tới hạn chế (7).
  - Spec mục 15: danh sách chuẩn hóa dạng lưu thêm ba bước: (i) literal `timestamp`, `timestamptz` về 6 chữ số phân số giây ở cả hai phía; (ii) `timestamptz` của PostgreSQL về UTC `+00:00` ở cả hai phía (`pg_dump` ghi `+07:00` thành `+00`); (iii) trên MySQL, bỏ literal mặc định của mọi cột `timestamptz` khỏi cả hai phía, chọn theo kiểu cột, cột vẫn được so. Đoạn cuối mục nói rõ đây là khác biệt dạng lưu cộng một hạn chế đã công bố, không phải lỗi importer bị che.
  - Spec "Rủi ro": thêm hạn chế đã biết (7) vào danh sách hạn chế của importer SQL (cùng kiểu đánh số, kèm ngày và lý do); xóa gạch đầu dòng "Literal `timestamptz` của MySQL không có độ lệch … chưa quyết định".
- **File thay đổi**
  - `document/specs/2026-09-15-import-export-design.md`
  - `document/executions/logs/2026-10-09-import-export-spec-amendment-4.md` (log này)
- **Kiểm tra**
  - `pnpm exec prettier --check` trên hai file trên: `All matched files use Prettier code style!`. Số ô của các dòng bảng có `timestamptz` khớp cột của bảng (kiểm bằng script Python tạm).
  - Không đụng plan, code, test.
- **Quyết định**
  - Quyết định (b) là của orchestrator. Spec-writer chốt chi tiết: (1) bước (iii) chọn cột theo kiểu `timestamptz` của model chứ không theo tên cột (theo prompt); (2) hạn chế (7) ghi hậu quả cho người dùng: cột vẫn import đúng kiểu, chỉ mất giá trị mặc định kèm issue ở bước xem trước, `now()`/`CURRENT_TIMESTAMP` không bị ảnh hưởng; (3) lý do không đoán `+00:00`: dump không ghi múi giờ phiên đã tạo dữ liệu, nên đoán có thể đổi thời điểm âm thầm.
- **Việc còn lại**: không với lần sửa spec này. Khi triển khai bước chuẩn hóa ở `packages/codegen-conformance/src/support/database-dump.ts` (`normalizeDatabaseForms`), core-engineer/test-engineer thêm ba bước trên, mỗi bước một comment nêu khác biệt quan sát được.
- **Ghi chú cho người tiếp theo**
  - Worktree `agent-a7720f9a3008f8740` có thay đổi frontend (i18n import-export, `importer-client`) không phải do lần sửa này; không đụng tới.

## 2026-10-09 14:30 — spec-writer — Xong

Mở rộng cùng lần sửa 4 theo yêu cầu của orchestrator (không tạo lần 5): trích đoạn nguồn ở hộp thoại import đổi cách nổi bật cột lỗi. Lý do: dòng `^` lệch ngay khi dòng nguồn xuống dòng, còn vùng cuộn ngang phải nhận focus bàn phím thì không qua được quy tắc lint của repo.

- **Đã làm**
  - Spec mục 12, bước 3 "Không đọc được": bỏ "dấu `^` dưới cột lỗi"; thêm gạch đầu dòng "Cách hiện trích đoạn": `<pre>` text, dòng dài xuống dòng (`pre-wrap`, `overflow-wrap: anywhere`, không cuộn ngang), ký tự ở cột lỗi trong `<mark>` (nền và gạch chân bằng token theme), vị trí cho công nghệ hỗ trợ là chữ "Dòng X, cột Y" có sẵn trong dòng lỗi (namespace `importExport`).
  - Spec mục 12: đoạn "Đóng hộp thoại" mới trước "Bước 2": `ImportDialog` nhận callback tùy chọn `onReturnFocus` để nơi mở (không nhất thiết là `DialogTrigger`) lấy lại focus khi đóng; Task 28 truyền ở hai điểm vào.
  - Spec mục "Kiểm thử" (dòng component) và "Tiêu chí hoàn thành" (file không đọc được): thêm `<mark>`, không có dòng `^`, `onReturnFocus` được gọi khi đóng.
  - Dòng "Sửa 2026-10-09 lần 4" ở đầu spec: thêm câu về thay đổi này.
  - Grep `^`/caret trong spec: hết chỗ nào còn nhắc dấu `^` ngoài các câu mô tả việc bỏ nó.
- **File thay đổi**
  - `document/specs/2026-09-15-import-export-design.md`
  - `document/executions/logs/2026-10-09-import-export-spec-amendment-4.md` (log này)
- **Kiểm tra**: `pnpm exec prettier --check` trên hai file: xem kết quả trong báo cáo cuối.
- **Quyết định**: giữ chữ "Dòng X, cột Y" là cách duy nhất cho công nghệ hỗ trợ (không thêm `aria-label` riêng lên `<mark>`) vì thông tin đã nằm cùng dòng lỗi dưới dạng text.
- **Việc còn lại**: plan `document/plans/2026-10-03-import-export-plan.md` (Task 28, dòng ~1106-1114) vẫn ghi `toSourceExcerpt` trả `caretColumn` và `SourceExcerpt` hiện dấu `^`; orchestrator cần dispatch sửa plan (đổi sang `<mark>`, thêm `onReturnFocus`) vì lần này không được đụng plan.
- **Ghi chú cho người tiếp theo**: không đụng thay đổi frontend trong worktree.

## 2026-10-09 16:10 — spec-writer — Xong

Mở rộng cùng lần sửa 4 theo ba quyết định tiếp theo của orchestrator (không tạo lần 5), kèm sửa plan. Plan được sửa ở lần này (nội dung, không tiến độ).

- **Đã làm**
  - Spec mục 12, bước 1: nút "Phân tích" luôn bật (bỏ "bị disable tới khi chọn dialect"). SQL chưa chọn dialect mà bấm thì lỗi `dialectRequired` ("Hãy chọn phương ngữ SQL trước.", `role="alert"`) gắn vào ô dialect bằng `aria-invalid`, `aria-describedby`, focus chuyển tới ô dialect. Lý do: nút disabled không cho công nghệ hỗ trợ lý do.
  - Spec mục 12, "Đóng hộp thoại": sửa "tùy chọn" thành `onReturnFocus` bắt buộc (cùng `CreateSchemaDialog`, `RenameSchemaDialog`, `DeleteSchemaDialog`); bỏ câu "không truyền thì dùng hành vi mặc định"; hai điểm vào là Task 26 (`ImportSchemaButton`) và Task 28 (`EditorImportButton`), không còn ghi "Task 28 truyền ở hai điểm vào".
  - Spec mục 12, bước 2: worker tạo khi hộp thoại mở (`prepare`); kiểm tra ô dán rỗng, thiếu file, độ dài, dialect chạy đồng bộ trước trạng thái "đang phân tích"; file đọc lỗi (`NotReadableError`) về bước 1 với `workerFailed`.
  - Spec: dòng "Sửa 2026-10-09 lần 4" ở đầu đổi "tùy chọn" thành "bắt buộc" và thêm câu về nút "Phân tích" luôn bật; dòng test component thêm ca `dialectRequired` và `workerFailed`.
  - Plan Task 22 (key i18n): thêm `dialectRequired` vào `import.errors`.
  - Plan Task 25: prop `onReturnFocus` bắt buộc; nút "Phân tích" luôn bật + `dialectRequired`; kiểm tra đồng bộ trước `analyzing`, `workerFailed` cho file đọc lỗi; `prepare` khi mở; trích đoạn dùng `<mark>` (đổi `caretColumn` thành `markColumn`, bỏ dòng `^`); danh sách file sở hữu thêm `importer-client.ts` (+ test, thêm `prepare` và `dispose` bền) và `frontend/src/testing/fake-importer-client.tsx`; test: đổi `requires a dialect for sql before analyzing` thành `keeps the analyze button enabled and reports a missing dialect`, đổi tên `returns the line of the location with the caret column` thành `... with the mark column`, thêm ca `workerFailed`, kiểm tra rỗng đồng bộ, `<mark>`, `onReturnFocus`, `prepare`.
  - Plan Task 26 và Task 28: nút giữ ref và truyền `onReturnFocus`; test `returns focus to the import button when the dialog closes` cho cả hai nút.
- **File thay đổi**
  - `document/specs/2026-09-15-import-export-design.md`
  - `document/plans/2026-10-03-import-export-plan.md`
  - `document/executions/logs/2026-10-09-import-export-spec-amendment-4.md` (log này)
- **Kiểm tra**: `pnpm exec prettier --check` trên ba file: xem báo cáo cuối.
- **Quyết định**
  - `toSourceExcerpt` thuộc Task 25, không phải Task 28 (Task 28 chỉ có `EditorImportButton`, `computeMergeOrigin`, `useMergeImport`); sửa ở Task 25 và thêm `onReturnFocus` cho Task 28.
  - Tên trường trả về đổi `caretColumn` thành `markColumn` cho khớp cách hiện mới.
- **Việc còn lại**
  - [ ] Code Task 25 đang làm trong worktree vẫn dùng tên `caretColumn` (`frontend/src/components/import-dialog/to-source-excerpt.ts`, `source-excerpt.tsx`, `to-source-excerpt.test.ts`) và test `returns the line of the location with the caret column`; frontend-engineer đổi theo `markColumn` và tên test mới. Đồng thời `ImportDialog` phải có `onReturnFocus` bắt buộc.
- **Ghi chú cho người tiếp theo**: không đụng thay đổi frontend trong worktree.
