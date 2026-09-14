# Plan: Scaffold & tooling

Plan triển khai phần 1 trong [roadmap.md](../roadmap.md), dựa trên spec đã duyệt [2026-09-14-scaffold-tooling-design.md](../specs/2026-09-14-scaffold-tooling-design.md). Spec là nguồn gốc. Plan chia spec thành các task có thứ tự, kèm nội dung cấu hình cụ thể và cách kiểm tra.

## Mục tiêu

Dựng monorepo pnpm + Turborepo gồm `packages/core`, `frontend/` (Next.js) và `backend/` (NestJS). Build, lint, typecheck, test, format và CI đều chạy qua, và các quy tắc trong `.claude/rules/` được tool kiểm tra. Đây là nền cho Visual Schema Editor ở các phần sau.

## Điều kiện tiên quyết

- Node.js 24 LTS, tối thiểu 24.15.0 (jsdom 30 yêu cầu). Orchestrator cùng user cài trước khi bắt đầu; plan không tự cài Node.
- pnpm 12.4.1, lấy từ trường `packageManager`: qua corepack (`corepack enable`), hoặc để bản pnpm đang cài tự chuyển phiên bản. Khi lập plan, pnpm 11.7.0 trên máy dev đã tự tải và chạy 12.4.1 khi gặp `packageManager`.
- Working tree sạch, đang ở branch `master`.

## Cách dùng plan

- Mỗi task giao cho một subagent chưa đọc spec. Prompt của subagent gồm mục "Quy ước chung", toàn bộ nội dung task và đường dẫn spec.
- Subagent không commit, không push. Orchestrator kiểm tra kết quả rồi commit đúng các file của task với commit message ghi trong task, theo `.claude/rules/git.md`: một dòng, không body, không trailer.
- Push và mọi thao tác trên GitHub cần user đồng ý (Task 10).

### Quy ước chung cho mọi task

- Đọc `CLAUDE.md`, spec, và file rule liên quan trong `.claude/rules/` trước khi viết file.
- Dùng đúng phiên bản trong mục "Phiên bản" của spec. Không đổi quyết định của spec. Gặp chỗ không chạy được thì dừng và báo orchestrator kèm output.
- Code, config, comment và commit message viết tiếng Anh.
- Chạy lệnh từ root repo, trừ khi task ghi khác.
- Chỉ tạo và sửa file mà task liệt kê. Cần sửa file khác, nhất là config ở root, thì dừng và báo.
- **Quy tắc lockfile.** Chỉ Task 2 được chạy `pnpm install` trong repo. Không task nào khác chạy `pnpm install`, `pnpm add`, `pnpm remove` hay `pnpm update` trong repo. Thiếu dependency thì dừng và báo; orchestrator mở một task sửa riêng và chạy nó khi không có task nào khác đang chạy. Task 8 và 9 chỉ chạy `pnpm install --frozen-lockfile` trong bản clone nằm ngoài repo.
- ESM: import tương đối trong `packages/core` và `backend/` phải có đuôi `.js` (ví dụ `./env.js`) vì `moduleResolution` là `nodenext`. Frontend dùng `bundler` nên không cần đuôi.
- Không để lại file tạm. Khi kết thúc task, `git status --porcelain` chỉ còn các file của task.
- Báo cáo gồm: file đã tạo hoặc sửa, lệnh đã chạy kèm kết quả chính, vấn đề còn mở.

## Thứ tự và nhóm song song

| Task | Nội dung | Phụ thuộc | Nhóm | Commit |
|---|---|---|---|---|
| 1 | Kiểm tra toolchain | — | Tuần tự | Không |
| 2 | Workspace root, khai báo mọi dependency, lockfile | 1 | Tuần tự | Có |
| 3 | ESLint và Prettier | 2 | Tuần tự | Có |
| 4 | `packages/core` | 3 | Tuần tự | Có |
| 5 | `frontend/` | 4 | A | Có |
| 6 | `backend/` | 4 | A | Có |
| 7 | CI workflow | 3 | A | Có |
| 8 | Kiểm tra tích hợp toàn repo | 5, 6, 7 đã commit | Tuần tự | Không |
| 9 | Kiểm tra tool bắt vi phạm | 8 | Tuần tự | Không |
| 10 | Cập nhật tài liệu, push, CI xanh | 9 | Tuần tự | Có |

Lý do chia như trên:

- **Task 2 cài một lần cho cả repo.** Task 2 khai báo dependency của cả bốn `package.json` rồi chạy `pnpm install` một lần duy nhất, nên `pnpm-lock.yaml` chỉ được ghi ở Task 2.
- **Task 3 và 4 tuần tự.** Task 4 cần `eslint.config.mjs` để lint, còn frontend và backend cần `packages/core/dist`.
- **Nhóm A chạy song song được.** Task 5, 6, 7 sửa ba vùng file rời nhau (`frontend/`, `backend/`, `.github/`), với ba điều kiện:
  - Không build lại core. Task 4 để lại `packages/core/dist`. Task 5 và 6 chạy script bằng `pnpm --filter <package> <script>`, không qua `pnpm turbo`, để hai task không cùng ghi vào `packages/core/dist`.
  - Chỉ kiểm tra format trên thư mục của mình (ví dụ `pnpm exec prettier --check frontend`), không chạy trên cả repo.
  - Task 5 dùng cổng 3000, Task 6 dùng cổng 3001.
- **Task 7 bắt đầu sớm được.** Task 7 chỉ viết một file YAML, nên có thể bắt đầu ngay sau Task 3.
- **Task 8 cần mọi thứ đã commit** vì nó kiểm tra trên bản clone sạch.

## Đã kiểm chứng khi lập plan

Cấu hình trong plan đã được dựng thử trong một monorepo tạm ngoài repo, với đúng phiên bản của spec, trên Node 22.18.0 và pnpm 12.4.1 (máy chưa có Node 24):

- **Build script:** `pnpm install` bị chặn bởi `ERR_PNPM_IGNORED_BUILDS` cho `@swc/core` và `unrs-resolver` cho tới khi hai package này được khai báo trong `allowBuilds`. Không package nào khác có build script.
- **Cài từ bản sạch:** `pnpm install --frozen-lockfile` trên bản copy sạch chạy qua, không có cảnh báo.
- **Build và kiểm tra:** build, typecheck, lint và test của cả ba package đều chạy qua. `pnpm turbo run lint typecheck test build` lần thứ hai cho `Cached: 12 cached, 12 total` và `FULL TURBO`.
- **`pnpm dev`:** core chạy watch, `http://localhost:3000` trả về `<h1>SchemaForge</h1>`, backend ghi log `SchemaForge backend listening on port 3001`.
- **Backend sau build:** `node dist/main.js` đọc được `dist/` của core. Với `PORT=abc`, backend thoát mã 1 và báo lỗi Zod ở `PORT`.
- **Tsconfig frontend:** `next build` và `next dev` không sửa `frontend/tsconfig.json` của plan.
- **Rule lint:** mọi rule trong bảng "Quy tắc được tool kiểm tra" của spec đều báo lỗi với ví dụ vi phạm (xem Task 9).
- **Hai rủi ro của spec:** xem Task 6.

Task 8 chạy lại mọi thứ trên Node 24 và là kết quả cuối cùng.

## Vấn đề phát hiện khi lập plan

1. **Bảng "Phiên bản" thiếu `reflect-metadata` và `rxjs`.**
   - Hai package này là peer dependency bắt buộc của `@nestjs/core` và `@nestjs/common` 12. Template ESM của `@nestjs/schematics` 12 cũng khai báo chúng.
   - Plan dùng `reflect-metadata` `^0.2.2` và `rxjs` `^7.8.2`, là bản mới nhất theo `npm view` ngày 2026-09-14.
   - Đề xuất: bổ sung hai dòng này vào bảng "Phiên bản" của spec. Không có quyết định nào thay đổi.

