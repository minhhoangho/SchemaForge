import { describe, expect, it } from "vitest";

import { getServerTranslation } from "./server-translation";

describe("getServerTranslation", () => {
  it.each([
    ["en", "Cancel"],
    ["vi", "Hủy"],
  ] as const)("translates a namespace in %s", (locale, expected) => {
    const t = getServerTranslation(locale, "common");

    expect(t("actions.cancel")).toBe(expected);
  });

  it("returns an independent translator for each call", () => {
    const translateInVietnamese = getServerTranslation("vi", "common");
    const translateInEnglish = getServerTranslation("en", "common");

    expect([
      translateInVietnamese("actions.cancel"),
      translateInEnglish("actions.cancel"),
    ]).toEqual(["Hủy", "Cancel"]);
  });
});
