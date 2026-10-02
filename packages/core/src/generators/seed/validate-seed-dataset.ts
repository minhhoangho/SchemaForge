import type { DocumentPath } from "../../document-path.js";
import { sortByPathThenCode } from "../../document-path.js";
import type { Column } from "../../model/column.js";
import type { ColumnId, RelationId, TableId } from "../../model/ids.js";
import { sortIndexes, sortRelations } from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import { isValidJsonValue } from "../shared/json-representation.js";
import type { JsonValue } from "../shared/json-representation.js";
import type {
  SeedDataset,
  SeedIssue,
  SeedIssueCode,
  SeedRow,
} from "./seed-dataset.js";

type ValidationContext = {
  readonly schema: SchemaDocument;
  readonly dataset: SeedDataset;
  // Position of each schema table's first entry in the dataset.
  readonly positions: ReadonlyMap<TableId, number>;
};

/** The primary key, each unique column and each unique index of `table`. */
export function listSeedUniqueKeys(
  schema: SchemaDocument,
  table: Table,
): readonly (readonly ColumnId[])[] {
  const uniqueColumns = table.columnIds
    .filter((columnId) => schema.columns[columnId]?.isUnique === true)
    .map((columnId) => [columnId]);
  const uniqueIndexes = sortIndexes(schema)
    .filter((index) => index.tableId === table.id && index.isUnique)
    .map((index) => index.columnIds);
  return [table.primaryKeyColumnIds, ...uniqueColumns, ...uniqueIndexes].filter(
    (columnIds) => columnIds.length > 0,
  );
}

/** The row's values for `columnIds` as one comparable string, or null when one is null or missing. */
export function toSeedKey(
  row: SeedRow,
  columnIds: readonly ColumnId[],
): string | null {
  const values = columnIds.map((columnId) => row[columnId]);
  const isComplete = values.every(
    (value) => value !== undefined && value !== null,
  );
  return isComplete ? JSON.stringify(values) : null;
}

function findFirstPositions(
  schema: SchemaDocument,
  dataset: SeedDataset,
): ReadonlyMap<TableId, number> {
  const positions = new Map<TableId, number>();
  dataset.tables.forEach((entry, position) => {
    if (
      schema.tables[entry.tableId] !== undefined &&
      !positions.has(entry.tableId)
    ) {
      positions.set(entry.tableId, position);
    }
  });
  return positions;
}

function findValueProblem(
  column: Column,
  value: JsonValue | undefined,
  enums: SchemaDocument["enums"],
): SeedIssueCode | null {
  if (value === undefined) {
    const isFilledByDatabase =
      column.isNullable ||
      column.isAutoIncrement ||
      column.defaultValue !== null;
    return isFilledByDatabase ? null : "seed-value-null";
  }
  if (value === null) {
    return column.isNullable ? null : "seed-value-null";
  }
  return isValidJsonValue(column.type, value, enums)
    ? null
    : "seed-value-invalid";
}

function checkRowValues(
  schema: SchemaDocument,
  table: Table,
  row: SeedRow,
  rowPath: DocumentPath,
): readonly SeedIssue[] {
  const columnIssues = table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    const code =
      column === undefined
        ? null
        : findValueProblem(column, row[columnId], schema.enums);
    return code === null ? [] : [{ code, path: [...rowPath, columnId] }];
  });
  const tableColumnIds = new Set<string>(table.columnIds);
  const unknownKeyIssues = Object.keys(row)
    .filter((key) => !tableColumnIds.has(key))
    .map((key) => ({
      code: "seed-value-invalid" as const,
      path: [...rowPath, key],
    }));
  return [...columnIssues, ...unknownKeyIssues];
}

function checkUniqueKeys(
  schema: SchemaDocument,
  table: Table,
  rows: readonly SeedRow[],
  tablePath: DocumentPath,
): readonly SeedIssue[] {
  return listSeedUniqueKeys(schema, table).flatMap((columnIds) => {
    const [firstColumnId] = columnIds;
    const seenKeys = new Set<string>();
    return rows.flatMap((row, rowIndex) => {
      const key = toSeedKey(row, columnIds);
      if (key === null || firstColumnId === undefined) {
        return [];
      }
      const isDuplicate = seenKeys.has(key);
      seenKeys.add(key);
      return isDuplicate
        ? [
            {
              code: "seed-unique-violation" as const,
              path: [...tablePath, "rows", rowIndex, firstColumnId],
            },
          ]
        : [];
    });
  });
}

// The INSERT lists a column when any row sets it, so a row that omits a set
// auto-increment column gets DEFAULT: SQL Server rejects it under
// IDENTITY_INSERT, and PostgreSQL's sequence hands out values before setval
// that collide with the explicit ones.
function checkIdentityColumns(
  schema: SchemaDocument,
  table: Table,
  rows: readonly SeedRow[],
  tablePath: DocumentPath,
): readonly SeedIssue[] {
  return table.columnIds
    .filter(
      (columnId) =>
        schema.columns[columnId]?.isAutoIncrement === true &&
        rows.some((row) => row[columnId] !== undefined),
    )
    .flatMap((columnId) =>
      rows.flatMap((row, rowIndex) =>
        row[columnId] === undefined
          ? [
              {
                code: "seed-identity-partial" as const,
                path: [...tablePath, "rows", rowIndex, columnId],
              },
            ]
          : [],
      ),
    );
}

