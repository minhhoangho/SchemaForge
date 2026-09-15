# Danh sách tính năng

Tài liệu này tách mục "Tính năng" trong [overview.md](../overview.md) thành từng tính năng có mã, gắn với phần tương ứng trong [roadmap.md](../roadmap.md). Nội dung lấy từ `overview.md`, `architecture.md` và `roadmap.md`; tài liệu không chốt quyết định kỹ thuật mới.

Tiêu chí hoàn thành ở đây là bản nháp. Spec của từng phần sẽ chốt lại tiêu chí và thiết kế chi tiết. Khi thêm, bớt hoặc chuyển phần của một tính năng, cập nhật tài liệu này cùng `overview.md` và `roadmap.md`.

## Cách đọc

| Cột | Ý nghĩa |
|---|---|
| Mã | Dùng để tham chiếu tính năng trong spec và plan. Mã giữ nguyên khi tính năng đổi phần hoặc đổi ưu tiên. |
| Đăng nhập | Tính năng có cần tài khoản hay không. |
| Phần | Số thứ tự của phần trong `roadmap.md` làm tính năng này. |
| Ưu tiên | P1, P2 hoặc P3, xem bên dưới. |

Mức ưu tiên (đề xuất, có thể điều chỉnh):

- **P1**: năng lực nêu ở mục "SchemaForge là gì" và "Nguyên tắc sản phẩm" trong `overview.md`, hoặc điều kiện để một tính năng P1 khác dùng được.
- **P2**: các tính năng còn lại thuộc phần 3 đến phần 8.
- **P3**: tính năng thuộc phần 9 (Hoàn thiện).

Ưu tiên nói về tầm quan trọng, không phải thứ tự làm. Thứ tự làm theo `roadmap.md`, nên một tính năng P2 như dark mode vẫn làm từ phần 3.

## Yêu cầu chung

Áp dụng cho mọi tính năng, lấy từ `architecture.md`:

- Mọi thay đổi schema, dù từ canvas, AI hay import, là một operation của `packages/core`, nên undo được.
- Core validate schema trước khi áp dụng thay đổi; backend validate lại bằng core trước khi lưu.
- Tính năng không cần đăng nhập chạy hoàn toàn trên trình duyệt, không gọi server.
- AI chỉ thay đổi schema qua tool call ánh xạ sang operation. Không đưa output tự do của model (ví dụ SQL thô) thẳng vào schema.
- Gemini API key chỉ nằm trong biến môi trường của backend: không gửi về client, không ghi vào log, thông báo lỗi hay analytics.
- Mọi chuỗi trên giao diện đi qua i18n, có đủ `vi` và `en`.

## 1. Visual Schema Editor

| Mã | Tính năng | Đăng nhập | Phần | Ưu tiên |
|---|---|---|---|---|
| ED-01 | Thêm, sửa, xóa bảng | Không | 3 | P1 |
| ED-02 | Thêm, sửa, xóa cột | Không | 3 | P1 |
| ED-03 | Quan hệ 1-1, 1-n, n-n | Không | 3 | P1 |
| ED-04 | Index | Không | 3 | P2 |
| ED-05 | Enum | Không | 3 | P2 |
| ED-06 | Comment cho bảng và cột | Không | 3 | P2 |
| ED-07 | Nhóm bảng (subject area) | Không | 9 | P3 |
| ED-08 | Ghi chú trên canvas | Không | 9 | P3 |
| ED-09 | Zoom, pan | Không | 3 | P1 |
| ED-10 | Minimap | Không | 3 | P2 |
| ED-11 | Auto-layout | Không | 9 | P3 |
| ED-12 | Dark mode, light mode | Không | 3 | P2 |
| ED-13 | Undo, redo | Không | 3 | P1 |

### ED-01. Thêm, sửa, xóa bảng

