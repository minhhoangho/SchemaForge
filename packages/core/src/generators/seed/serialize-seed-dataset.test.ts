import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import type { SqlDialect } from "../shared/generator-types.js";
import type { SeedDataset } from "./seed-dataset.js";
import { serializeSeedDataset } from "./serialize-seed-dataset.js";

function column(
  tableName: string,
  name: string,
  overrides: Partial<Column> = {},
): Column {
  return makeColumn({
    id: `col_${tableName}_${name}`,
    tableId: `tbl_${tableName}`,
    name,
    ...overrides,
  });
}

// users(id, name, email); the primary key is id.
const USERS_SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
  ],
  columns: [
    column("users", "id"),
    column("users", "name", { type: { kind: "text" } }),
    column("users", "email", { type: { kind: "text" }, isNullable: true }),
  ],
});

function content(
  schema: SchemaDocument,
  dataset: SeedDataset,
  format: SqlDialect | "json",
): string {
  return serializeSeedDataset(schema, dataset, format).content;
}

// a.b_id -> b.id is nullable and deferred: b is loaded after a.
function createCycleSchema(isSourceKeyed: boolean): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_a",
        primaryKeyColumnIds: isSourceKeyed ? ["col_a_id"] : [],
      }),
      makeTable({ id: "tbl_b", primaryKeyColumnIds: ["col_b_id"] }),
    ],
    columns: [
      column("a", "id"),
      column("a", "b_id", { isNullable: true }),
      column("b", "id"),
      column("b", "a_id"),
    ],
    relations: [
      makeRelation({
        id: "rel_a_b",
        fromTableId: "tbl_a",
        toTableId: "tbl_b",
        columnPairs: [{ fromColumnId: "col_a_b_id", toColumnId: "col_b_id" }],
      }),
      makeRelation({
        id: "rel_b_a",
        fromTableId: "tbl_b",
        toTableId: "tbl_a",
        columnPairs: [{ fromColumnId: "col_b_a_id", toColumnId: "col_a_id" }],
      }),
    ],
  });
}

const CYCLE_DATASET: SeedDataset = {
  tables: [
    {
      tableId: "tbl_a",
      rows: [
        { col_a_id: 1, col_a_b_id: 2 },
        { col_a_id: 2, col_a_b_id: null },
      ],
    },
    { tableId: "tbl_b", rows: [{ col_b_id: 2, col_b_a_id: 1 }] },
  ],
};

describe("serializeSeedDataset as json", () => {
  it("writes seed.json as an array of tables with original column names in column order", () => {
    const dataset: SeedDataset = {
      tables: [
        {
          tableId: "tbl_users",
          rows: [
            { col_users_email: null, col_users_name: "a", col_users_id: 1 },
          ],
        },
      ],
    };

    expect(content(USERS_SCHEMA, dataset, "json")).toBe(
      [
        "[",
        "  {",
        '    "table": "users",',
        '    "rows": [',
        "      {",
        '        "id": 1,',
        '        "name": "a",',
        '        "email": null',
        "      }",
        "    ]",
        "  }",
        "]",
        "",
      ].join("\n"),
    );
  });

  it("keeps a __proto__ column as an own property in json", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t" })],
      columns: [column("t", "__proto__")],
    });
    const dataset: SeedDataset = {
      tables: [{ tableId: "tbl_t", rows: [{ col_t___proto__: 7 }] }],
    };
    const parsed: unknown = JSON.parse(content(schema, dataset, "json"));
    // JSON.parse creates an own "__proto__" property; a literal would not.
    const expectedRow: unknown = JSON.parse('{"__proto__":7}');

    expect(parsed).toStrictEqual([{ table: "t", rows: [expectedRow] }]);
  });
});

