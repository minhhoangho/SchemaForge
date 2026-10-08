import { toNameKey } from "../../model/name-limits.js";

/**
 * The first candidate whose columns are "the same set" as the wanted ones, as
 * the SQL draft compares them: as many columns, and every wanted column among
 * the candidate's by name key. Null when there is none.
 */
export type ColumnSetLookup<Candidate> = (
  columnNames: readonly string[],
) => Candidate | null;

// Equal for the same length and the same name keys in any order.
function setKey(length: number, nameKeys: ReadonlySet<string>): string {
  return JSON.stringify([length, ...[...nameKeys].toSorted()]);
}

/**
 * Wanted columns without a repeated name match exactly the candidates with
 * their length and name keys, so they are found by key in constant time
 * instead of by a scan per lookup (import / export spec, section 1).
 */
export function createColumnSetLookup<Candidate>(
  candidates: readonly Candidate[],
  columnNamesOf: (candidate: Candidate) => readonly string[],
): ColumnSetLookup<Candidate> {
  const byKey = new Map<string, Candidate>();
  const byLength = new Map<number, Candidate[]>();
  candidates.forEach((candidate) => {
    const columnNames = columnNamesOf(candidate);
    const key = setKey(columnNames.length, new Set(columnNames.map(toNameKey)));
    if (!byKey.has(key)) {
      byKey.set(key, candidate);
    }
    const group = byLength.get(columnNames.length) ?? [];
    group.push(candidate);
    byLength.set(columnNames.length, group);
  });
  return (columnNames) => {
    const nameKeys = new Set(columnNames.map(toNameKey));
    if (nameKeys.size === columnNames.length) {
      return byKey.get(setKey(columnNames.length, nameKeys)) ?? null;
    }
    // A repeated wanted name (the parser accepts a foreign key `(a, a, b)`)
    // also matches a candidate with more distinct columns, so only then are
    // the candidates of its length scanned.
    return (
      byLength.get(columnNames.length)?.find((candidate) => {
        const candidateKeys = new Set(columnNamesOf(candidate).map(toNameKey));
        return [...nameKeys].every((key) => candidateKeys.has(key));
      }) ?? null
    );
  };
}
