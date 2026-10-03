import type { Column } from "../model/column.js";
import type { ColumnId, GenerateId } from "../model/ids.js";
import { createTableId } from "../model/ids.js";
import { toNameKey } from "../model/name-limits.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Operation, OperationOfType } from "../operations/operation.js";
import { err, ok } from "../result.js";
import { toColumn, toColumnDefault, toColumnType } from "./ai-column-spec.js";
import type { AiEditError } from "./ai-edit-error-codes.js";
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

type NewTableFields = OperationOfType<"addTable">["table"];

type ColumnChanges = OperationOfType<"updateColumn">["changes"];

function toNewColumns(
  schema: SchemaDocument,
  input: AiEditInput<"createTable">,
  table: Table,
  generateId: GenerateId,
): Resolved<readonly Column[]> {
  const columns: Column[] = [];
  for (const [position, spec] of input.columns.entries()) {
    const column = toColumn(schema, spec, table, generateId);
    if (!column.isOk) {
      return failInside(column.error, ["columns", position]);
    }
    columns.push(column.value);
  }
  return ok(columns);
}

// Two columns sharing a name leave the primary key lookup (AI-R9) without a
// single match, which would read as column-name-not-found, so a repeated
// name is reported first, compared the way core compares names.
function findDuplicateColumns(
  input: AiEditInput<"createTable">,
): readonly AiEditError[] {
  const seenKeys = new Set<string>();
  return input.columns.flatMap((spec, position): AiEditError[] => {
    const key = toNameKey(spec.name);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      return [];
    }
    return [
      {
        code: "column-name-duplicate",
        path: ["columns", position, "name"],
        at: columnAt(input.name, spec.name),
      },
    ];
  });
}

// The new columns are not in the schema yet, so the primary key names are
// matched (AI-R9) in a lookup document that holds only those columns.
function resolveNewPrimaryKey(
  schema: SchemaDocument,
  input: AiEditInput<"createTable">,
  table: Table,
  columns: readonly Column[],
): Resolved<readonly ColumnId[]> {
  const duplicates = findDuplicateColumns(input);
  if (duplicates.length > 0) {
    return err(duplicates);
  }
  const lookup: SchemaDocument = {
    ...schema,
    columns: Object.fromEntries(columns.map((column) => [column.id, column])),
  };
  const primaryKey = resolveColumns(lookup, table, input.primaryKey, [
    "primaryKey",
  ]);
  return primaryKey.isOk
    ? ok(primaryKey.value.map((column) => column.id))
    : primaryKey;
}

function buildCreateTableOperations(
  fields: NewTableFields,
  columns: readonly Column[],
  primaryKeyIds: readonly ColumnId[],
): Operation[] {
  return [
    { type: "addTable", table: fields },
    ...columns.map((column, insertAt): Operation => ({
      type: "addColumn",
      column,
      insertAt,
    })),
    ...(primaryKeyIds.length === 0
      ? []
      : [
          {
            type: "setPrimaryKey",
            tableId: fields.id,
            columnIds: primaryKeyIds,
          } satisfies Operation,
        ]),
  ];
}

export function translateCreateTable(
  schema: SchemaDocument,
  input: AiEditInput<"createTable">,
  context: AiEditContext,
): Resolved<Translation> {
  const fields: NewTableFields = {
    id: createTableId(context.generateId),
    name: input.name,
    comment: input.comment ?? "",
    position: aiTablePosition(context.placement),
    subjectAreaId: null,
  };
  const table: Table = { ...fields, columnIds: [], primaryKeyColumnIds: [] };
  const columns = toNewColumns(schema, input, table, context.generateId);
  if (!columns.isOk) {
    return columns;
  }
  const primaryKey = resolveNewPrimaryKey(schema, input, table, columns.value);
  if (!primaryKey.isOk) {
    return primaryKey;
  }
  return ok({
    operation: {
      type: "batch",
      operations: buildCreateTableOperations(
        fields,
        columns.value,
        primaryKey.value,
      ),
    },
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

// An absent field keeps the column's value, so only given fields are changes.
function toColumnChanges(
  input: AiEditInput<"updateColumn">,
  type: ColumnChanges["type"],
  defaultValue: ColumnChanges["defaultValue"],
): ColumnChanges {
  const { newName, isNullable, isUnique, isAutoIncrement, comment } = input;
  return {
    ...(newName === undefined ? {} : { name: newName }),
    ...(type === undefined ? {} : { type }),
    ...(isNullable === undefined ? {} : { isNullable }),
    ...(isUnique === undefined ? {} : { isUnique }),
    ...(isAutoIncrement === undefined ? {} : { isAutoIncrement }),
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(comment === undefined ? {} : { comment }),
  };
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
  const changes = toColumnChanges(input, type.value, defaultValue.value);
  const columnId = column.value.id;
  return ok({ operation: { type: "updateColumn", columnId, changes }, at });
}

function translateSetPrimaryKey(
  schema: SchemaDocument,
  table: Table,
  names: readonly string[],
): Resolved<Translation> {
  const columns = resolveColumns(schema, table, names, ["columns"]);
  if (!columns.isOk) {
    return columns;
  }
  const columnIds = columns.value.map((column) => column.id);
  return ok({
    operation: { type: "setPrimaryKey", tableId: table.id, columnIds },
    at: tableAt(table.name),
  });
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
    case "setPrimaryKey":
      return translateSetPrimaryKey(schema, table.value, edit.input.columns);
    default: {
      const unhandled: never = edit;
      throw new Error(`Unhandled AI table edit: ${JSON.stringify(unhandled)}`);
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
