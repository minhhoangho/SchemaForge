# Visual refresh

Spec cho phần 10 trong [roadmap.md](../roadmap.md): làm mới giao diện của SchemaForge mà không đổi bố cục, route, luồng thao tác hay cấu trúc component. Phần này chạm tới ED-12 (dark mode, light mode) và giữ nguyên UX-04 (giao diện `vi` và `en`) trong [danh sách tính năng](2026-09-14-feature-list-design.md).

Spec dựa trên [spec phần 3](2026-09-14-editor-mvp-design.md) (editor, canvas, theme, accessibility), [spec phần 4](2026-09-15-auth-cloud-design.md) (trang đăng nhập, đăng ký, danh sách schema có cloud, hộp thoại đồng bộ) và [spec phần 6](2026-09-14-code-generators-design.md) (code panel, theme CSS variables của Shiki), cả ba đã duyệt. Tên token, component, namespace i18n lấy đúng như trong code hiện tại.

Mockup tĩnh dùng đúng bộ token của spec này được gửi kèm để người dùng duyệt giao diện trước khi viết plan. Các đoạn CSS và TypeScript là phác thảo: plan và code tinh chỉnh chi tiết nhưng không đổi quyết định. Mục đánh dấu ⚠ cần người dùng xác nhận.

Mockup tĩnh: [ui_reference/visual-refresh-mockup.html](../ui_reference/visual-refresh-mockup.html).

## Quyết định đã có từ trước

Spec này không bàn lại các điểm sau:

- **Phạm vi chỉ là giao diện** (quyết định của người dùng khi giao phần này): giữ bố cục, route, luồng, cấu trúc component; làm lại design system (màu, chữ, khoảng cách, bo góc, bóng, viền, icon, trạng thái hover, focus, active, selected) và giao diện canvas. Áp dụng cho mọi màn hình: editor và canvas, danh sách schema, đăng nhập, đăng ký, hộp thoại, menu, toast dùng chung. Phong cách tham khảo dbdiagram.io và drawSQL; light và dark ngang hàng.
- **UI kit:** Tailwind CSS 4, shadcn/ui sinh vào `frontend/src/components/ui/`, `radix-ui`, icon `lucide-react` (`architecture.md`, hàng "UI kit, styling").
- **Theme:** cookie `sf-theme`, class `.dark` đặt trước khi vẽ bằng script tĩnh có nonce; không dùng `next-themes` (`architecture.md`, hàng "Theme").
- **CSP:** `style-src` cho `'unsafe-inline'`, `font-src 'self'` (`architecture.md`, hàng "CSP"; `frontend/src/lib/security/content-security-policy.ts`).
- **Kiểm tra độ tương phản ở tầng token:** `frontend/src/app/globals.test.ts` đọc khối `:root` và `.dark` của `frontend/src/app/globals.css`, tính tỉ lệ bằng `frontend/src/testing/contrast-ratio.ts`, ngưỡng 3:1 cho ranh giới control và focus ring; quét mã nguồn chặn ring, border, outline ở opacity thấp (`architecture.md`, hàng "Kiểm tra độ tương phản"). Mọi token phải viết dạng `oklch(...)` hoặc `var(--...)` để helper parse được.
- **Tách token viền:** `--border` là trang trí, `--input` là ranh giới control, `--canvas-node-border: var(--input)`, `--ring` dùng ở opacity đầy đủ (`architecture.md`, hàng "Token viền và focus ring").
- **Viền node bảng** đến từ class Tailwind trong `frontend/src/features/editor/components/canvas/table-node.tsx`, không phải từ `--xy-node-border` (`architecture.md`, hàng "Viền node bảng trên canvas").
- **Node chỉ hiển thị,** mọi chỉnh sửa nằm trong panel và hộp thoại (spec phần 3, mục 2).
- **Code panel:** Shiki 4, theme tạo bằng `createCssVariablesTheme`, biến `--code-*` khai báo trong `:root` và `.dark` của `globals.css` (spec phần 6, mục code panel).
- **Toast:** Sonner qua `Toaster` của shadcn/ui, vị trí `bottom-center`, chỉ gọi qua `createNotify`, `useNotify` (`architecture.md`, hàng "Toast").
- **Accessibility:** WCAG 2.2 AA; mục tiêu bấm ≥ 24×24 CSS px; không truyền thông tin chỉ bằng màu; phần tử đang focus không bị che; axe-core trong test component (`.claude/rules/react.md`, `architecture.md`, hàng "Accessibility").
- **Màu chỉ lấy từ theme token,** không hardcode; mọi chuỗi giao diện qua i18n với `vi` và `en` (`.claude/rules/nextjs.md`).
- **Core model không có màu bảng:** `tableFieldsShape` trong `packages/core/src/model/table.ts` là `z.strictObject` không có trường màu, có test từ chối trường `color`; spec phần 2 ghi "màu bảng và nhóm" là khái niệm chưa có trong model.

