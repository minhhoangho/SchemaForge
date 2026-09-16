import { SchemaforgeDatabase } from "./database";
import { createBrowserSchemaLockManager } from "./schema-lock-manager";
import type { SchemaLockManager } from "./schema-lock-manager";
import { createSchemaRepository } from "./schema-repository";
import type { SchemaRepository } from "./schema-repository";

export type StorageBundle = {
  readonly repository: SchemaRepository;
  readonly lockManager: SchemaLockManager;
  readonly database: SchemaforgeDatabase;
};

/**
 * Wires the repository to the real IndexedDB and Web Locks. Both are browser
 * APIs, so this runs in an effect only, never on the server.
 */
export function createBrowserStorage(): StorageBundle {
  const database = new SchemaforgeDatabase();
  return {
    database,
    lockManager: createBrowserSchemaLockManager(),
    repository: createSchemaRepository({
      database,
      clock: () => Date.now(),
      generateId: () => crypto.randomUUID(),
    }),
  };
}
