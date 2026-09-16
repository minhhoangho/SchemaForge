import { describe, expect, it } from "vitest";

import {
  buildColumnType,
  COMMON_COLUMN_TYPE_KINDS,
  DEFAULT_DECIMAL_PRECISION,
  DEFAULT_DECIMAL_SCALE,
  DEFAULT_VARCHAR_LENGTH,
  isCommonColumnTypeKind,
  scoreColumnTypeSearch,
} from "./column-type-options";

describe("column type options", () => {
  it("lists the seventeen common column kinds", () => {
    expect(COMMON_COLUMN_TYPE_KINDS).toEqual([
      "smallint",
      "integer",
      "bigint",
      "decimal",
      "real",
      "double",
      "boolean",
      "char",
      "varchar",
      "text",
      "uuid",
      "date",
      "time",
      "timestamp",
      "timestamptz",
      "json",
      "binary",
    ]);
  });

  it("keeps the length when switching between char and varchar", () => {
    expect(buildColumnType("char", { kind: "varchar", length: 40 })).toEqual({
      kind: "char",
      length: 40,
    });
  });

  it("uses the default length for varchar", () => {
    expect(buildColumnType("varchar", { kind: "integer" })).toEqual({
      kind: "varchar",
      length: DEFAULT_VARCHAR_LENGTH,
    });
  });

  it("uses the default precision and scale for decimal", () => {
    expect(buildColumnType("decimal", { kind: "text" })).toEqual({
      kind: "decimal",
      precision: DEFAULT_DECIMAL_PRECISION,
      scale: DEFAULT_DECIMAL_SCALE,
    });
  });

  it("keeps precision and scale when the column is already decimal", () => {
    expect(
      buildColumnType("decimal", { kind: "decimal", precision: 6, scale: 3 }),
    ).toEqual({ kind: "decimal", precision: 6, scale: 3 });
  });

  it("drops the parameters of a kind without parameters", () => {
    expect(buildColumnType("text", { kind: "varchar", length: 40 })).toEqual({
      kind: "text",
    });
  });

  it.each([
    ["uuid", true],
    ["enum", false],
    ["custom", false],
  ] as const)("tells whether %s is a common kind", (kind, isCommon) => {
    expect(isCommonColumnTypeKind(kind)).toBe(isCommon);
  });

  it.each([
    ["timest", ["timestamp"], 1],
    ["STATUS", ["status"], 1],
    ["enum_", ["status"], 0],
    ["", ["status"], 1],
  ] as const)(
    "scores the search %s against the keywords %j as %d",
    (search, keywords, score) => {
      expect(scoreColumnTypeSearch("enum_1234", search, keywords)).toBe(score);
    },
  );
});
