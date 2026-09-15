# Core schema model

Spec cho phần 2 trong [roadmap.md](../roadmap.md): schema model, validation và operations của `packages/core`. Mọi phần sau đều dựa trên model và operation này: editor (phần 3), lưu cloud (phần 4), AI (phần 5), code generator (phần 6), import/export (phần 7) và lịch sử phiên bản (phần 8). Chốt đúng ngay bây giờ để không phải migrate định dạng dữ liệu về sau.

Tính năng và tiêu chí nháp lấy từ [2026-09-14-feature-list-design.md](2026-09-14-feature-list-design.md). Phần 2 không có giao diện; model phải biểu diễn đủ khái niệm của ED-01 đến ED-08 và định dạng JSON của IE-04, IE-06.

Các đoạn TypeScript dưới đây là phác thảo để hình dạng dữ liệu rõ ràng. Plan và code sẽ tinh chỉnh tên và chi tiết, nhưng không đổi quyết định.

## Quyết định đã có từ trước

Spec này không bàn lại các điểm sau (nguồn: `architecture.md`, `.claude/rules/core.md`, và câu trả lời cho câu hỏi 4, 5, 6, 11 trong danh sách tính năng):

- Tài liệu schema là JSON phẳng theo id, có trường `version`. Bảng, cột, quan hệ, index, enum là các map theo id ở cấp gốc.
- Model là dữ liệu JSON thuần, bất biến: không class, `Date`, `Map`, `Set` hay hàm.
- Mọi thay đổi là một operation có trường `type`. Áp operation là hàm thuần, thành công trọn vẹn hoặc trả lỗi có kiểu, không throw với lỗi dự kiến, không để lại kết quả dở dang.
- Issue có `code` ổn định và đường dẫn tới phần tử lỗi; core không có thông báo cho người dùng.
- Id, thời gian và ngẫu nhiên được truyền vào. Undo/redo dựa trên operation.
- Một bộ kiểu dữ liệu chung, có kiểu custom. Hỗ trợ khóa chính và khóa ngoại nhiều cột, hành động ON DELETE và ON UPDATE. Quan hệ n-n là bảng trung gian thật; model chỉ có 1-1 và 1-n.

## Tóm tắt quyết định

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Cấu trúc tài liệu | Gốc gồm `version`, `name` và 7 map theo id. Thứ tự cột, giá trị enum, cột của index và khóa chính lưu bằng mảng; các map ở gốc không có thứ tự, output sắp theo tên |
| 2 | Bố cục canvas | Vị trí nằm trong tài liệu, trên chính bảng và ghi chú. Di chuyển là operation, undo được. Khung subject area tính từ các bảng thành viên, không lưu |
| 3 | Kiểu dữ liệu | 19 kiểu chung, tham số chỉ ở nơi cần; kiểu `custom` với tên theo cú pháp an toàn. Giá trị mặc định là literal dạng chuỗi hoặc một trong hai biểu thức có sẵn |
| 4 | Cột, khóa chính | Cột có `isNullable`, `defaultValue`, `isUnique`, `isAutoIncrement`, `comment`. Khóa chính là mảng id cột có thứ tự trên bảng |
| 5 | Quan hệ | `kind` là `oneToOne` hoặc `oneToMany`; danh sách cặp cột có thứ tự; `onDelete`, `onUpdate`. Cột được tham chiếu phải là khóa chính hoặc unique. Bảng trung gian không có đánh dấu riêng |
| 6 | Index, enum, subject area, ghi chú | Index có tên, mảng cột, `isUnique`. Enum là mảng chuỗi. Bảng thuộc tối đa một subject area qua `table.subjectAreaId`. Ghi chú gồm text và vị trí |
| 7 | Tên | Văn bản tự do có ràng buộc tối thiểu, tối đa 63 byte UTF-8. So trùng không phân biệt hoa thường. Bảng và enum chung một không gian tên |
| 8 | Validation | Hai tầng: bất biến cấu trúc (luôn đúng, operation vi phạm bị từ chối) và issue ngữ nghĩa (được báo, không chặn lưu). AI và template dùng chế độ chặt: không được sinh thêm issue |
| 9 | Operations | Thêm, sửa, xóa từng loại phần tử, di chuyển phần tử, `batch` lồng tối đa `MAX_BATCH_DEPTH` cấp. Xóa kéo theo phần phụ thuộc, trừ enum đang dùng. `applyOperation` trả về operation nghịch đảo (nghịch đảo của `batch` là `batch` phẳng), và trả đúng tham chiếu schema cũ khi không đổi gì. n-n và quan hệ kèm cột khóa ngoại là hàm dựng ra một `batch`. Cấu trúc lịch sử undo/redo thuần, kể cả gộp mục cuối, nằm trong core |
| 10 | Id | Chuỗi có tiền tố theo loại (`tbl_`, `col_`…) cộng token từ bộ sinh id được truyền vào |
| 11 | Version, dữ liệu vào | `version` là số nguyên; migration tuần tự từng bước. Mọi JSON không tin cậy đi qua `parseSchemaDocument`. Dùng Zod để kiểm tra hình dạng; consumer dưới CSP chặt bật `jitless` |
| 12 | Public API | Một entry point chính; entry point `@schemaforge/core/testing` cho factory và fixture |
| 13 | Test | Factory, test theo operation và theo rule, property test apply rồi nghịch đảo bằng fast-check, coverage tối thiểu 90% |

## 1. Cấu trúc tài liệu schema

### Gốc

```ts
type SchemaDocument = {
  readonly version: 1;
  readonly name: string;
  readonly tables: IdMap<TableId, Table>;
  readonly columns: IdMap<ColumnId, Column>;
  readonly relations: IdMap<RelationId, Relation>;
  readonly indexes: IdMap<IndexId, Index>;
  readonly enums: IdMap<EnumId, Enum>;
  readonly subjectAreas: IdMap<SubjectAreaId, SubjectArea>;
  readonly notes: IdMap<NoteId, Note>;
};

type IdMap<K extends string, V> = Readonly<Record<K, V>>;
```

- Mỗi phần tử trong map có trường `id` trùng với khóa của nó.
- Mọi trường luôn có mặt. Không có trường tùy chọn: "không có giá trị" là `null`, riêng văn bản (comment, ghi chú) dùng chuỗi rỗng. Lý do: JSON bỏ `undefined`, nên trường tùy chọn tạo ra hai cách biểu diễn cùng một ý nghĩa, làm so sánh bằng nhau và round-trip IE-04/IE-06 kém tin cậy.
- Phần tử con trỏ tới cha: cột có `tableId`, index có `tableId`. Cha giữ thứ tự con bằng mảng id (xem dưới).

**Phương án bị loại:** lồng cột và index vào trong bảng. Đã loại ở `architecture.md` vì operation, diff và tham chiếu tới cột phức tạp hơn.

### Thứ tự

Map không có thứ tự, và không được dựa vào thứ tự khóa của object: PostgreSQL JSONB sắp lại khóa khi lưu, và undo một thao tác xóa sẽ đưa khóa về cuối object. Vì vậy:

- **Thứ tự có ý nghĩa được lưu bằng mảng:** `table.columnIds` (thứ tự cột), `table.primaryKeyColumnIds` (thứ tự cột của khóa chính), `index.columnIds`, `relation.columnPairs`, `enum.values`.
- **Phần tử ở gốc không có thứ tự lưu trữ.** Core cung cấp hàm sắp xếp xác định cho generator và giao diện danh sách:
  - bảng, enum, subject area: theo tên (so không phân biệt hoa thường, rồi so chính xác), cuối cùng theo id;
  - index: theo thứ tự bảng, rồi theo tên, rồi theo id;
  - quan hệ: theo thứ tự bảng chứa khóa ngoại, rồi vị trí của cột khóa ngoại đầu tiên trong bảng, rồi theo id;
  - ghi chú: theo id.

Nhờ vậy cùng một schema luôn cho cùng một output, bất kể lịch sử thao tác hay nơi lưu.

**Phương án bị loại:** trường số `order` trên từng cột. Di chuyển một cột phải đánh số lại nhiều cột, operation nghịch đảo phải mang theo mọi giá trị cũ. Mảng id trên bảng không có vấn đề này. Mảng `tableIds` ở gốc cũng bị loại: không tính năng nào cần thứ tự bảng do người dùng chọn, còn sắp theo tên không phụ thuộc lịch sử.

### Metadata

- `name`: tên hiển thị của schema, dùng cho màn hình danh sách (câu hỏi 11), danh sách cloud (ST-04), tiêu đề OpenAPI và tài liệu Markdown. Nằm trong tài liệu để file JSON xuất ra (IE-06) mang theo tên. Tầng lưu trữ đọc `name` từ tài liệu để hiển thị danh sách; đổi tên từ màn hình danh sách là operation `renameSchema` áp lên bản đã lưu.
- Không có trong tài liệu: id của schema, `createdAt`, `updatedAt`, revision, chủ sở hữu. Đây là dữ liệu của tầng lưu trữ (phần 3, 4); đưa vào tài liệu sẽ bắt operation phụ thuộc đồng hồ và làm hai bản cùng nội dung khác nhau.
- Không có dialect mặc định: người dùng chọn dialect khi sinh code (CG-01).

### Ví dụ

```json
{
  "version": 1,
  "name": "Blog",
  "tables": {
    "tbl_1": { "id": "tbl_1", "name": "users", "comment": "", "position": { "x": 0, "y": 0 },
      "subjectAreaId": null, "columnIds": ["col_1", "col_2"], "primaryKeyColumnIds": ["col_1"] },
    "tbl_2": { "id": "tbl_2", "name": "posts", "comment": "", "position": { "x": 320, "y": 0 },
      "subjectAreaId": null, "columnIds": ["col_3", "col_4"], "primaryKeyColumnIds": ["col_3"] }
  },
  "columns": {
    "col_1": { "id": "col_1", "tableId": "tbl_1", "name": "id", "type": { "kind": "bigint" },
      "isNullable": false, "defaultValue": null, "isUnique": false, "isAutoIncrement": true, "comment": "" },
    "col_2": { "id": "col_2", "tableId": "tbl_1", "name": "email", "type": { "kind": "varchar", "length": 255 },
      "isNullable": false, "defaultValue": null, "isUnique": true, "isAutoIncrement": false, "comment": "" },
    "col_3": { "id": "col_3", "tableId": "tbl_2", "name": "id", "type": { "kind": "uuid" },
      "isNullable": false, "defaultValue": { "kind": "generateUuid" }, "isUnique": false, "isAutoIncrement": false, "comment": "" },
    "col_4": { "id": "col_4", "tableId": "tbl_2", "name": "author_id", "type": { "kind": "bigint" },
      "isNullable": false, "defaultValue": null, "isUnique": false, "isAutoIncrement": false, "comment": "" }
  },
  "relations": {
    "rel_1": { "id": "rel_1", "kind": "oneToMany", "fromTableId": "tbl_2", "toTableId": "tbl_1",
      "columnPairs": [{ "fromColumnId": "col_4", "toColumnId": "col_1" }],
      "onDelete": "cascade", "onUpdate": "noAction" }
  },
  "indexes": {},
  "enums": {},
  "subjectAreas": {},
  "notes": {}
}
```

Id trong ví dụ được rút gọn; id thật có token do bộ sinh id tạo ra (mục 10).

## 2. Dữ liệu bố cục canvas

