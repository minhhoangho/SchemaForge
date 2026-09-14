# Plan: Core schema model

Plan triển khai phần 2 trong [roadmap.md](../roadmap.md), dựa trên spec đã duyệt [2026-09-14-core-schema-model-design.md](../specs/2026-09-14-core-schema-model-design.md) (commit 2dadedf). Spec là nguồn gốc: plan chỉ chia việc, chốt các chi tiết mức cài đặt mà spec để lại, và không đổi quyết định nào của spec. Chỗ spec còn hở được nêu ở mục [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan).

## Mục tiêu

`packages/core` có đầy đủ schema model (type suy ra từ Zod), `parseSchemaDocument`, `parseOperation`, `validateSchema`, `findIntroducedIssues`, `applyOperation` cho cả 26 loại operation kèm nghịch đảo, `buildManyToMany`, `suggestIndexName`, hàm sắp xếp xác định, lịch sử undo/redo thuần, factory và fixture cho test, property test bằng fast-check. Đây là nền cho Visual Schema Editor (phần 3) và mọi phần sau, nên đúng đắn đặt lên trước tốc độ.

User đã chấp nhận đề xuất ST-03 của spec: backend chỉ từ chối tài liệu sai cấu trúc, vẫn lưu tài liệu còn issue ngữ nghĩa. Cách viết tiêu chí ST-03 được sửa ở phần 4, không thuộc plan này.

## Điều kiện tiên quyết

- Phần 1 đã xong theo [plan phần 1](2026-09-14-scaffold-tooling-plan.md): `packages/core` là ESM, build bằng `tsc -p tsconfig.build.json` ra `dist/` sau map `exports`; Vitest 5 với ngưỡng 90% số dòng; ESLint 10 với các rule trong spec phần 1; `zod` `^4.6.4` trong catalog; `PRODUCT_NAME` giữ chỗ đang được `frontend/src/app/page.tsx`, `frontend/src/app/layout.tsx` và `backend/src/main.ts` dùng.
- Node 24 qua nvm. Máy dev cài sẵn Node 24.21.0 nhưng mặc định vẫn là 22, nên mọi shell không tương tác phải chạy trong root repo:

  ```bash
  source ~/.nvm/nvm.sh && nvm use
  ```

  `node -v` phải ra `v24.x`.
- Working tree sạch trên `master`, và `pnpm --filter @schemaforge/core test` đang xanh trước khi bắt đầu.

## Cách dùng plan

- Mỗi task giao cho một subagent chưa đọc spec. Prompt của subagent gồm: mục "Quy ước chung", mục "Quyết định mức cài đặt", toàn bộ nội dung task, và đường dẫn spec kèm các mục spec mà task tham chiếu.
- Subagent không commit, không push, không tạo subagent khác. Orchestrator kiểm tra kết quả rồi commit đúng các file của task với commit message ghi trong task (`.claude/rules/git.md`: một dòng, không body, không trailer).
- Task song song chạy trong worktree riêng (`isolation: "worktree"`), vì lệnh typecheck, lint, test của core chạy trên cả package và sẽ đỏ theo file đang viết dở của task khác nếu dùng chung working tree. Trong worktree, việc đầu tiên là `source ~/.nvm/nvm.sh && nvm use && pnpm install --frozen-lockfile`. Orchestrator commit trong worktree, merge về `master` lần lượt từng task, và chạy lại lệnh kiểm tra của core sau mỗi lần merge trước khi merge task tiếp theo.

### Quy ước chung cho mọi task

- Đọc `CLAUDE.md`, `.claude/rules/core.md`, `typescript.md`, `code-quality.md`, `testing.md` và các mục spec mà task tham chiếu trước khi viết file.
- **TDD.** Viết test trước, chạy thấy đỏ, rồi mới cài đặt. Trong vòng đỏ-xanh, chạy riêng file test (không bật coverage nên không vướng ngưỡng):

  ```bash
  pnpm --filter @schemaforge/core exec vitest run src/<đường-dẫn>.test.ts
  ```

- **Chỉ tạo và sửa file có trong mục "File sở hữu" của task.** Cần sửa file khác (kể cả `src/index.ts`, `package.json`, file của task khác) thì dừng và báo orchestrator.
- **Lockfile.** Chỉ Task 1 chạy `pnpm install` có ghi lockfile. Không task nào khác chạy `pnpm add`, `pnpm remove`, `pnpm update` hay `pnpm install` không có `--frozen-lockfile`.
- **Code.** Tiếng Anh cho code, identifier, comment, tên test. Import tương đối có đuôi `.js` (`moduleResolution: nodenext`). Chuỗi trong code dùng nháy kép (Prettier mặc định). Không `as` (trừ `as const`), không `!`, không `any`, không từ khóa `enum`, không default export. Hàm export khai báo kiểu trả về. Boolean (biến, tham số, thuộc tính của type) bắt đầu bằng `is`, `has`, `can`, `should`. Hàm dưới khoảng 40 dòng, file dưới khoảng 300 dòng, lồng tối đa 3 cấp. Không state có thể thay đổi ở cấp module. Không throw với lỗi dự kiến; chỉ throw `Error` cho lỗi lập trình.
- **API bị cấm trong `src/` không phải test:** `TextEncoder`, `structuredClone`, `Date`, `Intl`, `localeCompare`, timer, và mọi global trong `no-restricted-globals` của core. `tsc --noEmit` của core có thể không báo lỗi với các global này (kiểu của Vitest kéo `@types/node` vào), nhưng `pnpm build` sẽ fail.
- **Test.** Import `describe`, `it`, `expect` từ `vitest`. Mỗi test một hành vi, tên là câu tiếng Anh. Không vòng lặp hay `if` trong test; dữ liệu dạng bảng dùng `it.each`. Dựng dữ liệu bằng factory của Task 6 (từ khi có); test không import `src/index.ts`, import thẳng module cần dùng. So sánh schema bằng `toStrictEqual` (xem "Bằng nhau theo cấu trúc").
- **Kiểm tra trước khi báo xong** (trừ khi task ghi khác), chạy ở root repo:

  ```bash
  source ~/.nvm/nvm.sh && nvm use
  pnpm --filter @schemaforge/core typecheck
  pnpm --filter @schemaforge/core lint
  pnpm --filter @schemaforge/core test
  ```

  Kết quả mong đợi: cả ba thoát mã 0; `test` in mọi test pass và không có dòng `ERROR: Coverage for lines (…) does not meet global threshold (90%)`.
- Không để lại file tạm. Khi kết thúc, `git status --porcelain` chỉ còn file của task.
- Báo cáo gồm: file đã tạo hoặc sửa, lệnh đã chạy kèm kết quả chính (số test, % coverage số dòng), vấn đề còn mở.

## Cách xử lý các điểm nóng khi làm song song

| Điểm nóng | Cách xử lý |
|---|---|
| Dispatcher `applyOperation` | Không có stub. Bốn task handler song song (Task 16–19) mỗi task export một hàm vào theo nhóm (`applyTableOperation`, `applyColumnOperation`…) với chữ ký cố định do Task 11 và Task 14 định nghĩa, và test trực tiếp hàm đó. Task 20 tạo `apply-operation.ts` sau khi cả bốn task xong: một `switch` đủ nhánh, gom nhãn `case` theo nhóm và gọi hàm vào của nhóm. Test đi qua `applyOperation` cho mọi loại operation và mọi vòng nghịch đảo liên nhóm nằm ở Task 20 |
| `batch` gọi ngược dispatcher | `applyBatch` nhận hàm áp từng bước làm tham số, nên `batch.ts` không import `apply-operation.ts` (tránh `import-x/no-cycle`) |
| `src/index.ts` | Không task nào sửa trước Task 26. Task 26 viết toàn bộ public API và vẫn giữ `PRODUCT_NAME`; Task 27 bỏ `PRODUCT_NAME` và sửa frontend, backend trong cùng một commit |
| Danh mục mã lỗi và mã issue | Task 2 tạo đủ `ERROR_CODES` (17 mã) và `ISSUE_CODES` (25 mã) theo spec mục 8. Task sau chỉ import. Thiếu mã thì dừng và báo, vì đó là thay đổi spec |
| `validateSchema` gom các rule | Mỗi rule nằm trong file riêng do một task sở hữu. `validate-schema.ts` chỉ được tạo ở Task 15, sau khi mọi rule xong |
| Helper dùng chung giữa các task song song | Tạo trong task nền trước khi các task dùng nó bắt đầu: `document-path.ts` (Task 2), `model/name-limits.ts` (Task 3), `model/column-list-errors.ts` (Task 4), `validation/column-uniqueness.ts` (Task 8), helper của operation (Task 14) |
| `pnpm-lock.yaml`, dependency của core | Chỉ Task 1 thêm `zod` và `fast-check` và ghi lockfile. Task 26 sửa `exports` trong `packages/core/package.json` nhưng không đổi dependency |
| `packages/core/tsconfig.build.json` | Chỉ Task 26 sửa |

## Quyết định mức cài đặt

Các điểm spec để cho plan. Những điểm có dấu "đã kiểm chứng" đã được thử trong thư mục tạm ngoài repo với `zod` 4.6.5, `fast-check` 4.10.0, `typescript` 6.0.3, `@vitest/expect` 5.0.0, trên Node 24.21.0, với tsconfig giống core (`strict`, `noUncheckedIndexedAccess`, `lib: ["ES2023"]`, `types: []`, `nodenext`).

### Phiên bản Zod

- `npm view ai@7.0.99 peerDependencies`, `@ai-sdk/google@4.0.69` và `@ai-sdk/provider-utils@5.0.40` đều khai báo `zod: "^3.25.76 || ^4.1.8"`.
- Catalog phần 1 dùng `zod` `^4.6.4` (quyết định của user trong plan phần 1, thay cho 4.6.5 vì quy tắc `minimumReleaseAge`). Bản này nằm trong khoảng peer của AI SDK, nên core khai báo `"zod": "catalog:"` và backend ở phần 5 dùng cùng một bản Zod.
- `fast-check` `^4.10.0` (phát hành 2026-09-11, đã quá 24 giờ) khai báo trực tiếp trong `devDependencies` của core, không đưa vào catalog vì chỉ core dùng.

### Tên schema Zod

Schema Zod đặt hậu tố `Shape` (`tableShape`, `operationShape`) để không lẫn với "schema" của database. Mỗi phần tử có hai biến: `tableFieldsShape` là `z.strictObject(...)` dùng để `pick`, `omit`, `partial` ở operation; `tableShape = tableFieldsShape.readonly()` dùng để parse. Type suy ra từ `tableShape`: `export type Table = z.infer<typeof tableShape>;`.

### Kiểu id (đã kiểm chứng)

- Dùng `z.templateLiteral([prefix, z.string().regex(tokenPattern)])`. Kiểu suy ra đúng là `` `tbl_${string}` ``, gán `"col_1"` vào `TableId` là lỗi biên dịch, không cần `as`.
- `ZodTemplateLiteral` không có `.max()`. Giới hạn 64 ký tự đưa vào regex của token: `^[A-Za-z0-9_-]{1,N}$` với `N = 64 - prefix.length` (60 cho `tbl_`, `col_`, `rel_`, `idx_`; 59 cho `enum_`, `area_`, `note_`). Lúc chạy, `"tbl_"`, `"tbl_a b"`, `"col_x"`, id 65 ký tự đều bị từ chối.
- Một helper nội bộ `idShape<Prefix extends string>(prefix: Prefix): z.ZodTemplateLiteral<`${Prefix}${string}`>` sinh cả bảy schema.
- Type guard `isTableId(value: string): value is TableId` và `isNoteId` cài bằng `tableIdShape.safeParse(value).success`; `moveElements` dùng chúng để phân biệt bảng và ghi chú.
- `createTableId(generateId)` (và sáu hàm cùng loại) trả `` `tbl_${generateId()}` ``. Token sai giả định của spec mục 10 là lỗi lập trình của bộ sinh id được truyền vào, nên throw `Error`.
- Phương án khác đã thử: `z.string().refine(isTableId)` cũng thu hẹp kiểu, nhưng mã lỗi Zod là `custom` và phải viết regex hai lần. Không dùng.

### Readonly (đã kiểm chứng)

- `.readonly()` trên object và array cho kiểu `Readonly<...>` và `readonly T[]` lồng đúng từng cấp (gán `table.position.x` hay `table.columnIds.push` đều là lỗi biên dịch), và **đóng băng (`Object.freeze`) output lúc chạy**. Tài liệu và operation đi qua parse là bất biến thật; object do handler tạo ra không bị đóng băng nhưng vẫn là `readonly` về kiểu.
- Không đặt `.readonly()` trên từng option của `z.discriminatedUnion`: `ZodReadonly` không phải option phân biệt được và gây lỗi kiểu. Đặt `.readonly()` trên cả union; `Readonly<A | B>` phân phối thành `Readonly<A> | Readonly<B>`. Trường bên trong option (mảng, object con) vẫn dùng `.readonly()` bình thường.
- `.omit()`, `.pick()`, `.partial()` gọi trên `xFieldsShape` (chưa readonly) vẫn giữ strict: trường thừa bị từ chối.
- `.partial()` chấp nhận `{ name: undefined }` từ code TypeScript. JSON không mang được `undefined`, nhưng handler `updateX` phải coi khóa có giá trị `undefined` là không được truyền, và nghịch đảo chỉ chứa khóa có giá trị.

### Union của operation có `batch` đệ quy (đã kiểm chứng)

```ts
const stepOperationShapes = [addTableOperationShape /* …25 shape không phải batch */] as const;
type StepOperation = Readonly<z.infer<(typeof stepOperationShapes)[number]>>;
export type BatchOperation = {
  readonly type: "batch";
  readonly operations: readonly Operation[];
};
export type Operation = StepOperation | BatchOperation;

const batchOperationShape = z.strictObject({
  type: z.literal("batch"),
  operations: z.array(z.lazy((): z.ZodType<Operation> => operationShape)).readonly(),
});
export const operationShape: z.ZodType<Operation> = z
  .discriminatedUnion("type", [...stepOperationShapes, batchOperationShape])
  .readonly();
```

- 25 loại operation có kiểu suy ra từ Zod; `BatchOperation` là kiểu đệ quy duy nhất phải viết tay (TypeScript không suy ra được kiểu đệ quy từ getter; biến thể dùng getter cho lỗi "implicitly has type any").
- Dùng `discriminatedUnion` cho cả `batch`, không dùng `z.union([steps, batch])`: `z.union` gộp lỗi lồng thành `invalid_union` tại `[]`, còn `discriminatedUnion` giữ đường dẫn chính xác, ví dụ `["operations", 1, "type"]` hay `["operations", 0, "columnIds", 1]`.
- `switch` trên `operation.type` thu hẹp đủ 26 nhánh và nhánh `default` nhận `never`. `Extract<Operation, { type: "addTable" }>` dùng được.
- `z.toJSONSchema(operationShape)` chạy được với union đệ quy này, hữu ích cho tool của AI ở phần 5.

### `IdMap`, `noUncheckedIndexedAccess` và khóa `__proto__` (đã kiểm chứng)

- `z.record(tableIdShape, tableShape).readonly()` suy ra `Readonly<Record<TableId, Table>>`. Với `noUncheckedIndexedAccess`, `schema.tables[id]` có kiểu `Table | undefined`, nên mọi lần tra cứu buộc phải kiểm tra. `Object.values(schema.tables)` cho `Table[]` (không có `undefined`). `Object.entries` cho khóa kiểu `string`: lấy id từ `value.id`, không từ khóa.
- Thêm hoặc thay: `{ ...map, [id]: value }` qua được type với khóa generic, nên `withEntry<K extends string, V>(map, id, value)` generic được.
- Xóa: mọi dạng generic theo khóa đều lỗi kiểu (`Object.fromEntries` cho `{ [k: string]: V }`, rest destructuring cho `Omit<…, K>`, `reduce` với `{}`). Dạng không cần `as`: một hàm `withoutIds` với bảy overload, mỗi overload một cặp `IdMap<XId, X>`, và chữ ký cài đặt dùng `Readonly<Record<string, { readonly id: string }>>` với `Object.fromEntries(Object.entries(map).filter(...))`.
- **`z.record` của Zod 4 lặng lẽ bỏ khóa `__proto__`**: input `JSON.parse('{"note_1": {...}, "__proto__": {...}}')` parse thành công và output chỉ còn `note_1`, kể cả khi giá trị của `__proto__` sai hình dạng. Khóa `constructor` thì bị báo `invalid_key`. Vì vậy `parseSchemaDocument` kiểm tra riêng: với mỗi map trong 7 map, `Object.hasOwn(map, "__proto__")` thì trả `invalid-shape` tại `[<tên map>, "__proto__"]`. Object strict (gốc, phần tử, `changes`) tự báo `__proto__` là `unrecognized_keys`. `Object.prototype` không bị ô nhiễm trong mọi trường hợp đã thử.
- Sau parse, mọi khóa map đã khớp định dạng id có tiền tố, nên thao tác map trong operation không thể tạo khóa `__proto__`.

### Chuyển lỗi Zod thành `invalid-shape` (đã kiểm chứng)

Hình dạng issue của Zod 4 đã quan sát:

| Tình huống | `code` của Zod | `path` |
|---|---|---|
| Thiếu trường, sai kiểu, số không hữu hạn (`Infinity`, `NaN`) | `invalid_type` | tới đúng trường |
| `type` hoặc `kind` không biết, thiếu `type` | `invalid_union` (note "No matching discriminator") | tới trường phân biệt, ví dụ `["operations", 1, "type"]` |
| Trường thừa trong object strict | `unrecognized_keys`, có mảng `keys` | tới object chứa |
| Khóa map sai định dạng | `invalid_key` | tới khóa |
| Id sai định dạng | `invalid_format` | tới trường |
| `length: 0`, số ngoài khoảng an toàn | `too_small`, `too_big` | tới trường |
| `length: 1.5` với `z.int()` | `invalid_type` | tới trường |

Hàm `toStructuralErrors(issues)` (Task 5):

