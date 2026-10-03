# Thêm lại AI_MAX_SAMPLE_DEPTH

Liên kết: [Plan Task 2](https://github.com/minhhoangho/SchemaForge/blob/master/document/plans/2026-10-03-ai-assistant-plan.md#task-2) | [Spec AI-R62](https://github.com/minhhoangho/SchemaForge/blob/master/document/specs/2026-10-03-ai-assistant-design.md)

## 2026-10-03 10:45 — core-engineer — Xong

- **Đã làm**
  - Thêm hằng số `AI_MAX_SAMPLE_DEPTH = 4` vào `packages/core/src/ai/ai-limits.ts` với comment tiếng Anh
  - Xuất hằng số từ `packages/core/src/ai/index.ts` trong danh sách alphabetically
  - Chạy verify.sh core --build --format: RESULT: PASS

- **File thay đổi**
  - `packages/core/src/ai/ai-limits.ts`: thêm hằng số + comment
  - `packages/core/src/ai/index.ts`: thêm AI_MAX_SAMPLE_DEPTH vào export list

- **Kiểm tra**
  ```
  .claude/scripts/verify.sh core --build --format
  RESULT: PASS
  
  Tests: 2759 passed
  Coverage: 97.71% line
  ```

- **Quyết định**
  - File test `src/ai/index.test.ts` không tồn tại, nên không cần cập nhật
  - Hằng số được đặt ngay cạnh các sample-data limits khác
  - Export được sắp xếp theo thứ tự chữ cái (AI_MAX_SAMPLE_DEPTH nằm giữa AI_MAX_SAMPLE_INPUT_BYTES và AI_MAX_SAMPLE_KEYS_PER_ROW)
