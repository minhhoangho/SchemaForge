import { describe, expect, it } from "vitest";

import { createNameResolver } from "./resolve-references.js";

describe("createNameResolver", () => {
  it("prefers an exact name match", () => {
    const resolve = createNameResolver(["Users", "users"]);

    expect(resolve("users")).toBe(1);
  });

  it("falls back to a single case-insensitive match", () => {
    const resolve = createNameResolver(["orders", "Users"]);

    expect(resolve("USERS")).toBe(1);
  });

  it("returns null for two case-insensitive matches", () => {
    const resolve = createNameResolver(["Users", "users"]);

    expect(resolve("USERS")).toBeNull();
  });

  it("returns null for a name that matches nothing", () => {
    const resolve = createNameResolver(["users"]);

    expect(resolve("orders")).toBeNull();
  });

  it("resolves a repeated exact name to its first position", () => {
    const resolve = createNameResolver(["users", "orders", "users"]);

    expect(resolve("users")).toBe(0);
  });

  it.each([
    ["__proto__", 0],
    ["constructor", 1],
    ["toString", null],
    ["hasOwnProperty", null],
  ])(
    "resolves names such as __proto__ and constructor without touching the prototype (%s)",
    (wanted, expected) => {
      const resolve = createNameResolver(["__proto__", "constructor"]);

      expect(resolve(wanted)).toBe(expected);
    },
  );
});
