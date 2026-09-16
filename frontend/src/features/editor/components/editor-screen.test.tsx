import { createEmptySchema, CURRENT_SCHEMA_VERSION } from "@schemaforge/core";
import { act, screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createBrowserStorage } from "@/lib/storage/create-browser-storage";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import type { SchemaRecord } from "@/lib/storage/records";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaLock } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { EditorScreenLoader } from "./editor-screen-loader";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn<() => void>() }),
}));

// Only the unavailable-storage test renders StorageProvider without a storage
// prop; every other test injects storage built on fake-indexeddb.
vi.mock("@/lib/storage/create-browser-storage", () => ({
  createBrowserStorage: vi.fn<() => StorageBundle>(),
}));

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const MISSING_SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-000000000000";
const MEASURED_SIZE = { inlineSize: 1000, blockSize: 800 };

// jsdom's ResizeObserver stub never reports, so React Flow would keep every
// node hidden as unmeasured; this one reports each element once, right away.
class MeasuringResizeObserver implements ResizeObserver {
  readonly #callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    this.#callback(
      [
        {
          target,
          contentRect: new DOMRect(0, 0, 1000, 800),
          borderBoxSize: [MEASURED_SIZE],
          contentBoxSize: [MEASURED_SIZE],
          devicePixelContentBoxSize: [MEASURED_SIZE],
        },
      ],
      this,
    );
  }

  unobserve(): void {
    // Nothing is watched after the first report.
  }

  disconnect(): void {
    // Nothing is watched after the first report.
  }
}

describe("EditorScreen", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function createStorage(): StorageBundle {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    return {
      database,
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
      repository: createSchemaRepository({
        database,
        clock: () => 1,
        generateId: () => SCHEMA_ID,
      }),
    };
  }

  async function holdInOtherTab(storage: StorageBundle): Promise<SchemaLock> {
    const lock = await storage.lockManager.tryAcquire(SCHEMA_ID);
    if (lock === null) {
      throw new Error("The other tab could not take the lock.");
    }
    return lock;
  }

  // Rows the current release would never write, stored as they are.
  function putRawDocument(
    storage: StorageBundle,
    document: unknown,
  ): Promise<unknown> {
    return storage.database
      .table<unknown>("documents")
      .put({ schemaId: SCHEMA_ID, document });
  }

  function renderScreen(
    storage: StorageBundle | undefined,
    schemaId: string = SCHEMA_ID,
    themePreference: "light" | "dark" = "light",
  ): ReturnType<typeof renderWithProviders> {
    return renderWithProviders(
      <StorageProvider storage={storage}>
        <EditorScreenLoader schemaId={schemaId} />
      </StorageProvider>,
      { locale: "en", themePreference },
    );
  }

  function createSchema(
    storage: StorageBundle,
    name = "Billing",
  ): Promise<SchemaRecord> {
    return storage.repository.createSchema(name);
  }

  beforeAll(async () => {
    // The screen renders through its loader, which imports the editor screen
    // on demand. Loading it once up front keeps that import from outlasting a
    // findBy timeout while the module graph is transformed.
    await import("./editor-screen");
  });

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MeasuringResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
  });

  it("shows a skeleton while the lock is being acquired", async () => {
    const storage = createStorage();
    await createSchema(storage);

    renderScreen(storage);

    expect({
      statusText: screen.getByRole("status").textContent,
      hasEditor: screen.queryByRole("button", { name: "Zoom in" }) !== null,
    }).toEqual({ statusText: "Opening the schema…", hasEditor: false });
  });

  it("keeps one loading status mounted until the schema is open", async () => {
    const storage = createStorage();
    await createSchema(storage);
    renderScreen(storage);
    const loadingStatus = screen.getByText("Opening the schema…");

    await screen.findByRole("button", { name: "Zoom in" });

    expect({
      isSameStatus: loadingStatus.isConnected,
      statusText: loadingStatus.textContent,
    }).toEqual({ isSameStatus: true, statusText: "" });
  });

  it("stops the loading status and focuses the heading of a state that replaces the skeleton", async () => {
    renderScreen(createStorage(), MISSING_SCHEMA_ID);

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Schema not found",
    });
    await waitFor(() => {
      expect(screen.queryByText("Opening the schema…")).toBeNull();
    });

    expect(document.activeElement).toBe(heading);
  });

  it("shows the not found state for a schema that was never stored", async () => {
    renderScreen(createStorage(), MISSING_SCHEMA_ID);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Schema not found",
      }),
    ).toBeDefined();
  });

  it("shows the locked state while another tab holds the lock", async () => {
    const storage = createStorage();
    await createSchema(storage);
    await holdInOtherTab(storage);

    renderScreen(storage);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "This schema is open in another tab",
      }),
    ).toBeDefined();
  });

  it("opens the editor after the other tab releases the lock", async () => {
    const storage = createStorage();
    await createSchema(storage);
    const lock = await holdInOtherTab(storage);
    renderScreen(storage);
    await screen.findByRole("heading", {
      name: "This schema is open in another tab",
    });

    // The other tab saves one last change before it lets go.
    await storage.repository.saveDocument(
      SCHEMA_ID,
      createEmptySchema("Invoices"),
    );
    act(() => {
      lock.release();
    });

    expect(await screen.findByText("Invoices")).toBeDefined();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("shows the unsupported version message for a newer document", async () => {
    const storage = createStorage();
    await putRawDocument(storage, {
      ...createEmptySchema("Billing"),
      version: CURRENT_SCHEMA_VERSION + 1,
    });

    renderScreen(storage);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "This schema needs a newer version of SchemaForge",
      }),
    ).toBeDefined();
  });

  it("shows the unreadable message for a corrupt document", async () => {
    const storage = createStorage();
    await putRawDocument(storage, {
      ...createEmptySchema("Billing"),
      name: 42,
    });

    renderScreen(storage);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "The schema data is damaged",
      }),
    ).toBeDefined();
  });

  it("never overwrites a document it could not read", async () => {
    const storage = createStorage();
    const brokenDocument = { version: CURRENT_SCHEMA_VERSION };
    await putRawDocument(storage, brokenDocument);

    const { unmount } = renderScreen(storage);
    await screen.findByRole("heading", { name: "The schema data is damaged" });
    unmount();

    await expect(storage.database.documents.get(SCHEMA_ID)).resolves.toEqual({
      schemaId: SCHEMA_ID,
      document: brokenDocument,
    });
  });

  it("shows the storage message when storage is unavailable", async () => {
    const error = new Error("IndexedDB API is missing.");
    error.name = "MissingAPIError";
    vi.mocked(createBrowserStorage).mockImplementation(() => {
      throw error;
    });

    renderScreen(undefined);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Storage is unavailable",
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Your browser does not allow local storage, for example in private mode.",
      ),
    ).toBeDefined();
  });

  it("renders the toolbar and the canvas once the schema is open", async () => {
    const storage = createStorage();
    await createSchema(storage);

    renderScreen(storage);

    await screen.findByRole("button", { name: "Zoom in" });

    expect({
      hasCanvas: screen.queryByRole("application") !== null,
      hasEmptyState:
        screen.queryByText("This schema has no tables yet") !== null,
    }).toEqual({ hasCanvas: true, hasEmptyState: true });
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const storage = createStorage();
      await createSchema(storage);
      const { container } = renderScreen(storage, SCHEMA_ID, themePreference);
      await screen.findByRole("button", { name: "Zoom in" });

      await expectNoAxeViolations(container);
    },
  );
});
