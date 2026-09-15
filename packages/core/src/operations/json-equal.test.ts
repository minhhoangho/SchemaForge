import { describe, expect, it } from "vitest";

import { isJsonEqual } from "./json-equal.js";

describe("isJsonEqual", () => {
  it("treats objects with the same entries in different key order as equal", () => {
    const left = { a: 1, b: 2 };
    const right = { b: 2, a: 1 };

    expect(isJsonEqual(left, right)).toBe(true);
  });

  it("treats arrays in different order as different", () => {
    expect(isJsonEqual([1, 2], [2, 1])).toBe(false);
  });

  it("treats a missing key and a null value as different", () => {
    expect(isJsonEqual({}, { a: null })).toBe(false);
  });

  it("compares nested column types by value", () => {
    const left = { type: { kind: "decimal", precision: 10, scale: 2 } };
    const right = { type: { kind: "decimal", precision: 10, scale: 2 } };

    expect(isJsonEqual(left, right)).toBe(true);
  });
});
