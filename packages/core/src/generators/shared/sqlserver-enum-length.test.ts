import { describe, expect, it } from "vitest";

import {
  SQLSERVER_MAX_NVARCHAR_LENGTH,
  sqlServerEnumLength,
} from "./sqlserver-enum-length.js";

describe("sqlServerEnumLength", () => {
  it("sizes by the longest value in UTF-16 code units", () => {
    // U+1F600 is outside the BMP, so it counts as 2 code units.
    expect(sqlServerEnumLength(["ab", "đã giao", "x\u{1F600}yz"])).toBe(7);
  });

  it("counts a character outside the BMP as two code units", () => {
    expect(sqlServerEnumLength(["\u{1F600}"])).toBe(2);
  });

  it.each<[string, readonly string[]]>([
    ["without values", []],
    ["with only empty values", ["", ""]],
  ])("returns 1 for an enum %s", (_label, values) => {
    expect(sqlServerEnumLength(values)).toBe(1);
  });

  it("returns 4000 for a value of exactly 4000 code units and null above", () => {
    expect([
      sqlServerEnumLength(["a".repeat(SQLSERVER_MAX_NVARCHAR_LENGTH)]),
      sqlServerEnumLength(["a".repeat(SQLSERVER_MAX_NVARCHAR_LENGTH + 1)]),
    ]).toStrictEqual([4000, null]);
  });
});
