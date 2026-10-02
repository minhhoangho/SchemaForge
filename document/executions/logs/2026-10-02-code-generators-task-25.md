# Task 25: CG-09 DBML

Plan: [Task 25](../../plans/2026-09-15-code-generators-plan.md#task-25-cg-09-dbml). Spec: [CG-09](../../specs/2026-09-14-code-generators-design.md#cg-09-dbml).

## 2026-10-02 19:46 — core-engineer — Xong

- **Đã làm**
  - Viết test trước (`dbml-strings.test.ts`, `generate-dbml.test.ts`), chạy thấy đỏ vì chưa có module, rồi cài đặt.
  - `dbml-strings.ts`: `quoteDbmlIdentifier` (`\` → `\\`, `"` → `\"`), `dbmlString` (một dòng: `'…'`; có `\r` hoặc `\n`: `'''…'''`).
  - `generate-dbml.ts`: `generateDbml` (const `Generate<"dbml">`, không có option) in `schema.dbml` theo thứ tự `Project`, `Enum`, `Table`, một block `Ref`, `TableGroup`, `Note`; diagnostic duy nhất là `default-omitted`.
  - `index.ts` chỉ export `generateDbml` và type `DbmlOptions`.
  - Snapshot bốn fixture trong `src/generators/__snapshots__/dbml/`; đã đọc lại và parse cả bốn file bằng `@dbml/core` 10.2.0 (cài trong `packages/codegen-conformance`) bằng script tạm ngoài repo: `sample`, `naming-edge`, `target-limit`, `empty` đều parse không lỗi.
- **File thay đổi**
  - `packages/core/src/generators/dbml/index.ts`, `generate-dbml.ts`, `generate-dbml.test.ts`, `dbml-strings.ts`, `dbml-strings.test.ts` (mới)
  - `packages/core/src/generators/__snapshots__/dbml/{sample,naming-edge,target-limit,empty}.dbml` và `.diagnostics.txt` tương ứng (mới; cả bốn diagnostics là `(none)`)
- **Kiểm tra**
  - RED: `.claude/scripts/test-file.sh core src/generators/dbml/dbml-strings.test.ts` và `…/generate-dbml.test.ts` → `Error: Cannot find module './dbml-strings.js'` / `'./generate-dbml.js'`, `RESULT: FAIL`.
  - GREEN: cùng hai lệnh → `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format` → typecheck, lint, test (1787 test pass, coverage dòng 98.29%), build, prettier đều PASS; `RESULT: PASS`.
  - `pnpm --filter @schemaforge/backend exec node --input-type=module -e '…generators/dbml…'` → `function schema.dbml generateDbml`.
- **Quyết định**
  - **(Đáng chú ý, lệch nhẹ khỏi chữ ký trong plan)** Trong `'''…'''`, `dbmlString` escape **mọi** `'` thành `\'` thay vì chỉ `'''` → `\'''`. Lý do: thử với `@dbml/core` 10.2.0, văn bản nhiều dòng kết thúc bằng `'` (ví dụ `"a\nb'"`) theo cách của plan cho `'''a\nb''''` và parser báo `Invalid newline encountered while parsing`; escape từng `'` thì parse đúng (`\'` trong `'''…'''` được nhận, `'''` thành `\'\'\'` vẫn đọc lại là `'''`). Có test riêng cho trường hợp nháy cuối.
  - `renderType` dùng `switch` vét hết mọi kind (không `default`), để kiểu mới của model buộc phải sửa generator này.
  - Mặc định enum, `json`, custom, chuỗi, ngày giờ, uuid ghi bằng `dbmlString`; số và boolean ghi trần, đúng plan.
  - Phần tử trỏ tới cột không tìm thấy (index, khóa chính, quan hệ) bị bỏ qua thay vì ghi danh sách cột thiếu; với tài liệu đã qua `parseSchemaDocument` thì không xảy ra.
  - Thêm một test ngoài danh sách plan: `writes every relation as one line of a single Ref block` và `writes an enum default as a string`, để khóa hai quy tắc của plan không có test nhắm riêng.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 31: `@dbml/core` đọc mặc định số thành `number` của JS, nên `9223372036854775807` (fixture `target-limit`) đọc lại thành `9223372036854776000`; phép so round-trip mặc định số nên so theo chuỗi gốc hoặc bỏ qua độ chính xác của bigint.
  - Bảng không có cột (`table-columns-empty`) và enum rỗng (`enum-values-empty`) bị `@dbml/core` từ chối (`A Table must have at least one column`); output vẫn an toàn, đúng plan.
  - Tên có ký tự xuống dòng (đã là issue `name-invalid`) làm `"…"` không parse được (`Invalid newline encountered while parsing`); plan chỉ escape `\` và `"` cho định danh nên giữ nguyên, không có chèn cú pháp.
  - Giới hạn `'''…'''` (N10, bỏ thụt chung khi parse) không được bù, đúng plan.
