# Task 3: `serializeSchemaDocument` và `toComparableSchema`

- Plan: [Task 3](../../plans/2026-10-03-import-export-plan.md#task-3-serializeschemadocument-và-tocomparableschema)
- Spec: [mục 8 "Export (IE-06)" và mục 15 "So sánh tương đương"](../../specs/2026-09-15-import-export-design.md)

## 2026-10-05 17:05 — core-engineer — Xong

- **Đã làm**
  - `serializeSchemaDocument(document: SchemaDocument): string`: khóa gốc và trường của mọi phần tử, object lồng (`position`, `type`, `defaultValue`, cặp cột) theo danh sách khóa tường minh `SERIALIZED_FIELD_ORDER`; phần tử trong map sắp theo id bằng `<`; dựng object bằng `Object.fromEntries`, `JSON.stringify(value, null, 2) + "\n"`. Trường không có trong danh sách thì throw `Error` (lỗi lập trình).
  - `toComparableSchema(document: SchemaDocument): SchemaDocument` (helper test nội bộ, không export qua `@schemaforge/core/testing`): một `createCounterIdGenerator()` cấp id theo thứ tự bảng (`sortTables`), cột (`columnIds` của từng bảng theo thứ tự bảng), enum, subject area, index, quan hệ, ghi chú (nội dung `<`, rồi `x`, `y` cũ); đổi mọi tham chiếu (cột, kiểu enum, PK, subject area, quan hệ, index); mọi `position` thành `{ x: 0, y: 0 }`; khóa map sắp theo id mới.
  - TDD: RED cả hai file test là lỗi `Cannot find module './serialize-schema-document.js'` / `'./to-comparable-schema.js'`; GREEN 32 test (serializer) và 4 test (`toComparableSchema`).
- **File thay đổi**
  - `packages/core/src/model/serialize-schema-document.ts`, `serialize-schema-document.test.ts` (mới)
  - `packages/core/src/testing/to-comparable-schema.ts`, `to-comparable-schema.test.ts` (mới)
  - API công khai: không đổi (`src/index.ts` do Task 17 export `serializeSchemaDocument`).
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3061 test pass, coverage dòng 97.56%, build, prettier).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `.claude/scripts/changed-files.sh`: chỉ bốn file trên (cộng log này).
- **Quyết định**
  - `SERIALIZED_FIELD_ORDER` export từ module (không qua `src/index.ts`) để test ghim từng danh sách với `Object.keys(<shape>.shape)` và từng nhánh union `ColumnType`, `ColumnDefault`; có thêm danh sách `document` ghim với `schemaDocumentShape`.
  - Danh sách khóa union dùng `satisfies Record<kind, …>` để thiếu một `kind` là lỗi biên dịch.
  - Test thứ tự trường dùng một tài liệu viết tay có mọi map và mọi object (cả lồng) theo thứ tự ngược, id `tbl_B`/`tbl_a` để thứ tự code unit khác thứ tự locale; nếu không, `parseSchemaDocument` đã cho thứ tự khai báo và test không bắt được serializer sai.
  - Thêm test `writes an empty document as JSON indented by two spaces` (chuỗi đầy đủ) và `throws when an element has a field the model does not declare` ngoài danh sách của plan, để phủ thụt lề và nhánh throw.
  - Một bộ đếm id chung cho mọi loại phần tử (`tbl_1`, `tbl_2`, `col_3`…), đúng thứ tự plan.
  - **Hàm `sort*` dùng id làm tiêu chí phụ (giữ nguyên theo plan):** `sortTables`, `sortEnums`, `sortSubjectAreas`, `sortIndexes` khi hai phần tử trùng tên chính xác; `sortRelations` khi hai quan hệ cùng bảng khóa ngoại và cùng vị trí cột khóa ngoại đầu tiên. Với các trường hợp này kết quả của `toComparableSchema` phụ thuộc id gốc; fixture round-trip không có hai phần tử chỉ khác id.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Thêm trường vào schema Zod của model thì phải thêm vào `SERIALIZED_FIELD_ORDER` (test `lists the same keys as …` đỏ nếu quên) và vào `toComparableSchema` nếu trường là tham chiếu id.
  - Task 17 export `serializeSchemaDocument` ở entry chính; không export `SERIALIZED_FIELD_ORDER` và `toComparableSchema`.
