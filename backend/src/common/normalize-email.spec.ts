import { describe, expect, it } from "vitest";

import { normalizeEmail } from "./normalize-email.js";

describe("normalizeEmail", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeEmail(" \t ada@example.com \n")).toBe("ada@example.com");
  });

  it("lowercases every character", () => {
    expect(normalizeEmail("Ada.Lovelace@EXAMPLE.COM")).toBe(
      "ada.lovelace@example.com",
    );
  });

  it("keeps inner characters unchanged", () => {
    expect(normalizeEmail("ada+tag.1_x@sub.example.com")).toBe(
      "ada+tag.1_x@sub.example.com",
    );
  });
});
