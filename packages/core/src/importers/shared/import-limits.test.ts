import { describe, expect, it } from "vitest";

import { createSampleSchema } from "../../testing/sample-schema.js";
import {
  checkSourceLength,
  countDocumentElements,
  MAX_IMPORT_SOURCE_LENGTH,
  MAX_IMPORTED_ELEMENTS,
  tooManyElementsFailure,
} from "./import-limits.js";

describe("import limits", () => {
  it("sets the limits from the spec", () => {
    expect([MAX_IMPORT_SOURCE_LENGTH, MAX_IMPORTED_ELEMENTS]).toStrictEqual([
      2_097_152, 20_000,
    ]);
  });

  it("accepts a source at exactly the length limit", () => {
    expect(checkSourceLength("a".repeat(MAX_IMPORT_SOURCE_LENGTH))).toBeNull();
  });

  it("rejects a source one code unit over the limit with source-too-large", () => {
    expect(
      checkSourceLength("a".repeat(MAX_IMPORT_SOURCE_LENGTH + 1)),
    ).toStrictEqual({
      diagnostics: [{ code: "source-too-large", location: null, path: null }],
    });
  });

  it("counts every element kind of a document", () => {
    // 7 tables, 22 columns, 7 relations, 1 index, 1 enum, 1 subject area, 1 note.
    expect(countDocumentElements(createSampleSchema())).toBe(40);
  });

  it("reports too-many-elements without a location or a path", () => {
    expect(tooManyElementsFailure()).toStrictEqual({
      diagnostics: [{ code: "too-many-elements", location: null, path: null }],
    });
  });
});
