# Task 31: Conformance Mock API, OpenAPI, DBML

- Plan: [Task 31](../../plans/2026-09-15-code-generators-plan.md#task-31-conformance-mock-api-openapi-dbml)
- Spec: [Code generators](../../specs/2026-09-14-code-generators-design.md) (mục 7, dòng CG-06, CG-07, CG-09; R3)

## 2026-10-02 20:05 — core-engineer — Xong

- **Đã làm**
  - `openapi.test.ts`: mỗi fixture `is a valid openapi 3.1 document`. `validate()` của `@readme/openapi-parser` 9.0.0 (export có tên `validate`, kết quả `ValidationResult` là union theo `valid`) nhận object đã `JSON.parse`; test so cả kết quả `{ valid: true, warnings: [], specification: "OpenAPI" }` nên khi sai, diff in ra danh sách lỗi.
  - `dbml.test.ts`: mỗi fixture `parses with @dbml/core` (`new Parser().parse(content, "dbmlv2")` không throw) và `matches the schema`. Test so bản tóm tắt dựng từ `Database` của `@dbml/core` 10.2.0 (`schemas[].tables[].fields[].type.type_name`, `note`, `indexes[]` bỏ index `pk`, `schemas[].refs[].onDelete/onUpdate`, `schemas[].enums[].values[].name`, `schemas[].tableGroups[].tables[].name`, `database.notes[].content`) với bản tóm tắt dựng từ schema qua các hàm `sort*` public của `@schemaforge/core`.
  - `mock-api.test.ts`: mỗi fixture `typechecks with msw` (`typecheckFiles`, msw 2.15.0). Với `sample`, `target-limit` thêm `serves the crud routes of a single-key and a composite-key table`: ghi `handlers.ts` vào thư mục tạm, `import()` động, `setupServer(...handlers)` của `msw/node`, `listen({ onUnhandledRequest: "error" })`, `close()` trong `finally`, rồi chạy chuỗi GET danh sách (200, 5 dòng), GET (200), PUT (200), DELETE (204), GET (404), POST (201), POST (409), POST `[]` (400).
  - Bảng được chọn (đường dẫn lấy từ `paths` của `generateOpenApi`): `sample`: `/tags/{id}` (một khóa, không có cột ngoài khóa) và `/order-items/{tenantId}/{orderNumber}/{lineNumber}` (đổi `quantity`); `target-limit`: `/all-types/{id}` (đổi `smallint_value`) và `/auto-trailing/{a}/{id}` (không có cột ngoài khóa). Cả hai fixture đều có đủ hai loại đường dẫn nên không phần nào bị bỏ qua.
  - Bước đỏ: cả ba file xanh ngay lần chạy đầu (generator của Task 23, 24, 25 không có lỗi bị bắt). Để chắc test bắt được lỗi, đã tạo tạm bốn bản sao test (không commit, đã xóa) sửa output trước khi kiểm tra: OpenAPI đổi `"in": "path"` thành `"in": "body"` → `valid: false` với lỗi `ENUM must be equal to one of the allowed values`; DBML đổi `delete: cascade` thành `delete: restrict` và ` integer` thành ` bigint` → `matches the schema` đỏ đúng ở các hành động và tên kiểu; DBML thêm `Table "x" {` dở → `parses with @dbml/core` đỏ; Mock API thêm `export const broken: number = "a";` → `typechecks with msw` đỏ, và đổi `status: 409`, `status: 204` → test CRUD đỏ.
- **File thay đổi**
  - `packages/codegen-conformance/src/mock-api.test.ts` (mới)
  - `packages/codegen-conformance/src/openapi.test.ts` (mới)
  - `packages/codegen-conformance/src/dbml.test.ts` (mới)
  - `document/executions/logs/2026-10-02-code-generators-task-31.md` (mới)
- **Kiểm tra** (Node v24.21.0, ở root worktree)
  - `.claude/scripts/worktree-setup.sh <worktree>`: `RESULT: PASS`.
  - `docker info >/dev/null && echo docker-ok`: `docker-ok`.
  - `pnpm --filter @schemaforge/core build`: thoát mã 0.
  - `pnpm --filter @schemaforge/codegen-conformance exec vitest run src/mock-api.test.ts`: 6 test pass, 1.89s.
  - `pnpm --filter @schemaforge/codegen-conformance exec vitest run src/openapi.test.ts`: 4 test pass, 0.56s.
  - `pnpm --filter @schemaforge/codegen-conformance exec vitest run src/dbml.test.ts`: 8 test pass, 0.77s.
  - `pnpm --filter @schemaforge/codegen-conformance typecheck`, `lint`: thoát mã 0.
  - `pnpm exec prettier --check` ba file test: `All matched files use Prettier code style!`.
  - `pnpm test:conformance` lần 1: 9 file, 71 test pass (gồm probe Docker), 26.8s. Lần 2: `Cached: 3 cached, 3 total`, `FULL TURBO`, 71 test pass.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Giá trị mặc định không được so trong `matches the schema`: plan không liệt kê, và `@dbml/core` đọc mặc định số thành number JavaScript (`9223372036854775807` của `target-limit` thành `9223372036854776000`), nên so chuỗi gốc là không thể từ model trả về.
  - Chuỗi nhiều dòng mà mọi dòng đều bắt đầu bằng khoảng trắng (comment bảng, comment cột, ghi chú) được kỳ vọng là `expect.any(String)`: vẫn kiểm tra có mặt và số lượng (vị trí trong cấu trúc), không so nội dung. Fixture hiện tại không có chuỗi như vậy.
  - Fixture `empty` dùng cùng phép so như các fixture khác thay vì chỉ đếm bảng: tóm tắt duyệt `flatMap` qua `database.schemas`, nên tài liệu rỗng cho cấu trúc rỗng; khẳng định "không có bảng" nằm trong đó.
  - Đường dẫn của bảng tìm được qua component của phản hồi GET (`$ref`) và bảng có tập tên cột bằng tập `properties` của component cùng số cột khóa bằng số tham số; tham số ghép với cột khóa theo thứ tự `primaryKeyColumnIds`. Lý do: tên tham số (`tenantId`) khác tên cột (`tenant_id`) và test không được import nội bộ core.
  - Bảng không có cột ngoài khóa (`tags`, `auto-trailing`) vẫn được chọn theo đúng quy tắc "đường dẫn đầu tiên"; bước PUT gửi lại nguyên dòng và kiểm tra 200 cùng body giữ khóa. Lý do: `target-limit` không có bảng khóa ghép nào có cột ngoài khóa.
  - Giá trị mới ở bước PUT là chuỗi `` `${JSON.stringify(cũ)} changed` ``: luôn khác giá trị cũ dù kiểu gì; handler không kiểm tra kiểu.
  - Thiếu đường dẫn một khóa hoặc khóa ghép ở `sample`, `target-limit` thì test throw thay vì bỏ qua: cả hai fixture hiện có đủ, nên thiếu nghĩa là hồi quy.
  - OpenAPI yêu cầu thêm `warnings: []`: chặt hơn plan một chút, hiện pass.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**
  - Generator của `@schemaforge/core/generators/*` có kiểu `Generate<T>` nên phải gọi với tham số option thứ hai (`{}`) dù đích không có option.
  - Không phát hiện lỗi generator nào ở CG-06, CG-07, CG-09.
