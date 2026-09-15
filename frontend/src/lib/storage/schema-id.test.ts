import { describe, expect, it } from "vitest";

import { isSchemaId } from "./schema-id";

describe("isSchemaId", () => {
  it("accepts a lowercase UUID", () => {
    expect(isSchemaId("0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4")).toBe(true);
  });

  it.each([
    ["an uppercase UUID", "0B7D4C1E-2F3A-4B5C-8D6E-7F8091A2B3C4"],
    ["a UUID without hyphens", "0b7d4c1e2f3a4b5c8d6e7f8091a2b3c4"],
    ["a UUID with an extra character", "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4a"],
    [
      "a UUID with a leading character",
      "a0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    ],
    ["an empty string", ""],
    ["a path traversal", "../etc"],
  ])("rejects %s", (_description, value) => {
    expect(isSchemaId(value)).toBe(false);
  });
});
