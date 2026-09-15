import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import type { Operation, OperationOfType } from "../operations/operation.js";
import { buildSchema, makeColumn, makeTable } from "../testing/factories.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { createEmptyHistory, recordEntry, redo, undo } from "./history.js";
import type { History, HistoryEntry, HistoryStep } from "./history.js";

const HISTORY_LIMIT = 100;

const USERS_TABLE = makeTable({ id: "tbl_users" });

const ADD_ORDERS_TABLE: OperationOfType<"addTable"> = {
  type: "addTable",
  table: {
    id: "tbl_orders",
    name: "orders",
    comment: "",
    position: { x: 0, y: 0 },
    subjectAreaId: null,
  },
};

const ADD_ORDERS_ID_COLUMN: OperationOfType<"addColumn"> = {
  type: "addColumn",
  column: makeColumn({ id: "col_orders_id", tableId: "tbl_orders" }),
  insertAt: 0,
};

const RENAME_TO_STORE: OperationOfType<"renameSchema"> = {
  type: "renameSchema",
  name: "store",
};

function renameEntry(fromName: string, toName: string): HistoryEntry {
  return {
    operation: { type: "renameSchema", name: toName },
    inverse: { type: "renameSchema", name: fromName },
  };
}

const FIRST_ENTRY = renameEntry("a", "b");
const SECOND_ENTRY = renameEntry("b", "c");
const THIRD_ENTRY = renameEntry("c", "d");
const FOURTH_ENTRY = renameEntry("d", "e");

function buildShopSchema(): SchemaDocument {
  return buildSchema({ name: "shop", tables: [USERS_TABLE] });
}

function startStep(): HistoryStep {
  return { history: createEmptyHistory(), schema: buildShopSchema() };
}

function applyAndRecord(step: HistoryStep, operation: Operation): HistoryStep {
  const applied = unwrapOk(applyOperation(step.schema, operation));
  return {
    history: recordEntry(
      step.history,
      { operation, inverse: applied.inverse },
      HISTORY_LIMIT,
    ),
    schema: applied.schema,
  };
}

function requireStep(step: HistoryStep | null): HistoryStep {
  if (step === null) {
    throw new Error("Expected a history step but got null");
  }
  return step;
}

describe("createEmptyHistory", () => {
  it("creates a history with no past and no future", () => {
    expect(createEmptyHistory()).toStrictEqual({ past: [], future: [] });
  });
});

