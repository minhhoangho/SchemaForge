import type { SchemaDocument } from "@schemaforge/core";

export type SchemaVersionSummary = {
  /** Epoch milliseconds. */
  readonly updatedAt: number;
  readonly tableCount: number;
  readonly columnCount: number;
};

/** What the conflict dialog shows of one version of a schema. */
export function summarizeSchemaVersion(
  document: SchemaDocument,
  updatedAt: number,
): SchemaVersionSummary {
  return {
    updatedAt,
    tableCount: Object.keys(document.tables).length,
    columnCount: Object.keys(document.columns).length,
  };
}
