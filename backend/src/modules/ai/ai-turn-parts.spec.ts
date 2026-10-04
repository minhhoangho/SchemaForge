import { parseOperation } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeTable,
  unwrapOk,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { createAiTurnState } from "./ai-tools.js";
import { buildAiTurnParts } from "./ai-turn-parts.js";

const SCHEMA = buildSchema({
  name: "shop",
  tables: [
    makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
  ],
  columns: [
    makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
  ],
});

function stateWithOperation(operation: unknown) {
  return {
    ...createAiTurnState(SCHEMA),
    operations: [unwrapOk(parseOperation(operation))],
  };
}

describe("buildAiTurnParts", () => {
  it("rejects a turn whose batch core no longer applies", () => {
    const state = stateWithOperation({
      type: "removeTable",
      tableId: "tbl_missing",
    });

    expect(buildAiTurnParts(state, false)).toStrictEqual({
      isOk: false,
      error: "operation-rejected",
    });
  });

  it("rejects a turn whose batch introduces an issue", () => {
    const state = stateWithOperation({
      type: "addTable",
      table: {
        id: "tbl_tags",
        name: "tags",
        comment: "",
        position: { x: 400, y: 0 },
        subjectAreaId: null,
      },
    });

    expect(buildAiTurnParts(state, false)).toStrictEqual({
      isOk: false,
      error: "issues-introduced",
    });
  });

  it("returns no parts for a text-only turn", () => {
    expect(buildAiTurnParts(createAiTurnState(SCHEMA), false)).toStrictEqual({
      isOk: true,
      value: [],
    });
  });
});
