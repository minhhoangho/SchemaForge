# Lập plan phần 7: Import / Export

Plan: [2026-10-03-import-export-plan.md](../../plans/2026-10-03-import-export-plan.md). Spec: [2026-09-15-import-export-design.md](../../specs/2026-09-15-import-export-design.md) (commit cea2dae).

## 2026-10-03 — spec-writer — Xong

- **Đã làm**
  - Đọc toàn bộ spec phần 7, khung của plan phần 6 (quy ước chung, điểm nóng, bảng task, Task 1, 2, 34, 35, bảng đối chiếu), các rule `core.md`, `testing.md`, `react.md`, `security.md`, `nextjs.md`.
  - Đối chiếu code trên `master`: `packages/core` (entry point, `exports`, `src/testing/`, operation, `applyOperation`, `parseSchemaDocument`, `pickUnusedName`, `isSafeCustomTypeName`, tên file của generator), `eslint.config.mjs`, frontend (`features/editor/code-generator/`, store, toolbar, canvas, `relation-markers.tsx`, `table-node.tsx`, `editor-workspace.tsx`, `use-schema-actions.ts`, `schema-repository.ts`, `app-providers.tsx`, `resources.ts`, CSP, `resolve-issue-target.ts` và nơi dùng), `packages/codegen-conformance` (`containers.ts`, `prisma-cli.ts`).
  - Kiểm tra phiên bản ngày 2026-10-03: `npm view` cho `@dbml/core`, `@dbml/parse`, `fflate`, `modern-screenshot`; `npm pack` hai gói sau vào scratchpad để đọc `index.d.ts`; quét `lib/index.mjs` của `@dbml/core` 10.2.0 và `@dbml/parse` 10.2.0 trong `node_modules` (không import module Node, chỉ có `Function("return this")()` của lodash); đọc `types/parse/Parser.d.ts` (static và instance `parse`, `ParseFormat`); `ViewportPortal` trong `@xyflow/react` 12.11.6; `exec` trong `testcontainers` 12.2.0; `prisma db pull --help` của 7.10.0 (`--print`, `--url`, `--schema`).
  - Viết plan: 34 task (Task 0 đến 33), 10 đợt, 18 vấn đề, bảng đối chiếu 19 tiêu chí.
- **File thay đổi**
  - Tạo `document/plans/2026-10-03-import-export-plan.md`.
  - Tạo log này.
- **Kiểm tra**: script Python đếm `|` không escape theo từng bảng (không có dòng lệch cột); đủ thân Task 1–33; không có `TODO`, `TBD`. Kiểm tra wave: mỗi đợt tối đa 5 task, file sở hữu rời nhau.
- **Quyết định** (quan trọng trước)
  - Vấn đề 1: phần dùng chung ở `frontend/src/lib/import-export/`, `lib/download/`, `components/import-dialog/`, `components/pending-import-provider.tsx`; phần chỉ editor ở `features/editor/import-export/` và `features/editor/code-generator/`. Lý do: `nextjs.md` cấm feature import nội bộ feature khác, spec đặt `features/import-export` dùng chung.
  - Vấn đề 9: ZIP qua yêu cầu `build-zip` mới của `code-generator.worker.ts`, hộp thoại ZIP tạo worker riêng từ cùng file. Lý do: worker của code panel chỉ sống khi panel mở.
  - Vấn đề 11: Task 19 đo `buildImportOperation` + `applyOperation` trước Task 24; trượt ngưỡng thì có task tối ưu riêng. Lý do: `applyOperation` parse cả batch bằng Zod trước khi áp.
  - Vấn đề 3: core dùng `@dbml/core` `^10.2.0` (lockfile đã có), Task 8 probe lại hành vi trên 10.2.0 và dừng nếu khác spec. Lý do: một bản trong repo; spec thử trên 10.1.1.
  - Vấn đề 7: khi gộp, tên index còn tránh tên bảng. Lý do: issue `index-name-conflicts-table` mới của phần 6.
  - Vấn đề 16: chuyển `resolveIssueTarget` sang `frontend/src/lib/schema/` (Task 21). Lý do: hộp thoại dùng chung cần nó.
  - Vấn đề 5, 6, 8, 10, 12, 13, 14, 15, 17, 18: marker vào `ViewportPortal`; hằng `IMPORT_LAYOUT_METRICS` đo trên `pnpm dev`; không có "Tải JSON" ở dòng `cloud-only`; scanner hỗ trợ `DELIMITER`; helper dump riêng dùng `container.exec`; file `frontend/public/third-party-notices.txt`; dialect nhớ trong `PendingImportProvider`; `PRISMA_IMPORT_FIXTURES` qua `@schemaforge/core/testing`; tài liệu đổi giữa chừng thì báo lỗi thay vì dựng lại batch; `toComparableSchema` không export.
  - 39 mã diagnostic của core kèm hợp đồng `path`; `import-timeout` là key frontend, không phải mã core.
  - Dependency, lockfile và `eslint.config.mjs` chỉ Task 1 (devops-engineer) sửa; `src/index.ts` chỉ Task 17; i18n chỉ Task 22.
