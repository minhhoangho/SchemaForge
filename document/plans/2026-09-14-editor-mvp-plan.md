# Plan: Editor MVP

Plan triển khai phần 3 trong [roadmap.md](../roadmap.md), dựa trên spec đã duyệt [2026-09-14-editor-mvp-design.md](../specs/2026-09-14-editor-mvp-design.md) (commit b9bf16b). Spec là nguồn gốc: plan chỉ chia việc, chốt các chi tiết mức cài đặt mà spec để lại, và không đổi quyết định nào của spec. Chỗ spec còn hở hoặc mâu thuẫn với thực tế của thư viện được nêu ở mục [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan).

Plan được viết trong hai lượt. Lượt thứ nhất viết mọi mục chung, bảng task đầy đủ và nội dung chi tiết của các task loại A. Lượt thứ hai viết nội dung chi tiết của các task loại B trong mục [Task loại B](#task-loại-b), có thể tinh chỉnh tên, phụ thuộc và đợt của các dòng B trong bảng task, và bổ sung mục "Vấn đề phát hiện khi lập plan".

## Mục tiêu

`frontend/` có Visual Schema Editor chạy hoàn toàn trên trình duyệt: màn hình danh sách schema và màn hình editor (canvas React Flow, panel, hộp thoại), mọi thay đổi đi qua `dispatch` operation của core, undo/redo, lưu local bằng Dexie có khóa theo tab, theme sáng tối không nháy, i18n `vi`/`en` có key được kiểm tra kiểu, CSP có nonce. Phần này gồm ED-01 đến ED-06, ED-09, ED-10, ED-12, ED-13, ST-01 và UX-04.

User đã chốt khi duyệt spec: không có test chạy trên trình duyệt (không Playwright, Cypress, WebdriverIO, không Vitest browser mode); phím `Delete`/`Backspace` được bật ở phần 3 và đi qua `dispatch` bằng một `batch`; locale mặc định khi không khớp là `en`; lịch sử undo không được lưu qua các lần tải trang.

## Điều kiện tiên quyết

- Phần 1 đã xong, CI xanh. `frontend/` là app Next.js 16.3 App Router tối giản: `next.config.ts` (`agentRules: false`), `tsconfig.json` (chưa có `paths`), `vitest.config.ts` (jsdom, `@vitejs/plugin-react`, coverage `src/lib/**/*.{ts,tsx}` và `src/**/use-*.ts`, ngưỡng 80% số dòng), `src/app/layout.tsx`, `page.tsx`, `page.test.tsx`. Root có `eslint.config.mjs` (typescript-eslint strict type-checked, import-x, react-hooks, `@next/next` ở mức error, plugin Vitest), `.prettierrc.json` là `{}`, `pnpm-workspace.yaml` có catalog (`zod` `^4.6.4`…) và `allowBuilds` chỉ gồm `unrs-resolver`. pnpm 12.4.1 áp `minimumReleaseAge` 24 giờ.
- Phần 2 đang được triển khai theo [plan phần 2](2026-09-14-core-schema-model-plan.md). Task loại A không cần core. Task loại B cần core Task 26 (public API `@schemaforge/core` và entry point `@schemaforge/core/testing`, gồm cả `buildRelation` của Task 29, `mergeLastEntry` của Task 30, kiểm tra `jitless` của Task 31) đã merge; task B sửa `layout.tsx` hoặc `page.tsx` cần thêm core Task 27 (bỏ `PRODUCT_NAME`, tạo `frontend/src/lib/app-name.ts` với `APP_NAME`).
- Node 24 qua nvm. Máy dev mặc định vẫn là Node 22, nên mọi lệnh `node`, `pnpm`, `npm` trong shell không tương tác phải có tiền tố:

  ```bash
  source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
  ```

  `node -v` phải ra `v24.x`.
- Working tree sạch, và `pnpm --filter @schemaforge/frontend test` đang xanh trước khi bắt đầu một task.

## Cách dùng plan

- Mỗi task giao cho một subagent chưa đọc spec và chưa thấy thảo luận nào. Prompt của subagent gồm: mục "Quy ước chung cho mọi task", mục "Điểm nóng khi làm song song", toàn bộ nội dung task, đường dẫn spec kèm các mục spec mà task tham chiếu, và các dòng liên quan trong mục "Vấn đề phát hiện khi lập plan".
- **Subagent không commit, không push, không tạo subagent khác.** Orchestrator kiểm tra kết quả (chạy lại lệnh ở mục "Kiểm tra" của task, xem `git diff`) rồi commit đúng các file của task với commit message ghi trong task (`.claude/rules/git.md`: một dòng, không body, không trailer).
- **Task song song chạy trong git worktree riêng**, tạo từ HEAD của nhánh local (không phải từ remote), vì lệnh typecheck, lint, test chạy trên cả package và sẽ đỏ theo file đang viết dở của task khác nếu dùng chung working tree. Việc đầu tiên trong worktree mới:

  ```bash
  source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1; pnpm install --frozen-lockfile && pnpm --filter @schemaforge/core build
  ```

  Build core là bắt buộc: `pnpm --filter` không chạy qua Turborepo nên không tự build dependency, mà typecheck và lint có type của frontend cần `packages/core/dist`.
- Orchestrator commit trong worktree, merge về nhánh chính lần lượt từng task, và sau mỗi lần merge chạy lại `pnpm install --frozen-lockfile`, build core và bốn lệnh kiểm tra của frontend trước khi merge task tiếp theo.
- Số thứ tự task là định danh, không phải thứ tự chạy. Cột "Đợt" trong bảng task là thứ tự gợi ý; một task bắt đầu được ngay khi mọi phụ thuộc của nó đã merge.

## Quy ước chung cho mọi task

- **Đọc trước khi viết:** `CLAUDE.md`; `.claude/rules/nextjs.md`, `react.md`, `typescript.md`, `code-quality.md`, `testing.md`, `security.md`; các mục spec mà task tham chiếu.
- **Tiền tố Node.** Mọi lệnh `node`, `pnpm`, `npm` chạy với `source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;` ở đầu, trong root repo (hoặc root worktree).
- **TDD.** Viết test trước, chạy thấy đỏ, rồi mới cài đặt. Trong vòng đỏ-xanh, chạy riêng file test (không bật coverage nên không vướng ngưỡng):

  ```bash
  pnpm --filter @schemaforge/frontend exec vitest run src/<đường-dẫn>.test.ts
  ```

- **Chỉ tạo và sửa file có trong mục "File sở hữu" của task.** Cần sửa file khác (kể cả file cấu hình, `package.json`, file resource i18n của task khác, `globals.css`, `components/ui/`) thì dừng và báo orchestrator.
- **Lockfile.** Chỉ Task 1 chạy lệnh ghi `pnpm-lock.yaml`. Không task nào khác chạy `pnpm add`, `pnpm remove`, `pnpm update`, hay `pnpm install` không có `--frozen-lockfile`. Thiếu dependency thì dừng và báo; orchestrator tạo một task dependency riêng, chạy tuần tự. Task 3 chạy shadcn CLI, là trường hợp duy nhất có thể làm lockfile đổi tạm thời, và phải kết thúc với lockfile không đổi (xem Task 3).
- **Cấu hình ở root** (`eslint.config.mjs`, `.prettierrc.json`, `pnpm-workspace.yaml`, `turbo.json`, `package.json` root) chỉ được sửa trong task chạy tuần tự, không có task nào khác chạy cùng lúc. Ở lượt thứ nhất đó là Task 1, 2, 3.
- **Code.**
  - Tiếng Anh cho code, identifier, comment, tên test. Chuỗi trong code dùng nháy kép (Prettier mặc định).
  - Không `as` (trừ `as const`), không `!`, không `any`, không từ khóa `enum`, không `@ts-ignore`. Không default export, trừ file route của Next.js (`page`, `layout`, `loading`, `error`, `not-found`) và file cấu hình.
  - Hàm export khai báo kiểu trả về; component trả `JSX.Element` (import type `JSX` từ `react`). Boolean bắt đầu bằng `is`, `has`, `can`, `should`, trừ tên do API ngoài đặt sẵn mà Task 2 cho phép (`asChild`, `open`, `disabled`…).
  - Import chéo thư mục dùng alias `@/` (Task 1 tạo); import trong cùng thư mục dùng đường dẫn tương đối.
  - Mọi chuỗi người dùng nhìn thấy (text trong JSX, `aria-label`, `title`, `placeholder`, `alt`, toast, thông báo lỗi) đi qua i18n, có đủ `vi` và `en`. Component trong `components/ui/` không gọi i18n; chuỗi của chúng (ví dụ nhãn nút đóng) được truyền vào qua prop.
  - Màu chỉ lấy từ theme token (class Tailwind như `bg-background`, `text-muted-foreground`, `border-border`, hoặc `var(--token)`); không mã màu, không class màu cố định như `bg-red-500`, không màu dạng arbitrary value.
  - Không `dangerouslySetInnerHTML`. Không `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`. Không `console` ngoài `src/lib/logger.ts`. Không state có thể thay đổi ở cấp module.
  - `"use client"` đặt ở component thấp nhất cần nó. Hàm dưới khoảng 40 dòng, file dưới khoảng 300 dòng, lồng tối đa 3 cấp.
- **Test.** Import `describe`, `it`, `expect`, `vi` từ `vitest`. Mỗi test một hành vi, tên là câu tiếng Anh. Không vòng lặp hay `if` trong test; dữ liệu dạng bảng dùng `it.each`. Test component truy vấn theo role, label, text; thao tác bằng `userEvent.setup()`. Mock chỉ ở biên (IndexedDB bằng `fake-indexeddb`, Web Locks bằng bản giả, `matchMedia`, `document.cookie`, `next/navigation`, API DOM mà jsdom thiếu). Id và thời gian được truyền vào, không đọc đồng hồ hay sinh ngẫu nhiên trong logic. Không có test chạy trên trình duyệt.
- **Format.** Trước khi báo xong, chạy `pnpm exec prettier --write <các file của task>` (Prettier không format `*.md`).
- **Kiểm tra trước khi báo xong** (trừ khi task ghi thêm), chạy ở root repo:

  ```bash
  source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
  pnpm --filter @schemaforge/frontend typecheck
  pnpm --filter @schemaforge/frontend lint
  pnpm --filter @schemaforge/frontend test
  pnpm --filter @schemaforge/frontend build
  pnpm format:check
  ```

  Kết quả mong đợi: mọi lệnh thoát mã 0; `test` in mọi test pass và không có dòng `ERROR: Coverage for lines (…) does not meet global threshold (80%)`; `build` in `Compiled successfully` và danh sách route.

  Task sửa cấu hình ở root chạy thêm `pnpm lint && pnpm typecheck && pnpm test`, cả ba thoát mã 0.
- Không để lại file tạm (kể cả file thử lint). Khi kết thúc, `git status --porcelain` chỉ còn file của task.
- **Báo cáo** gồm: file đã tạo hoặc sửa; lệnh đã chạy kèm kết quả chính (số test, % coverage số dòng); mọi bước "xác minh" trong task kèm kết quả; vấn đề còn mở.

## Hai loại task

| Loại | Điều kiện | Được làm gì | Task |
|---|---|---|---|
| **A** | Chỉ cần scaffold của phần 1. Bắt đầu được trước khi core xong | Không import `@schemaforge/core` hay `@schemaforge/core/testing`, kể cả trong test. Không sửa `frontend/src/app/layout.tsx`, `page.tsx`, `frontend/src/lib/app-name.ts` | 1–12 |
| **B** | Import public API của core (cần core Task 26 đã merge), hoặc sửa `layout.tsx`, `page.tsx`, dùng `APP_NAME` (cần thêm core Task 27) | Dùng type và hàm của core theo đúng tên trong core Task 26; không định nghĩa lại type của schema model | 13–32 |

- Task loại A phát hiện mình cần một type hay hàm của core thì dừng và báo; không tự khai báo type tương đương (`typescript.md`: type của schema model chỉ đến từ core). Nơi task A cần một kiểu dữ liệu chung chung (ví dụ đường dẫn trong log), dùng kiểu tổng quát và ghi rõ trong task.
- Trước khi giao task B đầu tiên, orchestrator xác nhận core Task 26 đã merge: `packages/core/src/index.ts` export đủ danh sách trong core Task 26 và `packages/core/src/testing/index.ts` tồn tại. Trước task B sửa `layout.tsx` hoặc `page.tsx`, xác nhận thêm `grep -rn PRODUCT_NAME frontend/src` không in dòng nào và `frontend/src/lib/app-name.ts` tồn tại.
- Trong lúc core chưa xong, task A merge về nhánh chính xen kẽ với task của core. File của hai bên rời nhau; chỉ Task 1 của plan này đổi lockfile, và core không còn task nào đổi lockfile sau core Task 1.

## Điểm nóng khi làm song song

| Điểm nóng | Cách xử lý |
|---|---|
| `pnpm-lock.yaml`, `frontend/package.json`, `package.json` root (dependency) | Task 1 cài **mọi** dependency của phần 3 trong một lần, kể cả các gói mà `shadcn init` và `shadcn add` sẽ đòi, để CLI bỏ qua bước cài (CLI 4.21.0 bỏ qua gói đã có trong `dependencies`/`devDependencies`). Sau Task 1 không task nào đổi dependency. Task 30 chỉ thêm script `perf:snippet` vào `frontend/package.json`, không đổi dependency nên không đổi lockfile |
| `eslint.config.mjs` | Chỉ Task 2 sửa ở lượt này. Task B cần đổi rule thì dừng và báo; orchestrator tạo một task cấu hình riêng, chạy tuần tự. Không tắt rule bằng comment để né việc này, trừ các chỗ plan ghi rõ (kèm lý do) |
| `.prettierrc.json` | Chỉ Task 3 sửa (thêm `prettier-plugin-tailwindcss`) |
| `pnpm-workspace.yaml` | Phần 3 không cần sửa: catalog giữ nguyên (frontend dùng `zod: catalog:`), các gói mới không có script cài đặt cần build (đã kiểm tra `@tailwindcss/oxide` 4.3.3, `lightningcss`). Nếu `pnpm install` ở Task 1 vẫn báo "Ignored build scripts" thì dừng và báo, không tự thêm vào `allowBuilds` |
| `turbo.json` | Phần 3 không sửa. Task `lint` đã có input `$TURBO_ROOT$/eslint.config.mjs`; `perf:snippet` chạy trực tiếp bằng `pnpm --filter`, không phải task của Turborepo |
| `frontend/vitest.config.ts` | Chỉ Task 1 sửa, và sửa một lần cho cả phần 3: alias `@/`, `setupFiles`, glob coverage cuối cùng theo spec mục 14 "Coverage". Task sau không sửa |
| `frontend/tsconfig.json` | Chỉ Task 1 sửa (thêm `paths` cho `@/*`) |
| `frontend/src/testing/setup-tests.ts` | Chỉ Task 1 tạo: dọn DOM sau mỗi test và bù các API DOM mà jsdom thiếu (dùng cho Radix và React Flow). Task sau cần thêm stub toàn cục thì dừng và báo; stub riêng của một test đặt trong chính file test đó |
| File resource i18n | Task 9 tạo toàn bộ cây file resource, gồm cả file con rỗng cho các task B đã lập. Mỗi file có đúng một task sở hữu (bảng dưới). File gộp namespace (`locales/<locale>/editor.ts`) chỉ gộp file con và không bị sửa sau Task 9. Task B chỉ sửa file con của mình ở cả `en` và `vi`. Cần key dùng chung mới thì đặt trong file con của task, không sửa `common.ts` |
| `frontend/src/app/globals.css` | Task 3 tạo, Task 10 thêm token canvas, biến `--xy-*`, import CSS của React Flow và biến của Toaster. Không task nào khác sửa. Task B cần token mới thì dừng và báo |
| `frontend/components.json`, `frontend/src/components/ui/` | Task 3 chạy shadcn CLI và thêm **mọi** component phần 3 cần trong một lần; Task 10 viết tay `components/ui/sonner.tsx`. Task B không chạy `shadcn add`; thiếu component thì dừng và báo để orchestrator tạo task tuần tự |
| `frontend/src/components/app-providers.tsx` | Task A chỉ tạo provider đứng riêng (`ThemeProvider`, `I18nProvider`) và `Toaster`. `AppProviders` do Task 13 tạo và sở hữu duy nhất |
| `frontend/src/app/layout.tsx`, `page.tsx` | Core Task 27 sửa trước. Sau đó chỉ Task 13 sửa `layout.tsx` và chỉ Task 21 sửa `page.tsx` |
| `frontend/next.config.ts` | Phần 3 không sửa (CSP nằm trong `src/proxy.ts`) |

**Chủ sở hữu file resource i18n** (đường dẫn tính từ `frontend/src/lib/i18n/locales/`; mỗi dòng áp cho cả `en/` và `vi/`):

| File | Namespace, khóa gốc | Task tạo | Task điền nội dung |
|---|---|---|---|
| `common.ts` | `common` | 9 | 9; sau đó chỉ 13 thêm key của khung ứng dụng (trang không tìm thấy, tiêu đề trang) |
| `storage.ts` | `storage` | 9 | 9 |
| `issues.ts` | `issues` | 9 (object rỗng) | 14 |
| `errors.ts` | `errors` | 9 (object rỗng) | 14 |
| `schema-list.ts` | `schemaList` | 9 (object rỗng) | 21 |
| `canvas.ts` | `canvas` | 9 (object rỗng) | 24 |
| `editor.ts` | `editor`, chỉ gộp file con | 9 | Không ai sửa |
| `editor/screen.ts` | `editor.screen` | 9 (object rỗng) | 22 |
| `editor/toolbar.ts` | `editor.toolbar` | 9 (object rỗng) | 23 |
| `editor/left-panel.ts` | `editor.leftPanel` | 9 (object rỗng) | 25 |
| `editor/table-panel.ts` | `editor.tablePanel` | 9 (object rỗng) | 26 |
| `editor/relation-panel.ts` | `editor.relationPanel` | 9 (object rỗng) | 27 |
| `editor/relation-dialog.ts` | `editor.relationDialog` | 9 (object rỗng) | 28 |
| `editor/editor-layout.ts` | `editor.layout` | 9 (object rỗng) | 29 |

Lượt lập plan thứ hai đổi tên hay gộp task B thì cập nhật bảng này cho khớp, nhưng không đổi đường dẫn file mà Task 9 tạo trừ khi Task 9 chưa chạy.

## Phiên bản

Kiểm tra lại lúc 2026-09-15T02:05Z bằng `npm view <gói> version time peerDependencies`. Mọi phiên bản dưới đây đã phát hành ít nhất 24 giờ, đúng `minimumReleaseAge` của pnpm. Specifier dùng dấu `^` như phần 1; pnpm vẫn chỉ chọn bản đã đủ 24 giờ lúc cài, và Task 1 ghi phiên bản thực tế trong lockfile vào báo cáo.

| Gói | Phiên bản | Ngày phát hành | Đặt ở | Ghi chú |
|---|---|---|---|---|
| `@xyflow/react` | 12.11.6 | 2026-09-01 | `frontend` dependencies | peer `react >=17`; tự kéo `zustand` 4 cho state nội bộ, tách biệt với `zustand` 5 của editor |
| `zustand` | 5.0.15 | 2026-08-13 | `frontend` dependencies | peer `react >=18` |
| `dexie` | 4.4.6 | 2026-09-10 | `frontend` dependencies | không có peer, không có script cài đặt |
| `dexie-react-hooks` | 4.4.0 | 2026-03-18 | `frontend` dependencies | peer `dexie >=4.2.0-alpha.1 <5`, `react >=16` |
| `i18next` | 26.4.2 | 2026-09-03 | `frontend` dependencies | peer `typescript ^5 \|\| ^6 \|\| ^7` |
| `react-i18next` | 17.0.14 | 2026-09-13 | `frontend` dependencies | peer `react >=16.8`, `i18next >=26.2.0` |
| `radix-ui` | 1.6.7 | 2026-07-24 | `frontend` dependencies | peer `react ^19` |
| `lucide-react` | **1.45.0** | 2026-09-11 | `frontend` dependencies | Spec ghi 1.46.0, nhưng bản này phát hành 2026-09-14T09:23Z, chưa đủ 24 giờ lúc kiểm tra (Vấn đề 1) |
| `class-variance-authority` | 0.7.1 | 2024-11-26 | `frontend` dependencies | shadcn/ui cần |
| `clsx` | 2.1.1 | 2024-04-23 | `frontend` dependencies | shadcn/ui cần |
| `tailwind-merge` | 3.7.0 | 2026-09-12 | `frontend` dependencies | shadcn/ui cần |
| `sonner` | 2.0.8 | 2026-08-09 | `frontend` dependencies | peer `react ^18 \|\| ^19` |
| `zod` | `catalog:` (`^4.6.4`) | — | `frontend` dependencies | **Thêm so với spec** (Vấn đề 2): `zod-config.ts` và `lib/storage/records.ts` import trực tiếp |
| `tailwindcss` | 4.3.3 | 2026-07-16 | `frontend` devDependencies | **Thêm so với spec**: phải cùng phiên bản với `@tailwindcss/postcss` |
| `@tailwindcss/postcss` | 4.3.3 | 2026-07-16 | `frontend` devDependencies | |
| `postcss` | 8.5.28 | 2026-09-03 | `frontend` devDependencies | **Thêm so với spec**: `postcss.config.mjs` cần, theo hướng dẫn cài Tailwind CSS 4 cho Next.js |
| `tw-animate-css` | 1.4.0 | 2025-09-24 | `frontend` devDependencies | `globals.css` import |
| `axe-core` | 4.13.0 | 2026-08-05 | `frontend` devDependencies | gọi `axe.run` trong test |
| `fake-indexeddb` | 6.2.5 | 2025-11-07 | `frontend` devDependencies | chỉ dùng trong test |
| `@testing-library/user-event` | 14.6.7 | 2026-09-02 | `frontend` devDependencies | peer `@testing-library/dom >=7.21.4` (đã có `^10.4.1`) |
| `prettier-plugin-tailwindcss` | 0.8.1 | 2026-07-15 | root devDependencies | peer `prettier ^3.0` |
| `eslint-plugin-i18next` | 6.1.5 | 2026-06-28 | root devDependencies | không khai báo peer `eslint`; schema option có `framework`, `mode` (`jsx-text-only`, `jsx-only`, `all`, `vue-template-only`), `jsx-components`, `jsx-attributes`, `words`, `callees`, `object-properties`, `class-properties`, `message`, `should-validate-template` |
| `eslint-plugin-jsx-a11y-x` | 0.2.0 | 2026-05-10 | root devDependencies | peer `eslint ^9 \|\| ^10`; export `configs.recommended`; đọc `settings["jsx-a11y-x"].components` |
| `shadcn` (CLI) | 4.21.0 | 2026-09-04 | Không cài | chạy bằng `pnpm dlx shadcn@4.21.0`; `init` có `--base <base>` (`base`, `radix`, `aria`) và lệnh `eject` |

Gói đã có từ phần 1, không đổi: `next` 16.3.5, `react`/`react-dom` 19.3.0, `eslint` 10.10.0, `prettier` 3.9.6, `vitest` 5.0.0, `@testing-library/react` 16.3.3, `@testing-library/dom` `^10.4.1`, `jsdom` `^30.0.1`.

Gói spec đã loại và plan không dùng: `next-themes`, `eslint-plugin-jsx-a11y`, `i18next-cli`, `vitest-axe`, `jest-axe`, `i18next-browser-languagedetector`, `nanoid` (lý do ở spec mục "Phiên bản"). `cmdk` cũng không dùng (Vấn đề 8).

## Bảng task

"Core 26", "core 27" là task của [plan phần 2](2026-09-14-core-schema-model-plan.md). Mọi task trong cùng một đợt có tập file rời nhau và chạy song song được; mỗi đợt tối đa 5 task. Đợt 1–3 tuần tự vì sửa cấu hình dùng chung. Các dòng loại B là bản dự kiến: lượt lập plan thứ hai được đổi tên, tách, gộp, đổi phụ thuộc và đợt, miễn là giữ đúng mục "Điểm nóng khi làm song song".

| Task | Tên | Loại | Phụ thuộc | Đợt |
|---|---|---|---|---|
| 1 | Dependency, alias `@/`, cấu hình Vitest và setup test | A | — | 1 |
| 2 | Lint chuỗi hardcode, accessibility, gọi mạng và import | A | 1 | 2 |
| 3 | Tailwind CSS 4, shadcn/ui và component `ui` | A | 2 | 3 |
| 4 | Locale được hỗ trợ và cookie lựa chọn | A | 2 | 4 |
| 5 | CSP có nonce: `proxy.ts`, `env.ts`, `zod-config.ts` | A | 2 | 4 |
| 6 | Database Dexie, record, `isSchemaId`, lỗi lưu trữ | A | 2 | 4 |
| 7 | Khóa schema theo tab (Web Locks) và khóa giả cho test | A | 2 | 4 |
| 8 | `shouldHandleShortcut` và nhận diện phím tắt | A | 2 | 4 |
| 9 | Hạ tầng i18n, resource có kiểu, `LanguageSwitch` | A | 3, 4, 5, 6 | 5 |
| 10 | Theme: `theme-init.js`, `ThemeProvider`, `ThemeSwitch`, token, `Toaster` | A | 3, 4, 5, 9 | 6 |
| 11 | Logger và `notify` | A | 2, 9 | 6 |
| 12 | Helper test component: `renderWithProviders`, `expectNoAxeViolations`, `matchMedia` giả | A | 3, 9, 10 | 7 |
| 13 | `AppProviders`, nối vào `layout.tsx`, `not-found.tsx`, tiêu đề trang | B | core 27, 5, 9, 10, 11 | 9 |
| 14 | Bản dịch `issues` và `errors` | B | core 26, 9 | 8 |
| 15 | `SchemaRepository` | B | core 26, 6 | 8 |
| 16 | Hàm dựng operation: thêm bảng, quan hệ, xóa lựa chọn, gợi ý tên | B | core 26 | 8 |
| 17 | Chỉ mục issue và `resolveIssueTarget` | B | core 26 | 8 |
| 18 | Store editor: `createEditorStore`, provider, `useEditorStore` | B | core 26, 11 | 8 |
| 19 | Suy ra node và edge: `toTableNodes`, `toRelationEdges` | B | 17 | 9 |
| 20 | Hook `useAutosave`, `useSchemaLock`, `useEditorShortcuts` | B | 7, 8, 11, 15, 18 | 9 |
| 21 | Màn hình danh sách schema và route `/` | B | 7, 12, 13, 15 | 10 |
| 22 | Route editor, `EditorScreenLoader`, `EditorScreen` và các trạng thái mở | B | 12, 13, 15, 18, 20 | 10 |
| 23 | Toolbar và `ViewportControls` | B | 12, 16, 17, 18 | 10 |
| 24 | Canvas: `TableNode`, `ColumnRow`, `RelationEdge`, marker, `ariaLabelConfig` | B | 12, 17, 18, 19 | 10 |
| 25 | Panel trái: tab Bảng, Enum, Vấn đề | B | 12, 17, 18 | 10 |
| 26 | Panel bảng: cột, index, comment | B | 12, 17, 18 | 11 |
| 27 | Panel quan hệ và panel nhiều lựa chọn | B | 12, 17, 18 | 11 |
| 28 | Hộp thoại "Tạo quan hệ" | B | 12, 16, 18 | 11 |
| 29 | Ghép editor: bố cục, landmark, skip link, xóa bằng phím, toast hoàn tác, focus | B | 20, 22, 23, 24, 25, 26, 27, 28 | 12 |
| 30 | Test hiệu năng và script `perf:snippet` | B | 24, 26 | 12 |
| 31 | Test tích hợp hành trình 1–8 | B | 21, 29 | 13 |
| 32 | Tài liệu, kiểm tra toàn repo, checklist kiểm tra tay | B | 1–31 | 14 |

- Task 13 đứng ở đợt 9 vì ngoài các task A còn cần core 27; nếu core 27 merge sớm thì chạy ở đợt 8.
- Checklist kiểm tra tay (spec mục 11 "Kiểm tra", mục 12 "Kiểm tra tay", mục 13 "Cách đo tay", mục 14 "Không kiểm tra tự động được") nằm trong Task 32, gồm độ tương phản, CSP trên Chrome thật và số đo hiệu năng.

## Task 1: Dependency, alias `@/`, cấu hình Vitest và setup test

**Mục tiêu:** cài mọi dependency của phần 3 trong một lần để không task nào khác phải đụng lockfile; có alias `@/` mà shadcn CLI đòi; cấu hình Vitest cuối cùng cho cả phần 3; setup test bù các API DOM mà jsdom thiếu.

**Loại:** A. **Phụ thuộc:** không. **Đợt:** 1, tuần tự (không task nào chạy cùng).

**File sở hữu:** sửa `frontend/package.json`, `package.json` (root, chỉ `devDependencies`), `pnpm-lock.yaml`, `frontend/tsconfig.json`, `frontend/vitest.config.ts`; tạo `frontend/src/testing/setup-tests.ts`, `frontend/src/testing/setup-tests.test.ts`.

**Cài đặt:**

1. Cài dependency theo mục "Phiên bản":

   ```bash
   source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
   pnpm --filter @schemaforge/frontend add @xyflow/react@^12.11.6 zustand@^5.0.15 dexie@^4.4.6 dexie-react-hooks@^4.4.0 i18next@^26.4.2 react-i18next@^17.0.14 radix-ui@^1.6.7 lucide-react@^1.45.0 class-variance-authority@^0.7.1 clsx@^2.1.1 tailwind-merge@^3.7.0 sonner@^2.0.8 zod@catalog:
   pnpm --filter @schemaforge/frontend add -D tailwindcss@^4.3.3 @tailwindcss/postcss@^4.3.3 postcss@^8.5.28 tw-animate-css@^1.4.0 axe-core@^4.13.0 fake-indexeddb@^6.2.5 @testing-library/user-event@^14.6.7
   pnpm add -D -w prettier-plugin-tailwindcss@^0.8.1 eslint-plugin-i18next@^6.1.5 eslint-plugin-jsx-a11y-x@^0.2.0
   ```

   - Nếu pnpm không nhận `zod@catalog:`, sửa tay `frontend/package.json` thành `"zod": "catalog:"` rồi chạy `pnpm install`.
   - Không cài `next-themes`, `shadcn`, `cmdk`, `server-only` hay gói nào ngoài danh sách.
   - `pnpm install` báo "Ignored build scripts" cho gói nào thì dừng và báo, không sửa `pnpm-workspace.yaml`.
2. `frontend/tsconfig.json`: thêm `"paths": { "@/*": ["./src/*"] }` vào `compilerOptions`. Không thêm `baseUrl`.
3. `frontend/vitest.config.ts` (spec mục 14 "Coverage"):
   - `resolve.alias`: `"@"` trỏ tới `fileURLToPath(new URL("./src", import.meta.url))`. Alias dạng chuỗi chỉ khớp `@` hoặc `@/…`, nên `@xyflow/react`, `@schemaforge/core` không bị ảnh hưởng.
   - `test.setupFiles`: `["./src/testing/setup-tests.ts"]`.
   - `coverage.include`: `src/lib/**/*.ts`, `src/**/use-*.ts`, `src/features/**/state/**/*.ts`, `src/features/**/lib/**/*.ts`, `src/features/**/hooks/**/*.ts`, `src/proxy.ts`.
   - `coverage.exclude`: `src/lib/i18n/locales/**`, `src/testing/**`, `src/components/ui/**`, `scripts/**`, `**/*.d.ts`, `**/*.test.{ts,tsx}`.
   - Giữ `environment: "jsdom"`, `include`, `provider: "v8"`, `thresholds: { lines: 80 }`. File `*.tsx` không được tính vào ngưỡng vì glob chỉ gồm `*.ts`.
4. `frontend/src/testing/setup-tests.ts` (không export gì):
   - `afterEach(() => { cleanup(); })` với `cleanup` của `@testing-library/react`. Vitest không bật `globals`, nên React Testing Library không tự dọn DOM.
   - Chỉ khi API chưa có, gắn bằng `Object.defineProperty(..., { configurable: true, writable: true, value })` (không cần `as`):
     - `ResizeObserver`: class có `observe`, `unobserve`, `disconnect` không làm gì (Radix, React Flow).
     - `DOMMatrixReadOnly`: class nhận chuỗi `transform`, có `m22` đọc từ `scale(n)`, mặc định `1` (theo hướng dẫn test của React Flow).
     - `HTMLElement.prototype.offsetWidth`, `offsetHeight`: getter trả `parseFloat(style.width)` hoặc `parseFloat(style.height)`, mặc định `1` (React Flow).
     - `SVGElement.prototype.getBBox`: trả `{ x: 0, y: 0, width: 0, height: 0 }` (React Flow).
     - `Element.prototype.scrollIntoView`, `hasPointerCapture` (trả `false`), `setPointerCapture`, `releasePointerCapture` (Radix Select, DropdownMenu).
     - `window.matchMedia`: trả object có `matches: false`, `media`, `onchange: null`, `addEventListener`, `removeEventListener`, `addListener`, `removeListener`, `dispatchEvent`. Test cần giá trị khác thì tự thay bằng `vi.stubGlobal` hoặc `vi.spyOn` (Task 12 có helper).
   - Không import `fake-indexeddb/auto` ở đây: test truyền `IDBFactory` riêng cho từng database để không chia sẻ dữ liệu.

**Test viết trước** (`setup-tests.test.ts`):

- `provides a ResizeObserver that can observe an element`.
- `provides a DOMMatrixReadOnly that reads the scale factor`.
- `provides a matchMedia that does not match by default`.
- `provides pointer capture and scrollIntoView on elements`.
- `resolves modules through the @/ alias` (dynamic `import("@/testing/setup-tests")` resolve được).

**Kiểm tra:** như "Quy ước chung", cộng lệnh root `pnpm lint && pnpm typecheck && pnpm test`, và:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm install --frozen-lockfile
pnpm --filter @schemaforge/frontend why zod
pnpm --filter @schemaforge/frontend list tailwindcss @tailwindcss/postcss lucide-react
grep -n '"zod"' frontend/package.json
grep -n 'next-themes\|"shadcn"\|"cmdk"' frontend/package.json package.json
```

Mong đợi: `install --frozen-lockfile` thoát mã 0 và không có "Ignored build scripts"; `why zod` chỉ có một phiên bản 4.6.x, trùng với core; `tailwindcss` và `@tailwindcss/postcss` cùng phiên bản; `lucide-react` là bản đã đủ 24 giờ; `"zod": "catalog:"`; lệnh `grep` cuối không in dòng nào. Báo cáo ghi phiên bản thực tế của mọi gói mới.

**Commit:** `build: add editor mvp dependencies and test setup`

## Task 2: Lint chuỗi hardcode, accessibility, gọi mạng và import

**Mục tiêu:** `pnpm lint` fail khi có chuỗi giao diện hardcode, lỗi accessibility trong JSX, API gọi mạng, import `toast` ngoài wrapper, import helper test từ code chạy thật, hoặc import chéo giữa `features/schema-list` và `features/editor`; component shadcn/ui và prop của Radix, React Flow không vướng rule đặt tên boolean.

**Loại:** A. **Phụ thuộc:** Task 1. **Đợt:** 2, tuần tự.

**File sở hữu:** sửa `eslint.config.mjs`.

**Cài đặt** (spec mục 9 "Lint", mục 11 "Không gọi mạng", mục "Cấu trúc thư mục"):

- Import `i18next from "eslint-plugin-i18next"` và `jsxA11yX from "eslint-plugin-jsx-a11y-x"`. Hằng `FRONTEND_TEST_FILES = ["frontend/src/**/*.test.{ts,tsx}", "frontend/src/testing/**"]`.
- **Chuỗi hardcode.** Khối `files: ["frontend/src/**/*.tsx"]`, `ignores: FRONTEND_TEST_FILES`, `plugins: { i18next }`, rule `"i18next/no-literal-string": ["error", { framework: "react", mode: "jsx-only", "jsx-attributes": { exclude: NON_VISIBLE_JSX_ATTRIBUTES } }]`.
  - `NON_VISIBLE_JSX_ATTRIBUTES` (chuỗi regex khớp toàn bộ tên thuộc tính): `className`, `id`, `key`, `type`, `role`, `name`, `href`, `src`, `rel`, `target`, `htmlFor`, `lang`, `dir`, `autoComplete`, `inputMode`, `value`, `defaultValue` (token của Tabs, Select, RadioGroup), `orientation`, `data-.*`; `aria-(activedescendant|atomic|busy|checked|controls|current|describedby|details|disabled|errormessage|expanded|flowto|haspopup|hidden|invalid|labelledby|live|modal|multiline|multiselectable|orientation|owns|pressed|readonly|relevant|required|selected|sort)`; thuộc tính SVG `d`, `viewBox`, `fill`, `stroke`, `strokeWidth`, `strokeLinecap`, `strokeLinejoin`, `strokeDasharray`, `markerEnd`, `markerStart`, `markerWidth`, `markerHeight`, `markerUnits`, `refX`, `refY`, `orient`, `points`, `transform`, `xmlns`, `width`, `height`, `x`, `y`, `x1`, `x2`, `y1`, `y2`, `cx`, `cy`, `r`; prop của shadcn/ui `variant`, `size`, `side`, `align`.
  - Không bao giờ thêm vào danh sách: `aria-label`, `aria-description`, `aria-roledescription`, `aria-valuetext`, `title`, `placeholder`, `alt`, `label`. Được thêm thuộc tính không hiển thị khác nếu bước xác minh cho thấy cần, ghi lý do vào báo cáo.
- **Accessibility.** Khối `files: ["frontend/src/**/*.tsx"]`, `extends: [jsxA11yX.configs.recommended]`, `settings: { "jsx-a11y-x": { components: { Button: "button", Input: "input", Label: "label", Textarea: "textarea" } } }`.
- **Gọi mạng.** Khối `files: ["frontend/src/**/*.{ts,tsx}"]`:
  - `no-restricted-globals` cho `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, thông báo trỏ tới spec mục 11 (phần 4 mới mở cho `src/lib/api/`).
  - `no-restricted-properties` gồm `navigator.sendBeacon`, `window.fetch`, `globalThis.fetch` **và** giới hạn `process.env` sẵn có. Tùy chọn của một rule ở khối sau thay hẳn tùy chọn ở khối trước, nên tách giới hạn `process.env` hiện có thành hằng `PROCESS_ENV_RESTRICTION` và dùng ở cả khối `**/*.{ts,tsx}` lẫn khối này.
  - Đặt khối này **trước** khối tắt `no-restricted-properties` cho `frontend/src/lib/env.ts` và `backend/src/config/**/*.ts` (dời khối tắt xuống sau nếu cần), để `env.ts` vẫn đọc được `process.env`.
- **Import.** Hàm `frontendImportRestrictions({ canImportToast, forbiddenFeature })` trả tùy chọn cho `no-restricted-imports`:
  - `paths`: `@schemaforge/core/testing` (chỉ dùng trong test); `{ name: "sonner", importNames: ["toast"] }` khi `canImportToast` là `false`, thông báo "Show toasts through notify() in src/lib/notify.ts".
  - `patterns`: `@/testing/*`, `**/testing/*` (thông báo: `src/testing/` chỉ dành cho test); khi có `forbiddenFeature` thì thêm `@/features/<forbiddenFeature>/*`, `**/features/<forbiddenFeature>/*`.
  - Bốn khối, đều `ignores: FRONTEND_TEST_FILES`: `frontend/src/**/*.{ts,tsx}` trừ `frontend/src/lib/notify.ts` (không được import `toast`); `frontend/src/lib/notify.ts` (được import `toast`); `frontend/src/features/schema-list/**` (cấm `editor`); `frontend/src/features/editor/**` (cấm `schema-list`). Hai khối feature đặt sau khối chung vì tùy chọn thay hẳn.
- **Tên boolean của API ngoài.** Trong mục boolean của `@typescript-eslint/naming-convention` (mục có `types: ["boolean"]`), thêm `filter: { regex: EXTERNAL_BOOLEAN_NAMES, match: false }` với `EXTERNAL_BOOLEAN_NAMES = "^(asChild|checked|defaultChecked|defaultOpen|disabled|hidden|inset|modal|open|readOnly|required|selected|dragging|draggable|selectable|deletable|connectable|focusable|animated)$"`, kèm comment: các tên này do DOM, Radix và React Flow đặt sẵn.
- **Khai báo gộp của i18next.** Khối `files: ["frontend/src/lib/i18n/i18next.d.ts"]` tắt `@typescript-eslint/consistent-type-definitions`, comment: `CustomTypeOptions` là declaration merging nên phải là `interface`.

**Kiểm tra bằng file thử** (thay cho test viết trước; tạo rồi xóa, không commit):

1. `frontend/src/lint-probe.tsx`: import `toast` từ `sonner`; gọi `void fetch("/")`; return JSX gồm `<p>Hello</p>`, `<button type="button" aria-label="Close" />`, `<img src="/probe.png" />`, `<div className="p-2" />`; một component nhận `{ asChild }: { readonly asChild: boolean }` và một component nhận `{ visible }: { readonly visible: boolean }`.
2. `frontend/src/lint-probe.test.tsx`: render `<p>Hello</p>`.
3. `frontend/src/features/editor/lint-probe.ts`: `import "@/features/schema-list/anything";` và `import "@/testing/setup-tests";`.
4. Chạy `pnpm --filter @schemaforge/frontend exec eslint src/lint-probe.tsx src/lint-probe.test.tsx src/features/editor/lint-probe.ts`.

   Mong đợi: có `i18next/no-literal-string` cho `Hello` và `Close`; `jsx-a11y-x/alt-text` cho `img`; `no-restricted-globals` cho `fetch`; `no-restricted-imports` cho `toast`, cho `@/features/schema-list/…` và cho `@/testing/…`; `@typescript-eslint/naming-convention` cho `visible` nhưng không cho `asChild`. Không có lỗi `i18next/no-literal-string` nào ở `className`, `type` hay trong `lint-probe.test.tsx`. Rule không chạy được trên ESLint 10 (lỗi nạp plugin, `context.getSourceCode is not a function`…) thì dừng và báo kèm output (spec mục "Rủi ro cần kiểm tra khi triển khai").
5. Xóa ba file thử.

**Xác minh thêm:**

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
node --input-type=module -e 'import p from "eslint-plugin-jsx-a11y-x"; console.log(Object.keys(p.configs.recommended.rules).sort().join("\n"))'
npm view eslint-plugin-jsx-a11y@6.10.2 readme
```

So danh sách rule của `configs.recommended` với các rule có dấu ☑️ trong README của bản gốc (không cài bản gốc); ghi khác biệt vào báo cáo, không tự thêm rule.

**Kiểm tra:** như "Quy ước chung", cộng `pnpm lint && pnpm typecheck && pnpm test` ở root. Code hiện có (`layout.tsx` với `lang="en"`, `page.tsx`) phải qua lint mà không sửa.

**Commit:** `build: lint hardcoded strings, accessibility and network calls`

## Task 3: Tailwind CSS 4, shadcn/ui và component `ui`

**Mục tiêu:** Tailwind CSS 4 và shadcn/ui được init theo spec mục 8 "Init Tailwind CSS và shadcn/ui"; mọi component `ui` mà phần 3 cần có sẵn trong một lần và qua lint; helper `cn` nằm ở `src/lib/class-names.ts`; Prettier sắp class Tailwind.

**Loại:** A. **Phụ thuộc:** Task 2. **Đợt:** 3, tuần tự.

**File sở hữu:** tạo `frontend/components.json`, `frontend/postcss.config.mjs`, `frontend/src/app/globals.css`, `frontend/src/lib/class-names.ts`, `frontend/src/lib/class-names.test.ts`, `frontend/src/components/ui/dialog.test.tsx`, và trong `frontend/src/components/ui/`: `alert-dialog.tsx`, `button.tsx`, `checkbox.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `radio-group.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `skeleton.tsx`, `tabs.tsx`, `textarea.tsx`, `tooltip.tsx`; sửa `.prettierrc.json`. Shadcn CLI được phép tạm sửa `frontend/package.json`, `package.json`, `pnpm-lock.yaml`, nhưng khi xong ba file này phải giống HEAD.

Danh sách component lấy từ spec: nút và nút icon (`button`, `tooltip`); ô nhập, nhãn, comment (`input`, `label`, `textarea`); checkbox thuộc tính cột (`checkbox`); kiểu cột có nhóm, loại quan hệ, ON DELETE, ON UPDATE (`select`); "Tạo cột mới" hoặc "Dùng cột có sẵn" (`radio-group`); hộp thoại tạo, đổi tên, tạo quan hệ (`dialog`); xác nhận xóa schema, hộp thoại chặn khi có `versionchange` (`alert-dialog`); menu thao tác dòng, chọn theme, chọn ngôn ngữ (`dropdown-menu`); ba tab panel trái (`tabs`); trạng thái đang đọc (`skeleton`); toolbar (`separator`); panel cuộn (`scroll-area`). Không thêm `sonner` (Task 10 viết tay, Vấn đề 3), `command`, `popover` (Vấn đề 8).

**Cài đặt:**

1. Chạy `pnpm dlx shadcn@4.21.0 init --help` rồi `init` với `--cwd frontend`: template Next.js, `--base radix`, màu nền neutral, CSS variables, không monorepo, không RTL. CLI hỏi thêm thì chọn giá trị mặc định tương ứng. Ghi lệnh thực tế vào báo cáo.
2. Sửa `frontend/components.json`: `rsc: true`, `tsx: true`, `tailwind.css: "src/app/globals.css"`, `tailwind.baseColor: "neutral"`, `tailwind.cssVariables: true`, `iconLibrary: "lucide"`, `aliases`: `components` `@/components`, `ui` `@/components/ui`, `utils` `@/lib/class-names`, `lib` `@/lib`, `hooks` `@/hooks`. Chuyển nội dung `src/lib/utils.ts` mà `init` sinh sang `src/lib/class-names.ts` (`export function cn(...inputs: ClassValue[]): string`), rồi xóa `utils.ts`. Làm trước bước 3 để component sinh ra import `@/lib/class-names`.
3. `pnpm dlx shadcn@4.21.0 add alert-dialog button checkbox dialog dropdown-menu input label radio-group scroll-area select separator skeleton tabs textarea tooltip --cwd frontend`.
4. Shadcn CLI 4.21.0 có thể thêm `@import "shadcn/tailwind.css"` và dependency `shadcn` (Vấn đề 4). Nếu có: chạy `pnpm dlx shadcn@4.21.0 eject --cwd frontend` để chép CSS đó vào `globals.css`, rồi `git checkout -- frontend/package.json package.json pnpm-lock.yaml` và `pnpm install --frozen-lockfile`.
5. CLI sửa file nằm ngoài danh sách sở hữu (ví dụ `layout.tsx`, `tsconfig.json`, `next.config.ts`) thì hoàn tác file đó bằng `git checkout -- <file>` và ghi vào báo cáo. Task này **không** import `globals.css` vào `layout.tsx`; Task 13 làm việc đó.
6. `globals.css` giữ nội dung CLI sinh: `@import "tailwindcss";`, `@import "tw-animate-css";`, `@custom-variant dark (&:is(.dark *));`, token trong `:root` và `.dark`, `@theme inline`, `@layer base`. Task 10 thêm token của canvas.
7. Sửa component sinh ra cho đúng quy ước, không đổi hành vi và class:
   - Mỗi function component export khai báo kiểu trả về `JSX.Element`.
   - Bỏ mọi `as`; `React.ComponentProps<…>` và `VariantProps<…>` giữ nguyên.
   - `DialogContent`: bỏ chữ `Close` hardcode, thêm prop bắt buộc `closeLabel: string` hiển thị trong `<span className="sr-only">`; đổi `showCloseButton` thành `hasCloseButton` (mặc định `true`). Component nào khác còn chuỗi hiển thị hardcode (lint báo) thì cũng đổi thành prop bắt buộc.
   - File trong `components/ui/` giữ cấu trúc nhiều export của shadcn/ui (`Dialog`, `DialogContent`, `DialogTitle`…); đây là ngoại lệ có chủ đích với quy tắc một component mỗi file (Vấn đề 7).
8. `.prettierrc.json`: `{ "plugins": ["prettier-plugin-tailwindcss"], "tailwindStylesheet": "./frontend/src/app/globals.css", "tailwindFunctions": ["cn", "cva"] }`. Chạy `pnpm exec prettier --write` trên mọi file của task.

**Test viết trước:**

- `class-names.test.ts`: `lets the last conflicting tailwind class win` (`cn("px-2", "px-4")` là `"px-4"`); `drops falsy class values`.
- `dialog.test.tsx`: `names the close button with the closeLabel prop` (render `Dialog` mở, có `DialogTitle` và `DialogDescription`, truy vấn `getByRole("button", { name: "Close dialog" })`); `omits the close button when hasCloseButton is false`.

**Kiểm tra:** như "Quy ước chung", cộng `pnpm lint && pnpm typecheck && pnpm test` ở root, và:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
(cd frontend && node --input-type=module -e 'import postcss from "postcss"; import tailwind from "@tailwindcss/postcss"; import { readFileSync } from "node:fs"; const from = "src/app/globals.css"; const result = await postcss([tailwind()]).process(readFileSync(from, "utf8"), { from }); console.log(result.css.includes("--background"))')
git diff --exit-code -- pnpm-lock.yaml package.json frontend/package.json
grep -rn 'next-themes\|@/lib/utils\|shadcn/tailwind.css' frontend/src frontend/components.json
test ! -e frontend/src/lib/utils.ts && echo "no utils.ts"
```

Mong đợi: lệnh `node` in `true`; `git diff --exit-code` thoát mã 0; `grep` không in dòng nào; dòng cuối in `no utils.ts`.

**Commit:** `build: set up tailwind css and shadcn/ui components`

## Task 4: Locale được hỗ trợ và cookie lựa chọn

**Mục tiêu:** một nguồn duy nhất cho danh sách locale, lựa chọn theme và cách đọc, ghi hai cookie `sf-theme`, `sf-locale`, dùng chung cho server (layout) và client (`ThemeSwitch`, `LanguageSwitch`).

**Loại:** A. **Phụ thuộc:** Task 2. **Đợt:** 4.

**File sở hữu:** tạo `frontend/src/lib/i18n/supported-locales.ts`, `supported-locales.test.ts`, `frontend/src/lib/preferences/preference-cookies.ts`, `preference-cookies.test.ts`.

**Cài đặt** (spec mục 8 "Mặc định, ghi nhớ, không nháy", mục 9 "Chọn ngôn ngữ", mục 11 "Nội dung do người dùng nhập"):

- `supported-locales.ts`:
  - `SUPPORTED_LOCALES = ["vi", "en"] as const`; `type Locale = (typeof SUPPORTED_LOCALES)[number]`; `DEFAULT_LOCALE = "en" satisfies Locale`.
  - `isLocale(value: string): value is Locale`, cài bằng `SUPPORTED_LOCALES.some((locale) => locale === value)` (không ép kiểu mảng sang `readonly string[]`). Phân biệt hoa thường: `"EN"` không hợp lệ.
- `preference-cookies.ts`:
  - `THEME_COOKIE_NAME = "sf-theme"`, `LOCALE_COOKIE_NAME = "sf-locale"`, `PREFERENCE_COOKIE_MAX_AGE_SECONDS = 31_536_000` (một năm).
  - `THEME_PREFERENCES = ["system", "light", "dark"] as const`; `type ThemePreference`; `DEFAULT_THEME_PREFERENCE = "system" satisfies ThemePreference`.
  - `type PreferenceCookie = { readonly name: typeof THEME_COOKIE_NAME; readonly value: ThemePreference } | { readonly name: typeof LOCALE_COOKIE_NAME; readonly value: Locale }`.
  - `parseThemePreference(value: string | undefined): ThemePreference`: giá trị không nằm trong danh sách (kể cả khác hoa thường) thành `system`.
  - `parseLocalePreference(value: string | undefined): Locale | null`: giá trị lạ thành `null` (layout sẽ chuyển sang `Accept-Language`).
  - `serializePreferenceCookie(cookie: PreferenceCookie, options: { readonly isSecure: boolean }): string`, ra đúng `<name>=<value>; Path=/; Max-Age=31536000; SameSite=Lax`, thêm `; Secure` khi `isSecure`. Giá trị chỉ đến từ danh sách cho phép nên không cần mã hóa.
  - `writePreferenceCookie(cookie: PreferenceCookie, options: { readonly isSecure: boolean }): void` gán `document.cookie`. Nơi gọi truyền `isSecure: env.isProduction` (Task 5).

**Test viết trước:**

- `supported-locales.test.ts`: `accepts %s as a supported locale` (`it.each` `vi`, `en`); `rejects %s` (`it.each` `fr`, `EN`, `vi-VN`, chuỗi rỗng); `falls back to en`.
- `preference-cookies.test.ts`:
  - `parses %s as the %s theme preference` (`it.each`: `light`, `dark`, `system`, `undefined` → `system`, `Dark` → `system`, `blue` → `system`).
  - `parses %s as the %s locale preference` (`it.each`: `vi`, `en`, `undefined` → `null`, `fr` → `null`).
  - `serializes a preference cookie with path, max age and SameSite`; `adds Secure when requested`.
  - `writes a cookie that document.cookie reads back` (với `isSecure: false`; `afterEach` xóa cookie bằng `Max-Age=0` để test độc lập).

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add supported locales and preference cookies`

## Task 5: CSP có nonce: `proxy.ts`, `env.ts`, `zod-config.ts`

**Mục tiêu:** mọi trang có header CSP với nonce riêng cho từng request; layout đọc được nonce qua header `x-nonce`; `env.ts` là nơi duy nhất đọc `process.env`; Zod chạy chế độ `jitless` ở frontend.

**Loại:** A. **Phụ thuộc:** Task 2. **Đợt:** 4.

**File sở hữu:** tạo `frontend/src/proxy.ts`, `frontend/src/proxy.test.ts`, `frontend/src/lib/security/content-security-policy.ts`, `content-security-policy.test.ts`, `frontend/src/lib/env.ts`, `env.test.ts`, `frontend/src/lib/zod-config.ts`, `zod-config.test.ts`.

**Cài đặt** (spec mục 11 "Content Security Policy"):

- **Xác minh trước:** đọc hướng dẫn CSP của Next.js 16 (`grep -rl "nonce" frontend/node_modules/next/dist/docs` nếu thư mục tồn tại, hoặc Context7) và tìm tên type cấu hình proxy trong `frontend/node_modules/next/dist/server/web/types.d.ts` (`ProxyConfig` hoặc `MiddlewareConfig`). Khác với mô tả dưới đây thì làm theo tài liệu của Next.js 16.3 và ghi vào báo cáo.
- `lib/env.ts`:
  - `NODE_ENVIRONMENTS = ["development", "production", "test"] as const`; `type Environment = { readonly nodeEnvironment: NodeEnvironment; readonly isDevelopment: boolean; readonly isProduction: boolean }`.
  - `readEnvironment(source: { readonly NODE_ENV: string | undefined }): Environment`; giá trị khác ba giá trị trên thì throw `Error` (lỗi cấu hình tại biên).
  - `export const env: Environment = readEnvironment({ NODE_ENV: process.env.NODE_ENV })`. Phải viết nguyên văn `process.env.NODE_ENV` để Next.js thay giá trị vào bundle client. Không dùng Zod trong file này (Vấn đề 13).
- `lib/security/content-security-policy.ts`:
  - `NONCE_HEADER_NAME = "x-nonce"`, `CONTENT_SECURITY_POLICY_HEADER_NAME = "Content-Security-Policy"`.
  - `buildContentSecurityPolicy(input: { readonly nonce: string; readonly isDevelopment: boolean }): string`: các directive đúng thứ tự và giá trị ở bảng trong spec mục 11, nối bằng `"; "`. `'unsafe-eval'` chỉ khi `isDevelopment`; `upgrade-insecure-requests` chỉ khi không phải development.
- `proxy.ts`:
  - `export function proxy(request: NextRequest): NextResponse`: nonce là `btoa(crypto.randomUUID())`; dựng policy với `env.isDevelopment`; chép `request.headers` sang `Headers` mới, đặt `x-nonce` và `Content-Security-Policy`; `NextResponse.next({ request: { headers } })`; đặt `Content-Security-Policy` trên response.
  - `export const config` có type annotation của Next (không `as const`, không giá trị tính toán, vì Next.js đọc tĩnh): `matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)", missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }] }]`.
