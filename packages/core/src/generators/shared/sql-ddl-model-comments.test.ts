import { describe, expect, it } from "vitest";

import {
  truncateCodePoints,
  truncateUtf16CodeUnits,
} from "./sql-ddl-model-comments.js";

describe("truncateCodePoints", () => {
  it.each([
    ["abc", 3, "abc"],
    ["abcd", 3, "abc"],
    ["a😀b", 2, "a😀"],
    ["😀😀😀", 2, "😀😀"],
  ])("cuts %j to %i code points", (text, max, expected) => {
    expect(truncateCodePoints(text, max)).toBe(expected);
  });
});

describe("truncateUtf16CodeUnits", () => {
  it.each([
    ["abc", 5, "abc"],
    ["abcd", 3, "abc"],
    ["a😀b", 3, "a😀"],
  ])("cuts %j to %i code units", (text, max, expected) => {
    expect(truncateUtf16CodeUnits(text, max)).toBe(expected);
  });

  it("drops a surrogate pair that would be split by the limit", () => {
    expect(truncateUtf16CodeUnits("a😀b", 2)).toBe("a");
  });

  it("keeps a lone high surrogate that ends at the limit", () => {
    expect(truncateUtf16CodeUnits("a\uD83Dbc", 2)).toBe("a\uD83D");
  });
});
