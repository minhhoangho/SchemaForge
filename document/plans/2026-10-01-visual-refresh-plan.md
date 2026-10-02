# Plan: Visual refresh

Plan triển khai phần 10 trong [roadmap.md](../roadmap.md), dựa trên [spec Visual refresh](../specs/2026-10-01-visual-refresh-design.md) đã duyệt ở commit `964bb54` (bốn câu hỏi mở được người dùng trả lời ngày 2026-10-02, ghi trong mục "Câu hỏi đã trả lời" của spec). Spec là nguồn sự thật: plan chỉ chia việc và chốt chi tiết cài đặt, không đổi quyết định nào của spec. Khi plan và spec lệch nhau, theo spec và báo lại.

Mockup tham khảo: [ui_reference/visual-refresh-mockup.html](../ui_reference/visual-refresh-mockup.html). Mockup chỉ để nhìn; giá trị token, class và kích thước lấy từ spec và plan.

## Mục tiêu

- Bộ token màu, bóng, bo góc mới cho light và dark trong `frontend/src/app/globals.css`, có test tương phản tự động 3:1 và 4,5:1.
- Font Plus Jakarta Sans và JetBrains Mono tự host qua `next/font/google`.
- Restyle `components/ui`, canvas (node bảng có dải màu, đường quan hệ vuông góc, lưới chấm, minimap), toolbar, panel, hộp thoại, danh sách schema, trang đăng nhập, đăng ký.
- Không đổi hành vi, bố cục, route, accessible name, chuỗi i18n; không thêm dependency.

## Điều kiện tiên quyết

- Phần 3 (Editor MVP) đã xong; phần 4 đã merge mọi task chạm `frontend/src/features/auth/**`, `frontend/src/features/schema-list/**` và `frontend/src/components/*.tsx` (commit `0073912` trở về trước). Task còn lại của phần 4 (37, 38) chỉ là kiểm tra tay và tài liệu, không đụng file của plan này; Task 11 của plan này chạy sau Task 38 của phần 4 vì cả hai sửa `architecture.md` và `roadmap.md`.
- Không cần merge task nào của phần 6: code panel chưa có trong code, plan này chỉ khai báo token `--code-*`.
- Mọi lệnh Node chạy với tiền tố:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
```

- `next build` tải file font từ Google Fonts lúc build (`next/font/google` tự host bằng cách tải về `.next/static/media`), nên lệnh build cần mạng. Trình duyệt không gọi Google lúc chạy.

## Cách dùng plan

- Mỗi task giao cho một subagent `frontend-engineer` chưa đọc spec. Phần thân task đủ để làm mà không mở spec; khi cần chi tiết hình thức (class, kích thước), task trỏ tới đúng mục spec.
- Subagent không commit. Orchestrator kiểm tra kết quả (chạy lại lệnh ở "Kiểm tra", đọc diff), rồi commit với đúng dòng **Commit** của task.
- Task cùng đợt chạy song song, mỗi task trong một worktree tạo từ HEAD cục bộ. Orchestrator merge từng task một, theo số task tăng dần, và chạy lại `.claude/scripts/verify.sh frontend` sau mỗi lần merge.
- Task 11 do `spec-writer` làm sau khi người dùng chạy xong danh sách kiểm tra tay ở cuối plan.

## Quy ước chung cho mọi task

**Đọc trước:** `CLAUDE.md`, `.claude/rules/react.md`, `.claude/rules/nextjs.md`, `.claude/rules/testing.md`, `.claude/rules/code-quality.md`, `.claude/rules/typescript.md`, rồi mục spec mà task trích và các file mình sở hữu.

**TDD:** viết hoặc sửa test trước, chạy để thấy đỏ, rồi mới sửa code. Chạy một file:

```bash
pnpm --filter @schemaforge/frontend exec vitest run <đường dẫn từ frontend/>
```

Task chỉ đổi class (không có hành vi mới) thì không có test mới; khi đó bước "đỏ" là bỏ qua, nhưng test hiện có của file phải xanh trước và sau khi sửa.

**Chỉ chạm file mình sở hữu.** Cần đổi file của task khác thì dừng và báo. Không task nào được sửa `frontend/package.json`, lockfile, `eslint.config.mjs`, file locale trong `frontend/src/lib/i18n/locales/`, CI, `packages/`, `backend/`.

**Ràng buộc chung (nhắc lại từ spec):**

- Không thêm thư viện. Icon chỉ lấy từ `lucide-react` đang cài.
- Không thêm hay đổi key i18n. Nếu thật sự cần chuỗi mới (ví dụ `aria-label` cho icon không có chữ đi kèm), dừng và báo orchestrator; chuỗi mới phải có đủ `vi` và `en` và được giao cho đúng một task.
- Giữ nguyên accessible name, role, thứ tự focus, phím tắt, `aria-*`, hành vi. Test hiện có (query theo role, label, text) phải xanh mà không sửa assertion. Assertion đọc class được phép sửa duy nhất: `paints the table node's own boundary with the canvas-node-border token` trong `frontend/src/app/globals.test.ts` (Task 1 sửa, xem "Điểm nóng"). Hai test khác đọc class phải giữ xanh: `gives the visibility toggle at least a 24 pixel target` (`credentials-form.test.tsx`, nút vẫn `size-6` … `size-10`) và test `loadingText: "sr-only"` của `conflict-dialog.test.tsx`.
- WCAG 2.2 AA: mục tiêu bấm ≥ 24×24 px (nút icon `size-8`, mục menu cao 32 px, nút xs `h-6` giữ nguyên); focus thấy được bằng `--ring` ở opacity đầy đủ (không dùng `ring-ring/N`, `border-ring/N`, `outline-ring/N`: test quét mã nguồn chặn); không truyền thông tin chỉ bằng màu; icon trang trí có `aria-hidden`.
- Giảm chuyển động: chỉ chuyển màu và bóng (`transition-[color,background-color,border-color,box-shadow] duration-150`), không chuyển `transform`; bỏ `active:translate-y-px`. Khối `prefers-reduced-motion` trong `globals.css` (Task 1) tắt mọi transition.
- Màu chỉ lấy qua token (`bg-card`, `text-muted-foreground`, `var(--table-accent-3)`…). Không viết `oklch(`, `rgb(`, `hsl(` hay mã hex trong `.tsx`; Task 1 thêm test quét điều này.
- Chữ trên nền pha màu chỉ dùng `/10` (`bg-destructive/10`, `bg-warning/10`) và không đặt `bg-warning/10` thẳng trên `--background` (đo được 4,47:1 ở light, dưới ngưỡng); Task 1 thêm test cho các cặp được phép.
- Không thêm `memo`, `useMemo`, `useCallback`, selector Zustand mới; không thêm state React cho hover.

**Kiểm tra** (chạy từ thư mục gốc repo, sau tiền tố Node):

| Lệnh | Kết quả mong đợi |
|---|---|
| `pnpm --filter @schemaforge/frontend typecheck` | Không lỗi |
| `pnpm --filter @schemaforge/frontend lint` | Không lỗi, không warning mới |
| `pnpm --filter @schemaforge/frontend test` | Mọi test xanh, coverage logic ≥ 80% |
| `pnpm --filter @schemaforge/frontend build` | Build xong (cần mạng để tải font) |
| `pnpm exec prettier --check <file đã sửa>` | Không file nào cần format |
| `git status --porcelain` | Chỉ có file task sở hữu |

Có thể gộp bốn lệnh đầu và Prettier bằng `.claude/scripts/verify.sh frontend --build --format`, kết quả mong đợi `RESULT: PASS`.

**Báo cáo:** danh sách file đã tạo, sửa; tên test mới; kết quả từng lệnh kiểm tra; chỗ nào lệch spec hoặc plan và lý do; chuỗi i18n mới nếu có (mặc định: không có); điều cần kiểm tra tay.

## Điểm nóng khi làm song song

| Điểm nóng | Cách xử lý |
|---|---|
| `frontend/src/app/globals.css` | Chỉ Task 1. CSS của handle node bảng và hover đường quan hệ cũng nằm ở đây, dùng tên class, id cố định ở Task 1; Task 5 và Task 6 dùng đúng các tên đó, không tự thêm CSS |
| `frontend/src/app/globals.test.ts` | Chỉ Task 1. Assertion chuỗi class của node được nới thành `"border border-canvas-node-border bg-card"`, khớp cả class cũ lẫn class mới ở Task 5, nên Task 5 không cần sửa file này |
| `frontend/src/app/layout.tsx`, `frontend/src/app/fonts.ts` | Chỉ Task 2 |
| `frontend/src/components/ui/*.tsx` | Chỉ Task 3. Task khác cần biến thể mới của component `ui` thì không thêm, dùng `className` tại chỗ dùng |
| `frontend/src/features/editor/lib/table-accent.ts` | Chỉ Task 4 tạo. Task 5, 6, 8 import, không sửa |
| `frontend/src/components/*.tsx` (ngoài `ui/`), gồm `brand-mark.tsx` mới | `brand-mark.tsx`: Task 9 tạo. Các file còn lại: Task 10. Toolbar editor (Task 7) dùng `ThemeSwitch`, `LanguageSwitch`, `AccountMenu` nhưng không sửa chúng |
| File locale i18n, `frontend/package.json`, lockfile, `eslint.config.mjs`, CI | Không task nào sửa |
| `document/architecture.md`, `document/roadmap.md` | Chỉ Task 11 |

