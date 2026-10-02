import type { DocumentPath } from "../../document-path.js";
import { sortByPathThenCode } from "../../document-path.js";
import type { GeneratorDiagnosticCode } from "./diagnostic-codes.js";
import type { GeneratorDiagnostic } from "./generator-types.js";

export function createDiagnostic(
  code: GeneratorDiagnosticCode,
  path: DocumentPath,
): GeneratorDiagnostic {
  return { code, path };
}

export function finalizeDiagnostics(
  diagnostics: readonly GeneratorDiagnostic[],
): readonly GeneratorDiagnostic[] {
  const unique = new Map(
    diagnostics.map((diagnostic) => [
      JSON.stringify([diagnostic.code, diagnostic.path]),
      diagnostic,
    ]),
  );
  return sortByPathThenCode([...unique.values()]);
}
