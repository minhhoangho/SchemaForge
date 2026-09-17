import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { SrgbColor } from "@/testing/contrast-ratio";
import {
  atOpacity,
  contrastRatio,
  flattenOnto,
  parseOklch,
} from "@/testing/contrast-ratio";

// Vitest runs with the frontend package as its working directory.
const SOURCE_DIRECTORY = join(process.cwd(), "src");

const GLOBALS_CSS = readFileSync(
  join(SOURCE_DIRECTORY, "app/globals.css"),
  "utf8",
);

// WCAG 2.2, 1.4.11 Non-text Contrast: a control boundary and a focus
// indicator need at least 3:1 against the colors next to them. Decorative
// lines (separators, dividers, grouping boxes) are out of scope, which is
// why --border itself is not measured here: it stays on the theme's
// original, lighter value.
const NON_TEXT_CONTRAST_MINIMUM = 3;

const THEME_SELECTORS = { light: ":root", dark: ".dark" } as const;

type ThemeName = keyof typeof THEME_SELECTORS;

type BoundaryCase = {
  readonly theme: ThemeName;
  // The token painted as a control boundary or as the focus indicator.
  readonly boundary: string;
  // The token of the surface it is painted against.
  readonly surface: string;
  // What that surface is, only used to name the test.
  readonly where: string;
};

const DECLARATION_PATTERN = /--([\w-]+):\s*([^;]+);/g;
const VARIABLE_REFERENCE_PATTERN = /^var\(\s*--([\w-]+)\s*\)$/;

// A Tailwind opacity modifier on the ring token (for example a 50 percent
// ring utility) would paint the focus indicator lighter than the value
// measured here, so the ratios below would no longer describe what a user
// sees. Written without the literal pattern in this comment, because
// listSourceFiles() below scans this very file too.
const DILUTED_RING_PATTERN = /(?:ring|border|outline)-ring\/\d+/;

function readThemeBlock(theme: ThemeName): string {
  const opening = `\n${THEME_SELECTORS[theme]} {`;
  const start = GLOBALS_CSS.indexOf(opening);

  if (start === -1) {
    throw new Error(`No ${THEME_SELECTORS[theme]} block in globals.css.`);
  }

  return GLOBALS_CSS.slice(
    start + opening.length,
    GLOBALS_CSS.indexOf("\n}", start),
  );
}

function readThemeTokens(theme: ThemeName): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();

  for (const [, name, value] of readThemeBlock(theme).matchAll(
    DECLARATION_PATTERN,
  )) {
    if (name !== undefined && value !== undefined) {
      tokens.set(name, value.trim());
    }
  }

  return tokens;
}

const THEME_TOKENS = {
  light: readThemeTokens("light"),
  dark: readThemeTokens("dark"),
} as const;

function resolveToken(theme: ThemeName, name: string): SrgbColor {
  const tokens = THEME_TOKENS[theme];
  let value = tokens.get(name);
  // Tokens such as --canvas-node-border point at another token.
  let reference = VARIABLE_REFERENCE_PATTERN.exec(value ?? "");

  while (reference !== null) {
    value = tokens.get(reference[1] ?? "");
    reference = VARIABLE_REFERENCE_PATTERN.exec(value ?? "");
  }

  if (value === undefined) {
    throw new Error(`No --${name} in the ${theme} theme.`);
  }

  return parseOklch(value);
}

/** The contrast a boundary reaches once its alpha is painted on the surface. */
function paintedContrast(
  theme: ThemeName,
  boundary: string,
  surface: string,
): number {
  const surfaceColor = resolveToken(theme, surface);

  return contrastRatio(
    flattenOnto(resolveToken(theme, boundary), surfaceColor),
    surfaceColor,
  );
}

function readSourceFile(path: string): string {
  return readFileSync(join(SOURCE_DIRECTORY, path), "utf8");
}

function listSourceFiles(): readonly string[] {
  // Own file excluded: it names the diluted-ring pattern in prose above, and
  // scanning it would just be asserting this file matches its own regex.
  const OWN_FILE = "app/globals.test.ts";

  return readdirSync(SOURCE_DIRECTORY, {
    recursive: true,
    encoding: "utf8",
  }).filter(
    (entry) =>
      entry !== OWN_FILE &&
      (entry.endsWith(".tsx") ||
        entry.endsWith(".ts") ||
        entry.endsWith(".css")),
  );
}