**Quyết định:**

- Vị trí nằm trong tài liệu, trên chính phần tử: `table.position` và `note.position`, kiểu `{ x: number; y: number }` (số hữu hạn, đơn vị pixel canvas ở mức zoom 1).
- Kích thước bảng không lưu: React Flow đo từ nội dung. Kích thước ghi chú cũng không lưu vì ED-08 chỉ yêu cầu thêm, sửa, xóa và di chuyển; ghi chú có bề rộng tối đa cố định và tự xuống dòng.
- Subject area không có hình học: khung được tính từ vị trí và kích thước các bảng thành viên (ED-07: "hiển thị nhóm bao quanh các bảng thuộc nhóm").
- Di chuyển là operation `moveElements`, undo được. Frontend phát một operation khi thả chuột, không phát theo từng lần chuột di chuyển. Kéo nhiều phần tử cùng lúc, hay auto-layout (ED-11), là một `moveElements` duy nhất nên undo trong một bước.
- Viewport (zoom, pan) không nằm trong tài liệu và không undo được; đó là trạng thái xem của từng người, phần 3 quyết định có lưu hay không.

**Lý do:** vị trí phải còn sau khi lưu và mở lại, phải đi theo file JSON (IE-06 gồm cả ghi chú, mà ghi chú chỉ có ý nghĩa khi có vị trí), và auto-layout phải undo được qua operation của core (ED-11, ED-13). Đặt vị trí ngay trên phần tử thì thêm hay xóa bảng tự mang theo vị trí, operation nghịch đảo của `removeTable` khôi phục đúng chỗ cũ mà không phải đồng bộ với map thứ hai. Generator và validation ngữ nghĩa bỏ qua `position`; công cụ diff (phần 5, 8) có thể tách thay đổi vị trí khỏi thay đổi cấu trúc.

**Phương án bị loại:**

- Map `layout` riêng ở gốc: tách bạch hơn cho generator, nhưng mỗi thao tác thêm, xóa phải sửa hai map và cần thêm bất biến "mọi bảng có đúng một vị trí".
- Lưu bố cục ngoài tài liệu, ở tầng lưu trữ: auto-layout không undo được bằng operation, và file JSON xuất ra mất bố cục.

## 3. Bộ kiểu dữ liệu chung

### Danh sách kiểu

```ts
type ColumnType =
  | { readonly kind: 'smallint' }
  | { readonly kind: 'integer' }
  | { readonly kind: 'bigint' }
  | { readonly kind: 'decimal'; readonly precision: number; readonly scale: number }
  | { readonly kind: 'real' }
  | { readonly kind: 'double' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'char'; readonly length: number }
  | { readonly kind: 'varchar'; readonly length: number }
  | { readonly kind: 'text' }
  | { readonly kind: 'uuid' }
  | { readonly kind: 'date' }
  | { readonly kind: 'time' }
  | { readonly kind: 'timestamp' }
  | { readonly kind: 'timestamptz' }
  | { readonly kind: 'json' }
  | { readonly kind: 'binary' }
  | { readonly kind: 'enum'; readonly enumId: EnumId }
  | { readonly kind: 'custom'; readonly name: string };
```

- Mỗi kiểu là một `kind` riêng, tham số chỉ có ở kiểu cần: độ dài cho `char` và `varchar`, precision và scale cho `decimal`, id enum cho `enum`, tên cho `custom`. Danh sách phẳng dễ hiển thị thành dropdown và dễ khai báo thành tham số tool call cho AI.
- `length` và `precision` là số nguyên ≥ 1, `scale` là số nguyên ≥ 0 (bất biến cấu trúc). `scale ≤ precision` là issue ngữ nghĩa, vì người dùng có thể đang sửa dở một trong hai giá trị.
- Giới hạn riêng của từng dialect (ví dụ `decimal` tối đa 38 chữ số ở SQL Server, `nvarchar` tối đa 4000 ký tự trước khi phải dùng `max`) không nằm trong core. Generator báo diagnostic theo câu hỏi 7 (phần 6).
- `varchar` và `text` là chuỗi Unicode: SQL Server ánh xạ sang `nvarchar`, vì tên và dữ liệu tiếng Việt cần Unicode.

**Kiểu custom** là lối thoát cho kiểu riêng của database (`inet`, `money`, `geometry(Point, 4326)`, `text[]`). `name` được generator SQL ghi nguyên văn, nên phải khớp cú pháp an toàn: bắt đầu bằng chữ cái Latin (`A–Z`, `a–z`), chỉ gồm chữ cái Latin, chữ số, `_`, khoảng trắng, dấu phẩy, `()` và `[]`, tối đa 63 byte. Không cho phép dấu nháy, `;`, `--`, `/*`, nên kiểu custom không thể chèn câu lệnh SQL vào output. Vi phạm là issue `column-custom-type-invalid`. Generator không phải SQL ánh xạ kiểu custom sang kiểu tổng quát nhất của đích (Prisma `Unsupported("…")`, TypeScript `unknown`, Zod `z.unknown()`).

**Phương án bị loại:**

- Kiểu theo từng dialect ngay từ đầu: đã loại ở câu hỏi 4.
- Kiểu custom có tên riêng cho từng dialect: thêm giao diện và độ phức tạp cho importer mà không tính năng nào cần. Schema dùng kiểu custom được xem là gắn với một dialect; sinh sang dialect khác là trách nhiệm của người dùng, generator có thể cảnh báo.
- Tham số hóa (`{ kind: 'integer'; size: 'small' | 'regular' | 'big' }`): ít `kind` hơn nhưng dropdown và tool call phải xử lý hai tầng.

### Ánh xạ tham khảo

Bảng này chứng minh bộ kiểu biểu diễn được trên cả ba dialect. Ánh xạ đầy đủ, kể cả Prisma, Drizzle, TypeScript, Zod, OpenAPI, được chốt ở phần 6 ([2026-09-14-code-generators-design.md](2026-09-14-code-generators-design.md)).

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
| `timestamptz` | `timestamptz` | `TIMESTAMP(6)` | `datetimeoffset` |
| `json` | `jsonb` | `JSON` | `nvarchar(max)` |
| `binary` | `bytea` | `LONGBLOB` | `varbinary(max)` |
| `enum` | `CREATE TYPE … AS ENUM` | `ENUM(…)` trên cột | `nvarchar` + `CHECK` (câu hỏi 7) |
| `custom` | ghi nguyên văn | ghi nguyên văn | ghi nguyên văn |

MySQL dùng độ chính xác phân số giây 6 cho `TIME`, `DATETIME`, `TIMESTAMP`: mặc định là 0 và sẽ cắt mất phần giây lẻ mà literal mặc định cho phép.

### Giá trị mặc định

```ts
type ColumnDefault =
  | { readonly kind: 'literal'; readonly value: string }
  | { readonly kind: 'currentTimestamp' }
  | { readonly kind: 'generateUuid' };

// Column.defaultValue: ColumnDefault | null  (null = không có giá trị mặc định)
```

- **Literal** luôn là chuỗi, được hiểu theo kiểu của cột. Chuỗi tránh mất độ chính xác của `bigint` và `decimal` khi đi qua số JavaScript, và cho một cách biểu diễn duy nhất.

  | Kiểu cột | Literal hợp lệ |
  |---|---|
  | `smallint`, `integer`, `bigint` | số nguyên thập phân, nằm trong phạm vi của kiểu (kiểm tra bằng `BigInt`) |
  | `decimal(p, s)` | số thập phân, phần nguyên tối đa `p − s` chữ số (không kể số 0 ở đầu), phần sau dấu chấm tối đa `s` chữ số |
  | `real`, `double` | số thập phân, cho phép số mũ |
  | `boolean` | `true` hoặc `false` |
  | `char(n)`, `varchar(n)` | chuỗi bất kỳ dài tối đa `n` ký tự |
  | `text`, `custom` | chuỗi bất kỳ |
  | `uuid` | dạng `8-4-4-4-12` chữ số hex |
  | `date` / `time` | `YYYY-MM-DD` là ngày có thật / `HH:MM:SS` với phần giây lẻ tùy chọn |
  | `timestamp` / `timestamptz` | `YYYY-MM-DDTHH:MM:SS` với phần giây lẻ tùy chọn / như trên, kèm `Z` hoặc độ lệch múi giờ |
  | `json` | văn bản JSON hợp lệ |
  | `enum` | một giá trị có trong enum |
  | `binary` | không hỗ trợ literal |

  Phần nguyên của `decimal(p, s)` giới hạn ở `p − s` chữ số vì giá trị lớn nhất của `decimal(3, 2)` là `9.99`: cả ba dialect từ chối `10.0` dù nó chỉ có 3 chữ số. Khi `scale > precision` (đã có issue `column-type-invalid-scale`), literal chỉ được kiểm tra dạng số, không kiểm tra số chữ số.

- **Biểu thức** là tập đóng, có cấu trúc, không phải SQL thô:
  - `currentTimestamp` cho `timestamp`, `timestamptz` (PostgreSQL `now()`, MySQL `CURRENT_TIMESTAMP(6)` khớp độ chính xác của cột, SQL Server `sysdatetime()` cho cột `datetime2` và `sysdatetimeoffset()` cho cột `datetimeoffset`, Prisma `now()`). SQL Server không dùng `sysdatetimeoffset()` cho `datetime2` vì chuyển ngầm sang `datetime2` làm mất độ lệch múi giờ.
  - `generateUuid` cho `uuid` (PostgreSQL `gen_random_uuid()`, MySQL `(UUID())`, SQL Server `newid()`, Prisma `uuid()`).
- Literal không đúng dạng của kiểu là issue `column-default-invalid`. Biểu thức dùng sai kiểu, hoặc literal trên cột `binary`, là issue `column-default-incompatible`. Đây là issue ngữ nghĩa: đổi kiểu cột có thể tạm thời làm giá trị mặc định cũ không còn hợp lệ.
- Thêm biểu thức mới sau này chỉ là thêm một `kind` vào union; tài liệu cũ vẫn hợp lệ.

**Phương án bị loại:** literal có kiểu JSON (`number | boolean | string`): mất độ chính xác với `bigint`, `decimal`, và vẫn cần kiểm tra theo kiểu cột. Biểu thức SQL thô: trái nguyên tắc không đưa SQL tự do vào schema, không ánh xạ được sang Prisma, Drizzle, và mở đường chèn SQL vào output. Default SQL khác hai biểu thức trên khi import (ví dụ `nextval('seq')`) được importer báo là không hỗ trợ (phần 7).

## 4. Cột và khóa chính

```ts
type Column = {
  readonly id: ColumnId;
  readonly tableId: TableId;
  readonly name: string;
  readonly type: ColumnType;
  readonly isNullable: boolean;
  readonly defaultValue: ColumnDefault | null;
  readonly isUnique: boolean;        // unique trên riêng cột này
  readonly isAutoIncrement: boolean;
  readonly comment: string;          // '' = không có comment
};

type Table = {
  readonly id: TableId;
  readonly name: string;
  readonly comment: string;
  readonly position: Position;
  readonly subjectAreaId: SubjectAreaId | null;
  readonly columnIds: readonly ColumnId[];           // thứ tự cột
  readonly primaryKeyColumnIds: readonly ColumnId[]; // [] = không có khóa chính
};
```