1. Mỗi issue thành `{ code: "invalid-shape", path }`, riêng `unrecognized_keys` thành một lỗi cho mỗi khóa với `path` là `[...issue.path, key]`.
2. Bỏ phần tử `symbol` khỏi `path` bằng `filter` có type guard (JSON không có symbol).
3. Bỏ lỗi trùng `path`, rồi sắp theo `path` bằng `sortByPathThenCode`.

Không dùng thông báo của Zod ở bất kỳ đâu.

### Thứ tự đường dẫn

`compareDocumentPaths(a, b)` so từng phần tử: hai số so theo giá trị; hai chuỗi so theo code unit UTF-16 (`<`, `>`), không dùng `localeCompare`; số đứng trước chuỗi; đường dẫn là tiền tố của đường dẫn kia thì đứng trước. `sortByPathThenCode` sắp theo `path` rồi theo `code` (code unit). Dùng cho lỗi của parse, issue của `validateSchema`, và chọn lỗi đầu tiên trong `applyOperation`.

### So tên và độ dài byte

- `utf8ByteLength(text)` đếm theo code point: dưới U+0080 là 1 byte, dưới U+0800 là 2, dưới U+10000 là 3 (kể cả surrogate lẻ, khớp U+FFFD của `TextEncoder`), còn lại là 4. Không dùng `TextEncoder`: không có trong `lib` của core và làm `pnpm build` fail.
- `toNameKey(name) = name.toLowerCase()` là khóa so trùng không phân biệt hoa thường (spec mục 7).
- Sắp theo tên (Task 7): so `toNameKey` theo code unit, bằng nhau thì so tên gốc theo code unit, rồi so id.

### Độ sâu lồng `batch`

- `MAX_BATCH_DEPTH = 8`. Một operation không phải `batch` có độ sâu 0; một `batch` có độ sâu `1 + max(độ sâu các bước)`, `batch` rỗng có độ sâu 1.
- Kiểm tra độ sâu chạy **trước** Zod, bằng một vòng lặp có ngăn xếp tường minh trên input `unknown`. Lý do (đã kiểm chứng): Zod đệ quy theo độ sâu, và 20 000 `batch` lồng nhau làm `safeParse` throw `RangeError: Maximum call stack size exceeded`, trái quy tắc không throw với lỗi dự kiến. Vượt giới hạn trả `invalid-shape` tại đường dẫn của `batch` đầu tiên vượt quá, ví dụ `["operations", 0, "operations", 0, …]`.
- `applyOperation` chạy `parseOperation` trên operation nhận vào (xem Task 20), nên dùng cùng giới hạn.
- **Nghịch đảo của `batch` được làm phẳng**: là một `batch` gồm nghịch đảo của từng bước theo thứ tự ngược lại, trong đó nghịch đảo nào là `batch` thì các bước con của nó được chèn thẳng vào. Nhờ vậy mọi nghịch đảo có độ sâu tối đa 1 và luôn áp lại được qua `applyOperation`, dù operation gốc sâu tới `MAX_BATCH_DEPTH`. Về ngữ nghĩa, `batch` lồng trong `batch` tương đương dãy bước được trải phẳng (áp tuần tự, lỗi một bước thì lỗi cả khối). Xem Vấn đề 3.
- Mức 8 dư cho mọi tổ hợp đang biết: một lượt AI hay kết quả import là `batch` chứa `batch` của `buildManyToMany` (độ sâu 2).

### Tên cột của bảng trung gian n-n

- Tên gốc `<tên bảng>_<tên cột khóa chính>`, sinh theo thứ tự: các cột khóa chính của bảng trái theo thứ tự khóa chính, rồi của bảng phải.
- Tên nào trùng (so bằng `toNameKey`) với tên đã sinh trước đó trong bảng trung gian thì thêm hậu tố `_2`, `_3`… (số nhỏ nhất chưa dùng). Hai đầu là cùng bảng `users` có khóa chính `id` cho `users_id` và `users_id_2`. Cách này cũng xử lý va chạm giữa hai bảng khác nhau, ví dụ bảng `a_b` với cột `c` và bảng `a` với cột `b_c`.
- Không cắt tên dài hơn 63 byte: tên quá dài thành issue `name-too-long` như mọi tên khác.

### Thứ tự các bước trong nghịch đảo của `removeTable` và `removeColumn`

Nghịch đảo được tính trên schema **trước** khi xóa. Thứ tự bảo đảm mọi tham chiếu đã tồn tại khi bước sau được áp:

- `removeTable`: `addTable` (bảng không có `columnIds`, `primaryKeyColumnIds`; subject area của nó vẫn còn) → `addColumn` cho từng cột theo thứ tự `columnIds`, `insertAt` bằng vị trí `i` (mỗi bước chèn vào cuối nên luôn hợp lệ) → `setPrimaryKey` với khóa chính cũ (luôn có, kể cả khi rỗng, đúng bảng ở spec mục 9) → `addIndex` cho từng index đã bị xóa, sắp theo id → `addRelation` cho từng quan hệ đã bị xóa, sắp theo id. Quan hệ tự tham chiếu và quan hệ tới bảng khác đều áp được vì mọi cột hai đầu đã có.
- `removeColumn`: `addColumn` với `insertAt` bằng vị trí cũ (sau khi xóa, mảng dài hơn hoặc bằng vị trí đó) → `setPrimaryKey` với khóa chính cũ, chỉ khi cột nằm trong khóa chính → `addIndex` sắp theo id → `addRelation` sắp theo id.
- Sắp theo id (so code unit) để nghịch đảo không phụ thuộc thứ tự khóa của map.

### Bằng nhau theo cấu trúc (đã kiểm chứng)

Không viết helper riêng. `expect(a).toStrictEqual(b)` của Vitest bỏ qua thứ tự khóa của object, nhưng phân biệt thứ tự mảng và khóa có giá trị `undefined` với khóa không tồn tại. Object bị đóng băng bằng object thường cùng nội dung. Đó đúng là "bằng nhau theo cấu trúc" của spec mục 9. Trong property test, gọi `expect` bên trong callback của `fc.property`: lỗi được throw ra, fast-check báo property thất bại kèm seed.

### Entry point testing

- Xuất bản subpath `@schemaforge/core/testing` (Task 26): các hàm `make*`, `buildSchema`, `createCounterIdGenerator`, `unwrapOk`, `unwrapError`, `createSampleSchema`. Frontend và backend dùng được trong test mà không cần `fast-check`.
- Arbitrary của fast-check (`src/testing/arbitraries.ts`, `src/testing/operation-plans.ts`) là nội bộ: không export qua entry point nào, và được thêm vào `exclude` của `tsconfig.build.json` để `dist/` không chứa file import dev dependency.
- Không file nào trong `src/testing/` import `vitest`: helper báo lỗi bằng `throw new Error(...)`.
- Entry point chính không import `src/testing/`.

### Seed của fast-check (đã kiểm chứng)

- `src/testing/arbitraries.ts` export `PROPERTY_SEED = 20260914` và `PROPERTY_RUNS = 200`. Mọi property gọi `fc.assert(property, { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS })`.
- Khi thất bại, fast-check tự in dòng `{ seed: 20260914, path: "…", endOnFailure: true }` và counterexample. Để tái hiện, tạm thêm `path` vào tham số `fc.assert` (không commit).
- Không đọc seed từ biến môi trường: `process` bị cấm trong core.
- Test property có thể chạy lâu hơn timeout mặc định 5 giây của Vitest; đặt `timeout` riêng cho từng test khi cần, không đổi `vitest.config.ts`.

### `sampleSchema`

Spec gọi fixture là `sampleSchema`. Plan cài thành hàm `createSampleSchema(): SchemaDocument`: quy tắc đặt tên yêu cầu hằng cấp module viết `UPPER_SNAKE_CASE`, và hàm tránh chạy chuỗi operation (có thể throw) ngay khi import entry point testing. Mỗi lần gọi trả về schema bằng nhau theo cấu trúc.

### Thay `PRODUCT_NAME`

- Core bỏ `PRODUCT_NAME`: tên sản phẩm không phải khái niệm của schema.
- Frontend: hằng `APP_NAME = "SchemaForge"` trong file mới `frontend/src/lib/app-name.ts`, dùng cho `metadata.title` và heading. `page.test.tsx` giữ nguyên và vẫn pass. Frontend giữ dependency `@schemaforge/core` vì phần 3 dùng ngay.
- Backend: `main.ts` giữ một import thật từ core, ghi log `SchemaForge backend listening on port 3001 (schema version 1)` bằng `CURRENT_SCHEMA_VERSION`. Như vậy bản build ESM của backend vẫn chứng minh đọc được `dist/` của core, và log cho biết phiên bản định dạng schema mà server chấp nhận.

## Vấn đề phát hiện khi lập plan

Các task bên dưới đã viết theo phương án đề xuất. Orchestrator hỏi user trước khi chạy task bị ảnh hưởng (Task 0). User chọn khác thì chỉ sửa đúng task ghi trong cột "Ảnh hưởng".

| # | Vấn đề | Đề xuất | Ảnh hưởng |
|---|---|---|---|
| 1 | **Bảng trùng tên enum.** Spec mục 8 định nghĩa `table-name-duplicate` là "trùng tên bảng khác" và `enum-name-duplicate` là "trùng tên enum khác hoặc tên bảng", nhưng cũng ghi "issue về trùng tên được báo trên mọi phần tử trong nhóm trùng". Khi bảng `User` trùng enum `user`, đọc theo danh mục thì chỉ enum có issue; đọc theo quy tắc nhóm thì bảng cũng phải có | Báo trên cả hai: enum nhận `enum-name-duplicate`, bảng nhận `table-name-duplicate` (nghĩa mở rộng thành "trùng tên bảng hoặc enum khác"). Người dùng đang sửa bảng thấy lỗi ngay trên bảng | Task 9 |
| 2 | **Literal của `decimal(p, s)`.** Spec ghi "tối đa `p` chữ số, tối đa `s` chữ số sau dấu chấm". Theo câu này `10.0` hợp lệ với `decimal(3, 2)`, nhưng giá trị lớn nhất của kiểu này là `9.99` và cả ba dialect đều từ chối `10.0` | Số chữ số phần nguyên (bỏ số 0 ở đầu) tối đa `p − s`, số chữ số phần thập phân tối đa `s` (suy ra tổng tối đa `p`). Khi `scale > precision` (đã có issue `column-type-invalid-scale`), chỉ kiểm tra dạng số, bỏ qua giới hạn chữ số | Task 10 |
| 3 | **Độ sâu của nghịch đảo `batch`.** Spec ghi nghịch đảo của `batch` là "`batch` gồm nghịch đảo của từng bước" và "nghịch đảo của batch không làm tăng độ sâu quá 2". Nếu giữ nguyên cấu trúc lồng, nghịch đảo của một `batch` sâu `d` có thể sâu `d + 1`, nên nghịch đảo của operation sâu đúng giới hạn sẽ bị `parseOperation` từ chối khi undo | Làm phẳng: nghịch đảo của `batch` là một `batch` phẳng, nghịch đảo nào của bước con là `batch` thì trải các bước của nó vào. Mọi nghịch đảo sâu tối đa 1. `MAX_BATCH_DEPTH = 8` | Task 11, Task 20 |
| 4 | **Factory dựng tài liệu.** Spec mục 13 ghi factory "dựng tài liệu bằng cách áp operation qua public API". Nhưng test của các rule validation (Task 9–13) và của handler operation (Task 16–19) cần tài liệu mẫu trước khi `applyOperation` tồn tại (Task 20); dựng bằng operation buộc mọi việc chạy tuần tự sau Task 20 | `buildSchema` dựng map từ các phần tử rồi đưa qua `parseSchemaDocument`, throw nếu sai cấu trúc. Vẫn giữ được điều spec cần: factory không thể tạo tài liệu sai cấu trúc, id xác định. `createSampleSchema` vẫn dựng bằng operation và `buildManyToMany` (Task 24) | Task 6, Task 24 |
| 5 | **"Unique" của cột auto-increment.** Spec mục 4 ghi cột auto-increment "phải thuộc khóa chính hoặc unique" mà không định nghĩa unique. Mục 5 định nghĩa unique cho tập cột: bằng khóa chính, là cột `isUnique`, hoặc bằng tập cột của index unique | Dùng chung định nghĩa ở mục 5: cột thuộc khóa chính (bất kỳ vị trí nào) hoặc `isUniqueColumnSet(schema, tableId, [columnId])` đúng | Task 8, Task 12 |

Các vấn đề 6–9 đến từ spec phần 3 (Editor MVP), là những thứ editor cần mà spec phần 2 chưa có. Tất cả là **bổ sung**: không đổi quyết định nào đã duyệt.

| # | Vấn đề | Đề xuất | Ảnh hưởng |
|---|---|---|---|
| 6 | **Không có hàm dựng quan hệ 1-1, 1-n kèm tạo cột khóa ngoại.** Hộp thoại "tạo quan hệ" của editor tự tạo cột khóa ngoại khớp khóa chính của bảng được tham chiếu, giống `buildManyToMany` với n-n | Thêm hàm dựng thuần `buildRelation(schema, input, generateId): Result<Operation, OperationError>`, trả một `batch` gồm `addColumn` cho từng cột khóa ngoại mới, `addRelation`, và với 1-1 nhiều cột thêm `addIndex` unique. Chi tiết ở Task 29. Quan hệ dùng cột khóa ngoại có sẵn vẫn là `addRelation` thường | Task 29, Task 26 |
| 7 | **Không gộp được mục lịch sử cuối.** Editor gộp các lần sửa liên tục (ví dụ gõ tên) thành một bước undo, trong khi spec mục 9 chỉ có `recordEntry`, `undo`, `redo` | Thêm hàm thuần `mergeLastEntry(history, entry): History`: thay mục cuối của `past` bằng mục gộp `{ operation: batch[cũ, mới], inverse: batch[nghịch đảo mới, nghịch đảo cũ] }` (nghịch đảo làm phẳng như Vấn đề 3) và xóa `future`. Khi `past` rỗng thì giống `recordEntry`. Quyết định khi nào gộp vẫn thuộc frontend. Chi tiết ở Task 30 | Task 30, Task 26 |
| 8 | **Zod 4 dùng `new Function` (JIT).** Spec loại Ajv vì `new Function` vướng CSP, nhưng Zod 4 cũng biên dịch validator của object bằng `new Function`. CSP của frontend chặt, dựa trên nonce | Đã kiểm chứng trên `zod` 4.6.4 và 4.6.5: JIT chỉ nằm ở nhánh nhanh của object, và `z.config({ jitless: true })` (`$ZodConfig.jitless`) tắt JIT, đồng thời bỏ cả phép thử `new Function("")` mà mã nguồn Zod ghi rõ là để tránh báo cáo `securitypolicyviolation` dưới CSP chặt. Với `jitless`, parse vẫn đúng và không lần nào gọi `Function`. Core **không** gọi `z.config` (đó là state toàn cục) và không dùng API bắt buộc JIT (`z.compile`). Consumer chạy dưới CSP chặt gọi `z.config({ jitless: true })` một lần ở điểm khởi động, trước lần parse đầu tiên; phần 3 làm việc này ở frontend. Task 31 thêm test chạy core dưới `jitless` và ghi chú vào `architecture.md` | Task 31, Task 28 |
| 9 | **Không biết một operation có thay đổi gì không.** Spec mục 9 ghi operation không đổi gì vẫn thành công và frontend quyết định có ghi lịch sử không, nhưng không nói frontend nhận biết điều đó bằng cách nào | Hợp đồng tham chiếu: khi operation không đổi gì, `applyOperation` trả về **đúng tham chiếu** `schema` đầu vào (vẫn kèm nghịch đảo). Frontend kiểm tra `result.value.schema === schema`, chi phí O(1). Đây là trường hợp riêng của structural sharing mà spec đã yêu cầu. Chiều ngược lại không bảo đảm: một `batch` thêm rồi xóa cùng phần tử trả tham chiếu mới dù bằng nhau theo cấu trúc. Không tách task riêng, vì hợp đồng nằm trong từng handler: yêu cầu và test được ghi vào Task 14 (helper so sánh), Task 16–19 (từng handler) và Task 20 (`applyOperation`, `batch`) | Task 14, 16–20, 26 |

Vấn đề thứ năm của spec phần 3 (entry point `testing` chưa chốt) đã được giải quyết ở mục "Entry point testing".

## Thứ tự và nhóm song song

| Task | Nội dung | Phụ thuộc | Đợt |
|---|---|---|---|
| 0 | Chốt Vấn đề 1–5 với user, cập nhật spec | — | 0 (song song với 1–5) |
| 1 | Thêm `zod`, `fast-check` vào core, ghi lockfile | — | 1 |
| 2 | `Result`, `DocumentPath`, id, danh mục mã lỗi và mã issue | 1 | 2 |
| 3 | Schema Zod và type của model, `createEmptySchema`, giới hạn tên | 2 | 3 |
| 4 | Kiểm tra bất biến cấu trúc | 3 | 4 |
| 5 | `parseSchemaDocument`, chuyển lỗi Zod, khung migration | 4 | 5 |
| 6 | Factory cho test | 0, 5 | 6 |
| 11 | Schema Zod của operation, `parseOperation` | 0, 5 | 6 |
| 7 | Sắp xếp xác định | 6 | 7 |
| 8 | Kiểm tra tập cột unique | 0, 6 | 7 |
| 9 | Rule tên và trùng tên | 0, 6 | 7 |
| 10 | Rule giá trị mặc định | 0, 6 | 7 |
| 14 | Helper dùng chung của operation | 4, 6, 11 | 7 |
| 12 | Rule thuộc tính cột | 8 | 8 |
| 13 | Rule quan hệ và enum | 8 | 8 |
| 22 | `suggestIndexName` | 6 | 8 |
| 16 | Operation của bảng | 14 | 8 |
| 17 | Operation của cột | 14 | 8 |
| 15 | `validateSchema`, `findIntroducedIssues` | 9, 10, 12, 13 | 9 |
| 18 | Operation của quan hệ và index | 14 | 9 |
| 19 | Operation của enum, subject area, ghi chú, bố cục, tên schema | 14 | 9 |
| 20 | `applyOperation`, `batch` | 16, 17, 18, 19 | 10 |
| 21 | `buildManyToMany` | 15, 20 | 11 |
| 23 | Lịch sử undo/redo | 20 | 11 |
| 29 | `buildRelation` (Vấn đề 6) | 15, 20, 22 | 11 |
| 31 | Chạy core dưới Zod `jitless` (Vấn đề 8) | 20 | 11 |
| 24 | `createSampleSchema` | 15, 21 | 12 |
| 25 | Arbitrary và năm property test | 15, 20, 21 | 12 |
| 30 | `mergeLastEntry` (Vấn đề 7) | 23 | 12 |
| 26 | Public API, entry point testing | 7, 22, 23, 24, 25, 29, 30, 31 | 13 |
| 27 | Bỏ `PRODUCT_NAME`, sửa frontend và backend | 26 | 14 |
| 28 | Tài liệu và kiểm tra toàn repo | 27 | 15 |

