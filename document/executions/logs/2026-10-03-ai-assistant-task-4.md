# Task 4: `applyAiEdit` cho tool sửa bảng, cột, index, enum, schema

- Plan: [Task 4](../../plans/2026-10-03-ai-assistant-plan.md#task-4-applyaiedit-cho-tool-sửa-bảng-cột-index-enum-schema)
- Spec: [AI-R10, AI-R11, AI-R12, AI-R15, danh mục tool sửa schema](../../specs/2026-10-02-ai-assistant-design.md#3-bộ-tool-và-ánh-xạ-sang-operation)

## 2026-10-03 — core-engineer — Xong

- **Đã làm**
  - `ai-column-spec.ts`: `toColumnType` (kiểm tham số theo `kind`, thiếu hoặc thừa trả `column-type-invalid`; `enum` dịch `enumName` bằng `findEnumByName`, không có trả `enum-name-not-found`), `toColumnDefault` (`literal` bắt buộc `value`, hai loại còn lại cấm `value`; `undefined`, `null` thành `null`), và `toColumn` (dựng `Column` đầy đủ với giá trị ngầm định rõ ràng theo AI-R11).
  - `apply-ai-edit.ts`: `applyAiEdit`, `AiEditContext`, `AiEditSuccess` cho tool 1–8, 12–16. Thứ tự: dịch tên → dựng operation → `applyOperation` → `findIntroducedIssues`. Tool quan hệ (`addRelation`, `updateRelation`, `removeRelation`) ném `Error` (lỗi lập trình) cho tới Task 5.
  - TDD: test viết trước, chạy đỏ vì chưa có module (`Cannot find module './ai-column-spec.js'`, `Cannot find module './apply-ai-edit.js'`), rồi cài đặt tới xanh.
- **File thay đổi**
  - `packages/core/src/ai/ai-column-spec.ts`, `ai-column-spec.test.ts` (tạo)
  - `packages/core/src/ai/apply-ai-edit.ts`, `apply-ai-edit.test.ts` (tạo)
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core packages/core/src/ai/ai-column-spec.test.ts`: đỏ (thiếu module) → xanh.
  - `.claude/scripts/test-file.sh core packages/core/src/ai/apply-ai-edit.test.ts`: đỏ (thiếu module) → xanh; hai file 60 test pass.
  - `.claude/scripts/verify.sh core --build --format`: `RESULT: PASS` (typecheck, lint, test 2888 pass, coverage dòng 97,54 %, build, prettier).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `path` của lỗi dịch tên trỏ vào input của tool (ví dụ `["columns", 2]`, `["after"]`, `["column", "type", "length"]`), vì phần tử chưa tồn tại trong tài liệu. `toColumnType`, `toColumnDefault`, `toColumn` trả path tương đối với spec, `applyAiEdit` nối tiền tố.
  - Lỗi của `applyOperation` giữ nguyên `code`, `path` của core (path trỏ vào operation, kể cả `["operations", i, …]` của batch), còn `at` là đường dẫn theo tên của phần tử lần gọi nhắm tới (`tables.<bảng>`, `tables.<bảng>.columns.<cột>`, `tables.<bảng>.indexes.<index>`, `enums.<enum>`, `name` cho `renameSchema`), dựng từ tên chứ không qua `describePathForAi`, nên không bao giờ thành `operations.1.columnId`.
  - Issue mới: `path` là đường dẫn tài liệu của issue, `at = describePathForAi(kết quả, issue.path)`; trả mọi issue mới (backend tự cắt 5 lỗi theo AI-R16).
  - `at` của `*-name-not-found` dùng tên được yêu cầu cho phần tử thiếu và tên thật cho bảng đã tìm thấy; `enum-name-not-found` trong kiểu cột có `at = enums.<tên yêu cầu>` cho nhất quán với các lỗi không tìm thấy khác.
  - Danh sách tên cột (`primaryKey`, `setPrimaryKey.columns`, `addIndex.columns`) báo mọi tên thiếu một lần, để model sửa trong một lần gọi lại.
  - `primaryKey` của `createTable` so khớp theo AI-R9 bằng `findColumnByName` trên một tài liệu tra cứu chỉ chứa các cột mới (`Object.fromEntries` theo id sinh ra), không chép lại logic so tên của Task 3.
  - Thêm `toColumn` vào `ai-column-spec.ts` (file sở hữu) để `apply-ai-edit.ts` ngắn hơn.
  - `allowedParameters` dùng `Map` thay cho `switch` có `default`, vì lint `switch-exhaustiveness-check` không coi `default` là đủ.
- **Việc còn lại**: không có trong phạm vi Task 4.
- **Ghi chú cho người tiếp theo**
  - `apply-ai-edit.ts` dài khoảng 460 dòng (vượt mức khoảng 300 của `code-quality.md`) dù chưa có nhánh quan hệ; task chỉ sở hữu bốn file nên chưa tách. Task 5 nên tạo `ai-edit-relations.ts` như plan cho phép, và orchestrator cân nhắc cho tách nhóm hàm tra tên (`resolveTable`, `resolveColumn`, `resolveColumns`, `resolveEnumId`, `tableAt`, `columnAt`, `enumAt`, `failWith`, `failInside`) sang một file riêng để Task 5 dùng chung.
  - `resolveTable` đặt path `["table"]`; tool quan hệ dùng `fromTable`, `toTable` nên Task 5 cần thêm tham số path.
  - Nhánh quan hệ trong `translate` đang `throw`; Task 5 thay ba `case` đó, giữ nguyên `default` kiểm `never`.
