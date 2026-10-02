# Task 12: Quy tắc kiểu và khóa theo dialect

- Plan: [Task 12](../../plans/2026-09-15-code-generators-plan.md#task-12-quy-tắc-kiểu-và-khóa-theo-dialect)
- Spec: [mục 3 "SQL", mục 4 (danh mục mã, "Độ dài khóa trên MySQL", "Cột AUTO_INCREMENT trên MySQL", "Kích thước dòng trên MySQL", "Độ dài khóa trên SQL Server", ma trận), "Quyết định bổ sung 2026-10-02" R1–R18](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Tách `isSafeCustomTypeName` khỏi `validation/rules/columns.ts` sang `custom-type-name.ts`; `columns.ts` chỉ import hàm mới, `columns.test.ts` không sửa và vẫn pass.
  - `dialect-types.ts`: `DialectColumnType`, `resolveDialectColumnType` (giới hạn `char`/`varchar`/`decimal` theo dialect; MySQL hẹp cột khóa `n > 768` thành `VARCHAR(768)` trước bước giới hạn (R2, R11); `text` trong khóa thành `keyText` 255/450; SQL Server `isFixedLengthNarrowed` đổi `nchar(n)` → `nvarchar(n)`; `custom` kèm `isSafe`), `mysqlKeyPartBytes`, `sqlServerFixedKeyBytes`, `mysqlRowBytes` và các hằng `MYSQL_MAX_KEY_BYTES`, `MYSQL_MAX_KEY_CHARACTERS`, `MYSQL_MAX_ROW_BYTES`, `SQLSERVER_MAX_PRIMARY_KEY_BYTES`, `SQLSERVER_MAX_INDEX_KEY_BYTES`.
  - `dialect-constraints.ts`: `collectKeyColumnIds`, `resolveSchemaColumnTypes` (SQL Server: tập cột `nchar` của khóa vượt 900/1700 byte, lan bắc cầu qua `columnPairs` bằng hàng đợi (R1, R10); MySQL: đổi cột `CHAR`/`VARCHAR` không thuộc khóa lớn nhất thành `text` tới khi dòng ≤ 65 535 byte (R13)), `findUnindexableConstraints` (json/binary, MySQL > 3072 byte, SQL Server fixed > 900/1700 sau khi hẹp, quan hệ tham chiếu khóa đã bỏ, `autoIncrementIndexColumnIds` cho MySQL (R14)), `resolveReferentialAction`, `resolveSqlServerUnique`.
  - `mysql-identifiers.ts`: `allocateMysqlNames` (allocator `caseAndAccentInsensitive`, `_`, 63 byte cho cột theo `columnIds` và index theo `sortIndexes`, từng bảng; `identifier-collision-renamed`).
- **File thay đổi**
  - Mới: `packages/core/src/validation/rules/custom-type-name.ts`, `custom-type-name.test.ts`
  - Sửa: `packages/core/src/validation/rules/columns.ts`
  - Mới: `packages/core/src/generators/shared/dialect-types.ts`, `dialect-types.test.ts`, `dialect-constraints.ts`, `dialect-constraints.test.ts`, `dialect-column-types.ts`, `dialect-column-types.test.ts`, `mysql-identifiers.ts`, `mysql-identifiers.test.ts`
- **Kiểm tra**
  - RED: mỗi file test chạy trước khi có module, lỗi `Cannot find module './<module>.js'` (`pnpm --filter @schemaforge/core exec vitest run <file> --coverage.enabled=false`).
  - GREEN: `custom-type-name` + `columns` 39 test; `dialect-types`, `dialect-constraints`, `dialect-column-types`, `mysql-identifiers` cùng các test khác của `generators/shared` 196 test sau khi tách file.
  - `.claude/scripts/verify.sh core --build --format` và `.claude/scripts/secret-scan.sh`: kết quả ghi trong báo cáo gửi orchestrator.
- **Quyết định**
  - `isFixedLengthNarrowed` là thuộc tính tùy chọn (mặc định `false`): plan không ghi trong chữ ký mẫu, người gọi dialect khác không phải truyền.
  - Hẹp `nchar` SQL Server chỉ áp khi kiểu sau bước giới hạn vẫn là `char`; `char(n > 4000)` đã thành `text`/`keyText` nên không vào tập.
  - Bước dòng MySQL chạy sau bước kiểu từng cột trên cùng map, nên một cột chỉ có một kiểu; cột đã có `type-parameter-out-of-range` (ví dụ `char(300)`) rồi bị đổi sang `text` vẫn chỉ một diagnostic nhờ `finalizeDiagnostics`.
  - Cột auto-increment cần index dự phòng khi không còn khóa chính, unique cột hay index nào giữ lại có cột đầu là nó; khóa ngoại không tính (spec chỉ kể khóa chính, unique, index).
  - Orchestrator duyệt thêm file `dialect-column-types.ts` (kèm test) ngoài danh sách "File sở hữu" của plan, để `dialect-constraints.ts` và `dialect-types.ts` về khoảng 300 dòng: file mới chứa `resolveSchemaColumnTypes`, `SchemaColumnTypes`, phần lan hẹp `nchar` của SQL Server, bước kích thước dòng MySQL và `mysqlRowBytes`, `MYSQL_MAX_ROW_BYTES` (chuyển từ `dialect-types.ts`). `dialect-constraints.ts` export thêm `listKeyConstraints`, `sumBytes`, `sqlServerKeyLimit`, `KeyConstraint`, `ColumnTypes` cho file mới; `dialect-types.ts` export thêm `MYSQL_BYTES_PER_CHARACTER`, `MYSQL_OTHER_TYPE_BYTES`. Hành vi không đổi, test chuyển theo nguyên văn.
  - Dùng chuỗi `if` thay `switch` cho các hàm tính byte: luật lint `switch-exhaustiveness-check` bắt liệt kê đủ mọi kind, trong khi phần lớn kind dùng chung một giá trị.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 13, 17, 18 lấy kiểu cột chỉ qua `resolveSchemaColumnTypes` (ở `dialect-column-types.ts`), rồi truyền `types` vào `findUnindexableConstraints`.
  - `generators/shared/dialect-types.ts` import `validation/rules/custom-type-name.ts` (đúng ý plan); không import chéo thư mục đích.
  - Diagnostic `custom-type-unsafe` không phát ở đây (Task 13 thêm cho SQL).
