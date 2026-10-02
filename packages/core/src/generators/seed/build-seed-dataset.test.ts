import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { ColumnId, TableId } from "../../model/ids.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import { createLargeSchema } from "../../testing/large-schema.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { buildSeedDataset } from "./build-seed-dataset.js";
import type { SeedDataset } from "./seed-dataset.js";
import {
  findDeferredSeedRelations,
  validateSeedDataset,
} from "./validate-seed-dataset.js";

const OPTIONS = { rowsPerTable: 4, seed: 1 };

// A table named `name` whose primary key is `col_<name>_id`.
function keyedTable(name: string, overrides: Partial<Table> = {}): Table {
  return makeTable({
    id: `tbl_${name}`,
    name,
    primaryKeyColumnIds: [`col_${name}_id`],
    ...overrides,
  });
}

function idColumn(tableName: string, overrides: Partial<Column> = {}): Column {
  return makeColumn({
    id: `col_${tableName}_id`,
    tableId: `tbl_${tableName}`,
    name: "id",
    ...overrides,
  });
}

function foreignKeyColumn(
  fromTable: string,
  toTable: string,
  isNullable = false,
): Column {
  return makeColumn({
    id: `col_${fromTable}_${toTable}`,
    tableId: `tbl_${fromTable}`,
    name: `${toTable}_id`,
    isNullable,
  });
}

// `fromTable.<toTable>_id` references `toTable.id`.
function foreignKey(
  fromTable: string,
  toTable: string,
  overrides: Partial<Relation> = {},
): Relation {
  return makeRelation({
    id: `rel_${fromTable}_${toTable}`,
    fromTableId: `tbl_${fromTable}`,
    toTableId: `tbl_${toTable}`,
    columnPairs: [
      {
        fromColumnId: `col_${fromTable}_${toTable}`,
        toColumnId: `col_${toTable}_id`,
      },
    ],
    ...overrides,
  });
}

function rowsOf(
  dataset: SeedDataset,
  tableId: TableId,
): SeedDataset["tables"][number]["rows"] {
  return dataset.tables.find((entry) => entry.tableId === tableId)?.rows ?? [];
}

function columnValues(
  dataset: SeedDataset,
  tableId: TableId,
  columnId: ColumnId,
): readonly unknown[] {
  return rowsOf(dataset, tableId).map((row) => row[columnId]);
}

function createParentChildSchema(): SchemaDocument {
  return buildSchema({
    tables: [keyedTable("z_parents"), keyedTable("a_children")],
    columns: [
      idColumn("z_parents"),
      idColumn("a_children"),
      foreignKeyColumn("a_children", "z_parents"),
    ],
    relations: [foreignKey("a_children", "z_parents")],
  });
}

function createSelfReferenceSchema(isNullable: boolean): SchemaDocument {
  return buildSchema({
    tables: [keyedTable("nodes")],
    columns: [
      idColumn("nodes"),
      foreignKeyColumn("nodes", "nodes", isNullable),
    ],
    relations: [foreignKey("nodes", "nodes")],
  });
}

// a.b_id (nullable) → b and b.a_id (required) → a; `a` has a primary key
// only when `hasPrimaryKey`, otherwise a.id is unique.
function createNullableCycleSchema(hasPrimaryKey: boolean): SchemaDocument {
  return buildSchema({
    tables: [
      keyedTable("a", hasPrimaryKey ? {} : { primaryKeyColumnIds: [] }),
      keyedTable("b"),
    ],
    columns: [
      idColumn("a", { isUnique: !hasPrimaryKey }),
      foreignKeyColumn("a", "b", true),
      idColumn("b"),
      foreignKeyColumn("b", "a"),
    ],
    relations: [foreignKey("a", "b"), foreignKey("b", "a")],
  });
}

// tenants(id); users(tenant_id → tenants, id) keyed by (tenant_id, id);
// orders(id, tenant_id → tenants, (tenant_id, user_id) → users).
function createMultiTenantSchema(): SchemaDocument {
  return buildSchema({
    tables: [
      keyedTable("tenants"),
      keyedTable("users", {
        primaryKeyColumnIds: ["col_users_tenants", "col_users_id"],
      }),
      keyedTable("orders"),
    ],
    columns: [
      idColumn("tenants"),
      foreignKeyColumn("users", "tenants"),
      idColumn("users"),
      idColumn("orders"),
      foreignKeyColumn("orders", "tenants"),
      foreignKeyColumn("orders", "users"),
    ],
    relations: [
      foreignKey("users", "tenants"),
      foreignKey("orders", "tenants"),
      makeRelation({
        id: "rel_orders_users",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          {
            fromColumnId: "col_orders_tenants",
            toColumnId: "col_users_tenants",
          },
          { fromColumnId: "col_orders_users", toColumnId: "col_users_id" },
        ],
      }),
    ],
  });
}

