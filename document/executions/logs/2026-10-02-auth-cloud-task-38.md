# Task 38: Tài liệu cuối (`roadmap.md`, `architecture.md`, `CLAUDE.md`), kiểm tra toàn repo

- Plan: [Task 38](../../plans/2026-09-17-auth-cloud-plan.md#task-38-tài-liệu-cuối-roadmapmd-architecturemd-claudemd-kiểm-tra-toàn-repo)
- Spec: [Auth + lưu cloud](../../specs/2026-09-15-auth-cloud-design.md)
- Bản bàn giao trước đó: [2026-10-01-auth-cloud-handoff.md](2026-10-01-auth-cloud-handoff.md)

## 2026-10-02 12:49 — spec-writer — Xong

- **Đã làm**
  - Task 38 đã được orchestrator chạy ngày 2026-10-02: kiểm tra toàn repo (bước 1), đối chiếu tiêu chí hoàn thành (bước 2), cập nhật `document/roadmap.md` và `document/architecture.md` (bước 3). Kết quả ban đầu được một phiên trước ghi thẳng vào `document/plans/2026-09-17-auth-cloud-plan.md`, vi phạm quy tắc "Plans are to-do lists only" của `.claude/rules/execution-logs.md`.
  - Lượt này chuyển toàn bộ nội dung đó vào log này (mục "Kết quả chi tiết chuyển từ plan" bên dưới), rồi gỡ ba đoạn chưa commit khỏi plan; plan trở về đúng bản `HEAD`. Link trong `document/roadmap.md` trỏ tới mục đã gỡ được đổi sang log này.
- **File thay đổi**
  - `document/executions/logs/2026-10-02-auth-cloud-task-38.md` (tạo mới, file này).
  - `document/plans/2026-09-17-auth-cloud-plan.md`: gỡ ba đoạn chưa commit (hàng Vấn đề 36, đoạn "Cập nhật 2026-10-02 (Task 38)" trong thân Task 40, mục "Kết quả kiểm tra tay"); khác `HEAD` ở 0 dòng.
  - `document/roadmap.md`: chỉ sửa link tới "Kết quả kiểm tra tay" (từ plan sang log này); các sửa đổi Task 38 khác của file giữ nguyên.
- **Kiểm tra**
  - Kết quả các lệnh kiểm tra toàn repo, bảng đối chiếu tiêu chí và checklist Task 37 nằm ở mục "Kết quả chi tiết chuyển từ plan" bên dưới (ghi ngày 2026-10-02, commit `a4046f2`).
  - Lượt chuyển tài liệu này chỉ đụng Markdown: kiểm tra `git diff document/plans/2026-09-17-auth-cloud-plan.md` rỗng, bảng và link đã soát tay, `.claude/scripts/secret-scan.sh` đã chạy (xem báo cáo của lượt).
- **Quyết định**
  - (a) Thân Task 38 của plan bảo ghi kết quả vào một mục mới "Kết quả kiểm tra tay" ở cuối plan. Ngày 2026-10-02 người dùng quyết định ghi vào log này thay thế, theo quy tắc của `.claude/rules/execution-logs.md` (plan chỉ là danh sách việc, trạng thái nằm ở log và `roadmap.md`).
  - (b) Ngày 2026-10-02 người dùng quyết định **bỏ qua** checklist kiểm tra tay của Task 37: không mục nào được chạy trên trình duyệt thật.
- **Ghi chú cho người tiếp theo**
  - Các mục 4, 6, 7, 8 của Task 37 (hai tab, hai thiết bị, Safari với cookie `Secure` trên `http://localhost`, trình quản lý mật khẩu) vẫn **chưa được xác minh** bằng bất kỳ cách nào; jsdom không kiểm được. Muốn xác minh thì chạy lại đúng bốn mục đó theo thân Task 37 của plan.
  - Trạng thái CI của job `verify` và `e2e` chưa được xác nhận (`gh` chưa đăng nhập trên máy chạy lượt kiểm tra).
  - Các mục mở không chặn khác nằm ở mục 3 của [2026-10-01-auth-cloud-handoff.md](2026-10-01-auth-cloud-handoff.md).

## Kết quả chi tiết chuyển từ plan

Ba đoạn dưới đây được sao nguyên văn từ bản chưa commit của `document/plans/2026-09-17-auth-cloud-plan.md` (chỉ đổi cấp heading và sửa link tương đối cho vị trí mới).

### Ghi chú trạng thái cho Vấn đề 36 (trước đây là hàng 36 của bảng "Vấn đề phát hiện khi lập plan")

Ô "Trạng thái" của hàng 36 (cột cuối) được đổi từ "Mở: Task 40 vẫn phải làm. Quyết định của orchestrator ngày 2026-10-01, không qua người dùng: chỉ sửa tài liệu cho đúng thực tế, không đổi phạm vi hay thiết kế của Task 40" thành:

> Mở ngày 2026-10-01 (quyết định của orchestrator, không qua người dùng: chỉ sửa tài liệu cho đúng thực tế, không đổi phạm vi hay thiết kế của Task 40). Đã xong: Task 40 hiện thực ở commit `49ca88e`, Task 38 xác nhận ngày 2026-10-02

Các ô còn lại của hàng 36 không đổi so với `HEAD`.

### Ghi chú trạng thái cho Task 40 (trước đây là đoạn thêm vào thân Task 40, sau phần "Row hỏng dựng bằng helper cục bộ…")

**Cập nhật 2026-10-02 (Task 38):** task đã hiện thực ở commit `49ca88e`, gồm cả việc đảo thứ tự ở "Điều kiện tiên quyết" dưới (`rememberAccount` ghi row `session` của tài khoản mới trước khi gọi `onAccountChanged`); sáu test ở "Test viết trước" có trong `forget-previous-account.test.ts`.

### Kết quả kiểm tra tay

(Trước đây là mục "## Kết quả kiểm tra tay" ở cuối plan.)

Task 38 ghi ngày 2026-10-02, trên commit `a4046f2` (`master`, working tree sạch).

#### Checklist Task 37

Ngày 2026-10-02, người dùng chọn **bỏ qua** checklist kiểm tra tay của Task 37: không mục nào được chạy trên trình duyệt thật. Cột "Ghi chú" chỉ nêu phần nào đã có test tự động phủ một phần; phần còn lại của mỗi mục **chưa được xác minh**.

| # | Hạng mục | Kết quả | Trình duyệt | Ghi chú |
|---|---|---|---|---|
| 1 | Thuộc tính cookie | Chưa chạy (người dùng bỏ qua) | Không có | e2e hành trình 1 kiểm `HttpOnly`, `Secure`, `SameSite=Strict` và `Path` của `sf-access`, `sf-refresh` ở header `Set-Cookie`; giá trị cookie `sf-auth-hint` có unit test (`auth-hint-cookie.test.ts`). Chưa xem trong DevTools |
| 2 | Không có token trong bộ nhớ đọc được bằng JavaScript | Chưa chạy (người dùng bỏ qua) | Không có | Không có test tự động riêng (xem dòng 22 của bảng đối chiếu) |
| 3 | CSP không chặn request tới backend | Chưa chạy (người dùng bỏ qua) | Không có | e2e hành trình 10 kiểm header CORS và `Cross-Origin-Resource-Policy: same-site`; CSP của frontend chưa được kiểm trên trình duyệt |
| 4 | Hai tab cùng gặp access token hết hạn | Chưa chạy (người dùng bỏ qua) | Không có | jsdom không kiểm được (Web Locks, `BroadcastChannel` chỉ có bản giả). Unit `session-refresher.test.ts` (`runs refreshes from two tabs one after another`) chỉ phủ logic tuần tự hóa. **Chưa xác minh** |
| 5 | Offline rồi online | Chưa chạy (người dùng bỏ qua) | Không có | Tích hợp 2 (`push-offline.test.tsx`) phủ trên jsdom |
| 6 | Hai thiết bị | Chưa chạy (người dùng bỏ qua) | Không có | jsdom không kiểm được hai client thật trên cùng revision. Tích hợp 3 (`conflict.test.tsx`, dùng `writeFromOtherDevice` của backend giả), tích hợp 4 (`new-device.test.tsx`) và e2e hành trình 4, 7 phủ logic. **Chưa xác minh** |
| 7 | Safari với cookie `Secure` trên `http://localhost` | Chưa chạy (người dùng bỏ qua) | Không có | jsdom không kiểm được hành vi cookie của từng engine. **Chưa xác minh** |
| 8 | Trình quản lý mật khẩu (WCAG 3.3.8) | Chưa chạy (người dùng bỏ qua) | Không có | jsdom không có trình quản lý mật khẩu. Test component `credentials-form.test.tsx` kiểm `autocomplete` và dán mật khẩu. **Chưa xác minh** |
| 9 | Đăng xuất trên máy dùng chung | Chưa chạy (người dùng bỏ qua) | Không có | Unit `sign-out.test.ts` và tích hợp 6 (`sign-out-pending.test.tsx`) phủ trên `fake-indexeddb`; hạn chế còn lại ghi ở mục "Đối chiếu tiêu chí" dưới |
| 10 | Bàn phím và trình đọc màn hình cho phần mới | Chưa chạy (người dùng bỏ qua) | Không có | Test component có axe-core và kiểm focus; VoiceOver chưa được thử |
| 11 | Độ tương phản và kích thước mục tiêu | Chưa chạy (người dùng bỏ qua) | Không có | Tương phản token có `globals.test.ts`; kích thước nút hiện/ẩn mật khẩu có test `gives the visibility toggle at least a 24 pixel target`; các nút khác chưa đo trên trình duyệt |
| 12 | `returnTo` | Chưa chạy (người dùng bỏ qua) | Không có | Unit `sanitize-return-to.test.ts` và test component `sign-in-prompt.test.tsx` phủ trên jsdom |

Không có mục "Không chạy được", nên không có quyết định nào của người dùng theo bước 4 của Task 37. Bốn mục jsdom không kiểm được (4, 6, 7, 8; bản bàn giao [2026-10-01-auth-cloud-handoff.md](2026-10-01-auth-cloud-handoff.md), mục 2.a) **vẫn chưa được xác minh bằng bất kỳ cách nào**; muốn xác minh thì chạy lại đúng bốn mục đó theo thân [Task 37](../../plans/2026-09-17-auth-cloud-plan.md#task-37-checklist-kiểm-tra-tay-spec-mục-11).

#### Kiểm tra toàn repo (Task 38 bước 1)

Orchestrator chạy ngày 2026-10-02, tuần tự, Node 24, trên **cây làm việc chính** ở commit `a4046f2` (sạch), **không** phải bản clone sạch hay worktree mới như bước 1 yêu cầu.

| Lệnh | Kết quả |
|---|---|
| `pnpm install --frozen-lockfile` | Thoát 0; không có cảnh báo `Ignored build scripts` |
| `pnpm lint` | Thoát 0 |
| `pnpm typecheck` | Thoát 0 |
| `pnpm test` | Thoát 0; mọi ngưỡng coverage đạt. `packages/api-contract` 42 test, coverage dòng 100%; `packages/core` 850 test, 98,07%; `backend` 285 test, 97,55%; `frontend` 3423 test, 96,03% |
| `pnpm build` | Thoát 0 |
| `pnpm format:check` | Thoát 0 |
| `pnpm turbo run test:e2e --filter @schemaforge/backend` | Thoát 0; 62 test qua (3 file), trên PostgreSQL local. Test flaky của Vấn đề 38 (`rejects the 101st schema of a user with schema-limit-reached`) xanh ở lượt này; Vấn đề 38 vẫn mở |
| CI (`gh run list`, `gh run view`) | **Chưa kiểm**: `gh` chưa đăng nhập trên máy chạy lượt này, nên trạng thái job `verify` và `e2e` của `a4046f2` chưa được xác nhận |

#### Đối chiếu tiêu chí hoàn thành (Task 38 bước 2)

Đối chiếu ngày 2026-10-02 theo bảng [Đối chiếu tiêu chí hoàn thành](../../plans/2026-09-17-auth-cloud-plan.md#đối-chiếu-tiêu-chí-hoàn-thành): mỗi test được nêu đã có trong code ở `a4046f2` và nằm trong lượt `pnpm test` hoặc e2e xanh ở trên. "e2e N" là `describe("journey N: …")` trong `backend/test/`; "tích hợp N" là file trong `frontend/src/testing/cloud-journeys/`.

| # | Bằng chứng | Kết luận |
|---|---|---|
| 1 | e2e 1 `registers a user and sets sf-access and sf-refresh with HttpOnly, Secure, SameSite Strict and their paths` | Phủ |
| 2 | e2e 1 `signs out, clears both cookies and me answers unauthenticated`, `rejects the refresh token of a signed-out session with session-expired`; tích hợp 6 `sign-out-pending.test.tsx`; unit `sign-out.test.ts`, `forget-previous-account.test.ts` (Task 39, 40) | Phủ, kèm hạn chế về row IndexedDB không parse được ghi dưới bảng |
| 3 | e2e 2 `answers a wrong password and an unknown email with the same status and body`; e2e 1 `rejects a common password with password-too-common`, `rejects a password shorter than 8 characters with validation-failed`; unit `password.policy.spec.ts` `rejects a password longer than the maximum`; test component `credentials-form.test.tsx` `shows server field errors under the matching fields` | Phủ |
| 4 | e2e 11 `answers the first 10 sign-ins for an email with invalid-credentials and the 11th with too-many-requests and Retry-After`, `rejects the 6th registration from the same ip within an hour with too-many-requests and Retry-After` | Phủ |
| 5 | e2e 3 `rotates the refresh token and sets new cookies`, `rejects a reused refresh token and revokes the newer token of the same family`; unit `session-refresher.test.ts` `runs refreshes from two tabs one after another` | Phủ phần tự động; hai tab thật (Task 37 mục 4) chưa chạy |
| 6 | Unit `sanitize-return-to.test.ts`; test component `sign-in-prompt.test.tsx` `opens the dialog and returns false when signed out`, `links sign-in and sign-up with the current path as returnTo` | Phủ; Task 37 mục 12 chưa chạy |
| 7 | Tích hợp 1 `guest-upload.test.tsx` `asks to upload guest schemas after signing in and uploads only the selected one` | Phủ |
| 8 | Tích hợp 7 `guest-without-network.test.tsx` `never calls fetch during the guest create, edit, rename and delete journeys` | Phủ |
| 9 | e2e 6 `rejects a structurally invalid document with document-invalid listing code and path`, `stores a document with two tables of the same name`; unit `schemas.service.spec.ts` `stores a document that has semantic issues`, `fails with internal-error and logs the schema id when the stored document cannot be parsed` | Phủ |
| 10 | Tích hợp 2 `push-offline.test.tsx` `sends the cached revision as expectedRevision after an edit`, `shows not synced while offline and syncs on the online event` | Phủ; Task 37 mục 5 chưa chạy |
| 11 | Tích hợp 4 `new-device.test.tsx` `lists a cloud schema on an empty browser`, `opens the cloud schema and writes it to the cache` | Phủ phần tự động; hai trình duyệt thật (Task 37 mục 6) chưa chạy |
| 12 | Tích hợp 1 `guest-upload.test.tsx` `keeps the unselected schema in this browser only section` | Phủ |
| 13 | e2e 4 `rejects an update with revision 1 after revision 2 with revision-conflict and currentRevision 2`; e2e 7 `lets exactly one of two concurrent updates with the same expected revision succeed`; tích hợp 3 `conflict.test.tsx` (cả hai lựa chọn và đóng hộp thoại) | Phủ; Task 37 mục 6 chưa chạy |
| 14 | e2e 9 `rejects a body larger than 2 MiB with payload-too-large`; e2e 14 `rejects the 101st schema of a user with schema-limit-reached` | Phủ; e2e 14 còn flaky (Vấn đề 38) |
| 15 | Unit `database.test.ts` `upgrades a version 1 database to version 2 without losing schemas, documents or viewports` | Phủ |
| 16 | e2e 8 `pages three schemas with limit 2 newest first and ends with a null cursor`, `rejects limit 101 with validation-failed`; unit `merge-schema-list.test.ts`; test component `schema-list-sections.test.tsx` `shows the cached schemas and a retry banner when the cloud list fails` | Phủ |
| 17 | Tích hợp 5 `delete-from-list.test.tsx` `deletes a cloud schema from the list, the cloud and the cache`, `keeps the schema when the delete request fails offline` | Phủ |
| 18 | e2e 5 `does not list schemas of another user` và các test khác của hành trình 5 | Phủ |
| 19 | e2e 12 `discovers exactly the expected routes`, `marks exactly the five public routes of spec section 5 as public`; `describe("guards")` trong `auth.e2e-spec.ts` `answers unauthenticated on every route that is not one of the five public routes` | Phủ |
| 20 | e2e 10 `rejects a state-changing request without an Origin header with origin-not-allowed ($method $path)`, `rejects $name with origin-not-allowed`, các test preflight CORS | Phủ |
| 21 | e2e 13 `sends the Helmet headers on an API response`, `answers an unparseable stored document with internal-error and no stack, SQL or Prisma details`, `answers a unique violation without Prisma details` | Phủ |
| 22 | e2e 1 (`HttpOnly`); unit `auth-hint-cookie.test.ts` `serializes the hint with path, max age and SameSite=Lax`; thiết kế cookie `HttpOnly` (Task 12) | Phủ phần tự động; Task 37 mục 1, 2 chưa chạy, nên "không có token trong `localStorage`, IndexedDB" chưa có bằng chứng ngoài thiết kế |
| 23 | Unit `backend/src/config/env.spec.ts` `rejects a missing DATABASE_URL`, `rejects AUTH_COOKIE_SECURE false in production`, `rejects an http origin in production`, `rejects the example JWT secret in production` | Phủ |
| 24 | Bảy lệnh ở "Kiểm tra toàn repo" trên đều thoát 0 ở local | **Chưa phủ đủ**: chưa kiểm trên CI và chưa chạy từ bản clone sạch |
| 25 | Test component `credentials-form.test.tsx` (`labels the email and password fields`, `uses email and new-password autocomplete on sign-up`, `keeps a pasted password value`, `moves focus to the first invalid field`, `gives the visibility toggle at least a 24 pixel target`) | Phủ phần tự động; trình quản lý mật khẩu của Chrome (Task 37 mục 8) chưa chạy |
| 26 | `pnpm typecheck` xanh; `frontend/src/lib/i18n/locales/en/api-errors.ts` có `satisfies Record<ApiErrorCode \| ClientFailureKind, string>` | Phủ |
| 27 | Checklist Task 37 không chạy (người dùng bỏ qua ngày 2026-10-02); kết quả ghi ở bảng "Checklist Task 37" trên thay cho PR | **Chưa phủ**: kiểm tra tay chưa chạy |
| 28 | `roadmap.md`, `architecture.md` sửa trong commit của Task 38; câu ST-03 "từ chối tài liệu sai cấu trúc kèm lý do; tài liệu còn issue ngữ nghĩa vẫn được lưu" có trong `document/specs/2026-09-14-feature-list-design.md` | Phủ |

**Hạn chế đã biết về row IndexedDB không parse được (dòng 2):** Task 39 và Task 40 chỉ bịt đường đăng xuất chủ động và đường đổi tài khoản. Đóng trình duyệt mà không đăng xuất, hoặc lượt quét `deleteOwnedRowsExcept` lỗi, thì row không parse được của tài khoản vẫn còn, và `isGuestEntry` vẫn xếp nó vào nhóm khách cho người dùng kế tiếp. Vì vậy ranh giới dữ liệu giữa hai tài khoản trên cùng trình duyệt **không** được tính là phủ kín mọi đường; hạn chế này nằm ở mục "Chưa chốt" của [architecture.md](../../architecture.md#chưa-chốt).
