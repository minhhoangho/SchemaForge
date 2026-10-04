# Bàn giao trạng thái phần 5 (AI Assistant), phiên 3 — 2026-10-04

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc thứ ba của phần 5. Nó thay [2026-10-03-ai-assistant-session-2-handoff.md](2026-10-03-ai-assistant-session-2-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-10-02-ai-assistant-design.md` và plan `document/plans/2026-10-03-ai-assistant-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- Nhánh `master` trùng `origin/master` tại `e7ff297` (`test(frontend): add AI assistant journeys`). Sau khi log này được commit, `master` sẽ nhiều hơn một commit `docs`.
- Không còn worktree nào đang dùng.
- Không có agent nào đang chạy.
- Dev server frontend (cổng 3000) và backend (cổng 3001) thuộc về người dùng. Không được dừng chúng.

## 2. Đã làm trong phiên này (theo commit)

| Commit | Nội dung |
| --- | --- |
| `3a6a92a` | `docs: add ai assistant second review logs` (`review-2`, `security-review-2`, dựng lại từ handoff phiên 2) |
| `f94a585` | `docs: a11y review log for tasks 24-26` |
| `51fac2f` | `fix(frontend): improve contrast and names of AI preview marks and cards` (log `2026-10-04-ai-diff-a11y-fixes.md`): bảng bị xóa dùng viền nét đứt và nền tint thay cho opacity; hàng diff dùng `text-foreground`; `DiffLabel` và chip dùng `text-xs`; thẻ đề xuất có `aria-describedby` trỏ tới trạng thái; thẻ dữ liệu mẫu có tiêu đề và không lặp tên |
| `2a032ab` | `docs: Task 18 and 27a review logs` kèm `security-review-3` |
| `16e799f` + merge `8f26ec4` | `feat(frontend): add AI composer, quick actions and consent` (Task 27a): bộ đếm "{{count}} of {{max}} characters", văn bản sr-only "opens in a new tab", IME `keyCode` 229 |
| `5b1d505` + merge `57db840` | `feat(backend): add the AI chat endpoint` (Task 18) |
| `211f660` | `docs: record AI chat endpoint implementation notes` (spec mục 12, AI-R31) |
| `458609b` | `docs: Task 23 review log` |
| `63a939f` | `test(backend): add AI chat e2e tests` (Task 19): 16 test; toàn bộ e2e 79/79 |
| `65b5c89` + merge `ccf896b` | `feat(frontend): add AI conversation store` (Task 23) |
| `b1a8454` | `docs: add ai assistant task 27b review logs` (project, a11y, react+security) |
| `3a1a5b2` | `feat(frontend): add the AI assistant panel` (Task 27b, kèm ghi chú spec AI-R34) |
| `e7ff297` | `test(frontend): add AI assistant journeys` (Task 28) |

Ghi chú về các commit mới:

- Task 18: các file `ai-chat.service.ts`, `ai-chat-turn.ts`, `ai-turn-parts.ts`, `ai.controller.ts`, `ai-stream-response.ts`, `ai.module.ts` trong `backend/src/modules/ai/`; spec tách thành 3 file cùng `backend/test/ai-chat-fixtures.ts`.
  - M1: request đã bị hủy từ trước trả stream rỗng, không khóa, không trừ ngân sách.
  - M2: 503 kèm `Retry-After` lấy từ `msBeforeNext`; `ai.budget.exhausted` chỉ log một lần mỗi cửa sổ.
  - `tryConsumeGlobalBudget()` trả `{ isAllowed, retryAfterSeconds? }`.
- Task 23: `AI_MAX_STREAMED_TEXT_LENGTH` = 32768, chỉ áp dụng trong store. Lượt lỗi giữ phần văn bản đã nhận, không có proposal. File thêm: `lib/ai-turn-accumulator.ts`.
- Task 27b: thanh preview nằm trong luồng bình thường phía trên canvas, không dùng `useRevealTable`. Thêm `proposal-decision.ts` với `focusProposalCard` (fallback về nút toggle) và `acceptSafely`; thêm `getViewportTransitionDuration()` trong `lib/viewport-controls.tsx`; `addTable` và `addEnum` bị chặn bởi `selectIsPreviewing`; log tin nhắn có `tabIndex=0` và `aria-busy`; hết lượt thì focus trả về composer. Bundle: các entry chunk của editor không chứa code của panel hay `ai`.
- Task 28: `fake-ai-chat.ts`, route `POST /ai/chat` trong fake backend, 3 journey.

Kiểm tra ở lần chạy cuối: backend 556 unit + 79 e2e PASS; frontend 4505 test PASS.

## 3. Việc mở của phần 5

### 3.1. Task 29 (kiểm tra tay với Gemini thật, plan dòng ~1564): CẦN NGƯỜI DÙNG

- Người dùng phải tự đặt `GEMINI_API_KEY` và `GEMINI_MODEL=gemini-3.5-flash` vào `backend/.env`. Orchestrator chỉ kiểm tra rằng chưa có dòng `GEMINI_API_KEY=` nào có giá trị; không đọc hay in nội dung file.
- Chạy bản production: `pnpm build`, backend `pnpm --filter @schemaforge/backend start`, frontend `pnpm --filter @schemaforge/frontend exec next start -p 3000`. Người dùng phải tự dừng dev server của mình trước.
- Danh sách kiểm tra nằm trong plan: Rủi ro 1, 2, 4, 6, 10, 12; AI-01 đến AI-06; S3; bundle.
- Mục a11y thủ công gom từ các review:
  - độ tương phản ở sáng và tối (hàng diff, bảng bị xóa, chữ muted, hộp lỗi, thanh preview);
  - focus ring;
  - cuộn bằng bàn phím trong log tin nhắn;
  - 2.4.11 với thanh preview nhiều hàng (vi/en);
  - trình đọc màn hình (log so với status, focus trở lại sau AlertDialog);
  - vùng bấm tối thiểu 24 px;
  - bộ gõ tiếng Việt (Telex/VNI) trong Chrome và Safari;
  - liên kết consent mở tab mới.
- Mục kiểm tra Gemini: chấp nhận tool JSON Schema keywords (`additionalProperties: false`, `maximum` là số nguyên rất lớn) và tin nhắn assistant rỗng; nút dừng nhả kết nối.
- Log: `document/executions/logs/YYYY-MM-DD-ai-assistant-task-29.md`, do `spec-writer` viết; commit `docs: record AI assistant manual check results`. Nếu phát hiện vấn đề chất lượng, tạo task sửa chỉ `ai.instructions.ts`.

### 3.2. Task 30 (spec-writer)

Cập nhật `architecture.md` và `roadmap.md`, đánh dấu phần 5 xong. Ghi chú triển khai cần đưa vào:

- đặt đúng `TRUST_PROXY_HOPS` khi đứng sau proxy;
- tùy chọn dùng khóa rate limit theo IPv6 /64;
- bộ giới hạn, khóa và ngân sách trong bộ nhớ là theo từng process.

### 3.3. Việc theo dõi (không chặn)

- Thêm test cho seed generator về thoát ký tự quote/backslash và quote định danh (gợi ý từ review bảo mật).
- Memoize các hàng tin nhắn chỉ khi profiling cho thấy tốn kém.
- Bản nháp trong composer bị mất khi đóng panel.
- Bản nháp rename và create-relation bị bỏ khi preview bắt đầu (đã chấp nhận theo Vấn đề 46).
- Focus của hộp xác nhận xóa dùng timer một tick vì `AcceptProposalButton` không lộ `onCloseAutoFocus`.
- Ngân sách toàn cục có thể bị hút cạn bởi khoảng 10 tài khoản (rủi ro dư đã chấp nhận, AI-R55).
- Phần 6 và phần 7 (Import/Export): không đổi so với [handoff phiên 1](2026-10-03-ai-assistant-session-1-handoff.md#3-việc-mở-của-phần-5).

## 4. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

- Chạy Task 18 song song với 27a và 23 (phụ thuộc 13 đến 17 đã xong).
- Bảo mật L4 (giới hạn phía client cho văn bản stream): đặt chỉ trong store của Task 23, không đặt trong `ai-chat-client.ts` vì backend đã chặn tổng đầu ra.
- Bảo mật L2: lượt có văn bản rồi chunk lỗi là lượt thất bại; văn bản giữ lại ở dạng muted, không có proposal hay preview, không đưa vào lịch sử.
- Khóa được nhả cả khi client ngắt kết nối (nhả một lần); lượt bị hủy log `ai.chat.completed` với `outcome: "aborted"`; `AiHistoryTooLargeError` thành 413 `payload-too-large`; request đã hủy từ trước trả stream rỗng, không khóa, không trừ ngân sách; 503 hết ngân sách có `Retry-After`; giới hạn theo người dùng giữ nguyên.
- Dấu diff: bảng bị xóa dùng viền nét đứt và nền tint (không dùng opacity), diễn giải "node mờ" theo cách này; giữ `elementLabel` viết hoa chữ đầu.
- Task 27a: không trim văn bản; bộ đếm không phải live region; IME `keyCode === 229` cũng coi là đang gõ tổ hợp; không có trạng thái "đã đạt giới hạn" hiển thị.
- Task 23: sau khi retry, proposal cũ hơn hiển thị là đã bỏ; `acceptProposal` ném lỗi khi không có preview sống (UI ẩn các nút).
- Task 27b: chấp nhận các file thêm (`ai-chat-stream.ts`, export `buildCountLines`, `use-schema-commands.ts`, `use-reveal-table.ts`, `viewport-controls.tsx`); thanh preview không dùng `useRevealTable`; hộp thoại rename và create-relation đóng mà không commit bản nháp khi preview bắt đầu; focus consent ở lại nút đồng ý; hàng tin nhắn không memoize.
- Task 28: trường lượt giả dùng `isStoppedEarly` (theo quy ước đặt tên của lint), trường trên wire vẫn là `stoppedEarly`.

## 5. Bài học cho orchestrator

Giữ các bài học của [phiên 1](2026-10-03-ai-assistant-session-1-handoff.md#5-bài-học-cho-orchestrator) và [phiên 2](2026-10-03-ai-assistant-session-2-handoff.md#5-bài-học-cho-orchestrator). Bổ sung:

- Worktree do công cụ Agent tạo bị tiến trình Claude khóa: gỡ bằng `git worktree remove -f -f` sau khi merge.
- Commit công việc của worktree trên nhánh riêng của nó bằng `/usr/bin/git -C <worktree>`, rồi merge vào `master`.
- Máy tải khoảng 90 gây timeout Vitest ngẫu nhiên: chạy lại file lỗi bằng `.claude/scripts/test-file.sh` trước khi kết luận. File log tạm còn sót của `verify.sh` từ lần chạy khác có thể hiện dòng FAIL cũ: chỉ tin đường dẫn log của lần chạy hiện tại.
- Các reviewer hay chồng chéo nhau (a11y và react): gộp phát hiện của họ thành một tin nhắn sửa lỗi gửi agent triển khai.
- Giữ ghi chú spec ở dạng chưa commit cho đến khi code chúng mô tả đã merge, rồi commit cùng nhau.

## 6. Khởi động nhanh cho session mới

1. Không có agent nào đang chạy. Đọc log này và chạy `git status` để xác nhận.
2. Hỏi người dùng đã đặt khóa Gemini vào `backend/.env` và dừng dev server của họ chưa.
3. Chạy Task 29 cùng người dùng (mục 3.1), sau đó nhờ `spec-writer` ghi log kết quả.
4. Làm Task 30 (mục 3.2) để đóng phần 5.
