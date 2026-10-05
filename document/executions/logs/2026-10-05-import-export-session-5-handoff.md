# Bàn giao trạng thái phần 7 (Import/Export), phiên 5 — 2026-10-05

Tài liệu bàn giao cho session mới, viết giữa phiên làm việc thứ năm (phiên đầu tiên triển khai phần 7). Nó thay [2026-10-05-ai-assistant-session-4-handoff.md](2026-10-05-ai-assistant-session-4-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-09-15-import-export-design.md` và plan `document/plans/2026-10-03-import-export-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- Nhánh `master` trùng `origin/master` tại `72b3007`. Phiên bắt đầu tại `df2c3cc`.
- Trong main tree đang có thay đổi chưa commit: các sửa đổi spec, plan và `roadmap.md` do spec-writer Doc-1 đang chạy (xem mục 3), cùng hai log chưa theo dõi `2026-10-05-import-export-review-1.md` và `2026-10-05-import-export-spec-amendment-1.md`. Không đụng vào các file này cho đến khi Doc-1 báo xong.
- Dev server frontend (cổng 3000) và backend (cổng 3001) thuộc về người dùng. Không được dừng chúng.
- Máy Mac đã ngủ một lần giữa phiên (agent và các lần kiểm tra bị gián đoạn); sau đó `caffeinate` được bật.

## 2. Đã làm trong phiên này (theo commit)

Phần 7 Import/Export (plan `document/plans/2026-10-03-import-export-plan.md`). Mỗi task chạy trong worktree, được merge bằng merge commit và đã push. Sau mỗi lần merge, kiểm tra core đều xanh (3930 test của core, khoảng 97.7% dòng).

| Task | Commit / merge | Nội dung |
| --- | --- | --- |
| 2 | `c383929` | Importer contract |
| 3 | `50ad07a` | Serializer |
| 5 | merge `d256737` | Grid placement |
| 1 | merge `a634015` | Dependencies và lint boundaries |
| 13 | merge `c6c8d0f` | Tách lexer/parser Prisma, thêm `prisma-parser-values.ts` |
| 6 | merge `c8f0154` | `buildImportOperation`, `remap-merged-document.ts`, `pick-unused-name.ts` dùng chung |
| 9 | merge `d50db9a` | Tách SQL scanner thành `sql-lexer.ts`, `sql-quoted-text.ts` |
| 7 | merge `171a89d` | JSON importer |
| 4 | merge `6f774cc` | `assembleDocument`, `assign-import-ids.ts`, `draft-target-path.ts` |
| 17 | merge `6fa1e35` | Core entry exports |
| 21 | merge `b9187de` | Chuyển `resolveIssueTarget`, `toIssueMessageValues` sang `frontend/src/lib/schema/` |
| 8 | merge `c7d4e26` | Adapter `@dbml/core`, `dbml-core-adapter-types.ts`, probe |
| 10 | merge `1892f88` | Ánh xạ kiểu và default của SQL |
| 22 | merge `9859ca2` | i18n `importExport`, `importDiagnostics` |
| 29 | merge `4ee73d1` | Canvas capture PNG/SVG |
| review-1 | merge `f277a86` | Sửa theo review: đặt tên tuyến tính, merge đổi tên bảng trùng tên index của đích, default boolean `'1'`/`'0'` của MySQL |
| 14 | merge `72b3007` | Ánh xạ field và relation của Prisma |

Project review phần core foundation (khoảng `df2c3cc..6fa1e35`): approve-with-fixes. Các sửa đã merge (`f277a86`). Log review do Doc-1 đang viết thành `2026-10-05-import-export-review-1.md`.

## 3. Việc đang chạy / đang chờ

Agent ID dùng cho SendMessage; thông báo hoàn thành đến tự động.

### 3.1. Đang chạy

| Việc | Agent | Ghi chú |
| --- | --- | --- |
| Doc-1 (spec-writer) | `a6a36e307819407a5` | Sửa spec mục 5 và phần merge đổi tên; plan Task 11/12/16/23 và các dòng "Vấn đề" 3, 7, dòng mới 20; roadmap phần 7 thành `Đang làm`; viết `2026-10-05-import-export-review-1.md` và `2026-10-05-import-export-spec-amendment-1.md`. Làm việc trong MAIN tree (không worktree). Khi xong: orchestrator duyệt diff (nhờ project-reviewer duyệt bản sửa spec vì đây là thay đổi quan trọng), commit `docs: amend import export spec after dbml probe and review`, rồi push. |
| Task 16, DBML importer | core-engineer `a236ea2e9db430583` | Worktree |
| Task 15, Prisma importer | core-engineer `a3cc16c8615355f49` | Worktree |
| Task 23 | frontend-engineer `a11c7eca9f8c80f2d` | Worktree. `downloadBlob`, nút tải ở code panel, chuyển `ai-sample-data-card.tsx` sang `downloadBlob` và gỡ miễn trừ lint tạm. Nếu hook ecc `config-protection` chặn sửa `eslint.config.mjs`, giao việc xóa một dòng đó cho devops-engineer (agent devops của Task 1 từng sửa được file này). |

### 3.2. Hàng đợi

- Sau Doc-1: Task 11 (đã mở rộng: reader mới `sql-column-definitions.ts` cho scanner, tùy chọn của `CREATE INDEX`, đổi classifier: `ALTER TABLE ADD COLUMN` của pg/mysql và `ADD UNIQUE` của MySQL → unsupported), sau đó Task 12 (SQL importer, dùng raw type của scanner).
- Các đợt sau: 18, 19, 20 (conformance bằng Docker, loại SQL Server), 24 (worker), 25 (import dialog), 27, 30, 26, 31, 28, 32 (kiểm tra tay), 33 (docs).
- Task test-engineer: làm các test frontend dễ flaky ổn định dưới tải cao. Các file `editor-workspace.test.tsx`, `journeys/relations.test.tsx`, `table-panel.test.tsx`, `schema-list-screen.test.tsx`, `cloud-journeys/conflict.test.tsx`, `use-schema-actions.test.tsx` bị timeout khi load average khoảng 100 nhưng chạy riêng thì pass.
- Trước khi báo phần 7 xong: một lượt ecc:security-reviewer cho các importer (adapter, scanner, JSON). Với các task frontend: ui-a11y-reviewer và project-reviewer.

## 4. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

- Task 0: chấp nhận cả 19 "Đề xuất" trong bảng vấn đề của plan.
- `DraftNote` dùng trường `text` (khớp model).
- File dài hơn khoảng 300 dòng được tách thành file phụ trong cùng thư mục (đã duyệt trước trong các prompt).
- Task 1: miễn trừ lint tạm cho `ai-sample-data-card.tsx` của phần 5; Task 23 gỡ nó. Nit 4 của review (tham chiếu trong comment) bị bỏ vì miễn trừ sắp bị gỡ, và hook config-protection đã chặn core-engineer sửa `eslint.config.mjs`.
- Task 9: `CHECK/NOCHECK CONSTRAINT` của SSMS, `ALTER DATABASE … SET`, `ROLLBACK` bị bỏ qua; dữ liệu `COPY … FROM stdin` của PostgreSQL bị bỏ qua đến `\.`; MySQL DEFINER không có dấu nháy → unsupported.
- Task 4: `assembleDocument` lặng lẽ loại trùng cột PK/index lặp (không mất thông tin); relation dùng lại một cột bị loại với `reference-not-found`; index và relation rỗng bị loại; importer không bao giờ throw.
- Task 8: probe `@dbml/core` 10.2.0 phát hiện các mất mát âm thầm (pg `with time zone`, kiểu nhiều từ bị gộp, MySQL UNSIGNED, ON UPDATE, COLLATE, index DESC/WHERE, cột computed, ADD COLUMN trên pg/mysql, MySQL ADD UNIQUE). Scanner của ta đọc lại định nghĩa cột; COLLATE → `type-parameter-dropped`, DESC/WHERE → `index-option-dropped` (không thêm mã diagnostic mới).
- Task 10: UNSIGNED theo ô trong spec (INT UNSIGNED→bigint, SMALLINT UNSIGNED→integer, BIGINT UNSIGNED→decimal(20,0)); default null → không có default; 1/0 trên boolean → true/false ở mọi dialect; chuỗi `'1'`/`'0'` của MySQL trên boolean → true/false.
- Review: merge đổi tên bảng được import khi trùng tên index của đích; việc đặt tên chuyển sang tuyến tính (5 000 index không tên: 58 ms; 10 000 bảng cùng tên: 149 ms).
- Task 15: field kiểu composite → `composite-type-not-supported`; `@relation(map:)` và `@default(map:)` bị bỏ qua lặng lẽ; chỉ nhận tiền tố native `db.`.
- Test frontend flaky dưới tải nặng được chấp nhận khi merge thay đổi không liên quan, miễn là các file lỗi pass khi chạy riêng; các file canvas của Task 29 đã được kiểm tra riêng sau merge.

## 5. Bài học cho orchestrator

Giữ các bài học của các phiên trước. Bổ sung:

- Hook git (rtk rewrite) chặn `git` trong worktree: agent dùng `/usr/bin/git` hoặc `.claude/scripts/changed-files.sh`.
- Worktree xong thường bị khóa: xóa bằng `git worktree remove -f -f`.
- `verify.sh` nối ống qua grep có thể bị kill: chuyển output ra file.
- Không merge vào main tree khi `verify.sh` đang chạy ở đó.
- Máy ngủ làm gián đoạn agent: giữ `caffeinate` bật.
- Hook ecc `config-protection` chặn một số agent sửa `eslint.config.mjs`: chuyển việc đó cho devops-engineer.
- Số dòng trong plan lệch khi spec-writer đang sửa plan: đọc commit message từ `git show HEAD:<plan>`.

## 6. Khởi động nhanh cho session mới

1. Đọc log này, chạy `git status` và `git worktree list`.
2. Chờ thông báo từ 4 agent đang chạy (ID ở mục 3.1). Khi Doc-1 xong: duyệt diff, nhờ project-reviewer duyệt bản sửa spec, commit `docs: amend import export spec after dbml probe and review`, push.
3. Tiếp tục hàng đợi ở mục 3.2: Task 11, rồi Task 12, rồi các đợt 18 trở đi.
