import { createEmptySchema, CURRENT_SCHEMA_VERSION } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { SchemaforgeDatabase } from "./database";
import { createSchemaRepository } from "./schema-repository";
import type { SchemaRepository } from "./schema-repository";

const ID_PREFIX = "00000000-0000-4000-8000-";
const ID_SUFFIX_LENGTH = 12;

// The repository never reads the clock or generates an id itself, so both are
// counters here and every expected timestamp is a small exact number.
function createCounterClock(): () => number {
  let now = 0;
  return () => {
    now += 1;
    return now;
  };
}

function createFixedIdGenerator(): () => string {
  let count = 0;
  return () => {
    count += 1;
    return schemaIdAt(count);
  };
}

function schemaIdAt(count: number): string {
  return `${ID_PREFIX}${String(count).padStart(ID_SUFFIX_LENGTH, "0")}`;
}

type Fixture = {
  readonly database: SchemaforgeDatabase;
  readonly repository: SchemaRepository;
};

describe("createSchemaRepository", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function setUp(): Fixture {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    return {
      database,
      repository: createSchemaRepository({
        database,
        clock: createCounterClock(),
        generateId: createFixedIdGenerator(),
      }),
    };
  }

  // Writes a row the typed tables would reject, so the repository can be shown
  // handling data that another version or another tab left behind.
  function putRawRow(
    database: SchemaforgeDatabase,
    tableName: string,
    row: unknown,
  ): Promise<unknown> {
    return database.table<unknown>(tableName).put(row);
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
  });

  it("creates a schema with an empty document and matching metadata", async () => {
    const { database, repository } = setUp();

    const record = await repository.createSchema("Billing");

    expect(record).toEqual({
      id: schemaIdAt(1),
      name: "Billing",
      createdAt: 1,
      updatedAt: 1,
    });
    await expect(database.documents.get(record.id)).resolves.toEqual({
      schemaId: record.id,
      document: createEmptySchema("Billing"),
    });
  });

  it("lists schemas from the most recently updated", async () => {
    const { repository } = setUp();
    await repository.createSchema("First");
    await repository.createSchema("Second");
    await repository.createSchema("Third");

    const entries = await repository.listSchemas();

    expect(entries).toEqual([
      {
        kind: "readable",
        schema: {
          id: schemaIdAt(3),
          name: "Third",
          createdAt: 3,
          updatedAt: 3,
        },
      },
      {
        kind: "readable",
        schema: {
          id: schemaIdAt(2),
          name: "Second",
          createdAt: 2,
          updatedAt: 2,
        },
      },
      {
        kind: "readable",
        schema: {
          id: schemaIdAt(1),
          name: "First",
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);
  });

  it("reports a schema row that does not parse as unreadable", async () => {
    const { database, repository } = setUp();
    await putRawRow(database, "schemas", {
      id: schemaIdAt(7),
      name: 42,
      createdAt: 1,
      updatedAt: 1,
    });

    const entries = await repository.listSchemas();

    expect(entries).toEqual([{ kind: "unreadable", schemaId: schemaIdAt(7) }]);
  });

  it("skips a schema row without a valid id", async () => {
    const { database, repository } = setUp();
    await putRawRow(database, "schemas", {
      id: "schema-1",
      name: "Legacy",
      createdAt: 1,
      updatedAt: 1,
    });

    const entries = await repository.listSchemas();

    expect(entries).toEqual([]);
  });

  it("opens a stored document through parseSchemaDocument", async () => {
    const { database, repository } = setUp();
    const document = createEmptySchema("Billing");
    await putRawRow(database, "documents", {
      schemaId: schemaIdAt(1),
      document,
    });

    const result = await repository.openSchema(schemaIdAt(1));

    expect(result).toEqual({ kind: "opened", document });
  });

  it("returns not-found for a schema id that was never stored", async () => {
    const { repository } = setUp();

    const result = await repository.openSchema(schemaIdAt(9));

    expect(result).toEqual({ kind: "not-found" });
  });

  it("returns unreadable with version-unsupported for a newer document version", async () => {
    const { database, repository } = setUp();
    await putRawRow(database, "documents", {
      schemaId: schemaIdAt(1),
      document: {
        ...createEmptySchema("Billing"),
        version: CURRENT_SCHEMA_VERSION + 1,
      },
    });

    const result = await repository.openSchema(schemaIdAt(1));

    expect(result).toEqual({
      kind: "unreadable",
      errors: [{ code: "version-unsupported", path: ["version"] }],
    });
  });

  it("returns unreadable for a structurally invalid document", async () => {
    const { database, repository } = setUp();
    await putRawRow(database, "documents", {
      schemaId: schemaIdAt(1),
      document: { ...createEmptySchema("Billing"), name: 42 },
    });

    const result = await repository.openSchema(schemaIdAt(1));

    expect(result).toEqual({
      kind: "unreadable",
      errors: [{ code: "invalid-shape", path: ["name"] }],
    });
  });

  it("never overwrites a document it could not parse", async () => {
    const { database, repository } = setUp();
    const brokenDocument = { version: CURRENT_SCHEMA_VERSION };
    await putRawRow(database, "documents", {
      schemaId: schemaIdAt(1),
      document: brokenDocument,
    });

    await repository.openSchema(schemaIdAt(1));

    await expect(database.documents.get(schemaIdAt(1))).resolves.toEqual({
      schemaId: schemaIdAt(1),
      document: brokenDocument,
    });
  });

  it("saves a document and updates the name and updatedAt together", async () => {
    const { database, repository } = setUp();
    const record = await repository.createSchema("Billing");
    const document: SchemaDocument = createEmptySchema("Invoices");

    await repository.saveDocument(record.id, document);

    await expect(database.schemas.get(record.id)).resolves.toEqual({
      id: record.id,
      name: "Invoices",
      createdAt: 1,
      updatedAt: 2,
    });
    await expect(database.documents.get(record.id)).resolves.toEqual({
      schemaId: record.id,
      document,
    });
  });

  it("keeps working when saving a document whose metadata row is gone", async () => {
    const { database, repository } = setUp();
    const record = await repository.createSchema("Billing");
    await database.schemas.delete(record.id);

    await expect(
      repository.saveDocument(record.id, createEmptySchema("Invoices")),
    ).resolves.toBeUndefined();

    await expect(database.schemas.get(record.id)).resolves.toBeUndefined();
    await expect(database.documents.get(record.id)).resolves.toEqual({
      schemaId: record.id,
      document: createEmptySchema("Invoices"),
    });
  });

  it("renames a schema through the renameSchema operation", async () => {
    const { database, repository } = setUp();
    const record = await repository.createSchema("Billing");

    const result = await repository.renameSchema(record.id, "Invoices");

    expect(result).toEqual({ kind: "renamed" });
    await expect(database.documents.get(record.id)).resolves.toEqual({
      schemaId: record.id,
      document: createEmptySchema("Invoices"),
    });
    await expect(database.schemas.get(record.id)).resolves.toEqual({
      id: record.id,
      name: "Invoices",
      createdAt: 1,
      updatedAt: 2,
    });
  });

  it("refuses to rename a schema whose document does not parse", async () => {
    const { database, repository } = setUp();
    const record = await repository.createSchema("Billing");
    await putRawRow(database, "documents", {
      schemaId: record.id,
      document: { version: CURRENT_SCHEMA_VERSION },
    });

    const result = await repository.renameSchema(record.id, "Invoices");

    expect(result).toEqual({ kind: "unreadable" });
    await expect(database.schemas.get(record.id)).resolves.toEqual({
      id: record.id,
      name: "Billing",
      createdAt: 1,
      updatedAt: 1,
    });
  });

  it("returns not-found when renaming a schema that was never stored", async () => {
    const { repository } = setUp();

    const result = await repository.renameSchema(schemaIdAt(9), "Invoices");

    expect(result).toEqual({ kind: "not-found" });
  });

  it("deletes the schema, document and viewport rows", async () => {
    const { database, repository } = setUp();
    const record = await repository.createSchema("Billing");
    await repository.saveViewport({
      schemaId: record.id,
      x: 10,
      y: 20,
      zoom: 1,
    });

    await repository.deleteSchema(record.id);

    await expect(database.schemas.count()).resolves.toBe(0);
    await expect(database.documents.count()).resolves.toBe(0);
    await expect(database.viewports.count()).resolves.toBe(0);
  });

  it("stores a viewport without touching updatedAt", async () => {
    const { database, repository } = setUp();
    const record = await repository.createSchema("Billing");
    const viewport = { schemaId: record.id, x: -120.5, y: 40, zoom: 0.75 };

    await repository.saveViewport(viewport);

    await expect(repository.readViewport(record.id)).resolves.toEqual(viewport);
    await expect(database.schemas.get(record.id)).resolves.toMatchObject({
      updatedAt: 1,
    });
  });

  it("returns null for a viewport row with an invalid shape", async () => {
    const { database, repository } = setUp();
    await putRawRow(database, "viewports", {
      schemaId: schemaIdAt(1),
      x: 0,
      y: 0,
      zoom: 0,
    });

    await expect(repository.readViewport(schemaIdAt(1))).resolves.toBeNull();
  });

  it("returns null for a viewport that was never stored", async () => {
    const { repository } = setUp();

    await expect(repository.readViewport(schemaIdAt(9))).resolves.toBeNull();
  });
});