- `lib/zod-config.ts`: chỉ gọi `z.config({ jitless: true })`, comment lý do (Zod 4 dùng `new Function` để biên dịch parser object, CSP có nonce chặn eval). Zod 4.6.4 lưu cấu hình ở `globalThis.__zod_globalConfig`, nên lời gọi này áp cho cả bản Zod mà core dùng. Task 13 import file này đầu tiên trong `AppProviders`.

**Test viết trước:**

- `env.test.ts`: `reads %s as the node environment` (`it.each` ba giá trị, kiểm tra `isDevelopment`, `isProduction`); `throws for an unsupported NODE_ENV` (`it.each` `staging`, `undefined`).
- `content-security-policy.test.ts`: `includes the %s directive` (`it.each` đủ 11 directive); `puts the nonce and strict-dynamic in script-src`; `allows unsafe-eval only in development`; `adds upgrade-insecure-requests only outside development`; `allows inline styles`; `forbids framing, plugins and cross-origin connections`.
- `proxy.test.ts`, dòng đầu `// @vitest-environment node`, tạo `new NextRequest("http://localhost/schemas/abc")`:
  - `sets a Content-Security-Policy header with a nonce on the response` (lấy nonce bằng regex `'nonce-([^']+)'`).
  - `forwards the same nonce to the request as x-nonce`: Next.js 16.3.5 mã hóa header chuyển tiếp thành header response `x-middleware-request-<tên>` (`next/dist/server/web/spec-extension/response.js`), nên đọc `x-middleware-request-x-nonce`.
  - `forwards the Content-Security-Policy header to the request`.
  - `generates a different nonce for each request`.
  - `skips static assets and prefetch requests`: dùng `unstable_doesMiddlewareMatch` của `next/experimental/testing/server` (tên vẫn là middleware ở 16.3.5; đọc chữ ký trong `middleware-testing-utils.d.ts`) với `/schemas/abc` (khớp), `/_next/static/chunk.js` (không khớp), request có header `next-router-prefetch` (không khớp). Helper không hỗ trợ `missing` thì thay bằng so `config` với literal mong đợi và ghi vào báo cáo.
