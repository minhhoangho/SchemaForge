# Kiểm tra output SQL Server bằng code (thay conformance trên database thật)

- Spec: [`document/specs/2026-09-14-code-generators-design.md`](../../specs/2026-09-14-code-generators-design.md) (CG-01, CG-08, mục Rủi ro, R20, R24, R28)
- Plan: [`document/plans/2026-09-15-code-generators-plan.md`](../../plans/2026-09-15-code-generators-plan.md)
- Không thuộc task đánh số của plan: người dùng quyết định không chạy conformance SQL Server (VM Docker quá nhỏ) và kiểm tra bằng review code cùng unit/snapshot test.

## 2026-10-03 18:40 — core-engineer — Xong

- **Đã làm**
  - Đọc ba file conformance (`packages/codegen-conformance/src/sqlserver.test.ts` 14 test, nhóm "seed sql on sql server" trong `seed-sql.test.ts` 8 test, `src/probes/sqlserver.probe.test.ts` 9 probe) và dùng làm checklist. Fixture conformance là snapshot `sample`, `naming-edge`, `target-limit`, `empty` với kiểu custom đổi thành `money` (default `12.50`).
  - Review snapshot `__snapshots__/sqlserver/*.sql`, `__snapshots__/seed/*.sqlserver.sql` và code (`generate-sqlserver.ts`, `render-sqlserver-type.ts`, `shared/sql-literals.ts`, `shared/identifiers.ts`, `shared/relation-graph.ts` `findCascadeConflicts`, `shared/sql-ddl-model-indexes.ts`, `shared/sql-ddl-model-tables.ts`, `seed/serialize-seed-dataset.ts`, `seed/seed-sql-values.ts`, `seed/seed-values.ts`) theo quy tắc T-SQL.
  - Tìm thấy và sửa 2 lỗi (TDD, test đỏ trước):
    1. **Seed `decimal` vượt 38 chữ số** (conformance "seed for target-limit" trên SQL Server sẽ fail): cột `oversized_types.mysql_decimal` là `decimal(40, 31)`, DDL SQL Server kẹp còn `decimal(38, 31)` (7 chữ số nguyên), nhưng seed sinh `983148276.6784687621492733882805745271054` (9 chữ số nguyên, literal 40 chữ số): SQL Server báo Msg 1007 (literal quá 38 chữ số) hoặc tràn số Msg 8115. Sửa `drawDecimal`: tối đa 38 chữ số, phần lẻ `min(s, 38)`, phần nguyên `min(p − s, 9, 38 − phần lẻ)`, nên giá trị vừa `decimal(min(p, 38), min(s, 38))` của SQL Server và vẫn hợp lệ với `decimal(p, s)` của model.
    2. **Dấu `\` trước xuống dòng trong literal `N'…'`**: T-SQL coi `\` + LF hoặc `\` + CRLF trong hằng chuỗi là nối dòng và bỏ cả hai (tài liệu Microsoft "Backslash (Line Continuation)"), nên comment (`MS_Description`), default, giá trị enum trong `CHECK` và chuỗi seed có `\` cuối dòng bị đổi âm thầm. Sửa `sqlStringLiteral("sqlserver")`: `\` + (CR)LF thành `\\` + (CR)LF + (CR)LF; T-SQL đọc lại đúng `\` + (CR)LF.
- **File thay đổi**
  - `packages/core/src/generators/shared/sql-literals.ts`, `sql-literals.test.ts`
  - `packages/core/src/generators/seed/seed-values.ts`, `seed-values.test.ts`
  - `packages/core/src/generators/sqlserver/generate-sqlserver.test.ts`
  - Snapshot cập nhật (chỉ phần nguyên của `mysql_decimal` trong bảng `oversized_types`, 7 chữ số thay 9; mọi giá trị khác giống từng byte vì `nextInt` rút đúng một lần dù giới hạn đổi): `__snapshots__/seed/target-limit.{postgresql,mysql,sqlserver}.sql`, `__snapshots__/seed/target-limit.json.json`, `__snapshots__/mock-api/target-limit.ts` (mock API dùng seed).
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core src/generators/shared/sql-literals.test.ts` → `Tests 4 failed | 82 passed`; `.claude/scripts/test-file.sh core src/generators/seed/seed-values.test.ts` → `Tests 2 failed | 38 passed`; test mới trong `generate-sqlserver.test.ts` fail khi tạm bỏ bản sửa (`Tests 1 failed | 39 passed`).
  - GREEN: cả ba file `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 2642/2642, coverage dòng 97.63%, build, prettier).
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
  - Không chạy `pnpm test:conformance`, không khởi động Docker.

### Bảng kịch bản → kết luận

| Nguồn | Kịch bản | Kết luận | Căn cứ |
|---|---|---|---|
| sqlserver.test.ts | DDL chạy không lỗi, tạo đủ bảng (sample, naming-edge, target-limit, empty) | OK | Snapshot `__snapshots__/sqlserver/*`: tên quote `[…]`, `]` → `]]`; kiểu theo bảng ánh xạ; `NULL`/`NOT NULL` tường minh; `IDENTITY(1, 1)`; default `N'…'`; khóa chính, `UNIQUE`, `CHECK` enum sau cột; một batch, không `GO`; `money` và default `N'12.50'` chuyển ngầm được; `empty` là một dòng trống, không gửi |
| sqlserver.test.ts | Một khóa ngoại cho mỗi quan hệ được giữ (4 fixture) | OK | Quan hệ bị bỏ có `key-column-type-not-indexable` tại `relations` (target-limit `rel_182`); 16 `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` còn lại |
| sqlserver.test.ts | Xung đột cascade ghi `NO ACTION` cả hai sự kiện (4 fixture) | OK | `findCascadeConflicts` giữ đồ thị cạnh cascade (gộp delete và update, coi `restrict` là không cascade) là multitree: tự tham chiếu, vòng và đường thứ hai đều bị hạ, khớp Msg 1785 (probe 5); test `downgrades a cascade cycle and a second cascade path…` |
| sqlserver.test.ts | Comment cắt còn 3750 ký tự | OK | `sql-ddl-model.test.ts` (cắt ở ranh giới code point), `generate-sqlserver.test.ts` "truncates a comment beyond 3750…" |
| sqlserver.test.ts | Unique index lọc nhận hai NULL | OK | `CREATE UNIQUE INDEX [nullable_unique_alt_code_ux] … WHERE [alt_code] IS NOT NULL;`, đứng trước khóa ngoại; unique được tham chiếu giữ `UNIQUE` + `unique-nulls-restricted` |
| seed-sql.test.ts | Seed chạy sau DDL, đúng số dòng: sample, naming-edge, empty | OK | `SET IDENTITY_INSERT … ON/OFF` chỉ khi cột identity có trong danh sách cột; tối đa 1000 dòng mỗi `VALUES`; literal ngày giờ ISO 8601 (`…Z` cho `datetimeoffset`); `bit` 1/0; `uniqueidentifier` dạng chuỗi; binary qua `xs:base64Binary`; thứ tự nạp theo khóa ngoại, cạnh hoãn bằng `UPDATE` cuối |
| seed-sql.test.ts | Seed chạy sau DDL, đúng số dòng: target-limit | **Đã sửa** | Lỗi 1 ở trên (`decimal(40, 31)` → `decimal(38, 31)`) |
| probe 1 | `DECLARE` sau `CREATE TABLE`, biến cho `@level0name` | OK | Đã probe trên SQL Server 2022 ngày 2026-10-02; generator ghi `DECLARE @schema_name sysname = SCHEMA_NAME();` một lần trước các `EXEC` |
| probe 2 | `MS_Description` tối đa 3750 | OK | Như trên |
| probe 3 | 7 chữ số giây lẻ | OK | `truncateFractionalSeconds` cắt còn 7 |
| probe 4 | Khóa ngoại không trỏ được tới index lọc | OK | `resolveSqlServerUnique` giữ `UNIQUE` khi được tham chiếu |
| probe 5 | Vòng, nhiều đường, tự tham chiếu cascade bị từ chối | OK | Như dòng cascade |
| probe 6 | `RESTRICT` là lỗi cú pháp | OK | DDL model đổi `restrict` → `NO ACTION`, không diagnostic |
| probe 7 | Khóa `nvarchar(450)`, index `nvarchar(1000)` | OK | `keyText` 450; `varchar(1000)` giữ `nvarchar(1000)` |
| probe 8 | Khóa `nchar` cố định quá 900/1700 byte bị từ chối | OK | Hẹp `nchar` → `nvarchar` + `key-column-type-narrowed` |
| probe 9 | Cột khóa ngoại phải cùng kiểu với khóa `nvarchar` | OK | Hẹp lan theo `columnPairs` (R10) |
| Bổ sung | `\` trước xuống dòng trong literal | **Đã sửa** | Lỗi 2 ở trên |
| Bổ sung | Tên > 128 ký tự; bảng không cột; identity nullable, có default, nhiều identity; `SET NULL` trên cột `NOT NULL`, `SET DEFAULT` không default | Giới hạn đã biết | Validation phần 2 đã báo (`name-too-long` ở 63 byte, `table-columns-empty`, `column-auto-increment-*`, `table-multiple-auto-increment`, `relation-set-null-not-nullable`, `relation-set-default-without-default`); generator vẫn sinh output theo thiết kế |
| Bổ sung | Default `decimal` vượt kiểu đã kẹp (literal > 38 chữ số hoặc tràn phần nguyên) | Giới hạn đã biết | Chỉ khi model có precision > 38 và default dài; cột đã có `type-parameter-out-of-range`; cần quy tắc spec (bỏ default + `default-omitted`?) |
| Bổ sung | Tổng cột cố định > 8060 byte (nhiều `nchar` lớn) | Giới hạn đã biết | Msg 1701; spec chưa có quy tắc kích thước dòng cho SQL Server (chỉ MySQL); fixture không có |
| Bổ sung | Unique index lọc và `.value()` của XML cần `QUOTED_IDENTIFIER ON` | Giới hạn đã biết | Driver (tedious, ODBC, SSMS) bật mặc định; `sqlcmd` ODBC cũ tắt nếu không có `-I` |
| Bổ sung | Collation mặc định không phân biệt hoa thường | Giới hạn đã biết | `CHECK … IN` nhận `'A'` cho giá trị `'a'`; unique coi `a`/`A` là trùng. Giống cách so của MySQL đã chốt |
| Bổ sung | `DEFAULT` không đặt tên | OK (thiết kế) | SQL Server tự đặt `DF__…`; spec không yêu cầu tên |

- **Quyết định**
  - Escape `\` + xuống dòng bằng cách nhân đôi trong cùng một literal, không dùng nối chuỗi `N'…' + N'…'`: tham số của `EXEC sys.sp_addextendedproperty` không nhận biểu thức, nên một cách viết dùng được ở mọi nơi.
  - Giới hạn 38 chữ số ở bước sinh dataset, không ở bước ghi SQL: tràn phần nguyên không sửa được bằng cách định dạng; một dataset chung cho mọi định dạng; số lần rút PRNG không đổi khi `s ≤ 38`.
  - Không thêm `SET QUOTED_IDENTIFIER ON` hay xử lý default `decimal` quá dài và kích thước dòng 8060 byte: spec chưa có quy tắc, ngoài phạm vi sửa lỗi; ghi là giới hạn đã biết.
  - Cập nhật snapshot mock API `target-limit`: mock API dùng dataset seed, thay đổi là chủ ý.
  - Không sửa test conformance (theo yêu cầu); chúng giữ nguyên cho lần chạy với database thật.
- **Việc còn lại**: không có trong phạm vi task.
- **Ghi chú cho người tiếp theo**
  - Rủi ro còn lại khi chưa chạy SQL Server thật: bản sửa `\` + xuống dòng dựa trên tài liệu Microsoft và giả định lexer đọc một lượt (`\\` + LF + LF → `\` + LF); nên thêm một case conformance (default hoặc comment chứa `\` cuối dòng, đọc lại bằng `sys.extended_properties`) khi có database. Phần còn lại đã được probe ngày 2026-10-02 hoặc chỉ dùng cú pháp T-SQL cơ bản.
  - Đề xuất cho spec (orchestrator quyết): quy tắc cho default `decimal` vượt kiểu đã kẹp; kích thước dòng SQL Server 8060 byte cho cột cố định; ghi vào mục 5 rằng literal SQL Server escape `\` + xuống dòng.
