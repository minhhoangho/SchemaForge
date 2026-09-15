import type { Column } from "../model/column.js";
import type { ColumnId } from "../model/ids.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import {
  findIndexesUsingColumns,
  findRelationsUsingColumns,
} from "./dependents.js";
import { withEntry, withoutIds } from "./id-map.js";
import type {
  BatchOperation,
  Operation,
  OperationOfType,
} from "./operation.js";

const NOT_FOUND_INDEX = -1;

export type ColumnPlacement = {
  readonly table: Table;
  readonly columnIndex: number;
};

// Everything removeColumn deletes, captured from the schema before the change
// so the inverse can re-add each element whole.
type RemovedColumn = ColumnPlacement & {
  readonly column: Column;
  readonly indexes: readonly Index[];
  readonly relations: readonly Relation[];
};

/**
 * Returns the table that owns `column` and the column's position in it.
 * A parsed schema always lists a column in its own table, so a miss means the
 * document skipped parsing: a programmer error, not an expected failure.
 */
export function findColumnPlacement(
  schema: SchemaDocument,
  column: Column,
): ColumnPlacement {
  const table = schema.tables[column.tableId];
  const columnIndex = table?.columnIds.indexOf(column.id) ?? NOT_FOUND_INDEX;
  if (table === undefined || columnIndex === NOT_FOUND_INDEX) {
    throw new Error(
      `Column ${column.id} is not listed in its table ${column.tableId}`,
    );
  }
  return { table, columnIndex };
}

function withoutColumn(table: Table, columnId: ColumnId): Table {
  const isInPrimaryKey = table.primaryKeyColumnIds.includes(columnId);
  return {
    ...table,
    columnIds: table.columnIds.filter((id) => id !== columnId),
    primaryKeyColumnIds: isInPrimaryKey
      ? table.primaryKeyColumnIds.filter((id) => id !== columnId)
      : table.primaryKeyColumnIds,
  };
}

// Order matters: the column must exist before the primary key, indexes and
// relations that reference it are restored.
function buildInverse(removed: RemovedColumn): BatchOperation {
  const { column, table, columnIndex, indexes, relations } = removed;
  const primaryKeySteps: readonly Operation[] =
    table.primaryKeyColumnIds.includes(column.id)
      ? [
          {
            type: "setPrimaryKey",
            tableId: table.id,
            columnIds: table.primaryKeyColumnIds,
          },
        ]
      : [];
  return {
    type: "batch",
    operations: [
      { type: "addColumn", column, insertAt: columnIndex },
      ...primaryKeySteps,
      ...indexes.map((index): Operation => ({ type: "addIndex", index })),
      ...relations.map((relation): Operation => ({
        type: "addRelation",
        relation,
      })),
    ],
  };
}

// Maps with nothing to remove keep their reference (structural sharing).
function removeDependents(
  schema: SchemaDocument,
  removed: RemovedColumn,
): Pick<SchemaDocument, "indexes" | "relations"> {
  const { indexes, relations } = removed;
  return {
    indexes:
      indexes.length === 0
        ? schema.indexes
        : withoutIds(
            schema.indexes,
            indexes.map((index) => index.id),
          ),
    relations:
      relations.length === 0
        ? schema.relations
        : withoutIds(
            schema.relations,
            relations.map((relation) => relation.id),
          ),
  };
}

/**
 * Removes a column, drops it from its table's column list and primary key, and
 * deletes every index and relation that uses it (spec section 9).
 */
export function removeColumn(
  schema: SchemaDocument,
  operation: OperationOfType<"removeColumn">,
): ApplyResult {
  const column = schema.columns[operation.columnId];
  if (column === undefined) {
    return rejectOperation("column-not-found", ["columnId"]);
  }
  const columnIdSet = new Set([column.id]);
  const removed: RemovedColumn = {
    ...findColumnPlacement(schema, column),
    column,
    indexes: findIndexesUsingColumns(schema, columnIdSet),
    relations: findRelationsUsingColumns(schema, columnIdSet),
  };
  const nextSchema: SchemaDocument = {
    ...schema,
    ...removeDependents(schema, removed),
    tables: withEntry(
      schema.tables,
      removed.table.id,
      withoutColumn(removed.table, column.id),
    ),
    columns: withoutIds(schema.columns, [column.id]),
  };
  return acceptOperation(nextSchema, buildInverse(removed));
}