2. **`unplugin-swc` có vẻ thừa với Vitest 5 + Vite 8.**
   - Với service inject `ConfigService` qua constructor và test bằng `Test.createTestingModule`, test pass khi không có plugin và không có option `oxc`.
   - Đối chứng: bỏ `emitDecoratorMetadata` khỏi `backend/tsconfig.json` thì test fail, cả khi có lẫn không có plugin. Khôi phục option thì test pass mà không cần plugin.
   - Như vậy Vite 8 (Rolldown/Oxc) tự đọc `experimentalDecorators` và `emitDecoratorMetadata` từ tsconfig. Template ESM của NestJS 12 cũng chạy Vitest mà không có plugin này.
   - Đề xuất: plan vẫn giữ `unplugin-swc` như spec và `architecture.md`; Task 6 chạy lại phép thử trên Node 24. Nếu kết quả giống, orchestrator hỏi user. Nếu user đồng ý, làm một thay đổi riêng sau phần 1:
     - bỏ `unplugin-swc` và `@swc/core` khỏi `backend/package.json`
     - bỏ `@swc/core` khỏi `allowBuilds`
     - bỏ `plugins` trong `backend/vitest.config.ts`
     - cập nhật lockfile
     - sửa dòng "Test runner" trong `architecture.md`
     - commit gợi ý: `build(backend): drop unplugin-swc from vitest setup`
   - Nếu user quyết định trước Task 2, có thể không khai báo hai package này từ đầu. Khi đó `allowBuilds` chỉ còn `unrs-resolver`, và Task 6 không cần bước kiểm tra plugin.

3. **Dùng `process` hoặc `setTimeout` trong core không bị `pnpm typecheck` bắt.**
   - Spec (mục tsconfig) ghi rằng dùng `window`, `document` hay `process` trong core là lỗi type. Khi thử, `window` và `document` báo lỗi với `tsc --noEmit`, còn `process` và `setTimeout` thì không.
   - Nguyên nhân có thể: `tsconfig.json` của core có file test và `vitest.config.ts`, và kiểu của Vitest (qua Vite) kéo `@types/node` vào chương trình.
   - Với `tsconfig.build.json` (không có test), cả hai báo lỗi, nên `pnpm build` fail. `pnpm lint` cũng bắt được qua `no-restricted-globals`.
   - Tiêu chí hoàn thành không bị ảnh hưởng vì tiêu chí chỉ yêu cầu `window` làm typecheck fail.
   - Đề xuất: giữ script như spec và sửa câu trong spec thành "`window`, `document` là lỗi type; `process` và timer bị lint và build bắt". Nếu user muốn typecheck bắt cả `process`, đổi script `typecheck` của core thành `tsc --noEmit && tsc -p tsconfig.build.json --noEmit`.

4. **Rule của `@next/eslint-plugin-next` phần lớn ở mức `warn`.**
   - Trong preset `recommended` và `core-web-vitals`, `no-img-element`, `no-css-tags`, `google-font-display` và nhiều rule khác ở mức `warn`. ESLint thoát mã 0 khi chỉ có warning, nên `pnpm lint` không chặn được vi phạm.
   - Plan nâng mọi rule `@next/next/*` lên `error`. Plan tắt `@next/next/no-html-link-for-pages`, vì rule này chỉ kiểm tra thư mục `pages/` (dự án chỉ dùng App Router) và in "Pages directory cannot be found" ở mỗi lần lint.
   - Quyết định của spec không đổi (vẫn là preset `recommended` và `core-web-vitals`); orchestrator xác nhận với user.

5. **`next dev` 16.3 tự sinh `frontend/AGENTS.md` và `frontend/CLAUDE.md`.**
   - `frontend/AGENTS.md` chứa khối "This is NOT the Next.js you know", trỏ tới `node_modules/next/dist/docs/`. `frontend/CLAUDE.md` chỉ chứa `@AGENTS.md`.
   - Log ghi: "Set `agentRules: false` in next.config to disable". File bị tạo lại mỗi lần chạy dev nếu chưa commit.
   - Spec không nhắc tới việc này. Plan mặc định đặt `agentRules: false` trong `frontend/next.config.ts`, vì quy ước cho agent của repo nằm ở `CLAUDE.md` gốc và `.claude/rules/`.
   - Phương án khác: commit hai file (Claude Code sẽ nạp `frontend/CLAUDE.md` khi làm việc trong `frontend/`), hoặc thêm vào `.claude/rules/nextjs.md` một dòng trỏ tới tài liệu Next.js trong `node_modules/next/dist/docs/`.
   - User cần chọn trước Task 5.

6. **pnpm 12 tự ghi thêm vào `pnpm-workspace.yaml`.**
   - `minimumReleaseAge` mặc định là 1440 phút. Phiên bản phát hành chưa đủ 24 giờ được pnpm tự thêm vào `minimumReleaseAgeExclude`.
   - `zod@4.6.5` phát hành lúc 2026-09-13 23:25 UTC, `@testing-library/dom@10.4.2` lúc 2026-09-13 18:08 UTC. Cài trước khoảng 2026-09-14 23:30 UTC thì pnpm thêm khối này; spec chỉ liệt kê `packages`, `catalog` và `allowBuilds`.
   - Đề xuất: chạy Task 2 sau thời điểm đó. Nếu phải chạy sớm hơn, giữ khối pnpm đã ghi (nếu thiếu, CI có thể từ chối lockfile) và xóa nó trong một commit `build:` riêng khi đã đủ 24 giờ.

## Task 1: Kiểm tra toolchain

**Mục tiêu:** xác nhận máy dùng Node.js 24 từ 24.15.0 và chạy được pnpm 12.4.1, trước khi tạo file nào.

**Phụ thuộc:** không có.

**File:** không tạo, không sửa.

**Các bước và kết quả mong đợi:**

```bash
node -v
# v24.x.y, với x.y từ 15.0 trở lên (ví dụ v24.21.0)

git status --porcelain
# không in dòng nào
git branch --show-current
# master

# Kiểm tra pnpm đọc packageManager, trong một thư mục tạm ngoài repo (scratchpad của agent)
mkdir -p "<scratchpad>/pnpm-check" && cd "<scratchpad>/pnpm-check"
printf '{ "packageManager": "pnpm@12.4.1" }\n' > package.json
pnpm -v
# 12.4.1
```

Nếu không có lệnh `pnpm`, chạy `corepack enable` rồi thử lại (Node 24 có sẵn corepack).

**Dừng khi sai.** Nếu `node -v` không phải 24.x từ 24.15.0, dừng và báo nguyên văn:

> Toolchain không đúng: Node.js hiện tại là `<output của node -v>`, spec yêu cầu Node.js 24 LTS từ 24.15.0. Cần cài Node 24 (ví dụ `nvm install 24 && nvm use 24`) rồi chạy lại Task 1.

Nếu `pnpm -v` trong thư mục tạm không ra `12.4.1`, dừng và báo output của `pnpm -v`, `which pnpm` và `corepack --version`.

`engines.node` trong `package.json` không chặn được Node sai: pnpm mặc định không bật `engineStrict`, và khi thử `pnpm install` với `^24.15.0` trên Node 22.18.0 thì vẫn chạy qua. Task này là chốt chặn duy nhất.

**Commit:** không.

## Task 2: Workspace root và dependency

