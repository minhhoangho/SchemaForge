# Plan: Editor MVP

Plan triển khai phần 3 trong [roadmap.md](../roadmap.md), dựa trên spec đã duyệt [2026-09-14-editor-mvp-design.md](../specs/2026-09-14-editor-mvp-design.md) (commit b9bf16b; ngày 2026-09-15 spec được sửa tại chỗ để đặt mục tiêu WCAG 2.2 mức AA ở mục 12 và 14, plan theo bản đã sửa). Spec là nguồn gốc: plan chỉ chia việc, chốt các chi tiết mức cài đặt mà spec để lại, và không đổi quyết định nào của spec. Chỗ spec còn hở hoặc mâu thuẫn với thực tế của thư viện được nêu ở mục [Vấn đề phát hiện khi lập plan](#vấn-đề-phát-hiện-khi-lập-plan).

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
  - Hàm export khai báo kiểu trả về; component trả `JSX.Element` (import type `JSX` từ `react`). Boolean bắt đầu bằng `is`, `has`, `can`, `should`, trừ tên do API ngoài đặt sẵn mà Task 2 cho phép (`asChild`, `open`, `disabled`…). Hằng boolean ở cấp module giữ dạng `UPPER_SNAKE_CASE` với tiền tố viết hoa: `IS_XXX`, `HAS_XXX`, `CAN_XXX`, `SHOULD_XXX` (Vấn đề 37).
  - Import chéo thư mục dùng alias `@/` (Task 1 tạo); import trong cùng thư mục dùng đường dẫn tương đối.
  - Mọi chuỗi người dùng nhìn thấy (text trong JSX, `aria-label`, `title`, `placeholder`, `alt`, toast, thông báo lỗi) đi qua i18n, có đủ `vi` và `en`. Component trong `components/ui/` không gọi i18n; chuỗi của chúng (ví dụ nhãn nút đóng) được truyền vào qua prop.
  - **Nút có chữ nhìn thấy không dùng `aria-label`** (WCAG 2.5.3 Label in Name): accessible name phải chứa đúng chữ đang hiện, nếu không người dùng điều khiển bằng giọng nói đọc chữ trên màn hình sẽ không khớp. Cần thêm ngữ cảnh thì đặt một `<span className="sr-only">` **trước** chữ nhìn thấy, cách nhau bằng `{" "}`; thiếu khoảng trắng đó thì accessible name bị nối liền (ví dụ `"Ngôn ngữVI"`) và hỏng việc khớp theo từ. Mẫu có sẵn: `LanguageSwitch` ở Task 9. Nút **chỉ có icon** không có nhãn nhìn thấy nên `aria-label` vẫn là cách đúng (ví dụ `ThemeSwitch` ở Task 10, nút icon trên toolbar và trong panel).
  - Chuỗi hiển thị bằng một ngôn ngữ khác ngôn ngữ của trang (tên ngôn ngữ trong menu chọn ngôn ngữ) được bọc `<span lang="…">` (WCAG 3.1.2 Language of Parts), để trình đọc màn hình dùng đúng bộ phát âm.
  - Màu chỉ lấy từ theme token (class Tailwind như `bg-background`, `text-muted-foreground`, `border-border`, hoặc `var(--token)`); không mã màu, không class màu cố định như `bg-red-500`, không màu dạng arbitrary value.
  - Không `dangerouslySetInnerHTML`. Không `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`. Không `console` ngoài `src/lib/logger.ts`. Không state có thể thay đổi ở cấp module.
  - `"use client"` đặt ở component thấp nhất cần nó. Hàm dưới khoảng 40 dòng, file dưới khoảng 300 dòng, lồng tối đa 3 cấp.
- **Bẫy đã gặp ở đợt 8** (chi tiết ở Vấn đề 26, 27, 38, 40): core không export `ok`/`err`, `toNameKey`, `isTableId`, `MAX_NAME_BYTES` (viết bản sao cục bộ kèm comment, không import core bằng đường dẫn tương đối); tra map của core bằng id `string` phải qua helper `lookup` (Vấn đề 27); `DocumentPath` là mảng, không phải union (Vấn đề 38); bọc method trong arrow thay vì truyền `router.refresh` trần; `vi.fn<T>()` thay cho `vi.fn()` trần; xóa `frontend/.vitest/json/output.json` sau khi chạy riêng một file test.
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
| `frontend/components.json`, `frontend/src/components/ui/` | Task 3 chạy shadcn CLI và thêm **mọi** component phần 3 cần trong một lần; Task 10 viết tay `components/ui/sonner.tsx`. Task B không chạy `shadcn add`; thiếu component thì dừng và báo để orchestrator tạo task tuần tự (lý do ở đoạn "Registry của shadcn CLI không được pin" ngay dưới bảng) |
| `frontend/src/components/app-providers.tsx` | Task A chỉ tạo provider đứng riêng (`ThemeProvider`, `I18nProvider`) và `Toaster`. `AppProviders` do Task 13 tạo và sở hữu duy nhất |
| `frontend/src/app/layout.tsx`, `page.tsx` | Core Task 27 sửa trước. Sau đó chỉ Task 13 sửa `layout.tsx` và chỉ Task 21 sửa `page.tsx` |
| `frontend/next.config.ts` | Phần 3 không sửa (CSP nằm trong `src/proxy.ts`) |

**Registry của shadcn CLI không được pin.** `pnpm dlx shadcn@4.21.0` ghim phiên bản CLI, nhưng registry `radix-nova` mà nó tải component về thì không, và registry đã **thay đổi** kể từ lúc Task 3 chạy. Rủi ro này đã xảy ra thật khi cài `cmdk` ngày 2026-09-16 (Vấn đề 23):

- CLI nay sinh `import { cn } from "cn"` — kéo về một gói npm tên `cn` hoàn toàn không liên quan — thay vì alias `@/lib/class-names` mà `components.json` khai báo.
- Chạy `shadcn add` trong shell không tương tác **bắt buộc** phải có `--overwrite`: không có thì CLI hỏi "file đã tồn tại, ghi đè?" rồi abort giữa chừng. Nhưng `--overwrite` **ghi đè cả component đã có**: lần chạy vừa rồi nó đè `button.tsx`, `dialog.tsx`, `input.tsx`, `textarea.tsx`, làm mất phần `closeLabel`, `hasCloseButton` mà Task 3 đã sửa cho `DialogContent`.
- Nó còn sinh thêm `input-group.tsx` như dependency bắc cầu của `command`.

Vì vậy: **không task B nào được chạy `shadcn add`.** Thiếu component thì dừng và báo orchestrator để tạo một task cấu hình tuần tự riêng; task đó phải `git diff` kiểm mọi file trong `frontend/src/components/ui/` đã có, khôi phục file bị ghi đè bằng `git checkout -- <file>`, gỡ dependency lạ, và xóa component thừa không nằm trong phạm vi.

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
| `cmdk` | 1.1.1 | 2025-03-14 | `frontend` dependencies | peer `react ^18 \|\| ^19 \|\| ^19.0.0-rc` và `react-dom` cùng phạm vi. Combobox `Command` của shadcn/ui ở Task 26. Cài **sau** Task 3 bằng một task cấu hình tuần tự riêng, không phải trước (Vấn đề 8, Vấn đề 23); 1.1.1 vẫn là bản mới nhất lúc cài (kiểm tra lại 2026-09-16) |
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

Gói spec đã loại và plan không dùng: `next-themes`, `eslint-plugin-jsx-a11y`, `i18next-cli`, `vitest-axe`, `jest-axe`, `i18next-browser-languagedetector`, `nanoid` (lý do ở spec mục "Phiên bản").

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
| 13 | `AppProviders`, nối vào `layout.tsx`, `not-found.tsx`, tiêu đề trang | B | core 27, 5, 9, 10, 11, 15 | 9 |
| 14 | Bản dịch `issues` và `errors` | B | core 26, 9 | 8 |
| 15 | `SchemaRepository` và `StorageProvider` | B | core 26, 6, 7 | 8 |
| 16 | Lựa chọn, gợi ý tên, operation thêm bảng, thêm enum, xóa lựa chọn | B | core 26 | 8 |
| 17 | Chỉ mục issue và `resolveIssueTarget` | B | core 26 | 8 |
| 18 | Store editor: `createEditorStore`, provider, `useEditorStore` | B | core 26, 11, 14, 16 | 9 |
| 19 | Id handle, `toTableNodes`, `toRelationEdges`, `ViewportControls` | B | core 26, 17 | 9 |
| 20 | Hook `useAutosave`, `useSchemaLock`, `useEditorShortcuts` | B | 7, 8, 11, 15, 18 | 10 |
| 21 | Màn hình danh sách schema và route `/` | B | 12, 13, 15 | 10 |
| 22 | Route editor, `EditorScreenLoader`, `EditorScreen`, `EditorWorkspace` | B | 12, 13, 15, 18, 20, 23, 24 | 11 |
| 23 | Toolbar, lệnh thêm bảng, thêm enum và ô nhập commit | B | 12, 16, 17, 18, 19 | 10 |
| 24 | Canvas: `TableNode`, `ColumnRow`, `RelationEdge`, marker, `ariaLabelConfig`, `useRevealFocusedElement` | B | 12, 17, 18, 19 | 10 |
| 25 | Panel trái: tab Bảng, Enum, Vấn đề | B | 12, 14, 17, 18, 19, 23 | 11 |
| 26 | Panel bảng: cột, index, comment, vị trí | B | 12, 14, 17, 18, 23, task `cmdk` (Vấn đề 23) | 11 |
| 27 | Panel quan hệ và panel nhiều lựa chọn | B | 12, 14, 17, 18, 23 | 11 |
| 28 | Hộp thoại "Tạo quan hệ" và `buildRelationOperation` | B | 12, 16, 18, 24 | 12 |
| 29 | Ghép editor: bố cục, landmark, skip link, xóa bằng phím, toast hoàn tác, focus | B | 20, 22, 23, 24, 25, 26, 27, 28 | 13 |
| 30 | Test hiệu năng và script `perf:snippet` | B | 24, 26 | 12 |
| 31 | Test tích hợp hành trình 1–8 | B | 21, 29 | 14 |
| 32 | Tài liệu, kiểm tra toàn repo, checklist kiểm tra tay | B | 1–31 | 15 |

- Số task trong mỗi đợt: đợt 8 có 14, 15, 16, 17; đợt 9 có 13, 18, 19; đợt 10 có 20, 21, 23, 24; đợt 11 có 22, 25, 26, 27; đợt 12 có 28, 30; đợt 13 có 29; đợt 14 có 31; đợt 15 có 32. Không đợt nào quá 5 task và các task trong cùng đợt có tập file rời nhau.
- **Đường găng:** 14 → 18 → 20 → 22 → 29 → 31 → 32. Nhánh dài thứ hai là 17 → 19 → 24 → 28 → 29.
- Task 13 đứng ở đợt 9 vì ngoài các task A còn cần core 27 và Task 15; nếu core 27 merge sớm thì chạy ngay khi Task 15 xong.
- Checklist kiểm tra tay (spec mục 11 "Kiểm tra", mục 12 "Kiểm tra tay", mục 13 "Cách đo tay", mục 14 "Không kiểm tra tự động được") nằm trong Task 32, gồm độ tương phản, CSP trên Chrome thật, số đo hiệu năng, và ba mục WCAG 2.2 AA mà axe không đo được trên jsdom: kích thước mục tiêu bấm, focus không bị che, đường thay thế kéo bằng bấm.

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
   - Ngoại lệ duy nhất về class (spec mục 12 "Kích thước mục tiêu bấm", WCAG 2.5.8): component có phần tử bấm nhỏ hơn 24×24 px trong class sinh ra (ít nhất `Checkbox` với `size-4`) thêm `relative after:absolute after:-inset-1` vào phần tử đó, để vùng bấm tối thiểu 24×24 px mà kích thước hiển thị không đổi. Ghi danh sách component đã sửa vào báo cáo; Task 32 đo lại bằng DevTools.
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
- `lib/zod-config.ts`: chỉ import `zod` và gọi `z.config({ jitless: true })`, comment lý do (Zod 4 dùng `new Function` để biên dịch parser object, CSP có nonce chặn eval; Zod đọc `jitless` khi **tạo** schema chứ không phải khi parse). Zod 4.6.4 lưu cấu hình ở `globalThis.__zod_globalConfig`, nên lời gọi này áp cho cả bản Zod mà core dùng. Module này phải được nạp trước `@schemaforge/core` và mọi module tạo schema Zod: core tạo schema lúc được import, nên cấu hình đặt sau import đó không còn tác dụng với các schema ấy. Task 13 import file này đầu tiên trong `AppProviders`, trước mọi import khác.
- **Câu hỏi còn mở cần xác minh:** chưa rõ bản thân việc import `zod` có tạo object schema và chạy phép thử `new Function("")` trước khi `z.config` kịp chạy hay không. Test `does not construct Function when zod is first imported` dưới đây kiểm tra; test không đạt thì dừng và báo kèm output, không tự đổi cách làm.

**Test viết trước:**

- `env.test.ts`: `reads %s as the node environment` (`it.each` ba giá trị, kiểm tra `isDevelopment`, `isProduction`); `throws for an unsupported NODE_ENV` (`it.each` `staging`, `undefined`).
- `content-security-policy.test.ts`: `includes the %s directive` (`it.each` đủ 11 directive); `puts the nonce and strict-dynamic in script-src`; `allows unsafe-eval only in development`; `adds upgrade-insecure-requests only outside development`; `allows inline styles`; `forbids framing, plugins and cross-origin connections`.
- `proxy.test.ts`, dòng đầu `// @vitest-environment node`, tạo `new NextRequest("http://localhost/schemas/abc")`:
  - `sets a Content-Security-Policy header with a nonce on the response` (lấy nonce bằng regex `'nonce-([^']+)'`).
  - `forwards the same nonce to the request as x-nonce`: Next.js 16.3.5 mã hóa header chuyển tiếp thành header response `x-middleware-request-<tên>` (`next/dist/server/web/spec-extension/response.js`), nên đọc `x-middleware-request-x-nonce`.
  - `forwards the Content-Security-Policy header to the request`.
  - `generates a different nonce for each request`.
  - `skips static assets and prefetch requests`: dùng `unstable_doesMiddlewareMatch` của `next/experimental/testing/server` (tên vẫn là middleware ở 16.3.5; đọc chữ ký trong `middleware-testing-utils.d.ts`) với `/schemas/abc` (khớp), `/_next/static/chunk.js` (không khớp), request có header `next-router-prefetch` (không khớp). Helper không hỗ trợ `missing` thì thay bằng so `config` với literal mong đợi và ghi vào báo cáo.
- `zod-config.test.ts`: không import tĩnh `zod`, `./zod-config` hay module nào dùng Zod. Ở cấp module: nếu `globalThis.__zod_globalConfig` đã tồn tại (Zod đã được nạp trước, ví dụ qua file setup) thì dừng và báo; đặt `vi.spyOn(globalThis, "Function")`, `await import("./zod-config")`, lưu số lần spy được gọi, `mockRestore`, rồi lấy `z` bằng `await import("zod")`.
  - `does not construct Function when zod is first imported`: số lần gọi đã lưu là 0.
  - `enables zod jitless mode`: `z.config().jitless` là `true`.
  - `parses an object schema without constructing Function`: spy mới, tạo và parse `z.object` trong test (sau khi cấu hình đã nạp), spy không được gọi.

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
  - Không import `zod-config.ts`. File này tạo schema Zod ngay khi được import và Zod đọc `jitless` lúc tạo schema, nên trên trình duyệt nó phải được nạp sau `zod-config.ts` (Task 13 import cấu hình đầu tiên trong `AppProviders`, Vấn đề 13).
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
- `server-translation.ts`: `getServerTranslation<N extends Namespace>(locale: Locale, namespace: N): TFunction<N>` trả `createI18nInstance(locale).getFixedT(locale, namespace)`, tức một instance **mới** mỗi lần gọi, không có instance ở cấp module. `getFixedT` của i18next 26.4 khớp kiểu trả về `TFunction<N>` như viết, không cần type argument tường minh và không cần `as` (đã xác minh khi triển khai).
- `negotiate-locale.ts`:
  - `negotiateLocale(acceptLanguage: string | null): Locale | null`: tách theo dấu phẩy, tối đa `MAX_LANGUAGE_RANGES = 32` mục (header không tin cậy); mỗi mục tách tiếp theo `;` và **trim từng phần sau khi tách**, không chỉ trim cả range, vì RFC 9110 cho phép khoảng trắng tùy chọn quanh `;` và quanh `,`. Chỉ trim cả range thì `" q=0.1"` không `startsWith("q=")`, trọng số rơi về mặc định 1 và hàm chọn sai locale. Mỗi mục là tag và `q` (mặc định 1; `q` không phải số trong khoảng 0–1 thì bỏ mục; `q=0` thì bỏ); bỏ `*`; lấy subtag chính, chữ thường; sắp ổn định theo `q` giảm dần; trả locale được hỗ trợ đầu tiên.
  - `resolveRequestLocale(input: { readonly cookieValue: string | undefined; readonly acceptLanguage: string | null }): Locale` = `parseLocalePreference(cookieValue) ?? negotiateLocale(acceptLanguage) ?? DEFAULT_LOCALE`.
- `change-locale.ts`: `changeLocale(locale: Locale, dependencies: { readonly i18n: Pick<i18n, "changeLanguage">; readonly refresh: () => void; readonly isSecure: boolean }): Promise<void>`. Thứ tự: `await i18n.changeLanguage(locale)`; ghi cookie `sf-locale`; đặt `document.documentElement.lang`; gọi `refresh()`.
- `components/i18n-provider.tsx` (`"use client"`): props `{ readonly locale: Locale; readonly children: ReactNode }`; `const [instance] = useState(() => createI18nInstance(locale))`; bọc `I18nextProvider`.
- `components/language-switch.tsx` (`"use client"`):
  - `DropdownMenu` với nút kích hoạt `Button` (`variant="ghost"`, `size="sm"`). Nút **không** có `aria-label`: nó hiện chữ `t("language.shortName")` (`VI`/`EN`), nên `aria-label` là "Ngôn ngữ"/"Language" sẽ vi phạm WCAG 2.5.3 Label in Name (accessible name không chứa nhãn nhìn thấy, người dùng điều khiển bằng giọng nói nói "click VI" sẽ không khớp). Thay vào đó dùng nhãn ẩn (**user đã chốt phương án này**):

    ```tsx
    <Button variant="ghost" size="sm">
      {/* The space keeps the visible short name a separate word in the
          accessible name, so voice control can match it (WCAG 2.5.3). */}
      <span className="sr-only">{t("language.label")}</span>{" "}
      {t("language.shortName")}
    </Button>
    ```

    `{" "}` là bắt buộc: không có nó thì accessible name tính ra `"Ngôn ngữVI"` (jsdom nối hai đoạn không có khoảng trắng) và hỏng việc khớp theo từ. Accessible name thực tế: "Ngôn ngữ VI" và "Language EN". Quy tắc chung cho mọi nút có chữ nhìn thấy nằm ở mục "Quy ước chung cho mọi task", phần Code.
  - `DropdownMenuRadioGroup` có `value={i18n.language}`, hai `DropdownMenuRadioItem` `vi` và `en`. Tên ngôn ngữ được bọc `lang` vì spec quy định "Tiếng Việt" và "English" hiện bằng chính ngôn ngữ đó ở cả hai locale, nên không đánh dấu thì trình đọc màn hình đọc "Tiếng Việt" bằng bộ phát âm tiếng Anh (WCAG 3.1.2 Language of Parts): `<span lang="vi">{t("language.vi")}</span>` và `<span lang="en">{t("language.en")}</span>`.
  - `onValueChange` kiểm tra `isLocale(value)` rồi gọi `changeLocale(value, { i18n, refresh: router.refresh, isSecure: env.isProduction })`, với `useRouter` của `next/navigation`.

**Test viết trước:**

- `negotiate-locale.test.ts`: `negotiates %s as %s` (`it.each`: `vi-VN,vi;q=0.9,en;q=0.8` → `vi`; `en-US,en;q=0.9` → `en`; `fr-FR,fr;q=0.9,en;q=0.5,vi;q=0.8` → `vi`; `fr,de` → `null`; chuỗi rỗng → `null`; `vi;q=0,en` → `en`; `*` → `null`; `EN-gb` → `en`; `vi;q=abc,en;q=0.5` → `en`; `vi;q=0.9,en; q=0.1` → `vi`; `vi;q=0.1, en ; q=0.9` → `en`); `keeps header order for equal weights`; `returns null for a missing header`; `ignores language ranges beyond the limit`; `prefers a valid locale cookie over the header`; `uses the header when the cookie is invalid`; `falls back to en without cookie or matching header`.
- `create-i18n-instance.test.ts`: `translates right after creation without awaiting init`; `uses en as the fallback language`; `does not escape interpolation values`; `creates independent instances` (đổi ngôn ngữ của instance này không ảnh hưởng instance kia).
- `server-translation.test.ts`: `translates a namespace in %s` (`it.each` hai locale); `returns an independent translator for each call`.
- `resources.test.ts` (spec mục 9, test bản dịch; hàm làm phẳng key viết trong file test): `has the same keys in vi and en`; `has a non-empty %s translation for %s` (`it.each` trên key đã làm phẳng × locale); `uses the same interpolation variables in vi and en for %s`; `has one storage message per storage error code`.
- `change-locale.test.ts`: `changes the i18next language`; `writes the sf-locale cookie`; `sets the html lang attribute`; `refreshes the router after the language has changed`.
- `i18n-provider.test.tsx`: `renders children with translations for the given locale`; `keeps the i18next instance when the provider rerenders`.
- `language-switch.test.tsx` (mock `next/navigation`): `names the trigger with the translated language label`; `marks the current language as checked`; `switches to English from the menu` (cookie `sf-locale=en`, `html[lang="en"]`, `refresh` được gọi một lần, nhãn đổi sang tiếng Anh); `opens the menu with the keyboard`; `closes on Escape and returns focus to the trigger`. `DropdownMenu` của Radix mở được bằng `user.click` trên jsdom với các stub sẵn có của Task 1 (đã xác minh khi triển khai), nên không cần đường vòng bằng bàn phím.

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
  - `export function Toaster(props: ToasterProps & { readonly containerAriaLabel: string }): JSX.Element` render `Toaster` của `sonner` với `theme={preference}` từ `useThemePreference()` (`ThemePreference` trùng kiểu `theme` của Sonner), `className="toaster group"`, `position="bottom-center"` (spec mục 12 "Focus không bị che": toast nổi trên canvas, không đè panel phải), icon lucide như bản shadcn.
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

- `match-media-stub.ts`: `stubMatchMedia({ isDarkPreferred }: StubMatchMediaOptions): MatchMediaStub`, với `type StubMatchMediaOptions = { readonly isDarkPreferred: boolean }` và `export type MatchMediaStub = { readonly setPrefersDark: (isDark: boolean) => void; readonly restore: () => void }`. Thay `window.matchMedia` bằng `vi.stubGlobal`; đối tượng trả về có `matches`, `media`, `addEventListener`, `removeEventListener`; `setPrefersDark` đổi giá trị đang giữ và gọi listener `change`.
  - Tên tham số là `isDarkPreferred`, **không** phải `prefersDark`: `@typescript-eslint/naming-convention` (Task 2) bắt `typeProperty` kiểu boolean mang tiền tố `is`, `has`, `can`, `should`. Tên lấy theo tham số `isDarkPreferred` của `resolveTheme` trong `src/lib/theme/resolve-theme.ts` cho nhất quán. `setPrefersDark` và tham số `isDark` của nó **giữ nguyên** tên: đó là tên hàm và tên tham số, không phải thuộc tính boolean, nên rule không bắt.
  - Hai đặc điểm hành vi mà task B cần biết: stub **chỉ** match query `(prefers-color-scheme: dark)` (`DARK_COLOR_SCHEME_QUERY`), mọi query khác luôn `matches: false`; và `matches` là một **getter**, nên đối tượng `MediaQueryList` lấy từ trước vẫn thấy giá trị mới sau `setPrefersDark`.
- `render-with-providers.tsx`:
  - `renderWithProviders(ui: ReactElement, options?: { readonly locale?: Locale; readonly themePreference?: ThemePreference }): RenderResult & { readonly user: UserEvent }`. Mặc định `locale` là `vi`, `themePreference` là `light`.
  - Trước khi render: đặt `document.documentElement.lang` và áp class theme bằng `applyResolvedTheme(resolveTheme(themePreference, window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches))`, thay cho `theme-init.js` không chạy trong test. Đọc media query thật chứ **không** truyền `false` cứng: `ThemeProvider` với preference `system` không áp class lúc mount (nó dựa vào `theme-init.js` chạy trước khi vẽ), nên nếu helper truyền `false` cứng thì `renderWithProviders(ui, { themePreference: "system" })` kèm `stubMatchMedia({ isDarkPreferred: true })` sẽ ra theme sáng, sai. Đọc media query giống hệt `theme-init.js` làm hai helper ăn khớp. Mặc định không đổi, vì stub `matchMedia` trong `setup-tests.ts` luôn trả `matches: false`.
  - Bọc `I18nProvider` → `ThemeProvider` → `TooltipProvider` → `ui` và `Toaster` (nhãn vùng lấy bằng `useTranslation` trong một component nhỏ cùng file).
  - Gọi `render(ui, { wrapper })`, **không** phải `render(<Providers>{ui}</Providers>)`, để `rerender` trả về giữ nguyên cây provider; task B nào test rerender đều dựa vào điều đó.
  - `user` là `userEvent.setup()`.
- `expect-no-axe-violations.ts`: `expectNoAxeViolations(container: Element): Promise<void>` gọi `axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } } })` rồi `expect` danh sách `{ id, targets }` của vi phạm bằng `[]`, để thông báo lỗi dễ đọc. Comment: axe-core không cho chạy song song, nên luôn `await` từng lần gọi.
  - Tag của axe không cộng dồn, nên danh sách có đủ tag A, AA của WCAG 2.0, 2.1, 2.2 (mục tiêu WCAG 2.2 AA). axe-core 4.13.0 không có rule nào mang `wcag22a`, nên không liệt kê tag này. `wcag22aa` hiện chỉ gồm `target-size`, rule cần bố cục thật và cho kết quả đạt giả trên jsdom, nên bị tắt như `color-contrast`; comment trong file nêu hai lý do này.
  - Helper chỉ phủ phần tiêu chí axe đo được. Bảng ở spec mục 12 "Kiểm tra tự động" chia tiêu chí mới của 2.2 theo cách kiểm tra: 2.4.11 bằng unit test và test component của Task 24, 2.5.7 bằng test component của Task 23, 25, 26, 28; 2.5.8, 2.4.11, 2.5.7 trên trình duyệt thật bằng checklist của Task 32.

**Test viết trước:**

- `match-media-stub.test.ts`: `reports the initial dark preference`; `notifies change listeners when the preference changes`; `restores the original matchMedia`.
- `render-with-providers.test.tsx`: `renders Vietnamese translations by default`; `renders translations for the requested locale`; `applies the dark class for the dark theme`; `follows the stubbed color scheme for the system theme`; `provides a user-event instance that can click`; `renders tooltips without a missing provider error`.
- `expect-no-axe-violations.test.tsx`: `passes for a labelled button`; `fails for a button without an accessible name`; `does not report color contrast`; `does not report target size on jsdom` (nút có `aria-label` với `style` 10×10 px).

**Kiểm tra:** như "Quy ước chung", thêm lệnh xác nhận tag trên bản axe-core đã cài:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
(cd frontend && node -e 'const axe = require("axe-core"); console.log(axe.version, axe.getRules(["wcag22aa"]).map((rule) => rule.ruleId).join(","), axe.getRules(["wcag22a"]).length)')
```

Mong đợi: `4.13.0 target-size 0`. Phiên bản axe-core khác mà `wcag22aa` có thêm rule thì ghi vào báo cáo; không tự tắt thêm rule.

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
| 8 | Spec mục 2 gọi ô chọn kiểu cột là "combobox có ba nhóm". Combobox của shadcn/ui là `Popover` + `Command`, cần thêm gói `cmdk` không có trong bảng phiên bản | Dùng `Popover` + `Command` (cmdk) của shadcn/ui, gõ để lọc ba nhóm (17 kiểu chung, enum, "Kiểu custom…"). Dự định ban đầu là một task dependency riêng cài `cmdk` **trước** Task 3 để Task 3 thêm luôn component `command` và `popover`; việc đó không được làm, nên `cmdk` và hai component được cài bù bằng một task cấu hình tuần tự riêng **sau** Task 3, trước đợt 11 (chi tiết và kết quả ở Vấn đề 23) | 3, 26 |
| 9 | Tùy chọn của `no-restricted-properties` và `no-restricted-imports` ở khối cấu hình sau thay hẳn khối trước, nên thêm `navigator.sendBeacon` hay cấm `toast` theo thư mục dễ làm mất giới hạn `process.env` hoặc cấm import chéo | Task 2 tách hằng `PROCESS_ENV_RESTRICTION`, dựng tùy chọn import bằng một hàm, và sắp thứ tự khối; file thử lint xác nhận | 2 |
| 10 | jsdom không có `isContentEditable`; một số trình duyệt gửi `key: "Process"` khi IME đang gõ mà `isComposing` vẫn `false` | `shouldHandleShortcut` dùng `closest('[contenteditable]:not([contenteditable="false"])')` và bỏ qua cả `key === "Process"` | 8 |
| 11 | jsdom thiếu `ResizeObserver`, `DOMMatrixReadOnly`, pointer capture, `scrollIntoView`, `matchMedia` (Radix và React Flow cần); Vitest không bật `globals` nên React Testing Library không tự dọn DOM sau mỗi test | `src/testing/setup-tests.ts` của Task 1 bù các API này và gọi `cleanup` sau mỗi test. Spec mục 14 chỉ nêu mock cho React Flow và `matchMedia`; phần bù cho Radix là bổ sung | 1 |
| 12 | Spec mục 9 đặt mỗi namespace trong một file resource, nhưng nhiều task B song song cùng cần thêm key vào `editor` | Chia `editor` thành bảy file con theo phần giao diện, Task 9 tạo sẵn tất cả; mỗi file resource có một chủ sở hữu (mục "Điểm nóng khi làm song song"). Namespace và key i18n không đổi so với spec | 9, B |
| 13 | `env.ts` có thể được nạp trên trình duyệt trước `zod-config.ts`; Zod đọc `jitless` và thử `new Function` khi tạo object schema (không phải khi parse), nên schema tạo lúc đó sẽ gây vi phạm CSP. Next.js chỉ thay `process.env.NODE_ENV` vào bundle client khi viết nguyên văn | `env.ts` không dùng Zod, đọc `process.env.NODE_ENV` nguyên văn và kiểm tra bằng union literal. `records.ts` không import `zod-config.ts` nhưng tạo schema lúc được import, nên phải được nạp sau `zod-config.ts`. Task 13 kiểm tra rằng `zod-config.ts` được nạp trước mọi module import `@schemaforge/core` hay tạo schema Zod, kể cả module của route | 5, 6, 13 |
| 14 | Ví dụ TypeScript của Dexie khai báo bảng bằng `as` hoặc `!`, cả hai bị cấm | Lớp `SchemaforgeDatabase extends Dexie` với field `declare readonly` | 6 |
| 15 | Web Locks (như `crypto.randomUUID`) chỉ có trong secure context; jsdom không có `navigator.locks`; kiểu `LockManager` của DOM có overload generic khó giả mà không ép kiểu | Port hẹp `LockRequest` và registry giả trong `src/testing/`. Không có `navigator.locks` thì `createBrowserSchemaLockManager` throw lỗi nêu rõ cần HTTPS hoặc `localhost` (spec mục "Rủi ro" đã yêu cầu HTTPS) | 7 |
| 16 | Không có API công khai để đọc header request mà `NextResponse.next({ request: { headers } })` chuyển tiếp; helper test của Next.js 16.3.5 vẫn tên `unstable_doesMiddlewareMatch` | Test đọc header `x-middleware-request-x-nonce` (cách Next.js 16.3.5 mã hóa, đã xem mã nguồn). Helper không hỗ trợ `missing` thì so `config` với literal. Nâng Next.js mà đổi cách mã hóa thì test này báo đỏ | 5 |
| 17 | Spec mục 7 không nói thứ tự ưu tiên khi một lỗi Dexie bọc nhiều lỗi (ví dụ `OpenFailedError` bọc `VersionError`) | Ưu tiên `quota-exceeded` > `outdated-tab` > `closed` > `unavailable` > `unknown`, đi theo chuỗi `inner` tối đa 5 cấp | 6 |
| 18 | Spec để plan chốt danh sách thuộc tính JSX không hiển thị cho `i18next/no-literal-string` | Chốt ở Task 2, gồm cả `value`, `defaultValue` (token của Tabs, Select, RadioGroup). Hệ quả: `value` hardcode trên ô nhập không bị lint bắt, nên review phải để ý | 2 |
| 19 | Spec mục 1 yêu cầu kiểm tra `schemaId` là UUID trong `page.tsx` (Server Component) nhưng không nêu module | `isSchemaId` nằm ở `lib/storage/schema-id.ts`, không import Dexie hay Zod, nên Server Component import được mà không kéo Dexie vào server | 6, 22 |
| 20 | Kiểu key có tiền tố namespace (`ParseKeys<Namespace[]>`) và lời gọi `t` với union key chưa được thử trên i18next 26.4 | Task 11 thử trước; không biên dịch được mà không ép kiểu thì dừng và báo, orchestrator chọn cách khác (ví dụ `notify` nhận hàm dịch đã áp dụng thay vì key) | 11 |
| 21 | Spec mục "Cấu trúc thư mục" nói `logger.ts` "tắt `no-console` kèm lý do", nhưng rule chỉ bắt lời gọi `console.*`; comment tắt rule không cần thiết sẽ làm lint fail vì `reportUnusedDisableDirectives: "error"` | Logger nhận `console` làm sink; chỉ thêm comment tắt rule nếu lint thực sự báo | 11 |
| 22 | `nextjs.md` yêu cầu module không bao giờ được xuống trình duyệt bắt đầu bằng `import "server-only"`, nhưng gói `server-only` không có trong bảng phiên bản | Phần 3 không có module nào chứa bí mật; `server-translation.ts` chạy được ở cả hai phía. Không thêm `server-only` ở phần 3 | 9 |
| 23 | **(user đã chốt: làm bù ngay, không chờ đợt 11)** Task 3 đã merge nhưng **không** cài `cmdk` và không thêm component `command`, `popover`, trái với cách xử lý ghi ở Vấn đề 8. Spec mục 2 chốt ô chọn kiểu cột là combobox `Popover` + `Command` có ba nhóm và gõ để lọc, nên Task 26 không làm được với bộ component hiện có | Trước đợt 11, orchestrator chạy **một task cấu hình tuần tự** (không có task nào chạy cùng): `pnpm --filter @schemaforge/frontend add cmdk@^1.1.1`, rồi `pnpm dlx shadcn@4.21.0 add command popover --cwd frontend`, sửa component sinh ra theo bước 7 của Task 3, và kiểm tra `git diff` chỉ chạm `frontend/package.json`, `pnpm-lock.yaml`, `frontend/src/components/ui/command.tsx`, `popover.tsx`. Phiên bản `cmdk` phải được kiểm tra lại bằng `npm view cmdk version time peerDependencies` vào ngày chạy (spec ghi 1.1.1) và phải đủ 24 giờ. Không task B nào tự cài. **Đã làm 2026-09-16:** `cmdk` `^1.1.1` (bản mới nhất, phát hành 2025-03-14, thừa 24 giờ) vào `frontend` dependencies, rồi `pnpm dlx shadcn@4.21.0 add command popover --cwd frontend --overwrite` (`--overwrite` là bắt buộc: CLI hỏi đè `button.tsx` và shell không tương tác nên lần chạy đầu bị hủy giữa chừng). Registry `radix-nova` đã đổi so với lúc Task 3 chạy: nó sinh `import { cn } from "cn"` và tự thêm dependency `cn@^0.3.0` (gói npm không liên quan) — đã sửa import về `@/lib/class-names` và gỡ `cn`; nó cũng đè `button.tsx`, `dialog.tsx`, `input.tsx`, `textarea.tsx` (hoàn tác bằng `git checkout --`) và sinh thêm `input-group.tsx` (đã xóa vì ngoài phạm vi). Hệ quả: `command.tsx` **không** có `CommandDialog` (bản sinh ra gọi `DialogContent` với `showCloseButton`, prop mà Task 3 đã đổi thành `hasCloseButton` kèm `closeLabel` bắt buộc), và `CommandInput` tự dựng khung ô nhập thay cho `InputGroup`. **Task 26 phải biết:** `Command` có prop **bắt buộc** `label: string`, vì cmdk luôn trỏ `aria-labelledby` của ô tìm kiếm vào label ẩn của chính nó, nên `aria-label` lẫn `placeholder` trên `CommandInput` đều không đặt được accessible name cho ô đó | 26 |
| 24 | Khối "Cấu trúc thư mục" của spec không có file cho: lựa chọn (`Selection`), hàm dựng operation thêm enum, id handle, `ViewportControls`, ô nhập commit, và kho lưu trữ dùng chung của hai màn hình | Plan thêm `features/editor/lib/selection.ts`, `build-add-enum-operation.ts`, `handle-ids.ts`, `viewport-controls.tsx`, `features/editor/components/committed-text-field.tsx`, `committed-text-area.tsx`, `lib/storage/create-browser-storage.ts`, `storage-context.tsx`. Không namespace, không key i18n và không quyết định nào của spec đổi | 15, 16, 19, 23 |
| 25 | `getIssues` của spec mục 4 cần một `WeakMap` ở cấp module, trái với quy ước "không state có thể thay đổi ở cấp module" của mục "Quy ước chung cho mọi task" | Cho đúng một ngoại lệ trong `features/editor/lib/issue-index.ts`, kèm comment nêu lý do: cache thuần theo tham chiếu object, không có khóa nào sống lâu hơn tài liệu, và mỗi store có tài liệu riêng nên không rò giữa hai schema hay hai request. Test chứng minh hai tài liệu khác nhau cho hai kết quả khác nhau. **Đã làm ở Task 17 (đợt 8); orchestrator chốt sau đợt 8: giữ `WeakMap` cấp module trong `issue-index.ts`, không chuyển vào `createEditorStore`.** Lý do: canvas và ba panel đọc chỉ mục độc lập với nhau; cache chỉ có khóa là tham chiếu tài liệu nên không rò giữa hai schema; hai test `returns the same index object for the same document reference` và `returns a different index for a different document` đã phủ hành vi này. Store (Task 18) không sở hữu, không giữ và không tính lại chỉ mục; component gọi `getIssueIndex(document)` với `document` đọc từ store | 17, 18 |
| 26 | `packages/core` export `type Result` nhưng **không** export `ok` và `err` | `dispatch` dựng literal `{ isOk: true, value: undefined }` và `{ isOk: false, error }`, đúng hình dạng của `Result`; không tự khai báo lại type | 18 |
| 27 | `packages/core` không export type guard cho id (`isTableId` có trong `model/ids.ts` nhưng không nằm trong `src/index.ts`; không có `isColumnId`) và không export `toNameKey` | `parseHandleId` trả id dạng `string`. **Không** tra thẳng `document.tables[id]` hay `document.columns[id]` với `id: string`: map của core có khóa dạng template literal (`TableId` là `` `tbl_${string}` ``, `ColumnId` là `` `col_${string}` ``, suy ra từ `z.templateLiteral` trong `packages/core/src/model/ids.ts`), nên chỉ số `string` báo `TS7053`. Cách Task 17 đã dùng (trong `features/editor/lib/resolve-issue-target.ts`), không ép kiểu, không khai báo lại type: một helper generic nhận map dưới dạng `Readonly<Record<string, Value>>`, nơi truyền `document.tables` vào được vì `Record` có khóa template literal gán được cho `Record<string, …>`:<br>`function lookup<Value>(elements: Readonly<Record<string, Value>>, elementId: string \| null): Value \| undefined { return elementId === null ? undefined : elements[elementId]; }`<br>Tìm thấy phần tử thì dùng `element.id` (đã mang nhãn kiểu của core) cho mọi bước sau. Helper này không export; task khác cần thì viết bản riêng trong file của mình, cùng hình dạng. Gợi ý tên so sánh bằng `value.toLowerCase()` cục bộ, kèm comment nêu rõ nó phải khớp `toNameKey` của core | 16, 19 |
| 28 | Plan lượt 1 (Task 8) ghi hook truyền `navigator.userAgentData?.platform ?? navigator.platform`, nhưng `userAgentData` không có trong lib DOM của TypeScript nên phải ép kiểu | `useEditorShortcuts` nhận `platformHint` là tham số; nơi gọi truyền `navigator.platform` (đã lỗi thời nhưng có trong mọi trình duyệt được hỗ trợ và có kiểu sẵn), kèm comment | 20 |
| 29 | Task 8 đã triển khai trường là `shouldRequireCanvasFocus`, còn spec mục 6 và plan lượt 1 viết `requiresCanvasFocus` | Task 20 dùng đúng tên trong code: `ShortcutContext.shouldRequireCanvasFocus` (quy tắc boolean của `typescript.md`). Ý nghĩa không đổi | 20 |
| 30 | Spec mục 3 cần thêm câu "Thao tác không được áp dụng" cho toast lỗi dispatch, nhưng spec mục 9 buộc namespace `errors` có `satisfies Record<ErrorCode, string>`, nên không thêm key phẳng được | `errors` có hai nhánh: `codes` (`satisfies Record<ErrorCode, string>`) và `operationNotApplied`. Key dùng trong code là `errors:codes.<code>` và `errors:operationNotApplied`. `issues` vẫn phẳng, `satisfies Record<IssueCode, string>` | 14, 18 |
| 31 | `not-found.tsx` dịch được thì phải biết locale. Plan lượt 1 cho rằng đọc bằng `headers()` trong trang sẽ làm trang 404 không prerender được; thực tế trang 404 vốn không prerender (Vấn đề 42) | `not-found.tsx` là client component dùng `useTranslation("common")`; nó nằm dưới `layout.tsx` nên đã có `I18nProvider` với locale của request, không cần tự đọc `headers()` | 13 |
| 32 | `SchemaforgeDatabase` và `createBrowserSchemaLockManager` chỉ dựng được trên trình duyệt (IndexedDB, Web Locks), nhưng cả hai màn hình đều được SSR phần khung | `StorageProvider` dựng chúng trong một effect và `useStorage()` trả `{ kind: "pending" \| "ready" \| "unavailable" }`; trạng thái `unavailable` mang `StorageErrorCode`. Test truyền bản giả qua prop `storage` | 15, 13, 21, 22 |
| 33 | Spec mục 12 ghi size nút icon của shadcn/ui là `icon` 36 px và `icon-sm` 32 px, nhưng bản đã cài ở Task 3 dùng `icon` = `size-8` (32 px), `icon-sm` = `size-7` (28 px), `icon-xs` = `size-6` (24 px), `icon-lg` = `size-9` (36 px) | Nút icon trên toolbar dùng `size="icon"` (32 px); nút icon trong panel dùng `size="icon"` hoặc `size="icon-xs"` (24 px), không dùng `size="sm"` hay `size="xs"` cho nút chỉ có icon. Mọi mục tiêu bấm vẫn ≥ 24 px, đúng yêu cầu WCAG 2.5.8 của spec; chỉ con số px trong spec là sai | 23, 25, 26, 27, 32 |
| 34 | Spec mục 13 gọi fixture `makeLargeSchema`, nhưng `@schemaforge/core/testing` không có hàm này | Task 30 viết `frontend/src/testing/large-schema.ts` bằng `buildSchema`, `makeTable`, `makeColumn`, `makeRelation`, `createCounterIdGenerator` của `@schemaforge/core/testing`, đúng như khối "Cấu trúc thư mục" của spec | 30 |
| 35 | **(cần user xác nhận)** Mục "Current status" của `CLAUDE.md` mô tả frontend còn là trang placeholder; xong phần 3 thì mục này sai, nhưng `CLAUDE.md` nằm ngoài `document/` | Task 32 sửa đúng đoạn "Current status" của `CLAUDE.md` cùng với `roadmap.md` và `architecture.md`. User xác nhận trước khi Task 32 chạy; không thì Task 32 chỉ báo cáo nội dung cần sửa | 32 |
| 36 | **(cần user xác nhận)** Task 9 phải bỏ `as const satisfies LocaleNamespace<typeof en<Tên>>` ở 11 file `vi` rỗng (`issues`, `errors`, `schema-list`, `canvas` và bảy file con của `editor`), vì với object `en` rỗng thì `LocaleNamespace<typeof en<Tên>>` resolve ra `{}` và vướng rule **`@typescript-eslint/no-generated-empty-object-type`** của `strictTypeChecked` (`error: This type resolves to \`{}\`, the empty object type`). Đây **không** phải `no-empty-object-type`: rule đó chỉ bắt `{}` viết trực tiếp dạng type literal hoặc interface, nên option `allowObjectTypes` của nó không áp dụng được ở đây. Dạng khai báo kiểu thay vì `satisfies` (`export const viCanvas: LocaleNamespace<typeof enCanvas> = {};`) cũng bị chính rule đó bắt, nên **không có cách nào** nằm gọn trong file resource. Hệ quả type học: key **thiếu** vẫn bị bắt lúc biên dịch qua `viResources satisfies LocaleNamespace<typeof enResources>` ở `resources.ts`, nhưng key **thừa** thì không, kể cả khi namespace đã có key, vì `canvas: viCanvas` là tham chiếu biến chứ không phải object literal tươi nên excess property check của TypeScript không kích hoạt. Vì vậy mệnh đề `satisfies` ở từng file con là bắt buộc, không phải cho đẹp | Mỗi task B điền một file resource tự thêm lại mệnh đề `satisfies` cho file `vi` của mình khi thêm key đầu tiên (ghi trong mục "Cài đặt" của từng task), và kiểm tra bằng một key thừa tạm thời. Khoảng hở chỉ tồn tại với file còn rỗng. Khuyến nghị: **giữ nguyên hiện trạng, không sửa `eslint.config.mjs`.** Chưa tìm được cách tắt `no-generated-empty-object-type` cho `locales/**` mà không tắt hẳn rule đó cho cả thư mục (rule không có option nào cho phép `{}` sinh ra từ type reference); nếu user muốn chặn triệt để thì phải là một task cấu hình riêng chạy tuần tự trước đợt 8, thêm khối `files: ["frontend/src/lib/i18n/locales/**/*.ts"]` đặt rule về `"off"`, và task đó phải cân nhắc rằng tắt hẳn sẽ bỏ luôn cảnh báo cho mọi type reference rỗng khác trong thư mục | 9, 14, 21, 22, 23, 24, 25, 26, 27, 28, 29 |
| 37 | **(user đã chốt: sửa `eslint.config.mjs`)** `.claude/rules/typescript.md` bắt hằng cấp module viết `UPPER_SNAKE_CASE`, còn `@typescript-eslint/naming-convention` (Task 2) bắt biến boolean mang tiền tố `is`, `has`, `can`, `should` và so tiền tố có phân biệt hoa thường. Hệ quả: `const IS_ENABLED = false` luôn đỏ lint, còn `const isEnabled = false` thì trái quy ước hằng. Task 12 đã phải bỏ hằng boolean để né | Một task cấu hình tuần tự sửa `eslint.config.mjs` cho phép tiền tố viết hoa `IS_`, `HAS_`, `CAN_`, `SHOULD_` với hằng boolean dạng `UPPER_CASE`; quy tắc này đã ghi vào mục "Quy ước chung cho mọi task", phần **Code**. Task B viết hằng boolean cấp module là `IS_XXX` và không cần tắt rule bằng comment. **Đã làm 2026-09-16:** commit `41db6cc` (`build: allow upper-case prefixes for boolean constants`) thêm vào `eslint.config.mjs` | 2, B |
| 38 | Plan lượt 2 (Task 17) viết "`switch` trên `path[0]`" như thể `DocumentPath` là union có thể vét cạn, nhưng core khai báo `export type DocumentPath = readonly (string \| number)[]` (`packages/core/src/document-path.ts`): `path[0]` chỉ là `string \| number \| undefined`, nên `switch` trên nó không có nhánh nào vét cạn và kiểm tra `never` ở `default` không biên dịch | Task 17 dựng union cục bộ `ElementPrefix` từ mảng `ELEMENT_PREFIXES = ["tables", "columns", "relations", "indexes", "enums", "subjectAreas"] as const` (sáu map phần tử của `SchemaDocument`; `notes` không có issue nên không nằm trong danh sách và rơi về đích `schema`), cùng type guard `isElementPrefix(segment: string): segment is ElementPrefix`. Hàm kiểm tra `typeof prefix !== "string" \|\| !isElementPrefix(prefix)` rồi trả đích `schema` trước, sau đó mới `switch (prefix)` với `default` gán `const unhandledPrefix: never = prefix`. Task sau cần rẽ nhánh theo đoạn đầu của `DocumentPath` làm cùng cách: thu hẹp đoạn đầu về một union cục bộ bằng type guard, không ép kiểu, không khai báo lại `DocumentPath` | 17, B |
| 39 | Core kiểm tra tên bảng và tên enum trong **một** không gian tên (`findTableAndEnumDuplicates` trong `packages/core/src/validation/rules/names.ts`): bảng trùng tên với enum cũng sinh `table-name-duplicate` và `enum-name-duplicate`. Câu mẫu của Task 14 ("Another table is already named …", "Bảng … trùng tên với một bảng khác") sai trong trường hợp khác loại | Sửa sau đợt 8 trong đúng file của Task 14 (`locales/en/issues.ts`, `locales/vi/issues.ts`): `table-name-duplicate` và `enum-name-duplicate` nói "một bảng hoặc enum khác", en "Another table or enum is already named “{{table}}”." / "… “{{enum}}”.", vi có nghĩa tương đương. Biến nội suy không đổi. Task sau không sửa lại hai câu này | 14 |
| 40 | Những cái bẫy task đợt 8 đã gặp mà plan chưa ghi (bổ sung cho Vấn đề 26, 27) | (1) `toNameKey`, `isTableId`, `MAX_NAME_BYTES` có trong `packages/core/src/model/` nhưng không nằm trong `src/index.ts`: viết bản sao riêng trong file của task kèm comment "must match … in packages/core", **không bao giờ** import core bằng đường dẫn tương đối hay đường dẫn con. (2) `@typescript-eslint/unbound-method` cấm truyền tham chiếu method trần (`onRefresh={router.refresh}`): bọc bằng arrow `() => { router.refresh(); }`. (3) `vi.fn()` trần không gán được cho port có kiểu: dùng `vi.fn<SchemaRepository["saveDocument"]>()`. (4) jsdom 30 không có constructor `MediaQueryListEvent`: không gọi `new MediaQueryListEvent(…)`; listener nhận object thường, kiểu `Pick<MediaQueryListEvent, "matches">` như `src/testing/match-media-stub.ts`. (5) Chạy riêng một file bằng `pnpm --filter @schemaforge/frontend exec vitest run <path>` sinh `frontend/.vitest/json/output.json`, không bị gitignore và làm `pnpm format:check` đỏ: xóa file đó trước khi báo xong. (6) `saveDocument` kết thúc bình thường khi dòng `schemas` đã bị xóa (Dexie `update` trả 0), nên Task 21, 22 **không** phát hiện "schema bị tab khác xóa" qua lần lưu; dùng khóa tab (`SchemaLockManager`) hoặc live query (`useLiveQuery`) trên `schemas`. (7) `Toaster` của Sonner đăng ký listener `matchMedia` và không gỡ khi unmount: test render `Toaster` (kể cả qua `AppProviders`) không được khẳng định `countListeners()` của `stubMatchMedia` về 0 sau unmount; đo việc gỡ listener trên component riêng, không có `Toaster` | 15, 21, 22, B |
| 41 | `app/layout.tsx` render `<script src="/theme-init.js">` đồng bộ trong `<head>`, bị rule `@next/next/no-sync-scripts` bắt. Mục "Điểm nóng khi làm song song" chỉ cho tắt rule bằng comment ở chỗ plan ghi rõ | Ngoại lệ được phép, chỉ ở đúng thẻ này trong `layout.tsx`: `eslint-disable-next-line @next/next/no-sync-scripts -- the theme class must be set before the first paint, which next/script cannot guarantee`. Lý do: script chống nháy phải chạy trước lần vẽ đầu, còn `next/script` không bảo đảm thời điểm đó. Không file nào khác được tắt rule này | 13 |
| 42 | Plan lượt 1 (Vấn đề 31, Task 13) cho rằng trang 404 được prerender. Thực tế sau Task 13, `next build` đánh dấu cả `/` lẫn `/_not-found` là động (`ƒ`), vì layout gốc đọc `cookies()`, `headers()` và nonce CSP; nonce buộc mỗi request render lại nên đây là hành vi đúng, không phải lỗi | Task 13 mong đợi `/` và `/_not-found` là `ƒ`. Không task nào tìm cách làm trang 404 thành tĩnh (bỏ đọc cookie, header hay nonce ở layout sẽ phá CSP và chống nháy theme) | 13 |
| 43 | Chưa chứng minh được `@/lib/zod-config`, import đầu tiên của `components/app-providers.tsx`, luôn được nạp trên trình duyệt trước module client của route có import `@schemaforge/core` (thứ tự chunk giữa layout và page không được Next.js cam kết). Nạp sau thì core tạo schema khi Zod chưa `jitless`, gây vi phạm CSP `unsafe-eval` | Entry client của mỗi route import `@/lib/zod-config` ở dòng import đầu tiên: `schema-list-screen.tsx` (Task 21), `editor-screen-loader.tsx` (Task 22). Task 32 kiểm tra tay rằng Console không có vi phạm CSP `unsafe-eval` trên `/` và `/schemas/<id>` | 21, 22, 32 |
| 44 | `toTableNodes`, `toRelationEdges` dùng lại object trong `previousNodes`, `previousEdges`. Nếu nơi gọi truyền state node, edge nội bộ của React Flow thì object được dùng lại mang thêm trường `dragging`, `measured` mà React Flow gắn vào | `editor-canvas.tsx` giữ kết quả lần gọi trước của chính hai hàm trong `useRef` và chỉ truyền ref đó; không bao giờ truyền node, edge lấy từ React Flow | 24 |
| 45 | **(user đã chốt)** Spec mục 5 nói edge tạo lại khi "vị trí của một trong hai bảng đầu" đổi nhưng không nói vị trí đã lưu hay vị trí tạm khi kéo | Dùng vị trí **đã lưu** (`document.tables`), không dùng `dragPositions`: cạnh trái, phải của handle chỉ đổi khi thả; trong lúc kéo đường edge vẫn bám node vì React Flow tính đường từ tọa độ handle. Lý do: không dựng lại edge mỗi khung hình, chữ ký `toRelationEdges` của Task 19 giữ nguyên. Spec mục 5 "Suy ra node và edge với tham chiếu ổn định" đã ghi rõ | 19, 24 |

