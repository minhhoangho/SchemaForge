import type { Operation } from "../operations/operation.js";
import type { History, HistoryEntry } from "./history.js";

function toSteps(operation: Operation): readonly Operation[] {
  return operation.type === "batch" ? operation.operations : [operation];
}

/**
 * Replaces the last `past` entry with one entry that applies it and then
 * `entry`, and clears `future`, so a run of edits undoes in a single step.
 * When `past` is empty, `entry` is recorded as is.
 *
 * The merged operation is a batch of the steps of the last operation followed
 * by the steps of `entry.operation`; the merged inverse is a batch of the steps
 * of `entry.inverse` followed by the steps of the last inverse. The steps of a
 * batch are its operations, and the steps of any other operation are the
 * operation itself. Spreading one level keeps the merged depth at the deepest
 * of the two entries (at least 1), so merging on every keystroke never nests
 * batches deeper or pushes an entry past MAX_BATCH_DEPTH.
 *
 * `past` never grows, so no limit is needed. `history` is never mutated.
 */
export function mergeLastEntry(history: History, entry: HistoryEntry): History {
  const last = history.past.at(-1);
  if (last === undefined) {
    return { past: [entry], future: [] };
  }
  const merged: HistoryEntry = {
    operation: {
      type: "batch",
      operations: [...toSteps(last.operation), ...toSteps(entry.operation)],
    },
    inverse: {
      type: "batch",
      operations: [...toSteps(entry.inverse), ...toSteps(last.inverse)],
    },
  };
  return { past: [...history.past.slice(0, -1), merged], future: [] };
}
