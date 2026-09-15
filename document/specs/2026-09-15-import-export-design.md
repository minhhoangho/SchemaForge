# Import / Export

Spec cho phần 7 trong [roadmap.md](../roadmap.md): importer SQL, Prisma, DBML, JSON trong `packages/core`, cùng giao diện import, tải file, export ảnh và file ZIP ở frontend. Phần này gồm IE-01 đến IE-08 trong [danh sách tính năng](2026-09-14-feature-list-design.md) và trả lời câu hỏi 10 của danh sách đó cùng câu hỏi 3 của [spec phần 2](2026-09-14-core-schema-model-design.md).

Spec dựa trên [spec phần 2](2026-09-14-core-schema-model-design.md), [spec phần 3](2026-09-14-editor-mvp-design.md) và [spec phần 6](2026-09-14-code-generators-design.md), cả ba đã duyệt. Tên type, operation, mã issue, hàm của core, cấu trúc editor và giao diện generator lấy từ các spec đó.

Các đoạn TypeScript là phác thảo. Plan và code tinh chỉnh tên và chi tiết, nhưng không đổi quyết định. Mục ghi ⚠ là lựa chọn cần người dùng xác nhận khi duyệt spec.

Trạng thái: đã duyệt. Người dùng xác nhận các quyết định cần xác nhận: import có hai chế độ, tạo schema mới và gộp vào schema hiện tại, không có chế độ thay thế, tên trùng khi gộp thêm hậu tố `_2`, `_3`… (mục 2); import không dùng chế độ chặt, issue ngữ nghĩa hiện ở bước xem trước và không chặn import (mục 3); export ảnh bằng `modern-screenshot`, theo theme đang hiển thị (mục 10); và `@dbml/core` chỉ được import trong subpath importer (`@schemaforge/core/importers/sql`, `.../dbml`), tải lazy trong Web Worker, không lọt vào entry chính của core hay bundle editor (mục 1).

## Quyết định đã có từ trước

Spec này không bàn lại các điểm sau (nguồn: `architecture.md`, `.claude/rules/`, spec phần 2, 3, 6):

- `@dbml/core` là parser cho cả DBML lẫn SQL của ba dialect PostgreSQL, MySQL, SQL Server. Chưa hỗ trợ SQLite.
- Mọi lần import đi qua operation của core, được validate và undo được.
- File không đọc được thì schema hiện tại giữ nguyên, lỗi rõ ràng, kèm dòng và cột khi có.
- Local-first: import và export chạy hoàn toàn trên trình duyệt, không cần đăng nhập, không gọi server.
- Importer coi input là không tin cậy: không `eval`, giới hạn kích thước input, báo cú pháp không hỗ trợ hoặc sai bằng diagnostic kèm dòng và cột thay vì throw hay âm thầm bỏ qua. Mỗi định dạng một thư mục `importers/<định dạng>/`, có test round-trip khi định dạng cho phép (`core.md`).
- Tài liệu JSON không tin cậy đi qua `parseSchemaDocument`; `batch` lồng tối đa `MAX_BATCH_DEPTH`; importer nhận `GenerateId`; `applyOperation` không sinh id (spec phần 2).
- Model không có view, check constraint, sequence, trigger, cột tính toán, nhiều namespace, chiều sắp xếp và loại index, collation, kiểu mảng chung, màu bảng và nhóm, kích thước ghi chú; importer báo các khái niệm này là không hỗ trợ (spec phần 2, mục Phạm vi). Giá trị mặc định chỉ có literal, `currentTimestamp`, `generateUuid`; default SQL khác được báo là không hỗ trợ (spec phần 2, mục 3).
- Editor: một đường `dispatch`; store theo từng schema; lịch sử chỉ trong bộ nhớ; Dexie DB `schemaforge` với `schemas`, `documents`, `viewports`; CSP nonce với `img-src 'self' blob: data:`, `connect-src 'self'`, `worker-src 'self'` (phần 6 thêm); i18n `vi`, `en` với resource TypeScript có kiểu (spec phần 3).
- Generator trả đúng một `GeneratedFile` (`fileName`, `language`, `content`), chạy trong Web Worker của code panel, mỗi đích một subpath `@schemaforge/core/generators/<đích>`. CG-09 ghi DBML bằng tên kiểu chung của core; round-trip đầy đủ với IE-03 thuộc phần 7 (spec phần 6).
- Không có test chạy trên trình duyệt: mọi test tự động là Vitest (jsdom ở frontend). Test cần Docker chỉ chạy trong CI, trong `packages/codegen-conformance` (spec phần 3, phần 6).

## Tóm tắt quyết định

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Giao diện importer | Hàm thuần `(source, options) => Result<{ document, diagnostics }, { diagnostics }>`, trả một tài liệu độc lập; diagnostic `{ code, location, path }` với dòng, cột bắt đầu từ 1, không có mức độ; mỗi định dạng một subpath `@schemaforge/core/importers/<định dạng>`; giới hạn 2 MiB và 20 000 phần tử |
| 2 | Import vào đâu (câu hỏi 10) | Hai chế độ: tạo schema mới (mặc định) và thêm vào schema hiện tại; không có chế độ thay thế. `buildImportOperation` dựng một `batch` phẳng; khi gộp thì cấp id mới, tên trùng thêm hậu tố `_2`, `_3`… kèm diagnostic. Mỗi lần import là một mục lịch sử |
| 3 | Issue ngữ nghĩa (câu hỏi 3 của phần 2) | Không dùng chế độ chặt; issue mới hiện ở bước xem trước và không chặn import |
| 4 | Vị trí bảng | Lưới xác định trong core, gom theo subject area; kích thước ô lấy từ `LayoutMetrics` do frontend truyền vào |
| 5 | IE-01 SQL | `@dbml/core` kèm statement scanner tự viết để báo câu lệnh bị parser bỏ âm thầm, lấy vị trí, đọc identity của `pg_dump` và comment SQL Server. Bảng ánh xạ kiểu và giá trị mặc định cho ba dialect. Round-trip là điểm bất động của DDL |
| 6 | IE-02 Prisma | Parser tự viết trong core, không dependency. Tên bảng, cột theo `@@map`, `@map`. Round-trip bằng nhau với `postgresql`, điểm bất động với `mysql`, `sqlserver` |
| 7 | IE-03 DBML | `Parser.parse(…, 'dbmlv2')`; `TableGroup` thành subject area, `Note` thành ghi chú; đọc lại văn bản gốc cho kiểu trong nháy và số. Import output của CG-09 cho schema bằng bản gốc |
| 8 | IE-04, IE-06 JSON | `serializeSchemaDocument` với thứ tự khóa theo khai báo và phần tử theo id; import qua `parseSchemaDocument`, giữ id, giống hệt từng byte |
| 9 | IE-05 Tải file | Nút "Tải file" trong code panel; tên file ASCII có option (`blog.mysql.sql`); `Blob`, object URL và `a[download]`, CSP không đổi |
| 10 | IE-07 Ảnh | `modern-screenshot` 4.7.0 chụp DOM của canvas trong khung bao mọi node; PNG thu nhỏ theo giới hạn canvas thay vì cắt; theo theme đang hiển thị; SVG dạng `foreignObject` |
| 11 | IE-08 ZIP | `fflate` 0.8.3, `zipSync` trong worker của code panel; hộp thoại chọn nhiều định dạng; ZIP xác định từng byte |
| 12 | Giao diện | Hộp thoại import ba bước (nguồn, phân tích, xem trước); parse trong worker riêng, hủy được, quá 30 giây thì hủy; đọc UTF-8 và UTF-16 có BOM; menu Export trên toolbar; namespace `importExport`, `importDiagnostics` |
| 13 | Bảo mật | Giới hạn trước khi parse, hủy worker khi quá thời gian, không `eval`, tra cứu theo tên bằng `Map`, giá trị từ file hiện dạng text, tên file ASCII |
| 14 | Test | Test theo mã diagnostic có vị trí; round-trip năm định dạng; property test không throw; frontend trên jsdom; conformance với `pg_dump`, `mysqldump`, `prisma db pull` chỉ chạy trong CI |

## Phiên bản

Kiểm tra ngày 2026-09-15 bằng `npm view` (phiên bản, ngày phát hành, dependency, `exports`), tài liệu qua Context7, và thử nghiệm trong thư mục tạm đã xóa sau khi xong: parse SQL ba dialect và DBML bằng `@dbml/core` 10.1.1, parse Prisma bằng `@mrleebo/prisma-ast` 0.16.0, quét lời gọi `Function` và `eval` trong bundle, đo kích thước bundle trình duyệt bằng esbuild (minify, gzip mức 9). Phiên bản của các gói đã có từ phần 3 và phần 6 giữ nguyên.

| Gói | Phiên bản | Dùng ở | Ghi chú |
|---|---|---|---|
| `@dbml/core` | 10.1.1 | Core, importer SQL và DBML | Apache-2.0. Dependency: `@dbml/parse` 10.1.1, `antlr4`, `lodash`, `lodash-es`, `luxon`, `parsimmon`, `pluralize`. ESM không import module Node. Bundle trình duyệt 15,8 MB, gzip 2,7 MB |
| `fflate` | 0.8.3 | Frontend, ZIP | MIT, không dependency; `zipSync` và `strToU8` 4,4 KB gzip; phát hành 2026-07-20 |
| `modern-screenshot` | 4.7.0 | Frontend, PNG và SVG | MIT, không dependency; 9,7 KB gzip; phát hành 2026-04-16 |
| `@xyflow/react` | 12.11.6 | `getNodesBounds` | Đã có từ phần 3 |
| `prisma` | 7.10.0 | Conformance `prisma validate`, `prisma db pull` | Đã có từ phần 6 |
| `testcontainers` và module PostgreSQL, MySQL | 12.1.0 | Conformance `pg_dump`, `mysqldump` | Đã có từ phần 6 |
| `fast-check` | 4.10.0 | Property test | Đã có từ phần 2 |

Gói đã xem xét và không dùng:

| Gói | Phiên bản | Lý do |
|---|---|---|
| `@mrleebo/prisma-ast` | 0.16.0 | Bản ESM import `os` và `lilconfig` (dùng `fs`, `path`, `os`), không bundle được cho trình duyệt; node AST không có vị trí (mục 6) |
| `@prisma/internals` | 7.10.0 | Gói Node, kéo engine của Prisma; validation cần `@prisma/prisma-schema-wasm` (3,2 MB WebAssembly) và `'wasm-unsafe-eval'` (mục 6) |
| `chevrotain` | 13.2.0 | Thêm dependency cho một ngữ pháp mà parser đệ quy xuống tự viết vẫn gọn (mục 6) |
| `html-to-image` | 1.11.13 | Bản cuối 2025-02-14; tài liệu React Flow khuyên khóa ở 1.11.11 vì các bản sau xuất ảnh sai (mục 10) |
| `client-zip` | 2.5.1 | Không nén (mục 11) |
| `jszip` | 3.10.2 | Kéo `pako`, `readable-stream`, `setimmediate`, `lie` (mục 11) |

## 1. Giao diện importer trong core

### Chữ ký

```ts
type ImportFormat = 'postgresql' | 'mysql' | 'sqlserver' | 'prisma' | 'dbml' | 'json';

type SourceLocation = {
  readonly line: number;   // bắt đầu từ 1
  readonly column: number; // bắt đầu từ 1, đếm theo code unit UTF-16 (chỉ số chuỗi JavaScript + 1)
};

type ImportDiagnostic = {
  readonly code: ImportDiagnosticCode;
  readonly location: SourceLocation | null; // null khi không xác định được vị trí (ví dụ lỗi cấu trúc của JSON)
  readonly path: DocumentPath | null;       // phần tử trong tài liệu kết quả, null khi phần tử bị bỏ
};

type LayoutMetrics = {
  readonly tableWidth: number;    // bề rộng tối đa của node bảng
  readonly headerHeight: number;
  readonly columnRowHeight: number;
  readonly gap: number;
};

type ImportOptions = {
  readonly fallbackSchemaName: string; // dùng khi nguồn không có tên (SQL, Prisma, DBML không có Project)
  readonly generateId: GenerateId;
  readonly layout: LayoutMetrics;      // mục 4
};

type ImportSuccess = { readonly document: SchemaDocument; readonly diagnostics: readonly ImportDiagnostic[] };
type ImportFailure = { readonly diagnostics: readonly ImportDiagnostic[] }; // luôn có ít nhất một

// Mỗi subpath export hàm theo mẫu này: importPostgresql, importMysql, importSqlserver, importPrisma, importDbml, importJson.
type Importer = (source: string, options: ImportOptions) => Result<ImportSuccess, ImportFailure>;
```

- **Importer trả về một tài liệu độc lập**, chưa gắn với schema đang mở. Tài liệu có id mới lấy từ `generateId` (trừ JSON, giữ id của file), vị trí theo mục 4, và đã qua `parseSchemaDocument`. Cách đưa tài liệu này vào schema đích là việc của `buildImportOperation` (mục 2), dùng chung cho mọi định dạng.
- **Hai loại kết quả, không có mức độ.** `Result` lỗi nghĩa là không đọc được nguồn (sai cú pháp, quá lớn), không có tài liệu nào. `Result` thành công có thể kèm diagnostic: tài liệu khác nguồn ở điểm đó (phần tử bị bỏ, kiểu hoặc giá trị mặc định bị đổi). Giống diagnostic của generator ở phần 6, không nơi nào cần rẽ nhánh theo mức độ.
- **Diagnostic** không có thông báo: frontend dịch `code` qua i18n, hiện `dòng:cột` từ `location` và tên phần tử từ `path`. Thứ tự: theo `location` (dòng, rồi cột; `null` đứng cuối), rồi `code`, rồi `path`. Không lặp bộ ba `code`, `location`, `path`. Hằng `IMPORT_DIAGNOSTIC_CODES` được export để frontend kiểm tra đủ bản dịch.
- **Chuẩn hóa vị trí.** Parser SQL của `@dbml/core` 10.1.1 (ANTLR) trả cột bắt đầu từ 0, parser DBML (`@dbml/parse`) trả cột bắt đầu từ 1, còn dòng của cả hai bắt đầu từ 1 (đã thử). Adapter trong `importers/shared/` đổi mọi vị trí về dạng ở trên; test kiểm tra từng parser với lỗi ở cột đầu dòng.
- **Không throw với input bất kỳ.** Mọi chuỗi đều cho `Result`. Ngoại lệ từ thư viện parser (kể cả `RangeError` khi tràn ngăn xếp với input lồng quá sâu) được bắt tại đúng một adapter mỗi thư viện và chuyển thành `parse-failed` không có vị trí. Lỗi do chính importer tạo tài liệu sai cấu trúc là lỗi lập trình, nên throw.
- **Tra cứu theo tên dùng `Map`**, không dùng object thường, để tên như `__proto__`, `constructor` trong nguồn không chạm prototype.

**Phương án bị loại:**

- Importer trả thẳng `batch` áp lên schema đích: mỗi importer phải tự xử lý trùng tên, trùng id và chế độ gộp; test round-trip phải dựng schema đích giả. Tài liệu độc lập so sánh được trực tiếp với tài liệu gốc.
- Diagnostic có `severity`: như phần 6; lỗi chặn đã được phân biệt bằng nhánh `Result`.

