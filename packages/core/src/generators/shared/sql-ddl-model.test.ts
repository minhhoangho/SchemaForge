import { describe, expect, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import type { Column } from "../../model/column.js";
import type { ColumnId, TableId } from "../../model/ids.js";
import type { ReferentialAction } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import type { SqlDialect } from "./generator-types.js";
import { SQL_DIALECTS } from "./generator-types.js";
import type { SqlDdlModel, SqlTableModel } from "./sql-ddl-model.js";
import { buildSqlDdlModel } from "./sql-ddl-model.js";

const TEXT: ColumnType = { kind: "text" };
const JSON_TYPE: ColumnType = { kind: "json" };

function column(
  id: ColumnId,
  tableId: TableId,
  overrides: Partial<Column> = {},
): Column {
  return makeColumn({ id, tableId, ...overrides });
}

function literal(value: string): Column["defaultValue"] {
  return { kind: "literal", value };
}

function findTable(
  model: SqlDdlModel,
  name: string,
): SqlTableModel | undefined {
  return model.tables.find((table) => table.name === name);
}

function reverseKeyOrder<Element>(
  map: Readonly<Record<string, Element>>,
): Record<string, Element> {
  return Object.fromEntries(Object.entries(map).reverse());
}

function withReversedMaps(schema: SchemaDocument): SchemaDocument {
  return {
    ...schema,
    tables: reverseKeyOrder(schema.tables),
    columns: reverseKeyOrder(schema.columns),
    relations: reverseKeyOrder(schema.relations),
    indexes: reverseKeyOrder(schema.indexes),
    enums: reverseKeyOrder(schema.enums),
  };
}

// Table "t" with one column "c" and no primary key.
function singleTableSchema(
  tableComment: string,
  columnOverrides: Partial<Column>,
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_t", comment: tableComment })],
    columns: [column("col_c", "tbl_t", columnOverrides)],
  });
}

// Parent "p" (id) and child "c" (id, p_id) with one relation c.p_id -> p.id.
function relationSchema(
  onDelete: ReferentialAction,
  onUpdate: ReferentialAction,
): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_p", primaryKeyColumnIds: ["col_p_id"] }),
      makeTable({ id: "tbl_c", primaryKeyColumnIds: ["col_c_id"] }),
    ],
    columns: [
      column("col_p_id", "tbl_p", { name: "id" }),
      column("col_c_id", "tbl_c", { name: "id" }),
      column("col_c_p_id", "tbl_c", { name: "p_id" }),
    ],
    relations: [
      makeRelation({
        id: "rel_c",
        fromTableId: "tbl_c",
        toTableId: "tbl_p",
        columnPairs: [{ fromColumnId: "col_c_p_id", toColumnId: "col_p_id" }],
        onDelete,
        onUpdate,
      }),
    ],
  });
}

const ORDERING_SCHEMA = buildSchema({
  enums: [makeEnum({ id: "enum_z" }), makeEnum({ id: "enum_y" })],
  tables: [
    makeTable({ id: "tbl_b", primaryKeyColumnIds: ["col_b_id"] }),
    makeTable({ id: "tbl_a", primaryKeyColumnIds: ["col_a_id"] }),
  ],
  columns: [
    column("col_b_id", "tbl_b", { name: "id" }),
    column("col_b_ref", "tbl_b", { name: "a_id" }),
    column("col_a_id", "tbl_a", { name: "id" }),
    column("col_a_ref", "tbl_a", { name: "b_id" }),
  ],
  indexes: [
    makeIndex({ id: "idx_b", tableId: "tbl_b", columnIds: ["col_b_ref"] }),
    makeIndex({ id: "idx_a", tableId: "tbl_a", columnIds: ["col_a_ref"] }),
  ],
  relations: [
    makeRelation({
      id: "rel_b",
      fromTableId: "tbl_b",
      toTableId: "tbl_a",
      columnPairs: [{ fromColumnId: "col_b_ref", toColumnId: "col_a_id" }],
    }),
    makeRelation({
      id: "rel_a",
      fromTableId: "tbl_a",
      toTableId: "tbl_b",
      columnPairs: [{ fromColumnId: "col_a_ref", toColumnId: "col_b_id" }],
    }),
  ],
});