## Phiên bản

Không cài gói nào. Kiểm tra lại ngày 2026-10-02 trên `node_modules` của `master`:

| Gói | Phiên bản đang cài | Điều plan dựa vào |
|---|---|---|
| `next` | 16.3.5 | `next/font/google` export `Plus_Jakarta_Sans`, `JetBrains_Mono`; `font-data.json`: Plus Jakarta Sans có subset `latin`, `latin-ext`, `vietnamese`, `cyrillic-ext`, trục `wght` 200–800; JetBrains Mono có `vietnamese`, trục `wght` 100–800. Loader (`dist/compiled/@next/font/dist/google/loader.js`, `find-font-files-in-css.js`) tải và tự host mọi file font trong CSS của Google, `subsets` chỉ quyết định file nào được preload |
| `@xyflow/react` | 12.11.6 (`@xyflow/system` 0.0.82) | `getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius, offset })` trả `[path, labelX, labelY, offsetX, offsetY]`; `MiniMap` vẽ node bằng `<rect class="react-flow__minimap-node" style="fill: <nodeColor>">`; class `react-flow__connectionline` chỉ có khi đang kéo nối |
| `tailwindcss`, `@tailwindcss/node` | 4.3.3 | Đã biên dịch thử: `@theme inline { --shadow-sm: var(--shadow-sm) }` sinh `.shadow-sm { --tw-shadow: var(--shadow-sm) }`; khai báo `--shadow-sm` không layer trong `:root`, `.dark` thắng khai báo trong `@layer theme`, nên class `shadow-sm` đổi theo theme |
| `lucide-react` | 1.45.0 | Icon spec liệt kê đều có |
| `sonner` | 2.x | `toastOptions.classNames.toast`, `icons` |

## Bảng task

| Task | Nội dung | Phụ thuộc | Đợt |
|---|---|---|---|
| 1 | Token, `@theme inline`, biến React Flow, Sonner, CSS handle và hover edge, reduced motion; mở rộng `globals.test.ts` | — | 1 |
| 2 | Font: `fonts.ts`, `layout.tsx` | — | 1 |
| 3 | Restyle `components/ui/*` | — (merge sau Task 1) | 1 |
| 4 | `table-accent.ts` và unit test | — | 1 |
| 5 | Node bảng: `table-node.tsx`, `column-row.tsx` | 1, 4 | 2 |
| 6 | Đường quan hệ, marker, canvas, minimap, trạng thái trống | 1, 4 | 2 |
| 7 | Toolbar và khung editor | 1, 3 | 2 |
| 8 | Panel trái, panel thuộc tính, hộp thoại editor | 1, 3, 4 | 2 |
| 9 | Dấu nhận diện `brand-mark.tsx`, danh sách schema | 1, 3 | 2 |
| 10 | Trang đăng nhập, đăng ký, component dùng chung của app, `not-found.tsx` | 9 | 3 |
| 11 | Tài liệu: `architecture.md`, `roadmap.md` (spec-writer) | 1–10, kiểm tra tay | 4 |

Đường găng: Task 1 → Task 9 → Task 10 → kiểm tra tay → Task 11. Nhóm (a) của spec là Task 1–3, nhóm (b) là Task 4–8, nhóm (c) là Task 9–10.

Không có Task 0: các vấn đề ở mục [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan) đều là chi tiết cài đặt đã có đề xuất trong plan, không cần người dùng quyết.

## Task 1: Token, ánh xạ theme, biến React Flow, Sonner và test tương phản

