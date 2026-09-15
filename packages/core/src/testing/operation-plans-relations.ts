import type { ColumnId, GenerateId } from "../model/ids.js";
import { createRelationId } from "../model/ids.js";
import type {
  ColumnPair,
  ReferentialAction,
  Relation,
  RelationKind,
} from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Operation, OperationOfType } from "../operations/operation.js";
import type { OperationPlan } from "./operation-plans-shared.js";
import {
  ELEMENT_SLOT,
  MISSING_COLUMN_ID,
  MISSING_RELATION_ID,
  MISSING_TABLE_ID,
  chooseFrom,
  chooseSeveral,
  columnOutside,
  duplicatedAdd,
  isFlagSet,
  pickAt,
  sortedById,
  tablesWithColumns,
  variantOf,
} from "./operation-plans-shared.js";
import { resolveAddColumn } from "./operation-plans-tables.js";

type RelationChanges = OperationOfType<"updateRelation">["changes"];

const REFERENTIAL_ACTIONS: readonly ReferentialAction[] = [
  "noAction",
  "restrict",
  "cascade",
  "setNull",
  "setDefault",
];

const MAX_PAIR_COUNT = 2;

const MISSING_PAIR: ColumnPair = {
  fromColumnId: MISSING_COLUMN_ID,
  toColumnId: MISSING_COLUMN_ID,
};

function actionFor(pick: number): ReferentialAction {
  return chooseFrom(REFERENTIAL_ACTIONS, pick) ?? "noAction";
}

function relationsOf(schema: SchemaDocument): readonly Relation[] {
  return sortedById(Object.values(schema.relations));
}

function zipPairs(
  fromColumnIds: readonly ColumnId[],
  toColumnIds: readonly ColumnId[],
): readonly ColumnPair[] {
  return fromColumnIds.flatMap((fromColumnId, position) => {
    const toColumnId = toColumnIds[position];
    return toColumnId === undefined ? [] : [{ fromColumnId, toColumnId }];
  });
}

// The referenced side prefers the primary key, as a real foreign key would.
function pairsBetween(
  from: Table,
  to: Table,
  plan: OperationPlan,
): readonly ColumnPair[] {
  const toSource =
    to.primaryKeyColumnIds.length > 0 ? to.primaryKeyColumnIds : to.columnIds;
  const count = Math.min(
    1 + (pickAt(plan, 3) % MAX_PAIR_COUNT),
    toSource.length,
  );
  const fromColumnIds = chooseSeveral(from.columnIds, pickAt(plan, 4), count);
  return zipPairs(fromColumnIds, toSource);
}

// Breaks one addRelation condition: an existing id, a column of another
// table, a repeated column, or a missing table.
function corruptedAddRelation(
  schema: SchemaDocument,
  relation: Relation,
  from: Table,
  plan: OperationPlan,
): Operation {
  const operation: OperationOfType<"addRelation"> = {
    type: "addRelation",
    relation,
  };
  const firstPair = relation.columnPairs[0] ?? MISSING_PAIR;
  switch (variantOf(plan, 4)) {
    case 0: {
      const existing = chooseFrom(relationsOf(schema), pickAt(plan, 1));
      return existing === undefined
        ? duplicatedAdd(operation)
        : { type: "addRelation", relation: { ...relation, id: existing.id } };
    }
    case 1: {
      const foreign = columnOutside(schema, from, pickAt(plan, 1));
      const fromColumnId = foreign?.id ?? MISSING_COLUMN_ID;
      const columnPairs = [{ ...firstPair, fromColumnId }];
      return { type: "addRelation", relation: { ...relation, columnPairs } };
    }
    case 2: {
      const columnPairs = [firstPair, firstPair];
      return { type: "addRelation", relation: { ...relation, columnPairs } };
    }
    default: {
      const toTableId = MISSING_TABLE_ID;
      return { type: "addRelation", relation: { ...relation, toTableId } };
    }
  }
}

export function resolveAddRelation(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const candidates = tablesWithColumns(schema);
  const from = chooseFrom(candidates, pickAt(plan, ELEMENT_SLOT));
  const to = chooseFrom(candidates, pickAt(plan, 1));
  if ((from === undefined || to === undefined) && !plan.isCorrupted) {
    return resolveAddColumn(schema, plan, generateId);
  }
  const relation: Relation = {
    id: createRelationId(generateId),
    kind: isFlagSet(plan, 0) ? "oneToOne" : "oneToMany",
    fromTableId: from?.id ?? MISSING_TABLE_ID,
    toTableId: to?.id ?? MISSING_TABLE_ID,
    columnPairs:
      from === undefined || to === undefined
        ? [MISSING_PAIR]
        : pairsBetween(from, to, plan),
    onDelete: actionFor(pickAt(plan, 0)),
    onUpdate: isFlagSet(plan, 1) ? "cascade" : "noAction",
  };
  return plan.isCorrupted && from !== undefined
    ? corruptedAddRelation(schema, relation, from, plan)
    : { type: "addRelation", relation };
}

// New from-side columns for the same referenced columns, so the pair count
// and the tables stay the same.
function rotatedPairs(
  schema: SchemaDocument,
  relation: Relation,
  plan: OperationPlan,
): readonly ColumnPair[] {
  const from = schema.tables[relation.fromTableId];
  if (from === undefined) {
    return relation.columnPairs;
  }
  const fromColumnIds = chooseSeveral(
    from.columnIds,
    pickAt(plan, 4),
    relation.columnPairs.length,
  );
  const toColumnIds = relation.columnPairs.map((pair) => pair.toColumnId);
  return zipPairs(fromColumnIds, toColumnIds);
}

function relationChangesFor(
  schema: SchemaDocument,
  relation: Relation,
  plan: OperationPlan,
): RelationChanges {
  const toggledKind: RelationKind =
    relation.kind === "oneToOne" ? "oneToMany" : "oneToOne";
  return {
    ...(isFlagSet(plan, 0) ? { kind: toggledKind } : {}),
    ...(isFlagSet(plan, 1) ? { onDelete: actionFor(pickAt(plan, 0)) } : {}),
    ...(isFlagSet(plan, 2) ? { onUpdate: actionFor(pickAt(plan, 3)) } : {}),
    ...(isFlagSet(plan, 3)
      ? { columnPairs: rotatedPairs(schema, relation, plan) }
      : {}),
  };
}

export function resolveUpdateRelation(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const relation = chooseFrom(relationsOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (relation === undefined && !plan.isCorrupted) {
    return resolveAddRelation(schema, plan, generateId);
  }
  if (
    relation === undefined ||
    (plan.isCorrupted && variantOf(plan, 2) === 0)
  ) {
    const changes = { onDelete: "cascade" } as const;
    return { type: "updateRelation", relationId: MISSING_RELATION_ID, changes };
  }
  const changes: RelationChanges = plan.isCorrupted
    ? { columnPairs: [...relation.columnPairs, MISSING_PAIR] }
    : relationChangesFor(schema, relation, plan);
  return { type: "updateRelation", relationId: relation.id, changes };
}

export function resolveRemoveRelation(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  if (plan.isCorrupted) {
    return { type: "removeRelation", relationId: MISSING_RELATION_ID };
  }
  const relation = chooseFrom(relationsOf(schema), pickAt(plan, ELEMENT_SLOT));
  return relation === undefined
    ? resolveAddRelation(schema, plan, generateId)
    : { type: "removeRelation", relationId: relation.id };
}
