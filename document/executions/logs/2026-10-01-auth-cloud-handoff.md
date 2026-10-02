# Bàn giao trạng thái phần Auth & Cloud — 2026-10-01

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc ngày 2026-10-01. Nguồn công việc là `document/plans/2026-09-17-auth-cloud-plan.md` (40 task) và spec đã duyệt `document/specs/2026-09-15-auth-cloud-design.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi bất kỳ quyết định nào trong spec hay plan.

Bản bàn giao trước, [2026-09-19-auth-cloud-handoff.md](2026-09-19-auth-cloud-handoff.md), đã lạc hậu: nó đếm 21/40 task và mô tả bốn nhánh worktree dang dở, nay cả bốn đã merge và không còn worktree nào.

---

## 1. Trạng thái git

- `master` = `0073912`, đã push lên `origin/master`, working tree **sạch**, `git worktree list` chỉ còn cây chính — **không còn worktree nào**.
- Tiến độ phần 4: **38/40 task xong**. Bảng task của plan có 40 dòng (Task 0–40, số 8 không được dùng); mọi task đã xong và đã push, **còn Task 37 và Task 38**.
- `document/roadmap.md` ghi phần 4 "Auth + lưu cloud" là `Đang làm`. Task 38 là lượt đổi sang `Xong`.

13 commit của phiên 2026-10-01, theo thứ tự cũ → mới:

```
5d53b0d test(frontend): add usePathname to the shared editor journey mock
0c2c277 feat(frontend): warn about unsynced changes before signing out
c714c11 docs: record sign-out dialog scope and review findings
67c0fc4 test(frontend): raise the timeout for every heavy screen mount test
7ea3d25 fix(frontend): explain why a sync attempt left schemas unsynced
42271cf fix(frontend): count down the retry delay after a rate limit
32fd9dc test(frontend): generate valid schema ids in the account menu fixture
2563ce4 fix(frontend): write no cloud copy after the account signs out
eacfd99 fix(backend): reject schema documents with a __proto__ map key
863d5e1 docs: correct the proto-key cause and record the fixed bugs
49ca88e fix(frontend): delete unparsable rows on account switch
4a600bd test(frontend): add fake api backend and cloud journey tests
0073912 test(frontend): cover cloud push, conflict and sign out journeys
```

`git log --oneline` còn một commit merge `7ea7786` (`Merge branch 'worktree-agent-a9926d10b16e9b188'`) giữa `2563ce4` và `eacfd99`; nhánh và worktree đó đã được xóa.

Số liệu kiểm tra cuối cùng, **orchestrator tự chạy**, không lấy từ báo cáo của agent:

| Lệnh | Kết quả |
|---|---|
| `.claude/scripts/verify.sh frontend --build --format` | `RESULT: PASS`; `Tests 3262 passed (3262)`; coverage dòng 96,05% |
| `.claude/scripts/verify.sh backend --build --format` | `RESULT: PASS`; `Tests 285 passed (285)`; coverage dòng 97,56% |
| `pnpm --filter @schemaforge/backend test:e2e` | `62 passed (62)` |
| `.claude/scripts/secret-scan.sh` | `CLEAN` |
| `pnpm --filter @schemaforge/frontend exec vitest run src/testing/cloud-journeys` ba lượt liên tiếp | `8 passed` / `19 passed` ở cả ba lượt |

---

## 2. Việc còn lại của phần 4

### 2.a. Task 37 — checklist kiểm tra tay — **CẦN NGƯỜI DÙNG**

12 mục của bảng ở thân Task 37 (plan, mục [Task 37](../../plans/2026-09-17-auth-cloud-plan.md#task-37-checklist-kiểm-tra-tay-spec-mục-11)) chạy trên **trình duyệt thật** với **bản build**. Người dùng thao tác; orchestrator chuẩn bị môi trường, đọc từng bước và ghi kết quả.

**Điều kiện tiên quyết** (làm đủ trước khi mời người dùng vào, để session mới không phải mò):

1. **Node**: chạy `source ~/.nvm/nvm.sh && nvm use` ở gốc repo **trước mọi lệnh `pnpm`** (shell không tương tác mặc định Node 22, repo cần Node 24 theo `.nvmrc`).
2. **Database**: container `local_postgres` đang chạy; database `schemaforge_dev` đã chạy migration theo đúng lệnh trong `backend/README.md`.
3. **Env**: **người dùng tự tạo** `backend/.env` và `frontend/.env.local` từ `backend/.env.example` và `frontend/.env.example`. Orchestrator và agent **không đọc, không in** hai file này.
4. **CI**: job `verify` **và** job `e2e` của commit `0073912` phải xanh (`gh run list --branch master --limit 1`, rồi `gh run view <id>`).
5. **Bản build và hai terminal**:

   ```bash
   source ~/.nvm/nvm.sh && nvm use
   pnpm build
   # terminal 1 (cổng 3001)
   pnpm --filter @schemaforge/backend start
   # terminal 2 (cổng 3000)
   pnpm --filter @schemaforge/frontend exec next start --port 3000
   ```

   `frontend/package.json` **không có** script `start` (chỉ `build`, `dev`, `lint`, `typecheck`, `test`, `perf:snippet`), nên frontend phải chạy bằng `exec next start`.
6. **Hai tài khoản thử** tạo bằng màn hình `/sign-up`, email giả dạng `tester-a@example.com`; không dùng email hay mật khẩu thật.

**Bốn mục jsdom không kiểm được nên bắt buộc làm tay:**

| Mục | Hạng mục | Vì sao jsdom không kiểm được |
|---|---|---|
| 4 | Hai tab cùng gặp access token hết hạn | Web Locks và `BroadcastChannel` chỉ có bản giả trong test; cần hai tab thật tranh nhau một lượt refresh |
| 6 | Hai trình duyệt khác nhau cùng tài khoản để tạo xung đột thật | Backend giả trong `fake-api-backend.ts` mô phỏng `writeFromOtherDevice`, không phải hai client thật trên cùng revision |
| 7 | Safari với cookie `Secure` trên `http://localhost` | Hành vi cookie của từng engine, jsdom không có |
| 8 | Trình quản lý mật khẩu (WCAG 3.3.8) | Tính năng của trình duyệt, không có trong jsdom |

