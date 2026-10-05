# Sửa spec và plan phần 7 theo probe Task 8 và review (lần 1)

Không thuộc task nào trong plan. Ghi các quyết định của orchestrator ngày 2026-10-05 vào [spec phần 7](../../specs/2026-09-15-import-export-design.md) và [plan phần 7](../../plans/2026-10-03-import-export-plan.md), dựa trên [log Task 8](2026-10-05-import-export-task-8.md) (bảng probe `@dbml/core` 10.2.0), log Task [1](2026-10-05-import-export-task-1.md), [4](2026-10-05-import-export-task-4.md), [6](2026-10-05-import-export-task-6.md), [7](2026-10-05-import-export-task-7.md), [9](2026-10-05-import-export-task-9.md), [10](2026-10-05-import-export-task-10.md) và [review lần 1](2026-10-05-import-export-review-1.md).

## 2026-10-05 19:25 — spec-writer — Xong

- **Đã làm**
  - Spec: thêm dòng "Sửa 2026-10-05 …" dưới dòng "Trạng thái"; ghi chú 10.2.0 ở bảng "Phiên bản"; mục 1 quy tắc bỏ cột lặp (quyết định C); mục 2 đổi tên bảng nhập trùng tên index của đích (D); mục 5 thêm mục con "Kết quả probe `@dbml/core` 10.2.0", sửa bảng phân loại (dòng parser đọc, `ROLLBACK`, `ALTER DATABASE … SET`, SQL Server `CHECK|NOCHECK CONSTRAINT`, dữ liệu `COPY … FROM stdin`, dòng mới "Parser bỏ âm thầm"), đoạn "Scanner đọc lại câu đã đưa cho parser", quy tắc unique, `DESC`, `WHERE`, cột tính toán, `ON UPDATE`, `COLLATE`, nguồn của tên kiểu và `UNSIGNED`, bảng giá trị mặc định (A, B, E); mục 7 kết quả probe DBML và thứ tự đầu mút của `ref:` trên cột; mục 8 `importJson` không dùng `ImportOptions`, BOM, `too-many-elements` với JSON thụt lề (G); mục 12 `TextDecoder` bỏ BOM; mục 15 dòng test SQL; "Cấu trúc thư mục" thêm hai file scanner mới; "Rủi ro" thay gạch đầu dòng hành vi chưa thử bằng kết quả probe và thêm "Hạn chế đã biết của importer SQL".
  - Plan: Task 2 (`DraftNote.text`, nguồn của mã 23, 33); Task 4 (quy tắc bỏ cột lặp, test thay test throw); Task 11 (viết lại: thêm `sql-column-definitions.ts`, `sql-index-definitions.ts`, sửa `classify-statement.ts`, chữ ký, test viết trước, commit mới); Task 12 (dùng thông tin scanner, ánh xạ mã diagnostic mới, fixture và test thêm); Task 16 (thứ tự đầu mút `ref:`); Task 17 (`ImportOperationBuild`); Task 19 (JSON gọn ở giới hạn phần tử); Task 22 (thông báo chung cho mọi định dạng); Task 23 (chuyển `ai-sample-data-card.tsx` sang `downloadBlob`, xóa miễn trừ lint); "Quy ước chung" (ngoại lệ `eslint.config.mjs` cho Task 23); "Điểm nóng" (file `importers/shared/*` thực tế, dòng mới `classify-statement.ts`, dòng `eslint.config.mjs`); bảng task (Task 0, 11, 23); Vấn đề 3, 7, thêm 20; Task 33 (bỏ Vấn đề 7 và quy tắc đổi tên index khỏi danh sách cần sửa).
  - `roadmap.md`: phần 7 từ `Xong spec` sang `Đang làm`.
  - Log review lần 1 viết từ báo cáo của `project-reviewer`.
- **File thay đổi**
  - `document/specs/2026-09-15-import-export-design.md`
  - `document/plans/2026-10-03-import-export-plan.md`
  - `document/roadmap.md`
  - `document/executions/logs/2026-10-05-import-export-review-1.md` (mới)
  - `document/executions/logs/2026-10-05-import-export-spec-amendment-1.md` (log này)
