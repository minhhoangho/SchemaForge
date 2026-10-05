import {
  IMPORT_FORMATS,
  type BatchOperation,
  type ImportDiagnostic,
  type ImportFormat,
  type ImportMode,
  type Issue,
  type LayoutMetrics,
  type SchemaDocument,
} from "@schemaforge/core";

export type ImportRequest = {
  readonly requestId: number;
  readonly format: ImportFormat;
  readonly source: string;
  readonly fallbackSchemaName: string;
  readonly layout: LayoutMetrics;
  readonly mode: ImportMode;
  // null in "new" mode: the worker builds the batch on an empty schema.
  readonly target: SchemaDocument | null;
};

/** Counts of the imported document, not of the target. */
export type ImportSummary = {
  readonly tables: number;
  readonly columns: number;
  readonly relations: number;
  readonly indexes: number;
  readonly enums: number;
  readonly subjectAreas: number;
  readonly notes: number;
};

export type ImportResponse =
  | {
      readonly requestId: number;
      readonly kind: "success";
      readonly operation: BatchOperation;
      readonly resultDocument: SchemaDocument;
      readonly summary: ImportSummary;
      readonly diagnostics: readonly ImportDiagnostic[];
      readonly introducedIssues: readonly Issue[];
    }
  | {
      readonly requestId: number;
      readonly kind: "failure";
      readonly diagnostics: readonly ImportDiagnostic[];
    }
  | { readonly requestId: number; readonly kind: "crashed" };

const FORMATS: readonly unknown[] = IMPORT_FORMATS;
const RESPONSE_KINDS: readonly unknown[] = ["success", "failure", "crashed"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isLayout(value: unknown): boolean {
  return (
    isObject(value) &&
    isNumber(value.tableWidth) &&
    isNumber(value.headerHeight) &&
    isNumber(value.columnRowHeight) &&
    isNumber(value.gap)
  );
}

function isMode(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (value.mode === "new") return true;
  return (
    value.mode === "merge" &&
    isObject(value.origin) &&
    isNumber(value.origin.x) &&
    isNumber(value.origin.y)
  );
}

/**
 * The shape check of a worker message; the target document is checked by
 * core when the operation is applied.
 */
export function isImportRequest(value: unknown): value is ImportRequest {
  if (
    !isObject(value) ||
    !isNumber(value.requestId) ||
    !FORMATS.includes(value.format) ||
    typeof value.source !== "string" ||
    typeof value.fallbackSchemaName !== "string" ||
    !isLayout(value.layout) ||
    !isMode(value.mode)
  ) {
    return false;
  }
  if (isObject(value.mode) && value.mode.mode === "merge") {
    return isObject(value.target);
  }
  return value.target === null || isObject(value.target);
}

export function isImportResponse(value: unknown): value is ImportResponse {
  return (
    isObject(value) &&
    isNumber(value.requestId) &&
    RESPONSE_KINDS.includes(value.kind)
  );
}
