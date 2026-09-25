# Auth + lưu cloud

Spec cho phần 4 trong [roadmap.md](../roadmap.md): đăng ký, đăng nhập, đăng xuất bằng email và mật khẩu (ST-02), lưu schema lên cloud (ST-03) và danh sách schema trên cloud (ST-04) trong [danh sách tính năng](2026-09-14-feature-list-design.md). Đăng nhập cũng là điều kiện để dùng AI (phần 5), chia sẻ và lịch sử phiên bản (phần 8), nên các cơ chế ở đây (guard, cookie, rate limit, API client, lời mời đăng nhập) được thiết kế để các phần đó dùng lại.

Spec dựa trên [spec phần 1](2026-09-14-scaffold-tooling-design.md), [spec phần 2](2026-09-14-core-schema-model-design.md) và [spec phần 3](2026-09-14-editor-mvp-design.md), cả ba đã duyệt. Tên hàm của core (`parseSchemaDocument`, `applyOperation`, `renameSchema`), cấu trúc Dexie, autosave, Web Locks, CSP và namespace i18n lấy từ các spec đó.

Các đoạn TypeScript và Prisma là phác thảo. Plan và code tinh chỉnh tên và chi tiết, nhưng không đổi quyết định. Mục ghi ⚠ là lựa chọn cần người dùng xác nhận khi duyệt spec.

Trạng thái: đã duyệt. Người dùng xác nhận mọi đề xuất ⚠: mật khẩu tối thiểu 8 ký tự kèm danh sách mật khẩu phổ biến (mục 2); bộ đếm rate limit trong bộ nhớ, một instance (mục 3); giới hạn 100 schema mỗi tài khoản (mục 5); thêm package `packages/api-contract` (mục 5); đăng xuất xóa cache của tài khoản khỏi trình duyệt (mục 7); hộp thoại xung đột chỉ có "giữ bản trên máy" hoặc "dùng bản trên cloud", không thêm "giữ cả hai" (mục 7); PostgreSQL local qua Docker sẵn có trên máy dev, `prisma dev` là phương án thay thế khi không có Docker (mục 10). Ngoại lệ: đề xuất hoãn deploy sang một phần riêng của roadmap **không** được chấp nhận — chưa chọn nơi deploy, phương án cụ thể (ưu tiên gói miễn phí) được chọn sau, trong phần 4 (mục 12); không thêm phần 10 "Triển khai" vào roadmap.

## Quyết định đã có từ trước

Spec này không bàn lại các điểm sau (nguồn: `architecture.md`, `.claude/rules/`, câu trả lời câu hỏi 3 và 12 trong danh sách tính năng, và quyết định của người dùng khi duyệt spec phần 2 và 3):

- Mục tiêu accessibility WCAG 2.2 mức AA (`architecture.md`; người dùng chốt ngày 2026-09-15, sau khi spec này đã duyệt). Yêu cầu chung nằm ở spec phần 3, mục 12; yêu cầu riêng cho form đăng nhập, đăng ký ở mục 6.
- Backend NestJS 12 (ESM), PostgreSQL + Prisma, Passport + JWT. Chỉ đăng nhập bằng email và mật khẩu; không xác minh email, không có quên mật khẩu, nên không có dịch vụ gửi email.
- Sau khi đăng nhập, bản cloud là bản chính, bản trên trình duyệt là cache. Lần đầu đăng nhập, người dùng được hỏi có đưa schema local lên cloud không. Xung đột được phát hiện theo revision, người dùng chọn giữ bản nào.
- Tài liệu schema lưu dạng JSONB và đi qua `parseSchemaDocument` trước mọi lần ghi. Backend chỉ từ chối tài liệu **sai cấu trúc**; tài liệu còn issue ngữ nghĩa vẫn được lưu, để tự động lưu không làm mất bản đang sửa dở (spec phần 2, mục 8).
- `security.md`: route private mặc định qua guard toàn cục; trả `404` cho tài nguyên người gọi không được thấy; cookie auth phải `HttpOnly`, `Secure`, `SameSite=Lax` trở lên, kèm bảo vệ CSRF; không giữ token trong `localStorage`; rate limit đăng nhập và đăng ký; Helmet; CORS chỉ cho origin đã cấu hình.
- `nestjs.md`, `prisma.md`: cấu trúc module theo feature; DTO với `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`); exception filter toàn cục; dịch lỗi Prisma ở một chỗ; env qua `@nestjs/config` có validate; model có `id`, `createdAt`, `updatedAt`; `onDelete` khai báo rõ; index; list có phân trang; migration đi cùng mọi thay đổi schema Prisma.
- Không có test chạy trên trình duyệt. Test frontend là Vitest trên jsdom.
- Máy dev có Docker Desktop, dùng để chạy PostgreSQL local (mục 10). CI (GitHub Actions) chạy được PostgreSQL bằng service container.

## Tóm tắt quyết định

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | Token | Access token là JWT HS256 sống 15 phút, trong cookie `sf-access`. Refresh token là chuỗi ngẫu nhiên 256 bit sống 30 ngày, trong cookie `sf-refresh` (`Path=/auth`), server chỉ lưu SHA-256 trong bảng `refresh_tokens`; xoay vòng mỗi lần refresh, token đã xoay bị dùng lại thì thu hồi cả họ. Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, không có `Domain` |
| 2 | CSRF | `SameSite=Strict` cộng guard toàn cục kiểm tra header `Origin` nằm trong `CORS_ORIGINS` cho mọi request `POST`, `PUT`, `PATCH`, `DELETE`, kể cả route public |
| 3 | Biết ai đang đăng nhập | `GET /auth/me`. Frontend chỉ gọi khi có cookie gợi ý `sf-auth-hint` (không chứa token), nên khách không bao giờ gọi server |
| 4 | Mật khẩu | argon2id qua `@node-rs/argon2` (binary dựng sẵn, không có script cài đặt), `m=19456 KiB, t=2, p=1`. Chuẩn hóa NFKC; 8 đến 128 ký tự; chặn mật khẩu nằm trong danh sách phổ biến. Đăng nhập sai luôn trả cùng một lỗi `invalid-credentials` |
| 5 | Rate limit | `rate-limiter-flexible` bọc trong guard. Đăng nhập 10 lần/15 phút theo IP + email và 30 lần/15 phút theo IP; đăng ký 5 lần/giờ theo IP; refresh 60 lần/15 phút theo IP. Bộ đếm trong bộ nhớ, chỉ đúng khi chạy một instance |
| 6 | Data model | `User`, `Schema` (JSONB, `revision`), `RefreshToken`. Id UUID, mặc định UUIDv7; `onDelete: Cascade`. Prisma 7.10 với generator `prisma-client` (ESM) và driver adapter `@prisma/adapter-pg`; `prisma generate` là task `generate` của Turborepo |
| 7 | REST API | Auth: `register`, `login`, `refresh`, `logout`, `me`. Schemas: list phân trang theo keyset, get, create với id UUID do client tạo, update toàn phần kèm `expectedRevision` (lệch thì `409`), delete `204`. Body tối đa 2 MiB. Tài liệu sai cấu trúc trả `422` kèm danh sách `{ code, path }`. Mỗi người tối đa 100 schema. Chưa có OpenAPI |
| 8 | Hợp đồng API | Package mới `packages/api-contract`: schema Zod của response, type của request và response, mã lỗi, hằng giới hạn; backend DTO `implements` các type này, frontend parse response bằng các schema này |
| 9 | Frontend auth | API client có kiểu trong `src/lib/api/` (nơi duy nhất gọi `fetch`); auth store trong `src/lib/auth/`; trang `/sign-in`, `/sign-up`; hộp thoại `SignInPrompt` dùng lại cho phần 5, 8; refresh được tuần tự hóa giữa các tab bằng Web Lock |
| 10 | Đồng bộ | Dexie version 2 thêm `ownerId`, `cloudRevision`, `syncStatus` vào `schemas`. Sau mỗi lần lưu local thành công, đẩy cả tài liệu lên cloud, mỗi lúc một request. Offline thì giữ `pending` và thử lại. `409` mở hộp thoại chọn bản trên máy hoặc bản cloud. Sau mỗi lần đăng nhập chủ động, hỏi đưa schema của khách lên |
| 11 | Đăng xuất | Xóa mọi bản cache của tài khoản khỏi trình duyệt, cảnh báo trước nếu còn thay đổi chưa đồng bộ |
| 12 | Header, CORS, CSP | Helmet với CSP `default-src 'none'` cho JSON API; CORS `credentials: true` chỉ cho `CORS_ORIGINS`; CSP frontend thêm origin backend vào `connect-src`. Frontend và backend phải cùng site |
| 13 | PostgreSQL local | Container Docker Postgres 16 sẵn có trên máy dev, database `schemaforge_dev` và `schemaforge_test` trong đó; CI chạy PostgreSQL 16 thật (cùng major). `prisma dev` là phương án thay thế khi máy không có Docker |
| 14 | Test | Unit test Nest với test double; e2e trong `backend/test/` trên PostgreSQL thật, chạy bằng script `test:e2e` riêng và job CI riêng; frontend Vitest trên jsdom với `fake-indexeddb` và `fetch` giả |
| 15 | Triển khai | Không hoãn, không thêm phần 10 vào roadmap. Nơi deploy được chọn trong phần 4, ở một bước sau; spec này ghi các ràng buộc mà phương án đó phải thỏa |

## Phiên bản

Kiểm tra ngày 2026-09-15 bằng `npm view` (phiên bản, dist-tag, `peerDependencies`, `scripts`, `engines`) và tài liệu Prisma 7 qua Context7. NestJS 12.0.1, Zod 4.6.4, Vitest 5.0.0, Node.js 24 lấy từ spec phần 1; Dexie 4.4.6, `fake-indexeddb` 6.2.5 từ spec phần 3.

| Gói | Phiên bản | Tương thích, ghi chú |
|---|---|---|
| `prisma` (dev), `@prisma/client` | 7.10.0 | Phát hành 2026-08-25, dist-tag `prev`. `engines.node` `^20.19 \|\| ^22.12 \|\| >=24.0`; `@prisma/client` peer `prisma: *`, `typescript >=5.4.0`. Dist-tag `latest` đang trỏ tới **8.0.0-rc.15** (bản RC), nên plan phải ghi rõ phiên bản khi cài. `prisma` có script `preinstall`; dependency `@prisma/engines` có `postinstall` (mục 4) |
| `@prisma/adapter-pg` | 7.10.0 | Dependency `pg` ^8.16.3, `@types/pg`; driver adapter bắt buộc với generator `prisma-client` |
| `@nestjs/passport` | 12.0.0 | peer `@nestjs/common ^11 \|\| ^12`, `passport ^0.5 \|\| ^0.6 \|\| ^0.7` |
| `passport`, `passport-jwt` | 0.7.0, 4.0.1 | `passport-jwt` dùng `jsonwebtoken ^9`; `@types/passport-jwt` 4.0.1 |
| `@nestjs/jwt` | 12.0.2 | peer `@nestjs/common` tới `^12`; dùng `jsonwebtoken` 9.0.3 |
| `cookie-parser` | 1.4.7 | `@types/cookie-parser` 1.4.10; middleware Express, dùng được với Express 5.2.1 của `@nestjs/platform-express` 12.0.1 |
| `@node-rs/argon2` | 2.2.1 | Phát hành 2026-09-10. Binary dựng sẵn qua `optionalDependencies` cho macOS, Linux (gnu, musl), Windows; không có script `install` |
| `rate-limiter-flexible` | 11.2.0 | Không có dependency và peer |
| `helmet` | 8.3.0 | `engines.node >=18` |
| `class-validator`, `class-transformer` | 0.15.1, 0.5.1 | Peer bắt buộc của `ValidationPipe` trong `@nestjs/common` 12 (`>=0.13.2`, `>=0.4.1`) |
| `@nestjs/mapped-types` | 12.0.0 | peer `@nestjs/common` tới `^12`, `class-validator ^0.15`; chỉ cài khi có DTO cần `PickType`, `OmitType` |
| `supertest` | 7.2.2 | Chỉ dùng trong e2e; `@types/supertest` 7.2.1 |
| PostgreSQL | 16 | Image `postgres:16-alpine` trong CI, cùng major với container Docker ở local; `prisma dev` là phương án thay thế khi không có Docker (mục 10) |

Gói đã xem xét và không dùng:

| Gói | Lý do |
|---|---|
| `@nestjs/throttler` 6.5.0 | Bản mới nhất (2025-12-02) chỉ khai báo peer tới NestJS 11. Nhánh `master` trên GitHub đã thêm `^12.0.0` nhưng chưa phát hành. Spec phần 1 không dùng plugin không khai báo hỗ trợ major đang dùng (mục 3) |
| `express-rate-limit` 8.7.0 | Middleware Express, nằm ngoài guard và exception filter của Nest (mục 3) |
| `argon2` 0.45.1, `bcrypt` 6.0.0 | Có script `install` (`node-gyp-build`), phải thêm `allowBuilds`; `bcrypt` cắt mật khẩu ở 72 byte (mục 2) |
| `passport-local` 1.0.0 | Đăng nhập chỉ cần DTO và một service method; strategy local không thêm gì ngoài một lớp map body |
| `csrf-csrf` 4.0.3 | Double-submit token không cần thiết khi đã kiểm tra `Origin` (mục 1) |
| `@nestjs/swagger` 12.0.1 | Hỗ trợ NestJS 12, nhưng phần 4 chưa có OpenAPI (mục 5) |
| `@electric-sql/pglite` 0.5.8 chạy trong tiến trình test | Không có cổng TCP, nên e2e không chạy qua `@prisma/adapter-pg` như bản chạy thật (mục 10) |

## 1. Mô hình token và cookie

### Access token và refresh token

| | Access token | Refresh token |
|---|---|---|
| Dạng | JWT HS256, ký bằng `JWT_ACCESS_SECRET` | 32 byte ngẫu nhiên từ `crypto.randomBytes`, mã hóa base64url; không phải JWT |
| Nội dung | `sub` (id người dùng), `iat`, `exp` | Không có; server tra theo hash |
| Thời hạn | 15 phút | 30 ngày tính từ lần cấp gần nhất |
| Lưu ở server | Không | Bảng `refresh_tokens`, chỉ lưu SHA-256 của token (mục 4) |
| Cookie | `sf-access`, `Path=/` | `sf-refresh`, `Path=/auth` |
| Thuộc tính chung | `HttpOnly`, `Secure` (mục 8), `SameSite=Strict`, không có `Domain` (chỉ gửi về đúng host của backend), `Max-Age` bằng thời hạn token | |

- Verify JWT chỉ nhận `algorithms: ['HS256']`. Đồng hồ (`Clock`) và bộ sinh token ngẫu nhiên được inject để test xác định.
- `JwtAuthGuard` là guard toàn cục (Passport strategy `jwt`, extractor đọc cookie `sf-access` qua `cookie-parser`). Route public đánh dấu bằng decorator `@Public()`. Strategy trả `{ userId }` mà không truy vấn database; decorator `@CurrentUser()` đưa giá trị này vào controller.
- `sf-refresh` có `Path=/auth` nên chỉ đi kèm request tới các route auth, không đi kèm mọi request lưu schema.

**Luồng:**

| Sự kiện | Xử lý |
|---|---|
| Đăng ký hoặc đăng nhập thành công | Tạo họ token mới (`familyId` mới), cấp access và refresh, đặt hai cookie |
| `POST /auth/refresh`, token không có, hết hạn hoặc đã thu hồi | `401 session-expired`, xóa hai cookie |
| `POST /auth/refresh`, token đã được xoay trước đó | Coi là token bị lộ: thu hồi mọi token cùng `familyId`, `401 session-expired`, xóa cookie; logger ghi `userId`, `familyId` |
| `POST /auth/refresh`, token hợp lệ | Trong một `$transaction`: đặt `rotatedAt` cho bản ghi cũ với điều kiện `rotatedAt` còn `null` (hai request đồng thời thì chỉ một thắng), tạo bản ghi mới cùng `familyId`, xóa token đã hết hạn của người dùng đó; đặt cookie mới, trả `204` |
| `POST /auth/logout` (public) | Nếu `sf-refresh` hợp lệ thì thu hồi cả họ; luôn xóa hai cookie, trả `204` |

Sau khi đăng xuất, một access token đã bị sao chép ra ngoài vẫn dùng được tối đa 15 phút. Spec chấp nhận điều này để guard không phải truy vấn database ở mỗi request.

Hai tab cùng refresh bằng một token sẽ bị coi là dùng lại token và bị đăng xuất. Frontend tránh bằng Web Lock `schemaforge:auth-refresh` (mục 6).

