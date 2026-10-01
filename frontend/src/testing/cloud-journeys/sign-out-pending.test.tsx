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
const AUTH_HINT_NAME = "sf-auth-hint";
const SIGN_OUT_TITLE = "Sign out?";
const UNSYNCED_WARNING =
  "1 schema has changes that are not saved to the cloud. Signing out will remove it from this browser.";
const SIGN_OUT_FAILED = "Could not sign out, check your connection";

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

type PendingSignOutJourney = {
  readonly environment: CloudJourneyEnvironment;
  readonly schemaId: string;
  readonly user: UserEvent;
};

function hasLogoutRequest(environment: CloudJourneyEnvironment): boolean {
  return environment.backend.requests.some(
    (request) => request.method === "POST" && request.path === "/auth/logout",
  );
}

type CachedRows = {
  readonly hasSchema: boolean;
  readonly hasDocument: boolean;
  readonly hasViewport: boolean;
  readonly sessionCount: number;
};

async function readCachedRows(
  environment: CloudJourneyEnvironment,
  schemaId: string,
): Promise<CachedRows> {
  const { database } = environment;
  return {
    hasSchema: (await database.schemas.get(schemaId)) !== undefined,
    hasDocument: (await database.documents.get(schemaId)) !== undefined,
    hasViewport: (await database.viewports.get(schemaId)) !== undefined,
    sessionCount: await database.session.count(),
  };
}

/**
 * A guest schema "notes" next to an owned schema left `pending` by an edit made
 * while offline, with the editor closed again and the schema list on screen.
 */
async function reachSignOutWarning(): Promise<PendingSignOutJourney> {
  const environment = createCloudJourneyEnvironment();
  const { repository } = environment.storage;
  await environment.createGuestSchema("notes");
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

  // The list mounts first and while the connection is up: its AuthProvider
  // only reaches the account over the network, and its background sync skips
  // the schema while the editor below holds its lock.
  const list = environment.mountSchemaList();
  await within(list.container).findByRole("button", {
    name: `Account ${EMAIL}`,
  });

  const editor = environment.mountEditor(record.id);
  await within(editor.container).findByRole("button", {
    name: "Schema name shop",
  });
  await within(editor.container).findByRole("button", {
    name: `Account ${EMAIL}`,
  });
  environment.backend.setOffline(true);
  await editor.user.click(
    within(editor.container).getByRole("button", { name: "Add table" }),
  );
  await within(editor.container).findAllByText(
    "Not synced, no network connection",
  );
  // The sign-out waits for each schema lock, so the editor closes first.
  editor.unmount();

  await list.user.click(
    await screen.findByRole("button", { name: `Account ${EMAIL}` }),
  );
  await list.user.click(
    await screen.findByRole("menuitem", { name: "Sign out" }),
  );
  const dialog = await screen.findByRole("alertdialog", {
    name: SIGN_OUT_TITLE,
  });
  within(dialog).getByText(UNSYNCED_WARNING);

  return { environment, schemaId: record.id, user: list.user };
}

async function confirmSignOut(user: UserEvent): Promise<void> {
  await user.click(
    within(screen.getByRole("alertdialog")).getByRole("button", {
      name: "Sign out anyway",
    }),
  );
}

describe("sign out with pending changes journey", () => {
  it("warns about unsynced changes and removes the account cache after signing out anyway", async () => {
    const { environment, schemaId, user } = await reachSignOutWarning();

    environment.backend.setOffline(false);
    await confirmSignOut(user);

    // A signed-out list has no owned section, so the guest schemas are the
    // whole list and the "Only on this browser" heading is gone with it.
    const signIn = await screen.findByRole("link", { name: "Sign in" });
    expect({
      hasLogout: hasLogoutRequest(environment),
      rows: await readCachedRows(environment, schemaId),
      hasAuthHint: document.cookie.includes(AUTH_HINT_NAME),
      notes: (await screen.findByRole("link", { name: "notes" })).textContent,
      shop: screen.queryByRole("link", { name: "shop" }),
      signIn: signIn.textContent,
    }).toEqual({
      hasLogout: true,
      rows: {
        hasSchema: false,
        hasDocument: false,
        hasViewport: false,
        sessionCount: 0,
      },
      hasAuthHint: false,
      notes: "notes",
      shop: null,
      signIn: "Sign in",
    });
  });

  it("keeps the account cache when logout fails offline", async () => {
    const { environment, schemaId, user } = await reachSignOutWarning();

    await confirmSignOut(user);

    expect({
      toast: (await screen.findByText(SIGN_OUT_FAILED)).textContent,
      rows: await readCachedRows(environment, schemaId),
      account: (await screen.findByRole("button", { name: `Account ${EMAIL}` }))
        .textContent,
      hasAuthHint: document.cookie.includes(AUTH_HINT_NAME),
    }).toEqual({
      toast: SIGN_OUT_FAILED,
      rows: {
        hasSchema: true,
        hasDocument: true,
        hasViewport: true,
        sessionCount: 1,
      },
      account: EMAIL,
      hasAuthHint: true,
    });
  });

  it("does not sign out after cancelling", async () => {
    const { environment, schemaId, user } = await reachSignOutWarning();

    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Cancel",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect({
      hasLogout: hasLogoutRequest(environment),
      rows: await readCachedRows(environment, schemaId),
      account: screen.getByRole("button", { name: `Account ${EMAIL}` })
        .textContent,
    }).toEqual({
      hasLogout: false,
      rows: {
        hasSchema: true,
        hasDocument: true,
        hasViewport: true,
        sessionCount: 1,
      },
      account: EMAIL,
    });
  });
});