**Khóa chính nằm trên bảng**, là mảng id cột có thứ tự. Khóa chính một cột hay nhiều cột dùng chung một cách biểu diễn. Thứ tự trong mảng là thứ tự cột của khóa chính trong DDL, có thể khác thứ tự cột trong bảng (ví dụ `PRIMARY KEY (tenant_id, id)`). Bảng không có khóa chính vẫn hợp lệ trong core; đích nào bắt buộc khóa chính (Prisma cần định danh duy nhất) thì generator báo diagnostic.

**Unique:** `column.isUnique` là ràng buộc unique trên một cột (ED-02). Unique trên nhiều cột là index có `isUnique` (mục 6).

**Quy tắc ngữ nghĩa của cột** (mã issue ở mục 8):

- Cột trong khóa chính không được nullable.
- Auto-increment chỉ trên `smallint`, `integer`, `bigint`; không nullable; không có giá trị mặc định; phải thuộc khóa chính hoặc unique (MySQL bắt buộc cột auto-increment có index); mỗi bảng tối đa một cột auto-increment (MySQL và SQL Server chỉ cho một).
- Với auto-increment, thuộc khóa chính là nằm ở bất kỳ vị trí nào trong khóa chính, kể cả khóa nhiều cột. Unique dùng chung định nghĩa ở mục 5 cho tập chỉ gồm cột đó: tập bằng tập cột khóa chính, hoặc cột có `isUnique`, hoặc tập bằng tập cột của một index unique.

**Lý do chọn mảng trên bảng:** thứ tự khóa chính được giữ khi import SQL rồi sinh lại, và quan hệ tham chiếu khóa chính nhiều cột có một danh sách rõ ràng để so khớp.

**Phương án bị loại:** cờ `isPrimaryKey` trên từng cột. Đơn giản cho khóa một cột, nhưng mất thứ tự riêng của khóa chính nhiều cột và phải quét toàn bộ cột để biết khóa chính.

## 5. Quan hệ

```ts
type Relation = {
  readonly id: RelationId;
  readonly kind: 'oneToOne' | 'oneToMany';
  readonly fromTableId: TableId;  // bảng chứa khóa ngoại (phía "n" của 1-n)
  readonly toTableId: TableId;    // bảng được tham chiếu (phía "1")
  readonly columnPairs: readonly ColumnPair[]; // ít nhất một cặp
  readonly onDelete: ReferentialAction;
  readonly onUpdate: ReferentialAction;
};

type ColumnPair = { readonly fromColumnId: ColumnId; readonly toColumnId: ColumnId };

type ReferentialAction = 'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault';
```

- **Khóa ngoại nhiều cột** là danh sách cặp cột có thứ tự. Mỗi `fromColumnId` thuộc `fromTableId`, mỗi `toColumnId` thuộc `toTableId`, không cột nào lặp lại trong cùng một phía (bất biến cấu trúc). `fromTableId` và `toTableId` được lưu tường minh dù suy ra được từ cột: canvas và generator dùng liên tục, và bất biến bắt được operation vô tình chuyển quan hệ sang bảng khác.
- **Quan hệ tự tham chiếu** (`fromTableId === toTableId`, ví dụ `employees.manager_id`) hợp lệ.
- **Hành động:** mặc định `noAction` cho cả hai. Có đủ năm hành động chuẩn. Đích không hỗ trợ một hành động thì generator ánh xạ gần nhất hoặc báo diagnostic (SQL Server không có `RESTRICT` nên dùng `NO ACTION`; MySQL InnoDB từ chối `SET DEFAULT`).
- **Cột được tham chiếu** phải là khóa chính hoặc unique: tập `toColumnId` bằng đúng tập cột của khóa chính bảng đích, hoặc là một cột có `isUnique`, hoặc bằng đúng tập cột của một index unique. So theo tập, không theo thứ tự; generator MySQL tự sắp lại các cặp theo thứ tự của index. Cả ba dialect đều yêu cầu điều này.
- **Kiểu dữ liệu** của hai cột trong mỗi cặp phải giống hệt nhau (cùng `kind` và cùng tham số, cùng `enumId`, cùng tên custom). So khớp tuyệt đối là mức an toàn cho cả ba dialect (ED-03).
- **1-1 và 1-n** được phân biệt bằng `kind` lưu tường minh. `oneToOne` yêu cầu tập cột khóa ngoại cũng unique (bằng khóa chính, `isUnique`, hoặc index unique), nếu không là issue `relation-one-to-one-not-unique`. Generator không tự thêm ràng buộc unique ngầm, nên import SQL rồi sinh lại không bị lặp ràng buộc. Phía "0..1" hay "1" suy ra từ `isNullable` của cột khóa ngoại.
- `setNull` yêu cầu mọi cột khóa ngoại nullable; `setDefault` yêu cầu mọi cột khóa ngoại có giá trị mặc định.
- **Tên ràng buộc khóa ngoại** không lưu: generator đặt tên xác định từ tên bảng và cột. Người dùng không đặt tên quan hệ trên canvas, và import rồi sinh lại chỉ cần schema tương đương.

**Quan hệ n-n và bảng trung gian:** không có đánh dấu riêng. Bảng trung gian là bảng thường với hai quan hệ `oneToMany` trỏ ra hai bảng hai đầu (câu hỏi 6). Canvas vẽ nó như mọi bảng khác, generator Prisma và Drizzle sinh model trung gian tường minh, xóa bảng trung gian kéo theo xóa hai quan hệ. Không tính năng nào cần phân biệt bảng trung gian với bảng thường; nếu sau này cần, điều kiện "hai khóa ngoại tạo thành khóa chính" suy ra được từ dữ liệu. Cách tạo n-n bằng một thao tác xem mục 9.

**Phương án bị loại:**

- Suy ra 1-1 từ tính unique của cột khóa ngoại, không lưu `kind`: không thể mâu thuẫn, nhưng đổi loại quan hệ trên canvas sẽ ngầm thêm hoặc bỏ ràng buộc unique, và canvas không thể hiện được ý định của người dùng trước khi ràng buộc được đặt.
- Cho phép tham chiếu cột không unique: không dialect nào hỗ trợ chuẩn.

## 6. Index, enum, comment, subject area, ghi chú

```ts
type Index = {
  readonly id: IndexId;
  readonly tableId: TableId;
  readonly name: string;
  readonly columnIds: readonly ColumnId[]; // ít nhất một cột, có thứ tự
  readonly isUnique: boolean;
};

type Enum = {
  readonly id: EnumId;
  readonly name: string;
  readonly values: readonly string[]; // có thứ tự
};

type SubjectArea = {
  readonly id: SubjectAreaId;
  readonly name: string;
};

type Note = {
  readonly id: NoteId;
  readonly text: string;
  readonly position: Position;
};

type Position = { readonly x: number; readonly y: number };
```

- **Index** (ED-04): cột thuộc đúng bảng của index, không lặp (bất biến cấu trúc). Tên bắt buộc: người dùng thấy và sửa tên trong bảng index, và SQL Server bắt buộc tên index. Editor, importer và AI dùng chung hàm `suggestIndexName` của core để đề xuất tên không trùng. Chiều sắp xếp (ASC/DESC) và loại index (btree, hash) chưa có vì không tính năng nào yêu cầu.
- **Enum** (ED-05): giá trị là chuỗi, thứ tự được giữ. Enum không có giá trị, hoặc có giá trị trùng (so không phân biệt hoa thường, vì MySQL và SQL Server so theo collation không phân biệt hoa thường), là issue. Cột dùng enum qua `{ kind: 'enum', enumId }`. Sửa danh sách giá trị là thay cả mảng (mục 9).
- **Comment** (ED-06): `comment` trên bảng và cột, chuỗi rỗng là không có. Enum, index, quan hệ không có comment vì ED-06 chỉ yêu cầu bảng và cột.
- **Subject area** (ED-07): chỉ có tên. Thành viên được lưu trên bảng bằng `table.subjectAreaId`, nên một bảng thuộc tối đa một nhóm theo cấu trúc dữ liệu (khớp `TableGroup` của DBML, và khung nhóm tính từ thành viên không chồng lên nhau). Thêm, bớt bảng khỏi nhóm là `updateTable`. Nhóm rỗng hợp lệ. Màu nhóm chưa có vì ED-07 không yêu cầu.
- **Ghi chú** (ED-08): văn bản thuần và vị trí. Không gắn với bảng.

**Phương án bị loại:** `SubjectArea.tableIds` là mảng thành viên: một bảng có thể nằm trong nhiều nhóm, cần thêm bất biến chống trùng và cascade khi xóa bảng. Enum value có id riêng: đổi tên giá trị không làm hỏng giá trị mặc định, nhưng mọi generator và importer phải xử lý thêm một tầng id cho một trường hợp hiếm; giá trị mặc định trỏ tới giá trị đã đổi tên được báo bằng issue để người dùng sửa.

## 7. Tên và định danh

**Ràng buộc chung cho tên bảng, cột, enum, index, subject area và giá trị enum:**

- Không rỗng.
- Không có khoảng trắng ở đầu hoặc cuối, không có ký tự điều khiển (U+0000–U+001F, U+007F).
- Tối đa 63 byte khi mã hóa UTF-8. PostgreSQL cắt ngắn định danh (và nhãn enum) dài hơn 63 byte mà không báo lỗi, có thể làm hai tên khác nhau thành trùng.

Ngoài các điều trên, tên là văn bản tự do: được có chữ có dấu tiếng Việt, khoảng trắng, dấu gạch ngang, và trùng từ khóa SQL (`user`, `order`). Generator quote và escape định danh theo đích, và ánh xạ sang định danh hợp lệ ở đích có luật riêng (Prisma `@@map`, key có dấu nháy trong TypeScript). Tên schema (`name` ở gốc) là tên hiển thị, chỉ cần không rỗng.

**Phạm vi không được trùng:**

| Tên | Phạm vi | Lý do |
|---|---|---|
| Bảng và enum | Chung một không gian tên trong schema | PostgreSQL tạo type cho mỗi bảng nên enum không được trùng tên bảng; Prisma và TypeScript cũng dùng chung không gian tên cho model và enum |
| Cột | Trong một bảng | — |
| Index | Trong cả schema | PostgreSQL yêu cầu tên index không trùng trong schema, chặt nhất trong ba dialect |
| Subject area | Trong cả schema | DBML yêu cầu tên `TableGroup` không trùng |
| Giá trị enum | Trong một enum | — |

**Phân biệt hoa thường:** tên được lưu đúng như người dùng nhập. So trùng không phân biệt hoa thường, dùng `toLowerCase()` (không phụ thuộc locale). Lý do: SQL Server mặc định và MySQL trên Windows, macOS không phân biệt hoa thường, nên `User` và `user` chỉ an toàn trên PostgreSQL.

Tên do generator tự đặt (ràng buộc khóa chính, khóa ngoại, unique) có thể trùng với tên index hoặc tên bảng; generator phải tự tránh trùng (phần 6).

**Phương án bị loại:** chỉ cho định danh ASCII (`^[A-Za-z_][A-Za-z0-9_]*$`). Generator đơn giản hơn, nhưng từ chối tên hợp lệ khi import database có sẵn và tên tiếng Việt, trong khi generator vẫn phải quote vì từ khóa SQL.

## 8. Validation

### Hai tầng

