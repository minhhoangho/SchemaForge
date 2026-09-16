import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
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
import { ColumnList } from "./column-list";

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
};

function createDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_id"],
      }),
    ],
    columns: [
      makeColumn({
        id: "col_id",
        tableId: "tbl_users",
        name: "id",
        type: { kind: "bigint" },
      }),
      makeColumn({
        id: "col_email",
        tableId: "tbl_users",
        name: "email",
        type: { kind: "varchar", length: 255 },
      }),
      makeColumn({
        id: "col_code",
        tableId: "tbl_users",
        name: "code",
        type: { kind: "text" },
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
      <ColumnList tableId="tbl_users" />
    </EditorStoreProvider>,
    { locale: "en" },
  );
  return { ...result, store };
}

function columnNames(store: EditorStore): readonly string[] {
  const { document } = store.getState();
  return (document.tables.tbl_users?.columnIds ?? []).map(
    (columnId) => document.columns[columnId]?.name ?? "",
  );
}

function row(name: string): HTMLElement {
  return screen.getByRole("group", { name });
}

describe("ColumnList", () => {
  it("adds a column with the suggested name and focuses it", async () => {
    const { user, store } = renderList();

    await user.click(screen.getByRole("button", { name: "Add column" }));

    const schema = store.getState().document;
    const columnIds = schema.tables.tbl_users?.columnIds ?? [];
    const added = schema.columns[columnIds[3] ?? "col_missing"];
    expect(added).toMatchObject({
      name: "column_1",
      type: { kind: "varchar", length: 255 },
      isNullable: false,
      defaultValue: null,
      isUnique: false,
      isAutoIncrement: false,
      comment: "",
    });
    expect(document.activeElement).toBe(
      within(row("column_1")).getByLabelText("Column name"),
    );
  });

  it("renames a column on Enter", async () => {
    const { user, store } = renderList();

    const field = within(row("email")).getByLabelText("Column name");
    await user.clear(field);
    await user.type(field, "mail{Enter}");

    expect(store.getState().document.columns.col_email?.name).toBe("mail");
  });

  it("toggles nullable, unique and auto increment", async () => {
    const { user, store } = renderList();
    const email = within(row("email"));

    await user.click(email.getByRole("checkbox", { name: "Nullable" }));
    await user.click(email.getByRole("checkbox", { name: "Unique" }));
    await user.click(email.getByRole("checkbox", { name: "Auto-increment" }));

    expect(store.getState().document.columns.col_email).toMatchObject({
      isNullable: true,
      isUnique: true,
      isAutoIncrement: true,
    });
    expect(store.getState().history.past).toHaveLength(3);
  });

  it("adds a column to the primary key at the end", async () => {
    const { user, store } = renderList();

    await user.click(
      within(row("code")).getByRole("checkbox", { name: "Primary key" }),
    );
    await user.click(
      within(row("email")).getByRole("checkbox", { name: "Primary key" }),
    );

    expect(
      store.getState().document.tables.tbl_users?.primaryKeyColumnIds,
    ).toEqual(["col_id", "col_code", "col_email"]);
    expect(store.getState().document.columns.col_email?.isNullable).toBe(false);
  });

  it("removes a column from the primary key", async () => {
    const { user, store } = renderList();

    await user.click(
      within(row("id")).getByRole("checkbox", { name: "Primary key" }),
    );

    expect(
      store.getState().document.tables.tbl_users?.primaryKeyColumnIds,
    ).toEqual([]);
  });

  it("moves a column up and down", async () => {
    const { user, store } = renderList();

    await user.click(
      screen.getByRole("button", { name: "Move column code up" }),
    );
    expect(columnNames(store)).toEqual(["id", "code", "email"]);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Move column code up" }),
    );

    await user.click(
      screen.getByRole("button", { name: "Move column id down" }),
    );
    expect(columnNames(store)).toEqual(["code", "id", "email"]);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Move column id down" }),
    );
  });

  it("moves focus to move down when a column reaches the top", async () => {
    const { user } = renderList();

    await user.click(
      screen.getByRole("button", { name: "Move column email up" }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Move column email down" }),
    );
  });

  it("removes a column", async () => {
    const { user, store } = renderList();

    await user.click(
      screen.getByRole("button", { name: "Delete column email" }),
    );

    expect(columnNames(store)).toEqual(["id", "code"]);
    expect(document.activeElement).toBe(
      within(row("code")).getByLabelText("Column name"),
    );
  });

  it("focuses the add button after removing the only column", async () => {
    const { user } = renderList(
      buildSchema({
        tables: [makeTable({ id: "tbl_users" })],
        columns: [
          makeColumn({ id: "col_id", tableId: "tbl_users", name: "id" }),
        ],
      }),
    );

    await user.click(screen.getByRole("button", { name: "Delete column id" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add column" }),
    );
  });

  it("disables move up on the first column", () => {
    renderList();

    expect(
      screen
        .getByRole("button", { name: "Move column id up" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Move column code down" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Move column email up" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("shows the translated issue on the auto increment checkbox", () => {
    renderList(
      buildSchema({
        tables: [makeTable({ id: "tbl_users" })],
        columns: [
          makeColumn({
            id: "col_name",
            tableId: "tbl_users",
            name: "name",
            type: { kind: "text" },
            isAutoIncrement: true,
          }),
        ],
      }),
    );

    const checkbox = within(row("name")).getByRole("checkbox", {
      name: "Auto-increment",
    });
    expect(checkbox.getAttribute("aria-invalid")).toBe("true");
    expect(checkbox.getAttribute("aria-describedby")).not.toBeNull();
    expect(
      within(row("name")).getByRole("checkbox", {
        name: "Auto-increment",
        description:
          "Only an integer column can auto-increment, so column “name” cannot. Auto-increment column “name” has to be a primary key or unique.",
      }),
    ).toBe(checkbox);
  });

  it("points the details toggle at the details region", async () => {
    const { user } = renderList();
    const toggle = within(row("email")).getByRole("button", {
      name: "Details",
    });
    const controlsId = toggle.getAttribute("aria-controls") ?? "";

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(controlsId)).not.toBeNull();

    await user.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      within(
        document.getElementById(controlsId) ?? document.body,
      ).getByLabelText("Length"),
    ).toBeDefined();
  });

  it("tags the column fields with the issue paths they fix", () => {
    renderList();
    const email = within(row("email"));

    expect(
      email.getByLabelText("Column name").getAttribute("data-focus-path"),
    ).toBe(JSON.stringify(["columns", "col_email", "name"]));
    expect(
      email
        .getByRole("button", { name: "Type of column email varchar(255)" })
        .getAttribute("data-focus-path"),
    ).toBe(JSON.stringify(["columns", "col_email", "type"]));
    expect(
      [
        email.getByRole("checkbox", { name: "Nullable" }),
        email.getByRole("checkbox", { name: "Unique" }),
        email.getByRole("checkbox", { name: "Auto-increment" }),
      ].map((checkbox) => checkbox.getAttribute("data-focus-path")),
    ).toEqual([
      JSON.stringify(["columns", "col_email", "isNullable"]),
      JSON.stringify(["columns", "col_email", "isUnique"]),
      JSON.stringify(["columns", "col_email", "isAutoIncrement"]),
    ]);
  });

  it("opens the details of a column with an issue in them", () => {
    renderList(
      buildSchema({
        tables: [makeTable({ id: "tbl_users" })],
        columns: [
          makeColumn({
            id: "col_price",
            tableId: "tbl_users",
            name: "price",
            type: { kind: "decimal", precision: 4, scale: 6 },
          }),
        ],
      }),
    );

    const toggle = within(row("price")).getByRole("button", {
      name: "Details (has issues)",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      within(row("price")).getByRole("textbox", {
        name: "Scale",
        description:
          "The scale of column “price” cannot be larger than its precision.",
      }),
    ).toBeDefined();
  });

  it("opens the details when an issue appears in them", async () => {
    const { user } = renderList(
      buildSchema({
        tables: [makeTable({ id: "tbl_users" })],
        columns: [
          makeColumn({
            id: "col_code",
            tableId: "tbl_users",
            name: "code",
            type: { kind: "text" },
            defaultValue: { kind: "literal", value: "abc" },
          }),
        ],
      }),
    );
    const code = within(row("code"));
    expect(
      code
        .getByRole("button", { name: "Details" })
        .getAttribute("aria-expanded"),
    ).toBe("false");

    await user.click(
      code.getByRole("button", { name: "Type of column code text" }),
    );
    await user.click(await screen.findByRole("option", { name: "integer" }));

    expect(
      code
        .getByRole("button", { name: "Details (has issues)" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("names a column without a name in its labels", () => {
    renderList(
      buildSchema({
        tables: [makeTable({ id: "tbl_users" })],
        columns: [makeColumn({ id: "col_a", tableId: "tbl_users", name: "" })],
      }),
    );

    expect(
      within(row("(unnamed)")).getByRole("button", {
        name: "Delete column (unnamed)",
      }),
    ).toBeDefined();
  });
});