describe("serializeSeedDataset as sql", () => {
  it("writes one INSERT per table in dataset order", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a" }), makeTable({ id: "tbl_b" })],
      columns: [column("a", "x"), column("b", "y")],
    });
    const dataset: SeedDataset = {
      tables: [
        { tableId: "tbl_b", rows: [{ col_b_y: 1 }, { col_b_y: 2 }] },
        { tableId: "tbl_a", rows: [{ col_a_x: 3 }] },
      ],
    };

    expect(content(schema, dataset, "postgresql")).toBe(
      [
        'INSERT INTO "b" ("y") VALUES',
        "  (1),",
        "  (2);",
        "",
        'INSERT INTO "a" ("x") VALUES',
        "  (3);",
        "",
      ].join("\n"),
    );
  });

  it("lists only columns present in some row and writes DEFAULT for missing keys", () => {
    const dataset: SeedDataset = {
      tables: [
        {
          tableId: "tbl_users",
          rows: [{ col_users_name: "a", col_users_id: 1 }, { col_users_id: 2 }],
        },
      ],
    };

    expect(content(USERS_SCHEMA, dataset, "sqlserver")).toBe(
      [
        "INSERT INTO [users] ([id], [name]) VALUES",
        "  (1, N'a'),",
        "  (2, DEFAULT);",
        "",
      ].join("\n"),
    );
  });

  it("splits more than 1000 rows into several INSERT statements", () => {
    const dataset: SeedDataset = {
      tables: [
        {
          tableId: "tbl_users",
          rows: Array.from({ length: 1001 }, (_row, index) => ({
            col_users_id: index + 1,
          })),
        },
      ],
    };
    const lines = content(USERS_SCHEMA, dataset, "mysql").split("\n");

    expect([
      lines.filter((line) => line.startsWith("INSERT INTO")).length,
      lines[1000],
      lines[1001],
      lines[1002],
    ]).toStrictEqual([
      2,
      "  (1000);",
      "INSERT INTO `users` (`id`) VALUES",
      "  (1001);",
    ]);
  });

  it.each<[SqlDialect, string]>([
    ["postgresql", 'INSERT INTO "users" DEFAULT VALUES;'],
    ["mysql", "INSERT INTO `users` () VALUES ();"],
    ["sqlserver", "INSERT INTO [users] DEFAULT VALUES;"],
  ])("writes DEFAULT VALUES for rows without columns (%s)", (dialect, line) => {
    const dataset: SeedDataset = {
      tables: [{ tableId: "tbl_users", rows: [{}, {}] }],
    };

    expect(content(USERS_SCHEMA, dataset, dialect)).toBe(`${line}\n${line}\n`);
  });

  it("wraps identity inserts in SET IDENTITY_INSERT on sqlserver", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", primaryKeyColumnIds: ["col_t_id"] })],
      columns: [column("t", "id", { isAutoIncrement: true })],
    });
    const dataset: SeedDataset = {
      tables: [{ tableId: "tbl_t", rows: [{ col_t_id: 1 }] }],
    };

    expect(content(schema, dataset, "sqlserver")).toBe(
      [
        "SET IDENTITY_INSERT [t] ON;",
        "INSERT INTO [t] ([id]) VALUES",
        "  (1);",
        "SET IDENTITY_INSERT [t] OFF;",
        "",
      ].join("\n"),
    );
  });

  it("resets identity sequences with setval on postgresql", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_t",
          name: "it's",
          primaryKeyColumnIds: ["col_t_id"],
        }),
      ],
      columns: [column("t", "id", { name: "row id", isAutoIncrement: true })],
    });
    const dataset: SeedDataset = {
      tables: [{ tableId: "tbl_t", rows: [{ col_t_id: 1 }] }],
    };

    expect(content(schema, dataset, "postgresql")).toBe(
      [
        'INSERT INTO "it\'s" ("row id") VALUES',
        "  (1);",
        `SELECT setval(pg_get_serial_sequence('"it''s"', 'row id'), (SELECT max("row id") FROM "it's"));`,
        "",
      ].join("\n"),
    );
  });

  it("writes NULL for deferred relation columns and UPDATE statements at the end", () => {
    expect(content(createCycleSchema(true), CYCLE_DATASET, "postgresql")).toBe(
      [
        'INSERT INTO "a" ("id", "b_id") VALUES',
        "  (1, NULL),",
        "  (2, NULL);",
        "",
        'INSERT INTO "b" ("id", "a_id") VALUES',
        "  (2, 1);",
        "",
        'UPDATE "a" SET "b_id" = 2 WHERE "id" = 1;',
        "",
      ].join("\n"),
    );
  });

  it("keeps a column shared with a non-deferred relation in the insert", () => {
    // orders.(tenant_id, customer_id) -> customers.(tenant_id, id) is deferred;
    // orders.tenant_id -> tenants.id is not, so tenant_id keeps its value.
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_tenants",
          primaryKeyColumnIds: ["col_tenants_id"],
        }),
        makeTable({ id: "tbl_orders", primaryKeyColumnIds: ["col_orders_id"] }),
        makeTable({
          id: "tbl_customers",
          primaryKeyColumnIds: ["col_customers_tenant_id", "col_customers_id"],
        }),
      ],
      columns: [
        column("tenants", "id"),
        column("orders", "id"),
        column("orders", "tenant_id", { isNullable: true }),
        column("orders", "customer_id", { isNullable: true }),
        column("customers", "tenant_id"),
        column("customers", "id"),
      ],
      relations: [
        makeRelation({
          id: "rel_orders_customers",
          fromTableId: "tbl_orders",
          toTableId: "tbl_customers",
          columnPairs: [
            {
              fromColumnId: "col_orders_customer_id",
              toColumnId: "col_customers_id",
            },
            {
              fromColumnId: "col_orders_tenant_id",
              toColumnId: "col_customers_tenant_id",
            },
          ],
        }),
        makeRelation({
          id: "rel_orders_tenants",
          fromTableId: "tbl_orders",
          toTableId: "tbl_tenants",
          columnPairs: [
            {
              fromColumnId: "col_orders_tenant_id",
              toColumnId: "col_tenants_id",
            },
          ],
        }),
      ],
    });
    const dataset: SeedDataset = {
      tables: [
        { tableId: "tbl_tenants", rows: [{ col_tenants_id: 1 }] },
        {
          tableId: "tbl_orders",
          rows: [
            {
              col_orders_id: 1,
              col_orders_tenant_id: 1,
              col_orders_customer_id: 5,
            },
          ],
        },
        {
          tableId: "tbl_customers",
          rows: [{ col_customers_tenant_id: 1, col_customers_id: 5 }],
        },
      ],
    };

    expect(content(schema, dataset, "mysql")).toBe(
      [
        "INSERT INTO `tenants` (`id`) VALUES",
        "  (1);",
        "",
        "INSERT INTO `orders` (`id`, `tenant_id`, `customer_id`) VALUES",
        "  (1, 1, NULL);",
        "",
        "INSERT INTO `customers` (`tenant_id`, `id`) VALUES",
        "  (1, 5);",
        "",
        "UPDATE `orders` SET `customer_id` = 5 WHERE `id` = 1;",
        "",
      ].join("\n"),
    );
  });

  it("skips UPDATE for a source table without a primary key", () => {
    expect(content(createCycleSchema(false), CYCLE_DATASET, "postgresql")).toBe(
      [
        'INSERT INTO "a" ("id", "b_id") VALUES',
        "  (1, NULL),",
        "  (2, NULL);",
        "",
        'INSERT INTO "b" ("id", "a_id") VALUES',
        "  (2, 1);",
        "",
      ].join("\n"),
    );
  });

  it("uses renamed mysql column names", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t" })],
      columns: [
        column("t", "plain", { name: "ma" }),
        column("t", "accent", { name: "MA" }),
      ],
    });
    const dataset: SeedDataset = {
      tables: [
        { tableId: "tbl_t", rows: [{ col_t_plain: 1, col_t_accent: 2 }] },
      ],
    };

    expect(content(schema, dataset, "mysql")).toBe(
      ["INSERT INTO `t` (`ma`, `MA_2`) VALUES", "  (1, 2);", ""].join("\n"),
    );
  });

  it.each<SqlDialect | "json">(["postgresql", "json"])(
    "ignores tables and columns missing from the schema (%s)",
    (format) => {
      const dataset: SeedDataset = {
        tables: [
          { tableId: "tbl_missing", rows: [{ col_missing: 1 }] },
          { tableId: "tbl_users", rows: [{ col_users_id: 1, col_missing: 2 }] },
        ],
      };
      const usersOnly: SeedDataset = {
        tables: [{ tableId: "tbl_users", rows: [{ col_users_id: 1 }] }],
      };

      expect(content(USERS_SCHEMA, dataset, format)).toBe(
        content(USERS_SCHEMA, usersOnly, format),
      );
    },
  );

  it.each<SqlDialect>(["postgresql", "mysql", "sqlserver"])(
    "writes an empty dataset as a single newline (%s)",
    (dialect) => {
      expect(content(USERS_SCHEMA, { tables: [] }, dialect)).toBe("\n");
    },
  );
});