- Số thứ tự task là định danh, không phải thứ tự chạy; cột "Đợt" là thứ tự chạy gợi ý. Mọi task trong cùng một đợt có tập file rời nhau (xem mục "File sở hữu" của từng task) và chạy song song được. Mỗi đợt tối đa 5 task, khớp giới hạn của orchestrator.
- Orchestrator có thể bắt đầu một task ngay khi mọi phụ thuộc của nó đã merge, không cần chờ hết đợt. Ví dụ Task 22 chỉ cần Task 6.
- Đợt 1–5 tuần tự vì mỗi task đặt nền cho task sau. Task 0 chỉ sửa spec nên chạy song song với các task này, nhưng phải xong trước Task 6, 8, 9, 10, 11.

## Task 0: Chốt các vấn đề phát hiện khi lập plan

**Mục tiêu:** user xác nhận hoặc chọn khác cho Vấn đề 1–9; spec phản ánh đúng quyết định trước khi code dựa trên nó.

**Phụ thuộc:** không. **Đợt:** 0.

**Cách làm:**

1. Orchestrator trình bày bảng "Vấn đề phát hiện khi lập plan" cho user và ghi lại lựa chọn.
2. Một subagent sửa spec theo lựa chọn, đúng các mục:
   - Vấn đề 1: mục 8.
   - Vấn đề 2: mục 3 "Giá trị mặc định".
   - Vấn đề 3: mục 9 "Operation nghịch đảo" và "Danh mục".
   - Vấn đề 4: mục 13.
   - Vấn đề 5: mục 4.
   - Vấn đề 6, 7, 9: bổ sung vào mục 9 và bảng entry point ở mục 12.
   - Vấn đề 8: mục 11 "Thư viện kiểm tra hình dạng".

   Văn phong tiếng Việt, giữ cấu trúc spec.
3. User chọn khác đề xuất ở vấn đề nào thì orchestrator sửa prompt của task bị ảnh hưởng trước khi giao. Task 29–31 chỉ chạy khi user đồng ý bổ sung tương ứng.

**File sở hữu:** `document/specs/2026-09-14-core-schema-model-design.md`.

**Kiểm tra:** `git diff --stat` chỉ có file spec; mỗi quyết định đã chốt xuất hiện đúng mục.

**Commit:** `docs: clarify core schema model spec`

## Task 1: Thêm dependency cho core

**Mục tiêu:** `zod` là runtime dependency duy nhất của core, `fast-check` là dev dependency; lockfile được ghi một lần duy nhất ở đây.

**Phụ thuộc:** không. **Đợt:** 1.

**File sở hữu:** sửa `packages/core/package.json`, `pnpm-lock.yaml`.

**Cài đặt:**

- Trong `packages/core/package.json`, thêm `"dependencies": { "zod": "catalog:" }` và thêm `"fast-check": "^4.10.0"` vào `devDependencies` (giữ thứ tự chữ cái). Không đổi trường nào khác.
- Chạy `pnpm install` ở root.
- `pnpm-workspace.yaml` không được thay đổi. Nếu pnpm tự thêm `minimumReleaseAgeExclude` hay khối nào khác, dừng và báo.

**Test:** task không thêm code nên không có test mới. Bộ test hiện có phải vẫn xanh.

**Kiểm tra:**

```bash
source ~/.nvm/nvm.sh && nvm use
pnpm install --frozen-lockfile
pnpm --filter @schemaforge/core ls zod fast-check
git status --porcelain
pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test
```

Mong đợi: `--frozen-lockfile` chạy qua; `ls` in `zod 4.6.x` trong `dependencies` và `fast-check 4.10.x` trong `devDependencies`; `git status` chỉ có hai file của task; ba lệnh cuối thoát mã 0.

**Commit:** `build(core): add zod and fast-check dependencies`

## Task 2: Result, đường dẫn, id và danh mục mã

**Mục tiêu:** các khối nền mà mọi task sau import: kiểu `Result`, thứ tự đường dẫn, bảy loại id, danh mục mã lỗi và mã issue đầy đủ, helper tháo `Result` cho test.

**Phụ thuộc:** Task 1. **Đợt:** 2.

**File sở hữu (tạo):**

- `packages/core/src/result.ts`, `result.test.ts`
- `packages/core/src/document-path.ts`, `document-path.test.ts`
- `packages/core/src/error-codes.ts`, `error-codes.test.ts`
- `packages/core/src/validation/issue-codes.ts`, `issue-codes.test.ts`
- `packages/core/src/model/ids.ts`, `ids.test.ts`
- `packages/core/src/testing/unwrap-result.ts`, `unwrap-result.test.ts`

**Cài đặt:**

- `result.ts`: `export type Result<T, E> = { readonly isOk: true; readonly value: T } | { readonly isOk: false; readonly error: E };` và hai hàm `ok(value)`, `err(error)`. Trường phân biệt là `isOk` vì rule naming bắt thuộc tính boolean có tiền tố.
- `document-path.ts`: `export type DocumentPath = readonly (string | number)[];`, `compareDocumentPaths`, `sortByPathThenCode<T extends { readonly code: string; readonly path: DocumentPath }>(items: readonly T[]): readonly T[]` (dùng `toSorted`), theo mục "Thứ tự đường dẫn".
- `error-codes.ts` (spec mục 8, "Danh mục mã bất biến cấu trúc"):
  - `STRUCTURAL_ERROR_CODES` (13 mã, `as const`): `invalid-shape`, `version-unsupported`, `id-mismatch`, `table-not-found`, `column-not-found`, `relation-not-found`, `index-not-found`, `enum-not-found`, `subject-area-not-found`, `note-not-found`, `column-not-in-table`, `column-listed-twice`, `column-ownership-mismatch`.
  - `OPERATION_ERROR_CODES` (4 mã chỉ có ở operation và hàm dựng): `id-already-exists`, `enum-in-use`, `insert-position-out-of-range`, `primary-key-missing`.
  - `ERROR_CODES = [...STRUCTURAL_ERROR_CODES, ...OPERATION_ERROR_CODES] as const`.
  - Type `StructuralErrorCode`, `OperationErrorCode`, `ErrorCode`, `StructuralError = { readonly code: StructuralErrorCode; readonly path: DocumentPath }`, `OperationError = { readonly code: ErrorCode; readonly path: DocumentPath }`.
- `validation/issue-codes.ts`: `ISSUE_CODES` gồm đúng 25 mã trong bảng "Danh mục mã issue ngữ nghĩa" của spec mục 8, theo thứ tự của bảng; `IssueCode`; `Issue = { readonly code: IssueCode; readonly path: DocumentPath }`.
- `model/ids.ts`: theo mục "Kiểu id". Export `MAX_ID_LENGTH = 64`; bảy schema `tableIdShape`, `columnIdShape`, `relationIdShape`, `indexIdShape`, `enumIdShape`, `subjectAreaIdShape`, `noteIdShape` (tiền tố `tbl_`, `col_`, `rel_`, `idx_`, `enum_`, `area_`, `note_`); bảy type `TableId`… suy ra bằng `z.infer`; `type GenerateId = () => string`; bảy hàm `createTableId`… ; `isTableId`, `isNoteId`.
- `testing/unwrap-result.ts`: `unwrapOk<T, E>(result: Result<T, E>): T` và `unwrapError<T, E>(result: Result<T, E>): E`. Gặp nhánh còn lại thì throw `Error` có `JSON.stringify` của nhánh đó trong message. Không import `vitest`.

**Test viết trước:**

- `result.test.ts`: `ok wraps a value with isOk set to true`; `err wraps an error with isOk set to false`.
- `document-path.test.ts`: `orders numeric segments by value`; `orders string segments by UTF-16 code unit instead of locale`; `places a numeric segment before a string segment at the same position`; `places a path before a longer path that starts with it`; `sorts items with equal paths by code`; `returns a new array and leaves the input unchanged`.
- `error-codes.test.ts`: `lists the thirteen structural error codes from the spec`; `lists the four operation error codes from the spec`; `lists structural codes before operation codes without duplicates`.
- `issue-codes.test.ts`: `lists the twenty-five issue codes from the spec without duplicates`.
- `ids.test.ts`: `accepts a table id with a valid token`; `rejects an id that has another element prefix`; `rejects an id with an empty token`; `rejects a token containing a space`; `accepts an id of exactly 64 characters`; `rejects an id of 65 characters`; `limits the token of five-letter prefixes to 59 characters`; `it.each` trên bảy hàm tạo: `creates an id by prefixing the generated token`; `throws when the id generator returns an invalid token`; `recognizes table ids with isTableId`; `recognizes note ids with isNoteId`; `infers TableId as the tbl_ template literal type` (`expectTypeOf`).
- `unwrap-result.test.ts`: `returns the value of an ok result`; `throws when unwrapping the value of an error result`; `returns the error of an error result`; `throws when unwrapping the error of an ok result`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add result type, ids and error code catalogs`

## Task 3: Schema Zod và type của model

**Mục tiêu:** mọi phần tử của tài liệu có schema Zod strict, readonly, và type suy ra từ đó; có `CURRENT_SCHEMA_VERSION`, `createEmptySchema` và giới hạn tên.

**Phụ thuộc:** Task 2. **Đợt:** 3.

**File sở hữu (tạo), mỗi file kèm `<name>.test.ts` cùng thư mục:** `packages/core/src/model/position.ts`, `column-type.ts`, `column-default.ts`, `column.ts`, `table.ts`, `relation.ts`, `table-index.ts`, `enum.ts`, `subject-area.ts`, `note.ts`, `schema-document.ts`, `create-empty-schema.ts`, `name-limits.ts`.

**Cài đặt** (spec mục 1–7 và 11, quy ước tên ở "Tên schema Zod", readonly ở "Readonly"):

- `position.ts`: `positionShape` gồm `x`, `y` là `z.number()` (Zod 4 đã từ chối `Infinity`, `NaN`); type `Position`.
- `column-type.ts`: `columnTypeShape` là `z.discriminatedUnion("kind", [...19 option])` rồi `.readonly()`, đúng 19 kiểu ở spec mục 3. `length`, `precision` là `z.int().min(1)`, `scale` là `z.int().min(0)`, `enumId` là `enumIdShape`, `name` của `custom` là `z.string()` (cú pháp an toàn là issue, không phải hình dạng). Type `ColumnType`.
- `column-default.ts`: `columnDefaultShape` với ba `kind`: `literal` (`value: z.string()`), `currentTimestamp`, `generateUuid`. Type `ColumnDefault`.
- `column.ts`: `columnFieldsShape`, `columnShape`, type `Column` đúng 9 trường ở spec mục 4; `defaultValue` là `columnDefaultShape.nullable()`.
- `table.ts`: `tableFieldsShape`, `tableShape`, type `Table`; `subjectAreaId` nullable; `columnIds`, `primaryKeyColumnIds` là mảng readonly, được rỗng.
- `relation.ts`: `relationKindShape` (`oneToOne`, `oneToMany`), `referentialActionShape` (năm hành động), `columnPairShape`, `relationFieldsShape`, `relationShape`; `columnPairs` có `.min(1)`. Type `RelationKind`, `ReferentialAction`, `ColumnPair`, `Relation`.
- `table-index.ts`: `indexFieldsShape`, `indexShape`, type `Index`; `columnIds` có `.min(1)`.
- `enum.ts`: `enumFieldsShape`, `enumShape`, type `Enum`; `values` là mảng chuỗi readonly, được rỗng.
- `subject-area.ts`, `note.ts`: `SubjectArea` (`id`, `name`), `Note` (`id`, `text`, `position`).
- `schema-document.ts`: `CURRENT_SCHEMA_VERSION = 1`; `export type IdMap<K extends string, V> = Readonly<Record<K, V>>`; `schemaDocumentShape` strict gồm `version: z.literal(CURRENT_SCHEMA_VERSION)`, `name: z.string()` và 7 map `z.record(<id shape>, <element shape>).readonly()`; type `SchemaDocument`.
- `create-empty-schema.ts`: `createEmptySchema(name: string): SchemaDocument`, mọi map rỗng.
- `name-limits.ts`: `MAX_NAME_BYTES = 63`, `utf8ByteLength(text: string): number`, `toNameKey(name: string): string`, theo mục "So tên và độ dài byte".

**Test viết trước** (mỗi test gọi `safeParse` và kiểm tra `success`; test kiểu dùng `expectTypeOf`):

- `position.test.ts`: `accepts finite coordinates`; `rejects an infinite coordinate`; `rejects NaN`.
- `column-type.test.ts`: `it.each` 19 kiểu: `accepts the <kind> type with its parameters`; `rejects an unknown kind`; `rejects varchar length 0`; `rejects a non-integer length`; `rejects decimal precision 0`; `accepts decimal scale 0`; `rejects a negative scale`; `accepts scale greater than precision because that is a semantic issue`; `rejects an enum type whose enumId has a wrong prefix`; `rejects a parameter on a kind that has none`.
- `column-default.test.ts`: `accepts a literal with a string value`; `rejects a literal with a numeric value`; `accepts the currentTimestamp and generateUuid expressions`; `rejects an unknown expression kind`.
- `column.test.ts`: `accepts a column with every field present`; `rejects a column missing isNullable`; `rejects an extra field`; `accepts a null default value`.
- `table.test.ts`: `accepts a table with empty column and primary key lists`; `rejects a column id with the wrong prefix in columnIds`; `rejects an extra field`; `infers columnIds as a readonly array of ColumnId`.
- `relation.test.ts`: `accepts a relation with one column pair`; `rejects a relation with no column pairs`; `rejects an unknown referential action`; `rejects an unknown relation kind`.
- `table-index.test.ts`: `accepts an index with one column`; `rejects an index with no columns`.
- `enum.test.ts`: `accepts an enum with no values`; `rejects a non-string value`.
- `subject-area.test.ts`: `accepts a subject area with an id and a name`; `rejects an extra field`.
- `note.test.ts`: `accepts a note with text and a position`; `rejects a note without a position`.
- `schema-document.test.ts`: `accepts a document with all seven empty maps`; `rejects a document with a newer version literal`; `rejects a document missing the notes map`; `rejects a map key that is not an id of that element kind`; `freezes the parsed document and its nested arrays`; `infers tables as IdMap of TableId to Table`.
- `create-empty-schema.test.ts`: `creates a document with the current version, the given name and empty maps`; `creates a document that passes schemaDocumentShape`.
- `name-limits.test.ts`: `counts ASCII characters as one byte`; `counts a Vietnamese letter such as ệ as three bytes`; `counts an emoji as four bytes`; `counts a lone surrogate as three bytes`; `lowercases names for comparison without depending on locale`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add schema model shapes and types`

## Task 4: Kiểm tra bất biến cấu trúc

**Mục tiêu:** một hàm trả về mọi vi phạm bất biến cấu trúc (phần không thuộc hình dạng) của một tài liệu đã đúng hình dạng, đúng mã và đường dẫn.

**Phụ thuộc:** Task 3. **Đợt:** 4.

**File sở hữu (tạo):** `packages/core/src/model/column-list-errors.ts`, `column-list-errors.test.ts`; `packages/core/src/parse/structural-invariants.ts`, `structural-invariants.test.ts`; `packages/core/src/parse/relation-index-invariants.ts`, `relation-index-invariants.test.ts`.

**Cài đặt:**

- `column-list-errors.ts`: `findColumnListErrors(columns: SchemaDocument["columns"], tableId: TableId, columnIds: readonly ColumnId[]): readonly ColumnListError[]`, với `ColumnListError = { readonly code: "column-not-found" | "column-not-in-table" | "column-listed-twice"; readonly index: number }`. Mỗi vị trí báo tối đa một mã, xét theo thứ tự: không tồn tại → `column-not-found`; `tableId` khác → `column-not-in-table`; đã xuất hiện ở vị trí trước → `column-listed-twice`. Task 14 dùng lại hàm này cho operation.
- `structural-invariants.ts`: `checkStructuralInvariants(schema: SchemaDocument): readonly StructuralError[]`, gọi các hàm kiểm tra theo loại phần tử và hàm của `relation-index-invariants.ts`, trả kết quả qua `sortByPathThenCode`.
- `relation-index-invariants.ts`: kiểm tra index và quan hệ.

| Kiểm tra | Mã | `path` |
|---|---|---|
| Khóa map khác `id` của phần tử (cả 7 map) | `id-mismatch` | `[<map>, <khóa>, "id"]` |
| `column.tableId` không tồn tại | `table-not-found` | `["columns", c, "tableId"]` |
| Phần tử `i` của `table.columnIds` không tồn tại | `column-not-found` | `["tables", t, "columnIds", i]` |
| Bỏ các id không tồn tại, `table.columnIds` còn phần tử trùng, hoặc tập của nó khác tập cột có `tableId === t` | `column-ownership-mismatch` (một lần mỗi bảng) | `["tables", t, "columnIds"]` |
| Phần tử `i` của `primaryKeyColumnIds` | theo `findColumnListErrors` với bảng `t` | `["tables", t, "primaryKeyColumnIds", i]` |
| `table.subjectAreaId` khác `null` và không tồn tại | `subject-area-not-found` | `["tables", t, "subjectAreaId"]` |
| Kiểu `enum` của cột trỏ tới enum không tồn tại | `enum-not-found` | `["columns", c, "type", "enumId"]` |
| `index.tableId` không tồn tại | `table-not-found` | `["indexes", x, "tableId"]` |
| Phần tử `i` của `index.columnIds`, chỉ khi bảng tồn tại | theo `findColumnListErrors` | `["indexes", x, "columnIds", i]` |
| `relation.fromTableId`, `relation.toTableId` không tồn tại | `table-not-found` | `["relations", r, "fromTableId"]`, `["relations", r, "toTableId"]` |
| Các `fromColumnId` (chỉ khi bảng nguồn tồn tại), xét như một danh sách với `fromTableId` | theo `findColumnListErrors` | `["relations", r, "columnPairs", i, "fromColumnId"]` |
| Các `toColumnId`, tương tự với `toTableId` | theo `findColumnListErrors` | `["relations", r, "columnPairs", i, "toColumnId"]` |

