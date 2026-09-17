import { describe, expect, it } from "vitest";

import {
  atOpacity,
  contrastRatio,
  flattenOnto,
  parseOklch,
  relativeLuminance,
} from "./contrast-ratio";

const WHITE = "oklch(1 0 0)";
const BLACK = "oklch(0 0 0)";
// Tailwind CSS 4 red-600, the value shadcn/ui ships as --destructive. Browsers
// paint it as #e7000b, which is what this conversion has to reproduce.
const RED_600 = "oklch(0.577 0.245 27.325)";

describe("parseOklch", () => {
  it("converts the lightest achromatic value to white", () => {
    const color = parseOklch(WHITE);

    expect(color.red).toBeCloseTo(1, 5);
    expect(color.green).toBeCloseTo(1, 5);
    expect(color.blue).toBeCloseTo(1, 5);
    expect(color.alpha).toBe(1);
  });

  it("converts a chromatic value to its sRGB channels", () => {
    const color = parseOklch(RED_600);

    expect(color.red).toBeCloseTo(231.1 / 255, 2);
    expect(color.green).toBeCloseTo(0, 2);
    expect(color.blue).toBeCloseTo(10.8 / 255, 2);
  });

  it("reads a percentage alpha", () => {
    expect(parseOklch("oklch(1 0 0 / 10%)").alpha).toBeCloseTo(0.1, 5);
  });

  it("reads a decimal alpha", () => {
    expect(parseOklch("oklch(1 0 0 / 0.4)").alpha).toBeCloseTo(0.4, 5);
  });

  it("throws for a value that is not an oklch color", () => {
    expect(() => parseOklch("#ffffff")).toThrow(/#ffffff/);
  });
});

describe("relativeLuminance", () => {
  it("is 1 for white", () => {
    expect(relativeLuminance(parseOklch(WHITE))).toBeCloseTo(1, 5);
  });

  it("is 0 for black", () => {
    expect(relativeLuminance(parseOklch(BLACK))).toBeCloseTo(0, 5);
  });

  it("refuses a translucent color, which has no luminance of its own", () => {
    expect(() => relativeLuminance(parseOklch("oklch(1 0 0 / 10%)"))).toThrow(
      /flatten/i,
    );
  });
});

describe("contrastRatio", () => {
  it("is 21 for black against white", () => {
    expect(contrastRatio(parseOklch(BLACK), parseOklch(WHITE))).toBeCloseTo(
      21,
      3,
    );
  });

  it("is 1 for a color against itself", () => {
    expect(contrastRatio(parseOklch(RED_600), parseOklch(RED_600))).toBeCloseTo(
      1,
      5,
    );
  });

  it("does not depend on the order of its arguments", () => {
    const white = parseOklch(WHITE);
    const red = parseOklch(RED_600);

    expect(contrastRatio(white, red)).toBeCloseTo(contrastRatio(red, white), 5);
  });
});

describe("flattenOnto", () => {
  it("blends a half transparent foreground halfway to the background", () => {
    const flattened = flattenOnto(
      parseOklch("oklch(0 0 0 / 50%)"),
      parseOklch(WHITE),
    );

    expect(flattened.red).toBeCloseTo(0.5, 5);
    expect(flattened.green).toBeCloseTo(0.5, 5);
    expect(flattened.blue).toBeCloseTo(0.5, 5);
    expect(flattened.alpha).toBe(1);
  });

  it("keeps an opaque foreground unchanged", () => {
    const red = parseOklch(RED_600);

    expect(flattenOnto(red, parseOklch(WHITE))).toEqual(red);
  });

  it("refuses a translucent background", () => {
    expect(() =>
      flattenOnto(parseOklch(WHITE), parseOklch("oklch(0 0 0 / 50%)")),
    ).toThrow(/opaque/i);
  });
});

describe("atOpacity", () => {
  it("multiplies the alpha the color already has", () => {
    expect(atOpacity(parseOklch("oklch(1 0 0 / 50%)"), 0.5).alpha).toBeCloseTo(
      0.25,
      5,
    );
  });

  it("leaves the channels alone", () => {
    const red = parseOklch(RED_600);

    expect(atOpacity(red, 0.5).red).toBeCloseTo(red.red, 5);
  });
});
