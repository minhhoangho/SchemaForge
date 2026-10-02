# Hook SessionStart trỏ vào handoff log

Không có plan task; việc nằm ngoài roadmap (cấu hình `.claude/`). Quy tắc liên quan: `.claude/rules/execution-logs.md`.

## 2026-10-02 — claude — Xong
- **Đã làm**: thêm hook `SessionStart` (matcher `clear|compact`) chạy `.claude/scripts/session-handoff.sh`; script in đường dẫn handoff mới nhất, ngày, chỉ dẫn đọc trước, và tối đa 12 heading `#`/`##`. Cập nhật rule và orchestrator: ghi handoff (tên kết thúc `-handoff.md`) rồi bảo người dùng chạy `/clear`.
- **File thay đổi**: `.claude/scripts/session-handoff.sh` (mới), `.claude/settings.json`, `.claude/scripts/README.md`, `.claude/rules/execution-logs.md`, `.claude/agents/orchestrator.md`.
- **Kiểm tra**: `bash -n` OK; `shellcheck` chưa cài (bỏ qua); `jq .` OK, `attribution` và `permissions` giữ nguyên; chạy với stdin JSON, `</dev/null`, `-h`, và `SESSION_HANDOFF_DIR` trỏ thư mục rỗng (không in gì, exit 0) đều đúng.
- **Quyết định**: tài liệu chính thức (code.claude.com/docs/en/hooks) xác nhận matcher SessionStart gồm `startup|resume|clear|compact|fork`, ghép được bằng `|`; stdout dạng text được thêm vào context. Script bỏ qua stdin hoàn toàn để không bao giờ bị treo. Chọn handoff theo tiền tố ngày cao nhất, hòa thì mtime mới nhất. Thêm biến `SESSION_HANDOFF_DIR` chỉ để test.
- **Việc còn lại**: không.
- **Ghi chú cho người tiếp theo**: hook đọc `$CLAUDE_PROJECT_DIR`; nếu thay đổi settings, cần mở lại session hoặc `/hooks` để nạp. Chưa commit.