`relation-not-found`, `index-not-found`, `note-not-found` không thể xảy ra trong tài liệu (không phần tử nào tham chiếu tới quan hệ, index, ghi chú); các mã này chỉ có ở operation.

**Test viết trước** (dựng `SchemaDocument` có kiểu ngay trong test từ `createEmptySchema("test")` và object literal; mỗi test kiểm tra toàn bộ danh sách lỗi bằng `toStrictEqual`):

- `column-list-errors.test.ts`: `returns no errors for distinct columns of the table`; `reports column-not-found at the index of a missing column`; `reports column-not-in-table for a column of another table`; `reports column-listed-twice at the second occurrence`; `reports only the first applicable code for one position`.
- `structural-invariants.test.ts`: `returns no errors for a consistent document`; `reports id-mismatch when a map key differs from the element id`; `reports table-not-found for a column whose table does not exist`; `reports column-not-found for a missing id in table columnIds`; `reports column-ownership-mismatch when a column is missing from its table columnIds`; `reports column-ownership-mismatch when columnIds lists a column of another table`; `reports column-ownership-mismatch when columnIds lists a column twice`; `reports column-not-in-table for a primary key column of another table`; `reports column-listed-twice for a repeated primary key column`; `reports subject-area-not-found for a missing subject area`; `reports enum-not-found for a column type that uses a missing enum`; `returns every error sorted by path then code`.
- `relation-index-invariants.test.ts`: `reports table-not-found for an index on a missing table`; `skips column checks of an index whose table is missing`; `reports column-not-found for a missing index column`; `reports column-not-in-table for an index column of another table`; `reports column-listed-twice for a repeated index column`; `reports table-not-found for a missing fromTableId and toTableId`; `reports column-not-in-table for a fromColumnId outside the from table`; `reports column-not-in-table for a toColumnId outside the to table`; `reports column-listed-twice when one side repeats a column`; `accepts a self-referencing relation`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add structural invariant checks`

## Task 5: `parseSchemaDocument`

**Mục tiêu:** mọi JSON không tin cậy trở thành `SchemaDocument` đúng cấu trúc, hoặc danh sách `StructuralError` xác định.

**Phụ thuộc:** Task 4. **Đợt:** 5.

**File sở hữu (tạo):** `packages/core/src/parse/json-object.ts`, `json-object.test.ts`; `packages/core/src/parse/zod-issues.ts`, `zod-issues.test.ts`; `packages/core/src/parse/migrations.ts`, `migrations.test.ts`; `packages/core/src/parse/parse-schema-document.ts`, `parse-schema-document.test.ts`.

**Cài đặt:**

- `json-object.ts`: type guard `isJsonObject(value: unknown): value is Readonly<Record<string, unknown>>` (object, khác `null`, không phải mảng). Task 11 dùng lại.
- `zod-issues.ts`: `toStructuralErrors(issues)` theo mục "Chuyển lỗi Zod thành `invalid-shape`". Tham số là mảng issue của Zod 4 (`z.core.$ZodIssue`, lấy từ `error.issues`).
- `migrations.ts`:
  - `type MigrationStep = (document: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>`.
  - `MIGRATION_STEPS: readonly MigrationStep[] = []`: phần tử `i` chuyển version `i + 1` sang `i + 2`, nên luôn có `CURRENT_SCHEMA_VERSION - 1` phần tử.
  - `migrateDocument(document, version, steps)`: áp lần lượt `steps[version - 1]` tới hết, sau mỗi bước ghi `version` mới vào kết quả.
- `parse-schema-document.ts`: `parseSchemaDocument(input: unknown): Result<SchemaDocument, readonly StructuralError[]>`, theo đúng thứ tự spec mục 11:
  1. `input` không phải object JSON, hoặc `version` không phải số nguyên ≥ 1 → `[{ code: "invalid-shape", path: ["version"] }]`.
  2. `version > CURRENT_SCHEMA_VERSION` → `[{ code: "version-unsupported", path: ["version"] }]`.
  3. `migrateDocument(input, version, MIGRATION_STEPS)`.
  4. Hình dạng: gộp lỗi `__proto__` của 7 map (mục "`IdMap`…") với `toStructuralErrors` của `schemaDocumentShape.safeParse`. Có lỗi thì trả danh sách đã sắp và dừng.
  5. `checkStructuralInvariants`; có lỗi thì trả, không thì trả `ok(document)` (document do Zod trả ra, đã đóng băng).

**Test viết trước** (dùng `unwrapOk`, `unwrapError`; JSON hợp lệ viết tay trong file test, có đủ 7 loại phần tử, khóa chính và khóa ngoại nhiều cột):

- `json-object.test.ts`: `accepts a plain object`; `rejects null`; `rejects an array`; `rejects a string`.
- `zod-issues.test.ts`: `maps a missing field to invalid-shape at the field path`; `maps each unrecognized key to its own error with the key appended to the path`; `maps an unknown discriminator to the path of the discriminator field`; `maps an invalid record key to the path of the key`; `drops duplicate paths`; `sorts errors by path`.
- `migrations.test.ts`: `has one step for every version before the current version`; `returns the document unchanged when no step applies`; `applies steps in order starting from the document version` (bước giả trong test); `writes the next version after each step`.
- `parse-schema-document.test.ts`:
  - `returns the document for valid input`; `returns a document equal to its JSON round trip`; `returns a frozen document`.
  - `returns invalid-shape at version when input is not an object`; `returns invalid-shape at version when version is missing`; `returns invalid-shape at version when version is 0`; `returns invalid-shape at version when version is not an integer`; `returns version-unsupported when version is newer than the current version`.
  - `returns invalid-shape for an extra root field`; `returns invalid-shape for an extra field on a table`; `returns invalid-shape for an unknown column type kind`; `returns invalid-shape for a non-finite position`; `returns invalid-shape for an empty index column list`; `returns invalid-shape for a malformed id key`; `returns invalid-shape at tables __proto__ when a map has a __proto__ key`; `returns invalid-shape for a constructor key in a map`.
  - `it.each` các mã `id-mismatch`, `table-not-found`, `column-not-found`, `enum-not-found`, `subject-area-not-found`, `column-not-in-table`, `column-listed-twice`, `column-ownership-mismatch`: `returns <code> with the path of the offending element`.
  - `returns every invariant error sorted by path`; `does not report invariant errors when the shape is invalid`.
  - ED-04: `ED-04 rejects an imported document whose index uses a column that does not exist`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): parse untrusted schema documents`

## Task 6: Factory cho test

**Mục tiêu:** test dựng tài liệu đúng cấu trúc ngắn gọn, chỉ ghi đè trường cần quan tâm, với id xác định. Theo đề xuất ở Vấn đề 4.

**Phụ thuộc:** Task 0, Task 5. **Đợt:** 6.

**File sở hữu (tạo):** `packages/core/src/testing/factories.ts`, `factories.test.ts`.

**Cài đặt:**

- `createCounterIdGenerator(): GenerateId`: mỗi generator trả `"1"`, `"2"`, `"3"`… (bộ đếm trong closure, không phải state cấp module).
- Hàm dựng phần tử. Tham số bắt buộc là id và các tham chiếu, còn lại có mặc định. Tên mặc định là id bỏ tiền tố: `makeTable({ id: "tbl_order_items" })` có `name: "order_items"`.
  - `makeTable(overrides: Partial<Omit<Table, "columnIds">> & Pick<Table, "id">): Table`: `comment: ""`, `position: { x: 0, y: 0 }`, `subjectAreaId: null`, `primaryKeyColumnIds: []`, `columnIds: []`.
  - `makeColumn(overrides: Partial<Column> & Pick<Column, "id" | "tableId">): Column`: `type: { kind: "integer" }`, `isNullable: false`, `defaultValue: null`, `isUnique: false`, `isAutoIncrement: false`, `comment: ""`.
  - `makeRelation(overrides: Partial<Relation> & Pick<Relation, "id" | "fromTableId" | "toTableId" | "columnPairs">): Relation`: `kind: "oneToMany"`, `onDelete: "noAction"`, `onUpdate: "noAction"`.
  - `makeIndex(overrides: Partial<Index> & Pick<Index, "id" | "tableId" | "columnIds">): Index`: `isUnique: false`.
  - `makeEnum(overrides: Partial<Enum> & Pick<Enum, "id">): Enum`: `values: ["active"]`.
  - `makeSubjectArea(overrides: Partial<SubjectArea> & Pick<SubjectArea, "id">): SubjectArea`.
  - `makeNote(overrides: Partial<Note> & Pick<Note, "id">): Note`: `text: "note"`, `position: { x: 0, y: 0 }`.
- Giá trị mặc định phải hợp lệ về ngữ nghĩa khi phần tử đứng một mình. Task 15 kiểm tra điều này bằng `validateSchema`.
- `type SchemaParts = { readonly name?: string; readonly tables?: readonly Table[]; readonly columns?: readonly Column[]; readonly relations?: readonly Relation[]; readonly indexes?: readonly Index[]; readonly enums?: readonly Enum[]; readonly subjectAreas?: readonly SubjectArea[]; readonly notes?: readonly Note[] }`.
- `buildSchema(parts: SchemaParts): SchemaDocument`:
  - `name` mặc định `"test"`.
  - Id trùng trong cùng một mảng thì throw `Error`.
  - `columnIds` của mỗi bảng luôn được dựng lại từ thứ tự của `parts.columns` lọc theo `tableId`. Muốn đổi thứ tự cột thì đổi thứ tự mảng `columns`.
  - Đưa object đã dựng qua `parseSchemaDocument`. Lỗi thì throw `Error` có danh sách `code` và `path`; thành công thì trả tài liệu đã parse.

**Test viết trước:**

- `returns ids 1, 2 and 3 from a new counter generator`; `starts every counter generator from 1`.
- `derives the default name from the id without its prefix`; `applies overrides on top of the table defaults`; `creates an integer, non-nullable column by default`; `creates a one-to-many relation with noAction by default`.
- `builds a document containing every given element keyed by id`; `derives table columnIds from the order of the columns array`; `uses test as the default schema name`.
- `throws when two elements of the same kind share an id`; `throws with the structural error codes when the document is invalid`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `test(core): add schema factories`

## Task 7: Sắp xếp xác định

**Mục tiêu:** generator và giao diện danh sách nhận cùng một thứ tự cho cùng một schema, bất kể lịch sử thao tác (spec mục 1, "Thứ tự").

**Phụ thuộc:** Task 6. **Đợt:** 7.

**File sở hữu (tạo):** `packages/core/src/model/ordering.ts`, `ordering.test.ts`.

**Cài đặt:**

- `sortTables`, `sortEnums`, `sortSubjectAreas` (`schema: SchemaDocument`, trả mảng readonly của phần tử): so `toNameKey(name)` theo code unit, bằng nhau thì so `name` theo code unit, cuối cùng so `id`.
- `sortIndexes`: theo vị trí của bảng chứa index trong `sortTables`, rồi theo tên (cùng cách so như trên), rồi theo `id`.
- `sortRelations`: theo vị trí của `fromTableId` trong `sortTables`, rồi vị trí của `columnPairs[0].fromColumnId` trong `columnIds` của bảng đó, rồi theo `id`.
- `sortNotes`: theo `id`.
- Không dùng `localeCompare`, `Intl`; so bằng `<` và `>`.

**Test viết trước:**

- `sorts tables by name without regard to case`; `breaks a case-insensitive tie by exact name`; `breaks an exact name tie by id`; `compares names by code unit rather than locale`.
- `sorts enums by the same name rule as tables`; `sorts subject areas by the same name rule as tables`.
- `sorts indexes by table order, then name, then id`.
- `sorts relations by foreign key table order`; `sorts relations of one table by the position of their first foreign key column`; `breaks a relation tie by id`.
- `sorts notes by id`.
- `returns the same order when map keys were inserted in a different order`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add deterministic element ordering`

## Task 8: Kiểm tra tập cột unique

**Mục tiêu:** một định nghĩa duy nhất cho "tập cột là unique" (spec mục 5), dùng cho rule quan hệ và rule auto-increment (Vấn đề 5).

**Phụ thuộc:** Task 0, Task 6. **Đợt:** 7.

**File sở hữu (tạo):** `packages/core/src/validation/column-uniqueness.ts`, `column-uniqueness.test.ts`.

**Cài đặt:** `isUniqueColumnSet(schema: SchemaDocument, tableId: TableId, columnIds: readonly ColumnId[]): boolean`. Trả `false` với tập rỗng. Trả `true` khi tập các id bằng (so theo tập, không theo thứ tự) một trong ba tập: tập cột khóa chính không rỗng của bảng; một cột duy nhất có `isUnique`; tập cột của một index có `isUnique` thuộc bảng đó.

**Test viết trước:** `returns true for exactly the primary key columns in another order`; `returns false for a strict subset of a composite primary key`; `returns false for a superset of the primary key`; `returns true for a single column marked unique`; `returns false for two columns that are each marked unique`; `returns true for the column set of a unique index`; `returns false for the column set of a non-unique index`; `returns false for a unique index on another table`; `returns false for an empty column list`; `returns false when the table has no primary key and no unique constraint`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add column set uniqueness check`

## Task 9: Rule tên và trùng tên

**Mục tiêu:** issue `name-empty`, `name-invalid`, `name-too-long` và năm mã trùng tên, đúng spec mục 7 và 8, với trường hợp bảng trùng enum theo Vấn đề 1.

**Phụ thuộc:** Task 0, Task 6. **Đợt:** 7.

**File sở hữu (tạo):** `packages/core/src/validation/rules/names.ts`, `names.test.ts`.

**Cài đặt:** `validateNames(schema: SchemaDocument): readonly Issue[]`, trả qua `sortByPathThenCode`.

- **Tên phần tử** (bảng, cột, enum, index, subject area) và **giá trị enum**:
  - Rỗng (`length === 0`) → chỉ báo `name-empty`.
  - Không rỗng: `name !== name.trim()` hoặc có ký tự U+0000–U+001F, U+007F → `name-invalid`; `utf8ByteLength(name) > MAX_NAME_BYTES` → `name-too-long`. Một tên có thể có cả hai.
  - Đường dẫn `[<map>, id, "name"]`; với giá trị enum là `["enums", id, "values", i]`.
- **Tên schema:** chỉ kiểm tra `name-empty` tại `["name"]`.
- **Trùng tên**, so bằng `toNameKey`, bỏ qua tên rỗng, báo trên **mọi** phần tử trong nhóm:
  - `table-name-duplicate`: bảng trùng bảng khác, hoặc trùng tên một enum (Vấn đề 1).
  - `enum-name-duplicate`: enum trùng enum khác hoặc trùng tên bảng.
  - `column-name-duplicate`: trong cùng một bảng.
  - `index-name-duplicate`: trong cả schema.
  - `subject-area-name-duplicate`: trong cả schema.
- Không kiểm tra trùng giá trị enum (thuộc Task 13).

**Test viết trước:**

- `returns no issues for distinct valid names`.
- `reports name-empty for an empty table name`; `reports only name-empty for an empty name`; `reports name-empty for an empty schema name at the name path`; `does not report name-invalid for a schema name with surrounding spaces`.
- `reports name-invalid for a leading space`; `reports name-invalid for a trailing space`; `reports name-invalid for a tab inside the name`; `reports name-invalid for the DEL character`; `accepts a name with an inner space and Vietnamese letters`; `accepts a name that is an SQL keyword`.
- `accepts a 63-byte name made of Vietnamese letters`; `reports name-too-long for a 64-byte name`; `reports both name-invalid and name-too-long when both apply`.
- `reports name issues on enum values at the value index path`; `checks column, index and subject area names`.
- `reports table-name-duplicate on both tables whose names differ only in case`; `reports a duplicate on every member of a group of three`; `reports enum-name-duplicate on both enums with the same name`; `reports enum-name-duplicate on the enum and table-name-duplicate on the table when they share a name`; `reports column-name-duplicate within one table`; `does not report columns with the same name in different tables`; `reports index-name-duplicate for indexes on different tables`; `reports subject-area-name-duplicate`; `does not treat two empty names as duplicates`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): validate names and duplicate names`

## Task 10: Rule giá trị mặc định

**Mục tiêu:** issue `column-default-invalid` và `column-default-incompatible` theo spec mục 3 "Giá trị mặc định", với literal `decimal` theo Vấn đề 2.

**Phụ thuộc:** Task 0, Task 6. **Đợt:** 7.

**File sở hữu (tạo):** `packages/core/src/validation/rules/column-defaults.ts`, `column-defaults.test.ts`; `packages/core/src/validation/rules/default-literals.ts`, `default-literals.test.ts`.

**Cài đặt:**

- `column-defaults.ts`: `validateColumnDefaults(schema: SchemaDocument): readonly Issue[]`, đường dẫn `["columns", id, "defaultValue"]`, trả qua `sortByPathThenCode`.
  - `null` → không có issue.
  - `currentTimestamp` trên kiểu khác `timestamp`, `timestamptz`, hoặc `generateUuid` trên kiểu khác `uuid` → `column-default-incompatible`.
  - `literal` trên `binary` → `column-default-incompatible`.
  - `literal` còn lại mà `isValidDefaultLiteral` trả `false` → `column-default-invalid`.
- `default-literals.ts`: `isValidDefaultLiteral(type: ColumnType, value: string, enums: SchemaDocument["enums"]): boolean`, `switch` đủ nhánh trên `type.kind` (nhánh `binary` trả `false`). Tách hàm theo nhóm kiểu để giữ dưới 40 dòng mỗi hàm và tối đa 3 cấp lồng. Không dùng `Date`.

| Kiểu | Literal hợp lệ |
|---|---|
| `smallint`, `integer`, `bigint` | Khớp `^-?(0|[1-9][0-9]*)$`, và `BigInt(value)` nằm trong `[-2^15, 2^15 - 1]`, `[-2^31, 2^31 - 1]`, `[-2^63, 2^63 - 1]` |
| `decimal(p, s)` | Khớp `^-?[0-9]+(\.[0-9]+)?$`. Nếu `s <= p`: chữ số phần nguyên sau khi bỏ số 0 ở đầu tối đa `p - s`, chữ số phần thập phân tối đa `s` (Vấn đề 2). Nếu `s > p`: chỉ kiểm tra dạng |
| `real`, `double` | Khớp `^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$` |
| `boolean` | Đúng `true` hoặc `false` |
| `char(n)`, `varchar(n)` | Số code point (`[...value].length`) tối đa `n` |
| `text`, `custom` | Mọi chuỗi |
| `uuid` | `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$` |
| `date` | `YYYY-MM-DD`, năm 0001–9999, tháng 01–12, ngày có thật theo lịch Gregory (năm nhuận: chia hết cho 4, trừ năm chia hết cho 100 mà không chia hết cho 400) |
| `time` | `^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?$` |
| `timestamp` | Ngày hợp lệ như `date`, chữ `T`, giờ hợp lệ như `time` |
| `timestamptz` | Như `timestamp`, rồi `Z` hoặc `[+-]([01][0-9]|2[0-3]):[0-5][0-9]` |
| `json` | `JSON.parse(value)` không throw (bắt lỗi trong `try`/`catch` và trả `false`) |
| `enum` | Có trong `values` của enum, so chính xác phân biệt hoa thường |

**Test viết trước:**

- `column-defaults.test.ts`: `returns no issues for a column without a default`; `accepts currentTimestamp on a timestamp column`; `accepts currentTimestamp on a timestamptz column`; `reports column-default-incompatible for currentTimestamp on a date column`; `accepts generateUuid on a uuid column`; `reports column-default-incompatible for generateUuid on a varchar column`; `reports column-default-incompatible for a literal on a binary column`; `reports column-default-invalid for a malformed literal at the defaultValue path`; `accepts a literal that is one of the enum values`; `reports column-default-invalid for a literal that differs from the enum value in case`; `reports column-default-invalid for a literal removed from the enum values`.
- `default-literals.test.ts`, dạng `it.each` với tên `accepts <value> for <type>` và `rejects <value> for <type>`, tối thiểu các dòng:
  - `smallint`: nhận `32767`, `-32768`, `0`; từ chối `32768`, `-32769`, `01`, `+1`, `1.0`, chuỗi rỗng.
  - `integer`: nhận `2147483647`; từ chối `2147483648`.
  - `bigint`: nhận `9223372036854775807`, `-9223372036854775808`; từ chối `9223372036854775808`.
  - `decimal(3, 2)`: nhận `9.99`, `0.5`, `-1.25`, `007.5`; từ chối `10.0`, `1.234`, `1.`, `.5`, `1e2`.
  - `decimal(2, 3)`: nhận `12.3456`.
  - `real`: nhận `1.5e-3`, `-2`; từ chối `NaN`, `Infinity`, `1,5`.
  - `boolean`: nhận `true`, `false`; từ chối `TRUE`, `1`.
  - `varchar(3)`: nhận `ệệệ`; từ chối `abcd`. `char(2)`: nhận `ab`; từ chối `abc`.
  - `text`, `custom`: nhận chuỗi bất kỳ, kể cả chuỗi rỗng.
  - `uuid`: nhận dạng chữ thường và chữ hoa; từ chối thiếu một nhóm.
  - `date`: nhận `2024-02-29`, `0001-01-01`, `9999-12-31`; từ chối `2023-02-29`, `1900-02-29`, `2024-13-01`, `2024-04-31`, `0000-01-01`, `2024-1-01`.
  - `time`: nhận `23:59:59`, `00:00:00.123456`; từ chối `24:00:00`, `12:60:00`, `12:00`.
  - `timestamp`: nhận `2024-02-29T13:45:00`; từ chối `2024-02-29 13:45:00`, `2024-02-29T13:45:00Z`.
  - `timestamptz`: nhận `2024-02-29T13:45:00Z`, `2024-02-29T13:45:00.5+07:00`; từ chối `2024-02-29T13:45:00`, `2024-02-29T13:45:00+24:00`.
  - `json`: nhận `{"a":1}`, `[]`, `"text"`, `null`; từ chối `{a:1}`, chuỗi rỗng.
  - `binary`: từ chối mọi literal.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): validate column default values`

