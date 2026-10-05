import type { SchemaDocument } from "../../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../../testing/factories.js";
import { createSampleSchema } from "../../../testing/sample-schema.js";

// Written in the shape `prisma db pull` gives for the databases that the
// PostgreSQL and MySQL DDL of the sample schema create: models named after
// tables in name order, enums last, actions written only where they differ
// from Prisma's defaults, and constraint names only where they differ from
// Prisma's default names.

export const DB_PULL_POSTGRESQL = `generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model order_items {
  tenant_id    String @db.Uuid
  order_number Int
  line_number  Int
  quantity     Int    @default(1)
  orders       orders @relation(fields: [tenant_id, order_number], references: [tenant_id, order_number], onDelete: Cascade, onUpdate: NoAction)

  @@id([tenant_id, order_number, line_number])
}

model orders {
  tenant_id    String        @db.Uuid
  order_number Int
  status       order_status  @default(pending)
  total        Decimal       @default(0.00) @db.Decimal(12, 2)
  user_id      BigInt
  order_items  order_items[]
  users        users         @relation(fields: [user_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@id([tenant_id, order_number])
}

model tags {
  id        String      @id @db.Uuid
  user_tags user_tags[]
}

model tenants {
  id    String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  users users[]
}

model user_profiles {
  user_id BigInt  @id
  bio     String?
  users   users   @relation(fields: [user_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}

model user_tags {
  users_id    BigInt
  tags_id     String   @db.Uuid
  assigned_at DateTime @default(now()) @db.Timestamptz(6)
  tags        tags     @relation(fields: [tags_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users       users    @relation(fields: [users_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@id([users_id, tags_id])
}

model users {
  id            BigInt                                 @id @default(autoincrement())
  tenant_id     String                                 @db.Uuid
  email         String                                 @db.VarChar(255)
  manager_id    BigInt?
  created_at    DateTime                               @default(now()) @db.Timestamptz(6)
  location      Unsupported("geometry(Point, 4326)")?
  orders        orders[]
  user_profiles user_profiles?
  user_tags     user_tags[]
  users         users?                                 @relation("usersTousers", fields: [manager_id], references: [id], onUpdate: NoAction)
  other_users   users[]                                @relation("usersTousers")
  tenants       tenants                                @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@unique([tenant_id, email])
}

enum order_status {
  pending
  paid
  shipped
}
`;

// The tenants, users and orders tables of the sample schema on MySQL. InnoDB
// adds an index for each foreign key that no other index leads with.
export const DB_PULL_MYSQL = `generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "mysql"
}

model orders {
  tenant_id    String        @db.Char(36)
  order_number Int
  status       orders_status @default(pending)
  total        Decimal       @default(0.00) @db.Decimal(12, 2)
  user_id      BigInt
  users        users         @relation(fields: [user_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@id([tenant_id, order_number])
  @@index([user_id], map: "orders_user_id_fkey")
}

model tenants {
  id    String  @id @default(dbgenerated("(uuid())")) @db.Char(36)
  users users[]
}

model users {
  id          BigInt                @id @default(autoincrement())
  tenant_id   String                @db.Char(36)
  email       String                @db.VarChar(255)
  manager_id  BigInt?
  created_at  DateTime              @default(now()) @db.Timestamp(6)
  location    Unsupported("point")?
  orders      orders[]
  tenants     tenants               @relation(fields: [tenant_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  users       users?                @relation("usersTousers", fields: [manager_id], references: [id], onUpdate: NoAction)
  other_users users[]               @relation("usersTousers")

  @@unique([tenant_id, email])
  @@index([manager_id], map: "users_manager_id_fkey")
}

enum orders_status {
  pending
  paid
  shipped
}
`;

/**
 * What a Prisma schema can hold of `schema`: Prisma has no schema name,
 * subject areas or notes, so the name becomes `name` and the rest is dropped.
 */
export function withoutPrismaLosses(
  schema: SchemaDocument,
  name: string,
): SchemaDocument {
  return buildSchema({
    name,
    tables: Object.values(schema.tables).map((table) => ({
      ...table,
      subjectAreaId: null,
    })),
    columns: Object.values(schema.columns),
    relations: Object.values(schema.relations),
    indexes: Object.values(schema.indexes),
    enums: Object.values(schema.enums),
  });
}