## Tóm tắt quyết định

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Hướng thiết kế | "Bản vẽ kỹ thuật thân thiện": nền trung tính hơi ngả xanh lam, một màu chính xanh lam, canvas lưới chấm, node bảng có dải tiêu đề màu, đường quan hệ vuông góc rõ ràng. Màu đậm chỉ dành cho dữ liệu (dải tiêu đề, khóa, quan hệ); khung ứng dụng giữ trung tính |
| 2 | Token màu | Giữ tên token của shadcn/ui, đổi giá trị sang OKLCH có sắc độ nhẹ (hue 255–262). Thêm `--success`, `--warning`, `--overlay`, `--canvas`, `--canvas-dot`, `--canvas-relation-hover`, `--canvas-node-header-foreground`, `--table-accent-1` … `--table-accent-8`, `--code-*`, ba token bóng. Giá trị ở [mục 2](#2-token-màu) |
| 3 | Độ tương phản | Chữ ≥ 4,5:1 (chữ lớn ≥ 3:1); ranh giới control, focus ring, đường quan hệ, icon khóa ≥ 3:1. Mọi giá trị đã tính bằng chính `contrast-ratio.ts` ngày 2026-10-01; `globals.test.ts` giữ nguyên các case cũ và thêm case cho token mới |
| 4 | Font | `next/font/google` (có sẵn trong Next.js, tự host nên hợp `font-src 'self'`): Plus Jakarta Sans cho giao diện, JetBrains Mono cho kiểu cột và code; cả hai có subset `vietnamese` và là variable font |
| 5 | Thang chữ, khoảng cách, bo góc | Giữ thang của Tailwind; `--radius` từ `0.625rem` xuống `0.5rem`; ba mức bóng `--shadow-sm`, `--shadow-md`, `--shadow-lg` theo theme |
| 6 | Màu dải tiêu đề bảng | Core không có trường màu, nên màu suy ra xác định từ `table.id` (FNV-1a 32 bit, chia lấy dư 8) trên bảng 8 màu `--table-accent-*`; chữ trên dải đạt ≥ 5,2:1 ở cả hai theme. Màu do người dùng chọn là câu hỏi mở ⚠ (đụng core model) |
| 7 | Node bảng | Dải tiêu đề màu, dòng cột cao 28 px, tên cột bên trái, kiểu cột font mono bên phải; khóa chính, khóa ngoại bằng icon lucide có màu kèm text ẩn; `U`, `AI`, `?` thành chip nhỏ, giữ nguyên ký tự; chọn = viền 2 px màu chính, focus = vòng `--ring` cách 2 px |
| 8 | Đường quan hệ | ⚠ Đổi `getBezierPath` sang `getSmoothStepPath` (đường vuông góc bo góc 8 px, có sẵn trong `@xyflow/react`); ba trạng thái màu mặc định, hover, chọn; ký hiệu chân gà giữ nguyên hình, nét 1,5 px → 2 px |
| 9 | Canvas | Nền `--canvas` khác nền khung ứng dụng một chút, lưới chấm `--canvas-dot` cách 20 px; minimap tô node theo màu dải tiêu đề; nút điều khiển vẫn nằm trên toolbar |
| 10 | Khung ứng dụng | Toolbar, panel trái, panel phải nền `--background`, viền `--border`; nhóm nút trên toolbar ngăn bằng separator; "Thêm bảng" là nút `secondary`; trạng thái lưu, cloud thành pill |
| 11 | Danh sách schema, đăng nhập | Danh sách giữ dạng dòng, mỗi dòng là thẻ có ô icon và metadata; trang auth đặt form trong thẻ giữa trang trên nền lưới chấm |
| 12 | Hộp thoại, menu, toast | Bo `rounded-xl`, bóng `--shadow-lg`, lớp phủ `--overlay`; icon toast mang màu ngữ nghĩa |
| 13 | Thư viện | Không thêm runtime dependency nào |
| 14 | Hành vi | Không đổi hành vi, thứ tự focus, accessible name, chuỗi i18n hiện có; chỉ thêm chuỗi mới nếu thật cần, luôn đủ `vi` và `en` |

## Phiên bản

Kiểm tra ngày 2026-10-01 trên chính repo (`node_modules` sau `pnpm install` của nhánh `master`), không cài thêm gói nào. Danh sách font và subset đọc từ `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` của Next.js đang cài. Tên biến CSS của Shiki đọc trên tài liệu chính thức `https://shiki.style/guide/theme-colors`.

| Gói | Phiên bản | Tương thích, ghi chú |
|---|---|---|
| `next` | 16.3.5 (đang cài, khai báo `^16.3.5`) | `next/font/google` có sẵn; Plus Jakarta Sans: subset `latin`, `latin-ext`, `vietnamese`, `cyrillic-ext`, trục `wght` 200–800. JetBrains Mono: subset gồm `vietnamese`, trục `wght` 100–800 |
| `@xyflow/react` | 12.11.6 (đang cài) | `getSmoothStepPath({ …, borderRadius, offset })` export từ `@xyflow/react` (khai báo trong `@xyflow/system` 0.0.82); `MiniMap` nhận `nodeColor`, `nodeStrokeColor`, `nodeBorderRadius`, `bgColor`, `maskColor`; `Background` nhận `color`, `bgColor`, `gap`, `size` |
| `lucide-react` | 1.45.0 (đang cài) | Đã kiểm tra có `KeyRoundIcon`, `Link2Icon`, `DatabaseIcon`, `CloudIcon`, `HardDriveIcon`, `Table2Icon`, `PlusIcon`, `EllipsisIcon`, `CloudCheckIcon`, `CloudOffIcon` |
| `sonner` | 2.x (khai báo `^2.0.8`) | `Toaster` nhận `icons` (đang dùng) và `toastOptions.classNames` với khóa `toast`, `title`, `description`, `icon`, `success`, `error`, `info`, `warning`; stylesheet đọc biến `--normal-bg`, `--normal-text`, `--normal-border`, `--border-radius` |
| `tailwindcss` | `^4.3.3` (không đổi) | Token khai báo trong `:root`, `.dark`, ánh xạ qua `@theme inline` như hiện tại |
| `shiki` | 4.4.3 (chưa cài; phiên bản do spec phần 6 chốt) | `createCssVariablesTheme({ variablePrefix })` dùng các biến `foreground`, `background`, `token-constant`, `token-string`, `token-comment`, `token-keyword`, `token-parameter`, `token-function`, `token-string-expression`, `token-punctuation`, `token-link`; với tiền tố `--code-` của spec phần 6 thành `--code-token-keyword`… |

Gói đã cân nhắc nhưng không dùng:

| Gói | Lý do không dùng |
|---|---|
| `@fontsource-variable/*` | Thêm dependency cho việc `next/font` đã làm (tự host, subset, `font-display`, biến CSS) |
| `geist` | Gói font riêng của Vercel; `next/font/google` đã có Geist nếu cần, và Geist không phải lựa chọn ở [mục 3](#3-chữ-khoảng-cách-bo-góc-bóng) |
| `@radix-ui/colors` | Bảng màu dựng sẵn ở dạng hex, không theo OKLCH và không qua được kiểm tra tương phản theo token hiện có; 8 màu dải tiêu đề tự định nghĩa đủ dùng |
| `next-themes` | Đã bị loại ở phần 3 (`architecture.md`, hàng "Theme") |

## 1. Hiện trạng và nguyên nhân

Giao diện hiện tại là theme mặc định của `shadcn init` gần như không chỉnh, cộng vài token canvas. Các điểm làm nó trông "xấu" và khó đọc:

| # | Vấn đề | Chỗ trong code | Vì sao |
|---|---|---|---|
| 1 | Toàn bộ thang màu là xám trung tính sắc độ 0, màu chính gần đen (`--primary: oklch(0.205 0 0)`), dark mode có màu chính gần trắng | `frontend/src/app/globals.css`, khối `:root` và `.dark` | Không có màu nhận diện; nút chính, link, quan hệ được chọn đều đen hoặc trắng, nên không phân biệt được hành động chính với chữ thường |
| 2 | Không nạp font nào: `--font-heading: var(--font-sans)` nhưng `--font-sans` không được khai báo, nên dùng font hệ thống mặc định của Tailwind | `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx` | Mỗi hệ điều hành một kiểu chữ; dấu tiếng Việt và chữ số không đồng đều; kiểu cột dùng `font-mono` hệ thống |
| 3 | Node bảng là thẻ trắng viền xám, tiêu đề chỉ là chữ đậm trên nền trắng, ngăn với dòng cột bằng một đường `--border` rất nhạt | `frontend/src/features/editor/components/canvas/table-node.tsx` | Trên canvas đông, mắt không tìm được tên bảng; không có gì phân biệt bảng này với bảng kia |
| 4 | Dòng cột cao khoảng 24 px, chữ 12 px; dấu `U`, `AI`, `?` là chữ xám rời rạc sau kiểu cột | `frontend/src/features/editor/components/canvas/column-row.tsx` | Dấu và kiểu cột dính vào nhau (`varchar(255)?U`), khó quét theo cột; icon khóa 12 px quá nhỏ |
| 5 | Đường quan hệ là bezier màu `--muted-foreground`, nét 1 px, ký hiệu chân gà 1,5 px | `frontend/src/features/editor/components/canvas/relation-edge.tsx`, `relation-markers.tsx` | Nhiều bezier cắt chéo nhau thành "mì sợi"; không có trạng thái hover nên khó biết đường nào đang trỏ chuột |
| 6 | Canvas dùng cùng màu nền với panel (`--xy-background-color: var(--background)`), chấm lưới dùng `--border` | `frontend/src/app/globals.css`, khối `.react-flow` | Không thấy ranh giới giữa vùng vẽ và khung ứng dụng |
| 7 | Toolbar là một hàng nút ghost giống hệt nhau, separator cao 24 px | `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx` | Không có điểm nhấn cho hành động chính (thêm bảng); trạng thái lưu và cloud là chữ trơn lẫn với nút |
| 8 | Danh sách schema: link gạch chân màu chính (đen), thẻ phẳng, không icon | `frontend/src/features/schema-list/components/schema-list-row.tsx`, `schema-list-screen.tsx` | Trông như trang tài liệu chưa định dạng; nhãn trạng thái (`SchemaStatusLabel`) là viền xám nhỏ |
| 9 | Trang đăng nhập, đăng ký là cột form trần ở góc trên, không có thương hiệu | `frontend/src/features/auth/components/sign-in-screen.tsx`, `sign-up-screen.tsx` | Trang đầu tiên người dùng mới thấy nhưng không có điểm nhận diện; form không có khung |
| 10 | Hộp thoại dùng `ring-1 ring-foreground/10` thay cho bóng, lớp phủ `bg-black/10` | `frontend/src/components/ui/dialog.tsx` | Ở light mode hộp thoại gần như không tách khỏi trang; ở dark mode viền mờ biến mất |

Phần tốt cần giữ: cơ chế token và kiểm tra tương phản, tách `--border` với `--input`, accessible name, thứ tự focus, các test target size (`size-6` trở lên).

## 2. Token màu

### Nguyên tắc

- **Trung tính có chủ ý.** Mọi màu nền, chữ, viền mang sắc độ rất nhẹ (chroma 0,003–0,03) ở hue 255–262, cùng họ với màu chính, thay cho xám sắc độ 0.
- **Một màu chính.** Xanh lam (hue 259) cho nút chính, link, quan hệ được chọn, node được chọn. Light dùng xanh lam đậm vừa; dark dùng xanh lam nhạt với chữ tối trên nút, giống cách theme cũ dùng màu chính sáng ở dark mode.
- **Màu đậm dành cho dữ liệu.** Dải tiêu đề bảng, icon khóa, đường quan hệ là chỗ có màu bão hòa; toolbar, panel, hộp thoại giữ trung tính.
- **Màu ngữ nghĩa tách khỏi màu chính:** `--destructive`, `--success`, `--warning` chỉ dùng cho trạng thái.

### Bảng token

Mọi giá trị viết ở dạng `oklch(...)` hoặc `var(--...)` để `globals.test.ts` parse được. Cột "Dùng cho" chỉ liệt kê chỗ chính.

| Token | Light (`:root`) | Dark (`.dark`) | Dùng cho |
|---|---|---|---|
| `--background` | `oklch(0.99 0.003 255)` | `oklch(0.185 0.012 262)` | Nền trang, toolbar, panel |
| `--foreground` | `oklch(0.24 0.025 262)` | `oklch(0.95 0.006 255)` | Chữ chính |
| `--card` | `oklch(1 0 0)` | `oklch(0.225 0.014 262)` | Node bảng, thẻ danh sách, thẻ auth |
| `--card-foreground` | `var(--foreground)` | `var(--foreground)` | Chữ trên thẻ |
| `--popover` | `oklch(1 0 0)` | `oklch(0.245 0.015 262)` | Hộp thoại, menu, popover, tooltip nền sáng, toast |
| `--popover-foreground` | `var(--foreground)` | `var(--foreground)` | |
| `--primary` | `oklch(0.55 0.18 259)` | `oklch(0.88 0.07 255)` | Nút chính, link, lựa chọn |
| `--primary-foreground` | `oklch(0.99 0.004 255)` | `oklch(0.22 0.05 262)` | Chữ trên nút chính |
| `--secondary` | `oklch(0.955 0.01 255)` | `oklch(0.28 0.016 262)` | Nút phụ ("Thêm bảng") |
| `--secondary-foreground` | `oklch(0.3 0.04 262)` | `oklch(0.95 0.006 255)` | |
| `--muted` | `oklch(0.965 0.007 255)` | `oklch(0.26 0.014 262)` | Nền nhóm trường, tab list, skeleton |
| `--muted-foreground` | `oklch(0.5 0.025 260)` | `oklch(0.72 0.02 258)` | Chữ phụ, kiểu cột, metadata |
| `--accent` | `oklch(0.945 0.025 258)` | `oklch(0.3 0.03 262)` | Nền hover, mục đang chọn trong danh sách |
| `--accent-foreground` | `oklch(0.36 0.12 262)` | `oklch(0.95 0.006 255)` | Chữ trên nền accent |
| `--destructive` | `oklch(0.54 0.2 27)` | `oklch(0.7 0.17 22)` | Lỗi, xóa, issue |
| `--success` (mới) | `oklch(0.5 0.12 155)` | `oklch(0.74 0.14 155)` | "Đã lưu", "Đã đồng bộ", toast thành công |
| `--warning` (mới) | `oklch(0.54 0.12 60)` | `oklch(0.8 0.13 75)` | "Chưa đồng bộ", phiên hết hạn, toast cảnh báo |
| `--border` | `oklch(0.915 0.01 258)` | `oklch(1 0 0 / 10%)` (giữ) | Trang trí: separator, divider, viền thẻ |
| `--input` | `oklch(0.62 0.02 260)` | `oklch(1 0 0 / 45%)` (giữ) | Ranh giới control |
| `--ring` | `oklch(0.25 0.07 262)` | `oklch(0.56 0.11 258)` | Focus ring |
| `--overlay` (mới) | `oklch(0.24 0.025 262 / 35%)` | `oklch(0 0 0 / 55%)` | Lớp phủ sau hộp thoại |
| `--canvas` (mới) | `oklch(0.97 0.006 255)` | `oklch(0.165 0.012 262)` | Nền canvas |
| `--canvas-dot` (mới) | `oklch(0.82 0.015 258)` | `oklch(0.34 0.015 262)` | Chấm lưới (trang trí) |
| `--canvas-node-border` | `var(--input)` (giữ) | `var(--input)` (giữ) | Viền node bảng |
| `--canvas-node-header-foreground` (mới) | `oklch(0.99 0.004 255)` | `oklch(0.99 0.004 255)` | Tên bảng trên dải màu |
| `--canvas-relation` | `oklch(0.6 0.03 260)` | `oklch(0.6 0.025 260)` | Đường quan hệ mặc định |
| `--canvas-relation-hover` (mới) | `oklch(0.42 0.04 262)` | `oklch(0.82 0.02 258)` | Đường quan hệ khi trỏ chuột |
| `--canvas-relation-selected` | `var(--primary)` (giữ) | `var(--primary)` (giữ) | Đường quan hệ được chọn |
| `--canvas-key` | `oklch(0.62 0.15 65)` | `oklch(0.83 0.15 85)` | Icon khóa chính |
| `--canvas-foreign-key` | `oklch(0.55 0.11 190)` | `oklch(0.78 0.12 185)` | Icon khóa ngoại |

`--sidebar-*` đặt bằng `var()` của token chính tương ứng (`--sidebar: var(--background)`, `--sidebar-primary: var(--primary)`, `--sidebar-ring: var(--ring)`…) để không còn giá trị lệch; `--chart-*` giữ nguyên vì chưa có chỗ dùng.

### Bảng màu dải tiêu đề bảng

Tám màu khác hue, cùng độ sáng, để chữ trắng `--canvas-node-header-foreground` đạt ≥ 4,5:1 trên mọi màu. Dark mode giảm chroma và độ sáng một chút để dải không chói trên nền tối.

| Token | Màu | Light | Dark | Chữ trắng trên dải (light / dark) |
|---|---|---|---|---|
| `--table-accent-1` | Xanh lam | `oklch(0.52 0.16 259)` | `oklch(0.48 0.14 259)` | 5,46 / 6,46 |
| `--table-accent-2` | Xanh mòng két | `oklch(0.5 0.1 200)` | `oklch(0.46 0.09 200)` | 5,44 / 6,51 |
| `--table-accent-3` | Xanh lá | `oklch(0.5 0.12 155)` | `oklch(0.46 0.1 155)` | 5,50 / 6,59 |
| `--table-accent-4` | Vàng đất | `oklch(0.52 0.12 75)` | `oklch(0.48 0.1 75)` | 5,46 / 6,47 |
| `--table-accent-5` | Cam | `oklch(0.54 0.16 40)` | `oklch(0.5 0.14 40)` | 5,28 / 6,21 |
| `--table-accent-6` | Đỏ hồng | `oklch(0.52 0.18 15)` | `oklch(0.48 0.16 15)` | 5,90 / 6,93 |
| `--table-accent-7` | Hồng tím | `oklch(0.52 0.17 340)` | `oklch(0.48 0.15 340)` | 5,89 / 6,92 |
| `--table-accent-8` | Tím | `oklch(0.5 0.17 295)` | `oklch(0.47 0.15 295)` | 6,29 / 7,08 |

### Token code panel

Spec phần 6 đặt biến `--code-*` nhưng chưa có giá trị; spec này chốt giá trị để code panel dùng khi phần 6 làm tới phần frontend.

| Token | Light | Dark | Tương phản trên `--code-background` (light / dark) |
|---|---|---|---|
| `--code-background` | `oklch(0.975 0.005 255)` | `oklch(0.2 0.013 262)` | |
| `--code-foreground` | `oklch(0.28 0.03 262)` | `oklch(0.9 0.01 255)` | 13,59 / 13,44 |
| `--code-token-keyword` | `oklch(0.48 0.19 295)` | `oklch(0.78 0.12 300)` | 6,67 / 8,71 |
| `--code-token-string` | `oklch(0.48 0.12 150)` | `oklch(0.8 0.13 150)` | 5,75 / 10,18 |
| `--code-token-constant` | `oklch(0.5 0.15 40)` | `oklch(0.8 0.12 55)` | 5,98 / 9,40 |
| `--code-token-comment` | `oklch(0.53 0.02 260)` | `oklch(0.66 0.02 260)` | 4,91 / 5,82 |
| `--code-token-function` | `oklch(0.48 0.16 259)` | `oklch(0.78 0.11 250)` | 6,22 / 9,10 |
| `--code-token-parameter` | `oklch(0.47 0.1 200)` | `oklch(0.8 0.09 200)` | 5,87 / 10,03 |
| `--code-token-punctuation` | `oklch(0.45 0.02 260)` | `oklch(0.75 0.015 260)` | 6,92 / 8,14 |
| `--code-token-string-expression` | `var(--code-token-string)` | `var(--code-token-string)` | như trên |
| `--code-token-link` | `var(--code-token-function)` | `var(--code-token-function)` | như trên |

### Bóng

Bóng không mang thông tin (ranh giới vẫn do viền `--input` hoặc `--border` đảm nhận), nên không có yêu cầu tương phản.

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--shadow-sm` | `0 1px 2px oklch(0.24 0.025 262 / 6%)` | `0 1px 2px oklch(0 0 0 / 40%)` | Node bảng lúc nghỉ, thẻ danh sách, nút outline |
| `--shadow-md` | `0 1px 2px oklch(0.24 0.025 262 / 6%), 0 4px 12px oklch(0.24 0.025 262 / 8%)` | `0 2px 8px oklch(0 0 0 / 45%)` | Node khi hover hoặc được chọn, menu, popover, toast |
| `--shadow-lg` | `0 2px 6px oklch(0.24 0.025 262 / 6%), 0 12px 32px oklch(0.24 0.025 262 / 14%)` | `0 16px 40px oklch(0 0 0 / 55%)` | Hộp thoại |

Ba token này được ánh xạ trong `@theme inline` thành `--shadow-sm`, `--shadow-md`, `--shadow-lg` của Tailwind, nên class `shadow-sm`, `shadow-md`, `shadow-lg` đổi theo theme.

### Độ tương phản

Tất cả tỉ lệ trong spec này được tính ngày 2026-10-01 bằng chính `frontend/src/testing/contrast-ratio.ts` (chép sang thư mục tạm, chạy bằng Node 24). Ngưỡng:

- **Chữ:** ≥ 4,5:1 (WCAG 1.4.3); chữ lớn (≥ 18,66 px đậm hoặc ≥ 24 px) ≥ 3:1. Đặt mục tiêu 4,5:1 cho mọi chữ, kể cả chữ lớn, để không phụ thuộc cỡ chữ.
- **Không phải chữ** (ranh giới control, focus ring, viền node, đường quan hệ, icon khóa): ≥ 3:1 (WCAG 1.4.11).
- **Trang trí** (`--border`, `--canvas-dot`, bóng): không yêu cầu.

Tỉ lệ đo được (light / dark), cặp thấp nhất của mỗi nhóm:

| Cặp | Light | Dark |
|---|---|---|
| `--foreground` trên `--muted` | 14,88 | 13,43 |
| `--muted-foreground` trên `--accent` (thấp nhất trong 6 nền) | 5,11 | 5,51 |
| `--primary-foreground` trên `--primary` | 4,83 | 12,05 |
| `--primary` (link) trên `--background` | 4,83 | 12,94 |
| `--destructive` trên `--muted` | 5,07 | 5,38 |
| `--success` trên `--card` | 5,66 | 7,86 |
| `--warning` trên `--popover` | 5,25 | 8,54 |
| `--input` trên `--muted` | 3,29 | 4,29 |
| `--ring` trên `--primary` (nút chính đang focus) | 3,24 | 3,25 |
| `--ring` trên `--muted` | 14,55 | 3,32 |
| `--canvas-node-border` trên `--canvas` | 3,34 | 4,52 |
| `--canvas-relation` trên `--canvas` | 3,62 | 4,88 |
| `--canvas-relation-selected` trên `--canvas` | 4,56 | 13,38 |
| `--canvas-key` trên `--card` | 3,77 | 10,04 |
| `--canvas-foreign-key` trên `--card` | 4,49 | 9,00 |

`--ring` phải đạt 3:1 với cả nền trang lẫn nền nút chính (case `ring` trên `primary` có sẵn trong `globals.test.ts`). Với màu chính xanh lam độ sáng vừa, chỉ ring rất tối (light) hoặc màu chính rất sáng (dark) thỏa cả hai; đó là lý do light ring là xanh đen `oklch(0.25 0.07 262)` và dark primary là xanh nhạt `oklch(0.88 0.07 255)`. Lề an toàn ở dark mode hẹp (3,25 và 3,32), nên plan không được chỉnh `--ring`, `--primary`, `--muted` của dark mà không chạy lại test.

### Mở rộng `globals.test.ts`

- Giữ nguyên mọi case trong `BOUNDARY_CASES` và các test đang có.
- Thêm case 3:1: `canvas-node-border` trên `canvas`; `ring` trên `canvas` và `popover`; `input` trên `popover`; `canvas-relation`, `canvas-relation-hover`, `canvas-relation-selected`, `destructive` trên `canvas`; `canvas-key`, `canvas-foreign-key` trên `card`.
- Thêm nhóm test chữ ngưỡng 4,5:1: `foreground`, `muted-foreground` trên `background`, `card`, `muted`, `popover`, `accent`, `secondary`; các cặp `*-foreground` trên nền của nó; `primary`, `destructive`, `success`, `warning` trên `background`, `card`, `popover`; `canvas-node-header-foreground` trên từng `table-accent-*`; từng `code-*` trên `code-background`. Hằng mới `TEXT_CONTRAST_MINIMUM = 4.5`.
- Đổi chuỗi kiểm tra trong test "paints the table node's own boundary with the canvas-node-border token" theo class mới của `table-node.tsx` (vẫn khẳng định viền ngoài là `border-canvas-node-border`, xem [mục 4](#4-node-bảng)).
- Thêm test chặn màu dải tiêu đề hardcode: `table-node.tsx` chỉ lấy màu qua `var(--table-accent-N)`.

## 3. Chữ, khoảng cách, bo góc, bóng

### Font

| Ứng viên (giao diện) | Đánh giá |
|---|---|
| **Plus Jakarta Sans** (chọn) | Hình chữ mềm, tròn, hợp hướng "thân thiện" của dbdiagram, drawSQL; có subset `vietnamese`; variable font nên một file mỗi subset; chiều rộng vừa, đọc tốt ở 12 px trong node |
| Inter | Đọc tốt nhưng là font mặc định của rất nhiều ứng dụng, không tạo được nhận diện |
| Geist | Font mặc định của template Next.js, cảm giác kỹ thuật lạnh hơn hướng đã chọn |
| Be Vietnam Pro | Thiết kế cho tiếng Việt nhưng rộng, tên cột dài bị cắt sớm trong node rộng tối đa 320 px |
| IBM Plex Sans | Kỹ thuật, hơi cứng; có trục `wdth` nhưng không cần |

| Ứng viên (mono) | Đánh giá |
|---|---|
| **JetBrains Mono** (chọn) | Phân biệt rõ `0`/`O`, `1`/`l`; có subset `vietnamese` (comment tiếng Việt trong code sinh ra); variable font |
| Geist Mono, IBM Plex Mono | Đọc tốt như nhau; chọn JetBrains Mono vì chữ cao hơn ở cỡ 12 px, hợp cột kiểu dữ liệu |
| Fira Code | Không có subset `vietnamese` |

Nạp trong `frontend/src/app/fonts.ts` (mới) bằng `next/font/google` với `subsets: ["latin", "latin-ext", "vietnamese"]`, `display: "swap"`, `variable: "--font-plus-jakarta-sans"` và `"--font-jetbrains-mono"`; `layout.tsx` gắn hai `className` biến lên `<html>`. `@theme inline` khai báo `--font-sans: var(--font-plus-jakarta-sans), ui-sans-serif, system-ui, sans-serif` và `--font-mono: var(--font-jetbrains-mono), ui-monospace, monospace`; tên biến của `next/font` khác tên biến của Tailwind để không tự tham chiếu. `next/font` tải font lúc build và phục vụ từ chính origin, nên CSP `font-src 'self'` không đổi và trình duyệt không gọi Google Fonts.

### Thang chữ

Giữ thang mặc định của Tailwind; chỉ chốt chỗ dùng:

| Vai trò | Class | Cỡ / dòng | Độ đậm |
|---|---|---|---|
| Tiêu đề trang (danh sách, auth) | `text-2xl` | 24 / 32 px | 700 |
| Tiêu đề mục, hộp thoại | `text-lg` | 18 / 28 px | 600 |
| Chữ giao diện mặc định | `text-sm` | 14 / 20 px | 400, nhãn 500 |
| Tên bảng trên dải tiêu đề | `text-[0.8125rem]` | 13 / 20 px | 600 |
| Dòng cột, nhãn phụ, chip | `text-xs` | 12 / 16 px | 400; tên cột khóa chính 600 |
| Nhãn nhóm trong panel ("Cột", "Index") | `text-xs uppercase tracking-wide` | 12 / 16 px | 600, màu `--muted-foreground` |
| Kiểu cột, code | `font-mono text-xs` | 12 / 16 px | 400 |

Chữ số trong metadata (thời gian cập nhật, số cột, vị trí X, Y) dùng `tabular-nums`.

### Khoảng cách

Thang 4 px của Tailwind, không thêm giá trị lẻ ngoài các số dưới đây:

| Chỗ | Giá trị |
|---|---|
| Toolbar | cao 48 px (`h-12`, giữ), đệm ngang 8 px, khoảng giữa nút 4 px, separator cao 20 px cách 6 px mỗi bên |
| Panel trái, phải | đệm 16 px; khoảng giữa nhóm 20 px; giữa trường 12 px |
| Node bảng | dải tiêu đề cao 36 px, đệm ngang 12 px; dòng cột cao 28 px, đệm ngang 12 px; khoảng giữa dấu, tên, kiểu 8 px |
| Thẻ danh sách schema | đệm 16 px, khoảng giữa thẻ 8 px |
| Thẻ auth | đệm 24 px (32 px từ `sm`), rộng tối đa 400 px |
| Hộp thoại | đệm 24 px, khoảng giữa phần 16 px |

### Bo góc

`--radius` đổi từ `0.625rem` (10 px) thành `0.5rem` (8 px); các hệ số `--radius-sm` … `--radius-4xl` trong `@theme inline` giữ nguyên công thức. Kết quả: nút, ô nhập `rounded-md` ≈ 6 px; node bảng, thẻ `rounded-lg` 8 px; hộp thoại `rounded-xl` ≈ 11 px; chip `rounded-sm` ≈ 5 px. Góc nhỏ hơn hợp với giao diện dày thông tin.

### Bóng và độ nổi

Bốn tầng: phẳng (panel, toolbar, chỉ có viền), `shadow-sm` (node, thẻ), `shadow-md` (node hover hoặc được chọn, menu, popover, toast), `shadow-lg` (hộp thoại). Không dùng bóng màu.

### Icon

`lucide-react`, nét mặc định 2 px. Cỡ: 16 px trên nút toolbar và nút giao diện, 14 px trong dòng danh sách và dải tiêu đề, 14 px cho icon khóa trong dòng cột (tăng từ 12 px). Icon chỉ trang trí luôn `aria-hidden`; icon mang nghĩa có text ẩn hoặc `aria-label` như hiện tại.

### Chuyển động

Chỉ chuyển màu nền, màu viền, bóng: `transition-[color,background-color,border-color,box-shadow] duration-150`. Không chuyển `transform` khi hover node (kéo node đã đổi vị trí). Bỏ `active:translate-y-px` của nút vì làm nhãn rung khi bấm nhanh trên toolbar. Mọi chuyển động bọc trong `motion-safe:` hoặc bị tắt bởi `prefers-reduced-motion` (khối `@media (prefers-reduced-motion: reduce)` sẵn có trong `globals.css` mở rộng để đặt `transition-duration: 0s` cho `*`).

## 4. Node bảng

### Màu dải tiêu đề

Core không có trường màu cho bảng (xem [Quyết định đã có từ trước](#quyết-định-đã-có-từ-trước)), và spec này không đổi core model. Ba cách lấy màu:

| Cách | Ưu | Nhược |
|---|---|---|
| **Băm `table.id` (chọn)** | Ổn định qua tải lại, qua thiết bị, qua cloud; không lưu gì; hàm thuần dễ test | Hai bảng cạnh nhau có thể trùng màu (xác suất 1/8 mỗi cặp); người dùng không chọn được |
| Theo thứ tự bảng (`index % 8`) | Bảng liền kề trong danh sách khác màu | Xóa hoặc sắp lại một bảng làm đổi màu cả loạt bảng phía sau |
| Lưu màu trong view state ở frontend (IndexedDB) | Người dùng chọn được | Không theo schema lên cloud, khác máy khác màu; là nửa vời của trường màu trong core |

Hàm thuần mới `getTableAccent(tableId: TableId): TableAccentIndex` ở `frontend/src/features/editor/lib/table-accent.ts`:

```ts
// Sketch: FNV-1a 32-bit over the id's UTF-16 code units, then modulo 8.
export const TABLE_ACCENT_COUNT = 8;
export type TableAccentIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export function getTableAccent(tableId: TableId): TableAccentIndex;
export function getTableAccentColor(tableId: TableId): string; // "var(--table-accent-3)"
```

Màu dải tiêu đề là trang trí (giúp nhận ra bảng bằng mắt), không mang thông tin; tên bảng vẫn là chữ, nên không vi phạm 1.4.1. Người dùng tự chọn màu cho từng bảng là [câu hỏi mở 1](#câu-hỏi-đã-trả-lời) ⚠.

### Bố cục

```text
╭──────────────────────────────────╮  viền 1 px --canvas-node-border, rounded-lg, shadow-sm
│▓▓ users                    💬 ⚠2 ▓│  dải 36 px, nền var(--table-accent-N), chữ --canvas-node-header-foreground
├──────────────────────────────────┤
│ 🔑  id            bigint      AI │  dòng 28 px
│ 🔗  team_id       bigint         │
│     email         varchar(255) U │
│     nickname      text?          │  "?" là chip nhỏ sau kiểu
╰──────────────────────────────────╯
```

- **Thẻ:** `min-w-56 max-w-80 rounded-lg border border-canvas-node-border bg-card shadow-sm`, `overflow-hidden` để dải tiêu đề theo góc bo. Rộng tối thiểu tăng 192 → 224 px để kiểu cột không sát tên cột.
- **Dải tiêu đề:** nền `var(--table-accent-N)` gán qua `style={{ backgroundColor: getTableAccentColor(table.id) }}` (style inline được CSP cho phép); chữ `--canvas-node-header-foreground` 13 px đậm 600; icon comment và huy hiệu issue nằm trên dải với cùng màu chữ trắng. Huy hiệu issue thành chip: nền `--card`, chữ `--destructive`, icon cảnh báo, số (giữ `role="img"` và `aria-label` hiện có). Không có đường kẻ giữa dải và dòng cột: màu dải đã ngăn.
- **Dòng cột:** lưới ba cột cố định `grid-cols-[1.25rem_minmax(0,1fr)_auto]`: ô dấu khóa 20 px, tên cột (cắt "…", tooltip giữ nguyên), cụm phải gồm kiểu cột `font-mono text-muted-foreground` và chip. Không tô sọc chẵn lẻ (dễ nhầm với dòng được tô sáng) và không kẻ đường giữa các dòng; chiều cao 28 px đủ tách dòng, giống dbdiagram.
- **Cột khóa chính:** icon `KeyRoundIcon` 14 px màu `--canvas-key`, tên cột đậm 600; khóa nhiều cột hiện số thứ tự màu `--foreground` cạnh icon như hiện tại.
- **Cột khóa ngoại:** icon `Link2Icon` 14 px màu `--canvas-foreign-key`. Cột vừa là khóa chính vừa là khóa ngoại hiện cả hai icon, ô dấu nới thành 36 px (giữ `w-9` hiện có cho trường hợp này).
- **`U`, `AI`, `?`:** giữ nguyên ký tự và text ẩn (`NotationMark`), đổi hình thức thành chip `rounded-sm bg-muted px-1 text-[0.625rem] font-medium text-muted-foreground` với `?` dính sau kiểu cột (không chip) như ký hiệu kiểu nullable của TypeScript. Không đổi ký tự vì test và text ẩn đang dựa vào chúng, và ký tự là ký hiệu chung cho mọi ngôn ngữ.
- **Icon comment, dấu issue** trong dòng: giữ, 14 px.

### Trạng thái

| Trạng thái | Hình thức |
|---|---|
| Nghỉ | Viền `--canvas-node-border`, `shadow-sm` |
| Hover | `shadow-md`; viền không đổi (tránh nhầm với chọn) |
| Được chọn | Viền đổi thành `--primary`, thêm `ring-1 ring-primary` để viền thành 2 px; `shadow-md` |
| Focus bàn phím | Giữ cơ chế hiện có (`.react-flow__node:focus-visible` outline 2 px `--ring`, `outline-offset: 2px`) và bỏ `in-focus-visible:ring-2 in-focus-visible:ring-foreground` trùng lặp trong `table-node.tsx`; focus và chọn cùng lúc hiện cả viền xanh lẫn vòng ngoài |
| Dòng cột được tô sáng (khi chọn hoặc hover quan hệ, spec phần 3 mục 3) | Nền `--accent`, chữ tên cột `--accent-foreground` |

### Điểm nối (handle)

Handle mặc định của React Flow là chấm 6 px khó trúng. Đổi bằng CSS trong `globals.css` (lớp `.react-flow__handle` trong phạm vi node bảng): chấm tròn 10 px, nền `--card`, viền 2 px `--canvas-relation`; ẩn (`opacity: 0`) khi node không hover, không được chọn và không đang kéo nối; hiện khi hover node, khi node được chọn hoặc khi đang có kết nối. Vùng bấm thật của handle vẫn là kích thước React Flow tính, nằm trên cạnh dòng; tạo quan hệ vẫn có đường thay thế không kéo là nút "Thêm quan hệ" trong panel (spec phần 3, mục 12), nên kích thước handle không phải mục tiêu bấm duy nhất của chức năng này (ngoại lệ của 2.5.8).

## 5. Đường quan hệ

### Hình đường ⚠

| Cách | Ưu | Nhược |
|---|---|---|
| **`getSmoothStepPath` (đề xuất)** | Đường vuông góc bo góc như dbdiagram, drawSQL; ít cắt chéo trên sơ đồ ER; có sẵn trong `@xyflow/react` 12.11.6 | Đường có thể chồng lên nhau khi nhiều quan hệ đi cùng hướng; nhãn nằm ở đoạn giữa |
| `getBezierPath` (hiện tại) | Mềm, không chồng đoạn thẳng | Nhiều đường cong cắt chéo, khó lần theo |
| `getStraightPath` | Đơn giản nhất | Cắt qua node khi bảng không thẳng hàng |

Tham số: `borderRadius: 8`, `offset: 16` (đoạn ra khỏi handle đủ dài để ký hiệu chân gà nằm trên đoạn thẳng). Vì đổi hình đường là thay đổi nhìn thấy được lớn nhất trên canvas, người dùng xác nhận ở [câu hỏi mở 2](#câu-hỏi-đã-trả-lời); mockup vẽ theo đề xuất.

### Màu, nét, ký hiệu

| Trạng thái | Nét | Màu | Ký hiệu |
|---|---|---|---|
| Mặc định | 1,5 px | `--canvas-relation` | Biến thể `default` |
| Hover (mới) | 2 px | `--canvas-relation-hover` | Biến thể `hover` (mới) |
| Được chọn | 2,5 px | `--canvas-relation-selected` | Biến thể `selected` |
| Có issue | 1,5 px (2,5 px khi chọn), nét đứt `6 4` | `--destructive` | Biến thể `issue` |
| Focus bàn phím | giữ `in-focus-visible:stroke-4!` | | |

- `RelationMarkerVariant` thêm `"hover"`; `RelationMarkers` sinh thêm hai marker. Nét ký hiệu tăng 1,5 → 2 px, `MARKER_SIZE` giữ 12 nhưng viewBox vẽ lại để chân gà rộng hơn (đường `many` mở 0 → 12 px theo chiều dọc như hiện tại); hình dạng không đổi nên ý nghĩa ký hiệu không đổi.
- Hover lấy từ `:hover` CSS trên `.react-flow__edge` (class `group` cho path và nhãn), không thêm state React, nên không render lại edge khi trỏ chuột. Marker không đổi màu theo CSS được vì nằm trong `<defs>`; khi hover, edge dùng `marker-start`, `marker-end` trỏ tới biến thể `hover` bằng CSS (`.react-flow__edge:hover .relation-edge-path { marker-start: url(#relation-marker-many-hover) }`), plan chốt cách viết selector.
- **Nhãn giữa đường** (`1-n`, `1-1`, `N cột`): chip `rounded-full border border-border bg-card px-1.5 text-[0.625rem] font-medium text-muted-foreground shadow-sm`; khi edge được chọn, chip đổi viền `--primary`, chữ `--foreground`.

## 6. Canvas, minimap, điều khiển

- **Nền:** `--xy-background-color: var(--canvas)`; `<Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />`, `--xy-background-pattern-dots-color: var(--canvas-dot)`. Lưới chấm là trang trí. Canvas tối hơn khung ứng dụng một chút ở cả hai theme (light 0,97 so với 0,99; dark 0,165 so với 0,185), nên ranh giới vùng vẽ thấy được mà không cần viền.
- **Biến React Flow khác** trong khối `.react-flow` của `globals.css`: `--xy-node-boxshadow-selected` giữ `0 0 0 2px var(--ring)` (test đang khẳng định chuỗi này); `--xy-edge-stroke: var(--canvas-relation)`; `--xy-selection-background-color` 8% `--primary` như hiện tại; `--xy-connectionline-stroke: var(--canvas-relation-selected)`; `--xy-minimap-background-color: var(--card)`; `--xy-minimap-mask-background-color` 60% `--canvas`.
- **Minimap:** góc dưới phải, `rounded-lg border border-border shadow-md overflow-hidden`; node tô bằng màu dải tiêu đề qua `nodeColor={(node) => getTableAccentColor(node.data.tableId)}`, `nodeBorderRadius={2}`. Giữ `pannable`, `zoomable`. Vị trí và kích thước không đổi nên quy tắc "phần tử focus không bị minimap che" của phần 3 vẫn đúng.
- **Điều khiển zoom, fit view:** vẫn nằm trên toolbar của ứng dụng (spec phần 3, mục 10), không thêm `<Controls>` của React Flow.
- **Trạng thái trống** (`canvas-empty-state.tsx`): thẻ `rounded-xl border-dashed border-input bg-card/90 shadow-sm` với icon `Table2Icon` 32 px màu `--muted-foreground`, tiêu đề `text-base font-semibold`, nút "Thêm bảng" biến thể `default`.

## 7. Toolbar

- Nền `--background`, viền dưới `--border`, cao 48 px. Bố cục và thứ tự giữ nguyên.
- Nhóm nút ngăn bằng `Separator` cao 20 px. Nút icon `ghost`, `size="icon"` (32 px, giữ ≥ 24 px); hover nền `--accent`, chữ `--accent-foreground`.
- **Tên schema:** chữ `text-sm font-semibold`, hover nền `--accent`; giữ hành vi mở hộp thoại đổi tên.
- **Thêm bảng, Thêm enum:** "Thêm bảng" dùng biến thể `secondary` (hành động chính của editor), "Thêm enum" giữ `ghost`; cả hai có icon `PlusIcon`.
- **Nút số issue:** khi có issue, chip `bg-destructive/10 text-destructive` (chữ `--destructive` trên nền pha 10% vẫn ≥ 4,5:1, plan đo lại trên nền đã phủ); khi không có, chữ `--muted-foreground`.
- **Trạng thái lưu, cloud** (`save-status-badge.tsx`, `cloud-status-badge.tsx`): pill `rounded-full px-2 py-0.5 text-xs font-medium` với chấm tròn 6 px màu ngữ nghĩa và chữ; màu: đã lưu, đã đồng bộ `--success`; đang lưu, đang đồng bộ `--muted-foreground`; chưa đồng bộ, offline `--warning`; lỗi `--destructive`. Luôn có chữ hoặc icon, không chỉ chấm màu (1.4.1). Text `role="status"` ẩn giữ nguyên.
- **Nút active:** nút mở menu (`aria-expanded`) nền `--accent`.

## 8. Panel trái, panel thuộc tính

- **Khung:** nền `--background`, viền `--border` phía giáp canvas. Panel trái rộng 288 px, panel phải 320 px (giữ).
- **Tab** (`components/ui/tabs.tsx`): giữ biến thể mặc định (nền `--muted`, tab đang chọn nền `--card` `shadow-sm`), cao 32 px.
- **Danh sách bảng** (`table-list-tab.tsx`): mỗi dòng có chấm vuông bo 8 px màu `getTableAccentColor` (`aria-hidden`) trước tên bảng, số cột bên phải `tabular-nums`. Dòng đang chọn (`aria-current`) nền `--accent`, chữ `--accent-foreground`. Focus giữ `ring-3 ring-ring`.
- **Panel thuộc tính bảng** (`table-panel.tsx`): đầu panel là tên bảng kèm vạch màu 4 px bên trái lấy từ `getTableAccentColor` để nối panel với node; nhãn nhóm ("Cột", "Index") theo kiểu nhãn nhóm ở [mục 3](#3-chữ-khoảng-cách-bo-góc-bóng). Mỗi cột (`column-item.tsx`) là `fieldset` `rounded-lg border border-border bg-card p-3`; hàng checkbox dùng khoảng 16 px.
- **Panel quan hệ, nhiều lựa chọn, enum, issue:** cùng quy tắc nhóm, nhãn, khoảng cách. Dòng issue có icon cảnh báo `--destructive` và link "Đi tới" dạng nút `link`.
- **Ô nhập** (`input.tsx`, `textarea.tsx`, `select.tsx`): cao 32 px, viền `--input`, nền `--card` ở light và `input/30` như hiện tại ở dark; focus `border-ring ring-3 ring-ring/…` không đổi cơ chế, chỉ đổi màu theo token (không dùng opacity cho ring vì test chặn).

## 9. Code panel

Code panel chưa có trong code (phần 6 mới xong plan cho core). Spec này chỉ chốt giao diện để phần 6 dùng:

- Khung `rounded-lg border border-border bg-[var(--code-background)]`, chữ `font-mono text-xs leading-5`, màu token Shiki theo bảng ở [mục 2](#token-code-panel).
- Số dòng `--muted-foreground`, `select-none`, cột rộng theo số chữ số.
- Thanh trên (chọn đích, option, nút copy) dùng nút `ghost` và `Select` như toolbar.
- Danh sách diagnostic: icon `TriangleAlertIcon` `--warning`, chữ `--foreground`.

## 10. Danh sách schema

- **Header:** nền `--background`, viền dưới `--border`, cao 56 px; trái là dấu nhận diện (ô 28 px `rounded-md bg-primary text-primary-foreground` chứa `DatabaseIcon` 16 px) cộng chữ `SchemaForge` `font-bold`; phải giữ `AccountMenu`, `ThemeSwitch`, `LanguageSwitch`.
- **Vùng nội dung:** rộng tối đa 768 px (giữ `max-w-3xl`), tiêu đề `text-2xl font-bold`, nút "Tạo schema" biến thể `default` (màu chính) với `PlusIcon`.
- **Dòng schema** (`schema-list-row.tsx`): giữ dạng danh sách. Mỗi dòng là thẻ `rounded-lg border border-border bg-card p-4 shadow-sm`, hover `border-input`. Trái là ô icon 36 px `rounded-md`, nền `--muted`, icon `CloudIcon` (schema có bản cloud) hoặc `HardDriveIcon` (chỉ local) màu `--muted-foreground`, `aria-hidden` (trạng thái đã có trong `SchemaStatusLabel` bằng chữ). Giữa là tên schema (link) và metadata. Phải là nút menu `EllipsisIcon` (32 px).
- **Link tên schema:** chữ `--foreground` `font-semibold`, không gạch chân lúc nghỉ, gạch chân khi hover; focus outline 2 px `--ring`. Link không nằm trong đoạn văn bản nên bỏ gạch chân không vi phạm 1.4.1.
- **`SchemaStatusLabel`:** pill `rounded-full px-2 text-xs font-medium`; cần chú ý dùng nền `bg-warning/10` hoặc `bg-destructive/10` với chữ màu tương ứng (đo lại 4,5:1 trên nền đã phủ); bình thường viền `--border`, chữ `--muted-foreground`.
- **Banner** (`cloud-list-banner.tsx`, `session-expired-banner.tsx`) và lời mời đăng nhập (`sign-in-invite.tsx`): thẻ `rounded-lg border p-3` với icon ngữ nghĩa bên trái; banner lỗi viền `--destructive`, banner cảnh báo viền `--warning`, lời mời viền `--border` nền `--muted`.
- **Trạng thái trống:** thẻ viền nét đứt `border-dashed border-input`, icon `DatabaseIcon` 32 px, chữ "Chưa có schema nào", nút "Tạo schema đầu tiên". Chuỗi đã có trong namespace `schema-list`.
- **Skeleton:** cao 76 px (bằng thẻ thật) để không nhảy bố cục.

## 11. Đăng nhập, đăng ký

- Nền trang `--canvas` với lưới chấm `--canvas-dot` vẽ bằng CSS `radial-gradient` (cùng nhịp 20 px như canvas), để trang auth cùng ngôn ngữ hình ảnh với editor. Trang căn giữa theo chiều dọc từ `sm` (`min-h-dvh grid place-items-center`), ở điện thoại form nằm sát trên với đệm 16 px.
- Phía trên thẻ là dấu nhận diện như header danh sách.
- **Thẻ form:** `w-full max-w-[400px] rounded-xl border border-border bg-card p-6 sm:p-8 shadow-md`; tiêu đề `h1` `text-2xl font-bold`; form giữ nguyên trường, nhãn, `autocomplete`, nút hiện mật khẩu (`size-8`, test target size giữ). Nút gửi rộng hết thẻ, biến thể `default`, cao 36 px (`size="lg"`).
- Dòng "Chưa có chức năng khôi phục mật khẩu" và link sang trang kia nằm dưới form trong thẻ, ngăn bằng `Separator`. Link giữ gạch chân (nằm trong câu).
- Lỗi trường: chữ `--destructive` `text-sm` kèm icon `CircleAlertIcon` 14 px `aria-hidden` (icon thêm dấu hiệu không chỉ dựa màu).

## 12. Hộp thoại, menu, popover, tooltip, toast

- **Hộp thoại** (`dialog.tsx`, `alert-dialog.tsx`): lớp phủ `bg-[var(--overlay)]`, giữ `backdrop-blur-xs`; nội dung `rounded-xl border border-border bg-popover p-6 shadow-lg`, bỏ `ring-1 ring-foreground/10`; tiêu đề `text-lg font-semibold`; footer nút căn phải, nút hủy `outline`, nút xác nhận `default` hoặc `destructive`. Nút xóa trong `alert-dialog` giữ biến thể `destructive` dạng tô nhạt hiện có (`bg-destructive/10 text-destructive`), không thêm biến thể nền đặc, để không phát sinh cặp màu chữ trên nền đỏ chưa đo.
- **Menu, popover, combobox** (`dropdown-menu.tsx`, `popover.tsx`, `command.tsx`, `select.tsx`): `rounded-lg border border-border bg-popover p-1 shadow-md`; mục cao 32 px, hover và mục đang trỏ (`data-highlighted`) nền `--accent`; mục nguy hiểm chữ `--destructive`; separator `--border`.
- **Tooltip** (`tooltip.tsx`): giữ nền `--foreground`, chữ `--background` (đảo màu), `rounded-md text-xs`, cùng mũi tên.
- **Toast** (`components/ui/sonner.tsx`, khối `.toaster[...]` trong `globals.css`): `--normal-bg: var(--popover)`, `--normal-border: var(--border)`, `--border-radius: var(--radius-lg)`, thêm `toastOptions={{ classNames: { toast: "shadow-md font-sans" } }}`; icon theo loại mang màu: thành công `text-success`, cảnh báo `text-warning`, lỗi `text-destructive`, thông tin `text-primary`. Vị trí `bottom-center` giữ nguyên.

## 13. Accessibility

- **Không đổi hành vi:** accessible name, role, thứ tự focus, phím tắt, `aria-*` giữ nguyên. Mọi test component hiện có (query theo role, label, text) phải xanh mà không sửa assertion, trừ test đọc class ở [mục 2](#mở-rộng-globalstestts).
- **Focus thấy được (2.4.7, 2.4.11):** mọi control dùng `--ring` ở opacity đầy đủ; node và edge giữ outline 2 px cách 2 px. Minimap, toast, toolbar giữ vị trí nên không che phần tử đang focus nhiều hơn hiện tại.
- **Mục tiêu bấm (2.5.8):** nút icon 32 px, mục menu 32 px, nút xs 24 px giữ nguyên; edge giữ `interactionWidth` 24 px. Test `size-6`…`size-10` của nút hiện mật khẩu giữ.
- **Không chỉ dựa màu (1.4.1):** khóa chính, khóa ngoại vẫn có icon khác hình và text ẩn; trạng thái lưu, cloud có chữ; edge có issue vẫn nét đứt; màu dải tiêu đề chỉ trang trí; nhãn trạng thái schema có chữ.
- **Tương phản (1.4.3, 1.4.11):** theo [mục 2](#độ-tương-phản), có test tự động ở tầng token. Chữ đặt trên nền pha (`bg-destructive/10`, `bg-warning/10`, chip trên dải màu) đo tay trên Chrome DevTools ở cả hai theme.
- **Giảm chuyển động (2.3.3 khuyến nghị, tôn trọng `prefers-reduced-motion`):** theo [mục 3](#chuyển-động).
- **Phóng chữ 200% và reflow 320 px (1.4.4, 1.4.10):** danh sách schema và trang auth không cuộn ngang ở 320 px; editor là ngoại lệ hai chiều của 1.4.10 (canvas), như phần 3.

## 14. Hiệu năng

- Font: hai variable font, mỗi font ba subset; `next/font` chỉ preload subset `latin` và đặt `size-adjust` cho font dự phòng nên không nhảy bố cục khi font tải xong. Plan đo tổng dung lượng font tải ở trang đầu và ghi vào báo cáo task.
- Node bảng: `getTableAccent` là hàm thuần, gọi trong render với chi phí băm một chuỗi ngắn; không thêm selector Zustand nào, nên điều kiện "sửa một cột chỉ render lại đúng dòng cột đó" của phần 3 vẫn giữ (test hiện có).
- Hover edge bằng CSS, không qua state React.
- `shadow-md` khi hover trên 100 node có thể tốn khi kéo; bóng chỉ đổi theo `:hover` của một node, không áp cho node đang kéo (`.react-flow__node.dragging` giữ `shadow-sm`). Kiểm tra tay ngưỡng "kéo bảng ≥ 30 fps khi CPU chậm 4×" của phần 3.

## 15. i18n

Không thêm và không đổi chuỗi nào: dấu nhận diện dùng `APP_NAME` (`frontend/src/lib/app-name.ts`), mọi icon mới là `aria-hidden` cạnh chữ đã có. Nếu plan phát hiện cần chuỗi mới (ví dụ `aria-label` cho một icon không có chữ đi kèm), chuỗi đó vào namespace của component đang dùng (`common`, `canvas`, `editor`, `schema-list`, `auth`) với đủ `vi` và `en`, và báo trong báo cáo task.

## 16. Test

- **Tầng token** (`frontend/src/app/globals.test.ts`): mở rộng như [mục 2](#mở-rộng-globalstestts). Test đọc khối `:root` và `.dark` nên token mới phải nằm trong hai khối này, không nằm trong `@theme`.
- **Unit** `frontend/src/features/editor/lib/table-accent.test.ts`: `returns the same accent for the same table id`, `returns an accent between 1 and 8`, `spreads 1000 generated table ids over all 8 accents`, `formats the accent as a css variable reference`.
- **Component:** test hiện có của `table-node`, `column-row`, `relation-edge`, `editor-toolbar`, `schema-list-*`, `sign-in-screen`, `credentials-form` và dialog phải xanh không sửa. Thêm: `paints the table header with the accent of its table id` (đọc `style` của dải tiêu đề), `renders a hover marker variant for every marker shape`, `colors minimap nodes with the table accent`.
- **axe-core** trong các test component hiện có tiếp tục không có vi phạm.
- **Kiểm tra tay** (Chrome, light và dark, `vi` và `en`): so với mockup; tương phản chữ trên nền pha; focus thấy được trên mọi control; reduced motion; 320 px cho danh sách và auth; hiệu năng kéo bảng.

## 17. Gợi ý chia task cho plan

Ba nhóm sở hữu file rời nhau; nhóm (a) chạy trước vì định nghĩa token mà (b), (c) dùng, sau đó (b) và (c) chạy song song.

| Nhóm | Nội dung | File sở hữu |
|---|---|---|
| (a) Token, font, component chung | Token mới trong `:root` và `.dark`, `@theme inline` (màu, bóng, font, `--radius`), khối `.react-flow` và `.toaster`, reduced motion; font; mở rộng test tương phản; restyle `components/ui` | `frontend/src/app/globals.css`, `frontend/src/app/globals.test.ts`, `frontend/src/app/layout.tsx`, `frontend/src/app/fonts.ts` (mới), `frontend/src/components/ui/*.tsx` |
| (b) Canvas và editor | Màu bảng, node, dòng cột, edge, marker, canvas, minimap, empty state, toolbar, panel trái, panel thuộc tính, dialog trong editor | `frontend/src/features/editor/lib/table-accent.ts` (mới) và test, `frontend/src/features/editor/components/canvas/*`, `frontend/src/features/editor/components/toolbar/*`, `frontend/src/features/editor/components/panels/**`, `frontend/src/features/editor/components/dialogs/*`, `frontend/src/features/editor/components/editor-workspace.tsx`, `editor-skeleton.tsx`, `editor-status-screen.tsx`, `skip-to-panel-link.tsx` |
| (c) Danh sách, auth, component dùng chung của app | Header, dòng, nhãn trạng thái, banner, trạng thái trống; trang auth; menu tài khoản, nút theme, ngôn ngữ, hộp thoại dùng chung | `frontend/src/features/schema-list/components/*`, `frontend/src/features/auth/components/*`, `frontend/src/components/account-menu.tsx`, `theme-switch.tsx`, `language-switch.tsx`, `sign-in-prompt.tsx`, `sign-out-dialog.tsx`, `upload-schemas-dialog.tsx`, `frontend/src/app/not-found.tsx` |

Test của `globals.test.ts` đọc chuỗi class trong `table-node.tsx`: task (a) không đổi assertion đó; task (b) đổi class của node và đổi assertion cùng lúc (plan giao riêng dòng test đó cho (b), hoặc (a) viết assertion theo class mới đã chốt ở [mục 4](#4-node-bảng)). Plan chốt một cách và ghi ở bảng điểm nóng.

## Cấu trúc thư mục

```text
frontend/src/
  app/
    fonts.ts                         mới: Plus Jakarta Sans, JetBrains Mono qua next/font/google
    layout.tsx                       sửa: gắn class biến font lên <html>
    globals.css                      sửa: token :root, .dark; @theme inline; .react-flow; .toaster; handle; reduced motion
    globals.test.ts                  sửa: thêm case 3:1, nhóm 4,5:1, chuỗi class node
    not-found.tsx                    sửa: kiểu chữ, khoảng cách
  components/
    ui/*.tsx                         sửa: button, input, textarea, select, dialog, alert-dialog, dropdown-menu, popover, command, tabs, tooltip, sonner, skeleton, checkbox, radio-group
    account-menu.tsx, theme-switch.tsx, language-switch.tsx,
    sign-in-prompt.tsx, sign-out-dialog.tsx, upload-schemas-dialog.tsx   sửa: class
  features/editor/
    lib/table-accent.ts              mới: getTableAccent, getTableAccentColor
    lib/table-accent.test.ts         mới
    components/canvas/*              sửa: table-node, column-row, relation-edge, relation-markers, editor-canvas, canvas-empty-state
    components/toolbar/*             sửa: class, pill trạng thái
    components/panels/**             sửa: class, chấm màu bảng, vạch màu đầu panel
    components/dialogs/*             sửa: class
  features/schema-list/components/*  sửa: header, dòng, nhãn, banner, trạng thái trống
  features/auth/components/*         sửa: thẻ form, nền, dấu nhận diện
```

Không có file nào trong `packages/`, `backend/` bị đổi.

## Vấn đề với các spec đã duyệt

| # | Spec, mục | Hiện ghi | Thay đổi do spec này |
|---|---|---|---|
| 1 | Spec phần 3, mục 3 "Edge quan hệ" | Edge không nói hình đường; code dùng `getBezierPath` | ⚠ Đổi sang `getSmoothStepPath` nếu người dùng đồng ý ở câu hỏi mở 2; ký hiệu, nhãn, cách chọn cạnh handle không đổi |
| 2 | Spec phần 3, mục 8 "Theme", mục "Token" | Token shadcn/ui mặc định, màu chính trung tính | Bộ token ở [mục 2](#2-token-màu); cơ chế cookie, class `.dark`, script không đổi |
| 3 | Spec phần 3, mục 3 "Node bảng", bảng đánh dấu cột | `U`, `?`, `AI` là chữ | Giữ ký tự và text ẩn, chỉ đổi hình thức thành chip; icon khóa 12 → 14 px |
| 4 | Spec phần 6, mục code panel | Biến `--code-*` trỏ về token shadcn/ui, chưa có giá trị | Giá trị cụ thể ở [mục 2](#token-code-panel); phần 6 dùng các giá trị này khi làm frontend |
| 5 | `architecture.md`, hàng "Token viền và focus ring" | Ghi giá trị light `--border: oklch(0.922 0 0)`, `--input: oklch(0.62 0 0)`, `--ring: oklch(0.55 0 0)`, dark `--ring: oklch(0.556 0 0)` | Giá trị mới ở mục 2 (`--input` light giữ độ sáng 0,62, thêm sắc độ); nguyên tắc tách token giữ. Cập nhật hàng này khi spec được duyệt |
| 6 | `architecture.md`, hàng "UI kit, styling" | Không nói font | Thêm font Plus Jakarta Sans, JetBrains Mono qua `next/font/google`; ghi ở "Chưa chốt" trong lúc spec chờ duyệt |

## Rủi ro cần kiểm tra khi triển khai

- **Lề tương phản hẹp ở dark mode:** `--ring` trên `--primary` 3,25 và trên `--muted` 3,32. Chỉnh bất kỳ token nào trong ba token này phải chạy lại `globals.test.ts`.
- **Chữ trên nền pha** (`bg-destructive/10`, `bg-warning/10`, `bg-accent`) chưa có test tự động; nếu dưới 4,5:1 thì tăng độ đậm chữ hoặc bỏ nền pha.
- **Marker hover bằng CSS:** đặt `marker-start`, `marker-end` qua CSS ghi đè thuộc tính SVG; cần thử trên Chrome, Firefox, Safari. Nếu một trình duyệt không áp, bỏ biến thể marker hover và chỉ đổi màu nét.
- **`getSmoothStepPath` với quan hệ tự tham chiếu** (cả hai đầu ở cạnh phải): đường vòng có thể chồng lên node; kiểm tra với `offset` 16 px và tăng nếu cần.
- **Handle ẩn khi không hover:** người dùng mới có thể không biết kéo nối được; đường thay thế bằng nút trong panel vẫn có. Nếu thử tay thấy khó khám phá, hiện handle mờ 40% thay vì ẩn hẳn.
- **Font trong jsdom:** `next/font/google` trong test component có thể cần mock; `layout.tsx` không có test render, nhưng plan kiểm tra.
- **Tailwind 4 và `--shadow-*` trong `@theme inline`:** tên trùng với thang bóng mặc định; kiểm tra class `shadow-sm` sinh ra dùng biến của theme chứ không phải giá trị mặc định.
- **Hai bảng cạnh nhau trùng màu** do băm: chấp nhận được; nếu người dùng thấy khó chịu thì là lý do làm câu hỏi mở 1.

## Tiêu chí hoàn thành

**Chung**

- [ ] `pnpm --filter @schemaforge/frontend typecheck`, `lint`, `test`, `build` xanh; không có thay đổi trong `packages/` và `backend/`.
- [ ] Mọi test component có từ trước xanh mà không sửa assertion, trừ assertion chuỗi class của node trong `globals.test.ts`.
- [ ] Không thêm dependency vào `frontend/package.json` và không đổi lockfile.
- [ ] Không có giá trị màu hardcode ngoài `globals.css`: quét `oklch(`, `rgb(`, `hsl(` và mã hex màu trong `frontend/src/**/*.tsx` không có kết quả mới.
- [ ] Không có chuỗi giao diện mới không qua i18n; nếu có chuỗi mới thì đủ `vi` và `en`.
- [ ] Giao diện khớp mockup ở cả light và dark (kiểm tra tay).

**Theo tính năng**

- [ ] Token: mọi token ở mục 2 có trong `:root` và `.dark`; `globals.test.ts` có case 3:1 và nhóm 4,5:1 mới, tất cả xanh.
- [ ] Font: Plus Jakarta Sans và JetBrains Mono tải từ chính origin, có subset `vietnamese`; không request tới `fonts.googleapis.com` lúc chạy (kiểm tra tay trong tab Network).
- [ ] Màu bảng: `table-accent.test.ts` xanh; dải tiêu đề lấy màu qua `var(--table-accent-N)`.
- [ ] Node bảng: dải tiêu đề, dòng cột 28 px, icon khóa 14 px, chip `U`, `AI`; trạng thái chọn viền 2 px màu chính (kiểm tra tay).
- [ ] Edge: ba trạng thái màu, marker biến thể `hover`; test marker xanh; hình đường theo câu trả lời câu hỏi mở 2.
- [ ] Canvas: nền `--canvas`, lưới chấm 20 px, minimap tô màu bảng (test component).
- [ ] Toolbar, panel: pill trạng thái có chữ, chấm màu bảng trong danh sách bảng (kiểm tra tay).
- [ ] Danh sách schema, auth, hộp thoại, menu, toast theo mục 10–12; không cuộn ngang ở 320 px (kiểm tra tay).
- [ ] Reduced motion tắt mọi transition (kiểm tra tay với DevTools "Emulate prefers-reduced-motion").
- [ ] Tương phản chữ trên nền pha ≥ 4,5:1 ở cả hai theme (kiểm tra tay).

## Phạm vi

Trong phạm vi:

- Bộ token màu, bóng, bo góc, font cho light và dark.
- Giao diện mọi màn hình hiện có: editor (toolbar, canvas, node, edge, minimap, panel, hộp thoại), danh sách schema, đăng nhập, đăng ký, not-found, hộp thoại, menu, popover, tooltip, toast dùng chung.
- Màu dải tiêu đề suy ra từ id bảng.
- Giá trị token cho code panel của phần 6.
- Mở rộng test tương phản và test component cho phần thay đổi.

Ngoài phạm vi:

| Hạng mục | Làm ở |
|---|---|
| Đổi bố cục, route, luồng, thêm hoặc bớt màn hình | Không làm (quyết định của người dùng) |
| Tính năng mới (chọn màu bảng, auto-layout, subject area, ghi chú trên canvas) | Màu bảng: câu hỏi mở 1; còn lại phần 9 |
| Component code panel | Phần 6 |
| Giao diện chat AI | Phần 5, dùng token của spec này |
| Giao diện chia sẻ, lịch sử phiên bản | Phần 8, dùng token của spec này |
| Logo, favicon thiết kế riêng | Ngoài roadmap hiện tại; spec này chỉ dùng `DatabaseIcon` làm dấu nhận diện |

## Câu hỏi đã trả lời

Người dùng trả lời ngày 2026-10-02, sau khi xem spec và mockup.

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Người dùng có được tự chọn màu cho từng bảng không? | Không, trong phần này. Màu dải tiêu đề là băm xác định từ `table.id` (FNV-1a 32 bit, chia lấy dư 8) như [mục 4](#màu-dải-tiêu-đề); core model không đổi. Màu do người dùng chọn để lại cho một phần sau (dự kiến phần 9 "Hoàn thiện") |
| 2 | Đổi đường quan hệ từ bezier sang vuông góc bo góc? | Có: dùng `getSmoothStepPath` của `@xyflow/react` như [mục 5](#hình-đường-) |
| 3 | Font giao diện | Plus Jakarta Sans cho giao diện và JetBrains Mono cho kiểu cột, code, qua `next/font/google`, có subset `vietnamese`, tự host |
| 4 | Màu chính | Xanh lam (hue 259) như [mục 2](#2-token-màu) |
