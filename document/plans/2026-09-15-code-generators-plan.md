# Plan: Code generators

Plan triển khai phần 6 trong [roadmap.md](../roadmap.md), dựa trên spec đã duyệt [2026-09-14-code-generators-design.md](../specs/2026-09-14-code-generators-design.md) (commit 4e14920; mọi quyết định cần xác nhận đã được user xác nhận). Spec là nguồn gốc: plan chỉ chia việc, chốt các chi tiết mức cài đặt mà spec để lại, và không đổi quyết định nào của spec. Chỗ spec còn hở hoặc mâu thuẫn được nêu ở mục [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan).

Plan được viết trong hai lượt. Lượt thứ nhất viết phần khung, bảng task đầy đủ, thân của các task nền và ba generator SQL DDL. Lượt thứ hai viết thân các task còn lại ở cuối file, theo đúng quy ước, điểm nóng và bảng task ở đây.

## Mục tiêu

`packages/core` có 12 generator thuần (PostgreSQL, MySQL, SQL Server, Prisma, Drizzle, TypeScript, Zod, Mock API, OpenAPI, seed, DBML, Markdown), mỗi đích một subpath `@schemaforge/core/generators/<đích>`, dùng chung các hàm định danh, literal, tên ràng buộc, biểu diễn JSON và đồ thị quan hệ trong `generators/shared/`. Output xác định, luôn an toàn với tên và comment bất kỳ, và báo diagnostic khi đích không biểu diễn được một khái niệm. Package `packages/codegen-conformance` chạy output qua công cụ đích thật trong một job CI riêng. Frontend có code panel sinh code trong Web Worker và highlight bằng Shiki.

## Điều kiện tiên quyết

