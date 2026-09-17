import type { SchemaDocument } from "@schemaforge/core";

import type { SchemaforgeDatabase } from "./database";
import { isCloudSchemaRecord, parseSchemaRecord } from "./records";
import type { CloudSchemaRecord, SchemaRecord, SyncStatus } from "./records";
import { isSchemaId } from "./schema-id";

/**
 * A schema as the cloud returned it. The caller has already run
 * parseSchemaDocument and turned ISO timestamps into epoch milliseconds.
 */
export type CloudCopy = {
  readonly id: string;
  readonly ownerId: string;
  readonly document: SchemaDocument;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type CompletePushInput = {
  readonly revision: number;
  readonly sentUpdatedAt: number;
};

export type SyncState = {
  readonly cloudRevision: number | null;
  readonly syncStatus: SyncStatus;
};

export type OwnerAssignment = {
  readonly ownerId: string;
  readonly cloudRevision: number;
  readonly syncStatus: "synced" | "conflict";
};

export type CloudCache = {
  readonly readSchemaRecord: (schemaId: string) => Promise<SchemaRecord | null>;
  readonly listOwnedSchemas: (
    ownerId: string,
  ) => Promise<readonly CloudSchemaRecord[]>;
  readonly writeCloudCopy: (input: CloudCopy) => Promise<void>;
  readonly completePush: (
    schemaId: string,
    input: CompletePushInput,
  ) => Promise<"synced" | "pending" | "not-found">;
  readonly setSyncState: (
    schemaId: string,
    state: SyncState,
  ) => Promise<"updated" | "not-found">;
  readonly assignOwner: (
    schemaId: string,
    state: OwnerAssignment,
  ) => Promise<"assigned" | "not-found" | "already-owned">;
  readonly changeSchemaId: (
    schemaId: string,
    newSchemaId: string,
  ) => Promise<"moved" | "not-found" | "id-taken">;
};

async function readSchemaRecord(
  database: SchemaforgeDatabase,
  schemaId: string,
): Promise<SchemaRecord | null> {
  return parseSchemaRecord(await database.schemas.get(schemaId));
}

// Sync fields only make sense on an owned record, so a guest record or a row
// that does not parse counts as missing for the cloud writes below.
async function readCloudRecord(
  database: SchemaforgeDatabase,
  schemaId: string,
): Promise<CloudSchemaRecord | null> {
  const record = await readSchemaRecord(database, schemaId);
  return record !== null && isCloudSchemaRecord(record) ? record : null;
}

function toCloudRecords(row: unknown): readonly CloudSchemaRecord[] {
  const record = parseSchemaRecord(row);
  return record !== null && isCloudSchemaRecord(record) ? [record] : [];
}

async function listOwnedSchemas(
  database: SchemaforgeDatabase,
  ownerId: string,
): Promise<readonly CloudSchemaRecord[]> {
  const rows = await database.schemas
    .where("ownerId")
    .equals(ownerId)
    .toArray();
  return rows
    .flatMap(toCloudRecords)
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

async function writeCloudCopy(
  database: SchemaforgeDatabase,
  input: CloudCopy,
): Promise<void> {
  const record: CloudSchemaRecord = {
    id: input.id,
    name: input.document.name,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    ownerId: input.ownerId,
    cloudRevision: input.revision,
    syncStatus: "synced",
  };
  await database.transaction(
    "rw",
    database.schemas,
    database.documents,
    async () => {
      await database.schemas.put(record);
      await database.documents.put({
        schemaId: input.id,
        document: input.document,
      });
    },
  );
}

function completePush(
  database: SchemaforgeDatabase,
  schemaId: string,
  { revision, sentUpdatedAt }: CompletePushInput,
): Promise<"synced" | "pending" | "not-found"> {
  return database.transaction("rw", database.schemas, async () => {
    const record = await readCloudRecord(database, schemaId);
    if (record === null) {
      return "not-found";
    }
    // A save that landed while the request was in flight moved updatedAt, and
    // that change still has to reach the cloud.
    const syncStatus =
      record.updatedAt === sentUpdatedAt ? "synced" : "pending";
    await database.schemas.update(schemaId, {
      cloudRevision: revision,
      syncStatus,
    });
    return syncStatus;
  });
}

function setSyncState(
  database: SchemaforgeDatabase,
  schemaId: string,
  { cloudRevision, syncStatus }: SyncState,
): Promise<"updated" | "not-found"> {
  return database.transaction("rw", database.schemas, async () => {
    const record = await readCloudRecord(database, schemaId);
    if (record === null) {
      return "not-found";
    }
    await database.schemas.update(schemaId, { cloudRevision, syncStatus });
    return "updated";
  });
}

function assignOwner(
  database: SchemaforgeDatabase,
  schemaId: string,
  { ownerId, cloudRevision, syncStatus }: OwnerAssignment,
): Promise<"assigned" | "not-found" | "already-owned"> {
  return database.transaction("rw", database.schemas, async () => {
    const record = await readSchemaRecord(database, schemaId);
    if (record === null) {
      return "not-found";
    }
    if (isCloudSchemaRecord(record)) {
      return "already-owned";
    }
    await database.schemas.update(schemaId, {
      ownerId,
      cloudRevision,
      syncStatus,
    });
    return "assigned";
  });
}

function changeSchemaId(
  database: SchemaforgeDatabase,
  schemaId: string,
  newSchemaId: string,
): Promise<"moved" | "not-found" | "id-taken"> {
  if (!isSchemaId(newSchemaId)) {
    return Promise.reject(
      new Error("A schema can only move to a lowercase UUID."),
    );
  }
  const { schemas, documents, viewports } = database;
  return database.transaction("rw", schemas, documents, viewports, async () => {
    const [record, takenRecord, document, viewport] = await Promise.all([
      schemas.get(schemaId),
      schemas.get(newSchemaId),
      documents.get(schemaId),
      viewports.get(schemaId),
    ]);
    if (record === undefined) {
      return "not-found";
    }
    if (takenRecord !== undefined) {
      return "id-taken";
    }
    await schemas.put({ ...record, id: newSchemaId });
    if (document !== undefined) {
      await documents.put({ ...document, schemaId: newSchemaId });
    }
    if (viewport !== undefined) {
      await viewports.put({ ...viewport, schemaId: newSchemaId });
    }
    await Promise.all([
      schemas.delete(schemaId),
      documents.delete(schemaId),
      viewports.delete(schemaId),
    ]);
    return "moved";
  });
}

/**
 * Storage methods for owned schemas. None of them takes a Web Lock: the caller
 * holds the schema lock, as with every other repository write.
 */
export function createCloudCache(database: SchemaforgeDatabase): CloudCache {
  return {
    readSchemaRecord: (schemaId) => readSchemaRecord(database, schemaId),
    listOwnedSchemas: (ownerId) => listOwnedSchemas(database, ownerId),
    writeCloudCopy: (input) => writeCloudCopy(database, input),
    completePush: (schemaId, input) => completePush(database, schemaId, input),
    setSyncState: (schemaId, state) => setSyncState(database, schemaId, state),
    assignOwner: (schemaId, state) => assignOwner(database, schemaId, state),
    changeSchemaId: (schemaId, newSchemaId) =>
      changeSchemaId(database, schemaId, newSchemaId),
  };
}
