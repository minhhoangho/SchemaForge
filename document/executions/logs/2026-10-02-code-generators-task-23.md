# Task 23: CG-06 Mock API (handler MSW 2)

- Plan: [Task 23](../../plans/2026-09-15-code-generators-plan.md#task-23-cg-06-mock-api-handler-msw-2)
- Spec: [CG-06](../../specs/2026-09-14-code-generators-design.md#cg-06-mock-api-rest)

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Thêm subpath `@schemaforge/core/generators/mock-api` (qua pattern `./generators/*` sẵn có): `index.ts` chỉ export `generateMockApi` và type `MockApiOptions`.
  - `generateMockApi` (dạng const `Generate<"mock-api">`, không có tham số option) in một file `handlers.ts` (`language: "typescript"`): comment đầu file cố định ghi `msw@^2`, `import { http, HttpResponse } from "msw";`, helper `type Row`, `isRow`, `hasKey` (chỉ khi có bảng có khóa chính), một block `const rows<TypeName>: Row[]` cho mỗi bảng theo `sortTables`, rồi `export const handlers = [...]`. Schema rỗng chỉ có comment và `export const handlers = [];`.
  - Dữ liệu lấy từ `buildSeedDataset(schema, { rowsPerTable: MOCK_ROWS_PER_TABLE (5), seed: MOCK_SEED (1) })`, import thẳng `../seed/build-seed-dataset.js`. Diagnostic của seed được chuyển tiếp; thêm `custom-type-unmapped` và `table-without-identifier`; gộp bằng `finalizeDiagnostics`.
  - `renderJsValue` (`render-js-value.ts`) ghi giá trị JSON thành biểu thức JS, khóa object qua `formatPropertyKey` (`__proto__` thành `["__proto__"]`).
  - `renderResourceHandlers` (`mock-api-handlers.ts`) sinh các phần tử của mảng `handlers`: GET/POST trên đường dẫn danh sách; GET/PUT/DELETE trên đường dẫn dòng chỉ khi có khóa chính; 400/404/409/201/204 đúng plan.
  - RED: ba file test chạy trước khi có code, fail với `Error: Cannot find module './render-js-value.js'` (tương tự `./mock-api-handlers.js`, `./generate-mock-api.js`). GREEN: ba file `RESULT: PASS`.
- **File thay đổi** (đều tạo mới)
  - `packages/core/src/generators/mock-api/index.ts`, `generate-mock-api.ts`, `generate-mock-api.test.ts`, `render-js-value.ts`, `render-js-value.test.ts`, `mock-api-handlers.ts`, `mock-api-handlers.test.ts`
  - Snapshot `packages/core/src/generators/__snapshots__/mock-api/{sample,naming-edge,target-limit,empty}.ts` và `.diagnostics.txt` tương ứng (đã đọc lại, khớp spec).
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 1703/1703 pass, coverage dòng 98.32%, build, prettier).
  - `pnpm --filter @schemaforge/backend exec node --input-type=module -e '…generateMockApi(testing.createSampleSchema(), {}).file.fileName…'`: in `function handlers.ts`, subpath chỉ export `generateMockApi`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Kiểm tra thủ công ngoài repo (thư mục scratchpad, không commit): typecheck cả bốn snapshot với `msw` 2.15.0 + TypeScript 6.0.3 ở chế độ `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noUnusedLocals`: không lỗi (kể cả `export const handlers = [];`). Chạy `sample.ts` bằng `setupServer` của `msw/node`: GET danh sách 200, GET dòng 200/404, POST 409 (khóa đã có, so `String`), 400 (body là mảng), 201, PUT 200 giữ khóa của dòng cũ, DELETE 204 rồi 404, khóa ba cột của `order-items` khớp.
- **Quyết định**
  - Tên biến trong code sinh ra: tham số callback `candidate`, dòng tìm được `stored`, dòng mới khi PUT `replacement`, để không che biến và không cần `!`/`as` dưới `noUncheckedIndexedAccess` (dùng `find` + `indexOf` thay vì truy cập theo chỉ số).
  - PUT ghi `{ ...body, <formatPropertyKey(cột khóa)>: stored[<JSON.stringify(cột khóa)>] }`: khóa computed cho `__proto__` nên tạo thuộc tính riêng thay vì đổi prototype.
  - Mảng tên cột khóa ghi `["a", "b"]` (mỗi phần tử qua `JSON.stringify`, nối `, `) thay vì `JSON.stringify(mảng)` để đồng dạng với mảng tham số `[params["a"], params["b"]]`.
  - Bảng bị seed bỏ: một dòng `const rowsX: Row[] = [];`; dòng seed không có cột nào (mọi cột lấy mặc định): `{},`.
  - `keyColumnNames` lấy theo `resource.keyParameters` (đã theo thứ tự `primaryKeyColumnIds`) để luôn khớp số tham số đường dẫn.
  - Thêm một test ngoài danh sách plan, `writes an empty array for a table the seed skips`, vì quy tắc "bảng bị seed bỏ có mảng rỗng" cần test riêng.
  - Code sinh ra không được Prettier định dạng (dòng dài); output vẫn hợp lệ, typecheck được.
- **Việc còn lại**: không có. Typecheck và gọi route bằng `msw/node` trong `packages/codegen-conformance/src/mock-api.test.ts` thuộc Task 31.
- **Ghi chú cho người tiếp theo**
  - `hasKey` so bằng `String()`: khóa kiểu `json` so theo dạng chuỗi (`[object Object]`), giới hạn đã biết; Task 31 tránh bảng có khóa `json`.
  - Không tạo hay sửa `seed/index.ts` (thuộc Task 22).