## Task 11: Schema Zod của operation và `parseOperation`

**Mục tiêu:** một nguồn duy nhất cho hình dạng của 26 loại operation, type suy ra từ đó, và `parseOperation` an toàn với input lồng sâu. Theo đề xuất ở Vấn đề 3.

**Phụ thuộc:** Task 0, Task 5. **Đợt:** 6.

**File sở hữu (tạo):** `packages/core/src/operations/step-operation-shapes.ts`; `packages/core/src/operations/operation.ts`, `operation.test.ts`; `packages/core/src/parse/parse-operation.ts`, `parse-operation.test.ts`.

**Cài đặt:**

- `step-operation-shapes.ts`: 25 schema `z.strictObject` (không `.readonly()` ở cấp option), đúng danh mục spec mục 9, dựng lại từ schema của model:

| Operation | Trường |
|---|---|
| `renameSchema` | `name: z.string()` |
| `addTable` | `table: tableFieldsShape.omit({ columnIds: true, primaryKeyColumnIds: true }).readonly()` |
| `updateTable` | `tableId`, `changes: tableFieldsShape.pick({ name, comment, subjectAreaId }).partial().readonly()` |
| `setPrimaryKey` | `tableId`, `columnIds: z.array(columnIdShape).readonly()` |
| `removeTable` | `tableId` |
| `addColumn` | `column: columnShape`, `insertAt: z.int().min(0)` |
| `updateColumn` | `columnId`, `changes: columnFieldsShape.omit({ id, tableId }).partial().readonly()` |
| `moveColumn` | `columnId`, `toIndex: z.int().min(0)` |
| `removeColumn` | `columnId` |
| `addRelation` | `relation: relationShape` |
| `updateRelation` | `relationId`, `changes: relationFieldsShape.pick({ kind, columnPairs, onDelete, onUpdate }).partial().readonly()` |
| `removeRelation` | `relationId` |
| `addIndex`, `updateIndex`, `removeIndex` | `index: indexShape`; `indexId`, `changes: indexFieldsShape.pick({ name, columnIds, isUnique }).partial().readonly()`; `indexId` |
| `addEnum`, `updateEnum`, `removeEnum` | `enum: enumShape`; `enumId`, `changes: enumFieldsShape.pick({ name, values }).partial().readonly()`; `enumId` |
| `addSubjectArea`, `updateSubjectArea`, `removeSubjectArea` | `subjectArea: subjectAreaShape`; `subjectAreaId`, `changes: subjectAreaFieldsShape.pick({ name }).readonly()` (bắt buộc `name`); `subjectAreaId` |
| `addNote`, `updateNote`, `removeNote` | `note: noteShape`; `noteId`, `changes: noteFieldsShape.pick({ text }).readonly()`; `noteId` |
| `moveElements` | `moves: z.array(z.strictObject({ elementId: z.union([tableIdShape, noteIdShape]), position: positionShape }).readonly()).readonly()` |

- `operation.ts`: theo mục "Union của operation có `batch` đệ quy". Export `operationShape`, `Operation`, `BatchOperation`, `OperationType = Operation["type"]`, `OperationOfType<T extends OperationType> = Extract<Operation, { readonly type: T }>`, và các union theo nhóm mà Task 16–20 dùng làm chữ ký:
  - `TableOperation`: `addTable`, `updateTable`, `setPrimaryKey`, `removeTable`
  - `ColumnOperation`: `addColumn`, `updateColumn`, `moveColumn`, `removeColumn`
  - `RelationOperation`: `addRelation`, `updateRelation`, `removeRelation`
  - `IndexOperation`: `addIndex`, `updateIndex`, `removeIndex`
  - `EnumOperation`: `addEnum`, `updateEnum`, `removeEnum`
  - `SubjectAreaOperation`: `addSubjectArea`, `updateSubjectArea`, `removeSubjectArea`
  - `NoteOperation`: `addNote`, `updateNote`, `removeNote`
- `parse-operation.ts`:
  - `MAX_BATCH_DEPTH = 8`.
  - `parseOperation(input: unknown): Result<Operation, readonly StructuralError[]>`.
  - Bước 1, kiểm tra độ sâu bằng vòng lặp có ngăn xếp (không đệ quy) theo mục "Độ sâu lồng `batch`". Mọi object JSON có `type === "batch"` và `operations` là mảng được tính là `batch`. Vượt giới hạn thì trả một lỗi `invalid-shape` tại đường dẫn của `batch` đó và không chạy Zod.
  - Bước 2, `operationShape.safeParse`, lỗi qua `toStructuralErrors`.

**Test viết trước:**

- `operation.test.ts`:
  - `it.each` một ví dụ hợp lệ cho mỗi loại trong 26 loại: `accepts a valid <type> operation`.
  - `rejects an unknown operation type at the type path`; `rejects an extra field on an operation`; `reports a nested error with the full path inside a batch`; `accepts updateTable with empty changes`; `rejects an unknown key inside changes`; `requires name in updateSubjectArea changes`; `accepts table and note ids in moveElements`; `rejects a column id in moveElements`; `rejects a negative insertAt`; `rejects addTable carrying columnIds`; `rejects addRelation with no column pairs`.
  - Kiểu: `narrows OperationOfType addTable to an operation without column lists`; `infers BatchOperation operations as readonly Operation array`.
- `parse-operation.test.ts`: `returns the operation for valid input`; `returns a frozen operation`; `returns invalid-shape errors sorted by path for invalid input`; `accepts a batch nested exactly MAX_BATCH_DEPTH levels deep`; `rejects a batch nested one level deeper than MAX_BATCH_DEPTH at the path of the too-deep batch`; `returns an error instead of throwing for 100000 nested batches`; `returns invalid-shape at the root for a non-object input`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add operation shapes and parseOperation`

## Task 12: Rule thuộc tính cột

**Mục tiêu:** issue về khóa chính nullable, auto-increment, scale và kiểu custom (spec mục 3, 4, 8), với "unique" theo Vấn đề 5.

**Phụ thuộc:** Task 8. **Đợt:** 8.

**File sở hữu (tạo):** `packages/core/src/validation/rules/columns.ts`, `columns.test.ts`.

**Cài đặt:** `validateColumns(schema: SchemaDocument): readonly Issue[]`, trả qua `sortByPathThenCode`.

| Mã | Điều kiện | `path` |
|---|---|---|
| `column-primary-key-nullable` | Cột nằm trong `primaryKeyColumnIds` của bảng và `isNullable` | `["columns", id, "isNullable"]` |
| `column-auto-increment-invalid-type` | `isAutoIncrement` và `type.kind` không phải `smallint`, `integer`, `bigint` | `["columns", id, "isAutoIncrement"]` |
| `column-auto-increment-nullable` | `isAutoIncrement` và `isNullable` | như trên |
| `column-auto-increment-with-default` | `isAutoIncrement` và `defaultValue !== null` | như trên |
| `column-auto-increment-not-key` | `isAutoIncrement`, không thuộc khóa chính, và `isUniqueColumnSet(schema, tableId, [id])` sai | như trên |
| `table-multiple-auto-increment` | Bảng có từ hai cột `isAutoIncrement` trở lên | `["tables", id, "columnIds"]` |
| `column-type-invalid-scale` | Kiểu `decimal` có `scale > precision` | `["columns", id, "type", "scale"]` |
| `column-custom-type-invalid` | Kiểu `custom` có `name` không khớp `^[A-Za-z][A-Za-z0-9_ ,()\[\]]*$`, hoặc dài hơn 63 byte | `["columns", id, "type", "name"]` |

**Test viết trước:**

- `returns no issues for a valid auto-increment primary key column`.
- `reports column-primary-key-nullable for a nullable primary key column`; `does not report a nullable column outside the primary key`.
- `reports column-auto-increment-invalid-type on a varchar column`; `accepts auto-increment on smallint, integer and bigint` (`it.each`); `reports column-auto-increment-nullable`; `reports column-auto-increment-with-default`; `reports column-auto-increment-not-key when the column is neither key nor unique`; `accepts auto-increment on the second column of a composite primary key`; `accepts auto-increment on a column marked unique`; `accepts auto-increment on the only column of a unique index`; `reports several auto-increment issues on one column at once`.
- `reports table-multiple-auto-increment for two auto-increment columns in one table`.
- `reports column-type-invalid-scale when scale exceeds precision`; `accepts scale equal to precision`.
- `accepts custom types such as inet, geometry(Point, 4326), text[] and double precision` (`it.each`); `reports column-custom-type-invalid for a name starting with a digit`; `reports column-custom-type-invalid for a name containing a quote, semicolon, hyphen or slash` (`it.each`); `reports column-custom-type-invalid for a 64-byte name`.
- ED-02: `ED-02 reports an invalid attribute combination such as auto-increment on a non-numeric column`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): validate column attribute rules`

## Task 13: Rule quan hệ và enum

**Mục tiêu:** issue về quan hệ (spec mục 5) và enum (spec mục 6).

**Phụ thuộc:** Task 8. **Đợt:** 8.

**File sở hữu (tạo):** `packages/core/src/validation/rules/relations.ts`, `relations.test.ts`; `packages/core/src/validation/rules/enums.ts`, `enums.test.ts`.

**Cài đặt:**

- `relations.ts`: `validateRelations(schema: SchemaDocument): readonly Issue[]`, trả qua `sortByPathThenCode`.

| Mã | Điều kiện | `path` |
|---|---|---|
| `relation-column-type-mismatch` | Hai cột của cặp `i` khác kiểu: khác `kind`, hoặc khác tham số (`length`; `precision` và `scale`; `enumId`; `name` của custom). So bằng `switch` đủ nhánh, không dùng `JSON.stringify` | `["relations", id, "columnPairs", i]` |
| `relation-target-not-unique` | `isUniqueColumnSet(schema, toTableId, <các toColumnId>)` sai | `["relations", id, "columnPairs"]` |
| `relation-one-to-one-not-unique` | `kind === "oneToOne"` và `isUniqueColumnSet(schema, fromTableId, <các fromColumnId>)` sai | `["relations", id, "kind"]` |
| `relation-set-null-not-nullable` | `onDelete` (hoặc `onUpdate`) là `setNull` và có cột khóa ngoại không nullable; báo riêng cho từng trường | `["relations", id, "onDelete"]` hoặc `["relations", id, "onUpdate"]` |
| `relation-set-default-without-default` | `onDelete` (hoặc `onUpdate`) là `setDefault` và có cột khóa ngoại có `defaultValue === null` | như trên |

- `enums.ts`: `validateEnums(schema: SchemaDocument): readonly Issue[]`:
  - `values` rỗng → `enum-values-empty` tại `["enums", id, "values"]`.
  - Giá trị trùng theo `toNameKey` (bỏ qua giá trị rỗng) → `enum-value-duplicate` tại `["enums", id, "values", i]` cho **mọi** vị trí trong nhóm.

**Test viết trước:**

- `relations.test.ts`:
  - `returns no issues for a relation to a primary key with matching types`.
  - `reports relation-column-type-mismatch at the index of the mismatched pair`; `reports a mismatch for varchar columns with different lengths`; `reports a mismatch for decimal columns with different scale`; `reports a mismatch for enum columns using different enums`; `reports a mismatch for custom types with different names`; `accepts identical custom types`.
  - `reports relation-target-not-unique when the target columns are not a key`; `accepts a target that is a single unique column`; `accepts a target that matches a unique index in another column order`; `reports relation-target-not-unique for part of a composite primary key`.
  - `reports relation-one-to-one-not-unique when foreign key columns are not unique`; `accepts a one-to-one relation whose foreign key is the primary key`; `does not require unique foreign keys for one-to-many`.
  - `reports relation-set-null-not-nullable at onDelete`; `reports relation-set-null-not-nullable at both onDelete and onUpdate when both are setNull`; `accepts setNull when every foreign key column is nullable`; `reports relation-set-default-without-default at onUpdate`; `accepts setDefault when every foreign key column has a default`.
  - `accepts a self-referencing relation`.
  - ED-03: `ED-03 reports when a foreign key column and the referenced column have different types`.
- `enums.test.ts`: `returns no issues for an enum with distinct values`; `reports enum-values-empty for an enum without values`; `reports enum-value-duplicate on every value that differs only in case`; `does not treat empty values as duplicates`; ED-05: `ED-05 reports an enum with no values`; `ED-05 reports an enum with duplicate values`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): validate relations and enums`

## Task 14: Helper dùng chung của operation

**Mục tiêu:** chữ ký chung cho mọi handler và các helper mà nhiều task handler song song cùng cần, để Task 16–19 không phải sửa file chung.

**Phụ thuộc:** Task 4, Task 6, Task 11. **Đợt:** 7.

**File sở hữu (tạo), mỗi file kèm `<name>.test.ts`:** `packages/core/src/operations/apply-result.ts`, `id-map.ts`, `dependents.ts`, `references.ts`, `json-equal.ts`.

**Cài đặt:**

- `apply-result.ts`:
  - `type AppliedOperation = { readonly schema: SchemaDocument; readonly inverse: Operation }`.
  - `type ApplyResult = Result<AppliedOperation, OperationError>`.
  - `acceptOperation(schema, inverse): ApplyResult` và `rejectOperation(code: ErrorCode, path: DocumentPath): ApplyResult`.
- `id-map.ts`: `withEntry` generic và `withoutIds` bảy overload, theo mục "`IdMap`…". Không mutate map đầu vào.
- `dependents.ts`: `findIndexesUsingColumns(schema, columnIds: ReadonlySet<ColumnId>): readonly Index[]` và `findRelationsUsingColumns(schema, columnIds): readonly Relation[]` (quan hệ có cột ở phía `from` hoặc `to` nằm trong tập). Cả hai sắp theo `id`. Vì index có ít nhất một cột và quan hệ có ít nhất một cặp, `removeTable` dùng chính hai hàm này với tập `columnIds` của bảng.
- `references.ts`: `checkColumnList(schema, tableId, columnIds, path: DocumentPath): OperationError | null`: lỗi đầu tiên của `findColumnListErrors`, với `path` là `[...path, index]`.
- `json-equal.ts`: `isJsonEqual(left: unknown, right: unknown): boolean`: so sâu giá trị JSON. Primitive so bằng `===`, mảng so theo thứ tự, object so theo tập khóa không kể thứ tự. Handler dùng để nhận biết operation không đổi gì (Vấn đề 9).

**Test viết trước:**

- `apply-result.test.ts`: `accepts with the new schema and the inverse`; `rejects with the error code and path`.
- `id-map.test.ts`: `adds an entry without changing the original map`; `replaces an existing entry`; `removes every listed id and keeps the others`; `returns an equal map when no listed id exists`.
- `dependents.test.ts`: `finds indexes that contain any of the columns sorted by id`; `finds relations that use a column on the from side`; `finds relations that use a column on the to side`; `returns an empty list when nothing uses the columns`.
- `references.test.ts`: `returns null for a valid column list`; `returns column-not-found with the path extended by the index`; `returns only the first error of the list`.
- `json-equal.test.ts`: `treats objects with the same entries in different key order as equal`; `treats arrays in different order as different`; `treats a missing key and a null value as different`; `compares nested column types by value`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add operation helpers for references and cascades`

