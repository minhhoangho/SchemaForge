import { describe, expect, it } from "vitest";

import { createColumnSetLookup } from "./sql-column-set-lookup.js";

const CANDIDATES: readonly (readonly string[])[] = [
  ["a", "b", "c"],
  ["x", "y"],
  ["Y", "X"],
  [],
];

function findIn(wanted: readonly string[]): readonly string[] | null {
  return createColumnSetLookup(CANDIDATES, (names) => names)(wanted);
}

describe("createColumnSetLookup", () => {
  it.each<readonly [string, readonly string[], readonly string[] | null]>([
    [
      "the same names in another order and case",
      ["C", "a", "B"],
      ["a", "b", "c"],
    ],
    ["the first of several matches", ["y", "x"], ["x", "y"]],
    ["the empty list for no names", [], []],
    ["nothing for fewer names", ["a", "b"], null],
    ["nothing for a missing name", ["a", "b", "d"], null],
    [
      "a wider candidate of its length for a repeated name",
      ["b", "B", "a"],
      ["a", "b", "c"],
    ],
    [
      "nothing for a repeated name without such a candidate",
      ["a", "a", "d"],
      null,
    ],
  ])("finds %s", (_, wanted, expected) => {
    expect(findIn(wanted)).toStrictEqual(expected);
  });

  // Counts how often candidates are read instead of timing.
  it("reads each candidate once however many lookups there are", () => {
    const count = 1000;
    const candidates = Array.from({ length: count }, (_, position) => [
      `c${String(position)}`,
    ]);
    let reads = 0;
    const find = createColumnSetLookup(candidates, (names) => {
      reads += 1;
      return names;
    });

    const found = candidates.map((names) => find(names));

    expect(found).toStrictEqual(candidates);
    expect(reads).toBe(count);
  });
});
