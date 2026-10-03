# Task 16: 18 tool trên trạng thái lượt

Plan: [Task 16](../../plans/2026-10-03-ai-assistant-plan.md#task-16-18-tool-trên-trạng-thái-lượt). Spec: [AI-R14–R16, AI-R19, AI-R20, AI-R35, AI-R41, AI-R50, AI-R63, Rủi ro 2, 3, 9, 12](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-03 22:40 — ai-engineer — Xong

- **Đã làm**
  - `backend/test/mock-ai-model.ts`: `createScriptedModel(steps)` (mỗi lần gọi model trả bước kế tiếp, tự thêm `stream-start` ở đầu; hết bước thì ném lỗi), `createFailingModel(error)` (`doStream` ném lỗi trước khi stream, như request HTTP bị từ chối), và các hàm dựng chunk `scriptedText`, `scriptedToolCall`, `scriptedFinish`. Kiểu `ProviderStreamPart` suy ra từ `MockLanguageModelV4["doStream"]` vì `@ai-sdk/provider` không phải dependency trực tiếp của backend.
  - Rủi ro 9, các file đã đọc để lấy hình dạng chunk: `node_modules/.pnpm/@ai-sdk+provider@4.0.21/.../dist/index.d.ts` (`LanguageModelV4StreamPart`, `LanguageModelV4ToolCall`, `LanguageModelV4Usage`, `LanguageModelV4FinishReason`), `ai@7.0.126/.../dist/test/index.d.ts` (`MockLanguageModelV4`, `doStreamCalls`), `@ai-sdk+google@4.0.87/.../src/google-language-model.ts` (lời gọi hàm hoàn chỉnh phát `tool-input-start`, `tool-input-delta`, `tool-input-end`, rồi `tool-call` có `input` là chuỗi JSON; `finish` kèm `usage` và `finishReason { unified, raw }`), `convert-google-usage.ts`, `map-google-finish-reason.ts` (Gemini báo `STOP` cả khi có tool call), `google-prepare-tools.ts`. Gói `@ai-sdk/google` 4.0.87 không kèm file test, nên đối chiếu theo mã nguồn `src/`.
  - `ai-sdk-behavior.spec.ts` (viết và chạy **trước** `ai-tools.ts`, ba probe đều pass ngay lần chạy đầu, đúng kỳ vọng):
    - **Rủi ro 2**, `passes nested tool input schemas to the provider`: `doStreamCalls[0].tools` của `createTable` còn `columns.items.properties.type.properties.kind.enum` đủ 19 kind, `required` (`name`, `columns`, `primaryKey`; cột: `name`, `type`, `isNullable`), `maxLength: 63`; `proposeSampleData` còn `rows` là mảng của mảng object `{ column: string (maxLength 63), value: anyOf [string (maxLength 2000), null] }`, `required: ["column", "value"]`. Ghi thêm: JSON Schema là draft-07, có `additionalProperties: false` (từ `strictObject`) và `maximum: 9007199254740991` cho `z.int()`; `@ai-sdk/google` 4.0.87 gửi nguyên JSON Schema qua `parametersJsonSchema` (không chuyển sang tập con OpenAPI). Gemini có nhận các từ khóa này hay không vẫn phải kiểm tay ở Task 29.
    - **Rủi ro 3**, `returns an input error to the model without calling execute`: tool call `renameSchema` với `{ "name": 42 }` không tới `execute`, `onError` không bị gọi, lượt chạy tiếp; bước 2 nhận một tin `role: "tool"` có `tool-result` với `output.type === "error-text"`. Văn bản lỗi do AI SDK dựng (`AI_InvalidToolInputError ... Value: {"name":42} ...`) lặp lại input của chính model; nó chỉ quay về model, không rời backend (bộ lọc của Task 17 bỏ chunk tool).
    - **Rủi ro 12**, `keeps a __proto__ column name from tool input to execute`: `execute` nhận đúng `{ column: "__proto__", value: "1" }`.
  - `ai-tools.ts`: `AiTurnState`, `AiToolOutput`, `createAiTurnState`, `buildAiTools(state, generateId): AiToolSet` đúng hành vi plan (đếm lần gọi, `tool-call-limit`, `turn-has-sample-data`, `turn-has-edits`, `findings-limit`, cắt còn 5 lỗi, `placement.placedCount += placedTables`, `changes` từ `describeAiChanges`, `abortSignal?.throwIfAborted()` trước mọi việc). Comment ở chỗ đếm nêu Rủi ro 3 và Vấn đề 56.
  - `ai-tools-descriptions.ts`: `AI_TOOL_DESCRIPTIONS` (18 câu tiếng Anh).
  - `ai-tools.spec.ts`: đủ 14 test của plan, cộng: `runs the 30th tool call`; `keeps findings field for field equal to the findings data contract` (kiểm kiểu); `runs a tool call of the model on the turn draft through streamText` (dùng `createScriptedModel`, cũng là kiểm kiểu rằng `AiToolSet` được `streamText` nhận); hai bảng `it.each` cho 11 tool sửa schema còn lại (`records the core operation of %s`, `routes %s to its core translator`). Test `__proto__` là một `describe` mang đúng tên test của plan, gồm năm `it` (mỗi tool một `it`).
  - TDD: RED `pnpm exec vitest run src/modules/ai/ai-tools.spec.ts` → `Error: Cannot find module './ai-tools.js'`, `Test Files 1 failed (1)`. GREEN sau khi cài đặt: `Tests 32 passed (32)`. Một test đỏ lúc đầu vì kỳ vọng sai về `at` của core (`findings.0` thay vì `findings.0.tables.a`); test được sửa cho đúng giá trị thật của `buildAiFindings`, không phải sửa code cho khớp test.
- **File thay đổi**
  - `backend/src/modules/ai/ai-tools.ts` (mới, 301 dòng)
  - `backend/src/modules/ai/ai-tools-descriptions.ts` (mới, 34 dòng)
  - `backend/src/modules/ai/ai-tools.spec.ts` (mới, 616 dòng)
  - `backend/src/modules/ai/ai-sdk-behavior.spec.ts` (mới, 181 dòng)
  - `backend/test/mock-ai-model.ts` (mới, 96 dòng)
  - `document/executions/logs/2026-10-03-ai-assistant-task-16.md` (log này)
- **Kiểm tra**
  - `.claude/scripts/worktree-setup.sh <worktree>` → `RESULT: PASS`; `pnpm --filter @schemaforge/api-contract build`, `pnpm --filter @schemaforge/backend generate`: thành công.
  - `.claude/scripts/test-file.sh backend src/modules/ai/ai-sdk-behavior.spec.ts` → `RESULT: PASS` (ba probe).
  - `.claude/scripts/verify.sh backend --build --format`: lần đầu `RESULT: FAIL (backend test)` do `src/modules/auth/auth-cookies.spec.ts > AuthCookies > never sets a Domain attribute` (`AssertionError: expected [] to have a length of 2 but got +0`), không liên quan đến task này; chạy riêng file đó `RESULT: PASS`, `pnpm test` ngay sau đó pass 480/480. Lần cuối: typecheck, lint, test, build, format đều PASS, `RESULT: PASS`.
  - `pnpm test` (backend): `Tests 491 passed (491)`, coverage dòng toàn backend 97.72%; `ai-tools.ts` 98.33% dòng (chỉ dòng 169, nhánh lỗi của `buildAiSampleDataset`, chưa phủ trực tiếp).
  - `.claude/scripts/secret-scan.sh --all-changed` và `--files <5 file mới>` → `SECRET-SCAN: CLEAN`.
  - `git status --porcelain` → chỉ 5 file mới ở trên (cộng log này).
- **Quyết định**
  - `buildAiTools` trả `AiToolSet` (mỗi tool có kiểu input riêng, `execute` đồng bộ trả `AiToolOutput`) thay cho `ToolSet`: kiểu này gán được cho `ToolSet` của `streamText` (test `through streamText` kiểm), mà test với Task 18 gọi `execute` trực tiếp có kiểu, không cần `any`.
  - Tool là object thường kèm `satisfies Tool<Input, AiToolOutput>` thay cho gọi `tool()`: `tool()` của `ai` 7.0.126 chỉ trả lại chính object (`function tool(tool) { return tool; }`), nhưng kiểu của nó nới kết quả `execute` thành promise hoặc async iterable.
  - Mỗi tool sửa schema ghi lại tên tool một lần nữa trong hàm dựng `AiEdit`: không thể dựng union `AiEdit` từ tên generic mà không cast.
  - `execute` đồng bộ: trạng thái lượt bị sửa ngay trong `execute`, nên các tool call song song trong một bước không xen kẽ nhau.
  - `at` là `""` cho lỗi cấp lượt (`tool-call-limit` theo AI-R19, và `turn-has-edits`, `turn-has-sample-data`); `findings-limit` có `at: "findings"` (trỏ vào mảng input).
  - Kiểm `findings-limit` sau khi `buildAiFindings` thành công, đúng thứ tự trong plan; tên sai thì báo lỗi tên trước.
  - `proposeSampleData` thành công trả `{ ok: true, changes: [] }`, giống `reportFindings`.
  - `manyToMany`: không thêm mã lỗi; mô tả `addRelation` ghi rằng với `manyToMany` thì `fromColumns`, `toColumns`, `onDelete`, `onUpdate` bị bỏ qua (core `applyAiEdit` bỏ qua mà không báo lỗi).
  - `AiToolOutput` giữ khóa `ok` theo AI-R16: tắt luật `naming-convention` cho đúng khối kiểu này kèm lý do, giống `describe-schema-for-ai.ts` của core.
  - Kiểm kiểu `AiFinding` với `aiFindingsDataSchema`: `AiFinding` gán được vào phần tử của hợp đồng theo từng trường (cùng tập khóa, cùng khóa của `targets`, mỗi trường và mỗi target gán được). `AiFinding` nguyên khối thì không gán được, vì `targets` là `readonly` còn kiểu Zod suy ra là mảng mutable; chiều ngược lại cũng không được, vì `TableId`, `ColumnId` hẹp hơn `string`. Test `appends findings from several calls` chạy thêm `aiFindingsDataSchema.safeParse({ findings }).success === true`.
  - `createFailingModel(error: unknown)` ném đồng bộ trong `doStream`: `ai` bọc lời gọi trong hàm async nên lỗi thành promise bị reject, mà không cần `Promise.reject` với giá trị `unknown` (bị luật `prefer-promise-reject-errors` chặn).
  - `simulateReadableStream` import từ `ai` vì bản trong `ai/test` đã deprecated (luật `no-deprecated`).
  - Tách `AI_TOOL_DESCRIPTIONS` sang `ai-tools-descriptions.ts` (trùng glob coverage `ai-*.ts`), để `ai-tools.ts` không vượt khoảng 300 dòng (trước khi tách là 331).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 18: `const state = createAiTurnState(parsedDocument); streamText({ tools: buildAiTools(state, generateId), stopWhen: isStepCount(AI_MAX_STEPS), abortSignal, ... })`; cuối lượt đọc `state.operations`, `state.findings`, `state.sampleData`. `execute` ném `AbortError` của signal khi request đã bị hủy.
  - Khi ghi `data-findings`, `state.findings` hợp lệ với `aiFindingsDataSchema` lúc chạy; nếu cần gán vào kiểu `AiFindingsData` thì chép `targets` sang mảng mutable (`[...finding.targets]`).
  - Kịch bản model giả: `createScriptedModel([[...scriptedToolCall(id, name, input), scriptedFinish("tool-calls")], [...scriptedText(id, text), scriptedFinish("stop")]])`; nhớ `stopWhen: isStepCount(n)` (mặc định của AI SDK là 1 bước).
  - `auth-cookies.spec.ts` (`never sets a Domain attribute`) đỏ một lần khi chạy cả bộ có coverage, rồi pass lại khi chạy lại; có thể là test chập chờn, cần người phụ trách auth xem.
  - Hook `rtk` chặn lệnh có biến shell, vòng lặp hay pipe phức tạp trong worktree; dùng lệnh đơn và `/usr/bin/git`.