- `zod-config.test.ts`: `enables zod jitless mode` (`z.config().jitless` là `true` sau khi import); `parses an object schema without constructing Function` (`vi.spyOn(globalThis, "Function")`, spy không được gọi).

**Kiểm tra:** như "Quy ước chung", thêm `grep -rn "process\.env" frontend/src --include=*.ts --include=*.tsx | grep -v "src/lib/env.ts"`; mong đợi không in dòng nào.

**Commit:** `feat(frontend): add nonce-based content security policy`

## Task 6: Database Dexie, record, `isSchemaId`, lỗi lưu trữ

**Mục tiêu:** database `schemaforge` version 1 có kiểu mà không cần `as` hay `!`; record đọc từ IndexedDB được kiểm tra hình dạng; `schemaId` trên URL được kiểm tra trước khi truy vấn; lỗi của Dexie và IndexedDB được ánh xạ sang `StorageErrorCode`. Repository (Task 15) dựng trên các phần này.

**Loại:** A. **Phụ thuộc:** Task 2. **Đợt:** 4.

**File sở hữu:** tạo trong `frontend/src/lib/storage/`: `database.ts`, `database.test.ts`, `records.ts`, `records.test.ts`, `schema-id.ts`, `schema-id.test.ts`, `storage-error.ts`, `storage-error.test.ts`.

