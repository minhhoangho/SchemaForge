import { describe, expect, it } from "vitest";

import { GENERATOR_DIAGNOSTIC_CODES } from "./diagnostic-codes.js";

describe("generator diagnostic codes", () => {
  it("lists the seventeen diagnostic codes from the spec without duplicates", () => {
    expect(GENERATOR_DIAGNOSTIC_CODES).toStrictEqual([
      "enum-not-supported",
      "type-not-supported",
      "type-parameter-out-of-range",
      "key-column-type-narrowed",
      "key-column-type-not-indexable",
      "referential-action-not-supported",
      "referential-action-cycle",
      "unique-nulls-restricted",
      "table-without-identifier",
      "custom-type-unmapped",
      "custom-type-unsafe",
      "default-omitted",
      "identifier-collision-renamed",
      "null-character-removed",
      "comment-truncated",
      "seed-table-skipped",
      "seed-rows-reduced",
    ]);
    expect(new Set(GENERATOR_DIAGNOSTIC_CODES).size).toBe(17);
  });
});
