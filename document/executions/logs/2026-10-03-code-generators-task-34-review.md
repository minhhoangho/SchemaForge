# Review Task 34: Code panel, nút "Code", i18n và CSP

Liên kết: [Plan Task 34](../../plans/2026-09-15-code-generators-plan.md#task-34-code-panel-nút-code-i18n-và-csp) | [Spec §8–10](../../specs/2026-09-14-code-generators-design.md#8-đến-10) | [Task log](2026-10-03-code-generators-task-34.md)

## 2026-10-03 14:30 — project-reviewer — Xong

**Đã làm:**
- Reviewed Task 34 against commit `a585c29`, Plan Task 34, và Spec §8 và §10.
- Xác nhận các quyết định của implementer và phê duyệt tất cả:
  - `useGoToIssue` nhận `{ path }`; đây là structural supertype của `Issue` và `GeneratorDiagnostic`.
  - `globals.css` không được chỉnh sửa, vì 11 biến `--code-*` đã tồn tại từ `a12ec53` (visual-refresh spec §2, OKLCH values), và contrast của chúng được ghim trong `globals.test.ts`.
  - Eslint-disable trên `<pre role="region" tabIndex=0>` có lý do.
  - Seed inputs được clamp khi blur, và `toGeneratorRequest` clamps lại.
  - Messages không interpolate `relation`, vì `IssueValues` không có `relation` key; danh sách biến trong plan là sai ở điểm này.
  - Generator request được memoize qua `useMemo`.
- Verified các điểm sau:
  - Store không được persist, và `setSelection` giữ `rightPanelMode`.
  - `next/dynamic` dùng `ssr:false`, với placeholder có cùng `w-[32rem]` width.
  - Drizzle SQL Server được disable và note của nó được link bằng `aria-describedby`.
  - Khi loading, code cũ vẫn ở trên màn hình với `aria-busy`.
  - Failed state hiển thị `role="alert"`.
  - CSP chỉ thêm `worker-src 'self'`.
  - Không có `dangerouslySetInnerHTML`.
  - Tokens render thành spans, và test cho thấy `<img onerror>` hiển thị như text.

**Phát hiện:**
1. should-fix: `skip-to-panel-link.tsx:28` bỏ qua `rightPanelMode` (WCAG 2.4.1). Ở code mode mà không có gì được chọn, skip link đi tới left panel.
2. should-fix: Task 34 log chưa làm các browser checks mà plan yêu cầu.
3. should-fix: `generator-options.tsx` không có test cho việc thay đổi SQL dialect, thay đổi seed format, hoặc commit seed field (80.55% lines, 68.42% branches).
4. nit: 5 diagnostic codes có thể thêm `{{table}}`.
5. nit: Task 34 agent append vào Task 33 log, để close một checkbox mà đã được hand over.

**Kiểm tra:**
- typecheck, lint và prettier: PASS.
- `pnpm --filter @schemaforge/frontend test`: 3835 tests PASS, 96.11% lines.
- `SECRET-SCAN: CLEAN`.
- `curl -sI localhost:3000` hiển thị `worker-src 'self'` trong CSP.

**Quyết định:** Phê duyệt với fixes cần làm.

---

## 2026-10-03 14:45 — ui-a11y-reviewer — Xong

**Đã làm:**
- Static accessibility review: Task 34 code panel, phần tử tương tác, contrast, focus, i18n.
- Checked WCAG 2.1 AA, focus visibility, target sizes, role và state attributes, pluralization.

**Phát hiện:**
1. should-fix: Skip-link issue (giống như phía trên).
2. nit: Seed field khi trống, rơi về giá trị tối thiểu thay vì revert; không có range hint.
3. nit: Drizzle SQL Server's `aria-describedby` trên trigger là acceptable.
4. nit: Vi `panelLabel` "Tạo code" nên thành "Trình tạo code"; các technical terms untranslated là acceptable.

**Kiểm tra:**
- Contrast của `--code-*` tokens so với `--code-background`, light/dark: foreground 13.6/13.4, keyword 6.67/8.71, string 5.75/10.18, constant 5.98/9.40, comment 4.91/5.82, function 6.22/9.10, parameter 5.87/10.03, punctuation 6.92/8.14. Tất cả ≥ 4.5:1.
- i18n ở vi và en là complete, với `_one`/`_other` plurals.
- Focus rings, `aria-pressed` toggle, `role="status"`/`"alert"`, và target sizes là adequate.

**Quyết định:** Phê duyệt với nits đi kèm những findings của project-reviewer.

**Việc còn lại:**
- [ ] Interactive browser checks: mở panel, thay đổi target, copy, click diagnostic, Tab tới code region và Copy, cả hai themes.
