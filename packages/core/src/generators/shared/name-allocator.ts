import { toNameKey, utf8ByteLength } from "../../model/name-limits.js";
import { removeCombiningMarks } from "./identifiers.js";

export type NameComparison =
  "exact" | "caseInsensitive" | "caseAndAccentInsensitive";

export type NameAllocator = {
  readonly allocate: (preferred: string) => string;
};

type NameAllocatorOptions = {
  readonly reserved: readonly string[];
  readonly comparison: NameComparison;
  // "" for code identifiers, "_" for SQL names, "-" for path segments.
  readonly separator: "" | "_" | "-";
  // 63 for SQL names; null when the target has no length limit.
  readonly maxBytes: number | null;
};

const FIRST_SUFFIX_NUMBER = 2;

// MySQL compares identifiers with utf8mb3_general_ci, which also folds these
// letters that have no decomposition (spec R12). Identifiers only: enum values
// and data follow the table collation.
const STROKE_LETTER_FOLDS: readonly (readonly [string, string])[] = [
  ["đ", "d"],
  ["ø", "o"],
  ["ł", "l"],
  ["ħ", "h"],
];

export function toComparisonKey(
  name: string,
  comparison: NameComparison,
): string {
  switch (comparison) {
    case "exact":
      return name;
    case "caseInsensitive":
      return toNameKey(name);
    case "caseAndAccentInsensitive":
      return STROKE_LETTER_FOLDS.reduce(
        (key, [letter, folded]) => key.replaceAll(letter, folded),
        toNameKey(removeCombiningMarks(name)),
      );
    default: {
      const unreachable: never = comparison;
      return unreachable;
    }
  }
}

// Iterating a string yields whole code points, so a surrogate pair is never split.
export function truncateToUtf8Bytes(text: string, maxBytes: number): string {
  let prefix = "";
  let byteLength = 0;
  for (const character of text) {
    byteLength += utf8ByteLength(character);
    if (byteLength > maxBytes) {
      break;
    }
    prefix += character;
  }
  return prefix;
}

export function createNameAllocator(
  options: NameAllocatorOptions,
): NameAllocator {
  const { comparison, separator, maxBytes } = options;
  const takenKeys = new Set(
    options.reserved.map((name) => toComparisonKey(name, comparison)),
  );

  const claim = (name: string): boolean => {
    const key = toComparisonKey(name, comparison);
    if (takenKeys.has(key)) {
      return false;
    }
    takenKeys.add(key);
    return true;
  };

  const withSuffix = (preferred: string, suffixNumber: number): string => {
    const suffix = `${separator}${String(suffixNumber)}`;
    const base =
      maxBytes === null
        ? preferred
        : truncateToUtf8Bytes(preferred, maxBytes - utf8ByteLength(suffix));
    return base + suffix;
  };

  return {
    allocate: (preferred) => {
      if (claim(preferred)) {
        return preferred;
      }
      // Each suffix number gives a distinct candidate, so the loop ends.
      for (let suffixNumber = FIRST_SUFFIX_NUMBER; ; suffixNumber += 1) {
        const candidate = withSuffix(preferred, suffixNumber);
        if (claim(candidate)) {
          return candidate;
        }
      }
    },
  };
}
