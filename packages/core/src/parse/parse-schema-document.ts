import { sortByPathThenCode } from "../document-path.js";
import type { StructuralError } from "../error-codes.js";
import {
  CURRENT_SCHEMA_VERSION,
  schemaDocumentShape,
} from "../model/schema-document.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { err, ok } from "../result.js";
import type { Result } from "../result.js";

import { isJsonObject } from "./json-object.js";
import { MIGRATION_STEPS, migrateDocument } from "./migrations.js";
import { checkStructuralInvariants } from "./structural-invariants.js";
import { toStructuralErrors } from "./zod-issues.js";

// Zod's record type silently drops a "__proto__" own key instead of
// reporting it, even when its value has the wrong shape, so every map is
// checked by hand for this one key.
const MAP_FIELD_NAMES = [
  "tables",
  "columns",
  "relations",
  "indexes",
  "enums",
  "subjectAreas",
  "notes",
] as const;

function findProtoKeyErrors(
  document: Readonly<Record<string, unknown>>,
): readonly StructuralError[] {
  return MAP_FIELD_NAMES.filter((mapName) => {
    const map = document[mapName];
    return isJsonObject(map) && Object.hasOwn(map, "__proto__");
  }).map((mapName) => ({
    code: "invalid-shape" as const,
    path: [mapName, "__proto__"],
  }));
}

function isValidVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

// Order matters: version check, migration, shape (Zod plus the __proto__
// check), then structural invariants, run only once the shape is clean.
export function parseSchemaDocument(
  input: unknown,
): Result<SchemaDocument, readonly StructuralError[]> {
  if (!isJsonObject(input) || !isValidVersion(input.version)) {
    return err([{ code: "invalid-shape", path: ["version"] }]);
  }
  if (input.version > CURRENT_SCHEMA_VERSION) {
    return err([{ code: "version-unsupported", path: ["version"] }]);
  }

  const migrated = migrateDocument(input, input.version, MIGRATION_STEPS);
  const parsed = schemaDocumentShape.safeParse(migrated);
  if (!parsed.success) {
    return err(
      sortByPathThenCode([
        ...findProtoKeyErrors(migrated),
        ...toStructuralErrors(parsed.error.issues),
      ]),
    );
  }

  const protoErrors = findProtoKeyErrors(migrated);
  if (protoErrors.length > 0) {
    return err(sortByPathThenCode(protoErrors));
  }

  const invariantErrors = checkStructuralInvariants(parsed.data);
  return invariantErrors.length > 0 ? err(invariantErrors) : ok(parsed.data);
}
