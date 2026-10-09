# Plan: Import / Export

Plan triển khai phần 7 trong [roadmap.md](../roadmap.md), dựa trên spec đã duyệt [2026-09-15-import-export-design.md](../specs/2026-09-15-import-export-design.md) (commit cea2dae, bản mới nhất trên `master`; mọi quyết định cần xác nhận đã được người dùng xác nhận, xem dòng "Trạng thái" và mục "Câu hỏi đã trả lời" của spec). Spec là nguồn gốc: plan chỉ chia việc, chốt các chi tiết mức cài đặt mà spec để lại, và không đổi quyết định nào của spec. Spec được viết ngày 2026-09-15, trước khi phần 4, phần 6 và phần 10 được merge; chỗ spec lệch với code hiện tại, với rule của repo hoặc với quyết định sau đó được nêu ở mục [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan), và các task được viết theo cột "Đề xuất" của mục đó.

## Mục tiêu

`packages/core` có bốn importer thuần (SQL cho PostgreSQL, MySQL, SQL Server; Prisma; DBML; JSON), mỗi định dạng một subpath `@schemaforge/core/importers/<định dạng>`, dùng chung hợp đồng diagnostic, bản nháp theo tên, cấp id và xếp vị trí trong `importers/shared/`; cùng `buildImportOperation`, `serializeSchemaDocument` ở entry point chính. `@dbml/core` chỉ được import trong một adapter của importer SQL và DBML. Frontend có hộp thoại import chạy importer trong Web Worker hủy được, hai chế độ (tạo schema mới, thêm vào schema hiện tại) đều đi qua một operation và undo được; nút "Tải file" trong code panel; menu Export (JSON, PNG, SVG, ZIP) trên toolbar; nút Import và mục "Tải JSON" ở màn hình danh sách. Conformance với `pg_dump`, `mysqldump`, `prisma db pull`, `prisma validate` chạy local bằng Docker.

## Điều kiện tiên quyết

- Phần 2, 3, 4, 6 và 10 đã merge (roadmap). Mọi task đọc code hiện tại, không dựa vào mô tả cũ trong spec phần 3 hay phần 6.
- Phần 5 (AI) được cài đặt **trước** phần 7 (quyết định của orchestrator ngày 2026-10-03): mọi task của [plan phần 5](2026-10-03-ai-assistant-plan.md) sở hữu các file ở dòng cuối mục "Điểm nóng khi làm song song" đã merge trước khi task phần 7 sở hữu cùng file bắt đầu; task phần 7 rebase lên `master` đã có phần 5. Task 26 và Task 28 của plan này cần Task 22 của plan phần 5 (store editor có `selectIsPreviewing`, viết tắt "AI-22" trong plan này).
- Hàm và module của core mà plan dùng lại, đã có trên `master`: `Result`, `ok`, `err` (`src/result.ts`, kiểm tra nhánh bằng `isOk`); `DocumentPath`, `compareDocumentPaths`, `sortByPathThenCode` (`src/document-path.ts`); `StructuralError`, `StructuralErrorCode`, `STRUCTURAL_ERROR_CODES` (`src/error-codes.ts`); `createEmptySchema`; `create*Id` và `GenerateId` (`src/model/ids.ts`); `toNameKey`, `utf8ByteLength`, `MAX_NAME_BYTES` (`src/model/name-limits.ts`); `sortTables`, `sortSubjectAreas`… (`src/model/ordering.ts`); `applyOperation` (`src/operations/apply-operation.ts`, trả `Result<{ schema, inverse }, OperationError>`); `parseSchemaDocument`; `findIntroducedIssues`; `suggestIndexName`; `isUniqueColumnSet` (`src/validation/column-uniqueness.ts`); `isSafeCustomTypeName` (`src/validation/rules/custom-type-name.ts`); `isValidDefaultLiteral` (`src/validation/rules/default-literals.ts`); hai bản riêng giống nhau của `pickUnusedName` trong `src/operations/build-many-to-many.ts` và `src/operations/build-relation.ts` (Task 6 gộp thành một hàm dùng chung). Fixture: `createSampleSchema`, `createNamingEdgeSchema`, `createTargetLimitSchema`, `createLargeSchema`, `createCounterIdGenerator` (`@schemaforge/core/testing`), arbitrary `schemaDocumentArbitrary`, `PROPERTY_SEED`, `PROPERTY_RUNS` (`src/testing/arbitraries.ts`, nội bộ). Generator: subpath `@schemaforge/core/generators/<đích>` với `generatePostgresql`, `generateMysql`, `generateSqlServer`, `generatePrisma`, `generateDbml`…
- Frontend đã có: worker sinh code `frontend/src/features/editor/code-generator/code-generator.worker.ts` (import đầu tiên là `@/lib/zod-config`), `worker-protocol.ts`, `generator-registry.ts` (`loadGenerator`), `generator-request.ts` (`CodeTarget`, `CodeOptions`, `toGeneratorRequest`), `use-generated-code.ts` (worker tiêm được qua `createWorker`), `code-view.tsx` (nút Copy); store `features/editor/state/create-editor-store.ts` (`dispatch`, `setSelection`, `rightPanelMode`, `codeTarget`, `codeOptions`); toolbar `features/editor/components/toolbar/editor-toolbar.tsx`; canvas `features/editor/components/canvas/editor-canvas.tsx`, `relation-markers.tsx`, `table-node.tsx` (lớp `max-w-80 min-w-56`, không có hằng kích thước); `features/editor/components/editor-workspace.tsx` (tạo store bằng `createEditorStore` trong `useState`); `features/schema-list/components/schema-list-screen.tsx`, `schema-list-row.tsx`, `features/schema-list/hooks/use-schema-actions.ts` (đường "Tạo": `repository.createSchema(name, userId === null ? undefined : { ownerId: userId })` rồi `router.push`); `components/app-providers.tsx`; `lib/storage/storage-context.tsx`, `lib/storage/schema-repository.ts` (`createSchema`, `openSchema`); `components/auth-provider.tsx` (`useAuth`); `lib/notify.ts`, `lib/use-notify.ts`; `lib/logger.ts`; i18n `lib/i18n/resources.ts` (`NAMESPACES`, `enResources`, `viResources`); CSP `lib/security/content-security-policy.ts` (đã có `worker-src 'self'`, `img-src 'self' blob: data:`); helper test `src/testing/render-with-providers.tsx`, `expect-no-axe-violations.ts`, `mount-editor-journey.tsx`, `fake-indexeddb`.
- Conformance: `packages/codegen-conformance` với `src/support/containers.ts` (`POSTGRES_IMAGE`, `MYSQL_IMAGE`, `startDatabaseServer`), `fixtures.ts`, `prisma-cli.ts` (`runPrismaValidate`), `temp-directory.ts`. Không có CI; Task 20 cần Docker (`docker info` thoát mã 0).
- Node 24 qua nvm. Mọi lệnh `node`, `pnpm`, `npm` trong shell không tương tác chạy ở root repo với tiền tố:

  ```bash
  source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
  ```

  `node -v` phải ra `v24.x`.
- Working tree sạch trên `master`; `pnpm typecheck`, `pnpm lint`, `pnpm test` đang xanh trước khi bắt đầu.

## Cách dùng plan

- Mỗi task giao cho một subagent chưa đọc spec, theo cột "Agent" của bảng task: `core-engineer` cho `packages/core` và `packages/codegen-conformance`, `frontend-engineer` cho `frontend/`, `devops-engineer` cho dependency, lockfile và `eslint.config.mjs`, `spec-writer` cho `document/`. Prompt của subagent gồm: mục "Quy ước chung cho mọi task", mục "Điểm nóng khi làm song song", toàn bộ nội dung task, đường dẫn spec kèm các mục spec mà task tham chiếu, dòng tương ứng của mục "Vấn đề phát hiện khi lập plan", và phần "Chữ ký và hành vi" của các task nền mà task dùng lại.
- Subagent không commit, không push, không tạo subagent khác. Orchestrator kiểm tra kết quả rồi commit đúng các file của task với commit message ghi trong task (`.claude/rules/git.md`: một dòng, không body, không trailer). Commit được push tự động sau khi kiểm tra local qua.
- Task song song chạy trong worktree riêng (`isolation: "worktree"`) tạo từ **HEAD local** của `master` (không từ `origin`). Trong worktree, việc đầu tiên là chạy tiền tố Node rồi `pnpm install --frozen-lockfile`. Orchestrator commit trong worktree, merge về `master` lần lượt từng task, và chạy lại lệnh kiểm tra của package bị chạm sau mỗi lần merge trước khi merge task tiếp theo.
- Cột "Đợt" là thứ tự chạy gợi ý; orchestrator bắt đầu một task ngay khi mọi phụ thuộc của nó đã merge. Mỗi đợt tối đa 5 task, tập file sở hữu rời nhau.
- Mỗi subagent ghi execution log `document/executions/logs/YYYY-MM-DD-import-export-task-<N>.md` theo `.claude/rules/execution-logs.md`; orchestrator commit log cùng code của task.
- Task 0 chốt các vấn đề ở mục "Vấn đề phát hiện khi lập plan" trước khi task bị ảnh hưởng chạy. Cột "Đề xuất" ghi lựa chọn của plan; nếu orchestrator hoặc người dùng đổi một lựa chọn, orchestrator cho `spec-writer` sửa task bị ảnh hưởng trước khi giao.

## Quy ước chung cho mọi task

### Chuẩn bị

- Đọc `CLAUDE.md`, `.claude/rules/typescript.md`, `code-quality.md`, `testing.md`, `security.md`, `git.md`, `execution-logs.md` và các mục spec mà task tham chiếu trước khi viết file. Task ở `packages/core` đọc thêm `core.md`; task ở `frontend/` đọc thêm `nextjs.md`, `react.md`.
- **Chỉ tạo và sửa file có trong mục "File sở hữu" của task.** Cần sửa file khác (kể cả `src/index.ts`, `package.json`, `eslint.config.mjs`, file i18n, file của task khác) thì dừng và báo orchestrator.
- **Lockfile và cấu hình root.** Chỉ Task 1 chạy `pnpm install` có ghi `pnpm-lock.yaml` và sửa `eslint.config.mjs`, `packages/core/package.json`, `frontend/package.json` (ngoại lệ duy nhất: Task 23 xóa mục miễn trừ tạm của `ai-sample-data-card.tsx` trong `eslint.config.mjs`). Không task nào khác chạy `pnpm add`, `pnpm remove`, `pnpm update` hay `pnpm install` không có `--frozen-lockfile`. Thiếu dependency hay rule lint thì dừng và báo.

### TDD

- Viết test trước, chạy thấy đỏ, rồi mới cài đặt. Trong vòng đỏ-xanh, chạy riêng file hoặc thư mục test (không bật coverage):

  ```bash
  pnpm --filter @schemaforge/core exec vitest run src/importers/<đường-dẫn>
  pnpm --filter @schemaforge/frontend exec vitest run src/<đường-dẫn>
  ```

- Test import `describe`, `it`, `expect` từ `vitest`. Mỗi test một hành vi, tên là câu tiếng Anh. Không vòng lặp hay `if` trong test; dữ liệu dạng bảng dùng `it.each`. Test của core dựng dữ liệu bằng factory và fixture của `src/testing/`, import thẳng module cần dùng, không import `src/index.ts`; so sánh cấu trúc bằng `toStrictEqual`.
- Mỗi quy tắc trong mục "Chữ ký và hành vi" của task có ít nhất một test nhắm đúng quy tắc đó. Test diagnostic của importer kiểm tra đủ bộ ba `code`, `location`, `path` (spec mục 15, dòng "Mã diagnostic").

### Code trong `packages/core`

- Tiếng Anh cho code, identifier, comment, tên test. Import tương đối có đuôi `.js`. `import type` cho import chỉ có type. Không `as` (trừ `as const`), không `!`, không `any`, không từ khóa `enum`, không default export, không `@ts-ignore`. Hàm export khai báo kiểu trả về. Boolean bắt đầu bằng `is`, `has`, `can`, `should`. Hàm dưới khoảng 40 dòng, file dưới khoảng 300 dòng, lồng tối đa 3 cấp.
- **API bị cấm trong `src/` không phải test:** mọi global trong `CORE_FORBIDDEN_GLOBALS` của `eslint.config.mjs`, cùng `TextEncoder`, `TextDecoder`, `structuredClone`, `Date`, `Intl`, `localeCompare`, `Math.random`, `crypto`, `btoa`, `atob` và mọi import `node:*`. Core không đọc file kể cả trong test: fixture là hằng chuỗi trong `importers/<định dạng>/fixtures/*.fixture.ts` (spec mục 15).
- So chuỗi bằng `<`, `>` (theo code unit). Tra cứu theo tên dùng `Map`, không dùng object thường; object có khóa từ tên người dùng tạo bằng `Object.fromEntries` (spec mục 1, mục 13).
- **Importer không bao giờ throw với input bất kỳ** (spec mục 1): mọi ngoại lệ của thư viện parser được bắt tại adapter và thành `parse-failed`; lỗi do importer tự dựng tài liệu sai cấu trúc là lỗi lập trình và throw. Không regex có lượng từ lồng nhau trên input; scanner, lexer và bộ định vị lỗi JSON là vòng lặp một lượt trên ký tự (spec mục 13).
- Mọi diagnostic trả ra qua `finalizeImportDiagnostics` (Task 2).

### Code trong `frontend/`

- Component hàm, named export, mỗi file một component export, tên file kebab-case; logic nằm trong hook hoặc hàm thuần. Mọi chuỗi giao diện qua i18n (`importExport`, `importDiagnostics` của Task 22, hoặc namespace có sẵn); toast chỉ qua `useNotify`. Giá trị lấy từ file người dùng hiện dạng text React, không `dangerouslySetInnerHTML` (spec mục 13).
- **Ranh giới thư mục** (Vấn đề 1): `features/` không import nội bộ của feature khác (`nextjs.md`). Phần dùng chung giữa màn hình danh sách và editor nằm trong `frontend/src/lib/import-export/` (logic, worker), `frontend/src/lib/download/` và `frontend/src/components/import-dialog/` (giao diện, provider); phần chỉ editor dùng nằm trong `frontend/src/features/editor/import-export/` và `features/editor/code-generator/`.
- Worker đọc dữ liệu từ `MessageEvent` như `unknown` và kiểm tra hình dạng trước khi dùng, như `isGenerateCodeRequest`. Dòng import đầu tiên của file worker là `import "@/lib/zod-config";`.
- Test component truy vấn theo role, label, text; worker được thay ở biên bằng tham số `createWorker` như `useGeneratedCode`. Test tích hợp dùng `fake-indexeddb` và helper của `src/testing/`.

### Kiểm tra trước khi báo xong

