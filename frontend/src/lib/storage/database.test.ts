import { createEmptySchema } from "@schemaforge/core";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { DATABASE_NAME, SchemaforgeDatabase } from "./database";
import type { SchemaRecord } from "./records";

const FIRST_SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_SCHEMA_ID = "00000000-0000-4000-8000-000000000002";
const OWNER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

function createSchemaRecord(id: string, updatedAt: number): SchemaRecord {
  return {
    id,
    name: `Schema ${id}`,
    createdAt: 0,
    updatedAt,
    ownerId: null,
    cloudRevision: null,
    syncStatus: null,
  };
}

// Version 1 as released in part 3, written without the sync fields, so the
// upgrade runs against rows exactly as an existing browser holds them.
async function seedVersionOneDatabase(factory: IDBFactory): Promise<void> {
  const database = new Dexie(DATABASE_NAME, {
    indexedDB: factory,
    IDBKeyRange,
  });
  database.version(1).stores({
    schemas: "id, updatedAt",
    documents: "schemaId",
    viewports: "schemaId",
  });
  await database.table("schemas").bulkPut([
    { id: FIRST_SCHEMA_ID, name: "Billing", createdAt: 1, updatedAt: 2 },
    { id: SECOND_SCHEMA_ID, name: "Shop", createdAt: 3, updatedAt: 4 },
  ]);
  await database.table("documents").bulkPut([
    { schemaId: FIRST_SCHEMA_ID, document: createEmptySchema("Billing") },
    { schemaId: SECOND_SCHEMA_ID, document: createEmptySchema("Shop") },
  ]);
  await database
    .table("viewports")
    .put({ schemaId: FIRST_SCHEMA_ID, x: 10, y: -20, zoom: 0.5 });
  database.close();
}

function readObjectStore(
  database: SchemaforgeDatabase,
  storeName: string,
): IDBObjectStore {
  return database
    .backendDB()
    .transaction(storeName, "readonly")
    .objectStore(storeName);
}

describe("SchemaforgeDatabase", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function createDatabase(factory = new IDBFactory()): SchemaforgeDatabase {
    const database = new SchemaforgeDatabase({
      indexedDB: factory,
      IDBKeyRange,
    });
    databases.add(database);
    return database;
  }

  afterEach(() => {
    for (const database of databases) {
      database.close();
    }
    databases.clear();
  });

  it("creates the schemaforge database with schemas, documents, viewports and session tables", async () => {
    const database = createDatabase();

    await database.open();

    expect(database.name).toBe(DATABASE_NAME);
    expect(DATABASE_NAME).toBe("schemaforge");
    expect(database.verno).toBe(2);
    expect(Array.from(database.backendDB().objectStoreNames)).toEqual([
      "documents",
      "schemas",
      "session",
      "viewports",
    ]);
  });

  it("keys schemas by id and indexes them by updatedAt", async () => {
    const database = createDatabase();

    await database.open();
    const schemas = readObjectStore(database, "schemas");

    expect(schemas.keyPath).toBe("id");
    expect(schemas.autoIncrement).toBe(false);
    expect(Array.from(schemas.indexNames)).toContain("updatedAt");
  });

  it("indexes schemas by ownerId", async () => {
    const database = createDatabase();
    await database.schemas.bulkAdd([
      createSchemaRecord(FIRST_SCHEMA_ID, 1),
      {
        ...createSchemaRecord(SECOND_SCHEMA_ID, 2),
        ownerId: OWNER_ID,
        cloudRevision: null,
        syncStatus: "pending",
      },
    ]);
    const schemas = readObjectStore(database, "schemas");

    const owned = await database.schemas
      .where("ownerId")
      .equals(OWNER_ID)
      .primaryKeys();

    expect(Array.from(schemas.indexNames)).toEqual(["ownerId", "updatedAt"]);
    expect(owned).toEqual([SECOND_SCHEMA_ID]);
  });

  it("creates the session table keyed by key", async () => {
    const database = createDatabase();

    await database.open();
    const session = readObjectStore(database, "session");

    expect(session.keyPath).toBe("key");
    expect(session.autoIncrement).toBe(false);
    expect(Array.from(session.indexNames)).toEqual([]);
  });

  it("upgrades a version 1 database to version 2 without losing schemas, documents or viewports", async () => {
    const factory = new IDBFactory();
    await seedVersionOneDatabase(factory);
    const database = createDatabase(factory);

    await database.open();

    expect(database.verno).toBe(2);
    await expect(database.schemas.count()).resolves.toBe(2);
    await expect(database.documents.toArray()).resolves.toEqual([
      { schemaId: FIRST_SCHEMA_ID, document: createEmptySchema("Billing") },
      { schemaId: SECOND_SCHEMA_ID, document: createEmptySchema("Shop") },
    ]);
    await expect(database.viewports.toArray()).resolves.toEqual([
      { schemaId: FIRST_SCHEMA_ID, x: 10, y: -20, zoom: 0.5 },
    ]);
  });

  it("sets ownerId, cloudRevision and syncStatus to null on upgraded records", async () => {
    const factory = new IDBFactory();
    await seedVersionOneDatabase(factory);
    const database = createDatabase(factory);

    const records = await database.schemas.toArray();

    expect(records).toEqual([
      {
        id: FIRST_SCHEMA_ID,
        name: "Billing",
        createdAt: 1,
        updatedAt: 2,
        ownerId: null,
        cloudRevision: null,
        syncStatus: null,
      },
      {
        id: SECOND_SCHEMA_ID,
        name: "Shop",
        createdAt: 3,
        updatedAt: 4,
        ownerId: null,
        cloudRevision: null,
        syncStatus: null,
      },
    ]);
  });

  it("keys documents and viewports by schemaId", async () => {
    const database = createDatabase();

    await database.open();
    const documents = readObjectStore(database, "documents");
    const viewports = readObjectStore(database, "viewports");

    expect(documents.keyPath).toBe("schemaId");
    expect(Array.from(documents.indexNames)).toEqual([]);
    expect(viewports.keyPath).toBe("schemaId");
    expect(Array.from(viewports.indexNames)).toEqual([]);
  });

  it("returns schema records ordered by updatedAt", async () => {
    const database = createDatabase();
    await database.schemas.bulkAdd([
      createSchemaRecord("b", 300),
      createSchemaRecord("a", 100),
      createSchemaRecord("c", 200),
    ]);

    const records = await database.schemas.orderBy("updatedAt").toArray();

    expect(records.map((record) => record.id)).toEqual(["a", "c", "b"]);
  });

  it("keeps databases on separate IDBFactory instances isolated", async () => {
    const firstDatabase = createDatabase();
    const secondDatabase = createDatabase();
    await firstDatabase.documents.put({ schemaId: "a", document: {} });

    const count = await secondDatabase.documents.count();

    expect(count).toBe(0);
  });

  it("fails to open with MissingAPIError when IndexedDB is unavailable", async () => {
    const database = new SchemaforgeDatabase();
    databases.add(database);

    await expect(database.open()).rejects.toMatchObject({
      name: "MissingAPIError",
    });
  });
});
