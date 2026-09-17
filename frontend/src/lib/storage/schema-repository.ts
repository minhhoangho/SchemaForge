import {
  applyOperation,
  createEmptySchema,
  parseSchemaDocument,
} from "@schemaforge/core";
import type { SchemaDocument, StructuralError } from "@schemaforge/core";

import { createCloudCache } from "./cloud-cache";
import type { CloudCache } from "./cloud-cache";
import type { SchemaforgeDatabase } from "./database";
import {
  isCloudSchemaRecord,
  parseSchemaRecord,
  parseViewportRecord,
} from "./records";
import type { SchemaRecord, ViewportRecord } from "./records";
import { isSchemaId } from "./schema-id";
import { createSessionTable } from "./session-table";
import type { SessionTable } from "./session-table";

export type { CloudCopy } from "./cloud-cache";

export type SchemaListEntry =
  | { readonly kind: "readable"; readonly schema: SchemaRecord }
  | { readonly kind: "unreadable"; readonly schemaId: string };

export type OpenSchemaResult =
  | { readonly kind: "opened"; readonly document: SchemaDocument }
  | { readonly kind: "not-found" }
  | {
      readonly kind: "unreadable";
      readonly errors: readonly StructuralError[];
    };

export type RenameSchemaResult =
  | { readonly kind: "renamed" }
  | { readonly kind: "not-found" }
  | { readonly kind: "unreadable" };

export type SchemaRepositoryDependencies = {
  readonly database: SchemaforgeDatabase;
  readonly clock: () => number;
  readonly generateId: () => string;
};

export type CreateSchemaOptions = { readonly ownerId: string };

export type SchemaRepository = {
  readonly listSchemas: () => Promise<readonly SchemaListEntry[]>;
  readonly createSchema: (
    name: string,
    options?: CreateSchemaOptions,
  ) => Promise<SchemaRecord>;
  readonly openSchema: (schemaId: string) => Promise<OpenSchemaResult>;
  readonly saveDocument: (
    schemaId: string,
    document: SchemaDocument,
  ) => Promise<void>;
  readonly renameSchema: (
    schemaId: string,
    name: string,
  ) => Promise<RenameSchemaResult>;
  readonly deleteSchema: (schemaId: string) => Promise<void>;
  readonly readViewport: (schemaId: string) => Promise<ViewportRecord | null>;
  readonly saveViewport: (viewport: ViewportRecord) => Promise<void>;
} & CloudCache &
  SessionTable;

// The tables are typed, but rows written by an older release or a future one
// are not, so the id is read back from unknown before it is trusted as a key.
function readSchemaId(row: unknown): string | null {
  if (
    typeof row === "object" &&
    row !== null &&
    "id" in row &&
    typeof row.id === "string" &&
    isSchemaId(row.id)
  ) {
    return row.id;
  }
  return null;
}

function toListEntry(row: unknown): readonly SchemaListEntry[] {
  const schema = parseSchemaRecord(row);
  if (schema !== null) {
    return [{ kind: "readable", schema }];
  }
  const schemaId = readSchemaId(row);
  return schemaId === null ? [] : [{ kind: "unreadable", schemaId }];
}

async function listSchemas(
  database: SchemaforgeDatabase,
): Promise<readonly SchemaListEntry[]> {
  const rows = await database.schemas.orderBy("updatedAt").reverse().toArray();
  return rows.flatMap(toListEntry);
}

async function createSchema(
  dependencies: SchemaRepositoryDependencies,
  name: string,
  options: CreateSchemaOptions | undefined,
): Promise<SchemaRecord> {
  const { database, clock, generateId } = dependencies;
  const document = createEmptySchema(name);
  const now = clock();
  const base = {
    id: generateId(),
    name: document.name,
    createdAt: now,
    updatedAt: now,
  };
  // An owned schema starts pending with no revision: it does not exist in the
  // cloud until the first push creates it.
  const record: SchemaRecord =
    options === undefined
      ? { ...base, ownerId: null, cloudRevision: null, syncStatus: null }
      : {
          ...base,
          ownerId: options.ownerId,
          cloudRevision: null,
          syncStatus: "pending",
        };
  await database.transaction(
    "rw",
    database.schemas,
    database.documents,
    async () => {
      await database.schemas.put(record);
      await database.documents.put({ schemaId: record.id, document });
    },
  );
  return record;
}