Trừ khi task ghi khác, chạy ở root repo cho package của task (`core`, `frontend`, hoặc cả hai):

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm --filter @schemaforge/<package> typecheck
pnpm --filter @schemaforge/<package> lint
pnpm --filter @schemaforge/<package> test
pnpm --filter @schemaforge/<package> build
pnpm exec prettier --check <các file sở hữu>
git status --porcelain
```

Kết quả mong đợi: năm lệnh đầu thoát mã 0; `test` in mọi test pass và không có dòng báo coverage dưới ngưỡng (core 90% số dòng; frontend 80% số dòng); `git status` chỉ còn file của task. Task core sửa hợp đồng mà frontend dùng (Task 2, 6, 17) chạy thêm `pnpm --filter @schemaforge/frontend typecheck`. Không để lại file tạm.

Báo cáo gồm: file đã tạo hoặc sửa, lệnh đã chạy kèm kết quả chính (số test, % coverage số dòng), hành vi thư viện đã kiểm chứng (nếu có), vấn đề còn mở, đường dẫn execution log và trạng thái (`done`, `partial`, `blocked`).

## Điểm nóng khi làm song song

| Điểm nóng | Cách xử lý |
|---|---|
| `pnpm-lock.yaml`, `packages/core/package.json`, `frontend/package.json` | Chỉ Task 1 sửa: thêm `@dbml/core` vào `dependencies` của core, `fflate` và `modern-screenshot` vào `dependencies` của frontend, và pattern `"./importers/*"` vào `exports` của core (một lần cho mọi định dạng, như `"./generators/*"`). Mỗi định dạng có subpath ngay khi task của nó tạo `src/importers/<định dạng>/index.ts`; `importers/shared/` không có `index.ts` nên không import được qua pattern. Orchestrator không chạy Task 1 đồng thời với task ghi lockfile của plan khác (ví dụ phần 5) |
| `eslint.config.mjs` | Task 1 sửa: ranh giới `@dbml/core` trong core và rule cấm `URL.createObjectURL` ngoài `frontend/src/lib/download/download-blob.ts` (kèm mục miễn trừ tạm cho `ai-sample-data-card.tsx` của phần 5). File chưa tồn tại vẫn được nêu trong cấu hình. Sau Task 1, chỉ Task 23 sửa: xóa mục miễn trừ tạm đó |
| `packages/core/src/index.ts`, `src/index.test.ts` | Chỉ Task 17 sửa |
| `packages/core/src/testing/index.ts`, `testing/index.test.ts` | Task 12 (export fixture SSMS cho test UTF-16 của Task 24) rồi Task 20 (export danh sách fixture Prisma cho conformance); Task 20 phụ thuộc Task 12 nên hai task không chạy cùng lúc. Helper test của task khác (`to-comparable-schema.ts` của Task 3) nằm trong file riêng không export |
| `importers/shared/*` | Mỗi file thuộc đúng một task nền, merge **trước** mọi task định dạng dùng nó: Task 2 (`import-types.ts`, `import-diagnostic-codes.ts`, `import-diagnostics.ts`, `import-limits.ts`, `source-location.ts`, `import-draft.ts`), Task 4 (`resolve-references.ts`, `assemble-document.ts`, `assign-import-ids.ts`, `draft-target-path.ts`), Task 5 (`place-elements.ts`), Task 8 (`dbml-core-adapter.ts`, `dbml-core-adapter-types.ts`, `dbml-core-adapter.probe.test.ts`), Task 10 (`sql-type-mapping.ts`, `sql-type-rules.ts`, `sql-type-rule-builders.ts`, `sql-default-mapping.ts`, `sql-default-functions.ts`). Quy tắc chuỗi `'1'`/`'0'` MySQL trên cột boolean của `sql-default-mapping.ts` đã sửa trong task sửa sau review lần 1 ([log sửa sau review](../executions/logs/2026-10-05-import-export-review-1-fixes.md)); không task nào khác của plan sửa file này. Task định dạng chỉ import. Cần hành vi dùng chung mới thì dừng và báo |
| `packages/core/src/importers/sql/classify-statement.ts` và test | Task 9 tạo; sau khi Task 9 merge, chỉ Task 11 sửa (`ALTER TABLE … ADD` của PostgreSQL, MySQL, Vấn đề 20). Task 12 chỉ import |
| `IMPORT_DIAGNOSTIC_CODES` | Task 2 tạo đủ 39 mã theo bảng ở Task 2; test ghim danh sách. Frontend (Task 22) dùng `satisfies Record<ImportDiagnosticCode, string>`. Task sau thiếu mã thì dừng và báo; orchestrator cho sửa Task 2, Task 22 và spec trong cùng một thay đổi |
| `src/operations/build-many-to-many.ts`, `src/operations/build-relation.ts` | Chỉ Task 6 sửa (gộp hai bản riêng của `pickUnusedName` thành `operations/pick-unused-name.ts`, không đổi hành vi) |
| File i18n của frontend | Task 22 sở hữu `frontend/src/lib/i18n/locales/{en,vi}/import-export.ts`, `import-diagnostics.ts`, test mới `lib/i18n/import-export-messages.test.ts`, phần đăng ký trong `resources.ts` (và `resources.test.ts` nếu test ghim danh sách namespace). Task 22 viết đủ mọi key liệt kê ở thân task; task giao diện chỉ dùng key. Cần key mới thì dừng và báo; orchestrator tạo task sửa i18n, không chạy song song với task giao diện đang dùng namespace đó |
| `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx` và test | Task 30 (menu Export) rồi Task 28 (nút Import); hai task ở hai đợt khác nhau |
| `frontend/src/features/editor/components/editor-workspace.tsx` và test | Chỉ Task 26 sửa (áp import đang chờ). Task 28 thêm hành vi qua component riêng gắn vào toolbar, không sửa file này |
| `frontend/src/features/editor/state/create-editor-store.ts` và test | Chỉ Task 31 sửa (lựa chọn của hộp thoại ZIP) |
| `frontend/src/features/editor/code-generator/worker-protocol.ts`, `code-generator.worker.ts` và test | Chỉ Task 31 sửa (yêu cầu tạo ZIP). Task 23 chỉ sửa `code-view.tsx`, `code-panel.tsx` và test của chúng |
| `frontend/src/app/globals.css` | Chỉ Task 29 sửa (ẩn phần tử khi `data-exporting="true"`) |
| `frontend/src/features/editor/lib/viewport-controls.tsx`, `frontend/src/features/editor/components/canvas/editor-flow-provider.tsx` và test | Chỉ Task 29 sửa (thêm `CanvasNodeControls` với `getMeasuredNodes`, `fitNodes`). Task 28, 30, 31 chỉ dùng `useCanvasNodeControls()`, không gọi `useReactFlow()` trực tiếp |
| `frontend/src/components/app-providers.tsx` | Chỉ Task 26 sửa (thêm `PendingImportProvider`) |
| `frontend/src/features/schema-list/components/schema-list-row.tsx`, `schema-list-screen.tsx` và test | Task 27 sửa `schema-list-row.tsx` (mục "Tải JSON"); Task 26 sửa `schema-list-screen.tsx` (nút Import). Hai task không sửa file của nhau |
| `packages/codegen-conformance` | Chỉ Task 20 tạo file mới (`src/support/database-dump.ts`, `src/import-postgresql.test.ts`, `import-mysql.test.ts`, `import-prisma.test.ts`); manifest của package không đổi (`@dbml/core`, `prisma`, `testcontainers` đã có) |
| File chung với [plan phần 5](2026-10-03-ai-assistant-plan.md): `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`, `frontend/src/features/editor/components/editor-workspace.tsx`, `frontend/src/features/editor/state/create-editor-store.ts`, `frontend/src/lib/i18n/resources.ts`, `frontend/src/app/globals.css`, `eslint.config.mjs`, `pnpm-lock.yaml`, `packages/core/src/index.ts`, `packages/core/package.json` | Phần 5 merge trước, phần 7 sau: không task phần 7 nào bắt đầu sửa các file này khi task phần 5 sở hữu file đó chưa merge; orchestrator tạo worktree của task phần 7 từ HEAD local đã có phần 5 (hoặc rebase lên đó) và giải xung đột bằng cách giữ nguyên thay đổi của phần 5. Các dòng "chỉ Task N sửa" ở trên chỉ nói về tranh chấp trong plan này. Mọi điểm vào import của phần 7 bị chặn khi `selectIsPreviewing` (AI-22) là `true`, vì import đi qua `dispatch` mà `dispatch` không làm gì khi đang xem trước đề xuất AI (Vấn đề 19) |

## Phiên bản

Kiểm tra ngày 2026-10-03 bằng `npm view <package> dist-tags time dependencies peerDependencies scripts`, kiểu khai báo trong tarball (`npm pack` vào thư mục tạm của phiên, đã xóa) và mã ESM trong `node_modules` của lockfile hiện tại. pnpm từ chối bản phát hành chưa quá 24 giờ (`minimumReleaseAge`); mọi bản dưới đây phát hành trước 2026-10-02.

| Package | Khai báo | Bản chọn, ngày phát hành | Package khai báo | Ghi chú |
|---|---|---|---|---|
| `@dbml/core` | `^10.2.0` | 10.2.0, 2026-09-23 | `packages/core` (`dependencies`) | Spec thử trên 10.1.1; lockfile đã có 10.2.0 (qua `packages/codegen-conformance`), nên core dùng cùng bản để chỉ có một bản trong repo (Vấn đề 3). Dependency: `@dbml/parse` `^10.2.0`, `antlr4`, `lodash`, `lodash-es`, `luxon`, `parsimmon`, `pluralize`; không có peer, không có script `preinstall`, `install`, `postinstall`. Bản ESM `lib/index.mjs` chỉ import `@dbml/parse`, không import module Node; lời gọi `Function("return this")()` duy nhất là nhánh dự phòng của lodash (đã quét 2026-10-03, khớp spec mục 1). `Parser.parse(str, format)` có ở dạng static và instance; `ParseFormat` gồm `postgres`, `mysql`, `mssql`, `dbmlv2`. Không dùng `11.0.0-alpha.0` (pre-release, 2026-10-03) hay `10.2.1-expose-diagnostic-filepath.0` |
| `fflate` | `^0.8.3` | 0.8.3, 2026-05-16 | `frontend` (`dependencies`) | Không dependency, không script cài đặt. Có `zipSync(data: Zippable, opts?: ZipOptions)`, `strToU8`, `unzipSync`; `ZippableFile` nhận `[Uint8Array, ZipOptions]` với `level` và `mtime`. Ngày trong spec (2026-07-20) là ngày đăng lại các bản cũ 0.4–0.7, không phải 0.8.3 (Vấn đề 4) |
| `modern-screenshot` | `^4.7.0` | 4.7.0, 2026-04-16 | `frontend` (`dependencies`) | Không dependency. `domToBlob(node, options): Promise<Blob>` cho PNG; `domToForeignObjectSvg(node, options): Promise<SVGElement>` cho SVG (SVG có `foreignObject`, giữ chữ và hình dạng vector). Không dùng `domToSvg`: nó trả chuỗi data URL của một SVG chỉ bọc ảnh raster PNG (`<image href="data:image/png…">`, đọc trong `dist/index.mjs` của 4.7.0 ngày 2026-10-03). Option `width`, `height`, `scale`, `backgroundColor`, `style`, `filter`, `type`, `maximumCanvasSize`, `timeout`, `font`, `fetch`, `workerUrl`, `onCloneNode` có trong `dist/index.d.ts` của 4.7.0 |
| `@xyflow/react` | `^12.11.6` (đã có) | 12.11.6 | `frontend` | `ViewportPortal` và `getNodesBounds` có trong bản đã cài |
| `prisma`, `testcontainers`, `@testcontainers/postgresql`, `@testcontainers/mysql` | đã có trong `packages/codegen-conformance` | theo lockfile | conformance (dev) | Không đổi |
| `fast-check` | `^4.10.0` (đã có) | theo lockfile | `packages/core` (dev) | Không đổi |

Không dùng: `@mrleebo/prisma-ast`, `@prisma/internals`, `chevrotain`, `html-to-image`, `client-zip`, `jszip`, `file-saver` (spec mục "Phiên bản", mục 9).

## Bảng task

Số task là định danh, không phải thứ tự chạy; bảng sắp theo đợt.

| Task | Nội dung | Agent | Phụ thuộc | Đợt |
|---|---|---|---|---|
| 0 | Chốt Vấn đề 1–20 của mục "Vấn đề phát hiện khi lập plan" (không có thân riêng) | orchestrator | — | 0 |
| 1 | Dependency `@dbml/core`, `fflate`, `modern-screenshot`; subpath `./importers/*`; lint ranh giới `@dbml/core` và `URL.createObjectURL`; lockfile | devops-engineer | 0 | 1 |
| 2 | Hợp đồng importer: kiểu, 39 mã diagnostic, sắp xếp diagnostic, giới hạn, vị trí nguồn, kiểu `ImportDraft` | core-engineer | 0 | 1 |
| 3 | `serializeSchemaDocument` và helper test `toComparableSchema` | core-engineer | 0 | 1 |
| 9 | Statement scanner và phân loại câu lệnh SQL | core-engineer | 0 | 1 |
| 13 | Lexer, parser và AST của schema Prisma | core-engineer | 0 | 1 |
| 5 | Xếp vị trí bảng và ghi chú theo lưới (`place-elements.ts`) | core-engineer | 2 | 2 |
| 6 | `buildImportOperation`; gộp hai bản `pickUnusedName` | core-engineer | 2 | 2 |
| 7 | IE-04 importer JSON, `locateJsonSyntaxError` | core-engineer | 2, 3 | 2 |
| 8 | Probe hành vi `@dbml/core` 10.2.0 và adapter `dbml-core-adapter.ts` | core-engineer | 1, 2 | 2 |
| 10 | Bảng ánh xạ kiểu và giá trị mặc định SQL dùng chung | core-engineer | 2, 9 | 2 |
| 4 | Giải tham chiếu theo tên, `assembleDocument` | core-engineer | 2, 5 | 3 |
| 11 | Phần scanner tự đọc: identity của `pg_dump`, extended property SQL Server, CHECK `IN` thành enum; đọc lại định nghĩa cột, `UNIQUE` cấp bảng, tùy chọn phần tử cột, `INCLUDE`, `WHERE` của index; `ALTER TABLE … ADD` không hỗ trợ trong `classify-statement.ts` | core-engineer | 2, 9, 10 | 3 |
| 14 | Ánh xạ kiểu, thuộc tính và quan hệ Prisma | core-engineer | 2, 10, 13 | 3 |
| 17 | Export ở entry point chính của core | core-engineer | 2, 3, 6 | 3 |
| 29 | Chụp ảnh canvas: marker trong viewport, `computeImageFrame`, `captureCanvasImage` (SVG qua `domToForeignObjectSvg`), CSS khi export; `getMeasuredNodes`, `fitNodes` trong `EditorFlowProvider` | frontend-engineer | 1 | 3 |
| 12 | IE-01 importer SQL ba dialect, fixture, round-trip | core-engineer | 4, 5, 8, 9, 10, 11 | 4 |
| 15 | IE-02 importer Prisma, fixture, round-trip | core-engineer | 4, 5, 13, 14 | 4 |
| 16 | IE-03 importer DBML, fixture, round-trip với CG-09 | core-engineer | 4, 5, 8, 10 | 4 |
| 22 | i18n `importExport`, `importDiagnostics` | frontend-engineer | 17 | 4 |
| 21 | Chuyển `resolveIssueTarget`, `toIssueMessageValues` sang `frontend/src/lib/schema/`; bỏ `toInterpolation` trùng | frontend-engineer | 0 | 4 |
| 18 | Property test chung cho mọi importer | core-engineer | 7, 12, 15, 16 | 5 |
| 19 | Benchmark importer, scanner SQL, parser `@dbml/core`, `buildImportOperation` và `applyOperation` (kể cả ở giới hạn 20 000 phần tử) | core-engineer | 6, 7, 12, 15, 16 | 5 |
| 20 | Conformance `pg_dump`, `mysqldump`, `prisma db pull`, `prisma validate` | core-engineer | 12, 15 | 5 |
| 23 | `downloadBlob`, tên file tải về, nút "Tải file" trong code panel; chuyển `ai-sample-data-card.tsx` sang `downloadBlob`, xóa miễn trừ lint tạm | frontend-engineer | 1, 22 | 5 |
| 24 | Worker import, client hủy được, đọc file, `LayoutMetrics`, thông báo giấy phép | frontend-engineer | 7, 12, 15, 16, 17 | 5 |
| 25 | Hộp thoại import ba bước | frontend-engineer | 21, 22, 24 | 6 |
| 27 | Mục "Tải JSON" ở màn hình danh sách | frontend-engineer | 23 | 6 |
| 30 | Menu Export trên toolbar (JSON, PNG, SVG, mục "ZIP…") | frontend-engineer | 22, 23, 29 | 6 |
| 26 | `PendingImportProvider`, tạo schema mới từ import, nút Import ở danh sách, editor áp import đang chờ | frontend-engineer | 25, AI-22 | 7 |
| 31 | ZIP: yêu cầu tạo ZIP trong worker sinh code, `buildZip`, hộp thoại "Tải ZIP" | frontend-engineer | 30 | 7 |
| 28 | Nút Import trong editor, chế độ gộp, test tích hợp xuất rồi nhập JSON | frontend-engineer | 25, 26, 30, AI-22 | 8 |
| 32 | Kiểm tra tay toàn phần và kiểm tra toàn repo | orchestrator (kiểm tra), spec-writer (log) | 18, 19, 20, 27, 28, 31 | 9 |
| 33 | Tài liệu: roadmap, architecture, spec phần 2, danh sách tính năng, spec phần 7 | spec-writer | 32 | 10 |

- "AI-22" là Task 22 của [plan phần 5](2026-10-03-ai-assistant-plan.md), đã merge trước khi phần 7 bắt đầu (mục "Điều kiện tiên quyết"), nên không kéo dài đường tới hạn.
- Đường tới hạn: Task 2 → 5 → 4 → 12 → 24 → 25 → 26 → 28 → 32 → 33. Nhánh SQL song song: Task 9 → 11 → 12; Task 1 → 8 → 12.
- Task 12, 16 chỉ bắt đầu khi execution log của Task 8 có bảng kết quả probe và mọi điểm khớp spec mục 5, 7, hoặc orchestrator đã cho sửa spec theo kết quả probe (spec mục "Rủi ro", gạch đầu dòng đầu).
- Task 17 xếp ở đợt 3 để frontend (Task 22) bắt đầu sớm; nó chỉ export hợp đồng chung, không chờ importer.
- Task 32 là task kiểm tra tay cuối cùng; Task 33 cập nhật tài liệu theo kết quả của Task 32.

## Task 1: Dependency, subpath importer và lint ranh giới

**Mục tiêu:** core và frontend có thư viện mà spec chọn (spec mục "Phiên bản", mục 1 "Entry point", mục 9 "Cơ chế tải", mục 10, 11); lint chặn `@dbml/core` lọt ra ngoài adapter và `URL.createObjectURL` ngoài `downloadBlob` (spec mục 1, mục 9; tiêu chí "Chung" thứ nhất).

**Agent:** devops-engineer. **Phụ thuộc:** Task 0. **Đợt:** 1.

**File sở hữu (sửa):** `packages/core/package.json`, `frontend/package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`.

**Cài đặt:**

- `packages/core/package.json`: `dependencies` thêm `"@dbml/core": "^10.2.0"` (giữ `zod`); `exports` thêm, ngay sau `"./generators/*"`:

  ```json
  "./importers/*": {
    "types": "./dist/importers/*/index.d.ts",
    "default": "./dist/importers/*/index.js"
  }
  ```

- `frontend/package.json`: `dependencies` thêm `"fflate": "^0.8.3"`, `"modern-screenshot": "^4.7.0"`.
- Chạy `pnpm install` một lần. Lockfile chỉ được có thêm hai package frontend và dòng `@dbml/core` của core trỏ tới bản 10.2.0 đã có; không package nào khác đổi bản. Không cần mục `allowBuilds` mới (ba package không có script cài đặt).
- `eslint.config.mjs`:
  - Tách mảng `paths` và `patterns` của block `packages/core/**/*.ts` thành hàm `coreImportRestrictions({ canImportDbmlCore, canImportDbmlAdapter })`. Mặc định cả hai `false`: `paths` thêm `{ name: "@dbml/core", message: DBML_CORE_BOUNDARY }`, `patterns` thêm `{ group: ["**/dbml-core-adapter.js"], message: DBML_ADAPTER_BOUNDARY }`. Ở **mọi** giá trị của hai cờ (kể cả trong adapter), `patterns` còn có `{ group: ["@dbml/core/*"], message: DBML_CORE_DEEP_IMPORT }`: chỉ import gốc `@dbml/core`, không import sâu vào `lib/` hay `types/` của gói. Ba thông báo tiếng Anh: `@dbml/core` chỉ được import trong `src/importers/shared/dbml-core-adapter.ts`; adapter chỉ được import từ `src/importers/sql/` và `src/importers/dbml/` (spec mục 1).
  - Block mới ngay sau block core, `files: ["packages/core/src/importers/sql/**/*.ts", "packages/core/src/importers/dbml/**/*.ts"]`: `coreImportRestrictions({ canImportDbmlCore: false, canImportDbmlAdapter: true })`.
  - Block mới tiếp theo, `files: ["packages/core/src/importers/shared/dbml-core-adapter*.ts"]`: `coreImportRestrictions({ canImportDbmlCore: true, canImportDbmlAdapter: true })`.
  - Block `frontend/src/**/*.{ts,tsx}` đang đặt `no-restricted-properties` (mạng): thêm `{ object: "URL", property: "createObjectURL", message: "Create object URLs only in frontend/src/lib/download/download-blob.ts (see document/specs/2026-09-15-import-export-design.md, section 9)." }`. Block mới ngay sau nó, `files: ["frontend/src/lib/download/download-blob.ts"]`: `no-restricted-properties` lặp lại `PROCESS_ENV_RESTRICTION` và các mục mạng, không có mục `URL.createObjectURL` (ghi chú ở đầu file: block sau thay option của block trước). Block `frontend/src/lib/api/**/*.ts` hiện có cũng đặt lại `no-restricted-properties` chỉ với `PROCESS_ENV_RESTRICTION`, nên mục `URL.createObjectURL` không áp trong `lib/api/`; chấp nhận được (thư mục này chỉ chứa client mạng của phần 4, không tạo file tải về), không sửa block đó, ghi một dòng comment cạnh mục `URL.createObjectURL` nêu ngoại lệ này. Không đổi thứ tự của block "Must stay after every block that sets no-restricted-properties".

**Kiểm chứng viết trước (file tạm, không commit):**

1. Tạo `packages/core/src/importers/json/lint-probe.ts` với `import { Parser } from "@dbml/core"; export const probe = Parser;`, `packages/core/src/importers/prisma/lint-probe.ts` với `export * from "../shared/dbml-core-adapter.js";`, `packages/core/src/importers/shared/dbml-core-adapter.deep-probe.ts` với `export * from "@dbml/core/lib/parse/Parser";`, và `frontend/src/lib/lint-probe.ts` với `export const probe = (blob: Blob): string => URL.createObjectURL(blob);`.
2. Sau khi sửa cấu hình, `pnpm exec eslint <bốn file>`: mong đợi đúng bốn lỗi với bốn thông báo trên (file `deep-probe` báo `DBML_CORE_DEEP_IMPORT` dù nằm ở vị trí của adapter). Đổi `packages/core/src/importers/json/lint-probe.ts` sang `packages/core/src/importers/shared/dbml-core-adapter.lint-probe.ts`: mong đợi không còn lỗi `@dbml/core` (có thể còn lỗi khác của file thăm dò).
3. Xóa mọi file tạm.

**Kiểm tra:** `pnpm install --frozen-lockfile`; `pnpm lint`; `pnpm typecheck`; `pnpm --filter @schemaforge/core build` rồi `grep -rl "@dbml/core" packages/core/dist` không in gì (chưa có importer); `pnpm --filter @schemaforge/frontend build`; `pnpm exec prettier --check eslint.config.mjs packages/core/package.json frontend/package.json`; `git status --porcelain` chỉ có bốn file sở hữu.

**Commit:** `build: add import and export dependencies and boundaries`

## Task 2: Hợp đồng importer

**Mục tiêu:** kiểu, mã diagnostic, giới hạn và tiện ích vị trí mà mọi importer, `buildImportOperation` và frontend dùng chung (spec mục 1 "Chữ ký", "Giới hạn input", "Luồng bên trong một importer"; mục 3).

**Agent:** core-engineer. **Phụ thuộc:** Task 0. **Đợt:** 1.

**File sở hữu (tạo), mỗi file kèm `<tên>.test.ts` cùng thư mục, trong `packages/core/src/importers/shared/`:** `import-types.ts`, `import-diagnostic-codes.ts`, `import-diagnostics.ts`, `import-limits.ts`, `source-location.ts`, `import-draft.ts` (chỉ type, test bằng `expectTypeOf` nếu cần); và `packages/core/src/testing/import-test-options.ts` (không export qua `@schemaforge/core/testing`).

**Chữ ký và hành vi:**

`import-types.ts`, đúng spec mục 1:

```ts
export const IMPORT_FORMATS = ["postgresql", "mysql", "sqlserver", "prisma", "dbml", "json"] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];
export type SourceLocation = { readonly line: number; readonly column: number }; // cả hai từ 1, cột theo code unit UTF-16
export type ImportDiagnostic = {
  readonly code: ImportDiagnosticCode | StructuralErrorCode; // mã cấu trúc chỉ từ importer JSON (spec mục 8)
  readonly location: SourceLocation | null;
  readonly path: DocumentPath | null;
};
export type LayoutMetrics = { readonly tableWidth: number; readonly headerHeight: number; readonly columnRowHeight: number; readonly gap: number };
export type ImportOptions = { readonly fallbackSchemaName: string; readonly generateId: GenerateId; readonly layout: LayoutMetrics };
export type ImportSuccess = { readonly document: SchemaDocument; readonly diagnostics: readonly ImportDiagnostic[] };
export type ImportFailure = { readonly diagnostics: readonly ImportDiagnostic[] }; // luôn có ít nhất một
export type ImportResult = Result<ImportSuccess, ImportFailure>;
export type Importer = (source: string, options: ImportOptions) => ImportResult;
```

`import-diagnostic-codes.ts`: `IMPORT_DIAGNOSTIC_CODES` là mảng `as const` gồm đúng 39 mã theo thứ tự bảng dưới, và `ImportDiagnosticCode`. Cột `path` là hợp đồng cho mọi định dạng (spec chỉ ví dụ; plan chốt để frontend hiện tên phần tử nhất quán bằng `resolveIssueTarget`). `location` là vị trí của phần tử hoặc câu lệnh trong nguồn khi có, `null` khi không xác định.

| # | Mã | Nguồn (spec) | `path` |
|---|---|---|---|
| 1 | `source-too-large` | Mọi importer, mục 1 | `null`; `location` `null` |
| 2 | `too-many-elements` | Mọi importer, mục 1 | `null`; `location` `null` |
| 3 | `parse-failed` | Adapter thư viện, mục 1 | `null`; `location` `null` |
| 4 | `syntax-error` | Mọi định dạng | `null` |
| 5 | `reference-not-found` | Giải tham chiếu, mục 1, 5 | `null` (phần tử chứa tham chiếu bị bỏ) |
| 6 | `table-renamed` | `buildImportOperation` gộp, mục 2 | `["tables", id, "name"]`; `location` `null` |
| 7 | `enum-renamed` | như trên | `["enums", id, "name"]` |
| 8 | `index-renamed` | như trên | `["indexes", id, "name"]` |
| 9 | `subject-area-renamed` | như trên | `["subjectAreas", id, "name"]` |
| 10 | `data-statements-ignored` | SQL, DBML `Records` | `null`; vị trí câu dữ liệu đầu tiên |
| 11 | `view-not-supported` | SQL, Prisma `view` | `null` |
| 12 | `routine-not-supported` | SQL | `null` |
| 13 | `trigger-not-supported` | SQL | `null` |
| 14 | `sequence-not-supported` | SQL | `null` |
| 15 | `statement-not-supported` | SQL | `null` |
| 16 | `namespace-dropped` | SQL, Prisma `@@schema`, DBML | `["tables", id]` |
| 17 | `index-expression-not-supported` | SQL, DBML | `null` (index bị bỏ) |
| 18 | `index-type-dropped` | SQL, DBML | `["indexes", id]` |
| 19 | `check-converted-to-enum` | SQL | `["columns", id, "type"]` |
| 20 | `check-constraint-not-supported` | SQL, DBML | `null` |
| 21 | `computed-column-not-supported` | SQL | `["columns", id]` |
| 22 | `type-approximated` | SQL, DBML | `["columns", id, "type"]` |
| 23 | `type-parameter-dropped` | SQL (kể cả `COLLATE`, `CHARACTER SET` của cột), Prisma, DBML | `["columns", id, "type"]` |
| 24 | `identity-options-dropped` | SQL | `["columns", id, "isAutoIncrement"]` |
| 25 | `type-not-supported` | SQL, Prisma, DBML | `["columns", id, "type"]` |
| 26 | `default-approximated` | SQL, Prisma, DBML | `["columns", id, "defaultValue"]` |
| 27 | `sequence-default-as-auto-increment` | SQL | `["columns", id, "isAutoIncrement"]` |
| 28 | `default-not-supported` | SQL, Prisma, DBML | `["columns", id, "defaultValue"]` |
| 29 | `on-update-not-supported` | SQL MySQL | `["columns", id]` |
| 30 | `provider-not-supported` | Prisma | `null`; vị trí `provider` hoặc `null` khi thiếu `datasource` |
| 31 | `composite-type-not-supported` | Prisma | `null` |
| 32 | `scalar-list-as-custom` | Prisma | `["columns", id, "type"]` |
| 33 | `index-option-dropped` | Prisma; SQL (tùy chọn phần tử cột như `DESC`, độ dài tiền tố; `INCLUDE`, `WHERE` của index; Vấn đề 20) | `["indexes", id]`, `["tables", id, "primaryKeyColumnIds"]` hoặc `["columns", id, "isUnique"]` |
| 34 | `updated-at-not-supported` | Prisma | `["columns", id]` |
| 35 | `comment-dropped` | Prisma, DBML | Phần tử còn giữ mà mất comment: `["enums", id]`, `["indexes", id]`, `["subjectAreas", id]`; `null` với `Project` |
| 36 | `color-dropped` | DBML | `["tables", id]`, `["subjectAreas", id]` hoặc `["relations", id]` |
| 37 | `back-relation-missing` | Prisma | `["relations", id]` |
| 38 | `implicit-many-to-many-not-supported` | Prisma | `null` |
| 39 | `many-to-many-not-supported` | DBML | `null` |

`import-timeout` (spec mục 12) không phải mã của core: frontend báo bằng key của namespace `importExport` (Task 22).

`import-diagnostics.ts`:

- `createImportDiagnostic(code: ImportDiagnosticCode | StructuralErrorCode, location: SourceLocation | null, path: DocumentPath | null): ImportDiagnostic`.
- `finalizeImportDiagnostics(diagnostics: readonly ImportDiagnostic[]): readonly ImportDiagnostic[]`: bỏ bộ ba `code`, `location`, `path` lặp (so bằng `JSON.stringify` của bộ ba); sắp theo `location` (dòng rồi cột, `null` cuối), rồi `code` (`<`), rồi `path` (`compareDocumentPaths`, `null` cuối) (spec mục 1).

`import-limits.ts`:

- `MAX_IMPORT_SOURCE_LENGTH = 2_097_152`, `MAX_IMPORTED_ELEMENTS = 20_000`.
- `checkSourceLength(source: string): ImportFailure | null`: `source.length > MAX_IMPORT_SOURCE_LENGTH` thì `{ diagnostics: [source-too-large] }`.
- `countDocumentElements(document: SchemaDocument): number`: tổng số bảng, cột, quan hệ, index, enum, subject area, ghi chú (spec mục 1). `tooManyElementsFailure(): ImportFailure`.

`source-location.ts`:

- `createLineStarts(source: string): readonly number[]`: offset bắt đầu của mỗi dòng; xuống dòng là `\n`, `\r\n` hoặc `\r` đứng riêng.
- `toSourceLocation(lineStarts: readonly number[], offset: number): SourceLocation`: tìm nhị phân; cột là `offset - lineStart + 1`; offset vượt cuối thì vị trí ngay sau ký tự cuối.
- `fromParserPosition(line: number, column: number, columnBase: 0 | 1): SourceLocation`: chuẩn hóa vị trí của parser thư viện (spec mục 1, "Chuẩn hóa vị trí").

`src/testing/import-test-options.ts`: `TEST_LAYOUT_METRICS: LayoutMetrics = { tableWidth: 320, headerHeight: 40, columnRowHeight: 28, gap: 80 }` và `createImportTestOptions(): ImportOptions` (`fallbackSchemaName: "Imported"`, `createCounterIdGenerator()`, `TEST_LAYOUT_METRICS`), dùng trong mọi test importer.

`import-draft.ts` (nội bộ, spec mục 1 "Luồng bên trong một importer"): bản nháp theo tên, chưa có id, phản chiếu model trong `src/model/*.ts` với id thay bằng tên:

```ts
export type DraftColumnType = Exclude<ColumnType, { readonly kind: "enum" }> | { readonly kind: "enum"; readonly enumName: string };
export type DraftColumn = { readonly name: string; readonly type: DraftColumnType; readonly isNullable: boolean; readonly isUnique: boolean;
  readonly isAutoIncrement: boolean; readonly defaultValue: ColumnDefault | null; readonly comment: string; readonly location: SourceLocation | null };
export type DraftTable = { readonly name: string; readonly comment: string; readonly subjectAreaName: string | null;
  readonly columns: readonly DraftColumn[]; readonly primaryKeyColumnNames: readonly string[]; readonly location: SourceLocation | null };
export type DraftIndex = { readonly tableName: string; readonly name: string | null; readonly columnNames: readonly string[]; readonly isUnique: boolean; readonly location: SourceLocation | null };
export type DraftRelation = { readonly fromTableName: string; readonly toTableName: string;
  readonly columnPairs: readonly { readonly fromColumnName: string; readonly toColumnName: string }[];
  readonly kind: RelationKind; readonly onDelete: ReferentialAction; readonly onUpdate: ReferentialAction; readonly location: SourceLocation | null };
export type DraftEnum = { readonly name: string; readonly values: readonly string[]; readonly location: SourceLocation | null };
export type DraftSubjectArea = { readonly name: string; readonly location: SourceLocation | null };
export type DraftNote = { readonly text: string; readonly location: SourceLocation | null }; // `text` như `Note.text` của model
export type DraftTarget =
  | { readonly kind: "table"; readonly tableIndex: number; readonly field?: string }
  | { readonly kind: "column"; readonly tableIndex: number; readonly columnIndex: number; readonly field?: string }
  | { readonly kind: "index" | "relation" | "enum" | "subjectArea" | "note"; readonly index: number; readonly field?: string };
export type DraftDiagnostic = { readonly code: ImportDiagnosticCode; readonly location: SourceLocation | null; readonly target: DraftTarget | null };
export type ImportDraft = { readonly name: string | null; readonly tables: readonly DraftTable[]; readonly indexes: readonly DraftIndex[];
  readonly relations: readonly DraftRelation[]; readonly enums: readonly DraftEnum[]; readonly subjectAreas: readonly DraftSubjectArea[];
  readonly notes: readonly DraftNote[]; readonly diagnostics: readonly DraftDiagnostic[] };
```

Tên trường của `DraftColumn`, `DraftTable`… trùng tên trường của model nếu model có trường đó; nếu model đặt tên khác (đọc `src/model/column.ts`, `table.ts`, `relation.ts`, `table-index.ts`) thì đổi theo model và ghi vào log. `name: null` ở `DraftIndex` nghĩa là dùng `suggestIndexName` khi dựng tài liệu (spec mục 5, 6, 7). `DraftTarget` trỏ tới phần tử theo vị trí trong mảng của draft; Task 4 đổi thành `DocumentPath` theo bảng mã ở trên (`field` là phân đoạn cuối, ví dụ `"type"`).

**Test viết trước:**

- `import-types.test.ts`: `lists the six import formats in spec order`.
- `import-diagnostic-codes.test.ts`: `lists the thirty-nine import diagnostic codes without duplicates` (`toStrictEqual` với danh sách đầy đủ, `new Set(...).size` là 39); `shares no code with the structural error codes`.
- `import-diagnostics.test.ts`: `sorts by line, then column, then code, then path`; `puts diagnostics without a location last`; `removes a repeated code, location and path`; `keeps the same code at two locations`; `returns an empty list for no diagnostics`.
- `import-limits.test.ts`: `accepts a source at exactly the length limit`; `rejects a source one code unit over the limit with source-too-large`; `counts every element kind of a document` (`createSampleSchema()`, số kỳ vọng tính tay).
- `source-location.test.ts`: `maps the first character to line 1 column 1`; `counts crlf, lf and lone cr as one line break`; `counts columns in utf-16 code units after vietnamese text and an emoji`; `places an offset past the end after the last character`; `shifts a zero-based parser column by one`; `keeps a one-based parser column`.

**Kiểm tra:** như "Quy ước chung" (core), cộng `pnpm --filter @schemaforge/frontend typecheck`.

**Commit:** `feat(core): add importer contract and diagnostic codes`

## Task 3: `serializeSchemaDocument` và `toComparableSchema`

**Mục tiêu:** IE-06 xuất JSON có thứ tự khóa ổn định (spec mục 8 "Export"); helper so sánh tương đương cho mọi test round-trip (spec mục 15 "So sánh tương đương").

**Agent:** core-engineer. **Phụ thuộc:** Task 0. **Đợt:** 1.

**File sở hữu (tạo):** `packages/core/src/model/serialize-schema-document.ts`, `serialize-schema-document.test.ts`; `packages/core/src/testing/to-comparable-schema.ts`, `to-comparable-schema.test.ts` (không export qua `@schemaforge/core/testing`).

**Chữ ký và hành vi:**

- `serializeSchemaDocument(document: SchemaDocument): string`: khóa gốc theo thứ tự `version`, `name`, `tables`, `columns`, `relations`, `indexes`, `enums`, `subjectAreas`, `notes`; phần tử trong mỗi map sắp theo id (so `<`); trường của phần tử và của object lồng (`type`, `defaultValue`, `position`, cặp cột) theo thứ tự khai báo trong schema Zod của core; mảng giữ thứ tự. Thụt 2 dấu cách, kết thúc bằng đúng một `\n`, không BOM, không thêm trường. Cài đặt bằng danh sách khóa tường minh cho từng loại object, dựng object mới bằng `Object.fromEntries` rồi `JSON.stringify(value, null, 2) + "\n"`; danh sách khóa được test so với `Object.keys(<shape>.shape)` của schema Zod tương ứng (với union như `ColumnType`, `ColumnDefault`: từng nhánh), để thêm trường vào model mà quên ở đây thì test đỏ. Trường không có trong danh sách thì throw `Error` (lỗi lập trình: tài liệu đã qua `parseSchemaDocument` không có trường lạ).
- `toComparableSchema(document: SchemaDocument): SchemaDocument` (spec mục 15): cấp lại id bằng `createCounterIdGenerator()` và các hàm `create*Id` theo thứ tự: bảng theo `sortTables`, cột theo `columnIds` của từng bảng, enum theo `sortEnums`, subject area theo `sortSubjectAreas`, index theo `sortIndexes`, quan hệ theo `sortRelations`, ghi chú theo nội dung (`<`) rồi theo vị trí cũ; đổi mọi tham chiếu id; đặt mọi `position` thành `{ x: 0, y: 0 }`; dựng lại map với khóa đã sắp. Nếu một hàm `sort*` dùng id làm tiêu chí phụ, ghi vào log và giữ nguyên (fixture round-trip không có hai phần tử chỉ khác id).

**Test viết trước:**

- `serialize-schema-document.test.ts`: `writes root keys in declaration order`; `sorts the elements of each map by id`; `writes element fields in zod shape order` (`it.each` theo loại phần tử); `ends with exactly one newline and has no byte order mark`; `serializes the same document with shuffled map keys to the same string` (property test, `withShuffledKeys` và `keyOrderArbitrary` của `src/testing/arbitraries.ts`, `PROPERTY_SEED`, `PROPERTY_RUNS`); `keeps positions, subject areas and notes`; `lists the same keys as each zod shape`.
- `to-comparable-schema.test.ts`: `gives equal results for the same schema with different ids`; `sets every position to the origin`; `rewrites every id reference consistently`; `gives different results when a column type differs`.

**Kiểm tra:** như "Quy ước chung" (core).

**Commit:** `feat(core): add deterministic schema document serializer`

## Task 4: Giải tham chiếu và `assembleDocument`

**Mục tiêu:** phần dùng chung biến `ImportDraft` thành tài liệu hợp lệ: đếm phần tử, giải tham chiếu theo tên, cấp id theo thứ tự xác định, xếp vị trí, `parseSchemaDocument` (spec mục 1 "Luồng bên trong một importer", mục 4).

**Agent:** core-engineer. **Phụ thuộc:** Task 2, 5. **Đợt:** 3.

**File sở hữu (tạo), kèm test cùng tên:** `packages/core/src/importers/shared/resolve-references.ts`, `assemble-document.ts`.

**Chữ ký và hành vi:**

- `createNameResolver(names: readonly string[]): (wanted: string) => number | null`: trả vị trí của tên khớp chính xác; không có thì tên khớp theo `toNameKey` nếu đúng một tên khớp; còn lại `null`. Dựng bằng `Map` (spec mục 1, "Tra cứu theo tên").
- `assembleDocument(draft: ImportDraft, options: ImportOptions): ImportResult`:
  1. Đếm phần tử của draft (bảng, cột, quan hệ, index, enum, subject area, ghi chú). Vượt `MAX_IMPORTED_ELEMENTS` thì trả `Result` lỗi `too-many-elements`.
  2. Giải tham chiếu: enum của cột `kind: "enum"`; cột trong khóa chính, index, cặp cột của quan hệ; bảng của index, quan hệ; subject area của bảng. Phần tử chứa tham chiếu không giải được bị bỏ kèm `reference-not-found` tại `location` của nó; cột có enum không giải được bị bỏ kèm diagnostic; khóa chính chứa tên cột không giải được bị bỏ cả khóa (bảng giữ). Bảng tham chiếu subject area không giải được thì `subjectAreaId: null` kèm `reference-not-found`. Sau khi giải tên: khóa chính và index bỏ cột lặp, giữ lần xuất hiện đầu, không diagnostic; quan hệ bỏ cặp cột lặp y hệt, rồi nếu một cột vẫn xuất hiện hai lần ở một phía thì bỏ quan hệ kèm `reference-not-found` tại `location` của quan hệ; index không còn cột và quan hệ không còn cặp cột bị bỏ không diagnostic (importer định dạng tự báo bằng mã của mình). Nhờ vậy `assembleDocument` không throw vì danh sách cột lặp hay rỗng (spec mục 1 "Luồng bên trong một importer").
  3. Cấp id bằng `create*Id(options.generateId)` theo thứ tự: enum, bảng (theo thứ tự trong draft), cột theo thứ tự trong bảng, rồi index, quan hệ, subject area, ghi chú (spec mục 1).
  4. Index có `name: null` lấy `suggestIndexName(tài liệu đang dựng, { tableName, columnNames, isUnique })`, gọi theo thứ tự index trong draft để tên sau thấy tên trước.
  5. Vị trí: `placeElements` của Task 5 với bảng theo thứ tự draft, tên subject area của bảng, số cột, số ghi chú và `options.layout`.
  6. Tên tài liệu: `draft.name ?? options.fallbackSchemaName`.
  7. `parseSchemaDocument(tài liệu)`; lỗi thì throw `Error` (lỗi lập trình của importer, spec mục 1).
  8. Đổi `DraftDiagnostic` thành `ImportDiagnostic`: `target` thành `DocumentPath` theo bảng mã của Task 2 (`["tables", id]`, `["columns", id]`, `["indexes", id]`… cộng `field` nếu có); `target` trỏ tới phần tử đã bị bỏ thì `path: null`. Trả `ok({ document, diagnostics: finalizeImportDiagnostics(...) })`.

**Test viết trước:**

- `resolve-references.test.ts`: `prefers an exact name match`; `falls back to a single case-insensitive match`; `returns null for two case-insensitive matches`; `resolves names such as __proto__ and constructor without touching the prototype`.
- `assemble-document.test.ts`: `assigns ids in the documented order` (`createCounterIdGenerator`, `toStrictEqual` với tài liệu kỳ vọng); `gives the same document for the same draft and id generator`; `drops a relation with an unknown column and reports reference-not-found at its location`; `drops a primary key with an unknown column but keeps the table`; `suggests a name for an index without one`; `uses the fallback schema name when the draft has none`; `maps a diagnostic target to the element path`; `reports too-many-elements one element over the limit`; `places tables through placeElements`; `drops repeated columns of a primary key and an index`; `drops a relation that still uses one column twice on a side`; `drops an index without columns and a relation without column pairs silently`; `throws when the draft holds a value outside the model shape` (ví dụ decimal `precision: 0`).

**Kiểm tra:** như "Quy ước chung" (core).

**Commit:** `feat(core): assemble imported documents from name-based drafts`

## Task 5: Xếp vị trí theo lưới

**Mục tiêu:** vị trí xác định, không chồng nhau cho bảng và ghi chú của SQL, Prisma, DBML (spec mục 4).

**Agent:** core-engineer. **Phụ thuộc:** Task 2. **Đợt:** 2.

**File sở hữu (tạo):** `packages/core/src/importers/shared/place-elements.ts`, `place-elements.test.ts`.

**Chữ ký và hành vi:**

```ts
export type PlacementInput = {
  readonly tables: readonly { readonly columnCount: number; readonly subjectAreaName: string | null }[]; // thứ tự xuất hiện trong nguồn
  readonly noteCount: number;
};
export type Placement = { readonly tables: readonly Position[]; readonly notes: readonly Position[] }; // cùng thứ tự với input
export function placeElements(input: PlacementInput, layout: LayoutMetrics): Placement;
```

- Thứ tự bảng: gom theo subject area, nhóm sắp theo `toNameKey(tên)` rồi theo tên (so `<`), nhóm `null` cuối; trong nhóm giữ thứ tự nguồn.
- Lưới: số cột `ceil(sqrt(tổng số bảng))` (ít nhất 1); ô rộng `tableWidth + gap`; mỗi nhóm bắt đầu hàng mới; chiều cao hàng là `headerHeight + max(số cột của bảng trong hàng) × columnRowHeight + gap`.
- Ghi chú: một hàng dưới mọi bảng, ô rộng `tableWidth + gap`, theo thứ tự.
- Gốc `{ x: 0, y: 0 }`; mọi tọa độ làm tròn bằng `Math.round`. `layout` có giá trị âm hoặc không hữu hạn thì throw `RangeError`.

**Test viết trước:** `places a single table at the origin`; `wraps rows after ceil(sqrt(n)) tables`; `starts each subject area on a new row`; `orders groups by name and puts tables without a group last`; `uses the tallest table of a row for the row height`; `places notes on their own row below every table`; `returns integer coordinates`; `never overlaps two tables for the given metrics` (property test với fast-check, `PROPERTY_SEED`: số bảng, số cột, nhóm ngẫu nhiên; hai hình chữ nhật `tableWidth × (headerHeight + cột × columnRowHeight)` không giao nhau); `throws a range error for negative metrics`.

**Kiểm tra:** như "Quy ước chung" (core).

**Commit:** `feat(core): place imported tables on a deterministic grid`

## Task 6: `buildImportOperation`

**Mục tiêu:** một hàm dựng `batch` phẳng cho cả hai chế độ import, đổi id, đổi tên trùng, tịnh tiến vị trí (spec mục 2 "Thêm vào schema hiện tại", "Hàm dựng"; Vấn đề 7); gộp hai bản riêng của `pickUnusedName`.

**Agent:** core-engineer. **Phụ thuộc:** Task 2. **Đợt:** 2.

**File sở hữu:** tạo `packages/core/src/operations/build-import-operation.ts`, `build-import-operation.test.ts`, `build-import-operation.properties.test.ts`, `pick-unused-name.ts`, `pick-unused-name.test.ts`; sửa `packages/core/src/operations/build-many-to-many.ts` và `packages/core/src/operations/build-relation.ts` (mỗi file chỉ import `pickUnusedName` từ file mới và xóa bản cục bộ; hai bản hiện có giống nhau về hành vi; `build-many-to-many.test.ts`, `build-relation.test.ts` pass nguyên vẹn).

**Chữ ký và hành vi:**

```ts
export type ImportMode = { readonly mode: "new" } | { readonly mode: "merge"; readonly origin: Position };
export function buildImportOperation(target: SchemaDocument, imported: SchemaDocument, mode: ImportMode, generateId: GenerateId):
  { readonly operation: BatchOperation; readonly diagnostics: readonly ImportDiagnostic[] };
export function pickUnusedName(baseName: string, usedNameKeys: ReadonlySet<string>): string; // hành vi cũ: `${base}_2`, `_3`…
```

- `new`: `target` có phần tử nào (bảng, enum, subject area, ghi chú, quan hệ, index, cột) thì throw `Error`. Giữ nguyên id và vị trí của `imported`; không có diagnostic.
- `merge`: id mới từ `generateId` cho mọi phần tử, đổi mọi tham chiếu (`columnIds`, khóa chính, cặp cột, `enumId` trong kiểu cột, `subjectAreaId`). Đổi tên trùng theo `toNameKey`: bảng và enum chung một tập tên (tên của đích cộng tên đã cấp); index so với tên index **và tên bảng** của đích và tên đã cấp (Vấn đề 7: tránh issue `index-name-conflicts-table` mới, như `suggestIndexName`); subject area so với subject area. Tên mới bằng `pickUnusedName`; mỗi lần đổi một diagnostic `table-renamed`, `enum-renamed`, `index-renamed`, `subject-area-renamed` với `path` theo bảng của Task 2 (id mới), `location: null`. Duyệt phần tử theo `sortEnums`, `sortTables`, `sortIndexes`, `sortSubjectAreas` của `imported` để kết quả xác định.
- Vị trí (`merge`): tịnh tiến mọi bảng và ghi chú để `min x`, `min y` của chúng bằng `origin`.
- Thứ tự bước: `addEnum`, `addSubjectArea`, rồi mỗi bảng `addTable`, các `addColumn`, `setPrimaryKey` (khi có khóa chính), rồi `addIndex`, `addRelation`, `addNote` (spec mục 2 bước 4). Hình dạng từng operation lấy từ `src/operations/step-operation-shapes.ts`; không có `renameSchema`. Kết quả luôn là `batch` độ sâu 1.
- Tên bảng trong chế độ `new` không đổi kể cả khi trùng nhau trong `imported` (issue `table-name-duplicate` hiện ở bước xem trước, spec mục 5 "Namespace").

**Test viết trước:**

- `pick-unused-name.test.ts`: `returns the base name when unused`; `appends the smallest unused number starting at 2`; `compares names case-insensitively`.
- `build-import-operation.test.ts`: `applies a new-mode batch on an empty schema to the imported document` (`applyOperation(createEmptySchema(name), op)` bằng `imported` sau khi đặt `name`); `throws in new mode when the target is not empty`; `gives every merged element a fresh id and rewrites references`; `renames a table that clashes with a table or an enum and reports table-renamed`; `renames an enum that clashes with a table`; `renames an index that clashes with an index or a table name`; `renames a subject area that clashes`; `keeps column names and enum values`; `moves merged tables and notes so their top left corner is at the origin`; `orders steps as enums, subject areas, tables with columns and keys, indexes, relations, notes`; `never nests batches`; `does not rename the schema`.
- `build-import-operation.properties.test.ts` (`schemaDocumentArbitrary`, `PROPERTY_SEED`, `PROPERTY_RUNS`): `always applies a merge batch to any target`; `keeps every element of the target unchanged`; `restores the target exactly when the inverse is applied`; `applies a new-mode batch on an empty schema`.

**Kiểm tra:** như "Quy ước chung" (core), cộng `pnpm --filter @schemaforge/frontend typecheck`.

**Commit:** `feat(core): build import batches for new and merged schemas`

## Task 7: IE-04 importer JSON

**Mục tiêu:** đọc file JSON của IE-06, giữ id và vị trí, lỗi cú pháp có dòng, cột (spec mục 8 "Import").

**Agent:** core-engineer. **Phụ thuộc:** Task 2, 3. **Đợt:** 2.

**File sở hữu (tạo), kèm test cùng tên:** `packages/core/src/importers/json/index.ts` (chỉ re-export), `import-json.ts`, `locate-json-syntax-error.ts`.

**Chữ ký và hành vi:**

- `locateJsonSyntaxError(source: string): SourceLocation | null`: một lượt quét theo ngữ pháp JSON (RFC 8259: khoảng trắng, object, array, string với escape và cấm ký tự điều khiển, number, `true`, `false`, `null`, đúng một giá trị gốc) dùng stack tường minh, không đệ quy; trả vị trí ký tự đầu tiên không hợp lệ (hoặc ngay sau ký tự cuối khi văn bản kết thúc sớm); `null` nếu văn bản hợp lệ. Không đọc thông báo của `SyntaxError` (spec mục 8).
- `importJson(source: string, options: ImportOptions): ImportResult`: `checkSourceLength`; `JSON.parse` trong `try`; lỗi thì `syntax-error` tại `locateJsonSyntaxError(source)` (`null` nếu bộ định vị không thấy lỗi); `parseSchemaDocument`, lỗi thì mỗi `StructuralError` một diagnostic giữ `code`, `path`, `location: null`; `countDocumentElements` vượt giới hạn thì `too-many-elements`; thành công trả tài liệu nguyên vẹn, không diagnostic. `options` chỉ dùng cho hợp đồng chung (không cấp id, không xếp vị trí).

**Test viết trước:**

- `locate-json-syntax-error.test.ts`: `returns null for valid json`; `locates a missing comma`, `a trailing comma`, `an unterminated string`, `a control character inside a string`, `an invalid escape`, `a second root value`, `an unexpected end` (`it.each` với vị trí kỳ vọng); `counts columns in code units after an emoji`; `handles 20000 nested brackets without a stack overflow`.
- `import-json.test.ts`: `imports a file written by serializeSchemaDocument byte for byte` (`serializeSchemaDocument(result.document)` bằng chuỗi gốc, `createSampleSchema()`); `reports syntax-error with line and column`; `keeps the structural error code and path of parseSchemaDocument`; `reports version-unsupported for a future version`; `rejects a source one code unit over the limit`; `reports too-many-elements`; `rejects __proto__ keys without touching Object.prototype` (`it.each`: `__proto__` làm khóa của map `tables` với giá trị là một bảng hợp lệ khác id, và làm khóa gốc `{"__proto__": {"polluted": true}, …}` cạnh các khóa hợp lệ; mỗi trường hợp `Result` lỗi, và `expect(Object.prototype).not.toHaveProperty("polluted")`, `Object.getOwnPropertyNames(Object.prototype)` trước và sau bằng nhau).

**Kiểm tra:** như "Quy ước chung" (core). `pnpm --filter @schemaforge/core build` rồi `ls packages/core/dist/importers/json/index.js` tồn tại.

**Commit:** `feat(core): add json schema importer`

## Task 8: Probe `@dbml/core` 10.2.0 và adapter

**Mục tiêu:** kiểm chứng trên bản thật mọi hành vi của `@dbml/core` mà spec mục 5, 7 dựa vào và các điểm "chưa thử" của mục "Rủi ro"; bọc thư viện trong đúng một adapter có type hẹp, bắt mọi ngoại lệ (spec mục 1, gạch đầu dòng "Type của `@dbml/core`" và "Không throw"; Vấn đề 3).

**Agent:** core-engineer. **Phụ thuộc:** Task 1, 2. **Đợt:** 2.

**File sở hữu (tạo):** `packages/core/src/importers/shared/dbml-core-adapter.ts`, `dbml-core-adapter.test.ts`, `dbml-core-adapter.probe.test.ts`.

**Probe viết trước** (`dbml-core-adapter.probe.test.ts`, gọi thẳng `Parser.parse` của `@dbml/core`; mỗi điểm một `it` ghi hành vi **đang quan sát được**; mỗi dialect một `it.each` khi áp dụng):

1. Dòng và cột của lỗi cú pháp ở cột đầu dòng: SQL (`postgres`, `mysql`, `mssql`) và `dbmlv2`; hình dạng object ném ra (`diags`, `location.start`).
2. Tên không quote: giữ nguyên hoa thường hay bị đổi.
3. Ràng buộc `UNIQUE` (trong cột, cấp bảng, một và nhiều cột) so với `CREATE UNIQUE INDEX`: model có phân biệt không.
4. `ALTER TABLE … ADD COLUMN`; `ALTER TABLE ONLY … ADD CONSTRAINT … PRIMARY KEY`, `FOREIGN KEY` (PostgreSQL); khóa ngoại qua `ALTER TABLE` trên `mssql`.
5. MySQL `ON UPDATE CURRENT_TIMESTAMP`, cột tính toán ba dialect, `COLLATE` của cột, `DESC` và `WHERE` của index: giữ lại, bỏ âm thầm hay báo lỗi.
6. Giá trị mặc định: dạng `{ type, value }` cho chuỗi, số (kể cả `12345678901234567890.123`), boolean, biểu thức, `N'a'`.
7. Kiểu: tên kiểu kèm tham số; `bigint IDENTITY(1,1)` của `mssql`; `ENUM(…)` MySQL tạo enum tên gì; `CREATE TYPE … AS ENUM`.
8. Comment: `COMMENT ON`, `COMMENT` MySQL, `sp_addextendedproperty`; CHECK của cột và bảng.
9. Câu lệnh bị bỏ âm thầm: view, trigger, sequence, function có `$$…$$`, `DECLARE`, `EXEC`, và `ALTER TABLE … ALTER COLUMN … ADD GENERATED … AS IDENTITY`.
10. Vị trí (`token`) trên phần tử của model SQL và DBML.
11. DBML: tên kiểu trong nháy kép có mất nháy không; mặc định số có phải số JavaScript không; `Project` (tên, `database_type`, `note`), `TableGroup` (bảng, `note`, `color`), `Note` độc lập, `headercolor`, `type: hash` của index, tên và `color` của `Ref`, `Records`, `<>`, `checks`.

Thời gian parse DDL 200 bảng không đo ở probe: Task 19 đo bằng bench (test thường không có số đo thời gian).

Kết quả từng điểm ghi thành bảng "Điểm | Spec ghi | Quan sát trên 10.2.0" trong execution log. **Điểm nào khác spec mục 5, 7 hoặc mục 1 (gốc cột) thì dừng ở đây với trạng thái `Bị chặn` và báo orchestrator**, không viết adapter theo giả định; orchestrator cho sửa spec và các task 10, 11, 12, 16 trước. Probe test giữ lại trong repo làm test đặc tả (đổi bản `@dbml/core` mà hành vi đổi thì test đỏ).

**Chữ ký và hành vi** (sau khi probe khớp):

```ts
export type CoreParseResult<T> = Result<T, readonly ImportDiagnostic[]>;
export function parseSqlWithDbmlCore(source: string, dialect: SqlDialect): CoreParseResult<CoreDatabase>;
export function parseDbmlWithDbmlCore(source: string): CoreParseResult<CoreDatabase>;
```

- `SqlDialect` lấy từ `generators/shared/generator-types.ts`; ánh xạ `postgresql` → `"postgres"`, `mysql` → `"mysql"`, `sqlserver` → `"mssql"`; DBML dùng `"dbmlv2"`.
- `CoreDatabase` là type hẹp do adapter định nghĩa, chỉ gồm trường mà importer đọc, mọi trường `readonly`: `project` (`name`, `databaseType`, `note`, đều `string | null`); `tables` (tên, tên schema, `note`, `headerColor`, `fields`, `indexes`, `checks`, `token`); `fields` (tên, tên kiểu thô, `pk`, `unique`, `notNull`, `increment`, `dbdefault` dạng `{ type: "string" | "number" | "boolean" | "expression"; value: string }`, `note`, `checks`, `token`); `indexes` (tên, cột kèm cờ biểu thức, `unique`, `pk`, `type`, `note`, `token`); `refs` (tên, `color`, hai đầu mút với tên schema, bảng, danh sách cột, `relation` `"1" | "*"`, `onDelete`, `onUpdate`, `token`); `enums` (tên, giá trị kèm `note`, `token`); `tableGroups` (tên, tên bảng, `note`, `color`, `token`); `notes` (nội dung, `token`); `records` (vị trí của khối đầu tiên hoặc `null`); `token` là `{ start: SourceLocation; end: SourceLocation } | null` đã chuẩn hóa về cột từ 1. Tên trường cụ thể đặt theo những gì probe quan sát; mọi chỗ `any` của thư viện được thu hẹp bằng type guard trên `unknown` trong file này (`typescript.md`).
- Mọi lời gọi `Parser.parse` nằm trong `try`: object có `diags` thì mỗi mục thành `syntax-error` tại `fromParserPosition(line, column, gốc cột theo probe)`; mục không có vị trí thì `location: null`; mọi ngoại lệ khác (kể cả `RangeError`) thành một `parse-failed` không vị trí (spec mục 1). Adapter không gọi `checkSourceLength` (importer gọi trước).

**Test viết trước** (`dbml-core-adapter.test.ts`): `maps a sql syntax error at the start of a line to column 1` (`it.each` ba dialect); `maps a dbml syntax error at the start of a line to column 1`; `returns parse-failed when the parser throws something without diagnostics` (gọi với input gây ném lỗi không có `diags` theo probe; nếu không tìm được input như vậy thì test hàm chuyển lỗi nội bộ qua đầu vào là object lỗi, và ghi lý do vào log); `narrows a parsed table with fields, indexes and tokens`; `narrows a dbml project, table group and note`.

**Kiểm tra:** như "Quy ước chung" (core). `pnpm --filter @schemaforge/core lint` không có lỗi ranh giới; `pnpm --filter @schemaforge/core build` rồi `grep -rlE "from ['\"]@dbml/core|import\(['\"]@dbml/core" packages/core/dist --include='*.js'` (chỉ tìm câu import, vì `tsc` giữ comment nhắc tới thư viện) chỉ in `packages/core/dist/importers/shared/dbml-core-adapter.js`.

**Review:** sau khi orchestrator kiểm tra, `ecc:security-reviewer` review riêng task này (chỉ review, không sửa file): adapter bắt mọi ngoại lệ của parser với input bất kỳ, không lộ type `any` ra ngoài.

**Commit:** `feat(core): wrap dbml parser behind a narrow adapter`

## Task 9: Statement scanner SQL

**Mục tiêu:** tokenizer một lượt tách và phân loại câu lệnh SQL để báo câu lệnh mà parser bỏ âm thầm, cung cấp vị trí cho diagnostic và văn bản đã lọc cho parser (spec mục 5 "Luồng xử lý", bảng phân loại; mục 13; mục "Rủi ro" về `DELIMITER`, Vấn đề 10).

**Agent:** core-engineer. **Phụ thuộc:** Task 0. **Đợt:** 1.

**File sở hữu (tạo), kèm test cùng tên:** `packages/core/src/importers/sql/statement-scanner.ts`, `classify-statement.ts`.

**Chữ ký và hành vi:**

```ts
export type SqlTokenKind = "word" | "quotedIdentifier" | "string" | "number" | "symbol";
export type SqlToken = { readonly kind: SqlTokenKind; readonly text: string; readonly value: string; readonly start: number; readonly depth: number };
export type SqlStatement = { readonly start: number; readonly end: number; readonly tokens: readonly SqlToken[] };
export type ScanFailure = { readonly offset: number }; // chuỗi, comment, định danh không đóng
export function tokenizeSql(text: string, dialect: SqlDialect): Result<readonly SqlToken[], ScanFailure>;
export function scanSqlStatements(source: string, dialect: SqlDialect): Result<readonly SqlStatement[], ScanFailure>;
export function maskStatements(source: string, statements: readonly SqlStatement[], shouldKeep: (statement: SqlStatement) => boolean): string;
```

- Nhận biết theo spec mục 5: comment `--`, `/* … */` (lồng nhau với PostgreSQL), `#` (MySQL); chuỗi `'…'` với `''`, `E'…'` (PostgreSQL), `N'…'`, `\'` (MySQL); dollar quote `$tag$…$tag$` (PostgreSQL); định danh `"…"`, `` `…` `` (MySQL), `[…]` (SQL Server); `;` ở độ sâu ngoặc 0 kết thúc câu; dòng chỉ có `GO` (không phân biệt hoa thường, cho phép khoảng trắng) kết thúc câu với SQL Server; MySQL: dòng `DELIMITER <chuỗi>` đổi dấu kết thúc câu cho tới dòng `DELIMITER` tiếp theo, dòng đó không thành câu lệnh (Vấn đề 10). `value` là văn bản đã bỏ quote và giải escape; `depth` là độ sâu ngoặc tròn tại token. Comment không thành token. Câu lệnh rỗng bị bỏ.
- `maskStatements` thay mọi ký tự của câu không giữ (từ `start` tới `end`, gồm dấu kết thúc) bằng dấu cách, giữ `\n` và `\r`, nên độ dài và vị trí dòng, cột không đổi.

