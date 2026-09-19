import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getOutlineRow,
  queryEdgeNames,
  queryOutlineRow,
  readDocument,
} from "@/testing/journey-queries";
import {
  createRelatedShopDocument,
  createShopDocument,
  openJourneyEditor,
  setJourneyTestTimeout,
} from "@/testing/mount-editor-journey";
import type { OpenedJourneyEditor } from "@/testing/mount-editor-journey";

setJourneyTestTimeout();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
}));

const ONE_TO_MANY_EDGE_NAME = "orders.users_id → users.id, one-to-many";

function openEditor(
  document = createShopDocument(),
): Promise<OpenedJourneyEditor> {
  return openJourneyEditor(document);
}

function getToastRegion(): HTMLElement {
  return screen.getByRole("region", { name: /Notifications/ });
}

async function openRelationDialogFrom(
  user: UserEvent,
  tableName: string,
): Promise<HTMLElement> {
  await user.click(getOutlineRow(tableName));
  await user.click(screen.getByRole("button", { name: "Add relation" }));
  return screen.getByRole("dialog", { name: "Create relation" });
}

async function createManyToManyRelation(user: UserEvent): Promise<void> {
  const dialog = await openRelationDialogFrom(user, "orders");
  await user.click(within(dialog).getByRole("radio", { name: "Many to many" }));
  await user.click(
    within(dialog).getByRole("button", { name: "Create relation" }),
  );
}

async function selectEdge(user: UserEvent, name: string): Promise<void> {
  await user.click(screen.getByRole("group", { name }));
}

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("relations journey", () => {
  it("creates a one-to-many relation with a new users_id column", async () => {
    const { user } = await openEditor();
    const dialog = await openRelationDialogFrom(user, "orders");

    const referencedTable = within(dialog).getByRole("combobox", {
      name: "Referenced table",
    }).textContent;
    await user.click(
      within(dialog).getByRole("button", { name: "Create relation" }),
    );

    expect({
      referencedTable,
      isDialogOpen: screen.queryByRole("dialog") !== null,
      ordersNode: screen.getByRole("group", { name: /^Table orders, / })
        .ariaLabel,
      edges: queryEdgeNames(),
    }).toEqual({
      referencedTable: "users",
      isDialogOpen: false,
      ordersNode: "Table orders, 2 columns",
      edges: [ONE_TO_MANY_EDGE_NAME],
    });
  });

  it("changes the relation to one-to-one and updates the edge label", async () => {
    const { user } = await openEditor();
    const dialog = await openRelationDialogFrom(user, "orders");
    await user.click(
      within(dialog).getByRole("button", { name: "Create relation" }),
    );
    await selectEdge(user, ONE_TO_MANY_EDGE_NAME);

    await user.click(screen.getByRole("combobox", { name: "Relation type" }));
    await user.click(await screen.findByRole("option", { name: "One to one" }));

    expect({
      edges: queryEdgeNames(),
      hasKindLabel: screen.getByText("1-1").isConnected,
      oneToManyLabel: screen.queryByText("1-n"),
    }).toEqual({
      edges: [
        expect.stringMatching(/^orders\.users_id → users\.id, one-to-one/),
      ],
      hasKindLabel: true,
      oneToManyLabel: null,
    });
  });

  it("creates a junction table and two relations for a many-to-many relation", async () => {
    const { user } = await openEditor();

    await createManyToManyRelation(user);

    expect({
      junctionRow: queryOutlineRow("orders_users")?.isConnected,
      edges: queryEdgeNames().toSorted(),
    }).toEqual({
      junctionRow: true,
      edges: [
        "orders_users.orders_id → orders.id, one-to-many",
        "orders_users.users_id → users.id, one-to-many",
      ],
    });
  });

  it("undoes the whole many-to-many relation in one step", async () => {
    const { user } = await openEditor();
    await createManyToManyRelation(user);

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect({
      junctionRow: queryOutlineRow("orders_users"),
      edges: queryEdgeNames(),
      canUndoAgain: !screen
        .getByRole("button", { name: "Undo" })
        .hasAttribute("disabled"),
    }).toEqual({ junctionRow: null, edges: [], canUndoAgain: false });
  });

  it("redoes it", async () => {
    const { user } = await openEditor();
    await createManyToManyRelation(user);
    await user.click(screen.getByRole("button", { name: "Undo" }));

    await user.click(screen.getByRole("button", { name: "Redo" }));

    expect({
      junctionRow: queryOutlineRow("orders_users")?.isConnected,
      edgeCount: queryEdgeNames().length,
    }).toEqual({ junctionRow: true, edgeCount: 2 });
  });

  it("stores the result in the database", async () => {
    const { environment, schemaId, user } = await openEditor();

    await createManyToManyRelation(user);

    await waitFor(async () => {
      const document = await readDocument(environment, schemaId);
      expect({
        tables: Object.values(document.tables)
          .map((table) => table.name)
          .toSorted(),
        relationCount: Object.keys(document.relations).length,
      }).toEqual({
        tables: ["orders", "orders_users", "users"],
        relationCount: 2,
      });
    });
  });

  it("deletes the relation from the relation panel with an undo toast", async () => {
    const { user } = await openEditor(createRelatedShopDocument());
    await selectEdge(user, "orders.user_id → users.id, one-to-many");

    await user.click(screen.getByRole("button", { name: "Remove relation" }));
    const toastText =
      await within(getToastRegion()).findByText("Deleted 1 element");
    const edgesAfterDelete = queryEdgeNames();
    await user.click(
      within(getToastRegion()).getByRole("button", { name: "Undo" }),
    );

    expect({
      hasToast: toastText.isConnected,
      edgesAfterDelete,
      edgesAfterUndo: queryEdgeNames(),
    }).toEqual({
      hasToast: true,
      edgesAfterDelete: [],
      edgesAfterUndo: ["orders.user_id → users.id, one-to-many"],
    });
  });

  it("deletes a table and a relation from the multi-selection panel with an undo toast", async () => {
    const { user } = await openEditor(createRelatedShopDocument());
    await user.click(getOutlineRow("orders"));
    await user.keyboard("{Control>}");
    await selectEdge(user, "orders.user_id → users.id, one-to-many");
    await user.keyboard("{/Control}");

    await user.click(screen.getByRole("button", { name: "Delete all" }));
    const toastText =
      await within(getToastRegion()).findByText("Deleted 2 elements");
    const isOrdersGone = queryOutlineRow("orders") === null;
    await user.click(
      within(getToastRegion()).getByRole("button", { name: "Undo" }),
    );

    expect({
      hasToast: toastText.isConnected,
      isOrdersGone,
      isOrdersRestored: queryOutlineRow("orders") !== null,
      edgesAfterUndo: queryEdgeNames(),
    }).toEqual({
      hasToast: true,
      isOrdersGone: true,
      isOrdersRestored: true,
      edgesAfterUndo: ["orders.user_id → users.id, one-to-many"],
    });
  });
});
