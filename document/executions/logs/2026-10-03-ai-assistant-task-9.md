# Task 9: Property test và benchmark `applyAiEdit`

Plan: [Task 9](../../plans/2026-10-03-ai-assistant-plan.md#task-9-property-test-và-benchmark-applyaiedit). Spec: [AI-R17, AI-R57](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-03 22:45 — core-engineer — Xong (benchmark KHÔNG đạt ngân sách AI-R57, cần orchestrator quyết định)

- **Đã làm**
  - `apply-ai-edit.property.test.ts`: arbitrary sinh lượt 1–15 tool call (`createTable`, `addColumn`, `updateColumn`, `removeColumn`, `removeTable`, `addRelation` ba nhánh `manyToMany` / có `fromColumns` / không `fromColumns`, `addIndex`, `createEnum`). Kế hoạch gọi sinh trước, tên được phân giải theo bản nháp lúc áp (tên có sẵn qua `sortTables`, `sortEnums`, `columnIds`; hoặc tên mới, kể cả `__proto__`, `constructor`, `Users`, `ORDER_STATUS`, `id`). Áp lần lượt bằng `applyAiEdit`, bỏ qua lần gọi bị từ chối như backend, tăng `placedCount` theo `placedTables`. Tài liệu gốc là `createSampleSchema()` (trọng số 3) hoặc schema rỗng (trọng số 1), đi qua `parseSchemaDocument` để bị đóng băng (sửa input thì ném).
  - Ba test (seed `PROPERTY_SEED`, `numRuns: 100`): `generates only tool inputs that pass their tool input shapes`; `applies every accepted call of a random turn to the original document without new issues` (batch áp được lên gốc, bằng bản nháp cuối, `findIntroducedIssues` rỗng); `restores the original document with the inverse of the turn batch` (so bằng `toStrictEqual`, chặt hơn `toEqual` của plan).
  - Thống kê đo tạm (đã xóa khỏi file): 83/100 lượt có ít nhất một lần gọi được chấp nhận, 318 operation được chấp nhận; theo tool: `createEnum` 85, `createTable` 44, `addIndex` 43, `removeTable` 41, `removeColumn` 26, `updateColumn` 23, `addColumn` 20, `addRelation` manyToMany 17, không `fromColumns` 17, có `fromColumns` 2.
  - Kiểm tra đột biến: thay `inverse` bằng batch rỗng thì property thứ ba đỏ ngay ở lần chạy 1 (đã hoàn nguyên). Đây là task chỉ thêm test trên mã đã merge, nên không có pha đỏ của TDD theo nghĩa thông thường.
  - `apply-ai-edit.bench.ts` theo khuôn `generators.bench.ts` (fixture `bench` của Vitest 5, một `test` gọi `bench.compare` bốn bench). `tableCount` tìm ở đầu file: lớn nhất mà `JSON.stringify(describeSchemaForAi(...)).length ≤ 80_000` → **73**. Đầu file kiểm tra cả bốn edit đều được chấp nhận (bị từ chối thì ném, vì khi đó chỉ đo tra tên).
- **File thay đổi**
  - `packages/core/src/ai/apply-ai-edit.property.test.ts` (tạo)
  - `packages/core/src/ai/apply-ai-edit.bench.ts` (tạo)
  - `document/executions/logs/2026-10-03-ai-assistant-task-9.md` (tạo)
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/ai/apply-ai-edit.property.test.ts`: PASS (3 test).
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS`; 3004 test pass; coverage dòng 97.61%.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `pnpm --filter @schemaforge/core exec vitest bench --run src/ai/apply-ai-edit.bench.ts --reporter=verbose` (reporter mặc định không in bảng khi pass). Máy Apple M1 Pro, Node 24.21.0, đơn vị ms, ngân sách p99 ≤ 25:

    | Bench | Lần 1 p75 | Lần 1 p99 | Lần 2 p75 | Lần 2 p99 | min (lần 2) |
    |---|---|---|---|---|---|
    | addColumn | 26.99 | 41.42 | 29.44 | 77.12 | 25.38 |
    | updateColumn | 26.09 | 28.28 | 27.39 | 42.81 | 25.06 |
    | createTable | 32.13 | 57.74 | 28.77 | 32.25 | 26.33 |
    | addRelation (không `fromColumns`) | 28.08 | 55.02 | 27.60 | 59.85 | 25.12 |

    Lần 1: load average 37 (máy rất bận). Lần 2 chạy riêng: load average 17.8 / 9.4 / 6.2. **Cả bốn bench vượt 25 ms ở mọi cột, kể cả `min`**, nên không phải nhiễu.
  - Đo phân rã tạm (đã xóa khỏi file) trên cùng fixture: `applyOperation` updateColumn p75 0.25 ms; `validateSchema` một lần min 12.0 ms, p75 30.6 ms; `findIntroducedIssues` min 24.5 ms, p75 41.5 ms. Gần như toàn bộ thời gian là `findIntroducedIssues`, vốn kiểm tra toàn bộ tài liệu hai lần (trước và sau).
- **Quyết định**
  - `tableCount` tìm bằng vòng tăng dần từ 2 ở đầu file (73 lần dựng fixture, khoảng 1 giây), không cứng 73, để fixture tự theo khi view đổi.
  - Hằng `SCHEMA_PROMPT_LENGTH_LIMIT = 80_000` khai báo trong file bench vì core không import được `@schemaforge/api-contract`; comment ghi cùng giá trị với `AI_MAX_SCHEMA_PROMPT_LENGTH`.
  - Bench không assert thời gian (khuôn `generators.bench.ts`); ngân sách đọc từ cột `p99` theo Vấn đề 49.
  - Trọng số trong arbitrary (tham chiếu có sẵn 9:1, giá trị mặc định cột null hoặc bỏ 3:1, cột không null 3:1, nhánh `fromColumns` chọn cột cùng kind với khóa đích) để đa số lần gọi tới được `applyOperation`, thay vì phần lớn dừng ở `table-name-not-found`.
  - Ba property thay vì hai: thêm property kiểm tra mọi input sinh ra qua `aiEditToolInputShapes` (bảo đảm "input tool hợp lệ").
  - File property test 425 dòng (vượt khoảng 300) vì task chỉ sở hữu hai file; các file test cùng thư mục cũng dài hơn (`apply-ai-edit.test.ts` 861 dòng).
- **Việc còn lại**
  - [ ] Orchestrator quyết định cách xử lý AI-R57: p99 (và cả min) của `applyAiEdit` trên `createLargeSchema({ tableCount: 73 })` khoảng 25–77 ms, vượt 25 ms. Theo spec: hạ `AI_MAX_TOOL_CALLS_PER_TURN` (30) hoặc `AI_MAX_SCHEMA_PROMPT_LENGTH` (80.000), không nới ngân sách. Phương án khác cần spec mới: tối ưu `findIntroducedIssues` (ví dụ chỉ kiểm tra lại phần tử bị operation chạm tới, hoặc dùng lại issue của tài liệu trước trong cùng lượt) vì nó chiếm gần toàn bộ thời gian. Sau khi đổi, chạy lại `pnpm --filter @schemaforge/core exec vitest bench --run src/ai/apply-ai-edit.bench.ts --reporter=verbose` và ghi `p75`, `p99`.
- **Ghi chú cho người tiếp theo**
  - Cần `--reporter=verbose` để thấy bảng bench.
  - Không có bug chức năng: cả ba property pass; mọi lần gọi được chấp nhận ghép lại áp được lên tài liệu gốc, không thêm issue, và inverse trả đúng tài liệu gốc.