**Rủi ro của spec chuyển cho task B** (spec mục "Rủi ro cần kiểm tra khi triển khai"): React 19.3 render thẻ `<script src="/theme-init.js">` đồng bộ trong `<head>` mà không cảnh báo khi hydrate hay `router.refresh()` (Task 13); `deleteKeyCode={null}`, `onBeforeDelete` và chuỗi sự kiện `onNodesChange` phân biệt kéo chuột với phím mũi tên trong React Flow 12.11 (Task 24, phần nối phím `Delete` ở Task 29); `autoPanOnNodeFocus={false}`, `focusin` nổi lên từ edge SVG, `getBoundingClientRect` của edge và vùng toast đo qua `[data-sonner-toaster]` (Task 24); kiểm tra tay trên trình duyệt thật (Task 32).

## Task loại B

Mọi task dưới đây import public API của core (`@schemaforge/core`, và `@schemaforge/core/testing` chỉ trong file test), nên chỉ bắt đầu được khi core Task 26 đã merge; task sửa `layout.tsx`, `page.tsx` hoặc dùng `APP_NAME` cần thêm core Task 27. Tên type, hàm và mã lỗi lấy đúng từ `packages/core/src/index.ts`; không task nào khai báo lại type của schema model.

Các tên dùng lại từ core mà task B sẽ gặp: `SchemaDocument`, `Table`, `Column`, `ColumnType`, `ColumnDefault`, `Relation`, `RelationKind`, `ReferentialAction`, `ColumnPair`, `Index`, `Enum`, `Position`, `TableId`, `ColumnId`, `RelationId`, `IndexId`, `EnumId`, `GenerateId`, `DocumentPath`, `Operation`, `OperationType`, `OperationError`, `ErrorCode`, `ERROR_CODES`, `Issue`, `IssueCode`, `ISSUE_CODES`, `History`, `HistoryEntry`, `Result`, `applyOperation`, `parseSchemaDocument`, `validateSchema`, `createEmptySchema`, `createEmptyHistory`, `recordEntry`, `mergeLastEntry`, `undo`, `redo`, `buildRelation`, `buildManyToMany`, `suggestIndexName`, `sortTables`, `sortEnums`, `sortIndexes`, `sortRelations`.

