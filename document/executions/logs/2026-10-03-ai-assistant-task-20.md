# Namespace i18n `ai` và ba token diff

- Plan: `document/plans/2026-10-03-ai-assistant-plan.md` (Task 20)
- Spec: `document/specs/2026-10-02-ai-assistant-design.md` (mục 14, AI-R34, AI-R44, AI-R48, AI-R53, AI-R61)

## 2026-10-03 20:20 — frontend-engineer — Xong
- **Đã làm**: viết test trước (`resources.test.ts`: `registers the ai namespace`, `has one ai error message per stream error code`; `globals.test.ts`: 12 ca tương phản diff), chạy thấy đỏ, rồi thêm namespace `ai` (9 file con + file tổng mỗi locale, `vi` và `en`), đăng ký trong `resources.ts`, thêm ba token `--diff-added/changed/removed` vào `:root`, `.dark` và `@theme inline`.
- **File thay đổi**: `frontend/src/lib/i18n/locales/{en,vi}/ai.ts`, `locales/{en,vi}/ai/{panel,composer,quick-actions,status,proposal,diff,findings,sample-data,errors}.ts`, `frontend/src/lib/i18n/resources.ts`, `resources.test.ts`, `frontend/src/app/globals.css`, `globals.test.ts`.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --build --format` → `RESULT: PASS` (typecheck, lint, 4218 test, coverage 96.07% dòng, build, prettier). `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Giá trị oklch (tỉ lệ đo được với `--canvas` / `--card`): light added `oklch(0.58 0.15 150)` 3.68 / 4.01; changed `oklch(0.6 0.14 75)` 3.70 / 4.03; removed `oklch(0.58 0.2 25)` 4.34 / 4.74. Dark added `oklch(0.72 0.17 150)` 8.31 / 7.38; changed `oklch(0.78 0.15 75)` 9.43 / 8.37; removed `oklch(0.7 0.19 25)` 6.62 / 5.88.
  - 12 ca tương phản nằm trong `it.each(DIFF_CASES)` riêng (không nhét vào `BOUNDARY_CASES` vì mảng đó là `as const`).
  - Văn bản không do plan chốt (consent.title/body, guestTitle/Body, composer, status, counts, sampleData.*, errors.*, diff.column*, findings.categories...) do agent tự soạn; `confirmDelete.body` dùng `{{tables}}`/`{{columns}}` là chuỗi đã đếm sẵn từ `proposal.counts.removed*` (task 26 chịu trách nhiệm ghép). `errors.rateLimited_one` thêm bản "second" số ít.
  - `vi` có comment plural như `locales/vi/canvas.ts` ở các file có khóa `_one/_other`.
- **Ghi chú cho người tiếp theo**: kiểm tra thủ công độ tương phản thực tế của tint `bg-diff-*/10` trong trình duyệt khi Task 24 dựng UI; `git` bị sandbox chặn trong worktree nên chưa chạy `git status`.
