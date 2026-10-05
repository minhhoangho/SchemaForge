import { err } from "../../result.js";
import { assembleDocument } from "../shared/assemble-document.js";
import {
  createImportDiagnostic,
  finalizeImportDiagnostics,
} from "../shared/import-diagnostics.js";
import { checkSourceLength } from "../shared/import-limits.js";
import type { Importer } from "../shared/import-types.js";
import { buildPrismaDraft } from "./prisma-draft.js";
import { parsePrismaSchema } from "./prisma-parser.js";

/**
 * Reads a Prisma schema (import / export spec, section 6) with the parser of
 * this folder, so the subpath has no runtime dependency. A syntax error stops
 * the import at the first unexpected token.
 */
export const importPrisma: Importer = (source, options) => {
  const tooLarge = checkSourceLength(source);
  if (tooLarge !== null) {
    return err(tooLarge);
  }
  const parsed = parsePrismaSchema(source);
  if (!parsed.isOk) {
    return err({
      diagnostics: finalizeImportDiagnostics([
        createImportDiagnostic("syntax-error", parsed.error.position, null),
      ]),
    });
  }
  return assembleDocument(buildPrismaDraft(parsed.value), options);
};
