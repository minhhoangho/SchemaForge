# Task 6: `buildImportOperation`

- Plan: [Task 6](../../plans/2026-10-03-import-export-plan.md#task-6-buildimportoperation)
- Spec: [mục 2 "Thêm vào schema hiện tại", "Hàm dựng"](../../specs/2026-09-15-import-export-design.md); plan mục "Vấn đề phát hiện khi lập plan" dòng 7 và 11

## 2026-10-05 — core-engineer — Xong

- **Đã làm**
  - Gộp hai bản riêng của `pickUnusedName` (`build-many-to-many.ts`, `build-relation.ts`) thành `operations/pick-unused-name.ts`, không đổi hành vi. `build-many-to-many.test.ts` và `build-relation.test.ts` pass nguyên vẹn.
  - `buildImportOperation(target, imported, mode, generateId)` trả `{ operation: BatchOperation, diagnostics }`, kèm type `ImportMode` và `ImportOperationBuild`.
    - Chế độ `new`: `target` có phần tử nào (theo `countDocumentElements` của Task 2) thì throw `Error`. Ngược lại giữ nguyên id, tên (kể cả tên trùng) và vị trí; không có diagnostic.
    - Chế độ `merge`: cấp id mới cho mọi phần tử, đổi mọi tham chiếu, đổi tên trùng bằng `pickUnusedName` kèm diagnostic `*-renamed` (`location: null`, `path` theo id mới, qua `finalizeImportDiagnostics`), tịnh tiến bảng và ghi chú để góc trên trái nằm ở `origin`.
    - Batch luôn phẳng, theo thứ tự: `addEnum`, `addSubjectArea`, rồi mỗi bảng `addTable` + các `addColumn` + `setPrimaryKey` (khi có), rồi `addIndex`, `addRelation`, `addNote`. Không có `renameSchema`.
  - TDD: RED `pick-unused-name.test.ts` và `build-import-operation.test.ts` báo `Cannot find module`, sau đó GREEN. Thêm 4 property test.
- **File thay đổi**
  - Tạo `packages/core/src/operations/pick-unused-name.ts`, `pick-unused-name.test.ts`
  - Tạo `packages/core/src/operations/build-import-operation.ts`, `build-import-operation.test.ts`, `build-import-operation.properties.test.ts`
  - Sửa `packages/core/src/operations/build-many-to-many.ts`, `build-relation.ts` (chỉ import `pickUnusedName` và xóa bản cục bộ cùng hằng `FIRST_SUFFIX_NUMBER`)
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 3120/3120, build, prettier). Coverage số dòng 97.57%, không có dòng báo dưới ngưỡng.
  - `.claude/scripts/verify.sh frontend`: `RESULT: PASS` (có typecheck frontend).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Khi gộp, tập tên của index gồm tên index và tên bảng của đích, **cộng tên mới của các bảng vừa gộp** và tên index đã cấp. Lý do: theo dòng 7 thì tên index không được trùng tên bảng; nếu chỉ so với bảng của đích thì vẫn có thể sinh `index-name-conflicts-table` khi một bảng nhập bị đổi tên trùng với một index nhập. Có test `renames an index that clashes with the new name of a merged table`.
  - Tên trùng **ngay trong `imported`** cũng được đổi ở chế độ gộp (ví dụ bảng và enum cùng tên), vì spec nói "trùng với phần tử của đích **hoặc** với tên vừa cấp". Bảng và enum dùng chung một tập tên; enum được cấp tên trước bảng.
  - Thứ tự cấp id và cấp tên: enum, subject area, bảng (id bảng rồi id các cột của nó theo `columnIds`), index, quan hệ, ghi chú. Trong mỗi loại duyệt theo `sort*` của `imported`. Thứ tự bước trong batch theo `sort*` của tài liệu đã đổi (sau khi đổi tên). Cả hai đều xác định.
  - Tịnh tiến bằng `x - minX + origin.x`, để phần tử ở góc rơi đúng vào `origin`, không lệch dấu phẩy động.
  - Dựng một tài liệu trung gian đã đổi id rồi dùng chung `buildSteps` cho cả hai chế độ, thay vì viết hai đường dựng batch riêng.
  - Dùng lại `countDocumentElements` (Task 2) để kiểm tra đích rỗng, không viết thêm danh sách khóa.
- **Việc còn lại**: không có cho Task 6. Task 17 export `buildImportOperation` và `ImportMode` ở entry chính.
- **Ghi chú cho người tiếp theo**
  - `build-import-operation.ts` dài 387 dòng, vượt hướng dẫn khoảng 300 dòng. Chưa tách vì mục "File sở hữu" chỉ cho phép đúng các file trên. Nếu orchestrator đồng ý, có thể tách phần đổi id khi gộp (`createMergeContext`, `remap*`, `remapForMerge`) sang `operations/remap-merged-document.ts` mà không đổi hành vi.
  - Property test cấp id gộp bằng tiền tố `m` (`m1`, `m2`…), vì `schemaDocumentArbitrary` đánh số id từ 1 cho cả đích lẫn nguồn. Ở frontend, worker phải dùng `generateId` sinh token không trùng với tài liệu của editor.
  - Các nhánh throw phòng thủ (thiếu cột hoặc thiếu id mới) không có test: tài liệu đã parse không bao giờ đi vào các nhánh đó.

## 2026-10-05 — core-engineer — Xong

- **Đã làm**
  - Orchestrator cho phép tách file vì `code-quality.md` giới hạn độ dài file (khoảng 300 dòng). Đã chuyển phần đổi id khi gộp (`MergeContext`, `createMergeContext`, `claimName`, `computeMoveBy`, `remap*`, `keyById`) sang `packages/core/src/operations/remap-merged-document.ts`. Hành vi không đổi.
  - Hàm export mới (nội bộ, không ở entry): `remapMergedDocument(target, imported, origin, generateId): MergedDocument` (`{ document, diagnostics }`, diagnostic chưa qua `finalizeImportDiagnostics`). Hàm `remapForMerge` cũ được gộp vào hàm này. `buildImportOperation` gọi hàm này, rồi finalize diagnostic như trước.
  - Test không đổi. Không thêm test riêng cho file mới: hàm được phủ qua `build-import-operation.test.ts` và `build-import-operation.properties.test.ts`, coverage không giảm.
- **File thay đổi**
  - Tạo `packages/core/src/operations/remap-merged-document.ts` (302 dòng)
  - Sửa `packages/core/src/operations/build-import-operation.ts` (387 dòng còn 111 dòng)
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (test 3120/3120, coverage số dòng 97.57%).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Chỉ export một hàm `remapMergedDocument` từ file mới để giữ bề mặt nhỏ. Việc sắp xếp diagnostic vẫn nằm ở `buildImportOperation`.
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**: ghi chú về độ dài file trong mục trước đã được xử lý bằng lần tách này.
