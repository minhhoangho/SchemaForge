import { describe, expect, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import type { Column } from "../../model/column.js";
import { createEmptySchema } from "../../model/create-empty-schema.js";
import type { ColumnId, RelationId, TableId } from "../../model/ids.js";
import type { ReferentialAction, Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { generateSqlServer } from "./generate-sqlserver.js";

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

function generate(schema: SchemaDocument): string {
  return generateSqlServer(schema, {}).file.content;
}

// Table "t" with the given columns and no primary key.
function tableSchema(columns: readonly Partial<Column>[]): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_t", name: "t" })],
    columns: columns.map((overrides, position) =>
      column(`col_${String(position)}`, "tbl_t", overrides),
    ),
  });
}

// Parent "p" (id) and child "c" (id, p_id) with one relation c.p_id -> p.id
// and an index on c.p_id.
function relationSchema(
  onDelete: ReferentialAction,
  onUpdate: ReferentialAction,
): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_p", name: "p", primaryKeyColumnIds: ["col_p_id"] }),
      makeTable({ id: "tbl_c", name: "c", primaryKeyColumnIds: ["col_c_id"] }),
    ],
    columns: [
      column("col_p_id", "tbl_p", { name: "id" }),
      column("col_c_id", "tbl_c", { name: "id" }),
      column("col_c_p_id", "tbl_c", { name: "p_id" }),
    ],
    indexes: [
      makeIndex({
        id: "idx_c_p",
        tableId: "tbl_c",
        name: "c_p_id_idx",
        columnIds: ["col_c_p_id"],
      }),
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

// A one-column relation with cascade on both events.
function cascade(
  id: RelationId,
  [fromTableId, fromColumnId]: readonly [TableId, ColumnId],
  [toTableId, toColumnId]: readonly [TableId, ColumnId],
): Relation {
  return makeRelation({
    id,
    fromTableId,
    toTableId,
    columnPairs: [{ fromColumnId, toColumnId }],
    onDelete: "cascade",
    onUpdate: "cascade",
  });
}

// Table t: nullable unique "code", nullable unique "ref_code" referenced by r,
// and a unique index on (b nullable, a).
const NULLABLE_UNIQUE_SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_t", name: "t", primaryKeyColumnIds: ["col_t_id"] }),
    makeTable({ id: "tbl_r", name: "r", primaryKeyColumnIds: ["col_r_id"] }),
  ],
  columns: [
    column("col_t_id", "tbl_t", { name: "id" }),
    column("col_code", "tbl_t", {
      name: "code",
      isNullable: true,
      isUnique: true,
    }),
    column("col_ref_code", "tbl_t", {
      name: "ref_code",
      isNullable: true,
      isUnique: true,
    }),
    column("col_a", "tbl_t", { name: "a" }),
    column("col_b", "tbl_t", { name: "b", isNullable: true }),
    column("col_r_id", "tbl_r", { name: "id" }),
    column("col_r_code", "tbl_r", { name: "code", isNullable: true }),
  ],
  indexes: [
    makeIndex({
      id: "idx_ba",
      tableId: "tbl_t",
      name: "t_b_a_key",
      columnIds: ["col_b", "col_a"],
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
  ],
});

const CHAR_500: ColumnType = { kind: "char", length: 500 };