- [ ] Tạo bảng mới trên canvas, đổi tên và xóa bảng.
- [ ] Xóa các bảng và quan hệ đang chọn trên canvas bằng phím Delete hoặc Backspace; một lần undo khôi phục tất cả. Phím không có tác dụng khi đang gõ trong ô nhập liệu hoặc khi hộp thoại đang mở.
- [ ] Core báo lỗi khi hai bảng trùng tên trong cùng một schema.
- [ ] Xóa bảng không để lại quan hệ trỏ tới bảng không còn tồn tại.

### ED-02. Thêm, sửa, xóa cột

- [ ] Thêm, sửa, xóa cột trong một bảng.
- [ ] Sửa được tên, kiểu dữ liệu, nullable, default, unique, primary key, auto-increment.
- [ ] Chọn kiểu dữ liệu từ bộ kiểu chung, hoặc nhập kiểu custom cho kiểu riêng của database.
- [ ] Khóa chính gồm được một hoặc nhiều cột.
- [ ] Core báo lỗi khi hai cột trùng tên trong cùng một bảng.
- [ ] Core báo lỗi với tổ hợp thuộc tính không hợp lệ, ví dụ auto-increment trên cột không phải kiểu số.

Ghi chú: bộ kiểu dữ liệu, giá trị mặc định và danh sách thuộc tính cột được chốt ở [spec phần 2](2026-09-14-core-schema-model-design.md) (câu hỏi 4 và 5).

### ED-03. Quan hệ 1-1, 1-n, n-n

- [ ] Tạo quan hệ giữa hai bảng bằng cách kéo nối trên canvas, hoặc chỉ dùng bàn phím qua hộp thoại tạo quan hệ, và chọn loại 1-1, 1-n hoặc n-n.
- [ ] Quan hệ dùng được khóa ngoại nhiều cột, và chọn được hành động ON DELETE, ON UPDATE.
- [ ] Chọn n-n tạo một bảng trung gian cùng hai quan hệ 1-n; undo một bước là bỏ cả ba. Bảng trung gian thêm được cột như bảng thường.
- [ ] Canvas thể hiện loại của từng quan hệ.
- [ ] Core báo lỗi khi cột khóa ngoại và cột được tham chiếu khác kiểu dữ liệu.
- [ ] Xóa cột không để lại quan hệ trỏ tới cột không còn tồn tại.

Ghi chú: model chỉ có quan hệ 1-1 và 1-n; n-n được lưu thành bảng trung gian thật (câu hỏi 5 và 6). Chi tiết ở [spec phần 2](2026-09-14-core-schema-model-design.md).

### ED-04. Index

- [ ] Tạo, sửa, xóa index trên một hoặc nhiều cột của một bảng.
- [ ] Đánh dấu được index là unique.
- [ ] Core báo lỗi khi index dùng cột không tồn tại.

### ED-05. Enum

- [ ] Tạo, sửa, xóa enum cùng danh sách giá trị.
- [ ] Chọn enum làm kiểu dữ liệu của cột.
- [ ] Core báo lỗi khi enum không có giá trị nào hoặc có giá trị trùng nhau.
- [ ] Core báo lỗi khi cột dùng enum không tồn tại.

### ED-06. Comment cho bảng và cột

- [ ] Thêm, sửa, xóa comment của bảng và cột.
- [ ] Comment xuất hiện trong output của generator ở những đích hỗ trợ comment.

Ghi chú: phần 3 làm giao diện comment; tiêu chí về output của generator được kiểm tra ở phần 6.

### ED-07. Nhóm bảng (subject area)

- [ ] Tạo nhóm có tên, thêm và bớt bảng trong nhóm.
- [ ] Canvas hiển thị nhóm bao quanh các bảng thuộc nhóm.

Ghi chú: model hỗ trợ subject area từ phần 2, giao diện làm ở phần 9.

### ED-08. Ghi chú trên canvas

- [ ] Thêm, sửa, xóa và di chuyển ghi chú dạng văn bản trên canvas.
- [ ] Ghi chú được lưu cùng schema.

Ghi chú: model hỗ trợ ghi chú từ phần 2, giao diện làm ở phần 9.

### ED-09. Zoom, pan

- [ ] Phóng to, thu nhỏ và kéo canvas bằng chuột và trackpad.
- [ ] Có thao tác đưa toàn bộ schema vào khung nhìn.

