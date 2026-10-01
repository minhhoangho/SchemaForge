import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getSchemaIdFromHref } from "@/testing/journey-queries";

import {
  clearJourneyCookies,
  createCloudJourneyEnvironment,
  setJourneyTestTimeout,
} from "./mount-cloud-journey";

setJourneyTestTimeout();

const { push } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
  usePathname: () => "/",
}));

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
  clearJourneyCookies();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openRowMenu(user: UserEvent, name: string): Promise<void> {
  await user.click(
    await screen.findByRole("button", { name: `Actions for ${name}` }),
  );
  await screen.findByRole("menu");
}

async function renameSchemaInEditor(
  user: UserEvent,
  name: string,
): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Schema name shop" }));
  const field = await screen.findByLabelText("Schema name");
  await user.clear(field);
  await user.type(field, name);
  await user.click(screen.getByRole("button", { name: "Rename" }));
}

async function renameRow(user: UserEvent, name: string): Promise<void> {
  await openRowMenu(user, "orders");
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));
  const field = await screen.findByLabelText("Name");
  await user.clear(field);
  await user.type(field, `${name}{Enter}`);
}

async function deleteRow(user: UserEvent, name: string): Promise<void> {
  await openRowMenu(user, name);
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  const confirmation = await screen.findByRole("alertdialog", {
    name: `Delete “${name}”?`,
  });
  await user.click(
    within(confirmation).getByRole("button", { name: "Delete" }),
  );
}

describe("guest without network journey", () => {
  it("never calls fetch during the guest create, edit, rename and delete journeys", async () => {
    const environment = createCloudJourneyEnvironment();
    const list = environment.mountSchemaList();
    await screen.findByText("No schemas yet");

    await list.user.click(
      screen.getByRole("button", { name: "Create schema" }),
    );
    await list.user.type(screen.getByLabelText("Name"), "shop{Enter}");
    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    const schemaId = getSchemaIdFromHref(push.mock.lastCall?.[0]);
    list.unmount();

    const editor = environment.mountEditor(schemaId);
    await screen.findByRole("button", { name: "Schema name shop" });
    await editor.user.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Add table",
      }),
    );
    await renameSchemaInEditor(editor.user, "orders");
    await waitFor(async () => {
      await expect(
        environment.storage.repository.openSchema(schemaId),
      ).resolves.toMatchObject({ document: { name: "orders" } });
    });
    editor.unmount();

    const secondList = environment.mountSchemaList();
    await screen.findByRole("link", { name: "orders" });
    await renameRow(secondList.user, "catalog");
    await screen.findByRole("link", { name: "catalog" });
    await deleteRow(secondList.user, "catalog");
    await screen.findByText("No schemas yet");

    expect({
      scopedCalls: environment.fetchSpy.mock.calls.length,
      globalCalls: environment.globalFetchSpy.mock.calls.length,
      apiRequests: environment.backend.requests.length,
    }).toEqual({ scopedCalls: 0, globalCalls: 0, apiRequests: 0 });
  });
});
