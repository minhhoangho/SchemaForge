import type { SchemaDocument } from "../../model/schema-document.js";
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

export function countDocumentElements(document: SchemaDocument): number {
  return [
    document.tables,
    document.columns,
    document.relations,
    document.indexes,
    document.enums,
    document.subjectAreas,
    document.notes,
  ].reduce((total, elements) => total + Object.keys(elements).length, 0);
}

export function tooManyElementsFailure(): ImportFailure {
  return {
    diagnostics: [createImportDiagnostic("too-many-elements", null, null)],
  };
}
