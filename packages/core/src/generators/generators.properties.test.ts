import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROPERTY_RUNS,
  PROPERTY_SEED,
  keyOrderArbitrary,
  schemaDocumentArbitrary,
  withShuffledKeys,
} from "../testing/arbitraries.js";
import { listGeneratorCases } from "../testing/generator-cases.js";
import { finalizeDiagnostics } from "./shared/diagnostics.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const PROPERTY_TIMEOUT_MS = 60_000;
const EARLY_SYSTEM_TIME = new Date("2001-01-01T00:00:00Z");
const LATE_SYSTEM_TIME = new Date("2099-12-31T23:59:59Z");

// The documents are well-formed but may still have semantic issues, which no
// generator may reject (spec section 10, "Property test").
describe.each(listGeneratorCases())("$name generator properties", ({ run }) => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    "does not throw for any well-formed document",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaDocumentArbitrary(), (schema) => {
          expect(() => run(schema)).not.toThrow();
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "returns the same result when called twice",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaDocumentArbitrary(), (schema) => {
          expect(run(schema)).toStrictEqual(run(schema));
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "returns the same result when map keys are shuffled",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(
          schemaDocumentArbitrary(),
          keyOrderArbitrary(),
          (schema, order) => {
            expect(run(withShuffledKeys(schema, order))).toStrictEqual(
              run(schema),
            );
          },
        ),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "returns the same result at two different system times",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      fc.assert(
        fc.property(schemaDocumentArbitrary(), (schema) => {
          vi.setSystemTime(EARLY_SYSTEM_TIME);
          const early = run(schema);
          vi.setSystemTime(LATE_SYSTEM_TIME);

          expect(run(schema)).toStrictEqual(early);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "ends the content with exactly one newline",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaDocumentArbitrary(), (schema) => {
          const { content } = run(schema).file;

          expect(content.at(-1)).toBe("\n");
          expect(content.at(-2)).not.toBe("\n");
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "returns diagnostics sorted by path then code without repeats",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaDocumentArbitrary(), (schema) => {
          const { diagnostics } = run(schema);

          expect(diagnostics).toStrictEqual(finalizeDiagnostics(diagnostics));
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );
});
