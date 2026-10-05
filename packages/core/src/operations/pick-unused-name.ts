import { toNameKey } from "../model/name-limits.js";

const NAME_SEPARATOR = "_";
// The first candidate carries no number, so numbering starts at 2.
const FIRST_SUFFIX_NUMBER = 2;

/**
 * Returns `baseName`, or `baseName_2`, `baseName_3`… with the smallest number
 * whose name key is not in `usedNameKeys` (keys from `toNameKey`).
 */
export function pickUnusedName(
  baseName: string,
  usedNameKeys: ReadonlySet<string>,
): string {
  let candidate = baseName;
  let suffixNumber = FIRST_SUFFIX_NUMBER;
  while (usedNameKeys.has(toNameKey(candidate))) {
    candidate = `${baseName}${NAME_SEPARATOR}${String(suffixNumber)}`;
    suffixNumber += 1;
  }
  return candidate;
}
