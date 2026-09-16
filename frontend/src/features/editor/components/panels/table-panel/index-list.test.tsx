import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeIndex,
  makeTable,
} from "@schemaforge/core/testing";
import { screen, within } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { renderWithProviders } from "@/testing/render-with-providers";

import { createEditorStore } from "../../../state/create-editor-store";
import type { EditorStore } from "../../../state/create-editor-store";
import { EditorStoreProvider } from "../../../state/editor-store-provider";
import { IndexList } from "./index-list";

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
};

const USERS_COLUMNS = [
  makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" }),
  makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  makeColumn({ id: "col_code", tableId: "tbl_users", name: "code" }),
];

function createDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_id"],
      }),
    ],
    columns: USERS_COLUMNS,
    indexes: [
      makeIndex({
        id: "idx_email",
        tableId: "tbl_users",
        name: "users_email_idx",
        columnIds: ["col_email"],
      }),
    ],
  });
}

function renderList(document: SchemaDocument = createDocument()): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <IndexList tableId="tbl_users" />
    </EditorStoreProvider>,
    { locale: "en" },
  );
  return { ...result, store };
}

function indexColumnIds(store: EditorStore): readonly string[] {
  return store.getState().document.indexes.idx_email?.columnIds ?? [];
}

async function addIndexColumn(
  user: UserEvent,
  columnName: string,
): Promise<void> {
  await user.click(
    within(screen.getByRole("group", { name: "users_email_idx" })).getByRole(
      "combobox",
      { name: "Add index column" },
    ),
  );
  await user.click(await screen.findByRole("option", { name: columnName }));
}

describe("IndexList", () => {
  it("creates an index named by suggestIndexName", async () => {
    const { user, store } = renderList();

    await user.click(screen.getByRole("button", { name: "Add index" }));

    const created = Object.values(store.getState().document.indexes).find(
      (index) => index.id !== "idx_email",
    );
    expect(created).toMatchObject({
      tableId: "tbl_users",
      name: "users_id_idx",
      columnIds: ["col_id"],
      isUnique: false,
    });
    expect(document.activeElement).toBe(
      within(
        screen.getByRole("group", { name: "users_id_idx" }),
      ).getByLabelText("Index name"),
    );
  });

  it("uses the first column when the table has no primary key", async () => {
    const { user, store } = renderList(
      buildSchema({
        tables: [makeTable({ id: "tbl_users", name: "users" })],
        columns: USERS_COLUMNS,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Add index" }));

    expect(Object.values(store.getState().document.indexes)).toEqual([
      expect.objectContaining({ name: "users_id_idx", columnIds: ["col_id"] }),
    ]);
  });

  it("disables adding an index for a table without columns", () => {
    renderList(
      buildSchema({ tables: [makeTable({ id: "tbl_users", name: "users" })] }),
    );

    expect(
      screen
        .getByRole("button", { name: "Add index" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("renames an index", async () => {
    const { user, store } = renderList();

    const field = screen.getByLabelText("Index name");
    await user.clear(field);
    await user.type(field, "users_mail_idx{Enter}");

    expect(store.getState().document.indexes.idx_email?.name).toBe(
      "users_mail_idx",
    );
  });

  it("adds and removes index columns", async () => {
    const { user, store } = renderList();

    await addIndexColumn(user, "code");
    expect(indexColumnIds(store)).toEqual(["col_email", "col_code"]);

    await user.click(
      screen.getByRole("button", {
        name: "Remove email from index users_email_idx",
      }),
    );
    expect(indexColumnIds(store)).toEqual(["col_code"]);
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: "Add index column" }),
    );
  });

  it("offers only columns that are not in the index yet", async () => {
    const { user } = renderList();

    await user.click(
      screen.getByRole("combobox", { name: "Add index column" }),
    );

    expect(
      (await screen.findAllByRole("option")).map(
        (option) => option.textContent,
      ),
    ).toEqual(["id", "code"]);
  });

  it("moves an index column", async () => {
    const { user, store } = renderList();

    await addIndexColumn(user, "code");
    await user.click(
      screen.getByRole("button", {
        name: "Move code up in index users_email_idx",
      }),
    );

    expect(indexColumnIds(store)).toEqual(["col_code", "col_email"]);
    expect(document.activeElement).toBe(
      screen.getByRole("button", {
        name: "Move code down in index users_email_idx",
      }),
    );
  });

  it("disables removing the last index column", () => {
    renderList();

    expect(
      screen
        .getByRole("button", {
          name: "Remove email from index users_email_idx",
        })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByText("An index needs at least one column."),
    ).toBeDefined();
  });

  it("toggles unique", async () => {
    const { user, store } = renderList();

    await user.click(screen.getByRole("checkbox", { name: "Unique" }));

    expect(store.getState().document.indexes.idx_email?.isUnique).toBe(true);
  });

  it("removes an index", async () => {
    const { user, store } = renderList();

    await user.click(
      screen.getByRole("button", { name: "Delete index users_email_idx" }),
    );

    expect(store.getState().document.indexes).toEqual({});
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add index" }),
    );
  });

  it("shows the translated issue of a duplicated index name", () => {
    renderList(
      buildSchema({
        tables: [makeTable({ id: "tbl_users", name: "users" })],
        columns: USERS_COLUMNS,
        indexes: [
          makeIndex({
            id: "idx_a",
            tableId: "tbl_users",
            name: "dup",
            columnIds: ["col_id"],
          }),
          makeIndex({
            id: "idx_b",
            tableId: "tbl_users",
            name: "DUP",
            columnIds: ["col_email"],
          }),
        ],
      }),
    );

    expect(
      within(screen.getByRole("group", { name: "dup" })).getByRole("textbox", {
        name: "Index name",
        description: "Another index is already named “dup”.",
      }),
    ).toBeDefined();
  });

  it("tags the index fields with their issue paths", () => {
    renderList();
    const index = within(
      screen.getByRole("group", { name: "users_email_idx" }),
    );

    expect(
      index.getByLabelText("Index name").getAttribute("data-focus-path"),
    ).toBe(JSON.stringify(["indexes", "idx_email", "name"]));
    expect(
      index
        .getByRole("checkbox", { name: "Unique" })
        .getAttribute("data-focus-path"),
    ).toBe(JSON.stringify(["indexes", "idx_email", "isUnique"]));
  });

  it("names an index and a column without a name in its labels", () => {
    renderList(
      buildSchema({
        tables: [makeTable({ id: "tbl_users", name: "users" })],
        columns: [makeColumn({ id: "col_a", tableId: "tbl_users", name: "" })],
        indexes: [
          makeIndex({
            id: "idx_a",
            tableId: "tbl_users",
            name: "",
            columnIds: ["col_a"],
          }),
        ],
      }),
    );

    expect(
      screen.getByRole("button", {
        name: "Move (unnamed) up in index (unnamed)",
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Delete index (unnamed)" }),
    ).toBeDefined();
  });

  it("shows the full index column name as its title", () => {
    renderList();

    const name = within(
      screen.getByRole("list", { name: "Index columns" }),
    ).getByText("email");
    expect(name.getAttribute("title")).toBe("email");
  });
});
