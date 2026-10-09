# Task 28: Import trong editor và chế độ gộp

Plan: [Task 28](../../plans/2026-10-03-import-export-plan.md#task-28-import-trong-editor-và-chế-độ-gộp). Spec: [2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md) (mục 2 "Thêm vào schema hiện tại", mục 12 "Điểm vào", "Xác nhận", "Đóng hộp thoại").

## 2026-10-09 12:05 — frontend-engineer — Dừng giữa chừng

- **Đã làm**
  - `computeMergeOrigin(nodes, gap)`: không node thì `{0,0}`, còn lại `{ x: max(x+width)+gap, y: min(y) }`, làm tròn.
  - `useMergeImport()`: chặn khi `selectIsPreviewing` (thông báo `import.errors.previewing`), chặn khi `store.getState().document !== confirmation.target` (thông báo `import.errors.notApplied`), rồi `dispatch(operation)` đúng một lần qua đường mutation duy nhất của store (core `applyOperation` kiểm tra; batch bị từ chối thì store đã báo lỗi và không làm gì thêm), chọn mọi bảng `addTable` trong batch, `fitNodes(id)`, toast `import.done` (`count` = số bảng) với action "Hoàn tác" chỉ undo khi mục lịch sử của import vẫn là mục cuối (giống `useDeleteSelection`).
  - `EditorImportButton`: nút ghost có icon + nhãn `importExport:import.open`, `disabled` khi xem trước đề xuất AI, `isBlocked={isPreviewing}` cho `ImportDialog`, giữ ref nút và truyền `onReturnFocus`. `mergeTarget` (tài liệu + origin từ `getMeasuredNodes()` và `IMPORT_LAYOUT_METRICS.gap`) chụp lúc bấm mở, để bước xem trước và batch xác nhận cùng một tài liệu.
  - Gắn nút vào toolbar ngay trước `ExportMenu`.
  - Journey `import-export.test.tsx`: gộp JSON vào schema đang mở (đổi tên `users` → `users_2`, autosave lưu, một lần "Hoàn tác" trên toast về đúng hai bảng cũ và autosave lưu lại), JSON hỏng không đổi schema.
- **File thay đổi**
  - `frontend/src/features/editor/import-export/compute-merge-origin.ts` (+ `.test.ts`) — tạo
  - `frontend/src/features/editor/import-export/use-merge-import.ts` (+ `.test.tsx`) — tạo
  - `frontend/src/features/editor/import-export/editor-import-button.tsx` (+ `.test.tsx`) — tạo
  - `frontend/src/features/editor/journeys/import-export.test.tsx` — tạo
  - `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`, `editor-toolbar.test.tsx` — sửa (test thứ tự cũ "export menu after the add buttons" đổi thành "shows the import button next to the export menu", thêm test nút bị tắt khi xem trước)
  - Không sửa `components/import-dialog/` (Task 25) hay file của Task 26.
- **Kiểm tra**
  - RED: `pnpm exec vitest run …/compute-merge-origin.test.ts …/use-merge-import.test.tsx` → `Failed to resolve import "./compute-merge-origin"` / `"./use-merge-import"`; GREEN sau khi cài: `Tests 8 passed (8)`. Test của `EditorImportButton` viết sau component (không có bước RED riêng).
  - `.claude/scripts/verify.sh frontend --format` → lần 1 `RESULT: FAIL (format (prettier --check))` (4 file); sau `prettier --write`: `PASS frontend typecheck`, `PASS frontend lint`, `PASS frontend test` (`Tests 5416 passed (5416)`, coverage lines 96.22%), `PASS format`, `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Task 26 (`usePendingImport`, `useCreateImportedSchema`) chưa merge khi làm (chạy song song), nên: chế độ "Tạo schema mới" mở từ editor chưa làm gì khi xác nhận, và dialect SQL nhớ bằng `useState` cục bộ của nút. Hai chỗ có `TODO(plan Task 28)` trong `editor-import-button.tsx`.
  - Chụp `mergeTarget` khi mở thay vì đọc mỗi lần render: tài liệu đổi trong lúc mở thì `useMergeImport` báo `notApplied` thay vì áp batch lên tài liệu khác (Vấn đề 17).
  - Test nút mock `createImporterClient` (ranh giới worker) bằng `createFakeImporterClient`, không thêm prop `createClient` vào nút.
  - Journey dùng nút "Hoàn tác" trên toast (toolbar cũng có nút "Undo" cùng tên).
- **Việc còn lại**
  - [ ] Sau khi Task 26 merge: trong `frontend/src/features/editor/import-export/editor-import-button.tsx`, thay `useState` dialect bằng `const { lastSqlDialect, setLastSqlDialect } = usePendingImport()` (`@/components/pending-import-provider`), và trong `confirm` gọi `createImportedSchema(confirmation)` (từ `useCreateImportedSchema()` ở `@/components/import-dialog/use-create-imported-schema`, `void` vì hook tự báo lỗi) khi `confirmation.mode === "new"`; xóa hai `TODO(plan Task 28)`. Cần thêm `vi.mock("next/navigation")` và provider của Task 26 vào `editor-import-button.test.tsx` và `editor-toolbar.test.tsx` nếu render cần.
  - [ ] Sau khi Task 26 merge: thêm vào `frontend/src/features/editor/journeys/import-export.test.tsx` hai journey của plan: `exports json from the editor and imports it as a new identical schema` và `applies a new-mode import from the editor once under StrictMode`; thêm test `editor-import-button.test.tsx` cho xác nhận chế độ mới.
- **Ghi chú cho người tiếp theo**
  - Khi xem trước AI bắt đầu lúc hộp thoại mở, hộp thoại đóng và `onReturnFocus` gọi `focus()` trên nút đang `disabled`, nên focus rơi về `body`. Cần kiểm tra tay (trên `pnpm dev`) xem thanh xem trước đề xuất có tự nhận focus không; nếu không, cân nhắc `aria-disabled` thay cho `disabled`.
  - Kiểm tra tay còn cần: origin gộp không chồng bảng cũ trên trình duyệt thật (kích thước đo thật), fit khung nhìn quanh bảng mới, độ tương phản nút ở hai theme.

## 2026-10-09 12:14 — frontend-engineer — Xong

- **Đã làm**
  - Commit WIP `wip: task 28` rồi `git merge master` (e52a219, đã có Task 26): merge sạch, không xung đột (`render-with-providers.tsx` của Task 26 đã có `PendingImportProvider` trong cây `auth`).
  - `EditorImportButton`: dialect SQL đọc/ghi qua `usePendingImport()` (`lastSqlDialect`, `setLastSqlDialect`), dùng chung với màn hình danh sách; `confirm` chế độ `new` gọi `void createImportedSchema(confirmation)` (`useCreateImportedSchema`, hook tự báo lỗi), chế độ `merge` gọi `useMergeImport`. Xóa hai `TODO(plan Task 28)`.
  - Focus khi xem trước AI bắt đầu lúc hộp thoại mở: nút Import dùng `aria-disabled` thay cho `disabled` (vẫn nhận focus, `open()` bỏ qua khi `isPreviewing`, kiểu `aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`), nên `onReturnFocus` trả focus về nút thay vì rơi về `body`.
  - Journey mới trong `import-export.test.tsx` (harness đổi `EditorScreen` theo `router.push` trong cùng cây provider, bọc `<StrictMode>`; `downloadBlob` mock ở ranh giới tải file): `exports json from the editor and imports it as a new identical schema`, `applies a new-mode import from the editor once under StrictMode`.
  - Test đơn vị `editor-import-button.test.tsx`: `creates a new schema and opens it when the new mode is confirmed`, `keeps focus on the import button when an AI preview closes the dialog`, `does not open the dialog during an AI proposal preview` (click và Enter); test xem trước cũ đổi sang kiểm `aria-disabled="true"`. Render có `auth` (fake-indexeddb, repository thật) và `vi.mock("next/navigation")`. `editor-toolbar.test.tsx`: đổi kiểm `disabled` sang `aria-disabled`.
- **File thay đổi**
  - `frontend/src/features/editor/import-export/editor-import-button.tsx` — sửa
  - `frontend/src/features/editor/import-export/editor-import-button.test.tsx` — sửa
  - `frontend/src/features/editor/journeys/import-export.test.tsx` — sửa
  - `frontend/src/features/editor/components/toolbar/editor-toolbar.test.tsx` — sửa
- **Kiểm tra**
  - RED journey: `pnpm exec vitest run src/features/editor/journeys/import-export.test.tsx` → 2 journey mới `AssertionError: expected "vi.fn()" to be called once, but got 0 times` (chế độ mới chưa làm gì), `Tests 2 failed | 2 passed (4)`.
  - RED đơn vị: `editor-import-button.test.tsx` + `editor-toolbar.test.tsx` → `Tests 4 failed | 34 passed (38)` (push không được gọi; `aria-disabled` là `null`; focus là `<body>`). `does not open the dialog…` đã xanh từ đầu (hành vi giữ nguyên từ `disabled`).
  - GREEN: `vitest run src/features/editor/import-export/ …/editor-toolbar.test.tsx …/journeys/import-export.test.tsx` → còn 1 lỗi do assertion của test (`listSchemas` trả `{kind, schema}`), sửa test → `Tests 8 passed (8)`.
  - `.claude/scripts/verify.sh frontend --format` → lần 1 `RESULT: FAIL (frontend lint, format (prettier --check))` (`no-unsafe-assignment` do `expect.objectContaining`, đổi sang `toMatchObject`; 3 file chưa format); lần 2: `PASS frontend typecheck`, `PASS frontend lint`, `PASS frontend test` (`Tests 5446 passed (5446)`, lines 96.22%), `PASS format`, `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `aria-disabled` thay cho `disabled` chỉ ở nút Import (plan ghi `disabled`): là nút duy nhất trả focus từ hộp thoại mà xem trước AI (tự bắt đầu khi stream AI xong) có thể đóng; `disabled` làm focus rơi về `body` (WCAG 2.4.3). Các nút khác của toolbar giữ `disabled`.
  - Unit test chế độ mới dùng repository thật trên fake-indexeddb và mock `next/navigation`, không mock `useCreateImportedSchema`.
  - Journey StrictMode kiểm "đúng một mục lịch sử" qua UI: một lần Undo về 0 bảng (đã lưu) và nút Undo bị tắt.
- **Việc còn lại** (kiểm tra tay, chuyển cho Task 32)
  - [ ] Trên `pnpm dev`: mở hộp thoại Import, để một đề xuất AI bắt đầu xem trước; hộp thoại đóng, focus nằm trên nút Import (đang mờ), Enter/click không mở hộp thoại, trình đọc màn hình đọc "dimmed/unavailable".
  - [ ] Độ tương phản và kiểu mờ `aria-disabled` của nút Import ở theme sáng và tối.
  - [ ] Từ editor, Import chế độ "Một schema mới": chuyển sang schema mới, một lần Undo về schema rỗng; dialect SQL chọn ở editor được nhớ khi mở Import ở màn hình danh sách.
  - [ ] Còn từ lần trước: origin gộp không chồng bảng cũ với kích thước đo thật, fit khung nhìn quanh bảng mới.
- **Ghi chú cho người tiếp theo**
  - Công việc nằm trên commit `wip: task 28` + merge master, phần cuối chưa commit; orchestrator squash khi đưa vào `master`.
  - `EditorImportButton` giờ cần `StorageProvider`, `AuthProvider`, `PendingImportProvider` (qua `useCreateImportedSchema`); test render nó phải truyền `auth` cho `renderWithProviders` và mock `next/navigation`.

## 2026-10-09 12:24 — frontend-engineer — Xong (sửa theo review)

- **Đã làm**
  - Sửa lỗi (project-reviewer): gộp một batch rỗng (JSON schema rỗng, SQL không có bảng) thì `dispatch` trả `isOk` nhưng không ghi mục lịch sử, nên "Hoàn tác" trên toast undo thay đổi trước đó của người dùng. `useMergeImport` giờ đọc `previousEntry = history.past.at(-1)` trước khi dispatch; nếu sau dispatch mục cuối vẫn là `previousEntry` thì chỉ báo `import.done` với `count: 0`, không có action, không chọn, không `fitNodes`.
  - A11y (ui-a11y-reviewer): bấm nút Import đang `aria-disabled` (click hoặc Enter) giờ báo lỗi `importExport:import.errors.previewing` thay vì im lặng; tắt màu hover khi `aria-disabled` (`aria-disabled:hover:bg-transparent aria-disabled:hover:text-inherit`), giữ con trỏ `not-allowed` (không dùng `pointer-events-none` vì nó làm mất con trỏ này).
  - Nit: journey StrictMode kiểm thêm không có toast `errors:operationNotApplied` ("The action was not applied"); sửa chú thích "widest" thành "rightmost"; chuyển `EditorRouteHarness`/`openRoutedEditor` sang helper test `frontend/src/testing/mount-routed-editor.tsx` (`mountRoutedEditor(environment, schemaId, push)`), journey còn 256 dòng.
- **File thay đổi**
  - `frontend/src/features/editor/import-export/use-merge-import.ts`, `use-merge-import.test.tsx` — sửa
  - `frontend/src/features/editor/import-export/editor-import-button.tsx`, `editor-import-button.test.tsx` — sửa (thêm `toast.dismiss()` trong `afterEach`)
  - `frontend/src/features/editor/journeys/import-export.test.tsx` — sửa
  - `frontend/src/testing/mount-routed-editor.tsx` — tạo
- **Kiểm tra**
  - RED: `pnpm exec vitest run src/features/editor/import-export/use-merge-import.test.tsx` → `offers no undo when an empty import changes nothing`: `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times` (`fitNodes`), `Tests 1 failed | 6 passed (7)`. Test toast/Enter của nút viết cùng lúc với sửa code (không có bước RED riêng).
  - GREEN: `vitest run …/import-export/ …/journeys/import-export.test.tsx …/editor-toolbar.test.tsx` → `Tests 93 passed (93)`.
  - `.claude/scripts/verify.sh frontend --format` → exit 0: `PASS frontend typecheck`, `PASS frontend lint`, `PASS frontend test` (`Tests 5448 passed (5448)`, lines 96.23%), `PASS format`, `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `aria-disabled` thay cho `disabled` ở nút Import là ngoại lệ có chủ ý đã được chấp nhận (WCAG 2.4.3, trả focus khi xem trước AI đóng hộp thoại).
  - Origin gộp dùng `getMeasuredNodes` (gồm cả note và subject area); spec-writer sẽ chỉnh spec sau (ghi chú cho Task 33).
  - Import rỗng vẫn báo thành công với `count: 0` (không có "Hoàn tác") thay vì báo lỗi.
- **Việc còn lại** (kiểm tra tay, chuyển cho Task 32)
  - [ ] Như mục trước; thêm: trên `pnpm dev`, bấm nút Import mờ khi đang xem trước đề xuất AI hiện toast "An AI suggestion is being previewed…", hover không đổi màu nền ở hai theme.
- **Ghi chú cho người tiếp theo**
  - Journey cần chuyển editor theo `router.push` dùng `mountRoutedEditor` (mock `next/navigation` với `push` từ `vi.hoisted` trong file test).