**Cài đặt** (spec mục 7 "Database", "Đọc: luôn qua `parseSchemaDocument`", "Lỗi lưu trữ"; mục 1 "Màn hình editor"):

- **Xác minh trước:** đọc `frontend/node_modules/dexie/dist/dexie.d.ts` để lấy đúng tên `EntityTable`, `DexieOptions` và chữ ký constructor của lớp lỗi (`Dexie.MissingAPIError`, `Dexie.AbortError`…).
- `schema-id.ts`: `isSchemaId(value: string): boolean`, regex UUID chữ thường `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` (dạng `crypto.randomUUID()` sinh ra; khóa trong Dexie phân biệt hoa thường nên chữ hoa là "không tìm thấy"). File không import Dexie hay Zod, vì `page.tsx` của route editor (Server Component) sẽ import.
- `records.ts`:
  - Schema Zod: `schemaRecordSchema` (`id` qua `isSchemaId`, `name: string`, `createdAt`, `updatedAt` là số nguyên không âm), `viewportRecordSchema` (`schemaId` qua `isSchemaId`, `x`, `y` là số hữu hạn, `zoom` là số dương).
  - `type SchemaRecord = Readonly<z.infer<typeof schemaRecordSchema>>`, `type ViewportRecord = Readonly<z.infer<typeof viewportRecordSchema>>`, `type DocumentRecord = { readonly schemaId: string; readonly document: unknown }`. `document` là `unknown` để code không dùng được tài liệu khi chưa qua `parseSchemaDocument`.
  - `parseSchemaRecord(value: unknown): SchemaRecord | null`, `parseViewportRecord(value: unknown): ViewportRecord | null` dùng `safeParse`.
  - Không import `zod-config.ts`: mọi lần parse chạy sau khi `AppProviders` (Task 13) đã nạp cấu hình `jitless`.
