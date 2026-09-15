import { describe, expect, it } from "vitest";

import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";

import { MAX_BATCH_DEPTH, parseOperation } from "./parse-operation.js";

const LEAF_OPERATION = { type: "renameSchema", name: "Shop" };

// Wraps `leaf` in `depth` layers of single-step batches: `nestBatches(0, x)`
// is `x` itself, `nestBatches(1, x)` is one batch around `x`, and so on.
function nestBatches(depth: number, leaf: unknown): unknown {
  let operation = leaf;
  for (let level = 0; level < depth; level += 1) {
    operation = { type: "batch", operations: [operation] };
  }
  return operation;
}

// The path to the batch found after descending through `count` single-step
// batches, matching how nestBatches builds its "operations", 0 chain.
function pathThroughBatches(count: number): readonly (string | number)[] {
  const path: (string | number)[] = [];
  for (let level = 0; level < count; level += 1) {
    path.push("operations", 0);
  }
  return path;
}

describe("parseOperation", () => {
  it("returns the operation for valid input", () => {
    expect(unwrapOk(parseOperation(LEAF_OPERATION))).toStrictEqual(
      LEAF_OPERATION,
    );
  });

  it("returns a frozen operation", () => {
    expect(Object.isFrozen(unwrapOk(parseOperation(LEAF_OPERATION)))).toBe(
      true,
    );
  });

  it("returns invalid-shape errors sorted by path for invalid input", () => {
    const input = {
      type: "batch",
      operations: [{ type: "removeTable" }, { type: "removeColumn" }],
    };

    expect(unwrapError(parseOperation(input))).toStrictEqual([
      { code: "invalid-shape", path: ["operations", 0, "tableId"] },
      { code: "invalid-shape", path: ["operations", 1, "columnId"] },
    ]);
  });

  it("accepts a batch nested exactly MAX_BATCH_DEPTH levels deep", () => {
    const input = nestBatches(MAX_BATCH_DEPTH, LEAF_OPERATION);

    expect(parseOperation(input).isOk).toBe(true);
  });

  it("rejects a batch nested one level deeper than MAX_BATCH_DEPTH at the path of the too-deep batch", () => {
    const input = nestBatches(MAX_BATCH_DEPTH + 1, LEAF_OPERATION);

    expect(unwrapError(parseOperation(input))).toStrictEqual([
      { code: "invalid-shape", path: pathThroughBatches(MAX_BATCH_DEPTH) },
    ]);
  });

  it("returns an error instead of throwing for 100000 nested batches", () => {
    const deeplyNestedInput = nestBatches(100000, LEAF_OPERATION);

    expect(() => parseOperation(deeplyNestedInput)).not.toThrow();
    expect(parseOperation(deeplyNestedInput).isOk).toBe(false);
  });

  it("returns invalid-shape at the root for a non-object input", () => {
    expect(unwrapError(parseOperation("not-an-object"))).toStrictEqual([
      { code: "invalid-shape", path: [] },
    ]);
  });
});