Máy không có Safari hay Firefox thì ghi mục đó là **"Không chạy được"** kèm lý do, rồi **hỏi người dùng** có chấp nhận để lại hay không và ghi câu trả lời (thân Task 37 bước 4).

Mục nào **"Không đạt"** thì dừng mục đó, giao một task sửa riêng (`debugger` hoặc `frontend-engineer`, có test tái hiện nếu tái hiện được trên jsdom), commit theo `.claude/rules/git.md`, rồi chạy lại đúng mục đó; ghi cả kết quả cũ và lần chạy lại.

Kết quả gửi cho Task 38 dưới dạng bảng `| # | Hạng mục | Kết quả | Trình duyệt | Ghi chú |`, kèm ngày chạy và commit đã kiểm tra.

### 2.b. Task 38 — tài liệu cuối

Phụ thuộc **kết quả Task 37**, nên không chạy trước. Nội dung theo thân Task 38 của plan:

- Kiểm tra toàn repo (bảy lệnh ở bước 1, gồm `pnpm install --frozen-lockfile` từ bản clone sạch hoặc worktree mới) và đối chiếu bảng "Đối chiếu tiêu chí hoàn thành"; dòng chưa phủ thì **dừng và báo**.
- Ghi kết quả checklist của Task 37 vào mục **"Kết quả kiểm tra tay"** (mục mới ở cuối `document/plans/2026-09-17-auth-cloud-plan.md`).
- `document/roadmap.md`: ô "Trạng thái" của dòng phần 4 → `Xong`.
- `document/architecture.md`: bổ sung hoặc sửa các dòng "Quyết định đã chốt" của phần 4, link spec ở mục "Luồng dữ liệu", và các dòng "Chưa chốt" mà thân task liệt kê (row IndexedDB không parse được, nơi deploy).
- `CLAUDE.md`, chỉ đoạn "Current status", và **chỉ khi prompt giao task ghi rõ người dùng đã đồng ý**; nếu không thì ghi đoạn đề xuất vào báo cáo.
- Prettier không format `*.md`: kiểm tay mọi bảng đã sửa có hàng phân cách khớp số cột, `|` trong ô được escape thành `\|`, link tương đối và `#anchor` mở được.

---

## 3. Việc còn mở, **không chặn** phần 4 — người dùng chưa quyết

Mười mục dưới đây đã được ghi vào plan (Vấn đề 36–43) hoặc phát sinh trong phiên này. Không mục nào chặn Task 37 hay Task 38.

