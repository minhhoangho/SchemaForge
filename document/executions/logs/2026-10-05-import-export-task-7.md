# Task 7: IE-04 importer JSON

- Plan: [Task 7](../../plans/2026-10-03-import-export-plan.md#task-7-ie-04-importer-json)
- Spec: [mục 8 "Import (IE-04)", mục 1, mục 13, mục 15](../../specs/2026-09-15-import-export-design.md)

## 2026-10-05 18:30 — core-engineer — Xong

- **Đã làm**
  - `locateJsonSyntaxError(source: string): SourceLocation | null`: một lượt quét theo ngữ pháp RFC 8259 với stack ngoặc tường minh (không đệ quy), máy trạng thái `value | value-or-close | key | key-or-close | colon | comma-or-close | end`; trả vị trí ký tự đầu tiên sai (hoặc độ dài nguồn khi văn bản hết sớm) qua `createLineStarts`/`toSourceLocation`; `null` khi hợp lệ. Không đọc thông báo của `SyntaxError`.
  - `importJson: Importer`: `checkSourceLength` → `JSON.parse` trong `try` (lỗi thì `syntax-error` tại `locateJsonSyntaxError`) → `parseSchemaDocument` (mỗi `StructuralError` thành diagnostic giữ `code`, `path`, `location: null`, qua `finalizeImportDiagnostics`) → `countDocumentElements` > `MAX_IMPORTED_ELEMENTS` thì `too-many-elements` → thành công trả tài liệu nguyên vẹn, `diagnostics: []`.
  - `src/importers/json/index.ts` chỉ re-export `importJson`; subpath `@schemaforge/core/importers/json` hoạt động (`dist/importers/json/index.js` có sau build).
  - TDD: RED cả hai file test là `Cannot find module './locate-json-syntax-error.js'` / `'./import-json.js'`. GREEN lần đầu của `import-json.test.ts` đỏ hai test giới hạn phần tử vì nguồn thụt lề 20 000 ghi chú vượt `MAX_IMPORT_SOURCE_LENGTH` (`source-too-large`); sửa test dùng JSON gọn (`JSON.stringify`), không sửa code.
- **File thay đổi** (đều mới)
  - `packages/core/src/importers/json/index.ts`
  - `packages/core/src/importers/json/import-json.ts`, `import-json.test.ts`
  - `packages/core/src/importers/json/locate-json-syntax-error.ts`, `locate-json-syntax-error.test.ts`
  - API công khai: thêm subpath `@schemaforge/core/importers/json` export `importJson: Importer`. Không sửa `src/index.ts`.
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3202 test pass, coverage dòng 97.74%, build, prettier). Hai file mới phủ 100% câu lệnh và nhánh (`coverage/clover.xml`).
  - `ls packages/core/dist/importers/json/index.js`: có.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - `git status --porcelain`: chỉ `packages/core/src/importers/json/` và log này.
- **Quyết định**
  - `importJson` khai báo `export const importJson: Importer = (source) => …` thay vì `function importJson(source, options)`: tham số `options` không dùng bị lint `no-unused-vars` chặn; kiểu `Importer` giữ đúng chữ ký gọi `(source, options) => ImportResult` của plan mà không cần tắt rule, và ghim việc tuân thủ hợp đồng chung.
  - `index.ts` chỉ export `importJson` (spec mục 1 "Entry point"); `locateJsonSyntaxError` là nội bộ. Không có `index.test.ts`, giống `generators/*/index.ts`.
  - Lỗi `source-too-large`, `too-many-elements` dùng nguyên `checkSourceLength`, `tooManyElementsFailure` của Task 2 (một diagnostic, đã ở dạng cuối); diagnostic do task này dựng (cú pháp, cấu trúc) đi qua `finalizeImportDiagnostics` (cú pháp là một phần tử nên không cần).
  - BOM ở đầu nguồn bị báo `syntax-error` tại `{ line: 1, column: 1 }`, khớp `JSON.parse` (BOM không phải khoảng trắng JSON); frontend bỏ BOM khi giải mã (spec mục 13).
  - Test thêm ngoài danh sách plan: các dòng lỗi phụ (literal sai, số `01`, `1.`, `1e+`, `-`, khóa không phải chuỗi, thiếu `:`, ngoặc đóng sai loại, `]` ở gốc, BOM, `\u` sai, nguồn rỗng), `returns the document unchanged with no diagnostics`, `accepts a source exactly at the limit`, `accepts exactly the maximum number of elements`, và property test fast-check (`PROPERTY_SEED`, `PROPERTY_RUNS`): chèn một ký tự vào `fc.json()`, bộ định vị trả `null` đúng khi `JSON.parse` thành công.
  - Khóa gốc `__proto__` được `parseSchemaDocument` hiện có từ chối với `invalid-shape` tại `["__proto__"]` (object strict của Zod), khóa `__proto__` trong map `tables` với `invalid-shape` tại `["tables", "__proto__"]`; không cần xử lý riêng trong importer.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 17 không cần export gì từ thư mục này ở entry chính (spec mục 1: `importJson` chỉ ở subpath).
  - Task 18 (property test mọi importer) gọi `importJson` qua `index.ts`; Task 19 (benchmark) dùng nguồn `serializeSchemaDocument(createLargeSchema())`.
  - Nguồn thụt lề 2 dấu cách của khoảng 20 000 phần tử vượt 2 MiB, nên `too-many-elements` thực tế chỉ gặp với JSON gọn hoặc tài liệu nhiều phần tử nhỏ.
