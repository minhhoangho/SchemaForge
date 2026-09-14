import { describe, expect, it } from "vitest";

import {
  ERROR_CODES,
  OPERATION_ERROR_CODES,
  STRUCTURAL_ERROR_CODES,
} from "./error-codes.js";

describe("error codes", () => {
  it("lists the thirteen structural error codes from the spec", () => {
    expect(STRUCTURAL_ERROR_CODES).toStrictEqual([
      "invalid-shape",
      "version-unsupported",
      "id-mismatch",
      "table-not-found",
      "column-not-found",
      "relation-not-found",
      "index-not-found",
      "enum-not-found",
      "subject-area-not-found",
      "note-not-found",
      "column-not-in-table",
      "column-listed-twice",
      "column-ownership-mismatch",
    ]);
  });

  it("lists the four operation error codes from the spec", () => {
    expect(OPERATION_ERROR_CODES).toStrictEqual([
      "id-already-exists",
      "enum-in-use",
      "insert-position-out-of-range",
      "primary-key-missing",
    ]);
  });

  it("lists structural codes before operation codes without duplicates", () => {
    expect(ERROR_CODES).toStrictEqual([
      ...STRUCTURAL_ERROR_CODES,
      ...OPERATION_ERROR_CODES,
    ]);
    expect(new Set(ERROR_CODES).size).toBe(17);
  });
});
