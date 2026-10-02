import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { EnumId } from "../../model/ids.js";
import { buildSchema, makeColumn, makeEnum } from "../../testing/factories.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import type { SqlDialect } from "../shared/generator-types.js";
import {
  formatPrismaString,
  renderPrismaFieldType,
} from "./prisma-field-type.js";

const ENUMS = buildSchema({
  enums: [
    makeEnum({ id: "enum_status", values: ["pending", "đã giao"] }),
    makeEnum({ id: "enum_long", values: ["a".repeat(4001)] }),
  ],
}).enums;

const ENUM_NAMES: ReadonlyMap<EnumId, string> = new Map([
  ["enum_status", "OrderStatus"],
  ["enum_long", "Long"],
]);

function render(
  provider: SqlDialect,
  type: DialectColumnType,
  overrides: Partial<Column> = {},
): ReturnType<typeof renderPrismaFieldType> {
  return renderPrismaFieldType({
    provider,
    column: makeColumn({ id: "col_a", tableId: "tbl_t", ...overrides }),
    type,
    enumNames: ENUM_NAMES,
    enums: ENUMS,
  });
}

function renderType(
  provider: SqlDialect,
  type: DialectColumnType,
): readonly [string, string | null] {
  const { typeName, nativeAttribute } = render(provider, type);
  return [typeName, nativeAttribute];
}

