import type { DocumentPath } from "../document-path.js";
import type { StructuralError } from "../error-codes.js";
import { operationShape } from "../operations/operation.js";
import type { Operation } from "../operations/operation.js";
import { err, ok } from "../result.js";
import type { Result } from "../result.js";

import { isJsonObject } from "./json-object.js";
import { toStructuralErrors } from "./zod-issues.js";

// A batch nested deeper than this is rejected before Zod ever sees it. A
// non-batch operation has depth 0; a batch has depth 1 + the deepest step,
// so an AI turn or an import result (a batch of a builder's batch) is 2.
export const MAX_BATCH_DEPTH = 8;

type BatchLikeInput = {
  readonly type: "batch";
  readonly operations: readonly unknown[];
};

// Any JSON object with type "batch" and an "operations" array counts as a
// batch for this check, even if its steps turn out to be malformed: shape
// errors inside a batch that is not too deep are still Zod's job.
function isBatchLikeInput(value: unknown): value is BatchLikeInput {
  return (
    isJsonObject(value) &&
    value.type === "batch" &&
    Array.isArray(value.operations)
  );
}

type PendingNode = {
  readonly value: unknown;
  readonly path: DocumentPath;
  readonly batchAncestorCount: number;
};

// Walks the batch tree with an explicit stack instead of recursion, so input
// nested far beyond MAX_BATCH_DEPTH cannot overflow the call stack. Children
// are pushed in reverse so the leftmost one is popped first, which reports
// the first over-limit batch in reading order when more than one exists.
function findTooDeepBatchPath(input: unknown): DocumentPath | null {
  const stack: PendingNode[] = [
    { value: input, path: [], batchAncestorCount: 0 },
  ];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined || !isBatchLikeInput(node.value)) {
      continue;
    }
    const batchDepth = node.batchAncestorCount + 1;
    if (batchDepth > MAX_BATCH_DEPTH) {
      return node.path;
    }
    const { operations } = node.value;
    for (let index = operations.length - 1; index >= 0; index -= 1) {
      stack.push({
        value: operations[index],
        path: [...node.path, "operations", index],
        batchAncestorCount: batchDepth,
      });
    }
  }
  return null;
}

// Order matters: depth first (an explicit-stack scan of unknown input), then
// shape. Zod recurses with call-stack depth proportional to nesting, so
// running it on unchecked input would let a deeply nested batch overflow the
// stack instead of producing the invalid-shape result callers expect.
export function parseOperation(
  input: unknown,
): Result<Operation, readonly StructuralError[]> {
  const tooDeepPath = findTooDeepBatchPath(input);
  if (tooDeepPath !== null) {
    return err([{ code: "invalid-shape", path: tooDeepPath }]);
  }

  const parsed = operationShape.safeParse(input);
  return parsed.success
    ? ok(parsed.data)
    : err(toStructuralErrors(parsed.error.issues));
}
