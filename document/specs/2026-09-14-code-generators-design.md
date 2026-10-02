# Code generators

Spec cho phần 6 trong [roadmap.md](../roadmap.md): các generator CG-01 đến CG-10 trong `packages/core` và panel xem, copy code ở frontend. Phần 6 chỉ phụ thuộc phần 1 và phần 2, nên được viết song song với editor (phần 3).

Tính năng và tiêu chí nháp lấy từ [2026-09-14-feature-list-design.md](2026-09-14-feature-list-design.md). Model, bộ kiểu chung, giá trị mặc định, quan hệ, luật đặt tên, hàm sắp xếp xác định và hai tầng validation lấy từ [spec phần 2](2026-09-14-core-schema-model-design.md). Cách build, entry point, Vitest và ESLint lấy từ [spec phần 1](2026-09-14-scaffold-tooling-design.md).

Trạng thái: đã duyệt. Người dùng xác nhận các quyết định cần xác nhận: biểu diễn JSON chung (mục 3), nguyên tắc diagnostic cho câu hỏi 7 (mục 4), Drizzle 0.45 chỉ PostgreSQL và MySQL với relations v1 (CG-03), Mock API là một file handler MSW 2 (CG-06), OpenAPI 3.1 dạng JSON có đường dẫn CRUD (CG-07), seed data dùng PRNG trong core, không faker, `SeedDataset` dùng chung với AI-06 (CG-08), và conformance test chỉ chạy trong CI (mục 7) (đã thay ngày 2026-10-02: GitHub Actions bị bỏ, conformance test chạy local qua Docker trên máy dev). Ngày 2026-10-02 orchestrator (được người dùng giao quyết định) chốt thêm cách xử lý 12 vấn đề phát hiện khi lập plan, ghi ở mục [Quyết định bổ sung 2026-10-02](#quyết-định-bổ-sung-2026-10-02).

Các đoạn TypeScript là phác thảo để hình dạng dữ liệu rõ ràng. Plan và code sẽ tinh chỉnh tên và chi tiết, nhưng không đổi quyết định.

Phiên bản trong spec được kiểm tra ngày 2026-09-14 bằng `npm view` (phiên bản, dist-tag, dependency, kích thước), tài liệu qua Context7, và thử nghiệm trong thư mục tạm: `prisma validate` 7.10.0 trên các schema mẫu, typecheck output mẫu của Drizzle 0.45.2, Zod 4.6.5 và TypeScript 6.0.3 ở chế độ strict, parse DBML bằng `@dbml/core` 10.1.1, validate tài liệu OpenAPI 3.1 bằng hai validator, chạy handler MSW 2.15.0 trên Node, highlight bằng Shiki 4.4.3 với regex engine JavaScript và đo kích thước bundle bằng esbuild. Hành vi của database thật chưa được thử trong lúc viết spec; các điểm cần xác nhận được ghi ở mục [Rủi ro](#rủi-ro-cần-kiểm-tra-khi-triển-khai). Ngày 2026-10-02 probe chạy local qua Docker trên MySQL 8.4.11 và SQL Server 2022, và spec được sửa theo kết quả (R20 trong mục [Quyết định bổ sung 2026-10-02](#quyết-định-bổ-sung-2026-10-02)). Cùng ngày, typecheck output Drizzle viết tay với `drizzle-orm` 0.45.3 dẫn tới R21. Ngày 2026-10-03, conformance test của Task 29 trên MySQL 8.4 dẫn tới R25 (vị trí ghi `INDEX` thay thế cho cột `AUTO_INCREMENT` trong SQL, mở rộng ngày 2026-10-03 cho index của người dùng). Cùng ngày, review bảo mật của các generator dẫn tới R26 (siết tên kiểu custom ở phần 2), và conformance test của Task 30 dẫn tới R27 (seed JSON bỏ cột custom có default, Zod vẫn bắt buộc; CG-05).

## Quyết định đã có từ trước

Spec này không bàn lại các điểm sau:

- Generator là hàm thuần `(schema, options) => output`, output xác định (thứ tự ổn định, không có thời gian), mỗi đích một thư mục, quote và escape định danh, đích không biểu diễn được một khái niệm thì báo diagnostic thay vì âm thầm bỏ, snapshot test theo đích (`.claude/rules/core.md`).
- Generator chạy trên trình duyệt bằng core, không cần đăng nhập, không gọi server (tiêu chí chung của nhóm Code Generator).
- Bộ 19 kiểu chung, bảng ánh xạ tham khảo sang ba dialect, hai biểu thức mặc định `currentTimestamp` và `generateUuid`, tên là văn bản tự do tối đa 63 byte, so trùng không phân biệt hoa thường, hàm sắp xếp xác định (spec phần 2).
- Generator nhận tài liệu đúng cấu trúc; chỉ đảm bảo output đúng khi `validateSchema` trả về rỗng (spec phần 2, mục 8).
- Core là ESM, build bằng `tsc`, `exports` có subpath entry point; Zod là runtime dependency của entry chính, `@dbml/core` chỉ được import trong subpath importer (spec phần 1, phần 2, phần 7).
- SQL dialect: PostgreSQL, MySQL, SQL Server. `@dbml/core` là parser cho import (`architecture.md`).
- Tải output thành file là IE-05, file ZIP là IE-08 (phần 7).

## Tóm tắt quyết định

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Giao diện chung | Hàm thuần trả `{ output, diagnostics }`; output là đúng một file (`fileName`, `language`, `content`); diagnostic là `{ code, path }`, không có mức độ, không có thông báo |
| 2 | Nơi đặt | `packages/core/src/generators/<đích>/`, mỗi đích một subpath `@schemaforge/core/generators/<đích>`; phần dùng chung ở `generators/shared/`, không export |
| 3 | Schema còn issue | Vẫn sinh output. Output luôn an toàn (không chèn được mã) nhưng chỉ đảm bảo đúng khi không có issue. Panel hiện cảnh báo kèm số issue |
| 4 | Biểu diễn dữ liệu | TypeScript, Zod, OpenAPI, Mock API và seed JSON dùng chung một biểu diễn JSON: `bigint`, `decimal`, ngày giờ, `binary` là chuỗi |
| 5 | Đích không biểu diễn được (câu hỏi 7) | Bảng ánh xạ kiểu là hợp đồng. Diagnostic khi output mất một ràng buộc, hành động, comment hoặc phần tử có trong schema, hoặc khi kiểu phải rơi ra ngoài bảng ánh xạ. Ánh xạ tương đương không có diagnostic |
| 6 | Định danh | Một bộ hàm dùng chung: quote luôn luôn cho SQL, bỏ dấu tiếng Việt sang ASCII cho định danh code, cấp tên theo thứ tự xác định để tránh trùng, tên ràng buộc theo quy ước PostgreSQL và tối đa 63 byte |
| 7 | CG-01 SQL DDL | Thứ tự: enum, bảng (khóa chính, unique), index, khóa ngoại bằng `ALTER TABLE`, comment. Không có `DROP`, không có option. Kiểm thử trên PostgreSQL 18, MySQL 8.4, SQL Server 2022 |
| 8 | CG-02 Prisma | Prisma 7; option `provider`; trường quan hệ hai phía, tên suy ra từ cột khóa ngoại; `@@map`, `@map` khi tên khác |
| 9 | CG-03 Drizzle | `drizzle-orm` 0.45 (bản ổn định); PostgreSQL và MySQL; relations API v1 (`relations()`). SQL Server chưa hỗ trợ |
| 10 | CG-04 TypeScript | Một type mỗi bảng theo biểu diễn JSON, enum là union chuỗi, nullable là `\| null`. Không có option |
| 11 | CG-05 Zod | Zod 4, một schema mỗi bảng, format cấp cao nhất (`z.guid()`, `z.iso.datetime()`…) |
| 12 | CG-06 Mock API (câu hỏi 8) | Một file handler MSW 2, CRUD cho từng bảng trên kho dữ liệu trong bộ nhớ, dữ liệu ban đầu từ seed |
| 13 | CG-07 OpenAPI | OpenAPI 3.1, định dạng JSON, một component schema mỗi bảng và đường dẫn CRUD trùng với Mock API |
| 14 | CG-08 Seed data (câu hỏi 9) | Dựng `SeedDataset` bằng PRNG có seed trong core, không dùng faker; xuất SQL `INSERT` theo dialect hoặc JSON. AI-06 dùng chung `SeedDataset`, hàm kiểm tra và hàm xuất |
| 15 | CG-09 DBML | Tự sinh văn bản DBML; `@dbml/core` chỉ dùng trong conformance test. Round-trip đầy đủ kiểm tra ở phần 7 |
| 16 | CG-10 Markdown | Cấu trúc cố định; nhãn tiêu đề do frontend truyền vào từ i18n |
| 17 | Kiểm chứng output | Package riêng `packages/codegen-conformance` chạy công cụ đích thật (Testcontainers, `prisma validate`, `tsc`, validator OpenAPI, `@dbml/core`), chạy local qua Docker trên máy dev, không có job CI; core giữ unit test và snapshot, chạy không cần Docker |
| 18 | Code panel | Chọn đích và option, xem code highlight bằng Shiki 4 (regex engine JavaScript, theme CSS variables, render token thành React element), nút copy, danh sách diagnostic dịch qua i18n |
| 19 | Hiệu năng | Sinh code và highlight chạy trong Web Worker; mỗi generator ≤ 100 ms với schema 200 bảng trên máy dev |
| 20 | Test | Snapshot theo đích và fixture, unit test định danh, test theo mã diagnostic, property test xác định và không throw, conformance test |

## 1. Giao diện chung của generator

### Chữ ký

```ts
type GeneratorTarget =
  | 'postgresql' | 'mysql' | 'sqlserver'
  | 'prisma' | 'drizzle' | 'typescript' | 'zod'
  | 'mock-api' | 'openapi' | 'seed' | 'dbml' | 'markdown';

type SqlDialect = 'postgresql' | 'mysql' | 'sqlserver';

type NoOptions = Readonly<Record<string, never>>;

type GeneratorOptions = {
  readonly postgresql: NoOptions;
  readonly mysql: NoOptions;
  readonly sqlserver: NoOptions;
  readonly prisma: { readonly provider: SqlDialect };
  readonly drizzle: { readonly dialect: 'postgresql' | 'mysql' };
  readonly typescript: NoOptions;
  readonly zod: NoOptions;
  readonly 'mock-api': NoOptions;
  readonly openapi: NoOptions;
  readonly seed: { readonly format: SqlDialect | 'json'; readonly rowsPerTable: number; readonly seed: number };
  readonly dbml: NoOptions;
  readonly markdown: { readonly labels: MarkdownLabels };
};

type OutputLanguage = 'sql' | 'prisma' | 'typescript' | 'json' | 'dbml' | 'markdown';

type GeneratedFile = {
  readonly fileName: string;      // ví dụ 'schema.sql', 'schema.prisma', 'handlers.ts'
  readonly language: OutputLanguage;
  readonly content: string;       // kết thúc bằng đúng một '\n'
};

type GeneratorDiagnostic = {
  readonly code: GeneratorDiagnosticCode;
  readonly path: DocumentPath;    // cùng kiểu với Issue của phần 2, ví dụ ['relations', 'rel_1', 'onDelete']
};

type GenerateResult = {
  readonly file: GeneratedFile;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

// Mỗi subpath export đúng một hàm theo mẫu này, ví dụ generatePrisma.
type Generate<T extends GeneratorTarget> = (schema: SchemaDocument, options: GeneratorOptions[T]) => GenerateResult;
```

- **Hàm thuần, dữ liệu vào và ra đều là JSON thuần.** Option không chứa hàm (kể cả nguồn ngẫu nhiên, xem CG-08), nên frontend gửi được schema và option sang Web Worker bằng `postMessage` (mục 9).
- **Không trả `Result`, không throw với input đúng cấu trúc.** Generator luôn sinh được output cho tài liệu đã qua `parseSchemaDocument`, kể cả khi còn issue (mục 2). Option sai miền (ví dụ `rowsPerTable` là 0) là lỗi lập trình vì giao diện đã giới hạn giá trị, nên throw `RangeError`.
- **Diagnostic** sắp theo `path` (so từng phần tử) rồi theo `code`, không lặp cặp `code` và `path`. Không có thông báo, không có tham số hiển thị: frontend dịch `code` qua i18n và lấy tên phần tử từ `path`, như với issue của phần 2. Danh sách hằng `GENERATOR_DIAGNOSTIC_CODES` được export để test kiểm tra đủ bản dịch `vi`, `en`.
- **Không có mức độ.** Mọi diagnostic cùng một nghĩa: output khác schema ở điểm này. Output vẫn được sinh. Lỗi của chính schema là issue ngữ nghĩa, hiển thị riêng (mục 2). Không chỗ nào cần rẽ nhánh theo mức độ, nên thêm mức độ chỉ làm giao diện phải chọn cách hiển thị cho từng mức.

**Phương án bị loại:**

- Output nhiều file (`files: GeneratedFile[]`). Mọi đích đã chọn đều gói gọn trong một file: Drizzle 0.45 đặt bảng và `relations()` cùng file, Mock API là một file handler kèm dữ liệu. Nhiều file sẽ bắt panel có tab file và IE-05 phải nén, trong khi không tiêu chí nào cần. Nếu sau này một đích thật sự cần nhiều file thì đổi kiểu trả về của riêng đích đó.
- Diagnostic có `severity` (`error`, `warning`, `info`): lý do ở trên.
- Một hàm `generate(target, schema, options)` duy nhất ở entry point chính: kéo mọi generator vào bundle của editor, không lazy-load được.

### Nơi đặt và entry point

```text
packages/core/src/generators/
  shared/        identifiers.ts, sql-literals.ts, constraint-names.ts, json-representation.ts,
                 rest-resources.ts, relation-graph.ts, relation-field-names.ts, diagnostic-codes.ts
  postgresql/    index.ts, generate-postgresql.ts, …
  mysql/  sqlserver/  prisma/  drizzle/  typescript/  zod/
  mock-api/  openapi/  seed/  dbml/  markdown/
```

- Ba dialect SQL là ba đích, mỗi đích một thư mục theo `core.md`, dùng chung phần dựng câu lệnh trong `shared/`. Giao diện vẫn gộp thành một mục "SQL DDL" với lựa chọn dialect (mục 8).
- `package.json` của core thêm một pattern vào `exports`: `"./generators/*": { "types": "./dist/generators/*/index.d.ts", "default": "./dist/generators/*/index.js" }`. Mỗi `index.ts` chỉ export hàm generate và type option của đích đó. `generators/shared/` không có trong `exports` nên là nội bộ.
- Entry point chính export thêm phần nhỏ, không kéo code generator: type ở trên, `GENERATOR_TARGETS`, `GENERATOR_DIAGNOSTIC_CODES`, `MarkdownLabels` và type `SeedDataset`. Các hàm seed dùng chung với AI-06 (`buildSeedDataset`, `validateSeedDataset`, `serializeSeedDataset`, mục CG-08) nằm ở subpath `@schemaforge/core/generators/seed`.
- Fixture cho generator nằm trong `src/testing/` cạnh `createSampleSchema()` của phần 2 (mục 10), export qua `@schemaforge/core/testing` để package conformance dùng lại (mục 7).

**Lý do:** frontend `import()` động từng subpath trong worker, nên editor không mang code của 12 đích. Pattern export không phải sửa `package.json` khi thêm đích.

**Phương án bị loại:** một subpath `@schemaforge/core/generators` chứa mọi đích: bundler vẫn tách được nếu tree-shake tốt, nhưng `import()` động của một đích sẽ tải cả module chung lớn; subpath theo đích cho ranh giới chắc chắn.

## 2. Schema còn issue ngữ nghĩa

Trả lời câu hỏi 4 của spec phần 2.

**Quyết định:** generator vẫn sinh output cho tài liệu đúng cấu trúc còn issue ngữ nghĩa, và không tự gọi `validateSchema`.

- **Output luôn an toàn**, bất kể issue: không tên, comment, giá trị enum hay giá trị mặc định nào làm thay đổi cấu trúc của output (chèn câu lệnh SQL, đóng chuỗi, đóng comment). Cụ thể:
  - Định danh và chuỗi luôn được quote và escape theo đích (mục 5), kể cả tên đang có issue `name-invalid`.
  - Tên kiểu custom chỉ được ghi nguyên văn khi qua cú pháp an toàn của phần 2 (dùng chung hàm kiểm tra với `column-custom-type-invalid`). Nếu không, generator SQL ghi kiểu dự phòng của dialect (`text`, `LONGTEXT`, `nvarchar(max)`) kèm diagnostic `custom-type-unsafe`. Các đích khác đặt tên kiểu trong chuỗi đã escape nên không cần dự phòng.
  - Literal mặc định chỉ được ghi khi qua đúng hàm kiểm tra của `column-default-invalid` và `column-default-incompatible`; nếu không thì bỏ giá trị mặc định kèm diagnostic `default-omitted`. Nhờ vậy literal số không bao giờ được ghi không quote khi nó không phải số.
- **Output chỉ được đảm bảo đúng khi không có issue.** Ví dụ hai bảng trùng tên cho hai câu `CREATE TABLE` cùng tên; generator không cố sửa.
- **Hai issue phần 2 thêm theo yêu cầu của phần 6** (quyết định ngày 2026-10-02, Vấn đề 10 và 12 ở mục [Quyết định bổ sung](#quyết-định-bổ-sung-2026-10-02)), để schema hợp lệ không cho DDL lỗi:
  - `table-columns-empty` tại `['tables', id, 'columnIds']`: bảng không có cột. PostgreSQL nhận `CREATE TABLE "t" ();`, nhưng MySQL, SQL Server từ chối bảng không cột. Generator vẫn sinh output an toàn cho bảng rỗng (danh sách cột rỗng, không throw); output chỉ không chạy được ở đích đó.
  - `index-name-conflicts-table` tại `['indexes', id, 'name']`: tên index trùng tên một bảng bất kỳ, so bằng `toNameKey` như các issue trùng tên khác của phần 2. PostgreSQL dùng chung không gian tên cho bảng và index, và phần 6 không đổi tên index của người dùng (mục 5). Mã riêng, không mở rộng `index-name-duplicate`, để thông báo cho người dùng nói đúng nguyên nhân.
- **Panel code** (mục 8) lấy danh sách issue mà editor đã tính. Khi danh sách không rỗng, panel hiện cảnh báo phía trên code: schema còn N lỗi, output có thể không chạy được cho tới khi sửa, kèm nút mở danh sách issue. Code vẫn hiển thị và copy được. Diagnostic của generator hiện ở danh sách riêng.

**Lý do:** người dùng đang sửa dở (đổi tên qua trạng thái trùng, đang nhập precision) vẫn thấy code cập nhật theo từng thao tác, thay vì panel trống. Bảo đảm an toàn là bất biến của generator, nên được test bằng property test trên tài liệu có issue (mục 10), trong khi bảo đảm đúng được test bằng conformance test trên schema hợp lệ (mục 7).

**Phương án bị loại:**

- Từ chối sinh khi còn issue: panel trống mỗi lần schema đi qua trạng thái tạm, và AI hay import tạo ra issue sẽ khóa luôn tính năng sinh code.
- Sinh nhưng tự bỏ các phần tử có issue: mỗi quy tắc cần một cách bỏ riêng, output khó đoán, và người dùng khó biết code thiếu gì.

## 3. Ánh xạ kiểu

Spec phần 2 có bảng ánh xạ tham khảo cho ba dialect. Mục này chốt ánh xạ đầy đủ cho mọi đích. Bảng ánh xạ là hợp đồng của từng generator: dùng đúng bảng thì không có diagnostic (mục 4).

### SQL

| Kiểu chung | PostgreSQL | MySQL | SQL Server |
|---|---|---|---|
| `smallint` / `integer` / `bigint` | `smallint` / `integer` / `bigint` | `SMALLINT` / `INT` / `BIGINT` | `smallint` / `int` / `bigint` |
| `decimal(p, s)` | `numeric(p, s)` | `DECIMAL(p, s)` | `decimal(p, s)` |
| `real` / `double` | `real` / `double precision` | `FLOAT` / `DOUBLE` | `real` / `float(53)` |
| `boolean` | `boolean` | `BOOLEAN` | `bit` |
| `char(n)` / `varchar(n)` | `char(n)` / `varchar(n)` | `CHAR(n)` / `VARCHAR(n)` | `nchar(n)` / `nvarchar(n)` |
| `text` | `text` | `LONGTEXT` | `nvarchar(max)` |
| `uuid` | `uuid` | `CHAR(36)` | `uniqueidentifier` |
| `date` / `time` | `date` / `time` | `DATE` / `TIME(6)` | `date` / `time` |
| `timestamp` | `timestamp` | `DATETIME(6)` | `datetime2` |
| `timestamptz` | `timestamptz` | `TIMESTAMP(6)`, phạm vi 1970–2038 | `datetimeoffset` |
| `json` | `jsonb` | `JSON` | `nvarchar(max)` |
| `binary` | `bytea` | `LONGBLOB` | `varbinary(max)` |
| `enum` | `CREATE TYPE … AS ENUM` | `ENUM(…)` trên cột | `nvarchar(n)` với `n` là độ dài giá trị dài nhất tính theo code unit UTF-16, tối thiểu 1 (quá 4000 thì `nvarchar(max)`, mục 4), kèm `CHECK (… IN (…))` |
| `custom` | ghi nguyên văn | ghi nguyên văn | ghi nguyên văn |
| Auto-increment | `GENERATED BY DEFAULT AS IDENTITY` | `AUTO_INCREMENT` | `IDENTITY(1, 1)` |
| `currentTimestamp` | `now()` | `CURRENT_TIMESTAMP(6)` | `sysdatetime()` cho `datetime2`, `sysdatetimeoffset()` cho `datetimeoffset` |
| `generateUuid` | `gen_random_uuid()` | `(UUID())` | `newid()` |

Chỉnh so với bảng tham khảo của phần 2, không đổi model:

- MySQL dùng độ chính xác phân số giây 6 (`TIME(6)`, `DATETIME(6)`, `TIMESTAMP(6)`), bằng PostgreSQL. Literal mặc định của phần 2 cho phép phần giây lẻ; `DATETIME` không có độ chính xác sẽ cắt mất. MySQL yêu cầu `CURRENT_TIMESTAMP(6)` khớp độ chính xác của cột.
- SQL Server dùng `sysdatetime()` cho cột `datetime2`: `sysdatetimeoffset()` đổi ngầm sang `datetime2` sẽ bỏ độ lệch múi giờ.
- PostgreSQL dùng identity `BY DEFAULT` (không phải `ALWAYS`) để seed data (CG-08) chèn được giá trị khóa tường minh.

Literal mặc định được ghi theo kiểu cột: chuỗi trong nháy đơn đã escape (mục 5); số nguyên, số thập phân không quote sau khi qua hàm kiểm tra literal; boolean là `true`/`false` (PostgreSQL), `TRUE`/`FALSE` (MySQL), `1`/`0` (SQL Server); ngày giờ, `uuid`, `json`, enum là chuỗi. MySQL bọc literal của cột `LONGTEXT`, `JSON`, `LONGBLOB` trong ngoặc (`DEFAULT ('…')`) vì các kiểu này chỉ nhận giá trị mặc định dạng biểu thức.

**Giây lẻ trên SQL Server** (quyết định ngày 2026-10-02, Vấn đề 8): literal `time`, `timestamp`, `timestamptz` của phần 2 cho phép số chữ số giây lẻ bất kỳ. Hàm literal SQL Server cắt phần giây lẻ về 7 chữ số (cắt, không làm tròn, để không phải nhớ sang giây, phút, ngày), không có diagnostic. Lý do là căn literal theo độ chính xác 7 chữ số của `datetime2(7)`, `datetimeoffset(7)`, `time(7)` để output không phụ thuộc cách SQL Server xử lý chữ số thừa, không phải để tránh lỗi: SQL Server 2022 nhận cả literal 8 chữ số, kể cả khi một dòng dùng giá trị mặc định đó (probe 3, R20). Mọi output SQL Server dùng hàm này nên cùng hành vi: giá trị mặc định của CG-01, `dbgenerated("…")` của Prisma `sqlserver`, seed SQL `sqlserver`. PostgreSQL làm tròn về 6 chữ số theo độ chính xác cột, nên giữ nguyên literal. Hàm literal MySQL luôn cắt giây lẻ về 6 chữ số (độ chính xác cột của CG-01), không diagnostic, như SQL Server. Mọi output MySQL dùng hàm này nên cùng hành vi: giá trị mặc định của CG-01, `dbgenerated("…")` của Prisma `mysql`, giá trị mặc định của Drizzle MySQL, seed SQL `mysql`. Chữ số bị bỏ nằm dưới độ chính xác 1 µs của `DATETIME(6)`, `TIME(6)`, `TIMESTAMP(6)`, nên theo nguyên tắc 2 của mục 4 là ánh xạ tương đương. Cắt thay vì để MySQL làm tròn, vì làm tròn có thể nhớ sang giây, giờ, ngày kế tiếp (sửa sau review ngày 2026-10-02). Probe chỉ còn là kiểm tra sanity (mục [Rủi ro](#rủi-ro-cần-kiểm-tra-khi-triển-khai)); MySQL 8.4.11 nhận cả literal 9 chữ số trên cả ba kiểu (probe 14). Không đổi validation phần 2: thay đổi nhỏ hơn, và schema đã lưu vẫn hợp lệ. Bỏ chữ số thứ 8 trở đi nằm dưới độ chính xác 100 ns của `datetime2`, `datetimeoffset`, `time`, nên theo nguyên tắc 2 của mục 4 là ánh xạ tương đương.

**Độ lệch UTC của `timestamptz` trên MySQL** (R20): literal `timestamptz` của phần 2 kết thúc bằng `Z` hoặc độ lệch `±hh:mm`. MySQL 8.4.11 từ chối (lỗi 1067 `Invalid default value`) literal mặc định của cột `TIMESTAMP(6)` kết thúc bằng `Z` hoặc `-00:00`, nhưng nhận `+00:00` và các độ lệch khác như `+07:00`, với cả dấu cách lẫn `T` giữa ngày và giờ (probe 10, 17). Vì vậy hàm literal MySQL đổi hậu tố `Z` và `-00:00` thành `+00:00`, không diagnostic: cùng một thời điểm, nên theo nguyên tắc 2 của mục 4 là ánh xạ tương đương. Mọi output MySQL dùng hàm này nên cùng hành vi: giá trị mặc định của CG-01, `dbgenerated("…")` của Prisma `mysql`, giá trị mặc định của Drizzle MySQL, seed SQL `mysql`. PostgreSQL và SQL Server giữ nguyên hậu tố.

### Prisma

| Kiểu chung | `postgresql` | `mysql` | `sqlserver` |
|---|---|---|---|
| `smallint` / `integer` / `bigint` | `Int @db.SmallInt` / `Int` / `BigInt` | như PostgreSQL | như PostgreSQL |
| `decimal(p, s)` | `Decimal @db.Decimal(p, s)` | như PostgreSQL | như PostgreSQL |
| `real` / `double` | `Float @db.Real` / `Float` | `Float @db.Float` / `Float` | `Float @db.Real` / `Float` |
| `boolean` | `Boolean` | `Boolean` | `Boolean` |
| `char(n)` / `varchar(n)` | `String @db.Char(n)` / `String @db.VarChar(n)` | như PostgreSQL | `String @db.NChar(n)` / `String @db.NVarChar(n)` |
| `text` | `String` | `String @db.LongText` | `String @db.NVarChar(Max)` |
| `uuid` | `String @db.Uuid` | `String @db.Char(36)` | `String @db.UniqueIdentifier` |
| `date` / `time` | `DateTime @db.Date` / `DateTime @db.Time(6)` | `DateTime @db.Date` / `DateTime @db.Time(6)` | `DateTime @db.Date` / `DateTime @db.Time` |
| `timestamp` | `DateTime @db.Timestamp(6)` | `DateTime @db.DateTime(6)` | `DateTime @db.DateTime2` |
| `timestamptz` | `DateTime @db.Timestamptz(6)` | `DateTime @db.Timestamp(6)` | `DateTime @db.DateTimeOffset` |
| `json` | `Json` | `Json` | `String @db.NVarChar(Max)`, diagnostic |
| `binary` | `Bytes` | `Bytes @db.LongBlob` | `Bytes` |
| `enum` | `enum` | `enum` | `String @db.NVarChar(n)`, diagnostic |
| `custom` | `Unsupported("…")` | `Unsupported("…")` | `Unsupported("…")` |

- Native type (`@db.*`) được chọn để database do Prisma tạo có đúng kiểu như DDL của CG-01 cùng dialect. Plan xác nhận từng thuộc tính bằng `prisma validate` (mục 7).
- Giá trị mặc định: `autoincrement()`, `now()`, `uuid()` theo phần 2; literal dùng dạng Prisma nhận được cho kiểu (số, chuỗi, boolean, giá trị enum); literal Prisma không biểu diễn được (ví dụ `time`, `date`) dùng `dbgenerated("…")` với literal SQL của CG-01 cùng dialect, đặt trong chuỗi Prisma đã escape. Với `mysql`, literal trên cột có kiểu đích là `LONGTEXT`, `JSON` hoặc `LONGBLOB` (gồm cột `char`, `varchar` đổi sang `LONGTEXT` theo R13) là `dbgenerated("(<literal>)")`, ví dụ `@default(dbgenerated("('a''b')"))`, không phải `@default("…")`: MySQL chỉ nhận mặc định dạng biểu thức trong ngoặc trên các kiểu này (như CG-01), và `prisma validate` không bắt lỗi này (R19).
- `prisma validate` 7.10.0 xác nhận: SQL Server không có enum, không có kiểu `Json`, không nhận `Restrict`; `Unsupported` dùng được trong `@@unique`, `@@index`.

### Drizzle

| Kiểu chung | PostgreSQL (`drizzle-orm/pg-core`) | MySQL (`drizzle-orm/mysql-core`) |
|---|---|---|
| `smallint` / `integer` / `bigint` | `smallint` / `integer` / `bigint({ mode: 'bigint' })` | `smallint` / `int` / `bigint({ mode: 'bigint' })` |
| `decimal(p, s)` | `numeric({ precision, scale })` | `decimal({ precision, scale })` |
| `real` / `double` | `real` / `doublePrecision` | `float` / `double` |
| `boolean` | `boolean` | `boolean` |
| `char(n)` / `varchar(n)` | `char({ length })` / `varchar({ length })` | như PostgreSQL |
| `text` | `text` | `longtext` |
| `uuid` | `uuid` | `char({ length: 36 })` |
| `date` / `time` | `date` / `time({ precision: 6 })` | `date` / `time({ fsp: 6 })` |
| `timestamp` | `timestamp({ precision: 6 })` | `datetime({ fsp: 6 })` |
| `timestamptz` | `timestamp({ precision: 6, withTimezone: true })` | `timestamp({ fsp: 6 })` |
| `json` | `jsonb` | `json` |
| `binary` | `customType` với `dataType` là `bytea` (0.45 chưa có builder) | `customType` với `LONGBLOB` (0.45 chưa có builder) |
| `enum` | `pgEnum` | `mysqlEnum` trên cột |
| `custom` | `customType` với `dataType` là tên kiểu | như PostgreSQL |

- Dùng mode mặc định của Drizzle cho từng builder, trừ `bigint` dùng mode `'bigint'` để không mất độ chính xác (mode là tham số bắt buộc).
- Giá trị mặc định dùng API có kiểu khi có (`.default('…')`, `.defaultNow()`, `.defaultRandom()`, `.generatedByDefaultAsIdentity()`, `.autoincrement()`); còn lại dùng `sql` với literal SQL của CG-01 cùng dialect.

### Biểu diễn JSON cho TypeScript, Zod, OpenAPI, Mock API và seed JSON

| Kiểu chung | Giá trị JSON | TypeScript | Zod 4 | OpenAPI 3.1 |
|---|---|---|---|---|
| `smallint` | số | `number` | `z.int().min(-32768).max(32767)` | `integer`, `minimum`, `maximum` |
| `integer` | số | `number` | `z.int32()` | `integer`, `format: int32` |
| `bigint` | chuỗi số nguyên | `string` | `z.string().regex(…)` | `string`, `pattern` |
| `decimal(p, s)` | chuỗi số thập phân | `string` | `z.string().regex(…)` theo `p`, `s` | `string`, `pattern` |
| `real` / `double` | số | `number` | `z.number()` | `number`, `format: float` / `double` |
| `boolean` | boolean | `boolean` | `z.boolean()` | `boolean` |
| `char(n)`, `varchar(n)` | chuỗi | `string` | `z.string().max(n)` | `string`, `maxLength` |
| `text` | chuỗi | `string` | `z.string()` | `string` |
| `uuid` | chuỗi `8-4-4-4-12` | `string` | `z.guid()` | `string`, `format: uuid` |
| `date` | `YYYY-MM-DD` | `string` | `z.iso.date()` | `string`, `format: date` |
| `time` | `HH:MM:SS`, giây lẻ tùy chọn | `string` | `z.iso.time()` | `string`, `pattern` |
| `timestamp` | `YYYY-MM-DDTHH:MM:SS`, không múi giờ | `string` | `z.iso.datetime({ local: true })` | `string`, `pattern` |
| `timestamptz` | như trên, kèm `Z` hoặc độ lệch | `string` | `z.iso.datetime({ offset: true })` | `string`, `format: date-time` |
| `json` | giá trị JSON bất kỳ | `JsonValue` (khai báo một lần trong file) | `z.json()` | `{}` |
| `binary` | chuỗi base64 | `string` | `z.base64()` | `string`, `contentEncoding: base64` |
| `enum` | chuỗi thuộc enum | type union riêng | schema `z.enum([…])` riêng | component riêng, tham chiếu bằng `$ref` |
| `custom` | không xác định | `unknown`, diagnostic | `z.unknown()`, diagnostic | `{}`, diagnostic |
| Nullable | `null` | `T \| null` | `.nullable()` | `type: [T, "null"]`, hoặc `anyOf` với `{ "type": "null" }` khi là `$ref` |

- Dạng chuỗi của ngày giờ, `uuid`, số thập phân trùng dạng literal của phần 2, nên một hàm kiểm tra dùng chung cho giá trị mặc định, seed data và dữ liệu AI-06.
- `z.guid()` nhận mọi chuỗi hex `8-4-4-4-12`, đúng như kiểu `uuid` của PostgreSQL và literal của phần 2; `z.uuid()` từ chối UUID không đúng variant RFC 9562 (đã thử). `z.iso.datetime({ local: true })` cũng nhận chuỗi có `Z`, lỏng hơn một chút so với kiểu `timestamp`; chấp nhận.
- OpenAPI dùng `pattern` cho `time` và `timestamp` vì format `time`, `date-time` theo RFC 3339 bắt buộc có múi giờ.

**Lý do chọn biểu diễn JSON:** bốn đích này mô tả dữ liệu đi qua API và file JSON, nơi `bigint` và `decimal` dạng số mất độ chính xác, còn `Date`, `bigint`, `Uint8Array` không serialize được. Dùng chung một biểu diễn thì type TypeScript, schema Zod, OpenAPI, dữ liệu mock và seed JSON khớp nhau, và conformance test kiểm tra được seed JSON bằng chính schema Zod sinh ra (mục 7). Kiểu native của JavaScript đã có ở Prisma và Drizzle.

**Phương án bị loại:** kiểu native (`bigint`, `Date`, `Uint8Array`) cho TypeScript và Zod: không mô tả được dữ liệu JSON, lệch với OpenAPI và Mock API, và khác nhau theo driver. Option chọn cách biểu diễn (`dateType`, `bigintType`): không tiêu chí nào cần.

## 4. Đích không biểu diễn được một khái niệm

Trả lời câu hỏi 7 trong danh sách tính năng.

### Nguyên tắc

1. **Bảng ánh xạ ở mục 3 là hợp đồng.** Dùng đúng bảng thì không có diagnostic, kể cả khi kiểu đích lỏng hơn kiểu chung (MySQL `CHAR(36)` cho `uuid`, `TIMESTAMP(6)` giới hạn năm 2038).
2. **Ánh xạ tương đương không có diagnostic:** database chấp nhận và từ chối cùng một tập dữ liệu, cùng hành vi. Ví dụ MySQL `ENUM` trên cột, SQL Server `CHECK` cho enum, SQL Server `NO ACTION` thay `RESTRICT` (SQL Server không có ràng buộc trì hoãn nên hai hành động như nhau).
3. **Ánh xạ gần nhất kèm diagnostic** khi output vẫn giữ phần lớn ý nghĩa nhưng mất một ràng buộc, đổi một hành động, hoặc kiểu phải rơi ra ngoài bảng ánh xạ.
4. **Bỏ kèm diagnostic** khi không có ánh xạ nào giữ được ý nghĩa.
5. **Không áp dụng thì không có diagnostic.** TypeScript không có index; Mock API và seed data tạo dữ liệu, không mô tả schema, nên không mang comment, index hay hành động ON DELETE; subject area, ghi chú và vị trí là cách tổ chức canvas, chỉ DBML mang theo.

**Phương án bị loại:** diagnostic cho mọi ánh xạ làm lỏng kiểu: mỗi cột `uuid` trên MySQL sinh một diagnostic, danh sách dài đến mức người dùng bỏ qua cả diagnostic quan trọng. Bỏ mọi thứ đích không hỗ trợ: mất cả những gì ánh xạ gần nhất giữ được (Prisma trên SQL Server vẫn có cột chuỗi cho enum).

### Danh mục mã diagnostic

`GENERATOR_DIAGNOSTIC_CODES` gồm đúng 17 mã dưới đây, theo thứ tự của bảng. Mã thứ 17 `comment-truncated` (đứng sau `null-character-removed`, trước `seed-table-skipped`) được thêm ngày 2026-10-02 (Vấn đề 2); các dòng `type-parameter-out-of-range`, `key-column-type-narrowed`, `key-column-type-not-indexable`, `referential-action-cycle` được bổ sung cùng ngày (Vấn đề 1, 4, 6).

| Mã | Đích | Điều kiện | Output |
|---|---|---|---|
| `enum-not-supported` | Prisma `sqlserver` | Cột kiểu enum | `String @db.NVarChar(n)`, mất ràng buộc giá trị |
| `type-not-supported` | Prisma `sqlserver` | Cột kiểu `json` | `String @db.NVarChar(Max)` |
| `type-parameter-out-of-range` | SQL, Prisma, Drizzle | Tham số kiểu vượt giới hạn dialect, hoặc MySQL: dòng vượt 65 535 byte (cột `CHAR`, `VARCHAR` lớn nhất không thuộc khóa chính, unique, index hay cặp cột quan hệ thành `LONGTEXT`, mục này). Giới hạn: PostgreSQL `char(n)`, `varchar(n)` > 10 485 760, `numeric` precision > 1000; MySQL `CHAR(n)` > 255, `VARCHAR(n)` > 16 383, `DECIMAL` precision > 65 hoặc scale > 30; SQL Server `nchar`, `nvarchar` > 4000, `decimal` precision > 38, enum có giá trị dài hơn 4000 code unit UTF-16 | `CHAR` → `VARCHAR(n)`; `VARCHAR`, `nvarchar`, `nchar` quá dài (PostgreSQL cả `char`) → kiểu văn bản không giới hạn của dialect; enum SQL Server → `nvarchar(max)`; precision, scale kẹp về giới hạn |
| `key-column-type-narrowed` | MySQL, SQL Server (SQL, Prisma, Drizzle) | Cột `text` thuộc khóa chính, unique, index hoặc cặp cột quan hệ. MySQL: cả cột `char(n)`, `varchar(n)` có `n > 768` ở các vị trí đó, kể cả cột vượt giới hạn của `type-parameter-out-of-range` có `n > 768`: cột đó nhận cả hai diagnostic và thành thẳng `VARCHAR(768)`, không đi qua `LONGTEXT` rồi `VARCHAR(255)` (ví dụ `varchar(20000)` trong một unique). SQL Server: phần độ dài cố định của khóa vượt 900 byte (khóa chính) hoặc 1700 byte (unique, index) | MySQL `VARCHAR(255)` cho `text`, `VARCHAR(768)` cho `char`, `varchar` có `n > 768`; SQL Server `nvarchar(450)` cho `text`, mọi cột `nchar(n)` của khóa vượt giới hạn thành `nvarchar(n)`, lan bắc cầu tới mọi cột ghép cặp qua quan hệ (mỗi cột một diagnostic) |
| `key-column-type-not-indexable` | MySQL, SQL Server (SQL, Prisma, Drizzle) | Cột `json` hoặc `binary` thuộc khóa chính, unique hoặc index; MySQL: tổng độ dài khóa sau khi hẹp vẫn vượt 3072 byte (4 byte mỗi ký tự với `utf8mb4`); SQL Server: phần độ dài cố định sau khi hẹp vẫn vượt 900 hoặc 1700 byte | Bỏ ràng buộc, index đó và khóa ngoại tham chiếu tới nó |
| `referential-action-not-supported` | MySQL (SQL, Prisma, Drizzle) | `setDefault` (tài liệu MySQL ghi InnoDB không hỗ trợ; 8.4.11 chấp nhận nhưng không bảo đảm, R20) | `NO ACTION` |
| `referential-action-cycle` | SQL Server (SQL, Prisma) | Hành động khác `noAction` và `restrict` làm xuất hiện vòng, hoặc đường cascade thứ hai giữa hai bảng | Cả ON DELETE và ON UPDATE của quan hệ đó thành `NO ACTION` |
| `unique-nulls-restricted` | SQL Server: SQL khi ràng buộc unique có cột nullable được khóa ngoại tham chiếu; Prisma mọi unique có cột nullable | Unique trên cột nullable | `UNIQUE` của SQL Server chỉ cho một dòng `NULL` |
| `table-without-identifier` | Prisma, OpenAPI, Mock API | Prisma: không có khóa chính hay unique nào chỉ gồm cột bắt buộc, không phải `Unsupported`. OpenAPI, Mock API: bảng không có khóa chính | Prisma: `@@ignore` trên model và `@ignore` trên trường quan hệ trỏ tới model. OpenAPI, Mock API: chỉ có đường dẫn danh sách và tạo mới |
| `custom-type-unmapped` | TypeScript, Zod, OpenAPI, Mock API | Cột kiểu `custom` | `unknown`, `z.unknown()`, `{}` |
| `custom-type-unsafe` | SQL | Tên kiểu custom sai cú pháp an toàn (schema có issue) | Kiểu văn bản không giới hạn của dialect |
| `default-omitted` | Mọi đích ghi giá trị mặc định | Literal không hợp lệ với kiểu cột (schema có issue) | Bỏ giá trị mặc định |
| `identifier-collision-renamed` | MySQL (SQL, Prisma, Drizzle) | Hai tên cột trong một bảng, hoặc hai tên index trong một bảng, trùng nhau khi so không phân biệt hoa thường (MySQL so định danh cột, index không phân biệt hoa thường nhưng phân biệt dấu, mục 5, R20). Phần 2 đã cấm các tên này (`column-name-duplicate`, `index-name-duplicate`), nên chỉ xảy ra khi schema có issue | Tên đứng sau theo thứ tự xác định được thêm hậu tố `_2`, `_3`… |
| `null-character-removed` | PostgreSQL | Comment hoặc literal chứa U+0000 (PostgreSQL không lưu được) | Bỏ ký tự đó |
| `comment-truncated` | MySQL, SQL Server (SQL) | Comment vượt giới hạn của đích: MySQL comment cột quá 1024 ký tự, comment bảng quá 2048 ký tự (strict mode mặc định từ chối); SQL Server giá trị `MS_Description` quá 3750 ký tự `nvarchar` (7500 byte) | Cắt comment về giới hạn ở ranh giới code point; `path` là đường dẫn `comment` của bảng hoặc cột (thêm ngày 2026-10-02) |
| `seed-table-skipped` | Seed | Cột bắt buộc không sinh được giá trị (kiểu custom không có mặc định), vòng khóa ngoại chỉ gồm cột bắt buộc, hoặc bảng được tham chiếu bị bỏ | Bảng không có dòng nào |
| `seed-rows-reduced` | Seed | Ràng buộc unique không đủ giá trị khác nhau (cột `boolean` unique, enum ít giá trị, quan hệ 1-1 với bảng cha ít dòng hơn) | Ít dòng hơn `rowsPerTable` |

`path` trỏ tới phần tử gây ra diagnostic: cột (`['columns', id, 'type']`), hành động (`['relations', id, 'onDelete']`), bảng, index, giá trị mặc định, hoặc comment (`['tables', id, 'comment']`, `['columns', id, 'comment']` cho `comment-truncated`).

**Độ dài khóa trên MySQL** (Vấn đề 1, phương án (a)): InnoDB giới hạn tổng độ dài khóa 3072 byte, và với `utf8mb4` mỗi ký tự tính 4 byte. Generator MySQL xét từng khóa chính, unique, index sau khi đã hẹp `text`: cột `char(n)`, `varchar(n)` có `n > 768` thành `VARCHAR(768)` kèm `key-column-type-narrowed`. Cột vượt giới hạn của `type-parameter-out-of-range` có `n > 768` (`char(n)` với `n > 768`, `varchar(n)` với `n > 16 383`) mà thuộc khóa cũng thành thẳng `VARCHAR(768)` và nhận cả hai diagnostic, không đi qua `LONGTEXT` rồi `VARCHAR(255)`: `varchar(20000)` trong một unique cho `VARCHAR(768)`, `type-parameter-out-of-range` và `key-column-type-narrowed`. Cột vượt giới hạn có `n ≤ 768` chỉ đổi theo `type-parameter-out-of-range`: `char(300)` thành `VARCHAR(300)`. Sau đó, nếu tổng độ dài khóa vẫn vượt 3072 byte (cột `CHAR(n)`, `VARCHAR(n)` sau khi hẹp, kể cả `uuid` là `CHAR(36)`, tính `4 × n` byte; cột kiểu khác tính 32 byte, cận trên của mọi kiểu số, ngày giờ, boolean và enum trên MySQL vì `DECIMAL(65, 30)` lưu 30 byte; cột custom tính 0 vì không biết kích thước; ước lượng dư chỉ ảnh hưởng khóa sát ngưỡng) thì bỏ ràng buộc hoặc index đó cùng khóa ngoại tham chiếu tới nó, kèm `key-column-type-not-indexable`. Lý do: giữ tiêu chí "DDL chạy không lỗi với schema hợp lệ" mà không bắt phần 2 giới hạn độ dài.

**Cột `AUTO_INCREMENT` trên MySQL** (sửa sau review ngày 2026-10-02, tổng quát hóa R8): MySQL báo lỗi 1075 khi cột `AUTO_INCREMENT` không phải cột đầu của một index nào. Sau khi đã bỏ các ràng buộc, index theo quy tắc trên, nếu không còn khóa chính, unique hay index nào của bảng bắt đầu bằng cột `AUTO_INCREMENT`, generator thêm `INDEX` thường chỉ trên cột đó, tên `<bảng>_<cột>_idx` cấp qua cùng allocator với tên ràng buộc (mục 5). Trong SQL (CG-01), index này được ghi **bên trong `CREATE TABLE`** dưới dạng ``KEY `<bảng>_<cột>_idx` (`<cột>`)``, sau dòng khóa chính và các dòng `UNIQUE`, không phải `CREATE INDEX` đứng riêng sau mọi bảng, vì MySQL kiểm tra lỗi 1075 ngay lúc `CREATE TABLE` (R25); mọi index khác vẫn là `CREATE INDEX` riêng. **Index của người dùng** (mở rộng R25): khi một index của người dùng có cột đầu là cột `AUTO_INCREMENT` (nên theo R14 không cần `INDEX` thay thế), index đó cũng phải nằm **bên trong `CREATE TABLE`**, vì `CREATE INDEX` đứng riêng cũng bị lỗi 1075 như trên. Với mỗi cột `AUTO_INCREMENT` mà khóa chính và ràng buộc unique đều không bắt đầu bằng nó, generator chọn index **đầu tiên** theo thứ tự `model.indexes` có cột đầu là cột đó và ghi dòng ``KEY `<tên index>` (<các cột>)``, hoặc ``UNIQUE KEY`` nếu index là unique, ở cùng vị trí với dòng thay thế (sau dòng khóa chính và các dòng `UNIQUE`); index này không còn là `CREATE INDEX`. Các index khác của người dùng, kể cả index thứ hai trở đi bắt đầu bằng cột đó, vẫn là `CREATE INDEX` riêng. Trường hợp này gồm cả khóa bị bỏ lẫn khóa chính nhiều cột có cột `AUTO_INCREMENT` không đứng đầu (hợp lệ theo phần 2). Không có diagnostic: index thêm vào không làm mất gì của schema. Prisma `mysql` ghi `@@index([cột], map: "<bảng>_<cột>_idx")` vì Prisma bắt `autoincrement()` có index; Drizzle MySQL ghi `index("<bảng>_<cột>_idx").on(…)`.

**Kích thước dòng trên MySQL** (sửa sau review ngày 2026-10-02): tổng kích thước các cột của một dòng không được vượt 65 535 byte, nếu không MySQL báo lỗi 1118. Generator MySQL tính cho từng bảng, sau khi đã hẹp cột khóa: `CHAR(n)`, `VARCHAR(n)` tính `4 × n` byte, cộng 2 byte độ dài cho mỗi `VARCHAR`; cột `LONGTEXT`, `JSON`, `LONGBLOB` tính 12 byte (phần con trỏ tính vào giới hạn); cột kiểu khác tính 32 byte như quy tắc độ dài khóa; cột custom tính 0; cộng `⌈số cột nullable / 8⌉` byte bit null. Khi tổng vượt 65 535 byte, generator đổi cột `CHAR`, `VARCHAR` lớn nhất không thuộc khóa chính, unique, index hay cặp cột quan hệ (theo `n`, bằng nhau thì cột đứng trước theo `columnIds`) thành `LONGTEXT` kèm `type-parameter-out-of-range`, rồi tính lại, lặp tới khi không vượt. Cột thuộc khóa chính, unique, index hay cặp cột quan hệ không bị đổi: MySQL không cho khóa ngoại hay index không có độ dài tiền tố trên cột `LONGTEXT`, và các cột này đã tối đa `VARCHAR(768)`; nếu chỉ còn cột khóa mà vẫn vượt (cần trên 20 cột khóa 768 ký tự) thì giữ nguyên, là giới hạn đã chấp nhận. Giá trị mặc định của cột vừa đổi sang `LONGTEXT` ghi dạng biểu thức trong ngoặc như mục 3. Ví dụ bảng `id INT, v VARCHAR(16383)` (65 532 + 2 + 4 byte) thành `v LONGTEXT`.

**Độ dài khóa trên SQL Server** (sửa sau review ngày 2026-10-02): SQL Server từ chối (Msg 1944) khóa có phần độ dài cố định vượt 900 byte với khóa chính (mặc định clustered) hoặc 1700 byte với unique và index (nonclustered); phần độ dài thay đổi chỉ gây cảnh báo lúc tạo. Ví dụ khóa chính `char(500)` thành `nchar(500)` = 1000 byte. Phần cố định tính: `nchar(n)` `2 × n` byte, `uniqueidentifier` 16 byte, kiểu cố định khác 17 byte (cận trên, `decimal(38)` lưu 17 byte), cột `nvarchar`, `varbinary` và custom tính 0. Khi vượt giới hạn, mọi cột `nchar(n)` trong khóa đó thành `nvarchar(n)` kèm `key-column-type-narrowed`. SQL Server bắt cột khóa ngoại và cột được tham chiếu cùng kiểu và cùng độ dài (Msg 1778, Msg 1753), nên việc hẹp lan theo quan hệ: mọi cột ghép cặp với một cột đã hẹp qua `columnPairs` của một quan hệ cũng thành `nvarchar(n)`, lan tiếp theo bắc cầu cho tới khi cả tập cột liên thông đổi xong; mỗi cột bị lan tới nhận `key-column-type-narrowed` riêng. Áp cho SQL Server SQL và Prisma `sqlserver`. Ngữ nghĩa đổi: cột không còn được đệm khoảng trắng tới đủ `n` ký tự như `nchar`. Nếu vẫn vượt (thực tế gần như không gặp) thì bỏ ràng buộc hoặc index đó cùng khóa ngoại tham chiếu tới nó, kèm `key-column-type-not-indexable`, như MySQL. `IDENTITY` không cần khóa nên không cần index thay thế.

**Cắt comment** (Vấn đề 2): cắt ở ranh giới code point, giới hạn đếm theo đơn vị của đích (MySQL theo ký tự, SQL Server theo code unit UTF-16 của `nvarchar`). PostgreSQL không giới hạn độ dài comment. Prisma, Drizzle và các đích code giữ nguyên comment vì không ghi vào database.

**Phát hiện vòng cascade trên SQL Server:** duyệt quan hệ theo thứ tự xác định của phần 2, giữ đồ thị các cạnh `toTableId → fromTableId` của những quan hệ có hành động khác `noAction` và `restrict` (SQL Server ghi `restrict` là `NO ACTION`, không gây lỗi vòng hay nhiều đường; Prisma `sqlserver` cũng ghi `restrict` là `NoAction`). Quan hệ nào khi thêm vào làm xuất hiện vòng (kể cả tự tham chiếu) hoặc đường thứ hai giữa hai bảng thì bị hạ về `NO ACTION` cho cả hai sự kiện. Hạ cả hai vì Prisma yêu cầu như vậy, và một quy tắc cho cả SQL lẫn Prisma giúp hai output khớp nhau.

### Ma trận cho SQL, Prisma và Drizzle

| Khái niệm | PostgreSQL | MySQL | SQL Server | Prisma | Drizzle |
|---|---|---|---|---|---|
| Enum | `CREATE TYPE` | `ENUM(…)` trên cột, tương đương | `nvarchar(n)` + `CHECK`, tương đương | `enum`; `sqlserver`: `String`, `enum-not-supported` | `pgEnum`; `mysqlEnum` |
| `restrict` | `RESTRICT` | `RESTRICT` | `NO ACTION`, tương đương | `Restrict`; `sqlserver`: `NoAction`, tương đương | `'restrict'` |
| `setDefault` | `SET DEFAULT` | `NO ACTION`, `referential-action-not-supported` | `SET DEFAULT` | `SetDefault`; `mysql`: `NoAction`, diagnostic như MySQL | PostgreSQL `'set default'`; MySQL `'no action'`, diagnostic |
| Cascade tạo vòng, nhiều đường | Giữ nguyên | Giữ nguyên | `NO ACTION`, `referential-action-cycle` | `sqlserver`: `NoAction`, diagnostic như SQL Server | Giữ nguyên |
| Kiểu custom | Nguyên văn | Nguyên văn | Nguyên văn | `Unsupported("…")` | `customType` |
| Bảng không có khóa chính | Hợp lệ | Hợp lệ | Hợp lệ | `@@ignore` khi không có unique bắt buộc, `table-without-identifier` | Hợp lệ |
| Comment bảng, cột | `COMMENT ON` | `COMMENT` trong `CREATE TABLE` | `sp_addextendedproperty` (`MS_Description`) | Comment `///` | JSDoc `/** */` |
| Khóa chính nhiều cột | `PRIMARY KEY (…)` | như PostgreSQL | như PostgreSQL | `@@id([…])` | `primaryKey({ columns })` |
| Khóa ngoại nhiều cột | `FOREIGN KEY (…)`, cặp cột theo thứ tự khóa được tham chiếu | như PostgreSQL | như PostgreSQL | `@relation(fields, references)` | `foreignKey({ columns, foreignColumns })` |
| Tự tham chiếu | Như quan hệ thường | như PostgreSQL | Hành động theo dòng "vòng" | `@relation("…")` ở hai phía | `foreignKey` trong cấu hình bảng, `relationName` |
| Quan hệ 1-1 | Khóa ngoại; unique đã có trong schema, không thêm | như PostgreSQL | như PostgreSQL | Trường quan hệ đơn, phía ngược là `Model?` | `one` ở cả hai phía |
| Literal mặc định trên `LONGTEXT`, `JSON`, `LONGBLOB` | Không áp dụng | `DEFAULT ('…')`, tương đương | Không áp dụng | `mysql`: `@default(dbgenerated("('…')"))` (R19) | MySQL: `.default(sql.raw("('…')"))` |
| Unique trên cột nullable | `UNIQUE` | `UNIQUE` | Unique index lọc `WHERE … IS NOT NULL`, tương đương; nếu được khóa ngoại tham chiếu thì `UNIQUE`, `unique-nulls-restricted` | `@unique`; `sqlserver`: `unique-nulls-restricted` | `unique` |
| `text` trong khóa, index | `text` | `VARCHAR(255)`, `key-column-type-narrowed` | `nvarchar(450)`, `key-column-type-narrowed` | Theo dialect | Theo dialect |
| `char(n)`, `varchar(n)` với `n > 768` trong khóa, index | Giữ nguyên | `VARCHAR(768)`, `key-column-type-narrowed`; cột vượt giới hạn (ví dụ `varchar(20000)` trong unique) cũng thành `VARCHAR(768)`, kèm thêm `type-parameter-out-of-range` | Theo dòng dưới | Theo dialect | Theo dialect |
| Phần độ dài cố định của khóa vượt giới hạn | Giữ nguyên | Không áp dụng (theo dòng trên) | Khóa chính quá 900 byte, unique, index quá 1700 byte: mọi `nchar(n)` của khóa thành `nvarchar(n)`, `key-column-type-narrowed`, lan bắc cầu tới cột ghép cặp qua quan hệ (mỗi cột một diagnostic); vẫn vượt thì bỏ, `key-column-type-not-indexable` | `sqlserver`: như SQL Server | Không áp dụng (chưa có SQL Server) |
| Tổng độ dài khóa vượt 3072 byte sau khi hẹp | Giữ nguyên | Bỏ ràng buộc, index đó, `key-column-type-not-indexable` | Theo dòng trên | Theo dialect | Theo dialect |
| Cột `AUTO_INCREMENT` không đứng đầu khóa, index nào (khóa bị bỏ, hoặc khóa chính nhiều cột có nó ở sau) | Không áp dụng | Thêm `INDEX` `<bảng>_<cột>_idx` (SQL: dòng ``KEY`` trong `CREATE TABLE`, R25; nếu đã có index người dùng bắt đầu bằng cột đó thì index đầu tiên được chuyển vào `CREATE TABLE` thay cho dòng thay thế), tương đương | Không áp dụng (`IDENTITY` không cần index) | `mysql`: `@@index([cột], map: "<bảng>_<cột>_idx")` | MySQL: `index("<bảng>_<cột>_idx").on(…)` |
| Dòng vượt 65 535 byte | Giữ nguyên | Cột `CHAR`, `VARCHAR` lớn nhất không thuộc khóa chính, unique, index hay cặp cột quan hệ thành `LONGTEXT`, lặp tới khi vừa, `type-parameter-out-of-range` | Giữ nguyên | `mysql`: như MySQL | MySQL: như MySQL |
| `json`, `binary` trong khóa, index | Giữ nguyên | Bỏ ràng buộc, `key-column-type-not-indexable` | như MySQL | Theo dialect | Theo dialect |
| Comment vượt giới hạn đích | Giữ nguyên | Cắt, `comment-truncated` | Cắt, `comment-truncated` | Giữ nguyên | Giữ nguyên |
| `timestamptz` | `timestamptz` | `TIMESTAMP(6)`; literal kết thúc bằng `Z` hoặc `-00:00` ghi `+00:00`, tương đương (mục 3) | `datetimeoffset` | Mục 3 | Mục 3 |
| `uuid`, `json` | `uuid`, `jsonb` | `CHAR(36)`, `JSON` | `uniqueidentifier`, `nvarchar(max)` | Mục 3; `sqlserver` `json`: `type-not-supported` | Mục 3 |
| Subject area, ghi chú, vị trí | Không áp dụng | Không áp dụng | Không áp dụng | Không áp dụng | Không áp dụng |

### Ma trận cho các đích còn lại

| Khái niệm | TypeScript | Zod | OpenAPI | Mock API | Seed | DBML | Markdown |
|---|---|---|---|---|---|---|---|
| Enum | Type union | `z.enum` | Component `enum` | Giá trị trong enum | Giá trị trong enum | `Enum` | Mục enum |
| Kiểu custom | `unknown`, `custom-type-unmapped` | `z.unknown()`, diagnostic | `{}`, diagnostic | Giá trị theo seed, diagnostic | Nullable: `null`; có mặc định: bỏ cột; còn lại: `seed-table-skipped` | Tên kiểu trong nháy kép | Tên kiểu |
| Bảng không có khóa chính | Không áp dụng | Không áp dụng | Chỉ danh sách, tạo mới; `table-without-identifier` | như OpenAPI | Sinh bình thường | Bình thường | Bình thường |
| Comment | JSDoc | JSDoc | `description` | Không áp dụng | Không áp dụng | `note` | Cột "Comment" và đoạn mô tả bảng |
| Khóa chính nhiều cột | Không áp dụng | Không áp dụng | Nhiều tham số đường dẫn | Đường dẫn `/:a/:b` | Tổ hợp không trùng | `indexes { (…) [pk] }` | Cột "Ràng buộc" |
| Quan hệ, hành động | Không áp dụng | Không áp dụng | Không áp dụng | Không áp dụng (không mô phỏng ràng buộc) | Thứ tự nạp theo khóa ngoại | `Ref` với `>` hoặc `-`, `delete:`, `update:` | Danh sách quan hệ |
| Index | Không áp dụng | Không áp dụng | Không áp dụng | Không áp dụng | Tôn trọng index unique | `indexes { … }` | Bảng index |
| Subject area, ghi chú | Không áp dụng | Không áp dụng | Không áp dụng | Không áp dụng | Không áp dụng | `TableGroup`, `Note` | Không áp dụng |

## 5. Ánh xạ định danh

Tên trong schema là văn bản tự do: có dấu tiếng Việt, khoảng trắng, trùng từ khóa, bắt đầu bằng chữ số (phần 2, mục 7). Mọi generator dùng chung các hàm trong `generators/shared/`, không tự viết lại.

```ts
function quoteSqlIdentifier(dialect: SqlDialect, name: string): string;
function sqlStringLiteral(dialect: SqlDialect, value: string): string;

// Bỏ dấu (NFD, bỏ U+0300–U+036F, đ → d, Đ → D), tách từ theo ký tự không phải [A-Za-z0-9]
function toAsciiWords(name: string): readonly string[];
function toPascalCaseIdentifier(name: string, fallback: string): string; // 'người dùng' → 'NguoiDung'
function toCamelCaseIdentifier(name: string, fallback: string): string;  // 'author_id' → 'authorId'

// exact: giữ nguyên; caseInsensitive: toNameKey của phần 2 (cũng là cách MySQL so định danh, R20)
type NameComparison = 'exact' | 'caseInsensitive';
function toComparisonKey(name: string, comparison: NameComparison): string;

type NameAllocator = { readonly allocate: (preferred: string) => string };
function createNameAllocator(options: {
  readonly reserved: readonly string[];
  readonly comparison: NameComparison;
}): NameAllocator;

// '__proto__' → '["__proto__"]'; khớp ^[A-Za-z_$][A-Za-z0-9_$]*$ → ghi trần; còn lại → JSON.stringify
function formatPropertyKey(name: string): string;

function buildConstraintName(
  tableName: string,
  columnNames: readonly string[],
  suffix: 'pkey' | 'key' | 'fkey' | 'check' | 'idx', // 'idx': INDEX thay thế trên cột AUTO_INCREMENT của MySQL (mục 4)
): string;
```

### Định danh SQL

- **Luôn quote mọi định danh**, kể cả tên đơn giản: PostgreSQL `"…"` (nhân đôi `"`), MySQL `` `…` `` (nhân đôi `` ` ``), SQL Server `[…]` (nhân đôi `]`). Tên được giữ đúng như người dùng nhập.
- **Chuỗi:** PostgreSQL `'…'` nhân đôi `'` (`standard_conforming_strings` bật mặc định); MySQL `'…'` nhân đôi `'` và đổi `\` thành `\\` (chế độ SQL mặc định không có `NO_BACKSLASH_ESCAPES`); SQL Server `N'…'` nhân đôi `'`.

**Lý do:** quote có điều kiện cần danh sách từ khóa theo từng dialect và từng phiên bản, sót một từ là output lỗi. Hệ quả chấp nhận được: trên PostgreSQL, tên có chữ hoa phải được quote khi viết truy vấn, đúng với tên người dùng đã chọn.

**Phương án bị loại:** chỉ quote khi cần, hoặc chuyển tên sang `snake_case`: cách sau đổi tên database mà người dùng không yêu cầu, và import rồi sinh lại (phần 7) không còn cho cùng tên.

### Định danh code

Prisma, Drizzle, TypeScript, Zod, OpenAPI và Mock API cần định danh ASCII:

1. `toAsciiWords` bỏ dấu và tách từ. Từ viết hoa toàn bộ được hạ về chữ thường trước (`USER_ID` → `user`, `id`); từ khác giữ nguyên phần sau chữ cái đầu (`createdAt` giữ là một từ).
2. PascalCase cho model Prisma, type TypeScript, component OpenAPI; camelCase cho trường Prisma, key cột và biến export của Drizzle, biến schema Zod (thêm hậu tố `Schema`), tham số đường dẫn OpenAPI.
3. Kết quả bắt đầu bằng chữ số thì thêm tiền tố là từ `fallback` theo loại (`Table`, `Enum`, `field`, `value`). Kết quả rỗng (tên không có chữ Latin, ví dụ `用户`) thì dùng chính `fallback`.
4. Kết quả trùng từ dành riêng của đích (tên kiểu scalar và `PrismaClient` của Prisma; từ khóa JavaScript và TypeScript cho biến Drizzle) thì thêm `_`.
5. `NameAllocator` cấp tên theo thứ tự xác định của phần 2 (bảng, enum theo tên rồi id; cột theo `columnIds`). Tên đã cấp thì phần tử sau nhận hậu tố `2`, `3`… Không có diagnostic vì tên gốc vẫn còn trong output (`@@map`, key có quote, chuỗi tên bảng).

| Tên gốc | Model Prisma, type TypeScript | Trường Prisma, key Drizzle | Key TypeScript, Zod, OpenAPI |
|---|---|---|---|
| `người dùng` | `NguoiDung`, kèm `@@map("người dùng")` | `nguoiDung` | `"người dùng"` |
| `order` | `Order`, kèm `@@map("order")` | `order` | `order` |
| `2fa codes` | `Table2faCodes` | `field2faCodes` | `"2fa codes"` |
| `USER_ID` | `UserId` | `userId` | `USER_ID` |
| `用户` | `Table` | `field` | `"用户"` |
| `order items` rồi `order_items` | `OrderItems`, `OrderItems2` | `orderItems`, `orderItems2` | giữ nguyên từng tên |

- **Key thuộc tính** trong TypeScript, Zod, OpenAPI, Mock API và seed JSON là **tên cột gốc**, vì chúng mô tả đúng dữ liệu JSON có key là tên cột. Trong code TypeScript (type, schema Zod, dữ liệu của `handlers.ts`), key ghi qua `formatPropertyKey`: khớp `^[A-Za-z_$][A-Za-z0-9_$]*$` thì ghi trần, còn lại ghi bằng `JSON.stringify`.
- **Cột tên `__proto__`** (Vấn đề 5, quyết định ngày 2026-10-02): tên này hợp lệ theo phần 2, nhưng trong object literal JavaScript cả `__proto__: …` lẫn `"__proto__": …` đặt prototype thay vì tạo thuộc tính. `formatPropertyKey` ghi `["__proto__"]` (khóa tính toán, tạo thuộc tính thật và hợp lệ cả trong type literal TypeScript). Trong core, mọi object có khóa lấy từ tên người dùng được dựng bằng `Object.fromEntries`, không bằng phép gán `obj[name] = …`. File JSON (OpenAPI, seed JSON) không bị ảnh hưởng vì `JSON.parse` tạo thuộc tính thật.
- **Chuỗi trong code** (tên bảng của Drizzle, giá trị enum, đường dẫn) ghi bằng `JSON.stringify`. Comment JSDoc thay `*/` bằng `*\/`.
- **Prisma:** `@@map`, `@map` chỉ ghi khi tên ánh xạ khác tên gốc. Giá trị enum không phải định danh hợp lệ được ánh xạ như trường và kèm `@map("giá trị gốc")`. Chuỗi Prisma escape `\` và `"`.
- **DBML:** định danh luôn trong `"…"`, chuỗi trong `'…'`, cả hai escape bằng `\`; ghi chú nhiều dòng dùng `'''…'''`. Đã thử với `@dbml/core` 10.1.1: nháy kép và nháy đơn phải escape bằng `\`, nhân đôi dấu nháy là lỗi cú pháp.
- **Markdown:** thêm `\` trước ký tự đặc biệt của Markdown; trong ô bảng escape `|` và đổi xuống dòng thành `<br>`.

| Đích | Không gian tên cấp tên | So sánh |
|---|---|---|
| SQL | Một tập cho cả output: tên bảng, tên enum, tên index của người dùng, tên ràng buộc do generator đặt | Không phân biệt hoa thường (`caseInsensitive`), kể cả tên ràng buộc do generator đặt, ở mọi dialect |
| Prisma | Model và enum chung một tập; trường (cột và quan hệ) trong một model; giá trị enum trong một enum | Phân biệt hoa thường |
| Drizzle | Biến export (bảng, enum, `customType`, relations); key cột và tên quan hệ trong một bảng | Phân biệt hoa thường |
| TypeScript, Zod | Type (hoặc biến schema) của bảng, enum và `JsonValue` | Phân biệt hoa thường |
| OpenAPI, Mock API | Component; `operationId`; đoạn đường dẫn tài nguyên; tham số trong một đường dẫn | Không phân biệt hoa thường cho đường dẫn, phân biệt cho phần còn lại |

### Tên ràng buộc do generator đặt

- **Quy ước PostgreSQL:** `<bảng>_pkey`, `<bảng>_<cột>_<cột>_key`, `<bảng>_<cột>_<cột>_fkey`, `<bảng>_<cột>_check` (và `<bảng>_<cột>_idx` cho index thay thế trên cột `AUTO_INCREMENT` của MySQL, mục 4), dùng tên gốc (đã quote khi ghi). Prisma dùng cùng quy ước cho tên mặc định, nên database tạo từ CG-01 và từ Prisma có cùng tên ràng buộc.
- **Tối đa 63 byte UTF-8**, giới hạn chặt nhất trong ba dialect (PostgreSQL 63 byte, MySQL 64 ký tự, SQL Server 128 ký tự). Tên dài hơn được cắt ở ranh giới code point còn 54 byte, nối `_` và 8 chữ số hex của hash FNV-1a 32 bit trên tên đầy đủ.
- **Tránh trùng:** tên đặt ra đi qua `NameAllocator` của output SQL, gồm cả tên bảng (PostgreSQL dùng chung không gian tên cho bảng và index) và tên index của người dùng. Trùng thì thêm `_2`, `_3`…, cắt lại để vẫn tối đa 63 byte. Tên index của người dùng không bao giờ bị đổi: phần 2 đã bảo đảm chúng không trùng nhau (`index-name-duplicate`) và không trùng tên bảng (`index-name-conflicts-table`, mục 2).
- **So không phân biệt hoa thường cho mọi dialect** (Vấn đề 7, sửa theo kết quả probe ngày 2026-10-02, R20): allocator của tên ràng buộc dùng `comparison: 'caseInsensitive'`, như allocator cột, index MySQL của `identifier-collision-renamed`. MySQL 8.4.11 so tên cột, index và ràng buộc không phân biệt hoa thường nhưng phân biệt dấu: `ma`/`MA` bị từ chối (lỗi 1060), còn `ma`/`má`, `t_ma_key`/`t_má_key` và các cặp `đ`/`d`, `ø`/`o`, `ł`/`l`, `ħ`/`h`, `ß`/`s`, `ð`/`d` được nhận (probe 1–4, 18). Vì vậy hai cột `ma`, `má` cùng `isUnique` giữ `t_ma_key` và `t_má_key`, không đổi tên. So như vậy ở cả ba dialect và Drizzle để tên ràng buộc giống nhau giữa các đích. Mức so `caseAndAccentInsensitive` và danh sách gộp `đ`, `ø`, `ł`, `ħ` trước đây (R12) bị bỏ, vì dựa trên giả định sai rằng MySQL so định danh không phân biệt dấu. Giá trị `ENUM` và dữ liệu theo collation `utf8mb4_0900_as_ci` của bảng (CG-01), không liên quan tới cách so định danh.
- MySQL không ghi tên khóa chính (luôn là `PRIMARY`). Prisma không ghi `map:` cho khóa chính, unique cột và khóa ngoại (dùng tên mặc định theo cùng quy ước); ghi `map:` cho index của người dùng. Drizzle truyền tên tường minh, trùng với SQL.

**Phương án bị loại:** tiền tố kiểu `pk_`, `fk_`: không khớp tên mặc định của Prisma và PostgreSQL, nên hai đường tạo database cho hai bộ tên khác nhau.

### Tên trường quan hệ (Prisma, Drizzle)

- **Phía khóa ngoại:** quan hệ một cột mà tên cột kết thúc bằng `_id`, ` id` hoặc `Id` thì bỏ hậu tố (`author_id` → `author`); còn lại là camelCase tên bảng đích.
- **Phía ngược:** camelCase tên bảng nguồn (`posts`). Không chia số nhiều: tên bảng có thể là tiếng Việt, và thường đã ở dạng số nhiều.
- Trùng với trường khác trong model thì thêm hậu tố số qua `NameAllocator`.
- Tên quan hệ (`@relation("…")`, `relationName`) chỉ ghi khi giữa hai model có hơn một quan hệ, hoặc quan hệ tự tham chiếu: `<Model nguồn>_<trường phía khóa ngoại>`.

## 6. Thiết kế theo đích

### CG-01. SQL DDL

**Thứ tự câu lệnh:**

1. PostgreSQL: `CREATE TYPE … AS ENUM (…)` theo thứ tự enum.
2. `CREATE TABLE` theo thứ tự bảng. Cột theo `columnIds`: kiểu, auto-increment, `NOT NULL`, `DEFAULT`, và `COMMENT` với MySQL. Sau cột: `CONSTRAINT … PRIMARY KEY (…)`, `CONSTRAINT … UNIQUE (…)` cho từng cột `isUnique` theo thứ tự cột, và `CONSTRAINT … CHECK` cho cột enum trên SQL Server. MySQL, khi bảng cần `INDEX` thay thế cho cột `AUTO_INCREMENT` (mục 4), ghi thêm một dòng ``KEY `<bảng>_<cột>_idx` (`<cột>`)`` ngay sau dòng khóa chính và các dòng `UNIQUE` (R25); với cột `AUTO_INCREMENT` mà không khóa chính hay unique nào bắt đầu bằng nó, nếu có index của người dùng bắt đầu bằng cột đó thì dòng này là ``KEY`` hoặc ``UNIQUE KEY`` của index đầu tiên như vậy theo thứ tự `model.indexes`, và không có dòng thay thế (mở rộng R25). MySQL kết thúc bảng bằng `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci` và `COMMENT='…'`.
3. `CREATE [UNIQUE] INDEX` theo thứ tự index (không gồm `INDEX` thay thế của MySQL đã ghi ở bước 2). SQL Server thêm unique index lọc `WHERE … IS NOT NULL` cho unique trên cột nullable (mục 4).
4. `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY (…) REFERENCES … (…) ON DELETE … ON UPDATE …` theo thứ tự quan hệ, luôn ghi đủ hai hành động. Cặp cột được sắp theo thứ tự của khóa được tham chiếu (MySQL yêu cầu).
5. Comment: PostgreSQL `COMMENT ON TABLE`, `COMMENT ON COLUMN`; SQL Server `EXEC sys.sp_addextendedproperty` (`MS_Description`), tên schema lấy từ `SCHEMA_NAME()` vào một biến khai báo một lần. MySQL đã ghi comment ở bước 2.

**Lý do:**

- Khóa ngoại tách thành `ALTER TABLE` sau khi mọi bảng đã có: quan hệ vòng và tự tham chiếu chạy được với thứ tự bảng theo tên, không phải sắp topo.
- Index đứng trước khóa ngoại: PostgreSQL và MySQL yêu cầu cột được tham chiếu đã có ràng buộc hoặc index unique lúc tạo khóa ngoại, mà unique nhiều cột là index của người dùng.
- Comment đứng cuối vì là câu lệnh riêng trên PostgreSQL và SQL Server; MySQL chỉ sửa comment cột được bằng cách viết lại cả định nghĩa cột, nên ghi ngay trong `CREATE TABLE`.

**Phương án bị loại:** khóa ngoại viết trong `CREATE TABLE` theo thứ tự topo: không chạy được khi có vòng, và cần hai cách viết cho cùng một khái niệm.

**Chi tiết khác:**

- **Collation MySQL `utf8mb4_0900_as_ci`:** không phân biệt hoa thường nhưng phân biệt dấu, khớp cách so trùng của phần 2. Collation mặc định `utf8mb4_0900_ai_ci` coi `ma` và `má` là một giá trị, nên `ENUM('ma', 'má')` và ràng buộc unique trên dữ liệu tiếng Việt sai.
- **Không có** `DROP`, `CREATE DATABASE`, `USE`, `BEGIN`/`COMMIT`, `GO`, dòng comment đầu file hay thời gian. Không tính năng nào cần `DROP` (IE-05 tải đúng nội dung này). `GO` không phải T-SQL mà là lệnh của sqlcmd và SSMS: output chạy được qua driver thành một batch.
- **Không có option.** Dialect là chính đích.
- **Phiên bản kiểm thử:** PostgreSQL 18, MySQL 8.4 LTS, SQL Server 2022. Output không dùng cú pháp mới hơn PostgreSQL 13 (`gen_random_uuid()` có sẵn từ 13), MySQL 8.0.13 (giá trị mặc định dạng biểu thức) và SQL Server 2017, nhưng spec chỉ cam kết các phiên bản được kiểm thử. SQL Server 2025 (`2025-latest` có trên MCR) không được chọn vì output không dùng tính năng mới của 2025 như kiểu `json` native.

### CG-02. Prisma schema

- **Phiên bản:** Prisma 7 (7.10.0). Dist-tag `latest` trên npm đang trỏ tới `8.0.0-rc.15`, bản pre-release; plan kiểm tra lại khi Prisma 8 phát hành chính thức.
- **Đầu file:** `generator client { provider = "prisma-client" output = "../src/generated/prisma" }` và `datasource db { provider = "…" }` không có `url`. Prisma 7 đặt URL trong `prisma.config.ts`, và `prisma validate` chạy không cần URL (đã thử).
- **Option `provider`:** `postgresql`, `mysql` hoặc `sqlserver`, quyết định native type (mục 3) và các dòng Prisma của ma trận (mục 4).
- **Thứ tự:** enum theo thứ tự enum; model theo thứ tự bảng. Trong model: trường cột theo `columnIds`, rồi trường quan hệ theo thứ tự quan hệ (phía khóa ngoại trước, phía ngược sau), rồi `@@id`, `@@unique`, `@@index`, `@@map`, `@@ignore`.
- **Khóa và index:** khóa chính một cột là `@id`, nhiều cột là `@@id([…])`; `isUnique` là `@unique`; index unique là `@@unique([…], map: "…")`; index thường là `@@index([…], map: "…")`. Comment bảng, cột là `///`.
- **Quan hệ:** phía khóa ngoại `author Users @relation(fields: […], references: […], onDelete: …, onUpdate: …)`, luôn ghi cả hai hành động vì mặc định của Prisma (`onUpdate: Cascade`) khác mặc định `noAction` của schema. Trường là `Model?` khi có ít nhất một cột khóa ngoại nullable. Phía ngược: 1-n là `Model[]`, 1-1 là `Model?`. Trường quan hệ trỏ tới model `@@ignore` có `@ignore` (Prisma bắt buộc, đã thử).
- **n-n** là model trung gian tường minh với `@@id` và hai quan hệ, vì phần 2 lưu bảng trung gian thật và bảng đó có thể có thêm cột.

**Phương án bị loại:** quan hệ n-n ngầm của Prisma: không biểu diễn được cột thêm, và đổi tên bảng trung gian. Bỏ hành động khi trùng mặc định của Prisma: mặc định phụ thuộc trường bắt buộc hay tùy chọn và provider, dễ sai, và làm output khó so với schema.

### CG-03. Drizzle schema

- **Phiên bản:** `drizzle-orm` 0.45.2, bản `latest`. Nhánh 1.0 đang ở `1.0.0-rc.4` (2026-06-27), chưa phát hành chính thức. Chỉ 1.0 có `drizzle-orm/mssql-core` và relations API v2 (`defineRelations`); 0.45.2 không export `defineRelations` (đã kiểm tra).
- **Option `dialect`:** `postgresql` hoặc `mysql`. Giao diện hiện SQL Server ở trạng thái không chọn được, kèm chú thích. Khi Drizzle 1.0 phát hành chính thức, một thay đổi riêng chuyển sang 1.0, relations v2, thêm SQL Server và cập nhật `architecture.md`.
- **Cấu trúc file:** import các builder được dùng (sắp theo tên), kèm `type PgTableExtraConfigValue` (PostgreSQL) hoặc `type MySqlTableExtraConfigValue` (MySQL) khi có ít nhất một callback cấu hình bảng; `pgEnum` (PostgreSQL); các `customType`; bảng theo thứ tự bảng dạng `export const users = pgTable("users", { … }, (table): PgTableExtraConfigValue[] => [ … ])` (MySQL: `mysqlTable`, `(table): MySqlTableExtraConfigValue[] => [ … ]`); cuối cùng các `relations()` theo thứ tự bảng. Mọi callback cấu hình bảng luôn chú thích kiểu trả về, không chỉ bảng nằm trong vòng khóa ngoại (R21): output xác định, không cần phát hiện vòng, và dòng import không phụ thuộc hình dạng schema. Hai tên kiểu này nằm trong danh sách tên import được giữ chỗ khi cấp tên biến (mục 5).
- **Ràng buộc trong callback cấu hình bảng:** `primaryKey({ name, columns })` cho mọi khóa chính (kể cả một cột, để tên trùng SQL), `unique(name).on(…)`, `index(name).on(…)`, `uniqueIndex(name).on(…)`, `foreignKey({ name, columns, foreignColumns }).onDelete(…).onUpdate(…)`. Khóa ngoại không dùng `.references()` trên cột: `foreignKey` biểu diễn được khóa nhiều cột và tự tham chiếu mà không cần chú thích kiểu `AnyPgColumn`.
- **Relations v1:** phía khóa ngoại `one(target, { fields, references, relationName? })`; phía ngược `many(source)` cho 1-n, `one(source)` cho 1-1; tên theo mục 5.
- Comment là JSDoc trên bảng và cột. Output mẫu cho PostgreSQL (kiểu `customType`, `foreignKey` nhiều cột, tự tham chiếu, `relations()`) đã qua `tsc` 6.0.3 strict.

**Phương án bị loại:** nhắm Drizzle 1.0 RC ngay: API còn có thể đổi trước khi phát hành, và `npm install drizzle-orm` hiện cài 0.45, nên output sẽ không compile với đa số người dùng. Một file mỗi bảng: nhiều file (mục 1).

### CG-04. TypeScript types

- File `types.ts`: `JsonValue` (chỉ khi có cột `json`), rồi type enum theo thứ tự enum, rồi type bảng theo thứ tự bảng. Thuộc tính theo `columnIds`, key là tên cột gốc, kiểu theo biểu diễn JSON (mục 3), nullable là `| null`, comment là JSDoc.
- Không có option. Không sinh type riêng cho thêm mới hay cập nhật: không tiêu chí nào cần.

```ts
export type OrderStatus = "pending" | "đã giao";

/** Bảng người dùng */
export type NguoiDung = {
  id: string;
  "họ tên": string | null;
  status: OrderStatus;
};
```

**Phương án bị loại:** từ khóa `enum` của TypeScript: giá trị enum là chuỗi tự do (có dấu, khoảng trắng) nên vẫn phải ánh xạ tên thành viên, và nhiều codebase cấm `enum`. Thuộc tính tùy chọn `?` cho cột nullable: dòng dữ liệu luôn có đủ key, giá trị có thể là `null`.

### CG-05. Zod schema

- File `schemas.ts`, `import { z } from "zod";`, cú pháp Zod 4 (4.6.5, trùng phiên bản trong catalog). Schema enum trước (`export const orderStatusSchema = z.enum([…])`), rồi schema bảng (`export const nguoiDungSchema = z.object({ … })`). Bảng không tham chiếu bảng khác, nên không có vấn đề khai báo trước.
- Format theo mục 3: `z.guid()`, `z.iso.date()`, `z.iso.time()`, `z.iso.datetime({ local: true })`, `z.iso.datetime({ offset: true })`, `z.int32()`, `z.json()`, `z.base64()`, `z.string().max(n)`, `z.string().regex(…)` cho `bigint` và `decimal(p, s)` (tối đa `p − s` chữ số phần nguyên, tối đa `s` chữ số phần lẻ). Nullable là `.nullable()`. Comment là JSDoc.
- Không có option. Không export type suy ra (`z.infer`): CG-04 đã sinh type.
- **Giới hạn đã chấp nhận (R23):** `z.string().max(n)` đếm code unit UTF-16, trong khi database, `maxLength` của OpenAPI (CG-07) và `isValidLengthLiteral` của phần 2 đếm code point. Giá trị có ký tự ngoài BMP (ví dụ emoji) gần giới hạn có thể qua validation và OpenAPI nhưng bị Zod từ chối. Giữ `z.string().max(n)`: code sinh ra vẫn đúng cách viết thường gặp, và Zod chỉ chặt hơn database, không bao giờ lỏng hơn.
- **Schema mô tả hàng đã lưu, không phải dữ liệu insert (R27):** cột kiểu custom, `NOT NULL`, có default (ví dụ `address inet NOT NULL DEFAULT '127.0.0.1'`) được CG-08 bỏ khỏi seed JSON (`omit`, database tự điền default), nhưng Zod vẫn ghi `address: z.unknown()` và Zod 4.6 coi key này là bắt buộc. Không đổi core: giữ nguyên nghĩa của Zod, và không thêm `.optional()` cho riêng lớp cột này.
- Output mẫu dùng mọi format trên đã qua `tsc` 6.0.3 strict; hành vi của `z.guid()`, `z.iso.datetime({ local: true })` và `z.json()` đã thử trên 4.6.5.

**Phương án bị loại:** `.describe()` cho comment: thêm metadata lúc chạy mà không tiêu chí nào cần; JSDoc hiện trong editor như nhau.

### CG-06. Mock API (REST)

Trả lời câu hỏi 8 trong danh sách tính năng.

| Tiêu chí | Handler MSW 2 | json-server: file `db.json` | Server mock Hono hoặc Express |
|---|---|---|---|
| "Sinh mock REST API cho các bảng" | CRUD cho mọi bảng có khóa chính | CRUD do json-server tự sinh | CRUD cho mọi bảng |
| Cách dùng | Chặn request ngay trong ứng dụng của người dùng: Service Worker trên trình duyệt, `setupServer` trong test Node. Không cần process riêng | Chạy process Node `json-server db.json` | Chạy process Node riêng |
| Khóa chính nhiều cột, khóa không tên `id` | Được: đường dẫn `/:a/:b` | Không: mỗi dòng phải có trường `id` | Được |
| Độ ổn định công cụ | 2.15.0, bản ổn định | 1.0.0-beta.15; README ghi "expect breaking changes" | Ổn định, nhưng generator phải sinh cả code server, định tuyến, khởi động |
| Kiểm chứng tự động | Typecheck và chạy CRUD bằng `msw/node` trong Vitest (đã thử) | Chạy process và gọi HTTP | Chạy process và gọi HTTP |

**Quyết định:** một file `handlers.ts` gồm dữ liệu trong bộ nhớ và mảng `handlers` của MSW 2.

- **Dữ liệu ban đầu** lấy từ `buildSeedDataset` (CG-08) với hằng số `MOCK_ROWS_PER_TABLE = 5` và seed 1, theo biểu diễn JSON. Diagnostic của seed được chuyển tiếp.
- **Đường dẫn** dùng chung module `rest-resources.ts` với OpenAPI: đoạn tài nguyên là tên bảng dạng kebab-case ASCII (`người dùng` → `nguoi-dung`, tránh trùng bằng `-2`); tham số là camelCase tên cột khóa chính theo thứ tự khóa. Handler khớp `*/api/<tài nguyên>`: đường dẫn tương đối `/api/…` không khớp khi chạy trên Node (đã thử), còn `*` khớp mọi origin trên cả trình duyệt và Node.
- **Route** cho bảng có khóa chính: `GET` danh sách, `POST` tạo mới (400 khi body không phải object, 409 khi khóa đã có), `GET` một dòng, `PUT` thay cả dòng với khóa lấy từ đường dẫn, `DELETE` (204). Bảng không có khóa chính chỉ có `GET` danh sách và `POST`, kèm `table-without-identifier`.
- **Không mô phỏng** kiểm tra kiểu, khóa ngoại, unique, lọc, phân trang hay tự sinh khóa. Mock phục vụ dựng giao diện khi chưa có backend; người dùng tự kiểm tra body bằng output của CG-05 nếu cần.
- Không có option. Người dùng tự chạy `npx msw init` và `setupWorker(...handlers)`; hướng dẫn nằm trong comment đầu file.

**Lý do:** MSW là phương án duy nhất chạy ngay trong ứng dụng của người dùng mà không cần process server, hợp tinh thần local-first, biểu diễn được mọi khóa của schema và kiểm chứng được tự động.

### CG-07. OpenAPI / Swagger

- **OpenAPI 3.1** (`"openapi": "3.1.1"`). 3.1 dùng JSON Schema 2020-12, biểu diễn nullable bằng `type: [T, "null"]` và binary bằng `contentEncoding`. 3.0 phải dùng `nullable`, không có `contentEncoding`. 3.2 (phát hành 2025-09) chưa được `@readme/openapi-parser` 9 hỗ trợ (README liệt kê 2.0, 3.0, 3.1), nên công cụ hỗ trợ còn hẹp.
- **Định dạng JSON** (`openapi.json`): object dựng với thứ tự khóa cố định rồi `JSON.stringify(…, null, 2)`. YAML cần một thư viện hoặc bộ ghi YAML riêng trong core mà không tiêu chí nào đòi.
- `info.title` là tên schema, `info.version` là hằng `"1.0.0"` (schema không có version riêng, output không được có thời gian). `servers` là `[{ "url": "/api" }]`.
- **`components.schemas`:** component enum rồi component bảng, tên theo mục 5. Mỗi bảng là `type: object`, `properties` theo biểu diễn JSON với key là tên cột gốc, `required` gồm mọi cột (dòng luôn có đủ key), `description` từ comment.
- **`paths`:** trùng route của Mock API. `operationId` là `list<Type>`, `create<Type>`, `get<Type>`, `replace<Type>`, `delete<Type>`. Body của `POST`, `PUT` và response dòng tham chiếu component của bảng; tham số đường dẫn dùng schema của cột khóa chính; response lỗi chỉ có `description`.

**Phương án bị loại:** chỉ có `components`, không có `paths`: tài liệu vẫn hợp lệ ở 3.1 nhưng Swagger UI không có endpoint nào, và OpenAPI không mô tả được Mock API sinh cùng lúc.

### CG-08. Seed data

Trả lời câu hỏi 9 trong danh sách tính năng.

```ts
type SeedRow = Readonly<Partial<Record<ColumnId, JsonValue>>>; // thiếu cột = dùng giá trị mặc định của database

type SeedDataset = {
  readonly tables: readonly { readonly tableId: TableId; readonly rows: readonly SeedRow[] }[]; // thứ tự nạp
};

function buildSeedDataset(
  schema: SchemaDocument,
  options: { readonly rowsPerTable: number; readonly seed: number },
): { readonly dataset: SeedDataset; readonly diagnostics: readonly GeneratorDiagnostic[] };

function validateSeedDataset(schema: SchemaDocument, dataset: SeedDataset): readonly SeedIssue[];

function serializeSeedDataset(schema: SchemaDocument, dataset: SeedDataset, format: SqlDialect | 'json'): GeneratedFile;

// generateSeed = buildSeedDataset rồi serializeSeedDataset
```

- `SeedIssue` là `{ code, path }` với `path` dạng `['tables', i, 'rows', j, columnId]`. Mã: `seed-value-invalid` (sai biểu diễn JSON của kiểu hoặc không thuộc enum), `seed-value-null` (null ở cột bắt buộc), `seed-unique-violation`, `seed-foreign-key-missing`, `seed-order-invalid` (dòng tham chiếu tới bảng nạp sau, ngoài trường hợp vòng), `seed-identity-partial` (R24).
- **`seed-identity-partial`** (R24): xảy ra khi một số dòng của mục bảng `i` có đặt cột `isAutoIncrement` (giá trị `null` cũng tính là đã đặt) còn các dòng khác bỏ khóa đó. Mỗi dòng `j` bỏ khóa có một issue với `path` là `['tables', i, 'rows', j, columnId]`; các dòng có đặt cột không bị báo. Bảng mà mọi dòng đều đặt hoặc mọi dòng đều bỏ không có issue. Issue sắp theo `path` rồi `code` như các mã khác. `buildSeedDataset` không bao giờ sinh mã này.
- **Mã `SeedIssue` không dịch trong phần 6** (Vấn đề 11, quyết định ngày 2026-10-02): code panel không hiển thị `SeedIssue` (generator seed chỉ trả `GeneratorDiagnostic`), nên danh mục mã `SeedIssue` không được export ở entry point chính (type `SeedIssue` đi cùng `validateSeedDataset` ở subpath `@schemaforge/core/generators/seed`), và phần 6 không thêm namespace i18n cho chúng. Phần 5 (AI-06) quyết định export và bản dịch khi cần hiển thị.
- **Option:** `format` (`postgresql`, `mysql`, `sqlserver`, `json`), `rowsPerTable` từ 1 đến 1000 (mặc định 10; SQL Server giới hạn 1000 dòng trong một danh sách `VALUES`), `seed` là số nguyên không âm 32 bit (mặc định 1).

**Sinh giá trị xác định:**

- Core có một PRNG 32 bit nhỏ, thuần. Mỗi bảng dùng một luồng khởi tạo từ `seed` và hash tên bảng, nên thêm hay xóa một bảng không làm đổi dữ liệu của bảng khác.
- Bảng được xử lý theo thứ tự topo của đồ thị khóa ngoại, hòa thì theo thứ tự bảng của phần 2.
- Giá trị theo kiểu và biểu diễn JSON: khóa chính và cột auto-increment kiểu số nguyên đánh số từ 1; số khác lấy ngẫu nhiên trong phạm vi kiểu, `decimal` theo `p`, `s`; chuỗi là `<tên cột ASCII>_<số dòng>` cắt theo độ dài; `uuid` dạng v4 từ PRNG; ngày giờ trong 365 ngày kể từ hằng `2026-01-01T00:00:00Z` (không đọc đồng hồ); `json` là object nhỏ; `binary` là vài byte base64; enum chọn ngẫu nhiên. Cột nullable không thuộc khóa nhận `null` với một tỉ lệ cố định.
- **Unique:** giữ tập giá trị đã dùng cho từng khóa chính, cột unique và index unique; dòng vi phạm được sinh lại tối đa một số lần cố định, sau đó bỏ dòng và báo `seed-rows-reduced`.
- **Khóa ngoại:** chọn ngẫu nhiên một dòng của bảng được tham chiếu; 1-1 chọn không lặp lại. Tự tham chiếu trỏ tới dòng đứng trước (dòng đầu là `null` nếu nullable, hoặc trỏ tới chính nó).
- **Vòng giữa các bảng:** nếu vòng có một quan hệ gồm toàn cột nullable, cạnh đó không tham gia sắp thứ tự. SQL chèn `NULL` trước rồi `UPDATE` sau khi mọi bảng đã có dữ liệu; JSON ghi giá trị cuối. Vòng chỉ gồm cột bắt buộc thì các bảng trong vòng không có dữ liệu (`seed-table-skipped`), kéo theo các bảng tham chiếu bắt buộc tới chúng.
- Kiểu custom: cột nullable nhận `null`, cột có giá trị mặc định bị bỏ khỏi dòng, còn lại bỏ bảng (`seed-table-skipped`).

**Xuất:**

- **SQL:** mỗi bảng một câu `INSERT INTO … (…) VALUES (…), (…);` theo thứ tự nạp, literal theo dialect dùng chung hàm với giá trị mặc định. SQL Server bọc bảng có cột identity bằng `SET IDENTITY_INSERT … ON` và `OFF`. PostgreSQL gọi `setval(pg_get_serial_sequence(…), max(…))` sau khi chèn cột identity. MySQL không cần gì thêm vì `AUTO_INCREMENT` tự nhảy qua giá trị lớn nhất. Các câu `UPDATE` phá vòng đứng cuối. File `seed.sql`, chạy sau DDL của CG-01 cùng dialect.
- **JSON:** `[{ "table": "<tên bảng>", "rows": [{ "<tên cột>": … }] }]`, dạng mảng để giữ thứ tự nạp (thứ tự khóa object không đáng tin với tên bảng dạng số). File `seed.json`.

**Quan hệ với AI-06:**

| | CG-08 | AI-06 (phần 5) |
|---|---|---|
| Đăng nhập | Không | Có |
| Giá trị | Theo kiểu, xác định theo `seed` | Hợp ngữ cảnh theo tên và ý nghĩa của bảng, cột |
| Chạy ở | Trình duyệt | Backend gọi Gemini |
| Dùng chung | `SeedDataset`, `validateSeedDataset`, `serializeSeedDataset` | Như CG-08 |

Backend của AI-06 chuyển dữ liệu model trả về (theo tên bảng, tên cột) thành `SeedDataset`, từ chối khi `validateSeedDataset` không rỗng; frontend xuất bằng cùng hàm và cùng lựa chọn định dạng. Nhờ vậy "tuân thủ kiểu dữ liệu, nullable, unique, enum và khóa ngoại" của AI-06 được kiểm tra bằng đúng quy tắc của CG-08. Phần 5 chốt hình dạng tool call và giới hạn số dòng.

**Phương án bị loại:**

- `@faker-js/faker` 10.6.0: tài liệu của Faker ghi cùng một seed có thể cho giá trị khác sau khi nâng phiên bản, nên snapshot và tính xác định phụ thuộc phiên bản thư viện; giá trị giống thật cần hiểu ý nghĩa cột, việc của AI-06; thêm runtime dependency cho core trong khi sinh giá trị theo kiểu chỉ cần vài chục dòng.
- Truyền nguồn ngẫu nhiên dạng hàm trong option: không gửi được sang Web Worker và phá hợp đồng "option là dữ liệu". Seed là số, nên cùng option cho cùng output.
- Chỉ xuất JSON hoặc chỉ xuất SQL: SQL chạy thẳng sau DDL của CG-01; JSON là dữ liệu cho Mock API và cho kiểm tra bằng schema Zod.

### CG-09. DBML

- **Tự sinh văn bản DBML**, không dùng `@dbml/core` lúc chạy. Thư viện này tạo DBML từ model `Database` của chính nó, nên dùng nó vẫn phải viết lớp chuyển đổi dài gần bằng bộ ghi văn bản. File ESM của nó khoảng 21 MB (gzip khoảng 2,9 MB) vì gồm cả parser SQL; bản ESM không import module Node (đã kiểm tra), nên dùng được trên trình duyệt, nhưng kích thước là vấn đề của importer ở phần 7.
- **Thứ tự:** khối `Project` mang tên schema, enum, bảng, `Ref`, `TableGroup`, `Note`.
- **Kiểu** ghi bằng tên kiểu chung của core (`bigint`, `varchar(255)`, `decimal(10,2)`, `timestamptz`, `binary`…) để import lại không mất thông tin; enum là tên enum trong nháy kép; custom là tên kiểu trong nháy kép (ví dụ `"geometry(Point, 4326)"`).
- **Cột:** `pk` (khóa chính một cột), `increment`, `not null`, `unique`, `default:` (chuỗi, số, `true`/`false`, biểu thức `` `now()` ``, `` `gen_random_uuid()` ``), `note:`. Khóa chính nhiều cột và index nằm trong `indexes { ("a", "b") [pk] … }`. Comment bảng là `note` của bảng.
- **Quan hệ:** `Ref: "posts".("tenant_id", "author_id") > "users".("tenant_id", "id") [delete: cascade, update: no action]`, `>` cho 1-n, `-` cho 1-1, luôn ghi hai hành động.
- **Subject area** là `TableGroup`; **ghi chú** là `Note "note <n>" { '…' }` đánh số theo thứ tự id (ghi chú của core không có tên).
- `@dbml/core` 10.1.1 đã parse đúng mẫu gồm tên có dấu và khoảng trắng, nháy trong tên và chuỗi, kiểu custom có dấu phẩy, ghi chú nhiều dòng, khóa chính và khóa ngoại nhiều cột, bốn hành động, `TableGroup` và `Note`.
- **Round-trip:** conformance test ở phần 6 parse output bằng `@dbml/core` và so bảng, cột, kiểu, quan hệ, hành động, enum, index, nhóm, ghi chú với schema gốc. Tiêu chí "import lại bằng IE-03 cho schema tương đương" được kiểm tra đầy đủ bằng test round-trip khi importer DBML có ở phần 7.
- **Giới hạn đã chấp nhận (R22):** khi `@dbml/core` parse lại, ghi chú nhiều dòng mất phần thụt lề chung của mọi dòng và một dòng trống ở đầu, kể cả khi xuống dòng được ghi bằng escape `\n`. Đây là hành vi của parser, quoting không sửa được, nên importer DBML ở phần 7 không được kỳ vọng ghi chú round-trip chính xác.

### CG-10. Tài liệu Markdown

- File `schema.md`. Option `labels: MarkdownLabels`, một object gồm mọi nhãn cố định (tiêu đề mục, tiêu đề cột, "Có", "Không", tên loại quan hệ). Frontend truyền nhãn lấy từ i18next theo ngôn ngữ giao diện đang dùng.
- **Cấu trúc:**
  1. `# <tên schema>`
  2. `## Enum`: mỗi enum một `###` và danh sách giá trị.
  3. `## Bảng`: mỗi bảng một `###`, comment bảng, rồi bảng cột (Tên, Kiểu, Cho phép NULL, Mặc định, Ràng buộc, Comment). Ràng buộc gồm khóa chính, unique, auto-increment, khóa ngoại. Tiếp theo `#### Index` (Tên, Cột, Unique) và `#### Quan hệ`: danh sách quan hệ đi ra (cột → bảng.cột, loại, ON DELETE, ON UPDATE) và đi vào.
  4. Mục hoặc tiểu mục rỗng không được ghi.
- Kiểu ghi bằng tên kiểu chung, không theo dialect. Không có mục lục, liên kết nội bộ hay sơ đồ: slug tiêu đề tiếng Việt khác nhau giữa các trình hiển thị Markdown, và tiêu chí không yêu cầu sơ đồ.

**Phương án bị loại:** core chứa sẵn từ điển nhãn `vi`, `en`: thêm một nguồn bản dịch ngoài i18next. Nhãn chỉ tiếng Anh: tài liệu cho người dùng Việt Nam có tiêu đề tiếng Anh.

## 7. Kiểm chứng output đúng với công cụ đích

Tiêu chí chung yêu cầu output "dùng được với công cụ đích", và nhiều tiêu chí riêng gọi tên công cụ (`prisma validate`, typecheck strict, validator OpenAPI, database thật). Core phải isomorphic, không được phụ thuộc Node, Docker hay các công cụ đó.

**Quyết định:** tách hai tầng test.

| Tầng | Nơi | Chạy khi | Nội dung |
|---|---|---|---|
| Unit và snapshot | `packages/core`, trong `pnpm test` | Mọi lần `pnpm test`, không cần Docker | Mục 10 |
| Conformance | Package mới `packages/codegen-conformance` (`@schemaforge/codegen-conformance`, `private`), script `test:conformance` | Chạy local bằng `pnpm test:conformance`, dùng Docker sẵn có trên máy dev; không có job CI | Chạy output qua công cụ đích thật |

- Package conformance chỉ có test, không có mã nguồn, nên không có ngưỡng coverage và không có script `test`: `pnpm test` ở root không cần Docker. Task Turborepo `test:conformance` phụ thuộc `^build` và được cache như các task khác, nên commit không sửa core không chạy lại. Root thêm script `pnpm test:conformance`. Script này không thuộc các lệnh mọi commit phải chạy (`git.md`), nhưng là cổng chặn của phần 6 (quyết định ngày 2026-10-02, vì không còn CI bắt lỗi sau khi push): khi conformance test của một đích đã có, task nào thêm hoặc sửa generator của đích đó chạy conformance của đích đó trước khi báo xong, và orchestrator chạy lại khi xác minh task. Trước khi conformance test của đích có, cổng của generator SQL MySQL và SQL Server là lần chạy probe (mục dưới) đã khớp spec. Phần 6 chỉ được tính là xong khi mọi bộ conformance test của mục này đều qua.
- Package dùng core qua `@schemaforge/core` (bản build) và fixture qua `@schemaforge/core/testing` (plan phần 2 đã xuất bản entry point này).
- Fixture là các schema hợp lệ (`validateSchema` rỗng): `createSampleSchema()` của phần 2, cùng các fixture phần 6 thêm vào `src/testing/` (mục 10).
- **Kiểu custom khi chạy trên database thật** (Vấn đề 3, quyết định ngày 2026-10-02): `createSampleSchema()` có cột `location` kiểu `geometry(Point, 4326)`. `postgres:18-alpine` không có PostGIS, MySQL không có cú pháp này, SQL Server có `geometry` nhưng không nhận tham số, nên DDL của fixture nguyên trạng lỗi trên cả ba database. Package conformance có helper thay tên kiểu custom của fixture bằng một kiểu có thật của dialect trước khi sinh cho CG-01 và CG-08: `inet` (PostgreSQL), `YEAR` (MySQL), `money` (SQL Server), cả ba qua cú pháp an toàn của phần 2. Snapshot trong core vẫn dùng fixture nguyên trạng. Không dùng image PostGIS: nặng, và không giải quyết MySQL, SQL Server. Cột custom bắt buộc không có mặc định chỉ nằm ở bảng riêng của fixture, để seed bỏ bảng đó (`seed-table-skipped`) mà không bỏ bảng khác.
- Không có job CI: GitHub Actions đã bị bỏ ngày 2026-10-02 (`architecture.md`). Nếu dự án thêm lại CI, conformance chạy được trên runner có Docker mà không đổi code test.
- **Probe trước khi viết generator** (Vấn đề 9, quyết định ngày 2026-10-02): một task đầu của plan viết probe trong package conformance, chạy local qua Docker, cho mọi điểm ở mục [Rủi ro](#rủi-ro-cần-kiểm-tra-khi-triển-khai) cùng các giới hạn của mục 4 (độ dài khóa MySQL và SQL Server, độ dài comment, giây lẻ SQL Server, so tên không phân biệt dấu). Probe cho kết quả khác spec thì dừng generator của dialect đó cho tới khi orchestrator sửa spec theo kết quả.

| Tiêu chí | Kiểm chứng |
|---|---|
| CG-01 chạy trên database thật | Testcontainers khởi động `postgres:18-alpine`, `mysql:8.4`, `mcr.microsoft.com/mssql/server:2022-latest` một lần mỗi file test; mỗi fixture chạy trong một database mới tạo. Chạy DDL bằng `pg`, `mysql2` (`multipleStatements`), `mssql`: không lỗi, và số bảng trong `information_schema` bằng số bảng của schema |
| CG-02 `prisma validate` | Ghi output của từng fixture × provider ra thư mục tạm, chạy `prisma validate` 7.10.0: exit code 0 và không có dòng cảnh báo |
| CG-03, CG-04, CG-05 typecheck strict | Ghi output ra thư mục tạm, chạy TypeScript compiler API với các option strict của `tsconfig.base.json` và `drizzle-orm` 0.45.2, `zod` 4.6.5 đã cài: không có diagnostic |
| CG-05 đúng ngữ nghĩa | Import schema Zod vừa sinh, parse từng dòng seed JSON (CG-08) của cùng fixture: mọi dòng hợp lệ. Mỗi dòng được parse bằng schema đã `.partial()` đúng cho các cột CG-08 bỏ (kiểu custom, `NOT NULL`, có default); mọi key khác vẫn bắt buộc (R27) |
| CG-06 | Typecheck cùng `msw` 2.15.0; chạy `setupServer` của `msw/node` và gọi đủ các route của một bảng khóa đơn và một bảng khóa nhiều cột |
| CG-07 validator OpenAPI | `validate()` của `@readme/openapi-parser` 9.0.0: `valid` là `true` |
| CG-08 | Chạy seed SQL của từng dialect ngay sau DDL trong cùng database: không lỗi, số dòng mỗi bảng đúng như `SeedDataset` |
| CG-09 | `Parser.parse(output, 'dbmlv2')` của `@dbml/core` 10.1.1 không lỗi; bảng, cột, kiểu, quan hệ, hành động, enum, index, nhóm, ghi chú khớp schema. Round-trip bằng IE-03 thêm ở phần 7 |

**Chọn validator OpenAPI:** `@readme/openapi-parser` kiểm tra theo JSON Schema của OpenAPI 3.1 và thêm kiểm tra ngữ nghĩa. Thử với một tài liệu thiếu tham số đường dẫn và trùng `operationId`: `@readme/openapi-parser` báo cả hai lỗi, còn `@seriousme/openapi-schema-validator` 2.9.1 cho là hợp lệ vì chỉ kiểm tra JSON Schema.

**Chọn Testcontainers:** test tự quản lý vòng đời container và cổng ngẫu nhiên, không cần bước khởi động tay và không đụng container Postgres 16 đang chạy sẵn trên máy dev (`architecture.md`). **Phương án bị loại:** file Docker Compose khởi động sẵn ba database: thêm một bước tay trước mỗi lần chạy, cổng cố định dễ trùng với container sẵn có, và vòng đời database tách khỏi test.

**Phương án bị loại cho cả mục:** đặt conformance test trong `packages/core`: core sẽ có dev dependency vào Prisma CLI, driver database và Docker, và `pnpm test` của core cần Docker. Chỉ dùng snapshot: snapshot giữ output ổn định nhưng không chứng minh output chạy được.

## 8. Code panel trên frontend

Theo bố cục của [spec phần 3](2026-09-14-editor-mvp-design.md), mục 2: toolbar trên, panel trái (Bảng, Enum, Vấn đề), canvas giữa, panel thuộc tính phải.

- **Mở panel:** toolbar thêm nút "Code". Bấm vào thì cột phải chuyển từ panel thuộc tính sang code panel; bấm lại thì trở về panel thuộc tính. Chọn phần tử trên canvas không đổi chế độ, để người dùng vừa xem code vừa chọn bảng. Code panel cần cao như panel thuộc tính và không làm canvas thấp đi như panel đáy. Plan chốt độ rộng của cột khi ở chế độ code.
- **Nội dung, từ trên xuống:**
  1. Chọn đích: SQL DDL, Prisma, Drizzle, TypeScript, Zod, Mock API, OpenAPI, Seed data, DBML, Markdown.
  2. Option của đích: dialect cho SQL DDL, `provider` cho Prisma, `dialect` cho Drizzle (SQL Server hiện nhưng không chọn được, kèm chú thích), `format`, `rowsPerTable`, `seed` cho Seed data. Markdown không có option trên giao diện: nhãn lấy theo ngôn ngữ đang dùng.
  3. Cảnh báo khi schema còn issue (mục 2), số issue lấy từ `getIssues(document)` của editor, nút mở tab "Vấn đề".
  4. Vùng code: `<pre>` cuộn ngang và dọc, có `tabIndex={0}` và `aria-label` đã dịch, nút "Copy". Copy gọi `navigator.clipboard.writeText` và hiện toast qua `notify` của phần 3; clipboard bị từ chối thì hiện toast lỗi.
  5. Danh sách diagnostic, có số lượng, mỗi dòng là thông báo đã dịch kèm tên phần tử. Bấm một dòng thì chọn phần tử và đưa vào giữa khung nhìn bằng action của store phần 3, panel vẫn ở chế độ code.
- **Cập nhật:** khi panel mở, mỗi lần tài liệu, đích hoặc option đổi thì gửi yêu cầu sinh mới sang worker (mục 9). Tài liệu chỉ đổi khi commit thao tác (phần 3, mục 7), nên không cần debounce. Kết quả của yêu cầu cũ bị bỏ theo `requestId`. Đích và option đã chọn nằm trong store của editor, không lưu lại khi tải trang.
- **Highlight:** Shiki 4.4.3 bản rút gọn (`shiki/core`), regex engine JavaScript (`shiki/engine/javascript`), ngôn ngữ `sql`, `prisma`, `typescript`, `json`, `markdown`, theme tạo bằng `createCssVariablesTheme`. `codeToTokens` trả token có màu dạng `var(--code-token-…)`; component render token thành `<span>`, không dùng HTML string và `dangerouslySetInnerHTML`. Các biến `--code-*` khai báo trong `:root` và `.dark` của `globals.css`, trỏ về token của shadcn/ui như cách phần 3 làm với `--xy-*`. DBML hiện không highlight: Shiki không có grammar DBML.
- **i18n:** namespace `codeGenerator` (tên đích, option, nút, cảnh báo, nhãn Markdown) và namespace `generatorDiagnostics` với `satisfies Record<GeneratorDiagnosticCode, string>`, theo đúng cách phần 3 làm với `issues`, nên thêm mã diagnostic trong core mà chưa dịch thì frontend không biên dịch được. Biến nội suy lấy từ `resolveIssueTarget` của phần 3.
- **CSP:** `buildContentSecurityPolicy` của phần 3 thêm `worker-src 'self'`. Không thêm `'wasm-unsafe-eval'` hay `'unsafe-eval'`: regex engine JavaScript không dùng WebAssembly, và worker import module đặt `z.config({ jitless: true })` (`zod-config.ts` của phần 3) trước mọi module import `@schemaforge/core`, như `AppProviders`.
- **Code:** `frontend/src/features/code-generator/`: `code-panel.tsx`, `generator-target-select.tsx`, `generator-options.tsx`, `code-view.tsx`, `generator-diagnostic-list.tsx`, `use-generated-code.ts`, `code-generator.worker.ts`. `code-panel.tsx` được tải bằng `next/dynamic` khi mở panel lần đầu.

**Chọn Shiki:** có grammar Prisma (Prism và highlight.js không có), chạy không cần WebAssembly với regex engine JavaScript, và theme CSS variables cho phép màu đi theo token sáng tối. Đo bằng esbuild (minify, gzip): phần lõi kèm engine khoảng 55 KB, grammar `sql` 7,5 KB, `prisma` 1,5 KB, `typescript` 16 KB, `json` 0,8 KB, `markdown` 5,7 KB, tổng khoảng 86 KB, chỉ tải khi mở panel.

**Phương án bị loại:** Prism (`prismjs`): không có grammar Prisma. CodeMirror 6 ở chế độ chỉ đọc: kéo theo bộ máy soạn thảo mà panel không cần, và cũng không có sẵn ngôn ngữ Prisma. Viết grammar TextMate cho DBML: không tiêu chí nào cần highlight.

## 9. Hiệu năng

- **Web Worker:** sinh code và tách token chạy trong `code-generator.worker.ts`. Worker `import()` động subpath của đích và grammar Shiki khi cần, nhận `{ requestId, target, options, document }` và trả `{ requestId, file, diagnostics, tokens }`. Luồng chính không bao giờ chạy generator. Tài liệu là JSON thuần nên gửi qua `postMessage` được.
- **Fixture đo:** `createLargeSchema({ tableCount: 200 })` trong `@schemaforge/core/testing`: 200 bảng, 20 cột mỗi bảng, 300 quan hệ (có khóa nhiều cột và vòng), 200 index, 20 enum.
- **Mục tiêu trong core** (script `bench` bằng `vitest bench`, Node 24, máy dev): mỗi generator có trung vị ≤ 100 ms trên fixture này; seed với `rowsPerTable` 100 ≤ 500 ms. Benchmark không nằm trong `pnpm test`, vì test không được phụ thuộc thời gian đồng hồ (`testing.md`); plan chạy và ghi kết quả khi hoàn thành.
- **Mục tiêu trên giao diện** (kiểm tra tay, bản build production): với fixture trên, từ khi đổi đích tới khi code hiện ra ≤ 1 giây, và kéo bảng trên canvas trong lúc panel đang sinh code không bị giật.

**Lý do chọn worker:** output TypeScript của 200 bảng dài vài nghìn dòng; tách token chừng đó trên luồng chính sẽ chặn thao tác kéo thả. Worker cũng giữ code generator và Shiki ngoài bundle của editor.

**Phương án bị loại:** chạy trên luồng chính kèm debounce: đủ nhanh với schema nhỏ, nhưng schema lớn vẫn chặn luồng chính mỗi lần cập nhật.

## 10. Chiến lược test

Chạy trong `pnpm test` của core, ngưỡng coverage 90% số dòng như phần 2.

- **Fixture mới** trong `src/testing/`, xuất bản qua `@schemaforge/core/testing`: `createNamingEdgeSchema()` (tên có dấu, khoảng trắng, từ khóa, bắt đầu bằng chữ số, chứa `"`, `` ` ``, `]`, `'`, `\`, `*/`, tên dài 63 byte, tên trùng sau khi ánh xạ, cột tên `__proto__`, hai cột unique chỉ khác dấu như `ma`, `má`); `createTargetLimitSchema()` (vòng cascade và nhiều đường cascade, quan hệ `restrict` nằm trên vòng, `text`/`json`/`binary` trong khóa, `varchar(n)` với `n > 768` trong khóa, khóa nhiều cột vượt 3072 byte trên MySQL, tham số kiểu vượt giới hạn kể cả cột vừa vượt giới hạn vừa thuộc khóa, comment vượt giới hạn MySQL và SQL Server, khóa chính `char(500)` (thành `nchar(500)` = 1000 byte trên SQL Server) cùng một quan hệ có cột khóa ngoại `char(500)` tham chiếu tới nó, unique `char(900)` (1800 byte), khóa chính nhiều cột có cột auto-increment và vượt 3072 byte trên MySQL, khóa chính `(a, id)` với `id` auto-increment đứng sau, bảng có cột `varchar(16383)` không thuộc khóa chính, unique, index hay cặp cột quan hệ (dòng vượt 65 535 byte trên MySQL), literal `time`, `timestamp` có hơn 7 chữ số giây lẻ, unique nullable được tham chiếu, bảng không có khóa chính, kiểu custom, `setDefault`); `createLargeSchema()` (mục 9). Mọi fixture hợp lệ theo `validateSchema`, nên không có bảng rỗng hay index trùng tên bảng (mục 2).
- **Snapshot theo đích:** mỗi đích × fixture × option chính một snapshot bằng `toMatchFileSnapshot`, lưu ở `__snapshots__/<đích>/<fixture>.<phần mở rộng>` để đọc được bằng highlight của editor. Snapshot kèm danh sách diagnostic.
- **Định danh:** bảng test cho `quoteSqlIdentifier`, `sqlStringLiteral`, `toPascalCaseIdentifier`, `toCamelCaseIdentifier`, `createNameAllocator`, `buildConstraintName` (ví dụ ở mục 5, tên 63 và 64 byte, cắt ở ranh giới code point của chữ có dấu, hash xác định).
- **Diagnostic:** mỗi mã trong 17 mã của `GENERATOR_DIAGNOSTIC_CODES` có một test gây ra nó ở từng đích liên quan, kiểm tra đúng `code` và `path`, và một test ở trường hợp tương đương không có diagnostic (ví dụ `restrict` trên SQL Server, enum trên MySQL). Trường hợp chỉ xảy ra khi schema còn issue (giá trị enum dài hơn 4000 code unit UTF-16 vượt giới hạn 63 byte của phần 2; `custom-type-unsafe`, `default-omitted`; `identifier-collision-renamed` trên MySQL, R20) dùng tài liệu dựng riêng trong test, không dùng fixture hợp lệ.
- **Seed:** `validateSeedDataset` có test cho từng mã; `buildSeedDataset` cho kết quả qua `validateSeedDataset` trên mọi fixture; vòng có cột nullable, vòng toàn cột bắt buộc, tự tham chiếu, 1-1, unique trên `boolean`.
- **Property test** bằng fast-check, seed cố định như phần 2, trên tài liệu đúng cấu trúc có thể còn issue:
  1. Không generator nào throw.
  2. Xác định: gọi hai lần cho cùng output; xáo thứ tự khóa của các map cho cùng output.
  3. An toàn: với tên và comment chứa ký tự quote của đích, output SQL sau khi bỏ mọi định danh và chuỗi đã quote không còn ký tự nào từ tên hay comment.
  4. Seed: với schema hợp lệ, `validateSeedDataset(buildSeedDataset(…))` rỗng; cùng `seed` cho cùng dataset.
- **Frontend** (Vitest, jsdom, worker được mock ở biên): chọn đích và option gửi đúng yêu cầu; nút copy gọi clipboard và hiện toast; cảnh báo hiện khi có issue; diagnostic hiện thông báo đã dịch và bấm vào thì chọn phần tử; `buildContentSecurityPolicy` có `worker-src 'self'`.
- **Conformance test** ở mục 7.

## Phiên bản

Kiểm tra ngày 2026-09-14. Package đã có trong catalog của phần 1 giữ nguyên phiên bản đó.

| Thư viện, image | Phiên bản | Dùng ở | Ghi chú |
|---|---|---|---|
| `zod` | 4.6.5 | Output CG-05; typecheck trong conformance | Trùng catalog |
| `typescript` | 6.0.3 | Typecheck trong conformance | Trùng catalog |
| `prisma` | 7.10.0 | `prisma validate` trong conformance | Dist-tag `latest` trỏ `8.0.0-rc.15` (pre-release) |
| `drizzle-orm` | 0.45.2 | Typecheck trong conformance | Dist-tag `latest`; `rc` là `1.0.0-rc.4`, `beta` là `1.0.0-beta.22` |
| `msw` | 2.15.0 | Conformance CG-06 | |
| `@readme/openapi-parser` | 9.0.0 | Conformance CG-07 | Hỗ trợ OpenAPI 2.0, 3.0, 3.1 |
| `@dbml/core` | 10.1.1 | Conformance CG-09 | Đã có trong `architecture.md` cho import; ESM khoảng 21 MB, gzip khoảng 2,9 MB |
| `testcontainers`, `@testcontainers/postgresql`, `@testcontainers/mysql`, `@testcontainers/mssqlserver` | 12.1.0 | Conformance CG-01, CG-08 | |
| `pg`, `mysql2`, `mssql` | 8.23.0, 3.24.4, 12.7.2 | Conformance CG-01, CG-08 | |
| `postgres`, `mysql`, `mcr.microsoft.com/mssql/server` | `18-alpine` (18.6), `8.4` (8.4.11), `2022-latest` | Conformance CG-01, CG-08 | |
| `shiki` | 4.4.3 | Frontend, code panel | |
| `fast-check` | 4.10.0 | Property test | Đã chọn ở phần 2 |
| `@faker-js/faker` | 10.6.0 | Không dùng | Xem CG-08 |
| `json-server` | 1.0.0-beta.15 | Không dùng | Xem CG-06 |

## Tiêu chí hoàn thành

**Chung**

- [ ] Mỗi đích có subpath `@schemaforge/core/generators/<đích>` export một hàm theo mục 1. Entry point chính export `GENERATOR_TARGETS`, `GENERATOR_DIAGNOSTIC_CODES`, type option, `MarkdownLabels`, `SeedDataset`. Core vẫn chỉ có runtime dependency là Zod và qua lint ranh giới của core.
- [ ] Trên bản build production, không đăng nhập, sinh code cho mọi đích: tab Network không có request nào ngoài file tĩnh của ứng dụng; Console không có vi phạm CSP.
- [ ] Conformance test ở mục 7 qua với mọi fixture khi chạy local qua Docker (`pnpm test:conformance`).
- [ ] Probe ở mục 7 chạy local qua Docker cho mọi điểm ở mục Rủi ro và cho kết quả khớp spec (hoặc spec đã được sửa theo kết quả trước khi viết generator của dialect đó).
- [ ] Validation phần 2 báo `table-columns-empty` và `index-name-conflicts-table` (mục 2), có bản dịch `vi`, `en` trong namespace `issues`; generator vẫn sinh output không throw cho tài liệu có hai issue này.
- [ ] Property test ở mục 10 qua: không throw, xác định kể cả khi xáo thứ tự khóa, an toàn với tên và comment chứa ký tự quote. Không output nào chứa thời gian.
- [ ] Code panel: chọn đích và option, xem code có highlight, copy được, danh sách diagnostic đã dịch, cảnh báo khi schema còn issue. Component test qua.
- [ ] Mỗi mã trong `GENERATOR_DIAGNOSTIC_CODES` có test gây ra nó và có bản dịch `vi`, `en` (frontend không biên dịch được nếu thiếu). Mỗi dòng "tương đương" của ma trận mục 4 có test không sinh diagnostic.
- [ ] Comment bảng và cột xuất hiện trong output của SQL (ba dialect), Prisma, Drizzle, TypeScript, Zod, OpenAPI, DBML và Markdown, kiểm tra bằng snapshot.
- [ ] `vitest bench` đạt mục tiêu ở mục 9; mục tiêu trên giao diện được kiểm tra tay.

**Theo tính năng**

- [ ] **CG-01:** chọn được PostgreSQL, MySQL, SQL Server. Output có bảng, cột, khóa chính, khóa ngoại, index, enum và comment theo mục 3 và 4. DDL của mọi fixture chạy không lỗi trên PostgreSQL 18, MySQL 8.4 và SQL Server 2022.
- [ ] **CG-02:** output có model, quan hệ hai phía, enum và index. `prisma validate` 7.10.0 qua, không cảnh báo, với cả ba provider.
- [ ] **CG-03:** output có bảng, khóa ngoại, `relations()`, enum và index cho PostgreSQL và MySQL. Output qua typecheck strict với `drizzle-orm` 0.45.2.
- [ ] **CG-04:** mỗi bảng một type; nullable là `| null`; enum là union chuỗi. Output qua typecheck strict.
- [ ] **CG-05:** mỗi bảng một schema Zod 4; nullable là `.nullable()`; enum là `z.enum`. Output qua typecheck strict, và seed JSON của cùng fixture parse được bằng các schema đó.
- [ ] **CG-06:** handler MSW cho mọi bảng: CRUD khi có khóa chính, danh sách và tạo mới khi không có. Output qua typecheck, và test gọi các route bằng `msw/node` qua.
- [ ] **CG-07:** tài liệu OpenAPI 3.1 dạng JSON có component cho từng bảng và enum, cùng đường dẫn CRUD. `@readme/openapi-parser` báo hợp lệ.
- [ ] **CG-08:** xuất được SQL cho ba dialect và JSON. Dữ liệu qua `validateSeedDataset` (kiểu, nullable, unique, enum, khóa ngoại). Dòng của bảng được tham chiếu đứng trước dòng tham chiếu tới nó; riêng cạnh nullable dùng để phá vòng được gán bằng `UPDATE` sau cùng. Seed SQL chạy không lỗi sau DDL trên ba database. Cùng `seed` cho cùng output.
- [ ] **CG-09:** `@dbml/core` parse output không lỗi, và bảng, cột, kiểu, quan hệ, hành động, enum, index, nhóm, ghi chú khớp schema.
- [ ] **CG-10:** tài liệu liệt kê từng bảng với cột, kiểu, ràng buộc, comment, index và quan hệ, cùng danh sách enum; nhãn theo ngôn ngữ giao diện.
- [ ] Khi xong, `roadmap.md` chuyển phần 6 sang "Xong"; quyết định của spec được ghi vào `architecture.md`.

### Đối chiếu với danh sách tính năng

| Tiêu chí trong danh sách tính năng | Nơi đáp ứng |
|---|---|
| Chung: chạy trên trình duyệt bằng core, không đăng nhập, không gọi server | Mục 1, 8, 9; tiêu chí chung 1, 2 |
| Chung: với schema hợp lệ, output đúng cú pháp và dùng được với công cụ đích | Mục 7; tiêu chí chung 3 và tiêu chí theo tính năng |
| Chung: cùng một schema luôn cho cùng một output | Mục 10; tiêu chí chung 4 |
| Chung: xem và copy được output | Mục 8; tiêu chí chung 5 |
| Ghi chú câu hỏi 7 | Mục 4; tiêu chí chung 6 |
| ED-06: comment xuất hiện trong output ở đích hỗ trợ | Mục 4; tiêu chí chung 7 |
| CG-01: chọn dialect; output gồm các phần tử; chạy không lỗi | CG-01, mục 3, 4, 7; tiêu chí CG-01 |
| CG-02: model, quan hệ, enum, index; `prisma validate` | CG-02, mục 7; tiêu chí CG-02 |
| CG-03: bảng, quan hệ, enum, index; typecheck | CG-03, mục 7; tiêu chí CG-03 (chỉ PostgreSQL, MySQL) |
| CG-04, CG-05: type hoặc schema mỗi bảng, nullable, enum; typecheck | CG-04, CG-05, mục 7; tiêu chí CG-04, CG-05 |
| CG-06: mock REST API cho các bảng | CG-06; tiêu chí CG-06 |
| CG-07: OpenAPI có schema từng bảng; qua validator | CG-07, mục 7; tiêu chí CG-07 |
| CG-08: tuân thủ ràng buộc; thứ tự theo tham chiếu | CG-08, mục 7; tiêu chí CG-08 |
| CG-09: DBML hợp lệ; import lại bằng IE-03 | CG-09, mục 7; tiêu chí CG-09; round-trip ở phần 7 |
| CG-10: nội dung tài liệu | CG-10; tiêu chí CG-10 |

## Phạm vi

**Trong phạm vi:**

- 12 generator (ba dialect SQL, Prisma, Drizzle, TypeScript, Zod, Mock API, OpenAPI, seed, DBML, Markdown) cùng các hàm dùng chung ở mục 5.
- `SeedDataset`, `buildSeedDataset`, `validateSeedDataset`, `serializeSeedDataset`.
- Fixture mới trong `@schemaforge/core/testing`, snapshot, property test, benchmark.
- Package `packages/codegen-conformance` (conformance test và probe, chạy local qua Docker), task Turborepo `test:conformance`, script root `pnpm test:conformance`.
- Hai issue mới của validation phần 2, `table-columns-empty` và `index-name-conflicts-table` (mục 2), làm bằng task của plan phần 6.
- Code panel, worker, namespace i18n `codeGenerator` và `generatorDiagnostics`, `worker-src 'self'` trong CSP.

**Ngoài phạm vi:**

| Hạng mục | Làm ở |
|---|---|
| Importer SQL, Prisma, DBML, JSON; test round-trip DBML bằng IE-03 | Phần 7 |
| Tải output thành file (IE-05), file ZIP (IE-08) | Phần 7 |
| Dữ liệu mẫu do AI sinh (AI-06); phần 6 chỉ cung cấp `SeedDataset` và các hàm dùng chung | Phần 5 |
| Drizzle cho SQL Server, relations v2 | Khi Drizzle 1.0 phát hành chính thức |
| Câu lệnh `DROP`, migration giữa hai phiên bản schema; OpenAPI dạng YAML; dữ liệu giống thật; kiểm tra body, phân trang trong Mock API; highlight DBML; SQLite | Chưa có tính năng nào cần |

## Vấn đề với các spec đã duyệt

Vấn đề 10, 12 (mục [Quyết định bổ sung 2026-10-02](#quyết-định-bổ-sung-2026-10-02)) đổi [spec phần 2](2026-09-14-core-schema-model-design.md). Việc này làm bằng task trong plan phần 6; spec và plan phần 2 được cập nhật ở một task sau, nên tới lúc đó bảng này là nguồn của các thay đổi. Bản dịch `vi`, `en` của hai mã mới nằm trong namespace `issues` của frontend.

| # | Spec, mục | Hiện ghi | Thay đổi do spec này |
|---|---|---|---|
| 1 | Phần 2, mục 8 ("Danh mục mã issue ngữ nghĩa") | 25 mã; `ISSUE_CODES` trong `packages/core/src/validation/issue-codes.ts` theo nhóm: trùng tên, giá trị enum, kiểu và mặc định của cột, auto-increment, quan hệ | 27 mã. `index-name-conflicts-table` (`indexes/<id>/name`, tên index trùng tên một bảng bất kỳ, so bằng `toNameKey`, tiêu chí ED-04) đứng ngay sau `index-name-duplicate`. `table-columns-empty` (`tables/<id>/columnIds`, bảng không có cột, tiêu chí ED-01) đứng ngay sau `subject-area-name-duplicate`, trước `enum-values-empty`, cùng nhóm "không có phần tử" với `enum-values-empty` |
| 2 | Phần 2, mục 7 ("Phạm vi không được trùng", dòng Index) | Tên index không trùng trong cả schema | Tên index không trùng tên index khác trong schema, và không trùng tên bảng nào (PostgreSQL dùng chung không gian tên cho bảng và index) |
| 3 | Phần 2, mục 6 (Index) và mục 9 ("Tạo quan hệ kèm cột khóa ngoại"); `suggestIndexName` trong `packages/core/src/operations/suggest-index-name.ts` | `suggestIndexName` đề xuất tên không trùng tên index khác | `suggestIndexName` tránh cả tên index khác lẫn tên bảng (so bằng `toNameKey`), để editor, importer và AI không tự tạo issue `index-name-conflicts-table` |

## Rủi ro cần kiểm tra khi triển khai

- **Conformance chỉ chạy local.** Không có CI, nên lỗi của output với công cụ đích chỉ lộ ra khi có người chạy `pnpm test:conformance`. Cổng conformance của mục 7 áp cho task generator khi conformance test của đích đã có; trước đó probe là cổng (MySQL, SQL Server), chạy local qua Docker trước khi viết generator của hai dialect này.
- **Hành vi MySQL đã probe trên MySQL 8.4.11 ngày 2026-10-02** (Task 8 của plan, kết quả đầy đủ trong `document/executions/logs/2026-10-02-code-generators-task-8.md`): tên cột, index, ràng buộc chỉ khác dấu (kể cả `đ`/`d`, `ø`/`o`, `ł`/`l`, `ħ`/`h`, `ß`/`s`, `ð`/`d`) **không** trùng, còn tên chỉ khác hoa thường trùng (lỗi 1060), nên quy tắc so định danh đổi sang `caseInsensitive` (mục 5, R20); `utf8mb4_0900_as_ci` chấp nhận `ENUM` có giá trị chỉ khác dấu; InnoDB 8.4.11 **nhận** `ON DELETE SET DEFAULT` nhưng generator vẫn hạ cấp vì tài liệu MySQL ghi không hỗ trợ (R20); literal `timestamptz` có `Z` hoặc `-00:00` bị từ chối (lỗi 1067), `+00:00` và độ lệch khác được nhận, nên hàm literal MySQL đổi sang `+00:00` (mục 3, R20); literal 9 chữ số giây lẻ được nhận trên cả ba kiểu, literal đã cắt về 6 chữ số cũng vậy (sanity, mục 3). Các điểm còn lại khớp spec: `DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)`; giá trị mặc định dạng biểu thức cho `LONGTEXT`, `JSON` (literal không ngoặc trên `LONGTEXT` bị từ chối, lỗi 1101); `DEFAULT (UUID())` trên `CHAR(36)`; khóa tới 3072 byte được nhận, vượt thì lỗi 1071; comment cột quá 1024 ký tự, comment bảng quá 2048 ký tự bị từ chối (lỗi 1629, 1628, giới hạn tính theo ký tự); cột `AUTO_INCREMENT` không đứng đầu index nào báo lỗi 1075 và `INDEX` thường trên cột đó đủ để tạo bảng (mục 4); bảng `id INT, v VARCHAR(16383)` báo lỗi 1118, bản `LONGTEXT` tạo được (mục 4). Probe là hợp đồng hành vi của database: đổi kỳ vọng của probe cần quyết định của orchestrator và sửa spec cùng lúc.
- **SQL Server đã probe trên SQL Server 2022 ngày 2026-10-02** (cùng log): `DECLARE` đứng sau `CREATE TABLE` trong cùng batch và `sp_addextendedproperty` nhận `@level0name` là biến; giá trị `MS_Description` quá 3750 ký tự bị từ chối (Msg 15097); literal `time`, `datetime2` 7 chữ số giây lẻ chạy được, và 8 chữ số **cũng** được nhận, kể cả khi một dòng dùng giá trị mặc định (hàm literal vẫn cắt về 7 chữ số, mục 3, R20); khóa ngoại tới unique index lọc bị từ chối (Msg 1776), tới `UNIQUE` trên cột nullable được nhận, và `UNIQUE` chỉ cho một dòng `NULL` (Msg 2627); vòng cascade, hai đường cascade và tự tham chiếu cascade bị từ chối (Msg 1785), bản `NO ACTION` được nhận; `ON DELETE RESTRICT` là lỗi cú pháp (Msg 156); khóa chính `nchar(451)` (902 byte) và unique `nchar(851)` (1702 byte) bị từ chối (Msg 1944), bản `nvarchar` tạo được; khóa ngoại `nchar(500)` tham chiếu khóa chính `nvarchar(500)` bị từ chối (Msg 1778). Còn phải xác nhận bằng conformance test: thuật toán phát hiện nhiều đường cascade (bỏ `noAction` và `restrict` khỏi đồ thị) khớp kiểm tra của SQL Server và của Prisma trên fixture; unique index lọc được tạo trước khóa ngoại.
- **Drizzle, đã kiểm chứng ngày 2026-10-02** (bước kiểm chứng sớm của Task 18, `drizzle-orm` 0.45.3, strict, `verbatimModuleSyntax`): khi hai bảng tham chiếu nhau (khóa ngoại `b → a` trong callback cấu hình của `b` trong khi `a` tham chiếu `b`), TypeScript báo TS7022 ("implicitly has type 'any' … referenced in its own initializer") trên biến bảng và TS7024 trên callback, ở cả PostgreSQL và MySQL. Tham chiếu tới bảng khai báo sau mà không tạo vòng, và tự tham chiếu qua `table.<key>`, không lỗi. Chú thích kiểu trả về của callback (`PgTableExtraConfigValue[]`, `MySqlTableExtraConfigValue[]`) hết lỗi, nên mọi callback đều được chú thích (CG-03, R21). `getTableConfig` lúc chạy trả đúng ràng buộc dù có chú thích hay không; rủi ro này đã đóng.
- **PostgreSQL, tên sequence của identity (giới hạn đã chấp nhận, quyết định ngày 2026-10-02):** cột identity tạo sequence ngầm tên `<bảng>_<cột>_seq` trong cùng không gian tên với bảng và index. Nếu tên đó đã có, PostgreSQL chọn `<bảng>_<cột>_seq1` (rồi `seq2`…), nên tạo bảng không lỗi. DDL chỉ lỗi khi một đối tượng của người dùng trùng tên được tạo **sau** sequence (index tên `t_id_seq`, hoặc bảng đứng sau theo thứ tự tên), hoặc khi tên dài bị cắt về 63 byte làm đổi tên. Không thêm mã issue: trường hợp hiếm, và người dùng sửa được bằng cách đổi tên.
- **Prisma:** từng native type trong bảng ở mục 3 được xác nhận bằng `prisma validate`. Nếu Prisma 8 phát hành chính thức trước khi triển khai, kiểm tra lại đầu file và kết quả validate.
- **Next.js 16:** worker khai báo bằng `new Worker(new URL("./code-generator.worker.ts", import.meta.url), { type: "module" })` build đúng với Turbopack và chạy dưới CSP có `worker-src 'self'`.
- **Shiki:** regex engine JavaScript chạy đúng với năm grammar trên mẫu nhỏ; plan đo thời gian tách token với output của `createLargeSchema()`.

## Câu hỏi đã trả lời

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Drizzle chưa có SQL Server cho tới khi 1.0 phát hành chính thức. Chấp nhận, hay nhắm 1.0 RC ngay? | Chấp nhận: Drizzle 0.45, chỉ PostgreSQL và MySQL, relations v1. SQL Server và relations v2 làm khi Drizzle 1.0 phát hành chính thức |
| 2 | Mock API và OpenAPI chỉ có CRUD tối thiểu. Có đủ cho CG-06, CG-07 không? | Đủ: Mock API là một file handler MSW 2; OpenAPI 3.1 dạng JSON có đường dẫn CRUD trùng Mock API |
| 3 | Seed data có giá trị theo kiểu, không giống dữ liệu thật. Có đồng ý không? | Đồng ý: PRNG có seed trong core, không faker; dữ liệu giống thật thuộc AI-06 |
| 4 | Cài Docker cho máy dev, hay chỉ chạy conformance trong CI? | Máy dev có Docker. Từ ngày 2026-10-02 (GitHub Actions bị bỏ), conformance test và probe chạy local qua Docker và là cổng chặn của task generator (mục 7). Unit test và snapshot test chạy không cần Docker |

## Quyết định bổ sung 2026-10-02

Task 0 của [plan phần 6](../plans/2026-09-15-code-generators-plan.md) (mục "Vấn đề phát hiện khi lập plan"). Người dùng giao toàn quyền quyết định cho orchestrator; các quyết định dưới đây là của orchestrator ngày 2026-10-02 và người dùng có thể đổi sau. Số thứ tự là số vấn đề trong plan.

| # | Vấn đề | Quyết định | Ghi ở |
|---|---|---|---|
| 1 | MySQL giới hạn tổng độ dài khóa 3072 byte | Phương án (a): cột `char(n)`, `varchar(n)` có `n > 768` trong khóa hẹp về `VARCHAR(768)` kèm `key-column-type-narrowed`; tổng vẫn vượt 3072 byte thì bỏ ràng buộc hoặc index kèm `key-column-type-not-indexable` | Mục 4 (danh mục, "Độ dài khóa trên MySQL", ma trận) |
| 2 | Giới hạn độ dài comment của MySQL, SQL Server | Thêm mã thứ 17 `comment-truncated`, đứng sau `null-character-removed`, trước `seed-table-skipped`; cắt ở ranh giới code point; `path` là đường dẫn `comment` của bảng hoặc cột | Mục 4 (danh mục, "Cắt comment", ma trận) |
| 3 | Kiểu custom của fixture trên database thật | Helper của package conformance thay kiểu custom bằng `inet`, `YEAR`, `money`; snapshot core giữ fixture nguyên trạng; không dùng image PostGIS | Mục 7 |
| 4 | `restrict` trong đồ thị cascade của SQL Server | Đồ thị bỏ cả `noAction` và `restrict` | Mục 4 (danh mục, "Phát hiện vòng cascade") |
| 5 | Cột tên `__proto__` | `formatPropertyKey` trả `["__proto__"]`; object có khóa từ tên người dùng dựng bằng `Object.fromEntries` | Mục 5 ("Định danh code") |
| 6 | Tham số kiểu chưa đủ trong ma trận | (a) PostgreSQL `char(n)` như `varchar(n)`; (b) áp giới hạn trước rồi hẹp như `text`, kèm cả hai diagnostic; (c) enum SQL Server `nvarchar(n)` tính theo code unit UTF-16, tối thiểu 1, quá 4000 thì `nvarchar(max)` kèm `type-parameter-out-of-range` | Mục 3 (bảng SQL), mục 4 (danh mục) |
| 7 | So tên không phân biệt dấu | `NameAllocator` nhận `comparison` (`exact`, `caseInsensitive`, `caseAndAccentInsensitive`); tên ràng buộc do generator đặt so không phân biệt dấu ở mọi dialect; `caseAndAccentInsensitive` luôn đổi thêm `đ` → `d`, `ø` → `o`, `ł` → `l`, `ħ` → `h` theo `utf8mb3_general_ci` của MySQL, chỉ cho định danh (sửa ở R12, thay điều kiện chờ probe) (thay bằng R20: probe cho thấy MySQL phân biệt dấu, nên mọi allocator SQL so `caseInsensitive` và mức `caseAndAccentInsensitive` bị bỏ) | Mục 5 |
| 8 | Giây lẻ quá 7 chữ số | Không đổi validation phần 2. Hàm literal SQL Server cắt giây lẻ về 7 chữ số, không diagnostic (lý do viết lại ở R20: SQL Server 2022 nhận 8 chữ số, cắt để căn theo độ chính xác `datetime2(7)`) | Mục 3 ("Giây lẻ trên SQL Server") |
| 9 | Điểm cần probe ngoài danh sách rủi ro | Probe mọi điểm, chạy local qua Docker; kết quả khác spec thì dừng generator của dialect đó cho tới khi orchestrator sửa spec | Mục 7, mục Rủi ro |
| 10 | Index trùng tên bảng trên PostgreSQL | Phần 2 thêm issue mới `index-name-conflicts-table` tại `['indexes', id, 'name']` khi tên index trùng tên một bảng bất kỳ (so bằng `toNameKey`) | Mục 2, mục 5 |
| 11 | Mã `SeedIssue` không có bản dịch | Không export danh mục mã ở entry point chính, không có namespace i18n trong phần 6; phần 5 quyết định | CG-08 |
| 12 | Bảng không có cột | Phần 2 thêm issue `table-columns-empty` tại `['tables', id, 'columnIds']`; generator vẫn sinh output an toàn | Mục 2 |

Thay đổi với spec phần 2 do vấn đề 10, 12 nằm ở mục [Vấn đề với các spec đã duyệt](#vấn-đề-với-các-spec-đã-duyệt). Vấn đề 8 không đổi phần 2.

**Sửa sau review ngày 2026-10-02** (project-reviewer trả needs-fix; các quyết định dưới đây là của orchestrator):

| # | Hạng mục | Quyết định | Ghi ở |
|---|---|---|---|
| R1 | Độ dài khóa trên SQL Server | SQL Server từ chối (Msg 1944) khóa có phần độ dài cố định vượt 900 byte (khóa chính) hoặc 1700 byte (unique, index), không chỉ cảnh báo. Khi vượt, mọi `nchar(n)` của khóa thành `nvarchar(n)` kèm `key-column-type-narrowed`; vẫn vượt thì bỏ kèm `key-column-type-not-indexable`. Probe `nchar(451)` khóa chính, `nchar(851)` unique; fixture có khóa chính `char(500)` (bổ sung ở R10) | Mục 4, mục 10, mục Rủi ro |
| R2 | Cột `char`, `varchar` vượt giới hạn trong khóa MySQL | Thành thẳng `VARCHAR(768)` kèm cả `type-parameter-out-of-range` và `key-column-type-narrowed`, không qua `LONGTEXT` rồi `VARCHAR(255)` (thay phần (b) của vấn đề 6 cho MySQL) (thu hẹp ở R11) | Mục 4 (danh mục, "Độ dài khóa trên MySQL", ma trận) |
| R3 | Cổng conformance | Áp cho task generator khi conformance test của đích đã có; trước đó, probe là cổng của generator SQL MySQL, SQL Server. Phần 6 chỉ xong khi mọi bộ conformance test qua | Mục 7 |
| R4 | Thay đổi với phần 2 | Chuyển vào mục "Vấn đề với các spec đã duyệt"; `suggestIndexName` phải tránh cả tên bảng (đã quyết, không còn là đề xuất) | Mục Vấn đề với các spec đã duyệt |
| R5 | Giây lẻ trên MySQL | Probe literal 9 chữ số giây lẻ trên `DATETIME(6)`, `TIME(6)`, `TIMESTAMP(6)` ở strict mode; nếu MySQL từ chối thì hàm literal MySQL cắt về 6 chữ số, không diagnostic (thay bằng R15) | Mục 3, mục Rủi ro |
| R6 | Bảng không cột với Prisma | Bỏ câu "Prisma từ chối model không trường": generator ghi `@@ignore` và `prisma validate` nhận | Mục 2 |
| R7 | Dòng trạng thái | Giữ nguyên văn quyết định CI cũ của người dùng, thêm ghi chú đã thay ngày 2026-10-02 | Đầu spec |
| R8 | Cột `AUTO_INCREMENT` mất khóa trên MySQL | Khi khóa chính hoặc unique bị bỏ là khóa duy nhất của cột `AUTO_INCREMENT`, thêm `INDEX` thường `<bảng>_<cột>_idx` trên cột đó để tránh lỗi 1075; có probe (tổng quát hóa ở R14; vị trí ghi trong SQL đổi ở R25) | Mục 4, mục 5, mục Rủi ro |
| R9 | Tên sequence identity trên PostgreSQL | Giới hạn đã chấp nhận: bảng hoặc index tên `<bảng>_<cột>_seq` trùng sequence ngầm; không thêm mã issue | Mục Rủi ro |
| R10 | Hẹp `nchar` trên SQL Server lan theo quan hệ | SQL Server bắt cột khóa ngoại và cột được tham chiếu cùng kiểu, cùng độ dài (Msg 1778, 1753): việc hẹp `nchar(n)` → `nvarchar(n)` lan bắc cầu tới mọi cột ghép cặp qua quan hệ, mỗi cột một `key-column-type-narrowed`, cho SQL Server SQL và Prisma `sqlserver`; cột không còn đệm khoảng trắng. Fixture thêm quan hệ tham chiếu khóa chính `char(500)`; probe khóa ngoại `nchar(500)` → khóa chính `nvarchar(500)` bị từ chối | Mục 4, mục 10, mục Rủi ro |
| R11 | Phạm vi của R2 | Chỉ cột vượt giới hạn có `n > 768` (`char(n)` với `n > 768`, `varchar(n)` với `n > 16 383`) thành thẳng `VARCHAR(768)`; `char(300)` thành `VARCHAR(300)` | Mục 4 |
| R12 | So định danh trên MySQL | MySQL so tên cột, index, ràng buộc theo `utf8mb3_general_ci`; `caseAndAccentInsensitive` luôn đổi thêm `đ` → `d`, `ø` → `o`, `ł` → `l`, `ħ` → `h`, không chờ probe; không áp cho giá trị `ENUM` hay dữ liệu; probe xác nhận trên định danh (thay bằng R20) | Mục 4 (`identifier-collision-renamed`), mục 5, mục Rủi ro, vấn đề 7 |
| R13 | Kích thước dòng trên MySQL | Dòng tối đa 65 535 byte (lỗi 1118): khi vượt, đổi cột `CHAR`, `VARCHAR` lớn nhất không thuộc khóa chính, unique, index hay cặp cột quan hệ thành `LONGTEXT` kèm `type-parameter-out-of-range`, lặp tới khi vừa. Có dòng ma trận, probe và fixture | Mục 4, mục 10, mục Rủi ro |
| R14 | Cột `AUTO_INCREMENT` trên MySQL | Tổng quát hóa R8: khi không còn index nào của bảng bắt đầu bằng cột `AUTO_INCREMENT` (khóa bị bỏ, hoặc khóa chính nhiều cột có nó đứng sau), thêm `INDEX` `<bảng>_<cột>_idx`; Prisma `mysql` `@@index([cột], map: "<bảng>_<cột>_idx")`, Drizzle `index(…)`; vị trí ghi trong SQL đổi ở R25 | Mục 4, mục 10, mục Rủi ro |
| R15 | Giây lẻ trên MySQL | Hàm literal MySQL luôn cắt về 6 chữ số, không diagnostic (thay R5), dùng cho mặc định CG-01, `dbgenerated` của Prisma `mysql`, mặc định Drizzle MySQL, seed SQL `mysql`; tương đương vì dưới độ chính xác 1 µs; probe chỉ còn là kiểm tra sanity | Mục 3, mục Rủi ro |
| R16 | Tên sequence identity trên PostgreSQL | Viết lại giới hạn R9: PostgreSQL chọn `…_seq1` khi tên đã có, nên chỉ lỗi khi đối tượng của người dùng cùng tên được tạo sau sequence, hoặc khi tên dài bị cắt đổi tên; vẫn là giới hạn đã chấp nhận | Mục Rủi ro |
| R17 | Tên enum trùng row type của bảng trên PostgreSQL | Phần 2 đã cấm: bảng và enum chung một không gian tên (phần 2 mục 7, `table-name-duplicate`, `enum-name-duplicate`), nên schema hợp lệ không có enum trùng tên bảng. Không thêm quy tắc đổi tên hay hợp đồng `path` mới cho `identifier-collision-renamed` | Không đổi spec |
| R18 | Bullet đầu mục Rủi ro | Cổng conformance áp khi conformance test của đích đã có; trước đó probe là cổng (MySQL, SQL Server) | Mục Rủi ro |
| R19 | Mặc định Prisma `mysql` trên TEXT, JSON, BLOB | Literal mặc định trên cột có kiểu đích MySQL là `LONGTEXT`, `JSON` hoặc `LONGBLOB` ghi `dbgenerated("(<literal>)")` thay vì `@default("…")`, vì MySQL chỉ nhận mặc định dạng biểu thức trong ngoặc trên các kiểu này và `prisma validate` không bắt lỗi (sửa sau review plan ngày 2026-10-02); Drizzle MySQL dùng cùng quy tắc ngoặc qua `sql.raw` | Mục 3 (Prisma), mục 4 (ma trận) |
| R20 | Kết quả probe trên database thật | Probe của Task 8 (MySQL 8.4.11, SQL Server 2022, ngày 2026-10-02) bác bốn giả định. (1) MySQL so tên cột, index, ràng buộc không phân biệt hoa thường nhưng phân biệt dấu (`ma`/`má` và các cặp `đ`/`d`, `ø`/`o`, `ł`/`l`, `ħ`/`h`, `ß`/`s`, `ð`/`d` được nhận; `ma`/`MA` lỗi 1060): allocator cột, index MySQL và allocator tên ràng buộc do generator đặt so `caseInsensitive`; bỏ mức `caseAndAccentInsensitive` và danh sách gộp của R12 (thay R12, vấn đề 7). (2) MySQL 8.4.11 nhận `ON DELETE/UPDATE SET DEFAULT`: vẫn hạ về `NO ACTION` kèm `referential-action-not-supported`, vì tài liệu MySQL ghi InnoDB không hỗ trợ; 8.4.11 chấp nhận nhưng không bảo đảm. (3) Literal `timestamptz` MySQL kết thúc bằng `Z` hoặc `-00:00` lỗi 1067, `+00:00` được nhận: hàm literal MySQL đổi `Z`, `-00:00` thành `+00:00`, không diagnostic. (4) SQL Server 2022 nhận 8 chữ số giây lẻ trong mặc định `time`, `datetime2`, kể cả khi dòng dùng mặc định: vẫn cắt về 7 chữ số (vấn đề 8) để căn theo độ chính xác `datetime2(7)`, không phải vì bị từ chối. Mọi probe khác khớp spec, mã lỗi đã xác nhận: MySQL 1071, 1075, 1101, 1118, 1628, 1629; SQL Server 156, 1776, 1778, 1785, 1944, 2627, 15097 | Mục 3, mục 4 (danh mục, ma trận), mục 5, mục 10, mục Rủi ro, vấn đề 7, 8 |
| R21 | Kết quả kiểm chứng sớm của Drizzle | Bước kiểm chứng sớm của Task 18 (`drizzle-orm` 0.45.3, ngày 2026-10-02): hai bảng tham chiếu nhau trong callback cấu hình gây TS7022, TS7024 ở PostgreSQL và MySQL; `getTableConfig` lúc chạy vẫn đúng. Mọi callback cấu hình bảng luôn chú thích kiểu trả về: `(table): PgTableExtraConfigValue[] => [ … ]` cho `postgresql`, `(table): MySqlTableExtraConfigValue[] => [ … ]` cho `mysql` (export từ `drizzle-orm/pg-core`, `drizzle-orm/mysql-core`); dòng import builder thêm `type PgTableExtraConfigValue` hoặc `type MySqlTableExtraConfigValue` khi có ít nhất một callback; hai tên này vào danh sách tên import giữ chỗ khi cấp tên biến. Lý do: output xác định, không cần phát hiện vòng, dòng import không phụ thuộc schema. Phương án bị loại: chỉ chú thích bảng nằm trong vòng khóa ngoại (output ngắn hơn, nhưng thêm logic phát hiện vòng và import phụ thuộc schema) | CG-03, mục Rủi ro |
| R22 | Ghi chú nhiều dòng của DBML | Giới hạn đã chấp nhận (review range `1c42f9c..4ec7478`): `@dbml/core` 10.2.0 parse lại ghi chú nhiều dòng thì mất phần thụt lề chung của mọi dòng và một dòng trống ở đầu, kể cả khi xuống dòng ghi bằng escape `\n`. Importer DBML ở phần 7 không được kỳ vọng ghi chú round-trip chính xác. Lý do: hành vi của parser, quoting không sửa được | CG-09 |
| R23 | Độ dài chuỗi trong Zod | Giới hạn đã chấp nhận (cùng review): `z.string().max(n)` đếm code unit UTF-16, còn database, `maxLength` của OpenAPI và `isValidLengthLiteral` của phần 2 đếm code point, nên giá trị có ký tự ngoài BMP (emoji) gần giới hạn có thể qua validation và OpenAPI nhưng bị Zod từ chối. Giữ `z.string().max(n)` như CG-05. Lý do: code sinh ra vẫn đúng cách viết thường gặp; Zod chỉ chặt hơn database, không bao giờ lỏng hơn | CG-05 |
| R24 | Cột tự tăng đặt một phần trong seed | Thêm mã `SeedIssue` thứ 6 `seed-identity-partial` (sau `seed-order-invalid`, CG-08): khi một số dòng của mục bảng `i` đặt cột `isAutoIncrement` (`null` tính là đã đặt) và dòng khác bỏ khóa, mỗi dòng `j` bỏ khóa có một issue với `path` `['tables', i, 'rows', j, columnId]`; dòng có đặt cột không bị báo; bảng đặt hết hoặc bỏ hết không có issue; sắp theo `path` rồi `code`; `buildSeedDataset` không sinh mã này. Lý do: câu `INSERT` liệt kê cột khi bất kỳ dòng nào đặt nó, nên dòng bỏ khóa nhận `DEFAULT`; SQL Server từ chối `DEFAULT` dưới `SET IDENTITY_INSERT … ON` (Msg 339), còn sequence của PostgreSQL cấp 1, 2… trước `setval` nên đụng khóa tường minh. Chọn validation (đặt hết hoặc không đặt dòng nào trong một bảng) thay vì tách `INSERT`, vì tách không sửa được va chạm trên PostgreSQL. Seed issue chưa có i18n (Vấn đề 11): AI-06 (phần 5) phải dịch mã này khi hiển thị seed issue. `parseSeedDataset` không còn ném lỗi với mảng rất rộng (từ 150k phần tử), nên hợp đồng không ném lỗi được giữ; không thêm giới hạn kích thước mới. Triển khai ở commit `0b7132f`, log `document/executions/logs/2026-10-02-seed-review-fixes.md` | CG-08 |
| R25 | Vị trí `INDEX` thay thế cho cột `AUTO_INCREMENT` trong SQL MySQL | Conformance test của Task 29 trên MySQL 8.4: DDL của fixture `target-limit` lỗi 1075 (`Incorrect table definition; there can be only one auto column and it must be defined as a key`), vì `INDEX` thay thế của R8, R14 (`auto_trailing` với khóa `(a, id)`; `auto_wide_key` có khóa chính bị bỏ vì quá dài) được ghi bằng `CREATE INDEX` riêng sau mọi bảng, trong khi MySQL kiểm tra điều kiện này lúc `CREATE TABLE`. Quyết định: trong output MySQL, index thay thế giữ tên `<bảng>_<cột>_idx` và được ghi bằng ``KEY `<tên>` (`<cột>`)`` bên trong `CREATE TABLE` của bảng, sau dòng khóa chính và các dòng `UNIQUE`; mọi index khác vẫn là `CREATE INDEX` riêng. Dialect khác không đổi. Prisma và Drizzle MySQL không đổi (công cụ migration của chúng tạo bảng). Lý do: `KEY` trong `CREATE TABLE` là cách duy nhất để cột `AUTO_INCREMENT` có khóa ngay lúc tạo bảng. Mở rộng (2026-10-03, errno 1075 cùng nguyên nhân): index **của người dùng** có cột đầu là cột `AUTO_INCREMENT` (làm `INDEX` thay thế thừa theo R14) cũng được khai báo trong `CREATE TABLE`, dưới dạng `KEY`, hoặc `UNIQUE KEY` nếu index unique; cụ thể là index đầu tiên theo thứ tự `model.indexes` cho mỗi cột `AUTO_INCREMENT` mà khóa chính và ràng buộc unique đều không bắt đầu bằng nó; index khác vẫn là `CREATE INDEX` riêng. Triển khai: task sửa, log `document/executions/logs/2026-10-03-mysql-auto-increment-key.md`; phần mở rộng ở commit `2a8d1b6` | CG-01, mục 4 |
| R26 | Siết tên kiểu custom (ngữ pháp và từ khóa cấm) | Review bảo mật của các generator (quyết định của orchestrator ngày 2026-10-03): generator SQL in kiểu custom nguyên văn vào `CREATE TABLE`, nên quy tắc cũ của phần 2 (tập ký tự an toàn) cho phép chèn mệnh đề như `text, extra int`, `int CHECK (x)`, `int REFERENCES t(id)`. Phần 2 đổi sang kiểm tra theo thứ tự ≤63 byte UTF-8, ngữ pháp, rồi từ khóa cấm; `timestamp(3) with time zone` bị từ chối. Spec này không đổi hành vi: `custom-type-unsafe` (mục 4) vẫn là diagnostic khi schema có issue `column-custom-type-invalid`. Chi tiết ở mục "Kiểu custom" của [spec core schema model](2026-09-14-core-schema-model-design.md) (mục 3); log `document/executions/logs/2026-10-03-custom-type-name-hardening.md` | CG-01, mục 4 |
| R27 | Seed JSON bỏ cột custom có default, Zod vẫn bắt buộc | Conformance test của Task 30: fixture `target-limit`, bảng `custom_values`, cột `address` (kiểu custom `inet`, `NOT NULL`, default `127.0.0.1`) bị CG-08 bỏ khỏi seed JSON (cột custom có default thì `omit`), còn Zod ghi `address: z.unknown()` và Zod 4.6 coi key này là bắt buộc. Quyết định (orchestrator): không đổi core; schema Zod sinh ra mô tả hàng đã lưu (database điền default), còn seed JSON là dữ liệu insert. Kiểm tra CG-05 parse từng dòng seed bằng schema ứng viên đã `.partial()` đúng cho các cột CG-08 bỏ (kiểu custom, `NOT NULL`, có default); mọi key khác vẫn bắt buộc. Loại: (a) `.optional()` trong Zod cho lớp cột này (ngữ nghĩa Zod không nhất quán); (b) đặt giá trị seed cho kiểu custom mờ (không làm được trong trường hợp chung). Triển khai ở commit `ee7027e` (`packages/codegen-conformance/src/zod.test.ts`), log `document/executions/logs/2026-10-03-code-generators-task-30.md` | CG-05, mục 7 |
