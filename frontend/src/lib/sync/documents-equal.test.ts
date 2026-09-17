import { describe, expect, it } from "vitest";

import { documentsEqual } from "./documents-equal";

describe("documentsEqual", () => {
  it("treats documents with different key order as equal", () => {
    expect(documentsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("treats arrays with different order as different", () => {
    expect(documentsEqual([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  it("distinguishes a missing key from a key set to undefined", () => {
    expect(documentsEqual({}, { a: undefined })).toBe(false);
  });

  it("compares nested objects deeply", () => {
    const left = { table: { name: "users", columns: [{ id: "1" }] } };
    const right = { table: { name: "users", columns: [{ id: "1" }] } };

    expect(documentsEqual(left, right)).toBe(true);
  });

  it("treats different primitive values as different", () => {
    expect(documentsEqual("users", "orders")).toBe(false);
  });
});
