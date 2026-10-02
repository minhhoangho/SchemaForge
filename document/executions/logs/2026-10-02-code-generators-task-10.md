# Task 10: Biểu diễn JSON và tài nguyên REST

- Plan: [Task 10](../../plans/2026-09-15-code-generators-plan.md#task-10-biểu-diễn-json-và-tài-nguyên-rest)
- Spec: [Code generators](../../specs/2026-09-14-code-generators-design.md) (mục 3 "Biểu diễn JSON…", mục 5, CG-06, CG-07)

## 2026-10-02 — core-engineer — Xong

- **Đã làm**
  - `json-representation.ts`: `JsonValue`, `JsonFieldType`, `toJsonFieldType` (19 kiểu theo bảng spec mục 3), hằng `SMALLINT_MINIMUM`, `SMALLINT_MAXIMUM`, `BIGINT_STRING_PATTERN`, `TIME_PATTERN`, `LOCAL_DATE_TIME_PATTERN`, `BASE64_PATTERN`, `decimalStringPattern`, `isValidJsonValue` (dùng lại `isValidDefaultLiteral` cho các kiểu chuỗi).
  - `rest-resources.ts`: `RestResource`, `RestKeyParameter`, `RestApiNames`, `buildRestApiNames` (component: enum trước rồi bảng, allocator `exact`/`""`; đoạn đường dẫn: allocator `caseInsensitive`/`"-"`; tham số: mỗi bảng một allocator `exact`/`""` theo `primaryKeyColumnIds`), `formatOpenApiPath`, `formatMswPath`.
  - TDD: chạy test trước khi có module, đỏ với `Cannot find module './json-representation.js'` và `Cannot find module './rest-resources.js'`; sau khi cài đặt cả hai file `PASS`.
- **File thay đổi**
  - `packages/core/src/generators/shared/json-representation.ts` (mới)
  - `packages/core/src/generators/shared/json-representation.test.ts` (mới)
  - `packages/core/src/generators/shared/rest-resources.ts` (mới)
  - `packages/core/src/generators/shared/rest-resources.test.ts` (mới)
  - Không sửa barrel, `src/index.ts` hay `package.json`. Không có thay đổi public API (thư mục `shared/` là nội bộ). Không có snapshot.
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/generators/shared/json-representation.test.ts`: RED (module thiếu) rồi `RESULT: PASS`.
  - `.claude/scripts/test-file.sh core src/generators/shared/rest-resources.test.ts`: RED (module thiếu) rồi `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test (`Tests 1253 passed (1253)`, coverage dòng 97.85%), build, prettier đều PASS; `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - **(Quan trọng)** `decimalStringPattern(p, p)` theo đúng plan: phần nguyên `0+` (nhận `0.5` cho `decimal(2, 2)`), đúng ý spec phần 2 "không kể số 0 ở đầu". Nhưng `isValidDefaultLiteral` hiện giữ lại một số `0` đơn lẻ làm chữ số phần nguyên (`LEADING_ZEROS_PATTERN = /^0+(?=[0-9])/`), nên khi `scale = precision` nó từ chối mọi literal, kể cả `0.5`. Vì vậy với `decimal(p, p)` pattern và `isValidJsonValue` (dùng `isValidDefaultLiteral` theo plan) không khớp nhau. Test "agrees with isValidDefaultLiteral" chỉ gồm các dòng plan liệt kê (không có `p = s`); có thêm test ghim chuỗi pattern của nhánh `0+`. Sửa `default-literals.ts` nằm ngoài phạm vi Task 10 (thư mục `validation/`), cần orchestrator tạo task riêng.
  - Cột khóa chính không có trong `schema.columns` bị bỏ qua khi dựng tham số (`flatMap`), không throw: document đã parse không thể rơi vào nhánh này, và tham số luôn trỏ tới cột có thật.
  - Giới hạn `int32` để private trong `json-representation.ts`: plan chỉ export giới hạn `smallint`; Zod dùng `z.int32()`, OpenAPI dùng `format: int32`.
  - Export thêm type `RestKeyParameter` (plan khai báo inline): một tên cho phần tử `keyParameters`, Task 23, 24 dùng được.
  - `formatOpenApiPath`, `formatMswPath` ghép tên trực tiếp, không escape: đoạn đường dẫn và tham số đã là ASCII `[a-z0-9-]` và định danh camelCase do allocator cấp.
  - Thêm test ngoài danh sách plan: tham số khóa trùng tên nhận hậu tố `2`, chuỗi pattern của từng nhánh `decimalStringPattern`, `TIME_PATTERN`, `BASE64_PATTERN`.
- **Việc còn lại**
  - [ ] (Ngoài phạm vi) Orchestrator quyết định sửa `isValidDefaultLiteral` để `decimal(p, p)` nhận `0.5`, `-0.12`, `0` theo spec phần 2 mục 3; sau đó thêm dòng `decimal(2, 2)` vào test `builds a decimal pattern that agrees with isValidDefaultLiteral`.
- **Ghi chú cho người tiếp theo**
  - `isValidJsonValue` trả `false` cho `null` ở mọi kiểu; người gọi (seed, AI-06) kiểm tra `isNullable` trước.
  - `operationId` (`list<Type>`…) chưa được dựng ở đây; Task 23, 24 ghép từ `typeName`.
