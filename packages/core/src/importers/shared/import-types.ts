import type { DocumentPath } from "../../document-path.js";
import type { StructuralErrorCode } from "../../error-codes.js";
import type { GenerateId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Result } from "../../result.js";
import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";

export const IMPORT_FORMATS = [
  "postgresql",
  "mysql",
  "sqlserver",
  "prisma",
  "dbml",
  "json",
] as const;

export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/** Both start at 1; the column counts UTF-16 code units (string index + 1). */
export type SourceLocation = {
  readonly line: number;
  readonly column: number;
};

export type ImportDiagnostic = {
  // Structural error codes come only from the json importer.
  readonly code: ImportDiagnosticCode | StructuralErrorCode;
  readonly location: SourceLocation | null;
  readonly path: DocumentPath | null;
};

export type LayoutMetrics = {
  readonly tableWidth: number;
  readonly headerHeight: number;
  readonly columnRowHeight: number;
  readonly gap: number;
};

export type ImportOptions = {
  readonly fallbackSchemaName: string;
  readonly generateId: GenerateId;
  readonly layout: LayoutMetrics;
};

export type ImportSuccess = {
  readonly document: SchemaDocument;
  readonly diagnostics: readonly ImportDiagnostic[];
};

/** Always carries at least one diagnostic. */
export type ImportFailure = {
  readonly diagnostics: readonly ImportDiagnostic[];
};

export type ImportResult = Result<ImportSuccess, ImportFailure>;

export type Importer = (source: string, options: ImportOptions) => ImportResult;