**Mục tiêu:** bộ token của spec [mục 2](../specs/2026-10-01-visual-refresh-design.md#2-token-màu), `--radius` và bóng ở [mục 3](../specs/2026-10-01-visual-refresh-design.md#3-chữ-khoảng-cách-bo-góc-bóng), biến React Flow ở [mục 6](../specs/2026-10-01-visual-refresh-design.md#6-canvas-minimap-điều-khiển), handle ở mục 4 "Điểm nối", hover edge ở mục 5, toast ở mục 12, reduced motion ở mục 3 "Chuyển động"; mở rộng test như mục 2 "Mở rộng `globals.test.ts`".

**Phụ thuộc:** không. **Đợt:** 1.

**File sở hữu:**

- `frontend/src/app/globals.css` (sửa)
- `frontend/src/app/globals.test.ts` (sửa)

**Cài đặt:**

1. Thay toàn bộ khai báo trong khối `:root` và `.dark` bằng giá trị dưới đây. Giữ các comment giải thích hiện có về `--border`, `--input`, `--canvas-node-border` (sửa câu chữ nếu giá trị đổi), giữ nguyên `--chart-1` … `--chart-5`. Mọi màu viết `oklch(...)` hoặc `var(--...)` để test parse được; token mới nằm trong `:root`, `.dark`, không nằm trong `@theme`.

```css
:root {
  --background: oklch(0.99 0.003 255);
  --foreground: oklch(0.24 0.025 262);
  --card: oklch(1 0 0);
  --card-foreground: var(--foreground);
  --popover: oklch(1 0 0);
  --popover-foreground: var(--foreground);
  --primary: oklch(0.55 0.18 259);
  --primary-foreground: oklch(0.99 0.004 255);
  --secondary: oklch(0.955 0.01 255);
  --secondary-foreground: oklch(0.3 0.04 262);
  --muted: oklch(0.965 0.007 255);
  --muted-foreground: oklch(0.5 0.025 260);
  --accent: oklch(0.945 0.025 258);
  --accent-foreground: oklch(0.36 0.12 262);
  --destructive: oklch(0.54 0.2 27);
  --success: oklch(0.5 0.12 155);
  --warning: oklch(0.54 0.12 60);
  --border: oklch(0.915 0.01 258);
  --input: oklch(0.62 0.02 260);
  --ring: oklch(0.25 0.07 262);
  --overlay: oklch(0.24 0.025 262 / 35%);
  --radius: 0.5rem;
  --sidebar: var(--background);
  --sidebar-foreground: var(--foreground);
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--accent);
  --sidebar-accent-foreground: var(--accent-foreground);
  --sidebar-border: var(--border);
  --sidebar-ring: var(--ring);
  --canvas: oklch(0.97 0.006 255);
  --canvas-dot: oklch(0.82 0.015 258);
  --canvas-node-border: var(--input);
  --canvas-node-header-foreground: oklch(0.99 0.004 255);
  --canvas-relation: oklch(0.6 0.03 260);
  --canvas-relation-hover: oklch(0.42 0.04 262);
  --canvas-relation-selected: var(--primary);
  --canvas-key: oklch(0.62 0.15 65);
  --canvas-foreign-key: oklch(0.55 0.11 190);
  --table-accent-1: oklch(0.52 0.16 259);
  --table-accent-2: oklch(0.5 0.1 200);
  --table-accent-3: oklch(0.5 0.12 155);
  --table-accent-4: oklch(0.52 0.12 75);
  --table-accent-5: oklch(0.54 0.16 40);
  --table-accent-6: oklch(0.52 0.18 15);
  --table-accent-7: oklch(0.52 0.17 340);
  --table-accent-8: oklch(0.5 0.17 295);
  --code-background: oklch(0.975 0.005 255);
  --code-foreground: oklch(0.28 0.03 262);
  --code-token-keyword: oklch(0.48 0.19 295);
  --code-token-string: oklch(0.48 0.12 150);
  --code-token-constant: oklch(0.5 0.15 40);
  --code-token-comment: oklch(0.53 0.02 260);
  --code-token-function: oklch(0.48 0.16 259);
  --code-token-parameter: oklch(0.47 0.1 200);
  --code-token-punctuation: oklch(0.45 0.02 260);
  --code-token-string-expression: var(--code-token-string);
  --code-token-link: var(--code-token-function);
  --shadow-sm: 0 1px 2px oklch(0.24 0.025 262 / 6%);
  --shadow-md: 0 1px 2px oklch(0.24 0.025 262 / 6%), 0 4px 12px oklch(0.24 0.025 262 / 8%);
  --shadow-lg: 0 2px 6px oklch(0.24 0.025 262 / 6%), 0 12px 32px oklch(0.24 0.025 262 / 14%);
}

.dark {
  --background: oklch(0.185 0.012 262);
  --foreground: oklch(0.95 0.006 255);
  --card: oklch(0.225 0.014 262);
  --card-foreground: var(--foreground);
  --popover: oklch(0.245 0.015 262);
  --popover-foreground: var(--foreground);
  --primary: oklch(0.88 0.07 255);
  --primary-foreground: oklch(0.22 0.05 262);
  --secondary: oklch(0.28 0.016 262);
  --secondary-foreground: oklch(0.95 0.006 255);
  --muted: oklch(0.26 0.014 262);
  --muted-foreground: oklch(0.72 0.02 258);
  --accent: oklch(0.3 0.03 262);
  --accent-foreground: oklch(0.95 0.006 255);
  --destructive: oklch(0.7 0.17 22);
  --success: oklch(0.74 0.14 155);
  --warning: oklch(0.8 0.13 75);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 45%);
  --ring: oklch(0.56 0.11 258);
  --overlay: oklch(0 0 0 / 55%);
  /* --sidebar-* : cùng các dòng var() như :root */
  --canvas: oklch(0.165 0.012 262);
  --canvas-dot: oklch(0.34 0.015 262);
  --canvas-node-border: var(--input);
  --canvas-node-header-foreground: oklch(0.99 0.004 255);
  --canvas-relation: oklch(0.6 0.025 260);
  --canvas-relation-hover: oklch(0.82 0.02 258);
  --canvas-relation-selected: var(--primary);
  --canvas-key: oklch(0.83 0.15 85);
  --canvas-foreign-key: oklch(0.78 0.12 185);
  --table-accent-1: oklch(0.48 0.14 259);
  --table-accent-2: oklch(0.46 0.09 200);
  --table-accent-3: oklch(0.46 0.1 155);
  --table-accent-4: oklch(0.48 0.1 75);
  --table-accent-5: oklch(0.5 0.14 40);
  --table-accent-6: oklch(0.48 0.16 15);
  --table-accent-7: oklch(0.48 0.15 340);
  --table-accent-8: oklch(0.47 0.15 295);
  --code-background: oklch(0.2 0.013 262);
  --code-foreground: oklch(0.9 0.01 255);
  --code-token-keyword: oklch(0.78 0.12 300);
  --code-token-string: oklch(0.8 0.13 150);
  --code-token-constant: oklch(0.8 0.12 55);
  --code-token-comment: oklch(0.66 0.02 260);
  --code-token-function: oklch(0.78 0.11 250);
  --code-token-parameter: oklch(0.8 0.09 200);
  --code-token-punctuation: oklch(0.75 0.015 260);
  --code-token-string-expression: var(--code-token-string);
  --code-token-link: var(--code-token-function);
  --shadow-sm: 0 1px 2px oklch(0 0 0 / 40%);
  --shadow-md: 0 2px 8px oklch(0 0 0 / 45%);
  --shadow-lg: 0 16px 40px oklch(0 0 0 / 55%);
}
```

Viết các dòng `--sidebar-*` của `.dark` giống hệt `:root` (đều là `var()`), không để dòng comment phác thảo ở trên trong file. `--radius` chỉ khai báo trong `:root`.

2. Trong khối `@theme inline` cuối (khối có `--font-heading`), thêm:

```css
  --font-sans: var(--font-plus-jakarta-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-overlay: var(--overlay);
  --color-canvas: var(--canvas);
  --color-canvas-dot: var(--canvas-dot);
  --color-canvas-relation-hover: var(--canvas-relation-hover);
  --color-canvas-node-header-foreground: var(--canvas-node-header-foreground);
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
```

`--font-plus-jakarta-sans`, `--font-jetbrains-mono` do Task 2 tạo; trước khi Task 2 merge, chữ rơi về font dự phòng, không lỗi. Dòng `--shadow-*: var(--shadow-*)` có chủ đích (xem "Phiên bản"); thêm comment một dòng giải thích để người sau không xóa nhầm.

3. Khối `.react-flow`: đổi `--xy-background-color: var(--canvas)`, `--xy-background-pattern-dots-color: var(--canvas-dot)`, nền mask minimap `color-mix(in oklab, var(--canvas) 60%, transparent)`; thêm `--xy-edge-stroke-width: 1.5`. Giữ nguyên từng chữ hai dòng `--xy-node-border: 1px solid var(--canvas-node-border)` và `--xy-node-boxshadow-selected: 0 0 0 2px var(--ring)` (test đang khẳng định). Giữ khối `.react-flow__node:focus-visible, .react-flow__edge:focus-visible`.

4. Thêm sau khối `.react-flow` (tên class, id là hợp đồng với Task 5, Task 6):

```css
/* Table node handles: 10 px dots, shown only while they can be used. */
.react-flow__node-table .react-flow__handle {
  width: 10px;
  height: 10px;
  background: var(--card);
  border: 2px solid var(--canvas-relation);
  opacity: 0;
}
.react-flow__node-table:hover .react-flow__handle,
.react-flow__node-table.selected .react-flow__handle,
.react-flow__node-table:focus-visible .react-flow__handle,
.react-flow:has(.react-flow__connectionline) .react-flow__node-table .react-flow__handle {
  opacity: 1;
}

/* A dragged node keeps the resting shadow; only --tw-shadow is replaced so
   the selection ring (ring-1) survives. */
.react-flow__node.dragging .table-node-card {
  --tw-shadow: var(--shadow-sm);
}

/* Hover on a default relation edge: color, width and markers change in CSS,
   so hovering never re-renders the edge. */
.react-flow__edge:hover .relation-edge-hoverable {
  stroke: var(--canvas-relation-hover);
  stroke-width: 2px;
  marker-end: url(#relation-marker-one-hover);
}
.react-flow__edge:hover .relation-edge-hoverable.relation-edge-start-many {
  marker-start: url(#relation-marker-many-hover);
}
.react-flow__edge:hover .relation-edge-hoverable.relation-edge-start-one {
  marker-start: url(#relation-marker-one-hover);
}
```

5. Khối `.toaster[data-sonner-toaster][data-theme]`: `--border-radius: var(--radius-lg)`; giữ ba biến còn lại.

6. Reduced motion: thêm (giữ khối `.shimmer` hiện có):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    transition-duration: 0s !important;
    animation-duration: 0s !important;
  }
}
```

**Test viết trước** (`globals.test.ts`; giữ mọi case trong `BOUNDARY_CASES` và mọi test hiện có):

- Thêm vào `BOUNDARY_CASES`, cho cả `light` và `dark`: `canvas-node-border`/`canvas`; `ring`/`canvas`; `ring`/`popover`; `input`/`popover`; `canvas-relation`, `canvas-relation-hover`, `canvas-relation-selected`, `destructive` trên `canvas`; `canvas-key`, `canvas-foreign-key` trên `card`. `where` đặt tên ngắn (`"canvas"`, `"dialog"`, `"node"`).
- Hằng `TEXT_CONTRAST_MINIMUM = 4.5` và mảng `TEXT_CASES` (`theme`, `text`, `surface`) dựng bằng hàm thuần ở cấp module (vòng lặp nằm ngoài test, test dùng `it.each`), tên test `"paints --$text on --$surface in the $theme theme with at least 4.5:1"`. Các cặp, mỗi theme:
  - `foreground`, `muted-foreground` trên `background`, `card`, `muted`, `popover`, `accent`, `secondary`;
  - `primary-foreground`/`primary`, `secondary-foreground`/`secondary`, `accent-foreground`/`accent`, `card-foreground`/`card`, `popover-foreground`/`popover`;
  - `primary`, `destructive`, `success`, `warning` trên `background`, `card`, `popover`;
  - `canvas-node-header-foreground` trên `table-accent-1` … `table-accent-8`;
  - `code-foreground`, `code-token-keyword`, `code-token-string`, `code-token-constant`, `code-token-comment`, `code-token-function`, `code-token-parameter`, `code-token-punctuation`, `code-token-string-expression`, `code-token-link` trên `code-background`.
- Nhóm `describe("text on tinted surfaces")`: chữ `--X` trên nền `--X` pha 10% (dùng `atOpacity` rồi `flattenOnto` lên mặt nền) ≥ 4,5:1, cho cả hai theme: `destructive` trên `background`, `card`, `popover`; `warning` trên `card`, `popover`. Tên: `"keeps --$text readable on its 10% tint over --$surface in the $theme theme"`.
- Nới assertion của test `paints the table node's own boundary with the canvas-node-border token` thành `expect(tableNode).toContain("border border-canvas-node-border bg-card")` và sửa comment đi kèm (dải tiêu đề màu thay cho divider `--border`).
- Test mới `"declares every table accent in both themes"`: `table-accent-1` … `table-accent-8` có trong `THEME_TOKENS.light` và `.dark`.
- Test mới trong `describe("hardcoded colors")`: `"keeps color literals out of components"`: lọc `listSourceFiles()` lấy file `.tsx` không phải `*.test.tsx` và không nằm trong `testing/`, khẳng định không file nào khớp `/\b(?:oklch|rgba?|hsla?)\(|#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/`; kỳ vọng `[]`.

Mọi giá trị trên đã tính lại ngày 2026-10-02 bằng `contrast-ratio.ts` và đều đạt. Nếu một case đỏ, không chỉnh `--ring`, `--primary`, `--muted` của dark (lề 3,25 và 3,32); dừng và báo.

**Kiểm tra:** như Quy ước chung. Thêm: dựng `pnpm --filter @schemaforge/frontend dev`, mở `/` ở light và dark, xác nhận `shadow-sm` của thẻ đổi theo theme trong DevTools (Computed `box-shadow`).

**Commit:** `feat(frontend): add visual refresh theme tokens and contrast tests`

## Task 2: Font Plus Jakarta Sans và JetBrains Mono