### ED-10. Minimap

- [ ] Minimap hiển thị toàn bộ schema và vùng đang xem.
- [ ] Bấm hoặc kéo trên minimap để di chuyển tới vùng tương ứng.

### ED-11. Auto-layout

- [ ] Tự sắp xếp vị trí các bảng để hạn chế chồng lấn và đường quan hệ cắt nhau.
- [ ] Undo được kết quả của auto-layout.

### ED-12. Dark mode, light mode

- [ ] Chuyển giữa dark mode và light mode; lựa chọn được ghi nhớ khi mở lại.
- [ ] Mọi màn hình, kể cả canvas, hiển thị đúng ở cả hai chế độ.

Ghi chú: làm từ phần 3 vì thêm sau sẽ phải sửa lại toàn bộ giao diện.

### ED-13. Undo, redo

- [ ] Undo, redo mọi thay đổi schema, kể cả thay đổi do AI và import tạo ra.
- [ ] Undo, redo dựa trên operation của core, không dựa trên bản sao toàn bộ schema.

Ghi chú: phần 3 kiểm tra undo, redo cho thay đổi từ canvas, panel và hộp thoại; thay đổi do AI và import được kiểm tra ở phần 5 và phần 7.

## 2. AI Schema Assistant

Tính năng trọng tâm. Mọi tính năng trong nhóm này cần đăng nhập; người dùng không cần API key vì backend gọi Gemini bằng key của hệ thống.

| Mã | Tính năng | Đăng nhập | Phần | Ưu tiên |
|---|---|---|---|---|
| AI-01 | Sinh schema từ mô tả bằng tiếng Việt hoặc tiếng Anh | Có | 5 | P1 |
| AI-02 | Chat nhiều lượt để chỉnh sửa schema | Có | 5 | P1 |
| AI-03 | Gợi ý cải thiện | Có | 5 | P2 |
| AI-04 | Giải thích schema | Có | 5 | P2 |
| AI-05 | Phát hiện lỗi thiết kế | Có | 5 | P2 |
| AI-06 | Sinh dữ liệu mẫu | Có | 5 | P2 |

Tiêu chí chung cho nhóm AI:

- [ ] Khi chưa đăng nhập, người dùng được mời đăng nhập trước khi dùng AI.
- [ ] Frontend gửi tin nhắn kèm schema hiện tại lên backend, không gọi thẳng Gemini.
- [ ] Câu trả lời được stream về frontend.
- [ ] Mỗi request gắn với một người dùng. Backend giới hạn tần suất gọi AI (rate limit) để chống lạm dụng; chưa có quota theo ngày hay theo tháng.
- [ ] Thay đổi schema do AI đề xuất chỉ được áp dụng sau khi người dùng xem diff trên canvas (bảng, cột được thêm, sửa, xóa) và chọn Chấp nhận. Chọn Bỏ thì schema giữ nguyên.

### AI-01. Sinh schema từ mô tả

- [ ] Người dùng mô tả hệ thống bằng tiếng Việt hoặc tiếng Anh và nhận về schema gồm bảng, cột, quan hệ.
- [ ] Kết quả đi qua tool call và được core validate. Sau khi người dùng chấp nhận diff, thay đổi được áp dụng theo đúng đường của thao tác tay.
- [ ] Undo được thay đổi do AI tạo ra.

### AI-02. Chat nhiều lượt để chỉnh sửa schema

- [ ] AI giữ ngữ cảnh các lượt trước trong cùng cuộc hội thoại.
- [ ] Mỗi lượt gửi kèm schema hiện tại, nên AI thấy cả những thay đổi người dùng làm bằng tay giữa các lượt.
- [ ] Tool call không hợp lệ bị core từ chối và không làm thay đổi schema.

### AI-03. Gợi ý cải thiện

- [ ] AI gợi ý về index, chuẩn hóa, đặt tên và quan hệ còn thiếu, kèm lý do cho từng gợi ý.
- [ ] Gợi ý chỉ thay đổi schema khi người dùng chọn áp dụng; khi áp dụng, thay đổi đi qua operation như AI-02.

