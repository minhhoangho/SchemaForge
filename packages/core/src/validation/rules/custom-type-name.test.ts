import { describe, expect, it } from "vitest";

import { isSafeCustomTypeName } from "./custom-type-name.js";

describe("isSafeCustomTypeName", () => {
  it.each(["inet", "geometry(Point, 4326)", "text[]", "double precision"])(
    "accepts inet, geometry(Point, 4326), text[] and double precision: %s",
    (name) => {
      expect(isSafeCustomTypeName(name)).toBe(true);
    },
  );

  it.each(["my'type", "int; drop", "my-type", "my/type"])(
    "rejects a name with a quote, semicolon, hyphen or slash: %s",
    (name) => {
      expect(isSafeCustomTypeName(name)).toBe(false);
    },
  );

  it("rejects a name starting with a digit", () => {
    expect(isSafeCustomTypeName("2type")).toBe(false);
  });

  it("rejects a 64-byte name", () => {
    expect(isSafeCustomTypeName("a".repeat(64))).toBe(false);
  });

  it("accepts a 63-byte name", () => {
    expect(isSafeCustomTypeName("a".repeat(63))).toBe(true);
  });
});
