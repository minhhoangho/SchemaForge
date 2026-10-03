# Bàn giao trạng thái phần 5 (AI Assistant), phiên 2 — 2026-10-03

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc thứ hai của phần 5. Nó thay [2026-10-03-ai-assistant-session-1-handoff.md](2026-10-03-ai-assistant-session-1-handoff.md) làm handoff mới nhất. Nguồn công việc là spec `document/specs/2026-10-02-ai-assistant-design.md` và plan `document/plans/2026-10-03-ai-assistant-plan.md`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan.

---

## 1. Trạng thái git

- Nhánh `master` trùng `origin/master` tại `421ac44` (`perf(core): reuse schema validation results across AI edits`).
- Không còn worktree nào đang dùng.
- Không có agent nào đang chạy.
- Dev server frontend (cổng 3000) và backend (cổng 3001) thuộc về người dùng. Không được dừng chúng.

## 2. Đã làm trong phiên này (theo commit)

### 2.a. Review

- `project-reviewer` trên dải đã merge `508e5a6..509b45a`: accept-with-fixes (log `2026-10-03-ai-assistant-merged-review.md`).
- `ecc:security-reviewer` cho Task 12 và 13: accept (log `2026-10-03-ai-assistant-security-review-12-13.md`).
- Hai log trên đã commit ở `9ddb9f8` `docs: add ai assistant merged code review logs`.
- `20600b9` `fix(core)`: khôi phục `AI_MAX_SAMPLE_DEPTH` (sửa từ review).
- Lượt `project-reviewer` thứ hai trên `b9f695a..c0325ad`: accept-with-fixes. Log `document/executions/logs/2026-10-03-ai-assistant-review-2.md` CHƯA được viết.
- Lượt `ecc:security-reviewer` thứ hai cho Task 14, 15, 17, 21: accept-with-fixes, không có Critical hay High. Log `document/executions/logs/2026-10-03-ai-assistant-security-review-2.md` CHƯA được viết.
- Nội dung hai log còn thiếu nằm ở mục 3 (các việc sửa và việc theo dõi); viết chúng ở các bước đầu của session mới, nhờ `spec-writer`, từ tóm tắt đó cộng với báo cáo review nếu orchestrator còn giữ.

### 2.b. Triển khai phần 5 đã merge

| Task | Commit | Nội dung |
| --- | --- | --- |
| 20 | `bb226eb` | Bản dịch AI và token màu diff của frontend |
| 14 | `c4f49d8` | Nền module AI backend (`feat(backend): add AI module foundation`) |
| 17 | `3296505` | Map lỗi stream AI và lọc chunk stream |
| 3 | `c5f1fd6` | Resolve tên AI, đặt bảng AI, mô tả đường đi |
| 7 | `35280f7` | Findings dựng từ tên bảng và cột |
| 8 | `302515c` | Bộ dữ liệu mẫu AI kiểm tra bằng seed validation |
| 6 | `17fa7a2` | Mô tả schema và thay đổi cho AI (compact view) |
| 4 | `471d63b` | Dịch edit bảng, cột, index, enum của AI |
| 15 | `8500bab` | System instructions và prompt builder của AI |
| (spec) | `e619daf` | `docs`: ghi nhận compact AI schema view và instruction codes (AI-R28, AI-R30, mục 5) |
| 21 | `1821dc3` | Stream client chat AI của frontend |
| 5 | `29bae33` | Dịch edit quan hệ của AI |
| 24 | `c0325ad` | Đánh dấu thay đổi của đề xuất AI trên canvas |
| 26 | `db0f62a` | Thẻ dữ liệu mẫu AI |
| 25 | `56d3e5f` | Thẻ đề xuất và thẻ findings của AI |
| F2 | `d50b6f9` | Tách `ai-chat-client.ts`: phần dựng request sang `ai-chat-request.ts` |
| F3 | `fa72455` | `fix(core): report duplicate AI column names and split long translators` (log `2026-10-03-ai-edit-review-fixes.md`) |
| F4 | `7c1952c` | `fix(backend): bound escaped AI history and strip forged outcome markers` |
| 9 | `f295096` | `test(core): add property and performance tests for AI edits` |
| 16 | `9411131` | `feat(backend): add AI tools over the per-turn draft` |
| (perf) | `421ac44` | `perf(core): reuse schema validation results across AI edits` |

