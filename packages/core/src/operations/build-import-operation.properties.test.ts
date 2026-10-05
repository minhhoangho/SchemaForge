import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createEmptySchema } from "../model/create-empty-schema.js";
import type { GenerateId } from "../model/ids.js";
import type { Position } from "../model/position.js";
import type { SchemaDocument } from "../model/schema-document.js";
import {
  PROPERTY_RUNS,
  PROPERTY_SEED,
  schemaDocumentArbitrary,
} from "../testing/arbitraries.js";
import { createCounterIdGenerator } from "../testing/factories.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { applyOperation } from "./apply-operation.js";
import type { ApplyResult } from "./apply-result.js";
import { buildImportOperation } from "./build-import-operation.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const PROPERTY_TIMEOUT_MS = 60_000;
const MAX_COORDINATE = 10_000;
const MERGE_ID_PREFIX = "m";

const ELEMENT_MAP_KEYS = [
  "tables",
  "columns",
  "relations",
  "indexes",
  "enums",
  "subjectAreas",
  "notes",
] as const;

// schemaDocumentArbitrary numbers ids from 1 in both documents, so the merge
// draws tokens that cannot clash with the target, as the editor's ids do.
function createMergeIdGenerator(): GenerateId {
  const next = createCounterIdGenerator();
  return () => `${MERGE_ID_PREFIX}${next()}`;
}

function originArbitrary(): fc.Arbitrary<Position> {
  const coordinate = fc.integer({ min: -MAX_COORDINATE, max: MAX_COORDINATE });
  return fc.record({ x: coordinate, y: coordinate });
}

function mergeCaseArbitrary(): fc.Arbitrary<
  readonly [SchemaDocument, SchemaDocument, Position]
> {
  return fc.tuple(
    schemaDocumentArbitrary(),
    schemaDocumentArbitrary(),
    originArbitrary(),
  );
}

function applyMerge(
  target: SchemaDocument,
  imported: SchemaDocument,
  origin: Position,
): ApplyResult {
  const { operation } = buildImportOperation(
    target,
    imported,
    { mode: "merge", origin },
    createMergeIdGenerator(),
  );
  return applyOperation(target, operation);
}

// The part of every element map whose ids also exist in `target`.
function elementsWithTargetIds(
  schema: SchemaDocument,
  target: SchemaDocument,
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    ELEMENT_MAP_KEYS.map((key) => [
      key,
      Object.fromEntries(
        Object.entries(schema[key]).filter(([id]) =>
          Object.hasOwn(target[key], id),
        ),
      ),
    ]),
  );
}

describe("buildImportOperation properties", () => {
  it(
    "always applies a merge batch to any target",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(mergeCaseArbitrary(), ([target, imported, origin]) => {
          expect(applyMerge(target, imported, origin).isOk).toBe(true);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "keeps every element of the target unchanged",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(mergeCaseArbitrary(), ([target, imported, origin]) => {
          const merged = unwrapOk(applyMerge(target, imported, origin)).schema;

          expect(elementsWithTargetIds(merged, target)).toStrictEqual(
            elementsWithTargetIds(target, target),
          );
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "restores the target exactly when the inverse is applied",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(mergeCaseArbitrary(), ([target, imported, origin]) => {
          const applied = unwrapOk(applyMerge(target, imported, origin));

          const undone = applyOperation(applied.schema, applied.inverse);

          expect(unwrapOk(undone).schema).toStrictEqual(target);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "applies a new-mode batch on an empty schema",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaDocumentArbitrary(), (imported) => {
          const empty = createEmptySchema(imported.name);
          const { operation } = buildImportOperation(
            empty,
            imported,
            { mode: "new" },
            createCounterIdGenerator(),
          );

          const applied = applyOperation(empty, operation);

          expect(unwrapOk(applied).schema).toStrictEqual(imported);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );
});
