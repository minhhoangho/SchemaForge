import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { ColumnType } from "../../model/column-type.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeTable,
} from "../../testing/factories.js";
import { resolveSchemaColumnTypes } from "../shared/dialect-column-types.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { renderDrizzleColumn } from "./drizzle-columns.js";
import type { DrizzleDialect, DrizzleVariableNames } from "./drizzle-names.js";

const ENUMS = buildSchema({
  enums: [makeEnum({ id: "enum_status", values: ["a", 'b"c'] })],
}).enums;

const NAMES: DrizzleVariableNames = {
  enumVariables: new Map([["enum_status", "statusEnum"]]),
  customTypeVariables: new Map([
    ["bytea", "byteaType"],
    ["longblob", "longblobType"],
    ["geometry", "geometryType"],
  ]),
  tableVariables: new Map(),
  relationsVariables: new Map(),
};

function column(overrides: Partial<Column> = {}): Column {
  return makeColumn({
    id: "col_c",
    tableId: "tbl_t",
    isNullable: true,
    ...overrides,
  });
}

// The model type only matters for defaults; output follows the dialect type.
function modelType(type: DialectColumnType): ColumnType {
  if (type.kind === "keyText") {
    return { kind: "text" };
  }
  return type.kind === "custom" ? { kind: "custom", name: type.name } : type;
}

function render(
  dialect: DrizzleDialect,
  type: DialectColumnType,
  overrides: Partial<Column> = {},
): ReturnType<typeof renderDrizzleColumn> {
  return renderDrizzleColumn({
    dialect,
    column: column({ type: modelType(type), ...overrides }),
    columnName: "c",
    type,
    names: NAMES,
    enums: ENUMS,
  });
}

function withDefault(
  dialect: DrizzleDialect,
  type: DialectColumnType,
  defaultValue: Column["defaultValue"],
): string {
  return render(dialect, type, { defaultValue }).expression;
}

const literal = (value: string): Column["defaultValue"] => ({
  kind: "literal",
  value,
});

