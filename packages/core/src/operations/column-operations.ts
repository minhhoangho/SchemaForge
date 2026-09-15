import type { ColumnType } from "../model/column-type.js";
import type { Column } from "../model/column.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import { withEntry } from "./id-map.js";
import { isJsonEqual } from "./json-equal.js";
import type {
  ColumnOperation,
  Operation,
  OperationOfType,
} from "./operation.js";
import { findColumnPlacement, removeColumn } from "./remove-column.js";

type ColumnChanges = OperationOfType<"updateColumn">["changes"];

function isMissingEnum(schema: SchemaDocument, type: ColumnType): boolean {
  return type.kind === "enum" && schema.enums[type.enumId] === undefined;
}

function addColumn(
  schema: SchemaDocument,
  operation: OperationOfType<"addColumn">,
): ApplyResult {
  const { column, insertAt } = operation;
  if (schema.columns[column.id] !== undefined) {
    return rejectOperation("id-already-exists", ["column", "id"]);
  }
  const table = schema.tables[column.tableId];
  if (table === undefined) {
    return rejectOperation("table-not-found", ["column", "tableId"]);
  }
  if (isMissingEnum(schema, column.type)) {
    return rejectOperation("enum-not-found", ["column", "type", "enumId"]);
  }
  if (insertAt > table.columnIds.length) {
    return rejectOperation("insert-position-out-of-range", ["insertAt"]);
  }
  const nextTable = {
    ...table,
    columnIds: table.columnIds.toSpliced(insertAt, 0, column.id),
  };
  const nextSchema: SchemaDocument = {
    ...schema,
    tables: withEntry(schema.tables, table.id, nextTable),
    columns: withEntry(schema.columns, column.id, column),
  };
  return acceptOperation(nextSchema, {
    type: "removeColumn",
    columnId: column.id,
  });
}

// A change whose value is undefined counts as not passed. `defaultValue` is
// nullable, so it is compared with undefined instead of using `??`. Listing
// id and tableId (instead of spreading the column) makes a new Column field a
// compile error here until it is handled.
function mergeColumnChanges(column: Column, changes: ColumnChanges): Column {
  return {
    id: column.id,
    tableId: column.tableId,
    name: changes.name ?? column.name,
    type: changes.type ?? column.type,
    isNullable: changes.isNullable ?? column.isNullable,
    defaultValue:
      changes.defaultValue === undefined
        ? column.defaultValue
        : changes.defaultValue,
    isUnique: changes.isUnique ?? column.isUnique,
    isAutoIncrement: changes.isAutoIncrement ?? column.isAutoIncrement,
    comment: changes.comment ?? column.comment,
  };
}

// The inverse carries previous values only for keys passed with a value.
function previousColumnValues(
  column: Column,
  changes: ColumnChanges,
): ColumnChanges {
  return {
    ...(changes.name === undefined ? {} : { name: column.name }),
    ...(changes.type === undefined ? {} : { type: column.type }),
    ...(changes.isNullable === undefined
      ? {}
      : { isNullable: column.isNullable }),
    ...(changes.defaultValue === undefined
      ? {}
      : { defaultValue: column.defaultValue }),
    ...(changes.isUnique === undefined ? {} : { isUnique: column.isUnique }),
    ...(changes.isAutoIncrement === undefined
      ? {}
      : { isAutoIncrement: column.isAutoIncrement }),
    ...(changes.comment === undefined ? {} : { comment: column.comment }),
  };
}

// A type change never touches relations: a type mismatch is a semantic issue.
function updateColumn(
  schema: SchemaDocument,
  operation: OperationOfType<"updateColumn">,
): ApplyResult {
  const { columnId, changes } = operation;
  const column = schema.columns[columnId];
  if (column === undefined) {
    return rejectOperation("column-not-found", ["columnId"]);
  }
  if (changes.type !== undefined && isMissingEnum(schema, changes.type)) {
    return rejectOperation("enum-not-found", ["changes", "type", "enumId"]);
  }
  const inverse: Operation = {
    type: "updateColumn",
    columnId,
    changes: previousColumnValues(column, changes),
  };
  const nextColumn = mergeColumnChanges(column, changes);
  if (isJsonEqual(nextColumn, column)) {
    return acceptOperation(schema, inverse);
  }
  const nextSchema: SchemaDocument = {
    ...schema,
    columns: withEntry(schema.columns, columnId, nextColumn),
  };
  return acceptOperation(nextSchema, inverse);
}

function moveColumn(
  schema: SchemaDocument,
  operation: OperationOfType<"moveColumn">,
): ApplyResult {
  const { columnId, toIndex } = operation;
  const column = schema.columns[columnId];
  if (column === undefined) {
    return rejectOperation("column-not-found", ["columnId"]);
  }
  const { table, columnIndex } = findColumnPlacement(schema, column);
  if (toIndex >= table.columnIds.length) {
    return rejectOperation("insert-position-out-of-range", ["toIndex"]);
  }
  const inverse: Operation = {
    type: "moveColumn",
    columnId,
    toIndex: columnIndex,
  };
  if (toIndex === columnIndex) {
    return acceptOperation(schema, inverse);
  }
  // Removing first leaves length - 1 items, so toIndex is a valid insert
  // position and the column ends up exactly at toIndex.
  const columnIds = table.columnIds
    .toSpliced(columnIndex, 1)
    .toSpliced(toIndex, 0, columnId);
  const nextSchema: SchemaDocument = {
    ...schema,
    tables: withEntry(schema.tables, table.id, { ...table, columnIds }),
  };
  return acceptOperation(nextSchema, inverse);
}

/**
 * Applies a column operation to a structurally valid schema. The operation's
 * shape must already be checked; this checks only references and positions.
 */
export function applyColumnOperation(
  schema: SchemaDocument,
  operation: ColumnOperation,
): ApplyResult {
  switch (operation.type) {
    case "addColumn":
      return addColumn(schema, operation);
    case "updateColumn":
      return updateColumn(schema, operation);
    case "moveColumn":
      return moveColumn(schema, operation);
    case "removeColumn":
      return removeColumn(schema, operation);
    default: {
      const unhandled: never = operation;
      throw new Error(
        `Unhandled column operation: ${JSON.stringify(unhandled)}`,
      );
    }
  }
}
