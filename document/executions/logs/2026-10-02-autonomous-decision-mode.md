# Chế độ agent tự quyết định (autonomous decision mode)

Không thuộc plan task nào, nên không có link tới plan hay spec. Đây là thay đổi cấu hình agent trong `.claude/`.

## 2026-10-02 12:55 — general-purpose — Xong
- **Đã làm**
  - Viết lại `orchestrator.md` theo chế độ tự quyết định: Intake chọn cách hiểu hợp lý nhất và nêu giả định; Decompose không chờ duyệt plan/spec; prompt cho subagent yêu cầu tự quyết, ghi vào **Quyết định**, chỉ trả `blocked` khi thật sự bí; viết lại "Decisions from subagents" (orchestrator tự quyết mọi câu hỏi, quyết định quan trọng qua `project-reviewer` + `ecc:security-reviewer`/`ecc:database-reviewer`, đổi kiến trúc/thư viện ghi vào `document/architecture.md`); bỏ báo cáo tick 1 phút (mục Progress reports thành "Monitoring": nudge, rồi TaskStop và dispatch lại); thêm mục "Feature report" trong section 6; Safety chỉ giữ các giới hạn cứng.
  - Sửa `spec-writer.md`: các dòng bắt dừng chờ user (⚠, câu hỏi mở, "không tự quyết định thuộc về user") thành tự quyết, ghi lại và đánh dấu ⚠ để user có thể đảo ngược.
- **File thay đổi**
  - `.claude/agents/orchestrator.md`
  - `.claude/agents/spec-writer.md`
  - `document/executions/logs/2026-10-02-autonomous-decision-mode.md`
- **Kiểm tra**
  - `grep -rniE` các cụm `ask the user|escalat|major choice|user's to make|confirm with the user|wait for the user|waiting on the user|decisions awaiting` trong `.claude/agents` và `.claude/rules`: chỉ còn các dòng được giữ có chủ đích (ngoại lệ ambiguity ở Intake, "Escalation" model tier, Safety hard limits trong orchestrator, `git.md` dòng 38).
  - Đã rà: toàn bộ `.claude/agents/*.md` (ai, backend, core, debugger, devops, frontend, orchestrator, project-reviewer, spec-writer, test-engineer, ui-a11y-reviewer) và `.claude/rules/*.md` (code-quality, core, execution-logs, git, nestjs, nextjs, prisma, react, security, testing, typescript).
  - `pnpm prettier --check` chạy sau `nvm use`, nhưng `.prettierignore` có `*.md` nên các file markdown không được Prettier kiểm tra.
- **Quyết định**
  - Giữ nguyên các dòng Safety: `git.md` (force push, xoá remote branch cần user xác nhận) và `devops-engineer.md` (không tự đổi cấu hình GitHub/secrets/hosting) vì là giới hạn cứng.
  - Giữ các mục "Open questions" trong format báo cáo của agent: đó là kênh báo lại cho orchestrator, không phải chờ user; orchestrator tự quyết theo section 4.
  - Dòng "thiếu script chung thì báo open question" ở orchestrator đổi thành tự quyết và ghi lại; ở các agent khác giữ nguyên vì orchestrator trả lời.
- **Ghi chú cho người tiếp theo**: `project-reviewer` nên rà lại `orchestrator.md` nếu cần; không commit trong task này, orchestrator/user commit theo `.claude/rules/git.md`.
