# Task 0: chốt 12 vấn đề phát hiện khi lập plan code generators

Plan: [2026-09-15-code-generators-plan.md](../../plans/2026-09-15-code-generators-plan.md), mục "Vấn đề phát hiện khi lập plan". Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md).

## 2026-10-02 — spec-writer — Xong

- **Đã làm**
  - Ghi cách xử lý vấn đề 1–12 (quyết định của orchestrator ngày 2026-10-02) vào đúng mục của spec phần 6, giữ và hoàn thiện các sửa chưa commit sẵn có cho vấn đề 1, 2, 4, 6.
  - Thêm mục cuối `## Quyết định bổ sung 2026-10-02` (bảng số vấn đề → quyết định → mục ghi) và đoạn "Ảnh hưởng tới phần 2"; dòng trạng thái ở đầu spec trỏ tới mục này.
  - Mục 2: hai issue mới của phần 2 `table-columns-empty` (`['tables', id, 'columnIds']`) và `index-name-conflicts-table` (`['indexes', id, 'name']`, so bằng `toNameKey`).
  - Mục 3: quy tắc cắt giây lẻ về 7 chữ số trong hàm literal SQL Server, không diagnostic, không đổi validation phần 2.
  - Mục 4: câu mở đầu danh mục ghi đúng 17 mã và vị trí của `comment-truncated`; hợp đồng `path` cho comment; đoạn "Độ dài khóa trên MySQL" (cách tính byte) và "Cắt comment".
  - Mục 5: `NameComparison`, `toComparisonKey`, `createNameAllocator({ reserved, comparison })`, `formatPropertyKey` và quy tắc `__proto__` / `Object.fromEntries`; tên ràng buộc so `caseAndAccentInsensitive` ở mọi dialect; `đ` → `d` tùy kết quả probe.
  - CG-08: mã `SeedIssue` không export ở entry chính, không có namespace i18n trong phần 6.
  - Mục 7: conformance chạy local qua Docker, không có job CI; helper thay kiểu custom (`inet`, `YEAR`, `money`); probe trước khi viết generator; lý do chọn Testcontainers viết lại không dựa vào CI.
  - Mục 10, Tiêu chí, Phạm vi, Rủi ro, Câu hỏi đã trả lời #4: bỏ cách nói conformance chạy ở CI, thêm fixture, tiêu chí probe và tiêu chí hai issue phần 2, thêm điểm probe MySQL, SQL Server.
- **File thay đổi**
  - `document/specs/2026-09-14-code-generators-design.md`
  - `document/executions/logs/2026-10-02-code-generators-task-0.md`
- **Kiểm tra**
  - Script Python kiểm số cột của mọi bảng Markdown trong spec: `ok`.
  - `grep '\bCI\b'` trên spec: chỉ còn câu nói không có job CI, GitHub Actions đã bỏ, và câu hỏi gốc ở "Câu hỏi đã trả lời" #4 (giữ nguyên văn câu hỏi, câu trả lời đã sửa).
  - Đếm danh mục mục 4: 17 mã. `ISSUE_CODES` trong `packages/core/src/validation/issue-codes.ts` có 25 mã (spec ghi 25 → 27).
- **Quyết định**
  - Cách tính byte khóa MySQL: `CHAR(n)`/`VARCHAR(n)` (kể cả `uuid` = `CHAR(36)`) tính `4 × n`, kiểu khác tính 32 byte (cận trên, `DECIMAL(65, 30)` lưu 30 byte), custom tính 0. Lý do: quy tắc đơn giản, ước lượng dư chỉ ảnh hưởng khóa sát ngưỡng.
  - Cắt giây lẻ SQL Server là cắt chứ không làm tròn. Lý do: làm tròn có thể nhớ sang giây, phút, ngày; phần bỏ đi dưới độ chính xác 100 ns nên coi là ánh xạ tương đương.
  - Comment cắt theo đơn vị của đích: MySQL theo ký tự, SQL Server theo code unit UTF-16. Lý do: khớp cách mỗi database đếm giới hạn.
  - Conformance là cổng chặn của task generator: task thêm hoặc sửa generator chạy `pnpm test:conformance` của đích đó trước khi báo xong, orchestrator chạy lại khi xác minh; không thuộc lệnh mọi commit phải chạy. Lý do: không còn CI bắt lỗi sau khi push.
  - Phương án bị loại cho Testcontainers đổi từ `services` của GitHub Actions sang Docker Compose khởi động sẵn. Lý do: CI đã bỏ; Compose cổng cố định dễ trùng container Postgres 16 sẵn có trên máy dev.
  - Fixture không có enum dài hơn 4000 code unit vì giá trị enum tối đa 63 byte theo phần 2; diagnostic này và các trường hợp chỉ có khi schema còn issue được test bằng tài liệu dựng riêng.
  - `suggestIndexName` nên tránh cả tên bảng: ghi là đề xuất cho task phần 2, không phải yêu cầu của spec.
