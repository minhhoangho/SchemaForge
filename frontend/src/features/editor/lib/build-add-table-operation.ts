import { createColumnId, createTableId } from "@schemaforge/core";
import type {
  ColumnId,
  GenerateId,
  Operation,
  Position,
  SchemaDocument,
  TableId,
} from "@schemaforge/core";

import { suggestTableName } from "./name-suggestions";

export const NEW_TABLE_OFFSET = 24;

const MAX_POSITION_ATTEMPTS = 50;
const PRIMARY_KEY_COLUMN_NAME = "id";
const PRIMARY_KEY_COLUMN_INDEX = 0;

export type AddTableResult = {
  readonly operation: Operation;
  readonly tableId: TableId;
  readonly primaryKeyColumnId: ColumnId;
};

function isPositionTaken(
  document: SchemaDocument,
  position: Position,
): boolean {
  return Object.values(document.tables).some(
    (table) =>
      table.position.x === position.x && table.position.y === position.y,
  );
}

/**
 * Steps down and right by `NEW_TABLE_OFFSET` while a table sits on the exact
 * spot, so a new table never hides an existing one. Gives up after
 * `MAX_POSITION_ATTEMPTS` steps and returns the last position it reached.
 */
export function findFreeTablePosition(
  document: SchemaDocument,
  position: Position,
): Position {
  let candidate = position;
  for (let attempt = 0; attempt < MAX_POSITION_ATTEMPTS; attempt += 1) {
    if (!isPositionTaken(document, candidate)) {
      return candidate;
    }
    candidate = {
      x: candidate.x + NEW_TABLE_OFFSET,
      y: candidate.y + NEW_TABLE_OFFSET,
    };
  }
  return candidate;
}

/**
 * Builds the single batch behind "add table": the table itself, its `id`
 * primary key column, and the primary key. One dispatch means one history
 * entry, so one undo removes all three steps.
 */
export function buildAddTableOperation(
  document: SchemaDocument,
  input: {
    readonly position: Position;
    readonly generateId: GenerateId;
  },
): AddTableResult {
  const tableId = createTableId(input.generateId);
  const primaryKeyColumnId = createColumnId(input.generateId);

  const operation: Operation = {
    type: "batch",
    operations: [
      {
        type: "addTable",
        table: {
          id: tableId,
          name: suggestTableName(document),
          comment: "",
          position: findFreeTablePosition(document, input.position),
          subjectAreaId: null,
        },
      },
      {
        type: "addColumn",
        insertAt: PRIMARY_KEY_COLUMN_INDEX,
        column: {
          id: primaryKeyColumnId,
          tableId,
          name: PRIMARY_KEY_COLUMN_NAME,
          type: { kind: "bigint" },
          isNullable: false,
          defaultValue: null,
          isUnique: false,
          isAutoIncrement: true,
          comment: "",
        },
      },
      { type: "setPrimaryKey", tableId, columnIds: [primaryKeyColumnId] },
    ],
  };

  return { operation, tableId, primaryKeyColumnId };
}
