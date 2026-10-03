# Task 27a: Ô soạn tin, gợi ý nhanh, khối đồng ý gửi dữ liệu

- Plan: `document/plans/2026-10-03-ai-assistant-plan.md` (Task 27a)
- Spec: `document/specs/2026-10-02-ai-assistant-design.md` (AI-R3, AI-R61, mục 14)

## 2026-10-04 00:30 — frontend-engineer — Xong
- **Đã làm**: ba component trình bày `AiComposer`, `AiQuickActions`, `AiConsent` (kèm `GEMINI_API_TERMS_URL`, `aiConsentKey`, `readAiConsent`), test viết trước (RED: thiếu module, rồi GREEN).
- **File thay đổi**: tạo `frontend/src/features/editor/components/ai-panel/{ai-composer,ai-quick-actions,ai-consent}.tsx` và `.test.tsx` tương ứng. Các file locale `{vi,en}/ai/{composer,quick-actions}.ts` và nhóm `consent` của `panel.ts` do Task 20 tạo đã đủ khóa, không cần sửa.
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` (typecheck, lint, test, format) và `.claude/scripts/secret-scan.sh`; kết quả ghi trong báo cáo.
- **Quyết định**
  - Không sửa file locale: khóa của Task 20 đã đủ cho 27a (tránh sửa thừa).
  - `onSend` nhận text nguyên văn (không trim); chỉ chặn khi rỗng/toàn khoảng trắng; nút Gửi `disabled` khi rỗng.
  - Enter khi đang `isSending` bị `preventDefault` nhưng không gửi (tránh xuống dòng ngoài ý muốn, ô đang `readOnly`).
  - Bộ đếm là `<span>` nối `aria-describedby`, không dùng live region (tránh đọc mỗi phím).
  - Nhãn ô soạn là `<label className="sr-only">`; nhóm gợi ý nhanh là `role="group"` với nhãn ẩn `quickActions.label`.
  - Nút gợi ý dùng `size="sm"` (cao 28px, ≥ 24px); link điều khoản `min-h-6`.
  - Test dùng helper `getInput()` với `instanceof` thay cho `as` (lint cấm type assertion).
  - Khóa i18n của khối đồng ý đọc từ `panel.consent.*` (namespace `ai`).
- **Ghi chú cho người tiếp theo**: Task 27b gọi `readAiConsent(user.id)` trong `useState` khởi tạo và chuyển `inputRef` để focus ô soạn khi mở panel. Cần kiểm tay độ tương phản và target size trên Chrome (axe tắt hai rule này trong jsdom).

## 2026-10-04 01:10 — frontend-engineer — Xong (sửa theo review ui-a11y-reviewer)
- **Đã làm**: thêm test Enter khi `isSending` không gọi `onSend`; đổi `composer.counter` thành "{{count}} of {{max}} characters" / "{{count}}/{{max}} ký tự" (vẫn là span không live, nối `aria-describedby`); thêm `panel.consent.opensInNewTab` (sr-only trong thẻ `<a>`); thêm test nhóm gợi ý nhanh bằng `getByRole("group", { name })`, test chỉ dùng bàn phím cho gợi ý nhanh, test locale `vi` cho ô soạn, test localStorage chỉ có một khóa; xử lý `nativeEvent.keyCode === 229` (Safari) kèm test.
- **File thay đổi**: `ai-composer.tsx`, `ai-consent.tsx`, ba file test cùng thư mục, `locales/{vi,en}/ai/composer.ts`, nhóm `consent` của `locales/{vi,en}/ai/panel.ts`.
- **Kiểm tra**: `.claude/scripts/test-file.sh` cho từng file test: PASS; `verify.sh` và `secret-scan.sh` xem báo cáo.
- **Quyết định**
  - Bỏ trạng thái "đã đạt giới hạn" khi count === max: `maxLength` đã chặn nhập, thêm trạng thái chữ làm đổi bố cục; ghi nhận, không làm.
  - `keyCode` dùng qua `nativeEvent.keyCode` với hằng `IME_PROCESS_KEY_CODE`, lint không báo lỗi.
- **Ghi chú cho người tiếp theo**: test keyCode 229 viết cùng lúc với sửa code, chưa chạy RED riêng.
