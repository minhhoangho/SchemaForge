import { describe, expect, it } from "vitest";

import { createNameClaimer, pickUnusedName } from "./pick-unused-name.js";

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

describe("createNameClaimer", () => {
  it("claims the names pickUnusedName would pick and takes each one", () => {
    const claimer = createNameClaimer(["users", "USERS_3"]);

    const names = ["users", "Users", "users"].map((name) =>
      claimer.claimName(name),
    );

    expect(names).toStrictEqual(["users_2", "Users_4", "users_5"]);
  });

  it("skips a name reserved after the search for its base name started", () => {
    const claimer = createNameClaimer([]);
    const first = claimer.claimName("users");
    claimer.reserve("Users_2");

    expect([first, claimer.claimName("users")]).toStrictEqual([
      "users",
      "users_3",
    ]);
  });
});
