# Bàn giao trạng thái phần 6 (Code generators), phiên 2 — 2026-10-02

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc thứ hai ngày 2026-10-02. Nó thay [2026-10-02-codegen-ai-session-handoff.md](2026-10-02-codegen-ai-session-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-09-14-code-generators-design.md` và plan `document/plans/2026-09-15-code-generators-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan. Bàn giao này không ghi trạng thái phần 5 (AI Assistant); trạng thái gần nhất ở mục 3 của handoff trước.

---

## 1. Trạng thái git

- Nhánh `master`, đã push tới `6006957`.

## 2. Phần 6 "Code generators"

### 2.a. Đã merge trong phiên này

- Plan hoàn chỉnh (`81e10c1`).
- Task 4, 9, 10, 11, 13, 14, 17, 19, 20, 21, 22, 23, 24, 25, 32.
- Task 8: conformance và probe database (`24714f1`).
- Sửa số 0 đứng đầu của `decimal(p,p)` (`86f1710`).

### 2.b. Đang chạy lúc bàn giao

Mỗi việc chạy trong một worktree riêng dưới `.claude/worktrees/`.

- **F1 (core):** so định danh MySQL chuyển sang `caseInsensitive`; bỏ `caseAndAccentInsensitive` và danh sách gộp; `timestamptz` MySQL đổi `Z`, `-00:00` thành `+00:00`; export `resolveActions` và xóa bản sao trong Prisma; cập nhật các snapshot bị ảnh hưởng, kể cả seed. Log `2026-10-02-mysql-probe-fixes.md`.
- **Task 26:** tài liệu Markdown.
- **Task 16:** SQL Server DDL; chuyển bảng ánh xạ hành động tham chiếu sang `shared/sql-referential-actions.ts`.
- **Task 31:** conformance cho MSW, OpenAPI, DBML.
- **Sửa spec theo kết quả probe (R20):** log `2026-10-02-code-generators-probe-spec-update.md`. Orchestrator commit với message `docs: record database probe results in code generators spec`.

### 2.c. Hàng đợi

- Task 15 và Task 18 sau F1.
- Task 29 sau Task 15 và 16; Task 30 sau Task 18.
- Task 27 sau Task 14–26; Task 28 sau Task 27; Task 33 → 34 → 35.
- `.gitattributes`: snapshot chứa byte NUL, nên ép diff dạng văn bản cho `packages/core/src/generators/__snapshots__/**`.
- Review dải đã merge `1c42f9c..HEAD` bằng `project-reviewer` và `ecc:security-reviewer` (gồm `parseSeedDataset`, hàm nhận input từ AI).

## 3. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

- **Seed:**
  - Dòng cha ứng viên phải khớp các cột dùng chung đã được gán.
  - Một bảng dừng khi một dòng chạm giới hạn thử lại (Vấn đề 20).
  - `INSERT` chỉ ghi `NULL` cho cột chỉ được gán ở bước hoãn; cột hoãn không có giá trị trong JSON thì ghi `DEFAULT`.
  - Bước 6 giữ khóa unique không trùng, nếu không được thì ghi `NULL`.
- **`createLargeSchema`:** cột khóa ngoại của vòng là nullable.
- **Generator không có option:** khai báo `const generateX: Generate<…>`.
- **DBML:** escape mọi `'` bên trong `'''…'''`.
- **Probe:** các quyết định R20 trong spec (so định danh MySQL phân biệt dấu, vẫn hạ `SET DEFAULT` trên MySQL, `Z`/`-00:00` thành `+00:00`, vẫn cắt giây lẻ SQL Server về 7 chữ số).
- **Giới hạn đã biết:**
  - `findCascadeConflicts` đếm cả quan hệ mà SQL Server bỏ.
  - Bỏ NUL khỏi giá trị enum PostgreSQL có thể tạo giá trị trùng.
  - Zod không kiểm giá trị `__proto__`.
  - `hasKey` không xử lý key của `json`.
- **Kích thước file chấp nhận:** `relation-graph.ts` khoảng 340 dòng, `target-limit-schema.ts` khoảng 598 dòng.

## 4. Bài học cho orchestrator

- Giới hạn sử dụng làm mọi agent dừng cùng lúc. Tiếp tục từng agent bằng SendMessage. Worktree không có thay đổi bị xóa tự động, nên task đó phải giao lại.
- Conformance cần Docker Desktop đang chạy (`open -a Docker`).
- Worktree mới cần `pnpm --filter @schemaforge/backend generate` trước khi typecheck backend.
- Quy trình tích hợp: commit trong worktree với message của plan, `rebase master`, `merge --ff-only`, `verify.sh core --build --format`, secret-scan, push, `git worktree remove --force --force`, `branch -D`.

## 5. Khởi động nhanh cho session mới

Xem mục 6 của [handoff trước](2026-10-02-codegen-ai-session-handoff.md#6-khởi-động-nhanh-cho-session-mới).
