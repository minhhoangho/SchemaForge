import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import { buildSchema, makeEnum } from "../../testing/factories.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { renderPostgresqlType } from "./render-postgresql-type.js";

const NO_ENUMS: SchemaDocument["enums"] = {};

describe("renderPostgresqlType", () => {
  it.each<[DialectColumnType, string]>([
    [{ kind: "smallint" }, "smallint"],
    [{ kind: "integer" }, "integer"],
    [{ kind: "bigint" }, "bigint"],
    [{ kind: "decimal", precision: 10, scale: 2 }, "numeric(10, 2)"],
    [{ kind: "real" }, "real"],
    [{ kind: "double" }, "double precision"],
    [{ kind: "boolean" }, "boolean"],
    [{ kind: "char", length: 3 }, "char(3)"],
    [{ kind: "varchar", length: 255 }, "varchar(255)"],
    [{ kind: "keyText", length: 255 }, "varchar(255)"],
    [{ kind: "text" }, "text"],
    [{ kind: "uuid" }, "uuid"],
    [{ kind: "date" }, "date"],
    [{ kind: "time" }, "time"],
    [{ kind: "timestamp" }, "timestamp"],
    [{ kind: "timestamptz" }, "timestamptz"],
    [{ kind: "json" }, "jsonb"],
    [{ kind: "binary" }, "bytea"],
    [
      { kind: "custom", name: "geometry(Point, 4326)", isSafe: true },
      "geometry(Point, 4326)",
    ],
  ])("renders every dialect column type (%o)", (type, expected) => {
    expect(renderPostgresqlType(type, NO_ENUMS)).toBe(expected);
  });

  it("quotes an enum type name", () => {
    const { enums } = buildSchema({
      enums: [makeEnum({ id: "enum_status", name: 'order "status"' })],
    });

    expect(
      renderPostgresqlType({ kind: "enum", enumId: "enum_status" }, enums),
    ).toBe('"order ""status"""');
  });

  it("falls back to text for a missing enum", () => {
    expect(
      renderPostgresqlType({ kind: "enum", enumId: "enum_missing" }, NO_ENUMS),
    ).toBe("text");
  });
});
