# Test fallback custom type không an toàn ở 3 generator SQL DDL

Spec: `document/specs/2026-09-14-code-generators-design.md` (diagnostic `custom-type-unsafe`); `document/specs/2026-09-14-core-schema-model-design.md` (custom types). Không có plan task (việc test bổ sung theo yêu cầu review bảo mật).

## 2026-10-03 — test-engineer — Xong
- **Đã làm**: thêm một `it.each` cho mỗi generator với 3 input injection (`int CHECK (x)`, `text, extra int`, `int REFERENCES other(id)`). Mỗi case kiểm tra: dòng cột dùng fallback text của dialect (PostgreSQL `text`, MySQL `LONGTEXT`, SQL Server `nvarchar(max)`), tên custom gốc không xuất hiện trong output, diagnostics đúng một `custom-type-unsafe` tại `["columns", "col_c", "type"]`.
- **File thay đổi**: `packages/core/src/generators/postgresql/generate-postgresql.test.ts`, `packages/core/src/generators/mysql/generate-mysql.test.ts`, `packages/core/src/generators/sqlserver/generate-sqlserver.test.ts`. Không đổi production code.
- **Kiểm tra**: `.claude/scripts/verify.sh core --build --format` RESULT: PASS (2631 test pass, +9); `.claude/scripts/secret-scan.sh` SECRET-SCAN: CLEAN.
- **Quyết định**: dùng `buildSchema` + `makeTable`/`column` theo style từng file; kiểm tra bằng dòng cột đầy đủ vì bảng không có khóa chính nên cột là dòng duy nhất.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: không phát hiện bug; cả 3 fallback hoạt động đúng. Chưa thử phá `resolveSafeType` để xác nhận test fail (suy luận: bỏ fallback thì tên gốc xuất hiện trong output và diagnostic mất).
