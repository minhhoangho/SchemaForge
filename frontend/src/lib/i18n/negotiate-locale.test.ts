import { describe, expect, it } from "vitest";

import {
  MAX_LANGUAGE_RANGES,
  negotiateLocale,
  resolveRequestLocale,
} from "./negotiate-locale";

describe("negotiateLocale", () => {
  it.each([
    ["vi-VN,vi;q=0.9,en;q=0.8", "vi"],
    ["en-US,en;q=0.9", "en"],
    ["fr-FR,fr;q=0.9,en;q=0.5,vi;q=0.8", "vi"],
    ["fr,de", null],
    ["", null],
    ["vi;q=0,en", "en"],
    ["*", null],
    ["EN-gb", "en"],
    ["vi;q=abc,en;q=0.5", "en"],
    ["vi;q=0.9,en; q=0.1", "vi"],
    ["vi;q=0.1, en ; q=0.9", "en"],
  ])("negotiates %s as %s", (acceptLanguage, expected) => {
    expect(negotiateLocale(acceptLanguage)).toBe(expected);
  });

  it("keeps header order for equal weights", () => {
    expect(negotiateLocale("fr,en,vi")).toBe("en");
  });

  it("returns null for a missing header", () => {
    expect(negotiateLocale(null)).toBeNull();
  });

  it("ignores language ranges beyond the limit", () => {
    const header = `${"fr,".repeat(MAX_LANGUAGE_RANGES)}vi`;

    expect(negotiateLocale(header)).toBeNull();
  });
});

describe("resolveRequestLocale", () => {
  it("prefers a valid locale cookie over the header", () => {
    expect(
      resolveRequestLocale({ cookieValue: "vi", acceptLanguage: "en-US" }),
    ).toBe("vi");
  });

  it("uses the header when the cookie is invalid", () => {
    expect(
      resolveRequestLocale({ cookieValue: "de", acceptLanguage: "vi-VN" }),
    ).toBe("vi");
  });

  it("falls back to en without cookie or matching header", () => {
    expect(
      resolveRequestLocale({ cookieValue: undefined, acceptLanguage: "fr-FR" }),
    ).toBe("en");
  });
});