describe("generateSqlServer columns and constraints", () => {
  it("names the file schema.sql with language sql", () => {
    const { file } = generateSqlServer(createEmptySchema("Empty"), {});

    expect({ fileName: file.fileName, language: file.language }).toStrictEqual({
      fileName: "schema.sql",
      language: "sql",
    });
  });

  it("writes identity, explicit null or not null, and default in column order", () => {
    const schema = tableSchema([
      { name: "id", type: { kind: "bigint" }, isAutoIncrement: true },
      { name: "note", type: { kind: "text" }, isNullable: true },
      {
        name: "label",
        type: { kind: "varchar", length: 20 },
        defaultValue: literal("new"),
      },
    ]);

    expect(generate(schema)).toBe(
      [
        "CREATE TABLE [t] (",
        "  [id] bigint IDENTITY(1, 1) NOT NULL,",
        "  [note] nvarchar(max) NULL,",
        "  [label] nvarchar(20) NOT NULL DEFAULT N'new'",
        ");",
        "",
      ].join("\n"),
    );
  });

  it("writes primary key, unique and enum check constraints after the columns", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({
          id: "enum_status",
          name: "status",
          values: ["new", "paid"],
        }),
      ],
      tables: [
        makeTable({
          id: "tbl_orders",
          name: "orders",
          primaryKeyColumnIds: ["col_id"],
        }),
      ],
      columns: [
        column("col_id", "tbl_orders", { name: "id" }),
        column("col_code", "tbl_orders", {
          name: "code",
          type: { kind: "varchar", length: 10 },
          isUnique: true,
        }),
        column("col_status", "tbl_orders", {
          name: "status",
          type: { kind: "enum", enumId: "enum_status" },
          defaultValue: literal("new"),
        }),
      ],
    });

    expect(generate(schema)).toBe(
      [
        "CREATE TABLE [orders] (",
        "  [id] int NOT NULL,",
        "  [code] nvarchar(10) NOT NULL,",
        "  [status] nvarchar(4) NOT NULL DEFAULT N'new',",
        "  CONSTRAINT [orders_pkey] PRIMARY KEY ([id]),",
        "  CONSTRAINT [orders_code_key] UNIQUE ([code]),",
        "  CONSTRAINT [orders_status_check] CHECK ([status] IN (N'new', N'paid'))",
        ");",
        "",
      ].join("\n"),
    );
  });

  it("writes enum check values as N literals", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_mood", values: ["it's", "đã giao"] })],
      tables: [makeTable({ id: "tbl_t", name: "t" })],
      columns: [
        column("col_mood", "tbl_t", {
          name: "mood",
          type: { kind: "enum", enumId: "enum_mood" },
        }),
      ],
    });

    expect(generate(schema)).toContain(
      "CHECK ([mood] IN (N'it''s', N'đã giao'))",
    );
  });

  it("writes bit defaults as 1 and 0", () => {
    const schema = tableSchema([
      { name: "on", type: { kind: "boolean" }, defaultValue: literal("true") },
      {
        name: "off",
        type: { kind: "boolean" },
        defaultValue: literal("false"),
      },
    ]);

    expect(generate(schema)).toContain(
      ["  [on] bit NOT NULL DEFAULT 1,", "  [off] bit NOT NULL DEFAULT 0"].join(
        "\n",
      ),
    );
  });

  it("writes sysdatetime for datetime2 and sysdatetimeoffset for datetimeoffset", () => {
    const schema = tableSchema([
      {
        name: "a",
        type: { kind: "timestamp" },
        defaultValue: { kind: "currentTimestamp" },
      },
      {
        name: "b",
        type: { kind: "timestamptz" },
        defaultValue: { kind: "currentTimestamp" },
      },
    ]);

    expect(generate(schema)).toContain(
      [
        "  [a] datetime2 NOT NULL DEFAULT sysdatetime(),",
        "  [b] datetimeoffset NOT NULL DEFAULT sysdatetimeoffset()",
      ].join("\n"),
    );
  });

  it("writes newid() for generateUuid", () => {
    const schema = tableSchema([
      {
        name: "id",
        type: { kind: "uuid" },
        defaultValue: { kind: "generateUuid" },
      },
    ]);

    expect(generate(schema)).toContain(
      "  [id] uniqueidentifier NOT NULL DEFAULT newid()",
    );
  });

  it("truncates fractional seconds of time and datetime2 defaults to seven digits without a diagnostic", () => {
    const schema = tableSchema([
      {
        name: "at",
        type: { kind: "time" },
        defaultValue: literal("12:34:56.123456789"),
      },
      {
        name: "on",
        type: { kind: "timestamp" },
        defaultValue: literal("2026-01-02T03:04:05.123456789"),
      },
    ]);

    const result = generateSqlServer(schema, {});

    expect({
      content: result.file.content,
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      content: [
        "CREATE TABLE [t] (",
        "  [at] time NOT NULL DEFAULT N'12:34:56.1234567',",
        "  [on] datetime2 NOT NULL DEFAULT N'2026-01-02T03:04:05.1234567'",
        ");",
        "",
      ].join("\n"),
      diagnostics: [],
    });
  });

  it("narrows text key columns to nvarchar(450)", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_t", name: "t", primaryKeyColumnIds: ["col_k"] }),
      ],
      columns: [
        column("col_k", "tbl_t", { name: "k", type: { kind: "text" } }),
      ],
    });

    const result = generateSqlServer(schema, {});

    expect({
      line: result.file.content.split("\n")[1],
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      line: "  [k] nvarchar(450) NOT NULL,",
      diagnostics: [
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_k", "type"],
        },
      ],
    });
  });

  it("keeps a varchar(1000) key column as nvarchar(1000)", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_t", name: "t", primaryKeyColumnIds: ["col_k"] }),
      ],
      columns: [
        column("col_k", "tbl_t", {
          name: "k",
          type: { kind: "varchar", length: 1000 },
        }),
      ],
    });

    const result = generateSqlServer(schema, {});

    expect({
      content: result.file.content,
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      content: [
        "CREATE TABLE [t] (",
        "  [k] nvarchar(1000) NOT NULL,",
        "  CONSTRAINT [t_pkey] PRIMARY KEY ([k])",
        ");",
        "",
      ].join("\n"),
      diagnostics: [],
    });
  });

  it("writes nvarchar for nchar primary key and unique columns over the fixed-length limits and reports key-column-type-narrowed", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_t", name: "t", primaryKeyColumnIds: ["col_k"] }),
      ],
      columns: [
        column("col_k", "tbl_t", { name: "k", type: CHAR_500 }),
        column("col_u", "tbl_t", {
          name: "u",
          type: { kind: "char", length: 851 },
          isUnique: true,
        }),
      ],
    });

    const result = generateSqlServer(schema, {});

    expect({
      columns: result.file.content.split("\n").slice(1, 3),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      columns: [
        "  [k] nvarchar(500) NOT NULL,",
        "  [u] nvarchar(851) NOT NULL,",
      ],
      diagnostics: [
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_k", "type"],
        },
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_u", "type"],
        },
      ],
    });
  });

  it("writes nvarchar for a foreign key column paired with a narrowed primary key and reports it", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_p", name: "p", primaryKeyColumnIds: ["col_p_k"] }),
        makeTable({ id: "tbl_c", name: "c" }),
      ],
      columns: [
        column("col_p_k", "tbl_p", { name: "k", type: CHAR_500 }),
        column("col_c_k", "tbl_c", { name: "p_k", type: CHAR_500 }),
      ],
      relations: [
        makeRelation({
          id: "rel_c",
          fromTableId: "tbl_c",
          toTableId: "tbl_p",
          columnPairs: [{ fromColumnId: "col_c_k", toColumnId: "col_p_k" }],
        }),
      ],
    });

    const result = generateSqlServer(schema, {});

    expect({
      hasChildColumn: result.file.content.includes(
        "  [p_k] nvarchar(500) NOT NULL\n",
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasChildColumn: true,
      diagnostics: [
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_c_k", "type"],
        },
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_p_k", "type"],
        },
      ],
    });
  });

  it("omits constraints with json or binary columns and reports each", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_t", name: "t", primaryKeyColumnIds: ["col_doc"] }),
      ],
      columns: [
        column("col_doc", "tbl_t", { name: "doc", type: { kind: "json" } }),
        column("col_hash", "tbl_t", {
          name: "hash",
          type: { kind: "binary" },
          isUnique: true,
        }),
      ],
    });

    const result = generateSqlServer(schema, {});

    expect({
      content: result.file.content,
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      content: [
        "CREATE TABLE [t] (",
        "  [doc] nvarchar(max) NOT NULL,",
        "  [hash] varbinary(max) NOT NULL",
        ");",
        "",
      ].join("\n"),
      diagnostics: [
        {
          code: "key-column-type-not-indexable",
          path: ["columns", "col_hash", "isUnique"],
        },
        {
          code: "key-column-type-not-indexable",
          path: ["tables", "tbl_t", "primaryKeyColumnIds"],
        },
      ],
    });
  });

  it("reports type-parameter-out-of-range for an enum longer than 4000 code units", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_long", values: ["a".repeat(4001)] })],
      tables: [makeTable({ id: "tbl_t", name: "t" })],
      columns: [
        column("col_e", "tbl_t", {
          name: "e",
          type: { kind: "enum", enumId: "enum_long" },
        }),
      ],
    });

    const result = generateSqlServer(schema, {});

    expect({
      line: result.file.content.split("\n")[1],
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      line: "  [e] nvarchar(max) NOT NULL,",
      diagnostics: [
        {
          code: "type-parameter-out-of-range",
          path: ["columns", "col_e", "type"],
        },
      ],
    });
  });

  it("quotes identifiers containing a closing bracket", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", name: "my]table" })],
      columns: [column("col_c", "tbl_t", { name: "a]]b" })],
    });

    expect(generate(schema)).toBe(
      ["CREATE TABLE [my]]table] (", "  [a]]]]b] int NOT NULL", ");", ""].join(
        "\n",
      ),
    );
  });

  it("writes an empty schema as a single newline", () => {
    expect(generate(createEmptySchema("Empty"))).toBe("\n");
  });

  it.each(["int CHECK (x)", "text, extra int", "int REFERENCES other(id)"])(
    "replaces the unsafe custom type %s with nvarchar(max) and reports custom-type-unsafe",
    (name) => {
      const schema = buildSchema({
        tables: [makeTable({ id: "tbl_t", name: "t" })],
        columns: [
          column("col_c", "tbl_t", {
            name: "c",
            type: { kind: "custom", name },
          }),
        ],
      });

      const result = generateSqlServer(schema, {});

      expect({
        hasFallbackLine: result.file.content.includes(
          "  [c] nvarchar(max) NOT NULL",
        ),
        containsRawName: result.file.content.includes(name),
        diagnostics: result.diagnostics,
      }).toStrictEqual({
        hasFallbackLine: true,
        containsRawName: false,
        diagnostics: [
          { code: "custom-type-unsafe", path: ["columns", "col_c", "type"] },
        ],
      });
    },
  );
});