describe("buildSqlDdlModel ordering", () => {
  it("orders enums, tables, indexes and foreign keys by the part 2 ordering", () => {
    const model = buildSqlDdlModel(ORDERING_SCHEMA, "postgresql");

    expect({
      enums: model.enums.map((element) => element.name),
      tables: model.tables.map((table) => table.name),
      indexes: model.indexes.map((index) => index.name),
      foreignKeys: model.foreignKeys.map((foreignKey) => foreignKey.name),
    }).toStrictEqual({
      enums: ["y", "z"],
      tables: ["a", "b"],
      indexes: ["a", "b"],
      foreignKeys: ["a_b_id_fkey", "b_a_id_fkey"],
    });
  });

  it.each(SQL_DIALECTS)(
    "returns the same model regardless of map key order on %s",
    (dialect) => {
      const schema = createTargetLimitSchema();

      expect(buildSqlDdlModel(withReversedMaps(schema), dialect)).toStrictEqual(
        buildSqlDdlModel(schema, dialect),
      );
    },
  );
});

describe("buildSqlDdlModel columns", () => {
  it.each([
    ["postgresql", "now()"],
    ["mysql", "CURRENT_TIMESTAMP(6)"],
    ["sqlserver", "sysdatetimeoffset()"],
  ] as const)(
    "resolves column types, defaults and comments for %s",
    (dialect, timestampDefault) => {
      const model = buildSqlDdlModel(createSampleSchema(), dialect);

      expect(
        findTable(model, "users")?.columns.map((element) => [
          element.name,
          element.type,
          element.isNullable,
          element.isAutoIncrement,
          element.defaultSql,
          element.comment,
        ]),
      ).toStrictEqual([
        ["id", { kind: "bigint" }, false, true, null, ""],
        ["tenant_id", { kind: "uuid" }, false, false, null, ""],
        ["email", { kind: "varchar", length: 255 }, false, false, null, ""],
        ["manager_id", { kind: "bigint" }, true, false, null, ""],
        [
          "created_at",
          { kind: "timestamptz" },
          false,
          false,
          timestampDefault,
          "",
        ],
        [
          "location",
          { kind: "custom", name: "geometry(Point, 4326)", isSafe: true },
          true,
          false,
          null,
          "",
        ],
      ]);
    },
  );

  it("uses the renamed MySQL column name in the primary key, index and foreign key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_t", primaryKeyColumnIds: ["col_t_accent"] }),
        makeTable({ id: "tbl_c" }),
      ],
      columns: [
        column("col_t_plain", "tbl_t", { name: "ma" }),
        column("col_t_accent", "tbl_t", { name: "má" }),
        column("col_c_plain", "tbl_c", { name: "ref" }),
        column("col_c_accent", "tbl_c", { name: "réf" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_t",
          tableId: "tbl_t",
          columnIds: ["col_t_accent"],
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_c",
          fromTableId: "tbl_c",
          toTableId: "tbl_t",
          columnPairs: [
            { fromColumnId: "col_c_accent", toColumnId: "col_t_accent" },
          ],
        }),
      ],
    });

    const model = buildSqlDdlModel(schema, "mysql");

    expect({
      columns: findTable(model, "t")?.columns.map((element) => element.name),
      primaryKey: findTable(model, "t")?.primaryKey?.columnNames,
      index: model.indexes.map((index) => index.columnNames),
      foreignKey: model.foreignKeys.map((foreignKey) => [
        foreignKey.columnNames,
        foreignKey.referencedColumnNames,
      ]),
    }).toStrictEqual({
      columns: ["ma", "má_2"],
      primaryKey: ["má_2"],
      index: [["má_2"]],
      foreignKey: [[["réf_2"], ["má_2"]]],
    });
  });

  it("replaces an unsafe custom type with text and reports custom-type-unsafe", () => {
    const schema = singleTableSchema("", {
      type: { kind: "custom", name: "int; DROP TABLE t" },
    });

    const model = buildSqlDdlModel(schema, "postgresql");

    expect({
      type: findTable(model, "t")?.columns[0]?.type,
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      type: { kind: "text" },
      diagnostics: [
        { code: "custom-type-unsafe", path: ["columns", "col_c", "type"] },
      ],
    });
  });

  it("omits an invalid default and reports default-omitted", () => {
    const schema = singleTableSchema("", { defaultValue: literal("abc") });

    const model = buildSqlDdlModel(schema, "postgresql");

    expect({
      defaultSql: findTable(model, "t")?.columns[0]?.defaultSql,
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      defaultSql: null,
      diagnostics: [
        { code: "default-omitted", path: ["columns", "col_c", "defaultValue"] },
      ],
    });
  });

  it.each([
    ["text", TEXT, "x", "('x')"],
    ["json", JSON_TYPE, '{"a":1}', `('{"a":1}')`],
    ["an unsafe custom type", { kind: "custom", name: "x;" }, "x", "('x')"],
    ["varchar", { kind: "varchar", length: 10 }, "x", "'x'"],
  ] as const)(
    "parenthesizes a MySQL literal default on text, json and binary storage: %s",
    (_label, type, value, expected) => {
      const schema = singleTableSchema("", {
        type,
        defaultValue: literal(value),
      });

      const model = buildSqlDdlModel(schema, "mysql");

      expect(findTable(model, "t")?.columns[0]?.defaultSql).toBe(expected);
    },
  );
});

