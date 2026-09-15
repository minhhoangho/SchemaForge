import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { applyOperation } from "../operations/apply-operation.js";
import type { OperationType } from "../operations/operation.js";
import {
  PROPERTY_RUNS,
  PROPERTY_SEED,
  schemaWithOperationArbitrary,
  withShuffledKeys,
} from "./arbitraries.js";
import { buildSchema, makeColumn, makeNote, makeTable } from "./factories.js";

const SAMPLE_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const MIN_SUCCESS_RATE = 0.5;
const MIN_FAILURE_RATE = 0.1;
const SAMPLE_TIMEOUT_MS = 30_000;

const ALL_OPERATION_TYPES: readonly OperationType[] = [
  "renameSchema",
  "addTable",
  "updateTable",
  "setPrimaryKey",
  "removeTable",
  "addColumn",
  "updateColumn",
  "moveColumn",
  "removeColumn",
  "addRelation",
  "updateRelation",
  "removeRelation",
  "addIndex",
  "updateIndex",
  "removeIndex",
  "addEnum",
  "updateEnum",
  "removeEnum",
  "addSubjectArea",
  "updateSubjectArea",
  "removeSubjectArea",
  "addNote",
  "updateNote",
  "removeNote",
  "moveElements",
  "batch",
];

// The same values the properties see: same seed, same number of runs.
function sampleSuccessRate(): number {
  const outcomes = fc
    .sample(schemaWithOperationArbitrary(), SAMPLE_PARAMETERS)
    .map(({ schema, operation }) => applyOperation(schema, operation).isOk);
  return outcomes.filter(Boolean).length / outcomes.length;
}

function buildThreeTableSchema(): ReturnType<typeof buildSchema> {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_a" }),
      makeTable({ id: "tbl_b" }),
      makeTable({ id: "tbl_c" }),
    ],
    columns: [
      makeColumn({ id: "col_a", tableId: "tbl_a" }),
      makeColumn({ id: "col_b", tableId: "tbl_b" }),
    ],
    notes: [makeNote({ id: "note_a" }), makeNote({ id: "note_b" })],
  });
}

describe("schemaWithOperationArbitrary", () => {
  it(
    "generates every one of the 26 operation types",
    { timeout: SAMPLE_TIMEOUT_MS },
    () => {
      const types = new Set(
        fc
          .sample(schemaWithOperationArbitrary(), SAMPLE_PARAMETERS)
          .map(({ operation }) => operation.type),
      );

      expect(types).toStrictEqual(new Set(ALL_OPERATION_TYPES));
    },
  );

  it(
    "generates operations that succeed at least half of the time",
    { timeout: SAMPLE_TIMEOUT_MS },
    () => {
      expect(sampleSuccessRate()).toBeGreaterThanOrEqual(MIN_SUCCESS_RATE);
    },
  );

  it(
    "generates operations that fail at least one time in ten",
    { timeout: SAMPLE_TIMEOUT_MS },
    () => {
      expect(1 - sampleSuccessRate()).toBeGreaterThanOrEqual(MIN_FAILURE_RATE);
    },
  );
});

describe("withShuffledKeys", () => {
  it("rebuilds every map in the order given by the ranks", () => {
    const schema = buildThreeTableSchema();

    const shuffled = withShuffledKeys(schema, [2, 0, 1]);

    expect({
      tables: Object.keys(shuffled.tables),
      columns: Object.keys(shuffled.columns),
      notes: Object.keys(shuffled.notes),
    }).toStrictEqual({
      tables: ["tbl_b", "tbl_c", "tbl_a"],
      columns: ["col_b", "col_a"],
      notes: ["note_b", "note_a"],
    });
  });

  it("keeps the content of the schema", () => {
    const schema = buildThreeTableSchema();

    expect(withShuffledKeys(schema, [2, 0, 1])).toStrictEqual(schema);
  });
});
