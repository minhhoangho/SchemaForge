import { describe, expect, it } from "vitest";

import type { ColumnDefault } from "../model/column-default.js";
import type { ColumnType } from "../model/column-type.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "../testing/factories.js";
import { createLargeSchema } from "../testing/large-schema.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { describeSchemaForAi } from "./describe-schema-for-ai.js";

// Spec section 5: the compact view keeps one column at about 50 to 60
// characters, which is what makes AI_MAX_SCHEMA_PROMPT_LENGTH hold ~1300 columns.
const MAX_CHARACTERS_PER_COLUMN = 60;
const LARGE_TABLE_COUNT = 75;
const LARGE_COLUMN_COUNT = 1500;

function describeColumn(
  type: ColumnType,
  defaultValue: ColumnDefault | null = null,
): unknown {
  const schema = buildSchema({
    tables: [makeTable({ id: "tbl_t" })],
    columns: [
      makeColumn({ id: "col_c", tableId: "tbl_t", type, defaultValue }),
    ],
    enums: [makeEnum({ id: "enum_order_status" })],
  });
  return describeSchemaForAi(schema).tables[0]?.columns[0];
}

describe("describeSchemaForAi", () => {
  it("matches the snapshot of the sample schema view", () => {
    expect(describeSchemaForAi(createSampleSchema())).toMatchInlineSnapshot(`
      {
        "enums": [
          {
            "name": "order_status",
            "values": [
              "pending",
              "paid",
              "shipped",
            ],
          },
        ],
        "name": "Sample",
        "relations": [
          {
            "from": "order_items(tenant_id,order_number)",
            "kind": "oneToMany",
            "onDelete": "cascade",
            "onUpdate": "noAction",
            "to": "orders(tenant_id,order_number)",
          },
          {
            "from": "orders(user_id)",
            "kind": "oneToMany",
            "onDelete": "noAction",
            "onUpdate": "noAction",
            "to": "users(id)",
          },
          {
            "from": "user_profiles(user_id)",
            "kind": "oneToOne",
            "onDelete": "cascade",
            "onUpdate": "noAction",
            "to": "users(id)",
          },
          {
            "from": "user_tags(users_id)",
            "kind": "oneToMany",
            "onDelete": "cascade",
            "onUpdate": "noAction",
            "to": "users(id)",
          },
          {
            "from": "user_tags(tags_id)",
            "kind": "oneToMany",
            "onDelete": "cascade",
            "onUpdate": "noAction",
            "to": "tags(id)",
          },
          {
            "from": "users(tenant_id)",
            "kind": "oneToMany",
            "onDelete": "cascade",
            "onUpdate": "noAction",
            "to": "tenants(id)",
          },
          {
            "from": "users(manager_id)",
            "kind": "oneToMany",
            "onDelete": "setNull",
            "onUpdate": "noAction",
            "to": "users(id)",
          },
        ],
        "tables": [
          {
            "columns": [
              {
                "name": "tenant_id",
                "type": "uuid",
              },
              {
                "name": "order_number",
                "type": "integer",
              },
              {
                "name": "line_number",
                "type": "integer",
              },
              {
                "default": "1",
                "name": "quantity",
                "type": "integer",
              },
            ],
            "indexes": [],
            "name": "order_items",
            "primaryKey": [
              "tenant_id",
              "order_number",
              "line_number",
            ],
          },
          {
            "columns": [
              {
                "name": "tenant_id",
                "type": "uuid",
              },
              {
                "name": "order_number",
                "type": "integer",
              },
              {
                "default": "pending",
                "name": "status",
                "type": "enum order_status",
              },
              {
                "default": "0.00",
                "name": "total",
                "type": "decimal(12,2)",
              },
              {
                "name": "user_id",
                "type": "bigint",
              },
            ],
            "indexes": [],
            "name": "orders",
            "primaryKey": [
              "tenant_id",
              "order_number",
            ],
          },
          {
            "columns": [
              {
                "name": "id",
                "type": "uuid",
              },
            ],
            "indexes": [],
            "name": "tags",
            "primaryKey": [
              "id",
            ],
          },
          {
            "columns": [
              {
                "default": "UUID()",
                "name": "id",
                "type": "uuid",
              },
            ],
            "indexes": [],
            "name": "tenants",
            "primaryKey": [
              "id",
            ],
          },
          {
            "columns": [
              {
                "name": "user_id",
                "type": "bigint",
              },
              {
                "name": "bio",
                "nullable": true,
                "type": "text",
              },
            ],
            "indexes": [],
            "name": "user_profiles",
            "primaryKey": [
              "user_id",
            ],
          },
          {
            "columns": [
              {
                "name": "users_id",
                "type": "bigint",
              },
              {
                "name": "tags_id",
                "type": "uuid",
              },
              {
                "default": "CURRENT_TIMESTAMP",
                "name": "assigned_at",
                "type": "timestamptz",
              },
            ],
            "indexes": [],
            "name": "user_tags",
            "primaryKey": [
              "users_id",
              "tags_id",
            ],
          },
          {
            "columns": [
              {
                "autoIncrement": true,
                "name": "id",
                "type": "bigint",
              },
              {
                "name": "tenant_id",
                "type": "uuid",
              },
              {
                "name": "email",
                "type": "varchar(255)",
              },
              {
                "name": "manager_id",
                "nullable": true,
                "type": "bigint",
              },
              {
                "default": "CURRENT_TIMESTAMP",
                "name": "created_at",
                "type": "timestamptz",
              },
              {
                "name": "location",
                "nullable": true,
                "type": "custom geometry(Point, 4326)",
              },
            ],
            "indexes": [
              {
                "columns": [
                  "tenant_id",
                  "email",
                ],
                "name": "users_tenant_id_email_key",
                "unique": true,
              },
            ],
            "name": "users",
            "primaryKey": [
              "id",
            ],
          },
        ],
      }
    `);
  });

  it("omits ids, positions, subject areas and notes", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_users",
          position: { x: 120, y: 340 },
          subjectAreaId: "area_sales",
        }),
      ],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_users" })],
      subjectAreas: [makeSubjectArea({ id: "area_sales" })],
      notes: [makeNote({ id: "note_1", text: "remember" })],
    });

    const text = JSON.stringify(describeSchemaForAi(schema));

    expect(
      [
        "tbl_",
        "col_",
        "area_",
        "note_",
        "sales",
        "remember",
        "120",
        "340",
      ].filter((fragment) => text.includes(fragment)),
    ).toStrictEqual([]);
  });

  it("omits fields that hold their default", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_users" })],
    });

    expect(describeSchemaForAi(schema).tables).toStrictEqual([
      {
        name: "users",
        columns: [{ name: "id", type: "integer" }],
        primaryKey: [],
        indexes: [],
      },
    ]);
  });

  it("keeps fields that differ from their default", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_users",
          comment: "People",
          primaryKeyColumnIds: ["col_id"],
        }),
      ],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          isNullable: true,
          isUnique: true,
          isAutoIncrement: true,
          defaultValue: { kind: "literal", value: "7" },
          comment: "Key",
        }),
      ],
    });

    expect(describeSchemaForAi(schema).tables).toStrictEqual([
      {
        name: "users",
        comment: "People",
        columns: [
          {
            name: "id",
            type: "integer",
            nullable: true,
            unique: true,
            autoIncrement: true,
            default: "7",
            comment: "Key",
          },
        ],
        primaryKey: ["id"],
        indexes: [],
      },
    ]);
  });

  it.each<[ColumnType, string]>([
    [{ kind: "varchar", length: 255 }, "varchar(255)"],
    [{ kind: "char", length: 2 }, "char(2)"],
    [{ kind: "decimal", precision: 10, scale: 2 }, "decimal(10,2)"],
    [{ kind: "enum", enumId: "enum_order_status" }, "enum order_status"],
    [
      { kind: "custom", name: "geometry(Point, 4326)" },
      "custom geometry(Point, 4326)",
    ],
    [{ kind: "timestamptz" }, "timestamptz"],
  ])("formats the type %j as %s", (type, formatted) => {
    expect(describeColumn(type)).toMatchObject({ type: formatted });
  });

  it("quotes an enum name that is not a plain identifier", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t" })],
      columns: [
        makeColumn({
          id: "col_c",
          tableId: "tbl_t",
          type: { kind: "enum", enumId: "enum_s" },
        }),
      ],
      enums: [makeEnum({ id: "enum_s", name: "order status" })],
    });

    expect(describeSchemaForAi(schema).tables[0]?.columns[0]?.type).toBe(
      'enum "order status"',
    );
  });

  it.each<[ColumnDefault, string]>([
    [{ kind: "literal", value: "pending" }, "pending"],
    [{ kind: "literal", value: "" }, ""],
    [{ kind: "currentTimestamp" }, "CURRENT_TIMESTAMP"],
    [{ kind: "generateUuid" }, "UUID()"],
  ])("formats the default %j as %j", (defaultValue, formatted) => {
    expect(describeColumn({ kind: "text" }, defaultValue)).toMatchObject({
      default: formatted,
    });
  });

  it("lists enums with their values", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({ id: "enum_b", name: "status", values: ["a", "b"] }),
        makeEnum({ id: "enum_a", name: "Kind", values: ["x"] }),
      ],
    });

    expect(describeSchemaForAi(schema).enums).toStrictEqual([
      { name: "Kind", values: ["x"] },
      { name: "status", values: ["a", "b"] },
    ]);
  });

  it("lists a table's indexes by name with their column names", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" }), makeTable({ id: "tbl_other" })],
      columns: [
        makeColumn({ id: "col_email", tableId: "tbl_users" }),
        makeColumn({ id: "col_name", tableId: "tbl_users" }),
        makeColumn({ id: "col_x", tableId: "tbl_other" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_z",
          tableId: "tbl_users",
          columnIds: ["col_name", "col_email"],
        }),
        makeIndex({
          id: "idx_a",
          tableId: "tbl_users",
          columnIds: ["col_email"],
          isUnique: true,
        }),
        makeIndex({
          id: "idx_other",
          tableId: "tbl_other",
          columnIds: ["col_x"],
        }),
      ],
    });

    expect(describeSchemaForAi(schema).tables[1]?.indexes).toStrictEqual([
      { name: "a", columns: ["email"], unique: true },
      { name: "z", columns: ["name", "email"], unique: false },
    ]);
  });

  it("quotes a table name with a parenthesis in relation endpoints", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders", name: "orders (2024)" }),
        makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_id"] }),
      ],
      columns: [
        makeColumn({ id: "col_id", tableId: "tbl_users" }),
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_orders",
          name: "user id",
        }),
        makeColumn({ id: "col_tenant", tableId: "tbl_orders" }),
        makeColumn({ id: "col_key", tableId: "tbl_users" }),
      ],
      relations: [
        makeRelation({
          id: "rel_1",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_user_id", toColumnId: "col_id" },
            { fromColumnId: "col_tenant", toColumnId: "col_key" },
          ],
          kind: "oneToOne",
          onDelete: "cascade",
          onUpdate: "restrict",
        }),
      ],
    });

    expect(describeSchemaForAi(schema).relations).toStrictEqual([
      {
        from: '"orders (2024)"("user id",tenant)',
        to: "users(id,key)",
        kind: "oneToOne",
        onDelete: "cascade",
        onUpdate: "restrict",
      },
    ]);
  });

  it("stays within 60 characters per column on the 1500-column fixture", () => {
    const schema = createLargeSchema({ tableCount: LARGE_TABLE_COUNT });

    const length = JSON.stringify(describeSchemaForAi(schema)).length;

    expect(Object.keys(schema.columns)).toHaveLength(LARGE_COLUMN_COUNT);
    expect(length / LARGE_COLUMN_COUNT).toBeLessThanOrEqual(
      MAX_CHARACTERS_PER_COLUMN,
    );
  });
});
