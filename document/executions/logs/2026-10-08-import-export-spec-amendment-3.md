# Sửa spec phần 7 theo conformance Task 20 (lần 3)

Không thuộc task nào trong plan. Ghi các quyết định orchestrator lấy thay người dùng ngày 2026-10-08, sau lần chạy conformance thật của Task 20 (log `document/executions/logs/2026-10-05-import-export-task-20.md` trong worktree `agent-a85fccee5100b0edc`, mục ngày 2026-10-08 20:40, nhóm A, B, C), vào [spec phần 7](../../specs/2026-09-15-import-export-design.md). Lần sửa trước: [lần 2](2026-10-05-import-export-spec-amendment-2.md). Plan không đổi.

## 2026-10-08 21:30 — spec-writer — Xong

- **Đã làm**
  - Spec: thêm dòng "Sửa 2026-10-08 lần 3 …" dưới dòng sửa lần 2.
  - Spec mục 5, "Giá trị mặc định" (A): thêm dòng bảng cho chuỗi `YYYY-MM-DD HH:MM:SS[.f]` kèm độ lệch `±hh` hoặc `±hh:mm` tùy chọn trên cột `timestamp`, `timestamptz`: viết lại thành dạng ISO của model (`T`, `±hh:mm`, giữ số chữ số giây lẻ), không diagnostic; chuỗi không đúng dạng giữ nguyên theo dòng "Chuỗi" (sai dạng thì issue `column-default-invalid`). Đoạn chuẩn bị trước bảng thêm ví dụ ép kiểu `::timestamp without time zone` (đã bị bỏ bởi quy tắc ép kiểu có sẵn).
  - Spec mục 5, "Giá trị mặc định" (B): đoạn chuẩn bị thêm việc bỏ introducer `_<tên bộ ký tự>` đứng trước đúng một chuỗi (MySQL), không diagnostic, chuỗi giải escape như literal MySQL; introducer kèm `COLLATE`, nối chuỗi, hàm vẫn `default-not-supported`.
  - Spec mục 5, "Namespace, tên, khóa, quan hệ", Index (C): gạch đầu dòng "Index ngầm của khóa ngoại MySQL" với ba điều kiện (tên bằng chính xác tên ràng buộc khóa ngoại cùng bảng, cùng danh sách cột đúng thứ tự, không khóa nào khác của bảng bắt đầu bằng các cột đó); index khác tên được giữ; PostgreSQL, SQL Server không áp dụng.
  - Spec mục 6: dòng `@@index(map:)` áp quy tắc C với `provider = "mysql"` (tên khóa ngoại là `map` của `@relation`, không có thì tên mặc định Prisma `<bảng>_<cột>_fkey`); dòng `dbgenerated` dẫn A, B và mô tả dạng escape của `information_schema` mà `prisma db pull` ghi cho MySQL (bỏ một lớp escape `\'`, `\\` khi nội dung bắt đầu bằng `(_<charset>\'`).
  - Spec mục 15: hai dòng dump và dòng `prisma db pull` của bảng conformance so sau chuẩn hóa; đoạn mới "So sau chuẩn hóa, không so từng byte" liệt kê bốn bước của `normalizeDatabaseForms` (số thực, jsonb, `time` 6 chữ số, chữ thường tên kiểu custom MySQL), chuẩn hóa của introspection (xóa comment, unique một cột thành `isUnique`), lý do bỏ `naming-edge` khỏi `db pull`, và nguyên tắc chỉ chuẩn hóa khác biệt dạng lưu đã quan sát, không che lỗi importer. Bảng test core thêm trường hợp cho A, B, C.
  - Spec "Rủi ro": dòng `prisma db pull` dẫn tới mục 15; thêm rủi ro chưa quyết định về literal `timestamptz` MySQL không có độ lệch.
- **File thay đổi**
  - `document/specs/2026-09-15-import-export-design.md`
  - `document/executions/logs/2026-10-08-import-export-spec-amendment-3.md` (log này)
