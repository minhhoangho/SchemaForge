# Bàn giao trạng thái phần 5 (AI Assistant), phiên 4 — 2026-10-05

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc thứ tư của phần 5. Nó thay [2026-10-04-ai-assistant-session-3-handoff.md](2026-10-04-ai-assistant-session-3-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-10-02-ai-assistant-design.md` và plan `document/plans/2026-10-03-ai-assistant-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- Nhánh `master` trùng `origin/master` tại `62e34db` (`docs: record floating AI assistant design and reviews`). Không có worktree nào đang dùng.
- Không có agent nào đang chạy.
- Dev server frontend (cổng 3000) và backend (cổng 3001) thuộc về người dùng. Không được dừng chúng.

## 2. Đã làm trong phiên này (theo commit)

| Commit | Nội dung |
| --- | --- |
| `a9eb792` | `test(core): seed SQL escaping of adversarial values` (kiểm tra tay độc lập, không do plan yêu cầu) |
| `d2a9bb0` | `fix(backend): AI keeps existing schema elements unless asked` (Task 29, sửa chất lượng trong `ai.instructions.ts`) |
| `2fe8328` | `docs: Task 30 — update roadmap.md and architecture.md` (phần 5 đánh dấu Xong, ghi chú triển khai) |
| `ca33942` | `docs: Task 29 manual-check log` (16 mục cần thực hiện, nhiều vẫn Chưa chạy, dev server chạy) |
| `ffb1b1a`, `6be393e` | `docs: AI chat bubble and floating window mockup` (UI reference HTML, approved by user) |
| `f49ceeb` | `feat(frontend): float AI bubbles and add launcher` (Task 3, bubble list + chat, launcher + window) |
| `46a4a72` | `feat(frontend): float the AI assistant over the canvas` (Task 4, window UI; merge `832545d`) |
| `1e1e6de` | `fix(frontend): lighten focus rings across the app` (sửa chất lượng: light `--ring` = `var(--primary)`, dark `oklch(0.58 0.11 258)`, áp dụng trên input/select/button/list) |
| `7fe1c94` | `fix(frontend): harden the floating AI assistant window` (Task 6, quality fixes: timestamp, draft store, modal sheet narrow, code mode below lg, IME Escape, node pan, announcement, unread indicator, focus fallback, split `ai-window-actions.ts`) |
| `62e34db` | `docs: record floating AI assistant design and reviews` (ghi chú spec, ring row trong architecture.md, review logs) |

Kiểm tra ở lần chạy cuối:
- Frontend: 4587 unit test PASS
- Typecheck, lint, format: PASS
- Build: PASS (agent run)
- Bundle: editor entry chunks không chứa code của panel hay SDK `ai`
- Secret scan: CLEAN

## 3. Việc mở của phần 5

### 3.1. Task 29 (kiểm tra tay với Gemini thật, plan dòng ~1564): CẦN NGƯỜI DÙNG

- Người dùng phải tự đặt `GEMINI_API_KEY` và `GEMINI_MODEL=gemini-3.5-flash` vào `backend/.env`. Orchestrator chỉ kiểm tra rằng chưa có dòng `GEMINI_API_KEY=` nào có giá trị; không đọc hay in nội dung file.
- Chạy bản production: `pnpm build`, backend `pnpm --filter @schemaforge/backend start`, frontend `pnpm --filter @schemaforge/frontend exec next start -p 3000`. Người dùng phải tự dừng dev server của mình trước.
- Log `2026-10-04-ai-assistant-task-29.md` ghi danh sách 16 mục cần kiểm tra (mục 2.2 trong log), nhiều vẫn Chưa chạy (CSP trên production, AI-02/03/05/06 với real Gemini, S3, a11y thủ công, re-run e-commerce prompt trên schema với `table_1`).
- Nếu phát hiện vấn đề chất lượng, tạo task sửa chỉ `ai.instructions.ts` (như `d2a9bb0`).

### 3.2. Task 30 (spec-writer) — ĐÃ XONG

Cập nhật `architecture.md` và `roadmap.md` đã hoàn tất trong commit `2fe8328`. Phần 5 đánh dấu `Xong`, ghi chú triển khai:
- đặt đúng `TRUST_PROXY_HOPS` khi đứng sau proxy;
- tùy chọn dùng khóa rate limit theo IPv6 /64;
- bộ giới hạn, khóa và ngân sách trong bộ nhớ là theo từng process.

### 3.3. Việc theo dõi (không chặn)

- Thêm test cho seed generator về thoát ký tự quote/backslash và quote định danh (đã làm trong `a9eb792`).
- Manual browser checks cho floating window (ghi chú từ review-2 log).
- Người dùng thấy raw key `panel.emptyTitle` / `panel.emptyBody` trên dev server — khóa tồn tại và test assert văn bản; khuyên restart `pnpm dev` (tài nguyên i18n cũ); chưa xác nhận.
- Memoize hàng tin nhắn chỉ khi profiling cho thấy tốn kém.
- Bản nháp trong composer bị mất khi đóng panel (Vấn đề 46, đã chấp nhận).
- Bản nháp rename và create-relation bị bỏ khi preview bắt đầu (đã chấp nhận).
- File quá dài: `editor-workspace.tsx` (~563 dòng), `create-ai-chat-store.ts` (~341 dòng).
- Launcher hiển thị ngắn dưới sheet khi thoát (nit).
- `use-is-narrow-viewport` gọi `getSnapshot` mỗi lần đọc (thấp).
- Dynamic import không có retry (đã chấp nhận).
- Ngân sách toàn cục có thể bị hút cạn bởi khoảng 10 tài khoản (rủi ro dư đã chấp nhận, AI-R55).
- Phần 6 và phần 7 (Import/Export): không đổi so với [handoff phiên 1](2026-10-03-ai-assistant-session-1-handoff.md#3-việc-mở-của-phần-5).

## 4. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

- Task 29 chấp nhận từ dev server của người dùng với các mục kiểm tra không chạy được ghi lại.
- Sửa chất lượng chỉ trong `ai.instructions.ts` (Task 29 không xây dựng thêm cơ sở hạ tầng).
- Thiết kế floating window: kích thước 380px (rộng) × 520px (cao), nút AI từ toolbar loại bỏ, minimap dưới trái, sheet modal hẹp fullscreen trên mobile.
- Thời gian hiển thị dưới bubble cuối cùng của mỗi nhóm (không phải hover).
- Bản nháp giữ lại khi đóng window.
- Thiết kế lại focus ring toàn ứng dụng: sáng `var(--primary)`, tối `oklch(0.58 0.11 258)` (nâng cao để vượt 3:1 trên accent).

## 5. Bài học cho orchestrator

Giữ các bài học của các phiên trước. Bổ sung:

- Auto-mode classifier từ chối bulk edit trên file shared (`components/ui/*`, `globals.css`) — bảo agent chỉnh sửa từng file một với Edit tool, hỏi người dùng khi bị từ chối.
- Parallel `verify.sh` chạy va chạm trên `frontend/coverage` — đợi và chạy lại.
- Chạy task worktree song song trên file không trùng lặp, sau đó merge với task tích hợp riêng.
- Batch finding từ reviewer trùng lặp thành một round sửa.

## 6. Khởi động nhanh cho session mới

1. Không có agent nào đang chạy. Đọc log này và chạy `git status` để xác nhận.
2. Phần 5 đã xong. Hỏi người dùng tiếp theo là gì:
   - Thực hiện manual checks từ Task 29 (mục 3.1)?
   - Viết plan cho phần 7 (Import/Export)?
   - Bắt đầu phần 8 hay 9?
