# Chuyển resolveIssueTarget và toIssueMessageValues sang lib/

Plan: [Task 21](../../plans/2026-10-03-import-export-plan.md) · Spec: [import-export](../../specs/2026-09-15-import-export-design.md)

## 2026-10-05 — frontend-engineer — Xong
- **Đã làm**: chuyển `resolve-issue-target.ts` (+ test) và `issue-message-values.ts` sang `frontend/src/lib/schema/`; thêm `issue-message-values.test.ts` (2 test theo plan); xóa `toInterpolation` trong `relation-issue-messages.tsx`, gọi `toIssueMessageValues`; cập nhật import sang `@/lib/schema/...`.
- **File thay đổi**: `frontend/src/lib/schema/{resolve-issue-target.ts,resolve-issue-target.test.ts,issue-message-values.ts,issue-message-values.test.ts}`; import trong `features/editor/` các file: `components/panels/{issue-list-tab,enum-list-tab,relation-issue-messages}.tsx`, `components/panels/table-panel/use-field-error-message.ts`, `hooks/use-go-to-issue.ts`, `lib/issue-index.ts`, `code-generator/generator-diagnostic-list.tsx`.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --build --format` (kết quả trong báo cáo); grep danh sách file khớp plan, không có caller mới từ part 5.
- **Quyết định**: dùng `mv` thay `git mv` (hook chặn git trong worktree), git tự nhận rename; `issue-message-values.test.ts` kiểm tra hai hành vi theo plan.
- **Ghi chú cho người tiếp theo**: `worktree-setup.sh` phải chạy trước verify (cần build api-contract/core).