describe("generateSqlServer indexes and foreign keys", () => {
  it("moves a nullable unique column to a filtered unique index", () => {
    const content = generate(NULLABLE_UNIQUE_SCHEMA);

    expect({
      hasConstraint: content.includes("CONSTRAINT [t_code_key]"),
      hasIndex: content.includes(
        "CREATE UNIQUE INDEX [t_code_key] ON [t] ([code]) WHERE [code] IS NOT NULL;",
      ),
    }).toStrictEqual({ hasConstraint: false, hasIndex: true });
  });

  it("writes a WHERE clause for the nullable columns of a unique index", () => {
    expect(generate(NULLABLE_UNIQUE_SCHEMA)).toContain(
      "CREATE UNIQUE INDEX [t_b_a_key] ON [t] ([b], [a]) WHERE [b] IS NOT NULL;",
    );
  });

  it("writes user indexes before the filtered indexes of unique columns", () => {
    const content = generate(NULLABLE_UNIQUE_SCHEMA);

    expect(content.indexOf("[t_b_a_key]")).toBeLessThan(
      content.indexOf("[t_code_key]"),
    );
  });

  it("keeps a referenced nullable unique as a constraint and reports unique-nulls-restricted", () => {
    const result = generateSqlServer(NULLABLE_UNIQUE_SCHEMA, {});

    expect({
      hasConstraint: result.file.content.includes(
        "  CONSTRAINT [t_ref_code_key] UNIQUE ([ref_code])",
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasConstraint: true,
      diagnostics: [
        {
          code: "unique-nulls-restricted",
          path: ["columns", "col_ref_code", "isUnique"],
        },
      ],
    });
  });

  it("creates indexes before foreign keys", () => {
    const content = generate(relationSchema("cascade", "noAction"));

    expect(content).toContain(
      [
        "CREATE INDEX [c_p_id_idx] ON [c] ([p_id]);",
        "",
        "ALTER TABLE [c] ADD CONSTRAINT [c_p_id_fkey] FOREIGN KEY ([p_id]) REFERENCES [p] ([id]) ON DELETE CASCADE ON UPDATE NO ACTION;",
      ].join("\n"),
    );
  });

  it.each<[ReferentialAction, string]>([
    ["setNull", "SET NULL"],
    ["setDefault", "SET DEFAULT"],
  ])("writes %s as %s", (action, keyword) => {
    expect(generate(relationSchema(action, "noAction"))).toContain(
      `ON DELETE ${keyword} ON UPDATE NO ACTION;`,
    );
  });

  it("writes restrict as NO ACTION without a diagnostic", () => {
    const result = generateSqlServer(
      relationSchema("restrict", "restrict"),
      {},
    );

    expect({
      hasActions: result.file.content.includes(
        "ON DELETE NO ACTION ON UPDATE NO ACTION;",
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({ hasActions: true, diagnostics: [] });
  });

  it("downgrades a cascade cycle and a second cascade path to NO ACTION and reports referential-action-cycle", () => {
    // a.parent_id -> a.id is a cycle; c.b_id -> b.id is a second path a -> c.
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", name: "a", primaryKeyColumnIds: ["col_a"] }),
        makeTable({ id: "tbl_b", name: "b", primaryKeyColumnIds: ["col_b"] }),
        makeTable({ id: "tbl_c", name: "c" }),
      ],
      columns: [
        column("col_a", "tbl_a", { name: "id" }),
        column("col_a_parent", "tbl_a", { name: "parent_id" }),
        column("col_b", "tbl_b", { name: "id" }),
        column("col_b_a", "tbl_b", { name: "a_id" }),
        column("col_c_a", "tbl_c", { name: "a_id" }),
        column("col_c_b", "tbl_c", { name: "b_id" }),
      ],
      relations: [
        cascade("rel_a_parent", ["tbl_a", "col_a_parent"], ["tbl_a", "col_a"]),
        cascade("rel_b_a", ["tbl_b", "col_b_a"], ["tbl_a", "col_a"]),
        cascade("rel_c_a", ["tbl_c", "col_c_a"], ["tbl_a", "col_a"]),
        cascade("rel_c_b", ["tbl_c", "col_c_b"], ["tbl_b", "col_b"]),
      ],
    });

    const result = generateSqlServer(schema, {});

    expect({
      actions: result.file.content
        .split("\n")
        .filter((line) => line.startsWith("ALTER TABLE"))
        .map((line) => line.slice(line.indexOf(" ON DELETE"))),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      actions: [
        " ON DELETE NO ACTION ON UPDATE NO ACTION;",
        " ON DELETE CASCADE ON UPDATE CASCADE;",
        " ON DELETE CASCADE ON UPDATE CASCADE;",
        " ON DELETE NO ACTION ON UPDATE NO ACTION;",
      ],
      diagnostics: [
        {
          code: "referential-action-cycle",
          path: ["relations", "rel_a_parent"],
        },
        { code: "referential-action-cycle", path: ["relations", "rel_c_b"] },
      ],
    });
  });
});

describe("generateSqlServer comments and fixtures", () => {
  it("declares the schema name variable once before the extended properties", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", name: "a", comment: "Bảng a" }),
        makeTable({ id: "tbl_b", name: "b", comment: "Bảng b" }),
      ],
    });

    expect(generate(schema).split("\n\n").at(-1)).toBe(
      [
        "DECLARE @schema_name sysname = SCHEMA_NAME();",
        "EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Bảng a', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N'a';",
        "EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Bảng b', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N'b';",
        "",
      ].join("\n"),
    );
  });

  it("passes table and column names to sp_addextendedproperty as N literals", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", name: "it's" })],
      columns: [
        column("col_x", "tbl_t", { name: "o'clock", comment: "Giờ 'đúng'" }),
      ],
    });

    expect(generate(schema)).toContain(
      "EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Giờ ''đúng''', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N'it''s', @level2type = N'COLUMN', @level2name = N'o''clock';",
    );
  });

  it("writes table comments before their column comments", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", name: "t", comment: "T" })],
      columns: [
        column("col_x", "tbl_t", { name: "x", comment: "X" }),
        column("col_y", "tbl_t", { name: "y" }),
      ],
    });

    expect(
      generate(schema)
        .split("\n")
        .filter((line) => line.startsWith("EXEC"))
        .map((line) => line.slice(line.indexOf("@value"))),
    ).toStrictEqual([
      "@value = N'T', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N't';",
      "@value = N'X', @level0type = N'SCHEMA', @level0name = @schema_name, @level1type = N'TABLE', @level1name = N't', @level2type = N'COLUMN', @level2name = N'x';",
    ]);
  });

  it("writes no comment statements when no comment exists", () => {
    expect(generate(relationSchema("noAction", "noAction"))).not.toMatch(
      /DECLARE|sp_addextendedproperty/,
    );
  });

  it("truncates a comment beyond 3750 utf-16 code units and reports comment-truncated", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_t", name: "t", comment: "a".repeat(3751) }),
      ],
    });

    const result = generateSqlServer(schema, {});

    expect({
      hasTruncatedValue: result.file.content.includes(
        `@value = N'${"a".repeat(3750)}', `,
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasTruncatedValue: true,
      diagnostics: [
        { code: "comment-truncated", path: ["tables", "tbl_t", "comment"] },
      ],
    });
  });

  it("contains no GO batch separator for the naming edge schema", () => {
    expect(generate(createNamingEdgeSchema())).not.toMatch(/^GO\b/m);
  });

  it("contains no USE, BEGIN, COMMIT or DROP for the sample schema", () => {
    expect(generate(createSampleSchema())).not.toMatch(
      /\b(?:USE|BEGIN|COMMIT|DROP)\b/,
    );
  });

  it.each<[string, () => SchemaDocument]>([
    ["sample", createSampleSchema],
    ["naming-edge", createNamingEdgeSchema],
    ["target-limit", createTargetLimitSchema],
    ["empty", () => createEmptySchema("Empty")],
  ])("matches the snapshot for %s", async (fixture, createSchema) => {
    const result = generateSqlServer(createSchema(), {});

    await expect(result.file.content).toMatchFileSnapshot(
      `../__snapshots__/sqlserver/${fixture}.sql`,
    );
    await expect(
      formatDiagnosticsSnapshot(result.diagnostics),
    ).toMatchFileSnapshot(
      `../__snapshots__/sqlserver/${fixture}.diagnostics.txt`,
    );
  });
});
