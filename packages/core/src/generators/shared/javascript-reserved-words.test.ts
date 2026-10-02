import { describe, expect, it } from "vitest";

import { JAVASCRIPT_RESERVED_WORDS } from "./javascript-reserved-words.js";

describe("JAVASCRIPT_RESERVED_WORDS", () => {
  it("contains class, default and await", () => {
    expect(JAVASCRIPT_RESERVED_WORDS).toEqual(
      expect.arrayContaining(["class", "default", "await"]),
    );
  });

  it("has no duplicates", () => {
    expect(new Set(JAVASCRIPT_RESERVED_WORDS).size).toBe(
      JAVASCRIPT_RESERVED_WORDS.length,
    );
  });
});