## Task 13: `AppProviders`, `layout.tsx`, `not-found.tsx`, tiêu đề trang

**Mục tiêu:** một cây provider duy nhất cho toàn ứng dụng (Zod jitless, i18n, theme, tooltip, kho lưu trữ, vùng toast), layout gốc render đúng ngôn ngữ, lựa chọn theme và script chống nháy có nonce, và trang không tìm thấy đã được dịch.

**Loại:** B. **Phụ thuộc:** core 27, 5, 9, 10, 11, 15. **Đợt:** 9.

**File sở hữu:**

- Tạo `frontend/src/components/app-providers.tsx`, `frontend/src/components/app-providers.test.tsx`.
- Tạo `frontend/src/lib/i18n/request-locale.ts`, `frontend/src/lib/i18n/request-locale.test.ts`.
- Tạo `frontend/src/app/not-found.tsx`, `frontend/src/app/not-found.test.tsx`.
- Sửa `frontend/src/app/layout.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/common.ts` và `frontend/src/lib/i18n/locales/vi/common.ts` (chỉ **thêm** key, không sửa key đã có).

**Cài đặt** (spec mục 1 "Rendering", mục 8 "Mặc định, ghi nhớ, không nháy", mục 9 "Chọn ngôn ngữ", mục 11 "Content Security Policy"):

- `lib/i18n/request-locale.ts`, chỉ dùng ở Server Component:

  ```ts
  export async function getRequestLocale(): Promise<Locale>;
  export async function getRequestThemePreference(): Promise<ThemePreference>;
  export async function getRequestNonce(): Promise<string | null>;
  ```

  - `getRequestLocale` đọc `cookies()` và `headers()` của `next/headers`, rồi trả `resolveRequestLocale({ cookieValue: cookieStore.get(LOCALE_COOKIE_NAME)?.value, acceptLanguage: headerList.get("accept-language") })`.
  - `getRequestThemePreference` trả `parseThemePreference(cookieStore.get(THEME_COOKIE_NAME)?.value)`.
  - `getRequestNonce` trả `headerList.get(NONCE_HEADER_NAME)`.
  - Test gọi ba hàm này với `vi.mock("next/headers")`.
- `components/app-providers.tsx` (`"use client"`):
  - **Dòng import đầu tiên của file** là `import "@/lib/zod-config";`, kèm comment: Zod đọc `jitless` lúc **tạo** schema, còn core tạo schema khi được import, nên cấu hình phải nạp trước mọi import khác. Nếu `import-x/order` đòi sắp lại thì dùng `// eslint-disable-next-line import-x/order -- zod must be configured before any module creates a schema` và ghi vào báo cáo.
  - `type AppProvidersProps = { readonly locale: Locale; readonly themePreference: ThemePreference; readonly children: ReactNode }`.
  - `export function AppProviders({ locale, themePreference, children }: AppProvidersProps): JSX.Element` bọc theo thứ tự ngoài vào trong: `I18nProvider locale` → `ThemeProvider initialPreference={themePreference}` → `TooltipProvider` → `StorageProvider` → `<>{children}<AppToaster /></>`.
  - `AppToaster` là component **không export** trong cùng file: lấy `t` bằng `useTranslation("common")` rồi render `<Toaster containerAriaLabel={t("notifications.label")} />`.
- `app/layout.tsx` (Server Component, giữ default export):
  - `import "./globals.css";`.
  - `export async function generateMetadata(): Promise<Metadata>`: lấy locale bằng `getRequestLocale()`, `const t = getServerTranslation(locale, "common")` (hàm đồng bộ, trả `TFunction` trực tiếp, không `await`), trả `{ title: t("meta.title", { appName: APP_NAME }), description: t("meta.description") }`. Bỏ hằng `metadata` hiện có.
  - `RootLayout` là `async`, đọc locale, themePreference, nonce, rồi render:

    ```tsx
    <html lang={locale} data-theme-preference={themePreference} suppressHydrationWarning>
      <head>
        <script src="/theme-init.js" nonce={nonce ?? undefined} />
      </head>
      <body>
        <AppProviders locale={locale} themePreference={themePreference}>{children}</AppProviders>
      </body>
    </html>
    ```

  - Thẻ `<script>` không có `async`, không có `defer`, và dòng ngay trên nó là `{/* eslint-disable-next-line @next/next/no-sync-scripts -- the theme class must be set before the first paint, which next/script cannot guarantee */}`. Đây là **ngoại lệ tắt rule bằng comment được plan cho phép** (mục "Điểm nóng khi làm song song", dòng `eslint.config.mjs`; Vấn đề 41): `theme-init.js` phải chạy trước lần vẽ đầu để đặt class theme, mà `next/script` (kể cả `strategy="beforeInteractive"`) không bảo đảm điều đó. Không task nào khác được tắt `@next/next/no-sync-scripts`.
  - Nếu React 19.3 cảnh báo khi hydrate hoặc khi `router.refresh()` (rủi ro ở spec mục "Rủi ro cần kiểm tra khi triển khai") thì dừng và báo kèm nguyên văn cảnh báo, không tự đổi cách làm.
- `app/not-found.tsx` (`"use client"`, default export): dùng `useTranslation("common")`, render `<main>` có `<h1>{t("notFound.title")}</h1>`, một đoạn mô tả và `<Link href="/">{t("notFound.backToList")}</Link>` của `next/link`. Là client component để chính trang 404 không gọi dynamic API; locale lấy từ `I18nProvider` của layout (Vấn đề 31). Trang 404 **không** được prerender: layout gốc đọc cookie, header và nonce CSP, nên `/_not-found` cũng là route động (Vấn đề 42).
- Key thêm vào `common` (cả `en` và `vi`, `vi` có đủ dấu):
  - `meta.title` (có biến `{{appName}}`), `meta.description`.
  - `notFound.title`, `notFound.description`, `notFound.backToList`.

**Test viết trước:**

- `request-locale.test.ts`: `reads the locale from the sf-locale cookie`; `falls back to Accept-Language without a cookie`; `falls back to en without a cookie or a matching header`; `reads the theme preference from the sf-theme cookie`; `returns null when the nonce header is missing`.
- `app-providers.test.tsx`: `configures zod in jitless mode`; `renders children translated in the given locale`; `applies the initial theme preference`; `renders a toast region with a translated label`; `renders tooltips without a missing provider error`; `renders storage-dependent children while storage is still pending`.
- `not-found.test.tsx`: `shows a translated not found message in %s` (`it.each` `vi`, `en`); `links back to the schema list`; `reports no axe violations` (dùng `expectNoAxeViolations`).

**Kiểm tra:** như "Quy ước chung", thêm:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
grep -n 'zod-config' frontend/src/components/app-providers.tsx
grep -rn 'from "next/headers"' frontend/src --include=*.tsx --include=*.ts
```

Mong đợi: `zod-config` là import đầu tiên của `app-providers.tsx`; chỉ `lib/i18n/request-locale.ts` import `next/headers`. `pnpm --filter @schemaforge/frontend build` thành công và in route `/` và `/_not-found`, cả hai đánh dấu động (`ƒ`), không phải tĩnh (`○`): layout gốc đọc `cookies()`, `headers()` và nonce, và nonce bắt buộc mỗi request phải render lại (Vấn đề 42).

**Commit:** `feat(frontend): wire app providers into the root layout`

## Task 14: Bản dịch `issues` và `errors`

**Mục tiêu:** mỗi `IssueCode` và mỗi `ErrorCode` của core có một thông báo đã dịch ở cả `vi` và `en`, nên thêm mã mới trong core mà chưa dịch là lỗi biên dịch.

**Loại:** B. **Phụ thuộc:** core 26, 9. **Đợt:** 8.

**File sở hữu:** sửa `frontend/src/lib/i18n/locales/en/issues.ts`, `locales/vi/issues.ts`, `locales/en/errors.ts`, `locales/vi/errors.ts`, `frontend/src/lib/i18n/create-i18n-instance.test.ts` (chỉ một test, xem mục "Cài đặt"); tạo `frontend/src/lib/i18n/issue-and-error-messages.test.ts`.

**Cài đặt** (spec mục 4 "Dịch", mục 9 "Namespace và resource", mục 3 "Lỗi cấu trúc khi dispatch"):

- **Mệnh đề `satisfies` của file `vi`.** Task 9 để lại `export const viIssues = {} as const;` và `export const viErrors = {} as const;` không có `satisfies`, vì với object `en` rỗng thì `LocaleNamespace<typeof enIssues>` resolve ra `{}` và vướng rule `@typescript-eslint/no-generated-empty-object-type` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enIssues>` (và `LocaleNamespace<typeof enErrors>`), rồi xóa comment placeholder. Mệnh đề chỉ hợp lệ khi object đã có ít nhất một key.
- `issues.ts` phẳng: `export const enIssues = { …25 key… } as const satisfies Record<IssueCode, string>;` và `export const viIssues = { … } as const satisfies LocaleNamespace<typeof enIssues>;`. Key là chính mã issue (`"table-name-duplicate"`…); dấu `-` không phải ký tự phân tách key của i18next nên dùng trực tiếp được.
- `errors.ts` có hai nhánh (Vấn đề 30):

  ```ts
  export const enErrors = {
    codes: { …17 key… },
    operationNotApplied: "The action was not applied",
  } as const;
  ```

  với `codes` mang `satisfies Record<ErrorCode, string>`. `viErrors` tương ứng, thêm `satisfies LocaleNamespace<typeof enErrors>`.
- Biến nội suy dùng đúng năm tên ở spec mục 4: `{{table}}`, `{{column}}`, `{{index}}`, `{{enum}}`, `{{value}}`. Biến của mỗi mã:

  | Nhóm mã | Biến |
  |---|---|
  | `name-empty`, `name-invalid`, `name-too-long` | không có (thông báo chung cho tên, hiển thị cạnh trường) |
  | `table-name-duplicate` | `{{table}}` |
  | `enum-name-duplicate` | `{{enum}}` |
  | `column-name-duplicate` | `{{table}}`, `{{column}}` |
  | `index-name-duplicate` | `{{index}}` |
  | `subject-area-name-duplicate` | không có |
  | `enum-values-empty` | `{{enum}}` |
  | `enum-value-duplicate` | `{{enum}}`, `{{value}}` |
  | `column-type-invalid-scale`, `column-custom-type-invalid`, `column-default-invalid`, `column-default-incompatible`, `column-primary-key-nullable`, `column-auto-increment-invalid-type`, `column-auto-increment-nullable`, `column-auto-increment-with-default`, `column-auto-increment-not-key` | `{{column}}` |
  | `table-multiple-auto-increment` | `{{table}}` |
  | `relation-column-type-mismatch`, `relation-target-not-unique`, `relation-one-to-one-not-unique`, `relation-set-null-not-nullable`, `relation-set-default-without-default` | `{{column}}` |

- **Siết test nội suy của Task 9.** Đây là task đầu tiên thêm key có biến `{{…}}`, nên sửa luôn test `does not escape interpolation values` trong `frontend/src/lib/i18n/create-i18n-instance.test.ts`: hiện nó đi qua `instance.services.interpolator.interpolate(...)` vì lúc Task 9 chạy chưa có key nào có biến; nay khẳng định trực tiếp qua `t(key, { … })` với một key thật của `issues`. Đây là ngoại lệ duy nhất mà task này được sửa file của Task 9; không đụng phần còn lại của file đó.
- Giọng văn: một câu, nêu vấn đề rồi cách sửa, không dùng thuật ngữ nội bộ ("operation", "path"), tên phần tử đặt trong dấu nháy kép cong (`“…”` ở `vi`, `“…”` ở `en`). Ví dụ:
  - `table-name-duplicate`: en "Another table or enum is already named “{{table}}”.", vi có nghĩa tương đương (bảng và enum chung một không gian tên; câu ban đầu "Another table is already named …" đã được sửa sau đợt 8, Vấn đề 39).
  - `column-primary-key-nullable`: vi "Cột “{{column}}” là khóa chính nên không được cho phép NULL." / en "Primary key column “{{column}}” cannot be nullable."
  - `enum-values-empty`: vi "Enum “{{enum}}” chưa có giá trị nào." / en "Enum “{{enum}}” has no values."
- `errors.codes.*` nói cho người dùng hiểu chuyện gì xảy ra mà không lộ đường dẫn tài liệu, ví dụ `table-not-found`: vi "Không tìm thấy bảng cần thay đổi." / en "The table to change no longer exists."

**Test viết trước** (`issue-and-error-messages.test.ts`, import `ISSUE_CODES`, `ERROR_CODES` từ `@schemaforge/core`):

- `has a non-empty issue message for %s in %s` (`it.each` trên tích `ISSUE_CODES` × `["en", "vi"]`).
- `has a non-empty error message for %s in %s` (`it.each` trên tích `ERROR_CODES` × hai locale).
- `has an operationNotApplied message in %s` (`it.each` hai locale).
- `uses only the documented interpolation variables` (mọi `{{…}}` trong hai namespace, ở cả hai locale, nằm trong tập `table`, `column`, `index`, `enum`, `value`).
- `uses the same interpolation variables in vi and en for %s` (`it.each` trên `ISSUE_CODES`).
- `translates issue %s through createI18nInstance` (`it.each` vài mã tiêu biểu có biến, kiểm tra `t("issues:table-name-duplicate", { table: "users" })` chứa `users` và không còn `{{`).

**Kiểm tra:** như "Quy ước chung", thêm hai thử nghiệm biên dịch tạm thời (làm từng cái, hoàn tác ngay sau đó, rồi xác nhận `git diff` sạch):

1. Xóa một key trong `locales/en/issues.ts` → `pnpm --filter @schemaforge/frontend typecheck` fail tại `satisfies Record<IssueCode, string>`.
2. Thêm một key thừa vào `locales/vi/issues.ts` → `typecheck` fail tại `satisfies LocaleNamespace<typeof enIssues>`.

**Commit:** `feat(frontend): add issue and error message translations`

## Task 15: `SchemaRepository` và `StorageProvider`

**Mục tiêu:** một cửa duy nhất để đọc và ghi IndexedDB: mọi lần đọc tài liệu đi qua `parseSchemaDocument`, mọi lần ghi là một transaction, và hai màn hình lấy repository cùng khóa tab qua một context dựng được trên trình duyệt lẫn trong test.

**Loại:** B. **Phụ thuộc:** core 26, 6, 7. **Đợt:** 8.

**File sở hữu:** tạo trong `frontend/src/lib/storage/`: `schema-repository.ts`, `schema-repository.test.ts`, `create-browser-storage.ts`, `storage-context.tsx`, `storage-context.test.tsx`.

**Cài đặt** (spec mục 7 "Database", "Đọc: luôn qua `parseSchemaDocument`", "Ghi: autosave", "Đổi tên và xóa từ màn hình danh sách", "Viewport"; mục 1 "Màn hình danh sách"):

- `schema-repository.ts`:

  ```ts
  export type SchemaListEntry =
    | { readonly kind: "readable"; readonly schema: SchemaRecord }
    | { readonly kind: "unreadable"; readonly schemaId: string };

  export type OpenSchemaResult =
    | { readonly kind: "opened"; readonly document: SchemaDocument }
    | { readonly kind: "not-found" }
    | { readonly kind: "unreadable"; readonly errors: readonly StructuralError[] };

  export type RenameSchemaResult =
    | { readonly kind: "renamed" }
    | { readonly kind: "not-found" }
    | { readonly kind: "unreadable" };

  export type SchemaRepositoryDependencies = {
    readonly database: SchemaforgeDatabase;
    readonly clock: () => number;
    readonly generateId: () => string;
  };

  export type SchemaRepository = {
    readonly listSchemas: () => Promise<readonly SchemaListEntry[]>;
    readonly createSchema: (name: string) => Promise<SchemaRecord>;
    readonly openSchema: (schemaId: string) => Promise<OpenSchemaResult>;
    readonly saveDocument: (schemaId: string, document: SchemaDocument) => Promise<void>;
    readonly renameSchema: (schemaId: string, name: string) => Promise<RenameSchemaResult>;
    readonly deleteSchema: (schemaId: string) => Promise<void>;
    readonly readViewport: (schemaId: string) => Promise<ViewportRecord | null>;
    readonly saveViewport: (viewport: ViewportRecord) => Promise<void>;
  };

  export function createSchemaRepository(dependencies: SchemaRepositoryDependencies): SchemaRepository;
  ```

  - `listSchemas`: `database.schemas.orderBy("updatedAt").reverse().toArray()`, rồi từng dòng qua `parseSchemaRecord`. Dòng parse được thành `readable`; dòng không parse được nhưng có `id` là chuỗi hợp `isSchemaId` thành `unreadable`; dòng không lấy được `id` hợp lệ bị bỏ qua.
  - `createSchema(name)`: `id = generateId()`, `now = clock()`, `document = createEmptySchema(name)`; một transaction `rw` trên `schemas` và `documents` ghi `{ id, name, createdAt: now, updatedAt: now }` và `{ schemaId: id, document }`; trả về record vừa ghi. `generateId` ở code chạy thật là `() => crypto.randomUUID()`, trong test là bộ đếm sinh UUID cố định.
  - `openSchema`: đọc `documents.get(schemaId)`; không có thì `not-found`; có thì `parseSchemaDocument(record.document)` và trả `opened` hoặc `unreadable` kèm `result.error`. **Không bao giờ ghi lại** trong hàm này.
  - `saveDocument`: một transaction `rw` trên `documents` và `schemas`: `documents.put({ schemaId, document })` và `schemas.update(schemaId, { name: document.name, updatedAt: clock() })`. Bản ghi `schemas` không tồn tại thì `update` trả 0 và hàm kết thúc bình thường (schema đã bị xóa ở tab khác).
  - `renameSchema`: trong một transaction `rw`, đọc tài liệu, `parseSchemaDocument`, `applyOperation(document, { type: "renameSchema", name })`; lỗi parse thì trả `unreadable` và không ghi gì; thành công thì ghi tài liệu mới cùng `schemas.update(schemaId, { name, updatedAt: clock() })`. `applyOperation` trả lỗi ở đây là lỗi lập trình: throw `Error` kèm mã lỗi.
  - `deleteSchema`: một transaction `rw` trên cả ba bảng, xóa theo khóa.
  - `readViewport`: `viewports.get(schemaId)` rồi `parseViewportRecord`; sai hình dạng trả `null`.
  - `saveViewport`: `viewports.put(viewport)`. Không đụng `schemas`, nên `updatedAt` không đổi.
  - Repository **không bắt lỗi** của Dexie: nơi gọi ánh xạ bằng `toStorageErrorCode`.
- `create-browser-storage.ts`:

  ```ts
  export type StorageBundle = {
    readonly repository: SchemaRepository;
    readonly lockManager: SchemaLockManager;
    readonly database: SchemaforgeDatabase;
  };
  export function createBrowserStorage(): StorageBundle;
  ```

  Dựng `new SchemaforgeDatabase()`, `createBrowserSchemaLockManager()` và `createSchemaRepository({ database, clock: () => Date.now(), generateId: () => crypto.randomUUID() })`. Hàm này chỉ được gọi trên trình duyệt.
- `storage-context.tsx` (`"use client"`):

  ```ts
  export type StorageState =
    | { readonly kind: "pending" }
    | { readonly kind: "ready"; readonly storage: StorageBundle }
    | { readonly kind: "unavailable"; readonly errorCode: StorageErrorCode };
  export type StorageProviderProps = { readonly storage?: StorageBundle; readonly children: ReactNode };
  export function StorageProvider({ storage, children }: StorageProviderProps): JSX.Element;
  export function useStorage(): StorageState;
  ```

  - Có prop `storage` (test và Storybook tương lai) thì state là `ready` ngay, không chạy effect.
  - Không có thì state khởi tạo `pending`, và một effect chạy một lần gọi `createBrowserStorage()` trong `try`/`catch`; lỗi thành `{ kind: "unavailable", errorCode: toStorageErrorCode(error) }`. Cleanup đóng `database` khi provider unmount.
  - `useStorage` ngoài provider trả `{ kind: "pending" }`? **Không**: throw `Error` như `useThemePreference` (lỗi lập trình). Giá trị context được memo.
  - Effect là nơi duy nhất chạm trình duyệt, nên SSR chỉ render `pending` (Vấn đề 32).
