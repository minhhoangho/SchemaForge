import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  PROPERTY_RUNS,
  PROPERTY_SEED,
  keyOrderArbitrary,
  schemaDocumentArbitrary,
  withShuffledKeys,
} from "../testing/arbitraries.js";
import { validateSchema } from "./validate-schema.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const PROPERTY_TIMEOUT_MS = 60_000;

describe("validateSchema properties", () => {
  it(
    "returns the same issues when the key order of every map is shuffled",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(
          schemaDocumentArbitrary(),
          keyOrderArbitrary(),
          (schema, order) => {
            const shuffled = withShuffledKeys(schema, order);

            expect(validateSchema(shuffled)).toStrictEqual(
              validateSchema(schema),
            );
          },
        ),
        PROPERTY_PARAMETERS,
      );
    },
  );
});
