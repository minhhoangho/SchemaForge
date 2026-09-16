import { render, screen } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBrowserStorage } from "./create-browser-storage";
import type * as CreateBrowserStorageModule from "./create-browser-storage";
import type { StorageBundle } from "./create-browser-storage";
import { SchemaforgeDatabase } from "./database";
import { createSchemaLockManager } from "./schema-lock-manager";
import { createSchemaRepository } from "./schema-repository";
import { StorageProvider, useStorage } from "./storage-context";

vi.mock("./create-browser-storage", () => ({
  createBrowserStorage: vi.fn<() => StorageBundle>(),
}));

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";

function createTestStorage(database: SchemaforgeDatabase): StorageBundle {
  return {
    database,
    repository: createSchemaRepository({
      database,
      clock: () => 1,
      generateId: () => SCHEMA_ID,
    }),
    lockManager: createSchemaLockManager(() => Promise.resolve()),
  };
}

function StorageStateView(): JSX.Element {
  const state = useStorage();
  return <p>{state.kind === "unavailable" ? state.errorCode : state.kind}</p>;
}

describe("StorageProvider", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function createDatabase(): SchemaforgeDatabase {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    return database;
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
    vi.mocked(createBrowserStorage).mockReset();
  });

  it("exposes the storage passed as a prop", async () => {
    const storage = createTestStorage(createDatabase());

    render(
      <StorageProvider storage={storage}>
        <StorageStateView />
      </StorageProvider>,
    );

    await screen.findByText("ready");
    expect(createBrowserStorage).not.toHaveBeenCalled();
  });

  it("reports unavailable when creating browser storage throws", async () => {
    vi.mocked(createBrowserStorage).mockImplementation(() => {
      throw new Error("IndexedDB is blocked.");
    });

    render(
      <StorageProvider>
        <StorageStateView />
      </StorageProvider>,
    );

    expect(await screen.findByText("unknown")).toBeDefined();
  });

  it("maps a MissingAPIError to the unavailable storage code", async () => {
    vi.mocked(createBrowserStorage).mockImplementation(() => {
      const error = new Error("IndexedDB API is missing.");
      error.name = "MissingAPIError";
      throw error;
    });

    render(
      <StorageProvider>
        <StorageStateView />
      </StorageProvider>,
    );

    expect(await screen.findByText("unavailable")).toBeDefined();
  });

  it("closes the database it created when the provider unmounts", async () => {
    const database = createDatabase();
    await database.open();
    vi.mocked(createBrowserStorage).mockReturnValue(
      createTestStorage(database),
    );
    const view = render(
      <StorageProvider>
        <StorageStateView />
      </StorageProvider>,
    );
    await screen.findByText("ready");

    view.unmount();

    expect(database.isOpen()).toBe(false);
  });
});

describe("useStorage", () => {
  it("throws when useStorage is used outside the provider", () => {
    expect(() => render(<StorageStateView />)).toThrow(
      "useStorage must be used inside a StorageProvider.",
    );
  });
});

describe("createBrowserStorage", () => {
  beforeEach(() => {
    // jsdom has no Web Locks API, and createBrowserSchemaLockManager refuses to
    // build a manager without it.
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: () => Promise.resolve() },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("builds a repository, a lock manager and a database", async () => {
    const actual = await vi.importActual<typeof CreateBrowserStorageModule>(
      "./create-browser-storage",
    );

    const storage = actual.createBrowserStorage();
    storage.database.close();

    expect(storage.database).toBeInstanceOf(SchemaforgeDatabase);
    expect(typeof storage.repository.listSchemas).toBe("function");
    expect(typeof storage.lockManager.tryAcquire).toBe("function");
  });
});