| # | Việc | Vị trí trong code | Vì sao đáng làm | Trạng thái quyết định |
|---|---|---|---|---|
| 1 | Tách `fake-api-backend.ts` (600 dòng) | `frontend/src/testing/fake-api-backend.ts` | `.claude/rules/code-quality.md` ghi "split a file past about 300 lines" — file này vượt **gấp đôi** ngưỡng. Agent không tự tách được vì file mới nằm ngoài danh sách sở hữu của Task 35 | **Người dùng chưa quyết:** tách trong một task nhỏ / chấp nhận có ghi chú vì đây là test double / để Task 38 |
| 2 | `cloudCache.assignOwner` thiếu guard phiên | `frontend/src/lib/storage/cloud-cache.ts` (`assignOwner`, dòng 192 và 290), dùng bởi `frontend/src/lib/sync/upload-local-schemas.ts:112,166` | Vẫn có thể gắn `ownerId` cho row của khách **sau khi tài khoản vừa đăng xuất** — đúng kiểu rò mà commit `2563ce4` đã bịt cho `writeCloudCopy`. Sửa đúng là thêm chính guard `isSignedInAs` (dòng 115) và nhánh `"stale-session"` vào kiểu trả về | **Chưa quyết:** chưa giao task sửa |
| 3 | Cliff `RangeError` của Nest, **có từ trước**, trên **mọi** endpoint | `stripProtoKeys` của `ValidationPipe` trong `@nestjs/common` (code thư viện, không phải của repo); `resolveApiError` tại `backend/src/common/api-exception.filter.ts:66` | `stripProtoKeys` đệ quy **không giới hạn độ sâu**: body lồng khoảng 5.000 tầng (~30 KB, trong hạn mức `MAX_REQUEST_BODY_BYTES` 2 MB dùng ở `backend/src/app-setup.ts:45`) làm nó ném `RangeError`, và `resolveApiError` không có nhánh cho `RangeError` nên trả **500 `internal-error`** thay vì 4xx. Commit `eacfd99` **không làm tệ hơn**: `cloneOrSkip` của `validation.pipe.ts` bắt lỗi và degrade | **Chưa quyết.** Hai hướng: thêm nhánh `RangeError` vào `resolveApiError`, hoặc giới hạn độ sâu ở `parseSchemaDocument` (`packages/core/src/parse/parse-schema-document.ts`) |
| 4 | E2E flaky mới (Vấn đề 38 của plan) | `backend/test/schemas.e2e-spec.ts > journey 14: schema limit > rejects the 101st schema of a user with schema-limit-reached` | Đỏ **một lần rồi xanh ở lần chạy ngay sau**, trên cùng commit `eacfd99`. Nghi do trạng thái database giữa các lượt, hoặc timing khi tạo 100 schema | **Cần điều tra riêng.** Không nới ngưỡng, không bỏ hay `skip` test |
| 5 | Hai file còn bẫy `generateId` (Vấn đề 37 của plan) | `frontend/src/components/auth-provider.test.tsx`, `frontend/src/components/sign-in-prompt.test.tsx` | Fixture sinh id mà `listOwnedSchemas` lọc bỏ **im lặng** (`frontend/src/lib/storage/cloud-cache.ts`). Chưa kiểm bẫy đã nổ hay còn tiềm ẩn. Lưu ý từ Vấn đề 35: ở `account-menu.test.tsx` bẫy **chưa từng nổ** vì không test nào gọi `createSchema`, nên **đừng giả định** hai file này đang sai | **Chưa quyết:** một lượt dọn dẹp riêng sau phần 4 |
| 6 | `secret-scan.sh` dương tính giả (Vấn đề 40 của plan) | `.claude/scripts/secret-scan.sh`; chạm vào `document/plans/2026-09-17-auth-cloud-plan.md` hoặc `frontend/src/lib/i18n/locales/*/auth/credentials-form.ts` | Script quét theo file đã đổi: sửa plan ra **4 finding** (placeholder `TEST_PASSWORD` và chuỗi kết nối Postgres ví dụ trong tài liệu); diff có `credentials-form.ts` ra **7 finding** (các dòng như `showPassword: "Show password"`). Đều **không phải** secret. Gặp đúng các finding này trên đúng các file này thì bỏ qua | **Chưa quyết:** việc thêm allowlist thuộc chủ sở hữu tooling (`.claude/`), ngoài phạm vi `document/` |
| 7 | `JOURNEY_TEST_TIMEOUT_MS = 20_000` chưa có số liệu CI (Vấn đề 39 của plan) | `frontend/src/testing/mount-editor-journey.tsx:70`, dùng qua `setJourneyTestTimeout()` | Con số chỉ đo cục bộ bằng ép 8 vòng `yes` trên 8 nhân, **chưa có lần đo nào trên runner GitHub Actions** | **Giữ `20_000`**, đo lại khi có một lần job `verify` đỏ vì timeout; không nâng mù |
| 8 | Test chốt bất biến `@RawValue()` cho DTO tương lai | `backend/src/common/raw-value.decorator.ts`, `backend/src/modules/schemas/dto/update-schema.dto.ts:11` | Khi module AI (phần 5) nhận `document` trong body, DTO thiếu `@RawValue()` sẽ **âm thầm tái diễn** bug proto-key mà `eacfd99` vừa bịt, và **không test nào đỏ** | **Chưa viết được:** chưa có DTO thứ ba mang trường `document`. Làm cùng phần 5 |
| 9 | `FakeApiBackend.setOffline` là tất-cả-hoặc-không-gì | `frontend/src/testing/fake-api-backend.ts` (`setOffline`, dòng 47 và 578) | Hành trình cần `/auth/me` chạy được mà `/schemas/*` lỗi (đúng thứ tự bước mà thân Task 36 mô tả) sẽ cần điều khiển lỗi **theo từng route hoặc từng method**. Task 36 đã lách bằng cách đảo thứ tự mount (mục 5.a); muốn thứ tự đúng như thân task thì phải sửa hạ tầng Task 35 | **Chưa quyết:** chỉ cần khi có hành trình mới đòi thứ tự đó |
| 10 | Export `MeasuringResizeObserver` và `simulateRowHeights` | `frontend/src/testing/mount-editor-journey.tsx:85,102` (file 300 dòng, bị đóng băng trong Task 35); nơi dùng: `frontend/src/testing/cloud-journeys/mount-cloud-journey.tsx:161` | Các harness hành trình nên dùng chung hai thứ này, thay vì gọi `createJourneyEnvironment()` chỉ để lấy side effect | **Chưa quyết:** một lượt dọn dẹp hạ tầng test sau phần 4 |