- Phần 2 đã merge tới **Task 26** của [plan phần 2](2026-09-14-core-schema-model-plan.md): `src/index.ts` export đủ public API, `@schemaforge/core/testing` export factory (`makeTable`, `makeColumn`, `makeRelation`, `makeIndex`, `makeEnum`, `makeSubjectArea`, `makeNote`, `buildSchema`, `createCounterIdGenerator`), `unwrapOk`, `unwrapError` và `createSampleSchema`. Mọi task của plan này phụ thuộc Task 26 của phần 2, trừ các mục chỉ lập kế hoạch. Task 27, 28 của phần 2 (bỏ `PRODUCT_NAME`, tài liệu) không chặn plan này, nhưng Task 5 dưới đây sửa `src/index.ts` nên phải merge sau Task 27 của phần 2 nếu Task 27 chưa xong (xem [Điểm nóng](#điểm-nóng-khi-làm-song-song)).
- Các hàm nội bộ của phần 2 mà generator dùng lại đã có: `sortTables`, `sortEnums`, `sortSubjectAreas`, `sortIndexes`, `sortRelations`, `sortNotes` (`src/model/ordering.ts`, Task 7 phần 2); `isValidDefaultLiteral` (`src/validation/rules/default-literals.ts`, Task 10); rule kiểu custom trong `src/validation/rules/columns.ts` (Task 12); `isUniqueColumnSet` (`src/validation/column-uniqueness.ts`, Task 8); `utf8ByteLength`, `toNameKey` (`src/model/name-limits.ts`); `sortByPathThenCode` (`src/document-path.ts`).
- Task 32–34 (frontend) phụ thuộc thêm **phần 3 (Editor MVP)** đã merge: store của editor, `getIssues`, `notify`, `resolveIssueTarget`, `buildContentSecurityPolicy`, i18n `lib/i18n/locales/{en,vi}/`, toolbar và cột panel phải.
- Node 24 qua nvm. Mọi lệnh `node`, `pnpm`, `npm` trong shell không tương tác chạy ở root repo với tiền tố:

  ```bash
  source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
  ```

  `node -v` phải ra `v24.x`.
- Working tree sạch trên `master`, và `pnpm --filter @schemaforge/core test` đang xanh trước khi bắt đầu.

## Cách dùng plan

- Mỗi task giao cho một subagent chưa đọc spec và chưa thấy thảo luận nào. Prompt của subagent gồm: mục "Quy ước chung cho mọi task", mục "Điểm nóng khi làm song song", toàn bộ nội dung task, đường dẫn spec kèm các mục spec mà task tham chiếu, và các task nền mà task dùng lại (chỉ phần "Chữ ký và hành vi").
- Subagent không commit, không push, không tạo subagent khác. Orchestrator kiểm tra kết quả rồi commit đúng các file của task với commit message ghi trong task (`.claude/rules/git.md`: một dòng, không body, không trailer).
- Task song song chạy trong worktree riêng (`isolation: "worktree"`) tạo từ **HEAD local** của `master` (không từ `origin`), vì lệnh typecheck, lint, test của core chạy trên cả package và sẽ đỏ theo file đang viết dở của task khác nếu dùng chung working tree. Trong worktree, việc đầu tiên là chạy tiền tố Node rồi `pnpm install --frozen-lockfile`. Orchestrator commit trong worktree, merge về `master` lần lượt từng task, và chạy lại lệnh kiểm tra của core sau mỗi lần merge trước khi merge task tiếp theo.
- Cột "Đợt" trong bảng task là thứ tự chạy gợi ý; orchestrator bắt đầu một task ngay khi mọi phụ thuộc của nó đã merge. Mỗi đợt tối đa 5 task, tập file sở hữu rời nhau.
- Task có bước kiểm chứng "chỉ CI" (conformance) cần push lên remote để job `conformance` chạy. Orchestrator hỏi user trước mỗi lần push.

## Quy ước chung cho mọi task

### Chuẩn bị

- Đọc `CLAUDE.md`, `.claude/rules/core.md`, `typescript.md`, `code-quality.md`, `testing.md`, `git.md` và các mục spec mà task tham chiếu trước khi viết file. Task ở `frontend/` đọc thêm `nextjs.md`, `react.md`, `security.md`.
- Mọi lệnh `node`, `pnpm`, `npm` chạy ở root repo (hoặc root worktree) với tiền tố Node ở mục "Điều kiện tiên quyết".
- **Chỉ tạo và sửa file có trong mục "File sở hữu" của task.** Cần sửa file khác (kể cả `src/index.ts`, `package.json`, file của task khác, snapshot của đích khác) thì dừng và báo orchestrator.
- **Lockfile.** Chỉ Task 3 và Task 32 chạy `pnpm install` có ghi `pnpm-lock.yaml`. Không task nào khác chạy `pnpm add`, `pnpm remove`, `pnpm update` hay `pnpm install` không có `--frozen-lockfile`. Thiếu dependency thì dừng và báo.

### TDD

- Viết test trước, chạy thấy đỏ, rồi mới cài đặt. Trong vòng đỏ-xanh, chạy riêng file hoặc thư mục test (không bật coverage nên không vướng ngưỡng):

  ```bash
  pnpm --filter @schemaforge/core exec vitest run src/generators/<đường-dẫn>
  ```

- Test import `describe`, `it`, `expect` từ `vitest`. Mỗi test một hành vi, tên là câu tiếng Anh. Không vòng lặp hay `if` trong test; dữ liệu dạng bảng dùng `it.each`. Dựng dữ liệu bằng factory của `src/testing/factories.ts` và fixture của `src/testing/`; test import thẳng module cần dùng, không import `src/index.ts`. So sánh cấu trúc bằng `toStrictEqual`.
- Mỗi quy tắc trong mục "Chữ ký và hành vi" của task có ít nhất một test nhắm đúng quy tắc đó (kiểm tra một dòng, một đoạn output bằng `toContain` hoặc output nhỏ đầy đủ). Snapshot không thay cho test nhắm đích.

### Code trong `packages/core`

- Tiếng Anh cho code, identifier, comment, tên test. Import tương đối có đuôi `.js` (`moduleResolution: nodenext`). Chuỗi dùng nháy kép (Prettier mặc định). `import type` cho import chỉ có type.
- Không `as` (trừ `as const`), không `!`, không `any`, không từ khóa `enum`, không default export, không `@ts-ignore`. Hàm export khai báo kiểu trả về. Boolean (biến, tham số, thuộc tính của type) bắt đầu bằng `is`, `has`, `can`, `should`. Hàm dưới khoảng 40 dòng, file dưới khoảng 300 dòng, lồng tối đa 3 cấp.
- **Thuần và xác định.** Không state có thể thay đổi ở cấp module; state tạm (ví dụ `NameAllocator`) được tạo mới trong mỗi lần gọi generator. Không đọc thời gian, không ngẫu nhiên ngoài PRNG có seed của CG-08.
- **API bị cấm trong `src/` không phải test:** mọi global trong `CORE_FORBIDDEN_GLOBALS` của `eslint.config.mjs` (`window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `fetch`, `process`, `Buffer`, `setTimeout`, `setInterval`), cùng `TextEncoder`, `TextDecoder`, `structuredClone`, `Date`, `Intl`, `localeCompare`, `Math.random`, `crypto`, `btoa`, `atob` và mọi import `node:*`. `tsc --noEmit` có thể không báo (kiểu của Vitest kéo `@types/node` vào) nhưng `pnpm build` sẽ fail. `String.prototype.normalize` được phép.
- So chuỗi bằng `<` và `>` (theo code unit), không dùng `localeCompare`.
- Không throw với input đúng cấu trúc, kể cả schema còn issue ngữ nghĩa (spec mục 1, 2). Option sai miền là lỗi lập trình: throw `RangeError`.
- **Không bao giờ nối tên, comment, giá trị enum hay literal của người dùng vào output mà không qua hàm quote hoặc escape trong `generators/shared/`** (spec mục 5). Không tự viết lại hàm quote trong thư mục đích.
- Duyệt phần tử của schema chỉ qua các hàm `sort*` của phần 2 (hoặc `columnIds`, `primaryKeyColumnIds`, `columnPairs` của phần tử), không bao giờ theo thứ tự khóa của map (`Object.values`, `Object.keys`, `for…in`).
- Tạo object có khóa lấy từ tên người dùng bằng `Object.fromEntries` hoặc khóa tính toán trong literal, không gán `object[name] = value`: phép gán với khóa `__proto__` đổi prototype thay vì tạo thuộc tính.
- Output được ghép bằng `renderFileContent` (Task 2), nên luôn kết thúc bằng đúng một `\n`. Diagnostic trả ra qua `finalizeDiagnostics` (Task 2): sắp theo `path` rồi `code`, không lặp cặp `code` và `path`.

### Snapshot

- **Vị trí:** `packages/core/src/generators/__snapshots__/<đích>/<fixture>[.<biến thể>].<phần mở rộng>`, phần mở rộng theo `language` của output: `sql`, `prisma`, `ts`, `json`, `dbml`, `md`. Mỗi file nội dung có một file anh em `<cùng tên gốc>.diagnostics.txt` chứa `formatDiagnosticsSnapshot(result.diagnostics)` (Task 2). Ví dụ `__snapshots__/prisma/sample.mysql.prisma` và `__snapshots__/prisma/sample.mysql.diagnostics.txt`.
- **Fixture:** `sample` (`createSampleSchema()`), `naming-edge` (`createNamingEdgeSchema()`), `target-limit` (`createTargetLimitSchema()`), `empty` (`createEmptySchema("Empty")`). `createLargeSchema()` chỉ dùng cho benchmark và property test, không có snapshot.
- **Biến thể:** đích có option ghi giá trị option chính vào tên (`provider`, `dialect`, `format` của seed). Đích không có option không có biến thể.
- **Cách viết:** test `async`, gọi `await expect(result.file.content).toMatchFileSnapshot("../__snapshots__/<đích>/<fixture>.<ext>")` từ file test nằm trong `src/generators/<đích>/`, và tương tự cho `.diagnostics.txt`. Mỗi đích × fixture × biến thể là một `it` riêng (`it.each` được).
- **Tạo và cập nhật:** chỉ ghi snapshot của đích mình, bằng `pnpm --filter @schemaforge/core exec vitest run src/generators/<đích> -u`. Sau khi ghi, đọc lại từng file snapshot và đối chiếu với spec; báo cáo của task liệt kê các file snapshot đã tạo. CI không ghi snapshot mới (thiếu là fail), nên snapshot phải được commit cùng task.
- Thư mục `__snapshots__` được Task 1 loại khỏi typecheck, lint, Prettier, build và coverage. Không thêm ngoại lệ ở chỗ khác.

### Kiểm tra trước khi báo xong

Trừ khi task ghi khác, chạy ở root repo:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm --filter @schemaforge/core typecheck
pnpm --filter @schemaforge/core lint
pnpm --filter @schemaforge/core test
pnpm --filter @schemaforge/core build
pnpm exec prettier --check <các file sở hữu không nằm trong __snapshots__>
git status --porcelain
```

Kết quả mong đợi: năm lệnh đầu thoát mã 0; `test` in mọi test pass và không có dòng `ERROR: Coverage for lines (…) does not meet global threshold (90%)`; `git status` chỉ còn file của task. Không để lại file tạm.

Báo cáo gồm: file đã tạo hoặc sửa, lệnh đã chạy kèm kết quả chính (số test, % coverage số dòng), snapshot đã tạo, vấn đề còn mở.

## Điểm nóng khi làm song song

| Điểm nóng | Cách xử lý |
|---|---|
| `exports` trong `packages/core/package.json` | Spec mục 1 dùng **một pattern** `"./generators/*"` thay vì một mục cho từng đích. Task 5 thêm pattern này một lần; mỗi đích có subpath riêng ngay khi task của đích tạo `src/generators/<đích>/index.ts`, nên không task đích nào sửa `package.json`. `generators/shared/` và `generators/__snapshots__/` không có `index.ts` nên không import được qua pattern. Ngoài Task 5, chỉ Task 28 sửa `package.json` của core (thêm script `bench`). Dependency của core không đổi trong cả plan |
| Cấu hình loại trừ của core và root: `packages/core/tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `eslint.config.mjs`, `.prettierignore` | Chỉ Task 1 sửa, một lần cho mọi đích: loại `src/**/__snapshots__/**` khỏi typecheck, lint, Prettier, build và coverage; loại `src/**/*.bench.ts` khỏi build và coverage cho Task 28. Task sau cần ngoại lệ mới thì dừng và báo |
| `src/index.ts`, `src/index.test.ts` của core | Task 5 thêm giá trị và type chung của generator. Task 22 chỉ thêm một dòng `export type { SeedDataset }` vào `src/index.ts` (không đổi danh sách giá trị lúc chạy, nên không sửa `index.test.ts`). Không task nào khác sửa. Task 5 chạy sau Task 27 của phần 2 (Task 27 cũng sửa hai file này) |
| `src/testing/index.ts`, `src/testing/index.test.ts` | Chỉ Task 4 sửa (export ba fixture mới). Helper test của task khác nằm trong file riêng không export |
| `generators/shared/*` | Mỗi file thuộc đúng một task nền và được merge **trước** mọi task đích dùng nó: Task 2 (`generator-types.ts`, `diagnostic-codes.ts`, `diagnostics.ts`, `render-file.ts`), Task 6 (`identifiers.ts`, `name-allocator.ts`, `javascript-reserved-words.ts`), Task 7 (`sql-literals.ts`), Task 9 (`constraint-names.ts`), Task 10 (`json-representation.ts`, `rest-resources.ts`), Task 11 (`relation-graph.ts`, `relation-field-names.ts`), Task 12 (`dialect-types.ts`, `dialect-constraints.ts`, `mysql-identifiers.ts`), Task 13 (`sql-ddl-model*.ts`). Task đích chỉ import. Cần hành vi dùng chung mới thì dừng và báo; orchestrator tạo task sửa file nền, chạy khi không còn task đích nào đang dùng file đó |
| Import giữa các thư mục đích | Cấm, trừ `mock-api/` import `buildSeedDataset` từ `seed/` (spec CG-06). Phần dùng chung giữa hai đích phải nằm trong `shared/` |
| Hàm nội bộ của phần 2 cần export thêm | Task 7 tách hàm kiểm tra giá trị mặc định dùng chung khỏi `validation/rules/column-defaults.ts` và `default-literals.ts`; Task 12 tách hàm kiểm tra cú pháp kiểu custom khỏi `validation/rules/columns.ts`. Cả hai chỉ tách hàm, không đổi hành vi (test cũ phải pass nguyên vẹn); hai task sửa các file khác nhau nên chạy song song được. Không task nào khác sửa `src/validation/` |
| `GENERATOR_DIAGNOSTIC_CODES` | Task 2 tạo đủ 16 mã theo spec mục 4 kèm hợp đồng `path` cho từng mã; test ghim danh sách. Task sau chỉ import. Thiếu mã là thay đổi spec: dừng và báo. Frontend (Task 34) dùng `satisfies Record<GeneratorDiagnosticCode, string>`, nên danh sách phải cố định trước Task 34. Mã `SeedIssue` của CG-08 là danh mục riêng do Task 21 tạo trong `generators/seed/` |
| `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Chỉ Task 3 (dependency của package conformance, mục `allowBuilds`) và Task 32 (`shiki` cho frontend) ghi lockfile. Hai task này không chạy đồng thời với nhau, và orchestrator không chạy chúng đồng thời với task ghi lockfile của plan khác (phần 3, phần 7). Sau khi merge, worktree đang mở chạy lại `pnpm install --frozen-lockfile` |
| Package mới `packages/codegen-conformance` | Task 3 viết toàn bộ `package.json` của package (tên, script, dependency) để task sau không sửa manifest. Task 8 tạo `tsconfig.json`, `vitest.config.ts`, helper dùng chung trong `src/support/` và test probe; Task 29, 30, 31 mỗi task sở hữu file test riêng trong `src/` và chỉ import helper. Cần helper mới thì đặt trong file test của mình hoặc dừng và báo |
| Job CI `conformance`, `turbo.json`, script root `test:conformance` | Chỉ Task 8 sửa `.github/workflows/ci.yml`, `turbo.json` và `package.json` root. Đặt job thành status check bắt buộc là cài đặt trên GitHub, Task 35 nhắc user |
| Kiểm chứng chỉ chạy trong CI | Máy dev không có Docker. Task 8 được push trước; job `conformance` xanh và kết quả probe MySQL, SQL Server (spec mục "Rủi ro") được ghi vào báo cáo trước khi Task 15, 16 bắt đầu. Probe khác ma trận của spec mục 4 thì dừng, user quyết định sửa spec, rồi mới chạy Task 15, 16 |
| Snapshot | Mỗi task đích chỉ ghi `__snapshots__/<đích>/`. Fixture của Task 4 đổi sau khi đã có snapshot thì orchestrator tạo một task riêng sửa fixture và ghi lại mọi snapshot bị ảnh hưởng, không chạy song song với task đích |
| File i18n và CSP của frontend | Task 34 sở hữu `frontend/src/lib/i18n/locales/{en,vi}/code-generator.ts`, `generator-diagnostics.ts`, phần đăng ký namespace trong resource và `i18next.d.ts`, và `buildContentSecurityPolicy`. Task 33 (worker) không có chuỗi hiển thị. Hai task chỉ chạy sau khi phần 3 merge; orchestrator đối chiếu danh sách file sở hữu với task đang chạy của plan khác trước khi giao |

## Phiên bản

Kiểm tra lại ngày 2026-09-15 bằng `npm view <package> dist-tags time peerDependencies`; image kiểm tra qua API của Docker Hub và MCR. pnpm từ chối bản phát hành chưa quá 24 giờ (`minimumReleaseAge`), nên mọi phiên bản dưới đây đều phát hành trước 2026-09-14. Package đã có trong catalog của phần 1 dùng `catalog:`. Core không thêm dependency nào: Zod vẫn là runtime dependency duy nhất, `fast-check` đã có.

| Thư viện, image | Khai báo | Bản chọn, ngày phát hành | Package khai báo | Ghi chú |
|---|---|---|---|---|
| `zod` | `catalog:` (`^4.6.4`) | 4.6.5, 2026-09-13 | `packages/codegen-conformance` (dev) | Trùng catalog; output CG-05 là cú pháp Zod 4 |
| `typescript` | `catalog:` (`~6.0.3`) | 6.0.3, 2026-04-16 | conformance (dev) | Dist-tag `latest` đã là 7.0.2 (2026-07-08); giữ 6.0.3 như catalog và spec. Chuyển sang 7 là quyết định riêng cho toàn repo |
| `vitest` | `catalog:` (`^5.0.0`) | 5.0.0, 2026-09-03 | conformance (dev) | |
| `@types/node` | `catalog:` (`^24.13.4`) | theo catalog | conformance (dev) | |
| `prisma` | `^7.10.0` | 7.10.0, 2026-08-25 | conformance (dev) | Dist-tag `latest` trỏ `8.0.0-rc.15` (pre-release, 2026-09-14). `prisma` có script `preinstall`, `@prisma/engines` có `postinstall` (Task 3 quyết định `allowBuilds`) |
| `drizzle-orm` | `^0.45.2` | 0.45.2, 2026-03-27 | conformance (dev) | 28 peer đều tùy chọn; typecheck không cần driver |
| `msw` | `^2.15.0` | 2.15.0, 2026-07-08 | conformance (dev) | Peer `typescript >= 4.8.x`; có script `postinstall` |
| `@readme/openapi-parser` | `^9.0.0` | 9.0.0, 2026-09-04 | conformance (dev) | Peer `openapi-types >=7`, khai báo tường minh bên dưới |
| `openapi-types` | `^12.1.3` | 12.1.3, 2023-05-24 | conformance (dev) | Peer của `@readme/openapi-parser` |
| `@dbml/core` | `^10.1.1` | 10.1.1, 2026-08-14 | conformance (dev) | |
| `testcontainers`, `@testcontainers/postgresql`, `@testcontainers/mysql`, `@testcontainers/mssqlserver` | `^12.1.0` | 12.1.0, 2026-08-04 | conformance (dev) | Engine `node >= 22.22`. Kéo theo `ssh2` (script `install`) và `cpu-features` tùy chọn (build native bằng `node-gyp`) |
| `pg`, `@types/pg` | `^8.23.0`, `^8.23.1` | 8.23.0 (2026-08-08), 8.23.1 (2026-08-17) | conformance (dev) | `pg` không kèm type |
| `mysql2` | `^3.24.4` | 3.24.4, 2026-09-08 | conformance (dev) | Kèm type |
| `mssql`, `@types/mssql` | `^12.7.2`, `^12.3.0` | 12.7.2 (2026-09-10), 12.3.0 (2026-04-16) | conformance (dev) | `mssql` không kèm type |
| `fast-check` | `^4.10.0` | 4.10.0, 2026-09-11 | `packages/core` (dev, đã có) | Property test Task 27; không đổi |
| `shiki` | `^4.4.3` | 4.4.3, 2026-08-10 | `frontend` (dependencies) | Task 32 |
| `postgres` | `18-alpine` | cập nhật 2026-08-15 | Không phải npm; ghi trong test Task 29 | Không có PostGIS (xem Vấn đề 3) |
| `mysql` | `8.4` | cập nhật 2026-09-12 | Test Task 8, 29 | |
| `mcr.microsoft.com/mssql/server` | `2022-latest` | có trên MCR; CU mới nhất `2022-CU26-ubuntu-22.04` | Test Task 8, 29 | Tag trôi theo CU; lỗi mới xuất hiện sau khi image cập nhật thì ghim tag CU trong Task 29 |

Không dùng: `@faker-js/faker`, `json-server` (spec CG-06, CG-08).

## Bảng task

`P2-26`, `P2-27` là Task 26, Task 27 của plan phần 2; `P3` là phần 3 (Editor MVP) đã merge. Số thứ tự task là định danh, không phải thứ tự chạy; bảng sắp theo đợt.

| Task | Nội dung | Phụ thuộc | Đợt |
|---|---|---|---|
| 0 | Chốt Vấn đề 1–12 với user, ghi lựa chọn vào spec (không có thân riêng, xem mục "Vấn đề phát hiện khi lập plan") | — | 0 (song song với đợt 1) |
| 1 | Hạ tầng snapshot: loại `__snapshots__` và `*.bench.ts` khỏi typecheck, lint, Prettier, build, coverage | P2-26 | 1 |
| 2 | Kiểu chung của generator, `GENERATOR_TARGETS`, `GENERATOR_DIAGNOSTIC_CODES` kèm hợp đồng `path`, `finalizeDiagnostics`, `renderFileContent`, `formatDiagnosticsSnapshot` | P2-26 | 1 |
| 3 | Dependency của `packages/codegen-conformance`, mục `allowBuilds`, lockfile | P2-26 | 1 |
| 4 | Fixture `createNamingEdgeSchema`, `createTargetLimitSchema`, `createLargeSchema` | P2-26 | 1 |
| 5 | Subpath `./generators/*` và export chung ở entry point chính | 2, P2-27 | 2 |
| 6 | Định danh: quote SQL, định danh code, `NameAllocator` (`identifiers.ts`, `name-allocator.ts`, `javascript-reserved-words.ts`) | 2 | 2 |
| 7 | Literal SQL và giá trị mặc định theo dialect (`sql-literals.ts`) | 2 | 2 |
| 8 | Khung package conformance, job CI `conformance`, probe hành vi MySQL và SQL Server | 3, 4 | 2 |
| 9 | Tên ràng buộc do generator đặt (`constraint-names.ts`) | 6 | 3 |
| 10 | Biểu diễn JSON và tài nguyên REST (`json-representation.ts`, `rest-resources.ts`) | 2, 6 | 3 |
| 11 | Đồ thị quan hệ và tên trường quan hệ (`relation-graph.ts`, `relation-field-names.ts`) | 2, 6 | 3 |
| 12 | Quy tắc kiểu và khóa theo dialect cho SQL, Prisma, Drizzle (`dialect-types.ts`, `dialect-constraints.ts`, `mysql-identifiers.ts`) | 2, 6 | 3 |
| 13 | Mô hình DDL dùng chung cho ba dialect (`sql-ddl-model.ts`) | 4, 7, 9, 11, 12 | 4 |
| 17 | CG-02 Prisma schema | 1, 4, 5, 7, 11, 12 | 4 |
| 18 | CG-03 Drizzle schema (PostgreSQL, MySQL) | 1, 4, 5, 7, 9, 11, 12 | 4 |
| 19 | CG-04 TypeScript types | 1, 4, 5, 10 | 4 |
| 20 | CG-05 Zod schema | 1, 4, 5, 10 | 4 |
| 14 | CG-01 SQL DDL PostgreSQL | 1, 4, 5, 13 | 5 |
| 15 | CG-01 SQL DDL MySQL | 1, 4, 5, 8 (CI xanh), 13 | 5 |
| 16 | CG-01 SQL DDL SQL Server | 1, 4, 5, 8 (CI xanh), 13 | 5 |
| 21 | CG-08 `SeedDataset`: PRNG, `buildSeedDataset`, `validateSeedDataset`, mã `SeedIssue` | 2, 4, 10, 11 | 5 |
| 24 | CG-07 OpenAPI 3.1 | 1, 4, 5, 10 | 5 |
| 22 | CG-08 `serializeSeedDataset`, `generateSeed`, export type `SeedDataset` | 1, 4, 5, 7, 21 | 6 |
| 23 | CG-06 Mock API (handler MSW 2) | 1, 4, 5, 10, 21 | 6 |
| 25 | CG-09 DBML | 1, 4, 5 | 6 |
| 26 | CG-10 Markdown | 1, 4, 5 | 6 |
| 27 | Property test cho mọi generator: không throw, xác định, xáo thứ tự khóa, an toàn với ký tự quote | 14–26 | 7 |
| 28 | Benchmark `vitest bench` với `createLargeSchema`, script `bench` | 14–26 | 7 |
| 29 | Conformance: DDL và seed SQL trên PostgreSQL 18, MySQL 8.4, SQL Server 2022 | 8, 14, 15, 16, 22 | 7 |
| 30 | Conformance: `prisma validate`; typecheck Drizzle, TypeScript, Zod; parse seed JSON bằng schema Zod | 8, 17, 18, 19, 20, 22 | 7 |
| 31 | Conformance: Mock API trên `msw/node`, validator OpenAPI, parse DBML | 8, 23, 24, 25 | 7 |
| 32 | Dependency `shiki` cho frontend, lockfile | P3 | 8 |
| 33 | Worker sinh code và tách token Shiki, hook `use-generated-code`; worker import `zod-config.ts` của phần 3 đầu tiên | 5, 14–26, 32, P3 | 9 |
| 34 | Code panel, nút "Code" trên toolbar, i18n `codeGenerator` và `generatorDiagnostics`, CSP `worker-src 'self'` | 33 | 10 |
| 35 | Tài liệu (`roadmap.md`, `architecture.md`, `CLAUDE.md`), kết quả benchmark, kiểm tra toàn repo | 27–31, 34 | 11 |

- Đường tới hạn của core: Task 2 → 6 → 12 → 13 → 14, 15, 16. Task 32 bắt đầu được ngay khi phần 3 merge, không cần chờ đợt 7.
- Task 15, 16 cần job `conformance` của Task 8 đã xanh trên CI (mục "Điểm nóng").
- Task 33: import đầu tiên của `code-generator.worker.ts` là `zod-config.ts` của phần 3 (đặt `z.config({ jitless: true })`), đứng trước mọi module import `@schemaforge/core`, vì Zod đọc `jitless` khi tạo schema chứ không phải khi parse, còn core tạo schema lúc được import (spec mục 8, "CSP"; `packages/core/src/zod-jitless.test.ts`). Thân Task 33 có bước kiểm tra rằng dòng import đầu tiên của file worker là `zod-config`.
- Task 0 phải xong trước mọi task nằm trong cột "Ảnh hưởng" của vấn đề tương ứng; các task khác không chờ Task 0.
- Thân task: lượt 1 viết Task 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16 ở ngay dưới. Task 3, 8, 17–35 do lượt 2 viết ở mục [Các task còn lại](#các-task-còn-lại).

## Task 1: Hạ tầng snapshot cho generator

**Mục tiêu:** file snapshot của generator (TypeScript import `zod`, `drizzle-orm`, `msw`; JSON định dạng bởi `JSON.stringify`) và file benchmark không làm đỏ typecheck, lint, Prettier, build hay ngưỡng coverage của core.

**Phụ thuộc:** P2-26. **Đợt:** 1.

**File sở hữu (sửa):** `packages/core/tsconfig.json`, `packages/core/tsconfig.build.json`, `packages/core/vitest.config.ts`, `eslint.config.mjs`, `.prettierignore`.

**Thay đổi:**

- `packages/core/tsconfig.json`: thêm `"exclude": ["src/**/__snapshots__/**"]`.
- `packages/core/tsconfig.build.json`: thêm `"src/**/__snapshots__/**"` và `"src/**/*.bench.ts"` vào `exclude`, giữ nguyên các mục đang có (`src/**/*.test.ts` và các mục Task 26 phần 2 đã thêm).
- `packages/core/vitest.config.ts`: thêm `coverage.exclude: ["src/**/__snapshots__/**", "src/**/*.bench.ts"]`, giữ `include` và `thresholds`.
- `eslint.config.mjs`: thêm `"**/__snapshots__/"` vào `globalIgnores`.
- `.prettierignore`: thêm dòng `**/__snapshots__/`.

**Kiểm chứng viết trước (file tạm, không commit):**

1. Chạy `pnpm --filter @schemaforge/core test`, ghi lại % coverage số dòng.
2. Tạo `packages/core/src/generators/__snapshots__/probe/sample.ts` với nội dung `import { z } from "not-installed";\nexport const broken: number = "x"` và `packages/core/src/generators/__snapshots__/probe/sample.json` với nội dung `{"a":1,   "b":2}`; tạo `packages/core/src/probe.bench.ts` với nội dung `export const probeValue = 1;`.
3. Chạy `pnpm --filter @schemaforge/core typecheck`: mong đợi **fail** (lỗi trong `sample.ts`), chứng tỏ file thăm dò có tác dụng. Chạy `pnpm exec prettier --check packages/core/src/generators`: mong đợi **fail**.
4. Sửa năm file cấu hình như trên.
5. Chạy typecheck, lint, test, build của core và `pnpm format:check`: mong đợi cả năm thoát mã 0; % coverage số dòng bằng bước 1; `ls packages/core/dist/generators packages/core/dist/probe.bench.js` báo không tồn tại.
6. Xóa file tạm: `rm -r packages/core/src/generators/__snapshots__/probe packages/core/src/probe.bench.ts`, rồi `rmdir packages/core/src/generators/__snapshots__ packages/core/src/generators` (bỏ qua lỗi nếu thư mục không rỗng).

**Kiểm tra cuối:** như mục "Quy ước chung", cộng `pnpm format:check`. `git status --porcelain` chỉ có năm file cấu hình.

**Commit:** `build(core): exclude generator snapshots and benchmarks from checks`

## Task 2: Kiểu chung, mã diagnostic và helper output

**Mục tiêu:** hợp đồng chung của mọi generator (spec mục 1 "Chữ ký", mục 4 "Danh mục mã diagnostic") có trước mọi task khác của core.

**Phụ thuộc:** P2-26. **Đợt:** 1.

**File sở hữu (tạo), mỗi file kèm `<name>.test.ts` cùng thư mục:** `packages/core/src/generators/shared/generator-types.ts`, `diagnostic-codes.ts`, `diagnostics.ts`, `render-file.ts`; `packages/core/src/testing/generator-snapshot.ts`.

**Chữ ký và hành vi:**

`generator-types.ts`, đúng spec mục 1:

```ts
export const GENERATOR_TARGETS = ["postgresql", "mysql", "sqlserver", "prisma", "drizzle", "typescript",
  "zod", "mock-api", "openapi", "seed", "dbml", "markdown"] as const;
export type GeneratorTarget = (typeof GENERATOR_TARGETS)[number];
export const SQL_DIALECTS = ["postgresql", "mysql", "sqlserver"] as const;
export type SqlDialect = (typeof SQL_DIALECTS)[number];
export type NoOptions = Readonly<Record<string, never>>;
export type MarkdownLabels = { readonly enumsHeading: string; /* …các khóa bên dưới */ };
export type GeneratorOptions = { /* đúng bảng option của spec mục 1 */ };
export type OutputLanguage = "sql" | "prisma" | "typescript" | "json" | "dbml" | "markdown";
export type GeneratedFile = { readonly fileName: string; readonly language: OutputLanguage; readonly content: string };
export type GeneratorDiagnostic = { readonly code: GeneratorDiagnosticCode; readonly path: DocumentPath };
export type GenerateResult = { readonly file: GeneratedFile; readonly diagnostics: readonly GeneratorDiagnostic[] };
export type Generate<T extends GeneratorTarget> = (schema: SchemaDocument, options: GeneratorOptions[T]) => GenerateResult;
```

`MarkdownLabels` gồm đúng 23 khóa `string` (spec CG-10: tiêu đề mục, tiêu đề cột, "Có", "Không", tên loại quan hệ), chốt ở đây để Task 5 export và Task 26, 34 dùng mà không sửa file này: `enumsHeading`, `tablesHeading`, `indexesHeading`, `relationsHeading`, `columnNameHeader`, `columnTypeHeader`, `columnNullableHeader`, `columnDefaultHeader`, `columnConstraintsHeader`, `columnCommentHeader`, `indexNameHeader`, `indexColumnsHeader`, `indexUniqueHeader`, `yes`, `no`, `primaryKey`, `unique`, `autoIncrement`, `foreignKey`, `oneToOne`, `oneToMany`, `outgoingRelations`, `incomingRelations`. Tên hành động ON DELETE, ON UPDATE ghi bằng từ khóa SQL, không phải nhãn.

`diagnostic-codes.ts`: `GENERATOR_DIAGNOSTIC_CODES` là mảng `as const` gồm 16 mã theo đúng thứ tự bảng ở spec mục 4, và `GeneratorDiagnosticCode`. Hợp đồng `path` dưới đây áp cho mọi đích (spec chỉ ví dụ; plan chốt để frontend dùng `resolveIssueTarget` nhất quán):

| Mã | `path` |
|---|---|
| `enum-not-supported`, `type-not-supported`, `type-parameter-out-of-range`, `key-column-type-narrowed`, `custom-type-unmapped`, `custom-type-unsafe` | `["columns", columnId, "type"]` |
| `key-column-type-not-indexable` | Phần tử bị bỏ: `["tables", tableId, "primaryKeyColumnIds"]`, `["columns", columnId, "isUnique"]`, `["indexes", indexId]` hoặc `["relations", relationId]` |
| `referential-action-not-supported` | `["relations", relationId, "onDelete"]` hoặc `"onUpdate"`, mỗi sự kiện bị đổi một diagnostic |
| `referential-action-cycle` | `["relations", relationId]` |
| `unique-nulls-restricted` | `["columns", columnId, "isUnique"]` hoặc `["indexes", indexId]` |
| `table-without-identifier`, `seed-table-skipped`, `seed-rows-reduced` | `["tables", tableId]` |
| `default-omitted` | `["columns", columnId, "defaultValue"]` |
| `identifier-collision-renamed` | Phần tử bị đổi tên: `["columns", columnId, "name"]` hoặc `["indexes", indexId, "name"]` |
| `null-character-removed` | `["tables", tableId, "comment"]`, `["columns", columnId, "comment"]`, `["columns", columnId, "defaultValue"]` hoặc `["enums", enumId, "values", i]` |

`diagnostics.ts`:

- `createDiagnostic(code: GeneratorDiagnosticCode, path: DocumentPath): GeneratorDiagnostic`.
- `finalizeDiagnostics(diagnostics: readonly GeneratorDiagnostic[]): readonly GeneratorDiagnostic[]`: bỏ cặp `code` và `path` lặp (so `path` bằng `JSON.stringify`), rồi sắp bằng `sortByPathThenCode` của `src/document-path.ts`.

`render-file.ts`:

- `renderFileContent(blocks: readonly (readonly string[])[]): string`: bỏ block rỗng; nối dòng trong một block bằng `\n`; nối các block bằng một dòng trống; bỏ mọi `\n` ở cuối văn bản đã nối rồi thêm đúng một `\n`. Không có block nào thì trả `"\n"`.

`src/testing/generator-snapshot.ts` (không export qua `@schemaforge/core/testing`):

- `formatDiagnosticsSnapshot(diagnostics: readonly GeneratorDiagnostic[]): string`: mỗi diagnostic một dòng `<code> <JSON.stringify(path)>` theo thứ tự nhận vào, kết thúc bằng `\n`; danh sách rỗng thì trả `"(none)\n"`.

**Test viết trước:**

- `generator-types.test.ts`: `lists the twelve generator targets in spec order`; `lists the three sql dialects`; `requires a provider option for prisma` (dùng `expectTypeOf<GeneratorOptions["prisma"]>().toEqualTypeOf<{ readonly provider: SqlDialect }>()`, được kiểm tra bởi `typecheck`).
- `diagnostic-codes.test.ts`: `lists the sixteen diagnostic codes from the spec without duplicates` (`toStrictEqual` với danh sách đầy đủ và `new Set(...).size` là 16).
- `diagnostics.test.ts`: `sorts diagnostics by path, then by code`; `removes a repeated code and path pair`; `keeps the same code at two different paths`; `orders a numeric path segment before a string segment`; `returns an empty list for no diagnostics`.
- `render-file.test.ts`: `joins the lines of one block and ends with one newline`; `separates blocks with one blank line`; `skips empty blocks`; `returns a single newline when there are no blocks`; `collapses trailing newlines at the end into one`.
- `generator-snapshot.test.ts`: `formats one diagnostic per line as code and json path`; `writes (none) when there are no diagnostics`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add generator contract and diagnostic codes`

## Task 4: Fixture cho generator

**Mục tiêu:** ba schema hợp lệ dùng cho snapshot, conformance, property test và benchmark (spec mục 9, 10).

**Phụ thuộc:** P2-26. **Đợt:** 1.

**File sở hữu:** tạo `packages/core/src/testing/naming-edge-schema.ts`, `target-limit-schema.ts`, `large-schema.ts`, mỗi file kèm `<name>.test.ts`; sửa `packages/core/src/testing/index.ts`, `packages/core/src/testing/index.test.ts`.

**Cài đặt chung:**

- Đọc `src/testing/factories.ts` và `sample-schema.ts` trước. Dựng bằng `buildSchema` và `make*` với `createCounterIdGenerator()` (theo Vấn đề 4 của plan phần 2, không qua operation). Lỗi dựng thì throw `Error`. Không import `vitest`, `fast-check`.
- Mỗi lần gọi trả schema bằng nhau theo cấu trúc. `validateSchema` của mọi fixture trả mảng rỗng.
- `src/testing/index.ts` export thêm `createNamingEdgeSchema`, `createTargetLimitSchema`, `createLargeSchema` và type `LargeSchemaOptions`; `index.test.ts` thêm ba tên vào danh sách export mong đợi.

**`createNamingEdgeSchema(): SchemaDocument`** phải chứa (tên gợi ý, được đổi nếu vẫn đủ tình huống):

- Tên schema chứa `"` và `'`.
- Bảng `người dùng` có comment nhiều dòng chứa `'`, `"`, `` ` ``, `]`, `\`, `*/` và `-- ; DROP TABLE x`; cột `id` `uuid` khóa chính mặc định `generateUuid`; cột `họ tên` `varchar(100)` nullable với comment chứa U+0000; cột `USER_ID` `integer`; cột `ma` và cột `má` kiểu `text` (chỉ khác dấu); cột `ghi chú` `varchar(50)` mặc định literal chứa `'` và `\`.
- Bảng tên từ khóa `order`, có cột `select`, `group`, cột `người dùng id` `uuid` quan hệ 1-n tới `người dùng` và cột `updated_by` `uuid` nullable quan hệ 1-n thứ hai tới `người dùng` (hai quan hệ giữa cùng hai bảng).
- Hai bảng `order items` và `order_items` (trùng sau khi ánh xạ định danh code).
- Bảng `2fa codes` (bắt đầu bằng chữ số) có cột `__proto__` `text` nullable.
- Bảng `用户` (không có chữ Latin).
- Bảng tên chứa đủ `"`, `` ` ``, `]`, `'`, `\` (tối đa 63 byte).
- Bảng có tên đúng 63 byte UTF-8, có chữ tiếng Việt, với một cột `isUnique` để tên ràng buộc do generator đặt vượt 63 byte.
- Enum `trạng thái đơn` với giá trị `chờ xử lý`, `đã giao`, `it's "quoted"`, `ma`, `má`, `a\b`, `*/ end`; cột enum trên `order` mặc định literal `chờ xử lý`.
- Index tên chứa `"` và dấu tiếng Việt.
- Subject area tên chứa `"`, có bảng thành viên; một ghi chú nhiều dòng chứa `'''` và `\`.

**`createTargetLimitSchema(): SchemaDocument`** phải chứa mọi tình huống của ma trận spec mục 4, mỗi tình huống một nhóm bảng riêng:

- Vòng cascade giữa hai bảng (`cycle_a`, `cycle_b`, cột khóa ngoại nullable, `onDelete: "cascade"`), nhiều đường cascade (`root` → `left`, `right` → `leaf`), tự tham chiếu `setNull`, một quan hệ `restrict`.
- Vòng chỉ gồm cột bắt buộc (`required_a` ↔ `required_b`, `noAction`) và một bảng tham chiếu bắt buộc tới `required_a`.
- `text` trong khóa chính, trong cột `isUnique`, trong index và trong cặp cột quan hệ.
- `json` trong khóa chính của một bảng; `json` `isUnique` được một quan hệ tham chiếu; `binary` trong index unique.
- Tham số vượt giới hạn: `varchar(10485761)`, `char(256)`, `varchar(16384)`, `char(4001)`, `varchar(4001)`, `decimal(1001, 2)`, `decimal(40, 31)`.
- Cột nullable `isUnique` được khóa ngoại tham chiếu; index unique có cột nullable không được tham chiếu.
- Bảng không có khóa chính và không có unique; bảng không có khóa chính nhưng có cột bắt buộc `isUnique`.
- Kiểu custom: cột nullable không mặc định, cột bắt buộc có mặc định literal, và một bảng riêng có cột custom bắt buộc không mặc định.
- `setDefault` trên quan hệ có cột khóa ngoại mang giá trị mặc định.
- Cột enum nullable; cột `boolean` `isUnique`.
- Bảng `all_types` có đủ 19 kiểu chung (trừ custom đã có ở trên) và literal mặc định cho mọi kiểu nhận literal: `date`, `time` có giây lẻ, `timestamp`, `timestamptz` có độ lệch, `boolean`, `real` dạng mũ, `bigint` lớn nhất, `decimal`, `json` chứa `'`, `char`, `uuid`; `currentTimestamp` trên `timestamp` và `timestamptz`; auto-increment trên `smallint`, `integer` (mỗi cột ở một bảng riêng, là khóa chính).

**`createLargeSchema(options: LargeSchemaOptions): SchemaDocument`**, `LargeSchemaOptions = { readonly tableCount: number }`:

- `tableCount` là số nguyên từ 2 trở lên, nếu không thì throw `RangeError`.
- `enum_00`… với `max(1, floor(tableCount / 10))` enum, mỗi enum 5 giá trị. Bảng `table_000`… với đúng 20 cột mỗi bảng (xoay vòng qua các kiểu, gồm cột enum và cột khóa ngoại). Bảng có chỉ số chia hết cho 10 có khóa chính hai cột; bảng khác có `id` `bigint` auto-increment.
- `floor(tableCount * 1.5)` quan hệ: mỗi bảng `i` tham chiếu bảng `(i + 1) % tableCount` với `onDelete: "cascade"` (tạo vòng), và mỗi bảng có chỉ số chẵn tham chiếu thêm bảng `(i + 7) % tableCount` với `noAction`. Quan hệ tới bảng có khóa chính hai cột là khóa ngoại hai cột.
- `tableCount` index, mỗi bảng một index hai cột, index thứ tư là unique.
- Với `tableCount: 200`: 200 bảng, 4000 cột, 300 quan hệ, 200 index, 20 enum (spec mục 9).

**Test viết trước:**

- `naming-edge-schema.test.ts`: `has no semantic issues`; `returns structurally equal schemas on every call`; `passes parseSchemaDocument after JSON stringify and parse`; `contains names with every quote character of the three sql dialects`; `contains a table name of exactly 63 bytes`; `contains two table names that map to the same code identifier`; `contains column names that differ only by an accent`; `contains a comment with a null character`; `contains two relations between the same pair of tables`.
- `target-limit-schema.test.ts`: `has no semantic issues`; `returns structurally equal schemas on every call`; `contains a cascade cycle and a second cascade path`; `contains a cycle of required foreign keys`; `contains text, json and binary columns in keys`; `contains type parameters beyond every dialect limit`; `contains a nullable unique column referenced by a foreign key`; `contains tables without a primary key`; `contains custom types with and without defaults`; `contains a set default relation`; `contains a default literal for every type that accepts one`.
- `large-schema.test.ts`: `creates 200 tables with 20 columns each, 300 relations, 200 indexes and 20 enums`; `has no semantic issues at 200 tables` (đặt `timeout` riêng nếu cần); `contains a composite foreign key and a relation cycle`; `returns structurally equal schemas on every call`; `throws RangeError for a table count below 2`.
- `index.test.ts`: danh sách export mong đợi có thêm ba hàm.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `test(core): add generator fixture schemas`

## Task 5: Subpath `./generators/*` và export chung

**Mục tiêu:** consumer import được `@schemaforge/core/generators/<đích>` ngay khi đích có `index.ts`; entry point chính export phần nhỏ dùng chung mà không kéo code generator (spec mục 1, "Nơi đặt và entry point").

**Phụ thuộc:** Task 2, P2-27. **Đợt:** 2.

**File sở hữu (sửa):** `packages/core/package.json` (chỉ `exports`), `packages/core/src/index.ts`, `packages/core/src/index.test.ts`.

**Cài đặt:**

- `exports` thêm, sau `"./testing"`: `"./generators/*": { "types": "./dist/generators/*/index.d.ts", "default": "./dist/generators/*/index.js" }`. Giữ `"."` và `"./testing"`.
- `src/index.ts` export thêm, chỉ từ `generators/shared/generator-types.js` và `generators/shared/diagnostic-codes.js`:
  - **Giá trị:** `GENERATOR_TARGETS`, `GENERATOR_DIAGNOSTIC_CODES`.
  - **Type:** `GeneratorTarget`, `SqlDialect`, `NoOptions`, `GeneratorOptions`, `MarkdownLabels`, `OutputLanguage`, `GeneratedFile`, `GeneratorDiagnostic`, `GeneratorDiagnosticCode`, `GenerateResult`, `Generate`.
- Không import thư mục đích nào từ `src/index.ts`. `SeedDataset` do Task 22 thêm.
- Mỗi `src/generators/<đích>/index.ts` (do task của đích tạo) chỉ export hàm generate và type option của đích, riêng `seed/index.ts` export thêm `buildSeedDataset`, `validateSeedDataset`, `serializeSeedDataset` và type liên quan (spec mục 1). Tên cố định để worker của frontend (Task 33) tra được:

  | Thư mục | Hàm | Type option |
  |---|---|---|
  | `postgresql` | `generatePostgresql` | `PostgresqlOptions` |
  | `mysql` | `generateMysql` | `MysqlOptions` |
  | `sqlserver` | `generateSqlServer` | `SqlServerOptions` |
  | `prisma` | `generatePrisma` | `PrismaOptions` |
  | `drizzle` | `generateDrizzle` | `DrizzleOptions` |
  | `typescript` | `generateTypeScript` | `TypeScriptOptions` |
  | `zod` | `generateZod` | `ZodOptions` |
  | `mock-api` | `generateMockApi` | `MockApiOptions` |
  | `openapi` | `generateOpenApi` | `OpenApiOptions` |
  | `seed` | `generateSeed` | `SeedOptions` |
  | `dbml` | `generateDbml` | `DbmlOptions` |
  | `markdown` | `generateMarkdown` | `MarkdownOptions` |

  Mỗi type option là `GeneratorOptions["<đích>"]`.

**Test viết trước:** trong `index.test.ts`, sửa `exports exactly the documented runtime values` để danh sách mong đợi có thêm hai tên; thêm `exposes twelve generator targets and sixteen generator diagnostic codes`.

**Kiểm tra:** như mục "Quy ước chung", thêm:

```bash
pnpm --filter @schemaforge/core build
pnpm --filter @schemaforge/backend exec node --input-type=module -e 'const core = await import("@schemaforge/core"); console.log(core.GENERATOR_TARGETS.length, core.GENERATOR_DIAGNOSTIC_CODES.length); await import("@schemaforge/core/generators/shared").then(() => console.log("reachable"), (error) => console.log(error.code));'
```

Mong đợi: build thoát mã 0; lệnh `node` in `12 16` rồi `ERR_MODULE_NOT_FOUND` (thư mục `shared` không có `index.js` nên không import được qua pattern). Import thành công một subpath thật được kiểm tra ở Task 14.

**Commit:** `feat(core): expose generator subpaths and shared generator types`

## Task 6: Định danh và `NameAllocator`

**Mục tiêu:** mọi đích dùng chung một bộ hàm quote định danh SQL, tạo định danh code ASCII và cấp tên không trùng (spec mục 5, "Định danh SQL", "Định danh code").

**Phụ thuộc:** Task 2. **Đợt:** 2.

**File sở hữu (tạo), mỗi file kèm `<name>.test.ts`:** `packages/core/src/generators/shared/identifiers.ts`, `name-allocator.ts`, `javascript-reserved-words.ts`. Spec mục 1 chỉ ghi `identifiers.ts`; plan tách thêm hai file để mỗi file dưới 300 dòng.

**Chữ ký và hành vi:**

`identifiers.ts`:

- `quoteSqlIdentifier(dialect: SqlDialect, name: string): string`: luôn quote. PostgreSQL `"…"` nhân đôi `"`; MySQL `` `…` `` nhân đôi `` ` ``; SQL Server `[…]` nhân đôi `]`. Tên giữ nguyên, kể cả dấu tiếng Việt.
- `toAsciiWords(name: string): readonly string[]`: `normalize("NFD")`, bỏ ký tự U+0300–U+036F, đổi `đ` → `d`, `Đ` → `D`; tách theo `/[^A-Za-z0-9]+/`, bỏ từ rỗng; từ chỉ gồm chữ hoa và chữ số (có ít nhất một chữ cái) được hạ về chữ thường, từ khác giữ nguyên.
- `toPascalCaseIdentifier(name: string, fallback: string): string`: viết hoa chữ đầu mỗi từ, giữ phần còn lại, nối liền. Rỗng thì trả `fallback`; bắt đầu bằng chữ số thì trả `fallback` nối với kết quả.
- `toCamelCaseIdentifier(name: string, fallback: string): string`: như PascalCase nhưng chữ đầu của từ đầu viết thường; cùng quy tắc rỗng và chữ số (`2fa codes` → `field2faCodes`).
- `toKebabCaseSegment(name: string, fallback: string): string`: các từ hạ toàn bộ về chữ thường, nối bằng `-`; rỗng thì trả `fallback`.
- `withReservedWordSuffix(identifier: string, reservedWords: readonly string[]): string`: thêm `_` khi `identifier` có trong danh sách (so phân biệt hoa thường).
- `formatPropertyKey(name: string): string`: `__proto__` → `["__proto__"]` (khóa tính toán, xem Vấn đề 5); khớp `^[A-Za-z_$][A-Za-z0-9_$]*$` → ghi trần; còn lại → `JSON.stringify(name)`.
- `formatJsDocLines(text: string, indent: string): readonly string[]`: chuỗi rỗng → `[]`; thay mọi `*/` bằng `*\/`; một dòng → `[`${indent}/** ${text} */`]`; nhiều dòng (tách theo `\r\n`, `\r`, `\n`) → `/**`, mỗi dòng ` * …`, ` */`, mỗi dòng có `indent`. Dòng rỗng ghi ` *` không có khoảng trắng cuối.

`name-allocator.ts`:

```ts
export type NameComparison = "exact" | "caseInsensitive" | "caseAndAccentInsensitive";
export function toComparisonKey(name: string, comparison: NameComparison): string;
export type NameAllocator = { readonly allocate: (preferred: string) => string };
export function createNameAllocator(options: {
  readonly reserved: readonly string[];
  readonly comparison: NameComparison;
  readonly separator: "" | "_" | "-";    // "" cho định danh code, "_" cho SQL, "-" cho đoạn đường dẫn
  readonly maxBytes: number | null;      // 63 cho tên SQL
}): NameAllocator;
export function truncateToUtf8Bytes(text: string, maxBytes: number): string;
```

- Spec mục 5 ghi option `isCaseInsensitive`; plan thay bằng `comparison` (thêm mức không phân biệt dấu cho tên MySQL và tên ràng buộc, Vấn đề 7), và thêm `separator`, `maxBytes` vì spec dùng hậu tố `2` cho code, `_2` cho SQL, `-2` cho đường dẫn, và tên SQL tối đa 63 byte.
- `toComparisonKey`: `exact` → giữ nguyên; `caseInsensitive` → `toNameKey(name)`; `caseAndAccentInsensitive` → `toNameKey` của chuỗi sau `normalize("NFD")` và bỏ ký tự U+0300–U+036F (không đổi `đ`).
- `allocate(preferred)`: nếu khóa của `preferred` chưa bị chiếm (bởi `reserved` hoặc lần cấp trước) thì chiếm và trả `preferred`. Nếu không, thử `n = 2, 3, …`: hậu tố `separator + n`; phần gốc là `preferred`, hoặc `truncateToUtf8Bytes(preferred, maxBytes − số byte của hậu tố)` khi `maxBytes` khác `null`; trả ứng viên đầu tiên chưa bị chiếm và chiếm nó.
- State (tập khóa đã chiếm) nằm trong closure của từng allocator, không ở cấp module.
- `truncateToUtf8Bytes`: giữ tiền tố dài nhất theo code point có số byte UTF-8 (dùng `utf8ByteLength` của `src/model/name-limits.ts`) không quá `maxBytes`; không tách cặp surrogate.

`javascript-reserved-words.ts`: `JAVASCRIPT_RESERVED_WORDS`, mảng `as const` gồm từ khóa và từ dành riêng của JavaScript và TypeScript có thể gây lỗi khi làm tên biến: `break`, `case`, `catch`, `class`, `const`, `continue`, `debugger`, `default`, `delete`, `do`, `else`, `enum`, `export`, `extends`, `false`, `finally`, `for`, `function`, `if`, `import`, `in`, `instanceof`, `new`, `null`, `return`, `super`, `switch`, `this`, `throw`, `true`, `try`, `typeof`, `var`, `void`, `while`, `with`, `implements`, `interface`, `let`, `package`, `private`, `protected`, `public`, `static`, `yield`, `await`, `arguments`, `eval`, `undefined`, `NaN`, `Infinity`.

**Test viết trước:**

- `identifiers.test.ts`:
  - `quotes identifiers for each dialect` (`it.each`): `order` ở ba dialect; `a"b` PostgreSQL → `"a""b"`; ``a`b`` MySQL → `` `a``b` ``; `a]b` SQL Server → `[a]]b]`; `a[b` SQL Server → `[a[b]`; `người dùng` giữ nguyên trong dấu quote.
  - `splits names into ascii words` (`it.each`): `người dùng` → `nguoi`, `dung`; `Đường đi` → `Duong`, `di`; `USER_ID` → `user`, `id`; `createdAt` → `createdAt`; `用户` → rỗng; `2fa codes` → `2fa`, `codes`; `a--b  c` → `a`, `b`, `c`.
  - `maps the examples of spec section 5 to PascalCase and camelCase` (`it.each` theo bảng ví dụ ở spec mục 5, fallback `Table` và `field`).
  - `maps names to kebab-case path segments` (`người dùng` → `nguoi-dung`, `USER_ID` → `user-id`, `用户` → fallback).
  - `appends an underscore to a reserved word`; `keeps an identifier that is not reserved`.
  - `formats property keys` (`it.each`): `USER_ID` trần; `$ref` trần; `họ tên` → `"họ tên"`; `2fa` → `"2fa"`; `a"b` → `"a\"b"`; `__proto__` → `["__proto__"]`.
  - `formats a one-line JSDoc comment`; `formats a multi-line JSDoc comment`; `escapes a comment terminator inside JSDoc`; `returns no lines for an empty comment`.
