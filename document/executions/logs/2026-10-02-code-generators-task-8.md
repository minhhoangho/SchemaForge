# Task 8: Helper conformance, task `test:conformance` và probe database

- Plan: [Task 8](../../plans/2026-09-15-code-generators-plan.md#task-8-helper-conformance-task-testconformance-và-probe-database)
- Spec: [2026-09-14-code-generators-design.md](../../specs/2026-09-14-code-generators-design.md), mục 7 (R3, "Probe trước khi viết generator") và mục "Rủi ro"

## 2026-10-02 15:30 — core-engineer — Bị chặn

Phần helper, task turbo và script root đã xong và pass. Riêng phần probe bị chặn vì Docker daemon không chạy trên máy: probe đã viết đủ nhưng chưa chạy lần nào.

- **Đã làm**
  - Viết test trước cho `fixtures`, `typecheck`, `prisma-cli` và thấy đỏ (`Cannot find module './typecheck.js'`, 3 file test fail), rồi cài đặt tới xanh.
  - `support/containers.ts`: `startDatabaseServer` cho PostgreSQL 18, MySQL 8.4 và SQL Server 2022 theo chữ ký của plan. Thêm `tryExecute` và type `SqlOutcome` (xem **Quyết định**).
  - `support/fixtures.ts`: `listConformanceFixtures`, `DIALECT_CUSTOM_TYPES`, `withDialectCustomTypes` (một `batch` gồm các `updateColumn`, áp bằng `applyOperation`).
  - `support/typecheck.ts`: `typecheckFiles` dùng `ts.createProgram` với option của `tsconfig.base.json` cộng `NodeNext`.
  - `support/prisma-cli.ts`: `runPrismaValidate` chạy CLI `prisma` của package bằng `execFile(process.execPath, …)`.
  - `probes/mysql.probe.test.ts` (18 probe) và `probes/sqlserver.probe.test.ts` (9 probe), mỗi điểm một `it`, mỗi `it` một database mới.
  - `turbo.json`: thêm task `test:conformance`. `package.json` root: thêm script `test:conformance`, đặt sau `test`.
- **File thay đổi**
  - Tạo: `packages/codegen-conformance/src/support/{containers.ts,fixtures.ts,fixtures.test.ts,typecheck.ts,typecheck.test.ts,prisma-cli.ts,prisma-cli.test.ts}`, `packages/codegen-conformance/src/probes/{mysql.probe.test.ts,sqlserver.probe.test.ts}`
  - Sửa: `turbo.json`, `package.json` (root)
- **Kiểm tra**
  - `docker info` → lỗi nguyên văn: `failed to connect to the docker API at unix:///Users/hominhhoang/.docker/run/docker.sock; check if the path is correct and if the daemon is running: dial unix /Users/hominhhoang/.docker/run/docker.sock: connect: no such file or directory`
  - `pnpm test:conformance` → build core, rồi 4 file helper pass (26 test). Hai file probe fail với `Error: Could not find a working container runtime strategy` (27 test bị bỏ qua).
  - `pnpm --filter @schemaforge/codegen-conformance typecheck` / `lint` → thoát mã 0.
  - `pnpm typecheck` → 8/8 task thành công. `pnpm lint` → 8/8 task thành công.
  - Lần đầu `pnpm test` thoát mã 1: hai test frontend hết thời gian 5000ms (`create-relation-dialog.test.tsx` "prefills the dialog from a connection", `editor-workspace.test.tsx` "uploads the schema with the held lock…") vì máy đang chạy song song `verify.sh`. Task không đụng `frontend/`. Chạy lại `pnpm --filter @schemaforge/frontend test` riêng thì thoát mã 0, và chạy lại `pnpm test` thì 7/7 task thành công.
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (1364 test, 98.07% dòng)
  - `pnpm exec prettier --check packages/codegen-conformance turbo.json package.json` → pass
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`
- **Kết quả probe**: chưa chạy ở lượt này; xem lượt sau.
- **Quyết định**
  - **(quan trọng)** Thêm `tryExecute(session, sql): Promise<SqlOutcome>` và type `SqlOutcome { isAccepted, codes, message }` vào `containers.ts`, ngoài chữ ký của plan. `codes` gom `errno` của MySQL, `number` của SQL Server (gồm `precedingErrors`, theo thứ tự server báo) và SQLSTATE của PostgreSQL. Lý do: cả hai file probe và Task 29 cần cùng một cách đọc "nhận hay từ chối, mã gì" mà không throw.
  - **(quan trọng)** Mỗi probe in kết quả từng case lên stdout (`[probe] <dialect> <số>: {…}`, qua `process.stdout.write` vì lint cấm `console`). Lý do: log phải trích kết quả thật, và probe 14, 17, 18 chỉ ghi kết quả, không khẳng định.
  - Chỉ khẳng định mã lỗi khi plan nêu mã, hoặc khi mã chắc chắn (1060, 1061, 1101, 1628, 1629, 1776, 1785, 2627). Các ca còn lại chỉ khẳng định "từ chối", còn mã vẫn được in ra. Lý do: tránh probe đỏ oan vì đoán sai mã.
  - **(quan trọng)** SQL Server probe 3 chạy `CREATE TABLE` kèm một `INSERT` dùng giá trị mặc định. Lý do: SQL Server có thể chỉ chuyển kiểu default khi có dòng dùng nó; theo Vấn đề 8, literal phải dùng được, không chỉ được nhận lúc tạo bảng.
  - MySQL probe 12 dùng ký tự `é` (2 byte) để xác nhận giới hạn tính theo ký tự, không theo byte, khớp với cách cắt theo code point của `comment-truncated`.
  - SQL Server container có `.withPlatform("linux/amd64")` (image chỉ có amd64; máy này là arm64) và `withStartupTimeout(300_000)`. `beforeAll` của file SQL Server chờ tối đa 900 s, của MySQL 600 s, để kịp kéo image lần đầu. `vitest.config.ts` không đổi.
  - MySQL kết nối bằng `root` (`getRootPassword()`). Lý do: user mặc định của Testcontainers chỉ có quyền trên database của container, nên không `CREATE DATABASE` được.
  - `countTables` của PostgreSQL loại `pg_catalog` và `information_schema`; MySQL lọc `TABLE_SCHEMA = DATABASE()`.
  - `runPrismaValidate` reject (bọc `Error` kèm `cause`) khi tiến trình không chạy được, ví dụ `ENOENT`. Exit code khác 0 thì resolve. Không đặt `CHECKPOINT_DISABLE` vì lint cấm `process.env`.
  - `withDialectCustomTypes` duyệt cột qua `sortTables` và `columnIds`, không theo thứ tự khóa của map.
  - Test `returns a schema without semantic issues` chạy cho mọi fixture × ba dialect (12 ca).
- **Việc còn lại**: chuyển sang lượt sau.
- **Ghi chú cho người tiếp theo**
  - Lỗi khi không có Docker: `Error: Could not find a working container runtime strategy` ở `beforeAll` của cả hai file probe.
  - Hai test frontend ở trên có thể hết thời gian khi máy bận; chạy lại riêng thì pass.

## 2026-10-02 17:10 — core-engineer — Bị chặn

Orchestrator cho bật Docker Desktop (`open -a Docker`; Docker 29.6.1, máy arm64, VM khoảng 2 GB RAM). Đã rebase lên master `b5445a1` bằng `git rebase --autostash master` (không trùng file), rồi chạy lại `worktree-setup.sh` (`RESULT: PASS`). Probe đã chạy thật: **7 probe khẳng định khác kỳ vọng về hành vi** (MySQL 1, 2, 3, 4, 6, 10; SQL Server 3). Không có probe nào chỉ sai mã lỗi, nên không sửa assertion nào. Theo plan, không sửa kỳ vọng, để 7 test đỏ, và Task 15, 16 chờ orchestrator quyết định sửa spec.

- **Đã làm**
  - Chạy `pnpm test:conformance` hai lần. Đối chiếu riêng các probe MySQL lệch kỳ vọng bằng CLI `mysql` (`--default-character-set=utf8mb4`) trong một container `mysql:8.4` tách riêng (đã xóa sau khi kiểm), để loại trừ lỗi mã hóa của `mysql2`.
  - Điền bảng kết quả bên dưới.
- **File thay đổi**: chỉ file log này. Code của Task 8 không đổi.
- **Kiểm tra**
  - `docker info --format …` → `29.6.1 aarch64 mem=2067832832`
  - `pnpm test:conformance` lần 1 (có kéo image) → thoát mã 1: `Tests 7 failed | 46 passed (53)`, vitest 95.52 s. 4 file helper pass hết.
  - `pnpm test:conformance` lần 2 → thoát mã 1, cùng 7 test đỏ, 23.64 s. `@schemaforge/core:build` cache hit, nhưng `@schemaforge/codegen-conformance:test:conformance: cache miss, executing 5886ce3509f9098c`. Turbo không lưu cache cho task fail, nên chưa có cache hit. Hash giống hệt lần 1, nên khi mọi test pass thì lần chạy sau sẽ hit.
  - Đối chiếu bằng CLI `mysql`, MySQL 8.4.11, `sql_mode` mặc định strict. `CREATE TABLE t1 (ma INT, \`má\` INT)` được nhận; `information_schema` lưu hai cột `6D61` (`ma`) và `6DC3A1` (`má`), nên UTF-8 gửi đúng. `CREATE TABLE t1b (ma INT, \`MA\` INT)` → `ERROR 1060 Duplicate column name 'MA'`: MySQL chỉ bỏ qua hoa thường, không bỏ qua dấu. Index `ix_ma`/`ix_má` và cột `đa`/`da` được nhận. `ON DELETE SET DEFAULT` được nhận, và `SHOW CREATE TABLE` vẫn giữ `ON DELETE SET DEFAULT`.
  - Thêm bằng CLI: `TIMESTAMP(6) DEFAULT '2026-01-02 03:04:05.123456+00:00'`, `'2026-01-02T03:04:05.123456+00:00'` và `'2026-01-02T03:04:05.123456'` đều được nhận, lưu `2026-01-02 03:04:05.123456`.
- **Kết quả probe** (mã lỗi lấy từ dòng `[probe]`; ✗ = hành vi khác kỳ vọng)

  | Probe | Kỳ vọng | Kết quả thật |
  |---|---|---|
  | MySQL 1 `ma`/`má` cột | từ chối, 1060 | ✗ **được nhận** |
  | MySQL 2 index `ix_ma`/`ix_má` | từ chối, 1061 | ✗ **được nhận** |
  | MySQL 3 unique `t_ma_key`/`t_má_key` | từ chối, 1061 | ✗ **được nhận** |
  | MySQL 4 `đa`/`da`, `øl`/`ol`, `łza`/`lza`, `ħal`/`hal`; `ENUM('đa','da')` | 4 cặp cột từ chối; enum được nhận | ✗ **cả 4 cặp cột được nhận**; enum được nhận |
  | MySQL 5 `ENUM('ma','má')` với `utf8mb4_0900_as_ci` | được nhận | được nhận |
  | MySQL 6 `ON DELETE SET DEFAULT` | từ chối | ✗ **được nhận** (định nghĩa vẫn giữ `SET DEFAULT`) |
  | MySQL 7 `DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)` | được nhận | được nhận |
  | MySQL 8 `LONGTEXT DEFAULT ('a''b')`, `JSON DEFAULT ('{"a":1}')`; `LONGTEXT DEFAULT 'x'` | 2 được nhận; 1 từ chối, 1101 | 2 được nhận; từ chối 1101 `BLOB, TEXT, GEOMETRY or JSON column 'v' can't have a default value` |
  | MySQL 9 `CHAR(36) DEFAULT (UUID())` | được nhận | được nhận |
  | MySQL 10 `TIMESTAMP(6)` với `+07:00` và với `Z` | cả hai được nhận | ✗ `+07:00` được nhận; **`Z` bị từ chối 1067** `Invalid default value for 'v'` |
  | MySQL 11 khóa 3072 byte: 4×192, 5×700, 768, 769, 4×192+INT, 3×255, 4×255 | nhận, từ chối 1071, nhận, từ chối, từ chối, nhận, từ chối | nhận, 1071, nhận, 1071, 1071, nhận, 1071 (`Specified key was too long; max key length is 3072 bytes`) |
  | MySQL 12 comment cột 1024/1025, bảng 2048/2049 (ký tự `é`) | nhận/từ chối 1629, nhận/từ chối 1628 | nhận / 1629 `(max = 1024)`, nhận / 1628 `(max = 2048)`; giới hạn tính theo ký tự |
  | MySQL 13 `'a\\b'` lưu thành `a\b` | `a\b` | `a\b` |
  | MySQL 14 9 chữ số giây lẻ trong `DATETIME(6)`, `TIME(6)`, `TIMESTAMP(6)` | ghi kết quả; 6 chữ số được nhận | ghi kết quả: **cả 3 kiểu nhận 9 chữ số**; 6 chữ số được nhận |
  | MySQL 15 `AUTO_INCREMENT` đứng sau trong PK; thêm `INDEX (id)` | từ chối 1075; được nhận | từ chối 1075; được nhận |
  | MySQL 16 `VARCHAR(16383)`; `LONGTEXT` | từ chối 1118; được nhận | từ chối 1118; được nhận |
  | MySQL 17 `TIMESTAMP(6)` với `-00:00` | ghi kết quả (kỳ vọng được nhận) | ghi kết quả: **bị từ chối 1067** `Invalid default value for 'v'` |
  | MySQL 18 `ßa`/`sa`, `ða`/`da` | ghi kết quả (kỳ vọng được nhận) | ghi kết quả: cả hai cặp được nhận |
  | SQL Server 1 `DECLARE` sau `CREATE TABLE`, `@level0name` là biến | được nhận | được nhận |
  | SQL Server 2 `MS_Description` 3750/3751 ký tự | nhận/từ chối | nhận / từ chối 15097 `The size associated with an extended property cannot be more than 7,500 bytes.` |
  | SQL Server 3 `time`, `datetime2` mặc định 7/8 chữ số (kèm `INSERT`) | nhận/từ chối | ✗ 7 chữ số được nhận; **8 chữ số cũng được nhận** (cả `CREATE` lẫn `INSERT`) |
  | SQL Server 4 FK tới unique index lọc; tới `UNIQUE` nullable; hai `NULL` | từ chối 1776; nhận; NULL thứ hai từ chối 2627 | từ chối 1776 (+1750); nhận; nhận; từ chối 2627 |
  | SQL Server 5 vòng cascade, hai đường cascade, tự tham chiếu cascade; bản `NO ACTION` | 3 từ chối 1785; 3 được nhận | 3 từ chối 1785 (+1750); 3 bản `NO ACTION` được nhận |
  | SQL Server 6 `ON DELETE RESTRICT` | lỗi `Incorrect syntax` | từ chối 156 `Incorrect syntax near the keyword 'RESTRICT'.` |
  | SQL Server 7 PK `nvarchar(450)`; index `nvarchar(1000)` | được nhận | được nhận |
  | SQL Server 8 PK `nchar(451)`, unique `nchar(851)`; bản `nvarchar` | từ chối 1944; được nhận | từ chối 1944 (+1750) cả hai; bản `nvarchar` được nhận |
  | SQL Server 9 FK `nchar(500)` → PK `nvarchar(500)`; FK `nvarchar(500)` | từ chối; được nhận | từ chối 1778 (+1750); được nhận |

- **Quyết định**
  - Không sửa assertion nào: mọi probe đỏ đều lệch về hành vi (nhận hay từ chối), không có probe nào chỉ sai mã lỗi. Các mã đã đoán trước (1101, 1071, 1075, 1118, 1628, 1629, 1776, 1785, 1944, 2627) đều đúng.
  - Coi các kết quả MySQL 1–4 và 6 là hành vi thật của MySQL 8.4.11, không phải lỗi harness: CLI `mysql` độc lập cho cùng kết quả, và trường hợp `ma`/`MA` vẫn bị từ chối 1060.
  - Không chạy lại SQL Server để xem 8 chữ số giây lẻ được làm tròn hay cắt. Lý do: không cần để kết luận "được nhận", và hàm literal SQL Server vẫn cắt về 7 chữ số theo Vấn đề 8.
- **Việc còn lại**
  - [ ] Orchestrator quyết định sửa spec (và kỳ vọng của probe tương ứng) cho các điểm lệch, trước khi chạy Task 15, 16:
    - MySQL 1–3: tên cột, index và ràng buộc chỉ khác dấu **không** trùng nhau trên MySQL 8.4 (chỉ không phân biệt hoa thường). Spec mục 4 ("MySQL so tên cột, index không phân biệt dấu"), R12 và Vấn đề 7 dựa trên điều ngược lại. Tên ràng buộc dùng `caseAndAccentInsensitive` cho mọi dialect vẫn an toàn (chỉ chặt hơn cần thiết), nhưng danh sách gộp R12 (`đ`, `ø`, `ł`, `ħ`) và việc so định danh MySQL có dấu cần xem lại.
    - MySQL 4: `đ`, `ø`, `ł`, `ħ` không được gộp (R12).
    - MySQL 6: InnoDB 8.4.11 **nhận** `ON DELETE SET DEFAULT` và giữ trong định nghĩa. Ma trận của spec ghi MySQL không hỗ trợ `setDefault`; cần quyết định có giữ cách hạ cấp hiện tại không (giữ hạ cấp vẫn an toàn).
    - MySQL 10: hậu tố `Z` bị từ chối (1067), chỉ độ lệch dạng `+hh:mm` được nhận.
    - SQL Server 3: 8 chữ số giây lẻ được nhận, nên điều kiện của Vấn đề 8 không xảy ra. Hàm literal cắt về 7 chữ số vẫn đúng.
  - [ ] MySQL 17 bị từ chối, và `Z` (probe 10) cũng bị từ chối: orchestrator tạo task sửa `packages/core/src/generators/shared/sql-literals.ts` (file của Task 7) để literal `timestamptz` của MySQL đổi hậu tố `Z` và `-00:00` thành `+00:00` (CLI xác nhận `+00:00` được nhận, cả với `T` lẫn dấu cách). Task đó chạy trước Task 15, 17, 18, 22.
  - [ ] MySQL 18: cả hai cặp `ß`/`s`, `ð`/`d` được nhận, nên không cần task thêm ký tự vào R12.
  - [ ] Sau khi spec được sửa, cập nhật kỳ vọng của MySQL 1, 2, 3, 4, 6, 10 và SQL Server 3 trong `packages/codegen-conformance/src/probes/*.probe.test.ts` theo quyết định đó, chạy `pnpm test:conformance` hai lần, và xác nhận lần hai báo cache hit.
- **Ghi chú cho người tiếp theo**
  - Log đầy đủ hai lần chạy nằm trong scratchpad của phiên (không commit). Chạy lại `pnpm test:conformance` mất khoảng 1,5 phút khi đã có image. Dòng `[probe] …` là JSON `{ case: { isAccepted, codes, message } }`.
  - Docker Desktop đang chạy và được để chạy theo yêu cầu. Container của Testcontainers tự dọn sau khi test xong.

## 2026-10-02 17:40 — core-engineer — Xong

Orchestrator đã quyết định 7 điểm lệch: lấy hành vi thật làm kỳ vọng. Đã sửa hai file probe theo quyết định đó. `pnpm test:conformance` pass hết, và lần chạy thứ hai là cache hit.

- **Đã làm**
  - `probes/mysql.probe.test.ts`:
    - Probe 1–3 khẳng định tên chỉ khác dấu được nhận. Probe 1 thêm ca `ma`/`MA` khẳng định bị từ chối 1060, để ghim việc so không phân biệt hoa thường.
    - Probe 4 khẳng định mọi cặp `đ`, `ø`, `ł`, `ħ` được nhận.
    - Probe 6 chuyển sang chỉ ghi kết quả.
    - Probe 10 khẳng định `+07:00` được nhận, `Z` bị từ chối 1067, và `+00:00` được nhận với cả `T` lẫn dấu cách.
    - Probe 17 khẳng định `-00:00` bị từ chối 1067.
    - Probe 18 giữ ghi kết quả.
    - Bỏ hằng `ER_DUP_KEYNAME` không còn dùng, thêm `ER_INVALID_DEFAULT = 1067`.
  - `probes/sqlserver.probe.test.ts`: probe 3 khẳng định 7 chữ số được nhận; 8 chữ số chỉ ghi kết quả.
- **File thay đổi**: `packages/codegen-conformance/src/probes/mysql.probe.test.ts`, `packages/codegen-conformance/src/probes/sqlserver.probe.test.ts`, file log này.
- **Kiểm tra**
  - `pnpm --filter @schemaforge/codegen-conformance typecheck` / `lint` → thoát mã 0. `prettier --write` trên `src/probes`.
  - `pnpm test:conformance` lần 1 → thoát mã 0, `Tests 53 passed (53)`, `cache miss, executing 18b66087b43cd3e9`, 32.6 s.
  - `pnpm test:conformance` lần 2 → thoát mã 0, `cache hit, replaying logs 18b66087b43cd3e9`, `Cached: 3 cached, 3 total`, `>>> FULL TURBO` (39 ms).
  - Kết quả cuối của các probe đã đổi: MySQL 6 `setDefault` được nhận (ghi kết quả). MySQL 10 `offset` nhận, `zulu` 1067, `utcWithT` nhận, `utcWithSpace` nhận. MySQL 17 bị từ chối 1067. MySQL 18 cả hai cặp được nhận. SQL Server 3: 7 chữ số được nhận; 8 chữ số được nhận (ghi kết quả). Các probe còn lại giữ nguyên kết quả như bảng ở lượt trước.
- **Quyết định** (nguồn: orchestrator, 2026-10-02)
  - MySQL so định danh không phân biệt hoa thường nhưng phân biệt dấu. Generator chuyển từ so không phân biệt dấu sang so không phân biệt hoa thường; một task core riêng làm việc này.
  - MySQL `ON DELETE SET DEFAULT`: 8.4.11 nhận, nhưng tài liệu MySQL ghi InnoDB không hỗ trợ, nên generator vẫn hạ cấp. Probe 6 chỉ ghi kết quả.
  - MySQL `timestamptz`: `Z` và `-00:00` bị từ chối 1067, còn `+00:00` được nhận. Một task core riêng sửa `sql-literals.ts` để đổi `Z` và `-00:00` thành `+00:00` cho MySQL.
  - SQL Server: 8 chữ số giây lẻ được nhận; hàm literal vẫn cắt về 7 chữ số. Probe 3 chỉ ghi kết quả với 8 chữ số.
  - MySQL 18: chỉ ghi kết quả; không cần task bổ sung danh sách R12.
  - Quyết định của tôi: thêm ca `ma`/`MA` vào probe 1. Lý do: quyết định mới dựa vào việc MySQL không phân biệt hoa thường, nên điều đó cũng cần được ghim.
- **Việc còn lại**: không có trong Task 8. Task core riêng do orchestrator tạo: so định danh không phân biệt hoa thường thay cho không phân biệt dấu; `sql-literals.ts` đổi `Z` và `-00:00` thành `+00:00` cho MySQL.
- **Ghi chú cho người tiếp theo**
  - Task 15, 16 có thể bắt đầu theo các quyết định trên. Probe là hợp đồng hành vi của database: đổi kỳ vọng phải có quyết định của orchestrator.
  - Docker Desktop đang chạy.
