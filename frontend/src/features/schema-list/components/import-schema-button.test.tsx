import { screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { ImportSchemaButton } from "./import-schema-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn<(href: string) => void>() }),
  usePathname: () => "/",
}));

const database = new SchemaforgeDatabase({
  indexedDB: new IDBFactory(),
  IDBKeyRange,
});
const storage: StorageBundle = {
  database,
  repository: createSchemaRepository({
    database,
    clock: () => 1,
    generateId: () => "00000000-0000-4000-8000-000000000001",
  }),
  lockManager: createSchemaLockManager(createFakeLockRegistry().request),
};

afterEach(() => {
  toast.dismiss();
});

async function renderButton(): Promise<{ readonly user: UserEvent }> {
  const view = renderWithProviders(<ImportSchemaButton />, {
    locale: "en",
    auth: { storage },
  });
  await screen.findByRole("button", { name: "Import" });
  return { user: view.user };
}

describe("ImportSchemaButton", () => {
  it("opens the import dialog in new-only mode", async () => {
    const { user } = await renderButton();

    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByRole("dialog", { name: "Import a schema" }),
    ).toBeDefined();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("returns focus to the import button when the dialog closes", async () => {
    const { user } = await renderButton();
    const button = screen.getByRole("button", { name: "Import" });
    await user.click(button);
    await screen.findByRole("dialog", { name: "Import a schema" });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(button);
  });
});
