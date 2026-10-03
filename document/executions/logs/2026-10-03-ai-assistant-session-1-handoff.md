# Bàn giao trạng thái phần 5 (AI Assistant), phiên 1 — 2026-10-03

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc đầu tiên của phần 5. Nó thay [2026-10-03-codegen-session-4-handoff.md](2026-10-03-codegen-session-4-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-10-02-ai-assistant-design.md` và plan `document/plans/2026-10-03-ai-assistant-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- Nhánh `master` trùng `origin/master` tại `509b45a`.
- Không có agent nào đang chạy và không còn worktree.
- Dev server frontend (cổng 3000) và backend (cổng 3001) thuộc về người dùng và vẫn đang chạy. Không được dừng chúng.
- Kiểm tra trên master đã merge: `verify.sh core frontend backend --build` cho `RESULT: PASS`, `SECRET-SCAN: CLEAN`. Backend e2e 62/62 pass sau Task 13.

## 2. Đã làm trong phiên này (theo commit)

### 2.a. Sửa lỗi và hoàn tất phần 6

- `e30d6f3` `fix(frontend)`: code panel rộng toàn chiều ngang dưới breakpoint `lg` (canvas ẩn ở chế độ code). Đã kiểm tra trong trình duyệt ở 500, 768 và 1440 px.
- `487d867` `fix(frontend)`: toolbar không còn làm trang rộng ra (`relative` + `overflow-x-auto`). Test `editor-screen.test.tsx` về xung đột bị flaky đã sửa bằng `asyncUtilTimeout` 4000 trong nhóm đó. Đã kiểm tra ở 360 px.
- `aa09e2d` `fix(core)`: seed SQL Server giới hạn số thập phân ≤ 38 chữ số; thoát chuỗi T-SQL cho backslash đi cùng xuống dòng.
  - Người dùng quyết định 2026-10-03: KHÔNG chạy SQL Server trên DB thật, kiểm tra bằng đọc code (log `2026-10-03-sqlserver-code-check.md`).
  - Conformance trừ SQL Server: 15/15 file, 142 test pass.
- `ac149af` `docs`: phần 6 "Code generators" là "Xong" trong roadmap (R34 trong spec).
- `a06c14f` `chore`: `verify.sh` dùng prettier `--ignore-unknown`.

### 2.b. Plan phần 7 và phần 5

- `23b981f` `docs`: plan phần 7 Import/Export (34 task); review accept-with-fixes, mọi sửa đã áp dụng.
- `684c782` `docs`: phần 7 chặn import bằng `selectIsPreviewing` khi AI đang xem trước; thêm thứ tự kiểm tra ở mục 12 của spec AI.
- `508e5a6` `docs`: plan phần 5 AI (31 task). `project-reviewer` và `ecc:security-reviewer` đều accept-with-fixes, mọi sửa đã áp dụng, gồm tách Task 27 thành 27a và 27b. Log review: `2026-10-03-ai-assistant-plan-review.md`, `2026-10-03-ai-assistant-plan-security-review.md`.
- `a328aa8` `docs`: `proposeSampleData` dùng cặp `{column, value: string|null}` (phương án dự phòng của Vấn đề 22). Lý do: Zod 4.6.4 bỏ các khóa `__proto__` của record, và `z.json()` ném `RangeError` khi lồng quá sâu.

### 2.c. Triển khai phần 5 đã merge

| Task | Commit | Nội dung |
| --- | --- | --- |
| 12 | `2b72047` | Biến môi trường Gemini |
| 1 | `7ed3e92` | `diffSchemas` |
| 11 | `d23a7b0` | Ghim `ai` 7.0.126 và `@ai-sdk/google` 4.0.87; các luật cấm trong lint frontend |
| 10 | `2b2b48e` | `api-contract` `ai.ts`, mã lỗi |
| 13 | `32ec307` | Chính sách rate limit AI, `ApiException` có `retryAfterSeconds` |
| 2 | `b654929` | Subpath `core/ai`, 18 hình dạng đầu vào tool |
| 22 | `509b45a` | Store xem trước đề xuất AI, `selectIsPreviewing` trong `create-editor-store.ts` |

Log từng task nằm ở `document/executions/logs/2026-10-03-ai-assistant-task-<N>.md`.

## 3. Việc mở của phần 5

Plan: `document/plans/2026-10-03-ai-assistant-plan.md`.

1. **Bước đầu tiên: review code đã triển khai.** Chưa có lượt `project-reviewer` nào cho code đã merge. Dispatch `project-reviewer` trên dải commit `508e5a6..509b45a`, cùng `ecc:security-reviewer` cho Task 12 và Task 13.
2. **Sẵn sàng làm ngay** (phụ thuộc đã merge):
   - Task 3 (core-engineer, phụ thuộc Task 2);
   - Task 17 (ai-engineer, phụ thuộc Task 10 và 11);
   - Task 20 (frontend-engineer, phụ thuộc Task 10).
3. **Đợt 3:** Task 4, 6, 7, 8, 14. Các task sau theo bảng task của plan; đường găng là 2 → 3 → 4 → 5 → 16 → 18 → 19 → 29 → 30.
4. **Task 29 cần người dùng:** khóa Gemini thật và các kiểm tra tay.
5. **Phần 7 (Import/Export)** bắt đầu sau phần 5. Plan của nó đã phụ thuộc vào `selectIsPreviewing` của Task 22 phần 5.
6. **Còn lại của phần 6** (không chặn): kiểm tra tay trên production:
   - sinh cả 10 target trên `next start`;
   - xem tab Network để tìm request ra ngoài;
   - `createLargeSchema({ tableCount: 200 })` cho code xuất hiện trong ≤ 1 s.

## 4. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

- SQL Server chỉ kiểm tra bằng đọc code, không chạy DB thật.
- Màn hình hẹp (dưới 1024 px) ẩn canvas ở chế độ code.
- Làm phần 5 trước phần 7.
- Ghim `ai` ở 7.0.126 (changelog của 7.0.127 không có bản vá bảo mật).
- Tool dữ liệu mẫu dùng cặp cột/giá trị.
- Giới hạn độ dài prompt AI đo sau khi thoát ký tự, với issues giới hạn 50.
- Thứ tự kiểm tra của AI: model → lock → 422 → 413 → budget.
- Dispatch trong lúc AI xem trước là no-op phòng thủ, phía sau một khóa UI đầy đủ.
- Test flaky sửa bằng `asyncUtilTimeout`.
- Chúng ta không đổi VM Docker.

## 5. Bài học cho orchestrator

Giữ các bài học của phiên trước vẫn còn đúng (xem mục 4 của [handoff phiên 4 phần 6](2026-10-03-codegen-session-4-handoff.md#4-bài-học-cho-orchestrator)). Bổ sung:

- Hook GateGuard chặn từng lệnh phá hủy (xóa worktree, `branch -D`) cho đến khi thông điệp ngay trước lần thử lại nêu sự thật: file bị xóa, cách rollback, và nguyên văn chỉ thị gần nhất của người dùng.
- Subagent trong worktree không chạy được `source ~/.nvm/nvm.sh` (sandbox); Node 24 là mặc định nên không sao. Một số không chạy được git (hook rtk): orchestrator commit trong worktree bằng `git -C`.
- `worktree-setup.sh` không chạy `prisma generate`; kiểm tra backend trong worktree mới cần `pnpm --filter @schemaforge/backend generate`.
- Worktree thiếu `backend/.env.test`, nên backend e2e phải chạy ở cây chính sau khi ff-merge cục bộ, trước khi push.
- `verify.sh` và `test-file.sh` không nhận `api-contract`; dùng `pnpm turbo run typecheck lint test build --filter @schemaforge/api-contract`.
- Chạy Vitest song song giữa các worktree gây timeout (ví dụ `editor-workspace.test.tsx`); chạy lại riêng lẻ trước khi kết luận.
- Agent còn việc nền có thể gửi lại báo cáo cuối nhiều lần; bỏ qua bản trùng.
- Quy trình tích hợp: `git -C <wt> add/commit` → `git -C <wt> rebase master` → `git merge --ff-only <branch>` → verify → push → xóa worktree (`unlock`, `remove --force`, `rm -rf`, `branch -D`, `prune`).
- Tham số công cụ giải mã thực thể HTML (ví dụ `&lt;` thành `<`): khi một chuỗi escape chính xác quan trọng trong tài liệu hay code, hãy kiểm tra byte thô bằng `grep`.

## 6. Khởi động nhanh cho session mới

1. Đọc log này, rồi chạy `git status`.
2. Dispatch review ở mục 3.1 trước.
3. Sau đó dispatch Task 3, 17 và 20 trong worktree (mỗi task một worktree từ HEAD cục bộ).
