import type { SchemaDetail, SchemaSummary } from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";

import type { SchemaSummaryRecord } from "./schemas.repository.js";

/** Builds a new object field by field so no extra record field reaches a response. */
export function toSchemaSummary(record: SchemaSummaryRecord): SchemaSummary {
  return {
    id: record.id,
    name: record.name,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** `document` is always the parsed, migrated document, never the raw column value. */
export function toSchemaDetail(
  record: SchemaSummaryRecord,
  document: SchemaDocument,
): SchemaDetail {
  return { ...toSchemaSummary(record), document };
}
