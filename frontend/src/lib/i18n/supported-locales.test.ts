import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, isLocale } from "./supported-locales";

describe("isLocale", () => {
  it.each(["vi", "en"])("accepts %s as a supported locale", (value) => {
    expect(isLocale(value)).toBe(true);
  });

  it.each(["fr", "EN", "vi-VN", ""])("rejects %s", (value) => {
    expect(isLocale(value)).toBe(false);
  });
});

describe("DEFAULT_LOCALE", () => {
  it("falls back to en", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});
