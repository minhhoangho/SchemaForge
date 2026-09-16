import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { renderToString } from "react-dom/server";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { I18nProvider } from "@/components/i18n-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n/supported-locales";
import { logger } from "@/lib/logger";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { createBrowserStorage } from "@/lib/storage/create-browser-storage";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import type { FakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { SchemaListScreen } from "./schema-list-screen";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  refresh: vi.fn<() => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

// Only the unavailable-storage tests render StorageProvider without a storage
// prop; every other test injects storage built on fake-indexeddb.
vi.mock("@/lib/storage/create-browser-storage", () => ({
  createBrowserStorage: vi.fn<() => StorageBundle>(),
}));

const ID_PREFIX = "00000000-0000-4000-8000-";
const ID_SUFFIX_LENGTH = 12;
const FIRST_SCHEMA_ID = `${ID_PREFIX}${"1".padStart(ID_SUFFIX_LENGTH, "0")}`;

type Fixture = {
  readonly storage: StorageBundle;
  readonly registry: FakeLockRegistry;
};

type RenderOptions = {
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
};

// The repository never reads the clock or generates an id itself, so both are
// counters here and the update times are small exact numbers.
function createCounter(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

function createMissingApiError(): Error {
  const error = new Error("IndexedDB API is missing.");
  error.name = "MissingAPIError";
  return error;
}

describe("SchemaListScreen", () => {
  const databases = new Set<SchemaforgeDatabase>();

  beforeAll(() => {
    // liveQuery skips every query while Dexie finds no global IndexedDB, and
    // jsdom has none; each database below still gets its own factory.
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  function setUp(): Fixture {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    const registry = createFakeLockRegistry();
    const nextId = createCounter();
    return {
      registry,
      storage: {
        database,
        lockManager: createSchemaLockManager(registry.request),
        repository: createSchemaRepository({
          database,
          clock: createCounter(),
          generateId: () =>
            `${ID_PREFIX}${String(nextId()).padStart(ID_SUFFIX_LENGTH, "0")}`,
        }),
      },
    };
  }

  function renderScreen(
    storage: StorageBundle | undefined,
    options: RenderOptions = {},
  ): ReturnType<typeof renderWithProviders> {
    return renderWithProviders(
      <StorageProvider storage={storage}>
        <SchemaListScreen />
      </StorageProvider>,
      { locale: "en", ...options },
    );
  }

  async function openRowMenu(user: UserEvent, name: string): Promise<void> {
    await user.click(
      await screen.findByRole("button", { name: `Actions for ${name}` }),
    );
    await screen.findByRole("menu");
  }

  beforeEach(() => {
    push.mockClear();
  });

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
    vi.mocked(createBrowserStorage).mockReset();
    vi.restoreAllMocks();
  });

  it("shows a skeleton while storage is pending", () => {
    // Server rendering runs no effect, so storage stays pending exactly as it
    // does in the HTML the server sends.
    function ServerTree(): JSX.Element {
      return (
        <I18nProvider locale="en">
          <ThemeProvider initialPreference="light">
            <TooltipProvider>
              <StorageProvider>
                <SchemaListScreen />
              </StorageProvider>
            </TooltipProvider>
          </ThemeProvider>
        </I18nProvider>
      );
    }
    const container = document.createElement("div");

    container.innerHTML = renderToString(<ServerTree />);

    const status = within(container).getByRole("status");
    expect(status.textContent).toBe("Loading your schemas…");
    expect(within(container).queryByRole("list")).toBeNull();
    expect(createBrowserStorage).not.toHaveBeenCalled();
  });

  it("shows the empty state when there is no schema", async () => {
    renderScreen(setUp().storage);

    expect(await screen.findByText("No schemas yet")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Create your first schema" }),
    ).toBeDefined();
  });

  it("lists schemas from the most recently updated", async () => {
    const { storage } = setUp();
    await storage.repository.createSchema("shop");
    await storage.repository.createSchema("blog");

    renderScreen(storage);

    const list = await screen.findByRole("list");
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["blog", "shop"]);
  });

  it("formats the update time with the active locale", async () => {
    const { storage } = setUp();
    const record = await storage.repository.createSchema("shop");
    const expectedTime = new Intl.DateTimeFormat("vi", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(record.updatedAt);

    renderScreen(storage, { locale: "vi" });

    expect(
      await screen.findByText(`Cập nhật lúc ${expectedTime}`),
    ).toBeDefined();
  });

  it("creates a schema and navigates to its editor", async () => {
    const { storage } = setUp();
    const { user } = renderScreen(storage);
    await screen.findByText("No schemas yet");

    await user.click(screen.getByRole("button", { name: "Create schema" }));
    await user.type(screen.getByLabelText("Name"), "shop{Enter}");

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/schemas/${FIRST_SCHEMA_ID}`);
    });
    const entries = await storage.repository.listSchemas();
    expect(entries).toHaveLength(1);
  });

  it("refuses to create a schema with a blank name", async () => {
    const { storage } = setUp();
    const { user } = renderScreen(storage);
    await screen.findByText("No schemas yet");

    await user.click(screen.getByRole("button", { name: "Create schema" }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByText("Enter a name.")).toBeDefined();
    expect(push).not.toHaveBeenCalled();
    expect(await storage.repository.listSchemas()).toEqual([]);
  });

  it("renames a schema from the row menu", async () => {
    const { storage } = setUp();
    await storage.repository.createSchema("shop");
    const { user } = renderScreen(storage);

    await openRowMenu(user, "shop");
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const field = await screen.findByLabelText("Name");
    await user.clear(field);
    await user.type(field, "orders{Enter}");

    expect(await screen.findByRole("link", { name: "orders" })).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Actions for orders" }),
      );
    });
  });

  it("asks for confirmation before deleting a schema", async () => {
    const { storage } = setUp();
    await storage.repository.createSchema("shop");
    const { user } = renderScreen(storage);

    await openRowMenu(user, "shop");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const confirmation = await screen.findByRole("alertdialog", {
      name: "Delete “shop”?",
    });
    expect(await storage.repository.listSchemas()).toHaveLength(1);
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete" }),
    );

    expect(await screen.findByText("No schemas yet")).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1 }),
    );
  });

  it("shows a toast when the schema is open in another tab", async () => {
    const { storage, registry } = setUp();
    await storage.repository.createSchema("shop");
    await createSchemaLockManager(registry.request).tryAcquire(FIRST_SCHEMA_ID);
    const { user } = renderScreen(storage);

    await openRowMenu(user, "shop");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    expect(
      await screen.findByText("This schema is open in another tab."),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "shop" })).toBeDefined();
  });

  it("returns focus to the row menu when the delete is refused", async () => {
    const { storage, registry } = setUp();
    await storage.repository.createSchema("shop");
    await createSchemaLockManager(registry.request).tryAcquire(FIRST_SCHEMA_ID);
    const { user } = renderScreen(storage);

    await openRowMenu(user, "shop");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Actions for shop" }),
    );
  });

  it("renames a schema with the keyboard only", async () => {
    const { storage } = setUp();
    await storage.repository.createSchema("shop");
    const { user } = renderScreen(storage);
    const trigger = await screen.findByRole("button", {
      name: "Actions for shop",
    });
    // Theme, language, "Create schema", the schema link, then the row menu.
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(trigger);

    await user.keyboard("{Enter}");
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Rename" }),
    );
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog")).toBeDefined();
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the rename dialog in the %s theme",
    async (themePreference) => {
      const { storage } = setUp();
      await storage.repository.createSchema("shop");
      const { user } = renderScreen(storage, { themePreference });

      await openRowMenu(user, "shop");
      await user.click(screen.getByRole("menuitem", { name: "Rename" }));

      await expectNoAxeViolations(await screen.findByRole("dialog"));
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the delete dialog in the %s theme",
    async (themePreference) => {
      const { storage } = setUp();
      await storage.repository.createSchema("shop");
      const { user } = renderScreen(storage, { themePreference });

      await openRowMenu(user, "shop");
      await user.click(screen.getByRole("menuitem", { name: "Delete" }));

      await expectNoAxeViolations(await screen.findByRole("alertdialog"));
    },
  );

  it("offers only delete for a row that cannot be read", async () => {
    const { storage } = setUp();
    await storage.database
      .table<unknown>("schemas")
      .put({ id: FIRST_SCHEMA_ID, name: 42, createdAt: 1, updatedAt: 1 });
    const { user } = renderScreen(storage);

    expect(await screen.findByText("Unreadable schema")).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
    await openRowMenu(user, "Unreadable schema");

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Delete"]);
  });

  it("shows a translated storage message when indexeddb is unavailable", async () => {
    vi.mocked(createBrowserStorage).mockImplementation(() => {
      throw createMissingApiError();
    });

    renderScreen(undefined, { locale: "vi" });

    expect(
      await screen.findByText(
        "Trình duyệt không cho dùng bộ nhớ local, ví dụ khi đang ở chế độ riêng tư.",
      ),
    ).toBeDefined();
  });

  it("hides the create button when storage is unavailable", async () => {
    vi.mocked(createBrowserStorage).mockImplementation(() => {
      throw createMissingApiError();
    });

    renderScreen(undefined);

    await screen.findByText(
      "Your browser does not allow local storage, for example in private mode.",
    );
    expect(screen.queryByRole("button", { name: "Create schema" })).toBeNull();
  });

  it("shows a translated storage message when the list cannot be read", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const { storage } = setUp();
    const closedError = new Error("The database was closed.");
    closedError.name = "DatabaseClosedError";
    const closedStorage: StorageBundle = {
      ...storage,
      repository: {
        ...storage.repository,
        listSchemas: () => Promise.reject(closedError),
      },
    };

    renderScreen(closedStorage);

    expect(
      await screen.findByText(
        "The storage connection is closed. Reload the page.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Create schema" })).toBeNull();
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { storage } = setUp();
      await storage.repository.createSchema("shop");
      const { container } = renderScreen(storage, { themePreference });
      await screen.findByRole("link", { name: "shop" });

      await expectNoAxeViolations(container);
    },
  );
});
