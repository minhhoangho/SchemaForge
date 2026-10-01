import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createShopDocument } from "@/testing/mount-editor-journey";

import {
  clearJourneyCookies,
  createCloudJourneyEnvironment,
  setJourneyTestTimeout,
} from "./mount-cloud-journey";
import type { CloudJourneyEnvironment } from "./mount-cloud-journey";

setJourneyTestTimeout();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
  usePathname: () => "/",
}));

const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";
const NEEDS_NETWORK_MESSAGE =
  "You need a network connection to delete this schema from the cloud";

beforeAll(() => {
  // liveQuery skips every query while Dexie finds no global IndexedDB, and
  // jsdom has none; each environment still opens its own factory.
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  clearJourneyCookies();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type SyncedJourney = {
  readonly environment: CloudJourneyEnvironment;
  readonly schemaId: string;
};

/** One owned schema, already synced in this browser and in the cloud. */
async function setUpSyncedSchema(): Promise<SyncedJourney> {
  const environment = createCloudJourneyEnvironment();
  const { repository } = environment.storage;
  const userId = environment.backend.seedUser({
    email: EMAIL,
    password: PASSWORD,
  });
  const record = await repository.createSchema("shop", { ownerId: userId });
  await repository.saveDocument(record.id, createShopDocument());
  await repository.saveViewport({ schemaId: record.id, x: 0, y: 0, zoom: 1 });
  await repository.setSyncState(record.id, {
    cloudRevision: 1,
    syncStatus: "synced",
  });
  environment.backend.seedSchema({
    ownerId: userId,
    id: record.id,
    document: createShopDocument(),
  });
  environment.backend.signInAs(userId);
  environment.setAuthHint(true);
  return { environment, schemaId: record.id };
}

async function confirmDelete(user: UserEvent): Promise<void> {
  await user.click(
    await screen.findByRole("button", { name: "Actions for shop" }),
  );
  await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
  const confirmation = await screen.findByRole("alertdialog", {
    name: "Delete “shop”?",
  });
  await user.click(
    within(confirmation).getByRole("button", { name: "Delete" }),
  );
}

describe("delete from list journey", () => {
  it("deletes a cloud schema from the list, the cloud and the cache", async () => {
    const { environment, schemaId } = await setUpSyncedSchema();
    const list = environment.mountSchemaList();
    await screen.findByRole("link", { name: "shop" });

    await confirmDelete(list.user);
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "shop" })).toBeNull();
    });

    expect({
      deleteRequests: environment.backend.requests.filter(
        (request) =>
          request.method === "DELETE" &&
          request.path === `/schemas/${schemaId}`,
      ).length,
      cloud: environment.backend.getStoredSchema(schemaId),
      schema: await environment.database.schemas.get(schemaId),
      document: await environment.database.documents.get(schemaId),
      viewport: await environment.database.viewports.get(schemaId),
    }).toEqual({
      deleteRequests: 1,
      cloud: null,
      schema: undefined,
      document: undefined,
      viewport: undefined,
    });
  });

  it("keeps the schema when the delete request fails offline", async () => {
    const { environment, schemaId } = await setUpSyncedSchema();
    const list = environment.mountSchemaList();
    await screen.findByRole("link", { name: "shop" });
    environment.backend.setOffline(true);

    await confirmDelete(list.user);

    expect({
      toast: (await screen.findByText(NEEDS_NETWORK_MESSAGE)).textContent,
      cloud: environment.backend.getStoredSchema(schemaId)?.revision ?? null,
      schemaId: (await environment.database.schemas.get(schemaId))?.id,
      hasDocument:
        (await environment.database.documents.get(schemaId)) !== undefined,
    }).toEqual({
      toast: NEEDS_NETWORK_MESSAGE,
      cloud: 1,
      schemaId,
      hasDocument: true,
    });
  });
});
