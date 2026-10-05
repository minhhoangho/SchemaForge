import { parseSchemaDocument } from "../../parse/parse-schema-document.js";
import { err, ok } from "../../result.js";
import type { Result } from "../../result.js";
import {
  createImportDiagnostic,
  finalizeImportDiagnostics,
} from "../shared/import-diagnostics.js";
import {
  MAX_IMPORTED_ELEMENTS,
  checkSourceLength,
  countDocumentElements,
  tooManyElementsFailure,
} from "../shared/import-limits.js";
import type { ImportFailure, Importer } from "../shared/import-types.js";
import { locateJsonSyntaxError } from "./locate-json-syntax-error.js";

function parseJson(source: string): Result<unknown, ImportFailure> {
  try {
    const value: unknown = JSON.parse(source);
    return ok(value);
  } catch {
    // The SyntaxError message differs between engines, so the location comes
    // from our own scan of the source.
    const location = locateJsonSyntaxError(source);
    return err({
      diagnostics: [createImportDiagnostic("syntax-error", location, null)],
    });
  }
}

/**
 * Reads a SchemaForge JSON document as written by `serializeSchemaDocument`,
 * keeping its ids and positions. It ignores the options of the shared
 * `Importer` contract: nothing here generates ids or places elements.
 */
export const importJson: Importer = (source) => {
  const tooLarge = checkSourceLength(source);
  if (tooLarge !== null) {
    return err(tooLarge);
  }
  const json = parseJson(source);
  if (!json.isOk) {
    return json;
  }
  const parsed = parseSchemaDocument(json.value);
  if (!parsed.isOk) {
    const diagnostics = parsed.error.map((error) =>
      createImportDiagnostic(error.code, null, error.path),
    );
    return err({ diagnostics: finalizeImportDiagnostics(diagnostics) });
  }
  if (countDocumentElements(parsed.value) > MAX_IMPORTED_ELEMENTS) {
    return err(tooManyElementsFailure());
  }
  return ok({ document: parsed.value, diagnostics: [] });
};
