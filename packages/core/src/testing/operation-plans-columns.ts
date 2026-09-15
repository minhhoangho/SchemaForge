import type { Column } from "../model/column.js";
import type { GenerateId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Operation, OperationOfType } from "../operations/operation.js";
import type { OperationPlan } from "./operation-plans-shared.js";
import {
  ELEMENT_SLOT,
  MISSING_COLUMN_ID,
  MISSING_ENUM_ID,
  chooseFrom,
  columnTypeFor,
  columnsOf,
  isFlagSet,
  pickAt,
  variantOf,
} from "./operation-plans-shared.js";
import { resolveAddColumn } from "./operation-plans-tables.js";

type ColumnChanges = OperationOfType<"updateColumn">["changes"];

const EXTRA_CHANGE_COUNT = 4;

// One optional change beyond the flag-driven ones, so every column field is
// sometimes updated without making every update large.
function extraColumnChange(column: Column, plan: OperationPlan): ColumnChanges {
  switch (pickAt(plan, 0) % EXTRA_CHANGE_COUNT) {
    case 0:
      return {};
    case 1:
      return { isUnique: !column.isUnique };
    case 2:
      return { isAutoIncrement: !column.isAutoIncrement };
    default:
      return { comment: plan.text };
  }
}

function columnChangesFor(
  schema: SchemaDocument,
  column: Column,
  plan: OperationPlan,
): ColumnChanges {
  return {
    ...(isFlagSet(plan, 0) ? { name: plan.text } : {}),
    ...(isFlagSet(plan, 1)
      ? { type: columnTypeFor(schema, pickAt(plan, 1)) }
      : {}),
    ...(isFlagSet(plan, 2) ? { isNullable: !column.isNullable } : {}),
    ...(isFlagSet(plan, 3) ? { defaultValue: null } : {}),
    ...extraColumnChange(column, plan),
  };
}

export function resolveUpdateColumn(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const column = chooseFrom(columnsOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (column === undefined && !plan.isCorrupted) {
    return resolveAddColumn(schema, plan, generateId);
  }
  if (column === undefined || (plan.isCorrupted && variantOf(plan, 2) === 0)) {
    const changes = { name: plan.text };
    return { type: "updateColumn", columnId: MISSING_COLUMN_ID, changes };
  }
  const changes: ColumnChanges = plan.isCorrupted
    ? { type: { kind: "enum", enumId: MISSING_ENUM_ID } }
    : columnChangesFor(schema, column, plan);
  return { type: "updateColumn", columnId: column.id, changes };
}

function columnCountOfTable(schema: SchemaDocument, column: Column): number {
  return schema.tables[column.tableId]?.columnIds.length ?? 0;
}

export function resolveMoveColumn(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const column = chooseFrom(columnsOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (column === undefined && !plan.isCorrupted) {
    return resolveAddColumn(schema, plan, generateId);
  }
  if (column === undefined || (plan.isCorrupted && variantOf(plan, 2) === 0)) {
    return { type: "moveColumn", columnId: MISSING_COLUMN_ID, toIndex: 0 };
  }
  const columnCount = columnCountOfTable(schema, column);
  // The column count itself is one past the last valid position.
  const toIndex = plan.isCorrupted
    ? columnCount
    : pickAt(plan, 1) % Math.max(columnCount, 1);
  return { type: "moveColumn", columnId: column.id, toIndex };
}

export function resolveRemoveColumn(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  if (plan.isCorrupted) {
    return { type: "removeColumn", columnId: MISSING_COLUMN_ID };
  }
  const column = chooseFrom(columnsOf(schema), pickAt(plan, ELEMENT_SLOT));
  return column === undefined
    ? resolveAddColumn(schema, plan, generateId)
    : { type: "removeColumn", columnId: column.id };
}
