import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { DATABASE_NAME, SchemaforgeDatabase } from "./database";
import type { SchemaRecord } from "./records";

function createSchemaRecord(id: string, updatedAt: number): SchemaRecord {
  return { id, name: `Schema ${id}`, createdAt: 0, updatedAt };
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

  it("creates the schemaforge database with schemas, documents and viewports tables", async () => {
    const database = createDatabase();

    await database.open();

    expect(database.name).toBe(DATABASE_NAME);
    expect(DATABASE_NAME).toBe("schemaforge");
    expect(database.verno).toBe(1);
    expect(Array.from(database.backendDB().objectStoreNames)).toEqual([
      "documents",
      "schemas",
      "viewports",
    ]);
  });

  it("keys schemas by id and indexes them by updatedAt", async () => {
    const database = createDatabase();

    await database.open();
    const schemas = readObjectStore(database, "schemas");

    expect(schemas.keyPath).toBe("id");
    expect(schemas.autoIncrement).toBe(false);
    expect(Array.from(schemas.indexNames)).toEqual(["updatedAt"]);
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
