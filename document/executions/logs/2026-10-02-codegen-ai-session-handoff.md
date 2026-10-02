# Bàn giao trạng thái phần 6 (Code generators) và phần 5 (AI Assistant) — 2026-10-02

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc ngày 2026-10-02. Nguồn công việc của phần 6 là spec `document/specs/2026-09-14-code-generators-design.md` và plan `document/plans/2026-09-15-code-generators-plan.md`; phần 5 có spec `document/specs/2026-10-02-ai-assistant-design.md` (chưa có plan).

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- Nhánh `master`, đã push. HEAD = `5530cf5`.
- 9 commit của phần 6 trong phiên này, theo thứ tự cũ → mới:

```
69ba87e  Task 1
6ebd8ab  Task 2
9bf44ce  Task 5
eee4045  docs: spec Task 0 decisions R1–R18
ad27b1b  docs: plan update for local conformance and new rules
c00386d  Task 3
4f980b2  Task 6
30334cd  Task 36
5530cf5  Task 7
```

Kiểm tra trên `master` tại `5530cf5`:

| Lệnh | Kết quả |
|---|---|
| `verify.sh core --build --format` | PASS (1026 test) |
| frontend | PASS (3435 test) |
| backend typecheck | OK |
| `pnpm format:check` | pass |
| secret-scan | CLEAN |

Working tree **chưa sạch**: có các tài liệu agent còn đang viết, chưa commit.

| File | Trạng thái |
|---|---|
| `document/plans/2026-09-15-code-generators-plan.md` | đang viết thân Task 17–35 |
| `document/specs/2026-10-02-ai-assistant-design.md` | spec phần 5 đang sửa sau review |
| `document/executions/logs/2026-10-02-ai-assistant-spec.md` | log của agent sửa spec phần 5 |

---

## 2. Phần 6 "Code generators"

### 2.a. Đã xong và đã push

Task 0 (spec), Task 1, 2, 3, 5, 6, 7, 36.

### 2.b. Đang chạy lúc bàn giao

Các agent này báo kết quả về session; orchestrator mới phải tích hợp kết quả của chúng.

| Agent | Việc | Log / ghi chú |
|---|---|---|
| spec-writer | Viết thân plan Task 17–35 và bảng "Đối chiếu tiêu chí hoàn thành" | `2026-10-02-code-generators-plan-pass-2.md`. Có thêm quyết định: `parseSeedDataset` nằm trong Task 21 hoặc 22, export từ `@schemaforge/core/generators/seed`. Khi xong: chạy `project-reviewer` cho toàn bộ plan, rồi commit `docs: complete code generators plan` |
| core-engineer (worktree dưới `.claude/worktrees/`) | Task 12: quy tắc kiểu và khóa theo dialect | `2026-10-02-code-generators-task-12.md` |
| project-reviewer | Review dải commit nền đã merge `823aefb..5530cf5` | Phát hiện của nó thành các task sửa; spec-writer viết log của nó |

### 2.c. Hàng đợi, sẵn sàng (phụ thuộc đã merge)

- Task 9: tên ràng buộc (phụ thuộc 6).
- Task 10: biểu diễn JSON và REST resources (phụ thuộc 2 và 6).
- Task 11: đồ thị quan hệ (phụ thuộc 2 và 6).
- Task 4: fixtures (phụ thuộc 36, đã merge).

Sau đó: Task 8 (khung conformance và probe Docker cục bộ; phụ thuộc 3 và 4), rồi Task 13 trở đi theo bảng task của plan.

---

## 3. Phần 5 "AI Assistant"

Spec `document/specs/2026-10-02-ai-assistant-design.md` do hai lượt spec-writer viết (lượt đầu dừng `partial`). Đã review:

- `project-reviewer`: accept with follow-ups (4 should-fix, 6 nit).
- `ecc:security-reviewer`: accept with follow-ups (H1 khuếch đại chi phí, H2 chi phí validate đồng bộ, M1 rò rỉ stream và log, M2–M5, L1–L4).

Một spec-writer đang áp dụng mọi bản sửa. Log: `2026-10-02-ai-assistant-spec.md`. Nó cũng viết `2026-10-02-ai-assistant-spec-review.md`, thêm các hàng AI vào bảng "Chưa chốt" của `architecture.md`, và đặt phần 5 trong `roadmap.md` thành "Xong spec" với phụ thuộc `6 (chỉ AI-06)`.

Khi nó xong: kiểm tra lại, commit `docs: add ai assistant spec`. Bước tiếp: plan phần 5 (spec-writer), rồi review.

