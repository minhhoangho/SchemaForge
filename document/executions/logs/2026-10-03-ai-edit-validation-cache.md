# Ghi nhớ kết quả `validateSchema` theo tham chiếu tài liệu (AI-R57)

Plan: [Task 9 trong `2026-10-03-ai-assistant-plan.md`](../../plans/2026-10-03-ai-assistant-plan.md) · Spec: [AI-R57 trong `2026-10-02-ai-assistant-design.md`](../../specs/2026-10-02-ai-assistant-design.md) · Log trước: [`2026-10-03-ai-assistant-task-9.md`](2026-10-03-ai-assistant-task-9.md)

## 2026-10-03 22:48 — core-engineer — Xong

- **Đã làm**
  - Benchmark `apply-ai-edit.bench.ts` (merge ở `f295096`) vượt ngân sách AI-R57 (p99 32–77 ms) vì `findIntroducedIssues` gọi `validateSchema` hai lần (mỗi lần ≥ 12 ms trên `createLargeSchema({ tableCount: 73 })`).
  - Thêm `WeakMap<SchemaDocument, readonly Issue[]>` cấp module trong `validateSchema`: cùng một object tài liệu thì trả lại đúng mảng issue đã tính; mảng kết quả được `Object.freeze`. Không đổi chữ ký public nào (`applyAiEdit`, `AiEditContext`, `findIntroducedIssues`, `validateSchema`).
  - TDD: RED là 2 test hỏng (`toBe` cùng tham chiếu, `Object.isFrozen`), 12 test đạt; GREEN là cả 14 test đạt.
- **File thay đổi**
  - `packages/core/src/validation/validate-schema.ts`
  - `packages/core/src/validation/validate-schema.test.ts` (3 test trong `describe("memoization by document reference")`)
- **Kiểm tra**
  - `.claude/scripts/verify.sh core --build --format` cho `RESULT: PASS`, với 3009/3009 test đạt và line coverage 97.58%.
  - `pnpm --filter @schemaforge/core exec vitest bench --run src/ai/apply-ai-edit.bench.ts --reporter=verbose` được chạy 2 lần. Load average lúc chạy khoảng 15–17, tức máy đang bận.

    | Bench | Trước (p75 / p99 ms) | Lần 1 (p75 / p99) | Lần 2 (p75 / p99) |
    |---|---|---|---|
    | updateColumn | ~27–32 / 32–77 | 12.51 / 14.07 | 12.58 / 14.23 |
    | addRelation | ~27–32 / 32–77 | 12.79 / 13.91 | 13.25 / 14.60 |
    | addColumn | ~27–32 / 32–77 | 12.99 / 14.06 | 12.85 / 17.37 |
    | createTable | ~27–32 / 32–77 | 14.79 / 15.57 | 13.94 / 14.96 |

- **Quyết định**
  - Đặt cache trong `validateSchema` thay vì trong `findIntroducedIssues`. Lý do: backend `ai-prompt.ts` gọi `validateSchema(document)` trên tài liệu của request, sau đó lần `applyAiEdit` đầu tiên dùng chính object đó làm "before", nên nó trúng cache. `findIntroducedIssues` giữ nguyên mà vẫn được hưởng lợi, và chỉ cần sửa một file.
  - Cache không thể cũ vì tài liệu không bao giờ bị sửa tại chỗ. `parseSchemaDocument` freeze sâu tài liệu (Zod `.readonly()`, có test trong `model/schema-document.test.ts`). Operation trả object mới và không sửa input (có property test trên tài liệu đã freeze). Kiểu `SchemaDocument` là readonly sâu. Grep mã không phải test trong core không thấy chỗ nào ép kiểu để sửa tài liệu.
  - Mảng kết quả được freeze để một consumer không làm hỏng kết quả dùng chung. Các object `Issue` bên trong không freeze riêng vì kiểu của chúng đã readonly.
  - Theo yêu cầu, không thêm seam đếm số lần gọi. Test chứng minh cache bằng `toBe` (cùng tham chiếu), và chứng minh tài liệu khác được tính lại bằng việc một tài liệu bằng nội dung nhưng khác object cho ra mảng khác.
  - Có comment `ponytail:` ghi giới hạn: cache chỉ có tác dụng khi dùng lại cùng object, và hướng nâng cấp là validation tăng dần.
- **Ghi chú cho người tiếp theo**
  - Benchmark tạo một tài liệu "after" mới ở mỗi lần gọi, nên mỗi lần vẫn tốn một `validateSchema` thật (~12 ms). Nếu ngân sách siết hơn, bước tiếp theo là validation tăng dần, không phải mở rộng cache.
  - Frontend `issue-index.ts` có WeakMap riêng cho `IssueIndex`. Hai cache này không xung đột, vì frontend chỉ đọc kết quả.
  - Kết quả của `validateSchema` giờ là mảng đã freeze. Consumer nào sort tại chỗ sẽ bị TypeError; hiện chưa có chỗ nào làm vậy (đã kiểm tra frontend `issue-index.ts`, `proposal-actions.ts` và backend `ai-prompt.ts`).
