import { describe, test } from "vitest";

import { listGeneratorCases } from "../testing/generator-cases.js";
import { createLargeSchema } from "../testing/large-schema.js";
import { buildSeedDataset, generateSeed } from "./seed/index.js";

// Spec section 9 targets, read from the p75 column: each generator <= 100 ms,
// seed with 100 rows per table <= 500 ms.
const LARGE_SCHEMA_TABLE_COUNT = 200;
const SEED_ROWS_PER_TABLE = 100;
const SEED_VALUE = 1;
// 19 benchmarks of at least 64 samples each take about a minute; the margin
// covers a busy machine.
const BENCH_TIMEOUT_MS = 300_000;

const schema = createLargeSchema({ tableCount: LARGE_SCHEMA_TABLE_COUNT });

// A seed bench over an empty dataset would measure nothing.
const { dataset } = buildSeedDataset(schema, {
  rowsPerTable: SEED_ROWS_PER_TABLE,
  seed: SEED_VALUE,
});
if (!dataset.tables.some((table) => table.rows.length > 0)) {
  throw new Error("benchmark seed dataset has no rows");
}

// Vitest 5 registers benchmarks through the `bench` test fixture, not a module export.
describe("generators on createLargeSchema({ tableCount: 200 })", () => {
  test(
    "all generator variants",
    async ({ bench }) => {
      await bench.compare(
        ...listGeneratorCases().map((generatorCase) =>
          bench(generatorCase.name, () => {
            generatorCase.run(schema);
          }),
        ),
        bench("seed postgresql with 100 rows per table", () => {
          generateSeed(schema, {
            format: "postgresql",
            rowsPerTable: SEED_ROWS_PER_TABLE,
            seed: SEED_VALUE,
          });
        }),
      );
    },
    BENCH_TIMEOUT_MS,
  );
});