describe("formatPrismaString", () => {
  it("escapes backslashes and double quotes", () => {
    expect(formatPrismaString('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});

describe("renderPrismaFieldType", () => {
  it.each<[SqlDialect, DialectColumnType, string, string | null]>([
    ["postgresql", { kind: "smallint" }, "Int", "@db.SmallInt"],
    ["postgresql", { kind: "integer" }, "Int", null],
    ["postgresql", { kind: "bigint" }, "BigInt", null],
    [
      "postgresql",
      { kind: "decimal", precision: 10, scale: 2 },
      "Decimal",
      "@db.Decimal(10, 2)",
    ],
    ["postgresql", { kind: "real" }, "Float", "@db.Real"],
    ["postgresql", { kind: "double" }, "Float", null],
    ["postgresql", { kind: "boolean" }, "Boolean", null],
    ["postgresql", { kind: "char", length: 3 }, "String", "@db.Char(3)"],
    [
      "postgresql",
      { kind: "varchar", length: 80 },
      "String",
      "@db.VarChar(80)",
    ],
    ["postgresql", { kind: "text" }, "String", null],
    ["postgresql", { kind: "uuid" }, "String", "@db.Uuid"],
    ["postgresql", { kind: "date" }, "DateTime", "@db.Date"],
    ["postgresql", { kind: "time" }, "DateTime", "@db.Time(6)"],
    ["postgresql", { kind: "timestamp" }, "DateTime", "@db.Timestamp(6)"],
    ["postgresql", { kind: "timestamptz" }, "DateTime", "@db.Timestamptz(6)"],
    ["postgresql", { kind: "json" }, "Json", null],
    ["postgresql", { kind: "binary" }, "Bytes", null],
    ["mysql", { kind: "smallint" }, "Int", "@db.SmallInt"],
    ["mysql", { kind: "integer" }, "Int", null],
    ["mysql", { kind: "bigint" }, "BigInt", null],
    [
      "mysql",
      { kind: "decimal", precision: 65, scale: 30 },
      "Decimal",
      "@db.Decimal(65, 30)",
    ],
    ["mysql", { kind: "real" }, "Float", "@db.Float"],
    ["mysql", { kind: "double" }, "Float", null],
    ["mysql", { kind: "boolean" }, "Boolean", null],
    ["mysql", { kind: "char", length: 3 }, "String", "@db.Char(3)"],
    ["mysql", { kind: "varchar", length: 80 }, "String", "@db.VarChar(80)"],
    ["mysql", { kind: "text" }, "String", "@db.LongText"],
    ["mysql", { kind: "uuid" }, "String", "@db.Char(36)"],
    ["mysql", { kind: "date" }, "DateTime", "@db.Date"],
    ["mysql", { kind: "time" }, "DateTime", "@db.Time(6)"],
    ["mysql", { kind: "timestamp" }, "DateTime", "@db.DateTime(6)"],
    ["mysql", { kind: "timestamptz" }, "DateTime", "@db.Timestamp(6)"],
    ["mysql", { kind: "json" }, "Json", null],
    ["mysql", { kind: "binary" }, "Bytes", "@db.LongBlob"],
    ["sqlserver", { kind: "smallint" }, "Int", "@db.SmallInt"],
    ["sqlserver", { kind: "integer" }, "Int", null],
    ["sqlserver", { kind: "bigint" }, "BigInt", null],
    [
      "sqlserver",
      { kind: "decimal", precision: 38, scale: 4 },
      "Decimal",
      "@db.Decimal(38, 4)",
    ],
    ["sqlserver", { kind: "real" }, "Float", "@db.Real"],
    ["sqlserver", { kind: "double" }, "Float", null],
    ["sqlserver", { kind: "boolean" }, "Boolean", null],
    ["sqlserver", { kind: "text" }, "String", "@db.NVarChar(Max)"],
    ["sqlserver", { kind: "uuid" }, "String", "@db.UniqueIdentifier"],
    ["sqlserver", { kind: "date" }, "DateTime", "@db.Date"],
    ["sqlserver", { kind: "time" }, "DateTime", "@db.Time"],
    ["sqlserver", { kind: "timestamp" }, "DateTime", "@db.DateTime2"],
    ["sqlserver", { kind: "timestamptz" }, "DateTime", "@db.DateTimeOffset"],
    ["sqlserver", { kind: "binary" }, "Bytes", null],
  ])(
    "maps every dialect column type for each provider (%s %o)",
    (provider, type, typeName, nativeAttribute) => {
      expect(renderType(provider, type)).toStrictEqual([
        typeName,
        nativeAttribute,
      ]);
    },
  );

  it.each<[DialectColumnType, string]>([
    [{ kind: "char", length: 3 }, "@db.NChar(3)"],
    [{ kind: "varchar", length: 80 }, "@db.NVarChar(80)"],
  ])("uses NChar and NVarChar on sqlserver (%o)", (type, nativeAttribute) => {
    expect(renderType("sqlserver", type)).toStrictEqual([
      "String",
      nativeAttribute,
    ]);
  });

  it.each<[SqlDialect, number, string]>([
    ["mysql", 255, "@db.VarChar(255)"],
    ["sqlserver", 450, "@db.NVarChar(450)"],
  ])(
    "maps a narrowed key text to VarChar(255) on mysql and NVarChar(450) on sqlserver (%s)",
    (provider, length, nativeAttribute) => {
      expect(renderType(provider, { kind: "keyText", length })).toStrictEqual([
        "String",
        nativeAttribute,
      ]);
    },
  );

  it("maps json to NVarChar(Max) on sqlserver and reports type-not-supported", () => {
    expect(render("sqlserver", { kind: "json" })).toStrictEqual({
      typeName: "String",
      nativeAttribute: "@db.NVarChar(Max)",
      diagnostics: [
        { code: "type-not-supported", path: ["columns", "col_a", "type"] },
      ],
    });
  });

  it("maps an enum to NVarChar sized by its longest value on sqlserver and reports enum-not-supported", () => {
    expect(
      render("sqlserver", { kind: "enum", enumId: "enum_status" }),
    ).toStrictEqual({
      typeName: "String",
      nativeAttribute: "@db.NVarChar(7)",
      diagnostics: [
        { code: "enum-not-supported", path: ["columns", "col_a", "type"] },
      ],
    });
  });

  it("uses NVarChar(Max) for an enum value longer than 4000 code units and reports type-parameter-out-of-range", () => {
    expect(
      render("sqlserver", { kind: "enum", enumId: "enum_long" }),
    ).toStrictEqual({
      typeName: "String",
      nativeAttribute: "@db.NVarChar(Max)",
      diagnostics: [
        { code: "enum-not-supported", path: ["columns", "col_a", "type"] },
        {
          code: "type-parameter-out-of-range",
          path: ["columns", "col_a", "type"],
        },
      ],
    });
  });

  it("writes a custom type as Unsupported with an escaped name", () => {
    expect(
      render("postgresql", {
        kind: "custom",
        name: 'geometry"x\\',
        isSafe: false,
      }),
    ).toStrictEqual({
      typeName: 'Unsupported("geometry\\"x\\\\")',
      nativeAttribute: null,
      diagnostics: [],
    });
  });

  it("appends a question mark to a nullable column type", () => {
    expect(
      render("postgresql", { kind: "uuid" }, { isNullable: true }).typeName,
    ).toBe("String?");
  });

  it.each<SqlDialect>(["postgresql", "mysql"])(
    "references the allocated enum name on postgresql and mysql (%s)",
    (provider) => {
      expect(
        render(provider, { kind: "enum", enumId: "enum_status" }),
      ).toStrictEqual({
        typeName: "OrderStatus",
        nativeAttribute: null,
        diagnostics: [],
      });
    },
  );

  it("falls back to String for an enum that is not in the schema", () => {
    expect(
      renderType("postgresql", { kind: "enum", enumId: "enum_missing" }),
    ).toStrictEqual(["String", null]);
  });

  it("reports no diagnostic for a plain type", () => {
    expect(render("sqlserver", { kind: "integer" }).diagnostics).toStrictEqual(
      [],
    );
  });
});
