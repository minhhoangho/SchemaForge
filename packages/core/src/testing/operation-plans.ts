import type { GenerateId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import { buildManyToMany } from "../operations/build-many-to-many.js";
import type { Operation, OperationType } from "../operations/operation.js";
import {
  resolveMoveColumn,
  resolveRemoveColumn,
  resolveUpdateColumn,
} from "./operation-plans-columns.js";
import {
  resolveAddEnum,
  resolveAddNote,
  resolveAddSubjectArea,
  resolveMoveElements,
  resolveRemoveEnum,
  resolveRemoveNote,
  resolveRemoveSubjectArea,
  resolveRenameSchema,
  resolveUpdateEnum,
  resolveUpdateNote,
  resolveUpdateSubjectArea,
} from "./operation-plans-elements.js";
import {
  resolveAddIndex,
  resolveRemoveIndex,
  resolveUpdateIndex,
} from "./operation-plans-indexes.js";
import {
  resolveAddRelation,
  resolveRemoveRelation,
  resolveUpdateRelation,
} from "./operation-plans-relations.js";
import type { OperationPlan } from "./operation-plans-shared.js";
import {
  isFlagSet,
  pickAt,
  positionFrom,
  sortedById,
} from "./operation-plans-shared.js";
import {
  resolveAddColumn,
  resolveAddTable,
  resolveRemoveTable,
  resolveSetPrimaryKey,
  resolveUpdateTable,
} from "./operation-plans-tables.js";

export type { OperationPlan } from "./operation-plans-shared.js";

/** Every operation type except the recursive `batch`. */
export const STEP_OPERATION_TYPES = [
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
] as const satisfies readonly OperationType[];

/** Applies `operations` in order, skipping the ones that fail. */
function applySkippingFailures(
  schema: SchemaDocument,
  operations: readonly Operation[],
): SchemaDocument {
  return operations.reduce((current, operation) => {
    const result = applyOperation(current, operation);
    return result.isOk ? result.value.schema : current;
  }, schema);
}

// Each step is resolved on the schema left by the steps before it, so a step
// can reference an element an earlier step of the same batch added.
function resolveSteps(
  schema: SchemaDocument,
  steps: readonly OperationPlan[],
  generateId: GenerateId,
): readonly Operation[] {
  return steps.reduce<{
    readonly schema: SchemaDocument;
    readonly operations: readonly Operation[];
  }>(
    (state, step) => {
      const operation = resolveOperation(state.schema, step, generateId);
      return {
        schema: applySkippingFailures(state.schema, [operation]),
        operations: [...state.operations, operation],
      };
    },
    { schema, operations: [] },
  ).operations;
}

// The batch buildManyToMany returns, joining two tables that have a primary
// key; undefined when fewer such tables exist.
function resolveManyToMany(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation | undefined {
  const keyedTables = sortedById(Object.values(schema.tables)).filter(
    (table) => table.primaryKeyColumnIds.length > 0,
  );
  const left = keyedTables[pickAt(plan, 0) % Math.max(keyedTables.length, 1)];
  const right = keyedTables[pickAt(plan, 1) % Math.max(keyedTables.length, 1)];
  if (left === undefined || right === undefined) {
    return undefined;
  }
  const input = {
    leftTableId: left.id,
    rightTableId: right.id,
    junctionTableName: plan.text,
    position: positionFrom(plan),
  };
  const built = buildManyToMany(schema, input, generateId);
  return built.isOk ? built.value : undefined;
}

// A set first flag starts the batch with a buildManyToMany batch (a nested
// batch). A corrupted batch ends with a corrupted step resolved on the schema
// the earlier steps leave, so the whole batch is rejected.
function resolveBatch(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const manyToMany = isFlagSet(plan, 0)
    ? resolveManyToMany(schema, plan, generateId)
    : undefined;
  const leading = manyToMany === undefined ? [] : [manyToMany];
  const afterLeading = applySkippingFailures(schema, leading);
  const operations = [
    ...leading,
    ...resolveSteps(afterLeading, plan.steps, generateId),
  ];
  if (!plan.isCorrupted) {
    return { type: "batch", operations };
  }
  const firstStep = plan.steps[0];
  const tailPlan: OperationPlan = {
    ...(firstStep ?? { ...plan, type: "removeTable" }),
    isCorrupted: true,
  };
  const tail = resolveOperation(
    applySkippingFailures(schema, operations),
    tailPlan,
    generateId,
  );
  return { type: "batch", operations: [...operations, tail] };
}

/**
 * Turns a plan into a concrete operation on `schema`. Picks are taken modulo
 * the number of existing elements, so an uncorrupted plan references ids that
 * exist; when the element it needs is missing, it adds a prerequisite instead
 * (for example `addTable` for an `addColumn` plan on an empty schema). A
 * corrupted plan always resolves to an operation `applyOperation` rejects.
 * New ids come from `generateId`.
 */
export function resolveOperation(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  switch (plan.type) {
    case "renameSchema":
      return resolveRenameSchema(plan);
    case "addTable":
      return resolveAddTable(schema, plan, generateId);
    case "updateTable":
      return resolveUpdateTable(schema, plan, generateId);
    case "setPrimaryKey":
      return resolveSetPrimaryKey(schema, plan, generateId);
    case "removeTable":
      return resolveRemoveTable(schema, plan, generateId);
    case "addColumn":
      return resolveAddColumn(schema, plan, generateId);
    case "updateColumn":
      return resolveUpdateColumn(schema, plan, generateId);
    case "moveColumn":
      return resolveMoveColumn(schema, plan, generateId);
    case "removeColumn":
      return resolveRemoveColumn(schema, plan, generateId);
    case "addRelation":
      return resolveAddRelation(schema, plan, generateId);
    case "updateRelation":
      return resolveUpdateRelation(schema, plan, generateId);
    case "removeRelation":
      return resolveRemoveRelation(schema, plan, generateId);
    case "addIndex":
      return resolveAddIndex(schema, plan, generateId);
    case "updateIndex":
      return resolveUpdateIndex(schema, plan, generateId);
    case "removeIndex":
      return resolveRemoveIndex(schema, plan, generateId);
    case "addEnum":
      return resolveAddEnum(schema, plan, generateId);
    case "updateEnum":
      return resolveUpdateEnum(schema, plan, generateId);
    case "removeEnum":
      return resolveRemoveEnum(schema, plan, generateId);
    case "addSubjectArea":
      return resolveAddSubjectArea(schema, plan, generateId);
    case "updateSubjectArea":
      return resolveUpdateSubjectArea(schema, plan, generateId);
    case "removeSubjectArea":
      return resolveRemoveSubjectArea(schema, plan, generateId);
    case "addNote":
      return resolveAddNote(schema, plan, generateId);
    case "updateNote":
      return resolveUpdateNote(schema, plan, generateId);
    case "removeNote":
      return resolveRemoveNote(schema, plan, generateId);
    case "moveElements":
      return resolveMoveElements(schema, plan);
    case "batch":
      return resolveBatch(schema, plan, generateId);
    default: {
      const unhandled: never = plan.type;
      throw new Error(`Unhandled plan type: ${JSON.stringify(unhandled)}`);
    }
  }
}
