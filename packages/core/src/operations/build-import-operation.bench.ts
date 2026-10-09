import { describe, test } from "vitest";

import {
  countDocumentElements,
  MAX_IMPORTED_ELEMENTS,
} from "../importers/shared/import-limits.js";
import { createEmptySchema } from "../model/create-empty-schema.js";
import type { GenerateId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { createCounterIdGenerator } from "../testing/factories.js";
import { createLargeSchema } from "../testing/large-schema.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { applyOperation } from "./apply-operation.js";
import type { ImportMode } from "./build-import-operation.js";
import { buildImportOperation } from "./build-import-operation.js";
import type { Operation } from "./operation.js";

// Spec section 14 target, read from the median: buildImportOperation then
// applyOperation <= 1 s for 200 tables. The pair at MAX_IMPORTED_ELEMENTS has
// no target (plan issue 11).
const LARGE_SCHEMA_TABLE_COUNT = 200;
// createLargeSchema rejects fewer tables.
const MIN_TABLE_COUNT = 2;
const TARGET_NAME = "Target";
const NEW_MODE: ImportMode = { mode: "new" };
const MERGE_MODE: ImportMode = { mode: "merge", origin: { x: 0, y: 0 } };
// One import of 200 tables takes about a second, so the default of at least
// 64 samples would take minutes.
const IMPORT_RUN_OPTIONS = {
  iterations: 10,
  time: 0,
  warmupIterations: 1,
  warmupTime: 0,
};
// One apply at the limit takes tens of seconds; a warmup would add one more
// and the JIT is warm long before a single run ends.
const LIMIT_APPLY_RUN_OPTIONS = { iterations: 5, time: 0, warmup: false };
// Generous, since the machine running benchmarks is often busy.
const BENCH_TIMEOUT_MS = 1_800_000;

function elementCount(tableCount: number): number {
  return countDocumentElements(createLargeSchema({ tableCount }));
}

// The element count grows with the table count: double past the limit, then
// bisect for the largest table count that still fits.
function findLargestTableCount(): number {
  let fitting = MIN_TABLE_COUNT;
  let tooLarge = fitting * 2;
  while (elementCount(tooLarge) <= MAX_IMPORTED_ELEMENTS) {
    fitting = tooLarge;
    tooLarge *= 2;
  }
  while (tooLarge - fitting > 1) {
    const middle = Math.floor((fitting + tooLarge) / 2);
    if (elementCount(middle) <= MAX_IMPORTED_ELEMENTS) {
      fitting = middle;
    } else {
      tooLarge = middle;
    }
  }
  return fitting;
}

// A rejected batch stops early and would measure only the error path.
function applyOrThrow(schema: SchemaDocument, operation: Operation): void {
  if (!applyOperation(schema, operation).isOk) {
    throw new Error("benchmark import batch is rejected by applyOperation");
  }
}

const counter = createCounterIdGenerator();
// A prefix keeps merged ids clear of the counter ids of the sample schema.
const generateId: GenerateId = () => `bench${counter()}`;

const emptySchema = createEmptySchema(TARGET_NAME);
const sampleSchema = createSampleSchema();
const largeSchema = createLargeSchema({ tableCount: LARGE_SCHEMA_TABLE_COUNT });

const limitTableCount = findLargestTableCount();
const limitSchema = createLargeSchema({ tableCount: limitTableCount });
const limitBatch = buildImportOperation(
  emptySchema,
  limitSchema,
  NEW_MODE,
  generateId,
).operation;

function importInto(target: SchemaDocument, mode: ImportMode): void {
  const { operation } = buildImportOperation(
    target,
    largeSchema,
    mode,
    generateId,
  );
  applyOrThrow(target, operation);
}

// Vitest 5 registers benchmarks through the `bench` test fixture, not a module export.
describe("buildImportOperation and applyOperation", () => {
  test(
    `import createLargeSchema({ tableCount: ${String(LARGE_SCHEMA_TABLE_COUNT)} })`,
    async ({ bench }) => {
      await bench.compare(
        bench("build and apply, new mode on an empty schema", () => {
          importInto(emptySchema, NEW_MODE);
        }),
        bench("build and apply, merge mode on the sample schema", () => {
          importInto(sampleSchema, MERGE_MODE);
        }),
        IMPORT_RUN_OPTIONS,
      );
    },
    BENCH_TIMEOUT_MS,
  );

  test(
    `build at the limit: ${String(limitTableCount)} tables, ${String(countDocumentElements(limitSchema))} elements, ${String(limitBatch.operations.length)} steps`,
    async ({ bench }) => {
      await bench("buildImportOperation, new mode at the element limit", () => {
        buildImportOperation(emptySchema, limitSchema, NEW_MODE, generateId);
      }).run();
    },
    BENCH_TIMEOUT_MS,
  );

  test(
    "apply at the limit",
    async ({ bench }) => {
      await bench("applyOperation of the batch at the element limit", () => {
        applyOrThrow(emptySchema, limitBatch);
      }).run(LIMIT_APPLY_RUN_OPTIONS);
    },
    BENCH_TIMEOUT_MS,
  );
});
