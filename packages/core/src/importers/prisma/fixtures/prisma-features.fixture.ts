// Hand-written schemas covering every construct of the import / export spec,
// section 6. Each one passes `prisma validate` (conformance, plan Task 20), so
// constructs Prisma rejects (a missing back relation) are tested inline.

export const PRISMA_FEATURES_POSTGRESQL = `generator client {
  provider        = "prisma-client"
  output          = "../src/generated/prisma"
  previewFeatures = ["views"]
}

datasource db {
  provider = "postgresql"
}

/// Order states
enum Status {
  /// Waiting for payment
  pending @map("chờ xử lý")
  paid

  @@map("order_status")
}

/// Người dùng
/// second line
model User {
  id         Int      @id @default(autoincrement())
  /// Login email
  email      String   @unique(map: "user_email_key") @db.VarChar(255)
  externalId String   @default(uuid()) @map("external_id") @db.Uuid
  traceId    String   @default(uuid(7)) @map("trace_id") @db.Uuid
  publicId   String   @default(cuid()) @map("public_id")
  shortId    String   @default(nanoid()) @map("short_id")
  createdOn  DateTime @default(dbgenerated("CURRENT_DATE")) @map("created_on") @db.Date
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  seenAt     DateTime? @map("seen_at") @db.Timestamptz(3)
  updatedAt  DateTime @updatedAt @map("updated_at")
  balance    Decimal  @default(0) @db.Decimal(12, 2)
  score      Float    @default(1.5) @db.Real
  isActive   Boolean  @default(true) @map("is_active")
  nickname   String?  @db.Char(20)
  labels     String[]
  ip         String?  @db.Inet
  location   Unsupported("geometry(Point, 4326)")?
  legacy     Unsupported("int CHECK (legacy > 0)")?
  avatar     Bytes?
  settings   Json     @default("{}")
  hidden     Int?     @ignore
  posts      Post[]
  profile    Profile?

  @@index([createdAt(sort: Desc)], map: "user_created_at_idx")
  @@index([settings(ops: JsonbPathOps)], type: Gin)
  @@map("users")
}

model Profile {
  userId Int     @id @map("user_id")
  bio    String?
  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade, map: "profile_user_fk")

  @@map("profiles")
}

model Post {
  id       Int    @id @default(autoincrement())
  authorId Int    @map("author_id")
  slug     String @db.VarChar(100)
  status   Status @default(pending)
  author   User   @relation(fields: [authorId], references: [id], onUpdate: Restrict)
  tags     Tag[]

  @@unique([authorId, slug], map: "post_author_slug_key")
  @@unique([slug, status])
  @@index([authorId], type: Hash)
  @@map("posts")
}

model Tag {
  id    Int    @id
  posts Post[]
}

model Audit {
  message String

  @@ignore
}

view UserTotals {
  userId Int @unique
  total  Int
}
`;

export const PRISMA_FEATURES_MYSQL = `datasource db {
  provider = "mysql"
}

model Article {
  id    String @id @default(uuid()) @db.Char(36)
  views Int    @db.UnsignedInt
  title String @db.VarChar(200)
  body  String @db.Text

  @@fulltext([title, body])
  @@index([title(length: 10)])
}
`;

export const PRISMA_FEATURES_SQLSERVER = `datasource db {
  provider = "sqlserver"
}

model Ticket {
  id      Int     @id(sort: Desc, clustered: false) @default(autoincrement())
  code    String  @unique(sort: Desc) @db.NVarChar(50)
  notes   String  @db.NVarChar(Max)
  ref     String  @default(dbgenerated("newid()")) @db.UniqueIdentifier
  version Decimal

  @@index([code], clustered: true)
}
`;

export const PRISMA_FEATURES_MULTI_SCHEMA = `datasource db {
  provider = "postgresql"
  schemas  = ["public", "sales"]
}

enum Region {
  north
  south

  @@schema("sales")
}

model Store {
  id     Int    @id
  region Region

  @@schema("sales")
}
`;

export const PRISMA_FEATURES_MONGODB = `datasource db {
  provider = "mongodb"
}

type Address {
  street String
  city   String
}

model Customer {
  id      String   @id @default(auto()) @map("_id") @db.ObjectId
  name    String
  address Address?
}
`;
