import { isJsonObject } from "../../parse/json-object.js";
import { createImportDiagnostic } from "./import-diagnostics.js";
import type { ImportFailure } from "./import-types.js";

/** In UTF-16 code units; checked before parsing. */
export const MAX_IMPORT_SOURCE_LENGTH = 2_097_152;

/** Tables, columns, relations, indexes, enums, subject areas and notes together. */
export const MAX_IMPORTED_ELEMENTS = 20_000;

export function checkSourceLength(source: string): ImportFailure | null {
  return source.length > MAX_IMPORT_SOURCE_LENGTH
    ? { diagnostics: [createImportDiagnostic("source-too-large", null, null)] }
    : null;
}

const ELEMENT_MAP_NAMES = [
  "tables",
  "columns",
  "relations",
  "indexes",
  "enums",
  "subjectAreas",
  "notes",
] as const;

/**
 * Also counts parsed JSON whose shape is not checked yet, so a crafted file is
 * rejected before the costly checks; a map that is not an object counts 0.
 */
export function countDocumentElements(
  document: Readonly<Record<string, unknown>>,
): number {
  return ELEMENT_MAP_NAMES.reduce((total, mapName) => {
    const elements = document[mapName];
    return total + (isJsonObject(elements) ? Object.keys(elements).length : 0);
  }, 0);
}

export function tooManyElementsFailure(): ImportFailure {
  return {
    diagnostics: [createImportDiagnostic("too-many-elements", null, null)],
  };
}
