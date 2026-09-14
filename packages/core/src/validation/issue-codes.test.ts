import { describe, expect, it } from "vitest";

import { ISSUE_CODES } from "./issue-codes.js";

describe("ISSUE_CODES", () => {
  it("lists the twenty-five issue codes from the spec without duplicates", () => {
    expect(ISSUE_CODES).toStrictEqual([
      "name-empty",
      "name-invalid",
      "name-too-long",
      "table-name-duplicate",
      "enum-name-duplicate",
      "column-name-duplicate",
      "index-name-duplicate",
      "subject-area-name-duplicate",
      "enum-values-empty",
      "enum-value-duplicate",
      "column-type-invalid-scale",
      "column-custom-type-invalid",
      "column-default-invalid",
      "column-default-incompatible",
      "column-primary-key-nullable",
      "column-auto-increment-invalid-type",
      "column-auto-increment-nullable",
      "column-auto-increment-with-default",
      "column-auto-increment-not-key",
      "table-multiple-auto-increment",
      "relation-column-type-mismatch",
      "relation-target-not-unique",
      "relation-one-to-one-not-unique",
      "relation-set-null-not-nullable",
      "relation-set-default-without-default",
    ]);
    expect(new Set(ISSUE_CODES).size).toBe(25);
  });
});