// Every control-boundary or focus-ring token, and every surface it is
// painted against: the page, a card, a muted panel, and a filled primary
// button. --border is deliberately absent: it is decoration (separators,
// panel dividers, grouping fieldsets), which 1.4.11 does not cover, and
// every control already uses --input instead (button.tsx, checkbox.tsx,
// radio-group.tsx, input.tsx, select.tsx, textarea.tsx, scroll-area.tsx).
const BOUNDARY_CASES = [
  { theme: "light", boundary: "input", surface: "background", where: "page" },
  { theme: "light", boundary: "input", surface: "card", where: "card" },
  { theme: "light", boundary: "input", surface: "muted", where: "panel" },
  { theme: "light", boundary: "ring", surface: "background", where: "page" },
  { theme: "light", boundary: "ring", surface: "card", where: "card" },
  { theme: "light", boundary: "ring", surface: "muted", where: "panel" },
  { theme: "light", boundary: "ring", surface: "primary", where: "button" },
  {
    theme: "light",
    boundary: "canvas-node-border",
    surface: "background",
    where: "canvas",
  },
  {
    theme: "light",
    boundary: "canvas-node-border",
    surface: "card",
    where: "node interior",
  },
  { theme: "dark", boundary: "input", surface: "background", where: "page" },
  { theme: "dark", boundary: "input", surface: "card", where: "card" },
  { theme: "dark", boundary: "input", surface: "muted", where: "panel" },
  { theme: "dark", boundary: "ring", surface: "background", where: "page" },
  { theme: "dark", boundary: "ring", surface: "card", where: "card" },
  { theme: "dark", boundary: "ring", surface: "muted", where: "panel" },
  { theme: "dark", boundary: "ring", surface: "primary", where: "button" },
  {
    theme: "dark",
    boundary: "canvas-node-border",
    surface: "background",
    where: "canvas",
  },
  {
    theme: "dark",
    boundary: "canvas-node-border",
    surface: "card",
    where: "node interior",
  },
] as const satisfies readonly BoundaryCase[];

describe("theme tokens", () => {
  it.each(BOUNDARY_CASES)(
    "paints --$boundary on the $theme $where with at least 3:1 against --$surface",
    ({ theme, boundary, surface }) => {
      expect(paintedContrast(theme, boundary, surface)).toBeGreaterThanOrEqual(
        NON_TEXT_CONTRAST_MINIMUM,
      );
    },
  );

  it("wires the React Flow node border to the canvas-node-border token", () => {
    expect(GLOBALS_CSS).toContain(
      "--xy-node-border: 1px solid var(--canvas-node-border)",
    );
  });

  it("draws the focus ring of a selected canvas node with the ring token", () => {
    expect(GLOBALS_CSS).toContain(
      "--xy-node-boxshadow-selected: 0 0 0 2px var(--ring)",
    );
  });

  // React Flow's own --xy-node-border only styles its built-in node types
  // (`.react-flow__node-default` and friends); TableNode is a custom node
  // type, so its own class is what actually paints the boundary a user sees.
  // Both are kept on the same token so darkening one does not silently leave
  // the other behind.
  it("paints the table node's own boundary with the canvas-node-border token", () => {
    const tableNode = readSourceFile(
      "features/editor/components/canvas/table-node.tsx",
    );

    // The card's own outer boundary, not the decorative divider between its
    // header and its rows, which stays on --border.
    expect(tableNode).toContain(
      "rounded-md border border-canvas-node-border bg-card",
    );
  });
});

describe("focus ring usage", () => {
  it("paints the ring token at full opacity everywhere", () => {
    const diluted = listSourceFiles().filter((file) =>
      DILUTED_RING_PATTERN.test(readSourceFile(file)),
    );

    expect(diluted).toEqual([]);
  });
});

describe("dark invalid field border", () => {
  // input.tsx and textarea.tsx paint their aria-invalid border with
  // --destructive diluted to 70% over whatever surface sits behind the
  // field (page, card, or a muted panel), the same alpha-compositing every
  // other boundary in this file is measured with.
  const DARK_INVALID_BORDER_OPACITY = 0.7;
  const SURFACES = ["background", "card", "muted"] as const;

  it.each(SURFACES)(
    "keeps dark:aria-invalid:border-destructive/70 at 3:1 against --%s",
    (surface) => {
      const surfaceColor = resolveToken("dark", surface);
      const boundary = atOpacity(
        resolveToken("dark", "destructive"),
        DARK_INVALID_BORDER_OPACITY,
      );

      expect(
        contrastRatio(flattenOnto(boundary, surfaceColor), surfaceColor),
      ).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST_MINIMUM);
    },
  );

  it.each(["input.tsx", "textarea.tsx"] as const)(
    "paints the dark invalid border at 70%% opacity in %s",
    (fileName) => {
      const source = readSourceFile(`components/ui/${fileName}`);

      expect(source).toContain("dark:aria-invalid:border-destructive/70");
      expect(source).not.toContain("dark:aria-invalid:border-destructive/50");
    },
  );
});