// First row index for each complete key, so a lookup is one map read.
function indexRowsByKey(
  rows: readonly SeedRow[],
  columnIds: readonly ColumnId[],
): ReadonlyMap<string, number> {
  const firstIndexes = new Map<string, number>();
  rows.forEach((row, rowIndex) => {
    const key = toSeedKey(row, columnIds);
    if (key !== null && !firstIndexes.has(key)) {
      firstIndexes.set(key, rowIndex);
    }
  });
  return firstIndexes;
}

// Inserting NULL first and setting the value by UPDATE later needs nullable
// source columns and a primary key to find the row again.
function canBeDeferred(
  schema: SchemaDocument,
  table: Table,
  relation: Relation,
): boolean {
  return (
    table.primaryKeyColumnIds.length > 0 &&
    relation.columnPairs.every(
      (pair) => schema.columns[pair.fromColumnId]?.isNullable === true,
    )
  );
}

function checkRelation(
  context: ValidationContext,
  table: Table,
  relation: Relation,
  tableIndex: number,
): readonly SeedIssue[] {
  const [firstPair] = relation.columnPairs;
  const rows = context.dataset.tables[tableIndex]?.rows ?? [];
  const targetIndex = context.positions.get(relation.toTableId);
  if (firstPair === undefined) {
    return [];
  }
  const targetRows =
    targetIndex === undefined
      ? []
      : (context.dataset.tables[targetIndex]?.rows ?? []);
  const matches = indexRowsByKey(
    targetRows,
    relation.columnPairs.map((pair) => pair.toColumnId),
  );
  const sourceColumnIds = relation.columnPairs.map((pair) => pair.fromColumnId);
  const isSelfReference = relation.toTableId === relation.fromTableId;
  const isLaterTable =
    targetIndex !== undefined &&
    targetIndex > tableIndex &&
    !canBeDeferred(context.schema, table, relation);
  return rows.flatMap((row, rowIndex): readonly SeedIssue[] => {
    const key = toSeedKey(row, sourceColumnIds);
    const matchIndex = key === null ? undefined : matches.get(key);
    const path = [
      "tables",
      tableIndex,
      "rows",
      rowIndex,
      firstPair.fromColumnId,
    ];
    if (key === null) {
      return [];
    }
    if (matchIndex === undefined) {
      return [{ code: "seed-foreign-key-missing", path }];
    }
    const isOrderInvalid = isSelfReference
      ? matchIndex > rowIndex
      : isLaterTable;
    return isOrderInvalid ? [{ code: "seed-order-invalid", path }] : [];
  });
}

function checkTableEntry(
  context: ValidationContext,
  tableIndex: number,
): readonly SeedIssue[] {
  const entry = context.dataset.tables[tableIndex];
  const table =
    entry === undefined ? undefined : context.schema.tables[entry.tableId];
  const tablePath = ["tables", tableIndex];
  if (entry === undefined || table === undefined) {
    return [{ code: "seed-value-invalid", path: [...tablePath, "tableId"] }];
  }
  // A repeated table is reported once; its rows are not checked again.
  if (context.positions.get(entry.tableId) !== tableIndex) {
    return [{ code: "seed-order-invalid", path: [...tablePath, "tableId"] }];
  }
  return [
    ...entry.rows.flatMap((row, rowIndex) =>
      checkRowValues(context.schema, table, row, [
        ...tablePath,
        "rows",
        rowIndex,
      ]),
    ),
    ...checkIdentityColumns(context.schema, table, entry.rows, tablePath),
    ...checkUniqueKeys(context.schema, table, entry.rows, tablePath),
    ...sortRelations(context.schema)
      .filter((relation) => relation.fromTableId === table.id)
      .flatMap((relation) =>
        checkRelation(context, table, relation, tableIndex),
      ),
  ];
}

function dedupeIssues(issues: readonly SeedIssue[]): readonly SeedIssue[] {
  const unique = new Map(
    issues.map((issue) => [JSON.stringify([issue.code, issue.path]), issue]),
  );
  return [...unique.values()];
}

/**
 * Checks any well-typed dataset against the schema (spec CG-08): types,
 * nullability, all-or-none auto-increment values, unique keys, foreign keys
 * and load order. Never throws.
 */
export function validateSeedDataset(
  schema: SchemaDocument,
  dataset: SeedDataset,
): readonly SeedIssue[] {
  const context: ValidationContext = {
    schema,
    dataset,
    positions: findFirstPositions(schema, dataset),
  };
  const issues = dataset.tables.flatMap((_entry, tableIndex) =>
    checkTableEntry(context, tableIndex),
  );
  return sortByPathThenCode(dedupeIssues(issues));
}

/** Relations whose target table is loaded after their source table, in `sortRelations` order. */
export function findDeferredSeedRelations(
  schema: SchemaDocument,
  dataset: SeedDataset,
): readonly RelationId[] {
  const positions = findFirstPositions(schema, dataset);
  return sortRelations(schema)
    .filter((relation) => {
      const fromIndex = positions.get(relation.fromTableId);
      const toIndex = positions.get(relation.toTableId);
      return (
        relation.fromTableId !== relation.toTableId &&
        fromIndex !== undefined &&
        toIndex !== undefined &&
        toIndex > fromIndex
      );
    })
    .map((relation) => relation.id);
}