## Task 15: `validateSchema` và `findIntroducedIssues`

**Mục tiêu:** một hàm trả toàn bộ issue ngữ nghĩa theo thứ tự xác định, và chế độ chặt cho AI (spec mục 8).

**Phụ thuộc:** Task 9, Task 10, Task 12, Task 13. **Đợt:** 9.

**File sở hữu (tạo):** `packages/core/src/validation/validate-schema.ts`, `validate-schema.test.ts`; `packages/core/src/validation/find-introduced-issues.ts`, `find-introduced-issues.test.ts`.

**Cài đặt:**

- `validateSchema(schema: SchemaDocument): readonly Issue[]`: nối kết quả của `validateNames`, `validateColumns`, `validateColumnDefaults`, `validateRelations`, `validateEnums`, rồi `sortByPathThenCode`.
- `findIntroducedIssues(before: SchemaDocument, after: SchemaDocument): readonly Issue[]`: các issue của `validateSchema(after)` mà không có trong `validateSchema(before)`, so theo cặp `code` và `path` (khóa so sánh là `code` cộng `JSON.stringify(path)`), giữ thứ tự của `after`. Nhận hai schema thay vì hai danh sách issue để backend không thể truyền nhầm danh sách.

**Test viết trước:**

- `validate-schema.test.ts`:
  - `returns no issues for a schema built from factory defaults`; `combines issues from every rule`; `sorts issues by path, then by code`; `returns the same issues when map keys are inserted in a different order`.
  - ED-01: `ED-01 reports two tables with the same name`.
  - ED-02: `ED-02 reports two columns with the same name in one table`; `ED-02 reports an invalid attribute combination`.
  - ED-03: `ED-03 reports a foreign key column whose type differs from the referenced column`.
  - ED-05: `ED-05 reports an enum without values`; `ED-05 reports an enum with duplicate values`.
- `find-introduced-issues.test.ts`: `returns an empty list when both schemas have the same issues`; `returns only the issue that appears after the change`; `does not return an issue that already existed before`; `treats the same code on a different path as a new issue`; `does not return issues that were fixed`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add validateSchema and findIntroducedIssues`

## Quy ước chung cho Task 16–19 (handler theo nhóm)

- Mỗi task export đúng một hàm vào cho mỗi nhóm, chữ ký `(schema: SchemaDocument, operation: <Nhóm>Operation) => ApplyResult`, bên trong là `switch` đủ nhánh gọi hàm không export của từng loại. Test gọi hàm vào này.
- Handler **không** chạy lại Zod: Task 20 đã parse operation trước khi gọi. Handler chỉ kiểm tra điều kiện tham chiếu và điều kiện riêng của operation, theo thứ tự trong bảng của task; trả lỗi đầu tiên gặp phải.
- Không mutate `schema`. Map và phần tử không đổi giữ nguyên tham chiếu (structural sharing); test kiểm tra bằng `toBe`.
- **Hợp đồng không đổi gì (Vấn đề 9):** khi operation không làm thay đổi gì (mọi giá trị trong `changes` bằng giá trị hiện tại theo `isJsonEqual`, danh sách mới bằng danh sách cũ, vị trí mới bằng vị trí cũ), trả `acceptOperation(schema, inverse)` với **đúng** tham chiếu `schema` đầu vào. Operation thêm và xóa luôn thay đổi schema.
- Với `updateX`: khóa có giá trị `undefined` coi như không truyền. Nghịch đảo là `updateX` cùng id, với giá trị cũ của đúng các khóa đã truyền.
- Nghịch đảo được tính từ schema trước khi áp. Test nghịch đảo kiểm tra toàn bộ operation nghịch đảo bằng `toStrictEqual`; với nghịch đảo cùng nhóm, test còn áp nghịch đảo và so kết quả với schema ban đầu. Vòng nghịch đảo cần nhóm khác (ví dụ nghịch đảo của `removeTable`) được test ở Task 20.
- Dữ liệu test dựng bằng `buildSchema` và `make*`; lấy kết quả bằng `unwrapOk`, `unwrapError`.

## Task 16: Operation của bảng

**Mục tiêu:** `addTable`, `updateTable`, `setPrimaryKey`, `removeTable` kèm xóa phần phụ thuộc và nghịch đảo.

**Phụ thuộc:** Task 14. **Đợt:** 8.

**File sở hữu (tạo):** `packages/core/src/operations/table-operations.ts`, `table-operations.test.ts`; `packages/core/src/operations/remove-table.ts`, `remove-table.test.ts`.

**Cài đặt:** `applyTableOperation(schema, operation: TableOperation): ApplyResult` trong `table-operations.ts`; `removeTable` nằm trong `remove-table.ts`.

| Operation | Điều kiện (mã, `path` trong operation) | Tác động | Nghịch đảo |
|---|---|---|---|
| `addTable` | `id-already-exists` `["table", "id"]`; `subjectAreaId` khác `null` không tồn tại → `subject-area-not-found` `["table", "subjectAreaId"]` | Thêm bảng với `columnIds: []`, `primaryKeyColumnIds: []` | `removeTable` |
| `updateTable` | `table-not-found` `["tableId"]`; `subject-area-not-found` `["changes", "subjectAreaId"]` | Gán các khóa đã truyền | `updateTable` với giá trị cũ |
| `setPrimaryKey` | `table-not-found` `["tableId"]`; `checkColumnList` tại `["columnIds"]`. Danh sách rỗng hợp lệ | Thay `primaryKeyColumnIds` | `setPrimaryKey` với danh sách cũ |
| `removeTable` | `table-not-found` `["tableId"]` | Xóa bảng, mọi cột trong `columnIds`, mọi index và quan hệ dùng các cột đó | `batch` theo mục "Thứ tự các bước trong nghịch đảo…" |

**Test viết trước:**

- `table-operations.test.ts`:
  - `adds a table with empty column and primary key lists`; `returns removeTable as the inverse of addTable`; `rejects addTable with id-already-exists at table.id`; `rejects addTable with subject-area-not-found for a missing subject area`.
  - `updates only the fields given in changes`; `ignores a change whose value is undefined`; `returns updateTable with the previous values of the changed fields as the inverse`; `restores the table when the updateTable inverse is applied`; `rejects updateTable with table-not-found`; `rejects updateTable with subject-area-not-found at changes.subjectAreaId`; `removes a table from its subject area by setting subjectAreaId to null`.
  - `sets a composite primary key in the given order`; `clears the primary key with an empty list`; `returns setPrimaryKey with the previous list as the inverse`; `rejects setPrimaryKey with column-not-found at the column index`; `rejects setPrimaryKey with column-not-in-table`; `rejects setPrimaryKey with column-listed-twice`.
  - `returns the same schema reference when updateTable changes nothing`; `returns the same schema reference when setPrimaryKey sets the current list`; `keeps the columns, relations and indexes maps by reference when a table is added`.
- `remove-table.test.ts`: `removes the table and all of its columns`; `removes indexes of the removed table`; `removes relations that point to the removed table`; `removes relations that point from the removed table`; `keeps unrelated tables, columns, indexes and relations by reference`; `returns a batch inverse that re-adds the table, columns in order, primary key, indexes and relations`; `orders re-added indexes and relations by id in the inverse`; `includes setPrimaryKey in the inverse even when the primary key is empty`; `rejects removeTable with table-not-found`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add table operations`

## Task 17: Operation của cột

**Mục tiêu:** `addColumn`, `updateColumn`, `moveColumn`, `removeColumn` kèm xóa phần phụ thuộc và nghịch đảo.

**Phụ thuộc:** Task 14. **Đợt:** 8.

**File sở hữu (tạo):** `packages/core/src/operations/column-operations.ts`, `column-operations.test.ts`; `packages/core/src/operations/remove-column.ts`, `remove-column.test.ts`.

**Cài đặt:** `applyColumnOperation(schema, operation: ColumnOperation): ApplyResult` trong `column-operations.ts`; `removeColumn` nằm trong `remove-column.ts`.

| Operation | Điều kiện (mã, `path`) | Tác động | Nghịch đảo |
|---|---|---|---|
| `addColumn` | `id-already-exists` `["column", "id"]`; `table-not-found` `["column", "tableId"]`; kiểu `enum` trỏ tới enum không tồn tại → `enum-not-found` `["column", "type", "enumId"]`; `insertAt > columnIds.length` → `insert-position-out-of-range` `["insertAt"]` | Thêm cột, chèn id vào `columnIds` tại `insertAt` | `removeColumn` |
| `updateColumn` | `column-not-found` `["columnId"]`; `changes.type` là `enum` trỏ tới enum không tồn tại → `enum-not-found` `["changes", "type", "enumId"]` | Gán các khóa đã truyền | `updateColumn` với giá trị cũ |
| `moveColumn` | `column-not-found` `["columnId"]`; `toIndex >= columnIds.length` → `insert-position-out-of-range` `["toIndex"]` | Cột nằm ở vị trí `toIndex` trong mảng kết quả | `moveColumn` với vị trí cũ |
| `removeColumn` | `column-not-found` `["columnId"]` | Xóa cột; bỏ khỏi `columnIds` và khóa chính; xóa **toàn bộ** index và quan hệ có dùng cột | `batch` theo mục "Thứ tự các bước trong nghịch đảo…" |

**Test viết trước:**

- `column-operations.test.ts`:
  - `adds a column at the start, middle and end of the table` (`it.each`); `returns removeColumn as the inverse of addColumn`; `rejects addColumn with id-already-exists`; `rejects addColumn with table-not-found at column.tableId`; `rejects addColumn with enum-not-found at column.type.enumId`; `rejects addColumn with insert-position-out-of-range when insertAt exceeds the column count`.
  - `updates the type, nullability and default of a column`; `returns updateColumn with the previous values as the inverse`; `restores the column when the updateColumn inverse is applied`; `rejects updateColumn with column-not-found`; `rejects updateColumn with enum-not-found at changes.type.enumId`; `keeps the relation when a column type change creates a type mismatch`.
  - `moves a column to the first and last position` (`it.each`); `returns moveColumn to the previous index as the inverse`; `rejects moveColumn with insert-position-out-of-range`.
  - `returns the same schema reference when updateColumn changes nothing`; `returns the same schema reference when moveColumn keeps the index`.
- `remove-column.test.ts`: `removes the column from the table column list`; `removes the column from the primary key`; `removes every index that contains the column, including multi-column indexes`; `removes every relation that uses the column on either side`; `keeps other indexes and relations of the table`; `returns a batch inverse with addColumn at the previous index`; `includes setPrimaryKey in the inverse only when the column was in the primary key`; `orders re-added indexes and relations by id in the inverse`; `rejects removeColumn with column-not-found`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add column operations`

## Task 18: Operation của quan hệ và index

**Mục tiêu:** thêm, sửa, xóa quan hệ và index với kiểm tra tham chiếu cột.

**Phụ thuộc:** Task 14. **Đợt:** 9.

**File sở hữu (tạo):** `packages/core/src/operations/relation-operations.ts`, `relation-operations.test.ts`; `packages/core/src/operations/index-operations.ts`, `index-operations.test.ts`.

**Cài đặt:** `applyRelationOperation(schema, operation: RelationOperation)` và `applyIndexOperation(schema, operation: IndexOperation)`.

| Operation | Điều kiện (mã, `path`) | Nghịch đảo |
|---|---|---|
| `addRelation` | `id-already-exists` `["relation", "id"]`; `table-not-found` `["relation", "fromTableId"]` rồi `["relation", "toTableId"]`; cột: `checkColumnList` cho danh sách `fromColumnId` với `fromTableId` và cho danh sách `toColumnId` với `toTableId`, chọn lỗi có `path` nhỏ nhất trong `["relation", "columnPairs", i, "fromColumnId" \| "toColumnId"]` | `removeRelation` |
| `updateRelation` | `relation-not-found` `["relationId"]`; nếu có `changes.columnPairs`: kiểm tra như trên với hai bảng của quan hệ, `path` bắt đầu bằng `["changes", "columnPairs", i]` | `updateRelation` với giá trị cũ |
| `removeRelation` | `relation-not-found` `["relationId"]` | `addRelation` với quan hệ cũ |
| `addIndex` | `id-already-exists` `["index", "id"]`; `table-not-found` `["index", "tableId"]`; `checkColumnList` tại `["index", "columnIds"]` | `removeIndex` |
| `updateIndex` | `index-not-found` `["indexId"]`; `checkColumnList` tại `["changes", "columnIds"]` | `updateIndex` với giá trị cũ |
| `removeIndex` | `index-not-found` `["indexId"]` | `addIndex` với index cũ |

**Test viết trước:**

- `relation-operations.test.ts`: `adds a relation with a multi-column foreign key`; `adds a self-referencing relation`; `rejects addRelation with id-already-exists`; `rejects addRelation with table-not-found at relation.toTableId`; `rejects addRelation with column-not-in-table at the fromColumnId of the pair`; `rejects addRelation with column-listed-twice on the to side`; `restores the schema when the addRelation inverse is applied`; `updates kind and referential actions`; `rejects updateRelation with column-not-found at changes.columnPairs`; `returns updateRelation with previous values as the inverse`; `rejects updateRelation with relation-not-found`; `removes a relation and returns addRelation as the inverse`; `returns the same schema reference when updateRelation changes nothing`; `does not reject a relation whose column types differ because that is a semantic issue`.
- `index-operations.test.ts`: `adds a unique multi-column index`; `rejects addIndex with column-not-found at the column index`; `rejects addIndex with column-not-in-table for a column of another table`; `rejects addIndex with table-not-found`; `rejects addIndex with id-already-exists`; `updates the name, columns and uniqueness of an index`; `rejects updateIndex with column-listed-twice at changes.columnIds`; `rejects updateIndex with index-not-found`; `removes an index and returns addIndex as the inverse`; `restores the schema when each index inverse is applied` (`it.each` ba loại); `returns the same schema reference when updateIndex changes nothing`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add relation and index operations`

## Task 19: Operation của enum, subject area, ghi chú, bố cục và tên schema

**Mục tiêu:** chín operation còn lại, không kể `batch`.

**Phụ thuộc:** Task 14. **Đợt:** 9.

**File sở hữu (tạo), mỗi file kèm `<name>.test.ts`:** `packages/core/src/operations/enum-operations.ts`, `subject-area-operations.ts`, `note-operations.ts`, `move-elements.ts`, `rename-schema.ts`.

**Cài đặt:** `applyEnumOperation`, `applySubjectAreaOperation`, `applyNoteOperation` theo nhóm; `applyMoveElements(schema, operation: OperationOfType<"moveElements">)` và `applyRenameSchema(schema, operation: OperationOfType<"renameSchema">)`.

| Operation | Điều kiện (mã, `path`) | Tác động | Nghịch đảo |
|---|---|---|---|
| `addEnum` | `id-already-exists` `["enum", "id"]` | Thêm enum (được rỗng) | `removeEnum` |
| `updateEnum` | `enum-not-found` `["enumId"]` | Gán `name`, `values` (thay cả mảng) | `updateEnum` với giá trị cũ |
| `removeEnum` | `enum-not-found` `["enumId"]`; còn cột có kiểu `enum` trỏ tới → `enum-in-use` `["enumId"]` | Xóa enum | `addEnum` |
| `addSubjectArea` | `id-already-exists` `["subjectArea", "id"]` | Thêm | `removeSubjectArea` |
| `updateSubjectArea` | `subject-area-not-found` `["subjectAreaId"]` | Đổi tên | `updateSubjectArea` với tên cũ |
| `removeSubjectArea` | `subject-area-not-found` `["subjectAreaId"]` | Xóa; bảng thành viên có `subjectAreaId: null` | `batch`: `addSubjectArea`, rồi `updateTable({ subjectAreaId })` cho từng bảng thành viên cũ sắp theo id |
| `addNote`, `updateNote`, `removeNote` | `id-already-exists` `["note", "id"]`; `note-not-found` `["noteId"]` | Thêm, đổi `text`, xóa | `removeNote`; `updateNote` với text cũ; `addNote` |
| `moveElements` | Phần tử `i` là id bảng không tồn tại → `table-not-found`, id ghi chú không tồn tại → `note-not-found`, cùng `path` `["moves", i, "elementId"]` (phân biệt bằng `isTableId`) | Gán vị trí theo thứ tự; id xuất hiện nhiều lần thì lần cuối thắng. Danh sách rỗng hợp lệ | `moveElements` cùng thứ tự id, vị trí trước khi áp |
| `renameSchema` | Không có | Đổi `name` | `renameSchema` với tên cũ |

**Test viết trước:**

