# Bàn giao trạng thái phần 10 (Visual refresh) và phần 4 — 2026-10-02

Tài liệu bàn giao cho session mới, viết cuối phiên làm việc ngày 2026-10-02. Nguồn công việc của phần 10 là `document/plans/2026-10-01-visual-refresh-plan.md` (11 task) và spec đã duyệt `document/specs/2026-10-01-visual-refresh-design.md`; mockup tham chiếu ở `document/ui_reference/visual-refresh-mockup.html`.

Đây là tài liệu trạng thái, không phải plan. Nó không thay đổi quyết định nào trong spec hay plan. Phần 4 (Auth + cloud) không đổi so với [2026-10-01-auth-cloud-handoff.md](2026-10-01-auth-cloud-handoff.md), bản này chỉ trỏ tới đó (mục 3).

---

## 1. Trạng thái git

- Nhánh `master`, working tree **sạch**, đã push lên `origin/master`. HEAD = `30edfe7`. Không còn worktree, không còn agent đang chạy.
- 16 commit của phần 10 trên `master`, theo thứ tự cũ → mới:

```
964bb54 docs: add visual refresh spec and mockup
8bf74ee docs: add visual refresh plan
a12ec53 feat(frontend): add visual refresh theme tokens and contrast tests
9527771 feat(frontend): self-host plus jakarta sans and jetbrains mono
cf9b211 feat(frontend): restyle shared ui components for the visual refresh
94ca2b8 feat(frontend): derive table header accent from the table id
4fd8620 feat(frontend): restyle table nodes with accent headers
54f8c96 feat(frontend): draw relations as rounded right-angle paths
9a6ee24 feat(frontend): restyle the editor toolbar and status pills
7ffafac feat(frontend): restyle editor panels and dialogs
3aee07c feat(frontend): restyle the schema list with a brand mark
59156ef chore(frontend): apply tailwind class order to restyled ui components
4dc94bf feat(frontend): restyle auth pages and shared app components
8ed275e fix(frontend): address visual refresh review findings
b6bae46 fix(frontend): keep focus ring contrast headroom on primary hover
30edfe7 fix(frontend): show every table in the minimap on first load
```

Thứ tự Task 1–10 khớp các commit `feat` từ `a12ec53` đến `4dc94bf` (Task 10), `59156ef` là bản dọn thứ tự class tailwind xen giữa.

Kiểm tra tại `30edfe7`, orchestrator tự chạy:

| Lệnh | Kết quả |
|---|---|
| `.claude/scripts/verify.sh frontend --build` | `RESULT: PASS`; 3423 test; coverage dòng khoảng 96% |
| `pnpm format:check` (gốc repo) | pass |
| `.claude/scripts/secret-scan.sh` | `CLEAN` |

---

## 2. Phần 10 "Visual refresh"

Task 1–10 đã xong và đã push. Review: `project-reviewer` "accept with follow-ups" (mọi follow-up đã làm), `ui-a11y-reviewer` approve cho Task 1–9 và Task 10, bản sửa minimap đã được review và approve. `document/roadmap.md` đang ghi phần 10 là `Xong plan`; Task 11 đổi thành `Xong`.

### 2.a. Kiểm tra tay — **CẦN NGƯỜI DÙNG**

