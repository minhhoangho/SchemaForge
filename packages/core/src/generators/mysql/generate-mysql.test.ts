import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import { createEmptySchema } from "../../model/create-empty-schema.js";
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
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { generateMysql } from "./generate-mysql.js";

const TABLE_OPTIONS =
  "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci";

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
  return generateMysql(schema, {}).file.content;
}

// Table "t" with the given columns (ids col_0, col_1, …) and primary key.
function tableSchema(
  columns: readonly Partial<Column>[],
  primaryKeyColumnIds: readonly ColumnId[] = [],
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_t", name: "t", primaryKeyColumnIds })],
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
      column("col_c_p_id", "tbl_c", { name: "p_id", comment: "Cha" }),
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

function generateLines(
  schema: SchemaDocument,
  start: number,
  end: number,
): { readonly lines: readonly string[]; readonly diagnostics: unknown } {
  const result = generateMysql(schema, {});
  return {
    lines: result.file.content.split("\n").slice(start, end),
    diagnostics: result.diagnostics,
  };
}

describe("generateMysql tables", () => {
  it("names the file schema.sql with language sql", () => {
    const { file } = generateMysql(createEmptySchema("Empty"), {});

    expect({ fileName: file.fileName, language: file.language }).toStrictEqual({
      fileName: "schema.sql",
      language: "sql",
    });
  });

  it("writes auto-increment, not null, default and comment in column order", () => {
    const schema = tableSchema(
      [
        { name: "id", type: { kind: "bigint" }, isAutoIncrement: true },
        {
          name: "email",
          type: { kind: "varchar", length: 255 },
          isNullable: true,
          defaultValue: literal("a@b.c"),
          comment: "Địa chỉ email",
        },
      ],
      ["col_0"],
    );

    expect(generate(schema)).toBe(
      [
        "CREATE TABLE `t` (",
        "  `id` BIGINT AUTO_INCREMENT NOT NULL,",
        "  `email` VARCHAR(255) DEFAULT 'a@b.c' COMMENT 'Địa chỉ email',",
        "  PRIMARY KEY (`id`)",
        `) ${TABLE_OPTIONS};`,
        "",
      ].join("\n"),
    );
  });

  it("writes an unnamed primary key and named unique constraints", () => {
    const schema = tableSchema(
      [
        { name: "a" },
        { name: "b" },
        { name: "code", type: { kind: "varchar", length: 10 }, isUnique: true },
      ],
      ["col_0", "col_1"],
    );

    expect(generate(schema)).toContain(
      [
        "  PRIMARY KEY (`a`, `b`),",
        "  CONSTRAINT `t_code_key` UNIQUE (`code`)",
        `) ${TABLE_OPTIONS};`,
      ].join("\n"),
    );
  });

  it("ends every table with InnoDB, utf8mb4 and the accent-sensitive collation", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", name: "a" }),
        makeTable({ id: "tbl_b", name: "b" }),
      ],
    });

    expect(generate(schema)).toBe(
      [
        `CREATE TABLE \`a\` () ${TABLE_OPTIONS};`,
        "",
        `CREATE TABLE \`b\` () ${TABLE_OPTIONS};`,
        "",
      ].join("\n"),
    );
  });

  it("writes a non-empty table comment as a table option", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", name: "t", comment: "Người dùng" })],
      columns: [column("col_id", "tbl_t", { name: "id" })],
    });

    expect(generate(schema)).toContain(
      `) ${TABLE_OPTIONS} COMMENT='Người dùng';`,
    );
  });

  it("wraps literal defaults of LONGTEXT and JSON columns in parentheses", () => {
    const schema = tableSchema([
      { name: "bio", type: { kind: "text" }, defaultValue: literal("a'b") },
      { name: "doc", type: { kind: "json" }, defaultValue: literal('{"a":1}') },
    ]);

    expect(generate(schema)).toContain(
      [
        "  `bio` LONGTEXT NOT NULL DEFAULT ('a''b'),",
        "  `doc` JSON NOT NULL DEFAULT ('{\"a\":1}')",
      ].join("\n"),
    );
  });

  it("writes CURRENT_TIMESTAMP(6) and (UUID()) defaults", () => {
    const schema = tableSchema([
      {
        name: "at",
        type: { kind: "timestamp" },
        defaultValue: { kind: "currentTimestamp" },
      },
      {
        name: "id",
        type: { kind: "uuid" },
        defaultValue: { kind: "generateUuid" },
      },
    ]);

    expect(generate(schema)).toContain(
      [
        "  `at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),",
        "  `id` CHAR(36) NOT NULL DEFAULT (UUID())",
      ].join("\n"),
    );
  });

  it("truncates fractional seconds of defaults to six digits", () => {
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

    expect(generateLines(schema, 1, 3)).toStrictEqual({
      lines: [
        "  `at` TIME(6) NOT NULL DEFAULT '12:34:56.123456',",
        "  `on` DATETIME(6) NOT NULL DEFAULT '2026-01-02T03:04:05.123456'",
      ],
      diagnostics: [],
    });
  });

  it("writes a UTC timestamptz default with a +00:00 offset", () => {
    const schema = tableSchema([
      {
        name: "at",
        type: { kind: "timestamptz" },
        defaultValue: literal("2026-01-02T03:04:05Z"),
      },
    ]);

    expect(generate(schema)).toContain(
      "  `at` TIMESTAMP(6) NOT NULL DEFAULT '2026-01-02T03:04:05+00:00'",
    );
  });

  it("writes an enum column as ENUM with its values", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_s", values: ["ma", "má"] })],
      tables: [makeTable({ id: "tbl_t", name: "t" })],
      columns: [
        column("col_s", "tbl_t", {
          name: "s",
          type: { kind: "enum", enumId: "enum_s" },
          defaultValue: literal("má"),
        }),
      ],
    });

    expect(generateLines(schema, 1, 2)).toStrictEqual({
      lines: ["  `s` ENUM('ma', 'má') NOT NULL DEFAULT 'má'"],
      diagnostics: [],
    });
  });

  it("escapes backslashes and quotes in string literals", () => {
    const schema = tableSchema([
      {
        name: "path",
        type: { kind: "varchar", length: 50 },
        defaultValue: literal("C:\\x 'y'"),
        comment: "a\\b 'c'",
      },
    ]);

    expect(generate(schema)).toContain(
      "  `path` VARCHAR(50) NOT NULL DEFAULT 'C:\\\\x ''y''' COMMENT 'a\\\\b ''c'''",
    );
  });

  it("quotes identifiers containing a backtick", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", name: "my`table" })],
      columns: [column("col_c", "tbl_t", { name: "a``b" })],
    });

    expect(generate(schema)).toBe(
      [
        "CREATE TABLE `my``table` (",
        "  `a````b` INT NOT NULL",
        `) ${TABLE_OPTIONS};`,
        "",
      ].join("\n"),
    );
  });

  it("truncates column and table comments beyond the MySQL limits and reports comment-truncated", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_t", name: "t", comment: "a".repeat(2049) }),
      ],
      columns: [
        column("col_x", "tbl_t", { name: "x", comment: "é".repeat(1025) }),
      ],
    });

    expect(generateLines(schema, 1, 3)).toStrictEqual({
      lines: [
        `  \`x\` INT NOT NULL COMMENT '${"é".repeat(1024)}'`,
        `) ${TABLE_OPTIONS} COMMENT='${"a".repeat(2048)}';`,
      ],
      diagnostics: [
        { code: "comment-truncated", path: ["columns", "col_x", "comment"] },
        { code: "comment-truncated", path: ["tables", "tbl_t", "comment"] },
      ],
    });
  });

  it("writes an empty schema as a single newline", () => {
    expect(generate(createEmptySchema("Empty"))).toBe("\n");
  });
});

