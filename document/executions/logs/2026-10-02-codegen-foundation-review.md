# Review code nền phần 6 (code generators)

Review: [Plan Task](../../plans/2026-09-15-code-generators-plan.md#phần-6-code-nền), [Spec](../../specs/2026-09-14-code-generators-design.md). Reviewer chỉ đọc nên không ghi file; log này do spec-writer viết theo yêu cầu của orchestrator.

## 2026-10-02 — project-reviewer — Xong

- **Đã làm**:
  - Review commit range `823aefb..5530cf5` (7 code commit: Task 1, 2, 3, 5, 6, 7, 36) so với plan phần 6 và spec mục 1–5, R1–R18.
  - Đọc mọi file trong `generators/shared/*`, `sql-literals.ts`, trích `findDefaultValueProblem`, quy tắc `tables.ts`, `names.ts`, `suggestIndexName`, package `codegen-conformance`, diff lockfile và `allowBuilds`.
  - So sánh 7 execution log với diff.

- **Kiểm tra**:
  - `verify.sh core --build` PASS (1026 test, 98.03% line).
  - `verify.sh frontend` PASS (3435 test, 96.08% line).
  - conformance typecheck, lint và `test:conformance` (3 test) PASS.
  - prettier PASS.
  - `SECRET-SCAN: CLEAN`.

- **Quyết định**:
  - Verdict `accept with follow-ups`: không có finding chặn và không có should-fix.
  - `allocate` trả về `preferred` không cắt ngắn là đúng theo plan.
  - Giữ NUL trong literal MySQL và SQL Server là đúng theo plan.

- **Việc còn lại**:
  - [ ] Rewrite `COMBINING_MARKS` với escape `\u` (đang làm trong task fix riêng).
  - [ ] Thêm branch `never` vào switch trong `sql-literals.ts` và `findDefaultValueProblem` (task fix riêng).
  - [ ] Sửa comment và thêm check "0 column" trong `left-panel.test.tsx` (task fix riêng).
  - [ ] Thêm vào probe Task 8: MySQL literal `timestamptz` với `-00:00`; so sánh định danh `ß`/`s` và `ð`/`d` dưới `utf8mb3_general_ci`.
  - [ ] Quyết định có xóa `.tmp/` gốc sau `test:conformance` (Task 3 giữ lại).

- **Ghi chú cho người tiếp theo**: `.claude/scripts/verify.sh` không support `codegen-conformance`; chạy `pnpm --filter @schemaforge/codegen-conformance` trực tiếp. `ecc:database-reviewer` nên review Task 13–16 khi chúng land.