**Mục tiêu:** spec [mục 3 "Font"](../specs/2026-10-01-visual-refresh-design.md#font), [mục 14](../specs/2026-10-01-visual-refresh-design.md#14-hiệu-năng).

**Phụ thuộc:** không (ánh xạ `--font-sans`, `--font-mono` nằm ở Task 1). **Đợt:** 1.

**File sở hữu:**

- `frontend/src/app/fonts.ts` (tạo)
- `frontend/src/app/layout.tsx` (sửa)

**Cài đặt:**

```ts
// frontend/src/app/fonts.ts
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

// Every subset Google serves is downloaded and self-hosted at build time;
// `subsets` only picks the files that are preloaded.
const PRELOADED_SUBSETS = ["latin", "vietnamese"] as const;

export const sansFont = Plus_Jakarta_Sans({
  subsets: [...PRELOADED_SUBSETS],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

export const monoFont = JetBrains_Mono({
  subsets: [...PRELOADED_SUBSETS],
  display: "swap",
  variable: "--font-jetbrains-mono",
});
```

Nếu `next/font` đòi đối số là literal (lỗi "Font loader values must be explicitly written literals"), viết thẳng mảng `["latin", "vietnamese"]` trong từng lời gọi và bỏ hằng. Không truyền `weight`: cả hai là variable font.

`layout.tsx`: import `cn` từ `@/lib/class-names` và `{ monoFont, sansFont }` từ `./fonts`; thêm `className={cn(sansFont.variable, monoFont.variable)}` lên `<html>`, giữ mọi thuộc tính khác. Không thêm `<link>` tới Google Fonts. CSP không đổi (`font-src 'self'`).

**Test viết trước:** không có test render `layout.tsx` (không có từ trước, và `next/font` không chạy trong jsdom). Không import `fonts.ts` từ file nào khác ngoài `layout.tsx`, để test component không phải mock `next/font`.

**Kiểm tra:** như Quy ước chung (build cần mạng). Thêm, ghi vào báo cáo:

- `ls frontend/.next/static/media/*.woff2 | wc -l` và tổng dung lượng các file font được preload (tìm `<link rel="preload" as="font">` trong HTML của `/` khi chạy `pnpm --filter @schemaforge/frontend start`).
- Tab Network của Chrome khi mở `/`: không có request tới `fonts.googleapis.com` hay `fonts.gstatic.com`.

**Commit:** `feat(frontend): self-host plus jakarta sans and jetbrains mono`

## Task 3: Restyle component `ui`

**Mục tiêu:** spec [mục 3](../specs/2026-10-01-visual-refresh-design.md#3-chữ-khoảng-cách-bo-góc-bóng) (bo góc, bóng, chuyển động), [mục 8 "Ô nhập"](../specs/2026-10-01-visual-refresh-design.md#8-panel-trái-panel-thuộc-tính), [mục 12](../specs/2026-10-01-visual-refresh-design.md#12-hộp-thoại-menu-popover-tooltip-toast).

**Phụ thuộc:** không về file; class `bg-overlay`, `text-success`, `text-warning`, `shadow-*` theo theme chỉ đúng sau khi Task 1 merge (orchestrator merge Task 1 trước). **Đợt:** 1.

**File sở hữu** (đều sửa): `frontend/src/components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `command.tsx`, `tabs.tsx`, `tooltip.tsx`, `sonner.tsx`, `skeleton.tsx`, `checkbox.tsx`, `radio-group.tsx`. `label.tsx`, `separator.tsx`, `scroll-area.tsx` cũng thuộc task này nhưng chỉ sửa nếu class của chúng đụng các quy tắc dưới.

**Cài đặt:**

- **Chung:** thay `transition-all` bằng `transition-[color,background-color,border-color,box-shadow] duration-150`; bỏ mọi `active:*translate-y-px`; giữ nguyên `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring`, `aria-invalid:*`, mọi `data-slot`, mọi prop và chữ ký export. `rounded-lg` của control (nút, ô nhập, trigger) đổi thành `rounded-md`; các `rounded-[min(var(--radius-md),…)]` của size `xs`, `sm` giữ.
- **`button.tsx`:**
  - `default`: `bg-primary text-primary-foreground shadow-sm hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_12%)]` (pha với `--foreground` làm nền tối hơn ở light, sáng hơn ở dark, nên chữ trên nút chỉ tăng tương phản; `hover:bg-primary/80` cũ làm giảm).
  - `outline`: `border-input bg-card shadow-sm hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground dark:bg-input/30`.
  - `secondary`: giữ.
  - `ghost`: `hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground`, bỏ `dark:hover:bg-muted/50`.
  - `destructive`: `bg-destructive/10 text-destructive hover:border-destructive` ở cả hai theme. Bỏ `hover:bg-destructive/20`, `dark:bg-destructive/20`, `dark:hover:bg-destructive/30` (chữ trên nền pha 20% chỉ còn 3,93–4,40:1) và bỏ `focus-visible:border-destructive/40`, `focus-visible:ring-destructive/20`, `dark:focus-visible:ring-destructive/40` để nút này dùng focus ring chung.
  - `link`: giữ. Size: giữ chiều cao (`h-8`, `h-6`, `h-7`, `h-9`, `size-8`…).
- **`input.tsx`, `textarea.tsx`, `select.tsx` (trigger):** cao 32 px như hiện tại, `rounded-md border-input bg-card shadow-sm dark:bg-input/30`. Giữ nguyên chuỗi `dark:aria-invalid:border-destructive/70` trong `input.tsx`, `textarea.tsx` (test đọc chuỗi này).
- **`dialog.tsx`, `alert-dialog.tsx`:** overlay `bg-overlay` + giữ `backdrop-blur-xs` (bỏ `bg-black/10`); content `rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-lg`, bỏ `ring-1 ring-foreground/10`; title `text-lg font-semibold`; footer `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`. Nút đóng góc trên giữ vị trí, `aria-label`, cỡ.
- **`dropdown-menu.tsx`, `popover.tsx`, `command.tsx`, `select.tsx` (content):** `rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md`; mục `min-h-8 rounded-md`, `data-highlighted:bg-accent data-highlighted:text-accent-foreground` (command: `data-selected:` tương ứng); mục `variant="destructive"` chữ `text-destructive`; separator `bg-border`. `popover.tsx` dùng `p-4` cho nội dung thường như hiện tại nếu đã có, chỉ đổi bo, viền, bóng.
- **`tabs.tsx`:** list `h-8 rounded-lg bg-muted p-0.5`; trigger đang chọn `bg-card text-foreground shadow-sm`, chưa chọn `text-muted-foreground`.
- **`tooltip.tsx`:** giữ đảo màu `bg-foreground text-background`, `rounded-md text-xs`, mũi tên.
- **`sonner.tsx`:** icon có màu: `CircleCheckIcon` thêm `text-success`, `InfoIcon` `text-primary`, `TriangleAlertIcon` `text-warning`, `CircleAlertIcon` `text-destructive`, `LoaderIcon` `text-muted-foreground` (giữ `motion-safe:animate-spin` thay `animate-spin`). Thêm `toastOptions={{ classNames: { toast: "font-sans shadow-md" } }}` trước `{...props}`. Giữ `position`, `theme`, `containerAriaLabel`.
- **`skeleton.tsx`:** `rounded-md bg-muted motion-safe:animate-pulse`.
- **`checkbox.tsx`, `radio-group.tsx`:** viền `border-input`, trạng thái chọn `data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground`, bo `rounded-sm` cho checkbox; kích thước giữ.

**Test viết trước:** không có hành vi mới nên không có test mới. Trước khi sửa, chạy và ghi lại kết quả của `src/components/ui/dialog.test.tsx`, `src/components/ui/command.test.tsx`, `src/app/globals.test.ts`; sau khi sửa, cùng các file đó và toàn bộ `pnpm --filter @schemaforge/frontend test` phải xanh không sửa assertion.

**Kiểm tra:** như Quy ước chung. Thêm: `grep -rnE "active:[^ \"]*translate-y-px|transition-all" frontend/src/components/ui` không có kết quả.

**Commit:** `feat(frontend): restyle shared ui components for the visual refresh`

## Task 4: Màu dải tiêu đề suy ra từ id bảng

**Mục tiêu:** spec [mục 4 "Màu dải tiêu đề"](../specs/2026-10-01-visual-refresh-design.md#màu-dải-tiêu-đề); câu hỏi đã trả lời 1 (màu suy ra từ `table.id`, không có màu người dùng chọn).

**Phụ thuộc:** không. **Đợt:** 1.

**File sở hữu:**

- `frontend/src/features/editor/lib/table-accent.ts` (tạo)
- `frontend/src/features/editor/lib/table-accent.test.ts` (tạo)

**Chữ ký và hành vi:**

```ts
import type { TableId } from "@schemaforge/core";

const TABLE_ACCENTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type TableAccentIndex = (typeof TABLE_ACCENTS)[number];

export const TABLE_ACCENT_COUNT = TABLE_ACCENTS.length;

// 32-bit FNV-1a over the UTF-16 code units of the id.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function hashFnv1a(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME) >>> 0;
  }
  return hash;
}

/** The header color of a table, stable across reloads, devices and cloud. */
export function getTableAccent(tableId: TableId): TableAccentIndex {
  // The modulo keeps the index in range; `??` only satisfies
  // noUncheckedIndexedAccess.
  return TABLE_ACCENTS[hashFnv1a(tableId) % TABLE_ACCENT_COUNT] ?? TABLE_ACCENTS[0];
}

