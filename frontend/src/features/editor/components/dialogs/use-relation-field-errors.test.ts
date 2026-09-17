import type { OperationError } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { errorFieldOfOperationError } from "./use-relation-field-errors";

describe("errorFieldOfOperationError", () => {
  it.each([
    [
      "a referenced column",
      { code: "column-not-in-table", path: ["referencedColumnIds", 1] },
      "referencedColumns",
    ],
    ["a table", { code: "table-not-found", path: ["toTableId"] }, "tables"],
    ["an unnamed place", { code: "id-already-exists", path: [] }, "tables"],
  ] satisfies readonly (readonly [string, OperationError, string])[])(
    "places an error on %s",
    (_place, error, field) => {
      expect(errorFieldOfOperationError(error)).toBe(field);
    },
  );
});
