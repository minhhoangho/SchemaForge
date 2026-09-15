import type { GenerateId } from "../model/ids.js";
import { createIndexId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";
import type { Operation, OperationOfType } from "../operations/operation.js";
import type { OperationPlan } from "./operation-plans-shared.js";
import {
  ELEMENT_SLOT,
  MISSING_COLUMN_ID,
  MISSING_INDEX_ID,
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

type IndexChanges = OperationOfType<"updateIndex">["changes"];

const MAX_INDEX_SIZE = 3;

function indexesOf(schema: SchemaDocument): readonly Index[] {
  return sortedById(Object.values(schema.indexes));
}

function indexColumnsFor(
  table: Table,
  plan: OperationPlan,
): Index["columnIds"] {
  const count = 1 + (pickAt(plan, 0) % MAX_INDEX_SIZE);
  return chooseSeveral(table.columnIds, pickAt(plan, 1), count);
}

// Breaks one addIndex condition: an existing id, a repeated column, a column
// of another table, or a missing table.
function corruptedAddIndex(
  schema: SchemaDocument,
  index: Index,
  table: Table,
  plan: OperationPlan,
): Operation {
  const operation: OperationOfType<"addIndex"> = { type: "addIndex", index };
  const firstColumnId = table.columnIds[0] ?? MISSING_COLUMN_ID;
  switch (variantOf(plan, 4)) {
    case 0: {
      const existing = chooseFrom(indexesOf(schema), pickAt(plan, 1));
      return existing === undefined
        ? duplicatedAdd(operation)
        : { type: "addIndex", index: { ...index, id: existing.id } };
    }
    case 1: {
      const columnIds = [firstColumnId, firstColumnId];
      return { type: "addIndex", index: { ...index, columnIds } };
    }
    case 2: {
      const foreign = columnOutside(schema, table, pickAt(plan, 1));
      const columnIds = [foreign?.id ?? MISSING_COLUMN_ID];
      return { type: "addIndex", index: { ...index, columnIds } };
    }
    default: {
      const tableId = MISSING_TABLE_ID;
      return { type: "addIndex", index: { ...index, tableId } };
    }
  }
}

export function resolveAddIndex(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const table = chooseFrom(
    tablesWithColumns(schema),
    pickAt(plan, ELEMENT_SLOT),
  );
  if (table === undefined && !plan.isCorrupted) {
    return resolveAddColumn(schema, plan, generateId);
  }
  const index: Index = {
    id: createIndexId(generateId),
    tableId: table?.id ?? MISSING_TABLE_ID,
    name: plan.text,
    columnIds:
      table === undefined ? [MISSING_COLUMN_ID] : indexColumnsFor(table, plan),
    isUnique: isFlagSet(plan, 0),
  };
  return plan.isCorrupted && table !== undefined
    ? corruptedAddIndex(schema, index, table, plan)
    : { type: "addIndex", index };
}

function indexChangesFor(
  schema: SchemaDocument,
  index: Index,
  plan: OperationPlan,
): IndexChanges {
  const table = schema.tables[index.tableId];
  return {
    ...(isFlagSet(plan, 0) ? { name: plan.text } : {}),
    ...(isFlagSet(plan, 1) ? { isUnique: !index.isUnique } : {}),
    ...(isFlagSet(plan, 2) && table !== undefined
      ? { columnIds: indexColumnsFor(table, plan) }
      : {}),
  };
}

export function resolveUpdateIndex(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const index = chooseFrom(indexesOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (index === undefined && !plan.isCorrupted) {
    return resolveAddIndex(schema, plan, generateId);
  }
  if (index === undefined || (plan.isCorrupted && variantOf(plan, 2) === 0)) {
    const changes = { name: plan.text };
    return { type: "updateIndex", indexId: MISSING_INDEX_ID, changes };
  }
  const firstColumnId = index.columnIds[0] ?? MISSING_COLUMN_ID;
  const changes: IndexChanges = plan.isCorrupted
    ? { columnIds: [firstColumnId, firstColumnId] }
    : indexChangesFor(schema, index, plan);
  return { type: "updateIndex", indexId: index.id, changes };
}

export function resolveRemoveIndex(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  if (plan.isCorrupted) {
    return { type: "removeIndex", indexId: MISSING_INDEX_ID };
  }
  const index = chooseFrom(indexesOf(schema), pickAt(plan, ELEMENT_SLOT));
  return index === undefined
    ? resolveAddIndex(schema, plan, generateId)
    : { type: "removeIndex", indexId: index.id };
}