**Mục tiêu:** repo là pnpm workspace gồm bốn project, mọi dependency của phần 1 đã được khai báo và cài, `pnpm-lock.yaml` đã được tạo, và Turborepo đọc được `turbo.json`.

**Phụ thuộc:** Task 1.

**File tạo:** `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.base.json`, `turbo.json`, `packages/core/package.json`, `frontend/package.json`, `backend/package.json`, `pnpm-lock.yaml` (do `pnpm install` sinh).

**File sửa:** `.gitignore`: thêm dòng `next-env.d.ts` vào mục `# Build output`.

Task này không tạo source, tsconfig của package hay config lint. Giữ nguyên `README.md` trong ba thư mục package.

**`package.json`** (root):

```json
{
  "name": "schemaforge",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.4.1",
  "engines": {
    "node": "^24.15.0"
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "@eslint-community/eslint-plugin-eslint-comments": "^4.8.1",
    "@next/eslint-plugin-next": "^16.3.5",
    "@vitest/eslint-plugin": "^1.6.27",
    "eslint": "^10.10.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-import-resolver-typescript": "^4.4.5",
    "eslint-plugin-import-x": "^4.17.1",
    "eslint-plugin-react-hooks": "^7.1.1",
    "prettier": "^3.9.6",
    "turbo": "^2.10.12",
    "typescript": "catalog:",
    "typescript-eslint": "^8.70.0"
  }
}
```

**`pnpm-workspace.yaml`:**

```yaml
packages:
  - packages/*
  - frontend
  - backend

catalog:
  "@types/node": ^24.13.4
  "@vitest/coverage-v8": ^5.0.0
  typescript: ~6.0.3
  vite: ^8.3.0
  vitest: ^5.0.0

allowBuilds:
  "@swc/core": true
  unrs-resolver: true
```

- **`catalog`** chỉ chứa dependency dùng ở từ hai package trở lên. `eslint`, các plugin lint, `prettier` và `turbo` chỉ khai báo ở root. pnpm thêm `node_modules/.bin` của root vào `PATH` khi chạy script của package, nên `eslint .` chạy được trong từng package (đã kiểm chứng).
- **`allowBuilds`** liệt kê đúng hai package có build script trong cây dependency. Cả hai postinstall chỉ kiểm tra binary native: `@swc/core` được `unplugin-swc` dùng, `unrs-resolver` được `eslint-plugin-import-x` và resolver TypeScript dùng.
- pnpm 12 báo lỗi khi file này có setting không hợp lệ, nên không thêm key nào khác.

pnpm 12 có thể tự sửa file này khi cài:

- **Build script chưa khai báo.** pnpm thêm key vào `allowBuilds` với giá trị giữ chỗ `set this to true or false` và thoát với `ERR_PNPM_IGNORED_BUILDS`. Nếu điều này xảy ra với package khác ngoài hai package trên, không tự duyệt mà dừng và báo orchestrator. Không thêm khối `allowBuilds` thứ hai, vì YAML trùng key làm pnpm lỗi.
- **Phiên bản chưa đủ 24 giờ.** pnpm thêm khối `minimumReleaseAgeExclude` (xem vấn đề 6). Nếu khối này xuất hiện, báo orchestrator trước khi commit.

**`.nvmrc`:**

```text
24
```

**`tsconfig.base.json`:**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "target": "ES2023"
  }
}
```

Không dùng `baseUrl`.

**`turbo.json`:**

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/eslint.config.mjs"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    }
  }
}
```

- `build.outputs` gom output của cả ba package vào một khai báo ở root: `dist/**` cho core và backend, `.next/**` trừ `.next/cache/**` cho frontend. Output không tồn tại ở một package thì Turborepo bỏ qua.
- Link `$schema` cũ `https://turborepo.com/schema.json` giờ chuyển hướng tới `https://turborepo.dev/schema.json`.

**`packages/core/package.json`:**