/** `var(--table-accent-N)`, for an inline `style` or a MiniMap `nodeColor`. */
export function getTableAccentColor(tableId: TableId): string {
  return `var(--table-accent-${String(getTableAccent(tableId))})`;
}
```

Không dùng `as` (rule TypeScript). Hàm thuần, không đọc store.

**Test viết trước** (`table-accent.test.ts`; id viết thẳng dạng `` `tbl_${string}` ``, không ngẫu nhiên):

- `returns the same accent for the same table id`
- `returns an accent between 1 and 8`
- `spreads 1000 generated table ids over all 8 accents` (id `tbl_0` … `tbl_999`; tập accent thu được bằng `new Set([1, …, 8])`)
- `formats the accent as a css variable reference` (khớp `/^var\(--table-accent-[1-8]\)$/`)
- `keeps the accent of a known id stable`: `getTableAccent("tbl_users")` là `7`, `getTableAccent("tbl_orders")` là `8` (tính ngày 2026-10-02 bằng đúng thuật toán trên; đổi thuật toán làm đổi màu bảng của người dùng, nên test này giữ cố định).

**Kiểm tra:** như Quy ước chung; coverage của `table-accent.ts` 100% dòng.

**Commit:** `feat(frontend): derive table header accent from the table id`

## Task 5: Node bảng và dòng cột

**Mục tiêu:** spec [mục 4](../specs/2026-10-01-visual-refresh-design.md#4-node-bảng) (bố cục, trạng thái; handle đã có CSS ở Task 1).

**Phụ thuộc:** Task 1, Task 4. **Đợt:** 2.

**File sở hữu:**

- `frontend/src/features/editor/components/canvas/table-node.tsx` (sửa)
- `frontend/src/features/editor/components/canvas/column-row.tsx` (sửa)
- `frontend/src/features/editor/components/canvas/table-node.test.tsx` (sửa: thêm test)

**Cài đặt:**

- **Thẻ** (`table-node.tsx`): class `table-node-card min-w-56 max-w-80 overflow-hidden rounded-lg border border-canvas-node-border bg-card text-xs text-card-foreground shadow-sm transition-[border-color,box-shadow] duration-150 hover:shadow-md`; khi `selected`: `border-primary ring-1 ring-primary shadow-md`. Chuỗi `border border-canvas-node-border bg-card` phải liền nhau đúng thứ tự (test ở `globals.test.ts` đọc chuỗi này). Bỏ `in-focus-visible:ring-2 in-focus-visible:ring-foreground` (focus do `.react-flow__node:focus-visible` trong `globals.css`). `table-node-card` là tên mà CSS "node đang kéo" của Task 1 dùng.
- **Dải tiêu đề:** `relative flex h-9 items-center gap-1.5 px-3 text-[0.8125rem] font-semibold text-canvas-node-header-foreground`, `style={{ backgroundColor: getTableAccentColor(table.id) }}`; bỏ `border-b border-border`. Icon comment trên dải: `size-3.5` màu `currentColor` (bỏ `text-muted-foreground`). `IssueBadge` thành chip `rounded-sm bg-card px-1 text-destructive` (giữ `role="img"`, `aria-label`, icon, số). Hai `Handle` giữ nguyên prop và id.
- **Dòng cột** (`column-row.tsx`): `li` thành `relative grid h-7 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 px-3`; khi cột vừa là khóa chính vừa là khóa ngoại, cột đầu nới `grid-cols-[2.25rem_minmax(0,1fr)_auto]` (giữ quy tắc `w-9` hiện có cho `KeyMarks`). Icon khóa `size-3.5` (14 px) giữ màu `text-canvas-key`, `text-canvas-foreign-key`; tên cột khóa chính `font-semibold`. Cụm phải `flex items-center gap-1`: kiểu cột `font-mono text-muted-foreground` với `?` dính liền sau kiểu (giữ `NotationMark` nullable bên trong span kiểu, không chip); `U`, `AI` dùng `NotationMark` dạng chip `rounded-sm bg-muted px-1 text-[0.625rem] font-medium text-muted-foreground`; icon comment, dấu issue `size-3.5`. Thứ tự DOM của mọi phần tử (dấu khóa, tên, kiểu, `?`, `U`, `AI`, comment, issue, handle) giữ nguyên, text ẩn giữ nguyên.
- Nếu `ColumnRow` đang có trạng thái tô sáng dòng thì đổi sang `bg-accent text-accent-foreground`; không thêm cơ chế tô sáng mới.
- Không thêm selector Zustand; `getTableAccentColor` gọi thẳng trong render.

**Test viết trước** (`table-node.test.tsx`):

- `paints the table header with the accent of its table id`: render node của bảng id `tbl_users`, tìm phần tử chứa tên bảng trên dải, đọc `style.backgroundColor` của dải và so với `getTableAccentColor("tbl_users")` (tức `var(--table-accent-7)`).
- Test hiện có của `table-node.test.tsx`, `table-node.render-count.test.tsx` (sửa một cột chỉ render lại dòng đó) và axe phải xanh không sửa.

**Kiểm tra:** như Quy ước chung. Ghi vào báo cáo để kiểm tra tay: node khi chọn có viền 2 px màu chính, focus bàn phím có vòng ngoài cách 2 px, handle hiện khi trỏ chuột vào node.

**Commit:** `feat(frontend): restyle table nodes with accent headers`

## Task 6: Đường quan hệ, marker, canvas và minimap

**Mục tiêu:** spec [mục 5](../specs/2026-10-01-visual-refresh-design.md#5-đường-quan-hệ) với câu hỏi đã trả lời 2 (đường vuông góc bo góc), [mục 6](../specs/2026-10-01-visual-refresh-design.md#6-canvas-minimap-điều-khiển).

**Phụ thuộc:** Task 1, Task 4. **Đợt:** 2.

**File sở hữu:**

- `frontend/src/features/editor/components/canvas/relation-edge.tsx` (sửa)
- `frontend/src/features/editor/components/canvas/relation-markers.tsx` (sửa)
- `frontend/src/features/editor/components/canvas/relation-edge.test.tsx` (sửa: thêm test)
- `frontend/src/features/editor/components/canvas/editor-canvas.tsx` (sửa)
- `frontend/src/features/editor/components/canvas/editor-canvas.test.tsx` (sửa: thêm test)
- `frontend/src/features/editor/components/canvas/canvas-empty-state.tsx` (sửa)

**Chữ ký và hành vi:**

- `relation-edge.tsx`: đổi `getBezierPath` sang:

```ts
const EDGE_CORNER_RADIUS = 8;
// Long enough for the crow's foot to sit on a straight segment.
const EDGE_HANDLE_OFFSET = 16;

const [path, labelX, labelY] = getSmoothStepPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  borderRadius: EDGE_CORNER_RADIUS,
  offset: EDGE_HANDLE_OFFSET,
});
```

- Nét: mặc định 1,5 px lấy từ `--xy-edge-stroke-width` (Task 1), không đặt inline; được chọn `SELECTED_STROKE_WIDTH = 2.5` inline; có issue giữ `stroke: var(--destructive)`, `strokeDasharray: "6 4"`, 2,5 px khi chọn. Giữ `EDGE_INTERACTION_WIDTH = 24` và `in-focus-visible:stroke-4!`.
- `className` của `BaseEdge`: luôn có `in-focus-visible:stroke-4!` và `relation-edge-start-many` hoặc `relation-edge-start-one` (theo `data.kind`); thêm `relation-edge-hoverable` chỉ khi biến thể là `default` (không chọn, không issue). Ba tên này là hợp đồng với CSS hover của Task 1, không đổi.
- `relation-markers.tsx`: `RelationMarkerVariant` thêm `"hover"`; `VARIANT_COLORS.hover = "var(--canvas-relation-hover)"`; `VARIANTS` thêm `"hover"` để sinh `relation-marker-many-hover`, `relation-marker-one-hover`. `MARKER_STROKE_WIDTH` 1,5 → 2. `MARKER_SIZE` giữ 12; giữ hình chân gà và vạch (có thể chỉnh `MARKER_PATHS` để nét 2 px không bị cắt ở mép viewBox, ví dụ lùi vạch trong vào 1 px, nhưng giữ số vạch, hướng mở 0 → 12 px).
- Nhãn giữa đường: `rounded-full border border-border bg-card px-1.5 text-[0.625rem] font-medium text-muted-foreground shadow-sm`; khi `selected`: `border-primary text-foreground`. Giữ `aria-hidden`, nội dung, icon issue `size-3`.
- `editor-canvas.tsx`:

```tsx
<MiniMap<TableFlowNode>
  pannable
  zoomable
  nodeColor={(node) => getTableAccentColor(node.data.tableId)}
  nodeBorderRadius={2}
  className="overflow-hidden rounded-lg border border-border shadow-md"
/>
<Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
```

  Vị trí, kích thước minimap giữ mặc định (góc dưới phải). Không thêm `<Controls>`.
- `canvas-empty-state.tsx`: thẻ `rounded-xl border border-dashed border-input bg-card/90 p-6 shadow-sm`, icon `Table2Icon` `size-8 text-muted-foreground` `aria-hidden`, tiêu đề `text-base font-semibold`, nút "Thêm bảng" biến thể `default` với `PlusIcon`. Chuỗi giữ nguyên.

**Test viết trước:**

- `relation-edge.test.tsx`: `renders a hover marker variant for every marker shape` (render `<RelationMarkers />`, khẳng định có `marker#relation-marker-many-hover` và `marker#relation-marker-one-hover`); `draws the relation as a right-angle path` (thuộc tính `d` của path cạnh không chứa lệnh bezier `C`).
- `editor-canvas.test.tsx`: `colors minimap nodes with the table accent` (với schema có bảng `tbl_users`, `rect.react-flow__minimap-node` có `style.fill` là `var(--table-accent-7)`; nếu jsdom không vẽ minimap node vì thiếu kích thước, dùng `MeasuringResizeObserver` sẵn có trong file).
- Mọi test hiện có của hai file và axe phải xanh không sửa.