Mười mục ở plan, mục [Kiểm tra tay cho người dùng](2026-10-01-visual-refresh-plan.md#kiểm-tra-tay-cho-người-dùng). Chạy bằng Chrome, `pnpm dev` (frontend cổng 3000, backend cổng 3001), mỗi mục kiểm ở light và dark, `vi` và `en` khi có chữ.

Thêm các mục sau, phát sinh từ review và các bản sửa sau plan:

| # | Hạng mục bổ sung |
|---|---|
| 11 | Minimap hiện **đủ mọi bảng ngay lần tải đầu**, nở ra khi thêm một cột, và hiện lại sau khi xóa bảng rồi hoàn tác |
| 12 | Handle của node bảng là **hình tròn đầy đủ** (không bị cắt); góc dải tiêu đề bo theo thẻ |
| 13 | Nút primary vừa hover vừa focus bàn phím vẫn thấy vòng focus |
| 14 | Chip `U` và `AI` (10px) đọc được khi phóng chữ 200% |
| 15 | Link tiêu đề schema ở danh sách có gạch chân khi chưa hover |
| 16 | Request font chỉ đến từ `/_next/static/media/` (gộp được với mục 4 của plan) |

Kết quả ghi cho Task 11 dưới dạng bảng `| # | Hạng mục | Kết quả | Trình duyệt | Ghi chú |`, kèm ngày chạy và commit đã kiểm tra. Mục "Không đạt" thì dừng mục đó, giao một task sửa riêng, commit theo `.claude/rules/git.md`, rồi chạy lại đúng mục đó và ghi cả hai kết quả.

### 2.b. Task 11 — tài liệu (`spec-writer`, sau kiểm tra tay)

Theo thân Task 11 của plan, commit `docs: record visual refresh decisions and mark part 10 done`:

- `document/architecture.md`: hàng "UI kit, styling" thêm font Plus Jakarta Sans và JetBrains Mono qua `next/font`; cập nhật hàng token và focus ring; ghi đường quan hệ vẽ bằng `getSmoothStepPath` (`borderRadius: 8`, `offset: 16`); màu dải tiêu đề bảng là hash FNV-1a của id bảng chia dư cho 8, màu riêng cho từng bảng do người dùng chọn hoãn sang phần 9.
- `document/roadmap.md`: phần 10 → `Xong`.
- Ghi kết quả kiểm tra tay vào plan.
- **Thứ tự:** Task 11 sửa cùng hai file với Task 38 của phần 4. Chạy sau Task 38; nếu chạy trước thì merge cẩn thận, chỉ sửa đúng các hàng liên quan.

### 2.c. Sai lệch so với plan và spec, cần ghi vào Task 11

Do orchestrator quyết trong lúc làm; người dùng có thể bác bỏ.

| # | Plan / spec ghi | Thực tế | Lý do |
|---|---|---|---|
| 1 | Plan Task 7: trạng thái cloud `conflict` và `deleted-in-cloud` dùng sắc warning | Dùng sắc **destructive** ở cả toolbar và danh sách schema | Hai trạng thái này cần người dùng xử lý, không chỉ cảnh báo |
| 2 | Spec §4: thẻ node bảng có `overflow-hidden` **và** dải tiêu đề bo | Thẻ **không** có `overflow-hidden`; dải tiêu đề tự bo góc | `overflow-hidden` cắt mất handle của React Flow |
| 3 | Hover nút primary (token cũ) | Hover pha 5% foreground: `color-mix(in oklch, primary, foreground 5%)`, có test chốt trong `globals.test.ts`; vòng focus sáng trên primary đang hover đạt 3,04:1, tối 3,29:1 | Giữ đủ biên tương phản cho vòng focus |
| 4 | Spec §10: link tiêu đề schema không gạch chân khi chưa hover | **Có** gạch chân khi chưa hover | Lời khuyên của `ui-a11y-reviewer` |
| 5 | Lời mời đăng nhập dùng `bg-muted` | Dùng `bg-card` | `primary` trên `muted` chỉ 4,49:1, dưới ngưỡng 4,5:1 |
| 6 | Không có trong plan | Component dùng chung mới `frontend/src/components/centered-card-layout.tsx` cho sign-in, sign-up, 404 | Tránh lặp bố cục thẻ giữa ba trang |
| 7 | Không có trong plan | Sửa minimap: kích thước node đo được là **state React** trong `editor-canvas.tsx` (không còn là ref), hàm `mergeMeasuredSizes` trong `apply-canvas-changes.ts`; chỉ là view state, **không** đi qua core operation hay undo | Lỗi có từ phần 3 (minimap trống ở lần tải đầu) |

### 2.d. Việc mở, không chặn

Không có case tương phản `primary` trên `muted` trong `TEXT_CASES` (cố ý: cặp này đạt 4,49:1, không đạt, và hiện không component nào dùng). Nếu sau này có component dùng cặp này thì phải đổi màu hoặc nền, không thêm case để che.

---

## 3. Phần 4 (Auth + cloud) — không đổi

Vẫn còn **Task 37** (checklist kiểm tra tay trên bản build, cần người dùng) và **Task 38** (tài liệu cuối, phụ thuộc Task 37). Chi tiết điều kiện tiên quyết, danh sách mục kiểm tay và các việc mở chờ người dùng quyết nằm ở [2026-10-01-auth-cloud-handoff.md](2026-10-01-auth-cloud-handoff.md), mục 2 và 3.

Lưu ý mới: các mục kiểm tay của Task 37 nay chạy trên **giao diện mới** của phần 10, nên kết quả có thể khác lúc plan được viết (vị trí nút, nhãn trạng thái, màu).

---

## 4. Bài học cho orchestrator

1. Chạy đầy đủ `verify.sh` trong 4–5 worktree cùng lúc làm máy quá tải và ra timeout test giả. Dặn agent chỉ chạy test nhắm đích, rồi chạy lại **tuần tự** trên `master` sau khi merge.
2. `verify.sh --format` chỉ kiểm file đã đổi trong working tree. Sau khi merge, chạy thêm `pnpm format:check` ở gốc repo: `prettier-plugin-tailwindcss` sắp lại class khi `globals.css` có token theme mới (đây là lý do có commit `59156ef`).
3. `worktree-setup.sh` cần đường dẫn tuyệt đối của worktree; `$(pwd)` bị từ chối.
4. Một lượt `spec-writer` từng bị watchdog 10 phút không có output giết. Dặn agent tài liệu **tạo file sớm và lưu từng mục**.
5. Worktree bị khóa bởi agent đã xong thì gỡ bằng `git worktree remove -f -f`.

---

## 5. Khởi động nhanh cho session mới

Từ repo gốc `/Users/hominhhoang/Documents/Work/01_Software-development/01_Github_minhhoangho/SchemaForge`:

```bash
source ~/.nvm/nvm.sh && nvm use
pnpm dev          # frontend :3000, backend :3001
```

Kiểm tra:

```bash
.claude/scripts/verify.sh frontend --build
pnpm format:check
.claude/scripts/secret-scan.sh
```

Tin nhắn đầu tiên gợi ý cho orchestrator: chạy danh sách kiểm tra tay của phần 10 cùng người dùng (mục 2.a), rồi giao Task 11 cho `spec-writer` (mục 2.b, 2.c); và/hoặc tiếp tục Task 37 của phần 4 theo bản bàn giao ngày 2026-10-01.

Chỉ push sau khi các lệnh kiểm tra ở trên PASS (`.claude/rules/git.md`).