---

## 4. Thân Task 36 ghi sai so với i18n thật — plan đã sửa

Ba chỗ, phát hiện khi hiện thực Task 36. Đã ghi vào bảng "Vấn đề phát hiện khi lập plan" của `document/plans/2026-09-17-auth-cloud-plan.md` thành **Vấn đề 41, 42, 43**, và thân Task 36 đã sửa cho khớp. Cả ba là sửa câu chữ của plan theo code đã duyệt, không đổi hành vi, không mở lại quyết định nào của spec.

| Vấn đề | Thân Task 36 ghi | Thực tế trong code |
|---|---|---|
| 41 | Nút hộp thoại xung đột là "Keep this device's version" | **"Keep the version on this device"** — `enSyncConflictDialog.keepLocal`, `frontend/src/lib/i18n/locales/en/sync/conflict-dialog.ts:13` |
| 42 | Nhãn offline là "Not synced" **kèm** một lý do riêng | **Một chuỗi duy nhất** "Not synced, no network connection" — `cloudStatus.pendingOffline`, `frontend/src/lib/i18n/locales/en/sync/cloud-status.ts:6`. Không có chuỗi "Not synced" trần nào |
| 43 | Sau khi đăng xuất, danh sách "còn 'notes' ở **phần của khách**" | **Sai về cấu trúc, không chỉ chữ:** không có vùng "Only on this browser" nào. `frontend/src/features/schema-list/components/schema-list-screen.tsx:261` chỉ render bố cục chia phần khi `ownedRows` khác `null`, nên lúc đăng xuất danh sách là **danh sách phẳng**. Yêu cầu cũ không kiểm được như đã viết; Task 36 thay bằng: link khách "notes" còn, link "shop" của tài khoản mất, link "Sign in" hiện |

---

## 5. Sai lệch có chủ ý của Task 36, đã ghi nhận

Ba chỗ bản hiện thực làm khác thân task **một cách có ý thức**, vì thân task không thực hiện được hoặc không chứng minh được điều nó muốn.

### 5.a. Thứ tự mount ở hành trình 6

Thân task viết: sửa offline → unmount editor → mount danh sách. **Không làm được với hạ tầng Task 35**: mỗi lần mount dựng một `AuthProvider` mới và `resolveStartup` chỉ tới được tài khoản **qua mạng**, nên danh sách mount lúc `setOffline(true)` sẽ dừng ở `expired` và `AccountMenu` hiện "Sign in again" thay vì email.

