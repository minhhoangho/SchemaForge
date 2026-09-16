import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { getRequestLocale } from "@/lib/i18n/request-locale";
import { StorageProvider } from "@/lib/storage/storage-context";
import { renderWithProviders } from "@/testing/render-with-providers";

import EditorPage, { generateMetadata } from "./page";

// next/headers only works inside a request, so the locale the request would
// negotiate is supplied here.
vi.mock("@/lib/i18n/request-locale", () => ({
  getRequestLocale: vi.fn<() => Promise<"en" | "vi">>(),
}));

// jsdom has neither IndexedDB nor Web Locks. Storage that cannot be created
// gives the editor screen a state only it renders, which shows that the loader
// has loaded it.
vi.mock("@/lib/storage/create-browser-storage", () => ({
  createBrowserStorage: vi.fn<() => never>(() => {
    const error = new Error("IndexedDB API is missing.");
    error.name = "MissingAPIError";
    throw error;
  }),
}));

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";

function toParams(schemaId: string): Promise<{ readonly schemaId: string }> {
  return Promise.resolve({ schemaId });
}

describe("EditorPage", () => {
  beforeAll(async () => {
    // The loader imports the editor screen on demand. Transforming that module
    // graph the first time can outlast a findBy timeout, so it is loaded once
    // up front; the loader's own import then resolves from the module cache.
    await import("@/features/editor/components/editor-screen");
  });

  it("renders the not found state for an id that is not a uuid", async () => {
    const page = await EditorPage({ params: toParams("not-a-schema-id") });

    renderWithProviders(page, { locale: "en" });

    expect({
      title: screen.getByRole("heading", { level: 1 }).textContent,
      hasEditor: screen.queryByRole("status") !== null,
    }).toEqual({ title: "Schema not found", hasEditor: false });
  });

  it("renders the editor loader for a valid id", async () => {
    const page = await EditorPage({ params: toParams(SCHEMA_ID) });

    renderWithProviders(<StorageProvider>{page}</StorageProvider>, {
      locale: "en",
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Storage is unavailable",
      }),
    ).toBeDefined();
  });

  it.each([
    ["en", "Schema editor – SchemaForge"],
    ["vi", "Trình sửa schema – SchemaForge"],
  ] as const)("translates the page title in %s", async (locale, title) => {
    vi.mocked(getRequestLocale).mockResolvedValue(locale);

    const metadata = await generateMetadata();

    expect(metadata.title).toBe(title);
  });
});
