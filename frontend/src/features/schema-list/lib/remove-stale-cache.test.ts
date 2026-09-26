import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";

import { removeStaleCache } from "./remove-stale-cache";

const ID_PREFIX = "00000000-0000-4000-8000-";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

type Fixture = {
  readonly database: SchemaforgeDatabase;
  readonly repository: SchemaRepository;
  readonly lockManager: SchemaLockManager;
  readonly otherTab: SchemaLockManager;
};

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  vi.restoreAllMocks();
});

function setUp(): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  const registry = createFakeLockRegistry();
  let count = 0;
  return {
    database,
    repository: createSchemaRepository({
      database,
      clock: () => 1,
      generateId: () => {
        count += 1;
        return `${ID_PREFIX}${String(count).padStart(12, "0")}`;
      },
    }),
    lockManager: createSchemaLockManager(registry.request),
    otherTab: createSchemaLockManager(registry.request),
  };
}

async function countRows(
  database: SchemaforgeDatabase,
  schemaId: string,
): Promise<readonly number[]> {
  return Promise.all([
    database.schemas.where("id").equals(schemaId).count(),
    database.documents.where("schemaId").equals(schemaId).count(),
    database.viewports.where("schemaId").equals(schemaId).count(),
  ]);
}

describe("removeStaleCache", () => {
  it("removes a stale schema from the three tables", async () => {
    const { database, repository, lockManager } = setUp();
    const { id } = await repository.createSchema("shop", { ownerId: USER_ID });
    await repository.saveViewport({ schemaId: id, x: 0, y: 0, zoom: 1 });

    await removeStaleCache({ schemaIds: [id], repository, lockManager });

    expect(await countRows(database, id)).toEqual([0, 0, 0]);
  });

  it("skips a schema whose lock is taken", async () => {
    const { repository, lockManager, otherTab } = setUp();
    const { id } = await repository.createSchema("shop", { ownerId: USER_ID });
    await otherTab.tryAcquire(id);

    await removeStaleCache({ schemaIds: [id], repository, lockManager });

    expect(await repository.readSchemaRecord(id)).not.toBeNull();
  });

  it("goes on with the next id after a failure", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const { repository, lockManager } = setUp();
    const first = await repository.createSchema("shop", { ownerId: USER_ID });
    const second = await repository.createSchema("blog", { ownerId: USER_ID });
    const failure = new Error("The database was closed.");
    failure.name = "DatabaseClosedError";
    const failingOnFirst: SchemaRepository = {
      ...repository,
      deleteSchema: (schemaId) =>
        schemaId === first.id
          ? Promise.reject(failure)
          : repository.deleteSchema(schemaId),
    };

    await removeStaleCache({
      schemaIds: [first.id, second.id],
      repository: failingOnFirst,
      lockManager,
    });

    expect({
      second: await repository.readSchemaRecord(second.id),
      warning: vi.mocked(logger.warn).mock.calls[0],
    }).toEqual({
      second: null,
      warning: [
        "schema-list.remove-stale-cache-failed",
        { errorName: "DatabaseClosedError" },
      ],
    });
  });
});