- `name-allocator.test.ts`: `returns the preferred name when it is free`; `appends 2, then 3 to repeated names`; `treats names differing only in case as taken when case-insensitive`; `allows names differing only in case when comparison is exact`; `treats names differing only by an accent as taken when case and accent insensitive`; `builds comparison keys for each comparison` (`it.each`); `never returns a reserved name`; `uses the separator before the number`; `truncates the base so the suffixed name fits the byte limit`; `does not split a surrogate pair when truncating`; `keeps separate state for separate allocators`.
- `javascript-reserved-words.test.ts`: `contains class, default and await`; `has no duplicates`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add shared identifier helpers for generators`

## Task 7: Literal SQL và giá trị mặc định

**Mục tiêu:** literal chuỗi và giá trị mặc định theo dialect, dùng chung cho CG-01, `dbgenerated(…)` của Prisma, `sql` của Drizzle và seed SQL, với đúng hàm kiểm tra của phần 2 (spec mục 2, mục 3 "SQL", mục 5 "Định danh SQL").

**Phụ thuộc:** Task 2. **Đợt:** 2.

**File sở hữu:** tạo `packages/core/src/generators/shared/sql-literals.ts`, `sql-literals.test.ts`; sửa `packages/core/src/validation/rules/default-literals.ts`, `default-literals.test.ts`, `column-defaults.ts` (chỉ tách hàm, `column-defaults.test.ts` không sửa và phải pass nguyên vẹn).

**Chữ ký và hành vi:**

Trong `default-literals.ts` (tách từ logic đang có trong `column-defaults.ts`, không đổi hành vi):

```ts
export type DefaultValueProblem = "invalid" | "incompatible";
export function findDefaultValueProblem(
  type: ColumnType, defaultValue: ColumnDefault, enums: SchemaDocument["enums"],
): DefaultValueProblem | null;
```

`currentTimestamp` trên kiểu khác `timestamp`, `timestamptz`, `generateUuid` trên kiểu khác `uuid`, `literal` trên `binary` → `"incompatible"`; `literal` mà `isValidDefaultLiteral` trả `false` → `"invalid"`; còn lại `null`. `validateColumnDefaults` gọi hàm này rồi ánh xạ sang `column-default-incompatible`, `column-default-invalid`.

Trong `sql-literals.ts`:

- `sqlStringLiteral(dialect: SqlDialect, value: string): string`: PostgreSQL `'…'` nhân đôi `'`; MySQL `'…'` đổi `\` thành `\\` rồi nhân đôi `'`; SQL Server `N'…'` nhân đôi `'`. Ký tự xuống dòng giữ nguyên trong literal.
- `removeNullCharacters(value: string): { readonly text: string; readonly hasRemoved: boolean }`.
- `formatSqlLiteral(dialect: SqlDialect, type: ColumnType, value: string): string`: `value` đã hợp lệ với kiểu (người gọi bảo đảm). `smallint`, `integer`, `bigint`, `decimal`, `real`, `double` ghi không quote; `boolean`: PostgreSQL `true`/`false`, MySQL `TRUE`/`FALSE`, SQL Server `1`/`0`; mọi kiểu còn lại trừ `binary` ghi bằng `sqlStringLiteral`. Gọi với `binary` là lỗi lập trình: throw `Error` (seed xử lý `binary` riêng ở Task 22).
- Giá trị mặc định:

  ```ts
  export type SqlDefault =
    | { readonly kind: "none" }
    | { readonly kind: "omitted" }
    | { readonly kind: "value"; readonly sql: string; readonly hasRemovedNullCharacter: boolean };
  export function formatSqlDefault(input: {
    readonly dialect: SqlDialect;
    readonly column: Column;
    readonly enums: SchemaDocument["enums"];
    readonly shouldParenthesizeLiteral: boolean; // MySQL khi kiểu đích là LONGTEXT, JSON hoặc LONGBLOB
  }): SqlDefault;
  ```

  - `defaultValue` là `null` → `none`. `findDefaultValueProblem` khác `null` → `omitted` (người gọi thêm `default-omitted`).
  - `currentTimestamp`: PostgreSQL `now()`; MySQL `CURRENT_TIMESTAMP(6)`; SQL Server `sysdatetime()` cho `timestamp`, `sysdatetimeoffset()` cho `timestamptz`.
  - `generateUuid`: PostgreSQL `gen_random_uuid()`; MySQL `(UUID())`; SQL Server `newid()`.
  - `literal`: `formatSqlLiteral`; MySQL bọc trong ngoặc khi `shouldParenthesizeLiteral`. Chỉ với PostgreSQL, literal được qua `removeNullCharacters` trước và `hasRemovedNullCharacter` báo lại (người gọi thêm `null-character-removed`).

