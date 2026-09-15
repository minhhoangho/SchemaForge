import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import type { Operation, OperationOfType } from "../operations/operation.js";
import { buildSchema, makeColumn } from "../testing/factories.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { createEmptyHistory, recordEntry, redo, undo } from "./history.js";
import type { History, HistoryEntry, HistoryStep } from "./history.js";
import { mergeLastEntry } from "./merge-last-entry.js";

const HISTORY_LIMIT = 100;

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

function renameTo(name: string): OperationOfType<"renameSchema"> {
  return { type: "renameSchema", name };
}

function renameEntry(fromName: string, toName: string): HistoryEntry {
  return { operation: renameTo(toName), inverse: renameTo(fromName) };
}

const FIRST_ENTRY = renameEntry("a", "b");
const SECOND_ENTRY = renameEntry("b", "c");
const THIRD_ENTRY = renameEntry("c", "d");
const FOURTH_ENTRY = renameEntry("d", "e");

function buildShopSchema(): SchemaDocument {
  return buildSchema({ name: "shop" });
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

function applyAndMerge(step: HistoryStep, operation: Operation): HistoryStep {
  const applied = unwrapOk(applyOperation(step.schema, operation));
  return {
    history: mergeLastEntry(step.history, {
      operation,
      inverse: applied.inverse,
    }),
    schema: applied.schema,
  };
}

// Records adding a table, then merges adding a column to it, so undoing the
// merged entry only works when the column is removed before its table.
function buildMergedTableAndColumnStep(start: HistoryStep): HistoryStep {
  return applyAndMerge(
    applyAndRecord(start, ADD_ORDERS_TABLE),
    ADD_ORDERS_ID_COLUMN,
  );
}

function startStep(): HistoryStep {
  return { history: createEmptyHistory(), schema: buildShopSchema() };
}

function requireStep(step: HistoryStep | null): HistoryStep {
  if (step === null) {
    throw new Error("Expected a history step but got null");
  }
  return step;
}

describe("mergeLastEntry", () => {
  it("records the entry when past is empty", () => {
    const history: History = { past: [], future: [SECOND_ENTRY] };

    expect(mergeLastEntry(history, FIRST_ENTRY)).toStrictEqual({
      past: [FIRST_ENTRY],
      future: [],
    });
  });

  it("replaces the last entry with a merged entry", () => {
    const history: History = { past: [SECOND_ENTRY], future: [] };

    expect(mergeLastEntry(history, THIRD_ENTRY)).toStrictEqual({
      past: [
        {
          operation: {
            type: "batch",
            operations: [SECOND_ENTRY.operation, THIRD_ENTRY.operation],
          },
          inverse: {
            type: "batch",
            operations: [THIRD_ENTRY.inverse, SECOND_ENTRY.inverse],
          },
        },
      ],
      future: [],
    });
  });

  it("clears future when merging", () => {
    const history: History = { past: [SECOND_ENTRY], future: [FOURTH_ENTRY] };

    expect(mergeLastEntry(history, THIRD_ENTRY).future).toStrictEqual([]);
  });

  it("undoes both merged changes in one step", () => {
    const start = startStep();
    const merged = buildMergedTableAndColumnStep(start);

    const undone = requireStep(undo(merged.history, merged.schema));

    expect(undone).toStrictEqual({
      history: { past: [], future: merged.history.past },
      schema: start.schema,
    });
  });

  it("redoes both merged changes in one step", () => {
    const merged = buildMergedTableAndColumnStep(startStep());
    const undone = requireStep(undo(merged.history, merged.schema));

    const redone = requireStep(redo(undone.history, undone.schema));

    expect({
      future: redone.history.future,
      schema: redone.schema,
    }).toStrictEqual({ future: [], schema: merged.schema });
  });

  it("keeps a flat batch after merging three entries", () => {
    const history: History = { past: [FIRST_ENTRY], future: [] };

    const merged = mergeLastEntry(
      mergeLastEntry(history, SECOND_ENTRY),
      THIRD_ENTRY,
    );

    expect(merged.past).toStrictEqual([
      {
        operation: {
          type: "batch",
          operations: [
            FIRST_ENTRY.operation,
            SECOND_ENTRY.operation,
            THIRD_ENTRY.operation,
          ],
        },
        inverse: {
          type: "batch",
          operations: [
            THIRD_ENTRY.inverse,
            SECOND_ENTRY.inverse,
            FIRST_ENTRY.inverse,
          ],
        },
      },
    ]);
  });

  it("keeps entries before the last one unchanged", () => {
    const history: History = {
      past: [FIRST_ENTRY, SECOND_ENTRY, THIRD_ENTRY],
      future: [],
    };

    const merged = mergeLastEntry(history, FOURTH_ENTRY);

    expect(merged.past.slice(0, -1)).toStrictEqual([FIRST_ENTRY, SECOND_ENTRY]);
  });

  it("spreads the steps of a batch entry into the merged entry", () => {
    const history: History = { past: [SECOND_ENTRY], future: [] };
    const batchEntry: HistoryEntry = {
      operation: { type: "batch", operations: [renameTo("d"), renameTo("e")] },
      inverse: { type: "batch", operations: [renameTo("d"), renameTo("c")] },
    };

    expect(mergeLastEntry(history, batchEntry).past).toStrictEqual([
      {
        operation: {
          type: "batch",
          operations: [renameTo("c"), renameTo("d"), renameTo("e")],
        },
        inverse: {
          type: "batch",
          operations: [renameTo("d"), renameTo("c"), renameTo("b")],
        },
      },
    ]);
  });

  it("does not change the given history when merging", () => {
    const history: History = {
      past: [FIRST_ENTRY, SECOND_ENTRY],
      future: [FOURTH_ENTRY],
    };

    mergeLastEntry(history, THIRD_ENTRY);

    expect(history).toStrictEqual({
      past: [FIRST_ENTRY, SECOND_ENTRY],
      future: [FOURTH_ENTRY],
    });
  });
});
