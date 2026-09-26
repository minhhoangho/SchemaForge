import { buildSchema } from "@schemaforge/core/testing";
import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  getOutlineRow,
  getSchemaIdFromHref,
  queryEdgeNames,
  queryOutlineRow,
  readDocument,
} from "@/testing/journey-queries";
import {
  createJourneyEnvironment,
  createRelatedShopDocument,
  openJourneyEditor,
  setJourneyTestTimeout,
} from "@/testing/mount-editor-journey";
import type { OpenedJourneyEditor } from "@/testing/mount-editor-journey";

setJourneyTestTimeout();

const { push } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn<() => void>() }),
  // The toolbar's account menu links back to the current page.
  usePathname: () => "/schemas",
}));

// More stops than any screen here has, so a missing control fails the test
// instead of tabbing forever.
const MAX_TAB_STOPS = 80;
const EDGE_NAME = "orders.user_id → users.id, one-to-many";
const UNDO_KEYS = "{Control>}z{/Control}";

function openEditor(
  document = createRelatedShopDocument(),
): Promise<OpenedJourneyEditor> {
  return openJourneyEditor(document);
}

/** Presses Tab until `target` has focus. */
async function tabTo(user: UserEvent, target: HTMLElement): Promise<void> {
  for (let stop = 0; stop < MAX_TAB_STOPS; stop += 1) {
    if (document.activeElement === target) {
      return;
    }
    await user.tab();
  }
  throw new Error(`Tab never reached ${target.outerHTML.slice(0, 80)}.`);
}

function isTextField(element: Element | null): boolean {
  return element?.matches("input, textarea") ?? false;
}

/** Presses Shift+Tab until focus leaves every text field. */
async function shiftTabOutOfTextFields(user: UserEvent): Promise<void> {
  for (let stop = 0; stop < MAX_TAB_STOPS; stop += 1) {
    if (!isTextField(document.activeElement)) {
      return;
    }
    await user.tab({ shift: true });
  }
  throw new Error("Shift+Tab never left the text fields.");
}

function getToolbarButton(name: string): HTMLElement {
  return within(screen.getByRole("banner")).getByRole("button", { name });
}

// Adds a table from the toolbar; its name field then has focus.
async function addTableWithKeyboard(user: UserEvent): Promise<void> {
  await tabTo(user, getToolbarButton("Add table"));
  await user.keyboard("{Enter}");
}

