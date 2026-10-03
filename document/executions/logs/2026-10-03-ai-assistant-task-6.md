# Core `describeSchemaForAi`, `describeAiChanges`

- Plan: [Task 6](../../plans/2026-10-03-ai-assistant-plan.md) (mục "Task 6: `describeSchemaForAi`, `describeAiChanges`")
- Spec: [ai-assistant-design](../../specs/2026-10-02-ai-assistant-design.md) (AI-R16, AI-R30, mục 5 "Vì sao `AI_MAX_SCHEMA_PROMPT_LENGTH` là 80.000")

## 2026-10-03 20:30 — core-engineer — Xong

- **Đã làm**
  - `describeSchemaForAi(schema): AiSchemaView`: view chỉ có tên theo AI-R30, thứ tự `sortEnums`, `sortTables` (cột theo `columnIds`, index theo `sortIndexes`), `sortRelations`; bỏ id, vị trí, subject area, ghi chú và trường mang giá trị mặc định. `type`: `varchar(255)`, `char(2)`, `decimal(10,2)`, `enum <tên qua formatAiName>`, `custom <tên nguyên văn>`, kind khác là tên kind. `default`: literal, `CURRENT_TIMESTAMP`, `UUID()`. `from`, `to` dạng `<bảng>(<cột>,…)` với tên qua `formatAiName` (helper `describeRelationEndpoint`, dùng chung với `describeAiChanges`).
  - `describeAiChanges(before, after): readonly string[]` dựng từ `diffSchemas`: `renamed schema to X` trước, rồi bảng, cột, quan hệ, index, enum; trong mỗi loại theo thứ tự `added`, `changed`, `removed`. Thêm và đổi lấy tên từ `after`, xóa lấy tên từ `before`. Cột `bảng.cột`, quan hệ `from -> to`, index `<tên> on <bảng>`. Không có id.
  - `src/ai/index.ts` thêm export Task 3 (`createAiTablePlacement`, `AiTablePlacement`, `describePathForAi`, `AI_TABLES_PER_ROW`, `AI_TABLE_GRID_STEP_X`, `AI_TABLE_GRID_STEP_Y`) và Task 6 (`describeSchemaForAi`, `AiSchemaView`, `describeAiChanges`); giữ nguyên export của Task 2.
  - TDD: RED là `Cannot find module './describe-schema-for-ai.js'` và `'./describe-ai-changes.js'`; lần chạy đầu sau khi cài đặt, test độ dài đỏ: `expected 70.40866666666666 to be less than or equal to 60`; làm view gọn thêm (bỏ `nullable` khi `false`) thì xanh.
- **Số đo độ dài** (`JSON.stringify(describeSchemaForAi(schema)).length`, trước escape):
  - `createLargeSchema({ tableCount: 75 })` (1.500 cột): bản đúng phác thảo AI-R30 (`nullable` luôn có) 105.613 ký tự, **70,41 ký tự/cột** → vượt 60. Bản gọn (bỏ `nullable` khi `false`): **81.524 ký tự, 54,35 ký tự/cột**.
  - `createLargeSchema({ tableCount: 100 })` (2.000 cột): 108.776 ký tự, 54,39 ký tự/cột.
  - Fixture lớn nhất vừa `AI_MAX_SCHEMA_PROMPT_LENGTH` (80.000): `tableCount: 73` (1.460 cột) dài 79.367; `tableCount: 74` dài 80.482 (vượt). Dùng cho Task 9 (Vấn đề 21). Lưu ý con số giới hạn thật đo sau escape và cộng khối `<issues>` (Vấn đề 43); fixture này không có `<`.
  - `createSampleSchema()`: 2.554 ký tự.
- **File thay đổi**
  - Tạo `packages/core/src/ai/describe-schema-for-ai.ts`, `describe-schema-for-ai.test.ts`, `describe-ai-changes.ts`, `describe-ai-changes.test.ts`.
  - Sửa `packages/core/src/ai/index.ts` (chỉ thêm export).
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/ai/describe-schema-for-ai.test.ts` và `... describe-ai-changes.test.ts`: đỏ trước khi cài đặt (thiếu module).
  - `pnpm --filter @schemaforge/core exec vitest run src/ai/describe-schema-for-ai.test.ts -u`: ghi inline snapshot trên `createSampleSchema()`, đã đọc lại khớp AI-R30.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS`; 2.855 test pass; coverage dòng toàn core 97,61% (không có dòng "does not meet global threshold"); `src/ai` 96,71%.
  - Đo độ dài bằng script tạm trong scratchpad (import `dist/ai`, `dist/testing`), không để lại file trong repo.
- **Quyết định**
  - **Lệch phác thảo AI-R30:** `nullable` thành `nullable?: true` (bỏ khi `false`), giống `unique`, `autoIncrement`. Lý do: plan bảo test 60 ký tự đỏ thì làm view gọn thêm, không nới con số (spec mục 5); bỏ `"nullable":false,` là thay đổi nhỏ nhất đủ đưa 70,41 xuống 54,35. Chỉ dẫn hệ thống (Task 15) phải nêu: thiếu `nullable` nghĩa là NOT NULL. Cần ghi lại vào spec AI-R30.
  - `enum <tên>` cho tên enum qua `formatAiName` (là tham chiếu tên, như `from`, `to`); `custom <tên>` giữ nguyên văn vì là biểu thức kiểu SQL (ví dụ `geometry(Point, 4326)`), không phải định danh.
  - Trường `name`, `primaryKey`, `columns` của index và `values` của enum là chuỗi JSON nguyên văn (JSON tự escape); chỉ chuỗi ghép (`from`, `to`, `type` của enum, câu của `describeAiChanges`) dùng `formatAiName`.
  - Trong một loại, `describeAiChanges` xếp `added`, `changed`, `removed`; mỗi danh sách giữ thứ tự của `diffSchemas`.
  - Khóa JSON `nullable`, `unique`, `autoIncrement` do AI-R30 chốt nên tắt `@typescript-eslint/naming-convention` cho khối type view bằng cặp `eslint-disable`/`eslint-enable` có mô tả (không sửa config lint).
  - Không export `formatAiName`, `aiTablePosition`, `find*ByName` từ subpath: không có trong danh sách export của Task 6.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 15: chỉ dẫn hệ thống mô tả dạng gọn: thiếu `nullable`/`unique`/`autoIncrement` là `false`, thiếu `default` là không có mặc định, thiếu `comment` là rỗng. Một literal mặc định đúng bằng chuỗi `CURRENT_TIMESTAMP` hoặc `UUID()` trông giống mặc định hàm (spec chấp nhận dạng này).
  - Các dòng không phủ trong hai file mới là nhánh `never` và nhánh tham chiếu treo, không tới được trên tài liệu đã parse.