### Giới hạn input

| Hằng | Giá trị | Kiểm tra ở | Mã khi vượt |
|---|---|---|---|
| `MAX_IMPORT_FILE_BYTES` (frontend) | 2 MiB (2 097 152 byte) | `File.size` trước khi đọc file; độ dài UTF-8 của văn bản dán vào | Không đọc file, báo lỗi trong hộp thoại |
| `MAX_IMPORT_SOURCE_LENGTH` (core) | 2 097 152 code unit UTF-16 | Đầu mỗi importer, trước khi parse | `source-too-large` |
| `MAX_IMPORTED_ELEMENTS` (core) | 20 000 phần tử (bảng, cột, quan hệ, index, enum, subject area, ghi chú) | Sau khi parse, trước khi dựng tài liệu | `too-many-elements` |

- Giới hạn byte của file luôn chặt hơn giới hạn code unit, vì mỗi code unit UTF-16 ứng với ít nhất một byte UTF-8. Core vẫn tự kiểm tra, vì core không tin nơi gọi.
- 2 MiB gấp khoảng mười lần DDL của schema 200 bảng, 20 cột mỗi bảng (fixture lớn của phần 6). 20 000 phần tử gấp khoảng mười lần fixture hiệu năng của phần 3 (100 bảng, 1 500 cột, 150 quan hệ); vượt nữa thì canvas không còn dùng được và `batch` quá lớn để áp trong thời gian chấp nhận được (mục 14).
- Frontend còn giới hạn thời gian parse bằng cách hủy worker (mục 14).

### Luồng bên trong một importer

```text
source ─▶ kiểm tra độ dài ─▶ parse (thư viện hoặc parser tự viết) ─▶ lỗi cú pháp? ─▶ Result lỗi
                                     │
                                     ▼
                         ImportDraft (nội bộ, theo tên, không có id)
                                     │  đếm phần tử, ánh xạ kiểu và giá trị mặc định, gom diagnostic
                                     ▼
            assembleDocument: cấp id theo thứ tự xác định, xếp vị trí (mục 4), parseSchemaDocument
                                     │
                                     ▼
                           Result thành công { document, diagnostics }
```

- `ImportDraft` là kiểu nội bộ trong `importers/shared/`: bảng với danh sách cột có thứ tự, khóa chính theo tên cột, index, quan hệ, enum, subject area, ghi chú, đều tham chiếu nhau bằng tên. Mỗi adapter định dạng chỉ việc dịch AST sang draft; phần cấp id, xếp vị trí và kiểm tra tham chiếu viết một lần.
- **Tham chiếu theo tên** (cột trong khóa chính, index, quan hệ; enum của cột; bảng trong nhóm) được giải theo tên chính xác trước, rồi theo tên không phân biệt hoa thường nếu chỉ khớp đúng một phần tử (SQL không quote không phân biệt hoa thường). Không giải được thì bỏ phần tử chứa tham chiếu kèm `reference-not-found`, nên tài liệu luôn đúng cấu trúc.
- **Cấp id theo thứ tự xác định:** enum, bảng theo thứ tự xuất hiện trong nguồn, cột theo thứ tự trong bảng, rồi index, quan hệ, subject area, ghi chú. Cùng nguồn và cùng bộ sinh id cho cùng tài liệu, nên test dùng `createCounterIdGenerator`.

### Entry point

| Subpath | Export | Dependency lúc chạy |
|---|---|---|
| `@schemaforge/core/importers/sql` | `importPostgresql`, `importMysql`, `importSqlserver` | `@dbml/core` |
| `@schemaforge/core/importers/dbml` | `importDbml` | `@dbml/core` |
| `@schemaforge/core/importers/prisma` | `importPrisma` | Không có (parser tự viết, mục 6) |
| `@schemaforge/core/importers/json` | `importJson` | Không có |
| Chính (`@schemaforge/core`) | Type ở trên, `IMPORT_FORMATS`, `IMPORT_DIAGNOSTIC_CODES`, `MAX_IMPORT_SOURCE_LENGTH`, `MAX_IMPORTED_ELEMENTS`, `buildImportOperation`, `serializeSchemaDocument` | Không thêm |

- `package.json` của core thêm pattern `"./importers/*"` giống `"./generators/*"` của phần 6. `importers/shared/` không nằm trong `exports`.
- Entry point chính không import `@dbml/core`, nên editor, backend và mọi consumer không dùng importer SQL, DBML không tải thư viện này. Frontend chỉ `import()` subpath trong worker import (mục 12).
- **Zod vẫn là runtime dependency duy nhất của entry chính; `@dbml/core` chỉ là runtime dependency của subpath importer SQL và DBML.** Điều này thay quy tắc cũ "Zod là runtime dependency duy nhất của core" (spec phần 1, phần 2) thành: Zod là runtime dependency của entry chính; `@dbml/core` chỉ được import trong subpath importer. Đối chiếu quy tắc "chỉ thêm dependency khi tự viết rõ ràng tệ hơn": parser SQL cho ba dialect là việc lớn nhất của phần này, và `architecture.md` đã chốt thư viện. Bản ESM của `@dbml/core` không import module Node (đã kiểm tra), nên core vẫn isomorphic. Lời gọi `Function("return this")()` duy nhất trong bundle là nhánh dự phòng của lodash, chỉ chạy khi không có `globalThis`, `self` và `global`, nên không chạy trên trình duyệt, worker hay Node.
- Type của `@dbml/core` có chỗ `any` (`checks?: any[]`). Chỉ hai file `importers/shared/dbml-core-adapter.ts` import thư viện; adapter thu hẹp model thành type hẹp của core, theo quy tắc chứa `any` trong một wrapper của `typescript.md`.

**Phương án bị loại:** đặt importer SQL, DBML ở frontend để core không phụ thuộc `@dbml/core`: trái `core.md` (importer nằm trong core), và backend không dùng lại được importer nếu phần 5 hay phần 8 cần. Một subpath chung `@schemaforge/core/importers`: `import()` importer Prisma hay JSON sẽ kéo cả `@dbml/core` khoảng 2,7 MB gzip.

## 2. Import vào đâu (câu hỏi 10)

### Quyết định

Hộp thoại import có hai chế độ:

| Chế độ | Có ở | Mặc định | Kết quả | Undo |
|---|---|---|---|---|
| **Tạo schema mới** | Màn hình danh sách và editor | Có | Một schema mới trong trình duyệt, tên lấy từ nguồn, mở ngay trong editor | Lịch sử của schema mới bắt đầu bằng đúng một mục là lần import. Undo trả về schema rỗng cùng tên; muốn bỏ hẳn thì xóa schema ở màn hình danh sách |
| **Thêm vào schema hiện tại** | Chỉ trong editor | Không | Phần tử của nguồn được thêm cạnh các phần tử đang có; tên trùng được đổi | Một mục lịch sử; một lần undo xóa mọi phần tử vừa thêm, schema về đúng trạng thái trước import |

Không có chế độ **thay thế** schema hiện tại.

### Tạo schema mới

1. Worker chạy importer, rồi `buildImportOperation(createEmptySchema(tên), imported, { mode: 'new' }, generateId)`, rồi áp thử bằng `applyOperation` để lấy số liệu cho bước xem trước (mục 12).
2. Khi người dùng xác nhận, frontend tạo bản ghi schema với tài liệu rỗng `createEmptySchema(tên)` qua `SchemaRepository`, đặt `{ schemaId, operation }` vào `PendingImportProvider` (state React ở `AppProviders`, còn nguyên khi chuyển trang phía client), rồi chuyển tới `/schemas/<id>`.
3. Editor mount, lấy khóa tab như thường, thấy import đang chờ đúng `schemaId` thì `dispatch(operation)` một lần và xóa mục chờ. Mục lịch sử được ghi và autosave lưu tài liệu như mọi thao tác khác.

- Tên schema: `Project` của DBML, `name` của file JSON; SQL và Prisma không có tên nên dùng tên file bỏ phần mở rộng, dán văn bản thì dùng tên gợi ý đã dịch ("Schema được import"). Người dùng sửa được tên ở bước xem trước.
- Tài liệu JSON giữ nguyên id: schema đích rỗng nên không thể trùng id, và IE-04 yêu cầu giống hệt bản gốc (mục 8).
- Nếu tab bị đóng giữa bước 2 và 3 thì còn lại một schema rỗng; người dùng xóa nó như schema thường. Chấp nhận, vì khoảng thời gian này chỉ là một lần chuyển trang.

**Lý do chọn bước 2 và 3 thay vì ghi thẳng tài liệu đã import:** yêu cầu "import undo được" áp dụng cho mọi lần import. Ghi thẳng tài liệu thì editor mở ra với lịch sử rỗng. Đặt operation vào state React ở gốc thay cho biến cấp module, để không có state dùng chung giữa các request khi SSR (spec phần 3, mục 5).

### Thêm vào schema hiện tại

`buildImportOperation(target, imported, { mode: 'merge', origin }, generateId)` dựng một `batch` phẳng:

1. **Id mới cho mọi phần tử**, lấy từ `generateId`, kể cả khi nguồn là JSON: import cùng một file hai lần không được trùng id. Mọi tham chiếu (cột của bảng, khóa chính, cặp cột, `enumId`, `subjectAreaId`) được đổi theo.
2. **Tên trùng được đổi**, theo đúng phạm vi trùng tên của spec phần 2, mục 7: bảng và enum (chung một không gian tên), index, subject area. Tên trùng (không phân biệt hoa thường) với phần tử của schema đích hoặc với tên vừa cấp thì thêm hậu tố `_2`, `_3`… (số nhỏ nhất chưa dùng), giống quy tắc của `buildManyToMany`. Mỗi lần đổi có diagnostic `table-renamed`, `enum-renamed`, `index-renamed` hoặc `subject-area-renamed`, `path` trỏ tới phần tử đã đổi. Tên cột và giá trị enum không cần đổi vì phạm vi của chúng nằm trong bảng hoặc enum vừa thêm.
3. **Vị trí được tịnh tiến** để góc trên trái của khung bao các bảng và ghi chú vừa import nằm tại `origin`. Frontend tính `origin` từ kích thước node đã đo: bên phải khung bao các bảng đang có, cách `LayoutMetrics.gap`, cùng cạnh trên; schema chưa có bảng thì `origin` là `{ x: 0, y: 0 }`.
4. **Thứ tự bước:** `addEnum`, `addSubjectArea`, rồi mỗi bảng `addTable`, các `addColumn`, `setPrimaryKey` (khi có khóa chính), rồi `addIndex`, `addRelation`, `addNote`. Enum và subject area đứng trước bảng vì cột và bảng tham chiếu tới chúng; quan hệ đứng sau mọi bảng vì có thể nối hai bảng bất kỳ.
5. `renameSchema` không có trong batch: tên schema hiện tại giữ nguyên.

Sau khi áp, editor chọn các bảng vừa thêm và gọi `fitView` quanh chúng, để người dùng thấy ngay phần vừa import.

### Hàm dựng

```ts
type ImportMode =
  | { readonly mode: 'new' }
  | { readonly mode: 'merge'; readonly origin: Position };

function buildImportOperation(
  target: SchemaDocument,
  imported: SchemaDocument,
  mode: ImportMode,
  generateId: GenerateId,
): { readonly operation: Operation /* luôn là batch phẳng */; readonly diagnostics: readonly ImportDiagnostic[] };
```

- Chế độ `new` yêu cầu `target` không có phần tử nào; gọi sai là lỗi lập trình, nên throw.
- Batch luôn phẳng (độ sâu 1), nên nghịch đảo của nó áp lại được và không chạm `MAX_BATCH_DEPTH`.
- Hàm không trả `Result`: `imported` đã đúng cấu trúc, id mới không trùng, tên đã được đổi, nên batch luôn áp được lên `target`. Test property kiểm tra điều này (mục 15).
- Frontend kiểm tra tài liệu của editor vẫn đúng tham chiếu đã dùng để dựng batch trước khi dispatch; hộp thoại là modal nên thực tế không đổi, nhưng nếu đổi thì dựng lại batch.

### Phương án bị loại

- **Thay thế schema hiện tại** (batch xóa mọi phần tử rồi thêm phần tử của nguồn): một thao tác xóa toàn bộ công việc, chỉ cứu được bằng undo, mà lịch sử mất khi tải lại trang (spec phần 3, mục 6). Tạo schema mới cho cùng kết quả trên canvas mà schema cũ vẫn còn; xóa schema cũ là thao tác riêng có xác nhận.
- **Chỉ gộp, không tạo mới:** trường hợp phổ biến nhất (bắt đầu từ database hay file Prisma có sẵn) phải tạo schema rỗng trước rồi mới import.
- **Giữ nguyên tên trùng khi gộp**, để issue `table-name-duplicate` hiện trên canvas: tên trùng giữa bảng cũ và bảng mới thường không phải ý người dùng, và mỗi lần import lại cùng một file sẽ sinh hàng loạt issue. Đổi tên kèm diagnostic cho kết quả dùng được ngay và người dùng thấy rõ đã đổi gì.
- **Gộp theo tên** (bảng cùng tên thì cập nhật cột): cần quy tắc so khớp cột, kiểu, quan hệ và xử lý xung đột, tức là một công cụ so sánh schema. Không tiêu chí nào yêu cầu.

## 3. Issue ngữ nghĩa của kết quả import

Trả lời câu hỏi 3 của spec phần 2: kết quả import có dùng chế độ chặt như AI không.

### Quyết định

Import **không** dùng chế độ chặt. Kết quả còn issue ngữ nghĩa vẫn được áp dụng; hộp thoại cho thấy trước các issue mới trước khi người dùng xác nhận.

| Nơi gọi | Vi phạm bất biến cấu trúc | Issue ngữ nghĩa |
|---|---|---|
| Import (phần 7) | Không xảy ra với batch do `buildImportOperation` dựng (mục 2); nếu `applyOperation` vẫn từ chối thì đó là lỗi lập trình, hiện lỗi và không đổi schema | Cho phép. Bước xem trước liệt kê `findIntroducedIssues(target, kết quả)`; sau khi áp, issue hiện trên canvas và tab "Vấn đề" như mọi issue khác |

Dòng này thay dòng "Import (phần 7)" trong bảng chính sách theo nơi gọi của spec phần 2, mục 8.

- Importer không tự sửa dữ liệu để tránh issue: tên dài hơn 63 byte không bị cắt, tên có ký tự điều khiển không bị bỏ ký tự, quan hệ tham chiếu cột không unique vẫn được tạo. Mỗi trường hợp là issue ngữ nghĩa có sẵn của core (`name-too-long`, `name-invalid`, `relation-target-not-unique`), người dùng sửa trên canvas.
- Importer chỉ bỏ hoặc đổi dữ liệu khi model không biểu diễn được (kiểu, giá trị mặc định, câu lệnh không hỗ trợ), hoặc khi giữ lại sẽ vi phạm bất biến cấu trúc (tham chiếu không giải được). Mỗi lần như vậy có diagnostic của importer (mục 5 đến 8).
- Bước xem trước tách hai danh sách: diagnostic của importer (nguồn khác kết quả ở đâu) và issue mới (kết quả cần sửa gì). Ở chế độ gộp, issue đã có sẵn trong schema đích không được liệt kê lại.

**Lý do:**

