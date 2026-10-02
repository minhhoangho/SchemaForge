# Dependency `shiki` cho frontend

- Plan: [Task 32](../../plans/2026-09-15-code-generators-plan.md)
- Spec: [code-generators-design](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-02 — frontend-engineer — Xong
- **Đã làm**: thêm `shiki` vào `dependencies` của frontend; lockfile giải ra 4.5.0 (phát hành 2026-10-01 06:46 UTC, đã quá 24 giờ; `npm view shiki time` cho thấy 4.4.0–4.4.3 và 4.5.0 là các bản nhánh 4). Không có cảnh báo build script bị bỏ qua (chỉ `unrs-resolver` postinstall, đã chạy).
- **File thay đổi**: `frontend/package.json` (`"shiki": "^4.4.3"`), `pnpm-lock.yaml`.
- **Kiểm tra**:
  - `pnpm install --frozen-lockfile`: OK ("Lockfile is up to date").
  - `node` import `shiki/core`, `shiki/engine/javascript`: in `function function function`; `shiki/langs/sql.mjs` default là `object`.
  - File tạm import đủ các đường dưới đây qua `tsc --noEmit`: không lỗi (đã xóa file tạm).
  - `.claude/scripts/verify.sh frontend`: `RESULT: PASS` (typecheck, lint, test 3436 passed).
  - `pnpm exec prettier --check frontend/package.json`: sạch.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**:
  - Khai báo `^4.4.3` (theo bảng phiên bản của plan) thay vì `^4.5.0` mà pnpm tự ghi; lockfile vẫn giải ra 4.5.0.
  - Dùng đường import `shiki/langs/<tên>.mjs` thay vì `@shikijs/langs/<tên>` vì `@shikijs/langs` không phải dependency trực tiếp của frontend (pnpm không hoist), còn `shiki` export `./*` -> `./dist/*`.
- **Đường import thật cho Task 33** (không đi qua bundle đầy đủ):
  - `import { createHighlighterCore, createCssVariablesTheme } from "shiki/core"`
  - `import { createJavaScriptRegexEngine } from "shiki/engine/javascript"`
  - `import sql from "shiki/langs/sql.mjs"`; tương tự `prisma`, `typescript`, `json`, `markdown` (mỗi file `export default` một `LanguageRegistration[]`, có `.d.mts` kèm theo).
  - Không import từ `"shiki"` gốc hoặc `shiki/bundle/*` (kéo toàn bộ grammar).
- **Ghi chú cho người tiếp theo**: `package.json` của `shiki` không export `./langs/*` riêng; đường `shiki/langs/x.mjs` đi qua pattern `./*`. Nếu bundler/Turbopack không resolve được trong worker thì kiểm tra lại ở Task 33 với `--build`.
