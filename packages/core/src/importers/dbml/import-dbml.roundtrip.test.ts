import { describe, expect, it } from "vitest";

import { generateDbml } from "../../generators/dbml/generate-dbml.js";
import { createImportTestOptions } from "../../testing/import-test-options.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { toComparableSchema } from "../../testing/to-comparable-schema.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import { importDbml } from "./import-dbml.js";

// The target-limit fixture is large; @dbml/core is slower on a loaded machine.
const PARSE_TIMEOUT = { timeout: 60_000 };

describe("importDbml round trip", PARSE_TIMEOUT, () => {
  it.each([
    { name: "sample", schema: createSampleSchema() },
    { name: "naming-edge", schema: createNamingEdgeSchema() },
    { name: "target-limit", schema: createTargetLimitSchema() },
  ])(
    "imports the generateDbml output of the $name fixture as the original schema",
    ({ schema }) => {
      const source = generateDbml(schema, {}).file.content;

      const imported = unwrapOk(importDbml(source, createImportTestOptions()));

      expect({
        document: toComparableSchema(imported.document),
        diagnostics: imported.diagnostics,
      }).toStrictEqual({
        document: toComparableSchema(schema),
        diagnostics: [],
      });
    },
  );
});