- Nguồn import là database hay file có sẵn của người dùng, hợp lệ với công cụ gốc nhưng có thể vi phạm quy tắc chặt hơn của core: tên SQL Server dài tới 128 ký tự, MySQL cho giá trị `ENUM` chỉ khác hoa thường khi collation phân biệt hoa thường, database cũ có bảng tham chiếu cột không có ràng buộc unique. Chế độ chặt sẽ từ chối cả file vì một chi tiết, và người dùng không có cách nào sửa trước khi import ngoài sửa nguồn.
- Chế độ chặt của AI tồn tại vì đề xuất của model là output không tin cậy mà người dùng khó đọc hết. Import là hành động chủ động trên dữ liệu của chính người dùng, và bước xem trước đã cho thấy mọi issue mới.
- Editor đã chấp nhận tài liệu còn issue (spec phần 2, mục 8), nên kết quả import không tạo thêm trạng thái nào mới cho giao diện hay generator.

**Phương án bị loại:**

- Chế độ chặt như AI (từ chối khi `findIntroducedIssues` không rỗng): lý do ở trên.
- Chặt ở chế độ gộp, lỏng ở chế độ tạo mới: cùng một file cho hai kết quả khác nhau tùy chế độ, khó giải thích; schema đích vẫn nguyên vẹn nhờ undo.
- Importer tự sửa (cắt tên, bỏ quan hệ không unique): âm thầm đổi dữ liệu, trái nguyên tắc báo thay vì bỏ của `core.md`.

## 4. Vị trí bảng khi import

Model bắt buộc mỗi bảng và ghi chú có `position`. SQL, Prisma và DBML không có vị trí; auto-layout bằng elkjs (ED-11) thuộc phần 9.

**Quyết định:** importer SQL, Prisma, DBML xếp bảng theo lưới xác định trong `importers/shared/place-elements.ts`:

1. **Thứ tự bảng:** gom theo subject area (nhóm theo thứ tự tên của core, bảng không thuộc nhóm nào đứng cuối), trong mỗi nhóm theo thứ tự xuất hiện trong nguồn.
2. **Lưới theo hàng:** số cột của lưới là `ceil(sqrt(số bảng))`. Mỗi ô rộng `tableWidth + gap`. Chiều cao một hàng lưới bằng chiều cao ước tính của bảng cao nhất trong hàng, `headerHeight + số cột × columnRowHeight`, cộng `gap`. Mỗi nhóm bắt đầu một hàng mới, nên bảng cùng nhóm nằm cạnh nhau và khung subject area (phần 9) không chồng lên nhóm khác.
3. **Ghi chú** (chỉ DBML có) nằm trên một hàng riêng dưới mọi bảng, cách `gap`, theo thứ tự xuất hiện.
4. Tọa độ bắt đầu tại `{ x: 0, y: 0 }` và là số nguyên. Chế độ gộp tịnh tiến toàn bộ theo `origin` (mục 2).

- `LayoutMetrics` do frontend truyền vào từ cùng hằng số mà `TableNode` dùng cho bề rộng tối đa, chiều cao tiêu đề và chiều cao dòng cột (spec phần 3, mục 3: node có bề rộng tối thiểu và tối đa cố định), cộng khoảng cách 80 px. Dùng bề rộng tối đa nên các bảng không chồng nhau dù tên dài. Core không biết CSS nên không tự đặt các số này.
- JSON (IE-04) giữ nguyên vị trí trong file.
- Sau khi import, người dùng chạy auto-layout của phần 9 như một `moveElements` riêng, undo độc lập với lần import.

**Lý do:** kết quả xác định nên test so sánh được tài liệu, không phụ thuộc đo DOM hay thư viện layout, và không chồng bảng. Gom theo subject area giữ được thông tin tổ chức duy nhất mà nguồn có.

**Phương án bị loại:**

- Dùng elkjs ngay khi import: kéo auto-layout của phần 9 vào phần 7, elkjs chạy bất đồng bộ trong worker riêng và cần kích thước node đã đo, mà bảng vừa import chưa được render.
- Xếp theo đồ thị quan hệ (bảng được tham chiếu bên trái): đẹp hơn với schema nhỏ, nhưng là một thuật toán layout thứ hai sẽ bị elkjs thay thế ở phần 9.
- Đặt mọi bảng tại cùng một điểm rồi để người dùng tự kéo: canvas không đọc được với schema lớn.

## 5. IE-01. Import SQL

### Kết quả thử `@dbml/core` 10.1.1

Thử ngày 2026-09-15 bằng `Parser.parse(sql, 'postgres' | 'mysql' | 'mssql')` trên Node 24, trong thư mục tạm:

| Hành vi | PostgreSQL | MySQL | SQL Server |
|---|---|---|---|
| Bảng, cột, kiểu (tên kiểu gốc kèm tham số, ví dụ `character varying(255)`), `NOT NULL`, `UNIQUE` trên cột | Có | Có | Có |
| Khóa chính một và nhiều cột, kể cả `ALTER TABLE ONLY … ADD CONSTRAINT … PRIMARY KEY` | Có | Có | Có |
| Khóa ngoại kèm `ON DELETE`, `ON UPDATE`; `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` | Có | Có | Không thử |
| `CREATE [UNIQUE] INDEX`, cột dạng biểu thức được đánh dấu `expression` | Có | — | — |
| Enum | `CREATE TYPE … AS ENUM` | `ENUM(…)` trên cột thành enum tự đặt tên `<bảng>_<cột>_enum` | Không có |
| Auto-increment | `serial`, `bigserial`, `GENERATED … AS IDENTITY` trong cột; **không** nhận `ALTER TABLE … ALTER COLUMN … ADD GENERATED … AS IDENTITY` của `pg_dump` | `AUTO_INCREMENT` | **Không**: `IDENTITY(1, 1)` nằm lẫn trong tên kiểu (`bigint IDENTITY(1,1)`) |
| Giá trị mặc định | `{ type: 'string' \| 'number' \| 'boolean' \| 'expression', value }` | như PostgreSQL | như PostgreSQL; `N'a'` là `expression` |
| Comment | `COMMENT ON TABLE`, `COMMENT ON COLUMN` | `COMMENT` của cột và bảng | **Không** đọc `sp_addextendedproperty` |
| CHECK | `field.checks[].expression`, `table.checks[].expression` dạng văn bản | như PostgreSQL | như PostgreSQL |
| View, trigger, sequence, function (kể cả thân `$$…$$`), `DECLARE`, `EXEC` | **Bỏ qua âm thầm**, không lỗi, không cảnh báo | — | Bỏ qua âm thầm |
| Vị trí trên phần tử của model | **Không có** (`token` rỗng) | Không có | Không có |
| Lỗi cú pháp | Ném object có `diags: [{ text, location: { start: { line, column } } }]`, cột bắt đầu từ 0 | như PostgreSQL | như PostgreSQL |
| Thời gian parse, DDL 200 bảng × 22 cột (189 KB) | 2,1 giây | 2,6 giây | Không thử |
| Input lồng 20 000 cặp ngoặc | Không xong sau 90 giây | — | — |

Bundle ESM đã minify cho trình duyệt (esbuild, chỉ import `Parser`): 15,8 MB, gzip 2,7 MB.

Ba hệ quả cho thiết kế: câu lệnh bị bỏ qua âm thầm phải được phát hiện bằng một bộ quét riêng; vị trí của diagnostic theo phần tử phải lấy từ bộ quét đó; parse phải chạy trong worker có thể hủy (mục 14).

### Luồng xử lý

```text
SQL ─▶ statement scanner ─▶ phân loại từng câu lệnh
          │   câu cho parser: giữ nguyên
          │   câu còn lại: thay bằng khoảng trắng, giữ ký tự xuống dòng (vị trí của parser không đổi)
          ▼
   Parser.parse(văn bản đã lọc, dialect) ─▶ adapter ─▶ ImportDraft ─▶ assembleDocument
          ▲
   thông tin scanner tự đọc (identity qua ALTER TABLE, comment SQL Server, vị trí bảng và cột)
```

**Statement scanner** (`importers/sql/statement-scanner.ts`) là tokenizer tự viết, một lượt, không dùng regex có backtracking trên input. Nó nhận biết comment `--`, `/* … */` (lồng nhau với PostgreSQL), `#` (MySQL); chuỗi `'…'` với `''`, `E'…'`, `N'…'` và `\'` (MySQL); dollar quote `$tag$…$tag$` (PostgreSQL); định danh `"…"`, `` `…` ``, `[…]`; dấu `;` ở độ sâu ngoặc 0 và dòng `GO` đứng riêng (SQL Server). Mỗi câu lệnh có vị trí bắt đầu, dãy token kèm vị trí, và loại:

| Loại | Câu lệnh | Xử lý |
|---|---|---|
| Cấu trúc, parser đọc | `CREATE TABLE`; `CREATE [UNIQUE] INDEX`; `ALTER TABLE … ADD` cột, `PRIMARY KEY`, `UNIQUE`, `FOREIGN KEY`, `CHECK`; `CREATE TYPE … AS ENUM`; `COMMENT ON TABLE`, `COMMENT ON COLUMN` | Giữ cho parser |
| Cấu trúc, scanner đọc | PostgreSQL `ALTER TABLE [ONLY] t ALTER COLUMN c ADD GENERATED {ALWAYS \| BY DEFAULT} AS IDENTITY …` và `ALTER COLUMN c SET DEFAULT …`; SQL Server `EXEC [sys.]sp_addextendedproperty` với `@name = N'MS_Description'`, `@value` là chuỗi, `@level1name` và `@level2name` là chuỗi | Scanner ghi vào draft; không đưa cho parser |
| Không mô tả cấu trúc trong model | `SET`, `SELECT pg_catalog.set_config(…)`, `USE`, `GO`, `BEGIN`, `COMMIT`, `START TRANSACTION`, `DECLARE`, `CREATE DATABASE`, `CREATE SCHEMA`, `CREATE EXTENSION`, `ALTER … OWNER TO`, `GRANT`, `REVOKE`, `DROP …` | Bỏ qua, không diagnostic |
| Dữ liệu | `INSERT`, `COPY`, `UPDATE`, `DELETE`, `LOCK TABLES`, `UNLOCK TABLES`, `ALTER TABLE … DISABLE KEYS`, `ENABLE KEYS` | Bỏ qua; một diagnostic `data-statements-ignored` tại câu đầu tiên |
| Khái niệm model không có | `CREATE [OR REPLACE] [MATERIALIZED] VIEW`; `CREATE [OR REPLACE] FUNCTION`, `PROCEDURE`; `CREATE TRIGGER`; `CREATE SEQUENCE`, `ALTER SEQUENCE`; `CREATE DOMAIN`, `CREATE POLICY`, `CREATE RULE`, `CREATE STATISTICS`; `CREATE TYPE` không phải enum; `ALTER TABLE … ENABLE ROW LEVEL SECURITY` | `view-not-supported`, `routine-not-supported`, `trigger-not-supported`, `sequence-not-supported`, còn lại `statement-not-supported`, tại vị trí câu lệnh |
| Không nhận ra | Mọi câu khác | `statement-not-supported` |

`DROP` được bỏ qua không diagnostic vì `mysqldump` và `pg_dump --clean` ghi `DROP … IF EXISTS` trước mỗi `CREATE`; báo cho từng câu chỉ gây nhiễu.

**Vị trí của diagnostic theo phần tử:** adapter tìm câu `CREATE TABLE` của bảng trong kết quả scanner, rồi token tên cột ở độ sâu ngoặc 1 của câu đó. Không tìm được (ví dụ cột thêm bằng `ALTER TABLE`) thì dùng vị trí câu lệnh chứa phần tử.

### Namespace, tên, khóa, quan hệ

- **Namespace:** tên bảng bỏ phần schema (`public.users` → `users`). Bảng ở namespace khác mặc định (`public` với PostgreSQL, `dbo` với SQL Server) có diagnostic `namespace-dropped`. Hai bảng khác namespace mà trùng tên thì giữ cả hai, issue `table-name-duplicate` hiện sau khi import.
- **Tên** giữ đúng như `@dbml/core` trả về (bỏ dấu quote). Plan xác nhận tên không quote có bị đổi hoa thường không; nếu parser giữ nguyên thì importer cũng giữ nguyên, vì core so trùng không phân biệt hoa thường.
- **Nullable:** `isNullable` là `true` khi cột không có `NOT NULL` và không thuộc khóa chính.
- **Unique:** `UNIQUE` trên một cột (trong cột hoặc ràng buộc cấp bảng) là `column.isUnique`; `UNIQUE` nhiều cột là index unique mang tên ràng buộc; `CREATE UNIQUE INDEX` luôn là index unique, kể cả một cột. Cách phân biệt này khớp CG-01 (ràng buộc `… UNIQUE` cho `isUnique`, `CREATE UNIQUE INDEX` cho index của người dùng). Plan xác nhận model của parser phân biệt được hai dạng; nếu không, scanner cung cấp danh sách tên index tạo bằng `CREATE INDEX`.
- **Index:** tên rỗng thì dùng `suggestIndexName`. Cột dạng biểu thức: bỏ index, `index-expression-not-supported`. Loại khác `btree`: giữ index, `index-type-dropped`.
- **Quan hệ:** phía có khóa ngoại là `from`. `kind` là `oneToOne` khi tập cột khóa ngoại unique theo định nghĩa của spec phần 2 (bằng khóa chính, một cột `isUnique`, hoặc bằng tập cột của index unique), ngược lại `oneToMany`: SQL không có tín hiệu nào khác, và CG-01 không thêm unique ngầm cho 1-1. Hành động: `CASCADE`, `SET NULL`, `SET DEFAULT`, `RESTRICT`, `NO ACTION`; không ghi là `noAction`. Bảng hoặc cột được tham chiếu không có trong file: bỏ quan hệ, `reference-not-found`.
- **Comment:** PostgreSQL `COMMENT ON`, MySQL `COMMENT`, SQL Server `sp_addextendedproperty` (scanner). Comment trên đối tượng khác bảng, cột: bỏ qua cùng câu lệnh, `statement-not-supported`.
- **CHECK:** ràng buộc đúng dạng `<cột> IN (<chuỗi>, …)` trên một cột kiểu chuỗi (có thể có ép kiểu `::text`, tiền tố `N`, định danh trong quote) được đổi thành enum tên `<bảng>_<cột>` và cột dùng enum đó, kèm `check-converted-to-enum`; đây là dạng CG-01 ghi enum cho SQL Server. MySQL `ENUM(…)` trên cột cũng thành enum `<bảng>_<cột>` (bỏ hậu tố `_enum` của parser), không diagnostic. CHECK khác: bỏ, `check-constraint-not-supported`.
- Cột tính toán (`GENERATED ALWAYS AS (…) STORED`, `AS (…) PERSISTED`): giữ cột như cột thường, `computed-column-not-supported`.

### Ánh xạ kiểu

Tên kiểu so không phân biệt hoa thường, sau khi bỏ quote và gộp khoảng trắng. "≈" là ánh xạ gần đúng, kèm diagnostic `type-approximated` (tập giá trị chấp nhận được khác nguồn). Tham số không có trong model (độ chính xác phân số giây khác 6 với MySQL và khác mặc định với PostgreSQL, SQL Server) bị bỏ kèm `type-parameter-dropped`.