async function selectOutlineRowWithKeyboard(
  user: UserEvent,
  tableName: string,
): Promise<void> {
  await tabTo(user, getOutlineRow(tableName));
  await user.keyboard("{Enter}");
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

describe("keyboard journey", () => {
  it("creates a schema, a table, a column and a relation with the keyboard only", async () => {
    const environment = createJourneyEnvironment();
    const list = environment.mountSchemaList();
    await screen.findByText("No schemas yet");
    await tabTo(
      list.user,
      screen.getByRole("button", { name: "Create schema" }),
    );
    await list.user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Create a schema" });
    await list.user.keyboard("shop{Enter}");
    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    list.unmount();
    const schemaId = getSchemaIdFromHref(push.mock.lastCall?.[0]);
    const { user } = environment.mountEditor(schemaId);
    await screen.findByRole("button", { name: "Schema name shop" });

    await addTableWithKeyboard(user);
    // "table_1" has seven characters.
    await user.keyboard("{Backspace>7/}users{Enter}");
    await tabTo(user, screen.getByRole("button", { name: "Add column" }));
    await user.keyboard("{Enter}");
    // "column_1" has eight characters.
    await user.keyboard("{Backspace>8/}email{Enter}");
    await tabTo(user, screen.getByRole("button", { name: "Add relation" }));
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Create relation" });
    await user.keyboard("{Enter}");

    expect(queryEdgeNames()).toEqual([
      "users.users_id → users.id, one-to-many",
    ]);
    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      expect({
        tables: Object.values(document.tables).map((table) => table.name),
        columns: Object.values(document.columns)
          .map((column) => column.name)
          .toSorted(),
        relationCount: Object.keys(document.relations).length,
      }).toEqual({
        tables: ["users"],
        columns: ["email", "id", "users_id"],
        relationCount: 1,
      });
    });
  });

  it("undoes with Mod+Z outside a text field", async () => {
    const { user } = await openEditor(buildSchema({ name: "shop" }));
    await addTableWithKeyboard(user);
    const tableRowAfterAdding = queryOutlineRow("table_1");

    await shiftTabOutOfTextFields(user);
    await user.keyboard(UNDO_KEYS);

    expect({
      hadTable: tableRowAfterAdding !== null,
      tableRow: queryOutlineRow("table_1"),
    }).toEqual({ hadTable: true, tableRow: null });
  });

  it("leaves Mod+Z to the browser inside a text field", async () => {
    const { user } = await openEditor(buildSchema({ name: "shop" }));
    await addTableWithKeyboard(user);

    await user.keyboard(UNDO_KEYS);

    expect({
      isNameFieldFocused:
        document.activeElement ===
        screen.getByRole("textbox", { name: "Table name" }),
      tableRow: queryOutlineRow("table_1")?.isConnected,
    }).toEqual({
      isNameFieldFocused: true,
      tableRow: true,
    });
  });

  it("deletes the selected table and relation with one undo step", async () => {
    const { user } = await openEditor();
    await tabTo(user, screen.getByRole("group", { name: EDGE_NAME }));
    await user.keyboard("{Enter}");
    await tabTo(
      user,
      screen.getByRole("group", { name: "Table users, 1 column" }),
    );
    await user.keyboard("{Control>}{Enter}{/Control}");
    const hasSummary =
      screen.queryByText("Selected 1 table and 1 relation") !== null;

    await user.keyboard("{Delete}");
    const afterDelete = {
      toast: (await screen.findByText("Deleted 2 elements")).isConnected,
      usersRow: queryOutlineRow("users"),
      edges: queryEdgeNames(),
    };
    await user.keyboard(UNDO_KEYS);

    expect({
      hasSummary,
      afterDelete,
      usersRowAfterUndo: queryOutlineRow("users")?.isConnected,
      edgesAfterUndo: queryEdgeNames(),
      canUndoAgain: !getToolbarButton("Undo").hasAttribute("disabled"),
    }).toEqual({
      hasSummary: true,
      afterDelete: { toast: true, usersRow: null, edges: [] },
      usersRowAfterUndo: true,
      edgesAfterUndo: [EDGE_NAME],
      canUndoAgain: false,
    });
  });

  it("ignores Delete inside a text field", async () => {
    const { user } = await openEditor();
    await selectOutlineRowWithKeyboard(user, "users");
    await tabTo(user, screen.getByRole("textbox", { name: "Table name" }));

    await user.keyboard("{Delete}");

    expect({
      usersRow: queryOutlineRow("users")?.isConnected,
      edges: queryEdgeNames(),
    }).toEqual({ usersRow: true, edges: [EDGE_NAME] });
  });

  it("ignores Delete while a dialog is open", async () => {
    const { user } = await openEditor();
    await selectOutlineRowWithKeyboard(user, "orders");
    await tabTo(user, screen.getByRole("button", { name: "Add relation" }));
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", {
      name: "Create relation",
    });

    await user.keyboard("{Delete}");

    expect({
      isDialogOpen: dialog.isConnected,
      isFocusInDialog: dialog.contains(document.activeElement),
      ordersRow: queryOutlineRow("orders")?.isConnected,
    }).toEqual({ isDialogOpen: true, isFocusInDialog: true, ordersRow: true });
  });
});

describe("locking journey", () => {
  it("shows the locked state in the second editor", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await environment.createSchema("shop");
    const first = environment.mountEditor(schemaId);
    await within(first.container).findByRole("button", {
      name: "Schema name shop",
    });

    const second = environment.mountEditor(schemaId);

    expect(
      await within(second.container).findByRole("heading", {
        level: 1,
        name: "This schema is open in another tab",
      }),
    ).toBeDefined();
    expect(
      within(second.container).queryByRole("button", {
        name: "Schema name shop",
      }),
    ).toBeNull();
  });

  it("lets the second editor edit after the first one unmounts", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await environment.createSchema("shop");
    const first = environment.mountEditor(schemaId);
    await within(first.container).findByRole("button", {
      name: "Schema name shop",
    });
    const second = environment.mountEditor(schemaId);
    await within(second.container).findByRole("heading", {
      name: "This schema is open in another tab",
    });

    first.unmount();
    await second.user.click(
      within(await within(second.container).findByRole("banner")).getByRole(
        "button",
        { name: "Add table" },
      ),
    );

    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      expect(Object.values(document.tables)).toHaveLength(1);
    });
    expect(
      within(second.container).getByRole("group", {
        name: "Table table_1, 1 column",
      }),
    ).toBeDefined();
  });

  it("re-reads the document from the database after the lock is granted", async () => {
    const environment = createJourneyEnvironment();
    const schemaId = await environment.createSchema("shop");
    const first = environment.mountEditor(schemaId);
    await first.user.click(
      within(await within(first.container).findByRole("banner")).getByRole(
        "button",
        { name: "Add table" },
      ),
    );
    const second = environment.mountEditor(schemaId);
    await within(second.container).findByRole("heading", {
      name: "This schema is open in another tab",
    });
    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      expect(Object.values(document.tables)).toHaveLength(1);
    });

    first.unmount();

    expect(
      await within(second.container).findByRole("group", {
        name: "Table table_1, 1 column",
      }),
    ).toBeDefined();
  });
});