### AI-04. Giải thích schema

- [ ] AI giải thích mục đích của bảng, cột và quan hệ bằng ngôn ngữ người dùng đang dùng.
- [ ] Giải thích không làm thay đổi schema.

### AI-05. Phát hiện lỗi thiết kế

- [ ] AI chỉ ra vấn đề thiết kế, nêu bảng hoặc cột liên quan và cách sửa.

Ghi chú: validation của core chặn schema không hợp lệ, ví dụ hai bảng trùng tên. AI-05 tìm vấn đề ở schema hợp lệ nhưng thiết kế chưa tốt, ví dụ một cột chứa nhiều giá trị, dữ liệu lặp lại giữa các bảng, hoặc kiểu dữ liệu không hợp với ý nghĩa của cột.

### AI-06. Sinh dữ liệu mẫu

- [ ] AI sinh dữ liệu mẫu hợp ngữ cảnh, dựa trên tên và ý nghĩa của bảng và cột.
- [ ] Dữ liệu tuân thủ kiểu dữ liệu, nullable, unique, enum và khóa ngoại.

Ghi chú: dùng chung `SeedDataset`, hàm kiểm tra và hàm xuất với seed data của Code Generator (CG-08), xem câu hỏi 9.

## 3. Code Generator

| Mã | Tính năng | Đăng nhập | Phần | Ưu tiên |
|---|---|---|---|---|
| CG-01 | SQL DDL: PostgreSQL, MySQL, SQL Server | Không | 6 | P1 |
| CG-02 | Prisma schema | Không | 6 | P1 |
| CG-03 | Drizzle schema | Không | 6 | P1 |
| CG-04 | TypeScript types | Không | 6 | P1 |
| CG-05 | Zod schema | Không | 6 | P1 |
| CG-06 | Mock API (REST) | Không | 6 | P2 |
| CG-07 | OpenAPI / Swagger | Không | 6 | P1 |
| CG-08 | Seed data | Không | 6 | P2 |
| CG-09 | DBML | Không | 6 | P2 |
| CG-10 | Tài liệu Markdown | Không | 6 | P2 |

Tiêu chí chung cho nhóm Code Generator:

- [ ] Chạy trên trình duyệt bằng `packages/core`, không cần đăng nhập, không gọi server.
- [ ] Với schema hợp lệ, output đúng cú pháp và dùng được với công cụ đích.
- [ ] Cùng một schema luôn cho cùng một output.
- [ ] Người dùng xem và copy được output. Tải output thành file thuộc IE-05.

Ghi chú: đích không hỗ trợ một khái niệm thì generator dùng ánh xạ gần nhất hoặc bỏ phần đó, kèm diagnostic khi output mất thông tin (câu hỏi 7). Thiết kế chi tiết ở [spec phần 6](2026-09-14-code-generators-design.md).

### CG-01. SQL DDL

- [ ] Chọn được dialect: PostgreSQL, MySQL, SQL Server.
- [ ] Output gồm bảng, cột, khóa chính, khóa ngoại, index, enum và comment, trong phạm vi dialect hỗ trợ.
- [ ] Chạy output trên database của dialect tương ứng không gặp lỗi.

### CG-02. Prisma schema

- [ ] Output gồm model, quan hệ, enum và index.
- [ ] `prisma validate` chạy qua với output.

### CG-03. Drizzle schema

- [ ] Output gồm bảng, quan hệ, enum và index cho PostgreSQL và MySQL. SQL Server chưa được hỗ trợ (Drizzle 0.45 chưa có dialect này).
- [ ] Output qua typecheck TypeScript strict.

### CG-04. TypeScript types

- [ ] Mỗi bảng có một type tương ứng; nullable và enum được thể hiện trong kiểu.
- [ ] Output qua typecheck TypeScript strict.

### CG-05. Zod schema

- [ ] Mỗi bảng có một Zod schema; nullable và enum được thể hiện trong schema.
- [ ] Output qua typecheck TypeScript strict.

### CG-06. Mock API (REST)

