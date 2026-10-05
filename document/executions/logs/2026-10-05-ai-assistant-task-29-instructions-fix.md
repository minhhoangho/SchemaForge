# Task 29: Sửa chỉ dẫn hệ thống, giữ phần tử có sẵn của schema

Plan: [Task 29](../../plans/2026-10-03-ai-assistant-plan.md#task-29-kiểm-tra-tay-với-gemini-thật-csp-và-bundle) (Rủi ro 10: sửa chất lượng chỉ trong chỉ dẫn của [Task 15](../../plans/2026-10-03-ai-assistant-plan.md#task-15-chỉ-dẫn-hệ-thống-và-dựng-prompt)). Spec: [AI-R28](../../specs/2026-10-02-ai-assistant-design.md).

## 2026-10-05 09:37 — ai-engineer — Xong

- **Đã làm**
  - Lỗi thấy khi kiểm tay với Gemini thật: schema có một bảng mẫu `table_1` (cột id, column_1, column_2, column_3), người dùng viết "hãy tạo cho tôi các table cơ bản của hệ thống ecommerce"; Gemini đề xuất 5 bảng mới và xóa luôn `table_1` cùng 4 cột dù người dùng không yêu cầu.
  - Thêm một quy tắc vào mục "How to change the schema:" của `AI_INSTRUCTIONS`, ngay trước quy tắc `createTable`:
    "Keep every existing table, column, enum, index and relation unless the user explicitly asks to remove, rename or replace it. Add new elements alongside the existing ones. If an existing element looks unused or redundant, say so in your answer, or report it as a finding when the user asked for suggestions, instead of removing it."
  - Thêm một test trong `ai-prompt.spec.ts` (describe `AI_INSTRUCTIONS`) kiểm chỉ dẫn chứa câu giữ phần tử có sẵn. RED trước khi sửa: `vitest run src/modules/ai/ai-prompt.spec.ts -t "keep existing"` → `Tests 1 failed | 89 skipped`. GREEN sau khi sửa: `Tests 90 passed (90)`.
- **File thay đổi**
  - `backend/src/modules/ai/ai.instructions.ts`
  - `backend/src/modules/ai/ai-prompt.spec.ts`
- **Kiểm tra**
  - `.claude/scripts/verify.sh backend`: typecheck PASS, lint PASS, test PASS (`Tests 557 passed (557)`, line coverage 98.06%); `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Không gọi Gemini thật.
- **Quyết định**
  - Đặt quy tắc ở vị trí thứ ba của mục "How to change the schema:" (sau quy tắc tham chiếu theo tên, trước `createTable`) để model đọc trước khi lên kế hoạch tạo bảng; vẫn thuộc điểm 2 của AI-R28, không đổi tám điểm.
  - Phần tử thừa hay không dùng: nói trong câu trả lời, hoặc báo bằng finding khi người dùng xin gợi ý, khớp điểm 4 của AI-R28 (finding không tự sửa schema).
  - Câu mới không có từ nối gạch ngang, nên không thêm token vào danh sách mã lỗi mà test `isCoveredByInstructions` quét.
  - Test chỉ dùng `toContain` với câu đầu của quy tắc, theo mẫu test `no "nullable" means NOT NULL` sẵn có; không dùng snapshot.
  - Không đổi logic backend nào khác; spec AI-R28 không cần sửa vì nội dung mới nằm trong điểm 2 ("cách sửa schema").
- **Việc còn lại**: không có.
- **Ghi chú cho người tiếp theo**
  - Cần kiểm tay lại với Gemini thật (Task 29) bằng cùng kịch bản `table_1` để xác nhận model không còn đề xuất xóa.
