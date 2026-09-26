import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getSchemaIdFromHref } from "@/testing/journey-queries";
import { createJourneyEnvironment } from "@/testing/mount-editor-journey";

const { push } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn<() => void>() }),
  usePathname: () => "/",
}));

async function openRowMenu(user: UserEvent, name: string): Promise<void> {
  await user.click(
    await screen.findByRole("button", { name: `Actions for ${name}` }),
  );
  await screen.findByRole("menu");
}

beforeAll(() => {
  // liveQuery skips every query while Dexie finds no global IndexedDB, and
  // jsdom has none; each environment still opens its own factory.
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  push.mockClear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("schema list journey", () => {
  it("creates a schema from the list and opens its editor", async () => {
    const environment = createJourneyEnvironment();
    const list = environment.mountSchemaList();
    await screen.findByText("No schemas yet");

    await list.user.click(
      screen.getByRole("button", { name: "Create schema" }),
    );
    await list.user.type(screen.getByLabelText("Name"), "shop{Enter}");
    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    list.unmount();
    environment.mountEditor(getSchemaIdFromHref(push.mock.lastCall?.[0]));

    expect(
      await screen.findByRole("button", { name: "Schema name shop" }),
    ).toBeDefined();
  });

  it("renames a schema from the list", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await environment.createSchema("shop");
    const { user } = environment.mountSchemaList();

    await openRowMenu(user, "shop");
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const field = await screen.findByLabelText("Name");
    await user.clear(field);
    await user.type(field, "orders{Enter}");

    expect(await screen.findByRole("link", { name: "orders" })).toBeDefined();
    await expect(
      environment.storage.repository.openSchema(schemaId),
    ).resolves.toMatchObject({ kind: "opened", document: { name: "orders" } });
  });

  it("deletes a schema after confirming", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await environment.createSchema("shop");
    const { user } = environment.mountSchemaList();

    await openRowMenu(user, "shop");
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    const confirmation = await screen.findByRole("alertdialog", {
      name: "Delete “shop”?",
    });
    const isKeptWhileAsking =
      (await environment.storage.repository.openSchema(schemaId)).kind ===
      "opened";
    await user.click(
      within(confirmation).getByRole("button", { name: "Delete" }),
    );

    expect(await screen.findByText("No schemas yet")).toBeDefined();
    expect({
      isKeptWhileAsking,
      afterDelete: (await environment.storage.repository.openSchema(schemaId))
        .kind,
    }).toEqual({ isKeptWhileAsking: true, afterDelete: "not-found" });
  });
});
