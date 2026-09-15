import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import type { ApplyResult } from "./apply-result.js";
import { withEntry, withoutIds } from "./id-map.js";
import { isJsonEqual } from "./json-equal.js";
import type {
  IndexOperation,
  Operation,
  OperationOfType,
} from "./operation.js";
import { checkColumnList } from "./references.js";

type IndexChanges = OperationOfType<"updateIndex">["changes"];

function addIndex(
  schema: SchemaDocument,
  { index }: OperationOfType<"addIndex">,
): ApplyResult {
  if (schema.indexes[index.id] !== undefined) {
    return rejectOperation("id-already-exists", ["index", "id"]);
  }
  if (schema.tables[index.tableId] === undefined) {
    return rejectOperation("table-not-found", ["index", "tableId"]);
  }
  const columnError = checkColumnList(schema, index.tableId, index.columnIds, [
    "index",
    "columnIds",
  ]);
  if (columnError !== null) {
    return rejectOperation(columnError.code, columnError.path);
  }
  return acceptOperation(
    { ...schema, indexes: withEntry(schema.indexes, index.id, index) },
    { type: "removeIndex", indexId: index.id },
  );
}

// The inverse carries the current value of exactly the keys given a value.
function pickPreviousValues(index: Index, changes: IndexChanges): IndexChanges {
  return {
    ...(changes.name === undefined ? {} : { name: index.name }),
    ...(changes.columnIds === undefined ? {} : { columnIds: index.columnIds }),
    ...(changes.isUnique === undefined ? {} : { isUnique: index.isUnique }),
  };
}

function applyIndexChanges(index: Index, changes: IndexChanges): Index {
  return {
    ...index,
    name: changes.name ?? index.name,
    columnIds: changes.columnIds ?? index.columnIds,
    isUnique: changes.isUnique ?? index.isUnique,
  };
}

function updateIndex(
  schema: SchemaDocument,
  { indexId, changes }: OperationOfType<"updateIndex">,
): ApplyResult {
  const index = schema.indexes[indexId];
  if (index === undefined) {
    return rejectOperation("index-not-found", ["indexId"]);
  }
  const columnError =
    changes.columnIds === undefined
      ? null
      : checkColumnList(schema, index.tableId, changes.columnIds, [
          "changes",
          "columnIds",
        ]);
  if (columnError !== null) {
    return rejectOperation(columnError.code, columnError.path);
  }
  const inverse: Operation = {
    type: "updateIndex",
    indexId,
    changes: pickPreviousValues(index, changes),
  };
  const updated = applyIndexChanges(index, changes);
  if (isJsonEqual(updated, index)) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation(
    { ...schema, indexes: withEntry(schema.indexes, indexId, updated) },
    inverse,
  );
}

function removeIndex(
  schema: SchemaDocument,
  { indexId }: OperationOfType<"removeIndex">,
): ApplyResult {
  const index = schema.indexes[indexId];
  if (index === undefined) {
    return rejectOperation("index-not-found", ["indexId"]);
  }
  return acceptOperation(
    { ...schema, indexes: withoutIds(schema.indexes, [indexId]) },
    { type: "addIndex", index },
  );
}

export function applyIndexOperation(
  schema: SchemaDocument,
  operation: IndexOperation,
): ApplyResult {
  switch (operation.type) {
    case "addIndex":
      return addIndex(schema, operation);
    case "updateIndex":
      return updateIndex(schema, operation);
    case "removeIndex":
      return removeIndex(schema, operation);
    default: {
      const unhandled: never = operation;
      throw new Error(
        `Unhandled index operation: ${JSON.stringify(unhandled)}`,
      );
    }
  }
}