```ts
export type StatementKind = "parser" | "postgresqlAlterColumn" | "sqlserverExtendedProperty" | "ignored" | "data"
  | "view" | "routine" | "trigger" | "sequence" | "unsupported";
export function classifyStatement(statement: SqlStatement, dialect: SqlDialect): StatementKind;
```

- Đúng bảng phân loại của spec mục 5 theo từ khóa đầu câu (so không phân biệt hoa thường): "Cấu trúc, parser đọc" → `parser`; PostgreSQL `ALTER TABLE [ONLY] t ALTER COLUMN c ADD GENERATED …` và `ALTER COLUMN c SET DEFAULT …` → `postgresqlAlterColumn`; SQL Server `EXEC [sys.]sp_addextendedproperty …` → `sqlserverExtendedProperty`; nhóm "Không mô tả cấu trúc" và `DROP …` → `ignored`; nhóm "Dữ liệu" → `data`; `CREATE [OR REPLACE] [MATERIALIZED] VIEW` → `view`; `FUNCTION`, `PROCEDURE` → `routine`; `TRIGGER` → `trigger`; `CREATE SEQUENCE`, `ALTER SEQUENCE` → `sequence`; `CREATE DOMAIN`, `POLICY`, `RULE`, `STATISTICS`, `CREATE TYPE` không có `AS ENUM`, `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, `COMMENT ON` đối tượng khác `TABLE`, `COLUMN`, và mọi câu khác → `unsupported`. `ALTER TABLE … DISABLE KEYS`, `ENABLE KEYS` → `data`.

**Test viết trước:**

- `statement-scanner.test.ts`: `splits statements on semicolons at depth zero`; `ignores semicolons inside strings, comments and quoted identifiers` (`it.each` theo dialect); `reads nested block comments in postgresql`; `reads dollar-quoted bodies`; `reads escaped quotes in mysql strings`; `reads bracketed identifiers in sql server`; `splits on a GO line in sql server`; `switches the terminator after a DELIMITER line in mysql`; `reports the offset of an unterminated string`; `masks dropped statements without moving line or column positions`; `scans a 2 MiB source and returns every statement` (đếm số câu kỳ vọng; không assert thời gian, thời gian do bench của Task 19 đo).
- `classify-statement.test.ts`: một `it.each` cho mỗi dòng của bảng phân loại trong spec mục 5, mỗi dialect áp dụng; `classifies drop statements as ignored`; `classifies an unknown statement as unsupported`.

**Kiểm tra:** như "Quy ước chung" (core).

**Commit:** `feat(core): add sql statement scanner for imports`

## Task 10: Ánh xạ kiểu và giá trị mặc định SQL

**Mục tiêu:** hai bảng ánh xạ của spec mục 5 viết một lần, dùng cho importer SQL, DBML (kiểu không phải kiểu chung) và `dbgenerated` của Prisma (spec mục 5 "Ánh xạ kiểu", "Giá trị mặc định"; mục 6 bảng giá trị mặc định; mục 7 bảng ánh xạ).

**Agent:** core-engineer. **Phụ thuộc:** Task 2, 9 (`tokenizeSql`). **Đợt:** 2.

**File sở hữu (tạo), kèm test cùng tên:** `packages/core/src/importers/shared/sql-type-mapping.ts`, `sql-default-mapping.ts`.

**Chữ ký và hành vi:**

```ts
export type SqlTypeInput = { readonly rawType: string; readonly dialect: SqlDialect; readonly enumNameKeys: ReadonlySet<string>; readonly hasUuidDefault: boolean };
export type SqlTypeMapping = { readonly type: DraftColumnType; readonly isAutoIncrement: boolean; readonly codes: readonly ImportDiagnosticCode[] };
export function mapSqlType(input: SqlTypeInput): SqlTypeMapping;
export function splitSqlServerIdentity(rawType: string): { readonly typeName: string; readonly identity: { readonly seed: string; readonly step: string } | null };
```

- So tên kiểu không phân biệt hoa thường, sau khi bỏ quote và gộp khoảng trắng; tách tham số trong ngoặc bằng `tokenizeSql` (không regex lồng). Đúng từng ô của bảng "Ánh xạ kiểu" ở spec mục 5; "≈" thêm `type-approximated`; tham số không có trong model thêm `type-parameter-dropped`; `serial`, `bigserial`, `smallserial` bật `isAutoIncrement`; MySQL `CHAR(36)` có `hasUuidDefault` thành `uuid`; tên trùng `enumNameKeys` (PostgreSQL) thành `{ kind: "enum", enumName }`; tên không khớp thành `custom` với tên nguyên văn nếu `isSafeCustomTypeName`, ngược lại `text` kèm `type-not-supported`.
- `splitSqlServerIdentity`: tách `IDENTITY(seed, step)` ở cuối tên kiểu bằng token; `seed` hoặc `step` khác `1` do importer báo `identity-options-dropped`.

```ts
export type RawSqlDefault = { readonly kind: "string" | "number" | "boolean" | "expression"; readonly text: string };
export type SqlDefaultMapping = { readonly defaultValue: ColumnDefault | null; readonly isAutoIncrement: boolean; readonly codes: readonly ImportDiagnosticCode[] };
export function mapSqlDefault(input: { readonly raw: RawSqlDefault; readonly columnType: DraftColumnType; readonly dialect: SqlDialect | "any" }): SqlDefaultMapping;
```

- Chuẩn hóa trước khi so: bỏ ngoặc bao ngoài, tiền tố `N` của chuỗi, ép kiểu cuối của PostgreSQL (`::status`, `::character varying`). Đúng bảng "Giá trị mặc định" của spec mục 5: literal giữ văn bản gốc (số lấy từ `text`, không qua `Number`); `NULL` thì không có mặc định; các hàm thời gian trên `timestamp`, `timestamptz` → `currentTimestamp`; các hàm uuid trên `uuid` → `generateUuid` (`newsequentialid()` kèm `default-approximated`); `nextval('…')` trên kiểu số nguyên → không mặc định, `isAutoIncrement`, `sequence-default-as-auto-increment`; còn lại bỏ kèm `default-not-supported`. `dialect: "any"` (DBML) nhận hợp các biểu thức của ba dialect. `1`, `0` trên cột `boolean` của SQL Server là literal `true`, `false`.

**Test viết trước:**

- `sql-type-mapping.test.ts`: `maps every row of the type table` (`it.each` theo dialect, một mục cho mỗi tên kiểu trong bảng spec mục 5, kèm mã kỳ vọng); `marks serial types as auto increment`; `maps mysql char(36) with a uuid default to uuid and without it to char(36)`; `maps a postgresql type named after an enum to that enum`; `keeps a safe unknown type as custom verbatim`; `maps an unsafe unknown type to text with type-not-supported`; `splits a sql server identity clause`.
- `sql-default-mapping.test.ts`: `maps every row of the default table` (`it.each`); `keeps a large decimal literal text without losing precision` (`12345678901234567890.123`); `strips wrapping parentheses, n prefixes and postgresql casts`; `maps nextval on an integer column to auto increment`; `drops a timestamp function on a non-timestamp column with default-not-supported`; `accepts expressions of all three dialects for dbml`.

**Kiểm tra:** như "Quy ước chung" (core).

**Commit:** `feat(core): map sql types and defaults for importers`

## Task 11: Phần scanner tự đọc của SQL

**Mục tiêu:** đọc thông tin mà `@dbml/core` 10.2.0 bỏ âm thầm, để importer SQL không mất gì mà không có diagnostic: identity và mặc định qua `ALTER TABLE … ALTER COLUMN` của `pg_dump`, comment `sp_addextendedproperty` của SQL Server, CHECK `IN` thành enum; định nghĩa cột trong `CREATE TABLE` (văn bản kiểu gốc, `ON UPDATE`, `COLLATE`, cột tính toán), ràng buộc `UNIQUE` cấp bảng, `DESC` và `WHERE` của `CREATE INDEX`; phân loại `ALTER TABLE … ADD` mà parser bỏ thành câu không hỗ trợ (spec mục 5: bảng phân loại, đoạn "Scanner đọc lại câu đã đưa cho parser", "Namespace, tên, khóa, quan hệ", "Ánh xạ kiểu", "Giá trị mặc định", "Kết quả probe `@dbml/core` 10.2.0"; Vấn đề 20).

**Agent:** core-engineer. **Phụ thuộc:** Task 2, 9, 10. **Đợt:** 3.

**File sở hữu:**

- Tạo, kèm test cùng tên, trong `packages/core/src/importers/sql/`: `postgresql-identity.ts`, `sqlserver-extended-property.ts`, `check-to-enum.ts`, `sql-column-definitions.ts`, `sql-index-definitions.ts`.
- Sửa: `packages/core/src/importers/sql/classify-statement.ts`, `classify-statement.test.ts`. Nếu `classify-statement.ts` vượt khoảng 300 dòng, chuyển các quy tắc `ALTER TABLE` sang file mới cùng thư mục (ví dụ `classify-alter-table.ts`, không test riêng vì test của `classifyStatement` phủ đủ) và ghi tên file vào log.

**Chữ ký và hành vi:**

```ts
export type PostgresqlAlterColumn = { readonly tableName: string; readonly columnName: string; readonly start: number;
  readonly change: { readonly kind: "identity" } | { readonly kind: "default"; readonly raw: RawSqlDefault } };
