import { describe, expect, it } from "vitest";

import * as core from "./index.js";

const DOCUMENTED_RUNTIME_VALUES = [
  "CURRENT_SCHEMA_VERSION",
  "ERROR_CODES",
  "GENERATOR_DIAGNOSTIC_CODES",
  "GENERATOR_TARGETS",
  "ISSUE_CODES",
  "MAX_BATCH_DEPTH",
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
  "diffSchemas",
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

const ISSUE_CODE_COUNT = 27;
const ERROR_CODE_COUNT = 17;
const GENERATOR_TARGET_COUNT = 12;
const GENERATOR_DIAGNOSTIC_CODE_COUNT = 17;

describe("public API", () => {
  it("exports exactly the documented runtime values", () => {
    expect(Object.keys(core).toSorted()).toStrictEqual(
      DOCUMENTED_RUNTIME_VALUES,
    );
  });

  it("exposes twenty-seven issue codes and seventeen error codes", () => {
    expect([core.ISSUE_CODES.length, core.ERROR_CODES.length]).toStrictEqual([
      ISSUE_CODE_COUNT,
      ERROR_CODE_COUNT,
    ]);
  });

  it("exposes twelve generator targets and seventeen generator diagnostic codes", () => {
    expect([
      core.GENERATOR_TARGETS.length,
      core.GENERATOR_DIAGNOSTIC_CODES.length,
    ]).toStrictEqual([GENERATOR_TARGET_COUNT, GENERATOR_DIAGNOSTIC_CODE_COUNT]);
  });
});