```json
{
  "name": "@schemaforge/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

**`frontend/package.json`:**

```json
{
  "name": "@schemaforge/frontend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "next build",
    "dev": "next dev --port 3000",
    "lint": "eslint .",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run --coverage"
  },
  "dependencies": {
    "@schemaforge/core": "workspace:*",
    "next": "^16.3.5",
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.2",
    "@testing-library/react": "^16.3.3",
    "@types/node": "catalog:",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "@vitest/coverage-v8": "catalog:",
    "jsdom": "^30.0.1",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

Frontend cần `@types/node` vì Next.js kiểm tra package này có tồn tại hay không khi dùng TypeScript.

**`backend/package.json`:**

```json
{
  "name": "@schemaforge/backend",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage"
  },
  "dependencies": {
    "@nestjs/common": "^12.0.1",
    "@nestjs/config": "^12.0.0",
    "@nestjs/core": "^12.0.1",
    "@nestjs/platform-express": "^12.0.1",
    "@schemaforge/core": "workspace:*",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@nestjs/cli": "^12.0.0",
    "@nestjs/testing": "^12.0.1",
    "@swc/core": "^1.16.2",
    "@types/node": "catalog:",
    "@vitest/coverage-v8": "catalog:",
    "typescript": "catalog:",
    "unplugin-swc": "^1.6.0",
    "vite": "catalog:",
    "vitest": "catalog:"
  }
}
```

Backend không cần `dev` chỉ định cổng, vì cổng 3001 là giá trị mặc định trong schema env (Task 6).

**Các bước:**

1. Tạo và sửa các file trên.
2. Chạy `pnpm install`.
3. Chạy `pnpm exec prettier --check package.json pnpm-workspace.yaml turbo.json tsconfig.base.json packages/core/package.json frontend/package.json backend/package.json`. Nếu có file lỗi, chạy lại lệnh với `--write`. Cấu hình mặc định của Prettier giống `.prettierrc.json` rỗng của Task 3.

**Kiểm tra:**

```bash
pnpm -v
# 12.4.1
pnpm install
# exit 0; có "@swc/core postinstall: Done" và "unrs-resolver postinstall: Done"; không có "Ignored build scripts"
pnpm install --frozen-lockfile
# exit 0; "Lockfile is up to date" hoặc "Already up to date"
pnpm ls -r --depth -1
# liệt kê schemaforge, @schemaforge/core, @schemaforge/frontend, @schemaforge/backend
pnpm turbo --version
# 2.10.12
pnpm turbo run lint typecheck test build --dry
# không báo lỗi cấu hình; liệt kê bốn task cho mỗi package trong ba package
git status --porcelain
# chỉ các file trong danh sách; không có node_modules
```

**Commit:** `build: set up pnpm workspace and turborepo`

## Task 3: ESLint và Prettier

**Mục tiêu:** một file `eslint.config.mjs` ở root enforce các quy tắc trong bảng "Quy tắc được tool kiểm tra" của spec. Prettier chạy với cấu hình mặc định và bỏ qua Markdown cùng lockfile.

**Phụ thuộc:** Task 2.

**File tạo:** `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`.

**`.prettierrc.json`:**

```json
{}
```

**`.prettierignore`:**

```text
pnpm-lock.yaml
*.md
```

Prettier 3 đọc thêm `.gitignore`, nên `dist`, `.next`, `coverage`, `.turbo` và `next-env.d.ts` đã được bỏ qua.

**`eslint.config.mjs`** (nội dung đầy đủ, đã kiểm chứng):

```js
import { builtinModules } from "node:module";

import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import nextPlugin from "@next/eslint-plugin-next";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier/flat";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const NO_ENUM = {
  selector: "TSEnumDeclaration",
  message:
    "Use a string literal union or an `as const` object instead of `enum`.",
};

const NO_DANGEROUS_HTML = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message:
    "Do not use dangerouslySetInnerHTML (see .claude/rules/security.md).",
};

const CORE_BOUNDARY =
  "packages/core must stay framework-free and isomorphic (see .claude/rules/core.md).";

const CORE_FORBIDDEN_GLOBALS = [
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "navigator",
  "fetch",
  "process",
  "Buffer",
  "setTimeout",
  "setInterval",
];

export default defineConfig([
  globalIgnores(["**/dist/", "**/.next/", "**/coverage/", "**/next-env.d.ts"]),
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      comments.recommended,
      importX.flatConfigs.typescript,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "import-x": importX },
    settings: {
      "import-x/resolver-next": [createTypeScriptImportResolver()],
    },
    rules: {
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "typeLike", format: ["PascalCase"] },
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: { regex: "^I[A-Z]", match: false },
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"],
          custom: { regex: "^T[A-Z]", match: false },
        },
        { selector: "variable", modifiers: ["destructured"], format: null },
        {
          selector: [
            "variable",
            "parameter",
            "parameterProperty",
            "classProperty",
            "typeProperty",
          ],
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "can", "should"],
        },
      ],
      "@eslint-community/eslint-comments/require-description": "error",
      "import-x/no-cycle": "error",
      "import-x/no-default-export": "error",
      "import-x/no-relative-packages": "error",
      "max-depth": ["error", 3],
      "no-console": "error",
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read env only in frontend/src/lib/env.ts or backend/src/config/.",
        },
      ],
      "no-restricted-syntax": ["error", NO_ENUM],
    },
  },
  {
    files: [
      "frontend/src/app/**/{page,layout,loading,error,not-found}.tsx",
      "**/*.config.ts",
    ],
    rules: { "import-x/no-default-export": "off" },
  },
  {
    files: ["frontend/src/lib/env.ts", "backend/src/config/**/*.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "react",
            "react-dom",
            "next",
            "prisma",
            ...builtinModules,
          ].map((name) => ({
            name,
            message: CORE_BOUNDARY,
          })),
          patterns: [
            {
              group: [
                "react/*",
                "react-dom/*",
                "next/*",
                "@nestjs/*",
                "@prisma/*",
                "node:*",
              ],
              message: CORE_BOUNDARY,
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        ...CORE_FORBIDDEN_GLOBALS.map((name) => ({
          name,
          message: CORE_BOUNDARY,
        })),
      ],
    },
  },
  {
    files: ["frontend/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      ...Object.fromEntries(
        Object.keys(nextPlugin.configs["core-web-vitals"].rules).map((rule) => [
          rule,
          "error",
        ]),
      ),
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      "no-restricted-syntax": ["error", NO_ENUM, NO_DANGEROUS_HTML],
    },
  },
  {
    files: ["backend/**/*.ts"],
    rules: {
      "@typescript-eslint/no-extraneous-class": [
        "error",
        { allowWithDecorator: true },
      ],
    },
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      "vitest/no-disabled-tests": "error",
      "vitest/no-focused-tests": "error",
    },
  },
  prettier,
]);
```

Các block ứng với quy tắc trong spec:

| Block | Quy tắc trong spec |
|---|---|
| `**/*.{ts,tsx}`: `strictTypeChecked` | Không `any` (`no-explicit-any`, `no-unsafe-*`); không non-null `!`; `ban-ts-comment`; `no-floating-promises`, `no-misused-promises`, `only-throw-error`, `prefer-promise-reject-errors`; `no-unused-vars` |
| `**/*.{ts,tsx}`: rules riêng | `as` cast, kiểu trả về của hàm export, `type` thay `interface`, switch đủ nhánh, không `enum`, `import type`, naming, tắt rule phải có lý do, `no-cycle`, named export, import package bằng tên, `max-depth`, `no-console`, `process.env` |
| Ngoại lệ default export | `page`, `layout`, `loading`, `error`, `not-found` trong `frontend/src/app/`, và `*.config.ts` |
| Ngoại lệ `process.env` | `frontend/src/lib/env.ts`, `backend/src/config/**` |
| `packages/core/**` | Không import React, Next.js, NestJS, Prisma hay module Node; không dùng global của trình duyệt, Node, mạng, timer |
| `frontend/**` | `@next/next`, Rules of Hooks, không `dangerouslySetInnerHTML` |
| `backend/**` | Cho phép class module rỗng có decorator của Nest |
| File test | Không test bị skip hoặc focus |
| `prettier` (cuối cùng) | Tắt các rule xung đột với Prettier |

Những điểm sau bắt buộc, không tự ý bỏ:

- **`importX.flatConfigs.typescript` phải có trong `extends`.** Thiếu preset này, `import-x` chỉ phân tích file `.js` và `import-x/no-cycle` không bao giờ báo lỗi. Khi lập plan, vòng import giữa hai file `.ts` không bị bắt cho tới khi thêm preset. Preset chỉ thêm settings (`import-x/extensions`, `import-x/parsers`) và tắt `import-x/named`.
- **`createTypeScriptImportResolver()` không truyền `project`.** Mỗi package chạy `eslint .` trong thư mục của nó, nên resolver dùng `tsconfig.json` của package đó.
- **Block frontend phải lặp lại `NO_ENUM` trong `no-restricted-syntax`.** Config đứng sau ghi đè toàn bộ option của rule, không gộp với config trước.
- **Rule `@next/next/*` được nâng lên `error`, và `no-html-link-for-pages` bị tắt** (xem vấn đề 4).
- **`consistent-type-imports` không cần `parserOptions.emitDecoratorMetadata`.** Khi lint có type, typescript-eslint tự đọc hai option decorator từ tsconfig và không báo lỗi trong file có decorator. Task 6 kiểm tra điều này.
- **`no-extraneous-class` dùng `allowWithDecorator`** vì class module của Nest (`@Module({...}) export class AppModule {}`) là class rỗng.
- **Số trong template string phải bọc `String()`.** `strictTypeChecked` bật `restrict-template-expressions` và không cho số trong template string, nên phải viết `${String(port)}`.
- **Không dùng `eslint-config-next`** (spec, quyết định #9).

**Kiểm tra:** chưa có tsconfig của package nên chưa lint được code. Lint thật chạy ở Task 4 đến 6.

```bash
node --input-type=module -e "await import('./eslint.config.mjs'); console.log('eslint config ok')"
# eslint config ok
pnpm format:check
# All matched files use Prettier code style!
pnpm exec prettier --file-info pnpm-lock.yaml
# { "ignored": true, "inferredParser": null }
pnpm exec prettier --file-info CLAUDE.md
# { "ignored": true, "inferredParser": null }
```

**Commit:** `build: add eslint and prettier config`

## Task 4: packages/core

**Mục tiêu:** `@schemaforge/core` build ra `dist/` (ESM, `.d.ts`, declaration map), có một export giữ chỗ được test, và typecheck, lint, test đều chạy qua với ngưỡng coverage 90%.

**Phụ thuộc:** Task 3.

**File tạo:** `packages/core/tsconfig.json`, `packages/core/tsconfig.build.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`, `packages/core/src/index.test.ts`.

**`packages/core/tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2023"],
    "types": []
  },
  "include": ["src", "vitest.config.ts"]
}
```

**`packages/core/tsconfig.build.json`:**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

`rootDir: "src"` là bắt buộc. TypeScript 6 đổi giá trị mặc định của `rootDir` thành thư mục chứa tsconfig. Thiếu dòng này, output nằm ở `dist/src/index.js` và `exports` trỏ sai.

**`packages/core/vitest.config.ts`:**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: { lines: 90 },
    },
  },
});
```

**`packages/core/src/index.ts`:**

```ts
export const PRODUCT_NAME = "SchemaForge";
```

**`packages/core/src/index.test.ts`:**

```ts
import { describe, expect, it } from "vitest";

