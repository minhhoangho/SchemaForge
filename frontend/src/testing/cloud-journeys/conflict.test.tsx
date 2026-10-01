import { parseSchemaDocument } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { buildSchema, makeColumn, makeTable } from "@schemaforge/core/testing";
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
  usePathname: () => "/schemas",
}));

const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";
const CONFLICT_TITLE = "This schema was changed somewhere else";
const USE_CLOUD = "Use the cloud version";
const KEEP_LOCAL = "Keep the version on this device";
const SYNCED_LABEL = "Saved to the cloud";
// "Add table" names the new table from the document it already holds.
const ADDED_TABLE = "table_1";

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

/** The shop another device saved a "payments" table into. */
function createPaidShopDocument(): SchemaDocument {
  const shop = createShopDocument();
  return buildSchema({
    name: shop.name,
    tables: [
      ...Object.values(shop.tables),
      makeTable({
        id: "tbl_payments",
        name: "payments",
        position: { x: 800, y: 0 },
        primaryKeyColumnIds: ["col_payments_id"],
      }),
    ],
    columns: [
      ...Object.values(shop.columns),
      makeColumn({
        id: "col_payments_id",
        tableId: "tbl_payments",
        name: "id",
      }),
    ],
  });
}

type ConflictJourney = {
  readonly environment: CloudJourneyEnvironment;
  readonly schemaId: string;
  readonly user: UserEvent;
};

function readField(body: unknown, key: string): unknown {
  return typeof body === "object" && body !== null && key in body
    ? Reflect.get(body, key)
    : null;
}

function putRequests(
  environment: CloudJourneyEnvironment,
  schemaId: string,
): readonly unknown[] {
  return environment.backend.requests
    .filter(
      (request) =>
        request.method === "PUT" && request.path === `/schemas/${schemaId}`,
    )
    .map((request) => request.body);
}

function putRevisions(
  environment: CloudJourneyEnvironment,
  schemaId: string,
): readonly unknown[] {
  return putRequests(environment, schemaId).map((body) =>
    readField(body, "expectedRevision"),
  );
}

/** The table names of the document a recorded PUT carried. */
function readSentTableNames(body: unknown): readonly string[] {
  const parsed = parseSchemaDocument(readField(body, "document"));
  return parsed.isOk
    ? Object.values(parsed.value.tables)
        .map((table) => table.name)
        .toSorted()
    : [];
}

function getToolbarButton(name: string): HTMLElement {
  return within(screen.getByRole("banner")).getByRole("button", { name });
}

async function addTable(user: UserEvent): Promise<void> {
  await user.click(getToolbarButton("Add table"));
}

/**
 * One owned schema synced at revision 1, changed in the cloud by another
 * device, then changed here: the push is refused with 409 and the conflict
 * dialog opens with both versions loaded.
 */
async function openConflict(): Promise<ConflictJourney> {
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
  await screen.findByRole("button", { name: `Account ${EMAIL}` });

  environment.backend.writeFromOtherDevice(record.id, createPaidShopDocument());
  await addTable(user);

  const dialog = await screen.findByRole("alertdialog", {
    name: CONFLICT_TITLE,
  });
  await waitFor(() => {
    expect(
      within(dialog).getByRole("button", { name: USE_CLOUD }),
    ).toHaveProperty("disabled", false);
  });
  return { environment, schemaId: record.id, user };
}

describe("cloud conflict journey", () => {
  it("keeps this device's version with the new cloud revision", async () => {
    const { environment, schemaId, user } = await openConflict();

    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: KEEP_LOCAL,
      }),
    );

    await waitFor(() => {
      expect(environment.backend.getStoredSchema(schemaId)?.revision).toBe(3);
    });
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    const record =
      await environment.storage.repository.readSchemaRecord(schemaId);
    expect({
      revisions: putRevisions(environment, schemaId),
      sentTables: readSentTableNames(putRequests(environment, schemaId).at(-1)),
      cachedRevision: record?.cloudRevision,
      syncStatus: record?.syncStatus,
      label: (await screen.findByText(SYNCED_LABEL)).textContent,
    }).toEqual({
      revisions: [1, 2],
      sentTables: ["orders", ADDED_TABLE, "users"],
      cachedRevision: 3,
      syncStatus: "synced",
      label: SYNCED_LABEL,
    });
  });

  it("uses the cloud version and shows the cloud document on the canvas", async () => {
    const { environment, schemaId, user } = await openConflict();
    const revisionsBefore = putRevisions(environment, schemaId);

    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: USE_CLOUD,
      }),
    );

    await screen.findByRole("group", { name: "Table payments, 1 column" });
    await waitFor(() => {
      expect(getToolbarButton("Undo")).toHaveProperty("disabled", true);
    });
    const record =
      await environment.storage.repository.readSchemaRecord(schemaId);
    expect({
      addedTable: screen.queryByRole("group", {
        name: `Table ${ADDED_TABLE}, 1 column`,
      }),
      toast: (await screen.findByText("Switched to the cloud version"))
        .textContent,
      syncStatus: record?.syncStatus,
      cachedRevision: record?.cloudRevision,
      revisionsBefore,
      revisionsAfter: putRevisions(environment, schemaId),
    }).toEqual({
      addedTable: null,
      toast: "Switched to the cloud version",
      syncStatus: "synced",
      cachedRevision: 2,
      revisionsBefore: [1],
      revisionsAfter: [1],
    });
  });

  it("leaves the conflict unresolved when the dialog is closed and reopens it from Resolve", async () => {
    const { environment, schemaId, user } = await openConflict();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    await screen.findAllByText("Conflict");
    await addTable(user);
    await waitFor(() => {
      expect(
        screen.getByRole("group", { name: "Table table_2, 1 column" }),
      ).toBeDefined();
    });
    const afterEditRevisions = putRevisions(environment, schemaId);

    await user.click(getToolbarButton("Resolve"));

    const record =
      await environment.storage.repository.readSchemaRecord(schemaId);
    expect({
      reopened: (
        await screen.findByRole("alertdialog", { name: CONFLICT_TITLE })
      ).getAttribute("role"),
      afterEditRevisions,
      syncStatus: record?.syncStatus,
      cloudRevision: environment.backend.getStoredSchema(schemaId)?.revision,
    }).toEqual({
      reopened: "alertdialog",
      afterEditRevisions: [1],
      syncStatus: "conflict",
      cloudRevision: 2,
    });
  });
});