async function openSchema(
  database: SchemaforgeDatabase,
  schemaId: string,
): Promise<OpenSchemaResult> {
  const row = await database.documents.get(schemaId);
  if (row === undefined) {
    return { kind: "not-found" };
  }
  const result = parseSchemaDocument(row.document);
  return result.isOk
    ? { kind: "opened", document: result.value }
    : { kind: "unreadable", errors: result.error };
}

// Runs inside the caller's write transaction, so the pending mark commits with
// the document. conflict and deleted-in-cloud wait for the user and stay.
async function touchSchemaRecord(
  database: SchemaforgeDatabase,
  schemaId: string,
  changes: { readonly name: string; readonly updatedAt: number },
): Promise<void> {
  const record = parseSchemaRecord(await database.schemas.get(schemaId));
  const shouldMarkPending =
    record !== null &&
    isCloudSchemaRecord(record) &&
    (record.syncStatus === "synced" || record.syncStatus === "pending");
  // Another tab may have deleted the schema; update then changes no row.
  await database.schemas.update(
    schemaId,
    shouldMarkPending ? { ...changes, syncStatus: "pending" } : changes,
  );
}

async function saveDocument(
  dependencies: SchemaRepositoryDependencies,
  schemaId: string,
  document: SchemaDocument,
): Promise<void> {
  const { database, clock } = dependencies;
  await database.transaction(
    "rw",
    database.documents,
    database.schemas,
    async () => {
      await database.documents.put({ schemaId, document });
      await touchSchemaRecord(database, schemaId, {
        name: document.name,
        updatedAt: clock(),
      });
    },
  );
}

function renameDocument(
  document: SchemaDocument,
  name: string,
): SchemaDocument {
  const result = applyOperation(document, { type: "renameSchema", name });
  if (!result.isOk) {
    throw new Error(`Renaming a schema failed with ${result.error.code}.`);
  }
  return result.value.schema;
}

function renameSchema(
  dependencies: SchemaRepositoryDependencies,
  schemaId: string,
  name: string,
): Promise<RenameSchemaResult> {
  const { database, clock } = dependencies;
  return database.transaction(
    "rw",
    database.documents,
    database.schemas,
    async (): Promise<RenameSchemaResult> => {
      const row = await database.documents.get(schemaId);
      if (row === undefined) {
        return { kind: "not-found" };
      }
      const parsed = parseSchemaDocument(row.document);
      if (!parsed.isOk) {
        return { kind: "unreadable" };
      }
      const document = renameDocument(parsed.value, name);
      await database.documents.put({ schemaId, document });
      await touchSchemaRecord(database, schemaId, {
        name,
        updatedAt: clock(),
      });
      return { kind: "renamed" };
    },
  );
}

async function deleteSchema(
  database: SchemaforgeDatabase,
  schemaId: string,
): Promise<void> {
  await database.transaction(
    "rw",
    database.schemas,
    database.documents,
    database.viewports,
    async () => {
      await Promise.all([
        database.schemas.delete(schemaId),
        database.documents.delete(schemaId),
        database.viewports.delete(schemaId),
      ]);
    },
  );
}

async function readViewport(
  database: SchemaforgeDatabase,
  schemaId: string,
): Promise<ViewportRecord | null> {
  return parseViewportRecord(await database.viewports.get(schemaId));
}

/**
 * The single door to IndexedDB: every document read goes through
 * parseSchemaDocument and every write is one transaction. Dexie errors are not
 * caught here; callers map them with toStorageErrorCode.
 */
export function createSchemaRepository(
  dependencies: SchemaRepositoryDependencies,
): SchemaRepository {
  const { database } = dependencies;
  return {
    listSchemas: () => listSchemas(database),
    createSchema: (name, options) => createSchema(dependencies, name, options),
    openSchema: (schemaId) => openSchema(database, schemaId),
    saveDocument: (schemaId, document) =>
      saveDocument(dependencies, schemaId, document),
    renameSchema: (schemaId, name) =>
      renameSchema(dependencies, schemaId, name),
    deleteSchema: (schemaId) => deleteSchema(database, schemaId),
    readViewport: (schemaId) => readViewport(database, schemaId),
    saveViewport: async (viewport) => {
      await database.viewports.put(viewport);
    },
    ...createCloudCache(database),
    ...createSessionTable(database),
  };
}
