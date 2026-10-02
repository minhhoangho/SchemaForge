import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import { buildSchema, makeEnum } from "../../testing/factories.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { renderMysqlType } from "./render-mysql-type.js";

const NO_ENUMS: SchemaDocument["enums"] = {};

const ENUM_TYPE: DialectColumnType = { kind: "enum", enumId: "enum_status" };

describe("renderMysqlType", () => {
  it.each<[DialectColumnType, string]>([
    [{ kind: "smallint" }, "SMALLINT"],
    [{ kind: "integer" }, "INT"],
    [{ kind: "bigint" }, "BIGINT"],
    [{ kind: "decimal", precision: 10, scale: 2 }, "DECIMAL(10, 2)"],
    [{ kind: "real" }, "FLOAT"],
    [{ kind: "double" }, "DOUBLE"],
    [{ kind: "boolean" }, "BOOLEAN"],
    [{ kind: "char", length: 3 }, "CHAR(3)"],
    [{ kind: "varchar", length: 255 }, "VARCHAR(255)"],
    [{ kind: "text" }, "LONGTEXT"],
    [{ kind: "uuid" }, "CHAR(36)"],
    [{ kind: "date" }, "DATE"],
    [{ kind: "time" }, "TIME(6)"],
    [{ kind: "timestamp" }, "DATETIME(6)"],
    [{ kind: "timestamptz" }, "TIMESTAMP(6)"],
    [{ kind: "json" }, "JSON"],
    [{ kind: "binary" }, "LONGBLOB"],
    [{ kind: "custom", name: "YEAR", isSafe: true }, "YEAR"],
  ])("renders every dialect column type (%o)", (type, expected) => {
    expect(renderMysqlType(type, NO_ENUMS)).toBe(expected);
  });

  it("renders an enum column as ENUM with escaped values", () => {
    const enums = buildSchema({
      enums: [
        makeEnum({ id: "enum_status", values: ["it's", "a\\b", "đã giao"] }),
      ],
    }).enums;

    expect(renderMysqlType(ENUM_TYPE, enums)).toBe(
      "ENUM('it''s', 'a\\\\b', 'đã giao')",
    );
  });

  it("falls back to LONGTEXT for a missing enum", () => {
    expect(renderMysqlType(ENUM_TYPE, NO_ENUMS)).toBe("LONGTEXT");
  });

  it("renders a narrowed key text as VARCHAR", () => {
    expect(renderMysqlType({ kind: "keyText", length: 255 }, NO_ENUMS)).toBe(
      "VARCHAR(255)",
    );
  });
});
