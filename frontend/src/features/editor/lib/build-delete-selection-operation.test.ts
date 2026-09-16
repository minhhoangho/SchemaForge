import { applyOperation } from "@schemaforge/core";
import type { Operation } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
  unwrapOk,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { buildDeleteSelectionOperation } from "./build-delete-selection-operation";
import { EMPTY_SELECTION } from "./selection";

const document = buildSchema({
  tables: [makeTable({ id: "tbl_1" }), makeTable({ id: "tbl_2" })],
  columns: [
    makeColumn({ id: "col_1", tableId: "tbl_1" }),
    makeColumn({ id: "col_2", tableId: "tbl_2" }),
  ],
  relations: [
    makeRelation({
      id: "rel_1",
      fromTableId: "tbl_1",
      toTableId: "tbl_2",
      columnPairs: [{ fromColumnId: "col_1", toColumnId: "col_2" }],
    }),
  ],
});

function requireOperation(operation: Operation | null): Operation {
  if (operation === null) {
    throw new Error("Expected an operation but got null");
  }
  return operation;
}

describe("buildDeleteSelectionOperation", () => {
  it("returns null for an empty selection", () => {
    expect(buildDeleteSelectionOperation(EMPTY_SELECTION)).toBeNull();
  });

  it("removes relations before tables", () => {
    const operation = buildDeleteSelectionOperation({
      tableIds: ["tbl_1", "tbl_2"],
      relationIds: ["rel_1"],
    });

    expect(operation).toStrictEqual({
      type: "batch",
      operations: [
        { type: "removeRelation", relationId: "rel_1" },
        { type: "removeTable", tableId: "tbl_1" },
        { type: "removeTable", tableId: "tbl_2" },
      ],
    });
  });

  it("applies when a table and one of its relations are both selected", () => {
    const operation = buildDeleteSelectionOperation({
      tableIds: ["tbl_1"],
      relationIds: ["rel_1"],
    });
    const applied = unwrapOk(
      applyOperation(document, requireOperation(operation)),
    );

    expect(Object.keys(applied.schema.tables)).toStrictEqual(["tbl_2"]);
    expect(applied.schema.relations).toStrictEqual({});
  });

  it("restores everything with a single undo", () => {
    const operation = buildDeleteSelectionOperation({
      tableIds: ["tbl_1", "tbl_2"],
      relationIds: ["rel_1"],
    });
    const applied = unwrapOk(
      applyOperation(document, requireOperation(operation)),
    );
    const undone = unwrapOk(applyOperation(applied.schema, applied.inverse));

    expect(undone.schema).toStrictEqual(document);
  });

  it("keeps relations that are not selected", () => {
    const operation = buildDeleteSelectionOperation({
      tableIds: ["tbl_1"],
      relationIds: [],
    });

    expect(operation).toStrictEqual({
      type: "batch",
      operations: [{ type: "removeTable", tableId: "tbl_1" }],
    });
  });
});
