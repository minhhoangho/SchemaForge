# Dọn dẹp generators sau review (part 6, Code generators)

Không có plan task riêng; nguồn: review dự án. Spec: `document/specs/2026-09-14-code-generators-design.md`.

## 2026-10-02 — core-engineer — Xong
- **Đã làm**
  - Tách phần relations của `generators/markdown/generate-markdown.ts` (388 -> 287 dòng) sang `markdown-relations.ts`, export `renderRelations`; thêm `markdown-relations.test.ts`.
  - Thêm nhánh `default: { const unreachable: never = ...; return unreachable; }` (cùng dạng với SQL/Prisma) cho 9 switch: `shared/json-representation.ts` (2), `zod/generate-zod.ts`, `typescript/generate-typescript.ts`, `openapi/openapi-schemas.ts`, `dbml/generate-dbml.ts` (2), `markdown/generate-markdown.ts` (2).
- **File thay đổi**
  - `packages/core/src/generators/markdown/generate-markdown.ts`
  - `packages/core/src/generators/markdown/markdown-relations.ts` (mới)
  - `packages/core/src/generators/markdown/markdown-relations.test.ts` (mới)
  - `packages/core/src/generators/shared/json-representation.ts`
  - `packages/core/src/generators/zod/generate-zod.ts`
  - `packages/core/src/generators/typescript/generate-typescript.ts`
  - `packages/core/src/generators/openapi/openapi-schemas.ts`
  - `packages/core/src/generators/dbml/generate-dbml.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format`: RESULT: PASS (typecheck, lint, test 2249 passed, build, prettier). Line coverage all files 97.66%.
  - `.claude/scripts/secret-scan.sh`: SECRET-SCAN: CLEAN.
  - `git status --porcelain`: không có thay đổi nào dưới `__snapshots__`.
- **Quyết định**
  - `markdown-relations.ts` không import từ `generate-markdown.ts` (tránh vòng import). Vì vậy file mới giữ bản sao nhỏ của `Block`, `listItem` (1 dòng), tiền tố heading `####` và `ACTION_KEYWORDS` (chỉ dùng cho relations nên chuyển hẳn sang file mới). `joinedColumnNames` cũng chuyển sang file mới và tự tra `schema.columns`, nên `tableColumns` vẫn ở file chính. Không sửa `markdown-text.ts` vì ngoài phạm vi file được phép.
  - Nhánh `default` unreachable không làm tụt coverage (97.66% > 90%), nên không cần xử lý thêm.
  - Worktree đã có sẵn (`.claude/worktrees/agent-a9b3287aa0e2928ac`); chỉ chạy `worktree-setup.sh` trên chính nó, không tạo worktree mới.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: nếu thêm heading level hoặc `listItem` dùng chung, cân nhắc đưa vào một file shared của markdown để bỏ bản sao trong `markdown-relations.ts`.