**Test viết trước:**

- `sql-literals.test.ts`:
  - `quotes string literals for each dialect` (`it.each`): PostgreSQL `it's` → `'it''s'`; PostgreSQL `a\b` → `'a\b'`; MySQL `a\b` → `'a\\b'`; MySQL `it's` → `'it''s'`; SQL Server `it's` → `N'it''s'`; chuỗi có xuống dòng.
  - `removes null characters and reports it`; `reports nothing when there is no null character`.
  - `formats literals by column type and dialect` (`it.each`, ba dialect cho: `integer` `-5`, `decimal(3, 2)` `9.99`, `real` `1.5e-3`, `boolean` `true` và `false`, `varchar(10)` có `'`, `uuid`, `date`, `timestamptz`, `json`, enum).
  - `formats currentTimestamp for each dialect and timestamp kind`; `formats generateUuid for each dialect`.
  - `wraps a MySQL literal in parentheses when requested`; `does not wrap a PostgreSQL literal`.
  - `returns none for a column without a default`.
  - `omits a literal that is not valid for a numeric column` (`it.each`: `1; DROP TABLE x`, `1 OR 1=1`, `0x10`); `omits currentTimestamp on a date column`; `omits a literal on a binary column`.
  - `removes a null character from a PostgreSQL literal`; `keeps a null character in a MySQL literal`.
  - `throws when asked to format a binary literal`.
