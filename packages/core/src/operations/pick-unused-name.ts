import { toNameKey } from "../model/name-limits.js";

const NAME_SEPARATOR = "_";
// Attempt 1 is the bare name, so numbering starts at 2.
const FIRST_ATTEMPT = 1;

function numberedName(baseName: string, attempt: number): string {
  return attempt === FIRST_ATTEMPT
    ? baseName
    : `${baseName}${NAME_SEPARATOR}${String(attempt)}`;
}

/**
 * Returns `baseName`, or `baseName_2`, `baseName_3`… with the smallest number
 * whose name key is not in `usedNameKeys` (keys from `toNameKey`).
 */
export function pickUnusedName(
  baseName: string,
  usedNameKeys: ReadonlySet<string>,
): string {
  let attempt = FIRST_ATTEMPT;
  while (usedNameKeys.has(toNameKey(numberedName(baseName, attempt)))) {
    attempt += 1;
  }
  return numberedName(baseName, attempt);
}

export type NameClaimer = {
  /** Marks `name` as taken. */
  readonly reserve: (name: string) => void;
  /**
   * Takes and returns the first of `candidateAt(1)`, `candidateAt(2)`… that is
   * not taken. Calls sharing `sequenceKey` must pass the same `candidateAt`.
   */
  readonly claim: (
    sequenceKey: string,
    candidateAt: (attempt: number) => string,
  ) => string;
  /** Takes and returns the name `pickUnusedName` would pick. */
  readonly claimName: (baseName: string) => string;
};

/**
 * Hands out names one after another, each avoiding `takenNames` and every name
 * claimed or reserved before it, compared by `toNameKey`. Names are only ever
 * added, so every attempt before the last one claimed in a sequence stays
 * taken and the next search resumes there: n clashing names cost O(n), not
 * the O(n²) of calling `pickUnusedName` n times.
 */
export function createNameClaimer(takenNames: Iterable<string>): NameClaimer {
  const usedNameKeys = new Set(Array.from(takenNames, toNameKey));
  const nextAttempts = new Map<string, number>();
  const reserve = (name: string): void => {
    usedNameKeys.add(toNameKey(name));
  };
  const claim = (
    sequenceKey: string,
    candidateAt: (attempt: number) => string,
  ): string => {
    let attempt = nextAttempts.get(sequenceKey) ?? FIRST_ATTEMPT;
    while (usedNameKeys.has(toNameKey(candidateAt(attempt)))) {
      attempt += 1;
    }
    nextAttempts.set(sequenceKey, attempt + 1);
    const name = candidateAt(attempt);
    reserve(name);
    return name;
  };
  return {
    reserve,
    claim,
    claimName: (baseName) =>
      claim(baseName, (attempt) => numberedName(baseName, attempt)),
  };
}