Yêu cầu có vẻ mâu thuẫn: `architecture.md` nói core validate trước khi áp dụng; editor cần chấp nhận trạng thái tạm (đang đổi tên thành tên trùng); tool call của AI phải bị từ chối khi không hợp lệ; tham chiếu treo không bao giờ được xảy ra. Spec giải quyết bằng hai tầng quy tắc:

1. **Bất biến cấu trúc.** Luôn đúng với mọi tài liệu mà core trả ra hoặc chấp nhận. `applyOperation` từ chối operation vi phạm; `parseSchemaDocument` từ chối tài liệu vi phạm. Gồm: hình dạng dữ liệu, id đúng định dạng và khớp khóa map, mọi tham chiếu tới id tồn tại, cột thuộc đúng bảng, không lặp cột trong một danh sách, mảng bắt buộc không rỗng, tham số kiểu đúng miền. Đây là những điều mà nếu sai thì tài liệu vô nghĩa, và mọi đoạn code đọc model sẽ phải tự kiểm tra lại.
2. **Issue ngữ nghĩa.** `validateSchema(document)` trả về danh sách issue của một tài liệu đúng cấu trúc. Issue không chặn operation và không chặn lưu. Gồm: tên, trùng tên, tổ hợp thuộc tính, tương thích kiểu, giá trị mặc định, enum rỗng. Đây là những trạng thái người dùng có thể đi qua khi đang sửa.

Từ đó có hai mức cho một tài liệu:

- **Đúng cấu trúc:** qua được `parseSchemaDocument`. Điều kiện để áp operation và để lưu ở bất kỳ đâu.
- **Hợp lệ:** đúng cấu trúc và `validateSchema` trả về danh sách rỗng. Điều kiện để generator đảm bảo output đúng (tiêu chí chung của nhóm Code Generator), và bắt buộc với template (UX-01).

"Core validate trước khi áp dụng" nghĩa là: mỗi operation được kiểm tra điều kiện của nó và bất biến cấu trúc trước khi tạo schema mới; issue ngữ nghĩa được tính lại sau mỗi lần áp dụng để hiển thị.

### Chính sách theo nơi gọi

| Nơi gọi | Vi phạm bất biến cấu trúc | Issue ngữ nghĩa |
|---|---|---|
| Editor, thao tác tay (phần 3) | Từ chối operation | Hiển thị cạnh phần tử, không chặn |
| AI tool call (phần 5) | Từ chối tool call | Từ chối nếu kết quả phát sinh issue mới so với schema trước đó |
| Import (phần 7) | Từ chối | Cho phép: kết quả import không dùng chế độ chặt, issue mới hiện ở bước xem trước và không chặn import ([spec phần 7](2026-09-15-import-export-design.md), mục 3) |
| Lưu local (phần 3), backend nhận schema (phần 4) | Từ chối tài liệu | Cho phép, để không mất bản đang sửa dở khi tự động lưu |
| Template (phần 9) | — | Không được có issue, kiểm tra bằng test |
| Generator (phần 6) | Yêu cầu tài liệu đúng cấu trúc | Chỉ đảm bảo output đúng khi không có issue; phần 6 chốt cách xử lý schema còn issue |

**Chế độ chặt cho AI.** Core cung cấp `findIntroducedIssues(before, after)`: các issue có trong `after` mà không có trong `before`, so theo cặp `code` và `path`. Backend áp các tool call của một lượt thành một `batch`; nếu batch bị từ chối hoặc `findIntroducedIssues` không rỗng thì đề xuất bị từ chối. So với "kết quả không có issue nào", cách này không chặn AI chỉ vì schema của người dùng đã có sẵn issue từ trước. Phần 5 chốt việc kiểm tra theo từng tool call hay cả lượt, và cách trả lỗi lại cho model.

**Lưu có issue.** ST-03 ghi "từ chối schema không hợp lệ". Theo spec này, backend từ chối tài liệu sai cấu trúc; tài liệu còn issue ngữ nghĩa vẫn được lưu, vì tự động lưu cloud chạy cả khi người dùng đang sửa dở. Phần 4 chốt lại cách viết tiêu chí ST-03.

**Phương án bị loại:**

- Mọi quy tắc đều chặn operation: editor không cho đổi tên qua trạng thái trùng tạm thời, người dùng phải sửa theo đúng thứ tự mà core chấp nhận, và tự động lưu có thể mất dữ liệu.
- Không quy tắc nào chặn, chỉ báo issue: tham chiếu treo lọt vào tài liệu, và mọi generator, giao diện phải tự kiểm tra id có tồn tại không.

### Hình dạng lỗi

```ts
type DocumentPath = readonly (string | number)[]; // ví dụ ['tables', 'tbl_1', 'name']

type Issue = { readonly code: IssueCode; readonly path: DocumentPath };

type StructuralError = { readonly code: StructuralErrorCode; readonly path: DocumentPath };

type OperationError = {
  readonly code: StructuralErrorCode | OperationErrorCode;
  readonly path: DocumentPath; // đường dẫn trong operation, ví dụ ['operations', 2, 'columnPairs', 0, 'toColumnId']
};
```

- Không có thông báo, không có tham số hiển thị: frontend dịch `code` qua i18n và lấy tên phần tử theo `path`.
- Issue về trùng tên được báo trên mọi phần tử trong nhóm trùng, không ưu tiên phần tử nào. Bảng và enum chung một nhóm: bảng `User` trùng enum `user` thì bảng nhận `table-name-duplicate`, enum nhận `enum-name-duplicate`, nên người dùng thấy lỗi dù đang sửa phần tử nào.
- `validateSchema` trả issue theo thứ tự xác định (theo `path`, rồi theo `code`).
- Mọi issue đều là lỗi, không có mức cảnh báo. Gợi ý thiết kế (bảng thiếu khóa chính, thiếu index) thuộc AI-05; giới hạn riêng của đích thuộc diagnostic của generator.

### Danh mục mã bất biến cấu trúc

Dùng chung cho `parseSchemaDocument` (đường dẫn trong tài liệu) và `applyOperation` (đường dẫn trong operation).

| Mã | Điều kiện | Tiêu chí |
|---|---|---|
| `invalid-shape` | Sai hình dạng: thiếu trường, sai kiểu, `kind` không biết, số không hữu hạn, mảng bắt buộc bị rỗng, tham số kiểu ngoài miền, id sai định dạng | IE-04 |
| `version-unsupported` | `version` mới hơn phiên bản core đang chạy | IE-04 |
| `id-mismatch` | Khóa map khác `id` của phần tử | IE-04 |
| `id-already-exists` | Thêm phần tử với id đã có | — |
| `table-not-found`, `column-not-found`, `relation-not-found`, `index-not-found`, `enum-not-found`, `subject-area-not-found`, `note-not-found` | Tham chiếu tới id không tồn tại | ED-04 (index dùng cột không tồn tại), ED-05 (cột dùng enum không tồn tại) |
| `column-not-in-table` | Cột trong khóa chính, index hoặc cặp cột quan hệ không thuộc đúng bảng | ED-03, ED-04 |
| `column-listed-twice` | Một cột xuất hiện hai lần trong khóa chính, index, hoặc cùng một phía của quan hệ | — |
| `column-ownership-mismatch` | `table.columnIds` không khớp đúng tập cột có `tableId` là bảng đó | IE-04 |
| `enum-in-use` | Xóa enum mà vẫn còn cột dùng | ED-05 |
| `insert-position-out-of-range` | Vị trí chèn hoặc di chuyển cột nằm ngoài danh sách | — |
| `primary-key-missing` | `buildManyToMany` hoặc `buildRelation` được gọi với bảng không có khóa chính (`buildRelation` chỉ xét bảng được tham chiếu). Chỉ có ở hàm dựng, không có ở parse | ED-03 |

### Danh mục mã issue ngữ nghĩa

| Mã | Đường dẫn | Điều kiện | Tiêu chí |
|---|---|---|---|
| `name-empty` | `…/name`, `enums/<id>/values/<i>` | Tên rỗng (kể cả tên schema) | — |
| `name-invalid` | như trên | Có khoảng trắng đầu hoặc cuối, hoặc ký tự điều khiển | — |
| `name-too-long` | như trên | Quá 63 byte UTF-8 | — |
| `table-name-duplicate` | `tables/<id>/name` | Trùng tên bảng khác hoặc tên enum | ED-01 |
| `enum-name-duplicate` | `enums/<id>/name` | Trùng tên enum khác hoặc tên bảng | ED-05 |
| `column-name-duplicate` | `columns/<id>/name` | Trùng tên cột khác trong cùng bảng | ED-02 |
| `index-name-duplicate` | `indexes/<id>/name` | Trùng tên index khác trong schema | ED-04 |
| `subject-area-name-duplicate` | `subjectAreas/<id>/name` | Trùng tên subject area khác | ED-07 |
| `enum-values-empty` | `enums/<id>/values` | Enum không có giá trị | ED-05 |
| `enum-value-duplicate` | `enums/<id>/values/<i>` | Giá trị trùng giá trị khác trong enum | ED-05 |
| `column-type-invalid-scale` | `columns/<id>/type/scale` | `scale > precision` | ED-02 |
| `column-custom-type-invalid` | `columns/<id>/type/name` | Tên kiểu custom sai cú pháp an toàn | ED-02 |
| `column-default-invalid` | `columns/<id>/defaultValue` | Literal sai dạng của kiểu cột, hoặc không có trong enum | ED-02 |
| `column-default-incompatible` | `columns/<id>/defaultValue` | Biểu thức không dùng được với kiểu cột, hoặc literal trên `binary` | ED-02 |
| `column-primary-key-nullable` | `columns/<id>/isNullable` | Cột trong khóa chính nhưng nullable | ED-02 |
| `column-auto-increment-invalid-type` | `columns/<id>/isAutoIncrement` | Auto-increment trên cột không phải `smallint`, `integer`, `bigint` | ED-02 |
| `column-auto-increment-nullable` | `columns/<id>/isAutoIncrement` | Auto-increment trên cột nullable | ED-02 |
| `column-auto-increment-with-default` | `columns/<id>/isAutoIncrement` | Auto-increment kèm giá trị mặc định | ED-02 |
| `column-auto-increment-not-key` | `columns/<id>/isAutoIncrement` | Cột auto-increment không thuộc khóa chính và không unique (định nghĩa ở mục 4) | ED-02 |
| `table-multiple-auto-increment` | `tables/<id>/columnIds` | Bảng có hơn một cột auto-increment | ED-02 |
| `relation-column-type-mismatch` | `relations/<id>/columnPairs/<i>` | Hai cột trong cặp khác kiểu | ED-03 |
| `relation-target-not-unique` | `relations/<id>/columnPairs` | Cột được tham chiếu không phải khóa chính hoặc unique | ED-03 |
| `relation-one-to-one-not-unique` | `relations/<id>/kind` | Quan hệ 1-1 nhưng cột khóa ngoại không unique | ED-03 |
| `relation-set-null-not-nullable` | `relations/<id>/onDelete` hoặc `onUpdate` | `setNull` trên cột khóa ngoại không nullable | ED-03 |
| `relation-set-default-without-default` | `relations/<id>/onDelete` hoặc `onUpdate` | `setDefault` trên cột khóa ngoại không có giá trị mặc định | ED-03 |

### Đối chiếu các tiêu chí "Core báo lỗi…"

