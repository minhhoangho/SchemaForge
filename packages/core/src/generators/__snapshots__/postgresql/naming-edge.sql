CREATE TYPE "trạng thái đơn" AS ENUM ('chờ xử lý', 'đã giao', 'it''s "quoted"', 'ma', 'má', 'a\b', '*/ end');

CREATE TABLE "2fa codes" (
  "code" varchar(6) NOT NULL,
  "__proto__" text,
  CONSTRAINT "2fa codes_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "bảng có tên dài đúng sáu mươi ba byte theo utf-8 nhé" (
  "id" integer NOT NULL,
  "mã duy nhất" varchar(20) NOT NULL,
  CONSTRAINT "bảng có tên dài đúng sáu mươi ba byte theo u_1d4944bb" PRIMARY KEY ("id"),
  CONSTRAINT "bảng có tên dài đúng sáu mươi ba byte theo u_0037e4e1" UNIQUE ("mã duy nhất")
);

CREATE TABLE "người dùng" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "họ tên" varchar(100),
  "USER_ID" integer NOT NULL,
  "ma" text NOT NULL,
  "má" text NOT NULL,
  "ghi chú" varchar(50) NOT NULL DEFAULT 'it''s a\b',
  CONSTRAINT "người dùng_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "người dùng_ma_key" UNIQUE ("ma"),
  CONSTRAINT "người dùng_má_key_2" UNIQUE ("má")
);

CREATE TABLE "order" (
  "id" integer NOT NULL,
  "select" text NOT NULL,
  "group" integer NOT NULL,
  "người dùng id" uuid NOT NULL,
  "updated_by" uuid,
  "trạng thái" "trạng thái đơn" NOT NULL DEFAULT 'chờ xử lý',
  CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order items" (
  "id" integer NOT NULL,
  CONSTRAINT "order items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
  "id" integer NOT NULL,
  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tên ""lạ"" `x` [y] 'z' \ w" (
  "id" integer NOT NULL,
  "tên ""lạ"" `x` [y] 'z' \ w" text NOT NULL,
  CONSTRAINT "tên ""lạ"" `x` [y] 'z' \ w_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "用户" (
  "id" integer NOT NULL,
  "名字" text NOT NULL,
  CONSTRAINT "用户_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chỉ mục ""họ tên""" ON "người dùng" ("họ tên");

ALTER TABLE "order" ADD CONSTRAINT "order_người dùng id_fkey" FOREIGN KEY ("người dùng id") REFERENCES "người dùng" ("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "order" ADD CONSTRAINT "order_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "người dùng" ("id") ON DELETE SET NULL ON UPDATE NO ACTION;

COMMENT ON TABLE "người dùng" IS 'Người dùng: it''s "quoted", `ticked` [bracketed] a\b */ end
-- ; DROP TABLE x';
COMMENT ON COLUMN "người dùng"."họ tên" IS 'trướcsau';