- **Chữ ký đã triển khai (đợt 8).** Task sau viết theo đúng các chữ ký này. Mọi type và hàm export khớp khối ở trên (chỉ khác cách xuống dòng của Prettier); không có export nào khác trong ba file.

  ```ts
  // schema-repository.ts
  export type SchemaListEntry =
    | { readonly kind: "readable"; readonly schema: SchemaRecord }
    | { readonly kind: "unreadable"; readonly schemaId: string };
  export type OpenSchemaResult =
    | { readonly kind: "opened"; readonly document: SchemaDocument }
    | { readonly kind: "not-found" }
    | { readonly kind: "unreadable"; readonly errors: readonly StructuralError[] };
  export type RenameSchemaResult =
    | { readonly kind: "renamed" }
    | { readonly kind: "not-found" }
    | { readonly kind: "unreadable" };
  export type SchemaRepositoryDependencies = {
    readonly database: SchemaforgeDatabase;
    readonly clock: () => number;
    readonly generateId: () => string;
  };
  export type SchemaRepository = {
    readonly listSchemas: () => Promise<readonly SchemaListEntry[]>;
    readonly createSchema: (name: string) => Promise<SchemaRecord>;
    readonly openSchema: (schemaId: string) => Promise<OpenSchemaResult>;
    readonly saveDocument: (schemaId: string, document: SchemaDocument) => Promise<void>;
    readonly renameSchema: (schemaId: string, name: string) => Promise<RenameSchemaResult>;
    readonly deleteSchema: (schemaId: string) => Promise<void>;
    readonly readViewport: (schemaId: string) => Promise<ViewportRecord | null>;
    readonly saveViewport: (viewport: ViewportRecord) => Promise<void>;
  };
  export function createSchemaRepository(dependencies: SchemaRepositoryDependencies): SchemaRepository;

  // create-browser-storage.ts
  export type StorageBundle = {
    readonly repository: SchemaRepository;
    readonly lockManager: SchemaLockManager;
    readonly database: SchemaforgeDatabase;
  };
  export function createBrowserStorage(): StorageBundle;

  // storage-context.tsx ("use client")
  export type StorageState =
    | { readonly kind: "pending" }
    | { readonly kind: "ready"; readonly storage: StorageBundle }
    | { readonly kind: "unavailable"; readonly errorCode: StorageErrorCode };
  export type StorageProviderProps = {
    readonly storage?: StorageBundle;
    readonly children: ReactNode;
  };
  export function StorageProvider({ storage, children }: StorageProviderProps): JSX.Element;
  export function useStorage(): StorageState;
  ```

  Khác biệt hành vi so với mô tả ở trên, cần biết khi dùng: `createSchema` ghi `name: document.name` (tên sau `createEmptySchema`), không phải tham số thô; với prop `storage`, effect vẫn chạy nhưng thoát ngay, giá trị context là `{ kind: "ready", storage }` dựng bằng `useMemo`; `saveDocument` không báo gì khi dòng `schemas` đã bị xóa (Vấn đề 40, mục 6).

**Test viết trước** (mỗi test tạo `new SchemaforgeDatabase({ indexedDB: new IDBFactory(), IDBKeyRange })` của `fake-indexeddb`, `clock` là bộ đếm, `generateId` sinh UUID cố định; `afterEach` đóng database):

- `schema-repository.test.ts`:
  - `creates a schema with an empty document and matching metadata`.
  - `lists schemas from the most recently updated`.
  - `reports a schema row that does not parse as unreadable`.
  - `skips a schema row without a valid id`.
  - `opens a stored document through parseSchemaDocument`.
  - `returns not-found for a schema id that was never stored`.
  - `returns unreadable with version-unsupported for a newer document version`.
  - `returns unreadable for a structurally invalid document`.
  - `never overwrites a document it could not parse`.
  - `saves a document and updates the name and updatedAt together`.
  - `keeps working when saving a document whose metadata row is gone`.
  - `renames a schema through the renameSchema operation`.
  - `refuses to rename a schema whose document does not parse`.
  - `deletes the schema, document and viewport rows`.
  - `stores a viewport without touching updatedAt`.
  - `returns null for a viewport row with an invalid shape`.
- `storage-context.test.tsx`:
  - `exposes the storage passed as a prop`.
  - `reports unavailable when creating browser storage throws` (`vi.mock` module `./create-browser-storage`).
  - `maps a MissingAPIError to the unavailable storage code`.
  - `throws when useStorage is used outside the provider`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add schema repository and storage provider`

## Task 16: Lựa chọn, gợi ý tên và hàm dựng operation

**Mục tiêu:** các hàm thuần dựng operation nhiều bước mà UI cần: thêm bảng có cột `id` khóa chính, thêm enum có sẵn một giá trị, xóa lựa chọn bằng một `batch`, cùng kiểu `Selection` và cách gợi ý tên không trùng.

**Loại:** B. **Phụ thuộc:** core 26. **Đợt:** 8.

**File sở hữu:** tạo trong `frontend/src/features/editor/lib/`: `selection.ts`, `selection.test.ts`, `name-suggestions.ts`, `name-suggestions.test.ts`, `build-add-table-operation.ts`, `build-add-table-operation.test.ts`, `build-add-enum-operation.ts`, `build-add-enum-operation.test.ts`, `build-delete-selection-operation.ts`, `build-delete-selection-operation.test.ts`.

**Cài đặt** (spec mục 2 "Toolbar", mục 3 "Chọn, di chuyển, xóa", mục 5 "Store theo từng schema"):

- `selection.ts`:

  ```ts
  export type Selection = {
    readonly tableIds: readonly TableId[];
    readonly relationIds: readonly RelationId[];
  };
  export const EMPTY_SELECTION: Selection;
  export function countSelection(selection: Selection): number;
  export function isSelectionEmpty(selection: Selection): boolean;
  export function filterSelection(selection: Selection, document: SchemaDocument): Selection;
  ```

  `filterSelection` bỏ id không còn trong `document.tables`, `document.relations`; không có gì bị bỏ thì **trả lại đúng object `selection` cũ**, để selector của Zustand không render lại vô cớ.
- `name-suggestions.ts`:

  ```ts
  export const TABLE_NAME_PREFIX = "table_";
  export const COLUMN_NAME_PREFIX = "column_";
  export const ENUM_NAME_PREFIX = "enum_";
  export const ENUM_VALUE_PREFIX = "value_";

  export function suggestNumberedName(prefix: string, usedNames: readonly string[]): string;
  export function suggestTableName(document: SchemaDocument): string;
  export function suggestColumnName(document: SchemaDocument, tableId: TableId): string;
  export function suggestEnumName(document: SchemaDocument): string;
  export function suggestEnumValue(values: readonly string[]): string;
  export function suggestJunctionTableName(
    document: SchemaDocument,
    input: { readonly leftTableName: string; readonly rightTableName: string },
  ): string;
  ```

  - `suggestNumberedName` trả `${prefix}${n}` với `n` nguyên nhỏ nhất từ 1 mà tên chưa dùng.
  - `suggestJunctionTableName` trả `<left>_<right>`, trùng thì thêm `_2`, `_3`… (giống `pickUnusedName` của core).
  - So sánh **không phân biệt hoa thường** bằng hàm nội bộ `toNameKey(name) = name.toLowerCase()`, kèm comment: phải khớp `toNameKey` của core, hàm này không nằm trong public API (Vấn đề 27). `toLowerCase` chứ không phải `toLocaleLowerCase`, để kết quả không đổi theo locale.
  - `suggestColumnName` chỉ xét tên các cột của `tableId`; `suggestEnumValue` chỉ xét mảng giá trị được truyền vào.
- `build-add-table-operation.ts`:

  ```ts
  export const NEW_TABLE_OFFSET = 24;
  export type AddTableResult = {
    readonly operation: Operation;
    readonly tableId: TableId;
    readonly primaryKeyColumnId: ColumnId;
  };
  export function findFreeTablePosition(document: SchemaDocument, position: Position): Position;
  export function buildAddTableOperation(
    document: SchemaDocument,
    input: { readonly position: Position; readonly generateId: GenerateId },
  ): AddTableResult;
  ```

  - `findFreeTablePosition` cộng dồn `NEW_TABLE_OFFSET` vào cả `x` và `y` chừng nào còn một bảng có đúng vị trí đó, tối đa `MAX_POSITION_ATTEMPTS = 50` lần rồi trả vị trí cuối cùng.
  - `operation` là `batch` gồm ba bước, đúng thứ tự:
    1. `addTable` với `table: { id, name: suggestTableName(document), comment: "", position, subjectAreaId: null }`.
    2. `addColumn` với `insertAt: 0` và `column: { id, tableId, name: "id", type: { kind: "bigint" }, isNullable: false, defaultValue: null, isUnique: false, isAutoIncrement: true, comment: "" }`.
    3. `setPrimaryKey` với `columnIds: [primaryKeyColumnId]`.
  - Id lấy từ `createTableId(generateId)` rồi `createColumnId(generateId)`, đúng thứ tự đó.
- `build-add-enum-operation.ts`: `buildAddEnumOperation(document, generateId): { readonly operation: Operation; readonly enumId: EnumId }`, một bước `addEnum` với `values: [suggestEnumValue([])]`, tức `["value_1"]`.
- `build-delete-selection-operation.ts`: `buildDeleteSelectionOperation(selection: Selection): Operation | null`. Lựa chọn rỗng trả `null`. Ngược lại trả `batch` gồm `removeRelation` cho từng `relationIds` (theo thứ tự trong lựa chọn) rồi `removeTable` cho từng `tableIds`. Quan hệ đứng trước nên quan hệ nối với một bảng cũng đang được chọn không bị xóa hai lần.
- **Chữ ký đã triển khai (đợt 8).** Khớp các khối ở trên, trừ một điểm: `build-add-enum-operation.ts` export thêm type có tên `AddEnumResult` thay cho kiểu trả về viết tại chỗ.

  ```ts
  // selection.ts
  export type Selection = {
    readonly tableIds: readonly TableId[];
    readonly relationIds: readonly RelationId[];
  };
  export const EMPTY_SELECTION: Selection; // { tableIds: [], relationIds: [] }
  export function countSelection(selection: Selection): number;
  export function isSelectionEmpty(selection: Selection): boolean;
  export function filterSelection(selection: Selection, document: SchemaDocument): Selection;

  // name-suggestions.ts
  export const TABLE_NAME_PREFIX = "table_";
  export const COLUMN_NAME_PREFIX = "column_";
  export const ENUM_NAME_PREFIX = "enum_";
  export const ENUM_VALUE_PREFIX = "value_";
  export function suggestNumberedName(prefix: string, usedNames: readonly string[]): string;
  export function suggestTableName(document: SchemaDocument): string;
  export function suggestColumnName(document: SchemaDocument, tableId: TableId): string;
  export function suggestEnumName(document: SchemaDocument): string;
  export function suggestEnumValue(values: readonly string[]): string;
  export function suggestJunctionTableName(
    document: SchemaDocument,
    input: { readonly leftTableName: string; readonly rightTableName: string },
  ): string;

  // build-add-table-operation.ts
  export const NEW_TABLE_OFFSET = 24;
  export type AddTableResult = {
    readonly operation: Operation;
    readonly tableId: TableId;
    readonly primaryKeyColumnId: ColumnId;
  };
  export function findFreeTablePosition(document: SchemaDocument, position: Position): Position;
  export function buildAddTableOperation(
    document: SchemaDocument,
    input: { readonly position: Position; readonly generateId: GenerateId },
  ): AddTableResult;

  // build-add-enum-operation.ts
  export type AddEnumResult = {
    readonly operation: Operation;
    readonly enumId: EnumId;
  };
  export function buildAddEnumOperation(document: SchemaDocument, generateId: GenerateId): AddEnumResult;

  // build-delete-selection-operation.ts
  export function buildDeleteSelectionOperation(selection: Selection): Operation | null;
  ```

  `filterSelection` so độ dài hai mảng sau khi lọc để quyết định trả lại object cũ. `toNameKey` là hàm cục bộ không export trong `name-suggestions.ts`; `MAX_POSITION_ATTEMPTS` là hằng không export.

**Test viết trước** (dựng schema bằng `buildSchema`, `makeTable`, `makeColumn`, `makeRelation` và `createCounterIdGenerator` của `@schemaforge/core/testing`; áp operation bằng `applyOperation` và `unwrapOk`):

- `selection.test.ts`: `counts tables and relations together`; `treats an empty selection as empty`; `drops ids that no longer exist in the document`; `returns the same selection object when nothing was dropped`.
- `name-suggestions.test.ts`: `suggests %s when %s are taken` (`it.each` cho `table_1`, `table_2`, `column_1`, `enum_1`, `value_1`); `ignores case when a name is taken`; `suggests a junction table name from both table names`; `adds a numeric suffix when the junction name is taken`.
- `build-add-table-operation.test.ts`: `builds one batch with a table, an id column and a primary key`; `names the new table with the first free numbered name`; `offsets the position when a table already sits there`; `applies without introducing any issue` (`validateSchema` sau khi áp trả mảng rỗng); `undoes the whole batch in one step` (áp nghịch đảo trả về đúng tài liệu ban đầu về mặt nội dung).
- `build-add-enum-operation.test.ts`: `builds an enum with one starter value`; `applies without introducing any issue`.
- `build-delete-selection-operation.test.ts`: `returns null for an empty selection`; `removes relations before tables`; `applies when a table and one of its relations are both selected`; `restores everything with a single undo`; `keeps relations that are not selected`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add selection and schema operation builders`

## Task 17: Chỉ mục issue và `resolveIssueTarget`

**Mục tiêu:** từ một tài liệu, có ngay danh sách issue đã được nhóm theo phần tử và theo bảng, cùng cách đổi một `DocumentPath` thành phần tử và các biến nội suy để dịch thông báo.

**Loại:** B. **Phụ thuộc:** core 26. **Đợt:** 8.

**File sở hữu:** tạo `frontend/src/features/editor/lib/resolve-issue-target.ts`, `resolve-issue-target.test.ts`, `issue-index.ts`, `issue-index.test.ts`.

**Cài đặt** (spec mục 4):

- `resolve-issue-target.ts`:

  ```ts
  export type IssueElementKind = "schema" | "table" | "column" | "relation" | "index" | "enum" | "subjectArea";

  export type IssueValues = {
    readonly table?: string;
    readonly column?: string;
    readonly index?: string;
    readonly enum?: string;
    readonly value?: string;
  };

  export type IssueTarget = {
    readonly kind: IssueElementKind;
    readonly elementId: string | null;
    readonly tableId: TableId | null;
    readonly values: IssueValues;
  };

  export function resolveIssueTarget(document: SchemaDocument, path: DocumentPath): IssueTarget;
  ```

  - `DocumentPath` là `readonly (string | number)[]`, không phải union (Vấn đề 38). Đoạn đầu `path[0]` không phải chuỗi hoặc không thuộc union cục bộ `ElementPrefix` (sáu map `tables`, `columns`, `relations`, `indexes`, `enums`, `subjectAreas`, kiểm tra bằng type guard `isElementPrefix`) thì trả `{ kind: "schema", elementId: null, tableId: null, values: {} }` (dùng cho `["name"]`, `["notes", …]` và mọi đường dẫn lạ); sau đó mới `switch (prefix)` vét cạn, `default` gán `never`.
  - `["tables", id, …]`: `kind: "table"`, `tableId` là bảng đó, `values.table` là tên bảng.
  - `["columns", id, …]`: `kind: "column"`, `tableId` lấy từ `column.tableId`, `values.column` là tên cột và `values.table` là tên bảng chứa nó.
  - `["relations", id, …]`: `kind: "relation"`, `tableId` là `relation.fromTableId`, `values.table` là tên bảng `from`; có `columnPairs[0]` thì `values.column` là tên cột khóa ngoại đầu tiên.
  - `["indexes", id, …]`: `kind: "index"`, `tableId` lấy từ `index.tableId`, `values.index` là tên index, `values.table` là tên bảng.
  - `["enums", id, …]`: `kind: "enum"`, `values.enum` là tên enum; đường dẫn dạng `["enums", id, "values", n]` với `n` là số thì thêm `values.value` là giá trị tại chỉ số đó.
  - `["subjectAreas", id, …]`: `kind: "subjectArea"`, `elementId` là id, không có biến nào.
  - Phần tử không tồn tại trong tài liệu (đường dẫn cũ) thì `elementId` vẫn là id đọc được, `tableId` là `null` và `values` rỗng. Không throw.
  - Đọc `path[1]` bằng thu hẹp kiểu (`typeof segment === "string"`), không ép kiểu. Tra phần tử bằng helper không export `lookup<Value>(elements: Readonly<Record<string, Value>>, elementId: string | null): Value | undefined`, vì chỉ số `string` trên map khóa template literal của core báo `TS7053` (Vấn đề 27).
- `issue-index.ts`:

  ```ts
  export type IssueIndex = {
    readonly issues: readonly Issue[];
    readonly schemaIssues: readonly Issue[];
    readonly issuesOfElement: (elementId: string) => readonly Issue[];
    readonly countOfElement: (elementId: string) => number;
    readonly countOfTable: (tableId: TableId) => number;
  };
  export function getIssueIndex(document: SchemaDocument): IssueIndex;
  ```

  - `getIssueIndex` nhớ kết quả trong một `WeakMap<SchemaDocument, IssueIndex>` ở cấp module. Đây là ngoại lệ duy nhất với quy ước "không state ở cấp module" (Vấn đề 25): comment ngay trên khai báo nêu lý do và ghi rằng cache không bao giờ được xóa bằng tay.
  - `issues` là kết quả `validateSchema(document)`, giữ nguyên thứ tự.
  - `issuesOfElement` tra theo `IssueTarget.elementId`; `countOfTable` tra theo `IssueTarget.tableId`, nên issue của cột và index cộng vào huy hiệu của bảng.
  - Hai hàm tra cứu đọc từ hai `Map` dựng sẵn lúc tạo chỉ mục; phần tử không có issue trả mảng rỗng **dùng chung một hằng** `NO_ISSUES: readonly Issue[] = []`, để selector trả cùng tham chiếu.
  - `countOfElement` và `countOfTable` trả số, dùng làm selector của Zustand.
- **Chữ ký đã triển khai (đợt 8).** Export khớp các khối ở trên; không có export nào khác. Phần không export mà task sau nên biết: `ELEMENT_PREFIXES`, `ElementPrefix`, `isElementPrefix`, `lookup` trong `resolve-issue-target.ts`; `NO_ISSUES` và `WeakMap` `indexesByDocument` trong `issue-index.ts`.

  ```ts
  // resolve-issue-target.ts
  export type IssueElementKind =
    "schema" | "table" | "column" | "relation" | "index" | "enum" | "subjectArea";
  export type IssueValues = {
    readonly table?: string;
    readonly column?: string;
    readonly index?: string;
    readonly enum?: string;
    readonly value?: string;
  };
  export type IssueTarget = {
    readonly kind: IssueElementKind;
    readonly elementId: string | null;
    readonly tableId: TableId | null;
    readonly values: IssueValues;
  };
  export function resolveIssueTarget(document: SchemaDocument, path: DocumentPath): IssueTarget;

  // issue-index.ts
  export type IssueIndex = {
    readonly issues: readonly Issue[];
    readonly schemaIssues: readonly Issue[];
    readonly issuesOfElement: (elementId: string) => readonly Issue[];
    readonly countOfElement: (elementId: string) => number;
    readonly countOfTable: (tableId: TableId) => number;
  };
  export function getIssueIndex(document: SchemaDocument): IssueIndex;
  ```

  Khác biệt nhỏ so với mô tả: `schemaIssues` gom issue có `elementId === null` (chỉ đích `schema`); issue của `subjectArea` có `elementId` nên nằm trong `issuesOfElement`. Quan hệ có bảng `from` đã mất vẫn mang `tableId: relation.fromTableId`. Cache `WeakMap` ở cấp module được giữ nguyên sau đợt 8 (Vấn đề 25).

**Test viết trước:**

