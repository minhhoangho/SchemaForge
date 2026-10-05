# Task 4: Giải tham chiếu và `assembleDocument`

- Plan: [2026-10-03-import-export-plan.md, Task 4](../../plans/2026-10-03-import-export-plan.md#task-4-giải-tham-chiếu-và-assembledocument)
- Spec: [2026-09-15-import-export-design.md, mục 1 "Luồng bên trong một importer"](../../specs/2026-09-15-import-export-design.md#luồng-bên-trong-một-importer), [mục 4](../../specs/2026-09-15-import-export-design.md#4-vị-trí-bảng-khi-import)

## 2026-10-05 17:18 — core-engineer — Xong

- **Đã làm**
  - `resolve-references.ts`: `createNameResolver(names): NameResolver` (khớp chính xác trước, lặp tên thì lấy vị trí đầu; rồi khớp `toNameKey` nếu chỉ một tên; còn lại `null`; dùng hai `Map`). `resolveDraftReferences(draft): ResolvedDraft` giải enum của cột, subject area của bảng, khóa chính, bảng và cột của index, quan hệ; phần tử không giải được bị bỏ kèm `reference-not-found` tại `location` của nó. `elementAt` (vị trí ngoài mảng là lỗi lập trình, throw `RangeError`).
  - `assemble-document.ts`: `assembleDocument(draft, options): ImportResult` đúng 8 bước của plan: đếm phần tử draft (vượt `MAX_IMPORTED_ELEMENTS` thì `err(tooManyElementsFailure())`), giải tham chiếu, cấp id theo thứ tự enum, bảng, cột, index, quan hệ, subject area, ghi chú, đặt tên index bằng `suggestIndexName` theo thứ tự draft, xếp vị trí bằng `placeElements`, tên `draft.name ?? fallbackSchemaName`, `parseSchemaDocument` (lỗi thì throw `Error`), đổi `DraftTarget` thành `DocumentPath` rồi `finalizeImportDiagnostics`.
  - TDD: hai file test viết trước, đỏ vì `Cannot find module './resolve-references.js'` và `'./assemble-document.js'`, rồi xanh sau khi cài đặt.
- **File thay đổi**
  - `packages/core/src/importers/shared/resolve-references.ts` (mới)
  - `packages/core/src/importers/shared/resolve-references.test.ts` (mới, 9 test)
  - `packages/core/src/importers/shared/assemble-document.ts` (mới)
  - `packages/core/src/importers/shared/assemble-document.test.ts` (mới, 34 test)
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/importers/shared/resolve-references.test.ts`: đỏ (module chưa có) rồi `RESULT: PASS`.
  - `.claude/scripts/test-file.sh core src/importers/shared/assemble-document.test.ts`: đỏ (module chưa có) rồi `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test (3147 test pass, coverage dòng 97.64%), build, prettier đều PASS; `RESULT: PASS`. Coverage câu lệnh: `assemble-document.ts` 85/87 (hai câu không chạy là nhánh `never`), `resolve-references.ts` 73/73.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Id cấp cho mọi bảng trước rồi mới tới cột (bảng theo thứ tự draft, cột theo từng bảng), giống `toComparableSchema`; phần tử bị bỏ không nhận id.
  - Cột bị bỏ vì enum không giải được thì không còn trong bộ giải tên cột của bảng, nên khóa chính, index, quan hệ dùng cột đó cũng bị bỏ kèm `reference-not-found` riêng.
  - Khóa chính không giải được báo tại `location` của bảng (khóa chính không có vị trí riêng); subject area không giải được cũng báo tại vị trí bảng.
  - `suggestIndexName` nhận tên đã giải (tên thật của bảng và cột trong tài liệu), không phải tên viết trong draft.
  - `placeElements` nhận số cột còn giữ và tên thật của subject area đã giải (`null` khi không giải được), theo ghi chú của Task 5.
  - `DraftTarget` trỏ tới cột, index, quan hệ đã bị bỏ thì `path: null`; trỏ ra ngoài mảng của draft là lỗi lập trình của importer và throw `RangeError`.
  - Hai tên giống hệt nhau (ví dụ hai bảng `users` khác namespace) thì tham chiếu chính xác lấy tên đầu; tham chiếu chỉ khớp không phân biệt hoa thường tới hai tên như vậy cho `null`.
  - Giữ test `throws when the assembled document breaks a structural invariant` bằng khóa chính `["id", "ID"]`: resolver giải cả hai về cùng một cột, `parseSchemaDocument` báo `column-listed-twice`.
  - Thêm test ngoài danh sách plan cho từng quy tắc: bảng, cột của index; bảng hai phía của quan hệ; cột có enum không giải được và hệ quả lên index; subject area không giải được; khớp không phân biệt hoa thường; tên index thứ hai tránh tên thứ nhất; target trỏ tới phần tử bị bỏ; target `null`; bỏ trùng và sắp diagnostic; đúng giới hạn phần tử; target ngoài mảng.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `assemble-document.ts` dài 383 dòng sau prettier, quá mức khoảng 300 dòng của `code-quality.md`; plan chỉ cho hai file nên chưa tách. Nếu orchestrator đồng ý, có thể tách phần cấp id (`assignIds`) và phần đổi `DraftTarget` thành `DocumentPath` ra hai file riêng trong `importers/shared/`.
  - Draft lặp cột trong khóa chính, index hay cặp cột quan hệ (kể cả `id` và `ID` cùng giải về một cột), index không có cột, hay quan hệ không có cặp cột đều làm `assembleDocument` throw. Importer định dạng (Task 12, 15, 16) phải tự loại hoặc báo các trường hợp đó trước khi dựng draft, vì importer không được throw với input bất kỳ (Task 18 có property test).
  - Importer gọi `assembleDocument(draft, options)` sau khi parse; diagnostic của draft dùng `DraftTarget` theo vị trí trong mảng của draft (cột theo `columnIndex` gốc, kể cả khi cột trước nó bị bỏ).

## 2026-10-05 17:40 — core-engineer — Xong

Theo quyết định của orchestrator sau lần chạy đầu: tách file quá dài, và sửa một lần trong `assembleDocument` để importer định dạng không throw vì danh sách cột lặp hoặc rỗng. Mục "Ghi chú cho người tiếp theo" thứ hai của lần chạy trước (draft lặp cột hay rỗng làm throw) không còn đúng; xem mục **Quyết định** dưới đây.

- **Đã làm**
  - Tách `assemble-document.ts` (383 dòng) thành ba file: `assign-import-ids.ts` (`AssignedIds`, `assignImportIds`, cấp id theo thứ tự đã ghi trong spec), `draft-target-path.ts` (`toDocumentPath(target, draft, ids)`, đổi `DraftTarget` thành `DocumentPath`), `assemble-document.ts` còn lại phần dựng tài liệu. Hành vi không đổi, ngoài các quy tắc dưới đây.
  - `resolve-references.ts`: khóa chính và index bỏ cột lặp sau khi giải tên, giữ lần xuất hiện đầu (`["id", "ID"]` thành một cột). Quan hệ bỏ cặp cột lặp y hệt; nếu sau đó một cột vẫn xuất hiện hai lần ở một phía thì bỏ quan hệ, kèm `reference-not-found` tại `location` của quan hệ (`path: null`). Index không có cột hay quan hệ không có cặp cột trong draft thì bị bỏ, không có diagnostic: importer định dạng tự báo bằng mã sẵn có (ví dụ `index-expression-not-supported`), như comment trong code ghi.
  - TDD: viết trước 8 test mới (bỏ cột lặp ở khóa chính, ở index; bỏ cặp lặp của quan hệ; bỏ quan hệ dùng một cột hai lần ở phía `from` hoặc `to`; bỏ index không cột, quan hệ không cặp; target của index bị bỏ vì không cột cho `path: null`); 8 test đỏ vì `assembleDocument` throw, rồi xanh. Test throw `["id", "ID"]` của plan được thay bằng test bỏ cột lặp. Thêm test `throws when the draft holds a value outside the model shape` (decimal `precision: 0`) để giữ nhánh throw sau `parseSchemaDocument` có test.
- **File thay đổi**
  - `packages/core/src/importers/shared/assemble-document.ts` (sửa, 261 dòng)
  - `packages/core/src/importers/shared/assign-import-ids.ts` (mới, 82 dòng)
  - `packages/core/src/importers/shared/draft-target-path.ts` (mới, 70 dòng)
  - `packages/core/src/importers/shared/resolve-references.ts` (sửa, 287 dòng)
  - `packages/core/src/importers/shared/assemble-document.test.ts` (sửa, 41 test)
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/importers/shared/assemble-document.test.ts`: `Tests  8 failed | 32 passed (40)` rồi `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test (3155 test pass, coverage dòng 97.64%), build, prettier đều PASS; `RESULT: PASS`. Coverage câu lệnh: `assemble-document.ts` 58/58 (sau test mới), `assign-import-ids.ts` 12/12, `draft-target-path.ts` 16/18 (hai câu là nhánh `never`), `resolve-references.ts` 82/82.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Tách file theo quyết định của orchestrator: thêm `assign-import-ids.ts` và `draft-target-path.ts` vào file sở hữu của Task 4. Không cần test riêng cho hai file vì test của `assembleDocument` đã phủ đủ.
  - **Quan trọng: `assembleDocument` chấp nhận danh sách cột lặp hoặc rỗng, nên importer định dạng không bao giờ throw vì chúng.** Sửa một lần ở nguyên nhân chung thay vì ở từng importer, không thêm mã diagnostic, không đổi spec. Bỏ cột lặp không mất thông tin vì liệt kê một cột hai lần không thêm ý nghĩa.
  - Bỏ trùng cặp cột theo cặp vị trí đã giải (`USER_ID`→`ID` trùng `user_id`→`id`).
  - `assembleDocument` chỉ còn throw với lỗi lập trình thật: target của diagnostic trỏ ra ngoài mảng của draft (`RangeError` từ `elementAt`); tài liệu vẫn không qua `parseSchemaDocument` (ví dụ giá trị ngoài hình dạng của model như decimal `precision: 0`); `generateId` trả token sai dạng (`createId`); `layout` có số âm hoặc không hữu hạn (`RangeError` của `placeElements`).
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Importer định dạng (Task 12, 15, 16) vẫn phải đưa vào draft kiểu cột và giá trị đúng hình dạng của model (ví dụ decimal `precision` ≥ 1, độ dài `char`, `varchar` ≥ 1), và tự báo index hay quan hệ không có cột bằng mã của mình trước khi dựng draft.
