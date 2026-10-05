# Task 18: Property test cho mọi importer

- Plan: [2026-10-03-import-export-plan.md, Task 18](../../plans/2026-10-03-import-export-plan.md#task-18-property-test-cho-mọi-importer)
- Spec: [2026-09-15-import-export-design.md, mục 15](../../specs/2026-09-15-import-export-design.md#15-test)

## 2026-10-05 22:30 — core-engineer — Xong

- **Đã làm**
  - `packages/core/src/importers/importers.properties.test.ts`: `describe.each` trên sáu importer (`importPostgresql`, `importMysql`, `importSqlserver`, `importPrisma`, `importDbml`, `importJson`), đủ các test plan liệt kê: `never throws for a random string`, `never throws for a fixture cut at a random position`, `never throws for a fixture with a random character inserted`, `returns the same result twice for the same source and id generator`, `returns sorted diagnostics without repeats`, `imports a table named __proto__ and one named constructor`, `leaves Object.prototype unchanged for sources with __proto__ keys: <loại>`; cộng `round-trips any valid document through json byte for byte` (`schemaDocumentArbitrary`, so `serializeSchemaDocument` từng byte và `toStrictEqual` tài liệu gốc).
  - Fixture hợp lệ: `PG_DUMP_SOURCE`, `MYSQLDUMP_SOURCE`, `SSMS_SCRIPT_SOURCE`, `PRISMA_FEATURES_POSTGRESQL`, `DBML_FEATURES_FIXTURE`, `serializeSchemaDocument(createSampleSchema())`.
  - Nguồn `__proto__` viết tay cho từng định dạng: SQL (bảng `__proto__`, cột `__proto__`, khóa ngoại từ `constructor` tới `__proto__`, index tên `__proto__`, theo cú pháp nháy của từng dialect); Prisma (model `@@map("__proto__")`/`@@map("constructor")`, field `@map("__proto__")`, enum `constructor` có giá trị `__proto__`); DBML (enum, bảng, cột, ref, kiểu cột đều dùng `__proto__`); JSON (tên bảng và cột, thêm khóa map và khóa gốc `__proto__` như test Task 7).
  - TDD: không có code sản phẩm mới. Lần chạy đầu `test-file.sh core src/importers/importers.properties.test.ts` → `PASS` (48s): mọi property xanh ngay, không phát hiện lỗi importer nào.
- **File thay đổi**
  - `packages/core/src/importers/importers.properties.test.ts` (mới).
  - `document/executions/logs/2026-10-05-import-export-task-18.md` (log này).
- **Kiểm tra**
  - Số lần chạy: `PROPERTY_RUNS` = 200, `PROPERTY_SEED` = 20260914 cho mọi nhóm, không giảm cho SQL.
  - Thời gian từng nhóm (`test-file.sh ... --name <importer>`, gồm khởi động vitest khoảng 2s, máy tải nặng): `importPostgresql` 6s, `importMysql` 21s (23s khi chạy song song), `importSqlserver` 24s (chạy song song), `importPrisma` 2s, `importDbml` 3s, `importJson` (gồm round trip) 2s. Không nhóm nào vượt 30s.
  - Cả file: 48s lần đầu, 50s lần cuối.
  - `.claude/scripts/verify.sh core --build --format`: lần đầu `RESULT: FAIL (core lint, format (prettier --check))` (`@typescript-eslint/no-misused-spread` ở spread chuỗi và định dạng), sửa bằng `Array.from` và prettier; lần hai `RESULT: PASS` (typecheck, lint, test 4563/4563, coverage dòng 97.98%, build, prettier).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `git status --porcelain`: chỉ file test mới và log này.
- **Quyết định**
  - "Chuỗi ngẫu nhiên" là `fc.oneof` của ba nguồn: chuỗi code point bất kỳ (tối đa 400), chuỗi ký tự cú pháp (`"'`[](){}<>;,.:@=#-/*\` xuống dòng, tab, NUL) và chuỗi ghép từ token của fixture: chuỗi đều ngẫu nhiên hiếm khi qua được lexer.
  - Ký tự chèn lấy từ ký tự cú pháp hoặc một code point bất kỳ, để phép chèn hay rơi vào nhánh parser hơn là vào giữa tên.
  - Test xác định và test diagnostic dùng hợp của ba loại nguồn trên, để phủ cả nhánh thành công lẫn thất bại.
  - Fixture Prisma và DBML chọn bản "features" vì phủ nhiều cấu trúc nhất (vẫn hợp lệ, chỉ có diagnostic).
  - Không giảm `PROPERTY_RUNS` cho SQL vì không nhóm nào vượt 30s; timeout riêng mỗi test 60s như `generators.properties.test.ts`.
- **Ghi chú cho người tiếp theo**
  - `importMysql` và `importSqlserver` chậm hơn `importPostgresql` khoảng 4 lần trên cùng số lần chạy dù fixture ngắn hơn; chưa điều tra, đáng xem ở Task 19 (benchmark).
  - Không sửa file importer nào.