- [ ] Sinh mock REST API cho các bảng trong schema.

Ghi chú: output là một file handler MSW 2 (câu hỏi 8).

### CG-07. OpenAPI / Swagger

- [ ] Output là tài liệu OpenAPI 3.1, có định nghĩa schema cho từng bảng và đường dẫn CRUD.
- [ ] Output qua công cụ validate OpenAPI.

### CG-08. Seed data

- [ ] Sinh dữ liệu mẫu tuân thủ kiểu dữ liệu, nullable, unique, enum và khóa ngoại.
- [ ] Dữ liệu của bảng được tham chiếu đứng trước dữ liệu của bảng tham chiếu tới nó. Vòng khóa ngoại được phá bằng câu `UPDATE` sau khi chèn.

Ghi chú: xuất SQL `INSERT` theo dialect hoặc JSON; dùng chung định dạng và quy tắc kiểm tra với AI-06 (câu hỏi 9).

### CG-09. DBML

- [ ] Output là DBML hợp lệ.
- [ ] Import lại output bằng IE-03 cho schema tương đương. Test round-trip đầy đủ được làm ở phần 7, khi có importer DBML.

### CG-10. Tài liệu Markdown

- [ ] Tài liệu liệt kê từng bảng với cột, kiểu dữ liệu, ràng buộc, comment, index và quan hệ, cùng danh sách enum.

## 4. Import & Export

| Mã | Tính năng | Đăng nhập | Phần | Ưu tiên |
|---|---|---|---|---|
| IE-01 | Import SQL | Không | 7 | P2 |
| IE-02 | Import Prisma | Không | 7 | P2 |
| IE-03 | Import DBML | Không | 7 | P2 |
| IE-04 | Import JSON | Không | 7 | P2 |
| IE-05 | Export mọi định dạng của Code Generator | Không | 7 | P2 |
| IE-06 | Export JSON | Không | 7 | P2 |
| IE-07 | Export ảnh PNG, SVG | Không | 7 | P2 |
| IE-08 | Export file ZIP | Không | 7 | P2 |

Tiêu chí chung cho import:

- [ ] Kết quả import đi qua operation của core, được validate và undo được.
- [ ] Khi không đọc được file, báo lỗi rõ ràng kèm vị trí lỗi nếu có (ví dụ số dòng), và không làm thay đổi schema hiện tại.

Ghi chú: import có hai chế độ, tạo schema mới hoặc gộp vào; không có chế độ thay thế (câu hỏi 10).

### IE-01. Import SQL

- [ ] Đọc câu lệnh DDL của PostgreSQL, MySQL và SQL Server thành bảng, cột, khóa chính, quan hệ và index.
- [ ] Câu lệnh không đọc được báo diagnostic kèm dòng và cột.

### IE-02. Import Prisma

- [ ] Đọc model, quan hệ, enum và index từ file schema Prisma.
- [ ] Import output của CG-02 cho schema tương đương.

### IE-03. Import DBML

- [ ] Đọc bảng, cột, quan hệ, enum, index và comment từ file DBML.
- [ ] Import output của CG-09 cho schema tương đương.

### IE-04. Import JSON

- [ ] Đọc file JSON theo định dạng schema model của core.
- [ ] Import output của IE-06 cho schema giống hệt bản gốc.

### IE-05. Export mọi định dạng của Code Generator

- [ ] Tải về file cho từng định dạng từ CG-01 đến CG-10, với tên và phần mở rộng phù hợp.

### IE-06. Export JSON

- [ ] Tải về file JSON theo định dạng schema model của core, gồm cả subject area và ghi chú.

### IE-07. Export ảnh PNG, SVG

- [ ] Tải về ảnh sơ đồ schema dạng PNG hoặc SVG.
- [ ] Ảnh thể hiện đủ bảng, cột và quan hệ, không bị cắt.
- [ ] Ảnh theo theme đang hiển thị (sáng hoặc tối); muốn ảnh theme kia thì đổi theme rồi xuất.

### IE-08. Export file ZIP