| Tiêu chí | Cách core đáp ứng |
|---|---|
| ED-01: hai bảng trùng tên | Issue `table-name-duplicate` |
| ED-01: xóa bảng không để lại quan hệ treo | `removeTable` xóa kèm quan hệ trỏ tới và trỏ từ bảng; bất biến cấu trúc bảo đảm |
| ED-02: hai cột trùng tên | Issue `column-name-duplicate` |
| ED-02: tổ hợp thuộc tính không hợp lệ | Các issue `column-auto-increment-*`, `column-primary-key-nullable`, `column-default-*`, `table-multiple-auto-increment` |
| ED-03: cột khóa ngoại và cột được tham chiếu khác kiểu | Issue `relation-column-type-mismatch` |
| ED-03: xóa cột không để lại quan hệ treo | `removeColumn` xóa kèm quan hệ dùng cột; bất biến cấu trúc bảo đảm |
| ED-04: index dùng cột không tồn tại | Operation bị từ chối với `column-not-found` hoặc `column-not-in-table`; tài liệu nhập vào bị từ chối; `removeColumn` xóa kèm index dùng cột |
| ED-05: enum rỗng hoặc có giá trị trùng | Issue `enum-values-empty`, `enum-value-duplicate` |
| ED-05: cột dùng enum không tồn tại | Operation bị từ chối với `enum-not-found`; `removeEnum` bị từ chối với `enum-in-use` khi còn cột dùng |

## 9. Operations

### Danh mục

```ts
type Operation =
  | { readonly type: 'renameSchema'; readonly name: string }
  // Bảng: bảng mới luôn chưa có cột và chưa có khóa chính
  | { readonly type: 'addTable'; readonly table: Omit<Table, 'columnIds' | 'primaryKeyColumnIds'> }
  | { readonly type: 'updateTable'; readonly tableId: TableId;
      readonly changes: Partial<Pick<Table, 'name' | 'comment' | 'subjectAreaId'>> }
  | { readonly type: 'setPrimaryKey'; readonly tableId: TableId; readonly columnIds: readonly ColumnId[] }
  | { readonly type: 'removeTable'; readonly tableId: TableId }
  // Cột
  | { readonly type: 'addColumn'; readonly column: Column; readonly insertAt: number }
  | { readonly type: 'updateColumn'; readonly columnId: ColumnId;
      readonly changes: Partial<Omit<Column, 'id' | 'tableId'>> }
  | { readonly type: 'moveColumn'; readonly columnId: ColumnId; readonly toIndex: number }
  | { readonly type: 'removeColumn'; readonly columnId: ColumnId }
  // Quan hệ: đổi bảng hai đầu là removeRelation + addRelation trong một batch
  | { readonly type: 'addRelation'; readonly relation: Relation }
  | { readonly type: 'updateRelation'; readonly relationId: RelationId;
      readonly changes: Partial<Pick<Relation, 'kind' | 'columnPairs' | 'onDelete' | 'onUpdate'>> }
  | { readonly type: 'removeRelation'; readonly relationId: RelationId }
  // Index
  | { readonly type: 'addIndex'; readonly index: Index }
  | { readonly type: 'updateIndex'; readonly indexId: IndexId;
      readonly changes: Partial<Pick<Index, 'name' | 'columnIds' | 'isUnique'>> }
  | { readonly type: 'removeIndex'; readonly indexId: IndexId }
  // Enum
  | { readonly type: 'addEnum'; readonly enum: Enum }
  | { readonly type: 'updateEnum'; readonly enumId: EnumId; readonly changes: Partial<Pick<Enum, 'name' | 'values'>> }
  | { readonly type: 'removeEnum'; readonly enumId: EnumId }
  // Subject area: thêm, bớt bảng khỏi nhóm là updateTable({ subjectAreaId })
  | { readonly type: 'addSubjectArea'; readonly subjectArea: SubjectArea }
  | { readonly type: 'updateSubjectArea'; readonly subjectAreaId: SubjectAreaId; readonly changes: Pick<SubjectArea, 'name'> }
  | { readonly type: 'removeSubjectArea'; readonly subjectAreaId: SubjectAreaId }
  // Ghi chú
  | { readonly type: 'addNote'; readonly note: Note }
  | { readonly type: 'updateNote'; readonly noteId: NoteId; readonly changes: Pick<Note, 'text'> }
  | { readonly type: 'removeNote'; readonly noteId: NoteId }
  // Bố cục
  | { readonly type: 'moveElements';
      readonly moves: readonly { readonly elementId: TableId | NoteId; readonly position: Position }[] }
  // Nhiều bước
  | { readonly type: 'batch'; readonly operations: readonly Operation[] };
```

- **Chi tiết vừa đủ cho tool call.** Mỗi operation làm một việc, tham số là dữ liệu đầy đủ của phần tử (kể cả id), không có giá trị ngầm định. Tool của AI ở phần 5 ánh xạ sang các operation này; tool có thể ẩn bớt tham số (id, vị trí) để backend điền trước khi gọi core.
- **`updateX` với `changes`** chỉ đổi các trường được truyền. Không có operation riêng cho từng trường, để danh mục gọn và một lần sửa nhiều trường trong form là một operation.
- **`updateEnum.values`** thay cả mảng giá trị. Thêm, đổi tên, xóa, sắp lại giá trị đều là một kiểu operation. Giá trị mặc định của cột trỏ tới giá trị bị đổi tên hoặc bị xóa sẽ thành issue `column-default-invalid`.
- **`moveElements`** nhận cả bảng và ghi chú (phân biệt bằng tiền tố id), nên kéo nhiều phần tử và auto-layout là một operation.
- **`batch`** áp lần lượt các operation con lên kết quả của bước trước. Một bước lỗi thì cả batch lỗi, `path` của lỗi bắt đầu bằng `['operations', i]`, schema ban đầu giữ nguyên. Dùng cho thao tác gộp trên canvas, cho một lượt AI và cho kết quả import. Batch được lồng nhau; về ngữ nghĩa, `batch` lồng trong `batch` tương đương dãy bước được trải phẳng.
- **Độ sâu lồng `batch`** tối đa là `MAX_BATCH_DEPTH = 8`. Operation không phải `batch` có độ sâu 0; `batch` có độ sâu bằng 1 cộng độ sâu lớn nhất của các bước, `batch` rỗng có độ sâu 1. `parseOperation` kiểm tra độ sâu **trước** khi kiểm tra hình dạng, bằng vòng lặp không đệ quy: kiểm tra hình dạng đệ quy theo độ sâu, nên input lồng rất sâu sẽ làm tràn ngăn xếp thay vì trả lỗi. Vượt giới hạn trả `invalid-shape` tại đường dẫn của `batch` vượt quá. `applyOperation` dùng cùng giới hạn. Mức 8 dư cho mọi tổ hợp đang biết: sâu nhất là một lượt AI hay kết quả import, tức `batch` chứa `batch` của hàm dựng, có độ sâu 2.
- Operation không làm thay đổi gì (ví dụ đổi tên thành chính tên cũ) vẫn thành công; frontend quyết định có ghi vào lịch sử không.
- **Hợp đồng tham chiếu khi không đổi gì:** khi operation không làm thay đổi gì (mọi giá trị trong `changes` bằng giá trị hiện tại, danh sách hoặc vị trí mới bằng giá trị cũ, `batch` rỗng hoặc mọi bước đều không đổi gì), `applyOperation` trả về **đúng tham chiếu** `schema` đầu vào, vẫn kèm nghịch đảo. Frontend nhận biết bằng cách so `schema` trả về với `schema` đầu vào bằng `===`, chi phí O(1). Chiều ngược lại không được bảo đảm: một `batch` thêm rồi xóa cùng phần tử trả tham chiếu mới dù bằng nhau theo cấu trúc. Operation thêm và xóa luôn thay đổi schema.
- Kết quả dùng lại các object không đổi của schema cũ (structural sharing), để frontend so sánh theo tham chiếu khi render.

**Phương án bị loại:** operation riêng cho từng giá trị enum (`addEnumValue`, `renameEnumValue`…): đổi tên giá trị có thể cập nhật luôn giá trị mặc định, nhưng thêm bốn kiểu operation cho một trường hợp hiếm. Operation "thô" kiểu `setTable` thay cả bảng kèm cột: tool call của AI dễ vô tình xóa cột, và diff khó đọc.

### Xóa kéo theo phần phụ thuộc

| Operation | Tác động kèm theo |
|---|---|
| `removeTable` | Xóa mọi cột của bảng, mọi index của bảng, mọi quan hệ có bảng ở một trong hai đầu |
| `removeColumn` | Bỏ cột khỏi `columnIds` và khóa chính của bảng; xóa **toàn bộ** index và quan hệ có dùng cột |
| `removeSubjectArea` | Đặt `subjectAreaId` của các bảng thành viên về `null` |
| `removeEnum` | Bị từ chối với `enum-in-use` nếu còn cột dùng enum |
| `removeRelation`, `removeIndex`, `removeNote` | Không có |

- Index và quan hệ bị xóa nguyên vẹn thay vì bỏ riêng cột bị xóa, giống PostgreSQL khi `DROP COLUMN`. Bỏ một cột khỏi index unique nhiều cột sẽ âm thầm làm ràng buộc chặt hơn; bỏ một cặp khỏi khóa ngoại nhiều cột làm đổi nghĩa khóa ngoại. Xóa nguyên vẹn thì dễ đoán, và undo khôi phục tất cả.
- Enum đang dùng bị từ chối thay vì kéo theo: không có kiểu thay thế nào đúng cho các cột đó. Frontend tìm các cột đang dùng enum để báo cho người dùng.
- Tham chiếu treo không bao giờ xảy ra; mọi trường hợp khác (đổi kiểu cột đang có quan hệ, đổi precision đang có giá trị mặc định) để lại issue ngữ nghĩa, không kéo theo.

### Operation nghịch đảo

```ts
function applyOperation(
  schema: SchemaDocument,
  operation: Operation,
): Result<{ readonly schema: SchemaDocument; readonly inverse: Operation }, OperationError>;
```

- `applyOperation` tính operation nghịch đảo từ schema **trước** khi áp. Hợp đồng: nếu `applyOperation(s0, op)` trả `{ schema: s1, inverse }` thì `applyOperation(s1, inverse)` thành công và trả về schema bằng `s0` theo cấu trúc (thứ tự khóa của map không có ý nghĩa).
- Operation người dùng, AI hay importer tạo ra chỉ mang ý định. Cặp `{ operation, inverse }` được lưu vào lịch sử mang đủ thông tin để undo và redo. Đây là cách spec hiểu quy tắc "operation mang đủ thông tin để undo" trong `core.md`.

| Operation | Nghịch đảo |
|---|---|
| `addX` | `removeX` |
| `updateX`, `renameSchema` | Cùng loại, với giá trị cũ của đúng các trường đã đổi |
| `setPrimaryKey`, `moveColumn`, `moveElements` | Cùng loại, với danh sách, vị trí cũ |
| `removeTable` | `batch`: `addTable`, `addColumn` từng cột theo thứ tự, `setPrimaryKey`, `addIndex`, `addRelation` cho các phần tử đã bị xóa kèm |
| `removeColumn` | `batch`: `addColumn` tại vị trí cũ, `setPrimaryKey` với khóa chính cũ nếu đã đổi, `addIndex`, `addRelation` |
| `removeSubjectArea` | `batch`: `addSubjectArea`, `updateTable` cho từng bảng thành viên cũ |
| `batch` | `batch` phẳng: nghịch đảo của từng bước theo thứ tự ngược lại; nghịch đảo nào là `batch` thì các bước của nó được chèn thẳng vào |

