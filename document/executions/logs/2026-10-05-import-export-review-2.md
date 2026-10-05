# Review lần sửa spec và plan phần 7 theo probe Task 8 (lần 2)

Không thuộc task nào trong plan. `project-reviewer` (chỉ đọc) review thay đổi chưa commit của [lần sửa spec và plan](2026-10-05-import-export-spec-amendment-1.md) trong [spec phần 7](../../specs/2026-09-15-import-export-design.md), [plan phần 7](../../plans/2026-10-03-import-export-plan.md), `roadmap.md` và [log review lần 1](2026-10-05-import-export-review-1.md). Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của reviewer và quyết định của orchestrator.

## 2026-10-05 19:55 — project-reviewer — Xong

- **Đã làm**: review thay đổi tài liệu theo `CLAUDE.md`, `.claude/rules/`, spec và plan phần 7, đối chiếu với code đã merge trong `packages/core`. Kết luận: cần sửa (sửa chữ nhỏ).
  - Chặn (1): MySQL `ENUM(…)` không có thứ tự ưu tiên rõ. Spec mục 5 và Task 12 ("Kiểu") cho mọi cột tìm được trong `CREATE TABLE` qua `mapSqlType`, mà `mapSqlType` đã merge ánh xạ `ENUM('a','b')` thành `text` kèm `type-not-supported` (ghim trong `sql-type-mapping.test.ts`), trái quy tắc enum `<bảng>_<cột>`.
  - Nên sửa (2): ngữ pháp `UNIQUE` cấp bảng trong Task 11 thiếu `CLUSTERED | NONCLUSTERED` (dạng SSMS ghi).
  - Nên sửa (3): chưa nói quy tắc index lọc `IS NOT NULL` của SQL Server xét trước quy tắc ghép với `CREATE INDEX`; chưa nói so tên với `buildConstraintName` là so chính xác và tên có hậu tố của bộ cấp tên thì sao.
  - Nên sửa (4): `hasDescending` bỏ sót tùy chọn khác của phần tử cột (`NULLS FIRST | LAST`, opclass, `COLLATE`, độ dài tiền tố MySQL) và `INCLUDE (…)` của SQL Server; chưa nói `WITH (…)`, `ON [filegroup]` xử lý thế nào.
  - Góp ý nhỏ (5): chữ "Task 9 đã merge", "Task 1 đã merge" trong plan là trạng thái; spec thiếu `CHARSET` cạnh `CHARACTER SET`; Task 11 chưa nói cách xử lý khi `classify-statement.ts` vượt khoảng 300 dòng.
  - Góp ý nhỏ (6): câu hỏi còn mở về MySQL `ALTER TABLE … ADD INDEX | KEY` và PostgreSQL `ADD CONSTRAINT … UNIQUE` nhiều cột.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - `pnpm exec prettier --check` trên các file đã đổi: đạt.
  - `.claude/scripts/secret-scan.sh`: CLEAN.
  - Không chạy kiểm tra code (thay đổi chỉ có tài liệu).
- **Quyết định** (orchestrator)
  - (1) MySQL `ENUM(…)` nội tuyến (`<bảng>_<cột>_enum` có trong `CoreDatabase.enums`, `rawType` bắt đầu bằng `ENUM(`) thành enum `<bảng>_<cột>` trước khi gọi `mapSqlType`; không sửa `mapSqlType`; Task 12 thêm test trong `sql-draft.test.ts`.
  - (2) Ngữ pháp `[CONSTRAINT n] UNIQUE [KEY | INDEX] [CLUSTERED | NONCLUSTERED] [n] (…)`, thêm trường hợp SSMS vào test.
  - (3) Quy tắc index lọc SQL Server xét trước; so tên chính xác; tên có hậu tố của `allocateConstraintNames` (`t_c_key_2`) import thành index của người dùng, ghi vào hạn chế đã biết.
  - (4) `hasDroppedElementOption` thay `hasDescending` (`DESC`, `NULLS FIRST | LAST`, opclass, `COLLATE` của phần tử, độ dài tiền tố MySQL), thêm `hasInclude`; cả hai báo `index-option-dropped`; bỏ qua `WITH (…)`, `ON [filegroup]` không diagnostic; độ dài tiền tố đọc giống nhau ở hai reader (giữ cột, bỏ độ dài kèm `index-option-dropped`).
  - (5) Sửa cả ba góp ý; các quy tắc `ALTER TABLE` có thể chuyển sang file mới cùng thư mục nếu `classify-statement.ts` vượt khoảng 300 dòng.
  - (6) Chấp nhận như đã viết: hai dạng đó giữ cho parser; Task 12 thử bằng fixture và dừng, báo lại nếu parser bỏ âm thầm.
- **Việc còn lại**: không. Mọi mục đã sửa ở lượt thứ ba của [log sửa spec và plan](2026-10-05-import-export-spec-amendment-1.md).
- **Ghi chú cho người tiếp theo**: không có.
