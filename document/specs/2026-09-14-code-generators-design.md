# Code generators

Spec cho phần 6 trong [roadmap.md](../roadmap.md): các generator CG-01 đến CG-10 trong `packages/core` và panel xem, copy code ở frontend. Phần 6 chỉ phụ thuộc phần 1 và phần 2, nên được viết song song với editor (phần 3).

Tính năng và tiêu chí nháp lấy từ [2026-09-14-feature-list-design.md](2026-09-14-feature-list-design.md). Model, bộ kiểu chung, giá trị mặc định, quan hệ, luật đặt tên, hàm sắp xếp xác định và hai tầng validation lấy từ [spec phần 2](2026-09-14-core-schema-model-design.md). Cách build, entry point, Vitest và ESLint lấy từ [spec phần 1](2026-09-14-scaffold-tooling-design.md).

Trạng thái: đã duyệt. Người dùng xác nhận các quyết định cần xác nhận: biểu diễn JSON chung (mục 3), nguyên tắc diagnostic cho câu hỏi 7 (mục 4), Drizzle 0.45 chỉ PostgreSQL và MySQL với relations v1 (CG-03), Mock API là một file handler MSW 2 (CG-06), OpenAPI 3.1 dạng JSON có đường dẫn CRUD (CG-07), seed data dùng PRNG trong core, không faker, `SeedDataset` dùng chung với AI-06 (CG-08), và conformance test chỉ chạy trong CI (mục 7).

Các đoạn TypeScript là phác thảo để hình dạng dữ liệu rõ ràng. Plan và code sẽ tinh chỉnh tên và chi tiết, nhưng không đổi quyết định.

