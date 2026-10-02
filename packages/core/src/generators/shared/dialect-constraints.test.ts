import { describe, expect, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import type { Column } from "../../model/column.js";
import type { ColumnId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import type { DroppedConstraints } from "./dialect-constraints.js";
import {
  collectKeyColumnIds,
  findUnindexableConstraints,
  resolveReferentialAction,
  resolveSqlServerUnique,
} from "./dialect-constraints.js";
import { resolveSchemaColumnTypes } from "./dialect-column-types.js";
import type { SqlDialect } from "./generator-types.js";

const INTEGER: ColumnType = { kind: "integer" };
const JSON_TYPE: ColumnType = { kind: "json" };
const BINARY: ColumnType = { kind: "binary" };

function char(length: number): ColumnType {
  return { kind: "char", length };
}

function varchar(length: number): ColumnType {
  return { kind: "varchar", length };
}

function column(
  id: ColumnId,
  type: ColumnType,
  overrides: Partial<Column> = {},
): Column {
  const tableId = id.startsWith("col_a") ? "tbl_a" : "tbl_b";
  return makeColumn({ id, tableId, type, ...overrides });
}

function findDropped(
  schema: SchemaDocument,
  dialect: SqlDialect,
): DroppedConstraints {
  return findUnindexableConstraints(
    schema,
    dialect,
    resolveSchemaColumnTypes(schema, dialect).types,
  );
}

const NOTHING_DROPPED: DroppedConstraints = {
  primaryKeyTableIds: new Set(),
  uniqueColumnIds: new Set(),
  indexIds: new Set(),
  relationIds: new Set(),
  autoIncrementIndexColumnIds: new Set(),
  diagnostics: [],
};

// Table a: primary key a_json (json), unique a_bin (binary), index on a_bin2.
const JSON_KEY_SCHEMA = buildSchema({
  tables: [makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_json"] })],
  columns: [
    column("col_a_json", JSON_TYPE),
    column("col_a_bin", BINARY, { isUnique: true }),
    column("col_a_bin2", BINARY),
  ],
  indexes: [
    makeIndex({ id: "idx_a", tableId: "tbl_a", columnIds: ["col_a_bin2"] }),
  ],
});

// Table a: primary key (a_k1 varchar(768), a_k2 integer) and an index on the
// same columns, 3104 bytes on MySQL; table b references the primary key.
const LONG_KEY_SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_k1", "col_a_k2"] }),
    makeTable({ id: "tbl_b" }),
  ],
  columns: [
    column("col_a_k1", varchar(768)),
    column("col_a_k2", INTEGER),
    column("col_b_r1", varchar(768)),
    column("col_b_r2", INTEGER),
  ],
  indexes: [
    makeIndex({
      id: "idx_a",
      tableId: "tbl_a",
      columnIds: ["col_a_k1", "col_a_k2"],
    }),
  ],
  relations: [
    makeRelation({
      id: "rel_b",
      fromTableId: "tbl_b",
      toTableId: "tbl_a",
      columnPairs: [
        { fromColumnId: "col_b_r1", toColumnId: "col_a_k1" },
        { fromColumnId: "col_b_r2", toColumnId: "col_a_k2" },
      ],
    }),
  ],
});

function columnIdsOf(prefix: "a" | "b", count: number): readonly ColumnId[] {
  return Array.from(
    { length: count },
    (_, position): ColumnId => `col_${prefix}_${String(position)}`,
  );
}

const MANY_INTEGER_IDS = columnIdsOf("a", 53);
const MANY_REFERENCE_IDS = columnIdsOf("b", 53);

// 53 integer columns: 901 fixed bytes on SQL Server.
const WIDE_PRIMARY_KEY_SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_a", primaryKeyColumnIds: MANY_INTEGER_IDS }),
    makeTable({ id: "tbl_b" }),
  ],
  columns: [
    ...MANY_INTEGER_IDS.map((id) => column(id, INTEGER)),
    ...MANY_REFERENCE_IDS.map((id) => column(id, INTEGER)),
  ],
  relations: [
    makeRelation({
      id: "rel_b",
      fromTableId: "tbl_b",
      toTableId: "tbl_a",
      columnPairs: MANY_INTEGER_IDS.map((id, position) => ({
        fromColumnId: MANY_REFERENCE_IDS[position] ?? id,
        toColumnId: id,
      })),
    }),
  ],
});

function autoIncrementSchema(
  primaryKeyColumnIds: readonly ColumnId[],
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_a", primaryKeyColumnIds })],
    columns: [
      column("col_a_id", INTEGER, { isAutoIncrement: true }),
      column("col_a_json", JSON_TYPE),
      column("col_a_other", INTEGER),
    ],
  });
}

