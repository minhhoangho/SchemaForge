import { createEmptySchema } from "@schemaforge/core";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { createCloudCache } from "./cloud-cache";
import type { CloudCache } from "./cloud-cache";
import { SchemaforgeDatabase } from "./database";
import type {
  CloudSchemaRecord,
  LocalSchemaRecord,
  SchemaRecord,
} from "./records";

const FIRST_SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_SCHEMA_ID = "00000000-0000-4000-8000-000000000002";
const THIRD_SCHEMA_ID = "00000000-0000-4000-8000-000000000003";
const FOURTH_SCHEMA_ID = "00000000-0000-4000-8000-000000000004";
const OWNER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OTHER_OWNER_ID = "6a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

type Fixture = {
  readonly database: SchemaforgeDatabase;
  readonly cloudCache: CloudCache;
};

function createLocalRecord(
  id: string,
  overrides: Partial<LocalSchemaRecord> = {},
): LocalSchemaRecord {
  return {
    id,
    name: "Billing",
    createdAt: 1,
    updatedAt: 1,
    ownerId: null,
    cloudRevision: null,
    syncStatus: null,
    ...overrides,
  };
}

function createOwnedRecord(
  id: string,
  overrides: Partial<CloudSchemaRecord> = {},
): CloudSchemaRecord {
  return {
    ...createLocalRecord(id),
    ownerId: OWNER_ID,
    cloudRevision: 2,
    syncStatus: "synced",
    ...overrides,
  };
}

