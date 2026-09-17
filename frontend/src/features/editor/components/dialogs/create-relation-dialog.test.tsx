import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import type { JSX } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import {
  formatColumnHandleId,
  formatTableHandleId,
} from "../../lib/handle-ids";
import { createRelationDraftFromConnection } from "../../lib/to-relation-draft";
import type {
  RelationConnection,
  RelationDraft,
} from "../../lib/to-relation-draft";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { CreateRelationDialog } from "./create-relation-dialog";

function createDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_users_id"],
      }),
      makeTable({
        id: "tbl_orders",
        name: "orders",
        primaryKeyColumnIds: ["col_orders_id"],
      }),
      makeTable({ id: "tbl_logs", name: "logs" }),
      makeTable({
        id: "tbl_members",
        name: "members",
        primaryKeyColumnIds: ["col_members_org_id", "col_members_user_id"],
      }),
    ],
    columns: [
      makeColumn({
        id: "col_members_org_id",
        tableId: "tbl_members",
        name: "org_id",
      }),
      makeColumn({
        id: "col_members_user_id",
        tableId: "tbl_members",
        name: "user_id",
      }),
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
      makeColumn({
        id: "col_orders_user_id",
        tableId: "tbl_orders",
        name: "user_id",
      }),
      makeColumn({ id: "col_logs_text", tableId: "tbl_logs", name: "text" }),
    ],
  });
}

const HEADER_CONNECTION: RelationConnection = {
  source: "tbl_orders",
  target: "tbl_users",
  sourceHandle: formatTableHandleId("tbl_orders", "right"),
  targetHandle: formatTableHandleId("tbl_users", "left"),
};

const COLUMN_CONNECTION: RelationConnection = {
  ...HEADER_CONNECTION,
  sourceHandle: formatColumnHandleId("col_orders_user_id", "right"),
};

const LOGS_HEADER_CONNECTION: RelationConnection = {
  ...HEADER_CONNECTION,
  target: "tbl_logs",
  targetHandle: formatTableHandleId("tbl_logs", "left"),
};

const LOGS_COLUMN_CONNECTION: RelationConnection = {
  ...LOGS_HEADER_CONNECTION,
  targetHandle: formatColumnHandleId("col_logs_text", "left"),
};

const MEMBERS_CONNECTION: RelationConnection = {
  ...HEADER_CONNECTION,
  target: "tbl_members",
  targetHandle: formatTableHandleId("tbl_members", "left"),
};

type HarnessProps = {
  readonly initialDraft: RelationDraft | null;
  readonly hasSourceNode: boolean;
  readonly onClose: () => void;
};

// Plays the workspace: closing the dialog clears the draft. The node stands in
// for the canvas node the connection started from, inside the focusable
// region that holds the canvas.
function Harness({
  initialDraft,
  hasSourceNode,
  onClose,
}: HarnessProps): JSX.Element {
  const [draft, setDraft] = useState(initialDraft);

  return (
    <>
      <main tabIndex={-1}>
        <div className="react-flow">
          {hasSourceNode && (
            <button
              type="button"
              className="react-flow__node"
              data-id="tbl_orders"
            >
              orders
            </button>
          )}
        </div>
      </main>
      <CreateRelationDialog
        draft={draft}
        onClose={() => {
          onClose();
          setDraft(null);
        }}
      />
    </>
  );
}

type RenderOptions = {
  readonly connection?: RelationConnection;
  readonly hasSourceNode?: boolean;
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
};

type RenderedDialog = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly onClose: ReturnType<typeof vi.fn<() => void>>;
};

function renderDialog(options: RenderOptions = {}): RenderedDialog {
  const document = createDocument();
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const onClose = vi.fn<() => void>();
  const draft = createRelationDraftFromConnection(
    document,
    options.connection ?? HEADER_CONNECTION,
  );
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <Harness
        initialDraft={draft}
        hasSourceNode={options.hasSourceNode ?? true}
        onClose={onClose}
      />
    </EditorStoreProvider>,
    {
      locale: options.locale ?? "en",
      themePreference: options.themePreference ?? "light",
    },
  );
  return { ...result, store, onClose };
}

function relationsOf(store: EditorStore): readonly unknown[] {
  return Object.values(store.getState().document.relations);
}

