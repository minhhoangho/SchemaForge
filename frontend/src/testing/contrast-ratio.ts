/**
 * Color maths for the WCAG 2.2 contrast checks the theme tokens have to pass.
 *
 * Only tests use it: jsdom paints nothing and computes no color, so a token's
 * rendered contrast can be checked only by redoing what the browser does,
 * which is convert `oklch()` to sRGB, composite any alpha onto the surface
 * behind it and compare relative luminance (WCAG 2.2, 1.4.11 Non-text
 * Contrast and 2.4.11 Focus Appearance).
 */

/** Gamma-encoded sRGB channels plus alpha, each in the 0..1 range. */
export type SrgbColor = {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
};

// oklch(<lightness> <chroma> <hue>) with an optional "/ <alpha>" that is either
// a percentage or a decimal fraction.
const OKLCH_PATTERN =
  /^oklch\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/;

const DEGREES_PER_RADIAN = 180 / Math.PI;
const PERCENT = 100;

// OKLab to cone response, then cone response to linear sRGB. Both matrices are
// from CSS Color Module Level 4, which defines how a browser paints oklch().
const OKLAB_TO_CONE = {
  long: [0.3963377774, 0.2158037573],
  medium: [-0.1055613458, -0.0638541728],
  short: [-0.0894841775, -1.291485548],
} as const;

const CONE_TO_LINEAR_SRGB = {
  red: [4.0767416621, -3.3077115913, 0.2309699292],
  green: [-1.2684380046, 2.6097574011, -0.3413193965],
  blue: [-0.0041960863, -0.7034186147, 1.707614701],
} as const;

// sRGB transfer function, from the same specification.
const SRGB_LINEAR_THRESHOLD = 0.0031308;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_GAMMA_SCALE = 1.055;
const SRGB_GAMMA_OFFSET = 0.055;
const SRGB_GAMMA_EXPONENT = 2.4;

// WCAG 2.2 relative luminance: channel weights and the ratio's offset.
const LUMINANCE_WEIGHTS = { red: 0.2126, green: 0.7152, blue: 0.0722 } as const;
const CONTRAST_OFFSET = 0.05;

function clampToUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function encodeGamma(linear: number): number {
  if (linear <= SRGB_LINEAR_THRESHOLD) {
    return linear * SRGB_LINEAR_SLOPE;
  }

  return (
    SRGB_GAMMA_SCALE * linear ** (1 / SRGB_GAMMA_EXPONENT) - SRGB_GAMMA_OFFSET
  );
}

function decodeGamma(encoded: number): number {
  if (encoded <= SRGB_LINEAR_THRESHOLD * SRGB_LINEAR_SLOPE) {
    return encoded / SRGB_LINEAR_SLOPE;
  }

  return (
    ((encoded + SRGB_GAMMA_OFFSET) / SRGB_GAMMA_SCALE) ** SRGB_GAMMA_EXPONENT
  );
}

function toNumber(value: string): number {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Not a number in an oklch color: ${value}`);
  }

  return parsed;
}

/**
 * Converts a CSS `oklch()` value, the form every SchemaForge theme token uses,
 * into the sRGB color a browser would paint.
 */
export function parseOklch(value: string): SrgbColor {
  const match = OKLCH_PATTERN.exec(value.trim());

  if (match === null) {
    throw new Error(`Not an oklch color: ${value}`);
  }

  const [, lightnessText, chromaText, hueText, alphaText, percentSign] = match;
  const lightness = toNumber(lightnessText ?? "");
  const chroma = toNumber(chromaText ?? "");
  const hue = toNumber(hueText ?? "") / DEGREES_PER_RADIAN;
  const rawAlpha = alphaText === undefined ? 1 : toNumber(alphaText);
  const alpha = percentSign === "%" ? rawAlpha / PERCENT : rawAlpha;

  const greenRed = chroma * Math.cos(hue);
  const blueYellow = chroma * Math.sin(hue);
  const cones = [
    OKLAB_TO_CONE.long,
    OKLAB_TO_CONE.medium,
    OKLAB_TO_CONE.short,
  ].map(([towardsGreenRed, towardsBlueYellow]) => {
    return (
      (lightness +
        towardsGreenRed * greenRed +
        towardsBlueYellow * blueYellow) **
      3
    );
  });

  const [red, green, blue] = [
    CONE_TO_LINEAR_SRGB.red,
    CONE_TO_LINEAR_SRGB.green,
    CONE_TO_LINEAR_SRGB.blue,
  ].map((weights) => {
    const linear = weights.reduce(
      (total, weight, index) => total + weight * (cones[index] ?? 0),
      0,
    );

    return clampToUnit(encodeGamma(clampToUnit(linear)));
  });

  return { red: red ?? 0, green: green ?? 0, blue: blue ?? 0, alpha };
}

/**
 * Models a Tailwind color-opacity modifier (a slash followed by a percentage
 * on a color utility), which mixes the token with `transparent` and so scales
 * the alpha the token already has.
 */
export function atOpacity(color: SrgbColor, opacity: number): SrgbColor {
  return { ...color, alpha: color.alpha * opacity };
}

/** Composites a translucent color onto the opaque surface behind it. */
export function flattenOnto(
  foreground: SrgbColor,
  background: SrgbColor,
): SrgbColor {
  if (background.alpha !== 1) {
    throw new Error("The background of a composite has to be opaque.");
  }

  const blend = (front: number, back: number): number =>
    front * foreground.alpha + back * (1 - foreground.alpha);

  return {
    red: blend(foreground.red, background.red),
    green: blend(foreground.green, background.green),
    blue: blend(foreground.blue, background.blue),
    alpha: 1,
  };
}

/** WCAG 2.2 relative luminance of an opaque color. */
export function relativeLuminance(color: SrgbColor): number {
  if (color.alpha !== 1) {
    throw new Error(
      "A translucent color has no luminance of its own; flatten it first.",
    );
  }

  return (
    LUMINANCE_WEIGHTS.red * decodeGamma(color.red) +
    LUMINANCE_WEIGHTS.green * decodeGamma(color.green) +
    LUMINANCE_WEIGHTS.blue * decodeGamma(color.blue)
  );
}

/** WCAG 2.2 contrast ratio between two opaque colors, from 1 to 21. */
export function contrastRatio(first: SrgbColor, second: SrgbColor): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + CONTRAST_OFFSET) / (darker + CONTRAST_OFFSET);
}