const NULL_CHARACTER_SCHEMA = buildSchema({
  enums: [makeEnum({ id: "enum_mood", values: ["ok\u0000", "bad"] })],
  tables: [makeTable({ id: "tbl_t", comment: "table\u0000note" })],
  columns: [
    column("col_c", "tbl_t", {
      type: TEXT,
      comment: "column\u0000note",
      defaultValue: literal("a\u0000b"),
    }),
  ],
});

describe("buildSqlDdlModel null characters", () => {
  it("removes null characters from PostgreSQL comments, defaults and enum values and reports each", () => {
    const model = buildSqlDdlModel(NULL_CHARACTER_SCHEMA, "postgresql");
    const table = findTable(model, "t");

    expect({
      enumValues: model.enums[0]?.values,
      tableComment: table?.comment,
      columnComment: table?.columns[0]?.comment,
      defaultSql: table?.columns[0]?.defaultSql,
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      enumValues: ["ok", "bad"],
      tableComment: "tablenote",
      columnComment: "columnnote",
      defaultSql: "'ab'",
      diagnostics: [
        {
          code: "null-character-removed",
          path: ["columns", "col_c", "comment"],
        },
        {
          code: "null-character-removed",
          path: ["columns", "col_c", "defaultValue"],
        },
        {
          code: "null-character-removed",
          path: ["enums", "enum_mood", "values", 0],
        },
        {
          code: "null-character-removed",
          path: ["tables", "tbl_t", "comment"],
        },
      ],
    });
  });

  it.each([
    ["mysql", "('a\u0000b')"],
    ["sqlserver", "N'a\u0000b'"],
  ] as const)("keeps null characters for %s", (dialect, defaultSql) => {
    const model = buildSqlDdlModel(NULL_CHARACTER_SCHEMA, dialect);
    const table = findTable(model, "t");

    expect({
      enumValues: model.enums[0]?.values,
      tableComment: table?.comment,
      columnComment: table?.columns[0]?.comment,
      defaultSql: table?.columns[0]?.defaultSql,
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      enumValues: ["ok\u0000", "bad"],
      tableComment: "table\u0000note",
      columnComment: "column\u0000note",
      defaultSql,
      diagnostics: [],
    });
  });
});

function comments(model: SqlDdlModel): readonly string[] {
  const table = findTable(model, "t");
  return [table?.comment ?? "", table?.columns[0]?.comment ?? ""];
}