- `default-literals.test.ts` thêm: `finds no problem for a valid literal`; `finds an incompatible default expression` (`it.each`: `currentTimestamp` trên `date`, `generateUuid` trên `varchar`, literal trên `binary`); `finds an invalid literal`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add sql literal and default value formatting`

## Task 9: Tên ràng buộc do generator đặt

**Mục tiêu:** ba dialect SQL và Drizzle dùng cùng một bộ tên ràng buộc theo quy ước PostgreSQL, tối đa 63 byte, không trùng trong output (spec mục 5, "Tên ràng buộc do generator đặt").

**Phụ thuộc:** Task 6. **Đợt:** 3.

**File sở hữu (tạo):** `packages/core/src/generators/shared/constraint-names.ts`, `constraint-names.test.ts`.

**Chữ ký và hành vi:**

```ts
export function buildConstraintName(
  tableName: string, columnNames: readonly string[], suffix: "pkey" | "key" | "fkey" | "check",
): string;
export function fnv1a32Hex(text: string): string;
export type SchemaConstraintNames = {
  readonly primaryKeys: ReadonlyMap<TableId, string>;    // bảng có khóa chính
  readonly uniqueColumns: ReadonlyMap<ColumnId, string>; // cột isUnique
  readonly enumChecks: ReadonlyMap<ColumnId, string>;    // cột enum (CHECK của SQL Server)
  readonly foreignKeys: ReadonlyMap<RelationId, string>;
};
export function allocateConstraintNames(
  schema: SchemaDocument,
  orderColumnPairs: (relation: Relation) => readonly ColumnPair[],
): SchemaConstraintNames;
```

- `buildConstraintName`: `pkey` → `<bảng>_pkey` (bỏ qua `columnNames`); còn lại → nối `tableName`, các `columnNames`, `suffix` bằng `_`. Dùng tên gốc. Tên dài hơn 63 byte UTF-8 → `truncateToUtf8Bytes(tên, 54) + "_" + fnv1a32Hex(tên)`.
- `fnv1a32Hex`: FNV-1a 32 bit (offset basis `0x811c9dc5`, prime `0x01000193`, nhân bằng `Math.imul`, `>>> 0`) trên các byte UTF-8 của `text`, tự mã hóa theo code point (không `TextEncoder`; surrogate lẻ mã hóa như U+FFFD, khớp `utf8ByteLength`), trả 8 chữ số hex thường, đệm `0` bên trái.
- `allocateConstraintNames`: một `createNameAllocator({ reserved, comparison: "caseAndAccentInsensitive", separator: "_", maxBytes: 63 })` (không phân biệt dấu cho mọi dialect vì MySQL so tên index như vậy, Vấn đề 7) với `reserved` là tên mọi bảng (`sortTables`) và mọi index của người dùng (`sortIndexes`). Cấp theo thứ tự: với từng bảng theo `sortTables`: khóa chính (nếu `primaryKeyColumnIds` không rỗng), rồi theo `columnIds`: tên unique cho cột `isUnique`, tên check cho cột kiểu `enum`; sau đó với từng quan hệ theo `sortRelations`: tên khóa ngoại với cột nguồn theo thứ tự `orderColumnPairs(relation)`. Tên không phụ thuộc dialect, nên ba dialect và Drizzle cho cùng tên. Tên index của người dùng không bao giờ đi qua allocator.
- `orderColumnPairs` được tiêm vào để task này không phụ thuộc Task 11; người gọi truyền `orderColumnPairsByReferencedKey` của Task 11.

**Test viết trước:**

- `builds names by the PostgreSQL convention` (`it.each`: `users_pkey`, `users_email_key`, `orders_tenant_id_number_key`, `posts_author_id_fkey`, `orders_status_check`).
- `keeps a name of exactly 63 bytes`; `shortens a 64-byte name to 54 bytes, an underscore and an eight-digit hash`; `cuts at a code point boundary inside accented text`.
- `matches the FNV-1a test vectors` (`it.each`: `""` → `811c9dc5`, `"a"` → `e40c292c`, `"foobar"` → `bf9cf968`); `hashes the utf-8 bytes of accented text` (giá trị mong đợi tính một lần bằng `node -e` dùng `Buffer` ngoài core, ghi cứng vào test).
- `allocates primary key, unique, check and foreign key names for a schema`; `adds _2 when a generated name equals a table name`; `adds _2 when a generated name equals a user index name that differs only in case`; `adds _2 when two generated names differ only by an accent`; `never renames a user index`; `orders foreign key column names with the injected pair order`; `returns the same names regardless of map key order`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add constraint naming for generators`

## Task 10: Biểu diễn JSON và tài nguyên REST

**Mục tiêu:** TypeScript, Zod, OpenAPI, Mock API và seed JSON dùng chung một mô tả kiểu JSON và một hàm kiểm tra giá trị; OpenAPI và Mock API dùng chung đoạn đường dẫn, tên component và tham số (spec mục 3 "Biểu diễn JSON…", mục 5 bảng không gian tên, CG-06, CG-07).

**Phụ thuộc:** Task 2, Task 6. **Đợt:** 3.

**File sở hữu (tạo), mỗi file kèm `<name>.test.ts`:** `packages/core/src/generators/shared/json-representation.ts`, `rest-resources.ts`.

**Chữ ký và hành vi:**

`json-representation.ts`:

```ts
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonFieldType =
  | { readonly kind: "smallint" } | { readonly kind: "int32" } | { readonly kind: "bigintString" }
  | { readonly kind: "decimalString"; readonly precision: number; readonly scale: number }
  | { readonly kind: "float" } | { readonly kind: "double" } | { readonly kind: "boolean" }
  | { readonly kind: "string"; readonly maxLength: number | null }
  | { readonly kind: "uuid" } | { readonly kind: "date" } | { readonly kind: "time" }
  | { readonly kind: "localDateTime" } | { readonly kind: "offsetDateTime" }
  | { readonly kind: "json" } | { readonly kind: "base64" }
  | { readonly kind: "enum"; readonly enumId: EnumId } | { readonly kind: "unknown" };
export function toJsonFieldType(type: ColumnType): JsonFieldType;
export const SMALLINT_MINIMUM = -32768; export const SMALLINT_MAXIMUM = 32767;
export const BIGINT_STRING_PATTERN = "^-?(0|[1-9][0-9]*)$";
export const TIME_PATTERN = "^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]+)?$";
export const LOCAL_DATE_TIME_PATTERN: string; // ngày YYYY-MM-DD, "T", rồi TIME_PATTERN không có ^
export const BASE64_PATTERN = "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$";
export function decimalStringPattern(precision: number, scale: number): string;
export function isValidJsonValue(type: ColumnType, value: JsonValue, enums: SchemaDocument["enums"]): boolean;
```

- `toJsonFieldType` theo đúng bảng spec mục 3: `char(n)`, `varchar(n)` → `string` với `maxLength: n`; `text` → `maxLength: null`; `custom` → `unknown`.
- `decimalStringPattern(p, s)` nhận đúng tập literal mà `isValidDefaultLiteral` nhận cho `decimal(p, s)` (Vấn đề 2 của plan phần 2, cho phép số 0 ở đầu): nếu `s > p` → `^-?[0-9]+(\.[0-9]+)?$`; nếu không, phần nguyên là `0+` khi `p − s = 0`, `0*[0-9]{1,p−s}` khi `p − s ≥ 1`; phần lẻ là rỗng khi `s = 0`, `(\.[0-9]{1,s})?` khi `s ≥ 1`; bọc `^-?…$`.
- `isValidJsonValue` (hàm kiểm tra dùng chung cho seed và AI-06, spec mục 3): `null` luôn trả `false` (người gọi kiểm tra nullable trước); `smallint`, `integer`: `number` nguyên trong phạm vi kiểu; `real`, `double`: `number` hữu hạn; `boolean`: `boolean`; `json`, `custom`: mọi giá trị khác `null`; `binary`: chuỗi khớp `BASE64_PATTERN`; mọi kiểu còn lại: chuỗi và `isValidDefaultLiteral(type, value, enums)`.

`rest-resources.ts`:

```ts
export type RestResource = {
  readonly tableId: TableId;
  readonly typeName: string;     // tên component OpenAPI, PascalCase
  readonly pathSegment: string;  // kebab-case
  readonly keyParameters: readonly { readonly columnId: ColumnId; readonly name: string }[]; // rỗng khi không có khóa chính
};
export type RestApiNames = { readonly enumTypeNames: ReadonlyMap<EnumId, string>; readonly resources: readonly RestResource[] };
export function buildRestApiNames(schema: SchemaDocument): RestApiNames;
export function formatOpenApiPath(resource: RestResource, isItemPath: boolean): string; // "/nguoi-dung", "/orders/{tenantId}/{orderNumber}"
export function formatMswPath(resource: RestResource, isItemPath: boolean): string;     // "*/api/nguoi-dung", "*/api/orders/:tenantId/:orderNumber"
```

- Tên component: một allocator `comparison: "exact"`, `separator: ""`; cấp enum trước theo `sortEnums` (`toPascalCaseIdentifier`, fallback `Enum`), rồi bảng theo `sortTables` (fallback `Table`).
- Đoạn đường dẫn: allocator `comparison: "caseInsensitive"`, `separator: "-"`, theo `sortTables`, `toKebabCaseSegment` với fallback `table`.
- Tham số: mỗi bảng một allocator `comparison: "exact"`, `separator: ""`, theo `primaryKeyColumnIds`, `toCamelCaseIdentifier` với fallback `field`.
- `resources` theo thứ tự `sortTables`. `operationId` (`list<Type>`, `create<Type>`…) do Task 23, 24 ghép từ `typeName`.

**Test viết trước:**

- `json-representation.test.ts`: `maps every column type to its json field type` (`it.each` đủ 19 kiểu); `accepts json values by column type` và `rejects json values by column type` (`it.each`: `smallint` 32768, `integer` 1.5, `bigint` dạng số, `decimal` sai chữ số, `real` chuỗi, `uuid` thiếu nhóm, `date` không có thật, `binary` không phải base64, enum sai hoa thường); `treats null as invalid so callers check nullability first`; `builds a decimal pattern that agrees with isValidDefaultLiteral` (`it.each` với `decimal(3, 2)`: `9.99`, `0.5`, `-1.25`, `007.5`, `10.0`, `1.234`, `1.`, `.5`, `1e2`; `decimal(2, 3)`: `12.3456`; `decimal(5, 0)`: `12345`, `1.0`; mỗi dòng so kết quả của `RegExp` với `isValidDefaultLiteral`); `matches bigint strings but not a plus sign or leading zeros`; `matches local date-times without a time zone`.
- `rest-resources.test.ts`: `derives kebab-case path segments from table names`; `adds -2 to a path segment that repeats after mapping` (`order items`, `order_items`); `names components with enums before tables`; `adds 2 to a repeated component name`; `names key parameters in primary key order`; `returns no key parameters for a table without a primary key`; `formats OpenAPI and MSW paths for collections and items`; `returns the same names regardless of map key order`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add json representation and rest resource naming`

## Task 11: Đồ thị quan hệ và tên trường quan hệ

**Mục tiêu:** SQL, Prisma, Drizzle và seed dùng chung thứ tự cặp cột khóa ngoại, quy tắc hạ hành động vì vòng cascade của SQL Server, thứ tự nạp dữ liệu và tên trường quan hệ (spec mục 4 "Phát hiện vòng cascade trên SQL Server", mục 5 "Tên trường quan hệ", CG-01 bước 4, CG-08 "Sinh giá trị xác định").

**Phụ thuộc:** Task 2, Task 6. **Đợt:** 3.

**File sở hữu (tạo), mỗi file kèm `<name>.test.ts`:** `packages/core/src/generators/shared/relation-graph.ts`, `relation-field-names.ts`.

**Chữ ký và hành vi:**

`relation-graph.ts`:

```ts
export type ReferencedKey =
  | { readonly kind: "primaryKey"; readonly columnIds: readonly ColumnId[] }
  | { readonly kind: "uniqueColumn"; readonly columnIds: readonly ColumnId[] }
  | { readonly kind: "uniqueIndex"; readonly indexId: IndexId; readonly columnIds: readonly ColumnId[] };
