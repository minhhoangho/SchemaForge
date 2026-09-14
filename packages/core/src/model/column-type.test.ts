import { describe, expect, expectTypeOf, it } from "vitest";

import { columnTypeShape } from "./column-type.js";
import type { ColumnType } from "./column-type.js";

const VALID_COLUMN_TYPES = [
  { kind: "smallint" },
  { kind: "integer" },
  { kind: "bigint" },
  { kind: "decimal", precision: 10, scale: 2 },
  { kind: "real" },
  { kind: "double" },
  { kind: "boolean" },
  { kind: "char", length: 2 },
  { kind: "varchar", length: 255 },
  { kind: "text" },
  { kind: "uuid" },
  { kind: "date" },
  { kind: "time" },
  { kind: "timestamp" },
  { kind: "timestamptz" },
  { kind: "json" },
  { kind: "binary" },
  { kind: "enum", enumId: "enum_1" },
  { kind: "custom", name: "geometry(Point, 4326)" },
];

describe("columnTypeShape", () => {
  it.each(VALID_COLUMN_TYPES)(
    "accepts the $kind type with its parameters",
    (columnType) => {
      expect(columnTypeShape.safeParse(columnType).data).toStrictEqual(
        columnType,
      );
    },
  );

  it("rejects an unknown kind", () => {
    expect(columnTypeShape.safeParse({ kind: "money" }).success).toBe(false);
  });

  it("rejects varchar length 0", () => {
    expect(
      columnTypeShape.safeParse({ kind: "varchar", length: 0 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer length", () => {
    expect(
      columnTypeShape.safeParse({ kind: "char", length: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects decimal precision 0", () => {
    expect(
      columnTypeShape.safeParse({ kind: "decimal", precision: 0, scale: 0 })
        .success,
    ).toBe(false);
  });

  it("accepts decimal scale 0", () => {
    expect(
      columnTypeShape.safeParse({ kind: "decimal", precision: 5, scale: 0 })
        .success,
    ).toBe(true);
  });

  it("rejects a negative scale", () => {
    expect(
      columnTypeShape.safeParse({ kind: "decimal", precision: 5, scale: -1 })
        .success,
    ).toBe(false);
  });

  it("accepts scale greater than precision because that is a semantic issue", () => {
    expect(
      columnTypeShape.safeParse({ kind: "decimal", precision: 2, scale: 5 })
        .success,
    ).toBe(true);
  });

  it("rejects an enum type whose enumId has a wrong prefix", () => {
    expect(
      columnTypeShape.safeParse({ kind: "enum", enumId: "tbl_1" }).success,
    ).toBe(false);
  });

  it("rejects a parameter on a kind that has none", () => {
    expect(
      columnTypeShape.safeParse({ kind: "integer", length: 4 }).success,
    ).toBe(false);
  });

  it("infers exactly the nineteen column type kinds of the spec", () => {
    expectTypeOf<ColumnType["kind"]>().toEqualTypeOf<
      | "smallint"
      | "integer"
      | "bigint"
      | "decimal"
      | "real"
      | "double"
      | "boolean"
      | "char"
      | "varchar"
      | "text"
      | "uuid"
      | "date"
      | "time"
      | "timestamp"
      | "timestamptz"
      | "json"
      | "binary"
      | "enum"
      | "custom"
    >();
  });
});
