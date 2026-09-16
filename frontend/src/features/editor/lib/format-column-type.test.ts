import type { ColumnType } from "@schemaforge/core";
import { buildSchema, makeEnum } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { formatColumnType } from "./format-column-type";

const ENUMS = buildSchema({
  enums: [makeEnum({ id: "enum_status", name: "order_status" })],
}).enums;

const CASES: readonly (readonly [ColumnType, string])[] = [
  [{ kind: "smallint" }, "smallint"],
  [{ kind: "integer" }, "integer"],
  [{ kind: "bigint" }, "bigint"],
  [{ kind: "decimal", precision: 10, scale: 2 }, "decimal(10,2)"],
  [{ kind: "real" }, "real"],
  [{ kind: "double" }, "double"],
  [{ kind: "boolean" }, "boolean"],
  [{ kind: "char", length: 2 }, "char(2)"],
  [{ kind: "varchar", length: 255 }, "varchar(255)"],
  [{ kind: "text" }, "text"],
  [{ kind: "uuid" }, "uuid"],
  [{ kind: "date" }, "date"],
  [{ kind: "time" }, "time"],
  [{ kind: "timestamp" }, "timestamp"],
  [{ kind: "timestamptz" }, "timestamptz"],
  [{ kind: "json" }, "json"],
  [{ kind: "binary" }, "binary"],
  [{ kind: "enum", enumId: "enum_status" }, "order_status"],
  [{ kind: "custom", name: "citext" }, "citext"],
];

describe("formatColumnType", () => {
  it.each(CASES)("formats %s as %s", (type, expected) => {
    expect(formatColumnType(type, ENUMS)).toBe(expected);
  });

  it("falls back when the enum no longer exists", () => {
    expect(formatColumnType({ kind: "enum", enumId: "enum_gone" }, ENUMS)).toBe(
      "?",
    );
  });
});
