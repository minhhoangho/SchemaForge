import { describe, expect, it } from "vitest";

import { finalizeImportDiagnostics } from "./importers/shared/import-diagnostics.js";
import { IMPORT_DIAGNOSTIC_CODES } from "./importers/shared/import-diagnostic-codes.js";
import {
  MAX_IMPORT_SOURCE_LENGTH,
  MAX_IMPORTED_ELEMENTS,
} from "./importers/shared/import-limits.js";
import { IMPORT_FORMATS } from "./importers/shared/import-types.js";
import * as core from "./index.js";
import { serializeSchemaDocument } from "./model/serialize-schema-document.js";
import { buildImportOperation } from "./operations/build-import-operation.js";

const DOCUMENTED_RUNTIME_VALUES = [
  "CURRENT_SCHEMA_VERSION",
  "ERROR_CODES",
  "GENERATOR_DIAGNOSTIC_CODES",
  "GENERATOR_TARGETS",
  "IMPORT_DIAGNOSTIC_CODES",
  "IMPORT_FORMATS",
  "ISSUE_CODES",
  "MAX_BATCH_DEPTH",
  "MAX_IMPORTED_ELEMENTS",
  "MAX_IMPORT_SOURCE_LENGTH",
  "applyOperation",
  "buildImportOperation",
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
  "finalizeImportDiagnostics",
  "findIntroducedIssues",
  "mergeLastEntry",
  "parseOperation",
  "parseSchemaDocument",
  "recordEntry",
  "redo",
  "serializeSchemaDocument",
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

  it("exports the import contract and helpers", () => {
    expect([
      core.IMPORT_FORMATS,
      core.IMPORT_DIAGNOSTIC_CODES,
      core.MAX_IMPORT_SOURCE_LENGTH,
      core.MAX_IMPORTED_ELEMENTS,
      core.buildImportOperation,
      core.serializeSchemaDocument,
      core.finalizeImportDiagnostics,
    ]).toStrictEqual([
      IMPORT_FORMATS,
      IMPORT_DIAGNOSTIC_CODES,
      MAX_IMPORT_SOURCE_LENGTH,
      MAX_IMPORTED_ELEMENTS,
      buildImportOperation,
      serializeSchemaDocument,
      finalizeImportDiagnostics,
    ]);
  });
});