- `database.ts`:
  - `DATABASE_NAME = "schemaforge"`.
  - `export class SchemaforgeDatabase extends Dexie`, khai báo bảng bằng `declare readonly schemas: EntityTable<SchemaRecord, "id">;` (tương tự `documents` với khóa `"schemaId"`, `viewports` với khóa `"schemaId"`). `declare` không sinh field lúc chạy nên không đè bảng mà Dexie gắn vào instance, và không cần `!` hay `as` như ví dụ trong tài liệu Dexie (Vấn đề 14).
  - Constructor nhận `options?: DexieOptions`, gọi `super(DATABASE_NAME, options)` rồi `this.version(1).stores({ schemas: "id, updatedAt", documents: "schemaId", viewports: "schemaId" })`.
  - Comment ở `version(1)`: đổi cấu trúc thì thêm `version(n + 1)` kèm `.upgrade()`, không sửa version cũ; mỗi version mới có test mở database tạo ở version trước.
  - Test và code chạy thật truyền `indexedDB`, `IDBKeyRange` qua `options` (test dùng `new IDBFactory()` của `fake-indexeddb` cho từng test để dữ liệu không lẫn).
- `storage-error.ts`:
  - `STORAGE_ERROR_CODES = ["quota-exceeded", "unavailable", "outdated-tab", "closed", "unknown"] as const`; `type StorageErrorCode`.
  - `toStorageErrorCode(error: unknown): StorageErrorCode`: gom tên lỗi dọc chuỗi `inner` (Dexie bọc lỗi gốc trong `inner`), tối đa `MAX_INNER_ERROR_DEPTH = 5` cấp. Thứ tự ưu tiên (Vấn đề 17): có `QuotaExceededError` → `quota-exceeded`; có `VersionError` → `outdated-tab`; có `DatabaseClosedError` → `closed`; có `MissingAPIError`, `OpenFailedError` hoặc `InvalidStateError` → `unavailable`; còn lại → `unknown`.
  - `getStorageErrorName(error: unknown): string`: tên lỗi ngoài cùng, hoặc `"UnknownError"`; logger dùng giá trị này, không bao giờ dùng `message`.
  - Đọc `name`, `inner` bằng thu hẹp kiểu (`typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"`), không ép kiểu.
  - Sự kiện `versionchange` không phải lỗi; Task 15 hoặc 22 xử lý.

**Test viết trước:**

- `schema-id.test.ts`: `accepts a lowercase UUID`; `rejects %s` (`it.each`: chữ hoa, thiếu gạch nối, thừa ký tự, chuỗi rỗng, `../etc`).
- `records.test.ts`: `parses a valid schema record`; `returns null for a schema record with %s` (`it.each`: thiếu `name`, `id` không phải UUID, `updatedAt` âm, `createdAt` không phải số); `parses a valid viewport record`; `returns null for a viewport record with %s` (`it.each`: `zoom` bằng 0, `x` là `NaN`, thiếu `schemaId`); `strips unknown keys from a parsed record`.
- `database.test.ts` (`afterEach` đóng database):
  - `creates the schemaforge database with schemas, documents and viewports tables`.
  - `keys schemas by id and indexes them by updatedAt`; `keys documents and viewports by schemaId`.
  - `returns schema records ordered by updatedAt`.
  - `keeps databases on separate IDBFactory instances isolated`.
  - `fails to open with MissingAPIError when IndexedDB is unavailable` (jsdom không có `indexedDB`, tạo database không truyền `options`).
- `storage-error.test.ts`: `maps %s to %s` (`it.each` đủ mọi dòng trong bảng ở spec mục 7, dùng `DOMException` và object có `name`); `finds a QuotaExceededError nested in inner`; `maps a real Dexie MissingAPIError to unavailable`; `prefers outdated-tab when an OpenFailedError wraps a VersionError`; `stops following inner errors after the maximum depth` (chuỗi `inner` vòng tròn); `returns unknown for %s` (`it.each`: `null`, chuỗi, số); `reads the outermost error name for logging`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add dexie database, records and storage errors`

## Task 7: Khóa schema theo tab (Web Locks) và khóa giả cho test

**Mục tiêu:** một schema chỉ sửa được ở một tab nhờ khóa exclusive của Web Locks, qua interface `SchemaLockManager` để test dùng bản giả có cùng ngữ nghĩa.

**Loại:** A. **Phụ thuộc:** Task 2. **Đợt:** 4.

**File sở hữu:** tạo `frontend/src/lib/storage/schema-lock-manager.ts`, `schema-lock-manager.test.ts`, `frontend/src/testing/fake-lock-registry.ts`, `fake-lock-registry.test.ts`.

**Cài đặt** (spec mục 7 "Cùng một schema ở hai tab"):

- `schema-lock-manager.ts`:

  ```ts
  type SchemaLock = { readonly release: () => void };
  type SchemaLockManager = {
    readonly tryAcquire: (schemaId: string) => Promise<SchemaLock | null>;
    readonly acquire: (schemaId: string, signal: AbortSignal) => Promise<SchemaLock>;
  };
  type LockRequestOptions = { readonly mode: "exclusive"; readonly ifAvailable?: boolean; readonly signal?: AbortSignal };
  type LockRequest = (
    name: string,
    options: LockRequestOptions,
    callback: (lock: Lock | null) => Promise<void> | undefined,
  ) => Promise<void>;

  function getSchemaLockName(schemaId: string): string; // "schemaforge:schema:<schemaId>"
  function createSchemaLockManager(request: LockRequest): SchemaLockManager;
  function createBrowserSchemaLockManager(): SchemaLockManager;
  ```

  - Khóa được giữ bằng cách trả từ callback một promise chỉ resolve khi gọi `release()`; `release()` gọi lần hai không làm gì.
  - `tryAcquire` dùng `ifAvailable: true`; callback nhận `null` thì trả `null`.
  - `acquire` chờ tới khi được cấp; signal bị hủy trong lúc chờ thì reject bằng lỗi `AbortError` mà `request` trả về. Lỗi khác của `request` được chuyển tiếp, không nuốt.
  - `createBrowserSchemaLockManager`: không có `navigator.locks` (ngoài secure context) thì throw `Error` nêu rõ cần secure context (Vấn đề 15); ngược lại bọc `navigator.locks.request`.
  - Port `LockRequest` hẹp thay vì kiểu `LockManager` của DOM, vì `LockManager.request` có nhiều overload generic khó dựng bản giả mà không ép kiểu.
- `testing/fake-lock-registry.ts`: `createFakeLockRegistry(): { readonly request: LockRequest; readonly isHeld: (name: string) => boolean; readonly countWaiting: (name: string) => number }`. Mô phỏng khóa exclusive của Web Locks trong bộ nhớ, state nằm trong closure:
  - Hàng đợi FIFO theo tên; tên khác nhau không chặn nhau.
  - `ifAvailable` khi đang bị giữ thì gọi callback với `null` ngay.
  - Được cấp thì gọi callback với `{ name, mode: "exclusive" }`, giữ khóa tới khi promise của callback settle, rồi cấp cho yêu cầu kế tiếp; promise của `request` resolve sau khi khóa được nhả.
  - Signal đã hủy từ trước, hoặc bị hủy khi đang chờ: bỏ khỏi hàng đợi, reject `new DOMException("The request was aborted.", "AbortError")`.
  - Test tích hợp hai tab (Task 31) tạo hai `SchemaLockManager` từ cùng một registry.

**Test viết trước:**

- `schema-lock-manager.test.ts` (dùng `createFakeLockRegistry`):
  - `names the lock after the schema id`.
  - `acquires a free lock without waiting`.
  - `returns null from tryAcquire while another holder has the lock`.
  - `waits in acquire until the current holder releases`.
  - `rejects acquire with AbortError when the signal aborts while waiting`; `removes an aborted request from the queue`.
  - `ignores a second release call`.
  - `throws when the Web Locks API is unavailable`.
  - `delegates to navigator.locks.request in the browser manager` (gắn tạm `navigator.locks` bằng `Object.defineProperty` với `request` của registry, gỡ ở `afterEach`).
- `fake-lock-registry.test.ts`: `grants requests for the same name in order`; `does not block requests for other names`; `calls back with null for ifAvailable while the lock is held`; `rejects immediately for an already aborted signal`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add per-schema tab lock manager`

