# Tạo schema mới từ import (Task 26)

- Plan: `document/plans/2026-10-03-import-export-plan.md` Task 26
- Spec: `document/specs/2026-09-15-import-export-design.md` (mục 2 "Tạo schema mới", mục 12 "Điểm vào")

## 2026-10-09 14:30 — frontend-engineer — Xong
- **Đã làm**
  - `PendingImportProvider` + `usePendingImport` (mục chờ trong `useRef` của từng instance, `takePendingImport` đọc và xóa ngay; `lastSqlDialect` trong `useState`; context qua `useMemo`).
  - `useCreateImportedSchema` (cùng đường `createSchema` như "Tạo", có `ownerId` khi đăng nhập, `setPendingImport` rồi `router.push`; lỗi lưu trữ báo `storage:<code>`, log chỉ tên lỗi).
  - `useApplyPendingImport(store)` gọi trong `EditorWorkspace`: bỏ qua khi `selectIsPreviewing`, lấy mục chờ rồi `dispatch` đúng một lần.
  - `ImportSchemaButton` (giữ ref nút, truyền `onReturnFocus`, `mergeTarget={null}`), gắn cạnh "Tạo schema" ở `ReadySchemaList`.
  - `AppProviders` và helper test `render-with-providers.tsx` bọc `PendingImportProvider` trong `SignInPromptProvider`.
  - Test viết SAU code (không có bước RED riêng; đã đọc plan nhưng viết code trước). Journey bắt được 1 lỗi thật: gọi `useApplyPendingImport` trước `useAutosave` thì autosave chưa subscribe nên import không được lưu; đã đặt sau `useCloudPusher`.
- **File thay đổi**
  - Mới: `frontend/src/components/pending-import-provider.tsx` (+ test), `components/import-dialog/use-create-imported-schema.ts` (+ test), `features/editor/hooks/use-apply-pending-import.ts` (+ test), `features/schema-list/components/import-schema-button.tsx` (+ test), `features/schema-list/import-journey.test.tsx`.
  - Sửa: `components/app-providers.tsx` (+ test), `features/editor/components/editor-workspace.tsx`, `features/schema-list/components/schema-list-screen.tsx` (+ test: thêm 1 lần Tab trong test bàn phím, thêm test nút Import), `testing/render-with-providers.tsx`.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` -> typecheck PASS, lint PASS, test PASS (236 file, toàn bộ qua), format PASS, `RESULT: PASS`. secret-scan: xem báo cáo cuối. Lần chạy đầu fail do kiểu trả về `renderButton` (TS1064), lint `await-thenable`, và test Tab trong `schema-list-screen.test.tsx` (thêm nút Import); đã sửa.
- **Quyết định**
  - `usePendingImport` ném lỗi ngoài provider; sửa `render-with-providers.tsx` (không có trong danh sách file của plan) để mọi test dùng `auth` có provider, giống `AppProviders`. Cách khác là mặc định no-op, nhưng sẽ che lỗi cấu hình.
  - Journey không thể dùng `mountSchemaList` rồi `mountEditor` (mỗi lần render tạo provider mới nên mất mục chờ); dùng `RouteHarness` đổi màn hình trong một cây, mô phỏng `AppProviders` giữ nguyên qua đổi route. Worker giả (`InlineImportWorker`) chạy `handleImportRequest` thật qua `vi.stubGlobal("Worker")`, nên `ImportSchemaButton` không cần prop `createClient`.
  - Không sửa gì trong `import-dialog` và không đụng `EditorImportButton`, `computeMergeOrigin`, `useMergeImport`.
- **Ghi chú cho người tiếp theo**
  - Chỉ ảnh hưởng dev: dưới `StrictMode` effect chạy hai lần, autosaver/pusher của lần mount đầu bị dispose sau khi `dispatch`; lần ghi đầu vẫn hoàn tất (đã kiểm tra `save`), nhưng `saveStatus` có thể giữ "saving" đến lần sửa kế tiếp, và pusher của lần mount thứ hai không thấy thay đổi. Production không bị. Nếu thấy trên `pnpm dev`, xem xét dispatch trong microtask.
  - Kiểm tra thủ công chưa làm: Import từ danh sách trên `pnpm dev` (file thật, bàn phím), focus quay về nút Import sau Escape trong trình duyệt thật, hai theme.

## 2026-10-09 15:30 — frontend-engineer — Xong (sửa theo review project-reviewer + ui-a11y-reviewer)
- **Đã làm**
  - `use-apply-pending-import.ts`: lấy mục chờ và `dispatch` trong `queueMicrotask`, huỷ bằng cờ `isActive` ở cleanup; chỉ lượt sống sót của StrictMode dispatch, sau khi autosave/pusher đã subscribe, nên thứ tự hook không còn quan trọng. Xoá comment về thứ tự trong `editor-workspace.tsx`. Test cũ chuyển sang chờ microtask; thêm test hồi quy StrictMode (subscriber khai báo trước hook nhận đúng tài liệu đã import).
  - `schema-list-screen.tsx`: wrapper nút header `flex-wrap justify-end`; trạng thái storage `pending` cũng hiện nút Import (disabled) để Tab/bố cục không dịch chuyển.
  - Test: focus về nút Import sau import thành công (route giữ ở danh sách) và sau lỗi `createSchema` (hộp thoại đóng, toast, focus về nút); `push.mockReset()` trong `use-create-imported-schema.test.tsx`; journey kiểm tra tên schema giữ nguyên sau Undo và mount lại.
- **File thay đổi**: `features/editor/hooks/use-apply-pending-import(.test).ts(x)`, `features/editor/components/editor-workspace.tsx`, `features/schema-list/components/schema-list-screen.tsx`, `features/schema-list/import-journey.test.tsx`, `components/import-dialog/use-create-imported-schema.test.tsx`.
- **Kiểm tra**: xem báo cáo cuối (verify.sh, secret-scan).
- **Quyết định**: giữ nhãn "Import" cho vi (từ mượn, nhất quán); giữ thay đổi `testing/render-with-providers.tsx` (lệch plan đã được duyệt); mục chờ cũ không dọn thêm (theo plan). Test của Task 26 viết sau code (không có bước RED), lệch đã được chấp nhận.
- **Việc còn lại** (kiểm tra thủ công, hoãn sang Task 32)
  - [ ] Import từ danh sách trên `pnpm dev` (file thật, bàn phím), badge "Saved" sau import, cloud khi đăng nhập, focus quay về nút Import, hai theme, bố cục 320/375px.

## 2026-10-09 16:00 — frontend-engineer — Xong (sửa theo react-reviewer)
- **Đã làm**: journey so tên schema thật: `readDocument(...).name` (không rỗng) và `textContent` của nút tên schema ở lần mount đầu; sau Undo và mount lại so bằng đúng giá trị đó (bỏ cặp `aria-label` null === null). Kiểm tra đột biến: đổi kỳ vọng thành `+ "x"` thì test fail (đã hoàn lại). Sửa comment trong `use-apply-pending-import.ts`: mục chờ chỉ được áp ở lần mount kế tiếp của editor schema đó.
- **File thay đổi**: `features/schema-list/import-journey.test.tsx`, `features/editor/hooks/use-apply-pending-import.ts`.
- **Kiểm tra**: xem báo cáo cuối.