describe("buildSqlDdlModel comment limits", () => {
  it("truncates a MySQL column comment to 1024 code points and a table comment to 2048 and reports comment-truncated", () => {
    const schema = singleTableSchema("t".repeat(2049), {
      comment: "😀".repeat(1025),
    });

    const model = buildSqlDdlModel(schema, "mysql");

    expect({
      comments: comments(model),
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      comments: ["t".repeat(2048), "😀".repeat(1024)],
      diagnostics: [
        { code: "comment-truncated", path: ["columns", "col_c", "comment"] },
        { code: "comment-truncated", path: ["tables", "tbl_t", "comment"] },
      ],
    });
  });

  it("truncates a SQL Server comment to 3750 utf-16 code units without splitting a surrogate pair", () => {
    const schema = singleTableSchema("t".repeat(3751), {
      comment: `${"s".repeat(3749)}😀`,
    });

    const model = buildSqlDdlModel(schema, "sqlserver");

    expect({
      comments: comments(model),
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      comments: ["t".repeat(3750), "s".repeat(3749)],
      diagnostics: [
        { code: "comment-truncated", path: ["columns", "col_c", "comment"] },
        { code: "comment-truncated", path: ["tables", "tbl_t", "comment"] },
      ],
    });
  });

  it.each([
    ["mysql", "t".repeat(2048), "😀".repeat(1024)],
    ["sqlserver", "t".repeat(3750), `${"s".repeat(3748)}😀`],
  ] as const)(
    "keeps comments at exactly the limit on %s",
    (dialect, tableComment, columnComment) => {
      const schema = singleTableSchema(tableComment, {
        comment: columnComment,
      });

      const model = buildSqlDdlModel(schema, dialect);

      expect({
        comments: comments(model),
        diagnostics: model.diagnostics,
      }).toStrictEqual({
        comments: [tableComment, columnComment],
        diagnostics: [],
      });
    },
  );

  it("keeps long PostgreSQL comments", () => {
    const schema = singleTableSchema("t".repeat(5000), {
      comment: "c".repeat(5000),
    });

    const model = buildSqlDdlModel(schema, "postgresql");

    expect({
      comments: comments(model),
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      comments: ["t".repeat(5000), "c".repeat(5000)],
      diagnostics: [],
    });
  });
});

const UNINDEXABLE_SCHEMA = buildSchema({
  tables: [makeTable({ id: "tbl_t", primaryKeyColumnIds: ["col_doc"] })],
  columns: [
    column("col_doc", "tbl_t", { type: JSON_TYPE }),
    column("col_hash", "tbl_t", { type: { kind: "binary" }, isUnique: true }),
  ],
  indexes: [
    makeIndex({
      id: "idx_t_hash_ix",
      tableId: "tbl_t",
      columnIds: ["col_hash"],
    }),
  ],
});

// Table t: nullable unique "code" (filtered on SQL Server), nullable unique
// "ref_code" referenced by r, a unique index on (b nullable, a) and a unique
// index on nullable "c" referenced by r.
const NULLABLE_UNIQUE_SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_t", primaryKeyColumnIds: ["col_t_id"] }),
    makeTable({ id: "tbl_r", primaryKeyColumnIds: ["col_r_id"] }),
  ],
  columns: [
    column("col_t_id", "tbl_t", { name: "id" }),
    column("col_code", "tbl_t", { isNullable: true, isUnique: true }),
    column("col_ref_code", "tbl_t", { isNullable: true, isUnique: true }),
    column("col_a", "tbl_t"),
    column("col_b", "tbl_t", { isNullable: true }),
    column("col_c", "tbl_t", { isNullable: true }),
    column("col_r_id", "tbl_r", { name: "id" }),
    column("col_r_code", "tbl_r", { name: "code", isNullable: true }),
    column("col_r_c", "tbl_r", { name: "c", isNullable: true }),
  ],
  indexes: [
    makeIndex({
      id: "idx_ba",
      tableId: "tbl_t",
      columnIds: ["col_b", "col_a"],
      isUnique: true,
    }),
    makeIndex({
      id: "idx_c",
      tableId: "tbl_t",
      columnIds: ["col_c"],
      isUnique: true,
    }),
  ],
  relations: [
    makeRelation({
      id: "rel_code",
      fromTableId: "tbl_r",
      toTableId: "tbl_t",
      columnPairs: [{ fromColumnId: "col_r_code", toColumnId: "col_ref_code" }],
    }),
    makeRelation({
      id: "rel_c",
      fromTableId: "tbl_r",
      toTableId: "tbl_t",
      columnPairs: [{ fromColumnId: "col_r_c", toColumnId: "col_c" }],
    }),
  ],
});