import { PRODUCT_NAME } from "./index.js";

describe("PRODUCT_NAME", () => {
  it("is the product name", () => {
    expect(PRODUCT_NAME).toBe("SchemaForge");
  });
});
```

Test import `describe`, `it`, `expect` từ `vitest`; không bật `globals`. Vitest tự loại file test khỏi coverage.

**Kiểm tra:**

```bash
pnpm --filter @schemaforge/core build
ls packages/core/dist
# index.d.ts  index.d.ts.map  index.js   (không có thư mục src/, không có file test)
pnpm --filter @schemaforge/core typecheck
# exit 0
pnpm --filter @schemaforge/core lint
# exit 0, không có dòng lỗi
pnpm --filter @schemaforge/core test
# Tests 1 passed; "Lines : 100% ( 1/1 )"; exit 0
pnpm exec prettier --check packages/core
# All matched files use Prettier code style!
```

Để nguyên `packages/core/dist` khi kết thúc task (thư mục này đã gitignore). Task 5 và 6 dùng nó.

**Commit:** `build(core): add build, test setup and placeholder export`

## Task 5: frontend

**Mục tiêu:** app Next.js tối thiểu với một trang Server Component render heading lấy từ `@schemaforge/core`, có test, và typecheck, lint, test, build đều chạy qua.

**Phụ thuộc:** Task 4. Chạy song song với Task 6 và 7 được. Trước khi bắt đầu, orchestrator cần có câu trả lời của user cho vấn đề 5.

**File tạo:** `frontend/next.config.ts`, `frontend/tsconfig.json`, `frontend/vitest.config.ts`, `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`, `frontend/src/app/page.test.tsx`.

**`frontend/next.config.ts`:**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
};

export default nextConfig;
```

`agentRules: false` ngăn `next dev` sinh `frontend/AGENTS.md` và `frontend/CLAUDE.md` (vấn đề 5). Nếu user chọn commit hai file đó, bỏ dòng này.

**`frontend/tsconfig.json`:**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "noEmit": true,
    "incremental": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "plugins": [{ "name": "next" }]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    "**/*.mts",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- File có đủ các option mà Next.js 16 bắt buộc hoặc gợi ý, nên `next dev` và `next build` không ghi đè nó (đã kiểm chứng).
- Không khai báo `types`: Next.js tự tham chiếu kiểu của Node qua `next-env.d.ts`.
- Không nới option nào của base.

**`frontend/vitest.config.ts`:**

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.{ts,tsx}", "src/**/use-*.ts"],
      thresholds: { lines: 80 },
    },
  },
});
```

Hiện chưa có file nào khớp `coverage.include`. Vitest báo `Unknown% ( 0/0 )` và vẫn thoát mã 0 (đã kiểm chứng). Phần 3 thêm file logic và glob cho store.

**`frontend/src/app/layout.tsx`:**

```tsx
import { PRODUCT_NAME } from "@schemaforge/core";
import type { Metadata } from "next";
import type { JSX, ReactNode } from "react";

export const metadata: Metadata = { title: PRODUCT_NAME };

type RootLayoutProps = {
  readonly children: ReactNode;
};

export default function RootLayout({
  children,
}: RootLayoutProps): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

**`frontend/src/app/page.tsx`:**

```tsx
import { PRODUCT_NAME } from "@schemaforge/core";
import type { JSX } from "react";

export default function HomePage(): JSX.Element {
  return (
    <main>
      <h1>{PRODUCT_NAME}</h1>
    </main>
  );
}
```

**`frontend/src/app/page.test.tsx`:**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the product name as the main heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "SchemaForge",
    );
  });
});
```

Ghi chú:

- Spec không có `@testing-library/jest-dom`, nên assertion dùng `textContent`. `getByRole` tự throw khi không tìm thấy heading.
- `lang="en"` là giá trị tạm; i18n và ngôn ngữ giao diện làm ở phần 3.
- Chưa tạo `features/`, `components/`, `lib/`. Chưa cài Tailwind CSS hay shadcn/ui.

**Kiểm tra:**

```bash
test -f packages/core/dist/index.js
# nếu không có: dừng và báo orchestrator, không tự build core
pnpm --filter @schemaforge/frontend typecheck
# "✓ Types generated successfully"; exit 0
pnpm --filter @schemaforge/frontend lint
# exit 0; không có dòng "Pages directory cannot be found"
pnpm --filter @schemaforge/frontend test
# Tests 1 passed; "Lines : Unknown% ( 0/0 )"; exit 0
pnpm --filter @schemaforge/frontend build
# "✓ Compiled successfully"; bảng route có "○ /"
pnpm exec prettier --check frontend
# All matched files use Prettier code style!
```

Chạy thử dev:

```bash
pnpm --filter @schemaforge/frontend dev
# chạy nền, chờ tới khi log có "✓ Ready"
curl -s http://localhost:3000 | grep -o "<title>SchemaForge</title>\|<h1>SchemaForge</h1>"
# <title>SchemaForge</title>
# <h1>SchemaForge</h1>
# dừng tiến trình next dev
git status --porcelain frontend
# chỉ 6 file của task: tsconfig.json không bị Next.js sửa, không có AGENTS.md hay CLAUDE.md
```

**Commit:** `build(frontend): scaffold next.js app with placeholder page`

## Task 6: backend

**Mục tiêu:** app NestJS tối thiểu, env được validate bằng Zod, log có `PRODUCT_NAME` lấy từ core. Typecheck, lint, test, build và start đều chạy qua. Hai rủi ro của spec được kiểm tra.

**Phụ thuộc:** Task 4. Chạy song song với Task 5 và 7 được.

**File tạo:** `backend/.env.example`, `backend/nest-cli.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/vitest.config.ts`, `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/src/config/env.ts`, `backend/src/config/env.spec.ts`.

**`backend/.env.example`:**

```text
NODE_ENV=development
PORT=3001
```

**`backend/nest-cli.json`:**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

**`backend/tsconfig.json`:**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src", "vitest.config.ts"]
}
```

**`backend/tsconfig.build.json`:**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/**/*.spec.ts"]
}
```

`nest build` mặc định dùng `tsconfig.build.json`. `rootDir: "src"` là bắt buộc, với cùng lý do như ở core. Không chép `strictPropertyInitialization: false` từ template Nest, vì option đó nới lỏng base.

**`backend/vitest.config.ts`:**

```ts
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.service.ts",
        "src/**/*.guard.ts",
        "src/**/*.interceptor.ts",
        "src/**/*.pipe.ts",
        "src/**/*.filter.ts",
        "src/**/*.repository.ts",
        "src/config/**/*.ts",
      ],
      thresholds: { lines: 80 },
    },
  },
});
```

`swc.vite()` tự đọc `experimentalDecorators` và `emitDecoratorMetadata` từ tsconfig.

**`backend/src/config/env.ts`:**

```ts
import { z } from "zod";

const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;
const DEFAULT_PORT = 3001;

const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default("development"),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
      { cause: result.error },
    );
  }
  return result.data;
}
```

- `ConfigModule` gọi `validate` khi `AppModule` được nạp. Env sai thì app không khởi động.
- Đây là lỗi lúc khởi động, không phải lỗi HTTP, nên dùng `Error`.
- `envSchema` không export vì chưa nơi nào dùng.

**`backend/src/config/env.spec.ts`:**

```ts
import { describe, expect, it } from "vitest";

import { validate } from "./env.js";

