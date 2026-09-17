# Plan: Auth + lưu cloud

Plan triển khai phần 4 trong [roadmap.md](../roadmap.md), dựa trên spec đã duyệt [2026-09-15-auth-cloud-design.md](../specs/2026-09-15-auth-cloud-design.md) (bản ở commit d85c8d1; mọi mục ⚠ đã được người dùng xác nhận, xem dòng "Trạng thái" của spec). Spec là nguồn gốc: plan chỉ chia việc và chốt chi tiết mức cài đặt mà spec để lại, không đổi quyết định nào của spec. Chỗ spec đã cũ, còn hở, hoặc lệch với hành vi thật của thư viện được nêu ở mục [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan) và do **Task 0** chốt với người dùng.

Theo định nghĩa của người dùng, MVP là "tạo schema, làm việc với bảng trên đó, và lưu lên backend". Editor (phần 3) đã xong, nên plan này là phần còn thiếu để đạt MVP.

## Mục tiêu

- `backend/` có API auth bằng email và mật khẩu (cookie `HttpOnly`, refresh xoay vòng, rate limit, kiểm tra `Origin`) và API lưu schema (CRUD, revision, phân trang keyset, validate bằng `parseSchemaDocument`), chạy trên PostgreSQL qua Prisma 7.10, có unit test và e2e trên PostgreSQL thật, e2e là job CI riêng.
- Package mới `packages/api-contract` là nguồn duy nhất của type request, response, mã lỗi và hằng giới hạn giữa frontend và backend.
- `frontend/` có API client có kiểu, auth store, trang `/sign-in`, `/sign-up`, `SignInPrompt`, Dexie version 2 và đồng bộ local với cloud (đẩy lên, xung đột, đưa schema của khách lên, danh sách gộp, đăng xuất xóa cache). Khách không đổi gì so với phần 3 và không gọi mạng.
- Tài liệu (`architecture.md`, `roadmap.md`, danh sách tính năng, spec phần 1, 3, 7, `.claude/rules/nestjs.md`) khớp với spec.

## Điều kiện tiên quyết

- Phần 1, 2, 3 đã merge vào `master` (roadmap: `Xong`). Plan phần 6 (code generators) và plan phần 7 chưa có task nào đang chạy đồng thời sửa cùng file với plan này; nếu có, orchestrator đối chiếu mục [Điểm nóng](#điểm-nóng-khi-làm-song-song) trước khi giao.
- Node 24 qua nvm. Mọi lệnh `node`, `pnpm`, `npm`, `npx` trong shell không tương tác chạy ở root repo (hoặc root worktree) với tiền tố:

  ```bash
  source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
  ```

  `node -v` phải ra `v24.x`.
- Docker Desktop chạy container `local_postgres` (`postgres:16-alpine`) trên máy dev (spec mục 10). Task 5 hướng dẫn tạo ba database `schemaforge_dev`, `schemaforge_test`, `schemaforge_shadow`. Task nào cần database ghi rõ trong mục "Kiểm tra".
- Working tree sạch trên `master`; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` đang xanh trước khi bắt đầu.

## Cách dùng plan

- Mỗi task giao cho một subagent chưa đọc spec và chưa thấy thảo luận nào. Prompt gồm: mục "Quy ước chung cho mọi task", mục "Điểm nóng khi làm song song", toàn bộ nội dung task, đường dẫn spec kèm các mục spec mà task tham chiếu, và phần "Chữ ký và hành vi" của các task mà task này dùng lại.
- Cột "Agent" trong bảng task là loại subagent nhận task. `packages/api-contract` không có agent mặc định; plan giao cho `core-engineer` (Task 1), vì package cùng khuôn build, test và ranh giới framework-free với `packages/core`. Quyền sở hữu file ghi trong task ghi đè phạm vi mặc định của agent (kể cả khi `devops-engineer` sửa `eslint.config.mjs`, hay `backend-engineer` sửa `.claude/rules/nestjs.md`).
- Subagent không commit, không push, không tạo subagent khác. Orchestrator kiểm tra kết quả, chạy `.claude/scripts/secret-scan.sh --all-changed`, rồi commit đúng các file của task với commit message ghi trong task (`.claude/rules/git.md`: một dòng, không body, không trailer).
- Task song song chạy trong worktree riêng (`isolation: "worktree"`) tạo từ **HEAD local** của `master` (không từ `origin`). Việc đầu tiên trong worktree là `.claude/scripts/worktree-setup.sh <đường-dẫn-worktree>` (Node 24, `pnpm install --frozen-lockfile`, build core); task phía sau Task 1 chạy thêm `pnpm --filter @schemaforge/api-contract build`. Orchestrator merge về `master` lần lượt từng task và chạy lại lệnh kiểm tra của package bị ảnh hưởng sau mỗi lần merge.
- Cột "Đợt" là thứ tự chạy gợi ý; một task bắt đầu được ngay khi mọi phụ thuộc đã merge. Mỗi đợt tối đa 5 task, tập file sở hữu rời nhau.
- Task có bước "chỉ CI xác nhận" (Task 18) cần push. Theo `.claude/rules/git.md` commit đã qua kiểm tra được push ngay; orchestrator báo user khi job `e2e` đỏ.
- Task 37 cần người dùng thao tác trên trình duyệt thật; orchestrator chuẩn bị môi trường và ghi kết quả người dùng báo lại.

## Quy ước chung cho mọi task

### Chuẩn bị

- Đọc `CLAUDE.md`, `.claude/rules/typescript.md`, `code-quality.md`, `testing.md`, `security.md`, `git.md` và các mục spec mà task tham chiếu trước khi viết file.
  - Task ở `backend/`: thêm `nestjs.md`, `prisma.md`.
  - Task ở `frontend/`: thêm `nextjs.md`, `react.md`.
  - Task ở `packages/api-contract`: thêm `core.md` (áp dụng ranh giới framework-free và isomorphic như core).
- Mọi lệnh chạy ở root repo với tiền tố Node ở mục "Điều kiện tiên quyết".
- **Chỉ tạo và sửa file có trong "File sở hữu" của task.** Cần sửa file khác (kể cả `app.module.ts`, `package.json`, `resources.ts`, file của task khác) thì dừng và báo orchestrator. Không tạo bản sao cục bộ của type hay hàm thuộc package khác để lách.
- **Lockfile và config gốc.** Chỉ Task 1 và Task 2 chạy `pnpm install` có ghi `pnpm-lock.yaml`. Chỉ Task 2 sửa `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.prettierignore`, `eslint.config.mjs`; chỉ Task 2 và Task 18 sửa `.github/workflows/ci.yml`. Không task nào khác chạy `pnpm add`, `pnpm remove`, `pnpm update` hay `pnpm install` không có `--frozen-lockfile`. Thiếu dependency thì dừng và báo.
- Không đọc, in hay commit file `.env`, `.env.test` thật. File mẫu chỉ chứa giá trị giả như spec mục 9.

### TDD

- Viết test trước, chạy thấy đỏ, rồi mới cài đặt. Trong vòng đỏ-xanh, chạy riêng một file (không bật coverage):

  ```bash
  pnpm --filter @schemaforge/backend exec vitest run src/modules/auth/auth.service.spec.ts
  pnpm --filter @schemaforge/frontend exec vitest run src/lib/sync/cloud-pusher.test.ts
  pnpm --filter @schemaforge/api-contract exec vitest run src/schemas.test.ts
  pnpm --filter @schemaforge/backend exec vitest run --config vitest.e2e.config.ts test/auth.e2e-spec.ts
  ```

  Tương đương cho backend, frontend: `.claude/scripts/test-file.sh <backend|frontend> <đường-dẫn>`.
- Tên test là câu tiếng Anh; mỗi test một hành vi; không vòng lặp hay `if` trong test, dữ liệu dạng bảng dùng `it.each`. Test import `describe`, `it`, `expect`, `vi` từ `vitest`.
- Mock chỉ ở biên (`testing.md`): backend unit thay `PrismaService`, `PasswordHasher`, `Clock`, `TokenGenerator` bằng test double; frontend thay `fetch` (qua `fetchImpl`), Web Locks (bản giả), `BroadcastChannel`, `online`, `document.cookie`, scheduler. IndexedDB dùng `fake-indexeddb`, không mock repository trừ khi task ghi rõ.
- Mỗi quy tắc trong "Chữ ký và hành vi" có ít nhất một test nhắm đúng quy tắc đó. Danh sách "Test viết trước" là tối thiểu.
- Tài liệu schema trong test dựng bằng `@schemaforge/core/testing` (`createSampleSchema`, `buildSchema`, `makeTable`, …), không viết JSON tay.

### Code

- Tiếng Anh cho code, identifier, comment, tên test. Không `any`, không `as` (trừ `as const`), không `!`, không `@ts-ignore`, không `enum`, không default export (trừ file framework bắt buộc: `page.tsx`, `layout.tsx`, `*.config.ts`, `prisma.config.ts`). `import type` cho import chỉ có type. Hàm export khai báo kiểu trả về. Boolean bắt đầu bằng `is`, `has`, `can`, `should`. Hàm dưới khoảng 40 dòng, file dưới khoảng 300 dòng, lồng tối đa 3 cấp.
- Backend: import tương đối có đuôi `.js` (`module: nodenext`). Controller chỉ gọi một method của service; không Prisma trong controller hay service ngoài repository; lỗi dự kiến ném `ApiException` (Task 9); không `process.env` ngoài `src/config/` và các ngoại lệ Task 2 khai báo; logger là `Logger` của Nest, không log body, tài liệu schema, mật khẩu, token, cookie hay secret.
- Frontend: import theo alias `@/`; chuỗi hiển thị chỉ qua i18n; màu chỉ qua token theme; mọi gọi mạng chỉ trong `src/lib/api/`; `features/auth`, `features/schema-list`, `features/editor` không import lẫn nhau. `Result` là type của core (`{ isOk: true; value } | { isOk: false; error }`); core không export `ok`, `err` ở entry chính, nên frontend viết object literal hoặc helper cục bộ trong file dùng.
- `packages/api-contract`: chỉ phụ thuộc `zod` và `import type` từ `@schemaforge/core`; không global của trình duyệt hay Node.

### Kiểm tra trước khi báo xong

Trừ khi task ghi khác, chạy với mỗi package mà task sửa (`<pkg>` là `api-contract`, `backend` hoặc `frontend`):

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm turbo run typecheck lint test build --filter @schemaforge/<pkg>
pnpm exec prettier --check <các file sở hữu không phải Markdown>
git status --porcelain
```

`pnpm turbo run` chạy cả `^build` và `generate` (sau Task 2) nên không phải build tay các package phụ thuộc. Với backend, frontend có thể thay dòng `turbo` bằng `.claude/scripts/verify.sh <backend|frontend> --build`.

Kết quả mong đợi: lệnh `turbo` thoát mã 0, mọi test pass, không có dòng `ERROR: Coverage for lines (…) does not meet global threshold`; Prettier thoát mã 0; `git status` chỉ còn file của task, không file tạm. Task có e2e chạy thêm lệnh e2e ghi trong task (cần container `local_postgres`).

Báo cáo gồm: file đã tạo hoặc sửa; lệnh đã chạy kèm kết quả chính (số test, % coverage dòng của package); kết quả các bước "xác nhận" (probe) mà task yêu cầu; vấn đề còn mở.

## Điểm nóng khi làm song song

| Điểm nóng | Cách xử lý |
|---|---|
| `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Task 1 ghi lockfile khi tạo `packages/api-contract` (liên kết workspace, `zod`, `@schemaforge/core`). Task 2 ghi lockfile cho mọi dependency của backend, frontend và `allowBuilds`. Hai task chạy tuần tự, không đồng thời với task ghi lockfile của plan khác. Sau khi merge, worktree đang mở chạy lại `pnpm install --frozen-lockfile` |
| `turbo.json`, `.gitignore`, `.prettierignore`, `eslint.config.mjs` | Chỉ Task 2, một lần cho cả plan (task `generate`, `test:e2e`, `env` của build; bỏ qua `backend/src/generated/`; giữ `.env.test.example`; ngoại lệ lint). Task sau cần ngoại lệ mới thì dừng và báo |
| `.github/workflows/ci.yml` | Task 2 thêm `NEXT_PUBLIC_API_URL` cho job `verify`; Task 18 thêm job `e2e`. Không chung đợt |
| `backend/package.json` | Task 2: dependency. Task 5: script `generate`. Task 15: script `test:e2e`. Ba đợt khác nhau |
| `backend/tsconfig.json` | Task 5 thêm `prisma.config.ts` vào `include`; Task 15 thêm `test`, `vitest.e2e.config.ts` |
| `backend/vitest.config.ts` | Chỉ Task 9 (glob coverage `*.strategy.ts`, `*.mapper.ts`, `*.policy.ts`; bỏ `src/generated/**`) |
| `backend/README.md` | Task 5 (mục PostgreSQL local, `prisma dev`, migration, cookie `Secure` trên Safari); Task 15 (mục e2e) |
| `backend/.env.example`, `backend/.env.test.example` | Task 5 tạo và sửa toàn bộ biến của phần 4. `SHADOW_DATABASE_URL` cũng do Task 5 ghi |
| `backend/src/app.module.ts` | Task 9 viết lại (config, `PrismaModule`, `HealthModule`, `APP_PIPE`, `APP_FILTER`, `APP_GUARD` `OriginGuard`). Task 13 thêm `AuthModule`, `RateLimitModule` và hai `APP_GUARD` `JwtAuthGuard`, `RateLimitGuard` đúng thứ tự sau `OriginGuard`. Task 14 thêm `SchemasModule`. Ba đợt khác nhau |
| `backend/src/common/` | Task 9 sở hữu mọi file trừ `jwt-auth.guard.ts` (Task 12) và `normalize-email.ts` (Task 10) |
| `backend/nest-cli.json` | Chỉ Task 11 (thêm `compilerOptions.assets` cho `common-passwords.txt`) |
| `backend/test/` (helper `set-cookie.ts`, `http-client.ts`, `factories.ts`, `create-test-app.ts`, `reset-database.ts`, `global-setup.ts`) | Chỉ Task 15 tạo và sửa. Task 16, 17 chỉ import; helper mới khai báo cục bộ trong file `*.e2e-spec.ts` của mình |
| `packages/api-contract/src/*` | Chỉ Task 1. Thiếu mã lỗi, trường hay hằng là thay đổi hợp đồng: dừng và báo; orchestrator tạo task sửa hợp đồng, chạy khi không task nào đang dùng phần đó |
| `frontend/src/lib/i18n/resources.ts`, `resources.test.ts`, các file tổng `locales/{en,vi}/auth.ts`, `sync.ts`, `api-errors.ts` | Chỉ Task 19. Task giao diện sau chỉ được thêm key vào **file con** của namespace được ghi trong "File sở hữu" của mình (ví dụ `locales/{en,vi}/sync/conflict-dialog.ts`), không sửa file tổng. Hai task cùng đợt không sở hữu cùng file con |
| File con i18n `locales/{en,vi}/auth/*`, `sync/*` | Task 19 tạo mọi file con. Chủ thêm key: `auth/account-menu.ts`, `auth/sign-in-prompt.ts` là Task 26; `auth/sign-in.ts`, `auth/sign-up.ts`, `auth/credentials-form.ts` là Task 27; `sync/open-schema.ts` là Task 29; `sync/cloud-status.ts` là Task 30; `sync/upload-dialog.ts` là Task 28; `sync/conflict-dialog.ts`, `sync/deleted-in-cloud-dialog.ts` là Task 31; `sync/schema-list.ts` dùng chung Task 32 (đợt 8) và Task 33 (đợt 9); `sync/sign-out-dialog.ts` là Task 34. Không task nào tạo file con mới |
| `frontend/src/lib/storage/database.ts`, `records.ts`, `schema-repository.ts` | Chỉ Task 7. Task đồng bộ dùng method của repository; thiếu method thì dừng và báo |
| `frontend/src/components/app-providers.tsx`, `app-providers.test.tsx`, `src/app/layout.tsx` | Task 26 (provider auth và API client, hint; đợt 6). Task 28 chỉ thêm hai host vào `AppProviders` và một test vào `app-providers.test.tsx` (đợt 7) |
| `frontend/src/components/auth-provider.tsx`, `account-menu.tsx` | Task 26 tạo. Task 34 sửa `account-menu.tsx` (hộp thoại đăng xuất) |
| `frontend/src/features/editor/components/editor-screen.tsx`, `editor-screen-loader.tsx`, `toolbar/editor-toolbar.tsx` | Task 29 sửa `editor-screen-loader.tsx`, `editor-screen.tsx` (luồng mở). Task 30 sửa `editor-screen.tsx`, `editor-toolbar.tsx` (đẩy lên, trạng thái cloud). Task 31 sửa `editor-screen.tsx` (hộp thoại, mount lại store). Ba đợt khác nhau |
| `frontend/src/features/editor/components/editor-workspace.tsx`, `editor-workspace.test.tsx` | Task 30 (đợt 8: props cloud, `useCloudPusher`, state `cloudDialog`); Task 31 (đợt 9: render hộp thoại). Task 29 không sửa |
| `frontend/src/features/schema-list/**` | Task 32 (dữ liệu, các phần, nhãn); Task 33 (thao tác). Hai đợt khác nhau |
| `frontend/src/testing/**` | Task 20 tạo `fake-auth-lock-manager.ts`; Task 29 sửa `mount-editor-journey.tsx`, `render-with-providers.tsx` (và test của chúng) để bọc `AuthProvider` giả, vì Task 29 đưa `useAuth`, `useApiClient` vào `EditorScreen`; Task 35 tạo `fake-api-backend.ts` và thư mục `cloud-journeys/`. Task khác không sửa helper của phần 3 |
| Database test dùng chung trên máy dev | e2e chạy tuần tự (`fileParallelism: false`) và `TRUNCATE` trước mỗi test. Hai worktree không chạy e2e cùng lúc trên `schemaforge_test` |

## Phiên bản

Kiểm tra lại ngày 2026-09-17 (10:18 UTC) bằng `npm view <package> dist-tags time peerDependencies scripts engines`; hành vi `P2002` của driver adapter đọc trực tiếp từ mã nguồn gói `@prisma/client` 7.10.0 và `@prisma/adapter-pg` 7.10.0; tài liệu Prisma 7 và `rate-limiter-flexible` qua Context7 (`/prisma/web`, `/animir/node-rate-limiter-flexible`). pnpm từ chối bản phát hành chưa quá 24 giờ (`minimumReleaseAge`), nên mọi bản dưới đây phát hành trước 2026-09-16 10:18 UTC. Package có trong `catalog` dùng `catalog:`.

| Gói | Khai báo | Bản, ngày phát hành | Package, loại | Ghi chú |
|---|---|---|---|---|
| `prisma` | `7.10.0` (không `^`) | 7.10.0, 2026-08-25 | backend, dev | Dist-tag `latest` vẫn là `8.0.0-rc.15` (2026-09-14); không có 7.10.x hay 7.11 mới hơn. Ghi đúng phiên bản để CLI, client và adapter luôn cùng bản. Script `preinstall` |
| `@prisma/client` | `7.10.0` | 7.10.0, 2026-08-25 | backend | Peer `prisma: *`, `typescript >=5.4.0` |
| `@prisma/adapter-pg` | `7.10.0` | 7.10.0, 2026-08-25 | backend | Kéo theo `pg ^8.16.3`, `@types/pg`; không cần khai báo `pg` riêng |
| `@prisma/engines` | (lồng qua `prisma`) | 7.10.0 | — | Script `postinstall`; cần `allowBuilds` |
| `@prisma/dev` | (lồng qua `prisma`) | 0.24.17 | — | Không có script cài đặt; Task 2 xác nhận không có dependency lồng nào bị chặn build |
| `@nestjs/passport` | `^12.0.0` | 12.0.0, 2026-08-27 | backend | Peer `@nestjs/common ^11 \|\| ^12`, `passport ^0.7` |
| `passport` | `^0.7.0` | 0.7.0, 2023-11-27 | backend | |
| `passport-jwt`, `@types/passport-jwt` | `^4.0.1`, `^4.0.1` | 2022-12-24, 2024-01-26 | backend, types dev | |
| `@nestjs/jwt` | `^12.0.2` | 12.0.2, 2026-09-14 | backend | Peer `@nestjs/common` tới `^12` |
| `cookie-parser`, `@types/cookie-parser` | `^1.4.7`, `^1.4.10` | 2024-10-08, 2025-10-24 | backend, types dev | |
| `@types/express` | `^5.0.6` | 5.0.6, 2025-12-01 | backend, dev | Type cho `express` 5.2.1 mà `@nestjs/platform-express` 12.0.1 đã kéo theo; cần để import `Request`, `Response` (xem Vấn đề 13) |
| `@node-rs/argon2` | `^2.2.1` | 2.2.1, 2026-09-10 | backend | Chỉ có script build của tác giả, không có `install`/`postinstall` |
| `rate-limiter-flexible` | `^11.2.0` | 11.2.0, 2026-06-08 | backend | Không dependency, không peer, không script cài đặt. Xem Vấn đề 1 về `@nestjs/throttler` |
| `helmet` | `^8.3.0` | 8.3.0, 2026-07-12 | backend | |
| `class-validator`, `class-transformer` | `^0.15.1`, `^0.5.1` | 2026-02-26, 2021-11-22 | backend | Peer của `ValidationPipe` |
| `supertest`, `@types/supertest` | `^7.2.2`, `^7.2.1` | 2026-01-06, 2026-07-14 | backend, dev | `superagent ^10.3.0`; xem Vấn đề 12 về cookie `Secure` |
| `zod` | `catalog:` | theo catalog `^4.6.4` | api-contract | |
| `@schemaforge/core` | `workspace:*` | — | api-contract | Chỉ `import type` |
| `@schemaforge/api-contract` | `workspace:*` | — | backend, frontend | |
| `typescript`, `vitest`, `vite`, `@vitest/coverage-v8` | `catalog:` | theo catalog | api-contract, dev | Như `packages/core` (không có `@types/node`, `tsconfig` đặt `types: []`) |
| PostgreSQL | image `postgres:16-alpine` | — | CI job `e2e`, container `local_postgres` | Spec mục 10, 11 |

Không cài: `@nestjs/mapped-types` (không DTO nào cần `PickType`, `OmitType`; `UpdateSchemaDto` là class riêng), `@nestjs/throttler`, `express-rate-limit`, `argon2`, `bcrypt`, `passport-local`, `csrf-csrf`, `@nestjs/swagger`, `@electric-sql/pglite`, `dotenv` (spec mục Phiên bản, mục 4).

## Bảng task

Số task là định danh; bảng sắp theo đợt. Task 0 không có thân riêng (xem [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan)).

| Task | Nội dung | Agent | Phụ thuộc | Đợt |
|---|---|---|---|---|
| 0 | Vấn đề 1–27 đã chốt 2026-09-17 (phương án đề xuất). Không còn vấn đề nào chờ người dùng; không task nào còn bị chặn | orchestrator, spec-writer | — | 0 (song song đợt 1) |
| 1 | Package `packages/api-contract`: hằng, mã lỗi, schema response, type request; lockfile | core-engineer | — | 1 |
| 3 | Cập nhật tài liệu theo "Vấn đề với các spec đã duyệt" 1–6, 9, 10 | spec-writer | — | 1 |
| 4 | `.claude/rules/nestjs.md` theo vấn đề 7, 8 của spec | backend-engineer | 0 (Vấn đề 6, 14) | 1 |
| 7 | Dexie version 2, record có chủ, bảng `session`, method mới của `SchemaRepository` | frontend-engineer | — | 1 |
| 2 | Dependency backend, frontend; `allowBuilds`; `turbo.json`; `.gitignore`; `.prettierignore`; `eslint.config.mjs`; env CI `verify` | devops-engineer | 0 (Vấn đề 1, 4, 6, 13), 1 | 2 |
| 5 | Prisma: `schema.prisma`, migration `init_auth_and_schemas`, `prisma.config.ts`, `PrismaModule`, env backend, README database | backend-engineer | 0, 2 | 3 |
| 6 | Frontend env `NEXT_PUBLIC_API_URL`, CSP `connect-src`, `proxy.ts`, `frontend/.env.example` | frontend-engineer | 0, 2 | 3 |
| 11 | `password.policy`, danh sách mật khẩu phổ biến, `PasswordHasher` | backend-engineer | 1, 2 | 3 |
| 19 | i18n namespace `auth`, `sync`, `apiErrors` | frontend-engineer | 1, 2 | 3 |
| 22 | Hàm thuần đồng bộ: `decideOpenAction`, `mergeSchemaList`, `documentsEqual` | frontend-engineer | 0 (Vấn đề 20: người dùng duyệt cách xử lý các trường hợp biên trước khi code), 1, 2, 7 | 3 |
| 9 | Nền backend: `ApiException`, `ApiExceptionFilter`, `ValidationPipe`, `OriginGuard`, decorator, `Clock`, `configureApp`, `main.ts`, `app.module.ts`, health | backend-engineer | 5 | 4 |
| 20 | API client, `SessionRefresher`, `AuthLockManager` | frontend-engineer | 1, 2, 6 | 4 |
| 10 | Rate limit: guard, decorator, chính sách, module; `normalizeEmail` | backend-engineer | 9 | 5 |
| 12 | Token: `AccessTokenService`, `RefreshTokenRepository`, `RefreshTokenService`, `auth-cookies`, `JwtStrategy`, `JwtAuthGuard` | backend-engineer | 5, 9 | 5 |
| 21 | Auth store, cookie `sf-auth-hint`, `BroadcastChannel`, `sanitizeReturnTo` | frontend-engineer | 7, 20 | 5 |
| 23 | `CloudPusher` và `pushSchemaOnce` | frontend-engineer | 7, 20, 22 | 5 |
| 25 | `signOut`, `forgetPreviousAccount` | frontend-engineer | 7, 20 | 5 |
| 13 | Module auth: users repository, mapper, `AuthService`, controller, DTO; đăng ký guard toàn cục | backend-engineer | 10, 11, 12 | 6 |
| 24 | `uploadLocalSchemas`, `syncPendingSchemas` | frontend-engineer | 23 | 6 |
| 26 | Provider API client và auth, hint phía server, `AccountMenu`, `SignInPrompt` | frontend-engineer | 19, 21, 25 | 6 |
| 14 | Module schemas: repository, service, cursor, mapper, DTO, controller | backend-engineer | 13 | 7 |
| 15 | Hạ tầng e2e và `auth.e2e-spec.ts` (hành trình 1, 2, 3, 11) | backend-engineer | 13 | 7 |
| 27 | Màn hình `/sign-in`, `/sign-up` | frontend-engineer | 26 | 7 |
| 28 | Hộp thoại đưa schema của khách lên, host đồng bộ nền | frontend-engineer | 24, 26 | 7 |
| 29 | Editor: luồng mở schema theo `decideOpenAction` | frontend-engineer | 22, 26 | 7 |
| 16 | `schemas.e2e-spec.ts` (hành trình 4–9, 14) | backend-engineer | 14, 15 | 8 |
| 17 | `security.e2e-spec.ts` (hành trình 10, 12, 13) | backend-engineer | 14, 15 | 8 |
| 18 | Job CI `e2e` | devops-engineer | 15 | 8 |
| 30 | Editor: `useCloudPusher`, trạng thái cloud trên toolbar, "Lưu lên cloud" | frontend-engineer | 23, 24, 29 | 8 |
| 32 | Danh sách: gộp cloud và cache, các phần, nhãn, banner | frontend-engineer | 22, 24, 26 | 8 |
| 31 | Editor: hộp thoại xung đột, hộp thoại bị xóa trên cloud | frontend-engineer | 30 | 9 |
| 33 | Danh sách: tạo, đổi tên, xóa khi đã đăng nhập, "Lưu lên cloud" trên dòng | frontend-engineer | 32 | 9 |
| 34 | Hộp thoại đăng xuất trong `AccountMenu` | frontend-engineer | 24, 25, 26 | 9 |
| 35 | Backend giả trong bộ nhớ, tích hợp 1, 4, 5, 7 | frontend-engineer | 27, 28, 31, 33, 34 | 10 |
| 36 | Tích hợp 2, 3, 6 | frontend-engineer | 35 | 11 |
| 37 | Checklist kiểm tra tay (spec mục 11) | user, orchestrator, frontend-engineer | 16, 17, 18, 36 | 12 |
| 38 | Tài liệu cuối (`roadmap.md`, `architecture.md`, `CLAUDE.md`), kiểm tra toàn repo | spec-writer, orchestrator | 3, 4, 37 | 13 |

Nhóm song song theo đợt (tập file rời nhau):

- Đợt 1: Task 1 (`packages/api-contract/`, lockfile), Task 3 (`document/`), Task 4 (`.claude/rules/nestjs.md`), Task 7 (`frontend/src/lib/storage/`).
- Đợt 2: Task 2 một mình (lockfile, config gốc).
- Đợt 3: backend Task 5, 11; frontend Task 6, 19, 22.
- Đợt 4: backend Task 9; frontend Task 20.
- Đợt 5: backend Task 10, 12; frontend Task 21, 23, 25.
- Đợt 6: backend Task 13; frontend Task 24, 26.
- Đợt 7: backend Task 14, 15; frontend Task 27, 28, 29.
- Đợt 8: backend Task 16, 17; devops Task 18; frontend Task 30, 32.
- Đợt 9: frontend Task 31, 33, 34.
- Đợt 10–13: Task 35, 36, 37, 38 lần lượt.

Đường tới hạn: Task 1 → 2 → 6 → 20 → 23 → 24 → 26 (cùng đợt 6 với 24, cần 21, 25) → 29 → 30 → 31 → 35 → 36 → 37 → 38. Nhánh backend (1 → 2 → 5 → 9 → 12 → 13 → 14 → 16, 17) xong ở đợt 8, trước nhánh frontend. Task 0 phải xong trước các task nằm trong cột "Ảnh hưởng" của vấn đề tương ứng; task khác không chờ Task 0.

## Vấn đề phát hiện khi lập plan

Các task được viết theo phương án đánh dấu **(đề xuất)**. **Task 0** (không có thân riêng): orchestrator trình bảng này cho người dùng, spec-writer ghi lựa chọn vào spec (với vấn đề đổi quyết định của spec) và vào các task bị ảnh hưởng của plan này, rồi orchestrator mới giao các task ở cột "Ảnh hưởng tới task". Người dùng chọn khác đề xuất thì chỉ sửa đúng các task đó.

Cột "Trạng thái": ngày 2026-09-17 người dùng đã chốt phương án đề xuất cho Vấn đề 1–26 (23–26 do người viết các task backend nêu thêm, trình người dùng cùng ngày) và Vấn đề 27 (nêu thêm khi viết Task 24, 30). Không còn vấn đề nào chờ người dùng; không task nào bị chặn bởi Task 0.

Bằng chứng kiểm tra ngày 2026-09-17 (13:36 UTC) bằng `npm view`, mã nguồn gói tải về bằng `npm pack` vào thư mục tạm (không cài vào repo), Context7 (`/websites/turborepo_dev`, `/prisma/web`, `/vitejs/vite`), GitHub API của SecLists và code hiện có trong repo.

| # | Vấn đề | Bằng chứng | Phương án | Ảnh hưởng tới task | Trạng thái |
|---|---|---|---|---|---|
| 1 | **`@nestjs/throttler` đã hỗ trợ NestJS 12.** Spec mục 3 và mục "Rủi ro" yêu cầu cân nhắc lại khi có bản như vậy trước khi lập plan, bằng cách sửa spec | `@nestjs/throttler` 6.6.0 (2026-09-16 17:54 UTC) và 6.7.0 (2026-09-17 09:08 UTC) khai báo peer `@nestjs/common`, `@nestjs/core` tới `^12.0.0`. Cả hai chưa qua 24 giờ của `minimumReleaseAge` lúc lập plan; 6.6.0 cài được từ 2026-09-17 17:54 UTC. Throttler khóa theo chuỗi `getTracker` trả về, nên khóa IP + email vẫn phải tự viết | (a) **(đề xuất)** Giữ `rate-limiter-flexible` như spec; xem lại throttler ở phần 5 khi thêm giới hạn cho AI. Lý do: guard, chính sách hai khóa cho đăng nhập và hình dạng lỗi đã thiết kế xong; bản throttler mới chỉ vài giờ tuổi. (b) Đổi sang `@nestjs/throttler` ^6.6.0 sau khi đủ 24 giờ: sửa spec mục 3, "Phiên bản", bảng test; Task 10 viết lại theo `ThrottlerGuard` với `getTracker` riêng | Task 2, 10 | Đã chốt 2026-09-17: phương án đề xuất |
| 2 | **`P2002` qua driver adapter không có model và trường.** Spec mục 5 chọn mã lỗi "theo model và trường" (`User.email`, `Schema.id`) | Mã nguồn `@prisma/adapter-pg` 7.10.0 (`dist/index.mjs`, nhánh `23505`): khi PostgreSQL trả tên ràng buộc (luôn có với unique và khóa chính), `constraint` là `{ index: "<tên ràng buộc>" }`; chỉ khi không có tên mới là `{ fields }`. `@prisma/client` 7.10.0 (`runtime/client.mjs`) ném `P2002` với `meta = { driverAdapterError, table }`, không có `meta.target` | (a) **(đề xuất)** `ApiExceptionFilter` đọc `meta.driverAdapterError.cause.constraint.index` bằng một schema Zod hẹp, tra một bảng duy nhất theo tên ràng buộc do migration đặt: `users_email_key` → `email-already-registered`, `schemas_pkey` → `schema-id-unavailable`; tên khác hoặc không đọc được → `500`. e2e xác nhận tên thật. (b) Service kiểm tra tồn tại trước khi ghi: có race giữa hai câu, nên vẫn phải dịch `P2002` | Task 9, 13, 14, 16 | Đã chốt 2026-09-17: phương án đề xuất |
| 3 | **Tham số query dạng số.** `GET /schemas?limit=2` gửi chuỗi `"2"`; spec mục 5 dùng `@IsInt()` với `ValidationPipe` có `transform: true` | `transform: true` gọi `plainToInstance` nhưng không đổi kiểu thuộc tính khi thiếu `@Type` hoặc `transformOptions.enableImplicitConversion` (docs.nestjs.com, "Validation", mục "Transform payload objects"), nên `@IsInt()` từ chối `"2"` | (a) **(đề xuất)** `@Type(() => Number)` trên đúng trường `limit` của `ListSchemasQueryDto`; tùy chọn `ValidationPipe` giữ như `nestjs.md`. (b) Bật `enableImplicitConversion` toàn cục: đổi kiểu ngầm ở mọi DTO, ví dụ chuỗi `"false"` thành `true` với trường boolean | Task 9, 14 | Đã chốt 2026-09-17: phương án đề xuất |
| 4 | **Turborepo chặn biến môi trường không khai báo.** Job CI `e2e` đặt `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS`, `NODE_ENV` ở mức job rồi chạy `pnpm turbo run test:e2e` (spec mục 11) | Turborepo từ 2.0 mặc định Strict Mode: task chỉ thấy biến có trong `env`, `globalEnv` hoặc `passThroughEnv` (turborepo.dev, "Upgrading to 2.0", mục "Strict Mode"). Repo dùng `turbo` ^2.10.12; `turbo.json` hiện không khai báo biến nào | (a) **(đề xuất)** Task `test:e2e` có `passThroughEnv` gồm `NODE_ENV`, `DATABASE_URL`, `SHADOW_DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS`, `AUTH_COOKIE_SECURE`, `TRUST_PROXY_HOPS` (không vào hash; task đã `cache: false`). `@schemaforge/frontend#build` có `env: ["NEXT_PUBLIC_API_URL"]` như spec. (b) `envMode: "loose"` cho cả repo: bỏ bảo vệ chống dùng cache sai theo biến môi trường | Task 2, 18 | Đã chốt 2026-09-17: phương án đề xuất |
| 5 | **`pnpm build` ở local thất bại với quy tắc `NEXT_PUBLIC_API_URL`.** Spec mục 9: "bắt buộc và phải là `https` khi build production"; tiêu chí hoàn thành yêu cầu `pnpm build` chạy qua ở local | `next build` chạy với `NODE_ENV=production`. Bản clone sạch và worktree của agent không có `frontend/.env` (gitignore), còn `frontend/.env.example` là `http://localhost:3001`, nên build local hoặc thiếu biến hoặc gặp `http`. `.claude/scripts/verify.sh --build` của agent cũng build frontend | (a) **(đề xuất)** Thiếu biến thì mọi môi trường dùng `http://localhost:3001`; `http` chỉ được nhận khi host là `localhost`, `127.0.0.1` hoặc `[::1]`, host khác phải `https`. Thêm ràng buộc "đặt `NEXT_PUBLIC_API_URL` trỏ tới backend `https`" vào spec mục 12. (b) Giữ spec: build production bắt buộc biến và `https`; developer và agent phải đặt `NEXT_PUBLIC_API_URL=https://api.schemaforge.invalid` trước `pnpm build`. (c) Bắt buộc biến ở production nhưng nhận `http` loopback; developer chép `frontend/.env.example` thành `frontend/.env`; worktree vẫn thất bại | Task 6 | Đã chốt 2026-09-17: phương án đề xuất |
| 6 | **`process.env` ngoài `src/config/` cho công cụ e2e.** Spec mục 9 coi `backend/prisma.config.ts` là ngoại lệ duy nhất của `nestjs.md` | Spec mục 9, 11: `vitest.e2e.config.ts` nạp `.env.test` vào `process.env`; `globalSetup` phải kiểm `NODE_ENV=test` trước khi chạy `prisma migrate deploy`. `eslint.config.mjs` áp `no-restricted-properties` cho `process.env` ở mọi `**/*.{ts,tsx}`, chỉ tắt ở `frontend/src/lib/env.ts` và `backend/src/config/**` | (a) **(đề xuất)** Ngoại lệ gồm file cấu hình công cụ ở gốc backend (`backend/prisma.config.ts`, `backend/vitest.e2e.config.ts`) và `backend/test/global-setup.ts`; ghi vào `nestjs.md` và `eslint.config.mjs`. (b) Chỉ `prisma.config.ts` như spec; `globalSetup` nhận giá trị qua `provide` của Vitest từ file cấu hình, nhưng file cấu hình vẫn đọc `process.env`, nên vẫn phải sửa spec | Task 2, 4, 15 | Đã chốt 2026-09-17: phương án đề xuất |
| 7 | **Nguồn danh sách mật khẩu phổ biến.** Spec mục 2 để plan chọn nguồn có giấy phép phù hợp, khoảng 3.000 mục | Kho SecLists có giấy phép MIT (GitHub API, `license.spdx_id`); thư mục `Passwords/Common-Credentials` có `xato-net-10-million-passwords-100000.txt`, `Pwdb_top-10000.txt`, `10k-most-common.txt`. Phần lớn mục đầu của các danh sách này ngắn hơn 8 ký tự, nên đằng nào cũng bị kiểm tra độ dài chặn | (a) **(đề xuất)** Từ `xato-net-10-million-passwords-100000.txt`: chuẩn hóa NFKC, chữ thường, giữ mục dài 8 đến 128 code point, bỏ trùng, lấy 3.000 mục đầu theo thứ tự xếp hạng. Các dòng đầu bắt đầu bằng `#` ghi nguồn, commit SecLists và giấy phép MIT; loader bỏ dòng `#`. (b) Như (a) nhưng từ `Pwdb_top-10000.txt` (có thể không đủ 3.000 mục sau khi lọc). (c) 3.000 mục đầu không lọc độ dài: đạt con số của ASVS nhưng phần lớn mục vô tác dụng | Task 11 | Đã chốt 2026-09-17: phương án đề xuất |
| 8 | **Role sở hữu database trong container `local_postgres`.** Spec mục 10 tạo `schemaforge_dev`, `schemaforge_test`, `schemaforge_shadow` trong container sẵn có nhưng không nói dùng role nào | Container dùng chung với dự án khác trên máy dev; `.env.example` chỉ chứa giá trị giả (`security.md`). `SHADOW_DATABASE_URL` được khai báo rõ, nên role không cần quyền `CREATEDB` | (a) **(đề xuất)** Role riêng `schemaforge` (mật khẩu developer tự đặt, không commit) sở hữu ba database; README ghi lệnh tạo qua `docker exec -i local_postgres psql`. (b) Superuser sẵn có của container cho cả ba database: ít bước hơn, nhưng app chạy với quyền trên mọi database của container | Task 5, 15 | Đã chốt 2026-09-17: phương án đề xuất |
| 9 | **Bộ đếm rate limit dùng chung giữa các test e2e.** Nhiều hành trình đăng ký hai người dùng; giới hạn đăng ký là 5 lần/giờ theo IP, và mọi request e2e đến từ cùng một IP | `RateLimiterMemory` nằm trong provider của `RateLimitModule`, sống theo vòng đời app Nest. Spec mục 11 chỉ `TRUNCATE` database trước mỗi test. e2e 11 phải kiểm đúng chính sách thật | (a) **(đề xuất)** `createTestApp()` dựng app mới trong `beforeEach`, đóng trong `afterEach`: mỗi test có bộ đếm mới, chính sách vẫn là thật. (b) Dựng app một lần mỗi file; helper tạo người dùng ghi thẳng qua `PrismaService` và `PasswordHasher`, chỉ hành trình kiểm đăng ký mới gọi HTTP: nhanh hơn nhưng phần lớn hành trình bỏ qua đường đăng ký thật | Task 15, 16, 17 | Đã chốt 2026-09-17: phương án đề xuất |
| 10 | **`RateLimitGuard` chạy trước `ValidationPipe`.** Khóa đăng nhập là "IP + email đã chuẩn hóa" (spec mục 3), nhưng guard chỉ thấy body thô | Thứ tự của Nest: middleware, guard, interceptor, rồi pipe (docs.nestjs.com, "Guards"). Body đã qua parser JSON, nhưng `email` có thể thiếu, không phải chuỗi, còn khoảng trắng hoặc chữ hoa | (a) **(đề xuất)** Guard đọc `request.body.email`: là chuỗi thì chuẩn hóa bằng `normalizeEmail` (cùng hàm mà `@Transform` của DTO dùng) rồi băm; không phải chuỗi thì bỏ qua khóa IP + email cho request đó, khóa IP vẫn tính; `ValidationPipe` sau đó trả `400`. (b) Chuyển giới hạn IP + email vào `AuthService.login` sau khi validate: trái quyết định "bọc trong guard" của spec, và `429` phải dựng ở service | Task 10, 13 | Đã chốt 2026-09-17: phương án đề xuất |
| 11 | **e2e 13 cần một lỗi `500` thật.** Spec mục 11: "lỗi `500` không có stack hay chi tiết" | Không route nào của phần 4 ném lỗi không dự kiến khi database chạy bình thường; route chỉ để test trong `AppModule` là code chết ở production | (a) **(đề xuất)** `security.e2e-spec.ts` dựng module với `overrideProvider(SchemasRepository)` bằng bản có method danh sách ném `Error` chứa chuỗi giống SQL; `GET /schemas` phải trả body đúng bằng `{ statusCode: 500, code: "internal-error" }`. (b) Controller chỉ có trong `backend/test/`: kiểm được filter nhưng không đi qua module thật | Task 17 | Đã chốt 2026-09-17: phương án đề xuất |
| 12 | **`supertest` không gửi lại cookie `Secure` qua `http`.** Spec mục 11 dùng agent của `supertest` để giữ cookie, trong khi e2e 1 kiểm cookie có `Secure` | Mã nguồn `superagent` 10.3.0 (`lib/node/agent.js`): cookie trong jar được chọn bằng `new CookieAccessInfo(url.hostname, url.pathname, url.protocol === 'https:')`, nên cookie `Secure` không được gửi tới server test `http://127.0.0.1` | (a) **(đề xuất)** e2e giữ `AUTH_COOKIE_SECURE=true` như production; helper `test/cookie-session.ts` đọc `Set-Cookie` của từng response (`Max-Age=0` là xóa) và tự đặt header `Cookie` cho request sau, không dùng jar của agent. (b) `.env.test` đặt `AUTH_COOKIE_SECURE=false`, riêng e2e 1 dựng app với `true` để kiểm thuộc tính: mọi hành trình khác chạy khác production | Task 15, 16, 17 | Đã chốt 2026-09-17: phương án đề xuất |
| 13 | **Thiếu `@types/express`.** Mục "Phiên bản" của spec không có gói này | `@nestjs/platform-express` 12.0.1 kéo `express` 5.2.1 nhưng không kéo type; `@types/cookie-parser` 1.4.10 chỉ khai báo `@types/express` là peer. `configureApp` (`trust proxy`), `OriginGuard`, `RateLimitGuard`, `JwtStrategy` và controller auth (`@Res({ passthrough: true })`) cần `Request`, `Response` của Express | (a) **(đề xuất)** Thêm `@types/express` ^5.0.6 (2025-12-01) vào devDependencies của backend. (b) Tự khai báo type tối thiểu cho `Request`, `Response` trong `src/common/`: trùng type của thư viện, trái `typescript.md` (một nguồn cho mỗi type) | Task 2, 9, 12, 13 | Đã chốt 2026-09-17: phương án đề xuất |
| 14 | **Quy ước tên file và controller của `nestjs.md` chưa khớp cấu trúc của spec.** Rule: file theo mẫu `<name>.<kind>.ts`, một repository mỗi feature, controller "call a single service method" | Mục "Cấu trúc thư mục" của spec có file không theo mẫu (`auth-cookies.ts`, `password-hasher.ts`, `schema-list-cursor.ts`, `clock.ts`, `app-setup.ts`) và hai repository trong module `auth`; mục 3 gọi file chính sách là `rate-limit-policies.ts`, cấu trúc thư mục ghi `rate-limit.policy.ts`. Controller auth phải đặt cookie sau lời gọi service. `backend/vitest.config.ts` chỉ tính coverage theo glob hậu tố (`*.service.ts`, `*.guard.ts`, …) | (a) **(đề xuất)** `nestjs.md` ghi: mẫu `<name>.<kind>.ts` áp cho khối của Nest và các loại `repository`, `mapper`, `strategy`, `policy`; helper thuần không có loại dùng `<name>.ts` kebab-case; một feature có thể có nhiều repository; controller gọi đúng một method của service rồi có thể đưa kết quả cho helper thuần dựng response (ví dụ đặt cookie). File chính sách là `rate-limit.policy.ts`. Task 9 thêm từng helper vào `coverage.include`. (b) Đổi tên mọi helper sang mẫu có loại (`auth-cookies.helper.ts`, …) và đặt cookie trong interceptor: không sửa rule nhưng sửa cấu trúc thư mục của spec | Task 4, 9, 10, 11, 12, 13, 14 | Đã chốt 2026-09-17: phương án đề xuất |
| 15 | **Nơi deploy chưa chọn khi code xong.** Task 38 đổi phần 4 sang `Xong` | Spec mục 12 để việc chọn nơi deploy (frontend, backend, PostgreSQL) cho "một bước sau trong phần 4"; plan không có task deploy | (a) **(đề xuất)** Phần 4 thành `Xong` khi code, CI và checklist Task 37 xong; thêm dòng "Nơi deploy frontend, backend, PostgreSQL" vào mục "Chưa chốt" của `architecture.md` (ứng viên: gói miễn phí, frontend và backend cùng site theo spec mục 8, 12); Task 38 hỏi người dùng trước bước 4. (b) Giữ `Đang làm` tới khi deploy xong | Task 38 | Đã chốt 2026-09-17: phương án đề xuất |
| 16 | **Chỗ của trạng thái cloud trên toolbar.** Phần 3 có `SaveStatusBadge` ("Đang lưu", "Đã lưu") | Spec mục 7 "Trạng thái trên toolbar" liệt kê trạng thái cloud nhưng không nói huy hiệu ghi local của phần 3 còn hiện hay không; hai huy hiệu cạnh nhau lặp ý trên toolbar hẹp | (a) **(đề xuất)** Ghi local không lỗi thì `CloudStatusBadge` thay chữ "Đang lưu", "Đã lưu" ở đúng vị trí đó; ghi local lỗi thì chỉ hiện `SaveStatusBadge` như phần 3. (b) Hiện cả hai huy hiệu | Task 30 | Đã chốt 2026-09-17: phương án đề xuất |
| 17 | **Hộp thoại đăng xuất sau "Thử đồng bộ" hết thay đổi chưa đồng bộ** | Spec mục 7 "Đăng xuất" bước 1 có nút "Thử đồng bộ" nhưng không nói hộp thoại làm gì khi số đếm về 0 | (a) **(đề xuất)** Hộp thoại đổi sang "Mọi thay đổi đã lưu lên cloud" kèm nút "Đăng xuất"; không tự đăng xuất. (b) Tự đăng xuất ngay khi số đếm về 0 | Task 34, 36 | Đã chốt 2026-09-17: phương án đề xuất |
| 18 | **Refresh thất bại không phải `401`** (mạng, `timeout`, `5xx`, `429`, response sai hợp đồng) | Spec mục 6 "API client": refresh thất bại thì gọi `onSessionExpired`; mất mạng thoáng qua lúc refresh không có nghĩa phiên đã hết | (a) **(đề xuất)** Chỉ `http 401` từ refresh gọi `onSessionExpired`; failure khác trả nguyên cho nơi gọi, không đổi trạng thái auth, không xóa hint. (b) Mọi thất bại của refresh coi là hết phiên: mất mạng một lần là phải đăng nhập lại | Task 20, 21 | Đã chốt 2026-09-17: phương án đề xuất |
| 19 | **Backend không phản hồi lúc khởi động khi có cookie gợi ý** | Spec mục 6 "Auth store" chỉ mô tả `me` thành công và `401`; không nói `network`, `timeout`, `5xx` | (a) **(đề xuất)** Trạng thái `expired` kèm `lastUser` đọc từ bản ghi `session`, giữ cookie gợi ý; cache của tài khoản vẫn mở được (`wait-for-sign-in`). (b) `signed-out` và xóa hint: cache của tài khoản bị ẩn tới khi đăng nhập lại | Task 21, 22, 29 | Đã chốt 2026-09-17: phương án đề xuất |
| 20 | **Trường hợp thiếu trong bảng "Mở schema" và "Gộp một id"** | Spec mục 7 không có dòng cho: "Mở schema": cache `conflict` + cloud cùng revision; cache `deleted-in-cloud` + cloud vẫn còn; cache có chủ khi `signed-out`; tài liệu cloud lỗi cấu trúc khác `version-unsupported`. "Gộp một id": cloud còn nhưng cache `deleted-in-cloud`; cache `conflict` khi cloud không còn | (a) **(đề xuất)** Task 22 viết đề xuất xử lý cho từng trường hợp (kèm tên test) và gửi orchestrator trước khi code; người dùng duyệt; orchestrator ghi lựa chọn vào thân Task 22 rồi mới cho Task 22 code. (b) Plan chốt sẵn cách xử lý từng trường hợp ngay bây giờ, không qua bước duyệt | Task 22 (kết quả dùng ở Task 29, 32) | Đã chốt 2026-09-17: phương án đề xuất |
| 21 | **Hộp thoại đưa schema của khách lên khi không chọn schema nào** | Spec mục 7 "Đưa schema của khách lên cloud" không nói | (a) **(đề xuất)** Nút "Lưu lên cloud" bị `disabled` khi không có checkbox nào được chọn. (b) Bấm được và xử lý như "Để sau" | Task 28 | Đã chốt 2026-09-17: phương án đề xuất |
| 22 | **API client thiếu `retryAfterSeconds` và `signal`** | Spec mục 7 "Đẩy lên cloud" yêu cầu chờ theo `Retry-After` với `429`, nhưng phác thảo `ApiFailure` ở spec mục 6 không có trường này; danh sách cloud (Task 32) cần hủy lần tải cũ | (a) **(đề xuất)** Failure `http` có `retryAfterSeconds: number \| null` (đọc header `Retry-After` dạng số giây); mọi method của `ApiClient` nhận `options?: { signal?: AbortSignal }`, ghép với timeout bằng `AbortSignal.any`. (b) `CloudPusher` bỏ qua `Retry-After`, chỉ giãn cách theo cấp số: trái spec | Task 20, 23, 32 | Đã chốt 2026-09-17: phương án đề xuất |
| 23 | **`ApiExceptionFilter` với `HttpException` có sẵn của Nest** | Spec mục 5 "Hình dạng lỗi": lỗi dự kiến là `ApiException`, lỗi khác là `500`. Nhưng `ParseUUIDPipe`, route không tồn tại, body parser và `JwtAuthGuard` mặc định ném `BadRequestException`, `NotFoundException`, `PayloadTooLargeException`, `UnauthorizedException` | (a) **(đề xuất)** Map theo status: 400 → `validation-failed` với `fields: []`; 401 → `unauthenticated`; 404 → `not-found`; 413 → `payload-too-large`; 429 → `too-many-requests`; status khác → `500 internal-error`, log như lỗi không dự kiến. (b) Mọi `HttpException` không phải `ApiException` → `500`: route không tồn tại trả `500` thay vì `404` | Task 9, 17 | Đã chốt 2026-09-17: phương án đề xuất |
| 24 | **Hai refresh đồng thời cùng một refresh token** | Spec mục 1 "Access token và refresh token": dùng lại token đã xoay thì thu hồi cả họ; không nói hai request tới gần như cùng lúc (Web Lock không có, mạng gửi lại). `repository.rotate` là update có điều kiện nên chỉ một request thắng | (a) **(đề xuất)** Bên thua (`rotate` trả `false`) xử lý như dùng lại token: thu hồi cả họ, `401 session-expired`. Frontend đã tuần tự hóa refresh giữa các tab (Task 20) nên trường hợp này hiếm. (b) Bên thua trả `401` nhưng không thu hồi họ: ít đăng xuất ngoài ý muốn hơn nhưng yếu hơn khi token bị lộ | Task 12, 15 | Đã chốt 2026-09-17: phương án đề xuất |
| 25 | **Field của DTO và rule cấm `!`** | `.claude/rules/typescript.md` cấm non-null `!`; field của DTO do `class-transformer` điền nên không có initializer, và `strict` (`strictPropertyInitialization`) báo lỗi nếu không đánh dấu | (a) **(đề xuất)** Dùng definite assignment `readonly email!: string` chỉ cho field của DTO; Task 4 ghi rõ ngoại lệ này trong `nestjs.md`. (b) Field optional `readonly email?: string`: service phải thu hẹp lại giá trị mà `ValidationPipe` đã bảo đảm | Task 4, 13, 14 | Đã chốt 2026-09-17: phương án đề xuất |
| 26 | **Đặt, xóa cookie trong controller auth** | `nestjs.md`: controller gọi đúng một method của service (Vấn đề 14 cho phép đưa kết quả cho helper thuần); cookie cần `AUTH_COOKIE_SECURE` từ `ConfigService`; refresh thất bại phải xóa cookie trước khi trả lỗi | (a) **(đề xuất)** Provider `AuthCookies` (inject `ConfigService`) có `set`, `clear`; controller gọi sau method của service; refresh trả `null` thì `authCookies.clear(response)` rồi ném `401 session-expired`. Task 4 ghi rằng controller được gọi provider dựng response này. (b) Interceptor đặt, xóa cookie dựa trên giá trị trả về và lỗi của handler: controller không đụng `Response`, nhưng thêm một lớp khó test và lệch cấu trúc thư mục của spec | Task 4, 12, 13 | Đã chốt 2026-09-17: phương án đề xuất |
| 27 | **`uploadLocalSchemas` có thể đổi id schema, nơi gọi cần biết id mới** | Task 24 bước 3: `409 schema-id-unavailable` rồi `get` cho `404` thì `generateId()`, đổi id ở ba bảng, `create` lại. `UploadReport` hiện chỉ có `uploadedIds`, `skipped`, `stoppedBy`, `notAttemptedIds`, không có chỗ ghi id mới; Task 30 "Lưu lên cloud" gọi `uploadLocalSchemas` cho đúng schema đang mở trong editor và cần điều hướng sang route mới nếu id đã đổi, nếu không URL vẫn trỏ tới id đã bị xóa cục bộ | (a) **(đề xuất)** `UploadReport` thêm `movedIds: ReadonlyMap<string, string>` (id cũ → id mới), ghi đúng lúc bước 3 đổi id; `uploadedIds` vẫn chứa id mới (id hiện có của schema sau khi upload). Task 30 `onSaveToCloud`: sau khi `uploadLocalSchemas` trả về, `movedIds.get(schemaId)` khác `undefined` thì `router.replace` sang `/schemas/<id mới>` thay vì chỉ đặt `ownerId` state (route cũ không còn là id thật của schema) | Task 24, 30 | Đã chốt 2026-09-17: phương án đề xuất |

## Task 1: Package `packages/api-contract`

**Mục tiêu:** hợp đồng giữa frontend và backend (spec mục 5 "DTO và response", "Hình dạng lỗi", "Hợp đồng API: `packages/api-contract`") có trước mọi task dùng nó.

**Agent:** `core-engineer`. **Phụ thuộc:** —. **Đợt:** 1.

**File sở hữu:**

- Tạo: `packages/api-contract/package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `README.md`; `packages/api-contract/src/index.ts`, `limits.ts`, `errors.ts`, `auth.ts`, `schemas.ts`, và `limits.test.ts`, `errors.test.ts`, `auth.test.ts`, `schemas.test.ts` cùng thư mục.
- Sửa: `pnpm-lock.yaml` (chỉ qua `pnpm install`).

**Cài đặt:**

- `package.json` chép khuôn `packages/core/package.json`: `name` `@schemaforge/api-contract`, `private`, `type: module`, một entry `"."` (`types` `./dist/index.d.ts`, `default` `./dist/index.js`), năm script `build`, `dev`, `lint`, `typecheck`, `test` giống hệt core. `dependencies`: `zod: catalog:`, `@schemaforge/core: workspace:*`. `devDependencies`: `@vitest/coverage-v8`, `typescript`, `vite`, `vitest`, đều `catalog:`.
- `tsconfig.json`, `tsconfig.build.json` (loại `src/**/*.test.ts`), `vitest.config.ts` (`environment: node`, `include: ["src/**/*.test.ts"]`, coverage `include: ["src/**/*.ts"]`, `thresholds: { lines: 90 }`) chép khuôn core.
- `README.md` (tiếng Anh, như README của core): vai trò của package, chỉ phụ thuộc `zod` và `import type` từ core, không global của trình duyệt hay Node.
- Chạy `pnpm install` một lần ở root sau khi tạo `package.json`. Diff của `pnpm-lock.yaml` chỉ thêm importer `packages/api-contract`.

**Chữ ký và hành vi:**

`limits.ts`:

```ts
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;   // đếm theo code point, sau NFKC
export const PASSWORD_MAX_LENGTH = 128;
export const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024;
export const SCHEMA_LIST_DEFAULT_LIMIT = 50;
export const SCHEMA_LIST_MAX_LIMIT = 100;
export const MAX_SCHEMAS_PER_USER = 100;
```

`errors.ts`:

```ts
export const API_ERROR_CODES = ["validation-failed", "password-too-common", "unauthenticated",
  "invalid-credentials", "session-expired", "origin-not-allowed", "schema-limit-reached", "not-found",
  "email-already-registered", "schema-id-unavailable", "revision-conflict", "payload-too-large",
  "document-invalid", "too-many-requests", "internal-error"] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
export const API_ERROR_STATUS = { "validation-failed": 400, /* … */ } as const satisfies Record<ApiErrorCode, number>;
export const SIMPLE_API_ERROR_CODES = [/* API_ERROR_CODES trừ ba mã có dữ liệu thêm */] as const;
export type SimpleApiErrorCode = (typeof SIMPLE_API_ERROR_CODES)[number];
export type FieldError = { readonly path: string; readonly constraint: string };
export type ApiErrorBody = /* đúng union của spec mục 5, documentErrors: readonly StructuralError[] */;
export type ParsedApiErrorBody = /* như ApiErrorBody, nhưng documentErrors[].code là string */;
export function parseApiErrorBody(value: unknown): ParsedApiErrorBody | null;
```

- Thứ tự `API_ERROR_CODES` và status trong `API_ERROR_STATUS` đúng bảng mã lỗi của spec mục 5. Backend dùng `API_ERROR_STATUS` để dựng `ApiException` (Task 9), nên mã và status không lệch nhau.
- `StructuralError` lấy bằng `import type` từ `@schemaforge/core`. Core không export mảng mã lỗi cấu trúc ở entry chính, nên schema Zod của `documentErrors` nhận `code: string` và `path: (string | number)[]`; frontend chỉ cần so `code === "version-unsupported"`. Một dòng trong `errors.test.ts` gán giá trị kiểu `ApiErrorBody` vào biến kiểu `ParsedApiErrorBody` để typecheck bảo đảm backend luôn tạo được body mà frontend parse được.
- `parseApiErrorBody`: `safeParse` một union gồm `validation-failed` (`statusCode` 400, `fields` là mảng `FieldError`), `revision-conflict` (409, `currentRevision` số nguyên dương), `document-invalid` (422, `documentErrors`), và mã đơn giản (`statusCode` số nguyên 400 đến 599, `code` thuộc `SIMPLE_API_ERROR_CODES`). Bỏ trường lạ (`z.object`, không `z.strictObject`); sai thì trả `null`.

`auth.ts`:

```ts
export type RegisterRequest = { readonly email: string; readonly password: string };
export type LoginRequest = { readonly email: string; readonly password: string };
export const userResponseSchema = z.object({ id: z.uuid(), email: z.string(), createdAt: z.iso.datetime() });
export type UserResponse = Readonly<z.infer<typeof userResponseSchema>>;
export const authUserResponseSchema = z.object({ user: userResponseSchema }); // body của register, login, me
export type AuthUserResponse = Readonly<z.infer<typeof authUserResponseSchema>>;
```

`schemas.ts`:

```ts
export const schemaSummarySchema = z.object({ id: z.uuid(), name: z.string(), revision: z.int().positive(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() });
export const schemaDetailSchema = schemaSummarySchema.extend({ document: /* unknown, bắt buộc có mặt */ });
export const schemaListSchema = z.object({ items: z.array(schemaSummarySchema), nextCursor: z.string().nullable() });
export type SchemaSummary = Readonly<z.infer<typeof schemaSummarySchema>>; // tương tự SchemaDetail, SchemaList
export type ListSchemasQuery = { readonly limit?: number; readonly cursor?: string };
export type CreateSchemaRequest = { readonly id: string; readonly document: unknown };
export type UpdateSchemaRequest = { readonly document: unknown; readonly expectedRevision: number };
```

- `document` của chi tiết là `unknown` nhưng khóa phải có mặt: object thiếu `document` bị từ chối. Giá trị giữ nguyên tham chiếu, không bị sao chép hay đổi.
- `index.ts` export có tên mọi hằng, type, schema và hàm ở trên; không default export.
- Schema Zod được tạo khi module nạp. Trên trình duyệt, module này phải nạp sau `frontend/src/lib/zod-config.ts` (Zod `jitless`), giống `@schemaforge/core`; ghi một comment ở đầu `auth.ts`, `schemas.ts`, `errors.ts`.

**Test viết trước:**

- `limits.test.ts`: `keeps the limits agreed in the spec`.
- `errors.test.ts`: `lists the fifteen api error codes in spec order without duplicates`; `maps each error code to the status in the spec` (`it.each`); `parses a validation-failed body with field errors`; `parses a revision-conflict body with the current revision`; `parses a document-invalid body with structural errors`; `parses a simple error body`; `returns null for an unknown code`; `returns null for a revision-conflict body without currentRevision`; `drops unknown fields from an error body`.
- `auth.test.ts`: `parses a user response and drops unknown fields`; `rejects a user id that is not a uuid`; `rejects a createdAt that is not an ISO datetime`; `parses the user envelope returned by register, login and me`.
- `schemas.test.ts`: `parses a schema summary`; `rejects a summary with revision zero`; `keeps the document of a schema detail untouched`; `rejects a schema detail without a document`; `parses a list whose nextCursor is null`; `rejects a list without items`.

**Kiểm tra:** như "Quy ước chung" với `<pkg>` là `api-contract`, cộng:

- `pnpm install --frozen-lockfile` thoát mã 0.
- `grep -rn "@schemaforge/core" packages/api-contract/src` chỉ ra dòng `import type`.

**Xong khi:** coverage dòng của package ≥ 90%; mọi hằng, mã lỗi và schema response của spec mục 5 có trong package. Đóng góp cho tiêu chí "Chung": `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` chạy qua.

**Commit:** `feat: add shared api contract package`

## Task 2: Dependency, workspace và công cụ dùng chung

**Mục tiêu:** cài mọi dependency của phần 4 và sửa config gốc một lần cho cả plan (spec mục 4 "`prisma generate` trong pipeline", "`allowBuilds`", mục 9, mục 11 "CI", mục "Phiên bản" của plan này), để task sau không phải đụng lockfile hay config gốc.

**Agent:** `devops-engineer`. **Phụ thuộc:** 1; Task 0 (Vấn đề 1, 4, 6, 13). **Đợt:** 2, chạy một mình.

**File sở hữu (sửa):** `backend/package.json`, `frontend/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.prettierignore`, `eslint.config.mjs`, `.github/workflows/ci.yml`.

**Cài đặt:**

1. Dependency, đúng bảng "Phiên bản" (Prisma ghi phiên bản chính xác, không `^`):

   ```bash
   pnpm --filter @schemaforge/backend add --save-exact @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0
   pnpm --filter @schemaforge/backend add --save-dev --save-exact prisma@7.10.0
   pnpm --filter @schemaforge/backend add @nestjs/passport@^12.0.0 passport@^0.7.0 passport-jwt@^4.0.1 @nestjs/jwt@^12.0.2 cookie-parser@^1.4.7 @node-rs/argon2@^2.2.1 rate-limiter-flexible@^11.2.0 helmet@^8.3.0 class-validator@^0.15.1 class-transformer@^0.5.1 "@schemaforge/api-contract@workspace:*"
   pnpm --filter @schemaforge/backend add --save-dev @types/passport-jwt@^4.0.1 @types/cookie-parser@^1.4.10 @types/express@^5.0.6 supertest@^7.2.2 @types/supertest@^7.2.1
   pnpm --filter @schemaforge/frontend add "@schemaforge/api-contract@workspace:*"
   ```

   Người dùng chọn Vấn đề 1 (b) thì thay `rate-limiter-flexible` bằng `@nestjs/throttler` theo phiên bản ghi ở Task 0; chọn Vấn đề 13 (b) thì bỏ `@types/express`. Sau khi cài, mở hai `package.json` đối chiếu từng khai báo với bảng "Phiên bản"; lệch thì sửa tay rồi `pnpm install`.
2. `pnpm-workspace.yaml`, mục `allowBuilds`: thêm `"@prisma/engines": true` và `prisma: true`, giữ `unrs-resolver: true`.
3. `turbo.json`:
   - Task mới `generate`: `inputs: ["prisma/schema.prisma", "prisma.config.ts"]`, `outputs: ["src/generated/**"]`.
   - Thêm `"generate"` vào `dependsOn` của `build`, `typecheck`, `lint`, `test`, `dev` và `@schemaforge/frontend#build`, giữ các mục đang có.
   - `@schemaforge/frontend#build` thêm `env: ["NEXT_PUBLIC_API_URL"]`.
   - Task mới `test:e2e`: `dependsOn: ["^build", "generate"]`, `cache: false`, `passThroughEnv` đúng danh sách của Vấn đề 4 (a).
4. `.gitignore`: thêm `!.env.test.example` ngay sau `!.env.example` (`.env.test` đã nằm trong `.env.*`); thêm `backend/src/generated/` dưới một comment `# Generated Prisma client`.
5. `.prettierignore`: thêm `backend/src/generated/`.
6. `eslint.config.mjs`:
   - `globalIgnores` thêm `"backend/src/generated/"`.
   - Khối framework-free của core áp thêm cho `packages/api-contract/**/*.ts` (thêm vào `files`, giữ nguyên rule).
   - Khối tắt `no-restricted-properties` cho file đọc env thêm `backend/prisma.config.ts`, và theo Vấn đề 6 (a) `backend/vitest.e2e.config.ts`, `backend/test/global-setup.ts`.
   - Khối mới ngay sau khối cấm gọi mạng: `files: ["frontend/src/lib/api/**/*.ts"]`, `ignores: FRONTEND_TEST_FILES`, `no-restricted-globals: "off"`, `no-restricted-properties: ["error", PROCESS_ENV_RESTRICTION]` (chỉ mở gọi mạng, vẫn cấm `process.env`).
7. `.github/workflows/ci.yml`: job `verify` thêm `env: NEXT_PUBLIC_API_URL: https://api.schemaforge.invalid` ở mức job. Không thêm job `e2e` (Task 18).

**Kiểm chứng viết trước (file tạm, không commit):**

1. Tạo `frontend/src/lib/api/probe-network.ts` và `frontend/src/lib/probe-network.ts`, cùng nội dung `export function probe(): Promise<Response> { return fetch("/"); }`; tạo `packages/api-contract/src/probe-boundary.ts` với `import { readFileSync } from "node:fs"; export const probe = readFileSync;`. Chạy ESLint trên ba file trước khi sửa `eslint.config.mjs`: hai file frontend cùng báo lỗi gọi mạng, file api-contract không báo lỗi ranh giới.
2. Sửa `eslint.config.mjs`, chạy lại: `lib/api/probe-network.ts` sạch; `lib/probe-network.ts` vẫn báo lỗi; `probe-boundary.ts` báo lỗi `CORE_BOUNDARY`. Xóa ba file.
3. Trong worktree: `rm -rf node_modules backend/node_modules frontend/node_modules packages/*/node_modules`, rồi `pnpm install --frozen-lockfile`. Output không có cảnh báo build script bị chặn (kể cả của dependency lồng như `@prisma/dev`). Có cảnh báo thì dừng và báo tên gói cùng script.
4. `git check-ignore -q backend/.env.test.example` thoát mã 1; `git check-ignore -q backend/.env.test backend/src/generated/prisma/client.ts` thoát mã 0.

**Kiểm tra:**

```bash
pnpm turbo run lint typecheck test build
pnpm exec prettier --check turbo.json pnpm-workspace.yaml eslint.config.mjs .github/workflows/ci.yml backend/package.json frontend/package.json
git status --porcelain
```

Mong đợi: cả hai lệnh thoát mã 0 (chưa package nào có script `generate`, Turborepo bỏ qua); `git status` chỉ có chín file sở hữu.

**Xong khi:** đóng góp cho tiêu chí "Chung": `pnpm install --frozen-lockfile` từ bản clone sạch không còn cảnh báo build script bị chặn; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` chạy qua.

**Commit:** `build: add auth and cloud storage dependencies and tooling`

## Task 3: Cập nhật các tài liệu đã duyệt theo spec phần 4

**Mục tiêu:** làm các thay đổi 1 đến 6, 9, 10 trong mục "Vấn đề với các spec đã duyệt" của spec phần 4, để không tài liệu nào mâu thuẫn với spec đã duyệt. Thay đổi 7, 8 thuộc Task 4; `roadmap.md` thuộc Task 38.

**Agent:** `spec-writer`. **Phụ thuộc:** —. **Đợt:** 1.

**File sở hữu (sửa):** `document/specs/2026-09-14-feature-list-design.md`, `document/specs/2026-09-14-scaffold-tooling-design.md`, `document/specs/2026-09-14-editor-mvp-design.md`, `document/specs/2026-09-15-import-export-design.md`, `document/architecture.md`.

**Cài đặt:** mỗi thay đổi chỉ sửa đúng dòng hoặc đoạn liên quan, viết tiếng Việt, kèm nguồn dạng "(spec phần 4, mục N)" với link tương đối tới `2026-09-15-auth-cloud-design.md`. Không đổi quyết định nào khác và không định dạng lại văn bản xung quanh.

| Thay đổi của spec phần 4 | Tài liệu, chỗ sửa | Nội dung |
|---|---|---|
| 1 | Danh sách tính năng, ST-03 | Đã có sẵn câu "từ chối tài liệu sai cấu trúc kèm lý do; tài liệu còn issue ngữ nghĩa vẫn được lưu". Chỉ kiểm tra, không sửa; ghi vào báo cáo |
| 2 | Spec phần 1, dòng "4. Auth + lưu cloud" của bảng "Điểm nối với các phần sau" | Thay "`prisma generate` trước `build` và `typecheck` của backend" bằng task Turborepo `generate` chạy trước `build`, `typecheck`, `lint`, `test`, `test:e2e`, `dev` (spec phần 4, mục 4) |
| 3 | Spec phần 1, quyết định 18 và tiêu chí "Repo chỉ có `backend/.env.example`" | Thêm `frontend/.env.example` và `backend/.env.test.example`, vẫn không commit file `.env` thật (mục 9) |
| 4 | Spec phần 1, mục "CI" | Thêm job `e2e` có PostgreSQL service container chạy song song với `verify`; job `verify` đặt `NEXT_PUBLIC_API_URL` giả cho `next build` (mục 9, 11) |
| 5 | Spec phần 3, mục 5 và 7 (dòng 7 của "Tóm tắt quyết định", đoạn `db.version(1)`) | Ghi chú Dexie version 2 thêm `ownerId`, `cloudRevision`, `syncStatus` và bảng `session`; toolbar có trạng thái cloud; danh sách có hai phần khi đã đăng nhập (mục 7). Giữ nguyên nội dung version 1 vì đó là lịch sử đã phát hành |
| 6 | Spec phần 3, mục 11 và tiêu chí ST-01 "Không có code gọi mạng" | Lint có ngoại lệ cho `src/lib/api/**`; `connect-src` thêm origin backend. Tiêu chí ST-01 thành "khách không gọi mạng", kiểm bằng test tích hợp 7 của spec phần 4 |
| 9 | `architecture.md`, dòng "Auth" của "Quyết định đã chốt" | Cột quyết định thêm: JWT chỉ dùng cho access token; refresh token là chuỗi ngẫu nhiên, server lưu SHA-256 |
| 10 | Spec phần 7, mục 2 "Import vào đâu" | Thêm một câu: khi đã đăng nhập, chế độ tạo schema mới đi qua đường "Tạo" của spec phần 4 mục 7 (record có chủ, `pending`, được đẩy lên cloud) |

**Test viết trước:** không có code. Trước khi sửa, `grep` từng câu "Hiện tại" ở bảng trên để chắc chỗ sửa còn đúng như spec phần 4 mô tả; câu nào không còn thì ghi vào báo cáo.

**Kiểm tra:**

- Mỗi bảng đã sửa có số cột ở hàng phân cách bằng hàng tiêu đề; `|` trong ô được viết `\|`.
- Link tương đối và anchor mới trỏ tới file và heading có thật.
- `git status --porcelain` chỉ có năm file sở hữu. Prettier bỏ qua Markdown (`.prettierignore`), không cần chạy.

**Xong khi:** tiêu chí "Bảo mật và chung": danh sách tính năng (cách viết ST-03) và `architecture.md` khớp spec phần 4 (phần `roadmap.md` do Task 38 làm).

**Commit:** `docs: align approved specs with auth and cloud storage design`

## Task 4: Cập nhật `.claude/rules/nestjs.md`

**Mục tiêu:** làm thay đổi 7, 8 trong mục "Vấn đề với các spec đã duyệt" của spec phần 4, cộng lựa chọn của Vấn đề 6, 14, 25, 26 trong mục "Vấn đề phát hiện khi lập plan", để rule không mâu thuẫn với code của các task backend.

**Agent:** `backend-engineer` (quyền sở hữu file ghi ở đây ghi đè phạm vi mặc định). **Phụ thuộc:** 0 (Vấn đề 6, 14). **Đợt:** 1.

**File sở hữu (sửa):** `.claude/rules/nestjs.md`.

**Cài đặt:** rule viết tiếng Anh, giữ giọng và cấu trúc hiện có; chỉ sửa các dòng dưới đây.

| Mục của rule | Hiện ghi | Sửa thành |
|---|---|---|
| "DTOs and validation" | "Request DTOs (`CreateSchemaDto`, and `UpdateSchemaDto` built with `PartialType`) are separate from response DTOs." | Request DTO tách khỏi response DTO. `PartialType` chỉ dùng cho cập nhật từng phần (`PATCH`); `PUT` thay toàn bộ tài nguyên có DTO class riêng với mọi trường bắt buộc (spec phần 4, thay đổi 7) |
| "DTOs and validation", sau câu về "Never return Prisma models from controllers" | — | Field của DTO class do `class-transformer` điền được dùng definite assignment (`readonly email!: string`) để qua `strictPropertyInitialization`; đây là chỗ duy nhất trong codebase được dùng `!` (`typescript.md` cấm ở nơi khác), chỉ giới hạn ở field của DTO class, không dùng để che dấu lỗi kiểu ở chỗ khác (Vấn đề 25) |
| "Configuration" | "No `process.env` outside `src/config/`. Inject typed config instead." | Giữ câu này, thêm ngoại lệ: file cấu hình của công cụ chạy ngoài app Nest (`prisma.config.ts`, `vitest.e2e.config.ts`) và `test/global-setup.ts` của e2e được đọc `process.env`; ESLint liệt kê đúng các file này (thay đổi 8, Vấn đề 6) |
| "Structure", sau câu về mẫu `<name>.<kind>.ts` | — | Mẫu áp cho khối của Nest và các loại `repository`, `mapper`, `strategy`, `policy`; helper thuần không có loại dùng `<name>.ts` kebab-case (ví dụ `auth-cookies.ts`); một feature có thể có nhiều repository (Vấn đề 14) |
| "Layers", gạch đầu dòng về controller | "…then call a single service method. No business logic, no Prisma." | Thêm: controller có thể đưa kết quả của lời gọi service đó cho helper thuần, được inject, dựng response HTTP cho một mối lo về transport mà service không cần biết, ví dụ đặt hoặc xóa cookie (provider `AuthCookies` với `set`, `clear`, được inject và gọi sau đúng lời gọi service đó); helper này không có business logic, chỉ định hình response (Vấn đề 14, cụ thể hóa thêm ở Vấn đề 26: refresh thất bại thì controller gọi `authCookies.clear(response)` trước khi ném `401 session-expired`) |

**Test viết trước:** không có code. Trước khi sửa, `grep -n "PartialType\|process.env\|<name>.<kind>\|single service method" .claude/rules/nestjs.md` để chắc các chỗ đổi còn đúng như cột "Hiện ghi".

**Kiểm tra:** `git status --porcelain` chỉ có `.claude/rules/nestjs.md`; `git diff` chỉ chạm các chỗ ở bảng. Prettier bỏ qua Markdown.

**Xong khi:** hai điểm 7, 8 của mục "Vấn đề với các spec đã duyệt" trong spec phần 4, và lựa chọn của Vấn đề 6, 14, 25, 26 trong mục "Vấn đề phát hiện khi lập plan" của plan này, đã phản ánh vào rule; không rule nào trong file cấm cấu trúc thư mục của spec phần 4 hoặc mẫu `AuthCookies` của Task 12, 13.

**Commit:** `docs: clarify nestjs rules for full updates and tool config`

## Task 5: Prisma, migration đầu tiên và env backend

**Mục tiêu:** data model, migration, `PrismaModule` và schema env của phần 4 (spec mục 4, mục 9 "Backend", mục 10), cùng các bước xác nhận rủi ro về Prisma trong mục "Rủi ro cần kiểm tra khi triển khai".

**Agent:** `backend-engineer`. **Phụ thuộc:** 0 (Vấn đề 8), 2. **Đợt:** 3.

**File sở hữu:**

- Tạo: `backend/prisma/schema.prisma`; `backend/prisma/migrations/migration_lock.toml` và `backend/prisma/migrations/<timestamp>_init_auth_and_schemas/migration.sql` (do `prisma migrate dev` sinh, không sửa tay); `backend/prisma.config.ts`; `backend/src/prisma/prisma.module.ts`, `prisma.service.ts`, `prisma.service.spec.ts`; `backend/.env.test.example`.
- Sửa: `backend/package.json` (chỉ thêm script `"generate": "prisma generate"`), `backend/tsconfig.json` (thêm `prisma.config.ts` vào `include`), `backend/src/config/env.ts`, `backend/src/config/env.spec.ts`, `backend/.env.example`, `backend/README.md`.

**Chữ ký và hành vi:**

- `schema.prisma`: đúng khối Prisma ở spec mục 4 (generator `prisma-client` với `output = "../src/generated/prisma"`, `moduleFormat = "esm"`, `importFileExtension = "js"`; ba model `User`, `Schema`, `RefreshToken` với mọi `@map`, `@db`, index và `onDelete: Cascade`).
- `prisma.config.ts`: nạp `backend/.env` bằng `process.loadEnvFile` khi file tồn tại (đường dẫn dựng từ `import.meta.url`), rồi `defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" }, datasource: { url: process.env.DATABASE_URL, shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL } })`. Không dùng helper `env()` của `prisma/config`: helper này ném lỗi khi biến không có, kể cả với `prisma generate` (tài liệu Prisma 7, "Prisma Config reference", mục "Handling optional environment variables").
- `PrismaService extends PrismaClient` (import từ `../generated/prisma/client.js`), `implements OnModuleDestroy`. Constructor nhận `ConfigService<Env, true>` và gọi `super({ adapter: new PrismaPg({ connectionString }) })` với `DATABASE_URL`; không giữ `ConfigService` làm field vì chỉ dùng trong `super`. `onModuleDestroy` gọi `$disconnect`. Pool của `pg` để mặc định (spec mục 10 giao plan chốt): e2e chạy tuần tự, còn `prisma dev` tự xếp hàng kết nối.
- `PrismaModule`: `providers: [PrismaService]`, `exports: [PrismaService]`, không `@Global()`; module feature import `PrismaModule`. Task 9 đăng ký module vào `AppModule`.
- `env.ts`, theo bảng spec mục 9:
  - `DATABASE_URL`: URL có protocol `postgres:` hoặc `postgresql:`. `JWT_ACCESS_SECRET`: ít nhất 32 ký tự. `CORS_ORIGINS`: tách theo `,`, bỏ khoảng trắng đầu cuối từng phần tử, ít nhất một phần tử; mỗi phần tử có protocol `http:` hoặc `https:` và đúng bằng `new URL(x).origin`; kiểu sau parse là `readonly string[]`. `AUTH_COOKIE_SECURE`: chỉ `"true"` hoặc `"false"`, mặc định `"true"`, sau parse là `boolean`. `TRUST_PROXY_HOPS`: số nguyên ≥ 0, mặc định `0`. `NODE_ENV`, `PORT` giữ như cũ.
  - `superRefine` khi `NODE_ENV` là `production`: từ chối `AUTH_COOKIE_SECURE=false`, origin `http:`, và `JWT_ACCESS_SECRET` bằng hằng `JWT_ACCESS_SECRET_EXAMPLE` (`"replace-with-output-of-openssl-rand-base64-48"`, dùng chung với `.env.example`).
  - Thông báo lỗi nêu tên biến, không bao giờ chứa giá trị của `DATABASE_URL` hay `JWT_ACCESS_SECRET`. `SHADOW_DATABASE_URL` không nằm trong schema này.
- `.env.example`: thêm `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS`, `AUTH_COOKIE_SECURE`, `TRUST_PROXY_HOPS` đúng cột "Giá trị trong `.env.example`" của spec mục 9, và `SHADOW_DATABASE_URL=postgresql://user:password@localhost:5432/schemaforge_shadow` kèm comment "Prisma CLI only". `.env.test.example`: `NODE_ENV=test`, `DATABASE_URL=postgresql://user:password@localhost:5432/schemaforge_test`, `JWT_ACCESS_SECRET` giá trị giả như trên, `CORS_ORIGINS=http://localhost:3000`, `AUTH_COOKIE_SECURE=true` (Vấn đề 12), `TRUST_PROXY_HOPS=0`.
- `README.md` (tiếng Anh, như README hiện có) thêm các mục: database local bằng container `local_postgres` theo Vấn đề 8 (tạo role và ba database, chép `.env.example` thành `.env`, `.env.test.example` thành `.env.test`, chạy `prisma migrate dev`); máy không có Docker dùng `prisma dev --name schemaforge --detach`; quy tắc migration (`migrate dev --name <snake_case>`, `migrate deploy` cho CI và deploy, không sửa migration đã commit); cookie `Secure` trên `http://localhost` và `AUTH_COOKIE_SECURE=false` khi trình duyệt không nhận (Task 37 bổ sung kết quả Safari).

**Test viết trước:**

- `env.spec.ts` (sửa test cũ cho có biến bắt buộc): `returns the parsed values when the environment is valid`; `applies defaults to optional variables`; `throws when PORT is not a number`; `rejects a missing DATABASE_URL`; `rejects a DATABASE_URL whose protocol is not postgres`; `rejects a JWT_ACCESS_SECRET shorter than 32 characters`; `rejects CORS_ORIGINS that contain a wildcard`; `rejects CORS_ORIGINS with a path or a trailing slash` (`it.each`); `parses CORS_ORIGINS into a list of trimmed origins`; `reads AUTH_COOKIE_SECURE false as false`; `rejects AUTH_COOKIE_SECURE values other than true or false`; `rejects a negative TRUST_PROXY_HOPS`; `rejects AUTH_COOKIE_SECURE false in production`; `rejects an http origin in production`; `rejects the example JWT secret in production`; `never includes the secret value in the error message`.
- `prisma.service.spec.ts`: `creates the client with the database url from config`; `disconnects when the module is destroyed`.

**Kiểm chứng (theo thứ tự, ghi kết quả vào báo cáo, không in giá trị của `.env`):**

1. Trước khi có `backend/.env` (worktree mới chưa có file này): `pnpm --filter @schemaforge/backend generate` thoát mã 0 khi không có `DATABASE_URL` (rủi ro "`prisma generate` khi không có `DATABASE_URL`").
2. Tạo role và database theo README vừa viết. Chưa có role thì agent sinh mật khẩu bằng `openssl rand -hex 24` và ghi thẳng vào `backend/.env`, `backend/.env.test` (gitignore), không in ra.
3. `pnpm --filter @schemaforge/backend exec prisma migrate dev --name init_auth_and_schemas`: tạo migration; SQL có cột `UUID`, `JSONB`, `TIMESTAMPTZ(3)`, index `(owner_id, updated_at DESC, id DESC)`, `ON DELETE CASCADE`. Ghi tên ràng buộc unique và khóa chính của `users`, `schemas` (cần cho Vấn đề 2).
4. `DATABASE_URL=postgresql://probe@localhost:1/none pnpm --filter @schemaforge/backend exec prisma migrate status` báo lỗi kết nối tới cổng 1: biến trong môi trường thắng giá trị trong `.env`.
5. `pnpm turbo run typecheck lint test build --filter @schemaforge/backend` đọc được client sinh ra (rủi ro "Client sinh ra với toolchain của repo").
6. `prisma dev` (rủi ro "`prisma dev`"): xem `prisma dev --help`, chạy `prisma dev --name schemaforge --detach` hai lần cách nhau một lần dừng instance, so connection string in ra; ghi kết quả vào README rồi dừng instance.

**Kiểm tra:** như "Quy ước chung" với `<pkg>` là `backend`, cộng `pnpm --filter @schemaforge/backend exec prisma validate` và `prisma migrate status` (báo "Database schema is up to date"). `git status --porcelain` không có `.env`, `.env.test` hay `src/generated/`.

**Xong khi:** tiêu chí "Bảo mật và chung": backend từ chối khởi động khi thiếu `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS`, hoặc khi production có `AUTH_COOKIE_SECURE=false`, origin `http`, hay secret mẫu (unit test `env`). Là nền của ST-03, ST-04 (bảng `schemas`) và ST-02 (bảng `users`, `refresh_tokens`).

**Commit:** `feat(backend): add prisma schema, initial migration and auth env`

## Task 6: Frontend đọc `NEXT_PUBLIC_API_URL` và mở CSP cho backend

**Mục tiêu:** frontend biết origin của backend và CSP cho phép gọi tới đó (spec mục 8 "CSP của frontend", mục 9 "Frontend"), theo lựa chọn của Vấn đề 5.

**Agent:** `frontend-engineer`. **Phụ thuộc:** 0 (Vấn đề 5), 2. **Đợt:** 3.

**File sở hữu:**

- Sửa: `frontend/src/lib/env.ts`, `frontend/src/lib/env.test.ts`, `frontend/src/lib/security/content-security-policy.ts`, `frontend/src/lib/security/content-security-policy.test.ts`, `frontend/src/proxy.ts`, `frontend/src/proxy.test.ts`, `frontend/README.md`.
- Tạo: `frontend/.env.example` với đúng một dòng `NEXT_PUBLIC_API_URL=http://localhost:3001`.

**Chữ ký và hành vi:**

```ts
// env.ts
export const DEFAULT_API_URL = "http://localhost:3001";
export type Environment = {
  readonly nodeEnvironment: NodeEnvironment;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  readonly apiOrigin: string; // new URL(NEXT_PUBLIC_API_URL).origin
};
export type EnvironmentSource = {
  readonly NODE_ENV: string | undefined;
  readonly NEXT_PUBLIC_API_URL: string | undefined;
};
export function readEnvironment(source: EnvironmentSource): Environment;
// content-security-policy.ts
export type ContentSecurityPolicyInput = { readonly nonce: string; readonly isDevelopment: boolean; readonly apiOrigin: string };
```

- `env.ts` giữ ràng buộc hiện có: không tạo schema Zod (comment đầu file), và `env` đọc `process.env.NEXT_PUBLIC_API_URL` viết đầy đủ, không destructure, để Next.js thay giá trị lúc build.
- Quy tắc `NEXT_PUBLIC_API_URL` theo Vấn đề 5 (a): không có hoặc chuỗi rỗng thì dùng `DEFAULT_API_URL`; phải parse được bằng `URL`; protocol `http:` hoặc `https:`; không có username, password; `pathname` là `/`, `search` và `hash` rỗng; khi `NODE_ENV` là `production`, `http:` chỉ được nhận nếu `hostname` là `localhost`, `127.0.0.1` hoặc `[::1]`. Sai thì `readEnvironment` ném `Error` nêu tên biến, như lỗi `NODE_ENV` hiện có.
- `buildContentSecurityPolicy`: `connect-src 'self' <apiOrigin>`; các chỉ thị khác không đổi. `proxy.ts` truyền `apiOrigin: env.apiOrigin`.
- `README.md`: một đoạn về `NEXT_PUBLIC_API_URL`, chép `.env.example` thành `.env.local` khi backend chạy ở địa chỉ khác mặc định.

**Test viết trước:**

- `env.test.ts`: `defaults the api origin to localhost when the variable is missing` (`it.each` cho `development`, `test`, `production`); `reads the origin of an https api url`; `accepts an http api url in development`; `accepts an http loopback api url in production` (`it.each` cho `localhost`, `127.0.0.1`, `[::1]`); `rejects an http api url on another host in production`; `rejects an api url with a path`; `rejects an api url with a query or a hash`; `rejects an api url with credentials`; `rejects a protocol other than http or https`; `rejects a value that is not a url`.
- `content-security-policy.test.ts`: `allows connections to the api origin`; `keeps self in connect-src`.
- `proxy.test.ts`: `sets connect-src to the configured api origin`.

**Kiểm chứng:**

1. `pnpm --filter @schemaforge/frontend build` không đặt biến: thành công.
2. `NEXT_PUBLIC_API_URL=https://api.schemaforge.invalid pnpm --filter @schemaforge/frontend build`: thành công, và `grep -rl "api.schemaforge.invalid" frontend/.next/static` có kết quả (giá trị được nhúng vào bundle).
3. `NEXT_PUBLIC_API_URL=http://api.example.com pnpm --filter @schemaforge/frontend build`: thất bại với thông báo nêu `NEXT_PUBLIC_API_URL`.

**Kiểm tra:** như "Quy ước chung" với `<pkg>` là `frontend`; lệnh Prettier chỉ nhận các file `.ts` sở hữu (Prettier không định dạng `.env.example` và `README.md`).

**Xong khi:** hai dòng `content-security-policy`, `env` trong bảng unit test frontend của spec mục 11 có test; đóng góp cho tiêu chí kiểm tra tay "CSP không chặn request tới backend" (Task 37).

**Commit:** `feat(frontend): read api url from env and allow it in csp`

## Task 7: Dexie version 2 và phần thêm của `SchemaRepository`

**Mục tiêu:** cache có chủ, trạng thái đồng bộ và bảng `session` (spec mục 7 "Dexie version 2", "Ghi cache", bảng Web Locks), cùng mọi method lưu trữ mà các task đồng bộ (22 đến 34) cần, để các task đó không sửa `lib/storage/`.

**Agent:** `frontend-engineer`. **Phụ thuộc:** —. **Đợt:** 1.

**File sở hữu:**

- Sửa: `frontend/src/lib/storage/database.ts`, `database.test.ts`, `records.ts`, `records.test.ts`, `schema-repository.ts`, `schema-repository.test.ts`; `frontend/src/features/schema-list/hooks/use-schema-list.test.tsx` (chỉ thêm `ownerId: null`, `cloudRevision: null`, `syncStatus: null` vào fixture record có sẵn).
- Tạo: `frontend/src/lib/storage/cloud-cache.ts`, `cloud-cache.test.ts` (method liên quan cloud, giữ `schema-repository.ts` dưới 300 dòng); `frontend/src/lib/storage/session-table.ts`, `session-table.test.ts`.

Typecheck báo lỗi ở file khác ngoài danh sách (fixture dựng `SchemaRecord` bằng tay) thì dừng và báo orchestrator, không tự sửa.

**Chữ ký và hành vi:**

`records.ts`:

```ts
export const SYNC_STATUSES = ["synced", "pending", "conflict", "deleted-in-cloud"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];
export type LocalSchemaRecord = { readonly id: string; readonly name: string; readonly createdAt: number;
  readonly updatedAt: number; readonly ownerId: null; readonly cloudRevision: null; readonly syncStatus: null };
export type CloudSchemaRecord = { /* bốn trường chung */ readonly ownerId: string;
  readonly cloudRevision: number | null; readonly syncStatus: SyncStatus };
export type SchemaRecord = LocalSchemaRecord | CloudSchemaRecord;
export type SessionRecord = { readonly key: "current"; readonly userId: string; readonly email: string };
export function isCloudSchemaRecord(record: SchemaRecord): record is CloudSchemaRecord;
export function parseSessionRecord(value: unknown): SessionRecord | null;
```

- `schemaRecordSchema` là union Zod của hai nhánh; `cloudRevision` là số nguyên dương hoặc `null`; `ownerId` và `userId` là `z.uuid()`. Record sai hình dạng (ví dụ `ownerId` có mà `syncStatus` là `null`) vẫn ra "unreadable" như phần 3.

`database.ts`: thêm `declare readonly session: EntityTable<SessionRecord, "key">`; giữ nguyên `version(1)`; thêm `version(2)` đúng khối của spec mục 7 (`schemas: "id, updatedAt, ownerId"`, bảng `session: "key"`, `upgrade` đặt ba trường mới là `null` cho mọi record cũ).

`SchemaRepository` thêm hoặc đổi:

```ts
readonly createSchema: (name: string, options?: { readonly ownerId: string }) => Promise<SchemaRecord>;
readonly readSchemaRecord: (schemaId: string) => Promise<SchemaRecord | null>;
readonly listOwnedSchemas: (ownerId: string) => Promise<readonly CloudSchemaRecord[]>;
readonly writeCloudCopy: (input: CloudCopy) => Promise<void>;
readonly completePush: (schemaId: string, input: { readonly revision: number; readonly sentUpdatedAt: number }) =>
  Promise<"synced" | "pending" | "not-found">;
readonly setSyncState: (schemaId: string, state: { readonly cloudRevision: number | null; readonly syncStatus: SyncStatus }) =>
  Promise<"updated" | "not-found">;
readonly assignOwner: (schemaId: string, state: { readonly ownerId: string; readonly cloudRevision: number;
  readonly syncStatus: "synced" | "conflict" }) => Promise<"assigned" | "not-found" | "already-owned">;
readonly changeSchemaId: (schemaId: string, newSchemaId: string) => Promise<"moved" | "not-found" | "id-taken">;
readonly readSession: () => Promise<SessionRecord | null>;
readonly writeSession: (input: { readonly userId: string; readonly email: string }) => Promise<void>;
readonly deleteSession: () => Promise<void>;
export type CloudCopy = { readonly id: string; readonly ownerId: string; readonly document: SchemaDocument;
  readonly revision: number; readonly createdAt: number; readonly updatedAt: number };
```

- `createSchema` không có `options`: như phần 3, record của khách (ba trường `null`). Có `ownerId`: record `cloudRevision: null`, `syncStatus: "pending"`, cùng một transaction với tài liệu (spec mục 7 "Tạo").
- `saveDocument`, `renameSchema`: trong cùng transaction với lần ghi tài liệu, record có chủ đang `synced` hoặc `pending` thành `pending`; `conflict`, `deleted-in-cloud` giữ nguyên; record của khách giữ `null`.
- `listOwnedSchemas`: truy vấn theo index `ownerId`, chỉ trả record parse được, sắp `updatedAt` giảm dần. Schema của khách vẫn lọc trong bộ nhớ từ `listSchemas`.
- `writeCloudCopy`: một transaction ghi record (`name` lấy từ `document.name`, `cloudRevision` là `revision`, `syncStatus: "synced"`) và tài liệu; viewport không đổi. Người gọi đã `parseSchemaDocument` và đổi thời gian ISO sang epoch mili giây.
- `completePush`: một transaction; đặt `cloudRevision` bằng `revision`; `syncStatus` là `synced` nếu `updatedAt` hiện tại bằng `sentUpdatedAt`, ngược lại `pending`.
- `assignOwner`: chỉ đổi record đang là của khách (`ownerId: null`); record đã có chủ trả `already-owned` và không ghi.
- `changeSchemaId`: `newSchemaId` phải qua `isSchemaId`; một transaction chuyển hàng ở `schemas` (đổi `id`), `documents`, `viewports` (đổi `schemaId`) rồi xóa hàng cũ; id mới đã có ở `schemas` thì trả `id-taken` và không ghi.
- `readSession`, `writeSession`, `deleteSession` đọc ghi bảng `session` với khóa `"current"` (cài đặt trong `session-table.ts`); `readSession` trả `null` khi hàng sai hình dạng.
- Không method nào xin Web Lock: khóa do người gọi giữ (spec mục 7, "Web Locks").

**Test viết trước:**

- `database.test.ts`: `upgrades a version 1 database to version 2 without losing schemas, documents or viewports`; `sets ownerId, cloudRevision and syncStatus to null on upgraded records`; `indexes schemas by ownerId`; `creates the session table keyed by key`.
- `records.test.ts`: `parses a local record with null sync fields`; `parses a cloud record with a pending status and no cloud revision`; `rejects a record with an owner but a null sync status`; `rejects a cloud revision of zero`; `parses a session record`; `rejects a session record with another key`.
- `schema-repository.test.ts`: `creates an owned schema as pending without a cloud revision`; `marks an owned synced schema as pending when its document is saved`; `keeps a conflict status when the document is saved`; `keeps the sync fields of a local schema null when its document is saved`; `marks an owned schema as pending when it is renamed`.
- `cloud-cache.test.ts`: `lists only the schemas of the given owner, newest first`; `writes a cloud copy as synced with its revision and document`; `completes a push as synced when the record did not change while sending`; `keeps a push pending when the record changed while sending`; `returns not-found when completing a push for a deleted schema`; `assigns an owner to a local schema`; `refuses to assign an owner to a schema that already has one`; `moves a schema, its document and its viewport to a new id`; `refuses to move a schema onto an id that is taken`; `sets the sync state of an owned schema`.
- `session-table.test.ts`: `writes and reads the current session`; `returns null when no session is stored`; `deletes the current session`; `returns null for a session row with an invalid shape`.

**Kiểm tra:** như "Quy ước chung" với `<pkg>` là `frontend`. Test sẵn có của phần 3 trong `lib/storage/` và `features/` vẫn xanh.

**Xong khi:** tiêu chí ST-03 "Dexie nâng từ version 1 lên version 2 không mất dữ liệu (unit test)"; các dòng `database` version 2 và `schema-repository` (phần thêm) trong bảng unit test frontend của spec mục 11 có test.

**Commit:** `feat(frontend): add dexie version 2 with cloud sync fields`

## Task 8

Số 8 không được dùng: bảng task đi từ Task 7 sang Task 9, không có Task 8. Số task là định danh, nên không đánh số lại các task sau.


## Task 9: Nền backend

**Mục tiêu:** dựng các lớp dùng chung mà mọi route của phần 4 đi qua: hình dạng lỗi và filter toàn cục, `ValidationPipe`, `OriginGuard`, decorator `@Public()` và `@CurrentUser()`, `Clock`, `configureApp` (Helmet, CORS, `cookie-parser`, parser JSON 2 MiB), `main.ts`, `app.module.ts` và `GET /health` (spec mục 1 "CSRF", mục 5 "Endpoint", "Hình dạng lỗi", "Body và kích thước tài liệu", mục 8 "Thiết lập ứng dụng", "Helmet", "CORS", mục 11 "Backend: unit", "Coverage").

**Agent:** backend-engineer. **Phụ thuộc:** Task 5. **Đợt:** 4.

**File sở hữu:**

- Tạo trong `backend/src/common/`: `api.exception.ts`, `api-exception.filter.ts`, `api-exception.filter.spec.ts`, `prisma-errors.ts`, `prisma-errors.spec.ts`, `validation.pipe.ts`, `validation.pipe.spec.ts`, `origin.guard.ts`, `origin.guard.spec.ts`, `public.decorator.ts`, `current-user.decorator.ts`, `clock.ts`, `clock.module.ts`.
- Tạo `backend/src/app-setup.ts`, `backend/src/app-setup.spec.ts`.
- Tạo `backend/src/modules/health/health.module.ts`, `health.controller.ts`, `health.controller.spec.ts`.
- Sửa `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/vitest.config.ts`.

Spec mục "Cấu trúc thư mục" không ghi `prisma-errors.ts`, `validation.pipe.ts`, `clock.module.ts`; plan tách ra để filter dưới 300 dòng và để `Clock` có một provider dùng chung.

**Chữ ký và hành vi:**

`clock.ts`, `clock.module.ts`:

```ts
export abstract class Clock { abstract now(): Date }       // abstract class làm token DI
@Injectable() export class SystemClock extends Clock { now(): Date }
@Global() @Module({ providers: [{ provide: Clock, useClass: SystemClock }], exports: [Clock] })
export class ClockModule {}
```

`public.decorator.ts`, `current-user.decorator.ts`:

- `export const IS_PUBLIC_KEY = "isPublic"`; `export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true)`. Task 12, 17 dùng lại `IS_PUBLIC_KEY`.
- `export type AuthenticatedUser = { readonly userId: string }`. `CurrentUser` dựng bằng `createParamDecorator`, đọc `request.user` và thu hẹp bằng type guard `isAuthenticatedUser(value: unknown): value is AuthenticatedUser` (export); không phải `AuthenticatedUser` thì ném `ApiException` `401 unauthenticated` (chỉ xảy ra khi route private bị gọi mà guard không chạy).

`api.exception.ts`:

```ts
export class ApiException extends HttpException {
  constructor(readonly body: ApiErrorBody) { super(body, body.statusCode); }
}
```

`ApiErrorBody`, `FieldError`, `ApiErrorCode` import từ `@schemaforge/api-contract` (tên theo "Chữ ký và hành vi" của Task 1). Mọi lỗi dự kiến của phần 4 ném `new ApiException({ statusCode, code, … })`.

`prisma-errors.ts` (nơi duy nhất dịch lỗi Prisma, `nestjs.md`):

- `export function toPrismaErrorBody(error: Prisma.PrismaClientKnownRequestError): ApiErrorBody | null`. `Prisma` import từ client do Task 5 sinh (đường dẫn theo Task 5).
- `P2025` → `{ statusCode: 404, code: "not-found" }`.
- `P2002` → tra `UNIQUE_CONSTRAINT_ERRORS`, một bảng duy nhất, mỗi dòng ghi model, trường, tên ràng buộc PostgreSQL mà migration `init_auth_and_schemas` sinh, và mã lỗi: `User.email` (`users_email_key`) → `409 email-already-registered`; `Schema.id` (`schemas_pkey`) → `409 schema-id-unavailable`.
- Với `@prisma/adapter-pg` 7.10.0 (đọc từ mã nguồn, mục Phiên bản của plan), `meta` không có `target`; tên ràng buộc nằm ở `meta.driverAdapterError.cause.constraint.index` (hoặc danh sách trường ở `constraint.fields`). Hàm đọc các giá trị này từ `unknown` bằng type guard, không `as`, và tìm theo tên ràng buộc, rồi theo trường cùng tên bảng. Xem Vấn đề 2 (metadata `P2002`, đã chốt phương án (a)). Không khớp dòng nào, hoặc mã khác → `null` (filter trả `500`).

`api-exception.filter.ts`:

- `export function resolveApiError(exception: unknown): { readonly body: ApiErrorBody; readonly isUnexpected: boolean }` (hàm thuần, test trực tiếp), và `@Catch() export class ApiExceptionFilter implements ExceptionFilter` gọi hàm này, ghi `response.status(body.statusCode).json(body)`.
- Thứ tự ánh xạ:
  1. `ApiException` → `exception.body`.
  2. Lỗi của body parser (object có `type` là chuỗi, thu hẹp bằng type guard): `entity.too.large` → `413 payload-too-large`; `entity.parse.failed` → `400 validation-failed` với `fields: []`.
  3. `Prisma.PrismaClientKnownRequestError` → `toPrismaErrorBody`; `null` → `500 internal-error`, `isUnexpected: true`.
  4. `HttpException` khác theo status: 400 → `validation-failed` với `fields: []` (ví dụ `ParseUUIDPipe`); 401 → `unauthenticated`; 404 → `not-found`; 413 → `payload-too-large`; 429 → `too-many-requests`; status khác → `500 internal-error`, `isUnexpected: true`.
  5. Còn lại → `500 internal-error`, `isUnexpected: true`.
- Khi `isUnexpected`: `Logger` (`ApiExceptionFilter.name`) ghi `error` gồm tên lỗi (`error.name` hoặc `typeof`), `request.method`, đường route, `userId` khi `request.user` qua `isAuthenticatedUser`; kèm stack trong log. Không ghi body, cookie, header, `message` của lỗi Prisma. Response không bao giờ có trường nào ngoài `ApiErrorBody`.

`validation.pipe.ts`:

- `export function createValidationPipe(): ValidationPipe` với `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `exceptionFactory: (errors) => new ApiException({ statusCode: 400, code: "validation-failed", fields: toFieldErrors(errors) })`.
- `export function toFieldErrors(errors: readonly ValidationError[]): readonly FieldError[]`: mỗi khóa trong `constraints` là một `FieldError { path, constraint }`; `children` được duyệt đệ quy với `path` nối bằng `.`; thứ tự theo thứ tự lỗi và khóa.

`origin.guard.ts`:

- `@Injectable() export class OriginGuard implements CanActivate`, inject `ConfigService<Env, true>`, đọc `CORS_ORIGINS` (mảng đã validate của Task 5).
- `GET`, `HEAD`, `OPTIONS` → `true`. Method khác: `request.headers.origin` phải là chuỗi trùng đúng một phần tử (so sánh `===`); thiếu, `null`, khác → ném `ApiException` `403 origin-not-allowed`. Không đọc `IS_PUBLIC_KEY`: áp cả cho route public (spec mục 1).

`app-setup.ts`:

```ts
export type AppSetupConfig = Pick<Env, "CORS_ORIGINS" | "TRUST_PROXY_HOPS">;
export function configureApp(app: NestExpressApplication, config: AppSetupConfig): void;
```

- Thứ tự đúng spec mục 8: `app.set("trust proxy", config.TRUST_PROXY_HOPS)`; `app.use(helmet({ … }))` đúng khối Helmet ở spec mục 8; `app.enableCors({ origin: [...config.CORS_ORIGINS], credentials: true, methods: ["GET", "POST", "PUT", "DELETE"], allowedHeaders: ["Content-Type"], exposedHeaders: ["Retry-After"], maxAge: 600 })`; `app.use(cookieParser())`; `app.useBodyParser("json", { limit: MAX_REQUEST_BODY_BYTES })`; `app.enableShutdownHooks()`.
- App phải được tạo với `bodyParser: false` (người gọi bảo đảm). `Request`, `Response` lấy type từ `express` qua `@types/express` (xem Vấn đề 13).

`main.ts`: `NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })`, lấy `ConfigService<Env, true>`, gọi `configureApp`, `listen(PORT)`, giữ dòng log khởi động hiện có.

`app.module.ts` (viết lại): `imports: [ConfigModule.forRoot({ isGlobal: true, validate }), ClockModule, PrismaModule, HealthModule]`; `providers: [{ provide: APP_PIPE, useFactory: createValidationPipe }, { provide: APP_FILTER, useClass: ApiExceptionFilter }, { provide: APP_GUARD, useClass: OriginGuard }]`. `OriginGuard` là `APP_GUARD` đầu tiên trong mảng; Task 13 thêm hai guard ngay sau nó.

`health`: `HealthController` `@Controller("health")`, `@Public() @Get() getHealth(): { readonly status: "ok" }` trả `{ status: "ok" }`; `HealthModule` chỉ khai báo controller.

`vitest.config.ts`: thêm `src/**/*.strategy.ts`, `src/**/*.mapper.ts`, `src/**/*.policy.ts` vào `coverage.include`; thêm `coverage.exclude: ["src/generated/**"]`; `test.include` giữ `src/**/*.spec.ts` (e2e ở `test/` không bị chạy).

**Test viết trước:**

- `api-exception.filter.spec.ts` (`resolveApiError` và filter với response giả):
  - `returns the body of an ApiException unchanged`; `maps built-in http exceptions by status` (`it.each`: `BadRequestException` → `validation-failed` với `fields` rỗng, `UnauthorizedException` → `unauthenticated`, `NotFoundException` → `not-found`, `PayloadTooLargeException` → `payload-too-large`, `HttpException` 429 → `too-many-requests`, `HttpException` 418 → `internal-error`).
  - `maps an entity.too.large body parser error to payload-too-large`; `maps an entity.parse.failed body parser error to validation-failed with no fields`.
  - `maps an unexpected error to internal-error without message or stack`; `logs the error name, method, route and user id of an unexpected error`; `does not log the request body or cookies`.
- `prisma-errors.spec.ts` (dựng `Prisma.PrismaClientKnownRequestError` với `meta` như adapter-pg): `maps a unique violation on users_email_key to email-already-registered`; `maps a unique violation on schemas_pkey to schema-id-unavailable`; `maps a unique violation reported by fields to the matching code`; `returns null for a unique violation on an unknown constraint`; `maps P2025 to not-found`; `returns null for another error code`.
- `validation.pipe.spec.ts`: `rejects an unknown property with validation-failed`; `lists one field error per failed constraint`; `joins nested property paths with dots`; `transforms a numeric query string into a number`.
- `origin.guard.spec.ts`: `allows safe methods without an Origin header` (`it.each` `GET`, `HEAD`, `OPTIONS`); `rejects a state-changing request without an Origin header` (`it.each` `POST`, `PUT`, `PATCH`, `DELETE`); `rejects Origin null`; `rejects an origin that is not configured`; `rejects an origin with a trailing slash`; `allows a configured origin`; `applies to handlers marked public`.
- `health.controller.spec.ts`: `returns status ok`; `marks the health route as public`.
- `app-setup.spec.ts` (probe không cần database: module test gồm một controller probe khai báo trong file spec, `ConfigModule.forRoot({ ignoreEnvFile: true, load: [...] })` với giá trị cố định, `APP_PIPE`, `APP_FILTER`, `APP_GUARD` `OriginGuard`; app tạo bằng `createNestApplication<NestExpressApplication>({ bodyParser: false })` rồi `configureApp`; gọi bằng `supertest`):
  - `sends the Helmet headers of spec section 8` (CSP `default-src 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`; `Cross-Origin-Resource-Policy: same-site`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`; `Strict-Transport-Security` có mặt); `does not send X-Powered-By`.
  - `answers a preflight from a configured origin with credentials allowed`; `omits Access-Control-Allow-Origin for an unknown origin`.
  - `rejects a body larger than MAX_REQUEST_BODY_BYTES with payload-too-large`; `rejects malformed JSON with validation-failed`; `does not parse an urlencoded body`.
  - `ignores X-Forwarded-For when TRUST_PROXY_HOPS is 0`.

**Kiểm tra:** như Quy ước chung cho `backend`. Báo cáo ghi rõ kết quả probe: lỗi `entity.too.large` và `entity.parse.failed` có tới `ApiExceptionFilter` không, và `useBodyParser` có chạy với `bodyParser: false` không (rủi ro "Lỗi của body parser trong NestJS 12 và Express 5" của spec). Nếu không tới filter: dừng và báo để orchestrator thêm vào mục Vấn đề phát hiện khi lập plan; không tự thêm middleware xử lý lỗi.

**Xong khi:**

- Mọi test trên pass, coverage dòng backend ≥ 80% với glob mới (tiêu chí "Bảo mật và chung": `pnpm lint`, `pnpm typecheck`, `pnpm test` đạt ngưỡng, `pnpm build`).
- Probe cho thấy header Helmet đúng và response lỗi chỉ có `statusCode`, `code` (và trường thêm của biến thể), không có `message` hay stack (tiêu chí "Response có header của Helmet; lỗi không lộ stack, SQL hay lỗi Prisma", phần unit; e2e 13 ở Task 17).
- `OriginGuard` trả `403 origin-not-allowed` và CORS chỉ trả `Access-Control-Allow-Origin` cho `CORS_ORIGINS` (tiêu chí "Request thay đổi dữ liệu không có `Origin` hợp lệ trả `403`; CORS chỉ cho `CORS_ORIGINS`", phần unit; e2e 10 ở Task 17).
- Body quá 2 MiB trả `413 payload-too-large` trong probe (tiêu chí "Body quá 2 MiB bị từ chối trước khi parse", phần hạ tầng; e2e 9 ở Task 16).

**Commit:** `feat(backend): add error filter, origin guard and app setup`

## Task 10: Rate limit

**Mục tiêu:** `RateLimitGuard`, decorator `@RateLimit(policy)`, bảng chính sách và `RateLimitModule` với bộ đếm trong bộ nhớ; hàm `normalizeEmail` dùng chung cho khóa rate limit và DTO (spec mục 2 "Quy tắc email và mật khẩu", mục 3 toàn bộ, mục 11 "Backend: unit" dòng `RateLimitGuard`).

**Agent:** backend-engineer. **Phụ thuộc:** Task 9. **Đợt:** 5.

**File sở hữu (tạo):**

- `backend/src/common/normalize-email.ts`, `normalize-email.spec.ts`.
- `backend/src/modules/rate-limit/rate-limit.policy.ts`, `rate-limit.policy.spec.ts`, `rate-limit.decorator.ts`, `rate-limit.store.ts`, `rate-limit.store.spec.ts`, `rate-limit.guard.ts`, `rate-limit.guard.spec.ts`, `rate-limit.module.ts`.

Spec mục "Cấu trúc thư mục" không ghi `rate-limit.store.ts`; plan tách phần bọc `rate-limiter-flexible` ra sau một abstract class để guard test được với bản giả. Task này không sửa `app.module.ts`: Task 13 đăng ký module và guard.

Theo quyết định hiện tại của spec, dùng `rate-limiter-flexible` 11.2.0, không `@nestjs/throttler` (Vấn đề 1, người dùng đã chốt phương án (a)).

**Chữ ký và hành vi:**

`normalize-email.ts`: `export function normalizeEmail(email: string): string` trả `email.trim().toLowerCase()`.

`rate-limit.policy.ts`:

```ts
export type RateLimitKeyKind = "ip" | "ip-and-email";
export type RateLimitRule = {
  readonly name: string;            // cũng là keyPrefix của limiter
  readonly keyKind: RateLimitKeyKind;
  readonly points: number;
  readonly durationSeconds: number;
};
export const RATE_LIMIT_POLICIES = {
  login: [
    { name: "login-ip-email", keyKind: "ip-and-email", points: 10, durationSeconds: 900 },
    { name: "login-ip", keyKind: "ip", points: 30, durationSeconds: 900 },
  ],
  register: [{ name: "register-ip", keyKind: "ip", points: 5, durationSeconds: 3600 }],
  refresh: [{ name: "refresh-ip", keyKind: "ip", points: 60, durationSeconds: 900 }],
} as const satisfies Record<string, readonly RateLimitRule[]>;
export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
export function buildRateLimitKey(rule: RateLimitRule, input: { readonly ip: string; readonly body: unknown }): string;
```

- Con số đúng bảng "Chính sách" ở spec mục 3; là hằng, không đọc env.
- `buildRateLimitKey`: `ip` → `sha256Hex(ip)`; `ip-and-email` → `sha256Hex(`${ip}\n${email}`)`, với `email` là `normalizeEmail(body.email)` khi `body` là object có `email` kiểu chuỗi (thu hẹp bằng type guard), ngược lại chuỗi rỗng. Guard chạy trước `ValidationPipe` nên phải tự chuẩn hóa. `sha256Hex` dùng `createHash("sha256")` của `node:crypto`, khai báo trong file, không export. Khóa rõ không bao giờ rời hàm này.

`rate-limit.decorator.ts`: `export const RATE_LIMIT_POLICY_KEY = "rateLimitPolicy"`; `export const RateLimit = (policy: RateLimitPolicyName): CustomDecorator => SetMetadata(RATE_LIMIT_POLICY_KEY, policy)`.

`rate-limit.store.ts`:

```ts
export type RateLimitDecision =
  | { readonly isAllowed: true }
  | { readonly isAllowed: false; readonly retryAfterSeconds: number };
export abstract class RateLimiterStore {
  abstract consume(rule: RateLimitRule, key: string): Promise<RateLimitDecision>;
}
@Injectable() export class MemoryRateLimiterStore extends RateLimiterStore { … }
```

- Constructor tạo một `RateLimiterMemory({ keyPrefix: rule.name, points: rule.points, duration: rule.durationSeconds })` cho mỗi rule trong `RATE_LIMIT_POLICIES`, giữ trong `Map` theo `rule.name` (state nằm trong instance, không ở cấp module).
- `consume`: `limiter.consume(key)` resolve → `{ isAllowed: true }`; reject với `RateLimiterRes` (kiểm tra `instanceof`) → `{ isAllowed: false, retryAfterSeconds: Math.max(1, Math.ceil(msBeforeNext / 1000)) }`; reject khác → ném lại (filter trả `500`). Rule không có trong `Map` → ném `Error` (lỗi lập trình).
- Import có tên `RateLimiterMemory`, `RateLimiterRes` từ `rate-limiter-flexible` (package CJS) chạy được ở ESM: đã thử với Node 24 khi lập plan; nếu `nest build` hay Vitest báo lỗi thì dừng và báo.

`rate-limit.guard.ts`: `@Injectable() export class RateLimitGuard implements CanActivate`, inject `Reflector`, `RateLimiterStore`.

- `reflector.getAllAndOverride<RateLimitPolicyName | undefined>(RATE_LIMIT_POLICY_KEY, [handler, class])`; không có → `true`.
- Với mỗi rule của chính sách, tính khóa bằng `buildRateLimitKey` với `ip: request.ip ?? ""`, `body: request.body`; gọi `consume` cho mọi rule bằng `Promise.all` (mọi request đều bị tính ở mọi limiter, spec mục 3).
- Có rule bị từ chối: `response.setHeader("Retry-After", String(max retryAfterSeconds))` rồi ném `new ApiException({ statusCode: 429, code: "too-many-requests" })`. Không rule nào từ chối → `true`.

`rate-limit.module.ts`: `@Module({ providers: [{ provide: RateLimiterStore, useClass: MemoryRateLimiterStore }, RateLimitGuard], exports: [RateLimiterStore, RateLimitGuard] })`. Muốn đổi sang store PostgreSQL hay Redis sau này chỉ đổi dòng `useClass` (spec mục 3 "Nơi lưu bộ đếm").

**Test viết trước:**

- `normalize-email.spec.ts`: `trims surrounding whitespace`; `lowercases every character`; `keeps inner characters unchanged`.
- `rate-limit.policy.spec.ts`: `defines the limits of spec section 3` (`it.each` theo bốn dòng bảng: tên chính sách, loại khóa, số lần, thời lượng); `hashes the ip key with sha256`; `builds the same key for emails differing in case and surrounding spaces`; `builds different keys for different emails from the same ip`; `builds a key without an email when the body has no email string`; `never includes the plain email or ip in the key`.
- `rate-limit.store.spec.ts` (limiter thật trong bộ nhớ): `allows requests up to the rule points`; `denies the request after the points are used with a positive retry-after`; `keeps separate counters for separate keys`; `keeps separate counters for separate store instances`; `throws for a rule that is not registered`.
- `rate-limit.guard.spec.ts` (store giả, `ExecutionContext` giả hoặc app Nest nhỏ với `supertest`): `allows a handler without a rate limit policy`; `allows a request under the limit`; `rejects a request over the limit with too-many-requests and a Retry-After header`; `uses the largest retry-after when several rules deny`; `consumes every rule of the policy even when one denies`; `passes hashed keys to the store`.

**Kiểm tra:** như Quy ước chung cho `backend`.

**Xong khi:**

- Mọi test trên pass; `@RateLimit("login")`, `"register"`, `"refresh"` sẵn sàng cho Task 13 (tiêu chí ST-02 "Lần đăng nhập thứ 11 trong 15 phút cho cùng email, và lần đăng ký thứ 6 trong một giờ từ cùng IP, trả `429` kèm `Retry-After`", phần unit; e2e 11 ở Task 15).
- Khóa trong store luôn là SHA-256 (spec mục 3); không log email hay IP.
- Kiểm tra của Quy ước chung xanh (tiêu chí "Bảo mật và chung" về lint, typecheck, test, build).

**Commit:** `feat(backend): add in-memory rate limit guard and policies`

## Task 11: Chính sách mật khẩu và `PasswordHasher`

**Mục tiêu:** chuẩn hóa và kiểm tra mật khẩu (NFKC, 8 đến 128 code point, danh sách mật khẩu phổ biến) và băm argon2id sau interface `PasswordHasher` (spec mục 2 "Thuật toán băm", "Quy tắc email và mật khẩu", mục 11 "Backend: unit" dòng `password.policy`).

**Agent:** backend-engineer. **Phụ thuộc:** Task 1, Task 2. **Đợt:** 3.

**File sở hữu:**

- Tạo `backend/src/modules/auth/password.policy.ts`, `password.policy.spec.ts`, `password-hasher.ts`, `password-hasher.spec.ts`, `common-passwords.txt`.
- Sửa `backend/nest-cli.json`: thêm `compilerOptions.assets` để `nest build` chép `modules/auth/common-passwords.txt` vào `dist/modules/auth/`. Không task nào khác của plan sửa file này.

Task này không tạo provider trong module nào: Task 13 đăng ký `PasswordHasher` và tập mật khẩu phổ biến trong `AuthModule`.

**Chữ ký và hành vi:**

`password-hasher.ts`:

```ts
export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract verify(passwordHash: string, password: string): Promise<boolean>;
}
export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
@Injectable() export class Argon2PasswordHasher extends PasswordHasher { … }
```

- `hash` gọi `hash(password, ARGON2_OPTIONS)` của `@node-rs/argon2`; `verify` gọi `verify(passwordHash, password)`. Cả hai async (thư viện chạy ngoài event loop). Lỗi của thư viện (ví dụ hash hỏng) ném lại, không nuốt.
- Không truyền `algorithm`: `Algorithm` của `@node-rs/argon2` là `const enum` khai báo ambient, không dùng được khi `isolatedModules: true` (`tsconfig.base.json`); mặc định của thư viện là argon2id (README 2.2.1). Test khóa điều này bằng tiền tố chuỗi PHC.
- Người gọi truyền mật khẩu **đã chuẩn hóa NFKC** (Task 13); hasher không chuẩn hóa lại.

`password.policy.ts`:

```ts
export type PasswordViolation = "too-short" | "too-long" | "too-common";
export function normalizePassword(password: string): string;          // password.normalize("NFKC")
export function countCodePoints(text: string): number;                // [...text].length
export function checkPassword(
  password: string,
  commonPasswords: ReadonlySet<string>,
): Result<string, PasswordViolation>;                                 // value là mật khẩu đã NFKC
export function parseCommonPasswords(text: string): ReadonlySet<string>;
export function loadCommonPasswords(): ReadonlySet<string>;
```

- `Result` là type của `@schemaforge/core` (`import type`); object literal `{ isOk: true, value }`, `{ isOk: false, error }`.
- `checkPassword`: chuẩn hóa NFKC, không bỏ khoảng trắng; `countCodePoints` < `PASSWORD_MIN_LENGTH` → `too-short`; > `PASSWORD_MAX_LENGTH` → `too-long`; `commonPasswords.has(normalized.toLowerCase())` → `too-common`; còn lại trả `normalized`. Hằng độ dài import từ `@schemaforge/api-contract`. Thứ tự kiểm tra: ngắn, dài, phổ biến.
- `parseCommonPasswords`: tách theo `\r\n` hoặc `\n`, `trim` từng dòng, bỏ dòng rỗng và dòng bắt đầu bằng `#`, đưa về chữ thường, trả `Set`.
- `loadCommonPasswords`: `readFileSync(new URL("./common-passwords.txt", import.meta.url), "utf8")` rồi `parseCommonPasswords`. Chạy đúng cả từ `src/` (Vitest, e2e) lẫn `dist/` (sau `nest build` nhờ `assets`). Gọi một lần khi khởi động (Task 13 dùng `useFactory`).

`common-passwords.txt`:

- Nguồn: `Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt` trong SecLists (`github.com/danielmiessler/SecLists`, giấy phép MIT), commit `913b327317496d062bcc7cace524aaad8a693be2` (2026-09-08), theo Vấn đề 7 (a). File gốc có 100.000 dòng ASCII, một dòng trắng cuối file, không có `\r`.
- Xử lý (chạy một lần khi tạo file này, không phải mã chạy trong app): tải file gốc, rồi với mỗi dòng không rỗng, chuẩn hóa NFKC, đưa về chữ thường, giữ dòng có độ dài từ 8 đến 128 code point (`[...line].length`), bỏ dòng đã xuất hiện (so sau khi chuẩn hóa và hạ chữ thường), lấy 3.000 dòng đầu tiên đạt điều kiện theo đúng thứ tự xếp hạng của file gốc:

  ```sh
  curl -s -o xato-net-10-million-passwords-100000.txt \
    https://raw.githubusercontent.com/danielmiessler/SecLists/913b327317496d062bcc7cace524aaad8a693be2/Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt
  node -e '
    const fs = require("node:fs");
    const raw = fs.readFileSync("xato-net-10-million-passwords-100000.txt", "utf8");
    const seen = new Set();
    const kept = [];
    for (const line of raw.split(/\r?\n/)) {
      if (line === "") continue;
      const normalized = line.normalize("NFKC").toLowerCase();
      const codePoints = [...normalized].length;
      if (codePoints < 8 || codePoints > 128) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      kept.push(normalized);
      if (kept.length === 3000) break;
    }
    fs.writeFileSync("common-passwords-body.txt", kept.join("\n") + "\n");
  '
  ```

  Khi lập plan đã chạy đúng bước này: quét 9.454 dòng đầu của file gốc để đủ 3.000 mục qua lọc (6.427 dòng bị loại vì ngắn hơn 8 code point, không dòng nào dài hơn 128, 26 dòng trùng sau khi hạ chữ thường bị loại); 3.000 mục giữ lại đều ASCII, dài 8 đến 16 code point, không trùng, không dòng nào bắt đầu bằng `#`, không có `\r`; mục đầu gồm `password`, `12345678`, `123456789`, `baseball`, `football`.
- `common-passwords.txt` = các dòng `#` ở đầu, nối với nội dung của `common-passwords-body.txt` ở trên. Dòng `#` ghi: nguồn (`Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt` của SecLists), commit `913b327317496d062bcc7cace524aaad8a693be2`, quy tắc lọc ("NFKC, chữ thường, 8–128 code point, bỏ trùng, 3.000 mục đầu theo thứ tự xếp hạng gốc"), và toàn văn thông báo bản quyền MIT của SecLists (`Copyright (c) 2018 Daniel Miessler`, lấy từ file `LICENSE` cùng commit). `parseCommonPasswords` bỏ mọi dòng bắt đầu bằng `#` khi nạp.

`nest-cli.json`: `"compilerOptions": { "deleteOutDir": true, "assets": ["modules/auth/common-passwords.txt"] }` (đường dẫn tương đối với `sourceRoot` `src`).

**Test viết trước:**

- `password.policy.spec.ts`:
  - `normalizes a password to NFKC`; `composes Vietnamese letters typed with combining marks` (`"mật"` và `"mật"` cho cùng kết quả).
  - `counts length in code points` (`it.each`: chuỗi ASCII, chữ tiếng Việt dựng sẵn, emoji ngoài BMP đếm là 1).
  - `rejects a password shorter than the minimum after normalization` (8 code point trước NFKC, 7 sau).
  - `accepts a password of exactly the minimum length`; `accepts a password of exactly the maximum length`; `rejects a password longer than the maximum`.
  - `keeps leading and trailing spaces`.
  - `rejects a common password regardless of case` (`it.each`: `password`, `PASSWORD`, `PassWord`).
  - `returns the normalized password when the password is allowed`.
  - `parses common passwords ignoring blank lines, comments and CRLF`.
  - `loads the bundled list with 3000 entries including password and 12345678`.
- `password-hasher.spec.ts` (bản thật, không mock):
  - `hashes with argon2id and the parameters of spec section 2` (chuỗi bắt đầu bằng `$argon2id$v=19$m=19456,t=2,p=1$`).
  - `produces different hashes for the same password`.
  - `verifies the correct password`; `rejects a wrong password`; `rejects a password that differs only in normalization form` (hasher không tự chuẩn hóa).

**Kiểm tra:** như Quy ước chung cho `backend`, thêm sau khi build: `test -f backend/dist/modules/auth/common-passwords.txt` thoát mã 0. Nếu Task 9 chưa merge, glob coverage `*.policy.ts` chưa có: không sao, Task 9 thêm sau.

**Xong khi:**

- Mọi test trên pass; file danh sách có đúng 3.000 mật khẩu (đã NFKC, chữ thường, 8–128 code point, không trùng) kèm dòng `#` ghi nguồn, commit, quy tắc lọc và giấy phép MIT; `dist` có file danh sách sau build.
- Tiêu chí ST-02 "mật khẩu quá ngắn, quá dài, hoặc nằm trong danh sách phổ biến bị từ chối" có đủ quy tắc ở mức unit (mã lỗi HTTP ở Task 13, e2e ở Task 15).
- Kiểm tra của Quy ước chung xanh (tiêu chí "Bảo mật và chung" về lint, typecheck, test, build); `pnpm install --frozen-lockfile` không có cảnh báo build script cho `@node-rs/argon2` (đã do Task 2 xác nhận, task này không đổi lockfile).

**Commit:** `feat(backend): add password policy and argon2 password hasher`

## Task 12: Token, cookie và guard xác thực

**Mục tiêu:** access token JWT HS256 15 phút, refresh token ngẫu nhiên 256 bit lưu SHA-256 và xoay vòng theo họ, cookie `sf-access`, `sf-refresh`, `JwtStrategy` đọc cookie và `JwtAuthGuard` toàn cục tôn trọng `@Public()` (spec mục 1 "Access token và refresh token", mục 4 "Schema Prisma" model `RefreshToken`, "Dọn refresh token", mục 11 "Backend: unit" các dòng `RefreshTokenService`, `AccessTokenService`, `JwtStrategy`, `auth-cookies`, `JwtAuthGuard`).

**Agent:** backend-engineer. **Phụ thuộc:** Task 5, Task 9. **Đợt:** 5.

**File sở hữu (tạo), mỗi file kèm `<name>.spec.ts`:**

- `backend/src/modules/auth/access-token.service.ts`, `refresh-token.repository.ts`, `refresh-token.service.ts`, `token-generator.ts`, `auth-cookies.ts`, `jwt.strategy.ts`.
- `backend/src/common/jwt-auth.guard.ts`.

Spec mục "Cấu trúc thư mục" không ghi `token-generator.ts`; plan tách bộ sinh token ngẫu nhiên thành provider để test double được (spec mục 1, mục 11). Task này không tạo `AuthModule` và không sửa `app.module.ts` (Task 13).

**Chữ ký và hành vi:**

`token-generator.ts`:

```ts
export abstract class TokenGenerator {
  abstract generateRefreshToken(): string;   // randomBytes(32).toString("base64url")
  abstract generateFamilyId(): string;       // randomUUID()
}
@Injectable() export class CryptoTokenGenerator extends TokenGenerator { … }   // node:crypto
```

`access-token.service.ts`:

- `export const ACCESS_TOKEN_TTL_SECONDS = 900`.
- `@Injectable() export class AccessTokenService`, inject `JwtService`, `Clock`. `sign(userId: string): Promise<string>` gọi `jwtService.signAsync({ sub: userId, iat: epochSeconds }, { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL_SECONDS })` với `epochSeconds = Math.floor(clock.now().getTime() / 1000)`; `jsonwebtoken` tính `exp` từ `iat` của payload. Secret do `JwtModule` cấu hình (Task 13).

`refresh-token.repository.ts` (chỉ nơi này chạm `prisma.refreshToken`):

```ts
export const REFRESH_TOKEN_SELECT = {
  id: true, userId: true, familyId: true, expiresAt: true, rotatedAt: true, revokedAt: true,
} as const satisfies Prisma.RefreshTokenSelect;
export type RefreshTokenRecord = Prisma.RefreshTokenGetPayload<{ select: typeof REFRESH_TOKEN_SELECT }>;
export type NewRefreshToken = { readonly userId: string; readonly familyId: string; readonly tokenHash: string; readonly expiresAt: Date };

findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
createForNewFamily(token: NewRefreshToken, now: Date): Promise<void>;
rotate(current: RefreshTokenRecord, next: NewRefreshToken, now: Date): Promise<boolean>;
revokeFamily(familyId: string, now: Date): Promise<void>;
```

- `createForNewFamily`: `$transaction([create, deleteMany({ where: { userId, expiresAt: { lte: now } } })])`.
- `rotate`: `$transaction(async (tx) => …)`: `tx.refreshToken.updateMany({ where: { id: current.id, rotatedAt: null, revokedAt: null }, data: { rotatedAt: now } })`; `count` 0 → trả `false`, không ghi gì thêm; ngược lại tạo `next`, xóa token hết hạn của `current.userId`, trả `true` (spec mục 1, dòng "token hợp lệ").
- `revokeFamily`: `updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } })`.

`refresh-token.service.ts`:

```ts
export const REFRESH_TOKEN_TTL_SECONDS = 2_592_000;   // 30 ngày
export type IssuedRefreshToken = { readonly token: string; readonly expiresAt: Date };
export type RefreshRotation =
  | { readonly kind: "rotated"; readonly userId: string; readonly refreshToken: IssuedRefreshToken }
  | { readonly kind: "rejected" };
export function hashRefreshToken(token: string): string;   // sha256, hex

issueForNewSession(userId: string): Promise<IssuedRefreshToken>;
rotate(rawToken: string): Promise<RefreshRotation>;
revokeFamilyOf(rawToken: string): Promise<void>;
```

- Inject `RefreshTokenRepository`, `TokenGenerator`, `Clock`. `expiresAt = now + REFRESH_TOKEN_TTL_SECONDS`. Chỉ hash vào database; token rõ chỉ trả về cho controller đặt cookie.
- `issueForNewSession`: `familyId` mới từ `generateFamilyId`, gọi `createForNewFamily`.
- `rotate`, theo thứ tự: không tìm thấy → `rejected`; `revokedAt` khác `null` → `rejected`; `rotatedAt` khác `null` → `revokeFamily`, `logger.warn` kèm `userId`, `familyId`, `rejected`; `expiresAt <= now` → `rejected`; `repository.rotate` trả `false` (request đồng thời đã xoay trước) → xử lý như dùng lại token: `revokeFamily`, `logger.warn`, `rejected`; còn lại → `rotated` với token mới cùng `familyId`.
- `revokeFamilyOf`: tìm theo hash; có thì `revokeFamily`; không có thì không làm gì. Không bao giờ log token hay hash.

`auth-cookies.ts`:

```ts
export const ACCESS_TOKEN_COOKIE = "sf-access";
export const REFRESH_TOKEN_COOKIE = "sf-refresh";
export type AuthTokens = { readonly accessToken: string; readonly refreshToken: string };
export function readCookie(request: Request, name: string): string | null;
@Injectable() export class AuthCookies {
  set(response: Response, tokens: AuthTokens): void;
  clear(response: Response): void;
}
```

- `AuthCookies` inject `ConfigService<Env, true>` để đọc `AUTH_COOKIE_SECURE`.
- `set`: `response.cookie(name, value, { httpOnly: true, secure, sameSite: "strict", path, maxAge })`: `sf-access` với `path: "/"`, `maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000`; `sf-refresh` với `path: "/auth"`, `maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000`. Không bao giờ đặt `domain`.
- `clear`: `response.clearCookie` cho từng cookie với cùng `httpOnly`, `secure`, `sameSite`, `path`.
- `readCookie`: gán `request.cookies[name]` (kiểu `any` của `cookie-parser`) vào biến `unknown`, trả chuỗi khi là chuỗi khác rỗng, ngược lại `null`.

`jwt.strategy.ts`:

- `@Injectable() export class JwtStrategy extends PassportStrategy(Strategy, "jwt")`; constructor nhận `ConfigService<Env, true>` và gọi `super({ jwtFromRequest: (request: Request) => readCookie(request, ACCESS_TOKEN_COOKIE), secretOrKey: JWT_ACCESS_SECRET, algorithms: ["HS256"], ignoreExpiration: false })`. Không đọc header `Authorization`.
- `validate(payload: unknown): AuthenticatedUser`: `payload` là object có `sub` kiểu chuỗi khác rỗng → `{ userId: sub }`; ngược lại ném `ApiException` `401 unauthenticated`. Không truy vấn database (spec mục 1).
- Hạn của token do `passport-jwt` kiểm theo `Date.now()`; test điều khiển thời gian bằng `vi.useFakeTimers({ toFake: ["Date"] })` và `vi.setSystemTime`, không phụ thuộc giờ thật.

`common/jwt-auth.guard.ts`:

- `@Injectable() export class JwtAuthGuard extends AuthGuard("jwt")`, inject `Reflector`.
- `canActivate`: `reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [handler, class])` là `true` → trả `true`, không chạy Passport; ngược lại `super.canActivate(context)`.
- `handleRequest(error, user)`: có `error` hoặc `user` không qua `isAuthenticatedUser` → ném `ApiException` `401 unauthenticated`; ngược lại trả `user`. Nếu kiểu generic của `handleRequest` trong `@nestjs/passport` buộc dùng `any`, gói trong đúng method này kèm comment lý do (`typescript.md`).

**Test viết trước:**

- `token-generator.spec.ts`: `generates a 43 character base64url refresh token`; `generates different refresh tokens on each call`; `generates a uuid family id`.
- `access-token.service.spec.ts` (`JwtModule.register` với secret 32 ký tự, `Clock` giả): `signs an HS256 token whose subject is the user id`; `sets iat from the clock and exp 15 minutes later`.
- `refresh-token.repository.spec.ts` (`PrismaService` giả, `$transaction` gọi lại callback với `tx` giả): `creates a token and deletes expired tokens of the same user in one transaction`; `marks the current token rotated only when it is neither rotated nor revoked`; `returns false and creates nothing when the conditional update changes no row`; `creates the next token and deletes expired tokens when rotation succeeds`; `revokes every unrevoked token of a family`.
- `refresh-token.service.spec.ts` (repository thật trên `PrismaService` giả, `Clock` và `TokenGenerator` giả): `issues a token in a new family that expires in 30 days`; `stores only the sha256 hash of the token`; `rotates a valid token into the same family`; `rejects an unknown token`; `rejects a revoked token`; `rejects an expired token`; `revokes the family when a rotated token is reused`; `logs the user id and family id but not the token when reuse is detected`; `revokes the family when a concurrent rotation already won`; `revokes the family of a known token on sign-out`; `does nothing on sign-out for an unknown token`.
- `auth-cookies.spec.ts` (app Nest nhỏ với controller probe `@Res({ passthrough: true })`, `supertest`, đọc `Set-Cookie`): `sets the access cookie with HttpOnly, Secure, SameSite Strict, Path / and Max-Age 900`; `sets the refresh cookie with Path /auth and Max-Age 2592000`; `omits Secure when AUTH_COOKIE_SECURE is false`; `never sets a Domain attribute`; `clears both cookies on their own paths`; `reads a cookie value`; `returns null for a missing or empty cookie`.
- `jwt.strategy.spec.ts`: `returns the user id from a payload with a subject`; `rejects a payload without a usable subject` (`it.each`: không có `sub`, `sub` là số, `sub` rỗng, payload không phải object).
- `jwt-auth.guard.spec.ts` (app Nest nhỏ: `PassportModule`, `JwtModule.register`, `JwtStrategy`, `ConfigModule` với giá trị cố định, `APP_GUARD` `JwtAuthGuard`, `APP_FILTER` `ApiExceptionFilter`, `cookie-parser`; controller probe có một route `@Public()` và một route private trả `@CurrentUser()`): `allows a public route without a cookie`; `rejects a private route without a cookie with unauthenticated`; `passes the user id of a valid sf-access cookie to the handler`; `ignores a token sent in the Authorization header`; `rejects a token signed with HS512`; `rejects a token signed with another secret`; `rejects a token after it expires`; `accepts a token one second before it expires`.

**Kiểm tra:** như Quy ước chung cho `backend`.

**Xong khi:**

- Mọi test trên pass.
- Tiêu chí ST-02 "Đăng ký bằng email và mật khẩu… cookie có `HttpOnly`, `Secure`, `SameSite=Strict` và đúng `Path`" và "Refresh xoay token; dùng lại token đã xoay thì thu hồi cả họ" có đủ hành vi ở mức unit (e2e 1, 3 ở Task 15).
- Tiêu chí "Mọi route ngoài năm route public trả `401` khi không có cookie" có guard và test unit (e2e 12 ở Task 17).
- Tiêu chí "Không có token trong `localStorage`, IndexedDB hay cookie đọc được bằng JavaScript", phần backend: cả hai cookie token luôn `HttpOnly`; database chỉ giữ hash của refresh token.
- Kiểm tra của Quy ước chung xanh.

**Commit:** `feat(backend): add access and refresh tokens with jwt auth guard`

## Task 13: Module auth

**Mục tiêu:** năm route auth (`register`, `login`, `refresh`, `logout`, `me`), `AuthService`, repository và mapper của `User`, DTO, `AuthModule`; đăng ký `AuthModule`, `RateLimitModule` và hai guard toàn cục `JwtAuthGuard`, `RateLimitGuard` đúng thứ tự sau `OriginGuard` (spec mục 1 "Luồng", "Frontend biết ai đang đăng nhập" ý `GET /auth/me`, mục 2 "Thông báo lỗi và dò tài khoản", "Thuật toán băm" ý chống đo thời gian, mục 4 đoạn "Password hash chỉ được `select`…", mục 5 "Endpoint", "DTO và response", mục 8 "Thiết lập ứng dụng", mục 11 "Backend: unit" các dòng `AuthService`, `users.mapper`).

**Agent:** backend-engineer. **Phụ thuộc:** Task 10, Task 11, Task 12. **Đợt:** 6.

**File sở hữu:**

- Tạo `backend/src/modules/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.service.spec.ts`, `users.repository.ts`, `users.repository.spec.ts`, `users.mapper.ts`, `users.mapper.spec.ts`.
- Tạo `backend/src/modules/auth/dto/credentials.dto.ts`, `register.dto.ts`, `login.dto.ts`, `credentials.dto.spec.ts`.
- Sửa `backend/src/app.module.ts`.

`credentials.dto.ts` là lớp cha chung của hai DTO (spec chỉ ghi `register.dto.ts`, `login.dto.ts`); hai lớp con giữ tên và `implements` như spec.

**Chữ ký và hành vi:**

`users.repository.ts` (chỉ nơi này chạm `prisma.user`):

```ts
export const USER_SELECT = { id: true, email: true, createdAt: true } as const satisfies Prisma.UserSelect;
export type UserRecord = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;
export type UserCredentials = UserRecord & { readonly passwordHash: string };

create(data: { readonly email: string; readonly passwordHash: string }): Promise<UserRecord>;
findById(id: string): Promise<UserRecord | null>;
findCredentialsByEmail(email: string): Promise<UserCredentials | null>;   // method duy nhất select passwordHash
```

`create` với email trùng để lỗi `P2002` đi thẳng tới `ApiExceptionFilter` (Task 9 ánh xạ `users_email_key` → `409 email-already-registered`); repository và service không bắt lỗi Prisma.

`users.mapper.ts`: `export function toUserResponse(user: UserRecord): UserResponse` trả đúng `{ id, email, createdAt: createdAt.toISOString() }` (object mới, không spread `user`). `UserResponse` là type của Task 1.

DTO:

- `CredentialsDto`: `email` có `@Transform(({ value }: { value: unknown }) => typeof value === "string" ? normalizeEmail(value) : value)`, `@IsEmail()`, `@MaxLength(EMAIL_MAX_LENGTH)`; `password` có `@IsString()`, `@MinLength(PASSWORD_MIN_LENGTH)`, `@MaxLength(PASSWORD_MAX_LENGTH)`. Field khai báo `readonly email!: string` (khẳng định gán chắc chắn cho field do class-transformer điền, không phải non-null assertion trên biểu thức).
- `export class RegisterDto extends CredentialsDto implements RegisterRequest {}`; `export class LoginDto extends CredentialsDto implements LoginRequest {}` (tên type request theo Task 1).

`auth.service.ts`:

```ts
export const COMMON_PASSWORDS = Symbol("COMMON_PASSWORDS");
export type AuthSession = { readonly user: UserResponse; readonly tokens: AuthTokens };

@Injectable() export class AuthService implements OnModuleInit {
  onModuleInit(): Promise<void>;
  register(request: RegisterRequest): Promise<AuthSession>;
  login(request: LoginRequest): Promise<AuthSession>;
  refresh(refreshToken: string | null): Promise<AuthTokens | null>;   // null: phiên hết hạn
  logout(refreshToken: string | null): Promise<void>;
  getCurrentUser(userId: string): Promise<UserResponse>;
}
```

- Inject `UsersRepository`, `PasswordHasher`, `AccessTokenService`, `RefreshTokenService`, `TokenGenerator`, `@Inject(COMMON_PASSWORDS) ReadonlySet<string>`.
- `onModuleInit`: băm một chuỗi ngẫu nhiên (`generateRefreshToken()`) thành hash giả, giữ trong field private (spec mục 2 "Chống đo thời gian").
- `register`: `normalizeEmail(request.email)`; `checkPassword(request.password, commonPasswords)`: `too-short` → `ApiException({ statusCode: 400, code: "validation-failed", fields: [{ path: "password", constraint: "minLength" }] })`, `too-long` → như trên với `maxLength`, `too-common` → `400 password-too-common`; băm mật khẩu đã NFKC; `usersRepository.create`; tạo phiên.
- `login`: `normalizeEmail`, `normalizePassword`; `findCredentialsByEmail`; không có người dùng → vẫn `await hasher.verify(dummyHash, password)` rồi ném `401 invalid-credentials`; `verify` trả `false` → cùng lỗi, cùng body; đúng → tạo phiên. Không kiểm danh sách phổ biến khi đăng nhập.
- Tạo phiên: `Promise.all([accessTokenService.sign(user.id), refreshTokenService.issueForNewSession(user.id)])`, trả `{ user: toUserResponse(user), tokens }`.
- `refresh`: `null` → `null`; `rotate` trả `rejected` → `null`; `rotated` → ký access token mới cho `userId` của kết quả, trả cặp token.
- `logout`: có token → `revokeFamilyOf`; không có → không làm gì.
- `getCurrentUser`: `findById`; `null` (người dùng đã bị xóa) → `401 unauthenticated`.
- Logger không ghi email, mật khẩu, token.

`auth.controller.ts` (`@Controller("auth")`; mỗi handler gọi đúng một method của `AuthService`; đặt và xóa cookie qua `AuthCookies` là việc của tầng HTTP):

| Handler | Decorator | Hành vi |
|---|---|---|
| `register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response)` | `@Public()`, `@RateLimit("register")`, `@Post("register")`, `@HttpCode(201)` | `authCookies.set(response, session.tokens)`; trả `{ user }` |
| `login(@Body() dto: LoginDto, @Res({ passthrough: true }) response)` | `@Public()`, `@RateLimit("login")`, `@Post("login")`, `@HttpCode(200)` | Như trên |
| `refresh(@Req() request, @Res({ passthrough: true }) response)` | `@Public()`, `@RateLimit("refresh")`, `@Post("refresh")`, `@HttpCode(204)` | Token từ `readCookie(request, REFRESH_TOKEN_COOKIE)`; kết quả `null` → `authCookies.clear(response)` rồi ném `401 session-expired`; ngược lại `authCookies.set` |
| `logout(@Req() request, @Res({ passthrough: true }) response)` | `@Public()`, `@Post("logout")`, `@HttpCode(204)` | Gọi `logout`, luôn `authCookies.clear` |
| `me(@CurrentUser() user: AuthenticatedUser)` | `@Get("me")` | Trả `{ user }` |

Kiểu trả về của `register`, `login`, `me` là type response `{ user }` của Task 1. Không route nào khác có `@Public()`.

`auth.module.ts`:

- `imports: [PassportModule, JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config: ConfigService<Env, true>) => ({ secret: config.get("JWT_ACCESS_SECRET", { infer: true }), signOptions: { algorithm: "HS256" }, verifyOptions: { algorithms: ["HS256"] } }) })]`.
- `controllers: [AuthController]`; `providers: [AuthService, UsersRepository, AccessTokenService, RefreshTokenService, RefreshTokenRepository, AuthCookies, JwtStrategy, { provide: PasswordHasher, useClass: Argon2PasswordHasher }, { provide: TokenGenerator, useClass: CryptoTokenGenerator }, { provide: COMMON_PASSWORDS, useFactory: loadCommonPasswords }]`. Không export gì (phần 5, 8 cần thì export sau).

`app.module.ts`: thêm `RateLimitModule`, `AuthModule` vào `imports`; mảng `providers` có ba `APP_GUARD` theo đúng thứ tự `OriginGuard`, `JwtAuthGuard`, `RateLimitGuard` (spec mục 8), rồi `APP_PIPE`, `APP_FILTER` như Task 9.

**Test viết trước:**

- `auth.service.spec.ts` (`PrismaService`, `PasswordHasher`, `Clock`, `TokenGenerator` giả; repository và service token thật; `JwtModule.register` với secret test; tập mật khẩu phổ biến nhỏ dựng trong test):
  - `creates a dummy password hash on module init`.
  - `normalizes the email before creating the user`; `hashes the NFKC-normalized password`; `rejects a common password with password-too-common`; `rejects a password too short after normalization with a minLength field error`; `rejects a password too long with a maxLength field error`; `returns the user response and a token pair after registering`.
  - `rejects an unknown email with invalid-credentials`; `verifies against the dummy hash when the email is unknown`; `rejects a wrong password with the same error body as an unknown email`; `verifies the NFKC-normalized password on sign-in`; `returns the user response and a token pair after signing in`.
  - `returns null when refreshing without a token`; `returns null when the rotation is rejected`; `signs a new access token for the user of a rotated token`.
  - `revokes the token family on sign-out`; `does nothing on sign-out without a token`.
  - `returns the current user`; `rejects a current user that no longer exists with unauthenticated`.
- `users.repository.spec.ts` (`PrismaService` giả): `selects only id, email and createdAt when finding by id`; `selects the password hash only when finding credentials by email`; `creates a user and selects only the public fields`.
- `users.mapper.spec.ts`: `maps createdAt to an ISO 8601 string`; `returns only id, email and createdAt even when the record has more fields`.
- `credentials.dto.spec.ts` (gọi `createValidationPipe().transform` với `metatype` `RegisterDto` và `LoginDto`): `trims and lowercases the email`; `rejects an invalid email with isEmail`; `rejects an email longer than EMAIL_MAX_LENGTH`; `rejects a password shorter than PASSWORD_MIN_LENGTH`; `rejects a password longer than PASSWORD_MAX_LENGTH`; `rejects a non-string password`; `rejects an unknown property`.

Controller, thứ tự guard và cookie trên HTTP được kiểm ở e2e (Task 15, 17).

**Kiểm tra:** như Quy ước chung cho `backend`.

**Xong khi:**

- Mọi test trên pass; `pnpm --filter @schemaforge/backend build` chạy qua với `AuthModule` trong `AppModule`.
- Tiêu chí ST-02 "Đăng ký… dùng được ngay mà không cần xác minh email", "Đăng nhập và đăng xuất", "Đăng nhập sai email hoặc sai mật khẩu cho cùng một response; mật khẩu quá ngắn, quá dài, hoặc nằm trong danh sách phổ biến bị từ chối" có đủ hành vi ở mức unit (phần "thông báo đã dịch" là frontend, Task 19, 27; e2e 1, 2 ở Task 15).
- Tiêu chí ST-02 về `429` có decorator trên đúng ba route (e2e 11 ở Task 15).
- Chỉ năm route `GET /health`, `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` có `@Public()` (tiêu chí "Mọi route ngoài năm route public trả `401`", e2e 12 ở Task 17).
- Kiểm tra của Quy ước chung xanh.

**Commit:** `feat(backend): add auth module with register, login and refresh`

## Task 14: Module schemas

**Mục tiêu:** năm route `/schemas` (list theo keyset, get, create với id do client tạo, update toàn phần theo revision, delete), validate tài liệu bằng `parseSchemaDocument` trước mọi lần ghi và sau mỗi lần đọc, giới hạn 100 schema mỗi người (spec mục 4 "Cập nhật có điều kiện theo revision", mục 5 "Endpoint", "DTO và response", "Validate tài liệu", "Danh sách: phân trang theo keyset", "Id do client tạo", "Giới hạn số schema mỗi người", mục 11 "Backend: unit" các dòng `SchemasService`, "Cursor của danh sách", `schemas.mapper`).

**Agent:** backend-engineer. **Phụ thuộc:** Task 13. **Đợt:** 7.

**File sở hữu:**

- Tạo `backend/src/modules/schemas/schemas.module.ts`, `schemas.controller.ts`, `schemas.service.ts`, `schemas.service.spec.ts`, `schemas.repository.ts`, `schemas.repository.spec.ts`, `schemas.mapper.ts`, `schemas.mapper.spec.ts`, `schema-list-cursor.ts`, `schema-list-cursor.spec.ts`.
- Tạo `backend/src/modules/schemas/dto/create-schema.dto.ts`, `update-schema.dto.ts`, `list-schemas-query.dto.ts`, `schema-dtos.spec.ts`.
- Sửa `backend/src/app.module.ts` (thêm `SchemasModule` vào `imports`, không đổi gì khác).

**Chữ ký và hành vi:**

`schema-list-cursor.ts`:

```ts
export type SchemaListCursor = { readonly updatedAt: Date; readonly id: string };
export function encodeSchemaListCursor(cursor: SchemaListCursor): string;
export function decodeSchemaListCursor(value: string): Result<SchemaListCursor, "invalid-cursor">;
```

- Mã hóa: `Buffer.from(JSON.stringify({ updatedAt: updatedAt.toISOString(), id }), "utf8").toString("base64url")`.
- Giải mã: base64url → UTF-8 → `JSON.parse` trong `try` (kết quả `unknown`) → `z.strictObject({ updatedAt: z.iso.datetime(), id: z.uuid() }).safeParse`; bất kỳ bước nào hỏng → `{ isOk: false, error: "invalid-cursor" }`.

`schemas.repository.ts` (chỉ nơi này chạm `prisma.schema`):

```ts
export const SCHEMA_SUMMARY_SELECT = {
  id: true, name: true, revision: true, createdAt: true, updatedAt: true,
} as const satisfies Prisma.SchemaSelect;
export const SCHEMA_DETAIL_SELECT = { ...SCHEMA_SUMMARY_SELECT, document: true } as const satisfies Prisma.SchemaSelect;
export type SchemaSummaryRecord = Prisma.SchemaGetPayload<{ select: typeof SCHEMA_SUMMARY_SELECT }>;
export type SchemaDetailRecord = Prisma.SchemaGetPayload<{ select: typeof SCHEMA_DETAIL_SELECT }>;
export type SchemaWrite = { readonly id: string; readonly ownerId: string; readonly document: SchemaDocument };

listPage(input: { readonly ownerId: string; readonly take: number; readonly after: SchemaListCursor | null }): Promise<readonly SchemaSummaryRecord[]>;
findDetail(id: string, ownerId: string): Promise<SchemaDetailRecord | null>;
findRevision(id: string, ownerId: string): Promise<number | null>;
createWithinLimit(write: SchemaWrite, maxSchemas: number): Promise<SchemaSummaryRecord | null>;
updateIfRevision(write: SchemaWrite, expectedRevision: number): Promise<SchemaSummaryRecord | null>;
deleteOwned(id: string, ownerId: string): Promise<boolean>;
```

- `listPage`: `findMany({ where: { ownerId, OR: [{ updatedAt: { lt: after.updatedAt } }, { updatedAt: after.updatedAt, id: { lt: after.id } }] }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take, select: SCHEMA_SUMMARY_SELECT })`; không có `after` thì bỏ `OR`. Không bao giờ select `document`.
- `findDetail`, `findRevision`: `findFirst` với `where: { id, ownerId }`.
- `createWithinLimit`: `$transaction(async (tx) => …)`: `tx.schema.count({ where: { ownerId } })` ≥ `maxSchemas` → `null`; ngược lại `tx.schema.create({ data: { id, ownerId, name: document.name, document }, select: SCHEMA_SUMMARY_SELECT })`. Id trùng để `P2002` đi tới filter (`schemas_pkey` → `409 schema-id-unavailable`).
- `updateIfRevision`: đúng khối `updateManyAndReturn` ở spec mục 4 (`where: { id, ownerId, revision: expectedRevision }`, `data: { document, name: document.name, revision: { increment: 1 } }`); trả phần tử đầu hoặc `null`.
- `deleteOwned`: `deleteMany({ where: { id, ownerId } })`, trả `count > 0`.
- `document` ghi vào cột `Json` qua một hàm chuyển có kiểu `toJsonInput(document: SchemaDocument): Prisma.InputJsonValue` trong file này, không `as`. Nếu `SchemaDocument` không gán được cho `InputJsonValue` mà không `as`: dừng và báo để orchestrator thêm vào mục Vấn đề phát hiện khi lập plan (rủi ro "Kiểu `Json` của Prisma và `SchemaDocument` readonly").

`schemas.mapper.ts`: `toSchemaSummary(record: SchemaSummaryRecord): SchemaSummary` trả object mới `{ id, name, revision, createdAt, updatedAt }` với thời gian `toISOString()`; `toSchemaDetail(record: SchemaSummaryRecord, document: SchemaDocument): SchemaDetail` thêm `document`. Không có `ownerId`.

DTO (field khai báo `readonly …!:` như Task 13):

- `CreateSchemaDto implements CreateSchemaRequest`: `@IsUUID() id: string`; `@IsObject() document: unknown`.
- `UpdateSchemaDto implements UpdateSchemaRequest` (class riêng, không `PartialType`): `@IsObject() document: unknown`; `@IsInt() @Min(1) expectedRevision: number`.
- `ListSchemasQueryDto implements ListSchemasQuery` (type của Task 1): `@IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(SCHEMA_LIST_MAX_LIMIT) readonly limit: number = SCHEMA_LIST_DEFAULT_LIMIT` (hai hằng import từ `@schemaforge/api-contract`, không khai báo hằng riêng); `@IsOptional() @IsString() @MaxLength(200) readonly cursor?: string`.

`schemas.service.ts`:

```ts
export const MAX_DOCUMENT_ERRORS = 100;
list(ownerId: string, query: ListSchemasQueryDto): Promise<SchemaList>;
get(ownerId: string, id: string): Promise<SchemaDetail>;
create(ownerId: string, request: CreateSchemaRequest): Promise<SchemaSummary>;
update(ownerId: string, id: string, request: UpdateSchemaRequest): Promise<SchemaSummary>;
remove(ownerId: string, id: string): Promise<void>;
```

- `list`: có `cursor` → `decodeSchemaListCursor`; lỗi → `ApiException({ statusCode: 400, code: "validation-failed", fields: [{ path: "cursor", constraint: "isSchemaListCursor" }] })`. `listPage` với `take: limit + 1`; `nextCursor` là `encodeSchemaListCursor` của phần tử thứ `limit` khi có hơn `limit` hàng, ngược lại `null`; `items` là tối đa `limit` phần tử đầu qua `toSchemaSummary`.
- Hàm private `parseOrReject(document: unknown): SchemaDocument`: `parseSchemaDocument`; lỗi → `ApiException({ statusCode: 422, code: "document-invalid", documentErrors: error.slice(0, MAX_DOCUMENT_ERRORS) })`. Không gọi `validateSchema`.
- `create`: `parseOrReject`; `createWithinLimit({ id, ownerId, document }, MAX_SCHEMAS_PER_USER)`; `null` → `403 schema-limit-reached`.
- `update`: `parseOrReject`; `updateIfRevision`; có kết quả → summary; `null` → `findRevision`: `null` → `404 not-found`, số → `ApiException({ statusCode: 409, code: "revision-conflict", currentRevision })`.
- `get`: `findDetail`; `null` → `404 not-found`; `parseSchemaDocument(record.document)` lỗi → `logger.error` kèm `schemaId` và danh sách `code` (không ghi tài liệu), ném `ApiException({ statusCode: 500, code: "internal-error" })`; thành công → `toSchemaDetail` với tài liệu đã parse (đã migrate).
- `remove`: `deleteOwned` trả `false` → `404 not-found`.

`schemas.controller.ts` (`@Controller("schemas")`, không `@Public()`; mỗi handler gọi đúng một method của service, `ownerId` từ `@CurrentUser()`):

| Handler | Route | Tham số |
|---|---|---|
| `list` | `@Get()` | `@Query() query: ListSchemasQueryDto` |
| `get` | `@Get(":id")` | `@Param("id", ParseUUIDPipe) id: string` |
| `create` | `@Post()`, `@HttpCode(201)` | `@Body() dto: CreateSchemaDto` |
| `update` | `@Put(":id")` | `@Param("id", ParseUUIDPipe) id`, `@Body() dto: UpdateSchemaDto` |
| `remove` | `@Delete(":id")`, `@HttpCode(204)` | `@Param("id", ParseUUIDPipe) id` |

`schemas.module.ts`: `controllers: [SchemasController]`, `providers: [SchemasService, SchemasRepository]`, không export.

**Test viết trước:**

- `schema-list-cursor.spec.ts`: `round-trips a cursor`; `produces a base64url string without padding`; `rejects a cursor that is not valid json` ; `rejects a cursor with extra or missing fields` (`it.each`); `rejects a cursor with an invalid date or id` (`it.each`).
- `schemas.mapper.spec.ts`: `maps a summary with ISO 8601 timestamps`; `returns no ownerId or document in a summary even when the record has them`; `adds the parsed document to a detail`.
- `schemas.repository.spec.ts` (`PrismaService` giả): `orders the list by updatedAt then id descending without selecting the document`; `adds the keyset condition when a cursor is given`; `returns null without creating when the owner already has the maximum number of schemas`; `creates the schema with the document name inside the transaction`; `updates only a row matching id, owner and expected revision and increments the revision`; `returns null when no row matches the conditional update`; `scopes delete by id and owner`.
- `schemas.service.spec.ts` (repository thật trên `PrismaService` giả; tài liệu dựng bằng `@schemaforge/core/testing`):
  - Tạo: `rejects a structurally invalid document with document-invalid and core error codes and paths`; `returns at most 100 document errors`; `stores the document returned by parseSchemaDocument with its name`; `stores a document that has semantic issues` (hai bảng trùng tên); `rejects creation over the limit with schema-limit-reached`.
  - Cập nhật: `updates with the matching revision`; `rejects a stale revision with revision-conflict and the current revision`; `rejects an update of a missing schema with not-found`; `rejects an update of another user's schema with not-found`.
  - Đọc: `returns the parsed document of a schema`; `fails with internal-error and logs the schema id when the stored document cannot be parsed`; `rejects a schema of another user with not-found`.
  - Danh sách: `returns a next cursor when more rows exist`; `returns a null next cursor on the last page`; `rejects an undecodable cursor with validation-failed`.
  - Xóa: `rejects deleting another user's schema with not-found`.
- `schema-dtos.spec.ts` (`createValidationPipe().transform` với từng `metatype`): `rejects a non-uuid id`; `rejects a document that is not an object` (`it.each`: chuỗi, mảng, `null`); `rejects expectedRevision below 1 or not an integer` (`it.each`); `defaults limit to 50`; `converts a limit query string to a number`; `rejects limit 101`; `rejects a cursor longer than 200 characters`; `keeps the document deep-equal after the pipe`; `keeps a __proto__ key as own data without changing the prototype`.

**Kiểm tra:** như Quy ước chung cho `backend`. Nếu hai test cuối của `schema-dtos.spec.ts` không pass: dừng và báo (rủi ro "`class-transformer` với `transform: true`" của spec); không tự đổi cách transform.

**Xong khi:**

- Mọi test trên pass.
- Tiêu chí ST-03 "Backend validate bằng `parseSchemaDocument` trước khi lưu…, từ chối tài liệu sai cấu trúc bằng `422` kèm `code` và `path`; tài liệu còn issue ngữ nghĩa vẫn được lưu. Tài liệu đọc từ database cũng đi qua `parseSchemaDocument`" có đủ hành vi ở mức unit (e2e 6 ở Task 16).
- Tiêu chí ST-03 "Revision lệch trả `409` kèm `currentRevision`" và "schema thứ 101 của một tài khoản bị từ chối (`403`)", phần backend (e2e 4, 7, 14 ở Task 16).
- Tiêu chí ST-04 "Danh sách cloud phân trang theo keyset, tối đa 100 mỗi trang" và "schema của người khác trả `404`", phần backend (e2e 5, 8 ở Task 16).
- Kiểm tra của Quy ước chung xanh.

**Commit:** `feat(backend): add schemas module with revisions and keyset paging`

## Task 15: Hạ tầng e2e và `auth.e2e-spec.ts`

**Mục tiêu:** chạy e2e trên PostgreSQL thật bằng script `test:e2e` riêng (không coverage, tuần tự, `TRUNCATE` trước mỗi test), app dựng bằng `AppModule` cộng `configureApp`, và hành trình e2e 1, 2, 3, 11 (spec mục 9 ý "e2e", mục 11 "Backend: e2e").

**Agent:** backend-engineer. **Phụ thuộc:** Task 13. **Đợt:** 7.

**File sở hữu:**

- Tạo `backend/vitest.e2e.config.ts`.
- Tạo `backend/test/global-setup.ts`, `create-test-app.ts`, `reset-database.ts`, `set-cookie.ts`, `http-client.ts`, `factories.ts`, `auth.e2e-spec.ts`.
- Sửa `backend/package.json` (chỉ thêm script `"test:e2e": "vitest run --config vitest.e2e.config.ts"`), `backend/tsconfig.json` (thêm `test`, `vitest.e2e.config.ts` vào `include`), `backend/README.md` (thêm mục e2e, không sửa mục của Task 5).

Spec mục "Cấu trúc thư mục" không ghi `set-cookie.ts`, `http-client.ts`, `factories.ts`; plan thêm để Task 16, 17 dùng chung, vì chỉ task này được tạo helper trong `backend/test/`. Task 16, 17 không sửa các file này.

**Chữ ký và hành vi:**

`vitest.e2e.config.ts` (default export do Vitest bắt buộc):

- Nếu `backend/.env.test` tồn tại (`existsSync(fileURLToPath(new URL(".env.test", import.meta.url)))`) thì `process.loadEnvFile(đường dẫn đó)` trước `defineConfig`; CI không có file này và đặt biến trong job. Đây là file cấu hình tool như `prisma.config.ts`; nếu lint chặn `process` ở đây mà Task 2 chưa khai báo ngoại lệ thì dừng và báo.
- `test: { environment: "node", include: ["test/**/*.e2e-spec.ts"], globalSetup: ["test/global-setup.ts"], fileParallelism: false, testTimeout: 30_000, hookTimeout: 30_000 }`; không có mục `coverage`.

`test/global-setup.ts`: `export function setup(): void`:

- `process.env.NODE_ENV` khác `"test"` → ném `Error("e2e tests require NODE_ENV=test")`, không chạm database.
- `execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], { cwd: <thư mục backend tính từ import.meta.url>, stdio: "inherit" })`.

`test/reset-database.ts`: `export async function resetDatabase(prisma: PrismaService): Promise<void>` chạy câu `TRUNCATE users, schemas, refresh_tokens CASCADE` bằng `prisma.$executeRaw` dạng tagged template (không dùng bản `Unsafe`).

`test/create-test-app.ts`:

```ts
export type TestApp = {
  readonly app: NestExpressApplication;
  readonly prisma: PrismaService;
  readonly close: () => Promise<void>;
};
export async function createTestApp(options?: { readonly imports?: NonNullable<ModuleMetadata["imports"]> }): Promise<TestApp>;
```

- `Test.createTestingModule({ imports: [AppModule, ...(options?.imports ?? [])] }).compile()`; `createNestApplication<NestExpressApplication>({ bodyParser: false })`; đọc `CORS_ORIGINS`, `TRUST_PROXY_HOPS` từ `ConfigService<Env, true>`; `configureApp`; `app.init()`; gọi `resetDatabase` trước khi trả. `PasswordHasher` là bản thật, không override provider nào.
- Mỗi test tạo app mới trong `beforeEach` và `close` trong `afterEach`: bộ đếm rate limit trong bộ nhớ gắn với instance của app, nên test không ảnh hưởng nhau. `options.imports` để Task 17 thêm `DiscoveryModule`.

`test/set-cookie.ts`:

```ts
export type SetCookie = {
  readonly name: string;
  readonly value: string;
  readonly attributes: ReadonlyMap<string, string | true>;   // khóa viết thường: "path", "max-age", "httponly", …
};
export function parseSetCookieHeaders(header: unknown): readonly SetCookie[];
export function findSetCookie(cookies: readonly SetCookie[], name: string): SetCookie | null;
```

`header` là `response.headers["set-cookie"]` (mảng chuỗi hoặc không có); phần tử không phải chuỗi bị bỏ qua.

`test/http-client.ts`:

```ts
export const TEST_ORIGIN = "http://localhost:3000";   // trùng CORS_ORIGINS của .env.test.example (Task 5) và job CI
export type RequestOptions = {
  readonly body?: unknown;            // gửi JSON
  readonly rawBody?: string;          // gửi nguyên văn với Content-Type: application/json
  readonly origin?: string;           // mặc định TEST_ORIGIN
  readonly shouldOmitOrigin?: boolean;
};
export type HttpClient = {
  readonly request: (method: "GET" | "POST" | "PUT" | "DELETE", path: string, options?: RequestOptions) => Promise<Response>;
  readonly getCookie: (name: string) => string | null;
  readonly setCookie: (name: string, value: string, path: string) => void;
};
export function createHttpClient(app: NestExpressApplication): HttpClient;
```

- Giữ cookie giữa các request bằng jar riêng thay cho agent của `supertest`: `superagent` 10.3.0 chỉ gửi lại cookie `Secure` khi URL là `https:` (`CookieAccessInfo(hostname, pathname, protocol === "https:")` trong `lib/node/agent.js`), còn app test chạy `http:` và cookie auth luôn `Secure`. Xem Vấn đề 12 ở mục Vấn đề phát hiện khi lập plan; task làm theo quyết định hiện tại của spec (cookie `Secure`, e2e giữ cookie), nếu Task 0 chốt khác thì theo bản sửa plan.
- Jar: `Map` theo tên cookie, lưu `value` và `path`. Gửi header `Cookie` gồm các cookie có `path` là tiền tố của đường dẫn request (`/` cho mọi route, `/auth` chỉ cho `/auth/…`). Sau response: `Max-Age=0` hoặc `Expires` ở quá khứ → xóa khỏi jar; ngược lại ghi đè.
- Mỗi request gửi `Origin` (`options.origin` hoặc `TEST_ORIGIN`) trừ khi `shouldOmitOrigin`.

`test/factories.ts`:

```ts
export const TEST_PASSWORD = "maple-orbit-lantern-42";   // không có trong common-passwords.txt
export function testEmail(label: string): string;         // `${label}@example.com`
export async function registerUser(client: HttpClient, label: string): Promise<{ readonly userId: string; readonly email: string }>;
```

`registerUser` gọi `POST /auth/register`, kiểm status `201` (ném `Error` kèm status nếu khác), trả id từ body.

**Test viết trước (`test/auth.e2e-spec.ts`):**

- Hành trình 1:
  - `registers a user and sets sf-access and sf-refresh with HttpOnly, Secure, SameSite Strict and their paths` (`sf-access`: `Path=/`, `Max-Age=900`; `sf-refresh`: `Path=/auth`, `Max-Age=2592000`; không có `Domain`; body `{ user }` có email đã chuẩn hóa từ `" Alice@Example.COM "`).
  - `returns the registered user from me`.
  - `signs out, clears both cookies and me answers unauthenticated`.
  - `rejects the refresh token of a signed-out session with session-expired` (đặt lại `sf-refresh` cũ vào jar bằng `setCookie`).
  - `signs in again with the registered credentials`.
  - `rejects registering an existing email in another case with email-already-registered` (xác nhận `P2002` qua `@prisma/adapter-pg` thật ra đúng mã).
  - `rejects a common password with password-too-common`; `rejects a password shorter than 8 characters with validation-failed`.
- Hành trình 2: `answers a wrong password and an unknown email with the same status and body` (`401`, hai body bằng nhau và bằng `{ statusCode: 401, code: "invalid-credentials" }`).
- Hành trình 3:
  - `rotates the refresh token and sets new cookies` (`204`, `sf-refresh` mới khác cũ, `me` vẫn `200`).
  - `rejects a reused refresh token and revokes the newer token of the same family` (refresh bằng token cũ → `401 session-expired`; sau đó refresh bằng token mới → `401`).
  - `rejects refresh without a cookie with session-expired and clears the cookies`.
- Hành trình 11:
  - `answers the first 10 sign-ins for an email with invalid-credentials and the 11th with too-many-requests and Retry-After` (mười lần sai mật khẩu nhận `401`, lần 11 nhận `429`, `Retry-After` là số nguyên dương).
  - `rejects the 6th registration from the same ip within an hour with too-many-requests and Retry-After` (năm email khác nhau nhận `201`).

**Kiểm tra:**

- Như Quy ước chung cho `backend` (script `test` không chạy file trong `test/`, nên vẫn xanh khi không có database).
- Cần container `local_postgres` với database `schemaforge_test` (README của Task 5). Tạo `backend/.env.test` bằng cách chép `backend/.env.test.example` và chỉ sửa URL trỏ tới database test của máy; không in, không commit file này.
- `pnpm turbo run test:e2e --filter @schemaforge/backend` thoát mã 0; chạy hai lần liên tiếp đều xanh.
- `NODE_ENV=development pnpm --filter @schemaforge/backend test:e2e` dừng ở `global-setup` với thông báo yêu cầu `NODE_ENV=test`.
- `git status --porcelain` không có `backend/.env.test`.

**Xong khi:**

- Tiêu chí ST-02 "Đăng ký bằng email và mật khẩu, dùng được ngay mà không cần xác minh email; cookie có `HttpOnly`, `Secure`, `SameSite=Strict` và đúng `Path` (e2e 1)" pass.
- Tiêu chí ST-02 "Đăng nhập và đăng xuất; sau khi đăng xuất, `me` trả `401` và refresh token cũ không dùng được (e2e 1, 3)" pass.
- Tiêu chí ST-02 "Đăng nhập sai email hoặc sai mật khẩu cho cùng một response (e2e 2); mật khẩu quá ngắn, quá dài, hoặc nằm trong danh sách phổ biến bị từ chối", phần backend, pass.
- Tiêu chí ST-02 "Lần đăng nhập thứ 11 trong 15 phút cho cùng email, và lần đăng ký thứ 6 trong một giờ từ cùng IP, trả `429` kèm `Retry-After` (e2e 11)" pass.
- Tiêu chí ST-02 "Refresh xoay token; dùng lại token đã xoay thì thu hồi cả họ (e2e 3)" pass.
- README có mục chạy e2e; tiêu chí "Bảo mật và chung" về lint, typecheck, test, build vẫn xanh (job CI ở Task 18).

**Commit:** `test(backend): add e2e harness and auth journeys`

## Task 16: `schemas.e2e-spec.ts`

**Mục tiêu:** kiểm API lưu schema qua HTTP trên PostgreSQL thật: hành trình e2e 4, 5, 6, 7, 8, 9, 14 (spec mục 11 "Backend: e2e"), cùng hai điểm spec giao cho e2e xác nhận: tài liệu đi qua `ValidationPipe` không bị đổi, và `P2002` của `schemas_pkey` qua driver adapter ra đúng mã (mục "Rủi ro cần kiểm tra khi triển khai").

**Agent:** backend-engineer. **Phụ thuộc:** Task 14, Task 15. **Đợt:** 8.

**File sở hữu (tạo):** `backend/test/schemas.e2e-spec.ts`. Chỉ dùng helper của Task 15 (`createTestApp`, `createHttpClient`, `registerUser`, `TEST_PASSWORD`); cần helper mới thì khai báo hàm cục bộ trong file spec, không sửa file của Task 15.

**Chữ ký và hành vi:**

- Mỗi test: `beforeEach` tạo `TestApp` và một `HttpClient` cho người dùng A (`registerUser(client, "alice")`); test cần người dùng B tạo client thứ hai trên cùng app (jar cookie riêng).
- Tài liệu dựng bằng `@schemaforge/core/testing` (`createSampleSchema`, `buildSchema`, `makeTable`); id schema là `randomUUID()` của `node:crypto` (như client của phần 3).
- Hàm cục bộ ngoài `it`: `createSchema(client, document, id?)` gửi `POST /schemas` và trả response; `createSchemas(client, count)` tạo tuần tự `count` schema, kiểm từng response là `201` (dùng cho hành trình 8, 14, để thân test không có vòng lặp).
- Tài liệu sai cấu trúc: bản của `createSampleSchema()` với một trường bắt buộc bị thay bằng kiểu sai (ví dụ `tables` là chuỗi). Test chỉ khẳng định `documentErrors` khác rỗng và mỗi phần tử có `code` là chuỗi, `path` là mảng; không chép mã lỗi của core vào test.
- Body quá lớn: `rawBody` là JSON hợp lệ `{"id":"…","document":{"name":"<chuỗi dài>"}}` có độ dài byte bằng `MAX_REQUEST_BODY_BYTES + 1` (import từ `@schemaforge/api-contract`). JSON hỏng: `rawBody` là `{"id":`.

**Test viết trước (`test/schemas.e2e-spec.ts`):**

- Hành trình 4:
  - `creates a schema with revision 1 and returns its summary without the document`.
  - `returns the created schema with a document deep-equal to the one sent` (rủi ro `class-transformer`; nếu đỏ thì dừng và báo để orchestrator thêm vào mục Vấn đề phát hiện khi lập plan).
  - `updates the schema with the current revision and returns revision 2`.
  - `rejects an update with revision 1 after revision 2 with revision-conflict and currentRevision 2`.
  - `deletes the schema with 204 and then answers not-found on get`.
- Hành trình 5:
  - `answers not-found when another user reads, updates or deletes the schema` (`it.each` theo `GET`, `PUT`, `DELETE`); sau đó A vẫn get được schema với revision không đổi.
  - `does not list schemas of another user`.
  - `rejects creating a schema with an id that already exists with schema-id-unavailable` (`it.each`: id của chính A, id của B; cả hai cùng body `{ statusCode: 409, code: "schema-id-unavailable" }`).
- Hành trình 6:
  - `rejects a structurally invalid document with document-invalid listing code and path`.
  - `stores a document with two tables of the same name` (`201`, get lại vẫn có hai bảng).
- Hành trình 7: `lets exactly one of two concurrent updates with the same expected revision succeed` (`Promise.all` hai `PUT`; tập status là `200` và `409`; get cuối cùng có revision 2).
- Hành trình 8:
  - `pages three schemas with limit 2 newest first and ends with a null cursor` (trang 1 hai phần tử và `nextCursor` khác `null`; trang 2 một phần tử và `nextCursor` là `null`; ba id khác nhau theo thứ tự `updatedAt` giảm dần).
  - `rejects limit 101 with validation-failed`; `rejects an undecodable cursor with validation-failed`.
- Hành trình 9: `rejects a body larger than 2 MiB with payload-too-large`; `rejects malformed JSON with validation-failed`.
- Hành trình 14: `rejects the 101st schema of a user with schema-limit-reached` (100 lần `201` qua `createSchemas`, lần 101 nhận `403`).

**Kiểm tra:** như Quy ước chung cho `backend`, thêm `pnpm turbo run test:e2e --filter @schemaforge/backend` thoát mã 0 (container `local_postgres`, `backend/.env.test` như Task 15). Không chạy e2e đồng thời với Task 17 trên cùng `schemaforge_test` (mục Điểm nóng): nếu hai task chạy song song trong hai worktree, orchestrator cho chạy lệnh e2e lần lượt. Báo cáo ghi thời gian chạy của hành trình 14.

**Xong khi:**

- Tiêu chí ST-03 "Backend validate bằng `parseSchemaDocument` trước khi lưu vào PostgreSQL, từ chối tài liệu sai cấu trúc bằng `422` kèm `code` và `path`; tài liệu còn issue ngữ nghĩa vẫn được lưu (e2e 6)" pass.
- Tiêu chí ST-03 "Revision lệch trả `409` kèm `currentRevision`, và hai `PUT` đồng thời chỉ một thành công (e2e 4, 7)", phần backend, pass.
- Tiêu chí ST-03 "Body quá 2 MiB bị từ chối trước khi parse (`413`); schema thứ 101 của một tài khoản bị từ chối (`403`) (e2e 9, 14)" pass.
- Tiêu chí ST-04 "Danh sách cloud phân trang theo keyset, tối đa 100 mỗi trang (e2e 8)", phần backend, pass.
- Tiêu chí ST-04 "Người dùng chỉ thấy và thao tác được schema của mình; schema của người khác trả `404` (e2e 5)" pass.
- Kiểm tra của Quy ước chung xanh.

**Commit:** `test(backend): add schema storage e2e journeys`

## Task 17: `security.e2e-spec.ts`

**Mục tiêu:** kiểm các lớp bảo vệ chung trên app thật: `Origin` và CORS (hành trình 10), tập route public và `401` cho mọi route private (hành trình 12), header Helmet và response lỗi không lộ chi tiết (hành trình 13) (spec mục 1 "CSRF", mục 5 "Endpoint", "Hình dạng lỗi", mục 8, mục 11 "Backend: e2e"; rủi ro "Liệt kê route bằng `DiscoveryService`", "`Cross-Origin-Resource-Policy: same-site` với fetch CORS").

**Agent:** backend-engineer. **Phụ thuộc:** Task 14, Task 15. **Đợt:** 8.

**File sở hữu (tạo):** `backend/test/security.e2e-spec.ts`. Chỉ dùng helper của Task 15; helper mới khai báo cục bộ trong file spec.

**Chữ ký và hành vi:**

- App: `createTestApp({ imports: [DiscoveryModule] })` cho hành trình 12, `createTestApp()` cho phần còn lại. Request `OPTIONS` (preflight) gửi bằng `request(app.getHttpServer()).options(path)` của `supertest` vì `HttpClient` không có method này.
- Hằng cục bộ trong file spec (là danh sách mong đợi, không suy ra từ code):

  ```ts
  const PUBLIC_ROUTES = ["GET /health", "POST /auth/register", "POST /auth/login", "POST /auth/refresh", "POST /auth/logout"] as const;
  const PRIVATE_ROUTES = ["GET /auth/me", "GET /schemas", "GET /schemas/:id", "POST /schemas", "PUT /schemas/:id", "DELETE /schemas/:id"] as const;
  ```

- Hàm cục bộ `discoverRoutes(app): readonly { readonly route: string; readonly isPublic: boolean }[]`: `DiscoveryService.getControllers()`; với mỗi controller, `MetadataScanner.getAllMethodNames(prototype)`; đường dẫn ghép từ `PATH_METADATA` của class và của handler (chuẩn hóa về một `/` đầu, không `/` cuối); method từ `METHOD_METADATA` (giá trị `RequestMethod` đổi sang tên); `isPublic` bằng `Reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class]) === true`. Handler không có `METHOD_METADATA` bị bỏ qua. Đọc metadata qua `Reflector.get`, không `Reflect.getMetadata` trả `any`. Nếu NestJS 12 không cho lấy đủ method và path theo cách này: dừng và báo để orchestrator thêm vào mục Vấn đề phát hiện khi lập plan, không đổi sang liệt kê tay.
- Gọi route private: thay `:id` bằng một UUID cố định trong file; request thay đổi dữ liệu gửi `Origin` hợp lệ và body `{}` (guard xác thực chạy trước `ValidationPipe`, nên body không ảnh hưởng).
- Lỗi `500` thật: đăng ký người dùng, ghi thẳng một hàng `schemas` có `document` `{ version: 999 }` qua `testApp.prisma.schema.create` (tài liệu từ core mới hơn, spec mục 5 "Validate tài liệu" ý 4), rồi `GET /schemas/:id`.

**Test viết trước (`test/security.e2e-spec.ts`):**

- Hành trình 10:
  - `rejects a state-changing request without an Origin header with origin-not-allowed` (`it.each`: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /schemas`, `PUT /schemas/:id`, `DELETE /schemas/:id`).
  - `rejects Origin null with origin-not-allowed`; `rejects an unknown origin with origin-not-allowed` (`https://evil.example.com`).
  - `answers a preflight from the configured origin with Access-Control-Allow-Origin and Access-Control-Allow-Credentials true`.
  - `omits Access-Control-Allow-Origin on a preflight from an unknown origin`; `omits Access-Control-Allow-Origin on a GET from an unknown origin`.
  - `sends Cross-Origin-Resource-Policy same-site together with the CORS headers on a GET from the configured origin` (phần tự động của rủi ro CORP; đọc response từ trình duyệt thật là kiểm tra tay ở Task 37).
- Hành trình 12:
  - `discovers exactly the expected routes`; `marks exactly the five public routes of spec section 5 as public`.
  - `answers %s without a cookie with unauthenticated` (`it.each(PRIVATE_ROUTES)`).
- Hành trình 13:
  - `sends the Helmet headers on an API response` (`GET /health`: CSP gồm `default-src 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`, `form-action 'none'`; `Strict-Transport-Security`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`; `X-Frame-Options`; không có `X-Powered-By`).
  - `answers an unparseable stored document with internal-error and no stack, SQL or Prisma details` (body đúng bằng `{ statusCode: 500, code: "internal-error" }`; chuỗi response không chứa `prisma`, `stack`, `SELECT`, `at `).
  - `answers an unknown route with not-found in the error shape`.
  - `answers a unique violation without Prisma details` (đăng ký trùng email: body đúng bằng `{ statusCode: 409, code: "email-already-registered" }`).

**Kiểm tra:** như Quy ước chung cho `backend`, thêm `pnpm turbo run test:e2e --filter @schemaforge/backend` thoát mã 0 (không chạy đồng thời với e2e của Task 16 trên cùng database). Báo cáo ghi cách `discoverRoutes` đọc được metadata trên NestJS 12.0.1.

**Xong khi:**

- Tiêu chí "Mọi route ngoài năm route public trả `401` khi không có cookie (e2e 12)" pass.
- Tiêu chí "Request thay đổi dữ liệu không có `Origin` hợp lệ trả `403`; CORS chỉ cho `CORS_ORIGINS` (e2e 10)" pass.
- Tiêu chí "Response có header của Helmet; lỗi không lộ stack, SQL hay lỗi Prisma (e2e 13)" pass.
- Kiểm tra của Quy ước chung xanh.

**Commit:** `test(backend): add origin, route guard and header e2e checks`

## Task 18: Job CI `e2e`

**Mục tiêu:** thêm job `e2e` chạy e2e backend trên PostgreSQL 16 thật bằng service container, song song với `verify` và cũng là cổng chặn (spec mục 11 "CI", mục "Vấn đề với các spec đã duyệt" dòng 4).

**Agent:** devops-engineer. **Phụ thuộc:** Task 15. **Đợt:** 8.

**File sở hữu (sửa):** `.github/workflows/ci.yml`, chỉ thêm job `e2e`. Không sửa job `verify` (Task 2 đã thêm `NEXT_PUBLIC_API_URL`), `on`, `permissions`, `concurrency`.

**Cài đặt:**

- Job `e2e` ngang hàng với `verify` (không `needs`), `runs-on: ubuntu-latest`, `services.postgres` và `env` đúng khối YAML ở spec mục 11: image `postgres:16-alpine`; `POSTGRES_USER`, `POSTGRES_PASSWORD` là `schemaforge`, `POSTGRES_DB` là `schemaforge_test`; `ports: ["5432:5432"]`; health check `pg_isready -U schemaforge` mỗi 5 giây, timeout 5 giây, 10 lần. Env của job: `NODE_ENV: test`, `DATABASE_URL: postgresql://schemaforge:schemaforge@localhost:5432/schemaforge_test`, `CORS_ORIGINS: http://localhost:3000` (trùng `TEST_ORIGIN` của Task 15).
- Các bước, cùng phiên bản action với job `verify` hiện có:
  1. `actions/checkout@v7`.
  2. `pnpm/action-setup@v6`.
  3. `actions/setup-node@v7` với `node-version-file: .nvmrc`, `cache: pnpm`.
  4. `run: pnpm install --frozen-lockfile`.
  5. `run: echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)" >> "$GITHUB_ENV"` (secret sinh mới mỗi lần chạy, không phải GitHub secret).
  6. `run: pnpm turbo run test:e2e --filter @schemaforge/backend`.
- Không thêm bước cache `.turbo/cache`: task `test:e2e` có `cache: false` (Task 2), còn `generate` và `^build` chạy lại trong vài giây. Không có file `.env.test` trong CI; `vitest.e2e.config.ts` (Task 15) chỉ nạp file khi tồn tại, nên biến lấy từ `env` của job. `AUTH_COOKIE_SECURE`, `TRUST_PROXY_HOPS`, `PORT` dùng mặc định của schema env.
- Mật khẩu `schemaforge` của service container chỉ tồn tại trong job, không phải secret (spec mục 11). Không thêm giá trị nào khác vào workflow.

**Test:** không có unit test. Kiểm cấu hình như sau.

**Kiểm tra:**

- `pnpm exec prettier --check .github/workflows/ci.yml` thoát mã 0.
- YAML hợp lệ: Prettier ở bước trên đã parse file; nếu máy có sẵn `actionlint` thì chạy thêm `actionlint .github/workflows/ci.yml` và ghi kết quả; không cài thêm công cụ.
- Mô phỏng job ở local (container `local_postgres`, database test của máy): không đổi tên hay sửa `backend/.env.test` của developer; đặt các biến như job ngay trên dòng lệnh (`NODE_ENV=test`, `CORS_ORIGINS=http://localhost:3000`, `DATABASE_URL` trỏ vào database test local, `JWT_ACCESS_SECRET="$(openssl rand -base64 48)"`) trước `pnpm turbo run test:e2e --filter @schemaforge/backend`, thoát mã 0. Biến trên dòng lệnh thắng giá trị trong `.env.test` vì `process.loadEnvFile` không ghi đè biến đã có (đã thử với Node 24.21.0 khi lập plan). Không in giá trị của biến nào.
- `git status --porcelain` chỉ có `.github/workflows/ci.yml`.
- **Chỉ CI xác nhận:** sau khi orchestrator commit và push, job `e2e` và `verify` cùng xanh trên GitHub Actions (`gh run list --workflow CI --limit 1`, `gh run view <id>`). Job `e2e` đỏ thì orchestrator báo user kèm log bước lỗi (mục Cách dùng plan).

**Xong khi:**

- Tiêu chí "Bảo mật và chung": "`pnpm install --frozen-lockfile` từ bản clone sạch không còn cảnh báo build script bị chặn; `pnpm lint`, `pnpm typecheck`, `pnpm test` (đạt ngưỡng coverage) và `pnpm build` chạy qua ở local và CI; job `e2e` xanh trên CI": phần job `e2e` xanh và bước `pnpm install --frozen-lockfile` của job mới không có cảnh báo build script.
- Mọi file `*.e2e-spec.ts` đã merge vào `master` lúc push chạy trong job (số test trong log bằng số test chạy ở local). Task 16, 17 cùng đợt nên có thể merge sau Task 18; lần push của chúng chạy lại job này và orchestrator kiểm tra lại job xanh.

**Commit:** `ci: add backend e2e job with postgres service`

## Task 19: i18n namespace `auth`, `sync`, `apiErrors`

**Mục tiêu:** ba namespace mới có resource có kiểu ở `vi` và `en`, chia thành file con để các task giao diện sau (26–34) thêm key song song mà không đụng file tổng (spec mục 6 "i18n", mục 7; [Điểm nóng](#điểm-nóng-khi-làm-song-song) dòng i18n).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 1, 2. **Đợt:** 3.

**File sở hữu:**

- Sửa: `frontend/src/lib/i18n/resources.ts`, `frontend/src/lib/i18n/resources.test.ts`.
- Tạo, cho mỗi locale `<l>` là `en` và `vi` (tên export theo quy ước sẵn có: `enAuth`, `viAuth`, `enAuthSignIn`, …):
  - `frontend/src/lib/i18n/locales/<l>/auth.ts` (file tổng), và file con `auth/sign-in.ts`, `auth/sign-up.ts`, `auth/credentials-form.ts`, `auth/account-menu.ts`, `auth/sign-in-prompt.ts`.
  - `frontend/src/lib/i18n/locales/<l>/sync.ts` (file tổng), và file con `sync/open-schema.ts`, `sync/cloud-status.ts`, `sync/upload-dialog.ts`, `sync/conflict-dialog.ts`, `sync/deleted-in-cloud-dialog.ts`, `sync/schema-list.ts`, `sync/sign-out-dialog.ts`.
  - `frontend/src/lib/i18n/locales/<l>/api-errors.ts`.

**Chữ ký và hành vi:**

1. `resources.ts`: thêm `"auth"`, `"sync"`, `"apiErrors"` vào cuối `NAMESPACES`; thêm `auth: enAuth`, `sync: enSync`, `apiErrors: enApiErrors` vào `enResources` và bản `vi` tương ứng vào `viResources` (giữ `satisfies LocaleNamespace<typeof enResources>`). Không đổi namespace cũ.
2. File tổng chỉ import và ghép file con, giống `locales/en/editor.ts`:

   ```ts
   export const enAuth = {
     signIn: enAuthSignIn,
     signUp: enAuthSignUp,
     credentialsForm: enAuthCredentialsForm,
     accountMenu: enAuthAccountMenu,
     signInPrompt: enAuthSignInPrompt,
   } as const;
   export const enSync = {
     openSchema: enSyncOpenSchema,
     cloudStatus: enSyncCloudStatus,
     uploadDialog: enSyncUploadDialog,
     conflictDialog: enSyncConflictDialog,
     deletedInCloudDialog: enSyncDeletedInCloudDialog,
     schemaList: enSyncSchemaList,
     signOutDialog: enSyncSignOutDialog,
   } as const;
   ```

   File con `vi` khai báo `satisfies LocaleNamespace<typeof enX>` như `locales/vi/schema-list.ts`.
3. Mỗi file con chứa sẵn các chuỗi mà spec đã ghi nguyên văn (bản `vi` lấy đúng câu trong spec, bản `en` là bản dịch tương đương). Task giao diện sở hữu file con sau này thêm key khác nếu cần:
   - `auth/sign-in.ts`: `pageTitle` ("Đăng nhập – {{appName}}"), `title`, `submit`, `noPasswordRecovery` ("Chưa có chức năng khôi phục mật khẩu."), `toSignUp`.
   - `auth/sign-up.ts`: `pageTitle`, `title`, `submit`, `noEmailVerification` ("Tài khoản dùng được ngay, không cần xác minh email."), `toSignIn`.
   - `auth/credentials-form.ts`: `emailLabel`, `passwordLabel`, `showPassword`, `hidePassword`, `submitting`, `errors.emailRequired`, `errors.emailInvalid`, `errors.emailTooLong` (`{{max}}`), `errors.passwordTooShort` (`{{min}}`), `errors.passwordTooLong` (`{{max}}`).
   - `auth/account-menu.ts`: `signIn` ("Đăng nhập"), `signOut` ("Đăng xuất"), `signInAgain` ("Đăng nhập lại"), `menuLabel` (`{{email}}`), `loadingLabel`.
   - `auth/sign-in-prompt.ts`: `title` ("Tính năng này cần tài khoản"), `reasons.cloudSave`, `reasons.cloudSchema`, `signIn` ("Đăng nhập"), `signUp` ("Tạo tài khoản"), `later` ("Để sau").
   - `sync/open-schema.ts`: `needsNetwork.title` ("Cần kết nối mạng để mở schema này"), `retry` ("Thử lại"), `deletedElsewhere.title` ("Schema đã bị xóa ở thiết bị khác"), `notFoundSignIn` (link đăng nhập ở màn hình "Không tìm thấy schema").
   - `sync/cloud-status.ts`: `guestOnly` ("Chỉ lưu trên trình duyệt này"), `saveToCloud` ("Lưu lên cloud"), `synced` ("Đã lưu lên cloud"), `syncing` ("Đang đồng bộ…"), `pendingOffline`, `pendingServer`, `pendingSessionExpired` ("Chưa đồng bộ, hãy đăng nhập lại"), `conflict` ("Xung đột"), `resolve` ("Giải quyết"), `deletedInCloud` ("Đã bị xóa trên cloud"), `viewOptions` ("Xem lựa chọn"), `failed` ("Không đồng bộ được"), `retry`, `versionUnsupported` ("Máy chủ chưa hỗ trợ phiên bản dữ liệu này").
   - `sync/upload-dialog.ts`: `title` ("Lưu các schema trên trình duyệt này vào tài khoản?"), `description` (schema không chọn vẫn nằm trên trình duyệt và lưu lên sau được), `listLabel`, `submit` ("Lưu lên cloud"), `later` ("Để sau"), `uploaded` ("Đã lưu {{count}} schema lên cloud"), `notUploaded` ("{{count}} schema chưa lưu được").
   - `sync/conflict-dialog.ts`: `title` ("Schema đã được sửa ở nơi khác"), `localVersion`, `cloudVersion`, `updatedAt` (`{{time}}`), `counts` (`{{tables}}`, `{{columns}}`), `keepLocal` ("Giữ bản trên máy này"), `useCloud` ("Dùng bản trên cloud"), `switchedToCloud` ("Đã chuyển sang bản trên cloud").
   - `sync/deleted-in-cloud-dialog.ts`: `title`, `description`, `recreate` ("Tạo lại trên cloud"), `removeLocal` ("Xóa khỏi trình duyệt này").
   - `sync/schema-list.ts`: `ownedSection` ("Schema của bạn"), `guestSection` ("Chỉ trên trình duyệt này"), `signInToSave`, `labels.notDownloaded` ("Chưa tải về trình duyệt này"), `labels.pending` ("Chưa đồng bộ"), `labels.conflict` ("Xung đột"), `labels.deletedInCloud` ("Đã bị xóa trên cloud"), `sessionExpiredBanner` ("Phiên đăng nhập đã hết"), `cloudListFailed` ("Không tải được danh sách trên cloud"), `deleteNeedsNetwork` ("Cần kết nối mạng để xóa schema trên cloud").
   - `sync/sign-out-dialog.ts`: `title`, `description` ("{{count}} schema có thay đổi chưa lưu lên cloud. Đăng xuất sẽ xóa chúng khỏi trình duyệt này."), `trySync` ("Thử đồng bộ"), `signOutAnyway` ("Vẫn đăng xuất"), `cancel` ("Hủy"), `signOutFailed` ("Không đăng xuất được, hãy kiểm tra kết nối").
   - Key có số lượng dùng biến `count` theo cách phần 3 đang làm; không thêm hậu tố plural mới nếu phần 3 chưa dùng.
4. `api-errors.ts`: một key phẳng cho mỗi phần tử của `API_ERROR_CODES` (import từ `@schemaforge/api-contract`) cộng `network`, `timeout`, `invalid-response`:

   ```ts
   import type { ApiErrorCode } from "@schemaforge/api-contract";
   type ClientFailureKind = "network" | "timeout" | "invalid-response";
   export const enApiErrors = { … } as const satisfies Record<ApiErrorCode | ClientFailureKind, string>;
   ```

   Nội dung là câu cho người dùng, không lộ chi tiết kỹ thuật (ví dụ `invalid-credentials`: "Email hoặc mật khẩu không đúng."; `too-many-requests`: "Bạn thử quá nhiều lần. Hãy đợi một lúc rồi thử lại."; `password-too-common`: "Mật khẩu này quá phổ biến. Hãy chọn mật khẩu khác."). `ClientFailureKind` là type cục bộ của file, không export sang nơi khác (Task 20 định nghĩa `ApiFailure`).

**Test viết trước** (`resources.test.ts`, thêm vào `describe("RESOURCES")`; ba test sẵn có tự phủ key mới ở hai locale):

- `has one apiErrors message per API error code plus client failure kinds`: so `Object.keys(RESOURCES.en.apiErrors).toSorted()` với `[...API_ERROR_CODES, "network", "timeout", "invalid-response"].toSorted()`.
- `registers the auth, sync and apiErrors namespaces`: `NAMESPACES` chứa ba tên mới.

**Kiểm tra:** như "Quy ước chung" với `frontend`. Thêm: `pnpm --filter @schemaforge/frontend typecheck` phải đỏ nếu tạm xóa một key khỏi bản `vi` (thử tay rồi hoàn lại, ghi kết quả vào báo cáo).

**Xong khi:**

- Tiêu chí "Mọi chuỗi mới có `vi` và `en`; `apiErrors` phủ đủ `ApiErrorCode` (typecheck)": `satisfies Record<ApiErrorCode | …, string>` và test key ở trên xanh.
- Test "Bản dịch" của spec mục 11 (namespace `auth`, `sync`, `apiErrors` đủ key ở hai locale) xanh.

**Commit:** `feat(frontend): add auth, sync and api error translations`

## Task 20: API client, `SessionRefresher`, `AuthLockManager`

**Mục tiêu:** `src/lib/api/` là nơi duy nhất gọi `fetch`; client có kiểu trả `Result<T, ApiFailure>`, parse mọi response bằng schema của `@schemaforge/api-contract`, tự refresh một lần khi gặp `401`; refresh được tuần tự hóa trong tab và giữa các tab bằng Web Lock `schemaforge:auth-refresh` (spec mục 6 "API client", "Tuần tự hóa refresh"; mục 1 "Luồng").

**Agent:** frontend-engineer. **Phụ thuộc:** Task 1, 2, 6. **Đợt:** 4.

**File sở hữu:**

- Tạo: `frontend/src/lib/api/api-failure.ts`, `api-failure.test.ts`, `api-client.ts`, `api-client.test.ts`, `session-refresher.ts`, `session-refresher.test.ts`, `auth-lock-manager.ts`, `auth-lock-manager.test.ts`.
- Tạo: `frontend/src/testing/fake-auth-lock-manager.ts`, `fake-auth-lock-manager.test.ts`.

**Chữ ký và hành vi:**

1. `api-failure.ts`:

   ```ts
   export type ApiFailure =
     | { readonly kind: "http"; readonly status: number; readonly body: ParsedApiErrorBody; readonly retryAfterSeconds: number | null }
     | { readonly kind: "network" }
     | { readonly kind: "timeout" }
     | { readonly kind: "invalid-response" };
   export function parseRetryAfterSeconds(header: string | null): number | null;
   export function isApiErrorCode(failure: ApiFailure, code: ApiErrorCode): boolean; // http và body.code === code
   export function toApiErrorMessageKey(failure: ApiFailure): ApiErrorCode | "network" | "timeout" | "invalid-response";
   ```

   `retryAfterSeconds` đọc từ header `Retry-After` dạng số giây (không phải số nguyên dương thì `null`); trường này là chi tiết cài đặt thêm vào phác thảo của spec để `CloudPusher` (Task 23) chờ đúng `Retry-After` (Vấn đề 22). `toApiErrorMessageKey` trả key của namespace `apiErrors` (Task 19).
2. `api-client.ts`:

   ```ts
   export const REQUEST_TIMEOUT_MS = 15_000;
   export type RequestOptions = { readonly signal?: AbortSignal };
   export type ApiClient = {
     readonly auth: {
       readonly register: (input: RegisterRequest, options?: RequestOptions) => Promise<Result<UserResponse, ApiFailure>>;
       readonly login: (input: LoginRequest, options?: RequestOptions) => Promise<Result<UserResponse, ApiFailure>>;
       readonly logout: (options?: RequestOptions) => Promise<Result<void, ApiFailure>>;
       readonly me: (options?: RequestOptions) => Promise<Result<UserResponse, ApiFailure>>;
     };
     readonly schemas: {
       readonly list: (query: ListSchemasQuery, options?: RequestOptions) => Promise<Result<SchemaList, ApiFailure>>;
       readonly get: (id: string, options?: RequestOptions) => Promise<Result<SchemaDetail, ApiFailure>>;
       readonly create: (input: CreateSchemaRequest, options?: RequestOptions) => Promise<Result<SchemaSummary, ApiFailure>>;
       readonly update: (id: string, input: UpdateSchemaRequest, options?: RequestOptions) => Promise<Result<SchemaSummary, ApiFailure>>;
       readonly remove: (id: string, options?: RequestOptions) => Promise<Result<void, ApiFailure>>;
     };
   };
   export type RawAuthCalls = {
     readonly me: () => Promise<Result<UserResponse, ApiFailure>>;
     readonly refresh: () => Promise<Result<void, ApiFailure>>;
   };
   export function createRawAuthCalls(input: { readonly baseUrl: string; readonly fetchImpl: typeof fetch }): RawAuthCalls;
   export function createApiClient(input: {
     readonly baseUrl: string;
     readonly fetchImpl: typeof fetch;
     readonly sessionRefresher: SessionRefresher;
     readonly onSessionExpired: () => void;
   }): ApiClient;
   ```

   - Tên type request, response (`RegisterRequest`, `UserResponse`, `SchemaList`, …), schema Zod (`authUserResponseSchema`, `schemaListSchema`, `schemaDetailSchema`, `schemaSummarySchema`) và hàm `parseApiErrorBody` lấy đúng tên Task 1 export; không khai báo lại. `register`, `login`, `me` parse body `{ user }` bằng `authUserResponseSchema` rồi trả `user` (backend trả phong bì này, Task 13).
   - `createRawAuthCalls` gọi thẳng `GET /auth/me` và `POST /auth/refresh` không qua bước tự refresh; nó tồn tại để `SessionRefresher` không phụ thuộc vòng vào `ApiClient`. Cả hai hàm dùng chung một hàm gửi nội bộ với `createApiClient`.
   - Mọi request: `credentials: "include"`, `cache: "no-store"`, header `Accept: application/json`; có body thì `Content-Type: application/json` và `JSON.stringify`. `signal` là `AbortSignal.any([options.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])` (bỏ phần tử `undefined`). URL dựng bằng `new URL(path, baseUrl)`; id trong path đi qua `encodeURIComponent`; `list` đặt `limit`, `cursor` bằng `URLSearchParams`.
   - Ánh xạ kết quả: `fetch` reject với `DOMException` tên `TimeoutError` → `timeout`; signal của nơi gọi bị hủy → throw lại lỗi `AbortError` (nơi gọi chủ động hủy, không phải lỗi dự kiến); reject khác → `network`. Status 2xx: `204` → `{ isOk: true, value: undefined }`; còn lại parse JSON rồi `safeParse` bằng schema hợp đồng, sai → `invalid-response`. Status khác 2xx: parse body bằng `parseApiErrorBody`, `null` → `invalid-response`, ngược lại → `http` kèm `status`, `body`, `retryAfterSeconds`.
   - `invalid-response` ghi `logger.warn("api.invalid-response", { route, status })`, với `route` là mẫu đường dẫn (`/schemas/:id`), không ghi body, id hay tài liệu.
   - Tự refresh: route không bắt đầu bằng `/auth/` trả `http` `401` mã `unauthenticated` → `await sessionRefresher.refresh()`; `isOk` → gửi lại đúng một lần (response lần hai trả nguyên, kể cả `401`); refresh trả `http` `401` → gọi `onSessionExpired()` rồi trả failure `401` ban đầu; refresh trả `network`, `timeout`, `invalid-response`, `5xx`, `429` → trả failure đó, không gọi `onSessionExpired` (Vấn đề 18).
3. `session-refresher.ts`:

   ```ts
   export type SessionRefresher = { readonly refresh: () => Promise<Result<void, ApiFailure>> };
   export function createSessionRefresher(input: { readonly lockManager: AuthLockManager; readonly calls: RawAuthCalls }): SessionRefresher;
   ```

   - Trong một tab: đang có promise refresh chạy thì trả chính promise đó; settle xong thì xóa để lần sau refresh mới.
   - Trong `lockManager.runExclusive`: `calls.me()`; `isOk` → ok (tab khác vừa refresh); `http 401` → `calls.refresh()` và trả kết quả; failure khác của `me` → trả failure đó, không gọi refresh.
   - Không xin khóa schema trong khi giữ khóa auth (spec mục 6).
4. `auth-lock-manager.ts`:

   ```ts
   export const AUTH_REFRESH_LOCK_NAME = "schemaforge:auth-refresh";
   export type AuthLockManager = { readonly runExclusive: <T>(task: () => Promise<T>) => Promise<T> };
   export function createAuthLockManager(request: LockRequest): AuthLockManager;
   export function createBrowserAuthLockManager(): AuthLockManager;
   ```

   Dùng lại port `LockRequest` và thông báo lỗi secure context của `src/lib/storage/schema-lock-manager.ts` (import type, không sửa file đó). Khóa `exclusive`, chờ tới khi được cấp (không `ifAvailable`); lỗi của `task` được chuyển tiếp sau khi nhả khóa.
5. `testing/fake-auth-lock-manager.ts`: `createFakeAuthLockManager(registry?: FakeLockRegistry): { readonly lockManager: AuthLockManager; readonly isHeld: () => boolean }`, dựng từ `createAuthLockManager(registry.request)` của `createFakeLockRegistry`; hai tab giả dùng chung một registry.

**Test viết trước:**

- `api-failure.test.ts`: `parses a numeric Retry-After header as seconds`; `returns null retryAfterSeconds for a missing or non-numeric header`; `maps each failure kind to its apiErrors key`.
- `api-client.test.ts` (`fetchImpl` là `vi.fn` trả `Response` dựng tay):
  - `sends credentials, no-store cache and the JSON accept header`; `adds the JSON content type only when there is a body`.
  - `parses a successful user response with the contract schema`; `returns undefined for a 204 response`.
  - `returns an http failure with the error code for a contract error body`; `includes currentRevision for a revision conflict`.
  - `returns invalid-response when a success body breaks the contract`; `returns invalid-response when an error body breaks the contract`; `logs the route and status but not the body for an invalid response`.
  - `returns network when fetch rejects`; `returns timeout when the request times out` (signal giả đã hủy với `TimeoutError`); `rethrows AbortError when the caller aborts`.
  - `refreshes once and retries the request after a 401`; `does not retry a second time when the retry also returns 401`; `calls onSessionExpired when the refresh returns 401`; `does not call onSessionExpired when the refresh fails with a network error`; `never refreshes for auth routes`.
  - `encodes the schema id in the path`; `sends limit and cursor as query parameters`.
- `session-refresher.test.ts`: `shares one refresh between concurrent calls in the same tab`; `skips the refresh when me succeeds inside the lock`; `posts refresh when me returns 401 inside the lock`; `runs refreshes from two tabs one after another` (hai refresher, chung `createFakeAuthLockManager` registry); `starts a new refresh after the previous one settles`.
- `auth-lock-manager.test.ts`: `uses the schemaforge:auth-refresh lock name`; `waits for the current holder before running the task`; `releases the lock when the task rejects`; `throws when the Web Locks API is unavailable`.
- `fake-auth-lock-manager.test.ts`: `reports the lock as held while a task runs`.

**Kiểm tra:** như "Quy ước chung" với `frontend`. Thêm: `pnpm --filter @schemaforge/frontend lint` không báo `no-restricted-globals` cho `fetch` trong `src/lib/api/**` (ngoại lệ Task 2) và vẫn báo nếu tạm gọi `fetch` ở file khác.

**Xong khi:**

- Hàng `api-client` và `session-refresher` của bảng unit test frontend (spec mục 11) xanh.
- Phần unit test của tiêu chí ST-02 "Refresh xoay token; … hai tab cùng gặp access token hết hạn không bị đăng xuất (unit test `session-refresher`; kiểm tra tay)"; phần kiểm tra tay thuộc Task 37.
- Một phần tiêu chí "Không có token trong `localStorage`, IndexedDB hay cookie đọc được bằng JavaScript": client chỉ dựa vào cookie `HttpOnly` qua `credentials: "include"`, không đọc hay lưu token (kiểm bằng review; không có API đọc token).

**Commit:** `feat(frontend): add typed api client with serialized session refresh`

## Task 21: Auth store, cookie `sf-auth-hint`, `BroadcastChannel`, `sanitizeReturnTo`

**Mục tiêu:** trạng thái đăng nhập của app là một store `zustand/vanilla` không phụ thuộc React; khách không có cookie gợi ý thì không gọi mạng; các tab báo cho nhau qua `BroadcastChannel` `schemaforge:auth`; `returnTo` không mở được redirect ra ngoài (spec mục 1 "Frontend biết ai đang đăng nhập", mục 6 "Auth store", "Màn hình đăng nhập, đăng ký", mục 7 "Phiên hết hạn và đổi tài khoản").

**Agent:** frontend-engineer. **Phụ thuộc:** Task 7, 20. **Đợt:** 5.

**File sở hữu:** tạo `frontend/src/lib/auth/auth-hint-cookie.ts`, `auth-hint-cookie.test.ts`, `auth-channel.ts`, `auth-channel.test.ts`, `sanitize-return-to.ts`, `sanitize-return-to.test.ts`, `auth-store.ts`, `auth-store.test.ts`.

**Chữ ký và hành vi:**

1. `auth-hint-cookie.ts` (cùng khuôn `src/lib/preferences/preference-cookies.ts`):

   ```ts
   export const AUTH_HINT_COOKIE_NAME = "sf-auth-hint";
   export const AUTH_HINT_MAX_AGE_SECONDS = 2_592_000; // 30 ngày, khớp refresh token
   export function parseAuthHint(value: string | undefined): boolean; // chỉ "1" là true
   export function serializeAuthHintCookie(options: { readonly isSecure: boolean }): string;
   export function serializeClearedAuthHintCookie(options: { readonly isSecure: boolean }): string; // Max-Age=0
   export type AuthHintCookie = { readonly isPresent: () => boolean; readonly write: () => void; readonly clear: () => void };
   export function createAuthHintCookie(input: { readonly cookieJar: Pick<Document, "cookie">; readonly isSecure: boolean }): AuthHintCookie;
   ```

   Giá trị luôn là `1`; thuộc tính `Path=/; Max-Age=…; SameSite=Lax`, thêm `Secure` khi `isSecure` (nơi dùng truyền `env.isProduction` như `ThemeProvider`). `isPresent` tách `document.cookie` theo `;` và gọi `parseAuthHint`.
2. `auth-channel.ts`:

   ```ts
   export const AUTH_CHANNEL_NAME = "schemaforge:auth";
   export type AuthChannelMessage = { readonly type: "signed-in" } | { readonly type: "signed-out" };
   export type BroadcastChannelLike = Pick<BroadcastChannel, "postMessage" | "addEventListener" | "removeEventListener" | "close">;
   export type AuthChannel = {
     readonly post: (message: AuthChannelMessage) => void;
     readonly subscribe: (listener: (message: AuthChannelMessage) => void) => () => void;
     readonly close: () => void;
   };
   export function createAuthChannel(open: (name: string) => BroadcastChannelLike): AuthChannel;
   ```

   Message nhận được là `unknown`: chỉ object có `type` đúng một trong hai giá trị mới tới listener (type guard, không `as`); message khác bị bỏ qua. Message không mang email, id hay token.
3. `sanitize-return-to.ts`:

   ```ts
   export function sanitizeReturnTo(value: string | null | undefined): string;
   export function buildAuthHref(route: "/sign-in" | "/sign-up", returnTo: string): string; // "/sign-in?returnTo=%2Fschemas%2Fx"
   ```

   Đúng quy tắc spec mục 6: chỉ nhận chuỗi bắt đầu bằng `/`, không bắt đầu bằng `//`, không chứa `\`, và `new URL(value, "https://return-to.invalid")` có `origin` không đổi; khác thì `/`. Giá trị trả về là `pathname + search + hash` của URL đã resolve. `buildAuthHref` luôn đưa `returnTo` qua `sanitizeReturnTo` trước khi đặt bằng `URLSearchParams`.
4. `auth-store.ts`:

   ```ts
   export type SessionUser = { readonly id: string; readonly email: string };
   export type AuthState =
     | { readonly status: "unknown" }
     | { readonly status: "signed-out" }
     | { readonly status: "signed-in"; readonly user: SessionUser }
     | { readonly status: "expired"; readonly lastUser: SessionUser | null };
   export type SessionStore = {
     readonly read: () => Promise<SessionRecord | null>;
     readonly write: (record: SessionRecord) => Promise<void>;
   };
   export type AuthStoreDependencies = {
     readonly api: ApiClient;
     readonly sessionRefresher: SessionRefresher;
     readonly hintCookie: AuthHintCookie;
     readonly channel: AuthChannel;
     readonly sessionStore: SessionStore;
     readonly onAccountChanged: (previousUserId: string) => Promise<void>;
   };
   export type AuthStoreState = {
     readonly auth: AuthState;
     readonly activeSignInCount: number;
     readonly initialize: () => Promise<void>;
     readonly signIn: (input: LoginRequest) => Promise<Result<void, ApiFailure>>;
     readonly signUp: (input: RegisterRequest) => Promise<Result<void, ApiFailure>>;
     readonly markSessionExpired: () => void;
     readonly markSignedOut: () => void;
   };
   export function createAuthStore(dependencies: AuthStoreDependencies): StoreApi<AuthStoreState>;
   ```

   - `SessionRecord` là type Task 7 export từ `@/lib/storage/records`; `SessionStore` là port hẹp để store không phụ thuộc Dexie, Task 26 nối `read` vào `repository.readSession()` và `write` vào `repository.writeSession({ userId, email })` (Task 7; `writeSession` tự đặt khóa `"current"`).
   - Trạng thái đầu `unknown`. `initialize`: `hintCookie.isPresent()` false → `signed-out`, không gọi `api` hay `sessionStore`. Có hint → `api.auth.me()`; ok → `signed-in`; `http 401` → `sessionRefresher.refresh()` một lần, ok thì gọi lại `me`; vẫn thất bại với `401` → `hintCookie.clear()`, `expired` với `lastUser` đọc từ `sessionStore.read()` (không có thì `null`). `me` lỗi `network`, `timeout`, `5xx`: `expired` giữ hint, `lastUser` từ `session` (Vấn đề 19).
   - `signIn`, `signUp` thành công: đọc `session`; có và `userId` khác người vừa đăng nhập → `await onAccountChanged(previousUserId)` (Task 26 nối vào `forgetPreviousAccount` của Task 25); `sessionStore.write({ key: "current", userId, email })`; `hintCookie.write()`; `auth` thành `signed-in`; `activeSignInCount` tăng 1; `channel.post({ type: "signed-in" })`. Thất bại: trả failure, không đổi `auth`, không ghi gì. `activeSignInCount` là tín hiệu duy nhất cho hộp thoại đưa schema của khách lên (Task 28); `initialize` và message từ tab khác không tăng nó.
   - `markSessionExpired` (được `onSessionExpired` của API client gọi): `hintCookie.clear()`; `auth` thành `expired` với `lastUser` là user hiện tại nếu đang `signed-in`, ngược lại đọc từ `session`.
   - `markSignedOut`: `auth` thành `signed-out`. Chỉ luồng đăng xuất (Task 25, nối ở Task 26) gọi sau khi đã dọn cache; store không tự xóa cache hay hint trong action này.
   - Store `subscribe` vào `channel` khi tạo: `signed-in` → `initialize()`; `signed-out` → `markSignedOut()`. Không phát lại message nhận được.
   - Đăng xuất không nằm trong store: `AuthActions.signOut` của phác thảo spec được `AuthProvider` (Task 26) ghép từ `signOut` (Task 25) và `markSignedOut`, vì Task 21 và 25 chạy cùng đợt.

**Test viết trước:**

- `auth-hint-cookie.test.ts`: `accepts only the value 1 as a hint`; `serializes the hint with path, max age and SameSite=Lax`; `adds Secure only when isSecure is true`; `clears the hint with Max-Age=0`; `reads the hint among other cookies`.
- `auth-channel.test.ts` (kênh giả trong bộ nhớ nối hai `AuthChannel`): `delivers a signed-out message to the other channel`; `ignores messages with an unknown shape`; `stops delivering after unsubscribe`.
- `sanitize-return-to.test.ts`: `it.each` với `/schemas/x` giữ nguyên, `/schemas/x?tab=1#top` giữ nguyên; `//evil.com`, `https://evil.com`, `/\\evil.com`, `javascript:alert(1)`, chuỗi rỗng, `null`, `undefined` thành `/`; `builds a sign-in href with an encoded return path`; `drops an external return path when building an href`.
- `auth-store.test.ts` (`fetchImpl` giả qua `createApiClient`, `createFakeAuthLockManager`, cookie jar giả, kênh giả, `SessionStore` trong bộ nhớ):
  - `starts in the unknown state`; `becomes signed-out without calling fetch when there is no hint`.
  - `calls me and becomes signed-in when the hint is present`; `refreshes once and retries me after a 401`; `clears the hint and becomes expired with the stored last user when the refresh fails`.
  - `writes the hint, the session record and broadcasts signed-in after signing in`; `increments activeSignInCount only for an active sign-in`; `keeps the state and writes nothing when signing in fails`.
  - `calls onAccountChanged before replacing the session of another account`; `does not call onAccountChanged for the same account`.
  - `runs initialize when another tab broadcasts signed-in`; `becomes signed-out when another tab broadcasts signed-out`.
  - `keeps the last user when the session expires`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Xong khi:**

- Hàng `auth-store` và `sanitize-return-to` của bảng unit test frontend (spec mục 11) xanh.
- Phần store của tiêu chí ST-02 "Khách không có cookie gợi ý không gọi mạng lần nào…": test `becomes signed-out without calling fetch when there is no hint` xanh (hành trình đầy đủ là tích hợp 7, Task 35).
- Phần `returnTo` của tiêu chí ST-02 "…đăng nhập xong quay về đúng trang qua `returnTo`, và `returnTo` trỏ ra ngoài bị bỏ qua" ở mức hàm.
- Tiêu chí "`sf-auth-hint` chỉ chứa `1`": test serialize xanh.

**Commit:** `feat(frontend): add auth store with sign-in hint cookie and tab channel`

## Task 22: Hàm thuần đồng bộ `decideOpenAction`, `mergeSchemaList`, `documentsEqual`

**Mục tiêu:** mọi quyết định mở bản nào và gộp danh sách ra sao là hàm thuần trong `src/lib/sync/`, test đủ từng dòng bảng của spec mà không cần mạng hay IndexedDB (spec mục 7 "Nguyên tắc", "Mở schema", "Đẩy lên cloud" đoạn so sánh tài liệu, "Danh sách schema").

**Agent:** frontend-engineer. **Phụ thuộc:** Task 1, 2, 7; các trường hợp chưa có trong bảng spec chờ Task 0. **Đợt:** 3.

**File sở hữu:** tạo `frontend/src/lib/sync/documents-equal.ts`, `documents-equal.test.ts`, `decide-open-action.ts`, `decide-open-action.test.ts`, `merge-schema-list.ts`, `merge-schema-list.test.ts`.

**Chữ ký và hành vi:**

Các hàm không import Dexie, React, `fetch` hay `ApiFailure` (Task 20 chạy song song đợt khác); kết quả gọi cloud được mô tả bằng type riêng của file. `SchemaRecord`, `SchemaListEntry` là type Task 7 export (union có chủ và của khách theo spec mục 7 "Dexie version 2"). `SchemaDetail`, `SchemaSummary` lấy từ `@schemaforge/api-contract`.

1. `documents-equal.ts`: `export function documentsEqual(left: unknown, right: unknown): boolean`. So sánh sâu: object so theo tập khóa và giá trị, không phụ thuộc thứ tự khóa; mảng so theo thứ tự; primitive so bằng `Object.is`; `undefined` trong object tính như khóa có giá trị `undefined` (khác với thiếu khóa). Không dùng `JSON.stringify` (JSONB sắp lại khóa).
2. `decide-open-action.ts`:

   ```ts
   export type OpenAuthContext =
     | { readonly status: "signed-out" }
     | { readonly status: "signed-in"; readonly userId: string }
     | { readonly status: "expired"; readonly lastUserId: string | null };
   export type CloudFetchResult =
     | { readonly kind: "found"; readonly detail: SchemaDetail }
     | { readonly kind: "not-found" }
     | { readonly kind: "unavailable" }; // network, timeout, invalid-response, 5xx, 429
   export type OpenAction =
     | { readonly kind: "open-cached"; readonly followUp: "none" | "push-create" | "push-update" | "retry-when-online" | "wait-for-sign-in" }
     | { readonly kind: "store-cloud-and-open"; readonly document: SchemaDocument; readonly revision: number }
     | { readonly kind: "open-cached-with-conflict"; readonly cloud: SchemaDetail }
     | { readonly kind: "open-cached-deleted-in-cloud" }
     | { readonly kind: "delete-cache-deleted-elsewhere" }
     | { readonly kind: "not-found"; readonly shouldOfferSignIn: boolean }
     | { readonly kind: "needs-network" }
     | { readonly kind: "cloud-version-unsupported" };
   export function shouldFetchCloud(input: { readonly auth: OpenAuthContext; readonly cached: SchemaRecord | null }): boolean;
   export function decideOpenAction(input: { readonly auth: OpenAuthContext; readonly cached: SchemaRecord | null; readonly cloud: CloudFetchResult | null }): OpenAction;
   ```

   - `cloud` là `null` khi `shouldFetchCloud` trả `false`. `shouldFetchCloud` true khi và chỉ khi `auth` là `signed-in` và (không có cache, hoặc cache thuộc đúng `userId` và không phải `pending` với `cloudRevision: null`).
   - Mỗi dòng bảng "Mở schema" của spec mục 7 ứng đúng một nhánh:
     - Cache của khách → `open-cached` `none`. Cache có `ownerId` khác người đang đăng nhập (hoặc khác `lastUserId` khi `expired`) → `not-found` `shouldOfferSignIn: false`.
     - Không cache, `signed-out` hoặc `expired` → `not-found` `shouldOfferSignIn: true`. Không cache, `found` → `store-cloud-and-open` với tài liệu đã qua `parseSchemaDocument`; không cache, `not-found` → `not-found` `false`; không cache, `unavailable` → `needs-network`.
     - `pending` với `cloudRevision: null` → `open-cached` `push-create`.
     - `synced` + `found` cùng revision → `open-cached` `none`; khác revision → `store-cloud-and-open`; `synced` + `not-found` → `delete-cache-deleted-elsewhere`.
     - `pending` + `found` cùng revision → `open-cached` `push-update`. `pending` hoặc `conflict` + `found` khác revision → `open-cached-with-conflict`. `pending`, `conflict` hoặc `deleted-in-cloud` + `not-found` → `open-cached-deleted-in-cloud`.
     - Có cache + `unavailable` → `open-cached` `retry-when-online`. Có cache của đúng `lastUserId` khi `expired` → `open-cached` `wait-for-sign-in`.
   - Mọi nhánh dùng tài liệu cloud đều gọi `parseSchemaDocument(detail.document)` trước. Lỗi có mã `version-unsupported` → `cloud-version-unsupported` (không ghi đè cache, spec mục 7). Lỗi cấu trúc khác (backend đã parse nên gần như không xảy ra) và các tổ hợp bảng spec không liệt kê (`conflict` + `found` cùng revision, `deleted-in-cloud` + `found`, cache có chủ khi `signed-out`), cùng hai tổ hợp thiếu của bảng "Gộp một id" (mục 3 dưới), theo Vấn đề 20: trước khi code, task gửi orchestrator đề xuất xử lý cho từng trường hợp kèm tên test; người dùng duyệt và orchestrator ghi lựa chọn vào đây rồi task mới code. Mỗi trường hợp có một test đặt tên theo lựa chọn đã duyệt. Task không tự chọn hành vi cho các trường hợp này.
3. `merge-schema-list.ts`:

   ```ts
   export type ListAuthContext = OpenAuthContext;
   export type SchemaRowLabel = "not-downloaded" | "pending" | "conflict" | "deleted-in-cloud" | null;
   export type MergedSchemaRow = {
     readonly id: string;
     readonly name: string;
     readonly updatedAt: number;           // epoch ms; thời gian cloud chuyển từ ISO 8601
     readonly source: "cloud" | "cache";
     readonly label: SchemaRowLabel;
   };
   export type MergedSchemaList = {
     readonly owned: { readonly kind: "sign-in-invitation" } | { readonly kind: "rows"; readonly rows: readonly MergedSchemaRow[]; readonly isSessionExpired: boolean };
     readonly guest: readonly SchemaListEntry[];
     readonly staleCacheIds: readonly string[];
   };
   export function mergeSchemaList(input: {
     readonly auth: ListAuthContext;
     readonly cachedEntries: readonly SchemaListEntry[];
     readonly cloudItems: readonly SchemaSummary[] | null; // null: chưa tải hoặc tải lỗi
     readonly isCloudListComplete: boolean;
   }): MergedSchemaList;
   ```

   - Theo trạng thái auth: `signed-out` → `owned` là `sign-in-invitation`; `signed-in` → hợp cloud và cache có `ownerId` là `userId`; `expired` → cache của `lastUserId`, `isSessionExpired: true`. `guest` luôn là entry của khách giữ nguyên thứ tự và dạng `SchemaListEntry` của phần 3 (kể cả `unreadable`).
   - Gộp một id theo đúng bảng "Gộp một id": cloud có, cache không → nguồn cloud, `not-downloaded`; cache `synced` revision ≥ cloud → nguồn cache, `null`; cloud revision lớn hơn → nguồn cloud, `null`; cache `pending` → nguồn cache, `pending`; cache `conflict` → nguồn cache, `conflict`; cloud không có và `isCloudListComplete`: cache `synced` → không có dòng, id vào `staleCacheIds`; `pending` có `cloudRevision` khác `null` hoặc `deleted-in-cloud` → nguồn cache, `deleted-in-cloud`. Hai tổ hợp bảng spec không có (cloud còn nhưng cache `deleted-in-cloud`; cache `conflict` khi cloud không còn) theo lựa chọn đã duyệt của Vấn đề 20.
   - `cloudItems` là `null` hoặc `isCloudListComplete` false: chỉ hiện cache của tài khoản, nhãn theo `syncStatus` (`synced` → `null`), `staleCacheIds` rỗng (không kết luận schema nào đã bị xóa).
   - Mỗi phần sắp theo `updatedAt` giảm dần, cùng `updatedAt` thì theo `id` giảm dần.

**Test viết trước:**

- `documents-equal.test.ts`: `treats documents with different key order as equal`; `treats arrays with different order as different`; `distinguishes a missing key from a key set to undefined`; `compares nested objects deeply`; `treats different primitive values as different`.
- `decide-open-action.test.ts`: một `it.each` cho `shouldFetchCloud` theo mọi dòng bảng "Mở schema"; một `it.each` cho `decideOpenAction` với mỗi dòng bảng là một hàng (tên hàng theo cột "Bản cache" và "`GET /schemas/:id`"); thêm `returns cloud-version-unsupported without replacing the cache for a newer cloud document`, và một test cho mỗi tổ hợp Task 0 chốt. Dữ liệu dựng bằng factory record nhỏ và `createSampleSchema` của `@schemaforge/core/testing`.
- `merge-schema-list.test.ts`: `shows a sign-in invitation instead of the owned section when signed out`; `keeps guest entries in the guest section in every auth state`; `shows the cache of the last user with the expired flag`; `it.each` cho mọi dòng bảng "Gộp một id"; `does not report stale ids while the cloud list is incomplete`; `shows owned cache rows when the cloud list failed to load`; `sorts each section by updatedAt descending`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Xong khi:**

- Hàng `decide-open-action`, `merge-schema-list`, `documents-equal` của bảng unit test frontend (spec mục 11) xanh.
- Phần logic của tiêu chí ST-04 "Màn hình danh sách gộp schema trên cloud với cache, có nhãn trạng thái, và vẫn hiện cache khi không tải được danh sách cloud" (màn hình ở Task 32).
- Phần logic của tiêu chí ST-03 "Mở được schema đã lưu từ thiết bị khác" (luồng mở ở Task 29, tích hợp 4 ở Task 35).

**Commit:** `feat(frontend): add pure sync decisions for opening and listing schemas`

## Task 23: `CloudPusher` và `pushSchemaOnce`

**Mục tiêu:** đẩy cả tài liệu của một schema có chủ lên cloud kèm revision, mỗi lúc một request, xử lý đúng bảng kết quả, thử lại có giãn cách và không phụ thuộc đồng hồ thật (spec mục 7 "Đẩy lên cloud", "Đồng bộ nền", "Web Locks").

**Agent:** frontend-engineer. **Phụ thuộc:** Task 7, 20, 22. **Đợt:** 5.

**File sở hữu:** tạo `frontend/src/lib/sync/push-schema-once.ts`, `push-schema-once.test.ts`, `cloud-pusher.ts`, `cloud-pusher.test.ts`, `retry-scheduler.ts`, `retry-scheduler.test.ts`.

**Chữ ký và hành vi:**

Mọi đọc, ghi IndexedDB đi qua method của `SchemaRepository` mà Task 7 định nghĩa: đọc record bằng `readSchemaRecord` và tài liệu bằng `openSchema` (phần 3); ghi kết quả đẩy thành công bằng `completePush(schemaId, { revision, sentUpdatedAt })` (đặt `cloudRevision`, và `synced` chỉ khi `updatedAt` chưa đổi so với lúc gửi, trong một transaction); đặt `syncStatus` thành `conflict` hoặc `deleted-in-cloud` bằng `setSyncState` (giữ `cloudRevision` hiện tại). Thiếu method nào thì dừng và báo (Quy ước chung). Người gọi đã giữ khóa `schemaforge:schema:<id>`; hai hàm này không xin khóa.

1. `retry-scheduler.ts`:

   ```ts
   export type RetryScheduler = { readonly schedule: (delayMs: number, run: () => void) => () => void }; // trả hàm hủy
   export function createBrowserRetryScheduler(): RetryScheduler; // setTimeout, clearTimeout
   export const RETRY_INITIAL_DELAY_MS = 2_000;
   export const RETRY_MAX_DELAY_MS = 60_000;
   export function nextRetryDelayMs(input: { readonly attempt: number; readonly retryAfterSeconds: number | null }): number;
   ```

   `attempt` bắt đầu từ 0: `min(2000 * 2^attempt, 60000)`; có `retryAfterSeconds` thì lấy `max` của giá trị đó (đổi ra ms) và giãn cách.
2. `push-schema-once.ts`:

   ```ts
   export type PushOutcome =
     | { readonly kind: "synced"; readonly revision: number }
     | { readonly kind: "changed-while-sending"; readonly revision: number }
     | { readonly kind: "conflict"; readonly cloud: SchemaDetail | null }
     | { readonly kind: "deleted-in-cloud" }
     | { readonly kind: "failed"; readonly code: "payload-too-large" | "schema-limit-reached" | "document-invalid" | "version-unsupported" | "schema-id-unavailable" }
     | { readonly kind: "session-expired" }
     | { readonly kind: "retryable"; readonly retryAfterSeconds: number | null }
     | { readonly kind: "not-pushable" }; // record không còn, của khách, hoặc không phải pending
   export function pushSchemaOnce(input: {
     readonly api: ApiClient;
     readonly repository: SchemaRepository;
     readonly schemaId: string;
     readonly userId: string;
   }): Promise<PushOutcome>;
   ```

   - Đọc record và tài liệu; record không có, `ownerId` khác `userId`, hoặc `syncStatus` khác `pending` → `not-pushable`.
   - `new TextEncoder().encode(JSON.stringify(document)).byteLength > MAX_REQUEST_BODY_BYTES` → `failed` `payload-too-large`, không gọi API.
   - `cloudRevision` là `null` → `api.schemas.create({ id, document })`; ngược lại `api.schemas.update(id, { document, expectedRevision: cloudRevision })`. Ghi nhớ `updatedAt` của record lúc đọc.
   - Ánh xạ kết quả theo bảng spec: `200`, `201` → ghi kết quả đẩy; `synced` nếu `updatedAt` chưa đổi, ngược lại `changed-while-sending`. `409 revision-conflict` → đặt `conflict`, `api.schemas.get(id)`, trả `conflict` với bản cloud (`null` nếu lần `get` lỗi). `409 schema-id-unavailable` → `get(id)`: `200` và `documentsEqual` với tài liệu đã gửi → ghi kết quả đẩy với revision cloud, trả `synced`; `200` và khác → đặt `conflict`, trả `conflict` với bản đó; `404` → `failed` `schema-id-unavailable`; `get` lỗi khác → `retryable`. `404` khi `PUT` → đặt `deleted-in-cloud`. `403 schema-limit-reached`, `413`, `422` → `failed` với mã tương ứng; `422` có `documentErrors` chứa `version-unsupported` → `version-unsupported`. `http 401` (API client đã thử refresh) → `session-expired`, giữ `pending`. `429`, `5xx`, `network`, `timeout`, `invalid-response` → `retryable` kèm `retryAfterSeconds`.
3. `cloud-pusher.ts`:

   ```ts
   export type CloudPushState =
     | { readonly kind: "idle" }
     | { readonly kind: "sending" }
     | { readonly kind: "synced" }
     | { readonly kind: "waiting-retry"; readonly reason: "offline" | "server" }
     | { readonly kind: "session-expired" }
     | { readonly kind: "conflict"; readonly cloud: SchemaDetail | null }
     | { readonly kind: "deleted-in-cloud" }
     | { readonly kind: "failed"; readonly code: Extract<PushOutcome, { kind: "failed" }>["code"] };
   export type CloudPusher = {
     readonly requestPush: () => void;   // sau mỗi lần ghi cache thành công, "Thử lại", auth trở lại signed-in
     readonly getState: () => CloudPushState;
     readonly subscribe: (listener: (state: CloudPushState) => void) => () => void;
     readonly dispose: () => void;
   };
   export function createCloudPusher(input: {
     readonly api: ApiClient;
     readonly repository: SchemaRepository;
     readonly schemaId: string;
     readonly userId: string;
     readonly scheduler: RetryScheduler;
     readonly onlineEvents: { readonly subscribe: (listener: () => void) => () => void };
     readonly isOnline: () => boolean;
   }): CloudPusher;
   ```

   - Mỗi lúc một `pushSchemaOnce`. `requestPush` khi đang gửi chỉ đặt cờ; gửi xong mà cờ bật hoặc kết quả là `changed-while-sending` thì gửi thêm đúng một lần với tài liệu mới nhất. Không debounce.
   - `retryable`: `waiting-retry` với `reason` `offline` khi `isOnline()` false hoặc failure là `network`, ngược lại `server`; hẹn `nextRetryDelayMs`; `attempt` tăng mỗi lần, về 0 sau một lần thành công. Sự kiện `online` hoặc `requestPush` hủy hẹn giờ và gửi ngay.
   - `conflict`, `deleted-in-cloud`, `session-expired`: dừng đẩy; `requestPush` bị bỏ qua cho tới khi gọi `resume()` (thêm vào type `CloudPusher`: `readonly resume: () => void`). Task 30 gọi `resume` khi auth trở lại `signed-in`; Task 31 gọi sau khi người dùng chọn trong hộp thoại và record đã về `pending` hoặc `synced`. `resume` đặt `attempt` về 0 và gửi ngay. `failed`: không tự thử lại; `requestPush` (tài liệu đổi hoặc "Thử lại") gửi lại.
   - `not-pushable` → `idle`. `dispose` hủy hẹn giờ và bỏ đăng ký `online`; promise đang chạy xong thì không phát state nữa.
   - Mở hộp thoại, đổi auth sang `expired` và hiển thị trạng thái là việc của nơi dùng (Task 30, 31); pusher chỉ phát state.

**Test viết trước:**

- `retry-scheduler.test.ts`: `it.each` cho `nextRetryDelayMs` (2 s, 4 s, …, chặn ở 60 s); `waits at least Retry-After seconds`.
- `push-schema-once.test.ts` (`fake-indexeddb`, repository thật của Task 7, `fetchImpl` giả): `creates the schema when cloudRevision is null`; `updates with expectedRevision when cloudRevision is set`; `marks the record synced after a successful push`; `keeps the record pending when it changed while sending`; `marks conflict and loads the cloud version on revision-conflict`; `treats schema-id-unavailable with an equal cloud document as synced`; `marks conflict for schema-id-unavailable with a different cloud document`; `fails with schema-id-unavailable when the id belongs to another account`; `marks deleted-in-cloud on 404 for an update`; `it.each` cho `403`, `413`, `422` ra `failed` đúng mã; `reports version-unsupported for a 422 with that structural error`; `returns session-expired and keeps pending after a 401`; `it.each` cho `429`, `500`, `network`, `timeout`, `invalid-response` ra `retryable`; `does not call the API when the document exceeds the size limit`; `skips a guest record`.
- `cloud-pusher.test.ts` (scheduler giả ghi lại delay và cho chạy tay, `onlineEvents` giả): `sends one request at a time`; `sends the latest document once more after changes arrive while sending`; `retries after 2 seconds and doubles the delay up to 60 seconds`; `waits for Retry-After on 429`; `retries immediately on the online event`; `retries immediately when a new change is requested while waiting`; `stops pushing after a conflict`; `stops pushing after the session expires`; `pushes again after resume`; `does not retry a failed push until a new change`; `stops timers and listeners after dispose`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Xong khi:**

- Hàng `cloud-pusher` của bảng unit test frontend (spec mục 11) xanh: mỗi lúc một request, thay đổi đến khi đang gửi được gửi một lần ở cuối, mọi dòng của bảng kết quả, thời gian chờ và `Retry-After`, `online` thì thử ngay, vượt kích thước thì không gửi.
- Phần logic của tiêu chí ST-03 "mỗi lần lưu local được đẩy lên cloud với `expectedRevision`; offline thì hiện 'Chưa đồng bộ' và tự đẩy khi có mạng" (giao diện ở Task 30, tích hợp 2 ở Task 36).

**Commit:** `feat(frontend): add cloud pusher with revision checks and retries`

## Task 24: `uploadLocalSchemas`, `syncPendingSchemas`

**Mục tiêu:** đưa schema của khách lên tài khoản theo đúng quy trình từng bước, và đẩy nền các record `pending` của người dùng mà không mở hộp thoại (spec mục 7 "Đưa schema của khách lên cloud", "Đồng bộ nền", "Web Locks").

**Agent:** frontend-engineer. **Phụ thuộc:** Task 23. **Đợt:** 6.

**File sở hữu:** tạo `frontend/src/lib/sync/upload-local-schemas.ts`, `upload-local-schemas.test.ts`, `sync-pending-schemas.ts`, `sync-pending-schemas.test.ts`.

**Chữ ký và hành vi:**

Đọc, ghi IndexedDB qua method của `SchemaRepository` do Task 7 định nghĩa: đọc record bằng `readSchemaRecord`, tài liệu bằng `openSchema`; đổi chủ record sau `201` (hoặc sau `get` xác nhận) bằng `assignOwner` với `syncStatus` `synced` hoặc `conflict`, một transaction; đổi id ở ba bảng bằng `changeSchemaId`, một transaction; liệt kê record của người dùng bằng `listOwnedSchemas` rồi lọc `pending`. Khóa qua `SchemaLockManager.tryAcquire` (phần 3); mọi khóa lấy được nhả trong `finally`.

1. `upload-local-schemas.ts`:

   ```ts
   export type UploadSkipReason = "locked" | "unreadable" | "too-large" | "rejected"; // rejected: 413, 422
   export type UploadStopReason = "schema-limit-reached" | "unavailable";            // unavailable: network, timeout, 5xx, 429, invalid-response, 401
   export type UploadReport = {
     readonly uploadedIds: readonly string[];
     readonly skipped: readonly { readonly schemaId: string; readonly reason: UploadSkipReason }[];
     readonly stoppedBy: UploadStopReason | null;
     readonly notAttemptedIds: readonly string[];
     readonly movedIds: ReadonlyMap<string, string>; // id cũ -> id mới, chỉ có mục khi 409 rồi 404 buộc đổi id (Vấn đề 27)
   };
   export function uploadLocalSchemas(input: {
     readonly api: ApiClient;
     readonly repository: SchemaRepository;
     readonly lockManager: SchemaLockManager;
     readonly userId: string;
     readonly schemaIds: readonly string[];
     readonly heldLockSchemaId?: string; // editor đang giữ khóa (chạy từ toolbar)
     readonly generateId: () => string;  // crypto.randomUUID ở app, giả trong test
   }): Promise<UploadReport>;
   ```

   Lần lượt từng id, đúng các bước spec:
   1. `schemaId === heldLockSchemaId` thì dùng khóa đang có; ngược lại `tryAcquire`, `null` → `skipped` `locked`.
   2. Đọc và `parseSchemaDocument`; lỗi → `unreadable`. Kích thước serialize vượt `MAX_REQUEST_BODY_BYTES` → `too-large`. Record không còn là của khách → bỏ qua không ghi báo cáo.
   3. `create({ id, document })`: `201` → đổi chủ (`ownerId`, `cloudRevision`, `synced`) trong một transaction. `409 schema-id-unavailable` → `get(id)`: `200` và `documentsEqual` → đổi chủ `synced` với revision cloud; `200` khác → đổi chủ với `cloudRevision` của bản cloud và `conflict`; `404` → `generateId()`, đổi id ở ba bảng trong một transaction, ghi cặp `(id cũ, id mới)` vào `movedIds`, `create` lại đúng một lần với id mới (lần này lại `409` thì `skipped` `rejected`, xóa cặp vừa ghi khỏi `movedIds`). `403 schema-limit-reached` → `stoppedBy`; lỗi mạng, `5xx` và các lỗi tạm thời khác → `stoppedBy` `unavailable`; các id chưa xét vào `notAttemptedIds`, không đổi gì. `413`, `422` → `rejected`.
   - Bản ghi chỉ đổi chủ sau khi `POST` (hoặc `get` xác nhận) thành công. `uploadedIds` chứa id hiện có của schema sau khi upload (id mới nếu đã đổi id). Toast "Đã lưu N schema lên cloud", "M schema chưa lưu được" là việc của nơi gọi (Task 28, 30, 33) dựa trên `UploadReport`; nơi gọi cho một schema đang mở (Task 30) đọc `movedIds` để biết có phải điều hướng route hay không.
2. `sync-pending-schemas.ts`:

   ```ts
   export type SyncPendingReport = {
     readonly syncedIds: readonly string[];
     readonly lockedIds: readonly string[];
     readonly conflictIds: readonly string[];
     readonly deletedInCloudIds: readonly string[];
     readonly stoppedBy: "session-expired" | null;
   };
   export function syncPendingSchemas(input: {
     readonly api: ApiClient;
     readonly repository: SchemaRepository;
     readonly lockManager: SchemaLockManager;
     readonly userId: string;
   }): Promise<SyncPendingReport>;
   ```

   - Chỉ xét record có `ownerId === userId` và `syncStatus === "pending"`, đọc tại thời điểm gọi; lần lượt từng record: `tryAcquire`, `null` → `lockedIds` (tab giữ khóa tự đẩy); lấy được → `pushSchemaOnce` (Task 23) một lần.
   - Kết quả: `synced` → `syncedIds`; `changed-while-sending` không xảy ra khi đang giữ khóa, xử lý như `synced`; `conflict` → `conflictIds` (record đã được `pushSchemaOnce` đánh dấu, không mở hộp thoại); `deleted-in-cloud` → `deletedInCloudIds`; `session-expired` → dừng cả vòng, `stoppedBy`; `retryable`, `failed`, `not-pushable` → sang record kế tiếp, không hẹn giờ. Không có hẹn giờ chạy nền; nơi gọi (Task 28, 32, 34) quyết định lúc chạy.
   - Hai lời gọi đồng thời trong cùng tab không chạy chồng: lời gọi thứ hai trả promise của lời gọi đang chạy (theo `userId`).

**Test viết trước:**

- `upload-local-schemas.test.ts` (`fake-indexeddb`, repository thật, `createFakeLockRegistry`, `fetchImpl` giả): `uploads a guest schema and makes it owned and synced after 201`; `treats 409 with an equal cloud document as already uploaded`; `marks conflict for 409 with a different cloud document`; `moves the schema to a new id and creates it again after 409 then 404`; `reports the old and new id in movedIds when a schema is moved to a new id`; `leaves movedIds empty when no schema is moved`; `stops the whole run on schema-limit-reached and leaves remaining schemas unchanged`; `stops the whole run on a network failure`; `skips a schema rejected with 413 or 422 and continues` (`it.each`); `skips a schema whose lock is held by another tab`; `uses the lock already held by the editor`; `skips an unreadable document`; `skips a document over the size limit without calling the API`; `keeps the record as a guest schema when the request fails midway`; `releases every lock it acquired`.
- `sync-pending-schemas.test.ts`: `pushes only pending records of the signed-in user`; `ignores guest records and records of other accounts`; `skips a record whose lock is busy`; `marks conflict on revision-conflict without opening a dialog`; `records deleted-in-cloud on 404`; `stops after the session expires`; `continues after a retryable failure`; `shares one run between concurrent calls`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Xong khi:**

- Hàng `upload-local-schemas` và `sync-pending-schemas` của bảng unit test frontend (spec mục 11) xanh.
- Phần logic của tiêu chí ST-03 "Sau lần đăng nhập đầu tiên trên trình duyệt có schema local, người dùng được hỏi đưa schema nào lên cloud; schema không chọn vẫn ở lại trình duyệt" và ST-02 "Đăng nhập không làm mất schema trên trình duyệt" (hộp thoại ở Task 28, tích hợp 1 ở Task 35).

**Commit:** `feat(frontend): add guest schema upload and pending schema sync`

## Task 25: `signOut`, `forgetPreviousAccount`

**Mục tiêu:** đăng xuất chỉ báo thành công khi backend đã thu hồi phiên, rồi xóa mọi bản cache của tài khoản khỏi trình duyệt mà giữ schema của khách; đăng nhập tài khoản khác thì dọn cache đã đồng bộ của tài khoản trước (spec mục 7 "Đăng xuất", "Phiên hết hạn và đổi tài khoản", "Web Locks").

**Agent:** frontend-engineer. **Phụ thuộc:** Task 7, 20. **Đợt:** 5.

**File sở hữu:** tạo `frontend/src/lib/sync/sign-out.ts`, `sign-out.test.ts`, `forget-previous-account.ts`, `forget-previous-account.test.ts`.

**Chữ ký và hành vi:**

Không import `src/lib/auth/**` (Task 21 chạy cùng đợt): xóa cookie gợi ý và phát `signed-out` đi qua hàm được truyền vào. Đọc, xóa IndexedDB qua method của `SchemaRepository` do Task 7 định nghĩa: liệt kê record theo `ownerId` bằng `listOwnedSchemas`; xóa một schema ở ba bảng trong một transaction bằng `deleteSchema` (phần 3); xóa bản ghi `session` bằng `deleteSession`.

1. `sign-out.ts`:

   ```ts
   export const SIGN_OUT_LOCK_TIMEOUT_MS = 5_000;
   export type SignOutFailure = { readonly kind: "logout-failed"; readonly failure: ApiFailure };
   export function countUnsyncedSchemas(input: { readonly repository: SchemaRepository; readonly userId: string }): Promise<number>;
   export function signOut(input: {
     readonly api: ApiClient;
     readonly repository: SchemaRepository;
     readonly lockManager: SchemaLockManager;
     readonly userId: string;
     readonly clearAuthHint: () => void;
     readonly broadcastSignedOut: () => void;
     readonly createTimeoutSignal: (ms: number) => AbortSignal; // AbortSignal.timeout ở app, giả trong test
   }): Promise<Result<void, SignOutFailure>>;
   ```

   - `countUnsyncedSchemas`: số record có `ownerId === userId` và `syncStatus !== "synced"` (bước 1 của spec; hộp thoại cảnh báo là Task 34).
   - `signOut` theo bước 2–4 của spec, không tự hỏi người dùng:
     1. `api.auth.logout()`. Thất bại với `network`, `timeout`, `invalid-response`, `5xx`, `429` → trả `logout-failed`, không xóa gì, không phát gì. Ok (`204`) hoặc `http 401` → tiếp tục.
     2. `broadcastSignedOut()` để tab khác rời editor và nhả khóa.
     3. Với mỗi record của `userId` (đọc sau bước 2): `lockManager.acquire(id, createTimeoutSignal(SIGN_OUT_LOCK_TIMEOUT_MS))`; hết giờ (`AbortError`, `TimeoutError`) thì vẫn xóa; xóa ở ba bảng; nhả khóa nếu lấy được.
     4. Xóa bản ghi `session`, `clearAuthHint()`, trả ok.
   - Record của khách và của tài khoản khác không bị đụng. Chuyển về `/` và đặt auth `signed-out` là việc của nơi gọi (Task 26 nối, Task 34 hộp thoại).
2. `forget-previous-account.ts`:

   ```ts
   export function forgetPreviousAccount(input: {
     readonly repository: SchemaRepository;
     readonly lockManager: SchemaLockManager;
     readonly previousUserId: string;
   }): Promise<{ readonly removedIds: readonly string[]; readonly keptIds: readonly string[] }>;
   ```

   - Chỉ xóa record `synced` của `previousUserId` (cloud đã có), mỗi record trong khóa lấy bằng `tryAcquire`; khóa bận thì giữ lại record đó (vào `keptIds`). Record `pending`, `conflict`, `deleted-in-cloud` giữ nguyên và ẩn (danh sách và đồng bộ đã lọc theo người dùng hiện tại, Task 22, 24). Không đụng bản ghi `session`: Task 21 thay nó sau khi hàm này xong. Cách xử lý khóa bận ở đây là chi tiết cài đặt của plan, spec không quy định.

**Test viết trước:**

- `sign-out.test.ts` (`fake-indexeddb`, repository thật, `createFakeLockRegistry`, `fetchImpl` giả):
  - `counts owned records that are not synced`.
  - `does not delete anything when logout fails with a network error`; `does not clear the hint or broadcast when logout fails`.
  - `continues when logout returns 401`.
  - `deletes only the records of the account from all three tables`; `keeps guest schemas and schemas of other accounts`.
  - `deletes the session record and clears the hint after a successful logout`; `broadcasts signed-out before deleting records`.
  - `waits for a held schema lock before deleting the record`; `deletes the record anyway when the lock wait times out`.
- `forget-previous-account.test.ts`: `removes synced records of the previous account`; `keeps pending, conflict and deleted-in-cloud records`; `keeps a synced record whose lock is held`; `leaves guest records untouched`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Xong khi:**

- Hàng `sign-out` của bảng unit test frontend (spec mục 11) xanh: `logout` lỗi mạng thì không xóa gì; thành công thì chỉ xóa record của tài khoản ở ba bảng, giữ schema của khách, xóa `session` và hint.
- Phần logic của tiêu chí ST-02 "Đăng nhập và đăng xuất" phía frontend và của hành trình tích hợp 6 (hộp thoại ở Task 34, tích hợp ở Task 36).

**Commit:** `feat(frontend): add sign-out cache cleanup and account switch cleanup`

## Task 26: Provider API client và auth, hint phía server, `AccountMenu`, `SignInPrompt`

**Mục tiêu:** app có một API client và một auth store cho mỗi tab, đưa qua context; layout gốc đọc `sf-auth-hint` để header không nháy; có `AccountMenu` bốn trạng thái và `SignInPrompt` dùng lại cho phần 5, 8 (spec mục 1 "Frontend biết ai đang đăng nhập", mục 6 "API client" đoạn `AppProviders`, "Auth store", "Header và lời mời đăng nhập").

**Agent:** frontend-engineer. **Phụ thuộc:** Task 19, 21, 25. **Đợt:** 6.

**File sở hữu:**

- Tạo: `frontend/src/components/auth-provider.tsx`, `auth-provider.test.tsx`, `account-menu.tsx`, `account-menu.test.tsx`, `sign-in-prompt.tsx`, `sign-in-prompt.test.tsx`; `frontend/src/lib/auth/request-auth-hint.ts`, `request-auth-hint.test.ts`.
- Sửa: `frontend/src/components/app-providers.tsx`, `app-providers.test.tsx`; `frontend/src/app/layout.tsx`.
- Sửa (chỉ thêm key): `frontend/src/lib/i18n/locales/{en,vi}/auth/account-menu.ts`, `auth/sign-in-prompt.ts`.

**Chữ ký và hành vi:**

1. `request-auth-hint.ts` (cùng khuôn `src/lib/i18n/request-locale.ts`, chỉ Server Component gọi): `export async function getRequestAuthHint(): Promise<boolean>` đọc `cookies()` và trả `parseAuthHint(cookieStore.get(AUTH_HINT_COOKIE_NAME)?.value)`.
2. `layout.tsx`: thêm `getRequestAuthHint()` vào `Promise.all` sẵn có, truyền `hasAuthHint` cho `AppProviders`. Không đổi phần theme, nonce.
3. `auth-provider.tsx`:

   ```ts
   export type AuthProviderDependencies = {
     readonly fetchImpl: typeof fetch;
     readonly authLockManager: AuthLockManager;
     readonly openChannel: (name: string) => BroadcastChannelLike;
     readonly cookieJar: Pick<Document, "cookie">;
   };
   export type AuthProviderProps = {
     readonly hasAuthHint: boolean;
     readonly dependencies?: AuthProviderDependencies; // test truyền bản giả; app dựng bản trình duyệt trong effect
     readonly children: ReactNode;
   };
   export function AuthProvider(props: AuthProviderProps): JSX.Element;
   export function useApiClient(): ApiClient;
   export function useAuth<T>(selector: (state: AuthStoreState) => T): T;
   export function useInitialAuthHint(): boolean;
   export function useSignOut(): () => Promise<Result<void, SignOutFailure>>;
   ```

   - Nằm bên trong `StorageProvider` (phần 3). Dựng một lần mỗi tab (trong effect, không chạy trên server): `createRawAuthCalls`, `createSessionRefresher`, `createApiClient` với `baseUrl` là URL backend Task 6 thêm vào `src/lib/env.ts`, `onSessionExpired` gọi `markSessionExpired` của store qua biến đóng; `createAuthStore` với `createAuthHintCookie({ cookieJar, isSecure: env.isProduction })`, `createAuthChannel(openChannel)`, `SessionStore` với `read` là `repository.readSession()` và `write` là `repository.writeSession({ userId, email })` (Task 7), `onAccountChanged` gọi `forgetPreviousAccount` (Task 25). Gọi `initialize()` sau khi dựng. Unmount: `channel.close()`.
   - Storage `pending`: chưa dựng store, `useAuth` thấy trạng thái `unknown`. Storage `unavailable`: `SessionStore` đọc trả `null`, ghi không làm gì, `onAccountChanged` không làm gì.
   - `useSignOut` ghép `AuthActions.signOut` của spec: gọi `signOut` (Task 25) với `userId` của trạng thái `signed-in` (hoặc `expired.lastUser`), `clearAuthHint` là `hintCookie.clear`, `broadcastSignedOut` là `channel.post({ type: "signed-out" })`, `createTimeoutSignal` là `AbortSignal.timeout`; ok thì `markSignedOut()`. Không có người dùng thì chỉ `markSignedOut()`.
   - Mọi hook ném `Error` khi dùng ngoài `AuthProvider`, như `useStorage`.
   - `AppProviders` import `@/lib/zod-config` đầu tiên (sẵn có), nên schema Zod của `@schemaforge/api-contract` được tạo sau cấu hình `jitless`.
4. `app-providers.tsx`: nhận thêm prop `hasAuthHint`; thứ tự `I18nProvider` > `ThemeProvider` > `TooltipProvider` > `StorageProvider` > `AuthProvider` > `SignInPromptProvider` > `children`, `AppToaster`. Task 28 thêm hai host sau `children`.
5. `account-menu.tsx`: `export function AccountMenu(): JSX.Element`. Theo bảng spec mục 6:
   - `unknown`: `useInitialAuthHint()` false thì hiện ngay link "Đăng nhập" (khách không thấy khung giữ chỗ); true thì khung `Skeleton` cùng kích thước, `aria-hidden`, không chữ.
   - `signed-out`: `Link` tới `buildAuthHref("/sign-in", đường dẫn hiện tại)`.
   - `signed-in`: `DropdownMenu` (`components/ui`) với nút hiện email, `aria-label` `accountMenu.menuLabel`; mục "Đăng xuất" gọi `useSignOut()`; `logout-failed` thì toast lỗi `sync:signOutDialog.signOutFailed` qua `useNotify`. Hộp thoại cảnh báo thay đổi chưa đồng bộ là Task 34.
   - `expired`: `Link` "Đăng nhập lại" có icon cảnh báo (`lucide-react`, `aria-hidden`) tới `/sign-in` kèm `returnTo`.
   - Đường dẫn hiện tại lấy trong event handler hoặc từ `usePathname()`; không dùng `useSearchParams` (tránh Suspense bắt buộc). Target ≥ 24×24 CSS px; màu qua token.
   - Task này chỉ tạo component; Task 30 gắn vào toolbar editor (`editor-toolbar.tsx`), Task 32 gắn vào header danh sách (`schema-list-screen.tsx`), vì hai task đó sở hữu các file này. Task 34 thay mục "Đăng xuất" bằng luồng có hộp thoại.
6. `sign-in-prompt.tsx`:

   ```ts
   export type SignInPromptReason = "cloudSave" | "cloudSchema"; // phần 5 thêm "ai", phần 8 thêm "share", "versionHistory"
   export function SignInPromptProvider(props: { readonly children: ReactNode }): JSX.Element;
   export function useSignInPrompt(): { readonly requireSignIn: (reason: SignInPromptReason) => boolean };
   ```

   - `requireSignIn`: auth `signed-in` → trả `true`, không mở gì. Trạng thái khác → mở `Dialog` ("Tính năng này cần tài khoản", mô tả `signInPrompt.reasons.<reason>`), trả `false`. Nút "Đăng nhập", "Tạo tài khoản" là `Link` tới `buildAuthHref(…, window.location.pathname + window.location.search)` đọc lúc mở; "Để sau" đóng. Đóng thì focus về phần tử đã mở hộp thoại (mặc định của Radix, không chặn `onCloseAutoFocus`).

**Test viết trước:**

- `request-auth-hint.test.ts` (mock `next/headers` như `request-locale.test.ts`): `returns true when the hint cookie is 1`; `returns false when the cookie is missing or has another value`.
- `auth-provider.test.tsx` (dependencies giả, `fetchImpl` `vi.fn`, `fake-indexeddb`): `does not call fetch when there is no hint cookie`; `calls me once when the hint cookie is present`; `marks the session expired when a schema request cannot refresh`; `signs out, clears the hint and becomes signed-out`; `keeps the signed-in state when logout fails`; `throws when useAuth is used outside the provider`.
- `account-menu.test.tsx`: `shows a sign-in link at once for a guest while auth is unknown`; `shows a sized placeholder without text while a hinted session loads`; `shows the email and a sign-out item when signed in`; `shows a sign-in-again link with the return path when the session expired`; `shows an error toast when signing out fails`.
- `sign-in-prompt.test.tsx`: `opens the dialog and returns false when signed out`; `links sign-in and sign-up with the current path as returnTo`; `returns true without opening when signed in`; `closes on Later without calling fetch`; `returns focus to the trigger after closing`; `has no axe violations in light and dark themes` (`expectNoAxeViolations`).
- `app-providers.test.tsx`: thêm `provides the auth context to children`.

**Kiểm tra:** như "Quy ước chung" với `frontend`. Thêm: `pnpm --filter @schemaforge/frontend build` xanh (layout đọc cookie, không lỗi prerender).

**Xong khi:**

- Hàng `AccountMenu`, `SignInPrompt` của bảng component test (spec mục 11) xanh; axe trên `SignInPrompt` ở hai theme.
- Phần `SignInPrompt` của tiêu chí ST-02 "Khi chưa đăng nhập, 'Lưu lên cloud' mở `SignInPrompt`; đăng nhập xong quay về đúng trang qua `returnTo`…" (nút gọi ở Task 30, 33).
- Phần provider của tiêu chí ST-02 "Khách không có cookie gợi ý không gọi mạng lần nào…": test `does not call fetch when there is no hint cookie` xanh.
- Tiêu chí "Không có token trong `localStorage`, IndexedDB hay cookie đọc được bằng JavaScript": provider chỉ ghi `sf-auth-hint` và bản ghi `session` (`userId`, `email`).

**Commit:** `feat(frontend): add auth provider, account menu and sign-in prompt`

## Task 27: Màn hình `/sign-in`, `/sign-up`

**Mục tiêu:** hai màn hình đăng nhập, đăng ký dùng chung một form đạt WCAG 2.2 AA (3.3.7, 3.3.8, 2.5.8), kiểm tra phía client theo hằng của hợp đồng, báo lỗi server đã dịch mà không xóa giá trị đã nhập, rồi quay về `returnTo` đã làm sạch (spec mục 6 "Màn hình đăng nhập, đăng ký"; mục 2 "Quy tắc email và mật khẩu", "Thông báo lỗi và dò tài khoản").

**Agent:** frontend-engineer. **Phụ thuộc:** Task 26. **Đợt:** 7.

**File sở hữu:**

- Tạo: `frontend/src/app/(auth)/sign-in/page.tsx`, `page.test.tsx`; `frontend/src/app/(auth)/sign-up/page.tsx`, `page.test.tsx`.
- Tạo: `frontend/src/features/auth/components/credentials-form.tsx`, `credentials-form.test.tsx`, `sign-in-screen.tsx`, `sign-in-screen.test.tsx`, `sign-up-screen.tsx`, `sign-up-screen.test.tsx`; `frontend/src/features/auth/lib/validate-credentials.ts`, `validate-credentials.test.ts`; `frontend/src/features/auth/hooks/use-credentials-submit.ts`, `use-credentials-submit.test.tsx`.
- Sửa (chỉ thêm key): `frontend/src/lib/i18n/locales/{en,vi}/auth/sign-in.ts`, `auth/sign-up.ts`, `auth/credentials-form.ts`.

**Chữ ký và hành vi:**

1. Route (Server Component mỏng, `nextjs.md`):

   ```ts
   type AuthPageProps = { readonly searchParams: Promise<{ readonly returnTo?: string | readonly string[] }> };
   export async function generateMetadata(): Promise<Metadata>; // t("signIn.pageTitle", { appName: APP_NAME }) của namespace auth
   export default async function SignInPage({ searchParams }: AuthPageProps): Promise<JSX.Element>;
   ```

   `await searchParams`; `returnTo` là mảng thì lấy phần tử đầu; truyền `sanitizeReturnTo(returnTo)` cho `SignInScreen`. Không có Server Action, Route Handler hay gọi backend trên server. `/sign-up` giống vậy với `SignUpScreen`.
2. `validate-credentials.ts`:

   ```ts
   export type CredentialsFieldError =
     | { readonly field: "email"; readonly code: "required" | "invalid" | "too-long" }
     | { readonly field: "password"; readonly code: "too-short" | "too-long" };
   export function validateCredentials(input: { readonly email: string; readonly password: string }): readonly CredentialsFieldError[];
   ```

   Email: `trim()` rỗng → `required`; dài hơn `EMAIL_MAX_LENGTH` → `too-long`; không khớp dạng `local@domain` tối thiểu → `invalid` (backend vẫn là nơi kiểm tra cuối). Mật khẩu: độ dài tính trên `password.normalize("NFKC")` theo code point, dưới `PASSWORD_MIN_LENGTH` → `too-short`, trên `PASSWORD_MAX_LENGTH` → `too-long`. Hằng import từ `@schemaforge/api-contract`. Không kiểm tra danh sách mật khẩu phổ biến ở client (chỉ backend có danh sách).
3. `use-credentials-submit.ts`:

   ```ts
   export type CredentialsSubmitState =
     | { readonly kind: "idle" }
     | { readonly kind: "submitting" }
     | { readonly kind: "failed"; readonly failure: ApiFailure };
   export function useCredentialsSubmit(input: {
     readonly mode: "sign-in" | "sign-up";
     readonly returnTo: string;
   }): { readonly state: CredentialsSubmitState; readonly submit: (input: { readonly email: string; readonly password: string }) => Promise<void> };
   ```

   Gọi `signIn` hoặc `signUp` của store qua `useAuth`; đang `submitting` thì bỏ qua lần gửi thứ hai; ok → `router.replace(returnTo)`; lỗi → `failed`. Hộp thoại đưa schema của khách lên do Task 28 mở dựa trên `activeSignInCount`, hook này không gọi.
4. `credentials-form.tsx`:

   ```ts
   export type CredentialsFormProps = {
     readonly mode: "sign-in" | "sign-up";
     readonly initialEmail: string;
     readonly submitState: CredentialsSubmitState;
     readonly onSubmit: (input: { readonly email: string; readonly password: string }) => void;
   };
   export function CredentialsForm(props: CredentialsFormProps): JSX.Element;
   ```

   - `<form noValidate>`; `Label` gắn với mỗi ô qua `htmlFor`. Ô email `type="email"`, `name="email"`, `autoComplete="email"`. Ô mật khẩu `name="password"`, `autoComplete` là `"current-password"` ở `sign-in`, `"new-password"` ở `sign-up`; `id` cố định (`useId` một lần, không đổi theo render). Không `autoComplete="off"`, không handler `onPaste`, `onCopy` gọi `preventDefault`. `/sign-up` chỉ có một ô mật khẩu.
   - Nút hiện/ẩn mật khẩu: `type="button"`, `aria-pressed`, `aria-label` `credentialsForm.showPassword` hoặc `hidePassword`, `aria-controls` trỏ ô mật khẩu, kích thước tối thiểu 24×24 CSS px (`size-6` trở lên); bấm đổi `type` giữa `password` và `text` mà giữ giá trị và vị trí focus trên nút.
   - Gửi: `validateCredentials`; có lỗi thì hiện dưới từng ô (`aria-invalid="true"`, `aria-describedby` trỏ id của thông báo), focus ô lỗi đầu tiên, không gọi `onSubmit`. Hết lỗi thì `onSubmit`.
   - Giá trị ô là state của form, không bao giờ bị reset khi `submitState` đổi. `submitState.kind === "submitting"` → nút gửi `disabled` và nhãn `credentialsForm.submitting`.
   - `failed`: vùng `role="alert"` phía trên nút gửi hiện `t(toApiErrorMessageKey(failure), { ns: "apiErrors" })`; `validation-failed` có `fields` thì thêm lỗi dưới ô tương ứng (`path` `email`, `password`) bằng thông báo chung của `apiErrors.validation-failed`. Các mã `invalid-credentials`, `email-already-registered`, `password-too-common`, `too-many-requests` hiện đúng thông báo của mã.
   - Không CAPTCHA, không câu đố.
5. `sign-in-screen.tsx`, `sign-up-screen.tsx`: `export function SignInScreen(props: { readonly returnTo: string }): JSX.Element`. `main` có `h1`, `CredentialsForm`, dòng `signIn.noPasswordRecovery` (hoặc `signUp.noEmailVerification`), link sang màn hình kia giữ `returnTo` qua `buildAuthHref`. `initialEmail` ở `/sign-in` là `expired.lastUser.email` khi auth `expired`, ngược lại chuỗi rỗng. Auth đã `signed-in` **khi màn hình mount** (trước lần gửi nào) → `router.replace("/")`; sau khi gửi thành công thì chỉ `replace(returnTo)` của hook, không chuyển về `/`.

**Test viết trước:**

- `validate-credentials.test.ts`: `it.each` cho email rỗng, quá dài, sai dạng, hợp lệ; `measures password length after NFKC normalization`; `it.each` cho mật khẩu ngắn hơn tối thiểu, dài hơn tối đa, vừa biên.
- `use-credentials-submit.test.tsx`: `replaces the route with returnTo after a successful sign-in`; `ignores a second submit while submitting`; `exposes the failure when signing up fails`.
- `credentials-form.test.tsx`:
  - `labels the email and password fields`; `uses email and current-password autocomplete on sign-in`; `uses email and new-password autocomplete on sign-up`; `has a single password field on sign-up`.
  - `keeps a pasted password value` (`user.paste`); `toggles password visibility with aria-pressed and keeps the value`; `gives the visibility toggle at least a 24 pixel target` (kiểm tra class kích thước).
  - `shows field errors with aria-invalid and aria-describedby and does not submit`; `moves focus to the first invalid field`.
  - `it.each` cho `invalid-credentials`, `email-already-registered`, `password-too-common`, `too-many-requests`: `shows the translated message for <code> in an alert`.
  - `keeps both values after a server error`; `disables the submit button while submitting`.
- `sign-in-screen.test.tsx`: `prefills the email of the expired session`; `redirects a signed-in user to the list on mount`; `navigates to the sanitized returnTo after signing in`; `states that password recovery is not available`; `has no axe violations in light and dark themes`.
- `sign-up-screen.test.tsx`: `states that no email verification is needed`; `has no axe violations in light and dark themes`.
- `page.test.tsx` (hai route): `passes a sanitized returnTo to the screen` (`//evil.com` thành `/`); `uses the first returnTo when the parameter repeats`; `translates the page title`.

**Kiểm tra:** như "Quy ước chung" với `frontend`. Thêm: `pnpm --filter @schemaforge/frontend build` liệt kê route `/sign-in`, `/sign-up`.

**Xong khi:**

- Hàng `SignInScreen`, `SignUpScreen` của bảng component test và dòng axe cho hai màn hình auth (spec mục 11) xanh.
- Tiêu chí "Form đăng nhập, đăng ký đạt WCAG 2.2 AA theo mục 6: `autoComplete` đúng, dán được vào ô mật khẩu, không có ô nhập lại mật khẩu, lỗi từ server không xóa giá trị đã nhập, không có CAPTCHA (test component)"; phần "trình quản lý mật khẩu của Chrome lưu và điền được (kiểm tra tay)" thuộc Task 37.
- Phần giao diện của tiêu chí ST-02 "mật khẩu quá ngắn, quá dài, hoặc nằm trong danh sách phổ biến bị từ chối với thông báo đã dịch" và "đăng nhập xong quay về đúng trang qua `returnTo`, và `returnTo` trỏ ra ngoài bị bỏ qua".

**Commit:** `feat(frontend): add accessible sign-in and sign-up screens`

## Task 28: Hộp thoại đưa schema của khách lên, host đồng bộ nền

**Mục tiêu:** sau mỗi lần đăng nhập hoặc đăng ký chủ động, hỏi người dùng đưa schema nào của khách lên cloud; khi auth chuyển sang `signed-in` hoặc có mạng trở lại, đẩy nền các record `pending` (spec mục 7 "Đưa schema của khách lên cloud", "Đồng bộ nền"; mục 6 "Auth store" đoạn đăng nhập thành công, đoạn tab khác nhận `signed-out`).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 24, 26. **Đợt:** 7.

**File sở hữu:**

- Tạo: `frontend/src/components/upload-prompt-host.tsx`, `upload-prompt-host.test.tsx`, `upload-schemas-dialog.tsx`, `upload-schemas-dialog.test.tsx`, `background-sync-host.tsx`, `background-sync-host.test.tsx`.
- Sửa: `frontend/src/components/app-providers.tsx` (chỉ thêm `<UploadPromptHost />` và `<BackgroundSyncHost />` ngay sau `children`), `app-providers.test.tsx` (thêm test).
- Sửa (chỉ thêm key): `frontend/src/lib/i18n/locales/{en,vi}/sync/upload-dialog.ts`.

**Chữ ký và hành vi:**

1. `upload-schemas-dialog.tsx`:

   ```ts
   export type UploadCandidate = { readonly id: string; readonly name: string };
   export type UploadSchemasDialogProps = {
     readonly isOpen: boolean;
     readonly candidates: readonly UploadCandidate[];
     readonly isUploading: boolean;
     readonly onUpload: (schemaIds: readonly string[]) => void;
     readonly onLater: () => void;
   };
   export function UploadSchemasDialog(props: UploadSchemasDialogProps): JSX.Element;
   ```

   - `Dialog` của `components/ui` với tiêu đề `uploadDialog.title`, mô tả `uploadDialog.description` (schema không chọn vẫn ở trình duyệt, lưu lên sau được).
   - `fieldset` có `legend` `uploadDialog.listLabel`; mỗi schema một `Checkbox` có nhãn là tên schema; mở ra thì mọi checkbox được chọn. Nút "Lưu lên cloud" gọi `onUpload` với các id đang chọn theo thứ tự danh sách; không chọn id nào thì nút bị `disabled`. "Để sau", `Escape`, nút đóng gọi `onLater`.
   - `isUploading`: hai nút và checkbox `disabled`, `aria-busy` trên form.
2. `upload-prompt-host.tsx`: `export function UploadPromptHost(): JSX.Element | null`.
   - Theo dõi `activeSignInCount` qua `useAuth` (Task 21, 26). Mỗi lần giá trị tăng và storage `ready`: đọc `repository.listSchemas()`, lấy entry `readable` có `ownerId === null`; có ít nhất một thì mở hộp thoại với các schema đó. Giá trị lúc mount không mở hộp thoại (chỉ lần tăng sau mount). Không có schema của khách đọc được thì không mở.
   - `onUpload`: `uploadLocalSchemas` (Task 24) với `api` từ `useApiClient`, `repository`, `lockManager` của storage, `userId` của trạng thái `signed-in`, `generateId: () => crypto.randomUUID()`; xong thì đóng và toast qua `useNotify`: `uploadDialog.uploaded` với `count` là số id đã lưu (khi > 0); `uploadDialog.notUploaded` với `count` là `skipped.length + notAttemptedIds.length` (khi > 0). Hộp thoại tự đóng khi auth rời `signed-in`.
   - `onLater`: đóng, không gọi API, không ghi IndexedDB.
3. `background-sync-host.tsx`: `export function BackgroundSyncHost(): null`.
   - Khi auth chuyển sang `signed-in` (kể cả lần `initialize` đầu tiên) và storage `ready`: gọi `syncPendingSchemas` (Task 24) một lần.
   - Khi đang `signed-in`: lắng nghe `window` `online` và gọi lại; effect trả cleanup gỡ listener.
   - Auth rời `signed-in` (`signed-out` từ tab khác, `expired`): gỡ listener, không khởi động lượt mới; lượt đang chạy tự dừng ở `session-expired` hoặc kết thúc tự nhiên. Không có hẹn giờ chạy nền.
   - Kết quả chỉ ghi IndexedDB; không toast. Lỗi không dự kiến ghi `logger.error("sync.background-failed", { name })`, không ghi nội dung schema.
   - Lần chạy khi màn hình danh sách mount thuộc Task 32.

**Test viết trước:**

- `upload-schemas-dialog.test.tsx`: `lists every candidate with all checkboxes checked`; `uploads only the checked schemas`; `disables Save to cloud when nothing is checked`; `calls onLater without uploading when Later is pressed`; `disables the controls while uploading`; `has no axe violations in light and dark themes`.
- `upload-prompt-host.test.tsx` (`AuthProvider` và `StorageProvider` với dependencies giả, `fake-indexeddb`, `fetchImpl` giả):
  - `opens after an active sign-in when readable guest schemas exist`; `does not open on initialize or on a signed-in message from another tab`; `does not open when there are no guest schemas`.
  - `does not call fetch when Later is pressed`; `uploads the selected schemas and shows the uploaded count`; `shows the count of schemas that could not be uploaded`; `keeps unselected schemas as guest schemas`.
- `background-sync-host.test.tsx`: `syncs pending schemas when auth becomes signed-in`; `syncs again on the online event while signed in`; `does not sync while signed out`; `removes the online listener after signing out`.
- `app-providers.test.tsx`: thêm `mounts the upload prompt and background sync hosts`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Xong khi:**

- Hàng "Hộp thoại đưa schema lên" của bảng component test (liệt kê schema của khách, mặc định chọn hết; "Để sau" không gọi API) và dòng axe cho hộp thoại mới (spec mục 11) xanh.
- Phần giao diện của tiêu chí ST-03 "Sau lần đăng nhập đầu tiên trên trình duyệt có schema local, người dùng được hỏi đưa schema nào lên cloud; schema không chọn vẫn ở lại trình duyệt" và ST-02 "Đăng nhập không làm mất schema trên trình duyệt" (hành trình tích hợp 1 ở Task 35).
- Phần đồng bộ nền của tiêu chí ST-03 "offline thì hiện 'Chưa đồng bộ' và tự đẩy khi có mạng" cho schema không mở trong editor (tích hợp 2 ở Task 36).

**Commit:** `feat(frontend): add guest schema upload prompt and background sync`

## Task 29: Editor: luồng mở schema theo `decideOpenAction`

**Mục tiêu:** sau khi lấy được khóa schema, editor đọc bản cache, hỏi cloud khi cần, thực hiện đúng hành động của `decideOpenAction` trong khóa, và hiện đúng màn hình trạng thái; schema của khách mở như phần 3 và không gọi mạng; đăng xuất thì rời editor của schema thuộc tài khoản (spec mục 7 "Mở schema", "Web Locks", "Đăng xuất" bước 3 và 5; mục 6 "Auth store" đoạn tab nhận `signed-out`, "Header và lời mời đăng nhập" đoạn `cloudSchema`).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 22, 26. **Đợt:** 7.

**File sở hữu:**

- Sửa: `frontend/src/features/editor/components/editor-screen-loader.tsx`, `editor-screen.tsx`, `editor-screen.test.tsx`, `editor-status-screen.tsx`, `editor-status-screen.test.tsx`; `frontend/src/features/editor/hooks/use-open-schema.ts`, `use-open-schema.test.tsx`.
- Tạo: `frontend/src/features/editor/lib/fetch-cloud-schema.ts`, `fetch-cloud-schema.test.ts`; `frontend/src/features/editor/hooks/use-leave-on-sign-out.ts`, `use-leave-on-sign-out.test.tsx`.
- Sửa: `frontend/src/testing/mount-editor-journey.tsx`, `mount-editor-journey.test.tsx`, `render-with-providers.tsx`, `render-with-providers.test.tsx` (helper test của phần 3; task này là chủ duy nhất trong plan, xem [Điểm nóng](#điểm-nóng-khi-làm-song-song)).
- Sửa (chỉ thêm key): `frontend/src/lib/i18n/locales/{en,vi}/sync/open-schema.ts`.

**Chữ ký và hành vi:**

1. `fetch-cloud-schema.ts`:

   ```ts
   export type CloudFetchAttempt = { readonly kind: "result"; readonly result: CloudFetchResult } | { readonly kind: "session-expired" };
   export function fetchCloudSchema(api: ApiClient, schemaId: string): Promise<CloudFetchAttempt>;
   ```

   `get` ok → `found`; `http 404` → `not-found`; `http 401` (API client đã thử refresh và đã đặt auth `expired`) → `session-expired`; mọi failure khác (`network`, `timeout`, `invalid-response`, `5xx`, `429`) → `unavailable`.
2. `use-open-schema.ts`: giữ chữ ký sẵn có, thêm đầu vào và mở rộng `OpenSchemaState`:

   ```ts
   export type EditorCloudContext =
     | { readonly kind: "guest" }
     | {
         readonly kind: "owned";
         readonly userId: string;
         readonly followUp: "none" | "push-create" | "push-update" | "retry-when-online" | "wait-for-sign-in";
         readonly pendingDialog: null | { readonly kind: "conflict"; readonly cloud: SchemaDetail } | { readonly kind: "deleted-in-cloud" };
       };
   export type OpenSchemaState =
     | { readonly kind: "opening" }
     | { readonly kind: "not-found"; readonly shouldOfferSignIn: boolean }
     | { readonly kind: "needs-network" }
     | { readonly kind: "deleted-elsewhere" }
     | { readonly kind: "unreadable"; readonly isVersionUnsupported: boolean }
     | { readonly kind: "storage-error"; readonly errorCode: StorageErrorCode }
     | { readonly kind: "opened"; readonly document: SchemaDocument; readonly viewport: ViewportRecord | null; readonly cloud: EditorCloudContext };
   export type UseOpenSchemaInput = {
     readonly repository: SchemaRepository;
     readonly api: ApiClient;
     readonly auth: OpenAuthContext;
     readonly schemaId: string;
     readonly grantId: number | null;
     readonly attempt: number; // tăng khi bấm "Thử lại"
   };
   ```

   Trình tự trong một lần đọc (chỉ khi `grantId !== null`, tức đang giữ khóa):
   1. Đọc record bằng `readSchemaRecord` và tài liệu cache bằng `openSchema` của `SchemaRepository` (Task 7, phần 3).
   2. `shouldFetchCloud({ auth, cached })` true → `fetchCloudSchema`; `session-expired` → gọi lại `decideOpenAction` với `auth` `expired` (`lastUserId` là người vừa đăng nhập) và `cloud: null`. Ngược lại `cloud: null`.
   3. `decideOpenAction` rồi thực hiện, vẫn trong khóa: `open-cached` → mở bản cache như phần 3 (tài liệu cache không đọc được thì `unreadable` như phần 3); `store-cloud-and-open` → `writeCloudCopy` với `ownerId` là người dùng, `revision`, thời gian ISO của `detail` đổi sang epoch mili giây (record `synced`, tạo khi chưa có), rồi mở tài liệu đó; `open-cached-with-conflict` → `setSyncState` với `syncStatus` `conflict` (giữ `cloudRevision` của cache), mở cache, `pendingDialog` `conflict` kèm bản cloud; `open-cached-deleted-in-cloud` → `setSyncState` với `deleted-in-cloud`, mở cache, `pendingDialog` `deleted-in-cloud`; `delete-cache-deleted-elsewhere` → `deleteSchema` (ba bảng, một transaction), `deleted-elsewhere`; `not-found` → `not-found` kèm `shouldOfferSignIn`; `needs-network` → `needs-network`; `cloud-version-unsupported` → `unreadable` với `isVersionUnsupported: true`, không ghi cache.
   4. `cloud.kind` là `guest` khi record có `ownerId: null`, ngược lại `owned` với `followUp` của hành động (`none` cho `store-cloud-and-open` và hai trường hợp có hộp thoại).
   - Lỗi IndexedDB ở bất kỳ bước nào → `storage-error` như phần 3. Không có `await` nào sau khi hiệu lực của lần đọc đã bị hủy được phép đổi state (giữ cơ chế `isActive` và `KeyedOpenState` sẵn có, thêm `attempt` và `auth` vào khóa so sánh).
   - `auth` chỉ đổi lần đọc khi `status` đổi giữa `signed-out`, `signed-in`, `expired` hoặc `userId` đổi; mở rồi mà auth đổi thì không đọc lại (đẩy, hộp thoại, rời editor thuộc Task 30, 31 và bước 4 dưới).
3. `editor-screen-loader.tsx`: đọc `useAuth` (Task 26); khi auth còn `unknown` thì không mount `EditorScreen` động mà hiện `EditorSkeleton`, trạng thái `role="status"` vẫn báo đang mở. Không đổi phần `dynamic` và `zod-config`.
4. `use-leave-on-sign-out.ts`: `export function useLeaveOnSignOut(input: { readonly cloud: EditorCloudContext | null }): void`. `cloud.kind === "owned"` và auth chuyển sang `signed-out` → `router.replace("/")` (unmount editor nhả khóa của phần 3, để luồng đăng xuất ở tab khác xóa được record). Schema của khách không bị ảnh hưởng.
5. `editor-screen.tsx`: `LockedEditor` truyền `api` (`useApiClient`), `auth` (chuyển từ `useAuth` sang `OpenAuthContext`), `attempt` (state tăng khi "Thử lại") vào `useOpenSchema`; gọi `useLeaveOnSignOut`; ánh xạ state mới sang `EditorStatusScreen`; `opened` truyền thêm `cloud` cho `EditorWorkspace` chỉ khi Task 30 cần (Task 29 không sửa `editor-workspace.tsx`; `cloud` được giữ ở `LockedEditor` và đưa xuống ở Task 30).
6. `editor-status-screen.tsx`: thêm variant `"needs-network"` (tiêu đề `sync:openSchema.needsNetwork.title`, nút "Thử lại" gọi prop `onRetry` mới và nhận focus sau khi bấm như tiêu đề hiện nay) và `"deleted-elsewhere"` (`sync:openSchema.deletedElsewhere.title`); prop mới `signInHref?: string` hiện thêm link `sync:openSchema.notFoundSignIn` ở variant `not-found` khi có. `signInHref` là `buildAuthHref("/sign-in", "/schemas/<id>")`. Giữ kiểu khóa i18n đầy đủ như `STATUS_KEYS` hiện có.

**Test viết trước:**

- `fetch-cloud-schema.test.ts`: `maps a found schema`; `maps 404 to not-found`; `maps 401 to session-expired`; `it.each` cho `network`, `timeout`, `invalid-response`, `500`, `429` ra `unavailable`.
- `use-open-schema.test.tsx` (`fake-indexeddb`, repository thật, `fetchImpl` giả, `createFakeLockRegistry`):
  - `opens a guest schema without calling fetch`.
  - `stores the cloud document and opens it when there is no cache`; `shows not-found with a sign-in offer when there is no cache and the user is signed out`; `shows needs-network when there is no cache and the backend is unreachable`.
  - `opens a pending schema that was never created without calling fetch`; `replaces a synced cache that has an older revision`; `deletes a synced cache that was deleted in the cloud`.
  - `marks conflict and reports the conflict dialog for a newer cloud revision`; `marks deleted-in-cloud for a pending schema missing in the cloud`.
  - `opens the cache when the backend is unreachable`; `opens the cache and waits for sign-in when the session expired`; `does not overwrite the cache for a cloud document from a newer version`.
  - `reads again when attempt increases`; `does not read before the lock is granted`.
- `use-leave-on-sign-out.test.tsx`: `navigates to the list when an owned schema is open and auth becomes signed-out`; `stays for a guest schema`.
- `editor-status-screen.test.tsx`: `shows a retry button for needs-network and calls onRetry`; `shows the deleted elsewhere title`; `shows a sign-in link with returnTo on not-found when offered`; `has no axe violations for the new variants in light and dark themes`.
- `editor-screen.test.tsx`: `keeps the skeleton while auth is unknown`; `shows needs-network and opens after retry succeeds`.

**Kiểm tra:** như "Quy ước chung" với `frontend`. Các test phần 3 sẵn có của editor (`journeys/`, `use-open-schema`, `editor-screen`) vẫn xanh sau khi thêm `AuthProvider` giả vào cách render: `renderWithProviders` nhận thêm tùy chọn bọc `AuthProvider` với dependencies giả (mặc định: không có hint, `fetchImpl` ném lỗi nếu bị gọi), và `createJourneyEnvironment` dùng tùy chọn đó, nên journey của phần 3 không phải sửa khẳng định. Thêm test `wraps children in a signed-out auth provider without calling fetch` vào `render-with-providers.test.tsx`.

**Xong khi:**

- Hàng `decide-open-action` được dùng đúng trong editor: mọi dòng bảng "Mở schema" (spec mục 7) có test hook xanh.
- Phần editor của tiêu chí ST-03 "Mở được schema đã lưu từ thiết bị khác: database trống, đã đăng nhập, danh sách có schema từ cloud và mở ra đúng tài liệu" (tích hợp 4 ở Task 35).
- Phần editor của tiêu chí ST-02 "Khách không có cookie gợi ý không gọi mạng lần nào trong các hành trình của phần 3" (test `opens a guest schema without calling fetch`; tích hợp 7 ở Task 35) và "Editor và các tính năng không cần tài khoản vẫn dùng bình thường".

**Commit:** `feat(frontend): open schemas through cloud-aware open decisions`

## Task 30: Editor: `useCloudPusher`, trạng thái cloud trên toolbar, "Lưu lên cloud"

**Mục tiêu:** editor của schema có chủ tự đẩy tài liệu lên cloud sau mỗi lần ghi cache thành công, toolbar hiện trạng thái cloud theo bảng "Trạng thái trên toolbar", và schema của khách có nút "Lưu lên cloud" (spec mục 7 "Đẩy lên cloud", "Đưa schema của khách lên cloud"; mục 6 "Header và lời mời đăng nhập"; mục 11 "Frontend", dòng "Toolbar").

**Agent:** frontend-engineer. **Phụ thuộc:** 23, 24, 29. **Đợt:** 8.

**File sở hữu:**

- Tạo `frontend/src/features/editor/lib/to-cloud-status-view.ts`, `to-cloud-status-view.test.ts`.
- Tạo `frontend/src/features/editor/hooks/use-cloud-pusher.ts`, `use-cloud-pusher.test.tsx`.
- Tạo `frontend/src/features/editor/components/toolbar/cloud-status-badge.tsx`, `cloud-status-badge.test.tsx`.
- Sửa `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`, `editor-toolbar.test.tsx`.
- Sửa `frontend/src/features/editor/components/editor-workspace.tsx`, `editor-workspace.test.tsx`.
- Sửa `frontend/src/features/editor/components/editor-screen.tsx`, `editor-screen.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/sync/cloud-status.ts`, `frontend/src/lib/i18n/locales/vi/sync/cloud-status.ts` (file con của namespace `sync`, do Task 19 tạo và gắn vào `sync.ts`; chỉ thêm key).

**Dùng lại, không định nghĩa lại:** `CloudPusher` và `pushSchemaOnce` (Task 23), `uploadLocalSchemas` (Task 24), `useApiClient`, `useAuth`, `useSignInPrompt`, `AccountMenu` (Task 26), kết quả mở schema theo `decideOpenAction` (Task 29), method của `SchemaRepository` (Task 7). Tên method, kiểu trạng thái và tham số lấy đúng theo "Chữ ký và hành vi" của các task đó. Thiếu thứ task này cần (ví dụ `CloudPusher` không công bố trạng thái đang gửi, đang chờ thử lại kèm loại lỗi cuối, lỗi kèm mã) thì dừng và báo, không tự thêm vào file của task khác.

**Chữ ký và hành vi:**

- `to-cloud-status-view.ts`, hàm thuần:

  ```ts
  export type CloudStatusView =
    | { readonly kind: 'local-only' }
    | { readonly kind: 'synced' }
    | { readonly kind: 'syncing' }
    | { readonly kind: 'unsynced'; readonly reason: 'offline' | 'server-unreachable' }
    | { readonly kind: 'unsynced-session-expired' }
    | { readonly kind: 'conflict' }
    | { readonly kind: 'deleted-in-cloud' }
    | { readonly kind: 'failed'; readonly failure: CloudPushFailureCode };

  export function toCloudStatusView(input: {
    readonly ownerId: string | null;
    readonly syncStatus: SyncStatus | null;
    readonly pusher: CloudPushState; // kiểu trạng thái của Task 23
    readonly authStatus: AuthState['status'];
  }): CloudStatusView;
  export type CloudPushFailureCode = Extract<CloudPushState, { kind: 'failed' }>['code'];
  ```

  `CloudPushFailureCode` lấy đúng từ `CloudPushState` của Task 23: `payload-too-large`, `schema-limit-reached`, `document-invalid`, `version-unsupported`, `schema-id-unavailable`. Thứ tự ưu tiên, dòng đầu khớp thì trả:
  1. `ownerId` là `null` → `local-only`.
  2. `syncStatus` là `conflict` → `conflict`; `deleted-in-cloud` → `deleted-in-cloud`.
  3. `pusher.kind` là `failed` → `failed` kèm `pusher.code`.
  4. `syncStatus` là `pending` và `authStatus` là `expired`, hoặc `pusher.kind` là `session-expired` → `unsynced-session-expired`.
  5. `pusher.kind` là `sending` → `syncing`.
  6. `pusher.kind` là `waiting-retry`: `reason` `offline` → `unsynced` lý do `offline`; `reason` `server` → `unsynced` lý do `server-unreachable`.
  7. `syncStatus` là `synced` → `synced`.
  8. Còn lại (`pending`, pusher chưa gửi) → `syncing`, vì lần đẩy đã được kích hoạt.
- `use-cloud-pusher.ts`:

  ```ts
  export type UseCloudPusherInput = {
    readonly store: EditorStore;
    readonly repository: SchemaRepository;
    readonly apiClient: ApiClient;
    readonly schemaId: string;
    readonly ownerId: string | null;
    readonly scheduler?: RetryScheduler; // kiểu của Task 23; mặc định lấy từ RetrySchedulerContext
  };
  export type CloudPusherControls = {
    readonly status: CloudStatusView;
    readonly retry: () => void;   // CloudPusher.requestPush
    readonly resume: () => void;  // CloudPusher.resume (Task 23), dùng sau conflict, deleted-in-cloud, session-expired
  };
  export const RetrySchedulerContext: React.Context<RetryScheduler>; // mặc định createBrowserRetryScheduler()
  export function useCloudPusher(input: UseCloudPusherInput): CloudPusherControls;
  ```

  - `ownerId` là `null`: không tạo `CloudPusher`, không gọi `apiClient`, `status` là `local-only`.
  - `ownerId` khác `null`: tạo một `CloudPusher` bằng `createCloudPusher({ api: apiClient, repository, schemaId, userId: ownerId, scheduler, onlineEvents, isOnline })` trong `useEffect` (dependency `store`, `repository`, `apiClient`, `schemaId`, `ownerId`, `scheduler`), `dispose` trong cleanup; sau unmount không gửi gì thêm (khóa schema đã nhả, như `useAutosave`). `scheduler` là `input.scheduler` nếu có, ngược lại giá trị của `RetrySchedulerContext` (Task 35 bọc context này bằng scheduler thủ công). `onlineEvents` bọc `window` `online` (pusher tự đăng ký và gỡ); `isOnline` là `() => navigator.onLine`.
  - Kích hoạt đẩy (spec mục 7): `store.subscribe` thấy `saveStatus.kind` chuyển sang `saved` → `requestPush()`; sự kiện `online` do pusher tự xử lý qua `onlineEvents`, hook không đăng ký thêm listener; `retry()` → `requestPush()`; `useAuth((state) => state.auth.status)` chuyển từ khác sang `signed-in` → `resume()` (Task 23: pusher đã dừng ở `session-expired` bỏ qua `requestPush` cho tới khi `resume`).
  - `syncStatus` đọc live qua `useLiveQuery` trên `repository.readSchemaRecord(schemaId)` (Task 7), để thay đổi do hộp thoại (Task 31) hay tab khác ghi hiện ngay.
  - Trạng thái auth thành `signed-out` trong khi `ownerId` khác `null`: `dispose` pusher. Rời editor là việc của `useLeaveOnSignOut` (Task 29), hook này không điều hướng. Schema của khách giữ nguyên editor.
- `cloud-status-badge.tsx`:

  ```ts
  export type CloudStatusBadgeProps = {
    readonly status: CloudStatusView;
    readonly onRetry: () => void;
    readonly onSaveToCloud: () => void;
    readonly onOpenCloudDialog: (kind: 'conflict' | 'deleted-in-cloud', trigger: HTMLElement) => void;
  };
  ```

  | `status.kind` | Chữ (namespace `sync`, file con `cloud-status`) | Nút |
  |---|---|---|
  | `local-only` | "Chỉ lưu trên trình duyệt này" | "Lưu lên cloud" → `onSaveToCloud` |
  | `synced` | "Đã lưu lên cloud" | — |
  | `syncing` | "Đang đồng bộ…" | — |
  | `unsynced` | "Chưa đồng bộ" kèm lý do "mất mạng" hoặc "máy chủ không phản hồi" | — |
  | `unsynced-session-expired` | "Chưa đồng bộ, hãy đăng nhập lại" | — |
  | `conflict` | "Xung đột" | "Giải quyết" → `onOpenCloudDialog('conflict', trigger)` |
  | `deleted-in-cloud` | "Đã bị xóa trên cloud" | "Xem lựa chọn" → `onOpenCloudDialog('deleted-in-cloud', trigger)` |
  | `failed` | "Không đồng bộ được" kèm thông báo `apiErrors:<mã>`; riêng `version-unsupported` dùng `sync:cloudStatus.versionUnsupported` (không phải `ApiErrorCode`) | "Thử lại" → `onRetry` |

  - Vùng `role="status"` luôn mount (như `SaveStatusBadge`), chỉ có chữ khi `unsynced`, `unsynced-session-expired`, `conflict`, `deleted-in-cloud`, `failed`; `syncing` và `synced` không được đọc để khỏi ngắt người dùng ở mỗi lần đẩy.
  - Màu chữ chỉ qua token theme (`text-muted-foreground`, `text-destructive`); nút dùng `Button` `size="sm"`, cao tối thiểu 24 CSS px.
- `editor-toolbar.tsx`: props thêm `cloud: CloudStatusBadgeProps`. `saveStatus.kind` là `failed` thì chỉ hiện `SaveStatusBadge` (lỗi ghi local như phần 3); ngược lại hiện `CloudStatusBadge` ở đúng vị trí của `SaveStatusBadge` (spec mục 7 "Trạng thái trên toolbar"; Vấn đề 16). Gắn `AccountMenu` (Task 26) vào toolbar: đặt trong nhóm `ml-auto`, ngay trước `ThemeSwitch` sẵn có.
- `editor-workspace.tsx`: props thêm `ownerId: string | null`, `apiClient: ApiClient`. Workspace giữ `ownerId` trong state khởi tạo từ props; gọi `useCloudPusher` cạnh `useAutosave`; giữ state `cloudDialog: { kind: 'conflict' | 'deleted-in-cloud'; trigger: HTMLElement | null } | null` (Task 31 render hộp thoại từ state này; task này chỉ đặt state). `onSaveToCloud`: `requireSignIn('cloudSave')` trả `false` thì dừng; `true` thì `uploadLocalSchemas({ api: apiClient, repository, lockManager, userId, schemaIds: [schemaId], heldLockSchemaId: schemaId, generateId: () => crypto.randomUUID() })` (Task 24; dùng khóa editor đang giữ, spec mục 7 bước 1). Đọc `report.movedIds.get(schemaId)` (Vấn đề 27) trước: khác `undefined` (id đã đổi vì `409` rồi `404`) thì `router.replace` (`useRouter` của `next/navigation`) sang `/schemas/<id mới>`, không đặt `ownerId` state ở workspace cũ (unmount do đổi route tự nhả khóa, trang mới tại id mới tự mở và tạo pusher qua `editor-screen.tsx`/`use-open-schema`); `report.uploadedIds` chứa `schemaId` (không đổi id) thì đặt `ownerId` state thành `userId`, nên pusher được tạo; kết quả khác hiện toast `sync:uploadDialog.notUploaded` với `count: 1`.
- `editor-screen.tsx`: lấy `apiClient` qua `useApiClient()`; truyền `ownerId` suy từ `cloud` của state `opened` (Task 29: `cloud.kind === 'owned'` thì `cloud.userId`, ngược lại `null`) vào `EditorWorkspace`. Không đổi luồng mở của Task 29.

**Test viết trước:**

- `to-cloud-status-view.test.ts` (`it.each` theo thứ tự ưu tiên): `returns local-only for a guest schema whatever the pusher state`; `returns conflict before a pusher failure`; `returns deleted-in-cloud before a pusher failure`; `returns failed with the error code`; `returns unsynced-session-expired for a pending schema while the session is expired`; `returns syncing while a request is in flight`; `returns unsynced offline while waiting to retry after a network failure`; `returns unsynced server-unreachable while waiting to retry after a timeout, 5xx or 429`; `returns synced for a synced record`; `returns syncing for a pending record before the first push`.
- `use-cloud-pusher.test.tsx` (`fake-indexeddb`, `fetchImpl` giả qua `createApiClient`, scheduler giả): `does not call the api for a guest schema`; `pushes the document after autosave reports saved`; `sends one more push when a change arrives during a request`; `pushes immediately on the online event`; `resumes pushing when the auth status returns to signed-in`; `retry pushes the latest document`; `exposes resume from the cloud pusher`; `uses the scheduler from RetrySchedulerContext`; `sends nothing after unmount`; `disposes the pusher when the auth status becomes signed-out for an owned schema`.
- `cloud-status-badge.test.tsx`: `shows a translated label for every cloud status` (`it.each` cho `vi` và `en`); `announces a conflict in the status region`; `does not announce syncing or synced`; `calls onSaveToCloud from Save to cloud`; `calls onOpenCloudDialog with conflict from Resolve`; `calls onOpenCloudDialog with deleted-in-cloud from View options`; `calls onRetry from the failed state`; `has no axe violations in the light and dark themes` (`expectNoAxeViolations`).
- `editor-toolbar.test.tsx`: `shows the local save failure instead of the cloud status`; `shows the cloud status when the local save succeeded`; `renders the account menu`.
- `editor-workspace.test.tsx`: `opens the sign-in prompt from Save to cloud when signed out`; `uploads the schema with the held lock when signed in and starts pushing`; `navigates to the new schema route when the upload moved the schema to a new id`; `stores the requested cloud dialog kind`.
- `editor-screen.test.tsx`: `passes the owner of the opened schema to the workspace` (kiểm qua hành vi: schema có chủ hiện "Đã lưu lên cloud", schema của khách hiện "Chỉ lưu trên trình duyệt này").

**Kiểm tra:** như "Quy ước chung" với `frontend`. Các test sẵn có của phần 3 trong `features/editor/journeys/` phải pass không sửa.

**Commit:** `feat(frontend): push owned schemas to the cloud from the editor`

**Xong khi:**

- ST-03 "Sau khi đăng nhập, mỗi lần lưu local được đẩy lên cloud với `expectedRevision`; offline thì hiện "Chưa đồng bộ" và tự đẩy khi có mạng": phần editor xong ở task này; tích hợp 2 ở Task 36 xác nhận đầu cuối.
- ST-02 "Khi chưa đăng nhập, "Lưu lên cloud" mở `SignInPrompt` … Editor và các tính năng không cần tài khoản vẫn dùng bình thường": phần toolbar (test `opens the sign-in prompt from Save to cloud when signed out`; journeys phần 3 vẫn xanh).
- Bảo mật và chung "Mọi chuỗi mới có `vi` và `en`": key của `sync/cloud-status` ở cả hai locale, typecheck qua.

## Task 31: Editor: hộp thoại xung đột, hộp thoại bị xóa trên cloud

**Mục tiêu:** khi `syncStatus` là `conflict` hoặc `deleted-in-cloud`, editor mở hộp thoại cho người dùng chọn, và mỗi lựa chọn cho đúng kết quả ở spec mục 7 "Xung đột" (kể cả mount lại store khi dùng bản cloud); spec mục 11 "Frontend", dòng "Hộp thoại xung đột, hộp thoại bị xóa trên cloud" và "Accessibility".

**Agent:** frontend-engineer. **Phụ thuộc:** 30. **Đợt:** 9.

**File sở hữu:**

- Tạo `frontend/src/features/editor/lib/summarize-schema-version.ts`, `summarize-schema-version.test.ts`.
- Tạo `frontend/src/features/editor/hooks/use-cloud-resolution.ts`, `use-cloud-resolution.test.tsx`.
- Tạo `frontend/src/features/editor/components/dialogs/conflict-dialog.tsx`, `conflict-dialog.test.tsx`.
- Tạo `frontend/src/features/editor/components/dialogs/deleted-in-cloud-dialog.tsx`, `deleted-in-cloud-dialog.test.tsx`.
- Sửa `frontend/src/features/editor/components/editor-workspace.tsx`, `editor-workspace.test.tsx`.
- Sửa `frontend/src/features/editor/components/editor-screen.tsx`, `editor-screen.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/{en,vi}/sync/conflict-dialog.ts` và `frontend/src/lib/i18n/locales/{en,vi}/sync/deleted-in-cloud-dialog.ts` (file con do Task 19 tạo; chỉ thêm key).

**Dùng lại:** `CloudPusherControls`, state `cloudDialog` và prop `onOpenCloudDialog` (Task 30); `ApiClient.schemas.get` (Task 20); method của `SchemaRepository` (Task 7): `writeCloudCopy` để ghi bản cloud vào cache với `synced` và `cloudRevision`, `setSyncState` để đặt `cloudRevision`, `syncStatus`, `readSchemaRecord` để đọc `ownerId`, `cloudRevision` hiện tại; `deleteSchema` sẵn có (xóa ba bảng trong một transaction); `parseSchemaDocument` của core; `useNotify`. Thiếu method thì dừng và báo.

**Chữ ký và hành vi:**

- `summarize-schema-version.ts`:

  ```ts
  export type SchemaVersionSummary = {
    readonly updatedAt: number; // epoch ms
    readonly tableCount: number;
    readonly columnCount: number;
  };
  export function summarizeSchemaVersion(document: SchemaDocument, updatedAt: number): SchemaVersionSummary;
  ```

  Đếm khóa của `document.tables` và `document.columns`. Thời điểm của bản cloud là `Date.parse(detail.updatedAt)`; của bản trên máy là `updatedAt` của record.
- `use-cloud-resolution.ts`:

  ```ts
  export type CloudVersionState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'loaded'; readonly revision: number; readonly document: SchemaDocument; readonly summary: SchemaVersionSummary }
    | { readonly kind: 'version-unsupported' }
    | { readonly kind: 'failed'; readonly failure: ApiFailure };

  export type CloudResolution = {
    readonly cloudVersion: CloudVersionState;
    readonly isBusy: boolean;
    readonly reloadCloudVersion: () => void;
    readonly keepLocal: () => Promise<void>;
    readonly adoptCloudVersion: () => Promise<void>;
    readonly recreateInCloud: () => Promise<void>;
    readonly removeFromBrowser: () => Promise<void>;
  };
  export function useCloudResolution(input: {
    readonly schemaId: string;
    readonly isConflictOpen: boolean;
    readonly repository: SchemaRepository;
    readonly apiClient: ApiClient;
    readonly pusher: CloudPusherControls;
    readonly onReplaceDocument: (document: SchemaDocument) => void;
    readonly navigate: (href: string) => void;
  }): CloudResolution;
  ```

  - Khi `isConflictOpen` chuyển sang `true`: `apiClient.schemas.get(schemaId)`. `200` thì `parseSchemaDocument`; lỗi `version-unsupported` thì `cloudVersion` là `version-unsupported` và không ghi gì vào cache (spec mục 7 "Mở schema"); lỗi cấu trúc khác cũng không ghi cache, trạng thái `failed` với `invalid-response`. `404` thì `setSyncState` với `syncStatus` `deleted-in-cloud`, giữ `cloudRevision` hiện tại (hộp thoại xung đột đóng, hộp thoại bị xóa mở qua state của Task 30). Lỗi mạng, `5xx`, `timeout` thì `failed`.
  - `keepLocal`: `setSyncState` với `cloudRevision` là `revision` của bản cloud vừa tải và `syncStatus` `pending` (một transaction), rồi `pusher.resume()` (pusher đã dừng sau `conflict`, Task 23), nên tài liệu mới nhất được gửi (spec: "luôn đẩy tài liệu mới nhất"). Kết quả `200` thì `synced` và hộp thoại đóng. Lại `409` thì pusher (Task 23) đặt lại `conflict`; hook tải lại bản cloud và hộp thoại hiện lại.
  - `adoptCloudVersion`: `writeCloudCopy` với bản cloud vừa tải (`ownerId` của record, `revision`, `createdAt` và `updatedAt` đổi sang epoch mili giây; record thành `synced`) trong khi editor vẫn giữ khóa, rồi `pusher.resume()`, rồi `onReplaceDocument(document)` và toast `success` "Đã chuyển sang bản trên cloud".
  - `recreateInCloud`: `setSyncState` với `cloudRevision: null`, `syncStatus: 'pending'` (một transaction), rồi `pusher.resume()` (gửi `POST` với cùng id).
  - `removeFromBrowser`: `repository.deleteSchema(schemaId)`, rồi `navigate("/")`.
  - `isBusy` là `true` trong lúc một lựa chọn đang chạy; nút của hộp thoại bị disable khi `isBusy`.
- `conflict-dialog.tsx`: `AlertDialog`, tiêu đề "Schema đã được sửa ở nơi khác". Hai cột "Bản trên máy này" và "Bản trên cloud", mỗi cột có thời điểm sửa gần nhất (định dạng `Intl.DateTimeFormat` theo ngôn ngữ, như dòng danh sách), số bảng và số cột (plural i18next). `cloudVersion` là `loading` thì cột cloud là `Skeleton` kèm chữ ẩn "Đang tải bản trên cloud"; `failed` thì thông báo `apiErrors:<mã>` trong `role="alert"` và nút "Thử lại" gọi `reloadCloudVersion`; `version-unsupported` thì thông báo tải lại trang của phần 3 và nút "Dùng bản trên cloud" bị disable. Hai nút "Giữ bản trên máy này", "Dùng bản trên cloud" chỉ bật khi `loaded`; nút "Đóng" (và `Escape`) đóng mà không đổi `syncStatus`.
- `deleted-in-cloud-dialog.tsx`: `AlertDialog`, tiêu đề "Schema đã bị xóa trên cloud", hai nút "Tạo lại trên cloud", "Xóa khỏi trình duyệt này" (biến thể `destructive`), nút "Đóng".
- Focus (spec mục 11, WCAG 2.4.3): đóng hộp thoại thì focus về `trigger` trong state `cloudDialog` nếu phần tử đó vẫn nằm trong DOM; nếu không (hộp thoại mở tự động, nút "Giải quyết" đã biến mất, hoặc store vừa mount lại) thì về vùng canvas `<main>` (đã có `tabIndex={-1}`).
- `editor-workspace.tsx`:
  - Render `ConflictDialog` khi `cloudDialog.kind` là `conflict`, `DeletedInCloudDialog` khi là `deleted-in-cloud`.
  - `syncStatus` (đọc live, Task 30) chuyển sang `conflict` hoặc `deleted-in-cloud` trong lúc sửa, hoặc là giá trị đó ngay khi workspace mount (mở schema đang có xung đột), thì tự mở hộp thoại tương ứng với `trigger: null`. Người dùng đã đóng thì không tự mở lại cho tới khi `syncStatus` rời khỏi giá trị đó rồi quay lại; nút trên toolbar luôn mở lại được.
  - Prop mới `onReplaceDocument: (document: SchemaDocument) => void` truyền vào `useCloudResolution`.
- `editor-screen.tsx`: giữ state `replacement: { document: SchemaDocument; generation: number } | null`. `onReplaceDocument` tăng `generation` và giữ tài liệu mới; `EditorWorkspace` nhận `key` là chuỗi ghép `schemaId`, dấu `:` và `generation`, và `document` là tài liệu thay thế nếu có. Store mới có lịch sử undo rỗng (spec mục 7, lịch sử thuộc store); `useAutosave` của store mới không ghi lại tài liệu vừa nhận, vì nó chỉ ghi khi tài liệu đổi.

**Test viết trước:**

- `summarize-schema-version.test.ts`: `counts the tables and columns of a document`; `returns zero counts for an empty schema`.
- `use-cloud-resolution.test.tsx` (`fake-indexeddb`, `fetchImpl` giả, pusher controls giả): `loads the cloud version when the conflict dialog opens`; `does not write the cache when the cloud document has an unsupported version`; `marks the schema deleted-in-cloud when the cloud version returns 404`; `keepLocal sets the cloud revision and pending status and resumes the pusher`; `reloads the cloud version when keepLocal ends in another conflict`; `adoptCloudVersion writes the cloud document as synced and replaces the editor document`; `recreateInCloud clears the cloud revision and resumes the pusher`; `removeFromBrowser deletes the schema from the three tables and navigates to the list`.
- `conflict-dialog.test.tsx`: `shows the modified time, table count and column count of both versions`; `calls keepLocal from Keep this device's version`; `calls adoptCloudVersion from Use the cloud version`; `disables both choices while the cloud version is loading`; `shows a retry when the cloud version fails to load`; `disables Use the cloud version when the cloud version is unsupported`; `closes on Escape without changing the sync status`; `has no axe violations in the light and dark themes`.
- `deleted-in-cloud-dialog.test.tsx`: `calls recreateInCloud from Recreate in the cloud`; `calls removeFromBrowser from Remove from this browser`; `has no axe violations in the light and dark themes`.
- `editor-workspace.test.tsx`: `opens the conflict dialog when the schema opens with a conflict`; `opens the conflict dialog when a push detects a conflict`; `returns focus to Resolve after the dialog closes`; `moves focus to the canvas region when the trigger is gone`; `reopens the dialog from Resolve after it was closed`; `keeps saving edits to the cache while the conflict is unresolved`.
- `editor-screen.test.tsx`: `mounts a new editor store with the cloud document and an empty undo history`; `shows a toast after switching to the cloud version`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Commit:** `feat(frontend): add conflict and deleted in cloud dialogs to the editor`

**Xong khi:**

- ST-03 "Revision lệch trả `409` … Frontend mở hộp thoại; cả "Giữ bản trên máy này" và "Dùng bản trên cloud" cho kết quả đúng": phần hộp thoại xong ở task này (test hook và component); tích hợp 3 ở Task 36 xác nhận đầu cuối.
- Bảo mật và chung "Mọi chuỗi mới có `vi` và `en`": key của `sync/conflict-dialog`, `sync/deleted-in-cloud-dialog`.

## Task 32: Danh sách: gộp cloud và cache, các phần, nhãn, banner

**Mục tiêu:** màn hình `/` hiện các phần theo trạng thái auth, gộp danh sách cloud với cache bằng `mergeSchemaList`, có nhãn trạng thái, skeleton cho phần cloud, banner khi không tải được danh sách cloud và banner phiên hết hạn (spec mục 7 "Danh sách schema", "Đồng bộ nền"; mục 6 "Header và lời mời đăng nhập"; mục 11 "Frontend", dòng `SchemaListScreen`). Thao tác trên dòng khi đã đăng nhập thuộc Task 33.

**Agent:** frontend-engineer. **Phụ thuộc:** 22, 24, 26. **Đợt:** 8.

**File sở hữu:**

- Tạo `frontend/src/features/schema-list/hooks/use-cloud-schema-list.ts`, `use-cloud-schema-list.test.tsx`.
- Tạo `frontend/src/features/schema-list/lib/remove-stale-cache.ts`, `remove-stale-cache.test.ts`.
- Sửa `frontend/src/features/schema-list/hooks/use-schema-list.ts`, `use-schema-list.test.tsx`.
- Tạo `frontend/src/features/schema-list/components/schema-list-section.tsx`, `cloud-list-banner.tsx`, `session-expired-banner.tsx`, `sign-in-invite.tsx`, `schema-status-label.tsx`, và test `schema-list-sections.test.tsx`.
- Sửa `frontend/src/features/schema-list/components/schema-list-screen.tsx`, `schema-list-screen.test.tsx`, `schema-list-row.tsx`.
- Sửa `frontend/src/lib/i18n/locales/{en,vi}/sync/schema-list.ts` (file con do Task 19 tạo; chỉ thêm key).

**Dùng lại:** `mergeSchemaList` và kiểu kết quả của nó (Task 22), `ApiClient.schemas.list` (Task 20), `useAuth`, `useApiClient`, `AccountMenu` (Task 26), `syncPendingSchemas` (Task 24), `listSchemas` (phần 3, trả `SchemaListEntry` có trường của Task 7) và `deleteSchema` của `SchemaRepository`, `SchemaLockManager.tryAcquire` (phần 3). Tên phần, dòng, nhãn và `staleCacheIds` lấy đúng từ kiểu kết quả của Task 22; không tính lại quy tắc gộp trong component.

**Chữ ký và hành vi:**

- `use-cloud-schema-list.ts`:

  ```ts
  export type CloudSchemaListState =
    | { readonly kind: 'idle' }      // chưa đăng nhập hoặc phiên hết hạn: không gọi mạng
    | { readonly kind: 'loading' }
    | { readonly kind: 'loaded'; readonly items: readonly SchemaSummary[]; readonly isComplete: boolean }
    | { readonly kind: 'failed'; readonly failure: ApiFailure };

  export function useCloudSchemaList(input: {
    readonly apiClient: ApiClient;
    readonly authStatus: AuthState['status'];
  }): { readonly state: CloudSchemaListState; readonly reload: () => void };
  ```

  - Chỉ gọi mạng khi `authStatus` là `signed-in`. Tải lần lượt từng trang (`limit` là `SCHEMA_LIST_MAX_LIMIT` của `@schemaforge/api-contract`, `signal` qua `options` của `ApiClient.schemas.list`) tới khi `nextCursor` là `null`, rồi `isComplete: true`. Một trang lỗi thì `failed`; không giữ kết quả dở dang.
  - Tải lại khi: hook mount hoặc `authStatus` chuyển sang `signed-in`; `document` phát `visibilitychange` với `visibilityState === 'visible'`; `window` phát `online`; `reload()` (Task 33 gọi sau tạo, đổi tên, xóa). Listener gỡ trong cleanup. Lần tải mới hủy lần đang chạy qua `AbortController`; kết quả của lần đã hủy bị bỏ.
- `use-schema-list.ts`: giữ đọc cache live như phần 3 (`useLiveQuery`), rồi gọi `mergeSchemaList({ auth, cachedEntries, cloudItems, isCloudListComplete })` (tên tham số theo Task 22; `auth` là `ListAuthContext` dựng từ `useAuth`: `expired.lastUser?.id` thành `lastUserId`; khi auth `unknown` không gọi `mergeSchemaList` mà giữ danh sách của phần 3). Kiểu trả về thêm kết quả gộp; `getSchemaListEntryId` giữ nguyên chữ ký. Lỗi đọc IndexedDB vẫn ra `failed` với `StorageErrorCode` như phần 3.
- `remove-stale-cache.ts`:

  ```ts
  export async function removeStaleCache(input: {
    readonly schemaIds: readonly string[];
    readonly repository: SchemaRepository;
    readonly lockManager: SchemaLockManager;
  }): Promise<void>;
  ```

  Lần lượt từng id: `tryAcquire`; `null` thì bỏ qua; lấy được thì xóa ở ba bảng rồi `release` trong `finally`. Lỗi của một id được log (`logger.warn`, chỉ tên lỗi) và không dừng các id sau. Màn hình gọi hàm này mỗi khi kết quả gộp có `staleCacheIds` khác rỗng.
- Màn hình (`schema-list-screen.tsx` và các component mới):

  | Trạng thái auth | Hiển thị |
  |---|---|
  | `unknown` | Như phần 3 cho schema của khách; không có phần "Schema của bạn", không có lời mời |
  | `signed-out` | Dòng mời đăng nhập (`SignInInvite`: chữ "Đăng nhập để lưu schema lên cloud" và link tới `/sign-in?returnTo=/`), rồi danh sách của khách như phần 3 |
  | `signed-in` | Phần "Schema của bạn" rồi phần "Chỉ trên trình duyệt này" |
  | `expired` | `SessionExpiredBanner` ("Phiên đăng nhập đã hết", link "Đăng nhập lại" tới `/sign-in?returnTo=/`), phần "Schema của bạn" với cache của `lastUser`, rồi phần của khách |

  - Mỗi phần là `<section aria-labelledby>` với `<h2>` và một `<ul>`; mỗi phần sắp theo `updatedAt` giảm dần (thứ tự do Task 22 trả).
  - Cache hiện ngay khi đọc xong IndexedDB; trong lúc `CloudSchemaListState` là `loading` thì cuối phần "Schema của bạn" có `Skeleton` kèm chữ ẩn trong `role="status"`.
  - `failed`: `CloudListBanner` "Không tải được danh sách trên cloud" kèm thông báo `apiErrors:<mã>` và nút "Thử lại" gọi `reload`; phần "Schema của bạn" vẫn hiện cache của tài khoản; không có id nào bị coi là đã xóa (Task 22 chỉ trả `staleCacheIds` khi `isCloudListComplete`).
  - `SchemaListRow` hiện `SchemaStatusLabel` cạnh thời điểm cập nhật với nhãn "Chưa tải về trình duyệt này", "Chưa đồng bộ", "Xung đột", "Đã bị xóa trên cloud". Nhãn là chữ, không chỉ dựa vào màu (WCAG 1.4.1); màu qua token theme. Dòng chỉ có trên cloud vẫn là link mở editor (`/schemas/<id>`); luồng mở của Task 29 tải về cache.
  - Không có schema nào ở mọi phần: giữ trạng thái rỗng "Chưa có schema" và nút tạo của phần 3.
  - Gắn `AccountMenu` (Task 26) vào header của màn hình, ngay trước `ThemeSwitch` sẵn có.
  - Khi màn hình mount với `signed-in` (hoặc auth chuyển sang `signed-in` khi màn hình đang mở): gọi thẳng `syncPendingSchemas({ api, repository, lockManager, userId })` của Task 24 một lần (spec mục 7 "Đồng bộ nền": "khi màn hình danh sách mount"). `BackgroundSyncHost` của Task 28 không có trigger gọi từ ngoài; hai lượt chồng nhau trong cùng tab dùng chung một promise (Task 24).
- Test sẵn có của phần 3 (`schema-list-screen.test.tsx`, `schema-list-journey.test.tsx`) phải pass với trạng thái `signed-out` mà không gọi `fetch`; chỉ sửa phần dựng provider của test khi màn hình cần provider auth, không sửa khẳng định.

**Test viết trước:**

- `use-cloud-schema-list.test.tsx` (`fetchImpl` giả): `does not call the api while signed out`; `does not call the api while the session is expired`; `loads every page until the next cursor is null`; `reports failed when a page fails`; `reloads when the tab becomes visible`; `reloads on the online event`; `ignores the result of a superseded load`.
- `remove-stale-cache.test.ts` (`fake-indexeddb`, khóa giả): `removes a stale schema from the three tables`; `skips a schema whose lock is taken`; `goes on with the next id after a failure`.
- `use-schema-list.test.tsx`: `passes the cached records and cloud items to mergeSchemaList`; `keeps reporting a storage read failure`.
- `schema-list-sections.test.tsx`: `shows the sign-in invitation and the guest schemas while signed out`; `shows your schemas and this browser only sections while signed in`; `shows the session expired banner with the cached schemas of the last user`; `shows a skeleton in your schemas while the cloud list loads`; `shows the cached schemas and a retry banner when the cloud list fails`; `retries the cloud list from the banner`; `shows the status label of each row` (`it.each` bốn nhãn); `has no axe violations in the light and dark themes`.
- `schema-list-screen.test.tsx` (thêm): `removes stale cached schemas after a complete cloud list`; `runs the background sync when the screen mounts while signed in`; `renders the account menu in the header`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Commit:** `feat(frontend): merge cloud schemas into the schema list`

**Xong khi:**

- ST-04 "Màn hình danh sách gộp schema trên cloud với cache, có nhãn trạng thái, và vẫn hiện cache khi không tải được danh sách cloud" (test component ở task này; phần phân trang keyset của backend thuộc Task 14, 16).
- ST-03 "Mở được schema đã lưu từ thiết bị khác … danh sách có schema từ cloud": phần danh sách; tích hợp 4 ở Task 35.
- Bảo mật và chung "Mọi chuỗi mới có `vi` và `en`": key của `sync/schema-list`.

## Task 33: Danh sách: tạo, đổi tên, xóa khi đã đăng nhập, "Lưu lên cloud" trên dòng

**Mục tiêu:** thao tác trên màn hình danh sách theo bảng "Tạo, đổi tên, xóa khi đã đăng nhập" (spec mục 7), và nút "Lưu lên cloud" trên dòng schema của khách chạy quy trình `uploadLocalSchemas` cho một schema, chưa đăng nhập thì mở `SignInPrompt` (spec mục 7 "Đưa schema của khách lên cloud", mục 6 "Header và lời mời đăng nhập").

**Agent:** frontend-engineer. **Phụ thuộc:** 32. **Đợt:** 9.

**File sở hữu:**

- Sửa `frontend/src/features/schema-list/hooks/use-schema-actions.ts`, `use-schema-actions.test.tsx`.
- Sửa `frontend/src/features/schema-list/hooks/use-schema-list-dialogs.ts`.
- Sửa `frontend/src/features/schema-list/components/schema-list-row.tsx`, `schema-list-dialogs.tsx`, `rename-schema-dialog.tsx`, `delete-schema-dialog.tsx`, `schema-list-screen.tsx`, `schema-list-screen.test.tsx`.
- Tạo `frontend/src/features/schema-list/components/schema-list-row.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/{en,vi}/sync/schema-list.ts` (file con do Task 19 tạo, dùng chung với Task 32 ở đợt 8; chỉ thêm key, không đổi key sẵn có).

**Dùng lại:** `uploadLocalSchemas` và kiểu kết quả của nó (Task 24); `syncPendingSchemas` (Task 24) và cách Task 28 báo kết quả đưa lên bằng toast ("Đã lưu N schema lên cloud", "M schema chưa lưu được"); `useSignInPrompt` (Task 26); `useAuth`, `useApiClient`; `reload` của `useCloudSchemaList` và kiểu dòng đã gộp (Task 32); `createSchema(name, { ownerId })` và `writeCloudCopy` của `SchemaRepository` (Task 7); `renameSchema`, `deleteSchema` sẵn có của phần 3. Thiếu thì dừng và báo.

**Chữ ký và hành vi:**

- `use-schema-actions.ts`: `SchemaActions` thêm `uploadToCloud` và đổi đầu vào của `renameSchema`, `deleteSchema` để biết dòng thuộc loại nào.

  ```ts
  export type SchemaActionTarget = {
    readonly id: string;
    readonly name: string;
    readonly source: 'guest' | 'cached' | 'cloud-only';
  };
  export type SchemaActions = {
    readonly createSchema: (name: string) => Promise<void>;
    readonly renameSchema: (target: SchemaActionTarget, name: string) => Promise<void>;
    readonly deleteSchema: (target: SchemaActionTarget) => Promise<boolean>;
    readonly uploadToCloud: (target: SchemaActionTarget) => Promise<void>;
  };
  export function useSchemaActions(storage: StorageBundle, cloud: { readonly reload: () => void }): SchemaActions;
  ```

  Dòng `unreadable` của phần 3 vẫn xóa được với `source: 'guest'` hoặc `'cached'` theo phần chứa nó.

  | Thao tác | Trạng thái auth, nguồn | Hành vi |
  |---|---|---|
  | Tạo | `signed-in` | Một transaction tạo record (`ownerId` là người dùng, `cloudRevision: null`, `pending`) và tài liệu bằng `createSchema(name, { ownerId: userId })` (Task 7); điều hướng tới editor. Offline vẫn tạo được; `CloudPusher` của editor gửi `POST`. Sau đó `cloud.reload()` |
  | Tạo | khác `signed-in` | Như phần 3 (schema của khách) |
  | Đổi tên | `guest` | Như phần 3 |
  | Đổi tên | `cached` | Như phần 3 (`tryAcquire`, parse, `renameSchema`; lần ghi đặt `pending`, Task 7), nhả khóa, rồi gọi `syncPendingSchemas` (Task 24) cho người dùng hiện tại; sau đó `cloud.reload()` |
  | Đổi tên | `cloud-only` | Trong khóa: `apiClient.schemas.get(id)`, `parseSchemaDocument`, `writeCloudCopy` (record `synced` với `cloudRevision`), rồi đổi tên như dòng trên. `get` lỗi thì toast `apiErrors:<mã>`, không ghi gì |
  | Xóa | `guest` | Như phần 3 |
  | Xóa | `cached`, `cloud-only` | `tryAcquire` (bận thì toast "đang mở ở tab khác" của phần 3); `apiClient.schemas.remove(id)`: `204` hoặc `404` thì `deleteSchema` (ba bảng, một transaction), trả `true`, rồi `cloud.reload()`; `network`, `timeout` thì toast "Cần kết nối mạng để xóa schema trên cloud", không xóa gì, trả `false`; lỗi HTTP khác thì toast `apiErrors:<mã>`, trả `false` |
  | Lưu lên cloud | `guest` | `requireSignIn('cloudSave')` trả `false` thì dừng. `true` thì `uploadLocalSchemas([id])` (quy trình tự lấy khóa với `ifAvailable`), hiện toast kết quả như Task 28, rồi `cloud.reload()` |

- `schema-list-row.tsx`: menu của dòng theo nguồn:
  - `guest`: "Mở", "Đổi tên", "Lưu lên cloud", "Xóa". Nhãn dòng mời đăng nhập của Task 32 không đổi.
  - `cached`, `cloud-only`: "Mở", "Đổi tên", "Xóa".
  - Dòng không đọc được: chỉ "Xóa" như phần 3.
  - `onRename`, `onDelete`, `onUploadToCloud` nhận `SchemaActionTarget` và `trigger`, để hộp thoại trả focus về nút menu của dòng như phần 3.
- `use-schema-list-dialogs.ts`, `schema-list-dialogs.tsx`, `rename-schema-dialog.tsx`: đích `rename` đổi từ `SchemaRecord` sang `SchemaActionTarget` (dòng chỉ có trên cloud không có record).
- `delete-schema-dialog.tsx`: với `cached`, `cloud-only` thì mô tả là "Schema bị xóa khỏi tài khoản trên cloud và khỏi trình duyệt này. Không hoàn tác được." (namespace `sync`, file con `schema-list`); với `guest` giữ chữ của phần 3. Nút xác nhận bị disable trong lúc gửi `DELETE`.
- `schema-list-screen.tsx`: truyền `reload` của `useCloudSchemaList` vào `useSchemaActions`; focus sau khi xóa giữ quy tắc phần 3 (về `<h1>` khi dòng đã mất).

**Test viết trước:**

- `use-schema-actions.test.tsx` (`fake-indexeddb`, `fetchImpl` giả, khóa giả): `creates an owned pending schema while signed in`; `creates a guest schema while signed out`; `creates an owned schema while offline`; `renames a cached schema and runs the background sync`; `downloads a cloud-only schema before renaming it`; `does not write the cache when downloading a cloud-only schema fails`; `deletes a cloud schema from the cloud and the cache on 204`; `deletes the cache when the cloud answers 404`; `keeps the cache and shows a network toast when the delete request fails`; `does not call the api when the schema is open in another tab`; `deletes a guest schema without calling the api`; `opens the sign-in prompt instead of uploading while signed out`; `uploads a guest schema and reloads the cloud list`.
- `schema-list-row.test.tsx`: `offers Save to cloud for a guest schema`; `does not offer Save to cloud for a cloud schema`; `offers only Delete for an unreadable schema`.
- `schema-list-screen.test.tsx` (thêm): `describes the cloud delete in the confirmation dialog`; `returns focus to the row menu after renaming a cloud-only schema`; `moves focus to the heading after a cloud schema is deleted`.

**Kiểm tra:** như "Quy ước chung" với `frontend`. `schema-list-journey.test.tsx` của phần 3 vẫn pass không sửa khẳng định.

**Commit:** `feat(frontend): manage cloud schemas from the schema list`

**Xong khi:**

- ST-04 "Mở và xóa từng schema từ danh sách; xóa cần mạng và xóa cả cache": phần thao tác xong ở task này; tích hợp 5 ở Task 35 xác nhận đầu cuối.
- ST-02 "Khi chưa đăng nhập, "Lưu lên cloud" mở `SignInPrompt`": phần dòng danh sách (test `opens the sign-in prompt instead of uploading while signed out`).
- Bảo mật và chung "Mọi chuỗi mới có `vi` và `en`": key thêm vào `sync/schema-list`.

## Task 34: Hộp thoại đăng xuất trong `AccountMenu`

**Mục tiêu:** mục "Đăng xuất" của `AccountMenu` chạy quy trình đăng xuất ở spec mục 7 "Đăng xuất": cảnh báo khi còn thay đổi chưa đồng bộ, "Thử đồng bộ", báo lỗi mạng mà không báo đã đăng xuất (spec mục 11 "Frontend", dòng "Hộp thoại đăng xuất", "Accessibility").

**Agent:** frontend-engineer. **Phụ thuộc:** 24, 25, 26. **Đợt:** 9.

**File sở hữu:**

- Tạo `frontend/src/components/use-sign-out-flow.ts`, `use-sign-out-flow.test.tsx`.
- Tạo `frontend/src/components/sign-out-dialog.tsx`, `sign-out-dialog.test.tsx`.
- Sửa `frontend/src/components/account-menu.tsx`, `account-menu.test.tsx` (Task 26 tạo).
- Sửa `frontend/src/lib/i18n/locales/{en,vi}/sync/sign-out-dialog.ts` (file con do Task 19 tạo; chỉ thêm key).

**Dùng lại:** `signOut` và `SignOutFailure` (Task 25), `syncPendingSchemas` (Task 24), `useSignOut` (Task 26; ghép `signOut` của Task 25 với `markSignedOut` của store Task 21), `countUnsyncedSchemas` (Task 25), `useStorage`, `useApiClient`, `useNotify`. Thiếu thì dừng và báo.

**Chữ ký và hành vi:**

- `use-sign-out-flow.ts`:

  ```ts
  export type SignOutFlowState =
    | { readonly kind: 'idle' }
    | { readonly kind: 'counting' }
    | { readonly kind: 'confirming'; readonly unsyncedCount: number }
    | { readonly kind: 'syncing'; readonly unsyncedCount: number }
    | { readonly kind: 'signing-out' };

  export type SignOutFlow = {
    readonly state: SignOutFlowState;
    readonly start: () => Promise<void>;
    readonly trySync: () => Promise<void>;
    readonly confirm: () => Promise<void>;
    readonly cancel: () => void;
  };
  export function useSignOutFlow(): SignOutFlow;
  ```

  - `start`: `counting`, `countUnsyncedSchemas({ repository, userId })`. `0` thì chạy thẳng bước đăng xuất; lớn hơn `0` thì `confirming` với số đếm (spec bước 1).
  - `trySync`: `syncing`, chạy `syncPendingSchemas` cho người dùng hiện tại, đếm lại. Còn lớn hơn `0` thì về `confirming` với số mới. Bằng `0` thì về `confirming` với `unsyncedCount: 0`; hộp thoại khi đó đổi sang chữ "Mọi thay đổi đã lưu lên cloud" và nút "Đăng xuất" (Vấn đề 17, đã chốt).
  - `confirm` và bước đăng xuất: `signing-out`, gọi hàm do `useSignOut()` trả về (Task 26, bọc `signOut` của Task 25: `logout`, phát `signed-out`, xóa record của tài khoản ở ba bảng với khóa chờ tối đa 5 giây, xóa `session` và cookie `sf-auth-hint`). Failure mạng thì toast lỗi "Không đăng xuất được, hãy kiểm tra kết nối", trạng thái auth giữ `signed-in`, về `idle` (spec bước 2). Thành công thì về `idle`; điều hướng khỏi editor do `useLeaveOnSignOut` (Task 29) đảm nhận khi trạng thái auth thành `signed-out`.
  - `cancel`: về `idle`, không gọi gì.
  - Gọi `start` khi đang không `idle` thì bỏ qua (chống bấm hai lần).
- `sign-out-dialog.tsx`: `AlertDialog` mở khi `state.kind` là `confirming` hoặc `syncing`. Tiêu đề và mô tả "N schema có thay đổi chưa lưu lên cloud. Đăng xuất sẽ xóa chúng khỏi trình duyệt này." (plural `_one`, `_other`). Ba nút "Thử đồng bộ", "Vẫn đăng xuất" (biến thể `destructive`), "Hủy"; khi `syncing` hoặc `signing-out` thì mọi nút bị disable và vùng `role="status"` báo "Đang đồng bộ…" hoặc "Đang đăng xuất…". `Escape` tương đương "Hủy".
- `account-menu.tsx`: mục "Đăng xuất" gọi `start`; trong lúc `counting`, `signing-out` thì mục bị disable. Đóng hộp thoại (Hủy, `Escape`, đăng xuất lỗi) thì focus về nút mở menu có email; đăng xuất thành công thì nút đó biến mất, focus về link "Đăng nhập" mà `AccountMenu` hiện ở trạng thái `signed-out`.

**Test viết trước:**

- `use-sign-out-flow.test.tsx` (`fake-indexeddb`, `fetchImpl` giả, khóa giả, `BroadcastChannel` giả): `signs out without a dialog when every schema is synced`; `asks for confirmation when unsynced schemas remain`; `counts again after trying to sync`; `offers a plain sign out when trying to sync leaves nothing unsynced`; `keeps the user signed in and the cache intact when logout fails with a network error`; `signs out and removes only the account cache after confirming`; `does nothing on cancel`; `ignores a second start while signing out`.
- `sign-out-dialog.test.tsx`: `shows the number of unsynced schemas`; `disables every button while syncing`; `calls confirm from Sign out anyway`; `calls cancel on Escape`; `has no axe violations in the light and dark themes`.
- `account-menu.test.tsx` (thêm): `starts the sign out flow from the menu`; `returns focus to the menu button after cancelling`; `shows the sign-in link after signing out`.

**Kiểm tra:** như "Quy ước chung" với `frontend`.

**Commit:** `feat(frontend): warn about unsynced changes before signing out`

**Xong khi:**

- ST-02 "Đăng nhập và đăng xuất …": phần giao diện đăng xuất ở frontend (phần backend ở Task 13, 15); tích hợp 6 ở Task 36 xác nhận đầu cuối.
- Bảo mật và chung "Mọi chuỗi mới có `vi` và `en`": key của `sync/sign-out-dialog`.

## Task 35: Backend giả trong bộ nhớ, tích hợp 1, 4, 5, 7

**Mục tiêu:** dựng backend giả trong bộ nhớ đóng vai API của phần 4 qua `fetchImpl`, một môi trường hành trình có đủ provider auth, API client, host đồng bộ và upload, rồi viết tích hợp 1, 4, 5, 7 của spec mục 11 "Frontend", bảng "Tích hợp".

**Agent:** frontend-engineer. **Phụ thuộc:** 27, 28, 31, 33, 34. **Đợt:** 10.

**File sở hữu:**

- Tạo `frontend/src/testing/fake-api-backend.ts`, `fake-api-backend.test.ts`.
- Tạo `frontend/src/testing/cloud-journeys/mount-cloud-journey.tsx`, `mount-cloud-journey.test.tsx`.
- Tạo `frontend/src/testing/cloud-journeys/guest-upload.test.tsx` (hành trình 1), `new-device.test.tsx` (4), `delete-from-list.test.tsx` (5), `guest-without-network.test.tsx` (7).

`mount-editor-journey.tsx`, `render-with-providers.tsx` (Task 29 đã thêm tùy chọn `AuthProvider`), `fake-lock-registry.ts` của phần 3 và `fake-auth-lock-manager.ts` của Task 20 không đổi trong task này; file mới import chúng.

**Chữ ký và hành vi:**

- `fake-api-backend.ts`:

  ```ts
  export type RecordedRequest = {
    readonly method: string;
    readonly path: string;              // pathname kèm query, không có origin
    readonly body: unknown;             // JSON đã parse, hoặc null
  };
  export type FakeApiBackend = {
    readonly fetch: typeof fetch;       // truyền làm fetchImpl của createApiClient
    readonly requests: readonly RecordedRequest[];
    readonly seedUser: (input: { readonly email: string; readonly password: string }) => string; // trả id
    readonly seedSchema: (input: { readonly ownerId: string; readonly id: string; readonly document: SchemaDocument }) => void;
    readonly signInAs: (userId: string) => void;          // như đã có cookie phiên hợp lệ
    readonly expireAccessToken: () => void;               // request sau trả 401, refresh vẫn được
    readonly setOffline: (isOffline: boolean) => void;    // true thì fetch reject TypeError
    readonly writeFromOtherDevice: (id: string, document: SchemaDocument) => void; // tăng revision
    readonly deleteFromOtherDevice: (id: string) => void;
    readonly getStoredSchema: (id: string) => { readonly revision: number; readonly document: SchemaDocument } | null;
  };
  export function createFakeApiBackend(input: { readonly clock: () => number }): FakeApiBackend;
  ```

  - Route và response đúng spec mục 5 và kiểu của `packages/api-contract`: `POST /auth/register`, `POST /auth/login` (sai email hoặc mật khẩu đều `401 invalid-credentials`), `POST /auth/refresh`, `POST /auth/logout` (`204`), `GET /auth/me`; `GET /schemas` (keyset theo `updatedAt`, `id`, `limit` mặc định và tối đa theo hằng của hợp đồng, `nextCursor`), `GET /schemas/:id`, `POST /schemas` (`201`, revision 1; id đã có `409 schema-id-unavailable`; quá 100 schema `403 schema-limit-reached`), `PUT /schemas/:id` (`expectedRevision` lệch `409 revision-conflict` kèm `currentRevision`; thành công tăng revision), `DELETE /schemas/:id` (`204`). Schema của người khác hoặc không tồn tại trả `404 not-found`. Không có phiên thì route ngoài năm route public trả `401 unauthenticated`. Body lỗi đúng `ApiErrorBody`.
  - Tài liệu nhận qua `POST`, `PUT` đi qua `parseSchemaDocument`; sai cấu trúc trả `422`. Tài liệu lưu và trả về là bản đã parse.
  - Mỗi request (kể cả request bị `setOffline` từ chối) được ghi vào `requests` trước khi xử lý.
  - Không có mã chạy theo đồng hồ thật; thời gian lấy từ `clock`.
- `mount-cloud-journey.tsx`:

  ```ts
  export type CloudJourneyEnvironment = {
    readonly backend: FakeApiBackend;
    readonly storage: StorageBundle;
    readonly database: SchemaforgeDatabase;
    readonly scheduler: ManualScheduler;      // runDue(): chạy mọi hẹn giờ thử lại đã đến hạn
    readonly fetchSpy: Mock<typeof fetch>;   // bọc backend.fetch
    readonly setAuthHint: (isPresent: boolean) => void; // ghi, xóa document.cookie sf-auth-hint
    readonly createGuestSchema: (name: string) => Promise<string>;
    readonly mountSchemaList: () => MountedScreen;
    readonly mountEditor: (schemaId: string) => MountedScreen;
    readonly mountSignIn: (returnTo?: string) => MountedScreen;
  };
  export function createCloudJourneyEnvironment(): CloudJourneyEnvironment;
  ```

  - Mỗi lần mount bọc màn hình trong đúng cây provider mà `AppProviders` dựng cho phần 4 (provider API client với `fetchImpl: fetchSpy`, `AuthProvider` với `AuthLockManager` giả của Task 20, host đưa schema lên và host đồng bộ nền của Task 28, `StorageProvider`), qua `renderWithProviders` với locale `en`. Không dùng `AppProviders` trực tiếp nếu nó tự tạo storage hay client từ env; khi đó dựng lại cây với cùng component con, không sao chép logic.
  - `vi.stubGlobal("fetch", …)` bằng một spy ném lỗi, để lời gọi `fetch` toàn cục ngoài API client làm test đỏ.
  - `BroadcastChannel` thay bằng bản giả trong bộ nhớ dùng chung cho mọi màn hình của cùng môi trường; `ResizeObserver` và chiều cao node như `createJourneyEnvironment`.
  - Scheduler thủ công được truyền vào `CloudPusher` bằng cách bọc cây provider trong `RetrySchedulerContext` (Task 30). Đồng bộ nền (Task 28, 32) không có hẹn giờ nên không cần scheduler.
  - Test file gọi `vi.mock("next/navigation", …)` như `schema-list-journey.test.tsx`, trỏ `Dexie.dependencies` vào `fake-indexeddb` trong `beforeAll`, và gọi `toast.dismiss()`, `vi.unstubAllGlobals()`, `vi.restoreAllMocks()`, xóa `document.cookie` trong `afterEach`.
- Hành trình (thao tác bằng `user-event`, truy vấn theo role, label, text; không mock store hay repository). Chữ tiếng Anh trong ngoặc kép dưới đây là minh họa; test dùng đúng chữ `en` mà Task 19, 27, 28, 32, 33 đã ghi trong file i18n:
  1. **`guest-upload.test.tsx`:** hai schema của khách "shop", "blog"; `seedUser`; mount `/sign-in`, điền email, mật khẩu, gửi; hộp thoại "Save the schemas in this browser to your account?" hiện hai checkbox đã chọn; bỏ chọn "blog"; "Save to cloud"; mount danh sách: "shop" nằm trong phần "Your schemas", "blog" nằm trong "Only in this browser"; `backend.getStoredSchema` của "shop" có revision 1; record của "blog" vẫn `ownerId: null`.
  2. **`new-device.test.tsx` (hành trình 4):** database rỗng; `seedSchema` với tài liệu `createShopDocument()`; `signInAs`, `setAuthHint(true)`; mount danh sách: "shop" hiện với nhãn "Not downloaded to this browser"; mount editor của id đó: node "users" và "orders" hiện; record trong cache là `synced` với `cloudRevision: 1`, tài liệu trong `documents` bằng tài liệu cloud (`documentsEqual`).
  3. **`delete-from-list.test.tsx` (hành trình 5):** schema có chủ đã `synced` trong cache và trên backend; mount danh sách; menu của dòng → "Delete" → xác nhận; `requests` có `DELETE /schemas/<id>`; dòng biến mất; ba bảng không còn bản ghi của id; thêm một test cùng file: `setOffline(true)` thì toast "Deleting a schema in the cloud needs a network connection" và bản ghi còn nguyên.
  4. **`guest-without-network.test.tsx` (hành trình 7):** không có hint; tạo schema từ danh sách, mở editor, thêm bảng, đổi tên trong editor, quay lại danh sách, đổi tên, xóa (đúng các bước của `schema-list-journey.test.tsx` và `schema-and-columns.test.tsx` phần 3); cuối cùng `fetchSpy` và `fetch` toàn cục không được gọi lần nào.

**Test viết trước:**

- `fake-api-backend.test.ts`: `registers a user and returns a response matching the contract`; `returns the same error for an unknown email and a wrong password`; `returns 401 for a private route without a session`; `creates a schema with revision 1`; `returns 409 schema-id-unavailable for an existing id`; `returns 409 revision-conflict with the current revision`; `returns 404 for a schema of another user`; `returns 403 after 100 schemas`; `pages the schema list with a cursor`; `rejects a structurally invalid document with 422`; `rejects every request while offline and still records it`; `bumps the revision on a write from another device`.
- `mount-cloud-journey.test.tsx`: `mounts the schema list signed out without calling fetch`; `mounts the schema list signed in when the hint is present`; `runs due retries only when the scheduler is advanced`.
- `guest-upload.test.tsx`: `asks to upload guest schemas after signing in and uploads only the selected one`; `keeps the unselected schema in this browser only section`.
- `new-device.test.tsx`: `lists a cloud schema on an empty browser`; `opens the cloud schema and writes it to the cache`.
- `delete-from-list.test.tsx`: `deletes a cloud schema from the list, the cloud and the cache`; `keeps the schema when the delete request fails offline`.
- `guest-without-network.test.tsx`: `never calls fetch during the guest create, edit, rename and delete journeys`.

**Kiểm tra:** như "Quy ước chung" với `frontend`; thêm `pnpm --filter @schemaforge/frontend exec vitest run src/testing/cloud-journeys` chạy ba lần liên tiếp đều xanh (không flaky).

**Commit:** `test(frontend): add fake api backend and cloud journey tests`

**Xong khi:**

- ST-02 "Đăng nhập không làm mất schema trên trình duyệt … (tích hợp 1)" và "Khách không có cookie gợi ý không gọi mạng lần nào … (tích hợp 7)".
- ST-03 "Mở được schema đã lưu từ thiết bị khác … (tích hợp 4)" và "Sau lần đăng nhập đầu tiên … schema không chọn vẫn ở lại trình duyệt (tích hợp 1)".
- ST-04 "Mở và xóa từng schema từ danh sách; xóa cần mạng và xóa cả cache (tích hợp 5)".

## Task 36: Tích hợp 2, 3, 6

**Mục tiêu:** ba hành trình còn lại của bảng "Tích hợp" ở spec mục 11: đẩy lên với `expectedRevision` và offline rồi online (2), xung đột với cả hai lựa chọn (3), đăng xuất khi còn thay đổi chưa đồng bộ (6).

**Agent:** frontend-engineer. **Phụ thuộc:** 35. **Đợt:** 11.

**File sở hữu:**

- Tạo `frontend/src/testing/cloud-journeys/push-offline.test.tsx` (hành trình 2).
- Tạo `frontend/src/testing/cloud-journeys/conflict.test.tsx` (hành trình 3).
- Tạo `frontend/src/testing/cloud-journeys/sign-out-pending.test.tsx` (hành trình 6).

Chỉ dùng `createCloudJourneyEnvironment` và `FakeApiBackend` của Task 35; không sửa hai file đó. Thiếu điều khiển nào thì dừng và báo để orchestrator giao phần sửa cho một task riêng.

**Cài đặt:** chung cho ba file: `vi.mock("next/navigation")`, `beforeAll` và `afterEach` như Task 35. Mỗi test bắt đầu từ môi trường mới: `seedUser`, `signInAs`, `setAuthHint(true)`, `seedSchema` với `createShopDocument()` và ghi bản đó vào cache ở trạng thái `synced`, `cloudRevision: 1` (qua `writeCloudCopy` của Task 7, hoặc mở editor một lần như hành trình 4). Chữ tiếng Anh trong ngoặc kép là minh họa; dùng đúng chữ `en` của file i18n.

1. **`push-offline.test.tsx`:**
   - Mở editor, thêm một bảng. Chờ `requests` có `PUT /schemas/<id>` với `body.expectedRevision` là `1`; `getStoredSchema(id).revision` là `2`; toolbar hiện "Saved to the cloud".
   - `setOffline(true)`, thêm bảng thứ hai: toolbar hiện "Not synced" kèm lý do mất mạng; record là `pending`.
   - `setOffline(false)`, `window.dispatchEvent(new Event("online"))`: có `PUT` với `expectedRevision` `2`; toolbar hiện "Saved to the cloud"; record `synced` với `cloudRevision: 3`.
   - Thêm test: khi offline, `scheduler.runDue()` gửi lại và vẫn "Not synced"; không có `online` thì không gửi thêm ngoài hẹn giờ.
2. **`conflict.test.tsx`:**
   - Chung: mở editor; `writeFromOtherDevice(id, tài liệu có thêm bảng "payments")` (revision thành 2); thêm một bảng trong editor; lần `PUT` với `expectedRevision: 1` nhận `409`; alertdialog "This schema was changed somewhere else" hiện với số bảng của hai bản.
   - "Keep this device's version": có `PUT` với `expectedRevision: 2` chứa tài liệu mới nhất của editor; `getStoredSchema(id).revision` là `3`; hộp thoại đóng; toolbar "Saved to the cloud".
   - "Use the cloud version" (test riêng, cùng bước chung): canvas hiện node "payments" và không còn bảng vừa thêm ở máy này; nút "Undo" bị disable (lịch sử rỗng); toast "Switched to the cloud version"; record `synced`, `cloudRevision: 2`; không có `PUT` nào sau lựa chọn.
   - Đóng hộp thoại bằng `Escape`: toolbar "Conflict" kèm nút "Resolve"; sửa tiếp thì không có `PUT` mới; "Resolve" mở lại hộp thoại.
3. **`sign-out-pending.test.tsx`:**
   - Thêm một schema của khách "notes". Mở editor của schema có chủ, `setOffline(true)`, thêm bảng (record `pending`), unmount editor, mount danh sách.
   - Mở `AccountMenu`, "Sign out": alertdialog hiện "1 schema has changes that are not saved to the cloud…".
   - `setOffline(false)`, "Sign out anyway": `requests` có `POST /auth/logout`; ba bảng không còn bản ghi của schema có chủ; bảng `session` rỗng; `document.cookie` không còn `sf-auth-hint`; danh sách còn "notes" ở phần của khách và hiện link "Sign in".
   - Thêm test: `setOffline(true)` rồi "Sign out anyway": toast lỗi đăng xuất, cache của tài khoản còn nguyên, `AccountMenu` vẫn hiện email.
   - Thêm test: "Cancel" đóng hộp thoại, không có `POST /auth/logout`.

**Test viết trước:**

- `push-offline.test.tsx`: `sends the cached revision as expectedRevision after an edit`; `shows not synced while offline and syncs on the online event`; `retries on the scheduler while offline without syncing`.
- `conflict.test.tsx`: `keeps this device's version with the new cloud revision`; `uses the cloud version and shows the cloud document on the canvas`; `leaves the conflict unresolved when the dialog is closed and reopens it from Resolve`.
- `sign-out-pending.test.tsx`: `warns about unsynced changes and removes the account cache after signing out anyway`; `keeps the account cache when logout fails offline`; `does not sign out after cancelling`.

**Kiểm tra:** như "Quy ước chung" với `frontend`; thêm `pnpm --filter @schemaforge/frontend exec vitest run src/testing/cloud-journeys` chạy ba lần liên tiếp đều xanh.

**Commit:** `test(frontend): cover cloud push, conflict and sign out journeys`

**Xong khi:**

- ST-03 "Sau khi đăng nhập, mỗi lần lưu local được đẩy lên cloud với `expectedRevision`; offline thì hiện "Chưa đồng bộ" và tự đẩy khi có mạng (tích hợp 2)".
- ST-03 "… Frontend mở hộp thoại; cả "Giữ bản trên máy này" và "Dùng bản trên cloud" cho kết quả đúng (tích hợp 3)".
- ST-02 "Đăng nhập và đăng xuất …": phần frontend của đăng xuất khi còn `pending` (tích hợp 6).

## Task 37: Checklist kiểm tra tay (spec mục 11)

**Mục tiêu:** chạy checklist "Kiểm tra tay" ở spec mục 11 và các tiêu chí ghi "(kiểm tra tay)" trên trình duyệt thật, với frontend và backend bản build, rồi ghi kết quả để Task 38 đưa vào tài liệu.

**Agent:** user, orchestrator, frontend-engineer. Người dùng thao tác trên trình duyệt; orchestrator chuẩn bị môi trường, đọc từng bước cho người dùng và ghi kết quả; frontend-engineer chỉ tham gia khi một mục không đạt (xem bước 4). **Phụ thuộc:** 16, 17, 18, 36. **Đợt:** 12.

**File sở hữu:** không có. Task không sửa file trong repo; kết quả nằm trong báo cáo của orchestrator và được Task 38 ghi vào mục "Kết quả kiểm tra tay" của plan này (xem Vấn đề về nơi ghi kết quả).

**Các bước:**

1. **Chuẩn bị** (orchestrator, root repo, tiền tố Node của "Điều kiện tiên quyết"):
   - Working tree sạch trên `master` đã gồm Task 1–36; job `verify` và `e2e` của commit đó xanh trên CI.
   - Container `local_postgres` đang chạy; database `schemaforge_dev` đã chạy migration theo lệnh Task 5 ghi trong `backend/README.md`.
   - Người dùng tự tạo `backend/.env` và `frontend/.env.local` từ `backend/.env.example`, `frontend/.env.example` (`NEXT_PUBLIC_API_URL=http://localhost:3001`, `CORS_ORIGINS=http://localhost:3000`, `NODE_ENV=production` không bắt buộc). Orchestrator và agent không đọc, không in hai file này.
   - `pnpm build`, rồi hai terminal: `pnpm --filter @schemaforge/backend start` (cổng 3001) và `pnpm --filter @schemaforge/frontend exec next start --port 3000`. `frontend/package.json` không có script `start`, nên dùng `exec next start`.
   - Tạo sẵn hai tài khoản thử bằng màn hình `/sign-up` (email giả dạng `tester-a@example.com`), không dùng email hay mật khẩu thật.
2. **Checklist.** Mỗi dòng ghi: Đạt / Không đạt / Không chạy được (kèm lý do), trình duyệt và phiên bản, ghi chú.

   | # | Hạng mục | Cách kiểm tra | Tiêu chí liên quan |
   |---|---|---|---|
   | 1 | Thuộc tính cookie | Chrome DevTools, Application → Cookies của `http://localhost:3001` sau khi đăng nhập: `sf-access` có `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`; `sf-refresh` có `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/auth`; không cookie nào có `Domain`. Cookie `sf-auth-hint` của frontend có giá trị `1` | ST-02 đăng ký; Bảo mật "Không có token …" |
   | 2 | Không có token trong bộ nhớ đọc được bằng JavaScript | Application → Local Storage, Session Storage, IndexedDB `schemaforge`: không có chuỗi token; Console `document.cookie` chỉ có `sf-auth-hint=1` và cookie ưu tiên của phần 3 (`sf-theme`, `sf-locale`) | Bảo mật "Không có token …" |
   | 3 | CSP không chặn request tới backend | Console không có vi phạm CSP ở `/`, `/sign-in`, `/sign-up`, `/schemas/<id>`; tab Network thấy request tới `http://localhost:3001` thành công; response đọc được dù có `Cross-Origin-Resource-Policy: same-site` | Rủi ro "CSP", "CORP" |
   | 4 | Hai tab cùng gặp access token hết hạn | Mở danh sách ở hai tab; xóa cookie `sf-access` trong DevTools; thao tác gần như đồng thời ở hai tab (tải lại danh sách, sửa schema); cả hai vẫn đăng nhập, `AccountMenu` không chuyển "Đăng nhập lại" | ST-02 refresh, hai tab |
   | 5 | Offline rồi online | Mở editor schema có chủ; Network → Offline; sửa: toolbar "Chưa đồng bộ" kèm lý do mất mạng; bỏ Offline: toolbar về "Đã lưu lên cloud" không cần bấm gì | ST-03 đẩy lên |
   | 6 | Hai thiết bị | Chrome và Firefox cùng tài khoản, mở cùng schema; sửa ở Chrome; sửa ở Firefox: hộp thoại xung đột hiện; thử cả "Giữ bản trên máy này" và "Dùng bản trên cloud"; mở schema trên trình duyệt chưa có cache thì thấy đúng tài liệu | ST-03 thiết bị khác, xung đột |
   | 7 | Safari với cookie `Secure` trên `http://localhost` | Safari: đăng nhập; nếu không giữ được phiên (tải lại thì về "Đăng nhập"), ghi lại và kiểm tra hướng dẫn `AUTH_COOKIE_SECURE=false` trong `backend/README.md` (Task 5) làm Safari hoạt động | Spec mục 8 |
   | 8 | Trình quản lý mật khẩu (WCAG 3.3.8) | Chrome: đăng ký thì trình duyệt đề xuất lưu mật khẩu; đăng xuất, đăng nhập thì điền được email và mật khẩu đã lưu; dán mật khẩu từ clipboard được | Bảo mật "Form đăng nhập, đăng ký đạt WCAG 2.2 AA" |
   | 9 | Đăng xuất trên máy dùng chung | Tài khoản có schema; đăng xuất; IndexedDB `schemaforge` không còn record có `ownerId` của tài khoản, bảng `session` rỗng; schema của khách còn | ST-02 đăng xuất |
   | 10 | Bàn phím và trình đọc màn hình cho phần mới | Chỉ dùng bàn phím và VoiceOver: đăng nhập, hộp thoại đưa schema lên, hộp thoại xung đột, hộp thoại đăng xuất, "Lưu lên cloud" trên toolbar và dòng danh sách; focus vào hộp thoại khi mở và về đúng chỗ khi đóng; trạng thái "Xung đột", "Không đồng bộ được" được đọc | Spec mục 6 WCAG, spec phần 3 mục 12 |
   | 11 | Độ tương phản và kích thước mục tiêu | DevTools ở cả hai theme: nhãn trạng thái trên danh sách và toolbar, banner, chữ lỗi của form ≥ 4.5:1; nút hiện/ẩn mật khẩu, nút "Giải quyết", "Thử lại", "Lưu lên cloud" ≥ 24×24 CSS px | Spec mục 6 WCAG 2.5.8 |
   | 12 | `returnTo` | Khi chưa đăng nhập, bấm "Lưu lên cloud" trong editor → "Đăng nhập" → đăng nhập xong quay về đúng `/schemas/<id>`; mở `/sign-in?returnTo=//evil.example` rồi đăng nhập thì về `/` | ST-02 `SignInPrompt`, `returnTo` |

3. **Không đạt ở mục nào** thì orchestrator dừng mục đó, giao một task sửa riêng (debugger hoặc frontend-engineer, có test tái hiện khi tái hiện được trên jsdom), commit theo `.claude/rules/git.md`, rồi chạy lại đúng mục đó. Kết quả cũ và lần chạy lại đều được ghi.
4. **Mục "Không chạy được"** (ví dụ máy không có Safari hay Firefox) được ghi rõ lý do; orchestrator hỏi người dùng có chấp nhận để lại hay không, và ghi câu trả lời.
5. **Kết quả** gửi cho Task 38 dưới dạng bảng `| # | Hạng mục | Kết quả | Trình duyệt | Ghi chú |`, kèm ngày chạy và commit đã kiểm tra.

**Test:** không thêm test tự động. Mục 4 (hai tab), 6 (hai trình duyệt), 7 (Safari), 8 (trình quản lý mật khẩu) là phần mà jsdom không kiểm được (spec mục "Rủi ro": Web Locks, `BroadcastChannel` chỉ có bản giả).

**Kiểm tra:** mọi dòng của bảng ở bước 2 có kết quả; không dòng nào "Không đạt" mà chưa có lần chạy lại đạt hoặc quyết định của người dùng.

**Commit:** không có (task không sửa file). Commit của task sửa lỗi phát sinh theo bước 3.

**Xong khi:**

- Bảo mật và chung "Checklist kiểm tra tay ở mục 11 đã chạy xong, kết quả ghi vào PR" (ghi kết quả thực hiện ở Task 38).
- ST-02 "hai tab cùng gặp access token hết hạn không bị đăng xuất (… kiểm tra tay)"; ST-03 "hai trình duyệt thật: kiểm tra tay"; Bảo mật "trình quản lý mật khẩu của Chrome lưu và điền được (kiểm tra tay)".

## Task 38: Tài liệu cuối (`roadmap.md`, `architecture.md`, `CLAUDE.md`), kiểm tra toàn repo

**Mục tiêu:** xác nhận toàn repo xanh ở local và CI, đối chiếu đủ tiêu chí hoàn thành của spec, ghi kết quả kiểm tra tay, và đưa tài liệu về đúng trạng thái sau phần 4.

**Agent:** spec-writer (tài liệu), orchestrator (lệnh kiểm tra, CI, câu hỏi cho người dùng). **Phụ thuộc:** 3, 4, 37. **Đợt:** 13.

**File sở hữu:**

- Sửa `document/roadmap.md` (chỉ ô "Trạng thái" của dòng phần 4).
- Sửa `document/architecture.md` (bảng "Quyết định đã chốt", mục "Luồng dữ liệu" → "Người dùng đã đăng nhập" nếu lệch, mục "Chưa chốt").
- Sửa `document/plans/2026-09-17-auth-cloud-plan.md` (thêm mục cuối "Kết quả kiểm tra tay").
- Sửa `CLAUDE.md`, chỉ đoạn "Current status", và chỉ khi prompt giao task ghi rõ người dùng đã đồng ý; nếu không, ghi đoạn đề xuất vào báo cáo.

**Các bước:**

1. **Kiểm tra toàn repo** (orchestrator, root, tiền tố Node của "Điều kiện tiên quyết", bản clone sạch hoặc worktree mới từ `master`):

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm format:check
   pnpm turbo run test:e2e --filter @schemaforge/backend
   ```

   Kết quả mong đợi: mọi lệnh thoát mã 0; `pnpm install` không in cảnh báo build script bị chặn (`Ignored build scripts`); `pnpm test` không có dòng `ERROR: Coverage for lines (…) does not meet global threshold` ở `packages/core` (90%), `packages/api-contract` (90%), `backend` (80%), `frontend` (80%); lệnh e2e cần container `local_postgres` và `backend/.env.test` do người dùng tạo. Trên CI: `gh run list --branch master --limit 1` rồi `gh run view <id>` cho thấy job `verify` và `e2e` đều `success` ở commit cuối.
2. **Đối chiếu tiêu chí hoàn thành:** đi hết bảng [Đối chiếu tiêu chí hoàn thành](#đối-chiếu-tiêu-chí-hoàn-thành); với mỗi dòng ghi test (tên file, tên test hoặc số e2e, tích hợp) đang xanh hoặc mục checklist của Task 37 đã đạt. Dòng chưa phủ thì **dừng và báo**, không tự đánh dấu xong.
3. **Kết quả kiểm tra tay:** thêm mục `## Kết quả kiểm tra tay` ở cuối plan này, chép bảng kết quả của Task 37 (`| # | Hạng mục | Kết quả | Trình duyệt | Ghi chú |`), ngày chạy, commit đã kiểm tra, và quyết định của người dùng cho mục "Không chạy được".
4. **`document/roadmap.md`:** đổi "Trạng thái" của dòng phần 4 sang `Xong`. Không đụng dòng khác; ghi chú thứ tự chỉ sửa khi phụ thuộc thật sự đổi.
5. **`document/architecture.md`:**
   - So bảng "Quyết định đã chốt" với `backend/package.json`, `frontend/package.json`, `packages/api-contract/package.json` và `pnpm-workspace.yaml`: gói hay quyết định của phần 4 chưa có dòng (ví dụ Helmet, `class-validator`, `passport-jwt`, `supertest`, cookie gợi ý `sf-auth-hint`, Dexie version 2 và đồng bộ, đăng xuất xóa cache, e2e trên PostgreSQL thật) thì thêm một dòng `| Hạng mục | Quyết định | Lý do |` theo spec. Dòng đã có mà thực tế khác (ví dụ phiên bản Prisma, cách chốt Vấn đề 1 về `@nestjs/throttler`) thì sửa đúng dòng đó.
   - Mục "Luồng dữ liệu" → "Người dùng đã đăng nhập": câu "Chi tiết được chốt trong spec của phần "Auth + lưu cloud"" đổi thành link tới spec.
   - **Nơi deploy** (Vấn đề 15, đã chốt phương án (a)). Spec mục 12 để việc chọn nơi deploy cho "một bước sau trong phần 4". Trước bước 4, orchestrator vẫn hỏi lại người dùng như phương án đã chốt. Mặc định: đánh dấu `Xong` cho phần code, và thêm vào "Chưa chốt" dòng "Nơi deploy frontend, backend, PostgreSQL" với ứng viên "gói miễn phí; frontend và backend cùng site (spec phần 4 mục 8, 12)" và phần sẽ chốt "phần 4, bước triển khai". Người dùng chọn giữ `Đang làm` tới khi deploy xong thì bỏ bước 4 và ghi lý do trong báo cáo.
6. **`CLAUDE.md`, "Current status"** (chỉ khi được giao, xem "File sở hữu"): phần 4 đã xong; `backend/` có auth bằng email và mật khẩu (cookie `HttpOnly`, refresh xoay vòng, rate limit) và API lưu schema trên PostgreSQL qua Prisma; `packages/api-contract` là hợp đồng chung; frontend có đăng nhập, đăng ký, đồng bộ local với cloud; bỏ câu "`backend/` validates its env but has no routes yet" và sửa câu về các spec còn lại cho đúng trạng thái lúc đó. Thêm lệnh e2e (`pnpm --filter @schemaforge/backend test:e2e`, cần PostgreSQL) vào bảng "Commands" nếu người dùng đồng ý.
7. Prettier không format `*.md`: kiểm tra tay mọi bảng đã sửa có hàng phân cách khớp số cột và `|` trong ô được escape thành `\|`; link tương đối và `#anchor` mở được.

**Test:** không thêm test. Bước 1 chạy lại toàn bộ bộ test; báo cáo ghi số test và % coverage dòng của từng package, và kết quả job CI.

**Kiểm tra:** bảy lệnh ở bước 1 như mong đợi; `git status --porcelain` chỉ còn file tài liệu trong "File sở hữu".

**Commit:** `docs: mark auth and cloud storage as done`

**Xong khi:**

- Bảo mật và chung "`pnpm install --frozen-lockfile` từ bản clone sạch không còn cảnh báo build script bị chặn; `pnpm lint`, `pnpm typecheck`, `pnpm test` (đạt ngưỡng coverage) và `pnpm build` chạy qua ở local và CI; job `e2e` xanh trên CI" (bước 1).
- Bảo mật và chung "Checklist kiểm tra tay ở mục 11 đã chạy xong, kết quả ghi vào PR" (bước 3, cùng Task 37).
- Bảo mật và chung "`architecture.md`, `roadmap.md` và danh sách tính năng (cách viết ST-03) được cập nhật …" (bước 4, 5; danh sách tính năng đã sửa ở Task 3, bước 2 xác nhận).
- Mọi dòng của bảng đối chiếu có bằng chứng (bước 2).

## Đối chiếu tiêu chí hoàn thành

Mỗi dòng là một checkbox trong mục "Tiêu chí hoàn thành" của spec, theo đúng thứ tự. Cột "Task" liệt kê task cài đặt và task kiểm chứng (e2e, tích hợp, kiểm tra tay). Task 38 bước 2 xác nhận từng dòng có bằng chứng.

| # | Nhóm | Tiêu chí (rút gọn) | Bằng chứng theo spec | Task |
|---|---|---|---|---|
| 1 | ST-02 | Đăng ký dùng được ngay; cookie `HttpOnly`, `Secure`, `SameSite=Strict`, đúng `Path` | e2e 1 | 12, 13, 15, 27; 37 (mục 1) |
| 2 | ST-02 | Đăng nhập, đăng xuất; sau đăng xuất `me` trả `401`, refresh token cũ không dùng được | e2e 1, 3 | 12, 13, 15, 25, 34; 36 (tích hợp 6) |
| 3 | ST-02 | Sai email hoặc sai mật khẩu cùng response; mật khẩu quá ngắn, quá dài, phổ biến bị từ chối với thông báo đã dịch | e2e 2; test component | 11, 13, 15, 19, 27 |
| 4 | ST-02 | Lần đăng nhập thứ 11 và lần đăng ký thứ 6 trả `429` kèm `Retry-After` | e2e 11 | 10, 13, 15 |
| 5 | ST-02 | Refresh xoay token, dùng lại thì thu hồi cả họ; hai tab cùng gặp access token hết hạn không bị đăng xuất | e2e 3; unit `session-refresher`; kiểm tra tay | 12, 15, 20; 37 (mục 4) |
| 6 | ST-02 | Chưa đăng nhập, "Lưu lên cloud" mở `SignInPrompt`; quay về qua `returnTo`, `returnTo` ra ngoài bị bỏ; editor vẫn dùng bình thường | unit `sanitize-return-to`; test component | 21, 26, 27, 30, 33; 37 (mục 12) |
| 7 | ST-02 | Đăng nhập không làm mất schema của khách; người dùng được hỏi đưa lên | tích hợp 1 | 24, 28, 35 |
| 8 | ST-02 | Khách không có cookie gợi ý không gọi mạng trong các hành trình của phần 3 | tích hợp 7 | 6, 21, 26, 35 |
| 9 | ST-03 | Backend validate bằng `parseSchemaDocument`, `422` kèm `code`, `path`; issue ngữ nghĩa vẫn lưu; đọc từ database cũng parse | e2e 6; unit `SchemasService` | 14, 16 |
| 10 | ST-03 | Mỗi lần lưu local được đẩy với `expectedRevision`; offline hiện "Chưa đồng bộ", tự đẩy khi có mạng | tích hợp 2 | 7, 23, 30, 36; 37 (mục 5) |
| 11 | ST-03 | Mở được schema từ thiết bị khác trên database trống; hai trình duyệt thật | tích hợp 4; kiểm tra tay | 22, 29, 32, 35; 37 (mục 6) |
| 12 | ST-03 | Lần đăng nhập đầu hỏi đưa schema nào lên; schema không chọn ở lại trình duyệt | tích hợp 1 | 24, 28, 35 |
| 13 | ST-03 | Revision lệch trả `409` kèm `currentRevision`; hai `PUT` đồng thời chỉ một thành công; hộp thoại, cả hai lựa chọn đúng | e2e 4, 7; tích hợp 3 | 14, 16, 23, 31, 36; 37 (mục 6) |
| 14 | ST-03 | Body quá 2 MiB trả `413` trước khi parse; schema thứ 101 trả `403` | e2e 9, 14 | 9, 14, 16 |
| 15 | ST-03 | Dexie nâng từ version 1 lên version 2 không mất dữ liệu | unit `database` | 7 |
| 16 | ST-04 | Danh sách cloud phân trang keyset, tối đa 100 mỗi trang; màn hình gộp cloud với cache, có nhãn, vẫn hiện cache khi không tải được | e2e 8; unit `merge-schema-list`; test component | 14, 16, 22, 32 |
| 17 | ST-04 | Mở và xóa từng schema từ danh sách; xóa cần mạng và xóa cả cache | tích hợp 5 | 29, 33, 35 |
| 18 | ST-04 | Chỉ thấy và thao tác schema của mình; của người khác trả `404` | e2e 5 | 14, 16 |
| 19 | Bảo mật và chung | Mọi route ngoài năm route public trả `401` khi không có cookie | e2e 12 | 9, 12, 13, 17 |
| 20 | Bảo mật và chung | Request thay đổi dữ liệu không có `Origin` hợp lệ trả `403`; CORS chỉ cho `CORS_ORIGINS` | e2e 10 | 9, 17 |
| 21 | Bảo mật và chung | Header của Helmet; lỗi không lộ stack, SQL, lỗi Prisma | e2e 13 | 9, 17 |
| 22 | Bảo mật và chung | Không có token trong `localStorage`, IndexedDB hay cookie đọc được bằng JavaScript; `sf-auth-hint` chỉ chứa `1` | e2e 1 (`HttpOnly`); unit cookie gợi ý; kiểm tra tay | 12, 15, 21; 37 (mục 1, 2) |
| 23 | Bảo mật và chung | Backend từ chối khởi động khi thiếu biến bắt buộc, hoặc production có `AUTH_COOKIE_SECURE=false`, origin `http`, secret mẫu | unit `env` | 5 (`backend/src/config/env.ts`, `env.spec.ts`); 9 (`ConfigModule.forRoot({ validate })` trong `app.module.ts`) |
| 24 | Bảo mật và chung | `pnpm install --frozen-lockfile` không cảnh báo build script; lint, typecheck, test (đạt coverage), build ở local và CI; job `e2e` xanh | CI, lệnh toàn repo | 2, 18, 38 |
| 25 | Bảo mật và chung | Form đăng nhập, đăng ký đạt WCAG 2.2 AA; trình quản lý mật khẩu của Chrome lưu và điền được | test component; kiểm tra tay | 27; 37 (mục 8) |
| 26 | Bảo mật và chung | Mọi chuỗi mới có `vi` và `en`; `apiErrors` phủ đủ `ApiErrorCode` | typecheck | 19, 27, 28, 30, 31, 32, 33, 34; 38 (bước 1) |
| 27 | Bảo mật và chung | Checklist kiểm tra tay ở mục 11 đã chạy, kết quả được ghi | kiểm tra tay | 37, 38 |
| 28 | Bảo mật và chung | `architecture.md`, `roadmap.md`, danh sách tính năng (ST-03) được cập nhật | rà tài liệu | 3, 38 |

**Tiêu chí chưa có task phủ:** không có. Hai điểm phủ chưa trọn, Task 38 cần xác nhận:

- Dòng 22: spec không đặt test tự động riêng cho "không có token trong `localStorage`, IndexedDB"; bằng chứng là thiết kế (cookie `HttpOnly`, Task 12), unit test cookie gợi ý (Task 21) và mục 2 của checklist Task 37.
- Dòng 27: spec ghi "kết quả ghi vào PR", nhưng repo commit và push thẳng lên `master` (`.claude/rules/git.md`), không có PR. Plan ghi kết quả vào mục "Kết quả kiểm tra tay" của plan này (Task 38 bước 3).
