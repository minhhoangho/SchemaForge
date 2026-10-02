import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PROPERTY_RUNS, PROPERTY_SEED } from "../../testing/arbitraries.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { buildSeedDataset } from "./build-seed-dataset.js";
import { validateSeedDataset } from "./validate-seed-dataset.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const PROPERTY_TIMEOUT_MS = 60_000;
const MAX_ROWS_PER_TABLE = 20;
const MAX_SEED = 0xffffffff;

// Every fixture passes validateSchema (spec section 10).
const VALID_FIXTURES = [
  { name: "sample", create: createSampleSchema },
  { name: "naming-edge", create: createNamingEdgeSchema },
  { name: "target-limit", create: createTargetLimitSchema },
];

function seedOptionsArbitrary(): fc.Arbitrary<{
  readonly rowsPerTable: number;
  readonly seed: number;
}> {
  return fc.record({
    rowsPerTable: fc.integer({ min: 1, max: MAX_ROWS_PER_TABLE }),
    seed: fc.integer({ min: 0, max: MAX_SEED }),
  });
}

describe.each(VALID_FIXTURES)("buildSeedDataset on $name", ({ create }) => {
  const schema = create();

  it(
    "produces a dataset that passes validateSeedDataset",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(seedOptionsArbitrary(), (options) => {
          const { dataset } = buildSeedDataset(schema, options);

          expect(validateSeedDataset(schema, dataset)).toStrictEqual([]);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "produces the same dataset for the same seed",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(seedOptionsArbitrary(), (options) => {
          expect(buildSeedDataset(create(), options)).toStrictEqual(
            buildSeedDataset(schema, options),
          );
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );
});
