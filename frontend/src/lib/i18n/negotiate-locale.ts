import { parseLocalePreference } from "@/lib/preferences/preference-cookies";

import type { Locale } from "./supported-locales";
import { DEFAULT_LOCALE, isLocale } from "./supported-locales";

// The Accept-Language header is untrusted input, so only the first ranges are
// read.
export const MAX_LANGUAGE_RANGES = 32;

const RANGE_SEPARATOR = ",";
const PARAMETER_SEPARATOR = ";";
const SUBTAG_SEPARATOR = "-";
const QUALITY_PREFIX = "q=";
const DEFAULT_QUALITY = 1;
const MINIMUM_QUALITY = 0;

type LanguageRange = { readonly locale: Locale; readonly quality: number };

// Returns null for a quality outside 0–1, for q=0, and for a value that is not
// a number, so the caller drops the whole range.
function parseQuality(parameters: readonly string[]): number | null {
  const parameter = parameters.find((part) => part.startsWith(QUALITY_PREFIX));
  if (parameter === undefined) {
    return DEFAULT_QUALITY;
  }

  const quality = Number(parameter.slice(QUALITY_PREFIX.length));
  if (
    !Number.isFinite(quality) ||
    quality <= MINIMUM_QUALITY ||
    quality > DEFAULT_QUALITY
  ) {
    return null;
  }
  return quality;
}

// Unsupported primary subtags, including the wildcard "*", are dropped.
function parseLanguageRange(range: string): LanguageRange | null {
  // RFC 9110 allows optional whitespace around the ";" and inside the weight,
  // so every part is trimmed, not only the range as a whole.
  const [tag, ...parameters] = range
    .toLowerCase()
    .split(PARAMETER_SEPARATOR)
    .map((part) => part.trim());
  const primarySubtag = tag?.split(SUBTAG_SEPARATOR)[0];
  if (primarySubtag === undefined || !isLocale(primarySubtag)) {
    return null;
  }

  const quality = parseQuality(parameters);
  if (quality === null) {
    return null;
  }
  return { locale: primarySubtag, quality };
}

export function negotiateLocale(acceptLanguage: string | null): Locale | null {
  if (acceptLanguage === null) {
    return null;
  }

  const ranges = acceptLanguage
    .split(RANGE_SEPARATOR)
    .slice(0, MAX_LANGUAGE_RANGES)
    .map((range) => parseLanguageRange(range))
    .filter((range) => range !== null);

  // Array.prototype.toSorted is stable, so equal weights keep the header order.
  return ranges.toSorted((a, b) => b.quality - a.quality)[0]?.locale ?? null;
}

export function resolveRequestLocale(input: {
  readonly cookieValue: string | undefined;
  readonly acceptLanguage: string | null;
}): Locale {
  return (
    parseLocalePreference(input.cookieValue) ??
    negotiateLocale(input.acceptLanguage) ??
    DEFAULT_LOCALE
  );
}