Nghịch đảo của `batch` được làm phẳng nên mọi nghịch đảo có độ sâu tối đa 1 và luôn áp lại được qua `applyOperation`, kể cả khi operation gốc sâu đúng `MAX_BATCH_DEPTH`. Nếu giữ nguyên cấu trúc lồng, nghịch đảo của một `batch` sâu `d` có thể sâu `d + 1` và bị từ chối khi undo.

**Phương án bị loại:** operation tự mang giá trị cũ (`{ from, to }`). Tool call của AI phải gửi lại giá trị cũ, dễ sai lệch với schema thật, và core vẫn phải kiểm tra giá trị cũ có khớp không.

### Tạo quan hệ n-n bằng một thao tác

```ts
function buildManyToMany(
  schema: SchemaDocument,
  input: {
    readonly leftTableId: TableId;
    readonly rightTableId: TableId;
    readonly junctionTableName: string;
    readonly position: Position;
  },
  generateId: GenerateId,
): Result<Operation /* luôn là batch */, OperationError>;
```

Hàm dựng trả về một `batch` gồm:

1. `addTable` cho bảng trung gian.
2. `addColumn` cho mỗi cột khóa chính của bảng trái rồi bảng phải, theo thứ tự khóa chính: cùng kiểu, không nullable, không mặc định, không auto-increment. Tên cột là `<tên bảng>_<tên cột khóa chính>`; tên trùng (so không phân biệt hoa thường, mục 7) với tên đã sinh trước đó thì thêm hậu tố `_2`, `_3`… (số nhỏ nhất chưa dùng). Hai đầu cùng là bảng `users` có khóa chính `id` cho `users_id` và `users_id_2`; cách này cũng tránh va chạm giữa hai bảng khác nhau (bảng `a_b` cột `c` và bảng `a` cột `b_c`). Tên dài quá 63 byte không bị cắt mà thành issue `name-too-long`.
3. `setPrimaryKey` gồm toàn bộ các cột vừa tạo.
4. Hai `addRelation` kiểu `oneToMany` từ bảng trung gian tới từng bảng hai đầu, `onDelete: 'cascade'`, `onUpdate: 'noAction'`.

Bảng ở một đầu không có khóa chính thì trả lỗi `primary-key-missing`. Batch được áp bằng `applyOperation` và ghi vào lịch sử như một mục, nên undo trong một bước. Sau đó người dùng thêm cột vào bảng trung gian như bảng thường.

**Vì sao là hàm dựng, không phải kiểu operation riêng:** một operation `addManyToMany` sẽ phải tự suy ra cột từ khóa chính lúc áp, và cần số lượng id thay đổi theo số cột khóa chính, trong khi `applyOperation` không được sinh id. Nghịch đảo của nó cũng chỉ là một batch. Hàm dựng giữ `applyOperation` thuần và xác định, còn tool n-n của AI gọi cùng hàm dựng này.

### Tạo quan hệ kèm cột khóa ngoại

```ts
function buildRelation(
  schema: SchemaDocument,
  input: {
    readonly fromTableId: TableId;
    readonly toTableId: TableId;
    readonly kind: Relation['kind'];
    readonly onDelete: ReferentialAction;
    readonly onUpdate: ReferentialAction;
  },
  generateId: GenerateId,
): Result<Operation /* luôn là batch */, OperationError>;
```

Hộp thoại tạo quan hệ 1-1, 1-n của editor tự tạo cột khóa ngoại khớp khóa chính của bảng được tham chiếu. Hàm dựng trả về một `batch` gồm:

1. `addColumn` cho mỗi cột khóa chính của bảng đích, theo thứ tự khóa chính, chèn vào cuối bảng nguồn:
   - Tên `<tên bảng đích>_<tên cột khóa chính>`; trùng (so không phân biệt hoa thường) với cột có sẵn của bảng nguồn hoặc với tên vừa sinh thì thêm hậu tố `_2`, `_3`… như ở n-n.
   - Kiểu chép từ cột được tham chiếu; không mặc định, không auto-increment, comment rỗng.
   - Nullable khi `onDelete` hoặc `onUpdate` là `setNull`, ngược lại không nullable.
   - `isUnique` khi `kind` là `oneToOne` và khóa chính chỉ có một cột.
2. `addRelation` với các cặp ghép cột mới với cột khóa chính theo thứ tự khóa chính.
3. Khi `kind` là `oneToOne` và khóa chính có từ hai cột: `addIndex` unique trên bảng nguồn gồm các cột mới, tên lấy từ `suggestIndexName`.

- Lỗi, theo thứ tự: `table-not-found` tại `['fromTableId']` rồi tại `['toTableId']`; `primary-key-missing` tại `['toTableId']` khi bảng đích không có khóa chính.
- Id sinh theo thứ tự: các cột mới, quan hệ, index (nếu có).
- Quan hệ tự tham chiếu (`fromTableId === toTableId`) hợp lệ.
- Kết quả không phát sinh issue mới, trừ tên cột quá 63 byte và trường hợp `setDefault`: cột mới chưa có giá trị mặc định nên còn issue `relation-set-default-without-default` cho tới khi người dùng đặt. Hàm dựng không tự bịa giá trị mặc định.
- Quan hệ dùng cột khóa ngoại có sẵn vẫn là `addRelation` thường. Chọn hàm dựng thay vì kiểu operation riêng vì cùng lý do với `buildManyToMany`.

### Lịch sử undo/redo

```ts
type HistoryEntry = { readonly operation: Operation; readonly inverse: Operation };
type History = { readonly past: readonly HistoryEntry[]; readonly future: readonly HistoryEntry[] };

function recordEntry(history: History, entry: HistoryEntry, limit: number): History;
function mergeLastEntry(history: History, entry: HistoryEntry): History;
function undo(history: History, schema: SchemaDocument): { readonly history: History; readonly schema: SchemaDocument } | null;
function redo(history: History, schema: SchemaDocument): { readonly history: History; readonly schema: SchemaDocument } | null;
```

- Cấu trúc lịch sử và các hàm thuần nằm trong core: ghi một mục thì xóa `future` và cắt `past` theo `limit`; undo áp `inverse`, redo áp lại `operation` và cập nhật `inverse` mới. `null` khi không còn gì để undo hoặc redo.
- `mergeLastEntry` thay mục cuối của `past` bằng một mục gộp, để một chuỗi sửa liên tục undo trong một bước. `operation` của mục gộp là `batch` gồm các bước của operation cũ rồi của operation mới; `inverse` là `batch` gồm các bước của nghịch đảo mới rồi của nghịch đảo cũ. Các bước của một `batch` là `operations` của nó, của operation khác là chính nó. Trải phẳng một cấp như vậy nên gộp nhiều lần (mỗi phím gõ) không làm `batch` lồng sâu thêm. Gộp xóa `future` và không làm `past` dài thêm nên không nhận `limit`; khi `past` rỗng thì giống `recordEntry`.
- Frontend (store Zustand, phần 3) giữ đối tượng `History`, chọn `limit`, quyết định khi nào gộp thao tác bằng `mergeLastEntry` (ví dụ gõ tên liên tục thành một mục) và khi nào xóa lịch sử (mở schema khác, nhận bản cloud khi xung đột).
- Vì mọi thay đổi đều đi qua lịch sử, áp `inverse` thất bại là lỗi lập trình, nên được throw.

**Lý do:** tính chất "undo rồi redo trả về đúng trạng thái" gắn chặt với operation nghịch đảo, nên được test cùng chỗ với operation và tính vào coverage của core. Các hàm không phụ thuộc React hay Zustand.

**Phương án bị loại:** toàn bộ lịch sử viết trong store của frontend: chạy được, nhưng logic thuần nằm ngoài core và phải test lại qua store. Lưu snapshot toàn bộ schema: trái ED-13.

## 10. Id

```ts
type TableId = `tbl_${string}`;
type ColumnId = `col_${string}`;
type RelationId = `rel_${string}`;
type IndexId = `idx_${string}`;
type EnumId = `enum_${string}`;
type SubjectAreaId = `area_${string}`;
type NoteId = `note_${string}`;

type GenerateId = () => string; // trả về token không trùng

function createTableId(generateId: GenerateId): TableId; // tương tự cho các loại khác
```

- Id gồm tiền tố theo loại và một token do bộ sinh id được truyền vào tạo ra. Frontend và backend truyền hàm sinh token ngẫu nhiên (ví dụ `crypto.randomUUID`); test truyền bộ đếm để id xác định.
- **Core chỉ giả định về token:** không rỗng, chỉ gồm `A–Z`, `a–z`, `0–9`, `_`, `-`, toàn bộ id dài tối đa 64 ký tự, và không trùng trong một tài liệu. Core không giả định token sắp xếp được hay mang thời gian.
- `applyOperation` không bao giờ sinh id: operation đã mang sẵn id đầy đủ, nên áp lại một operation (redo) cho đúng cùng id. Chỉ hàm dựng (`buildManyToMany`, `buildRelation`), importer (phần 7) và code test (qua `createCounterIdGenerator`) nhận `GenerateId`.
- `parseSchemaDocument` kiểm tra id đúng tiền tố và định dạng, nên khóa như `__proto__` hay `constructor` không bao giờ lọt vào map.

**Lý do:**

- Kiểu template literal phân biệt `TableId` với `ColumnId` lúc biên dịch mà không cần ép kiểu `as`. Hàm type guard kiểm tra tiền tố thật lúc chạy, nên việc thu hẹp kiểu là trung thực.
- Tiền tố làm id không trùng giữa các loại phần tử. React Flow cần id node không trùng giữa bảng và ghi chú, và `moveElements` phân biệt được bảng với ghi chú.
- Id đọc được khi debug và khi xem file JSON.

**Phương án bị loại:** id là `string` thuần: không có gì ngăn truyền nhầm id cột vào chỗ cần id bảng. Branded type (`string & { __brand: 'TableId' }`): cần ép kiểu, hoặc type guard không kiểm tra được loại id lúc chạy.

## 11. Version, migration và dữ liệu không tin cậy

### Trường `version` và migration

- `version` là số nguyên, bắt đầu từ 1. Core export `CURRENT_SCHEMA_VERSION`.
- **Mọi thay đổi định dạng đều tăng `version`**, kể cả thay đổi chỉ thêm (một `kind` kiểu dữ liệu mới). Nhờ vậy frontend cũ đang được cache gặp tài liệu mới sẽ báo `version-unsupported` rõ ràng, thay vì `invalid-shape`.
- Mỗi lần tăng version có một bước migration thuần từ `n` sang `n + 1`, kể cả khi bước đó không đổi dữ liệu. Bước migration làm việc trên JSON chưa có kiểu (thu hẹp từ `unknown` vừa đủ), vì core không giữ lại type của các version cũ. Mỗi bước có test với fixture của version cũ.
- Không hỗ trợ đọc tài liệu mới hơn core đang chạy.
- **Operation không có version riêng**, nó gắn với version của tài liệu. Lịch sử operation đã lưu (nếu phần 3 chọn lưu vào Dexie) thuộc version cũ thì bị bỏ khi tài liệu được migrate, không migrate operation.

### Đọc dữ liệu không tin cậy