Phiên bản trong spec được kiểm tra ngày 2026-09-14 bằng `npm view` (phiên bản, dist-tag, dependency, kích thước), tài liệu qua Context7, và thử nghiệm trong thư mục tạm: `prisma validate` 7.10.0 trên các schema mẫu, typecheck output mẫu của Drizzle 0.45.2, Zod 4.6.5 và TypeScript 6.0.3 ở chế độ strict, parse DBML bằng `@dbml/core` 10.1.1, validate tài liệu OpenAPI 3.1 bằng hai validator, chạy handler MSW 2.15.0 trên Node, highlight bằng Shiki 4.4.3 với regex engine JavaScript và đo kích thước bundle bằng esbuild. Hành vi của database thật chưa được thử (conformance test là cổng chặn ở CI; máy dev có Docker nên chạy local cũng được, nhưng chưa thử trong lúc viết spec); các điểm cần xác nhận được ghi ở mục [Rủi ro](#rủi-ro-cần-kiểm-tra-khi-triển-khai).

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
| 17 | Kiểm chứng output | Package riêng `packages/codegen-conformance` chạy công cụ đích thật (Testcontainers, `prisma validate`, `tsc`, validator OpenAPI, `@dbml/core`), chỉ chạy trong job CI riêng và là cổng chặn; core giữ unit test và snapshot, chạy cả local |
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
| `enum` | `CREATE TYPE … AS ENUM` | `ENUM(…)` trên cột | `nvarchar(n)` với `n` là độ dài giá trị dài nhất, kèm `CHECK (… IN (…))` |
| `custom` | ghi nguyên văn | ghi nguyên văn | ghi nguyên văn |
| Auto-increment | `GENERATED BY DEFAULT AS IDENTITY` | `AUTO_INCREMENT` | `IDENTITY(1, 1)` |
| `currentTimestamp` | `now()` | `CURRENT_TIMESTAMP(6)` | `sysdatetime()` cho `datetime2`, `sysdatetimeoffset()` cho `datetimeoffset` |
| `generateUuid` | `gen_random_uuid()` | `(UUID())` | `newid()` |

Chỉnh so với bảng tham khảo của phần 2, không đổi model:

- MySQL dùng độ chính xác phân số giây 6 (`TIME(6)`, `DATETIME(6)`, `TIMESTAMP(6)`), bằng PostgreSQL. Literal mặc định của phần 2 cho phép phần giây lẻ; `DATETIME` không có độ chính xác sẽ cắt mất. MySQL yêu cầu `CURRENT_TIMESTAMP(6)` khớp độ chính xác của cột.
- SQL Server dùng `sysdatetime()` cho cột `datetime2`: `sysdatetimeoffset()` đổi ngầm sang `datetime2` sẽ bỏ độ lệch múi giờ.
- PostgreSQL dùng identity `BY DEFAULT` (không phải `ALWAYS`) để seed data (CG-08) chèn được giá trị khóa tường minh.

Literal mặc định được ghi theo kiểu cột: chuỗi trong nháy đơn đã escape (mục 5); số nguyên, số thập phân không quote sau khi qua hàm kiểm tra literal; boolean là `true`/`false` (PostgreSQL), `TRUE`/`FALSE` (MySQL), `1`/`0` (SQL Server); ngày giờ, `uuid`, `json`, enum là chuỗi. MySQL bọc literal của cột `LONGTEXT`, `JSON`, `LONGBLOB` trong ngoặc (`DEFAULT ('…')`) vì các kiểu này chỉ nhận giá trị mặc định dạng biểu thức.

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
- Giá trị mặc định: `autoincrement()`, `now()`, `uuid()` theo phần 2; literal dùng dạng Prisma nhận được cho kiểu (số, chuỗi, boolean, giá trị enum); literal Prisma không biểu diễn được (ví dụ `time`, `date`) dùng `dbgenerated("…")` với literal SQL của CG-01 cùng dialect, đặt trong chuỗi Prisma đã escape.
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

| Mã | Đích | Điều kiện | Output |
|---|---|---|---|
| `enum-not-supported` | Prisma `sqlserver` | Cột kiểu enum | `String @db.NVarChar(n)`, mất ràng buộc giá trị |
| `type-not-supported` | Prisma `sqlserver` | Cột kiểu `json` | `String @db.NVarChar(Max)` |
| `type-parameter-out-of-range` | SQL, Prisma, Drizzle | Tham số kiểu vượt giới hạn dialect: PostgreSQL `varchar(n)` > 10 485 760, `numeric` precision > 1000; MySQL `CHAR(n)` > 255, `VARCHAR(n)` > 16 383, `DECIMAL` precision > 65 hoặc scale > 30; SQL Server `nchar`, `nvarchar` > 4000, `decimal` precision > 38 | `CHAR` → `VARCHAR(n)`; `VARCHAR`, `nvarchar`, `nchar` quá dài → kiểu văn bản không giới hạn của dialect; precision, scale kẹp về giới hạn |
| `key-column-type-narrowed` | MySQL, SQL Server (SQL, Prisma, Drizzle) | Cột `text` thuộc khóa chính, unique, index hoặc cặp cột quan hệ | MySQL `VARCHAR(255)`, SQL Server `nvarchar(450)` |
| `key-column-type-not-indexable` | MySQL, SQL Server (SQL, Prisma, Drizzle) | Cột `json` hoặc `binary` thuộc khóa chính, unique hoặc index | Bỏ ràng buộc, index đó và khóa ngoại tham chiếu tới nó |
| `referential-action-not-supported` | MySQL (SQL, Prisma, Drizzle) | `setDefault` (InnoDB từ chối) | `NO ACTION` |
| `referential-action-cycle` | SQL Server (SQL, Prisma) | Hành động khác `noAction` làm xuất hiện vòng, hoặc đường cascade thứ hai giữa hai bảng | Cả ON DELETE và ON UPDATE của quan hệ đó thành `NO ACTION` |
| `unique-nulls-restricted` | SQL Server: SQL khi ràng buộc unique có cột nullable được khóa ngoại tham chiếu; Prisma mọi unique có cột nullable | Unique trên cột nullable | `UNIQUE` của SQL Server chỉ cho một dòng `NULL` |
| `table-without-identifier` | Prisma, OpenAPI, Mock API | Prisma: không có khóa chính hay unique nào chỉ gồm cột bắt buộc, không phải `Unsupported`. OpenAPI, Mock API: bảng không có khóa chính | Prisma: `@@ignore` trên model và `@ignore` trên trường quan hệ trỏ tới model. OpenAPI, Mock API: chỉ có đường dẫn danh sách và tạo mới |
| `custom-type-unmapped` | TypeScript, Zod, OpenAPI, Mock API | Cột kiểu `custom` | `unknown`, `z.unknown()`, `{}` |
| `custom-type-unsafe` | SQL | Tên kiểu custom sai cú pháp an toàn (schema có issue) | Kiểu văn bản không giới hạn của dialect |
| `default-omitted` | Mọi đích ghi giá trị mặc định | Literal không hợp lệ với kiểu cột (schema có issue) | Bỏ giá trị mặc định |
| `identifier-collision-renamed` | MySQL (SQL, Prisma, Drizzle) | Hai tên cột trong một bảng, hoặc hai tên index trong một bảng, chỉ khác nhau ở dấu (MySQL so định danh cột, index không phân biệt dấu) | Tên đứng sau theo thứ tự xác định được thêm hậu tố `_2`, `_3`… |
| `null-character-removed` | PostgreSQL | Comment hoặc literal chứa U+0000 (PostgreSQL không lưu được) | Bỏ ký tự đó |
| `seed-table-skipped` | Seed | Cột bắt buộc không sinh được giá trị (kiểu custom không có mặc định), vòng khóa ngoại chỉ gồm cột bắt buộc, hoặc bảng được tham chiếu bị bỏ | Bảng không có dòng nào |
| `seed-rows-reduced` | Seed | Ràng buộc unique không đủ giá trị khác nhau (cột `boolean` unique, enum ít giá trị, quan hệ 1-1 với bảng cha ít dòng hơn) | Ít dòng hơn `rowsPerTable` |

`path` trỏ tới phần tử gây ra diagnostic: cột (`['columns', id, 'type']`), hành động (`['relations', id, 'onDelete']`), bảng, index hoặc giá trị mặc định.

**Phát hiện vòng cascade trên SQL Server:** duyệt quan hệ theo thứ tự xác định của phần 2, giữ đồ thị các cạnh `toTableId → fromTableId` của những quan hệ có hành động khác `noAction`. Quan hệ nào khi thêm vào làm xuất hiện vòng (kể cả tự tham chiếu) hoặc đường thứ hai giữa hai bảng thì bị hạ về `NO ACTION` cho cả hai sự kiện. Hạ cả hai vì Prisma yêu cầu như vậy, và một quy tắc cho cả SQL lẫn Prisma giúp hai output khớp nhau.

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
| Unique trên cột nullable | `UNIQUE` | `UNIQUE` | Unique index lọc `WHERE … IS NOT NULL`, tương đương; nếu được khóa ngoại tham chiếu thì `UNIQUE`, `unique-nulls-restricted` | `@unique`; `sqlserver`: `unique-nulls-restricted` | `unique` |
| `text` trong khóa, index | `text` | `VARCHAR(255)`, `key-column-type-narrowed` | `nvarchar(450)`, `key-column-type-narrowed` | Theo dialect | Theo dialect |
| `json`, `binary` trong khóa, index | Giữ nguyên | Bỏ ràng buộc, `key-column-type-not-indexable` | như MySQL | Theo dialect | Theo dialect |
| `timestamptz` | `timestamptz` | `TIMESTAMP(6)` | `datetimeoffset` | Mục 3 | Mục 3 |
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

type NameAllocator = { readonly allocate: (preferred: string) => string };
function createNameAllocator(options: {
  readonly reserved: readonly string[];
  readonly isCaseInsensitive: boolean;
}): NameAllocator;

function buildConstraintName(
  tableName: string,
  columnNames: readonly string[],
  suffix: 'pkey' | 'key' | 'fkey' | 'check',
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

- **Key thuộc tính** trong TypeScript, Zod, OpenAPI, Mock API và seed JSON là **tên cột gốc**, vì chúng mô tả đúng dữ liệu JSON có key là tên cột. Key khớp `^[A-Za-z_$][A-Za-z0-9_$]*$` thì ghi trần, còn lại ghi bằng `JSON.stringify`.
- **Chuỗi trong code** (tên bảng của Drizzle, giá trị enum, đường dẫn) ghi bằng `JSON.stringify`. Comment JSDoc thay `*/` bằng `*\/`.
- **Prisma:** `@@map`, `@map` chỉ ghi khi tên ánh xạ khác tên gốc. Giá trị enum không phải định danh hợp lệ được ánh xạ như trường và kèm `@map("giá trị gốc")`. Chuỗi Prisma escape `\` và `"`.
- **DBML:** định danh luôn trong `"…"`, chuỗi trong `'…'`, cả hai escape bằng `\`; ghi chú nhiều dòng dùng `'''…'''`. Đã thử với `@dbml/core` 10.1.1: nháy kép và nháy đơn phải escape bằng `\`, nhân đôi dấu nháy là lỗi cú pháp.
- **Markdown:** thêm `\` trước ký tự đặc biệt của Markdown; trong ô bảng escape `|` và đổi xuống dòng thành `<br>`.

| Đích | Không gian tên cấp tên | So sánh |
|---|---|---|
| SQL | Một tập cho cả output: tên bảng, tên enum, tên index của người dùng, tên ràng buộc do generator đặt | Không phân biệt hoa thường |
| Prisma | Model và enum chung một tập; trường (cột và quan hệ) trong một model; giá trị enum trong một enum | Phân biệt hoa thường |
| Drizzle | Biến export (bảng, enum, `customType`, relations); key cột và tên quan hệ trong một bảng | Phân biệt hoa thường |
| TypeScript, Zod | Type (hoặc biến schema) của bảng, enum và `JsonValue` | Phân biệt hoa thường |
| OpenAPI, Mock API | Component; `operationId`; đoạn đường dẫn tài nguyên; tham số trong một đường dẫn | Không phân biệt hoa thường cho đường dẫn, phân biệt cho phần còn lại |

### Tên ràng buộc do generator đặt

- **Quy ước PostgreSQL:** `<bảng>_pkey`, `<bảng>_<cột>_<cột>_key`, `<bảng>_<cột>_<cột>_fkey`, `<bảng>_<cột>_check`, dùng tên gốc (đã quote khi ghi). Prisma dùng cùng quy ước cho tên mặc định, nên database tạo từ CG-01 và từ Prisma có cùng tên ràng buộc.
- **Tối đa 63 byte UTF-8**, giới hạn chặt nhất trong ba dialect (PostgreSQL 63 byte, MySQL 64 ký tự, SQL Server 128 ký tự). Tên dài hơn được cắt ở ranh giới code point còn 54 byte, nối `_` và 8 chữ số hex của hash FNV-1a 32 bit trên tên đầy đủ.
- **Tránh trùng:** tên đặt ra đi qua `NameAllocator` của output SQL, gồm cả tên bảng (PostgreSQL dùng chung không gian tên cho bảng và index) và tên index của người dùng. Trùng thì thêm `_2`, `_3`…, cắt lại để vẫn tối đa 63 byte. Tên index của người dùng không bao giờ bị đổi: phần 2 đã bảo đảm chúng không trùng trong schema.
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
2. `CREATE TABLE` theo thứ tự bảng. Cột theo `columnIds`: kiểu, auto-increment, `NOT NULL`, `DEFAULT`, và `COMMENT` với MySQL. Sau cột: `CONSTRAINT … PRIMARY KEY (…)`, `CONSTRAINT … UNIQUE (…)` cho từng cột `isUnique` theo thứ tự cột, và `CONSTRAINT … CHECK` cho cột enum trên SQL Server. MySQL kết thúc bảng bằng `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci` và `COMMENT='…'`.
3. `CREATE [UNIQUE] INDEX` theo thứ tự index. SQL Server thêm unique index lọc `WHERE … IS NOT NULL` cho unique trên cột nullable (mục 4).
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
- **Cấu trúc file:** import các builder được dùng (sắp theo tên); `pgEnum` (PostgreSQL); các `customType`; bảng theo thứ tự bảng dạng `export const users = pgTable("users", { … }, (table) => [ … ])`; cuối cùng các `relations()` theo thứ tự bảng.
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

- `SeedIssue` là `{ code, path }` với `path` dạng `['tables', i, 'rows', j, columnId]`. Mã: `seed-value-invalid` (sai biểu diễn JSON của kiểu hoặc không thuộc enum), `seed-value-null` (null ở cột bắt buộc), `seed-unique-violation`, `seed-foreign-key-missing`, `seed-order-invalid` (dòng tham chiếu tới bảng nạp sau, ngoài trường hợp vòng).
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
| Unit và snapshot | `packages/core`, trong `pnpm test` | Mọi lần `pnpm test`, local và CI | Mục 10 |
| Conformance | Package mới `packages/codegen-conformance` (`@schemaforge/codegen-conformance`, `private`), script `test:conformance` | Job CI riêng cho mọi push và pull request, là cổng chặn. Chạy local là tùy chọn, dùng Docker sẵn có trên máy dev | Chạy output qua công cụ đích thật |

- Package conformance chỉ có test, không có mã nguồn, nên không có ngưỡng coverage và không có script `test`: `pnpm test` ở root không cần Docker. Task Turborepo `test:conformance` phụ thuộc `^build` và được cache như các task khác, nên commit không sửa core không chạy lại. Root thêm script `pnpm test:conformance` cho ai có Docker; script này không thuộc các lệnh phải chạy trước khi commit (`git.md`), và lỗi conformance được phát hiện ở CI.
- Package dùng core qua `@schemaforge/core` (bản build) và fixture qua `@schemaforge/core/testing` (plan phần 2 đã xuất bản entry point này).
- Fixture là các schema hợp lệ (`validateSchema` rỗng): `createSampleSchema()` của phần 2, cùng các fixture phần 6 thêm vào `src/testing/` (mục 10).
- CI thêm một job `conformance` trên `ubuntu-latest` (có sẵn Docker), song song với job hiện có, chạy `pnpm turbo run test:conformance`. Job phải xanh trước khi merge, như job hiện có.

| Tiêu chí | Kiểm chứng |
|---|---|
| CG-01 chạy trên database thật | Testcontainers khởi động `postgres:18-alpine`, `mysql:8.4`, `mcr.microsoft.com/mssql/server:2022-latest` một lần mỗi file test; mỗi fixture chạy trong một database mới tạo. Chạy DDL bằng `pg`, `mysql2` (`multipleStatements`), `mssql`: không lỗi, và số bảng trong `information_schema` bằng số bảng của schema |
| CG-02 `prisma validate` | Ghi output của từng fixture × provider ra thư mục tạm, chạy `prisma validate` 7.10.0: exit code 0 và không có dòng cảnh báo |
| CG-03, CG-04, CG-05 typecheck strict | Ghi output ra thư mục tạm, chạy TypeScript compiler API với các option strict của `tsconfig.base.json` và `drizzle-orm` 0.45.2, `zod` 4.6.5 đã cài: không có diagnostic |
| CG-05 đúng ngữ nghĩa | Import schema Zod vừa sinh, parse từng dòng seed JSON (CG-08) của cùng fixture: mọi dòng hợp lệ |
| CG-06 | Typecheck cùng `msw` 2.15.0; chạy `setupServer` của `msw/node` và gọi đủ các route của một bảng khóa đơn và một bảng khóa nhiều cột |
| CG-07 validator OpenAPI | `validate()` của `@readme/openapi-parser` 9.0.0: `valid` là `true` |
| CG-08 | Chạy seed SQL của từng dialect ngay sau DDL trong cùng database: không lỗi, số dòng mỗi bảng đúng như `SeedDataset` |
| CG-09 | `Parser.parse(output, 'dbmlv2')` của `@dbml/core` 10.1.1 không lỗi; bảng, cột, kiểu, quan hệ, hành động, enum, index, nhóm, ghi chú khớp schema. Round-trip bằng IE-03 thêm ở phần 7 |

**Chọn validator OpenAPI:** `@readme/openapi-parser` kiểm tra theo JSON Schema của OpenAPI 3.1 và thêm kiểm tra ngữ nghĩa. Thử với một tài liệu thiếu tham số đường dẫn và trùng `operationId`: `@readme/openapi-parser` báo cả hai lỗi, còn `@seriousme/openapi-schema-validator` 2.9.1 cho là hợp lệ vì chỉ kiểm tra JSON Schema.

**Chọn Testcontainers:** cùng một đoạn code chạy local và CI; test tự quản lý vòng đời container và cổng. **Phương án bị loại:** `services` của GitHub Actions: cấu hình database nằm trong YAML của CI, local phải có thêm file compose riêng, và test không tự tạo được database cho từng fixture một cách nhất quán giữa hai nơi.

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

- **Fixture mới** trong `src/testing/`, xuất bản qua `@schemaforge/core/testing`: `createNamingEdgeSchema()` (tên có dấu, khoảng trắng, từ khóa, bắt đầu bằng chữ số, chứa `"`, `` ` ``, `]`, `'`, `\`, `*/`, tên dài 63 byte, tên trùng sau khi ánh xạ); `createTargetLimitSchema()` (vòng cascade và nhiều đường cascade, `text`/`json`/`binary` trong khóa, tham số kiểu vượt giới hạn, unique nullable được tham chiếu, bảng không có khóa chính, kiểu custom, `setDefault`); `createLargeSchema()` (mục 9). Mọi fixture hợp lệ theo `validateSchema`.
- **Snapshot theo đích:** mỗi đích × fixture × option chính một snapshot bằng `toMatchFileSnapshot`, lưu ở `__snapshots__/<đích>/<fixture>.<phần mở rộng>` để đọc được bằng highlight của editor. Snapshot kèm danh sách diagnostic.
- **Định danh:** bảng test cho `quoteSqlIdentifier`, `sqlStringLiteral`, `toPascalCaseIdentifier`, `toCamelCaseIdentifier`, `createNameAllocator`, `buildConstraintName` (ví dụ ở mục 5, tên 63 và 64 byte, cắt ở ranh giới code point của chữ có dấu, hash xác định).
- **Diagnostic:** mỗi mã trong `GENERATOR_DIAGNOSTIC_CODES` có một test gây ra nó ở từng đích liên quan, kiểm tra đúng `code` và `path`, và một test ở trường hợp tương đương không có diagnostic (ví dụ `restrict` trên SQL Server, enum trên MySQL).
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
- [ ] Conformance test ở mục 7 qua trong CI với mọi fixture.
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
- Package `packages/codegen-conformance`, task Turborepo `test:conformance`, job CI `conformance`.
- Code panel, worker, namespace i18n `codeGenerator` và `generatorDiagnostics`, `worker-src 'self'` trong CSP.

**Ngoài phạm vi:**

| Hạng mục | Làm ở |
|---|---|
| Importer SQL, Prisma, DBML, JSON; test round-trip DBML bằng IE-03 | Phần 7 |
| Tải output thành file (IE-05), file ZIP (IE-08) | Phần 7 |
| Dữ liệu mẫu do AI sinh (AI-06); phần 6 chỉ cung cấp `SeedDataset` và các hàm dùng chung | Phần 5 |
| Drizzle cho SQL Server, relations v2 | Khi Drizzle 1.0 phát hành chính thức |
| Câu lệnh `DROP`, migration giữa hai phiên bản schema; OpenAPI dạng YAML; dữ liệu giống thật; kiểm tra body, phân trang trong Mock API; highlight DBML; SQLite | Chưa có tính năng nào cần |

## Rủi ro cần kiểm tra khi triển khai

- **Conformance test chỉ chạy trong CI.** Lỗi của output với công cụ đích chỉ lộ ra sau khi push. Plan đặt conformance test cho các điểm MySQL dưới đây ở những commit đầu tiên của generator MySQL, để CI xác nhận trước khi viết phần còn lại.
- **Hành vi MySQL chưa được thử trên database thật:** tên cột, tên index chỉ khác dấu bị coi là trùng; `utf8mb4_0900_as_ci` chấp nhận `ENUM` có giá trị chỉ khác dấu; InnoDB từ chối `SET DEFAULT`; `DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)`; giá trị mặc định dạng biểu thức cho `LONGTEXT`, `JSON`; nhiều cột `VARCHAR(255)` trong một index không vượt giới hạn 3072 byte. Plan viết conformance test cho từng điểm trước khi viết generator MySQL; kết quả khác thì sửa ma trận ở mục 4 trong cùng thay đổi.
- **SQL Server:** thuật toán phát hiện nhiều đường cascade phải khớp kiểm tra của SQL Server và của Prisma; unique index lọc được tạo trước khóa ngoại.
- **Drizzle:** callback cấu hình bảng tham chiếu tới bảng khai báo sau (khi quan hệ tạo vòng). Plan xác nhận typecheck và `getTableConfig` chạy đúng với trường hợp này.
- **Prisma:** từng native type trong bảng ở mục 3 được xác nhận bằng `prisma validate`. Nếu Prisma 8 phát hành chính thức trước khi triển khai, kiểm tra lại đầu file và kết quả validate.
- **Next.js 16:** worker khai báo bằng `new Worker(new URL("./code-generator.worker.ts", import.meta.url), { type: "module" })` build đúng với Turbopack và chạy dưới CSP có `worker-src 'self'`.
- **Shiki:** regex engine JavaScript chạy đúng với năm grammar trên mẫu nhỏ; plan đo thời gian tách token với output của `createLargeSchema()`.

## Câu hỏi đã trả lời

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Drizzle chưa có SQL Server cho tới khi 1.0 phát hành chính thức. Chấp nhận, hay nhắm 1.0 RC ngay? | Chấp nhận: Drizzle 0.45, chỉ PostgreSQL và MySQL, relations v1. SQL Server và relations v2 làm khi Drizzle 1.0 phát hành chính thức |
| 2 | Mock API và OpenAPI chỉ có CRUD tối thiểu. Có đủ cho CG-06, CG-07 không? | Đủ: Mock API là một file handler MSW 2; OpenAPI 3.1 dạng JSON có đường dẫn CRUD trùng Mock API |
| 3 | Seed data có giá trị theo kiểu, không giống dữ liệu thật. Có đồng ý không? | Đồng ý: PRNG có seed trong core, không faker; dữ liệu giống thật thuộc AI-06 |
| 4 | Cài Docker cho máy dev, hay chỉ chạy conformance trong CI? | Conformance test là cổng chặn ở CI; máy dev có Docker nên chạy conformance local cũng được (tùy chọn). Unit test và snapshot test vẫn chạy local |
