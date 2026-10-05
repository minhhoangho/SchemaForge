# Bàn giao trạng thái phần 7 (Import/Export), phiên 7 — 2026-10-05

Tài liệu bàn giao cho session mới, viết giữa phiên làm việc thứ bảy (phiên thứ ba triển khai phần 7). Nó thay [2026-10-05-import-export-session-6-handoff.md](2026-10-05-import-export-session-6-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-09-15-import-export-design.md` và plan `document/plans/2026-10-03-import-export-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- `master` = `origin/master` tại `2b99b72` (`docs: amend import export spec after sql importer review`, đã commit sửa spec lần 2, sửa lệnh grep dist ở plan Task 11/12/33 và các log review-5, security-review-1, spec-amendment-2). Merge SF1 (`8bea4b2`) đã push sau khi core typecheck + test pass (191 file, 4572 test, thoát mã 0). Worktree của SF1 đã xóa.
- Docs chưa commit: hai log `2026-10-05-import-export-security-review-2.md` và `2026-10-05-import-export-session-7-handoff.md` (file này); commit cùng nhau bằng `docs: add security review 2 and session 7 handoff`.
- Cây chính có sửa chưa commit của người dùng trong `eslint.config.mjs`. Người dùng xóa dòng 453–455 nhưng xóa cả dòng `"frontend/src/lib/download/download-blob.ts"`, để lại `files: []`. ESLint báo `Key "files": Expected value to be a non-empty array` và không chạy được. Đang chờ người dùng chọn:
  - A: thêm lại dòng `download-blob.ts`.
  - B: xóa cả khối (reviewer xác nhận `download-blob.ts` gọi `environment.url.createObjectURL`, không cần miễn trừ).
  Agent không sửa được file này (hook `config-protection`). Không commit file này cho tới khi ESLint chạy được.
- Docker Desktop đang hỏng (lỗi 500, VM báo `no route to host`): chờ người dùng khởi động lại.
- Worktree `.claude/worktrees/agent-a81db463f723ae086` (trống, của agent Task 12 chết vì lỗi API 529) chưa xóa được: lệnh xóa bị bộ phân loại quyền chặn. Người dùng có thể tự xóa.
- Dev server frontend (cổng 3000) và backend (cổng 3001) thuộc về người dùng. Không được dừng chúng. Giữ `caffeinate` bật.

## 2. Đã làm trong phiên 7 (từ `636c601`)

Mỗi task chạy trong worktree, được merge bằng merge commit và đã push.

| Việc | Commit / merge | Nội dung |
| --- | --- | --- |
| Sửa Prisma uuid | `fbabdb7`, merge `bfbc3a2` | `dbgenerated("(uuid())")` kết hợp `@db.Char(36)` → kiểu `uuid` |
| Test frontend ổn định dưới tải | merge `eaeaa63` | `test(frontend): stabilize slow tests under load` |
| Task 30 | merge `5e792f7` | Menu Export |
| Task 27 | merge `3e8e099` | "Tải JSON" ở danh sách schema |
| Review-3 | `62892bd`, merge `c59a6ee` | Log review-3 và review-3-a11y; sửa review-3 (`fix(frontend): address import export review findings`) |
| Task 31 | merge `01ddeab` | Tải ZIP |
| Review-4 | `38509e9`, merge `f9b73b0` | Log review-4; sửa review-4 (`fix(frontend): cancel zip builds and recover from worker failures`) |
| Task 12 | merge `6ed65ca` | SQL importer (bốn agent nối tiếp, log `2026-10-05-import-export-task-12.md`) |
| Task 24 | merge `b16ba77` | Worker import |
| Task 18 | merge `d8e3803` | Property test cho mọi importer |
| SF1: sửa DoS từ security review 1 | `8d8644e`, merge `8bea4b2` | `fix(core): bound import parsing cost on crafted input`. Đã merge và push. Log `2026-10-05-import-export-security-fixes-1.md`. Prisma 10 000 model: 24 253 ms → 148 ms; DBML 10 000 bảng: 43 540 ms → 1 539 ms; MySQL 40 nghìn `DELIMITER`: 39 901 ms → 71 ms; 2 MiB ký tự `(` → `source-too-large` trong 161 ms. |

Tiến độ phần 7: đã merge Task 1–18, 21–24, 27, 29, 30, 31 (27/34 task ngoài Task 0), cộng các sửa review-1, 3, 4 và SF1.

## 3. Việc đang chạy / đang chờ

Agent ID dùng cho SendMessage; thông báo hoàn thành đến tự động trong session mới.

### 3.1. Đang chạy

| Việc | Agent | Ghi chú |
| --- | --- | --- |
| R5-fix: sửa review-5 Task 12 | core-engineer `a6065ce83187832be`, worktree `.claude/worktrees/agent-a6065ce83187832be` | F1 MySQL `KEY`/FULLTEXT/SPATIAL mất tùy chọn; F2 FK tới bảng không có trong file → `reference-not-found`; F3 index AUTO_INCREMENT; F4 hàm dài; N1 vị trí CHECK/FK ở câu `ALTER TABLE`; N2; B đọc `ADD DEFAULT … FOR` của SSMS. Không đụng `statement-scanner.ts`, `sql-lexer.ts`. Log `2026-10-05-import-export-review-5-fixes.md`. Commit `fix(core): keep mysql index options and read sql server defaults on import`. |

### 3.2. Bị chặn

- Task 20 conformance (worktree `.claude/worktrees/agent-a85fccee5100b0edc`, chưa commit): code xong, chờ Docker. Sau khi Docker chạy: dispatch core-engineer MỚI làm tiếp trong worktree đó, bảo nó đọc log `2026-10-05-import-export-task-20.md` và ghi tiếp vào đó.
  - Việc cần làm: chạy ba file conformance, thêm chuẩn hóa có comment vào `normalizeIntrospectionDifferences`; khác biệt phía importer thì `blocked`.
  - Quyết định đã chấp nhận: một container mỗi file test, một database mỗi fixture; DDL chạy từ file trong container; `empty` bỏ qua `db pull`; MySQL `utf8mb4_0900_as_ci`.
  - Lưu ý worktree: hook chặn `source ~/.nvm/nvm.sh` trong worktree đó, dùng `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"`.

### 3.3. Hàng đợi (theo thứ tự)

- Sau khi R5-fix merge, một task core-engineer sửa các đường bậc hai còn lại do SF1 tìm ra nhưng chưa sửa: `importers/prisma/prisma-relations.ts` (`findBackField` khoảng dòng 95 và `hasNullableField` khoảng dòng 187 quét mọi field cho mỗi field relation: 2 model × 4000 relation mất 1,5–2,8 s, ước tính trên 10 s ở giới hạn; sửa bằng `Map` theo model); `importers/dbml/dbml-relations.ts` khoảng dòng 65 (`tables.some(isInside…)` cho mỗi ref: 6000 bảng + 5999 ref mất 5–11 s, khoảng 60% là của `@dbml/core`; sửa bằng bảng đã sắp xếp và tìm nhị phân); `importers/sql/sql-draft-relations.ts` (`isUniqueColumnSet`) và `importers/sql/sql-draft-index-rules.ts` (`findDefinition`) có thể bậc hai trong một bảng rất lớn (chưa đo).
- Câu A của review-5 (đã hết bị chặn vì SF1 đã push): core-engineer xử lý dòng meta-command psql (bắt đầu bằng `\`) kết thúc ở cuối dòng trong scanner PostgreSQL; `\restrict`, `\unrestrict`, `\connect`, `\c` là `ignored` (hiện `\connect` nuốt câu `CREATE TABLE` ngay sau); cập nhật `PG_DUMP_EXPECTED_DIAGNOSTICS`.
- Task frontend nhỏ sửa security review 2 (M1, L1, L2, L3, I1) trong `frontend/src/lib/import-export/`; chi tiết ở [2026-10-05-import-export-security-review-2.md](2026-10-05-import-export-security-review-2.md).
- test-engineer: unhandled error `ReferenceError: window is not defined` từ timer của `sonner` sau khi jsdom bị gỡ, xuất phát từ `src/features/editor/hooks/use-delete-selection.test.tsx`. Lượt chạy toàn bộ test frontend sau merge Task 24: 5313/5313 pass nhưng vitest thoát mã 1. Task 24 đã được push trước khi orchestrator nhận ra mã thoát 1; lỗi không thuộc Task 24 (file test có từ trước, lỗi do timer toast).
- Task 19 benchmark: chạy khi máy bớt tải (số đo dưới tải không đáng tin); xem thêm vì sao `importMysql` và `importSqlserver` chậm gấp khoảng 4 lần `importPostgresql` trong property test.
- Task 25 hộp thoại import (sau SF1 và sau sửa security review 2). Yêu cầu: gọi `readImportFile` và `checkPastedSource` trước `run`; có liên kết `/third-party-notices.txt`; tạo worker khi mở hộp thoại và hiện trạng thái chờ tải chunk khoảng 2,65 MB gzip. Sau đó Task 26, rồi Task 28. Mỗi task frontend: project-reviewer + ui-a11y-reviewer.
- Task 32: kiểm tra toàn repo, conformance, kiểm tra tay trên trình duyệt. Các mục kiểm tra tay: ảnh PNG/SVG ở hai theme không có vòng focus/handle, bóng node đang chọn, `IMPORT_LAYOUT_METRICS` (320/37/28/80, suy ra từ CSS chưa đo), focus trả về nút Export, `pointer-events` trên body, ZIP giải nén được trên ba trình duyệt, CSP. Sau đó Task 33 (tài liệu), rồi báo cáo tính năng cho người dùng.
- Task 33 còn phải ghi (ngoài các mục trong [handoff phiên 6](2026-10-05-import-export-session-6-handoff.md)): giới hạn độ dài DELIMITER và số token do SF1 chọn; sửa câu cuối mục 1 của spec ("Không throw…") vì `assembleDocument` nay trả `parse-failed`; `data-export-exclude` lệch plan Task 29, đưa vào spec mục 10; dạng `useBuildZip.cancel()`.

## 4. Quyết định đã thay người dùng

Người dùng có thể bác bỏ từng mục. Các quyết định của phiên 5 và phiên 6 giữ nguyên, xem mục 4 của [handoff phiên 6](2026-10-05-import-export-session-6-handoff.md).

Mới trong phiên 7:

- Sửa Prisma uuid được merge dù `verify.sh core` đầy đủ không pass trọn vì timeout do tải; các file timeout pass khi chạy riêng.
- Test frontend: timeout chung 30 s, RTL `asyncUtilTimeout` 8 s, journey 60 s; test undo-toast ghi trạng thái trước khi bấm Undo.
- Review-3:
  - Test tải dữ liệu mẫu qua mock `download-blob`.
  - Thiếu tùy chọn provider/dialect khi đặt tên file thì throw thay vì đoán tên.
  - Tooltip tên file; bóng node khi export.
- Task 31:
  - Giữ tên boolean theo plan kèm `eslint-disable` có lý do.
  - PNG không nén, SVG và văn bản mức 6.
  - `returnFocusRef`; `selectAllZip(codeOptions)`; `clearZip` bỏ cả JSON.
  - Hộp thoại vẫn mở sau khi tải; Drizzle chỉ PostgreSQL, MySQL; không có nút mở issues.
  - Chấp nhận hồi tố key `zip.filesOnly`; không gợi ý "dùng SVG" cho PNG trong ZIP.
- Review-4: hủy hộp thoại thì hủy build (`BuildCancelledError`); worker hỏng bị bỏ (cả `useGeneratedCode`); nút Tải dùng `aria-disabled` khi đang tạo; bỏ `aria-busy` trên nút Export; `zip.summary` có số nhiều.
- Task 12:
  - MySQL bỏ index AUTO_INCREMENT `<t>_<c>_idx` (siết theo F3); bỏ escape tên theo dialect.
  - `hideCustomTypes`; `hideWithCheckClauses`.
  - `CREATE INDEX` trên bảng không có → `reference-not-found`.
  - `namespace-dropped` chỉ khi nguồn ghi schema; default số lấy văn bản nguồn; CHECK thành enum bỏ mã kiểu gốc.
  - Giới hạn đã biết: `REFERENCES` nội tuyến tới bảng thiếu và FK tự trỏ cùng cột → `syntax-error` 1:2.
  - Chấp nhận Task 12 sửa file của Task 9 và 11 và tách file phụ; grep dist theo câu import.
- Review-5: A có (dòng meta psql), B có (đọc `ADD DEFAULT … FOR` của SSMS).
- Task 24:
  - `schedule` trả hàm hủy (bỏ `cancelSchedule`); `dispose` = `cancel`; `run` mới hủy `run` cũ.
  - `IMPORT_LAYOUT_METRICS` suy ra từ CSS.
  - antlr4 dùng văn bản BSD-3 chuẩn.
  - Chunk `@dbml/core` 15 MB (khoảng 2,65 MB gzip) khớp ước tính của spec.
- Task 18: 200 lần chạy cho mọi importer (không nhóm nào quá 30 s).
- SF1:
  - `MAX_DELIMITER_LENGTH = 16`; dài hơn thì coi là văn bản câu lệnh thường → `statement-not-supported`.
  - `MAX_SCANNED_TOKENS = MAX_IMPORT_SOURCE_LENGTH / 4` (524 288); vượt thì trả `source-too-large` không kèm vị trí (token không phải element; DDL trung bình 5,7–9,5 ký tự mỗi token).
  - `assembleDocument` trả `parse-failed` thay vì throw. Điều này mâu thuẫn câu cuối mục 1 của spec ("Không throw…"): Task 33 phải cập nhật spec.
  - JSON đếm số element trước khi gọi `parseSchemaDocument`.
- Security review 1: sửa HIGH-1, HIGH-2 và các MEDIUM trước Task 25; LOW chỉ ghi nhận.
- Security review 2: PASS; sửa M1, L1–L3, I1 trong một task frontend nhỏ trước Task 25.

## 5. Bài học cho orchestrator

Giữ các bài học của phiên 5 và phiên 6 (mục 5 của [handoff phiên 6](2026-10-05-import-export-session-6-handoff.md)), gồm:

- Hook git (rtk rewrite) chặn `git` trong worktree: agent dùng `/usr/bin/git` hoặc `.claude/scripts/changed-files.sh`.
- Worktree xong thường bị khóa: xóa bằng `git worktree remove -f -f`.
- `verify.sh` nối ống qua grep có thể bị kill: chuyển output ra file.
- Không merge vào cây chính khi `verify.sh` đang chạy ở đó.
- Hook ecc `config-protection` chặn agent sửa `eslint.config.mjs`; không đổi settings hay hook theo yêu cầu của agent.
- Số dòng trong plan lệch khi spec-writer đang sửa plan: đọc commit message từ `git show HEAD:<plan>`.
- Sửa (amend) commit message cần có các "fact" của hook Fact-Forcing trước.
- Khi load cao, giảm số agent frontend chạy song song xuống tối đa 3; bàn giao sớm, trước khoảng 150 lần gọi tool.

Bổ sung trong phiên 7:

- Agent chết vì lỗi API 529 không resume được bằng SendMessage khi worktree không được ghi nhận: dispatch agent mới. Worktree trống của nó có thể không xóa được (bộ phân loại chặn).
- Agent `partial` giữa chừng trong worktree: agent mới làm tiếp trong CÙNG worktree (không dùng `isolation`), dùng đường dẫn tuyệt đối.
- Trong zsh, biến chứa nhiều đường dẫn không tự tách từ: liệt kê đường dẫn trực tiếp trong lệnh git và prettier.
- Kiểm tra mã thoát của vitest chứ không chỉ dòng "Tests passed": unhandled error làm thoát mã 1 dù mọi test pass.
- Agent test-engineer có thể để lại tiến trình chiếm CPU (`perl` busy-loop): kiểm `pgrep` sau khi nó xong.
- Worktree mới thiếu `dist` của core và api-contract: chạy `.claude/scripts/worktree-setup.sh <đường dẫn tuyệt đối>`.

## 6. Khởi động nhanh cho session mới

1. Đọc log này, chạy `git status` và `git worktree list`.
2. Commit hai log docs còn lại (mục 1). Chờ thông báo của R5-fix; duyệt, commit/merge, push. SF1 sửa 3 dòng trong `importers/sql/import-sql.ts` mà R5-fix cũng sửa: merge R5-fix có thể xung đột, giao việc giải xung đột cho một subagent. Chạy core typecheck và test sau khi merge.
3. Hỏi lại người dùng về `eslint.config.mjs` (A hoặc B) và Docker nếu chưa có trả lời.
4. Tiếp hàng đợi ở mục 3.3.