describe("CreateRelationDialog", () => {
  it("prefills the dialog from a connection", () => {
    renderDialog({ connection: COLUMN_CONNECTION });

    const dialog = screen.getByRole("dialog", { name: "Create relation" });
    expect(
      within(dialog).getByText("orders", { selector: "p > span" }),
    ).toBeDefined();
    expect(
      screen.getByRole("combobox", { name: "Referenced table" }).textContent,
    ).toBe("users");
    expect(screen.getByRole("radio", { name: "One to many" }).ariaChecked).toBe(
      "true",
    );
    expect(
      screen.getByRole("radio", { name: "Use existing columns" }).ariaChecked,
    ).toBe("true");
    const pairField = screen.getByRole("combobox", {
      name: "Foreign key column 1",
      description: "references id",
    });
    expect(pairField.textContent).toBe("user_id");
    expect(pairField.hasAttribute("aria-invalid")).toBe(false);
  });

  it("swaps both tables", async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Swap tables" }));

    const dialog = screen.getByRole("dialog", { name: "Create relation" });
    expect(
      within(dialog).getByText("users", { selector: "p > span" }),
    ).toBeDefined();
    expect(
      screen.getByRole("combobox", { name: "Referenced table" }).textContent,
    ).toBe("orders");
  });

  it("creates a one-to-many relation with a new foreign key column", async () => {
    const { user, store, onClose } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Create relation" }));

    expect(relationsOf(store)).toMatchObject([
      { kind: "oneToMany", fromTableId: "tbl_orders", toTableId: "tbl_users" },
    ]);
    expect(
      Object.values(store.getState().document.columns).map(
        (column) => column.name,
      ),
    ).toContain("users_id");
    expect(store.getState().history.past).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("creates a one-to-one relation", async () => {
    const { user, store } = renderDialog();

    await user.click(screen.getByRole("radio", { name: "One to one" }));
    await user.click(screen.getByRole("button", { name: "Create relation" }));

    expect(relationsOf(store)).toMatchObject([{ kind: "oneToOne" }]);
  });

  it("creates a junction table for a many-to-many relation", async () => {
    const { user, store } = renderDialog();

    await user.click(screen.getByRole("radio", { name: "Many to many" }));
    const nameField = screen.getByRole("textbox", {
      name: "Junction table name",
    });
    await user.clear(nameField);
    await user.type(nameField, "order_users");
    await user.click(screen.getByRole("button", { name: "Create relation" }));

    expect(
      Object.values(store.getState().document.tables).map(
        (table) => table.name,
      ),
    ).toContain("order_users");
    expect(relationsOf(store)).toHaveLength(2);
    expect(store.getState().history.past).toHaveLength(1);
  });

  it("blocks confirmation when the target table has no primary key", async () => {
    const { user, store, onClose } = renderDialog({
      connection: LOGS_HEADER_CONNECTION,
    });

    const message =
      "The referenced table has no primary key. Add one, or drop the connection on a column.";
    expect(
      screen.getByRole("group", {
        name: "Referenced columns",
        description: message,
      }),
    ).toBeDefined();
    const submit = screen.getByRole("button", { name: "Create relation" });
    expect(submit.hasAttribute("disabled")).toBe(true);
    const tableField = screen.getByRole("combobox", {
      name: "Referenced table",
      description: message,
    });
    expect(tableField.getAttribute("aria-invalid")).toBe("true");
    // Focus starts on the control that explains why confirming is blocked.
    expect(document.activeElement).toBe(tableField);
    expect(
      screen.getByRole("dialog", {
        description: "The foreign key table points at the referenced table.",
      }),
    ).toBeDefined();

    await user.click(submit);

    expect(relationsOf(store)).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("promises Enter in the description only when confirming is possible", () => {
    renderDialog();

    expect(
      screen.getByRole("dialog", {
        description:
          "The foreign key table points at the referenced table. Press Enter to create the relation.",
      }),
    ).toBeDefined();
  });

  it("blocks many-to-many when a table has no primary key", async () => {
    const { user } = renderDialog({ connection: LOGS_COLUMN_CONNECTION });

    await user.click(screen.getByRole("radio", { name: "Many to many" }));

    const field = screen.getByRole("combobox", {
      name: "Referenced table",
      description:
        "Both tables need a primary key for a many-to-many relation.",
    });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Create relation" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("blocks a referenced column chosen twice", async () => {
    const { user } = renderDialog({ connection: MEMBERS_CONNECTION });

    await user.click(
      screen.getByRole("combobox", { name: "Referenced column 2" }),
    );
    await user.click(await screen.findByRole("option", { name: "org_id" }));

    const message = "A column is chosen more than once.";
    expect(
      screen.getByRole("group", {
        name: "Referenced columns",
        description: message,
      }),
    ).toBeDefined();
    expect(
      screen
        .getAllByRole("combobox", { description: message })
        .map((field) => field.getAttribute("aria-invalid")),
    ).toStrictEqual(["true", "true"]);
    expect(
      screen
        .getByRole("button", { name: "Create relation" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("shows a rejected referenced column under the referenced columns", async () => {
    const { user, store, onClose } = renderDialog({
      connection: LOGS_COLUMN_CONNECTION,
    });
    act(() => {
      store.getState().dispatch({
        type: "removeColumn",
        columnId: "col_logs_text",
      });
    });

    await user.click(screen.getByRole("button", { name: "Create relation" }));

    const message = "The column to change no longer exists.";
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(
      screen.getByRole("group", {
        name: "Referenced columns",
        description: message,
      }),
    ).toBeDefined();
    expect(store.getState().history.past).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a repeated rejection as a new alert", async () => {
    const { user, store } = renderDialog({
      connection: LOGS_COLUMN_CONNECTION,
    });
    act(() => {
      store.getState().dispatch({
        type: "removeColumn",
        columnId: "col_logs_text",
      });
    });
    const submit = screen.getByRole("button", { name: "Create relation" });
    await user.click(submit);
    const firstAlert = screen.getByRole("alert");

    await user.click(submit);

    expect(screen.getByRole("alert")).not.toBe(firstAlert);
  });

  it("shows a rejected many-to-many relation under the tables", async () => {
    const { user, store, onClose } = renderDialog();
    await user.click(screen.getByRole("radio", { name: "Many to many" }));
    act(() => {
      store.getState().dispatch({ type: "removeTable", tableId: "tbl_users" });
    });

    await user.click(screen.getByRole("button", { name: "Create relation" }));

    const message = "The table to change no longer exists.";
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(
      screen.getByRole("combobox", {
        name: "Referenced table",
        description: message,
      }),
    ).toBeDefined();
    expect(store.getState().history.past).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("creates new columns against the column the connection was dropped on", async () => {
    const { user, store } = renderDialog({
      connection: LOGS_COLUMN_CONNECTION,
    });

    await user.click(screen.getByRole("button", { name: "Create relation" }));

    expect(relationsOf(store)).toMatchObject([
      {
        toTableId: "tbl_logs",
        columnPairs: [{ toColumnId: "col_logs_text" }],
      },
    ]);
  });

  it("confirms with Enter", async () => {
    const { user, store, onClose } = renderDialog();

    await user.keyboard("{Enter}");

    expect(relationsOf(store)).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape without dispatching", async () => {
    const { user, store, onClose } = renderDialog();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store.getState().history.past).toHaveLength(0);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("returns focus to the source node when it closes", async () => {
    const { user, container } = renderDialog();

    await user.keyboard("{Escape}");

    expect(document.activeElement).toBe(
      container.querySelector('[data-id="tbl_orders"]'),
    );
  });

  it("returns focus to the canvas region when the source node is gone", async () => {
    const { user } = renderDialog({ hasSourceNode: false });

    await user.keyboard("{Escape}");

    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it.each([
    [
      "en",
      ["Referenced table", "Referenced column 1"],
      ["Relation type", "Foreign key"],
      ["Swap tables", "Create relation", "Close"],
    ],
    [
      "vi",
      ["Bảng được tham chiếu", "Cột được tham chiếu 1"],
      ["Loại quan hệ", "Khóa ngoại"],
      ["Đổi chiều", "Tạo quan hệ", "Đóng"],
    ],
  ] as const)(
    "names every field in %s",
    (locale, comboboxNames, radioGroupNames, buttonNames) => {
      renderDialog({ locale });

      expect(
        comboboxNames.map((name) => screen.getByRole("combobox", { name })),
      ).toHaveLength(comboboxNames.length);
      expect(
        radioGroupNames.map((name) => screen.getByRole("radiogroup", { name })),
      ).toHaveLength(radioGroupNames.length);
      expect(
        buttonNames.map((name) => screen.getByRole("button", { name })),
      ).toHaveLength(buttonNames.length);
    },
  );

  it("names the column pair and junction fields", async () => {
    const { user } = renderDialog({ connection: COLUMN_CONNECTION });

    expect(
      screen.getByRole("combobox", { name: "Foreign key column 1" }),
    ).toBeDefined();
    await user.click(screen.getByRole("radio", { name: "Many to many" }));
    expect(
      screen.getByRole("textbox", { name: "Junction table name" }),
    ).toBeDefined();
  });

  it("reports an unpaired referenced column", async () => {
    const { user } = renderDialog();

    await user.click(
      screen.getByRole("radio", { name: "Use existing columns" }),
    );

    const field = screen.getByRole("combobox", {
      name: "Foreign key column 1",
      description:
        "references id Choose a foreign key column for every referenced column.",
    });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Create relation" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      renderDialog({ connection: COLUMN_CONNECTION, themePreference });

      // The stand-in node sits behind the modal, where Radix hides it.
      await expectNoAxeViolations(screen.getByRole("dialog"));
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations while blocked in the %s theme",
    async (themePreference) => {
      renderDialog({ connection: LOGS_HEADER_CONNECTION, themePreference });

      await expectNoAxeViolations(screen.getByRole("dialog"));
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations for many-to-many in the %s theme",
    async (themePreference) => {
      const { user } = renderDialog({ themePreference });
      await user.click(screen.getByRole("radio", { name: "Many to many" }));

      await expectNoAxeViolations(screen.getByRole("dialog"));
    },
  );
});