describe("validate", () => {
  it("returns the parsed values when the environment is valid", () => {
    expect(validate({ NODE_ENV: "production", PORT: "8080" })).toEqual({
      NODE_ENV: "production",
      PORT: 8080,
    });
  });

  it("applies defaults when variables are missing", () => {
    expect(validate({})).toEqual({ NODE_ENV: "development", PORT: 3001 });
  });

  it("throws when PORT is not a number", () => {
    expect(() => validate({ PORT: "abc" })).toThrow(/PORT/);
  });
});
```

**`backend/src/app.module.ts`:**

```ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validate } from "./config/env.js";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate })],
})
export class AppModule {}
```

**`backend/src/main.ts`:**

```ts
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { PRODUCT_NAME } from "@schemaforge/core";

import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const port = configService.get("PORT", { infer: true });
  await app.listen(port);
  new Logger("Bootstrap").log(
    `${PRODUCT_NAME} backend listening on port ${String(port)}`,
  );
}

await bootstrap();
```

`ConfigService<Env, true>` cùng `{ infer: true }` cho `port` kiểu `number` mà không cần cast. Không có controller hay service mẫu của Nest CLI.

**Kiểm tra cơ bản:**

```bash
test -f packages/core/dist/index.js
# nếu không có: dừng và báo orchestrator
pnpm --filter @schemaforge/backend typecheck
# exit 0
pnpm --filter @schemaforge/backend lint
# exit 0
pnpm --filter @schemaforge/backend test
# Tests 3 passed; "Lines : 100%"; exit 0
pnpm --filter @schemaforge/backend build
find backend/dist -type f | sort
# backend/dist/app.module.js
# backend/dist/config/env.js
# backend/dist/main.js
pnpm --filter @schemaforge/backend start
# chạy nền; log có "[Bootstrap] SchemaForge backend listening on port 3001"; dừng tiến trình
PORT=abc pnpm --filter @schemaforge/backend start
# thoát mã khác 0; output có "Invalid environment variables" và "PORT"
pnpm exec prettier --check backend
# All matched files use Prettier code style!
```

### Rủi ro 1: `unplugin-swc` có còn cần không

Tạo tạm hai file và một config, rồi xóa ở bước 8.

`backend/src/config/port-probe.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { Env } from "./env.js";

@Injectable()
export class PortProbeService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  getPort(): number {
    return this.configService.get("PORT", { infer: true });
  }
}
```

`backend/src/config/port-probe.service.spec.ts`:

```ts
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { validate } from "./env.js";
import { PortProbeService } from "./port-probe.service.js";

describe("PortProbeService", () => {
  it("receives ConfigService through constructor injection", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, validate })],
      providers: [PortProbeService],
    }).compile();

    expect(moduleRef.get(PortProbeService).getPort()).toBe(3001);
  });
});
```

`backend/vitest.probe.config.ts` (không có plugin):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.spec.ts"] },
});
```

Chạy trong thư mục `backend/`:

1. `pnpm exec vitest run src/config/port-probe.service.spec.ts`: dùng config của repo, có plugin. Phải pass.
2. `pnpm exec vitest run --config vitest.probe.config.ts src/config/port-probe.service.spec.ts`: không có plugin. Ghi lại kết quả; khi lập plan, bước này pass.
3. Đối chứng: chép `tsconfig.json` ra một bản dự phòng, xóa dòng `"emitDecoratorMetadata": true`, rồi chạy lại bước 2 và bước 1. Cả hai phải fail vì Nest không resolve được dependency của `PortProbeService`. Sau đó khôi phục `tsconfig.json` từ bản dự phòng và dùng `diff` xác nhận file giống hệt. Nếu bước 3 không fail, probe không đo được metadata: dừng và báo.
4. Kết luận:
   - **Bước 1 pass, bước 2 fail:** plugin cần thiết, giữ nguyên.
   - **Bước 1 và 2 cùng pass, bước 3 fail** (giống lúc lập plan): plugin thừa. Không bỏ plugin trong task này; `architecture.md` ghi quyết định dùng plugin. Báo orchestrator kèm output của ba bước. Orchestrator đưa vấn đề 2 cho user.
   - **Bước 1 fail:** dừng và báo, vì đây là blocker.

### Rủi ro 2: `consistent-type-imports` với `emitDecoratorMetadata`

Làm tiếp khi probe vẫn còn và `tsconfig.json` đã được khôi phục. Chạy trong `backend/`:

5. `pnpm exec eslint src/config/port-probe.service.ts`: không có `@typescript-eslint/consistent-type-imports`, exit 0.
6. `pnpm exec eslint --fix src/config/port-probe.service.ts`, sau đó `grep '^import' src/config/port-probe.service.ts`. Dòng import vẫn phải là `import { ConfigService } from "@nestjs/config";`, không phải `import type`. Chạy lại bước 1, phải pass.
7. Đối chứng để chắc rule đang bật. Tạo tạm `src/config/config-holder.ts`, không có decorator:

   ```ts
   import { ConfigService } from "@nestjs/config";

   export type ConfigHolder = { readonly service: ConfigService };
   ```

   `pnpm exec eslint src/config/config-holder.ts` phải báo `@typescript-eslint/consistent-type-imports`.

Cơ chế: theo tài liệu typescript-eslint, khi `experimentalDecorators` và `emitDecoratorMetadata` cùng bật, rule không báo lỗi trong file có decorator. Khi lint có type (`projectService`), hai option này được đọc từ tsconfig. `verbatimModuleSyntax` giữ nguyên import giá trị, nên class inject qua constructor vẫn còn ở runtime cho metadata.

Nếu bước 5 báo lỗi, hoặc bước 6 đổi import thành `import type`: dừng và báo orchestrator. Cách sửa dự kiến là thêm `languageOptions: { parserOptions: { emitDecoratorMetadata: true, experimentalDecorators: true } }` vào block `backend/**/*.ts` của `eslint.config.mjs`. Đây là file ở root, nên orchestrator chạy việc sửa này như một task riêng, không song song với task khác.

Quy ước cho mọi code backend về sau: không tự đổi import của class được inject qua constructor sang `import type`.

8. Dọn dẹp. Xóa `src/config/port-probe.service.ts`, `src/config/port-probe.service.spec.ts`, `src/config/config-holder.ts` và `vitest.probe.config.ts`, rồi chạy lại `pnpm --filter @schemaforge/backend lint` và `test`, cả hai phải qua. `git status --porcelain backend` chỉ còn 9 file của task.

**Commit:** `build(backend): scaffold nestjs app with validated env`

## Task 7: CI

**Mục tiêu:** workflow GitHub Actions chạy đúng các lệnh ở root, khi push lên `master` và khi có pull request.

**Phụ thuộc:** Task 3. Chạy song song với Task 5 và 6 được.

**File tạo:** `.github/workflows/ci.yml`.

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm format:check

      - uses: actions/cache@v6
        with:
          path: .turbo/cache
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-turbo-

      - run: pnpm turbo run lint typecheck test build
```

Ghi chú:

- **`pnpm/action-setup@v6`** không khai báo `version` nên đọc `packageManager`. Bước này phải đứng trước `setup-node`, để `cache: pnpm` tìm được pnpm.
- **`concurrency.group`** dùng `github.head_ref || github.ref`, nên run mới của cùng một branch hay cùng một PR hủy run cũ.
- **Cache của Turborepo** nằm ở `.turbo/cache` (thư mục mặc định của Turborepo 2). Key theo SHA; restore theo prefix lấy cache gần nhất.
- **Không có secret** và không có `env`.
- **Tag các action:** `v7` và `v6` của bốn action đã được kiểm tra bằng `git ls-remote` ngày 2026-09-14.

**Kiểm tra:**

```bash
pnpm exec prettier --check .github/workflows/ci.yml
# All matched files use Prettier code style!
for r in actions/checkout:v7 pnpm/action-setup:v6 actions/setup-node:v7 actions/cache:v6; do
  git ls-remote --tags "https://github.com/${r%%:*}" "refs/tags/${r##*:}" | grep -q . && echo "ok $r"
