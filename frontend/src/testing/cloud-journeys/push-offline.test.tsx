import { act, screen, waitFor, within } from "@testing-library/react";
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
  usePathname: () => "/schemas",
}));

const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";
const SYNCED_LABEL = "Saved to the cloud";
const OFFLINE_LABEL = "Not synced, no network connection";

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

type OpenedCloudEditor = {
  readonly environment: CloudJourneyEnvironment;
  readonly schemaId: string;
  readonly user: UserEvent;
};

function readExpectedRevision(body: unknown): unknown {
  return typeof body === "object" && body !== null && "expectedRevision" in body
    ? Reflect.get(body, "expectedRevision")
    : null;
}

/** The `expectedRevision` of every PUT the API client sent for this schema. */
function putRevisions(
  environment: CloudJourneyEnvironment,
  schemaId: string,
): readonly unknown[] {
  return environment.backend.requests
    .filter(
      (request) =>
        request.method === "PUT" && request.path === `/schemas/${schemaId}`,
    )
    .map((request) => readExpectedRevision(request.body));
}

/**
 * Waits until the cloud and the cache agree on `revision`. The toolbar already
 * reads "Saved to the cloud" for a schema seeded as synced, so it cannot tell
 * a finished push from one that has not started.
 */
async function waitForCloudRevision(
  environment: CloudJourneyEnvironment,
  schemaId: string,
  revision: number,
): Promise<void> {
  await waitFor(async () => {
    const record =
      await environment.storage.repository.readSchemaRecord(schemaId);
    expect({
      cloud: environment.backend.getStoredSchema(schemaId)?.revision,
      cached: record?.cloudRevision,
      syncStatus: record?.syncStatus,
    }).toEqual({ cloud: revision, cached: revision, syncStatus: "synced" });
  });
}

/**
 * One owned schema already synced at revision 1 here and in the cloud, with
 * its editor open and the account resolved from the hint cookie.
 */
async function openSyncedEditor(): Promise<OpenedCloudEditor> {
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

  const { user } = environment.mountEditor(record.id);
  await screen.findByRole("button", { name: "Schema name shop" });
  // The pusher only sends for a signed-in account, so the journey waits for
  // the account menu before it edits anything.
  await screen.findByRole("button", { name: `Account ${EMAIL}` });

  return { environment, schemaId: record.id, user };
}

async function addTable(user: UserEvent): Promise<void> {
  await user.click(
    within(screen.getByRole("banner")).getByRole("button", {
      name: "Add table",
    }),
  );
}

describe("cloud push and offline journey", () => {
  it("sends the cached revision as expectedRevision after an edit", async () => {
    const { environment, schemaId, user } = await openSyncedEditor();

    await addTable(user);

    await waitForCloudRevision(environment, schemaId, 2);
    expect({
      revisions: putRevisions(environment, schemaId),
      label: (await screen.findByText(SYNCED_LABEL)).textContent,
    }).toEqual({ revisions: [1], label: SYNCED_LABEL });
  });

  it("shows not synced while offline and syncs on the online event", async () => {
    const { environment, schemaId, user } = await openSyncedEditor();
    await addTable(user);
    await waitForCloudRevision(environment, schemaId, 2);

    environment.backend.setOffline(true);
    await addTable(user);
    await screen.findAllByText(OFFLINE_LABEL);
    const offlineRecord =
      await environment.storage.repository.readSchemaRecord(schemaId);

    environment.backend.setOffline(false);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    await waitForCloudRevision(environment, schemaId, 3);
    expect({
      offlineStatus: offlineRecord?.syncStatus,
      revisions: putRevisions(environment, schemaId),
      label: (await screen.findByText(SYNCED_LABEL)).textContent,
    }).toEqual({
      offlineStatus: "pending",
      revisions: [1, 2, 2],
      label: SYNCED_LABEL,
    });
  });

  it("retries on the scheduler while offline without syncing", async () => {
    const { environment, schemaId, user } = await openSyncedEditor();

    environment.backend.setOffline(true);
    await addTable(user);
    await screen.findAllByText(OFFLINE_LABEL);
    await waitFor(() => {
      expect(putRevisions(environment, schemaId)).toEqual([1]);
    });

    act(() => {
      environment.scheduler.runDue();
    });

    await waitFor(() => {
      expect(putRevisions(environment, schemaId)).toEqual([1, 1]);
    });
    await screen.findAllByText(OFFLINE_LABEL);
    const record =
      await environment.storage.repository.readSchemaRecord(schemaId);
    // Exactly two attempts: the first push and the one the scheduler ran. No
    // `online` event arrived, so nothing else went out.
    expect({
      revisions: putRevisions(environment, schemaId),
      syncStatus: record?.syncStatus,
      cachedRevision: record?.cloudRevision,
      cloudRevision: environment.backend.getStoredSchema(schemaId)?.revision,
    }).toEqual({
      revisions: [1, 1],
      syncStatus: "pending",
      cachedRevision: 1,
      cloudRevision: 1,
    });
  });
});
