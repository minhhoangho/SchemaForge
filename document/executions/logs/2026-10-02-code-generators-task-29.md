# Task 29: Conformance DDL và seed SQL trên ba database

- Plan: [Task 29](../../plans/2026-09-15-code-generators-plan.md#task-29-conformance-ddl-và-seed-sql-trên-ba-database)
- Spec: [Code generators](../../specs/2026-09-14-code-generators-design.md) (mục 7, dòng CG-01, CG-08; mục 4 "Cột `AUTO_INCREMENT` trên MySQL", R8, R14)

## 2026-10-03 04:20 — core-engineer — Bị chặn

- **Đã làm**
  - Viết đủ bốn file test theo plan. Mỗi test tạo một database mới `f_<số thứ tự>` (đếm theo test, vì mỗi fixture có nhiều test và test lọc unique của SQL Server ghi dữ liệu), chạy DDL trong đó và đóng session trong `afterEach`. Schema đưa vào generator là `withDialectCustomTypes(fixture.schema, dialect)`. Output rỗng thì không gửi.
  - `postgresql.test.ts`: mỗi fixture `runs the ddl without errors and creates every table`, `creates one foreign key per relation that the generator kept` (`pg_constraint` với `contype = 'f'`). Fixture `naming-edge`: `stores comments with every quote character` so `obj_description` của mọi bảng với comment gốc (comment rỗng là `NULL`).
  - `mysql.test.ts`: hai test chung như trên (`information_schema.TABLE_CONSTRAINTS`), cộng `uses the accent-sensitive collation` cho mọi fixture. `target-limit`: `stores truncated comments at the MySQL limits` so nguyên nội dung comment đã lưu với comment gốc cắt về 1024 (cột) và 2048 (bảng) code point, cho mọi comment vượt giới hạn. `naming-edge`: `keeps columns that differ only by an accent` so danh sách cột của `người dùng` theo `ORDINAL_POSITION` với schema.
  - `sqlserver.test.ts`: hai test chung (`sys.foreign_keys`), cộng `writes cascade conflicts as no action` cho mọi fixture: khóa ngoại được ghép với quan hệ theo bảng tham chiếu và tập cột. `target-limit`: `stores truncated descriptions at 3750 characters` và `accepts more than one null in a filtered unique index` (chèn hai dòng `NULL` vào `nullable_unique.alt_code`).
  - `seed-sql.test.ts`: ba `describe` tuần tự theo dialect, mỗi cái tự khởi động và dừng server. Mỗi fixture có `runs the seed after the ddl without errors` và `inserts the row count of the dataset into every table`. PostgreSQL `target-limit` có thêm `fills deferred relations by update`.
- **File thay đổi**
  - `packages/codegen-conformance/src/postgresql.test.ts` (mới)
  - `packages/codegen-conformance/src/mysql.test.ts` (mới)
  - `packages/codegen-conformance/src/sqlserver.test.ts` (mới)
  - `packages/codegen-conformance/src/seed-sql.test.ts` (mới)
  - `document/executions/logs/2026-10-02-code-generators-task-29.md` (mới)
- **Kiểm tra** (Node v24.21.0, root worktree)
  - `.claude/scripts/worktree-setup.sh <worktree>`: `RESULT: PASS`. `docker info`: `docker-ok`. `pnpm --filter @schemaforge/core build`: thoát mã 0.
  - Lần chạy đầu `postgresql.test.ts` bị chặn do môi trường: `Error: (HTTP code 500) server error - Get "https://registry-1.docker.io/v2/": EOF` (image `postgres:18-alpine` chưa có trong máy). Sau `docker pull postgres:18-alpine` thành công thì chạy lại được.
  - `vitest run src/postgresql.test.ts`: 9/9 pass, 10.9s.
  - `vitest run src/mysql.test.ts`: 10 pass, 4 fail (cả bốn test của `target-limit`), lỗi của generator, xem bên dưới.
  - `vitest run src/sqlserver.test.ts`: 14 test bị skip vì `beforeAll` lỗi môi trường: `Error: Log stream ended and message "/.*Recovery is complete.*/" was not received`. Chạy tay `mcr.microsoft.com/mssql/server:2022-latest` thì container thoát mã 114: `Detected 1578 MB of RAM, 254 MB of available memory`, `Failed allocate pages: FAIL_PAGE_ALLOCATION 1`. VM Docker chỉ có 2 GB (`docker info`: `mem=2067832832`) và đang chạy sẵn các container của người dùng (`local_kafka`, `local_elasticsearch`, `local_mongo`, `local_postgres`, `local_rabbitmq`, `local_redis`, `local_kafka_ui`). Không dừng container của người dùng.
  - `vitest run src/seed-sql.test.ts`: 15 pass (PostgreSQL 9, MySQL 6), 2 fail (MySQL `target-limit`, cùng lỗi generator), 8 skip (SQL Server, cùng lỗi môi trường). Sau khi đổi `readRowCounts` sang tuần tự: `-t "postgresql"` cho 9 pass và hết `DeprecationWarning` của `pg`.
  - `pnpm --filter @schemaforge/codegen-conformance typecheck`, `lint`: thoát mã 0. `pnpm exec prettier --check` bốn file: `All matched files use Prettier code style!`.
  - Chưa chạy `pnpm test:conformance` ở root: chắc chắn đỏ vì hai nguyên nhân trên.
- **Lỗi generator (MySQL, CG-01)**: nguyên văn từ `mysql.test.ts`, fixture `target-limit`, cả bốn test:
  ```
  Error: Incorrect table definition; there can be only one auto column and it must be defined as a key
   ❯ Object.execute src/support/containers.ts:130:26
   ❯ runDdl src/mysql.test.ts:79:19
  ```
  Và từ `seed-sql.test.ts`: `codes: [1075]`, sau đó seed lỗi `1146 Table 'f_14.auto_trailing' doesn't exist`. Nguyên nhân: generator MySQL ghi index thay thế của cột `AUTO_INCREMENT` (spec mục 4, R8, R14) thành câu riêng `CREATE INDEX \`auto_trailing_id_idx\` ON \`auto_trailing\` (\`id\`);` và `CREATE INDEX \`auto_wide_key_id_idx\` …` ở bước 3, sau mọi `CREATE TABLE` (snapshot `packages/core/src/generators/__snapshots__/mysql/target-limit.sql` dòng 305, 306). MySQL kiểm tra lỗi 1075 ngay lúc `CREATE TABLE`, nên index phải nằm trong `CREATE TABLE` (ví dụ `INDEX \`auto_trailing_id_idx\` (\`id\`)`). Spec mục 4 chỉ ghi "thêm `INDEX`", còn thứ tự câu lệnh ở CG-01 đặt index sau bảng: cần sửa spec (vị trí của index này) và generator MySQL (cùng snapshot `mysql/target-limit.sql`). Hai bảng bị lỗi: `auto_trailing` (khóa chính `(a, id)`, cột auto đứng sau) và `auto_wide_key` (khóa chính bị bỏ vì quá dài).
- **Quyết định**
  - Mỗi test có database riêng thay vì mỗi fixture một database: plan đóng session trong `afterEach`, và test chèn dữ liệu của SQL Server không được ảnh hưởng test khác.
  - Số khóa ngoại kỳ vọng tính từ diagnostic `key-column-type-not-indexable` có `path[0] === "relations"`, đúng như plan.
  - SQL Server `stores truncated descriptions…` so nội dung đã lưu với comment cắt ở 3750 code unit UTF-16 tại ranh giới code point, không so `LEN` lớn nhất bằng 3750 như plan: comment `surrogate_note` của `target-limit` có cặp surrogate nằm vắt qua vị trí 3750, nên theo spec mục 4 ("cắt ở ranh giới code point") giá trị đúng dài 3749.
  - MySQL so nguyên nội dung comment thay vì chỉ `CHAR_LENGTH`: chặt hơn, và vẫn khẳng định độ dài 1024 và 2048.
  - `uses the accent-sensitive collation` chạy trên mọi fixture. Giới hạn đã biết: `startDatabaseServer("mysql")` tạo database với `utf8mb4_0900_as_ci` sẵn, nên test này không phân biệt được generator có ghi `COLLATE` hay không (không được sửa `src/support/`).
  - `writes cascade conflicts as no action` chạy trên mọi fixture (`sample`, `naming-edge` cũng có `referential-action-cycle`). Constraint name là nội bộ của generator, nên khóa ngoại được ghép theo bảng và tập cột tham chiếu.
  - Quan hệ "hoãn" của seed được suy từ thứ tự nạp của `buildSeedDataset`: bảng nguồn nạp trước bảng đích (tự tham chiếu không tính). Số `NULL` đếm bằng một câu SQL cố định: `query_to_xml(format('… %I …'))` trên `pg_constraint`, nên tên bảng, cột không bị nối vào SQL trong test.
  - Câu `INSERT` của test lọc unique viết cứng tên `nullable_unique` (SQL cố định trong test, theo plan).
  - Helper (`runDdl`, `countKeptRelations`, `readCount`) lặp lại ở ba file DDL: plan chỉ cho tạo bốn file này và cấm sửa `src/support/`.
  - `readRowCounts` của seed chạy tuần tự: một client `pg` không cho các query chồng nhau (cảnh báo bỏ ở pg@9).
- **Việc còn lại**
  - [ ] Orchestrator tạo task sửa spec mục 4 và CG-01 (index thay thế của cột `AUTO_INCREMENT` trên MySQL phải nằm trong `CREATE TABLE`), rồi sửa `packages/core/src/generators/mysql/` và ghi lại snapshot `mysql/target-limit.sql`. Sau đó chạy lại `pnpm --filter @schemaforge/codegen-conformance exec vitest run src/mysql.test.ts` và `src/seed-sql.test.ts`: 4 test MySQL `target-limit` và 2 test seed MySQL `target-limit` phải xanh. Kiểm tra cả Prisma `mysql` và Drizzle MySQL nếu cùng quy tắc (spec mục 4 dòng "Cột `AUTO_INCREMENT` không đứng đầu khóa").
  - [ ] Chạy `src/sqlserver.test.ts` và phần SQL Server của `src/seed-sql.test.ts` trên máy có Docker đủ bộ nhớ: tăng RAM của Docker Desktop lên ít nhất 4 GB, hoặc tạm dừng các container `local_*` của người dùng (cần người dùng đồng ý). Kiểm tra `docker run --platform linux/amd64 -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=… mcr.microsoft.com/mssql/server:2022-latest` không còn thoát mã 114. 14 test SQL Server và 8 test seed SQL Server chưa từng chạy, nên có thể còn lỗi generator chưa thấy.
  - [ ] Sau hai mục trên, chạy `pnpm test:conformance` ở root một lần và ghi số test, thời gian.
  - [ ] Bước kiểm tra test bắt lỗi (plan mục "Test viết trước"): các test PostgreSQL và MySQL không thuộc `target-limit` xanh từ lần đầu. Phía MySQL đã có bằng chứng đỏ thật (lỗi 1075 ở trên). Chưa chạy thử bản sao test có output bị sửa cho PostgreSQL.
- **Ghi chú cho người tiếp theo**
  - Chạy file conformance trong nền (`run_in_background`): kéo image và khởi động container có thể vượt 600s khi máy chậm hoặc ngủ.
  - Ảnh `postgres:18-alpine` giờ đã có trong máy. Docker Hub từng trả `EOF` khi kéo.
  - Generator có kiểu `Generate<T>` nên gọi với `{}` làm tham số thứ hai.

## 2026-10-03 04:55 — core-engineer — Xong (SQL Server chưa chạy, theo quyết định của người dùng)

- **Đã làm**
  - Đưa worktree lên `master` (`26cbad2`, có `2a8d1b6` sửa MySQL, generator Drizzle, sửa seed) bằng một commit tạm `test: wip`, `rebase master`, rồi `reset --soft HEAD~1` và `reset`: bốn file test và log trở lại trạng thái chưa commit, nội dung không đổi. `pnpm install --frozen-lockfile`, `pnpm --filter @schemaforge/core build`: thoát mã 0.
  - Chạy lại các test PostgreSQL và MySQL: tất cả xanh, kể cả 4 test MySQL `target-limit` và 2 test seed MySQL `target-limit` từng đỏ vì lỗi 1075.
  - Kiểm tra test bắt lỗi cho PostgreSQL (plan mục "Test viết trước"): tạm sửa `runDdl` trong `postgresql.test.ts` để bỏ câu `ALTER TABLE … FOREIGN KEY …` đầu tiên khỏi output trước khi `execute`. Kết quả: `Tests  3 failed | 6 passed (9)`, `creates one foreign key per relation that the generator kept` đỏ ở `sample` (`expected 6 to be 7`), `naming-edge` (`expected 1 to be 2`), `target-limit` (`expected 16 to be 17`). Đã hoàn tác; file giống hệt bản trước (so với commit tạm qua `git diff --no-index`), chạy lại 9/9 xanh.
  - Không đụng `sqlserver.test.ts` và phần SQL Server của `seed-sql.test.ts`.
- **File thay đổi**
  - `document/executions/logs/2026-10-02-code-generators-task-29.md` (thêm entry này). Bốn file test không đổi so với entry trước.
- **Kiểm tra** (Node v24.21.0)
  - `vitest run src/postgresql.test.ts`: `Tests  9 passed (9)`, 4.09s.
  - `vitest run src/mysql.test.ts`: `Tests  14 passed (14)`, 16.01s.
  - `vitest run src/seed-sql.test.ts -t "seed sql on (postgresql|mysql)"`: `Tests  17 passed | 8 skipped (25)`, 21.96s (PostgreSQL 9, MySQL 8; 8 test SQL Server bị lọc).
  - `pnpm --filter @schemaforge/codegen-conformance typecheck`, `lint`: thoát mã 0, không lỗi.
  - `pnpm exec prettier --check` bốn file: `All matched files use Prettier code style!`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Không chạy `pnpm test:conformance` ở root (sẽ đỏ ở SQL Server do môi trường).
- **Quyết định**
  - Người dùng chọn bỏ qua SQL Server lúc này: VM Docker có 2 GB, phần lớn đã dùng cho container của người dùng. Không dừng, tạm dừng hay động vào container `local_*` nào. `sqlserver.test.ts` và phần SQL Server của `seed-sql.test.ts` giữ nguyên như đã viết, vẫn qua typecheck và lint.
  - Bước kiểm tra bắt lỗi dùng phép sửa "bỏ một khóa ngoại" thay vì làm câu SQL sai cú pháp: phép này không làm DDL lỗi nên chứng minh được test đếm khóa ngoại kiểm tra đúng nội dung database, không chỉ việc DDL chạy được.
- **Việc còn lại**
  - [ ] Chạy `pnpm --filter @schemaforge/codegen-conformance exec vitest run src/sqlserver.test.ts` (14 test) và `src/seed-sql.test.ts -t "seed sql on sql server"` (8 test) trên một host Docker còn trống ít nhất 4 GB RAM (image `mcr.microsoft.com/mssql/server:2022-latest` thoát mã 114 khi chỉ còn khoảng 254 MB, xem entry trước). 22 test này chưa từng chạy lần nào, nên có thể còn lỗi generator SQL Server (CG-01, CG-08) chưa thấy; đỏ thì ghi output nguyên văn và orchestrator tạo task sửa generator, không sửa trong task này.
  - [ ] Sau đó chạy `pnpm test:conformance` ở root một lần, ghi số test và thời gian vào log này. Phần 6 chưa được coi là xong cho tới khi bước này xanh (plan, cổng conformance).
- **Ghi chú cho người tiếp theo**
  - Cách chạy riêng một dialect của seed: `-t "seed sql on postgresql"`, `-t "seed sql on mysql"`, `-t "seed sql on sql server"`; `beforeAll` của dialect bị lọc không khởi động server.
  - Image `postgres:18-alpine` và MySQL đã có sẵn trên máy này; mỗi file chạy dưới 30s.
