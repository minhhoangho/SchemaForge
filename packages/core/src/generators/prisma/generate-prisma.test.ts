import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { ColumnType } from "../../model/column-type.js";
import { createEmptySchema } from "../../model/create-empty-schema.js";
import type { ReferentialAction } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { SchemaParts } from "../../testing/factories.js";
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
import { resolveSchemaColumnTypes } from "../shared/dialect-column-types.js";
import type {
  GeneratorDiagnostic,
  SqlDialect,
} from "../shared/generator-types.js";
import { buildSqlDdlModel } from "../shared/sql-ddl-model.js";
import { generatePrisma } from "./generate-prisma.js";

const EMPTY_POSTGRESQL_SCHEMA = `generator client {
  provider = "prisma-client"
  output = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
`;

const ID_COLUMN = makeColumn({ id: "col_id", tableId: "tbl_users" });

function column(overrides: Partial<Column> & Pick<Column, "id">): Column {
  return makeColumn({ tableId: "tbl_users", ...overrides });
}

// A `users` table keyed by `id`, so it is never ignored.
function usersSchema(
  columns: readonly Column[],
  parts: SchemaParts = {},
): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_id"],
      }),
    ],
    columns: [ID_COLUMN, ...columns],
    ...parts,
  });
}

function valueColumn(type: ColumnType, value: string): Column {
  return column({
    id: "col_value",
    type,
    defaultValue: { kind: "literal", value },
  });
}

function generate(
  schema: SchemaDocument,
  provider: SqlDialect = "postgresql",
): string {
  return generatePrisma(schema, { provider }).file.content;
}

function diagnosticsOf(
  schema: SchemaDocument,
  provider: SqlDialect,
): readonly GeneratorDiagnostic[] {
  return generatePrisma(schema, { provider }).diagnostics;
}

function withCode(
  diagnostics: readonly GeneratorDiagnostic[],
  code: GeneratorDiagnostic["code"],
): readonly GeneratorDiagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.code === code);
}

function selfReference(
  onDelete: ReferentialAction,
  onUpdate: ReferentialAction = "noAction",
): SchemaDocument {
  return usersSchema(
    [column({ id: "col_parent_id", name: "parent_id", isNullable: true })],
    {
      relations: [
        makeRelation({
          id: "rel_parent",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_parent_id", toColumnId: "col_id" },
          ],
          onDelete,
          onUpdate,
        }),
      ],
    },
  );
}

// Reverses the key order of every id map; output must not depend on it.
function reverseMapKeys(schema: SchemaDocument): SchemaDocument {
  const reverse = <Value>(
    map: Readonly<Record<string, Value>>,
  ): Readonly<Record<string, Value>> =>
    Object.fromEntries(Object.entries(map).toReversed());
  return {
    ...schema,
    tables: reverse(schema.tables),
    columns: reverse(schema.columns),
    relations: reverse(schema.relations),
    indexes: reverse(schema.indexes),
    enums: reverse(schema.enums),
  };
}

