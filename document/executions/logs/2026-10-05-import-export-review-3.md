# Review 3: các task frontend phần 7 đã merge

Không thuộc task nào trong plan. `project-reviewer` (chỉ đọc) review các commit frontend đã merge của [plan phần 7](../../plans/2026-10-03-import-export-plan.md) (Task 21, 22, 23, 27, 29, 30), theo [spec phần 7](../../specs/2026-09-15-import-export-design.md). Reviewer không ghi file, nên log này do `spec-writer` viết từ báo cáo của reviewer và quyết định của orchestrator.

## 2026-10-05 21:30 — project-reviewer — Xong

- **Đã làm**: review các commit `50c212a` (T21), `3f4d344` (T22), `b8fcacb` (T29), `5a52d7a` (T23), `234c3be` (T27), `b648d4e` (T30) và `397349b` (ổn định test) trên `master`, đối chiếu `CLAUDE.md`, `.claude/rules/`, spec mục 8–12 và plan Task 21, 22, 23, 27, 29, 30. Không review Task 31.
  - Kết luận: request changes, chỉ vì một finding blocking; sau khi sửa thì approve with fixes.
  - Chặn (1): `eslint.config.mjs` dòng 451–455 ở HEAD vẫn miễn trừ `ai-sample-data-card.tsx` khỏi rule cấm `URL.createObjectURL`, nên kiểm tra của Task 23 fail. Bản sửa chưa commit của người dùng xóa cả `download-blob.ts` và để `files: []`, làm ESLint hỏng. Cách sửa: chỉ xóa comment "Temporary" và dòng `ai-sample-data-card.tsx`, giữ `download-blob.ts`. `download-blob.ts` chỉ gọi `environment.url.createObjectURL` nên thật ra không cần miễn trừ; xóa cả khối cũng được.
  - Nên sửa (2): `ai-sample-data-card.test.tsx:309-338` thiếu test plan `downloads the sample data through downloadBlob with the same file name`. Ba test (`ai-sample-data-card.test.tsx`, `code-view.test.tsx:108`, `code-panel.test.tsx:252`) dùng `Object.assign(URL, …)` sửa global; `code-panel.test.tsx` dọn mock ở cuối thân test.
  - Nên sửa (3): comment ở `frontend/src/testing/mount-editor-journey.tsx:62-70` sai sau khi `testTimeout` toàn cục thành 30 s; trường `hasToast: hasToastBeforeUndo` luôn true (nit).
  - Nit: giá trị dự phòng `"prisma"`/`"default"` ghi cứng trong `download-file-names.ts:50-53`; catch ở `use-export-actions.ts:66-70` không log `errorName`; `export-menu.test.tsx:156` dùng `forEach`; props inline ở `schema-list-row.tsx:104-108`; regex ký tự tổ hợp viết nguyên văn ở `to-download-base-name.ts:7`; Task 30 không có file test riêng cho `use-export-actions.ts` (chấp nhận, đã được phủ qua `export-menu.test.tsx`).
- **File thay đổi**: không có (reviewer chỉ đọc).
- **Kiểm tra**
  - vitest 19 file liên quan: PASS (2658 test).
  - `prettier --check` các file frontend đã đổi: PASS.
  - `secret-scan.sh --range 3504e2e..HEAD`: `SECRET-SCAN: CLEAN`.
  - Không chạy lint (config đang hỏng). Không chạy lại typecheck, build, coverage toàn suite vì máy tải nặng; orchestrator đã chạy typecheck và 5188 test pass trên `master`.
- **Quyết định**
  - Reviewer: lệch plan Task 29 về `data-export-exclude` (MiniMap và Background nằm ngoài `.react-flow__viewport`) được chấp nhận; thay đổi `isConnected` ở `397349b` không làm yếu assertion; Task 27 viết test sau code được ghi nhận, không phải sửa.
  - Orchestrator khi nhận review: sửa eslint chờ người dùng (hook `config-protection` chặn agent); finding 2, 3 và các nit ngoài `import-export/` giao cho `frontend-engineer` trong log `2026-10-05-import-export-review-3-fixes.md`; nit của `use-export-actions.ts` và `export-menu.test.tsx` gộp vào Task 31; ghi lệch `data-export-exclude` vào spec mục 10 ở Task 33.
- **Việc còn lại**
  - [ ] Sửa `eslint.config.mjs` như trên (chỉ xóa comment "Temporary" và dòng `ai-sample-data-card.tsx`, giữ hoặc xóa cả khối `download-blob.ts`), rồi chạy `pnpm lint` và `grep -n "ai-sample-data-card" eslint.config.mjs` (kết quả phải rỗng).
  - [ ] Các sửa trong `2026-10-05-import-export-review-3-fixes.md` (finding 2, 3 và nit ngoài `import-export/`).
  - [ ] Task 31: nit của `use-export-actions.ts` (log `errorName`) và `export-menu.test.tsx:156` (bỏ `forEach`).
  - [ ] Task 33: ghi lệch `data-export-exclude` vào spec mục 10.
- **Ghi chú cho người tiếp theo**: kiểm tra ảnh trên trình duyệt thật (marker, nền `oklch`, CSS `data-exporting`, viền `border-primary` của nhãn edge đang chọn, CSP) thuộc Task 32. Có thể nhờ `ecc:react-reviewer` xem effect `fitNodes` gọi `setState` trong `editor-flow-provider.tsx`.