- [ ] Chọn nhiều định dạng và tải về một file ZIP chứa tất cả.

## 5. Lưu trữ & chia sẻ

| Mã | Tính năng | Đăng nhập | Phần | Ưu tiên |
|---|---|---|---|---|
| ST-01 | Lưu local | Không | 3 | P1 |
| ST-02 | Đăng ký, đăng nhập | Không | 4 | P1 |
| ST-03 | Lưu cloud | Có | 4 | P2 |
| ST-04 | Danh sách schema trên cloud | Có | 4 | P2 |
| ST-05 | Chia sẻ link public, private | Có | 8 | P2 |
| ST-06 | Lịch sử phiên bản cơ bản | Có | 8 | P2 |

ST-02 và ST-04 không có trong danh sách của `overview.md` nhưng thuộc phần 4 trong `roadmap.md`. ST-02 là điều kiện để dùng AI, lưu cloud, chia sẻ và lịch sử phiên bản.

### ST-01. Lưu local

- [ ] Schema vẫn còn sau khi tải lại trang hoặc đóng và mở lại trình duyệt.
- [ ] Khách (chưa đăng nhập) lưu và mở schema không cần tài khoản; không gọi mạng nào.
- [ ] Lưu được nhiều schema trên trình duyệt; có màn hình danh sách để tạo, mở, đổi tên và xóa schema.

Ghi chú: khách lưu được nhiều schema (câu hỏi 11). Sau khi đăng nhập, bản trên trình duyệt chỉ làm cache cho bản cloud (xem ST-03).

### ST-02. Đăng ký, đăng nhập

- [ ] Đăng ký, đăng nhập và đăng xuất bằng email và mật khẩu.
- [ ] Đăng ký xong dùng được ngay, không cần xác minh email.
- [ ] Khi chưa đăng nhập, dùng tính năng cần tài khoản sẽ được mời đăng nhập; các tính năng còn lại vẫn dùng bình thường.
- [ ] Đăng nhập không làm mất schema đang lưu trên trình duyệt.

Ghi chú: chưa có chức năng quên mật khẩu, nên phần 4 chưa cần dịch vụ gửi email.

### ST-03. Lưu cloud

- [ ] Lưu schema lên server; backend validate bằng core, từ chối tài liệu sai cấu trúc kèm lý do; tài liệu còn issue ngữ nghĩa vẫn được lưu.
- [ ] Mở lại được schema đã lưu từ thiết bị khác sau khi đăng nhập.
- [ ] Sau khi đăng nhập, schema tự động được lưu lên cloud; bản trên trình duyệt chỉ làm cache.
- [ ] Lần đầu đăng nhập, người dùng được hỏi có đưa các schema đang lưu local lên cloud không.
- [ ] Khi phát hiện xung đột theo revision, người dùng chọn giữ bản nào.

### ST-04. Danh sách schema trên cloud

- [ ] Xem danh sách schema đã lưu cloud, mở và xóa từng schema.
- [ ] Người dùng chỉ thấy và thao tác được trên schema của chính mình.

### ST-05. Chia sẻ link public, private

- [ ] Tạo link public: ai có link cũng xem được schema.
- [ ] Tạo link private (phạm vi xem câu hỏi 13).
- [ ] Người tạo thu hồi được link đã chia sẻ.

### ST-06. Lịch sử phiên bản cơ bản

- [ ] Xem danh sách phiên bản của một schema, kèm thời điểm tạo.
- [ ] Xem lại và khôi phục một phiên bản cũ.

Ghi chú: phạm vi của "cơ bản" xem câu hỏi 14.

## 6. Tính năng hỗ trợ

| Mã | Tính năng | Đăng nhập | Phần | Ưu tiên |
|---|---|---|---|---|
| UX-01 | Templates có sẵn | Không | 9 | P3 |
| UX-02 | Presentation mode | Không | 9 | P3 |
| UX-03 | Phím tắt | Không | 9 | P3 |
| UX-04 | Giao diện tiếng Việt và tiếng Anh | Không | 3 | P1 |

### UX-01. Templates có sẵn

