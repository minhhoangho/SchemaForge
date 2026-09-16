import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveTheme } from "./resolve-theme";

// Vite rewrites `new URL("…", import.meta.url)` into a served asset URL, so the
// script has to be located through import.meta.dirname instead.
const THEME_INIT_SOURCE = readFileSync(
  join(import.meta.dirname, "../../../public/theme-init.js"),
  "utf8",
);

// eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the static theme script under test
const evaluateThemeInitScript = new Function(THEME_INIT_SOURCE);

function runThemeInitScript(
  preference: string,
  isDarkPreferred: boolean,
): void {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: isDarkPreferred,
    media,
  }));
  document.documentElement.setAttribute("data-theme-preference", preference);

  evaluateThemeInitScript.call(null);
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  document.documentElement.removeAttribute("data-theme-preference");
  vi.unstubAllGlobals();
});

describe("theme-init.js", () => {
  it.each([
    ["dark", true, true],
    ["dark", false, true],
    ["light", true, false],
    ["light", false, false],
    ["system", true, true],
    ["system", false, false],
    ["sepia", true, true],
    ["sepia", false, false],
  ])(
    "sets the dark class for preference %s when the system prefers dark is %s",
    (preference, isDarkPreferred, hasDarkClass) => {
      runThemeInitScript(preference, isDarkPreferred);

      expect(document.documentElement.classList.contains("dark")).toBe(
        hasDarkClass,
      );
    },
  );

  it("sets the color-scheme style", () => {
    runThemeInitScript("dark", false);

    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it.each([
    ["dark", true],
    ["dark", false],
    ["light", true],
    ["light", false],
    ["system", true],
    ["system", false],
  ] as const)(
    "matches resolveTheme for %s and %s",
    (preference, isDarkPreferred) => {
      runThemeInitScript(preference, isDarkPreferred);

      expect(document.documentElement.style.colorScheme).toBe(
        resolveTheme(preference, isDarkPreferred),
      );
    },
  );
});
