import type { Column } from "../model/column.js";
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
import { withoutIds } from "./id-map.js";
import type {
  BatchOperation,
  Operation,
  OperationOfType,
} from "./operation.js";

type TableDependents = {
  // In columnIds order.
  readonly columns: readonly Column[];
  // Both sorted by id, so the inverse does not depend on map key order.
  readonly indexes: readonly Index[];
  readonly relations: readonly Relation[];
};

// Structural invariants guarantee every id in columnIds exists. Skipping a
// missing one (instead of asserting) keeps insertAt consistent with the list
// the inverse actually re-adds.
function findTableColumns(
  schema: SchemaDocument,
  table: Table,
): readonly Column[] {
  return table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [column];
  });
}

// Every index has at least one column and every relation at least one pair,
// all owned by their tables, so matching on the table's columns finds exactly
// the indexes of the table and the relations with the table on either side.
function findTableDependents(
  schema: SchemaDocument,
  table: Table,
): TableDependents {
  const columnIds = new Set(table.columnIds);
  return {
    columns: findTableColumns(schema, table),
    indexes: findIndexesUsingColumns(schema, columnIds),
    relations: findRelationsUsingColumns(schema, columnIds),
  };
}

// Maps that lose no entry keep their reference (structural sharing).
function withoutTableAndDependents(
  schema: SchemaDocument,
  table: Table,
  dependents: TableDependents,
): SchemaDocument {
  const { indexes, relations } = dependents;
  return {
    ...schema,
    tables: withoutIds(schema.tables, [table.id]),
    columns:
      table.columnIds.length === 0
        ? schema.columns
        : withoutIds(schema.columns, table.columnIds),
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

// Step order follows the plan ("Thứ tự các bước trong nghịch đảo của
// removeTable"): every step only references elements that earlier steps
// re-added, and each addColumn appends, so insertAt is always in range.
function buildRemoveTableInverse(
  table: Table,
  dependents: TableDependents,
): BatchOperation {
  const operations: readonly Operation[] = [
    {
      type: "addTable",
      table: {
        id: table.id,
        name: table.name,
        comment: table.comment,
        position: table.position,
        subjectAreaId: table.subjectAreaId,
      },
    },
    ...dependents.columns.map(
      (column, position): OperationOfType<"addColumn"> => ({
        type: "addColumn",
        column,
        insertAt: position,
      }),
    ),
    {
      type: "setPrimaryKey",
      tableId: table.id,
      columnIds: table.primaryKeyColumnIds,
    },
    ...dependents.indexes.map((index): OperationOfType<"addIndex"> => ({
      type: "addIndex",
      index,
    })),
    ...dependents.relations.map((relation): OperationOfType<"addRelation"> => ({
      type: "addRelation",
      relation,
    })),
  ];
  return { type: "batch", operations };
}

/**
 * Removes a table together with its columns, its indexes and every relation
 * that has the table on either side.
 */
export function removeTable(
  schema: SchemaDocument,
  operation: OperationOfType<"removeTable">,
): ApplyResult {
  const table = schema.tables[operation.tableId];
  if (table === undefined) {
    return rejectOperation("table-not-found", ["tableId"]);
  }
  const dependents = findTableDependents(schema, table);
  return acceptOperation(
    withoutTableAndDependents(schema, table, dependents),
    buildRemoveTableInverse(table, dependents),
  );
}
