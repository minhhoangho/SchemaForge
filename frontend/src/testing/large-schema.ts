import type {
  Column,
  ColumnId,
  ColumnType,
  Relation,
  SchemaDocument,
  Table,
  TableId,
} from "@schemaforge/core";
import {
  createColumnId,
  createRelationId,
  createTableId,
} from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";

export type LargeSchemaInput = {
  readonly tables: number;
  readonly columnsPerTable: number;
  readonly relations: number;
};

/** The fixture of spec section 13: the size the editor must stay fast at. */
export const STANDARD_LARGE_SCHEMA: LargeSchemaInput = {
  tables: 100,
  columnsPerTable: 15,
  relations: 150,
};

const GRID_COLUMNS = 10;
const GRID_STEP_X = 320;
const GRID_STEP_Y = 220;
const KEY_SLOT = 0;
const KEY_TYPE: ColumnType = { kind: "bigint" };
const PLAIN_TYPE: ColumnType = { kind: "varchar", length: 255 };

type TableIds = {
  readonly tableId: TableId;
  readonly columnIds: readonly ColumnId[];
};

function pick<Value>(values: readonly Value[], index: number): Value {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(
      `makeLargeSchema: no element at index ${String(index)}.`,
    );
  }
  return value;
}

function assertValidInput({
  tables,
  columnsPerTable,
  relations,
}: LargeSchemaInput): void {
  if (
    !Number.isInteger(tables) ||
    !Number.isInteger(columnsPerTable) ||
    !Number.isInteger(relations) ||
    tables < 0 ||
    columnsPerTable < 1 ||
    relations < 0 ||
    (relations > 0 && tables === 0)
  ) {
    throw new RangeError("makeLargeSchema: invalid input.");
  }
  // Relation i uses foreign key slot 1 + floor(i / tables) of its table.
  const slotsNeeded = relations === 0 ? 0 : Math.ceil(relations / tables);
  if (1 + slotsNeeded > columnsPerTable) {
    throw new RangeError(
      "makeLargeSchema: too few columns per table for the foreign keys.",
    );
  }
}

// Relation i goes from table i % tables to table (i + 1) % tables, so table t
// holds a foreign key in slot s (s >= 1) when relation t + (s - 1) * tables
// exists.
function isForeignKeySlot(
  input: LargeSchemaInput,
  tableIndex: number,
  slot: number,
): boolean {
  return (
    slot !== KEY_SLOT &&
    tableIndex + (slot - 1) * input.tables < input.relations
  );
}

function buildColumns(
  input: LargeSchemaInput,
  ids: readonly TableIds[],
): readonly Column[] {
  return ids.flatMap(({ tableId, columnIds }, tableIndex) =>
    columnIds.map((columnId, slot) =>
      makeColumn({
        id: columnId,
        tableId,
        name: slot === KEY_SLOT ? "id" : `column_${String(slot + 1)}`,
        type:
          slot === KEY_SLOT || isForeignKeySlot(input, tableIndex, slot)
            ? KEY_TYPE
            : PLAIN_TYPE,
      }),
    ),
  );
}

/**
 * Builds a deterministic schema of the requested size with no validation
 * issue: every table has a bigint key `id` first, and relation i links a
 * bigint foreign key of table i % tables to the key of table (i + 1) % tables.
 * Tables sit on a 10-column grid.
 */
export function makeLargeSchema(input: LargeSchemaInput): SchemaDocument {
  assertValidInput(input);
  const generateId = createCounterIdGenerator();
  const ids: readonly TableIds[] = Array.from({ length: input.tables }, () => ({
    tableId: createTableId(generateId),
    columnIds: Array.from({ length: input.columnsPerTable }, () =>
      createColumnId(generateId),
    ),
  }));

  const tables: readonly Table[] = ids.map(({ tableId, columnIds }, index) =>
    makeTable({
      id: tableId,
      name: `table_${String(index + 1)}`,
      position: {
        x: (index % GRID_COLUMNS) * GRID_STEP_X,
        y: Math.floor(index / GRID_COLUMNS) * GRID_STEP_Y,
      },
      primaryKeyColumnIds: [pick(columnIds, KEY_SLOT)],
    }),
  );

  const relations: readonly Relation[] = Array.from(
    { length: input.relations },
    (_, index) => {
      const from = pick(ids, index % input.tables);
      const to = pick(ids, (index + 1) % input.tables);
      const slot = 1 + Math.floor(index / input.tables);
      return makeRelation({
        id: createRelationId(generateId),
        fromTableId: from.tableId,
        toTableId: to.tableId,
        columnPairs: [
          {
            fromColumnId: pick(from.columnIds, slot),
            toColumnId: pick(to.columnIds, KEY_SLOT),
          },
        ],
      });
    },
  );

  return buildSchema({
    name: "large",
    tables,
    columns: buildColumns(input, ids),
    relations,
  });
}