```ts
function parseSchemaDocument(input: unknown): Result<SchemaDocument, readonly StructuralError[]>;
function parseOperation(input: unknown): Result<Operation, readonly StructuralError[]>;
```

`parseSchemaDocument` chạy theo thứ tự:

1. `input` là object có `version` là số nguyên ≥ 1, nếu không trả `invalid-shape` tại `['version']`.
2. `version` lớn hơn `CURRENT_SCHEMA_VERSION` thì trả `version-unsupported`.
3. Chạy lần lượt các bước migration tới version hiện tại.
4. Kiểm tra hình dạng của version hiện tại. Object là strict: trường thừa bị từ chối, để file xuất ra rồi nhập lại giống hệt và không mang theo dữ liệu lạ.
5. Kiểm tra toàn bộ bất biến cấu trúc. Chỉ chạy khi bước 4 qua, và trả về mọi lỗi tìm được.

Issue ngữ nghĩa không nằm trong parse: tài liệu còn issue vẫn mở được. `parseOperation` chỉ kiểm tra độ sâu lồng `batch` (mục 9) rồi hình dạng; tham chiếu được kiểm tra khi áp.

**Nơi dùng:**

| Nơi | Hàm |
|---|---|
| Đọc schema từ IndexedDB (phần 3) | `parseSchemaDocument` |
| Import JSON, IE-04 (phần 7) | `parseSchemaDocument` |
| Backend nhận schema và đọc lại từ PostgreSQL (phần 4) | `parseSchemaDocument` |
| Mở schema qua link chia sẻ, khôi phục phiên bản (phần 8) | `parseSchemaDocument` |
| Frontend nhận operation do AI đề xuất từ backend (phần 5) | `parseOperation` |

Input của core là giá trị đã qua `JSON.parse`. Giới hạn kích thước file import và request body được áp ở biên, trước khi parse JSON (`security.md`). Thời gian parse tỉ lệ tuyến tính với kích thước input; độ sâu lồng `batch` bị giới hạn.

### Thư viện kiểm tra hình dạng: Zod

**Quyết định:** dùng Zod làm runtime dependency của entry chính, cho bước kiểm tra hình dạng của tài liệu và operation. Spec phần 7 (import) thêm `@dbml/core` làm runtime dependency của subpath importer SQL và DBML; entry chính không import `@dbml/core`. Type của model suy ra từ schema Zod (`z.infer`), không khai báo lại. Bất biến cấu trúc và issue ngữ nghĩa vẫn viết tay, để kiểm soát mã lỗi và tách khỏi bước kiểm tra hình dạng. Thông báo lỗi của Zod không được dùng: core chuyển mỗi lỗi của Zod thành `invalid-shape` kèm `path`. Plan chọn phiên bản Zod trùng với phiên bản Vercel AI SDK dùng ở phần 5.

**Đối chiếu với quy tắc "chỉ thêm dependency khi tự viết rõ ràng tệ hơn":**

- Vercel AI SDK, đã chốt ở `architecture.md`, khai báo tham số tool bằng Zod. Nếu core tự viết validator, backend phải khai báo lại hình dạng của từng operation bằng Zod, tức là hai nguồn cho cùng một định dạng, trái quy tắc một nguồn cho mỗi type trong `typescript.md`. Có Zod trong core, phần 5 suy ra tham số tool từ schema operation của core.
- Tự viết kiểm tra hình dạng cho 19 kiểu dữ liệu, 26 loại operation và 7 loại phần tử, kèm đường dẫn lỗi chính xác, là hàng trăm dòng code dễ sai và phải test riêng.
- Zod thuần, chạy được cả trình duyệt và Node, không có dependency.

**Zod dưới CSP chặt.** Zod 4 biên dịch validator của object bằng `new Function` (JIT) ở nhánh nhanh, trong khi CSP của frontend chặt, dựa trên nonce. `z.config({ jitless: true })` tắt JIT, đồng thời bỏ cả phép thử `new Function("")` mà Zod dùng để dò môi trường, nên không phát sinh báo cáo `securitypolicyviolation`. Đã kiểm chứng trên Zod 4.6.4 và 4.6.5: với `jitless`, parse vẫn đúng và không lần nào gọi `Function`.

- Core không gọi `z.config`, vì đó là state toàn cục thuộc về consumer, và không dùng API chỉ chạy được khi có JIT.
- Consumer chạy dưới CSP chặt gọi `z.config({ jitless: true })` một lần ở điểm khởi động, trước khi import `@schemaforge/core` hay bất kỳ module nào tạo schema Zod. Zod đọc `jitless` và chạy phép thử `new Function("")` khi tạo schema chứ không phải khi parse, còn core tạo schema lúc module được import, nên gọi sau các import tĩnh là đã muộn. Cách làm thực tế là một module nhỏ chỉ đặt cấu hình và được import đầu tiên. Frontend làm việc này ở phần 3.
- Core có một file test chạy dưới `jitless`: parse tài liệu, trả cùng lỗi cấu trúc, parse và áp operation, và không dựng `Function`.

**Phương án bị loại:** tự viết validator (lý do ở trên). JSON Schema với Ajv: Ajv luôn sinh code validator và chạy nó bằng `new Function`, không có chế độ tắt như `jitless` của Zod; muốn chạy dưới CSP chặt phải biên dịch trước thành code standalone, thêm một bước sinh code vào build của core. AI SDK cũng vẫn cần Zod hoặc một lớp chuyển đổi.

## 12. Public API và cấu trúc module

Phần 1 (Scaffold & tooling) chốt cách build và cơ chế export của core. Spec này chỉ nêu core có những entry point nào.

### Entry point

| Entry point | Nội dung | Ai dùng |
|---|---|---|
| Chính (`src/index.ts`) | Type của model, operation, issue, lỗi; `Result`; `CURRENT_SCHEMA_VERSION`; `createEmptySchema`; các hàm tạo id; hàm sắp xếp xác định; `parseSchemaDocument`, `parseOperation`, `MAX_BATCH_DEPTH`; `applyOperation`; `validateSchema`, `findIntroducedIssues`; `buildManyToMany`, `buildRelation`, `suggestIndexName`; `recordEntry`, `mergeLastEntry`, `undo`, `redo`; danh sách hằng `ISSUE_CODES` và `ERROR_CODES` để frontend kiểm tra đủ bản dịch `vi`, `en` | frontend, backend |
| Testing (`@schemaforge/core/testing`) | Factory `make*`, `buildSchema`, `createCounterIdGenerator`, `unwrapOk`, `unwrapError`, `createSampleSchema` | test của core, frontend, backend |

- Entry point testing được xuất bản thành subpath `@schemaforge/core/testing`, để frontend và backend dựng dữ liệu test mà không cần fast-check. File trong `src/testing/` không import `vitest`, helper báo lỗi bằng `throw`. Entry point chính không import `src/testing/`.
- Arbitrary của fast-check là nội bộ của core: không export qua entry point nào và bị loại khỏi build, để `dist/` không chứa file import dev dependency.
- Entry point chính không còn `PRODUCT_NAME`, hằng giữ chỗ của phần 1: tên sản phẩm không phải khái niệm của schema. Frontend có hằng `APP_NAME` riêng; backend ghi log `CURRENT_SCHEMA_VERSION` khi khởi động, nên bản build của backend vẫn dùng thật một export của core.

Schema Zod của operation chưa được export ở phần 2; phần 5 export khi cần làm tham số tool. Generator (phần 6) và importer (phần 7) thêm entry point của chúng khi làm.

### Cấu trúc thư mục

```text
packages/core/src/
  index.ts
  result.ts
  model/        ids.ts, position.ts, column-type.ts, column-default.ts, column.ts, table.ts,
                relation.ts, table-index.ts, enum.ts, subject-area.ts, note.ts,
                schema-document.ts, create-empty-schema.ts, ordering.ts
  parse/        parse-schema-document.ts, parse-operation.ts, migrations.ts, structural-invariants.ts
  validation/   validate-schema.ts, issue-codes.ts, find-introduced-issues.ts,
                rules/ (names.ts, columns.ts, column-defaults.ts, relations.ts, enums.ts)
  operations/   operation.ts, apply-operation.ts, table-operations.ts, column-operations.ts,
                relation-operations.ts, index-operations.ts, enum-operations.ts,
                subject-area-operations.ts, note-operations.ts, move-elements.ts, batch.ts,
                build-many-to-many.ts, build-relation.ts, suggest-index-name.ts
  history/      history.ts, merge-last-entry.ts
  testing/      index.ts, factories.ts, unwrap-result.ts, sample-schema.ts,
                arbitraries.ts, operation-plans.ts
```

- Schema Zod nằm cạnh type tương ứng trong `model/` và `operations/operation.ts`.
- File model của index tên `table-index.ts` để không nhầm với barrel `index.ts`.
- Sau này: `generators/<đích>/` (phần 6), `importers/<định dạng>/` (phần 7).
- Test đặt cạnh file: `<name>.test.ts`.

## 13. Chiến lược test

Runner là Vitest (`architecture.md`). Coverage tối thiểu 90% số dòng cho `packages/core`.

**Factory và fixture** (`src/testing/`):

- `makeTable`, `makeColumn`, `makeRelation`… trả về phần tử có giá trị mặc định hợp lý; test chỉ ghi đè trường nó quan tâm.
- `buildSchema` dựng tài liệu từ các phần tử: ghép các map rồi đưa qua `parseSchemaDocument`, throw nếu sai cấu trúc, nên không thể tạo ra tài liệu sai cấu trúc. Factory không áp operation, để test của rule validation và của từng nhóm operation viết được trước khi `applyOperation` hoàn chỉnh. Id do test truyền vào hoặc lấy từ bộ đếm `createCounterIdGenerator`, nên xác định.
- `unwrapOk`, `unwrapError` lấy giá trị hoặc lỗi của `Result`, throw khi gặp nhánh còn lại.
- `createSampleSchema()`: một schema hợp lệ dùng mọi khái niệm: khóa chính và khóa ngoại nhiều cột, quan hệ 1-1, bảng trung gian n-n có thêm cột, quan hệ tự tham chiếu, enum làm kiểu cột kèm giá trị mặc định, index unique nhiều cột, cả hai biểu thức mặc định, kiểu custom, subject area, ghi chú. Dựng bằng operation và `buildManyToMany`, áp qua `applyOperation`. Là hàm thay vì hằng vì hằng cấp module phải viết `UPPER_SNAKE_CASE` và import entry point testing không nên chạy chuỗi operation; mỗi lần gọi trả schema bằng nhau theo cấu trúc. Phần 6 dùng lại cho snapshot test của generator.

**Test theo operation:** với mỗi loại operation có test cho trường hợp thành công, cho từng mã lỗi điều kiện, cho tác động kèm theo khi xóa, và cho nghịch đảo. Mỗi loại operation có test trả đúng tham chiếu `schema` đầu vào khi không đổi gì. `batch` có test lỗi ở bước giữa (trả đúng `path` và schema ban đầu giữ nguyên), test nghịch đảo phẳng, và test độ sâu: sâu đúng `MAX_BATCH_DEPTH` được chấp nhận, sâu hơn bị từ chối, input lồng rất sâu trả lỗi thay vì throw. `buildManyToMany` có test cho khóa chính nhiều cột, hai đầu cùng một bảng, tên cột trùng, và bảng không có khóa chính. `buildRelation` có test cho khóa chính nhiều cột, 1-1 một cột và nhiều cột, `setNull`, tên cột trùng, quan hệ tự tham chiếu, và bảng đích không có khóa chính. `mergeLastEntry` có test undo và redo mục gộp trong một bước, và `batch` vẫn phẳng sau nhiều lần gộp.

