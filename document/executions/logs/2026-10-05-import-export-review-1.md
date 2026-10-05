# Review nền core của import / export (lần 1)

Không thuộc task nào trong plan. `project-reviewer` (chỉ đọc) review commit range `df2c3cc..6fa1e35` trên `master`: phần nền trong `packages/core` của [plan phần 7](../../plans/2026-10-03-import-export-plan.md), gồm Task 1–7, 9, 13, 17 ([log Task 1](2026-10-05-import-export-task-1.md), [Task 4](2026-10-05-import-export-task-4.md), [Task 6](2026-10-05-import-export-task-6.md), [Task 7](2026-10-05-import-export-task-7.md), [Task 9](2026-10-05-import-export-task-9.md)). Spec: [2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md). Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của reviewer. Các mục được sửa ghi ở [log sửa sau review](2026-10-05-import-export-review-1-fixes.md).

## 2026-10-05 19:19 — project-reviewer — Xong

- **Đã làm**: review range theo nguyên tắc kiến trúc trong `CLAUDE.md`, các rule trong `.claude/rules/`, `document/architecture.md`, spec phần 7 và các task tương ứng của plan. Kết luận: duyệt, kèm các mục cần sửa.
  - Nên sửa (1): đặt tên index không tên tốn O(I²). `buildIndexes` trong `packages/core/src/importers/shared/assemble-document.ts` gọi `suggestIndexName` cho từng index, mỗi lần duyệt lại mọi tên đã có; `claimName` trong `packages/core/src/operations/remap-merged-document.ts` có cùng dạng. Đo: 5 000 index không tên mất khoảng 15 giây; gộp 10 000 bảng cùng tên mất khoảng 4,5 giây.
  - Nên sửa (2): gộp có thể thêm issue `index-name-conflicts-table` khi tên một bảng nhập bằng tên một index của schema đích (tên bảng nhập chỉ được so với bảng và enum của đích).
  - Góp ý nhỏ (3): `assembleDocument` bỏ âm thầm cột lặp trong khóa chính và index.
  - Góp ý nhỏ (4): comment của mục miễn trừ lint tạm (`ai-sample-data-card.tsx`) trong `eslint.config.mjs` không dẫn tới task của plan sẽ gỡ nó.
  - Đã kiểm và đạt: importer không throw với input bất kỳ; thời gian tuyến tính trên input đối kháng 2 MiB; an toàn với khóa prototype (`__proto__`, `constructor`); kết quả xác định; chất lượng test đạt.
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - Test core: 3427 test pass, coverage số dòng 97,81%.
  - Hai test của generator quá thời gian khi load average khoảng 288 (nhiều worktree chạy song song); chạy lại đều pass.
- **Quyết định** (orchestrator, sau báo cáo)
  - Sửa mục 1, 2, 4 trong một task sửa riêng, log [2026-10-05-import-export-review-1-fixes.md](2026-10-05-import-export-review-1-fixes.md), merge `f277a86`: đặt tên index không tên và tên khi gộp trong thời gian tuyến tính, đổi tên bảng nhập trùng tên index của đích, comment miễn trừ lint dẫn tới plan. Task đó cũng thêm quy tắc chuỗi MySQL `'1'`/`'0'` trên cột boolean vào `sql-default-mapping.ts`.
  - Mục 2: khi gộp, bảng nhập trùng tên một index của đích cũng được đổi tên (`table-renamed`), nên gộp không bao giờ thêm `index-name-conflicts-table`; spec mục 2 và Vấn đề 7 của plan đã sửa theo.
  - Mục 3: chấp nhận. Bỏ cột lặp không mất thông tin; spec mục 1 "Luồng bên trong một importer" ghi rõ quy tắc này.
- **Việc còn lại**: không. Mục 1, 2, 4 đã sửa ở [log sửa sau review](2026-10-05-import-export-review-1-fixes.md).
- **Ghi chú cho người tiếp theo**: số đo thời gian ở mục 1 lấy trên máy đang tải nặng; dùng làm mức so sánh trước và sau khi sửa, không phải ngưỡng. Hai test generator quá thời gian không liên quan tới range này.