describe("createCloudCache", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function setUp(): Fixture {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    return { database, cloudCache: createCloudCache(database) };
  }

  async function seedSchema(
    database: SchemaforgeDatabase,
    record: SchemaRecord,
  ): Promise<void> {
    await database.schemas.put(record);
    await database.documents.put({
      schemaId: record.id,
      document: createEmptySchema(record.name),
    });
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
  });

  it("reads a stored schema record", async () => {
    const { database, cloudCache } = setUp();
    const record = createOwnedRecord(FIRST_SCHEMA_ID);
    await seedSchema(database, record);

    await expect(cloudCache.readSchemaRecord(FIRST_SCHEMA_ID)).resolves.toEqual(
      record,
    );
  });

  it("returns null when reading a schema record with an invalid shape", async () => {
    const { database, cloudCache } = setUp();
    await database
      .table<unknown>("schemas")
      .put({ ...createOwnedRecord(FIRST_SCHEMA_ID), syncStatus: null });

    await expect(
      cloudCache.readSchemaRecord(FIRST_SCHEMA_ID),
    ).resolves.toBeNull();
  });

  it("lists only the schemas of the given owner, newest first", async () => {
    const { database, cloudCache } = setUp();
    await seedSchema(database, createOwnedRecord(FIRST_SCHEMA_ID));
    await seedSchema(
      database,
      createOwnedRecord(SECOND_SCHEMA_ID, { updatedAt: 5 }),
    );
    await seedSchema(
      database,
      createOwnedRecord(THIRD_SCHEMA_ID, { ownerId: OTHER_OWNER_ID }),
    );
    await seedSchema(database, createLocalRecord(FOURTH_SCHEMA_ID));

    const records = await cloudCache.listOwnedSchemas(OWNER_ID);

    expect(records.map((record) => record.id)).toEqual([
      SECOND_SCHEMA_ID,
      FIRST_SCHEMA_ID,
    ]);
  });

  it("leaves out owned records that do not parse", async () => {
    const { database, cloudCache } = setUp();
    await database
      .table<unknown>("schemas")
      .put({ ...createOwnedRecord(FIRST_SCHEMA_ID), cloudRevision: 0 });

    await expect(cloudCache.listOwnedSchemas(OWNER_ID)).resolves.toEqual([]);
  });

  it("writes a cloud copy as synced with its revision and document", async () => {
    const { database, cloudCache } = setUp();
    const document = createEmptySchema("Invoices");
    await database.viewports.put({
      schemaId: FIRST_SCHEMA_ID,
      x: 1,
      y: 2,
      zoom: 1,
    });

    await cloudCache.writeCloudCopy({
      id: FIRST_SCHEMA_ID,
      ownerId: OWNER_ID,
      document,
      revision: 7,
      createdAt: 10,
      updatedAt: 20,
    });

    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toEqual({
      id: FIRST_SCHEMA_ID,
      name: "Invoices",
      createdAt: 10,
      updatedAt: 20,
      ownerId: OWNER_ID,
      cloudRevision: 7,
      syncStatus: "synced",
    });
    await expect(database.documents.get(FIRST_SCHEMA_ID)).resolves.toEqual({
      schemaId: FIRST_SCHEMA_ID,
      document,
    });
    await expect(database.viewports.get(FIRST_SCHEMA_ID)).resolves.toEqual({
      schemaId: FIRST_SCHEMA_ID,
      x: 1,
      y: 2,
      zoom: 1,
    });
  });

  it("completes a push as synced when the record did not change while sending", async () => {
    const { database, cloudCache } = setUp();
    await seedSchema(
      database,
      createOwnedRecord(FIRST_SCHEMA_ID, {
        cloudRevision: null,
        syncStatus: "pending",
        updatedAt: 4,
      }),
    );

    const result = await cloudCache.completePush(FIRST_SCHEMA_ID, {
      revision: 1,
      sentUpdatedAt: 4,
    });

    expect(result).toBe("synced");
    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toMatchObject({
      cloudRevision: 1,
      syncStatus: "synced",
      updatedAt: 4,
    });
  });

  it("keeps a push pending when the record changed while sending", async () => {
    const { database, cloudCache } = setUp();
    await seedSchema(
      database,
      createOwnedRecord(FIRST_SCHEMA_ID, {
        cloudRevision: 1,
        syncStatus: "pending",
        updatedAt: 6,
      }),
    );

    const result = await cloudCache.completePush(FIRST_SCHEMA_ID, {
      revision: 2,
      sentUpdatedAt: 4,
    });

    expect(result).toBe("pending");
    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toMatchObject({
      cloudRevision: 2,
      syncStatus: "pending",
    });
  });

  it("returns not-found when completing a push for a deleted schema", async () => {
    const { database, cloudCache } = setUp();

    const result = await cloudCache.completePush(FIRST_SCHEMA_ID, {
      revision: 2,
      sentUpdatedAt: 4,
    });

    expect(result).toBe("not-found");
    await expect(database.schemas.count()).resolves.toBe(0);
  });

  it("returns not-found when completing a push for a local schema", async () => {
    const { database, cloudCache } = setUp();
    const record = createLocalRecord(FIRST_SCHEMA_ID);
    await seedSchema(database, record);

    const result = await cloudCache.completePush(FIRST_SCHEMA_ID, {
      revision: 2,
      sentUpdatedAt: 1,
    });

    expect(result).toBe("not-found");
    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toEqual(
      record,
    );
  });

  it("returns not-found when setting the sync state of a local schema", async () => {
    const { database, cloudCache } = setUp();
    const record = createLocalRecord(FIRST_SCHEMA_ID);
    await seedSchema(database, record);

    const result = await cloudCache.setSyncState(FIRST_SCHEMA_ID, {
      cloudRevision: 5,
      syncStatus: "conflict",
    });

    expect(result).toBe("not-found");
    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toEqual(
      record,
    );
  });

  it("sets the sync state of an owned schema", async () => {
    const { database, cloudCache } = setUp();
    await seedSchema(database, createOwnedRecord(FIRST_SCHEMA_ID));

    const result = await cloudCache.setSyncState(FIRST_SCHEMA_ID, {
      cloudRevision: 5,
      syncStatus: "conflict",
    });

    expect(result).toBe("updated");
    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toEqual(
      createOwnedRecord(FIRST_SCHEMA_ID, {
        cloudRevision: 5,
        syncStatus: "conflict",
      }),
    );
  });

  it("returns not-found when setting the sync state of a missing schema", async () => {
    const { cloudCache } = setUp();

    const result = await cloudCache.setSyncState(FIRST_SCHEMA_ID, {
      cloudRevision: 5,
      syncStatus: "conflict",
    });

    expect(result).toBe("not-found");
  });

  it("assigns an owner to a local schema", async () => {
    const { database, cloudCache } = setUp();
    await seedSchema(database, createLocalRecord(FIRST_SCHEMA_ID));

    const result = await cloudCache.assignOwner(FIRST_SCHEMA_ID, {
      ownerId: OWNER_ID,
      cloudRevision: 1,
      syncStatus: "synced",
    });

    expect(result).toBe("assigned");
    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toEqual(
      createOwnedRecord(FIRST_SCHEMA_ID, { cloudRevision: 1 }),
    );
  });

  it("refuses to assign an owner to a schema that already has one", async () => {
    const { database, cloudCache } = setUp();
    const record = createOwnedRecord(FIRST_SCHEMA_ID, {
      ownerId: OTHER_OWNER_ID,
    });
    await seedSchema(database, record);

    const result = await cloudCache.assignOwner(FIRST_SCHEMA_ID, {
      ownerId: OWNER_ID,
      cloudRevision: 1,
      syncStatus: "conflict",
    });

    expect(result).toBe("already-owned");
    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toEqual(
      record,
    );
  });

  it("returns not-found when assigning an owner to a missing schema", async () => {
    const { cloudCache } = setUp();

    const result = await cloudCache.assignOwner(FIRST_SCHEMA_ID, {
      ownerId: OWNER_ID,
      cloudRevision: 1,
      syncStatus: "synced",
    });

    expect(result).toBe("not-found");
  });

  it("moves a schema, its document and its viewport to a new id", async () => {
    const { database, cloudCache } = setUp();
    const record = createLocalRecord(FIRST_SCHEMA_ID);
    await seedSchema(database, record);
    await database.viewports.put({
      schemaId: FIRST_SCHEMA_ID,
      x: 3,
      y: 4,
      zoom: 2,
    });

    const result = await cloudCache.changeSchemaId(
      FIRST_SCHEMA_ID,
      SECOND_SCHEMA_ID,
    );

    expect(result).toBe("moved");
    await expect(database.schemas.toArray()).resolves.toEqual([
      { ...record, id: SECOND_SCHEMA_ID },
    ]);
    await expect(database.documents.toArray()).resolves.toEqual([
      { schemaId: SECOND_SCHEMA_ID, document: createEmptySchema("Billing") },
    ]);
    await expect(database.viewports.toArray()).resolves.toEqual([
      { schemaId: SECOND_SCHEMA_ID, x: 3, y: 4, zoom: 2 },
    ]);
  });

  it("refuses to move a schema onto an id that is taken", async () => {
    const { database, cloudCache } = setUp();
    await seedSchema(database, createLocalRecord(FIRST_SCHEMA_ID));
    await seedSchema(
      database,
      createLocalRecord(SECOND_SCHEMA_ID, { name: "Shop" }),
    );

    const result = await cloudCache.changeSchemaId(
      FIRST_SCHEMA_ID,
      SECOND_SCHEMA_ID,
    );

    expect(result).toBe("id-taken");
    await expect(database.schemas.count()).resolves.toBe(2);
    await expect(database.documents.get(SECOND_SCHEMA_ID)).resolves.toEqual({
      schemaId: SECOND_SCHEMA_ID,
      document: createEmptySchema("Shop"),
    });
  });

  it("returns not-found when moving a schema that was never stored", async () => {
    const { cloudCache } = setUp();

    const result = await cloudCache.changeSchemaId(
      FIRST_SCHEMA_ID,
      SECOND_SCHEMA_ID,
    );

    expect(result).toBe("not-found");
  });

  it("rejects a new schema id that is not a lowercase UUID", async () => {
    const { database, cloudCache } = setUp();
    await seedSchema(database, createLocalRecord(FIRST_SCHEMA_ID));

    await expect(
      cloudCache.changeSchemaId(FIRST_SCHEMA_ID, "schema-2"),
    ).rejects.toThrow(Error);
    await expect(database.schemas.get(FIRST_SCHEMA_ID)).resolves.toBeDefined();
  });
});
