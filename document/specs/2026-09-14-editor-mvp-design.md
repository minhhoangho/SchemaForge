# Editor MVP

Spec cho phần 3 trong [roadmap.md](../roadmap.md): Visual Schema Editor chạy hoàn toàn trên trình duyệt. Phần này gồm các tính năng ED-01 đến ED-06, ED-09, ED-10, ED-12, ED-13, ST-01 và UX-04 trong [danh sách tính năng](2026-09-14-feature-list-design.md).

Spec dựa trên [spec phần 1](2026-09-14-scaffold-tooling-design.md) (đã duyệt) và [spec phần 2](2026-09-14-core-schema-model-design.md) (đã duyệt). Mọi tên type, operation, mã issue và hàm của core lấy từ spec phần 2. Những gì editor cần bổ sung vào core được thêm trong plan phần 2, xem mục [Vấn đề với spec phần 2](#vấn-đề-với-spec-phần-2).

Các đoạn TypeScript là phác thảo. Plan và code tinh chỉnh tên và chi tiết, nhưng không đổi quyết định.

## Quyết định đã có từ trước

Spec này không bàn lại các điểm sau (nguồn: `architecture.md`, `.claude/rules/`, câu trả lời câu hỏi 11 trong danh sách tính năng):

- Next.js App Router, TypeScript strict, Tailwind CSS + shadcn/ui, React Flow (`@xyflow/react`), Zustand, Dexie, i18next + react-i18next, Vitest + React Testing Library trên jsdom.
- Local-first: editor không gọi backend và không cần tài khoản.
- Mọi thay đổi schema là operation của core; component không sửa state trực tiếp. Undo/redo dùng operation nghịch đảo và các hàm lịch sử của core.
- Khách lưu được nhiều schema, có màn hình danh sách để tạo, mở, đổi tên, xóa.
- Không có chuỗi giao diện hardcode, kể cả `aria-label` và toast; mọi chuỗi có `vi` và `en`. Màu lấy từ theme token.

Quyết định của người dùng khi duyệt spec: **phần 3 không có test chạy trên trình duyệt.** Mọi test là unit test và component test bằng Vitest trên jsdom.

## Tóm tắt quyết định

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Route, rendering | `/` là danh sách schema, `/schemas/[schemaId]` là editor. Route là Server Component mỏng; màn hình là client component, canvas tải bằng `next/dynamic` với `ssr: false`. Locale không nằm trong URL |
| 2 | Bố cục | Toolbar trên, panel trái (Bảng, Enum, Vấn đề), canvas giữa, panel thuộc tính phải. Node chỉ hiển thị; mọi chỉnh sửa nằm trong panel và hộp thoại |
| 3 | Canvas | Node bảng có điểm nối theo cột và ở tiêu đề; một edge cho mỗi quan hệ, ký hiệu chân gà. Kéo nối mở hộp thoại "Tạo quan hệ" (1-n, 1-1, n-n), hộp thoại này cũng mở được bằng bàn phím. Phím `Delete`, `Backspace` và nút xóa trong panel xóa lựa chọn bằng một `batch`, không hỏi lại vì undo được. Kéo thả phát một `moveElements` khi thả |
| 4 | Issue | `validateSchema` được memo theo tham chiếu tài liệu; hiển thị trên node, edge, trường trong panel và tab "Vấn đề". Mã issue dịch qua namespace `issues` |
| 5 | State | Mỗi schema đang mở có một Zustand store tạo qua React context. Một đường `dispatch(operation)`. Node, edge được suy ra với tái sử dụng object; component đọc lát cắt hẹp theo id |
| 6 | Undo, redo | Ô nhập commit khi blur hoặc Enter; chỉ gộp các lần di chuyển bằng phím mũi tên. Phím tắt undo, redo và `Delete`, không chạy khi đang gõ hay khi hộp thoại đang mở. Lịch sử không còn sau khi tải lại trang |
| 7 | Lưu local | Dexie DB `schemaforge` version 1 gồm `schemas`, `documents`, `viewports`. Lưu ngay sau mỗi thay đổi, mỗi lúc chỉ một lần ghi. Mọi lần đọc qua `parseSchemaDocument`. Một schema chỉ sửa được ở một tab nhờ Web Locks. Viewport được lưu theo schema. Phần 4 thêm version 2 (`ownerId`, `cloudRevision`, `syncStatus` trên `schemas`, và bảng `session`), trạng thái cloud trên toolbar, danh sách hai phần khi đã đăng nhập ([spec phần 4](2026-09-15-auth-cloud-design.md), mục 7) |
| 8 | Theme | Cookie `sf-theme` (`system`, `light`, `dark`; mặc định `system`). Class `.dark` của shadcn/ui được đặt trước khi vẽ bằng một script tĩnh có nonce. Không dùng `next-themes`. React Flow nhận `colorMode` và token qua biến `--xy-*` |
| 9 | i18n | Cookie `sf-locale`; lần đầu chọn theo `Accept-Language`, không khớp thì `en`. Server và client dùng chung resource TypeScript, key có kiểu, `vi` phải khớp `en` lúc biên dịch. Lint bằng `eslint-plugin-i18next` và `eslint-plugin-jsx-a11y-x` |
| 10 | Zoom, pan, minimap | Có sẵn trong React Flow; nút zoom và fit view nằm trên toolbar của ứng dụng; `MiniMap` có `pannable`, `zoomable` |
| 11 | Bảo mật | CSP có nonce theo từng request, sinh trong `proxy.ts`, ngay từ phần 3. `script-src` dùng nonce và `'strict-dynamic'`; `style-src` cho phép `'unsafe-inline'`. Zod chạy chế độ `jitless` ở frontend |
| 12 | Accessibility | Mục tiêu WCAG 2.2 mức AA. Mọi thao tác kéo có đường thay thế bằng bấm (không kéo) và bằng bàn phím; mục tiêu bấm tối thiểu 24×24 CSS px; phần tử đang focus không bị minimap hay toast che hoàn toàn; landmark, skip link; hộp thoại Radix; nhãn của React Flow được dịch qua `ariaLabelConfig`; axe-core chạy trong test component, phần axe không đo được trên jsdom kiểm tra bằng test component và kiểm tra tay |
| 13 | Hiệu năng | Schema 100 bảng, 1.500 cột, 150 quan hệ: sửa một cột chỉ render lại đúng dòng cột đó (test tự động); INP ≤ 200 ms và kéo bảng ≥ 30 fps khi CPU chậm 4× (đo tay) |
| 14 | Test | Chỉ Vitest trên jsdom: unit test, component test, và test tích hợp màn hình + store + repository với `fake-indexeddb`. Không có test chạy trên trình duyệt; độ tương phản, CSP trên trình duyệt và hiệu năng được kiểm tra tay |

## Phiên bản

Kiểm tra ngày 2026-09-14 bằng `npm view` (phiên bản, `peerDependencies`, `engines`), mã nguồn gói trên npm và tài liệu chính thức qua Context7. Phiên bản Next.js 16.3.5, React 19.3.0, Tailwind CSS 4.3.3, ESLint 10.10.0, Vitest 5.0.0, Zod 4.6.4 lấy từ spec phần 1.

| Gói | Phiên bản | Tương thích |
|---|---|---|
| `@xyflow/react` | 12.11.6 | peer `react >=17` |
| `zustand` | 5.0.15 | peer `react >=18` |
| `dexie` | 4.4.6 | không có peer |
| `dexie-react-hooks` | 4.4.0 | peer `dexie >=4.2.0-alpha.1 <5`, `react >=16` |
| `i18next` | 26.4.2 | peer `typescript ^5 \|\| ^6 \|\| ^7` |
| `react-i18next` | 17.0.14 | peer `react >=16.8`, `i18next >=26.2.0` |
| `shadcn` (CLI) | 4.21.0 | `engines.node >=20.18.1`; chạy bằng `pnpm dlx shadcn@4.21.0`, không cài làm dependency |
| `@tailwindcss/postcss` | 4.3.3 | cùng phiên bản với `tailwindcss` |
| `radix-ui` | 1.6.7 | peer `react ^19` |
| `cmdk` | 1.1.1 | peer `react ^18 \|\| ^19 \|\| ^19.0.0-rc`, `react-dom` cùng phạm vi; tương thích React 19.3.0. Dùng cho combobox `Command` của shadcn/ui (ô chọn kiểu cột) |
| `lucide-react` | 1.46.0 | peer `react ^19` |
| `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` | 0.7.1, 2.1.1, 3.7.0, 1.4.0 | do `shadcn init` thêm vào |
| `sonner` | 2.0.8 | peer `react ^19`; component toast của shadcn/ui |
| `prettier-plugin-tailwindcss` | 0.8.1 | peer `prettier ^3` |
| `eslint-plugin-i18next` | 6.1.5 | không khai báo peer `eslint`. Mã nguồn dùng `context.sourceCode`, chỉ gọi API cũ khi `sourceCode` không có, nên chạy được trên ESLint 10 |
| `eslint-plugin-jsx-a11y-x` | 0.2.0 | peer `eslint ^9 \|\| ^10` |
| `axe-core` | 4.13.0 | không có peer; gọi trực tiếp `axe.run` trong test component trên jsdom |
| `fake-indexeddb` | 6.2.5 | chỉ dùng trong test |
| `@testing-library/user-event` | 14.6.7 | peer `@testing-library/dom >=7.21.4` |

Gói đã xem xét và không dùng:

| Gói | Lý do |
|---|---|
| `next-themes` 0.4.6 | Commit cuối ngày 2025-05-31; issue #385, #387, #397 còn mở về lỗi "Encountered a script tag while rendering React component" với React 19.2 |
| `eslint-plugin-jsx-a11y` 6.10.2 | Peer chỉ tới ESLint 9, bản cuối phát hành 2024-10. Spec phần 1 cũng loại plugin không khai báo hỗ trợ ESLint 10 |
| `i18next-cli` 1.73.2 (lệnh `lint`) | Là CLI riêng nằm ngoài `pnpm lint`, kéo theo `@swc/core`, `inquirer`, `execa` |
| `vitest-axe` 0.1.0 | 0.1.0 là bản ổn định mới nhất; nhánh 1.0 vẫn là pre-release (`1.0.0-pre.5`, 2025-01-22). Gọi `axe.run` trực tiếp chỉ cần một helper vài dòng |
| `jest-axe` 11.0.0 | Viết cho Jest: kéo theo `jest-matcher-utils` 30 và ghim `axe-core` 4.12.1 |
| `i18next-browser-languagedetector` 8.2.1 | Chỉ nhận diện ngôn ngữ trên client, nên server render sai ngôn ngữ ở lần tải đầu |
| `nanoid` 6.0.1 | `crypto.randomUUID` đã đủ, không cần thêm dependency |

## 1. Route và màn hình

### Route

| Route | File | Nội dung |
|---|---|---|
| `/` | `app/page.tsx` | Màn hình danh sách schema |
| `/schemas/[schemaId]` | `app/schemas/[schemaId]/page.tsx`, `loading.tsx`, `error.tsx` | Editor của một schema |
| Không khớp route | `app/not-found.tsx` | Trang không tìm thấy, có link về `/` |

**Quyết định:** danh sách nằm ở `/` vì đây là màn hình đầu tiên người dùng cần; roadmap không có trang giới thiệu. Editor có URL riêng theo id lưu trữ, nên tải lại trang vẫn mở đúng schema và nút Back của trình duyệt quay về danh sách.

**Phương án bị loại:** danh sách và editor chung một route, chuyển bằng state. Tải lại trang sẽ mất schema đang mở, và không mở được hai schema ở hai tab.

### Màn hình danh sách (`/`)

- Header: tên sản phẩm, nút đổi theme, nút đổi ngôn ngữ.
- Nút "Tạo schema" mở hộp thoại nhập tên (bắt buộc, không rỗng sau khi bỏ khoảng trắng đầu và cuối). Xác nhận thì tạo tài liệu bằng `createEmptySchema`, lưu, rồi chuyển tới editor.
- Danh sách sắp theo `updatedAt` giảm dần. Mỗi dòng có tên (link mở editor), thời điểm sửa gần nhất định dạng bằng `Intl.DateTimeFormat` theo locale đang dùng, và menu thao tác: Mở, Đổi tên, Xóa.
- Đổi tên mở hộp thoại, áp `renameSchema` lên bản đã lưu (mục 7).
- Xóa mở hộp thoại xác nhận (`AlertDialog`), vì xóa schema không undo được.
- Danh sách đọc bằng `useLiveQuery`, nên tự cập nhật khi tab khác tạo, đổi tên hoặc sửa schema.

| Trạng thái | Hiển thị |
|---|---|
| Đang đọc | Skeleton, không có chữ |
| Rỗng | Dòng "Chưa có schema nào" và nút "Tạo schema đầu tiên" |
| Có bản ghi metadata không đọc được | Dòng "Schema không đọc được", chỉ có thao tác Xóa |
| IndexedDB không dùng được | Thông báo lỗi lưu trữ theo mục 7, không có nút tạo |

### Màn hình editor (`/schemas/[schemaId]`)

| Trạng thái | Điều kiện | Hiển thị |
|---|---|---|
| Đang mở | Đang lấy khóa tab, đọc và parse | Skeleton của toolbar và canvas |
| Không tìm thấy | `schemaId` không phải UUID, hoặc không có bản ghi | "Không tìm thấy schema", link về danh sách |
| Đang mở ở tab khác | Khóa của schema đang do tab khác giữ | "Schema này đang mở ở một tab khác". Màn hình tự mở khi tab kia đóng hoặc rời schema; có link về danh sách |
| Không đọc được | `parseSchemaDocument` trả lỗi | `version-unsupported`: "Schema này được lưu bằng phiên bản SchemaForge mới hơn. Hãy tải lại trang." Mã khác: "Dữ liệu schema bị hỏng". Không bao giờ ghi đè bản đã lưu |
| Bộ nhớ không dùng được | IndexedDB không mở được, hoặc lỗi lưu trữ bị ném ra khi đọc tài liệu hay viewport (ví dụ `DatabaseClosedError`) | "Không dùng được bộ nhớ trình duyệt", mô tả là thông báo theo `StorageErrorCode` (mục 7); với `unknown` thì dùng câu riêng cho lần đọc "Không đọc được schema từ bộ nhớ trình duyệt. Hãy tải lại trang.", vì thông báo `unknown` của namespace `storage` nói về lần lưu. Có link về danh sách. Không bao giờ ghi đè bản đã lưu |
| Sẵn sàng, chưa có bảng | `tables` rỗng | Canvas trống, giữa canvas có dòng "Schema chưa có bảng" và nút "Thêm bảng" |
| Sẵn sàng | | Editor đầy đủ (mục 2) |
| Lỗi lập trình | Component throw, hoặc `undo`/`redo` throw vì áp nghịch đảo thất bại | `error.tsx`: thông báo đã dịch, nút "Tải lại" và link về danh sách. Bản đã lưu là trạng thái thành công gần nhất |

`schemaId` là tham số route không tin cậy: kiểm tra đúng dạng UUID trước khi truy vấn Dexie.

### Rendering

- `layout.tsx` gốc là Server Component: đọc cookie `sf-theme`, `sf-locale` và header `Accept-Language`, đọc nonce từ header `x-nonce`, render `<html lang data-theme-preference>`, script theme (mục 8) và `AppProviders`. Mọi route đều render động, vì layout đọc cookie và CSP dùng nonce (mục 11). Đây là hệ quả chấp nhận được: route chỉ render khung, không tải dữ liệu nào trên server.
- `page.tsx` của cả hai route là Server Component mỏng: `await params`, kiểm tra dạng `schemaId`, rồi render client component `SchemaListScreen` hoặc `EditorScreenLoader`. `generateMetadata` dịch tiêu đề trang bằng instance i18next phía server.
- `EditorScreenLoader` là client component, gọi `next/dynamic(() => import(...editor-screen), { ssr: false, loading })`. Next.js 16 không cho `ssr: false` trong Server Component, nên loader phải là client component. React Flow, Dexie và store chỉ được tải khi mở editor, không nằm trong bundle của danh sách.
- `SchemaListScreen` được SSR phần khung (header, tiêu đề, nút); danh sách đọc từ IndexedDB sau khi hydrate.

**Phương án bị loại:**

- Render toàn bộ editor trên server: dữ liệu nằm trong IndexedDB, server không đọc được, còn React Flow cần đo DOM.
- Locale trong URL (`/[locale]/...`): xem mục 9.

## 2. Bố cục editor

```text
+---------------------------------------------------------------------------------------+
| <- | Blog | [+Bang] [+Enum] | [Undo][Redo] | [-] [+] [Fit] | !2 | Da luu | Theme | VI |
+----------------+-----------------------------------------------+----------------------+
| [Bang|Enum|    |                                               | Bang: posts          |
|  Van de (2)]   |  +----------------+       +-----------------+ | Ten     [posts     ] |
|                |  | users       !1 |-||---<| posts           | | Comment [          ] |
| > posts        |  +----------------+       +-----------------+ | -- Cot ------------- |
| > users        |  | PK id   bigint |       | PK id      uuid | | id        uuid  PK   |
|                |  |    email  vc U |       | FK users_id big | | users_id  bigint     |
|                |  +----------------+       +-----------------+ | [+ Cot]              |
|                |                                  +----------+ | -- Index ----------- |
|                |                                  | minimap  | | [+ Index]            |
|                |                                  +----------+ | [+ Quan he] [Xoa]    |
+----------------+-----------------------------------------------+----------------------+
```

Wireframe viết không dấu để các cột thẳng hàng; giao diện thật hiển thị đầy đủ dấu tiếng Việt và dùng icon.

### Toolbar

Theo thứ tự: về danh sách; tên schema (bấm để đổi tên bằng `renameSchema`); thêm bảng; thêm enum; undo; redo; zoom out, zoom in, fit view; nút số issue (mở tab "Vấn đề"); trạng thái lưu ("Đang lưu…", "Đã lưu", "Chưa lưu được" kèm nút thử lại); theme; ngôn ngữ. Nút chỉ có icon có `aria-label` và tooltip đã dịch. Undo, redo bị disable khi không còn gì để undo hoặc redo.

- **Thêm bảng:** một `batch` gồm `addTable` (tên gợi ý `table_<n>` chưa dùng, vị trí ở giữa viewport, lệch 24 px nếu trùng chỗ bảng khác), `addColumn` cho cột `id` (`bigint`, không nullable, auto-increment) và `setPrimaryKey([id])`. Kết quả là schema không phát sinh issue, và undo một bước là bỏ cả ba. Bảng mới được chọn, panel phải mở và focus vào ô tên.
- **Thêm enum:** `addEnum` với tên gợi ý `enum_<n>` và một giá trị `value_1`, để không sinh `enum-values-empty`. Tab "Enum" mở và focus vào ô tên enum mới.

### Panel trái

Ba tab, thu gọn được:

- **Bảng:** danh sách bảng sắp theo hàm sắp xếp của core. Bấm một dòng thì chọn bảng, đưa bảng vào giữa khung nhìn và mở panel phải. Đây là cách chọn bảng không phải đi qua canvas, dùng cho bàn phím và schema lớn.
- **Enum:** mỗi enum có ô tên, danh sách giá trị (ô nhập, nút lên, xuống, xóa; nút thêm giá trị) và nút xóa enum. Sửa giá trị dispatch `updateEnum({ values })` với cả mảng. Khi enum đang được dùng, nút xóa bị disable và bên cạnh liệt kê các cột `bảng.cột` đang dùng.
- **Vấn đề:** danh sách issue (mục 4).

### Panel thuộc tính (phải)

Nội dung theo lựa chọn:

| Lựa chọn | Panel |
|---|---|
| Không có | Ẩn |
| Một bảng | Tên, comment; vị trí X, Y; cột; index; nút "Thêm quan hệ" và "Xóa bảng" |
| Một quan hệ (không kèm bảng) | Loại, bảng hai đầu, cặp cột, ON DELETE, ON UPDATE, nút xóa |
| Nhiều phần tử | "Đã chọn n bảng, m quan hệ" và nút xóa tất cả (một `batch`) |

**Cột.** Mỗi cột một dòng gồm: tên, kiểu, và các checkbox nullable, khóa chính, unique, auto-increment. Nút "Chi tiết" mở phần tham số kiểu (độ dài; precision và scale; tên kiểu custom), giá trị mặc định (không có, literal, `currentTimestamp`, `generateUuid`, chỉ hiện các biểu thức hợp với kiểu) và comment. Nút lên, xuống dispatch `moveColumn`, nút xóa dispatch `removeColumn`. "Thêm cột" dispatch `addColumn` ở cuối, với tên `column_<n>`, kiểu `varchar(255)`, không nullable.

- Chọn kiểu bằng combobox `Popover` + `Command` (cmdk) của shadcn/ui, gõ để lọc, có ba nhóm: 17 kiểu chung (nhãn `vi` "Kiểu thông dụng"), các enum hiện có, "Kiểu tự đặt…".
- Checkbox khóa chính dispatch `setPrimaryKey` với danh sách mới: thêm vào cuối hoặc bỏ ra. Thứ tự khóa chính nhiều cột là thứ tự tick, và node hiện số thứ tự cạnh icon khóa. UI không tự sửa tổ hợp thuộc tính: tick khóa chính trên cột nullable sẽ hiện issue `column-primary-key-nullable`, người dùng tự bỏ nullable.

**Index.** Mỗi index có tên (gợi ý bằng `suggestIndexName`), danh sách cột có thứ tự (chọn thêm cột; nút lên, xuống, bỏ), checkbox unique và nút xóa. Không cho lưu index không có cột: nút bỏ cột cuối cùng bị disable, vì mảng rỗng là bất biến cấu trúc.

**Quan hệ.** Loại chỉ có 1-1 hoặc 1-n (`updateRelation({ kind })`), kèm dòng giải thích "n-n được tạo bằng bảng trung gian". Bảng hai đầu chỉ hiển thị; đổi bảng là xóa rồi tạo lại. Cặp cột có thể thêm, sửa, bỏ, và luôn còn ít nhất một cặp. ON DELETE, ON UPDATE chọn trong năm hành động.

**Comment.** Bảng và cột có textarea comment; xóa hết nội dung là xóa comment (chuỗi rỗng). Node có icon comment, tooltip hiện nội dung dạng văn bản thuần.

**Vị trí.** Hai ô số X, Y (pixel canvas ở mức zoom 1, hiển thị làm tròn tới số nguyên) là đường thay thế bằng bấm và bằng bàn phím cho việc kéo bảng (mục 12). Ô commit khi blur hoặc Enter như mọi ô nhập một dòng (mục 6) và dispatch một `moveElements` cho riêng bảng đó. Giá trị không phải số hữu hạn thì ô trả về giá trị đang hiển thị, không dispatch. Kéo bảng hoặc di chuyển bằng phím mũi tên thì ô cập nhật theo tài liệu. Nhãn nằm trong namespace `editor`.

### Chỉnh sửa trong panel, không trong node

**Quyết định:** node trên canvas chỉ hiển thị. Nhấp đúp vào tên bảng hoặc tên cột trong node thì chọn bảng và focus ô tương ứng trong panel.

**Lý do:** ở mức zoom dưới 1, ô nhập trong node quá nhỏ để gõ. Ô nhập trong node đụng thao tác kéo, pan và phím tắt của React Flow (phải gắn class `nodrag`, `nowheel` ở nhiều chỗ). Form trong panel có label và thứ tự tab tự nhiên. Hàng trăm ô nhập trong node cũng làm canvas nặng.

**Phương án bị loại:** sửa inline tên bảng, cột trong node. Nhanh hơn với schema nhỏ, nhưng vẫn cần panel cho kiểu, giá trị mặc định, index, nên thành hai nơi sửa cùng một dữ liệu.

## 3. Tương tác trên canvas

### Node bảng

- Tiêu đề: tên bảng; icon comment nếu có; huy hiệu issue (icon kèm số) nếu bảng, cột hoặc index của bảng có issue.
- Mỗi cột một dòng, theo `table.columnIds`: đánh dấu, tên, kiểu rút gọn (`varchar(255)`, `decimal(10,2)`, tên enum, tên kiểu custom), icon comment, dấu issue.
- Đánh dấu cột, luôn gồm icon và text ẩn cho trình đọc màn hình, không chỉ dựa vào màu:

| Dấu | Điều kiện |
|---|---|
| Khóa, kèm số thứ tự nếu khóa chính nhiều cột | Cột thuộc `primaryKeyColumnIds` |
| Mắt xích | Cột là `fromColumnId` của một quan hệ nào đó |
| `U` | `isUnique` |
| `?` sau kiểu | `isNullable` |
| `AI` | `isAutoIncrement` |

- **Điểm nối:** mỗi dòng cột có hai handle ở cạnh trái và phải; tiêu đề có một handle ở mỗi cạnh. Dùng `connectionMode="loose"`, nên mỗi handle vừa là nguồn vừa là đích. Id handle là `column:<columnId>:left|right` và `table:<tableId>:left|right`.
- `aria-label` của node: "Bảng users, 5 cột" (đã dịch).
- Kích thước node do React Flow đo; bề rộng tối thiểu và tối đa cố định, tên dài bị cắt bằng dấu "…" và hiện đầy đủ trong tooltip.

### Edge quan hệ

- **Một edge cho mỗi quan hệ**, kể cả khóa ngoại nhiều cột. Edge nối handle của cặp cột đầu tiên. Khi edge được chọn hoặc hover, mọi cột trong `columnPairs` ở cả hai node được tô sáng.
- **Chọn cạnh của handle theo vị trí:** bảng `from` nằm bên trái bảng `to` thì nối từ cạnh phải sang cạnh trái, và ngược lại. Quan hệ tự tham chiếu dùng cạnh phải ở cả hai đầu.
- **Loại quan hệ** thể hiện bằng ký hiệu chân gà ở đầu edge (marker SVG tự định nghĩa, màu lấy từ token): 1-n có chân gà ở phía `from` và vạch đơn ở phía `to`; 1-1 có vạch đơn ở cả hai đầu. Giữa edge có nhãn nhỏ `1-n` hoặc `1-1`, và `N cột` khi khóa ngoại có nhiều cột.
- `aria-label` của edge: "posts.author_id → users.id, một-nhiều" (đã dịch). Edge có issue được vẽ bằng màu `destructive` và nét đứt.

**Phương án bị loại:** một edge cho mỗi cặp cột. Khóa ngoại ba cột thành ba đường chồng nhau mà vẫn là một quan hệ, nên chọn, xóa hay sửa một đường dễ gây hiểu nhầm.

### Tạo quan hệ

**Quyết định:** kéo từ một handle của bảng A thả vào một handle của bảng B (hoặc chính A) sẽ mở hộp thoại "Tạo quan hệ", điền sẵn theo điểm bắt đầu và điểm thả. Nút "Thêm quan hệ" trong panel của bảng mở cùng hộp thoại đó, nên tạo quan hệ được bằng bàn phím. Hộp thoại có:

| Trường | Giá trị |
|---|---|
| Bảng chứa khóa ngoại (`from`) | Điền sẵn bảng A; có nút "Đổi chiều" |
| Bảng được tham chiếu (`to`) | Điền sẵn bảng B |
| Loại | 1-n (mặc định), 1-1, n-n |
| Cột được tham chiếu (1-n, 1-1) | Thả vào handle của cột `d` thì là `[d]`; thả vào tiêu đề thì là khóa chính của B |
| Khóa ngoại (1-n, 1-1) | "Tạo cột mới" hoặc "Dùng cột có sẵn". Kéo từ handle cột `c` thì mặc định dùng cột có sẵn, ghép `c` với cột được tham chiếu đầu tiên; kéo từ tiêu đề thì mặc định tạo cột mới |
| Tên bảng trung gian (n-n) | Gợi ý `<A>_<B>`, thêm hậu tố số nếu trùng |

Enter xác nhận, Escape hủy. Vì các giá trị mặc định đã hợp lý, kéo xong bấm Enter là đủ cho trường hợp thường gặp.

Khi xác nhận, hộp thoại dựng một operation và dispatch như một mục lịch sử:

- **1-n, 1-1, dùng cột có sẵn:** `addRelation` với các cặp đã chọn, `onDelete` và `onUpdate` là `noAction`.
- **1-n, 1-1, tạo cột mới:** một `batch` gồm `addColumn` vào bảng `from` cho mỗi cột được tham chiếu (cùng kiểu, không nullable, không mặc định, không auto-increment, tên `<tên bảng to>_<tên cột>`, thêm hậu tố số nếu trùng) rồi `addRelation`. Với 1-1 thì đánh dấu cột mới `isUnique` nếu khóa ngoại có một cột, hoặc thêm một index unique trên các cột mới nếu có nhiều cột. Như vậy quan hệ mới không phát sinh `relation-one-to-one-not-unique`. Hàm dựng là `buildRelation` của core, nhận các cột được tham chiếu qua trường `referencedColumnIds` (xem [Vấn đề với spec phần 2](#vấn-đề-với-spec-phần-2), mục 1).
- **n-n:** `buildManyToMany(schema, { leftTableId, rightTableId, junctionTableName, position }, generateId)`, với `position` ở giữa hai bảng. Batch trả về được dispatch một lần, nên undo một bước là bỏ cả bảng trung gian lẫn hai quan hệ.

Hộp thoại chặn xác nhận và hiện lỗi ngay dưới trường khi:

- Cột được tham chiếu rỗng (B không có khóa chính, và điểm thả không phải một cột). Với n-n, hai bảng đều phải có khóa chính; đây là điều kiện `primary-key-missing` của `buildManyToMany`.
- Chế độ "Dùng cột có sẵn" có cột được tham chiếu chưa được ghép, hoặc một cột được chọn hai lần.

Khác kiểu hoặc cột được tham chiếu không unique không bị chặn: quan hệ vẫn được tạo, và issue ngữ nghĩa hiện trên canvas, đúng chính sách hai tầng của core.

**Phương án bị loại:**

- Tạo quan hệ 1-n ngay khi thả, không có hộp thoại: nhanh hơn một phím, nhưng không chọn được n-n hay "tạo cột mới", và vẫn cần một đường riêng cho bàn phím.
- Chỉ kéo từ cột sang cột: không có cách tự tạo khóa ngoại theo khóa chính nhiều cột.

### Chọn, di chuyển, xóa

- **Chọn:** bấm vào node hoặc edge. Phím chọn nhiều + bấm (`multiSelectionKeyCode`, mặc định của React Flow 12.11.6 là `⌘` trên macOS và `Ctrl` trên hệ khác), hoặc `Shift` + kéo khung (`selectionKeyCode`), để chọn nhiều (phím bổ trợ mặc định của React Flow, không phải phím tắt). Bấm vào nền thì bỏ chọn. Lựa chọn nằm trong store (mục 5), nên panel và canvas luôn khớp.
- **Di chuyển bằng chuột:** trong lúc kéo, vị trí tạm nằm trong `dragPositions` của store, không nằm trong tài liệu. Ở `onNodeDragStop`, store dispatch **một** `moveElements` chứa mọi bảng đang kéo, rồi xóa `dragPositions`. Không phát operation nếu vị trí không đổi.
- **Di chuyển bằng phím mũi tên** (tính năng accessibility có sẵn của React Flow trên node đang focus): mỗi lần nhấn dispatch một `moveElements`, và các lần nhấn liên tiếp trên cùng tập bảng được gộp thành một mục lịch sử (mục 6). Plan xác nhận chuỗi sự kiện `onNodesChange` của React Flow để phân biệt kéo chuột với phím mũi tên.
- **Di chuyển bằng ô "Vị trí"** trong panel bảng (mục 2): mỗi lần commit dispatch một `moveElements` và là một mục lịch sử.
- **Xóa bằng nút** trong panel: bảng, cột, quan hệ, index, enum, hoặc nhiều phần tử cùng lúc.
- **Xóa bằng phím `Delete` hoặc `Backspace`:** xóa lựa chọn hiện tại (bảng và quan hệ) bằng **một** operation. Hàm thuần `buildDeleteSelectionOperation(selection)` trả `batch` gồm `removeRelation` cho từng quan hệ được chọn, rồi `removeTable` cho từng bảng được chọn. Quan hệ bị xóa trước, nên quan hệ nối với một bảng cũng đang được chọn không bị xóa hai lần. Batch được dispatch một lần, nên một lần undo khôi phục tất cả. Lựa chọn rỗng thì không làm gì.
  - Phím chỉ có tác dụng khi `shouldHandleShortcut(event, { requiresCanvasFocus: true })` cho phép (mục 6): không khi đang gõ trong ô nhập, `textarea`, phần tử `contenteditable`, không khi IME đang composition, không khi hộp thoại đang mở, và chỉ khi focus nằm trong vùng canvas hoặc ở `body`.
  - **React Flow không tự xóa phần tử.** `deleteKeyCode={null}` tắt bộ xử lý phím xóa của React Flow, vì bộ này chỉ bỏ qua ô nhập mà không biết hộp thoại đang mở. `onBeforeDelete` luôn trả `false`, và thay đổi loại `remove` trong `onNodesChange`, `onEdgesChange` bị bỏ qua, nên mọi đường xóa đều phải đi qua `dispatch`. Plan xác nhận API cuối cùng của React Flow 12.11.
- **Không hỏi xác nhận** với cả hai cách, vì thao tác undo được. Sau khi xóa hiện toast "Đã xóa bảng posts" (hoặc "Đã xóa 3 phần tử") có nút "Hoàn tác". Focus quay về vùng canvas. Phím xóa và nút xóa bảng, quan hệ, nhiều phần tử trong panel đi qua cùng một hàm (`useDeleteSelection`). Nút "Hoàn tác" chỉ hoàn tác khi thao tác xóa vẫn là mục mới nhất của lịch sử, nên không hoàn tác nhầm thay đổi làm sau đó (plan phần 3, Vấn đề 79, 80).
- **Xóa schema** từ danh sách thì phải xác nhận (mục 1), vì không undo được.

### Lỗi cấu trúc khi dispatch

UI chỉ tạo operation hợp lệ: nút bị disable hoặc hộp thoại chặn trước. Nếu `applyOperation` vẫn trả `OperationError`, đó là lỗi lập trình:

- Tài liệu và lịch sử giữ nguyên.
- Hiện toast lỗi với thông báo dịch theo `errors.<code>`, kèm câu "Thao tác không được áp dụng".
- Logger của frontend ghi `operation.type`, `code`, `path`, không ghi tên hay nội dung schema.

## 4. Hiển thị issue ngữ nghĩa

- **Tính toán:** `getIssues(document)` gọi `validateSchema` và nhớ kết quả trong một `WeakMap` theo tham chiếu tài liệu. Cùng một tài liệu chỉ validate một lần, dù nhiều component cùng đọc. Kèm theo là chỉ mục `issuesByElement` (bảng, cột, quan hệ, index, enum, gốc schema → danh sách issue), cũng được memo theo tài liệu.
- **Ánh xạ `path` sang phần tử** là hàm thuần `resolveIssueTarget(document, path)`:

| Tiền tố `path` | Phần tử | Nơi hiển thị |
|---|---|---|
| `['name']` | Tên schema | Tên schema trên toolbar |
| `['tables', id, …]` | Bảng | Huy hiệu ở tiêu đề node; trường tương ứng trong panel bảng |
| `['columns', id, …]` | Cột (bảng lấy từ `column.tableId`) | Dấu trên dòng cột và huy hiệu của bảng; trường trong dòng cột |
| `['relations', id, …]` | Quan hệ | Edge màu `destructive`; trường trong panel quan hệ |
| `['indexes', id, …]` | Index (bảng lấy từ `index.tableId`) | Huy hiệu của bảng; dòng index |
| `['enums', id, …]` | Enum | Dòng enum trong tab "Enum"; ô giá trị theo chỉ số |

- **Trong panel:** trường có issue có `aria-invalid="true"`, thông báo lỗi nằm ngay dưới trường và được nối bằng `aria-describedby`.
- **Tab "Vấn đề":** mỗi dòng là thông báo đã dịch, có tên phần tử, ví dụ "Bảng “users” trùng tên với bảng khác". Bấm một dòng thì chọn phần tử, đưa vào giữa khung nhìn và focus trường có lỗi (store giữ `focusRequest: DocumentPath | null` để panel xử lý). **Quy tắc chung cho mọi panel:** mỗi trường có thể có issue mang `data-focus-path` bằng đúng đường dẫn issue mà core trả cho trường đó (ví dụ `['columns', id, 'type', 'length']`), để yêu cầu focus tìm được phần tử. Trường nằm trong phần thu gọn (phần "Chi tiết" của cột) thì phần đó tự mở khi có issue bên trong, và nhãn nút cho biết có vấn đề; nếu người dùng tự đóng lại trong khi issue còn thì yêu cầu focus không tìm thấy trường và không làm gì. Thứ tự dòng theo thứ tự `validateSchema` trả về. Không có issue thì hiện "Không có vấn đề nào".
- **Toolbar:** nút có icon cảnh báo và số issue; bằng 0 thì hiện icon đạt, không có số.
- **Dịch:** namespace `issues` có đúng một key cho mỗi `IssueCode`, với biến nội suy `{{table}}`, `{{column}}`, `{{index}}`, `{{enum}}`, `{{value}}`. Giá trị biến lấy từ `resolveIssueTarget`. Namespace `errors` có một key cho mỗi mã trong `ERROR_CODES`. Cách bảo đảm đủ bản dịch nằm ở mục 9.
- Issue không chặn lưu và không chặn thao tác (chính sách "Editor, thao tác tay" trong spec phần 2).

## 5. Kiến trúc state

### Store theo từng schema

```ts
type Selection = { readonly tableIds: readonly TableId[]; readonly relationIds: readonly RelationId[] };

type SaveStatus =
  | { readonly kind: 'saved' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'failed'; readonly errorCode: StorageErrorCode };

type EditorState = {
  readonly schemaId: string;
  readonly document: SchemaDocument;
  readonly history: History;
  readonly selection: Selection;
  readonly dragPositions: Readonly<Partial<Record<TableId, Position>>>;
  readonly leftPanelTab: 'tables' | 'enums' | 'issues' | null;
  readonly focusRequest: DocumentPath | null;
  readonly saveStatus: SaveStatus;
};

type EditorActions = {
  readonly dispatch: (operation: Operation, options?: DispatchOptions) => Result<void, OperationError>;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly setSelection: (selection: Selection) => void;
  // ... setDragPositions, setLeftPanelTab, requestFocus, setSaveStatus
};

type DispatchOptions = { readonly coalesce?: 'keyboardMove' };

function createEditorStore(input: {
  readonly schemaId: string;
  readonly document: SchemaDocument;
  readonly generateId: GenerateId;
}): StoreApi<EditorState & EditorActions>;
```

- `createEditorStore` dùng `createStore` của `zustand/vanilla`. `EditorStoreProvider` tạo store một lần khi editor của schema đó mount và đưa vào React context; `useEditorStore(selector)` bọc `useStore`. Mở schema khác thì provider mount lại, store mới, lịch sử mới.
- Code không phải component (autosave, phím tắt, khóa tab) nhận store instance qua tham số.
- Issue và node, edge của React Flow không nằm trong store: chúng được suy ra (mục 4 và bên dưới).
- `id` mới lấy từ `generateId` được truyền vào store. Code chạy thật truyền `() => crypto.randomUUID()`; test truyền bộ đếm.

**Lý do chọn store theo schema:** state không rò giữa hai schema hay giữa các test, và không có state ở cấp module bị chia sẻ giữa các request khi Next.js SSR client component. Tài liệu Zustand khuyên dùng store qua context với Next.js.

**Phương án bị loại:** một store toàn cục tạo bằng `create()`. Mỗi lần mở schema phải tự reset mọi trường; test phải reset thủ công.

### Một đường duy nhất: `dispatch`

```text
dispatch(operation)
  → applyOperation(document, operation)
      lỗi      → toast + logger (mục 3), trả lỗi; document và history giữ nguyên
      thành công → history = recordEntry(history, { operation, inverse }, HISTORY_LIMIT)
                  (hoặc gộp với mục cuối nếu coalesce, mục 6)
                → set({ document, history, selection đã lọc bỏ id không còn tồn tại })
  → autosave nhận tài liệu mới qua subscribe (mục 7)
```

- Component chỉ gọi `dispatch`, `undo`, `redo`; không component nào gọi `applyOperation` hay sửa `document` trực tiếp.
- Operation chỉ chứa ý định. Operation nhiều bước (thêm bảng, tạo quan hệ) được dựng bằng các hàm thuần trong `features/editor/lib/`, trả về `batch`.
- Trường nhập liệu chỉ dispatch khi giá trị khác giá trị hiện tại, nên không có mục lịch sử rỗng.
- `HISTORY_LIMIT` là 200 mục. Mục lịch sử chỉ chứa operation và nghịch đảo, không chứa bản sao schema, nên 200 mục vẫn nhỏ so với tài liệu.

### Suy ra node và edge với tham chiếu ổn định

Core trả tài liệu có structural sharing: object bảng, cột, quan hệ không đổi thì giữ nguyên tham chiếu. Editor dựa vào điều đó:

- `toTableNodes(tables, selection, dragPositions, previousNodes)` trả mảng node React Flow `{ id, type: 'table', position, selected, data: { tableId } }`. Node của bảng nào có `table`, `selected` và vị trí tạm không đổi thì **dùng lại đúng object node cũ**. Sửa cột của bảng A không tạo node mới cho bảng B.
- `toRelationEdges(relations, tables, selection, issueIndex, previousEdges)` làm tương tự cho edge. Edge chỉ được tạo lại khi quan hệ, lựa chọn, trạng thái issue của nó, hoặc vị trí **đã lưu** (`table.position` trong tài liệu, không phải `dragPositions`) của một trong hai bảng đầu (dùng để chọn cạnh handle) thay đổi. Vì vậy cạnh trái, phải của handle chỉ đổi khi thả bảng; trong lúc kéo, đường edge vẫn bám theo node vì React Flow tính đường từ tọa độ handle. Lý do: không phải dựng lại edge ở mỗi khung hình khi kéo, và chữ ký `toRelationEdges` giữ nguyên, không nhận `dragPositions`.
- `TableNode` và `RelationEdge` được bọc `memo` (React Flow yêu cầu cho custom node). `data` chỉ chứa id; component tự đọc lát cắt hẹp:
  - `TableNode`: `useEditorStore((s) => s.document.tables[tableId])`.
  - `ColumnRow` (`memo`): `useEditorStore((s) => s.document.columns[columnId])`.
  - Dấu khóa ngoại: selector trả boolean, từ chỉ mục cột khóa ngoại được memo theo tham chiếu `document.relations`.
  - Dấu issue: selector trả số issue (primitive), từ `issuesByElement`.
- Selector không trả object mới ở mỗi lần gọi (Zustand 5 sẽ render lặp). Khi cần nhiều giá trị thì dùng `useShallow`.
- `nodeTypes`, `edgeTypes` và các callback truyền cho `<ReactFlow>` được khai báo ở cấp module hoặc bằng `useCallback`, để tham chiếu ổn định.

Test ở mục 14 kiểm tra việc dùng lại object (`toBe`) và số lần render.

## 6. Undo, redo

### Gộp thao tác

| Nguồn | Khi nào dispatch | Gộp |
|---|---|---|
| Ô nhập một dòng (tên, độ dài, literal mặc định, giá trị enum, vị trí X, Y của bảng) | Blur, hoặc Enter khi không đang gõ bằng IME (`event.isComposing` là `false`). Escape trả ô về giá trị hiện tại, không dispatch | Không cần: một lần commit là một mục |
| Textarea (comment) | Blur. Enter xuống dòng | Không cần |
| Checkbox, select, combobox | Mỗi lần đổi | Không |
| Nút lên, xuống, thêm, xóa | Mỗi lần bấm | Không |
| Kéo node bằng chuột | `onNodeDragStop`, một `moveElements` | Không cần |
| Di chuyển node bằng phím mũi tên | Mỗi lần nhấn, với `coalesce: 'keyboardMove'` | Gộp với mục cuối nếu mục cuối cũng là `keyboardMove` trên cùng tập bảng và chưa có dispatch nào khác xen giữa |

Gộp một mục nghĩa là thay mục cuối của `past` bằng `{ operation: operation mới nhất, inverse: inverse của mục cũ }`. Kết quả vẫn đúng hợp đồng nghịch đảo, vì cả hai đều là `moveElements` trên cùng tập id: áp `inverse` cũ lên trạng thái cuối đưa các bảng về vị trí trước lần nhấn đầu tiên. Core chưa có hàm cho việc thay mục cuối (xem [Vấn đề với spec phần 2](#vấn-đề-với-spec-phần-2), mục 2).

IME tiếng Việt (Telex, VNI) dùng composition, nên Enter kết thúc composition không được commit ô nhập.

### Phím tắt

| Thao tác | macOS | Windows, Linux |
|---|---|---|
| Undo | `⌘Z` | `Ctrl+Z` |
| Redo | `⌘⇧Z` | `Ctrl+Shift+Z`, `Ctrl+Y` |
| Xóa lựa chọn trên canvas | `Delete`, `⌫` | `Delete`, `Backspace` |

- Ở phần 3 chỉ có ba phím tắt này. Các phím tắt còn lại và màn hình xem danh sách phím tắt thuộc UX-03 (phần 9).
- Hook `useEditorShortcuts(store)` gắn listener `keydown` trên `window` khi editor mount, gỡ khi unmount.
- Hàm thuần `shouldHandleShortcut(event, { requiresCanvasFocus })` quyết định có xử lý hay không, và có unit test. Bỏ qua khi: `event.defaultPrevented`; `event.isComposing`; target là `input`, `textarea`, `select` hoặc phần tử `contenteditable`; đang có hộp thoại mở, tức hộp thoại "Tạo quan hệ" đang mở hoặc target nằm trong phần tử `[role="dialog"]`, `[role="alertdialog"]` (phủ hộp thoại đổi tên schema, có state mở riêng trong toolbar; plan phần 3, Vấn đề 81). Trong ô nhập, `Ctrl+Z` và `Backspace` giữ hành vi văn bản mặc định của trình duyệt.
- Undo, redo chạy khi focus ở bất kỳ đâu trong editor. Xóa dùng `requiresCanvasFocus: true`, chỉ chạy khi focus nằm trong vùng canvas hoặc ở `body`, để nhấn `Backspace` khi đang focus một nút trong panel không xóa bảng.

### Lịch sử sau khi tải lại trang

**Quyết định:** lịch sử chỉ nằm trong bộ nhớ; tải lại trang, đóng tab hay mở schema khác thì lịch sử bắt đầu rỗng. Tài liệu vẫn được lưu đầy đủ (mục 7).

**Lý do:** ED-13 và ST-01 không yêu cầu undo qua các lần tải trang. Lưu lịch sử phải giữ lịch sử và tài liệu nhất quán qua mỗi lần ghi, giới hạn dung lượng, và bỏ lịch sử khi tài liệu được migrate (spec phần 2, mục 11). Lịch sử phiên bản ST-06 (phần 8) mới là cách quay lại trạng thái cũ lâu dài.

**Phương án bị loại:** lưu `History` vào một bảng Dexie theo schema. `architecture.md` có nhắc tới lưu lịch sử operation như một lý do chọn Dexie; nếu cần thì thêm sau bằng một version mới của DB mà không đổi thiết kế store.

## 7. Lưu local (ST-01)

### Database

```ts
type SchemaRecord = {
  readonly id: string;          // crypto.randomUUID(), cũng là schemaId trên URL
  readonly name: string;        // bản sao của document.name, ghi cùng transaction
  readonly createdAt: number;   // epoch ms
  readonly updatedAt: number;
};
type DocumentRecord = { readonly schemaId: string; readonly document: unknown };
type ViewportRecord = { readonly schemaId: string; readonly x: number; readonly y: number; readonly zoom: number };

db.version(1).stores({
  schemas: 'id, updatedAt',
  documents: 'schemaId',
  viewports: 'schemaId',
});
```

- DB tên `schemaforge`, khai báo trong `lib/storage/database.ts`, typed bằng `EntityTable`.
- **Tách ba bảng:** màn hình danh sách chỉ đọc `schemas`, không phải tải mọi tài liệu (schema 1.500 cột khoảng vài trăm KB). Ghi viewport không ghi lại tài liệu và không đổi `updatedAt`, nên pan canvas không đẩy schema lên đầu danh sách.
- `name` trong `schemas` là bản sao để hiển thị, luôn lấy từ `document.name` và ghi trong cùng transaction với tài liệu; nguồn gốc vẫn là tài liệu, đúng spec phần 2.
- `document` có kiểu `unknown` trong record, nên code không dùng được tài liệu nếu chưa parse.
- **Thời gian** lấy từ `clock: () => number` được truyền vào repository.
- **Đổi cấu trúc DB:** thêm `db.version(n + 1).stores(...)` kèm `.upgrade()`, không sửa version cũ. Mỗi version mới có test mở DB đã tạo ở version trước bằng `fake-indexeddb`. Migration của **định dạng tài liệu** không nằm ở đây: nó chạy trong `parseSchemaDocument`.
- Nội dung `db.version(1)` ở trên giữ nguyên vì đây là lịch sử đã phát hành. Phần 4 thêm `db.version(2)`: `schemas` có thêm `ownerId`, `cloudRevision`, `syncStatus`, và có bảng `session` mới; toolbar thêm trạng thái cloud; màn hình danh sách có hai phần khi đã đăng nhập ("Schema của bạn", "Chỉ trên trình duyệt này") ([spec phần 4](2026-09-15-auth-cloud-design.md), mục 7).

### Đọc: luôn qua `parseSchemaDocument`

- `SchemaRepository.open(schemaId)` đọc `DocumentRecord` rồi gọi `parseSchemaDocument(record.document)`. Lỗi được trả về cho màn hình editor (mục 1); repository không bao giờ tự ghi đè bản bị lỗi.
- Tài liệu version cũ được migrate trong bộ nhớ khi parse. Bản trên đĩa chỉ được ghi lại ở version mới khi có thay đổi đầu tiên; mở schema mà không sửa gì thì không ghi.
- Record của `schemas` và `viewports` được kiểm tra hình dạng bằng schema Zod nhỏ trong `lib/storage/`. Record sai hình dạng hiện thành "Schema không đọc được" (danh sách) hoặc bị bỏ qua (viewport).

### Ghi: autosave

- Tạo schema: một transaction ghi `schemas` và `documents`.
- **Sau mỗi lần tài liệu đổi tham chiếu** (dispatch thành công, undo, redo), `useAutosave` ghi ngay, không debounce. Mỗi lúc chỉ có một lần ghi: nếu đang ghi thì đánh dấu còn thay đổi, và khi lần ghi hiện tại xong thì ghi tài liệu mới nhất một lần nữa.
- Mỗi lần ghi là một transaction `rw` trên `documents` và `schemas`: thay `document`, cập nhật `name` và `updatedAt`.
- Toolbar hiện trạng thái lưu từ `saveStatus`.

**Lý do không debounce:** tài liệu chỉ đổi khi commit (blur, Enter, thả chuột), không đổi theo từng phím, nên số lần ghi thấp. Không có hàng đợi hẹn giờ thì đóng tab ngay sau một thao tác cũng không mất thay đổi, và test không cần giả lập đồng hồ.

**Phương án bị loại:** debounce khoảng 1 giây. Ít lần ghi hơn không đáng kể với tần suất commit như trên, nhưng đóng tab trong khoảng chờ sẽ mất thay đổi.

### Đổi tên và xóa từ màn hình danh sách

- **Đổi tên:** lấy khóa của schema (xem dưới), đọc tài liệu, `parseSchemaDocument`, `applyOperation(document, { type: 'renameSchema', name })`, rồi ghi tài liệu và `schemas.name` trong một transaction. Thao tác này không vào lịch sử undo của editor nào.
- **Xóa:** lấy khóa, sau khi người dùng xác nhận thì xóa bản ghi ở cả ba bảng trong một transaction.
- Nếu tài liệu không parse được thì không đổi tên được (hiện lỗi); xóa vẫn được.

### Cùng một schema ở hai tab

**Quyết định:** dùng Web Locks API, mỗi schema một khóa exclusive tên `schemaforge:schema:<schemaId>`.

- Editor thử lấy khóa với `ifAvailable: true`. Lấy được thì giữ khóa tới khi editor unmount. Không lấy được thì hiện trạng thái "đang mở ở tab khác" và xếp hàng một yêu cầu khóa thường. Khi tab kia đóng hoặc rời schema, yêu cầu này được cấp, editor đọc lại tài liệu từ DB rồi mới cho sửa.
- Đổi tên và xóa từ danh sách cũng lấy khóa với `ifAvailable: true`. Không lấy được thì hiện toast "Schema đang mở ở tab khác" và không làm gì.
- Web Locks được truyền vào qua interface `SchemaLockManager`, nên test dùng bản giả.

**Lý do:** cách này ngăn trường hợp hai tab ghi đè thay đổi của nhau ngay từ đầu, thay vì phát hiện xung đột rồi bắt người dùng chọn. Khóa tự nhả khi tab đóng hoặc crash. Web Locks có trên mọi trình duyệt mà Next.js 16 hỗ trợ (Chrome 111+, Firefox 111+, Safari 16.4+).

**Phương án bị loại:**

- Số revision và kiểm tra khi ghi: hai tab vẫn sửa song song, và một tab mất thay đổi khi phát hiện xung đột.
- Cho phép "chiếm quyền" (`steal`): tab bị chiếm có thể còn một lần ghi đang chạy, cần thêm cơ chế đồng bộ.

### Lỗi lưu trữ

Hàm thuần `toStorageErrorCode(error: unknown): StorageErrorCode` ánh xạ lỗi của Dexie và IndexedDB:

| Tên lỗi | `StorageErrorCode` | Thông báo (tóm tắt) |
|---|---|---|
| `QuotaExceededError` (kể cả khi nằm trong `inner` của lỗi Dexie) | `quota-exceeded` | Bộ nhớ trình duyệt đã đầy; xóa bớt schema rồi thử lại |
| `MissingAPIError`, `OpenFailedError`, `InvalidStateError` | `unavailable` | Trình duyệt không cho dùng bộ nhớ local (ví dụ chế độ riêng tư) |
| `VersionError`, sự kiện `versionchange` | `outdated-tab` | SchemaForge đã được cập nhật ở tab khác; tải lại trang |
| `DatabaseClosedError` | `closed` | Kết nối bộ nhớ đã đóng; tải lại trang |
| Lỗi khác | `unknown` | Không lưu được; thử lại |

- Không bao giờ hiện `error.message` gốc cho người dùng; mọi thông báo đi qua namespace `storage`. Logger ghi tên lỗi.
- Khi ghi lỗi: `saveStatus` thành `failed`, toast hiện thông báo kèm nút "Thử lại". Tài liệu và lịch sử trong bộ nhớ vẫn giữ, người dùng sửa tiếp được; lần dispatch sau tự thử ghi lại.
- Khi nhận `versionchange`: đóng kết nối, hiện hộp thoại chặn yêu cầu tải lại trang, không tự tải lại.

### Viewport

**Quyết định:** lưu viewport (`x`, `y`, `zoom`) theo schema vào bảng `viewports` ở `onMoveEnd` của React Flow (một lần ghi mỗi khi kết thúc pan hoặc zoom). Khi mở schema: có viewport đã lưu thì dùng làm `defaultViewport`; không có thì `fitView` sau lần đo node đầu tiên. Viewport không nằm trong tài liệu và không undo được (spec phần 2, mục 2).

**Hành vi đã chấp nhận:** khi mở schema, React Flow có thể gọi `onMoveEnd` mà người dùng chưa pan hay zoom, nên viewport được ghi một lần. Lần ghi này vô hại: nó chỉ đụng bảng `viewports`, không đổi tài liệu và không đổi `updatedAt`, nên không cần chặn.

**Lý do:** mở lại một schema lớn thì quay về đúng vùng đang làm, thay vì fit view ở mức zoom quá nhỏ để đọc. Bảng riêng giữ lần ghi viewport nhỏ và không đổi `updatedAt`.

**Phương án bị loại:** luôn `fitView` khi mở. Đơn giản hơn, nhưng mỗi lần mở schema lớn phải zoom và pan lại.

## 8. Theme (ED-12)

### Init Tailwind CSS và shadcn/ui

- Chạy `pnpm dlx shadcn@4.21.0 init` trong `frontend/`: Tailwind CSS 4 qua `@tailwindcss/postcss`, màu nền neutral, theme bằng CSS variables. File sinh ra: `components.json`, `postcss.config.mjs`, `src/app/globals.css` (`@import "tailwindcss"`, `@custom-variant dark (&:is(.dark *))`, token trong `:root` và `.dark`, `@theme inline`).
- Helper `cn` của shadcn nằm ở `src/lib/class-names.ts` (đặt qua `aliases.utils` trong `components.json`), không phải `lib/utils.ts`, vì `code-quality.md` cấm file `utils.ts` chung chung.
- Component shadcn được thêm khi có nơi dùng, vào `src/components/ui/`, và phải qua lint như code khác. Chuỗi có sẵn trong component sinh ra (ví dụ `<span className="sr-only">Close</span>` trong dialog) được đổi sang i18n.
- `prettier-plugin-tailwindcss` được thêm vào `.prettierrc.json` với `tailwindStylesheet` trỏ tới `frontend/src/app/globals.css`.

### Token

- Mọi màu lấy từ token của shadcn/ui (`background`, `foreground`, `card`, `muted`, `border`, `primary`, `destructive`, `ring`…), không có mã màu trong component.
- Token riêng của canvas được khai báo ở `:root` và `.dark` rồi đăng ký bằng `@theme inline`, theo cách shadcn/ui hướng dẫn: `--canvas-relation`, `--canvas-relation-selected`, `--canvas-key` (icon khóa chính), `--canvas-foreign-key`.
- React Flow nhận màu qua biến `--xy-*`, gán một lần trên `.react-flow` trong `globals.css`: `--xy-background-color`, `--xy-background-pattern-dots-color`, `--xy-node-background-color`, `--xy-node-color`, `--xy-node-border`, `--xy-node-boxshadow-selected`, `--xy-edge-stroke`, `--xy-edge-stroke-selected`, `--xy-edge-label-background-color`, `--xy-edge-label-color`, `--xy-connectionline-stroke`, `--xy-handle-background-color`, `--xy-handle-border-color`, `--xy-minimap-background-color`, `--xy-minimap-mask-background-color`, `--xy-minimap-node-background-color`, `--xy-selection-background-color`, `--xy-selection-border`. Vì các biến này trỏ về token của shadcn/ui, canvas đổi màu cùng lúc với phần còn lại.
- `<ReactFlow colorMode={preference}>` nhận `system`, `light` hoặc `dark`. React Flow tự theo `prefers-color-scheme` khi là `system`, nên class `dark` trên `.react-flow` luôn khớp với giao diện.

### Mặc định, ghi nhớ, không nháy

**Quyết định:**

- Có ba lựa chọn: Theo hệ thống, Sáng, Tối. Mặc định là **Theo hệ thống**.
- Lựa chọn lưu trong cookie `sf-theme` (`Path=/`, `Max-Age` 1 năm, `SameSite=Lax`, thêm `Secure` ở production), chỉ ghi khi người dùng chọn. Cookie không có hoặc giá trị lạ thì là `system`.
- Layout gốc render `<html data-theme-preference="…" suppressHydrationWarning>` và trong `<head>` một thẻ `<script src="/theme-init.js" nonce={nonce}>` đồng bộ (không `async`, không `defer`). `public/theme-init.js` là file tĩnh khoảng mười dòng: đọc `data-theme-preference`, thêm class `dark` khi là `dark`, hoặc khi là `system` và `matchMedia('(prefers-color-scheme: dark)')` khớp; đặt `style.colorScheme`. Script chạy trước khi `<body>` được vẽ, nên không nháy sai theme.
- `ThemeProvider` (client component) giữ lựa chọn trong React state, khởi tạo từ giá trị server truyền xuống. Đổi theme thì ghi cookie và cập nhật class `dark` trên `<html>`. Khi đang ở `system`, provider lắng nghe `matchMedia` và gỡ listener khi unmount.

**Lý do:** mặc định theo hệ thống nên người dùng dark mode không bị chói ở lần mở đầu tiên. Server không biết theme của hệ điều hành, nên cần một script chạy trước khi vẽ; đặt script trong file tĩnh có nonce thì hợp với CSP và không cần `dangerouslySetInnerHTML`. Script được render bởi Server Component ở layout gốc, không bao giờ mount lại ở client, nên không gặp lỗi script tag của React 19 như `next-themes`. Dùng cookie thay `localStorage` để theme và ngôn ngữ chung một cơ chế lưu lựa chọn mà server đọc được.

**Phương án bị loại:**

- `next-themes` 0.4.6: shadcn/ui hướng dẫn dùng, nhưng thư viện không được bảo trì từ 2025-05 và có lỗi mở với React 19.2 (mục Phiên bản).
- Chỉ CSS (`@media (prefers-color-scheme: dark)` với `:root:not(.light)`): không cần script, nhưng phải lặp lại toàn bộ token của `.dark` và tự định nghĩa lại variant `dark` của shadcn/ui, nên component shadcn thêm sau dễ lệch.
- Mặc định là Sáng, không có "Theo hệ thống": không cần script, nhưng người dùng dark mode bị chói ở lần mở đầu và phải tự chuyển.

## 9. i18n (UX-04)

### Chọn ngôn ngữ

**Quyết định:**

- Hai locale `vi`, `en`. Thứ tự xác định locale của một request:
  1. Cookie `sf-locale` là `vi` hoặc `en`.
  2. `negotiateLocale(acceptLanguage)`: hàm thuần, đọc header `Accept-Language` theo trọng số `q`, lấy locale được hỗ trợ đầu tiên theo subtag chính (`vi-VN` → `vi`).
  3. Không khớp thì `en` (`DEFAULT_LOCALE`).
- Cookie `sf-locale` có cùng thuộc tính như `sf-theme`, chỉ ghi khi người dùng chọn.
- Layout gốc render `<html lang={locale}>` và truyền `locale` xuống `I18nProvider`.
- Đổi ngôn ngữ: `i18n.changeLanguage`, ghi cookie, cập nhật `document.documentElement.lang`, rồi `router.refresh()` để phần do server render (tiêu đề trang) đổi theo. Client component không mount lại, nên editor giữ nguyên store và lịch sử undo.

**Lý do:** server render đúng ngôn ngữ ngay lần đầu, không nháy chuỗi. Người dùng Việt Nam thường có `vi` trong `Accept-Language`, còn trình duyệt không có cả `vi` lẫn `en` thì tiếng Anh dễ hiểu hơn.

**Phương án bị loại:**

- Locale trong URL (`/[locale]/...`): đổi segment gốc làm mount lại cả cây dưới layout, mất store và lịch sử undo của editor. Dữ liệu là của riêng từng người và nằm local, nên URL theo ngôn ngữ không có giá trị SEO. Link chia sẻ (phần 8) cũng nên mở theo ngôn ngữ của người xem.
- Nhận diện ngôn ngữ chỉ trên client (`i18next-browser-languagedetector`, `localStorage`): server render sai ngôn ngữ rồi đổi sau khi hydrate.

### Cấu hình

- `lib/i18n/create-i18n-instance.ts`: `createInstance({ lng, fallbackLng: 'en', supportedLngs: ['vi', 'en'], resources, defaultNS: 'common', interpolation: { escapeValue: false }, initAsync: false })`. Resource được bundle sẵn, nên i18next khởi tạo đồng bộ và `t` dùng được ngay ở lần render đầu, cả khi SSR lẫn khi hydrate.
- **Server:** `getServerTranslation(locale, namespace)` tạo instance mới cho mỗi lần gọi, dùng trong `generateMetadata` và `not-found.tsx`. Không có instance dùng chung ở cấp module, để các request không lẫn ngôn ngữ của nhau.
- **Client:** `I18nProvider` tạo instance một lần bằng `useState(() => createI18nInstance(locale))` rồi bọc `I18nextProvider`.
- `escapeValue: false` vì React đã escape text. Bản dịch không bao giờ đi qua `dangerouslySetInnerHTML`; chuỗi có định dạng inline dùng `<Trans>`.
- Cả hai locale nằm trong bundle client (ước tính dưới 30 KB chưa nén), nên đổi ngôn ngữ không cần trạng thái đang tải.

### Namespace và resource

| Namespace | Nội dung |
|---|---|
| `common` | Nút, nhãn dùng chung, theme, ngôn ngữ, trạng thái lưu |
| `schemaList` | Màn hình danh sách |
| `editor` | Toolbar, panel, hộp thoại, toast của editor |
| `canvas` | Nhãn và `aria-label` của node, edge, handle, minimap; `ariaLabelConfig` của React Flow |
| `issues` | Một key cho mỗi `IssueCode` |
| `errors` | Một key cho mỗi mã trong `ERROR_CODES` |
| `storage` | Một key cho mỗi `StorageErrorCode` |

- Resource viết bằng TypeScript: `lib/i18n/locales/en/<namespace>.ts` export object `as const`; `lib/i18n/locales/vi/<namespace>.ts` export object `satisfies LocaleNamespace<typeof en…>`, trong đó `LocaleNamespace<T>` ánh xạ cùng cây key với lá là `string`. Thiếu key hoặc thừa key trong `vi` là lỗi biên dịch.
- `issues` và `errors` ở cả hai locale thêm `satisfies Record<IssueCode, string>` và `Record<ErrorCode, string>`, nên thêm mã mới trong core mà chưa dịch thì frontend không biên dịch được.
- **Key có kiểu:** `lib/i18n/i18next.d.ts` khai báo `CustomTypeOptions` với `defaultNS` và `resources: typeof enResources`, theo ví dụ chính thức của react-i18next. Key sai là lỗi biên dịch; biến nội suy được suy ra từ chuỗi `as const`.
- Unit test (`it.each` trên danh sách key đã làm phẳng) kiểm tra mỗi key có chuỗi không rỗng ở cả hai locale và cùng tập biến `{{…}}`.
- Thời gian hiển thị bằng `Intl.DateTimeFormat(locale)`.

### Lint

| Mục đích | Công cụ | Cấu hình |
|---|---|---|
| Chuỗi hardcode | `eslint-plugin-i18next`, rule `i18next/no-literal-string` ở mức `error` | `framework: 'react'`, `mode: 'jsx-only'` (text trong JSX và giá trị thuộc tính JSX), áp cho `frontend/src/**/*.tsx` trừ file test. `jsx-attributes.exclude` chỉ gồm thuộc tính không hiển thị cho người dùng (`className`, `id`, `type`, `role`, `name`, `href`, `rel`, `target`, `htmlFor`, `data-.*`, các `aria-*` nhận id hoặc boolean, thuộc tính SVG, `variant`, `size`, `side`, `align`); `aria-label`, `title`, `placeholder`, `alt` vẫn bị kiểm tra. Plan chốt danh sách cuối |
| Accessibility | `eslint-plugin-jsx-a11y-x`, `configs.recommended` ở mức `error` | Áp cho `frontend/src/**/*.tsx`; `settings` ánh xạ component shadcn/ui sang phần tử gốc (`Button` → `button`, `Input` → `input`, `Label` → `label`) để rule kiểm tra được cả component bọc |

- `mode: 'jsx-only'` không bắt chuỗi truyền vào hàm, như toast. Vì vậy toast đi qua wrapper `notify({ titleKey, descriptionKey?, action? })`, chỉ nhận key đã có kiểu; `no-restricted-imports` cấm import `toast` từ `sonner` ngoài wrapper. `ariaLabelConfig` của React Flow được dựng từ `t`.
- **Phương án bị loại:** `mode: 'all'` báo lỗi mọi literal, kể cả discriminant của operation (`type: 'addTable'`), nên nhiễu. Lệnh `i18next-cli lint` và `eslint-plugin-jsx-a11y` gốc: xem mục Phiên bản.

## 10. Zoom, pan, minimap, fit view (ED-09, ED-10)

- Dùng mặc định của React Flow: kéo nền để pan; con lăn chuột hoặc cuộn hai ngón trên trackpad để zoom; chụm hai ngón để zoom. Chuột và trackpad cho cùng kết quả.
- `minZoom` 0,1 và `maxZoom` 2, khai báo bằng hằng có tên.
- Toolbar của ứng dụng có zoom out, zoom in (`zoomOut`, `zoomIn`) và fit view (`fitView({ padding: 0.2 })`). Không dùng component `<Controls>` của React Flow, để mọi nút nằm chung một toolbar, cùng style và bản dịch.
- Hiệu ứng chuyển viewport dài 200 ms, và bằng 0 khi `prefers-reduced-motion: reduce`.
- `<MiniMap pannable zoomable />` ở góc dưới phải canvas: hiển thị mọi bảng và khung vùng đang xem; bấm hoặc kéo trên minimap để di chuyển. Màu lấy từ biến `--xy-minimap-*`; nhãn qua `ariaLabelConfig['minimap.ariaLabel']`.
- `<Background variant="dots" />`, màu lấy từ `--xy-background-pattern-dots-color`.
- `onlyRenderVisibleElements` mặc định tắt; chỉ bật nếu đo hiệu năng ở mục 13 không đạt, vì bật lên thì node và edge hiện trễ khi pan nhanh.

## 11. Bảo mật

### Content Security Policy

**Quyết định:** CSP có từ phần 3, dùng nonce theo từng request, sinh trong `src/proxy.ts` theo hướng dẫn CSP của Next.js 16:

| Directive | Giá trị |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self' 'nonce-<nonce>' 'strict-dynamic'`; thêm `'unsafe-eval'` chỉ khi development |
| `style-src` | `'self' 'unsafe-inline'` |
| `img-src` | `'self' blob: data:` |
| `font-src` | `'self'` |
| `connect-src` | `'self'` |
| `object-src` | `'none'` |
| `base-uri` | `'self'` |
| `form-action` | `'self'` |
| `frame-ancestors` | `'none'` |
| `upgrade-insecure-requests` | chỉ ở production |

- Hàm thuần `buildContentSecurityPolicy({ nonce, isDevelopment })` nằm trong `lib/security/`, có unit test. `proxy.ts` đặt header CSP cho request (để Next.js tự gắn nonce vào script của nó) và cho response, và đặt `x-nonce` cho layout. `matcher` bỏ qua `_next/static`, `_next/image`, favicon và request prefetch, theo tài liệu Next.js.
- `isDevelopment` đọc từ `src/lib/env.ts`. Module này được tạo ở phần 3 thay vì phần 4 như spec phần 1 dự kiến, vì proxy cần nó.
- `style-src` cho `'unsafe-inline'` vì Radix (qua `react-remove-scroll`), Sonner và React Flow chèn thẻ `<style>` hoặc thuộc tính `style` lúc chạy mà không nhận nonce. Chèn CSS rủi ro thấp hơn nhiều so với chèn script, còn script, nguồn XSS chính, vẫn bị khóa bằng nonce.
- Frontend gọi `z.config({ jitless: true })` trong module cấu hình được import đầu tiên ở `AppProviders`. Module này phải được nạp trước `@schemaforge/core` và mọi module tạo schema Zod, vì Zod đọc `jitless` khi tạo schema chứ không phải khi parse, còn core tạo schema lúc được import. Nếu không, Zod 4 thử `new Function` để biên dịch schema và gây vi phạm CSP mỗi lần tải trang (xem [Vấn đề với spec phần 2](#vấn-đề-với-spec-phần-2), mục 3).
- Phần 4 thêm origin của backend vào `connect-src`, lấy từ env.

**Kiểm tra:**

- Unit test `buildContentSecurityPolicy`: đủ directive; nonce nằm trong `script-src`; `'unsafe-eval'` chỉ ở development; `upgrade-insecure-requests` chỉ ở production.
- Unit test `proxy.ts`: gọi `proxy` với `NextRequest` tạo trong test; response có header `Content-Security-Policy` và request chuyển tiếp có `x-nonce` cùng một nonce; hai request cho hai nonce khác nhau.
- Kiểm tra tay khi xong phần 3: `next build && next start`, mở danh sách và editor trên Chrome, tạo bảng, tạo quan hệ, đổi theme và ngôn ngữ. Tab Network có header CSP ở mọi trang; Console không có vi phạm CSP; file trong `_next/static` không đi qua proxy.

**Lý do chọn nonce ngay từ phần 3:** mọi route đã render động vì layout đọc cookie (mục 8, 9), nên nonce không tốn thêm gì. Thêm CSP sau khi đã có nhiều component dễ gặp vi phạm khó lần ra nguồn; bật từ đầu thì mọi vi phạm hiện ngay trong console khi phát triển.

**Phương án bị loại:**

- CSP tĩnh trong `next.config.ts` với `script-src 'unsafe-inline'`: không chặn được script inline bị chèn vào, là trường hợp CSP cần chặn nhất.
- Hash qua `experimental.sri`: tính năng còn thử nghiệm, và chỉ có lợi khi trang được sinh tĩnh, trong khi route ở đây luôn render động.

### Không gọi mạng

- Code của phần 3 không gọi mạng. Trong `frontend/src/`, `no-restricted-globals` cấm `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, và `no-restricted-properties` cấm `navigator.sendBeacon`. Phần 4 chỉ mở các API này cho `src/lib/api/`.
- Trên trình duyệt, `connect-src 'self'` chặn thêm mọi kết nối tới origin khác, kể cả từ thư viện.
- Vì vậy tiêu chí "không gọi server" của ST-01 được bảo đảm bằng lint, CSP và review, không bằng test đếm request.

### Nội dung do người dùng nhập

- Không có `dangerouslySetInnerHTML` ở bất kỳ đâu trong phần 3 (rule lint từ spec phần 1). Tên, comment, giá trị enum và kiểu custom luôn render dạng text React, kể cả trong tooltip, `title` và `aria-label`.
- Không có dữ liệu xác thực nào trong `localStorage` hay cookie ở phần 3. Hai cookie `sf-theme`, `sf-locale` chỉ chứa lựa chọn giao diện và bị bỏ qua nếu giá trị không nằm trong danh sách cho phép.
- `schemaId` trên URL và dữ liệu đọc từ IndexedDB được coi là không tin cậy và luôn được kiểm tra (mục 1, 7).

## 12. Accessibility

- **Mục tiêu: WCAG 2.2 mức AA** (người dùng chốt ngày 2026-09-15, ghi ở `architecture.md`). WCAG 2.2 là W3C Recommendation (bản ngày 2024-12-12), bao trùm WCAG 2.1 và bỏ tiêu chí 4.1.1 Parsing. Tiêu chí mức AAA (gồm 2.4.12, 2.4.13, 3.3.9) không bắt buộc. Mục này thiết kế cho các tiêu chí mới ở mức A và AA của 2.2 trong phạm vi phần 3; tiêu chí 3.3.8 và 3.3.7 của form đăng nhập, đăng ký nằm ở [spec phần 4](2026-09-15-auth-cloud-design.md), mục 6.
- **Landmark:** `<header>` chứa toolbar; hai `<aside>` cho panel trái và panel phải, có `aria-label` đã dịch; `<main>` chứa canvas. Đầu `<main>` có skip link "Bỏ qua canvas", chuyển focus tới panel thuộc tính (hoặc panel trái nếu chưa chọn gì).
- **Thứ tự tab:** toolbar → panel trái → canvas (node, edge theo thứ tự của React Flow) → panel phải. Toolbar là các nút thường trong thứ tự tab, không dùng `role="toolbar"`, vì role này đòi điều hướng bằng phím mũi tên.
- **Mọi thao tác kéo có hai đường thay thế**, vì đây là hai tiêu chí riêng và phải đạt cả hai:
  - WCAG 2.5.7 Dragging Movements (AA): làm được bằng một con trỏ **mà không kéo**, tức bấm hoặc chạm. Phím tắt hay phím mũi tên không thỏa tiêu chí này.
  - WCAG 2.1.1 Keyboard (A): làm được chỉ bằng bàn phím.

| Thao tác kéo | Con trỏ, không kéo (2.5.7) | Bàn phím (2.1.1) |
|---|---|---|
| Di chuyển bảng | Ô "Vị trí" X, Y trong panel bảng (mục 2) | Phím mũi tên trên node đang được chọn (có sẵn trong React Flow; `Shift` + mũi tên đi bước gấp 4); ô "Vị trí" |
| Nối quan hệ từ handle sang handle | Nút "Thêm quan hệ" trong panel bảng | Nút "Thêm quan hệ" |
| Chọn nhiều bằng kéo khung | Bấm từng node, edge kèm phím chọn nhiều (mục 3). Mọi thao tác trên nhiều phần tử (xóa, di chuyển) cũng làm được trên từng phần tử | Tab tới từng phần tử và thao tác trên từng phần tử |
| Pan canvas bằng kéo nền, kéo trên minimap | Nút zoom in, zoom out, fit view trên toolbar; bấm một dòng trong tab "Bảng" đưa bảng vào giữa khung nhìn | Các nút và tab trên; focus một node hay edge thì phần tử được đưa vào khung nhìn (mục "Focus không bị che" bên dưới) |

Chọn bảng bằng bàn phím: dòng trong tab "Bảng" ở panel trái, hoặc Tab tới node rồi Enter hoặc Space. Phần 3 không có thao tác kéo nào khác: sắp xếp cột, giá trị enum và cột của index chỉ dùng nút lên, xuống; panel thu gọn bằng nút, không đổi kích thước bằng kéo. Thao tác kéo mới ở các phần sau (vùng thả file ở phần 7, khung subject area và ghi chú ở phần 9) phải có đủ hai đường thay thế trong spec của phần đó.

- **React Flow:** `nodesFocusable`, `edgesFocusable` bật; `ariaLabelConfig` được dựng từ namespace `canvas` cho mọi key có hiển thị: `node.a11yDescription.default`, `node.a11yDescription.keyboardDisabled`, `node.a11yDescription.ariaLiveMessage` (hàm nhận `direction`, `x`, `y`), `edge.a11yDescription.default`, `minimap.ariaLabel`, `handle.ariaLabel`. Node và edge có `ariaLabel` riêng (mục 3).
- **Hộp thoại:** dùng `Dialog` và `AlertDialog` của shadcn/ui (Radix): giữ focus bên trong, đóng bằng Escape, trả focus về nút đã mở. Hộp thoại "Tạo quan hệ" mở từ thao tác kéo không có nút mở, nên khi đóng thì trả focus về node nguồn; node nguồn không còn thì về vùng canvas (`<main tabIndex={-1}>` bọc canvas).
- **Quản lý focus:** thêm bảng thì focus ô tên trong panel; thêm cột, index, giá trị enum thì focus ô tên mới; xóa phần tử bằng nút hoặc phím `Delete` thì focus về vùng canvas; bấm issue thì focus trường có lỗi.
- **Nhìn thấy focus:** dùng token `ring` cho mọi phần tử tương tác, kể cả node, edge (`:focus-visible`) và dòng trong panel.
- **Không chỉ dựa vào màu:** khóa, khóa ngoại, unique, nullable, issue, loại quan hệ đều có icon hoặc ký hiệu kèm text cho trình đọc màn hình.
- **Focus không bị che** (WCAG 2.4.11, AA): phần tử đang có focus bàn phím không bị nội dung của ứng dụng che hoàn toàn.
  - Toolbar, hai panel và canvas là các ô của bố cục, không nổi đè lên nhau. Trong panel không có tiêu đề dính (`sticky`) đè lên nội dung cuộn.
  - Toast (Sonner) đặt ở `bottom-center`, nổi trên vùng canvas thay vì đè lên panel phải như vị trí mặc định `bottom-right`.
  - Trên canvas, minimap và vùng toast nổi đè lên node và edge, và node hay edge nhận focus có thể nằm ngoài khung nhìn. Hook `useRevealFocusedElement` nghe `focusin` trong canvas. Khi phần tử nhận focus là node hoặc edge và khớp `:focus-visible`, hàm thuần `isFocusTargetObscured(target, canvas, overlays)` nhận `DOMRect` của phần tử, của vùng canvas và của các overlay (minimap, vùng toast), trả `true` khi phần giao của phần tử với canvas rỗng hoặc nằm trọn trong một overlay. Khi đó canvas gọi `setCenter` của `ViewportControls` (mục 14) tới tâm phần tử, đổi sang tọa độ canvas theo viewport hiện tại, giữ mức zoom, hiệu ứng 200 ms hoặc 0 khi `prefers-reduced-motion: reduce` (mục 10). Bị che một phần thì không pan.
  - `autoPanOnNodeFocus` của React Flow 12.11.6 (mặc định bật) chỉ pan khi node nằm hoàn toàn ngoài khung nhìn, không xét minimap và không áp cho edge, nên được tắt (`autoPanOnNodeFocus={false}`) để hai cơ chế không chạy chồng.
  - Hộp thoại Radix là modal và giữ focus bên trong. Popover, dropdown menu và tooltip đóng khi focus rời đi, nên không che phần tử đang focus bên ngoài.
- **Kích thước mục tiêu bấm** (WCAG 2.5.8, AA): mọi mục tiêu bấm do ứng dụng vẽ có kích thước tối thiểu 24×24 CSS px.
  - Nút icon không nhỏ hơn size `icon-xs` của shadcn/ui (`size-6`, 24 px); nút icon trên toolbar dùng size `icon` (36 px) hoặc `icon-sm` (32 px).
  - `Checkbox` của shadcn/ui vẽ ở `size-4` (16 px). Component `ui` có phần tử bấm nhỏ hơn 24 px được mở rộng vùng bấm thành tối thiểu 24×24 px bằng pseudo-element nằm trên chính phần tử, không đổi kích thước hiển thị.
  - `RelationEdge` truyền `interactionWidth={24}` cho `BaseEdge` (mặc định của React Flow là 20 px).
  - Handle của node (React Flow vẽ 6×6 px) dùng ngoại lệ "Equivalent" của tiêu chí: nối quan hệ làm được bằng nút "Thêm quan hệ", là nút đạt 24 px. Link nằm trong câu văn dùng ngoại lệ "Inline".
- **Trợ giúp nhất quán, không bắt nhập lại** (WCAG 3.2.6 và 3.3.7, mức A): phần 3 không có cơ chế trợ giúp nào nên 3.2.6 chưa áp dụng; khi một phần sau thêm trợ giúp lặp lại trên nhiều màn hình (ví dụ danh sách phím tắt UX-03 ở phần 9), trợ giúp nằm cùng vị trí tương đối trên màn hình danh sách và editor. Phần 3 không có quy trình nhiều bước bắt nhập lại thông tin đã nhập; hộp thoại "Tạo quan hệ" điền sẵn theo điểm kéo và lựa chọn hiện tại.
- **Kiểm tra tự động:** lint `jsx-a11y-x`; test component truy vấn theo role và label; helper `expectNoAxeViolations(container)` gọi `axe.run` của axe-core 4.13.0 với tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` trong test component của màn hình danh sách, editor, các panel và hộp thoại, ở cả hai theme; test component chỉ dùng bàn phím qua `user-event` (mục 14).
  - Tag của axe không cộng dồn: `wcag22aa` chỉ gắn cho rule của tiêu chí mới trong 2.2, nên danh sách phải có đủ tag của 2.0, 2.1 và 2.2. Kiểm tra ngày 2026-09-15 bằng `axe.getRules()` trên axe-core 4.13.0 đã cài: `wcag22aa` chỉ có rule `target-size` (2.5.8); không rule nào mang tag `wcag22a`, nên tag này không được liệt kê.
  - Rule `target-size` cần bố cục thật. Trên jsdom rule cho kết quả đạt giả (thử ngày 2026-09-15: nút 10×10 px vẫn nằm trong `passes`), nên helper tắt rule này cùng với `color-contrast`.
  - Tiêu chí mới ở mức A và AA của WCAG 2.2 được kiểm tra như sau:

| Tiêu chí | axe trên jsdom | Unit test, test component | Kiểm tra tay |
|---|---|---|---|
| 2.4.11 Focus Not Obscured (Minimum), AA | Không có rule | `isFocusTargetObscured`; canvas gọi `setCenter` khi node hoặc edge nhận focus bị che (rect được giả trong test) | Tab qua node nằm dưới minimap, nằm ngoài khung nhìn, và khi toast đang hiện |
| 2.5.7 Dragging Movements, AA | Không có rule | Ô "Vị trí" dispatch `moveElements`; nút "Thêm quan hệ", zoom, fit view; bấm dòng tab "Bảng" đưa bảng vào giữa | Làm mọi thao tác trong bảng thay thế kéo chỉ bằng bấm chuột |
| 2.5.8 Target Size (Minimum), AA | Rule `target-size` bị tắt vì đạt giả trên jsdom | Không | Đo bằng Chrome DevTools: nút icon, checkbox, edge |
| 3.2.6 Consistent Help, A | Không có rule | Không áp dụng ở phần 3 | Không áp dụng ở phần 3 |
| 3.3.7 Redundant Entry, A | Không có rule | Hộp thoại "Tạo quan hệ" điền sẵn (mục 14) | Không |
| 3.3.8 Accessible Authentication (Minimum), AA | Không có rule | Phần 4 | Phần 4 |

- **Kiểm tra tay:** jsdom không tính style và bố cục, nên rule `color-contrast` và `target-size` của axe bị tắt trong test. Độ tương phản được kiểm tra tay trên các cặp token chữ và nền của cả hai theme (mục 8) bằng công cụ đo tương phản của Chrome DevTools, với ngưỡng 4.5:1 cho chữ thường và 3:1 cho icon, viền và vòng focus. Vòng focus có nhìn thấy không và thứ tự tab qua canvas cũng được kiểm tra tay trên Chrome. Kích thước mục tiêu bấm, focus không bị che và các đường thay thế kéo được kiểm tra tay theo bảng ở trên.

## 13. Hiệu năng

**Tải chuẩn:** fixture `makeLargeSchema({ tables: 100, columnsPerTable: 15, relations: 150 })`, dựng bằng factory của core, gồm 100 bảng, 1.500 cột và 150 quan hệ.

| Chỉ tiêu | Ngưỡng | Cách kiểm tra |
|---|---|---|
| Sửa tên một cột | Không `TableNode` nào khác render lại; trong node của bảng đó chỉ `ColumnRow` của cột bị sửa render lại | Vitest + React Testing Library, đếm render bằng `onRender` của `React.Profiler` trên fixture chuẩn. Chạy trong CI |
| Mapper node, edge | Sửa một bảng thì 99 object node còn lại giữ nguyên tham chiếu (`toBe`); edge không liên quan cũng vậy | Vitest. Chạy trong CI |
| Commit tên cột, undo, redo | INP ≤ 200 ms | Đo tay |
| Kéo một bảng | Trung bình ≥ 30 fps | Đo tay |
| Mở schema tới lúc tương tác được | ≤ 2 s | Đo tay |

**Cách đo tay:** chạy bản build production (`next build && next start`) và mở Chrome trực tiếp. Script `pnpm --filter @schemaforge/frontend perf:snippet` (`frontend/scripts/print-large-schema-snippet.ts`) in ra một đoạn JavaScript chứa fixture chuẩn. Mở trang danh sách một lần để app tạo database, dán đoạn đó vào Console của DevTools để ghi fixture vào IndexedDB bằng API IndexedDB gốc, tải lại trang rồi mở schema. Đo bằng tab Performance của DevTools với CPU chậm 4×. Kết quả ghi vào PR của bước cuối trong plan. Không đạt thì bật `onlyRenderVisibleElements` rồi đo lại, sau đó mới profile tìm nguyên nhân khác.

Không đo thời gian tự động trong CI, vì máy CI dao động và gây test chập chờn.

## 14. Test

Người dùng quyết định phần 3 **không có test chạy trên trình duyệt**. Mọi test chạy bằng Vitest trên jsdom, gồm ba loại: unit test, component test (React Testing Library + `@testing-library/user-event`), và test tích hợp dựng màn hình thật cùng store và `SchemaRepository` trên `fake-indexeddb`.

Mock chỉ ở biên: IndexedDB (`fake-indexeddb`), Web Locks (bản giả của `SchemaLockManager`), `matchMedia`, `document.cookie`, router của Next.js (`next/navigation`), cùng `ResizeObserver` và `DOMMatrixReadOnly` cho React Flow trong jsdom. Id lấy từ bộ đếm, thời gian từ `clock` được truyền vào. Factory và fixture lấy từ `@schemaforge/core/testing`.

### Unit

| Đối tượng | Hành vi chính |
|---|---|
| `create-editor-store` | Dispatch thành công ghi một mục lịch sử; dispatch lỗi giữ nguyên tài liệu, lịch sử và gọi `notify`; undo, redo; gộp `keyboardMove` và không gộp khi có dispatch xen giữa; lựa chọn bỏ id đã bị xóa; kéo nhiều bảng là một mục |
| `to-table-nodes`, `to-relation-edges` | Dùng lại object; chọn cạnh handle theo vị trí, kể cả tự tham chiếu; loại quan hệ ra đúng marker và nhãn |
| `issue-index`, `resolve-issue-target` | Mọi tiền tố `path` ra đúng phần tử và biến nội suy |
| `build-add-table-operation`, `build-relation-operation`, `name-suggestions` | Batch thêm bảng không phát sinh issue; dùng cột có sẵn; tạo cột mới cho 1-n, 1-1 một cột và nhiều cột; tránh trùng tên; n-n gọi `buildManyToMany`; lỗi khi thiếu khóa chính |
| `build-delete-selection-operation` | Batch có quan hệ trước, bảng sau; chọn cùng lúc một bảng và quan hệ nối với nó thì vẫn áp thành công; một lần undo khôi phục tất cả; lựa chọn rỗng không tạo operation |
| `is-focus-target-obscured` | Phần tử nằm ngoài canvas thì bị che; nằm trọn dưới minimap hoặc trong vùng toast thì bị che; bị minimap che một phần thì không |
| `should-handle-shortcut` | Tổ hợp phím theo nền tảng; bỏ qua ô nhập, `contenteditable`, IME, hộp thoại đang mở; `requiresCanvasFocus` chỉ cho phép khi focus ở canvas hoặc `body` |
| `schema-repository` | Tạo, liệt kê theo `updatedAt`, mở (parse thành công, lỗi cấu trúc, `version-unsupported`, không ghi đè), lưu, đổi tên bằng `renameSchema`, xóa cả ba bảng, lưu viewport |
| `use-autosave` | Mỗi lúc chỉ một lần ghi; thay đổi đến trong lúc ghi được ghi một lần ở cuối; `saveStatus` chuyển đúng khi lỗi |
| `schema-lock-manager`, `use-schema-lock` | Lấy được khóa; khóa đang bị giữ thì chờ và đọc lại tài liệu khi được cấp; nhả khóa khi unmount |
| `storage-error` | Mọi dòng trong bảng ánh xạ ở mục 7 |
| `negotiate-locale`, `preference-cookies` | Trọng số `q`, subtag, giá trị mặc định `en`; bỏ qua giá trị cookie lạ |
| `content-security-policy`, `proxy` | Như mục 11 |
| `theme-init.js` | Chạy nội dung file trong jsdom với `data-theme-preference` và `matchMedia` giả: `dark` thêm class, `light` không thêm, `system` theo `matchMedia` |
| Bản dịch | `it.each` trên key đã làm phẳng: chuỗi không rỗng ở cả hai locale, cùng tập biến `{{…}}` |

### Component

| Component | Hành vi chính |
|---|---|
| `SchemaListScreen` | Trạng thái rỗng; hộp thoại tạo có kiểm tra tên và chuyển trang; đổi tên; xóa phải xác nhận; toast khi schema đang mở ở tab khác; dòng không đọc được chỉ có Xóa |
| `EditorScreen` | Các trạng thái ở mục 1: không tìm thấy, đang mở ở tab khác, không đọc được |
| `Toolbar` | Undo, redo bị disable đúng lúc; tên truy cập đã dịch ở cả hai locale; trạng thái lưu và nút thử lại; nút zoom, fit view gọi đúng hàm của `ViewportControls` (interface bọc `useReactFlow`, được mock) |
| Panel bảng, dòng cột | Commit khi blur và Enter; Escape trả về giá trị cũ; Enter trong lúc IME composition không commit; không dispatch khi giá trị không đổi; checkbox khóa chính; combobox kiểu có nhóm enum; phần chi tiết chỉ hiện biểu thức mặc định hợp với kiểu; ô "Vị trí" commit một `moveElements`, giá trị không hợp lệ trả ô về giá trị cũ và không dispatch |
| Hộp thoại "Tạo quan hệ" | Điền sẵn theo handle nguồn và đích (test gọi handler kết nối của canvas với dữ liệu kết nối giả); chặn khi thiếu khóa chính; Enter xác nhận; focus trở về đúng chỗ khi đóng |
| Panel quan hệ, index, tab "Enum" | Luôn còn ít nhất một cặp cột và một cột index; nút xóa enum đang dùng bị disable và liệt kê cột |
| Tab "Vấn đề" | Thông báo đã dịch có tên phần tử; bấm thì chọn phần tử và focus trường lỗi |
| `TableNode` (trong `ReactFlowProvider`) | Dấu khóa, khóa ngoại, unique, nullable; `aria-label`; test đếm render ở mục 13 |
| `useRevealFocusedElement` | Node hoặc edge nhận focus bị che thì gọi `setCenter` của `ViewportControls` (được mock) với mức zoom hiện tại; không bị che thì không gọi |
| `ThemeSwitch`, `LanguageSwitch` | Ghi cookie; đổi class `dark` và `html[lang]` |
| Accessibility | `expectNoAxeViolations` (mục 12) trên danh sách, editor, panel bảng, panel quan hệ, hộp thoại "Tạo quan hệ", hộp thoại xóa schema, ở cả hai theme |

### Tích hợp: màn hình + store + repository

Các test này thay cho hành trình e2e của bản spec trước. Chúng render `SchemaListScreen` hoặc `EditorScreen` với `SchemaRepository` thật trên `fake-indexeddb`. "Tải lại trang" được giả lập bằng cách unmount màn hình rồi mount màn hình mới trên cùng database.

| # | Hành trình | Tính năng |
|---|---|---|
| 1 | Tạo schema từ danh sách; thêm hai bảng, thêm và sửa cột (kiểu, nullable, mặc định) qua panel; mount lại thì dữ liệu còn nguyên; đổi tên và xóa schema từ danh sách | ED-01, ED-02, ST-01 |
| 2 | Mở hộp thoại bằng nút "Thêm quan hệ": tạo 1-n có cột `users_id` mới và edge; đổi sang 1-1 thì nhãn đổi; tạo n-n ra bảng trung gian và hai quan hệ; một lần undo bỏ cả ba, redo khôi phục; kết quả được lưu | ED-03, ED-13, ST-01 |
| 3 | Index unique nhiều cột; enum làm kiểu cột; comment bảng và cột; hai bảng trùng tên thì có issue trên node và trong tab "Vấn đề"; sửa tên thì issue biến mất | ED-01, ED-04, ED-05, ED-06 |
| 4 | Gọi `onMoveEnd` với một viewport: repository lưu; mount lại thì canvas nhận viewport đã lưu làm `defaultViewport`; không có viewport thì gọi `fitView` | ED-09, ED-10 |
| 5 | Chọn Tối: cookie `sf-theme=dark`, `<html>` có class `dark`, `colorMode` của canvas là `dark`; "Theo hệ thống" với `matchMedia` giả báo tối thì ra Tối | ED-12 |
| 6 | Đổi sang English: chuỗi đổi, `html[lang="en"]`, cookie được ghi; vẫn undo được thao tác làm trước khi đổi ngôn ngữ | UX-04, ED-13 |
| 7 | Chỉ dùng bàn phím (`user-event`): tạo schema, thêm bảng, đổi tên, thêm cột, tạo quan hệ qua hộp thoại; `Mod+Z` ngoài ô nhập undo schema, trong ô nhập thì không; `Delete` khi focus ở canvas xóa bảng và quan hệ đang chọn trong một bước undo; `Delete` khi focus ở ô nhập hoặc khi hộp thoại đang mở không xóa gì | ED-01, ED-13, accessibility |
| 8 | Hai editor cùng một schema, dùng hai `SchemaLockManager` giả chung trạng thái: editor thứ hai hiện "đang mở ở tab khác", và cho sửa sau khi editor đầu unmount, với tài liệu đọc lại từ database | ST-01 |

### Không kiểm tra tự động được

Những mục sau cần trình duyệt thật. Chúng được kiểm tra tay theo checklist trong plan phần 3 trước khi đánh dấu phần 3 xong, và kết quả ghi vào PR của bước cuối.

| Hạng mục | Vì sao không tự động | Cách kiểm tra tay |
|---|---|---|
| Kéo bảng, kéo nối quan hệ, kéo nền, bấm và kéo minimap | jsdom không có bố cục; React Flow cần đo DOM và sự kiện con trỏ thật | Thao tác trên Chrome với bản `next start` |
| Zoom bằng con lăn chuột và trackpad | Như trên | Chuột và trackpad trên Chrome |
| Không nháy sai theme khi tải trang | jsdom không vẽ | Chọn Tối, tải lại trang với CPU chậm 4× |
| Độ tương phản, vòng focus nhìn thấy được | jsdom không tính style | Mục 12 |
| CSP có hiệu lực trên trình duyệt | jsdom không áp CSP | Mục 11 |
| Dữ liệu còn sau khi đóng và mở lại trình duyệt | `fake-indexeddb` chỉ nằm trong bộ nhớ | Chrome: tạo schema, đóng trình duyệt, mở lại |
| Hai tab thật với Web Locks | Test chỉ dùng khóa giả | Mở cùng schema ở hai tab Chrome |
| Mục tiêu bấm tối thiểu 24×24 CSS px (WCAG 2.5.8) | jsdom không có bố cục; rule `target-size` của axe đạt giả | Đo bằng Chrome DevTools nút icon, checkbox, edge ở toolbar, panel, canvas |
| Focus không bị minimap, toast che hoàn toàn (WCAG 2.4.11) | jsdom không có bố cục | Tab qua node nằm dưới minimap, nằm ngoài khung nhìn, và khi toast đang hiện; làm lại ở màn hình danh sách |
| Đường thay thế kéo bằng bấm (WCAG 2.5.7) | Cần sự kiện con trỏ thật | Chỉ bằng bấm chuột: di chuyển bảng bằng ô "Vị trí", tạo quan hệ bằng nút, xem mọi bảng bằng fit view và tab "Bảng" |
| Số đo hiệu năng | Mục 13 | Mục 13 |

### Coverage

Ngưỡng 80% số dòng của frontend (spec phần 1) được mở rộng thêm glob: `src/features/**/state/**`, `src/features/**/lib/**`, `src/features/**/hooks/**`, `src/proxy.ts`, cùng các glob đã có (`src/lib/**`, `use-*.ts`). Không tính: `src/components/ui/**` (sinh bởi shadcn), `src/lib/i18n/locales/**` (dữ liệu), `src/testing/**`, `scripts/**`, và file `*.tsx` (đã có test component nhưng không đặt ngưỡng).

## Cấu trúc thư mục

```text
frontend/
  components.json
  postcss.config.mjs
  public/theme-init.js
  scripts/print-large-schema-snippet.ts   chỉ dùng cho đo hiệu năng tay (mục 13)
  src/
    proxy.ts
    app/
      globals.css, layout.tsx, page.tsx, not-found.tsx
      schemas/[schemaId]/  page.tsx, loading.tsx, error.tsx
    components/
      ui/               component của shadcn/ui
      app-providers.tsx, theme-provider.tsx, i18n-provider.tsx,
      theme-switch.tsx, language-switch.tsx
    features/
      schema-list/      components/, hooks/
      editor/
        components/     editor-screen.tsx, editor-screen-loader.tsx, toolbar/,
                        canvas/ (table-node.tsx, column-row.tsx, relation-edge.tsx, relation-markers.tsx),
                        panels/, dialogs/
        state/          create-editor-store.ts, editor-store-provider.tsx, use-editor-store.ts
        lib/            to-table-nodes.ts, to-relation-edges.ts, issue-index.ts, resolve-issue-target.ts,
                        build-add-table-operation.ts, build-relation-operation.ts,
                        build-delete-selection-operation.ts, name-suggestions.ts,
                        should-handle-shortcut.ts, is-focus-target-obscured.ts
        hooks/          use-autosave.ts, use-editor-shortcuts.ts, use-schema-lock.ts,
                        use-reveal-focused-element.ts
    lib/
      class-names.ts, env.ts, logger.ts, notify.ts, zod-config.ts
      i18n/             create-i18n-instance.ts, server-translation.ts, negotiate-locale.ts,
                        i18next.d.ts, locales/en/, locales/vi/
      preferences/      preference-cookies.ts
      security/         content-security-policy.ts
      storage/          database.ts, records.ts, schema-repository.ts, storage-error.ts,
                        schema-lock-manager.ts
    testing/            expect-no-axe-violations.ts, render-with-providers.tsx, large-schema.ts
```

- `lib/logger.ts` là nơi duy nhất dùng `console` (tắt `no-console` kèm lý do). Logger chỉ ghi mã lỗi, loại operation và tên lỗi, không ghi nội dung schema.
- `features/schema-list` và `features/editor` không import lẫn nhau; phần dùng chung (lưu trữ, khóa, i18n) nằm ở `lib/`.
- `src/testing/` chỉ được import từ file test; `no-restricted-imports` chặn import từ code chạy thật.

## Vấn đề với spec phần 2

Spec phần 2 đã được duyệt. Năm điểm editor cần được bổ sung vào core trong [plan phần 2](../plans/2026-09-14-core-schema-model-plan.md). Plan phần 3 dùng tên hàm theo plan phần 2. Phương án dự phòng chỉ dùng nếu plan phần 2 bỏ một điểm nào đó.

| # | Điểm bổ sung trong plan phần 2 | Editor dùng ở | Dự phòng |
|---|---|---|---|
| 1 | Hàm dựng quan hệ 1-n, 1-1 kèm tạo cột khóa ngoại theo khóa chính của bảng đích, dùng chung quy tắc đặt tên và tránh trùng với `buildManyToMany`. Bản đầu (`buildRelation`) chỉ theo khóa chính; ngày 2026-09-17 user chốt thêm trường `referencedColumnIds` để tạo cột theo đúng cột được tham chiếu của mục 3 (plan phần 3, Vấn đề 70) | Mục 3 | Viết trong `features/editor/lib/build-relation-operation.ts` |
| 2 | Gộp mục cuối của lịch sử | Mục 6 | Frontend tạo `History` mới từ `past` |
| 3 | Ghi chú rằng môi trường có CSP phải gọi `z.config({ jitless: true })`, và core không tự gọi | Mục 11 | Frontend vẫn gọi `z.config` như mục 11 |
| 4 | `applyOperation` trả đúng tham chiếu của input khi operation không thay đổi gì | Mục 5 | Trường nhập liệu so giá trị trước khi dispatch (vẫn làm như vậy) |
| 5 | Entry point `@schemaforge/core/testing` | Mục 13, 14 | Frontend tự viết factory bằng operation của core |

## Rủi ro cần kiểm tra khi triển khai

- **Không có test trên trình duyệt.** Lỗi chỉ lộ ra trên trình duyệt thật (bố cục canvas, kéo thả, CSP chặn nhầm tài nguyên, nháy theme) chỉ được phát hiện bằng checklist kiểm tra tay ở mục 14. Checklist phải chạy xong trước khi đánh dấu phần 3 hoàn thành.
- **React Flow trong jsdom** cần giả `ResizeObserver` và `DOMMatrixReadOnly`, và không đo được node. Test component chỉ dựa vào phần không cần đo DOM: `data`, `aria-label`, handler được gọi trực tiếp. Điều khiển viewport đi qua interface `ViewportControls` để mock được.
- **Xóa bằng phím trong React Flow:** plan xác nhận `deleteKeyCode={null}` tắt hẳn bộ xử lý phím xóa, `onBeforeDelete` trả `false` chặn được mọi đường xóa nội bộ, và chuỗi sự kiện `onNodesChange` phân biệt được kéo chuột với phím mũi tên (mục 3).
- **`eslint-plugin-i18next`** không khai báo peer ESLint 10. Plan chạy thử rule trên ESLint 10.10.0 trước; nếu lỗi thì chạy `i18next-cli lint` như một bước riêng trong script `lint`.
- **`eslint-plugin-jsx-a11y-x` 0.2.0** còn mới. Plan so danh sách rule của `configs.recommended` với `flatConfigs.recommended` của bản gốc.
- **Script `theme-init.js`:** plan xác nhận React 19.3 render thẻ `<script>` đồng bộ đúng chỗ trong `<head>` của HTML SSR, không chuyển thành async, và không có cảnh báo khi hydrate hay khi `router.refresh()`.
- **Trình duyệt xóa dữ liệu:** IndexedDB ở chế độ best-effort có thể bị xóa khi thiếu dung lượng, và Safari xóa dữ liệu của site không được mở trong 7 ngày. Phần 3 không gọi `navigator.storage.persist()` vì Firefox hiện hộp thoại xin quyền. Bản sao lâu dài là export JSON (IE-06, phần 7) và lưu cloud (phần 4).
- **Focus bị che trên canvas:** plan xác nhận `autoPanOnNodeFocus={false}` tắt việc tự pan khi focus node của React Flow 12.11.6, `focusin` nổi lên từ edge SVG, `getBoundingClientRect` của edge trả đúng vùng, và vùng toast đo được qua phần tử `[data-sonner-toaster]`. Nếu kiểm tra tay thấy toast `bottom-center` che hoàn toàn phần tử đang focus ở màn hình danh sách, thêm `scroll-padding-bottom` cho vùng cuộn của màn hình đó.
- **`crypto.randomUUID`** chỉ có trong secure context (HTTPS hoặc `localhost`), nên môi trường deploy phải dùng HTTPS.

## Tiêu chí hoàn thành

Tiêu chí ghi "(kiểm tra tay)" được kiểm tra theo checklist ở mục 14; các tiêu chí còn lại có test Vitest.

- [ ] ED-01: Nút "Thêm bảng" tạo bảng có cột `id` là khóa chính; một lần undo bỏ cả bảng.
- [ ] ED-01: Đổi tên bảng trong panel (commit khi blur hoặc Enter) và xóa bảng từ panel.
- [ ] ED-01: Phím `Delete` hoặc `Backspace` khi focus ở canvas xóa các bảng và quan hệ đang chọn bằng một `batch`; một lần undo khôi phục tất cả; có toast "Hoàn tác". Phím không xóa gì khi đang gõ trong ô nhập, khi IME đang composition hoặc khi hộp thoại đang mở.
- [ ] ED-01: React Flow không tự xóa phần tử: mọi thao tác xóa đi qua `dispatch`.
- [ ] ED-01: Hai bảng trùng tên (không phân biệt hoa thường) hiện issue `table-name-duplicate` trên cả hai node và trong tab "Vấn đề"; sửa tên thì issue biến mất.
- [ ] ED-01: Xóa bảng thì mọi quan hệ nối với bảng biến mất; undo khôi phục bảng, cột, index và quan hệ.
- [ ] ED-02: Thêm, sửa, xóa và sắp xếp cột trong panel.
- [ ] ED-02: Sửa được tên, kiểu và tham số kiểu, nullable, giá trị mặc định (literal, `currentTimestamp`, `generateUuid`), unique, khóa chính, auto-increment.
- [ ] ED-02: Combobox kiểu có đủ 17 kiểu chung, các enum hiện có và kiểu custom.
- [ ] ED-02: Tick khóa chính trên nhiều cột tạo khóa chính nhiều cột; node hiện số thứ tự.
- [ ] ED-02: Hai cột trùng tên trong bảng hiện `column-name-duplicate`; auto-increment trên cột `text` hiện `column-auto-increment-invalid-type` ở checkbox và trên node.
- [ ] ED-03: Hộp thoại "Tạo quan hệ" tạo được 1-1, 1-n, n-n, mở được bằng nút "Thêm quan hệ" chỉ với bàn phím, và được điền sẵn khi mở từ thao tác kéo nối. Kéo nối trên canvas thật: kiểm tra tay.
- [ ] ED-03: Tạo quan hệ tới bảng có khóa chính nhiều cột với "Tạo cột mới" ra khóa ngoại nhiều cột cùng kiểu; panel quan hệ sửa được cặp cột, ON DELETE, ON UPDATE.
- [ ] ED-03: n-n tạo bảng trung gian và hai quan hệ 1-n; một lần undo bỏ cả ba; bảng trung gian thêm được cột như bảng thường.
- [ ] ED-03: Edge thể hiện 1-1 và 1-n bằng ký hiệu và nhãn khác nhau.
- [ ] ED-03: Cặp cột khác kiểu hiện `relation-column-type-mismatch` trên edge và trong panel quan hệ.
- [ ] ED-03: Xóa cột đang dùng trong quan hệ thì quan hệ biến mất; undo khôi phục.
- [ ] ED-04: Tạo, sửa (tên, danh sách cột có thứ tự, unique) và xóa index một hoặc nhiều cột.
- [ ] ED-04: Giao diện không tạo được index có cột không tồn tại hoặc không có cột nào; xóa cột thì index dùng cột đó bị xóa kèm, và undo khôi phục.
- [ ] ED-05: Tạo, sửa (tên, giá trị, thứ tự) và xóa enum trong tab "Enum"; chọn được enum làm kiểu cột.
- [ ] ED-05: Enum không có giá trị hiện `enum-values-empty`; giá trị trùng hiện `enum-value-duplicate`.
- [ ] ED-05: Nút xóa của enum đang dùng bị disable và liệt kê các cột dùng nó, nên giao diện không tạo được cột dùng enum không tồn tại.
- [ ] ED-06: Thêm, sửa, xóa comment của bảng và cột; node có icon comment kèm tooltip. Việc comment xuất hiện trong output của generator được kiểm tra ở phần 6.
- [ ] ED-09: Nút zoom in, zoom out, fit view gọi đúng API viewport; zoom bằng con lăn và trackpad, pan bằng kéo nền: kiểm tra tay.
- [ ] ED-10: Minimap được render với `pannable` và `zoomable`; minimap hiện mọi bảng, vùng đang xem, và bấm hoặc kéo để di chuyển: kiểm tra tay.
- [ ] ED-12: Chọn được Theo hệ thống, Sáng, Tối; mặc định là Theo hệ thống; lựa chọn được ghi vào cookie và được giữ khi mount lại.
- [ ] ED-12: `theme-init.js` đặt class `dark` đúng với cả ba lựa chọn (test jsdom); không nháy sai theme khi tải trang: kiểm tra tay.
- [ ] ED-12: axe-core (tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`) không có vi phạm trong test component ở cả hai theme; canvas, node, edge và minimap chỉ dùng token; độ tương phản của token ở cả hai theme đạt ngưỡng ở mục 12: kiểm tra tay.
- [ ] Accessibility (WCAG 2.2 AA): mọi thao tác kéo trong bảng ở mục 12 có đường thay thế bằng bấm không kéo và bằng bàn phím; ô "Vị trí" trong panel bảng dispatch một `moveElements`, undo được (test component). Làm chỉ bằng bấm chuột trên Chrome: kiểm tra tay.
- [ ] Accessibility (WCAG 2.2 AA): node hoặc edge nhận focus bàn phím mà nằm ngoài khung nhìn hoặc nằm trọn dưới minimap, vùng toast thì được đưa vào giữa khung nhìn (unit test `isFocusTargetObscured`, test `useRevealFocusedElement`); trên Chrome: kiểm tra tay.
- [ ] Accessibility (WCAG 2.2 AA): mọi mục tiêu bấm tối thiểu 24×24 CSS px, trừ handle của node và link trong câu theo ngoại lệ ở mục 12: kiểm tra tay.
- [ ] ED-13: Undo, redo mọi thay đổi schema làm từ canvas, panel và hộp thoại, bằng nút và phím tắt; phím tắt không chạy khi đang gõ trong ô nhập. Thay đổi do AI và import được kiểm tra ở phần 5 và 7.
- [ ] ED-13: Lịch sử chỉ chứa cặp operation và nghịch đảo do core trả về, không chứa bản sao schema; kéo nhiều bảng rồi thả là một mục lịch sử.
- [ ] ST-01: Schema còn nguyên khi màn hình được mount lại trên cùng database (test tích hợp); còn nguyên sau khi đóng rồi mở lại trình duyệt: kiểm tra tay.
- [ ] ST-01: Tạo, mở, đổi tên, xóa nhiều schema từ màn hình danh sách mà không cần tài khoản.
- [ ] ST-01: Khách không gọi mạng: lint cấm `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon` trong `frontend/src/`, và CSP có `connect-src 'self'`. Từ phần 4, `src/lib/api/**` là ngoại lệ của lint và `connect-src` thêm origin backend; tiêu chí này được kiểm bằng test tích hợp 7 ([spec phần 4](2026-09-15-auth-cloud-design.md), mục 11): khách không có hint không gọi `fetch` lần nào.
- [ ] ST-01: Tài liệu đọc từ IndexedDB luôn đi qua `parseSchemaDocument`; bản không parse được không bị ghi đè.
- [ ] ST-01: Editor thứ hai mở cùng schema hiện "đang mở ở tab khác" và không sửa được (test tích hợp với khóa giả); hai tab Chrome thật: kiểm tra tay.
- [ ] ST-01: Lỗi hết dung lượng và IndexedDB không dùng được hiện thông báo đã dịch; thay đổi trong bộ nhớ không mất và được thử ghi lại.
- [ ] UX-04: Đổi được giữa Tiếng Việt và English; lần đầu theo `Accept-Language`, không khớp thì `en`; cookie giữ lựa chọn; `html[lang]` đúng; đổi ngôn ngữ không mất lịch sử undo.
- [ ] UX-04: Thêm tạm một chuỗi JSX hoặc `aria-label` hardcode làm `pnpm lint` fail; xóa tạm một key trong `vi` hoặc bản dịch của một `IssueCode` làm `pnpm typecheck` fail.
- [ ] Bảo mật: unit test của `buildContentSecurityPolicy` và `proxy.ts` chạy qua; mọi trang có header CSP với nonce và Console không có vi phạm CSP: kiểm tra tay.
- [ ] Hiệu năng: test đếm render và test dùng lại object ở mục 13 chạy qua trong CI; số đo tay đạt ngưỡng và được ghi vào PR.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` (đạt ngưỡng coverage) và `pnpm build` chạy qua ở local và trong CI.
- [ ] Checklist kiểm tra tay ở mục 14 đã chạy xong, kết quả ghi vào PR.
- [ ] `architecture.md` và `roadmap.md` được cập nhật khi quyết định hoặc trạng thái phần 3 thay đổi.

## Phạm vi

**Trong phạm vi:** ED-01 đến ED-06, ED-09, ED-10, ED-12, ED-13, ST-01, UX-04; phím `Delete`, `Backspace` xóa lựa chọn trên canvas; init Tailwind CSS và shadcn/ui; i18n; theme; CSP; lint cho chuỗi hardcode, accessibility và gọi mạng; glob coverage cho store; unit test, component test và test tích hợp bằng Vitest.

**Ngoài phạm vi:**

| Hạng mục | Làm ở phần |
|---|---|
| Giao diện subject area (ED-07), ghi chú trên canvas (ED-08), auto-layout (ED-11), templates (UX-01), presentation mode (UX-02), phím tắt đầy đủ trừ Delete (UX-03) | 9 |
| Đăng ký, đăng nhập, lưu cloud, danh sách schema trên cloud | 4 |
| AI Assistant và hiển thị diff của AI | 5 |
| Panel sinh code | 6 |
| Import, export (kể cả JSON và ảnh) | 7 |
| Chia sẻ link, lịch sử phiên bản | 8 |

Không làm ở phần 3 và chưa có trong roadmap: test chạy trên trình duyệt, lưu lịch sử undo qua các lần tải trang, `navigator.storage.persist()`, sửa inline trong node, kéo thả để sắp xếp cột.

## Câu hỏi đã trả lời

Không còn câu hỏi mở.

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Trình duyệt không có cả `vi` lẫn `en` thì mặc định ngôn ngữ nào? | `en` |
| 2 | Có bật phím `Delete` trên canvas ở phần 3 không? | Có. `Delete`, `Backspace` xóa lựa chọn bằng một `batch`, không hỏi xác nhận, có toast "Hoàn tác". Các phím tắt còn lại vẫn ở phần 9 |
| 3 | Lịch sử undo có còn sau khi tải lại trang không? | Không |
| 4 | Các điểm editor cần từ core được xử lý ở đâu? | Trong plan phần 2 |
| 5 | Phần 3 có test chạy trên trình duyệt không? | Không; chỉ Vitest trên jsdom, phần còn lại kiểm tra tay |
| 6 | Mục tiêu accessibility là mức nào? (người dùng chốt ngày 2026-09-15, sau khi spec đã duyệt) | WCAG 2.2 mức AA. Spec được sửa tại chỗ ở mục 2, 3, 6, 12, 14, "Rủi ro" và "Tiêu chí hoàn thành" |
