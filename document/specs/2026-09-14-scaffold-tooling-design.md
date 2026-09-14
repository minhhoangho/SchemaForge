# Scaffold & tooling

Spec cho phần 1 trong [roadmap.md](../roadmap.md). Phần này dựng khung monorepo và bộ công cụ, để các phần sau viết code ngay và các quy tắc trong `.claude/rules/` được tool kiểm tra thay vì chỉ dựa vào review. Phần này không có tính năng cho người dùng.

Phiên bản trong spec được kiểm tra ngày 2026-09-14: package npm bằng `npm view` (phiên bản, `engines`, `peerDependencies`), GitHub Actions bằng `git ls-remote`, lịch hỗ trợ Node.js từ `nodejs/Release`, cách cấu hình từ tài liệu chính thức qua Context7 và template ứng dụng của `@nestjs/schematics` 12.

## Mục tiêu

- Clone repo, chạy `pnpm install` rồi `pnpm dev` là có frontend, backend và `packages/core` chạy ở chế độ watch.
- Mỗi việc có một lệnh ở root: build, lint, typecheck, test, kiểm tra format. CI chạy đúng các lệnh đó.
- Frontend và backend dùng `@schemaforge/core` qua tên package, khi dev, khi test, khi build và khi chạy bản build.
- Quy tắc nào trong `.claude/rules/` kiểm tra tự động được thì được enforce bằng compiler, lint hoặc ngưỡng coverage.

## Phạm vi

### Trong phạm vi

- pnpm workspaces, Turborepo, cố định phiên bản Node.js và pnpm
- `packages/core`: build, test, một export giữ chỗ
- `frontend/`: app Next.js tối thiểu, một trang giữ chỗ dùng core
- `backend/`: app NestJS tối thiểu, env được validate, dùng core
- tsconfig dùng chung, ESLint, Prettier, Vitest và ngưỡng coverage
- CI trên GitHub Actions
- `backend/.env.example`

### Ngoài phạm vi

| Hạng mục | Làm ở phần |
|---|---|
| Schema model, validation, operations | 2 |
| Canvas, i18n, theme, state, lưu local; init Tailwind CSS + shadcn/ui; lint cho accessibility và chuỗi hardcode; test e2e trên trình duyệt | 3 |
| Prisma, PostgreSQL, auth; endpoint đầu tiên; Helmet, CORS, `ValidationPipe` toàn cục, exception filter; test e2e backend | 4 |
| AI, Gemini | 5 |
| Deploy | Chưa có trong roadmap |

## Quyết định

