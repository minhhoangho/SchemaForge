import { describe, expect, it } from "vitest";

import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import * as testing from "./index.js";

// Upper case sorts before lower case by UTF-16 code unit.
const DOCUMENTED_TESTING_HELPERS = [
  "PRISMA_IMPORT_FIXTURES",
  "SSMS_SCRIPT_EXPECTED_DIAGNOSTICS",
  "SSMS_SCRIPT_SOURCE",
  "buildSchema",
  "createCounterIdGenerator",
  "createLargeSchema",
  "createNamingEdgeSchema",
  "createSampleSchema",
  "createTargetLimitSchema",
  "makeColumn",
  "makeEnum",
  "makeIndex",
  "makeNote",
  "makeRelation",
  "makeSubjectArea",
  "makeTable",
  "unwrapError",
  "unwrapOk",
];

describe("testing entry point", () => {
  it("exports exactly the documented testing helpers", () => {
    expect(Object.keys(testing).toSorted()).toStrictEqual(
      DOCUMENTED_TESTING_HELPERS,
    );
  });

  it("builds a sample schema through the testing entry point", () => {
    const schema = testing.createSampleSchema();

    expect(testing.unwrapOk(parseSchemaDocument(schema))).toStrictEqual(schema);
  });

  it("lists the prisma import fixtures under unique names", () => {
    const names = testing.PRISMA_IMPORT_FIXTURES.map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
  });
});
