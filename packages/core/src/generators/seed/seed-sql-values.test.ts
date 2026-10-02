import { describe, expect, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import type { EnumId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { makeColumn, makeEnum } from "../../testing/factories.js";
import type { SqlDialect } from "../shared/generator-types.js";
import type { JsonValue } from "../shared/json-representation.js";
import { formatSeedSqlValue } from "./seed-sql-values.js";

const STATUS_ENUM_ID: EnumId = "enum_status";
const ENUMS: SchemaDocument["enums"] = {
  [STATUS_ENUM_ID]: makeEnum({ id: STATUS_ENUM_ID, values: ["active"] }),
};

function formatValue(
  dialect: SqlDialect,
  type: ColumnType,
  value: JsonValue | undefined,
): string {
  const column = makeColumn({ id: "col_value", tableId: "tbl_items", type });
  return formatSeedSqlValue(dialect, column, value, ENUMS);
}

describe("formatSeedSqlValue", () => {
  it("writes DEFAULT for a missing key and NULL for null", () => {
    expect([
      formatValue("postgresql", { kind: "integer" }, undefined),
      formatValue("postgresql", { kind: "integer" }, null),
    ]).toStrictEqual(["DEFAULT", "NULL"]);
  });

  it.each<[ColumnType, JsonValue]>([
    [{ kind: "integer" }, "1"],
    [{ kind: "bigint" }, 1],
    [{ kind: "boolean" }, 1],
    [{ kind: "binary" }, "not base64!"],
    [{ kind: "enum", enumId: STATUS_ENUM_ID }, "missing"],
  ])(
    "writes NULL for a value of the wrong representation (%j)",
    (type, value) => {
      expect(formatValue("postgresql", type, value)).toBe("NULL");
    },
  );

  it.each<[SqlDialect, ColumnType, JsonValue, string]>([
    ["postgresql", { kind: "smallint" }, -5, "-5"],
    ["mysql", { kind: "integer" }, 42, "42"],
    ["sqlserver", { kind: "double" }, 1.5, "1.5"],
    ["postgresql", { kind: "bigint" }, "9007199254740993", "9007199254740993"],
    ["mysql", { kind: "decimal", precision: 10, scale: 2 }, "-12.34", "-12.34"],
    ["postgresql", { kind: "boolean" }, true, "true"],
    ["mysql", { kind: "boolean" }, false, "FALSE"],
    ["sqlserver", { kind: "boolean" }, true, "1"],
    ["postgresql", { kind: "text" }, "it's \\n", "'it''s \\n'"],
    ["mysql", { kind: "text" }, "it's \\n", "'it''s \\\\n'"],
    ["sqlserver", { kind: "text" }, "it's \\n", "N'it''s \\n'"],
    [
      "postgresql",
      { kind: "uuid" },
      "123e4567-e89b-42d3-a456-426614174000",
      "'123e4567-e89b-42d3-a456-426614174000'",
    ],
    ["sqlserver", { kind: "date" }, "2026-01-02", "N'2026-01-02'"],
    [
      "postgresql",
      { kind: "timestamptz" },
      "2026-01-02T03:04:05Z",
      "'2026-01-02T03:04:05Z'",
    ],
    ["postgresql", { kind: "json" }, { a: "it's" }, `'{"a":"it''s"}'`],
    ["mysql", { kind: "json" }, [1, true], "'[1,true]'"],
    [
      "sqlserver",
      { kind: "enum", enumId: STATUS_ENUM_ID },
      "active",
      "N'active'",
    ],
    ["postgresql", { kind: "custom", name: "citext" }, "x'y", "'x''y'"],
    ["postgresql", { kind: "custom", name: "point" }, { x: 1 }, `'{"x":1}'`],
  ])(
    "formats values by column type for each dialect (%s %j %j)",
    (dialect, type, value, expected) => {
      expect(formatValue(dialect, type, value)).toBe(expected);
    },
  );

  it.each<[SqlDialect, string]>([
    ["postgresql", "decode('AQID', 'base64')"],
    ["mysql", "FROM_BASE64('AQID')"],
    [
      "sqlserver",
      "CAST(N'' AS XML).value('xs:base64Binary(\"AQID\")', 'varbinary(max)')",
    ],
  ])(
    "decodes base64 binary values for each dialect (%s)",
    (dialect, expected) => {
      expect(formatValue(dialect, { kind: "binary" }, "AQID")).toBe(expected);
    },
  );

  it.each<[SqlDialect, ColumnType, string, string]>([
    [
      "sqlserver",
      { kind: "timestamp" },
      "2026-01-02T03:04:05.123456789",
      "N'2026-01-02T03:04:05.1234567'",
    ],
    ["mysql", { kind: "time" }, "03:04:05.123456789", "'03:04:05.123456'"],
  ])(
    "truncates fractional seconds like the ddl defaults (%s)",
    (dialect, type, value, expected) => {
      expect(formatValue(dialect, type, value)).toBe(expected);
    },
  );

  it("removes a null character from a PostgreSQL string", () => {
    expect(formatValue("postgresql", { kind: "text" }, "a\u0000b")).toBe(
      "'ab'",
    );
  });
});