**Test theo rule:** với mỗi mã issue có một test gây ra issue (kiểm tra đúng `code` và `path`) và một test ở ngưỡng không gây ra (ví dụ tên đúng 63 byte có chữ tiếng Việt, tên 64 byte). Mỗi tiêu chí "Core báo lỗi…" của ED-01 đến ED-05 có test đặt tên theo tiêu chí.

**Test parse:** mỗi mã bất biến cấu trúc, trường thừa, version mới hơn, khóa `__proto__`, `createSampleSchema()` qua `JSON.stringify` rồi `JSON.parse` vẫn parse được và bằng bản gốc.

**Property test** bằng fast-check (dev dependency). Arbitrary sinh tài liệu đúng cấu trúc và chuỗi operation hợp lệ với tài liệu đó (tham chiếu tới id có thật), kèm một phần operation cố ý sai. Các tính chất:

1. Áp thành công thì kết quả qua được kiểm tra bất biến cấu trúc.
2. Áp rồi áp nghịch đảo cho schema bằng bản gốc theo cấu trúc.
3. Áp, nghịch đảo, rồi áp lại operation gốc cho đúng kết quả của lần áp đầu (redo).
4. Áp thất bại thì trả lỗi và input không đổi.
5. `validateSchema` cho cùng kết quả khi thứ tự khóa của các map bị xáo trộn.

fast-check chạy với seed cố định trong CI và in seed khi thất bại, để test xác định theo `testing.md`.

**Lý do chọn fast-check:** lỗi khó thấy nhất của phần này nằm ở tổ hợp tác động kèm theo và nghịch đảo (xóa cột đang nằm trong khóa chính, index và hai quan hệ cùng lúc). Liệt kê tay các tổ hợp không đủ. fast-check là dev dependency nên không vướng quy tắc runtime dependency, nhưng vẫn là một lựa chọn thư viện cần ghi vào `architecture.md`. **Phương án bị loại:** chỉ test theo bảng liệt kê tay trên vài fixture.

## 14. Khả năng biểu diễn cho các phần sau

| Phần | Cần gì từ model | Model đáp ứng bằng |
|---|---|---|
| 3 Editor | Bảng, cột, quan hệ, index, enum, comment trên canvas; vị trí; tạo quan hệ kèm cột khóa ngoại; undo/redo, gộp thao tác liên tục, bỏ qua thao tác không đổi gì; nhiều schema trong trình duyệt; chạy dưới CSP chặt | Mục 1–6; `moveElements`; `buildRelation`, `buildManyToMany`; `History`, `mergeLastEntry`; hợp đồng tham chiếu khi không đổi gì; `name` trong tài liệu cho màn hình danh sách; `parseSchemaDocument` khi đọc IndexedDB; Zod `jitless` |
| 4 Lưu cloud | Validate trước khi lưu; lưu JSONB | Tài liệu là JSON thuần; `parseSchemaDocument`; không phụ thuộc thứ tự khóa |
| 5 AI | Tool call ánh xạ sang operation; từ chối khi không hợp lệ; diff; undo được | Operation chi tiết; `batch`; `findIntroducedIssues`; `parseOperation`; diff đọc từ danh sách operation |
| 6 SQL DDL | Khóa chính, khóa ngoại nhiều cột, hành động, index, enum, comment, mặc định, auto-increment | Mục 3–6; ánh xạ kiểu ở mục 3 |
| 6 Prisma, Drizzle | Quan hệ 1-1 có unique, model trung gian tường minh, `@default(now())`, `uuid()`, `autoincrement()`, `@@id`, `@@unique`, `@@index`, enum | `relation-one-to-one-not-unique`; bảng trung gian thật; biểu thức mặc định; khóa chính dạng mảng; index |
| 6 TypeScript, Zod, OpenAPI | Nullable, enum, kiểu nguyên thủy và format (`uuid`, `date`, `date-time`) | `isNullable`; `enum.values`; kiểu `uuid`, `date`, `timestamp`, `timestamptz` |
| 6 Seed data | Kiểu, nullable, unique, enum, khóa ngoại, thứ tự bảng theo quan hệ | Mục 3–5; đồ thị quan hệ `fromTableId` → `toTableId` |
| 6 DBML, Markdown | `TableGroup`, `Note`, enum, index, `Ref` kèm hành động, comment | Subject area; ghi chú; mục 5–6 |
| 7 Import | Kiểu riêng của dialect; default SQL; khóa nhiều cột; id mới; undo được | Kiểu chung hoặc `custom`; literal, biểu thức, hoặc diagnostic; `GenerateId`; kết quả là `batch` |
| 7 Export JSON | File JSON nhập lại giống hệt | Mọi trường luôn có mặt; object strict; so sánh theo cấu trúc. Hàm ghi JSON với thứ tự khóa ổn định thuộc phần 7 |
| 8 Lịch sử phiên bản | Lưu và khôi phục một phiên bản | Tài liệu JSON thuần có `version`, migrate khi đọc |
| 9 Hoàn thiện | Subject area, ghi chú, auto-layout undo được, template hợp lệ | Mục 6; `moveElements`; `validateSchema` rỗng |

## Tiêu chí hoàn thành

- [ ] Type của mọi phần tử, `ColumnType`, `ColumnDefault`, `Operation`, `Issue`, `OperationError` được export từ entry point chính và suy ra từ schema Zod.
- [ ] `parseSchemaDocument` chấp nhận `createSampleSchema()` sau khi qua `JSON.stringify` và `JSON.parse`, và kết quả bằng bản gốc.
- [ ] `parseSchemaDocument` từ chối, đúng mã và đúng `path`, mọi trường hợp trong danh mục bất biến cấu trúc, cùng trường thừa, version mới hơn và khóa `__proto__`.
- [ ] `validateSchema` trả đúng `code` và `path` cho mọi mã trong danh mục issue ngữ nghĩa; `createSampleSchema()` không có issue.
- [ ] Cả 26 loại operation được cài đặt, mỗi loại trả về nghịch đảo đúng bảng ở mục 9.
- [ ] Operation không làm thay đổi gì trả về đúng tham chiếu `schema` đầu vào, kèm nghịch đảo.
- [ ] Xóa kéo theo đúng bảng ở mục 9; `removeEnum` khi enum đang dùng bị từ chối với `enum-in-use`.
- [ ] `batch` lỗi ở một bước thì trả lỗi có `path` bắt đầu bằng `['operations', i]` và không thay đổi schema.
- [ ] Nghịch đảo của `batch` là `batch` phẳng, độ sâu tối đa 1; `parseOperation` và `applyOperation` từ chối `batch` sâu hơn `MAX_BATCH_DEPTH` bằng `invalid-shape` mà không throw, kể cả với input lồng rất sâu.
- [ ] `buildManyToMany` tạo bảng trung gian có khóa chính nhiều cột và hai quan hệ 1-n; áp nghịch đảo của batch trả về schema ban đầu.
- [ ] `buildRelation` tạo cột khóa ngoại khớp khóa chính của bảng đích, quan hệ, và index unique cho 1-1 nhiều cột; trả `primary-key-missing` khi bảng đích không có khóa chính; áp nghịch đảo của batch trả về schema ban đầu.
- [ ] `undo` rồi `redo` trả về đúng schema trước và sau thao tác; ghi mục mới xóa `future`.
- [ ] `mergeLastEntry` gộp mục cuối thành một mục mà một lần `undo` hoàn tác và một lần `redo` áp lại cả hai thay đổi; gộp xóa `future`; `batch` vẫn phẳng sau nhiều lần gộp.
- [ ] `findIntroducedIssues` chỉ trả issue mới, không trả issue đã có sẵn.
- [ ] Cả năm tính chất property test qua với seed cố định.
- [ ] Mỗi tiêu chí "Core báo lỗi…" của ED-01 đến ED-05 có test đặt tên theo tiêu chí và test đó qua.
- [ ] Entry chính của `packages/core` chỉ có runtime dependency là Zod, không dùng API riêng của trình duyệt hay Node, coverage số dòng ≥ 90%. (Subpath importer SQL và DBML thêm `@dbml/core`, chốt ở spec phần 7.)
- [ ] Core không gọi `z.config`; test chạy dưới `z.config({ jitless: true })` parse và áp operation đúng mà không dựng `Function`.
- [ ] Entry point `@schemaforge/core/testing` export factory, `buildSchema`, `createCounterIdGenerator`, `unwrapOk`, `unwrapError`, `createSampleSchema`; `dist/` không chứa arbitrary của fast-check; entry point chính không còn `PRODUCT_NAME`.
- [ ] `architecture.md` ghi các quyết định mới (định dạng model chi tiết, Zod trong core, fast-check); `roadmap.md` cập nhật trạng thái phần 2.

## Phạm vi

**Trong phạm vi:** type và schema Zod của model và operation; id; `parseSchemaDocument`, `parseOperation` và khung migration (version 1 chưa có bước migration nào); `validateSchema`, `findIntroducedIssues`; `applyOperation` cho mọi operation; `buildManyToMany`, `buildRelation`, `suggestIndexName`; hàm sắp xếp xác định; lịch sử undo/redo thuần kèm `mergeLastEntry`; factory, fixture và arbitrary cho test, entry point `@schemaforge/core/testing`; bỏ `PRODUCT_NAME` khỏi core (frontend dùng `APP_NAME` riêng, backend ghi log `CURRENT_SCHEMA_VERSION`).

**Ngoài phạm vi:**

- Code generator và diagnostic theo đích (phần 6).
- Importer, hàm ghi file JSON khi export (phần 7).
- Giao diện editor, subject area, ghi chú (phần 3, 9).
- Lưu local, lưu cloud, lưu lịch sử operation (phần 3, 4).
- Định nghĩa tool, prompt và hiển thị diff của AI (phần 5).
- Lưu phiên bản (phần 8).
- Cách build và cơ chế export của core (phần 1).

**Chưa có trong model**, vì không tính năng nào cần; importer báo là không hỗ trợ: view, check constraint, sequence, trigger, cột tính toán, nhiều namespace (`schema` của PostgreSQL), chiều sắp xếp và loại index, collation, kiểu mảng chung, màu bảng và nhóm, kích thước ghi chú. Thêm khái niệm nào sau này thì tăng `version` và có bước migration.

## Câu hỏi còn mở

| # | Câu hỏi | Chốt ở phần |
|---|---|---|
| 1 | ST-03 ghi "từ chối schema không hợp lệ". Spec này đề xuất backend chỉ từ chối tài liệu sai cấu trúc và vẫn lưu tài liệu còn issue ngữ nghĩa, để tự động lưu không làm mất bản đang sửa dở. Cần xác nhận và sửa lại tiêu chí ST-03 | 4 |
| 2 | Chế độ chặt của AI kiểm tra theo từng tool call hay theo cả lượt, và lỗi được trả lại cho model thế nào? | 5 |
| 3 | Kết quả import có dùng chế độ chặt (không phát sinh issue mới) như AI không? | 7 |
| 4 | Generator làm gì với schema đúng cấu trúc nhưng còn issue: vẫn sinh kèm cảnh báo hay từ chối? | 6 |
