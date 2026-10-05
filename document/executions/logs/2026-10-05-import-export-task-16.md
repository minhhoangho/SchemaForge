# Task 16: IE-03 importer DBML

- Plan: [2026-10-03-import-export-plan.md, Task 16](../../plans/2026-10-03-import-export-plan.md#task-16-ie-03-importer-dbml)
- Spec: [2026-09-15-import-export-design.md, mục 1, mục 7, mục 15](../../specs/2026-09-15-import-export-design.md#7-ie-03-import-dbml)

## 2026-10-05 19:30 — core-engineer — Xong

- **Đã làm**
  - `importDbml: Importer` (subpath `@schemaforge/core/importers/dbml` qua pattern `"./importers/*"` có sẵn): `checkSourceLength` → `parseDbmlWithDbmlCore` → dịch `CoreDatabase` sang `ImportDraft` theo bảng ánh xạ spec mục 7 → `assembleDocument`. Tên tài liệu là tên `Project` nếu có.
  - `resolveDbmlType` và `toDbmlDatabaseType` (`dbml-type-resolution.ts`): kiểu trong nháy kép là enum nếu trùng tên enum (không phân biệt hoa thường), còn lại `custom` nguyên văn; kiểu không nháy theo thứ tự kiểu chung đúng cách CG-09 ghi, tên enum, `mapSqlType` theo `database_type` (`PostgreSQL`, `MySQL`, `SQL Server`; khác hoặc thiếu thì `postgresql`), còn lại `custom` hoặc `text` + `type-not-supported`.
  - Đọc lại nguồn theo `token` của cột (`dbml-column-source.ts`, lexer một lượt, không regex lồng): biết kiểu có nháy không (kể cả `schema."type"`) và lấy văn bản gốc của mặc định số.
  - Ref: phía `*` là `from`; `-` lấy bên trái là `from`, riêng `ref:` trên cột (token của ref nằm trong token của một bảng) lấy cột chứa nó là `from` vì parser đặt đầu được tham chiếu trước (log Task 8).
  - TDD: RED `vitest run src/importers/dbml/dbml-type-resolution.test.ts` → `Cannot find module './dbml-type-resolution.js'`; RED `vitest run src/importers/dbml/import-dbml.test.ts` → `Cannot find module './import-dbml.js'`; GREEN sau khi cài đặt: thư mục `src/importers/dbml/` 113 test pass. `dbml-column-source.ts` viết trước test của `import-dbml.test.ts` (là phần tách của importer, kiểm tra qua `importDbml`); test round-trip viết sau khi importer đã xanh và pass ngay lần đầu.
- **File thay đổi** (tất cả mới, trong `packages/core/src/importers/dbml/`)
  - `index.ts` (1 dòng), `import-dbml.ts` (144), `dbml-type-resolution.ts` (117), `dbml-type-resolution.test.ts` (183), `import-dbml.test.ts` (939), `import-dbml.roundtrip.test.ts` (36), `fixtures/dbdiagram.fixture.ts` (48), `fixtures/dbml-features.fixture.ts` (44).
  - Tách thêm (được duyệt trước, file trên ~300 dòng): `dbml-columns.ts` (141, dịch cột, mặc định, vị trí), `dbml-tables.ts` (175, bảng, khóa chính, index), `dbml-relations.ts` (113, ref), `dbml-column-source.ts` (149, lexer đọc lại nguồn cột).
  - `document/executions/logs/2026-10-05-import-export-task-16.md` (log này).
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3895/3895, coverage dòng 97.77%, build, prettier).
  - Coverage riêng `src/importers/dbml/**`: 98.26% dòng.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `git status --porcelain`: chỉ `packages/core/src/importers/dbml/` và log này.
- **Quyết định**
  - Tên tham số `wasQuoted` của plan đổi thành `isQuoted`: rule lint `naming-convention` bắt buộc tiền tố `is/has/can/should`.
  - `isNullable` là `false` cho cột thuộc khóa chính (cột `pk` hoặc trong `indexes { (…) [pk] }`), như spec mục 5 với SQL: dbdiagram.io thường ghi `id int [pk]` không có `not null`; không ảnh hưởng round-trip vì CG-09 luôn ghi `not null` cho cột không null.
  - Mặc định số: chỉ dùng văn bản đọc lại khi `Number(văn bản)` bằng số parser trả về; ngược lại dùng giá trị của adapter (tránh đọc nhầm khi vị trí lệch, ví dụ dòng kết thúc bằng `\r` đơn).
  - **Đáng chú ý:** nhiều định nghĩa khóa chính trong một bảng (parser 10.2.0 chấp nhận cột `pk` cùng index `[pk]`, hoặc hai index `[pk]`): giữ index `[pk]` đầu tiên không có cột biểu thức, các định nghĩa còn lại bỏ với `index-option-dropped`, `path` `["tables", id, "primaryKeyColumnIds"]` (đường dẫn bảng Task 2 đã liệt kê cho mã này). `name:` của index `[pk]` cũng `index-option-dropped`; `type:`, `note:` của index `[pk]` dùng `index-type-dropped`, `comment-dropped` với cùng `path` này (model không có index cho khóa chính).
  - `check:` của cột và mục trong `checks` có `location` là vị trí của chính biểu thức check (parser có token), không phải đầu cột.
  - `comment-dropped` của `Project` có `location: null` (adapter không có token cho `Project`).
  - Bảng thuộc nhiều `TableGroup`: nhóm đầu tiên liệt kê nó (parser 10.2.0 chưa thấy chặn; không thử thêm).
  - `Ref` không đủ hai đầu mút (parser không tạo ra) báo `reference-not-found` thay vì bỏ âm thầm.
  - Test parse lớn (`too-many-elements` với 20 000 cột, round-trip `target-limit`) đặt `timeout: 60_000` riêng cho `describe`, không sửa cấu hình chung.
- **Ghi chú cho người tiếp theo**
  - Lint chỉ cho `importers/sql/` và `importers/dbml/` import adapter; `dbml-columns.ts`, `dbml-tables.ts`, `dbml-relations.ts` chỉ import type của adapter.
  - `tsconfig.build.json` không loại `*.fixture.ts`, nên `dist/importers/dbml/fixtures/` được build (không lộ qua `exports`); nếu muốn loại thì sửa `tsconfig.build.json` (ngoài phạm vi task).
  - Task 18 (property test) có thể dùng `DBDIAGRAM_FIXTURE` làm fixture hợp lệ của DBML.