describe("buildSqlDdlModel keys and indexes", () => {
  it.each([
    [
      "postgresql",
      { name: "t_pkey", columnNames: ["doc"] },
      [{ name: "t_hash_key", columnNames: ["hash"] }],
      ["t_hash_ix"],
    ],
    ["mysql", null, [], []],
    ["sqlserver", null, [], []],
  ] as const)(
    "drops constraints with json or binary columns on MySQL and SQL Server and keeps them on PostgreSQL: %s",
    (dialect, primaryKey, uniqueConstraints, indexNames) => {
      const model = buildSqlDdlModel(UNINDEXABLE_SCHEMA, dialect);

      expect({
        primaryKey: findTable(model, "t")?.primaryKey,
        uniqueConstraints: findTable(model, "t")?.uniqueConstraints,
        indexNames: model.indexes.map((index) => index.name),
      }).toStrictEqual({ primaryKey, uniqueConstraints, indexNames });
    },
  );

  it("moves a nullable unique column to a filtered unique index on SQL Server", () => {
    const model = buildSqlDdlModel(NULLABLE_UNIQUE_SCHEMA, "sqlserver");

    expect({
      uniqueNames: findTable(model, "t")?.uniqueConstraints.map(
        (unique) => unique.name,
      ),
      filteredIndex: model.indexes.find((index) => index.name === "t_code_key"),
    }).toStrictEqual({
      uniqueNames: ["t_ref_code_key"],
      filteredIndex: {
        name: "t_code_key",
        tableName: "t",
        columnNames: ["code"],
        isUnique: true,
        filterColumnNames: ["code"],
      },
    });
  });

  it("adds filter columns to a nullable unique index on SQL Server", () => {
    const model = buildSqlDdlModel(NULLABLE_UNIQUE_SCHEMA, "sqlserver");

    expect(model.indexes.find((index) => index.name === "ba")).toStrictEqual({
      name: "ba",
      tableName: "t",
      columnNames: ["b", "a"],
      isUnique: true,
      filterColumnNames: ["b"],
    });
  });

  it("keeps a referenced nullable unique as a constraint and reports unique-nulls-restricted", () => {
    const model = buildSqlDdlModel(NULLABLE_UNIQUE_SCHEMA, "sqlserver");

    expect({
      referencedIndex: model.indexes.find((index) => index.name === "c"),
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      referencedIndex: {
        name: "c",
        tableName: "t",
        columnNames: ["c"],
        isUnique: true,
        filterColumnNames: [],
      },
      diagnostics: [
        {
          code: "unique-nulls-restricted",
          path: ["columns", "col_ref_code", "isUnique"],
        },
        { code: "unique-nulls-restricted", path: ["indexes", "idx_c"] },
      ],
    });
  });

  it("writes filtered unique indexes after the user indexes", () => {
    const model = buildSqlDdlModel(NULLABLE_UNIQUE_SCHEMA, "sqlserver");

    expect(model.indexes.map((index) => index.name)).toStrictEqual([
      "ba",
      "c",
      "t_code_key",
    ]);
  });

  it.each([
    ["postgresql", []],
    ["mysql", []],
    [
      "sqlserver",
      [{ name: "t_status_check", columnName: "status", values: ["on", "off"] }],
    ],
  ] as const)(
    "writes enum checks only for SQL Server: %s",
    (dialect, checks) => {
      const schema = buildSchema({
        enums: [makeEnum({ id: "enum_status", values: ["on", "off"] })],
        tables: [makeTable({ id: "tbl_t" })],
        columns: [
          column("col_status", "tbl_t", {
            type: { kind: "enum", enumId: "enum_status" },
          }),
        ],
      });

      const model = buildSqlDdlModel(schema, dialect);

      expect(findTable(model, "t")?.enumChecks).toStrictEqual(checks);
    },
  );

  it("uses the allocated constraint names", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_t", primaryKeyColumnIds: ["col_t_id"] }),
        makeTable({ id: "tbl_t_pkey", primaryKeyColumnIds: ["col_k_id"] }),
      ],
      columns: [
        column("col_t_id", "tbl_t", { name: "id" }),
        column("col_k_id", "tbl_t_pkey", { name: "id" }),
      ],
    });

    const model = buildSqlDdlModel(schema, "postgresql");

    expect(model.tables.map((table) => table.primaryKey?.name)).toStrictEqual([
      "t_pkey_2",
      "t_pkey_pkey",
    ]);
  });

  it("drops a MySQL unique index longer than 3072 bytes and the foreign key that references it", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_p", primaryKeyColumnIds: ["col_p_id"] }),
        makeTable({ id: "tbl_c" }),
      ],
      columns: [
        column("col_p_id", "tbl_p", { name: "id" }),
        column("col_p_a", "tbl_p", { type: { kind: "varchar", length: 700 } }),
        column("col_p_b", "tbl_p", { type: { kind: "varchar", length: 700 } }),
        column("col_c_a", "tbl_c", { type: { kind: "varchar", length: 700 } }),
        column("col_c_b", "tbl_c", { type: { kind: "varchar", length: 700 } }),
      ],
      indexes: [
        makeIndex({
          id: "idx_ab",
          tableId: "tbl_p",
          columnIds: ["col_p_a", "col_p_b"],
          isUnique: true,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_c",
          fromTableId: "tbl_c",
          toTableId: "tbl_p",
          columnPairs: [
            { fromColumnId: "col_c_a", toColumnId: "col_p_a" },
            { fromColumnId: "col_c_b", toColumnId: "col_p_b" },
          ],
        }),
      ],
    });

    const model = buildSqlDdlModel(schema, "mysql");

    expect({
      indexes: model.indexes,
      foreignKeys: model.foreignKeys,
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      indexes: [],
      foreignKeys: [],
      diagnostics: [
        { code: "key-column-type-not-indexable", path: ["indexes", "idx_ab"] },
        {
          code: "key-column-type-not-indexable",
          path: ["relations", "rel_c"],
        },
      ],
    });
  });

  it.each([
    ["whose primary key was dropped", ["col_id", "col_doc"], JSON_TYPE],
    [
      "that is second in a composite primary key",
      ["col_doc", "col_id"],
      { kind: "integer" },
    ],
  ] as const)(
    "adds a plain MySQL index for an auto-increment column %s",
    (_label, primaryKeyColumnIds, otherType) => {
      const schema = buildSchema({
        tables: [makeTable({ id: "tbl_t", primaryKeyColumnIds })],
        columns: [
          column("col_id", "tbl_t", {
            type: { kind: "bigint" },
            isAutoIncrement: true,
          }),
          column("col_doc", "tbl_t", { type: otherType }),
        ],
      });

      const model = buildSqlDdlModel(schema, "mysql");

      expect(model.indexes).toStrictEqual([
        {
          name: "t_id_idx",
          tableName: "t",
          columnNames: ["id"],
          isUnique: false,
          filterColumnNames: [],
        },
      ]);
    },
  );

  it("uses nvarchar for SQL Server nchar key columns over the fixed-length limit and for the columns paired with them", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_p", primaryKeyColumnIds: ["col_p_code"] }),
        makeTable({ id: "tbl_c" }),
      ],
      columns: [
        column("col_p_code", "tbl_p", { type: { kind: "char", length: 500 } }),
        column("col_c_code", "tbl_c", { type: { kind: "char", length: 500 } }),
      ],
      relations: [
        makeRelation({
          id: "rel_c",
          fromTableId: "tbl_c",
          toTableId: "tbl_p",
          columnPairs: [
            { fromColumnId: "col_c_code", toColumnId: "col_p_code" },
          ],
        }),
      ],
    });

    const model = buildSqlDdlModel(schema, "sqlserver");

    expect({
      types: model.tables.map((table) => table.columns[0]?.type),
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      types: [
        { kind: "varchar", length: 500 },
        { kind: "varchar", length: 500 },
      ],
      diagnostics: [
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_c_code", "type"],
        },
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_p_code", "type"],
        },
      ],
    });
  });

  it("parenthesizes the default of a MySQL column moved to text for the row size", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", primaryKeyColumnIds: ["col_id"] })],
      columns: [
        column("col_id", "tbl_t"),
        column("col_v", "tbl_t", {
          type: { kind: "varchar", length: 16_383 },
          defaultValue: literal("x"),
        }),
      ],
    });

    const model = buildSqlDdlModel(schema, "mysql");

    expect(findTable(model, "t")?.columns[1]).toStrictEqual({
      columnId: "col_v",
      name: "v",
      type: { kind: "text" },
      isNullable: false,
      isAutoIncrement: false,
      defaultSql: "('x')",
      comment: "",
    });
  });
});