describe("recordEntry", () => {
  it("appends the recorded entry to past", () => {
    const history: History = { past: [FIRST_ENTRY], future: [] };

    expect(recordEntry(history, SECOND_ENTRY, HISTORY_LIMIT)).toStrictEqual({
      past: [FIRST_ENTRY, SECOND_ENTRY],
      future: [],
    });
  });

  it("clears future when an entry is recorded", () => {
    const history: History = { past: [FIRST_ENTRY], future: [THIRD_ENTRY] };

    expect(recordEntry(history, SECOND_ENTRY, HISTORY_LIMIT)).toStrictEqual({
      past: [FIRST_ENTRY, SECOND_ENTRY],
      future: [],
    });
  });

  it("drops the oldest entries beyond the limit", () => {
    const history: History = {
      past: [FIRST_ENTRY, SECOND_ENTRY, THIRD_ENTRY],
      future: [],
    };

    expect(recordEntry(history, FOURTH_ENTRY, 2)).toStrictEqual({
      past: [THIRD_ENTRY, FOURTH_ENTRY],
      future: [],
    });
  });

  it("does not change the given history when an entry is recorded", () => {
    const history: History = { past: [FIRST_ENTRY], future: [SECOND_ENTRY] };

    recordEntry(history, THIRD_ENTRY, HISTORY_LIMIT);

    expect(history).toStrictEqual({
      past: [FIRST_ENTRY],
      future: [SECOND_ENTRY],
    });
  });

  it("throws when the limit is less than 1", () => {
    expect(() => recordEntry(createEmptyHistory(), FIRST_ENTRY, 0)).toThrow(
      /limit/,
    );
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "throws when the limit is %s instead of an integer of at least 1",
    (limit) => {
      expect(() =>
        recordEntry(createEmptyHistory(), FIRST_ENTRY, limit),
      ).toThrow(/limit/);
    },
  );
});

describe("undo", () => {
  it("returns null when there is nothing to undo", () => {
    const history: History = { past: [], future: [FIRST_ENTRY] };

    expect(undo(history, buildShopSchema())).toBeNull();
  });

  it("applies the inverse and moves the entry to future on undo", () => {
    const schema = buildShopSchema();
    const applied = unwrapOk(applyOperation(schema, ADD_ORDERS_TABLE));
    const entry: HistoryEntry = {
      operation: ADD_ORDERS_TABLE,
      inverse: applied.inverse,
    };
    const history: History = {
      past: [FIRST_ENTRY, entry],
      future: [SECOND_ENTRY],
    };

    expect(undo(history, applied.schema)).toStrictEqual({
      history: { past: [FIRST_ENTRY], future: [SECOND_ENTRY, entry] },
      schema,
    });
  });

  it("undoes two entries in reverse order", () => {
    const start = startStep();
    const afterTable = applyAndRecord(start, ADD_ORDERS_TABLE);
    const afterColumn = applyAndRecord(afterTable, ADD_ORDERS_ID_COLUMN);

    const firstUndo = requireStep(
      undo(afterColumn.history, afterColumn.schema),
    );
    const secondUndo = requireStep(undo(firstUndo.history, firstUndo.schema));

    expect({ first: firstUndo.schema, second: secondUndo }).toStrictEqual({
      first: afterTable.schema,
      second: {
        history: { past: [], future: afterColumn.history.past.toReversed() },
        schema: start.schema,
      },
    });
  });

  it("throws when the inverse cannot be applied", () => {
    const entry: HistoryEntry = {
      operation: ADD_ORDERS_TABLE,
      inverse: { type: "removeTable", tableId: "tbl_missing" },
    };
    const history: History = { past: [entry], future: [] };

    expect(() => undo(history, buildShopSchema())).toThrow(
      /table-not-found.*\["tableId"\]/,
    );
  });
});

describe("redo", () => {
  it("returns null when there is nothing to redo", () => {
    const history: History = { past: [FIRST_ENTRY], future: [] };

    expect(redo(history, buildShopSchema())).toBeNull();
  });

  it("applies the operation and stores its new inverse on redo", () => {
    const staleEntry: HistoryEntry = {
      operation: RENAME_TO_STORE,
      inverse: { type: "renameSchema", name: "outdated" },
    };
    const history: History = {
      past: [FIRST_ENTRY],
      future: [SECOND_ENTRY, staleEntry],
    };

    expect(redo(history, buildShopSchema())).toStrictEqual({
      history: {
        past: [
          FIRST_ENTRY,
          {
            operation: RENAME_TO_STORE,
            inverse: { type: "renameSchema", name: "shop" },
          },
        ],
        future: [SECOND_ENTRY],
      },
      schema: buildSchema({ name: "store", tables: [USERS_TABLE] }),
    });
  });

  it("returns the schemas before and after the operation across undo then redo", () => {
    const start = startStep();
    const afterTable = applyAndRecord(start, ADD_ORDERS_TABLE);

    const undone = requireStep(undo(afterTable.history, afterTable.schema));
    const redone = requireStep(redo(undone.history, undone.schema));

    expect({ undone: undone.schema, redone: redone.schema }).toStrictEqual({
      undone: start.schema,
      redone: afterTable.schema,
    });
  });

  it("throws when the operation cannot be applied on redo", () => {
    const entry: HistoryEntry = {
      operation: { type: "removeColumn", columnId: "col_missing" },
      inverse: RENAME_TO_STORE,
    };
    const history: History = { past: [], future: [entry] };

    expect(() => redo(history, buildShopSchema())).toThrow(
      /column-not-found.*\["columnId"\]/,
    );
  });
});
