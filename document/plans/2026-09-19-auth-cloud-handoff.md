# Bàn giao trạng thái phần Auth & Cloud — 2026-09-19

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc ngày 2026-09-19. Nguồn công việc là `document/plans/2026-09-17-auth-cloud-plan.md` (40 task) và spec đã duyệt `document/specs/2026-09-15-auth-cloud-design.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi bất kỳ quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- `master` = `15f4d16`, đã push lên `origin/master`, working tree chính **sạch**.
- Tiến độ: **21/40 task** của `document/plans/2026-09-17-auth-cloud-plan.md` đã xong.

Các commit hoàn tất trong phiên 2026-09-19, theo thứ tự:

| # | Commit trên `master` | Commit gốc trong nhánh | Nội dung |
|---|---|---|---|
| 1 | `101215d` | — | Task 13: module auth (register, login, refresh) |
| 2 | `8f26823` (merge) | `4402528` | Task 25: `signOut` / `forgetPreviousAccount`, dọn cache khi đăng xuất và khi đổi tài khoản |
| 3 | `e4ae163` | — | Sửa 4 chỗ trong plan + thêm Task 39 |
| 4 | `8325e99` (merge) | `6fcab20` | Task 39: xóa row không parse được khi đăng xuất |
| 5 | `ff4fb81` | — | Chốt ngữ nghĩa `movedIds` trong plan + thêm Task 40 |
| 6 | `7818030` | — | Sửa `.claude/scripts/worktree-setup.sh` cho worktree liên kết |
| 7 | `15f4d16` (merge) | `74852f0` | Task 24: upload schema của khách + đồng bộ schema tồn đọng |

---

## 2. Bốn nhánh còn dang dở

Cả bốn đều đã được commit để không mất việc và **worktree vẫn còn tại chỗ**. Chưa nhánh nào được merge vào `master`.

| Nhánh | Worktree | Commit | Task | Trạng thái |
|---|---|---|---|---|
| `worktree-agent-a9fee357a0c41a164` | `.claude/worktrees/agent-a9fee357a0c41a164` | `141c528` | Sửa flaky test | Sẵn sàng merge, chưa qua `project-reviewer` |
| `worktree-agent-a2583b45b80f61b34` | `.claude/worktrees/agent-a2583b45b80f61b34` | `651a017` | Task 15 | Cần review, có 1 quyết định chờ chốt |
| `worktree-agent-a1fbb0334530e7a00` | `.claude/worktrees/agent-a1fbb0334530e7a00` | `d0b38c2` | Task 14 | Bị chặn, 1 test đỏ |
| `worktree-agent-a8fdd633f86805184` | `.claude/worktrees/agent-a8fdd633f86805184` | `d961972` | Task 26 | Dở dang, `wip`, chưa verify |

### 2.a. `worktree-agent-a9fee357a0c41a164` — sửa flaky test — SẴN SÀNG MERGE

- Worktree: `.claude/worktrees/agent-a9fee357a0c41a164`, commit `141c528` (`test(frontend): raise timeout for editor journey tests`).
- Đã verify: `.claude/scripts/verify.sh frontend --build --format` → `RESULT: PASS`, 2798 test pass; `.claude/scripts/secret-scan.sh` CLEAN.
- **Chưa qua `project-reviewer`.** Thay đổi nhỏ: 5 file test/helper, `+37/−2`, không đụng code production, `frontend/vitest.config.ts` không đổi.
- Nội dung: thêm hằng `JOURNEY_TEST_TIMEOUT_MS = 20_000` và hàm `setJourneyTestTimeout()` trong `frontend/src/testing/mount-editor-journey.tsx`, gọi ở đầu 4 file journey trong `frontend/src/features/editor/journeys/`.
- Nguyên nhân gốc đã đo được: vitest mặc định `testTimeout` 5000ms, trong khi 4 file journey mount cả editor thật (React Flow, IndexedDB, Zustand/Dexie); khi CPU bị tranh chấp thì vượt 5 giây và timeout. Tái hiện xác định bằng 6–8 vòng lặp `yes` trên 8 nhân.
- Đã thử và **loại** phương án tách `projects` riêng: tổng thời gian chạy tăng từ 45.9s lên 77.9s (~70%); đã hoàn nguyên.
- Câu hỏi còn mở: giá trị 20s chọn theo biên 4x so với mặc định, **chưa có số liệu từ CI runner thật**.

### 2.b. `worktree-agent-a2583b45b80f61b34` — Task 15, hạ tầng e2e — CẦN REVIEW

- Worktree: `.claude/worktrees/agent-a2583b45b80f61b34`, commit `651a017` (`test(backend): add e2e harness and auth journeys`), 13 file, `+904/−2`.
- Agent báo: `pnpm --filter @schemaforge/backend test:e2e` → 17 test pass; `.claude/scripts/verify.sh backend --build --format` → PASS. **Orchestrator chưa tự chạy lại e2e** vì cần Postgres local.
- Phủ đủ 5 bất biến mà reviewer Task 13 chỉ kiểm được bằng tay:
  1. status code của từng route;
  2. set và xóa cookie kèm cờ `httpOnly` / `SameSite` / `path` / `maxAge`;
  3. bất biến "đúng 5 route public";
  4. thứ tự guard trên HTTP thật;
  5. cookie xóa vẫn được gửi kèm khi ném lỗi.
- Agent đã chứng minh test bất biến "5 route public" có tác dụng bằng một RED có chủ đích: tạm bỏ `POST /auth/logout` khỏi danh sách → test đỏ đúng chỗ.
- **⚠ Quyết định cần người dùng chốt:** agent liệt kê route bằng cách đọc thẳng router Express (`app.getHttpAdapter().getInstance().router.stack`), thay vì `DiscoveryService` mà plan giao cho Task 17. Hiện trùng lặp một phần với Task 17. Hai lựa chọn:
  - (a) Task 17 thay cặp test này bằng bản dùng `DiscoveryService`;
  - (b) giữ nguyên, Task 17 chỉ bổ sung phần e2e 12 còn lại.
- Hai file ngoài danh sách plan: `backend/test/response-facts.ts` và `backend/test/routes.ts`. Tách ra vì `backend/test/auth.e2e-spec.ts` gộp một file lên 496 dòng, vượt giới hạn ~300 dòng của `.claude/rules/code-quality.md`.
- `.claude/scripts/secret-scan.sh` ra **1 finding**: hằng `TEST_PASSWORD` tại `backend/test/factories.ts:6` — là fixture do chính plan quy định, **không phải secret thật**. ⚠ Cần quyết có thêm allowlist cho `backend/test/**` vào `.claude/scripts/secret-scan.sh` không (việc đó thuộc chủ sở hữu tooling, ngoài phạm vi `document/`).
- Lưu ý vận hành:
  - chạy e2e lần đầu cần `backend/.env.test` (gitignored);
  - mỗi test `TRUNCATE` toàn bộ bảng;
  - **không chạy e2e từ hai worktree cùng lúc** trên cùng database `schemaforge_test`.
- Agent **không chạy được lệnh `git` nào** do hook rtk chặn; orchestrator đã kiểm hộ, worktree sạch.

### 2.c. `worktree-agent-a1fbb0334530e7a00` — Task 14, module schemas — BỊ CHẶN, 1 TEST ĐỎ

- Worktree: `.claude/worktrees/agent-a1fbb0334530e7a00`, commit `d0b38c2` (`feat(backend): add schemas module with revisions and keyset paging`), 15 file, `+1491`.
- 271/272 test pass. Typecheck, lint, build, prettier đều PASS. `secret-scan` CLEAN.
- Test đỏ: `schema-dtos.spec.ts > CreateSchemaDto > keeps a __proto__ key as own data without changing the prototype`.
- Agent **dừng đúng ở chốt rủi ro plan đặt ra** ("nếu hai test cuối của `schema-dtos.spec.ts` không pass: dừng và báo; không tự đổi cách transform"), không tự sửa, không làm yếu test.
- Nguyên nhân đã đo bằng thực nghiệm: `class-transformer` với `transform: true` deep-clone document và **âm thầm bỏ own key `__proto__`**. Prototype **không** bị ô nhiễm — **không có lỗ hổng prototype pollution**.
- Hệ quả: lệch hành vi giữa hai đầu. Core `parseSchemaDocument` có `findProtoKeyErrors` trả `invalid-shape` cho own key `__proto__`, nhưng pipe đã xóa key trước khi service thấy, nên payload mà frontend từ chối thì backend lại chấp nhận (với key bị bỏ im lặng). Document lưu xuống vẫn hợp lệ.

⚠ **Ba phương án, người dùng chưa chốt:**

| # | Phương án | Đánh đổi |
|---|---|---|
| 1 (orchestrator khuyến nghị) | Chấp nhận hành vi: đổi test thành `drops a __proto__ key without changing the prototype` (khẳng định `Object.hasOwn(document, "__proto__") === false` và prototype không đổi), rồi ghi vào mục "Vấn đề với các spec đã duyệt" của `document/specs/2026-09-15-auth-cloud-design.md` và vào `document/architecture.md` rằng backend không tái hiện được lỗi cấu trúc này của core | Chỉ tự hại người gửi (schema của chính họ mất một entry), phải cố tình bỏ qua frontend mới tới được, và không đụng đường đi của mọi request |
| 2 | Miễn transform cho riêng trường `document` | Mất tính nhất quán của pipe; phải tự kiểm kiểu cho trường đó |
| 3 | Thêm lớp kiểm raw body trước transform | Đụng đường đi của **mọi** request, tăng chi phí và bề mặt lỗi |

- Việc nhỏ kèm theo đã chốt: thêm `"src/modules/schemas/schema-list-cursor.ts"` vào danh sách `include` của coverage trong `backend/vitest.config.ts` — file có 5 test đầy đủ nhưng không được đếm vì không có hậu tố kiểu Nest.
- Phần bảo mật agent tự kiểm: cả 6 method của `SchemasRepository` đều mang `ownerId` trong `where`, không method nào nhận id trần; phân biệt 404 và 409 đi qua `findRevision(id, ownerId)` nên schema của người khác luôn ra 404, không lộ revision.

### 2.d. `worktree-agent-a8fdd633f86805184` — Task 26 — DỞ DANG

- Worktree: `.claude/worktrees/agent-a8fdd633f86805184`, commit `d961972` (`wip(frontend): auth provider, account menu and sign-in prompt`), 11 file, `+1557/−9`.
- Bị dừng theo yêu cầu người dùng khi đang chạy dở. Commit là `wip`: **chưa verify, chưa review, không rõ có chạy được không.**
- File đã có:
  - tạo mới: `frontend/src/components/auth-provider.tsx`, `frontend/src/components/account-menu.tsx`, `frontend/src/components/sign-in-prompt.tsx` (kèm test cho cả ba), `frontend/src/lib/auth/request-auth-hint.ts` + test;
  - sửa: `frontend/src/app/layout.tsx`, `frontend/src/components/app-providers.tsx` + test.
- Session mới nên coi đây là **điểm khởi đầu để đọc và kiểm**, không phải việc đã xong.

---

## 3. Việc người dùng cần quyết khi mở session mới

1. Cách xử lý `__proto__` của Task 14 — ba phương án, orchestrator khuyến nghị phương án 1 → xem mục 2.c.
2. Task 17 xử lý sao với phần liệt kê route trùng lặp của Task 15 — (a) thay bằng `DiscoveryService`, hay (b) giữ nguyên → xem mục 2.b.
3. Có thêm allowlist cho `backend/test/**` vào `.claude/scripts/secret-scan.sh` không → xem mục 2.b.
4. Có merge bản sửa flaky test mà không qua `project-reviewer` không → xem mục 2.a.

---

## 4. Quyết định orchestrator đã tự chốt trong phiên

Liệt kê để người dùng rà lại và overrule nếu cần.

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Không thêm test riêng cho nhánh `timeout` của `logout` ở Task 25 | Đã phủ ở tầng `api-transport` |
| 2 | Trường hợp `409` + `get` trả `200` với tài liệu khác → xếp vào `uploadedIds` | Schema đã có mặt trên cloud, coi như đã upload |
| 3 | `notAttemptedIds` dùng `slice(stoppedAtIndex)`, gồm cả schema làm dừng lượt | Vấn đề 29 trong plan |
| 4 | Bỏ qua 3 nit của Task 24 | Một `case "not-guest"` chết trong `attachMove`; plan liệt kê một test mà file gộp vào test khác cùng độ phủ; `it.each` hai mã thay vì ba |
| 5 | Bỏ qua nit `dummyPasswordHash = ""` của Task 13 | Không reachable vì `onModuleInit` luôn chạy trước |
| 6 | Nâng Task 13, 14, 15, 25, 26 lên model opus | Đụng auth, session, cookie, phân quyền |

---

## 5. Bài học vận hành cần nhớ

- **Môi trường đổi thư mục làm việc mặc định sang worktree giữa các lượt.** Một agent đã sửa nhầm file plan trong worktree của task khác vì tin vào cwd. Mọi prompt sau phải yêu cầu dùng **đường dẫn tuyệt đối**.
- **Hook rtk chặn mọi lệnh `git` của subagent** trong worktree cách ly. Task 15 không tự chạy được `git status`. Orchestrator phải kiểm hộ, hoặc dùng `/usr/bin/git`.
- **`secret-scan.sh` báo 4 finding trong `document/plans/2026-09-17-auth-cloud-plan.md`** (dòng 491, 1387, 1543, 1560) — đều là giá trị mẫu có sẵn từ trước (chuỗi kết nối placeholder, mật khẩu test giả, thông tin container Postgres của CI), **không phải secret thật**. Đừng hoảng khi thấy lại.
- **Còn một thư mục rác** `.claude/worktrees/agent-a2b6d2cb1f3af60d7/` từ session trước, git không còn đăng ký (không có trong `git worktree list`), chưa xóa.
- **Chi phí phiên này rất cao** (~$140+), phần lớn do job cron báo tiến độ mỗi phút. Session sau nên giãn nhịp hoặc chỉ báo khi có task hoàn thành.

---

## 6. Lệnh khởi động nhanh cho session mới

Tất cả chạy từ repo gốc `/Users/hominhhoang/Documents/Work/01_Software-development/01_Github_minhhoangho/SchemaForge`.

Node: repo cần Node 24 (`.nvmrc` = `24.21.0`); shell không tương tác mặc định Node 22.

```bash
source ~/.nvm/nvm.sh && nvm use
```

Xem trạng thái chung và các worktree:

```bash
/usr/bin/git -C <repo> status --short
/usr/bin/git -C <repo> log --oneline --first-parent -10
/usr/bin/git -C <repo> worktree list
```

Xem một worktree cụ thể (thay `<id>` bằng một trong `a9fee357a0c41a164`, `a2583b45b80f61b34`, `a1fbb0334530e7a00`, `a8fdd633f86805184`):

```bash
/usr/bin/git -C <repo>/.claude/worktrees/agent-<id> log --oneline -1
/usr/bin/git -C <repo>/.claude/worktrees/agent-<id> status --short
/usr/bin/git -C <repo>/.claude/worktrees/agent-<id> diff --stat master --
```

Kiểm tra trong một worktree:

```bash
cd <repo>/.claude/worktrees/agent-<id>
source ~/.nvm/nvm.sh && nvm use
.claude/scripts/verify.sh frontend --build --format     # hoặc: backend | core | all
.claude/scripts/secret-scan.sh --range master..HEAD
```

Chạy một file test đơn lẻ:

```bash
pnpm --filter @schemaforge/frontend exec vitest run <path>
pnpm --filter @schemaforge/backend test:e2e            # cần Postgres local + backend/.env.test
```

Tạo và bootstrap worktree mới:

```bash
/usr/bin/git -C <repo> worktree add <repo>/.claude/worktrees/agent-<id> -b worktree-agent-<id> HEAD
<repo>/.claude/scripts/worktree-setup.sh <repo>/.claude/worktrees/agent-<id>
```

Merge một nhánh worktree vào `master` rồi dọn worktree:

```bash
cd <repo>
source ~/.nvm/nvm.sh && nvm use
.claude/scripts/verify.sh all --build --format          # trên master sau khi merge
/usr/bin/git merge --no-ff worktree-agent-<id>
/usr/bin/git push
/usr/bin/git worktree remove .claude/worktrees/agent-<id>
/usr/bin/git branch -d worktree-agent-<id>
```

Chỉ push sau khi các lệnh kiểm tra ở trên PASS (`.claude/rules/git.md`).
