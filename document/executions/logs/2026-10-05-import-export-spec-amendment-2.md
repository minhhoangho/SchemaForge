# Sửa spec và plan phần 7 theo Task 12 và review 5 (lần 2)

Không thuộc task nào trong plan. Ghi các quyết định orchestrator lấy thay người dùng ngày 2026-10-05, trong lúc làm Task 12 và sau [review 5](2026-10-05-import-export-review-5.md) của `project-reviewer`, vào [spec phần 7](../../specs/2026-09-15-import-export-design.md) và [plan phần 7](../../plans/2026-10-03-import-export-plan.md). Lần sửa trước: [lần 1](2026-10-05-import-export-spec-amendment-1.md).

## 2026-10-05 22:03 — spec-writer — Xong

- **Đã làm**
  - Spec: thêm dòng "Sửa 2026-10-05 lần 2 …" dưới dòng sửa lần 1 (giữ dòng "Trạng thái").
  - Spec mục 5, bảng "Kết quả probe `@dbml/core` 10.2.0": thêm hai dòng (kiểu custom bị ngữ pháp MySQL, SQL Server từ chối; SQL Server `ALTER TABLE … WITH {CHECK|NOCHECK} ADD … CHECK` bị bỏ âm thầm).
  - Spec mục 5, "Luồng xử lý": sơ đồ ghi hai chỗ thay cùng độ dài; scanner tách dòng lệnh meta của psql thành câu kết thúc ở cuối dòng; bảng phân loại thêm SQL Server `ADD DEFAULT … FOR` vào dòng "Cấu trúc, scanner đọc" (qua `mapSqlDefault`, bỏ tên ràng buộc, đích không có thì `statement-not-supported`) và `\restrict`, `\unrestrict`, `\connect`, `\c` vào dòng bỏ qua không diagnostic (lệnh meta khác `statement-not-supported`); đoạn "Scanner đọc lại" thêm phần tử `[FULLTEXT | SPATIAL] KEY | INDEX` của MySQL; đoạn mới "Văn bản đưa cho parser" (thay kiểu custom bằng `INT` cùng độ dài với MySQL, SQL Server, kiểu ngắn hơn 3 ký tự giữ nguyên; bỏ `WITH CHECK|NOCHECK` của SQL Server).
  - Spec mục 5, "Namespace, tên, khóa, quan hệ": `namespace-dropped` chỉ khi nguồn ghi schema, MySQL mọi tên có tiền tố; index thêm quy tắc phần tử `KEY` của MySQL, index `AUTO_INCREMENT` chỉ bỏ khi không khóa nào khác bắt đầu bằng cột đó, `CREATE INDEX` trên bảng không có → `reference-not-found`; quan hệ thêm `ALTER TABLE … ADD` tới hoặc trên bảng không có → câu bị che, `reference-not-found` tại câu lệnh.
  - Spec "Rủi ro", "Hạn chế đã biết của importer SQL": thêm (5) `REFERENCES` nội tuyến tới phần tử không có và khóa ngoại tự tham chiếu một cột cho `syntax-error` tại 1:2; (6) CHECK `= ANY (ARRAY[…])` của `pg_dump` và chuỗi `OR` của SSMS thành `check-constraint-not-supported`. Hạn chế (4) về hậu tố của `allocateConstraintNames` giữ nguyên.
  - Plan Task 12 "Kiểm tra": thay grep literal `@dbml/core` bằng grep câu import `grep -rlE "from ['\"]@dbml/core|import\(['\"]@dbml/core" packages/core/dist --include='*.js'`.
  - Log [review 5](2026-10-05-import-export-review-5.md) và [rà soát bảo mật lần 1](2026-10-05-import-export-security-review-1.md) viết từ báo cáo của reviewer.
- **File thay đổi**
  - `document/specs/2026-09-15-import-export-design.md`
  - `document/plans/2026-10-03-import-export-plan.md`
  - `document/executions/logs/2026-10-05-import-export-review-5.md` (mới)
  - `document/executions/logs/2026-10-05-import-export-security-review-1.md` (mới)
  - `document/executions/logs/2026-10-05-import-export-spec-amendment-2.md` (log này)
- **Kiểm tra**
  - Đối chiếu code trước khi ghi: `hideCustomTypes`, `hideWithCheckClauses`, `PLACEHOLDER_TYPE = "INT"` (`packages/core/src/importers/sql/sql-parser-source.ts`), `findAutoIncrementIndexColumnIds` (`packages/core/src/generators/shared/dialect-constraints.ts`), `isAutoIncrementIndex` (`sql-draft-index-rules.ts`).
  - Grep câu import mới trên `packages/core/dist` hiện có chỉ in `packages/core/dist/importers/shared/dbml-core-adapter.js`; grep literal cũ khớp 9 file.
  - `pnpm exec prettier --check` trên năm file: `All matched files use Prettier code style!`, thoát mã 0.
  - Kiểm tra số ô của mọi dòng bảng trong spec (bỏ qua `\|` đã escape) bằng script Python tạm: không có dòng lệch.
  - `git status --porcelain`: năm file trên cùng `eslint.config.mjs` (bản sửa sẵn có của người dùng, không đụng tới).
- **Quyết định**: không có quyết định mới của spec-writer; mọi quy tắc là quyết định của orchestrator đã qua review 5.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Theo yêu cầu thêm của orchestrator, grep câu import cũng thay grep literal ở plan Task 11 ("Kiểm tra") và khối lệnh kiểm tra cuối của Task 33; Task 1 giữ grep cũ vì khi đó chưa có importer.
  - Các quy tắc A (dòng lệnh meta của psql) và B (`ADD DEFAULT … FOR`) được ghi vào spec trước khi cài đặt; A chờ bản sửa bảo mật của `statement-scanner.ts`.
