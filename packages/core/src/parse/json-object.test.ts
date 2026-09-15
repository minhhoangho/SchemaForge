import { describe, expect, it } from "vitest";

import { isJsonObject } from "./json-object.js";

describe("isJsonObject", () => {
  it("accepts a plain object", () => {
    expect(isJsonObject({ a: 1 })).toBe(true);
  });

  it("rejects null", () => {
    expect(isJsonObject(null)).toBe(false);
  });

  it("rejects an array", () => {
    expect(isJsonObject([1, 2])).toBe(false);
  });

  it("rejects a string", () => {
    expect(isJsonObject("hello")).toBe(false);
  });
});
