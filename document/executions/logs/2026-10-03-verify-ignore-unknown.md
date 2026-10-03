# Sửa verify.sh bỏ qua file Prettier không hỗ trợ

## 2026-10-03 HH:MM — general-purpose — Xong
- **Đã làm**: thêm `--ignore-unknown` vào lệnh `pnpm exec prettier --check` của bước format trong `verify.sh`. Trước đó file không có parser (ví dụ `backend/.env.example`) làm bước fail với `No parser could be inferred`. Đã grep `.claude/scripts/`: không còn lệnh prettier nào khác (`_lib.sh` không gọi prettier); README không ghi dòng lệnh prettier nên không sửa.
- **File thay đổi**: `.claude/scripts/verify.sh` (1 dòng).
- **Kiểm tra**: `bash -n .claude/scripts/verify.sh` OK. Chạy `prettier --check -- ./backend/.env.example ./backend/src/app-setup.spec.ts`: không có cờ thì báo lỗi "No parser could be inferred"; có `--ignore-unknown` thì "All matched files use Prettier code style!". Không chạy verify.sh đầy đủ.
- **Quyết định**: chỉ thêm cờ, không đổi cấu trúc script.
- **Ghi chú cho người tiếp theo**: file bị bỏ qua sẽ không được kiểm tra định dạng; đó là hành vi mong muốn. Chưa commit.
