import type { ColumnDefault } from "../model/column-default.js";
import type { Column } from "../model/column.js";
import type { ColumnId, GenerateId, SubjectAreaId } from "../model/ids.js";
import { createColumnId, createTableId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Operation, OperationOfType } from "../operations/operation.js";
import type { OperationPlan } from "./operation-plans-shared.js";
import {
  ELEMENT_SLOT,
  MISSING_COLUMN_ID,
  MISSING_ENUM_ID,
  MISSING_SUBJECT_AREA_ID,
  MISSING_TABLE_ID,
  chooseFrom,
  chooseSeveral,
  columnOutside,
  columnTypeFor,
  columnsOf,
  duplicatedAdd,
  isFlagSet,
  pickAt,
  positionFrom,
  sortedById,
  tablesOf,
  variantOf,
} from "./operation-plans-shared.js";

const MAX_PRIMARY_KEY_SIZE = 3;

function subjectAreaFor(
  schema: SchemaDocument,
  plan: OperationPlan,
): SubjectAreaId | null {
  const areas = sortedById(Object.values(schema.subjectAreas));
  return chooseFrom(areas, pickAt(plan, 3))?.id ?? null;
}

export function resolveAddTable(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const table: OperationOfType<"addTable">["table"] = {
    id: createTableId(generateId),
    name: plan.text,
    comment: "",
    position: positionFrom(plan),
    subjectAreaId: isFlagSet(plan, 0) ? subjectAreaFor(schema, plan) : null,
  };
  if (!plan.isCorrupted) {
    return { type: "addTable", table };
  }
  if (variantOf(plan, 2) === 0) {
    const subjectAreaId = MISSING_SUBJECT_AREA_ID;
    return { type: "addTable", table: { ...table, subjectAreaId } };
  }
  const existing = chooseFrom(tablesOf(schema), pickAt(plan, ELEMENT_SLOT));
  return existing === undefined
    ? duplicatedAdd({ type: "addTable", table })
    : { type: "addTable", table: { ...table, id: existing.id } };
}

export function resolveUpdateTable(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const table = chooseFrom(tablesOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (table === undefined && !plan.isCorrupted) {
    return resolveAddTable(schema, plan, generateId);
  }
  if (table === undefined || (plan.isCorrupted && variantOf(plan, 2) === 0)) {
    const changes = { name: plan.text };
    return { type: "updateTable", tableId: MISSING_TABLE_ID, changes };
  }
  if (plan.isCorrupted) {
    const changes = { subjectAreaId: MISSING_SUBJECT_AREA_ID };
    return { type: "updateTable", tableId: table.id, changes };
  }
  const changes = {
    ...(isFlagSet(plan, 0) ? { name: plan.text } : {}),
    ...(isFlagSet(plan, 1) ? { comment: plan.text } : {}),
    ...(isFlagSet(plan, 2)
      ? { subjectAreaId: subjectAreaFor(schema, plan) }
      : {}),
  };
  return { type: "updateTable", tableId: table.id, changes };
}

// Breaks one column list condition: a missing column, a column of another
// table, or a repeated column.
function corruptedPrimaryKey(
  schema: SchemaDocument,
  table: Table,
  plan: OperationPlan,
): readonly ColumnId[] {
  const ownColumn = table.columnIds[0];
  const foreignColumn = columnOutside(schema, table, pickAt(plan, 1));
  const variant = variantOf(plan, 3);
  if (variant === 1 && foreignColumn !== undefined) {
    return [foreignColumn.id];
  }
  if (variant === 2 && ownColumn !== undefined) {
    return [ownColumn, ownColumn];
  }
  return [...table.columnIds, MISSING_COLUMN_ID];
}

export function resolveSetPrimaryKey(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const table = chooseFrom(tablesOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (table === undefined) {
    return plan.isCorrupted
      ? { type: "setPrimaryKey", tableId: MISSING_TABLE_ID, columnIds: [] }
      : resolveAddTable(schema, plan, generateId);
  }
  const columnIds = plan.isCorrupted
    ? corruptedPrimaryKey(schema, table, plan)
    : chooseSeveral(
        table.columnIds,
        pickAt(plan, 1),
        pickAt(plan, 0) % MAX_PRIMARY_KEY_SIZE,
      );
  return { type: "setPrimaryKey", tableId: table.id, columnIds };
}

export function resolveRemoveTable(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  if (plan.isCorrupted) {
    return { type: "removeTable", tableId: MISSING_TABLE_ID };
  }
  const table = chooseFrom(tablesOf(schema), pickAt(plan, ELEMENT_SLOT));
  return table === undefined
    ? resolveAddTable(schema, plan, generateId)
    : { type: "removeTable", tableId: table.id };
}

const DEFAULT_CHOICE_COUNT = 5;

function columnDefaultFor(plan: OperationPlan): ColumnDefault | null {
  switch (pickAt(plan, 3) % DEFAULT_CHOICE_COUNT) {
    case 0:
      return null;
    case 1:
      return { kind: "literal", value: "0" };
    case 2:
      return { kind: "literal", value: plan.text };
    case 3:
      return { kind: "currentTimestamp" };
    default:
      return { kind: "generateUuid" };
  }
}

// Breaks one addColumn condition: an out-of-range position, an existing id, a
// missing enum, or a missing table.
function corruptedAddColumn(
  schema: SchemaDocument,
  operation: OperationOfType<"addColumn">,
  table: Table | undefined,
  plan: OperationPlan,
): Operation {
  const { column } = operation;
  const existing = chooseFrom(columnsOf(schema), pickAt(plan, 1));
  const variant = table === undefined ? 0 : variantOf(plan, 4);
  switch (variant) {
    case 1:
      return { ...operation, insertAt: (table?.columnIds.length ?? 0) + 1 };
    case 2:
      return existing === undefined
        ? duplicatedAdd(operation)
        : { ...operation, column: { ...column, id: existing.id } };
    case 3: {
      const type = { kind: "enum", enumId: MISSING_ENUM_ID } as const;
      return { ...operation, column: { ...column, type } };
    }
    default:
      return { ...operation, column: { ...column, tableId: MISSING_TABLE_ID } };
  }
}

export function resolveAddColumn(
  schema: SchemaDocument,
  plan: OperationPlan,
  generateId: GenerateId,
): Operation {
  const table = chooseFrom(tablesOf(schema), pickAt(plan, ELEMENT_SLOT));
  if (table === undefined && !plan.isCorrupted) {
    return resolveAddTable(schema, plan, generateId);
  }
  const column: Column = {
    id: createColumnId(generateId),
    tableId: table?.id ?? MISSING_TABLE_ID,
    name: plan.text,
    type: columnTypeFor(schema, pickAt(plan, 1)),
    isNullable: isFlagSet(plan, 0),
    defaultValue: columnDefaultFor(plan),
    isUnique: isFlagSet(plan, 1),
    isAutoIncrement: isFlagSet(plan, 2),
    comment: "",
  };
  const columnCount = table?.columnIds.length ?? 0;
  const operation: OperationOfType<"addColumn"> = {
    type: "addColumn",
    column,
    insertAt: pickAt(plan, 0) % (columnCount + 1),
  };
  return plan.isCorrupted
    ? corruptedAddColumn(schema, operation, table, plan)
    : operation;
}
