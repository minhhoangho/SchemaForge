# Task 10: Hợp đồng API của AI

- Plan: [Task 10](../../plans/2026-10-03-ai-assistant-plan.md#task-10-hợp-đồng-api-của-ai)
- Spec: [mục 5 "Hợp đồng API và giao thức stream"](../../specs/2026-10-02-ai-assistant-design.md#5-hợp-đồng-api-và-giao-thức-stream) (AI-R21–R24)

## 2026-10-03 — core-engineer — Xong

- **Đã làm**
  - Tạo `packages/api-contract/src/ai.ts`: type `AiLocale`, `AiProposalOutcome`, `AiChatMessage`, `AiChatRequest`; hằng `AI_STREAM_ERROR_CODES` (5 mã), `AI_DATA_PART_TYPES`; ba schema Zod `aiProposalDataSchema`, `aiFindingsDataSchema` (dùng `AI_MAX_FINDINGS`), `aiSampleDataSchema` đúng phác thảo AI-R22; type `AiProposalData`, `AiFindingsData`, `AiSampleData` (`z.infer`); hàm `isAiStreamErrorCode`.
  - `limits.ts`: thêm 8 hằng AI của bảng "Giới hạn" spec mục 5.
  - `errors.ts`: thêm `ai-unavailable` (503) và `ai-schema-too-large` (413) vào `API_ERROR_CODES`, `API_ERROR_STATUS`, `SIMPLE_API_ERROR_CODES` (cuối danh sách).
  - `index.ts`: export mọi tên mới.
  - Bản dịch `apiErrors` `vi` và `en` cho hai mã mới, đúng câu của plan.
  - TDD: test viết trước. Đỏ: `pnpm --filter @schemaforge/api-contract exec vitest run src/ai.test.ts src/errors.test.ts src/limits.test.ts` → `Cannot find module './ai.js'` và 13 test thất bại (`expected undefined to be 4000`, `expected null to strictly equal { statusCode: 503, … }`…). Xanh: `Test Files 5 passed (5)`, `Tests 69 passed (69)`.
- **File thay đổi**
  - `packages/api-contract/src/ai.ts`, `ai.test.ts` (mới)
  - `packages/api-contract/src/errors.ts`, `errors.test.ts`, `limits.ts`, `limits.test.ts`, `index.ts`
  - `frontend/src/lib/i18n/locales/vi/api-errors.ts`, `frontend/src/lib/i18n/locales/en/api-errors.ts`
- **Kiểm tra**
  - `pnpm turbo run typecheck lint test build --filter @schemaforge/api-contract` → `Tasks: 5 successful, 5 total`; 69 test pass; coverage dòng 100%.
  - `pnpm exec prettier --check <9 file sở hữu>` → sạch sau khi chạy `--write` cho `limits.test.ts`, `en/api-errors.ts`.
  - `.claude/scripts/verify.sh frontend backend --build --format` → `RESULT: PASS` (typecheck, lint, test, build của frontend và backend; format).
  - `pnpm --filter @schemaforge/frontend exec vitest run src/lib/i18n/resources.test.ts` → `Tests 1540 passed (1540)`.
  - `.claude/scripts/secret-scan.sh` → `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Hai mã AI đặt cuối `API_ERROR_CODES` và `SIMPLE_API_ERROR_CODES`: giữ nguyên thứ tự mã cũ, test "has a status for exactly the api error codes" so khớp thứ tự khóa với `API_ERROR_STATUS`.
  - Giới hạn tiêu đề (200), chi tiết (2000), số target (20) của finding là hằng cục bộ không export trong `ai.ts`: spec không đặt chúng trong `limits.ts` và chưa phía nào cần dùng lại.
  - `isAiStreamErrorCode` dùng `ReadonlySet<string>` để tra mà không cần ép kiểu `as`.
  - Thêm test ngoài danh sách tối thiểu: biên "đúng 30 finding được nhận", `AI_DATA_PART_TYPES`, và `parseApiErrorBody` đọc được body đơn giản của hai mã AI (frontend cần đọc body `503`/`413`).
  - Không thêm mã hay trường nào ngoài spec.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - `.claude/scripts/verify.sh` và `test-file.sh` chưa nhận `api-contract`; dùng `pnpm turbo run typecheck lint test build --filter @schemaforge/api-contract` và `pnpm --filter @schemaforge/api-contract exec vitest run <file>`.
  - Worktree mới cần `pnpm --filter @schemaforge/backend generate` (Prisma client) trước khi typecheck backend; `worktree-setup.sh` không chạy bước này.
  - Backend (Task 14) assert ba hằng `AI_MAX_SAMPLE_ROWS_PER_TABLE`, `AI_MAX_SAMPLE_ROWS_PER_TURN`, `AI_MAX_FINDINGS` ở đây bằng bản trong core (Vấn đề 11).