- `enum-operations.test.ts`: `adds an enum with no values`; `replaces all values of an enum`; `returns updateEnum with previous values as the inverse`; `rejects updateEnum with enum-not-found`; `removes an unused enum and returns addEnum as the inverse`; `rejects removeEnum with enum-in-use when a column uses the enum`; `leaves a column default pointing to a renamed value unchanged`; `returns the same schema reference when updateEnum sets the current values`.
- `subject-area-operations.test.ts`: `adds a subject area`; `renames a subject area and returns the previous name as the inverse`; `rejects updateSubjectArea with subject-area-not-found`; `removes a subject area and clears subjectAreaId of its member tables`; `returns a batch inverse that re-adds the subject area and restores each member table ordered by id`; `returns a batch inverse with only addSubjectArea when the area has no members`; `rejects removeSubjectArea with subject-area-not-found`.
- `note-operations.test.ts`: `adds a note`; `changes the text of a note and returns the previous text as the inverse`; `removes a note and returns addNote as the inverse`; `rejects updateNote and removeNote with note-not-found` (`it.each`); `rejects addNote with id-already-exists`.
- `move-elements.test.ts`: `moves tables and notes in one operation`; `returns moveElements with previous positions in the same order as the inverse`; `restores every position when the inverse is applied`; `applies the last move when an element appears twice`; `restores the original position after moving an element twice`; `rejects a missing table with table-not-found at the move index`; `rejects a missing note with note-not-found`; `returns the same schema reference for an empty move list`; `returns the same schema reference when every position is unchanged`; `keeps unmoved tables by reference`.
- `rename-schema.test.ts`: `renames the schema and returns the previous name as the inverse`; `accepts an empty name because that is a semantic issue`; `returns the same schema reference when the name is unchanged`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add enum, subject area, note and layout operations`

## Task 20: `applyOperation` và `batch`

**Mục tiêu:** điểm vào duy nhất để áp mọi operation: kiểm tra hình dạng, gọi handler, hỗ trợ `batch` nguyên tử với nghịch đảo phẳng. Test mọi vòng nghịch đảo liên nhóm và các tiêu chí "Core báo lỗi…" dạng operation.

**Phụ thuộc:** Task 16, 17, 18, 19. **Đợt:** 10.

**File sở hữu (tạo):** `packages/core/src/operations/apply-operation.ts`, `apply-operation.test.ts`; `packages/core/src/operations/batch.ts`, `batch.test.ts`.

**Cài đặt:**

- `batch.ts`: `type ApplyStep = (schema: SchemaDocument, operation: Operation) => ApplyResult`; `applyBatch(schema, operation: BatchOperation, applyStep: ApplyStep): ApplyResult`.
  - Áp lần lượt từng bước lên kết quả của bước trước.
  - Bước `i` lỗi → trả lỗi với `path` là `["operations", i, ...error.path]`; không trả schema trung gian nào.
  - Thành công → nghịch đảo là `batch` phẳng theo mục "Độ sâu lồng `batch`".
  - Mọi bước trả đúng tham chiếu đầu vào (kể cả `batch` rỗng) thì kết quả cũng là đúng tham chiếu đó, không cần code riêng.
- `apply-operation.ts`: `applyOperation(schema: SchemaDocument, operation: Operation): ApplyResult`.
  1. `parseOperation(operation)`. Lỗi thì trả lỗi đầu tiên (danh sách đã sắp) làm `OperationError`.
  2. Hàm nội bộ `applyParsedOperation(schema, parsed)`: `switch` đủ nhánh, gom nhãn `case` theo nhóm và gọi `applyTableOperation`, `applyColumnOperation`, `applyRelationOperation`, `applyIndexOperation`, `applyEnumOperation`, `applySubjectAreaOperation`, `applyNoteOperation`, `applyMoveElements`, `applyRenameSchema`, và `applyBatch(schema, parsed, applyParsedOperation)`. Nhánh `default` nhận `never`.
- Không đổi file của Task 14–19. Handler có lỗi thì dừng và báo kèm test tái hiện.

**Test viết trước:**

- `batch.test.ts` (dùng `applyStep` thật từ `applyOperation` hoặc bước giả):
  - `applies steps in order on the result of the previous step`.
  - `returns an error whose path starts with operations and the failing step index`; `keeps the original schema unchanged when a middle step fails`; `prefixes the path at every level for a nested batch error`.
  - `returns the inverses of the steps in reverse order`; `flattens a step inverse that is itself a batch`.
  - `returns the same schema reference and an empty batch inverse for an empty batch`.
- `apply-operation.test.ts`:
  - Hình dạng: `returns invalid-shape with the operation path when the shape is invalid`; `returns invalid-shape for a batch deeper than MAX_BATCH_DEPTH`.
  - Mọi loại (`it.each` trên một kịch bản thành công cho mỗi loại trong 26 loại): `restores the original schema when the inverse of <type> is applied`; `produces the first result again when <type> is re-applied after its inverse`.
  - Vòng nghịch đảo liên nhóm: `restores a table with columns, composite primary key, indexes and relations after removeTable is undone`; `restores a self-referencing relation after removeTable is undone`; `restores a column that was in the primary key, two indexes and two relations after removeColumn is undone`; `restores subject area membership after removeSubjectArea is undone`; `restores the schema after undoing a batch that contains removeTable and removeColumn`.
  - Hợp đồng tham chiếu (Vấn đề 9): `returns the same schema reference when the operation changes nothing`; `returns a new schema reference when the operation changes something`; `reuses unchanged maps of the original schema`.
  - `does not change the input schema when an operation fails`.
  - Tiêu chí editor:
    - `ED-01 leaves no relation pointing to a removed table`.
    - `ED-03 leaves no relation pointing to a removed column`.
    - `ED-04 rejects an index that uses a column that does not exist`; `ED-04 rejects an index that uses a column of another table`; `ED-04 removes indexes that use a removed column`.
    - `ED-05 rejects a column that uses an enum that does not exist`; `ED-05 rejects removing an enum that a column still uses`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add applyOperation with batch support`

## Task 21: `buildManyToMany`

**Mục tiêu:** tạo quan hệ n-n bằng một `batch` undo trong một bước (spec mục 9, "Tạo quan hệ n-n bằng một thao tác").

**Phụ thuộc:** Task 15, Task 20. **Đợt:** 11.

**File sở hữu (tạo):** `packages/core/src/operations/build-many-to-many.ts`, `build-many-to-many.test.ts`.

**Cài đặt:**

- `type ManyToManyInput = { readonly leftTableId: TableId; readonly rightTableId: TableId; readonly junctionTableName: string; readonly position: Position }`.
- `buildManyToMany(schema, input: ManyToManyInput, generateId: GenerateId): Result<Operation, OperationError>`. Hàm không áp operation; caller áp bằng `applyOperation`.
- Lỗi, theo thứ tự:
  - `table-not-found` tại `["leftTableId"]`, rồi tại `["rightTableId"]`.
  - `primary-key-missing` tại `["leftTableId"]`, rồi tại `["rightTableId"]`.
- Id sinh theo thứ tự: bảng trung gian, các cột ứng với khóa chính trái, các cột ứng với khóa chính phải, quan hệ trái, quan hệ phải.
- `batch` trả về:
  1. `addTable` với `name: junctionTableName`, `comment: ""`, `position`, `subjectAreaId: null`.
  2. `addColumn` cho từng cột, `insertAt` tăng dần từ 0. Mỗi cột có `type` chép từ cột khóa chính tương ứng, `isNullable: false`, `defaultValue: null`, `isUnique: false`, `isAutoIncrement: false`, `comment: ""`. Tên theo mục "Tên cột của bảng trung gian n-n".
  3. `setPrimaryKey` gồm mọi cột vừa tạo theo thứ tự tạo.
  4. Hai `addRelation` kiểu `oneToMany` từ bảng trung gian tới bảng trái rồi bảng phải, `columnPairs` ghép cột mới với cột khóa chính theo thứ tự khóa chính, `onDelete: "cascade"`, `onUpdate: "noAction"`.

**Test viết trước:**

- `returns a batch of addTable, addColumn steps, setPrimaryKey and two addRelation steps`.
- `copies the type of each primary key column into the junction column`.
- `creates a junction primary key from every column of two composite primary keys`.
- `names junction columns after the table name and the primary key column name`.
- `suffixes the second column name when both ends are the same table`.
- `suffixes a name that collides across different tables`.
- `sets onDelete cascade and onUpdate noAction on both relations`.
- `generates ids in a fixed order from the id generator`.
- `returns table-not-found at leftTableId for a missing left table`.
- `returns primary-key-missing at rightTableId when the right table has no primary key`.
- `restores the original schema when the inverse of the applied batch is applied`.
- `introduces no semantic issues when the junction table name is unused`.
- ED-03: `ED-03 creates a junction table with two one-to-many relations that one undo removes`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add buildManyToMany`

## Task 22: `suggestIndexName`

**Mục tiêu:** editor, importer và AI dùng chung một cách đề xuất tên index không trùng (spec mục 6).

**Phụ thuộc:** Task 6. **Đợt:** 8.

**File sở hữu (tạo):** `packages/core/src/operations/suggest-index-name.ts`, `suggest-index-name.test.ts`.

**Cài đặt:**

- `suggestIndexName(schema: SchemaDocument, input: { readonly tableName: string; readonly columnNames: readonly string[]; readonly isUnique: boolean }): string`.
- Nhận tên thay vì id, vì importer (phần 7) đề xuất tên trước khi bảng có trong schema. Hàm luôn trả chuỗi, không có lỗi.
- Thân tên (stem) là `tableName` nối các `columnNames` bằng `_`. Hậu tố là `_idx`, hoặc `_key` khi unique. Ứng viên thứ `n` là `<stem đã cắt>_idx` với `n = 1`, và `<stem đã cắt>_idx<n>` với `n ≥ 2`.
- Stem được cắt theo code point, không tách ký tự nhiều byte, sao cho cả tên tối đa `MAX_NAME_BYTES`.
- Chọn `n` nhỏ nhất mà `toNameKey` của ứng viên không trùng tên index nào trong schema.

**Test viết trước:** `joins the table and column names with an idx suffix`; `uses a key suffix for a unique index`; `appends 2 when the first candidate is already used`; `skips every candidate that is already used`; `compares existing index names without regard to case`; `keeps the suggestion within 63 UTF-8 bytes`; `does not split a multi-byte character when truncating`; `keeps the numeric suffix when truncating`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add suggestIndexName`

## Task 23: Lịch sử undo/redo

**Mục tiêu:** cấu trúc lịch sử thuần dựa trên operation (spec mục 9, "Lịch sử undo/redo").

**Phụ thuộc:** Task 20. **Đợt:** 11.

**File sở hữu (tạo):** `packages/core/src/history/history.ts`, `history.test.ts`.

**Cài đặt:**

- `HistoryEntry`, `History` như spec. `past` và `future` đều là ngăn xếp, phần tử gần nhất ở **cuối** mảng: `past.at(-1)` là mục undo tiếp theo, `future.at(-1)` là mục redo tiếp theo.
- `createEmptyHistory(): History`.
- `recordEntry(history, entry, limit)`: thêm `entry` vào cuối `past`, giữ tối đa `limit` mục mới nhất, `future` rỗng. `limit` không phải số nguyên ≥ 1 là lỗi lập trình, throw `Error`.
- `undo(history, schema)`: `past` rỗng thì trả `null`. Ngược lại áp `inverse` của mục cuối bằng `applyOperation`, chuyển mục đó sang cuối `future`, trả `{ history, schema }`.
- `redo(history, schema)`: `future` rỗng thì trả `null`. Ngược lại áp `operation` của mục cuối, đưa `{ operation, inverse: <nghịch đảo mới> }` vào cuối `past`.
- Áp thất bại trong `undo`, `redo` là lỗi lập trình: throw `Error` có `code` và `path` trong message.

**Test viết trước:** `creates a history with no past and no future`; `appends the recorded entry to past`; `clears future when an entry is recorded`; `drops the oldest entries beyond the limit`; `throws when the limit is less than 1`; `returns null when there is nothing to undo`; `applies the inverse and moves the entry to future on undo`; `returns null when there is nothing to redo`; `applies the operation and stores its new inverse on redo`; `returns the schemas before and after the operation across undo then redo`; `undoes two entries in reverse order`; `throws when the inverse cannot be applied`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add undo and redo history`

## Task 24: `createSampleSchema`

**Mục tiêu:** một schema hợp lệ dùng mọi khái niệm của model (spec mục 13), dựng bằng operation, dùng lại cho snapshot test của generator ở phần 6.

**Phụ thuộc:** Task 15, Task 21. **Đợt:** 12.

**File sở hữu (tạo):** `packages/core/src/testing/sample-schema.ts`, `sample-schema.test.ts`.

**Cài đặt:**

- `createSampleSchema(): SchemaDocument`: dựng một `batch` từ `createEmptySchema("Sample")` với `createCounterIdGenerator()`, áp bằng `applyOperation`, lỗi thì throw `Error`.
- Nội dung tối thiểu (tên có thể khác, nhưng đủ khái niệm):
  - Enum `order_status` (`pending`, `paid`, `shipped`).
  - Subject area `Sales`.
  - `tenants`: `id` `uuid` mặc định `generateUuid`, khóa chính.
  - `users`:
    - `id` `bigint` auto-increment, khóa chính.
    - `tenant_id` `uuid`.
    - `email` `varchar(255)`.
    - `manager_id` `bigint` nullable, quan hệ tự tham chiếu tới `users.id` với `onDelete: "setNull"`.
    - `created_at` `timestamptz` mặc định `currentTimestamp`.
    - `location` kiểu custom `geometry(Point, 4326)`.
    - Index unique nhiều cột `(tenant_id, email)`.
    - Quan hệ 1-n tới `tenants`.
  - `user_profiles`: `user_id` `bigint` khóa chính, quan hệ `oneToOne` tới `users`; `bio` `text`.
  - `orders` thuộc `Sales`:
    - Khóa chính nhiều cột `(tenant_id uuid, order_number integer)`.
    - `status` enum mặc định literal `pending`.
    - `total` `decimal(12, 2)` mặc định `0.00`.
    - `user_id` `bigint`, quan hệ 1-n tới `users`.
  - `order_items` thuộc `Sales`:
    - Khóa chính `(tenant_id, order_number, line_number)`.
    - Khóa ngoại nhiều cột `(tenant_id, order_number)` tới `orders`.
    - `quantity` `integer` mặc định `1`.
  - `tags`: `id` `uuid` khóa chính.
  - Bảng trung gian `user_tags` tạo bằng `buildManyToMany(users, tags)`, thêm cột `assigned_at` `timestamptz` mặc định `currentTimestamp`.
  - Một ghi chú.

**Test viết trước:** `has no semantic issues`; `passes parseSchemaDocument after JSON stringify and parse and equals the original`; `returns structurally equal schemas on every call`; `contains a composite primary key and a composite foreign key`; `contains a one-to-one relation and a self-referencing relation`; `contains a junction table with an extra column`; `contains an enum column with a literal default`; `contains both default expressions and a custom type`; `contains a multi-column unique index, a subject area with members and a note`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `test(core): add sample schema fixture`

## Task 25: Arbitrary và năm property test

**Mục tiêu:** tìm lỗi ở tổ hợp xóa kèm theo và nghịch đảo mà test liệt kê tay bỏ sót (spec mục 13).

**Phụ thuộc:** Task 15, Task 20, Task 21. **Đợt:** 12.

**File sở hữu (tạo):** `packages/core/src/testing/operation-plans.ts`, `operation-plans.test.ts`; `packages/core/src/testing/arbitraries.ts`, `arbitraries.test.ts`; `packages/core/src/operations/apply-operation.properties.test.ts`; `packages/core/src/validation/validate-schema.properties.test.ts`.

**Cài đặt:**

- **`operation-plans.ts`** (không import `fast-check`):
  - Kiểu `OperationPlan` mô tả ý định trừu tượng: loại operation, các số chọn (`picks`), chuỗi, cờ, và cờ `isCorrupted`.
  - Hàm thuần `resolveOperation(schema, plan, generateId): Operation` biến plan thành operation cụ thể trên schema hiện tại. Số chọn lấy modulo số phần tử có sẵn để trỏ tới id có thật.
  - Khi `isCorrupted`, cố ý tạo operation sai điều kiện: id không tồn tại, id đã có, vị trí ngoài danh sách, cột của bảng khác, cột lặp, xóa enum đang dùng.
  - Plan phủ đủ 26 loại, gồm `batch` lồng một cấp và `batch` từ `buildManyToMany`.
  - File quá khoảng 300 dòng thì tách `operation-plans-<nhóm>.ts` trong cùng thư mục và ghi vào báo cáo.
- **`arbitraries.ts`:**
  - `PROPERTY_SEED`, `PROPERTY_RUNS` (mục "Seed của fast-check").
  - `schemaDocumentArbitrary()`: sinh dãy plan (tối đa khoảng 30 bước), áp lần lượt từ `createEmptySchema` bằng `applyOperation`, bỏ qua bước lỗi, id từ một `createCounterIdGenerator()` mới cho mỗi giá trị.
  - `schemaWithOperationArbitrary()`: sinh `{ schema, operation }` bằng `fc.tuple` của dãy plan và một plan cuối, rồi `map`; không dùng `chain` để shrink tốt hơn.
  - `withShuffledKeys(schema, order)`: dựng lại 7 map với thứ tự khóa theo hoán vị do fast-check sinh.
- **`apply-operation.properties.test.ts`**, mỗi property một test, `fc.assert(..., { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS })`, dùng `expect` trong callback:
  1. `produces a schema that passes parseSchemaDocument after a JSON round trip whenever an operation succeeds`.
  2. `restores the original schema when the inverse is applied after a successful operation`.
  3. `reproduces the first result when the operation is applied again after its inverse`.
  4. `returns an error and leaves the input unchanged whenever an operation fails`: input là tài liệu đóng băng lấy từ `parseSchemaDocument`, so với bản chụp JSON trước khi áp.
- **`validate-schema.properties.test.ts`:**
  5. `returns the same issues when the key order of every map is shuffled`.
- **Test chống property rỗng** (`arbitraries.test.ts`, dùng `fc.sample` với seed cố định):
  - `generates every one of the 26 operation types`.
  - `generates operations that succeed at least half of the time`.
  - `generates operations that fail at least one time in ten`.
- **`operation-plans.test.ts`:** `resolves a plan to an operation that references existing ids`; `resolves a corrupted plan to an operation that applyOperation rejects`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung". Chạy thêm `pnpm --filter @schemaforge/core test` lần hai và xác nhận kết quả giống hệt (seed cố định).

**Commit:** `test(core): add property tests for operations and validation`

## Task 29: `buildRelation` (Vấn đề 6)

**Mục tiêu:** hộp thoại tạo quan hệ 1-1, 1-n của editor tạo luôn cột khóa ngoại khớp khóa chính của bảng được tham chiếu, trong một `batch` undo một bước.

**Phụ thuộc:** Task 15, Task 20, Task 22. **Đợt:** 11.

**File sở hữu (tạo):** `packages/core/src/operations/build-relation.ts`, `build-relation.test.ts`.

**Cài đặt:**

- `type RelationInput = { readonly fromTableId: TableId; readonly toTableId: TableId; readonly kind: RelationKind; readonly onDelete: ReferentialAction; readonly onUpdate: ReferentialAction }`.
- `buildRelation(schema, input: RelationInput, generateId: GenerateId): Result<Operation, OperationError>`.
- Lỗi, theo thứ tự:
  - `table-not-found` tại `["fromTableId"]`, rồi tại `["toTableId"]`.
  - `primary-key-missing` tại `["toTableId"]`.
- Id sinh theo thứ tự: các cột mới, quan hệ, index (nếu có).
- `batch` trả về:
  1. `addColumn` cho từng cột khóa chính của bảng đích, theo thứ tự khóa chính, chèn vào cuối bảng nguồn (`insertAt` bằng số cột hiện có cộng vị trí).
     - Tên `<tên bảng đích>_<tên cột khóa chính>`, trùng (theo `toNameKey`) với cột có sẵn của bảng nguồn hoặc tên vừa sinh thì thêm `_2`, `_3`…
     - `type` chép từ cột được tham chiếu; `defaultValue: null`; `isAutoIncrement: false`; `comment: ""`.
     - `isNullable` là `true` khi `onDelete` hoặc `onUpdate` là `setNull`, ngược lại `false`.
     - `isUnique` là `true` khi `kind === "oneToOne"` và chỉ có một cột.
  2. `addRelation` với `columnPairs` ghép cột mới với cột khóa chính theo thứ tự.
  3. Khi `kind === "oneToOne"` và có từ hai cột: `addIndex` unique trên bảng nguồn gồm các cột mới, tên từ `suggestIndexName`.
- Với `setDefault`, cột mới chưa có giá trị mặc định nên còn issue `relation-set-default-without-default` cho tới khi người dùng đặt; hàm dựng không tự bịa giá trị mặc định.
- Quan hệ tự tham chiếu (`fromTableId === toTableId`) hợp lệ.

**Test viết trước:**

- `creates one foreign key column and a one-to-many relation for a single-column primary key`.
- `creates one foreign key column per column of a composite primary key in primary key order`.
- `copies the referenced column types`; `appends the new columns after the existing columns`.
- `makes foreign key columns nullable when onDelete is setNull`.
- `marks the single foreign key column unique for a one-to-one relation`.
- `adds a unique index over the foreign key columns for a composite one-to-one relation`.
- `suffixes a foreign key column name that already exists in the from table`.
- `supports a self-referencing relation`.
- `returns table-not-found at toTableId for a missing target table`; `returns primary-key-missing when the target table has no primary key`.
- `introduces no semantic issues for one-to-many, one-to-one and setNull relations` (`it.each`).
- `leaves relation-set-default-without-default for a setDefault relation`.
- `restores the original schema when the inverse of the applied batch is applied`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add buildRelation for foreign key relations`

