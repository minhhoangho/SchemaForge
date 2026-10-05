import type {
  CoreIndex,
  CoreTable,
} from "../shared/dbml-core-adapter-types.js";
import { toNameKey } from "../../model/name-limits.js";
import type {
  DraftColumn,
  DraftDiagnostic,
  DraftTarget,
} from "../shared/import-draft.js";
import { createNameResolver } from "../shared/resolve-references.js";
import type { SqlDraftContext } from "./sql-draft-context.js";
import {
  classifyIndex,
  findDefinition,
  type IndexOutcome,
  type IndexSource,
} from "./sql-draft-index-rules.js";

const DEFAULT_INDEX_TYPE = "btree";

function hasDroppedType(index: CoreIndex): boolean {
  return index.type !== null && index.type.toLowerCase() !== DEFAULT_INDEX_TYPE;
}

function addIndex(
  source: IndexSource,
  outcome: Extract<IndexOutcome, { kind: "index" }>,
): void {
  const { parts } = source.context;
  const target: DraftTarget = { kind: "index", index: parts.indexes.length };
  parts.indexes.push({
    tableName: source.table.name,
    name: outcome.name,
    columnNames: source.columnNames,
    isUnique: source.index.isUnique,
    location: outcome.location,
  });
  if (outcome.hasDroppedOption) {
    parts.diagnostics.push({
      code: "index-option-dropped",
      location: outcome.location,
      target,
    });
  }
  if (hasDroppedType(source.index)) {
    parts.diagnostics.push({
      code: "index-type-dropped",
      location: outcome.location,
      target,
    });
  }
}

type TableColumns = {
  readonly table: CoreTable;
  readonly tableIndex: number;
  readonly columns: readonly DraftColumn[];
  readonly resolveColumn: (name: string) => number | null;
  readonly context: SqlDraftContext;
};

function reportExpressionIndex(index: CoreIndex, target: TableColumns): void {
  const { table, context } = target;
  const definition = findDefinition(index, table, [], context);
  context.parts.diagnostics.push({
    code: "index-expression-not-supported",
    location:
      definition === null
        ? context.locations.table(table.name)
        : context.locations.at(definition.start),
    target: null,
  });
}

// Adds one parsed index to the draft; returns the column it makes unique.
function translateIndex(index: CoreIndex, target: TableColumns): number | null {
  const { table, tableIndex, columns, context } = target;
  if (index.columns.some(({ isExpression }) => isExpression)) {
    reportExpressionIndex(index, target);
    return null;
  }
  const location = context.locations.table(table.name);
  const columnNames = index.columns.map(({ value }) => value);
  const definition = findDefinition(index, table, columnNames, context);
  const source: IndexSource = {
    index,
    table,
    columnNames,
    definition,
    context,
  };
  const outcome = classifyIndex(source);
  const [columnName] = columnNames;
  const columnIndex =
    columnName === undefined ? null : target.resolveColumn(columnName);
  if (outcome.kind === "uniqueColumn" && columnIndex !== null) {
    if (outcome.hasDroppedOption) {
      context.parts.diagnostics.push({
        code: "index-option-dropped",
        location: columns[columnIndex]?.location ?? location,
        target: { kind: "column", tableIndex, columnIndex, field: "isUnique" },
      });
    }
    return columnIndex;
  }
  if (outcome.kind !== "dropped") {
    addIndex(source, {
      kind: "index",
      name: outcome.kind === "index" ? outcome.name : index.name,
      hasDroppedOption: outcome.hasDroppedOption,
      location: outcome.kind === "index" ? outcome.location : location,
    });
  }
  return null;
}

/**
 * Adds the indexes of a parsed table to the draft and returns its columns
 * with the unique flags that come from single-column unique constraints.
 */
export function translateIndexes(
  table: CoreTable,
  tableIndex: number,
  columns: readonly DraftColumn[],
  context: SqlDraftContext,
): readonly DraftColumn[] {
  const target: TableColumns = {
    table,
    tableIndex,
    columns,
    resolveColumn: createNameResolver(columns.map(({ name }) => name)),
    context,
  };
  const uniqueColumnIndexes = new Set(
    table.indexes
      .filter(({ isPrimaryKey }) => !isPrimaryKey)
      .flatMap((index) => translateIndex(index, target) ?? []),
  );
  return columns.map((column, columnIndex) =>
    uniqueColumnIndexes.has(columnIndex)
      ? { ...column, isUnique: true }
      : column,
  );
}

/**
 * The parser (10.2.0) drops a CREATE INDEX on a table the source does not
 * create without an error; the scanner read it, so it is reported as
 * reference-not-found at its statement (spec section 1).
 */
export function reportIndexesOfMissingTables(
  tables: readonly CoreTable[],
  context: SqlDraftContext,
): readonly DraftDiagnostic[] {
  const tableKeys = new Set(tables.map(({ name }) => toNameKey(name)));
  return [...context.indexDefinitions]
    .filter(([tableKey]) => !tableKeys.has(tableKey))
    .flatMap(([, definitions]) => definitions)
    .map(({ start }): DraftDiagnostic => ({
      code: "reference-not-found",
      location: context.locations.at(start),
      target: null,
    }));
}