export function findReferencedKey(schema: SchemaDocument, relation: Relation): ReferencedKey | null;
export function orderColumnPairsByReferencedKey(schema: SchemaDocument, relation: Relation): readonly ColumnPair[];
export function findCascadeConflicts(schema: SchemaDocument): readonly RelationId[];
export type LoadOrder = {
  readonly tableIds: readonly TableId[];              // thứ tự nạp
  readonly deferredRelationIds: readonly RelationId[]; // chèn NULL trước, UPDATE sau
  readonly skippedTableIds: readonly TableId[];
};
export function buildLoadOrder(schema: SchemaDocument): LoadOrder;
export function propagateSkippedTables(schema: SchemaDocument, skippedTableIds: readonly TableId[]): readonly TableId[];
```

- `findReferencedKey`: tập `toColumnId` (so như tập, cùng kích thước) bằng khóa chính của bảng đích → `primaryKey`; nếu không, là một cột `isUnique` → `uniqueColumn`; nếu không, index unique đầu tiên của bảng đích theo `sortIndexes` có cùng tập cột → `uniqueIndex`; nếu không → `null` (schema có issue `relation-target-not-unique`).
- `orderColumnPairsByReferencedKey`: sắp cặp cột theo vị trí của `toColumnId` trong `columnIds` của khóa được tham chiếu (MySQL yêu cầu); khóa là `null` thì giữ thứ tự `columnPairs`.
- `findCascadeConflicts` (SQL Server, dùng cho CG-01 và Prisma `sqlserver`): duyệt `sortRelations`. Quan hệ tham gia đồ thị khi `onDelete` hoặc `onUpdate` khác `noAction` và `restrict` (Vấn đề 4). Cạnh là `toTableId → fromTableId`. Gọi `A` là bảng `toTableId` cùng mọi tổ tiên của nó, `D` là bảng `fromTableId` cùng mọi hậu duệ của nó trong đồ thị các cạnh đã nhận. Quan hệ xung đột khi tự tham chiếu, hoặc có `a ∈ A` và `d ∈ D` mà `a = d` hoặc `d` đã đi tới được từ `a`: thêm cạnh sẽ tạo vòng hoặc đường thứ hai giữa hai bảng. Quan hệ xung đột không được thêm vào đồ thị và được trả về; kết quả theo thứ tự `sortRelations`. Duyệt đồ thị bằng ngăn xếp tường minh, không đệ quy.
- `buildLoadOrder` (CG-08):
  1. Cạnh `toTableId → fromTableId` cho mọi quan hệ không tự tham chiếu. Quan hệ "hoãn được" khi mọi cột nguồn đều nullable.
  2. Tìm thành phần liên thông mạnh (thuật toán lặp, không đệ quy). Quan hệ hoãn được có hai đầu cùng một thành phần kích thước lớn hơn 1 là quan hệ hoãn.
  3. Bỏ cạnh của quan hệ hoãn rồi tìm lại thành phần liên thông mạnh; mọi bảng trong thành phần kích thước lớn hơn 1 bị bỏ (vòng chỉ gồm cột bắt buộc). `propagateSkippedTables` thêm mọi bảng có quan hệ không hoãn được tới bảng bị bỏ, lặp tới điểm dừng.
  4. `tableIds`: sắp topo các bảng còn lại trên các cạnh còn lại (không hoãn, không tự tham chiếu, hai đầu không bị bỏ) bằng thuật toán Kahn, mỗi bước chọn bảng sẵn sàng đứng đầu theo `sortTables`.
  5. `deferredRelationIds` theo `sortRelations`, không gồm quan hệ chạm bảng bị bỏ; `skippedTableIds` theo `sortTables`.
- `propagateSkippedTables` được export để Task 21 lan truyền cả bảng bị bỏ vì kiểu custom.

`relation-field-names.ts`:

```ts
export function allocateModelNames(schema: SchemaDocument, reservedWords: readonly string[]): {
  readonly enumNames: ReadonlyMap<EnumId, string>; readonly tableNames: ReadonlyMap<TableId, string>;
};
export type RelationFieldNames = {
  readonly columnFieldNames: ReadonlyMap<ColumnId, string>;
  readonly forwardFieldNames: ReadonlyMap<RelationId, string>; // trên bảng fromTableId
  readonly inverseFieldNames: ReadonlyMap<RelationId, string>; // trên bảng toTableId
  readonly relationNames: ReadonlyMap<RelationId, string>;     // chỉ quan hệ cần tên
};
export function buildRelationFieldNames(schema: SchemaDocument, tableModelNames: ReadonlyMap<TableId, string>): RelationFieldNames;
```

- `allocateModelNames`: một allocator `comparison: "exact"`, `separator: ""`; enum trước theo `sortEnums` (fallback `Enum`), rồi bảng theo `sortTables` (fallback `Table`); mỗi tên là `withReservedWordSuffix(toPascalCaseIdentifier(name, fallback), reservedWords)` trước khi cấp. Prisma truyền danh sách từ dành riêng của Prisma (Task 17); Drizzle truyền `[]`.
- `buildRelationFieldNames`: mỗi bảng một allocator `comparison: "exact"`, `separator: ""`.
  1. Trường cột theo `columnIds`: `toCamelCaseIdentifier(column.name, "field")`.
  2. Trường phía khóa ngoại của mọi quan hệ theo `sortRelations`, cấp trong allocator của bảng nguồn: quan hệ một cặp cột mà tên cột nguồn kết thúc bằng `_id`, ` id` hoặc `Id` và phần còn lại không rỗng → camelCase phần còn lại; ngược lại → camelCase tên bảng đích.
  3. Trường phía ngược của mọi quan hệ theo `sortRelations`, cấp trong allocator của bảng đích: camelCase tên bảng nguồn.
  4. `relationNames`: quan hệ tự tham chiếu, hoặc có hơn một quan hệ giữa cùng cặp bảng (không kể chiều) → `` `${tên model nguồn}_${trường phía khóa ngoại}` ``.

**Test viết trước:**

- `relation-graph.test.ts`: `finds the primary key as the referenced key`; `finds a unique column as the referenced key`; `finds a unique index with the same column set`; `prefers the primary key over a unique index with the same columns`; `returns null when no unique key matches`; `orders column pairs by the referenced key order`; `keeps stored pair order when no key matches`; `reports a self-referencing cascade as a conflict`; `reports the relation that closes a cascade cycle`; `reports the relation that adds a second cascade path`; `keeps no-action and restrict relations out of the cascade graph`; `returns conflicts in relation order regardless of map key order`; `orders referenced tables before referencing tables`; `breaks load order ties by table order`; `defers a nullable relation inside a cycle`; `skips the tables of a cycle of required foreign keys`; `skips a table with a required foreign key to a skipped table`; `keeps a table with a nullable foreign key to a skipped table`; `ignores self-references when ordering tables`.
- `relation-field-names.test.ts`: `names column fields by camelCase of column names`; `names the forward field by stripping an id suffix` (`it.each`: `author_id`, `người dùng id`, `authorId`); `names the forward field by the target table when there is no id suffix`; `names the forward field by the target table for a composite relation`; `names the inverse field by camelCase of the source table`; `adds 2 when a relation field repeats a column field`; `adds a relation name for two relations between the same tables`; `adds a relation name for a self-reference`; `writes no relation name for a single relation`; `allocates model names with enums before tables and suffixes reserved words`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add relation graph and relation field naming`

## Task 12: Quy tắc kiểu và khóa theo dialect

**Mục tiêu:** SQL, Prisma và Drizzle của cùng một dialect cho cùng kiểu đích, cùng ràng buộc bị bỏ, cùng hành động và cùng diagnostic (spec mục 3 "SQL", mục 4 danh mục mã và "Ma trận cho SQL, Prisma và Drizzle").

**Phụ thuộc:** Task 2, Task 6. **Đợt:** 3.

**File sở hữu:** tạo, mỗi file kèm `<name>.test.ts`: `packages/core/src/generators/shared/dialect-types.ts`, `dialect-constraints.ts`, `mysql-identifiers.ts`, `packages/core/src/validation/rules/custom-type-name.ts`; sửa `packages/core/src/validation/rules/columns.ts` (chỉ import hàm mới thay cho kiểm tra tại chỗ; `columns.test.ts` không sửa và phải pass nguyên vẹn). Spec mục 1 không liệt kê các file này; plan tách để ba đích dùng chung mà không import chéo.

**Chữ ký và hành vi:**

`custom-type-name.ts`: `isSafeCustomTypeName(name: string): boolean`, đúng điều kiện của `column-custom-type-invalid` (khớp `^[A-Za-z][A-Za-z0-9_ ,()\[\]]*$` và tối đa 63 byte UTF-8).

`dialect-types.ts`:

```ts
export type DialectColumnType =
  | { readonly kind: "smallint" | "integer" | "bigint" | "real" | "double" | "boolean" | "text" | "uuid"
      | "date" | "time" | "timestamp" | "timestamptz" | "json" | "binary" }
  | { readonly kind: "decimal"; readonly precision: number; readonly scale: number }
  | { readonly kind: "char" | "varchar"; readonly length: number }
  | { readonly kind: "keyText"; readonly length: number }  // text trong khóa: MySQL 255, SQL Server 450
  | { readonly kind: "enum"; readonly enumId: EnumId }
  | { readonly kind: "custom"; readonly name: string; readonly isSafe: boolean };
export function resolveDialectColumnType(input: {
  readonly dialect: SqlDialect; readonly column: Column; readonly isKeyColumn: boolean;
}): { readonly type: DialectColumnType; readonly diagnostics: readonly GeneratorDiagnostic[] };
```

| Giới hạn | PostgreSQL | MySQL | SQL Server |
|---|---|---|---|
| `char(n)` tối đa | 10 485 760 | 255 | 4000 |
| `varchar(n)` tối đa | 10 485 760 | 16 383 | 4000 |
| `decimal` precision, scale tối đa | 1000, 1000 | 65, 30 | 38, 38 |
| Độ dài `keyText` | không áp dụng | 255 | 450 |

- `char(n)` vượt giới hạn: MySQL → `varchar(n)` nếu `n` trong giới hạn `varchar`, nếu không → `text`; PostgreSQL, SQL Server → `text` (Vấn đề 6). `varchar(n)` vượt giới hạn → `text`. `decimal`: kẹp precision về tối đa, rồi kẹp scale về `min(scale tối đa, precision sau khi kẹp)` khi lớn hơn. Mỗi lần đổi một diagnostic `type-parameter-out-of-range`.
- MySQL và SQL Server: nếu kiểu sau bước trên là `text` và `isKeyColumn` → `keyText` kèm `key-column-type-narrowed` (áp cả cho `varchar` quá dài đã thành `text`, Vấn đề 6). PostgreSQL giữ `text`.
- `custom` → `isSafe: isSafeCustomTypeName(name)`; diagnostic `custom-type-unsafe` do Task 13 thêm, vì chỉ SQL cần. Mọi kiểu khác giữ nguyên.
- `path` của diagnostic là `["columns", column.id, "type"]`.

`dialect-constraints.ts`:

```ts
export function collectKeyColumnIds(schema: SchemaDocument): ReadonlySet<ColumnId>;
export type DroppedConstraints = {
  readonly primaryKeyTableIds: ReadonlySet<TableId>; readonly uniqueColumnIds: ReadonlySet<ColumnId>;
  readonly indexIds: ReadonlySet<IndexId>; readonly relationIds: ReadonlySet<RelationId>;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};
export function findUnindexableConstraints(schema: SchemaDocument, dialect: SqlDialect): DroppedConstraints;
export function resolveReferentialAction(dialect: SqlDialect, action: ReferentialAction):
  { readonly action: ReferentialAction; readonly isLossy: boolean };
export function resolveSqlServerUnique(schema: SchemaDocument, tableId: TableId, columnIds: readonly ColumnId[]):
  { readonly mode: "plain" | "filtered"; readonly isNullsRestricted: boolean };
```

- `collectKeyColumnIds`: cột thuộc khóa chính, cột `isUnique`, cột của index, cột hai đầu của mọi cặp quan hệ (điều kiện của `key-column-type-narrowed`).
- `findUnindexableConstraints`: PostgreSQL → rỗng. MySQL, SQL Server: khóa chính có cột kiểu `json` hoặc `binary` bị bỏ; cột `isUnique` kiểu đó bỏ unique; index có cột kiểu đó bị bỏ; quan hệ có cột kiểu đó ở một trong hai đầu bị bỏ (kiểu hai đầu phải bằng nhau, nên đây đúng là khóa ngoại tham chiếu tới ràng buộc bị bỏ). Mỗi phần tử bị bỏ một diagnostic `key-column-type-not-indexable` theo hợp đồng `path` của Task 2.
- `resolveReferentialAction`: MySQL `setDefault` → `noAction`, `isLossy: true` (người gọi thêm `referential-action-not-supported` cho từng sự kiện); SQL Server `restrict` → `noAction`, `isLossy: false` (tương đương); còn lại giữ nguyên, `isLossy: false`. Hạ hành động vì vòng cascade là việc của `findCascadeConflicts` (Task 11), không nằm ở đây.
- `resolveSqlServerUnique`: không cột nào nullable → `plain`; có cột nullable và có quan hệ tới đúng bảng đó với tập `toColumnId` bằng tập `columnIds` → `plain`, `isNullsRestricted: true` (người gọi thêm `unique-nulls-restricted`); có cột nullable và không được tham chiếu → `filtered`.

`mysql-identifiers.ts`:

```ts
export type MysqlNames = {
  readonly columnNames: ReadonlyMap<ColumnId, string>; readonly indexNames: ReadonlyMap<IndexId, string>;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};
export function allocateMysqlNames(schema: SchemaDocument): MysqlNames;
```

- Mỗi bảng: một allocator `comparison: "caseAndAccentInsensitive"`, `separator: "_"`, `maxBytes: 63` cho cột theo `columnIds`; một allocator như vậy cho index của bảng theo `sortIndexes`. Tên cấp khác tên gốc → `identifier-collision-renamed` tại `["columns", id, "name"]` hoặc `["indexes", id, "name"]`. Mọi cột và index đều có mục trong map, kể cả khi không đổi tên.
- Tên ràng buộc do generator đặt không đi qua đây: Task 9 đã so không phân biệt dấu cho mọi dialect.

**Test viết trước:**

- `custom-type-name.test.ts`: `accepts inet, geometry(Point, 4326), text[] and double precision` (`it.each`); `rejects a name with a quote, semicolon, hyphen or slash` (`it.each`); `rejects a name starting with a digit`; `rejects a 64-byte name`.
- `dialect-types.test.ts`: `keeps types within dialect limits unchanged` (`it.each`); `maps char beyond the MySQL limit to varchar`; `maps char beyond the MySQL varchar limit to text`; `maps char beyond the PostgreSQL and SQL Server limits to text`; `maps varchar beyond the limit to text for each dialect` (`it.each`); `clamps decimal precision and scale to each dialect limit` (`it.each`); `reports type-parameter-out-of-range at the column type path`; `keeps text in a PostgreSQL key column`; `narrows text in a key column to 255 on MySQL and 450 on SQL Server`; `narrows an out-of-range varchar key column and reports both diagnostics`; `marks a custom type with an unsafe name`.
- `dialect-constraints.test.ts`: `collects primary key, unique, index and relation columns as key columns`; `drops nothing on PostgreSQL`; `drops a primary key, a unique column and an index containing json or binary` (`it.each` MySQL, SQL Server); `drops a relation between json or binary columns`; `reports one key-column-type-not-indexable per dropped element`; `maps set default to no action on MySQL as lossy`; `maps restrict to no action on SQL Server without loss`; `keeps every action on PostgreSQL`; `filters a nullable unique that no foreign key references`; `restricts a nullable unique referenced by a foreign key`; `uses a plain unique when no column is nullable`.
- `mysql-identifiers.test.ts`: `renames a column that differs from an earlier column only by an accent`; `renames an index that differs from an earlier index of the same table only by an accent`; `keeps index names that differ only by an accent in different tables`; `reports identifier-collision-renamed at the renamed name path`; `keeps every other name unchanged`; `renames in column order and index order regardless of map key order`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add dialect type and constraint rules`

## Task 13: Mô hình DDL dùng chung cho ba dialect

**Mục tiêu:** ba generator SQL chỉ còn việc in cú pháp: mọi quyết định về tên, kiểu, giá trị mặc định, ràng buộc bị bỏ, hành động và diagnostic nằm trong một mô hình dùng chung (spec mục 1 "Ba dialect SQL là ba đích… dùng chung phần dựng câu lệnh trong `shared/`", CG-01, mục 2, 3, 4).

**Phụ thuộc:** Task 4, 7, 9, 11, 12. **Đợt:** 4.

**File sở hữu (tạo):** `packages/core/src/generators/shared/sql-ddl-model.ts`, `sql-ddl-model.test.ts`. Vượt 300 dòng thì tách thành `sql-ddl-model-<phần>.ts` cùng thư mục, vẫn thuộc task này, kèm test tương ứng.

**Chữ ký:**

```ts
export type SqlColumnModel = {
  readonly columnId: ColumnId; readonly name: string; readonly type: DialectColumnType;
  readonly isNullable: boolean; readonly isAutoIncrement: boolean;
  readonly defaultSql: string | null;  // đã quote, escape theo dialect
  readonly comment: string;            // "" là không có
};
export type SqlUniqueModel = { readonly name: string; readonly columnNames: readonly string[] };
export type SqlTableModel = {
  readonly tableId: TableId; readonly name: string; readonly comment: string;
  readonly columns: readonly SqlColumnModel[];
  readonly primaryKey: SqlUniqueModel | null;
  readonly uniqueConstraints: readonly SqlUniqueModel[];  // ràng buộc trong CREATE TABLE
  readonly enumChecks: readonly { readonly name: string; readonly columnName: string; readonly values: readonly string[] }[]; // chỉ SQL Server
};
export type SqlIndexModel = {
  readonly name: string; readonly tableName: string; readonly columnNames: readonly string[];
  readonly isUnique: boolean; readonly filterColumnNames: readonly string[]; // khác rỗng: SQL Server WHERE … IS NOT NULL
};
export type SqlForeignKeyModel = {
  readonly name: string; readonly tableName: string; readonly columnNames: readonly string[];
  readonly referencedTableName: string; readonly referencedColumnNames: readonly string[];
  readonly onDelete: ReferentialAction; readonly onUpdate: ReferentialAction;
};
export type SqlDdlModel = {
  readonly enums: readonly { readonly enumId: EnumId; readonly name: string; readonly values: readonly string[] }[];
  readonly tables: readonly SqlTableModel[];
  readonly indexes: readonly SqlIndexModel[];
  readonly foreignKeys: readonly SqlForeignKeyModel[];
  readonly diagnostics: readonly GeneratorDiagnostic[];
};
export function buildSqlDdlModel(schema: SchemaDocument, dialect: SqlDialect): SqlDdlModel;
```

**Hành vi:**

1. Chuẩn bị: `collectKeyColumnIds`, `findUnindexableConstraints(schema, dialect)`, `allocateConstraintNames(schema, (relation) => orderColumnPairsByReferencedKey(schema, relation))`; MySQL thêm `allocateMysqlNames(schema)`; SQL Server thêm `findCascadeConflicts(schema)`. Tên cột ghi ra luôn lấy qua một hàm tra cứu duy nhất (tên MySQL đã đổi, hoặc tên gốc), dùng cho cột, khóa chính, unique, index, khóa ngoại và CHECK.
2. **Enum** theo `sortEnums`. PostgreSQL: giá trị qua `removeNullCharacters`, bỏ thì thêm `null-character-removed` tại `["enums", id, "values", i]`.
3. **Bảng** theo `sortTables`, cột theo `columnIds`:
   - Kiểu: `resolveDialectColumnType`. Kiểu `custom` có `isSafe: false` → thay bằng `{ kind: "text" }` kèm `custom-type-unsafe`.
   - Mặc định: `formatSqlDefault` với `shouldParenthesizeLiteral` đúng khi dialect là MySQL và kiểu sau bước trên là `text`, `json` hoặc `binary`. `omitted` → `defaultSql: null` kèm `default-omitted`; `hasRemovedNullCharacter` → `null-character-removed` tại `["columns", id, "defaultValue"]`.
   - Comment bảng và cột: PostgreSQL bỏ U+0000 kèm `null-character-removed` tại đường dẫn `comment` tương ứng; MySQL, SQL Server giữ nguyên.
   - Khóa chính: khi `primaryKeyColumnIds` không rỗng và bảng không nằm trong `primaryKeyTableIds` bị bỏ, tên từ `primaryKeys`.
   - Cột `isUnique` không bị bỏ, theo `columnIds`: PostgreSQL, MySQL → `uniqueConstraints`. SQL Server → `resolveSqlServerUnique(schema, tableId, [columnId])`: `plain` → `uniqueConstraints` (thêm `unique-nulls-restricted` tại `["columns", id, "isUnique"]` khi `isNullsRestricted`); `filtered` → một `SqlIndexModel` unique có `filterColumnNames: [tên cột]`, cùng tên ràng buộc.
   - `enumChecks`: chỉ SQL Server, mọi cột enum theo `columnIds`, tên từ `enumChecks` của Task 9.
4. **Index**: index của người dùng theo `sortIndexes` (bỏ index trong `indexIds` bị bỏ), tên MySQL đã đổi hoặc tên gốc; SQL Server với index unique gọi `resolveSqlServerUnique`: `filtered` → `filterColumnNames` là các cột nullable theo thứ tự cột của index; `isNullsRestricted` → `unique-nulls-restricted` tại `["indexes", id]`. Sau đó mới đến index lọc sinh từ cột `isUnique` ở bước 3, theo thứ tự bảng rồi cột.
5. **Khóa ngoại** theo `sortRelations`, bỏ quan hệ trong `relationIds` bị bỏ; cặp cột theo `orderColumnPairsByReferencedKey`. SQL Server: quan hệ trong `findCascadeConflicts` → cả hai hành động `noAction` kèm `referential-action-cycle` tại `["relations", id]`. Còn lại mỗi sự kiện qua `resolveReferentialAction`; `isLossy` → `referential-action-not-supported` tại `["relations", id, "onDelete"]` hoặc `"onUpdate"`.
6. Phần tử được tham chiếu mà không tìm thấy (không xảy ra với tài liệu đã qua `parseSchemaDocument`) thì bỏ qua, không throw. `diagnostics` đi qua `finalizeDiagnostics`.

**Test viết trước:**

- `orders enums, tables, indexes and foreign keys by the part 2 ordering`; `returns the same model regardless of map key order`.
- `resolves column types, defaults and comments for each dialect` (`it.each` ba dialect trên vài cột của `createSampleSchema()`).
- `uses the renamed MySQL column name in the primary key, index and foreign key`.
- `replaces an unsafe custom type with text and reports custom-type-unsafe`; `omits an invalid default and reports default-omitted`; `parenthesizes a MySQL literal default on text, json and binary storage`.
- `removes null characters from PostgreSQL comments, defaults and enum values and reports each`; `keeps null characters for MySQL and SQL Server`.
- `drops constraints with json or binary columns on MySQL and SQL Server and keeps them on PostgreSQL`.
- `moves a nullable unique column to a filtered unique index on SQL Server`; `adds filter columns to a nullable unique index on SQL Server`; `keeps a referenced nullable unique as a constraint and reports unique-nulls-restricted`.
- `orders foreign key columns by the referenced key`.
- `downgrades both actions of a cascade conflict on SQL Server and reports referential-action-cycle`; `maps set default to no action on MySQL and reports each event`; `writes restrict as no action on SQL Server without a diagnostic`.
- `writes enum checks only for SQL Server`; `uses the allocated constraint names`.
- `reports the expected diagnostic codes for createTargetLimitSchema on each dialect` (`it.each`, so tập mã).
- `does not throw for a schema with duplicate names, an invalid default and an unsafe custom type`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add shared sql ddl model`