describe("buildSqlDdlModel foreign keys", () => {
  it("orders foreign key columns by the referenced key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_p", primaryKeyColumnIds: ["col_k2", "col_k1"] }),
        makeTable({ id: "tbl_c" }),
      ],
      columns: [
        column("col_k1", "tbl_p"),
        column("col_k2", "tbl_p"),
        column("col_c1", "tbl_c"),
        column("col_c2", "tbl_c"),
      ],
      relations: [
        makeRelation({
          id: "rel_c",
          fromTableId: "tbl_c",
          toTableId: "tbl_p",
          columnPairs: [
            { fromColumnId: "col_c1", toColumnId: "col_k1" },
            { fromColumnId: "col_c2", toColumnId: "col_k2" },
          ],
        }),
      ],
    });

    const model = buildSqlDdlModel(schema, "postgresql");

    expect(model.foreignKeys).toStrictEqual([
      {
        name: "c_c2_c1_fkey",
        tableName: "c",
        columnNames: ["c2", "c1"],
        referencedTableName: "p",
        referencedColumnNames: ["k2", "k1"],
        onDelete: "noAction",
        onUpdate: "noAction",
      },
    ]);
  });

  it("downgrades both actions of a cascade conflict on SQL Server and reports referential-action-cycle", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_tree", primaryKeyColumnIds: ["col_id"] })],
      columns: [
        column("col_id", "tbl_tree"),
        column("col_parent_id", "tbl_tree", { isNullable: true }),
      ],
      relations: [
        makeRelation({
          id: "rel_parent",
          fromTableId: "tbl_tree",
          toTableId: "tbl_tree",
          columnPairs: [
            { fromColumnId: "col_parent_id", toColumnId: "col_id" },
          ],
          onDelete: "cascade",
          onUpdate: "cascade",
        }),
      ],
    });

    const model = buildSqlDdlModel(schema, "sqlserver");

    expect({
      actions: model.foreignKeys.map((key) => [key.onDelete, key.onUpdate]),
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      actions: [["noAction", "noAction"]],
      diagnostics: [
        { code: "referential-action-cycle", path: ["relations", "rel_parent"] },
      ],
    });
  });

  it("maps set default to no action on MySQL and reports each event", () => {
    const model = buildSqlDdlModel(
      relationSchema("setDefault", "setDefault"),
      "mysql",
    );

    expect({
      actions: model.foreignKeys.map((key) => [key.onDelete, key.onUpdate]),
      diagnostics: model.diagnostics,
    }).toStrictEqual({
      actions: [["noAction", "noAction"]],
      diagnostics: [
        {
          code: "referential-action-not-supported",
          path: ["relations", "rel_c", "onDelete"],
        },
        {
          code: "referential-action-not-supported",
          path: ["relations", "rel_c", "onUpdate"],
        },
      ],
    });
  });

  it("writes restrict as no action on SQL Server without a diagnostic", () => {
    const model = buildSqlDdlModel(
      relationSchema("restrict", "restrict"),
      "sqlserver",
    );

    expect({
      actions: model.foreignKeys.map((key) => [key.onDelete, key.onUpdate]),
      diagnostics: model.diagnostics,
    }).toStrictEqual({ actions: [["noAction", "noAction"]], diagnostics: [] });
  });
});

