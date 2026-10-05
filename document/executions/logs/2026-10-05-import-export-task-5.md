# Task 5: Xếp vị trí theo lưới

- Plan: [2026-10-03-import-export-plan.md, Task 5](../../plans/2026-10-03-import-export-plan.md#task-5-xếp-vị-trí-theo-lưới)
- Spec: [2026-09-15-import-export-design.md, mục 4](../../specs/2026-09-15-import-export-design.md#4-vị-trí-bảng-khi-import)

## 2026-10-05 17:05 — core-engineer — Xong

- **Đã làm**
  - Thêm `placeElements(input: PlacementInput, layout: LayoutMetrics): Placement` cùng type `PlacementInput`, `Placement` đúng chữ ký của plan.
  - Gom bảng theo subject area (`Map`, giữ thứ tự nguồn trong nhóm), nhóm sắp theo `toNameKey` rồi tên (so `<`, `>`), nhóm `null` cuối; lưới `ceil(sqrt(n))` cột (ít nhất 1), ô rộng `tableWidth + gap`, mỗi nhóm bắt đầu hàng mới, chiều cao hàng `headerHeight + max(số cột) × columnRowHeight + gap`; ghi chú một hàng dưới mọi bảng; tọa độ `Math.round`; metric âm hoặc không hữu hạn throw `RangeError`.
  - TDD: test viết trước, chạy đỏ vì `Cannot find module './place-elements.js'`, rồi xanh sau khi cài đặt.
- **File thay đổi**
  - `packages/core/src/importers/shared/place-elements.ts` (mới)
  - `packages/core/src/importers/shared/place-elements.test.ts` (mới, 13 test gồm 1 property test fast-check với `PROPERTY_SEED`, `PROPERTY_RUNS`)
- **Kiểm tra**
  - `.claude/scripts/test-file.sh core src/importers/shared/place-elements.test.ts`: đỏ (module chưa có) rồi `RESULT: PASS`.
  - `.claude/scripts/verify.sh core --build --format`: typecheck, lint, test (3069 test pass, coverage dòng 97.62%), build, prettier đều PASS; `RESULT: PASS`.
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Metric bằng 0 hợp lệ (spec chỉ cấm âm và không hữu hạn).
  - Không có bảng thì ghi chú nằm ở `y = 0`; có bảng thì ghi chú ở đỉnh hàng kế tiếp, tức đã cách hàng bảng cuối một `gap` (vì chiều cao hàng đã cộng `gap`).
  - Tọa độ tính bằng số thực rồi làm tròn từng điểm (không làm tròn kích thước ô) để vị trí bám sát lưới lý thuyết; property test dùng metric nguyên nên không có sai số làm tròn.
  - Không kiểm tra `columnCount`, `noteCount` âm: đầu vào do importer tự đếm, không phải dữ liệu người dùng.
  - Thêm test `keeps the source order of tables inside a group` và trường hợp ghi chú khi không có bảng ngoài danh sách test của plan, vì đó là quy tắc trong "Chữ ký và hành vi".
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**
  - Task 4 (`assembleDocument`) gọi `placeElements` với bảng theo thứ tự draft, tên subject area của bảng (sau khi giải tham chiếu; không giải được thì `null`), số cột và `options.layout`; kết quả cùng thứ tự với input.
  - Với metric thực có `gap` < 1, làm tròn có thể làm hai bảng chạm nhau dưới 1 px; frontend truyền hằng nguyên (`IMPORT_LAYOUT_METRICS`, Vấn đề 6) nên không xảy ra.