done
# ok actions/checkout:v7
# ok pnpm/action-setup:v6
# ok actions/setup-node:v7
# ok actions/cache:v6
```

CI chạy thật trên GitHub ở Task 10.

**Commit:** `ci: add github actions workflow`

## Task 8: Kiểm tra tích hợp toàn repo

**Mục tiêu:** xác nhận các tiêu chí ở cấp repo trên một bản clone sạch, chạy Node 24. Không sửa file nào trong repo.

**Phụ thuộc:** orchestrator đã commit Task 2 đến 7.

**File:** không sửa.

**Cài và chạy các lệnh ở root trên bản clone sạch:**

```bash
node -v
# v24.x, từ 24.15.0
git status --porcelain
# không in dòng nào
CLONE="<scratchpad>/schemaforge-clean"
git clone "$(pwd)" "$CLONE" && cd "$CLONE"
pnpm -v
# 12.4.1
pnpm install --frozen-lockfile
# exit 0; không có "Ignored build scripts"; không có ERR_PNPM_
git status --porcelain
# không in dòng nào (pnpm không sửa pnpm-workspace.yaml)
pnpm format:check
# All matched files use Prettier code style!
pnpm lint
# exit 0
pnpm typecheck
# exit 0
pnpm test
# exit 0
pnpm build
# exit 0
pnpm turbo run lint typecheck test build
pnpm turbo run lint typecheck test build
# lần chạy thứ hai: "Cached: 12 cached, 12 total" và ">>> FULL TURBO"
```

**`pnpm dev`:**

```bash
pnpm dev > "<scratchpad>/dev.log" 2>&1 &
# chờ khoảng 30 giây
curl -s http://localhost:3000 | grep -o "<h1>SchemaForge</h1>"
# <h1>SchemaForge</h1>
grep -E "Watching for file changes|Ready in|listening on port 3001" "<scratchpad>/dev.log"
# @schemaforge/core:dev: ... Found 0 errors. Watching for file changes.
# @schemaforge/frontend:dev: ✓ Ready in ...
# @schemaforge/backend:dev: ... [Bootstrap] SchemaForge backend listening on port 3001
```

Dừng `turbo run dev` cùng các tiến trình con (`next dev`, `nest start`, `tsc --watch`, `node dist/main`). `lsof -nP -iTCP:3000 -iTCP:3001 -sTCP:LISTEN` không còn dòng nào, và `git status --porcelain` trong bản clone vẫn rỗng: không có `frontend/AGENTS.md`, tsconfig không bị sửa.

**Chạy bản build của backend:**

```bash
pnpm --filter @schemaforge/backend start
# log có "SchemaForge backend listening on port 3001"; dừng tiến trình
PORT=abc pnpm --filter @schemaforge/backend start
# thoát mã khác 0; output có "Invalid environment variables" và "PORT"
```

**Import và file env:**

```bash
grep -n '"@schemaforge/core"' frontend/src/app/page.tsx backend/src/main.ts
# mỗi file có một dòng import
grep -rn "packages/core" frontend/src backend/src
# không có kết quả
git ls-files | grep -E '(^|/)\.env'
# backend/.env.example
```

Giữ bản clone cho Task 9. Báo cáo output của từng lệnh. Nếu có lệnh fail, báo orchestrator kèm output; orchestrator giao việc sửa cho task tương ứng.

**Commit:** không.

## Task 9: Kiểm tra tool bắt vi phạm

**Mục tiêu:** xác nhận mỗi vi phạm tạm thời làm lệnh tương ứng fail, và không để lại gì.

**Phụ thuộc:** Task 8.

**Nơi chạy:** bản clone của Task 8, không phải repo. Nếu bản clone không còn, clone lại, chạy `pnpm install --frozen-lockfile` rồi `pnpm build`.

**Quy trình cho mỗi vi phạm:**

1. Tạo file tạm.
2. Chạy lệnh, ghi lại exit code và dòng lỗi.
3. Xóa file tạm.
4. Kiểm tra `git status --porcelain` rỗng trước khi sang vi phạm tiếp theo.

Mỗi vi phạm dùng một file riêng để lỗi không lẫn nhau.

### Bắt buộc (tiêu chí hoàn thành của spec)

Trừ khi ghi khác, file tạm là `packages/core/src/violation.ts`.

1. **Import `react` trong core.** Chạy `pnpm lint`: fail, có `no-restricted-imports`.

   ```ts
   import { useState } from "react";

   export const probe = useState;
   ```

2. **Dùng `window` trong core.** Chạy `pnpm lint`: fail, có `no-restricted-globals`. Chạy `pnpm typecheck`: fail, có `TS2304: Cannot find name 'window'`.

   ```ts
   export const probe = (): unknown => window;
   ```

3. **Promise không `await`.** Chạy `pnpm lint`: fail, có `@typescript-eslint/no-floating-promises`.

   ```ts
   async function load(): Promise<number> {
     return Promise.resolve(1);
   }

   export function run(): void {
     load();
   }
   ```

4. **`console.log`.** Chạy `pnpm lint`: fail, có `no-console`.

   ```ts
   export function log(): void {
     console.log("x");
   }
   ```

5. **`any`.** Chạy `pnpm lint`: fail, có `@typescript-eslint/no-explicit-any`.

   ```ts
   export const value: any = 1;
   ```

6. **Default export ngoài file framework.** Chạy `pnpm lint`: fail, có `import-x/no-default-export`. Trong cùng lần chạy, `frontend/src/app/page.tsx` (file framework, cũng default export) không bị báo.

   ```ts
   const probe = 1;

   export default probe;
   ```

7. **Hàm không có test trong core.** Chạy `pnpm test`: fail, có `ERROR: Coverage for lines (…%) does not meet global threshold (90%)`. Khi lập plan, coverage là 33.33%.

   ```ts
   export function untestedHelper(value: number): number {
     const doubled = value * 2;
     return doubled + 1;
   }
   ```

### Nên kiểm tra thêm

Các vi phạm dưới đây kiểm tra phần còn lại của config lint; tất cả đã báo lỗi khi lập plan. Để nhanh, chạy `pnpm exec eslint <file>` trong thư mục package. Mong đợi: exit 1 và có đúng rule trong bảng.

| File tạm | Vi phạm | Rule |
|---|---|---|
| `packages/core/src/violation.ts` | `enum Color { Red }` | `no-restricted-syntax` |
| `packages/core/src/violation.ts` | `export const size = JSON.parse("1") as number;` | `@typescript-eslint/consistent-type-assertions` |
| `packages/core/src/violation.ts` | `export const first = (items: readonly number[]): number => items[0]!;` | `@typescript-eslint/no-non-null-assertion` |
| `packages/core/src/violation.ts` | `export interface Shape { size: number }` | `@typescript-eslint/consistent-type-definitions` |
| `packages/core/src/violation.ts` | `export const ready = true;` | `@typescript-eslint/naming-convention` |
| `packages/core/src/violation.ts` | `export type TShape = { size: number };` | `@typescript-eslint/naming-convention` |
| `packages/core/src/violation.ts` | `import { readFile } from "node:fs";` và `import path from "path";` | `no-restricted-imports` |
| `packages/core/src/violation.ts` | `export const env = process.env;` | `no-restricted-globals`, `no-restricted-properties` |
| `packages/core/src/violation.ts` | `export const delay = setTimeout;` | `no-restricted-globals` |
| `packages/core/src/violation.ts` | `// eslint-disable-next-line no-console` không có lý do | `@eslint-community/eslint-comments/require-description` |
| `packages/core/src/violation.ts` | hàm export không khai báo kiểu trả về | `@typescript-eslint/explicit-module-boundary-types` |
| `packages/core/src/violation.ts` | `// @ts-ignore` | `@typescript-eslint/ban-ts-comment` |
| `packages/core/src/violation.ts` | `switch` trên `"a" \| "b"` chỉ có `case "a"` | `@typescript-eslint/switch-exhaustiveness-check` |
| `packages/core/src/violation.ts` | bốn `if` lồng nhau | `max-depth` |
| `packages/core/src/violation.ts` | `throw "boom";` | `@typescript-eslint/only-throw-error` |
| `packages/core/src/violation.ts` | import không dùng | `@typescript-eslint/no-unused-vars` |
| `packages/core/src/violation.test.ts` | `it.only(...)` và `it.skip(...)` | `vitest/no-focused-tests`, `vitest/no-disabled-tests` |
| `packages/core/src/cycle-a.ts`, `cycle-b.ts` | hai file import lẫn nhau | `import-x/no-cycle` |
| `frontend/src/app/violation.tsx` | `<div dangerouslySetInnerHTML={{ __html: "x" }} />` | `no-restricted-syntax` |
| `frontend/src/app/violation.tsx` | `<img src="/logo.png" alt="logo" />` | `@next/next/no-img-element` (mức error) |
| `frontend/src/app/violation.tsx` | component `"use client"` gọi `useState` sau một `return` sớm | `react-hooks/rules-of-hooks` |
| `backend/src/config/violation.ts` | `import { PRODUCT_NAME } from "../../../packages/core/src/index.js";` | `import-x/no-relative-packages` |

