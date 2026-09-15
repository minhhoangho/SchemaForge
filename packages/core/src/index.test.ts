import { describe, expect, it } from "vitest";

import * as core from "./index.js";

const DOCUMENTED_RUNTIME_VALUES = [
  "CURRENT_SCHEMA_VERSION",
  "ERROR_CODES",
  "ISSUE_CODES",
  "MAX_BATCH_DEPTH",
  "PRODUCT_NAME",
  "applyOperation",
  "buildManyToMany",
  "buildRelation",
  "createColumnId",
  "createEmptyHistory",
  "createEmptySchema",
  "createEnumId",
  "createIndexId",
  "createNoteId",
  "createRelationId",
  "createSubjectAreaId",
  "createTableId",
  "findIntroducedIssues",
  "mergeLastEntry",
  "parseOperation",
  "parseSchemaDocument",
  "recordEntry",
  "redo",
  "sortEnums",
  "sortIndexes",
  "sortNotes",
  "sortRelations",
  "sortSubjectAreas",
  "sortTables",
  "suggestIndexName",
  "undo",
  "validateSchema",
];

const ISSUE_CODE_COUNT = 25;
const ERROR_CODE_COUNT = 17;

describe("public API", () => {
  it("exports exactly the documented runtime values", () => {
    expect(Object.keys(core).toSorted()).toStrictEqual(
      DOCUMENTED_RUNTIME_VALUES,
    );
  });

  it("exposes twenty-five issue codes and seventeen error codes", () => {
    expect([core.ISSUE_CODES.length, core.ERROR_CODES.length]).toStrictEqual([
      ISSUE_CODE_COUNT,
      ERROR_CODE_COUNT,
    ]);
  });
});

describe("PRODUCT_NAME", () => {
  it("is the product name", () => {
    expect(core.PRODUCT_NAME).toBe("SchemaForge");
  });
});
