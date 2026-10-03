# Code panel, nút "Code", i18n và CSP

Plan: [Task 34](../../plans/2026-09-15-code-generators-plan.md) · Spec: [code generators, mục 8 và 10](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-03 11:35 — frontend-engineer — Xong (kiểm tra tay trên trình duyệt chưa làm)
- **Đã làm**
  - Store: `rightPanelMode`, `codeTarget`, `codeOptions`, `setRightPanelMode`, `setCodeTarget`, `updateCodeOptions`.
  - `generator-request.ts` (kiểu `CodeTarget`/`CodeOptions`, `toGeneratorRequest`, `clampSeedRowsPerTable`, `clampSeed`).
  - `useGoToIssue({ shouldRequestFocus })` tách khỏi `issue-list-tab.tsx`; nhận `{ path }` nên dùng được cho cả `Issue` lẫn `GeneratorDiagnostic`.
  - `CodePanel`, `GeneratorTargetSelect`, `GeneratorOptions`, `CodeView`, `GeneratorDiagnosticList`.
  - Nút "Code" (`aria-pressed`) trên toolbar; `editor-workspace` tải `CodePanel` bằng `next/dynamic` (`ssr: false`), cột `w-[32rem]` giữ `id` của cột phải.
  - i18n: namespace `codeGenerator`, `generatorDiagnostics` (17 mã, `satisfies Record<GeneratorDiagnosticCode, string>`), 23 nhãn Markdown; đăng ký trong `resources.ts`.
  - CSP: thêm `worker-src 'self'`.
- **File thay đổi**: `frontend/src/features/editor/code-generator/{generator-request,generator-target-select,generator-options,code-view,generator-diagnostic-list,code-panel}.ts(x)` + test; `hooks/use-go-to-issue.ts(x)` + test; `state/create-editor-store.ts` + test; `components/toolbar/editor-toolbar.tsx` + test; `components/editor-workspace.tsx` + test; `components/panels/issue-list-tab.tsx`; `lib/i18n/locales/{en,vi}/{code-generator,generator-diagnostics}.ts`, `lib/i18n/resources.ts`, `lib/i18n/code-generator-messages.test.ts`; `lib/security/content-security-policy.ts` + test.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --build --format` -> `RESULT: PASS` (3835 test, coverage 96.17% dòng); `.claude/scripts/secret-scan.sh` -> `SECRET-SCAN: CLEAN`. RED: 5 test store fail trước khi code. Worker entry `static/media/code-generator.worker.3oxpfjap98pir.ts`, chunk worker `static/chunks/1spgym405ib2k.js`; shiki langs resolve được (xem log Task 33).
- **Quyết định**
  - (Đáng chú ý) `useGoToIssue` trả hàm nhận `{ path }` thay vì `Issue`, để diagnostic dùng chung; `IssueListTab` giữ nguyên hành vi.
  - (Đáng chú ý) `--code-*` đã có sẵn trong `globals.css` (cả `:root` và `.dark`), nên không sửa file đó; dùng `bg-(--code-background)`.
  - `<pre role="region" tabIndex={0}>` kèm một `eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex` có lý do (vùng cuộn phải focus được bằng bàn phím); `role="region"` để axe không báo `aria-label` trên phần tử không có role.
  - Ô số của Seed giữ chữ đang gõ và kẹp khi blur, để giá trị rỗng không tới core.
  - Thông báo diagnostic chỉ nội suy `table`, `column`, `index`, `enum` (resolveIssueTarget không có `relation`); 5 mã có path đa dạng (`key-column-type-not-indexable`, `unique-nulls-restricted`, `identifier-collision-renamed`, `null-character-removed`, `comment-truncated`) không nêu tên phần tử.
  - `request` của panel được `useMemo` vì hook chạy lại khi `options` đổi tham chiếu.
- **Việc còn lại**
  - [ ] Kiểm tra tay trên trình duyệt (chưa làm: cổng 3000 đang bị một server khác chiếm): mở panel, đổi đích, copy, bấm diagnostic, Tab tới vùng code và nút Copy, hai theme, và tương phản 4,5:1 của token `--code-*` trên `--code-background`.
  - [ ] Kiểm tra CSP `worker-src 'self'` với worker module trên bản build thật (Turbopack phục vụ worker từ `/_next/static/media/*.ts`; chưa kiểm tra Content-Type trong trình duyệt).
- **Ghi chú cho người tiếp theo**: `SkipToPanelLink` (không thuộc file của task) vẫn trỏ tới cột phải chỉ khi có selection; ở chế độ code không có selection nó nhảy tới panel trái. Cần sửa nếu muốn nhảy tới code panel.

## 2026-10-03 12:10 — frontend-engineer — Xong (áp dụng sửa sau review; kiểm tra tay vẫn chưa làm)
- **Đã làm**
  - `skip-to-panel-link.tsx`: ở chế độ code, link trỏ tới cột phải kể cả khi không có selection; thêm test trong `editor-workspace.test.tsx`.
  - `code-panel.test.tsx`: thêm test cho dialect SQL (`mysql`), format seed (`json`), seed `99999999999` kẹp về `4294967295`, và ô số bỏ trống giữ giá trị cũ. `use-go-to-issue.test.tsx`: thêm nhánh relation, enum, phần tử đã mất.
  - `generator-options.tsx`: ô số rỗng khi blur thì giữ giá trị trước (không clamp `Number("")`).
  - vi `panelLabel` thành "Trình tạo code"; 5 mã diagnostic có path đa dạng nay nêu `“{{table}}”` ở vi và en.
- **Kiểm tra**: `verify.sh frontend --build --format` -> `RESULT: PASS`; secret-scan -> `SECRET-SCAN: CLEAN`. Bản build chạy `next start -p 3002`: header CSP có `worker-src 'self'`, không có `unsafe-eval` hay `wasm-unsafe-eval`; `/_next/static/media/code-generator.worker.3oxpfjap98pir.ts` trả 200, `Content-Type: video/mp2t`. Đã dừng server.
- **Quyết định**: với `null-character-removed` có path enum, `table` rỗng nên câu hiển thị “” (path enum không phân giải ra bảng); chấp nhận theo yêu cầu review, cần xem nếu core phát path enum này.
- **Việc còn lại**
  - [ ] Kiểm tra tay trên trình duyệt: mở panel, đổi đích, copy, bấm diagnostic, Tab tới vùng code và nút Copy, hai theme, tương phản 4,5:1 của token `--code-*`.
  - [ ] Xác nhận trong trình duyệt rằng worker module khởi động được dù tài sản `.ts` có `Content-Type: video/mp2t` (Turbopack bọc qua bootstrap `turbopack-worker-*.js`; chưa chạy thật).

## 2026-10-03 12:40 — frontend-engineer — Xong (kiểm tra tay của orchestrator đã ghi)
- **Đã làm**: trả `null-character-removed` (vi, en) về câu không nêu phần tử vì core phát mã này với path enum (`["enums", id, "values", i]`, `sql-ddl-model.ts:72`) và bảng không phân giải được; 4 mã còn lại giữ `“{{table}}”`. Thêm test kiểm tra câu không chứa `“”`.
- **Kiểm tra**: `verify.sh frontend --format` -> xem báo cáo (PASS), secret-scan CLEAN.
- **Kết quả kiểm tra tay (orchestrator, Chrome DevTools, 2026-10-03)**
  - Dev server :3000, viewport 1440×900, schema local "shop": nút "Code" có `aria-pressed`, panel mở rộng 512 px, canvas vẫn hiện; SQL DDL có highlight, Copy hiện toast "Đã sao chép code"; đổi đích bằng bàn phím sang "Dữ liệu mẫu" hiện tùy chọn seed (format, 10 dòng, seed 1) và `seed.sql`; Drizzle: trigger dialect có `aria-describedby` trỏ "Drizzle chưa hỗ trợ SQL Server."; theme dark (`.dark`) đọc được; chế độ code không chọn gì, skip link "Bỏ qua canvas" focus vào aside code; thứ tự Tab: đích -> dialect -> Sao chép -> `pre` "Code Drizzle", có vòng focus.
  - Bản build :3002 (`next start`, CSP thật), schema mới "csp-check" một bảng: worker nạp qua `/_next/static/chunks/turbopack-worker-*.js`, không qua tài sản `.ts` nên MIME `video/mp2t` không ảnh hưởng; panel hiện DDL có highlight (33 span token), không có `role=alert`; console không có lỗi CSP hay worker, chỉ 404 `/favicon.ico`.
- **Việc còn lại**
  - [x] Các kiểm tra tay và kiểm tra worker trên trình duyệt ở các mục trước (xem kết quả trên).
  - [ ] Ghi chú: ở viewport 500 px, panel trái cộng cột code 32rem làm canvas rộng 0 px; việc theo dõi cho màn hình hẹp, chưa sửa.
  - [ ] Chưa kiểm tra: bấm diagnostic trong trình duyệt (schema "shop" không có diagnostic; đã có unit test) và trình đọc màn hình.
