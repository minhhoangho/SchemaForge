# Task 2: Subpath `@schemaforge/core/ai` và hình dạng tool

Plan: [2026-10-03-ai-assistant-plan.md, Task 2](../../plans/2026-10-03-ai-assistant-plan.md#task-2-subpath-schemaforgecoreai-và-hình-dạng-tool). Spec: [2026-10-02-ai-assistant-design.md, mục 3](../../specs/2026-10-02-ai-assistant-design.md#3-bộ-tool-và-ánh-xạ-sang-operation).

## 2026-10-03 19:40 — core-engineer — Bị chặn (đã gỡ ở lượt sau)

- **Đã làm**
  - Tạo subpath `@schemaforge/core/ai` (export `"./ai"` trong `packages/core/package.json`), hằng giới hạn (`ai-limits.ts`), mã lỗi `AI_EDIT_ERROR_CODES` và type `AiEditError` có `at` (`ai-edit-error-codes.ts`), hình dạng Zod của 16 tool sửa schema cùng `reportFindings`, `proposeSampleData` (`ai-edit-tools.ts`), barrel `src/ai/index.ts`.
  - TDD: hai file test chạy đỏ trước (`Cannot find module './ai-edit-error-codes.js'`, `Cannot find module './ai-edit-tools.js'`), rồi cài đặt. 94/95 test của `ai-edit-tools.test.ts` và 2/2 của `ai-edit-error-codes.test.ts` xanh.
  - **Bị chặn theo Vấn đề 22:** test `keeps a __proto__ column key in a sample row` đỏ với `z.record`: `AssertionError: expected undefined to strictly equal { value: 1, writable: true, …(2) }`. Nguyên nhân: Zod 4.6.4 `$ZodRecord` bỏ qua khóa `__proto__` có chủ đích (`node_modules/zod/v4/core/schemas.js`, nhánh khóa không liệt kê: `if (key === "__proto__") continue;`). Theo plan: dừng và báo, không tự đổi hình dạng. Test được giữ nguyên (không skip).
  - Probe thêm: `z.json().safeParse` **ném** `RangeError` (tràn stack) với mảng lồng 100.000 cấp (khoảng 200 KB JSON, dưới giới hạn 256 KiB), vì `z.json()` đệ quy trước khi `superRefine` (stack tường minh) kịp chạy. Hình dạng dự phòng của Rủi ro 2 (cặp cột, giá trị chuỗi hoặc null) không có giá trị lồng nên giải quyết luôn vấn đề này.
- **File thay đổi**
  - `packages/core/package.json` (thêm export `"./ai"`)
  - `packages/core/src/ai/index.ts`, `ai-limits.ts`, `ai-edit-error-codes.ts`, `ai-edit-error-codes.test.ts`, `ai-edit-tools.ts`, `ai-edit-tools.test.ts`
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core packages/core/src/ai/ai-edit-tools.test.ts`: `Tests 1 failed | 94 passed (95)` (chỉ test `__proto__`).
  - `.claude/scripts/verify.sh core --build --format`: typecheck PASS, lint PASS, build PASS, format PASS, test FAIL `Tests 1 failed | 2738 passed (2739)`; `RESULT: FAIL (core test)`.
  - `ls packages/core/dist/ai/index.js packages/core/dist/ai/index.d.ts`: có đủ.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `AI_EDIT_TOOL_NAMES` là tuple viết thẳng, `aiEditToolInputShapes` dùng `satisfies Record<AiEditToolName, z.ZodType>`: tránh `as` khi lấy `Object.keys`; test ghim thứ tự khóa trùng danh sách tên.
  - `AI_COLUMN_TYPE_KINDS` dùng `as const satisfies readonly ColumnType["kind"][]` cộng `expectTypeOf<Exclude<…>>().toBeNever()`: hai chiều đều được kiểm.
  - Dùng lại `referentialActionShape`, `relationKindShape` của `model/relation.ts` cho `onDelete`, `onUpdate`, `updateRelation.kind`: một nguồn cho giá trị enum của core.
  - Mọi danh sách tên cột trừ `createTable.primaryKey` có `min(1)`, kể cả `columns` của một finding: theo câu "các danh sách khác `min(1)`" của plan.
  - `finding.detail` không có `min`: khớp `aiFindingsDataSchema` của spec (`z.string().max(2000)`).
  - Không dùng `.readonly()` trên hình dạng tool: hình dạng còn được chuyển sang khai báo hàm Gemini (Rủi ro 2), giữ JSON Schema tối giản.
  - Issue `custom` của `superRefine` mang message tiếng Anh ngắn: message đi tới model (AI SDK trả lỗi input cho model), không tới người dùng.
  - `ai-edit-error-codes.ts` `import type` `SeedIssueCode` từ `generators/seed/seed-dataset.ts`: plan ghi type này trong `AiEditError`; chỉ là import type, không kéo mã seed vào subpath.
- **Việc còn lại**
  - [ ] Orchestrator quyết định theo Vấn đề 22: tạo task chuyển `proposeSampleData.rows` sang hình dạng dự phòng của Rủi ro 2 (`rows: { column: string; value: string | null }[][]`), sửa Task 2, 8, 16 cùng một commit. Khi đó đổi `proposeSampleDataInputShape` trong `packages/core/src/ai/ai-edit-tools.ts`, các test mẫu trong `ai-edit-tools.test.ts` (giới hạn khóa mỗi dòng, chuỗi, độ sâu, 256 KiB, `__proto__`), và có thể bỏ `AI_MAX_SAMPLE_DEPTH`.
  - [ ] Nếu giữ `z.json()`: thêm test chặn `RangeError` với giá trị lồng rất sâu (Probe ở trên) và thay `z.json()` bằng kiểm tra giá trị JSON bằng stack tường minh.
  - [ ] Sau khi hình dạng được chốt: chạy lại `.claude/scripts/verify.sh core --build --format` tới `RESULT: PASS`.
- **Ghi chú cho người tiếp theo**
  - Bắt đầu ở `proposeSampleDataInputShape` cuối `packages/core/src/ai/ai-edit-tools.ts`; mọi phần khác của Task 2 đã xanh.
  - Trong worktree agent, `source ~/.nvm/nvm.sh` bị chặn; chạy script với `env PATH=/Users/hominhhoang/.nvm/versions/node/v24.21.0/bin:...` và `git` qua `/usr/bin/git`.

## 2026-10-03 20:10 — core-engineer — Xong

- **Đã làm**
  - Theo quyết định của orchestrator về Vấn đề 22, `proposeSampleDataInputShape` chuyển sang hình dạng dự phòng của Rủi ro 2, Rủi ro 12: `tables: { table, rows: { column, value: string | null }[][] }[]`. Bỏ `z.record`, `z.json()`, `superRefine` duyệt stack và hằng `AI_MAX_SAMPLE_DEPTH`; giới hạn 256 KiB JSON (UTF-8) giữ bằng một `refine`.
  - Test đỏ trước khi sửa: `Tests 5 failed | 93 passed (98)` (hình dạng cũ từ chối dòng dạng mảng cặp). Sau khi sửa: xanh.
  - Test mới hoặc đã sửa: `keeps a __proto__ column name in a sample row` (parse giữ nguyên `column: "__proto__"`, `Object.getOwnPropertyNames(Object.prototype)` không đổi); `rejects a deeply nested sample value without throwing` (mảng lồng 100.000 cấp, `safeParse` trả `success: false`, không ném); `rejects %s as a sample value` (số, boolean, object, mảng); `accepts a null sample value`; giới hạn 100 cặp mỗi dòng, chuỗi 2000 ký tự, tên cột 63 ký tự, khóa thừa trong một ô.
- **File thay đổi**: `packages/core/src/ai/ai-edit-tools.ts`, `ai-edit-tools.test.ts`, `ai-limits.ts`, `index.ts` (cùng các file của lượt trước).
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test (`Tests 2742 passed (2742)`, coverage dòng 97,65 %), build, format đều PASS; `RESULT: PASS`.
  - `ls packages/core/dist/ai/index.js packages/core/dist/ai/index.d.ts`: có đủ.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Áp hình dạng dự phòng (orchestrator quyết định ngày 2026-10-03): Zod 4.6.4 bỏ khóa `__proto__` của `z.record` có chủ đích, và `z.json()` ném `RangeError` khi lồng sâu mà vẫn dưới giới hạn 256 KiB; danh sách cặp cột, giá trị sửa được cả hai.
  - Giữ tên `AI_MAX_SAMPLE_KEYS_PER_ROW` (nay là số cặp cột, giá trị mỗi dòng) để khớp plan và các task khác đang tham chiếu tên này.
  - Bỏ `AI_MAX_SAMPLE_DEPTH`: giá trị chỉ là chuỗi hoặc null nên không lồng được, hằng không còn chỗ dùng.
  - Không kiểm cột trùng trong một dòng ở hình dạng: đó là việc của bước dịch sang `SeedRow` (Task 8).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 8 (`buildAiSampleDataset`) đọc `rows` dạng mảng cặp và dịch `value` (chuỗi hoặc null) sang `SeedRow` theo bảng "Biểu diễn JSON" của spec phần 6; spec-writer đang sửa Task 8, 16 và spec song song.
  - `AiSampleDataInput` lấy từ `z.infer`, nên tự theo hình dạng mới.
