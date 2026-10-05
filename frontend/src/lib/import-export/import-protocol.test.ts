import { createEmptySchema } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { isImportRequest, isImportResponse } from "./import-protocol";

const layout = {
  tableWidth: 320,
  headerHeight: 37,
  columnRowHeight: 28,
  gap: 80,
};

const request = {
  requestId: 1,
  format: "dbml",
  source: "Table a { id int }",
  fallbackSchemaName: "Untitled",
  layout,
  mode: { mode: "new" },
  target: null,
};

describe("isImportRequest", () => {
  it("accepts a well-formed import request", () => {
    expect(isImportRequest(request)).toBe(true);
  });

  it("accepts a merge request with a target and an origin", () => {
    expect(
      isImportRequest({
        ...request,
        mode: { mode: "merge", origin: { x: 10, y: 20 } },
        target: createEmptySchema("Shop"),
      }),
    ).toBe(true);
  });

  it.each([
    ["an unknown format", { ...request, format: "yaml" }],
    ["a missing source", { ...request, source: undefined }],
    ["a non-numeric request id", { ...request, requestId: "1" }],
    ["a layout with a missing number", { ...request, layout: { gap: 1 } }],
    ["an unknown mode", { ...request, mode: { mode: "replace" } }],
    [
      "a merge without a target",
      { ...request, mode: { mode: "merge", origin: { x: 0, y: 0 } } },
    ],
    ["a merge without an origin", { ...request, mode: { mode: "merge" } }],
    ["a target that is not an object", { ...request, target: "x" }],
    ["null", null],
    ["a string", "request"],
  ])("rejects a request with %s", (_name, value) => {
    expect(isImportRequest(value)).toBe(false);
  });
});

describe("isImportResponse", () => {
  it.each([
    [{ requestId: 1, kind: "crashed" }, true],
    [{ requestId: 1, kind: "failure", diagnostics: [] }, true],
    [{ requestId: 1, kind: "other" }, false],
    [{ kind: "crashed" }, false],
    [null, false],
  ])("checks %j", (value, isExpected) => {
    expect(isImportResponse(value)).toBe(isExpected);
  });
});