**Lý do:** access token ngắn hạn không cần tra database ở mỗi request; refresh token lưu phía server nên thu hồi được khi đăng xuất và khi phát hiện dùng lại. Refresh token là chuỗi ngẫu nhiên 256 bit nên băm SHA-256 là đủ (không cần hàm băm chậm như mật khẩu) và tra được bằng index unique. Cả hai nằm trong cookie `HttpOnly`, nên script trên trang (kể cả khi bị XSS) không đọc được token.

**Phương án bị loại:**

- Access token giữ trong bộ nhớ JavaScript, gửi qua header `Authorization`; chỉ refresh token nằm trong cookie: XSS đọc được access token, còn refresh vẫn cần cookie và CSRF, nên không bớt được phần nào.
- Refresh token là JWT không lưu server: không thu hồi được khi đăng xuất hay khi bị lộ.
- Session phía server (`express-session` + bảng session): đi ngược quyết định Passport + JWT đã chốt, và thêm một session store.
- Access token sống 1 giờ trở lên: token bị lộ dùng được lâu hơn, đăng xuất chậm có hiệu lực hơn.
- Tiền tố cookie `__Host-`: bắt buộc `Path=/`, nên refresh token phải đi kèm mọi request. Việc chống subdomain khác ghi đè cookie được giao cho ràng buộc deploy (mục 12: không đặt backend cạnh subdomain không tin cậy).

### CSRF

**Quyết định:** hai lớp.

1. Cookie auth có `SameSite=Strict`: trình duyệt không gửi cookie trong request do site khác khởi phát.
2. `OriginGuard` toàn cục, chạy trước `JwtAuthGuard` và áp cả cho route public như đăng nhập: với `POST`, `PUT`, `PATCH`, `DELETE`, header `Origin` phải có và trùng đúng một origin trong `CORS_ORIGINS`. Thiếu `Origin`, `Origin: null` hoặc origin lạ thì trả `403 origin-not-allowed`.

Backend chỉ đăng ký parser JSON (mục 5), nên form HTML từ site khác không gửi được body mà API đọc được.

**Lý do:** API chỉ nhận JSON từ frontend ở các origin đã biết, và mọi client là trình duyệt. Kiểm tra `Origin` là biện pháp OWASP khuyên cho trường hợp này, không cần token hay state ở hai phía. `SameSite` không chặn được request từ một subdomain khác cùng site (ví dụ `evil.example.com` gọi `api.example.com`); `OriginGuard` chặn được.

**Phương án bị loại:**

- Double-submit token (`csrf-csrf` 4.0.3): frontend và backend khác origin, nên JavaScript của frontend không đọc được cookie do backend đặt; token phải lấy qua một endpoint riêng và giữ trong bộ nhớ. Thêm một request và state mà không chặn thêm trường hợp nào so với kiểm tra `Origin`.
- Chỉ dựa vào `SameSite`: `security.md` yêu cầu thêm bảo vệ CSRF, và không chặn được subdomain cùng site.
- Header tùy biến bắt buộc (`X-Requested-With`): hiệu quả tương đương nhờ preflight, nhưng frontend phải nhớ gửi ở mọi request, còn `Origin` do trình duyệt tự gửi.

### Frontend biết ai đang đăng nhập

- `GET /auth/me` trả `200 { user: { id, email, createdAt } }` hoặc `401 unauthenticated`.
- **Cookie gợi ý `sf-auth-hint`:** cookie của origin frontend, không `HttpOnly`, giá trị `1`, không chứa token hay thông tin người dùng. Frontend ghi sau khi đăng nhập hoặc đăng ký thành công; xóa khi đăng xuất hoặc khi refresh thất bại. Thuộc tính giống `sf-theme` (`Path=/`, `SameSite=Lax`, `Secure` ở production), `Max-Age` 30 ngày khớp refresh token.
- Khi app khởi động:
  - không có hint: trạng thái `signed-out`, không gọi mạng;
  - có hint: gọi `/auth/me`; `401` thì refresh một lần rồi gọi lại; vẫn `401` thì trạng thái `expired` (mục 7) và xóa hint.
- Layout gốc (Server Component) đọc hint để render sẵn đúng khung header: nút "Đăng nhập", hoặc chỗ của menu tài khoản đang tải. Header không nháy.

**Lý do có hint:** ST-01 yêu cầu khách dùng app mà không gọi server. Không có hint thì mỗi lần tải trang, kể cả của khách, đều gọi `/auth/me`, và khách thấy lỗi khi backend không chạy. Hint không phải bằng chứng đăng nhập: server chỉ tin cookie `HttpOnly`; hint sai chỉ tốn một request.

**Phương án bị loại:** luôn gọi `/auth/me` khi tải trang (lý do trên); giữ hint trong `localStorage` (server không đọc được để render header).

## 2. Mật khẩu

### Thuật toán băm

**Quyết định:** argon2id qua `@node-rs/argon2` 2.2.1, với tham số tối thiểu OWASP khuyên: `memoryCost` 19456 KiB (19 MiB), `timeCost` 2, `parallelism` 1. Lưu chuỗi PHC (`$argon2id$v=19$m=19456,t=2,p=1$…`), nên sau này tăng tham số thì hash cũ vẫn verify được.

- Thư viện được bọc trong interface `PasswordHasher` (`hash`, `verify`). Unit test dùng bản giả nhanh; e2e dùng bản thật.
- `hash` và `verify` là async, chạy ngoài event loop.
- **Chống đo thời gian:** khi email không tồn tại, service vẫn gọi `verify` với một hash giả tạo lúc khởi động, để thời gian phản hồi không cho biết email có tồn tại hay không.

**Lý do:** argon2id là lựa chọn đầu tiên của OWASP Password Storage Cheat Sheet. `@node-rs/argon2` phát hành binary dựng sẵn cho từng nền tảng qua `optionalDependencies` và không có script cài đặt, nên không phải thêm vào `allowBuilds` và không cần trình biên dịch trên máy dev, CI hay image deploy.

**Phương án bị loại:**

- `argon2` 0.45.1: cùng thuật toán, nhưng có script `install` (`node-gyp-build`): phải thêm `allowBuilds`, và phải biên dịch trên nền tảng không có prebuild.
- `bcrypt` 6.0.0: có script `install`; cắt mật khẩu ở 72 byte, trong khi chữ tiếng Việt có dấu chiếm 2 đến 3 byte UTF-8; OWASP chỉ khuyên bcrypt cho hệ thống cũ.
- scrypt của `node:crypto`: không cần dependency, nhưng OWASP xếp sau argon2id, và phải tự định dạng chuỗi lưu tham số.

### Quy tắc email và mật khẩu

| Trường | Quy tắc |
|---|---|
| Email | Bỏ khoảng trắng đầu cuối, chuyển toàn bộ sang chữ thường, kiểm tra bằng `@IsEmail()`, tối đa 254 ký tự. Lưu dạng đã chuẩn hóa, unique |
| Mật khẩu | Chuẩn hóa Unicode NFKC trước khi kiểm tra và băm. Từ 8 đến 128 ký tự, đếm theo code point. Không bắt buộc loại ký tự. Không bỏ khoảng trắng. Không được nằm trong danh sách mật khẩu phổ biến (so không phân biệt hoa thường) |

- **NFKC:** bộ gõ tiếng Việt (Telex, VNI qua Unikey hay bộ gõ của hệ điều hành) có thể sinh ký tự dựng sẵn hoặc chữ cái cộng dấu tổ hợp. Không chuẩn hóa thì cùng một mật khẩu gõ trên hai máy có thể ra hai chuỗi byte khác nhau. NIST SP 800-63B cũng khuyên chuẩn hóa Unicode.
- **Danh sách mật khẩu phổ biến:** khoảng 3.000 mật khẩu phổ biến nhất (OWASP ASVS 5.0 cấp 1 yêu cầu kiểm tra ít nhất 3.000), là file dữ liệu trong `backend/src/modules/auth/`, nạp một lần khi khởi động. Plan chọn nguồn có giấy phép phù hợp (ví dụ SecLists, MIT). Chỉ backend kiểm tra; frontend hiện lỗi sau khi gửi.
- Độ dài tối thiểu, tối đa và giới hạn email là hằng trong `packages/api-contract` (mục 5), dùng chung cho decorator DTO của backend và kiểm tra trên form của frontend.

**Độ dài tối thiểu (đã chốt: 8 ký tự).** Theo ASVS 5.0 cấp 1: dữ liệu là thiết kế schema, và đăng nhập đã có rate limit. Phương án chặt hơn là 15 ký tự, theo NIST SP 800-63B bản 4 cho mật khẩu là yếu tố xác thực duy nhất; đổi lựa chọn chỉ là đổi một hằng số.

### Thông báo lỗi và dò tài khoản

| Trường hợp | Response | Frontend hiển thị |
|---|---|---|
| Email không tồn tại, hoặc sai mật khẩu | `401 invalid-credentials`, cùng body, cùng thời gian xử lý | "Email hoặc mật khẩu không đúng" |
| Email hoặc mật khẩu sai định dạng, sai độ dài | `400 validation-failed` kèm danh sách trường | Lỗi dưới từng ô |
| Mật khẩu nằm trong danh sách phổ biến | `400 password-too-common` | "Mật khẩu này quá phổ biến, hãy chọn mật khẩu khác" |
| Đăng ký bằng email đã có | `409 email-already-registered` | "Email đã được đăng ký" kèm link đăng nhập |
| Vượt rate limit | `429 too-many-requests`, header `Retry-After` | "Thử lại sau N phút" |

Đăng ký vẫn cho biết một email đã có tài khoản. Không có dịch vụ gửi email thì không có cách nào khác để báo người dùng rằng họ đã đăng ký. Spec chấp nhận rủi ro này và giảm thiểu bằng rate limit đăng ký theo IP (mục 3).

## 3. Rate limit

### Thư viện

**Quyết định:** `rate-limiter-flexible` 11.2.0, bọc trong `RateLimitGuard` và decorator `@RateLimit(policy)` trên từng handler. Guard gọi `consume(key)` của từng limiter trong chính sách. Khi vượt giới hạn, guard ném `HttpException` 429 với mã `too-many-requests`, để response đi qua exception filter chung, và đặt header `Retry-After` (giây).

**Lý do:** thư viện không có dependency và peer, nên không phụ thuộc major của NestJS. Chạy như một guard nên đúng tầng mà `nestjs.md` dành cho hành vi dùng chung, và dùng chung hình dạng lỗi. Có sẵn store bộ nhớ, Redis và PostgreSQL, nên đổi store sau này không đổi guard. Phần 5 dùng lại guard này với chính sách riêng cho AI.

**Phương án bị loại:**

- `@nestjs/throttler` 6.5.0: bản đã phát hành chỉ khai báo peer tới NestJS 11 (mục Phiên bản). Nếu có bản hỗ trợ NestJS 12 trước khi lập plan, việc đổi sang throttler phải cập nhật spec này.
- `express-rate-limit` 8.7.0: middleware Express, nằm ngoài guard và exception filter, nên phải tự dựng response cho đúng hình dạng lỗi; khóa theo email phụ thuộc thứ tự với body parser.
- Tự viết bộ đếm: phải tự xử lý cửa sổ thời gian, dọn khóa hết hạn và store dùng chung khi có nhiều instance.

### Chính sách

| Route | Khóa | Giới hạn |
|---|---|---|
| `POST /auth/login` | IP + email đã chuẩn hóa | 10 request / 15 phút |
| `POST /auth/login` | IP | 30 request / 15 phút |
| `POST /auth/register` | IP | 5 request / 1 giờ |
| `POST /auth/refresh` | IP | 60 request / 15 phút |

- Mọi request đều bị tính, kể cả khi thành công. Không phải reset bộ đếm, và con số đủ rộng cho người gõ nhầm vài lần. Khóa theo IP + email chặn thử mật khẩu vào một tài khoản; khóa theo IP chặn thử nhiều tài khoản từ một nơi. Không khóa theo email riêng, để kẻ tấn công không khóa được tài khoản của người khác.
- Con số là hằng trong `rate-limit-policies.ts`, không phải biến môi trường. e2e kiểm tra `429` với đúng chính sách thật.
- IP lấy từ `request.ip`. Express `trust proxy` đặt theo `TRUST_PROXY_HOPS` (mục 9), để IP đúng khi chạy sau reverse proxy; mặc định `0`, không tin header `X-Forwarded-For`.
- Khóa được băm SHA-256 trước khi đưa vào store, để email không nằm trong bộ nhớ hay store dưới dạng rõ.

### Nơi lưu bộ đếm

**Đề xuất:** `RateLimiterMemory`, bộ đếm nằm trong tiến trình.

- Chỉ đúng khi backend chạy **một instance**. Chạy N instance thì giới hạn thực tế thành N lần; khởi động lại thì bộ đếm về 0.
- Khi deploy nhiều instance: đổi sang store PostgreSQL có sẵn trong thư viện (không thêm dịch vụ), hoặc Redis nếu khi đó đã có Redis. Chỉ đổi phần tạo limiter trong `RateLimitModule`.

**Phương án khác:** Redis ngay từ đầu (máy dev đã có container `local_redis`). Đúng với mọi số instance, nhưng thêm một dịch vụ phải cấu hình ở CI và deploy, trong khi phần 4 chưa deploy và mới có một instance; đổi sang Redis khi cần nhiều instance chỉ sửa phần tạo limiter trong `RateLimitModule`.

## 4. Data model Prisma

### Schema Prisma

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql" // URL nằm trong prisma.config.ts theo Prisma 7
}

model User {
  id            String         @id @default(uuid(7)) @db.Uuid
  email         String         @unique @db.VarChar(254)
  passwordHash  String         @map("password_hash")
  createdAt     DateTime       @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime       @updatedAt @map("updated_at") @db.Timestamptz(3)
  schemas       Schema[]
  refreshTokens RefreshToken[]

  @@map("users")
}

model Schema {
  id        String   @id @default(uuid(7)) @db.Uuid
  ownerId   String   @map("owner_id") @db.Uuid
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  name      String
  document  Json     @db.JsonB
  revision  Int      @default(1)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([ownerId, updatedAt(sort: Desc), id(sort: Desc)])
  @@map("schemas")
}