## Task 14: CG-01 SQL DDL cho PostgreSQL

**Mục tiêu:** `@schemaforge/core/generators/postgresql` export `generatePostgresql`, in DDL PostgreSQL từ `SqlDdlModel` (spec CG-01, mục 3 bảng "SQL" cột PostgreSQL, mục 4 ma trận).

**Phụ thuộc:** Task 1, 4, 5, 13. **Đợt:** 5.

**File sở hữu (tạo):** `packages/core/src/generators/postgresql/index.ts`, `generate-postgresql.ts`, `generate-postgresql.test.ts`, `render-postgresql-type.ts`, `render-postgresql-type.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/postgresql/`.

**Chữ ký:**

```ts
export type PostgresqlOptions = GeneratorOptions["postgresql"];
export function generatePostgresql(schema: SchemaDocument, options: PostgresqlOptions): GenerateResult;
export function renderPostgresqlType(type: DialectColumnType, enums: SchemaDocument["enums"]): string; // không export qua index.ts
```

`index.ts` chỉ export `generatePostgresql` và type `PostgresqlOptions`. Kết quả: `file` là `{ fileName: "schema.sql", language: "sql", content }`, `diagnostics` là `model.diagnostics` của `buildSqlDdlModel(schema, "postgresql")`.

**Kiểu:** `smallint`, `integer`, `bigint`, `numeric(p, s)`, `real`, `double precision`, `boolean`, `char(n)`, `varchar(n)`, `text`, `uuid`, `date`, `time`, `timestamp`, `timestamptz`, `jsonb`, `bytea`; enum là `quoteSqlIdentifier` của tên enum (enum không tìm thấy → `text`); `custom` ghi nguyên văn (model đã thay tên không an toàn); `keyText` không xuất hiện ở PostgreSQL, nếu có thì ghi `varchar(n)`.

**Output** ghép bằng `renderFileContent`, các block theo thứ tự, block rỗng bị bỏ:

1. Mỗi enum một dòng: `CREATE TYPE "order_status" AS ENUM ('pending', 'paid');`.
2. Mỗi bảng một block:

   ```sql
   CREATE TABLE "users" (
     "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
     "manager_id" bigint,
     "created_at" timestamptz NOT NULL DEFAULT now(),
     CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "users_email_key" UNIQUE ("email")
   );
   ```

   Dòng cột: tên, kiểu, ` GENERATED BY DEFAULT AS IDENTITY` khi auto-increment, ` NOT NULL` khi không nullable, ` DEFAULT <defaultSql>` khi có. Sau các cột: khóa chính, rồi unique theo thứ tự trong model. Bảng không có cột và ràng buộc nào: `CREATE TABLE "t" ();`.
3. Mỗi index một dòng: `CREATE [UNIQUE ]INDEX "tên" ON "bảng" ("a", "b");`.
4. Mỗi khóa ngoại một dòng: `ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;`. Hành động: `NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`.
5. Comment theo thứ tự bảng: `COMMENT ON TABLE "users" IS '…';` rồi `COMMENT ON COLUMN "users"."email" IS '…';` theo thứ tự cột. Comment rỗng không có câu lệnh.

Không có `DROP`, `BEGIN`, `COMMIT`, dòng comment đầu file hay thời gian.

**Test viết trước:**

- `render-postgresql-type.test.ts`: `renders every dialect column type` (`it.each`); `quotes an enum type name`; `falls back to text for a missing enum`.
- `generate-postgresql.test.ts`: `names the file schema.sql with language sql`; `creates enum types before tables`; `writes identity, not null and default in column order`; `writes the primary key and unique constraints after the columns`; `creates indexes before foreign keys`; `adds foreign keys with both actions after every table`; `writes restrict as RESTRICT and set default as SET DEFAULT`; `writes table comments before their column comments at the end`; `quotes a table name containing a double quote`; `escapes a comment containing quotes and a comment terminator`; `keeps constraints with json and binary columns`; `returns the diagnostics of the ddl model`; `writes an empty schema as a single newline`; `contains no DROP, BEGIN or COMMIT for the sample schema`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture>` (`it.each` với `sample`, `naming-edge`, `target-limit`, `empty`), mỗi fixture một file `.sql` và một file `.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm:

```bash
pnpm --filter @schemaforge/backend exec node --input-type=module -e 'const generator = await import("@schemaforge/core/generators/postgresql"); const testing = await import("@schemaforge/core/testing"); console.log(typeof generator.generatePostgresql, generator.generatePostgresql(testing.createSampleSchema(), {}).file.fileName)'
```

Mong đợi: in `function schema.sql` (xác nhận pattern `./generators/*` của Task 5 hoạt động với một đích thật). DDL chạy trên database thật được kiểm chứng ở Task 29.

**Commit:** `feat(core): add postgresql ddl generator`

## Task 15: CG-01 SQL DDL cho MySQL

**Mục tiêu:** `@schemaforge/core/generators/mysql` export `generateMysql`, in DDL MySQL 8.4 từ `SqlDdlModel` (spec CG-01, mục 3 bảng "SQL" cột MySQL, mục 4 ma trận, mục "Rủi ro").

**Phụ thuộc:** Task 1, 4, 5, 13, và Task 8 với job `conformance` đã xanh trên CI. **Đợt:** 5.

**Trước khi bắt đầu:** đọc báo cáo probe MySQL của Task 8. Điểm nào khác spec mục 4 hoặc khác đề xuất ở Vấn đề 1, 2, 7, 9 thì dừng và báo; không tự đổi quy tắc.

**File sở hữu (tạo):** `packages/core/src/generators/mysql/index.ts`, `generate-mysql.ts`, `generate-mysql.test.ts`, `render-mysql-type.ts`, `render-mysql-type.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/mysql/`.

**Chữ ký:**

```ts
export type MysqlOptions = GeneratorOptions["mysql"];
export function generateMysql(schema: SchemaDocument, options: MysqlOptions): GenerateResult;
export function renderMysqlType(type: DialectColumnType, enums: SchemaDocument["enums"]): string; // không export qua index.ts
```

`index.ts` chỉ export `generateMysql` và type `MysqlOptions`. `file` là `{ fileName: "schema.sql", language: "sql", content }`; `diagnostics` từ `buildSqlDdlModel(schema, "mysql")`.

**Kiểu:** `SMALLINT`, `INT`, `BIGINT`, `DECIMAL(p, s)`, `FLOAT`, `DOUBLE`, `BOOLEAN`, `CHAR(n)`, `VARCHAR(n)`, `LONGTEXT` cho `text`, `VARCHAR(n)` cho `keyText`, `CHAR(36)` cho `uuid`, `DATE`, `TIME(6)`, `DATETIME(6)` cho `timestamp`, `TIMESTAMP(6)` cho `timestamptz`, `JSON`, `LONGBLOB`; enum là `ENUM('a', 'b')` với giá trị qua `sqlStringLiteral("mysql", …)` (enum không tìm thấy → `LONGTEXT`); `custom` ghi nguyên văn.

**Output** ghép bằng `renderFileContent`:

1. Mỗi bảng một block (MySQL không có `CREATE TYPE`):

   ```sql
   CREATE TABLE `users` (
     `id` BIGINT AUTO_INCREMENT NOT NULL,
     `email` VARCHAR(255) NOT NULL COMMENT 'Địa chỉ email',
     `bio` LONGTEXT DEFAULT (''),
     PRIMARY KEY (`id`),
     CONSTRAINT `users_email_key` UNIQUE (`email`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci COMMENT='Người dùng';
   ```

   Dòng cột theo thứ tự spec: tên, kiểu, ` AUTO_INCREMENT`, ` NOT NULL`, ` DEFAULT <defaultSql>`, ` COMMENT '<comment>'` (literal qua `sqlStringLiteral`). Sau các cột: `PRIMARY KEY (…)` **không có tên ràng buộc** (MySQL luôn đặt `PRIMARY`), rồi `CONSTRAINT … UNIQUE (…)`. Mỗi phần tử trong ngoặc cách nhau bằng dấu phẩy như PostgreSQL. Tùy chọn bảng luôn là `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci`, thêm ` COMMENT=<literal>` khi comment bảng không rỗng.
2. Mỗi index một dòng: `` CREATE [UNIQUE ]INDEX `tên` ON `bảng` (`a`, `b`); ``.
3. Mỗi khóa ngoại một dòng: `` ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION; ``. Hành động như PostgreSQL; `setDefault` đã được model đổi thành `noAction`.
4. Không có block comment: comment đã nằm trong `CREATE TABLE`.

**Test viết trước:**