describe("collectKeyColumnIds", () => {
  it("collects primary key, unique, index and relation columns as key columns", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_id"] }),
        makeTable({ id: "tbl_b" }),
      ],
      columns: [
        column("col_a_id", INTEGER),
        column("col_a_unique", INTEGER, { isUnique: true }),
        column("col_a_indexed", INTEGER),
        column("col_a_plain", INTEGER),
        column("col_b_ref", INTEGER),
      ],
      indexes: [
        makeIndex({
          id: "idx_a",
          tableId: "tbl_a",
          columnIds: ["col_a_indexed"],
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_b",
          fromTableId: "tbl_b",
          toTableId: "tbl_a",
          columnPairs: [{ fromColumnId: "col_b_ref", toColumnId: "col_a_id" }],
        }),
      ],
    });

    expect(collectKeyColumnIds(schema)).toStrictEqual(
      new Set(["col_a_id", "col_a_unique", "col_a_indexed", "col_b_ref"]),
    );
  });
});

describe("findUnindexableConstraints", () => {
  it("drops nothing on PostgreSQL", () => {
    expect(findDropped(JSON_KEY_SCHEMA, "postgresql")).toStrictEqual(
      NOTHING_DROPPED,
    );
  });

  it.each(["mysql", "sqlserver"] as const)(
    "drops a primary key, a unique column and an index containing json or binary: %s",
    (dialect) => {
      expect(findDropped(JSON_KEY_SCHEMA, dialect)).toStrictEqual({
        ...NOTHING_DROPPED,
        primaryKeyTableIds: new Set(["tbl_a"]),
        uniqueColumnIds: new Set(["col_a_bin"]),
        indexIds: new Set(["idx_a"]),
        diagnostics: [
          {
            code: "key-column-type-not-indexable",
            path: ["columns", "col_a_bin", "isUnique"],
          },
          { code: "key-column-type-not-indexable", path: ["indexes", "idx_a"] },
          {
            code: "key-column-type-not-indexable",
            path: ["tables", "tbl_a", "primaryKeyColumnIds"],
          },
        ],
      });
    },
  );

  it("drops a relation between json or binary columns", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a" }), makeTable({ id: "tbl_b" })],
      columns: [
        column("col_a_data", JSON_TYPE, { isUnique: true }),
        column("col_b_data", JSON_TYPE),
      ],
      relations: [
        makeRelation({
          id: "rel_b",
          fromTableId: "tbl_b",
          toTableId: "tbl_a",
          columnPairs: [
            { fromColumnId: "col_b_data", toColumnId: "col_a_data" },
          ],
        }),
      ],
    });

    expect(findDropped(schema, "mysql").relationIds).toStrictEqual(
      new Set(["rel_b"]),
    );
  });

  it("drops a SQL Server key still over the fixed-length limit after narrowing", () => {
    expect(
      findDropped(WIDE_PRIMARY_KEY_SCHEMA, "sqlserver").primaryKeyTableIds,
    ).toStrictEqual(new Set(["tbl_a"]));
  });

  it("keeps a SQL Server unique index that narrowing brings under 1700 fixed bytes", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a" })],
      columns: [column("col_a_one", char(851)), column("col_a_two", INTEGER)],
      indexes: [
        makeIndex({
          id: "idx_a",
          tableId: "tbl_a",
          columnIds: ["col_a_one", "col_a_two"],
          isUnique: true,
        }),
      ],
    });

    // char(851) narrows to nvarchar; 17 bytes remain, so the index stays.
    expect(findDropped(schema, "sqlserver")).toStrictEqual(NOTHING_DROPPED);
  });

  it("drops a relation that references a dropped key", () => {
    expect(findDropped(WIDE_PRIMARY_KEY_SCHEMA, "sqlserver")).toStrictEqual({
      ...NOTHING_DROPPED,
      primaryKeyTableIds: new Set(["tbl_a"]),
      relationIds: new Set(["rel_b"]),
      diagnostics: [
        { code: "key-column-type-not-indexable", path: ["relations", "rel_b"] },
        {
          code: "key-column-type-not-indexable",
          path: ["tables", "tbl_a", "primaryKeyColumnIds"],
        },
      ],
    });
  });

  it("asks for a fallback index when a MySQL auto-increment column loses its only key", () => {
    const schema = autoIncrementSchema(["col_a_id", "col_a_json"]);

    expect(
      findDropped(schema, "mysql").autoIncrementIndexColumnIds,
    ).toStrictEqual(new Set(["col_a_id"]));
  });

  it("asks for a fallback index when the auto-increment column is not first in a composite primary key", () => {
    const schema = autoIncrementSchema(["col_a_other", "col_a_id"]);

    expect(findDropped(schema, "mysql")).toStrictEqual({
      ...NOTHING_DROPPED,
      autoIncrementIndexColumnIds: new Set(["col_a_id"]),
    });
  });

  it("asks for no fallback index when the auto-increment column leads the primary key", () => {
    const schema = autoIncrementSchema(["col_a_id", "col_a_other"]);

    expect(findDropped(schema, "mysql")).toStrictEqual(NOTHING_DROPPED);
  });

  it("asks for no fallback index when a kept index starts with the auto-increment column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_json"] })],
      columns: [
        column("col_a_id", INTEGER, { isAutoIncrement: true }),
        column("col_a_json", JSON_TYPE),
      ],
      indexes: [
        makeIndex({ id: "idx_a", tableId: "tbl_a", columnIds: ["col_a_id"] }),
      ],
    });

    expect(
      findDropped(schema, "mysql").autoIncrementIndexColumnIds,
    ).toStrictEqual(new Set());
  });

  it("asks for no fallback index on SQL Server", () => {
    const schema = autoIncrementSchema(["col_a_id", "col_a_json"]);

    expect(
      findDropped(schema, "sqlserver").autoIncrementIndexColumnIds,
    ).toStrictEqual(new Set());
  });

  it("keeps a MySQL index of exactly 3072 bytes", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_a" })],
      columns: [column("col_a_name", varchar(768))],
      indexes: [
        makeIndex({ id: "idx_a", tableId: "tbl_a", columnIds: ["col_a_name"] }),
      ],
    });

    expect(findDropped(schema, "mysql")).toStrictEqual(NOTHING_DROPPED);
  });

  it("drops a MySQL index, primary key and relation longer than 3072 bytes", () => {
    expect(findDropped(LONG_KEY_SCHEMA, "mysql")).toStrictEqual({
      ...NOTHING_DROPPED,
      primaryKeyTableIds: new Set(["tbl_a"]),
      indexIds: new Set(["idx_a"]),
      relationIds: new Set(["rel_b"]),
      diagnostics: [
        { code: "key-column-type-not-indexable", path: ["indexes", "idx_a"] },
        { code: "key-column-type-not-indexable", path: ["relations", "rel_b"] },
        {
          code: "key-column-type-not-indexable",
          path: ["tables", "tbl_a", "primaryKeyColumnIds"],
        },
      ],
    });
  });

  it.each(["sqlserver", "postgresql"] as const)(
    "keeps long keys on SQL Server and PostgreSQL: %s",
    (dialect) => {
      expect(findDropped(LONG_KEY_SCHEMA, dialect)).toStrictEqual(
        NOTHING_DROPPED,
      );
    },
  );

  it("reports one key-column-type-not-indexable per dropped element", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_a",
          primaryKeyColumnIds: ["col_a_json", "col_a_k1", "col_a_k2"],
        }),
      ],
      columns: [
        column("col_a_json", JSON_TYPE),
        column("col_a_k1", varchar(768)),
        column("col_a_k2", varchar(768)),
      ],
    });

    expect(findDropped(schema, "mysql").diagnostics).toStrictEqual([
      {
        code: "key-column-type-not-indexable",
        path: ["tables", "tbl_a", "primaryKeyColumnIds"],
      },
    ]);
  });
});

