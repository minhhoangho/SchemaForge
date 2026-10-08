# Dòng lệnh meta của psql trong importer SQL PostgreSQL

Không thuộc task riêng trong plan; làm mục A của [review 5](2026-10-05-import-export-review-5.md) cho Task 12 trong [plan phần 7](../../plans/2026-10-03-import-export-plan.md), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md) (mục 5, bản sửa lần 2, [log](2026-10-05-import-export-spec-amendment-2.md)).

## 2026-10-08 20:33 — core-engineer — Xong

- **Đã làm**
  - Scanner PostgreSQL (`statement-scanner.ts`): dòng có `\` là ký tự đầu tiên (cho phép thụt lề bằng dấu cách, tab) ở ngoài chuỗi, dollar quote, comment và định danh trong quote là lệnh meta của psql, kết thúc ở cuối dòng chứ không ở `;`. Trước đây `\connect db` chạy tới `;` tiếp theo và nuốt `CREATE TABLE` sau nó.
  - `\restrict`, `\unrestrict`, `\connect`, `\c` (so tên phân biệt hoa thường như psql) không tạo câu lệnh nào, nên bị bỏ qua không diagnostic. Lệnh meta khác là một câu lệnh gồm một token `symbol` chứa cả dòng (bỏ khoảng trắng cuối); bộ phân loại không thấy từ khóa đầu nên xếp `unsupported`, tức `statement-not-supported` tại vị trí `\`.
  - Câu lệnh đang mở (chưa có `;`) trước dòng lệnh meta kết thúc tại token cuối của nó.
  - Tách hai helper `finishOpenStatement` và `pushToken` (dùng chung với `scanStep` và cuối `scanSqlStatements`); giới hạn `MAX_SCANNED_TOKENS` vẫn áp dụng, mỗi dòng lệnh meta giữ lại tính là một token. `MAX_DELIMITER_LENGTH` không đổi. `sql-lexer.ts` không cần sửa.
  - `PG_DUMP_EXPECTED_DIAGNOSTICS`: bỏ hai `statement-not-supported` ở dòng 5 (`\restrict`) và dòng 220 (`\unrestrict`); document kỳ vọng không đổi.
- **File thay đổi**
  - `packages/core/src/importers/sql/statement-scanner.ts`
  - `packages/core/src/importers/sql/statement-scanner.test.ts`
  - `packages/core/src/importers/sql/import-sql.test.ts`
  - `packages/core/src/importers/sql/fixtures/pg-dump.fixture.ts`
- **Kiểm tra**
  - RED: `test-file.sh core src/importers/sql/statement-scanner.test.ts`: 13 test mới fail (ví dụ `drops the psql meta-command line "\\connect shop" and keeps the next statement`). Hai test importer mới chạy trên scanner cũ: fail với `expected { tables: [], …(1) } to strictly equal { tables: [ 't' ], diagnostics: [] }`.
  - GREEN: `vitest run src/importers/sql`: 14 file, 623 test pass.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS`, exit 0; 4647 test pass; line coverage 97.98%.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Lệnh meta bị bỏ qua được scanner bỏ luôn (không tạo câu lệnh) thay vì thêm luật vào `classify-statement.ts`: kết quả quan sát được giống hệt loại `ignored` (bị che, không diagnostic) và giữ thay đổi trong file được giao.
  - Lệnh meta khác thành một token `symbol` chứa cả dòng thay vì đưa qua lexer: tham số của lệnh meta không phải SQL (ví dụ `\echo it's` có dấu nháy lẻ sẽ làm lexer báo `syntax-error`).
  - Chỉ nhận `\` ở đầu dòng (sau thụt lề), như spec ghi; `\` giữa dòng (`SELECT 1 \gset`) vẫn là token `symbol` như cũ. Chỉ áp dụng cho dialect `postgresql`.
  - Câu đang mở trước dòng lệnh meta được kết thúc ở đó thay vì nối tiếp sau dòng meta như psql: nối tiếp sẽ để văn bản lệnh meta nằm trong vùng câu lệnh đưa cho parser. Ngoài chuỗi, `\` đầu dòng không phải cú pháp SQL hợp lệ nên không mất câu hợp lệ nào.
  - Chi phí tuyến tính: kiểm tra đầu dòng chỉ lùi qua dấu cách, tab ngay trước `\`, và cả dòng lệnh meta được bỏ qua trong một bước.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: `worktree-setup.sh` và lệnh có chuyển hướng output tới đường dẫn chứa `Github` bị hook chặn ("names git in a form too complex"); chạy `pnpm install --frozen-lockfile` và `pnpm turbo run build --filter '@schemaforge/frontend^...' --filter '@schemaforge/backend^...'` trực tiếp, đọc output qua `| tail`.