Ghi chú về các commit mới:

- F3: hành vi đổi đã được chấp nhận. `createTable` có tên cột trùng nay trả một lỗi `column-name-duplicate` tại `["columns", i, "name"]` (trước đây là hai issue ở đường dẫn của document). `ai-edit-tables.ts` (301 dòng) và `ai-edit-relations.ts` (300 dòng) đã chạm giới hạn kích thước: logic mới phải vào file mới.
- F4: thêm `AI_MAX_ESCAPED_HISTORY_LENGTH` = 120 000 và `AiHistoryTooLargeError` trong `ai-prompt.ts`. Khoảng hở đã chấp nhận: marker giả mạo bằng dấu kết hợp (ví dụ `thís`) không bị gỡ, vì gỡ `\p{Mn}` sẽ phá tiếng Việt; tác động chỉ nằm trong lượt của chính người dùng.
- Task 9: property test đều pass, không phát hiện lỗi. Benchmark ban đầu cho thấy ngân sách AI-R57 (p99 ≤ 25 ms mỗi lần gọi `applyAiEdit` trên `createLargeSchema({ tableCount: 73 })`) chưa đạt. Việc sửa hiệu năng sau đó giải quyết vấn đề.
- Task 16: `feat(backend): add AI tools over the per-turn draft`. Files: `backend/src/modules/ai/ai-tools.ts`, `ai-tools-descriptions.ts` (tách ra để dưới 300 dòng), `ai-tools.spec.ts`, `ai-sdk-behavior.spec.ts`, `backend/test/mock-ai-model.ts` với `createScriptedModel`, `createFailingModel`, `scriptedText`, `scriptedToolCall`, `scriptedFinish` cho Tasks 18/19. Probes cho rủi ro 2, 3, 9, 12 đã pass.
- Perf `421ac44`: `perf(core): reuse schema validation results across AI edits`. Dùng `WeakMap` cache bên trong `validateSchema` keyed by document object; kết quả là frozen shared arrays. Benchmark p99 giờ là 13.9–17.4 ms so với 25 ms budget, AI-R57 đã pass. Tests core 3009, frontend 4326, backend 509 pass, RESULT: PASS.

Log từng task nằm ở `document/executions/logs/2026-10-03-ai-assistant-task-<N>.md`.

## 3. Việc mở của phần 5

### 3.1. Đã hoàn thành

Tất cả agent đã hoàn thành. Logs chi tiết ở `document/executions/logs/`:
- `2026-10-03-ai-edit-validation-cache.md`: sửa hiệu năng validation với WeakMap cache.
- `2026-10-03-ai-assistant-task-16.md`: Task 16 tools.

### 3.2. Đang xếp hàng

1. `ui-a11y-reviewer` trên:
   - dấu diff của Task 24: chữ trên nền `bg-diff-*/10` trong `column-row.tsx`, nhãn `text-[0.625rem]` trong `table-node.tsx`, khóa `ai:diff.elementLabel`;
   - UI của Task 25 và 26.
2. Task 27a (composer, quick actions, consent; frontend).
3. Task 23 (conversation store; phụ thuộc Task 21 và 22 đã xong).
4. Sau đó: Task 18, 27b, 19, 28, 29 (cần người dùng: khóa Gemini thật và kiểm tra tay), 30.

### 3.3. Task 18 PHẢI có (từ review bảo mật 2 và ghi chú các task trước)