- **Ghi chú cho người tiếp theo**
  - Plan dòng 104 (bảng "Điểm nóng", `GENERATOR_DIAGNOSTIC_CODES`) còn ghi "16 mã"; cần sửa thành 17 trong plan (không thuộc phạm vi task này).
  - Spec và plan phần 2 chưa ghi hai issue mới; mục "Quyết định bổ sung 2026-10-02" của spec phần 6 là nguồn cho tới khi một task sau cập nhật docs phần 2.
  - `architecture.md` và `roadmap.md` không đổi trong task này.

## 2026-10-02 — spec-writer — Xong

- **Đã làm**: sửa spec theo 9 điểm needs-fix của project-reviewer, mỗi điểm là quyết định của orchestrator, ghi ở bảng "Sửa sau review ngày 2026-10-02" (R1–R9) trong mục `## Quyết định bổ sung 2026-10-02`.
  - R1: SQL Server từ chối (Msg 1944) khóa có phần cố định quá 900 byte (khóa chính) hoặc 1700 byte (unique, index). Đã sửa dòng `key-column-type-narrowed`, `key-column-type-not-indexable` trong danh mục, thêm đoạn "Độ dài khóa trên SQL Server", thêm dòng ma trận, sửa bullet SQL Server ở mục Rủi ro (probe khóa chính `nchar(451)`, unique `nchar(851)`) và thêm fixture ở mục 10 (khóa chính `char(500)`, unique `char(900)`).
  - R2: MySQL `char`/`varchar` vượt giới hạn trong khóa thành thẳng `VARCHAR(768)` kèm hai diagnostic, có ví dụ `varchar(20000)` trong unique (danh mục, đoạn MySQL, ma trận).
  - R3: viết lại cổng conformance ở mục 7.
  - R4: thêm `## Vấn đề với các spec đã duyệt` (3 dòng: phần 2 mục 8 với vị trí mã trong `ISSUE_CODES`, mục 7 dòng Index, mục 6, 9 và `suggestIndexName`), bỏ đoạn "Ảnh hưởng tới phần 2".
  - R5: mục 3 để hành vi giây lẻ của MySQL chờ probe, kèm phương án dự phòng; thêm probe vào mục Rủi ro.
  - R6: bỏ câu Prisma từ chối model không trường ở mục 2.
  - R7: dòng trạng thái giữ nguyên văn "conformance test chỉ chạy trong CI (mục 7)" kèm ghi chú đã thay ngày 2026-10-02.
  - R8: MySQL thêm `INDEX` thường `<bảng>_<cột>_idx` khi cột `AUTO_INCREMENT` mất khóa duy nhất (mục 4, mục 5 thêm hậu tố `idx` cho `buildConstraintName`, probe lỗi 1075).
  - R9: ghi giới hạn tên sequence identity `<bảng>_<cột>_seq` của PostgreSQL ở mục Rủi ro.
- **File thay đổi**: `document/specs/2026-09-14-code-generators-design.md`, `document/executions/logs/2026-10-02-code-generators-task-0.md`
- **Kiểm tra**: script kiểm số cột mọi bảng Markdown: ok; grep không còn "chỉ cảnh báo" cho khóa SQL Server ngoài bảng R1 và câu về cột `nvarchar`; anchor `#vấn-đề-với-các-spec-đã-duyệt` khớp heading mới.
- **Quyết định**
  - Cách tính phần cố định của khóa SQL Server: `nchar(n)` `2 × n` byte, `uniqueidentifier` 16, kiểu cố định khác 17 (cận trên `decimal(38)`), `nvarchar`, `varbinary`, custom 0. Lý do: đơn giản, cùng kiểu ước lượng dư với MySQL.
  - Index thay thế trên cột `AUTO_INCREMENT` lấy tên `<bảng>_<cột>_idx` qua allocator tên ràng buộc (thêm hậu tố `idx`), không có diagnostic riêng. Lý do: diagnostic của ràng buộc bị bỏ đã báo; tên đi qua allocator nên không trùng.
  - `table-columns-empty` đặt sau `subject-area-name-duplicate`, trước `enum-values-empty`; `index-name-conflicts-table` ngay sau `index-name-duplicate`. Lý do: theo nhóm sẵn có của `ISSUE_CODES`.
- **Ghi chú cho người tiếp theo**
  - Plan cần theo các điểm R1, R2, R5, R8 (Task 8 probe, Task 9 hậu tố `idx`, Task 12, 15, 16, Task 4 fixture) và vẫn còn "16 mã" ở dòng `GENERATOR_DIAGNOSTIC_CODES` của bảng điểm nóng; plan không thuộc phạm vi task này.

## 2026-10-02 — spec-writer — Xong

