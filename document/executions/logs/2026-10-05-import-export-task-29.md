# Task 29: Chụp ảnh canvas

- Plan: [Task 29](../../plans/2026-10-03-import-export-plan.md#task-29-chụp-ảnh-canvas)
- Spec: [mục 10](../../specs/2026-09-15-import-export-design.md#10-ie-07-export-ảnh-png-svg)

## 2026-10-05 — frontend-engineer — Xong

- **Đã làm**
  - `computeImageFrame` (hàm thuần): lề 40 px, nới cạnh phải `SELF_RELATION_LOOP_WIDTH` = 16 khi có quan hệ tự tham chiếu, `pixelRatio` PNG theo `MAX_PNG_PIXELS`/`MAX_PNG_SIDE`, SVG luôn 1.
  - `captureCanvasImage`: khung bao bằng `getNodesBounds`, đặt `data-exporting="true"` trên `root` và gỡ trong `finally`, chụp `.react-flow__viewport` (PNG `domToBlob` `type: "image/png"`; SVG `domToForeignObjectSvg` + `XMLSerializer` thành blob `image/svg+xml`), `backgroundColor` là giá trị đã tính của `--background`, `filter` bỏ `data-export-exclude`, không `workerUrl`.
  - `CanvasNodeControls`, `CanvasNodeControlsProvider`, `useCanvasNodeControls` trong `viewport-controls.tsx` (context riêng, throw ngoài provider).
  - `EditorFlowProvider` cung cấp thêm `CanvasNodeControls`: `getMeasuredNodes` lọc node có `measured.width/height`; `fitNodes` lưu danh sách chờ trong state, effect phụ thuộc danh sách và `useNodesInitialized()` chỉ gọi `fitView` khi mọi id đã đo rồi xóa danh sách.
  - `editor-canvas.tsx`: `<RelationMarkers />` chuyển vào `<ViewportPortal>`; wrapper có `data-export-root`.
  - `globals.css`: khi `[data-exporting="true"]` ẩn handle, huy hiệu issue của node và icon issue trên nhãn edge, bỏ vòng chọn (ring + viền primary) của node, outline focus của node/edge, và đưa edge đang chọn về nét và marker mặc định (selector theo thuộc tính `marker-end`/`marker-start` sẵn có, nên edge có issue giữ marker issue).
- **File thay đổi**
  - Tạo: `frontend/src/features/editor/import-export/compute-image-frame.ts` (+ test), `capture-canvas-image.ts` (+ test), `frontend/src/features/editor/components/canvas/editor-flow-provider.test.tsx`.
  - Sửa: `frontend/src/features/editor/components/canvas/editor-canvas.tsx`, `editor-canvas.test.tsx`, `editor-flow-provider.tsx`, `frontend/src/features/editor/lib/viewport-controls.tsx`, `viewport-controls.test.tsx`, `frontend/src/app/globals.css`.
- **Kiểm tra**
  - RED: năm file test mới/sửa chạy bằng `.claude/scripts/test-file.sh frontend <file>` đều fail đúng lý do (thiếu module; `useCanvasNodeControls is not a function`; `expected null not to be null` cho marker trong viewport).
  - GREEN: cả năm file `RESULT: PASS`.
  - `.claude/scripts/verify.sh frontend --build --format`: typecheck, lint, build, prettier PASS; `test` FAIL do các test khác nhau timeout mỗi lần chạy (máy đang tải bởi agent song song): `editor-workspace.test.tsx`, `relations.test.tsx`, `schema-list-screen.test.tsx`, `conflict.test.tsx`... Chạy riêng từng file bằng `test-file.sh` đều PASS. Chạy toàn bộ ba lần (6, 7 rồi 3 test fail trên 4603, khác nhau mỗi lần, load average khoảng 90); vì bộ test chưa lần nào xanh trọn nên chưa có dòng coverage tổng: người merge chạy lại `pnpm --filter @schemaforge/frontend test` khi máy rảnh để xác nhận ≥80% số dòng. `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - `SELF_RELATION_LOOP_WIDTH = 16` bằng `EDGE_HANDLE_OFFSET` của `relation-edge.tsx` (vòng của `getSmoothStepPath` cùng phía phải ra đúng `offset`); nửa nhãn edge nằm trong lề 40 px.
  - Kiểu `CanvasCapture` khai báo bằng overload phần tử `(node: HTMLElement, options: Options) => Promise<…>` thay vì `typeof domToBlob`: `Parameters<typeof domToBlob>` lấy overload `Context` cuối và làm hỏng kiểu; hàm thật của `modern-screenshot` vẫn gán được.
  - Lệch plan: không đặt `data-export-exclude` trên `MiniMap`, `Background`: `MiniMapComponent` và `BackgroundComponent` của `@xyflow/react` 12.11.6 không chuyển prop thừa xuống DOM (đã đọc `dist/esm/index.mjs`), nên thuộc tính bị bỏ; hai phần tử này cũng nằm ngoài `.react-flow__viewport` nên không vào ảnh. Không có nút điều khiển viewport trong canvas (nút zoom ở toolbar). `filter` theo `data-export-exclude` vẫn có, cho phần tử sau này đặt trong viewport.
  - Không thêm CSS cho launcher/cửa sổ AI: chỉ `.react-flow__viewport` được chụp, còn launcher, cửa sổ AI, toolbar, panel, minimap, nền chấm, empty state nằm ngoài cây đó (và ngoài `data-export-root`), nên không thể vào ảnh; viết rule cho chúng là code chết.
  - Vòng focus: khi bấm mục menu Export, focus đã ở menu nên node/edge không còn `:focus-visible`; vẫn thêm rule `outline: none`. Nét dày `in-focus-visible:stroke-4!` của edge là `!important` trong layer nên không đè được bằng CSS ngoài layer; không cần vì lý do trên.
  - Dùng `!important` cho `stroke-width` của edge đang chọn vì `RelationEdge` đặt bề rộng bằng style inline.
- **Ghi chú cho người tiếp theo**
  - Chỉ trình duyệt thật xác nhận được (Task 32): ảnh PNG/SVG hiện đủ node, marker chân gà có trong ảnh (marker giờ nằm trong `.react-flow__viewport-portal`), nền đúng `--background` ở cả hai theme, handle/huy hiệu/vòng chọn bị ẩn, `oklch()` của `--background` được canvas và SVG chấp nhận, ảnh không bị cắt với schema lớn, CSP không chặn.
  - Nhãn edge đang chọn vẫn có viền `border-primary` trong ảnh (không có thuộc tính phân biệt ngoài lớp Tailwind); xem lại ở Task 32 nếu cần.
  - Task 28, 30, 31 dùng `useCanvasNodeControls()`; test của component dùng nó cần bọc `CanvasNodeControlsProvider` với lệnh giả.
