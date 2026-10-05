import { describe, expect, it } from "vitest";

import { pickUnusedName } from "./pick-unused-name.js";

describe("pickUnusedName", () => {
  it("returns the base name when unused", () => {
    expect(pickUnusedName("users", new Set(["orders"]))).toBe("users");
  });

  it("appends the smallest unused number starting at 2", () => {
    expect(
      pickUnusedName("users", new Set(["users", "users_2", "users_4"])),
    ).toBe("users_3");
  });

  it("compares names case-insensitively", () => {
    expect(pickUnusedName("Users", new Set(["users", "users_2"]))).toBe(
      "Users_3",
    );
  });
});
