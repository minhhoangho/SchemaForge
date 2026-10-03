# Đồng bộ spec phần 5 với view gọn và chỉ dẫn hệ thống

Không thuộc task nào của plan; liên quan [spec phần 5](../../specs/2026-10-02-ai-assistant-design.md) và [plan phần 5](../../plans/2026-10-03-ai-assistant-plan.md) (Task 6, Task 15).

## 2026-10-03 — spec-writer — Xong
- **Đã làm**
  - Quyết định 1 (Task 6, commit `17fa7a2`): AI-R30 đổi `nullable: boolean` thành `nullable?: true` (bỏ khi false), thêm chú thích nghĩa của trường thiếu (NOT NULL, không default, comment rỗng) và đoạn "Đổi trong lúc cài đặt". Mục 5, "Vì sao `AI_MAX_SCHEMA_PROMPT_LENGTH` là 80.000": thay con số 50 đến 60 ký tự mỗi cột và 1.300 cột bằng số đo (54,4 ký tự, khoảng 1.470 cột, 100 bảng trung bình 14 cột), thêm đoạn "Đổi trong lúc cài đặt" với số đo 70,4 trước và 54,4 sau trên `createLargeSchema({ tableCount: 75 })`, fixture lớn nhất dưới 80.000 là `tableCount: 73` (79.367 ký tự).
  - Quyết định 2 (Task 15, commit `8500bab`): AI-R28 điểm 3 nêu thêm các mã `column-type-invalid-scale`, `column-custom-type-invalid`, `column-default-*`, `table-columns-empty`, `enum-values-empty`, `table-multiple-auto-increment`, `findings-limit`, `sample-rows-limit`; điểm 5 nêu giới hạn dòng mẫu lấy từ `AI_MAX_SAMPLE_ROWS_PER_TABLE` và `AI_MAX_SAMPLE_ROWS_PER_TURN`; điểm 7 nêu việc giải thích view gọn.
- **File thay đổi**: `document/specs/2026-10-02-ai-assistant-design.md`, `document/executions/logs/2026-10-03-ai-spec-compact-view.md`.
- **Kiểm tra**: `pnpm exec prettier --check document/specs/2026-10-02-ai-assistant-design.md` đạt. Đối chiếu hình dạng với `packages/core/src/ai/describe-schema-for-ai.ts` và nội dung `backend/src/modules/ai/ai.instructions.ts`.
- **Quyết định**
  - Ghi thay đổi inline theo định dạng "Đổi trong lúc cài đặt (ngày; plan, commit)" đang dùng trong spec, vì spec không có mục lịch sử thay đổi riêng.
  - Con số khoảng 81.600 ký tự cho `tableCount: 75` (dạng gọn) là tính từ 54,4 nhân 1.500, không phải số đo trực tiếp; spec ghi "khoảng".
  - Dòng 778 (benchmark đo độ dài trên fixture 100 bảng, 1.500 cột) giữ nguyên, vì đó là hạng mục kiểm của plan.
- **Ghi chú cho người tiếp theo**: plan không bị sửa. Nếu plan còn nhắc view có `nullable` bắt buộc hay dải 50 đến 60 ký tự thì cần đồng bộ ở lần review plan sau.