| # | Hạng mục | Quyết định | Lý do | Phương án đã cân nhắc |
|---|---|---|---|---|
| 1 | Node.js | Node.js 24 LTS. `.nvmrc` là `24`, `engines.node` là `^24.15.0` | LTS được hỗ trợ tới 2028-04-30; thỏa `engines` của mọi tool đã chọn (jsdom 30 cần từ 24.15.0) | Node 22: hết hỗ trợ 2027-04-30, và bản 22.18.0 trên máy dev không thỏa jsdom 30 (cần từ 22.22.2). Node 26: tới 2026-10-28 mới thành LTS |
| 2 | pnpm | `packageManager: "pnpm@12.4.1"`. Dependency dùng ở nhiều package khai báo phiên bản một lần trong `catalog` của `pnpm-workspace.yaml` | Mọi máy và CI dùng cùng một bản pnpm; mỗi dependency dùng chung chỉ có một phiên bản; pnpm 12 báo lỗi khi `pnpm-workspace.yaml` có setting không hợp lệ | pnpm 11.26: vẫn được bảo trì nhưng sẽ sớm phải nâng major |
| 3 | Phiên bản tool | Xem mục [Phiên bản](#phiên-bản). TypeScript giữ ở `~6.0.3` | typescript-eslint 8.70 chỉ hỗ trợ TypeScript dưới 6.1; `@nestjs/cli` 12 dùng `~6.0.2` | TypeScript 7.0.2: package không có entry `main` (chưa có API JS), nên typescript-eslint và Nest CLI chưa dùng được |
| 4 | Tên package | `@schemaforge/core`, `@schemaforge/frontend`, `@schemaforge/backend`; root là `schemaforge`. Tất cả `private: true` | Cùng scope với `@schemaforge/core` đã dùng trong rules; tên trùng tên thư mục | `@schemaforge/web`, `@schemaforge/api`: lệch với tên thư mục |
| 5 | Định dạng module | ESM (`"type": "module"`) ở mọi package | NestJS 12 chỉ phát hành ESM và template mới dùng `module: nodenext`; Next.js và Vitest vốn dùng ESM | Backend CommonJS: đi ngược NestJS 12, và core phải build thêm bản CommonJS |
| 6 | Build và dùng `packages/core` | `tsc -p tsconfig.build.json` sinh `dist/` gồm ESM, `.d.ts` và declaration map. `exports` trỏ vào `dist/` (`"."` có `types` và `default`); subpath entry point sau này thêm vào cùng map. Consumer khai báo `"@schemaforge/core": "workspace:*"` | Next.js (bundler), NestJS (Node) và Vitest cùng đọc một output ESM; không thêm tool build; declaration map cho phép go to definition tới `src/` | Dùng source trực tiếp qua `transpilePackages`: bản build của backend chạy trên Node, không đọc được file `.ts` của core. tsup: README ghi không còn được bảo trì. tsdown 0.23: chưa tới 1.0, và core không cần bundle. Build cả ESM lẫn CommonJS: không consumer nào cần CommonJS |
| 7 | Build backend | `nest build` với builder mặc định (`tsc`), output ESM trong `dist/` | Theo template ESM của NestJS 12, ít cấu hình nhất | Builder SWC: nhanh hơn nhưng cần `.swcrc` riêng cho output ESM; backend còn nhỏ nên lợi ích không đáng kể |
| 8 | tsconfig dùng chung | `tsconfig.base.json` ở root, mỗi package `extends`. Xem mục [tsconfig](#tsconfig) | Một nơi giữ các option strict mà `typescript.md` yêu cầu | Package `@schemaforge/tsconfig`: thêm một workspace package chỉ để chứa một file |
| 9 | Lint | ESLint 10, một `eslint.config.mjs` ở root, chia cấu hình theo `files`. Gồm typescript-eslint 8 (`strictTypeChecked`, `stylisticTypeChecked`, `projectService`), `@next/eslint-plugin-next`, `eslint-plugin-react-hooks`, `eslint-plugin-import-x` với `eslint-import-resolver-typescript`, `@eslint-community/eslint-plugin-eslint-comments`, `@vitest/eslint-plugin`, `eslint-config-prettier`. Xem mục [Quy tắc được tool kiểm tra](#quy-tắc-được-tool-kiểm-tra) | typescript-eslint chạy trên chính TypeScript compiler, nên rule cần type (floating promise, unsafe any, exhaustive switch) đầy đủ; mọi plugin đã chọn khai báo hỗ trợ ESLint 10 | Oxlint 1.82: lint có type cần TypeScript 7 (xem #3). Biome 2.5: gộp lint và format nhưng không có rule Next.js và không chạy TypeScript compiler. `eslint-config-next`: kéo theo `eslint-plugin-react`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, cả ba chỉ khai báo hỗ trợ tới ESLint 9. ESLint 9: major cũ, ESLint 10 đã ra từ 2026-02 |
| 10 | Format | Prettier 3, cấu hình mặc định (`.prettierrc.json` rỗng để editor nhận ra). Không format Markdown | Chuẩn phổ biến, không phải bàn về style; plugin sắp xếp class Tailwind chính thức chạy trên Prettier; bỏ Markdown vì Prettier căn lại bảng trong `document/`, gây diff lớn | Biome formatter: nhanh hơn nhưng không có plugin Tailwind chính thức |
| 11 | Task Turborepo | Xem mục [Turborepo](#turborepo) | | |
| 12 | Test và coverage | Vitest 5 ở mọi package. Script `test` là `vitest run --coverage`, ngưỡng coverage đặt trong `vitest.config.ts` của từng package, provider `@vitest/coverage-v8`. Xem mục [Test và coverage](#test-và-coverage) | Ngưỡng được kiểm tra ở mọi lần `pnpm test`, local và CI như nhau | Chỉ chạy coverage trong CI bằng script riêng: local xanh mà CI đỏ. Provider istanbul: chậm hơn, v8 là mặc định của Vitest |
| 13 | Validate env backend | `@nestjs/config` với hàm `validate` dùng Zod 4 | Kiểu config suy ra từ schema bằng `z.infer`, không khai báo kiểu hai lần; Zod đã có trong stack (tool của Vercel AI SDK, CG-05) | Joi (ví dụ trong tài liệu NestJS): không suy ra được kiểu. class-validator: phải viết class và kiểu riêng cho env |
| 14 | Tailwind CSS + shadcn/ui | Init ở phần 3 | Theme token và dark mode được thiết kế cùng lúc init shadcn/ui; trang giữ chỗ không cần style | Init ở phần 1: cấu hình theme trước khi có thiết kế, dễ phải làm lại |
| 15 | Health endpoint, Helmet, CORS | Làm ở phần 4, cùng endpoint đầu tiên, guard xác thực, `ValidationPipe` và exception filter | Phần 1 chưa có route nào; CORS cần origin của frontend, là cấu hình của phần 4 | Thêm ngay ở phần 1: code chưa có ai dùng, trái `code-quality.md` |
| 16 | CI | GitHub Actions, một workflow. Kết quả task của Turborepo được cache bằng `actions/cache`. Xem mục [CI](#ci) | Repo nằm trên GitHub; không cần tài khoản hay secret | Vercel Remote Cache: cần tài khoản và token |
| 17 | Git hooks | Không dùng | Typecheck và lint có type chạy trên cả project, quá chậm cho mỗi commit; lint theo file staged bỏ sót lỗi type ở file khác; CI là cổng chặn, và `git.md` đã yêu cầu chạy kiểm tra trước khi commit | lefthook, hoặc husky + lint-staged, chạy Prettier và ESLint trên file staged |
| 18 | File env | Chỉ có `backend/.env.example` với giá trị giả cho `NODE_ENV` và `PORT`. Biến của các phần sau được thêm vào schema Zod và `.env.example` trong cùng thay đổi dùng tới nó | Repo không chứa secret; app từ chối khởi động khi env sai | Khai báo trước `DATABASE_URL`, `GEMINI_API_KEY`...: biến chưa dùng, và nếu bắt buộc thì chặn `pnpm dev` |

### Phiên bản

`package.json` ghi phiên bản với `^` (TypeScript dùng `~`), `pnpm-lock.yaml` khóa bản chính xác.

| Tool | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | 24 LTS | Bản mới nhất lúc viết: 24.21.0 |
| pnpm | 12.4.1 | |
| typescript | 6.0.3 | Xem quyết định #3 |
| next | 16.3.5 | |
| react, react-dom | 19.3.0 | `@types/react`, `@types/react-dom` 19.3.0 |
| @nestjs/core, @nestjs/common, @nestjs/platform-express, @nestjs/testing | 12.0.1 | `@nestjs/cli` 12.0.0, `@nestjs/config` 12.0.0 |
| turbo | 2.10.12 | |
| vitest, @vitest/coverage-v8 | 5.0.0 | Vitest 5 khai báo `vite` là peer dependency, nên cài `vite` 8.3.0 |
| unplugin-swc, @swc/core | 1.6.0, 1.16.2 | Chỉ dùng cho test backend |
| @vitejs/plugin-react, jsdom, @testing-library/react | 6.1.1, 30.0.1, 16.3.3 | `@testing-library/dom` 10.4.2 |
| eslint | 10.10.0 | |
| typescript-eslint | 8.70.0 | |
| eslint-plugin-react-hooks, @next/eslint-plugin-next | 7.1.1, 16.3.5 | |
| eslint-plugin-import-x, eslint-import-resolver-typescript | 4.17.1, 4.4.5 | |
| @eslint-community/eslint-plugin-eslint-comments, @vitest/eslint-plugin | 4.8.1, 1.6.27 | |
| prettier, eslint-config-prettier | 3.9.6, 10.1.8 | |
| zod | 4.6.5 | |
| @types/node | 24.13.4 | Theo major của Node.js |
| tailwindcss | 4.3.3 | Chỉ ghi nhận, cài ở phần 3 |

### tsconfig

`tsconfig.base.json`:

| Option | Giá trị | Vì sao |
|---|---|---|
| `strict` | `true` | `typescript.md` |
| `noUncheckedIndexedAccess` | `true` | `typescript.md` |
| `noImplicitOverride` | `true` | `typescript.md` |
| `noFallthroughCasesInSwitch` | `true` | `typescript.md` |
| `verbatimModuleSyntax` | `true` | Import chỉ dùng cho type bắt buộc viết `import type`; an toàn khi từng file được transpile riêng (Turbopack, SWC) |
| `isolatedModules` | `true` | Như trên |
| `skipLibCheck` | `true` | Không typecheck lại `.d.ts` của dependency |
| `target` | `ES2023` | Node 24 và trình duyệt hiện đại đều hỗ trợ |

Không dùng `baseUrl` (deprecated ở TypeScript 6, bị bỏ ở TypeScript 7). Không package nào nới lỏng option của base.

Mỗi package thêm:

| Package | Option |
|---|---|
| `packages/core` | `module` và `moduleResolution` là `nodenext`; `lib: ["ES2023"]`, không có DOM; `types: []`, không có `@types/node`. Dùng `window`, `document` hay `process` trong core là lỗi type |
| `backend/` | `module` và `moduleResolution` là `nodenext`; `types: ["node"]`; `experimentalDecorators`, `emitDecoratorMetadata` |
| `frontend/` | Các option Next.js yêu cầu: `module: esnext`, `moduleResolution: bundler`, `jsx`, `lib` có DOM, `noEmit`, plugin `next` |

### Quy tắc được tool kiểm tra

| Quy tắc | File rule | Cách enforce |
|---|---|---|
| Strict compiler | `typescript.md` | `tsconfig.base.json` |
| Không `any` | `typescript.md` | `@typescript-eslint/no-explicit-any` và nhóm `no-unsafe-*` |
| Không `as` cast, không non-null `!` (vẫn cho `as const`, `satisfies`) | `typescript.md` | `@typescript-eslint/consistent-type-assertions` với `assertionStyle: "never"`, `@typescript-eslint/no-non-null-assertion` |
| Không `@ts-ignore`; `@ts-expect-error` phải có lý do | `typescript.md` | `@typescript-eslint/ban-ts-comment` |
| Hàm export khai báo kiểu trả về | `typescript.md` | `@typescript-eslint/explicit-module-boundary-types` |
| Mặc định dùng `type` | `typescript.md` | `@typescript-eslint/consistent-type-definitions` với `"type"` |
| `switch` trên union phải đủ nhánh | `typescript.md` | `@typescript-eslint/switch-exhaustiveness-check` |
| Không dùng từ khóa `enum` | `typescript.md` | `no-restricted-syntax` chặn `TSEnumDeclaration` |
| Chỉ named export, trừ file framework | `typescript.md` | `import-x/no-default-export`, tắt cho `page`, `layout`, `loading`, `error`, `not-found` trong `frontend/src/app/` và file `*.config.*` |
| `import type` cho import chỉ dùng type | `typescript.md` | `@typescript-eslint/consistent-type-imports` và `verbatimModuleSyntax` |
| Không import vòng | `typescript.md` | `import-x/no-cycle` |
| Import package khác bằng tên, không bằng đường dẫn tương đối | `typescript.md` | `import-x/no-relative-packages` |
| Boolean bắt đầu bằng `is`, `has`, `can`, `should`; không tiền tố `I`, `T`; `PascalCase` cho type | `typescript.md` | `@typescript-eslint/naming-convention` |
| Không floating promise; chỉ throw `Error` | `typescript.md` | `@typescript-eslint/no-floating-promises`, `no-misused-promises`, `only-throw-error`, `prefer-promise-reject-errors` |
| Không `console` | `code-quality.md` | `no-console` |
| Lồng tối đa 3 cấp | `code-quality.md` | `max-depth` với 3 |
| Tắt rule inline phải có lý do | `code-quality.md` | `@eslint-community/eslint-comments/require-description`; `linterOptions.reportUnusedDisableDirectives: "error"` |
| Không để biến, import không dùng | `code-quality.md` | `@typescript-eslint/no-unused-vars` |
| Rules of Hooks, dependency array đầy đủ | `react.md` | `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps` ở mức `error` |
| Dùng đúng API có sẵn của Next.js (`next/link`, `next/image`...) | `nextjs.md` | `@next/next` bộ `recommended` và `core-web-vitals` |
| Không đọc `process.env` ngoài module config | `nextjs.md`, `nestjs.md` | `no-restricted-properties` chặn `process.env`, trừ `frontend/src/lib/env.ts` và `backend/src/config/**` |
| Core không import React, Next.js, NestJS, Prisma hay module Node | `core.md` | `no-restricted-imports` trong `packages/core`: `react`, `react-dom`, `next`, `@nestjs/*`, `@prisma/*`, `prisma`, `node:*` và module built-in như `fs`, `path` |
| Core không dùng global của trình duyệt, Node, mạng, timer | `core.md` | `no-restricted-globals` trong `packages/core`: `window`, `document`, `localStorage`, `sessionStorage`, `navigator`, `fetch`, `process`, `Buffer`, `setTimeout`, `setInterval`; thêm tsconfig của core không có DOM và `@types/node` |
| Không `dangerouslySetInnerHTML` | `security.md` | `no-restricted-syntax` chặn thuộc tính JSX này trong `frontend/` |
| Không commit test bị skip hoặc focus | `testing.md` | `vitest/no-disabled-tests`, `vitest/no-focused-tests` |
| Ngưỡng coverage | `testing.md` | `coverage.thresholds` trong Vitest |
| Format | `code-quality.md` | Prettier, kiểm tra bằng `pnpm format:check` |

Chưa kiểm tra bằng tool, vẫn dựa vào review: tên file `kebab-case`, độ dài hàm và file, logic thuần và truyền dependency, không mutate tham số, comment giải thích lý do. Lint cho chuỗi hardcode (i18n) và accessibility được chọn ở phần 3.

### Turborepo

`turbo.json`:

| Task | `dependsOn` | Cache | `outputs` |
|---|---|---|---|
| `build` | `^build` | Có | `dist/**`; frontend: `.next/**`, trừ `.next/cache/**` |
| `typecheck` | `^build` | Có | Không có |
| `lint` | `^build` | Có; `inputs` thêm `$TURBO_ROOT$/eslint.config.mjs` | Không có |
| `test` | `^build` | Có | `coverage/**` |
| `dev` | `^build` | Không (`cache: false`, `persistent: true`) | Không có |

- Mọi task phụ thuộc `^build` vì frontend và backend đọc `dist/` và `.d.ts` của core. Build của core được cache nên chạy lại gần như không tốn thời gian.
- `tsconfig.base.json` nằm trong `globalDependencies`, nên đổi base config làm mất cache của mọi task.
- Kiểm tra format không phải task Turborepo: `prettier --check .` chạy một lần trên cả repo, gồm cả file ở root không thuộc package nào.

Script trong từng package:

| Script | `packages/core` | `frontend/` | `backend/` |
|---|---|---|---|
| `build` | `tsc -p tsconfig.build.json` | `next build` | `nest build` |
| `dev` | `tsc -p tsconfig.build.json --watch --preserveWatchOutput` | `next dev`, cổng 3000 | `nest start --watch`, cổng 3001 |
| `start` | Không có | Không có | `node dist/main.js` |
| `lint` | `eslint .` | `eslint .` | `eslint .` |
| `typecheck` | `tsc --noEmit` | `next typegen && tsc --noEmit` | `tsc --noEmit` |
| `test` | `vitest run --coverage` | `vitest run --coverage` | `vitest run --coverage` |

### Test và coverage

| Package | Môi trường | File test | Ngưỡng (line coverage) | File được tính coverage |
|---|---|---|---|---|
| `packages/core` | node | `src/**/*.test.ts` | 90% | `src/**/*.ts` |
| `frontend/` | jsdom, `@vitejs/plugin-react`, React Testing Library | `src/**/*.test.{ts,tsx}` | 80% | File logic: `src/lib/**`, hook `use-*.ts`. Phần 3 thêm glob cho store |
| `backend/` | node, `unplugin-swc` | `src/**/*.spec.ts` | 80% | `*.service.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.pipe.ts`, `*.filter.ts`, `*.repository.ts`, `src/config/**` |

- Test import `describe`, `it`, `expect` từ `vitest`; không bật `globals`.
- Ngưỡng có hiệu lực từ phần 1. Khi xuất hiện loại file logic mới, phần đó thêm glob trong cùng thay đổi.

## Cấu trúc thư mục sau scaffold

```text
SchemaForge/
  .github/workflows/ci.yml
  .gitignore                  thêm next-env.d.ts
  .nvmrc
  .prettierignore
  .prettierrc.json
  eslint.config.mjs
  package.json                name: schemaforge, packageManager, engines, script ở root
  pnpm-lock.yaml
  pnpm-workspace.yaml         packages, catalog, allowBuilds
  tsconfig.base.json
  turbo.json
  CLAUDE.md
  document/
  packages/core/
    package.json
    tsconfig.json
    tsconfig.build.json
    vitest.config.ts
    src/
      index.ts
      index.test.ts
  frontend/
    next.config.ts
    package.json
    tsconfig.json
    vitest.config.ts
    src/app/
      layout.tsx
      page.tsx
      page.test.tsx
  backend/
    .env.example
    nest-cli.json
    package.json
    tsconfig.json
    tsconfig.build.json
    vitest.config.ts
    src/
      main.ts
      app.module.ts
      config/
        env.ts
        env.spec.ts
```

### Nội dung tối thiểu của từng package

**`packages/core`**

- `src/index.ts` export `PRODUCT_NAME = "SchemaForge"`. Đây là export giữ chỗ để chứng minh đường nối; phần 2 thay bằng API thật và sửa các nơi đang dùng.
- `src/index.test.ts` kiểm tra export đó.

**`frontend/`**

- `src/app/layout.tsx`: layout tối thiểu, `metadata.title` lấy từ `PRODUCT_NAME`.
- `src/app/page.tsx`: Server Component render `<h1>` chứa `PRODUCT_NAME`. Tên sản phẩm không cần dịch, nên trang không có chuỗi phải đưa vào i18n.
- `src/app/page.test.tsx`: render trang và tìm heading theo role.
- Chưa tạo `features/`, `components/`, `lib/`; thư mục được tạo khi có file đầu tiên.
- `next-env.d.ts` do `next typegen` sinh ra nên thêm vào `.gitignore`.

**`backend/`**

- `src/config/env.ts`: schema Zod gồm `NODE_ENV` (`development`, `test` hoặc `production`, mặc định `development`) và `PORT` (số nguyên dương, mặc định 3001), cùng hàm `validate`. Env sai thì app không khởi động.
- `src/config/env.spec.ts`: test giá trị hợp lệ, giá trị mặc định và giá trị sai.
- `src/app.module.ts`: `ConfigModule.forRoot({ isGlobal: true, validate })`.
- `src/main.ts`: tạo app, lấy `PORT` từ config đã validate, dùng `Logger` ghi một dòng có `PRODUCT_NAME` import từ core và cổng đang lắng nghe.
- Không có controller hay service mẫu của Nest CLI.

## Lệnh ở root

| Lệnh | Chạy | Việc |
|---|---|---|
| `pnpm install` | pnpm | Cài dependency cho cả workspace |
| `pnpm dev` | `turbo run dev` | Core ở chế độ watch, frontend ở cổng 3000, backend ở cổng 3001 |
| `pnpm build` | `turbo run build` | Build mọi package theo thứ tự phụ thuộc |
| `pnpm lint` | `turbo run lint` | ESLint từng package |
| `pnpm typecheck` | `turbo run typecheck` | TypeScript từng package |
| `pnpm test` | `turbo run test` | Vitest kèm ngưỡng coverage |
| `pnpm format` | `prettier --write .` | Format cả repo |
| `pnpm format:check` | `prettier --check .` | Kiểm tra format, dùng trong CI |

Chạy cho một package: `pnpm --filter @schemaforge/core test`.

## CI

File `.github/workflows/ci.yml`:

- Chạy khi `push` lên `master` và khi có `pull_request`.
- `permissions: contents: read`. `concurrency` hủy run cũ của cùng một branch.
- Một job trên `ubuntu-latest`:
  1. `actions/checkout@v7`
  2. `pnpm/action-setup@v6`, đọc phiên bản từ `packageManager`
  3. `actions/setup-node@v7` với `node-version-file: .nvmrc` và `cache: pnpm`
  4. `pnpm install --frozen-lockfile`
  5. `pnpm format:check`
  6. `actions/cache@v6` cho `.turbo/cache`, key theo commit SHA, khôi phục theo prefix
  7. `pnpm turbo run lint typecheck test build`

pnpm store được cache qua `setup-node`, kết quả task qua cache của Turborepo. Nhờ vậy commit chỉ sửa frontend không chạy lại lint và test của core.

## Điểm nối với các phần sau

| Phần | Cắm vào đâu |
|---|---|
| 2. Core schema model | `packages/core/src/`; subpath entry point thêm vào `exports`; thay `PRODUCT_NAME` giữ chỗ |
| 3. Editor MVP | `frontend/src/features/`, `components/`, `lib/`; init Tailwind CSS + shadcn/ui; i18next, Zustand, React Flow, Dexie; lint cho i18n và accessibility; glob coverage cho store; chọn tool test e2e cho `frontend/e2e/` |
| 4. Auth + lưu cloud | `backend/src/prisma/`, `prisma generate` trước `build` và `typecheck` của backend, thêm Prisma vào `allowBuilds`; biến `DATABASE_URL` và secret của auth trong schema env; Helmet, CORS, `ValidationPipe`, exception filter, guard; e2e trong `backend/test/`; PostgreSQL cho CI; `frontend/src/lib/env.ts` và `NEXT_PUBLIC_*` trong `env` của task `build` |
| 5. AI Assistant | `GEMINI_API_KEY`, `GEMINI_MODEL` trong schema env và `.env.example` của backend |

## Rủi ro cần kiểm tra khi triển khai

- **`unplugin-swc` trên Vite 8.** Vitest 5 chạy trên Vite 8, còn template ESM của NestJS 12 chạy Vitest không có `unplugin-swc`. Spec giữ `unplugin-swc` theo `architecture.md`. Plan phải xác nhận test có dependency injection của Nest chạy đúng. Nếu plugin tỏ ra thừa, đề xuất bỏ trong một thay đổi riêng và cập nhật `architecture.md`.
- **`consistent-type-imports` với `emitDecoratorMetadata`.** Class được inject qua constructor phải là import giá trị. Plan phải xác nhận lint không tự sửa các import này thành `import type`.

## Tiêu chí hoàn thành

- [ ] Trong repo, `node -v` cho 24.x và `pnpm -v` cho 12.4.1.
- [ ] Từ bản clone sạch, `pnpm install --frozen-lockfile` chạy qua và không còn cảnh báo build script bị chặn mà chưa xử lý trong `allowBuilds`.
- [ ] Ở root, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` và `pnpm build` đều chạy qua.
- [ ] Chạy lại `pnpm turbo run lint typecheck test build` khi không có thay đổi thì mọi task lấy từ cache (`FULL TURBO`).
- [ ] `pnpm dev` chạy core ở chế độ watch; `http://localhost:3000` hiển thị heading "SchemaForge"; backend ghi log có "SchemaForge" và cổng 3001.
- [ ] Sau `pnpm build`, `pnpm --filter @schemaforge/backend start` khởi động và ghi log có `PRODUCT_NAME` lấy từ core, chứng minh bản build ESM đọc được core.
- [ ] Backend từ chối khởi động và báo lỗi validate khi `PORT=abc`.
- [ ] `frontend/src/app/page.tsx` và `backend/src/main.ts` import từ `@schemaforge/core`; không có import tương đối vào `packages/core/src`.
- [ ] Tool bắt được vi phạm. Kiểm tra bằng thay đổi tạm, không commit:
  - Trong core, import `react` hoặc dùng `window` làm `pnpm lint` fail; dùng `window` làm `pnpm typecheck` fail.
  - Promise không `await`, `console.log`, `any`, hoặc default export ngoài file framework làm `pnpm lint` fail.
  - Thêm vào core một hàm không có test, kéo coverage dưới 90%, làm `pnpm test` fail.
- [ ] CI xanh trên GitHub cho commit trên `master` và cho pull request.
- [ ] Repo chỉ có `backend/.env.example`, không commit file `.env` nào.
- [ ] Trong lúc triển khai, `CLAUDE.md` được cập nhật mục "Current status" và danh sách lệnh. Khi xong, `roadmap.md` chuyển phần 1 sang "Xong". Quyết định nào thay đổi thì cập nhật `architecture.md`.

## Câu hỏi còn mở

| # | Câu hỏi |
|---|---|
| 1 | Máy dev đang dùng Node 22.18.0. Spec chọn Node 24 LTS, nên cần cài Node 24 trước khi triển khai (ví dụ `nvm install 24`). Có đồng ý không? Nếu muốn ở lại Node 22 thì cũng phải nâng lên từ 22.22.2 cho jsdom 30, và Node 22 hết hỗ trợ ngày 2027-04-30. |
