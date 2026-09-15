import type { SubjectAreaId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import { withEntry } from "./id-map.js";
import { isJsonEqual } from "./json-equal.js";
import type { OperationOfType, TableOperation } from "./operation.js";
import { checkColumnList } from "./references.js";
import { removeTable } from "./remove-table.js";

type TableChanges = OperationOfType<"updateTable">["changes"];

function isValidSubjectAreaReference(
  schema: SchemaDocument,
  subjectAreaId: SubjectAreaId | null,
): boolean {
  return (
    subjectAreaId === null || schema.subjectAreas[subjectAreaId] !== undefined
  );
}

function withTable(schema: SchemaDocument, table: Table): SchemaDocument {
  return { ...schema, tables: withEntry(schema.tables, table.id, table) };
}

function addTable(
  schema: SchemaDocument,
  operation: OperationOfType<"addTable">,
): ApplyResult {
  const { table } = operation;
  if (schema.tables[table.id] !== undefined) {
    return rejectOperation("id-already-exists", ["table", "id"]);
  }
  if (!isValidSubjectAreaReference(schema, table.subjectAreaId)) {
    return rejectOperation("subject-area-not-found", [
      "table",
      "subjectAreaId",
    ]);
  }
  return acceptOperation(
    withTable(schema, { ...table, columnIds: [], primaryKeyColumnIds: [] }),
    { type: "removeTable", tableId: table.id },
  );
}

// A key whose value is undefined counts as not given: JSON cannot carry
// undefined, so neither the applied changes nor the inverse may contain it.
function pickGivenChanges(changes: TableChanges): TableChanges {
  return {
    ...(changes.name === undefined ? {} : { name: changes.name }),
    ...(changes.comment === undefined ? {} : { comment: changes.comment }),
    ...(changes.subjectAreaId === undefined
      ? {}
      : { subjectAreaId: changes.subjectAreaId }),
  };
}

function pickPreviousValues(table: Table, changes: TableChanges): TableChanges {
  return {
    ...(changes.name === undefined ? {} : { name: table.name }),
    ...(changes.comment === undefined ? {} : { comment: table.comment }),
    ...(changes.subjectAreaId === undefined
      ? {}
      : { subjectAreaId: table.subjectAreaId }),
  };
}

function updateTable(
  schema: SchemaDocument,
  operation: OperationOfType<"updateTable">,
): ApplyResult {
  const table = schema.tables[operation.tableId];
  if (table === undefined) {
    return rejectOperation("table-not-found", ["tableId"]);
  }
  const { subjectAreaId } = operation.changes;
  if (
    subjectAreaId !== undefined &&
    !isValidSubjectAreaReference(schema, subjectAreaId)
  ) {
    return rejectOperation("subject-area-not-found", [
      "changes",
      "subjectAreaId",
    ]);
  }
  const givenChanges = pickGivenChanges(operation.changes);
  const previousValues = pickPreviousValues(table, operation.changes);
  const inverse: OperationOfType<"updateTable"> = {
    type: "updateTable",
    tableId: table.id,
    changes: previousValues,
  };
  if (isJsonEqual(givenChanges, previousValues)) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation(
    withTable(schema, { ...table, ...givenChanges }),
    inverse,
  );
}

function setPrimaryKey(
  schema: SchemaDocument,
  operation: OperationOfType<"setPrimaryKey">,
): ApplyResult {
  const table = schema.tables[operation.tableId];
  if (table === undefined) {
    return rejectOperation("table-not-found", ["tableId"]);
  }
  const columnListError = checkColumnList(
    schema,
    table.id,
    operation.columnIds,
    ["columnIds"],
  );
  if (columnListError !== null) {
    return rejectOperation(columnListError.code, columnListError.path);
  }
  const inverse: OperationOfType<"setPrimaryKey"> = {
    type: "setPrimaryKey",
    tableId: table.id,
    columnIds: table.primaryKeyColumnIds,
  };
  if (isJsonEqual(operation.columnIds, table.primaryKeyColumnIds)) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation(
    withTable(schema, { ...table, primaryKeyColumnIds: operation.columnIds }),
    inverse,
  );
}

/** Applies one table operation; the schema is never mutated. */
export function applyTableOperation(
  schema: SchemaDocument,
  operation: TableOperation,
): ApplyResult {
  switch (operation.type) {
    case "addTable":
      return addTable(schema, operation);
    case "updateTable":
      return updateTable(schema, operation);
    case "setPrimaryKey":
      return setPrimaryKey(schema, operation);
    case "removeTable":
      return removeTable(schema, operation);
    default: {
      const unhandled: never = operation;
      throw new Error(
        `Unhandled table operation: ${JSON.stringify(unhandled)}`,
      );
    }
  }
}