| Kiểu chung | PostgreSQL | MySQL | SQL Server |
|---|---|---|---|
| `smallint` | `smallint`, `int2`, `smallserial`¹ | `SMALLINT`; ≈ `TINYINT` (trừ `TINYINT(1)`) | `smallint`; ≈ `tinyint` |
| `integer` | `integer`, `int`, `int4`, `serial`¹ | `INT`, `INTEGER`; ≈ `MEDIUMINT`; ≈ `SMALLINT UNSIGNED` | `int` |
| `bigint` | `bigint`, `int8`, `bigserial`¹ | `BIGINT`; ≈ `INT UNSIGNED` | `bigint` |
| `decimal(p, s)` | `numeric(p, s)`, `decimal(p, s)` | `DECIMAL(p, s)`, `NUMERIC(p, s)`; ≈ `BIGINT UNSIGNED` thành `decimal(20, 0)` | `decimal(p, s)`, `numeric(p, s)` |
| `real` / `double` | `real`, `float4` / `double precision`, `float8`, `float(n)` theo `n ≤ 24` | `FLOAT` / `DOUBLE`, `DOUBLE PRECISION` | `real`, `float(n ≤ 24)` / `float`, `float(53)` |
| `boolean` | `boolean`, `bool` | `BOOLEAN`, `BOOL`, `TINYINT(1)` | `bit` |
| `char(n)` / `varchar(n)` | `char(n)`, `character(n)` / `varchar(n)`, `character varying(n)` | `CHAR(n)` / `VARCHAR(n)` | `nchar(n)` / `nvarchar(n)`; ≈ `char(n)`, `varchar(n)` (không Unicode) |
| `text` | `text`, `varchar` không độ dài | `LONGTEXT`; ≈ `TEXT`, `TINYTEXT`, `MEDIUMTEXT` | `nvarchar(max)`; ≈ `varchar(max)`, `ntext`, `text` |
| `uuid` | `uuid` | `CHAR(36)` kèm mặc định `(UUID())`; `CHAR(36)` khác là `char(36)` | `uniqueidentifier` |
| `date` / `time` | `date` / `time`, `time without time zone` | `DATE` / `TIME(6)` | `date` / `time` |
| `timestamp` | `timestamp`, `timestamp without time zone` | `DATETIME(6)` | `datetime2`; ≈ `datetime`, `smalldatetime` |
| `timestamptz` | `timestamptz`, `timestamp with time zone` | `TIMESTAMP(6)` | `datetimeoffset` |
| `json` | `jsonb`; ≈ `json` | `JSON` | Không có (cột `nvarchar(max)` là `text`) |
| `binary` | `bytea` | `LONGBLOB`; ≈ `BLOB`, `TINYBLOB`, `MEDIUMBLOB`, `BINARY(n)`, `VARBINARY(n)` | `varbinary(max)`; ≈ `varbinary(n)`, `binary(n)`, `image` |
| `enum` | Tên kiểu trùng một `CREATE TYPE … AS ENUM` | `ENUM(…)` trên cột | CHECK `IN (…)` (ở trên) |
| `custom` | Mọi kiểu khác (`inet`, `money`, `text[]`, `geometry(Point,4326)`, `timetz`, `numeric` không tham số) | Như PostgreSQL (`SET(…)` có dấu nháy nên rơi vào dòng dưới) | Như PostgreSQL (`money`, `xml`, `hierarchyid`) |
| `text` kèm `type-not-supported` | Tên kiểu không qua cú pháp an toàn của kiểu custom (spec phần 2, mục 3) | như PostgreSQL | như PostgreSQL |

¹ Kèm `isAutoIncrement`. Auto-increment còn đến từ `GENERATED … AS IDENTITY` (PostgreSQL, trong cột hoặc qua `ALTER TABLE`), `AUTO_INCREMENT` (MySQL), `IDENTITY(1, 1)` (SQL Server, adapter tách khỏi tên kiểu). `IDENTITY` với seed hoặc bước khác 1 vẫn là auto-increment, kèm `identity-options-dropped`.

Kiểu custom không mang diagnostic: tên được giữ nguyên văn và sinh lại đúng như nguồn trên cùng dialect.

### Giá trị mặc định

Trước khi so khớp, adapter bỏ ngoặc bao ngoài (`((0))`, `(N'a')`), tiền tố `N` của chuỗi, và ép kiểu cuối của PostgreSQL (`'a'::status`, `'x'::character varying`).

| Nguồn | Kết quả |
|---|---|
| Chuỗi, số, `true`/`false` (kể cả `1`/`0` trên cột `bit`) | `literal` với văn bản gốc trong nguồn. Số được lấy từ văn bản của câu lệnh, không từ số JavaScript của parser, để không mất độ chính xác. Literal sai dạng của kiểu vẫn được giữ và thành issue `column-default-invalid` (mục 3) |
| `NULL` | Không có giá trị mặc định, không diagnostic |
| `now()`, `CURRENT_TIMESTAMP`, `CURRENT_TIMESTAMP(n)`, `LOCALTIMESTAMP`, `NOW()`, `sysdatetime()`, `sysdatetimeoffset()`, `getdate()`, `getutcdate()` trên cột `timestamp`, `timestamptz` | `currentTimestamp` |
| `gen_random_uuid()`, `uuid_generate_v4()`, `(UUID())`, `UUID()`, `newid()` trên cột `uuid` | `generateUuid`; `newsequentialid()` cũng vậy, kèm `default-approximated` |
| `nextval('…')` trên `smallint`, `integer`, `bigint` | Không có giá trị mặc định; `isAutoIncrement` bật, kèm `sequence-default-as-auto-increment` (dạng `pg_dump` ghi cột `serial`) |
| Biểu thức khác, hoặc hai biểu thức trên dùng với kiểu khác | Bỏ, `default-not-supported` |

MySQL `ON UPDATE CURRENT_TIMESTAMP` không có trong model: `on-update-not-supported` nếu parser giữ lại thông tin này; plan xác nhận.

### Round-trip

Model không lưu dialect, còn SQL mất một phần thông tin (MySQL `CHAR(36)` không mang ý nghĩa `uuid`, SQL Server không có enum). Vì vậy "tương đương" với SQL được định nghĩa là **điểm bất động của DDL**: với mỗi dialect `d` và mỗi fixture hợp lệ `S`, `generate_d(import_d(generate_d(S)))` bằng đúng từng byte `generate_d(S)`. Tên ràng buộc do generator đặt, nên cũng khớp.

**Phương án bị loại:**

- Tự viết parser DDL cho ba dialect: khối lượng lớn nhất của phần này, và `architecture.md` đã chốt `@dbml/core`.
- Chỉ dùng `@dbml/core`, không có scanner: view, trigger, sequence, CHECK bị bỏ âm thầm, trái `core.md`; không có vị trí cho diagnostic theo phần tử; `pg_dump` mất auto-increment và SQL Server mất comment.
- Dùng `importer.import` (SQL sang DBML) rồi đi qua importer DBML: thêm một lần sinh và parse văn bản, và vẫn mất cùng những thông tin như trên.
- Tự nhận diện dialect từ nội dung: cú pháp của ba dialect chồng nhau nhiều, đoán sai cho lỗi khó hiểu. Người dùng chọn dialect trong hộp thoại.

## 6. IE-02. Import Prisma

### Chọn parser

| Tiêu chí | `@mrleebo/prisma-ast` 0.16.0 | `@prisma/internals` 7.10.0 (`getDMMF`) | Parser tự viết trong core |
|---|---|---|---|
| Chạy trên trình duyệt, isomorphic | **Không**: bản ESM import `os` và `lilconfig` (dùng `fs`, `path`, `os`) để đọc file cấu hình; esbuild với `platform=browser` báo lỗi không resolve được (đã thử) | **Không**: gói Node, kéo `@prisma/engines`, `@prisma/fetch-engine`, `prompts` | Có |
| Cách chạy validation của Prisma | Không có, chỉ AST | Có, qua `@prisma/prisma-schema-wasm` (3,2 MB WebAssembly) | Không có; issue ngữ nghĩa của core bắt phần lớn lỗi |
| CSP của frontend | — | Cần `'wasm-unsafe-eval'` | Không cần thêm gì |
| Vị trí trên node AST | Chỉ có trong lỗi cú pháp (token Chevrotain có `startLine`, `startColumn`); node AST không có vị trí (đã thử), nên diagnostic theo phần tử không có dòng, cột | Lỗi validation có span | Có trên mọi node |
| Dependency | `chevrotain` 12 (bản mới nhất 13.2.0), `lilconfig` | Hơn chục gói `@prisma/*` | Không có |
| Gắn với phiên bản Prisma | Không | Có; `@prisma/prisma-schema-wasm` hiện ở `8.1.0-2…` | Không; ngữ pháp schema Prisma ổn định qua nhiều phiên bản |

**Quyết định:** parser tự viết trong `importers/prisma/`: lexer và parser đệ quy xuống cho tập ngữ pháp cần dùng (khối `datasource`, `generator`, `enum`, `model`, `view`, `type`; trường, kiểu, `?`, `[]`, `Unsupported("…")`; thuộc tính `@x(…)`, `@@x(…)`, `@db.X(…)`; đối số vị trí và có tên, mảng, chuỗi, số, lời gọi hàm; comment `//` và `///`). Mọi node mang vị trí.

**Lý do:** không có parser nào vừa isomorphic vừa không cần WebAssembly. Ngữ pháp schema Prisma nhỏ và đều (khối, dòng trường, thuộc tính), nên parser tự viết ước tính vài trăm dòng, kiểm soát được vị trí cho mọi diagnostic, và giữ core không thêm dependency.

**Phương án bị loại:** hai thư viện trong bảng. Dùng `chevrotain` trực tiếp để dựng parser: thêm runtime dependency cho một ngữ pháp mà parser đệ quy xuống viết tay vẫn gọn, trái quy tắc chỉ thêm dependency khi tự viết rõ ràng tệ hơn.

### Lỗi cú pháp và khối không hỗ trợ

- Lỗi cú pháp dừng parse và trả `Result` lỗi với `syntax-error` tại token sai. Parser không cố phục hồi để đọc tiếp.
- `generator` bị bỏ qua. `datasource` chỉ đọc `provider` để chọn cách hiểu `@db.*` và kiểu mặc định; thiếu `datasource` hoặc `provider` không phải `postgresql`, `mysql`, `sqlserver` thì hiểu theo `postgresql`, kèm `provider-not-supported`.
- `view` là `view-not-supported`; `type` (kiểu phức hợp của MongoDB) là `composite-type-not-supported`. Cả khối bị bỏ.

### Tên, kiểu, thuộc tính

**Tên:** tên trong tài liệu là tên trong database. Model có `@@map("x")` thì tên bảng là `x`, trường có `@map("x")` thì tên cột là `x`, enum có `@@map` và giá trị enum có `@map` cũng vậy. CG-02 ghi `@@map`, `@map` khi tên code khác tên gốc, nên import output của CG-02 lấy lại đúng tên gốc (ví dụ `NguoiDung @@map("người dùng")` thành bảng `người dùng`).

**Kiểu** (cột theo `provider`; không có `@db.*` thì dùng kiểu mặc định của Prisma cho provider đó):

| Prisma | `postgresql` | `mysql` | `sqlserver` |
|---|---|---|---|
| `Int` | `integer`; `@db.SmallInt` → `smallint` | như PostgreSQL | như PostgreSQL |
| `BigInt` | `bigint` | `bigint` | `bigint` |
| `Decimal` | `@db.Decimal(p, s)` → `decimal(p, s)`; không có → `decimal(65, 30)` | như PostgreSQL | `@db.Decimal(p, s)`; không có → `decimal(32, 16)` |
| `Float` | `double`; `@db.Real` → `real` | `double`; `@db.Float` → `real` | `double`; `@db.Real` → `real` |
| `Boolean` | `boolean` | `boolean` | `boolean` |
| `String` | `text`; `@db.VarChar(n)`, `@db.Char(n)`, `@db.Uuid`, `@db.Text` | `varchar(191)`; `@db.VarChar(n)`, `@db.Char(n)`, `@db.LongText`, `@db.Text` → `text` | `varchar(1000)`; `@db.NVarChar(n)`, `@db.NChar(n)`, `@db.NVarChar(Max)` → `text`, `@db.UniqueIdentifier` → `uuid` |
| `DateTime` | `timestamp`; `@db.Timestamptz(n)`, `@db.Timestamp(n)`, `@db.Date`, `@db.Time(n)` | `timestamp`; `@db.Timestamp(n)` → `timestamptz`, `@db.DateTime(n)`, `@db.Date`, `@db.Time(n)` | `timestamp`; `@db.DateTimeOffset` → `timestamptz`, `@db.DateTime2`, `@db.Date`, `@db.Time` |
| `Json` | `json` | `json` | — (Prisma không cho) |
| `Bytes` | `binary` | `binary` | `binary` |
| Tên enum | `enum` | `enum` | — |
| `Unsupported("x")` | `custom` tên `x`; tên không qua cú pháp an toàn → `text`, `type-not-supported` | như PostgreSQL | như PostgreSQL |
| Kiểu danh sách `T[]` | `custom` tên `<kiểu native>[]`, kèm `scalar-list-as-custom` | — | — |

- `@db.*` khác các dòng trên (ví dụ `@db.Inet`, `@db.Money`) thành `custom` với tên kiểu native tương ứng; `@db.*` với tham số độ chính xác khác mặc định của cột trong model thì bỏ tham số, `type-parameter-dropped`.
- MySQL `String @db.Char(36)` có `@default(uuid())` thành `uuid`, giống quy tắc SQL ở mục 5.
- `?` là `isNullable`.

**Khóa, unique, index:**

| Prisma | Model |
|---|---|
| `@id` | Khóa chính một cột |
| `@@id([a, b])` | Khóa chính theo đúng thứ tự |
| `@unique` | `column.isUnique` |
| `@@unique([a, b], map: "x")` | Index unique tên `x`; không có `map` thì `suggestIndexName` |
| `@@index([a, b], map: "x")` | Index tên `x`; không có `map` thì `suggestIndexName` |
| `sort`, `length`, `type`, `ops`, `clustered` trong các thuộc tính trên | Bỏ, `index-option-dropped` |
| `@@ignore`, `@ignore` | Bỏ qua thuộc tính, vẫn import bảng và cột: bảng vẫn có trong database. CG-02 ghi `@@ignore` cho bảng không có định danh |
| `@@schema("x")` | Bỏ, `namespace-dropped` |
| `@updatedAt` | Bỏ, `updated-at-not-supported` (giá trị do Prisma Client đặt, không phải database) |

**Giá trị mặc định:**

| Prisma | Model |
|---|---|
| `@default(autoincrement())` | `isAutoIncrement` |
| `@default(now())` | `currentTimestamp` |
| `@default(uuid())`, `uuid(4)` | `generateUuid`; `uuid(7)` kèm `default-approximated` |
| `@default(cuid())`, `cuid(2)`, `nanoid()`, `ulid()`, `sequence()` | Bỏ, `default-not-supported` (Prisma Client sinh giá trị, database không có mặc định) |
| `@default(dbgenerated("…"))` | Đọc chuỗi bên trong như giá trị mặc định SQL của dialect theo `provider`, quy tắc ở mục 5. CG-02 ghi literal `date`, `time` theo cách này |
| Chuỗi, số, `true`/`false` | `literal` với văn bản gốc |
| Giá trị enum | `literal` là giá trị enum sau khi áp `@map` |