## Task 30: `mergeLastEntry` (Vấn đề 7)

**Mục tiêu:** editor gộp các lần sửa liên tục thành một bước undo mà không phá hợp đồng nghịch đảo.

**Phụ thuộc:** Task 23. **Đợt:** 12.

**File sở hữu (tạo):** `packages/core/src/history/merge-last-entry.ts`, `merge-last-entry.test.ts`.

**Cài đặt:**

- `mergeLastEntry(history: History, entry: HistoryEntry): History`.
- `past` rỗng: trả `{ past: [entry], future: [] }`.
- Ngược lại gọi mục cuối là `last`, thay nó bằng `{ operation, inverse }`, `future` rỗng:
  - `operation` là `batch` phẳng gồm các bước của `last.operation` rồi của `entry.operation`.
  - `inverse` là `batch` phẳng gồm các bước của `entry.inverse` rồi của `last.inverse`.
  - "Các bước" của một operation là `operations` nếu nó là `batch`, ngược lại là chính nó.
- Trải phẳng một cấp ở cả hai phía để gộp nhiều lần (mỗi phím gõ) không làm `batch` lồng sâu thêm và không vượt `MAX_BATCH_DEPTH`.
- Không nhận `limit`: gộp không làm `past` dài thêm.

**Test viết trước:** `records the entry when past is empty`; `replaces the last entry with a merged entry`; `clears future when merging`; `undoes both merged changes in one step`; `redoes both merged changes in one step`; `keeps a flat batch after merging three entries`; `keeps entries before the last one unchanged`.

**Kiểm tra:** `pnpm --filter @schemaforge/core typecheck && pnpm --filter @schemaforge/core lint && pnpm --filter @schemaforge/core test`, mong đợi như mục "Quy ước chung".

**Commit:** `feat(core): add mergeLastEntry to coalesce history entries`

## Task 31: Chạy core dưới Zod `jitless` (Vấn đề 8)

**Mục tiêu:** bảo đảm core chạy đúng khi consumer bật `z.config({ jitless: true })` cho CSP chặt, và core không tự dùng `new Function`.

**Phụ thuộc:** Task 20. **Đợt:** 11.

**File sở hữu (tạo):** `packages/core/src/zod-jitless.test.ts`.

**Cài đặt:**

- File test gọi `z.config({ jitless: true })` ở cấp module trước mọi lần parse. Vitest mặc định cô lập module theo từng file test, nên cấu hình này không lan sang file khác. Nếu cấu hình Vitest của phần 1 tắt `isolate`, dừng và báo.
- Không thêm code vào `src/` ngoài test: core không gọi `z.config`.

**Test viết trước:**

- `enables jitless mode in this test file`.
- `parses a valid schema document in jitless mode`.
- `returns the same structural errors in jitless mode`.
- `parses and applies an operation in jitless mode`.
- `does not construct Function while parsing in jitless mode`: `vi.spyOn(globalThis, "Function")`, kiểm tra spy không được gọi. Nếu spy của Vitest không bắt được lời gọi `new`, dừng và báo kèm output.

**Kiểm tra:** như mục "Quy ước chung", thêm:

```bash
grep -rnE "new Function|eval\(|z\.config|z\.compile" packages/core/src --include=*.ts | grep -v "zod-jitless.test.ts"
```

Mong đợi: lệnh `grep` không in dòng nào.

**Commit:** `test(core): verify core under zod jitless mode`

## Task 26: Public API và entry point testing

**Mục tiêu:** frontend và backend dùng core qua đúng hai entry point đã khai báo; không export gì ngoài danh sách.

**Phụ thuộc:** Task 7, 22, 23, 24, 25, 29, 30, 31. **Đợt:** 13.

**File sở hữu:** sửa `packages/core/src/index.ts`, `packages/core/src/index.test.ts`, `packages/core/package.json` (chỉ `exports`), `packages/core/tsconfig.build.json` (chỉ `exclude`); tạo `packages/core/src/testing/index.ts`, `packages/core/src/testing/index.test.ts`.

**Cài đặt:**

- `src/index.ts` giữ `PRODUCT_NAME` (Task 27 bỏ) và export:
  - **Type:** `SchemaDocument`, `IdMap`, `Table`, `Column`, `ColumnType`, `ColumnDefault`, `Relation`, `RelationKind`, `ColumnPair`, `ReferentialAction`, `Index`, `Enum`, `SubjectArea`, `Note`, `Position`, bảy type id, `GenerateId`, `Operation`, `BatchOperation`, `OperationType`, `OperationOfType`, `Issue`, `IssueCode`, `StructuralError`, `StructuralErrorCode`, `OperationError`, `OperationErrorCode`, `ErrorCode`, `DocumentPath`, `Result`, `AppliedOperation`, `ManyToManyInput`, `RelationInput`, `History`, `HistoryEntry`.
  - **Giá trị:** `CURRENT_SCHEMA_VERSION`, `MAX_BATCH_DEPTH`, `ISSUE_CODES`, `ERROR_CODES`, `createEmptySchema`, bảy hàm `create*Id`, `sortTables`, `sortEnums`, `sortSubjectAreas`, `sortIndexes`, `sortRelations`, `sortNotes`, `parseSchemaDocument`, `parseOperation`, `applyOperation`, `validateSchema`, `findIntroducedIssues`, `buildManyToMany`, `buildRelation`, `suggestIndexName`, `createEmptyHistory`, `recordEntry`, `mergeLastEntry`, `undo`, `redo`.
- Không export schema Zod (spec mục 12: phần 5 export khi cần) và không export helper nội bộ.
- `src/testing/index.ts` export: `createCounterIdGenerator`, `makeTable`, `makeColumn`, `makeRelation`, `makeIndex`, `makeEnum`, `makeSubjectArea`, `makeNote`, `buildSchema`, type `SchemaParts`, `unwrapOk`, `unwrapError`, `createSampleSchema`. Không export gì từ `arbitraries.ts`, `operation-plans*.ts`.
- `package.json`: thêm `"./testing": { "types": "./dist/testing/index.d.ts", "default": "./dist/testing/index.js" }` vào `exports`, giữ `"."`.
- `tsconfig.build.json`: thêm `"src/testing/arbitraries.ts"` và `"src/testing/operation-plans*.ts"` vào `exclude`, giữ `"src/**/*.test.ts"`.

**Test viết trước:**

- `index.test.ts`: `exports exactly the documented runtime values` (so `Object.keys` của `import * as core` đã sắp với danh sách mong đợi); `exposes twenty-five issue codes and seventeen error codes`.
- `testing/index.test.ts`: `exports exactly the documented testing helpers`; `builds a sample schema through the testing entry point`.

**Kiểm tra:** như mục "Quy ước chung", thêm:

```bash
pnpm --filter @schemaforge/core build
ls packages/core/dist/testing
cd backend && node --input-type=module -e 'const core = await import("@schemaforge/core"); const testing = await import("@schemaforge/core/testing"); console.log(typeof core.applyOperation, typeof testing.createSampleSchema)'; cd ..
```

Mong đợi: build thoát mã 0; `dist/testing/` có `index.js`, `factories.js`, `sample-schema.js`, `unwrap-result.js` và **không** có `arbitraries.js`, `operation-plans.js`; lệnh `node` in `function function`.

**Commit:** `feat(core): export public api and testing entry point`

## Task 27: Bỏ `PRODUCT_NAME` khỏi core

**Mục tiêu:** core chỉ còn API của schema; frontend và backend không còn dùng placeholder, mọi lệnh ở root vẫn xanh.

**Phụ thuộc:** Task 26. **Đợt:** 14.

**File sở hữu:** sửa `packages/core/src/index.ts`, `packages/core/src/index.test.ts`, `frontend/src/app/page.tsx`, `frontend/src/app/layout.tsx`, `backend/src/main.ts`; tạo `frontend/src/lib/app-name.ts`. Chạy trước `grep -rn PRODUCT_NAME frontend/src backend/src packages/core/src`; có file dùng `PRODUCT_NAME` ngoài danh sách thì dừng và báo.

**Cài đặt:** theo mục "Thay `PRODUCT_NAME`".

- Core: xóa export `PRODUCT_NAME` và bỏ tên này khỏi danh sách mong đợi trong `index.test.ts`.
- Frontend: `frontend/src/lib/app-name.ts` export `APP_NAME = "SchemaForge"`; `layout.tsx` dùng cho `metadata.title`, `page.tsx` dùng cho `<h1>`. `page.test.tsx` không sửa.
- Backend: `main.ts` import `CURRENT_SCHEMA_VERSION` từ `@schemaforge/core`, log `` `SchemaForge backend listening on port ${String(port)} (schema version ${String(CURRENT_SCHEMA_VERSION)})` ``, với `"SchemaForge"` là hằng cục bộ `APP_NAME` trong `main.ts`.

**Test:** không thêm test mới. `page.test.tsx` (heading `SchemaForge`) và `index.test.ts` đã sửa phải pass.

**Kiểm tra:**

```bash
source ~/.nvm/nvm.sh && nvm use
grep -rn PRODUCT_NAME frontend/src backend/src packages/core/src
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @schemaforge/backend start
```

Mong đợi: `grep` không in dòng nào; bốn lệnh root thoát mã 0; backend ghi log `SchemaForge backend listening on port 3001 (schema version 1)` (dừng bằng Ctrl+C).

**Commit:** `refactor: move product name placeholder out of core`

## Task 28: Tài liệu và kiểm tra toàn repo

**Mục tiêu:** tài liệu phản ánh trạng thái và quyết định mới; toàn repo xanh.

**Phụ thuộc:** Task 27. **Đợt:** 15.

**File sở hữu:** sửa `document/roadmap.md`, `document/architecture.md`, `CLAUDE.md`.

**Cài đặt:**

- `roadmap.md`: phần 2 chuyển sang "Xong".
- `architecture.md`, bảng "Quyết định đã chốt" (tiếng Việt):
  - Dòng "Kiểm tra hình dạng trong core": thêm Zod lấy từ catalog (`^4.6.4`, khớp peer `^4.1.8` của Vercel AI SDK); core không gọi `z.config`; frontend chạy dưới CSP chặt gọi `z.config({ jitless: true })` trước lần parse đầu tiên (Vấn đề 8).
  - Dòng mới "Entry point testing của core": `@schemaforge/core/testing` gồm factory, `unwrapOk`, `unwrapError`, `createSampleSchema`; arbitrary của fast-check là nội bộ.
  - Dòng mới "Nhận biết operation không đổi gì": `applyOperation` trả đúng tham chiếu schema đầu vào (Vấn đề 9).
  - Nếu user chọn khác đề xuất ở Vấn đề 1–7 thì ghi theo lựa chọn đó.
- `CLAUDE.md`: mục "Current status" ghi `packages/core` đã có schema model, validation, operations, lịch sử và entry point `@schemaforge/core/testing`; lệnh không đổi thì giữ nguyên.

**Kiểm tra:**

```bash
source ~/.nvm/nvm.sh && nvm use
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
git status --porcelain
```

Mong đợi: mọi lệnh thoát mã 0; test của core in coverage số dòng ≥ 90%; `git status` chỉ có ba file tài liệu.

**Commit:** `docs: mark core schema model as done`

## Đối chiếu tiêu chí hoàn thành

| Tiêu chí trong spec | Task |
|---|---|
| Type của mọi phần tử, `ColumnType`, `ColumnDefault`, `Operation`, `Issue`, `OperationError` được export từ entry point chính và suy ra từ schema Zod | 2, 3, 11 (suy ra); 26 (export, test danh sách export) |
| `parseSchemaDocument` chấp nhận `sampleSchema` sau `JSON.stringify` và `JSON.parse`, kết quả bằng bản gốc | 5 (parse), 24 (test với `createSampleSchema`) |
| `parseSchemaDocument` từ chối đúng mã và `path` mọi trường hợp bất biến cấu trúc, trường thừa, version mới hơn, khóa `__proto__` | 4, 5. Mã chỉ có ở operation (`id-already-exists`, `relation-not-found`, `index-not-found`, `note-not-found`, `enum-in-use`, `insert-position-out-of-range`, `primary-key-missing`) được test ở 16–21 |
| `validateSchema` trả đúng `code` và `path` cho mọi mã issue; `sampleSchema` không có issue | 9, 10, 12, 13, 15; 24 |
| Cả 26 loại operation được cài đặt, mỗi loại trả nghịch đảo đúng bảng ở mục 9 | 16, 17, 18, 19, 20 (vòng nghịch đảo cho đủ 26 loại qua `applyOperation`) |
| Xóa kéo theo đúng bảng ở mục 9; `removeEnum` khi enum đang dùng bị từ chối với `enum-in-use` | 16, 17, 19, 20 |
| `batch` lỗi ở một bước thì trả lỗi có `path` bắt đầu bằng `["operations", i]` và không đổi schema | 20 |
| `buildManyToMany` tạo bảng trung gian có khóa chính nhiều cột và hai quan hệ 1-n; áp nghịch đảo trả về schema ban đầu | 21 |
| `undo` rồi `redo` trả đúng schema trước và sau thao tác; ghi mục mới xóa `future` | 23 |
| `findIntroducedIssues` chỉ trả issue mới | 15 |
| Cả năm tính chất property test qua với seed cố định | 25 |
| Mỗi tiêu chí "Core báo lỗi…" của ED-01 đến ED-05 có test đặt tên theo tiêu chí | ED-01: 15, 20. ED-02: 12, 15. ED-03: 13, 15, 20, 21. ED-04: 5, 20. ED-05: 13, 15, 20 |
| `packages/core` chỉ có runtime dependency là Zod, không dùng API riêng của trình duyệt hay Node, coverage số dòng ≥ 90% | 1 (dependency); lint và build ở mọi task; 31 (không `new Function`); 28 (kiểm tra toàn repo) |
| `architecture.md` ghi quyết định mới; `roadmap.md` cập nhật trạng thái phần 2 | 28 (quyết định chi tiết của model, Zod trong core, fast-check đã có trong `architecture.md` từ commit spec; Task 28 bổ sung các quyết định của plan) |

Bổ sung từ spec phần 3:

| Yêu cầu | Task |
|---|---|
| Hàm dựng quan hệ 1-1, 1-n kèm cột khóa ngoại (Vấn đề 6) | 29, 26 |
| Gộp mục lịch sử cuối (Vấn đề 7) | 30, 26 |
| Chạy dưới CSP chặt với Zod `jitless` (Vấn đề 8) | 31, 28 |
| Nhận biết operation không đổi gì (Vấn đề 9) | 14, 16, 17, 18, 19, 20, 28 |
| Entry point testing | Mục "Entry point testing", 26 |