describe("generatePrisma", () => {
  it("names the file schema.prisma with language prisma", () => {
    const { file } = generatePrisma(createEmptySchema("Empty"), {
      provider: "postgresql",
    });

    expect({ fileName: file.fileName, language: file.language }).toStrictEqual({
      fileName: "schema.prisma",
      language: "prisma",
    });
  });

  it("writes the prisma-client generator and a datasource without url", () => {
    expect(generate(createEmptySchema("Empty"))).toContain(
      'generator client {\n  provider = "prisma-client"\n  output = "../src/generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}',
    );
  });

  it.each<SqlDialect>(["postgresql", "mysql", "sqlserver"])(
    "writes the provider of the option (%s)",
    (provider) => {
      expect(generate(createEmptySchema("Empty"), provider)).toContain(
        `datasource db {\n  provider = "${provider}"\n}`,
      );
    },
  );

  it("throws RangeError for an unknown provider", () => {
    expect(() => {
      // Reflect.apply passes a provider outside the option type without a cast.
      Reflect.apply(generatePrisma, undefined, [
        createEmptySchema("Empty"),
        { provider: "oracle" },
      ]);
    }).toThrow(RangeError);
  });

  it.each<[SqlDialect, boolean]>([
    ["postgresql", true],
    ["mysql", true],
    ["sqlserver", false],
  ])("writes enums only for postgresql and mysql (%s)", (provider, hasEnum) => {
    const schema = usersSchema([], {
      enums: [makeEnum({ id: "enum_status", name: "status" })],
    });

    expect(generate(schema, provider).includes("enum Status {")).toBe(hasEnum);
  });

  it("suffixes a model named like a reserved word", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_string",
          name: "String",
          primaryKeyColumnIds: ["col_id"],
        }),
      ],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_string" })],
    });

    expect(generate(schema)).toContain(
      'model String_ {\n  id Int @id\n\n  @@map("String")\n}',
    );
  });

  it("maps a model and field to the original names with @@map and @map", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_items",
          name: "order items",
          primaryKeyColumnIds: ["col_id"],
        }),
      ],
      columns: [
        makeColumn({ id: "col_id", tableId: "tbl_items", name: "item id" }),
      ],
    });

    expect(generate(schema)).toContain(
      'model OrderItems {\n  itemId Int @id @map("item id")\n\n  @@map("order items")\n}',
    );
  });

  it.each<[string, SqlDialect, ColumnType, string, string]>([
    ["an integer", "postgresql", { kind: "integer" }, "42", "@default(42)"],
    [
      "a decimal",
      "postgresql",
      { kind: "decimal", precision: 5, scale: 2 },
      "-1.50",
      "@default(-1.50)",
    ],
    ["a plain real", "mysql", { kind: "real" }, "1.5", "@default(1.5)"],
    ["a boolean", "sqlserver", { kind: "boolean" }, "true", "@default(true)"],
    [
      "a string with quote and backslash",
      "postgresql",
      { kind: "varchar", length: 20 },
      'a"b\\c',
      '@default("a\\"b\\\\c")',
    ],
    [
      "a postgresql enum",
      "postgresql",
      { kind: "enum", enumId: "enum_status" },
      "đã giao",
      "@default(daGiao)",
    ],
    [
      "a sqlserver enum",
      "sqlserver",
      { kind: "enum", enumId: "enum_status" },
      "đã giao",
      '@default("đã giao")',
    ],
    [
      "a json value",
      "postgresql",
      { kind: "json" },
      '{"a":1}',
      '@default("{\\"a\\":1}")',
    ],
  ])(
    "writes literal defaults by column type (%s)",
    (_label, provider, type, value, expected) => {
      const schema = usersSchema([valueColumn(type, value)], {
        enums: [
          makeEnum({ id: "enum_status", values: ["pending", "đã giao"] }),
        ],
      });

      expect(generate(schema, provider)).toContain(expected);
    },
  );

  it.each<[SqlDialect, ColumnType, string, string]>([
    [
      "postgresql",
      { kind: "date" },
      "2024-01-31",
      `@default(dbgenerated("'2024-01-31'"))`,
    ],
    [
      "postgresql",
      { kind: "time" },
      "12:34:56.123456789",
      `@default(dbgenerated("'12:34:56.123456789'"))`,
    ],
    [
      "mysql",
      { kind: "time" },
      "12:34:56.123456789",
      `@default(dbgenerated("'12:34:56.123456'"))`,
    ],
    [
      "sqlserver",
      { kind: "time" },
      "12:34:56.123456789",
      `@default(dbgenerated("N'12:34:56.1234567'"))`,
    ],
    [
      "postgresql",
      { kind: "timestamp" },
      "2024-01-31T12:00:00",
      `@default(dbgenerated("'2024-01-31T12:00:00'"))`,
    ],
    [
      "postgresql",
      { kind: "custom", name: "point" },
      "(1,2)",
      `@default(dbgenerated("'(1,2)'"))`,
    ],
  ])(
    "writes dbgenerated with the dialect sql literal for date, time and timestamp defaults (%s %o)",
    (provider, type, value, expected) => {
      expect(
        generate(usersSchema([valueColumn(type, value)]), provider),
      ).toContain(expected);
    },
  );

  it.each<[SqlDialect, ColumnType, string, string]>([
    ["postgresql", { kind: "real" }, "1e10", '@default(dbgenerated("1e10"))'],
    ["mysql", { kind: "real" }, "1e10", '@default(dbgenerated("1e10"))'],
    ["sqlserver", { kind: "real" }, "1e10", '@default(dbgenerated("1e10"))'],
    [
      "postgresql",
      { kind: "double" },
      "-2.5E-3",
      '@default(dbgenerated("-2.5E-3"))',
    ],
    [
      "mysql",
      { kind: "double" },
      "-2.5E-3",
      '@default(dbgenerated("-2.5E-3"))',
    ],
    [
      "sqlserver",
      { kind: "double" },
      "-2.5E-3",
      '@default(dbgenerated("-2.5E-3"))',
    ],
    ["postgresql", { kind: "double" }, "1.5", "@default(1.5)"],
  ])(
    "writes an exponent real default as dbgenerated (%s %o %s)",
    (provider, type, value, expected) => {
      expect(
        generate(usersSchema([valueColumn(type, value)]), provider),
      ).toContain(expected);
    },
  );

  it.each<[string, SqlDialect, ColumnType, string, string]>([
    [
      "longtext",
      "mysql",
      { kind: "text" },
      "a'b",
      `@default(dbgenerated("('a''b')"))`,
    ],
    [
      "json",
      "mysql",
      { kind: "json" },
      '{"a":1}',
      `@default(dbgenerated("('{\\"a\\":1}')"))`,
    ],
    [
      "a varchar widened to longtext",
      "mysql",
      { kind: "varchar", length: 16_000 },
      "x",
      `@default(dbgenerated("('x')")) @db.LongText`,
    ],
    [
      "the same varchar on postgresql",
      "postgresql",
      { kind: "varchar", length: 16_000 },
      "x",
      '@default("x")',
    ],
  ])(
    "writes a mysql default on longtext, json and a varchar widened to longtext as a parenthesized dbgenerated (%s)",
    (_label, provider, type, value, expected) => {
      // The varchar(15000) neighbour pushes the row over 65 535 bytes, so R13
      // turns the larger varchar(16000) into LONGTEXT.
      const schema = usersSchema([
        valueColumn(type, value),
        column({ id: "col_other", type: { kind: "varchar", length: 15_000 } }),
      ]);

      expect(generate(schema, provider)).toContain(expected);
    },
  );

  it("omits an invalid default and reports default-omitted", () => {
    const schema = usersSchema([valueColumn({ kind: "integer" }, "abc")]);
    const result = generatePrisma(schema, { provider: "postgresql" });

    expect({
      line: result.file.content.includes("  value Int\n"),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      line: true,
      diagnostics: [
        {
          code: "default-omitted",
          path: ["columns", "col_value", "defaultValue"],
        },
      ],
    });
  });

  it.each<[Partial<Column>, string]>([
    [
      {
        isAutoIncrement: true,
        defaultValue: { kind: "literal", value: "5" },
      },
      "@default(autoincrement())",
    ],
    [
      {
        type: { kind: "timestamptz" },
        defaultValue: { kind: "currentTimestamp" },
      },
      "@default(now())",
    ],
    [
      { type: { kind: "uuid" }, defaultValue: { kind: "generateUuid" } },
      "@default(uuid())",
    ],
  ])(
    "writes autoincrement, now and uuid defaults (%o)",
    (overrides, expected) => {
      expect(
        generate(usersSchema([column({ id: "col_value", ...overrides })])),
      ).toContain(expected);
    },
  );

  it("downgrades a cascade cycle to NoAction on sqlserver and reports referential-action-cycle", () => {
    const result = generatePrisma(selfReference("cascade", "cascade"), {
      provider: "sqlserver",
    });

    expect({
      hasNoAction: result.file.content.includes(
        "onDelete: NoAction, onUpdate: NoAction",
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasNoAction: true,
      diagnostics: [
        { code: "referential-action-cycle", path: ["relations", "rel_parent"] },
      ],
    });
  });

  it("writes restrict as NoAction on sqlserver without a diagnostic", () => {
    const result = generatePrisma(selfReference("restrict", "restrict"), {
      provider: "sqlserver",
    });

    expect({
      hasNoAction: result.file.content.includes(
        "onDelete: NoAction, onUpdate: NoAction",
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({ hasNoAction: true, diagnostics: [] });
  });

  it("writes set default as NoAction on mysql and reports referential-action-not-supported", () => {
    const result = generatePrisma(selfReference("setDefault", "cascade"), {
      provider: "mysql",
    });

    expect({
      hasNoAction: result.file.content.includes(
        "onDelete: NoAction, onUpdate: Cascade",
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasNoAction: true,
      diagnostics: [
        {
          code: "referential-action-not-supported",
          path: ["relations", "rel_parent", "onDelete"],
        },
      ],
    });
  });

  const NULLABLE_UNIQUES = usersSchema(
    [
      column({ id: "col_email", isNullable: true, isUnique: true }),
      column({ id: "col_code", isNullable: true }),
      column({ id: "col_login", isUnique: true }),
    ],
    {
      indexes: [
        makeIndex({
          id: "idx_code",
          tableId: "tbl_users",
          columnIds: ["col_code"],
          isUnique: true,
        }),
      ],
    },
  );

  it("reports unique-nulls-restricted for every nullable unique on sqlserver", () => {
    expect(diagnosticsOf(NULLABLE_UNIQUES, "sqlserver")).toStrictEqual([
      {
        code: "unique-nulls-restricted",
        path: ["columns", "col_email", "isUnique"],
      },
      { code: "unique-nulls-restricted", path: ["indexes", "idx_code"] },
    ]);
  });

  it("does not report unique-nulls-restricted on postgresql", () => {
    expect(diagnosticsOf(NULLABLE_UNIQUES, "postgresql")).toStrictEqual([]);
  });

  it.each<SqlDialect>(["mysql", "sqlserver"])(
    "drops json keys on mysql and sqlserver like the sql generators (%s)",
    (provider) => {
      const schema = createTargetLimitSchema();
      const expected = withCode(
        buildSqlDdlModel(schema, provider).diagnostics,
        "key-column-type-not-indexable",
      );

      expect({
        prisma: withCode(
          diagnosticsOf(schema, provider),
          "key-column-type-not-indexable",
        ),
        isEmpty: expected.length === 0,
      }).toStrictEqual({ prisma: expected, isEmpty: false });
    },
  );

  it.each<SqlDialect>(["mysql", "sqlserver"])(
    "narrows key columns like the sql generator of the same dialect (%s)",
    (provider) => {
      const schema = createTargetLimitSchema();
      const expected = withCode(
        resolveSchemaColumnTypes(schema, provider).diagnostics,
        "key-column-type-narrowed",
      );

      expect({
        prisma: withCode(
          diagnosticsOf(schema, provider),
          "key-column-type-narrowed",
        ),
        isEmpty: expected.length === 0,
      }).toStrictEqual({ prisma: expected, isEmpty: false });
    },
  );

  it.each<[SqlDialect, string]>([
    ["mysql", "  login String @unique @db.VarChar(255)\n"],
    ["sqlserver", "  login String @unique @db.NVarChar(450)\n"],
  ])(
    "writes a narrowed text key with the narrowed native type (%s)",
    (provider, line) => {
      const schema = usersSchema([
        column({ id: "col_login", type: { kind: "text" }, isUnique: true }),
      ]);

      expect(generate(schema, provider)).toContain(line);
    },
  );

  it("adds an @@index named <table>_<column>_idx for a mysql auto-increment column that leads no key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_orders",
          name: "orders",
          primaryKeyColumnIds: ["col_tenant_id", "col_id"],
        }),
      ],
      columns: [
        makeColumn({
          id: "col_tenant_id",
          tableId: "tbl_orders",
          name: "tenant_id",
        }),
        makeColumn({
          id: "col_id",
          tableId: "tbl_orders",
          isAutoIncrement: true,
        }),
      ],
    });
    const result = generatePrisma(schema, { provider: "mysql" });

    expect({
      hasIndex: result.file.content.includes(
        '  @@id([tenantId, id])\n  @@index([id], map: "orders_id_idx")\n',
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({ hasIndex: true, diagnostics: [] });
  });

  it("renames a mysql column that differs only in case and reports identifier-collision-renamed", () => {
    const schema = usersSchema([
      column({ id: "col_ma", name: "ma" }),
      column({ id: "col_ma_upper", name: "MA" }),
    ]);
    const result = generatePrisma(schema, { provider: "mysql" });

    expect({
      hasLine: result.file.content.includes('  ma2 Int @map("MA_2")\n'),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasLine: true,
      diagnostics: [
        {
          code: "identifier-collision-renamed",
          path: ["columns", "col_ma_upper", "name"],
        },
      ],
    });
  });

  it("writes an empty schema as the generator and datasource blocks only", () => {
    expect(generate(createEmptySchema("Empty"))).toBe(EMPTY_POSTGRESQL_SCHEMA);
  });

  it.each<SqlDialect>(["postgresql", "mysql", "sqlserver"])(
    "returns the same content when map keys were inserted in a different order (%s)",
    (provider) => {
      const schema = createSampleSchema();

      expect(generate(reverseMapKeys(schema), provider)).toBe(
        generate(schema, provider),
      );
    },
  );

  it.each<[string, () => SchemaDocument, SqlDialect]>([
    ["sample", createSampleSchema, "postgresql"],
    ["sample", createSampleSchema, "mysql"],
    ["sample", createSampleSchema, "sqlserver"],
    ["naming-edge", createNamingEdgeSchema, "postgresql"],
    ["naming-edge", createNamingEdgeSchema, "mysql"],
    ["naming-edge", createNamingEdgeSchema, "sqlserver"],
    ["target-limit", createTargetLimitSchema, "postgresql"],
    ["target-limit", createTargetLimitSchema, "mysql"],
    ["target-limit", createTargetLimitSchema, "sqlserver"],
    ["empty", () => createEmptySchema("Empty"), "postgresql"],
    ["empty", () => createEmptySchema("Empty"), "mysql"],
    ["empty", () => createEmptySchema("Empty"), "sqlserver"],
  ])(
    "matches the snapshot for %s with %s",
    async (fixture, createSchema, provider) => {
      const result = generatePrisma(createSchema(), { provider });

      await expect(result.file.content).toMatchFileSnapshot(
        `../__snapshots__/prisma/${fixture}.${provider}.prisma`,
      );
      await expect(
        formatDiagnosticsSnapshot(result.diagnostics),
      ).toMatchFileSnapshot(
        `../__snapshots__/prisma/${fixture}.${provider}.diagnostics.txt`,
      );
    },
  );
});