- `streamText` và `toUIMessageStream` đều có `onError` tường minh, chỉ log `{ code, errorName, statusCode }` và trả về `toAiStreamErrorCode(error)`. Không bao giờ log đối tượng lỗi, `cause`, `lastError`: `APICallError` mang toàn bộ prompt trong `requestBodyValues`. Test bằng một `APICallError` giả có body chứa chuỗi sentinel.
- Thứ tự: khóa stream theo người dùng, rồi rate limit theo người dùng, rồi ngân sách toàn cục.
  - Nhả khóa trong `finally` và trong `res.on("close")`; có test cho stream ném lỗi và cho client hủy giữa chừng.
  - Khóa null thì ném `ApiException` `too-many-requests` với `retryAfterSeconds: AI_BUSY_RETRY_AFTER_SECONDS`.
  - Thêm `AiCapacity` vào providers của module.
- Dựng prompt và gọi `parseSchemaDocument` TRƯỚC khi gửi header SSE.
  - `AiPromptTooLargeError` thành `413 ai-schema-too-large`.
  - `AiHistoryTooLargeError` thành `ApiErrorCode` hiện có `payload-too-large` (413), trước khi mở stream. `validation-failed` không phù hợp vì body của nó cần `fields`.
- Client hủy (`AbortError`) im lặng, không gửi chunk lỗi. Timeout không bao giờ vào `onError`: đọc lý do trong `onAbort` và gửi `ai-timeout` qua `toAiStreamErrorCode` (phát hiện của Task 17: `DOMException` tên `TimeoutError`).
- Route AI không bao giờ `@Public`. Thêm `{ method: "POST", path: "/ai/chat" }` vào `PRIVATE_ROUTES` trong `backend/test/security.e2e-spec.ts`.
- **Từ Task 16 xong**: tools được dựng bởi `buildAiTools` trả về `AiToolSet` với `execute` đồng bộ. Tool errors dùng `at: ""` cho lỗi turn-wide (`tool-call-limit`, `turn-has-edits`, `turn-has-sample-data`) và `at: "findings"` cho `findings-limit`. Nếu Task 18 type `state.findings` là `AiFindingsData` phải copy readonly `targets` vào một mảng có thể thay đổi được.
- Sau khi Task 14 đến 18 đã vào master, chạy `ecc:security-reviewer` (chỉ review) một lần nữa.

### 3.4. Việc theo dõi khác

- Low L4 (tùy chọn): giới hạn phía client cho tổng văn bản stream tích lũy; làm ở Task 23 hoặc 27b.
- Ghi chú triển khai cho Task 30:
  - đặt đúng `TRUST_PROXY_HOPS` khi đứng sau proxy;
  - tùy chọn dùng khóa rate limit theo IPv6 /64;
  - bộ giới hạn trong bộ nhớ là theo từng process.
- Lint không áp dụng `no-restricted-imports` cho `*.test.*` và `frontend/src/testing/**`, nên tiền đề của Vấn đề 34 trong plan là sai: Task 28 phải giữ quy ước bằng tay.
- Task 25 đổi tên prop `stoppedEarly` thành `hasStoppedEarly`; Task 27b phải truyền đúng tên mới.
- `proposal.confirmDelete` nay dùng các khóa `tables_*`, `columns_*`, `bodyTablesAndColumns`, `bodyTables`, `bodyColumns`.
- Kiểm tra tay của Task 29:
  - **PHẢI CHECK**: Gemini có chấp nhận tool JSON Schema keywords không (`additionalProperties: false`, rất lớn integer `maximum`);
  - Gemini có chấp nhận tin nhắn assistant rỗng hay không;
  - stream thật dưới CSP `connect-src`;
  - dừng một lượt chat có nhả kết nối;
  - độ tương phản của màu và nhãn diff ở sáng và tối.