**Comment:** `///` ngay trên model, enum hoặc trường là comment của bảng hoặc cột (nhiều dòng nối bằng `\n`); `///` trên enum và giá trị enum bị bỏ kèm `comment-dropped`, vì model chỉ có comment cho bảng và cột. `//` bị bỏ qua.

### Quan hệ

- Trường quan hệ có `@relation(fields: […], references: […])` xác định một quan hệ: model chứa trường là `from`, model của kiểu trường là `to`, cặp cột ghép `fields` với `references` theo thứ tự.
- **Loại:** trường ngược ở model `to` là `Model?` thì `oneToOne`; `Model[]` thì `oneToMany`. Không có trường ngược (schema không hợp lệ với Prisma) thì suy như SQL theo tính unique của tập cột khóa ngoại, kèm `back-relation-missing`.
- **Hành động:** `Cascade`, `Restrict`, `NoAction`, `SetNull`, `SetDefault`. Thiếu `onDelete` thì dùng mặc định của Prisma: `setNull` khi có cột khóa ngoại nullable, ngược lại `restrict` (`noAction` với `sqlserver`); thiếu `onUpdate` thì `cascade` (`noAction` với `sqlserver`). CG-02 luôn ghi cả hai hành động.
- Tên quan hệ (`@relation("x")`) và tên trường quan hệ không lưu: generator tự đặt lại (spec phần 6, mục 5).
- Quan hệ n-n ngầm (hai phía đều là danh sách, không có `fields`): bỏ, `implicit-many-to-many-not-supported`. CG-02 không bao giờ sinh dạng này.

### Round-trip

- **Provider `postgresql`:** với mỗi fixture hợp lệ `S`, `importPrisma(generatePrisma(S, { provider: 'postgresql' }))` bằng `S` theo cấu trúc sau khi chuẩn hóa id và vị trí (mục 15), và không có diagnostic. Bảng ánh xạ của CG-02 cho PostgreSQL là song ánh trên mọi kiểu chung.
- **Provider `mysql`, `sqlserver`:** CG-02 đã mất thông tin kèm diagnostic (enum và `json` trên SQL Server, `uuid` thành `Char(36)` trên MySQL), nên dùng điểm bất động như SQL: `generatePrisma(importPrisma(P))` bằng đúng `P` với `P = generatePrisma(S, { provider })`.

## 7. IE-03. Import DBML

### Parser

`Parser.parse(source, 'dbmlv2')` của `@dbml/core` 10.1.1, cùng chế độ conformance test của phần 6 dùng. Đã thử trên mẫu theo dạng output của CG-09:

- Lỗi (cú pháp và ngữ nghĩa của DBML, ví dụ hai `Ref` cùng đầu mút) được ném dạng `diags: [{ message, code, location: { start, end } }]`, dòng và cột bắt đầu từ 1. Importer trả `syntax-error` tại `location.start` của từng mục; `message` tiếng Anh của parser không được dùng.
- Mọi phần tử của model có `token` với vị trí bắt đầu và kết thúc (khác parser SQL), nên diagnostic theo phần tử có dòng, cột chính xác.
- Tên `Project`, `TableGroup` kèm bảng thành viên, `Note` độc lập (tên và nội dung), `note` của bảng và cột, loại index (`type: hash`), tên `Ref` đều có trong model.
- Hai điểm mất thông tin mà adapter phải bù: tên kiểu trong nháy kép mất dấu nháy (`"text"` và `text` đều ra `text`); giá trị mặc định dạng số là số JavaScript (`1.5`), nên số lớn mất độ chính xác. Adapter đọc lại văn bản gốc trong `source` theo `token` của cột cho cả hai trường hợp.

### Ánh xạ

| DBML | Model |
|---|---|
| `Project "x"` | Tên schema. `database_type` chọn cách hiểu tên kiểu không phải kiểu chung (PostgreSQL, MySQL, SQL Server theo mục 5; giá trị khác hoặc không có thì theo PostgreSQL). `note` của `Project` bị bỏ, `comment-dropped` |
| `Table "x"`, `Note:` của bảng | Bảng, comment. Alias bỏ qua. `schema.table` với schema khác `public`: `namespace-dropped`. `headercolor`: `color-dropped` |
| Cột: `pk`, `increment`, `not null`, `null`, `unique`, `note:` | Khóa chính một cột, `isAutoIncrement`, `isNullable`, `isUnique`, comment |
| Cột: `check:`, khối `checks` | Bỏ, `check-constraint-not-supported` |
| Kiểu trong nháy kép | Tên enum có trong file thì `enum`; còn lại `custom` nguyên văn (CG-09 ghi enum và kiểu custom trong nháy kép) |
| Kiểu không có nháy | Theo thứ tự: đúng tên một kiểu chung như CG-09 ghi (`bigint`, `varchar(255)`, `decimal(10,2)`, `double`, `binary`…); tên enum; bảng ánh xạ SQL của mục 5 theo `database_type`; còn lại `custom`, hoặc `text` kèm `type-not-supported` nếu tên không qua cú pháp an toàn |
| `default:` chuỗi, số, `true`/`false`, `null` | `literal` với văn bản gốc; `null` là không có mặc định |
| `default:` biểu thức `` `…` `` | Bảng biểu thức của mục 5 (hợp của ba dialect): `currentTimestamp`, `generateUuid`, hoặc bỏ kèm `default-not-supported` |
| `indexes { (a, b) [pk] }` | Khóa chính nhiều cột theo thứ tự |
| `indexes { (a, b) [unique, name: "x"] }` | Index (unique khi có `unique`), tên `x` hoặc `suggestIndexName`. `type:` khác `btree`: `index-type-dropped`. Cột biểu thức: bỏ index, `index-expression-not-supported`. `note:`: `comment-dropped` |
| `Ref` và `ref:` trên cột: `>` | `oneToMany`, bảng bên trái là `from` |
| `<` | `oneToMany`, bảng bên phải là `from` |
| `-` | `oneToOne`, bảng bên trái là `from` (quy ước CG-09 ghi) |
| `<>` | Bỏ, `many-to-many-not-supported` |
| `delete:`, `update:` | `cascade`, `restrict`, `set null`, `set default`, `no action`; không ghi là `noAction`. Tên `Ref` bỏ qua, `color`: `color-dropped` |
| `Enum` | Enum, giữ thứ tự giá trị. `note` của giá trị: `comment-dropped` |
| `TableGroup "x"` | Subject area `x`; bảng thành viên có `subjectAreaId`. `note`, `color` của nhóm: `comment-dropped`, `color-dropped` |
| `Note "x" { '…' }` | Ghi chú với nội dung; tên bị bỏ không diagnostic (ghi chú của core không có tên, CG-09 tự đặt `note <n>`) |
| `Records` | Bỏ, `data-statements-ignored` |

### Round-trip

Với mỗi fixture hợp lệ `S` (`createSampleSchema()`, `createNamingEdgeSchema()`, `createTargetLimitSchema()` của phần 2 và phần 6), `importDbml(generateDbml(S).file.content)` trả tài liệu bằng `S` theo cấu trúc sau khi chuẩn hóa id và vị trí (mục 15), và không có diagnostic. CG-09 ghi kiểu bằng tên kiểu chung, hai biểu thức mặc định bằng `` `now()` `` và `` `gen_random_uuid()` ``, khóa chính nhiều cột trong `indexes`, subject area bằng `TableGroup` và ghi chú bằng `Note`, nên mọi khái niệm của model trừ vị trí đều đi qua được. Đây là test round-trip mà phần 6 để lại cho phần 7.

**Phương án bị loại:** parser DBML tự viết: `architecture.md` đã chốt `@dbml/core`, và parser DBML của thư viện có sẵn vị trí cho mọi phần tử. `Parser.parse(…, 'dbml')` (parser cũ): phần 6 đã kiểm chứng output của CG-09 với `dbmlv2`.

## 8. IE-04, IE-06. JSON

### Export (IE-06)

```ts
function serializeSchemaDocument(document: SchemaDocument): string;
```

- Nằm ở entry point chính của core: nhỏ, không có dependency, và backend dùng lại được khi xuất phiên bản (phần 8).
- **Thứ tự khóa ổn định:** khóa ở gốc theo thứ tự khai báo của `SchemaDocument` (`version`, `name`, `tables`, `columns`, `relations`, `indexes`, `enums`, `subjectAreas`, `notes`); phần tử trong mỗi map sắp theo id (so theo code unit); trường của phần tử và của object lồng (`type`, `defaultValue`, `position`, cặp cột) theo thứ tự khai báo trong schema Zod của core. Mảng giữ nguyên thứ tự.
- Thụt lề 2 dấu cách, kết thúc bằng đúng một `\n`, không BOM. Không thêm trường nào (không có `exportedAt`, tên ứng dụng hay phiên bản ứng dụng).
- File chứa toàn bộ tài liệu, gồm vị trí, subject area và ghi chú (tiêu chí IE-06).
- Tên file `<tên gốc>.schemaforge.json` (mục 9).

**Lý do:** `JSON.stringify(document)` cho thứ tự khóa theo lịch sử thao tác (undo đưa khóa về cuối object, JSONB sắp lại khóa), nên cùng một schema cho hai file khác nhau, và diff trong git vô nghĩa. Thứ tự khai báo đọc dễ hơn thứ tự chữ cái (`id` đứng đầu mỗi phần tử).

**Phương án bị loại:** bọc tài liệu trong phong bì `{ format, exportedAt, document }`: thời điểm export làm file không xác định, còn `parseSchemaDocument` đã nhận diện định dạng qua `version` và object strict. Sắp mọi khóa theo chữ cái (JSON chuẩn tắc kiểu RFC 8785): xác định như nhau nhưng khó đọc hơn.

### Import (IE-04)

1. Kiểm tra độ dài (mục 1).
2. `JSON.parse`. Lỗi cú pháp trả `syntax-error` với vị trí do `locateJsonSyntaxError` của core tính: một lượt quét tìm ký tự đầu tiên không hợp lệ theo ngữ pháp JSON. Không đọc vị trí từ thông báo của `SyntaxError`, vì định dạng thông báo khác nhau giữa các engine.
3. `parseSchemaDocument`. Lỗi trả `Result` lỗi, mỗi `StructuralError` thành một diagnostic giữ nguyên mã cấu trúc của core (`invalid-shape`, `version-unsupported`, `id-mismatch`…), `path` của lỗi và `location: null`. Kiểu `code` của diagnostic vì vậy là `ImportDiagnosticCode | StructuralErrorCode`; frontend dịch mã cấu trúc bằng namespace `errors` đã có từ phần 3.
4. Kiểm tra số phần tử (mục 1). Tài liệu version cũ đã được migrate ở bước 3.

- Không đổi id hay vị trí. Ở chế độ tạo mới, kết quả **giống hệt** tài liệu trong file: `serializeSchemaDocument(kết quả)` bằng đúng từng byte file do IE-06 xuất ra (tiêu chí IE-04). Ở chế độ gộp, id và tên trùng được đổi theo mục 2.
- Issue ngữ nghĩa được cho phép (mục 3).

## 9. IE-05. Tải output của generator

### Nơi tải

- **Code panel** (spec phần 6, mục 8) thêm nút "Tải file" cạnh nút "Copy": tải đúng output đang hiển thị, theo đích và option đang chọn. Nút bị disable khi worker chưa trả kết quả cho yêu cầu mới nhất.
- **Menu "Export"** trên toolbar của editor (mục 12): JSON, PNG, SVG, ZIP.
- Nội dung tải về là `GeneratedFile.content` nguyên văn: UTF-8, không BOM, kết thúc bằng một `\n`.

### Tên file

`toDownloadBaseName(schemaName)` (frontend, hàm thuần) tạo phần tên gốc: chuẩn hóa NFD, bỏ dấu (U+0300–U+036F), `đ` → `d`, `Đ` → `D`, chữ thường, mỗi dãy ký tự không thuộc `[a-z0-9]` thành một `-`, bỏ `-` ở hai đầu, tối đa 60 ký tự; rỗng thì `schema`. Tên chỉ gồm ASCII nên hợp lệ trên Windows, macOS, Linux và trong ZIP. Phần mở rộng lấy từ `GeneratedFile.fileName` của phần 6.

| Đích và option | Tên file (`blog` là tên gốc) |
|---|---|
| SQL DDL | `blog.postgresql.sql`, `blog.mysql.sql`, `blog.sqlserver.sql` |
| Prisma, `provider` | `blog.postgresql.prisma`, `blog.mysql.prisma`, `blog.sqlserver.prisma` |
| Drizzle, `dialect` | `blog.drizzle.postgresql.ts`, `blog.drizzle.mysql.ts` |
| TypeScript, Zod, Mock API | `blog.types.ts`, `blog.schemas.ts`, `blog.handlers.ts` |
| OpenAPI | `blog.openapi.json` |
| Seed data, `format` | `blog.seed.postgresql.sql`, `blog.seed.mysql.sql`, `blog.seed.sqlserver.sql`, `blog.seed.json` |
| DBML, Markdown | `blog.dbml`, `blog.md` |
| JSON (IE-06) | `blog.schemaforge.json` |
| Ảnh (IE-07) | `blog.png`, `blog.svg` |
| ZIP (IE-08) | `blog.zip` |

Option nằm trong tên file để mọi tổ hợp trong một ZIP có tên khác nhau, và file tải riêng lẻ cho biết dialect.

### Cơ chế tải

```ts
function downloadBlob(blob: Blob, fileName: string): void;
```

- `frontend/src/lib/download/download-blob.ts` là nơi duy nhất gọi `URL.createObjectURL`: tạo thẻ `<a>` ẩn với `href` là object URL, `download` là tên file, `rel="noopener"`, gọi `click()`, gỡ thẻ, rồi `URL.revokeObjectURL` sau `OBJECT_URL_REVOKE_DELAY_MS` (10 giây, vì Safari bắt đầu tải bất đồng bộ). `no-restricted-properties` cấm `URL.createObjectURL` ở nơi khác.
- Kiểu MIME: `text/plain;charset=utf-8` cho SQL, Prisma, TypeScript, DBML; `application/json` cho JSON và OpenAPI; `text/markdown;charset=utf-8`; `image/png`; `image/svg+xml`; `application/zip`.
- **CSP:** tải qua `a[download]` tới object URL `blob:` cùng origin là điều hướng tải file, không thuộc `img-src`, `connect-src` hay `script-src`, nên CSP của phần 3 không cần đổi. Không dùng URL `data:`: Chrome chặn điều hướng khung chính tới `data:` và độ dài URL giới hạn kích thước.

**Phương án bị loại:** File System Access API (`showSaveFilePicker`): chỉ có trên trình duyệt nhân Chromium. Thư viện `file-saver` 2.0.5: chỉ bọc đúng cách làm trên, thêm dependency mà không thêm khả năng nào cần.

## 10. IE-07. Export ảnh PNG, SVG

### Chọn cách tạo ảnh

