# Toolbar hẹp và test conflict không ổn định

Không thuộc plan task nào; sửa lỗi nhỏ theo yêu cầu của dispatcher.

## 2026-10-03 — frontend-engineer — Xong
- **Đã làm**
  - Nguyên nhân tràn ngang: thanh toolbar đã có `overflow-x-auto` nhưng không phải containing block; các node `sr-only` (position absolute: role=status của cloud badge, nhãn của language switch...) thoát khỏi vùng cắt và nới `scrollWidth` của trang lên 1041 px. Thêm `relative` vào thanh để chúng bị cắt, và `shrink-0` cho nhóm tài khoản/giao diện/ngôn ngữ.
  - Đo trên trình duyệt thật (viewport 500 px): `documentElement.scrollWidth` = 500; thanh toolbar tự cuộn (clientWidth 500, scrollWidth 1066). Các nút vẫn trong tab order, focus tự cuộn vào vùng nhìn thấy.
  - Test flaky: `findByRole("alertdialog")` trong nhóm "with a conflict" chỉ xuất hiện sau chuỗi async thật (auth probe, fetch cloud, liveQuery Dexie); khi chạy song song thì vượt timeout mặc định 1000 ms. Đặt `asyncUtilTimeout` 4000 ms cho riêng nhóm này (khôi phục sau mỗi test). Mọi `findBy`/`waitFor` trong nhóm (kể cả `useCloudVersion`, toast) cùng mẫu nên được phủ.
- **File thay đổi**
  - `frontend/src/features/editor/components/toolbar/editor-toolbar.tsx`
  - `frontend/src/features/editor/components/toolbar/editor-toolbar.test.tsx`
  - `frontend/src/features/editor/components/editor-screen.test.tsx`
- **Kiểm tra**: `.claude/scripts/verify.sh frontend --format` -> `RESULT: PASS` (3847 test); `.claude/scripts/secret-scan.sh` -> `SECRET-SCAN: CLEAN`.
- **Quyết định**
  - Giữ thanh cuộn ngang trong chính toolbar, không thêm menu tràn: đơn giản nhất, không đổi giao diện ở >= 1280 px, không thêm i18n.
  - Không đổi code production của editor-screen: chuỗi async là I/O thật, không có race; chỉ test cần deadline rộng hơn.
  - Timeout 4000 ms (< 5000 ms của test) để lỗi thật vẫn báo bằng thông điệp của testing-library.
- **Ghi chú cho người tiếp theo**: jsdom không áp dụng layout, nên test toolbar chỉ kiểm tra class `relative` và `overflow-x-auto`; cần xem tay ở 360 px nếu muốn (đã đo 500 px).
