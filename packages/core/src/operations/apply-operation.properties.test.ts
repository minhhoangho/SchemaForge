import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-codes.js";
import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import {
  PROPERTY_RUNS,
  PROPERTY_SEED,
  schemaWithOperationArbitrary,
} from "../testing/arbitraries.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyOperation } from "./apply-operation.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const PROPERTY_TIMEOUT_MS = 60_000;

// Each property only concerns successful (or only failed) operations; fc.pre
// discards the other runs, and fast-check generates more until numRuns
// runs are kept.
describe("applyOperation properties", () => {
  it(
    "produces a schema that passes parseSchemaDocument after a JSON round trip whenever an operation succeeds",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaWithOperationArbitrary(), ({ schema, operation }) => {
          const result = applyOperation(schema, operation);
          fc.pre(result.isOk);
          const applied = unwrapOk(result).schema;
          const roundTripped: unknown = JSON.parse(JSON.stringify(applied));

          expect(parseSchemaDocument(roundTripped)).toStrictEqual({
            isOk: true,
            value: applied,
          });
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "restores the original schema when the inverse is applied after a successful operation",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaWithOperationArbitrary(), ({ schema, operation }) => {
          const result = applyOperation(schema, operation);
          fc.pre(result.isOk);
          const applied = unwrapOk(result);

          const undone = applyOperation(applied.schema, applied.inverse);

          expect(unwrapOk(undone).schema).toStrictEqual(schema);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "reproduces the first result when the operation is applied again after its inverse",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaWithOperationArbitrary(), ({ schema, operation }) => {
          const result = applyOperation(schema, operation);
          fc.pre(result.isOk);
          const first = unwrapOk(result);
          const undone = unwrapOk(applyOperation(first.schema, first.inverse));

          const redone = applyOperation(undone.schema, operation);

          expect(redone).toStrictEqual({ isOk: true, value: first });
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "returns an error and leaves the input unchanged whenever an operation fails",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaWithOperationArbitrary(), ({ schema, operation }) => {
          // Parsing freezes the document, so any mutation would throw.
          const input = unwrapOk(parseSchemaDocument(schema));
          const snapshot = JSON.stringify(input);

          const result = applyOperation(input, operation);
          fc.pre(!result.isOk);

          expect(ERROR_CODES).toContain(unwrapError(result).code);
          expect(JSON.stringify(input)).toBe(snapshot);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );
});