**Kiểm tra:** như Quy ước chung. Ghi vào báo cáo để kiểm tra tay: hover một cạnh đổi màu, dày lên và marker đổi màu trên Chrome, Firefox, Safari (nếu một trình duyệt không áp marker qua CSS, ghi lại; theo spec phương án lùi là bỏ biến thể marker hover); quan hệ tự tham chiếu không đè lên node.

**Commit:** `feat(frontend): draw relations as rounded right-angle paths`

## Task 7: Toolbar và khung editor

**Mục tiêu:** spec [mục 7](../specs/2026-10-01-visual-refresh-design.md#7-toolbar), phần khung của [mục 8](../specs/2026-10-01-visual-refresh-design.md#8-panel-trái-panel-thuộc-tính).

**Phụ thuộc:** Task 1, Task 3. **Đợt:** 2.

**File sở hữu** (đều sửa): `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`, `save-status-badge.tsx`, `cloud-status-badge.tsx`, `issue-count-button.tsx`, `schema-name-button.tsx`; `frontend/src/features/editor/components/editor-workspace.tsx`, `editor-screen.tsx`, `editor-screen-loader.tsx`, `editor-skeleton.tsx`, `editor-status-screen.tsx`, `skip-to-panel-link.tsx`; `frontend/src/features/editor/lib/viewport-controls.tsx`. Không sửa `ThemeSwitch`, `LanguageSwitch`, `AccountMenu` (Task 10).

**Cài đặt:**

- Thanh toolbar: giữ `h-12 border-b border-border bg-background px-2`, `gap-1`; separator `mx-1.5 h-5`. Thứ tự, nhóm nút, `aria-*` giữ nguyên.
- "Thêm bảng": `variant="secondary"` với `PlusIcon`; "Thêm enum": `ghost` với `PlusIcon`. Nút icon giữ `size="icon"`.
- `schema-name-button.tsx`: nút tên `text-sm font-semibold`, hover `bg-accent`; hộp thoại đổi tên giữ hành vi.
- `issue-count-button.tsx`: khi có issue, nút mang `bg-destructive/10 text-destructive` (trên `--background`, 4,65:1 ở light); khi không có, `text-muted-foreground`.
- `save-status-badge.tsx`, `cloud-status-badge.tsx`: đoạn chữ hiển thị thành pill `inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium` với chấm `size-1.5 rounded-full` `aria-hidden` đứng trước chữ. Tông màu (chữ `text-*`, chấm `bg-*`): save `saved` → `success`, `failed` → `destructive`, còn lại → `muted-foreground`; cloud: `isError` → `destructive`, `synced` → `success`, `unsynced`, `unsynced-session-expired`, `conflict`, `deleted-in-cloud` → `warning`, `local-only`, `syncing` → `muted-foreground`. Viết tông bằng `switch` đầy đủ có nhánh `never`. Không đặt nền pha màu sau chữ. Giữ phần tử `p`, `span role="status"` ẩn, nút thử lại, văn bản.
- Nút đang mở menu (`aria-expanded="true"`) có nền `--accent` nhờ biến thể `ghost` của Task 3; không thêm class.
- Khung editor (`editor-workspace.tsx`, `editor-skeleton.tsx`, `editor-status-screen.tsx`, `skip-to-panel-link.tsx`, `editor-screen*.tsx`, `viewport-controls.tsx`): chỉ đổi class theo token và kích thước ở spec mục 3; skeleton giữ đúng kích thước khối thật; skip link giữ hiện khi focus với `rounded-md bg-popover shadow-md ring-3 ring-ring`.

**Test viết trước:** không có hành vi mới. Test hiện có `editor-toolbar.test.tsx`, `cloud-status-badge.test.tsx`, `editor-workspace.test.tsx`, `editor-status-screen.test.tsx`, `editor-screen.test.tsx`, `viewport-controls.test.tsx` và bốn journey trong `features/editor/journeys/` phải xanh không sửa.

**Kiểm tra:** như Quy ước chung.

**Commit:** `feat(frontend): restyle the editor toolbar and status pills`

## Task 8: Panel trái, panel thuộc tính và hộp thoại editor

**Mục tiêu:** spec [mục 8](../specs/2026-10-01-visual-refresh-design.md#8-panel-trái-panel-thuộc-tính), phần hộp thoại editor của [mục 12](../specs/2026-10-01-visual-refresh-design.md#12-hộp-thoại-menu-popover-tooltip-toast).

**Phụ thuộc:** Task 1, Task 3, Task 4. **Đợt:** 2.

**File sở hữu** (đều sửa, chỉ file `.tsx` cần đổi class): `frontend/src/features/editor/components/panels/**/*.tsx`, `frontend/src/features/editor/components/dialogs/*.tsx`, `frontend/src/features/editor/components/committed-text-area.tsx`, `committed-text-field.tsx`. File `.ts` trong các thư mục này không cần sửa.

**Cài đặt:**

- Khung panel: nền `bg-background`, viền `border-border` phía giáp canvas (giữ `w-72`, `w-80`); đệm `p-4`, khoảng giữa nhóm `gap-5`, giữa trường `gap-3`.
- Nhãn nhóm ("Cột", "Index"…): `text-xs font-semibold uppercase tracking-wide text-muted-foreground`. Không đổi cấp heading hay nội dung heading.
- `table-list-tab.tsx`: trước tên bảng thêm chấm `size-2 shrink-0 rounded-[2px]` `aria-hidden` với `style={{ backgroundColor: getTableAccentColor(table.id) }}`; số cột `tabular-nums`; dòng `aria-current` nền `bg-accent text-accent-foreground`. Giữ focus `focus-visible:ring-3 focus-visible:ring-ring` và `ON_ACCENT_TEXT_CLASS_NAME`.
- `table-panel.tsx`: giữ `h2` và nội dung của nó (accessible name không đổi); bọc hoặc gắn cho `h2` vạch màu `border-l-4 pl-2` với `style={{ borderLeftColor: getTableAccentColor(table.id) }}`.
- `column-item.tsx`: `fieldset` `rounded-lg border border-border bg-card p-3`; hàng checkbox `gap-x-4`.
- Panel quan hệ, nhiều lựa chọn, enum, issue: cùng quy tắc nhãn nhóm, khoảng cách; dòng issue có `TriangleAlertIcon` `text-destructive` `aria-hidden` và nút "Đi tới" `variant="link"` (giữ tên nút).
- Hộp thoại trong `dialogs/` dùng `Dialog`, `AlertDialog` đã restyle ở Task 3; chỉ chỉnh khoảng cách nội dung (`gap-4`), lỗi trường `text-sm text-destructive`. Test `conflict-dialog.test.tsx` đọc `className` bằng `"sr-only"` của chữ "Loading the cloud version": giữ đúng class đó.

**Test viết trước:** không có hành vi mới. Mọi test trong `panels/**`, `dialogs/*`, `committed-text-*.test.tsx` và journey editor phải xanh không sửa.

**Kiểm tra:** như Quy ước chung.

**Commit:** `feat(frontend): restyle editor panels and dialogs`

## Task 9: Dấu nhận diện và danh sách schema

**Mục tiêu:** spec [mục 10](../specs/2026-10-01-visual-refresh-design.md#10-danh-sách-schema).

**Phụ thuộc:** Task 1, Task 3. **Đợt:** 2.

**File sở hữu:**

- `frontend/src/components/brand-mark.tsx` (tạo)
- `frontend/src/components/brand-mark.test.tsx` (tạo)
- `frontend/src/features/schema-list/components/*.tsx` (sửa các file cần đổi class; file `*.test.tsx` trong thư mục này không sửa)

**Chữ ký và hành vi:**

```tsx
// frontend/src/components/brand-mark.tsx
export function BrandMark(): JSX.Element;
```

Render `span.inline-flex.items-center.gap-2.font-bold` gồm ô `grid size-7 place-items-center rounded-md bg-primary text-primary-foreground` chứa `DatabaseIcon` `size-4` (ô có `aria-hidden`) và chữ `{APP_NAME}` từ `@/lib/app-name`. Không có chuỗi i18n mới. Không có state hay hook nên không cần `"use client"`; dùng được cả trong component client của danh sách lẫn trang auth.

**Cài đặt:**

- Header (`schema-list-screen.tsx`): `h-14 border-b border-border bg-background px-4`, trái thay `<span className="font-semibold">{APP_NAME}</span>` bằng `<BrandMark />`; phải giữ `AccountMenu`, `ThemeSwitch`, `LanguageSwitch` và thứ tự.
- Vùng nội dung giữ `max-w-3xl`; `h1` `text-2xl font-bold` (giữ focus outline hiện có); nút "Tạo schema" `variant="default"` với `PlusIcon`; danh sách `gap-2`.
- Dòng (`schema-list-row.tsx`): `ROW_CLASS_NAME` thành `flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-[border-color] duration-150 hover:border-input`; ô icon `grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground` `aria-hidden` chứa `CloudIcon` (có bản cloud) hoặc `HardDriveIcon` (chỉ local) `size-4`, lấy điều kiện từ dữ liệu mà `SchemaStatusLabel` đang dùng; nút menu `EllipsisIcon` `size="icon"`. `LINK_CLASS_NAME`: `font-semibold text-foreground no-underline hover:underline underline-offset-4` + giữ focus outline 2 px `--ring`. Metadata `tabular-nums`.
- `schema-status-label.tsx`: pill `rounded-full px-2 text-xs font-medium`; trạng thái cần chú ý `bg-warning/10 text-warning` hoặc `bg-destructive/10 text-destructive` (pill nằm trên thẻ `--card`, cặp đã có test ở Task 1); trạng thái thường `border border-border text-muted-foreground`. Giữ chữ.
- `cloud-list-banner.tsx`, `session-expired-banner.tsx`, `sign-in-invite.tsx`: `flex items-start gap-3 rounded-lg border p-3` với icon ngữ nghĩa `size-4 shrink-0` `aria-hidden` bên trái (`CircleAlertIcon text-destructive` cho banner lỗi, `TriangleAlertIcon text-warning` cho banner cảnh báo, `CloudIcon text-muted-foreground` cho lời mời); viền `border-destructive`, `border-warning`, `border-border bg-muted` tương ứng. Chữ trong banner giữ `text-foreground`.
- Trạng thái trống: thẻ `flex flex-col items-center gap-3 rounded-lg border border-dashed border-input p-8 text-center`, `DatabaseIcon` `size-8 text-muted-foreground` `aria-hidden`, chuỗi và nút có sẵn.
- Skeleton dòng: `h-19` (76 px, bằng thẻ thật), giữ `motion-reduce:animate-none`.
- Hộp thoại `create-`, `rename-`, `delete-schema-dialog.tsx` chỉ đổi khoảng cách nếu cần; style chính đến từ Task 3.

**Test viết trước:**

- `brand-mark.test.tsx`: `shows the app name next to a decorative icon` (text `APP_NAME` có trong tài liệu; icon nằm trong phần tử `aria-hidden`), `reports no axe violations` (dùng `expectNoAxeViolations`).
- Test hiện có trong `features/schema-list/` (gồm `schema-list-journey.test.tsx`) và `src/app/page.test.tsx` phải xanh không sửa.

**Kiểm tra:** như Quy ước chung. Ghi vào báo cáo để kiểm tra tay: không cuộn ngang ở 320 px.

**Commit:** `feat(frontend): restyle the schema list with a brand mark`

## Task 10: Đăng nhập, đăng ký, component dùng chung và trang 404

**Mục tiêu:** spec [mục 11](../specs/2026-10-01-visual-refresh-design.md#11-đăng-nhập-đăng-ký), phần component dùng chung của [mục 12](../specs/2026-10-01-visual-refresh-design.md#12-hộp-thoại-menu-popover-tooltip-toast).

**Phụ thuộc:** Task 9 (`BrandMark`). **Đợt:** 3.

**File sở hữu** (đều sửa khi cần đổi class; file test không sửa):

- `frontend/src/features/auth/components/sign-in-screen.tsx`, `sign-up-screen.tsx`, `credentials-form.tsx`
- `frontend/src/app/(auth)/sign-in/page.tsx`, `frontend/src/app/(auth)/sign-up/page.tsx` (dự kiến không đổi; route giữ mỏng)
- `frontend/src/components/account-menu.tsx`, `theme-switch.tsx`, `language-switch.tsx`, `sign-in-prompt.tsx`, `sign-out-dialog.tsx`, `upload-schemas-dialog.tsx`, `upload-prompt-host.tsx`
- `frontend/src/app/not-found.tsx`
- Các file `frontend/src/components/*.tsx` khác (`app-providers.tsx`, `auth-provider.tsx`, `background-sync-host.tsx`, `i18n-provider.tsx`, `theme-provider.tsx`) không có giao diện riêng; nếu cần đổi, cũng thuộc task này, trừ `brand-mark.tsx` (Task 9)

**Cài đặt:**

- Trang auth (`sign-in-screen.tsx`, `sign-up-screen.tsx`): `main` `grid min-h-dvh justify-items-center content-start gap-6 bg-canvas p-4 sm:place-content-center sm:p-6` với lưới chấm bằng `bg-[radial-gradient(var(--canvas-dot)_1px,transparent_1px)] bg-size-[20px_20px]`; trên thẻ là `<BrandMark />`; thẻ `w-full max-w-[400px] rounded-xl border border-border bg-card p-6 shadow-md sm:p-8` chứa `h1` `text-2xl font-bold`, form, rồi `Separator` và hai dòng phụ (thông báo chưa có khôi phục mật khẩu, link sang trang kia). Link giữ gạch chân (nằm trong câu) và `min-h-6`. Thứ tự DOM của tiêu đề, form, link giữ nguyên.
- `credentials-form.tsx`: nút gửi `w-full` `size="lg"` biến thể `default`; nút hiện mật khẩu giữ `size-8` (test target size đọc class này); lỗi trường `flex items-center gap-1.5 text-sm text-destructive` với `CircleAlertIcon` `size-3.5` `aria-hidden` trước chữ, giữ `id` mà `aria-describedby` trỏ tới.
- `account-menu.tsx`, `theme-switch.tsx`, `language-switch.tsx`: nút trigger `ghost` `size="icon"` hoặc như hiện tại; menu dùng style của Task 3; không đổi `aria-label`, mục menu, phím.
- `sign-in-prompt.tsx`, `sign-out-dialog.tsx`, `upload-schemas-dialog.tsx`, `upload-prompt-host.tsx`: chỉ chỉnh khoảng cách, chữ phụ `text-muted-foreground`; nút hủy `outline`, nút xác nhận `default` hoặc `destructive`.
- `not-found.tsx`: bố cục như trang auth (nền `bg-canvas` lưới chấm, `BrandMark`, thẻ), giữ `h1`, mô tả, link về trang chủ và focus outline.

**Test viết trước:** không có hành vi mới. Test hiện có: `sign-in-screen.test.tsx`, `sign-up-screen.test.tsx`, `credentials-form.test.tsx` (gồm `gives the visibility toggle at least a 24 pixel target`), `app/(auth)/*/page.test.tsx`, `app/not-found.test.tsx`, và test của mọi file `components/*.tsx` phải xanh không sửa.

**Kiểm tra:** như Quy ước chung. Ghi vào báo cáo để kiểm tra tay: trang auth không cuộn ngang ở 320 px, phóng chữ 200% vẫn đọc được.

**Commit:** `feat(frontend): restyle auth pages and shared app components`

## Task 11: Cập nhật tài liệu

**Mục tiêu:** đồng bộ tài liệu với phần đã làm. Do `spec-writer` thực hiện sau khi Task 1–10 đã merge và người dùng chạy xong [danh sách kiểm tra tay](#kiểm-tra-tay-cho-người-dùng). Chạy sau Task 38 của plan phần 4 nếu task đó chưa xong.

**Phụ thuộc:** Task 1–10. **Đợt:** 4.

**File sở hữu:**

- `document/architecture.md` (sửa)
- `document/roadmap.md` (sửa)

**Cài đặt:**

- `architecture.md`, hàng "UI kit, styling": thêm font Plus Jakarta Sans (giao diện) và JetBrains Mono (kiểu cột, code) qua `next/font/google`, tự host lúc build, preload subset `latin` và `vietnamese`, biến `--font-plus-jakarta-sans`, `--font-jetbrains-mono` ánh xạ sang `--font-sans`, `--font-mono` trong `@theme inline`; lý do: không thêm dependency, hợp `font-src 'self'`.
- Hàng "Token viền và focus ring": thay giá trị cũ bằng giá trị mới (light `--border: oklch(0.915 0.01 258)`, `--input: oklch(0.62 0.02 260)`, `--ring: oklch(0.25 0.07 262)`; dark `--border`, `--input` giữ, `--ring: oklch(0.56 0.11 258)`); nguyên tắc tách token giữ; thêm câu lề hẹp ở dark (`--ring` trên `--primary` 3,25, trên `--muted` 3,32).
- Hàng "Kiểm tra độ tương phản": thêm ngưỡng 4,5:1 cho chữ ở tầng token (nhóm `TEXT_CASES`, chữ trên nền pha 10%) và test chặn màu hardcode trong `.tsx`; sửa câu "tương phản của chữ vẫn kiểm tay" thành chỉ phần phụ thuộc layout.
- Hàng mới hoặc ghi chú trong hàng "Thư viện canvas": đường quan hệ vẽ bằng `getSmoothStepPath` (`borderRadius: 8`, `offset: 16`); hover cạnh bằng CSS; màu dải tiêu đề bảng băm FNV-1a từ `table.id` (`frontend/src/features/editor/lib/table-accent.ts`), core không có trường màu.
- `roadmap.md`: ô "Trạng thái" của phần 10 thành `Xong`; sửa câu ghi chú "Phần 10 … spec đang chờ duyệt" thành trạng thái đã xong, trỏ tới spec và plan.

**Test viết trước:** không áp dụng.

**Kiểm tra:** link tương đối và anchor trong hai file mở được; bảng đúng số cột; spec, plan, `architecture.md`, `roadmap.md` không mâu thuẫn.

**Commit:** `docs: record visual refresh decisions and mark part 10 done`


## Vấn đề phát hiện khi lập plan

Các mục dưới là chi tiết cài đặt hoặc chỗ spec chưa nói đủ; plan đã chọn cách xử lý trong phạm vi quyết định của spec.

| # | Vấn đề | Đề xuất | Ảnh hưởng |
|---|---|---|---|
| 1 | Spec mục 3 ghi `subsets: ["latin", "latin-ext", "vietnamese"]`, mục 14 ghi chỉ preload `latin`. Loader của `next/font/google` 16.3.5 tải và tự host mọi file trong CSS của Google; `subsets` chỉ chọn file được preload | `subsets: ["latin", "vietnamese"]` cho cả hai font: giao diện mặc định là tiếng Việt nên preload subset `vietnamese` tránh nháy chữ; `latin-ext` vẫn được tự host và tải khi cần theo `unicode-range` | Task 2, Task 11 |
| 2 | `@theme inline { --shadow-sm: var(--shadow-sm) }` trông như tự tham chiếu (spec, mục "Rủi ro") | Đã biên dịch thử bằng `@tailwindcss/node` 4.3.3 ngày 2026-10-02: class sinh `--tw-shadow: var(--shadow-sm)`, khai báo không layer trong `:root`, `.dark` thắng; giữ cách này kèm comment | Task 1 |
| 3 | Assertion chuỗi class node trong `globals.test.ts` (spec mục 17 để plan chọn) | Task 1 nới assertion thành `"border border-canvas-node-border bg-card"`, khớp class cũ và mới; Task 5 giữ chuỗi này liền nhau | Task 1, Task 5 |
| 4 | Chữ trên nền pha màu: đo ngày 2026-10-02, `--warning` trên nền pha 10% đặt trên `--background` light chỉ 4,47:1; mọi nền pha 20% (biến thể `destructive` của nút ở dark, hover ở light) 3,93–4,40:1 | Chỉ dùng nền pha 10%, không đặt `bg-warning/10` trên `--background`; nút `destructive` báo hover bằng viền thay vì đậm nền; Task 1 thêm test cho các cặp được dùng | Task 1, 3, 7, 9 |
| 5 | Spec mục 2 đòi "test chặn màu dải tiêu đề hardcode" ở `globals.test.ts`, nhưng code của dải chưa có khi Task 1 chạy | Tách thành test quét màu hardcode trong mọi `.tsx` (Task 1) và test đọc `style` của dải tiêu đề (Task 5) | Task 1, Task 5 |
| 6 | Spec mục 8 nói đầu panel bảng là "tên bảng kèm vạch màu", nhưng `h2` hiện là nhãn chung `tablePanel.label`; đổi nội dung làm đổi accessible name của heading | Giữ nội dung `h2`, chỉ thêm vạch màu 4 px | Task 8 |
| 7 | Spec mục 5 để plan chốt selector hover marker | CSS trong `globals.css` theo class `relation-edge-hoverable`, `relation-edge-start-many`, `relation-edge-start-one` và id `relation-marker-{many,one}-hover` | Task 1, Task 6 |
| 8 | Hover nút `default` bằng `bg-primary/80` làm nền nhạt đi, giảm tương phản chữ trên nút | Hover bằng `color-mix` với `--foreground` 12% (cùng cách nút `secondary` đang dùng) | Task 3 |
| 9 | `next build` cần mạng để tải font | Ghi ở "Điều kiện tiên quyết"; CI GitHub Actions có mạng | Mọi task (lệnh build) |
| 10 | Spec mục "Vấn đề với các spec đã duyệt" số 6 ghi font vào "Chưa chốt" của `architecture.md` trong lúc chờ duyệt, nhưng mục đó chưa được thêm | Task 11 ghi thẳng vào "Quyết định đã chốt" vì spec đã duyệt | Task 11 |

## Đối chiếu tiêu chí hoàn thành

| Tiêu chí (spec, "Tiêu chí hoàn thành") | Task |
|---|---|
| Chung: `typecheck`, `lint`, `test`, `build` xanh; không đổi `packages/`, `backend/` | Mọi task (Quy ước chung) |
| Chung: test component có từ trước xanh không sửa assertion, trừ chuỗi class node trong `globals.test.ts` | Mọi task; Task 1 sửa assertion duy nhất |
| Chung: không thêm dependency, không đổi lockfile | Mọi task (Điểm nóng) |
| Chung: không có màu hardcode ngoài `globals.css` | Task 1 (test quét), mọi task |
| Chung: không có chuỗi giao diện mới ngoài i18n | Mọi task (Quy ước chung), Task 9 (`BrandMark` dùng `APP_NAME`) |
| Chung: giao diện khớp mockup ở light và dark (kiểm tra tay) | Kiểm tra tay, mục 1–3 |
| Token: mọi token mục 2 trong `:root`, `.dark`; case 3:1 và nhóm 4,5:1 xanh | Task 1 |
| Font: tải từ chính origin, có subset `vietnamese`, không gọi `fonts.googleapis.com` (kiểm tra tay) | Task 2; kiểm tra tay mục 4 |
| Màu bảng: `table-accent.test.ts` xanh; dải tiêu đề lấy màu qua `var(--table-accent-N)` | Task 4, Task 5 |
| Node bảng: dải tiêu đề, dòng 28 px, icon khóa 14 px, chip `U`, `AI`; chọn viền 2 px (kiểm tra tay) | Task 5; kiểm tra tay mục 5 |
| Edge: ba trạng thái màu, marker `hover`, test marker xanh, đường vuông góc | Task 1 (CSS), Task 6 |
| Canvas: nền `--canvas`, lưới chấm 20 px, minimap tô màu bảng (test component) | Task 1, Task 6 |
| Toolbar, panel: pill trạng thái có chữ, chấm màu bảng trong danh sách bảng (kiểm tra tay) | Task 7, Task 8; kiểm tra tay mục 6 |
| Danh sách schema, auth, hộp thoại, menu, toast; không cuộn ngang ở 320 px (kiểm tra tay) | Task 3, Task 9, Task 10; kiểm tra tay mục 7 |
| Reduced motion tắt mọi transition (kiểm tra tay) | Task 1; kiểm tra tay mục 8 |
| Tương phản chữ trên nền pha ≥ 4,5:1 ở hai theme (kiểm tra tay) | Task 1 (test các cặp được dùng); kiểm tra tay mục 9 |
| Cập nhật `architecture.md`, `roadmap.md` | Task 11 |

## Kiểm tra tay cho người dùng

Chạy sau khi Task 1–10 đã merge, trước Task 11. Dùng Chrome, `pnpm dev`, mỗi mục kiểm ở light và dark (nút theme), và ở `vi` và `en` (nút ngôn ngữ) khi mục có chữ.

1. Danh sách schema `/`: header có dấu nhận diện, thẻ schema có ô icon, nhãn trạng thái là pill; so với mockup.
2. Editor: toolbar có separator, "Thêm bảng" nổi hơn "Thêm enum", pill lưu và cloud có chấm màu kèm chữ; canvas tối hơn panel một chút, lưới chấm thấy được nhưng nhạt.
3. Hộp thoại (tạo schema, xóa schema, tạo quan hệ), menu tài khoản, toast (đổi tên schema rồi hoàn tác): bo góc lớn, bóng rõ, lớp phủ tối; icon toast có màu.
4. DevTools tab Network, tải lại `/`: file font đến từ `/_next/static/media/`, không có request tới `fonts.googleapis.com`, `fonts.gstatic.com`; chữ tiếng Việt có dấu hiển thị cùng một font.
5. Node bảng: dải màu khác nhau giữa các bảng, tên trắng đọc rõ; chọn bảng thấy viền xanh 2 px; Tab tới node thấy vòng focus cách 2 px; trỏ chuột vào node thấy handle; kéo node vẫn mượt (DevTools Performance, CPU chậm 4×, ≥ 30 fps).
6. Đường quan hệ: vuông góc bo góc; trỏ chuột vào một cạnh thấy đậm và đổi màu cả ký hiệu chân gà; cạnh có issue nét đứt đỏ; quan hệ tự tham chiếu không đè lên node. Lặp lại hover cạnh trên Firefox và Safari nếu có.
7. Trang đăng nhập, đăng ký và trang 404 ở chiều rộng 320 px (DevTools device toolbar) và phóng chữ 200%: không cuộn ngang, form trong thẻ.
8. DevTools Rendering, "Emulate CSS media feature prefers-reduced-motion: reduce": hover nút, mở hộp thoại không còn chuyển động.
9. Đo bằng DevTools color picker (mục Contrast): chữ trên chip issue của toolbar, nhãn trạng thái schema cần chú ý, nút xóa trong hộp thoại xác nhận, chip trên dải tiêu đề node; tất cả ≥ 4,5:1.
10. Focus bàn phím: Tab qua toolbar, panel, danh sách schema, form auth; mọi control có vòng focus thấy rõ, không bị minimap, toast che.