describe("resolveReferentialAction", () => {
  it("maps set default to no action on MySQL as lossy", () => {
    expect(resolveReferentialAction("mysql", "setDefault")).toStrictEqual({
      action: "noAction",
      isLossy: true,
    });
  });

  it("maps restrict to no action on SQL Server without loss", () => {
    expect(resolveReferentialAction("sqlserver", "restrict")).toStrictEqual({
      action: "noAction",
      isLossy: false,
    });
  });

  it.each([
    "noAction",
    "restrict",
    "cascade",
    "setNull",
    "setDefault",
  ] as const)("keeps every action on PostgreSQL: %s", (action) => {
    expect(resolveReferentialAction("postgresql", action)).toStrictEqual({
      action,
      isLossy: false,
    });
  });

  it.each([
    ["mysql", "restrict"],
    ["sqlserver", "setDefault"],
  ] as const)("keeps %s %s", (dialect, action) => {
    expect(resolveReferentialAction(dialect, action)).toStrictEqual({
      action,
      isLossy: false,
    });
  });
});

describe("resolveSqlServerUnique", () => {
  function uniqueSchema(isReferenced: boolean): SchemaDocument {
    return buildSchema({
      tables: [makeTable({ id: "tbl_a" }), makeTable({ id: "tbl_b" })],
      columns: [
        column("col_a_code", INTEGER, { isNullable: true, isUnique: true }),
        column("col_a_plain", INTEGER, { isUnique: true }),
        column("col_b_ref", INTEGER, { isNullable: true }),
      ],
      relations: isReferenced
        ? [
            makeRelation({
              id: "rel_b",
              fromTableId: "tbl_b",
              toTableId: "tbl_a",
              columnPairs: [
                { fromColumnId: "col_b_ref", toColumnId: "col_a_code" },
              ],
            }),
          ]
        : [],
    });
  }

  it("filters a nullable unique that no foreign key references", () => {
    expect(
      resolveSqlServerUnique(uniqueSchema(false), "tbl_a", ["col_a_code"]),
    ).toStrictEqual({ mode: "filtered", isNullsRestricted: false });
  });

  it("restricts a nullable unique referenced by a foreign key", () => {
    expect(
      resolveSqlServerUnique(uniqueSchema(true), "tbl_a", ["col_a_code"]),
    ).toStrictEqual({ mode: "plain", isNullsRestricted: true });
  });

  it("uses a plain unique when no column is nullable", () => {
    expect(
      resolveSqlServerUnique(uniqueSchema(true), "tbl_a", ["col_a_plain"]),
    ).toStrictEqual({ mode: "plain", isNullsRestricted: false });
  });
});