- **Ghi chú cho người tiếp theo**
  - Không sửa `roadmap.md`, `architecture.md` hay spec theo yêu cầu của dispatcher (có plan khác đang viết song song). Thay đổi cần làm ở ba file này nằm trong Task 33 của plan và trong báo cáo gửi orchestrator.
  - Task 12, 16 chỉ chạy khi log Task 8 có bảng probe khớp spec.

## 2026-10-03 18:55 — spec-writer — Xong

- **Đã làm**
  - Sửa plan theo review của project-reviewer (accept-with-fixes, orchestrator chấp nhận toàn bộ; xem [2026-10-03-import-export-plan-review.md](2026-10-03-import-export-plan-review.md)). Đã áp đủ 2 lỗi chặn, 10 lỗi nên sửa, 5 góp ý nhỏ, và thêm ghi chú review riêng cho Task 8, 24 (`ecc:security-reviewer`) và Task 26, 28 (`ecc:react-reviewer`).
  - Đối chiếu trước khi sửa:
    - `modern-screenshot` 4.7.0: `npm pack` vào scratchpad, đọc `dist/index.d.ts` và `dist/index.mjs`. `domToForeignObjectSvg` trả `Promise<SVGElement>`. `domToSvg` dựng `<image href=dataUrl>` từ `domToDataUrl`, tức SVG chỉ bọc ảnh PNG.
    - `@xyflow/react` 12.11.6 đã cài: có `useNodesInitialized`; `editor-canvas.tsx` không bật `onlyRenderVisibleElements`.
    - Core: hai bản `pickUnusedName` trong `build-many-to-many.ts` và `build-relation.ts`.
    - Frontend: `toIssueMessageValues` và `toInterpolation` có cùng thân hàm; hơn mười test dựng `ViewportControls` giả.
    - `eslint.config.mjs`: block `frontend/src/lib/api/**` đặt lại `no-restricted-properties`.
    - Conformance: có `sqlserver.test.ts`, `probes/sqlserver.probe.test.ts` và nhóm `seed sql on sql server`.
    - Có log `2026-10-03-sqlserver-code-check.md`.
- **File thay đổi**
  - Sửa `document/plans/2026-10-03-import-export-plan.md` (1278 thành 1309 dòng).
  - Tạo `document/executions/logs/2026-10-03-import-export-plan-review.md`.
  - Thêm mục này vào log lập plan.
- **Kiểm tra**
  - Script Python đếm `|` không escape theo từng bảng: không có dòng lệch cột.
  - Không có `TODO` hay `TBD`.
  - `pnpm exec prettier --check` trên plan và hai log: pass.
  - Kiểm tra lại đợt: đợt 3 (Task 4, 11, 14, 17, 29) và đợt 4 (Task 12, 15, 16, 21, 22) không có file sở hữu chung.
- **Quyết định** (quan trọng trước)
  - Phát hiện 6:
    - Hai lệnh mới là type `CanvasNodeControls` với context riêng (`CanvasNodeControlsProvider`, `useCanvasNodeControls`) đặt trong `viewport-controls.tsx`, không thêm vào `ViewportControls`. Lý do: thêm vào `ViewportControls` sẽ làm hỏng typecheck của hơn mười test đang dựng `ViewportControls` giả, trong đó `code-panel.test.tsx` thuộc Task 23.
    - `fitNodes` dùng `useNodesInitialized` và chỉ fit khi mọi id đã có trong `getNodes()` với kích thước đã đo.
    - `getMeasuredNodes` trả `Node[]` để `captureCanvasImage` vẫn dùng được `getNodesBounds`.
  - Lỗi chặn 2:
    - Test UTF-16 LE của Task 24 cần fixture SSMS, nên Task 12 export `SSMS_SCRIPT_SOURCE`, `SSMS_SCRIPT_EXPECTED_DIAGNOSTICS` qua `@schemaforge/core/testing`. Vì vậy điểm nóng `testing/index.ts` đổi thành Task 12 rồi Task 20 (Task 20 phụ thuộc Task 12).
    - Tài liệu được so với kết quả import chuỗi gốc, không so trực tiếp với `SSMS_SCRIPT_EXPECTED`. Lý do: `toComparableSchema` không export (Vấn đề 18). Task 12 đã so chuỗi gốc với `…_EXPECTED` trong core.
  - Phát hiện 11:
    - Bỏ câu "chạy trước Task 24" thay vì thêm phụ thuộc, để không kéo dài đường tới hạn. Task tối ưu (nếu có) không đổi hợp đồng nên chỉ cần merge trước Task 32.
    - Với bench 20 000 phần tử, nếu `applyOperation` có trung vị trên 3 giây thì báo orchestrator chọn giữa tối ưu và hạ giới hạn. Hạ giới hạn là đổi spec, cần người dùng duyệt.
  - Phát hiện 10: bench của scanner và parser đặt ở `importers/sql/sql-parsing.bench.ts`, vì lint của Task 1 chỉ cho import adapter trong `importers/sql/` và `importers/dbml/`.
  - Góp ý file journey của Task 28: đổi tên thành `frontend/src/features/editor/journeys/import-export.test.tsx`.
- **Ghi chú cho người tiếp theo**
  - Không sửa `roadmap.md`, `architecture.md` hay spec, theo yêu cầu của dispatcher. Các thay đổi spec do review sinh ra (Vấn đề 8, 17, quyết định SQL Server, `domToForeignObjectSvg`) đã ghi trong danh sách việc của Task 33.
