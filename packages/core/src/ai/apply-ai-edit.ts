import type { DocumentPath } from "../document-path.js";
import type { Column } from "../model/column.js";
import type { EnumId, GenerateId } from "../model/ids.js";
import { createEnumId, createIndexId, createTableId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import { applyOperation } from "../operations/apply-operation.js";
import type { Operation } from "../operations/operation.js";
import { suggestIndexName } from "../operations/suggest-index-name.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import { findIntroducedIssues } from "../validation/find-introduced-issues.js";
import { toColumn, toColumnDefault, toColumnType } from "./ai-column-spec.js";
import type { AiEditError } from "./ai-edit-error-codes.js";
import type { AiEdit, AiEditInput } from "./ai-edit-tools.js";
import { describePathForAi, formatAiName } from "./describe-path-for-ai.js";
import type { AiTablePlacement } from "./place-ai-table.js";
import { aiTablePosition } from "./place-ai-table.js";
import {
  findColumnByName,
  findEnumByName,
  findIndexByName,
  findTableByName,
} from "./resolve-ai-names.js";

export type AiEditContext = {
  readonly generateId: GenerateId;
  readonly placement: AiTablePlacement;
};

export type AiEditSuccess = {
  readonly schema: SchemaDocument;
  readonly operation: Operation;
  readonly placedTables: number;
};

type Resolved<T> = Result<T, readonly AiEditError[]>;

// `at` names the element the call targets: a core error from applyOperation
// has a path into the operation (["operations", 2, ...] inside a batch), not
// into the document, so it is reported at that element instead.
type Translation = {
  readonly operation: Operation;
  readonly at: string;
  readonly placedTables?: number;
};

function tableAt(tableName: string): string {
  return `tables.${formatAiName(tableName)}`;
}

function columnAt(tableName: string, columnName: string): string {
  return `${tableAt(tableName)}.columns.${formatAiName(columnName)}`;
}

function enumAt(enumName: string): string {
  return `enums.${formatAiName(enumName)}`;
}

function failWith(
  code: AiEditError["code"],
  path: DocumentPath,
  at: string,
): Result<never, readonly AiEditError[]> {
  return err([{ code, path, at }]);
}

// Errors of ai-column-spec.ts are relative to the spec; this places them in the tool input.
function failInside(
  error: AiEditError,
  prefix: DocumentPath,
): Result<never, readonly AiEditError[]> {
  return err([{ ...error, path: [...prefix, ...error.path] }]);
}

function resolveTable(schema: SchemaDocument, name: string): Resolved<Table> {
  const table = findTableByName(schema, name);
  return table === null
    ? failWith("table-name-not-found", ["table"], tableAt(name))
    : ok(table);
}

function resolveColumn(
  schema: SchemaDocument,
  table: Table,
  name: string,
  path: DocumentPath,
): Resolved<Column> {
  const column = findColumnByName(schema, table, name);
  return column === null
    ? failWith("column-name-not-found", path, columnAt(table.name, name))
    : ok(column);
}

/** Resolves every name and reports every one that is missing. */
function resolveColumns(
  schema: SchemaDocument,
  table: Table,
  names: readonly string[],
  path: DocumentPath,
): Resolved<readonly Column[]> {
  const resolved = names.map((name, position) =>
    resolveColumn(schema, table, name, [...path, position]),
  );
  const errors = resolved.flatMap((result) =>
    result.isOk ? [] : result.error,
  );
  const columns = resolved.flatMap((result) =>
    result.isOk ? [result.value] : [],
  );
  return errors.length > 0 ? err(errors) : ok(columns);
}

function resolveEnumId(schema: SchemaDocument, name: string): Resolved<EnumId> {
  const found = findEnumByName(schema, name);
  return found === null
    ? failWith("enum-name-not-found", ["enum"], enumAt(name))
    : ok(found.id);
}

function translateCreateTable(
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

function translateAddColumn(
  schema: SchemaDocument,
  input: AiEditInput<"addColumn">,
  generateId: GenerateId,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table);
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

function translateUpdateColumn(
  schema: SchemaDocument,
  input: AiEditInput<"updateColumn">,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table);
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

function translateTableEdit(
  schema: SchemaDocument,
  edit: Extract<
    AiEdit,
    { tool: "updateTable" | "removeTable" | "setPrimaryKey" }
  >,
): Resolved<Translation> {
  const table = resolveTable(schema, edit.input.table);
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

function translateColumnEdit(
  schema: SchemaDocument,
  input: AiEditInput<"removeColumn">,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table);
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

function translateAddIndex(
  schema: SchemaDocument,
  input: AiEditInput<"addIndex">,
  generateId: GenerateId,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table);
  if (!table.isOk) {
    return table;
  }
  const columns = resolveColumns(schema, table.value, input.columns, [
    "columns",
  ]);
  if (!columns.isOk) {
    return columns;
  }
  const name =
    input.name ??
    suggestIndexName(schema, {
      tableName: table.value.name,
      columnNames: columns.value.map((column) => column.name),
      isUnique: input.isUnique,
    });
  const index = {
    id: createIndexId(generateId),
    tableId: table.value.id,
    name,
    columnIds: columns.value.map((column) => column.id),
    isUnique: input.isUnique,
  };
  return ok({
    operation: { type: "addIndex", index },
    at: `${tableAt(table.value.name)}.indexes.${formatAiName(name)}`,
  });
}

function translateRemoveIndex(
  schema: SchemaDocument,
  input: AiEditInput<"removeIndex">,
): Resolved<Translation> {
  const table = resolveTable(schema, input.table);
  if (!table.isOk) {
    return table;
  }
  const at = `${tableAt(table.value.name)}.indexes.${formatAiName(input.index)}`;
  const index = findIndexByName(schema, table.value, input.index);
  return index === null
    ? failWith("index-name-not-found", ["index"], at)
    : ok({ operation: { type: "removeIndex", indexId: index.id }, at });
}

function translateEnumEdit(
  schema: SchemaDocument,
  edit: Extract<AiEdit, { tool: "updateEnum" | "removeEnum" }>,
): Resolved<Translation> {
  const enumId = resolveEnumId(schema, edit.input.enum);
  if (!enumId.isOk) {
    return enumId;
  }
  const at = enumAt(edit.input.enum);
  if (edit.tool === "removeEnum") {
    return ok({ operation: { type: "removeEnum", enumId: enumId.value }, at });
  }
  const { newName, values } = edit.input;
  const changes = {
    ...(newName === undefined ? {} : { name: newName }),
    ...(values === undefined ? {} : { values }),
  };
  return ok({
    operation: { type: "updateEnum", enumId: enumId.value, changes },
    at,
  });
}

function translate(
  schema: SchemaDocument,
  edit: AiEdit,
  context: AiEditContext,
): Resolved<Translation> {
  switch (edit.tool) {
    case "renameSchema":
      return ok({
        operation: { type: "renameSchema", name: edit.input.name },
        at: "name",
      });
    case "createTable":
      return translateCreateTable(schema, edit.input, context);
    case "updateTable":
    case "removeTable":
    case "setPrimaryKey":
      return translateTableEdit(schema, edit);
    case "addColumn":
      return translateAddColumn(schema, edit.input, context.generateId);
    case "updateColumn":
      return translateUpdateColumn(schema, edit.input);
    case "removeColumn":
      return translateColumnEdit(schema, edit.input);
    case "addIndex":
      return translateAddIndex(schema, edit.input, context.generateId);
    case "removeIndex":
      return translateRemoveIndex(schema, edit.input);
    case "createEnum": {
      const { name, values } = edit.input;
      const id = createEnumId(context.generateId);
      return ok({
        operation: { type: "addEnum", enum: { id, name, values } },
        at: enumAt(name),
      });
    }
    case "updateEnum":
    case "removeEnum":
      return translateEnumEdit(schema, edit);
    case "addRelation":
    case "updateRelation":
    case "removeRelation":
      // Plan Task 5 (ai-assistant) replaces this with the relation translations.
      throw new Error(`applyAiEdit does not translate ${edit.tool} yet`);
    default: {
      const unhandled: never = edit;
      throw new Error(`Unhandled AI edit: ${JSON.stringify(unhandled)}`);
    }
  }
}

/**
 * Translates one AI tool call, which names elements rather than ids, into a
 * core operation and applies it in strict mode (AI-R10, AI-R15): name
 * translation, applyOperation, then findIntroducedIssues. Any error returns
 * `err` and no document; `schema` is never mutated.
 */
export function applyAiEdit(
  schema: SchemaDocument,
  edit: AiEdit,
  context: AiEditContext,
): Result<AiEditSuccess, readonly AiEditError[]> {
  const translated = translate(schema, edit, context);
  if (!translated.isOk) {
    return translated;
  }
  const { operation, at, placedTables = 0 } = translated.value;
  const applied = applyOperation(schema, operation);
  if (!applied.isOk) {
    return failWith(applied.error.code, applied.error.path, at);
  }
  const result = applied.value.schema;
  const issues = findIntroducedIssues(schema, result);
  if (issues.length > 0) {
    return err(
      issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        at: describePathForAi(result, issue.path),
      })),
    );
  }
  return ok({ schema: result, operation, placedTables });
}