- **Kiểm tra**
  - `pnpm exec prettier --check` trên năm file: `All files formatted correctly`, thoát mã 0.
  - Kiểm tra bảng (mọi dòng của bảng có cùng số ô với dòng tiêu đề, `|` trong ô đã escape) bằng script Python tạm trong thư mục scratchpad của phiên: không có dòng lệch.
  - `git status --porcelain`: chỉ năm file trên.
  - Đối chiếu code hiện có trước khi ghi: `SqlToken` (`sql-lexer.ts`, có `text`, `value`, `start`, `depth`), `classifyAlterTable` (`classify-statement.ts`), `DraftNote.text` (`import-draft.ts`), `CoreIndex`, `CoreRef` (`dbml-core-adapter-types.ts`), `mapSqlDefault` chưa xử lý chuỗi `'1'`/`'0'`, `buildConstraintName` (`generators/shared/constraint-names.ts`), index lọc `IS NOT NULL` của SQL Server (`sql-ddl-model-indexes.ts`, `sql-ddl-model-tables.ts`), mục miễn trừ của `ai-sample-data-card.tsx` trong `eslint.config.mjs`.
- **Quyết định** (của spec-writer, trong khuôn khổ quyết định A–G của orchestrator; orchestrator có thể bác)
  - Scanner chia thành hai file: `sql-column-definitions.ts` (`readSqlTableDefinition`, `readAddedUniqueConstraint`) và `sql-index-definitions.ts` (`readSqlIndexDefinition`), để mỗi file dưới khoảng 300 dòng. `readAddedUniqueConstraint` được thêm vì `pg_dump` ghi ràng buộc unique bằng `ALTER TABLE ONLY … ADD CONSTRAINT … UNIQUE`.
  - Quy tắc unique cụ thể hóa để giữ điểm bất động và conformance: MySQL `UNIQUE KEY` một cột (dạng `mysqldump`) và index lọc `IS NOT NULL` một cột của SQL Server (dạng CG-01 ghi `isUnique` trên cột nullable) là `isUnique` khi không tên hoặc tên bằng `buildConstraintName(bảng, [cột], "key")`, ngược lại là index; `WHERE … IS NOT NULL` của index unique SQL Server không có `index-option-dropped`.
  - `CHARACTER SET`, `CHARSET` của cột xử lý như `COLLATE` (`type-parameter-dropped`), vì cũng bị bỏ âm thầm và không có trong model.
  - Cột tính toán SQL Server (không khai báo kiểu) thành `text` chỉ kèm `computed-column-not-supported`.
  - `ai-sample-data-card.tsx` giữ Blob không có kiểu MIME khi chuyển sang `downloadBlob`, để không đổi hành vi.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 11 là task lớn nhất của đợt 3 sau lần sửa này; nếu một phiên không đủ, orchestrator có thể tách `sql-column-definitions.ts`, `sql-index-definitions.ts` ra task riêng mà không đổi chữ ký.
  - Chưa probe: tùy chọn `INCLUDE`, `WITH (…)`, filegroup của index và `ALTER TABLE … ADD CONSTRAINT … UNIQUE` nhiều cột trên PostgreSQL; Task 12 thử bằng fixture (spec mục "Rủi ro").
  - Kiểm tra lại trước Task 12: quy tắc dùng `buildConstraintName` giả định tên ràng buộc unique của CG-01 không bị bộ cấp tên thêm hậu tố; nếu `allocateConstraintNames` đổi tên khi trùng, Task 12 dùng tên do bộ cấp tên trả về.

## 2026-10-05 19:40 — spec-writer — Xong

Sửa theo chỉnh của orchestrator: quy tắc chuỗi MySQL `'1'`/`'0'` trên cột boolean đã có trong `sql-default-mapping.ts` (task sửa sau review lần 1, merge `f277a86`, [log](2026-10-05-import-export-review-1-fixes.md)); Task 16 đang chạy và không phụ thuộc Task 11.

