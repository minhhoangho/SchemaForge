import { describe, expect, it } from "vitest";

import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import * as testing from "./index.js";

const DOCUMENTED_TESTING_HELPERS = [
  "buildSchema",
  "createCounterIdGenerator",
  "createSampleSchema",
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
});
