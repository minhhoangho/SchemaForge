import type { DocumentPath } from "../document-path.js";
import type { Column } from "../model/column.js";
import type { EnumId, GenerateId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Operation } from "../operations/operation.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import type { AiEditError } from "./ai-edit-error-codes.js";
import { formatAiName } from "./describe-path-for-ai.js";
import type { AiTablePlacement } from "./place-ai-table.js";
import {
  findColumnByName,
  findEnumByName,
  findTableByName,
} from "./resolve-ai-names.js";

export type AiEditContext = {
  readonly generateId: GenerateId;
  readonly placement: AiTablePlacement;
};

export type Resolved<T> = Result<T, readonly AiEditError[]>;

// `at` names the element the call targets: a core error from applyOperation
// has a path into the operation (["operations", 2, ...] inside a batch), not
// into the document, so it is reported at that element instead.
export type Translation = {
  readonly operation: Operation;
  readonly at: string;
  readonly placedTables?: number;
};

export function tableAt(tableName: string): string {
  return `tables.${formatAiName(tableName)}`;
}

export function columnAt(tableName: string, columnName: string): string {
  return `${tableAt(tableName)}.columns.${formatAiName(columnName)}`;
}

export function enumAt(enumName: string): string {
  return `enums.${formatAiName(enumName)}`;
}

export function failWith(
  code: AiEditError["code"],
  path: DocumentPath,
  at: string,
): Result<never, readonly AiEditError[]> {
  return err([{ code, path, at }]);
}

// Errors of ai-column-spec.ts are relative to the spec; this places them in the tool input.
export function failInside(
  error: AiEditError,
  prefix: DocumentPath,
): Result<never, readonly AiEditError[]> {
  return err([{ ...error, path: [...prefix, ...error.path] }]);
}

export function resolveTable(
  schema: SchemaDocument,
  name: string,
  path: DocumentPath,
): Resolved<Table> {
  const table = findTableByName(schema, name);
  return table === null
    ? failWith("table-name-not-found", path, tableAt(name))
    : ok(table);
}

export function resolveColumn(
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
export function resolveColumns(
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

export function resolveEnumId(
  schema: SchemaDocument,
  name: string,
): Resolved<EnumId> {
  const found = findEnumByName(schema, name);
  return found === null
    ? failWith("enum-name-not-found", ["enum"], enumAt(name))
    : ok(found.id);
}