- **Đã làm**
  - Plan: bỏ `sql-default-mapping.ts`, test của nó và quy tắc `'1'`/`'0'` khỏi Task 11 (mục tiêu, file sở hữu, hành vi, test viết trước, kiểm tra) và khỏi dòng Task 11 của bảng task; trả phụ thuộc Task 16 về `4, 5, 8, 10` (thân task và bảng task); dòng "Điểm nóng" `importers/shared/*` ghi quy tắc đó đã sửa trong task sửa sau review, không task nào khác sửa file; Vấn đề 7 và 20 dẫn tới log sửa sau review.
  - Spec mục 2: dẫn tới log sửa sau review cho quy tắc đổi tên bảng trùng tên index.
  - Log review lần 1: mục 1, 2, 4 ghi đã sửa (merge `f277a86`).
  - Đã kiểm `sql-default-mapping.ts` hiện có quy tắc MySQL (comment "mysqldump quotes them ('1', '0')").
- **File thay đổi**: `document/plans/2026-10-03-import-export-plan.md`, `document/specs/2026-09-15-import-export-design.md`, `document/executions/logs/2026-10-05-import-export-review-1.md`, log này.
- **Kiểm tra**: `pnpm exec prettier --check` trên năm file thoát mã 0; script kiểm bảng không có dòng lệch; `git status --porcelain` chỉ năm file của lần sửa.
- **Quyết định**: Task 11 vẫn là một task với hai file đọc mới (orchestrator chấp nhận các quyết định của lượt trước).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: mục "Ghi chú" của lượt trước về khả năng tách Task 11 không còn áp dụng; orchestrator giữ một task.

## 2026-10-05 20:00 — spec-writer — Xong

Sửa theo [review lần 2](2026-10-05-import-export-review-2.md) và quyết định của orchestrator.

- **Đã làm**
  - Spec mục 5: MySQL `ENUM(…)` nội tuyến xét trước `mapSqlType` (đoạn "Nguồn của tên kiểu", gạch đầu dòng CHECK); `CHARSET` cạnh `CHARACTER SET`; ngữ pháp `UNIQUE … [CLUSTERED | NONCLUSTERED]`; quy tắc index lọc SQL Server xét trước quy tắc ghép `CREATE INDEX`, so tên `buildConstraintName` chính xác; tùy chọn phần tử cột (`DESC`, `NULLS FIRST | LAST`, opclass, `COLLATE`, độ dài tiền tố MySQL giữ cột) và `INCLUDE (…)` báo `index-option-dropped`, `WITH (…)`, `ON [filegroup]` bỏ qua; dòng test SQL ở mục 15. Mục "Rủi ro": câu chưa probe viết lại (MySQL `ADD INDEX | KEY`, PostgreSQL `ADD CONSTRAINT … UNIQUE` nhiều cột giữ cho parser, Task 12 dừng và báo nếu bị bỏ), hạn chế đã biết (4) cho tên có hậu tố `t_c_key_2`.
  - Plan: Task 2 nguồn của mã 33; bảng task dòng 11; Task 11 (ghi chú tách `classify-statement.ts` khi quá khoảng 300 dòng, bỏ "Task 9 đã merge", ngữ pháp `UNIQUE` có `CLUSTERED | NONCLUSTERED` và bỏ qua `WITH`, `ON`, `SqlUniqueConstraint.hasDroppedElementOption`, `SqlIndexDefinition.hasDroppedElementOption` thay `hasDescending`, thêm `hasInclude`, test thêm trường hợp SSMS, tùy chọn phần tử, `INCLUDE`, `WITH`); Task 12 (quy tắc `ENUM` trước `mapSqlType`, thứ tự ưu tiên SQL Server, so tên chính xác, tùy chọn index mới, test mới); Task 23 bỏ "Task 1 đã merge"; Vấn đề 20.
  - Tạo log review lần 2.
- **File thay đổi**: `document/specs/2026-09-15-import-export-design.md`, `document/plans/2026-10-03-import-export-plan.md`, `document/executions/logs/2026-10-05-import-export-review-2.md` (mới), log này.
- **Kiểm tra**: `pnpm exec prettier --check` trên sáu file (spec, plan, roadmap, ba log) thoát mã 0; script kiểm bảng không có dòng lệch; `git status --porcelain` chỉ sáu file đó.
- **Quyết định**: `SqlUniqueConstraint` cũng có `hasDroppedElementOption`, để độ dài tiền tố MySQL và `DESC` trong `UNIQUE (…)` được đọc giống `CREATE INDEX` (quyết định 4 của orchestrator).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: không có.
