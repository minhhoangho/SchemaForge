import { screen } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { documentsEqual } from "@/lib/sync/documents-equal";
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
const CLOUD_SCHEMA_ID = "0000000a-0000-4000-8000-000000000001";

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

/** A signed-in account whose only schema lives in the cloud, never here. */
function setUpNewDevice(): CloudJourneyEnvironment {
  const environment = createCloudJourneyEnvironment();
  const userId = environment.backend.seedUser({
    email: EMAIL,
    password: PASSWORD,
  });
  environment.backend.seedSchema({
    ownerId: userId,
    id: CLOUD_SCHEMA_ID,
    document: createShopDocument(),
  });
  environment.backend.signInAs(userId);
  environment.setAuthHint(true);
  return environment;
}

describe("new device journey", () => {
  it("lists a cloud schema on an empty browser", async () => {
    const environment = setUpNewDevice();

    environment.mountSchemaList();

    expect({
      link: (await screen.findByRole("link", { name: "shop" })).textContent,
      label: (await screen.findByText("Not downloaded to this browser"))
        .textContent,
      cached: await environment.database.schemas.get(CLOUD_SCHEMA_ID),
    }).toEqual({
      link: "shop",
      label: "Not downloaded to this browser",
      cached: undefined,
    });
  });

  it("opens the cloud schema and writes it to the cache", async () => {
    const environment = setUpNewDevice();

    environment.mountEditor(CLOUD_SCHEMA_ID);
    await screen.findByRole("button", { name: "Schema name shop" });

    const record =
      await environment.storage.repository.readSchemaRecord(CLOUD_SCHEMA_ID);
    const opened =
      await environment.storage.repository.openSchema(CLOUD_SCHEMA_ID);
    expect({
      users: (
        await screen.findByRole("group", { name: "Table users, 1 column" })
      ).textContent,
      orders: (
        await screen.findByRole("group", { name: "Table orders, 1 column" })
      ).textContent,
      syncStatus: record?.syncStatus,
      cloudRevision: record?.cloudRevision,
      isSameDocument:
        opened.kind === "opened" &&
        documentsEqual(
          opened.document,
          environment.backend.getStoredSchema(CLOUD_SCHEMA_ID)?.document,
        ),
    }).toMatchObject({
      syncStatus: "synced",
      cloudRevision: 1,
      isSameDocument: true,
    });
  });
});