Quyết định do orchestrator và spec-writer đưa ra thay người dùng (người dùng có thể bác bỏ):

- Giới hạn theo user: 10/phút và 100/giờ.
- Giới hạn toàn cục: 1000/giờ (biến môi trường `AI_GLOBAL_REQUESTS_PER_HOUR`).
- Giới hạn theo IP: 20/phút và 200/giờ.
- Một stream đồng thời cho mỗi user.
- Prompt chứa schema tối đa 80k ký tự.
- `maxRetries` = 1.
- Tối đa 30 lần gọi tool mỗi lượt; ngân sách benchmark p95 ≤ 25 ms mỗi lần gọi.
- Allowlist chunk của stream; `sendReasoning` và `sendSources` đặt `false`; `onError` chỉ log mã lỗi.
- Bước xác nhận khi đề xuất xóa bảng hoặc cột.
- Đồng ý một lần cho mỗi tài khoản trước lần gửi đầu tiên.
- Gemini bản trả phí là điều kiện tiên quyết khi deploy.
- Backend không lưu chat.
- Thư viện: `ai` 7.0.126 và `@ai-sdk/google` 4.0.87.

---

## 4. Quyết định đã thay người dùng trong phiên này (phần 6)

- **Issue 8:** SQL Server cắt phần giây thập phân còn 7 chữ số; MySQL cắt còn 6 (R15). Không đổi phần 2.
- **Issue 10 và 12:** thêm hai issue mới cho phần 2: `index-name-conflicts-table` và `table-columns-empty`. `ISSUE_CODES` nay có 27 mã.
- Chẩn đoán thứ 17: `comment-truncated`.
- Quy tắc MySQL:
  - Cột thuộc khóa thành `VARCHAR(768)`.
  - Khóa vượt 3072 byte thì bị bỏ.
  - Kích thước hàng vượt 65535 byte: cột không thuộc khóa thành `LONGTEXT`.
  - Cột AUTO_INCREMENT không mở đầu index nào thì thêm index thường tên `<table>_<col>_idx`.
  - So sánh định danh gấp các ký tự `đ`/`ø`/`ł`/`ħ`.
- Quy tắc SQL Server: `nchar` → `nvarchar` khi kích thước khóa cố định vượt 900 hoặc 1700 byte; thay đổi lan sang cột đối tác của FK.
- Khoảng hở đã chấp nhận: trùng tên sequence của identity trong PostgreSQL.
- Conformance chạy cục bộ bằng Docker, không có CI. Cổng kiểm được mô tả ở spec R3.
- Task 36 là một commit xuyên package.
- Đường dẫn code panel: `frontend/src/features/editor/code-generator/`.

---

## 5. Bài học cho orchestrator

1. Trong worktree, hook rtk và agent guard chặn `git` trần và `source ~/.nvm/nvm.sh`. Dặn agent dùng `/usr/bin/git` và `.claude/scripts/*`.
2. Worktree mới cần `pnpm --filter @schemaforge/backend generate` trước khi typecheck backend; `worktree-setup.sh` không chạy lệnh này. Cân nhắc thêm vào, như một task nhỏ về cấu hình `.claude/` cho general-purpose.
3. Cách tích hợp worktree: commit trong worktree bằng thông điệp của plan, `git -C <wt> rebase master`, `git merge --ff-only`, chạy lại kiểm tra trên `master`, push, rồi `git worktree remove --force --force` và `git branch -D`.
4. Spec-writer và plan-writer chạm ngân sách ngữ cảnh khi tài liệu lớn. Dự kiến `partial` và tiếp tục bằng agent mới trỏ vào log.

---

## 6. Khởi động nhanh cho session mới

Từ repo gốc `/Users/hominhhoang/Documents/Work/01_Software-development/01_Github_minhhoangho/SchemaForge`:

```bash
source ~/.nvm/nvm.sh && nvm use
```

Kiểm tra:

```bash
.claude/scripts/verify.sh core --build --format
.claude/scripts/verify.sh frontend
pnpm format:check
.claude/scripts/secret-scan.sh
```

Tin nhắn đầu tiên gợi ý cho orchestrator: hỏi trạng thái ba agent đang chạy (mục 2.b) và hai spec-writer (plan phần 6 pass 2, spec phần 5); tích hợp kết quả, rồi giao các task đã sẵn sàng ở mục 2.c.

Chỉ push sau khi các lệnh kiểm tra ở trên PASS (`.claude/rules/git.md`).