- Phần 6, kiểm tra tay trên production, và phần 7 (Import/Export): không đổi so với [handoff phiên 1](2026-10-03-ai-assistant-session-1-handoff.md#3-việc-mở-của-phần-5).
- **Ghi chú theo dõi**: `backend/src/modules/auth/auth-cookies.spec.ts` "never sets a Domain attribute" đã flaky một lần dưới tải full coverage (pass riêng lẻ và trên rerun); để ý khi debugging nếu phát hiện lại.

## 4. Quyết định đã thay người dùng trong phiên này

Người dùng có thể bác bỏ từng mục.

- Task 6: dùng compact AI schema view (`nullable?: true`); spec đã cập nhật ở `e619daf`.
- Task 7: `at` của lỗi là `findings.<i>.tables.<name>`.
- Task 8: kiểm tra giới hạn 200 hàng trước khi dịch tên.
- Task 5: tách `apply-ai-edit.ts` thành `ai-edit-resolve.ts`, `ai-edit-tables.ts`, `ai-edit-relations.ts`.
- Task 14: thông điệp commit `feat(backend): add AI module foundation` khác với plan.
- File test frontend được miễn lệnh cấm import `ai` (chấp nhận).
- `manyToMany` âm thầm bỏ qua `fromColumns`, `toColumns`, `onDelete`, `onUpdate`; mô tả tool sẽ nói rõ, không thêm mã lỗi mới.
- Hộp thoại xác nhận xóa dùng ba biến thể nội dung.
- F2: thêm `ai-chat-request.ts` (tách khỏi `ai-chat-client.ts`).
- F4: giới hạn lịch sử đã thoát ký tự bằng `AI_MAX_ESCAPED_HISTORY_LENGTH` (120 000); chấp nhận gỡ marker cả giữa dòng; chấp nhận khoảng hở marker giả mạo bằng dấu kết hợp.
- F3: `createTable` tên cột trùng trả một lỗi `column-name-duplicate` tại `["columns", i, "name"]`.
- Dùng `payload-too-large` (413) cho lịch sử quá lớn.
- Cache validation bằng `WeakMap` theo danh tính document, đặt trong `validateSchema`. An toàn vì document bất biến. Có lợi cho backend prompt validation và frontend proposal actions. Giới hạn: chỉ có ích khi cùng một đối tượng document được dùng lại; validate tăng dần là hướng nâng cấp.
- `validateSchema` nay trả frozen array (không caller nào sort in place).

## 5. Bài học cho orchestrator

Giữ các bài học của [phiên 1](2026-10-03-ai-assistant-session-1-handoff.md#5-bài-học-cho-orchestrator) vẫn còn đúng. Bổ sung:

- `secret-scan.sh` không có cờ `--worktree`: sau khi merge, quét bằng `--range` trước khi push.
- Khi máy tải nặng (load khoảng 200), Vitest frontend timeout ngẫu nhiên: chạy lại cả bộ hoặc các file lỗi trước khi kết luận, chỉ push sau khi chạy xanh.
- GateGuard đòi sự thật (file bị xóa, rollback, chỉ thị gần nhất của người dùng, nguyên văn "tiếp tục") trong thông điệp ngay trước MỖI lệnh phá hủy, kể cả `git commit --amend` và xóa worktree.
- Khi giới hạn dùng API làm agent dừng, tiếp tục chúng bằng SendMessage (cùng ngữ cảnh), không dispatch agent mới.
- Trước khi commit task theo plan, đọc dòng **Commit:** của task để dùng đúng thông điệp.
- Agent trong worktree thường không chạy được `git` thường (hook rtk): dùng `/usr/bin/git`.

## 6. Khởi động nhanh cho session mới

1. Không có agent nào đang chạy. Đọc log này và chạy `git status` để xác nhận.
2. Nhờ `spec-writer` viết hai log review còn thiếu từ nội dung ở mục 3.2.a:
   - `document/executions/logs/2026-10-03-ai-assistant-review-2.md`: project-reviewer lượt 2 trên `b9f695a..c0325ad`.
   - `document/executions/logs/2026-10-03-ai-assistant-security-review-2.md`: ecc:security-reviewer lượt 2 cho Task 14, 15, 17, 21.
3. Dispatch song song: `ui-a11y-reviewer`, Task 27a, Task 23.
4. Sau khi ba task trên xong, làm Task 18 với các ghi chú ở mục 3.3.
5. Tiếp theo: Task 27b, 19, 28, 29 (cần kiểm tra tay), 30.