## Task 8: `shouldHandleShortcut` và nhận diện phím tắt

**Mục tiêu:** hàm thuần quyết định một `keydown` có phải phím tắt undo, redo, xóa lựa chọn hay không, và có được xử lý trong ngữ cảnh hiện tại hay không. Hook `useEditorShortcuts` (Task 20) chỉ nối hàm này với store.

**Loại:** A (không import core). **Phụ thuộc:** Task 2. **Đợt:** 4.

**File sở hữu:** tạo `frontend/src/features/editor/lib/should-handle-shortcut.ts`, `should-handle-shortcut.test.ts`.

**Cài đặt** (spec mục 6 "Phím tắt", mục 3 "Chọn, di chuyển, xóa"):

```ts
type ShortcutAction = "undo" | "redo" | "deleteSelection";
type ShortcutPlatform = "mac" | "other";
type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "isComposing" | "defaultPrevented" | "target"
>;
type ShortcutContext = {
  readonly requiresCanvasFocus: boolean;
  readonly isDialogOpen: boolean;
  readonly canvasElement: Element | null;
};

function getShortcutPlatform(platformHint: string): ShortcutPlatform;
function matchShortcut(event: ShortcutKeyEvent, platform: ShortcutPlatform): ShortcutAction | null;
function shouldHandleShortcut(event: ShortcutKeyEvent, context: ShortcutContext): boolean;
```

- `getShortcutPlatform`: chuỗi chứa `Mac`, `iPhone`, `iPad` (không phân biệt hoa thường) là `mac`, còn lại `other`. Hook truyền `navigator.userAgentData?.platform ?? navigator.platform`.
- `matchShortcut` (so `key` theo chữ thường):
  - `mac`: `⌘Z` là `undo`; `⌘⇧Z` là `redo`; không nhận `Ctrl`.
  - `other`: `Ctrl+Z` là `undo`; `Ctrl+Shift+Z` và `Ctrl+Y` là `redo`; không nhận `Meta`.
  - `Delete` hoặc `Backspace` không kèm phím bổ trợ là `deleteSelection` trên cả hai nền tảng.
  - Có `Alt` (kể cả AltGr là `Ctrl+Alt`) thì không khớp.
- `shouldHandleShortcut` trả `false` khi:
  - `defaultPrevented`;
  - `isComposing`, hoặc `key === "Process"` (IME ở một số trình duyệt);
  - target là `input`, `textarea`, `select`, hoặc nằm trong phần tử khớp `[contenteditable]:not([contenteditable="false"])` (dùng `closest`, vì jsdom không có `isContentEditable`, Vấn đề 10);
  - `isDialogOpen`;
  - `requiresCanvasFocus` và target không phải `body` của document, cũng không nằm trong `canvasElement`.
- Target không phải `Element` (ví dụ `window`) được coi như `body`. Thu hẹp bằng `instanceof Element`.

**Test viết trước** (event là object thỏa `ShortcutKeyEvent`, target là phần tử tạo bằng `document.createElement` và gắn vào `document.body`):

- `matches %s on %s as %s` (`it.each`: `⌘Z` mac → `undo`; `Ctrl+Z` other → `undo`; `⌘⇧Z` với `key` `"Z"` mac → `redo`; `Ctrl+Shift+Z` other → `redo`; `Ctrl+Y` other → `redo`; `Delete` → `deleteSelection`; `Backspace` → `deleteSelection`).
- `does not match %s on %s` (`it.each`: `Ctrl+Z` mac; `⌘Z` other; `Ctrl+Alt+Z` other; `Ctrl+Y` mac; `Alt+Backspace`; `z` không kèm phím bổ trợ).
- `detects %s as the %s platform` (`it.each`: `MacIntel`, `macOS`, `iPad`, `Win32`, `Linux x86_64`, chuỗi rỗng).
- `handles a shortcut whose target is the body`.
- `ignores a prevented event`; `ignores a key event during IME composition`; `ignores the IME Process key`.
- `ignores events from %s` (`it.each`: `input`, `textarea`, `select`, phần tử con của `div[contenteditable]`, `div[contenteditable="true"]`); `handles events from an element with contenteditable false`.
- `ignores shortcuts while a dialog is open`.
- `handles a canvas-only shortcut from inside the canvas`; `ignores a canvas-only shortcut from a panel button`; `handles an editor-wide shortcut from a panel button`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add editor shortcut matching`

## Task 9: Hạ tầng i18n, resource có kiểu, `LanguageSwitch`

**Mục tiêu:** i18next khởi tạo đồng bộ ở cả server và client với resource TypeScript có kiểu; key sai, thiếu key hay thừa key trong `vi` là lỗi biên dịch; locale của request được chọn theo cookie rồi `Accept-Language`; người dùng đổi được ngôn ngữ mà editor không mount lại.

**Loại:** A. **Phụ thuộc:** Task 3, 4, 5, 6. **Đợt:** 5.

**File sở hữu:** tạo
- trong `frontend/src/lib/i18n/`: `locale-namespace.ts`, `resources.ts`, `resources.test.ts`, `create-i18n-instance.ts`, `create-i18n-instance.test.ts`, `server-translation.ts`, `server-translation.test.ts`, `negotiate-locale.ts`, `negotiate-locale.test.ts`, `change-locale.ts`, `change-locale.test.ts`, `i18next.d.ts`;
- trong `frontend/src/lib/i18n/locales/en/` và `locales/vi/`: `common.ts`, `storage.ts`, `issues.ts`, `errors.ts`, `schema-list.ts`, `canvas.ts`, `editor.ts`, và `editor/screen.ts`, `editor/toolbar.ts`, `editor/left-panel.ts`, `editor/table-panel.ts`, `editor/relation-panel.ts`, `editor/relation-dialog.ts`, `editor/editor-layout.ts`;
- `frontend/src/components/i18n-provider.tsx`, `i18n-provider.test.tsx`, `frontend/src/components/language-switch.tsx`, `language-switch.test.tsx`.

**Cài đặt** (spec mục 9):

- `locale-namespace.ts`: `type LocaleNamespace<T> = { readonly [K in keyof T]: T[K] extends string ? string : LocaleNamespace<T[K]> }`.
- **Resource.** Mỗi file `en` export một object `as const` tên `en<Tên>` (`enCommon`, `enEditorToolbar`…); file `vi` tương ứng export `vi<Tên>` với `as const satisfies LocaleNamespace<typeof en<Tên>>`. Tên tiếng Việt có đủ dấu.
  - `common`: `actions` (`cancel`, `close`, `confirm`, `create`, `delete`, `open`, `rename`, `retry`, `undo`, `reload`); `theme` (`label`, `system`, `light`, `dark`); `language` (`label`, `shortName` là `VI`/`EN`, `vi` là "Tiếng Việt" ở cả hai locale, `en` là "English" ở cả hai locale); `saveStatus` (`saving`, `saved`, `failed`); `notifications` (`label`: nhãn vùng toast).
  - `storage`: đúng một key cho mỗi `StorageErrorCode`, thêm `satisfies Record<StorageErrorCode, string>` ở cả hai locale. Nội dung theo cột "Thông báo" ở spec mục 7 "Lỗi lưu trữ", ví dụ `quota-exceeded`: "Bộ nhớ trình duyệt đã đầy. Hãy xóa bớt schema rồi thử lại." / "Browser storage is full. Delete some schemas and try again."
  - `issues`, `errors`, `schema-list`, `canvas` và bảy file con của `editor`: object rỗng `{}`, để task B trong bảng "Chủ sở hữu file resource i18n" điền.
  - `editor.ts`: chỉ gộp file con thành `{ screen, toolbar, leftPanel, tablePanel, relationPanel, relationDialog, layout }`.
- `resources.ts`: `NAMESPACES = ["common", "schemaList", "editor", "canvas", "issues", "errors", "storage"] as const`; `type Namespace`; `DEFAULT_NAMESPACE = "common" satisfies Namespace`; `enResources` (`as const`); `viResources` (`as const satisfies LocaleNamespace<typeof enResources>`); `RESOURCES = { en: enResources, vi: viResources }` với `satisfies Record<Locale, LocaleNamespace<typeof enResources>>`.
- `i18next.d.ts`: `declare module "i18next" { interface CustomTypeOptions { defaultNS: typeof DEFAULT_NAMESPACE; resources: typeof enResources } }`, dùng `import type` (Task 2 đã tắt `consistent-type-definitions` cho file này).
- `create-i18n-instance.ts`: `createI18nInstance(locale: Locale): i18n`. Gọi `createInstance()` rồi `init({ lng: locale, fallbackLng: DEFAULT_LOCALE, supportedLngs: [...SUPPORTED_LOCALES], ns: [...NAMESPACES], defaultNS: DEFAULT_NAMESPACE, resources: RESOURCES, interpolation: { escapeValue: false }, initAsync: false, react: { useSuspense: false } })`. Promise của `init` được đánh dấu `void` kèm comment: resource đã bundle và `initAsync: false` nên khởi tạo xong đồng bộ; test xác nhận điều đó.
- `server-translation.ts`: `getServerTranslation<N extends Namespace>(locale: Locale, namespace: N)` trả `getFixedT(locale, namespace)` của một instance **mới** mỗi lần gọi, không có instance ở cấp module. Kiểu trả về lấy theo chữ ký `getFixedT` của i18next 26.4; không biên dịch được mà không ép kiểu thì dừng và báo.
- `negotiate-locale.ts`:
  - `negotiateLocale(acceptLanguage: string | null): Locale | null`: tách theo dấu phẩy, tối đa `MAX_LANGUAGE_RANGES = 32` mục (header không tin cậy); mỗi mục là tag và `q` (mặc định 1; `q` không phải số trong khoảng 0–1 thì bỏ mục; `q=0` thì bỏ); bỏ `*`; lấy subtag chính, chữ thường; sắp ổn định theo `q` giảm dần; trả locale được hỗ trợ đầu tiên.
  - `resolveRequestLocale(input: { readonly cookieValue: string | undefined; readonly acceptLanguage: string | null }): Locale` = `parseLocalePreference(cookieValue) ?? negotiateLocale(acceptLanguage) ?? DEFAULT_LOCALE`.
- `change-locale.ts`: `changeLocale(locale: Locale, dependencies: { readonly i18n: Pick<i18n, "changeLanguage">; readonly refresh: () => void; readonly isSecure: boolean }): Promise<void>`. Thứ tự: `await i18n.changeLanguage(locale)`; ghi cookie `sf-locale`; đặt `document.documentElement.lang`; gọi `refresh()`.
- `components/i18n-provider.tsx` (`"use client"`): props `{ readonly locale: Locale; readonly children: ReactNode }`; `const [instance] = useState(() => createI18nInstance(locale))`; bọc `I18nextProvider`.
- `components/language-switch.tsx` (`"use client"`):
  - `DropdownMenu` với nút kích hoạt `Button` (`variant="ghost"`, `size="sm"`) hiện `t("language.shortName")`, `aria-label={t("language.label")}`.
  - `DropdownMenuRadioGroup` có `value={i18n.language}`, hai `DropdownMenuRadioItem` `vi` và `en`. `onValueChange` kiểm tra `isLocale(value)` rồi gọi `changeLocale(value, { i18n, refresh: router.refresh, isSecure: env.isProduction })`, với `useRouter` của `next/navigation`.

**Test viết trước:**

- `negotiate-locale.test.ts`: `negotiates %s as %s` (`it.each`: `vi-VN,vi;q=0.9,en;q=0.8` → `vi`; `en-US,en;q=0.9` → `en`; `fr-FR,fr;q=0.9,en;q=0.5,vi;q=0.8` → `vi`; `fr,de` → `null`; chuỗi rỗng → `null`; `vi;q=0,en` → `en`; `*` → `null`; `EN-gb` → `en`; `vi;q=abc,en;q=0.5` → `en`); `keeps header order for equal weights`; `returns null for a missing header`; `ignores language ranges beyond the limit`; `prefers a valid locale cookie over the header`; `uses the header when the cookie is invalid`; `falls back to en without cookie or matching header`.
- `create-i18n-instance.test.ts`: `translates right after creation without awaiting init`; `uses en as the fallback language`; `does not escape interpolation values`; `creates independent instances` (đổi ngôn ngữ của instance này không ảnh hưởng instance kia).
- `server-translation.test.ts`: `translates a namespace in %s` (`it.each` hai locale); `returns an independent translator for each call`.
- `resources.test.ts` (spec mục 9, test bản dịch; hàm làm phẳng key viết trong file test): `has the same keys in vi and en`; `has a non-empty %s translation for %s` (`it.each` trên key đã làm phẳng × locale); `uses the same interpolation variables in vi and en for %s`; `has one storage message per storage error code`.
- `change-locale.test.ts`: `changes the i18next language`; `writes the sf-locale cookie`; `sets the html lang attribute`; `refreshes the router after the language has changed`.
- `i18n-provider.test.tsx`: `renders children with translations for the given locale`; `keeps the i18next instance when the provider rerenders`.
- `language-switch.test.tsx` (mock `next/navigation`): `names the trigger with the translated language label`; `marks the current language as checked`; `switches to English from the menu` (cookie `sf-locale=en`, `html[lang="en"]`, `refresh` được gọi một lần, nhãn đổi sang tiếng Anh). Menu Radix không mở bằng `user.click` trên jsdom thì mở bằng bàn phím (`{Enter}` khi nút đang focus) và ghi vào báo cáo.

**Kiểm tra:** như "Quy ước chung", thêm bốn thử nghiệm biên dịch tạm thời (làm từng cái, hoàn tác ngay sau đó):

1. Xóa một key trong `locales/vi/common.ts` → `pnpm --filter @schemaforge/frontend typecheck` fail tại file đó.
2. Thêm một key thừa vào `locales/vi/common.ts` → typecheck fail.
3. Xóa key `unknown` trong `locales/en/storage.ts` → typecheck fail.
4. Thêm `t("actions.doesNotExist")` vào `language-switch.tsx` → typecheck fail.

Mong đợi: cả bốn fail đúng chỗ; sau khi hoàn tác, bốn lệnh kiểm tra chung xanh và `git diff` không còn thay đổi thử.

**Commit:** `feat(frontend): add typed i18n resources and language switch`

## Task 10: Theme: `theme-init.js`, `ThemeProvider`, `ThemeSwitch`, token, `Toaster`

**Mục tiêu:** theme Theo hệ thống, Sáng, Tối được đặt trước khi vẽ bằng một script tĩnh, đổi được lúc chạy và ghi vào cookie; canvas, node, edge, minimap và toast chỉ dùng token của theme.

**Loại:** A. **Phụ thuộc:** Task 3, 4, 5, 9. **Đợt:** 6.

**File sở hữu:** sửa `frontend/src/app/globals.css`; tạo `frontend/public/theme-init.js`, `frontend/src/lib/theme/resolve-theme.ts`, `resolve-theme.test.ts`, `theme-init-script.test.ts`, `use-theme-preference.ts`, `use-theme-preference.test.tsx`, `frontend/src/components/theme-provider.tsx`, `theme-provider.test.tsx`, `theme-switch.tsx`, `theme-switch.test.tsx`, `frontend/src/components/ui/sonner.tsx`.

**Cài đặt** (spec mục 8 "Token", "Mặc định, ghi nhớ, không nháy"):

- `lib/theme/resolve-theme.ts`:
  - `type ResolvedTheme = "light" | "dark"`; `DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"`.
  - `resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme`.
  - `applyResolvedTheme(theme: ResolvedTheme): void`: bật, tắt class `dark` trên `document.documentElement` và đặt `style.colorScheme`.
