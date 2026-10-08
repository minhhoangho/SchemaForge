# Sửa lỗi `window is not defined` từ timer của sonner (frontend)

Không thuộc plan task nào; liên quan `frontend/src/features/editor/hooks/use-delete-selection.test.tsx`.

## 2026-10-08 — test-engineer — Xong
- **Đã làm**: Tái hiện bằng test giả lập teardown (xóa `window` sau khi test cuối kết thúc): timer `setTimeout(removeToast, 200)` của sonner (`deleteToast`) và callback `requestAnimationFrame` chạy sau khi jsdom bị hủy, React đọc `window` trong `resolveUpdatePriority` nên ném `ReferenceError`. Nguyên nhân gốc: `toast.dismiss()` trong `afterEach` không chờ các timer thoát của sonner; nút action (Undo) còn đặt thêm một timer `deleteToast` thứ hai, nên DOM trống chưa có nghĩa là hết timer. Chạy riêng file hoặc full run đều pass (race phụ thuộc tải máy, không tái hiện được tự nhiên 7 lần). Nguyên nhân nằm ở test, không phải production code.
- **File thay đổi**: `frontend/src/features/editor/hooks/use-delete-selection.test.tsx` (afterEach chờ toast rời DOM rồi chờ 300 ms thật trong `act`).
- **Kiểm tra**: `.claude/scripts/verify.sh frontend` -> typecheck, lint, test PASS; 5330 tests pass, exit 0, không có "Unhandled"/"window is not defined"; coverage dòng 96.15%.
- **Quyết định**: Sửa trong file test, không đụng setup chung hay `onUnhandledError`. Chờ bằng timer thật 300 ms (timer chạy theo thứ tự nên timer đặt sau luôn chạy sau timer sonner 200 ms) thay vì fake timers vì user-event và waitFor đang dùng timer thật.
- **Việc còn lại**: không bắt buộc.
- **Ghi chú cho người tiếp theo**: Còn ~20 file test khác dùng `toast.dismiss()` trong afterEach (journeys, cloud-journeys, ...) có thể mắc cùng race latent nếu test cuối của file kết thúc ngay sau khi đóng toast. Nếu lỗi lặp lại, cân nhắc đưa bước chờ vào `src/testing/setup-tests.ts` hoặc một helper dùng chung `drainToasts`.
