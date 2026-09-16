import { afterEach, describe, expect, it } from "vitest";

import { applyResolvedTheme, resolveTheme } from "./resolve-theme";

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
});

describe("resolveTheme", () => {
  it.each([
    ["dark", true, "dark"],
    ["dark", false, "dark"],
    ["light", true, "light"],
    ["light", false, "light"],
    ["system", true, "dark"],
    ["system", false, "light"],
  ] as const)(
    "resolves %s with a dark system preference of %s to %s",
    (preference, isDarkPreferred, expected) => {
      expect(resolveTheme(preference, isDarkPreferred)).toBe(expected);
    },
  );
});

describe("applyResolvedTheme", () => {
  it("adds the dark class and dark color scheme", () => {
    applyResolvedTheme("dark");

    expect([
      document.documentElement.classList.contains("dark"),
      document.documentElement.style.colorScheme,
    ]).toEqual([true, "dark"]);
  });

  it("removes the dark class for the light theme", () => {
    document.documentElement.classList.add("dark");

    applyResolvedTheme("light");

    expect([
      document.documentElement.classList.contains("dark"),
      document.documentElement.style.colorScheme,
    ]).toEqual([false, "light"]);
  });
});
