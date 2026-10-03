# Review Task 27a: Ô soạn tin, gợi ý nhanh, khối đồng ý

Liên kết: [Plan, Task 27a](../../plans/2026-10-03-ai-assistant-plan.md), [Spec](../../specs/2026-10-02-ai-assistant-design.md) (AI-R3, AI-R61, mục 14)

## 2026-10-04 — ui-a11y-reviewer — Xong

- **Đã làm**: review chỉ đọc `ai-composer`, `ai-quick-actions`, `ai-consent` và test của chúng. Đã kiểm tra chữ ký, khóa `schemaforge:ai-consent:<userId>`, locale `vi` và `en`, token màu, WCAG 2.2 AA, bàn phím (Enter, Shift+Enter, IME), kích thước vùng bấm, liên kết điều khoản. Verdict: accept-with-fixes.
- **File thay đổi**: không.
- **Kiểm tra**:
  - `verify.sh frontend`: typecheck và lint PASS; test FAIL do 11 timeout ở các file không liên quan khi máy quá tải (196 worker).
  - `test-file.sh` cho ba file test của 27a: PASS.
  - `secret-scan`: CLEAN.
  - Không chạy trình duyệt.
- **Quyết định**: chấp nhận cả 6 quyết định của implementer: không `trim`; Enter khi đang gửi bị chặn chứ không gửi; bộ đếm không phải live region; nhãn `textarea` chỉ cho trình đọc màn hình (sr-only); gợi ý nhanh dùng `role="group"`; ghi khóa đồng ý thất bại vẫn gọi `onAccepted`.
  - Orchestrator: giao agent Task 27a sửa mục 1–4 và thêm kiểm tra `keyCode === 229` cho IME (người dùng tiếng Việt dùng Safari); các khóa locale nằm trong phạm vi Task 27a theo plan.
- **Việc còn lại**:
  - [ ] Thêm test Enter khi `isSending` (bị chặn, không gửi).
  - [ ] Văn bản bộ đếm: "{{count}} of {{max}} characters" (en) và "{{count}}/{{max}} ký tự" (vi).
  - [ ] Thêm văn bản sr-only "mở trong tab mới" cho liên kết điều khoản (khóa `panel.consent.opensInNewTab`).
  - [ ] Thêm test: tên của nhóm gợi ý nhanh, dùng gợi ý nhanh chỉ bằng bàn phím, composer bản `vi`, `localStorage` chỉ có đúng một khóa với giá trị "1".
  - [ ] Kiểm tay trên trình duyệt: độ tương phản, kích thước vùng bấm, trình đọc màn hình, IME tiếng Việt trên Chrome và Safari, liên kết điều khoản.
  - [ ] Chạy lại `verify.sh frontend` khi máy ít tải.
- **Ghi chú cho người tiếp theo**: Task 27b gọi `readAiConsent(user.id)` trong initialiser của `useState`, không gọi khi SSR; cần kiểm tra focus giữa lúc gửi và `isSending` (nút Gửi/Dừng cùng vị trí và cùng type, DOM giữ nguyên); cấp `h3` phụ thuộc cây heading của panel.
