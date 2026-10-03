import type { Column } from "../model/column.js";
import type { GenerateId } from "../model/ids.js";
import { createTableId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Operation } from "../operations/operation.js";
import { ok } from "../result.js";
import { toColumn, toColumnDefault, toColumnType } from "./ai-column-spec.js";
import type {
  AiEditContext,
  Resolved,
  Translation,
} from "./ai-edit-resolve.js";
import {
  columnAt,
  failInside,
  resolveColumn,
  resolveColumns,
  resolveTable,
  tableAt,
} from "./ai-edit-resolve.js";
import type { AiEdit, AiEditInput } from "./ai-edit-tools.js";
import { aiTablePosition } from "./place-ai-table.js";

export function translateCreateTable(
  schema: SchemaDocument,
  input: AiEditInput<"createTable">,
  context: AiEditContext,
): Resolved<Translation> {
  const fields = {
    id: createTableId(context.generateId),
    name: input.name,
    comment: input.comment ?? "",
    position: aiTablePosition(context.placement),
    subjectAreaId: null,
  };
  const table: Table = { ...fields, columnIds: [], primaryKeyColumnIds: [] };
  const columns: Column[] = [];
  for (const [position, spec] of input.columns.entries()) {
    const column = toColumn(schema, spec, table, context.generateId);
    if (!column.isOk) {
      return failInside(column.error, ["columns", position]);
    }
    columns.push(column.value);
  }
  // The new columns are not in the schema yet, so the primary key names are
  // matched (AI-R9) in a lookup document that holds only those columns.
  const lookup: SchemaDocument = {
    ...schema,
    columns: Object.fromEntries(columns.map((column) => [column.id, column])),
  };
  const primaryKey = resolveColumns(lookup, table, input.primaryKey, [
    "primaryKey",
  ]);
  if (!primaryKey.isOk) {
    return primaryKey;
  }
  const operations: Operation[] = [
    { type: "addTable", table: fields },
    ...columns.map((column, insertAt): Operation => ({
      type: "addColumn",
      column,
      insertAt,
    })),
  ];
  if (primaryKey.value.length > 0) {
    operations.push({
      type: "setPrimaryKey",
      tableId: table.id,
      columnIds: primaryKey.value.map((column) => column.id),
    });
  }
  return ok({
    operation: { type: "batch", operations },
    at: tableAt(table.name),
    placedTables: 1,
  });
}

export function translateAddColumn(
  schema: SchemaDocument,
  input: AiEditInput<"addColumn">,
  generateId: GenerateId,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table, ["table"]);
  if (!table.isOk) {
    return table;
  }
  const after =
    input.after === undefined
      ? ok(null)
      : resolveColumn(schema, table.value, input.after, ["after"]);
  if (!after.isOk) {
    return after;
  }
  const { columnIds } = table.value;
  const insertAt =
    after.value === null
      ? columnIds.length
      : columnIds.indexOf(after.value.id) + 1;
  const column = toColumn(schema, input.column, table.value, generateId);
  if (!column.isOk) {
    return failInside(column.error, ["column"]);
  }
  return ok({
    operation: { type: "addColumn", column: column.value, insertAt },
    at: columnAt(table.value.name, input.column.name),
  });
}

export function translateUpdateColumn(
  schema: SchemaDocument,
  input: AiEditInput<"updateColumn">,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table, ["table"]);
  if (!table.isOk) {
    return table;
  }
  const column = resolveColumn(schema, table.value, input.column, ["column"]);
  if (!column.isOk) {
    return column;
  }
  const at = columnAt(table.value.name, column.value.name);
  const type =
    input.type === undefined
      ? ok(undefined)
      : toColumnType(schema, input.type, at);
  if (!type.isOk) {
    return failInside(type.error, ["type"]);
  }
  // An absent default keeps the column's default; null removes it.
  const defaultValue =
    input.defaultValue === undefined
      ? ok(undefined)
      : toColumnDefault(input.defaultValue, at);
  if (!defaultValue.isOk) {
    return failInside(defaultValue.error, ["defaultValue"]);
  }
  const { newName, isNullable, isUnique, isAutoIncrement, comment } = input;
  const changes = {
    ...(newName === undefined ? {} : { name: newName }),
    ...(type.value === undefined ? {} : { type: type.value }),
    ...(isNullable === undefined ? {} : { isNullable }),
    ...(isUnique === undefined ? {} : { isUnique }),
    ...(isAutoIncrement === undefined ? {} : { isAutoIncrement }),
    ...(defaultValue.value === undefined
      ? {}
      : { defaultValue: defaultValue.value }),
    ...(comment === undefined ? {} : { comment }),
  };
  const columnId = column.value.id;
  return ok({ operation: { type: "updateColumn", columnId, changes }, at });
}

export function translateTableEdit(
  schema: SchemaDocument,
  edit: Extract<
    AiEdit,
    { tool: "updateTable" | "removeTable" | "setPrimaryKey" }
  >,
): Resolved<Translation> {
  const table = resolveTable(schema, edit.input.table, ["table"]);
  if (!table.isOk) {
    return table;
  }
  const tableId = table.value.id;
  const at = tableAt(table.value.name);
  switch (edit.tool) {
    case "updateTable": {
      const { newName, comment } = edit.input;
      const changes = {
        ...(newName === undefined ? {} : { name: newName }),
        ...(comment === undefined ? {} : { comment }),
      };
      return ok({ operation: { type: "updateTable", tableId, changes }, at });
    }
    case "removeTable":
      return ok({ operation: { type: "removeTable", tableId }, at });
    case "setPrimaryKey": {
      const columns = resolveColumns(schema, table.value, edit.input.columns, [
        "columns",
      ]);
      if (!columns.isOk) {
        return columns;
      }
      const columnIds = columns.value.map((column) => column.id);
      return ok({
        operation: { type: "setPrimaryKey", tableId, columnIds },
        at,
      });
    }
  }
}

export function translateColumnEdit(
  schema: SchemaDocument,
  input: AiEditInput<"removeColumn">,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table, ["table"]);
  if (!table.isOk) {
    return table;
  }
  const column = resolveColumn(schema, table.value, input.column, ["column"]);
  if (!column.isOk) {
    return column;
  }
  return ok({
    operation: { type: "removeColumn", columnId: column.value.id },
    at: columnAt(table.value.name, column.value.name),
  });
}
