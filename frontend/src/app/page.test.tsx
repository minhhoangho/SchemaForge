import { screen } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getRequestLocale } from "@/lib/i18n/request-locale";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import HomePage, { generateMetadata } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// next/headers only works inside a request, so the locale the request would
// negotiate is supplied here.
vi.mock("@/lib/i18n/request-locale", () => ({
  getRequestLocale: vi.fn<() => Promise<"en" | "vi">>(),
}));

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";

describe("HomePage", () => {
  const databases = new Set<SchemaforgeDatabase>();

  beforeAll(() => {
    // liveQuery skips every query while Dexie finds no global IndexedDB, and
    // jsdom has none; the database below still gets its own factory.
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  });

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
  });

  it("renders the schema list screen", async () => {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    const storage = {
      database,
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
      repository: createSchemaRepository({
        database,
        clock: () => 1,
        generateId: () => SCHEMA_ID,
      }),
    };

    renderWithProviders(
      <StorageProvider storage={storage}>
        <HomePage />
      </StorageProvider>,
      { locale: "en" },
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Your schemas" }),
    ).toBeDefined();
    expect(await screen.findByText("No schemas yet")).toBeDefined();
  });

  it.each([
    ["en", "Your schemas – SchemaForge"],
    ["vi", "Schema của bạn – SchemaForge"],
  ] as const)("translates the page title in %s", async (locale, title) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);

    const metadata = await generateMetadata();

    expect(metadata.title).toBe(title);
  });
});
