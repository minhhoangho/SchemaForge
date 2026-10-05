import type {
  CoreIndex,
  CoreTable,
} from "../shared/dbml-core-adapter-types.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type { DraftTarget } from "../shared/import-draft.js";
import { locationOf, translateColumn } from "./dbml-columns.js";
import type { DbmlTableContext, TableDraftParts } from "./dbml-columns.js";

const DEFAULT_SCHEMA = "public";
const DEFAULT_INDEX_TYPE = "btree";
const PRIMARY_KEY_FIELD = "primaryKeyColumnIds";

function hasExpression(index: CoreIndex): boolean {
  return index.columns.some(({ isExpression }) => isExpression);
}

function isDroppedIndexType(type: string | null): boolean {
  return type !== null && type.toLowerCase() !== DEFAULT_INDEX_TYPE;
}

/** Index settings the model has no place for: type, note and, on a key, the name. */
function reportIndexSettings(
  index: CoreIndex,
  target: DraftTarget,
  parts: TableDraftParts,
): void {
  const location = locationOf(index.token);
  const codes: readonly ImportDiagnosticCode[] = [
    ...(isDroppedIndexType(index.type)
      ? (["index-type-dropped"] as const)
      : []),
    ...(index.note === null ? [] : (["comment-dropped"] as const)),
    ...(index.isPrimaryKey && index.name !== null
      ? (["index-option-dropped"] as const)
      : []),
  ];
  codes.forEach((code) => parts.diagnostics.push({ code, location, target }));
}

function reportExpressionIndex(index: CoreIndex, parts: TableDraftParts): void {
  parts.diagnostics.push({
    code: "index-expression-not-supported",
    location: locationOf(index.token),
    target: null,
  });
}

/**
 * The first `[pk]` index, else the `pk` columns. The model has one primary
 * key, so any other key definition is dropped with index-option-dropped.
 */
function readPrimaryKey(
  table: CoreTable,
  tableIndex: number,
  parts: TableDraftParts,
): readonly string[] {
  const target: DraftTarget = {
    kind: "table",
    tableIndex,
    field: PRIMARY_KEY_FIELD,
  };
  const keyIndexes = table.indexes.filter(({ isPrimaryKey }) => isPrimaryKey);
  keyIndexes.filter(hasExpression).forEach((index) => {
    reportExpressionIndex(index, parts);
  });
  const [keyIndex, ...otherKeyIndexes] = keyIndexes.filter(
    (index) => !hasExpression(index),
  );
  if (keyIndex === undefined) {
    return table.fields
      .filter(({ isPrimaryKey }) => isPrimaryKey)
      .map(({ name }) => name);
  }
  const dropped = [
    ...table.fields.filter(({ isPrimaryKey }) => isPrimaryKey),
    ...otherKeyIndexes,
  ];
  dropped.forEach(({ token }) =>
    parts.diagnostics.push({
      code: "index-option-dropped",
      location: locationOf(token),
      target,
    }),
  );
  reportIndexSettings(keyIndex, target, parts);
  return keyIndex.columns.map(({ value }) => value);
}

function translateIndex(
  index: CoreIndex,
  tableName: string,
  parts: TableDraftParts,
): void {
  if (hasExpression(index)) {
    reportExpressionIndex(index, parts);
    return;
  }
  const target: DraftTarget = { kind: "index", index: parts.indexes.length };
  parts.indexes.push({
    tableName,
    name: index.name,
    columnNames: index.columns.map(({ value }) => value),
    isUnique: index.isUnique,
    location: locationOf(index.token),
  });
  reportIndexSettings(index, target, parts);
}

function reportTableSettings(
  table: CoreTable,
  tableIndex: number,
  parts: TableDraftParts,
): void {
  const location = locationOf(table.token);
  const target: DraftTarget = { kind: "table", tableIndex };
  if (table.schemaName !== null && table.schemaName !== DEFAULT_SCHEMA) {
    parts.diagnostics.push({ code: "namespace-dropped", location, target });
  }
  if (table.headerColor !== null) {
    parts.diagnostics.push({ code: "color-dropped", location, target });
  }
  table.checks.forEach((check) =>
    parts.diagnostics.push({
      code: "check-constraint-not-supported",
      location: locationOf(check.token) ?? location,
      target: null,
    }),
  );
}

function translateTable(
  table: CoreTable,
  tableIndex: number,
  context: DbmlTableContext,
  parts: TableDraftParts,
): void {
  reportTableSettings(table, tableIndex, parts);
  const primaryKey = readPrimaryKey(table, tableIndex, parts);
  const primaryKeyNames = new Set(primaryKey);
  const columns = table.fields.map((field, columnIndex) =>
    translateColumn(
      field,
      { tableIndex, columnIndex },
      primaryKeyNames.has(field.name),
      context,
      parts,
    ),
  );
  parts.tables.push({
    name: table.name,
    comment: table.note ?? "",
    subjectAreaName: context.subjectAreaByTable.get(table.name) ?? null,
    columns,
    primaryKeyColumnNames: primaryKey,
    location: locationOf(table.token),
  });
  table.indexes
    .filter(({ isPrimaryKey }) => !isPrimaryKey)
    .forEach((index) => {
      translateIndex(index, table.name, parts);
    });
}

/** Tables, their columns and keys, and their indexes (spec section 7). */
export function translateTables(
  tables: readonly CoreTable[],
  context: DbmlTableContext,
): TableDraftParts {
  const parts: TableDraftParts = { tables: [], indexes: [], diagnostics: [] };
  tables.forEach((table, tableIndex) => {
    translateTable(table, tableIndex, context, parts);
  });
  return parts;
}
