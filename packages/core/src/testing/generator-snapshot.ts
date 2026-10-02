import type { GeneratorDiagnostic } from "../generators/shared/generator-types.js";

// Content of the `.diagnostics.txt` file stored next to each generator snapshot.
export function formatDiagnosticsSnapshot(
  diagnostics: readonly GeneratorDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return "(none)\n";
  }
  return diagnostics
    .map(({ code, path }) => `${code} ${JSON.stringify(path)}\n`)
    .join("");
}