| Tiêu chí | `modern-screenshot` 4.7.0 | `html-to-image` 1.11.13 | Tự vẽ SVG từ tài liệu |
|---|---|---|---|
| Cách làm | Clone DOM của canvas, chép style đã tính, nhúng font, đóng gói thành SVG `foreignObject`, vẽ lên canvas cho PNG | Như `modern-screenshot` (`modern-screenshot` là bản fork) | Hàm thuần dựng SVG thật (`<rect>`, `<text>`, `<path>`) từ tài liệu và kích thước node đã đo; PNG vẽ lại bằng Canvas 2D |
| Giống canvas đang thấy | Giống, vì dùng chính DOM | Giống | Phải viết lại cách vẽ node, dòng cột, dấu khóa, edge, marker chân gà, nhãn; lệch dần khi phần 9 thêm khung subject area và ghi chú |
| Bảo trì | Bản 4.7.0 ngày 2026-04-16 | Bản cuối 2025-02-14; tài liệu React Flow khuyên khóa ở 1.11.11 (2023) vì các bản sau xuất ảnh sai | Code của dự án |
| Kích thước (esbuild, minify, gzip) | 9,7 KB | 5,2 KB | Không thêm dependency |
| SVG dùng được trong công cụ thiết kế (Figma, Inkscape) | Hạn chế: trình duyệt hiển thị đúng, công cụ vector thường không vẽ `foreignObject` | Như bên trái | Có |
| Test tự động | Chỉ phần tính khung ảnh; chụp ảnh cần trình duyệt thật | Như bên trái | Snapshot SVG trên jsdom |
| CSP | Ảnh trung gian là `data:image/svg+xml` (`img-src data:` đã có); tải font cùng origin (`connect-src 'self'`); worker chỉ khi truyền `workerUrl` | Như bên trái | Không liên quan |

**Quyết định:** `modern-screenshot` 4.7.0 cho cả PNG và SVG, dùng trong frontend.

**Lý do:** ảnh luôn khớp canvas, kể cả khi phần 9 thêm khung subject area, ghi chú và các thay đổi giao diện sau này, với vài chục dòng code. Thư viện được bảo trì, trong khi thư viện React Flow gợi ý phải khóa ở bản 2023. Đánh đổi cần người dùng xác nhận: file SVG hiển thị đúng trên trình duyệt và nơi nhúng ảnh bằng trình duyệt (GitHub, Confluence, Notion), nhưng không phải SVG vector thuần để sửa trong công cụ thiết kế.

**Phương án bị loại:** `html-to-image` (bảo trì, lý do ở bảng); tự vẽ SVG (hai cách vẽ cùng một sơ đồ phải giữ khớp nhau; nếu người dùng cần SVG vector thuần, đây là thay đổi riêng sau phần 9).

### Ảnh đủ mọi bảng, không bị cắt

`frontend/src/features/import-export/lib/compute-image-frame.ts` là hàm thuần:

1. Khung bao: `getNodesBounds` của React Flow trên **mọi** node (không chỉ node đang thấy), dùng kích thước đã đo; cộng lề `IMAGE_PADDING` 40 px mỗi cạnh. Edge nối giữa các cạnh node nên nằm trong khung bao node, trừ vòng cong của quan hệ tự tham chiếu vốn đi ra ngoài cạnh phải; khung được nới thêm `SELF_RELATION_LOOP_WIDTH` ở cạnh phải khi có quan hệ tự tham chiếu.
2. Ảnh có kích thước bằng khung, tỉ lệ 1 (1 px canvas ở mức zoom 1). Phần tử được chụp là `.react-flow__viewport`, với `transform` của bản clone đặt thành `translate(lề − x, lề − y) scale(1)`; viewport đang xem của người dùng không đổi.
3. **PNG:** hệ số điểm ảnh `scale = min(2, sqrt(MAX_PNG_PIXELS / (rộng × cao)), MAX_PNG_SIDE / max(rộng, cao))` với `MAX_PNG_PIXELS` = 16 777 216 (giới hạn diện tích canvas của Safari trên iOS) và `MAX_PNG_SIDE` = 16 384 (mức an toàn, dưới giới hạn cạnh canvas của các trình duyệt; plan xác nhận trên Chrome, Firefox, Safari). Schema quá lớn thì ảnh nhỏ lại chứ không bị cắt; khi `scale < 1`, toast gợi ý dùng SVG.
4. **SVG:** không có giới hạn điểm ảnh.

Chi tiết khi chụp:

- Bỏ khỏi ảnh: minimap, nền chấm, handle, huy hiệu issue, vòng chọn và vòng focus. Wrapper của canvas nhận `data-exporting="true"` trong lúc chụp; CSS ẩn các phần tử trên theo thuộc tính này, và `filter` của thư viện bỏ phần tử có `data-export-exclude`. Lựa chọn trong store không đổi.
- Nền ảnh là giá trị đã tính của token `--background` ở theme đang dùng. Ảnh luôn theo **theme đang hiển thị**; muốn ảnh theme kia thì đổi theme rồi xuất. Cả hai theme dùng cùng token (spec phần 3, mục 8) nên không có nhánh code riêng.
- Marker chân gà của edge (`relation-markers.tsx`, spec phần 3) phải nằm trong cây DOM được chụp, ví dụ trong `<svg>` của lớp edge; `<defs>` nằm ngoài `.react-flow__viewport` thì bản clone mất marker.
- Nếu phần 3 đã bật `onlyRenderVisibleElements` sau khi đo hiệu năng, export tắt nó trong lúc chụp để mọi node có trong DOM.
- Chụp chạy trên luồng chính (cần DOM). Trong lúc chụp, mục menu hiện trạng thái "Đang tạo ảnh…" và không bấm lại được.
- Không truyền `workerUrl` cho `modern-screenshot`: worker tạo từ URL `blob:` bị `worker-src 'self'` chặn.

## 11. IE-08. Export ZIP

### Chọn thư viện

| Tiêu chí | `fflate` 0.8.3 | `client-zip` 2.5.1 | `jszip` 3.10.2 |
|---|---|---|---|
| Kích thước (esbuild, minify, gzip) | 4,4 KB (`zipSync`, `strToU8`) | 2,7 KB | Lớn hơn nhiều, kéo `pako`, `readable-stream`, `setimmediate`, `lie` |
| Dependency | Không có | Không có | 4 gói |
| Nén | Deflate | Không nén (chỉ lưu) | Deflate |
| Isomorphic | Có (ESM riêng cho trình duyệt và Node) | Cần `Response`, `ReadableStream` | Có |
| Bảo trì | Bản mới nhất 2026-07-20 | 2026-09-14 | 2026-09-08 |
| Giấy phép | MIT | MIT | MIT hoặc GPL-3.0 |

**Quyết định:** `fflate` 0.8.3, chỉ dùng API đồng bộ `zipSync`, chạy trong worker của code panel (spec phần 6, mục 9).

**Lý do:** nhỏ, không dependency, có nén (file SQL, TypeScript nén rất tốt), đặt được `mtime` từng file để output xác định. API bất đồng bộ của `fflate` tự tạo worker từ URL `blob:`, bị `worker-src 'self'` chặn, nên chỉ dùng `zipSync` bên trong worker sẵn có. **Phương án bị loại:** `client-zip` (không nén); `jszip` (nặng, nhiều dependency).

### Nội dung và tính xác định

- Luồng: frontend chụp PNG, SVG trên luồng chính nếu được chọn, rồi gửi `{ document, selections, images }` sang worker (byte của ảnh chuyển bằng transferable). Worker chạy các generator được chọn, `serializeSchemaDocument` nếu có JSON, rồi `zipSync`, trả `Uint8Array` về luồng chính để `downloadBlob`.
- File nằm ở gốc ZIP, tên theo bảng ở mục 9, sắp theo tên. Mọi mục có `mtime` cố định là 1980-01-01 00:00:00 (giá trị nhỏ nhất của định dạng ZIP). Văn bản nén mức 6; PNG lưu không nén (đã nén sẵn).
- Cùng tài liệu, cùng lựa chọn thì cùng từng byte, nên test so sánh được.
- ZIP chỉ được tạo từ nội dung của chính ứng dụng, không đọc ZIP từ người dùng, nên không có rủi ro zip bomb.

### Hộp thoại "Tải ZIP"

| Nhóm | Mục chọn |
|---|---|
| Schema | JSON (IE-06) |
| Ảnh | PNG, SVG |
| SQL DDL | PostgreSQL, MySQL, SQL Server (chọn nhiều) |
| ORM | Prisma kèm chọn `provider`; Drizzle kèm chọn `dialect` (PostgreSQL, MySQL) |
| Code | TypeScript, Zod, Mock API, OpenAPI |
| Dữ liệu | Seed data kèm chọn `format`; `rowsPerTable` và `seed` lấy từ option của code panel |
| Tài liệu | DBML, Markdown (nhãn theo ngôn ngữ đang dùng) |

- Có nút "Chọn tất cả" và "Bỏ chọn tất cả". Lần đầu chỉ chọn JSON; lựa chọn được giữ trong store của editor tới khi đóng schema, không lưu khi tải lại trang (giống đích và option của code panel).
- Dòng tóm tắt: số file sẽ tải và tổng số diagnostic của các generator được chọn. Schema còn issue thì hiện cảnh báo như code panel (spec phần 6, mục 2).
- Nút "Tải" bị disable khi không chọn gì; trong lúc tạo hiện "Đang tạo…". Mọi nhãn qua namespace `importExport`.

## 12. Giao diện

### Điểm vào

| Nơi | Thêm |
|---|---|
| Màn hình danh sách, header | Nút "Import" cạnh "Tạo schema": mở hộp thoại import, chỉ có chế độ tạo schema mới |
| Màn hình danh sách, menu của từng dòng | "Tải JSON": đọc tài liệu, `parseSchemaDocument`, `serializeSchemaDocument`, tải về. Dòng "Schema không đọc được" không có mục này |
| Toolbar editor, sau nhóm thêm bảng và enum | Nút "Import" (có đủ hai chế độ) và menu "Export": "JSON", "Ảnh PNG", "Ảnh SVG", đường phân cách, "ZIP…". Cả hai là nút có icon kèm nhãn đã dịch, theo quy ước toolbar của phần 3 |
| Code panel | Nút "Tải file" (mục 9) |

Tải JSON từ màn hình danh sách giúp sao lưu mà không phải mở editor: dữ liệu local có thể bị trình duyệt xóa (spec phần 3, mục Rủi ro).

### Hộp thoại import

**Bước 1, Nguồn:**

- Hai tab "Chọn file" và "Dán văn bản". Tab file có nút chọn file (`accept=".sql,.prisma,.dbml,.json"`) và vùng thả file; nút chọn file là đường thay thế bằng bàn phím cho thao tác kéo thả.
- Định dạng: SQL, Prisma, DBML, JSON. Chọn file thì tự chọn theo phần mở rộng, người dùng đổi được. SQL cần chọn dialect (PostgreSQL, MySQL, SQL Server): lần đầu chưa chọn sẵn, nên nút "Phân tích" bị disable tới khi chọn; lựa chọn được nhớ tới khi tải lại trang.
- Chế độ (chỉ trong editor): "Tạo schema mới" (mặc định) hoặc "Thêm vào schema hiện tại" (mục 2).
- **Đọc file:** kiểm tra `file.size` với `MAX_IMPORT_FILE_BYTES` trước khi đọc. Đọc byte, nhận diện BOM (UTF-8, UTF-16 LE, UTF-16 BE) rồi giải mã bằng `TextDecoder` với `fatal: true`; không có BOM thì giải mã UTF-8. Hỗ trợ UTF-16 vì "Generate Scripts" của SQL Server Management Studio mặc định lưu Unicode (UTF-16 LE). Giải mã lỗi thì báo "chỉ hỗ trợ UTF-8 và UTF-16" và không phân tích.
- **Dán văn bản:** độ dài UTF-8 (`TextEncoder`) được kiểm tra với cùng giới hạn trước khi gửi sang worker.

**Bước 2, Phân tích:** gửi nguồn sang worker; hộp thoại hiện trạng thái đang phân tích và nút "Hủy" (hủy worker).

**Bước 3, Xem trước:**

- **Không đọc được:** danh sách lỗi, mỗi dòng gồm thông báo đã dịch, "Dòng 12, cột 5" khi có vị trí, và trích đoạn dòng nguồn đó (tối đa 200 ký tự, dấu `^` dưới cột lỗi, ký tự điều khiển thay bằng U+FFFD). Chỉ có nút "Quay lại". Schema hiện tại không đổi.
- **Đọc được:**
  - Tên schema mới (chế độ tạo mới), sửa được, không rỗng.
  - Số lượng: bảng, cột, quan hệ, index, enum, subject area, ghi chú.
  - "Khác với nguồn" (diagnostic của importer và của `buildImportOperation`): thông báo đã dịch, vị trí, tên phần tử, trích đoạn.
  - "Vấn đề cần sửa sau khi import" (`findIntroducedIssues`): thông báo dịch qua namespace `issues`, tên phần tử lấy bằng `resolveIssueTarget` trên tài liệu kết quả.
  - Mỗi danh sách hiện tối đa 200 dòng đầu, kèm "và N mục khác".
  - Nút "Quay lại" và "Import".
- Kết quả phân tích được thông báo qua vùng `aria-live="polite"` ("Tìm thấy 12 bảng, 3 khác biệt, 1 vấn đề"). Khi không đọc được, focus chuyển tới lỗi đầu tiên.

**Xác nhận:** chế độ tạo mới làm theo mục 2; chế độ gộp `dispatch` đúng một operation, chọn các bảng vừa thêm, `fitView` quanh chúng và hiện toast "Đã import 12 bảng" có nút "Hoàn tác", như toast khi xóa ở phần 3.

### Worker import

- `frontend/src/features/import-export/workers/importer.worker.ts`, tạo bằng `new Worker(new URL(…, import.meta.url), { type: 'module' })` như worker của code panel. Worker gọi `z.config({ jitless: true })` trước lần parse đầu tiên.
- Nhận `{ requestId, format, source, fallbackSchemaName, layout, mode, target }` (`target` là tài liệu hiện tại ở chế độ gộp, hoặc `null`). Worker `import()` động subpath của định dạng, chạy importer với `generateId` dùng `crypto.randomUUID`, gọi `buildImportOperation`, áp thử bằng `applyOperation` để đếm phần tử và tính `findIntroducedIssues`, rồi trả `{ requestId, kind: 'success', operation, resultDocument, summary, diagnostics, introducedIssues }` hoặc `{ requestId, kind: 'failure', diagnostics }`.
- Luồng chính dispatch đúng `operation` nhận được; id đã nằm sẵn trong operation nên kết quả trên luồng chính trùng kết quả áp thử.
- Worker được tạo khi mở hộp thoại và bị hủy khi đóng, để giải phóng bộ nhớ của parser. Quá `IMPORT_TIMEOUT_MS` (30 giây) hoặc người dùng bấm "Hủy" thì luồng chính gọi `worker.terminate()`, báo `import-timeout` hoặc trở về bước 1; lần phân tích sau tạo worker mới.

**Lý do chạy trong worker:** parse DDL 189 KB mất 2,1 đến 2,6 giây (mục 5), chạy trên luồng chính sẽ đóng băng giao diện; `@dbml/core` khoảng 2,7 MB gzip phải nằm ngoài bundle của editor; và input bệnh lý (20 000 cặp ngoặc lồng nhau) không trả kết quả sau 90 giây, mà chỉ worker mới hủy được giữa chừng. **Phương án bị loại:** chạy trên luồng chính cho file nhỏ và worker cho file lớn: hai đường code, và kích thước file không dự đoán được thời gian parse.