**Kết thúc:** `git status --porcelain` trong bản clone rỗng, và `git status --porcelain` trong repo rỗng. Xóa bản clone. Báo cáo bảng kết quả: vi phạm, lệnh, exit code, dòng lỗi.

**Commit:** không.

## Task 10: Tài liệu, push và CI

**Mục tiêu:** tài liệu phản ánh trạng thái sau scaffold, CI xanh trên GitHub cho commit trên `master` và cho pull request, và roadmap chuyển phần 1 sang "Xong".

**Phụ thuộc:** Task 9.

### Bước A: cập nhật tài liệu (subagent)

**File sửa:** `CLAUDE.md`, `frontend/README.md`, `backend/README.md`, `packages/core/README.md`.

- **`CLAUDE.md`, mục "Current status":** thay đoạn "Pre-scaffold..." bằng:

  ```markdown
  ## Current status

  Scaffold and tooling (roadmap part 1) are in place. `packages/core` exports only a placeholder (`PRODUCT_NAME`), `frontend/` has a placeholder page, and `backend/` validates its env but has no routes yet.
  ```

- **`CLAUDE.md`, mục mới ngay sau "Current status":**

  ```markdown
  ## Commands

  Requires Node.js 24 (`.nvmrc`) and pnpm 12.4.1 (from `packageManager`, via corepack).

  | Command | What it does |
  |---|---|
  | `pnpm install` | Install dependencies for the whole workspace |
  | `pnpm dev` | Core in watch mode, frontend on port 3000, backend on port 3001 |
  | `pnpm build` | Build every package in dependency order |
  | `pnpm lint` | ESLint in every package |
  | `pnpm typecheck` | TypeScript in every package |
  | `pnpm test` | Vitest with coverage thresholds |
  | `pnpm format` | Format the repo with Prettier |
  | `pnpm format:check` | Check formatting (used in CI) |

  Run a script in one package: `pnpm --filter @schemaforge/core test`. Start the built backend: `pnpm --filter @schemaforge/backend start`.
  ```

- **Ba README:** xóa câu "Not scaffolded yet.", giữ phần còn lại.

**Kiểm tra:** `pnpm format:check` chạy qua; `git diff --stat` chỉ có 4 file.

**Commit** (orchestrator): `docs: update status and commands after scaffold`

### Bước B: push `master` (orchestrator, cần user đồng ý)

- Hỏi user trước khi push, nói rõ sẽ push các commit của Task 2 đến 7 và bước A lên `origin/master`.
- Sau khi push:

  ```bash
  gh run list --workflow ci.yml --branch master --limit 1
  gh run watch <run-id> --exit-status
  # exit 0
  ```

- Nếu CI fail: lấy log bằng `gh run view <run-id> --log-failed`, gửi cho agent của task liên quan, sửa, commit, rồi hỏi user trước khi push lại.

### Bước C: pull request và roadmap

Subagent sửa file; orchestrator làm phần git và `gh`.

- Tạo branch `docs/mark-scaffold-done` từ `master` đã xanh.
- Trong `document/roadmap.md`, dòng phần 1, cột "Trạng thái" đổi từ "Đang làm" thành "Xong". Không sửa dòng khác.
- Commit: `docs: mark scaffold and tooling as done`
- Hỏi user trước khi push branch và mở PR:

  ```bash
  git push -u origin docs/mark-scaffold-done
  gh pr create --base master --head docs/mark-scaffold-done --title "docs: mark scaffold and tooling as done" --body "Roadmap part 1 is done; CI on master is green."
  gh pr checks <pr-number> --watch
  # mọi check pass
  ```

- Hỏi user trước khi merge: `gh pr merge <pr-number> --rebase --delete-branch`. Rebase giữ nguyên commit message theo `git.md` và không tạo merge commit. Sau khi merge, `gh run watch` cho run mới trên `master`, phải xanh.
- `document/architecture.md` chỉ sửa khi có quyết định thay đổi. Nếu user chấp nhận vấn đề 2, làm trong một thay đổi riêng sau khi phần 1 xong.

## Ánh xạ tiêu chí hoàn thành

| Tiêu chí trong spec | Task |
|---|---|
| `node -v` cho 24.x và `pnpm -v` cho 12.4.1 | 1, 2 |
| Từ bản clone sạch, `pnpm install --frozen-lockfile` chạy qua, không còn cảnh báo build script bị chặn | 2 (`allowBuilds`), 8 |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` chạy qua | 3 đến 6 (từng package), 8 (ở root) |
| Chạy lại `pnpm turbo run lint typecheck test build` cho `FULL TURBO` | 2 (`turbo.json`), 8 |
| `pnpm dev`: core watch, heading "SchemaForge" ở cổng 3000, backend log "SchemaForge" và cổng 3001 | 5, 6 (từng app), 8 |
| Sau `pnpm build`, `pnpm --filter @schemaforge/backend start` ghi log có `PRODUCT_NAME` từ core | 6, 8 |
| Backend từ chối khởi động khi `PORT=abc` | 6, 8 |
| `page.tsx` và `main.ts` import từ `@schemaforge/core`, không import tương đối vào `packages/core/src` | 5, 6, 8; rule `import-x/no-relative-packages` ở 3, kiểm tra ở 9 |
| Tool bắt được vi phạm tạm thời (`react`, `window`, promise, `console.log`, `any`, default export, hàm không test) | 3, 4, 9 |
| CI xanh trên GitHub cho commit trên `master` và cho pull request | 7, 10 |
| Repo chỉ có `backend/.env.example`, không commit file `.env` nào | 6, 8 |
| `CLAUDE.md` cập nhật "Current status" và danh sách lệnh; `roadmap.md` chuyển phần 1 sang "Xong"; `architecture.md` cập nhật khi quyết định thay đổi | 10; vấn đề 2 nếu user đổi quyết định |