- [ ] Tạo schema mới từ template: E-commerce, SaaS, Blog, Social.
- [ ] Mọi template là schema hợp lệ theo core.

### UX-02. Presentation mode

- [ ] Trình bày schema cho người khác xem, không hiện công cụ chỉnh sửa.

Ghi chú: phạm vi chưa rõ, xem câu hỏi 15.

### UX-03. Phím tắt

- [ ] Có phím tắt cho các thao tác thường dùng trên canvas.
- [ ] Xem được danh sách phím tắt ngay trong ứng dụng.
- [ ] Phím tắt không kích hoạt khi người dùng đang gõ trong ô nhập liệu.

Ghi chú: undo, redo (ED-13) và phím Delete, Backspace để xóa phần tử đang chọn trên canvas (ED-01) làm từ phần 3; các phím tắt còn lại và danh sách phím tắt làm ở phần 9.

### UX-04. Giao diện tiếng Việt và tiếng Anh

- [ ] Đổi ngôn ngữ giữa tiếng Việt và tiếng Anh; lựa chọn được ghi nhớ.
- [ ] Không có chuỗi giao diện hardcode; mọi chuỗi có đủ bản `vi` và `en`.

Ghi chú: làm từ phần 3 vì thêm sau sẽ phải sửa lại toàn bộ giao diện.

## Tổng hợp theo phần trong roadmap

| # | Phần | Tính năng |
|---|---|---|
| 1 | Scaffold & tooling | Không có tính năng cho người dùng |
| 2 | Core schema model | Không có giao diện. Model phải hỗ trợ đủ khái niệm của ED-01 đến ED-08 và định dạng JSON của IE-04, IE-06 |
| 3 | Editor MVP | ED-01 đến ED-06, ED-09, ED-10, ED-12, ED-13, ST-01, UX-04 |
| 4 | Auth + lưu cloud | ST-02, ST-03, ST-04 |
| 5 | AI Assistant | AI-01 đến AI-06 |
| 6 | Code generators | CG-01 đến CG-10 |
| 7 | Import / Export | IE-01 đến IE-08 |
| 8 | Chia sẻ + lịch sử phiên bản | ST-05, ST-06 |
| 9 | Hoàn thiện | ED-07, ED-08, ED-11, UX-01, UX-02, UX-03 |

## Câu hỏi còn mở

Mỗi câu được trả lời trong spec của phần ở cột cuối. Khi có câu trả lời, câu hỏi được chuyển xuống mục "Câu hỏi đã trả lời" và giữ nguyên số thứ tự, vì các mục ở trên tham chiếu tới số này.

| # | Câu hỏi | Tính năng | Chốt ở phần |
|---|---|---|---|
| 13 | Link private giới hạn người xem thế nào? Người mở link chia sẻ có sửa được schema không? | ST-05 | 8 |
| 14 | "Lịch sử phiên bản cơ bản" gồm những gì: khi nào tạo phiên bản, có so sánh hai phiên bản không? | ST-06 | 8 |
| 15 | Presentation mode hiển thị gì và khác chế độ xem thường ở điểm nào? | UX-02 | 9 |

## Câu hỏi đã trả lời

Quyết định kỹ thuật và lý do nằm trong [architecture.md](../architecture.md).

