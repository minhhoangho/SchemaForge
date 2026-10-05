import { describe, expect, it } from "vitest";

import { STRUCTURAL_ERROR_CODES } from "../../error-codes.js";
import { IMPORT_DIAGNOSTIC_CODES } from "./import-diagnostic-codes.js";

describe("import diagnostic codes", () => {
  it("lists the thirty-nine import diagnostic codes without duplicates", () => {
    expect(IMPORT_DIAGNOSTIC_CODES).toStrictEqual([
      "source-too-large",
      "too-many-elements",
      "parse-failed",
      "syntax-error",
      "reference-not-found",
      "table-renamed",
      "enum-renamed",
      "index-renamed",
      "subject-area-renamed",
      "data-statements-ignored",
      "view-not-supported",
      "routine-not-supported",
      "trigger-not-supported",
      "sequence-not-supported",
      "statement-not-supported",
      "namespace-dropped",
      "index-expression-not-supported",
      "index-type-dropped",
      "check-converted-to-enum",
      "check-constraint-not-supported",
      "computed-column-not-supported",
      "type-approximated",
      "type-parameter-dropped",
      "identity-options-dropped",
      "type-not-supported",
      "default-approximated",
      "sequence-default-as-auto-increment",
      "default-not-supported",
      "on-update-not-supported",
      "provider-not-supported",
      "composite-type-not-supported",
      "scalar-list-as-custom",
      "index-option-dropped",
      "updated-at-not-supported",
      "comment-dropped",
      "color-dropped",
      "back-relation-missing",
      "implicit-many-to-many-not-supported",
      "many-to-many-not-supported",
    ]);
    expect(new Set(IMPORT_DIAGNOSTIC_CODES).size).toBe(39);
  });

  it("shares no code with the structural error codes", () => {
    const structuralCodes = new Set<string>(STRUCTURAL_ERROR_CODES);

    expect(
      IMPORT_DIAGNOSTIC_CODES.filter((code) => structuralCodes.has(code)),
    ).toStrictEqual([]);
  });
});
