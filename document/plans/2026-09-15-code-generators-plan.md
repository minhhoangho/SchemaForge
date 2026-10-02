# Plan: Code generators

Plan triển khai phần 6 trong [roadmap.md](../roadmap.md), dựa trên spec đã duyệt [2026-09-14-code-generators-design.md](../specs/2026-09-14-code-generators-design.md) (commit 4e14920; mọi quyết định cần xác nhận đã được user xác nhận). Spec là nguồn gốc: plan chỉ chia việc, chốt các chi tiết mức cài đặt mà spec để lại, và không đổi quyết định nào của spec. Chỗ spec còn hở hoặc mâu thuẫn được nêu ở mục [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan).

Plan được viết trong hai lượt. Lượt thứ nhất (2026-09-15) viết phần khung, bảng task đầy đủ, thân của các task nền và ba generator SQL DDL. Lượt thứ hai (2026-10-02) ghi lựa chọn của Task 0 cho Vấn đề 1–12 vào các task bị ảnh hưởng, chuyển conformance từ job CI sang chạy local bằng Docker (CI đã bị gỡ ngày 2026-10-02, xem dòng "CI" và "Conformance test của generator" trong [architecture.md](../architecture.md)), thêm Task 36 và viết thân các task còn lại ở mục [Các task còn lại](#các-task-còn-lại). Spec trên đĩa đã ghi các lựa chọn của Task 0 (mã thứ 17 `comment-truncated`, quy tắc 768 và 3072 byte của MySQL, `restrict` ngoài đồ thị cascade).

## Mục tiêu

`packages/core` có 12 generator thuần (PostgreSQL, MySQL, SQL Server, Prisma, Drizzle, TypeScript, Zod, Mock API, OpenAPI, seed, DBML, Markdown), mỗi đích một subpath `@schemaforge/core/generators/<đích>`, dùng chung các hàm định danh, literal, tên ràng buộc, biểu diễn JSON và đồ thị quan hệ trong `generators/shared/`. Output xác định, luôn an toàn với tên và comment bất kỳ, và báo diagnostic khi đích không biểu diễn được một khái niệm. Package `packages/codegen-conformance` chạy output qua công cụ đích thật, chạy local bằng Docker qua script root `pnpm test:conformance` (không có CI). Frontend có code panel sinh code trong Web Worker và highlight bằng Shiki.

## Điều kiện tiên quyết

- Phần 2 đã merge Task 26 và Task 27 của [plan phần 2](2026-09-14-core-schema-model-plan.md) (đã xong; các câu "phụ thuộc P2-26, P2-27" dưới đây coi như đã thỏa): `src/index.ts` export đủ public API, `@schemaforge/core/testing` export factory (`makeTable`, `makeColumn`, `makeRelation`, `makeIndex`, `makeEnum`, `makeSubjectArea`, `makeNote`, `buildSchema`, `createCounterIdGenerator`), `unwrapOk`, `unwrapError` và `createSampleSchema`. Mọi task của plan này phụ thuộc Task 26 của phần 2, trừ các mục chỉ lập kế hoạch. Task 27, 28 của phần 2 (bỏ `PRODUCT_NAME`, tài liệu) không chặn plan này, nhưng Task 5 dưới đây sửa `src/index.ts` nên phải merge sau Task 27 của phần 2 nếu Task 27 chưa xong (xem [Điểm nóng](#điểm-nóng-khi-làm-song-song)).
- Các hàm nội bộ của phần 2 mà generator dùng lại đã có: `sortTables`, `sortEnums`, `sortSubjectAreas`, `sortIndexes`, `sortRelations`, `sortNotes` (`src/model/ordering.ts`, Task 7 phần 2); `isValidDefaultLiteral` (`src/validation/rules/default-literals.ts`, Task 10); rule kiểu custom trong `src/validation/rules/columns.ts` (Task 12); `isUniqueColumnSet` (`src/validation/column-uniqueness.ts`, Task 8); `utf8ByteLength`, `toNameKey` (`src/model/name-limits.ts`); `sortByPathThenCode` (`src/document-path.ts`).
- Task 32–34 (frontend) phụ thuộc thêm **phần 3 (Editor MVP)**, đã merge: store của editor (`frontend/src/features/editor/state/create-editor-store.ts`), `getIssueIndex` (`features/editor/lib/issue-index.ts`, tên thật của `getIssues` trong spec), `createNotify` và `useNotify` (`lib/notify.ts`, `lib/use-notify.ts`), `resolveIssueTarget` (`features/editor/lib/resolve-issue-target.ts`), `buildContentSecurityPolicy` (`lib/security/content-security-policy.ts`), `lib/zod-config.ts`, i18n `lib/i18n/locales/{en,vi}/`, toolbar (`features/editor/components/toolbar/editor-toolbar.tsx`) và cột panel phải (`PropertiesPanel` trong `features/editor/components/editor-workspace.tsx`). Phần 4 và phần 10 cũng đã merge; task frontend đọc code hiện tại, không dựa vào mô tả cũ.
- Task 8, 29, 30, 31 và 35 cần Docker chạy được trên máy (`docker info` thoát mã 0). Máy dev có Docker Desktop (`architecture.md`, dòng "PostgreSQL local").
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
- Không có CI. Conformance chạy local bằng Docker và là cổng chặn của phần 6 (spec mục 7): Task 8 viết helper và chạy probe (kết quả probe là điều kiện của Task 15, 16); Task 29, 30, 31 viết test conformance của từng đích và phải pass hết trước khi phần 6 xong. Từ khi test conformance của một đích đã có, mọi task sửa generator của đích đó chạy test này trước khi báo xong. Subagent ghi kết quả vào execution log; orchestrator chạy lại lệnh conformance của task khi xác minh, trước khi commit. Commit được push tự động sau khi kiểm tra local qua (`.claude/rules/git.md`).
- Mỗi subagent ghi execution log `document/executions/logs/YYYY-MM-DD-code-generators-task-<N>.md` theo `.claude/rules/execution-logs.md`; orchestrator commit log cùng code của task.

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
- **Tạo và cập nhật:** chỉ ghi snapshot của đích mình, bằng `pnpm --filter @schemaforge/core exec vitest run src/generators/<đích> -u`. Sau khi ghi, đọc lại từng file snapshot và đối chiếu với spec; báo cáo của task liệt kê các file snapshot đã tạo. Không có CI, và Vitest chạy local tự ghi snapshot còn thiếu thay vì fail, nên snapshot phải được commit cùng task: sau khi chạy `pnpm --filter @schemaforge/core test`, `git status --porcelain` không được có file mới trong `__snapshots__` ngoài file của task.
- Thư mục `__snapshots__` được Task 1 loại khỏi typecheck, lint, Prettier, build và coverage. Không thêm ngoại lệ ở chỗ khác.

### Conformance của task generator

Test conformance của từng đích nằm trong `packages/codegen-conformance/src/<đích>.test.ts` (Task 29, 30, 31 viết), chỉ import helper của `src/support/` (Task 3, Task 8). Dạng chung: `describe.each(listConformanceFixtures())` theo fixture, mỗi biến thể option một `it`; dữ liệu lấy qua `@schemaforge/core/testing` và subpath `@schemaforge/core/generators/<đích>` (bản build), không import `src/` của core. Task 29, 30, 31 chạy lệnh dưới đây cho file của mình; từ khi file của một đích đã có, task nào sửa generator của đích đó (kể cả task sửa lỗi) cũng chạy lệnh này trước khi báo xong (spec mục 7, cổng chặn của phần 6). Lệnh, chạy ở root:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
docker info >/dev/null && echo docker-ok
pnpm --filter @schemaforge/core build
pnpm --filter @schemaforge/codegen-conformance exec vitest run src/<đích>.test.ts
pnpm --filter @schemaforge/codegen-conformance typecheck
pnpm --filter @schemaforge/codegen-conformance lint
pnpm exec prettier --check packages/codegen-conformance/src/<đích>.test.ts
```

Mong đợi: in `docker-ok`; mọi lệnh thoát mã 0; mọi test pass. Execution log của task ghi số test, thời gian chạy và phiên bản công cụ đích in ra trong test (nếu có). Conformance đỏ là lỗi của generator: sửa generator, không nới test. Lỗi do môi trường (Docker không chạy, kéo image thất bại) thì dừng với trạng thái `Bị chặn` và ghi lỗi nguyên văn.

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
| `src/testing/index.ts`, `src/testing/index.test.ts` | Chỉ Task 4 sửa (export ba fixture mới). Helper test của task khác nằm trong file riêng không export (ví dụ `src/testing/generator-snapshot.ts` của Task 2) |
| `src/validation/issue-codes.ts`, `issue-codes.test.ts`, `validation/rules/names.ts`, `validation/rules/tables.ts` (mới), `validate-schema.ts`, `frontend/src/lib/i18n/locales/{en,vi}/issues.ts` | Chỉ Task 36 sửa (hai issue mới của phần 2, Vấn đề 10, 12). Core và bản dịch đi chung một task vì `issues.ts` dùng `satisfies Record<IssueCode, string>`: tách ra thì frontend không biên dịch được giữa hai commit |
| `generators/shared/*` | Mỗi file thuộc đúng một task nền và được merge **trước** mọi task đích dùng nó: Task 2 (`generator-types.ts`, `diagnostic-codes.ts`, `diagnostics.ts`, `render-file.ts`), Task 6 (`identifiers.ts`, `name-allocator.ts`, `javascript-reserved-words.ts`), Task 7 (`sql-literals.ts`), Task 9 (`constraint-names.ts`), Task 10 (`json-representation.ts`, `rest-resources.ts`), Task 11 (`relation-graph.ts`, `relation-field-names.ts`), Task 12 (`dialect-types.ts`, `dialect-constraints.ts`, `dialect-column-types.ts`, `mysql-identifiers.ts`), Task 13 (`sql-ddl-model*.ts`), và một ngoại lệ là task đích: Task 17 tạo `sqlserver-enum-length.ts` (`sqlServerEnumLength`, dùng chung cho Prisma `sqlserver` và SQL Server SQL), merge trước Task 16, nên Task 16 phụ thuộc Task 17. Task đích chỉ import. Cần hành vi dùng chung mới thì dừng và báo; orchestrator tạo task sửa file nền, chạy khi không còn task đích nào đang dùng file đó |
| Import giữa các thư mục đích | Cấm, trừ `mock-api/` import `buildSeedDataset` từ `seed/` (spec CG-06). Phần dùng chung giữa hai đích phải nằm trong `shared/` |
| Hàm nội bộ của phần 2 cần export thêm | Task 7 tách hàm kiểm tra giá trị mặc định dùng chung khỏi `validation/rules/column-defaults.ts` và `default-literals.ts`; Task 12 tách hàm kiểm tra cú pháp kiểu custom khỏi `validation/rules/columns.ts`. Cả hai chỉ tách hàm, không đổi hành vi (test cũ phải pass nguyên vẹn); hai task sửa các file khác nhau nên chạy song song được. Ngoài hai task này, chỉ Task 36 sửa `src/validation/` (thêm rule, không đụng file của Task 7, 12) |
| `GENERATOR_DIAGNOSTIC_CODES` | Task 2 tạo đủ 17 mã theo spec mục 4 (gồm `comment-truncated`, lựa chọn của Task 0 cho Vấn đề 2) kèm hợp đồng `path` cho từng mã; test ghim danh sách. Task sau chỉ import. Thiếu mã là thay đổi spec: dừng và báo. Frontend (Task 34) dùng `satisfies Record<GeneratorDiagnosticCode, string>`, nên danh sách phải cố định trước Task 34. Mã `SeedIssue` của CG-08 là danh mục riêng do Task 21 tạo trong `generators/seed/` |
| `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Chỉ Task 3 (dependency của package conformance, mục `allowBuilds`) và Task 32 (`shiki` cho frontend) ghi lockfile. Hai task này không chạy đồng thời với nhau, và orchestrator không chạy chúng đồng thời với task ghi lockfile của plan khác (ví dụ phần 5, phần 7). Sau khi merge, worktree đang mở chạy lại `pnpm install --frozen-lockfile` |
| Package mới `packages/codegen-conformance` | Task 3 viết toàn bộ `package.json` của package (tên, script, dependency) để task sau không sửa manifest. Task 3 tạo thêm `tsconfig.json`, `vitest.config.ts`, `.gitignore` và `src/support/temp-directory.ts`; Task 8 tạo mọi helper dùng chung còn lại trong `src/support/` và probe trong `src/probes/`. Task 29 sở hữu `src/postgresql.test.ts`, `mysql.test.ts`, `sqlserver.test.ts`, `seed-sql.test.ts`; Task 30 `prisma.test.ts`, `drizzle.test.ts`, `typescript.test.ts`, `zod.test.ts`; Task 31 `mock-api.test.ts`, `openapi.test.ts`, `dbml.test.ts`. Ba task chỉ import helper. Cần helper mới thì đặt trong file test của mình hoặc dừng và báo |
| `turbo.json`, script root `test:conformance` | Chỉ Task 8 sửa `turbo.json` (thêm task `test:conformance`) và `package.json` root (thêm script). Không có `.github/workflows/ci.yml` và không task nào tạo lại nó |
| Probe hành vi database trước generator MySQL, SQL Server | Task 8 chạy probe local bằng Docker và ghi kết quả từng điểm (Vấn đề 1, 2, 7, 8, 9 và mục "Rủi ro" của spec) vào execution log của Task 8. Task 15, 16 chỉ bắt đầu khi log đó có kết quả và mọi probe khớp kỳ vọng. Probe ghi kết quả MySQL 17 (`-00:00`), 18 (`ß`, `ð`) không chặn; kết quả khác kỳ vọng thì task tiếp theo do Task 8 nêu (sửa `sql-literals.ts` hoặc danh sách gộp R12 trong `name-allocator.ts`) chạy và merge trước Task 15. Probe khác ma trận của spec mục 4 thì dừng, orchestrator cho sửa spec trước, rồi mới chạy Task 15, 16 |
| Snapshot | Mỗi task đích chỉ ghi `__snapshots__/<đích>/`. Fixture của Task 4 đổi sau khi đã có snapshot thì orchestrator tạo một task riêng sửa fixture và ghi lại mọi snapshot bị ảnh hưởng, không chạy song song với task đích |
| File i18n và CSP của frontend | Task 34 sở hữu `frontend/src/lib/i18n/locales/{en,vi}/code-generator.ts`, `generator-diagnostics.ts`, test mới `frontend/src/lib/i18n/code-generator-messages.test.ts`, phần đăng ký namespace trong `resources.ts` (và `resources.test.ts` nếu test ghim danh sách namespace), và `buildContentSecurityPolicy`. `i18next.d.ts` lấy kiểu từ `enResources` nên không cần sửa. Task 33 (worker) không có chuỗi hiển thị. Task 36 chỉ sửa `issues.ts` và chạy trước Task 34 |
| File của editor (phần 3) mà code panel chạm vào | Chỉ Task 34 sửa `create-editor-store.ts` (chế độ cột phải, đích và option), `editor-toolbar.tsx`, `editor-workspace.tsx`, `issue-list-tab.tsx` (tách `useGoToIssue` ra hook dùng chung) và test của chúng. Orchestrator đối chiếu với task đang chạy của plan khác trước khi giao |

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
| `postgres` | `18-alpine` | cập nhật 2026-08-15 | Không phải npm; hằng trong `src/support/containers.ts` của Task 8 | Không có PostGIS (xem Vấn đề 3) |
| `mysql` | `8.4` | cập nhật 2026-09-12 | `src/support/containers.ts` (Task 8) | |
| `mcr.microsoft.com/mssql/server` | `2022-latest` | có trên MCR; CU mới nhất `2022-CU26-ubuntu-22.04` | `src/support/containers.ts` (Task 8) | Tag trôi theo CU; lỗi mới xuất hiện sau khi image cập nhật thì orchestrator tạo task ghim tag CU trong `containers.ts` |

Không dùng: `@faker-js/faker`, `json-server` (spec CG-06, CG-08).

**Kiểm tra lại ngày 2026-10-02** (`npm view <package> dist-tags`, `npm view <package>@<bản> time`). Khai báo trong bảng trên giữ nguyên; dải `^` tự nhận bản vá mới khi Task 3, 32 cài, và `minimumReleaseAge` vẫn loại bản chưa quá 24 giờ:

| Package | Thay đổi so với 2026-09-15 | Xử lý |
|---|---|---|
| `msw` | `latest` là 3.0.1 (2026-09-30); 3.0.0 phát hành 2026-09-28, peer `typescript >=5.9.x` | Giữ `^2.15.0`: spec CG-06 chốt handler MSW 2. Output ghi rõ MSW 2 trong comment đầu file (Task 23). Chuyển sang MSW 3 là thay đổi spec riêng (Vấn đề 15) |
| `drizzle-orm` | `latest` là 0.45.3 (2026-09-21) | `^0.45.2` cài 0.45.3, cùng nhánh 0.45 của spec |
| `testcontainers`, `@testcontainers/*` | 12.2.0 (2026-09-28) | `^12.1.0` cài 12.2.0 |
| `@dbml/core` | 10.2.0 (2026-09-23) | `^10.1.1` cài 10.2.0 |
| `mysql2` | 3.24.5 (2026-09-29) | `^3.24.4` cài 3.24.5 |
| `shiki` | 4.5.0 (2026-10-01 06:46 UTC) | `^4.4.3`; Task 32 cài bản mới nhất đã quá 24 giờ |
| `prisma` | `latest` là `8.0.0-rc.19` (pre-release); nhánh 7 vẫn dừng ở 7.10.0 | Giữ `^7.10.0` |
| `pg`, `@types/pg`, `mssql`, `@types/mssql`, `openapi-types`, `@readme/openapi-parser`, `zod` | Không đổi bản cần dùng | Giữ nguyên |

## Bảng task

`P2-26`, `P2-27` là Task 26, Task 27 của plan phần 2; `P3` là phần 3 (Editor MVP) đã merge. Số thứ tự task là định danh, không phải thứ tự chạy; bảng sắp theo đợt.

| Task | Nội dung | Phụ thuộc | Đợt |
|---|---|---|---|
| 0 | Chốt Vấn đề 1–12 với user, ghi lựa chọn vào spec (không có thân riêng). Đã chốt ngày 2026-10-02, xem cột "Quyết định" ở mục "Vấn đề phát hiện khi lập plan" | — | 0 |
| 1 | Hạ tầng snapshot: loại `__snapshots__` và `*.bench.ts` khỏi typecheck, lint, Prettier, build, coverage | P2-26 | 1 |
| 2 | Kiểu chung của generator, `GENERATOR_TARGETS`, `GENERATOR_DIAGNOSTIC_CODES` (17 mã) kèm hợp đồng `path`, `finalizeDiagnostics`, `renderFileContent`, `formatDiagnosticsSnapshot` | P2-26 | 1 |
| 3 | Manifest và dependency của `packages/codegen-conformance`, mục `allowBuilds`, lockfile | P2-26 | 1 |
| 36 | Phần 2: issue `table-columns-empty` và `index-name-conflicts-table` trong core, kèm bản dịch `vi`, `en` của frontend (Vấn đề 10, 12) | P2-26 | 1 |
| 4 | Fixture `createNamingEdgeSchema`, `createTargetLimitSchema`, `createLargeSchema` | P2-26, 36 | 2 |
| 5 | Subpath `./generators/*` và export chung ở entry point chính | 2, P2-27 | 2 |
| 6 | Định danh: quote SQL, định danh code, `NameAllocator` (`identifiers.ts`, `name-allocator.ts`, `javascript-reserved-words.ts`) | 2 | 2 |
| 7 | Literal SQL và giá trị mặc định theo dialect (`sql-literals.ts`) | 2 | 2 |
| 8 | Khung package conformance, task Turborepo và script root `test:conformance`, probe hành vi MySQL và SQL Server chạy local | 3, 4 | 3 |
| 9 | Tên ràng buộc do generator đặt (`constraint-names.ts`) | 6 | 3 |
| 10 | Biểu diễn JSON và tài nguyên REST (`json-representation.ts`, `rest-resources.ts`) | 2, 6 | 3 |
| 11 | Đồ thị quan hệ và tên trường quan hệ (`relation-graph.ts`, `relation-field-names.ts`) | 2, 6 | 3 |
| 12 | Quy tắc kiểu và khóa theo dialect cho SQL, Prisma, Drizzle (`dialect-types.ts`, `dialect-constraints.ts`, `mysql-identifiers.ts`) | 2, 6 | 3 |
| 13 | Mô hình DDL dùng chung cho ba dialect (`sql-ddl-model.ts`) | 4, 7, 9, 11, 12 | 4 |
| 19 | CG-04 TypeScript types | 1, 4, 5, 10, 11 | 4 |
| 20 | CG-05 Zod schema | 1, 4, 5, 10 | 4 |
| 21 | CG-08 `SeedDataset`: PRNG, `buildSeedDataset`, `validateSeedDataset`, `parseSeedDataset`, mã `SeedIssue` | 2, 4, 9, 10, 11 | 4 |
| 24 | CG-07 OpenAPI 3.1 | 1, 4, 5, 10 | 4 |
| 14 | CG-01 SQL DDL PostgreSQL | 1, 4, 5, 13, 36 | 5 |
| 15 | CG-01 SQL DDL MySQL | 1, 4, 5, 8 (kết quả probe local trong log), 13, 36 | 5 |
| 17 | CG-02 Prisma schema; tạo `generators/shared/sqlserver-enum-length.ts` | 1, 4, 5, 7, 9, 11, 12, 13, 36 | 5 |
| 18 | CG-03 Drizzle schema (PostgreSQL, MySQL) | 1, 4, 5, 7, 8, 9, 11, 12, 13 | 5 |
| 16 | CG-01 SQL DDL SQL Server | 1, 4, 5, 8 (kết quả probe local trong log), 13, 17 (`sqlserver-enum-length.ts`), 36 | 6 |
| 22 | CG-08 `serializeSeedDataset`, `generateSeed`, export type `SeedDataset` | 1, 4, 5, 7, 11, 12, 21 | 6 |
| 23 | CG-06 Mock API (handler MSW 2) | 1, 4, 5, 10, 21 | 6 |
| 25 | CG-09 DBML | 1, 4, 5, 7 | 6 |
| 26 | CG-10 Markdown | 1, 4, 5, 7 | 6 |
| 27 | Property test cho mọi generator: không throw, xác định, xáo thứ tự khóa, an toàn với ký tự quote | 14–26 | 7 |
| 29 | Conformance: DDL và seed SQL trên PostgreSQL 18, MySQL 8.4, SQL Server 2022 | 8, 14, 15, 16, 22 | 7 |
| 30 | Conformance: `prisma validate`; typecheck Drizzle, TypeScript, Zod; parse seed JSON bằng schema Zod | 8, 17, 18, 19, 20, 22 | 7 |
| 31 | Conformance: Mock API trên `msw/node`, validator OpenAPI, parse DBML | 8, 23, 24, 25 | 7 |
| 32 | Dependency `shiki` cho frontend, lockfile | P3, 3 | 7 |
| 28 | Benchmark `vitest bench` với `createLargeSchema`, script `bench`; dùng `listGeneratorCases()` của Task 27 | 14–26, 27 | 8 |
| 33 | Worker sinh code và tách token Shiki, hook `use-generated-code`; worker import `zod-config.ts` của phần 3 đầu tiên | 5, 14–26, 32, P3 | 9 |
| 34 | Code panel, nút "Code" trên toolbar, i18n `codeGenerator` và `generatorDiagnostics`, CSP `worker-src 'self'` | 33, 36 | 10 |
| 35 | Tài liệu (`roadmap.md`, `architecture.md`, `CLAUDE.md`, spec phần 2), kết quả benchmark, chạy lại toàn bộ `pnpm test:conformance`, kiểm tra toàn repo | 27–31, 34 | 11 |

- Đường tới hạn: Task 2 → 6 → 12 → 13 → 17 → 16 → 33 (cần mọi generator) → 34 → 35. Task 32 bắt đầu được ngay khi Task 3 đã merge (hai task cùng ghi lockfile), không cần chờ tới đợt 7.
- Task 17, 18 phụ thuộc Task 13 (dùng chung kiểu đích và ràng buộc bị bỏ với `buildSqlDdlModel`, và test so khớp với nó), nên đợt 4 gồm Task 13 cùng các generator không cần mô hình DDL (19, 20, 21, 24), đợt 5 gồm bốn generator dùng Task 13 (14, 15, 17, 18). Task 16 sang đợt 6 vì import `sqlServerEnumLength` từ file `generators/shared/sqlserver-enum-length.ts` do Task 17 tạo. Task 28 sang đợt 8 vì dùng `listGeneratorCases()` của Task 27.
- Task 15, 16 chỉ bắt đầu khi execution log của Task 8 có kết quả probe local và mọi probe khớp kỳ vọng (mục "Điểm nóng").
- Task 33: import đầu tiên của `code-generator.worker.ts` là `zod-config.ts` của phần 3 (đặt `z.config({ jitless: true })`), đứng trước mọi module import `@schemaforge/core`, vì Zod đọc `jitless` khi tạo schema chứ không phải khi parse, còn core tạo schema lúc được import (spec mục 8, "CSP"; `packages/core/src/zod-jitless.test.ts`). Thân Task 33 có bước kiểm tra rằng dòng import đầu tiên của file worker là `zod-config`.
- Task 0 đã xong (2026-10-02): mọi task có thể giao theo phụ thuộc trong bảng.
- Đợt 1 có Task 1, 2, 3, 36; Task 4 sang đợt 2 vì fixture phải sạch cả với hai issue mới của Task 36 (Vấn đề 10, 12); Task 8 sang đợt 3 vì cần Task 4.
- Thân task: Task 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16 ở ngay dưới. Task 3, 8, 17–36 ở mục [Các task còn lại](#các-task-còn-lại).

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

`diagnostic-codes.ts`: `GENERATOR_DIAGNOSTIC_CODES` là mảng `as const` gồm 17 mã theo đúng thứ tự bảng ở spec mục 4 (`comment-truncated` đứng sau `null-character-removed`, trước `seed-table-skipped`), và `GeneratorDiagnosticCode`. Hợp đồng `path` dưới đây áp cho mọi đích (spec chỉ ví dụ; plan chốt để frontend dùng `resolveIssueTarget` nhất quán):

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
| `comment-truncated` | `["tables", tableId, "comment"]` hoặc `["columns", columnId, "comment"]` |

`diagnostics.ts`:

- `createDiagnostic(code: GeneratorDiagnosticCode, path: DocumentPath): GeneratorDiagnostic`.
- `finalizeDiagnostics(diagnostics: readonly GeneratorDiagnostic[]): readonly GeneratorDiagnostic[]`: bỏ cặp `code` và `path` lặp (so `path` bằng `JSON.stringify`), rồi sắp bằng `sortByPathThenCode` của `src/document-path.ts`.

`render-file.ts`:

- `renderFileContent(blocks: readonly (readonly string[])[]): string`: bỏ block rỗng; nối dòng trong một block bằng `\n`; nối các block bằng một dòng trống; bỏ mọi `\n` ở cuối văn bản đã nối rồi thêm đúng một `\n`. Không có block nào thì trả `"\n"`.

`src/testing/generator-snapshot.ts` (không export qua `@schemaforge/core/testing`):

- `formatDiagnosticsSnapshot(diagnostics: readonly GeneratorDiagnostic[]): string`: mỗi diagnostic một dòng `<code> <JSON.stringify(path)>` theo thứ tự nhận vào, kết thúc bằng `\n`; danh sách rỗng thì trả `"(none)\n"`.

**Test viết trước:**

- `generator-types.test.ts`: `lists the twelve generator targets in spec order`; `lists the three sql dialects`; `requires a provider option for prisma` (dùng `expectTypeOf<GeneratorOptions["prisma"]>().toEqualTypeOf<{ readonly provider: SqlDialect }>()`, được kiểm tra bởi `typecheck`).
- `diagnostic-codes.test.ts`: `lists the seventeen diagnostic codes from the spec without duplicates` (`toStrictEqual` với danh sách đầy đủ và `new Set(...).size` là 17).
- `diagnostics.test.ts`: `sorts diagnostics by path, then by code`; `removes a repeated code and path pair`; `keeps the same code at two different paths`; `orders a numeric path segment before a string segment`; `returns an empty list for no diagnostics`.
- `render-file.test.ts`: `joins the lines of one block and ends with one newline`; `separates blocks with one blank line`; `skips empty blocks`; `returns a single newline when there are no blocks`; `collapses trailing newlines at the end into one`.
- `generator-snapshot.test.ts`: `formats one diagnostic per line as code and json path`; `writes (none) when there are no diagnostics`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add generator contract and diagnostic codes`

## Task 4: Fixture cho generator

**Mục tiêu:** ba schema hợp lệ dùng cho snapshot, conformance, property test và benchmark (spec mục 9, 10).

**Phụ thuộc:** P2-26, Task 36. **Đợt:** 2.

**File sở hữu:** tạo `packages/core/src/testing/naming-edge-schema.ts`, `target-limit-schema.ts`, `large-schema.ts`, mỗi file kèm `<name>.test.ts`; sửa `packages/core/src/testing/index.ts`, `packages/core/src/testing/index.test.ts`.

**Cài đặt chung:**

- Đọc `src/testing/factories.ts` và `sample-schema.ts` trước. Dựng bằng `buildSchema` và `make*` với `createCounterIdGenerator()` (theo Vấn đề 4 của plan phần 2, không qua operation). Lỗi dựng thì throw `Error`. Không import `vitest`, `fast-check`.
- Mỗi lần gọi trả schema bằng nhau theo cấu trúc. `validateSchema` của mọi fixture trả mảng rỗng, kể cả với hai issue của Task 36: mọi bảng có ít nhất một cột, và không index nào trùng tên một bảng.
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
- Cột auto-increment trên MySQL (R14): khóa chính `(id, code_a, code_b)` với `id` `bigint` auto-increment, `code_a`, `code_b` `varchar(700)` (vượt 3072 byte, MySQL bỏ khóa chính và thêm index `<bảng>_id_idx`); và một bảng khóa chính `(a, id)` với `a` `integer`, `id` `bigint` auto-increment đứng sau.
- Kích thước dòng MySQL (R13): bảng có cột `id` `integer` khóa chính và cột `v` `varchar(16383)` không thuộc khóa.
- Tham số vượt giới hạn: `varchar(10485761)`, `char(256)`, `varchar(16384)`, `char(4001)`, `varchar(4001)`, `decimal(1001, 2)`, `decimal(40, 31)`.
- Cột nullable `isUnique` được khóa ngoại tham chiếu; index unique có cột nullable không được tham chiếu.
- Bảng không có khóa chính và không có unique; bảng không có khóa chính nhưng có cột bắt buộc `isUnique`.
- Kiểu custom: cột nullable không mặc định, cột bắt buộc có mặc định literal, và một bảng riêng có cột custom bắt buộc không mặc định.
- `setDefault` trên quan hệ có cột khóa ngoại mang giá trị mặc định.
- Cột enum nullable; cột `boolean` `isUnique`.
- Độ dài khóa MySQL (Vấn đề 1): một cột `varchar(1000)` `isUnique` (hẹp về `VARCHAR(768)`); một index unique gồm bốn cột `varchar(192)` (đúng 3072 byte, giữ nguyên); một index unique gồm năm cột `varchar(700)` (14 000 byte, bị bỏ trên MySQL) được một quan hệ hai đầu cùng kiểu tham chiếu (khóa ngoại cũng bị bỏ trên MySQL).
- Độ dài khóa SQL Server (R1, R10): bảng có khóa chính `char(500)` (1000 byte cố định, quá 900) cùng một bảng khác có cột khóa ngoại `char(500)` tham chiếu tới nó; bảng có cột `char(900)` `isUnique` (1800 byte, quá 1700). Trên SQL Server cả ba cột thành `nvarchar(n)`.
- Cột `char(300)` `isUnique` (MySQL thành `VARCHAR(300)`, chỉ `type-parameter-out-of-range`, R11).
- Độ dài comment (Vấn đề 2): comment cột 1025 ký tự; comment bảng 2049 ký tự; comment cột 3751 code unit UTF-16 có cặp surrogate (ví dụ `😀`) vắt qua vị trí 3750.
- Giây lẻ (Vấn đề 8): cột `time` mặc định `12:34:56.123456789`; cột `timestamp` mặc định `2026-01-02T03:04:05.12345678`.
- Bảng `all_types` có đủ 19 kiểu chung (trừ custom đã có ở trên) và literal mặc định cho mọi kiểu nhận literal: `date`, `time` có giây lẻ, `timestamp`, `timestamptz` có độ lệch, `boolean`, `real` dạng mũ, `bigint` lớn nhất, `decimal`, `json` chứa `'`, `char`, `uuid`; `currentTimestamp` trên `timestamp` và `timestamptz`; auto-increment trên `smallint`, `integer` (mỗi cột ở một bảng riêng, là khóa chính).

**`createLargeSchema(options: LargeSchemaOptions): SchemaDocument`**, `LargeSchemaOptions = { readonly tableCount: number }`:

- `tableCount` là số nguyên từ 2 trở lên, nếu không thì throw `RangeError`.
- `enum_00`… với `max(1, floor(tableCount / 10))` enum, mỗi enum 5 giá trị. Bảng `table_000`… với đúng 20 cột mỗi bảng (xoay vòng qua các kiểu, gồm cột enum và cột khóa ngoại). Bảng có chỉ số chia hết cho 10 có khóa chính hai cột; bảng khác có `id` `bigint` auto-increment.
- `floor(tableCount * 1.5)` quan hệ: mỗi bảng `i` tham chiếu bảng `(i + 1) % tableCount` với `onDelete: "cascade"` (tạo vòng), cột khóa ngoại của vòng này nullable (vòng cascade vẫn còn cho SQL Server, còn seed coi quan hệ trong vòng là quan hệ hoãn thay vì bỏ cả 200 bảng), và mỗi bảng có chỉ số chẵn tham chiếu thêm bảng `(i + 7) % tableCount` với `noAction`. Quan hệ tới bảng có khóa chính hai cột là khóa ngoại hai cột.
- `tableCount` index, mỗi bảng một index hai cột, index thứ tư là unique.
- Với `tableCount: 200`: 200 bảng, 4000 cột, 300 quan hệ, 200 index, 20 enum (spec mục 9).

**Test viết trước:**

- `naming-edge-schema.test.ts`: `has no semantic issues`; `returns structurally equal schemas on every call`; `passes parseSchemaDocument after JSON stringify and parse`; `contains names with every quote character of the three sql dialects`; `contains a table name of exactly 63 bytes`; `contains two table names that map to the same code identifier`; `contains column names that differ only by an accent`; `contains a comment with a null character`; `contains two relations between the same pair of tables`.
- `target-limit-schema.test.ts`: `has no semantic issues`; `returns structurally equal schemas on every call`; `contains a cascade cycle and a second cascade path`; `contains a cycle of required foreign keys`; `contains text, json and binary columns in keys`; `contains type parameters beyond every dialect limit`; `contains a nullable unique column referenced by a foreign key`; `contains tables without a primary key`; `contains custom types with and without defaults`; `contains a set default relation`; `contains a default literal for every type that accepts one`; `contains key columns beyond the MySQL key length limits`; `contains fixed-length keys beyond the SQL Server limits and a foreign key paired with one`; `contains auto-increment columns that lead no MySQL index`; `contains a table row beyond the MySQL row size limit`; `contains comments beyond the MySQL and SQL Server limits`; `contains time defaults with more than seven fractional digits`.
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

**Test viết trước:** trong `index.test.ts`, sửa `exports exactly the documented runtime values` để danh sách mong đợi có thêm hai tên; thêm `exposes twelve generator targets and seventeen generator diagnostic codes`.

**Kiểm tra:** như mục "Quy ước chung", thêm:

```bash
pnpm --filter @schemaforge/core build
pnpm --filter @schemaforge/backend exec node --input-type=module -e 'const core = await import("@schemaforge/core"); console.log(core.GENERATOR_TARGETS.length, core.GENERATOR_DIAGNOSTIC_CODES.length); await import("@schemaforge/core/generators/shared").then(() => console.log("reachable"), (error) => console.log(error.code));'
```

Mong đợi: build thoát mã 0; lệnh `node` in `12 17` rồi `ERR_MODULE_NOT_FOUND` (thư mục `shared` không có `index.js` nên không import được qua pattern). Import thành công một subpath thật được kiểm tra ở Task 14.

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
- `toComparisonKey`: `exact` → giữ nguyên; `caseInsensitive` → `toNameKey(name)`; `caseAndAccentInsensitive` → `toNameKey` của chuỗi sau `normalize("NFD")` và bỏ ký tự U+0300–U+036F, rồi đổi `đ` → `d`, `ø` → `o`, `ł` → `l`, `ħ` → `h` (chữ hoa đã thành chữ thường sau `toNameKey`; cách so định danh của MySQL theo `utf8mb3_general_ci`, R12). Chỉ dùng để so định danh, không áp cho giá trị enum hay dữ liệu.
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
- `name-allocator.test.ts`: `returns the preferred name when it is free`; `appends 2, then 3 to repeated names`; `treats names differing only in case as taken when case-insensitive`; `allows names differing only in case when comparison is exact`; `treats names differing only by an accent as taken when case and accent insensitive`; `folds đ, ø, ł and ħ when case and accent insensitive` (`it.each`: `đa`/`da`, `Øl`/`ol`, `łza`/`lza`, `ħal`/`hal`); `builds comparison keys for each comparison` (`it.each`); `never returns a reserved name`; `uses the separator before the number`; `truncates the base so the suffixed name fits the byte limit`; `does not split a surrogate pair when truncating`; `keeps separate state for separate allocators`.
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
- `formatSqlLiteral(dialect: SqlDialect, type: ColumnType, value: string): string`: `value` đã hợp lệ với kiểu (người gọi bảo đảm). `smallint`, `integer`, `bigint`, `decimal`, `real`, `double` ghi không quote; `boolean`: PostgreSQL `true`/`false`, MySQL `TRUE`/`FALSE`, SQL Server `1`/`0`; mọi kiểu còn lại trừ `binary` ghi bằng `sqlStringLiteral`. Riêng SQL Server với `time`, `timestamp`, `timestamptz`: phần giây lẻ (chuỗi chữ số ngay sau dấu `.` của giây) dài hơn 7 chữ số thì cắt còn 7, không làm tròn, giữ nguyên `Z` hoặc độ lệch phía sau (spec mục 3 "Giây lẻ trên SQL Server", Vấn đề 8); không có diagnostic. Hàm này là đường duy nhất ghi literal SQL Server, nên giá trị mặc định của CG-01, `dbgenerated` của Prisma `sqlserver` và seed SQL cùng hành vi. MySQL tương tự nhưng cắt về 6 chữ số (R15, bằng độ chính xác cột `TIME(6)`, `DATETIME(6)`, `TIMESTAMP(6)`), không diagnostic. PostgreSQL giữ nguyên literal. Gọi với `binary` là lỗi lập trình: throw `Error` (seed xử lý `binary` riêng ở Task 22).
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
  - `truncates fractional seconds beyond seven digits for SQL Server` (`it.each`: `time` `12:34:56.123456789` → `N'12:34:56.1234567'`; `timestamptz` `2026-01-02T03:04:05.123456789+07:00` → `N'2026-01-02T03:04:05.1234567+07:00'`; `timestamp` 7 chữ số giữ nguyên); `truncates fractional seconds beyond six digits for MySQL` (`it.each` ba kiểu); `keeps fractional seconds for PostgreSQL`.
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
  tableName: string, columnNames: readonly string[], suffix: "pkey" | "key" | "fkey" | "check" | "idx",
): string;
export function fnv1a32Hex(text: string): string;
export type SchemaConstraintNames = {
  readonly primaryKeys: ReadonlyMap<TableId, string>;    // bảng có khóa chính
  readonly uniqueColumns: ReadonlyMap<ColumnId, string>; // cột isUnique
  readonly enumChecks: ReadonlyMap<ColumnId, string>;    // cột enum (CHECK của SQL Server)
  readonly foreignKeys: ReadonlyMap<RelationId, string>;
  readonly autoIncrementIndexes: ReadonlyMap<ColumnId, string>; // mọi cột auto-increment: <bảng>_<cột>_idx
};
export function allocateConstraintNames(
  schema: SchemaDocument,
  orderColumnPairs: (relation: Relation) => readonly ColumnPair[],
): SchemaConstraintNames;
```

- `buildConstraintName`: `pkey` → `<bảng>_pkey` (bỏ qua `columnNames`); còn lại → nối `tableName`, các `columnNames`, `suffix` bằng `_`. Dùng tên gốc. Tên dài hơn 63 byte UTF-8 → `truncateToUtf8Bytes(tên, 54) + "_" + fnv1a32Hex(tên)`.
- `fnv1a32Hex`: FNV-1a 32 bit (offset basis `0x811c9dc5`, prime `0x01000193`, nhân bằng `Math.imul`, `>>> 0`) trên các byte UTF-8 của `text`, tự mã hóa theo code point (không `TextEncoder`; surrogate lẻ mã hóa như U+FFFD, khớp `utf8ByteLength`), trả 8 chữ số hex thường, đệm `0` bên trái.
- `allocateConstraintNames`: một `createNameAllocator({ reserved, comparison: "caseAndAccentInsensitive", separator: "_", maxBytes: 63 })` (không phân biệt dấu cho mọi dialect vì MySQL so tên index như vậy, Vấn đề 7) với `reserved` là tên mọi bảng (`sortTables`) và mọi index của người dùng (`sortIndexes`). Cấp theo thứ tự: với từng bảng theo `sortTables`: khóa chính (nếu `primaryKeyColumnIds` không rỗng), rồi theo `columnIds`: tên unique cho cột `isUnique`, tên check cho cột kiểu `enum`, tên `idx` cho cột `isAutoIncrement` (cấp cho mọi dialect để tên giống nhau; chỉ MySQL dùng, cho index thay thế của R14); sau đó với từng quan hệ theo `sortRelations`: tên khóa ngoại với cột nguồn theo thứ tự `orderColumnPairs(relation)`. Tên không phụ thuộc dialect, nên ba dialect và Drizzle cho cùng tên. Tên index của người dùng không bao giờ đi qua allocator.
- `orderColumnPairs` được tiêm vào để task này không phụ thuộc Task 11; người gọi truyền `orderColumnPairsByReferencedKey` của Task 11.

**Test viết trước:**

- `builds names by the PostgreSQL convention` (`it.each`: `users_pkey`, `users_email_key`, `orders_tenant_id_number_key`, `posts_author_id_fkey`, `orders_status_check`, `users_id_idx`).
- `keeps a name of exactly 63 bytes`; `shortens a 64-byte name to 54 bytes, an underscore and an eight-digit hash`; `cuts at a code point boundary inside accented text`.
- `matches the FNV-1a test vectors` (`it.each`: `""` → `811c9dc5`, `"a"` → `e40c292c`, `"foobar"` → `bf9cf968`); `hashes the utf-8 bytes of accented text` (giá trị mong đợi tính một lần bằng `node -e` dùng `Buffer` ngoài core, ghi cứng vào test).
- `allocates primary key, unique, check, auto-increment index and foreign key names for a schema`; `adds _2 when a generated name equals a table name`; `adds _2 when a generated name equals a user index name that differs only in case`; `adds _2 when two generated names differ only by an accent`; `never renames a user index`; `orders foreign key column names with the injected pair order`; `returns the same names regardless of map key order`.

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

**File sở hữu:** tạo, mỗi file kèm `<name>.test.ts`: `packages/core/src/generators/shared/dialect-types.ts`, `dialect-constraints.ts`, `dialect-column-types.ts`, `mysql-identifiers.ts`, `packages/core/src/validation/rules/custom-type-name.ts`; sửa `packages/core/src/validation/rules/columns.ts` (chỉ import hàm mới thay cho kiểm tra tại chỗ; `columns.test.ts` không sửa và phải pass nguyên vẹn). Spec mục 1 không liệt kê các file này; plan tách để ba đích dùng chung mà không import chéo. Khi cài đặt, `resolveSchemaColumnTypes`, `SchemaColumnTypes`, bước lan hẹp `nchar` của SQL Server, bước kích thước dòng MySQL, `mysqlRowBytes` và `MYSQL_MAX_ROW_BYTES` được tách sang `dialect-column-types.ts` (orchestrator duyệt); chữ ký và hành vi mô tả dưới đây không đổi, chỉ đổi file. Task 13, 17, 18 import các tên này từ `dialect-column-types.ts`.

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
- Chỉ MySQL, xét **trước** các bước trên (Vấn đề 1, spec mục 4 "Độ dài khóa trên MySQL"): cột `char(n)` hoặc `varchar(n)` với `n > 768` và `isKeyColumn` → `{ kind: "varchar", length: 768 }` kèm `key-column-type-narrowed`, cộng `type-parameter-out-of-range` khi `n` vượt giới hạn của MySQL (`char` > 255, `varchar` > 16 383). Không đi vòng qua `LONGTEXT` (R2, R11): `varchar(20000)`, `char(1000)` trong khóa → `VARCHAR(768)`, hai diagnostic; `varchar(1000)` trong khóa → `VARCHAR(768)`, chỉ `key-column-type-narrowed`; `char(300)` trong khóa có `n ≤ 768` nên đi bước giới hạn thường → `VARCHAR(300)`, chỉ `type-parameter-out-of-range`.
- MySQL và SQL Server: nếu kiểu sau bước trên là `text` và `isKeyColumn` → `keyText` kèm `key-column-type-narrowed` (SQL Server áp cả cho `varchar` quá dài đã thành `text`, Vấn đề 6). PostgreSQL giữ `text`.
- Chỉ SQL Server: input thêm `isFixedLengthNarrowed: boolean` (mặc định do người gọi truyền, `false` với dialect khác): `char(n)` → `{ kind: "varchar", length: n }` kèm `key-column-type-narrowed` (Msg 1944, xem `resolveSchemaColumnTypes` bên dưới).
- `mysqlKeyPartBytes(type: DialectColumnType): number` (export): `char`, `varchar`, `keyText` → `4 × length`; `uuid` → 144 (`CHAR(36)`); `custom` → 0; mọi kiểu khác → 32. Hằng `MYSQL_MAX_KEY_BYTES = 3072`, `MYSQL_MAX_KEY_CHARACTERS = 768`.
- `sqlServerFixedKeyBytes(type: DialectColumnType): number` (export, spec mục 4 "Độ dài khóa trên SQL Server"): `char(n)` (`nchar`) → `2 × n`; `uuid` → 16; kiểu độ dài thay đổi (`varchar`, `keyText`, `text`, `json`, `binary`, `enum` là `nvarchar`) và `custom` → 0; mọi kiểu cố định khác → 17 (cận trên). Hằng `SQLSERVER_MAX_PRIMARY_KEY_BYTES = 900`, `SQLSERVER_MAX_INDEX_KEY_BYTES = 1700`.
- `mysqlRowBytes(types: readonly DialectColumnType[], nullableCount: number): number` (export, spec mục 4 "Kích thước dòng trên MySQL"): `char(n)` → `4 × n`; `varchar(n)`, `keyText` → `4 × n + 2`; `text`, `json`, `binary` → 12; `custom` → 0; kiểu khác → 32; cộng `⌈nullableCount / 8⌉`. Hằng `MYSQL_MAX_ROW_BYTES = 65535`.
- `custom` → `isSafe: isSafeCustomTypeName(name)`; diagnostic `custom-type-unsafe` do Task 13 thêm, vì chỉ SQL cần. Mọi kiểu khác giữ nguyên.
- `path` của diagnostic là `["columns", column.id, "type"]`.

`dialect-constraints.ts`:

```ts
export function collectKeyColumnIds(schema: SchemaDocument): ReadonlySet<ColumnId>;
export type SchemaColumnTypes = {
  readonly types: ReadonlyMap<ColumnId, DialectColumnType>; // mọi cột của schema
  readonly diagnostics: readonly GeneratorDiagnostic[];
};
export function resolveSchemaColumnTypes(schema: SchemaDocument, dialect: SqlDialect): SchemaColumnTypes;
export type DroppedConstraints = {
  readonly primaryKeyTableIds: ReadonlySet<TableId>; readonly uniqueColumnIds: ReadonlySet<ColumnId>;
  readonly indexIds: ReadonlySet<IndexId>; readonly relationIds: ReadonlySet<RelationId>;
  readonly autoIncrementIndexColumnIds: ReadonlySet<ColumnId>; // chỉ MySQL: cột cần index thường dự phòng
  readonly diagnostics: readonly GeneratorDiagnostic[];
};
export function findUnindexableConstraints(
  schema: SchemaDocument, dialect: SqlDialect, types: ReadonlyMap<ColumnId, DialectColumnType>,
): DroppedConstraints;
export function resolveReferentialAction(dialect: SqlDialect, action: ReferentialAction):
  { readonly action: ReferentialAction; readonly isLossy: boolean };
export function resolveSqlServerUnique(schema: SchemaDocument, tableId: TableId, columnIds: readonly ColumnId[]):
  { readonly mode: "plain" | "filtered"; readonly isNullsRestricted: boolean };
```

- `collectKeyColumnIds`: cột thuộc khóa chính, cột `isUnique`, cột của index, cột hai đầu của mọi cặp quan hệ (điều kiện của `key-column-type-narrowed`).
- `resolveSchemaColumnTypes`: điểm vào duy nhất để Task 13, 17, 18 lấy kiểu cột. Gọi `resolveDialectColumnType` cho mọi cột (theo `sortTables` rồi `columnIds`) với `isKeyColumn` từ `collectKeyColumnIds`. Riêng SQL Server, trước đó tính tập cột cần đổi độ dài cố định (Msg 1944): với mỗi khóa chính (ngưỡng 900), cột `isUnique` và index (ngưỡng 1700), cộng `sqlServerFixedKeyBytes` của các cột (kiểu tính với `isFixedLengthNarrowed: false`); khóa vượt ngưỡng thì mọi cột `char` của khóa vào tập. Sau đó lan theo quan hệ (R10, Msg 1778, 1753): với mọi quan hệ, cột ghép cặp qua `columnPairs` với một cột trong tập và có kiểu `char` cũng vào tập, lặp (hàng đợi tường minh) tới khi tập không đổi. Rồi gọi lại với `isFixedLengthNarrowed` theo tập; mỗi cột trong tập một `key-column-type-narrowed`. Riêng MySQL, sau bước kiểu từng cột (R13): với từng bảng, khi `mysqlRowBytes` của các cột vượt `MYSQL_MAX_ROW_BYTES`, đổi cột `char` hoặc `varchar` không thuộc khóa có `length` lớn nhất (bằng nhau thì cột đứng trước theo `columnIds`) thành `{ kind: "text" }` kèm `type-parameter-out-of-range`, tính lại, lặp tới khi vừa hoặc không còn cột để đổi (giới hạn đã chấp nhận). Một cột chỉ có một kiểu trong output, nên cột đã đổi cho một khóa thì đổi ở mọi nơi. `diagnostics` gộp diagnostic của mọi cột.
- `findUnindexableConstraints`: PostgreSQL → rỗng. MySQL, SQL Server: khóa chính có cột kiểu `json` hoặc `binary` bị bỏ; cột `isUnique` kiểu đó bỏ unique; index có cột kiểu đó bị bỏ; quan hệ có cột kiểu đó ở một trong hai đầu bị bỏ (kiểu hai đầu phải bằng nhau, nên đây đúng là khóa ngoại tham chiếu tới ràng buộc bị bỏ). Riêng MySQL, thêm điều kiện độ dài: với kiểu đã qua `resolveDialectColumnType(…, isKeyColumn: true)`, khóa chính, cột `isUnique`, index có tổng `mysqlKeyPartBytes` của các cột vượt `MYSQL_MAX_KEY_BYTES` bị bỏ, và quan hệ có tổng `mysqlKeyPartBytes` của các cột nguồn vượt ngưỡng bị bỏ (khóa được tham chiếu có cùng tập cột và cùng kiểu, nên nó cũng bị bỏ; khóa ngoại MySQL còn tự tạo index trên cột nguồn). Riêng SQL Server, khóa chính có tổng `sqlServerFixedKeyBytes` (theo `types`, tức sau khi đã đổi `nchar`) vẫn quá 900, cột `isUnique` hoặc index quá 1700, bị bỏ. Thêm cho mọi dialect trừ PostgreSQL: quan hệ có tập `toColumnId` bằng tập cột của một khóa chính, cột `isUnique` hoặc index unique đã bị bỏ của bảng đích cũng bị bỏ. Mỗi phần tử bị bỏ một diagnostic `key-column-type-not-indexable` theo hợp đồng `path` của Task 2, dù bị bỏ vì một hay nhiều lý do. `autoIncrementIndexColumnIds` (chỉ MySQL, lỗi 1075, R14): cột auto-increment không phải cột đầu tiên của khóa chính (theo `primaryKeyColumnIds`), unique cột hay index (theo `columnIds` của index) nào còn giữ sau khi bỏ, kể cả khi khóa chính nhiều cột có nó đứng sau; người gọi thêm index thường một cột tên `autoIncrementIndexes` của Task 9 (`<bảng>_<cột>_idx`), không có diagnostic.
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
- `dialect-types.test.ts`: `narrows a MySQL char or varchar key column longer than 768 to varchar(768)` (`it.each`: `varchar(1000)` một diagnostic; `char(1000)`, `varchar(20000)` hai diagnostic); `narrows a SQL Server nchar to nvarchar when asked`; `keeps a MySQL varchar(768) key column`; `keeps a long varchar key column on SQL Server and PostgreSQL`; `keeps a long MySQL varchar that is not a key column`; `counts MySQL key part bytes by type` (`it.each`: `varchar(10)` 40, `keyText` 1020, `uuid` 144, `custom` 0, `bigint` 32); `keeps types within dialect limits unchanged` (`it.each`); `maps char beyond the MySQL limit to varchar`; `maps char beyond the MySQL varchar limit to text`; `maps char beyond the PostgreSQL and SQL Server limits to text`; `maps varchar beyond the limit to text for each dialect` (`it.each`); `clamps decimal precision and scale to each dialect limit` (`it.each`); `reports type-parameter-out-of-range at the column type path`; `keeps text in a PostgreSQL key column`; `narrows text in a key column to 255 on MySQL and 450 on SQL Server`; `narrows an out-of-range varchar key column to nvarchar(450) on SQL Server and reports both diagnostics`; `marks a custom type with an unsafe name`.
- `dialect-constraints.test.ts`: `collects primary key, unique, index and relation columns as key columns`; `drops nothing on PostgreSQL`; `drops a primary key, a unique column and an index containing json or binary` (`it.each` MySQL, SQL Server); `drops a relation between json or binary columns`; `narrows nchar columns of a SQL Server primary key over 900 bytes and a unique over 1700 bytes to nvarchar`; `drops a SQL Server key still over the fixed-length limit after narrowing`; `drops a relation that references a dropped key`; `asks for a fallback index when a MySQL auto-increment column loses its only key`; `asks for a fallback index when the auto-increment column is not first in a composite primary key`; `asks for no fallback index on SQL Server`; `spreads nchar narrowing to every column paired through relations on SQL Server`; `converts the largest non-key MySQL varchar to text until the row fits`; `keeps key columns when only key columns remain over the row size`; `resolves the types of every column once per schema`; `keeps a MySQL index of exactly 3072 bytes`; `drops a MySQL index, primary key and relation longer than 3072 bytes`; `keeps long keys on SQL Server and PostgreSQL`; `reports one key-column-type-not-indexable per dropped element`; `maps set default to no action on MySQL as lossy`; `maps restrict to no action on SQL Server without loss`; `keeps every action on PostgreSQL`; `filters a nullable unique that no foreign key references`; `restricts a nullable unique referenced by a foreign key`; `uses a plain unique when no column is nullable`.
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

1. Chuẩn bị: `resolveSchemaColumnTypes(schema, dialect)` (import từ `dialect-column-types.ts`; kiểu mọi cột cùng diagnostic kiểu), `findUnindexableConstraints(schema, dialect, types.types)`, `allocateConstraintNames(schema, (relation) => orderColumnPairsByReferencedKey(schema, relation))`; MySQL thêm `allocateMysqlNames(schema)`; SQL Server thêm `findCascadeConflicts(schema)`. Tên cột ghi ra luôn lấy qua một hàm tra cứu duy nhất (tên MySQL đã đổi, hoặc tên gốc), dùng cho cột, khóa chính, unique, index, khóa ngoại và CHECK.
2. **Enum** theo `sortEnums`. PostgreSQL: giá trị qua `removeNullCharacters`, bỏ thì thêm `null-character-removed` tại `["enums", id, "values", i]`.
3. **Bảng** theo `sortTables`, cột theo `columnIds`:
   - Kiểu: lấy từ `resolveSchemaColumnTypes`, không gọi `resolveDialectColumnType` trực tiếp. Kiểu `custom` có `isSafe: false` → thay bằng `{ kind: "text" }` kèm `custom-type-unsafe`.
   - Mặc định: `formatSqlDefault` với `shouldParenthesizeLiteral` đúng khi dialect là MySQL và kiểu sau bước trên là `text`, `json` hoặc `binary`. `omitted` → `defaultSql: null` kèm `default-omitted`; `hasRemovedNullCharacter` → `null-character-removed` tại `["columns", id, "defaultValue"]`.
   - Comment bảng và cột: PostgreSQL bỏ U+0000 kèm `null-character-removed` tại đường dẫn `comment` tương ứng, không giới hạn độ dài. MySQL, SQL Server giữ U+0000 nhưng cắt comment vượt giới hạn của đích (Vấn đề 2, spec mục 4 "Cắt comment") kèm `comment-truncated` tại `["tables", id, "comment"]` hoặc `["columns", id, "comment"]`: MySQL comment cột quá 1024 code point cắt còn 1024 code point đầu, comment bảng quá 2048 code point cắt còn 2048; SQL Server comment (bảng và cột) quá 3750 code unit UTF-16 cắt còn tiền tố dài nhất không quá 3750 code unit và không tách cặp surrogate. Hai hàm `truncateCodePoints(text, max)` và `truncateUtf16CodeUnits(text, max)` nằm trong file của task này (ví dụ `sql-ddl-model-comments.ts`), kèm test.
   - Khóa chính: khi `primaryKeyColumnIds` không rỗng và bảng không nằm trong `primaryKeyTableIds` bị bỏ, tên từ `primaryKeys`.
   - Cột `isUnique` không bị bỏ, theo `columnIds`: PostgreSQL, MySQL → `uniqueConstraints`. SQL Server → `resolveSqlServerUnique(schema, tableId, [columnId])`: `plain` → `uniqueConstraints` (thêm `unique-nulls-restricted` tại `["columns", id, "isUnique"]` khi `isNullsRestricted`); `filtered` → một `SqlIndexModel` unique có `filterColumnNames: [tên cột]`, cùng tên ràng buộc.
   - `enumChecks`: chỉ SQL Server, mọi cột enum theo `columnIds`, tên từ `enumChecks` của Task 9.
4. **Index**: index của người dùng theo `sortIndexes` (bỏ index trong `indexIds` bị bỏ), tên MySQL đã đổi hoặc tên gốc; SQL Server với index unique gọi `resolveSqlServerUnique`: `filtered` → `filterColumnNames` là các cột nullable theo thứ tự cột của index; `isNullsRestricted` → `unique-nulls-restricted` tại `["indexes", id]`. Sau đó mới đến index lọc sinh từ cột `isUnique` ở bước 3, theo thứ tự bảng rồi cột. Cuối cùng, chỉ MySQL: mỗi cột trong `autoIncrementIndexColumnIds` (theo thứ tự bảng rồi cột) một `SqlIndexModel` không unique, một cột, tên là `autoIncrementIndexes` của Task 9 cho cột đó (`<bảng>_<cột>_idx`), không có diagnostic (lỗi 1075, R14).
5. **Khóa ngoại** theo `sortRelations`, bỏ quan hệ trong `relationIds` bị bỏ; cặp cột theo `orderColumnPairsByReferencedKey`. SQL Server: quan hệ trong `findCascadeConflicts` → cả hai hành động `noAction` kèm `referential-action-cycle` tại `["relations", id]`. Còn lại mỗi sự kiện qua `resolveReferentialAction`; `isLossy` → `referential-action-not-supported` tại `["relations", id, "onDelete"]` hoặc `"onUpdate"`.
6. Phần tử được tham chiếu mà không tìm thấy (không xảy ra với tài liệu đã qua `parseSchemaDocument`) thì bỏ qua, không throw. `diagnostics` đi qua `finalizeDiagnostics`.

**Test viết trước:**

- `orders enums, tables, indexes and foreign keys by the part 2 ordering`; `returns the same model regardless of map key order`.
- `resolves column types, defaults and comments for each dialect` (`it.each` ba dialect trên vài cột của `createSampleSchema()`).
- `uses the renamed MySQL column name in the primary key, index and foreign key`.
- `replaces an unsafe custom type with text and reports custom-type-unsafe`; `omits an invalid default and reports default-omitted`; `parenthesizes a MySQL literal default on text, json and binary storage`.
- `removes null characters from PostgreSQL comments, defaults and enum values and reports each`; `keeps null characters for MySQL and SQL Server`.
- `truncates a MySQL column comment to 1024 code points and a table comment to 2048 and reports comment-truncated`; `truncates a SQL Server comment to 3750 utf-16 code units without splitting a surrogate pair`; `keeps comments at exactly the limit`; `keeps long PostgreSQL comments`.
- `drops constraints with json or binary columns on MySQL and SQL Server and keeps them on PostgreSQL`.
- `moves a nullable unique column to a filtered unique index on SQL Server`; `adds filter columns to a nullable unique index on SQL Server`; `keeps a referenced nullable unique as a constraint and reports unique-nulls-restricted`.
- `orders foreign key columns by the referenced key`.
- `downgrades both actions of a cascade conflict on SQL Server and reports referential-action-cycle`; `maps set default to no action on MySQL and reports each event`; `writes restrict as no action on SQL Server without a diagnostic`.
- `writes enum checks only for SQL Server`; `uses the allocated constraint names`.
- `drops a MySQL unique index longer than 3072 bytes and the foreign key that references it`.
- `adds a plain MySQL index for an auto-increment column whose primary key was dropped`; `adds a plain MySQL index for an auto-increment column that is second in a composite primary key`; `uses nvarchar for SQL Server nchar key columns over the fixed-length limit and for the columns paired with them`; `parenthesizes the default of a MySQL column moved to text for the row size`.
- `reports the expected diagnostic codes for createTargetLimitSchema on each dialect` (`it.each`, so tập mã).
- `does not throw for a schema with duplicate names, an invalid default and an unsafe custom type`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add shared sql ddl model`

## Task 14: CG-01 SQL DDL cho PostgreSQL

**Mục tiêu:** `@schemaforge/core/generators/postgresql` export `generatePostgresql`, in DDL PostgreSQL từ `SqlDdlModel` (spec CG-01, mục 3 bảng "SQL" cột PostgreSQL, mục 4 ma trận).

**Phụ thuộc:** Task 1, 4, 5, 13, 36. **Đợt:** 5.

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

**Phụ thuộc:** Task 1, 4, 5, 13, 36, và Task 8 với kết quả probe MySQL đã ghi trong execution log của Task 8. **Đợt:** 5.

**Trước khi bắt đầu:** đọc mục kết quả probe MySQL trong `document/executions/logs/` của Task 8 (`*-code-generators-task-8.md`). Điểm nào khác spec mục 4 hoặc khác quyết định ở Vấn đề 1, 2, 7, 9 thì dừng và báo; không tự đổi quy tắc.

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
- `generate-mysql.test.ts`: `names the file schema.sql with language sql`; `writes auto-increment, not null, default and comment in column order`; `writes an unnamed primary key and named unique constraints`; `ends every table with InnoDB, utf8mb4 and the accent-sensitive collation`; `writes a non-empty table comment as a table option`; `wraps literal defaults of LONGTEXT, JSON and LONGBLOB columns in parentheses`; `writes CURRENT_TIMESTAMP(6) and (UUID()) defaults`; `narrows text key columns to VARCHAR(255) and reports key-column-type-narrowed`; `narrows a varchar(1000) key column to VARCHAR(768)`; `omits an index longer than 3072 bytes and the foreign key that references it and reports each`; `truncates column and table comments beyond the MySQL limits and reports comment-truncated`; `writes a plain index named <table>_<column>_idx for an auto-increment column that leads no key`; `writes LONGTEXT for the largest non-key varchar of a row over 65535 bytes and reports type-parameter-out-of-range`; `writes char(300) in a key as VARCHAR(300)`; `truncates fractional seconds of defaults to six digits`; `omits constraints with json or binary columns and reports each`; `writes set default as NO ACTION and reports each event`; `renames a column that differs only by an accent and uses the new name in keys`; `escapes backslashes and quotes in string literals`; `quotes identifiers containing a backtick`; `creates indexes before foreign keys`; `writes no statement after the foreign keys`; `writes an empty schema as a single newline`.
- Snapshot: `matches the snapshot for <fixture>` (`it.each` với `sample`, `naming-edge`, `target-limit`, `empty`).

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/mysql` và `generateMysql`, mong đợi `function schema.sql`.


**Commit:** `feat(core): add mysql ddl generator`

## Task 16: CG-01 SQL DDL cho SQL Server

**Mục tiêu:** `@schemaforge/core/generators/sqlserver` export `generateSqlServer`, in T-SQL cho SQL Server 2022 từ `SqlDdlModel` (spec CG-01, mục 3 bảng "SQL" cột SQL Server, mục 4 ma trận và "Phát hiện vòng cascade trên SQL Server").

**Phụ thuộc:** Task 1, 4, 5, 13, 17 (`generators/shared/sqlserver-enum-length.ts`), 36, và Task 8 với kết quả probe SQL Server đã ghi trong execution log của Task 8. **Đợt:** 6.

**Trước khi bắt đầu:** đọc mục kết quả probe SQL Server trong execution log của Task 8 và quyết định ở Vấn đề 2, 8, 9 (cột "Quyết định"). Điểm nào khác spec thì dừng và báo.

**File sở hữu (tạo):** `packages/core/src/generators/sqlserver/index.ts`, `generate-sqlserver.ts`, `generate-sqlserver.test.ts`, `render-sqlserver-type.ts`, `render-sqlserver-type.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/sqlserver/`.

**Chữ ký:**

```ts
export type SqlServerOptions = GeneratorOptions["sqlserver"];
export function generateSqlServer(schema: SchemaDocument, options: SqlServerOptions): GenerateResult;
export function renderSqlServerType(type: DialectColumnType, enums: SchemaDocument["enums"]): string; // không export qua index.ts
```

`sqlServerEnumLength` import từ `generators/shared/sqlserver-enum-length.ts` (Task 17 tạo); không viết lại trong `sqlserver/`.

`index.ts` chỉ export `generateSqlServer` và type `SqlServerOptions`. `file` là `{ fileName: "schema.sql", language: "sql", content }`.

**Kiểu:** `smallint`, `int`, `bigint`, `decimal(p, s)`, `real`, `float(53)`, `bit`, `nchar(n)`, `nvarchar(n)`, `nvarchar(max)` cho `text` và `json`, `nvarchar(n)` cho `keyText`, `uniqueidentifier`, `date`, `time`, `datetime2` cho `timestamp`, `datetimeoffset` cho `timestamptz`, `varbinary(max)`; `custom` ghi nguyên văn. Enum là `nvarchar(n)` với `n = sqlServerEnumLength(values)` (độ dài giá trị dài nhất tính theo code unit UTF-16, tối thiểu 1); `null` → `nvarchar(max)`, và `generateSqlServer` thêm `type-parameter-out-of-range` tại `["columns", id, "type"]` cho từng cột enum đó, gộp với `model.diagnostics` bằng `finalizeDiagnostics` (Vấn đề 6). Enum không tìm thấy → `nvarchar(max)`.

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
- `generate-sqlserver.test.ts`: `names the file schema.sql with language sql`; `writes identity, explicit null or not null, and default in column order`; `writes primary key, unique and enum check constraints after the columns`; `writes enum check values as N literals`; `writes bit defaults as 1 and 0`; `writes sysdatetime for datetime2 and sysdatetimeoffset for datetimeoffset`; `writes newid() for generateUuid`; `moves a nullable unique column to a filtered unique index`; `writes a WHERE clause for the nullable columns of a unique index`; `keeps a referenced nullable unique as a constraint and reports unique-nulls-restricted`; `writes restrict as NO ACTION without a diagnostic`; `downgrades a cascade cycle and a second cascade path to NO ACTION and reports referential-action-cycle`; `narrows text key columns to nvarchar(450)`; `omits constraints with json or binary columns and reports each`; `creates indexes before foreign keys`; `declares the schema name variable once before the extended properties`; `passes table and column names to sp_addextendedproperty as N literals`; `writes no comment statements when no comment exists`; `quotes identifiers containing a closing bracket`; `contains no GO batch separator for the naming edge schema`; `reports type-parameter-out-of-range for an enum longer than 4000 code units`; `truncates a comment beyond 3750 utf-16 code units and reports comment-truncated`; `truncates fractional seconds of time and datetime2 defaults to seven digits without a diagnostic`; `keeps a varchar(1000) key column as nvarchar(1000)`; `writes nvarchar for nchar primary key and unique columns over the fixed-length limits and reports key-column-type-narrowed`; `writes nvarchar for a foreign key column paired with a narrowed primary key and reports it`; `writes an empty schema as a single newline`.
- Snapshot: `matches the snapshot for <fixture>` (`it.each` với `sample`, `naming-edge`, `target-limit`, `empty`).

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/sqlserver` và `generateSqlServer`, mong đợi `function schema.sql`.


**Commit:** `feat(core): add sql server ddl generator`

## Vấn đề phát hiện khi lập plan

Task 0 đã chốt mọi vấn đề dưới đây ngày 2026-10-02 (user giao quyền quyết định cho orchestrator; spec phần 6, mục "Quyết định bổ sung 2026-10-02"). Cột "Quyết định" ghi lựa chọn; các task đã được viết theo lựa chọn đó. Vấn đề 13–20 phát hiện ở lượt lập plan thứ hai và các lượt duyệt plan, do plan hoặc orchestrator quyết định, theo spec và rule hiện có.

| # | Vấn đề | Đề xuất | Quyết định | Ảnh hưởng |
|---|---|---|---|---|
| 1 | **MySQL giới hạn tổng độ dài khóa index 3072 byte.** Với `utf8mb4` mỗi ký tự tính 4 byte, nên một cột `char`, `varchar` có `n > 768` trong khóa chính, unique hoặc index, hoặc nhiều cột có tổng vượt 3072 byte (kể cả bốn cột `text` đã hẹp về `VARCHAR(255)` theo spec), làm `CREATE TABLE`, `CREATE INDEX` báo lỗi 1071. Schema vẫn hợp lệ theo phần 2, và ma trận spec mục 4 chỉ xử lý `text`. SQL Server chỉ cảnh báo lúc tạo (900 byte cho khóa clustered, 1700 byte cho nonclustered), không lỗi DDL | Task 8 probe xác nhận. Nếu đúng, user chọn: (a) MySQL hẹp cột `char`, `varchar` trong khóa có `n > 768` về `VARCHAR(768)` kèm `key-column-type-narrowed`, và khi tổng vẫn vượt 3072 byte thì bỏ ràng buộc hoặc index kèm `key-column-type-not-indexable`; hoặc (b) ghi thành giới hạn đã biết của CG-01 và fixture tránh trường hợp này. Plan nghiêng về (a) để giữ tiêu chí "DDL chạy không lỗi với schema hợp lệ" | Phương án (a). Đã viết vào Task 4, 8, 12, 13, 15 | Spec mục 4; Task 4, 8, 12, 13, 15, 17, 18 |
| 2 | **Giới hạn độ dài comment.** MySQL từ chối comment cột dài hơn 1024 ký tự và comment bảng dài hơn 2048 ký tự ở strict mode mặc định; giá trị extended property của SQL Server tối đa 7500 byte (3750 ký tự `nvarchar`). Phần 2 không giới hạn độ dài comment, nên schema hợp lệ có thể cho DDL lỗi | Task 8 probe xác nhận. Nếu đúng: thêm mã diagnostic thứ 17 `comment-truncated` (cắt ở ranh giới code point, `path` là đường dẫn `comment`), cần user duyệt vì đổi danh mục của spec mục 4. Trong lúc chờ, Task 15, 16 không cắt và fixture giữ comment ngắn | Thêm mã thứ 17 `comment-truncated` (sau `null-character-removed`, trước `seed-table-skipped`); MySQL cột > 1024 ký tự, bảng > 2048 ký tự; SQL Server `MS_Description` > 3750 code unit UTF-16; cắt ở ranh giới code point. Task 2 đã có 17 mã; đã viết vào Task 4, 8, 13, 15, 16, 34 | Spec mục 4; Task 2, 4, 13, 15, 16, 34 |
| 3 | **Kiểu custom trong conformance.** `createSampleSchema()` có cột `location` kiểu `geometry(Point, 4326)`. `postgres:18-alpine` không có PostGIS, MySQL không có cú pháp này, SQL Server có `geometry` nhưng không nhận tham số, nên chạy DDL của fixture nguyên trạng làm CG-01 fail trên cả ba database; seed cũng bỏ bảng `users` nếu cột này bắt buộc và không có mặc định | Package conformance có helper thay tên kiểu custom của fixture bằng một kiểu có thật của dialect trước khi sinh (`inet` cho PostgreSQL, `YEAR` cho MySQL, `money` cho SQL Server; cả ba qua cú pháp an toàn). Snapshot trong core vẫn dùng fixture nguyên trạng. Không dùng image PostGIS (nặng, và không giải quyết MySQL, SQL Server). Task 4 bảo đảm cột custom bắt buộc không mặc định chỉ nằm ở bảng riêng | Theo đề xuất. Helper `withDialectCustomTypes` của Task 8; Task 14, 15, 16, 22 dùng | Task 4, 8, 29 |
| 4 | **`restrict` trong đồ thị cascade của SQL Server.** Spec mục 4 đưa vào đồ thị mọi quan hệ "có hành động khác `noAction`". SQL Server ghi `restrict` là `NO ACTION` (tương đương theo nguyên tắc 2 của mục 4), và `NO ACTION` không gây lỗi vòng hay nhiều đường cascade. Đọc đúng chữ thì quan hệ `restrict` bị hạ kèm diagnostic dù output không đổi, và làm quan hệ cascade khác bị hạ oan | Đồ thị bỏ cả `noAction` và `restrict` (đã viết vào Task 11). Prisma `sqlserver` cũng ghi `restrict` là `NoAction`, nên SQL và Prisma vẫn khớp. Conformance của Task 29, 30 xác nhận với SQL Server và `prisma validate` | Theo đề xuất (spec mục 4 đã sửa) | Spec mục 4; Task 11, 13, 17 |
| 5 | **Cột tên `__proto__`.** Tên này hợp lệ theo phần 2. Trong object literal JavaScript, cả `__proto__: …` lẫn `"__proto__": …` đặt prototype thay vì tạo thuộc tính, nên `z.object({ "__proto__": … })`, dữ liệu trong `handlers.ts` và object dựng bằng phép gán trong core âm thầm mất cột. Spec mục 5 chỉ ghi "khớp regex thì ghi trần, còn lại `JSON.stringify`" | `formatPropertyKey` trả `["__proto__"]` (khóa tính toán tạo thuộc tính thật, hợp lệ cả trong type literal TypeScript); mọi object có khóa từ tên người dùng dựng bằng `Object.fromEntries` (mục "Quy ước chung"). Fixture `naming-edge` có cột này; Task 30 typecheck và parse dữ liệu có cột này | Theo đề xuất | Task 4, 6, 19, 20, 21, 22, 23, 24, 30 |
| 6 | **Tham số kiểu chưa đủ trong ma trận.** (a) PostgreSQL `char(n)` cũng tối đa 10 485 760 nhưng spec chỉ ghi `varchar(n)`. (b) Spec không nói thứ tự giữa "vượt giới hạn" và "`text` trong khóa": `varchar(20000)` trong khóa MySQL thành `LONGTEXT`, không đánh index được. (c) SQL Server enum là `nvarchar(n)` với `n` là độ dài giá trị dài nhất, nhưng không nói đơn vị và trường hợp vượt 4000 | (a) Xử lý như `varchar`: `text` kèm `type-parameter-out-of-range`. (b) Áp giới hạn trước, rồi hẹp như `text` (`VARCHAR(255)`, `nvarchar(450)`) kèm cả hai diagnostic. (c) `n` tính theo code unit UTF-16 (đơn vị của `nvarchar`), tối thiểu 1; vượt 4000 thì `nvarchar(max)` kèm `type-parameter-out-of-range`. Đã viết vào Task 12, 16 | Theo đề xuất (spec mục 3, 4 đã sửa) | Task 12, 13, 16, 17, 18 |
| 7 | **So tên không phân biệt dấu.** Spec mục 4 ghi MySQL so tên cột, index không phân biệt dấu. Tên ràng buộc do generator đặt (từ tên gốc có dấu) cũng là tên index trên MySQL: hai cột `ma`, `má` cùng `isUnique` cho `t_ma_key` và `t_má_key`, trùng trên MySQL. `NameAllocator` của spec chỉ có `isCaseInsensitive` | `NameAllocator` nhận `comparison` (`exact`, `caseInsensitive`, `caseAndAccentInsensitive`). Tên ràng buộc so không phân biệt dấu cho **mọi** dialect để tên vẫn giống nhau giữa ba dialect và Drizzle. Chưa rõ MySQL có coi `đ` và `d` là một không: Task 8 probe; nếu có, `toComparisonKey` đổi thêm `đ` → `d` | Theo đề xuất. Task 8 probe `đ` = `d`; nếu MySQL coi là một, orchestrator tạo task sửa `toComparisonKey` (Task 6) trước Task 15 | Task 6, 8, 9, 12 |
| 8 | **Giây lẻ quá 7 chữ số.** Literal `time`, `timestamp`, `timestamptz` của phần 2 cho phép số chữ số giây lẻ bất kỳ. PostgreSQL và MySQL làm tròn về 6 chữ số, còn SQL Server báo lỗi chuyển kiểu khi quá 7 chữ số, nên giá trị mặc định hợp lệ làm DDL SQL Server lỗi | Đề xuất phần 2 giới hạn giây lẻ tối đa 6 chữ số (bằng độ chính xác cột của CG-01), sửa `isValidDefaultLiteral` trong một task riêng của phần 2, chạy trước Task 16. Phương án khác: SQL Server cắt về 7 chữ số, không diagnostic. Task 8 probe xác nhận | Không đổi phần 2. Hàm literal SQL Server cắt giây lẻ về 7 chữ số, không diagnostic (spec mục 3 "Giây lẻ trên SQL Server"). Đã viết vào Task 7, 16 | Spec phần 2 mục 3; plan phần 2 Task 10; Task 7, 10, 16, 21 |
| 9 | **Điểm cần probe ngoài danh sách rủi ro của spec.** MySQL: literal `timestamptz` có `Z` và có độ lệch trên cột `TIMESTAMP(6)` (MySQL 8.0.19 trở lên nhận độ lệch, `Z` chưa rõ); `DEFAULT (UUID())` trên `CHAR(36)`; hai tên ràng buộc chỉ khác dấu (Vấn đề 7). SQL Server: `DECLARE` sau `CREATE TABLE` trong cùng batch; `sp_addextendedproperty` với `@level0name` là biến; literal `time` 7 chữ số giây lẻ | Task 8 viết probe cho từng điểm cùng các điểm ở mục "Rủi ro" của spec. Probe khác kỳ vọng thì dừng Task 15, 16 và user quyết định sửa spec | Task 8 probe mọi điểm, chạy local qua Docker, ghi kết quả vào execution log; khác kỳ vọng thì dừng generator của dialect đó | Task 8, 15, 16 |
| 10 | **Index trùng tên bảng trên PostgreSQL.** PostgreSQL dùng chung một không gian tên cho bảng và index. Phần 2 chỉ bảo đảm tên index không trùng tên index khác (`index-name-duplicate`), và spec phần 6 không cho đổi tên index của người dùng, nên index tên `users` trên bảng khác làm DDL lỗi dù schema hợp lệ | Đề xuất phần 2 mở rộng `index-name-duplicate` cho trùng tên bảng (hoặc thêm issue mới). Cho tới khi đó, fixture tránh trường hợp này | Phần 2 thêm issue `index-name-conflicts-table` tại `["indexes", indexId, "name"]` khi tên index trùng tên một bảng (so bằng `toNameKey`); `suggestIndexName` tránh cả tên bảng. Task 36 | Spec phần 2 mục 8; Task 4, 14 |
| 11 | **Mã `SeedIssue` không có bản dịch.** Spec không yêu cầu i18n cho `seed-value-invalid`, `seed-value-null`, `seed-unique-violation`, `seed-foreign-key-missing`, `seed-order-invalid`; code panel của phần 6 không hiển thị chúng | Không export danh mục này ở entry point chính và không có namespace dịch trong phần 6. Phần 5 (AI-06) quyết định khi cần hiển thị | Theo đề xuất | Task 21, 34 |
| 12 | **Bảng không có cột.** 25 mã issue của phần 2 không có mã nào cho bảng rỗng. PostgreSQL nhận `CREATE TABLE "t" ();`, nhưng MySQL và SQL Server từ chối bảng không có cột, và Prisma từ chối model không có trường, nên schema hợp lệ vẫn cho output lỗi. AI hoặc import có thể tạo bảng rỗng | Đề xuất phần 2 thêm issue `table-columns-empty` tại `["tables", id, "columnIds"]`: bảng rỗng thành schema còn issue, và generator vẫn sinh output an toàn theo spec mục 2. Fixture không có bảng rỗng | Phần 2 thêm issue `table-columns-empty` tại `["tables", tableId, "columnIds"]`. Task 36 | Spec phần 2 mục 8; plan phần 2; Task 4, 14, 15, 16, 17, 34 |
| 13 | **Cổng conformance và package conformance lúc mới tạo.** Spec mục 7 (sửa ngày 2026-10-02) đặt conformance local làm cổng chặn. Nếu Task 3 khai báo script `typecheck`, `lint` mà package chưa có file nguồn thì `pnpm typecheck` ở root đỏ cho tới khi Task 8 merge | — | Cổng áp cho task generator từ khi test conformance của đích đó đã có (Task 29, 30, 31); probe local của Task 8 là điều kiện của Task 15, 16; Task 29, 30, 31 phải pass hết trước khi phần 6 xong (orchestrator, 2026-10-02). Task 3 tạo luôn `tsconfig.json`, `vitest.config.ts`, `.gitignore` và helper `temp-directory.ts` có test, để package có file nguồn ngay từ đầu. CG-10 không có công cụ đích nên không có conformance | Task 3, 8, 29, 30, 31, 35 |
| 14 | **Vị trí code của code panel.** Spec mục 8 đặt file ở `frontend/src/features/code-generator/`, nhưng `.claude/rules/nextjs.md` cấm một feature import phần bên trong của feature khác, trong khi code panel cần store của editor, `getIssueIndex`, `resolveIssueTarget`, `useRevealTable` và `PropertiesPanel` | — | Giữ đúng tên bảy file của spec, đặt trong `frontend/src/features/editor/code-generator/` (code panel là một chế độ của cột phải trong editor). Không đổi hành vi nào của spec. Orchestrator cho cập nhật đường dẫn ở spec mục 8 cùng Task 35 | Task 33, 34, 35; spec mục 8 |
| 15 | **MSW 3 đã phát hành** (3.0.0 ngày 2026-09-28, `latest` là 3.0.1). Spec CG-06 chốt handler MSW 2; người dùng chạy `npm install msw` sẽ nhận MSW 3 | — | Giữ MSW 2 theo spec: conformance cài `msw@^2.15.0`, comment đầu `handlers.ts` ghi `npm install msw@^2` (Task 23). Chuyển sang MSW 3 là thay đổi spec riêng sau phần 6 | Task 23; spec CG-06 |
| 16 | **Tài liệu phần 2 cho hai issue mới.** Spec phần 6 mục "Quyết định bổ sung 2026-10-02" ghi rằng spec và plan phần 2 (mục 8, danh mục 25 mã) được cập nhật ở một task sau | — | Task 36 cài đặt theo spec phần 6; Task 35 cập nhật spec phần 2 mục 8 (27 mã) và ghi chú trong plan phần 2 | Task 35 |
| 17 | **Quyết định bổ sung khi duyệt spec (orchestrator, 2026-10-02; spec mục "Quyết định bổ sung 2026-10-02", R1–R18).** Các giới hạn database thật mà ma trận spec mục 4 chưa có: độ dài cố định của khóa SQL Server (Msg 1944), cột `char`, `varchar` vượt giới hạn trong khóa MySQL, cột `AUTO_INCREMENT` không đứng đầu index nào (lỗi 1075), kích thước dòng MySQL (lỗi 1118), giây lẻ MySQL, so định danh MySQL theo `utf8mb3_general_ci` | — | Theo spec: R1, R10 (`nchar` → `nvarchar` kèm `key-column-type-narrowed`, lan theo quan hệ; vẫn vượt thì bỏ); R2, R11 (`VARCHAR(768)` thẳng khi `n > 768`); R8, R14 (index `<bảng>_<cột>_idx`, tên cấp ở Task 9); R13 (cột `CHAR`, `VARCHAR` lớn nhất không thuộc khóa thành `LONGTEXT`); R15 (hàm literal MySQL luôn cắt về 6 chữ số); R12 (`caseAndAccentInsensitive` đổi `đ`, `ø`, `ł`, `ħ`); R9, R16 (sequence identity PostgreSQL: giới hạn đã chấp nhận, không có task); R17 (không đổi). Đã viết vào Task 4, 6, 7, 8, 9, 12, 13, 15, 16; Task 17, 18 dùng chung qua `resolveSchemaColumnTypes`, `findUnindexableConstraints` | Task 4, 6, 7, 8, 9, 12, 13, 15, 16, 17, 18 |
| 18 | **Phía ngược của quan hệ 1-1 có tên trong Drizzle.** Spec CG-03 ghi phía ngược 1-1 là `one(source)` và tên quan hệ theo mục 5 khi có tự tham chiếu hoặc nhiều quan hệ giữa hai bảng. Typings `drizzle-orm` 0.45.3 đã cài (`relations.d.ts`, `RelationConfig`, kiểm tra ngày 2026-10-02) bắt buộc `fields` và `references` mỗi khi truyền config cho `one`, nên không truyền được `relationName` một mình | — | Quan hệ 1-1 có tên không có trường phía ngược trong `relations()`; phía khóa ngoại vẫn có `one(…, { fields, references, relationName })`, đủ cho relational query của Drizzle v1. Quan hệ 1-1 không tên vẫn có `one(source)` ở phía ngược. Không có diagnostic: `relations()` là metadata truy vấn, không đổi schema database (plan quyết định, 2026-10-02). Task 35 sửa mục 4 và CG-03 của spec theo quyết định này | Task 18, 35 |
| 19 | **`parseSeedDataset` cho AI-06.** Duyệt spec phần 5 (2026-10-02) quyết định frontend của AI-06 parse dữ liệu mẫu từ backend bằng một hàm Zod của phần 6, export ở `@schemaforge/core/generators/seed` cạnh type `SeedDataset`, khớp với spec phần 5 (AI-R43) | — | Task 21 viết `parseSeedDataset(input: unknown): Result<SeedDataset, readonly StructuralError[]>` trong `seed-dataset.ts` (chỉ kiểm tra hình dạng, mã lỗi `invalid-shape` qua `toStructuralErrors`; kiểm tra theo schema là việc của `validateSeedDataset`); Task 22 export nó ở `seed/index.ts`. Task 35 ghi `parseSeedDataset` vào CG-08 của spec phần 6 | Task 21, 22, 35 |
| 20 | **Hết lượt sinh lại một dòng của seed.** Spec CG-08 bullet "Unique" ghi dòng vi phạm được sinh lại tối đa một số lần cố định, "sau đó bỏ dòng và báo `seed-rows-reduced`", tức là bỏ dòng đó rồi thử dòng sau. Task 21 bước 5 dừng sinh cả bảng khi một dòng hết `SEED_MAX_ROW_ATTEMPTS` lượt | — | Giữ hành vi của plan: hết lượt thì dừng sinh bảng đó, giữ các dòng đã có, một `seed-rows-reduced` tại `["tables", id]`. Lý do: các dòng sau gặp cùng giới hạn (cột `boolean` unique, enum ít giá trị, bảng cha 1-1 đã hết dòng), nên thử tiếp chỉ tốn thêm tới 20 lần công cho mỗi dòng còn lại mà diagnostic vẫn như nhau (orchestrator, 2026-10-02). Task 35 sửa bullet "Unique" của CG-08 trong spec theo quyết định này | Task 21, 35 |


## Các task còn lại

Thân của Task 3, 8, 17–36, theo đúng "Quy ước chung", "Điểm nóng" và bảng task ở trên.

## Task 3: Manifest và dependency của package conformance

**Mục tiêu:** package `@schemaforge/codegen-conformance` có manifest đầy đủ, dependency đã cài và lockfile, cùng cấu hình TypeScript, Vitest và một helper đầu tiên có test, để các task sau không phải sửa manifest hay lockfile và `pnpm typecheck`, `pnpm lint` ở root vẫn xanh (spec mục 7; Vấn đề 3, 13).

**Phụ thuộc:** P2-26. **Đợt:** 1. Không chạy đồng thời với Task 32 hay task ghi lockfile của plan khác.

**File sở hữu:** tạo `packages/codegen-conformance/package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/support/temp-directory.ts`, `src/support/temp-directory.test.ts`; sửa `pnpm-workspace.yaml` (chỉ mục `allowBuilds`), `pnpm-lock.yaml`.

**Cài đặt:**

- `package.json`:

  ```json
  {
    "name": "@schemaforge/codegen-conformance",
    "version": "0.0.0",
    "private": true,
    "type": "module",
    "scripts": {
      "lint": "eslint .",
      "typecheck": "tsc --noEmit",
      "test:conformance": "vitest run"
    },
    "devDependencies": { "…": "đúng bảng bên dưới" }
  }
  ```

  Không có script `test`, `build`, `dev` (spec mục 7: `pnpm test` ở root không cần Docker; package không có mã nguồn để build). `devDependencies`: `@schemaforge/core: workspace:*`; `catalog:` cho `@types/node`, `typescript`, `vite`, `vitest`, `zod`; còn lại đúng khai báo ở mục "Phiên bản": `prisma ^7.10.0`, `drizzle-orm ^0.45.2`, `msw ^2.15.0`, `@readme/openapi-parser ^9.0.0`, `openapi-types ^12.1.3`, `@dbml/core ^10.1.1`, `testcontainers`, `@testcontainers/postgresql`, `@testcontainers/mysql`, `@testcontainers/mssqlserver` cùng `^12.1.0`, `pg ^8.23.0`, `@types/pg ^8.23.1`, `mysql2 ^3.24.4`, `mssql ^12.7.2`, `@types/mssql ^12.3.0`.
- `tsconfig.json`: `extends: "../../tsconfig.base.json"`, `compilerOptions`: `module: "nodenext"`, `moduleResolution: "nodenext"`, `lib: ["ES2023"]`, `types: ["node"]`, `noEmit: true`; `include: ["src", "vitest.config.ts"]`; `exclude: [".tmp"]`.
- `vitest.config.ts`: `environment: "node"`, `include: ["src/**/*.test.ts"]`, `testTimeout: 120_000`, `hookTimeout: 300_000` (kéo image và khởi động SQL Server lâu), `fileParallelism: false` (mỗi file tự khởi động container; chạy tuần tự để máy dev không phải giữ ba SQL Server cùng lúc). Không có `coverage`.
- `.gitignore`: một dòng `.tmp/`.
- `src/support/temp-directory.ts`:

  ```ts
  export const CONFORMANCE_TEMP_ROOT: string; // thư mục .tmp/ của package, tính từ import.meta.url
  export async function withTempDirectory<T>(run: (directory: string) => Promise<T>): Promise<T>;
  ```

  `mkdir(CONFORMANCE_TEMP_ROOT, { recursive: true })`, `mkdtemp(join(CONFORMANCE_TEMP_ROOT, "run-"))`, gọi `run`, rồi luôn `rm(directory, { recursive: true, force: true })` trong `finally`. Thư mục nằm trong package (không ở `os.tmpdir()`) để file `.ts` sinh ra resolve được `zod`, `drizzle-orm`, `msw` từ `node_modules` của package (Task 8, 18–20, 23).
- `pnpm-workspace.yaml`, mục `allowBuilds`: giữ ba mục đang có (`"@prisma/engines": true`, `prisma: true`, `unrs-resolver: true`). Chạy `pnpm install`; với mỗi package mới mà pnpm báo có build script bị bỏ qua, thêm một mục: `false` cho `msw` (script `postinstall` chỉ chép worker vào thư mục public khi được cấu hình), `ssh2` và `cpu-features` (binding native tùy chọn, Testcontainers chạy được không cần), và mọi package khác pnpm liệt kê, trừ khi package đó cần build để chạy. Ghi từng mục và lý do vào execution log.

**Test viết trước** (`src/support/temp-directory.test.ts`): `creates a fresh directory inside the package temp root`; `removes the directory after the callback resolves`; `removes the directory when the callback throws and rethrows the error`.

**Kiểm tra:**

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm install
pnpm install --frozen-lockfile
pnpm --filter @schemaforge/codegen-conformance typecheck
pnpm --filter @schemaforge/codegen-conformance lint
pnpm --filter @schemaforge/codegen-conformance test:conformance
pnpm --filter @schemaforge/codegen-conformance exec prisma --version
pnpm typecheck && pnpm lint && pnpm test
pnpm exec prettier --check packages/codegen-conformance pnpm-workspace.yaml
git status --porcelain
```

Mong đợi: hai lần `pnpm install` thoát mã 0, lần thứ hai không còn cảnh báo build script bị bỏ qua; `test:conformance` chạy ba test của `temp-directory.test.ts` (chưa cần Docker) và pass; `prisma --version` in dòng `prisma` với `7.10.0` hoặc bản vá 7.10.x; `pnpm test` ở root không chạy gì trong package conformance; `git status` chỉ có file của task. `.tmp/` không còn sau khi test chạy xong.

**Commit:** `build: add codegen conformance package and dependencies`

## Task 8: Helper conformance, task `test:conformance` và probe database

**Mục tiêu:** package conformance có đủ helper để task generator viết test của đích mình; `pnpm test:conformance` ở root chạy được; hành vi MySQL 8.4 và SQL Server 2022 mà spec dựa vào được probe trên database thật trước khi viết generator của hai dialect (spec mục 7 "Probe trước khi viết generator", mục "Rủi ro"; Vấn đề 1, 2, 3, 7, 8, 9).

**Phụ thuộc:** Task 3, 4. **Đợt:** 3. Cần Docker.

**File sở hữu:** tạo trong `packages/codegen-conformance/src/`: `support/containers.ts`, `support/fixtures.ts`, `support/fixtures.test.ts`, `support/typecheck.ts`, `support/typecheck.test.ts`, `support/prisma-cli.ts`, `support/prisma-cli.test.ts`, `probes/mysql.probe.test.ts`, `probes/sqlserver.probe.test.ts`; sửa `turbo.json`, `package.json` ở root.

**Chữ ký và hành vi:**

`support/containers.ts`:

```ts
export const POSTGRES_IMAGE = "postgres:18-alpine";
export const MYSQL_IMAGE = "mysql:8.4";
export const SQLSERVER_IMAGE = "mcr.microsoft.com/mssql/server:2022-latest";
export type DatabaseSession = {
  readonly execute: (sql: string) => Promise<void>;          // một lần gửi, nhiều câu lệnh
  readonly query: (sql: string) => Promise<readonly Readonly<Record<string, unknown>>[]>;
  readonly countTables: () => Promise<number>;               // bảng BASE TABLE của database hiện tại
  readonly countRows: (tableName: string) => Promise<number>;
  readonly close: () => Promise<void>;
};
export type DatabaseServer = {
  readonly dialect: SqlDialect;
  readonly createDatabase: (name: string) => Promise<DatabaseSession>;
  readonly stop: () => Promise<void>;
};
export function startDatabaseServer(dialect: SqlDialect): Promise<DatabaseServer>;
```

- PostgreSQL: `new PostgreSqlContainer(POSTGRES_IMAGE).start()`; `createDatabase` chạy `CREATE DATABASE` qua client quản trị rồi mở `pg.Client` tới database mới; `execute` là `client.query(sql)` không tham số (simple query, chạy được nhiều câu).
- MySQL: `new MySqlContainer(MYSQL_IMAGE).start()`; database mới tạo bằng `CREATE DATABASE … CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci`; kết nối `mysql2/promise` với `multipleStatements: true`. Không đổi `sql_mode` (strict mặc định của 8.4 là điều kiện của Vấn đề 2).
- SQL Server: `new MSSQLServerContainer(SQLSERVER_IMAGE).acceptLicense().start()`; `CREATE DATABASE` qua pool tới `master`, rồi `mssql.ConnectionPool` tới database mới; `execute` là `pool.request().batch(sql)` (một batch, không `sp_executesql`, để `DECLARE` dùng được).
- `countRows` quote tên bảng theo dialect bằng một hàm nội bộ của file (quy tắc giống spec mục 5); `SqlDialect` lấy bằng `import type` từ `@schemaforge/core`.

`support/fixtures.ts`:

```ts
export type ConformanceFixtureName = "sample" | "naming-edge" | "target-limit" | "empty";
export type ConformanceFixture = { readonly name: ConformanceFixtureName; readonly schema: SchemaDocument };
export function listConformanceFixtures(): readonly ConformanceFixture[]; // theo thứ tự trên
export const DIALECT_CUSTOM_TYPES: Readonly<Record<SqlDialect, { readonly typeName: string; readonly defaultLiteral: string }>>;
// postgresql: inet, "127.0.0.1"; mysql: YEAR, "2024"; sqlserver: money, "12.50"
export function withDialectCustomTypes(schema: SchemaDocument, dialect: SqlDialect): SchemaDocument;
```

- `listConformanceFixtures` dùng `createSampleSchema`, `createNamingEdgeSchema`, `createTargetLimitSchema` của `@schemaforge/core/testing` và `createEmptySchema("Empty")` của `@schemaforge/core`.
- `withDialectCustomTypes` (Vấn đề 3): mỗi cột kiểu `custom` được đổi tên kiểu thành `typeName`, và nếu có giá trị mặc định literal thì đổi literal thành `defaultLiteral`, bằng `applyOperation` với thao tác `updateColumn` của core trong một `batch` (không sửa object trực tiếp); kết quả lỗi thì throw `Error` kèm mã lỗi. Dùng cho CG-01 và seed SQL; các đích khác dùng fixture nguyên trạng.

`support/typecheck.ts`:

```ts
export type SourceFile = { readonly fileName: string; readonly content: string };
export function typecheckFiles(files: readonly SourceFile[]): Promise<readonly string[]>; // rỗng là qua
```

Ghi file vào `withTempDirectory` (kèm `package.json` có `"type": "module"`), tạo `ts.createProgram` với option bằng `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`, `target: ES2023`) cộng `module`, `moduleResolution: NodeNext`, `noEmit`, `types: []`; trả `ts.getPreEmitDiagnostics` đã định dạng bằng `ts.formatDiagnostics` (mỗi diagnostic một chuỗi).

`support/prisma-cli.ts`:

```ts
export function runPrismaValidate(schemaContent: string): Promise<{ readonly exitCode: number; readonly output: string }>;
```

Ghi `schema.prisma` vào `withTempDirectory`, chạy CLI `prisma` của package (đường dẫn lấy bằng `createRequire(import.meta.url).resolve("prisma/package.json")` rồi trường `bin`) bằng `execFile(process.execPath, [cli, "validate", "--schema", path])`, gộp stdout và stderr; không throw khi exit code khác 0.

**Probe** (mỗi điểm một `it`, khẳng định đúng kỳ vọng; khác kỳ vọng thì test đỏ). Mỗi file khởi động database của mình một lần, mỗi `it` dùng một database mới.

- `probes/mysql.probe.test.ts`, mỗi dòng: câu SQL → kỳ vọng.
  1. Bảng có hai cột `ma`, `má` → bị từ chối (cột trùng, spec mục 4).
  2. Hai index `ix_ma`, `ix_má` trên cùng bảng → bị từ chối.
  3. Hai ràng buộc unique `t_ma_key`, `t_má_key` → bị từ chối (Vấn đề 7).
  4. Từng cặp cột trong một bảng: `đa`/`da`, `øl`/`ol`, `łza`/`lza`, `ħal`/`hal` → bị từ chối (cột trùng, R12); cùng cặp `ENUM('đa', 'da')` → được nhận (R12 không áp cho giá trị enum).
  5. `ENUM('ma', 'má')` trong bảng `COLLATE=utf8mb4_0900_as_ci` → được nhận.
  6. Khóa ngoại `ON DELETE SET DEFAULT` → bị từ chối.
  7. `DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)` → được nhận.
  8. `LONGTEXT DEFAULT ('a''b')`, `JSON DEFAULT ('{"a":1}')` → được nhận; `LONGTEXT DEFAULT 'x'` (không ngoặc) → bị từ chối.
  9. `CHAR(36) DEFAULT (UUID())` → được nhận.
  10. `TIMESTAMP(6) DEFAULT '2026-01-02 03:04:05.123456+07:00'` và cùng giá trị dạng `2026-01-02T03:04:05.123456Z` → cả hai được nhận (literal của phần 2 có `T`).
  11. Unique index bốn cột `VARCHAR(192)` → được nhận; năm cột `VARCHAR(700)` → bị từ chối (lỗi 1071); một cột `VARCHAR(768)` unique → được nhận; `VARCHAR(769)` unique → bị từ chối; bốn cột `VARCHAR(192)` cộng một cột `INT` → bị từ chối (cột không phải chuỗi cũng tính vào 3072 byte); ba cột `VARCHAR(255)` → được nhận, bốn cột → bị từ chối (Vấn đề 1).
  12. Comment cột 1024 ký tự → được nhận, 1025 → bị từ chối; comment bảng 2048 → được nhận, 2049 → bị từ chối (Vấn đề 2).
  13. Literal `'a\\b'` lưu thành `a\b` (đọc lại bằng `SELECT`).
  14. `DATETIME(6)`, `TIME(6)`, `TIMESTAMP(6)` với `DEFAULT` có 9 chữ số giây lẻ ở strict mode → **ghi kết quả** cho từng kiểu (kiểm tra sanity; hàm literal MySQL luôn cắt về 6 chữ số theo R15); literal 6 chữ số → được nhận.
  15. Cột `AUTO_INCREMENT` không đứng đầu khóa hay index nào (gồm khóa chính `(a, id)` với `id` đứng sau) → bị từ chối (lỗi 1075); thêm `INDEX` thường một cột cho nó → được nhận (R8, R14).
  16. Bảng `id INT, v VARCHAR(16383)` → bị từ chối (lỗi 1118, dòng quá 65 535 byte); cùng bảng với `v LONGTEXT` → được nhận (R13).
  17. `TIMESTAMP(6) DEFAULT '2026-01-02 03:04:05.123456-00:00'` (độ lệch `-00:00`, literal `timestamptz` của phần 2 cho phép) → **ghi kết quả**. Kỳ vọng được nhận như probe 10. Nếu bị từ chối: probe vẫn ghi kết quả thật (không đỏ), và orchestrator tạo task tiếp theo sửa `generators/shared/sql-literals.ts` (file của Task 7) để hàm literal MySQL của `timestamptz` đổi hậu tố `Z` và `-00:00` thành `+00:00`, chạy trước Task 15 và mọi task dùng literal MySQL (17, 18, 22).
  18. Hai cặp cột trong một bảng: `ßa`/`sa` và `ða`/`da` → **ghi kết quả** cho từng cặp (MySQL so định danh theo `utf8mb3_general_ci`, R12). Kỳ vọng hiện tại: được nhận (danh sách gộp của R12 chỉ có `đ`, `ø`, `ł`, `ħ`). Nếu cặp nào bị từ chối (hai tên bị coi là một): probe vẫn ghi kết quả thật (không đỏ), và orchestrator tạo task tiếp theo thêm ký tự đó vào danh sách gộp của R12 trong `generators/shared/name-allocator.ts` (file của Task 6, cùng test của nó), chạy trước Task 15, 17, 18.
- `probes/sqlserver.probe.test.ts`:
  1. Một batch gồm `CREATE TABLE`, `DECLARE @schema_name sysname = SCHEMA_NAME();` và `EXEC sys.sp_addextendedproperty … @level0name = @schema_name …` → được nhận (Vấn đề 9).
  2. `MS_Description` 3750 ký tự `nvarchar` → được nhận; 3751 → bị từ chối (Vấn đề 2).
  3. Cột `time` và `datetime2` mặc định có 7 chữ số giây lẻ → được nhận; 8 chữ số → bị từ chối (Vấn đề 8).
  4. Khóa ngoại tham chiếu cột chỉ có unique index lọc → bị từ chối; tham chiếu `UNIQUE` thường trên cột nullable → được nhận; `UNIQUE` thường chỉ nhận một dòng `NULL`.
  5. Vòng cascade giữa hai bảng, hai đường cascade tới một bảng, và tự tham chiếu `ON DELETE CASCADE` → mỗi trường hợp bị từ chối; cùng cấu trúc với `NO ACTION` → được nhận (spec "Phát hiện vòng cascade").
  6. `ON DELETE RESTRICT` → lỗi cú pháp (xác nhận ánh xạ `restrict` → `NO ACTION`).
  7. Khóa chính `nvarchar(450)` → được nhận; index trên `nvarchar(1000)` → được nhận (chỉ cảnh báo).
  8. Khóa chính `nchar(451)` → bị từ chối (Msg 1944, quá 900 byte); ràng buộc unique `nchar(851)` → bị từ chối (quá 1700 byte); cùng hai khóa với `nvarchar(451)`, `nvarchar(851)` → được nhận (R1).
  9. Khóa ngoại `nchar(500)` tham chiếu khóa chính `nvarchar(500)` → bị từ chối (Msg 1778 hoặc 1753); khóa ngoại `nvarchar(500)` → được nhận (R10).

**Turborepo và script root:**

- `turbo.json` thêm task `"test:conformance": { "dependsOn": ["^build"], "outputs": [], "passThroughEnv": ["DOCKER_HOST", "DOCKER_CONTEXT", "TESTCONTAINERS_HOST_OVERRIDE", "TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE", "TESTCONTAINERS_RYUK_DISABLED"] }`. Có cache như spec mục 7 ghi: commit không đổi core hay package conformance thì không chạy lại. Biến môi trường của Docker được truyền qua vì Turborepo lọc biến môi trường ở chế độ strict.
- `package.json` root thêm script `"test:conformance": "turbo run test:conformance"`, đặt sau `"test"`.

**Test viết trước:** `fixtures.test.ts`: `lists the four fixtures in order`; `replaces every custom type with the dialect type` (`it.each` ba dialect); `replaces a custom literal default with the dialect literal`; `leaves the original fixture unchanged`; `returns a schema without semantic issues`. `typecheck.test.ts`: `returns no diagnostics for a strict module that imports zod`; `reports a type error`; `reports an unresolved import`. `prisma-cli.test.ts`: `validates a minimal postgresql schema with exit code 0`; `returns a non-zero exit code and the error for an invalid schema`. Probe như trên.

**Kiểm tra:**

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
docker info >/dev/null && echo docker-ok
pnpm test:conformance
pnpm --filter @schemaforge/codegen-conformance typecheck
pnpm --filter @schemaforge/codegen-conformance lint
pnpm typecheck && pnpm lint && pnpm test
pnpm exec prettier --check packages/codegen-conformance turbo.json package.json
git status --porcelain
```

Mong đợi: `pnpm test:conformance` build core rồi chạy mọi test của package, tất cả pass; chạy lần hai báo cache hit. Execution log của task có mục **Kết quả probe** liệt kê từng probe với kết quả thật (được nhận hoặc lỗi kèm mã lỗi), riêng probe MySQL 10, 14, 17 và 18 ghi rõ kết quả quan sát được. Probe 17, 18 là probe ghi kết quả: kết quả khác kỳ vọng không làm task `Bị chặn` mà ghi vào mục **Ghi chú cho người tiếp theo** của log, kèm việc tiếp theo tương ứng nêu ở probe 17, 18. Probe nào khác kỳ vọng thì không sửa kỳ vọng: dừng với trạng thái `Bị chặn`, ghi điểm khác biệt; orchestrator cho sửa spec trước khi chạy Task 15, 16.

**Commit:** `test: add conformance helpers and database behavior probes`

## Task 36: Hai issue mới của phần 2 và bản dịch

**Mục tiêu:** schema có bảng không có cột, hoặc có index trùng tên một bảng, không còn là schema hợp lệ: `validateSchema` báo `table-columns-empty` và `index-name-conflicts-table`, editor hiện thông báo đã dịch, và gợi ý tên index không tự tạo issue mới (spec phần 6, mục "Quyết định bổ sung 2026-10-02", Vấn đề 10, 12; spec phần 2 mục 8 được cập nhật ở Task 35).

**Phụ thuộc:** P2-26. **Đợt:** 1. Phải merge trước Task 4, 14, 15, 16, 17, 34.

**Loại:** liên package (core và frontend trong một commit, vì `frontend/src/lib/i18n/locales/en/issues.ts` dùng `satisfies Record<IssueCode, string>`: thêm mã ở core mà chưa dịch thì frontend không biên dịch được).

**File sở hữu:**

- Sửa `packages/core/src/validation/issue-codes.ts`, `issue-codes.test.ts`, `validate-schema.ts`, `validate-schema.test.ts`, `rules/names.ts`, `rules/names.test.ts`; tạo `packages/core/src/validation/rules/tables.ts`, `rules/tables.test.ts`.
- Sửa `packages/core/src/operations/suggest-index-name.ts`, `suggest-index-name.test.ts`.
- Sửa `frontend/src/lib/i18n/locales/en/issues.ts`, `frontend/src/lib/i18n/locales/vi/issues.ts`.
- Chỉ khi một test có sẵn đỏ vì schema thử của nó có bảng không cột hoặc index trùng tên bảng: sửa file test đó trong `packages/core/src/` hoặc `frontend/src/`, ưu tiên thêm một cột hay đổi tên index trong dữ liệu thử thay vì đổi kỳ vọng; liệt kê từng file trong execution log. Không sửa file nguồn nào khác.

**Chữ ký và hành vi:**

- `ISSUE_CODES` từ 25 lên 27 mã: thêm `"index-name-conflicts-table"` ngay sau `"index-name-duplicate"`, và `"table-columns-empty"` ngay sau `"subject-area-name-duplicate"`, trước `"enum-values-empty"` (spec phần 6, mục "Vấn đề với các spec đã duyệt", dòng 1).
- `rules/tables.ts`: `export function validateTables(schema: SchemaDocument): readonly Issue[]`: mỗi bảng có `columnIds` rỗng một issue `{ code: "table-columns-empty", path: ["tables", table.id, "columnIds"] }`. `validate-schema.ts` gọi thêm `validateTables(schema)`; kết quả vẫn đi qua `sortByPathThenCode`.
- `rules/names.ts`: hàm mới `findIndexTableConflicts(schema)` gọi trong `validateNames`: index có `toNameKey(index.name)` khác rỗng và bằng `toNameKey` tên của một bảng bất kỳ → `{ code: "index-name-conflicts-table", path: ["indexes", index.id, "name"] }`. Chỉ index bị báo, bảng không bị báo (spec: tên bảng không đổi, người dùng đổi tên index). Index trùng tên enum không bị báo (PostgreSQL để index và kiểu ở hai không gian tên khác nhau). Tên rỗng không so (đã có `name-empty`).
- `suggestIndexName`: tập tên đã dùng gồm tên mọi index và tên mọi bảng (cùng `toNameKey`), nên tên gợi ý không bao giờ trùng tên bảng. Thêm một dòng vào JSDoc. Không đổi chữ ký.
- `en/issues.ts`: `"index-name-conflicts-table": "Index “{{index}}” has the same name as a table."`, `"table-columns-empty": "Table “{{table}}” has no columns."`. `vi/issues.ts`: `"index-name-conflicts-table": "Index “{{index}}” trùng tên với một bảng."`, `"table-columns-empty": "Bảng “{{table}}” chưa có cột nào."`. Đặt theo đúng thứ tự của `ISSUE_CODES`. Biến nội suy chỉ dùng `index`, `table` (đã có trong `DOCUMENTED_VARIABLES` của `issue-and-error-messages.test.ts`, và `resolveIssueTarget` điền được hai biến này cho đường dẫn `["indexes", id, …]`, `["tables", id, …]`).

**Test viết trước:**

- `issue-codes.test.ts`: đổi tên và nội dung thành `lists the twenty-seven issue codes from the spec without duplicates` (danh sách đủ 27 mã, `new Set(...).size` là 27).
- `tables.test.ts`: `reports a table without columns at its columnIds path`; `reports nothing for a table with one column`; `reports every empty table`.
- `names.test.ts`: `reports an index named like a table at the index name path`; `compares index and table names without regard to case`; `does not report the table`; `does not report an index named like an enum`; `does not report an empty index name as a table conflict`.
- `validate-schema.test.ts`: `reports table-columns-empty and index-name-conflicts-table through validateSchema`; test "mẫu không có issue" có sẵn vẫn pass.
- `suggest-index-name.test.ts`: `skips a candidate that equals a table name`; `skips a table name that differs only in case`.
- Frontend: `issue-and-error-messages.test.ts` đã duyệt mọi `ISSUE_CODES` theo hai locale, nên tự kiểm tra hai bản dịch mới; không cần test mới. Chạy để thấy đỏ trước khi thêm bản dịch (sau khi build core).

**Kiểm tra:** như mục "Quy ước chung" cho core, thêm:

```bash
pnpm --filter @schemaforge/core build
pnpm --filter @schemaforge/frontend typecheck
pnpm --filter @schemaforge/frontend lint
pnpm --filter @schemaforge/frontend test
pnpm --filter @schemaforge/backend typecheck
pnpm exec prettier --check frontend/src/lib/i18n/locales/en/issues.ts frontend/src/lib/i18n/locales/vi/issues.ts
```

Mong đợi: mọi lệnh thoát mã 0; frontend test không có dòng ngưỡng coverage bị vi phạm; `git status --porcelain` chỉ có file của task.

**Commit:** `feat: add empty table and index name conflict issues`

## Task 17: CG-02 Prisma schema

**Mục tiêu:** `@schemaforge/core/generators/prisma` export `generatePrisma`, in `schema.prisma` cho Prisma 7 với ba provider, cùng kiểu đích, ràng buộc bị bỏ và hành động như CG-01 cùng dialect (spec CG-02, mục 3 bảng "Prisma", mục 4 ma trận cột Prisma, mục 5 "Định danh code", "Tên ràng buộc do generator đặt", "Tên trường quan hệ").

**Phụ thuộc:** Task 1, 4, 5, 7, 9, 11, 12, 13 (test so khớp với `buildSqlDdlModel`), 36. **Đợt:** 5.

**File sở hữu (tạo):** `packages/core/src/generators/prisma/index.ts`, `generate-prisma.ts`, `generate-prisma.test.ts`, `prisma-field-type.ts`, `prisma-field-type.test.ts`, `prisma-model.ts`, `prisma-model.test.ts`; `packages/core/src/generators/shared/sqlserver-enum-length.ts`, `sqlserver-enum-length.test.ts` (dùng chung với Task 16, xem "Điểm nóng"); mọi file trong `packages/core/src/generators/__snapshots__/prisma/`. Vượt 300 dòng thì tách thêm `prisma-<phần>.ts` kèm test trong cùng thư mục.

**Chữ ký:**

```ts
export type PrismaOptions = GeneratorOptions["prisma"];
export function generatePrisma(schema: SchemaDocument, options: PrismaOptions): GenerateResult;
// Không export qua index.ts:
export const PRISMA_RESERVED_WORDS: readonly string[]; // String, Boolean, Int, BigInt, Float, Decimal, DateTime, Json, Bytes, Unsupported, PrismaClient
export function formatPrismaString(value: string): string; // JSON.stringify(value)
export function renderPrismaFieldType(input: {
  readonly provider: SqlDialect; readonly column: Column; readonly type: DialectColumnType;
  readonly enumNames: ReadonlyMap<EnumId, string>; readonly enums: SchemaDocument["enums"];
}): { readonly typeName: string; readonly nativeAttribute: string | null; readonly diagnostics: readonly GeneratorDiagnostic[] };
```

`generators/shared/sqlserver-enum-length.ts` (Task 16 import, không export qua `index.ts` nào):

```ts
export const SQLSERVER_MAX_NVARCHAR_LENGTH = 4000;
export function sqlServerEnumLength(values: readonly string[]): number | null; // null là nvarchar(max)
```

Độ dài giá trị dài nhất theo code unit UTF-16 (`value.length`, đơn vị của `nvarchar`), tối thiểu 1 (enum rỗng hoặc chỉ có giá trị rỗng); lớn hơn `SQLSERVER_MAX_NVARCHAR_LENGTH` → `null` (Vấn đề 6).

`index.ts` chỉ export `generatePrisma` và type `PrismaOptions`. `file` là `{ fileName: "schema.prisma", language: "prisma", content }`. `provider` ngoài ba dialect là lỗi lập trình: throw `RangeError`.

**Chuẩn bị (trong `generatePrisma`):** `types` từ `resolveSchemaColumnTypes(schema, provider)` (import từ `generators/shared/dialect-column-types.ts`) (không gọi `resolveDialectColumnType` trực tiếp); `dropped` từ `findUnindexableConstraints(schema, provider, types.types)`; `constraintNames` từ `allocateConstraintNames(schema, (relation) => orderColumnPairsByReferencedKey(schema, relation))` (chỉ dùng `autoIncrementIndexes`); MySQL thêm `allocateMysqlNames(schema)`; SQL Server thêm `findCascadeConflicts(schema)`; `allocateModelNames(schema, PRISMA_RESERVED_WORDS)`; `buildRelationFieldNames(schema, tableNames)`. Diagnostic của mọi bước gộp lại rồi qua `finalizeDiagnostics`. Tên cột trong database (cho `@map`) lấy qua một hàm tra cứu duy nhất: tên MySQL đã đổi, hoặc tên gốc.

**Kiểu (`renderPrismaFieldType`)**, đúng bảng spec mục 3 "Prisma" trên `DialectColumnType` đã qua quy tắc dialect:

- `smallint` → `Int` + `@db.SmallInt`; `integer` → `Int`; `bigint` → `BigInt`; `decimal` → `Decimal` + `@db.Decimal(p, s)` (p, s đã kẹp); `real` → `Float` + `@db.Real` (MySQL `@db.Float`); `double` → `Float`; `boolean` → `Boolean`.
- `char(n)` → `String` + `@db.Char(n)` (SQL Server `@db.NChar(n)`); `varchar(n)` → `String` + `@db.VarChar(n)` (SQL Server `@db.NVarChar(n)`); `keyText` → MySQL `@db.VarChar(255)`, SQL Server `@db.NVarChar(450)`; `text` → PostgreSQL `String` không native, MySQL `@db.LongText`, SQL Server `@db.NVarChar(Max)`.
- `uuid` → `String` + `@db.Uuid` / `@db.Char(36)` / `@db.UniqueIdentifier`; `date` → `DateTime @db.Date`; `time` → `@db.Time(6)` (SQL Server `@db.Time`); `timestamp` → `@db.Timestamp(6)` / `@db.DateTime(6)` / `@db.DateTime2`; `timestamptz` → `@db.Timestamptz(6)` / `@db.Timestamp(6)` / `@db.DateTimeOffset`.
- `json` → `Json`; SQL Server → `String` + `@db.NVarChar(Max)` kèm `type-not-supported` tại `["columns", id, "type"]`.
- `binary` → `Bytes` (MySQL thêm `@db.LongBlob`).
- `enum` → PostgreSQL, MySQL: tên enum Prisma từ `enumNames` (enum không tìm thấy → `String`). SQL Server: `String` + `@db.NVarChar(n)` với `n = sqlServerEnumLength(values)` của `generators/shared/sqlserver-enum-length.ts` (`null` → `@db.NVarChar(Max)` kèm `type-parameter-out-of-range`), luôn kèm `enum-not-supported` tại `["columns", id, "type"]`. Hàm nằm trong `shared/` để Prisma `sqlserver` và SQL Server SQL (Task 16) cùng một quy tắc, vì cấm import giữa các thư mục đích.
- `custom` → `Unsupported(<formatPrismaString(name)>)`, không native, không có `custom-type-unsafe` (tên nằm trong chuỗi đã escape).
- Cột nullable thêm `?` sau tên kiểu.

**Giá trị mặc định** của trường cột (thuộc tính `@default(…)`):

- `isAutoIncrement` → `autoincrement()`, bỏ qua `defaultValue`.
- `findDefaultValueProblem(column.type, column.defaultValue, schema.enums)` (Task 7) khác `null` → không ghi, kèm `default-omitted` tại `["columns", id, "defaultValue"]`.
- `currentTimestamp` → `now()`; `generateUuid` → `uuid()`.
- `literal`, xét theo thứ tự, quy tắc đầu tiên khớp thắng:
  1. `provider` là `mysql` và kiểu đích đã phân giải (`DialectColumnType.kind` từ `types`) là `text`, `json` hoặc `binary` (gồm cột `char`, `varchar` đã thành `LONGTEXT` theo R13) → `dbgenerated(<formatPrismaString(sql)>)` với `sql` của `formatSqlDefault({ dialect: "mysql", column, enums: schema.enums, shouldParenthesizeLiteral: true })`, tức literal trong ngoặc như `('a''b')` (spec R19: MySQL chỉ nhận mặc định dạng biểu thức trong ngoặc trên TEXT, JSON, BLOB, và `prisma validate` không bắt lỗi này). Cùng quy tắc chọn ngoặc với Task 13, 18.
  2. `real`, `double` mà literal chứa `e` hoặc `E` → `dbgenerated(<formatPrismaString(formatSqlLiteral(provider, column.type, value))>)`, vì `prisma validate` 7.10 từ chối `@default(1e10)` (P1012).
  3. `smallint`, `integer`, `bigint`, `decimal`, `real`, `double` còn lại ghi trần; `boolean` → `true`/`false`; `char`, `varchar`, `text`, `uuid`, `json` → `formatPrismaString(value)`; enum → PostgreSQL, MySQL là tên giá trị enum đã cấp (bên dưới), SQL Server là `formatPrismaString(value)`.
  4. `date`, `time`, `timestamp`, `timestamptz` và `custom` → `dbgenerated(<formatPrismaString(formatSqlLiteral(provider, column.type, value))>)` (Prisma không có literal cho các kiểu này; literal SQL dùng chung Task 7 nên giây lẻ được cắt như CG-01).

**Enum** (chỉ PostgreSQL, MySQL; SQL Server không có khối `enum`), theo `sortEnums`:

```prisma
enum OrderStatus {
  pending
  daGiao @map("đã giao")

  @@map("order_status")
}
```

- Tên giá trị: mỗi enum một allocator `comparison: "exact"`, `separator: ""`; giá trị khớp `^[A-Za-z][A-Za-z0-9_]*$` giữ nguyên, còn lại `toCamelCaseIdentifier(value, "value")`; cấp theo thứ tự `values`; tên cấp khác giá trị gốc thì thêm ` @map(<formatPrismaString(giá trị gốc)>)`. `@@map` chỉ khi tên Prisma khác tên gốc, cách dòng giá trị cuối một dòng trống.

**Model**, theo `sortTables`; dòng trống giữa nhóm trường và nhóm thuộc tính khối:

1. Comment bảng: `///` mỗi dòng (tách theo `\r\n`, `\r`, `\n`; dòng rỗng ghi `///`), đứng trên `model`. Comment cột tương tự, thụt hai khoảng, đứng trên trường.
2. Trường cột theo `columnIds`: `<tên trường> <kiểu>[?] [@id] [@unique] [@default(…)] [@map(…)] [@db.…]`, các phần cách nhau một khoảng trắng, không căn cột. `@id` khi khóa chính một cột còn giữ. `@unique` khi cột `isUnique` không nằm trong `dropped.uniqueColumnIds`; SQL Server thêm `unique-nulls-restricted` tại `["columns", id, "isUnique"]` khi cột nullable. `@map` khi tên trường khác tên cột trong database.
3. Trường phía khóa ngoại của mọi quan hệ có `fromTableId` là bảng này (theo `sortRelations`, bỏ quan hệ trong `dropped.relationIds`): `<trường> <Model đích>[?] @relation([<formatPrismaString(tên quan hệ)>, ]fields: [a, b], references: [x, y], onDelete: <A>, onUpdate: <B>)`. Cặp cột theo `orderColumnPairsByReferencedKey`. `?` khi có ít nhất một cột nguồn nullable. Hành động: SQL Server, quan hệ trong `findCascadeConflicts` → cả hai `NoAction` kèm `referential-action-cycle` tại `["relations", id]`; còn lại `resolveReferentialAction(provider, action)`, `isLossy` → `referential-action-not-supported` tại `["relations", id, "onDelete"]` hoặc `"onUpdate"`. Tên hành động: `NoAction`, `Restrict`, `Cascade`, `SetNull`, `SetDefault`.
4. Trường phía ngược của mọi quan hệ có `toTableId` là bảng này (theo `sortRelations`, cùng điều kiện bỏ): `oneToMany` → `<trường> <Model nguồn>[]`, `oneToOne` → `<trường> <Model nguồn>?`; thêm `@relation(<formatPrismaString(tên quan hệ)>)` khi quan hệ có tên. Quan hệ tự tham chiếu cho hai trường trong cùng model (phía khóa ngoại ở bước 3, phía ngược ở bước 4).
5. Thuộc tính khối theo thứ tự: `@@id([…])` khi khóa chính nhiều cột còn giữ (trường theo `primaryKeyColumnIds`); `@@unique([…], map: "…")` cho index unique của người dùng không bị bỏ, theo `sortIndexes`; `@@index([…], map: "…")` cho index thường không bị bỏ, theo `sortIndexes`, rồi (chỉ MySQL) cho mỗi cột trong `dropped.autoIncrementIndexColumnIds` một `@@index([<trường>], map: "<autoIncrementIndexes của cột>")` (R14); `@@map(<tên gốc>)` khi tên model khác tên bảng; `@@ignore` theo quy tắc dưới. Tên `map:` của index người dùng là tên MySQL đã đổi hoặc tên gốc, qua `formatPrismaString`. SQL Server: index unique có cột nullable thêm `unique-nulls-restricted` tại `["indexes", id]`.

**Model không định danh được (`table-without-identifier`):** model có định danh khi còn một trong các khóa sau, mọi cột của khóa đều không nullable và không phải `custom`: khóa chính không bị bỏ; cột `isUnique` không bị bỏ; index unique không bị bỏ. Không có → `@@ignore` kèm `table-without-identifier` tại `["tables", id]`. Bảng không có cột (schema có issue `table-columns-empty`) theo cùng quy tắc nên có `@@ignore` (R6). Trường quan hệ (bước 3, 4) mà model ở đầu kia có `@@ignore` và model chứa trường không có `@@ignore` thì thêm ` @ignore` ở cuối dòng; trong model đã `@@ignore` thì không thêm (Prisma cảnh báo thuộc tính thừa).

**Output** ghép bằng `renderFileContent`, mỗi block một khối theo thứ tự: khối `generator client` (hai dòng `provider = "prisma-client"`, `output = "../src/generated/prisma"`, thụt hai khoảng, không căn `=`); khối `datasource db` (`provider = "<provider>"`, không có `url`); mỗi enum; mỗi model. Không có comment đầu file hay thời gian.

**Test viết trước:**

- `sqlserver-enum-length.test.ts`: `sizes by the longest value in UTF-16 code units` (gồm một ký tự ngoài BMP tính 2); `returns 1 for an enum without values or with only empty values`; `returns 4000 for a value of exactly 4000 code units and null above`.
- `prisma-field-type.test.ts`: `maps every dialect column type for each provider` (`it.each` theo bảng spec mục 3); `uses NChar and NVarChar on sqlserver`; `maps a narrowed key text to VarChar(255) on mysql and NVarChar(450) on sqlserver`; `maps json to NVarChar(Max) on sqlserver and reports type-not-supported`; `maps an enum to NVarChar sized by its longest value on sqlserver and reports enum-not-supported`; `uses NVarChar(Max) for an enum value longer than 4000 code units and reports type-parameter-out-of-range`; `writes a custom type as Unsupported with an escaped name`; `appends a question mark to a nullable column type`; `references the allocated enum name on postgresql and mysql`.
- `prisma-model.test.ts`: `writes column fields in column order with id, unique, default, map and native type`; `writes a composite primary key as @@id in key order`; `writes unique and plain user indexes with map names`; `writes forward relation fields before inverse relation fields`; `always writes both referential actions`; `orders relation fields and references by the referenced key`; `makes the forward field optional when a foreign key column is nullable`; `writes Model[] for one-to-many and Model? for one-to-one inverse fields`; `adds a relation name to both fields of a self-reference`; `adds a relation name for two relations between the same models`; `writes block attributes in the order id, unique, index, map, ignore`; `ignores a model without a required unique key and reports table-without-identifier`; `does not count a nullable or Unsupported unique as an identifier`; `ignores a model whose only key was dropped`; `ignores a model without columns`; `adds @ignore to a relation field that points to an ignored model`; `does not add @ignore inside an ignored model`; `writes table and column comments as triple-slash lines`; `maps an enum value that is not an identifier with @map`.
- `generate-prisma.test.ts`: `names the file schema.prisma with language prisma`; `writes the prisma-client generator and a datasource without url`; `writes the provider of the option`; `throws RangeError for an unknown provider`; `writes enums only for postgresql and mysql`; `suffixes a model named like a reserved word` (bảng `String` → `String_` kèm `@@map("String")`); `maps a model and field to the original names with @@map and @map`; `writes literal defaults by column type` (`it.each`: số, boolean, chuỗi có `"` và `\`, enum, json); `writes dbgenerated with the dialect sql literal for date, time and timestamp defaults` (gồm `time` 9 chữ số giây lẻ: SQL Server còn 7, MySQL còn 6); `writes an exponent real default as dbgenerated` (`it.each`: `real` `1e10` và `double` `-2.5E-3` trên ba provider, ví dụ `@default(dbgenerated("1e10"))`; `1.5` vẫn ghi trần); `writes a mysql default on longtext, json and a varchar widened to longtext as a parenthesized dbgenerated` (`it.each`: `text` `a'b` → `@default(dbgenerated("('a''b')"))`, `json` `{"a":1}`, cột `varchar(16000)` có mặc định nằm cạnh cột `varchar(15000)` để R13 đổi cột lớn nhất là nó sang `LONGTEXT`, dựng bằng factory; cùng cột trên `postgresql` vẫn là `@default("…")`); `omits an invalid default and reports default-omitted`; `writes autoincrement, now and uuid defaults`; `downgrades a cascade cycle to NoAction on sqlserver and reports referential-action-cycle`; `writes restrict as NoAction on sqlserver without a diagnostic`; `writes set default as NoAction on mysql and reports referential-action-not-supported`; `reports unique-nulls-restricted for every nullable unique on sqlserver`; `does not report unique-nulls-restricted on postgresql`; `drops json keys on mysql and sqlserver like the sql generators` (so `key-column-type-not-indexable` với tập của `buildSqlDdlModel` cùng dialect trên `createTargetLimitSchema()`); `narrows key columns like the sql generator of the same dialect` (so kiểu đích của các cột trong khóa với `resolveSchemaColumnTypes`); `adds an @@index named <table>_<column>_idx for a mysql auto-increment column that leads no key` (bảng có khóa chính `(tenant_id, id)` với `id` auto-increment đứng sau, không cột nào bị đổi kiểu; khẳng định thêm `diagnostics` rỗng: R14 là tương đương, không có mã); `renames a mysql column that differs only by an accent and reports identifier-collision-renamed`; `writes an empty schema as the generator and datasource blocks only`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture> with <provider>` (`it.each` bốn fixture × ba provider), tên file `<fixture>.<provider>.prisma` và `<fixture>.<provider>.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/prisma`, gọi `generatePrisma(testing.createSampleSchema(), { provider: "postgresql" })`, mong đợi `function schema.prisma`. Conformance của Prisma (`prisma validate`) do Task 30 viết; task sửa generator Prisma sau khi Task 30 đã merge chạy cổng conformance với `src/prisma.test.ts`.

**Commit:** `feat(core): add prisma schema generator`

## Task 18: CG-03 Drizzle schema

**Mục tiêu:** `@schemaforge/core/generators/drizzle` export `generateDrizzle`, in một file `schema.ts` cho `drizzle-orm` 0.45 với `dialect` là `postgresql` hoặc `mysql`, cùng tên ràng buộc, kiểu đích và ràng buộc bị bỏ như CG-01 cùng dialect (spec CG-03, mục 3 bảng "Drizzle", mục 4 ma trận cột Drizzle, mục 5, mục "Rủi ro" dòng Drizzle, R21 của mục "Quyết định bổ sung 2026-10-02"; Vấn đề 18).

**Phụ thuộc:** Task 1, 4, 5, 7, 9, 11, 12, 13 (test so khớp với `buildSqlDdlModel`), và Task 8 (`typecheckFiles` cho bước kiểm chứng sớm). **Đợt:** 5.

**File sở hữu (tạo):** `packages/core/src/generators/drizzle/index.ts`, `generate-drizzle.ts`, `generate-drizzle.test.ts`, `drizzle-columns.ts`, `drizzle-columns.test.ts`, `drizzle-names.ts`, `drizzle-names.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/drizzle/`. Vượt 300 dòng thì tách thêm `drizzle-<phần>.ts` kèm test. File thử ở bước kiểm chứng sớm nằm trong thư mục tạm của `withTempDirectory`, không commit.

**Bước kiểm chứng sớm (làm trước mọi test):** viết tay một file `schema.ts` PostgreSQL và một file MySQL theo đúng dạng output dưới đây, gồm hai bảng `a`, `b` mà khóa ngoại của `a` tham chiếu `b` (khai báo sau) và khóa ngoại của `b` tham chiếu `a` trong callback cấu hình, một bảng tự tham chiếu, `relations()` cho cả ba, một `customType`, một `pgEnum`. Chạy `typecheckFiles` của `packages/codegen-conformance/src/support/typecheck.ts` (Task 8) bằng một lệnh `pnpm --filter @schemaforge/codegen-conformance exec node --input-type=module -e '…'` hoặc một file test tạm không commit. Đồng thời đọc typings đã cài (`drizzle-orm/pg-core`, `drizzle-orm/mysql-core`, `drizzle-orm/relations.d.ts`) để xác nhận mọi builder, option dùng ở mục "Kiểu" và hai type `PgTableExtraConfigValue`, `MySqlTableExtraConfigValue`. Mọi callback cấu hình bảng trong file viết tay có chú thích kiểu trả về như mục 4 của "Cấu trúc file" (R21: bản không chú thích báo TS7022, TS7024 khi hai bảng tham chiếu nhau, nên đây là dạng output đã chốt). Kỳ vọng: typecheck không có diagnostic ở cả hai dialect. Còn diagnostic nào (kể cả TS7022, TS7024) hoặc builder, option, type nào không có thì dừng với trạng thái `Bị chặn`, ghi nguyên văn diagnostic vào execution log; không tự đổi cấu trúc output.

**Chữ ký:**

```ts
export type DrizzleOptions = GeneratorOptions["drizzle"];
export function generateDrizzle(schema: SchemaDocument, options: DrizzleOptions): GenerateResult;
// Không export qua index.ts:
export const DRIZZLE_IMPORT_NAMES: Readonly<Record<"postgresql" | "mysql", readonly string[]>>;
export type DrizzleVariableNames = {
  readonly enumVariables: ReadonlyMap<EnumId, string>;      // chỉ PostgreSQL
  readonly customTypeVariables: ReadonlyMap<string, string>; // khóa: dataType ("bytea", "longblob" hoặc tên kiểu custom)
  readonly tableVariables: ReadonlyMap<TableId, string>;
  readonly relationsVariables: ReadonlyMap<TableId, string>;
};
export function allocateDrizzleVariableNames(schema: SchemaDocument, dialect: "postgresql" | "mysql"): DrizzleVariableNames;
export function renderDrizzleColumn(input: {
  readonly dialect: "postgresql" | "mysql"; readonly column: Column; readonly columnName: string;
  readonly type: DialectColumnType; readonly names: DrizzleVariableNames; readonly enums: SchemaDocument["enums"];
}): { readonly expression: string; readonly builders: readonly string[]; readonly diagnostics: readonly GeneratorDiagnostic[] };
```

`index.ts` chỉ export `generateDrizzle` và type `DrizzleOptions`. `file` là `{ fileName: "schema.ts", language: "typescript", content }`. `dialect` khác `postgresql`, `mysql` (kể cả `sqlserver`) là lỗi lập trình: throw `RangeError`.

**Tên biến** (`allocateDrizzleVariableNames`): một allocator `comparison: "exact"`, `separator: ""`, `reserved` là `JAVASCRIPT_RESERVED_WORDS` cộng mọi tên trong `DRIZZLE_IMPORT_NAMES[dialect]`, `relations`, `sql`, và tên tham số của callback trong output: `table` (callback cấu hình bảng), `one`, `many` (callback của `relations()`); tham số callback che biến module cùng tên, nên bảng tên `table` sẽ làm `foreignKey` trỏ nhầm. Cả danh sách cố định, không chỉ tên được dùng, để tên biến không đổi khi schema đổi. Cấp theo thứ tự: enum (chỉ PostgreSQL, `sortEnums`) `toCamelCaseIdentifier(name, "enum") + "Enum"`; `customType` theo thứ tự xuất hiện đầu tiên (bảng theo `sortTables`, cột theo `columnIds`), `toCamelCaseIdentifier(dataType, "custom") + "Type"`; bảng (`sortTables`) `toCamelCaseIdentifier(name, "table")`; relations (`sortTables`, chỉ bảng có trường quan hệ) `<biến bảng> + "Relations"`. Mỗi ứng viên qua `withReservedWordSuffix` trước khi cấp. "Bảng có trường quan hệ" là bảng có ít nhất một trường thật sự được ghi vào block `relations()` theo mục 5 của "Cấu trúc file" bên dưới: trường phía khóa ngoại của quan hệ không bị bỏ, hoặc trường phía ngược được ghi; trường phía ngược của quan hệ 1-1 có tên bị bỏ theo Vấn đề 18 không tính, nên bảng chỉ có trường đó không có biến `…Relations` và không có block. `DRIZZLE_IMPORT_NAMES` gồm tên builder và tên type của callback cấu hình bảng (R21): PostgreSQL `PgTableExtraConfigValue`, `bigint`, `boolean`, `char`, `customType`, `date`, `doublePrecision`, `foreignKey`, `index`, `integer`, `jsonb`, `numeric`, `pgEnum`, `pgTable`, `primaryKey`, `real`, `smallint`, `text`, `time`, `timestamp`, `unique`, `uniqueIndex`, `uuid`, `varchar`; MySQL `MySqlTableExtraConfigValue`, `bigint`, `boolean`, `char`, `customType`, `date`, `datetime`, `decimal`, `double`, `float`, `foreignKey`, `index`, `int`, `json`, `longtext`, `mysqlEnum`, `mysqlTable`, `primaryKey`, `smallint`, `time`, `timestamp`, `unique`, `uniqueIndex`, `varchar`.

**Chuẩn bị:** `types` từ `resolveSchemaColumnTypes(schema, dialect)` (import từ `generators/shared/dialect-column-types.ts`); `dropped` từ `findUnindexableConstraints(schema, dialect, types.types)`; `constraintNames` từ `allocateConstraintNames(schema, (relation) => orderColumnPairsByReferencedKey(schema, relation))`; MySQL thêm `allocateMysqlNames(schema)`; `buildRelationFieldNames(schema, tableVariables)` cho key cột, trường quan hệ và `relationName`. Tên cột trong database lấy qua một hàm tra cứu duy nhất (tên MySQL đã đổi, hoặc tên gốc).

**Kiểu (`renderDrizzleColumn`)**, đúng bảng spec mục 3 "Drizzle"; tên cột luôn là đối số đầu, ghi bằng `JSON.stringify`:

- PostgreSQL: `smallint("c")`, `integer("c")`, `bigint("c", { mode: "bigint" })`, `numeric("c", { precision: p, scale: s })`, `real`, `doublePrecision`, `boolean`, `char("c", { length: n })`, `varchar("c", { length: n })`, `text`, `uuid`, `date`, `time("c", { precision: 6 })`, `timestamp("c", { precision: 6 })`, `timestamp("c", { precision: 6, withTimezone: true })`, `jsonb`, `binary` → biến `customType` có `dataType` `bytea`; enum → `<biến enum>("c")` (enum không tìm thấy → `text`).
- MySQL: `smallint`, `int`, `bigint("c", { mode: "bigint" })`, `decimal("c", { precision: p, scale: s })`, `float`, `double`, `boolean`, `char("c", { length: n })`, `varchar("c", { length: n })`, `keyText` → `varchar("c", { length: 255 })`, `text` → `longtext`, `uuid` → `char("c", { length: 36 })`, `date`, `time("c", { fsp: 6 })`, `timestamp` → `datetime("c", { fsp: 6 })`, `timestamptz` → `timestamp("c", { fsp: 6 })`, `json`, `binary` → biến `customType` có `dataType` `longblob`; enum → `mysqlEnum("c", [<giá trị qua JSON.stringify>])` (enum không tìm thấy → `longtext`).
- `custom` → biến `customType` có `dataType` là tên kiểu nguyên văn; không có `custom-type-unsafe` (tên nằm trong chuỗi đã escape). Kiểu `keyText` không xuất hiện ở PostgreSQL; nếu có thì như `varchar`.
- Phần nối sau builder, theo thứ tự: `.notNull()` khi không nullable; auto-increment: PostgreSQL `.generatedByDefaultAsIdentity()`, MySQL `.autoincrement()` (bỏ qua `defaultValue`); giá trị mặc định. Không dùng `.primaryKey()`, `.unique()`, `.references()` trên cột.
- `builders` trả tên builder đã dùng để `generate-drizzle.ts` ghép dòng import.

**Giá trị mặc định:**

- `findDefaultValueProblem` khác `null` → không ghi, kèm `default-omitted` tại `["columns", id, "defaultValue"]`.
- PostgreSQL `currentTimestamp` → `.defaultNow()`; PostgreSQL `generateUuid` → `.defaultRandom()`.
- Cách ghi literal chọn theo **kiểu đích đã phân giải** (`DialectColumnType.kind` của cột trong `types`), không theo `column.type`, để cột đổi kiểu theo quy tắc dialect (R13, hẹp khóa) nhận đúng dạng mặc định của kiểu thật trong database.
- Literal có API có kiểu: `smallint`, `integer` → `.default(<String(Number(value))>)`; `boolean` → `.default(true)`/`.default(false)`; `char`, `varchar`, `keyText`, `uuid`, `decimal`, `enum`, và `text` chỉ trên PostgreSQL → `.default(<JSON.stringify(value)>)`.
- Mọi trường hợp còn lại (MySQL `currentTimestamp`, `generateUuid`; literal `bigint`, `real`, `double`, `date`, `time`, `timestamp`, `timestamptz`, `json`, `binary`, `custom`; MySQL `text`) → `` .default(sql.raw(<JSON.stringify(defaultSql)>)) `` với `defaultSql` là `sql` của `formatSqlDefault({ dialect, column, enums, shouldParenthesizeLiteral })`. `shouldParenthesizeLiteral` đúng khi dialect là MySQL và kiểu đích là `text`, `json` hoặc `binary` (cùng quy tắc Task 13 và R19 của Prisma): MySQL `text` (gồm cột `char`, `varchar` đã thành `LONGTEXT` theo R13), `json`, `binary` luôn đi qua `sql.raw` với biểu thức trong ngoặc như `('a''b')`, vì MySQL chỉ nhận mặc định dạng biểu thức trên TEXT, JSON, BLOB. Literal MySQL được cắt giây lẻ về 6 chữ số (R15). Drizzle không có `null-character-removed` (spec mục 4: chỉ PostgreSQL SQL); cờ `hasRemovedNullCharacter` bị bỏ qua.

**Cấu trúc file**, ghép bằng `renderFileContent`, block theo thứ tự:

1. Import: `import { <builder đã dùng, sắp theo tên bằng < và >> } from "drizzle-orm/pg-core";` (hoặc `"drizzle-orm/mysql-core"`). Khi có ít nhất một bảng có callback cấu hình (mảng ràng buộc không rỗng), danh sách thêm `type PgTableExtraConfigValue` (PostgreSQL) hoặc `type MySqlTableExtraConfigValue` (MySQL); sắp theo tên không tính tiền tố `type `, nên với `<` tên type (chữ hoa đầu) đứng trước mọi builder: `import { type PgTableExtraConfigValue, bigint, foreignKey, pgTable } from "drizzle-orm/pg-core";`. Không bảng nào có callback thì không có tên type. Khi có dùng `relations` hoặc `sql`: `import { relations, sql } from "drizzle-orm";` chỉ với tên được dùng. Mỗi import một dòng.
2. Enum (PostgreSQL), mỗi enum một dòng: `export const orderStatusEnum = pgEnum("order_status", ["pending", "paid"]);`.
3. Mỗi `customType` một block: `export const byteaType = customType<{ data: Uint8Array }>({ dataType() { return "bytea"; } });` viết nhiều dòng như Prettier; `data` là `Uint8Array` cho `bytea`, `longblob`, `unknown` cho kiểu custom; `dataType` trả `JSON.stringify(dataType)`.
4. Mỗi bảng một block: JSDoc của comment bảng (`formatJsDocLines(comment, "")`), rồi

   ```ts
   export const posts = pgTable(
     "posts",
     {
       /** Tác giả */
       authorId: bigint("author_id", { mode: "bigint" }).notNull(),
     },
     (table): PgTableExtraConfigValue[] => [
       primaryKey({ name: "posts_pkey", columns: [table.id] }),
       unique("posts_slug_key").on(table.slug),
       uniqueIndex("posts_tenant_slug").on(table.tenantId, table.slug),
       index("posts_created_at").on(table.createdAt),
       foreignKey({ name: "posts_author_id_fkey", columns: [table.authorId], foreignColumns: [users.id] })
         .onDelete("cascade")
         .onUpdate("no action"),
     ],
   );
   ```

   Callback luôn chú thích kiểu trả về, ở mọi bảng có callback, không chỉ bảng nằm trong vòng khóa ngoại (R21): `(table): PgTableExtraConfigValue[] => [` cho PostgreSQL, `(table): MySqlTableExtraConfigValue[] => [` cho MySQL (`mysqlTable`). Key cột là `columnFieldNames` của Task 11 (ghi trần, đã là định danh ASCII), comment cột là JSDoc thụt bốn khoảng. Callback gồm theo thứ tự: `primaryKey` khi khóa chính còn giữ (kể cả một cột, `columns` theo `primaryKeyColumnIds`, tên từ `primaryKeys`); `unique(<tên>).on(…)` cho cột `isUnique` không bị bỏ, theo `columnIds`; index người dùng không bị bỏ theo `sortIndexes` (`uniqueIndex` hoặc `index`, tên MySQL đã đổi hoặc tên gốc); chỉ MySQL, `index(<autoIncrementIndexes của cột>).on(table.<key>)` cho mỗi cột trong `dropped.autoIncrementIndexColumnIds` (R14); `foreignKey` cho quan hệ có `fromTableId` là bảng này, theo `sortRelations`, bỏ quan hệ trong `dropped.relationIds`, cặp cột theo `orderColumnPairsByReferencedKey`, `foreignColumns` dùng `table.<key>` khi tự tham chiếu và `<biến bảng đích>.<key>` khi khác bảng. Hành động: `resolveReferentialAction(dialect, action)` (`isLossy` → `referential-action-not-supported` tại đường dẫn sự kiện), ghi `"no action"`, `"restrict"`, `"cascade"`, `"set null"`, `"set default"`. Mảng rỗng thì không có tham số callback. Tên ràng buộc và tên index ghi bằng `JSON.stringify`.
5. Mỗi bảng có trường quan hệ (định nghĩa ở mục "Tên biến": có ít nhất một trường được ghi) một block `relations()` theo `sortTables`:

   ```ts
   export const postsRelations = relations(posts, ({ one, many }) => ({
     author: one(users, { fields: [posts.authorId], references: [users.id] }),
     comments: many(comments),
   }));
   ```

   Trường theo thứ tự của Task 17: mọi trường phía khóa ngoại (quan hệ có `fromTableId` là bảng này, theo `sortRelations`, không bị bỏ) rồi mọi trường phía ngược. Phía khóa ngoại: `one(<đích>, { fields: […], references: […][, relationName: "…"] })`. Phía ngược: `oneToMany` → `many(<nguồn>[, { relationName: "…" }])`; `oneToOne` → `one(<nguồn>)` khi quan hệ không có tên; quan hệ `oneToOne` có tên thì **không ghi trường phía ngược** (Vấn đề 18: `RelationConfig` của `one` trong `drizzle-orm` 0.45 bắt buộc `fields`, nên không truyền được `relationName` một mình; phía khóa ngoại có `fields` đã đủ cho relational query). Destructure chỉ `one`, `many` được dùng. Tên quan hệ ghi bằng `JSON.stringify`.

Không có comment đầu file hay thời gian. Bảng không có cột: `pgTable("t", {})`.

**Test viết trước:**

- `drizzle-names.test.ts`: `suffixes enum variables with Enum and custom type variables with Type`; `allocates enums, custom types, tables, then relations`; `appends an underscore to a JavaScript reserved word` (bảng `default`); `appends 2 to a table named like a builder import` (bảng `index` → `index2`, vì tên import nằm trong `reserved`); `appends 2 to a table named like a callback parameter` (`it.each`: bảng `table` → `table2`, `one` → `one2`, `many` → `many2`); `reserves the full import list even when a builder is unused`; `returns the same names regardless of map key order`.
- `drizzle-columns.test.ts`: `renders every dialect column type for postgresql` (`it.each`); `renders every dialect column type for mysql` (`it.each`); `uses bigint mode bigint on both dialects`; `uses a customType for binary columns`; `uses mysqlEnum with escaped values on mysql`; `appends notNull, identity and autoincrement`; `uses typed defaults where drizzle has them` (`it.each`); `uses sql.raw with the dialect literal for other defaults` (`it.each`, gồm MySQL `CURRENT_TIMESTAMP(6)`, `(UUID())`, `time` 9 chữ số giây lẻ còn 6); `parenthesizes a mysql literal default on longtext and json`; `uses sql.raw for a mysql varchar widened to longtext` (cột `varchar(16000)` có mặc định cạnh cột `varchar(15000)`, R13 đổi nó sang `longtext`: output `.default(sql.raw("('…')"))`, không phải `.default("…")`); `uses a typed default for a text key column narrowed to varchar on mysql` (kiểu đích `keyText`); `omits an invalid default and reports default-omitted`; `reports the type diagnostics of the dialect rules`.
- `generate-drizzle.test.ts`: `names the file schema.ts with language typescript`; `throws RangeError for sqlserver`; `imports only used builders sorted by name` (`it.each` hai dialect: tên type `PgTableExtraConfigValue` hoặc `MySqlTableExtraConfigValue` có tiền tố `type ` và đứng đầu khi có callback cấu hình; schema chỉ có bảng không ràng buộc nào thì không import tên type); `annotates every table config callback with the dialect extra config type` (`it.each` hai dialect, schema có hai bảng tham chiếu nhau, một bảng tự tham chiếu, một bảng không vòng: mọi callback là `(table): PgTableExtraConfigValue[] => [` hoặc `(table): MySqlTableExtraConfigValue[] => [`, không còn `(table) => [`); `imports sql and relations from drizzle-orm only when used`; `declares enums and custom types before tables`; `writes every primary key with its constraint name`; `writes unique, index, unique index and foreign key constraints in the table callback`; `uses the same constraint names as the sql ddl model` (so với `buildSqlDdlModel` cùng dialect trên `createSampleSchema()`); `references the table parameter for a self-referencing foreign key`; `writes set default as no action on mysql and reports referential-action-not-supported`; `drops json keys on mysql and reports key-column-type-not-indexable`; `adds an index named <table>_<column>_idx for a mysql auto-increment column that leads no key` (bảng có khóa chính `(tenant_id, id)` với `id` auto-increment đứng sau, không cột nào bị đổi kiểu; khẳng định thêm `diagnostics` rỗng: R14 là tương đương, không có mã); `renames a mysql column that differs only by an accent`; `writes relations with one, many and relation names`; `omits the inverse field of a named one-to-one relation`; `writes no relations block for a table whose only field is an omitted named one-to-one inverse` (không có biến `…Relations` của bảng đó, `relations` vẫn được import nếu bảng khác dùng); `writes table and column comments as JSDoc`; `escapes a comment terminator in JSDoc`; `writes an empty schema as a single newline`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture> with <dialect>` (`it.each` bốn fixture × `postgresql`, `mysql`), file `<fixture>.<dialect>.ts` và `.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/drizzle`, gọi `generateDrizzle(testing.createSampleSchema(), { dialect: "postgresql" })`, mong đợi `function schema.ts`. Ghi kết quả bước kiểm chứng sớm vào execution log. Typecheck đầy đủ output do Task 30 viết; task sửa generator Drizzle sau khi Task 30 đã merge chạy cổng conformance với `src/drizzle.test.ts`.

**Commit:** `feat(core): add drizzle schema generator`

## Task 19: CG-04 TypeScript types

**Mục tiêu:** `@schemaforge/core/generators/typescript` export `generateTypeScript`, in `types.ts` mô tả dòng dữ liệu JSON của từng bảng theo biểu diễn JSON chung (spec CG-04, mục 3 "Biểu diễn JSON…", mục 4 "Ma trận cho các đích còn lại" cột TypeScript, mục 5 "Định danh code").

**Phụ thuộc:** Task 1, 4, 5, 10, 11 (`allocateModelNames`). **Đợt:** 4.

**File sở hữu (tạo):** `packages/core/src/generators/typescript/index.ts`, `generate-typescript.ts`, `generate-typescript.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/typescript/`.

**Chữ ký:**

```ts
export type TypeScriptOptions = GeneratorOptions["typescript"];
export function generateTypeScript(schema: SchemaDocument, options: TypeScriptOptions): GenerateResult;
// Không export qua index.ts:
export function renderJsonFieldTypeScript(fieldType: JsonFieldType, enumTypeNames: ReadonlyMap<EnumId, string>): string;
```

`index.ts` chỉ export `generateTypeScript` và type `TypeScriptOptions`. `file` là `{ fileName: "types.ts", language: "typescript", content }`.

**Hành vi:**

- Tên type: `allocateModelNames(schema, ["JsonValue", "Record"])` của Task 11 (enum trước bảng, fallback `Enum`, `Table`, phân biệt hoa thường; bảng tên `JsonValue` nhận `JsonValue_`, bảng tên `Record` nhận `Record_`). `JsonValue` và `Record` luôn nằm trong danh sách dành riêng, kể cả khi không có cột `json` hay bảng không cột, để tên type không đổi khi schema đổi: type `Record` của người dùng sẽ che `Record<string, never>` mà bảng không cột dùng.
- `renderJsonFieldTypeScript` trên `toJsonFieldType(column.type)` (Task 10): `smallint`, `int32`, `float`, `double` → `number`; `bigintString`, `decimalString`, `string`, `uuid`, `date`, `time`, `localDateTime`, `offsetDateTime`, `base64` → `string`; `boolean` → `boolean`; `json` → `JsonValue`; `enum` → tên type của enum (enum không tìm thấy → `string`); `unknown` → `unknown`. Cột `custom` thêm `custom-type-unmapped` tại `["columns", id, "type"]`. Cột nullable nối ` | null` (kể cả `unknown`, để quy tắc đồng nhất).
- Output ghép bằng `renderFileContent`, mỗi phần tử một block:
  1. Khi có ít nhất một cột kiểu `json`: `export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };`.
  2. Mỗi enum theo `sortEnums`: `export type OrderStatus = "pending" | "đã giao";` (giá trị qua `JSON.stringify`, nối bằng ` | `); enum rỗng → `never`.
  3. Mỗi bảng theo `sortTables`: JSDoc của comment bảng (`formatJsDocLines(comment, "")`), rồi `export type NguoiDung = {`, mỗi cột theo `columnIds` là JSDoc của comment cột (thụt hai khoảng) và dòng `  <formatPropertyKey(tên cột gốc)>: <kiểu>;`, rồi `};`. Bảng không có cột → `export type X = Record<string, never>;`.
- Không có comment đầu file, option hay thời gian. Schema rỗng → `"\n"`.

**Test viết trước:**

- `names the file types.ts with language typescript`.
- `maps every json field type to a typescript type` (`it.each` đủ 17 loại của `JsonFieldType`).
- `declares JsonValue only when a json column exists`; `suffixes a table named JsonValue`; `suffixes a table named Record so an empty table still uses the global Record`.
- `writes an enum as a union of escaped string literals`; `writes an empty enum as never`.
- `writes properties in column order with original column names as keys` (gồm `họ tên` → `"họ tên"`, `USER_ID` trần, `__proto__` → `["__proto__"]`).
- `appends | null to nullable columns`.
- `writes unknown for a custom column and reports custom-type-unmapped`; `reports nothing for a schema without custom columns`.
- `writes table and column comments as JSDoc and escapes a comment terminator`.
- `names types with PascalCase and suffixes repeated names` (`order items`, `order_items` → `OrderItems`, `OrderItems2`).
- `writes a table without columns as Record<string, never>`; `writes an empty schema as a single newline`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture>` (bốn fixture), file `<fixture>.ts` và `.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/typescript` và `generateTypeScript(…, {})`, mong đợi `function types.ts`. Typecheck output do Task 30 viết; task sửa generator này sau khi Task 30 đã merge chạy cổng conformance với `src/typescript.test.ts`.

**Commit:** `feat(core): add typescript types generator`

## Task 20: CG-05 Zod schema

**Mục tiêu:** `@schemaforge/core/generators/zod` export `generateZod`, in `schemas.ts` với cú pháp Zod 4, khớp biểu diễn JSON của Task 10 để seed JSON của cùng fixture parse được (spec CG-05, mục 3 "Biểu diễn JSON…", mục 4 cột Zod, mục 7 dòng "CG-05 đúng ngữ nghĩa").

**Phụ thuộc:** Task 1, 4, 5, 10. **Đợt:** 4.

**File sở hữu (tạo):** `packages/core/src/generators/zod/index.ts`, `generate-zod.ts`, `generate-zod.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/zod/`.

**Chữ ký:**

```ts
export type ZodOptions = GeneratorOptions["zod"];
export function generateZod(schema: SchemaDocument, options: ZodOptions): GenerateResult;
// Không export qua index.ts:
export function renderJsonFieldZod(fieldType: JsonFieldType, enumSchemaNames: ReadonlyMap<EnumId, string>): string;
```

`index.ts` chỉ export `generateZod` và type `ZodOptions`. `file` là `{ fileName: "schemas.ts", language: "typescript", content }`.

**Hành vi:**

- Tên biến: một allocator `comparison: "exact"`, `separator: ""`, `reserved: ["z"]`; enum theo `sortEnums` rồi bảng theo `sortTables`; ứng viên là `toCamelCaseIdentifier(name, "enum")` hoặc `toCamelCaseIdentifier(name, "table")` nối `"Schema"` (`order_status` → `orderStatusSchema`, `用户` → `tableSchema`).
- `renderJsonFieldZod` trên `toJsonFieldType(column.type)`, đúng bảng spec mục 3:
  - `smallint` → `z.int().min(${SMALLINT_MINIMUM}).max(${SMALLINT_MAXIMUM})`; `int32` → `z.int32()`; `float`, `double` → `z.number()`; `boolean` → `z.boolean()`.
  - `bigintString` → `z.string().regex(new RegExp(${JSON.stringify(BIGINT_STRING_PATTERN)}))`; `decimalString` → cùng dạng với `decimalStringPattern(precision, scale)`. Pattern ghi qua `new RegExp(JSON.stringify(…))`, không ghi regex literal, để không phải escape `/`.
  - `string` → `z.string().max(n)` khi có `maxLength`, `z.string()` khi không; `uuid` → `z.guid()`; `date` → `z.iso.date()`; `time` → `z.iso.time()`; `localDateTime` → `z.iso.datetime({ local: true })`; `offsetDateTime` → `z.iso.datetime({ offset: true })`; `json` → `z.json()`; `base64` → `z.base64()`.
  - `enum` → biến schema của enum (enum không tìm thấy → `z.string()`); `unknown` → `z.unknown()` kèm `custom-type-unmapped` tại `["columns", id, "type"]`.
  - Cột nullable nối `.nullable()`.
- Output ghép bằng `renderFileContent`:
  1. `import { z } from "zod";` (chỉ khi có ít nhất một enum hoặc bảng).
  2. Mỗi enum một block: `export const orderStatusSchema = z.enum(["pending", "đã giao"]);` (giá trị qua `JSON.stringify`); enum rỗng → `z.never()`.
  3. Mỗi bảng một block: JSDoc của comment bảng, `export const nguoiDungSchema = z.object({`, mỗi cột theo `columnIds` là JSDoc của comment cột và dòng `  <formatPropertyKey(tên cột gốc)>: <schema>,`, rồi `});`. Bảng không có cột → `z.object({})`.
- Enum đứng trước bảng nên không có tham chiếu tới biến khai báo sau. Không export `z.infer`, không comment đầu file. Schema rỗng → `"\n"`.

**Test viết trước:**

- `names the file schemas.ts with language typescript`; `imports z from zod once`.
- `maps every json field type to a zod 4 schema` (`it.each` đủ 17 loại).
- `writes bigint and decimal patterns through new RegExp with a json string`; `writes the decimal pattern of decimalStringPattern for the column precision and scale`.
- `writes an enum schema with escaped values before table schemas`; `writes an empty enum as z.never()`.
- `writes object keys with original column names in column order` (gồm `__proto__` → `["__proto__"]`).
- `appends .nullable() to nullable columns`.
- `writes z.unknown() for a custom column and reports custom-type-unmapped`.
- `writes comments as JSDoc and escapes a comment terminator`.
- `suffixes repeated schema names with 2`; `names a table without latin letters tableSchema`.
- `writes a table without columns as z.object({})`; `writes an empty schema as a single newline`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture>` (bốn fixture), file `<fixture>.ts` và `.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/zod` và `generateZod(…, {})`, mong đợi `function schemas.ts`. Typecheck và parse seed JSON do Task 30 viết; task sửa generator Zod sau khi Task 30 đã merge chạy cổng conformance với `src/zod.test.ts`.

**Commit:** `feat(core): add zod schema generator`

## Task 21: CG-08 `SeedDataset`, PRNG và kiểm tra dữ liệu mẫu

**Mục tiêu:** phần lõi của seed data dùng chung với AI-06: dựng `SeedDataset` xác định theo `seed`, kiểm tra một dataset bất kỳ theo schema (`validateSeedDataset`), và parse dữ liệu chưa biết thành `SeedDataset` (`parseSeedDataset`, Vấn đề 19) (spec CG-08 "Sinh giá trị xác định", mã `SeedIssue`, "Quan hệ với AI-06"; mục 3 "Biểu diễn JSON…"; mục 10 "Seed").

**Phụ thuộc:** Task 2, 4, 9, 10, 11. **Đợt:** 4.

**File sở hữu (tạo), mỗi file kèm `<name>.test.ts`:** `packages/core/src/generators/seed/seed-dataset.ts`, `seed-random.ts`, `seed-values.ts`, `build-seed-dataset.ts`, `validate-seed-dataset.ts`. Không tạo `seed/index.ts` (Task 22 tạo, để subpath chỉ xuất hiện khi đã có `generateSeed`).

**Chữ ký và hành vi:**

`seed-dataset.ts`:

```ts
export type SeedRow = Readonly<Partial<Record<ColumnId, JsonValue>>>; // thiếu khóa = giá trị mặc định của database
export type SeedDataset = {
  readonly tables: readonly { readonly tableId: TableId; readonly rows: readonly SeedRow[] }[]; // thứ tự nạp
};
export const SEED_ISSUE_CODES = ["seed-value-invalid", "seed-value-null", "seed-unique-violation",
  "seed-foreign-key-missing", "seed-order-invalid"] as const;
export type SeedIssueCode = (typeof SEED_ISSUE_CODES)[number];
export type SeedIssue = { readonly code: SeedIssueCode; readonly path: DocumentPath };
export const SEED_ROWS_PER_TABLE_MAXIMUM = 1000;
export const SEED_DATASET_MAX_DEPTH = 64;
export type SeedDatasetOptions = { readonly rowsPerTable: number; readonly seed: number };
export function assertSeedDatasetOptions(options: SeedDatasetOptions): void;
export function parseSeedDataset(input: unknown): Result<SeedDataset, readonly StructuralError[]>;
```

- `assertSeedDatasetOptions`: `rowsPerTable` là số nguyên từ 1 đến `SEED_ROWS_PER_TABLE_MAXIMUM`, `seed` là số nguyên từ 0 đến `0xffffffff`; sai thì throw `RangeError` (spec mục 1: option sai miền là lỗi lập trình).
- `parseSeedDataset` (Vấn đề 19, cho frontend của AI-06), theo đúng thứ tự của `parseOperation` (`packages/core/src/parse/parse-operation.ts`): trước tiên quét độ sâu bằng stack tường minh (không đệ quy) trên input chưa biết, vì `z.json()` của Zod đệ quy theo độ sâu lồng và input lồng quá sâu làm tràn call stack thay vì trả lỗi. Hằng `SEED_DATASET_MAX_DEPTH = 64` (export trong `seed-dataset.ts`): gốc có độ sâu 0, mỗi mảng hoặc object lồng thêm một cấp (container sâu nhất của dataset do `buildSeedDataset` dựng là object `{ value: n }` của cột `json`, ở cấp 5); node vượt hằng → `err([{ code: "invalid-shape", path }])` với `path` của node vượt đầu tiên theo thứ tự đọc (đẩy con theo thứ tự ngược như `findTooDeepBatchPath`). Sau đó `z.strictObject({ tables: z.array(z.strictObject({ tableId: tableIdShape, rows: z.array(z.partialRecord(columnIdShape, z.json())).max(SEED_ROWS_PER_TABLE_MAXIMUM) })) })` dựng một lần ở cấp module (shape bất biến, như các shape của `src/model/`), `safeParse`; lỗi → `err(toStructuralErrors(error.issues))` (mã `invalid-shape`, đường dẫn theo input), thành công → `ok(dataset)`. Chỉ kiểm tra hình dạng; tableId, columnId có thật hay không, kiểu, nullable, unique, khóa ngoại là việc của `validateSeedDataset`. Kiểm tra trong typings Zod đã cài rằng `z.partialRecord` và `z.json()` cho kiểu gán được vào `SeedRow`; không gán được thì dừng và báo, không dùng `as`.

`seed-random.ts` (không state cấp module):

```ts
export type SeedRandom = { readonly nextUint32: () => number; readonly nextInt: (maxExclusive: number) => number };
export function createSeedRandom(state: number): SeedRandom;            // mulberry32, state trong closure
export function createTableSeedRandom(seed: number, tableName: string): SeedRandom; // state = (seed ^ parseInt(fnv1a32Hex(tableName), 16)) >>> 0
export function formatSeedDate(dayOffset: number): string;              // 0 → "2026-01-01", 364 → "2026-12-31"
export function formatSeedTime(secondOfDay: number): string;            // 0 → "00:00:00", 86399 → "23:59:59"
export function encodeBase64(bytes: readonly number[]): string;
export function formatUuidV4(bytes: readonly number[]): string;         // 16 byte, đặt nibble phiên bản 4 và bit variant 10
```

- mulberry32: `state = (state + 0x6d2b79f5) | 0; t = Math.imul(state ^ (state >>> 15), state | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (t ^ (t >>> 14)) >>> 0`. `nextInt(n)` là `nextUint32() % n` (`n` từ 1 trở lên, nếu không thì throw `RangeError`). `fnv1a32Hex` lấy từ Task 9.
- `formatSeedDate` tính từ bảng số ngày mỗi tháng của năm 2026 (không nhuận), không dùng `Date` (spec: không đọc đồng hồ; `Date` bị cấm trong core). Ngoài 0–364 thì throw `RangeError`.
- `encodeBase64` tự mã hóa theo bảng chữ cái chuẩn có `=` đệm (không `btoa`, không `Buffer`), kết quả khớp `BASE64_PATTERN`.

`seed-values.ts`:

```ts
export const SEED_NULL_RATE_DENOMINATOR = 5; // cột nullable ngoài khóa nhận null khi nextInt(5) === 0
export type SeedValue = { readonly kind: "value"; readonly value: JsonValue } | { readonly kind: "omit" } | { readonly kind: "none" };
export function generateColumnValue(input: {
  readonly column: Column; readonly enums: SchemaDocument["enums"]; readonly random: SeedRandom;
  readonly sequence: number;            // bộ đếm riêng của cột, bắt đầu từ 1 (CG-08), tăng sau mỗi lần sinh (kể cả lần sinh lại)
  readonly isKeyColumn: boolean;        // thuộc khóa chính, cột isUnique, index unique hoặc cặp cột quan hệ
}): SeedValue;
```

- Thứ tự quyết định: kiểu `custom`, hoặc enum không tìm thấy hoặc rỗng → nullable: `value: null`; có giá trị mặc định: `omit`; còn lại `none` (bảng không sinh được). Cột nullable với `isKeyColumn` sai và `nextInt(SEED_NULL_RATE_DENOMINATOR) === 0` → `null`. Cột thuộc khóa không bao giờ nhận `null` ở bước này.
- Theo `toJsonFieldType`: `isAutoIncrement` hoặc cột số nguyên thuộc khóa chính (`smallint`, `integer`, `bigint`) → `sequence` (`bigint` là chuỗi); `smallint` → `nextInt(65536) − 32768`; `int32` → `nextUint32() | 0`; `bigintString` → `String(nextUint32())`; `decimalString` → phần nguyên `nextInt(10^min(p − s, 9))` (bằng `"0"` khi `p − s ≤ 0`), phần lẻ gồm `s` chữ số `nextInt(10)`, nối bằng `.` khi `s > 0`; `float`, `double` → `nextInt(1_000_000) / 100`; `boolean` → `nextInt(2) === 1`; `string` → `<từ ASCII của tên cột nối bằng _, chữ thường, rỗng thì value>_<sequence>`, quá `maxLength` thì giữ `maxLength` ký tự **cuối** (giữ số thứ tự để vẫn khác nhau); `uuid` → `formatUuidV4` của 16 byte `nextInt(256)`; `date` → `formatSeedDate(nextInt(365))`; `time` → `formatSeedTime(nextInt(86400))`; `localDateTime` → ngày, `T`, giờ; `offsetDateTime` → như trên nối `Z`; `json` → `{ value: nextInt(1000) }` dựng bằng `Object.fromEntries`; `base64` → `encodeBase64` của 4 byte; `enum` → `values[nextInt(values.length)]`.
- Mọi giá trị sinh ra qua `isValidJsonValue` (Task 10); test kiểm tra điều này cho mọi kiểu.

`build-seed-dataset.ts`:

```ts
export const SEED_MAX_ROW_ATTEMPTS = 20;
export function buildSeedDataset(schema: SchemaDocument, options: SeedDatasetOptions):
  { readonly dataset: SeedDataset; readonly diagnostics: readonly GeneratorDiagnostic[] };
```

1. `assertSeedDatasetOptions(options)`. `loadOrder = buildLoadOrder(schema)` (Task 11).
2. Bảng không sinh được: bảng có cột cho `none` (kiểm tra trước bằng thuộc tính cột, không cần PRNG), cộng `loadOrder.skippedTableIds`, rồi `propagateSkippedTables(schema, …)`. Mỗi bảng bị bỏ một `seed-table-skipped` tại `["tables", id]`; bảng bị bỏ không có trong `dataset.tables`.
3. Bảng còn lại theo `loadOrder.tableIds`, mỗi bảng một `createTableSeedRandom(options.seed, table.name)` và bộ đếm `sequence` riêng mỗi cột, bắt đầu từ 1 (spec CG-08: khóa chính và cột auto-increment đánh số từ 1): lần sinh đầu tiên của cột dùng `1` (khóa `1`, chuỗi `<tên>_1`). Bảng không có cột có `rows: []`, không diagnostic (schema đã có issue `table-columns-empty`).
4. Mỗi dòng: cột theo `columnIds`. Cột nguồn của quan hệ (mọi quan hệ có `fromTableId` là bảng này) được gán theo quan hệ, sau khi các cột khác của dòng đã sinh. Duyệt các quan hệ không hoãn theo `sortRelations`; một cột nguồn có thể thuộc nhiều quan hệ (schema đa tenant: `orders.tenant_id → tenants.id` cùng `(tenant_id, user_id) → users(tenant_id, id)`), nên quan hệ gán trước đặt giá trị của cột chung và quan hệ sau phải khớp với nó:
   - **Ứng viên** của một quan hệ: các dòng của bảng đích có đủ mọi giá trị `toColumnId` khác `null`, và với mỗi cặp cột mà cột nguồn đã được một quan hệ trước đó gán trong cùng dòng, giá trị `toColumnId` bằng giá trị đã gán (so bằng `JSON.stringify`); `oneToOne` chỉ giữ các dòng chưa được chọn.
   - **Quy tắc null** khi không còn ứng viên: gán `null` cho các cột nguồn chưa gán chỉ khi mọi cột nguồn chưa gán của quan hệ đều nullable và quan hệ không có cột nguồn nào đã được gán; nếu không thì dòng thất bại (bước 5 sinh lại).
   - Quan hệ không tự tham chiếu: chọn `nextInt(số ứng viên)` trong các ứng viên, sao giá trị `toColumnId` vào các cột nguồn chưa gán.
   - Tự tham chiếu: ứng viên duy nhất là dòng `r − 1` (dòng đầu không có), áp điều kiện khớp như trên; không có ứng viên thì áp quy tắc null; quy tắc null không cho thì trỏ tới chính dòng đó khi mọi `toColumnId` của chính dòng đã có giá trị khác `null` và khớp các cột đã gán, nếu không thì dòng thất bại.
   - Quan hệ hoãn (`loadOrder.deferredRelationIds`): không duyệt ở bước này; sau khi duyệt xong, cột nguồn của chúng chưa được quan hệ nào gán nhận `null`, gán lại ở bước 6.
5. Unique: khóa chính, mỗi cột `isUnique`, mỗi index unique; giá trị khóa so bằng `JSON.stringify` của mảng giá trị theo thứ tự cột của khóa; khóa có giá trị `null` hoặc thiếu không tính. Dòng trùng hoặc thất bại ở bước 4 được sinh lại (cùng PRNG, `sequence` tiếp tục tăng) tối đa `SEED_MAX_ROW_ATTEMPTS` lần; hết lượt thì dừng sinh bảng đó và thêm `seed-rows-reduced` tại `["tables", id]` (bảng giữ các dòng đã có). Dừng thay vì thử dòng sau vì dòng sau gặp cùng giới hạn (cột `boolean` unique, enum ít giá trị); quyết định ở Vấn đề 20.
6. Quan hệ hoãn theo `sortRelations`: bảng nguồn có khóa chính → mỗi dòng chọn một dòng của bảng đích bằng PRNG của bảng nguồn (tiếp tục state), theo đúng quy tắc ứng viên và quy tắc null của bước 4, trong đó "đã gán" gồm cột do quan hệ không hoãn gán ở bước 4 và cột do quan hệ hoãn đứng trước gán ở bước này. Bước này không sinh lại dòng (dòng đã được bảng khác tham chiếu): khi quy tắc null không cho, các cột nguồn chưa gán của quan hệ giữ `null` (hợp lệ vì mọi cột nguồn của quan hệ hoãn nullable, và khóa ngoại có cột `null` không được kiểm tra). Bảng nguồn không có khóa chính → giữ `null` (không có cách `UPDATE` đúng dòng).
7. Dòng dựng bằng `Object.fromEntries` (khóa là `ColumnId`), không chứa khóa của cột `omit`. Diagnostic qua `finalizeDiagnostics`.

`validate-seed-dataset.ts`:

```ts
export function validateSeedDataset(schema: SchemaDocument, dataset: SeedDataset): readonly SeedIssue[];
export function findDeferredSeedRelations(schema: SchemaDocument, dataset: SeedDataset): readonly RelationId[];
```

- Không throw với mọi dataset đúng kiểu, kể cả tableId, columnId không có trong schema, bảng lặp, dòng rỗng. Duyệt bằng chỉ số và tra cứu qua `schema.tables[id]` có kiểm tra `undefined`; không dùng `Object.keys` của dòng cho thứ tự (duyệt `columnIds` của bảng rồi mới duyệt khóa lạ theo thứ tự `<`).
- Đường dẫn `["tables", i, "rows", j, columnId]` (`i`, `j` là chỉ số trong dataset). Kết quả qua `sortByPathThenCode`.
- `tableId` không có trong schema → `seed-value-invalid` tại `["tables", i, "tableId"]`; bảng xuất hiện lần thứ hai → `seed-order-invalid` tại `["tables", i, "tableId"]`.
- Khóa của dòng không phải cột của bảng → `seed-value-invalid`. Giá trị `null` ở cột không nullable, hoặc thiếu khóa ở cột không nullable, không auto-increment và không có giá trị mặc định → `seed-value-null`. Giá trị khác `null` mà `isValidJsonValue` trả `false` → `seed-value-invalid`.
- Unique như bước 5 ở trên: dòng sau của cặp trùng → `seed-unique-violation` tại cột đầu tiên của khóa.
- Khóa ngoại, theo `sortRelations` với `fromTableId` là bảng của dòng, khi mọi cột nguồn có giá trị khác `null`: bảng đích không có trong dataset hoặc không có dòng khớp mọi `toColumnId` → `seed-foreign-key-missing` tại cột nguồn đầu tiên. Bảng đích nạp sau bảng nguồn: hợp lệ chỉ khi mọi cột nguồn nullable và bảng nguồn có khóa chính (dữ liệu được chèn `NULL` trước rồi `UPDATE`), nếu không → `seed-order-invalid`. Tự tham chiếu tới dòng đứng sau → `seed-order-invalid`; tới chính dòng đó hợp lệ.
- `findDeferredSeedRelations` (Task 22 dùng): quan hệ không tự tham chiếu có bảng đích nạp sau bảng nguồn trong `dataset.tables`, theo `sortRelations`. Với dataset của `buildSeedDataset`, tập này là `loadOrder.deferredRelationIds` không gồm quan hệ chạm bảng bị bỏ.

**Test viết trước:**

- `seed-dataset.test.ts`: `accepts rows per table from 1 to 1000 and seeds from 0 to 2^32 - 1`; `throws RangeError for rows per table 0, 1001 or 1.5` (`it.each`); `throws RangeError for a negative or fractional seed` (`it.each`); `parses a valid dataset`; `rejects a dataset with an unknown key, a bad table id or a non-json value with invalid-shape errors at their paths` (`it.each`); `parses rows that omit columns`; `parses a row keyed by a column id that the schema does not have` (hình dạng đúng; `validateSeedDataset` mới báo); `rejects a table with more than 1000 rows with invalid-shape`; `returns invalid-shape instead of throwing for deeply nested values` (một giá trị cột lồng 100 000 mảng, dựng bằng `JSON.parse("[".repeat(100_000) + "]".repeat(100_000))` để test không có vòng lặp, kết quả `err` với `path` bắt đầu bằng `["tables", 0, "rows", 0, <columnId>]`); `accepts a json value nested up to the depth limit` (container sâu nhất ở đúng cấp `SEED_DATASET_MAX_DEPTH`).
- `seed-random.test.ts`: `returns the same sequence for the same state`; `returns different sequences for different table names`; `matches the first mulberry32 outputs for state 1` (giá trị mong đợi tính một lần bằng một script ngoài core, ghi cứng); `throws RangeError for nextInt of 0`; `formats day offsets 0, 31, 58 and 364 as 2026 dates` (`it.each`); `formats seconds of day as times`; `encodes bytes as base64 with padding` (`it.each`: 0, 1, 2, 3, 4 byte, so với vector RFC 4648 `""`, `Zg==`, `Zm8=`, `Zm9v`, `Zm9vYg==`); `formats a version 4 uuid with the variant bits`.
- `seed-values.test.ts`: `generates a value accepted by isValidJsonValue for every column type` (`it.each` 18 kiểu không custom); `numbers auto-increment and integer primary key columns by sequence starting at 1`; `keeps the sequence suffix when truncating a string to its max length`; `returns null for a nullable custom column`; `omits a custom column with a default`; `returns none for a required custom column without a default`; `never returns null for a key column`; `returns null for a nullable column at the fixed rate` (đếm trên 1000 lần gọi với seed cố định, kỳ vọng số null cố định).
- `build-seed-dataset.test.ts`: `returns the same dataset for the same seed`; `returns different values for a different seed`; `keeps the rows of other tables when a table is added`; `orders tables so referenced tables come first`; `points a self-reference to the previous row and the first row to null`; `points the first row of a required self-reference to itself`; `picks distinct parent rows for one-to-one relations and reduces rows when parents run out`; `picks a parent row that agrees with a column shared by two relations` (schema dựng bằng factory: `tenants(id)`, `users(tenant_id, id)` có khóa chính hoặc index unique `(tenant_id, id)` và `tenant_id → tenants.id`, `orders(tenant_id, user_id)` với `tenant_id → tenants.id` và `(tenant_id, user_id) → users(tenant_id, id)`, mọi cột bắt buộc; `rowsPerTable` từ 5 trở lên; khẳng định `validateSeedDataset(schema, dataset)` trả mảng rỗng và `orders` đủ số dòng); `defers a nullable relation in a cycle and fills it after every table`; `keeps a deferred value null when the source table has no primary key`; `skips the tables of a required cycle and their dependants and reports seed-table-skipped`; `skips a table with a required custom column and its dependants`; `reduces rows for a unique boolean column and reports seed-rows-reduced`; `omits columns whose value is left to the database default`; `passes validateSeedDataset for every fixture` (`it.each` `sample`, `naming-edge`, `target-limit`, `createLargeSchema({ tableCount: 20 })`); `throws RangeError for invalid options`.
- `validate-seed-dataset.test.ts`: một test cho mỗi mã và mỗi nhánh: `reports seed-value-invalid for a value of the wrong representation` (`it.each`), `reports seed-value-invalid for an unknown table and an unknown column`, `reports seed-value-null for null and for a missing required column without default`, `accepts a missing column that has a default or auto-increment`, `reports seed-unique-violation on the later row`, `ignores null in unique keys`, `reports seed-foreign-key-missing for a missing parent row and for a parent table absent from the dataset`, `reports seed-order-invalid for a reference to a later table through a required column`, `accepts a reference to a later table through nullable columns of a table with a primary key`, `reports seed-order-invalid for a later table referenced from a table without a primary key`, `reports seed-order-invalid for a repeated table and for a self-reference to a later row`, `accepts a self-reference to the same row`, `returns issues sorted by path then code`, `does not throw for a dataset that mentions nothing in the schema`; `findDeferredSeedRelations`: `returns relations whose target table is loaded later`, `ignores self-references`.

**Kiểm tra:** như mục "Quy ước chung".

**Commit:** `feat(core): add seed dataset builder and validation`

## Task 22: CG-08 xuất seed data và `generateSeed`

**Mục tiêu:** `@schemaforge/core/generators/seed` export `generateSeed` cùng các hàm dùng chung với AI-06; `serializeSeedDataset` xuất một `SeedDataset` bất kỳ thành `seed.sql` cho ba dialect hoặc `seed.json`; entry point chính export type `SeedDataset` (spec CG-08 "Xuất", mục 1 "Nơi đặt và entry point"; Vấn đề 19).

**Phụ thuộc:** Task 1, 4, 5, 7, 11 (`orderColumnPairsByReferencedKey`), 12 (`allocateMysqlNames`), 21. **Đợt:** 6.

**File sở hữu:** tạo `packages/core/src/generators/seed/index.ts`, `serialize-seed-dataset.ts`, `serialize-seed-dataset.test.ts`, `seed-sql-values.ts`, `seed-sql-values.test.ts`, `generate-seed.ts`, `generate-seed.test.ts`, mọi file trong `packages/core/src/generators/__snapshots__/seed/`; sửa `packages/core/src/index.ts` (chỉ thêm một dòng `export type { SeedDataset } from "./generators/seed/seed-dataset.js";`, không sửa `index.test.ts` vì danh sách giá trị lúc chạy không đổi).

**Chữ ký:**

```ts
export type SeedOptions = GeneratorOptions["seed"];
export function generateSeed(schema: SchemaDocument, options: SeedOptions): GenerateResult;
export function serializeSeedDataset(schema: SchemaDocument, dataset: SeedDataset, format: SqlDialect | "json"): GeneratedFile;
// Không export qua index.ts:
export function formatSeedSqlValue(dialect: SqlDialect, column: Column, value: JsonValue | undefined,
  enums: SchemaDocument["enums"]): string;
```

`seed/index.ts` export: hàm `generateSeed`, `buildSeedDataset`, `validateSeedDataset`, `serializeSeedDataset`, `parseSeedDataset` (Vấn đề 19); type `SeedOptions`, `SeedDataset`, `SeedRow`, `SeedIssue`, `SeedIssueCode`, `SeedDatasetOptions`. Không export `SEED_ISSUE_CODES` hay hàm nội bộ khác (Vấn đề 11).

**`generateSeed`:** `format` ngoài bốn giá trị thì throw `RangeError`; `buildSeedDataset(schema, { rowsPerTable, seed })` (option sai miền throw ở Task 21); `file` là `serializeSeedDataset(schema, dataset, format)`; `diagnostics` là diagnostic của `buildSeedDataset`.

**`formatSeedSqlValue`** (`seed-sql-values.ts`), dùng chung hàm literal của Task 7 như giá trị mặc định:

- `undefined` (khóa thiếu) → `DEFAULT`. `null`, hoặc giá trị mà `isValidJsonValue(column.type, value, enums)` trả `false` → `NULL` (dataset đã qua `validateSeedDataset` thì không gặp; giữ output an toàn với dataset bất kỳ).
- `smallint`, `integer`, `real`, `double` → `String(value)`; `boolean` → `formatSqlLiteral(dialect, column.type, value ? "true" : "false")`; `json` → `formatSqlLiteral(dialect, column.type, JSON.stringify(value))`; `binary` (chuỗi base64 đã khớp `BASE64_PATTERN`, chỉ gồm `A-Za-z0-9+/=`) → PostgreSQL `decode('<b64>', 'base64')`, MySQL `FROM_BASE64('<b64>')`, SQL Server `CAST(N'' AS XML).value('xs:base64Binary("<b64>")', 'varbinary(max)')`; `custom` → `formatSqlLiteral` của chuỗi (giá trị chuỗi giữ nguyên, giá trị khác qua `JSON.stringify`); mọi kiểu còn lại → `formatSqlLiteral(dialect, column.type, value)` (giây lẻ được cắt như CG-01). PostgreSQL: chuỗi qua `removeNullCharacters` trước (seed không có diagnostic riêng; dữ liệu của `buildSeedDataset` không có U+0000).

**`serializeSeedDataset`, định dạng `json`:** `{ fileName: "seed.json", language: "json" }`, nội dung `JSON.stringify(mảng, null, 2)` cộng `\n`. Mảng theo thứ tự `dataset.tables`, mỗi phần tử `{ "table": <tên bảng>, "rows": [...] }`; mỗi dòng là object dựng bằng `Object.fromEntries`, key là tên cột gốc, theo `columnIds`, chỉ cột có khóa trong dòng (giá trị giữ nguyên, kể cả quan hệ hoãn: JSON ghi giá trị cuối). Bảng hoặc cột không có trong schema bị bỏ qua.

**Định dạng SQL:** `{ fileName: "seed.sql", language: "sql" }`, ghép bằng `renderFileContent`, mỗi bảng có dòng một block theo thứ tự `dataset.tables`, rồi một block `UPDATE`:

- Danh sách cột của bảng: cột theo `columnIds` xuất hiện trong ít nhất một dòng; tên quote bằng `quoteSqlIdentifier`, MySQL dùng tên của `allocateMysqlNames` (cùng tên với DDL). **Cột chỉ thuộc quan hệ hoãn** là cột nguồn của một quan hệ trong `findDeferredSeedRelations(schema, dataset)` mà không là cột nguồn của quan hệ nào khác có cùng `fromTableId` ngoài tập đó (kể cả tự tham chiếu). Chỉ các cột này ghi `NULL` trong `INSERT`; cột dùng chung với quan hệ không hoãn (ví dụ `tenant_id`) giữ giá trị của dòng, vì dòng cha của quan hệ không hoãn đã được nạp trước. Nhờ vậy `seed.sql` và `seed.json` luôn khớp, kể cả khi `UPDATE` của dòng bị bỏ.
- `INSERT INTO <bảng> (<cột>) VALUES` rồi mỗi dòng `  (<giá trị>),` trên một dòng, dòng cuối kết thúc `;`. Tối đa 1000 dòng mỗi câu (giới hạn danh sách `VALUES` của SQL Server, áp cho mọi dialect); nhiều hơn thì thêm câu mới.
- Bảng có dòng nhưng danh sách cột rỗng: mỗi dòng một câu `INSERT INTO <bảng> DEFAULT VALUES;` (PostgreSQL, SQL Server) hoặc `` INSERT INTO `t` () VALUES (); `` (MySQL). Bảng có `rows` rỗng không có câu lệnh.
- SQL Server: bảng có cột `isAutoIncrement` trong danh sách cột thì bọc bằng `SET IDENTITY_INSERT <bảng> ON;` và `SET IDENTITY_INSERT <bảng> OFF;`.
- PostgreSQL: sau `INSERT`, mỗi cột `isAutoIncrement` trong danh sách cột một câu `SELECT setval(pg_get_serial_sequence(<sqlStringLiteral(quoteSqlIdentifier(tên bảng))>, <sqlStringLiteral(tên cột)>), (SELECT max(<cột>) FROM <bảng>));` (tham số đầu là tên bảng có quote vì hàm phân tích nó như định danh SQL; tham số hai là tên cột trần). MySQL không cần câu nào thêm.
- Block cuối: với mỗi quan hệ của `findDeferredSeedRelations` và mỗi dòng của bảng nguồn có mọi cột nguồn khác `null` và mọi cột khóa chính có giá trị: `UPDATE <bảng> SET <cột> = <giá trị>[, …] WHERE <cột khóa> = <giá trị> [AND …];`, `SET` chỉ gồm các cột chỉ thuộc quan hệ hoãn của quan hệ đó (theo `orderColumnPairsByReferencedKey`; cột dùng chung đã có giá trị từ `INSERT` nên không ghi lại), cột khóa theo `primaryKeyColumnIds`. Quan hệ không có cột chỉ thuộc quan hệ hoãn nào thì không có `UPDATE`. Bảng nguồn không có khóa chính bị bỏ qua.
- Dataset rỗng → `"\n"`. Không có `BEGIN`, `COMMIT`, comment hay thời gian.

**Test viết trước:**

- `seed-sql-values.test.ts`: `writes DEFAULT for a missing key and NULL for null`; `writes NULL for a value of the wrong representation`; `formats values by column type for each dialect` (`it.each`: số, `bigint`, `decimal`, `boolean`, chuỗi có `'` và `\`, `uuid`, `date`, `timestamptz`, `json`, enum); `decodes base64 binary values for each dialect` (`it.each`); `truncates fractional seconds like the ddl defaults` (SQL Server 7, MySQL 6); `removes a null character from a PostgreSQL string`.
- `serialize-seed-dataset.test.ts`: `writes seed.json as an array of tables with original column names in column order`; `keeps a __proto__ column as an own property in json`; `writes one INSERT per table in dataset order`; `lists only columns present in some row and writes DEFAULT for missing keys`; `splits more than 1000 rows into several INSERT statements`; `writes DEFAULT VALUES for rows without columns`; `wraps identity inserts in SET IDENTITY_INSERT on sqlserver`; `resets identity sequences with setval on postgresql`; `writes NULL for deferred relation columns and UPDATE statements at the end`; `keeps a column shared with a non-deferred relation in the insert` (cột `tenant_id` là cột nguồn của một quan hệ hoãn và một quan hệ không hoãn: `INSERT` ghi giá trị của dòng, `UPDATE` của quan hệ hoãn không có `tenant_id` trong `SET`); `skips UPDATE for a source table without a primary key`; `uses renamed mysql column names`; `ignores tables and columns missing from the schema`; `writes an empty dataset as a single newline`.
- `generate-seed.test.ts`: `names the file by format` (`it.each`: `seed.sql`, `seed.json`); `returns the diagnostics of buildSeedDataset`; `returns the same content for the same seed`; `throws RangeError for an unknown format`; `throws RangeError for rows per table outside 1 to 1000`.
- Snapshot: `matches the snapshot for <fixture> as <format>` (`it.each` bốn fixture × `postgresql`, `mysql`, `sqlserver`, `json`, với `rowsPerTable: 3`, `seed: 1`), file `<fixture>.<format>.sql` hoặc `<fixture>.json.json` và `<fixture>.<format>.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm:

```bash
pnpm --filter @schemaforge/backend exec node --input-type=module -e 'const seed = await import("@schemaforge/core/generators/seed"); const testing = await import("@schemaforge/core/testing"); console.log(typeof seed.generateSeed, typeof seed.parseSeedDataset, seed.generateSeed(testing.createSampleSchema(), { format: "json", rowsPerTable: 2, seed: 1 }).file.fileName)'
pnpm --filter @schemaforge/backend typecheck
pnpm --filter @schemaforge/frontend typecheck
```

Mong đợi: in `function function seed.json`; hai lệnh typecheck thoát mã 0 (`src/index.ts` đổi). Seed SQL chạy trên database thật và seed JSON parse bằng schema Zod do Task 29, 30 viết; task sửa phần seed sau khi hai task đó đã merge chạy cổng conformance với `src/seed-sql.test.ts` và `src/zod.test.ts`.

**Commit:** `feat(core): add seed data serialization and generator`

## Task 23: CG-06 Mock API (handler MSW 2)

**Mục tiêu:** `@schemaforge/core/generators/mock-api` export `generateMockApi`, in một file `handlers.ts` gồm dữ liệu trong bộ nhớ lấy từ seed và mảng `handlers` của MSW 2, với đường dẫn trùng OpenAPI (spec CG-06, mục 4 cột Mock API, mục 5 bảng không gian tên; Vấn đề 5, 15).

**Phụ thuộc:** Task 1, 4, 5, 10, 21. **Đợt:** 6.

**File sở hữu (tạo):** `packages/core/src/generators/mock-api/index.ts`, `generate-mock-api.ts`, `generate-mock-api.test.ts`, `render-js-value.ts`, `render-js-value.test.ts`, `mock-api-handlers.ts`, `mock-api-handlers.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/mock-api/`.

**Chữ ký:**

```ts
export type MockApiOptions = GeneratorOptions["mock-api"];
export function generateMockApi(schema: SchemaDocument, options: MockApiOptions): GenerateResult;
// Không export qua index.ts:
export const MOCK_ROWS_PER_TABLE = 5;
export const MOCK_SEED = 1;
export function renderJsValue(value: JsonValue): string;
export function renderResourceHandlers(input: {
  readonly resource: RestResource; readonly rowsVariable: string; readonly keyColumnNames: readonly string[];
}): readonly string[]; // các dòng phần tử của mảng handlers cho một tài nguyên
```

`index.ts` chỉ export `generateMockApi` và type `MockApiOptions`. `file` là `{ fileName: "handlers.ts", language: "typescript", content }`. Import `buildSeedDataset` từ `../seed/build-seed-dataset.js` (ngoại lệ duy nhất cho import giữa hai đích, spec CG-06).

**Hành vi:**

- Dữ liệu: `buildSeedDataset(schema, { rowsPerTable: MOCK_ROWS_PER_TABLE, seed: MOCK_SEED })`; diagnostic của seed được chuyển tiếp. Cột `custom` thêm `custom-type-unmapped` tại `["columns", id, "type"]` (giá trị vẫn theo seed). Bảng không có khóa chính thêm `table-without-identifier` tại `["tables", id]`. Gộp bằng `finalizeDiagnostics`.
- Tên: `buildRestApiNames(schema)` (Task 10) cho đường dẫn và tên tham số; biến dữ liệu của mỗi bảng là `rows` nối `typeName` (`rowsNguoiDung`), không trùng vì `typeName` đã không trùng. Đường dẫn bằng `formatMswPath`, ghi qua `JSON.stringify`.
- `renderJsValue` ghi giá trị JSON thành biểu thức JavaScript: `null`, boolean, số, chuỗi qua `JSON.stringify`; mảng `[a, b]`; object `{ <formatPropertyKey(key)>: <giá trị>, … }` theo thứ tự `Object.entries` (khóa `__proto__` thành `["__proto__"]`, Vấn đề 5); object rỗng `{}`. Không dùng `JSON.stringify` cho object vì khóa `"__proto__"` trong object literal đặt prototype.
- Mỗi dòng dữ liệu: object literal một dòng, key là `formatPropertyKey(tên cột gốc)` theo `columnIds`, chỉ cột có trong dòng, giá trị qua `renderJsValue`. Bảng bị seed bỏ có mảng rỗng.
- Output ghép bằng `renderFileContent`:
  1. Comment đầu file, cố định, tiếng Anh (comment trong code), dạng `//`: dòng 1 `Mock REST API handlers for MSW 2 (npm install msw@^2).`; dòng 2 `Browser: run npx msw init <public dir>, then setupWorker(...handlers).start().`; dòng 3 `Node: setupServer(...handlers).listen() from msw/node.` (Vấn đề 15: ghi rõ MSW 2).
  2. Khi có ít nhất một bảng: `import { http, HttpResponse } from "msw";`.
  3. Helper, chỉ khi có bảng: `type Row = Record<string, unknown>;`, `function isRow(value: unknown): value is Row` (object khác `null`, không phải mảng), và khi có bảng có khóa chính `function hasKey(row: Row, columns: readonly string[], values: readonly unknown[]): boolean` (so `String(row[column]) === String(values[index])` cho mọi cột).
  4. Mỗi bảng theo `sortTables` một block `const rowsX: Row[] = [` … `];`.
  5. `export const handlers = [` các dòng của `renderResourceHandlers` theo thứ tự `resources` `];`.
- `renderResourceHandlers`, đường dẫn danh sách `C`, đường dẫn dòng `I`, mảng tên cột khóa `K` (tên gốc theo `primaryKeyColumnIds`, qua `JSON.stringify`), mảng giá trị tham số `P` (`params[<JSON.stringify(tên tham số)>]` theo thứ tự khóa):
  - `http.get(C, () => HttpResponse.json(rowsX))`.
  - `http.post(C, async ({ request }) => { … })`: `const body: unknown = await request.json().catch(() => null)`; không phải `isRow` → `new HttpResponse(null, { status: 400 })`; bảng có khóa chính và `rowsX.some((row) => hasKey(row, K, K.map((column) => body[column])))` → status 409; nếu không thì `rowsX.push(body)` và `HttpResponse.json(body, { status: 201 })`.
  - Chỉ bảng có khóa chính: `http.get(I, …)` trả dòng đầu tiên thỏa `hasKey(row, K, P)` hoặc 404; `http.put(I, async ({ request, params }) => …)`: body không phải `isRow` → 400, không có dòng → 404, nếu không thì dòng mới là `{ ...body }` với các cột khóa lấy lại từ dòng cũ (giữ kiểu số của khóa), thay vào vị trí cũ, trả `HttpResponse.json(dòng mới)`; `http.delete(I, …)`: không có dòng → 404, nếu không `splice` rồi trả status 204.
- Không mô phỏng kiểm tra kiểu, khóa ngoại, unique ngoài khóa chính, lọc, phân trang hay tự sinh khóa (spec CG-06). Schema rỗng: chỉ comment đầu file và `export const handlers = [];`. Không có thời gian.

**Test viết trước:**

- `render-js-value.test.ts`: `renders primitives with JSON.stringify` (`it.each`); `renders arrays and nested objects`; `renders a __proto__ key as a computed key`; `quotes keys that are not identifiers`; `renders an empty object`.
- `mock-api-handlers.test.ts`: `writes list, create, get, replace and delete handlers for a table with a primary key`; `writes only list and create handlers for a table without a primary key`; `uses colon parameters in primary key order for a composite key`; `returns 400 for a body that is not an object and 409 for an existing key` (kiểm tra đoạn code sinh ra); `keeps key values from the stored row on replace`.
- `generate-mock-api.test.ts`: `names the file handlers.ts with language typescript`; `starts with the MSW 2 usage comment`; `imports http and HttpResponse from msw`; `fills each table with five seed rows`; `matches the rows of buildSeedDataset with seed 1` (so giá trị của một bảng với `buildSeedDataset`); `writes original column names as keys`; `forwards seed diagnostics`; `reports table-without-identifier for a table without a primary key`; `reports custom-type-unmapped for a custom column`; `matches every handler path with */api`; `writes an empty schema as the comment and an empty handlers array`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture>` (bốn fixture), file `<fixture>.ts` và `.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/mock-api` và `generateMockApi(…, {})`, mong đợi `function handlers.ts`. Typecheck và gọi route bằng `msw/node` do Task 31 viết; task sửa generator này sau khi Task 31 đã merge chạy cổng conformance với `src/mock-api.test.ts`.

**Commit:** `feat(core): add msw mock api generator`

## Task 24: CG-07 OpenAPI 3.1

**Mục tiêu:** `@schemaforge/core/generators/openapi` export `generateOpenApi`, in `openapi.json` (OpenAPI 3.1.1) với component cho từng enum, bảng và đường dẫn CRUD trùng Mock API (spec CG-07, mục 3 cột OpenAPI 3.1, mục 4 cột OpenAPI).

**Phụ thuộc:** Task 1, 4, 5, 10. **Đợt:** 4.

**File sở hữu (tạo):** `packages/core/src/generators/openapi/index.ts`, `generate-openapi.ts`, `generate-openapi.test.ts`, `openapi-schemas.ts`, `openapi-schemas.test.ts`, `openapi-paths.ts`, `openapi-paths.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/openapi/`.

**Chữ ký:**

```ts
export type OpenApiOptions = GeneratorOptions["openapi"];
export function generateOpenApi(schema: SchemaDocument, options: OpenApiOptions): GenerateResult;
// Không export qua index.ts:
export function buildPropertySchema(column: Column, enumTypeNames: ReadonlyMap<EnumId, string>): JsonValue;
export function buildPathItems(resource: RestResource, schema: SchemaDocument, enumTypeNames: ReadonlyMap<EnumId, string>):
  readonly (readonly [string, JsonValue])[]; // cặp [đường dẫn, path item]
```

`index.ts` chỉ export `generateOpenApi` và type `OpenApiOptions`. `file` là `{ fileName: "openapi.json", language: "json", content: JSON.stringify(document, null, 2) + "\n" }`. Mọi object có khóa từ tên người dùng (`paths`, `schemas`, `properties`) dựng bằng `Object.fromEntries`.

**Tài liệu**, khóa theo đúng thứ tự: `openapi: "3.1.1"`; `info: { title: <tên schema>, version: "1.0.0" }`; `servers: [{ url: "/api" }]`; `paths`; `components: { schemas }`.

**`components.schemas`**, tên từ `buildRestApiNames` (enum trước bảng):

- Enum: `{ type: "string", enum: [giá trị theo thứ tự] }`.
- Bảng: `{ type: "object", description?: comment bảng (chỉ khi khác rỗng), properties, required: [mọi tên cột gốc theo columnIds] }`.
- `buildPropertySchema` theo `toJsonFieldType`, đúng bảng spec mục 3: `smallint` → `{ type: "integer", minimum: SMALLINT_MINIMUM, maximum: SMALLINT_MAXIMUM }`; `int32` → `{ type: "integer", format: "int32" }`; `bigintString` → `{ type: "string", pattern: BIGINT_STRING_PATTERN }`; `decimalString` → `{ type: "string", pattern: decimalStringPattern(p, s) }`; `float`, `double` → `{ type: "number", format: "float" | "double" }`; `boolean`; `string` → `{ type: "string", maxLength?: n }`; `uuid` → `format: "uuid"`; `date` → `format: "date"`; `time` → `pattern: TIME_PATTERN`; `localDateTime` → `pattern: LOCAL_DATE_TIME_PATTERN`; `offsetDateTime` → `format: "date-time"`; `json` → `{}`; `base64` → `{ type: "string", contentEncoding: "base64" }`; `enum` → `{ $ref: "#/components/schemas/<tên enum>" }` (enum không tìm thấy → `{ type: "string" }`); `unknown` → `{}` kèm `custom-type-unmapped` tại `["columns", id, "type"]`.
- Nullable: schema có `type` → `type: [T, "null"]`; `$ref` → `{ anyOf: [{ $ref }, { type: "null" }] }`; `{}` giữ nguyên (đã nhận `null`). Comment cột khác rỗng → thêm khóa `description` cuối cùng (cạnh `$ref` hợp lệ ở 3.1).

**`paths`** (`buildPathItems`), theo thứ tự `resources`, đường dẫn bằng `formatOpenApiPath`; response có body dùng `content: { "application/json": { schema } }`; mô tả response cố định tiếng Anh: `OK`, `Created`, `No Content`, `Bad Request`, `Not Found`, `Conflict`:

- Đường dẫn danh sách: `get` (`operationId: "list<Type>"`, 200 với `{ type: "array", items: { $ref } }`); `post` (`create<Type>`, `requestBody: { required: true, content }`, 201 với `$ref`, 400, và 409 chỉ khi bảng có khóa chính).
- Chỉ bảng có khóa chính, đường dẫn dòng: `parameters` ở cấp path item, mỗi tham số `{ name, in: "path", required: true, schema }` với `schema` là `buildPropertySchema` của cột khóa bỏ phần nullable; `get` (`get<Type>`, 200, 404); `put` (`replace<Type>`, body, 200, 400, 404); `delete` (`delete<Type>`, 204, 404).
- Bảng không có khóa chính: chỉ đường dẫn danh sách, kèm `table-without-identifier` tại `["tables", id]`.
- Không có `tags`, `security`, YAML hay thời gian. Schema rỗng: `paths: {}`, `components: { schemas: {} }`.

**Test viết trước:**

- `openapi-schemas.test.ts`: `maps every json field type to an openapi 3.1 schema` (`it.each` 17 loại); `writes nullable types as a type array`; `wraps a nullable enum reference in anyOf with null`; `keeps an empty schema for nullable json`; `adds a column comment as description`; `reports custom-type-unmapped for a custom column`; `writes required with every column in column order`; `writes an enum component with its values`.
- `openapi-paths.test.ts`: `writes list and create operations on the collection path`; `writes get, replace and delete operations with path parameters on the item path`; `writes path parameters in primary key order with non-null schemas`; `writes only the collection path for a table without a primary key and reports table-without-identifier`; `adds 409 to create only when the table has a primary key`; `names operation ids from the component name`.
- `generate-openapi.test.ts`: `names the file openapi.json with language json`; `writes openapi 3.1.1, info with the schema name and version 1.0.0, and servers /api`; `orders top-level keys as openapi, info, servers, paths, components`; `keeps a __proto__ column as a property in the parsed document` (`JSON.parse` rồi `Object.hasOwn`); `writes an empty schema with empty paths and schemas`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture>` (bốn fixture), file `<fixture>.json` và `.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/openapi` và `generateOpenApi(…, {})`, mong đợi `function openapi.json`. Validator `@readme/openapi-parser` do Task 31 viết; task sửa generator này sau khi Task 31 đã merge chạy cổng conformance với `src/openapi.test.ts`.

**Commit:** `feat(core): add openapi 3.1 generator`

## Task 25: CG-09 DBML

**Mục tiêu:** `@schemaforge/core/generators/dbml` export `generateDbml`, tự sinh văn bản DBML mang đủ bảng, cột, kiểu chung, quan hệ, hành động, enum, index, subject area và ghi chú để `@dbml/core` parse được và import lại không mất thông tin (spec CG-09, mục 5 "DBML").

**Phụ thuộc:** Task 1, 4, 5, 7 (`findDefaultValueProblem`). **Đợt:** 6.

**File sở hữu (tạo):** `packages/core/src/generators/dbml/index.ts`, `generate-dbml.ts`, `generate-dbml.test.ts`, `dbml-strings.ts`, `dbml-strings.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/dbml/`.

**Chữ ký:**

```ts
export type DbmlOptions = GeneratorOptions["dbml"];
export function generateDbml(schema: SchemaDocument, options: DbmlOptions): GenerateResult;
// dbml-strings.ts, không export qua index.ts:
export function quoteDbmlIdentifier(name: string): string; // "…", \ → \\, " → \"
export function dbmlString(text: string): string;          // không xuống dòng: '…' với \ → \\, ' → \'; có \r hoặc \n: '''…''' với \ → \\, ''' → \'''
```

`index.ts` chỉ export `generateDbml` và type `DbmlOptions`. `file` là `{ fileName: "schema.dbml", language: "dbml", content }`. Hai hàm escape nằm trong thư mục `dbml/` vì chỉ đích này dùng và `shared/` không có hàm tương đương (ngoại lệ có chủ đích với quy ước "quote trong `generators/shared/`": quy ước cấm viết lại hàm đã có, không cấm hàm riêng của một đích); mọi tên và chuỗi người dùng chỉ đi qua hai hàm này.

**Hành vi**, ghép bằng `renderFileContent`, block theo thứ tự spec:

1. `Project <quoteDbmlIdentifier(tên schema)> {` và `}` (khối rỗng; `@dbml/core` 10.2.0 đã cài nhận khối này, kiểm tra ngày 2026-10-02).
2. Mỗi enum theo `sortEnums` một block: `Enum "tên" {`, mỗi giá trị một dòng `  <quoteDbmlIdentifier(giá trị)>`, `}`. Enum rỗng vẫn ghi khối rỗng (schema có issue `enum-values-empty`; `@dbml/core` từ chối, output vẫn an toàn).
3. Mỗi bảng theo `sortTables` một block: `Table "tên" {`; mỗi cột theo `columnIds` một dòng `  "cột" <kiểu>[ [<thiết lập>]]`; khi có khóa chính nhiều cột hoặc index: `  indexes {` … `  }`; khi comment bảng khác rỗng: `  Note: <dbmlString(comment)>`; `}`.
   - Kiểu ghi bằng tên kiểu chung của core: `smallint`, `integer`, `bigint`, `decimal(p,s)` (không khoảng trắng), `real`, `double`, `boolean`, `char(n)`, `varchar(n)`, `text`, `uuid`, `date`, `time`, `timestamp`, `timestamptz`, `json`, `binary`; enum → `quoteDbmlIdentifier(tên enum)` (không tìm thấy → `text`); custom → `quoteDbmlIdentifier(tên kiểu)`.
   - Thiết lập theo thứ tự, cách nhau `, `: `pk` (khóa chính một cột), `increment`, `not null`, `unique` (cột `isUnique`), `default: …`, `note: <dbmlString(comment cột)>`. Không có thiết lập nào thì không có `[]`.
   - `default`: `findDefaultValueProblem` khác `null` → bỏ, kèm `default-omitted` tại `["columns", id, "defaultValue"]`; `currentTimestamp` → `` `now()` ``; `generateUuid` → `` `gen_random_uuid()` ``; literal `smallint`, `integer`, `bigint`, `decimal`, `real`, `double` ghi trần (đã kiểm tra với 10.2.0: số âm và dạng mũ như `1.5e-3` được nhận), `boolean` → `true`/`false`, kiểu khác → `dbmlString(value)`.
   - `indexes`: khóa chính nhiều cột trước, `    (<cột theo primaryKeyColumnIds>) [pk]`; rồi index theo `sortIndexes`: `    ("a", "b") [unique, name: <dbmlString(tên)>]` hoặc `[name: …]`. Luôn dùng dạng ngoặc, kể cả một cột (10.2.0 nhận `("a")`).
4. Một block `Ref` theo `sortRelations`, mỗi quan hệ một dòng: một cặp cột → `Ref: "posts"."author_id" > "users"."id" [delete: cascade, update: no action]`; nhiều cặp → `Ref: "posts".("a", "b") > "users".("x", "y") […]`, cặp theo thứ tự `columnPairs`. `>` cho `oneToMany`, `-` cho `oneToOne`. Hành động: `no action`, `restrict`, `cascade`, `set null`, `set default`, luôn ghi cả hai. Quan hệ trỏ tới bảng hoặc cột không tìm thấy thì bỏ qua.
5. Mỗi subject area theo `sortSubjectAreas` một block `TableGroup "tên" {`, mỗi bảng thành viên (`subjectAreaId`, theo `sortTables`) một dòng `  "bảng"`, `}`; nhóm rỗng vẫn ghi (10.2.0 nhận).
6. Mỗi ghi chú theo `sortNotes` một block `Note "note <n>" {`, `  <dbmlString(text)>`, `}`, `n` từ 1.

Diagnostic chỉ có `default-omitted`. Không có thời gian. Schema rỗng chỉ có khối `Project`.

**Giới hạn đã biết của `'''…'''`:** `@dbml/core` 10.2 bỏ phần thụt đầu dòng chung của mọi dòng khỏi chuỗi `'''…'''` khi parse (project-reviewer kiểm tra ngày 2026-10-02). Comment hay ghi chú nhiều dòng mà mọi dòng đều bắt đầu bằng khoảng trắng vì vậy mất phần thụt chung khi import lại; DBML không có cú pháp giữ khoảng trắng đó, nên generator không bù và không có diagnostic (output vẫn đúng cú pháp). Task 31 loại trường hợp này khỏi phép so round-trip.

**Test viết trước:**

- `dbml-strings.test.ts`: `quotes identifiers and escapes double quotes and backslashes` (`it.each`); `writes single-line strings in single quotes with escapes`; `writes multi-line strings in triple quotes and escapes a triple quote`.
- `generate-dbml.test.ts`: `names the file schema.dbml with language dbml`; `writes Project, enums, tables, refs, table groups and notes in order`; `writes generic type names including decimal without spaces`; `quotes enum and custom type names`; `writes pk, increment, not null, unique, default and note settings in order`; `writes defaults by kind` (`it.each`); `omits an invalid default and reports default-omitted`; `writes a composite primary key and indexes inside indexes`; `writes a table note`; `writes one-to-many and one-to-one refs with both actions` (`it.each` năm hành động); `writes a composite ref with column lists`; `writes subject areas as table groups`; `numbers notes by note order`; `escapes names and comments with quotes, backslashes and triple quotes`; `writes an empty schema as the Project block`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture>` (bốn fixture), file `<fixture>.dbml` và `.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/dbml` và `generateDbml(…, {})`, mong đợi `function schema.dbml`. Parse và so khớp bằng `@dbml/core` do Task 31 viết; task sửa generator này sau khi Task 31 đã merge chạy cổng conformance với `src/dbml.test.ts`.

**Commit:** `feat(core): add dbml generator`

## Task 26: CG-10 tài liệu Markdown

**Mục tiêu:** `@schemaforge/core/generators/markdown` export `generateMarkdown`, in `schema.md` mô tả enum, bảng, cột, ràng buộc, comment, index và quan hệ, với nhãn do frontend truyền vào (spec CG-10, mục 5 "Markdown").

**Phụ thuộc:** Task 1, 4, 5, 7 (`findDefaultValueProblem`). **Đợt:** 6.

**File sở hữu (tạo):** `packages/core/src/generators/markdown/index.ts`, `generate-markdown.ts`, `generate-markdown.test.ts`, `markdown-text.ts`, `markdown-text.test.ts`; mọi file trong `packages/core/src/generators/__snapshots__/markdown/`.

**Chữ ký:**

```ts
export type MarkdownOptions = GeneratorOptions["markdown"];
export function generateMarkdown(schema: SchemaDocument, options: MarkdownOptions): GenerateResult;
// markdown-text.ts, không export qua index.ts:
export function escapeMarkdownText(text: string): string; // thêm \ trước \ ` * _ { } [ ] ( ) # + - . ! | < > ~
export function formatMarkdownInline(text: string): string; // escapeMarkdownText rồi đổi \r\n, \r, \n thành <br>
```

`index.ts` chỉ export `generateMarkdown` và type `MarkdownOptions`. `file` là `{ fileName: "schema.md", language: "markdown", content }`. Hàm escape nằm trong `markdown/` với cùng lý do như Task 25. Mọi tên, comment, giá trị enum, giá trị mặc định **và mọi nhãn** đều qua `formatMarkdownInline` (nhãn đến từ i18n nhưng vẫn là chuỗi bên ngoài core).

**Hành vi**, ghép bằng `renderFileContent`, mỗi tiêu đề và phần thân là block riêng:

1. `# <tên schema>`.
2. Khi có enum: `## <enumsHeading>`; mỗi enum theo `sortEnums`: `### <tên>` rồi danh sách `- <giá trị>` (enum rỗng chỉ có tiêu đề).
3. Khi có bảng: `## <tablesHeading>`; mỗi bảng theo `sortTables`:
   - `### <tên>`; comment bảng khác rỗng thì một đoạn `formatMarkdownInline(comment)`.
   - Bảng cột (khi bảng có cột): tiêu đề `| <columnNameHeader> | <columnTypeHeader> | <columnNullableHeader> | <columnDefaultHeader> | <columnConstraintsHeader> | <columnCommentHeader> |`, dòng `|---|---|---|---|---|---|`, mỗi cột theo `columnIds` một dòng: tên; kiểu chung như Task 25 (enum → tên enum, custom → tên kiểu); `yes`/`no`; mặc định (literal → giá trị, `currentTimestamp` → `now()`, `generateUuid` → `gen_random_uuid()`, `findDefaultValueProblem` khác `null` → ô rỗng kèm `default-omitted`); ràng buộc là các nhãn `primaryKey` (cột thuộc khóa chính), `unique`, `autoIncrement`, `foreignKey` (cột nguồn của một quan hệ) nối bằng `, `; comment.
   - Khi bảng có index: `#### <indexesHeading>`, bảng `| <indexNameHeader> | <indexColumnsHeader> | <indexUniqueHeader> |`, mỗi index theo `sortIndexes`: tên, tên cột nối `, `, `yes`/`no`.
   - Khi bảng có quan hệ đi ra hoặc đi vào: `#### <relationsHeading>`; nhóm đi ra (`fromTableId` là bảng này, theo `sortRelations`): dòng `<outgoingRelations>` rồi mỗi quan hệ `- <cột nguồn nối , > → <bảng đích>.<cột đích nối , > (<oneToOne|oneToMany>, ON DELETE <HÀNH ĐỘNG>, ON UPDATE <HÀNH ĐỘNG>)`; nhóm đi vào (`toTableId` là bảng này): dòng `<incomingRelations>` rồi `- <bảng nguồn>.<cột nguồn nối , > → <cột đích nối , > (…)`. Hành động ghi bằng từ khóa SQL `NO ACTION`, `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`. Tự tham chiếu xuất hiện ở cả hai nhóm. Nhóm rỗng không ghi.
4. Không có mục lục, liên kết nội bộ, sơ đồ hay thời gian. Kiểu không theo dialect.

Diagnostic chỉ có `default-omitted`. Không có option nào khác `labels`.

**Test viết trước** (test dùng một hằng `TEST_MARKDOWN_LABELS` tiếng Anh khai báo trong file test, đủ 23 khóa của `MarkdownLabels`; snapshot dùng cùng hằng):

- `markdown-text.test.ts`: `escapes every markdown special character` (`it.each`); `keeps letters, digits, spaces and Vietnamese text`; `turns line breaks into <br> after escaping`.
- `generate-markdown.test.ts`: `names the file schema.md with language markdown`; `starts with the schema name as a level one heading`; `lists enums with their values`; `writes a column table with the six labelled headers`; `writes yes and no labels for nullable`; `lists primary key, unique, auto-increment and foreign key constraints`; `writes defaults and omits an invalid one with default-omitted`; `writes the table comment as a paragraph`; `writes an index table only when the table has indexes`; `writes outgoing and incoming relations with kind and actions`; `lists a self-reference in both groups`; `skips empty sections and subsections`; `escapes pipes and line breaks inside table cells`; `escapes labels`; `uses the labels passed in the options`; `returns the same content when map keys were inserted in a different order`.
- Snapshot: `matches the snapshot for <fixture>` (bốn fixture), file `<fixture>.md` và `.diagnostics.txt`.

**Kiểm tra:** như mục "Quy ước chung", thêm lệnh `node` như Task 14 với `@schemaforge/core/generators/markdown`, gọi `generateMarkdown` với một object nhãn tối thiểu đủ 23 khóa, mong đợi `function schema.md`. CG-10 không có conformance (Vấn đề 13).

**Commit:** `feat(core): add markdown documentation generator`

## Task 27: Property test cho mọi generator

**Mục tiêu:** bất biến chung của 12 generator được kiểm tra trên tài liệu đúng cấu trúc có thể còn issue: không throw, xác định (kể cả khi xáo thứ tự khóa map, kể cả khi đồng hồ đổi), an toàn với tên và comment chứa ký tự quote; seed hợp lệ với schema hợp lệ (spec mục 10 "Property test", tiêu chí chung về property test).

**Phụ thuộc:** Task 14–26. **Đợt:** 7.

**File sở hữu (tạo):** `packages/core/src/testing/generator-cases.ts`, `generator-cases.test.ts` (không export qua `@schemaforge/core/testing`), `packages/core/src/generators/generators.properties.test.ts`, `packages/core/src/generators/sql-safety.properties.test.ts`, `packages/core/src/generators/seed/seed.properties.test.ts`.

**Cài đặt:**

- `generator-cases.ts`: `listGeneratorCases(): readonly { readonly name: string; readonly run: (schema: SchemaDocument) => GenerateResult }[]`, một mục cho mỗi biến thể option chính: ba dialect SQL, Prisma × ba provider, Drizzle × hai dialect, TypeScript, Zod, Mock API, OpenAPI, seed × bốn `format` (`rowsPerTable: 3`, `seed: 1`), DBML, Markdown (nhãn tiếng Anh cố định). Import từ `src/generators/<đích>/index.ts`. Test: `lists one case per generator variant` (đủ 18 tên: 3 SQL, 3 Prisma, 2 Drizzle, TypeScript, Zod, Mock API, OpenAPI, 4 seed, DBML, Markdown; không trùng).
- Dùng `PROPERTY_SEED`, `PROPERTY_RUNS`, `schemaDocumentArbitrary`, `keyOrderArbitrary`, `withShuffledKeys` của `src/testing/arbitraries.ts` như `apply-operation.properties.test.ts`; `fc.assert(…, { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS })`, timeout riêng mỗi test (60 000 ms như file mẫu). Không thêm arbitrary vào `arbitraries.ts` (file của phần 2); arbitrary mới đặt trong file test.
- `generators.properties.test.ts` (`describe.each(listGeneratorCases())`):
  - `does not throw for any well-formed document`.
  - `returns the same result when called twice`.
  - `returns the same result when map keys are shuffled` (`withShuffledKeys`).
  - `returns the same result at two different system times`: `vi.useFakeTimers()`, `vi.setSystemTime` hai thời điểm khác nhau (2001-01-01 và 2099-12-31), so `toStrictEqual`; `vi.useRealTimers()` trong `afterEach`.
  - `ends the content with exactly one newline`; `returns diagnostics sorted by path then code without repeats` (so với `finalizeDiagnostics` của chính nó).
- `sql-safety.properties.test.ts`: arbitrary dựng từ `schemaDocumentArbitrary()` rồi thay mọi tên (schema, bảng, cột, index, enum, subject area), comment, giá trị enum, literal mặc định và tên kiểu custom bằng chuỗi `§` nối với chuỗi lấy từ `fc.string` trên bảng ký tự `"`, `'`, `` ` ``, `[`, `]`, `\`, `*/`, `/*`, `--`, `;`, `\n`, `\r`, U+0000, `a`, `é`; tài liệu mới dựng lại qua JSON rồi `parseSchemaDocument` (bảo đảm đúng cấu trúc). Với output của `generatePostgresql`, `generateMysql`, `generateSqlServer` và seed SQL ba dialect: bỏ mọi định danh và chuỗi đã quote bằng regex theo dialect (PostgreSQL `"(?:[^"]|"")*"` và `'(?:[^']|'')*'`; MySQL `` `(?:[^`]|``)*` `` và `'(?:[^'\\]|''|\\[\s\S])*'`; SQL Server `\[(?:[^\]]|\]\])*\]` và `N'(?:[^']|'')*'`), test `leaves no user text outside quoted identifiers and strings` khẳng định phần còn lại không chứa `§`. Thêm `writes no unsafe custom type name outside a string` (kiểm tra tương tự với tên kiểu custom không qua cú pháp an toàn).
- `seed.properties.test.ts`: với `createSampleSchema()`, `createNamingEdgeSchema()`, `createTargetLimitSchema()` (`it.each`) và `fc.integer({ min: 0, max: 0xffffffff })` cho `seed`, `fc.integer({ min: 1, max: 20 })` cho `rowsPerTable`: `produces a dataset that passes validateSeedDataset`; `produces the same dataset for the same seed`.

**Kiểm tra:** như mục "Quy ước chung". Ghi thời gian chạy của ba file vào execution log; `pnpm --filter @schemaforge/core test` phải dưới 5 phút trên máy dev, nếu không thì giảm `numRuns` riêng cho file chậm (ghi lý do), không giảm `PROPERTY_RUNS` chung.

**Commit:** `test(core): add property tests for code generators`

## Task 28: Benchmark generator

**Mục tiêu:** đo mục tiêu hiệu năng của spec mục 9 bằng `vitest bench` trên `createLargeSchema({ tableCount: 200 })`, ngoài `pnpm test`.

**Phụ thuộc:** Task 14–26, 27 (`listGeneratorCases()`). **Đợt:** 8.

**File sở hữu:** tạo `packages/core/src/generators/generators.bench.ts`; sửa `packages/core/package.json` (chỉ thêm script `"bench": "vitest bench --run"` sau `"test"`).

**Cài đặt:**

- Một `describe` với một `bench` cho mỗi biến thể của `listGeneratorCases()` (Task 27), schema dựng một lần ngoài `bench`; thêm `bench("seed postgresql with 100 rows per table", …)` gọi `generateSeed(schema, { format: "postgresql", rowsPerTable: 100, seed: 1 })`. Không có `expect` trong `bench`. Một lần ngoài `bench`, ở cấp module ngay sau khi dựng schema: khẳng định `buildSeedDataset(schema, { rowsPerTable: 100, seed: 1 }).dataset.tables` có ít nhất một bảng có dòng (throw `Error` nếu không), để bench seed không đo một dataset rỗng khi mọi bảng bị bỏ (Task 4: vòng khóa ngoại của `createLargeSchema` là nullable nên thành quan hệ hoãn). Task 1 đã loại `*.bench.ts` khỏi build và coverage; `vitest run` không chạy file bench.
- Vitest in `min`, `max`, `mean`, `p75`, `p99`… nhưng không in trung vị; mục tiêu "trung vị ≤ 100 ms" (spec mục 9) được đọc theo cột `p75` (chặt hơn trung vị): mỗi generator `p75` ≤ 100 ms, seed 100 dòng `p75` ≤ 500 ms.

**Test viết trước:** không có test đơn vị (file bench không phải test). Bước đỏ là chạy `pnpm --filter @schemaforge/core bench` trước khi có script: lệnh báo thiếu script.

**Kiểm tra:** như mục "Quy ước chung", thêm `pnpm --filter @schemaforge/core bench` (Node 24, máy dev, không chạy việc nặng khác). Execution log ghi bảng kết quả (tên, `mean`, `p75`, `p99`) và cấu hình máy. Biến thể nào vượt mục tiêu thì không sửa generator trong task này: ghi rõ, báo `Dừng giữa chừng`, orchestrator tạo task tối ưu riêng.

**Commit:** `perf(core): add generator benchmarks`

## Task 29: Conformance DDL và seed SQL trên ba database

**Mục tiêu:** DDL của CG-01 và seed SQL của CG-08 chạy không lỗi trên PostgreSQL 18, MySQL 8.4 và SQL Server 2022 với mọi fixture, và database tạo ra có đúng những gì generator hứa (spec mục 7 dòng CG-01, CG-08; tiêu chí CG-01, CG-08).

**Phụ thuộc:** Task 8, 14, 15, 16, 22. **Đợt:** 7. Cần Docker.

**File sở hữu (tạo):** `packages/codegen-conformance/src/postgresql.test.ts`, `mysql.test.ts`, `sqlserver.test.ts`, `seed-sql.test.ts`. Chỉ import helper của `src/support/` và `@schemaforge/core`, `@schemaforge/core/testing`, `@schemaforge/core/generators/<đích>`.

**Cài đặt chung:** mỗi file `beforeAll` khởi động server bằng `startDatabaseServer(dialect)`, `afterAll` gọi `stop()`; `describe.each(listConformanceFixtures())`, mỗi fixture một database mới tên `f_<chỉ số>` (tránh ký tự đặc biệt) đóng trong `afterEach`. Schema đưa vào generator là `withDialectCustomTypes(fixture.schema, dialect)`. Output rỗng (`content.trim()` rỗng, fixture `empty`) thì không gọi `execute` (driver MySQL từ chối câu rỗng) và chỉ khẳng định số bảng là 0. Query kiểm tra viết bằng SQL cố định trong test, tên bảng, cột lấy từ schema và đưa vào bằng tham số của driver hoặc so trong JavaScript, không nối vào SQL.

**`postgresql.test.ts`, `mysql.test.ts`, `sqlserver.test.ts`**, mỗi fixture:

- `runs the ddl without errors and creates every table`: `execute(file.content)` không lỗi; `countTables()` bằng số bảng của schema.
- `creates one foreign key per relation that the generator kept`: đếm khóa ngoại trong catalog (PostgreSQL, MySQL `information_schema.TABLE_CONSTRAINTS` với `CONSTRAINT_TYPE = 'FOREIGN KEY'`; SQL Server `sys.foreign_keys`) bằng số quan hệ trừ số diagnostic `key-column-type-not-indexable` tại đường dẫn `["relations", …]` của output.
- Riêng `mysql.test.ts`: `stores truncated comments at the MySQL limits` (fixture `target-limit`: `CHAR_LENGTH(COLUMN_COMMENT)` của cột comment dài là 1024, `CHAR_LENGTH(TABLE_COMMENT)` của bảng comment dài là 2048); `keeps columns that differ only by an accent` (fixture `naming-edge`: `information_schema.COLUMNS` của bảng `người dùng` có cả `ma` lẫn `má`, không đổi tên, vì MySQL so định danh phân biệt dấu, spec R20); `uses the accent-sensitive collation` (`TABLE_COLLATION` là `utf8mb4_0900_as_ci` cho mọi bảng).
- Riêng `sqlserver.test.ts`: `stores truncated descriptions at 3750 characters` (`sys.extended_properties`, `LEN(CAST(value AS nvarchar(max)))` lớn nhất là 3750); `writes cascade conflicts as no action` (fixture `target-limit`: mọi khóa ngoại của quan hệ có `referential-action-cycle` có `delete_referential_action_desc` và `update_referential_action_desc` là `NO_ACTION` trong `sys.foreign_keys`); `accepts more than one null in a filtered unique index` (chèn hai dòng có `NULL` ở cột unique nullable không được tham chiếu của `target-limit`).
- Riêng `postgresql.test.ts`: `stores comments with every quote character` (fixture `naming-edge`: `obj_description` của bảng `người dùng` bằng comment gốc).

**`seed-sql.test.ts`:** một `describe` cho mỗi dialect (khởi động và dừng server trong `beforeAll`, `afterAll` của `describe` đó, tuần tự), mỗi fixture: chạy DDL rồi `generateSeed(schema, { format: dialect, rowsPerTable: 5, seed: 1 })` trong cùng database. Test: `runs the seed after the ddl without errors`; `inserts the row count of the dataset into every table` (`countRows(tên bảng)` bằng số dòng của bảng trong `buildSeedDataset(schema, { rowsPerTable: 5, seed: 1 })`, bảng bị bỏ là 0); `fills deferred relations by update` (fixture `target-limit`, PostgreSQL: cột khóa ngoại của quan hệ hoãn có giá trị khác `NULL` sau khi chạy).

**Test viết trước:** chính các test trên; bước đỏ là chạy file khi generator có lỗi đã biết, hoặc nếu mọi thứ xanh ngay thì ghi rõ trong execution log rằng test xanh từ lần đầu và kiểm tra test bắt được lỗi bằng cách tạm sửa một câu SQL trong bản sao output ở test cục bộ (không commit).

**Kiểm tra:** mục "Conformance của task generator" với lần lượt bốn file, và `pnpm test:conformance` ở root một lần cuối. Conformance đỏ là lỗi của generator: dừng, ghi output lỗi nguyên văn, orchestrator tạo task sửa generator (task này không sửa `packages/core`).

**Commit:** `test: add ddl and seed sql conformance tests`

## Task 30: Conformance Prisma, Drizzle, TypeScript, Zod

**Mục tiêu:** output CG-02 qua `prisma validate` không cảnh báo với ba provider; CG-03, CG-04, CG-05 qua typecheck strict với thư viện đã cài; schema Zod parse được seed JSON của cùng fixture (spec mục 7 các dòng CG-02 đến CG-05; tiêu chí CG-02 đến CG-05).

**Phụ thuộc:** Task 8, 17, 18, 19, 20, 22. **Đợt:** 7.

**File sở hữu (tạo):** `packages/codegen-conformance/src/prisma.test.ts`, `drizzle.test.ts`, `typescript.test.ts`, `zod.test.ts`.

**Cài đặt** (`describe.each(listConformanceFixtures())`, fixture nguyên trạng, không `withDialectCustomTypes`):

- `prisma.test.ts`, `it.each` ba provider: `passes prisma validate without warnings`: `runPrismaValidate(content)` có `exitCode` 0 và `output` không chứa `warn` (không phân biệt hoa thường). Log ghi dòng phiên bản Prisma in ra. Nếu fixture `naming-edge` đỏ vì comment `///` chứa U+0000 thì dừng và báo (spec giữ nguyên comment ở Prisma; orchestrator quyết định), không sửa test.
- `drizzle.test.ts`, `it.each` `postgresql`, `mysql`: `typechecks with drizzle-orm`: `typecheckFiles([{ fileName: "schema.ts", content }])` rỗng. Thêm `builds table configs for every table`: ghi file vào `withTempDirectory`, `await import(pathToFileURL(file).href)` (Vitest chuyển TypeScript), với mỗi export là bảng gọi `getTableConfig` của `drizzle-orm/pg-core` hoặc `drizzle-orm/mysql-core`; tổng số `foreignKeys` bằng số quan hệ không bị bỏ (spec mục "Rủi ro": callback tham chiếu bảng khai báo sau).
- `typescript.test.ts`: `typechecks the generated types`: `typecheckFiles([{ fileName: "types.ts", content }])` rỗng.
- `zod.test.ts`: `typechecks the generated schemas`; `parses every seed json row with the schema of its table`: sinh `seed.json` bằng `generateSeed(schema, { format: "json", rowsPerTable: 5, seed: 1 })`, import `schemas.ts` như trên; với mỗi bảng trong seed JSON, ứng viên là các export `ZodObject` có tập key của `shape` bằng tập tên cột của bảng cùng tên trong schema; dòng hợp lệ khi `safeParse` thành công với ít nhất một ứng viên (tên biến schema là nội bộ của core nên khớp theo tập key; bảng không cột bị bỏ qua). Mọi dòng phải hợp lệ.

**Test viết trước:** như Task 29.

**Kiểm tra:** mục "Conformance của task generator" với lần lượt bốn file, và `pnpm test:conformance` ở root một lần cuối. Đỏ thì dừng như Task 29.

**Commit:** `test: add prisma, drizzle, typescript and zod conformance tests`

## Task 31: Conformance Mock API, OpenAPI, DBML

**Mục tiêu:** `handlers.ts` qua typecheck với `msw` 2 và chạy đủ route trên `msw/node`; `openapi.json` hợp lệ theo `@readme/openapi-parser`; DBML parse được bằng `@dbml/core` và khớp schema (spec mục 7 các dòng CG-06, CG-07, CG-09; tiêu chí CG-06, CG-07, CG-09).

**Phụ thuộc:** Task 8, 23, 24, 25. **Đợt:** 7.

**File sở hữu (tạo):** `packages/codegen-conformance/src/mock-api.test.ts`, `openapi.test.ts`, `dbml.test.ts`.

**Cài đặt:**

- `mock-api.test.ts`, mỗi fixture: `typechecks with msw`. Thêm `serves the crud routes of a single-key and a composite-key table` cho `sample` và `target-limit`: import `handlers.ts` từ thư mục tạm, `setupServer(...handlers)` của `msw/node`, `listen({ onUnhandledRequest: "error" })`, `close()` cuối test. Đường dẫn và tham số lấy từ `paths` của `generateOpenApi` cùng fixture (không import nội bộ core): bảng một cột khóa là đường dẫn dòng đầu tiên có một tham số, bảng nhiều cột khóa là đường dẫn đầu tiên có từ hai tham số (fixture không có thì bỏ qua phần đó và ghi vào log). Chỉ chọn bảng có mọi cột khóa không phải kiểu `json`: `hasKey` của Task 23 so khóa bằng `String()`, nên khóa `json` thành `"[object Object]"` và khớp mọi dòng, làm bước "GET lại (404)" sai; không sửa `hasKey` (fixture không có bảng phù hợp thì xử lý như trường hợp thiếu đường dẫn ở trên). Gọi `fetch("http://localhost/api…")` theo thứ tự: GET danh sách (200, 5 dòng), GET dòng đầu (200), PUT dòng đó với một cột không khóa đổi giá trị (200, khóa giữ nguyên), DELETE (204), GET lại (404), POST lại dòng ban đầu (201), POST lần nữa (409), POST `[]` (400).
- `openapi.test.ts`, mỗi fixture: `is a valid openapi 3.1 document`: `validate()` của `@readme/openapi-parser` trên object đã `JSON.parse` cho `valid` là `true` (in lỗi khi sai). Kiểm tra tên export và kiểu kết quả trong typings đã cài trước khi viết.
- `dbml.test.ts`, mỗi fixture: `parses with @dbml/core`: `new Parser().parse(content, "dbmlv2")` không throw. `matches the schema`: từ model trả về (đọc typings đã cài để lấy đường dẫn thuộc tính), so với schema: tên bảng theo thứ tự; tên cột và tên kiểu của từng bảng; số quan hệ cùng hai hành động của từng quan hệ; tên enum và giá trị; tên index và cột; tên nhóm và bảng thành viên; số ghi chú và nội dung. Chuỗi nhiều dòng (comment bảng, comment cột, ghi chú) mà mọi dòng đều bắt đầu bằng khoảng trắng bị loại khỏi phép so nội dung, vì `@dbml/core` 10.2 bỏ thụt đầu dòng chung của `'''…'''` (giới hạn đã biết của Task 25); chỉ so số lượng của chúng. Fixture `empty` chỉ khẳng định không có bảng.

**Test viết trước:** như Task 29.

**Kiểm tra:** mục "Conformance của task generator" với lần lượt ba file, và `pnpm test:conformance` ở root một lần cuối. Đỏ thì dừng như Task 29.

**Commit:** `test: add mock api, openapi and dbml conformance tests`

## Task 32: Dependency `shiki` cho frontend

**Mục tiêu:** frontend có `shiki` để Task 33 highlight code trong worker (spec mục 8 "Highlight", mục "Phiên bản").

**Phụ thuộc:** P3, Task 3 (hai task cùng ghi lockfile, không chạy đồng thời). **Đợt:** 7 (bắt đầu được ngay khi Task 3 đã merge).

**File sở hữu (sửa):** `frontend/package.json` (chỉ `dependencies`), `pnpm-lock.yaml`.

**Cài đặt:**

- Trước khi cài, chạy `npm view shiki dist-tags time --json` và chọn bản mới nhất của nhánh 4 đã phát hành quá 24 giờ (`minimumReleaseAge`); ngày 2026-10-02, 4.5.0 phát hành 2026-10-01 06:46 UTC. Khai báo `"shiki": "^4.4.3"` như mục "Phiên bản"; ghi bản thật được cài vào execution log.
- `pnpm --filter @schemaforge/frontend add shiki@^4.4.3`. Nếu pnpm báo build script bị bỏ qua thì dừng và báo (Task 32 không sở hữu `pnpm-workspace.yaml`).
- Đọc typings đã cài và ghi vào execution log đường import thật của: `createHighlighterCore`, `createCssVariablesTheme` (dự kiến `shiki/core`), `createJavaScriptRegexEngine` (dự kiến `shiki/engine/javascript`), và năm grammar `sql`, `prisma`, `typescript`, `json`, `markdown` (dự kiến `@shikijs/langs/<tên>` hoặc `shiki/langs/<tên>.mjs`), cùng cách import không đi qua bundle đầy đủ của `shiki`. Task 33 dùng đúng các đường này.

**Test viết trước:** không có (chỉ dependency). Bước kiểm chứng là lệnh `node` dưới đây chạy được sau khi cài.

**Kiểm tra:**

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm install --frozen-lockfile
pnpm --filter @schemaforge/frontend exec node --input-type=module -e 'const core = await import("shiki/core"); const engine = await import("shiki/engine/javascript"); console.log(typeof core.createHighlighterCore, typeof core.createCssVariablesTheme, typeof engine.createJavaScriptRegexEngine)'
pnpm --filter @schemaforge/frontend typecheck
pnpm --filter @schemaforge/frontend lint
pnpm --filter @schemaforge/frontend test
pnpm exec prettier --check frontend/package.json
git status --porcelain
```

Mong đợi: lệnh `node` in `function function function` (đường import khác thì ghi đường thật vào log); các lệnh khác thoát mã 0; `git status` chỉ có hai file của task.

**Commit:** `build(frontend): add shiki for code highlighting`

## Task 33: Worker sinh code và highlight

**Mục tiêu:** luồng chính không bao giờ chạy generator: một Web Worker nhận `{ requestId, target, options, document }`, `import()` động subpath của đích và grammar Shiki khi cần, trả `{ requestId, file, diagnostics, tokens }`; hook `useGeneratedCode` gửi yêu cầu và bỏ kết quả cũ (spec mục 8 "Cập nhật", "Highlight", "CSP", mục 9; Vấn đề 14).

**Phụ thuộc:** Task 5, 14–26, 32, P3. **Đợt:** 9.

**File sở hữu (tạo), trong `frontend/src/features/editor/code-generator/`:** `worker-protocol.ts`, `worker-protocol.test.ts`, `generator-registry.ts`, `generator-registry.test.ts`, `highlight-code.ts`, `highlight-code.test.ts`, `code-generator.worker.ts`, `code-generator.worker.test.ts`, `use-generated-code.ts`, `use-generated-code.test.tsx`. Không có chuỗi hiển thị (Task 34 làm giao diện và i18n).

**Chữ ký và hành vi:**

```ts
// worker-protocol.ts
export type CodeToken = { readonly content: string; readonly color: string | null }; // color dạng var(--code-…)
export type GenerateCodeRequest<T extends GeneratorTarget = GeneratorTarget> = {
  readonly requestId: number; readonly target: T; readonly options: GeneratorOptions[T]; readonly document: SchemaDocument;
};
export type GenerateCodeResponse =
  | { readonly requestId: number; readonly kind: "ok"; readonly file: GeneratedFile;
      readonly diagnostics: readonly GeneratorDiagnostic[]; readonly tokens: readonly (readonly CodeToken[])[] | null }
  | { readonly requestId: number; readonly kind: "failed" };
export function isGenerateCodeRequest(value: unknown): value is GenerateCodeRequest;
// generator-registry.ts
export function loadGenerator<T extends GeneratorTarget>(target: T): Promise<Generate<T>>;
// highlight-code.ts
export type HighlightLanguage = "sql" | "prisma" | "typescript" | "json" | "markdown";
export function toHighlightLanguage(language: OutputLanguage): HighlightLanguage | null; // dbml → null
export function highlightCode(code: string, language: HighlightLanguage): Promise<readonly (readonly CodeToken[])[]>;
// use-generated-code.ts
export type GeneratedCodeState =
  | { readonly status: "idle" } | { readonly status: "loading"; readonly previous: GenerateCodeResponse | null }
  | { readonly status: "ready"; readonly response: Extract<GenerateCodeResponse, { kind: "ok" }> }
  | { readonly status: "failed" };
export function useGeneratedCode(input: {
  readonly isEnabled: boolean; readonly document: SchemaDocument; readonly target: GeneratorTarget;
  readonly options: GeneratorOptions[GeneratorTarget]; readonly createWorker?: () => Worker;
}): GeneratedCodeState;
```

- `isGenerateCodeRequest`: kiểm tra `requestId` là số nguyên, `target` thuộc `GENERATOR_TARGETS`, `options` và `document` là object; worker bỏ qua message không qua (không parse lại tài liệu: tài liệu đến từ store đã hợp lệ).
- `loadGenerator`: một record ánh xạ ở cấp module, `const loaders: { readonly [K in GeneratorTarget]: () => Promise<Generate<K>> } = { postgresql: async () => (await import("@schemaforge/core/generators/postgresql")).generatePostgresql, … }`, thân hàm là `return loaders[target]();`. Mỗi mục dùng một `import("@schemaforge/core/generators/<đích>")` với chuỗi literal (để bundler tách chunk theo đích) và trả hàm theo bảng tên của Task 5. Kiểu mapped bắt thiếu đích lúc biên dịch, nên không cần kiểm tra vét cạn. Không dùng `switch`: `switch` trên tham số generic `T` không thu hẹp `T`, nên mỗi nhánh trả `Generate<"postgresql">`… cho `Promise<Generate<T>>` và báo TS2322 với TypeScript 6.0.3 strict (project-reviewer đã thử ngày 2026-10-02). Kiểu tham số option được thu hẹp ở nơi gọi qua `GenerateCodeRequest<T>`; không dùng `as` ngoài `as const`.
- `highlightCode`: một promise highlighter tạo lười ở cấp module của worker bằng `createHighlighterCore({ themes: [createCssVariablesTheme({ name: "schemaforge", variablePrefix: "--code-", variableDefaults: {}, fontStyle: true })], langs: [], engine: createJavaScriptRegexEngine() })`; grammar nạp bằng `import()` động theo ngôn ngữ ở lần dùng đầu (`loadLanguage`), đúng đường import Task 32 ghi trong log. `codeToTokens(code, { lang, theme: "schemaforge" })` → mỗi dòng một mảng `{ content, color }` (`color` là `token.color` hoặc `null`). Không tạo HTML string.
- `code-generator.worker.ts`: **dòng import đầu tiên là `import "@/lib/zod-config";`** (như `frontend/src/components/app-providers.tsx`), đứng trước mọi import khác, vì core tạo schema Zod lúc được import và Zod đọc `jitless` khi tạo schema. `self.onmessage`: bỏ message không hợp lệ; `loadGenerator(target)` rồi gọi với `document`, `options`; `toHighlightLanguage(file.language)` khác `null` thì `highlightCode`; `postMessage` kết quả `ok`. Lỗi bất kỳ (kể cả `RangeError` của option) → `{ requestId, kind: "failed" }`, không log nội dung tài liệu.
- `useGeneratedCode`: tạo worker lười khi `isEnabled` lần đầu, bằng `createWorker` hoặc mặc định `new Worker(new URL("./code-generator.worker.ts", import.meta.url), { type: "module" })`; `terminate()` khi unmount. Mỗi lần `document`, `target`, `options` đổi (so tham chiếu; tài liệu chỉ đổi khi commit thao tác nên không debounce) gửi yêu cầu với `requestId` tăng dần (giữ trong `useRef`); phản hồi có `requestId` khác yêu cầu mới nhất bị bỏ. `isEnabled` sai thì không gửi và trả `idle`.

**Test viết trước** (Vitest của frontend; worker mock ở biên bằng một lớp giả có `postMessage`, `terminate`, `onmessage`):

- `worker-protocol.test.ts`: `accepts a well-formed request`; `rejects a request with an unknown target, a non-integer id or a missing document` (`it.each`).
- `generator-registry.test.ts`: `loads a generate function for every generator target` (`it.each(GENERATOR_TARGETS)`, gọi với `createEmptySchema("Empty")` và option tối thiểu, kết quả có `file.content` là chuỗi).
- `highlight-code.test.ts`: `maps output languages to highlight languages and dbml to null`; `tokenizes sql into lines of colored tokens` (màu bắt đầu bằng `var(--code-`); `tokenizes prisma, typescript, json and markdown` (`it.each`); `loads each grammar once`.
- `code-generator.worker.test.ts`: `imports zod-config before any other module` (đọc file nguồn bằng `node:fs` trong test, dòng import đầu là `import "@/lib/zod-config";`); `answers a request with the file, diagnostics and tokens`; `answers failed when the generator throws`; `ignores a malformed message`.
- `use-generated-code.test.tsx`: `stays idle and creates no worker while disabled`; `sends a request when enabled`; `sends a new request when the document, target or options change`; `ignores a stale response`; `reports failed for a failed response`; `terminates the worker on unmount`.

**Kiểm tra:**

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm --filter @schemaforge/core build
pnpm --filter @schemaforge/frontend typecheck
pnpm --filter @schemaforge/frontend lint
pnpm --filter @schemaforge/frontend test
pnpm --filter @schemaforge/frontend build
head -n 1 frontend/src/features/editor/code-generator/code-generator.worker.ts
pnpm exec prettier --check frontend/src/features/editor/code-generator
git status --porcelain
```

Mong đợi: mọi lệnh thoát mã 0, không vi phạm ngưỡng coverage; `head` in `import "@/lib/zod-config";`; `next build` (Turbopack) tạo chunk worker riêng (ghi tên chunk vào log; spec mục "Rủi ro" dòng Next.js 16). Đo một lần thời gian tách token output TypeScript của `createLargeSchema({ tableCount: 200 })` trong test cục bộ không commit và ghi vào log (spec mục "Rủi ro" dòng Shiki).

**Commit:** `feat(frontend): add code generation worker and highlighting`

## Task 34: Code panel, nút "Code", i18n và CSP

**Mục tiêu:** người dùng mở code panel ở cột phải, chọn đích và option, xem code có highlight, copy, xem diagnostic đã dịch và bấm để tới phần tử, thấy cảnh báo khi schema còn issue (spec mục 8, mục 10 dòng "Frontend"; Vấn đề 2, 11, 14).

**Phụ thuộc:** Task 33, 36. **Đợt:** 10.

**File sở hữu:**

- Tạo trong `frontend/src/features/editor/code-generator/`: `code-panel.tsx`, `generator-target-select.tsx`, `generator-options.tsx`, `code-view.tsx`, `generator-diagnostic-list.tsx`, `generator-request.ts`, mỗi file kèm test (`.test.tsx` hoặc `.test.ts`).
- Tạo `frontend/src/features/editor/hooks/use-go-to-issue.ts`, `use-go-to-issue.test.tsx`.
- Sửa `frontend/src/features/editor/state/create-editor-store.ts` và test của nó, `components/toolbar/editor-toolbar.tsx` và `editor-toolbar.test.tsx`, `components/editor-workspace.tsx` và `editor-workspace.test.tsx`, `components/panels/issue-list-tab.tsx` (dùng hook mới, test có sẵn phải pass nguyên vẹn).
- Tạo `frontend/src/lib/i18n/locales/{en,vi}/code-generator.ts`, `generator-diagnostics.ts` và `frontend/src/lib/i18n/code-generator-messages.test.ts`; sửa `frontend/src/lib/i18n/resources.ts` (và `resources.test.ts` nếu test ghim danh sách namespace).
- Sửa `frontend/src/lib/security/content-security-policy.ts` và test của nó; `frontend/src/app/globals.css` (chỉ thêm biến `--code-*`).

**Chữ ký và hành vi:**

- Store (spec mục 8: không lưu khi tải lại trang): `rightPanelMode: "properties" | "code"` (mặc định `properties`), `setRightPanelMode`; `codeTarget: CodeTarget` với `CodeTarget = "sql" | "prisma" | "drizzle" | "typescript" | "zod" | "mock-api" | "openapi" | "seed" | "dbml" | "markdown"` (mặc định `sql`); `codeOptions: { sqlDialect: SqlDialect; prismaProvider: SqlDialect; drizzleDialect: "postgresql" | "mysql"; seedFormat: SqlDialect | "json"; seedRowsPerTable: number; seedSeed: number }` (mặc định `postgresql`, `postgresql`, `postgresql`, `postgresql`, 10, 1), `setCodeTarget`, `updateCodeOptions(patch)`. Chọn phần tử trên canvas không đổi `rightPanelMode`.
- `generator-request.ts`: `toGeneratorRequest(target: CodeTarget, options: CodeOptions, markdownLabels: MarkdownLabels): { target: GeneratorTarget; options: GeneratorOptions[GeneratorTarget] }` (`sql` → `sqlDialect`; `markdown` nhận nhãn); `clampSeedRowsPerTable` kẹp về 1–1000 và `clampSeed` về 0–`0xffffffff` cho ô nhập (giao diện chặn giá trị sai để core không throw).
- Toolbar: nút "Code" là `<Button aria-pressed={rightPanelMode === "code"}>` bật tắt chế độ, nhãn qua `codeGenerator:toggle`.
- `editor-workspace.tsx`: chế độ `properties` giữ `PropertiesPanel`; chế độ `code` hiện `CodePanel` tải bằng `next/dynamic` (`ssr: false`, fallback là khung rỗng cùng độ rộng) trong cột `w-[32rem]` (quyết định của plan: đủ cho dòng DDL thường gặp mà canvas vẫn còn chỗ; `PropertiesPanel` giữ `w-80`). Cột code giữ `id` của cột phải để link "bỏ qua tới panel" vẫn đúng.
- `useGoToIssue(options: { readonly shouldRequestFocus: boolean })` tách nguyên văn từ `issue-list-tab.tsx` sang `hooks/use-go-to-issue.ts`; `IssueListTab` gọi với `true` (hành vi cũ); danh sách diagnostic gọi với `false` (panel vẫn ở chế độ code, không có ô thuộc tính để nhận focus).
- `CodePanel`, từ trên xuống (spec mục 8): `GeneratorTargetSelect` (10 đích); `GeneratorOptions` (dialect cho SQL; provider cho Prisma; dialect Drizzle có SQL Server hiện nhưng `disabled` kèm chú thích; `format`, số dòng, seed cho Seed data; Markdown không có option); cảnh báo khi `getIssueIndex(document)` có issue (số lượng, nút mở tab `issues` bằng `setLeftPanelTab("issues")`); `CodeView`; `GeneratorDiagnosticList`. Dùng `useGeneratedCode` với `isEnabled` đúng khi panel đang mở; trạng thái `loading` giữ code cũ và báo bận bằng `aria-busy`; `failed` hiện thông báo lỗi đã dịch.
- `CodeView`: `<pre tabIndex={0} aria-label={t("codeGenerator:codeArea", { target })}>` cuộn hai chiều; token render thành `<span style={{ color }}>` (không HTML string, không `dangerouslySetInnerHTML`); `tokens` là `null` (DBML) thì hiện văn bản thô. Nút "Copy" gọi `navigator.clipboard.writeText(file.content)` rồi `notify` thành công, bị từ chối thì `notify` lỗi (qua `useNotify` của phần 3).
- `GeneratorDiagnosticList`: tiêu đề có số lượng; mỗi dòng là nút có thông báo `t(\`generatorDiagnostics:${code}\`, variables)` với biến lấy từ `resolveIssueTarget` như `IssueRow`; bấm gọi `useGoToIssue({ shouldRequestFocus: false })`.
- i18n: namespace `codeGenerator` (`vi`, `en`): tên 10 đích, nhãn option và giá trị dialect, chú thích Drizzle SQL Server, `toggle`, `copy`, `copied`, `copyFailed`, `codeArea`, `loading`, `failed`, cảnh báo issue có số nhiều, `openIssues`, tiêu đề diagnostic có số lượng, và object `markdownLabels` đủ 23 khóa của `MarkdownLabels` (`satisfies MarkdownLabels`). Namespace `generatorDiagnostics`: 17 mã, `satisfies Record<GeneratorDiagnosticCode, string>`, biến nội suy chỉ dùng tên có trong `resolveIssueTarget` (`table`, `column`, `index`, `relation`, `enum`). Mã `SeedIssue` không có bản dịch (Vấn đề 11). Đăng ký hai namespace trong `NAMESPACES`, `enResources`, `viResources` của `resources.ts`.
- CSP: `buildContentSecurityPolicy` thêm `worker-src 'self'`; không thêm `'wasm-unsafe-eval'`, `'unsafe-eval'`.
- `globals.css`: biến `--code-foreground`, `--code-background`, `--code-token-constant`, `--code-token-string`, `--code-token-comment`, `--code-token-keyword`, `--code-token-parameter`, `--code-token-function`, `--code-token-string-expression`, `--code-token-punctuation`, `--code-token-link` trong `:root` và `.dark`, trỏ về token màu của shadcn/ui như cách phần 3 làm với `--xy-*`; tương phản với nền panel đạt 4,5:1 ở cả hai theme (kiểm tra tay).

**Test viết trước:**

- Store: `starts in properties mode with sql and default options`; `toggles the right panel mode`; `keeps the code mode when the selection changes`; `updates code options partially`.
- `generator-request.test.ts`: `maps every code target and option to a generator request` (`it.each`); `passes markdown labels`; `clamps rows per table and seed`.
- `use-go-to-issue.test.tsx`: `selects and reveals the element of an issue`; `requests focus only when asked`.
- `editor-toolbar.test.tsx`: `toggles the code panel with an aria-pressed button`.
- `editor-workspace.test.tsx`: `shows the properties panel by default and the code panel in code mode`.
- `code-panel.test.tsx` (worker mock ở biên qua `createWorker`): `sends the selected target and options to the worker`; `shows a warning with the issue count and opens the issues tab`; `shows no warning for a schema without issues`; `disables sql server for drizzle with a note`.
- `code-view.test.tsx`: `renders tokens as spans without html strings`; `renders plain text when there are no tokens`; `copies the code and shows a toast`; `shows an error toast when the clipboard is denied`; `exposes a focusable code region with a label`.
- `generator-diagnostic-list.test.tsx`: `shows translated messages with the element name and a count`; `selects the element on click and keeps the code panel open`.
- `frontend/src/lib/i18n/code-generator-messages.test.ts` (file mới, cạnh `issue-and-error-messages.test.ts` theo cách đặt test của `lib/i18n/`; không sửa `issue-and-error-messages.test.ts`): `translates every generator diagnostic code in vi and en`; `has every markdown label in vi and en`.
- CSP: `allows workers from self only`.

**Kiểm tra:** như Task 33 (không có lệnh `head`), thêm `pnpm --filter @schemaforge/frontend test` có các test trên, và `pnpm exec prettier --check` trên mọi file sở hữu. Execution log ghi các kiểm tra tay đã làm trên `pnpm dev`: mở, đổi đích, copy, bấm diagnostic, bàn phím tới vùng code và nút copy, hai theme.

**Commit:** `feat(frontend): add code generator panel`

## Task 35: Tài liệu, kết quả đo và kiểm tra cuối

**Mục tiêu:** tài liệu khớp với những gì đã làm, mọi tiêu chí hoàn thành của spec được kiểm chứng, và toàn bộ conformance chạy lại một lần trên `master` (spec "Tiêu chí hoàn thành"; Vấn đề 13, 14, 16, 18, 19, 20).

**Phụ thuộc:** Task 27–31, 34. **Đợt:** 11. Cần Docker.

**File sở hữu (sửa):** `document/roadmap.md`, `document/architecture.md`, `CLAUDE.md` (chỉ mục "Commands"), `document/specs/2026-09-14-core-schema-model-design.md` (mục 6, 7, 8, 9 theo bảng "Vấn đề với các spec đã duyệt" của spec phần 6), `document/plans/2026-09-14-core-schema-model-plan.md` (một ghi chú dẫn tới Task 36 của plan này, không đánh dấu tiến độ), `document/specs/2026-09-14-code-generators-design.md` (mục 4 dòng "Quan hệ 1-1" của ma trận SQL, Prisma, Drizzle; CG-03 bullet "Relations v1"; CG-08 bullet "Unique" và đoạn "Quan hệ với AI-06"; mục 8 đường dẫn code; mục 9 kết quả đo). Task này giao cho `spec-writer` vì chỉ sửa `document/` và `CLAUDE.md`; các lệnh kiểm tra do orchestrator chạy và ghi vào log.

**Cài đặt:**

- `roadmap.md`: phần 6 sang "Xong".
- `architecture.md`: chuyển các mục của phần 6 ở "Chưa chốt" (nếu còn) sang "Quyết định đã chốt" (`| Hạng mục | Quyết định | Lý do |`), sửa dòng đã có thay vì thêm bản thứ hai: generator thuần trong core theo subpath, Shiki 4 cho highlight, Testcontainers và conformance local, `@readme/openapi-parser`, MSW 2 cho Mock API, Drizzle 0.45 relations v1.
- `CLAUDE.md`: thêm một câu về `pnpm test:conformance` (cần Docker, cổng chặn của task generator).
- Spec phần 2: mục 8 danh mục 27 mã; mục 7 dòng Index; mục 6 và 9 hành vi `suggestIndexName`.
- Spec phần 6: mục 4 dòng "Quan hệ 1-1" của ma trận, ô Drizzle, đổi `one` ở cả hai phía thành `one` ở phía khóa ngoại; phía ngược `one(source)` chỉ khi quan hệ không có tên (Vấn đề 18); CG-03 bullet "Relations v1" thêm câu: quan hệ 1-1 có tên không có trường phía ngược vì `one()` của `drizzle-orm` 0.45 bắt buộc `fields` khi có config (Vấn đề 18); CG-08 bullet "Unique" đổi "sau đó bỏ dòng và báo `seed-rows-reduced`" thành: hết lượt sinh lại thì dừng sinh bảng đó, giữ các dòng đã có và báo `seed-rows-reduced` (Vấn đề 20); CG-08 đoạn "Quan hệ với AI-06" thêm `parseSeedDataset(input: unknown): Result<SeedDataset, readonly StructuralError[]>` ở subpath `@schemaforge/core/generators/seed`: quét độ sâu bằng stack tường minh rồi kiểm tra hình dạng bằng Zod, mã `invalid-shape`, tối đa 1000 dòng mỗi bảng; kiểm tra theo schema vẫn là `validateSeedDataset` (Vấn đề 19); mục 8 đổi đường dẫn code sang `frontend/src/features/editor/code-generator/` (Vấn đề 14); mục 9 thêm bảng kết quả `vitest bench` từ log Task 28 (ngày đo, máy, `p75` từng generator).

**Kiểm tra** (orchestrator chạy trên `master` sau khi mọi task đã merge, ghi kết quả vào log):

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm build
docker info >/dev/null && pnpm test:conformance --force
git status --porcelain
```

Mong đợi: mọi lệnh thoát mã 0, `pnpm test:conformance --force` chạy lại mọi file (không dùng cache). Kiểm tra tay trên bản build production (`pnpm --filter @schemaforge/frontend build` rồi `start`), không đăng nhập: sinh code cho mọi đích, tab Network không có request ngoài file tĩnh của ứng dụng, Console không có vi phạm CSP; với `createLargeSchema({ tableCount: 200 })` nạp vào editor, đổi đích tới khi code hiện ≤ 1 giây và kéo bảng trong lúc sinh code không giật. Ghi từng kết quả vào log.

**Commit:** `docs: record code generators decisions and mark part 6 done`

## Đối chiếu tiêu chí hoàn thành

| Tiêu chí của spec | Task |
|---|---|
| Chung: mỗi đích có subpath `@schemaforge/core/generators/<đích>`; entry point chính export `GENERATOR_TARGETS`, `GENERATOR_DIAGNOSTIC_CODES`, type option, `MarkdownLabels`, `SeedDataset`; core chỉ có runtime dependency Zod và qua lint ranh giới | 2, 5, 14–26 (mỗi đích một `index.ts`), 22 (`SeedDataset`) |
| Chung: bản build production, không đăng nhập, sinh code mọi đích không có request mạng, không vi phạm CSP | 33, 34 (worker, `worker-src 'self'`), 35 (kiểm tra tay) |
| Chung: conformance mục 7 qua với mọi fixture khi chạy local (`pnpm test:conformance`) | 3, 8, 29, 30, 31, 35 |
| Chung: probe mục 7 chạy local, khớp spec trước khi viết generator MySQL, SQL Server | 8 (điều kiện của 15, 16) |
| Chung: validation phần 2 báo `table-columns-empty`, `index-name-conflicts-table`, có bản dịch; generator không throw với hai issue này | 36, 27 (không throw), 35 (spec phần 2) |
| Chung: property test qua (không throw, xác định kể cả xáo khóa, an toàn với ký tự quote); không output nào có thời gian | 27 |
| Chung: code panel chọn đích, option, highlight, copy, diagnostic đã dịch, cảnh báo issue; component test qua | 32, 33, 34 |
| Chung: mỗi mã diagnostic có test gây ra nó và bản dịch `vi`, `en`; mỗi dòng "tương đương" của ma trận có test không diagnostic | 2, 12, 13, 14–26 (test theo mã), 34 (`generatorDiagnostics`) |
| Chung: comment xuất hiện trong output SQL ba dialect, Prisma, Drizzle, TypeScript, Zod, OpenAPI, DBML, Markdown, kiểm tra bằng snapshot | 14, 15, 16, 17, 18, 19, 20, 24, 25, 26 |
| Chung: `vitest bench` đạt mục tiêu mục 9; mục tiêu giao diện kiểm tra tay | 28, 35 |
| CG-01: ba dialect; đủ phần tử; DDL mọi fixture chạy không lỗi trên ba database | 13, 14, 15, 16, 29, 34 (chọn dialect) |
| CG-02: model, quan hệ hai phía, enum, index; `prisma validate` qua không cảnh báo với ba provider | 17, 30 |
| CG-03: bảng, khóa ngoại, `relations()`, enum, index cho PostgreSQL, MySQL; typecheck strict | 18, 30 |
| CG-04: type mỗi bảng, `\| null`, union chuỗi; typecheck strict | 19, 30 |
| CG-05: schema Zod 4 mỗi bảng, `.nullable()`, `z.enum`; typecheck; seed JSON parse được | 20, 22, 30 |
| CG-06: handler MSW mọi bảng, CRUD khi có khóa chính; typecheck; route chạy trên `msw/node` | 23, 31 |
| CG-07: OpenAPI 3.1 JSON, component bảng và enum, đường dẫn CRUD; `@readme/openapi-parser` hợp lệ | 24, 31 |
| CG-08: SQL ba dialect và JSON; qua `validateSeedDataset`; thứ tự theo tham chiếu, cạnh phá vòng bằng `UPDATE`; chạy sau DDL trên ba database; cùng `seed` cùng output | 21, 22, 27, 29, 30 |
| CG-09: `@dbml/core` parse không lỗi và khớp schema | 25, 31 |
| CG-10: tài liệu đủ bảng, cột, kiểu, ràng buộc, comment, index, quan hệ, enum; nhãn theo ngôn ngữ giao diện | 26, 34 (`markdownLabels`) |
| Khi xong: `roadmap.md` phần 6 "Xong"; quyết định ghi vào `architecture.md` | 35 |
