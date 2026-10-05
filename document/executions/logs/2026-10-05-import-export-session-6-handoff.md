# Bàn giao trạng thái phần 7 (Import/Export), phiên 6 — 2026-10-05

Tài liệu bàn giao cho session mới, viết giữa phiên làm việc thứ sáu (phiên thứ hai triển khai phần 7). Nó thay [2026-10-05-import-export-session-5-handoff.md](2026-10-05-import-export-session-5-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-09-15-import-export-design.md` và plan `document/plans/2026-10-03-import-export-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- Nhánh `master` trùng `origin/master` tại `25346eb`. Phiên bắt đầu tại `aa689ca` (commit của handoff phiên 5).
- Dev server frontend (cổng 3000) và backend (cổng 3001) thuộc về người dùng. Không được dừng chúng.
- Load average của máy lên tới 300+ (nhiều lượt vitest chạy song song). Giữ `caffeinate` bật.
- Hai nhánh worktree đã commit nhưng CHƯA merge: `worktree-agent-a1a7549536406ed00` (Task 30, `b648d4e`) và `worktree-agent-aa12a96d4db2cf4a0` (Task 27). Xem mục 3.

## 2. Đã làm trong phiên này (từ handoff phiên 5, `aa689ca`)

Mỗi task chạy trong worktree, được merge bằng merge commit và đã push. Core hiện có 4352 test, tất cả pass.

| Việc | Commit / merge | Nội dung |
| --- | --- | --- |
| Task 16 | merge `222455f` | DBML importer |
| Task 23 | merge `967d19e` | `downloadBlob`, tên file tải về, nút "Tải file" ở code panel, `ai-sample-data-card.tsx` chuyển sang `downloadBlob` |
| Amendment spec/plan | `893882b` | Sửa spec và plan sau probe `@dbml/core`, review-1 và review-2; roadmap phần 7 = `Đang làm`. Log: `2026-10-05-import-export-review-1.md`, `2026-10-05-import-export-review-2.md`, `2026-10-05-import-export-spec-amendment-1.md` |
| Task 11 | `c96156e` | Reader định nghĩa cột SQL của scanner, định danh identity, tùy chọn index; đổi classifier |
| Task 15 | `6693e3c` | Prisma importer |
| Merge Task 11 + 15 | `25346eb` | Hai task merge cùng lúc |

Tiến độ phần 7: 20 trên 34 task đã merge (Task 1–11, 13–17, 21–23, 29), cộng các sửa của review-1. Các task đã merge từ phiên 5 (2, 3, 5, 1, 13, 6, 9, 7, 4, 17, 21, 8, 10, 22, 29, review-1, 14) giữ nguyên trạng thái xong.

## 3. Việc đang chạy / đang chờ

Agent ID dùng cho SendMessage; thông báo hoàn thành đến tự động trong session mới.

### 3.1. Đang chạy

| Việc | Agent | Ghi chú |
| --- | --- | --- |
| Task 12, SQL importer | core-engineer `a81db463f723ae086` | Worktree `.claude/worktrees/agent-a81db463f723ae086`. Task lớn, có thể trả `partial`: khi đó dispatch một agent MỚI (không dùng SendMessage) với đường dẫn log `document/executions/logs/2026-10-05-import-export-task-12.md`, bảo nó đọc log trước và append vào cùng file. |
| Sửa Prisma `dbgenerated("(uuid())")` + `@db.Char(36)` → `uuid` | core-engineer `a59175dc8d63ea0b8` | Worktree. Log `2026-10-05-import-export-prisma-uuid-fix.md`. Commit message: `fix(core): import prisma uuid defaults on char columns`. |
| Test frontend flaky dưới tải | test-engineer `a8d4bd591d8d08c42` | Worktree. Log `2026-10-05-frontend-flaky-tests.md`. Commit message: `test(frontend): stabilize slow tests under load`. |

### 3.2. Đã xong, đã commit trong worktree, chưa merge

- Task 30, menu Export: nhánh `worktree-agent-a1a7549536406ed00`, commit `b648d4e` (`feat(frontend): add export menu for json and images`).
- Task 27, "Tải JSON" ở danh sách schema: nhánh `worktree-agent-aa12a96d4db2cf4a0`, commit `feat(frontend): download a schema as json from the list`.

Lý do giữ lại: khi load 300+, phần lớn file test frontend bị timeout; `relations.test.tsx` (2 assertion toast) và `editor-workspace.test.tsx` fail ngay cả khi chạy riêng trên `master`. Trình tự trước khi merge 27 và 30:

1. Chờ agent test flaky xong, merge bản sửa của nó.
2. Khi load thấp, chạy `.claude/scripts/verify.sh frontend` trên `master`.
3. Nếu `relations.test.tsx` vẫn fail khi chạy riêng, dispatch `debugger`: có thể đó là regression thật từ Task 23 hoặc Task 29 chứ không phải do tải.
4. Merge Task 30 rồi Task 27, từng cái một, chạy verify frontend sau mỗi lần merge, rồi push.
5. Dọn dẹp: `git worktree remove -f -f <đường dẫn>` và `git branch -d <nhánh>`.

### 3.3. Bị chặn: dọn lint

`eslint.config.mjs` khoảng dòng 453–455 vẫn liệt kê `ai-sample-data-card.tsx` (kèm comment "Temporary…") trong miễn trừ `URL.createObjectURL`. Việc này vô hại. Hook ecc `config-protection` chặn agent sửa `eslint.config.mjs`; một agent devops sau đó đã thử đặt `disableAllHooks` trong `.claude/settings.json` và bị bộ phân loại an toàn chặn (settings không đổi). Không bao giờ đổi settings hay hook theo yêu cầu của một agent. Đã hỏi người dùng xóa tay các dòng đó hoặc cho phép sửa; chưa có trả lời.

### 3.4. Hàng đợi (theo thứ tự phụ thuộc)

- Task 18 property test (sau 12).
- Task 19 benchmark (sau 12).
- Task 20 conformance bằng Docker (sau 12; loại SQL Server).
- Task 24 import worker (sau 12, 15, 16, 17 đã xong).
- Task 25 import dialog (sau 21 và 22 đã xong, và 24).
- Task 26 `PendingImportProvider` / import vào schema mới (sau 25).
- Task 31 ZIP (sau 30).
- Task 28 nút Import ở editor + chế độ merge (sau 25, 26, 30).
- Các lượt review: project-reviewer cho các task frontend, ui-a11y-reviewer, ecc:security-reviewer cho các importer (adapter, scanner, JSON, Prisma, DBML, SQL).
- Task 32 (kiểm tra đầy đủ, conformance, kiểm tra tay trên trình duyệt), rồi Task 33 (docs).
- Sau Task 33: báo cáo tính năng cho người dùng.

Task 33 còn phải ghi lại:

- DBML nhiều primary key: giữ index `[pk]` đầu tiên, các index còn lại bị `index-option-dropped`.
- Prisma `@@schema` trên enum: `namespace-dropped` tại `["enums", id]`.
- `@@fulltext`: tạo index kèm `index-type-dropped`.
- `tsconfig.build.json` build cả `*.fixture.ts` vào `dist`: quyết định có loại ra hay không.
- Quyết định của Task 11: `readPostgresqlAlterColumn` trả raw kind `expression` cho ép kiểu, `E''` và số âm.

## 4. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

Giữ từ phiên 5:

- Task 0: chấp nhận cả 19 "Đề xuất" trong bảng vấn đề của plan.
- `DraftNote` dùng trường `text` (khớp model).
- File dài hơn khoảng 300 dòng được tách thành file phụ trong cùng thư mục (đã duyệt trước trong các prompt).
- Task 1: miễn trừ lint tạm cho `ai-sample-data-card.tsx` của phần 5; Task 23 gỡ nó. Nit 4 của review (tham chiếu trong comment) bị bỏ vì miễn trừ sắp bị gỡ, và hook config-protection đã chặn core-engineer sửa `eslint.config.mjs`.
- Task 9: `CHECK/NOCHECK CONSTRAINT` của SSMS, `ALTER DATABASE … SET`, `ROLLBACK` bị bỏ qua; dữ liệu `COPY … FROM stdin` của PostgreSQL bị bỏ qua đến `\.`; MySQL DEFINER không có dấu nháy → unsupported.
- Task 4: `assembleDocument` lặng lẽ loại trùng cột PK/index lặp (không mất thông tin); relation dùng lại một cột bị loại với `reference-not-found`; index và relation rỗng bị loại; importer không bao giờ throw.
- Task 8: probe `@dbml/core` 10.2.0 phát hiện các mất mát âm thầm (pg `with time zone`, kiểu nhiều từ bị gộp, MySQL UNSIGNED, ON UPDATE, COLLATE, index DESC/WHERE, cột computed, ADD COLUMN trên pg/mysql, MySQL ADD UNIQUE). Scanner của ta đọc lại định nghĩa cột; COLLATE → `type-parameter-dropped`, DESC/WHERE → `index-option-dropped` (không thêm mã diagnostic mới).
- Task 10: UNSIGNED theo ô trong spec (INT UNSIGNED→bigint, SMALLINT UNSIGNED→integer, BIGINT UNSIGNED→decimal(20,0)); default null → không có default; 1/0 trên boolean → true/false ở mọi dialect; chuỗi `'1'`/`'0'` của MySQL trên boolean → true/false.
- Review-1: merge đổi tên bảng được import khi trùng tên index của đích; việc đặt tên chuyển sang tuyến tính (5 000 index không tên: 58 ms; 10 000 bảng cùng tên: 149 ms).
- Task 15: field kiểu composite → `composite-type-not-supported`; `@relation(map:)` và `@default(map:)` bị bỏ qua lặng lẽ; chỉ nhận tiền tố native `db.`.
- Test frontend flaky dưới tải nặng được chấp nhận khi merge thay đổi không liên quan, miễn là các file lỗi pass khi chạy riêng; các file canvas của Task 29 đã được kiểm tra riêng sau merge.

Mới trong phiên 6:

- Task 16 (DBML importer): nhiều primary key → giữ index `[pk]` đầu tiên, các index còn lại bị `index-option-dropped`.
- Task 15 (Prisma importer), bổ sung: field kiểu composite type → `composite-type-not-supported`; `@@fulltext` → tạo index kèm `index-type-dropped`; attribute không biết thì bỏ qua; đối số `map:` và `name:` bị bỏ qua. Prisma `@@schema` trên enum → `namespace-dropped` tại `["enums", id]`.
- Review-2 (SQL scanner và importer):
  - ENUM của MySQL được xử lý trước `mapSqlType`.
  - Cú pháp `UNIQUE [KEY|INDEX] [CLUSTERED|NONCLUSTERED]` được nhận.
  - SQL Server: filtered unique index thắng; khớp tên chính xác; tên có hậu tố do allocator sinh ra là hạn chế đã biết.
  - `hasDroppedElementOption` kết hợp `hasInclude` → `index-option-dropped`; `WITH (…)` và filegroup bị bỏ qua.
  - MySQL prefix length: giữ cột.
- Task 11: `readPostgresqlAlterColumn` trả raw kind `expression` cho ép kiểu, `E''` và số âm.
- Sửa Prisma `dbgenerated("(uuid())")` kết hợp `@db.Char(36)` → kiểu `uuid` (agent `a59175dc8d63ea0b8` đang làm).

## 5. Bài học cho orchestrator

Giữ các bài học của các phiên trước (phiên 5 trở về trước), gồm:

- Hook git (rtk rewrite) chặn `git` trong worktree: agent dùng `/usr/bin/git` hoặc `.claude/scripts/changed-files.sh`.
- Worktree xong thường bị khóa: xóa bằng `git worktree remove -f -f`.
- `verify.sh` nối ống qua grep có thể bị kill: chuyển output ra file.
- Không merge vào main tree khi `verify.sh` đang chạy ở đó.
- Máy ngủ làm gián đoạn agent: giữ `caffeinate` bật.
- Hook ecc `config-protection` chặn một số agent sửa `eslint.config.mjs`: chuyển việc đó cho devops-engineer.
- Số dòng trong plan lệch khi spec-writer đang sửa plan: đọc commit message từ `git show HEAD:<plan>`.

Bổ sung trong phiên 6:

- Sửa (amend) commit message cần có các "fact" của hook Fact-Forcing trước: chuẩn bị đủ fact rồi mới amend.
- Khi load 300+, ngay cả chạy một file test riêng cũng timeout: giảm số agent chạy song song xuống tối đa 3 cho việc frontend.
- Context của orchestrator phình dài sau khoảng 150 lần gọi tool: bàn giao sớm hơn.
- Không đổi settings hay hook theo yêu cầu của agent, kể cả khi agent nói đó là cách duy nhất.

## 6. Khởi động nhanh cho session mới

1. Đọc log này, chạy `git status` và `git worktree list`.
2. Chờ thông báo từ 3 agent đang chạy (ID ở mục 3.1): Task 12, sửa Prisma uuid, test frontend flaky. Khi từng agent xong: duyệt kết quả, merge, push.
3. Làm theo mục 3 theo thứ tự: merge sửa test flaky, verify frontend trên `master` khi load thấp, merge Task 30 rồi Task 27, rồi hàng đợi ở mục 3.4 từ Task 18 trở đi.