describe("generateMysql key columns and row size", () => {
  it("narrows text key columns to VARCHAR(255) and reports key-column-type-narrowed", () => {
    const schema = tableSchema(
      [{ name: "k", type: { kind: "text" } }],
      ["col_0"],
    );

    expect(generateLines(schema, 1, 2)).toStrictEqual({
      lines: ["  `k` VARCHAR(255) NOT NULL,"],
      diagnostics: [
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_0", "type"],
        },
      ],
    });
  });

  it("narrows a varchar(1000) key column to VARCHAR(768)", () => {
    const schema = tableSchema(
      [{ name: "k", type: { kind: "varchar", length: 1000 } }],
      ["col_0"],
    );

    expect(generateLines(schema, 1, 2)).toStrictEqual({
      lines: ["  `k` VARCHAR(768) NOT NULL,"],
      diagnostics: [
        {
          code: "key-column-type-narrowed",
          path: ["columns", "col_0", "type"],
        },
      ],
    });
  });

  it("writes char(300) in a key as VARCHAR(300)", () => {
    const schema = tableSchema(
      [{ name: "k", type: { kind: "char", length: 300 } }],
      ["col_0"],
    );

    expect(generateLines(schema, 1, 2)).toStrictEqual({
      lines: ["  `k` VARCHAR(300) NOT NULL,"],
      diagnostics: [
        {
          code: "type-parameter-out-of-range",
          path: ["columns", "col_0", "type"],
        },
      ],
    });
  });

  it("writes LONGTEXT for the largest non-key varchar of a row over 65535 bytes and reports type-parameter-out-of-range", () => {
    const schema = tableSchema(
      [
        { name: "id" },
        { name: "v", type: { kind: "varchar", length: 16_383 } },
      ],
      ["col_0"],
    );

    expect(generateLines(schema, 1, 3)).toStrictEqual({
      lines: ["  `id` INT NOT NULL,", "  `v` LONGTEXT NOT NULL,"],
      diagnostics: [
        {
          code: "type-parameter-out-of-range",
          path: ["columns", "col_1", "type"],
        },
      ],
    });
  });

  it("omits constraints with json or binary columns and reports each", () => {
    const schema = tableSchema(
      [
        { name: "doc", type: { kind: "json" } },
        { name: "hash", type: { kind: "binary" }, isUnique: true },
      ],
      ["col_0"],
    );

    const result = generateMysql(schema, {});

    expect({
      content: result.file.content,
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      content: [
        "CREATE TABLE `t` (",
        "  `doc` JSON NOT NULL,",
        "  `hash` LONGBLOB NOT NULL",
        `) ${TABLE_OPTIONS};`,
        "",
      ].join("\n"),
      diagnostics: [
        {
          code: "key-column-type-not-indexable",
          path: ["columns", "col_1", "isUnique"],
        },
        {
          code: "key-column-type-not-indexable",
          path: ["tables", "tbl_t", "primaryKeyColumnIds"],
        },
      ],
    });
  });

  it("writes a plain index named <table>_<column>_idx for an auto-increment column that leads no key", () => {
    const schema = tableSchema(
      [
        { name: "a" },
        { name: "id", type: { kind: "bigint" }, isAutoIncrement: true },
      ],
      ["col_0", "col_1"],
    );

    const result = generateMysql(schema, {});

    expect({
      statements: result.file.content.split("\n\n").slice(1),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      statements: ["CREATE INDEX `t_id_idx` ON `t` (`id`);\n"],
      diagnostics: [],
    });
  });

  it("renames a column that differs only by case and uses the new name in keys", () => {
    const schema = tableSchema(
      [{ name: "ma" }, { name: "MA", isUnique: true }],
      ["col_1"],
    );

    expect(generateLines(schema, 1, 5)).toStrictEqual({
      lines: [
        "  `ma` INT NOT NULL,",
        "  `MA_2` INT NOT NULL,",
        "  PRIMARY KEY (`MA_2`),",
        "  CONSTRAINT `t_MA_key` UNIQUE (`MA_2`)",
      ],
      diagnostics: [
        {
          code: "identifier-collision-renamed",
          path: ["columns", "col_1", "name"],
        },
      ],
    });
  });

  it("keeps columns that differ only by an accent", () => {
    const schema = tableSchema([{ name: "ma" }, { name: "má" }]);

    expect(generateLines(schema, 1, 3)).toStrictEqual({
      lines: ["  `ma` INT NOT NULL,", "  `má` INT NOT NULL"],
      diagnostics: [],
    });
  });
});