- `render-mysql-type.test.ts`: `renders every dialect column type` (`it.each`); `renders an enum column as ENUM with escaped values`; `renders a narrowed key text as VARCHAR`.
- `generate-mysql.test.ts`: `names the file schema.sql with language sql`; `writes auto-increment, not null, default and comment in column order`; `writes an unnamed primary key and named unique constraints`; `ends every table with InnoDB, utf8mb4 and the accent-sensitive collation`; `writes a non-empty table comment as a table option`; `wraps literal defaults of LONGTEXT, JSON and LONGBLOB columns in parentheses`; `writes CURRENT_TIMESTAMP(6) and (UUID()) defaults`; `narrows text key columns to VARCHAR(255) and reports key-column-type-narrowed`; `omits constraints with json or binary columns and reports each`; `writes set default as NO ACTION and reports each event`; `renames a column that differs only by an accent and uses the new name in keys`; `escapes backslashes and quotes in string literals`; `quotes identifiers containing a backtick`; `creates indexes before foreign keys`; `writes no statement after the foreign keys`; `writes an empty schema as a single newline`.
- Snapshot: `matches the snapshot for <fixture>` (`it.each` với `sample`, `naming-edge`, `target-limit`, `empty`).

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/mysql` và `generateMysql`, mong đợi `function schema.sql`.

**Commit:** `feat(core): add mysql ddl generator`

## Task 16: CG-01 SQL DDL cho SQL Server

**Mục tiêu:** `@schemaforge/core/generators/sqlserver` export `generateSqlServer`, in T-SQL cho SQL Server 2022 từ `SqlDdlModel` (spec CG-01, mục 3 bảng "SQL" cột SQL Server, mục 4 ma trận và "Phát hiện vòng cascade trên SQL Server").

**Phụ thuộc:** Task 1, 4, 5, 13, và Task 8 với job `conformance` đã xanh trên CI. **Đợt:** 5.

**Trước khi bắt đầu:** đọc báo cáo probe SQL Server của Task 8 và lựa chọn của user cho Vấn đề 2, 8, 9. Điểm nào khác spec thì dừng và báo.

**File sở hữu (tạo):** `packages/core/src/generators/sqlserver/index.ts`, `generate-sqlserver.ts`, `generate-sqlserver.test.ts`, `render-sqlserver-type.ts`, `render-sqlserver-type.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/sqlserver/`.

**Chữ ký:**

```ts
export type SqlServerOptions = GeneratorOptions["sqlserver"];
export function generateSqlServer(schema: SchemaDocument, options: SqlServerOptions): GenerateResult;
export function renderSqlServerType(type: DialectColumnType, enums: SchemaDocument["enums"]): string; // không export qua index.ts
export function sqlServerEnumLength(values: readonly string[]): number | null; // null nghĩa là nvarchar(max)
```

`index.ts` chỉ export `generateSqlServer` và type `SqlServerOptions`. `file` là `{ fileName: "schema.sql", language: "sql", content }`.

**Kiểu:** `smallint`, `int`, `bigint`, `decimal(p, s)`, `real`, `float(53)`, `bit`, `nchar(n)`, `nvarchar(n)`, `nvarchar(max)` cho `text` và `json`, `nvarchar(n)` cho `keyText`, `uniqueidentifier`, `date`, `time`, `datetime2` cho `timestamp`, `datetimeoffset` cho `timestamptz`, `varbinary(max)`; `custom` ghi nguyên văn. Enum là `nvarchar(n)` với `n = sqlServerEnumLength(values)`: độ dài giá trị dài nhất tính theo code unit UTF-16 (`value.length`), tối thiểu 1; lớn hơn 4000 → `nvarchar(max)`, và `generateSqlServer` thêm `type-parameter-out-of-range` tại `["columns", id, "type"]` cho từng cột enum đó, gộp với `model.diagnostics` bằng `finalizeDiagnostics` (Vấn đề 6). Enum không tìm thấy → `nvarchar(max)`.

**Output** ghép bằng `renderFileContent`:

1. Mỗi bảng một block:

   ```sql
   CREATE TABLE [orders] (
     [id] bigint IDENTITY(1, 1) NOT NULL,
     [note] nvarchar(max) NULL,
     [status] nvarchar(7) NOT NULL DEFAULT N'pending',
     CONSTRAINT [orders_pkey] PRIMARY KEY ([id]),
     CONSTRAINT [orders_code_key] UNIQUE ([code]),
     CONSTRAINT [orders_status_check] CHECK ([status] IN (N'pending', N'paid'))
   );
   ```

   Dòng cột: tên, kiểu, ` IDENTITY(1, 1)` khi auto-increment, ` NOT NULL` hoặc ` NULL`, ` DEFAULT <defaultSql>` khi có. SQL Server ghi `NULL` tường minh (khác PostgreSQL, MySQL) vì mặc định nullable của cột phụ thuộc thiết lập phiên `ANSI_NULL_DFLT_ON`. Sau các cột: khóa chính, unique, rồi CHECK của cột enum (spec CG-01 bước 2).
2. Mỗi index một dòng: `CREATE [UNIQUE ]INDEX [tên] ON [bảng] ([a], [b])`, thêm ` WHERE [a] IS NOT NULL AND [b] IS NOT NULL` khi `filterColumnNames` khác rỗng, kết thúc `;`. Index lọc sinh từ cột `isUnique` đứng sau index của người dùng (thứ tự của model), và mọi index đứng trước khóa ngoại.
3. Mỗi khóa ngoại một dòng: `ALTER TABLE [posts] ADD CONSTRAINT [posts_author_id_fkey] FOREIGN KEY ([author_id]) REFERENCES [users] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;`. Hành động: `NO ACTION`, `CASCADE`, `SET NULL`, `SET DEFAULT` (`restrict` và quan hệ xung đột cascade đã được model đổi thành `noAction`).
4. Comment, chỉ khi có ít nhất một comment không rỗng: dòng đầu `DECLARE @schema_name sysname = SCHEMA_NAME();`, rồi theo thứ tự bảng, comment bảng trước comment cột:
   `EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'…', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N'users';` và với cột thêm `, @level2type = N'COLUMN', @level2name = N'email'`. Tên bảng, tên cột và comment đều qua `sqlStringLiteral("sqlserver", …)`.

Không có `GO`, `USE`, `BEGIN`, `COMMIT`, `DROP` hay thời gian.

**Test viết trước:**

- `render-sqlserver-type.test.ts`: `renders every dialect column type` (`it.each`); `sizes an enum column by its longest value in UTF-16 code units`; `sizes an enum with only empty values as nvarchar(1)`; `uses nvarchar(max) for an enum value longer than 4000 code units`.
- `generate-sqlserver.test.ts`: `names the file schema.sql with language sql`; `writes identity, explicit null or not null, and default in column order`; `writes primary key, unique and enum check constraints after the columns`; `writes enum check values as N literals`; `writes bit defaults as 1 and 0`; `writes sysdatetime for datetime2 and sysdatetimeoffset for datetimeoffset`; `writes newid() for generateUuid`; `moves a nullable unique column to a filtered unique index`; `writes a WHERE clause for the nullable columns of a unique index`; `keeps a referenced nullable unique as a constraint and reports unique-nulls-restricted`; `writes restrict as NO ACTION without a diagnostic`; `downgrades a cascade cycle and a second cascade path to NO ACTION and reports referential-action-cycle`; `narrows text key columns to nvarchar(450)`; `omits constraints with json or binary columns and reports each`; `creates indexes before foreign keys`; `declares the schema name variable once before the extended properties`; `passes table and column names to sp_addextendedproperty as N literals`; `writes no comment statements when no comment exists`; `quotes identifiers containing a closing bracket`; `contains no GO batch separator for the naming edge schema`; `reports type-parameter-out-of-range for an enum longer than 4000 code units`; `writes an empty schema as a single newline`.
- Snapshot: `matches the snapshot for <fixture>` (`it.each` với `sample`, `naming-edge`, `target-limit`, `empty`).

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/sqlserver` và `generateSqlServer`, mong đợi `function schema.sql`.

**Commit:** `feat(core): add sql server ddl generator`

## Vấn đề phát hiện khi lập plan

Các task đã viết theo phương án đề xuất. **Task 0** (không có thân riêng): orchestrator trình bảng này cho user, ghi lựa chọn vào spec phần 6 (hoặc báo cho plan phần 2 khi vấn đề thuộc phần 2), rồi mới giao các task ở cột "Ảnh hưởng". User chọn khác đề xuất thì chỉ sửa đúng các task đó. Lượt lập plan thứ hai thêm vấn đề mới vào cuối bảng, đánh số tiếp từ 13.

| # | Vấn đề | Đề xuất | Ảnh hưởng |
|---|---|---|---|
| 1 | **MySQL giới hạn tổng độ dài khóa index 3072 byte.** Với `utf8mb4` mỗi ký tự tính 4 byte, nên một cột `char`, `varchar` có `n > 768` trong khóa chính, unique hoặc index, hoặc nhiều cột có tổng vượt 3072 byte (kể cả bốn cột `text` đã hẹp về `VARCHAR(255)` theo spec), làm `CREATE TABLE`, `CREATE INDEX` báo lỗi 1071. Schema vẫn hợp lệ theo phần 2, và ma trận spec mục 4 chỉ xử lý `text`. SQL Server chỉ cảnh báo lúc tạo (900 byte cho khóa clustered, 1700 byte cho nonclustered), không lỗi DDL | Task 8 probe xác nhận. Nếu đúng, user chọn: (a) MySQL hẹp cột `char`, `varchar` trong khóa có `n > 768` về `VARCHAR(768)` kèm `key-column-type-narrowed`, và khi tổng vẫn vượt 3072 byte thì bỏ ràng buộc hoặc index kèm `key-column-type-not-indexable`; hoặc (b) ghi thành giới hạn đã biết của CG-01 và fixture tránh trường hợp này. Plan nghiêng về (a) để giữ tiêu chí "DDL chạy không lỗi với schema hợp lệ" | Spec mục 4; Task 4, 8, 12, 13, 15, 17, 18 |
| 2 | **Giới hạn độ dài comment.** MySQL từ chối comment cột dài hơn 1024 ký tự và comment bảng dài hơn 2048 ký tự ở strict mode mặc định; giá trị extended property của SQL Server tối đa 7500 byte (3750 ký tự `nvarchar`). Phần 2 không giới hạn độ dài comment, nên schema hợp lệ có thể cho DDL lỗi | Task 8 probe xác nhận. Nếu đúng: thêm mã diagnostic thứ 17 `comment-truncated` (cắt ở ranh giới code point, `path` là đường dẫn `comment`), cần user duyệt vì đổi danh mục của spec mục 4. Trong lúc chờ, Task 15, 16 không cắt và fixture giữ comment ngắn | Spec mục 4; Task 2, 4, 13, 15, 16, 34 |
| 3 | **Kiểu custom trong conformance.** `createSampleSchema()` có cột `location` kiểu `geometry(Point, 4326)`. `postgres:18-alpine` không có PostGIS, MySQL không có cú pháp này, SQL Server có `geometry` nhưng không nhận tham số, nên chạy DDL của fixture nguyên trạng làm CG-01 fail trên cả ba database; seed cũng bỏ bảng `users` nếu cột này bắt buộc và không có mặc định | Package conformance có helper thay tên kiểu custom của fixture bằng một kiểu có thật của dialect trước khi sinh (`inet` cho PostgreSQL, `YEAR` cho MySQL, `money` cho SQL Server; cả ba qua cú pháp an toàn). Snapshot trong core vẫn dùng fixture nguyên trạng. Không dùng image PostGIS (nặng, và không giải quyết MySQL, SQL Server). Task 4 bảo đảm cột custom bắt buộc không mặc định chỉ nằm ở bảng riêng | Task 4, 8, 29 |
| 4 | **`restrict` trong đồ thị cascade của SQL Server.** Spec mục 4 đưa vào đồ thị mọi quan hệ "có hành động khác `noAction`". SQL Server ghi `restrict` là `NO ACTION` (tương đương theo nguyên tắc 2 của mục 4), và `NO ACTION` không gây lỗi vòng hay nhiều đường cascade. Đọc đúng chữ thì quan hệ `restrict` bị hạ kèm diagnostic dù output không đổi, và làm quan hệ cascade khác bị hạ oan | Đồ thị bỏ cả `noAction` và `restrict` (đã viết vào Task 11). Prisma `sqlserver` cũng ghi `restrict` là `NoAction`, nên SQL và Prisma vẫn khớp. Conformance của Task 29, 30 xác nhận với SQL Server và `prisma validate` | Spec mục 4; Task 11, 13, 17 |
| 5 | **Cột tên `__proto__`.** Tên này hợp lệ theo phần 2. Trong object literal JavaScript, cả `__proto__: …` lẫn `"__proto__": …` đặt prototype thay vì tạo thuộc tính, nên `z.object({ "__proto__": … })`, dữ liệu trong `handlers.ts` và object dựng bằng phép gán trong core âm thầm mất cột. Spec mục 5 chỉ ghi "khớp regex thì ghi trần, còn lại `JSON.stringify`" | `formatPropertyKey` trả `["__proto__"]` (khóa tính toán tạo thuộc tính thật, hợp lệ cả trong type literal TypeScript); mọi object có khóa từ tên người dùng dựng bằng `Object.fromEntries` (mục "Quy ước chung"). Fixture `naming-edge` có cột này; Task 30 typecheck và parse dữ liệu có cột này | Task 4, 6, 19, 20, 21, 22, 23, 24, 30 |
| 6 | **Tham số kiểu chưa đủ trong ma trận.** (a) PostgreSQL `char(n)` cũng tối đa 10 485 760 nhưng spec chỉ ghi `varchar(n)`. (b) Spec không nói thứ tự giữa "vượt giới hạn" và "`text` trong khóa": `varchar(20000)` trong khóa MySQL thành `LONGTEXT`, không đánh index được. (c) SQL Server enum là `nvarchar(n)` với `n` là độ dài giá trị dài nhất, nhưng không nói đơn vị và trường hợp vượt 4000 | (a) Xử lý như `varchar`: `text` kèm `type-parameter-out-of-range`. (b) Áp giới hạn trước, rồi hẹp như `text` (`VARCHAR(255)`, `nvarchar(450)`) kèm cả hai diagnostic. (c) `n` tính theo code unit UTF-16 (đơn vị của `nvarchar`), tối thiểu 1; vượt 4000 thì `nvarchar(max)` kèm `type-parameter-out-of-range`. Đã viết vào Task 12, 16 | Task 12, 13, 16, 17, 18 |
| 7 | **So tên không phân biệt dấu.** Spec mục 4 ghi MySQL so tên cột, index không phân biệt dấu. Tên ràng buộc do generator đặt (từ tên gốc có dấu) cũng là tên index trên MySQL: hai cột `ma`, `má` cùng `isUnique` cho `t_ma_key` và `t_má_key`, trùng trên MySQL. `NameAllocator` của spec chỉ có `isCaseInsensitive` | `NameAllocator` nhận `comparison` (`exact`, `caseInsensitive`, `caseAndAccentInsensitive`). Tên ràng buộc so không phân biệt dấu cho **mọi** dialect để tên vẫn giống nhau giữa ba dialect và Drizzle. Chưa rõ MySQL có coi `đ` và `d` là một không: Task 8 probe; nếu có, `toComparisonKey` đổi thêm `đ` → `d` | Task 6, 8, 9, 12 |
| 8 | **Giây lẻ quá 7 chữ số.** Literal `time`, `timestamp`, `timestamptz` của phần 2 cho phép số chữ số giây lẻ bất kỳ. PostgreSQL và MySQL làm tròn về 6 chữ số, còn SQL Server báo lỗi chuyển kiểu khi quá 7 chữ số, nên giá trị mặc định hợp lệ làm DDL SQL Server lỗi | Đề xuất phần 2 giới hạn giây lẻ tối đa 6 chữ số (bằng độ chính xác cột của CG-01), sửa `isValidDefaultLiteral` trong một task riêng của phần 2, chạy trước Task 16. Phương án khác: SQL Server cắt về 7 chữ số, không diagnostic. Task 8 probe xác nhận | Spec phần 2 mục 3; plan phần 2 Task 10; Task 7, 10, 16, 21 |
| 9 | **Điểm cần probe ngoài danh sách rủi ro của spec.** MySQL: literal `timestamptz` có `Z` và có độ lệch trên cột `TIMESTAMP(6)` (MySQL 8.0.19 trở lên nhận độ lệch, `Z` chưa rõ); `DEFAULT (UUID())` trên `CHAR(36)`; hai tên ràng buộc chỉ khác dấu (Vấn đề 7). SQL Server: `DECLARE` sau `CREATE TABLE` trong cùng batch; `sp_addextendedproperty` với `@level0name` là biến; literal `time` 7 chữ số giây lẻ | Task 8 viết probe cho từng điểm cùng các điểm ở mục "Rủi ro" của spec. Probe khác kỳ vọng thì dừng Task 15, 16 và user quyết định sửa spec | Task 8, 15, 16 |
| 10 | **Index trùng tên bảng trên PostgreSQL.** PostgreSQL dùng chung một không gian tên cho bảng và index. Phần 2 chỉ bảo đảm tên index không trùng tên index khác (`index-name-duplicate`), và spec phần 6 không cho đổi tên index của người dùng, nên index tên `users` trên bảng khác làm DDL lỗi dù schema hợp lệ | Đề xuất phần 2 mở rộng `index-name-duplicate` cho trùng tên bảng (hoặc thêm issue mới). Cho tới khi đó, fixture tránh trường hợp này | Spec phần 2 mục 8; Task 4, 14 |
| 11 | **Mã `SeedIssue` không có bản dịch.** Spec không yêu cầu i18n cho `seed-value-invalid`, `seed-value-null`, `seed-unique-violation`, `seed-foreign-key-missing`, `seed-order-invalid`; code panel của phần 6 không hiển thị chúng | Không export danh mục này ở entry point chính và không có namespace dịch trong phần 6. Phần 5 (AI-06) quyết định khi cần hiển thị | Task 21, 34 |
| 12 | **Bảng không có cột.** 25 mã issue của phần 2 không có mã nào cho bảng rỗng. PostgreSQL nhận `CREATE TABLE "t" ();`, nhưng MySQL và SQL Server từ chối bảng không có cột, và Prisma từ chối model không có trường, nên schema hợp lệ vẫn cho output lỗi. AI hoặc import có thể tạo bảng rỗng | Đề xuất phần 2 thêm issue `table-columns-empty` tại `["tables", id, "columnIds"]`: bảng rỗng thành schema còn issue, và generator vẫn sinh output an toàn theo spec mục 2. Fixture không có bảng rỗng | Spec phần 2 mục 8; plan phần 2; Task 4, 14, 15, 16, 17, 34 |

## Các task còn lại

Phần này do lượt lập plan thứ hai viết.
