import type { SchemaDocument } from "../model/schema-document.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import type { BatchOperation, Operation } from "./operation.js";

/** Applies one step of a batch; a nested batch step is applied the same way. */
export type ApplyStep = (
  schema: SchemaDocument,
  operation: Operation,
) => ApplyResult;

function toInverseSteps(inverse: Operation): readonly Operation[] {
  return inverse.type === "batch" ? inverse.operations : [inverse];
}

/**
 * Applies the steps of `operation` in order, each on the result of the
 * previous one. A failing step fails the whole batch with its path prefixed by
 * ["operations", stepIndex], and no intermediate schema is returned.
 *
 * The inverse is a flat batch of the step inverses in reverse order: a step
 * inverse that is itself a batch has its steps spread in. Every inverse built
 * this way has depth at most 1, so undoing a batch nested as deep as
 * MAX_BATCH_DEPTH never exceeds the limit. When every step returns its input
 * schema unchanged, so does the batch (an empty batch included).
 *
 * `applyStep` is passed in instead of imported so this module does not import
 * the dispatcher that calls it.
 */
export function applyBatch(
  schema: SchemaDocument,
  operation: BatchOperation,
  applyStep: ApplyStep,
): ApplyResult {
  let current = schema;
  const stepInverses: Operation[] = [];
  for (const [stepIndex, step] of operation.operations.entries()) {
    const result = applyStep(current, step);
    if (!result.isOk) {
      return rejectOperation(result.error.code, [
        "operations",
        stepIndex,
        ...result.error.path,
      ]);
    }
    current = result.value.schema;
    stepInverses.push(result.value.inverse);
  }
  return acceptOperation(current, {
    type: "batch",
    operations: stepInverses.toReversed().flatMap(toInverseSteps),
  });
}
