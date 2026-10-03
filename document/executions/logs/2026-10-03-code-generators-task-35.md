# Task 35: Tài liệu, kết quả đo và kiểm tra cuối

- Plan: [`document/plans/2026-09-15-code-generators-plan.md`, Task 35](../../plans/2026-09-15-code-generators-plan.md#task-35-tài-liệu-kết-quả-đo-và-kiểm-tra-cuối)
- Spec: [`document/specs/2026-09-14-code-generators-design.md`](../../specs/2026-09-14-code-generators-design.md)

## 2026-10-03 — spec-writer — Dừng giữa chừng

Phần tài liệu đã xong; trạng thái "Dừng giữa chừng" chỉ vì các lệnh **Kiểm tra** của Task 35 do orchestrator chạy và chưa có kết quả.

- **Đã làm**
  - Spec phần 6:
    - Mục 4, ma trận SQL, Prisma, Drizzle, dòng "Quan hệ 1-1", ô Drizzle: `one` ở phía khóa ngoại; phía ngược `one(source)` chỉ khi quan hệ không có tên (Vấn đề 18).
    - CG-03 bullet "Relations v1": quan hệ 1-1 có tên không có trường phía ngược, vì `one()` của `drizzle-orm` 0.45 bắt buộc `fields` khi có config.
    - CG-08 bullet "Unique": hết `SEED_MAX_ROW_ATTEMPTS` (20) lượt sinh lại thì dừng sinh bảng đó, giữ các dòng đã có, báo `seed-rows-reduced` (Vấn đề 20).
    - CG-08 đoạn "Quan hệ với AI-06": thêm `parseSeedDataset` (subpath `@schemaforge/core/generators/seed`, stack tường minh tối đa 64 tầng, Zod, `invalid-shape`, tối đa 1000 dòng mỗi bảng) (Vấn đề 19).
    - Mục 8: đường dẫn code `frontend/src/features/editor/code-generator/` và các module thật, cột code `32rem`, `useGoToIssue`, skip link, biến nội suy, token `--code-*` theo spec phần 10, cách nạp worker trên production.
    - Mục 9: bảng kết quả `vitest bench` (p75 lần đo cuối sau tối ưu seed, p75 của Task 28, mục tiêu, kết quả), ngày đo, máy, tải máy; seed 100 dòng mỗi bảng nay đạt (355,52 ms so với mục tiêu ≤ 500 ms).
    - Bảng quyết định (cạnh R21–R27): thêm R28 (tối ưu seed giữ output), R29 (`useGoToIssue`), R30 (biến nội suy, không có `relation`), R31 (`--code-*`), R32 (skip link), R33 (nạp worker trên production). Đoạn mở đầu nhắc R28–R33.
    - Mục "Rủi ro cần kiểm tra khi triển khai": rủi ro Next.js 16 đã xác nhận; thêm việc còn mở: conformance SQL Server chưa chạy (22 test), màn hình hẹp 500 px, tối ưu tùy chọn.
    - Mục "Vấn đề với các spec đã duyệt": đoạn dẫn ghi rằng spec và plan phần 2 đã được cập nhật.
  - Spec phần 2: mục 8 thêm `index-name-conflicts-table` (sau `index-name-duplicate`) và `table-columns-empty` (sau `subject-area-name-duplicate`), đúng thứ tự `ISSUE_CODES` 27 mã; mục 7 dòng Index; mục 6 và mục 9 (`buildRelation` 1-1) hành vi `suggestIndexName` tránh cả tên bảng.
  - Plan phần 2: một ghi chú dưới đoạn mở đầu, dẫn tới Task 36 của plan phần 6. Không đánh dấu tiến độ.
  - `architecture.md`: sửa tại chỗ các dòng "Giao diện generator" (worker, CSP, loader Turbopack, namespace i18n), "Drizzle" (1-1 có tên), "Mock API" (`msw@^2`), "Seed data" (`parseSeedDataset`), "Syntax highlight" (tách token trong worker, `--code-*` của spec phần 10), "Conformance test của generator" (`pnpm test:conformance`, cổng chặn, SQL Server chưa chạy). Mục "Chưa chốt" không có hạng mục nào của phần 6, nên không chuyển dòng nào.
  - `roadmap.md`: phần 6 từ "Xong plan" sang "Đang làm" (không phải "Xong"), kèm một đoạn giải thích việc còn lại.
  - `CLAUDE.md`, chỉ mục "Commands": thêm câu về `pnpm test:conformance` (cần Docker, cổng chặn của task generator).
- **File thay đổi**
  - `document/specs/2026-09-14-code-generators-design.md`
  - `document/specs/2026-09-14-core-schema-model-design.md`
  - `document/plans/2026-09-14-core-schema-model-plan.md`
  - `document/architecture.md`
  - `document/roadmap.md`
  - `CLAUDE.md`
  - `document/executions/logs/2026-10-03-code-generators-task-35.md` (log này)
- **Kiểm tra**
  - `pnpm exec prettier --check` trên 7 file đã sửa: "All files formatted correctly", thoát 0. Lưu ý: `.prettierignore` bỏ `*.md`, nên lệnh này không kiểm tra nội dung Markdown; bảng được kiểm tra bằng script đếm cột (không có dòng lệch số cột).
  - `.claude/scripts/secret-scan.sh`: `SECRET-SCAN: CLEAN`.
  - Các lệnh trong khối **Kiểm tra** của Task 35: orchestrator đã chạy, kết quả ở mục 2026-10-03 của orchestrator bên dưới.
- **Quyết định**
  - Phần 6 để "Đang làm" thay vì "Xong" như plan ghi: handoff phiên 3 và R3 của spec ghi phần 6 chỉ xong khi mọi bộ conformance qua, mà SQL Server chưa chạy. "Đang làm" là trạng thái gần nhất trong từ vựng của `roadmap.md`. Đây là chỗ lệch khỏi plan, theo chỉ thị của orchestrator.
  - Bảng kết quả mục 9 dùng p75 của lần đo cuối (log tối ưu seed) cho mọi biến thể, kèm cột p75 của Task 28 để so: log tối ưu seed đo lại p75 của mọi biến thể nhưng chỉ ghi mean, p99 cho các biến thể seed và mock-api, nên không ghi mean, p99 để các cột đồng đều.
  - Ghi chú trong mục 9 rằng mục tiêu "trung vị" được đọc theo p75 (Vitest 5 không in trung vị; p75 không nhỏ hơn trung vị nên chặt hơn), thay vì sửa câu mục tiêu: không đổi quyết định của spec.
  - R28–R33 nối vào cùng bảng với R21–R27 (mục "Quyết định bổ sung 2026-10-02", vốn đã chứa các dòng ngày 2026-10-03), không tạo mục mới: đánh số liên tục, một chỗ để tra.
  - Việc còn mở (SQL Server, màn hình hẹp, tối ưu tùy chọn) ghi vào mục "Rủi ro cần kiểm tra khi triển khai" của spec; `roadmap.md` chỉ ghi SQL Server vì đó là điều kiện để phần 6 sang "Xong".
  - Ghi chú trong plan phần 2 đặt ngay dưới đoạn mở đầu: một chỗ duy nhất, không sửa nội dung task.
  - Sửa câu `--code-*` của mục 8 (spec từng ghi "trỏ về token của shadcn/ui"), vì spec phần 10 đã thay cách viết đó; ghi lý do ở R31.
- **Việc còn lại**
  - [x] Orchestrator chạy trên `master` sau khi mọi task đã merge: `source ~/.nvm/nvm.sh >/dev/null 2>&1; nvm use 24 >/dev/null 2>&1;` rồi `pnpm install --frozen-lockfile`, ghi kết quả vào mục **Kiểm tra** của log này.
  - [x] `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, ghi kết quả.
  - [ ] `docker info >/dev/null && pnpm test:conformance --force`, ghi kết quả. 22 test SQL Server (14 trong `packages/codegen-conformance/src/sqlserver.test.ts`, 8 trong `src/seed-sql.test.ts -t "seed sql on sql server"`) đang bị người dùng chọn bỏ qua; ghi rõ là bỏ qua hay đã chạy.
  - [x] `git status --porcelain`, ghi kết quả.
  - [ ] Kiểm tra tay trên bản build production (`pnpm --filter @schemaforge/frontend build` rồi `start`), không đăng nhập: sinh code cho mọi đích; tab Network không có request ngoài file tĩnh của ứng dụng; Console không có vi phạm CSP; với `createLargeSchema({ tableCount: 200 })` nạp vào editor, đổi đích tới khi code hiện ≤ 1 giây và kéo bảng trong lúc sinh code không giật. Ghi từng kết quả.
  - [ ] Khi conformance SQL Server qua: đổi phần 6 trong `roadmap.md` sang "Xong", bỏ đoạn giải thích, và gạch mục SQL Server trong "Việc còn mở" của spec phần 6 (giao `spec-writer`).
  - [x] Commit: `docs: record code generators decisions and mark part 6 done` theo plan; vì phần 6 chưa "Xong", orchestrator có thể dùng `docs: record code generators decisions and results`.
- **Ghi chú cho người tiếp theo**
  - Không đổi quyết định nào của spec ngoài các mục Task 35 giao và R28–R33 do orchestrator đưa.
  - Bảng mục 9 là số đo khi máy tải nặng (load average khoảng 45); muốn số chính xác thì chạy lại `pnpm --filter @schemaforge/core bench --reporter=verbose` khi máy yên tĩnh (khoảng 1 phút).

## 2026-10-03 — orchestrator (do spec-writer ghi) — Xong (trừ conformance SQL Server)

- **Đã làm**: chạy các lệnh trong khối **Kiểm tra** của Task 35 trên `master` tại `b2ead44`, Node 24, và kiểm tra tay trên trình duyệt. Chấp nhận các thay đổi tài liệu và quyết định của lượt spec-writer ở trên, gồm trạng thái "Đang làm" của phần 6 và commit message `docs: record code generators decisions and results`.
- **File thay đổi**: không có file code; `git status --porcelain` trước commit tài liệu chỉ có 6 file tài liệu của lượt spec-writer cùng log này.
- **Kiểm tra**
  - `pnpm install --frozen-lockfile`: OK.
  - `pnpm typecheck`: OK, Turbo 7/7 task. `pnpm lint`: OK, 6/6. `pnpm test`: OK, 8/8. `pnpm build`: OK, 8/8. Các lần chạy theo package trước đó: frontend 3845 test, core 2633 test.
  - Conformance, trong `packages/codegen-conformance`: `vitest run --exclude src/sqlserver.test.ts -t '^(?!.*sql server).*$'`. 15/16 file pass, 142 test pass. File duy nhất fail là `src/probes/sqlserver.probe.test.ts`: container không khởi động (`Log stream ended and message "/.*Recovery is complete.*/" was not received`, 9 test bị bỏ qua), đúng giới hạn đã biết của VM Docker 2 GB. `pnpm test:conformance --force` ở root KHÔNG chạy trọn vì SQL Server không khởi động được.
  - Kiểm tra tay ngày 2026-10-03, không đăng nhập:
    - Dev server: sinh và highlight SQL DDL, Seed, Drizzle; Copy hoạt động; bàn phím và theme tối ổn.
    - Bản production `next start` ở cổng 3002: worker nạp qua `turbopack-worker-*.js` dưới CSP thật. Lỗi Console duy nhất là 404 `/favicon.ico`, không có lỗi CSP.
    - CHƯA làm: sinh đủ 10 đích trên bản production; rà toàn bộ tab Network tìm request ra ngoài; nạp `createLargeSchema({ tableCount: 200 })` vào editor để đo ≤ 1 giây và kéo bảng không giật. Bằng chứng thay thế: trong bench mọi generator ≤ 38 ms p75, và ở Task 33 Shiki mất 130 ms cho 4642 dòng.
  - `git status --porcelain` trước commit tài liệu: chỉ 6 file tài liệu của lượt spec-writer và log này.
- **Quyết định**: commit tài liệu dùng message `docs: record code generators decisions and results` (phần 6 chưa "Xong").
- **Việc còn lại**
  - [ ] Chạy conformance SQL Server khi Docker có ít nhất 4 GB trống (không dừng các container `local_*` của người dùng): 22 test (14 trong `packages/codegen-conformance/src/sqlserver.test.ts`, 8 trong `src/seed-sql.test.ts -t "seed sql on sql server"`) cùng probe `src/probes/sqlserver.probe.test.ts`; sau đó chạy `pnpm test:conformance --force` ở root một lần và ghi kết quả.
  - [ ] Kiểm tra tay trên bản production (`pnpm --filter @schemaforge/frontend build` rồi `start`), không đăng nhập: sinh đủ 10 đích; rà toàn bộ tab Network, không có request ngoài file tĩnh của ứng dụng; nạp `createLargeSchema({ tableCount: 200 })` vào editor, đổi đích tới khi code hiện ≤ 1 giây, và kéo bảng trong lúc sinh code không giật.
  - [ ] Khi hai mục trên qua: giao `spec-writer` đổi phần 6 trong `document/roadmap.md` sang "Xong", bỏ đoạn giải thích dưới bảng, và đóng mục SQL Server trong "Việc còn mở" ở mục "Rủi ro cần kiểm tra khi triển khai" của spec phần 6.
- **Ghi chú cho người tiếp theo**: lỗi `Recovery is complete` của container SQL Server là do VM Docker 2 GB, không phải lỗi code; đừng dừng các container `local_*` của người dùng để lấy bộ nhớ.
