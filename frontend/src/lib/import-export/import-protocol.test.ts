import { createEmptySchema } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { MAX_IMPORT_FILE_BYTES } from "./decode-import-file";
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

  it("accepts a source exactly at the size limit", () => {
    expect(
      isImportRequest({
        ...request,
        source: "a".repeat(MAX_IMPORT_FILE_BYTES),
      }),
    ).toBe(true);
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
    [
      "a source over the size limit",
      { ...request, source: "a".repeat(MAX_IMPORT_FILE_BYTES + 1) },
    ],
    ["null", null],
    ["a string", "request"],
  ])("rejects a request with %s", (_name, value) => {
    expect(isImportRequest(value)).toBe(false);
  });
});

const summary = {
  tables: 1,
  columns: 2,
  relations: 0,
  indexes: 0,
  enums: 0,
  subjectAreas: 0,
  notes: 0,
};

const success = {
  requestId: 1,
  kind: "success",
  operation: { type: "batch", operations: [] },
  resultDocument: createEmptySchema("Shop"),
  summary,
  diagnostics: [],
  introducedIssues: [],
};

describe("isImportResponse", () => {
  it.each([
    [{ requestId: 1, kind: "crashed" }, true],
    [{ requestId: 1, kind: "failure", diagnostics: [] }, true],
    [success, true],
    [{ requestId: 1, kind: "failure" }, false],
    [{ requestId: 1, kind: "failure", diagnostics: "x" }, false],
    [{ ...success, operation: undefined }, false],
    [{ ...success, resultDocument: null }, false],
    [{ ...success, summary: { ...summary, tables: "1" } }, false],
    [{ ...success, summary: { tables: 1 } }, false],
    [{ ...success, diagnostics: undefined }, false],
    [{ ...success, introducedIssues: {} }, false],
    [{ requestId: 1, kind: "other" }, false],
    [{ kind: "crashed" }, false],
    [null, false],
  ])("checks %j", (value, isExpected) => {
    expect(isImportResponse(value)).toBe(isExpected);
  });
});
