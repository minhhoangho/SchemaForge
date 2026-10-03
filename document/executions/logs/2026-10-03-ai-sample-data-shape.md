# Đổi hình dạng input `proposeSampleData` sang cặp `{ column, value }`

Plan: [2026-10-03-ai-assistant-plan.md](../../plans/2026-10-03-ai-assistant-plan.md), Vấn đề 22. Spec: [2026-10-02-ai-assistant-design.md](../../specs/2026-10-02-ai-assistant-design.md), mục 9 ("Đổi trong lúc cài đặt").

## 2026-10-03 — spec-writer — Xong

- **Đã làm**: ghi quyết định của orchestrator (kiểm ở Task 2, Vấn đề 22) vào plan và spec phần 5: input tool `proposeSampleData` chuyển sang `rows: { column: string; value: string | null }[][]`.
  - Plan: dòng Vấn đề 22 (đã quyết, kèm bằng chứng); Task 2 (hằng, `proposeSampleDataInputShape`, danh sách test, "Xong khi"); Task 8 (`buildAiSampleDataset` đọc cặp, chuyển chuỗi theo kiểu cột, lỗi cột lặp và giá trị hỏng, test); Task 15 (câu chỉ dẫn "Sample data"); Task 16 (probe Rủi ro 2, 12); Task 29 (dòng checklist Rủi ro 2, 12, Vấn đề 22); Task 30 (dòng ghi hình dạng cuối cùng vào `architecture.md`).
  - Spec: bảng "Tool không sửa schema" (mục 3), bảng giới hạn AI-R62, AI-R63, AI-R41 (bước 1 và quy tắc chuyển đổi), đoạn "Đổi trong lúc cài đặt" ở cuối mục 9, chỉ dẫn hệ thống (mục 6, điểm 5), Rủi ro 2 và 12.
- **File thay đổi**: `document/plans/2026-10-03-ai-assistant-plan.md`, `document/specs/2026-10-02-ai-assistant-design.md`, file log này.
- **Kiểm tra**: `grep` cả hai file tìm `z.record`, `z.json`, `Record<`, `JsonValue`, `Object.entries`, "khóa tự do", "column key": chỉ còn các chỗ nhắc có chủ ý (dòng Vấn đề 22 và đoạn "Đổi trong lúc cài đặt" nêu hình dạng cũ làm bằng chứng, câu cấm `z.record`/`z.json()` ở Task 2, mô tả lịch sử của Rủi ro 12, kiểu `Record<ApiErrorCode | ClientFailureKind, string>` không liên quan). `pnpm exec prettier --check` trên ba file: xem kết quả trong báo cáo.
- **Quyết định**:
  - `AI_MAX_SAMPLE_DEPTH` (4) giữ lại nhưng chuyển chỗ áp: không còn ở hình dạng tool (giá trị là chuỗi), mà ở `buildAiSampleDataset` cho cột `json`, đo bằng vòng lặp stack tường minh sau `JSON.parse` trong `try`/`catch`. Lý do: giữ đúng giới hạn AI-R62 mà không cần walker trong `superRefine`.
  - Chuyển chuỗi theo kiểu cột (theo bảng "Biểu diễn JSON" của spec phần 6): `null` giữ nguyên; `smallint`, `integer` khớp `/^-?\d+$/`; `real`, `double` khớp regex số thập phân và phải hữu hạn; `boolean` chỉ `"true"`, `"false"`; `json` là văn bản JSON; kiểu khác giữ chuỗi để `validateSeedDataset` kiểm dạng.
  - Cột lặp trong một dòng và giá trị không chuyển được dùng `seed-value-invalid` (đã có trong `SEED_ISSUE_CODES`), không thêm mã mới vào `AI_EDIT_ERROR_CODES`, nên danh sách mã đã ghim và test của chỉ dẫn không đổi.
  - Sửa thêm Task 15 (câu chỉ dẫn) và Task 30 vì chúng nhắc hình dạng cũ, dù không nằm trong danh sách task được nêu; không đổi phần còn lại.
  - Task 2 vẫn có test `keeps a __proto__ column name in a sample row`, thêm `does not throw on sample values nested 100000 levels deep`, `rejects a sample value that is not a string or null`, `accepts a null sample value`; bỏ test độ sâu (chuyển sang Task 8).
- **Việc còn lại**: không. Task 2, 8, 15, 16 phải cài theo hình dạng mới; ai-engineer của Task 15 cần lấy câu chỉ dẫn mới ở dòng "Sample data" của plan.
- **Ghi chú cho người tiếp theo**: bằng chứng Zod 4.6.4 (`$ZodRecord` bỏ `__proto__`, `z.json().safeParse` ném `RangeError` với mảng lồng khoảng 100.000 tầng) do orchestrator cung cấp, tôi không chạy lại. Nếu Task 29 thấy Gemini điền sai dạng chuỗi cho cột số, boolean, json thì sửa chỉ dẫn ở Task 15 trước, không đổi lại hình dạng.