`sign-out-pending.test.tsx` mount **danh sách trước, lúc còn online**, rồi mount editor, rồi `setOffline(true)` và thêm bảng, rồi `editor.unmount()` và đăng xuất từ danh sách. Khóa schema của editor làm `BackgroundSyncHost` của danh sách bỏ qua schema `pending` (`tryAcquire` trả `null`), nên record vẫn `pending` đúng yêu cầu. Thân Task 36 đã được ghi lại theo thứ tự này.

### 5.b. Không dùng nhãn toolbar làm mốc chờ

Schema seed ở trạng thái `synced` **đã hiện "Saved to the cloud" trước khi có lần đẩy nào**, nên chờ chữ đó **không chứng minh gì**. `push-offline.test.tsx` chốt theo revision thật bằng helper `waitForCloudRevision` (dòng 78) rồi mới kiểm nhãn.

### 5.c. `revisions: [1, 2, 2]`

Trong test `syncs on the online event`, danh sách `expectedRevision` của mọi `PUT` là `[1, 2, 2]`: lần thử lúc offline **vẫn được ghi** với `expectedRevision: 2` (backend giả ghi mọi request vào `requests`, kể cả request bị từ chối khi offline), rồi lần thử lại lúc online gửi lại `2`. Thân task chỉ nhắc tới lần `2` thành công; đã bổ sung câu giải thích vào thân Task 36.

---

## 6. Sai sót của orchestrator trong phiên, ghi để lần sau không lặp

Mục này để session mới biết chỗ nào từng bị báo sai.

1. **Task 40 từng bị coi là đã xong** trong bản bàn giao 2026-09-19 và trong hai lượt kiểm kê sau đó, trong khi code không có. Nguyên nhân: kiểm bằng cách xem file `frontend/src/lib/sync/forget-previous-account.ts` có tồn tại, mà file đó có từ Task 25/26. **Tồn tại file không có nghĩa task xong** — phải kiểm đúng hành vi mà thân task yêu cầu. (Ghi thành Vấn đề 36 của plan; Task 40 đã làm xong ở `49ca88e`.)
2. **Một lượt kiểm kê đọc working tree đang bị agent khác sửa dở** rồi kết luận ngược (bảo rằng cả 9 file đã có cơ chế timeout, nên bệnh flaky "mâu thuẫn với code hiện tại"). Đối chiếu `HEAD` mới ra sự thật. **Khi kiểm kê trong lúc có agent đang chạy, so với `HEAD`, không so với working tree.**
3. **Lời "mất dữ liệu im lặng vì bảng tên `constructor`"** đã bị chuyển cho người dùng rồi phải cải chính: core đòi id của map có tiền tố (`packages/core/src/model/ids.ts`), nên `constructor` không phải id hợp lệ và **không có mất dữ liệu**. Tác động thật là **backend âm thầm chấp nhận document mà core từ chối** (đã sửa ở `eacfd99`, tài liệu cải chính ở `863d5e1`).
4. **Một agent chạy `git stash` trên working tree chung** khi ba agent khác đang sửa, để đo baseline `secret-scan`. `stash pop` thành công nên không mất gì, nhưng prompt giao việc cần **cấm rõ mọi lệnh `git` làm thay đổi working tree**, không chỉ cấm commit và push.
5. **Agent trong worktree bị harness khóa**, không sửa được cây chung; nó báo lại kèm patch chính xác thay vì lách. Khi giao việc cho worktree, phải **yêu cầu agent commit lên nhánh riêng**, nếu không `git merge` sẽ ra `Already up to date` và việc nằm lại trong worktree.

---

## 7. Lệnh khởi động nhanh cho session mới

Tất cả chạy từ repo gốc `/Users/hominhhoang/Documents/Work/01_Software-development/01_Github_minhhoangho/SchemaForge`.

```bash
source ~/.nvm/nvm.sh && nvm use
```

Xem trạng thái:

```bash
/usr/bin/git -C <repo> status --short
/usr/bin/git -C <repo> log --oneline -13
/usr/bin/git -C <repo> worktree list
```

Kiểm tra:

```bash
.claude/scripts/verify.sh frontend --build --format     # hoặc: backend | core | all
.claude/scripts/secret-scan.sh
pnpm --filter @schemaforge/frontend exec vitest run <path>
pnpm --filter @schemaforge/backend test:e2e             # cần container local_postgres + backend/.env.test
```

Chạy bản build cho Task 37 (hai terminal, xem mục 2.a):

```bash
pnpm build
pnpm --filter @schemaforge/backend start
pnpm --filter @schemaforge/frontend exec next start --port 3000
```

Chỉ push sau khi các lệnh kiểm tra ở trên PASS (`.claude/rules/git.md`).