describe("renderDrizzleColumn", () => {
  it.each<[DialectColumnType, string]>([
    [{ kind: "smallint" }, 'smallint("c")'],
    [{ kind: "integer" }, 'integer("c")'],
    [{ kind: "bigint" }, 'bigint("c", { mode: "bigint" })'],
    [
      { kind: "decimal", precision: 10, scale: 2 },
      'numeric("c", { precision: 10, scale: 2 })',
    ],
    [{ kind: "real" }, 'real("c")'],
    [{ kind: "double" }, 'doublePrecision("c")'],
    [{ kind: "boolean" }, 'boolean("c")'],
    [{ kind: "char", length: 3 }, 'char("c", { length: 3 })'],
    [{ kind: "varchar", length: 20 }, 'varchar("c", { length: 20 })'],
    [{ kind: "keyText", length: 255 }, 'varchar("c", { length: 255 })'],
    [{ kind: "text" }, 'text("c")'],
    [{ kind: "uuid" }, 'uuid("c")'],
    [{ kind: "date" }, 'date("c")'],
    [{ kind: "time" }, 'time("c", { precision: 6 })'],
    [{ kind: "timestamp" }, 'timestamp("c", { precision: 6 })'],
    [
      { kind: "timestamptz" },
      'timestamp("c", { precision: 6, withTimezone: true })',
    ],
    [{ kind: "json" }, 'jsonb("c")'],
    [{ kind: "binary" }, 'byteaType("c")'],
    [{ kind: "enum", enumId: "enum_status" }, 'statusEnum("c")'],
    [{ kind: "enum", enumId: "enum_missing" }, 'text("c")'],
    [{ kind: "custom", name: "geometry", isSafe: true }, 'geometryType("c")'],
  ])(
    "renders every dialect column type for postgresql (%j)",
    (type, expected) => {
      expect(render("postgresql", type).expression).toBe(expected);
    },
  );

  it.each<[DialectColumnType, string]>([
    [{ kind: "smallint" }, 'smallint("c")'],
    [{ kind: "integer" }, 'int("c")'],
    [{ kind: "bigint" }, 'bigint("c", { mode: "bigint" })'],
    [
      { kind: "decimal", precision: 10, scale: 2 },
      'decimal("c", { precision: 10, scale: 2 })',
    ],
    [{ kind: "real" }, 'float("c")'],
    [{ kind: "double" }, 'double("c")'],
    [{ kind: "boolean" }, 'boolean("c")'],
    [{ kind: "char", length: 3 }, 'char("c", { length: 3 })'],
    [{ kind: "varchar", length: 20 }, 'varchar("c", { length: 20 })'],
    [{ kind: "keyText", length: 255 }, 'varchar("c", { length: 255 })'],
    [{ kind: "text" }, 'longtext("c")'],
    [{ kind: "uuid" }, 'char("c", { length: 36 })'],
    [{ kind: "date" }, 'date("c")'],
    [{ kind: "time" }, 'time("c", { fsp: 6 })'],
    [{ kind: "timestamp" }, 'datetime("c", { fsp: 6 })'],
    [{ kind: "timestamptz" }, 'timestamp("c", { fsp: 6 })'],
    [{ kind: "json" }, 'json("c")'],
    [{ kind: "binary" }, 'longblobType("c")'],
    [{ kind: "enum", enumId: "enum_status" }, 'mysqlEnum("c", ["a", "b\\"c"])'],
    [{ kind: "enum", enumId: "enum_missing" }, 'longtext("c")'],
    [{ kind: "custom", name: "geometry", isSafe: true }, 'geometryType("c")'],
  ])("renders every dialect column type for mysql (%j)", (type, expected) => {
    expect(render("mysql", type).expression).toBe(expected);
  });

  it.each(["postgresql", "mysql"] as const)(
    "uses bigint mode bigint on both dialects (%s)",
    (dialect) => {
      expect(render(dialect, { kind: "bigint" })).toStrictEqual({
        expression: 'bigint("c", { mode: "bigint" })',
        builders: ["bigint"],
        diagnostics: [],
      });
    },
  );

  it.each([
    ["postgresql", 'byteaType("c")'],
    ["mysql", 'longblobType("c")'],
  ] as const)(
    "uses a customType for binary columns (%s)",
    (dialect, expected) => {
      expect(render(dialect, { kind: "binary" })).toStrictEqual({
        expression: expected,
        builders: [],
        diagnostics: [],
      });
    },
  );

  it("uses mysqlEnum with escaped values on mysql", () => {
    expect(
      render("mysql", { kind: "enum", enumId: "enum_status" }),
    ).toStrictEqual({
      expression: 'mysqlEnum("c", ["a", "b\\"c"])',
      builders: ["mysqlEnum"],
      diagnostics: [],
    });
  });

  it.each([
    ["postgresql", 'integer("c").notNull().generatedByDefaultAsIdentity()'],
    ["mysql", 'int("c").notNull().autoincrement()'],
  ] as const)(
    "appends notNull, identity and autoincrement (%s)",
    (dialect, expected) => {
      const { expression } = render(
        dialect,
        { kind: "integer" },
        {
          isNullable: false,
          isAutoIncrement: true,
          defaultValue: literal("1"),
        },
      );

      expect(expression).toBe(expected);
    },
  );

  it.each<[DrizzleDialect, DialectColumnType, Column["defaultValue"], string]>([
    [
      "postgresql",
      { kind: "integer" },
      literal("-5"),
      'integer("c").default(-5)',
    ],
    ["mysql", { kind: "smallint" }, literal("3"), 'smallint("c").default(3)'],
    [
      "postgresql",
      { kind: "boolean" },
      literal("true"),
      'boolean("c").default(true)',
    ],
    [
      "mysql",
      { kind: "boolean" },
      literal("false"),
      'boolean("c").default(false)',
    ],
    [
      "postgresql",
      { kind: "varchar", length: 5 },
      literal('a"b'),
      'varchar("c", { length: 5 }).default("a\\"b")',
    ],
    ["postgresql", { kind: "text" }, literal("x"), 'text("c").default("x")'],
    [
      "mysql",
      { kind: "uuid" },
      literal("123e4567-e89b-12d3-a456-426614174000"),
      'char("c", { length: 36 }).default("123e4567-e89b-12d3-a456-426614174000")',
    ],
    [
      "mysql",
      { kind: "decimal", precision: 4, scale: 2 },
      literal("1.50"),
      'decimal("c", { precision: 4, scale: 2 }).default("1.50")',
    ],
    [
      "mysql",
      { kind: "enum", enumId: "enum_status" },
      literal("a"),
      'mysqlEnum("c", ["a", "b\\"c"]).default("a")',
    ],
    [
      "postgresql",
      { kind: "timestamp" },
      { kind: "currentTimestamp" },
      'timestamp("c", { precision: 6 }).defaultNow()',
    ],
    [
      "postgresql",
      { kind: "uuid" },
      { kind: "generateUuid" },
      'uuid("c").defaultRandom()',
    ],
  ])(
    "uses typed defaults where drizzle has them (%s %j %j)",
    (dialect, type, defaultValue, expected) => {
      expect(withDefault(dialect, type, defaultValue)).toBe(expected);
    },
  );

  it.each<[DrizzleDialect, DialectColumnType, Column["defaultValue"], string]>([
    [
      "mysql",
      { kind: "timestamp" },
      { kind: "currentTimestamp" },
      'datetime("c", { fsp: 6 }).default(sql.raw("CURRENT_TIMESTAMP(6)"))',
    ],
    [
      "mysql",
      { kind: "uuid" },
      { kind: "generateUuid" },
      'char("c", { length: 36 }).default(sql.raw("(UUID())"))',
    ],
    [
      "mysql",
      { kind: "time" },
      literal("12:34:56.123456789"),
      'time("c", { fsp: 6 }).default(sql.raw("\'12:34:56.123456\'"))',
    ],
    [
      "postgresql",
      { kind: "bigint" },
      literal("9007199254740993"),
      'bigint("c", { mode: "bigint" }).default(sql.raw("9007199254740993"))',
    ],
    [
      "postgresql",
      { kind: "real" },
      literal("1.5"),
      'real("c").default(sql.raw("1.5"))',
    ],
    [
      "postgresql",
      { kind: "date" },
      literal("2024-01-02"),
      'date("c").default(sql.raw("\'2024-01-02\'"))',
    ],
    [
      "postgresql",
      { kind: "json" },
      literal('{"a":1}'),
      'jsonb("c").default(sql.raw("\'{\\"a\\":1}\'"))',
    ],
  ])(
    "uses sql.raw with the dialect literal for other defaults (%s %j %j)",
    (dialect, type, defaultValue, expected) => {
      expect(withDefault(dialect, type, defaultValue)).toBe(expected);
    },
  );

  it("adds sql to the builders when a default uses sql.raw", () => {
    const { builders } = render(
      "postgresql",
      { kind: "real" },
      { defaultValue: literal("1.5") },
    );

    expect(builders).toStrictEqual(["real", "sql"]);
  });

  it.each<[DialectColumnType, string, string]>([
    [{ kind: "text" }, "a'b", "longtext(\"c\").default(sql.raw(\"('a''b')\"))"],
    [{ kind: "json" }, "{}", 'json("c").default(sql.raw("(\'{}\')"))'],
  ])(
    "parenthesizes a mysql literal default on longtext and json (%j)",
    (type, value, expected) => {
      expect(withDefault("mysql", type, literal(value))).toBe(expected);
    },
  );

  it("uses sql.raw for a mysql varchar widened to longtext", () => {
    const wide = makeColumn({
      id: "col_wide",
      tableId: "tbl_t",
      isNullable: true,
      type: { kind: "varchar", length: 16000 },
      defaultValue: literal("x"),
    });
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t" })],
      columns: [
        wide,
        makeColumn({
          id: "col_narrow",
          tableId: "tbl_t",
          type: { kind: "varchar", length: 15000 },
        }),
      ],
    });
    const type = resolveSchemaColumnTypes(schema, "mysql").types.get(wide.id);

    expect(
      type === undefined
        ? null
        : renderDrizzleColumn({
            dialect: "mysql",
            column: wide,
            columnName: "wide",
            type,
            names: NAMES,
            enums: {},
          }).expression,
    ).toBe('longtext("wide").default(sql.raw("(\'x\')"))');
  });

  it("uses a typed default for a text key column narrowed to varchar on mysql", () => {
    expect(
      render(
        "mysql",
        { kind: "keyText", length: 255 },
        { type: { kind: "text" }, defaultValue: literal("x") },
      ).expression,
    ).toBe('varchar("c", { length: 255 }).default("x")');
  });

  it("omits an invalid default and reports default-omitted", () => {
    expect(
      render(
        "postgresql",
        { kind: "integer" },
        { defaultValue: literal("abc") },
      ),
    ).toStrictEqual({
      expression: 'integer("c")',
      builders: ["integer"],
      diagnostics: [
        { code: "default-omitted", path: ["columns", "col_c", "defaultValue"] },
      ],
    });
  });
});