describe("buildSqlDdlModel diagnostics", () => {
  it.each([
    ["postgresql", ["type-parameter-out-of-range"]],
    [
      "mysql",
      [
        "comment-truncated",
        "key-column-type-narrowed",
        "key-column-type-not-indexable",
        "referential-action-not-supported",
        "type-parameter-out-of-range",
      ],
    ],
    [
      "sqlserver",
      [
        "comment-truncated",
        "key-column-type-narrowed",
        "key-column-type-not-indexable",
        "referential-action-cycle",
        "type-parameter-out-of-range",
        "unique-nulls-restricted",
      ],
    ],
  ] as const)(
    "reports the expected diagnostic codes for createTargetLimitSchema on %s",
    (dialect, codes) => {
      const model = buildSqlDdlModel(createTargetLimitSchema(), dialect);

      expect(
        [
          ...new Set(model.diagnostics.map((diagnostic) => diagnostic.code)),
        ].toSorted(),
      ).toStrictEqual(codes);
    },
  );

  it.each(SQL_DIALECTS)(
    "does not throw for a schema with duplicate names, an invalid default and an unsafe custom type on %s",
    (dialect: SqlDialect) => {
      const schema = buildSchema({
        tables: [
          makeTable({ id: "tbl_a", name: "dup" }),
          makeTable({ id: "tbl_b", name: "dup" }),
        ],
        columns: [
          column("col_a", "tbl_a", { name: "x", defaultValue: literal("x") }),
          column("col_b", "tbl_a", {
            name: "x",
            type: { kind: "custom", name: "x'); DROP TABLE t; --" },
          }),
        ],
      });

      expect(() => buildSqlDdlModel(schema, dialect)).not.toThrow();
    },
  );
});
