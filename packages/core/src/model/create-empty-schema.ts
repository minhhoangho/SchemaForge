import { CURRENT_SCHEMA_VERSION } from "./schema-document.js";
import type { SchemaDocument } from "./schema-document.js";

export function createEmptySchema(name: string): SchemaDocument {
  return {
    version: CURRENT_SCHEMA_VERSION,
    name,
    tables: {},
    columns: {},
    relations: {},
    indexes: {},
    enums: {},
    subjectAreas: {},
    notes: {},
  };
}