describe("generateMysql indexes and foreign keys", () => {
  it("creates indexes before foreign keys", () => {
    expect(generate(relationSchema("cascade", "noAction"))).toContain(
      [
        "CREATE INDEX `c_p_id_idx` ON `c` (`p_id`);",
        "",
        "ALTER TABLE `c` ADD CONSTRAINT `c_p_id_fkey` FOREIGN KEY (`p_id`) REFERENCES `p` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION;",
      ].join("\n"),
    );
  });

  it("writes no statement after the foreign keys", () => {
    expect(generate(relationSchema("cascade", "noAction"))).toMatch(
      /ON UPDATE NO ACTION;\n$/,
    );
  });

  it.each<[ReferentialAction, string]>([
    ["restrict", "RESTRICT"],
    ["setNull", "SET NULL"],
  ])("writes %s as %s", (action, keyword) => {
    expect(generate(relationSchema(action, "noAction"))).toContain(
      `ON DELETE ${keyword} ON UPDATE NO ACTION;`,
    );
  });

  it("writes set default as NO ACTION and reports each event", () => {
    const result = generateMysql(
      relationSchema("setDefault", "setDefault"),
      {},
    );

    expect({
      hasActions: result.file.content.includes(
        "ON DELETE NO ACTION ON UPDATE NO ACTION;",
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasActions: true,
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

  it("omits an index longer than 3072 bytes and the foreign key that references it and reports each", () => {
    const varchar700: Column["type"] = { kind: "varchar", length: 700 };
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_p",
          name: "p",
          primaryKeyColumnIds: ["col_p_id"],
        }),
        makeTable({ id: "tbl_c", name: "c" }),
      ],
      columns: [
        column("col_p_id", "tbl_p", { name: "id" }),
        column("col_p_a", "tbl_p", { name: "a", type: varchar700 }),
        column("col_p_b", "tbl_p", { name: "b", type: varchar700 }),
        column("col_c_a", "tbl_c", { name: "a", type: varchar700 }),
        column("col_c_b", "tbl_c", { name: "b", type: varchar700 }),
      ],
      indexes: [
        makeIndex({
          id: "idx_ab",
          tableId: "tbl_p",
          name: "p_a_b_key",
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

    const result = generateMysql(schema, {});

    expect({
      hasIndexOrForeignKey: /CREATE UNIQUE INDEX|ALTER TABLE/.test(
        result.file.content,
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasIndexOrForeignKey: false,
      diagnostics: [
        { code: "key-column-type-not-indexable", path: ["indexes", "idx_ab"] },
        {
          code: "key-column-type-not-indexable",
          path: ["relations", "rel_c"],
        },
      ],
    });
  });
});

describe("generateMysql fixtures", () => {
  it("contains no CREATE TYPE, DROP, BEGIN or COMMIT for the sample schema", () => {
    expect(generate(createSampleSchema())).not.toMatch(
      /\b(?:CREATE TYPE|DROP|BEGIN|COMMIT)\b/,
    );
  });

  it.each<[string, () => SchemaDocument]>([
    ["sample", createSampleSchema],
    ["naming-edge", createNamingEdgeSchema],
    ["target-limit", createTargetLimitSchema],
    ["empty", () => createEmptySchema("Empty")],
  ])("matches the snapshot for %s", async (fixture, createSchema) => {
    const result = generateMysql(createSchema(), {});

    await expect(result.file.content).toMatchFileSnapshot(
      `../__snapshots__/mysql/${fixture}.sql`,
    );
    await expect(
      formatDiagnosticsSnapshot(result.diagnostics),
    ).toMatchFileSnapshot(`../__snapshots__/mysql/${fixture}.diagnostics.txt`);
  });
});
