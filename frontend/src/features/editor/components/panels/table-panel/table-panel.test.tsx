import type { SchemaDocument, TableId } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeTable,
} from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { createEditorStore } from "../../../state/create-editor-store";
import type { EditorStore } from "../../../state/create-editor-store";
import { EditorStoreProvider } from "../../../state/editor-store-provider";
import { TablePanel } from "./table-panel";

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly onCreateRelation: ReturnType<
    typeof vi.fn<(tableId: TableId) => void>
  >;
  readonly onDelete: ReturnType<typeof vi.fn<() => void>>;
  readonly notify: ReturnType<typeof vi.fn<Notify>>;
};

function createDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        comment: "People",
        position: { x: 120.4, y: 80.6 },
        primaryKeyColumnIds: ["col_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" }),
      makeColumn({
        id: "col_email",
        tableId: "tbl_users",
        name: "email",
        type: { kind: "varchar", length: 255 },
      }),
    ],
    indexes: [
      makeIndex({
        id: "idx_email",
        tableId: "tbl_users",
        name: "users_email_idx",
        columnIds: ["col_email"],
      }),
    ],
    enums: [makeEnum({ id: "enum_status", name: "status" })],
  });
}

function createDocumentWithIssues(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_people", name: "users" }),
    ],
    columns: [
      makeColumn({
        id: "col_name",
        tableId: "tbl_users",
        name: "name",
        type: { kind: "text" },
        isAutoIncrement: true,
      }),
    ],
  });
}

function renderPanel(
  document: SchemaDocument = createDocument(),
  themePreference: ThemePreference = "light",
): Harness {
  const notify = vi.fn<Notify>();
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify,
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  store.getState().setSelection({ tableIds: ["tbl_users"], relationIds: [] });
  const onCreateRelation = vi.fn<(tableId: TableId) => void>();
  const onDelete = vi.fn<() => void>();
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <TablePanel
        tableId="tbl_users"
        onCreateRelation={onCreateRelation}
        onDelete={onDelete}
      />
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
  return { ...result, store, onCreateRelation, onDelete, notify };
}

describe("TablePanel", () => {
  it("renames the table on blur", async () => {
    const { user, store } = renderPanel();

    const field = screen.getByLabelText("Table name");
    await user.clear(field);
    await user.type(field, "members");
    await user.tab();

    expect(store.getState().document.tables.tbl_users?.name).toBe("members");
    expect(store.getState().history.past).toHaveLength(1);
  });

  it("stores the comment on blur", async () => {
    const { user, store } = renderPanel();

    const field = screen.getByLabelText("Table comment");
    await user.type(field, " and bots");
    await user.tab();

    expect(store.getState().document.tables.tbl_users?.comment).toBe(
      "People and bots",
    );
  });

  it("clears the comment when the text is deleted", async () => {
    const { user, store } = renderPanel();

    await user.clear(screen.getByLabelText("Table comment"));
    await user.tab();

    expect(store.getState().document.tables.tbl_users?.comment).toBe("");
  });

  it("shows the rounded position", () => {
    renderPanel();

    expect(screen.getByLabelText<HTMLInputElement>("X").value).toBe("120");
    expect(screen.getByLabelText<HTMLInputElement>("Y").value).toBe("81");
  });

  it("dispatches one moveElements when the x field is committed", async () => {
    const { user, store } = renderPanel();

    const field = screen.getByLabelText("X");
    await user.clear(field);
    await user.type(field, "300{Enter}");

    expect(store.getState().document.tables.tbl_users?.position).toEqual({
      x: 300,
      y: 80.6,
    });
    expect(store.getState().history.past).toEqual([
      expect.objectContaining({
        operation: {
          type: "moveElements",
          moves: [{ elementId: "tbl_users", position: { x: 300, y: 80.6 } }],
        },
      }),
    ]);
  });

  it("restores the shown value for a non numeric position", async () => {
    const { user, store, notify } = renderPanel();

    const field = screen.getByLabelText<HTMLInputElement>("Y");
    await user.clear(field);
    await user.type(field, "abc{Enter}");

    expect(notify).not.toHaveBeenCalled();
    expect(store.getState().history.past).toHaveLength(0);
    expect(field.value).toBe("81");
  });

  it("does not dispatch an empty position", async () => {
    const { user, store, notify } = renderPanel();

    await user.clear(screen.getByLabelText("X"));
    await user.tab();

    expect(notify).not.toHaveBeenCalled();
    expect(store.getState().history.past).toHaveLength(0);
  });

  it("shows the translated issue of a duplicated table name", () => {
    renderPanel(createDocumentWithIssues());

    const field = screen.getByLabelText("Table name");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(
      screen.getByRole("textbox", {
        name: "Table name",
        description: "Another table or enum is already named “users”.",
      }),
    ).toBe(field);
  });

  it("asks to create a relation from this table", async () => {
    const { user, onCreateRelation } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Add relation" }));

    expect(onCreateRelation).toHaveBeenCalledWith("tbl_users");
  });

  it("asks to delete the table", async () => {
    const { user, onDelete } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Delete table" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("shows the Vietnamese labels", () => {
    const store = createEditorStore({
      schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
      document: createDocument(),
      generateId: createCounterIdGenerator(),
      notify: vi.fn<Notify>(),
      logger: {
        error: vi.fn<Logger["error"]>(),
        warn: vi.fn<Logger["warn"]>(),
      },
    });
    renderWithProviders(
      <EditorStoreProvider store={store}>
        <TablePanel
          tableId="tbl_users"
          onCreateRelation={vi.fn<(tableId: TableId) => void>()}
          onDelete={vi.fn<() => void>()}
        />
      </EditorStoreProvider>,
      { locale: "vi" },
    );

    expect(screen.getByLabelText("Tên bảng")).toBeDefined();
    expect(screen.getByRole("button", { name: "Xóa bảng" })).toBeDefined();
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderPanel(createDocument(), themePreference);

      await expectNoAxeViolations(container);
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations with issues and open details in the %s theme",
    async (themePreference) => {
      const { container, user } = renderPanel(
        createDocumentWithIssues(),
        themePreference,
      );

      await user.click(screen.getByRole("button", { name: "Details" }));

      await expectNoAxeViolations(container);
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations with the type combobox open in the %s theme",
    async (themePreference) => {
      const { user } = renderPanel(createDocument(), themePreference);

      await user.click(
        screen.getByRole("button", {
          name: "Type of column email varchar(255)",
        }),
      );
      await screen.findByRole("listbox");

      await expectNoAxeViolations(document.body);
    },
  );

  it("tags the name and comment fields with their issue paths", () => {
    renderPanel();

    expect(
      screen.getByLabelText("Table name").getAttribute("data-focus-path"),
    ).toBe(JSON.stringify(["tables", "tbl_users", "name"]));
    expect(
      screen.getByLabelText("Table comment").getAttribute("data-focus-path"),
    ).toBe(JSON.stringify(["tables", "tbl_users", "comment"]));
  });
});