export function readPostgresqlAlterColumn(statement: SqlStatement): PostgresqlAlterColumn | null;
export type SqlServerDescription = { readonly tableName: string; readonly columnName: string | null; readonly description: string; readonly start: number };
export function readSqlServerDescription(statement: SqlStatement): SqlServerDescription | null;
export function readCheckEnumValues(input: { readonly expression: string; readonly columnName: string; readonly dialect: SqlDialect }): readonly string[] | null;
```

- `readPostgresqlAlterColumn`: `ALTER TABLE [ONLY] [schema.]t ALTER COLUMN c ADD GENERATED {ALWAYS | BY DEFAULT} AS IDENTITY …` (bỏ qua phần tùy chọn trong ngoặc) hoặc `ALTER COLUMN c SET DEFAULT <biểu thức>` (`raw` lấy văn bản gốc từ token đầu của biểu thức tới hết câu; loại theo token đầu: chuỗi, số, `true`/`false`, còn lại `expression`). Tên bảng bỏ phần schema. Dạng khác trả `null` (importer báo `statement-not-supported`).
- `readSqlServerDescription`: `EXEC [sys.]sp_addextendedproperty` với đối số có tên hoặc theo vị trí; chỉ nhận `@name = N'MS_Description'`, `@value` là chuỗi, `@level1type = N'TABLE'` và tùy chọn `@level2type = N'COLUMN'`, `@level1name`, `@level2name` là chuỗi. Dạng khác trả `null`.
- `readCheckEnumValues`: biểu thức (bỏ ngoặc bao ngoài) đúng dạng `<cột> IN (<chuỗi>, …)` với cột trùng `columnName` theo tên chính xác hoặc `toNameKey`; cột có thể nằm trong quote của dialect và có ép kiểu `::text`; chuỗi có thể có tiền tố `N` hoặc ép kiểu; ít nhất một giá trị. Trả danh sách giá trị theo thứ tự; dạng khác trả `null`. Dùng `tokenizeSql`, không regex.

`sql-column-definitions.ts`:

```ts
export type SqlColumnDefinition = {
  readonly name: string;         // `value` của token tên cột (đã bỏ quote)
  readonly start: number;        // offset của token tên cột
  readonly rawType: string;      // văn bản nguồn của kiểu, "" khi cột không khai báo kiểu (cột tính toán SQL Server)
  readonly hasOnUpdate: boolean;
  readonly hasCollation: boolean;
  readonly isComputed: boolean;
};
export type SqlUniqueConstraint = {
  readonly name: string | null;
  readonly columnNames: readonly string[];
  readonly isMysqlKey: boolean;  // dạng MySQL `UNIQUE KEY | INDEX [n] (…)`
  readonly hasDroppedElementOption: boolean; // `DESC`, `NULLS …`, opclass, `COLLATE`, độ dài tiền tố MySQL trên phần tử cột
};
export type SqlTableDefinition = {
  readonly tableName: string;    // bỏ phần schema
  readonly start: number;
  readonly columns: readonly SqlColumnDefinition[];
  readonly uniqueConstraints: readonly SqlUniqueConstraint[];
};
export function readSqlTableDefinition(statement: SqlStatement, source: string): SqlTableDefinition | null;
export type SqlAddedUniqueConstraint = { readonly tableName: string; readonly start: number; readonly constraint: SqlUniqueConstraint };
export function readAddedUniqueConstraint(statement: SqlStatement): SqlAddedUniqueConstraint | null;
```

- Đọc trên `statement.tokens` (độ sâu `depth` của Task 9: `(` mang độ sâu bên ngoài, token bên trong có độ sâu + 1), không regex, không parse lại nguồn; so từ khóa không phân biệt hoa thường và chỉ với token `kind: "word"` (định danh trong quote như `"unique"` là tên, không phải từ khóa).
- `readSqlTableDefinition`: câu `CREATE TABLE [IF NOT EXISTS] [schema.]t ( … )`; câu khác trả `null`. Danh sách định nghĩa là các token ở độ sâu 1 trong cặp ngoặc đầu tiên ở độ sâu 0 sau tên bảng, tách bằng `,` ở độ sâu 1.
  - Phần tử bắt đầu bằng từ khóa ràng buộc (`CONSTRAINT`, `PRIMARY`, `UNIQUE`, `FOREIGN`, `CHECK`, `KEY`, `INDEX`, `FULLTEXT`, `SPATIAL`, `EXCLUDE`, `LIKE`) không phải cột. Trong đó `[CONSTRAINT n] UNIQUE [KEY | INDEX] [CLUSTERED | NONCLUSTERED] [n] (…)` cho một `SqlUniqueConstraint` (`isMysqlKey` khi có `KEY` hoặc `INDEX` sau `UNIQUE`); `WITH (…)` và `ON [filegroup]` sau danh sách cột (SSMS) bị bỏ qua, không đánh dấu gì. Phần tử của danh sách cột đọc như ở `readSqlIndexDefinition` dưới đây: tên cột là token định danh đầu tiên của phần tử (ngay sau `(` hoặc `,` ở độ sâu 2); `DESC`, `NULLS FIRST | LAST`, opclass, `COLLATE …` và độ dài tiền tố MySQL `c(10)` (cột `c` vẫn giữ, không coi là biểu thức) bật `hasDroppedElementOption`; `ASC` không bật.
  - Phần tử khác là một cột: token đầu là tên. Kiểu là các token từ token thứ hai tới trước từ khóa kết thúc đầu tiên ở độ sâu 1, trong hằng `COLUMN_CONSTRAINT_WORDS`: `NOT`, `NULL`, `DEFAULT`, `CONSTRAINT`, `PRIMARY`, `UNIQUE`, `KEY`, `REFERENCES`, `CHECK`, `COLLATE`, `CHARSET`, `CHARACTER` khi theo sau là `SET`, `GENERATED`, `AS`, `AUTO_INCREMENT`, `COMMENT`, `ON`, `ROWGUIDCOL`, `SPARSE`, `VISIBLE`, `INVISIBLE`. `IDENTITY(…)` của SQL Server, `UNSIGNED`, `ZEROFILL`, `WITH TIME ZONE`, `VARYING`, `PRECISION` thuộc kiểu. `rawType` là `source.slice(đầu token đầu, cuối token cuối)` của kiểu (giữ nguyên khoảng trắng, xuống dòng và hoa thường; `mapSqlType` tự gộp); không có token kiểu thì `""`.
  - `hasOnUpdate`: có cặp `ON UPDATE` ở độ sâu 1 nằm ngoài mệnh đề `REFERENCES …` (hành động `ON UPDATE` của khóa ngoại trên cột không tính). `hasCollation`: có `COLLATE`, `CHARSET` hoặc `CHARACTER SET` ở độ sâu 1. `isComputed`: có `AS` ở độ sâu 1 theo ngay sau là `(` (PostgreSQL `GENERATED ALWAYS AS (…) STORED`, MySQL `[GENERATED ALWAYS] AS (…) [VIRTUAL | STORED]`), hoặc token thứ hai của cột là `AS` (SQL Server `c AS <biểu thức> [PERSISTED]`). `GENERATED … AS IDENTITY` không phải cột tính toán.
- `readAddedUniqueConstraint`: câu `ALTER TABLE [ONLY] [IF EXISTS] [schema.]t [WITH CHECK | WITH NOCHECK] ADD [CONSTRAINT n] UNIQUE [KEY | INDEX] [n] [CLUSTERED | NONCLUSTERED] (…)`; tên cột đọc như trên. Dạng khác trả `null`.

`sql-index-definitions.ts`:

```ts
export type SqlIndexDefinition = {
  readonly indexName: string | null;              // null với `CREATE INDEX ON t (…)` của PostgreSQL
  readonly tableName: string;                     // bỏ phần schema
  readonly start: number;
  readonly isUnique: boolean;
  readonly columnNames: readonly (string | null)[]; // theo thứ tự; null cho phần tử biểu thức
  readonly hasDroppedElementOption: boolean;      // `DESC`, `NULLS FIRST | LAST`, opclass, `COLLATE`, độ dài tiền tố MySQL
  readonly hasInclude: boolean;                   // SQL Server `INCLUDE (…)`
  readonly hasWhere: boolean;
  readonly whereNotNullColumnNames: readonly string[] | null;
};
export function readSqlIndexDefinition(statement: SqlStatement): SqlIndexDefinition | null;
```

- Câu `CREATE [UNIQUE] [CLUSTERED | NONCLUSTERED] INDEX [CONCURRENTLY] [IF NOT EXISTS] [n] ON [ONLY] [schema.]t [USING m] ( … ) …`; câu khác trả `null`.
- Phần tử của danh sách cột là các đoạn ở độ sâu 1 trong cặp ngoặc đầu tiên ở độ sâu 0 sau tên bảng, tách bằng `,` ở độ sâu 1. Phần tử gồm một định danh, tùy chọn theo sau độ dài tiền tố MySQL `(n)`, `ASC`, `DESC`, `NULLS FIRST | LAST`, opclass hoặc `COLLATE …`, cho tên cột (độ dài tiền tố không làm phần tử thành biểu thức); phần tử khác cho `null`. `hasDroppedElementOption`: một phần tử cột có `DESC`, `NULLS FIRST | LAST`, opclass, `COLLATE …` hoặc độ dài tiền tố (`ASC` không tính). `hasInclude`: có `INCLUDE (…)` ở độ sâu 0 sau danh sách cột. `WITH (…)` và `ON [filegroup]` (giá trị lưu trữ mặc định SSMS ghi) bị bỏ qua, không đánh dấu gì.
- `hasWhere`: có `WHERE` ở độ sâu 0 sau danh sách cột. `whereNotNullColumnNames`: khi phần sau `WHERE` đúng dạng `<định danh> IS NOT NULL` nối bằng `AND` (không ngoặc, dạng CG-01 ghi cho SQL Server), danh sách các định danh đó; dạng khác hoặc không có `WHERE` thì `null`.

`classify-statement.ts` (sửa, chữ ký không đổi):

- PostgreSQL, MySQL `ALTER TABLE … ADD` (sau phần `[ONLY] [IF EXISTS] tên` mà Task 9 đã đọc): từ sau `ADD` là `COLUMN`, hoặc là định danh không thuộc từ khóa ràng buộc (`CONSTRAINT`, `PRIMARY`, `UNIQUE`, `FOREIGN`, `CHECK`, `INDEX`, `KEY`, `FULLTEXT`, `SPATIAL`, `EXCLUDE`), thì câu là `unsupported` (parser bỏ âm thầm `ADD COLUMN`). SQL Server `ADD <cột>` vẫn là `parser`.
- MySQL `ALTER TABLE … ADD UNIQUE …` và `ADD CONSTRAINT n UNIQUE …` là `unsupported`. `ADD PRIMARY KEY`, `ADD FOREIGN KEY`, `ADD CHECK`, `ADD CONSTRAINT n {PRIMARY KEY | FOREIGN KEY | CHECK}` của cả ba dialect và PostgreSQL `ADD CONSTRAINT n UNIQUE` vẫn là `parser`.

**Test viết trước:**

- `postgresql-identity.test.ts`: `reads an identity added by pg_dump`; `reads an identity with sequence options`; `reads a default set through alter column`; `strips the schema of the table name`; `returns null for another alter column form`.
- `sqlserver-extended-property.test.ts`: `reads a table description`; `reads a column description`; `reads positional arguments`; `ignores a property other than MS_Description`; `returns null when the value is not a string`.
- `check-to-enum.test.ts`: `reads values of an in check` (`it.each`: PostgreSQL `::text`, SQL Server `N'…'` và `[col]`, MySQL `` `col` ``); `returns null for a check on another column`; `returns null for a comparison check`; `returns null for an empty list`.
- `sql-column-definitions.test.ts`: `reads the exact type text of multi-word postgresql types` (`it.each`: `timestamp with time zone`, `time with time zone`, `double precision`, `bit varying(4)`, `character varying(255)`, `interval day to second`, kiểu viết trên hai dòng); `keeps mysql unsigned and zerofill in the type text`; `keeps a sql server identity clause in the type text`; `stops the type at the first column constraint word` (`it.each` theo `COLUMN_CONSTRAINT_WORDS`); `reads a quoted column named like a keyword as a column`; `detects on update outside a references clause`; `ignores on update of an inline foreign key`; `detects collate and character set`; `detects computed columns in the three dialects` (`it.each`); `does not treat an identity as a computed column`; `gives an empty type for a sql server computed column`; `reads table-level unique constraints with their names and columns` (`it.each`: `UNIQUE (a)`, `CONSTRAINT u UNIQUE (a, b)`, MySQL `UNIQUE KEY u (a)`, `UNIQUE INDEX (a(10))` có `hasDroppedElementOption`, SSMS `CONSTRAINT [u] UNIQUE NONCLUSTERED ([a] ASC) WITH (PAD_INDEX = OFF) ON [PRIMARY]`); `strips the schema of the table name`; `returns null for a statement other than create table`; `reads a unique constraint added through alter table`; `returns null for another alter table form`.
- `sql-index-definitions.test.ts`: `reads the name, table, uniqueness and columns of an index`; `reads an unnamed postgresql index`; `marks expression elements as null`; `flags dropped element options` (`it.each`: `DESC`, `NULLS LAST`, opclass `text_pattern_ops`, `COLLATE "C"`, MySQL `c(10)` giữ tên `c`); `does not flag asc`; `detects a sql server include clause`; `ignores with options and a filegroup`; `detects a where clause`; `reads the columns of a not-null filter` (dạng CG-01 SQL Server); `returns null filter columns for another where clause`; `skips clustered, concurrently, if not exists, only and using`; `returns null for a statement other than create index`.
- `classify-statement.test.ts` (thêm): `classifies add column on postgresql and mysql as unsupported` (`it.each`: `ADD COLUMN c int`, `ADD c int`, `ADD COLUMN IF NOT EXISTS c int`, mỗi dialect); `keeps add column on sql server for the parser`; `classifies a mysql add unique as unsupported` (`it.each`: `ADD UNIQUE (c)`, `ADD UNIQUE KEY k (c)`, `ADD CONSTRAINT u UNIQUE (c)`); `keeps add constraint unique on postgresql for the parser`; `keeps add primary key, foreign key and check for the parser` (`it.each` ba dialect).

**Kiểm tra:** như "Quy ước chung" (core). Test có sẵn của `classify-statement.test.ts` vẫn pass, trừ test ghim hành vi cũ của `ALTER TABLE … ADD` cột, `ADD UNIQUE` (cập nhật theo quy tắc trên và ghi tên test vào log).

**Commit:** `feat(core): read sql column definitions, identities and index options`

## Task 12: IE-01 importer SQL

**Mục tiêu:** `importPostgresql`, `importMysql`, `importSqlserver` theo spec mục 5, đạt điểm bất động của DDL trên ba fixture và đọc đúng fixture dạng `pg_dump`, `mysqldump`, SQL Server Management Studio (spec mục 5, mục 15 dòng "SQL" và "Round-trip"; tiêu chí IE-01).

**Agent:** core-engineer. **Phụ thuộc:** Task 4, 5, 8, 9, 10, 11; spec mục 5 đã sửa theo bảng probe của Task 8 (Vấn đề 20). **Đợt:** 4.

**File sở hữu (tạo):** trong `packages/core/src/importers/sql/`: `index.ts` (re-export ba hàm), `import-sql.ts`, `sql-draft.ts`, `sql-element-locations.ts`, mỗi file kèm test; `import-sql.roundtrip.test.ts`; `fixtures/pg-dump.fixture.ts`, `fixtures/mysqldump.fixture.ts`, `fixtures/ssms-script.fixture.ts`, `fixtures/unsupported-statements.fixture.ts`; tạo `packages/core/src/testing/sql-import-fixtures.ts` (chỉ re-export); sửa `packages/core/src/testing/index.ts`, `packages/core/src/testing/index.test.ts`.

**Chữ ký và hành vi:**

- `importPostgresql`, `importMysql`, `importSqlserver: Importer`, cùng gọi hàm nội bộ `importSql(dialect, source, options)`:
  1. `checkSourceLength`.
  2. `scanSqlStatements`; lỗi thì `syntax-error` tại `toSourceLocation(offset)`.
  3. `classifyStatement` từng câu (kể cả PostgreSQL, MySQL `ALTER TABLE … ADD [COLUMN]` và MySQL `ADD UNIQUE`, là `unsupported` sau Task 11): `view`, `routine`, `trigger`, `sequence`, `unsupported` thành mã tương ứng của Task 2 tại vị trí câu; `data` thành đúng một `data-statements-ignored` tại câu dữ liệu đầu; `ignored` không diagnostic.
  4. `maskStatements` giữ câu `parser`; `parseSqlWithDbmlCore(văn bản đã lọc, dialect)`; lỗi thì trả `Result` lỗi với diagnostic của adapter. Với mỗi câu `parser`, đọc lại bằng Task 11: `readSqlTableDefinition(câu, source)`, `readAddedUniqueConstraint(câu)`, `readSqlIndexDefinition(câu)`.
  5. `buildSqlDraft` (`sql-draft.ts`) dịch `CoreDatabase` sang `ImportDraft` theo spec mục 5 "Namespace, tên, khóa, quan hệ", "Ánh xạ kiểu" (`mapSqlType`, `splitSqlServerIdentity`), "Giá trị mặc định" (`mapSqlDefault`); và thông tin đọc lại ở bước 4 (spec mục 5 "Kết quả probe `@dbml/core` 10.2.0", Vấn đề 20):
     - **MySQL `ENUM(…)` xét trước:** cột có kiểu của parser là enum nội tuyến (`<bảng>_<cột>_enum` có trong `CoreDatabase.enums`) và `rawType` của scanner bắt đầu bằng `ENUM(` (không phân biệt hoa thường) thành `{ kind: "enum", enumName: "<bảng>_<cột>" }`, không gọi `mapSqlType` (hàm đó ánh xạ `ENUM('a','b')` thành `text` kèm `type-not-supported`, đã ghim trong `sql-type-mapping.test.ts`; không sửa).
     - **Kiểu:** cột còn lại tìm được trong `SqlTableDefinition` của bảng (bảng so theo tên đã bỏ schema, tên chính xác trước rồi `toNameKey`; cột cũng vậy) dùng `rawType` của scanner cho `splitSqlServerIdentity` rồi `mapSqlType`, không dùng tên kiểu của parser; cột không tìm được (thêm qua `ALTER TABLE` của SQL Server) dùng tên kiểu của parser.
     - **Thuộc tính cột:** `hasOnUpdate` → `on-update-not-supported` (`["columns", id]`); `hasCollation` → `type-parameter-dropped` (`["columns", id, "type"]`); `isComputed` → giữ cột như cột thường kèm `computed-column-not-supported` (`["columns", id]`), kiểu theo `rawType`, riêng `rawType` rỗng (SQL Server) thì kiểu `text` và không thêm mã nào khác. Mỗi mã một lần cho mỗi cột.
     - **Unique:** đúng các gạch đầu dòng con của spec mục 5 "Unique": index unique của parser ghép với `SqlIndexDefinition` cùng bảng theo tên (`toNameKey`), hoặc theo `columnNames` đúng thứ tự khi không tên, thì là index; không ghép được thì tìm `SqlUniqueConstraint` cùng tập cột trong `CREATE TABLE` hoặc `ALTER TABLE … ADD` của bảng: một cột là `isUnique`, nhiều cột là index unique mang tên ràng buộc; MySQL `isMysqlKey` một cột là `isUnique` khi không tên hoặc tên bằng `buildConstraintName(bảng, [cột], "key")` (`src/generators/shared/constraint-names.ts`), ngược lại là index unique; SQL Server index unique có `whereNotNullColumnNames` là tập con các cột của index thì không có `index-option-dropped`, và nếu một cột cùng tên `buildConstraintName(bảng, [cột], "key")` thì là `isUnique`; quy tắc SQL Server này xét **trước** việc ghép với `CREATE INDEX`. So tên với `buildConstraintName` là so chính xác; tên có hậu tố do `allocateConstraintNames` thêm (`t_c_key_2`) là index của người dùng (hạn chế đã biết, spec mục "Rủi ro").
     - **Tùy chọn index:** `hasDroppedElementOption` (của `SqlIndexDefinition` hoặc `SqlUniqueConstraint`), `hasInclude`, hoặc `hasWhere` ngoài dạng SQL Server ở trên, → giữ index (hoặc `isUnique`) không kèm các tùy chọn đó, `index-option-dropped` (`["indexes", id]`, hoặc `["columns", id, "isUnique"]` khi index thành `isUnique`), mỗi index một lần.
     - **Quan hệ, enum, CHECK:** `oneToOne` khi tập cột khóa ngoại bằng khóa chính, là một cột `isUnique`, hoặc bằng tập cột của một index unique (so theo tên cột trong draft); MySQL `ENUM(…)` thành enum `<bảng>_<cột>`; CHECK qua `readCheckEnumValues` thành enum `<bảng>_<cột>` kèm `check-converted-to-enum`, CHECK khác thành `check-constraint-not-supported`.
  6. Áp thông tin scanner đọc: `readPostgresqlAlterColumn` (identity bật `isAutoIncrement`; default qua `mapSqlDefault`), `readSqlServerDescription` (comment bảng, cột). Câu `postgresqlAlterColumn`, `sqlserverExtendedProperty` mà hàm đọc trả `null`, hoặc trỏ tới bảng, cột không có, thành `statement-not-supported`.
  7. `locateSqlElements(statements)` (`sql-element-locations.ts`) tìm câu `CREATE TABLE` của từng bảng và vị trí tên cột qua `readSqlTableDefinition` (`start` của bảng, của cột; không duyệt token lần thứ hai); không thấy thì dùng vị trí câu chứa phần tử (spec mục 5 "Vị trí của diagnostic theo phần tử").
  8. `assembleDocument(draft, options)`.
- Fixture viết tay theo dạng output thật (spec mục 15 "Fixture"): `pg_dump --schema-only` của PostgreSQL 18 (có `SET`, `SELECT pg_catalog.set_config`, `CREATE SEQUENCE`, `ALTER TABLE ONLY … ADD CONSTRAINT` kể cả `UNIQUE` nhiều cột, `ALTER COLUMN … ADD GENERATED … AS IDENTITY`, `COMMENT ON`, `OWNER TO`, `timestamp with time zone`, `double precision`); `mysqldump --no-data` của MySQL 8.4 (comment `/*!40101 … */`, `DROP TABLE IF EXISTS`, `LOCK TABLES`, `ENGINE=InnoDB`, `UNIQUE KEY`, `KEY`, `int unsigned`, `COLLATE`, `ON UPDATE CURRENT_TIMESTAMP`, `DEFAULT '1'` trên `tinyint(1)`); script "Generate Scripts" của SQL Server Management Studio (`USE`, `GO`, `SET ANSI_NULLS ON`, `[dbo].[t]`, `IDENTITY(1,1)`, `sp_addextendedproperty`, `ALTER TABLE … WITH CHECK ADD CONSTRAINT … FOREIGN KEY`, `ALTER TABLE … CHECK CONSTRAINT`, `ALTER DATABASE … SET`, index `INCLUDE (…)`); và một fixture có view, trigger, function, sequence, domain, policy, `INSERT`. Mỗi fixture có hằng `…_EXPECTED` là tài liệu kỳ vọng (so qua `toComparableSchema`) và danh sách diagnostic kỳ vọng. Fixture SSMS đặt tên cố định: `SSMS_SCRIPT_SOURCE` (chuỗi), `SSMS_SCRIPT_EXPECTED` (tài liệu), `SSMS_SCRIPT_EXPECTED_DIAGNOSTICS` (diagnostic khi chạy với `createImportTestOptions()`, tức id của `createCounterIdGenerator()`).
- `@schemaforge/core/testing` export thêm `SSMS_SCRIPT_SOURCE`, `SSMS_SCRIPT_EXPECTED_DIAGNOSTICS` (qua `src/testing/sql-import-fixtures.ts`) để test UTF-16 LE của Task 24 dùng (SQL Server không chạy trên database thật, xem Vấn đề 2); `testing/index.test.ts` cập nhật danh sách export đã ghim.

**Test viết trước:**

- `sql-element-locations.test.ts`: `locates a column name inside its create table statement`; `falls back to the statement of an alter table column`.
- `sql-draft.test.ts`: `it.each` theo từng gạch đầu dòng của spec mục 5 "Namespace, tên, khóa, quan hệ" (namespace mặc định không diagnostic, namespace khác `namespace-dropped`, nullable, unique một cột, unique nhiều cột, unique index một cột, index không tên, index biểu thức, index loại khác btree, quan hệ `oneToOne`, `oneToMany`, hành động, quan hệ tới bảng không có, comment ba dialect, CHECK `IN`, CHECK khác, MySQL `ENUM`, cột tính toán ba dialect, `ON UPDATE`, `COLLATE`). Thêm: `uses the scanner type text instead of the parser type name` (`it.each`: `timestamp with time zone` → `timestamptz`, `double precision` → `double`, `int unsigned` → `bigint` kèm `type-approximated`); `falls back to the parser type name for a column added by alter table`; `gives a sql server computed column the text type with one diagnostic`; `tells a table-level unique constraint from a unique index`; `reads a mysqldump unique key as a unique column or an index by its name`; `keeps the sql server not-null filter of a unique index without a diagnostic`; `reports index-option-dropped for element options, include and a where clause`; `ignores with options and a filegroup of an ssms index`; `maps a mysql inline enum to the enum named after the table and column before mapSqlType` (`ENUM('a','b')` thành enum `<bảng>_<cột>`, không có `type-not-supported`).
- `import-sql.test.ts`: `reports each unsupported statement kind at its position` (`it.each`); `reports add column on postgresql and mysql and add unique on mysql as statement-not-supported`; `reports data statements once at the first one`; `skips drop and session statements silently`; `keeps parser positions after masking statements`; `reads an identity added through alter table in a pg_dump fixture`; `splits sql server identity from the type and reports identity-options-dropped for other seeds`; `reads sql server descriptions as comments`; `imports the pg_dump fixture`, `imports the mysqldump fixture`, `imports the ssms fixture` (so với `…_EXPECTED`, diagnostic `toStrictEqual` với `createImportTestOptions()`); `reports a syntax error with line and column`; `reports source-too-large`; `reports too-many-elements`; mỗi mã SQL của bảng Task 2 có ít nhất một test kiểm tra `code`, `location`, `path`.
- `import-sql.roundtrip.test.ts`: với `d` trong ba dialect và `S` trong `createSampleSchema()`, `createNamingEdgeSchema()`, `createTargetLimitSchema()`: `generate_d(import_d(generate_d(S)).document)` bằng đúng `generate_d(S)`; danh sách mã diagnostic khớp danh sách kỳ vọng ghi trong test (ví dụ `check-converted-to-enum` với SQL Server) (spec mục 15 "Round-trip").

**Kiểm tra:** như "Quy ước chung" (core). Sau `pnpm --filter @schemaforge/core build`: `grep -rlE "from ['\"]@dbml/core|import\(['\"]@dbml/core" packages/core/dist --include='*.js'` (chỉ tìm câu import, vì `tsc` giữ comment nhắc tới thư viện) chỉ in `packages/core/dist/importers/shared/dbml-core-adapter.js`; `grep -l "dbml-core-adapter" packages/core/dist/index.js packages/core/dist/importers/json/*.js` không in gì.

**Commit:** `feat(core): add sql importer for postgresql, mysql and sql server`

## Task 13: Lexer và parser Prisma

**Mục tiêu:** parser đệ quy xuống tự viết cho tập ngữ pháp schema Prisma mà importer cần, mọi node có vị trí (spec mục 6 "Chọn parser", "Lỗi cú pháp và khối không hỗ trợ").

**Agent:** core-engineer. **Phụ thuộc:** Task 0. **Đợt:** 1.

**File sở hữu (tạo):** `packages/core/src/importers/prisma/prisma-ast.ts` (chỉ type), `prisma-lexer.ts`, `prisma-lexer.test.ts`, `prisma-parser.ts`, `prisma-parser.test.ts`.

**Chữ ký và hành vi:**

```ts
export type PrismaPosition = { readonly line: number; readonly column: number }; // từ 1, cùng quy ước với SourceLocation
export type PrismaValue =
  | { readonly kind: "string"; readonly value: string; readonly position: PrismaPosition }
  | { readonly kind: "number"; readonly text: string; readonly position: PrismaPosition }
  | { readonly kind: "identifier"; readonly name: string; readonly position: PrismaPosition } // gồm true, false
  | { readonly kind: "array"; readonly items: readonly PrismaValue[]; readonly position: PrismaPosition }
  | { readonly kind: "call"; readonly name: string; readonly args: readonly PrismaArgument[]; readonly position: PrismaPosition };
export type PrismaArgument = { readonly name: string | null; readonly value: PrismaValue; readonly position: PrismaPosition };
export type PrismaAttribute = { readonly name: string; readonly args: readonly PrismaArgument[]; readonly position: PrismaPosition }; // tên không có "@", "@@": "id", "map", "db.VarChar"
export type PrismaField = { readonly name: string; readonly typeName: string; readonly isOptional: boolean; readonly isList: boolean;
  readonly unsupportedType: string | null; readonly attributes: readonly PrismaAttribute[]; readonly docComment: string | null; readonly position: PrismaPosition };
export type PrismaEnumValue = { readonly name: string; readonly attributes: readonly PrismaAttribute[]; readonly docComment: string | null; readonly position: PrismaPosition };
export type PrismaProperty = { readonly name: string; readonly value: PrismaValue; readonly position: PrismaPosition };
export type PrismaBlock =
  | { readonly kind: "datasource" | "generator"; readonly name: string; readonly properties: readonly PrismaProperty[]; readonly position: PrismaPosition }
  | { readonly kind: "model" | "view" | "type"; readonly name: string; readonly fields: readonly PrismaField[]; readonly blockAttributes: readonly PrismaAttribute[]; readonly docComment: string | null; readonly position: PrismaPosition }
  | { readonly kind: "enum"; readonly name: string; readonly values: readonly PrismaEnumValue[]; readonly blockAttributes: readonly PrismaAttribute[]; readonly docComment: string | null; readonly position: PrismaPosition };
export type PrismaSchema = { readonly blocks: readonly PrismaBlock[] };
export type PrismaSyntaxError = { readonly position: PrismaPosition };
export function tokenizePrisma(source: string): Result<readonly PrismaToken[], PrismaSyntaxError>;
export function parsePrismaSchema(source: string): Result<PrismaSchema, PrismaSyntaxError>;
```

- Lexer một lượt: định danh, chuỗi `"…"` với escape kiểu JSON, số, ký hiệu `{ } ( ) [ ] , : = ? @ @@ .`, xuống dòng (có ý nghĩa: tách trường), comment `//` (bỏ) và `///` (token doc comment). Cột theo code unit. `PrismaToken` do lexer định nghĩa.
- Parser dừng ở lỗi đầu tiên và trả vị trí token sai, không phục hồi (spec mục 6). Độ sâu lồng của đối số (mảng, lời gọi) tối đa `MAX_PRISMA_NESTING = 32`; vượt thì lỗi cú pháp tại dấu mở ngoặc (chặn tràn ngăn xếp, spec mục 13). Các dòng `///` liền trước khối, trường hoặc giá trị enum ghép bằng `\n` thành `docComment` (bỏ `///` và một dấu cách đầu nếu có). `Unsupported("x")` cho `typeName: "Unsupported"`, `unsupportedType: "x"`. Khối có từ khóa lạ là lỗi cú pháp.

**Test viết trước:**

- `prisma-lexer.test.ts`: `tokenizes identifiers, strings, numbers and symbols with positions`; `keeps triple-slash comments and drops double-slash comments`; `reports an unterminated string at its start`; `counts columns in utf-16 code units`.
- `prisma-parser.test.ts`: `parses a datasource with provider and url`; `parses a generator block`; `parses a model with optional, list and Unsupported fields`; `parses field attributes with positional and named arguments`; `parses block attributes such as @@id, @@unique, @@index and @@map`; `parses native type attributes such as @db.VarChar(255)`; `parses an enum with @map on values`; `parses view and type blocks`; `attaches multi-line doc comments to the next block, field and enum value`; `reports the position of the first unexpected token`; `rejects arguments nested deeper than the limit`; `parses the output of generatePrisma for the sample schema with every provider`.

**Kiểm tra:** như "Quy ước chung" (core).

**Commit:** `feat(core): add prisma schema parser for imports`

## Task 14: Ánh xạ kiểu, giá trị mặc định và quan hệ Prisma

**Mục tiêu:** các bảng ánh xạ của spec mục 6 "Tên, kiểu, thuộc tính" (phần kiểu và giá trị mặc định) và "Quan hệ", viết thành hàm thuần trên AST của Task 13.

**Agent:** core-engineer. **Phụ thuộc:** Task 2, 10, 13. **Đợt:** 3.

**File sở hữu (tạo), kèm test cùng tên:** `packages/core/src/importers/prisma/prisma-type-mapping.ts`, `prisma-relations.ts`.

**Chữ ký và hành vi:**

```ts
export type PrismaFieldMapping = { readonly type: DraftColumnType; readonly isAutoIncrement: boolean; readonly defaultValue: ColumnDefault | null;
  readonly diagnostics: readonly { readonly code: ImportDiagnosticCode; readonly field: "type" | "defaultValue" | null; readonly position: PrismaPosition }[] };
export function mapPrismaScalarField(field: PrismaField, context: { readonly provider: SqlDialect; readonly enumNamesByPrismaName: ReadonlyMap<string, string>;
  readonly enumValuesByPrismaName: ReadonlyMap<string, ReadonlyMap<string, string>> }): PrismaFieldMapping;
export type PrismaRelationsResult = { readonly relations: readonly { readonly relation: DraftRelation; readonly codes: readonly ImportDiagnosticCode[] }[];
  readonly dropped: readonly { readonly code: ImportDiagnosticCode; readonly position: PrismaPosition }[] };
export function buildPrismaRelations(models: readonly PrismaBlock[], context: { readonly provider: SqlDialect;
  readonly tableNameByModel: ReadonlyMap<string, string>; readonly columnNameByField: ReadonlyMap<string, ReadonlyMap<string, string>> }): PrismaRelationsResult;
```

- `mapPrismaScalarField`: đúng bảng kiểu theo `provider` của spec mục 6 (kiểu mặc định khi không có `@db.*`; `@db.*` ngoài bảng thành `custom` tên kiểu native; tham số khác mặc định của model thì bỏ kèm `type-parameter-dropped`; MySQL `String @db.Char(36)` có `@default(uuid())` thành `uuid`; `Unsupported` an toàn (`isSafeCustomTypeName`) thành `custom`, không an toàn thành `text` kèm `type-not-supported`; `T[]` trên `postgresql` thành `custom` `<kiểu native>[]` kèm `scalar-list-as-custom`). Giá trị mặc định đúng bảng của spec mục 6: `autoincrement()` bật `isAutoIncrement`; `now()` → `currentTimestamp`; `uuid()`, `uuid(4)` → `generateUuid`, `uuid(7)` kèm `default-approximated`; `cuid`, `cuid(2)`, `nanoid`, `ulid`, `sequence` bỏ kèm `default-not-supported`; `dbgenerated("…")` qua `mapSqlDefault` với `dialect` là `provider`; chuỗi, số, boolean giữ văn bản gốc; giá trị enum là literal sau `@map`.
- `buildPrismaRelations` theo spec mục 6 "Quan hệ": `@relation(fields, references)` xác định `from` (model chứa trường), `to`, cặp cột theo thứ tự (tên cột sau `@map`); loại theo trường ngược (`Model?` → `oneToOne`, `Model[]` → `oneToMany`), không có trường ngược thì suy theo tính unique của tập cột khóa ngoại (khóa chính, `@unique`, `@@unique`) kèm `back-relation-missing`; hành động `Cascade`, `Restrict`, `NoAction`, `SetNull`, `SetDefault`; thiếu `onDelete` thì `setNull` khi có cột khóa ngoại nullable, ngược lại `restrict` (`noAction` với `sqlserver`); thiếu `onUpdate` thì `cascade` (`noAction` với `sqlserver`); hai phía đều là danh sách, không có `fields` thì bỏ kèm `implicit-many-to-many-not-supported`. Tên quan hệ và tên trường quan hệ không lưu.

**Test viết trước:**

- `prisma-type-mapping.test.ts`: `maps every row of the type table` (`it.each` theo provider); `maps unknown native types to custom`; `drops a precision parameter that differs from the model default`; `maps mysql char(36) with a uuid default to uuid`; `maps safe and unsafe Unsupported types`; `maps scalar lists to custom with scalar-list-as-custom`; `maps every row of the default table` (`it.each`); `reads dbgenerated defaults through the sql default mapping`; `maps an enum default through @map`.
- `prisma-relations.test.ts`: `pairs fields with references in order`; `infers oneToOne from an optional back relation and oneToMany from a list`; `reports back-relation-missing and infers the kind from uniqueness`; `reads explicit referential actions`; `applies prisma default actions per provider` (`it.each`); `drops an implicit many-to-many relation`; `uses mapped column names`.

**Kiểm tra:** như "Quy ước chung" (core).

**Commit:** `feat(core): map prisma fields and relations for imports`

## Task 15: IE-02 importer Prisma

**Mục tiêu:** `importPrisma` theo spec mục 6; round-trip bằng nhau với `postgresql`, điểm bất động với `mysql`, `sqlserver` (spec mục 6 "Round-trip", mục 15 dòng "Prisma"; tiêu chí IE-02).

**Agent:** core-engineer. **Phụ thuộc:** Task 4, 5, 13, 14. **Đợt:** 4.

**File sở hữu (tạo):** trong `packages/core/src/importers/prisma/`: `index.ts` (re-export `importPrisma`), `import-prisma.ts`, `prisma-draft.ts`, mỗi file kèm test; `import-prisma.roundtrip.test.ts`; `fixtures/db-pull.fixture.ts` (dạng output `prisma db pull` cho PostgreSQL và MySQL), `fixtures/prisma-features.fixture.ts` (mọi cấu trúc ở spec mục 6), `fixtures/index.ts` (`PRISMA_IMPORT_FIXTURES: readonly { readonly name: string; readonly source: string }[]` gồm mọi fixture `.prisma` dùng trong test, cho Task 20 chạy `prisma validate`).

**Chữ ký và hành vi:**

- `importPrisma: Importer`: `checkSourceLength`; `parsePrismaSchema`, lỗi thì `syntax-error` tại vị trí; `buildPrismaDraft` rồi `assembleDocument`.
- `buildPrismaDraft(schema: PrismaSchema): ImportDraft` theo spec mục 6: `generator` bỏ qua; `datasource.provider` chọn provider, thiếu `datasource` hoặc provider khác ba giá trị thì `postgresql` kèm `provider-not-supported`; `view` → `view-not-supported`, `type` → `composite-type-not-supported`, cả khối bị bỏ; tên bảng, cột, enum, giá trị enum theo `@@map`, `@map`; trường có kiểu là tên model không thành cột; bảng khóa, unique, index của spec (`@id`, `@@id`, `@unique`, `@@unique`, `@@index` với `map`, không có `map` thì `name: null` để `suggestIndexName` đặt; `sort`, `length`, `type`, `ops`, `clustered` bỏ kèm `index-option-dropped`; `@@ignore`, `@ignore` bỏ qua thuộc tính; `@@schema` → `namespace-dropped`; `@updatedAt` → `updated-at-not-supported`); `///` của model, trường thành comment bảng, cột, `///` của enum và giá trị enum → `comment-dropped`; `?` → `isNullable`.

**Test viết trước:**

- `prisma-draft.test.ts`: `it.each` theo từng dòng của các bảng ở spec mục 6 không thuộc Task 14 (tên qua `@@map`, `@map`; khóa, unique, index; tùy chọn bị bỏ; `@@ignore`; `@@schema`; `@updatedAt`; comment); `defaults to postgresql with provider-not-supported`; `drops view and type blocks with their codes`.
- `import-prisma.test.ts`: `reports a syntax error with line and column`; `imports the db pull fixtures` (so `…_EXPECTED` qua `toComparableSchema`, diagnostic `toStrictEqual`); `imports the feature fixture with the expected diagnostics`; `reports source-too-large`; `reports too-many-elements`; mỗi mã Prisma của bảng Task 2 có ít nhất một test kiểm tra `code`, `location`, `path`.
- `import-prisma.roundtrip.test.ts`: với ba fixture `S`: `toComparableSchema(importPrisma(generatePrisma(S, { provider: "postgresql" }).file.content).document)` bằng `toComparableSchema(S)` và không diagnostic; với `mysql`, `sqlserver`: `generatePrisma(importPrisma(P).document, { provider }).file.content` bằng đúng `P`, với `P = generatePrisma(S, { provider }).file.content`.

**Kiểm tra:** như "Quy ước chung" (core). Sau `build`: `grep -l "dbml" packages/core/dist/importers/prisma/*.js` không in gì (Prisma không kéo `@dbml/core`).

**Commit:** `feat(core): add prisma schema importer`

## Task 16: IE-03 importer DBML

**Mục tiêu:** `importDbml` theo spec mục 7; import output của CG-09 cho schema bằng bản gốc, không diagnostic (spec mục 7 "Round-trip", mục 15 dòng "DBML"; tiêu chí IE-03).

**Agent:** core-engineer. **Phụ thuộc:** Task 4, 5, 8, 10; probe DBML của Task 8 khớp spec mục 7. **Đợt:** 4.

**File sở hữu (tạo):** trong `packages/core/src/importers/dbml/`: `index.ts` (re-export `importDbml`), `import-dbml.ts`, `dbml-type-resolution.ts`, mỗi file kèm test; `import-dbml.roundtrip.test.ts`; `fixtures/dbdiagram.fixture.ts` (file DBML theo dạng dbdiagram.io), `fixtures/dbml-features.fixture.ts`.

**Chữ ký và hành vi:**

- `importDbml: Importer`: `checkSourceLength`; `parseDbmlWithDbmlCore`; dịch `CoreDatabase` sang `ImportDraft` theo bảng ánh xạ của spec mục 7; `assembleDocument`. Tên tài liệu là tên `Project` nếu có.
- `resolveDbmlType(input: { readonly rawType: string; readonly wasQuoted: boolean; readonly enumNameKeys: ReadonlySet<string>; readonly databaseType: SqlDialect }): SqlTypeMapping`: kiểu trong nháy kép là enum nếu trùng tên enum, còn lại `custom` nguyên văn; kiểu không nháy theo thứ tự: đúng tên một kiểu chung như CG-09 ghi (đọc cách ghi trong `src/generators/dbml/generate-dbml.ts`), tên enum, `mapSqlType` theo `databaseType`, còn lại `custom`, hoặc `text` kèm `type-not-supported` nếu tên không an toàn. `Project.database_type` chọn `databaseType` (PostgreSQL, MySQL, SQL Server; giá trị khác hoặc thiếu thì `postgresql`).
- Adapter mất dấu nháy của tên kiểu và độ chính xác của mặc định số (spec mục 7 "Parser"): `import-dbml.ts` đọc lại đoạn nguồn trong `token` của cột để biết kiểu có nháy không và lấy văn bản số. Mặc định biểu thức `` `…` `` qua `mapSqlDefault` với `dialect: "any"`; `null` là không có mặc định.
- Thứ tự đầu mút (probe Task 8, spec mục 7 "Parser"): `ref:` viết trên cột đặt bảng được tham chiếu trước trong `endpoints`, còn `Ref:` độc lập giữ thứ tự trái, phải. `import-dbml.ts` nhận ra `ref:` trên cột khi `token` của ref nằm trong khoảng `token` của một cột, và coi cột đó là bên trái khi áp `>`, `<`, `-`; `Ref:` độc lập lấy `endpoints[0]` là bên trái. `delete:`, `update:` của DBML là chữ thường; `default: null` ra `{ kind: "boolean", text: "null" }` và `mapSqlDefault` cho không có mặc định.
- Ghi chú độc lập thành ghi chú (tên bỏ, không diagnostic); `TableGroup` thành subject area; `Records` → `data-statements-ignored`; `<>` → `many-to-many-not-supported`; `-` là `oneToOne` với bảng bên trái là `from`; `>`, `<` như spec; `comment-dropped`, `color-dropped`, `namespace-dropped`, `check-constraint-not-supported`, `index-type-dropped`, `index-expression-not-supported` đúng các dòng của bảng.

**Test viết trước:**

- `dbml-type-resolution.test.ts` (giữ nguyên danh sách dưới); `import-dbml.test.ts` thêm `keeps the column side of an inline ref on the left` (`it.each`: `ref: >`, `ref: <`, `ref: -`) và `reads a standalone ref left to right`.
- `dbml-type-resolution.test.ts`: `resolves a quoted type to an enum or a verbatim custom type`; `resolves an unquoted generic type name as written by generateDbml` (`it.each` mọi kiểu chung); `resolves an unquoted native type through the sql mapping of the database type`; `falls back to postgresql for an unknown database type`; `maps an unsafe unknown type to text with type-not-supported`.
- `import-dbml.test.ts`: một `it.each` theo từng dòng của bảng ánh xạ ở spec mục 7; `keeps the large numeric default 12345678901234567890.123`; `distinguishes quoted and unquoted types with a generic type name`; `reports syntax errors at their dbml positions`; `imports the dbdiagram fixture`; `reports source-too-large`; `reports too-many-elements`; mỗi mã DBML của bảng Task 2 có ít nhất một test kiểm tra `code`, `location`, `path`.
- `import-dbml.roundtrip.test.ts`: với ba fixture `S`: `toComparableSchema(importDbml(generateDbml(S).file.content).document)` bằng `toComparableSchema(S)` và danh sách diagnostic rỗng.

**Kiểm tra:** như "Quy ước chung" (core).

**Commit:** `feat(core): add dbml importer`

## Task 17: Export ở entry point chính

**Mục tiêu:** entry point chính export hợp đồng import mà frontend dùng (spec mục 1 "Entry point"; tiêu chí "Chung" thứ nhất).

**Agent:** core-engineer. **Phụ thuộc:** Task 2, 3, 6. **Đợt:** 3.

**File sở hữu (sửa):** `packages/core/src/index.ts`, `packages/core/src/index.test.ts`.

**Cài đặt:**

- Thêm giá trị: `IMPORT_FORMATS`, `IMPORT_DIAGNOSTIC_CODES`, `MAX_IMPORT_SOURCE_LENGTH`, `MAX_IMPORTED_ELEMENTS`, `buildImportOperation`, `serializeSchemaDocument`, `finalizeImportDiagnostics` (frontend dùng để ghép diagnostic của importer và của `buildImportOperation` theo đúng thứ tự của core, Task 24). Thêm type: `ImportDiagnostic`, `ImportDiagnosticCode`, `ImportFailure`, `ImportFormat`, `ImportMode`, `ImportOperationBuild` (kiểu trả về của `buildImportOperation`), `ImportOptions`, `ImportResult`, `ImportSuccess`, `Importer`, `LayoutMetrics`, `SourceLocation`. Không export `ImportDraft` hay hàm nào khác của `importers/shared/`.
- `index.test.ts`: cập nhật danh sách giá trị lúc chạy đã ghim (thêm bảy tên).

**Test viết trước:** `exports the import contract and helpers` (trong `index.test.ts`, theo cách test hiện có ghim danh sách export).

**Kiểm tra:** như "Quy ước chung" (core), cộng `pnpm --filter @schemaforge/frontend typecheck`. Sau `build`: `grep -c "@dbml/core\|dbml-core-adapter" packages/core/dist/index.js` in `0`.

**Commit:** `feat(core): export import contract from the core entry point`

## Task 18: Property test cho mọi importer

**Mục tiêu:** không importer nào throw với input bất kỳ; kết quả xác định; diagnostic đã sắp, không lặp; JSON round-trip trên tài liệu bất kỳ (spec mục 15 dòng "Chung cho mọi importer", dòng "JSON" của bảng round-trip; tiêu chí "Chung" thứ hai).

**Agent:** core-engineer. **Phụ thuộc:** Task 7, 12, 15, 16. **Đợt:** 5.

**File sở hữu (tạo):** `packages/core/src/importers/importers.properties.test.ts`.

**Cài đặt:** danh sách sáu importer (`importPostgresql`, `importMysql`, `importSqlserver`, `importPrisma`, `importDbml`, `importJson`), mỗi importer một fixture hợp lệ; `describe.each` theo importer; fast-check với `PROPERTY_SEED`, `PROPERTY_RUNS` (được giảm số lần chạy cho importer SQL nếu một nhóm vượt 30 giây; ghi số lần vào log).

**Test viết trước:** `never throws for a random string`; `never throws for a fixture cut at a random position`; `never throws for a fixture with a random character inserted`; `returns the same result twice for the same source and id generator`; `returns sorted diagnostics without repeats`; `imports a table named __proto__ and one named constructor` (mỗi định dạng một nguồn viết tay); `leaves Object.prototype unchanged for sources with __proto__ keys` (mỗi importer một nguồn dùng `__proto__` làm tên hoặc khóa; với JSON là khóa của map và khóa gốc như test của Task 7; so `Object.getOwnPropertyNames(Object.prototype)` trước và sau); `round-trips any valid document through json byte for byte` (`schemaDocumentArbitrary`: `serializeSchemaDocument(importJson(serializeSchemaDocument(S)).document)` bằng chuỗi gốc và tài liệu `toStrictEqual` `S`).

**Kiểm tra:** như "Quy ước chung" (core); log ghi thời gian chạy của file.

**Commit:** `test(core): add property tests for every importer`

## Task 19: Benchmark import

**Mục tiêu:** đo hai ngưỡng hiệu năng của core ở spec mục 14; phát hiện sớm nếu áp `batch` lớn quá chậm, kể cả ở giới hạn `MAX_IMPORTED_ELEMENTS` (Vấn đề 11); đo scanner SQL và parser `@dbml/core` (chuyển từ Task 8, 9).

**Agent:** core-engineer. **Phụ thuộc:** Task 6, 7, 12, 15, 16. **Đợt:** 5.

**File sở hữu (tạo):** `packages/core/src/importers/importers.bench.ts`, `packages/core/src/importers/sql/sql-parsing.bench.ts` (nằm trong `importers/sql/` vì chỉ ở đó được import adapter theo lint của Task 1), `packages/core/src/operations/build-import-operation.bench.ts`.

**Cài đặt:** `vitest bench` qua script `bench` có sẵn; `*.bench.ts` đã bị loại khỏi build và coverage.

- `importers.bench.ts`: nguồn từ `createLargeSchema({ tableCount: 200 })` qua `generatePostgresql`, `generateMysql`, `generateSqlServer`, `generatePrisma` (`postgresql`), `generateDbml`, `serializeSchemaDocument`; mỗi importer một `bench`. Nguồn JSON thụt lề của khoảng 20 000 phần tử vượt 2 MiB (log Task 7), nên bench JSON ở giới hạn phần tử (nếu có) dùng JSON gọn (`JSON.stringify` không thụt lề); `importJson` không dùng `ImportOptions`.
- `sql-parsing.bench.ts`: `scanSqlStatements` trên nguồn 2 MiB (DDL của `generatePostgresql(createLargeSchema(…))` lặp tới vừa `MAX_IMPORT_SOURCE_LENGTH`); `parseSqlWithDbmlCore` trên DDL 200 bảng của `generatePostgresql` (chuyển từ điểm probe cũ của Task 8).
- `build-import-operation.bench.ts`: `buildImportOperation` chế độ `new` rồi `applyOperation` trên `createEmptySchema`, và chế độ `merge` lên `createSampleSchema()`, với tài liệu 200 bảng. Thêm một cặp bench ở giới hạn: tài liệu `createLargeSchema({ tableCount })` với `tableCount` lớn nhất mà `countDocumentElements` ≤ `MAX_IMPORTED_ELEMENTS` (20 000; tìm `tableCount` trong file bench, ghi số bảng và số phần tử vào log); đo `buildImportOperation` (chạy trong worker) và riêng `applyOperation` của batch đó trên `createEmptySchema` (bước editor phát lại trên luồng chính qua `dispatch`, spec mục 2).

**Kiểm tra:** `pnpm --filter @schemaforge/core bench` thoát mã 0; log ghi bảng trung vị và `p75` từng bench, máy, ngày, so với ngưỡng: SQL ≤ 4 giây; Prisma, DBML, JSON ≤ 1 giây; `buildImportOperation` + `applyOperation` trung vị ≤ 1 giây (tài liệu 200 bảng); scanner 2 MiB và parse 200 bảng chỉ ghi số đo. Bench ở giới hạn 20 000 phần tử không có ngưỡng trong spec: ghi số đo; nếu `applyOperation` trung vị trên 3 giây (gấp ba ngưỡng 1 giây, luồng chính bị chặn lâu) thì nêu rõ trong báo cáo để orchestrator chọn giữa task tối ưu `applyOperation` và hạ `MAX_IMPORTED_ELEMENTS` (đổi giới hạn là đổi spec mục 1, cần người dùng duyệt). Bench trượt ngưỡng thì vẫn báo `done`, ghi rõ chỉ tiêu trượt; orchestrator tạo task tối ưu riêng (spec mục 14), task này không sửa `applyOperation`. Kiểm tra còn lại như "Quy ước chung" (core).

**Commit:** `perf(core): add import benchmarks`

## Task 20: Conformance import

**Mục tiêu:** importer đọc đúng dump thật của PostgreSQL, MySQL và output của `prisma db pull`; fixture Prisma qua `prisma validate` (spec mục 15 "Conformance"; tiêu chí IE-01, IE-02; Vấn đề 2, 12, 15).

**Agent:** core-engineer. **Phụ thuộc:** Task 12, 15. **Đợt:** 5. Cần Docker.

**File sở hữu:** tạo `packages/codegen-conformance/src/support/database-dump.ts`, `src/import-postgresql.test.ts`, `src/import-mysql.test.ts`, `src/import-prisma.test.ts`, `packages/core/src/testing/prisma-import-fixtures.ts`; sửa `packages/core/src/testing/index.ts`, `packages/core/src/testing/index.test.ts`.

**Chữ ký và hành vi:**

- `@schemaforge/core/testing` export `PRISMA_IMPORT_FIXTURES` (re-export qua `src/testing/prisma-import-fixtures.ts` từ `importers/prisma/fixtures/index.ts`); `testing/index.test.ts` cập nhật danh sách export đã ghim.
- `database-dump.ts`: `withPostgresqlDump(ddl: string): Promise<string>` khởi động `PostgreSqlContainer` của `@testcontainers/postgresql` với `POSTGRES_IMAGE`, chạy DDL, chạy `pg_dump --schema-only --no-owner` bằng `container.exec([...])` (có trong `testcontainers` 12.2.0), trả stdout, dừng container trong `finally`; `withMysqlDump(ddl)` tương tự với `MySqlContainer`, `MYSQL_IMAGE` và `mysqldump --no-data`; `pullPrismaSchema(url: string, provider: "postgresql" | "mysql"): Promise<string>` ghi schema tối thiểu chỉ có `datasource db { provider = "<provider>" }` vào thư mục tạm (`withTempDirectory`) rồi chạy `prisma db pull --print --schema <file> --url <url>` (Prisma 7.10.0 đọc URL từ file cấu hình hoặc `--url`, đã kiểm tra bằng `prisma db pull --help` ngày 2026-10-03), trả stdout. Exit code khác 0 thì throw kèm output. `startDatabaseServer` của `containers.ts` không lộ container nên không dùng lại được cho `exec` (Vấn đề 12).
- `import-postgresql.test.ts`, `import-mysql.test.ts`: `describe.each(listConformanceFixtures())`: DDL = `generatePostgresql(S)` (`generateMysql`); dump; `importPostgresql(dump)` (`importMysql`) qua bản build `@schemaforge/core/importers/sql`, rồi sinh lại: bằng đúng DDL ban đầu.
- `import-prisma.test.ts`: trên database PostgreSQL và MySQL đã chạy DDL CG-01 của fixture, `pullPrismaSchema` rồi `importPrisma`, sinh DDL cùng dialect: bằng DDL CG-01 ban đầu sau các chuẩn hóa ghi trong hàm `normalizeIntrospectionDifferences` của file test, mỗi chuẩn hóa một comment nêu khác biệt (spec mục 15, ví dụ comment); và `it.each(PRISMA_IMPORT_FIXTURES)`: `runPrismaValidate(source)` thoát mã 0.
- Dump hay introspection khác kỳ vọng ở điểm importer phải sửa thì dừng với `Bị chặn` và báo; không nới test (spec mục "Rủi ro").

**Kiểm tra:**

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
docker info >/dev/null && echo docker-ok
pnpm --filter @schemaforge/core build
pnpm --filter @schemaforge/codegen-conformance exec vitest run src/import-postgresql.test.ts src/import-mysql.test.ts src/import-prisma.test.ts
pnpm --filter @schemaforge/codegen-conformance typecheck
pnpm --filter @schemaforge/codegen-conformance lint
pnpm --filter @schemaforge/core test
pnpm exec prettier --check <các file sở hữu>
```

Mong đợi: in `docker-ok`; mọi lệnh thoát mã 0. Log ghi số test, thời gian chạy, phiên bản `pg_dump`, `mysqldump`, `prisma`. Lỗi môi trường (Docker, kéo image) thì dừng với `Bị chặn`, ghi lỗi nguyên văn.

**Commit:** `test: add import conformance against real dumps and prisma`

## Task 21: Chuyển `resolveIssueTarget` và `toIssueMessageValues` sang `lib/`

**Mục tiêu:** hộp thoại import dùng chung (ở `components/`) hiện tên phần tử của issue và diagnostic bằng cùng hàm với editor mà không import nội bộ của `features/editor` (spec mục 12 "Bước 3"; Vấn đề 16); bỏ bản sao `toInterpolation` của `toIssueMessageValues`.

**Agent:** frontend-engineer. **Phụ thuộc:** Task 0. **Đợt:** 4.

**File sở hữu:** chuyển (`git mv`) `frontend/src/features/editor/lib/resolve-issue-target.ts` và `resolve-issue-target.test.ts` sang `frontend/src/lib/schema/`; chuyển (`git mv`) `frontend/src/features/editor/components/panels/issue-message-values.ts` sang `frontend/src/lib/schema/issue-message-values.ts`; tạo `frontend/src/lib/schema/issue-message-values.test.ts`; sửa đường import trong `features/editor/components/panels/table-panel/use-field-error-message.ts`, `components/panels/issue-list-tab.tsx`, `components/panels/relation-issue-messages.tsx`, `components/panels/enum-list-tab.tsx`, `hooks/use-go-to-issue.ts`, `lib/issue-index.ts`, `code-generator/generator-diagnostic-list.tsx`.

**Cài đặt:** đổi vị trí và đường import (`@/lib/schema/resolve-issue-target`, `@/lib/schema/issue-message-values`); không đổi code của hai hàm. `relation-issue-messages.tsx`: xóa hàm riêng `toInterpolation` (cùng thân với `toIssueMessageValues`) và gọi `toIssueMessageValues`. Trước khi sửa, chạy `grep -rln "resolve-issue-target\|issue-message-values" frontend/src`; nếu danh sách khác danh sách trên thì sửa theo danh sách thực tế và ghi vào log.

**Test viết trước:** `issue-message-values.test.ts`: `fills every missing interpolation value with an empty string`; `keeps the values the target provides`. `resolve-issue-target.test.ts` và mọi test hiện có (kể cả test của `relation-issue-messages.tsx`) pass nguyên vẹn.

**Kiểm tra:** như "Quy ước chung" (frontend). `grep -rn "features/editor/lib/resolve-issue-target\|panels/issue-message-values\|toInterpolation" frontend/src` không in gì.

**Commit:** `refactor(frontend): move issue message helpers to shared lib`

## Task 22: i18n `importExport`, `importDiagnostics`

**Mục tiêu:** mọi chuỗi giao diện của phần 7 có bản dịch `vi`, `en`, và thiếu bản dịch cho mã diagnostic mới của core thì frontend không biên dịch được (spec mục 12 "i18n"; tiêu chí "Chung" thứ hai và thứ chín).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 17. **Đợt:** 4.

**File sở hữu:** tạo `frontend/src/lib/i18n/locales/en/import-export.ts`, `locales/vi/import-export.ts`, `locales/en/import-diagnostics.ts`, `locales/vi/import-diagnostics.ts`, `frontend/src/lib/i18n/import-export-messages.test.ts`; sửa `frontend/src/lib/i18n/resources.ts` (và `resources.test.ts` nếu test ghim danh sách namespace).

**Cài đặt:**

- Namespace `importDiagnostics` (`enImportDiagnostics`, `viImportDiagnostics`): một key cho mỗi mã của `IMPORT_DIAGNOSTIC_CODES`, `satisfies Record<ImportDiagnosticCode, string>`. Thông báo không chứa tên phần tử (tên hiện ở cột riêng, Task 25), nên không có biến nội suy. Thông báo viết chung cho mọi định dạng có mã đó (bảng mã ở Task 2), ví dụ `index-option-dropped` dùng cho tùy chọn index của Prisma lẫn `DESC`, `WHERE` của SQL, `type-parameter-dropped` cho cả collation của cột SQL. Mã cấu trúc của import JSON dịch bằng namespace `errors` có sẵn (`errors:codes.<mã>`).
- Namespace `importExport` (`enImportExport`, `viImportExport`), đúng cây key sau (giá trị `vi` theo cách viết của spec mục 12; số nhiều theo cách các namespace hiện có dùng `_one`, `_other`):
  - `import`: `open`, `title`, `description`, `defaultSchemaName` ("Schema được import"), `analyzing`, `cancel`, `done` (`{{count}}` bảng, có số nhiều, "Đã import 12 bảng").
  - `import.source`: `fileTab`, `pasteTab`, `chooseFile`, `dropZone`, `selectedFile` (`{{name}}`), `pasteLabel`, `formatLabel`, `dialectLabel`, `dialectPlaceholder`, `modeLabel`, `modeNew`, `modeMerge`, `analyze`.
  - `import.errors`: `fileTooLarge` (`{{maxMegabytes}}`), `encodingUnsupported` ("chỉ hỗ trợ UTF-8 và UTF-16"), `timeout` (ứng với `import-timeout` của spec mục 12), `workerFailed`, `dialectRequired` ("Hãy chọn phương ngữ SQL trước."), `emptySource`, `notApplied`, `previewing` ("Đang xem trước đề xuất của AI. Áp dụng hoặc bỏ đề xuất trước khi import", Vấn đề 19).
  - `import.preview`: `schemaNameLabel`, `schemaNameRequired`, `countsHeading`, `counts.tables`, `counts.columns`, `counts.relations`, `counts.indexes`, `counts.enums`, `counts.subjectAreas`, `counts.notes` (mỗi key có `{{count}}`, số nhiều), `differencesHeading` (`{{count}}`), `issuesHeading` (`{{count}}`), `noDifferences`, `noIssues`, `more` (`{{count}}`, "và N mục khác"), `failedHeading`, `back`, `confirm`, `announceSuccess` (`{{tables}}`, `{{differences}}`, `{{issues}}`), `announceFailure` (`{{count}}`).
  - `location` ("Dòng {{line}}, cột {{column}}").
  - `formats`: `sql`, `prisma`, `dbml`, `json`. `dialects`: `postgresql`, `mysql`, `sqlserver`.
  - `export`: `menu`, `json`, `png`, `svg`, `zip`, `generatingImage` ("Đang tạo ảnh…"), `imageScaledDown` (gợi ý dùng SVG), `failed`.
  - `download`: `file` ("Tải file"), `json` ("Tải JSON"), `failed`.
  - `zip`: `title`, `description`, `groups.schema`, `groups.images`, `groups.sql`, `groups.orm`, `groups.code`, `groups.data`, `groups.docs`, `items.json`, `items.png`, `items.svg`, `items.postgresql`, `items.mysql`, `items.sqlserver`, `items.prisma`, `items.drizzle`, `items.typescript`, `items.zod`, `items.mockApi`, `items.openapi`, `items.seed`, `items.dbml`, `items.markdown`, `prismaProvider`, `drizzleDialect`, `seedFormat`, `selectAll`, `clearAll`, `summary` (`{{files}}`, `{{diagnostics}}`), `issueWarning` (`{{count}}`), `download`, `generating` ("Đang tạo…").
- `resources.ts`: thêm `"importExport"`, `"importDiagnostics"` vào `NAMESPACES` và vào `enResources`, `viResources`.

**Test viết trước** (`import-export-messages.test.ts`, cạnh `code-generator-messages.test.ts`): `translates every import diagnostic code in vi and en`; `has the same import and export keys in vi and en`; `formats the source location in vi and en`. Nếu `resources.test.ts` ghim danh sách namespace: `registers the import and export namespaces`.

**Kiểm tra:** như "Quy ước chung" (frontend).

**Commit:** `feat(frontend): add import and export translations`

## Task 23: Tải file và nút "Tải file" trong code panel

**Mục tiêu:** IE-05: tải output đang hiển thị của code panel với tên file ASCII theo bảng của spec mục 9; một nơi duy nhất tạo object URL (spec mục 9; tiêu chí IE-05).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 1, 22. **Đợt:** 5.

**File sở hữu:** tạo `frontend/src/lib/download/download-blob.ts`, `download-blob.test.ts`, `frontend/src/lib/import-export/to-download-base-name.ts`, `to-download-base-name.test.ts`, `download-file-names.ts`, `download-file-names.test.ts`; sửa `frontend/src/features/editor/code-generator/code-view.tsx`, `code-view.test.tsx`, `code-panel.tsx`, `code-panel.test.tsx`, `frontend/src/features/editor/components/ai-panel/ai-sample-data-card.tsx`, `ai-sample-data-card.test.tsx`, `eslint.config.mjs` (chỉ xóa mục miễn trừ tạm của `ai-sample-data-card.tsx`; ngoại lệ của quy tắc "chỉ Task 1 sửa `eslint.config.mjs`").

**Chữ ký và hành vi:**

- `downloadBlob(blob: Blob, fileName: string, environment?: { readonly document: Document; readonly url: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">; readonly schedule: (callback: () => void, delayMs: number) => void }): void`: tạo `<a>` ẩn (`href` là object URL, `download`, `rel="noopener"`), gắn vào `document.body`, `click()`, gỡ, rồi `revokeObjectURL` sau `OBJECT_URL_REVOKE_DELAY_MS = 10_000` (spec mục 9). Mặc định của `environment` là `document`, `URL`, `setTimeout`.
- `toDownloadBaseName(schemaName: string): string`: đúng quy tắc spec mục 9 (NFD, bỏ dấu U+0300–U+036F, `đ` → `d`, `Đ` → `D`, chữ thường, dãy ký tự ngoài `[a-z0-9]` thành một `-`, bỏ `-` hai đầu, tối đa 60 ký tự rồi bỏ `-` cuối nếu có, rỗng thì `schema`).
- `download-file-names.ts`: `DOWNLOAD_MIME_TYPES` theo spec mục 9; `toGeneratedFileName(baseName: string, request: GeneratorRequest, file: GeneratedFile): string` cho đúng bảng tên file của spec mục 9 (`blog.postgresql.sql`, `blog.mysql.prisma`, `blog.drizzle.postgresql.ts`, `blog.types.ts`, `blog.schemas.ts`, `blog.handlers.ts`, `blog.openapi.json`, `blog.seed.mysql.sql`, `blog.seed.json`, `blog.dbml`, `blog.md`), phần mở rộng lấy từ đuôi của `file.fileName`; `toMimeType(language: OutputLanguage): string`; hằng tên cho JSON, ảnh, ZIP: `toSchemaJsonFileName(base)` (`<base>.schemaforge.json`), `toImageFileName(base, "png" | "svg")`, `toZipFileName(base)`. `GeneratorRequest` lấy từ `features/editor/code-generator/generator-request.ts` qua type `{ target: GeneratorTarget; options: GeneratorOptions[GeneratorTarget] }` khai báo lại trong file này bằng type của core (không import feature).
- `ai-sample-data-card.tsx` (phần 5): Task 1 thêm file này vào block miễn trừ rule cấm `URL.createObjectURL` kèm comment "Temporary", vì hàm `downloadFile` của nó tự gọi `URL.createObjectURL`, `revokeObjectURL` để tải dữ liệu mẫu. Thay `downloadFile` bằng `downloadBlob(new Blob([content]), fileName)`: cùng nội dung, cùng tên file, Blob không thêm kiểu MIME như hiện tại (không đổi hành vi người dùng thấy; object URL được thu hồi theo lịch của `downloadBlob`), rồi xóa file này khỏi block miễn trừ trong `eslint.config.mjs`, chỉ còn `download-blob.ts` được gọi `URL.createObjectURL`.
- `CodeView`: thêm nút "Tải file" (`importExport:download.file`) cạnh "Copy", disable khi đang chờ kết quả cho yêu cầu mới nhất (`CodePanel` truyền trạng thái); bấm thì `downloadBlob(new Blob([file.content], { type: toMimeType(file.language) }), toGeneratedFileName(toDownloadBaseName(document.name), request, file))`. Nội dung là `file.content` nguyên văn.

**Test viết trước:**

- `download-blob.test.ts`: `clicks a hidden link with the file name and object url`; `revokes the object url after ten seconds` (bộ hẹn giờ được truyền vào); `removes the link after the click`.
- `to-download-base-name.test.ts`: `removes vietnamese diacritics and maps đ to d`; `collapses runs of other characters into one dash`; `trims dashes at both ends`; `cuts names longer than sixty characters`; `returns schema for an empty result`.
- `download-file-names.test.ts`: `names every generator output as in the spec table` (`it.each` mọi dòng); `uses the extension of the generated file`; `names json, image and zip files`; `maps each output language to its mime type`.
- `code-view.test.tsx`, `code-panel.test.tsx`: `downloads the shown output with its file name`; `disables the download button while a newer result is pending`.
- `ai-sample-data-card.test.tsx`: test tải hiện có (giả `URL.createObjectURL`, `revokeObjectURL`) viết lại thành `downloads the sample data through downloadBlob with the same file name` (giả module `@/lib/download/download-blob`, kiểm tra nội dung Blob và tên file).

**Kiểm tra:** như "Quy ước chung" (frontend). `pnpm lint` không có lỗi `URL.createObjectURL` (rule của Task 1 cho phép đúng `download-blob.ts`); `grep -n "ai-sample-data-card" eslint.config.mjs` không in gì; `grep -rn "createObjectURL" frontend/src --include=*.tsx --include=*.ts` chỉ in `download-blob.ts` và test.

**Commit:** `feat(frontend): download generated code as a file`

## Task 24: Worker import và client

**Mục tiêu:** parse chạy trong Web Worker tạo khi mở hộp thoại, hủy được, quá 30 giây thì hủy; file đọc đúng mã hóa và giới hạn trước khi đọc; `LayoutMetrics` từ kích thước node (spec mục 2 "Tạo schema mới" bước 1, mục 4, mục 12 "Hộp thoại import" phần "Đọc file", "Dán văn bản", "Worker import", mục 13, mục "Rủi ro" về giấy phép và kích thước bundle; Vấn đề 6, 13).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 7, 12, 15, 16, 17. **Đợt:** 5.

**File sở hữu (tạo), mỗi file `.ts` có logic kèm test:** trong `frontend/src/lib/import-export/`: `import-protocol.ts`, `handle-import-request.ts`, `importer-loaders.ts`, `importer.worker.ts`, `importer-client.ts`, `decode-import-file.ts`, `import-layout.ts`; `frontend/public/third-party-notices.txt`.

**Chữ ký và hành vi:**

- `import-protocol.ts`:

  ```ts
  export type ImportRequest = { readonly requestId: number; readonly format: ImportFormat; readonly source: string;
    readonly fallbackSchemaName: string; readonly layout: LayoutMetrics; readonly mode: ImportMode; readonly target: SchemaDocument | null };
  export type ImportSummary = { readonly tables: number; readonly columns: number; readonly relations: number; readonly indexes: number;
    readonly enums: number; readonly subjectAreas: number; readonly notes: number };
  export type ImportResponse =
    | { readonly requestId: number; readonly kind: "success"; readonly operation: BatchOperation; readonly resultDocument: SchemaDocument;
        readonly summary: ImportSummary; readonly diagnostics: readonly ImportDiagnostic[]; readonly introducedIssues: readonly Issue[] }
    | { readonly requestId: number; readonly kind: "failure"; readonly diagnostics: readonly ImportDiagnostic[] }
    | { readonly requestId: number; readonly kind: "crashed" };
  export function isImportRequest(value: unknown): value is ImportRequest;
  ```

  Ở chế độ `new`, `target` là `null` và worker dựng batch trên `createEmptySchema(imported.name)` (`imported` là tài liệu importer trả về), không dùng `fallbackSchemaName`: tên lấy từ nguồn (`Project` của DBML, `name` của JSON) được giữ ở `resultDocument` và ở giá trị đầu của ô tên (Task 25), và file JSON của IE-06 import lại giống hệt từng byte (IE-04). `summary` đếm phần tử của tài liệu nhập (không gồm phần tử có sẵn của đích).
- `importer-loaders.ts`: một `import()` literal cho mỗi subpath (`@schemaforge/core/importers/sql`, `/prisma`, `/dbml`, `/json`), như `generator-registry.ts`; `loadImporter(format: ImportFormat): Promise<Importer>`.
- `handleImportRequest(request: ImportRequest, dependencies: { readonly loadImporter: typeof loadImporter; readonly generateId: GenerateId }): Promise<ImportResponse>`: chạy importer với `{ fallbackSchemaName, generateId, layout }`; thất bại trả `failure`; thành công gọi `buildImportOperation(đích, document, mode, generateId)`, áp thử bằng `applyOperation`, tính `summary`, `findIntroducedIssues(đích, kết quả)`; ghép diagnostic bằng `finalizeImportDiagnostics([...diagnostic của importer, ...diagnostic của buildImportOperation])` export từ `@schemaforge/core` (Task 17), không tự viết hàm sắp ở frontend. `applyOperation` trả lỗi là lỗi lập trình: trả `crashed` (spec mục 3). Không ghi log nội dung nguồn (spec mục 13).
- `importer.worker.ts`: dòng đầu `import "@/lib/zod-config";`; `onmessage` kiểm tra `isImportRequest`, gọi `handleImportRequest` với `generateId: () => crypto.randomUUID()`, ngoại lệ thành `crashed`.
- `importer-client.ts`: `createImporterClient(options?: { readonly createWorker?: () => Worker; readonly timeoutMs?: number; readonly schedule?: …; readonly cancelSchedule?: … }): { readonly run: (request: Omit<ImportRequest, "requestId">) => Promise<ImportResponse | { readonly kind: "timeout" } | { readonly kind: "cancelled" }>; readonly cancel: () => void; readonly dispose: () => void }`. Worker tạo lười ở lần `run` đầu bằng `new Worker(new URL("./importer.worker.ts", import.meta.url), { type: "module" })`; `IMPORT_TIMEOUT_MS = 30_000`: quá hạn thì `terminate()` và trả `timeout`; `cancel()` thì `terminate()` và promise đang chờ trả `{ kind: "cancelled" }`; lần `run` sau tạo worker mới; phản hồi có `requestId` cũ bị bỏ; `dispose()` hủy worker (gọi khi đóng hộp thoại). `onerror` của worker trả `crashed`.
- `decode-import-file.ts`: `MAX_IMPORT_FILE_BYTES = 2_097_152`; `readImportFile(file: File): Promise<Result<string, "too-large" | "encoding-unsupported">>`: kiểm tra `file.size` trước khi đọc byte; đọc `arrayBuffer()`, nhận BOM UTF-8, UTF-16 LE, UTF-16 BE, giải mã bằng `TextDecoder(…, { fatal: true })` (không BOM thì UTF-8), bỏ BOM; lỗi giải mã là `encoding-unsupported`. `checkPastedSource(text: string): Result<string, "too-large" | "empty">`: rỗng sau `trim` thì `empty`; `text.length > MAX_IMPORT_FILE_BYTES` thì `too-large` ngay, không gọi `TextEncoder` (mỗi code unit UTF-16 cho ít nhất một byte UTF-8, nên văn bản dài như vậy chắc chắn vượt giới hạn byte, và không phải mã hóa cả chuỗi lớn); còn lại so độ dài UTF-8 qua `TextEncoder` với `MAX_IMPORT_FILE_BYTES`. `guessImportFormat(fileName: string): "sql" | "prisma" | "dbml" | "json" | null` theo phần mở rộng.
- `import-layout.ts` (Vấn đề 6): `IMPORT_LAYOUT_METRICS: LayoutMetrics` với `tableWidth: 320` (lớp `max-w-80` của `TableNode`), `headerHeight` và `columnRowHeight` đo trên `pnpm dev` (công cụ dev của trình duyệt, cả hai theme, làm tròn lên số nguyên) và `gap: 80`; comment ghi nguồn của từng số. Đo được giá trị nào lớn hơn giữa hai theme thì lấy giá trị lớn.
- `frontend/public/third-party-notices.txt` (Vấn đề 13): văn bản giấy phép đầy đủ của `@dbml/core`, `@dbml/parse` (Apache-2.0) và các gói được bundle cùng (`antlr4`, `lodash`, `lodash-es`, `luxon`, `parsimmon`, `pluralize`, `pathe`), `fflate`, `modern-screenshot`, chép từ file `LICENSE` trong `node_modules` theo phiên bản của lockfile; đầu file ghi tên, phiên bản, giấy phép từng gói.

**Test viết trước:**

- `import-protocol.test.ts`: `accepts a well-formed import request`; `rejects a request with an unknown format or a missing source`.
- `handle-import-request.test.ts` (loader giả trả importer của core thật cho JSON, DBML và `importSqlserver`): `returns the operation, summary and diagnostics of a new import`; `keeps the source schema name in new mode` (DBML có `Project` tên khác `fallbackSchemaName`: `resultDocument.name` là tên của `Project`); `merges into a target and lists only introduced issues`; `sorts importer and merge diagnostics together` (diagnostic bằng `finalizeImportDiagnostics` của danh sách ghép); `returns failure diagnostics for unreadable source`; `returns crashed when the batch does not apply`; `imports an ssms script saved as utf-16 le with a byte order mark` (thay checklist tay cũ, Vấn đề 2: mã hóa `SSMS_SCRIPT_SOURCE` của `@schemaforge/core/testing` thành byte `FF FE` rồi các code unit UTF-16 LE, tạo `File`, `readImportFile` trả đúng `SSMS_SCRIPT_SOURCE`; `handleImportRequest` với `format: "sqlserver"`, chế độ `new`, `generateId: createCounterIdGenerator()` trả `success` với `diagnostics` `toStrictEqual` `SSMS_SCRIPT_EXPECTED_DIAGNOSTICS` và `resultDocument` `toStrictEqual` kết quả của cùng lời gọi với chuỗi `SSMS_SCRIPT_SOURCE` gốc; tài liệu so với `SSMS_SCRIPT_EXPECTED` đã được Task 12 kiểm tra trong core qua `toComparableSchema`, hàm không export ra frontend theo Vấn đề 18).
- `importer-client.test.ts` (worker giả, bộ hẹn giờ tiêm vào): `creates the worker lazily on the first run`; `terminates the worker and resolves timeout after thirty seconds`; `terminates the worker on cancel and starts a new one on the next run`; `ignores a response for an older request`; `disposes the worker`.
- `decode-import-file.test.ts`: `rejects a file over 2 MiB without reading its bytes`; `decodes utf-8 with and without a byte order mark`; `decodes utf-16 le and be with a byte order mark`; `rejects invalid utf-8`; `rejects pasted text over the byte limit and empty text`; `rejects pasted text longer than the byte limit without encoding it` (`TextEncoder` giả qua `vi.spyOn` không được gọi); `guesses the format from the file extension` (`it.each`).
- `importer.worker.test.ts`: `imports zod-config first` (đọc dòng đầu của file như test của worker sinh code).

**Kiểm tra:** như "Quy ước chung" (frontend). Sau `pnpm --filter @schemaforge/frontend build`: `grep -rl "dbmlv2" frontend/.next/static/chunks` chỉ in chunk mà worker import tải (log ghi tên file và kích thước); log ghi kích thước gzip của chunk đó. `ls frontend/public/third-party-notices.txt` tồn tại.

**Review:** sau khi orchestrator kiểm tra, `ecc:security-reviewer` review riêng task này (chỉ review, không sửa file): giới hạn kích thước trước khi đọc, kiểm tra hình dạng message của worker, không log nội dung nguồn.

**Commit:** `feat(frontend): run importers in a cancellable worker`

## Task 25: Hộp thoại import

**Mục tiêu:** hộp thoại ba bước (nguồn, phân tích, xem trước) dùng chung cho màn hình danh sách và editor, truy cập được bằng bàn phím và không kéo thả (spec mục 12 "Hộp thoại import", mục 3 về hai danh sách xem trước, mục 13 dòng XSS; tiêu chí "Chung" thứ tư, sáu, bảy, chín).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 21, 22, 24. **Đợt:** 6. Hộp thoại không đọc store editor nên không phụ thuộc AI-22; nó nhận cờ chặn qua prop (Vấn đề 19).

**File sở hữu (tạo), mỗi component kèm `.test.tsx`:** trong `frontend/src/components/import-dialog/`: `import-dialog.tsx`, `import-source-step.tsx`, `import-preview-step.tsx`, `import-diagnostic-list.tsx`, `source-excerpt.tsx`, `use-import-dialog.ts` (+ `use-import-dialog.test.tsx`), `to-source-excerpt.ts` (+ test). Sửa `frontend/src/lib/import-export/importer-client.ts` và test (thêm `prepare`, `dispose` bền) và `frontend/src/testing/fake-importer-client.tsx` (tạo; client giả cho test hộp thoại và hai nút Import).

**Chữ ký và hành vi:**

```ts
export type ImportConfirmation =
  | { readonly mode: "new"; readonly schemaName: string; readonly operation: BatchOperation }
  | { readonly mode: "merge"; readonly operation: BatchOperation; readonly target: SchemaDocument; readonly summary: ImportSummary };
type ImportDialogProps = {
  readonly isOpen: boolean; readonly onOpenChange: (isOpen: boolean) => void;
  readonly mergeTarget: { readonly document: SchemaDocument; readonly origin: Position } | null; // null: chỉ chế độ tạo mới (màn hình danh sách)
  readonly onConfirm: (confirmation: ImportConfirmation) => void;
  readonly onReturnFocus: () => void; // bắt buộc, như Create/Rename/DeleteSchemaDialog: nơi mở lấy lại focus khi hộp thoại đóng
  readonly rememberedSqlDialect: SqlDialect | null; readonly onSqlDialectChange: (dialect: SqlDialect) => void;
  readonly isBlocked?: boolean; // mặc định false; true khi editor đang xem trước đề xuất AI (Vấn đề 19)
  readonly createClient?: () => ImporterClient; // tiêm ở test
};
```

- `isBlocked`: khi `true`, hộp thoại không mở (`open={isOpen && !isBlocked}`) và nếu đang mở thì đóng ngay; client bị `dispose()` như khi đóng, nên vùng thả file, ô dán, nút chọn file, "Phân tích" và "Import" không còn dùng được và `onConfirm` không bao giờ được gọi. Hộp thoại không tự đọc `selectIsPreviewing`: nơi gọi trong editor (Task 28) truyền `isBlocked={isPreviewing}`; màn hình danh sách không có store editor nên không truyền (Task 26).
- Dialog của shadcn/ui (`components/ui/dialog.tsx`), tiêu đề và mô tả qua `importExport`. Client tạo khi mở và gọi `prepare()` ngay để worker sẵn sàng trước lần "Phân tích" đầu (`ImporterClient` của Task 24 chưa có `prepare`; Task 25 thêm `prepare: () => void` vào `importer-client.ts` và test của nó: tạo worker nếu chưa có, lỗi tạo thì bỏ qua để `run` báo lại; sau `dispose()` thì `prepare` và `run` không tạo worker, `run` trả `{ kind: "cancelled" }`), `dispose()` khi đóng (spec mục 12 "Worker import").
- `onReturnFocus` (bắt buộc): gọi mỗi khi hộp thoại đóng (hủy, "Import" xong, Escape, `isBlocked`) để nơi mở lấy lại focus; mở bằng state ngoài nên `DialogTrigger` không tự trả focus (spec mục 12 "Đóng hộp thoại"). Task 26 (`ImportSchemaButton`) và Task 28 (`EditorImportButton`) đều phải truyền.
- Bước 1: `Tabs` "Chọn file" và "Dán văn bản"; nút chọn file (`<input type="file" accept=".sql,.prisma,.dbml,.json">` gắn nhãn, dùng được bằng bàn phím) và vùng thả file (thả là đường phụ; WCAG 2.5.7); `Select` định dạng (tự chọn theo `guessImportFormat`, đổi được); SQL cần `Select` dialect chưa chọn sẵn. Nút "Phân tích" luôn bật (một nút disabled không cho công nghệ hỗ trợ lý do): bấm khi định dạng là SQL mà chưa chọn dialect thì hiện lỗi `importExport:import.errors.dialectRequired` (`role="alert"`), gắn vào `Select` dialect bằng `aria-invalid` và `aria-describedby`, focus chuyển tới `Select` dialect, không gửi gì sang worker. Dialect khởi tạo từ prop `rememberedSqlDialect` và mỗi lần chọn gọi `onSqlDialectChange` (nơi gọi nối với `usePendingImport` của Task 26, Vấn đề 14). Chế độ (`RadioGroup`) chỉ hiện khi `mergeTarget !== null`, mặc định "Tạo schema mới". Lỗi đọc file (`too-large`, `encoding-unsupported`, `empty`) hiện ngay dưới trường, liên kết `aria-describedby`, không gửi sang worker. Các kiểm tra không cần worker (ô dán rỗng hoặc quá dài, chưa chọn file, thiếu dialect) chạy đồng bộ khi bấm "Phân tích", trước khi vào trạng thái `analyzing`. File đọc lỗi (`File.arrayBuffer()` ném, ví dụ `NotReadableError`) về bước 1 với lỗi `workerFailed`.
- Bước 2: trạng thái đang phân tích (`aria-busy`) và nút "Hủy" (`client.cancel()`, về bước 1). `timeout` thì về bước 1 và hiện `importExport:import.errors.timeout`; `crashed` hiện `workerFailed`.
- Bước 3 thất bại: danh sách lỗi (`ImportDiagnosticList`): thông báo `importDiagnostics:<mã>` hoặc `errors:codes.<mã>` cho mã cấu trúc, `importExport:location` khi có vị trí, `SourceExcerpt`; chỉ có nút "Quay lại"; focus chuyển tới lỗi đầu tiên.
- Bước 3 thành công: ô tên schema (chế độ tạo mới; bắt buộc, không rỗng sau `trim`; giá trị đầu là `resultDocument.name`); số lượng bảy loại phần tử; "Khác với nguồn" (diagnostic, kèm tên phần tử từ `resolveIssueTarget(resultDocument, path)` khi `path` khác `null`, vị trí, trích đoạn); "Vấn đề cần sửa sau khi import" (`issues:<mã>` với giá trị từ `resolveIssueTarget` như danh sách issue của editor); mỗi danh sách tối đa 200 dòng đầu kèm `more`; nút "Quay lại" và "Import". Vùng `aria-live="polite"` thông báo `announceSuccess` hoặc `announceFailure`.
- `toSourceExcerpt(source: string, location: SourceLocation): { readonly line: string; readonly markColumn: number }`: lấy dòng `location.line`, cắt tối đa 200 ký tự quanh cột, ký tự điều khiển thay bằng U+FFFD, `markColumn` (từ 1) là cột lỗi theo dòng sau khi cắt. `SourceExcerpt` hiện dòng trong `<pre>` dạng text, xuống dòng khi dài (`white-space: pre-wrap`, `overflow-wrap: anywhere`, không cuộn ngang) và bọc đúng ký tự ở `markColumn` trong `<mark>` (nền và gạch chân bằng token theme; cột nằm sau cuối dòng thì `<mark>` bọc một khoảng trắng). Không có dòng `^` dưới cột lỗi: nó lệch khi dòng xuống dòng. Vị trí cho công nghệ hỗ trợ là chữ "Dòng X, cột Y" của `importExport:location` trong cùng dòng lỗi (spec mục 12 "Cách hiện trích đoạn").
- Mọi giá trị từ file hiện dạng text React; không `dangerouslySetInnerHTML` (spec mục 13).
- "Import": gọi `onConfirm` rồi đóng hộp thoại. Logic chuyển bước nằm trong `use-import-dialog.ts` (state machine `source` → `analyzing` → `preview` | `failed`).

**Test viết trước:**

- `to-source-excerpt.test.ts`: `returns the line of the location with the mark column`; `cuts a long line to 200 characters around the column`; `replaces control characters with the replacement character`.
- `use-import-dialog.test.tsx`: `moves from source to analyzing to preview`; `returns to source on cancel and terminates the worker`; `shows the timeout message after a timeout`.
- `import-dialog.test.tsx` (client giả): `picks the format from the file extension`; `keeps the analyze button enabled and reports a missing dialect` (SQL chưa chọn dialect: bấm "Phân tích" không gọi `run`, hiện `role="alert"` `dialectRequired` gắn vào ô dialect bằng `aria-invalid` và `aria-describedby`, focus ở ô dialect); `returns to the source step with workerFailed when the file cannot be read` (`arrayBuffer` ném `NotReadableError`); `checks an empty paste before entering the analyzing state`; `marks the error column of the excerpt with mark and has no caret line`; `calls onReturnFocus when the dialog closes`; `prepares the worker when the dialog opens`; `rejects a file over the limit without analyzing`; `shows translated errors with line, column and excerpt and no import button`; `moves focus to the first error`; `shows counts, differences and introduced issues in the preview`; `limits each list to 200 rows with a count of the rest`; `requires a non-empty schema name in new mode`; `offers the merge mode only with a merge target`; `confirms a new import with the edited name`; `announces the analysis result politely`; `disables import during an AI proposal preview` (`isBlocked`: hộp thoại đang mở thì đóng, client bị dispose, không có vùng thả file, `onConfirm` không được gọi); `renders a script-like table name as text`; `has no axe violations in each step in light and dark themes` (`expectNoAxeViolations`).

**Kiểm tra:** như "Quy ước chung" (frontend). Log ghi kiểm tra tay trên `pnpm dev`: chọn file bằng bàn phím, thả file, hủy khi đang phân tích.

**Commit:** `feat(frontend): add import dialog with preview`

## Task 26: Tạo schema mới từ import

**Mục tiêu:** chế độ tạo mới (spec mục 2 "Tạo schema mới"): bản ghi mới qua đường "Tạo" (có chủ khi đăng nhập), import đang chờ trong state React ở gốc, editor dispatch đúng một lần khi mount; nút Import ở màn hình danh sách (spec mục 12 "Điểm vào"; tiêu chí "Chung" thứ năm).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 25, AI-22 (Task 22 của plan phần 5, `selectIsPreviewing`). **Đợt:** 7.

**File sở hữu:** tạo `frontend/src/components/pending-import-provider.tsx` (+ test), `frontend/src/components/import-dialog/use-create-imported-schema.ts` (+ test), `frontend/src/features/editor/hooks/use-apply-pending-import.ts` (+ test), `frontend/src/features/schema-list/components/import-schema-button.tsx` (+ test), `frontend/src/features/schema-list/import-journey.test.tsx`; sửa `frontend/src/components/app-providers.tsx` (+ test nếu có), `frontend/src/features/editor/components/editor-workspace.tsx` và test, `frontend/src/features/schema-list/components/schema-list-screen.tsx` và test.

**Chữ ký và hành vi:**

- `PendingImportProvider` (không biến cấp module; spec mục 2 "Lý do"): mục chờ `{ schemaId: string; operation: BatchOperation } | null` nằm trong `useRef` của chính provider (mỗi instance một ref), không trong `useState`: `takePendingImport` đọc và xóa ngay trên ref, nên lần chạy effect thứ hai của StrictMode thấy `null` thay vì giá trị state cũ chưa render lại; mục chờ không hiện trên giao diện nên không cần render lại. `lastSqlDialect: SqlDialect | null` giữ bằng `useState` (Vấn đề 14). Các hàm trả về ổn định (`useCallback`, giá trị context qua `useMemo`). `usePendingImport(): { readonly setPendingImport: (pending) => void; readonly takePendingImport: (schemaId: string) => BatchOperation | null; readonly lastSqlDialect: SqlDialect | null; readonly setLastSqlDialect: (dialect: SqlDialect) => void }`; `takePendingImport` trả và xóa mục chờ khi `schemaId` khớp, ngược lại `null` (không xóa). Thêm vào `AppProviders` bên trong `StorageProvider`, ngoài `AuthProvider` không bắt buộc (đặt cạnh `SignInPromptProvider`).
- `useCreateImportedSchema(): (confirmation: Extract<ImportConfirmation, { mode: "new" }>) => Promise<void>`: `repository.createSchema(schemaName, userId === null ? undefined : { ownerId: userId })` (cùng đường với `createSchema` của `use-schema-actions.ts`, spec phần 4 mục 7), `setPendingImport({ schemaId: record.id, operation })`, `router.push(\`/schemas/${record.id}\`)`. Lỗi lưu trữ báo bằng `notify` với key `storage:` theo `toStorageErrorCode` như `use-schema-actions.ts`; không ghi tên schema vào log.
- `useApplyPendingImport(store)`: gọi trong `EditorWorkspace` sau khi tạo store; trong effect chạy một lần cho mỗi `schemaId`: nếu `selectIsPreviewing(store.getState())` (từ `create-editor-store.ts`, AI-22) thì return trước khi lấy mục chờ, để mục chờ không mất và không có `dispatch` nào bị nuốt (store vừa tạo không có đề xuất đang xem trước, nên nhánh này chỉ là phòng thủ); rồi `takePendingImport(schemaId)`; có operation thì `store.getState().dispatch(operation)` (lỗi do store báo như mọi operation). Mục lịch sử và autosave đi theo đường `dispatch` có sẵn. Chạy lại effect (StrictMode) không dispatch lần hai vì mục chờ đã bị lấy.
- `ImportSchemaButton` (màn hình danh sách, header, cạnh "Tạo schema"; màn hình này không có store editor nên không có xem trước AI và không cần chặn): giữ ref của nút và truyền `onReturnFocus` cho `ImportDialog` (Task 25, prop bắt buộc; focus về nút này khi hộp thoại đóng, cùng cách `CreateSchemaDialog` ở màn hình này); mở `ImportDialog` với `mergeTarget={null}`, `rememberedSqlDialect`, `onSqlDialectChange` từ `usePendingImport`, `onConfirm` gọi `useCreateImportedSchema`.

**Test viết trước:**

- `pending-import-provider.test.tsx`: `takes the pending import once for its schema`; `keeps the pending import for another schema`; `keeps pending imports apart for two provider instances`; `remembers the last sql dialect until unmount`.
- `use-create-imported-schema.test.tsx`: `creates a local schema and navigates when signed out`; `creates an owned pending schema when signed in`; `stores the pending import before navigating`; `notifies a storage error and does not navigate`.
- `use-apply-pending-import.test.tsx`: `dispatches the pending operation once`; `dispatches once under StrictMode` (render trong `<StrictMode>`, effect chạy hai lần, `dispatch` giả được gọi đúng một lần); `does nothing without a pending import`; `disables import during an AI proposal preview` (store giả đang xem trước đề xuất: không dispatch và không lấy mục chờ).
- `import-schema-button.test.tsx`: `opens the import dialog in new-only mode`; `returns focus to the import button when the dialog closes`.
- `import-journey.test.tsx` (`fake-indexeddb`, worker giả chạy `handleImportRequest` đồng bộ với importer thật): `imports dbml from the schema list into a new schema with one undo step back to an empty schema` (bản ghi mới, editor mở đủ bảng, một lần undo cho schema rỗng, mount lại thấy tài liệu đã lưu); `keeps the list unchanged for an unreadable json file` (không có bản ghi mới).

**Kiểm tra:** như "Quy ước chung" (frontend).

**Review:** sau khi orchestrator kiểm tra, `ecc:react-reviewer` review riêng task này (chỉ review, không sửa file): ref và effect của import đang chờ, StrictMode, giá trị context ổn định.

**Commit:** `feat(frontend): import a file into a new schema`

## Task 27: "Tải JSON" ở màn hình danh sách

**Mục tiêu:** sao lưu một schema local mà không mở editor (spec mục 12 "Điểm vào", dòng "menu của từng dòng"; tiêu chí IE-06; Vấn đề 8).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 22, 23. **Đợt:** 6.

**File sở hữu:** tạo `frontend/src/features/schema-list/hooks/use-download-schema-json.ts` (+ test); sửa `frontend/src/features/schema-list/components/schema-list-row.tsx`, `schema-list-row.test.tsx`.

**Chữ ký và hành vi:** `useDownloadSchemaJson(): (schemaId: string) => Promise<void>`: `repository.openSchema(schemaId)`; `opened` thì `downloadBlob(new Blob([serializeSchemaDocument(document)], { type: "application/json" }), toSchemaJsonFileName(toDownloadBaseName(document.name)))`; `not-found` hoặc `unreadable` hoặc lỗi lưu trữ thì `notify` lỗi (`importExport:download.failed` hoặc key `storage:`). Mục "Tải JSON" có trong menu của dòng có bản local (`guest`, `cached`); không có ở dòng "Schema không đọc được" và dòng `cloud-only` (Vấn đề 8).

**Test viết trước:** `downloads the serialized document with its json file name`; `notifies when the schema cannot be read`; `shows the download item for local and cached rows`; `hides the download item for unreadable and cloud-only rows`.

**Kiểm tra:** như "Quy ước chung" (frontend).

**Commit:** `feat(frontend): download a schema as json from the list`

## Task 29: Chụp ảnh canvas

**Mục tiêu:** IE-07: ảnh PNG, SVG chứa mọi node, không bị cắt, có marker, theo theme đang hiển thị (spec mục 10; Vấn đề 5); lệnh lấy node đã đo và fit quanh node mới cho Task 28, 30, 31 mà không gọi `useReactFlow()` ngoài canvas.

**Agent:** frontend-engineer. **Phụ thuộc:** Task 1. **Đợt:** 3.

**File sở hữu:** tạo `frontend/src/features/editor/import-export/compute-image-frame.ts` (+ test), `capture-canvas-image.ts` (+ test), `frontend/src/features/editor/components/canvas/editor-flow-provider.test.tsx`; sửa `frontend/src/features/editor/components/canvas/editor-canvas.tsx` và `editor-canvas.test.tsx`, `frontend/src/features/editor/lib/viewport-controls.tsx` và `viewport-controls.test.tsx`, `frontend/src/features/editor/components/canvas/editor-flow-provider.tsx`, `frontend/src/app/globals.css` (và `app/globals.test.ts` nếu test ghim lớp CSS).

**Chữ ký và hành vi:**

- `editor-canvas.tsx`: `<RelationMarkers />` chuyển vào `<ViewportPortal>` bên trong `<ReactFlow>` để `<defs>` nằm trong `.react-flow__viewport` (spec mục 10, Vấn đề 5); wrapper của canvas có `data-export-root` để `captureCanvasImage` tìm. Minimap, `Background`, nút điều khiển viewport có `data-export-exclude`.
- `globals.css`: `[data-exporting="true"]` ẩn handle, huy hiệu issue, vòng chọn và vòng focus của node, edge (selector theo lớp của React Flow và thuộc tính hiện có của `TableNode`, không thêm lớp mới vào component khác).
- `computeImageFrame(input: { readonly bounds: Rect; readonly hasSelfRelation: boolean; readonly format: "png" | "svg" }): { readonly width: number; readonly height: number; readonly translateX: number; readonly translateY: number; readonly pixelRatio: number; readonly isScaledDown: boolean }`: lề `IMAGE_PADDING = 40`; nới cạnh phải `SELF_RELATION_LOOP_WIDTH` (lấy bằng bề rộng vòng cong của edge tự tham chiếu trong `relation-edge.tsx`, ghi nguồn trong comment) khi có quan hệ tự tham chiếu; PNG `pixelRatio = min(2, sqrt(MAX_PNG_PIXELS / (w × h)), MAX_PNG_SIDE / max(w, h))` với `MAX_PNG_PIXELS = 16_777_216`, `MAX_PNG_SIDE = 16_384`, `isScaledDown` khi `< 1`; SVG `pixelRatio = 1`. `Rect` là type của `@xyflow/react`.
- `viewport-controls.tsx` thêm, cạnh `ViewportControls` (type riêng và context riêng để hơn mười test hiện có dựng `ViewportControls` giả, như `left-panel.test.tsx`, `code-panel.test.tsx`, không phải đổi):

  ```ts
  export type CanvasNodeControls = {
    readonly getMeasuredNodes: () => readonly Node[]; // `Node` của @xyflow/react, import type; chỉ node đã có `measured.width` và `measured.height`
    readonly fitNodes: (ids: readonly string[]) => void; // fit quanh các node này khi chúng đã được đo
  };
  export function CanvasNodeControlsProvider(props: { readonly controls: CanvasNodeControls; readonly children: ReactNode }): JSX.Element;
  export function useCanvasNodeControls(): CanvasNodeControls; // ngoài provider thì throw như useViewportControls
  ```

- `editor-flow-provider.tsx`: `FlowViewportControls` cung cấp thêm `CanvasNodeControlsProvider` dựng từ `useReactFlow()`. `getMeasuredNodes()` trả `flow.getNodes()` lọc node đã đo (canvas không bật `onlyRenderVisibleElements` nên mọi node đều được render và đo). `fitNodes(ids)` lưu danh sách chờ trong state (lần gọi sau thay danh sách cũ); một effect phụ thuộc danh sách chờ và `useNodesInitialized()` của `@xyflow/react` chỉ gọi `flow.fitView({ nodes: ids.map((id) => ({ id })), padding: FIT_VIEW_PADDING, duration: getTransitionDuration() })` khi mọi id trong danh sách có trong `flow.getNodes()` với kích thước đã đo, rồi xóa danh sách. Như vậy `fitNodes` gọi ngay sau `dispatch` vẫn fit đúng khung dù node mới chưa được render hay đo.
- `captureCanvasImage(input: { readonly root: HTMLElement; readonly nodes: readonly Node[]; readonly hasSelfRelation: boolean; readonly format: "png" | "svg"; readonly capture?: { readonly domToBlob: typeof domToBlob; readonly domToForeignObjectSvg: typeof domToForeignObjectSvg } }): Promise<{ readonly blob: Blob; readonly isScaledDown: boolean }>`: `nodes` là kết quả của `getMeasuredNodes()`; khung bao bằng `getNodesBounds(nodes)` (mọi node, kích thước đã đo); đặt `data-exporting="true"` trên `root` trong lúc chụp và gỡ trong `finally`; chụp `.react-flow__viewport` bằng `modern-screenshot`: PNG bằng `domToBlob` với `type: "image/png"`; SVG bằng `domToForeignObjectSvg` (trả `SVGElement`), rồi `new XMLSerializer().serializeToString(svg)` và `new Blob([text], { type: "image/svg+xml" })` (không dùng `domToSvg`, hàm đó trả data URL của SVG bọc ảnh PNG, xem mục "Phiên bản"); cả hai với `width`, `height`, `scale: pixelRatio`, `backgroundColor` là giá trị đã tính của `--background`, `style: { transform: \`translate(${translateX}px, ${translateY}px) scale(1)\` }`, `filter` bỏ phần tử có `data-export-exclude`; không truyền `workerUrl` (spec mục 10). Viewport của người dùng không đổi.

**Test viết trước:**

- `compute-image-frame.test.ts`: `adds forty pixels of padding on every side`; `widens the right edge for a self relation`; `uses a pixel ratio of two for a small png`; `scales a png down to the pixel area limit` (`isScaledDown`); `scales a png down to the side limit`; `keeps svg at ratio one without limits`.
- `capture-canvas-image.test.ts` (hàm chụp giả): `captures the viewport with the computed frame and background`; `marks the root as exporting during capture and clears it after a failure`; `filters out excluded elements`; `does not pass a worker url`; `serializes the foreign object svg into an svg blob` (`domToForeignObjectSvg` giả trả một `SVGElement` dựng bằng `document.createElementNS` có con `foreignObject`; `blob.type` là `image/svg+xml`, `await blob.text()` bắt đầu bằng `<svg` và chứa `foreignObject`).
- `editor-canvas.test.tsx`: `renders the relation marker definitions inside the react flow viewport`.
- `viewport-controls.test.tsx`: `throws when canvas node controls are used outside their provider`.
- `editor-flow-provider.test.tsx` (`vi.mock("@xyflow/react")` với `useReactFlow`, `useNodesInitialized` giả như `editor-workspace.test.tsx`): `returns only measured nodes`; `fits the given nodes once every one of them is measured` (lần render đầu node chưa đo: `fitView` chưa được gọi; render lại khi đã đo: gọi đúng một lần với các id và `FIT_VIEW_PADDING`); `replaces the pending nodes on a second call`.

**Kiểm tra:** như "Quy ước chung" (frontend). Kiểm tra tay hiển thị trên ba trình duyệt nằm ở Task 32.

**Commit:** `feat(frontend): capture the whole canvas as png or svg`

## Task 30: Menu Export trên toolbar

**Mục tiêu:** menu "Export" với JSON, PNG, SVG và mục "ZIP…" (spec mục 12 "Điểm vào"; mục 8 "Export"; mục 10 "Chi tiết khi chụp"; tiêu chí IE-06, IE-07).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 22, 23, 29. **Đợt:** 6.

**File sở hữu:** tạo `frontend/src/features/editor/import-export/export-menu.tsx` (+ test), `use-export-actions.ts` (+ test); sửa `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`, `editor-toolbar.test.tsx`.

**Chữ ký và hành vi:**

- `ExportMenu`: nút có icon kèm nhãn `importExport:export.menu` mở `DropdownMenu`: "JSON", "Ảnh PNG", "Ảnh SVG", đường phân cách, "ZIP…". Đặt trên toolbar sau nhóm thêm bảng và enum (spec mục 12), theo quy ước nút của toolbar hiện có. Task 30 render mục "ZIP…" ở trạng thái disabled; Task 31 bật mục này và mở hộp thoại ZIP.
- `useExportActions()`: `exportJson()` tải `serializeSchemaDocument(document)` với `toSchemaJsonFileName`; `exportImage(format)` gọi `captureCanvasImage` với `root` là phần tử `data-export-root`, `nodes` từ `useCanvasNodeControls().getMeasuredNodes()` (Task 29; không gọi `useReactFlow()` trực tiếp), `hasSelfRelation` từ tài liệu; trong lúc chụp mục menu hiện `generatingImage` và bị disable; `isScaledDown` thì `notify` `imageScaledDown`; lỗi thì `notify` `export.failed` (không log nội dung).

**Test viết trước:** `export-menu.test.tsx`: `lists json, png, svg and zip items`; `downloads the serialized document as json`; `shows a busy item and blocks a second capture while generating`; `suggests svg when the png was scaled down`; `notifies when the capture fails`. `editor-toolbar.test.tsx`: `shows the export menu after the add buttons` (bọc thêm `CanvasNodeControlsProvider` với lệnh giả).

**Kiểm tra:** như "Quy ước chung" (frontend).

**Commit:** `feat(frontend): add export menu for json and images`

## Task 31: Tải ZIP

**Mục tiêu:** IE-08: hộp thoại chọn nhiều định dạng, ZIP tạo bằng `zipSync` trong worker sinh code, xác định từng byte (spec mục 11; tiêu chí IE-08; Vấn đề 9).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 30. **Đợt:** 7.

**File sở hữu:** tạo `frontend/src/features/editor/code-generator/build-zip.ts` (+ test), `handle-zip-request.ts` (+ test), `use-build-zip.ts` (+ test), `frontend/src/features/editor/import-export/zip-dialog.tsx` (+ test), `zip-selection.ts` (+ test); sửa `frontend/src/features/editor/code-generator/worker-protocol.ts`, `worker-protocol.test.ts`, `code-generator.worker.ts`, `code-generator.worker.test.ts`, `frontend/src/features/editor/state/create-editor-store.ts`, `create-editor-store.test.ts`, `frontend/src/features/editor/import-export/export-menu.tsx`, `export-menu.test.tsx`.

**Chữ ký và hành vi:**

- `zip-selection.ts`: `ZipSelection = { readonly json: boolean; readonly png: boolean; readonly svg: boolean; readonly sql: readonly SqlDialect[]; readonly prisma: SqlDialect | null; readonly drizzle: DrizzleDialect | null; readonly typescript: boolean; readonly zod: boolean; readonly mockApi: boolean; readonly openapi: boolean; readonly seed: SqlDialect | "json" | null; readonly dbml: boolean; readonly markdown: boolean }`; `DEFAULT_ZIP_SELECTION` chỉ chọn `json` (spec mục 11); `selectAllZip`, `clearZip`; `toZipGeneratorRequests(selection, codeOptions, markdownLabels): readonly GeneratorRequest[]` (seed lấy `rowsPerTable`, `seed` từ `codeOptions` của store); `countZipFiles(selection): number`.
- Store: `zipSelection: ZipSelection` (mặc định `DEFAULT_ZIP_SELECTION`), `setZipSelection`; không lưu khi tải lại trang.
- `worker-protocol.ts`: thêm `BuildZipRequest = { readonly kind: "build-zip"; readonly requestId: number; readonly document: SchemaDocument; readonly baseName: string; readonly generators: readonly GeneratorRequest[]; readonly includeJson: boolean; readonly images: readonly { readonly fileName: string; readonly bytes: Uint8Array }[] }`, `isBuildZipRequest`, và phản hồi `{ requestId, kind: "zip", bytes: Uint8Array, diagnosticCount: number } | { requestId, kind: "zip-failed" }`. Yêu cầu sinh code cũ giữ nguyên hình dạng (không có `kind`).
- `buildZip(entries: readonly { readonly fileName: string; readonly bytes: Uint8Array; readonly isCompressed: boolean }[]): Uint8Array`: sắp theo `fileName` (`<`), `zipSync` của `fflate` với mỗi mục `[bytes, { level: isCompressed ? 6 : 0, mtime: new Date(1980, 0, 1) }]` (spec mục 11). `mtime` theo giờ địa phương của định dạng ZIP: test kiểm tra ngày đọc lại bằng `unzipSync` và hai lần tạo cho cùng byte.
- `handleZipRequest(request, { loadGenerator }): Promise<…>`: chạy từng generator, tên file bằng `toGeneratedFileName`, nội dung bằng `strToU8`; JSON bằng `serializeSchemaDocument`; ảnh giữ nguyên byte, không nén; `diagnosticCount` là tổng số diagnostic của các generator. `code-generator.worker.ts` rẽ nhánh theo `isBuildZipRequest`, trả `bytes` dạng transferable.
- `useBuildZip(options?: { createWorker? })`: tạo một worker riêng từ `new URL("./code-generator.worker.ts", import.meta.url)` khi cần, hủy khi unmount; ảnh PNG, SVG chụp trên luồng chính bằng `captureCanvasImage` (node từ `useCanvasNodeControls().getMeasuredNodes()`) trước khi gửi, byte chuyển bằng transferable (spec mục 11 "Nội dung").
- `ZipDialog`: các nhóm và mục theo bảng spec mục 11 (checkbox; `Select` provider Prisma, dialect Drizzle, format seed hiện khi mục được chọn); "Chọn tất cả", "Bỏ chọn tất cả"; dòng tóm tắt số file (`countZipFiles`) và tổng diagnostic (lần tạo gần nhất, hoặc ẩn khi chưa tạo); cảnh báo khi `getIssueIndex(document)` có issue (như code panel); nút "Tải" disable khi không chọn gì, hiện `generating` trong lúc tạo; xong thì `downloadBlob(new Blob([bytes], { type: "application/zip" }), toZipFileName(base))`.
- `ExportMenu`: mục "ZIP…" mở `ZipDialog` (bỏ trạng thái disabled của Task 30).

**Test viết trước:**

- `build-zip.test.ts`: `stores files in name order` (`unzipSync`); `sets every modification time to 1980-01-01`; `gives identical bytes for the same entries`; `stores png entries without compression`.
- `zip-selection.test.ts`: `selects only json by default`; `selects and clears every item`; `maps a selection to generator requests with code panel seed options`; `counts the files of a selection`.
- `handle-zip-request.test.ts`: `zips the selected generator outputs, json and images with spec file names`; `sums generator diagnostics`.
- `worker-protocol.test.ts`, `code-generator.worker.test.ts`: `recognises a build zip request`; `keeps accepting generate requests without a kind`.
- `create-editor-store.test.ts`: `keeps the zip selection until the store is dropped`.
- `zip-dialog.test.tsx`: `selects all and clears all`; `disables download when nothing is selected`; `shows the file count and diagnostic summary`; `warns when the schema has issues`; `downloads the zip with its file name`; `has no axe violations in light and dark themes`.

**Kiểm tra:** như "Quy ước chung" (frontend).

**Commit:** `feat(frontend): download several outputs as one zip`

## Task 28: Import trong editor và chế độ gộp

**Mục tiêu:** nút Import trên toolbar với hai chế độ; gộp dispatch đúng một operation, chọn bảng mới, fit khung nhìn quanh bảng mới (`fitNodes` của Task 29), toast có "Hoàn tác" (spec mục 2 "Thêm vào schema hiện tại", mục 12 "Điểm vào", "Xác nhận"; tiêu chí "Chung" thứ năm).

**Agent:** frontend-engineer. **Phụ thuộc:** Task 25, 26, 30, AI-22 (Task 22 của plan phần 5, `selectIsPreviewing`). **Đợt:** 8.

**File sở hữu:** tạo `frontend/src/features/editor/import-export/editor-import-button.tsx` (+ test), `compute-merge-origin.ts` (+ test), `use-merge-import.ts` (+ test), `frontend/src/features/editor/journeys/import-export.test.tsx` (đặt tên như các journey hiện có, ví dụ `relations.test.tsx`); sửa `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`, `editor-toolbar.test.tsx`.

**Chữ ký và hành vi:**

- `computeMergeOrigin(nodes: readonly { readonly position: Position; readonly width: number; readonly height: number }[], gap: number): Position`: không có node thì `{ x: 0, y: 0 }`; còn lại `{ x: max(x + width) + gap, y: min(y) }`, làm tròn (spec mục 2 bước 3). Node lấy từ `useCanvasNodeControls().getMeasuredNodes()` (Task 29), kích thước từ `measured`.
- `EditorImportButton`: nút có icon kèm nhãn `importExport:import.open`, đặt cạnh menu Export; giữ ref của nút và truyền `onReturnFocus` (focus về nút này khi hộp thoại đóng; prop bắt buộc của `ImportDialog`, Task 25); `const isPreviewing = useEditorStore(selectIsPreviewing)` (AI-22): nút `disabled` khi xem trước đề xuất AI, và truyền `isBlocked={isPreviewing}` cho `ImportDialog` (Task 25) để hộp thoại đang mở đóng lại khi xem trước bắt đầu. Mở `ImportDialog` với `mergeTarget = { document, origin: computeMergeOrigin(…, IMPORT_LAYOUT_METRICS.gap) }` và dialect nhớ qua `usePendingImport`; `onConfirm`: chế độ `new` gọi `useCreateImportedSchema` (Task 26); chế độ `merge` gọi `useMergeImport`.
- `useMergeImport()`: đầu tiên, nếu `selectIsPreviewing(store.getState())` thì `notify` lỗi `importExport:import.errors.previewing` và không làm gì thêm (`dispatch` không làm gì khi xem trước, nên không có gì được áp mà vẫn báo thành công; Vấn đề 19); rồi, trước khi dispatch, so `store.getState().document` với `confirmation.target` (cùng tham chiếu); khác thì báo `importExport:import.errors.notApplied` và không dispatch. Hộp thoại modal chặn sửa bằng tay, nhưng đồng bộ cloud (phần 4) vẫn có thể thay tài liệu đang mở trong lúc hộp thoại mở, nên nhánh này xảy ra được; spec mục 2 "Hàm dựng" cho dựng lại batch, plan chọn báo lỗi để người dùng phân tích lại (Vấn đề 17). Cùng thì `dispatch(operation)` một lần; chọn mọi bảng có `addTable` trong batch (`setSelection`); `useCanvasNodeControls().fitNodes(id các bảng đó)` (Task 29: fit sau khi node mới được đo; không gọi `useReactFlow()` trực tiếp); `notify` thành công `import.done` với `count` là số bảng và action "Hoàn tác" gọi `undo` như toast khi xóa (`use-delete-selection.ts`).

**Test viết trước:**

- `compute-merge-origin.test.ts`: `returns the origin for an empty canvas`; `places the origin right of every node at the top edge`.
- `use-merge-import.test.tsx`: `dispatches one operation and selects the new tables`; `fits the view around the new tables` (`fitNodes` giả nhận đúng id của bảng mới); `offers an undo action that restores the previous schema`; `does not dispatch when the document changed`; `disables import during an AI proposal preview` (store đang xem trước: không dispatch, không `setSelection`, không `fitNodes`, có thông báo `previewing`, không có toast thành công).
- `editor-import-button.test.tsx`: `opens the dialog with both modes and a merge origin`; `returns focus to the import button when the dialog closes`; `disables import during an AI proposal preview` (nút `disabled`, hộp thoại đang mở đóng lại khi xem trước bắt đầu).
- `editor-toolbar.test.tsx`: `shows the import button next to the export menu`; `disables the import button during an AI proposal preview`.
- `import-export.test.tsx` (journey; `fake-indexeddb`, worker giả chạy `handleImportRequest` với importer thật): `merges an import into the open schema, renames clashing names and undoes in one step` (autosave lưu cả hai trạng thái); `exports json from the editor and imports it as a new identical schema` (`serializeSchemaDocument` của schema mới bằng file đã xuất); `applies a new-mode import from the editor once under StrictMode` (cây render trong `<StrictMode>`; sau khi chuyển sang schema mới, lịch sử có đúng một mục và số bảng bằng số bảng của file); `leaves the open schema unchanged when the json file is invalid`.

**Kiểm tra:** như "Quy ước chung" (frontend).

**Review:** sau khi orchestrator kiểm tra, `ecc:react-reviewer` review riêng task này (chỉ review, không sửa file): hook gộp, lệnh fit sau khi đo, StrictMode.

**Commit:** `feat(frontend): import into the open schema from the editor`

## Task 32: Kiểm tra tay và kiểm tra toàn repo

**Mục tiêu:** kiểm chứng mọi tiêu chí ghi "(kiểm tra tay)" và các số đo tay của spec mục 14, chạy lại toàn bộ kiểm tra trên `master` sau khi mọi task đã merge (spec mục 15 "Kiểm tra tay"; tiêu chí "Chung" thứ tám, mười; IE-07).

**Agent:** orchestrator chạy lệnh và giao checklist tay cho người dùng; `spec-writer` ghi log. **Phụ thuộc:** Task 18, 19, 20, 27, 28, 31. **Đợt:** 9. Cần Docker và ba trình duyệt Chrome, Firefox, Safari.

**File sở hữu (tạo):** `document/executions/logs/YYYY-MM-DD-import-export-task-32.md`.

**Kiểm tra tự động** (trên `master`, ghi kết quả vào log):

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm format:check
pnpm --filter @schemaforge/core bench
docker info >/dev/null && pnpm --filter @schemaforge/codegen-conformance exec vitest run --exclude src/sqlserver.test.ts --exclude src/probes/sqlserver.probe.test.ts -t '^(?!.*sql server).*$'
grep -rlE "from ['\"]@dbml/core|import\(['\"]@dbml/core" packages/core/dist --include='*.js'
git status --porcelain
```

Mong đợi: mọi lệnh thoát mã 0; `grep` chỉ in `packages/core/dist/importers/shared/dbml-core-adapter.js`; `git status` sạch. Không chạy `pnpm test:conformance`: lệnh đó gồm cả `sqlserver.test.ts` và các test SQL Server khác, mà theo quyết định của người dùng ngày 2026-10-03 SQL Server không chạy trên database thật, chỉ kiểm tra ở mức code (`document/executions/logs/2026-10-03-sqlserver-code-check.md`; Vấn đề 2). Phần SQL Server của import được kiểm tra bằng fixture SSMS và round-trip trong core (Task 12) và test UTF-16 LE của Task 24.

**Checklist tay** (bản build production `pnpm --filter @schemaforge/frontend build` rồi `start`, không đăng nhập; mỗi dòng ghi kết quả "đạt", "không đạt" kèm ghi chú vào log):

1. Import mỗi định dạng (SQL ba dialect, Prisma, DBML, JSON) ở cả hai chế độ, và export JSON, PNG, SVG, ZIP, "Tải file" của code panel: tab Network không có request nào ngoài file tĩnh của ứng dụng; Console không có vi phạm CSP; chunk chứa `@dbml/core` chỉ tải khi phân tích SQL hoặc DBML, không tải khi mở editor.
2. PNG và SVG trên Chrome, Firefox, Safari, cả hai theme, với schema 100 bảng (`pnpm --filter @schemaforge/frontend perf:snippet` hoặc import DDL sinh từ `createLargeSchema({ tableCount: 100 })`): đủ bảng, cột, edge, marker chân gà, không bị cắt khi canvas đang zoom hoặc chỉ thấy một phần, font đúng; minimap, handle, huy hiệu issue, vòng chọn không có trong ảnh. Xác nhận `MAX_PNG_SIDE` 16 384 tạo được ảnh trên cả ba trình duyệt (spec mục 10, bước 3).
3. File SVG mở được trên trình duyệt và hiển thị khi nhúng vào README của một repo GitHub thử.
4. Tải file thật (Tải file, JSON, PNG, SVG, ZIP) trên ba trình duyệt: tên file ASCII theo spec mục 9; ZIP giải nén được bằng công cụ của hệ điều hành.
5. Hộp thoại import và hộp thoại ZIP dùng được hoàn toàn bằng bàn phím (chọn file, đổi tab, chọn định dạng, dialect, chế độ, xác nhận, hủy), focus trở lại nút mở khi đóng.
6. Số đo spec mục 14: từ "Phân tích" tới bước xem trước (SQL ≤ 5 giây, định dạng khác ≤ 2 giây) với nguồn từ `createLargeSchema({ tableCount: 200 })`, kéo thả và gõ trong hộp thoại vẫn mượt; từ "Import" tới khi canvas hiện đủ bảng ≤ 3 giây; PNG, SVG 100 bảng ≤ 5 giây mỗi định dạng trên ba trình duyệt; ZIP chọn mọi mục với `createLargeSchema` ≤ 5 giây không tính chụp ảnh. Ghi số đo, máy, trình duyệt.
7. Khi đã đăng nhập (backend local chạy): import tạo schema mới có chủ, được đẩy lên cloud như schema tạo bằng nút "Tạo".

Script SSMS lưu UTF-16 LE không còn là dòng kiểm tra tay: test tự động `imports an ssms script saved as utf-16 le with a byte order mark` của Task 24 thay thế (Vấn đề 2).

Dòng nào không đạt: orchestrator tạo task sửa riêng (task mới của plan khác hoặc task sửa lỗi), không đánh dấu phần 7 xong.

**Commit:** `docs: record import and export manual checks`

## Task 33: Tài liệu

**Mục tiêu:** tài liệu khớp với những gì đã làm (spec tiêu chí "Theo tính năng" cuối; mục "Vấn đề với các spec đã duyệt").

**Agent:** spec-writer. **Phụ thuộc:** Task 32 (mọi dòng đạt). **Đợt:** 10.

**File sở hữu (sửa):** `document/roadmap.md`, `document/architecture.md`, `document/specs/2026-09-14-core-schema-model-design.md`, `document/specs/2026-09-14-feature-list-design.md`, `document/specs/2026-09-15-import-export-design.md`.

**Cài đặt:**

- `roadmap.md`: phần 7 sang "Xong".
- `architecture.md`: sửa dòng đã có, không thêm bản thứ hai: "Kiểm tra hình dạng trong core" (giữ nội dung, thêm `@dbml/core` `^10.2.0`); "Export ZIP" (worker sinh code của editor, `build-zip.ts`); "Entry point testing của core" (thêm `PRISMA_IMPORT_FIXTURES`); "Conformance test của generator" (thêm conformance import: `pg_dump`, `mysqldump`, `prisma db pull`, `prisma validate`); thêm dòng "Vị trí code import/export ở frontend" theo Vấn đề 1 nếu chưa có dòng nào nói về cấu trúc thư mục frontend.
- Spec phần 2: dòng "Import (phần 7)" của bảng chính sách theo nơi gọi ở mục 8 theo spec phần 7 mục 3; tiêu chí "chỉ có runtime dependency là Zod" theo spec phần 7 mục "Vấn đề với các spec đã duyệt" dòng 2.
- Danh sách tính năng: câu hỏi 10 ghi đã trả lời, dẫn tới spec phần 7 mục 2.
- Spec phần 7: sửa các chỗ lệch theo cột "Đề xuất" của Vấn đề 1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 15, 16, 17, 18 (Vấn đề 7 và 20 đã ghi vào spec cùng lúc quyết định; đường dẫn frontend ở mục 9, 10, 12 và mục "Cấu trúc thư mục"; conformance chạy local ở mục 15; phiên bản ở mục "Phiên bản", gồm `domToForeignObjectSvg` thay `domToSvg` cho SVG ở mục 10; marker trong `ViewportPortal` ở mục 10; `LayoutMetrics` ở mục 4; không có "Tải JSON" ở dòng `cloud-only` ở mục 12 "Điểm vào"; gộp báo lỗi `notApplied` thay vì dựng lại batch khi tài liệu đổi trong lúc hộp thoại mở, kể cả do đồng bộ cloud, ở mục 2 "Hàm dựng"; `DELIMITER` ở mục 5; giấy phép ở mục "Rủi ro"), và bảng kết quả benchmark từ log Task 19 (kể cả bench ở giới hạn 20 000 phần tử) cùng số đo tay từ log Task 32 ở mục 14.
- Spec phần 7, quyết định SQL Server của người dùng ngày 2026-10-03 (Vấn đề 2): mục 15 ghi SQL Server không chạy trên database thật mà kiểm tra ở mức code (dẫn `document/executions/logs/2026-10-03-sqlserver-code-check.md`), script SSMS UTF-16 LE thành test tự động của frontend (Task 24) thay dòng kiểm tra tay; tiêu chí IE-01 về fixture SSMS ghi rõ được kiểm tra bằng fixture, round-trip trong core và test UTF-16 LE, không bằng database SQL Server.

**Kiểm tra:** bảng render đúng (số cột của dòng phân cách khớp tiêu đề), link tương đối và `#anchor` mở được, bốn tài liệu không mâu thuẫn nhau; `git status --porcelain` chỉ có năm file sở hữu cộng log của task.

**Commit:** `docs: record import and export decisions and mark part 7 done`

## Vấn đề phát hiện khi lập plan

Phát hiện khi đối chiếu spec (2026-09-15) với code trên `master` ngày 2026-10-03 và với rule hiện hành. Cột "Đề xuất" là lựa chọn của plan (các task đã viết theo lựa chọn này); Task 0 xác nhận hoặc đổi trước khi task bị ảnh hưởng chạy. Các vấn đề quan trọng nhất là 1, 9, 11, 20.

| # | Vấn đề | Đề xuất | Ảnh hưởng |
|---|---|---|---|
| 1 | **Thư mục frontend trái `nextjs.md`.** Spec mục "Cấu trúc thư mục" đặt phần dùng chung ở `frontend/src/features/import-export/` và cho `features/editor`, `features/schema-list` cùng import nó; `.claude/rules/nextjs.md` cấm feature import nội bộ của feature khác. Spec còn ghi code panel ở `features/code-generator/`, thực tế ở `features/editor/code-generator/` (phần 6, Vấn đề 14 của plan phần 6) | Phần dùng chung: logic và worker ở `frontend/src/lib/import-export/`, tải file ở `lib/download/`, hộp thoại và provider ở `frontend/src/components/import-dialog/`, `components/pending-import-provider.tsx`; phần chỉ editor dùng ở `features/editor/import-export/`, ZIP trong `features/editor/code-generator/`. Không cần rule lint mới: rule hiện có chặn editor và schema-list import lẫn nhau, rule `nextjs.md` áp cho phần còn lại | Task 23–31, 33 |
| 2 | **Không còn CI.** Spec mục 15 ghi conformance "chỉ CI"; CI đã bị gỡ ngày 2026-10-02, conformance chạy local bằng Docker qua `pnpm test:conformance` (`architecture.md`, dòng "Conformance test của generator") | Conformance import chạy local như phần 6; Task 20 và Task 32 cần Docker. Quyết định của người dùng ngày 2026-10-03: SQL Server không chạy trên database thật, chỉ kiểm tra ở mức code (`document/executions/logs/2026-10-03-sqlserver-code-check.md`); Task 32 chạy conformance trừ `sqlserver.test.ts`, `probes/sqlserver.probe.test.ts` và test có tên chứa `sql server`; dòng kiểm tra tay "script SSMS UTF-16 LE" thành test tự động của Task 24 (fixture SSMS của Task 12 export qua `@schemaforge/core/testing`) | Task 12, 20, 24, 32, 33 |
| 3 | **Phiên bản `@dbml/core`.** Spec thử trên 10.1.1; lockfile đã có 10.2.0 (qua conformance, `^10.1.1`) | Core khai báo `^10.2.0`, một bản cho cả repo; Task 8 probe lại mọi hành vi spec dựa vào trên 10.2.0 trước khi viết adapter và ghi điểm lệch vào log. Probe ngày 2026-10-05 có điểm lệch ở SQL (xử lý theo Vấn đề 20), DBML khớp spec mục 7; spec mục 5, 7 đã ghi kết quả probe | Task 1, 8, 11, 12, 16 |
| 4 | **Ngày phát hành `fflate` 0.8.3** là 2026-05-16, không phải 2026-07-20 như spec (ngày đó là lúc đăng lại các bản 0.4–0.7) | Không ảnh hưởng thiết kế; Task 33 sửa bảng "Phiên bản" của spec | Task 33 |
| 5 | **Marker nằm ngoài viewport.** `<RelationMarkers />` render ngoài `<ReactFlow>` trong `editor-canvas.tsx`, nên `<defs>` không nằm trong `.react-flow__viewport` mà spec mục 10 yêu cầu | Chuyển vào `ViewportPortal` của `@xyflow/react` (có trong 12.11.6); test jsdom kiểm tra `<defs>` nằm trong viewport | Task 29 |
| 6 | **Không có hằng kích thước node.** Spec mục 4 nói `LayoutMetrics` lấy từ hằng của `TableNode`; `table-node.tsx` chỉ có lớp `max-w-80 min-w-56`, chiều cao tiêu đề và dòng cột do CSS quyết định | Hằng `IMPORT_LAYOUT_METRICS` trong `lib/import-export/import-layout.ts`: `tableWidth` 320 theo `max-w-80`, hai chiều cao đo trên `pnpm dev` (lấy số lớn hơn giữa hai theme), `gap` 80; không đổi `TableNode` | Task 24, 28 |
| 7 | **Issue `index-name-conflicts-table` mới** (phần 6, Task 36) chưa có khi viết spec: gộp có thể tạo index trùng tên bảng | Khi gộp, tên index được so với tên index **và tên bảng** của đích, tên mới của các bảng vừa gộp và tên index đã cấp, như `suggestIndexName`; tên bảng nhập được so với tên bảng, enum **và tên index** của đích, nên bảng nhập trùng tên một index có sẵn cũng được đổi (`table-renamed`). Gộp không bao giờ thêm issue `index-name-conflicts-table` (quyết định của orchestrator sau review ngày 2026-10-05, spec mục 2; cài đặt trong [log sửa sau review](../executions/logs/2026-10-05-import-export-review-1-fixes.md), cùng việc đặt tên index không tên và tên khi gộp trong thời gian tuyến tính) | Task 6, 25 |
| 8 | **Dòng `cloud-only` ở màn hình danh sách** (phần 4) không có bản local để đọc, spec mục 12 chưa nói | Không có mục "Tải JSON" ở dòng `cloud-only` (cần mạng, và bản cloud đã được sao lưu); mở schema rồi dùng menu Export | Task 27, 33 |
| 9 | **Worker cho ZIP.** Spec cho ZIP chạy trong worker của code panel, nhưng worker đó do `useGeneratedCode` tạo khi panel mở; hộp thoại ZIP mở từ toolbar | Thêm yêu cầu `build-zip` (có trường `kind`) vào `worker-protocol.ts`; hộp thoại ZIP tạo một worker riêng từ cùng file `code-generator.worker.ts`; yêu cầu sinh code cũ giữ nguyên hình dạng; lựa chọn ZIP trong store của editor | Task 31 |
| 10 | **`DELIMITER` của MySQL** (spec mục "Rủi ro") | Scanner hỗ trợ ngay dòng `DELIMITER <chuỗi>` thay vì chờ conformance phát hiện: vài dòng code, và dump có trigger luôn dùng nó | Task 9 |
| 11 | **Áp `batch` lớn có thể chậm.** `applyOperation` gọi `parseOperation` (Zod) trên cả batch trước khi áp; batch khoảng 4 700 bước của spec mục 14 chưa được đo | Task 19 đo, kể cả batch ở giới hạn `MAX_IMPORTED_ELEMENTS` (20 000 phần tử) mà editor phát lại trên luồng chính qua `dispatch`; trượt ngưỡng thì orchestrator tạo task tối ưu riêng trong core không đổi hợp đồng của `applyOperation` (spec mục 14), hoặc với bench 20 000 phần tử chọn giữa tối ưu và hạ giới hạn (đổi spec, cần người dùng duyệt). Task tối ưu (nếu có) phải merge trước Task 32 (số đo tay); Task 24 không chờ vì hợp đồng không đổi | Task 19, 32 |
| 12 | **`pg_dump`, `mysqldump` cần chạy trong container**, nhưng `startDatabaseServer` của `containers.ts` không lộ container | Helper mới `src/support/database-dump.ts` tự khởi động container bằng module Testcontainers và dùng `container.exec`; không sửa `containers.ts` | Task 20 |
| 13 | **Thông báo giấy phép** (spec mục "Rủi ro"): chưa chọn cách | File tĩnh `frontend/public/third-party-notices.txt` chép giấy phép của các gói bundle mới; không thêm công cụ sinh tự động | Task 24 |
| 14 | **Nhớ dialect SQL tới khi tải lại trang** (spec mục 12) mà không có state cấp module | Giữ trong `PendingImportProvider` (state React ở `AppProviders`), hộp thoại nhận qua prop | Task 25, 26, 28 |
| 15 | **Conformance cần fixture Prisma của core** (spec mục 15 "Fixture Prisma của core") nhưng fixture nằm trong `src/importers/prisma/fixtures/`, conformance chỉ dùng bản build | Export `PRISMA_IMPORT_FIXTURES` qua `@schemaforge/core/testing` (entry chỉ dành cho test) | Task 15, 20, 33 |
| 16 | **`resolveIssueTarget` nằm trong `features/editor/lib/`**, mà hộp thoại import dùng chung cần nó (spec mục 12 bước 3) | Chuyển nguyên văn sang `frontend/src/lib/schema/resolve-issue-target.ts` | Task 21, 25 |
| 17 | **Tài liệu editor đổi giữa lúc phân tích và lúc xác nhận** (spec mục 2 "Hàm dựng" cho dựng lại batch) | Không dựng lại: báo lỗi `import.errors.notApplied` và không dispatch. Hộp thoại modal chặn sửa bằng tay nhưng đồng bộ cloud (phần 4) có thể thay tài liệu đang mở trong lúc hộp thoại mở, nên trường hợp này xảy ra được; dựng lại cần chạy lại worker và bước xem trước người dùng đã xem sẽ sai | Task 28, 33 |
| 18 | **`toComparableSchema` trong `@schemaforge/core/testing`** (spec mục 15 và mục "Vấn đề với các spec đã duyệt" dòng 3) | Giữ là helper nội bộ của test core, không export: conformance so DDL từng byte, không cần hàm này | Task 3, 33 |
| 19 | **Phần 5 (AI) cài đặt trước phần 7** (orchestrator quyết định 2026-10-03). Hai plan sửa chung nhiều file (dòng cuối mục "Điểm nóng"). Khi xem trước đề xuất AI, `dispatch` của store editor là no-op phòng thủ ([plan phần 5](2026-10-03-ai-assistant-plan.md), Task 22), nên import gộp có thể báo thành công mà không áp gì | Phần 5 merge trước, task phần 7 rebase lên đó. Mọi điểm vào import chặn khi `selectIsPreviewing(state)` (export từ `create-editor-store.ts`, AI-22): nút Import trên toolbar `disabled`; `ImportDialog` nhận `isBlocked` và đóng khi xem trước bắt đầu; `useMergeImport` kiểm tra lại ngay trước khi dispatch và báo `import.errors.previewing`; `useApplyPendingImport` bỏ qua khi xem trước. Màn hình danh sách không có store editor nên không cần chặn. Thêm key `import.errors.previewing` ở Task 22; Task 26, 28 phụ thuộc AI-22 | Task 22, 25, 26, 28; plan phần 5 |
| 20 | **Probe `@dbml/core` 10.2.0 lệch spec mục 5** (log Task 8): parser bỏ âm thầm `with time zone` của PostgreSQL, viết dính tên kiểu nhiều từ (`doubleprecision`), bỏ MySQL `UNSIGNED`, `ZEROFILL`, `ON UPDATE CURRENT_TIMESTAMP`, `COLLATE`, `DESC` và `WHERE` của index; đọc cột tính toán như cột thường (SQL Server: tên kiểu `AS …`); bỏ PostgreSQL, MySQL `ALTER TABLE … ADD COLUMN` và MySQL `ALTER TABLE … ADD UNIQUE`; không phân biệt `UNIQUE (…)` cấp bảng với `CREATE UNIQUE INDEX`; SQL Server bỏ qua văn bản không nhận ra bên trong một câu; `DEFAULT NULL` ra `{boolean, "null"}`, PostgreSQL `-5` ra biểu thức | Orchestrator quyết định 2026-10-05: scanner đọc lại phần parser bỏ, không gì mất âm thầm. Task 11 thêm `sql-column-definitions.ts` (văn bản kiểu gốc, `ON UPDATE`, `COLLATE`, cột tính toán, `UNIQUE` cấp bảng và qua `ALTER TABLE … ADD`) và `sql-index-definitions.ts` (`DESC` và tùy chọn khác của phần tử cột, `INCLUDE`, `WHERE`, tên index), sửa `classify-statement.ts` (PostgreSQL, MySQL `ADD [COLUMN] <cột>` và MySQL `ADD UNIQUE` thành `unsupported`; dump ghi các phần này trong `CREATE TABLE` nên chấp nhận được). Quy tắc MySQL `'1'`/`'0'` trên cột boolean có sẵn trong `sql-default-mapping.ts` ([log sửa sau review](../executions/logs/2026-10-05-import-export-review-1-fixes.md)). Task 12 dùng văn bản kiểu của scanner cho `mapSqlType` và báo `on-update-not-supported`, `type-parameter-dropped` (collation), `index-option-dropped` (tùy chọn phần tử cột, `INCLUDE`, `WHERE`), `computed-column-not-supported`; không thêm mã mới. MySQL `ENUM(…)` nội tuyến thành enum trước `mapSqlType`. SQL Server bỏ qua văn bản trong câu: hạn chế đã biết. DBML khớp spec; Task 16 lưu ý thứ tự đầu mút của `ref:` trên cột. Spec mục 5, 7, "Rủi ro" đã sửa theo quyết định này | Task 11, 12, 16, 22 |

## Đối chiếu tiêu chí hoàn thành

| Tiêu chí của spec | Task |
|---|---|
| Chung: subpath `importers/sql`, `/prisma`, `/dbml`, `/json`; entry point chính export hợp đồng; `@dbml/core` chỉ trong adapter (lint), `dist/index.js` không tham chiếu | 1, 2, 7, 8, 12, 15, 16, 17 |
| Chung: không importer nào throw (property test); lỗi, diagnostic có dòng, cột; mỗi mã có test và bản dịch `vi`, `en` | 2, 7, 12, 15, 16, 18, 22 |
| Chung: file > 2 MiB bị từ chối trước khi đọc; `source-too-large`, `too-many-elements` đúng giới hạn | 2, 4, 7, 12, 15, 16, 24, 25 |
| Chung: file không đọc được hiện lỗi đã dịch, dòng, cột, trích đoạn; không tạo schema; schema đang mở không đổi | 25, 26, 28 |
| Chung: tạo mới có đúng một mục lịch sử; gộp một mục lịch sử, một undo; tên trùng đổi kèm diagnostic | 6, 26, 28 |
| Chung: bước xem trước hiện số phần tử, khác biệt, issue mới; issue không chặn import | 24, 25 |
| Chung: parse trong worker, hủy được, quá 30 giây thì báo lỗi và hủy worker | 24, 25 |
| Chung: bản build production không có request mạng, không vi phạm CSP (kiểm tra tay) | 24, 32 |
| Chung: chuỗi qua `importExport`, `importDiagnostics`; axe không vi phạm trên hai hộp thoại, hai theme | 22, 25, 31 |
| Chung: ngưỡng hiệu năng mục 14 (benchmark, số đo tay) | 19, 32, 33 |
| IE-01: DDL ba dialect; diagnostic tại vị trí; điểm bất động trên ba fixture; fixture `pg_dump`, `mysqldump`, SSMS (kể cả SSMS lưu UTF-16 LE, test tự động thay kiểm tra tay); conformance `pg_dump`, `mysqldump` (SQL Server kiểm tra ở mức code) | 9, 10, 11, 12, 20, 24 |
| IE-02: đọc đủ cấu trúc; round-trip `postgresql`, điểm bất động `mysql`, `sqlserver`; `prisma validate`, `prisma db pull`; không thêm dependency | 13, 14, 15, 20 |
| IE-03: đọc đủ cấu trúc; import output CG-09 bằng bản gốc, không diagnostic | 8, 10, 16 |
| IE-04: JSON qua `parseSchemaDocument`; lỗi có dòng, cột, mã, đường dẫn; import file IE-06 giống hệt từng byte | 7, 18, 28 |
| IE-05: "Tải file" cho mọi đích CG-01 đến CG-10, tên theo mục 9 | 23 |
| IE-06: tải JSON từ editor và danh sách; đủ vị trí, subject area, ghi chú; cùng từng byte | 3, 27, 30 |
| IE-07: PNG, SVG đủ mọi bảng, không cắt; `computeImageFrame` có test; ba trình duyệt, hai theme (kiểm tra tay); PNG lớn được thu nhỏ | 29, 30, 32 |
| IE-08: hộp thoại ZIP chọn nhiều định dạng; tên theo mục 9; cùng từng byte | 31 |
| Khi xong: `architecture.md`, `roadmap.md`, danh sách tính năng, bảng chính sách của spec phần 2 được cập nhật | 33 |