### i18n

| Namespace | Nội dung |
|---|---|
| `importExport` | Hộp thoại import, menu Export, hộp thoại ZIP, trạng thái tạo ảnh, toast, nhãn vị trí `Dòng {{line}}, cột {{column}}`, tên định dạng và dialect |
| `importDiagnostics` | Một key cho mỗi mã trong `IMPORT_DIAGNOSTIC_CODES`, `satisfies Record<ImportDiagnosticCode, string>`; mã cấu trúc của import JSON dịch bằng namespace `errors` có sẵn |

Thiếu bản dịch cho mã mới của core thì frontend không biên dịch được, cùng cơ chế với `issues` (phần 3) và `generatorDiagnostics` (phần 6).

## 13. Bảo mật

| Mối đe dọa | Biện pháp |
|---|---|
| File lớn làm treo tab hoặc hết bộ nhớ | Kiểm tra `File.size` và độ dài UTF-8 trước khi đọc hoặc gửi; core kiểm tra lại độ dài trước khi parse và số phần tử sau khi parse (mục 1) |
| Input làm parser chạy mãi (ngoặc lồng sâu, backtracking) | Parse trong worker, hủy sau 30 giây. Scanner SQL, lexer Prisma và bộ định vị lỗi JSON là vòng lặp một lượt trên ký tự, không dùng regex có lượng từ lồng nhau trên input |
| Thực thi mã từ input | Không `eval`, `new Function` hay `import()` với dữ liệu người dùng. JSON đọc bằng `JSON.parse`. `@dbml/core` không gọi `Function` trên trình duyệt (mục 1). `Parser.parse` chỉ đọc một chuỗi, không đọc file hay mạng |
| Prototype pollution qua tên | Tra cứu theo tên bằng `Map`; id do core sinh; `parseSchemaDocument` từ chối khóa không đúng dạng id như `__proto__` |
| Chèn mã vào output sinh lại từ schema đã import | Tên kiểu custom không qua cú pháp an toàn bị đổi thành `text` kèm diagnostic; generator vẫn quote, escape và kiểm tra literal bất kể dữ liệu (spec phần 6, mục 2) |
| XSS qua tên, comment, trích đoạn nguồn | Mọi giá trị từ file hiện dạng text React, kể cả trong `title`, `aria-label` và toast; không `dangerouslySetInnerHTML`. Trích đoạn bị cắt độ dài và thay ký tự điều khiển |
| Văn bản sai mã hóa bị hiểu sai | `TextDecoder` với `fatal: true`; chỉ UTF-8 và UTF-16 có BOM |
| File SVG xuất ra chứa script | SVG được dựng từ DOM của canvas, vốn không có script; tên và comment là text node, được escape khi serialize |
| Tên file tải về | `toDownloadBaseName` chỉ cho ASCII chữ thường, số và `-` |
| Zip bomb | Export: ZIP chỉ chứa nội dung do ứng dụng sinh, nên không áp dụng. Import: không đọc ZIP, nên không áp dụng |
| Gọi mạng | Code của phần 7 không gọi mạng; lint cấm `fetch` của phần 3 vẫn áp dụng. `modern-screenshot` tự `fetch` font cùng origin; `connect-src 'self'` giới hạn việc này trong origin của ứng dụng |
| Lộ dữ liệu qua log | Logger chỉ ghi định dạng, mã diagnostic và số lượng; không ghi nội dung nguồn, tên hay comment |

## 14. Hiệu năng

| Chỉ tiêu | Ngưỡng | Cách kiểm tra |
|---|---|---|
| `buildImportOperation` rồi `applyOperation` cho tài liệu 200 bảng × 20 cột, 300 quan hệ (khoảng 4 700 bước trong một `batch`) | Trung vị ≤ 1 giây | `vitest bench` trong core, không nằm trong `pnpm test`; plan ghi kết quả |
| Mỗi importer trên nguồn sinh từ `createLargeSchema()` của phần 6 | SQL ≤ 4 giây (parse đã đo 2,1 đến 2,6 giây); Prisma, DBML, JSON ≤ 1 giây | `vitest bench` trong core |
| Từ lúc bấm "Phân tích" tới bước xem trước, cùng nguồn | SQL ≤ 5 giây; định dạng khác ≤ 2 giây; kéo thả, gõ trong hộp thoại vẫn mượt | Đo tay, bản build production |
| Từ lúc bấm "Import" tới lúc canvas hiện đủ bảng | ≤ 3 giây | Đo tay |
| Tạo PNG, SVG với fixture 100 bảng của phần 3 | ≤ 5 giây mỗi định dạng | Đo tay trên Chrome, Firefox, Safari |
| Tạo ZIP chọn mọi mục với `createLargeSchema()` | ≤ 5 giây, không tính chụp ảnh | Đo tay |

- `applyOperation` sao chép map theo từng bước (structural sharing), nên một `batch` hàng nghìn bước có thể tốn thời gian bậc hai theo số phần tử. Nếu benchmark không đạt, plan tối ưu cách áp `batch` bên trong core (ví dụ dựng các map một lần cho cả batch) mà không đổi hợp đồng của `applyOperation`.
- Autosave ghi một lần sau khi dispatch (spec phần 3, mục 7), không ghi theo từng bước của batch.

## 15. Test

Mọi test tự động chạy bằng Vitest; frontend trên jsdom. Không có test chạy trên trình duyệt. Test cần database thật chỉ chạy trong job CI `conformance`.

### Core (`pnpm test`, coverage ≥ 90%)

**Fixture:** nguồn mẫu là hằng chuỗi trong file TypeScript cạnh importer (`importers/<định dạng>/fixtures/*.fixture.ts`), vì core không dùng `fs` kể cả trong test. Có fixture viết tay theo dạng output của công cụ thật: `pg_dump --schema-only`, `mysqldump --no-data`, "Generate Scripts" của SQL Server Management Studio, `prisma db pull`, file DBML của dbdiagram.io.

**So sánh tương đương:** `toComparableSchema(document)` trong `@schemaforge/core/testing` thay mọi id bằng id chuẩn cấp theo thứ tự xác định của core (bảng, enum, subject area theo tên; cột theo `columnIds`; index, quan hệ theo thứ tự của core; ghi chú theo nội dung), đổi mọi `position` thành `{ x: 0, y: 0 }`, rồi sắp lại khóa của map. Hai tài liệu "bằng nhau theo cấu trúc sau khi chuẩn hóa" khi kết quả của hàm này bằng nhau.

| Nhóm | Hành vi được test |
|---|---|
| Chung cho mọi importer | `source-too-large` ở giới hạn + 1, thành công ở đúng giới hạn; `too-many-elements`; không throw với chuỗi ngẫu nhiên và với fixture bị cắt hoặc chèn ký tự ở vị trí ngẫu nhiên (fast-check, seed cố định); cùng nguồn và bộ đếm id cho cùng tài liệu; diagnostic đã sắp và không lặp; tên bảng `__proto__`, `constructor` |
| Vị trí | Lỗi ở cột đầu dòng cho `{ column: 1 }` với cả parser SQL (cột từ 0) và DBML (cột từ 1); cột tính theo code unit khi dòng có chữ tiếng Việt và emoji trước vị trí lỗi |
| Mã diagnostic | Mỗi mã trong `IMPORT_DIAGNOSTIC_CODES` có ít nhất một test gây ra nó, kiểm tra đúng `code`, `location` và `path` |
| SQL | Scanner: comment, chuỗi, dollar quote, định danh `[…]` và `` `…` ``, `;` trong chuỗi, `GO`; mỗi dòng của bảng phân loại câu lệnh; thay câu lệnh bằng khoảng trắng không làm lệch vị trí lỗi của parser ở câu sau. Mỗi dòng của bảng ánh xạ kiểu và bảng giá trị mặc định (`it.each` theo dialect), kể cả số lớn không mất độ chính xác. Identity qua `ALTER TABLE` và `IDENTITY(1, 1)`; comment của ba dialect; CHECK `IN` thành enum; namespace; phân biệt ràng buộc unique với unique index; suy ra `oneToOne` |
| Prisma | Lexer và parser cho mọi cấu trúc ở mục 6, lỗi cú pháp có vị trí; bảng kiểu theo ba `provider`; `@map`, `@@map`; khóa, index, tùy chọn bị bỏ; `dbgenerated`; loại quan hệ và hành động mặc định theo `provider`; n-n ngầm; `///` |
| DBML | Mỗi dòng của bảng ánh xạ ở mục 7; kiểu có và không có nháy kép trùng tên kiểu chung; mặc định số `12345678901234567890.123`; `<>`; `TableGroup` và `Note` |
| JSON | Vị trí lỗi cú pháp ở nhiều chỗ; lỗi cấu trúc giữ đúng mã và `path` của `parseSchemaDocument`; `version-unsupported` |
| `serializeSchemaDocument` | Thứ tự khóa theo mục 8; xáo thứ tự khóa của map (property test) cho cùng chuỗi; kết thúc bằng `\n` |
| `buildImportOperation` | Chế độ `new` áp lên schema rỗng cho đúng tài liệu nhập; chế độ `merge` đổi tên đúng từng phạm vi (bảng và enum chung không gian tên, index toàn schema, subject area), đổi mọi tham chiếu id, tịnh tiến theo `origin`, batch phẳng; throw khi chế độ `new` nhận schema đích không rỗng. Property test: với tài liệu đích và tài liệu nhập bất kỳ đúng cấu trúc, batch luôn áp được, mọi phần tử cũ giữ nguyên, áp nghịch đảo trả về đúng schema đích |
| Xếp vị trí | Lưới, gom theo subject area, hàng ghi chú, tọa độ nguyên, không chồng nhau với `LayoutMetrics` cho trước |

**Round-trip** (fixture: `createSampleSchema()`, `createNamingEdgeSchema()`, `createTargetLimitSchema()`):

| Định dạng | Tính chất |
|---|---|
| DBML | `importDbml(generateDbml(S))` bằng `S` theo cấu trúc sau khi chuẩn hóa; không có diagnostic |
| Prisma `postgresql` | `importPrisma(generatePrisma(S, postgresql))` bằng `S` theo cấu trúc sau khi chuẩn hóa; không có diagnostic |
| Prisma `mysql`, `sqlserver` | `generatePrisma(importPrisma(P))` bằng đúng `P`, với `P = generatePrisma(S, provider)` |
| SQL, ba dialect | `generate_d(import_d(generate_d(S)))` bằng đúng từng byte `generate_d(S)`; danh sách diagnostic khớp danh sách mong đợi ghi trong test (ví dụ `check-converted-to-enum` với SQL Server) |
| JSON | `serializeSchemaDocument(importJson(serializeSchemaDocument(S)))` bằng đúng chuỗi ban đầu và tài liệu bằng `S` kể cả id, vị trí; thêm property test trên tài liệu đúng cấu trúc bất kỳ |

### Frontend (`pnpm test`, jsdom)

| Loại | Đối tượng và hành vi |
|---|---|
| Unit | `toDownloadBaseName` (chữ tiếng Việt, tên rỗng, ký tự đặc biệt, tên dài); bảng tên file ở mục 9; `downloadBlob` với `URL.createObjectURL` giả và bộ hẹn giờ được truyền vào; `computeImageFrame` (lề, nới cho quan hệ tự tham chiếu, hai giới hạn của PNG); `decodeImportFile` (BOM, UTF-8 sai bị từ chối, file quá lớn bị từ chối mà không đọc byte); `buildZip` (`unzipSync` cho đúng tên theo thứ tự, `mtime` cố định, hai lần tạo cùng byte, PNG không nén); `handleImportRequest` (logic của worker dạng hàm thuần, chạy không cần `Worker`) |
| Component | Hộp thoại import với client worker giả: chọn định dạng theo phần mở rộng; SQL bắt buộc chọn dialect; file quá lớn; lỗi cú pháp hiện thông báo đã dịch, dòng, cột, trích đoạn và không có nút "Import"; bước xem trước hiện số lượng, khác biệt, issue mới; hủy và quá thời gian gọi `terminate`. Menu Export; hộp thoại ZIP (chọn tất cả, bỏ chọn, nút tải bị disable khi rỗng, dòng tóm tắt). `expectNoAxeViolations` cho hai hộp thoại ở cả hai theme |
| Tích hợp (`fake-indexeddb`) | (1) Import DBML từ màn hình danh sách: có bản ghi mới, editor mở với đủ bảng, một lần undo cho schema rỗng, mount lại thấy tài liệu đã lưu. (2) Gộp vào schema đang mở: tên trùng được đổi, một lần undo trả đúng schema cũ, autosave lưu cả hai trạng thái. (3) Export JSON từ editor rồi import JSON thành schema mới: tài liệu giống hệt. (4) File JSON sai cấu trúc: không có bản ghi mới, schema đang mở không đổi |
| Bản dịch | Mở rộng test key của phần 3 cho `importExport`, `importDiagnostics` |

### Kiểm tra tay (checklist trong plan)

Chụp PNG, SVG trên Chrome, Firefox, Safari ở cả hai theme với fixture 100 bảng (đủ bảng, cột, edge, marker, không bị cắt, font đúng); ảnh SVG mở được trên trình duyệt và hiển thị khi nhúng vào README GitHub; tải file thật trên ba trình duyệt; worker import chạy dưới CSP của bản build production, Console không có vi phạm; import một script "Generate Scripts" thật của SQL Server Management Studio (UTF-16 LE); số đo hiệu năng ở mục 14.

### Conformance (chỉ CI, `packages/codegen-conformance`)

| Kiểm chứng | Cách làm |
|---|---|
| Dump thật của PostgreSQL | Chạy DDL CG-01 của fixture trên `postgres:18-alpine`, chạy `pg_dump --schema-only` trong container, `importPostgresql` kết quả rồi `generatePostgresql`: bằng DDL CG-01 ban đầu |
| Dump thật của MySQL | Như trên với `mysql:8.4` và `mysqldump --no-data` |
| `prisma db pull` | Trên hai database vừa tạo (PostgreSQL, MySQL), chạy `prisma db pull` 7.10.0, `importPrisma` kết quả rồi sinh DDL cùng dialect: bằng DDL CG-01 ban đầu, sau các chuẩn hóa plan ghi rõ nếu introspection khác (ví dụ comment) |
| Fixture Prisma của core | `prisma validate` chạy qua với mọi fixture `.prisma` dùng trong unit test, để fixture viết tay đúng với Prisma thật |

SQL Server không có bước dump trong CI: image `mssql/server` không có công cụ xuất script dòng lệnh chuẩn. Dạng script của SQL Server Management Studio được bao bằng fixture viết tay và kiểm tra tay.

## Cấu trúc thư mục