- `resolve-issue-target.test.ts`: `resolves %s to the %s element` (`it.each` đủ sáu tiền tố cộng `["name"]`); `reads the owning table of a column`; `reads the owning table of an index`; `names the foreign key column of a relation`; `reads an enum value by index`; `returns an empty target for an unknown path prefix`; `returns no values for an element that no longer exists`.
- `issue-index.test.ts`: `returns the issues of validateSchema in the same order`; `returns the same index object for the same document reference`; `returns a different index for a different document`; `groups issues by element id`; `counts column and index issues on their table`; `returns the same empty array for elements without issues` (`toBe`); `separates schema-level issues from element issues`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add issue index and issue target resolution`

## Task 18: Store editor: `createEditorStore`, provider, `useEditorStore`

**Mục tiêu:** một store Zustand cho mỗi schema đang mở, với đúng một đường thay đổi tài liệu là `dispatch`, undo và redo dựa trên lịch sử của core, và cách đọc lát cắt hẹp từ component.

**Loại:** B. **Phụ thuộc:** core 26, 11, 14, 16. **Đợt:** 9.

**File sở hữu:** tạo trong `frontend/src/features/editor/state/`: `create-editor-store.ts`, `create-editor-store.test.ts`, `editor-store-provider.tsx`, `editor-store-provider.test.tsx`, `use-editor-store.ts`.

**Cài đặt** (spec mục 5, mục 6 "Gộp thao tác", mục 3 "Lỗi cấu trúc khi dispatch"):

- `create-editor-store.ts`:

  ```ts
  export const HISTORY_LIMIT = 200;

  export type SaveStatus =
    | { readonly kind: "saved" }
    | { readonly kind: "saving" }
    | { readonly kind: "failed"; readonly errorCode: StorageErrorCode };

  export type LeftPanelTab = "tables" | "enums" | "issues";

  export type DispatchOptions = { readonly coalesce?: "keyboardMove" };

  export type EditorState = {
    readonly schemaId: string;
    readonly document: SchemaDocument;
    readonly history: History;
    readonly selection: Selection;
    readonly dragPositions: Readonly<Partial<Record<TableId, Position>>>;
    readonly leftPanelTab: LeftPanelTab | null;
    readonly focusRequest: DocumentPath | null;
    readonly saveStatus: SaveStatus;
    readonly coalesceKey: string | null;
  };

  export type EditorActions = {
    readonly dispatch: (operation: Operation, options?: DispatchOptions) => Result<void, OperationError>;
    readonly undo: () => void;
    readonly redo: () => void;
    readonly setSelection: (selection: Selection) => void;
    readonly setDragPositions: (dragPositions: Readonly<Partial<Record<TableId, Position>>>) => void;
    readonly setLeftPanelTab: (tab: LeftPanelTab | null) => void;
    readonly requestFocus: (path: DocumentPath | null) => void;
    readonly setSaveStatus: (status: SaveStatus) => void;
    readonly replaceDocument: (document: SchemaDocument) => void;
  };

  export type EditorStore = StoreApi<EditorState & EditorActions>;

  export type CreateEditorStoreInput = {
    readonly schemaId: string;
    readonly document: SchemaDocument;
    readonly generateId: GenerateId;
    readonly notify: Notify;
    readonly logger: Logger;
  };

  export function createEditorStore(input: CreateEditorStoreInput): EditorStore;
  export function getMoveCoalesceKey(operation: Operation): string | null;
  ```

  - Dựng bằng `createStore` của `zustand/vanilla`. State ban đầu: `history: createEmptyHistory()`, `selection: EMPTY_SELECTION`, `dragPositions: {}`, `leftPanelTab: "tables"`, `focusRequest: null`, `saveStatus: { kind: "saved" }`, `coalesceKey: null`.
  - `generateId` được giữ trong closure và **không** nằm trong state; component lấy id mới qua các hàm dựng operation, không qua store.
  - Store **không** sở hữu chỉ mục issue: không có trường `issueIndex`, không gọi `validateSchema` hay `getIssueIndex`. Component tự gọi `getIssueIndex(document)` với `document` đọc từ store; cache `WeakMap` cấp module trong `issue-index.ts` được giữ (Vấn đề 25).
  - `dispatch(operation, options)`:
    1. `const applied = applyOperation(state.document, operation)`.
    2. Lỗi: `logger.error("editor.operation-rejected", { operationType: operation.type, code: applied.error.code, path: applied.error.path })`, rồi `notify({ tone: "error", titleKey: "errors:operationNotApplied", descriptionKey: \`errors:codes.${applied.error.code}\` })`; state giữ nguyên; trả `{ isOk: false, error: applied.error }`.
    3. Thành công nhưng `applied.value.schema === state.document` (core trả đúng tham chiếu cũ khi không có gì đổi): không ghi lịch sử, không `set`, trả `{ isOk: true, value: undefined }`.
    4. Thành công: `entry = { operation, inverse: applied.value.inverse }`; `key = options?.coalesce === "keyboardMove" ? getMoveCoalesceKey(operation) : null`; nếu `key !== null && key === state.coalesceKey` thì `history = mergeLastEntry(state.history, entry)`, ngược lại `history = recordEntry(state.history, entry, HISTORY_LIMIT)`; `selection = filterSelection(state.selection, applied.value.schema)`; `set({ document: applied.value.schema, history, selection, coalesceKey: key })`; trả `{ isOk: true, value: undefined }`.
    - Core không export `ok`/`err`, nên hai giá trị trả về là literal đúng hình dạng `Result` (Vấn đề 26).
  - `getMoveCoalesceKey` trả `null` cho operation không phải `moveElements`, ngược lại trả `"keyboardMove:"` cộng danh sách `elementId` đã sắp tăng dần, nối bằng `,`. Nhờ vậy hai lần nhấn mũi tên trên **cùng tập bảng** mới gộp, còn một dispatch khác xen giữa sẽ đặt `coalesceKey` về `null`.
  - `undo()`: gọi `undo(state.history, state.document)` của core; `null` thì không làm gì; ngược lại `set({ document, history, selection: filterSelection(...), coalesceKey: null })`. `redo()` tương tự. Core throw khi áp nghịch đảo thất bại; store **không** bắt, để `error.tsx` hiện (spec mục 1).
  - `setSelection`, `setDragPositions`, `setLeftPanelTab`, `requestFocus`, `setSaveStatus` chỉ `set` đúng trường của mình.
  - `replaceDocument(document)`: dùng khi tab này vừa được cấp khóa và đọc lại tài liệu từ database; đặt `document`, `history: createEmptyHistory()`, `selection: EMPTY_SELECTION`, `dragPositions: {}`, `coalesceKey: null`.
- `editor-store-provider.tsx` (`"use client"`): `EditorStoreContext = createContext<EditorStore | null>(null)`; `type EditorStoreProviderProps = { readonly store: EditorStore; readonly children: ReactNode }`; `export function EditorStoreProvider({ store, children }: EditorStoreProviderProps): JSX.Element`. Store được tạo ở nơi biết tài liệu (Task 22), provider chỉ truyền xuống.
- `use-editor-store.ts`:

  ```ts
  export function useEditorStoreApi(): EditorStore;
  export function useEditorStore<Slice>(selector: (state: EditorState & EditorActions) => Slice): Slice;
  ```

  `useEditorStoreApi` throw `Error` khi dùng ngoài provider (lỗi lập trình). `useEditorStore` bọc `useStore` của `zustand`. Comment: selector không được trả object mới ở mỗi lần gọi; cần nhiều giá trị thì dùng `useShallow` của `zustand/react/shallow`.

**Test viết trước** (`create-editor-store.test.ts` dùng `buildSchema`, `makeTable`, `makeColumn` và `createCounterIdGenerator`; `notify` và `logger` là object với `vi.fn()`):

- `records one history entry for a successful dispatch`.
- `keeps the document and history unchanged when the operation is rejected`.
- `notifies and logs the error code when the operation is rejected`.
- `returns the operation error to the caller`.
- `records nothing when the operation changes nothing`.
- `undoes the last entry`; `redoes an undone entry`; `does nothing when there is nothing to undo`.
- `merges consecutive keyboard moves of the same tables into one entry`.
- `does not merge keyboard moves of a different set of tables`.
- `does not merge when another dispatch happened in between`.
- `keeps a mouse drag of several tables as one entry`.
- `drops selected ids that the operation removed`.
- `keeps the selection object when nothing was removed`.
- `clears history and selection when the document is replaced`.
- `caps the history at the history limit` (dispatch `HISTORY_LIMIT + 1` lần, `past.length` là `HISTORY_LIMIT`).
- `editor-store-provider.test.tsx`: `exposes the store to consumers`; `throws when useEditorStore is used outside the provider`; `re-renders a consumer only when its slice changes` (đếm render bằng bộ đếm trong component test).

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add the editor store with one dispatch path`

## Task 19: Id handle, `toTableNodes`, `toRelationEdges` và `ViewportControls`

**Mục tiêu:** hàm thuần suy ra node và edge của React Flow từ tài liệu, dùng lại object khi không có gì đổi, cùng quy ước id handle và một interface điều khiển viewport mock được trong test.

**Loại:** B. **Phụ thuộc:** core 26, 17. **Đợt:** 9.

**File sở hữu:** tạo trong `frontend/src/features/editor/lib/`: `handle-ids.ts`, `handle-ids.test.ts`, `to-table-nodes.ts`, `to-table-nodes.test.ts`, `to-relation-edges.ts`, `to-relation-edges.test.ts`, `viewport-controls.tsx`, `viewport-controls.test.tsx`.

**Cài đặt** (spec mục 3 "Node bảng", "Edge quan hệ", mục 5 "Suy ra node và edge với tham chiếu ổn định", mục 10, mục 12 "Focus không bị che"):

- `handle-ids.ts`:

  ```ts
  export type HandleSide = "left" | "right";
  export type ParsedHandle =
    | { readonly kind: "column"; readonly columnId: string; readonly side: HandleSide }
    | { readonly kind: "table"; readonly tableId: string; readonly side: HandleSide };

  export function formatColumnHandleId(columnId: ColumnId, side: HandleSide): string;
  export function formatTableHandleId(tableId: TableId, side: HandleSide): string;
  export function parseHandleId(handleId: string | null | undefined): ParsedHandle | null;
  export function chooseHandleSides(
    fromPosition: Position,
    toPosition: Position,
  ): { readonly source: HandleSide; readonly target: HandleSide };
  ```

  - Định dạng đúng spec: `column:<columnId>:left`, `table:<tableId>:right`. Tách bằng `split(":")` và chỉ chấp nhận đúng ba phần với phần đầu là `column` hoặc `table` và phần cuối là `left` hoặc `right`; id trong kết quả là `string`. Nơi gọi **không** viết `document.columns[columnId]` với `columnId: string` (map của core khóa theo `` `col_${string}` ``, báo `TS7053`); tra bằng helper generic cục bộ cùng hình dạng với `lookup` trong `resolve-issue-target.ts`, `function lookup<Value>(elements: Readonly<Record<string, Value>>, elementId: string | null): Value | undefined`, rồi dùng `column.id` để có lại nhãn kiểu của core. Không ép kiểu, không khai báo lại type (Vấn đề 27).
  - `chooseHandleSides`: `fromPosition.x <= toPosition.x` cho `{ source: "right", target: "left" }`, ngược lại `{ source: "left", target: "right" }`. Quan hệ tự tham chiếu (hai vị trí bằng nhau) rơi vào nhánh đầu, nên cả hai đầu dùng cạnh phải: nơi gọi truyền cùng một `Position` và ép `target: "right"` bằng nhánh riêng `isSelfReference`.
- `to-table-nodes.ts`:

  ```ts
  export const TABLE_NODE_TYPE = "table";
  export type TableNodeData = { readonly tableId: TableId };
  export type TableNode = Node<TableNodeData, typeof TABLE_NODE_TYPE>;

  export function toTableNodes(input: {
    readonly tables: SchemaDocument["tables"];
    readonly selection: Selection;
    readonly dragPositions: Readonly<Partial<Record<TableId, Position>>>;
    readonly previousNodes: readonly TableNode[];
  }): readonly TableNode[];
  ```

  - Node sắp theo id bảng tăng dần (so sánh `<`, `>` như core), để thứ tự không phụ thuộc thứ tự khóa của map.
  - `position` là `dragPositions[tableId] ?? table.position`; `selected` là `selection.tableIds.includes(tableId)`.
  - Dựng `Map` từ `previousNodes` theo id; node cũ có cùng `position.x`, `position.y`, `selected` thì **trả lại đúng object cũ** (`toBe`).
  - Mảng kết quả cũng được dùng lại: nếu mọi node đều là object cũ và số lượng không đổi thì trả lại `previousNodes`.
  - `data` chỉ chứa `tableId`; component tự đọc lát cắt.
- `to-relation-edges.ts`:

  ```ts
  export const RELATION_EDGE_TYPE = "relation";
  export type RelationEdgeData = {
    readonly relationId: RelationId;
    readonly kind: RelationKind;
    readonly columnPairCount: number;
    readonly hasIssue: boolean;
  };
  export type RelationEdge = Edge<RelationEdgeData, typeof RELATION_EDGE_TYPE>;

  export function toRelationEdges(input: {
    readonly relations: SchemaDocument["relations"];
    readonly tables: SchemaDocument["tables"];
    readonly selection: Selection;
    readonly issueIndex: IssueIndex;
    readonly previousEdges: readonly RelationEdge[];
  }): readonly RelationEdge[];
  ```

  - Một edge cho mỗi quan hệ, id là `relation.id`, sắp theo id tăng dần. `source` là `fromTableId`, `target` là `toTableId`.
  - `sourceHandle`, `targetHandle` dựng từ cặp cột **đầu tiên** và `chooseHandleSides(fromTable.position, toTable.position)`; quan hệ tự tham chiếu dùng `right` ở cả hai đầu.
  - `hasIssue` là `issueIndex.countOfElement(relation.id) > 0`.
  - Dùng lại edge cũ khi `kind`, `columnPairCount`, `hasIssue`, `selected`, hai handle và hai đầu đều không đổi. Vị trí bảng chỉ ảnh hưởng qua hai handle, nên kéo một bảng chỉ tạo lại edge của bảng đó.
  - Bảng ở một đầu không tồn tại (tài liệu lỗi) thì bỏ qua quan hệ đó, không throw.
- `viewport-controls.tsx` (`"use client"`):

  ```ts
  export type ViewportControls = {
    readonly zoomIn: () => void;
    readonly zoomOut: () => void;
    readonly fitView: () => void;
    readonly setCenter: (x: number, y: number, options: { readonly zoom: number; readonly duration: number }) => void;
    readonly getZoom: () => number;
  };
  export const MIN_ZOOM = 0.1;
  export const MAX_ZOOM = 2;
  export const FIT_VIEW_PADDING = 0.2;
  export const VIEWPORT_TRANSITION_MS = 200;

  export function ViewportControlsProvider(props: { readonly controls: ViewportControls; readonly children: ReactNode }): JSX.Element;
  export function useViewportControls(): ViewportControls;
  ```

  - `useViewportControls` ngoài provider throw `Error`. Canvas (Task 24) dựng `controls` từ `useReactFlow`; toolbar và panel trái chỉ dùng interface này, nên test mock được mà không cần `ReactFlowProvider`.
  - `useViewportControls` **không** gọi `useReactFlow`, nên file này không kéo React Flow vào bundle của các component chỉ dùng nút zoom.

**Test viết trước:**

- `handle-ids.test.ts`: `formats a %s handle id` (`it.each` bốn tổ hợp); `parses %s back into its parts` (`it.each`); `rejects %s` (`it.each`: `null`, chuỗi rỗng, `column:col_1`, `column:col_1:middle`, `other:col_1:left`); `puts the source on the right when the from table is to the left`; `puts the source on the left when the from table is to the right`.
- `to-table-nodes.test.ts`: `creates one node per table ordered by id`; `marks selected tables`; `prefers a drag position over the stored position`; `reuses the node object of an unchanged table` (`toBe`); `reuses the whole array when nothing changed` (`toBe`); `creates a new node when the table moved`; `creates a new node when the selection changed`; `drops the node of a removed table`.
- `to-relation-edges.test.ts`: `creates one edge per relation, even for a composite foreign key`; `uses the handles of the first column pair`; `connects the right edge to the left edge when the from table is to the left`; `uses the right side on both ends of a self relation`; `marks an edge whose relation has an issue`; `reuses the edge object of an unchanged relation` (`toBe`); `creates a new edge when one of its tables moved`; `skips a relation whose table is missing`.
- `viewport-controls.test.tsx`: `exposes the controls to consumers`; `throws when used outside the provider`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): derive react flow nodes and edges from the schema`

## Task 20: Hook `useAutosave`, `useSchemaLock`, `useEditorShortcuts`

**Mục tiêu:** ba hook nối store với thế giới bên ngoài: ghi tài liệu xuống IndexedDB ngay sau mỗi thay đổi với mỗi lúc một lần ghi, giữ khóa tab của schema, và biến `keydown` thành undo, redo, xóa lựa chọn.

**Loại:** B. **Phụ thuộc:** 7, 8, 11, 15, 18. **Đợt:** 10.

**File sở hữu:** tạo trong `frontend/src/features/editor/hooks/`: `use-autosave.ts`, `use-autosave.test.tsx`, `use-schema-lock.ts`, `use-schema-lock.test.tsx`, `use-editor-shortcuts.ts`, `use-editor-shortcuts.test.tsx`.

**Cài đặt** (spec mục 7 "Ghi: autosave", "Cùng một schema ở hai tab", "Lỗi lưu trữ", mục 6 "Phím tắt"):

- `use-autosave.ts`:

  ```ts
  export type AutosaveControls = { readonly retry: () => void };
  export function useAutosave(input: {
    readonly store: EditorStore;
    readonly repository: SchemaRepository;
  }): AutosaveControls;
  ```

  - Một effect `store.subscribe` so `state.document` với giá trị trước; đổi tham chiếu thì gọi `requestSave(document)`. Cleanup hủy đăng ký.
  - `requestSave` giữ trong `useRef`: `isSaving` và `pendingDocument`. Đang ghi thì chỉ ghi `pendingDocument` rồi thoát. Không thì đặt `saveStatus: { kind: "saving" }`, `await repository.saveDocument(schemaId, document)`; xong mà có `pendingDocument` khác thì ghi tiếp đúng một lần nữa với tài liệu mới nhất; hết thì `saveStatus: { kind: "saved" }`.
  - Lỗi: `saveStatus: { kind: "failed", errorCode: toStorageErrorCode(error) }`; `logger.error("editor.save-failed", { code, errorName: getStorageErrorName(error) })`; `notify({ tone: "error", titleKey: \`storage:${code}\`, action: { labelKey: "common:actions.retry", onSelect: retry } })`. Tài liệu trong bộ nhớ không bị đụng tới.
  - `retry` ghi lại tài liệu hiện tại của store; toolbar dùng cho nút "Thử lại".
  - Không có timer, không debounce; test không cần giả lập đồng hồ.
- `use-schema-lock.ts`:

  ```ts
  export type SchemaLockState =
    | { readonly kind: "acquiring" }
    | { readonly kind: "blocked" }
    | { readonly kind: "held"; readonly grantId: number };

  export function useSchemaLock(input: {
    readonly schemaId: string;
    readonly lockManager: SchemaLockManager;
  }): SchemaLockState;
  ```

  - Effect chạy lại khi `schemaId` hoặc `lockManager` đổi. Tạo `AbortController`; gọi `tryAcquire(schemaId)`.
  - Lấy được: state `{ kind: "held", grantId: 1 }`.
  - Không: state `blocked`, rồi `acquire(schemaId, controller.signal)`; khi được cấp thì `{ kind: "held", grantId: 2 }`. `grantId` tăng mỗi lần được cấp, để nơi gọi biết phải đọc lại tài liệu (Task 22 dùng `grantId` làm dependency).
  - Cleanup: `controller.abort()` và `lock.release()` nếu đang giữ. Lỗi `AbortError` khi unmount bị nuốt có chủ đích, kèm comment; lỗi khác đi qua `logger.warn("editor.lock-failed", { errorName })`.
- `use-editor-shortcuts.ts`:

  ```ts
  export function useEditorShortcuts(input: {
    readonly store: EditorStore;
    readonly canvasElement: Element | null;
    readonly isDialogOpen: boolean;
    readonly platformHint: string;
    readonly onDeleteSelection: () => void;
  }): void;
  ```

  - Effect gắn `keydown` trên `window` (`window.addEventListener("keydown", handler)`), gỡ khi unmount.
  - Handler: `const action = matchShortcut(event, getShortcutPlatform(platformHint))`; `null` thì thoát. Dựng `ShortcutContext = { shouldRequireCanvasFocus: action === "deleteSelection", isDialogOpen, canvasElement }` (tên trường đúng như Task 8 đã cài, Vấn đề 29). `shouldHandleShortcut` trả `false` thì thoát. Ngược lại `event.preventDefault()` rồi: `undo` gọi `store.getState().undo()`, `redo` gọi `redo()`, `deleteSelection` gọi `onDeleteSelection()`.
  - `platformHint` do nơi gọi truyền, thường là `navigator.platform` (Vấn đề 28).
  - Các giá trị thay đổi được (`isDialogOpen`, `canvasElement`, `onDeleteSelection`) giữ trong một `useRef` được cập nhật mỗi lần render, để listener chỉ gắn một lần mà vẫn đọc giá trị mới nhất.

**Test viết trước** (dùng `renderHook` của `@testing-library/react`; repository giả là object `vi.fn()`; `vi.mock("sonner")` khi cần):

- `use-autosave.test.tsx`: `saves the document after a dispatch`; `does not save when nothing changed`; `saves only once while a save is in flight`; `saves the newest document after the in-flight save finishes`; `sets the save status to saving and then saved`; `sets the save status to failed with the mapped storage code`; `shows a translated toast with a retry action when saving fails`; `saves again when retry is called`; `stops saving after unmount`.
- `use-schema-lock.test.tsx` (dùng `createFakeLockRegistry` và `createSchemaLockManager`): `reports held when the lock is free`; `reports blocked while another tab holds the lock`; `reports held with a new grant id after the other tab releases`; `releases the lock on unmount`; `removes the waiting request on unmount`.
- `use-editor-shortcuts.test.tsx`: `undoes on the undo shortcut`; `redoes on the redo shortcut`; `calls onDeleteSelection on Delete when the canvas has focus`; `ignores Delete while focus is in a text field`; `ignores shortcuts while a dialog is open`; `prevents the default browser action for a handled shortcut`; `leaves an unrelated key alone`; `removes the listener on unmount`.

**Kiểm tra:** như "Quy ước chung".

**Commit:** `feat(frontend): add autosave, schema lock and shortcut hooks`

## Task 21: Màn hình danh sách schema và route `/`

**Mục tiêu:** màn hình đầu tiên của ứng dụng: tạo, mở, đổi tên, xóa schema trên IndexedDB, có đủ các trạng thái đang đọc, rỗng, bản ghi hỏng và lưu trữ không dùng được.

**Loại:** B. **Phụ thuộc:** 12, 13, 15. **Đợt:** 10.

**File sở hữu:**

- Sửa `frontend/src/app/page.tsx`, `frontend/src/app/page.test.tsx`.
- Tạo trong `frontend/src/features/schema-list/components/`: `schema-list-screen.tsx`, `schema-list-screen.test.tsx`, `schema-list-row.tsx`, `create-schema-dialog.tsx`, `create-schema-dialog.test.tsx`, `rename-schema-dialog.tsx`, `delete-schema-dialog.tsx`.
- Tạo trong `frontend/src/features/schema-list/hooks/`: `use-schema-list.ts`, `use-schema-list.test.tsx`, `use-schema-actions.ts`, `use-schema-actions.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/schema-list.ts`, `locales/vi/schema-list.ts`.

**Cài đặt** (spec mục 1 "Màn hình danh sách", mục 7 "Đổi tên và xóa từ màn hình danh sách", "Cùng một schema ở hai tab"):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/schema-list.ts` hiện là `export const viSchemaList = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enSchemaList>` và xóa comment placeholder; mệnh đề chỉ hợp lệ khi object đã có ít nhất một key.
- `app/page.tsx` (Server Component mỏng, giữ default export): `export async function generateMetadata(): Promise<Metadata>` dùng `await getRequestLocale()` và `const t = getServerTranslation(locale, "schemaList")` (đồng bộ, không `await`) cho `title: t("pageTitle")`; thân hàm chỉ render `<SchemaListScreen />`.
- **Nạp `zod-config` ở entry client của route.** Chưa chứng minh được `@/lib/zod-config` (import đầu tiên của `components/app-providers.tsx`) luôn được nạp trước các module client của route có import `@schemaforge/core` (Vấn đề 43). Vì vậy dòng import đầu tiên của `schema-list-screen.tsx`, ngay sau `"use client"`, là `import "@/lib/zod-config";`, kèm comment như ở `app-providers.tsx` (Task 13); `import-x/order` đòi sắp lại thì dùng đúng comment tắt rule mà Task 13 đã cho phép. Import lặp không có hại vì module chỉ chạy một lần.
- `use-schema-list.ts`: `useSchemaList(repository: SchemaRepository): readonly SchemaListEntry[] | undefined` dùng `useLiveQuery` của `dexie-react-hooks` gọi `repository.listSchemas()`. `undefined` nghĩa là đang đọc.
- `use-schema-actions.ts`:

  ```ts
  export type SchemaActions = {
    readonly createSchema: (name: string) => Promise<void>;
    readonly renameSchema: (schemaId: string, name: string) => Promise<void>;
    readonly deleteSchema: (schemaId: string) => Promise<void>;
  };
  export function useSchemaActions(storage: StorageBundle): SchemaActions;
  ```

  - `createSchema` gọi `repository.createSchema(name)` rồi `router.push(\`/schemas/${record.id}\`)` (`useRouter` của `next/navigation`).
  - `renameSchema` và `deleteSchema` gọi `lockManager.tryAcquire(schemaId)` trước; `null` thì `notify({ tone: "error", titleKey: "schemaList:openInAnotherTab" })` và không làm gì; ngược lại làm việc rồi `lock.release()` trong `finally`.
  - `renameSchema` gặp `{ kind: "unreadable" }` thì `notify({ tone: "error", titleKey: "schemaList:unreadableCannotRename" })`.
  - Mọi lỗi ném ra từ repository được bắt tại đây: `notify({ tone: "error", titleKey: \`storage:${toStorageErrorCode(error)}\` })` và `logger.error("schema-list.action-failed", { errorName: getStorageErrorName(error) })`.
- `schema-list-screen.tsx` (`"use client"`):
  - `<header>` có `APP_NAME`, `<ThemeSwitch />`, `<LanguageSwitch />`; `<main>` có `<h1>{t("title")}</h1>` và nút "Tạo schema".
  - `useStorage()`: `pending` → danh sách `Skeleton` không có chữ; `unavailable` → đoạn `storage:<errorCode>` và **không** render nút tạo.
  - `ready` → `useSchemaList`; `undefined` → skeleton; mảng rỗng → `t("empty.title")` và nút `t("empty.createFirst")`; ngược lại `<ul>` các `SchemaListRow`.
  - Hộp thoại tạo, đổi tên, xóa được điều khiển bằng state của màn hình, mỗi hộp thoại một component riêng.
- `schema-list-row.tsx`: `<li>` gồm `<Link href={\`/schemas/${schema.id}\`}>` hiện tên, thời điểm `updatedAt` định dạng bằng `new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" })`, và `DropdownMenu` (nút icon `size="icon"`, `aria-label={t("row.actions", { name })}`) với ba mục Mở, Đổi tên, Xóa. Dòng `unreadable` hiện `t("row.unreadable")`, không có link, chỉ có mục Xóa.
- `create-schema-dialog.tsx`, `rename-schema-dialog.tsx`: `Dialog` + `<form>`; ô tên bắt buộc, chặn xác nhận khi `name.trim()` rỗng và hiện `t("nameRequired")` qua `aria-describedby` cùng `aria-invalid`. Nút đóng nhận `closeLabel={t("common:actions.close")}`.
- `delete-schema-dialog.tsx`: `AlertDialog` với cảnh báo không hoàn tác được, nút hủy và nút xóa.
- Key `schemaList` cần có: `pageTitle`, `title`, `create.trigger`, `create.dialogTitle`, `create.nameLabel`, `create.submit`, `rename.*`, `delete.title`, `delete.description`, `delete.confirm`, `empty.title`, `empty.createFirst`, `row.actions`, `row.open`, `row.rename`, `row.delete`, `row.unreadable`, `row.updatedAt`, `nameRequired`, `openInAnotherTab`, `unreadableCannotRename`, `loading`.

**Test viết trước** (dùng `renderWithProviders`, bọc thêm `<StorageProvider storage={fakeStorage}>` với repository thật trên `fake-indexeddb` và `createFakeLockRegistry`; `vi.mock("next/navigation")`):

- `page.test.tsx`: `renders the schema list screen`; `translates the page title in %s` (`it.each` hai locale).
- `schema-list-screen.test.tsx`:
  - `shows a skeleton while storage is pending`.
  - `shows the empty state when there is no schema`.
  - `lists schemas from the most recently updated`.
  - `formats the update time with the active locale`.
  - `creates a schema and navigates to its editor`.
  - `refuses to create a schema with a blank name`.
  - `renames a schema from the row menu`.
  - `asks for confirmation before deleting a schema`.
  - `shows a toast when the schema is open in another tab`.
  - `offers only delete for a row that cannot be read`.
  - `shows a translated storage message when indexeddb is unavailable`.
  - `hides the create button when storage is unavailable`.
  - `reports no axe violations in the %s theme` (`it.each` `light`, `dark`).
- `create-schema-dialog.test.tsx`: `focuses the name field when it opens`; `submits on Enter`; `closes on Escape and returns focus to the trigger`.
- `use-schema-list.test.tsx`: `returns undefined while the query is loading`; `updates when a schema is added`.
- `use-schema-actions.test.tsx`: `does not rename while another tab holds the lock`; `releases the lock after renaming`; `maps a storage error to a translated toast`.

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/schema-list.ts` → `pnpm --filter @schemaforge/frontend typecheck` phải fail; hoàn tác và xác nhận `git diff` sạch.

**Commit:** `feat(frontend): add the schema list screen`

## Task 22: Route editor, `EditorScreenLoader`, `EditorScreen`, `EditorWorkspace`

**Mục tiêu:** route `/schemas/[schemaId]` mở đúng schema: kiểm tra id, lấy khóa tab, đọc và parse tài liệu, dựng store, bật autosave, và hiện đúng thông báo cho từng trạng thái không mở được.

**Loại:** B. **Phụ thuộc:** 12, 13, 15, 18, 20, 23, 24. **Đợt:** 11.

**File sở hữu:**

- Tạo `frontend/src/app/schemas/[schemaId]/page.tsx`, `loading.tsx`, `error.tsx`, `page.test.tsx`.
- Tạo trong `frontend/src/features/editor/components/`: `editor-screen-loader.tsx`, `editor-screen.tsx`, `editor-screen.test.tsx`, `editor-status-screen.tsx`, `editor-status-screen.test.tsx`, `editor-workspace.tsx`.
- Tạo `frontend/src/features/editor/hooks/use-open-schema.ts`, `use-open-schema.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/editor/screen.ts`, `locales/vi/editor/screen.ts`.

**Cài đặt** (spec mục 1 "Màn hình editor", "Rendering", mục 7 "Cùng một schema ở hai tab", "Viewport", mục 5 "Store theo từng schema"):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/editor/screen.ts` hiện là `export const viEditorScreen = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enEditorScreen>` và xóa comment placeholder.
- `app/schemas/[schemaId]/page.tsx` (Server Component, default export):

  ```ts
  type EditorPageProps = { readonly params: Promise<{ readonly schemaId: string }> };
  export async function generateMetadata({ params }: EditorPageProps): Promise<Metadata>;
  export default async function EditorPage({ params }: EditorPageProps): Promise<JSX.Element>;
  ```

  `await params`; `isSchemaId(schemaId)` sai thì render `<EditorStatusScreen variant="not-found" />`, đúng thì render `<EditorScreenLoader schemaId={schemaId} />`. `generateMetadata` trả `t("editor:screen.pageTitle")` (không chứa tên schema, vì server không đọc IndexedDB).
- `loading.tsx` (default export, Server Component): khung `Skeleton` của toolbar và canvas, không có chữ.
- `error.tsx` (`"use client"`, default export): props `{ readonly error: Error; readonly reset: () => void }`; hiện `t("editor:screen.crashTitle")`, `crashDescription` và nút `common:actions.reload` gọi `reset()`. Không hiển thị `error.message`; `logger.error("editor.crashed", { errorName: error.name })`.
- `editor-screen-loader.tsx` (`"use client"`): `const EditorScreen = dynamic(() => import("./editor-screen").then((module) => module.EditorScreen), { ssr: false, loading: () => <EditorSkeleton /> })`. Loader phải là client component vì Next.js 16 không cho `ssr: false` trong Server Component. `EditorSkeleton` là component không export trong cùng file.
  - **Nạp `zod-config` ở entry client của route** (Vấn đề 43): dòng import đầu tiên của `editor-screen-loader.tsx`, ngay sau `"use client"`, là `import "@/lib/zod-config";`, kèm comment như ở `app-providers.tsx` (Task 13). Chunk `editor-screen` được nạp động từ loader nên chạy sau import này. `editor-status-screen.tsx` cũng được `page.tsx` render trực tiếp: nếu file đó (hoặc module nó import) có import `@schemaforge/core` thì thêm cùng dòng import ở đầu file đó.
- `editor-status-screen.tsx` (`"use client"`): một component cho mọi trạng thái không mở được.

  ```ts
  export type EditorStatusVariant = "not-found" | "locked" | "unsupported-version" | "unreadable" | "storage-unavailable";
  export type EditorStatusScreenProps = {
    readonly variant: EditorStatusVariant;
    readonly storageErrorCode?: StorageErrorCode;
  };
  ```

  Render `<main>` có tiêu đề, mô tả và `<Link href="/">` về danh sách. Key lấy theo `variant` từ một object hằng ánh xạ `variant` sang cặp key (không ghép chuỗi key động, để `ParseKeys` còn kiểm tra được). `storage-unavailable` lấy mô tả từ `storage:<storageErrorCode>`.
- `use-open-schema.ts`:

  ```ts
  export type OpenSchemaState =
    | { readonly kind: "opening" }
    | { readonly kind: "not-found" }
    | { readonly kind: "unreadable"; readonly isVersionUnsupported: boolean }
    | { readonly kind: "storage-error"; readonly errorCode: StorageErrorCode }
    | { readonly kind: "opened"; readonly document: SchemaDocument; readonly viewport: ViewportRecord | null };

  export function useOpenSchema(input: {
    readonly repository: SchemaRepository;
    readonly schemaId: string;
    readonly grantId: number | null;
  }): OpenSchemaState;
  ```

  - `grantId` là `null` khi chưa giữ khóa: state ở `opening`.
  - Effect chạy lại mỗi khi `grantId` đổi (tab này vừa được cấp khóa sau khi chờ), gọi `Promise.all([repository.openSchema(schemaId), repository.readViewport(schemaId)])`, bỏ kết quả nếu effect đã bị hủy (cờ `isActive` trong cleanup).
  - `unreadable` đặt `isVersionUnsupported` là `true` khi có lỗi mang mã `version-unsupported`.
  - Ngoại lệ được bắt và đổi thành `storage-error` bằng `toStorageErrorCode`.
- `editor-screen.tsx` (`"use client"`), props `{ readonly schemaId: string }`:
  - `useStorage()`: `pending` → `<EditorSkeleton />`; `unavailable` → `<EditorStatusScreen variant="storage-unavailable" storageErrorCode={...} />`.
  - `useSchemaLock({ schemaId, lockManager })`: `acquiring` → skeleton; `blocked` → `<EditorStatusScreen variant="locked" />`.
  - `useOpenSchema({ repository, schemaId, grantId })` theo bảng trạng thái của spec mục 1; `opened` → `<EditorWorkspace ... />` với `key={schemaId}`, để mở schema khác là mount lại và có store mới.
- `editor-workspace.tsx` (`"use client"`), props `{ readonly schemaId: string; readonly document: SchemaDocument; readonly viewport: ViewportRecord | null; readonly repository: SchemaRepository }`:
  - `const [store] = useState(() => createEditorStore({ schemaId, document, generateId: () => crypto.randomUUID(), notify, logger }))`, với `notify` lấy từ `useNotify()`.
  - `const autosave = useAutosave({ store, repository })`.
  - Render `<EditorStoreProvider store={store}>` bọc một `<div>` xếp dọc: `<Toolbar onRetrySave={autosave.retry} />` rồi `<EditorCanvas defaultViewport={...} onMoveEnd={...} onAddTable={...} />`.
  - `onMoveEnd` gọi `repository.saveViewport({ schemaId, x, y, zoom })` và nuốt lỗi bằng `logger.warn("editor.viewport-save-failed", { errorName })`: mất viewport không đáng làm hỏng phiên làm việc.
  - `onAddTable` dựng operation bằng `useSchemaCommands()` của Task 23.
  - File này được Task 29 mở rộng thành bố cục đầy đủ (panel trái, panel phải, landmark, phím tắt). Ở task này nó chỉ có toolbar và canvas.
- Key `editor.screen` cần có: `pageTitle`, `notFound.title`, `notFound.description`, `locked.title`, `locked.description`, `unsupportedVersion.title`, `unsupportedVersion.description`, `unreadable.title`, `unreadable.description`, `storageUnavailable.title`, `crashTitle`, `crashDescription`, `backToList`, `loading`.

**Test viết trước:**

- `page.test.tsx`: `renders the not found state for an id that is not a uuid`; `renders the editor loader for a valid id`.
- `editor-status-screen.test.tsx`: `shows the %s message` (`it.each` năm variant); `links back to the schema list`; `shows the translated storage message for an unavailable storage`; `reports no axe violations`.
- `editor-screen.test.tsx` (repository thật trên `fake-indexeddb`, `createFakeLockRegistry`):
  - `shows a skeleton while the lock is being acquired`.
  - `shows the not found state for a schema that was never stored`.
  - `shows the locked state while another tab holds the lock`.
  - `opens the editor after the other tab releases the lock`.
  - `shows the unsupported version message for a newer document`.
  - `shows the unreadable message for a corrupt document`.
  - `never overwrites a document it could not read` (bản ghi trong database không đổi sau khi màn hình mount).
  - `shows the storage message when storage is unavailable`.
  - `renders the toolbar and the canvas once the schema is open`.
  - `reports no axe violations in the %s theme` (`it.each` `light`, `dark`).
- `use-open-schema.test.tsx`: `stays in opening while no lock has been granted`; `reads the document and the viewport together`; `re-reads the document when a new grant arrives`; `ignores a result that arrives after unmount`; `maps a thrown dexie error to a storage error`.

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/editor/screen.ts` → `typecheck` phải fail; hoàn tác. `pnpm --filter @schemaforge/frontend build` in cả route `/schemas/[schemaId]`.

**Commit:** `feat(frontend): add the editor route and open states`

## Task 23: Toolbar, lệnh thêm bảng, thêm enum và ô nhập commit

**Mục tiêu:** thanh công cụ trên cùng của editor với đủ nhóm nút đã dịch, hai lệnh dựng schema dùng chung, và hai ô nhập commit theo đúng quy tắc blur, Enter, Escape và IME mà mọi panel sẽ dùng lại.

**Loại:** B. **Phụ thuộc:** 12, 16, 17, 18, 19. **Đợt:** 10.

**File sở hữu:**

- Tạo trong `frontend/src/features/editor/components/`: `committed-text-field.tsx`, `committed-text-field.test.tsx`, `committed-text-area.tsx`, `committed-text-area.test.tsx`.
- Tạo trong `frontend/src/features/editor/components/toolbar/`: `editor-toolbar.tsx`, `editor-toolbar.test.tsx`, `schema-name-button.tsx`, `save-status-badge.tsx`, `issue-count-button.tsx`.
- Tạo `frontend/src/features/editor/hooks/use-schema-commands.ts`, `use-schema-commands.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/editor/toolbar.ts`, `locales/vi/editor/toolbar.ts`.

**Cài đặt** (spec mục 2 "Toolbar", mục 6 "Gộp thao tác", mục 10, mục 12 "Kích thước mục tiêu bấm"):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/editor/toolbar.ts` hiện là `export const viEditorToolbar = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enEditorToolbar>` và xóa comment placeholder.
- `committed-text-field.tsx` (`"use client"`):

  ```ts
  export type CommittedTextFieldProps = {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly onCommit: (value: string) => void;
    readonly errorMessage?: string;
    readonly inputMode?: "text" | "numeric";
    readonly isLabelHidden?: boolean;
    readonly inputRef?: RefObject<HTMLInputElement | null>;
  };
  ```

  - State `draft` khởi tạo từ `value`; một effect đồng bộ `draft` khi prop `value` đổi.
  - Commit khi `blur` và khi `keydown` `Enter` với `event.nativeEvent.isComposing === false`. `Escape` đặt `draft` về `value` và **không** commit.
  - Commit gọi `onCommit(draft)` chỉ khi `draft !== value`, rồi đặt `draft` về `value` hiện tại; nơi gọi không dispatch (giá trị không hợp lệ) thì ô quay lại giá trị cũ, nơi gọi dispatch thì effect đồng bộ đưa giá trị mới vào.
  - `errorMessage` khác `undefined` thì `aria-invalid="true"` và `aria-describedby` trỏ tới phần tử chứa thông báo.
  - `isLabelHidden` chỉ đổi cách hiện `Label` (`sr-only`), không bao giờ bỏ label.
- `committed-text-area.tsx`: như trên nhưng dùng `Textarea`, chỉ commit khi `blur` (Enter xuống dòng), không có `inputMode`.
- `use-schema-commands.ts`:

  ```ts
  export type SchemaCommands = {
    readonly addTable: () => void;
    readonly addEnum: () => void;
  };
  export function useSchemaCommands(): SchemaCommands;
  ```

  - `addTable`: lấy tâm khung nhìn hiện tại từ `useViewportControls()` (dùng `getZoom` và `setCenter` không đủ, nên interface được dùng ở đây chỉ để `setCenter` sau khi thêm); vị trí ban đầu là `{ x: 0, y: 0 }` cộng offset của `findFreeTablePosition`. Gọi `buildAddTableOperation(document, { position, generateId: () => crypto.randomUUID() })`, `dispatch(result.operation)`, `setSelection({ tableIds: [result.tableId], relationIds: [] })`, `requestFocus(["tables", result.tableId, "name"])`, và `setCenter` tới vị trí bảng mới với `zoom: getZoom()`, `duration: VIEWPORT_TRANSITION_MS`.
  - `addEnum`: `buildAddEnumOperation`, `dispatch`, `setLeftPanelTab("enums")`, `requestFocus(["enums", enumId, "name"])`.
  - Hàm được bọc `useCallback`, và object trả về bọc `useMemo`, để truyền xuống canvas không làm canvas render lại.
- `editor-toolbar.tsx` (`"use client"`), props `{ readonly onRetrySave: () => void }`, thứ tự đúng spec:
  1. `<Link href="/">` có `aria-label={t("backToList")}` và `Tooltip`.
  2. `<SchemaNameButton />`: nút hiện `document.name`, mở `Dialog` đổi tên dùng `CommittedTextField`; xác nhận dispatch `{ type: "renameSchema", name }`. Tên schema có issue thì nút mang `aria-invalid="true"` và thông báo nằm trong tooltip đã dịch.
  3. Nút "Thêm bảng", "Thêm enum" gọi `useSchemaCommands()`.
  4. Nút undo, redo: `disabled` khi `history.past.length === 0` hoặc `history.future.length === 0`.
  5. Nút zoom out, zoom in, fit view gọi `useViewportControls()`.
  6. `<IssueCountButton />`: `getIssueIndex(document).issues.length`; bằng 0 thì icon đạt, không có số; khác 0 thì icon cảnh báo kèm số và `aria-label={t("issues.count", { count })}`; bấm thì `setLeftPanelTab("issues")`.
  7. `<SaveStatusBadge />`: `common:saveStatus.saving`, `saved`, `failed`; `failed` kèm nút `common:actions.retry` gọi `onRetrySave`.
  8. `<ThemeSwitch />`, `<LanguageSwitch />`.
  - Các nhóm ngăn bằng `Separator` (`orientation="vertical"`, `aria-hidden`). Toolbar là các nút thường trong thứ tự tab, **không** dùng `role="toolbar"`.
  - Nút chỉ có icon dùng `size="icon"` (32 px, Vấn đề 33), có `aria-label` đã dịch và `Tooltip` cùng nội dung.
- Key `editor.toolbar` cần có: `backToList`, `schemaName.label`, `schemaName.dialogTitle`, `schemaName.submit`, `addTable`, `addEnum`, `undo`, `redo`, `zoomIn`, `zoomOut`, `fitView`, `issues.count`, `issues.none`.

**Test viết trước** (dùng `renderWithProviders`, bọc `EditorStoreProvider` với store thật và `ViewportControlsProvider` với controls giả `vi.fn()`):

- `committed-text-field.test.tsx`: `commits the new value on blur`; `commits on Enter`; `does not commit while the IME is composing`; `restores the current value on Escape`; `does not commit when the value did not change`; `shows the current value again when the caller rejects the commit`; `marks the field invalid and links the error message`.
- `committed-text-area.test.tsx`: `commits on blur`; `keeps Enter as a line break`; `does not commit an unchanged value`.
- `use-schema-commands.test.tsx`: `dispatches one batch when adding a table`; `selects the new table and focuses its name`; `centers the viewport on the new table`; `dispatches one operation when adding an enum`; `opens the enums tab after adding an enum`; `returns a stable commands object across rerenders`.
- `editor-toolbar.test.tsx`:
  - `names every icon button in %s` (`it.each` hai locale).
  - `disables undo when there is nothing to undo`; `enables redo after an undo`.
  - `renames the schema from the toolbar dialog`.
  - `shows the issue count and opens the issues tab`.
  - `shows the check icon when there is no issue`.
  - `calls zoomIn, zoomOut and fitView on the viewport controls`.
  - `shows the retry button while saving failed`.
  - `reports no axe violations in the %s theme` (`it.each` `light`, `dark`).

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/editor/toolbar.ts` → `typecheck` phải fail; hoàn tác.

**Commit:** `feat(frontend): add the editor toolbar and committed inputs`

## Task 24: Canvas: `TableNode`, `ColumnRow`, `RelationEdge`, marker, `ariaLabelConfig`, `useRevealFocusedElement`

**Mục tiêu:** canvas React Flow hiển thị bảng và quan hệ với đủ dấu hiệu, nhãn đã dịch và màu lấy từ token; mọi đường xóa của React Flow bị chặn; phần tử nhận focus bàn phím không bị minimap hay toast che.

**Loại:** B. **Phụ thuộc:** 12, 17, 18, 19. **Đợt:** 10.

**File sở hữu:**

- Tạo trong `frontend/src/features/editor/components/canvas/`: `editor-canvas.tsx`, `editor-canvas.test.tsx`, `table-node.tsx`, `table-node.test.tsx`, `column-row.tsx`, `relation-edge.tsx`, `relation-edge.test.tsx`, `relation-markers.tsx`, `canvas-empty-state.tsx`.
- Tạo `frontend/src/features/editor/lib/aria-label-config.ts`, `aria-label-config.test.ts`, `format-column-type.ts`, `format-column-type.test.ts`, `is-focus-target-obscured.ts`, `is-focus-target-obscured.test.ts`, `foreign-key-columns.ts`, `foreign-key-columns.test.ts`.
- Tạo `frontend/src/features/editor/hooks/use-reveal-focused-element.ts`, `use-reveal-focused-element.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/canvas.ts`, `locales/vi/canvas.ts`.

**Cài đặt** (spec mục 3 "Node bảng", "Edge quan hệ", "Chọn, di chuyển, xóa", mục 8 "Token", mục 10, mục 12 "React Flow", "Focus không bị che", "Kích thước mục tiêu bấm", mục 13):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/canvas.ts` hiện là `export const viCanvas = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enCanvas>` và xóa comment placeholder.
- `format-column-type.ts`: `formatColumnType(type: ColumnType, enums: SchemaDocument["enums"]): string` — `varchar(255)`, `decimal(10,2)`, `char(n)`, tên enum cho `kind: "enum"` (enum đã bị xóa thì trả key kỹ thuật `"?"`), `name` cho `kind: "custom"`, còn lại là `kind`. `switch` vét cạn kết thúc bằng kiểm tra `never`. Hàm không dịch: đây là tên kiểu dữ liệu, không phải chuỗi giao diện.
- `foreign-key-columns.ts`: `getForeignKeyColumnIds(relations: SchemaDocument["relations"]): ReadonlySet<string>` — tập mọi `fromColumnId`, memo theo tham chiếu `relations` bằng một `WeakMap` (cùng ngoại lệ đã ghi ở Vấn đề 25, comment tương tự).
- `aria-label-config.ts`: `buildAriaLabelConfig(t: TFunction<"canvas">): AriaLabelConfig` dựng đủ các key spec mục 12 nêu: `node.a11yDescription.default`, `node.a11yDescription.keyboardDisabled`, `node.a11yDescription.ariaLiveMessage` (hàm nhận `{ direction, x, y }`), `edge.a11yDescription.default`, `minimap.ariaLabel`, `handle.ariaLabel`. Tên type lấy từ `@xyflow/react`; nếu tên khác `AriaLabelConfig` thì dùng đúng tên trong `node_modules/@xyflow/react/dist/esm/types` và ghi vào báo cáo.
- `table-node.tsx`: `export const TableNode = memo(function TableNode({ data }: NodeProps<TableNode>): JSX.Element { … })`.
  - Đọc `useEditorStore((state) => state.document.tables[data.tableId])`; bảng không còn thì render `null`.
  - Tiêu đề: tên bảng (cắt bằng CSS `truncate`, tooltip hiện đầy đủ), icon comment khi `comment !== ""` với tooltip là comment dạng text, huy hiệu issue khi `countOfTable > 0` với `aria-label={t("node.issueCount", { count })}`.
  - `aria-label` của node: `t("node.label", { name, columnCount })`.
  - Handle: mỗi cạnh của tiêu đề một `<Handle type="source" position={Position.Left|Right} id={formatTableHandleId(...)} />`; `connectionMode="loose"` nên `type` không giới hạn chiều.
  - Render `<ColumnRow columnId={...} tableId={...} />` theo đúng `table.columnIds`, `key` là `columnId`.
- `column-row.tsx`: `export const ColumnRow = memo(function ColumnRow({ columnId, tableId }: ColumnRowProps): JSX.Element { … })`.
  - Đọc `useEditorStore((state) => state.document.columns[columnId])`; các selector còn lại trả primitive: số issue của cột, `isPrimaryKey` (và số thứ tự khóa chính khi khóa chính nhiều cột), `isForeignKey` từ `getForeignKeyColumnIds`.
  - Dấu theo bảng của spec: icon khóa kèm số thứ tự, icon mắt xích, chữ `U`, hậu tố `?`, chữ `AI`. Mỗi dấu luôn đi kèm `<span className="sr-only">` đã dịch, không chỉ dựa vào màu.
  - Hai `<Handle>` trái, phải với `formatColumnHandleId`.
- `relation-markers.tsx`: `export function RelationMarkers(): JSX.Element` — một `<svg>` ẩn (`aria-hidden`, kích thước 0) chứa `<defs>` với marker chân gà và vạch đơn, `fill` và `stroke` lấy `var(--canvas-relation)` và `var(--canvas-relation-selected)`. Được render một lần trong `editor-canvas.tsx`.
- `relation-edge.tsx`: `export const RelationEdge = memo(function RelationEdge(props: EdgeProps<RelationEdge>): JSX.Element { … })` — `getBezierPath`, `<BaseEdge interactionWidth={24} markerStart markerEnd />`, `<EdgeLabelRenderer>` hiện nhãn `t("edge.oneToMany")` hoặc `t("edge.oneToOne")` và `t("edge.columnCount", { count })` khi `columnPairCount > 1`. Edge có issue dùng class nét đứt và màu `destructive`. `ariaLabel` là `t("edge.label", { fromTable, fromColumn, toTable, toColumn, kind })`.
- `editor-canvas.tsx` (`"use client"`), props `{ readonly defaultViewport: Viewport | null; readonly onMoveEnd: (viewport: Viewport) => void; readonly onAddTable: () => void; readonly onConnect: (connection: Connection) => void }`:
  - Bọc `<ReactFlowProvider>`; component con dựng `ViewportControls` từ `useReactFlow()` và bọc `ViewportControlsProvider`.
  - `nodeTypes`, `edgeTypes` khai báo ở cấp module (hằng, không phải state).
  - Node và edge suy ra bằng `toTableNodes`, `toRelationEdges` với `previousNodes`, `previousEdges` giữ trong `useRef`. Hai ref này **chỉ** chứa kết quả lần gọi trước của chính `toTableNodes`, `toRelationEdges` (gán lại ref ngay sau mỗi lần gọi), **không bao giờ** là state node, edge nội bộ của React Flow (`useNodes`, `useEdges`, `getNodes()`, tham số của `onNodesChange`): object của React Flow mang thêm trường như `dragging`, `measured`, nên dùng lại nó sẽ đưa các trường đó vào node được tái sử dụng (Vấn đề 44).
  - `toRelationEdges` nhận `tables` là `document.tables` đã lưu, **không** nhận `dragPositions` (quyết định của user, spec mục 5 "Suy ra node và edge với tham chiếu ổn định"): cạnh trái, phải của handle chỉ đổi khi thả bảng; trong lúc kéo, đường edge vẫn bám theo node vì React Flow tính đường từ tọa độ handle. Không đổi chữ ký của Task 19.
  - Props bắt buộc: `connectionMode="loose"`, `deleteKeyCode={null}`, `onBeforeDelete={() => Promise.resolve(false)}`, `nodesFocusable`, `edgesFocusable`, `autoPanOnNodeFocus={false}`, `minZoom={MIN_ZOOM}`, `maxZoom={MAX_ZOOM}`, `colorMode` lấy từ `useThemePreference()`, `ariaLabelConfig` dựng từ `buildAriaLabelConfig`.
  - `onNodesChange` **bỏ qua** mọi change `type === "remove"`; change `position` có `dragging: true` ghi vào `setDragPositions`; `onNodeDragStop` dispatch **một** `moveElements` cho mọi bảng đang kéo rồi xóa `dragPositions`, và không dispatch khi vị trí không đổi. Change `position` với `dragging: false` (phím mũi tên) dispatch `moveElements` với `{ coalesce: "keyboardMove" }`.
  - `onSelectionChange` gọi `setSelection`; `onEdgesChange` cũng bỏ qua `remove`.
  - `defaultViewport` khác `null` thì truyền thẳng, ngược lại `fitView` với `fitViewOptions={{ padding: FIT_VIEW_PADDING }}`.
  - `<MiniMap pannable zoomable />`, `<Background variant={BackgroundVariant.Dots} />`.
  - `tables` rỗng thì render `<CanvasEmptyState onAddTable={onAddTable} />` nằm giữa canvas.
  - `useRevealFocusedElement` được gọi ở đây với ref của phần tử canvas.
- `is-focus-target-obscured.ts`:

  ```ts
  export function isFocusTargetObscured(input: {
    readonly target: DOMRect;
    readonly canvas: DOMRect;
    readonly overlays: readonly DOMRect[];
  }): boolean;
  ```

  Trả `true` khi phần giao của `target` với `canvas` rỗng, hoặc khi phần giao đó nằm **trọn** trong một overlay. Bị che một phần trả `false`.
- `use-reveal-focused-element.ts`: `useRevealFocusedElement(canvasElement: HTMLElement | null): void` — nghe `focusin` trên `canvasElement`; chỉ xử lý khi target khớp `.react-flow__node, .react-flow__edge` và `:focus-visible`; đo `getBoundingClientRect` của target, của canvas và của các overlay (`.react-flow__minimap`, `[data-sonner-toaster]`); bị che thì gọi `setCenter` của `useViewportControls()` tới tâm phần tử đổi sang tọa độ canvas, giữ `getZoom()`, `duration` là `VIEWPORT_TRANSITION_MS` hoặc `0` khi `matchMedia("(prefers-reduced-motion: reduce)").matches`.
- Key `canvas` cần có: `node.label`, `node.issueCount`, `node.comment`, `column.primaryKey`, `column.primaryKeyPosition`, `column.foreignKey`, `column.unique`, `column.nullable`, `column.autoIncrement`, `column.issue`, `edge.label`, `edge.oneToOne`, `edge.oneToMany`, `edge.columnCount`, `empty.title`, `empty.addTable`, `minimap.label`, `handle.label`, `a11y.nodeDescription`, `a11y.nodeKeyboardDisabled`, `a11y.nodeMoved`, `a11y.edgeDescription`.

**Test viết trước** (component test bọc `ReactFlowProvider`, `EditorStoreProvider` và `ViewportControlsProvider` giả):

- `format-column-type.test.ts`: `formats %s as %s` (`it.each` đủ 19 `kind`, gồm `decimal`, `varchar`, `char`, `enum`, `custom`); `falls back when the enum no longer exists`.
- `foreign-key-columns.test.ts`: `collects every from column of every relation`; `returns the same set for the same relations reference`.
- `aria-label-config.test.ts`: `translates every aria label key in %s` (`it.each` hai locale); `builds the live message from direction and position`.
- `is-focus-target-obscured.test.ts`: `treats an element outside the canvas as obscured`; `treats an element fully under the minimap as obscured`; `treats an element fully inside the toast area as obscured`; `treats a partly covered element as visible`; `treats a fully visible element as visible`.
- `table-node.test.tsx`: `shows the table name and the column count in its label`; `shows a comment icon with the comment in a tooltip`; `shows an issue badge with the number of issues of the table and its columns`; `marks a primary key column with an icon and screen reader text`; `numbers the columns of a composite primary key`; `marks a foreign key column`; `marks unique, nullable and auto increment columns`; `renders one row per column in the stored order`; `reports no axe violations in the %s theme`.
- `relation-edge.test.tsx`: `labels a one-to-many relation with both endpoints`; `shows the column count for a composite foreign key`; `marks an edge whose relation has an issue`.
- `editor-canvas.test.tsx`: `renders one node per table`; `ignores remove changes from react flow`; `dispatches one moveElements when a drag stops`; `does not dispatch when a drag ends at the same position`; `coalesces arrow key moves`; `stores the selection in the editor store`; `saves the viewport on move end`; `uses the stored viewport as the default viewport`; `shows the empty state and adds a table from it`; `passes a connection to onConnect`.
- `use-reveal-focused-element.test.tsx`: `centers the viewport on a focused node hidden behind the minimap`; `does nothing when the focused node is visible`; `uses no transition when reduced motion is requested`.

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/canvas.ts` → `typecheck` phải fail; hoàn tác. Xác minh trước khi viết: đọc `frontend/node_modules/@xyflow/react/dist/esm/types/general.d.ts` (hoặc file khai báo tương đương) để lấy đúng tên `AriaLabelConfig`, `NodeProps`, `EdgeProps`, `Connection`, `Viewport`, và xác nhận `onBeforeDelete` cùng `autoPanOnNodeFocus` có trong `ReactFlowProps` của 12.11.6; khác mô tả trên thì làm theo khai báo thật và ghi vào báo cáo.

**Commit:** `feat(frontend): add the schema canvas with table nodes and edges`

## Task 25: Panel trái: tab Bảng, Enum, Vấn đề

**Mục tiêu:** panel trái ba tab: chọn bảng không cần đi qua canvas, sửa enum đầy đủ, và danh sách issue đã dịch bấm được để nhảy tới phần tử có lỗi.

**Loại:** B. **Phụ thuộc:** 12, 14, 17, 18, 19, 23. **Đợt:** 11.

**File sở hữu:**

- Tạo trong `frontend/src/features/editor/components/panels/`: `left-panel.tsx`, `left-panel.test.tsx`, `table-list-tab.tsx`, `enum-list-tab.tsx`, `enum-list-tab.test.tsx`, `issue-list-tab.tsx`, `issue-list-tab.test.tsx`.
- Tạo `frontend/src/features/editor/lib/enum-usage.ts`, `enum-usage.test.ts`.
- Tạo `frontend/src/features/editor/hooks/use-reveal-table.ts`, `use-reveal-table.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/editor/left-panel.ts`, `locales/vi/editor/left-panel.ts`.

**Cài đặt** (spec mục 2 "Panel trái", mục 4 "Tab Vấn đề", mục 12 "Mọi thao tác kéo có hai đường thay thế"):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/editor/left-panel.ts` hiện là `export const viEditorLeftPanel = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enEditorLeftPanel>` và xóa comment placeholder.
- `enum-usage.ts`: `getEnumUsage(document: SchemaDocument): ReadonlyMap<EnumId, readonly string[]>` — với mỗi enum, danh sách nhãn `\`${table.name}.${column.name}\`` của mọi cột có `type.kind === "enum"` trỏ tới nó, sắp theo thứ tự `sortTables` rồi theo `table.columnIds`. Memo theo tham chiếu `document` (cùng ngoại lệ `WeakMap` ở Vấn đề 25).
- `use-reveal-table.ts`: `useRevealTable(): (tableId: TableId) => void` — `setSelection({ tableIds: [tableId], relationIds: [] })` rồi `setCenter` của `useViewportControls()` tới `table.position` với `zoom: getZoom()` và `duration: VIEWPORT_TRANSITION_MS` (hoặc `0` khi `prefers-reduced-motion: reduce`). Đây là đường thay thế bằng bấm cho việc pan canvas (WCAG 2.5.7).
- `left-panel.tsx` (`"use client"`): `<aside aria-label={t("label")}>` chứa `Tabs` với `value` lấy từ `leftPanelTab` của store (`null` nghĩa là thu gọn) và `onValueChange` gọi `setLeftPanelTab`. Nút thu gọn, mở lại là `Button size="icon"` có `aria-expanded`. Ba `TabsTrigger`: `t("tabs.tables")`, `t("tabs.enums")`, `t("tabs.issues", { count })`.
- `table-list-tab.tsx`: `ScrollArea` chứa danh sách `sortTables(document)`; mỗi dòng là `<button type="button">` hiện tên bảng và số cột, `aria-current` khi bảng đang được chọn, bấm thì gọi `useRevealTable()`. Bảng có issue hiện huy hiệu số.
- `enum-list-tab.tsx`: mỗi enum trong `sortEnums(document)` là một nhóm có:
  - `CommittedTextField` cho tên, dispatch `{ type: "updateEnum", enumId, changes: { name } }`.
  - Danh sách giá trị: mỗi giá trị một `CommittedTextField` (nhãn ẩn) cùng ba nút icon lên, xuống, xóa; mọi thay đổi dispatch `updateEnum` với **cả mảng** `values` mới. Nút lên của giá trị đầu và nút xuống của giá trị cuối bị `disabled`.
  - Nút "Thêm giá trị" dispatch `updateEnum` với mảng có thêm `suggestEnumValue(values)`, rồi focus ô mới.
  - Nút xóa enum dispatch `removeEnum`; enum đang được dùng thì nút `disabled`, kèm danh sách `bảng.cột` lấy từ `getEnumUsage` và `aria-describedby` trỏ tới danh sách đó.
  - Trường có issue (`issuesOfElement(enumId)`, và issue đường dẫn `["enums", id, "values", n]` cho từng ô giá trị) nhận `errorMessage` đã dịch bằng `t(\`issues:${issue.code}\`, values)`.
- `issue-list-tab.tsx`: danh sách `getIssueIndex(document).issues` theo đúng thứ tự; mỗi dòng là `<button type="button">` hiện `t(\`issues:${issue.code}\`, target.values)`. Bấm thì: bảng hoặc cột → `useRevealTable(target.tableId)`; quan hệ → `setSelection({ tableIds: [], relationIds: [elementId] })`; enum → `setLeftPanelTab("enums")`; rồi luôn gọi `requestFocus(issue.path)`. Danh sách rỗng hiện `t("issues.none")`.
- Key `editor.leftPanel` cần có: `label`, `collapse`, `expand`, `tabs.tables`, `tabs.enums`, `tabs.issues`, `tables.columnCount`, `tables.issueCount`, `tables.empty`, `enums.nameLabel`, `enums.valueLabel`, `enums.addValue`, `enums.moveValueUp`, `enums.moveValueDown`, `enums.removeValue`, `enums.remove`, `enums.inUse`, `enums.empty`, `issues.none`, `issues.goTo`.

**Test viết trước** (dùng `renderWithProviders` bọc `EditorStoreProvider` và `ViewportControlsProvider` giả):

- `enum-usage.test.ts`: `lists the columns that use an enum as table.column`; `returns an empty list for an unused enum`; `orders usages by table then by column order`.
- `use-reveal-table.test.tsx`: `selects the table and centers the viewport on it`; `keeps the current zoom`; `uses no transition when reduced motion is requested`.
- `left-panel.test.tsx`: `switches tabs from the store`; `collapses and expands the panel`; `names the panel in %s` (`it.each` hai locale); `reports no axe violations in the %s theme`.
- `enum-list-tab.test.tsx`: `renames an enum on blur`; `adds a value and focuses the new field`; `moves a value up and down with one dispatch each`; `disables move up on the first value`; `removes a value`; `disables deleting an enum that is in use and lists the columns`; `shows the translated issue of an empty enum`; `shows the translated issue on the duplicated value field`.
- `issue-list-tab.test.tsx`: `shows the empty message when there is no issue`; `shows a translated message with the element name in %s` (`it.each` hai locale); `selects the table and centers it when a table issue is clicked`; `selects the relation of a relation issue`; `requests focus on the path of the issue`; `keeps the order of validateSchema`.

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/editor/left-panel.ts` → `typecheck` phải fail; hoàn tác.

**Commit:** `feat(frontend): add the left panel with tables, enums and issues`

## Task 26: Panel bảng: cột, index, comment, vị trí

**Mục tiêu:** panel thuộc tính của một bảng: tên, comment, vị trí X, Y, danh sách cột đầy đủ thuộc tính và danh sách index, mọi thay đổi đi qua đúng một operation.

**Loại:** B. **Phụ thuộc:** 12, 14, 17, 18, 23, và task cấu hình `cmdk` ở Vấn đề 23. **Đợt:** 11.

**File sở hữu:**

- Tạo trong `frontend/src/features/editor/components/panels/table-panel/`: `table-panel.tsx`, `table-panel.test.tsx`, `table-position-fields.tsx`, `column-list.tsx`, `column-list.test.tsx`, `column-item.tsx`, `column-type-combobox.tsx`, `column-type-combobox.test.tsx`, `column-details.tsx`, `column-details.test.tsx`, `index-list.tsx`, `index-list.test.tsx`.
- Tạo `frontend/src/features/editor/lib/column-type-options.ts`, `column-type-options.test.ts`, `allowed-column-defaults.ts`, `allowed-column-defaults.test.ts`.
- Sửa `frontend/src/lib/i18n/locales/en/editor/table-panel.ts`, `locales/vi/editor/table-panel.ts`.

**Cài đặt** (spec mục 2 "Panel thuộc tính (phải)", "Cột", "Index", "Comment", "Vị trí", mục 4 "Trong panel", mục 12 "Kích thước mục tiêu bấm"):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/editor/table-panel.ts` hiện là `export const viEditorTablePanel = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enEditorTablePanel>` và xóa comment placeholder.
- `column-type-options.ts`:

  ```ts
  export const COMMON_COLUMN_TYPE_KINDS = [
    "smallint", "integer", "bigint", "decimal", "real", "double", "boolean",
    "char", "varchar", "text", "uuid", "date", "time", "timestamp", "timestamptz",
    "json", "binary",
  ] as const;
  export type CommonColumnTypeKind = (typeof COMMON_COLUMN_TYPE_KINDS)[number];
  export const DEFAULT_VARCHAR_LENGTH = 255;
  export const DEFAULT_DECIMAL_PRECISION = 10;
  export const DEFAULT_DECIMAL_SCALE = 2;
  export function buildColumnType(kind: CommonColumnTypeKind, previous: ColumnType): ColumnType;
  ```

  Đúng 17 kiểu chung. `buildColumnType` giữ lại tham số cũ khi đổi giữa hai kiểu cùng tham số (`char` ↔ `varchar` giữ `length`), ngược lại dùng giá trị mặc định.
- `allowed-column-defaults.ts`: `getAllowedColumnDefaults(type: ColumnType): readonly ColumnDefault["kind"][]` — luôn có `"literal"` trừ `kind: "binary"`; thêm `"currentTimestamp"` chỉ với `timestamp` và `timestamptz`; thêm `"generateUuid"` chỉ với `uuid`. Danh sách này khớp đúng quy tắc `column-default-incompatible` của core (`validation/rules/column-defaults.ts`), có comment nói rõ điều đó.
- `table-panel.tsx` (`"use client"`), props `{ readonly tableId: TableId }`:
  - `CommittedTextField` cho tên → `updateTable({ name })`; `CommittedTextArea` cho comment → `updateTable({ comment })`, chuỗi rỗng nghĩa là xóa comment.
  - `<TablePositionFields />`: hai `CommittedTextField` `inputMode="numeric"` hiện `Math.round(position.x)`, `Math.round(position.y)`. Commit: `Number(value)` không phải số hữu hạn thì **không dispatch** (ô tự quay lại giá trị cũ); hợp lệ thì dispatch một `moveElements` chỉ chứa bảng này.
  - Nút "Thêm quan hệ" gọi prop `onCreateRelation(tableId)`; nút "Xóa bảng" dispatch `removeTable` rồi `setSelection(EMPTY_SELECTION)` và gọi prop `onDeleted()`. Hai prop do Task 29 truyền vào.
  - Trường có issue nhận `errorMessage` dịch từ `issuesOfElement(tableId)` khớp đoạn cuối của `path`.
- `column-list.tsx` và `column-item.tsx`: mỗi cột một dòng theo `table.columnIds` (`key` là `columnId`):
  - `CommittedTextField` tên → `updateColumn({ name })`.
  - `<ColumnTypeCombobox />`.
  - Bốn `Checkbox` nullable, khóa chính, unique, auto-increment. Nullable, unique, auto-increment dispatch `updateColumn`; khóa chính dispatch `setPrimaryKey` với danh sách mới (thêm vào **cuối** hoặc bỏ ra), không tự sửa thuộc tính khác.
  - Nút icon lên, xuống dispatch `moveColumn`; nút xóa dispatch `removeColumn`. Nút lên của cột đầu, nút xuống của cột cuối `disabled`.
  - Nút "Chi tiết" (`aria-expanded`, `aria-controls`) mở `<ColumnDetails />`.
  - Nút "Thêm cột" dispatch `addColumn` ở cuối với `name: suggestColumnName(document, tableId)`, `type: { kind: "varchar", length: DEFAULT_VARCHAR_LENGTH }`, `isNullable: false`, `defaultValue: null`, `isUnique: false`, `isAutoIncrement: false`, `comment: ""`, rồi focus ô tên cột mới.
- `column-type-combobox.tsx`: `Popover` + `Command` của shadcn/ui (`CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`), ba nhóm: `t("columns.typeGroups.common")` (17 kiểu), `t("columns.typeGroups.enums")` (mọi enum trong `sortEnums`), `t("columns.typeGroups.custom")` (một mục "Kiểu custom…" mở ô nhập tên kiểu). Nút kích hoạt có `aria-label={t("columns.typeLabel", { column })}` và hiện `formatColumnType`.
  - **`Command` có prop bắt buộc `label: string`** (`frontend/src/components/ui/command.tsx`). Đây không phải trang trí: cmdk luôn đặt `aria-labelledby` của ô tìm kiếm trỏ tới một label ẩn do chính nó dựng, nên nếu không có `Command.Label` thì tham chiếu treo và ô tìm kiếm **không có accessible name**. Đã thử cả `aria-label` lẫn `placeholder` trên `CommandInput`, cả hai đều bị ghi đè và vẫn fail `getByRole("combobox", { name })`. Task 26 phải truyền một nhãn đã qua i18n (`t("columns.search")`).
  - `command.tsx` **không có** `CommandDialog`: bản registry sinh ra gọi `DialogContent` với prop `showCloseButton`, prop mà Task 3 đã thay bằng `hasCloseButton` kèm `closeLabel` bắt buộc, và nó hardcode hai chuỗi tiếng Anh, nên phần đó đã bị bỏ. Task 26 dùng `Popover` + `Command`, **không** dùng `CommandDialog`.
  - `CommandInput` tự dựng khung ô nhập thay vì import `InputGroup`, nên class của nó khác bản registry. Task 32 cần nhìn lại chỗ này khi kiểm tra giao diện bằng tay.
- `column-details.tsx`: tham số kiểu (`length`, hoặc `precision` và `scale`, hoặc tên kiểu custom) bằng `CommittedTextField`; `RadioGroup` giá trị mặc định với các lựa chọn `t("columns.default.none")` cộng `getAllowedColumnDefaults(type)`; chọn `literal` thì hiện thêm ô giá trị; `CommittedTextArea` comment của cột.
- `index-list.tsx`: mỗi index trong `sortIndexes(document)` thuộc bảng này:
  - `CommittedTextField` tên → `updateIndex({ name })`; `Checkbox` unique → `updateIndex({ isUnique })`.
  - Danh sách cột có thứ tự: mỗi dòng có tên cột và nút lên, xuống, bỏ; **nút bỏ của cột cuối cùng bị `disabled`** vì mảng rỗng là bất biến cấu trúc. `Select` "Thêm cột" chỉ liệt kê cột chưa có trong index.
  - Nút "Thêm index" dispatch `addIndex` với `name: suggestIndexName(document, { tableName, columnNames, isUnique: false })`, `columnIds` là khóa chính của bảng, hoặc cột đầu tiên khi bảng chưa có khóa chính; nút `disabled` khi bảng chưa có cột nào.
  - Nút xóa index dispatch `removeIndex`.
- Nút icon trong panel dùng `size="icon"` hoặc `size="icon-xs"` (≥ 24 px, Vấn đề 33).
- Key `editor.tablePanel` cần có (rút gọn): `label`, `nameLabel`, `commentLabel`, `position.x`, `position.y`, `position.hint`, `addRelation`, `removeTable`, `columns.title`, `columns.add`, `columns.nameLabel`, `columns.typeLabel`, `columns.typeGroups.common`, `columns.typeGroups.enums`, `columns.typeGroups.custom`, `columns.customTypeLabel`, `columns.search`, `columns.noResult`, `columns.nullable`, `columns.primaryKey`, `columns.unique`, `columns.autoIncrement`, `columns.moveUp`, `columns.moveDown`, `columns.remove`, `columns.details`, `columns.default.label`, `columns.default.none`, `columns.default.literal`, `columns.default.currentTimestamp`, `columns.default.generateUuid`, `columns.default.valueLabel`, `columns.length`, `columns.precision`, `columns.scale`, `columns.comment`, `indexes.title`, `indexes.add`, `indexes.nameLabel`, `indexes.unique`, `indexes.addColumn`, `indexes.moveUp`, `indexes.moveDown`, `indexes.removeColumn`, `indexes.remove`, `indexes.lastColumn`.

**Test viết trước:**

- `column-type-options.test.ts`: `lists the seventeen common column kinds`; `keeps the length when switching between char and varchar`; `uses the default length for varchar`; `uses the default precision and scale for decimal`.
- `allowed-column-defaults.test.ts`: `allows %s for a %s column` (`it.each` gồm `timestamp`, `timestamptz`, `uuid`, `varchar`, `binary`); `never allows a literal default on a binary column`; `matches the core rule for every column kind`.
- `table-panel.test.tsx`: `renames the table on blur`; `stores the comment on blur`; `clears the comment when the text is deleted`; `dispatches one moveElements when the x field is committed`; `restores the shown value for a non numeric position`; `shows the translated issue of a duplicated table name`; `removes the table`.
- `column-list.test.tsx`: `adds a column with the suggested name and focuses it`; `renames a column on Enter`; `toggles nullable, unique and auto increment`; `adds a column to the primary key at the end`; `removes a column from the primary key`; `moves a column up and down`; `removes a column`; `disables move up on the first column`; `shows the translated issue on the auto increment checkbox`.
- `column-type-combobox.test.tsx`: `lists the common types, the enums and the custom entry`; `filters the list while typing`; `changes the column type`; `keeps the length when switching from varchar to char`; `sets a custom type name`.
- `column-details.test.tsx`: `offers currentTimestamp only for timestamp columns`; `offers generateUuid only for uuid columns`; `offers no default kind for a binary column`; `stores a literal default`; `edits the length of a varchar column`; `edits precision and scale of a decimal column`.
- `index-list.test.tsx`: `creates an index named by suggestIndexName`; `disables adding an index for a table without columns`; `adds and removes index columns`; `disables removing the last index column`; `toggles unique`; `removes an index`.
- `reports no axe violations in the %s theme` trong `table-panel.test.tsx` (`it.each` `light`, `dark`).

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/editor/table-panel.ts` → `typecheck` phải fail; hoàn tác. Trước khi bắt đầu, xác nhận `frontend/src/components/ui/command.tsx` và `popover.tsx` đã tồn tại; nếu chưa thì **dừng và báo** (Vấn đề 23), không tự chạy `shadcn add`.

**Commit:** `feat(frontend): add the table properties panel`

## Task 27: Panel quan hệ và panel nhiều lựa chọn

**Mục tiêu:** panel thuộc tính cho một quan hệ (loại, cặp cột, ON DELETE, ON UPDATE) và panel cho nhiều phần tử được chọn với một nút xóa tất cả.

**Loại:** B. **Phụ thuộc:** 12, 14, 17, 18, 23. **Đợt:** 11.

**File sở hữu:**

- Tạo trong `frontend/src/features/editor/components/panels/`: `relation-panel.tsx`, `relation-panel.test.tsx`, `column-pair-list.tsx`, `multi-selection-panel.tsx`, `multi-selection-panel.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/editor/relation-panel.ts`, `locales/vi/editor/relation-panel.ts`.

**Cài đặt** (spec mục 2 "Quan hệ", "Panel thuộc tính (phải)", mục 3 "Chọn, di chuyển, xóa"):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/editor/relation-panel.ts` hiện là `export const viEditorRelationPanel = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enEditorRelationPanel>` và xóa comment placeholder.
- Namespace `editor.relationPanel` chứa cả key của panel nhiều lựa chọn, dưới nhánh `multiSelection`, vì plan không được thêm file resource mới sau Task 9 (Vấn đề 24, 36).
- `relation-panel.tsx` (`"use client"`), props `{ readonly relationId: RelationId }`:
  - `Select` loại quan hệ chỉ có `oneToMany` và `oneToOne` → `updateRelation({ kind })`, kèm dòng giải thích `t("kindHint")` ("n-n được tạo bằng bảng trung gian").
  - Tên bảng `from`, `to` chỉ hiển thị (`<p>`), kèm `t("changeTablesHint")`.
  - `<ColumnPairList />`: mỗi cặp có hai `Select` (cột của bảng `from`, cột của bảng `to`) và nút bỏ; nút bỏ bị `disabled` khi chỉ còn một cặp. Nút "Thêm cặp cột" thêm một cặp dùng cột đầu tiên chưa được ghép ở mỗi bên; mọi thay đổi dispatch `updateRelation({ columnPairs })` với **cả mảng**.
  - Hai `Select` ON DELETE, ON UPDATE với đủ năm `ReferentialAction` (`noAction`, `restrict`, `cascade`, `setNull`, `setDefault`), nhãn dịch trong `actions.*`.
  - Nút "Xóa quan hệ" dispatch `removeRelation` rồi `setSelection(EMPTY_SELECTION)`.
  - Issue của quan hệ (`issuesOfElement(relationId)`) hiện dưới đúng trường theo đoạn cuối của `path`: `kind`, `columnPairs`, `onDelete`, `onUpdate`; đoạn khác thì hiện ở đầu panel.
- `multi-selection-panel.tsx` (`"use client"`), props `{ readonly selection: Selection; readonly onDeleted: () => void }`: hiện `t("multiSelection.summary", { tableCount, relationCount })` và nút `t("multiSelection.deleteAll")` dispatch `buildDeleteSelectionOperation(selection)` trong **một** lần, rồi `setSelection(EMPTY_SELECTION)` và gọi `onDeleted()`. Không hỏi xác nhận (undo được).
- Key `editor.relationPanel` cần có: `label`, `kindLabel`, `kind.oneToOne`, `kind.oneToMany`, `kindHint`, `fromTable`, `toTable`, `changeTablesHint`, `columnPairs.title`, `columnPairs.fromLabel`, `columnPairs.toLabel`, `columnPairs.add`, `columnPairs.remove`, `columnPairs.lastPair`, `onDelete`, `onUpdate`, `actions.noAction`, `actions.restrict`, `actions.cascade`, `actions.setNull`, `actions.setDefault`, `remove`, `multiSelection.summary`, `multiSelection.deleteAll`.

**Test viết trước:**

- `relation-panel.test.tsx`: `changes the relation kind`; `offers only one-to-one and one-to-many`; `shows both table names`; `changes a column pair`; `adds a column pair`; `disables removing the last column pair`; `changes ON DELETE and ON UPDATE`; `shows the translated type mismatch issue on the column pairs`; `removes the relation and clears the selection`; `names every field in %s` (`it.each` hai locale); `reports no axe violations in the %s theme`.
- `multi-selection-panel.test.tsx`: `summarises the number of tables and relations`; `deletes everything with one dispatch`; `restores everything with a single undo`; `clears the selection after deleting`.

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/editor/relation-panel.ts` → `typecheck` phải fail; hoàn tác.

**Commit:** `feat(frontend): add the relation and multi selection panels`

## Task 28: Hộp thoại "Tạo quan hệ" và `buildRelationOperation`

**Mục tiêu:** một hộp thoại duy nhất tạo quan hệ 1-n, 1-1 và n-n, mở được cả bằng kéo nối lẫn bằng nút trong panel, điền sẵn hợp lý và chặn đúng các trường hợp không tạo được.

**Loại:** B. **Phụ thuộc:** 12, 16, 18, 24. **Đợt:** 12.

**File sở hữu:**

- Tạo `frontend/src/features/editor/lib/build-relation-operation.ts`, `build-relation-operation.test.ts`, `to-relation-draft.ts`, `to-relation-draft.test.ts`.
- Tạo trong `frontend/src/features/editor/components/dialogs/`: `create-relation-dialog.tsx`, `create-relation-dialog.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/editor/relation-dialog.ts`, `locales/vi/editor/relation-dialog.ts`.

**Cài đặt** (spec mục 3 "Tạo quan hệ", mục 12 "Hộp thoại"):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/editor/relation-dialog.ts` hiện là `export const viEditorRelationDialog = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enEditorRelationDialog>` và xóa comment placeholder.
- `to-relation-draft.ts`:

  ```ts
  export type RelationDraftKind = "oneToMany" | "oneToOne" | "manyToMany";
  export type ForeignKeyMode = "new-columns" | "existing-columns";
  export type RelationDraft = {
    readonly fromTableId: TableId;
    readonly toTableId: TableId;
    readonly kind: RelationDraftKind;
    readonly foreignKeyMode: ForeignKeyMode;
    readonly referencedColumnIds: readonly ColumnId[];
    readonly columnPairs: readonly ColumnPair[];
    readonly junctionTableName: string;
    readonly onDelete: ReferentialAction;
    readonly onUpdate: ReferentialAction;
  };

  export function createRelationDraftFromTable(document: SchemaDocument, fromTableId: TableId): RelationDraft | null;
  export function createRelationDraftFromConnection(
    document: SchemaDocument,
    connection: { readonly source: string | null; readonly target: string | null; readonly sourceHandle: string | null; readonly targetHandle: string | null },
  ): RelationDraft | null;
  ```

  - `createRelationDraftFromConnection` dùng `parseHandleId`: bảng nguồn là `from`, bảng đích là `to`; thả vào handle của cột `d` thì `referencedColumnIds = [d]`, thả vào tiêu đề thì là `toTable.primaryKeyColumnIds`; kéo **từ** handle cột `c` thì `foreignKeyMode = "existing-columns"` với `columnPairs = [{ fromColumnId: c, toColumnId: referencedColumnIds[0] }]`, kéo từ tiêu đề thì `"new-columns"`.
  - `createRelationDraftFromTable` (nút "Thêm quan hệ"): `toTableId` là bảng khác đầu tiên theo `sortTables`, `kind` là `oneToMany`, `foreignKeyMode` là `"new-columns"`, `referencedColumnIds` là khóa chính của bảng đích.
  - Mặc định `kind: "oneToMany"`, `onDelete` và `onUpdate` là `"noAction"`, `junctionTableName` là `suggestJunctionTableName(...)`.
  - Tài liệu không có đủ hai bảng, hoặc handle không parse được, thì trả `null`.
- `build-relation-operation.ts`:

  ```ts
  export type RelationDraftError =
    | { readonly field: "referencedColumnIds"; readonly reason: "primary-key-missing" }
    | { readonly field: "columnPairs"; readonly reason: "unmatched-column" | "duplicate-column" };

  export function validateRelationDraft(document: SchemaDocument, draft: RelationDraft): readonly RelationDraftError[];
  export function buildRelationOperation(
    document: SchemaDocument,
    draft: RelationDraft,
    generateId: GenerateId,
  ): Result<Operation, OperationError>;
  ```

  - `validateRelationDraft` chặn đúng ba trường hợp spec nêu: `referencedColumnIds` rỗng (1-n, 1-1) hoặc một trong hai bảng thiếu khóa chính (n-n); chế độ "Dùng cột có sẵn" còn cột được tham chiếu chưa ghép; một cột được chọn hai lần. Khác kiểu và cột đích không unique **không** bị chặn.
  - `buildRelationOperation`:
    - `kind: "manyToMany"` → `buildManyToMany(document, { leftTableId, rightTableId, junctionTableName, position }, generateId)` với `position` là trung điểm hai bảng.
    - `foreignKeyMode: "new-columns"` → `buildRelation(document, { fromTableId, toTableId, kind, onDelete, onUpdate }, generateId)` của core, đã lo đặt tên cột, `isUnique` cho 1-1 một cột và index unique cho 1-1 nhiều cột.
    - `foreignKeyMode: "existing-columns"` → một `addRelation` duy nhất với `columnPairs` của draft và id từ `createRelationId(generateId)`.
  - Comment: `buildRelation` của core **chỉ** dựng khóa ngoại mới theo khóa chính bảng đích, nên chế độ "Dùng cột có sẵn" phải tự dựng `addRelation`.
- `create-relation-dialog.tsx` (`"use client"`), props `{ readonly draft: RelationDraft | null; readonly onClose: () => void }`:
  - `Dialog` mở khi `draft !== null`; `<form>` với Enter xác nhận, Escape hủy; `closeLabel={t("common:actions.close")}`.
  - Trường: bảng `from` (chỉ hiển thị, có nút "Đổi chiều" hoán đổi hai bảng và dựng lại giá trị mặc định), bảng `to` (`Select`), loại (`RadioGroup` ba lựa chọn), cột được tham chiếu (`Select` nhiều dòng, chỉ hiện với 1-n và 1-1), chế độ khóa ngoại (`RadioGroup` "Tạo cột mới" hoặc "Dùng cột có sẵn"), danh sách cặp cột (chỉ hiện ở chế độ "Dùng cột có sẵn"), tên bảng trung gian (chỉ hiện với n-n).
  - Lỗi từ `validateRelationDraft` hiện ngay dưới trường tương ứng, nối bằng `aria-describedby`, và nút xác nhận `disabled`.
  - Xác nhận: `buildRelationOperation` rồi `dispatch` **một lần**; lỗi `Result` thì hiện thông báo `errors:codes.<code>` dưới trường và không đóng. Thành công thì `onClose()`.
  - Hộp thoại mở từ thao tác kéo không có nút mở, nên `onClose` trả focus về node nguồn (`document.querySelector` theo `data-id` của node, hoặc phần tử `canvas` khi không tìm thấy); Task 29 truyền hàm này xuống.
- Key `editor.relationDialog` cần có: `title`, `description`, `fromTable`, `toTable`, `swap`, `kindLabel`, `kind.oneToMany`, `kind.oneToOne`, `kind.manyToMany`, `referencedColumns`, `foreignKeyMode.label`, `foreignKeyMode.newColumns`, `foreignKeyMode.existingColumns`, `columnPairs.fromLabel`, `columnPairs.toLabel`, `junctionTableName`, `submit`, `errors.primaryKeyMissing`, `errors.unmatchedColumn`, `errors.duplicateColumn`.

**Test viết trước:**

- `to-relation-draft.test.ts`: `fills the referenced column from the target column handle`; `falls back to the primary key when dropping on the table handle`; `uses existing columns when dragging from a column handle`; `uses new columns when dragging from the table handle`; `suggests a junction table name from both tables`; `returns null for an unparsable handle`; `builds a draft from the add relation button`.
- `build-relation-operation.test.ts`: `reports a missing primary key on the referenced columns`; `reports an unmatched referenced column`; `reports the same column chosen twice`; `does not block a type mismatch`; `builds one addRelation for existing columns`; `delegates to buildRelation for new columns`; `marks a single new column unique for a one-to-one relation`; `adds a unique index for a composite one-to-one relation`; `delegates to buildManyToMany`; `undoes a many-to-many relation in one step`.
- `create-relation-dialog.test.tsx`: `prefills the dialog from a connection`; `swaps both tables`; `creates a one-to-many relation with a new foreign key column`; `creates a one-to-one relation`; `creates a junction table for a many-to-many relation`; `blocks confirmation when the target table has no primary key`; `confirms with Enter`; `closes on Escape without dispatching`; `returns focus to the source node when it closes`; `names every field in %s` (`it.each` hai locale); `reports no axe violations in the %s theme`.

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/editor/relation-dialog.ts` → `typecheck` phải fail; hoàn tác.

**Commit:** `feat(frontend): add the create relation dialog`

## Task 29: Ghép editor: bố cục, landmark, skip link, xóa bằng phím, toast hoàn tác, focus

**Mục tiêu:** ghép toolbar, panel trái, canvas và panel phải thành một màn hình có landmark và skip link, nối phím `Delete` với `dispatch`, hiện toast "Hoàn tác" sau khi xóa, và xử lý `focusRequest` của store.

**Loại:** B. **Phụ thuộc:** 20, 22, 23, 24, 25, 26, 27, 28. **Đợt:** 13.

**File sở hữu:**

- Sửa `frontend/src/features/editor/components/editor-workspace.tsx`; tạo `frontend/src/features/editor/components/editor-workspace.test.tsx`.
- Tạo `frontend/src/features/editor/components/skip-to-panel-link.tsx`.
- Tạo `frontend/src/features/editor/components/panels/properties-panel.tsx`, `properties-panel.test.tsx`.
- Tạo `frontend/src/features/editor/hooks/use-delete-selection.ts`, `use-delete-selection.test.tsx`, `use-focus-request.ts`, `use-focus-request.test.tsx`.
- Sửa `frontend/src/lib/i18n/locales/en/editor/editor-layout.ts`, `locales/vi/editor/editor-layout.ts`.

**Cài đặt** (spec mục 2 "Bố cục editor", mục 3 "Chọn, di chuyển, xóa", mục 4 "Tab Vấn đề", mục 12 "Landmark", "Thứ tự tab", "Quản lý focus"):

- **Mệnh đề `satisfies` của file `vi`.** `locales/vi/editor/editor-layout.ts` hiện là `export const viEditorLayout = {} as const;` (Vấn đề 36). Khi thêm key đầu tiên, thay bằng `as const satisfies LocaleNamespace<typeof enEditorLayout>` và xóa comment placeholder.
- `use-delete-selection.ts`: `useDeleteSelection(): () => void`.
  - Đọc `selection` và `document` từ store; `buildDeleteSelectionOperation(selection)` trả `null` thì không làm gì.
  - Ngược lại: lưu `previousHistoryLength`, `dispatch(operation)`, `setSelection(EMPTY_SELECTION)`, đưa focus về vùng canvas, rồi `notify({ tone: "success", titleKey, values, action: { labelKey: "common:actions.undo", onSelect: () => store.getState().undo() } })`.
  - `titleKey` là `editor:layout.deleted.one` khi xóa đúng một bảng (values `{ name }`) và `editor:layout.deleted.many` khi nhiều phần tử (values `{ count }`). Hai key hằng, không ghép chuỗi key động.
- `use-focus-request.ts`: `useFocusRequest(onFocus: (path: DocumentPath) => void): void` — một effect theo dõi `focusRequest` của store; khác `null` thì gọi `onFocus(path)` rồi `requestFocus(null)`. Panel dùng `data-focus-path` (chuỗi `JSON.stringify(path)`) trên phần tử nhập liệu, và hàm `onFocus` mặc định tìm phần tử theo thuộc tính đó rồi gọi `focus()`; không tìm thấy thì không làm gì.
- `properties-panel.tsx` (`"use client"`): `<aside aria-label={t("propertiesLabel")}>` chọn nội dung theo lựa chọn, đúng bảng của spec mục 2:
  - Không có lựa chọn → không render `<aside>`.
  - Đúng một bảng, không có quan hệ → `<TablePanel tableId onCreateRelation onDeleted />`.
  - Đúng một quan hệ, không có bảng → `<RelationPanel relationId />`.
  - Nhiều phần tử → `<MultiSelectionPanel selection onDeleted />`.
  - Panel cuộn bằng `ScrollArea`, không có tiêu đề `sticky` đè lên nội dung (spec mục 12 "Focus không bị che").
- `skip-to-panel-link.tsx`: link chỉ hiện khi focus (`sr-only focus:not-sr-only`), đưa focus tới panel thuộc tính, hoặc panel trái khi chưa chọn gì. Nội dung `t("skipToPanel")`.
- `editor-workspace.tsx` (sửa từ Task 22) trở thành bố cục đầy đủ:
  - `<EditorStoreProvider>` bọc: `<header>` chứa `<EditorToolbar />`; một hàng gồm `<LeftPanel />` (`<aside>`), `<main>` chứa `<SkipToPanelLink />` và `<EditorCanvas />`, rồi `<PropertiesPanel />` (`<aside>`).
  - Thứ tự tab đúng spec: toolbar → panel trái → canvas → panel phải, bằng chính thứ tự DOM; không dùng `tabIndex` dương.
  - `useEditorShortcuts({ store, canvasElement, isDialogOpen, platformHint: navigator.platform, onDeleteSelection })` với `canvasElement` lấy từ ref của `<main>`, `isDialogOpen` là state của workspace (hộp thoại tạo quan hệ, đổi tên schema).
  - `useFocusRequest(...)` và `<CreateRelationDialog draft onClose />`; `onConnect` của canvas gọi `createRelationDraftFromConnection`, nút "Thêm quan hệ" của panel bảng gọi `createRelationDraftFromTable`.
  - `onDeleted` của panel đưa focus về vùng canvas.
- Key `editor.layout` cần có: `skipToPanel`, `propertiesLabel`, `canvasLabel`, `deleted.one`, `deleted.many`.

**Test viết trước:**

- `use-delete-selection.test.tsx`: `deletes the selected tables and relations with one dispatch`; `restores everything with a single undo`; `does nothing for an empty selection`; `shows a toast with an undo action`; `names the table in the toast when one table is deleted`; `counts the elements in the toast when several are deleted`; `clears the selection and moves focus back to the canvas`.
- `use-focus-request.test.tsx`: `focuses the field matching the requested path`; `clears the focus request afterwards`; `does nothing when no field matches`.
- `properties-panel.test.tsx`: `renders nothing without a selection`; `shows the table panel for a single table`; `shows the relation panel for a single relation`; `shows the multi selection panel for several elements`; `names the panel in %s` (`it.each` hai locale).
- `editor-workspace.test.tsx`:
  - `renders the toolbar, both panels and the canvas as landmarks`.
  - `moves focus to the properties panel through the skip link`.
  - `deletes the selection with the Delete key when focus is in the canvas`.
  - `does not delete while focus is in a text field`.
  - `does not delete while the create relation dialog is open`.
  - `undoes the deletion from the toast action`.
  - `opens the create relation dialog prefilled from a connection`.
  - `opens the create relation dialog from the table panel button`.
  - `focuses the table name field after adding a table`.
  - `reports no axe violations in the %s theme` (`it.each` `light`, `dark`).

**Kiểm tra:** như "Quy ước chung", thêm: thêm một key thừa vào `locales/vi/editor/editor-layout.ts` → `typecheck` phải fail; hoàn tác.

**Commit:** `feat(frontend): assemble the editor layout and delete shortcut`

## Task 30: Test hiệu năng và script `perf:snippet`

**Mục tiêu:** chốt bằng test tự động rằng sửa một cột chỉ render lại đúng dòng cột đó và mapper giữ nguyên tham chiếu, và có sẵn công cụ để đo tay trên Chrome.

**Loại:** B. **Phụ thuộc:** 24, 26. **Đợt:** 12.

**File sở hữu:**

- Tạo `frontend/src/testing/large-schema.ts`, `large-schema.test.ts`.
- Tạo `frontend/src/features/editor/components/canvas/table-node.render-count.test.tsx`.
- Tạo `frontend/src/features/editor/lib/node-reuse.perf.test.ts`.
- Tạo `frontend/scripts/print-large-schema-snippet.ts`.
- Sửa `frontend/package.json` (**chỉ** thêm một script; không đổi dependency, nên `pnpm-lock.yaml` không đổi).

**Cài đặt** (spec mục 13, mục 14 "Coverage"):

- `src/testing/large-schema.ts`:

  ```ts
  export type LargeSchemaInput = {
    readonly tables: number;
    readonly columnsPerTable: number;
    readonly relations: number;
  };
  export const STANDARD_LARGE_SCHEMA: LargeSchemaInput = { tables: 100, columnsPerTable: 15, relations: 150 };
  export function makeLargeSchema(input: LargeSchemaInput): SchemaDocument;
  ```

  - Dựng bằng `buildSchema`, `makeTable`, `makeColumn`, `makeRelation`, `createCounterIdGenerator` của `@schemaforge/core/testing` (core không có `makeLargeSchema`, Vấn đề 34).
  - Tên bảng `table_1`… , cột `column_1`…; cột đầu mỗi bảng là khóa chính `id` kiểu `bigint`; quan hệ thứ `i` nối bảng `i % tables` với bảng `(i + 1) % tables`, dùng một cột khóa ngoại cùng kiểu, nên schema chuẩn **không** phát sinh issue.
  - Vị trí bảng xếp lưới 10 cột, bước 320 × 220 px.
  - Hàm thuần, không ngẫu nhiên, không đọc đồng hồ.
- `table-node.render-count.test.tsx`: dựng store trên `makeLargeSchema(STANDARD_LARGE_SCHEMA)`, render node của hai bảng trong `React.Profiler`, dispatch `updateColumn` đổi tên một cột, rồi khẳng định: `TableNode` của bảng khác **không** render lại, và trong bảng đó chỉ `ColumnRow` của cột bị sửa render lại. Đếm bằng `onRender` của `Profiler` và một `Map` theo `id` của `Profiler`.
- `node-reuse.perf.test.ts`: `toTableNodes` và `toRelationEdges` trên schema chuẩn, sau khi đổi một bảng thì 99 node còn lại và mọi edge không liên quan giữ nguyên tham chiếu (`toBe`).
- `scripts/print-large-schema-snippet.ts`: in ra stdout một đoạn JavaScript tự chạy, dùng **API IndexedDB gốc** (không import Dexie), mở database `schemaforge`, ghi một bản ghi `schemas`, `documents` cho fixture chuẩn với `id` cố định, rồi in hướng dẫn tải lại trang. Script không ghi file, không gọi mạng.
- `frontend/package.json`: thêm `"perf:snippet": "node --experimental-strip-types scripts/print-large-schema-snippet.ts"`. Nếu Node 24 cần cờ khác để chạy TypeScript trực tiếp thì dùng cách chạy thật sự hoạt động và ghi vào báo cáo. Không thêm task vào `turbo.json`.

**Test viết trước:**

- `large-schema.test.ts`: `builds a schema with the requested number of tables, columns and relations`; `gives every table a bigint primary key`; `introduces no validation issue`; `returns the same document for the same input`.
- `node-reuse.perf.test.ts`: `keeps the node objects of the other tables after one table changed`; `keeps the edge objects that do not touch the changed table`.
- `table-node.render-count.test.tsx`: `renders no other table node when one column is renamed`; `renders only the changed column row`.

**Kiểm tra:** như "Quy ước chung", thêm:

```bash
source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;
pnpm --filter @schemaforge/frontend perf:snippet | head -5
git diff --exit-code -- pnpm-lock.yaml
```

Mong đợi: script in ra đoạn JavaScript; `git diff --exit-code` trên lockfile thoát mã 0.

**Commit:** `test(frontend): add render count tests and the perf snippet script`

## Task 31: Test tích hợp hành trình 1–8

**Mục tiêu:** tám hành trình ở spec mục 14 chạy trên màn hình thật, store thật và `SchemaRepository` thật trên `fake-indexeddb`, thay cho test e2e mà phần 3 không có.

**Loại:** B. **Phụ thuộc:** 21, 29. **Đợt:** 14.

**File sở hữu:**

- Tạo `frontend/src/testing/mount-editor-journey.tsx`.
- Tạo trong `frontend/src/features/editor/journeys/`: `schema-and-columns.test.tsx` (hành trình 1, 3), `relations.test.tsx` (2), `viewport-theme-language.test.tsx` (4, 5, 6), `keyboard-and-locking.test.tsx` (7, 8).
- Tạo `frontend/src/features/schema-list/schema-list-journey.test.tsx` (phần danh sách của hành trình 1).

**Cài đặt** (spec mục 14 "Tích hợp: màn hình + store + repository"):

- `mount-editor-journey.tsx`: helper dựng một môi trường hoàn chỉnh trong bộ nhớ.

  ```ts
  export type JourneyEnvironment = {
    readonly storage: StorageBundle;
    readonly database: SchemaforgeDatabase;
    readonly lockRegistry: FakeLockRegistry;
    readonly createSchema: (name: string) => Promise<string>;
    readonly mountEditor: (schemaId: string, options?: { readonly locale?: Locale }) => RenderResult & { readonly user: UserEvent };
    readonly mountSchemaList: () => RenderResult & { readonly user: UserEvent };
  };
  export function createJourneyEnvironment(): JourneyEnvironment;
  ```

  - Một `SchemaforgeDatabase` trên `new IDBFactory()` của `fake-indexeddb`, một `createFakeLockRegistry()` dùng chung cho mọi `SchemaLockManager` dựng trong cùng môi trường, `clock` là bộ đếm và `generateId` sinh UUID cố định.
  - `mountEditor` render `<StorageProvider storage>` bọc `<EditorScreen schemaId />` trong `renderWithProviders`. "Tải lại trang" trong test là `unmount()` rồi `mountEditor(...)` lần nữa trên **cùng** database.
  - `mountSchemaList` tương tự với `<SchemaListScreen />`.
  - Hành trình 8 tạo hai `SchemaLockManager` từ cùng `lockRegistry` và mount hai editor.
- Mỗi file test theo đúng bảng hành trình của spec; thao tác bằng `user-event`, truy vấn theo role, label và text. Không mock store, không mock repository.
- Hành trình 7 chỉ dùng bàn phím: `user.tab()`, `user.keyboard(...)`; không gọi `user.click` ở bất kỳ bước nào.

**Test viết trước** (tên test là tên hành trình, viết bằng tiếng Anh):

- `schema-list-journey.test.tsx`: `creates a schema from the list and opens its editor`; `renames a schema from the list`; `deletes a schema after confirming`.
- `schema-and-columns.test.tsx`: `adds two tables and edits a column through the panel`; `keeps the schema after the screen is mounted again`; `creates a unique index over two columns`; `uses an enum as a column type`; `stores a comment on a table and a column`; `shows a duplicate table name issue on both nodes and in the issues tab`; `clears the issue after the name is fixed`.
- `relations.test.tsx`: `creates a one-to-many relation with a new users_id column`; `changes the relation to one-to-one and updates the edge label`; `creates a junction table and two relations for a many-to-many relation`; `undoes the whole many-to-many relation in one step`; `redoes it`; `stores the result in the database`.
- `viewport-theme-language.test.tsx`: `stores the viewport on move end`; `uses the stored viewport when the editor is mounted again`; `fits the view when there is no stored viewport`; `switches to the dark theme and writes the cookie`; `follows the system color scheme`; `switches to English and keeps the undo history`.
- `keyboard-and-locking.test.tsx`: `creates a schema, a table, a column and a relation with the keyboard only`; `undoes with Mod+Z outside a text field`; `leaves Mod+Z to the browser inside a text field`; `deletes the selected table and relation with one undo step`; `ignores Delete inside a text field`; `ignores Delete while a dialog is open`; `shows the locked state in the second editor`; `lets the second editor edit after the first one unmounts`; `re-reads the document from the database after the lock is granted`.

**Kiểm tra:** như "Quy ước chung", thêm `pnpm --filter @schemaforge/frontend test` phải đạt ngưỡng coverage 80% số dòng mà không có dòng `ERROR: Coverage for lines`.

**Commit:** `test(frontend): add editor and schema list journey tests`

## Task 32: Tài liệu, kiểm tra toàn repo, checklist kiểm tra tay

**Mục tiêu:** chạy checklist kiểm tra tay trên Chrome, đối chiếu đủ tiêu chí hoàn thành của spec, và cập nhật tài liệu về đúng trạng thái sau phần 3.

**Loại:** B. **Phụ thuộc:** 1–31. **Đợt:** 15.

**File sở hữu:** sửa `document/roadmap.md`, `document/architecture.md`, và mục "Current status" của `CLAUDE.md` (chỉ khi user đã xác nhận, Vấn đề 35).

**Cài đặt:**

1. **Kiểm tra toàn repo** (root, tiền tố Node như "Quy ước chung"): `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm format:check`. Tất cả thoát mã 0 và `pnpm test` không in dòng vi phạm ngưỡng coverage.
2. **Checklist kiểm tra tay** trên bản production (`pnpm --filter @schemaforge/frontend exec next build && pnpm --filter @schemaforge/frontend start`), Chrome mới nhất, mở qua `http://localhost:3000`. Ghi kết quả từng mục vào báo cáo và vào PR:
   - Kéo bảng, kéo nối quan hệ ra hộp thoại điền sẵn, kéo nền để pan, bấm và kéo trên minimap.
   - Zoom bằng con lăn chuột và bằng cuộn hai ngón trên trackpad cho cùng kết quả.
   - Chọn Tối rồi tải lại trang với CPU chậm 4×: không nháy sai theme.
   - Tab Network có header `Content-Security-Policy` với nonce ở `/` và `/schemas/<id>`; Console không có vi phạm CSP; file trong `_next/static` không đi qua proxy.
   - Trên mọi route có import `@schemaforge/core` (`/`, `/schemas/<id>`), tải thẳng route đó (không đi qua điều hướng phía client) rồi xem Console: không có vi phạm CSP liên quan `unsafe-eval` (Vấn đề 43).
   - Thẻ `<script src="/theme-init.js">` trong `<head>` có thuộc tính `nonce` (xem trong tab Elements; giá trị có thể bị trình duyệt ẩn, kiểm tra bằng `document.querySelector('script[src="/theme-init.js"]').nonce`) và Console không có vi phạm CSP.
   - Không có cảnh báo hydration của React 19.3 khi tải trang và khi gọi `router.refresh()` (thẻ `<script>` đồng bộ có nonce trong `<head>`). Có cảnh báo thì ghi nguyên văn.
   - Không nháy theme khi tải lại `/` và một route không tồn tại, với cookie `sf-theme` lần lượt là `dark`, `light`, `system` (với `system`, thử cả khi hệ điều hành ở chế độ sáng và tối).
   - Trang 404 ở theme sáng và tối: link `text-primary` có độ tương phản ≥ 4.5:1 với nền; viền focus ≥ 3:1 và nhìn thấy rõ khi Tab tới link.
   - `<title>` và meta description đã dịch theo locale; `html[lang]` khớp locale đang dùng (đổi ngôn ngữ rồi tải lại để kiểm tra cả `vi` và `en`).
   - Trình đọc màn hình (VoiceOver) đọc tên vùng toast là "Thông báo alt+T" ở `vi` (Sonner tự nối phím tắt vào nhãn `containerAriaLabel`); đây là hành vi đúng.
   - Tạo schema, đóng hẳn trình duyệt, mở lại: dữ liệu còn.
   - Mở cùng một schema ở hai tab Chrome: tab thứ hai hiện "đang mở ở tab khác", đóng tab đầu thì tab thứ hai mở được.
   - Độ tương phản bằng công cụ của DevTools trên cả hai theme: chữ thường ≥ 4.5:1; icon, viền, vòng focus ≥ 3:1. Đo đủ các cặp token chữ, nền của toolbar, panel, node, edge, minimap và toast.
   - Kích thước mục tiêu bấm ≥ 24×24 CSS px: nút icon trên toolbar, checkbox trong panel bảng, nút lên, xuống, xóa trong panel, và vùng bấm của edge. Handle của node và link trong câu dùng ngoại lệ ở spec mục 12.
   - Focus không bị che: Tab qua node nằm dưới minimap, node nằm ngoài khung nhìn, và khi toast đang hiện; làm lại ở màn hình danh sách.
   - Đường thay thế kéo bằng bấm: chỉ dùng bấm chuột để di chuyển bảng bằng ô "Vị trí", tạo quan hệ bằng nút "Thêm quan hệ", xem mọi bảng bằng fit view và tab "Bảng".
   - Số đo hiệu năng trên fixture chuẩn (nạp bằng `pnpm --filter @schemaforge/frontend perf:snippet`), CPU chậm 4×: INP của commit tên cột, undo, redo ≤ 200 ms; kéo một bảng trung bình ≥ 30 fps; mở schema tới lúc tương tác được ≤ 2 s. Không đạt thì bật `onlyRenderVisibleElements` rồi đo lại, và báo cáo cả hai lần đo.
3. **Đối chiếu tiêu chí hoàn thành:** đi hết danh sách ở spec mục "Tiêu chí hoàn thành", ghi với mỗi dòng là test nào phủ hay mục nào trong checklist đã chạy. Dòng nào chưa phủ thì **dừng và báo**, không tự đánh dấu xong.
4. **`document/roadmap.md`:** đổi "Trạng thái" của dòng phần 3 từ `Đang làm` thành `Xong`. Không đụng dòng khác, không sửa phần ghi chú thứ tự trừ khi phụ thuộc thật sự đổi.
5. **`document/architecture.md`:** so bảng "Quyết định đã chốt" với thực tế trong `frontend/package.json` và `package.json` ở root; gói của phần 3 chưa có dòng (ít nhất `sonner`, `axe-core`, `eslint-plugin-i18next`, `eslint-plugin-jsx-a11y-x`, `prettier-plugin-tailwindcss`, `cmdk`) thì thêm một dòng `| Hạng mục | Quyết định | Lý do |`. Quyết định đã có mà nay khác thì **sửa đúng dòng đó**, không thêm bản thứ hai. Mục "Chưa chốt" hiện rỗng: chỉ thêm khi phát sinh lựa chọn mới.
6. **`CLAUDE.md`:** sửa đoạn "Current status" cho khớp (frontend đã có editor, danh sách schema, lưu local, i18n, theme). Chỉ làm khi user đã xác nhận Vấn đề 35; chưa xác nhận thì ghi nội dung đề xuất vào báo cáo và không sửa file.

**Test viết trước:** task này không thêm test. Thay vào đó chạy lại toàn bộ bộ test của repo (bước 1) và ghi số test cùng phần trăm coverage của từng package vào báo cáo.

**Kiểm tra:** sáu lệnh ở bước 1 cộng `git status --porcelain` chỉ còn các file tài liệu của task. Prettier không format `*.md`, nên kiểm tra tay rằng mọi bảng Markdown đã sửa có hàng phân cách khớp số cột và ký tự `|` trong ô được escape thành `\|`.

**Commit:** `docs: mark the editor mvp as done`