describe("buildSeedDataset", () => {
  it("returns the same dataset for the same seed", () => {
    const schema = createSampleSchema();
    expect(buildSeedDataset(schema, OPTIONS)).toStrictEqual(
      buildSeedDataset(schema, OPTIONS),
    );
  });

  it("returns different values for a different seed", () => {
    const schema = createSampleSchema();
    expect(buildSeedDataset(schema, OPTIONS).dataset).not.toStrictEqual(
      buildSeedDataset(schema, { ...OPTIONS, seed: 2 }).dataset,
    );
  });

  it("keeps the rows of other tables when a table is added", () => {
    const flag = makeColumn({
      id: "col_users_flag",
      tableId: "tbl_users",
      type: { kind: "boolean" },
    });
    const before = buildSchema({
      tables: [keyedTable("users")],
      columns: [idColumn("users"), flag],
    });
    const after = buildSchema({
      tables: [keyedTable("users"), keyedTable("extra")],
      columns: [idColumn("users"), flag, idColumn("extra")],
    });
    expect(
      rowsOf(buildSeedDataset(after, OPTIONS).dataset, "tbl_users"),
    ).toStrictEqual(
      rowsOf(buildSeedDataset(before, OPTIONS).dataset, "tbl_users"),
    );
  });

  it("orders tables so referenced tables come first", () => {
    const { dataset } = buildSeedDataset(createParentChildSchema(), OPTIONS);
    expect(dataset.tables.map((entry) => entry.tableId)).toStrictEqual([
      "tbl_z_parents",
      "tbl_a_children",
    ]);
  });

  it("points a self-reference to the previous row and the first row to null", () => {
    const { dataset } = buildSeedDataset(
      createSelfReferenceSchema(true),
      OPTIONS,
    );
    expect(columnValues(dataset, "tbl_nodes", "col_nodes_nodes")).toStrictEqual(
      [null, 1, 2, 3],
    );
  });

  it("points the first row of a required self-reference to itself", () => {
    const { dataset } = buildSeedDataset(
      createSelfReferenceSchema(false),
      OPTIONS,
    );
    expect(columnValues(dataset, "tbl_nodes", "col_nodes_nodes")).toStrictEqual(
      [1, 1, 2, 3],
    );
  });

  it("picks distinct parent rows for one-to-one relations and reduces rows when parents run out", () => {
    // A unique boolean column leaves `parents` with two rows.
    const schema = buildSchema({
      tables: [keyedTable("parents"), keyedTable("children")],
      columns: [
        idColumn("parents"),
        makeColumn({
          id: "col_parents_flag",
          tableId: "tbl_parents",
          type: { kind: "boolean" },
          isUnique: true,
        }),
        idColumn("children"),
        foreignKeyColumn("children", "parents"),
      ],
      relations: [foreignKey("children", "parents", { kind: "oneToOne" })],
    });
    const result = buildSeedDataset(schema, OPTIONS);
    expect({
      parents: columnValues(
        result.dataset,
        "tbl_children",
        "col_children_parents",
      ).toSorted(),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      parents: [1, 2],
      diagnostics: [
        { code: "seed-rows-reduced", path: ["tables", "tbl_children"] },
        { code: "seed-rows-reduced", path: ["tables", "tbl_parents"] },
      ],
    });
  });

  it("picks a parent row that agrees with a column shared by two relations", () => {
    const schema = createMultiTenantSchema();
    const { dataset } = buildSeedDataset(schema, { rowsPerTable: 6, seed: 3 });
    expect({
      issues: validateSeedDataset(schema, dataset),
      orderCount: rowsOf(dataset, "tbl_orders").length,
    }).toStrictEqual({ issues: [], orderCount: 6 });
  });

  it("defers a nullable relation in a cycle and fills it after every table", () => {
    const schema = createNullableCycleSchema(true);
    const { dataset } = buildSeedDataset(schema, OPTIONS);
    expect({
      order: dataset.tables.map((entry) => entry.tableId),
      deferred: findDeferredSeedRelations(schema, dataset),
      hasNull: columnValues(dataset, "tbl_a", "col_a_b").includes(null),
      issues: validateSeedDataset(schema, dataset),
    }).toStrictEqual({
      order: ["tbl_a", "tbl_b"],
      deferred: ["rel_a_b"],
      hasNull: false,
      issues: [],
    });
  });

  it("keeps a deferred value null when the source table has no primary key", () => {
    const { dataset } = buildSeedDataset(
      createNullableCycleSchema(false),
      OPTIONS,
    );
    expect(columnValues(dataset, "tbl_a", "col_a_b")).toStrictEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it("keeps a unique deferred column unique", () => {
    // a.b_id (nullable, unique) → b closes a one-to-many cycle with b.a_id → a.
    const schema = buildSchema({
      tables: [keyedTable("a"), keyedTable("b")],
      columns: [
        idColumn("a"),
        { ...foreignKeyColumn("a", "b", true), isUnique: true },
        idColumn("b"),
        foreignKeyColumn("b", "a"),
      ],
      relations: [foreignKey("a", "b"), foreignKey("b", "a")],
    });
    const { dataset } = buildSeedDataset(schema, { rowsPerTable: 8, seed: 1 });
    expect(validateSeedDataset(schema, dataset)).toStrictEqual([]);
  });

  it("skips the tables of a required cycle and their dependants and reports seed-table-skipped", () => {
    const schema = buildSchema({
      tables: [
        keyedTable("a"),
        keyedTable("b"),
        keyedTable("c"),
        keyedTable("d"),
      ],
      columns: [
        idColumn("a"),
        foreignKeyColumn("a", "b"),
        idColumn("b"),
        foreignKeyColumn("b", "a"),
        idColumn("c"),
        foreignKeyColumn("c", "a"),
        idColumn("d"),
      ],
      relations: [
        foreignKey("a", "b"),
        foreignKey("b", "a"),
        foreignKey("c", "a"),
      ],
    });
    const result = buildSeedDataset(schema, OPTIONS);
    expect({
      tables: result.dataset.tables.map((entry) => entry.tableId),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      tables: ["tbl_d"],
      diagnostics: [
        { code: "seed-table-skipped", path: ["tables", "tbl_a"] },
        { code: "seed-table-skipped", path: ["tables", "tbl_b"] },
        { code: "seed-table-skipped", path: ["tables", "tbl_c"] },
      ],
    });
  });

  it("skips a table with a required custom column and its dependants", () => {
    const schema = buildSchema({
      tables: [keyedTable("shapes"), keyedTable("uses"), keyedTable("free")],
      columns: [
        idColumn("shapes"),
        makeColumn({
          id: "col_shapes_area",
          tableId: "tbl_shapes",
          type: { kind: "custom", name: "geometry" },
        }),
        idColumn("uses"),
        foreignKeyColumn("uses", "shapes"),
        idColumn("free"),
      ],
      relations: [foreignKey("uses", "shapes")],
    });
    const result = buildSeedDataset(schema, OPTIONS);
    expect({
      tables: result.dataset.tables.map((entry) => entry.tableId),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      tables: ["tbl_free"],
      diagnostics: [
        { code: "seed-table-skipped", path: ["tables", "tbl_shapes"] },
        { code: "seed-table-skipped", path: ["tables", "tbl_uses"] },
      ],
    });
  });

  it("reduces rows for a unique boolean column and reports seed-rows-reduced", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_flags" })],
      columns: [
        makeColumn({
          id: "col_flags_flag",
          tableId: "tbl_flags",
          type: { kind: "boolean" },
          isUnique: true,
        }),
      ],
    });
    const result = buildSeedDataset(schema, OPTIONS);
    expect({
      values: columnValues(
        result.dataset,
        "tbl_flags",
        "col_flags_flag",
      ).toSorted(),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      values: [false, true],
      diagnostics: [
        { code: "seed-rows-reduced", path: ["tables", "tbl_flags"] },
      ],
    });
  });

  it("omits columns whose value is left to the database default", () => {
    const schema = buildSchema({
      tables: [keyedTable("hosts")],
      columns: [
        idColumn("hosts"),
        makeColumn({
          id: "col_hosts_address",
          tableId: "tbl_hosts",
          type: { kind: "custom", name: "inet" },
          defaultValue: { kind: "literal", value: "127.0.0.1" },
        }),
      ],
    });
    const { dataset } = buildSeedDataset(schema, { rowsPerTable: 2, seed: 1 });
    expect(rowsOf(dataset, "tbl_hosts")).toStrictEqual([
      { col_hosts_id: 1 },
      { col_hosts_id: 2 },
    ]);
  });

  it("returns no rows for a table without columns", () => {
    const schema = buildSchema({ tables: [makeTable({ id: "tbl_empty" })] });
    expect(buildSeedDataset(schema, OPTIONS)).toStrictEqual({
      dataset: { tables: [{ tableId: "tbl_empty", rows: [] }] },
      diagnostics: [],
    });
  });

  it("keeps unique index keys distinct", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_codes" })],
      columns: [
        makeColumn({
          id: "col_codes_code",
          tableId: "tbl_codes",
          type: { kind: "boolean" },
        }),
      ],
      indexes: [
        makeIndex({
          id: "idx_codes_code",
          tableId: "tbl_codes",
          columnIds: ["col_codes_code"],
          isUnique: true,
        }),
      ],
    });
    expect(
      rowsOf(buildSeedDataset(schema, OPTIONS).dataset, "tbl_codes"),
    ).toHaveLength(2);
  });

  it.each([
    ["sample", createSampleSchema()],
    ["naming-edge", createNamingEdgeSchema()],
    ["target-limit", createTargetLimitSchema()],
    ["large", createLargeSchema({ tableCount: 20 })],
  ])("passes validateSeedDataset for the %s fixture", (_name, schema) => {
    const { dataset } = buildSeedDataset(schema, { rowsPerTable: 10, seed: 1 });
    expect(validateSeedDataset(schema, dataset)).toStrictEqual([]);
  });

  it.each([
    { rowsPerTable: 0, seed: 1 },
    { rowsPerTable: 1, seed: -1 },
  ])("throws RangeError for invalid options %j", (options) => {
    expect(() => buildSeedDataset(createSampleSchema(), options)).toThrow(
      RangeError,
    );
  });
});
