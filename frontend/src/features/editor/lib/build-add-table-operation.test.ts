import {
  applyOperation,
  createEmptySchema,
  validateSchema,
} from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeTable,
  unwrapOk,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import {
  buildAddTableOperation,
  findFreeTablePosition,
  NEW_TABLE_OFFSET,
} from "./build-add-table-operation";

const ORIGIN = { x: 0, y: 0 } as const;

// Mirrors the module's own attempt limit, which stays private.
const MAX_POSITION_ATTEMPTS = 50;
const STACKED_TABLE_COUNT = MAX_POSITION_ATTEMPTS + 10;

// One table on every offset step the search can reach, so the search runs out
// of attempts instead of finding a free spot.
const stackedDocument = buildSchema({
  tables: Array.from({ length: STACKED_TABLE_COUNT }, (_unused, index) =>
    makeTable({
      id: `tbl_${String(index + 1)}`,
      position: { x: index * NEW_TABLE_OFFSET, y: index * NEW_TABLE_OFFSET },
    }),
  ),
});

describe("buildAddTableOperation", () => {
  it("builds one batch with a table, an id column and a primary key", () => {
    const document = createEmptySchema("test");

    const result = buildAddTableOperation(document, {
      position: { x: 10, y: 20 },
      generateId: createCounterIdGenerator(),
    });

    expect(result).toStrictEqual({
      tableId: "tbl_1",
      primaryKeyColumnId: "col_2",
      operation: {
        type: "batch",
        operations: [
          {
            type: "addTable",
            table: {
              id: "tbl_1",
              name: "table_1",
              comment: "",
              position: { x: 10, y: 20 },
              subjectAreaId: null,
            },
          },
          {
            type: "addColumn",
            insertAt: 0,
            column: {
              id: "col_2",
              tableId: "tbl_1",
              name: "id",
              type: { kind: "bigint" },
              isNullable: false,
              defaultValue: null,
              isUnique: false,
              isAutoIncrement: true,
              comment: "",
            },
          },
          { type: "setPrimaryKey", tableId: "tbl_1", columnIds: ["col_2"] },
        ],
      },
    });
  });

  it("names the new table with the first free numbered name", () => {
    const document = buildSchema({
      tables: [
        makeTable({ id: "tbl_9", name: "table_1" }),
        makeTable({ id: "tbl_8", name: "TABLE_2" }),
      ],
    });

    const { operation } = buildAddTableOperation(document, {
      position: ORIGIN,
      generateId: createCounterIdGenerator(),
    });
    const applied = unwrapOk(applyOperation(document, operation));

    expect(applied.schema.tables.tbl_1?.name).toBe("table_3");
  });

  it("offsets the position when a table already sits there", () => {
    const document = buildSchema({
      tables: [makeTable({ id: "tbl_9", position: { x: 100, y: 100 } })],
    });

    const position = findFreeTablePosition(document, { x: 100, y: 100 });

    expect(position).toStrictEqual({
      x: 100 + NEW_TABLE_OFFSET,
      y: 100 + NEW_TABLE_OFFSET,
    });
  });

  it("gives up offsetting once the attempt limit is reached", () => {
    const position = findFreeTablePosition(stackedDocument, ORIGIN);

    expect(position).toStrictEqual({
      x: MAX_POSITION_ATTEMPTS * NEW_TABLE_OFFSET,
      y: MAX_POSITION_ATTEMPTS * NEW_TABLE_OFFSET,
    });
  });

  it("applies without introducing any issue", () => {
    const document = createEmptySchema("test");

    const { operation } = buildAddTableOperation(document, {
      position: ORIGIN,
      generateId: createCounterIdGenerator(),
    });
    const applied = unwrapOk(applyOperation(document, operation));

    expect(validateSchema(applied.schema)).toStrictEqual([]);
  });

  it("undoes the whole batch in one step", () => {
    const document = createEmptySchema("test");

    const { operation } = buildAddTableOperation(document, {
      position: ORIGIN,
      generateId: createCounterIdGenerator(),
    });
    const applied = unwrapOk(applyOperation(document, operation));
    const undone = unwrapOk(applyOperation(applied.schema, applied.inverse));

    expect(undone.schema).toStrictEqual(document);
  });
});