```text
packages/core/src/
  importers/
    shared/     import-diagnostic-codes.ts, import-draft.ts, assemble-document.ts, resolve-references.ts,
                place-elements.ts, source-location.ts, sql-type-mapping.ts, sql-default-mapping.ts,
                dbml-core-adapter.ts (chỉ sql/ và dbml/ import)
    sql/        index.ts, import-sql.ts, statement-scanner.ts, classify-statement.ts,
                postgresql-identity.ts, sqlserver-extended-property.ts, check-to-enum.ts, fixtures/
    prisma/     index.ts, import-prisma.ts, prisma-lexer.ts, prisma-parser.ts, prisma-ast.ts,
                prisma-type-mapping.ts, prisma-relations.ts, fixtures/
    dbml/       index.ts, import-dbml.ts, dbml-type-resolution.ts, fixtures/
    json/       index.ts, import-json.ts, locate-json-syntax-error.ts
  operations/   build-import-operation.ts
  model/        serialize-schema-document.ts
  testing/      to-comparable-schema.ts

frontend/src/
  features/import-export/
    components/ import-dialog.tsx, import-source-step.tsx, import-preview-step.tsx, diagnostic-list.tsx,
                source-excerpt.tsx, export-menu.tsx, zip-dialog.tsx
    workers/    importer.worker.ts, importer-client.ts
    state/      pending-import-provider.tsx
    lib/        handle-import-request.ts, decode-import-file.ts, to-download-base-name.ts,
                download-file-names.ts, compute-image-frame.ts, capture-canvas-image.ts, build-zip.ts
    hooks/      use-pending-import.ts
  lib/download/ download-blob.ts
  features/code-generator/  code-generator.worker.ts thêm yêu cầu tạo ZIP; code-panel thêm nút "Tải file"
```

- `features/import-export` được import từ `features/editor` (menu, hộp thoại) và `features/schema-list` (nút Import, "Tải JSON"). Phần dùng chung giữa hai màn hình nằm trong `features/import-export`, không nằm trong editor, để giữ quy tắc hai feature không import lẫn nhau của phần 3.
- `LayoutMetrics` lấy từ hằng số kích thước export bởi `features/editor/components/canvas/table-node.tsx`; plan có thể chuyển các hằng này vào `lib/` nếu quy tắc import giữa feature cần.

## Vấn đề với các spec đã duyệt

| # | Spec, mục | Hiện ghi | Thay đổi do spec này |
|---|---|---|---|
| 1 | Phần 2, mục 8, bảng chính sách theo nơi gọi | "Import (phần 7): Phần 7 chốt" | Import cho phép issue ngữ nghĩa và hiện issue mới ở bước xem trước (mục 3). Câu hỏi còn mở số 3 của phần 2 được trả lời |
| 2 | Phần 2, tiêu chí "`packages/core` chỉ có runtime dependency là Zod"; phần 6, tiêu chí chung "Core vẫn chỉ có runtime dependency là Zod"; `architecture.md` dòng "Kiểm tra hình dạng trong core" | Zod là runtime dependency duy nhất | Core thêm `@dbml/core`, chỉ được import từ `importers/sql` và `importers/dbml`; entry point chính và các subpath generator vẫn chỉ dùng Zod (mục 1) |
| 3 | Phần 2, mục 12 | Entry point chính không có hàm import, export | Thêm `buildImportOperation`, `serializeSchemaDocument`, type import, `IMPORT_FORMATS`, `IMPORT_DIAGNOSTIC_CODES`, hai hằng giới hạn; subpath `./importers/*`; `toComparableSchema` trong testing |
| 4 | Phần 3, mục 2, toolbar; màn hình danh sách | Không có Import, Export | Thêm nút Import, menu Export; nút Import và mục "Tải JSON" ở danh sách (mục 12) |
| 5 | Phần 3, mục 3, marker chân gà | Không nói `<defs>` nằm ở đâu | `<defs>` của marker phải nằm trong `.react-flow__viewport` để ảnh export có marker (mục 10). Plan phần 3 đang viết nên cần biết điểm này |
| 6 | Phần 3, mục 3, node bảng | "Bề rộng tối thiểu và tối đa cố định" | Hằng bề rộng tối đa, chiều cao tiêu đề, chiều cao dòng cột được export để làm `LayoutMetrics` (mục 4) |
| 7 | Phần 3, `AppProviders`, `EditorScreen` | — | Thêm `PendingImportProvider`; editor dispatch import đang chờ khi mount (mục 2) |
| 8 | Phần 6, mục 8, 9 | Code panel có nút Copy; worker chỉ sinh code | Thêm nút "Tải file"; worker nhận thêm yêu cầu tạo ZIP bằng `fflate` (mục 9, 11) |
| 9 | Phần 6, CG-09 | Round-trip bằng IE-03 làm ở phần 7 | Có ở mục 7 và mục 15 |

## Rủi ro cần kiểm tra khi triển khai

- **Hành vi chưa thử của `@dbml/core`:** tên không quote có bị đổi hoa thường không; model có phân biệt ràng buộc `UNIQUE` với `CREATE UNIQUE INDEX` không; `ALTER TABLE … ADD COLUMN`; khóa ngoại qua `ALTER TABLE` trên SQL Server; `ON UPDATE CURRENT_TIMESTAMP`, cột tính toán, collation của cột, chiều `DESC` và điều kiện `WHERE` của index có bị bỏ âm thầm không. Plan viết test cho từng điểm trước khi viết adapter. Thông tin nào parser bỏ âm thầm thì scanner phát hiện và báo diagnostic, và bảng ở mục 5 được sửa trong cùng thay đổi.
- **Scanner và parser tách câu lệnh khác nhau**, ví dụ `DELIMITER` trong dump MySQL có trigger, hay `GO` giữa chừng một khối. Conformance với `mysqldump` phát hiện; plan thêm `DELIMITER` vào scanner nếu cần.
- **Kích thước `@dbml/core` trong frontend:** chunk worker khoảng 15,8 MB minify (2,7 MB gzip). Plan kiểm tra Turbopack build được, thời gian tải chunk lần đầu nằm trong ngưỡng ở mục 14, và chunk không lọt vào bundle của editor.
- **CSP trong worker:** script của worker nằm trong `_next/static`, không đi qua `proxy.ts`. Plan xác nhận worker không vi phạm CSP và không cần `'unsafe-eval'` (mục 13 dựa trên việc thư viện không gọi `Function` trên trình duyệt).
- **`modern-screenshot` trên React Flow:** edge SVG, marker, font và `foreignObject` trên Safari. Nếu không đạt trên một trình duyệt, phương án dự phòng là `html-to-image` khóa ở 1.11.11 như tài liệu React Flow; nếu cả hai không đạt, cân nhắc lại tự vẽ SVG.
- **Giới hạn canvas và bộ nhớ** khi tạo PNG của schema lớn trên Safari; kiểm tra tay với fixture 100 bảng.
- **Áp `batch` lớn** có thể chậm hơn ngưỡng (mục 14).
- **Parser Prisma tự viết** có thể lệch khi Prisma 8 phát hành chính thức và đổi ngữ pháp; conformance `prisma validate` trên fixture và `prisma db pull` phát hiện.
- **Output của `prisma db pull`** có thể khác CG-02 ở comment và tên enum; plan ghi các chuẩn hóa của conformance test.
- **Giấy phép:** `@dbml/core` dùng Apache-2.0, được đóng gói vào bundle frontend. Plan thêm thông báo giấy phép của thư viện bên thứ ba vào bản build.

## Tiêu chí hoàn thành

Tiêu chí ghi "(kiểm tra tay)" theo checklist ở mục 15; các tiêu chí còn lại có test Vitest hoặc conformance test trong CI.

**Chung**

- [ ] Subpath `@schemaforge/core/importers/sql`, `/prisma`, `/dbml`, `/json` export importer theo mục 1. Entry point chính export `buildImportOperation`, `serializeSchemaDocument`, type import, `IMPORT_FORMATS`, `IMPORT_DIAGNOSTIC_CODES`, `MAX_IMPORT_SOURCE_LENGTH`, `MAX_IMPORTED_ELEMENTS`. `@dbml/core` chỉ được import trong `importers/sql` và `importers/dbml` (lint ranh giới), và `dist/index.js` không tham chiếu tới nó.
- [ ] Không importer nào throw với input bất kỳ (property test); lỗi và diagnostic có dòng, cột khi nguồn cho phép. Mỗi mã trong `IMPORT_DIAGNOSTIC_CODES` có test gây ra nó và có bản dịch `vi`, `en` (frontend không biên dịch được nếu thiếu).
- [ ] File lớn hơn 2 MiB bị từ chối trước khi đọc; core trả `source-too-large` và `too-many-elements` đúng giới hạn.
- [ ] File không đọc được: hộp thoại hiện lỗi đã dịch kèm dòng, cột và trích đoạn; không tạo schema; schema đang mở không đổi.
- [ ] Import vào schema mới: lịch sử của schema mới có đúng một mục, một lần undo cho schema rỗng. Gộp vào schema hiện tại: một mục lịch sử, một lần undo trả đúng schema trước import; tên trùng được đổi kèm diagnostic.
- [ ] Bước xem trước hiện số phần tử, khác biệt so với nguồn và issue mới; issue ngữ nghĩa không chặn import.
- [ ] Parse chạy trong worker, hủy được bằng nút "Hủy", quá 30 giây thì báo lỗi và worker bị hủy.
- [ ] Trên bản build production, không đăng nhập, import mọi định dạng và export mọi loại file: tab Network không có request nào ngoài file tĩnh của ứng dụng, Console không có vi phạm CSP (kiểm tra tay).
- [ ] Mọi chuỗi giao diện mới qua namespace `importExport`, `importDiagnostics`; axe-core không có vi phạm trên hộp thoại import và hộp thoại ZIP ở cả hai theme.
- [ ] Ngưỡng hiệu năng ở mục 14 đạt: benchmark trong core, số đo tay ghi vào PR.

**Theo tính năng**

- [ ] **IE-01:** đọc DDL của PostgreSQL, MySQL, SQL Server thành bảng, cột, khóa chính một và nhiều cột, quan hệ một và nhiều cột kèm hành động, index, enum và comment. View, trigger, sequence, function, CHECK không đổi được thành enum, kiểu và giá trị mặc định ngoài bảng ánh xạ đều có diagnostic tại vị trí trong nguồn. DDL của ba dialect đạt điểm bất động trên ba fixture; fixture dạng `pg_dump`, `mysqldump`, SQL Server Management Studio import đúng; conformance với `pg_dump` và `mysqldump` qua trong CI.
- [ ] **IE-02:** đọc model, trường, quan hệ, enum, `@id`, `@@id`, `@unique`, `@@unique`, `@@index`, `@map`, `@@map`, `Unsupported` và comment `///`. Import output của CG-02 với `postgresql` cho schema bằng bản gốc sau khi chuẩn hóa; với `mysql`, `sqlserver` đạt điểm bất động. Fixture qua `prisma validate` và conformance `prisma db pull` qua trong CI. Core không thêm dependency cho Prisma.
- [ ] **IE-03:** đọc bảng, cột, quan hệ kèm hành động, enum, index, comment, `TableGroup` thành subject area và `Note` thành ghi chú. Import output của CG-09 cho schema bằng bản gốc sau khi chuẩn hóa, không có diagnostic, trên ba fixture.
- [ ] **IE-04:** đọc file JSON qua `parseSchemaDocument`; lỗi cú pháp có dòng, cột; lỗi cấu trúc có mã và đường dẫn. Import file do IE-06 xuất ra thành schema mới cho tài liệu giống hệt bản gốc: cùng id, vị trí, và `serializeSchemaDocument` cho cùng từng byte.
- [ ] **IE-05:** nút "Tải file" trong code panel tải output của mọi đích CG-01 đến CG-10, với tên và phần mở rộng theo bảng ở mục 9, nội dung trùng output đang hiển thị.
- [ ] **IE-06:** tải JSON từ editor và từ màn hình danh sách; file gồm vị trí, subject area và ghi chú; thứ tự khóa ổn định, hai lần export cùng một schema cho cùng từng byte.
- [ ] **IE-07:** tải PNG và SVG chứa mọi bảng, cột và quan hệ, không bị cắt, kể cả khi canvas đang zoom hoặc chỉ thấy một phần sơ đồ. `computeImageFrame` có test; hiển thị trên Chrome, Firefox, Safari ở cả hai theme: kiểm tra tay. PNG của schema vượt giới hạn điểm ảnh được thu nhỏ, không bị cắt.
- [ ] **IE-08:** hộp thoại ZIP chọn được nhiều định dạng; file ZIP chứa đúng các file đã chọn với tên theo mục 9; cùng tài liệu và lựa chọn cho cùng từng byte.
- [ ] Khi xong, `architecture.md`, `roadmap.md`, danh sách tính năng và bảng chính sách theo nơi gọi của spec phần 2 được cập nhật theo mục "Vấn đề với các spec đã duyệt".

## Phạm vi

**Trong phạm vi:**

- Bốn importer trong core (SQL ba dialect, Prisma, DBML, JSON), `buildImportOperation`, `serializeSchemaDocument`, `toComparableSchema`, fixture, round-trip test, benchmark.
- Hộp thoại import, worker import, `PendingImportProvider`; menu Export, tải JSON, PNG, SVG, hộp thoại ZIP; nút "Tải file" của code panel; nút Import và mục "Tải JSON" ở màn hình danh sách; namespace `importExport`, `importDiagnostics`.
- Conformance test cho import trong `packages/codegen-conformance`.

**Ngoài phạm vi:**

| Hạng mục | Làm ở |
|---|---|
| Auto-layout sau import (ED-11) | Phần 9 |
| Lưu và chia sẻ file trên cloud | Phần 4, 8 |
| AI đọc hoặc giải thích file import | Phần 5 |
| Thay thế schema hiện tại; gộp theo tên (cập nhật bảng có sẵn) | Đã loại ở mục 2 |
| n-n ngầm của Prisma và `<>` của DBML thành bảng trung gian | Chưa có tính năng nào cần |
| Import ZIP, nhiều file cùng lúc, từ URL, hoặc kết nối thẳng tới database | Chưa có tính năng nào cần |
| Import Drizzle, TypeScript, OpenAPI; SQLite | Chưa có tính năng nào cần |
| SVG vector thuần, chọn theme khi xuất ảnh, xuất PDF | Chưa có tính năng nào cần (xem câu hỏi 3, 4) |
| Script migration giữa hai phiên bản schema | Chưa có tính năng nào cần |

## Câu hỏi đã trả lời

Người dùng xác nhận khi duyệt spec.

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Câu hỏi 10 của danh sách tính năng: import thay thế schema hiện tại hay gộp vào? | Hai chế độ: tạo schema mới (mặc định) và thêm vào schema hiện tại; không có chế độ thay thế; tên trùng khi gộp được đổi bằng hậu tố `_2`, `_3`… kèm diagnostic (mục 2) |
| 2 | Câu hỏi 3 của spec phần 2: import có dùng chế độ chặt như AI không? | Không; issue mới được liệt kê ở bước xem trước và không chặn import (mục 3) |
| 3 | File SVG dựng bằng `foreignObject` (hiển thị đúng trên trình duyệt và khi nhúng vào GitHub, Notion, nhưng không sửa được trong Figma, Inkscape) có đủ cho IE-07 không? | Đủ; SVG vector thuần là thay đổi riêng sau phần 9 nếu cần (mục 10) |
| 4 | Ảnh export chỉ theo theme đang hiển thị, không có lựa chọn theme riêng. Có đồng ý không? | Đồng ý; muốn ảnh theme kia thì đổi theme rồi xuất (mục 10) |