- `public/theme-init.js`: IIFE ES5 khoảng mười dòng, không phụ thuộc gì. Đọc `data-theme-preference` của `<html>`; tối khi giá trị là `dark`, hoặc khác `light` và `matchMedia("(prefers-color-scheme: dark)").matches`; bật, tắt class `dark`; đặt `style.colorScheme`. Comment đầu file: giữ khớp với `resolve-theme.ts`. Task 13 render thẻ `<script src="/theme-init.js" nonce={nonce}>` trong `<head>`.
- `lib/theme/use-theme-preference.ts`: `ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null)` với `ThemePreferenceContextValue = { readonly preference: ThemePreference; readonly setPreference: (preference: ThemePreference) => void }`; `useThemePreference()` throw `Error` khi dùng ngoài provider (lỗi lập trình).
- `components/theme-provider.tsx` (`"use client"`), props `{ readonly initialPreference: ThemePreference; readonly children: ReactNode }`:
  - Giữ lựa chọn trong state, khởi tạo từ `initialPreference`. Không áp theme khi mount, vì `theme-init.js` đã áp trước khi vẽ.
  - `setPreference`: ghi cookie `sf-theme` (`isSecure: env.isProduction`), cập nhật state, `applyResolvedTheme(resolveTheme(next, matchMedia(DARK_COLOR_SCHEME_QUERY).matches))`.
  - Khi lựa chọn là `system`, một effect đăng ký listener `change` của `matchMedia` để áp lại theme, và gỡ listener khi đổi lựa chọn hoặc unmount.
  - Giá trị context được memo để consumer không render lại vô cớ.
- `components/theme-switch.tsx` (`"use client"`): nút icon (lucide) có `aria-label={t("theme.label")}` và `Tooltip` cùng nội dung; `DropdownMenuRadioGroup` với ba mục `system`, `light`, `dark`. `onValueChange` chỉ nhận giá trị có trong `THEME_PREFERENCES` (tìm bằng `find`, không ép kiểu).
- `components/ui/sonner.tsx`, viết tay thay cho bản của shadcn (Vấn đề 3):
  - `export function Toaster(props: ToasterProps & { readonly containerAriaLabel: string }): JSX.Element` render `Toaster` của `sonner` với `theme={preference}` từ `useThemePreference()` (`ThemePreference` trùng kiểu `theme` của Sonner), `className="toaster group"`, icon lucide như bản shadcn.
  - `containerAriaLabel` bắt buộc, vì mặc định của Sonner là chuỗi tiếng Anh "Notifications"; Task 13 truyền `t("notifications.label")`.
  - Không có `style` ép kiểu; biến màu nằm trong `globals.css`.
- `globals.css` (giữ nguyên phần Task 3 sinh):
  - `@import "@xyflow/react/dist/style.css";` ngay sau các `@import` sẵn có, để mọi CSS nằm trong một file và task canvas không phải import CSS.
  - Token canvas `--canvas-relation`, `--canvas-relation-selected`, `--canvas-key`, `--canvas-foreign-key` trong `:root` và `.dark`, đăng ký trong `@theme inline` dạng `--color-canvas-relation: var(--canvas-relation)`. Giá trị gợi ý: `--canvas-relation-selected` trỏ `var(--primary)`; hai token còn lại dùng giá trị `oklch` của thang màu Tailwind (amber cho khóa chính, teal cho khóa ngoại) với độ sáng khác nhau cho sáng và tối. Độ tương phản được đo tay ở Task 32.
  - `.react-flow { … }` gán đủ 18 biến `--xy-*` liệt kê ở spec mục 8 "Token", mỗi biến trỏ về token shadcn/ui hoặc token canvas (ví dụ `--xy-node-border: 1px solid var(--border)`, `--xy-edge-stroke: var(--canvas-relation)`, `--xy-selection-background-color: color-mix(in oklab, var(--primary) 8%, transparent)`).
  - `.react-flow__node:focus-visible`, `.react-flow__edge:focus-visible`: `outline: 2px solid var(--ring)`, `outline-offset: 2px`.
  - Biến của Sonner (`--normal-bg: var(--popover)`, `--normal-text: var(--popover-foreground)`, `--normal-border: var(--border)`, `--border-radius: var(--radius)`) đặt trên selector `.toaster[data-sonner-toaster][data-theme]`, vì CSS Sonner chèn lúc chạy dùng selector thuộc tính có độ ưu tiên cao hơn một class.

**Test viết trước:**

- `resolve-theme.test.ts`: `resolves %s with a dark system preference of %s to %s` (`it.each` sáu tổ hợp); `adds the dark class and dark color scheme`; `removes the dark class for the light theme`.
- `theme-init-script.test.ts`: đọc file bằng `readFileSync(new URL("../../../public/theme-init.js", import.meta.url), "utf8")` và chạy bằng `new Function(source)()`, dòng trên có `// eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the static theme script under test`. `matchMedia` giả bằng `vi.stubGlobal`; `afterEach` xóa class, `data-theme-preference` và `vi.unstubAllGlobals()`. Test: `sets the dark class for preference %s when the system prefers dark is %s` (`it.each`: `dark`, `light`, `system`, giá trị lạ; mỗi giá trị với `true` và `false`); `sets the color-scheme style`; `matches resolveTheme for %s and %s`.
- `use-theme-preference.test.tsx`: `throws when used outside ThemeProvider`.
- `theme-provider.test.tsx`: `exposes the initial preference from the server`; `writes the sf-theme cookie when the preference changes`; `adds the dark class when switching to dark`; `follows the system color scheme while the preference is system`; `stops following the system color scheme after switching to light`; `removes the system listener on unmount`.
- `theme-switch.test.tsx` (bọc `I18nProvider`, `TooltipProvider`, `ThemeProvider`): `names the trigger with the translated theme label in %s` (`it.each` `vi`, `en`); `marks the current preference as checked`; `switches to dark from the menu` (cookie `sf-theme=dark`, `<html>` có class `dark`).

**Kiểm tra:** như "Quy ước chung", thêm lệnh biên dịch `globals.css` như ở Task 3 nhưng in `result.css.includes("--xy-edge-stroke") && result.css.includes(".react-flow__node")`; mong đợi `true`.

**Commit:** `feat(frontend): add theme preference without flash of wrong theme`

## Task 11: Logger và `notify`

**Mục tiêu:** một logger duy nhất chỉ ghi mã, loại và tên lỗi; một wrapper toast chỉ nhận key i18n đã có kiểu, nên toast không thể mang chuỗi hardcode.

**Loại:** A. **Phụ thuộc:** Task 2, 9. **Đợt:** 6.

**File sở hữu:** tạo trong `frontend/src/lib/`: `logger.ts`, `logger.test.ts`, `notify.ts`, `notify.test.ts`, `use-notify.ts`, `use-notify.test.tsx`.

**Cài đặt** (spec mục 3 "Lỗi cấu trúc khi dispatch", mục 7 "Lỗi lưu trữ", mục 9 "Lint", mục "Cấu trúc thư mục"):

- `logger.ts`:
  - `type LogValue = string | number | boolean | readonly (string | number)[]`; `type LogFields = Readonly<Record<string, LogValue>>`; `type LogSink = Pick<Console, "error" | "warn">`.
  - `type Logger = { readonly error: (event: string, fields?: LogFields) => void; readonly warn: (event: string, fields?: LogFields) => void }`.
  - `createLogger(sink: LogSink): Logger` gọi `sink.error("[schemaforge]", event, fields ?? {})` (tương tự `warn`).
  - `export const logger: Logger = createLogger(console)`.
  - Comment trên `LogFields`: chỉ truyền mã lỗi, loại operation, đường dẫn trong tài liệu và tên lỗi; không truyền tên, comment hay nội dung schema. Kiểu đường dẫn là mảng chung vì task loại A không import `DocumentPath` của core.
  - `no-console` chỉ bắt lời gọi `console.*`, không bắt việc truyền `console` làm giá trị. Lint không báo thì **không** thêm comment tắt rule, vì `reportUnusedDisableDirectives` đang ở mức `error`.
- `notify.ts` (file duy nhất được import `toast` từ `sonner`):
  - `type TranslationKey = ParseKeys<Namespace[]>` của i18next (key dạng `"storage:unknown"`, `"common:actions.retry"`).
  - `type NotifyTone = "success" | "error" | "info"`.
  - `type NotifyInput = { readonly tone: NotifyTone; readonly titleKey: TranslationKey; readonly descriptionKey?: TranslationKey; readonly values?: Readonly<Record<string, string | number>>; readonly action?: { readonly labelKey: TranslationKey; readonly onSelect: () => void } }`; `type Notify = (input: NotifyInput) => void`.
  - `type Translate = (key: TranslationKey, values?: Readonly<Record<string, string | number>>) => string`; `type ToastPort = Pick<typeof toast, NotifyTone>`.
  - `createNotify(translate: Translate, toastPort: ToastPort = toast): Notify` gọi `toastPort[tone](translate(titleKey, values), { description, action: { label, onClick: onSelect } })`, bỏ `description`, `action` khi không có.
- `use-notify.ts`: `useNotify(): Notify` lấy `t` từ `useTranslation([...NAMESPACES])` và trả `useMemo(() => createNotify((key, values) => t(key, values)), [t])`.
- `ParseKeys` không nhận key có tiền tố namespace, hoặc lời gọi `t` với union key không biên dịch được trên i18next 26.4 mà không ép kiểu, thì dừng và báo kèm lỗi `tsc` (Vấn đề 20).

**Test viết trước:**

