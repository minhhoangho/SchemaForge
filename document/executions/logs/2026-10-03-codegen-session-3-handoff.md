# Bàn giao trạng thái phần 6 (Code generators), phiên 3 — 2026-10-03

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc thứ ba. Nó thay [2026-10-02-codegen-session-2-handoff.md](2026-10-02-codegen-session-2-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-09-14-code-generators-design.md` và plan `document/plans/2026-09-15-code-generators-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan. Bàn giao này không ghi trạng thái phần 5 (AI Assistant); trạng thái gần nhất ở mục 3 của [handoff AI](2026-10-02-codegen-ai-session-handoff.md).

---

## 1. Trạng thái git

- Nhánh `master`. `origin/master` đang ở `b83ce7f` lúc viết tài liệu này.
- Commit local `6152fc2` `perf(core): add generator benchmarks` (Task 28) đã merge vào `master`; orchestrator đang verify và push. Nếu `git log origin/master` đã có `6152fc2` thì commit này đã push.
- Không có agent chạy sau bàn giao.
- Worktree `.claude/worktrees/agent-a6c2dfc01dc4d7c74` (Task 28) còn lại, orchestrator sẽ xóa sau khi push.

## 2. Phần 6 "Code generators"

### 2.a. Đã merge trong phiên này

- `06b2b59`: `.gitattributes` ép diff dạng văn bản cho `packages/core/src/generators/__snapshots__/**`.
- Task 15 MySQL DDL: `268e5af`. Sửa KEY của cột auto-increment trong `CREATE TABLE` (R25, gồm cả index người dùng bắt đầu bằng cột auto): `2a8d1b6`.
- Task 18 Drizzle: `26cbad2`. R21: mọi callback cấu hình bảng được chú thích `PgTableExtraConfigValue[]` hoặc `MySqlTableExtraConfigValue[]`, sau khi kiểm tra sớm thấy TS7022/TS7024 với vòng khóa ngoại.
- Review `1c42f9c..4ec7478` (`project-reviewer` và `ecc:security-reviewer`) và các sửa kèm theo:
  - dọn generator `148374d` (tách quan hệ Markdown, switch exhaustive);
  - sửa seed `0b7132f`: `parseSeedDataset` không còn RangeError với mảng từ 150k phần tử; thêm `SeedIssue` mới `seed-identity-partial` (R24);
  - ngữ pháp tên custom type `c5071c5` (R26, đã cập nhật spec core) và security review của nó (approve, chấp nhận phần còn lại là các từ chỉ-thuộc-tính);
  - test ghim fallback custom type không an toàn trong generator SQL `b83ce7f`.
- Task 29 conformance DDL và seed SQL: `e61d69a`. PostgreSQL 9/9, MySQL 14/14, seed PostgreSQL và MySQL 17 test pass. 22 test SQL Server CHƯA TỪNG CHẠY (người dùng chọn bỏ qua: VM Docker 2 GB, các container `local_*` của người dùng đang dùng nó; không được dừng chúng).
- Task 30 conformance Prisma, Drizzle, TypeScript, Zod: `ee7027e`. Số test pass: 12, 16, 4, 8. R27: conformance Zod parse dòng seed bằng `.partial()` cho các cột CG-08 bỏ qua.
- Task 27 property test: `e2aa9e0`. Không tìm thấy bug.
- Task 28 benchmark: `6152fc2`.
  - 18 biến thể có p75 ≤ 100 ms (lớn nhất là mock-api, khoảng 79 ms).
  - seed `postgresql` 100 dòng/bảng: p75 khoảng 2528 ms, mục tiêu ≤ 500 ms. TRƯỢT, số đo thật, gần như tuyến tính theo số dòng.
  - Lưu ý API bench: Vitest 5 không có export `bench`; file dùng `test(..., ({ bench }) => bench.compare(...))`. Xem bảng kết quả bằng `pnpm --filter @schemaforge/core bench --reporter=verbose` (khoảng 257 giây).
- Quyết định spec đã ghi: R21 đến R27 trong `document/specs/2026-09-14-code-generators-design.md`.

### 2.b. Sẵn sàng dispatch (theo thứ tự)

1. **Task tối ưu hiệu năng seed.** Tối ưu `buildSeedDataset` và `generateSeed` trong `packages/core/src/generators/seed/` để p75 ≤ 500 ms với 100 dòng/bảng trên `createLargeSchema({ tableCount: 200 })`. Chạy lại bench và ghi log. Tùy chọn: `benchmark.suppressExportGetterWarnings` trong `packages/core/vitest.config.ts` (Vitest cảnh báo "accessed module export getters too many times").
2. **Task 33** (worker sinh code và highlight), rồi **Task 34** (code panel, nút "Code", i18n, CSP), rồi **Task 35** (tài liệu, kết quả đo, kiểm tra cuối). Đây là frontend; đọc các mục tương ứng của plan và `.claude/rules/nextjs.md`, `react.md`, `security.md`. Task 33 có thể chạy song song với task tối ưu seed (khác package).

### 2.c. Việc mở

- Chạy conformance SQL Server khi Docker có ít nhất 4 GB trống: `src/sqlserver.test.ts` (14 test) và `src/seed-sql.test.ts -t "seed sql on sql server"` (8 test). Sau đó chạy `pnpm test:conformance` ở root một lần. Phần 6 chưa hoàn tất cho đến khi bước này pass.
- Tùy chọn: một lượt `project-reviewer` trên `4ec7478..HEAD` (Task 15, 18, 27 đến 30 và các sửa) trước Task 35.

## 3. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

- **R21:** Drizzle luôn chú thích callback cấu hình (không chỉ khi có vòng). Import kiểu được sắp xếp lên đầu; chỉ in callback khi mảng constraint không rỗng.
- **Enum rỗng trong Drizzle** in nguyên trạng (`pgEnum("x", [])`), không thêm diagnostic mới; output không qua typecheck; người dùng đã thấy `enum-values-empty`.
- **R22:** ghi chú DBML nhiều dòng mất phần thụt lề chung và dòng trống đầu khi round-trip (chấp nhận).
- **R23:** Zod `.max(n)` đếm theo đơn vị UTF-16 (chấp nhận).
- **R24:** định danh seed theo kiểu tất cả hoặc không có gì, qua validation (không tách `INSERT`). Không thêm giới hạn kích thước mới cho `parseSeedDataset`.
- **R25:** KEY của cột auto-increment MySQL nằm trong `CREATE TABLE` (kể cả index người dùng bắt đầu bằng cột auto).
- **R26:** ngữ pháp custom type kèm blocklist 17 từ khóa; `timestamp(3) with time zone` nay bị từ chối; các từ chỉ-thuộc-tính được chấp nhận như phần còn lại.
- **R27:** conformance Zod và seed dùng `.partial()` cho cột CG-08 bỏ qua; không đổi core.
- **Markdown:** không escape `&` (không có injection); các fallback `?? ""` thừa được giữ lại.
- **SQL Server conformance bị bỏ qua** là lựa chọn của NGƯỜI DÙNG.

## 4. Bài học cho orchestrator

- Agent có thể dừng vì stream watchdog hoặc khi Mac ngủ: tiếp tục bằng SendMessage. Nếu agent gần hết ngân sách context thì tạo agent mới kèm đường dẫn log.
- Trong worktree của agent, `source ~/.nvm/nvm.sh` và `git` thường có thể bị từ chối: dùng `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"` và `/usr/bin/git -C <wt>`; các script `.claude/scripts/*` cần đường dẫn nguyên văn.
- Lệnh `timeout` không có trong shell macOS; một lần verify treo 30 phút, hãy chạy lại ở chế độ nền.
- Xóa worktree có thể mất hơn 2 phút (do `node_modules`): chạy nền. Không để cwd của session nằm trong worktree sắp xóa.
- Docker: một lần pull từ Docker Hub bị EOF; `docker pull postgres:18-alpine` thủ công đã sửa được.
- Quy trình tích hợp không đổi: commit trong worktree, `rebase master`, `merge --ff-only`, `verify.sh core --build --format`, secret-scan, push, xóa worktree, `branch -D`, prune.

## 5. Khởi động nhanh cho session mới

Xem mục 6 của [handoff AI](2026-10-02-codegen-ai-session-handoff.md#6-khởi-động-nhanh-cho-session-mới).

Tin nhắn đầu tiên gợi ý cho orchestrator: dispatch song song task tối ưu hiệu năng seed (`core-engineer`) và Task 33 (`frontend-engineer`).
