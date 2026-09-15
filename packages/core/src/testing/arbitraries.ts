import fc from "fast-check";

import { createEmptySchema } from "../model/create-empty-schema.js";
import type { GenerateId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import type { Operation, OperationType } from "../operations/operation.js";
import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import { createCounterIdGenerator } from "./factories.js";
import type { OperationPlan } from "./operation-plans.js";
import { STEP_OPERATION_TYPES, resolveOperation } from "./operation-plans.js";

export const PROPERTY_SEED = 20260914;
export const PROPERTY_RUNS = 200;

export type SchemaWithOperation = {
  readonly schema: SchemaDocument;
  readonly operation: Operation;
};

const MAX_SCHEMA_STEPS = 30;
const PICK_COUNT = 6;
const FLAG_COUNT = 4;
const MAX_PICK = 999;
const MAX_BATCH_STEPS = 4;
const MAX_NESTED_BATCH_STEPS = 3;
// One plan in CORRUPTION_ODDS is corrupted.
const CORRUPTION_ODDS = 5;
const STEP_PLAN_WEIGHT = 8;
const BATCH_PLAN_WEIGHT = 1;
const FLAT_STEP_WEIGHT = 3;
const NESTED_BATCH_WEIGHT = 1;
const MAX_TEXT_LENGTH = 12;
const MAX_KEY_ORDER_LENGTH = 32;
const SCHEMA_NAME = "property";

type TypeWeights = readonly (readonly [OperationType, number])[];

// Uniform types leave schemas with about one table, almost no primary keys and
// no cascading deletes, so the steps that build a schema favor the operations
// that add structure.
const BUILDING_UNIFORM_WEIGHT = 5;
const BUILDING_TYPE_WEIGHTS: TypeWeights = [
  ["addTable", 3],
  ["addColumn", 6],
  ["setPrimaryKey", 3],
  ["addRelation", 3],
  ["addIndex", 2],
];

// The final operation is the one the properties check, so removals that
// cascade to other elements get an extra share.
const FINAL_UNIFORM_WEIGHT = 10;
const FINAL_TYPE_WEIGHTS: TypeWeights = [
  ["removeTable", 1],
  ["removeColumn", 1],
  ["removeSubjectArea", 1],
];

// Names that collide case-insensitively, are empty, too long (64 bytes),
// non-ASCII, or look like prototype keys, so validation finds issues.
const NAME_CANDIDATES = [
  "users",
  "Users",
  "orders",
  "id",
  "",
  "Tên bảng",
  "a".repeat(64),
  "__proto__",
];

function textArbitrary(): fc.Arbitrary<string> {
  return fc.oneof(
    fc.constantFrom(...NAME_CANDIDATES),
    fc.string({ maxLength: MAX_TEXT_LENGTH }),
  );
}

// Shrinks toward 0, so a failing case shrinks toward an uncorrupted plan.
function corruptionArbitrary(canBeCorrupted: boolean): fc.Arbitrary<boolean> {
  return canBeCorrupted
    ? fc
        .nat({ max: CORRUPTION_ODDS - 1 })
        .map((draw) => draw === CORRUPTION_ODDS - 1)
    : fc.constant(false);
}

// Every step type keeps a share through the uniform part.
function weightedTypeArbitrary(
  uniformWeight: number,
  typeWeights: TypeWeights,
): fc.Arbitrary<OperationType> {
  return fc.oneof(
    {
      arbitrary: fc.constantFrom(...STEP_OPERATION_TYPES),
      weight: uniformWeight,
    },
    ...typeWeights.map(([type, weight]) => ({
      arbitrary: fc.constant(type),
      weight,
    })),
  );
}

function planArbitrary(
  typeArbitrary: fc.Arbitrary<OperationType>,
  stepsArbitrary: fc.Arbitrary<readonly OperationPlan[]>,
  canBeCorrupted: boolean,
): fc.Arbitrary<OperationPlan> {
  return fc.record({
    type: typeArbitrary,
    picks: fc.array(fc.nat({ max: MAX_PICK }), {
      minLength: PICK_COUNT,
      maxLength: PICK_COUNT,
    }),
    text: textArbitrary(),
    flags: fc.array(fc.boolean(), {
      minLength: FLAG_COUNT,
      maxLength: FLAG_COUNT,
    }),
    isCorrupted: corruptionArbitrary(canBeCorrupted),
    steps: stepsArbitrary,
  });
}

function stepPlanArbitrary(
  typeArbitrary: fc.Arbitrary<OperationType>,
  canBeCorrupted: boolean,
): fc.Arbitrary<OperationPlan> {
  return planArbitrary(typeArbitrary, fc.constant([]), canBeCorrupted);
}

// A batch whose steps may include one more level of batch.
function batchPlanArbitrary(
  typeArbitrary: fc.Arbitrary<OperationType>,
  canBeCorrupted: boolean,
): fc.Arbitrary<OperationPlan> {
  const nestedBatch = planArbitrary(
    fc.constant("batch"),
    fc.array(stepPlanArbitrary(typeArbitrary, false), {
      maxLength: MAX_NESTED_BATCH_STEPS,
    }),
    false,
  );
  const steps = fc.array(
    fc.oneof(
      {
        arbitrary: stepPlanArbitrary(typeArbitrary, false),
        weight: FLAT_STEP_WEIGHT,
      },
      { arbitrary: nestedBatch, weight: NESTED_BATCH_WEIGHT },
    ),
    { maxLength: MAX_BATCH_STEPS },
  );
  return planArbitrary(fc.constant("batch"), steps, canBeCorrupted);
}

function operationPlanArbitrary(
  typeArbitrary: fc.Arbitrary<OperationType>,
  canBeCorrupted: boolean,
): fc.Arbitrary<OperationPlan> {
  return fc.oneof(
    {
      arbitrary: stepPlanArbitrary(typeArbitrary, canBeCorrupted),
      weight: STEP_PLAN_WEIGHT,
    },
    {
      arbitrary: batchPlanArbitrary(typeArbitrary, canBeCorrupted),
      weight: BATCH_PLAN_WEIGHT,
    },
  );
}

// size "max" spreads lengths over the whole 0..MAX_SCHEMA_STEPS range instead
// of fast-check's default bias toward short arrays; shrinking still shortens.
function schemaPlansArbitrary(): fc.Arbitrary<readonly OperationPlan[]> {
  const typeArbitrary = weightedTypeArbitrary(
    BUILDING_UNIFORM_WEIGHT,
    BUILDING_TYPE_WEIGHTS,
  );
  return fc.array(operationPlanArbitrary(typeArbitrary, false), {
    maxLength: MAX_SCHEMA_STEPS,
    size: "max",
  });
}

function applyPlans(
  plans: readonly OperationPlan[],
  generateId: GenerateId,
): SchemaDocument {
  return plans.reduce((schema, plan) => {
    const operation = resolveOperation(schema, plan, generateId);
    const result = applyOperation(schema, operation);
    return result.isOk ? result.value.schema : schema;
  }, createEmptySchema(SCHEMA_NAME));
}

/**
 * Structurally valid schemas built by applying up to MAX_SCHEMA_STEPS plans to
 * an empty schema, skipping the steps that fail. Ids come from a fresh counter
 * for every generated value.
 */
export function schemaDocumentArbitrary(): fc.Arbitrary<SchemaDocument> {
  return schemaPlansArbitrary().map((plans) =>
    applyPlans(plans, createCounterIdGenerator()),
  );
}

/**
 * A schema and one operation resolved on it, some of them corrupted. Built
 * with tuple and map instead of chain, so a failure shrinks both the schema
 * steps and the final plan.
 */
export function schemaWithOperationArbitrary(): fc.Arbitrary<SchemaWithOperation> {
  const finalTypeArbitrary = weightedTypeArbitrary(
    FINAL_UNIFORM_WEIGHT,
    FINAL_TYPE_WEIGHTS,
  );
  return fc
    .tuple(
      schemaPlansArbitrary(),
      operationPlanArbitrary(finalTypeArbitrary, true),
    )
    .map(([plans, plan]) => {
      const generateId = createCounterIdGenerator();
      const schema = applyPlans(plans, generateId);
      return { schema, operation: resolveOperation(schema, plan, generateId) };
    });
}

/** Ranks for `withShuffledKeys`: any list gives a permutation of every map. */
export function keyOrderArbitrary(): fc.Arbitrary<readonly number[]> {
  return fc.array(fc.nat({ max: MAX_PICK }), {
    maxLength: MAX_KEY_ORDER_LENGTH,
  });
}

// The entry at position i gets rank order[i % order.length]; equal ranks keep
// reverse insertion order, so even an empty order moves keys around.
function shuffleKeys<Value>(
  map: Readonly<Record<string, Value>>,
  order: readonly number[],
): Readonly<Record<string, Value>> {
  const ranked = Object.entries(map).map(([key, value], position) => ({
    key,
    value,
    position,
    rank: order.length === 0 ? 0 : (order[position % order.length] ?? 0),
  }));
  const shuffled = ranked.toSorted(
    (left, right) => left.rank - right.rank || right.position - left.position,
  );
  return Object.fromEntries(shuffled.map(({ key, value }) => [key, value]));
}

/**
 * Rebuilds the seven maps of `schema` with their keys in an order derived from
 * `order`, keeping the content. Throws if the result does not parse, which
 * would be a bug in this helper.
 */
export function withShuffledKeys(
  schema: SchemaDocument,
  order: readonly number[],
): SchemaDocument {
  const parsed = parseSchemaDocument({
    ...schema,
    tables: shuffleKeys(schema.tables, order),
    columns: shuffleKeys(schema.columns, order),
    relations: shuffleKeys(schema.relations, order),
    indexes: shuffleKeys(schema.indexes, order),
    enums: shuffleKeys(schema.enums, order),
    subjectAreas: shuffleKeys(schema.subjectAreas, order),
    notes: shuffleKeys(schema.notes, order),
  });
  if (!parsed.isOk) {
    throw new Error(
      `withShuffledKeys produced an invalid document: ${JSON.stringify(parsed.error)}`,
    );
  }
  return parsed.value;
}