- **Đã làm**: vòng sửa review thứ hai, ghi thành R10–R18 trong bảng "Sửa sau review ngày 2026-10-02"; dòng R1, R2, R5, R8 có ghi chú trỏ tới dòng sửa sau.
  - R10: hẹp `nchar` → `nvarchar` trên SQL Server lan bắc cầu theo `columnPairs` (Msg 1778, 1753), mỗi cột một `key-column-type-narrowed`, áp cho SQL Server SQL và Prisma `sqlserver`, ghi chú mất đệm khoảng trắng. Sửa đoạn "Độ dài khóa trên SQL Server", dòng danh mục, ma trận; fixture thêm quan hệ tham chiếu khóa chính `char(500)`; probe khóa ngoại `nchar(500)` → khóa chính `nvarchar(500)`.
  - R11: câu R2 chỉ áp cho cột vượt giới hạn có `n > 768`; `char(300)` → `VARCHAR(300)`.
  - R12: `caseAndAccentInsensitive` luôn đổi `đ`, `ø`, `ł`, `ħ` (theo `utf8mb3_general_ci`), chỉ cho định danh; sửa sketch mục 5, bullet mục 5, dòng `identifier-collision-renamed`, dòng vấn đề 7, probe MySQL.
  - R13: đoạn "Kích thước dòng trên MySQL", điều kiện mới trong dòng `type-parameter-out-of-range`, dòng ma trận, probe `id INT, v VARCHAR(16383)`, fixture.
  - R14: đoạn "Cột `AUTO_INCREMENT` trên MySQL" thay câu R8, dòng ma trận (Prisma `@@index(..., map: ...)`, Drizzle `index(...)`), probe khóa chính `(a, id)`, fixture.
  - R15: hàm literal MySQL luôn cắt về 6 chữ số giây lẻ; probe chỉ còn sanity.
  - R16: viết lại bullet sequence identity PostgreSQL (`…_seq1`).
  - R17: kiểm tra spec phần 2: bảng và enum đã chung một không gian tên (`table-name-duplicate`, `enum-name-duplicate`), nên không thêm quy tắc đổi tên hay `path` mới.
  - R18 (nit): bullet đầu mục Rủi ro theo cổng conformance mới.
- **File thay đổi**: `document/specs/2026-09-14-code-generators-design.md`, `document/executions/logs/2026-10-02-code-generators-task-0.md`
- **Kiểm tra**: script kiểm số cột mọi bảng Markdown: ok; grep không còn câu `đ` → `d` có điều kiện probe, không còn "MySQL được cho là cũng làm tròn".
- **Quyết định**
  - Kích thước dòng MySQL: cột `LONGTEXT`, `JSON`, `LONGBLOB` tính 12 byte (con trỏ), kiểu khác 32 byte, custom 0, bit null `⌈số cột nullable / 8⌉`; chọn cột đổi theo `n` lớn nhất, bằng nhau thì cột đứng trước theo `columnIds`; chỉ còn cột khóa mà vẫn vượt thì giữ nguyên (giới hạn đã chấp nhận). Lý do: cận trên đơn giản, thứ tự xác định.
  - Index `AUTO_INCREMENT` thêm vào không có diagnostic. Lý do: không mất gì của schema, là ánh xạ tương đương.
  - Ghi nit thành dòng R18 để bảng đủ mọi thay đổi.
- **Ghi chú cho người tiếp theo**
  - Plan cần theo: Task 6 (`toComparisonKey` luôn đổi `đ`, `ø`, `ł`, `ħ`; plan hiện ghi "không đổi `đ`"), Task 7 (cắt giây lẻ MySQL về 6), Task 8 (probe R10, R12, R13, R14, R15), Task 4 (fixture R10, R13, R14), Task 12, 15, 16, 17 (R10, R11, R13, R14). Plan không thuộc phạm vi task này.

## 2026-10-02 — spec-writer — Xong

- **Đã làm**: sửa theo review vòng 3 (accept with follow-ups): R13 đổi "không thuộc khóa" thành "không thuộc khóa chính, unique, index hay cặp cột quan hệ" ở đoạn kích thước dòng, dòng danh mục `type-parameter-out-of-range`, dòng ma trận, fixture mục 10 và dòng R13, kèm lý do MySQL không cho khóa ngoại trên `LONGTEXT`; mục 3 liệt kê output MySQL dùng phép cắt 6 chữ số (mặc định CG-01, `dbgenerated` Prisma `mysql`, mặc định Drizzle MySQL, seed SQL `mysql`) và lý do tương đương (dưới độ chính xác 1 µs), cập nhật dòng R15; dòng R5 ghi "(thay bằng R15)". Viết log review `document/executions/logs/2026-10-02-code-generators-spec-review.md`.
- **File thay đổi**: `document/specs/2026-09-14-code-generators-design.md`, `document/executions/logs/2026-10-02-code-generators-task-0.md`, `document/executions/logs/2026-10-02-code-generators-spec-review.md`
- **Kiểm tra**: `pnpm exec prettier --check` trên spec: qua; script kiểm số cột bảng Markdown: ok.
- **Quyết định**: không có quyết định mới ngoài các sửa được giao.
- **Ghi chú cho người tiếp theo**: spec sẵn sàng commit; plan vẫn cần theo R1–R18 (xem các entry trước).