- `logger.test.ts`: `writes an error event with its fields to the sink`; `writes a warning event to the sink`; `passes empty fields when none are given`.
- `notify.test.ts` (`translate` giả trả chuỗi ghép key và giá trị; `toastPort` gồm `vi.fn()`): `shows a translated %s toast` (`it.each` ba tone); `translates the description with interpolation values`; `omits the description when no key is given`; `adds a translated action that calls onSelect`.
- `use-notify.test.tsx` (`vi.mock("sonner")`, `renderHook` bọc `I18nProvider` locale `vi`): `shows toast text translated in the provider locale`; `returns the same notify function across rerenders`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add logger and translated toast wrapper`

## Task 12: Helper test component: `renderWithProviders`, `expectNoAxeViolations`, `matchMedia` giả

**Mục tiêu:** task B viết test component và test tích hợp ngắn gọn, cùng một cách dựng provider, cùng một cách kiểm tra axe ở hai theme.

**Loại:** A. **Phụ thuộc:** Task 3, 9, 10. **Đợt:** 7.

**File sở hữu:** tạo trong `frontend/src/testing/`: `render-with-providers.tsx`, `render-with-providers.test.tsx`, `expect-no-axe-violations.ts`, `expect-no-axe-violations.test.tsx`, `match-media-stub.ts`, `match-media-stub.test.ts`.

**Cài đặt** (spec mục 12 "Kiểm tra tự động", mục 14):

- `match-media-stub.ts`: `stubMatchMedia(options: { readonly prefersDark: boolean }): { readonly setPrefersDark: (isDark: boolean) => void; readonly restore: () => void }`. Thay `window.matchMedia` bằng `vi.stubGlobal`; đối tượng trả về có `matches`, `media`, `addEventListener`, `removeEventListener`; `setPrefersDark` đổi `matches` của query `(prefers-color-scheme: dark)` và gọi listener `change`.
- `render-with-providers.tsx`:
  - `renderWithProviders(ui: ReactElement, options?: { readonly locale?: Locale; readonly themePreference?: ThemePreference }): RenderResult & { readonly user: UserEvent }`. Mặc định `locale` là `vi`, `themePreference` là `light`.
  - Trước khi render: đặt `document.documentElement.lang` và áp class theme bằng `applyResolvedTheme(resolveTheme(themePreference, false))`, thay cho `theme-init.js` không chạy trong test.
  - Bọc `I18nProvider` → `ThemeProvider` → `TooltipProvider` → `ui` và `Toaster` (nhãn vùng lấy bằng `useTranslation` trong một component nhỏ cùng file).
  - `user` là `userEvent.setup()`.
- `expect-no-axe-violations.ts`: `expectNoAxeViolations(container: Element): Promise<void>` gọi `axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, rules: { "color-contrast": { enabled: false } } })` rồi `expect` danh sách `{ id, targets }` của vi phạm bằng `[]`, để thông báo lỗi dễ đọc. Comment: axe-core không cho chạy song song, nên luôn `await` từng lần gọi.

**Test viết trước:**

- `match-media-stub.test.ts`: `reports the initial dark preference`; `notifies change listeners when the preference changes`; `restores the original matchMedia`.
- `render-with-providers.test.tsx`: `renders Vietnamese translations by default`; `renders translations for the requested locale`; `applies the dark class for the dark theme`; `provides a user-event instance that can click`; `renders tooltips without a missing provider error`.
- `expect-no-axe-violations.test.tsx`: `passes for a labelled button`; `fails for a button without an accessible name`; `does not report color contrast`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `test(frontend): add component test helpers`

## Vấn đề phát hiện khi lập plan

Các vấn đề dưới đây không đổi quyết định nào của spec; mỗi dòng nêu chỗ hở hoặc chỗ va chạm với thực tế của thư viện và cách plan xử lý. Vấn đề cần user quyết định được đánh dấu **(cần user xác nhận)**. Lượt lập plan thứ hai thêm vấn đề mới từ số 23.

| # | Vấn đề | Cách xử lý trong plan | Task |
|---|---|---|---|
| 1 | Spec ghi `lucide-react` 1.46.0, nhưng bản này phát hành 2026-09-14T09:23Z, chưa đủ 24 giờ lúc kiểm tra (2026-09-15T02:05Z); pnpm sẽ từ chối | Dùng `^1.45.0` (2026-09-11). pnpm tự chọn bản mới nhất đã đủ 24 giờ lúc cài | 1 |
| 2 | Bảng "Phiên bản" của spec thiếu `tailwindcss`, `postcss` (hướng dẫn cài Tailwind CSS 4 cho Next.js cần cả hai) và `zod` cho frontend (`z.config` ở mục 11, schema record ở mục 7) | Thêm `tailwindcss` 4.3.3, `postcss` 8.5.28, `zod: catalog:`. Zod 4.6.4 lưu cấu hình ở `globalThis.__zod_globalConfig`, nên `z.config({ jitless: true })` ở frontend áp cho cả bản Zod mà core dùng | 1, 5 |
| 3 | Mục `sonner` trong registry của shadcn/ui 4 import `useTheme` từ `next-themes` (spec loại gói này) và dùng `as React.CSSProperties`; Sonner còn mặc định nhãn vùng toast tiếng Anh "Notifications" | Không chạy `shadcn add sonner`. Task 10 viết tay `components/ui/sonner.tsx`: `theme` lấy từ `ThemeProvider`, `containerAriaLabel` là prop bắt buộc, biến màu đặt trong `globals.css` với selector `.toaster[data-sonner-toaster][data-theme]`. Màu toast đúng theme được kiểm tra tay ở Task 32 | 3, 10, 13, 32 |
| 4 | `shadcn init` 4.21.0 thêm `@import "shadcn/tailwind.css"` và dependency `shadcn`, trái với spec ("không cài làm dependency") và quy tắc lockfile | Task 3 chạy `shadcn eject` để chép CSS vào `globals.css`, rồi khôi phục `package.json`, lockfile về HEAD; `git diff --exit-code` phải sạch | 3 |
| 5 | Shadcn CLI kiểm tra import alias trong `tsconfig.json`, mà frontend chưa có `paths` | Task 1 thêm `@/*` vào `tsconfig.json` và alias `@` vào `vitest.config.ts` | 1 |
| 6 | Code shadcn/ui sinh ra vi phạm lint của phần 1: rule tên boolean với `asChild` và prop của Radix, DOM, React Flow (`open`, `disabled`, `checked`, `selected`…); thiếu kiểu trả về; có `as` | Task 2 thêm `filter` loại trừ danh sách tên boolean do API ngoài đặt sẵn. Task 3 thêm kiểu trả về, bỏ `as`, đổi `showCloseButton` thành `hasCloseButton` | 2, 3 |
| 7 | `react.md` yêu cầu một component export mỗi file, còn file shadcn/ui export nhiều phần (`Dialog`, `DialogContent`…) | Giữ cấu trúc shadcn/ui trong `components/ui/` như ngoại lệ có chủ đích (code sinh ra, tách file làm khó cập nhật bằng CLI). Component của ứng dụng vẫn theo quy tắc. Không có rule lint nào bị ảnh hưởng | 3 |
| 8 | Spec mục 2 gọi ô chọn kiểu cột là "combobox có ba nhóm". Combobox của shadcn/ui là `Popover` + `Command`, cần thêm gói `cmdk` không có trong bảng phiên bản | Dùng `Popover` + `Command` (cmdk) của shadcn/ui, gõ để lọc ba nhóm (17 kiểu chung, enum, "Kiểu custom…"). Một task dependency riêng cài `cmdk` trước Task 3; Task 3 thêm component shadcn `command` và `popover` | 3, 26 |
| 9 | Tùy chọn của `no-restricted-properties` và `no-restricted-imports` ở khối cấu hình sau thay hẳn khối trước, nên thêm `navigator.sendBeacon` hay cấm `toast` theo thư mục dễ làm mất giới hạn `process.env` hoặc cấm import chéo | Task 2 tách hằng `PROCESS_ENV_RESTRICTION`, dựng tùy chọn import bằng một hàm, và sắp thứ tự khối; file thử lint xác nhận | 2 |
| 10 | jsdom không có `isContentEditable`; một số trình duyệt gửi `key: "Process"` khi IME đang gõ mà `isComposing` vẫn `false` | `shouldHandleShortcut` dùng `closest('[contenteditable]:not([contenteditable="false"])')` và bỏ qua cả `key === "Process"` | 8 |
| 11 | jsdom thiếu `ResizeObserver`, `DOMMatrixReadOnly`, pointer capture, `scrollIntoView`, `matchMedia` (Radix và React Flow cần); Vitest không bật `globals` nên React Testing Library không tự dọn DOM sau mỗi test | `src/testing/setup-tests.ts` của Task 1 bù các API này và gọi `cleanup` sau mỗi test. Spec mục 14 chỉ nêu mock cho React Flow và `matchMedia`; phần bù cho Radix là bổ sung | 1 |
| 12 | Spec mục 9 đặt mỗi namespace trong một file resource, nhưng nhiều task B song song cùng cần thêm key vào `editor` | Chia `editor` thành bảy file con theo phần giao diện, Task 9 tạo sẵn tất cả; mỗi file resource có một chủ sở hữu (mục "Điểm nóng khi làm song song"). Namespace và key i18n không đổi so với spec | 9, B |
| 13 | `env.ts` có thể được nạp trên trình duyệt trước `zod-config.ts`; parse object bằng Zod lúc đó sẽ thử `new Function` và gây vi phạm CSP. Next.js chỉ thay `process.env.NODE_ENV` vào bundle client khi viết nguyên văn | `env.ts` không dùng Zod, đọc `process.env.NODE_ENV` nguyên văn và kiểm tra bằng union literal. `records.ts` không import `zod-config.ts`: mọi lần parse chạy sau khi `AppProviders` đã nạp cấu hình | 5, 6, 13 |
| 14 | Ví dụ TypeScript của Dexie khai báo bảng bằng `as` hoặc `!`, cả hai bị cấm | Lớp `SchemaforgeDatabase extends Dexie` với field `declare readonly` | 6 |
| 15 | Web Locks (như `crypto.randomUUID`) chỉ có trong secure context; jsdom không có `navigator.locks`; kiểu `LockManager` của DOM có overload generic khó giả mà không ép kiểu | Port hẹp `LockRequest` và registry giả trong `src/testing/`. Không có `navigator.locks` thì `createBrowserSchemaLockManager` throw lỗi nêu rõ cần HTTPS hoặc `localhost` (spec mục "Rủi ro" đã yêu cầu HTTPS) | 7 |
| 16 | Không có API công khai để đọc header request mà `NextResponse.next({ request: { headers } })` chuyển tiếp; helper test của Next.js 16.3.5 vẫn tên `unstable_doesMiddlewareMatch` | Test đọc header `x-middleware-request-x-nonce` (cách Next.js 16.3.5 mã hóa, đã xem mã nguồn). Helper không hỗ trợ `missing` thì so `config` với literal. Nâng Next.js mà đổi cách mã hóa thì test này báo đỏ | 5 |
| 17 | Spec mục 7 không nói thứ tự ưu tiên khi một lỗi Dexie bọc nhiều lỗi (ví dụ `OpenFailedError` bọc `VersionError`) | Ưu tiên `quota-exceeded` > `outdated-tab` > `closed` > `unavailable` > `unknown`, đi theo chuỗi `inner` tối đa 5 cấp | 6 |
| 18 | Spec để plan chốt danh sách thuộc tính JSX không hiển thị cho `i18next/no-literal-string` | Chốt ở Task 2, gồm cả `value`, `defaultValue` (token của Tabs, Select, RadioGroup). Hệ quả: `value` hardcode trên ô nhập không bị lint bắt, nên review phải để ý | 2 |
| 19 | Spec mục 1 yêu cầu kiểm tra `schemaId` là UUID trong `page.tsx` (Server Component) nhưng không nêu module | `isSchemaId` nằm ở `lib/storage/schema-id.ts`, không import Dexie hay Zod, nên Server Component import được mà không kéo Dexie vào server | 6, 22 |
| 20 | Kiểu key có tiền tố namespace (`ParseKeys<Namespace[]>`) và lời gọi `t` với union key chưa được thử trên i18next 26.4 | Task 11 thử trước; không biên dịch được mà không ép kiểu thì dừng và báo, orchestrator chọn cách khác (ví dụ `notify` nhận hàm dịch đã áp dụng thay vì key) | 11 |
| 21 | Spec mục "Cấu trúc thư mục" nói `logger.ts` "tắt `no-console` kèm lý do", nhưng rule chỉ bắt lời gọi `console.*`; comment tắt rule không cần thiết sẽ làm lint fail vì `reportUnusedDisableDirectives: "error"` | Logger nhận `console` làm sink; chỉ thêm comment tắt rule nếu lint thực sự báo | 11 |
| 22 | `nextjs.md` yêu cầu module không bao giờ được xuống trình duyệt bắt đầu bằng `import "server-only"`, nhưng gói `server-only` không có trong bảng phiên bản | Phần 3 không có module nào chứa bí mật; `server-translation.ts` chạy được ở cả hai phía. Không thêm `server-only` ở phần 3 | 9 |

**Rủi ro của spec chuyển cho task B** (spec mục "Rủi ro cần kiểm tra khi triển khai"): React 19.3 render thẻ `<script src="/theme-init.js">` đồng bộ trong `<head>` mà không cảnh báo khi hydrate hay `router.refresh()` (Task 13); `deleteKeyCode={null}`, `onBeforeDelete` và chuỗi sự kiện `onNodesChange` phân biệt kéo chuột với phím mũi tên trong React Flow 12.11 (Task 24, 29); kiểm tra tay trên trình duyệt thật (Task 32).

## Task loại B

Phần này do lượt lập plan thứ hai viết.
