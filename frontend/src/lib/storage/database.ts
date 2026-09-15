import { Dexie } from "dexie";
import type { DexieOptions, EntityTable } from "dexie";

import type { DocumentRecord, SchemaRecord, ViewportRecord } from "./records";

export const DATABASE_NAME = "schemaforge";

export class SchemaforgeDatabase extends Dexie {
  // declare emits no runtime field, so it cannot overwrite the tables that
  // Dexie attaches to the instance, and it needs no `!` or type assertion.
  declare readonly schemas: EntityTable<SchemaRecord, "id">;
  declare readonly documents: EntityTable<DocumentRecord, "schemaId">;
  declare readonly viewports: EntityTable<ViewportRecord, "schemaId">;

  constructor(options?: DexieOptions) {
    super(DATABASE_NAME, options);
    // Never edit a released version. To change the structure, add
    // version(n + 1) with .upgrade(), and add a test that opens a database
    // created at the previous version.
    this.version(1).stores({
      schemas: "id, updatedAt",
      documents: "schemaId",
      viewports: "schemaId",
    });
  }
}