model RefreshToken {
  id        String    @id @default(uuid(7)) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  familyId  String    @map("family_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamptz(3)
  rotatedAt DateTime? @map("rotated_at") @db.Timestamptz(3)
  revokedAt DateTime? @map("revoked_at") @db.Timestamptz(3)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  @@index([userId, expiresAt])
  @@index([familyId])
  @@map("refresh_tokens")
}
```

| Điểm | Quyết định | Lý do |
|---|---|---|
| Id | UUID cho mọi model, cột kiểu `uuid`. Mặc định UUIDv7 do Prisma Client sinh. Id của `Schema` thường do client gửi lên (UUID do `crypto.randomUUID()` sinh ở phần 3) | Một chiến lược id (UUID) như `prisma.md` yêu cầu, chỉ khác nơi sinh. UUIDv7 tăng theo thời gian nên index B-tree ít phân mảnh. Id từ client giữ nguyên URL `/schemas/[schemaId]` sau khi đưa lên cloud và cho `POST` idempotent (mục 5, 7) |
| `Schema.name` | Bản sao của `document.name`, ghi trong cùng câu lệnh với `document`. Không giới hạn độ dài ở database | Danh sách không phải đọc JSONB. Tên dài quá 63 byte là issue ngữ nghĩa (spec phần 2), vẫn được lưu; body đã bị giới hạn 2 MiB |
| `Schema.document` | JSONB, luôn là kết quả của `parseSchemaDocument` (đã migrate lên version hiện tại) | Truy vấn danh sách không `select` cột này |
| `Schema.revision` | Bắt đầu 1, tăng 1 mỗi lần cập nhật thành công | Phát hiện xung đột (mục 5) |
| Index | `schemas (owner_id, updated_at desc, id desc)` phục vụ danh sách theo keyset và khóa ngoại; `users.email` và `refresh_tokens.token_hash` unique; `refresh_tokens (user_id, expires_at)` cho dọn token hết hạn; `refresh_tokens (family_id)` cho thu hồi cả họ | Index mọi khóa ngoại và cột trong `where`, `orderBy` thường dùng |
| `onDelete` | `Cascade` cho `Schema.owner` và `RefreshToken.user` | Schema và token không còn ý nghĩa khi không có chủ. Phần 4 chưa có chức năng xóa tài khoản, nhưng `prisma.md` yêu cầu khai báo rõ |
| Xóa mềm | Không có `deletedAt` | ST-04 chỉ yêu cầu xóa. Phần 8 (lịch sử phiên bản) tự quyết định có cần giữ bản đã xóa không |
| Dọn refresh token | Mỗi lần đăng nhập và refresh, xóa token đã hết hạn của chính người dùng đó trong cùng transaction | Không cần job định kỳ ở phần 4 |
| Thời gian | `timestamptz(3)` | Không lệch múi giờ; milli giây đủ cho sắp xếp và khớp `Date` của JavaScript |

Password hash chỉ được `select` trong một phương thức của repository dùng khi đăng nhập; mọi truy vấn khác trên `User` chọn `id`, `email`, `createdAt`.

### Cập nhật có điều kiện theo revision

```ts
const updated = await this.prisma.schema.updateManyAndReturn({
  where: { id, ownerId, revision: expectedRevision },
  data: { document, name: document.name, revision: { increment: 1 } },
  select: SCHEMA_SUMMARY_SELECT,
});
// updated rỗng: tra { id, ownerId } -> không có thì 404, có thì 409 kèm revision hiện tại
```

- `updateManyAndReturn` (Prisma hỗ trợ trên PostgreSQL) sinh một câu `UPDATE … RETURNING` có điều kiện, nên hai request đồng thời cùng `expectedRevision` chỉ một câu thành công, không cần khóa hay transaction `serializable`, và response lấy đúng hàng vừa ghi.
- Lookup sau khi không cập nhật được chỉ để chọn giữa `404` và `409`; điều kiện `ownerId` nằm trong cả hai truy vấn, nên schema của người khác luôn ra `404`.

**Phương án bị loại:** `update` với `where` mở rộng rồi bắt lỗi `P2025` trong service: vi phạm quy tắc dịch lỗi Prisma ở một chỗ. `updateMany` rồi đọc lại: giữa hai câu, request khác có thể ghi thêm một revision, response trả sai revision.

### Migration

- Mỗi thay đổi `schema.prisma` đi cùng một migration từ `prisma migrate dev --name <snake_case>`. Migration đầu tiên: `init_auth_and_schemas`.
- CI (job e2e) và deploy dùng `prisma migrate deploy`.
- `migrate dev` cần shadow database: `prisma.config.ts` đọc `SHADOW_DATABASE_URL` nếu có. Local dùng thêm database `schemaforge_shadow` trong cùng container Docker (mục 10); `prisma dev` tự in giá trị này khi dùng phương án thay thế. Biến này chỉ CLI dùng, không nằm trong schema env của Nest.

### `prisma generate` trong pipeline

- **`backend/prisma.config.ts`:** Prisma 7 đọc URL từ file cấu hình thay vì `schema.prisma`, và không tự nạp `.env`. File cấu hình nạp `backend/.env` bằng `process.loadEnvFile()` khi file tồn tại (có sẵn trong Node 24, không thêm `dotenv`), rồi đặt `datasource.url` là `DATABASE_URL`.
- **Output:** client sinh ra ở `backend/src/generated/prisma/` (thêm vào `.gitignore`). Đây là TypeScript thuần, `nest build` biên dịch cùng code; `moduleFormat = "esm"` và `importFileExtension = "js"` hợp với `module: nodenext` của backend. ESLint bỏ qua thư mục này; coverage không tính.
- **Turborepo:** backend có script `generate: prisma generate`. `turbo.json` thêm task `generate` (`inputs`: `prisma/schema.prisma`, `prisma.config.ts`; `outputs`: `src/generated/**`). Các task `build`, `typecheck`, `lint`, `test`, `test:e2e`, `dev` thêm `generate` vào `dependsOn` (cùng package). Package không có script `generate` thì Turborepo bỏ qua. Lint có type cũng cần client đã sinh, nên `lint` phụ thuộc `generate`, không chỉ `build` và `typecheck` như spec phần 1 dự kiến.
- `prisma generate` không kết nối database. Plan xác nhận `generate` chạy được khi không có `DATABASE_URL` (job `verify` của CI không có database); nếu không thì config dùng giá trị rỗng khi biến không có.
- **`PrismaService`** nằm trong `PrismaModule`, `extends PrismaClient`, nhận `DATABASE_URL` qua `ConfigService` (không đọc `process.env`), truyền adapter `new PrismaPg({ connectionString })`, và `$disconnect` trong `onModuleDestroy`.

### `allowBuilds`

Thêm vào `pnpm-workspace.yaml`:

| Gói | Giá trị | Vì sao |
|---|---|---|
| `@prisma/engines` | `true` | Script `postinstall` tải schema engine mà `migrate` dùng |
| `prisma` | `true` | Script `preinstall` kiểm tra phiên bản Node |

`@node-rs/argon2` không có script cài đặt nên không cần khai báo. Plan xác nhận `pnpm install --frozen-lockfile` từ bản clone sạch không còn cảnh báo build script bị chặn (tiêu chí của spec phần 1), kể cả với dependency lồng như `@prisma/dev`.

## 5. REST API

### Endpoint

| Method, path | Public | Rate limit | Input | Thành công | Lỗi dự kiến |
|---|---|---|---|---|---|
| `GET /health` | Có | — | — | `200 { status: "ok" }` | — |
| `POST /auth/register` | Có | Có | `RegisterDto { email, password }` | `201 { user }`, đặt cookie | `400 validation-failed`, `400 password-too-common`, `409 email-already-registered`, `429` |
| `POST /auth/login` | Có | Có | `LoginDto { email, password }` | `200 { user }`, đặt cookie | `400 validation-failed`, `401 invalid-credentials`, `429` |
| `POST /auth/refresh` | Có | Có | cookie `sf-refresh` | `204`, đặt cookie mới | `401 session-expired`, `429` |
| `POST /auth/logout` | Có | — | cookie `sf-refresh` | `204`, xóa cookie | — |
| `GET /auth/me` | Không | — | — | `200 { user }` | `401 unauthenticated` |
| `GET /schemas` | Không | — | `ListSchemasQueryDto { limit?, cursor? }` | `200 { items, nextCursor }` | `400 validation-failed` |
| `GET /schemas/:id` | Không | — | `id` qua `ParseUUIDPipe` | `200 SchemaDetail` | `404 not-found` |
| `POST /schemas` | Không | — | `CreateSchemaDto { id, document }` | `201 SchemaSummary` (`revision` 1) | `400`, `403 schema-limit-reached`, `409 schema-id-unavailable`, `413`, `422 document-invalid` |
| `PUT /schemas/:id` | Không | — | `UpdateSchemaDto { document, expectedRevision }` | `200 SchemaSummary` | `400`, `404`, `409 revision-conflict`, `413`, `422 document-invalid` |
| `DELETE /schemas/:id` | Không | — | `id` qua `ParseUUIDPipe` | `204` | `404 not-found` |

- Mọi route private trả `401 unauthenticated` khi thiếu hoặc sai access token; mọi request `POST`, `PUT`, `PATCH`, `DELETE` có thể nhận `403 origin-not-allowed` (mục 1).
- Chỉ năm route trên có `@Public()`. e2e kiểm tra tập route public đúng bằng danh sách này (mục 11), nên route mới mặc định là private.
- Không có tiền tố `/api` (backend có origin riêng) và không có tiền tố version: client duy nhất là frontend, deploy cùng nhau. Thêm khi có API công khai.
- `PUT` thay toàn bộ tài liệu. Đổi tên schema là `PUT` với tài liệu đã áp `renameSchema`, không có endpoint riêng.

### DTO và response

- Request DTO là class có decorator của class-validator và `implements` type request tương ứng trong `packages/api-contract` (bên dưới), nên DTO lệch hợp đồng là lỗi biên dịch.
  - `email`: `@IsEmail()`, `@MaxLength(EMAIL_MAX_LENGTH)`; chuẩn hóa bằng `@Transform`. `password`: `@IsString()`, `@MinLength`, `@MaxLength` theo hằng của hợp đồng (độ dài đo lại sau NFKC trong service).
  - `id`: `@IsUUID()`. `document`: chỉ `@IsObject()`; cấu trúc tài liệu do core kiểm tra. `expectedRevision`: `@IsInt()`, `@Min(1)`.
  - `limit`: `@IsInt()`, `@Min(1)`, `@Max(SCHEMA_LIST_MAX_LIMIT)`, mặc định 50. `cursor`: `@IsString()`, `@MaxLength(200)`.
  - `UpdateSchemaDto` là class riêng, không dựng bằng `PartialType`, vì cả hai trường đều bắt buộc (mục [Vấn đề với các spec đã duyệt](#vấn-đề-với-các-spec-đã-duyệt)).
- Response được dựng bằng hàm thuần trong `users.mapper.ts` (`toUserResponse`) và `schemas.mapper.ts` (`toSchemaSummary`, `toSchemaDetail`); thời gian là chuỗi ISO 8601. Controller không bao giờ trả model Prisma. Hằng `select` của repository và kiểu input của mapper suy ra từ nhau.

```ts
// packages/api-contract, phác thảo
export const userResponseSchema = z.object({ id: z.uuid(), email: z.string(), createdAt: z.iso.datetime() });
export const schemaSummarySchema = z.object({
  id: z.uuid(), name: z.string(), revision: z.int().positive(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
});
export const schemaDetailSchema = schemaSummarySchema.extend({ document: z.unknown() });
export const schemaListSchema = z.object({ items: z.array(schemaSummarySchema), nextCursor: z.string().nullable() });

export type SchemaSummary = z.infer<typeof schemaSummarySchema>;
export type CreateSchemaRequest = { readonly id: string; readonly document: unknown };
export type UpdateSchemaRequest = { readonly document: unknown; readonly expectedRevision: number };
```

Schema response dùng `z.object` (bỏ trường lạ) thay vì `z.strictObject`, để backend thêm trường mới không làm frontend cũ báo lỗi. `document` là `unknown` trên đường truyền; frontend luôn đưa qua `parseSchemaDocument`.

### Hình dạng lỗi

```ts
type ApiErrorBody =
  | { readonly statusCode: 400; readonly code: 'validation-failed'; readonly fields: readonly FieldError[] }
  | { readonly statusCode: 409; readonly code: 'revision-conflict'; readonly currentRevision: number }
  | { readonly statusCode: 422; readonly code: 'document-invalid'; readonly documentErrors: readonly StructuralError[] }
  | { readonly statusCode: number; readonly code: SimpleApiErrorCode };

type FieldError = { readonly path: string; readonly constraint: string }; // ví dụ { path: 'email', constraint: 'isEmail' }
```

| Mã | Status | Khi nào |
|---|---|---|
| `validation-failed` | 400 | DTO sai, JSON hỏng, cursor không giải mã được |
| `password-too-common` | 400 | Mục 2 |
| `unauthenticated` | 401 | Thiếu, sai hoặc hết hạn access token |
| `invalid-credentials` | 401 | Mục 2 |
| `session-expired` | 401 | Refresh thất bại |
| `origin-not-allowed` | 403 | Mục 1 |
| `schema-limit-reached` | 403 | Vượt `MAX_SCHEMAS_PER_USER` |
| `not-found` | 404 | Route không có; schema không có hoặc không thuộc người gọi |
| `email-already-registered` | 409 | Mục 2 |
| `schema-id-unavailable` | 409 | `POST /schemas` với id đã có |
| `revision-conflict` | 409 | `expectedRevision` khác revision hiện tại |
| `payload-too-large` | 413 | Body quá `MAX_REQUEST_BODY_BYTES` |
| `document-invalid` | 422 | `parseSchemaDocument` trả lỗi |
| `too-many-requests` | 429 | Mục 3 |
| `internal-error` | 500 | Lỗi không dự kiến |

- Không có trường `message`: thông báo cho người dùng đi qua i18n (namespace `apiErrors`, mục 6), còn thông tin cho developer nằm trong log.
- **`ApiExceptionFilter`** là filter toàn cục duy nhất (đăng ký bằng `APP_FILTER`):
  - `ApiException` (lớp con của `HttpException`, mang `code` và dữ liệu thêm): trả nguyên.
  - `HttpException` có sẵn của Nest: ánh xạ theo status (404 → `not-found`, 413 → `payload-too-large`). `ValidationPipe` dùng `exceptionFactory` để dựng `fields` từ `ValidationError[]`.
  - Lỗi của body parser: `entity.too.large` → 413; `entity.parse.failed` → 400 `validation-failed` với `fields` rỗng.
  - `PrismaClientKnownRequestError`: `P2002` → 409 với mã lấy từ một bảng duy nhất theo model và trường (`User.email` → `email-already-registered`, `Schema.id` → `schema-id-unavailable`); `P2025` → 404; mã khác → 500.
  - Mọi lỗi còn lại → `500 internal-error`. Logger ghi tên lỗi, route, id người dùng; response không bao giờ có stack, SQL hay lỗi Prisma.

### Body và kích thước tài liệu

- `NestFactory.create(AppModule, { bodyParser: false })`, rồi chỉ bật parser JSON: `app.useBodyParser('json', { limit: MAX_REQUEST_BODY_BYTES })`. Không có parser `urlencoded` hay `raw`.
- `MAX_REQUEST_BODY_BYTES` = 2 MiB, là hằng trong `packages/api-contract`. Giới hạn áp trước khi parse JSON, như `security.md` yêu cầu; vì tài liệu chiếm gần hết body nên đây cũng là giới hạn kích thước tài liệu. Frontend đo kích thước tài liệu đã serialize trước khi gửi và không gửi khi vượt (mục 7).
- **Lý do chọn 2 MiB:** fixture chuẩn của spec phần 3 (100 bảng, 1.500 cột, 150 quan hệ) khoảng vài trăm KB, nên 2 MiB cho dư khoảng bốn lần mà vẫn giữ việc parse JSON và `parseSchemaDocument` ở mức vài chục mili giây.
- **Phương án bị loại:** giới hạn riêng lớn hơn cho route schema bằng middleware theo route: body của route auth vốn rất nhỏ, một giới hạn chung đơn giản hơn.

### Validate tài liệu

1. `POST` và `PUT` gọi `parseSchemaDocument(dto.document)`.
2. Lỗi: `422 document-invalid`, `documentErrors` là tối đa 100 lỗi đầu tiên theo thứ tự core trả về, để response không phình theo tài liệu hỏng.
3. Thành công: lưu tài liệu đã parse (đã migrate lên version hiện tại) cùng `name`. Không gọi `validateSchema`: issue ngữ nghĩa không chặn lưu.
4. `GET /schemas/:id` cũng parse tài liệu đọc từ database (spec phần 2, mục 11) và trả bản đã migrate. Nếu parse thất bại, trường hợp chỉ xảy ra khi database chứa tài liệu của một core mới hơn (ví dụ backend bị rollback), trả `500 internal-error` và log `schemaId` cùng các mã lỗi, không bao giờ trả tài liệu chưa parse.

Frontend mới hơn backend (gửi tài liệu version cao hơn) nhận `422` với lỗi `version-unsupported`. Frontend hiện "Máy chủ chưa hỗ trợ phiên bản dữ liệu này" và giữ thay đổi ở trạng thái chưa đồng bộ (mục 7). Vì vậy khi deploy, backend lên phiên bản mới trước frontend (mục 12).

### Danh sách: phân trang theo keyset

- Sắp theo `updatedAt` giảm dần rồi `id` giảm dần, giống danh sách local của phần 3.
- `cursor` là base64url của `{ updatedAt, id }` của phần tử cuối trang trước; backend giải mã và kiểm tra bằng Zod, sai thì `400`. Truy vấn lấy `limit + 1` hàng để biết còn trang sau không; `nextCursor` là `null` ở trang cuối.
- Response không có `document`.
- Frontend gọi với `limit` 100 và đi theo `nextCursor` tới hết, gộp theo `id`. Schema được sửa trong lúc đang phân trang có thể xuất hiện hai lần hoặc bị bỏ qua tới lần tải sau; với giới hạn 100 schema, một trang thường là đủ.

**Phương án bị loại:** phân trang theo offset: autosave đổi `updatedAt` cũng làm lệch trang, và database phải quét qua mọi hàng trước offset. Không phân trang: trái `nestjs.md` và `prisma.md`.

### Id do client tạo

- `POST /schemas` nhận `id` UUID do client sinh. Id đã tồn tại, của bất kỳ ai, thì trả `409 schema-id-unavailable`. Trả cùng một mã dù người gọi hay người khác sở hữu id đó: người gọi đã giữ UUID ngẫu nhiên 122 bit nên không học được gì mới. Frontend phân biệt hai trường hợp bằng `GET /schemas/:id` (`200` là của mình, `404` là của người khác), xem mục 7.
- **Lý do:** gửi lại `POST` sau khi mất response không tạo bản trùng; URL của schema không đổi khi đưa từ local lên cloud.
- **Phương án bị loại:** `PUT /schemas/:id` kiêm tạo mới (upsert): trộn hai ngữ nghĩa, và không rõ phải làm gì khi schema chưa tồn tại mà request có `expectedRevision`. Id do server sinh: xem mục 7.

### Giới hạn số schema mỗi người

**Đề xuất:** `MAX_SCHEMAS_PER_USER` = 100. `POST /schemas` đếm và chèn trong một `$transaction`; vượt thì `403 schema-limit-reached`. Hai request đồng thời có thể vượt giới hạn một chút; spec chấp nhận vì đây là giới hạn mềm.

**Lý do:** mỗi schema tối đa 2 MiB, nên giới hạn giữ dung lượng mỗi tài khoản dưới khoảng 200 MiB; không có giới hạn thì một tài khoản làm đầy được database.

**Phương án khác:** không giới hạn (đơn giản nhất, chấp nhận rủi ro lạm dụng dung lượng); giới hạn tổng dung lượng theo byte (công bằng hơn với schema lớn, nhưng phải cộng dồn kích thước ở mỗi lần ghi).

### OpenAPI

**Quyết định:** phần 4 chưa sinh tài liệu OpenAPI.

**Lý do:** client duy nhất là frontend, đã có hợp đồng có kiểu qua `packages/api-contract`. `@nestjs/swagger` 12.0.1 hỗ trợ NestJS 12, nhưng cần decorator `@ApiProperty` (hoặc CLI plugin) trên mọi DTO và một route tài liệu phải quyết định có public hay không. Cân nhắc lại khi có client khác frontend.

### Hợp đồng API: `packages/api-contract`

**Quyết định:** thêm workspace package `@schemaforge/api-contract`, không phụ thuộc framework:

- Schema Zod của mọi response và type suy ra; type của mọi request.
- `API_ERROR_CODES` (và `ApiErrorBody`).
- Hằng: `EMAIL_MAX_LENGTH`, `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, `MAX_REQUEST_BODY_BYTES`, `SCHEMA_LIST_MAX_LIMIT`, `MAX_SCHEMAS_PER_USER`.
- Dependency: `zod` (catalog) và `@schemaforge/core` (chỉ để lấy type `StructuralError`). Build, tsconfig và ngưỡng coverage 90% giống `packages/core` (spec phần 1).

Backend: DTO `implements` type request, mapper trả type response. Frontend: API client parse mọi response bằng schema tương ứng; `apiErrors` có `satisfies Record<ApiErrorCode, string>`, nên thêm mã lỗi mà chưa dịch thì frontend không biên dịch được.

**Lý do:** một nguồn cho mỗi type (`typescript.md`) mà không cần bước sinh code; frontend kiểm tra dữ liệu ở biên (`code-quality.md`).

**Phương án bị loại:**

- Sinh OpenAPI bằng `@nestjs/swagger` rồi sinh type bằng `openapi-typescript`: thêm decorator trên mọi DTO, một bước khởi động app để xuất spec, và một bước CI kiểm tra file sinh ra không lệch. Quá nặng cho 11 endpoint.
- Đặt vào `packages/core`: core là schema model, validation, operation, generator, importer (`architecture.md`); hợp đồng giữa frontend và backend không thuộc phạm vi đó.
- Khai báo type ở cả hai phía: lệch chỉ lộ ra khi kiểm tra tay.

## 6. Frontend: API client và trạng thái đăng nhập

### API client (`src/lib/api/`)

```ts
type ApiFailure =
  | { readonly kind: 'http'; readonly status: number; readonly body: ApiErrorBody }
  | { readonly kind: 'network' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'invalid-response' };

type ApiClient = {
  readonly auth: {
    readonly register: (input: RegisterRequest) => Promise<Result<UserResponse, ApiFailure>>;
    readonly login: (input: LoginRequest) => Promise<Result<UserResponse, ApiFailure>>;
    readonly logout: () => Promise<Result<void, ApiFailure>>;
    readonly me: () => Promise<Result<UserResponse, ApiFailure>>;
  };
  readonly schemas: {
    readonly list: (query: ListSchemasQuery) => Promise<Result<SchemaList, ApiFailure>>;
    readonly get: (id: string) => Promise<Result<SchemaDetail, ApiFailure>>;
    readonly create: (input: CreateSchemaRequest) => Promise<Result<SchemaSummary, ApiFailure>>;
    readonly update: (id: string, input: UpdateSchemaRequest) => Promise<Result<SchemaSummary, ApiFailure>>;
    readonly remove: (id: string) => Promise<Result<void, ApiFailure>>;
  };
};

function createApiClient(input: {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
  readonly sessionRefresher: SessionRefresher;
  readonly onSessionExpired: () => void;
}): ApiClient;
```

- `api-client.ts` là file duy nhất gọi `fetch`: rule lint cấm gọi mạng của phần 3 có ngoại lệ cho `src/lib/api/**`. Component và feature không dựng URL.
- Mọi request: `credentials: 'include'`, `cache: 'no-store'`, `Accept: application/json`; có body thì thêm `Content-Type: application/json`. `signal` gộp signal của nơi gọi với `AbortSignal.timeout(REQUEST_TIMEOUT_MS)` (15 giây) qua `AbortSignal.any`.
- Lỗi dự kiến không throw mà trả `ApiFailure`: `fetch` reject là `network`, hết giờ là `timeout`. Body không khớp schema của hợp đồng là `invalid-response`; logger ghi route và status, không ghi body.
- Route không thuộc `/auth/*` trả `401 unauthenticated` thì client gọi `sessionRefresher.refresh()`; thành công thì gửi lại request đúng một lần; thất bại thì gọi `onSessionExpired()` và trả failure `401`.
- `AppProviders` tạo client một lần từ `src/lib/env.ts` và đưa vào context (`useApiClient()`); code không phải component (đồng bộ, mục 7) nhận instance qua tham số, giống store của editor. `Result` là type của core.

### Tuần tự hóa refresh (`session-refresher.ts`)

- Trong một tab: các lời gọi đồng thời dùng chung một promise đang chạy.
- Giữa các tab: refresh chạy trong Web Lock `schemaforge:auth-refresh` (exclusive). Trong khóa, gọi `GET /auth/me` trước: `200` nghĩa là tab khác vừa refresh xong (cookie dùng chung giữa các tab), không làm gì thêm; `401` thì mới `POST /auth/refresh`.
- Khóa đi qua interface `AuthLockManager`, test dùng bản giả, giống `SchemaLockManager` của phần 3.
- Quy tắc: code đang giữ khóa auth không bao giờ xin khóa schema. Editor giữ khóa schema trong lúc đẩy lên cloud và có thể phải chờ khóa auth, nên thứ tự luôn là schema rồi auth, không có deadlock.

**Phương án bị loại:** backend chấp nhận token vừa xoay thêm vài giây: làm yếu việc phát hiện dùng lại token, và frontend vẫn phải xử lý race nằm ngoài khoảng đó.

### Auth store (`src/lib/auth/`)

```ts
type SessionUser = { readonly id: string; readonly email: string };

type AuthState =
  | { readonly status: 'unknown' }
  | { readonly status: 'signed-out' }
  | { readonly status: 'signed-in'; readonly user: SessionUser }
  | { readonly status: 'expired'; readonly lastUser: SessionUser | null };

type AuthActions = {
  readonly initialize: () => Promise<void>;
  readonly signIn: (input: LoginRequest) => Promise<Result<void, ApiFailure>>;
  readonly signUp: (input: RegisterRequest) => Promise<Result<void, ApiFailure>>;
  readonly signOut: () => Promise<Result<void, SignOutFailure>>; // mục 7
  readonly markSessionExpired: () => void;
};
```

- Store tạo bằng `zustand/vanilla` trong `AuthProvider` (`src/components/auth-provider.tsx`), đọc qua `useAuth(selector)`.
- `initialize` theo mục 1: không có `sf-auth-hint` thì `signed-out` mà không gọi mạng.
- Đăng nhập hoặc đăng ký thành công: ghi `sf-auth-hint`, ghi bản ghi `session` trong Dexie (mục 7), phát `signed-in` trên `BroadcastChannel` `schemaforge:auth`, rồi mở hộp thoại đưa schema của khách lên (mục 7).
- Tab khác nhận `signed-in` thì chạy `initialize`; nhận `signed-out` thì dừng đồng bộ, rời editor của schema thuộc tài khoản, chuyển `signed-out`.
- `expired.lastUser` đọc từ bản ghi `session`, để danh sách vẫn hiện cache của tài khoản đó và form đăng nhập điền sẵn email.

### Màn hình đăng nhập, đăng ký

| Route | File |
|---|---|
| `/sign-in` | `app/(auth)/sign-in/page.tsx` → `features/auth/components/sign-in-screen.tsx` |
| `/sign-up` | `app/(auth)/sign-up/page.tsx` → `features/auth/components/sign-up-screen.tsx` |

- Route là Server Component mỏng: `await searchParams`, lấy `returnTo`, `generateMetadata` dịch tiêu đề. Form là client component gọi API client; không có Server Action hay Route Handler.
- Form có `<label>` cho mọi ô: email (`type="email"`, `autoComplete="email"`), mật khẩu (`type="password"`, `autoComplete="current-password"` hoặc `"new-password"`), nút hiện/ẩn mật khẩu có `aria-label` đã dịch và `aria-pressed`. Kiểm tra phía client theo hằng của hợp đồng; lỗi hiện dưới từng ô với `aria-invalid`, `aria-describedby`; lỗi từ server hiện trong vùng `role="alert"`. Nút gửi bị disable khi đang gửi.
- **WCAG 2.2 AA cho form** (mục tiêu chung ở [spec phần 3](2026-09-14-editor-mvp-design.md), mục 12):
  - 3.3.8 Accessible Authentication (Minimum): nhớ mật khẩu là bài kiểm tra nhận thức, nên form phải để trình quản lý mật khẩu và thao tác dán hỗ trợ người dùng. Không chặn dán hay sao chép ở ô email và mật khẩu (không `preventDefault` trên `paste`, `copy`); không đặt `autoComplete="off"` và không đổi `name`, `id` của ô theo từng lần render; `autoComplete` là `email` và `current-password` ở `/sign-in`, `email` và `new-password` ở `/sign-up`. Không có CAPTCHA hay câu đố; chống dò mật khẩu bằng rate limit (mục 3).
  - 3.3.7 Redundant Entry: `/sign-up` chỉ có một ô mật khẩu, không có ô nhập lại mật khẩu; người dùng kiểm tra điều đã gõ bằng nút hiện/ẩn. Tiêu chí cho phép ô nhập lại mật khẩu vì lý do bảo mật, nhưng spec không dùng. Lỗi từ server (ví dụ `invalid-credentials`, `429`) không xóa giá trị đã nhập ở cả hai ô. Form đăng nhập khi phiên hết hạn điền sẵn email từ `expired.lastUser`.
  - 2.5.8 Target Size (Minimum): nút hiện/ẩn mật khẩu tối thiểu 24×24 CSS px.
- Trang đăng nhập ghi rõ chưa có chức năng khôi phục mật khẩu; trang đăng ký ghi dùng được ngay, không cần xác minh email.
- Thành công thì `router.replace(returnTo)`. Người đã đăng nhập mở hai trang này thì được chuyển về `/`.
- `sanitizeReturnTo(value)` là hàm thuần: chỉ nhận chuỗi bắt đầu bằng `/`, không bắt đầu bằng `//`, không chứa `\`, và khi resolve với một origin giả thì origin không đổi; mọi giá trị khác thành `/`. Chặn open redirect.

### Header và lời mời đăng nhập

- `AccountMenu` (`src/components/account-menu.tsx`) nằm trên header của danh sách và editor:

| Trạng thái | Hiển thị |
|---|---|
| `unknown` | Khung giữ chỗ cùng kích thước, không có chữ |
| `signed-out` | Link "Đăng nhập" |
| `signed-in` | Nút có email, menu gồm "Đăng xuất" |
| `expired` | Nút "Đăng nhập lại" có icon cảnh báo |

- `SignInPrompt` (`src/components/sign-in-prompt.tsx`) cùng hook `useSignInPrompt()` trả hàm `requireSignIn(reason)`: đã đăng nhập thì trả `true`; chưa thì mở hộp thoại "Tính năng này cần tài khoản" với mô tả theo `reason`, các nút "Đăng nhập", "Tạo tài khoản" (link kèm `returnTo` là URL hiện tại) và "Để sau", rồi trả `false`.
- `reason` là union mở rộng dần: phần 4 có `cloudSave` và `cloudSchema`; phần 5 thêm `ai`, phần 8 thêm `share` và `versionHistory`.
- Nơi dùng trong phần 4: nút "Lưu lên cloud" trên toolbar editor và trên dòng schema của khách (`cloudSave`); trạng thái "Không tìm thấy schema" khi chưa đăng nhập có thêm link đăng nhập, vì schema có thể nằm trên cloud (`cloudSchema`).

### i18n

| Namespace | Nội dung |
|---|---|
| `auth` | Màn hình đăng nhập, đăng ký, `AccountMenu`, `SignInPrompt` |
| `sync` | Trạng thái đồng bộ, hộp thoại đưa schema lên, xung đột, schema bị xóa trên cloud, đăng xuất |
| `apiErrors` | Một key cho mỗi `ApiErrorCode`, cộng `network`, `timeout`, `invalid-response` |

Theo quy tắc của phần 3: resource TypeScript có kiểu, `vi` phải khớp `en` khi biên dịch; `apiErrors` thêm `satisfies Record<ApiErrorCode, string>`.

## 7. Frontend: đồng bộ local và cloud

### Nguyên tắc

- Khi đã đăng nhập, mỗi schema của tài khoản có một bản cache trong Dexie. Editor vẫn sửa bản cache qua `dispatch` và autosave của phần 3; sau mỗi lần lưu local thành công, cả tài liệu được đẩy lên cloud kèm revision.
- Revision chỉ dùng để phát hiện xung đột **giữa các thiết bị hoặc trình duyệt**. Giữa các tab của cùng một trình duyệt vẫn là Web Locks của phần 3.
- Khách không đổi gì so với phần 3 và không gọi mạng.
- Mọi quyết định (mở bản nào, gộp danh sách, xử lý response) là hàm thuần trong `src/lib/sync/`, test được không cần mạng hay IndexedDB thật.

### Dexie version 2

```ts
type SyncStatus = 'synced' | 'pending' | 'conflict' | 'deleted-in-cloud';

type SchemaRecordBase = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};
type LocalOnlyFields = { readonly ownerId: null; readonly cloudRevision: null; readonly syncStatus: null };
type CloudBackedFields = {
  readonly ownerId: string;              // id tài khoản sở hữu bản cloud
  readonly cloudRevision: number | null; // revision cloud mà bản cache dựa trên; null khi chưa tạo trên cloud
  readonly syncStatus: SyncStatus;
};
type SchemaRecord = SchemaRecordBase & (LocalOnlyFields | CloudBackedFields);

type SessionRecord = { readonly key: 'current'; readonly userId: string; readonly email: string };

db.version(2)
  .stores({
    schemas: 'id, updatedAt, ownerId',
    documents: 'schemaId',
    viewports: 'schemaId',
    session: 'key',
  })
  .upgrade((transaction) =>
    transaction.table('schemas').toCollection().modify((record) => {
      record.ownerId = null;
      record.cloudRevision = null;
      record.syncStatus = null;
    }),
  );
```

| `syncStatus` | Ý nghĩa |
|---|---|
| `synced` | Bản cache đúng bằng bản cloud ở revision `cloudRevision` |
| `pending` | Bản cache có thay đổi cloud chưa nhận. `cloudRevision` là `null` thì schema chưa được tạo trên cloud |
| `conflict` | Cloud có revision mới hơn `cloudRevision` trong khi cache đang có thay đổi; chờ người dùng chọn |
| `deleted-in-cloud` | Schema đã bị xóa trên cloud trong khi cache đang có thay đổi; chờ người dùng chọn |

- Bản ghi của version 1 thành schema của khách (`ownerId: null`). `documents` và `viewports` không đổi. Bảng mới `session` giữ tài khoản đăng nhập gần nhất (mục 6), bị xóa khi đăng xuất.
- Schema Zod của record trong `lib/storage/records.ts` mô tả đúng union trên; record sai hình dạng vẫn hiện thành "Schema không đọc được" như phần 3.
- IndexedDB không index giá trị `null`. Schema của khách được lọc trong bộ nhớ, vì màn hình danh sách vốn đã đọc cả bảng `schemas`; schema của tài khoản được truy vấn theo index `ownerId`.
- **Ghi cache:** lần ghi tài liệu của autosave (phần 3) nằm cùng transaction với việc đặt `syncStatus` thành `pending` khi record có chủ, trừ khi đang là `conflict` hoặc `deleted-in-cloud` (giữ nguyên). Tab bị đóng ngay sau lần ghi local thì record vẫn là `pending`, và đồng bộ nền sẽ đẩy nó lên.
- Test nâng cấp: mở database đã tạo ở version 1 bằng `fake-indexeddb`, nâng lên version 2, kiểm tra ba trường mới là `null` và tài liệu còn nguyên (quy tắc của phần 3). Tab còn chạy code version 1 nhận `versionchange` và hiện hộp thoại "outdated-tab" của phần 3.

### Mở schema

Sau khi lấy được khóa của schema (phần 3), `openSchema` đọc bản cache rồi gọi hàm thuần `decideOpenAction(cached, cloudResult)`:

| Bản cache | `GET /schemas/:id` | Hành động |
|---|---|---|
| Của khách (`ownerId: null`) | Không gọi | Mở như phần 3 |
| Của tài khoản khác | Không gọi | "Không tìm thấy schema" |
| Không có, chưa đăng nhập | Không gọi | "Không tìm thấy schema", kèm link đăng nhập (`cloudSchema`) |
| Không có | `200` | Ghi cache (`synced`, `cloudRevision`), mở |
| Không có | `404` | "Không tìm thấy schema" |
| Không có | Lỗi mạng, `5xx` | "Cần kết nối mạng để mở schema này", nút Thử lại |
| `pending`, `cloudRevision: null` | Không gọi | Mở bản cache, đẩy `POST` |
| `synced` | `200`, cùng revision | Mở bản cache |
| `synced` | `200`, revision khác | Ghi bản cloud vào cache, mở |
| `synced` | `404` | Xóa cache, "Schema đã bị xóa ở thiết bị khác" |
| `pending` | `200`, cùng revision | Mở bản cache, đẩy `PUT` |
| `pending` hoặc `conflict` | `200`, revision khác | Mở bản cache, `syncStatus` thành `conflict`, hộp thoại xung đột |
| `pending`, `conflict` hoặc `deleted-in-cloud` | `404` | `syncStatus` thành `deleted-in-cloud`, hộp thoại "đã bị xóa trên cloud" |
| Có | Lỗi mạng, `5xx`, `429` | Mở bản cache; trạng thái chưa đồng bộ; đẩy khi có mạng |
| Có, phiên đã hết hạn | Không gọi | Mở bản cache; thay đổi giữ `pending` tới khi đăng nhập lại |

- Tài liệu từ cloud luôn đi qua `parseSchemaDocument`. `version-unsupported` (thiết bị khác đã dùng frontend mới hơn) thì hiện thông báo tải lại trang của phần 3 và không ghi đè cache.
- Editor không hỏi cloud định kỳ trong lúc sửa. Thay đổi từ thiết bị khác được phát hiện ở lần đẩy tiếp theo (`409`) hoặc lần mở sau. Cộng tác thời gian thực nằm ngoài phạm vi.

### Đẩy lên cloud

`CloudPusher` được tạo cho mỗi editor của schema có chủ, chạy cạnh `useAutosave`:

- **Kích hoạt:** sau mỗi lần ghi cache thành công; khi có sự kiện `online`; khi bấm "Thử lại"; khi trạng thái auth trở lại `signed-in`.
- **Mỗi lúc một request.** Thay đổi đến trong lúc đang gửi được đánh dấu; gửi xong thì gửi tài liệu mới nhất một lần nữa. Cùng cách với autosave local của phần 3, nên không có hẹn giờ debounce.
- **Trước khi gửi:** kích thước tài liệu đã serialize lớn hơn `MAX_REQUEST_BODY_BYTES` thì không gửi, trạng thái lỗi `payload-too-large`.
- **Request:** `cloudRevision` là `null` thì `create({ id, document })`; ngược lại `update(id, { document, expectedRevision: cloudRevision })`.

| Kết quả | Hành động |
|---|---|
| `200`, `201` | Trong một transaction: `cloudRevision` = revision trả về; `syncStatus` thành `synced` nếu `updatedAt` của record chưa đổi từ lúc gửi, nếu đổi rồi thì giữ `pending` và gửi tiếp |
| `409 revision-conflict` | `syncStatus` thành `conflict`, dừng đẩy, tải bản cloud, mở hộp thoại xung đột |
| `409 schema-id-unavailable` | `get(id)`: `200` và tài liệu bằng nhau thì coi như đã tạo (response trước bị mất), đánh dấu `synced`; `200` và khác nhau thì `conflict`; `404` (id thuộc tài khoản khác, gần như không thể với `crypto.randomUUID`) thì lỗi `schema-id-unavailable` |
| `404` khi `PUT` | `syncStatus` thành `deleted-in-cloud`, mở hộp thoại tương ứng |
| `403 schema-limit-reached`, `413`, `422` | Trạng thái lỗi kèm mã (`422` có `version-unsupported` thì báo riêng mã này); không tự thử lại tới khi tài liệu đổi |
| `401` sau khi refresh thất bại | Auth thành `expired`; dừng đẩy, giữ `pending`; chạy lại khi đăng nhập lại |
| `429`, `5xx`, `network`, `timeout`, `invalid-response` | Giữ `pending`, thử lại sau 2 giây, nhân đôi mỗi lần tới tối đa 60 giây (`429` thì chờ ít nhất `Retry-After`); `online` hoặc thay đổi mới thì thử ngay |

- So sánh tài liệu bằng hàm so sánh sâu không phụ thuộc thứ tự khóa, không so chuỗi JSON, vì PostgreSQL JSONB sắp lại khóa khi lưu (spec phần 2, mục 1).
- Bộ hẹn giờ thử lại (`scheduler`) và `online` được inject, nên test không phụ thuộc đồng hồ thật.

**Trạng thái trên toolbar.** `saveStatus` của phần 3 vẫn báo lần ghi local; khi ghi local lỗi thì hiện lỗi đó như phần 3. Nếu không, toolbar hiện trạng thái cloud:

| Trạng thái | Hiển thị |
|---|---|
| Schema của khách | "Chỉ lưu trên trình duyệt này", nút "Lưu lên cloud" |
| `synced` | "Đã lưu lên cloud" |
| Đang gửi | "Đang đồng bộ…" |
| `pending`, offline hoặc đang thử lại | "Chưa đồng bộ" kèm lý do (mất mạng, máy chủ không phản hồi) |
| `pending`, phiên hết hạn | "Chưa đồng bộ, hãy đăng nhập lại" |
| `conflict` | "Xung đột", nút "Giải quyết" |
| `deleted-in-cloud` | "Đã bị xóa trên cloud", nút "Xem lựa chọn" |
| Lỗi | "Không đồng bộ được" kèm thông báo theo mã trong `apiErrors`, nút "Thử lại" |

### Xung đột

Hộp thoại "Schema đã được sửa ở nơi khác" (`AlertDialog`) hiện cho mỗi bản: thời điểm sửa gần nhất, số bảng và số cột.

| Lựa chọn | Hành động |
|---|---|
| Giữ bản trên máy này | `update` với `expectedRevision` là revision của bản cloud vừa tải. Thành công thì `synced`. Lại `409` (thiết bị thứ ba vừa ghi) thì tải bản cloud mới và hiện lại hộp thoại |
| Dùng bản trên cloud | Ghi bản cloud vào cache (`synced`, `cloudRevision`), rồi mount lại store của editor với tài liệu đó. Lịch sử undo bắt đầu rỗng, vì lịch sử thuộc về store (phần 3). Toast "Đã chuyển sang bản trên cloud" |

- Đóng hộp thoại mà không chọn: `syncStatus` vẫn là `conflict`; người dùng sửa tiếp được, thay đổi vẫn lưu vào cache nhưng không được đẩy lên; nút "Giải quyết" trên toolbar mở lại hộp thoại. "Giữ bản trên máy này" luôn đẩy tài liệu mới nhất.
- Mở schema đang có xung đột thì editor mở bản cache và hiện hộp thoại ngay, cùng một đường với xung đột phát hiện lúc đang sửa.

**Schema bị xóa trên cloud** (`deleted-in-cloud`), hộp thoại có hai lựa chọn: "Tạo lại trên cloud" (đặt `cloudRevision: null`, `pending`, rồi `POST` với cùng id, vì hàng cũ đã bị xóa) và "Xóa khỏi trình duyệt này" (xóa ba bảng trong một transaction, về danh sách).

### Danh sách schema

Hàm thuần `mergeSchemaList({ auth, cachedRecords, cloudItems, isCloudListComplete })` trả về các phần của màn hình danh sách:

| Trạng thái auth | Phần "Schema của bạn" | Phần "Chỉ trên trình duyệt này" |
|---|---|---|
| `signed-out` | Không có; thay bằng một dòng mời đăng nhập để lưu lên cloud | Bản ghi của khách, giống phần 3 |
| `signed-in` | Hợp của danh sách cloud và cache có `ownerId` là người dùng, gộp theo id | Bản ghi của khách, mỗi dòng có thêm "Lưu lên cloud" |
| `expired` | Cache của `lastUser`, kèm banner "Phiên đăng nhập đã hết" và nút đăng nhập lại | Như trên |

Gộp một id:

| Cloud | Cache | Tên, thời gian lấy từ | Nhãn |
|---|---|---|---|
| Có | Không | Cloud | "Chưa tải về trình duyệt này" |
| Có | `synced`, revision cache ≥ cloud | Cache | — |
| Có | `synced`, revision cloud lớn hơn | Cloud | — (cache được thay khi mở) |
| Có hoặc không | `pending` | Cache | "Chưa đồng bộ" |
| Có | `conflict` | Cache | "Xung đột" |
| Không, đã tải hết trang | `synced` | — | Không hiện; id được trả trong `staleCacheIds` để xóa khỏi cache (khi lấy được khóa với `ifAvailable`) |
| Không, đã tải hết trang | `pending` có `cloudRevision`, hoặc `deleted-in-cloud` | Cache | "Đã bị xóa trên cloud" |

- Mỗi phần sắp theo `updatedAt` giảm dần. Cache hiện ngay khi đọc xong IndexedDB; phần cloud có skeleton trong lúc tải.
- Không tải được danh sách cloud: vẫn hiện cache của tài khoản, kèm banner "Không tải được danh sách trên cloud" và nút Thử lại; không kết luận schema nào đã bị xóa.
- Danh sách cloud được tải lại khi màn hình mount, sau khi tạo, đổi tên, xóa, khi tab hiện lại (`visibilitychange`) và khi có `online`.

### Đưa schema của khách lên cloud

- **Hỏi khi nào:** sau mỗi lần đăng nhập hoặc đăng ký chủ động thành công (không tính `initialize` hay refresh), nếu có ít nhất một schema của khách đọc được. Hộp thoại "Lưu các schema trên trình duyệt này vào tài khoản?" liệt kê tên kèm checkbox, mặc định chọn hết; hai nút "Lưu lên cloud" và "Để sau". Hộp thoại ghi rõ schema không chọn vẫn nằm trên trình duyệt và lưu lên sau được.
- Nút "Lưu lên cloud" trên dòng của danh sách và trên toolbar editor chạy cùng quy trình cho một schema; chưa đăng nhập thì mở `SignInPrompt`.
- **Quy trình `uploadLocalSchemas(ids)`**, lần lượt từng schema:
  1. Lấy khóa với `ifAvailable`. Không lấy được thì bỏ qua, ghi lý do "đang mở ở tab khác". Khi chạy từ toolbar, editor đang giữ khóa nên dùng luôn khóa đó.
  2. Đọc và `parseSchemaDocument`; lỗi thì bỏ qua. Vượt kích thước thì bỏ qua.
  3. `create({ id, document })`:
     - `201`: trong một transaction đặt `ownerId`, `cloudRevision`, `syncStatus: 'synced'`. Editor đang mở (khi chạy từ toolbar) chuyển sang chế độ có `CloudPusher`.
     - `409 schema-id-unavailable`: `get(id)`. `200` và tài liệu bằng nhau thì đánh dấu `synced` (lần tải trước đã thành công nhưng mất response); `200` và khác nhau thì đánh dấu có chủ với `conflict`, xử lý khi mở; `404` (id thuộc tài khoản khác) thì đổi sang UUID mới, chuyển bản ghi ở ba bảng trong một transaction, rồi `create` lại một lần.
     - `403 schema-limit-reached`, lỗi mạng, `5xx`: dừng cả quy trình; các schema còn lại giữ nguyên.
     - `413`, `422`: bỏ qua schema đó.
- Bản ghi chỉ đổi chủ sau khi `POST` thành công, nên quy trình thất bại giữa chừng không làm hỏng gì. Kết thúc có toast "Đã lưu N schema lên cloud", và nếu có thì thêm "M schema chưa lưu được".

### Tạo, đổi tên, xóa khi đã đăng nhập

| Thao tác | Hành vi |
|---|---|
| Tạo | Một transaction tạo record (`ownerId` là người dùng, `cloudRevision: null`, `pending`) và tài liệu; mở editor; `CloudPusher` gửi `POST`. Offline vẫn tạo được. Import ở phần 7 tạo schema qua cùng đường này |
| Đổi tên schema có trong cache | Như phần 3 (khóa, parse, `renameSchema`, ghi cache, tức thành `pending`), rồi đồng bộ nền đẩy ngay |
| Đổi tên schema chỉ có trên cloud | Tải về cache (`get`, parse, ghi `synced`), rồi đổi tên như trên |
| Xóa | Cần mạng. Lấy khóa với `ifAvailable`, xác nhận như phần 3, `remove(id)`: `204` hoặc `404` thì xóa ba bảng trong một transaction; lỗi mạng thì toast "Cần kết nối mạng để xóa schema trên cloud" và không xóa gì. Schema của khách xóa như phần 3 |

### Đồng bộ nền

`syncPendingSchemas` chạy khi auth chuyển sang `signed-in`, khi có `online`, và khi màn hình danh sách mount. Hàm lần lượt duyệt các record có `ownerId` là người dùng và `syncStatus` là `pending`: lấy khóa với `ifAvailable` (không lấy được thì bỏ qua, vì tab đang giữ khóa sẽ tự đẩy), rồi đẩy một lần theo đúng bảng kết quả ở trên nhưng không mở hộp thoại (`409 revision-conflict` thì chỉ đánh dấu `conflict`, `404` thì `deleted-in-cloud`). Không có hẹn giờ chạy nền.

### Đăng xuất

**Đề xuất:** đăng xuất xóa mọi bản cache của tài khoản khỏi trình duyệt.

1. Đếm record của tài khoản có `syncStatus` khác `synced`. Nếu có, hộp thoại "N schema có thay đổi chưa lưu lên cloud. Đăng xuất sẽ xóa chúng khỏi trình duyệt này." với ba nút "Thử đồng bộ" (chạy đồng bộ nền rồi đếm lại), "Vẫn đăng xuất", "Hủy".
2. `auth.logout()`. Lỗi mạng thì dừng và báo "Không đăng xuất được, hãy kiểm tra kết nối": JavaScript không xóa được cookie `HttpOnly`, nên giao diện không được báo đã đăng xuất khi cookie vẫn còn hiệu lực. `204` hoặc `401` thì tiếp tục.
3. Phát `signed-out`; các tab khác rời editor của schema thuộc tài khoản, nhờ đó nhả khóa.
4. Với mỗi record của tài khoản: chờ lấy khóa (tối đa 5 giây, quá thì vẫn xóa), xóa ở ba bảng. Xóa bản ghi `session` và cookie `sf-auth-hint`.
5. Đang ở editor của schema thuộc tài khoản thì về `/`. Schema của khách giữ nguyên.

**Lý do:** bản cloud là bản chính nên không mất gì ngoài thay đổi chưa đồng bộ, và thay đổi đó đã được cảnh báo. Trên máy dùng chung, người dùng sau không đọc được schema của tài khoản trước qua DevTools.

**Phương án khác:** giữ cache, ẩn đi tới khi đúng tài khoản đó đăng nhập lại. Mở lại nhanh hơn, xem được khi offline, không mất thay đổi chưa đồng bộ; nhưng người dùng sau trên cùng trình duyệt đọc được dữ liệu, và cache của nhiều tài khoản tích tụ.

### Phiên hết hạn và đổi tài khoản

- **Phiên hết hạn** (refresh trả `401` mà người dùng không đăng xuất): giữ cache và bản ghi `session`. Danh sách hiện cache của `lastUser` kèm banner; editor vẫn lưu local (`pending`) nhưng không đẩy. Đăng nhập lại đúng tài khoản thì đồng bộ nền và `CloudPusher` chạy tiếp, xung đột xử lý như thường.
- **Đăng nhập tài khoản khác** trong khi còn cache của tài khoản trước: xóa các record `synced` của tài khoản trước (cloud đã có); giữ ẩn các record còn lại, không đẩy, tới khi tài khoản đó đăng nhập lại trên trình duyệt này; thay bản ghi `session`. Schema của khách được hỏi đưa lên cho tài khoản mới như thường.

### Web Locks

| Khóa | Ai giữ | Ghi chú |
|---|---|---|
| `schemaforge:schema:<schemaId>` | Editor (suốt thời gian mở), đổi tên và xóa từ danh sách, đưa lên cloud, đồng bộ nền, dọn cache khi đăng xuất | Chỉ tab giữ khóa mới ghi cache hoặc đẩy schema đó. Việc thay cache bằng bản cloud khi mở cũng nằm trong khóa |
| `schemaforge:auth-refresh` | `SessionRefresher` | Không xin khóa schema khi đang giữ khóa này (mục 6) |

Web Locks chỉ có hiệu lực trong một trình duyệt; revision lo phần giữa các thiết bị.

### Lý do và phương án bị loại

**Lý do:** đẩy cả tài liệu kèm revision là cách đơn giản nhất khớp với quyết định "bản cloud là bản chính, không merge operation". Kích thước đã bị giới hạn 2 MiB, và mỗi lúc chỉ một request. Id UUID do client tạo nên bản local và bản cloud dùng chung một id, không cần bảng ánh xạ.

**Phương án bị loại:**

- Gửi operation để server áp: server phải có log operation và thứ tự áp; `architecture.md` đã chọn không merge operation.
- Ghi đè theo lần ghi sau cùng, hoặc tự merge khi xung đột: âm thầm làm mất thay đổi của một bên, trái quyết định để người dùng chọn.
- Debounce việc đẩy lên cloud: mỗi lúc một request đã giới hạn số request theo thời gian khứ hồi, và thay đổi đã nằm an toàn trong cache; debounce thêm hẹn giờ phải giả lập trong test. Cân nhắc lại nếu số request đo được quá lớn.
- Mỗi tài khoản một database Dexie riêng: đưa schema của khách lên phải chép giữa hai database, danh sách đọc hai nơi, repository và khóa của phần 3 phải nhân đôi.
- Id do server sinh cùng cột `cloudId` trong cache: phải ánh xạ id local và id cloud; URL đổi sau khi đưa lên, hoặc schema chỉ có trên cloud phải được cấp id local khi mở trên thiết bị mới; gửi lại `POST` sau khi mất response tạo bản trùng.
- Hỏi cloud định kỳ trong lúc sửa: thêm request mà vẫn phải xử lý xung đột; cộng tác thời gian thực nằm ngoài phạm vi.

## 8. Security header, CORS, CSP

### Thiết lập ứng dụng

Hàm `configureApp(app, config)` trong `src/app-setup.ts` được dùng chung cho `main.ts` và e2e, nên e2e chạy đúng middleware như bản thật. Thứ tự: `trust proxy` theo `TRUST_PROXY_HOPS`; Helmet; CORS; `cookie-parser`; parser JSON giới hạn 2 MiB; `enableShutdownHooks`.

Guard (`OriginGuard`, `JwtAuthGuard`, `RateLimitGuard`, theo thứ tự này), `ValidationPipe` và `ApiExceptionFilter` được đăng ký bằng `APP_GUARD`, `APP_PIPE`, `APP_FILTER` trong module, nên `Test.createTestingModule({ imports: [AppModule] })` có đủ mà không phải khai báo lại.

### Helmet

```ts
helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
});
```

- API chỉ trả JSON, nên CSP chặn mọi thứ: response bị mở trực tiếp trên trình duyệt cũng không chạy được gì.
- `Cross-Origin-Resource-Policy: same-site` thay cho mặc định `same-origin`, vì frontend ở origin khác nhưng cùng site.
- Các header còn lại giữ mặc định của Helmet 8: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options`, bỏ `X-Powered-By`.

**Phương án bị loại:** CSP mặc định của Helmet: được thiết kế cho trang HTML (cho script, style từ `'self'`), rộng hơn mức một JSON API cần.

### CORS

```ts
app.enableCors({
  origin: config.CORS_ORIGINS, // mảng origin đã validate, không bao giờ là '*'
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: ['Retry-After'],
  maxAge: 600,
});
```

`CORS_ORIGINS` dùng chung với `OriginGuard`. Với origin không nằm trong danh sách, response không có `Access-Control-Allow-Origin` nên trình duyệt không cho đọc, còn request thay đổi dữ liệu đã bị `OriginGuard` chặn trước đó.

### Frontend và backend phải cùng site

- Cookie `SameSite=Strict` chỉ được gửi khi trang frontend và backend cùng site (cùng registrable domain). `http://localhost:3000` và `http://localhost:3001` cùng site, vì cổng không được tính.
- Khi deploy: `app.example.com` và `api.example.com` dùng được. Tên miền con cấp sẵn của nhà cung cấp nằm trong Public Suffix List (ví dụ một app ở `*.vercel.app`, một app ở `*.onrender.com`, hoặc hai app cùng `*.vercel.app`) là khác site, và cookie không được gửi. Ràng buộc này nằm trong mục 12.

**Phương án bị loại:**

- `rewrites` của Next.js chuyển `/api/*` về backend để cùng origin: không cần CORS và không đổi CSP, nhưng mọi request, kể cả stream AI ở phần 5, đi thêm một chặng qua server Next.js; backend chỉ thấy IP của server Next.js nên rate limit phải tin header forwarded; frontend và backend bị gắn vào nhau khi deploy.
- `SameSite=None`: trái `security.md`, và bị trình duyệt chặn như cookie bên thứ ba.

### CSP của frontend

- `buildContentSecurityPolicy({ nonce, isDevelopment, apiOrigin })` của phần 3 thêm `apiOrigin` vào `connect-src`: `connect-src 'self' <apiOrigin>`, với `apiOrigin = new URL(env.NEXT_PUBLIC_API_URL).origin`. Unit test kiểm tra `connect-src` có đúng origin, không có path.
- Rule lint cấm gọi mạng của phần 3 có ngoại lệ cho `src/lib/api/**`. `BroadcastChannel` trong `src/lib/auth/` không gọi mạng.

### Cookie `Secure` khi phát triển

- `AUTH_COOKIE_SECURE` mặc định `true`; schema env từ chối `false` khi `NODE_ENV=production`.
- Chrome và Firefox coi `http://localhost` là secure context và nhận cookie `Secure` từ đó, nên dev trên localhost vẫn dùng `Secure`, giống production.
- Nếu trình duyệt không nhận cookie `Secure` từ `http://localhost` (plan kiểm tra Safari), developer đặt `AUTH_COOKIE_SECURE=false` trong `.env` của mình.

**Phương án bị loại:** suy ra từ `NODE_ENV` (không `Secure` khi development): môi trường dev khác production ở một thuộc tính bảo mật, lỗi chỉ lộ ra khi deploy.

## 9. Env và cấu hình

### Backend

| Biến | Kiểm tra | Mặc định | Giá trị trong `.env.example` |
|---|---|---|---|
| `NODE_ENV`, `PORT` | Như spec phần 1 | Như spec phần 1 | Như spec phần 1 |
| `DATABASE_URL` | URL có protocol `postgres:` hoặc `postgresql:` | Bắt buộc | `postgresql://user:password@localhost:5432/schemaforge` |
| `JWT_ACCESS_SECRET` | Ít nhất 32 ký tự; ở production không được bằng giá trị trong `.env.example` | Bắt buộc | `replace-with-output-of-openssl-rand-base64-48` |
| `CORS_ORIGINS` | Danh sách cách nhau bởi dấu phẩy, ít nhất một; mỗi phần tử là origin `http` hoặc `https` đúng bằng `new URL(x).origin` (không path, không `/` cuối, không `*`); ở production chỉ `https` | Bắt buộc | `http://localhost:3000` |
| `AUTH_COOKIE_SECURE` | Chỉ nhận `true` hoặc `false` (không dùng `z.coerce.boolean`, vốn biến chuỗi `"false"` thành `true`); `false` bị từ chối ở production | `true` | `true` |
| `TRUST_PROXY_HOPS` | Số nguyên ≥ 0 | `0` | `0` |

- Ràng buộc giữa các biến (production với `AUTH_COOKIE_SECURE`, `CORS_ORIGINS`, secret mẫu) viết bằng `superRefine` trong `src/config/env.ts`.
- Thời hạn token, tham số argon2, chính sách rate limit, giới hạn body và số schema là hằng trong code, không phải biến môi trường: đổi chúng là quyết định có test đi kèm.
- `backend/prisma.config.ts` là cấu hình của Prisma CLI, nằm ngoài ứng dụng Nest, và đọc `process.env` (`DATABASE_URL`, `SHADOW_DATABASE_URL`). Đây là ngoại lệ duy nhất của quy tắc "không đọc `process.env` ngoài `src/config/`" (mục [Vấn đề với các spec đã duyệt](#vấn-đề-với-các-spec-đã-duyệt)).
- **e2e:** `backend/.env.test.example` (commit) được chép thành `.env.test` (gitignore), có `NODE_ENV=test` và URL của database test. `vitest.e2e.config.ts` nạp file này vào `process.env`; `ConfigModule` ưu tiên biến trong `process.env` hơn file `.env`.
- `.gitignore` thêm `.env.test` và `backend/src/generated/`.

### Frontend

- `src/lib/env.ts` (có từ phần 3) thêm `NEXT_PUBLIC_API_URL`: URL `http` hoặc `https`, không có path ngoài `/`. Bắt buộc và phải là `https` khi build production; ở development và test mặc định `http://localhost:3001`. Module đọc `process.env.NEXT_PUBLIC_API_URL` viết đầy đủ, để Next.js thay giá trị lúc build.
- `frontend/.env.example` mới: `NEXT_PUBLIC_API_URL=http://localhost:3001`.
- `turbo.json`: task `build` thêm `env: ["NEXT_PUBLIC_API_URL"]`, vì giá trị được nhúng vào bundle và đổi giá trị thì phải build lại (spec phần 1 đã dự kiến).
- Job `verify` của CI đặt `NEXT_PUBLIC_API_URL=https://api.schemaforge.invalid` cho `next build`. Domain `.invalid` không bao giờ phân giải được.

## 10. PostgreSQL khi phát triển local

Máy dev có Docker Desktop, đã chạy sẵn container `local_postgres` (`postgres:16-alpine`).

| Cách | Cài đặt | Độ giống production | Nhược điểm |
|---|---|---|---|
| **Container Docker sẵn có** (đề xuất) | Không cần: tạo hai database `schemaforge_dev`, `schemaforge_test` (và `schemaforge_shadow` cho migration) trong container `local_postgres` đang chạy | PostgreSQL 16 thật, cùng engine và cùng major với CI | Phải tự tạo database và role trong container sẵn có, không cô lập theo dự án như một container riêng |
| `prisma dev` (thay thế khi không có Docker) | Không cần: có sẵn trong Prisma CLI (dependency `@prisma/dev` của `prisma` 7.10.0) | PostgreSQL chạy trên PGlite (WebAssembly), nói giao thức PostgreSQL chuẩn | Mỗi lúc chỉ nhận một kết nối, kết nối thứ hai phải chờ; là công cụ cho phát triển, không phải PostgreSQL đầy đủ |
| Homebrew `postgresql@18` | `brew install postgresql@18` (18.6, có bottle, keg-only nên phải thêm vào `PATH`), `brew services start`, tạo role và database | PostgreSQL thật, khác major với CI | Thêm một dịch vụ chạy nền trên máy, ngoài Docker đã có |
| Postgres.app | Tải app | Như Homebrew | Chỉ có trên macOS, cài bằng giao diện |
| Neon (gói miễn phí) | Tạo tài khoản và project | PostgreSQL thật, được quản lý | Cần mạng và tài khoản; e2e qua mạng chậm, dễ chập chờn; mỗi developer phải giữ một secret |

**Đề xuất:** container Docker Postgres sẵn có trên máy dev (`local_postgres`), với database `schemaforge_dev`, `schemaforge_test`, `schemaforge_shadow`.

- Developer đặt `DATABASE_URL` và `SHADOW_DATABASE_URL` trong `.env` (và biến thể `_test`) trỏ vào container `local_postgres`. README của backend hướng dẫn cả cách này lẫn `prisma dev --name schemaforge --detach` cho máy không có Docker; đổi giữa hai cách chỉ là đổi URL trong `.env`.
- e2e chạy tuần tự (mục 11), một kết nối là đủ; plan chốt cấu hình pool của `PrismaPg`.
- CI chạy PostgreSQL 16 thật (cùng major với container local) bằng service container, và là cổng chặn cho mọi khác biệt giữa `prisma dev` (PGlite) và PostgreSQL thật.

**Lý do:** máy dev đã có Docker Desktop và container Postgres đang chạy sẵn, nên dùng ngay không cài thêm gì; cùng engine PostgreSQL thật với CI, giống production hơn PGlite của `prisma dev`.

**Phương án khác:** `prisma dev` khi máy không có Docker (không cài thêm gì, chạy ngay sau `pnpm install`); Homebrew `postgresql@18` khi cần một bản PostgreSQL khác tách khỏi container Docker hiện có.

## 11. Test

### Backend: unit

Test đặt cạnh file (`*.spec.ts`), chạy Vitest trên node với `Test.createTestingModule`. `PrismaService` được thay bằng object gồm các `vi.fn`; `PasswordHasher`, `Clock` và bộ sinh token ngẫu nhiên cũng là bản giả. Unit test không bao giờ chạm database thật.

| Đối tượng | Hành vi chính |
|---|---|
| `AuthService` | Đăng ký chuẩn hóa email và gọi hàm băm; mật khẩu phổ biến trả `password-too-common`; email không tồn tại và sai mật khẩu cho cùng lỗi, và vẫn gọi `verify` với hash giả; cấp cặp token |
| `RefreshTokenService` | Xoay vòng; dùng lại token đã xoay thì thu hồi cả họ; token hết hạn; token đã thu hồi; dọn token hết hạn |
| `AccessTokenService`, `JwtStrategy` | Ký và verify với đồng hồ giả; từ chối thuật toán khác HS256; đọc token từ cookie |
| `password.policy` | Chuẩn hóa NFKC; đếm độ dài theo code point, kể cả chữ tiếng Việt có dấu tổ hợp; danh sách phổ biến không phân biệt hoa thường |
| `auth-cookies` | Thuộc tính của từng cookie theo `AUTH_COOKIE_SECURE`; xóa cookie đúng `Path` |
| `SchemasService` | Tạo: tài liệu sai cấu trúc trả `422` với lỗi của core, tối đa 100 lỗi; lưu bản đã migrate cùng `name`; tài liệu có issue ngữ nghĩa vẫn được lưu; vượt giới hạn trả `403`. Cập nhật: đúng revision; sai revision trả `409` kèm `currentRevision`; không có hoặc thuộc người khác trả `404`. Xóa schema của người khác trả `404` |
| Cursor của danh sách | Mã hóa và giải mã; cursor hỏng bị từ chối |
| `schemas.mapper`, `users.mapper` | Không có `passwordHash`, `ownerId`; thời gian là chuỗi ISO |
| `OriginGuard` | Method an toàn đi qua; thiếu `Origin`, `Origin: null`, origin lạ trả `403`; origin trong danh sách đi qua |
| `JwtAuthGuard` cùng `@Public()` | Route private không có cookie trả `401`; route public đi qua |
| `RateLimitGuard` | Với limiter giả: dưới giới hạn đi qua; vượt giới hạn trả `429` kèm `Retry-After`; khóa đã được băm |
| `ApiExceptionFilter` | Mọi dòng ánh xạ ở mục 5, kể cả `P2002` theo trường, lỗi 413 và JSON hỏng của body parser, lỗi lạ không lộ chi tiết |
| `env` | Biến mới: `CORS_ORIGINS` sai định dạng, có `*`, có path; production từ chối `AUTH_COOKIE_SECURE=false`, origin `http`, secret mẫu; `"false"` được hiểu là `false` |

### Backend: e2e

- File `backend/test/*.e2e-spec.ts`, cấu hình `vitest.e2e.config.ts` (không tính coverage), script `test:e2e`. Script `test` không chạy e2e, nên `pnpm test` vẫn chạy được trên máy không có database.
- Task Turborepo `test:e2e`: `dependsOn` gồm `^build` và `generate`; `cache: false`.
- `globalSetup` yêu cầu `NODE_ENV=test` rồi chạy `prisma migrate deploy`. Mỗi test bắt đầu bằng `TRUNCATE users, schemas, refresh_tokens CASCADE` (qua `$executeRaw` dạng tagged template). `fileParallelism: false`.
- App được dựng bằng `Test.createTestingModule({ imports: [AppModule] })` cộng `configureApp`, gọi bằng agent của `supertest` (giữ cookie giữa các request), luôn gửi `Origin` hợp lệ trừ khi test kiểm tra `Origin`. `PasswordHasher` là bản thật.

| # | Hành trình | Tính năng |
|---|---|---|
| 1 | Đăng ký, kiểm tra cookie có `HttpOnly`, `Secure`, `SameSite=Strict`, đúng `Path`; `me`; đăng xuất; `me` trả `401` | ST-02 |
| 2 | Đăng nhập sai mật khẩu và đăng nhập email không tồn tại cho cùng status và cùng body | ST-02 |
| 3 | Refresh xoay token; dùng lại token cũ trả `401`, và token mới cũng bị thu hồi | ST-02 |
| 4 | Tạo schema (revision 1), get, cập nhật đúng revision (thành 2), cập nhật với revision 1 trả `409` có `currentRevision: 2`, xóa trả `204`, get trả `404` | ST-03, ST-04 |
| 5 | Người dùng B get, update, delete schema của A đều nhận `404`; danh sách của B không có schema của A | ST-04 |
| 6 | Tài liệu sai cấu trúc trả `422` với `code` và `path`; tài liệu có hai bảng trùng tên trả `201` | ST-03 |
| 7 | Hai `PUT` đồng thời cùng `expectedRevision`: đúng một `200` và một `409` | ST-03 |
| 8 | Ba schema, `limit=2`: hai trang, `nextCursor` là `null` ở trang cuối; `limit=101` trả `400` | ST-04 |
| 9 | Body lớn hơn 2 MiB trả `413 payload-too-large`; JSON hỏng trả `400` | ST-03 |
| 10 | `POST` không có `Origin` hoặc với origin lạ trả `403`; preflight từ origin hợp lệ có `Access-Control-Allow-Credentials: true`; origin lạ không nhận `Access-Control-Allow-Origin` | Bảo mật |
| 11 | Lần đăng nhập thứ 11 trong 15 phút cho cùng email trả `429` có `Retry-After`; lần đăng ký thứ 6 trong một giờ cũng vậy | ST-02 |
| 12 | Liệt kê route qua `DiscoveryService` của Nest: tập route public đúng bằng năm route ở mục 5; mỗi route private trả `401` khi không có cookie (`it.each` trên danh sách route) | Bảo mật |
| 13 | Response có header của Helmet; lỗi `500` không có stack hay chi tiết | Bảo mật |
| 14 | `POST /schemas` lần thứ 101 của một người dùng trả `403 schema-limit-reached` | ST-03 |

### CI

Thêm job `e2e` vào `.github/workflows/ci.yml`, chạy song song với `verify` và cũng là cổng chặn:

```yaml
e2e:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: schemaforge
        POSTGRES_PASSWORD: schemaforge
        POSTGRES_DB: schemaforge_test
      ports: ["5432:5432"]
      options: >-
        --health-cmd "pg_isready -U schemaforge"
        --health-interval 5s --health-timeout 5s --health-retries 10
  env:
    NODE_ENV: test
    DATABASE_URL: postgresql://schemaforge:schemaforge@localhost:5432/schemaforge_test
    CORS_ORIGINS: http://localhost:3000
  steps:
    # checkout, pnpm/action-setup, setup-node, pnpm install --frozen-lockfile: như job verify
    - run: echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)" >> "$GITHUB_ENV"
    - run: pnpm turbo run test:e2e --filter @schemaforge/backend
```

Mật khẩu của service container chỉ tồn tại trong job nên không phải secret. Secret JWT được sinh mới ở mỗi lần chạy.

### Frontend

Vitest trên jsdom. Mock chỉ ở biên: `fetch` (qua `fetchImpl` được inject), IndexedDB (`fake-indexeddb`), Web Locks (bản giả của `SchemaLockManager`, `AuthLockManager`), `BroadcastChannel`, sự kiện `online`, `document.cookie`, bộ hẹn giờ thử lại.

**Unit:**

| Đối tượng | Hành vi chính |
|---|---|
| `api-client` | Option của request; parse thành công; lỗi HTTP ra `ApiFailure` đúng mã; body sai hợp đồng ra `invalid-response`; `fetch` reject ra `network`; hết giờ ra `timeout`; `401` thì refresh rồi gửi lại đúng một lần; refresh thất bại thì gọi `onSessionExpired` |
| `session-refresher` | Nhiều lời gọi đồng thời chỉ tạo một refresh; trong khóa, `me` trả `200` thì không refresh |
| `auth-store` | Không có hint thì không gọi `fetch`; có hint thì gọi `me`; `401` thì refresh rồi `me`; đăng nhập ghi hint, `session`, phát `signed-in`; nhận `signed-out` từ tab khác |
| `sanitize-return-to` | `/schemas/x` giữ nguyên; `//evil.com`, `https://evil.com`, `/\evil.com`, `javascript:alert(1)` thành `/` |
| `decide-open-action` | Mọi dòng của bảng mở schema (mục 7) |
| `merge-schema-list` | Mọi dòng của bảng theo trạng thái auth và bảng gộp |
| `cloud-pusher` | Mỗi lúc một request; thay đổi đến khi đang gửi được gửi một lần ở cuối; mọi dòng của bảng kết quả; thời gian chờ thử lại và `Retry-After` với scheduler giả; `online` thì thử ngay; vượt kích thước thì không gửi |
| `upload-local-schemas` | `201`; `409` với tài liệu giống, khác, và `404` rồi đổi id; `403` dừng quy trình; khóa bận thì bỏ qua; lỗi giữa chừng không đổi chủ bản ghi |
| `sync-pending-schemas` | Chỉ xét record `pending` của đúng người dùng; khóa bận thì bỏ qua; `409` đánh dấu `conflict` |
| `sign-out` | `logout` lỗi mạng thì không xóa gì; thành công thì chỉ xóa record của tài khoản ở ba bảng, giữ schema của khách, xóa `session` và hint |
| `database` version 2 | Nâng cấp từ database version 1 không mất dữ liệu |
| `schema-repository` (phần thêm) | Ghi tài liệu đặt `pending` trong cùng transaction; không ghi đè `conflict`; đổi id chuyển đủ ba bảng |
| `documents-equal` | Hai tài liệu khác thứ tự khóa vẫn bằng nhau |
| `content-security-policy`, `env` | `connect-src` có origin backend; `NEXT_PUBLIC_API_URL` sai bị từ chối |
| Bản dịch | Namespace `auth`, `sync`, `apiErrors` đủ key ở hai locale (test sẵn có của phần 3) |

**Component:**

| Component | Hành vi chính |
|---|---|
| `SignInScreen`, `SignUpScreen` | Nhãn; lỗi dưới từng ô; thông báo đúng cho `invalid-credentials`, `email-already-registered`, `password-too-common`, `429`; nút bị disable khi đang gửi; chuyển tới `returnTo`; `autoComplete` đúng từng ô; `user.paste` vào ô mật khẩu giữ giá trị; `/sign-up` không có ô nhập lại mật khẩu; lỗi từ server không xóa giá trị đã nhập |
| `AccountMenu` | Bốn trạng thái |
| `SignInPrompt` | Mở khi chưa đăng nhập; link có `returnTo`; đã đăng nhập thì không mở |
| Hộp thoại đưa schema lên | Liệt kê schema của khách, mặc định chọn hết; "Để sau" không gọi API |
| Hộp thoại xung đột, hộp thoại bị xóa trên cloud | Mỗi lựa chọn gọi đúng hành động; focus quay về đúng chỗ |
| Hộp thoại đăng xuất | Hiện khi còn thay đổi chưa đồng bộ |
| Toolbar | Mỗi trạng thái cloud có nhãn đã dịch |
| `SchemaListScreen` | Các phần theo trạng thái auth; nhãn trạng thái; banner khi không tải được danh sách cloud |
| Accessibility | `expectNoAxeViolations` trên hai màn hình auth, `SignInPrompt` và các hộp thoại mới, ở cả hai theme |

**Tích hợp** (màn hình + store + repository trên `fake-indexeddb`, với `fetch` giả đóng vai backend trong bộ nhớ):

| # | Hành trình | Tính năng |
|---|---|---|
| 1 | Khách có hai schema; đăng nhập; hộp thoại hiện ra; chọn một; danh sách có một schema ở "Schema của bạn" và một ở "Chỉ trên trình duyệt này" | ST-02, ST-03 |
| 2 | Sửa schema có chủ: `PUT` gửi đúng `expectedRevision`; `fetch` reject thì nhãn "Chưa đồng bộ"; phát `online` thì thành "Đã lưu lên cloud" | ST-03 |
| 3 | Backend giả tăng revision; lần đẩy nhận `409`; hộp thoại hiện ra; "Giữ bản trên máy này" gửi `PUT` với revision mới. Chạy lại với "Dùng bản trên cloud": canvas hiện tài liệu của cloud | ST-03 |
| 4 | Database rỗng (thiết bị mới), đã đăng nhập: danh sách hiện schema từ cloud; mở ra editor hiện đúng tài liệu và cache được ghi | ST-03, ST-04 |
| 5 | Xóa schema từ danh sách: `DELETE` được gửi, schema biến mất khỏi danh sách và cache | ST-04 |
| 6 | Đăng xuất khi còn `pending`: cảnh báo; "Vẫn đăng xuất"; cache của tài khoản bị xóa, schema của khách còn | ST-02 |
| 7 | Khách không có hint: các hành trình tạo, sửa, đổi tên, xóa của phần 3 không gọi `fetch` lần nào | ST-01, ST-02 |

### Coverage

| Package | Ngưỡng (line) | Thay đổi |
|---|---|---|
| `backend/` | 80% | Thêm glob `src/**/*.strategy.ts`, `src/**/*.mapper.ts`, `src/**/*.policy.ts`; bỏ `src/generated/**`. e2e không tính coverage |
| `frontend/` | 80% | Glob có sẵn (`src/lib/**`, `src/features/**/{state,lib,hooks}/**`) đã phủ `lib/api`, `lib/auth`, `lib/sync` và `features/auth` |
| `packages/api-contract` | 90% | `src/**/*.ts`, như `packages/core` |

### Kiểm tra tay

| Hạng mục | Cách kiểm tra |
|---|---|
| Thuộc tính cookie trên trình duyệt thật | Chrome DevTools, tab Application |
| CSP không chặn request tới backend | `next build && next start` cùng backend; Console không có vi phạm |
| Hai tab cùng lúc gặp access token hết hạn | Xóa cookie `sf-access` trong DevTools, thao tác ở hai tab; cả hai vẫn đăng nhập |
| Offline rồi online | Chế độ Offline của tab Network |
| Hai thiết bị | Chrome và Firefox cùng tài khoản, sửa cùng một schema, thấy hộp thoại xung đột |
| Safari với cookie `Secure` trên `http://localhost` | Mục 8 |
| Trình quản lý mật khẩu (WCAG 3.3.8) | Chrome: đăng ký thì trình duyệt đề xuất lưu mật khẩu; đăng nhập thì điền được email và mật khẩu đã lưu; dán mật khẩu từ clipboard được |

## 12. Triển khai

Roadmap chưa có bước deploy, trong khi lưu cloud cần backend và database chạy ở đâu đó.

Phát triển trước hoàn toàn ở local; chưa chọn nơi deploy. Khi cần triển khai, ưu tiên các gói miễn phí; phương án cụ thể được chọn và bổ sung vào mục này sau, trong phần 4 — không thêm phần 10 vào roadmap.

Tới lúc đó, phần 4 giao:

- Toàn bộ luồng chạy được ở local: `pnpm dev` (frontend cổng 3000, backend cổng 3001) với database Docker Postgres cục bộ (mục 10).
- e2e trên PostgreSQL 16 thật trong CI.
- Danh sách ràng buộc dưới đây, để phương án deploy chọn sau không phải đổi thiết kế auth.

Hệ quả: tới khi chọn và làm phương án deploy, chỉ developer chạy local mới dùng được tính năng tài khoản.

**Ràng buộc mà mọi phương án deploy phải thỏa:**

| Ràng buộc | Vì sao |
|---|---|
| Frontend và backend cùng site, dưới một domain riêng (ví dụ `app.<domain>` và `api.<domain>`), không dùng tên miền con cấp sẵn nằm trong Public Suffix List | Cookie `SameSite=Strict` (mục 1, 8) |
| Không có subdomain không tin cậy dưới cùng domain | Không dùng tiền tố `__Host-` (mục 1); `OriginGuard` chỉ tin `CORS_ORIGINS` |
| HTTPS cho cả frontend và backend | Cookie `Secure`; `crypto.randomUUID` cần secure context (spec phần 3) |
| Một instance backend, tới khi rate limit đổi store | Mục 3 |
| `TRUST_PROXY_HOPS` khớp số proxy của nền tảng | IP đúng cho rate limit |
| `prisma migrate deploy` chạy trước khi bản backend mới nhận request | `prisma.md` |
| Khi core tăng `version`, backend lên phiên bản mới trước frontend | Tránh `422 version-unsupported` (mục 5) |
| `JWT_ACCESS_SECRET`, `DATABASE_URL` chỉ nằm trong biến môi trường của nền tảng | `security.md` |
| RAM của backend đủ cho các lần băm argon2 đồng thời (19 MiB mỗi lần) | Mục 2; rate limit giới hạn số lần đăng nhập |

**Phương án deploy cụ thể:** chưa chọn. Ưu tiên gói miễn phí (ví dụ Vercel cho frontend; một dịch vụ chạy container hoặc PostgreSQL được quản lý có gói miễn phí cho backend và database); được chọn và viết vào mục này sau, khi cần triển khai.

## Cấu trúc thư mục

```text
packages/api-contract/
  package.json, tsconfig.json, tsconfig.build.json, vitest.config.ts
  src/
    index.ts
    auth.ts                    request, response của auth
    schemas.ts                 request, response của schemas
    errors.ts                  API_ERROR_CODES, ApiErrorBody
    limits.ts                  hằng giới hạn

backend/
  .env.example, .env.test.example
  prisma.config.ts
  vitest.e2e.config.ts
  prisma/
    schema.prisma
    migrations/
  src/
    main.ts
    app.module.ts
    app-setup.ts               configureApp
    config/                    env.ts, env.spec.ts
    generated/prisma/          do prisma generate sinh ra, gitignore
    prisma/                    prisma.module.ts, prisma.service.ts
    common/
      clock.ts
      api.exception.ts
      api-exception.filter.ts
      origin.guard.ts, jwt-auth.guard.ts
      public.decorator.ts, current-user.decorator.ts
    modules/
      health/                  health.module.ts, health.controller.ts
      rate-limit/              rate-limit.module.ts, rate-limit.guard.ts, rate-limit.decorator.ts, rate-limit.policy.ts
      auth/
        auth.module.ts, auth.controller.ts, auth.service.ts
        access-token.service.ts, refresh-token.service.ts, refresh-token.repository.ts
        users.repository.ts, users.mapper.ts
        jwt.strategy.ts, auth-cookies.ts, password-hasher.ts, password.policy.ts
        common-passwords.txt
        dto/                   register.dto.ts, login.dto.ts
      schemas/
        schemas.module.ts, schemas.controller.ts, schemas.service.ts, schemas.repository.ts
        schemas.mapper.ts, schema-list-cursor.ts
        dto/                   create-schema.dto.ts, update-schema.dto.ts, list-schemas-query.dto.ts
  test/
    global-setup.ts, create-test-app.ts, reset-database.ts
    auth.e2e-spec.ts, schemas.e2e-spec.ts, security.e2e-spec.ts

frontend/
  .env.example
  src/
    app/
      (auth)/sign-in/page.tsx
      (auth)/sign-up/page.tsx
    components/
      auth-provider.tsx, account-menu.tsx, sign-in-prompt.tsx, upload-prompt-host.tsx
    features/
      auth/components/         sign-in-screen.tsx, sign-up-screen.tsx, credentials-form.tsx
      schema-list/             thêm: các phần theo trạng thái auth, nhãn, hành động lưu lên cloud
      editor/                  thêm: trạng thái cloud trên toolbar, conflict-dialog.tsx,
                               deleted-in-cloud-dialog.tsx, hooks/use-cloud-pusher.ts
    lib/
      api/                     api-client.ts, api-failure.ts, session-refresher.ts, auth-lock-manager.ts
      auth/                    auth-store.ts, auth-hint-cookie.ts, auth-channel.ts, sanitize-return-to.ts
      sync/                    decide-open-action.ts, merge-schema-list.ts, cloud-pusher.ts,
                               upload-local-schemas.ts, sync-pending-schemas.ts, sign-out.ts,
                               documents-equal.ts
      storage/                 sửa: database.ts (version 2), records.ts, schema-repository.ts
      i18n/locales/{en,vi}/    thêm: auth.ts, sync.ts, api-errors.ts
```

- Người dùng chỉ phục vụ auth ở phần 4, nên repository và mapper của `User` nằm trong module `auth`, không có module `users` riêng. Tách ra khi phần sau cần.
- `features/auth`, `features/schema-list` và `features/editor` không import lẫn nhau. Phần dùng chung nằm ở `lib/` (API, auth, đồng bộ, lưu trữ) và `components/` (`SignInPrompt`, hộp thoại đưa schema lên).

## Vấn đề với các spec đã duyệt

Spec này không sửa tài liệu khác. Các điểm sau cần cập nhật khi spec được duyệt:

| # | Tài liệu | Hiện tại | Đề xuất |
|---|---|---|---|
| 1 | Danh sách tính năng, ST-03 | "backend validate bằng core trước khi lưu vào PostgreSQL và từ chối schema không hợp lệ kèm lý do" | "backend validate bằng core trước khi lưu vào PostgreSQL, từ chối tài liệu sai cấu trúc kèm lý do (mã lỗi và đường dẫn); tài liệu còn issue ngữ nghĩa vẫn được lưu". Spec phần 2 (mục 8) đã dự kiến phần 4 chốt cách viết này |
| 2 | Spec phần 1, "Điểm nối với các phần sau" | `prisma generate` trước `build` và `typecheck` | Task Turborepo `generate`, chạy trước cả `lint`, `test`, `test:e2e`, `dev` (mục 4) |
| 3 | Spec phần 1, quyết định 18 và tiêu chí "Repo chỉ có `backend/.env.example`" | Một file env mẫu | Thêm `frontend/.env.example` và `backend/.env.test.example` (mục 9) |
| 4 | Spec phần 1, CI | Một job `verify` | Thêm job `e2e` có PostgreSQL service container; job `verify` đặt `NEXT_PUBLIC_API_URL` giả cho `next build` (mục 9, 11) |
| 5 | Spec phần 3, mục 5 và 7 | Dexie version 1; `SaveStatus` chỉ cho lưu local; danh sách một phần | Dexie version 2 và bảng `session`; trạng thái cloud trên toolbar; danh sách có hai phần khi đã đăng nhập (mục 7) |
| 6 | Spec phần 3, mục 11 và tiêu chí ST-01 "Không có code gọi mạng" | Lint cấm gọi mạng trong cả `frontend/src/`; `connect-src 'self'` | Ngoại lệ lint cho `src/lib/api/**`; `connect-src` thêm origin backend (spec phần 3 đã dự kiến). Tiêu chí ST-01 đổi thành "khách không gọi mạng", kiểm bằng test tích hợp 7 ở mục 11 |
| 7 | `.claude/rules/nestjs.md` | Ví dụ "`UpdateSchemaDto` built with `PartialType`" | `PUT` thay toàn bộ tài liệu nên `UpdateSchemaDto` là class riêng. Rule nên ghi `PartialType` chỉ dành cho cập nhật từng phần |
| 8 | `.claude/rules/nestjs.md` | "No `process.env` outside `src/config/`" | `backend/prisma.config.ts` (cấu hình của Prisma CLI) đọc `process.env`. Rule nên nêu ngoại lệ cho file cấu hình tool |
| 9 | `architecture.md`, "Auth: Passport + JWT" | — | Không mâu thuẫn; ghi rõ JWT chỉ dùng cho access token, còn refresh token là chuỗi ngẫu nhiên lưu hash |
| 10 | Spec phần 7 (đang viết) | Import tạo schema mới | Khi đã đăng nhập, schema import được tạo qua đường "Tạo" ở mục 7 (có chủ, `pending`, được đẩy lên cloud) |
| 11 | Spec này, mục "Rủi ro cần kiểm tra khi triển khai", dòng `class-transformer` (phát hiện khi làm Task 14 của plan, chốt 2026-09-25) | `document` đi qua `ValidationPipe` không bị đổi, "không mất trường"; nếu bị đổi thì loại `document` khỏi bước transform | `class-transformer` (`transform: true`) deep-clone `document` và âm thầm bỏ own key `__proto__` trước khi service thấy payload, nên backend không trả `invalid-shape` như `parseSchemaDocument` của core mà lưu tài liệu đã mất khóa đó. Chấp nhận, không loại `document` khỏi transform: prototype không bị đổi (không có prototype pollution), tài liệu lưu xuống vẫn hợp lệ, chỉ dữ liệu của chính người gửi bị ảnh hưởng và phải bỏ qua frontend mới gửi được khóa này. Test `drops a __proto__ key without changing the prototype` trong `backend/src/modules/schemas/dto/schema-dtos.spec.ts` khẳng định hành vi |

## Rủi ro cần kiểm tra khi triển khai

- **Dist-tag `latest` của Prisma là 8.0.0-rc.15.** `pnpm add prisma` không ghi phiên bản sẽ cài bản RC. Plan ghi rõ `7.10.0` cho `prisma`, `@prisma/client`, `@prisma/adapter-pg`. Nâng lên Prisma 8 là một thay đổi riêng sau khi bản 8 phát hành chính thức.
- **`prisma generate` khi không có `DATABASE_URL`** (job `verify` của CI): xác nhận `prisma.config.ts` không báo lỗi; nếu có thì dùng giá trị rỗng khi chỉ chạy `generate` (mục 4).
- **Client sinh ra với toolchain của repo:** `nest build` (`tsc`, `module: nodenext`), Vitest, ESLint có type (`projectService`) và `verbatimModuleSyntax` đều phải đọc được `src/generated/prisma` với `importFileExtension = "js"`.
- **Metadata của `P2002` với driver adapter:** với `@prisma/adapter-pg`, thông tin trường vi phạm có thể không nằm ở `meta.target` như khi dùng query engine cũ. Plan xác nhận filter tìm được model và trường để chọn mã lỗi.
- **Kiểu `Json` của Prisma và `SchemaDocument` readonly:** gán vào `InputJsonValue` có thể cần một hàm chuyển có kiểu, không dùng `as` (`typescript.md`).
- **`prisma dev`:** giới hạn một kết nối với pool của `PrismaPg`; connection string của instance có tên có thật sự cố định qua các lần khởi động không; `migrate dev` với `SHADOW_DATABASE_URL`; dependency lồng như `@prisma/dev` có cần mục trong `allowBuilds` không.
- **`class-transformer` với `transform: true`:** `document` phải đi qua `ValidationPipe` không bị đổi (không mất trường, không đổi prototype, khóa như `__proto__` không gây hại). e2e so sánh sâu tài liệu gửi lên và tài liệu đọc lại; nếu bị đổi thì loại `document` khỏi bước transform. Kết quả khi triển khai: own key `__proto__` bị bỏ, được chấp nhận, xem điểm 11 của mục "Vấn đề với các spec đã duyệt".
- **Lỗi của body parser trong NestJS 12 và Express 5:** xác nhận `entity.too.large` và `entity.parse.failed` tới được `ApiExceptionFilter`, và `useBodyParser` hoạt động với `bodyParser: false`.
- **`Cross-Origin-Resource-Policy: same-site` với fetch CORS:** xác nhận frontend ở origin khác đọc được response.
- **Safari và cookie `Secure` trên `http://localhost`:** nếu không nhận thì hướng dẫn `AUTH_COOKIE_SECURE=false` trong README (mục 8).
- **`@nestjs/throttler`:** nếu có bản hỗ trợ NestJS 12 trước khi lập plan, cân nhắc lại mục 3 bằng cách sửa spec, không đổi âm thầm trong plan.
- **Liệt kê route bằng `DiscoveryService`** cho e2e 12: xác nhận lấy được method và path của mọi handler trong NestJS 12.
- **Web Locks và `BroadcastChannel`** chỉ có bản giả trong jsdom; race refresh giữa hai tab thật được kiểm tra tay (mục 11).
- **JSONB sắp lại khóa:** mọi phép so sánh tài liệu dùng so sánh sâu (`documents-equal`), không so chuỗi JSON.
- **Bộ nhớ khi băm:** mỗi lần băm argon2 dùng 19 MiB; 30 lần đăng nhập đồng thời khoảng 570 MiB. Rate limit giới hạn số lần theo IP, nhưng deploy vẫn phải chọn RAM phù hợp (mục 12).

## Tiêu chí hoàn thành

Tiêu chí ghi "(kiểm tra tay)" được kiểm tra theo checklist ở mục 11; các tiêu chí còn lại có test tự động (unit, e2e hoặc tích hợp, số thứ tự theo mục 11).

**ST-02. Đăng ký, đăng nhập**

- [ ] Đăng ký bằng email và mật khẩu, dùng được ngay mà không cần xác minh email; cookie có `HttpOnly`, `Secure`, `SameSite=Strict` và đúng `Path` (e2e 1).
- [ ] Đăng nhập và đăng xuất; sau khi đăng xuất, `me` trả `401` và refresh token cũ không dùng được (e2e 1, 3).
- [ ] Đăng nhập sai email hoặc sai mật khẩu cho cùng một response (e2e 2); mật khẩu quá ngắn, quá dài, hoặc nằm trong danh sách phổ biến bị từ chối với thông báo đã dịch.
- [ ] Lần đăng nhập thứ 11 trong 15 phút cho cùng email, và lần đăng ký thứ 6 trong một giờ từ cùng IP, trả `429` kèm `Retry-After` (e2e 11).
- [ ] Refresh xoay token; dùng lại token đã xoay thì thu hồi cả họ (e2e 3); hai tab cùng gặp access token hết hạn không bị đăng xuất (unit test `session-refresher`; kiểm tra tay).
- [ ] Khi chưa đăng nhập, "Lưu lên cloud" mở `SignInPrompt`; đăng nhập xong quay về đúng trang qua `returnTo`, và `returnTo` trỏ ra ngoài bị bỏ qua. Editor và các tính năng không cần tài khoản vẫn dùng bình thường.
- [ ] Đăng nhập không làm mất schema trên trình duyệt: schema của khách vẫn còn, và người dùng được hỏi có đưa lên cloud không (tích hợp 1).
- [ ] Khách không có cookie gợi ý không gọi mạng lần nào trong các hành trình của phần 3 (tích hợp 7).

**ST-03. Lưu cloud**

- [ ] Backend validate bằng `parseSchemaDocument` trước khi lưu vào PostgreSQL, từ chối tài liệu sai cấu trúc bằng `422` kèm `code` và `path`; tài liệu còn issue ngữ nghĩa vẫn được lưu (e2e 6). Tài liệu đọc từ database cũng đi qua `parseSchemaDocument`.
- [ ] Sau khi đăng nhập, mỗi lần lưu local được đẩy lên cloud với `expectedRevision`; offline thì hiện "Chưa đồng bộ" và tự đẩy khi có mạng (tích hợp 2).
- [ ] Mở được schema đã lưu từ thiết bị khác: database trống, đã đăng nhập, danh sách có schema từ cloud và mở ra đúng tài liệu (tích hợp 4); hai trình duyệt thật: kiểm tra tay.
- [ ] Sau lần đăng nhập đầu tiên trên trình duyệt có schema local, người dùng được hỏi đưa schema nào lên cloud; schema không chọn vẫn ở lại trình duyệt (tích hợp 1).
- [ ] Revision lệch trả `409` kèm `currentRevision`, và hai `PUT` đồng thời chỉ một thành công (e2e 4, 7). Frontend mở hộp thoại; cả "Giữ bản trên máy này" và "Dùng bản trên cloud" cho kết quả đúng (tích hợp 3).
- [ ] Body quá 2 MiB bị từ chối trước khi parse (`413`); schema thứ 101 của một tài khoản bị từ chối (`403`) (e2e 9, 14).
- [ ] Dexie nâng từ version 1 lên version 2 không mất dữ liệu (unit test).

**ST-04. Danh sách schema trên cloud**

- [ ] Danh sách cloud phân trang theo keyset, tối đa 100 mỗi trang (e2e 8). Màn hình danh sách gộp schema trên cloud với cache, có nhãn trạng thái, và vẫn hiện cache khi không tải được danh sách cloud.
- [ ] Mở và xóa từng schema từ danh sách; xóa cần mạng và xóa cả cache (tích hợp 5).
- [ ] Người dùng chỉ thấy và thao tác được schema của mình; schema của người khác trả `404` (e2e 5).

**Bảo mật và chung**

- [ ] Mọi route ngoài năm route public trả `401` khi không có cookie (e2e 12).
- [ ] Request thay đổi dữ liệu không có `Origin` hợp lệ trả `403`; CORS chỉ cho `CORS_ORIGINS` (e2e 10).
- [ ] Response có header của Helmet; lỗi không lộ stack, SQL hay lỗi Prisma (e2e 13).
- [ ] Không có token trong `localStorage`, IndexedDB hay cookie đọc được bằng JavaScript; `sf-auth-hint` chỉ chứa `1`.
- [ ] Backend từ chối khởi động khi thiếu `DATABASE_URL`, `JWT_ACCESS_SECRET`, `CORS_ORIGINS`, hoặc khi production có `AUTH_COOKIE_SECURE=false`, origin `http`, hay secret mẫu (unit test `env`).
- [ ] `pnpm install --frozen-lockfile` từ bản clone sạch không còn cảnh báo build script bị chặn; `pnpm lint`, `pnpm typecheck`, `pnpm test` (đạt ngưỡng coverage) và `pnpm build` chạy qua ở local và CI; job `e2e` xanh trên CI.
- [ ] Form đăng nhập, đăng ký đạt WCAG 2.2 AA theo mục 6: `autoComplete` đúng, dán được vào ô mật khẩu, không có ô nhập lại mật khẩu, lỗi từ server không xóa giá trị đã nhập, không có CAPTCHA (test component); trình quản lý mật khẩu của Chrome lưu và điền được (kiểm tra tay).
- [ ] Mọi chuỗi mới có `vi` và `en`; `apiErrors` phủ đủ `ApiErrorCode` (typecheck).
- [ ] Checklist kiểm tra tay ở mục 11 đã chạy xong, kết quả ghi vào PR.
- [ ] `architecture.md`, `roadmap.md` và danh sách tính năng (cách viết ST-03) được cập nhật theo mục [Vấn đề với các spec đã duyệt](#vấn-đề-với-các-spec-đã-duyệt).

## Phạm vi

**Trong phạm vi:** ST-02, ST-03, ST-04; endpoint health; Helmet, CORS, `ValidationPipe`, exception filter, guard xác thực, `OriginGuard`, rate limit; Prisma, migration đầu tiên; `packages/api-contract`; API client, auth store, màn hình đăng nhập và đăng ký, `SignInPrompt`; Dexie version 2 và đồng bộ; e2e backend và job CI `e2e`.

**Ngoài phạm vi:**

| Hạng mục | Làm ở |
|---|---|
| Chia sẻ link, lịch sử phiên bản | Phần 8 |
| AI Assistant (dùng lại guard, rate limit, `SignInPrompt`) | Phần 5 |
| Deploy | Phần 10 được đề xuất (mục 12) |
| Quên mật khẩu, đổi mật khẩu, xác minh email, đổi email | Chưa có trong roadmap (câu hỏi 12 của danh sách tính năng) |
| Đăng nhập bằng Google, GitHub, passkey; xác thực hai lớp | Chưa có trong roadmap |
| Xóa tài khoản, "đăng xuất khỏi mọi thiết bị" | Chưa có trong roadmap |
| Cộng tác thời gian thực, tự merge khi xung đột | Chưa có trong roadmap |
| Tài liệu OpenAPI | Khi có client khác frontend (mục 5) |

## Câu hỏi đã trả lời

Mỗi câu ứng với một mục từng đánh dấu ⚠ trong spec. Người dùng xác nhận khi duyệt spec.

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Mật khẩu tối thiểu 8 ký tự kèm danh sách mật khẩu phổ biến, hay 15 ký tự theo NIST SP 800-63B bản 4 (mục 2)? | 8 ký tự kèm danh sách |
| 2 | Bộ đếm rate limit nằm trong bộ nhớ (chỉ đúng với một instance), hay dùng Redis ngay từ đầu (mục 3)? | Trong bộ nhớ |
| 3 | Giới hạn 100 schema mỗi tài khoản, không giới hạn, hay giới hạn theo dung lượng (mục 5)? | 100 schema |
| 4 | Thêm package `packages/api-contract` cho hợp đồng giữa frontend và backend (mục 5)? | Có |
| 5 | Đăng xuất xóa cache của tài khoản khỏi trình duyệt, hay giữ lại và ẩn đi (mục 7)? | Xóa, có cảnh báo khi còn thay đổi chưa đồng bộ |
| 6 | PostgreSQL local bằng container Docker sẵn có, `prisma dev`, hay Homebrew `postgresql@18` (mục 10)? | Container Docker sẵn có trên máy dev; `prisma dev` là phương án thay thế khi không có Docker |
| 7 | Hoãn deploy sang phần 10 mới, hay có mục tiêu deploy tối thiểu ngay trong phần 4 (mục 12)? | Không hoãn và không thêm phần 10 vào roadmap, nhưng cũng chưa chọn nơi deploy ngay: phát triển trước ở local, phương án deploy (ưu tiên gói miễn phí) được chọn trong phần 4, ở một bước sau |
| 8 | Hộp thoại xung đột có thêm lựa chọn thứ ba "Giữ cả hai" (lưu bản trên máy thành schema mới với id mới) không? | Không thêm, vì quyết định đã chốt chỉ nêu việc chọn một trong hai bản; thêm sau không đổi thiết kế đồng bộ |
