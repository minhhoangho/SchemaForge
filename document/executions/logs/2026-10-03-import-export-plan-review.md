# Review plan phần 7: Import / Export

Plan: [2026-10-03-import-export-plan.md](../../plans/2026-10-03-import-export-plan.md). Spec: [2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md). Log lập plan: [2026-10-03-import-export-plan.md](2026-10-03-import-export-plan.md).

## 2026-10-03 18:53 — project-reviewer (log do spec-writer ghi) — Xong

- **Đã làm**
  - Đọc toàn bộ plan (1278 dòng), log lập plan, spec phần 7, các rule `core.md`, `nextjs.md`, `react.md`, `testing.md`, `security.md`, `execution-logs.md`.
  - Đối chiếu code trên `master`:
    - core: ordering, id, `step-operation-shapes`, `pickUnusedName`, `find-introduced-issues`, rule `index-name-conflicts-table`, `package.json`, `tsconfig.build.json`;
    - frontend: `worker-protocol`, `generator-request`, `viewport-controls`, `editor-flow-provider`, toolbar, dòng của danh sách schema, repository, nơi dùng `resolveIssueTarget`;
    - conformance: `sqlserver.test.ts`, `containers.ts`;
    - `eslint.config.mjs`.
  - Kiểm tra API `modern-screenshot` 4.7.0 trên unpkg.
  - Sửa plan theo mọi phát hiện: do spec-writer làm sau review, orchestrator chấp nhận toàn bộ phát hiện (xem mục "Quyết định").
- **File thay đổi**: review chỉ đọc. Phần sửa sau review: `document/plans/2026-10-03-import-export-plan.md`, log này, và một mục mới trong `document/executions/logs/2026-10-03-import-export-plan.md`.
- **Kiểm tra**
  - Quét secret: CLEAN.
  - `pnpm exec prettier --check` trên plan và log lập plan: pass.
  - 39 mã diagnostic khớp giữa spec và plan.
- **Quyết định**: accept-with-fixes. Có 2 lỗi chặn, 10 lỗi nên sửa và 5 góp ý nhỏ.
  - Lỗi chặn:
    1. Task 29 xuất SVG bằng `domToSvg`, nhưng hàm này trả ảnh PNG bọc trong SVG. Đổi sang `domToForeignObjectSvg` rồi `XMLSerializer`, thêm test kiểm tra có `foreignObject`.
    2. SQL Server chỉ kiểm tra ở mức code, theo quyết định của người dùng ngày 2026-10-03. Task 32 chạy conformance trừ SQL Server. Dòng kiểm tra tay về script SSMS UTF-16 LE thành test tự động của Task 24.
  - Nên sửa:
    3. Task 17 export `finalizeImportDiagnostics`, Task 24 dùng hàm này để sắp diagnostic.
    4. Task 24 dựng batch chế độ `new` trên `createEmptySchema(imported.name)`.
    5. Import đang chờ nằm trong `useRef` của provider, có test StrictMode (Task 26, 28).
    6. Task 29 sở hữu `viewport-controls.tsx` và `editor-flow-provider.tsx`, thêm `getMeasuredNodes` và `fitNodes`, chỉ fit sau khi node đã được đo.
    7. Task 21 chuyển cả `toIssueMessageValues` và bỏ hàm trùng `toInterpolation`.
    8. Task 6 sở hữu cả `build-relation.ts`, nơi có bản `pickUnusedName` thứ hai.
    9. Task 33 sửa thêm spec theo Vấn đề 8, Vấn đề 17 và quyết định SQL Server.
    10. Bỏ assert thời gian của scanner ở Task 9 và điểm probe 12 của Task 8; Task 19 đo hai số này bằng bench.
    11. Task 19 thêm bench ở giới hạn 20 000 phần tử; giải quyết chỗ lệch giữa câu "chạy trước Task 24" và bảng phụ thuộc.
    12. Task 7 và 18 có test JSON với `__proto__`.
  - Góp ý nhỏ:
    - lint cấm import sâu `@dbml/core/*`;
    - ghi chú rằng block `lib/api/**` đặt lại `no-restricted-properties`;
    - `checkPastedSource` từ chối theo độ dài chuỗi trước khi gọi `TextEncoder`;
    - đổi tên file journey của Task 28 theo quy ước hiện có;
    - Vấn đề 7 ghi rằng bảng nhập trùng tên một index có sẵn vẫn sinh issue `index-name-conflicts-table`, được phép và hiện ở bước xem trước.
  - Review riêng sau task: `ecc:security-reviewer` cho Task 8 và Task 24, `ecc:react-reviewer` cho Task 26 và Task 28. Hai reviewer này chỉ review, không sửa file.
- **Ghi chú cho người tiếp theo**
  - `domToSvg` của `modern-screenshot` 4.7.0 trả data URL của một SVG chỉ bọc ảnh PNG. Muốn có SVG dạng `foreignObject` thì dùng `domToForeignObjectSvg`, hàm này trả `SVGElement`.
  - `pnpm test:conformance` chạy cả `sqlserver.test.ts`. Khi SQL Server chỉ kiểm tra ở mức code, chạy vitest của `@schemaforge/codegen-conformance` với `--exclude` và `-t` như Task 32 của plan.
