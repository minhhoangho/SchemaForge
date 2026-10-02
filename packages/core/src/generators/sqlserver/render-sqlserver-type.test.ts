import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import { buildSchema, makeEnum } from "../../testing/factories.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { renderSqlServerType } from "./render-sqlserver-type.js";

const NO_ENUMS: SchemaDocument["enums"] = {};

function enumsWithValues(values: readonly string[]): SchemaDocument["enums"] {
  return buildSchema({ enums: [makeEnum({ id: "enum_status", values })] })
    .enums;
}

const ENUM_TYPE: DialectColumnType = { kind: "enum", enumId: "enum_status" };

describe("renderSqlServerType", () => {
  it.each<[DialectColumnType, string]>([
    [{ kind: "smallint" }, "smallint"],
    [{ kind: "integer" }, "int"],
    [{ kind: "bigint" }, "bigint"],
    [{ kind: "decimal", precision: 10, scale: 2 }, "decimal(10, 2)"],
    [{ kind: "real" }, "real"],
    [{ kind: "double" }, "float(53)"],
    [{ kind: "boolean" }, "bit"],
    [{ kind: "char", length: 3 }, "nchar(3)"],
    [{ kind: "varchar", length: 255 }, "nvarchar(255)"],
    [{ kind: "keyText", length: 450 }, "nvarchar(450)"],
    [{ kind: "text" }, "nvarchar(max)"],
    [{ kind: "uuid" }, "uniqueidentifier"],
    [{ kind: "date" }, "date"],
    [{ kind: "time" }, "time"],
    [{ kind: "timestamp" }, "datetime2"],
    [{ kind: "timestamptz" }, "datetimeoffset"],
    [{ kind: "json" }, "nvarchar(max)"],
    [{ kind: "binary" }, "varbinary(max)"],
    [{ kind: "custom", name: "money", isSafe: true }, "money"],
  ])("renders every dialect column type (%o)", (type, expected) => {
    expect(renderSqlServerType(type, NO_ENUMS)).toBe(expected);
  });

  it("sizes an enum column by its longest value in UTF-16 code units", () => {
    // U+1F600 is outside the BMP, so it counts as 2 code units.
    const enums = enumsWithValues(["paid", "x\u{1F600}yz"]);

    expect(renderSqlServerType(ENUM_TYPE, enums)).toBe("nvarchar(5)");
  });

  it("sizes an enum with only empty values as nvarchar(1)", () => {
    expect(renderSqlServerType(ENUM_TYPE, enumsWithValues(["", ""]))).toBe(
      "nvarchar(1)",
    );
  });

  it("uses nvarchar(max) for an enum value longer than 4000 code units", () => {
    const enums = enumsWithValues(["a".repeat(4001)]);

    expect(renderSqlServerType(ENUM_TYPE, enums)).toBe("nvarchar(max)");
  });

  it("falls back to nvarchar(max) for a missing enum", () => {
    expect(renderSqlServerType(ENUM_TYPE, NO_ENUMS)).toBe("nvarchar(max)");
  });
});