| # | Câu hỏi | Trả lời | Tính năng |
|---|---|---|---|
| 1 | Người dùng có cần xem trước và xác nhận thay đổi của AI trước khi áp dụng không? | Có. Người dùng xem diff trên canvas rồi chọn Chấp nhận hoặc Bỏ. | AI-01, AI-02, AI-03 |
| 2 | Giới hạn sử dụng AI cho mỗi người dùng là bao nhiêu, tính theo request hay token? | Chỉ rate limit theo tần suất, chưa có quota theo ngày hay theo tháng. Con số cụ thể chốt ở spec phần 5. | AI-01 đến AI-06 |
| 3 | Bản lưu local và bản lưu cloud đồng bộ với nhau thế nào? | Sau khi đăng nhập, bản cloud là bản chính, bản local làm cache. Lần đầu đăng nhập, người dùng được hỏi có đưa schema local lên cloud không. Xung đột được phát hiện theo revision, người dùng chọn giữ bản nào. | ST-01, ST-03 |
| 4 | Kiểu dữ liệu của cột là một bộ kiểu chung rồi ánh xạ sang từng dialect, hay theo dialect ngay từ đầu? | Một bộ kiểu chung trong core; mỗi generator ánh xạ sang đích của mình (PostgreSQL, MySQL, SQL Server, Prisma, Drizzle, TypeScript, Zod…). Có kiểu custom cho kiểu riêng của từng database. Chi tiết ở [spec phần 2](2026-09-14-core-schema-model-design.md). | ED-02, CG-01 đến CG-05, IE-01 |
| 5 | Model có hỗ trợ khóa chính và khóa ngoại nhiều cột, hành động ON DELETE và ON UPDATE không? | Có. Hỗ trợ đầy đủ khóa chính và khóa ngoại nhiều cột, cùng hành động ON DELETE và ON UPDATE (CASCADE, SET NULL, RESTRICT…). | ED-02, ED-03 |
| 6 | Quan hệ n-n được lưu thành bảng trung gian hay một loại quan hệ riêng? | Bảng trung gian thật; model chỉ có quan hệ 1-1 và 1-n. Tạo quan hệ n-n trên canvas là một thao tác gộp, tạo bảng trung gian cùng hai quan hệ 1-n và undo trong một bước. Bảng trung gian thêm được cột. | ED-03, CG-01 đến CG-03 |
| 7 | Khi đích sinh code không hỗ trợ một khái niệm (ví dụ enum trong SQL Server), generator xử lý thế nào? | Bảng ánh xạ kiểu của từng đích là hợp đồng. Ánh xạ tương đương không báo gì (enum trong SQL Server là `nvarchar` kèm `CHECK`). Khi output mất một ràng buộc, hành động, comment hoặc phần tử, generator dùng ánh xạ gần nhất hoặc bỏ phần đó, kèm diagnostic (enum trong Prisma cho SQL Server thành `String`). Chi tiết ở [spec phần 6](2026-09-14-code-generators-design.md). | CG-01 đến CG-10 |
| 8 | "Mock API (REST)" sinh ra gì: code server mock, request handler hay file cấu hình? | Một file handler MSW 2: CRUD cho từng bảng trên dữ liệu trong bộ nhớ lấy từ seed data, chạy ngay trong ứng dụng của người dùng, không cần server. | CG-06 |
| 9 | Seed data (CG-08) và dữ liệu mẫu do AI sinh (AI-06) khác nhau thế nào, có dùng chung định dạng output không? | CG-08 sinh giá trị theo kiểu, xác định theo seed, chạy trên trình duyệt, không cần đăng nhập, không dùng faker. AI-06 sinh giá trị hợp ngữ cảnh qua backend. Hai tính năng dùng chung `SeedDataset`, hàm kiểm tra và hàm xuất SQL `INSERT` theo dialect hoặc JSON. | CG-08, AI-06 |
| 10 | Import thay thế schema hiện tại hay gộp vào? | Hai chế độ: tạo schema mới (mặc định) và thêm vào schema hiện tại; không có chế độ thay thế. Tên trùng khi gộp được đổi bằng hậu tố `_2`, `_3`… kèm diagnostic. Chi tiết ở [spec phần 7](2026-09-15-import-export-design.md), mục 2. | IE-01 đến IE-04 |
| 10 (một phần) | Import SQL hỗ trợ những dialect nào? | PostgreSQL, MySQL, SQL Server. SchemaForge chưa hỗ trợ SQLite. | IE-01 |
| 11 | Khi chưa đăng nhập, trình duyệt lưu được một hay nhiều schema? | Nhiều schema, kèm màn hình danh sách để tạo, mở, đổi tên và xóa schema. | ST-01 |
| 12 | Đăng nhập bằng những phương thức nào? | Chỉ email và mật khẩu. Chưa xác minh email khi đăng ký và chưa có chức năng quên mật khẩu. | ST-02 |
