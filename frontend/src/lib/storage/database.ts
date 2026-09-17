import { Dexie } from "dexie";
import type { DexieOptions, EntityTable } from "dexie";

import type {
  DocumentRecord,
  SchemaRecord,
  SessionRecord,
  ViewportRecord,
} from "./records";

export const DATABASE_NAME = "schemaforge";

export class SchemaforgeDatabase extends Dexie {
  // declare emits no runtime field, so it cannot overwrite the tables that
  // Dexie attaches to the instance, and it needs no `!` or type assertion.
  declare readonly schemas: EntityTable<SchemaRecord, "id">;
  declare readonly documents: EntityTable<DocumentRecord, "schemaId">;
  declare readonly viewports: EntityTable<ViewportRecord, "schemaId">;
  declare readonly session: EntityTable<SessionRecord, "key">;

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
    // Records from version 1 become guest schemas. IndexedDB does not index
    // null, so guest schemas stay out of the ownerId index.
    this.version(2)
      .stores({
        schemas: "id, updatedAt, ownerId",
        documents: "schemaId",
        viewports: "schemaId",
        session: "key",
      })
      .upgrade((transaction) =>
        transaction.table("schemas").toCollection().modify({
          ownerId: null,
          cloudRevision: null,
          syncStatus: null,
        }),
      );
  }
}
