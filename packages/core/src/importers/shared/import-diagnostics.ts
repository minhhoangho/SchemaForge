import type { DocumentPath } from "../../document-path.js";
import { compareDocumentPaths } from "../../document-path.js";
import type { StructuralErrorCode } from "../../error-codes.js";
import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";
import type { ImportDiagnostic, SourceLocation } from "./import-types.js";

export function createImportDiagnostic(
  code: ImportDiagnosticCode | StructuralErrorCode,
  location: SourceLocation | null,
  path: DocumentPath | null,
): ImportDiagnostic {
  return { code, location, path };
}

// Relational operators compare by UTF-16 code unit, independent of locale.
function compareNumbersOrStrings<Value extends number | string>(
  a: Value,
  b: Value,
): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

function compareNullsLast<Value>(
  a: Value | null,
  b: Value | null,
  compare: (a: Value, b: Value) => number,
): number {
  if (a === null || b === null) {
    return Number(a === null) - Number(b === null);
  }
  return compare(a, b);
}

function compareLocations(a: SourceLocation, b: SourceLocation): number {
  return (
    compareNumbersOrStrings(a.line, b.line) ||
    compareNumbersOrStrings(a.column, b.column)
  );
}

function compareDiagnostics(a: ImportDiagnostic, b: ImportDiagnostic): number {
  return (
    compareNullsLast(a.location, b.location, compareLocations) ||
    compareNumbersOrStrings(a.code, b.code) ||
    compareNullsLast(a.path, b.path, compareDocumentPaths)
  );
}

function toDiagnosticKey(diagnostic: ImportDiagnostic): string {
  const { code, location, path } = diagnostic;
  return JSON.stringify([
    code,
    location === null ? null : [location.line, location.column],
    path,
  ]);
}

/** Removes repeated (code, location, path) triples and sorts by location, code, then path. */
export function finalizeImportDiagnostics(
  diagnostics: readonly ImportDiagnostic[],
): readonly ImportDiagnostic[] {
  const unique = new Map(
    diagnostics.map((diagnostic) => [toDiagnosticKey(diagnostic), diagnostic]),
  );
  return [...unique.values()].toSorted(compareDiagnostics);
}