- **Kiểm tra**
  - Đối chiếu trước khi ghi: `validation/rules/default-literals.ts` (`timestamp` chỉ nhận `YYYY-MM-DDTHH:MM:SS[.f]`, `timestamptz` thêm `Z` hoặc `±hh:mm`); `importers/shared/sql-default-mapping.ts` (literal chuỗi luôn giữ, ép kiểu `::` bị bỏ bởi `findCast`); `buildConstraintName` trong `generators/shared/constraint-names.ts`.
  - Đối chiếu dump thật trong scratchpad của phiên (`inspect/mysql-target-limit.dump.sql`, `.pull.prisma`, `postgresql-target-limit.dump.sql`): `DEFAULT (_utf8mb4'a\\b')`; `dbgenerated("(_utf8mb4\\'a\\\\\\\\b\\')")`; `` KEY `cycle_a_b_id_fkey` (`b_id`) `` kèm ràng buộc cùng tên; `@@index([b_id], map: "cycle_a_b_id_fkey")` và `@relation` không có `map`; `'2026-01-01 20:04:05.123+00'::timestamp with time zone`; dump MySQL đặt `SET TIME_ZONE='+00:00'` và `timestamp(6)` không có độ lệch.
  - Số ô của mọi dòng bảng trong spec (bỏ qua `\|`) bằng script Python tạm: không có dòng lệch.
  - `pnpm exec prettier --check document/specs/2026-09-15-import-export-design.md`: `All matched files use Prettier code style!`.
  - `git status --porcelain`: spec, log này, cùng `eslint.config.mjs` (bản sửa sẵn có của người dùng, không đụng tới).
- **Quyết định**
  - A, B, C và mô tả conformance là quyết định của orchestrator. Spec-writer chỉ chốt chi tiết cần để ghi đúng: (1) chuỗi không đúng dạng thời điểm giữ hành vi có sẵn của dòng "Chuỗi" (literal giữ, issue `column-default-invalid`), không phải `default-not-supported` như prompt ghi, vì đó là hành vi hiện có của `mapSqlDefault` với literal chuỗi; (2) bỏ một lớp escape cho `dbgenerated` MySQL dạng `information_schema`, vì không có bước này quy tắc B không áp được cho Prisma; (3) quy tắc C chỉ cho index thường (không unique, không `FULLTEXT`, `SPATIAL`) và so tên chính xác, theo hướng giữ index khi nghi ngờ; (4) tên khóa ngoại phía Prisma lấy `map` của `@relation` hoặc tên mặc định của Prisma, vì `db pull` bỏ `map` khi tên bằng tên mặc định.
  - Prompt yêu cầu thêm ghi chú vào danh sách Task 33 "nếu plan/spec có danh sách đó": spec không có; danh sách nằm ở plan Task 33 và plan giữ nguyên. Nội dung conformance ở mục 15 đã ghi trong lần sửa này, nên Task 33 chỉ cần giữ nó khi sửa mục 15 (conformance chạy local).
- **Việc còn lại**: không với lần sửa spec này. Vấn đề mở chuyển cho orchestrator: literal `timestamptz` MySQL không có độ lệch (spec "Rủi ro").
- **Ghi chú cho người tiếp theo**
  - core-engineer sửa `packages/core/src/importers/shared/sql-default-mapping.ts` (A, B), nơi ghép index của importer SQL (`importers/sql/sql-draft-index-rules.ts` hoặc tương đương) và importer Prisma (C, `dbgenerated` MySQL), kèm test theo bảng test core mục 15; rồi chạy lại ba file conformance của Task 20.
  - Sau A, conformance PostgreSQL còn cần bước chuẩn hóa `timestamptz` về UTC (pg_dump đổi `+07:00` thành `+00`); MySQL `timestamptz_value` của `target-limit` vẫn đỏ cho tới khi orchestrator quyết định rủi ro ở trên.
