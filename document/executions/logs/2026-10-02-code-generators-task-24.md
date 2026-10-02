# Task 24: CG-07 OpenAPI 3.1

- Plan: [Task 24](../../plans/2026-09-15-code-generators-plan.md#task-24-cg-07-openapi-31)
- Spec: [CG-07](../../specs/2026-09-14-code-generators-design.md#cg-07-openapi--swagger)

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - Viết test trước cho `openapi-schemas`, `openapi-paths`, `generate-openapi`; RED: `.claude/scripts/test-file.sh core src/generators/openapi/<file>.test.ts` → `Error: Cannot find module './openapi-schemas.js'` (tương tự `./openapi-paths.js`, `./generate-openapi.js`).
  - Cài `generateOpenApi` (subpath `@schemaforge/core/generators/openapi`), in `openapi.json` OpenAPI 3.1.1: `info`, `servers: [{ url: "/api" }]`, `paths` CRUD theo `rest-resources.ts`, `components.schemas` (enum trước bảng). GREEN: cả ba file test pass.
  - Ghi snapshot cho bốn fixture và đối chiếu với spec: nullable `type: [T, "null"]`, enum nullable `anyOf`, `{}` cho `json`/`custom`, `description` từ comment, tham số đường dẫn không nullable, 409 chỉ khi có khóa chính.
- **File thay đổi**
  - `packages/core/src/generators/openapi/index.ts`, `generate-openapi.ts`, `generate-openapi.test.ts`, `openapi-schemas.ts`, `openapi-schemas.test.ts`, `openapi-paths.ts`, `openapi-paths.test.ts` (mới).
  - `packages/core/src/generators/__snapshots__/openapi/{sample,naming-edge,target-limit,empty}.{json,diagnostics.txt}` (mới). Diagnostic: `sample` có 1 `custom-type-unmapped`; `target-limit` có 3 `custom-type-unmapped` và 2 `table-without-identifier`; `naming-edge`, `empty` không có.
  - API công khai: subpath mới `@schemaforge/core/generators/openapi` export `generateOpenApi` và type `OpenApiOptions` (qua pattern `./generators/*` có sẵn, không sửa `package.json`).
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format` → `RESULT: PASS` (typecheck, lint, test 1444/1444, build, prettier). Coverage dòng toàn core 98.12%; thư mục `generators/openapi` 98.78%.
  - `pnpm --filter @schemaforge/backend exec node --input-type=module -e '…generateOpenApi(testing.createSampleSchema(), {}).file.fileName'` → `function openapi.json`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Generator không có option nên viết dạng `Generate<"openapi">` bỏ tham số thứ hai, theo mẫu Task 19 (tránh `no-unused-vars`).
  - Thêm hai hàm nội bộ không export qua `index.ts`: `buildComponentSchemas(schema, names)` và `buildPaths(schema, names)`, mỗi hàm trả `{ schemas | paths, diagnostics }`, vì `buildPropertySchema`/`buildPathItems` chỉ trả JSON mà test `reports custom-type-unmapped…` và `…reports table-without-identifier` cần diagnostic ở đúng module đó.
  - `buildPropertySchema` trả `JsonObject` (`Readonly<Record<string, JsonValue>>`), hẹp hơn `JsonValue` trong chữ ký của plan nhưng gán được cho `JsonValue`; cần kiểu object để thêm `description` và bọc nullable.
  - `required` khử trùng tên cột (giữ thứ tự lần đầu) vì JSON Schema 2020-12 yêu cầu phần tử `required` duy nhất; tên cột trùng là issue ngữ nghĩa, không chặn sinh code. Fixture hiện không có trường hợp này.
  - Tham số đường dẫn: `buildPropertySchema({ ...column, isNullable: false })`, nên giữ `description` từ comment của cột khóa (hợp lệ trong schema tham số).
  - "Bảng có khóa chính" xác định bằng `resource.keyParameters.length > 0` (dùng chung cho đường dẫn dòng, 409 và `table-without-identifier`).
  - Nội dung file ghép qua `renderFileContent([[JSON.stringify(document, null, 2)]])`, cho kết quả trùng `JSON.stringify(…) + "\n"` của plan và giữ quy ước chung "output qua `renderFileContent`".
  - Escape: mọi tên, comment, giá trị enum đi qua `JSON.stringify` của cả tài liệu (đúng cách escape cho đích JSON); khóa từ tên người dùng dựng bằng `Object.fromEntries`. `$ref` ghép tên component PascalCase ASCII từ `buildRestApiNames`, không chứa `~` hay `/` nên không cần escape JSON Pointer.
  - Mô tả response cố định tiếng Anh (`OK`, `Created`, `No Content`, `Bad Request`, `Not Found`, `Conflict`) theo plan.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Tên cột dạng số nguyên (ví dụ `"1"`) sẽ đứng đầu `properties` do quy tắc thứ tự khóa của JavaScript; output vẫn xác định và `required` giữ thứ tự cột.
  - Task 31 chạy `@readme/openapi-parser` trên bốn fixture; nếu validator báo lỗi thì sửa generator, không nới test.
  - Dòng 34 của `openapi-paths.ts` (cột khóa không tìm thấy) là nhánh phòng thủ không đạt được với tài liệu đúng cấu trúc.