// The importer names a document after ImportOptions.fallbackSchemaName.
const IMPORTED_NAME = "Imported";

export const DB_PULL_POSTGRESQL_EXPECTED: SchemaDocument = withoutPrismaLosses(
  createSampleSchema(),
  IMPORTED_NAME,
);

function createMysqlExpected(): SchemaDocument {
  const char36 = { kind: "char", length: 36 } as const;
  const bigint = { kind: "bigint" } as const;
  return buildSchema({
    name: IMPORTED_NAME,
    enums: [
      makeEnum({
        id: "enum_status",
        name: "orders_status",
        values: ["pending", "paid", "shipped"],
      }),
    ],
    tables: [
      makeTable({
        id: "tbl_orders",
        primaryKeyColumnIds: ["col_orders_tenant", "col_orders_number"],
      }),
      makeTable({ id: "tbl_tenants", primaryKeyColumnIds: ["col_tenants_id"] }),
      makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
    ],
    columns: [
      makeColumn({
        id: "col_orders_tenant",
        tableId: "tbl_orders",
        name: "tenant_id",
        type: char36,
      }),
      makeColumn({
        id: "col_orders_number",
        tableId: "tbl_orders",
        name: "order_number",
      }),
      makeColumn({
        id: "col_orders_status",
        tableId: "tbl_orders",
        name: "status",
        type: { kind: "enum", enumId: "enum_status" },
        defaultValue: { kind: "literal", value: "pending" },
      }),
      makeColumn({
        id: "col_orders_total",
        tableId: "tbl_orders",
        name: "total",
        type: { kind: "decimal", precision: 12, scale: 2 },
        defaultValue: { kind: "literal", value: "0.00" },
      }),
      makeColumn({
        id: "col_orders_user",
        tableId: "tbl_orders",
        name: "user_id",
        type: bigint,
      }),
      makeColumn({
        id: "col_tenants_id",
        tableId: "tbl_tenants",
        name: "id",
        type: { kind: "uuid" },
        defaultValue: { kind: "generateUuid" },
      }),
      makeColumn({
        id: "col_users_id",
        tableId: "tbl_users",
        name: "id",
        type: bigint,
        isAutoIncrement: true,
      }),
      makeColumn({
        id: "col_users_tenant",
        tableId: "tbl_users",
        name: "tenant_id",
        type: char36,
      }),
      makeColumn({
        id: "col_users_email",
        tableId: "tbl_users",
        name: "email",
        type: { kind: "varchar", length: 255 },
      }),
      makeColumn({
        id: "col_users_manager",
        tableId: "tbl_users",
        name: "manager_id",
        type: bigint,
        isNullable: true,
      }),
      makeColumn({
        id: "col_users_created",
        tableId: "tbl_users",
        name: "created_at",
        type: { kind: "timestamptz" },
        defaultValue: { kind: "currentTimestamp" },
      }),
      makeColumn({
        id: "col_users_location",
        tableId: "tbl_users",
        name: "location",
        type: { kind: "custom", name: "point" },
        isNullable: true,
      }),
    ],
    indexes: [
      makeIndex({
        id: "idx_orders_user",
        tableId: "tbl_orders",
        name: "orders_user_id_fkey",
        columnIds: ["col_orders_user"],
      }),
      makeIndex({
        id: "idx_users_tenant_email",
        tableId: "tbl_users",
        name: "users_tenant_id_email_key",
        columnIds: ["col_users_tenant", "col_users_email"],
        isUnique: true,
      }),
      makeIndex({
        id: "idx_users_manager",
        tableId: "tbl_users",
        name: "users_manager_id_fkey",
        columnIds: ["col_users_manager"],
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_orders_users",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_orders_user", toColumnId: "col_users_id" },
        ],
      }),
      makeRelation({
        id: "rel_users_tenants",
        fromTableId: "tbl_users",
        toTableId: "tbl_tenants",
        columnPairs: [
          { fromColumnId: "col_users_tenant", toColumnId: "col_tenants_id" },
        ],
        onDelete: "cascade",
      }),
      makeRelation({
        id: "rel_users_manager",
        fromTableId: "tbl_users",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_users_manager", toColumnId: "col_users_id" },
        ],
        onDelete: "setNull",
      }),
    ],
  });
}

export const DB_PULL_MYSQL_EXPECTED: SchemaDocument = createMysqlExpected();
