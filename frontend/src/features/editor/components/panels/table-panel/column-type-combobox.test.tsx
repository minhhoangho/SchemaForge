import type { ColumnType, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
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
import { ColumnTypeCombobox } from "./column-type-combobox";

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
};

function createDocument(type: ColumnType): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [
      makeColumn({
        id: "col_email",
        tableId: "tbl_users",
        name: "email",
        type,
      }),
    ],
    enums: [
      makeEnum({ id: "enum_status", name: "status" }),
      makeEnum({ id: "enum_role", name: "role" }),
    ],
  });
}

function renderCombobox(
  type: ColumnType = { kind: "varchar", length: 40 },
): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(type),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <ColumnTypeCombobox columnId="col_email" />
    </EditorStoreProvider>,
    { locale: "en" },
  );
  return { ...result, store };
}

async function openCombobox(user: UserEvent, typeText: string): Promise<void> {
  await user.click(
    screen.getByRole("button", { name: `Type of column email ${typeText}` }),
  );
  await screen.findByRole("listbox");
}

function optionNames(): readonly string[] {
  return screen.getAllByRole("option").map((option) => option.textContent);
}

describe("ColumnTypeCombobox", () => {
  it("lists the common types, the enums and the custom entry", async () => {
    const { user } = renderCombobox();

    await openCombobox(user, "varchar(40)");

    expect(optionNames()).toEqual([
      "smallint",
      "integer",
      "bigint",
      "decimal",
      "real",
      "double",
      "boolean",
      "char",
      "varchar (current)",
      "text",
      "uuid",
      "date",
      "time",
      "timestamp",
      "timestamptz",
      "json",
      "binary",
      "role",
      "status",
      "Custom type…",
    ]);
    expect(screen.getByRole("group", { name: "Common types" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Enums" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Custom" })).toBeDefined();
    expect(
      screen.getByRole("combobox", { name: "Search types" }),
    ).toBeDefined();
  });

  it("filters the list while typing", async () => {
    const { user } = renderCombobox();

    await openCombobox(user, "varchar(40)");
    await user.type(
      screen.getByRole("combobox", { name: "Search types" }),
      "timest",
    );

    expect(optionNames()).toEqual(["timestamp", "timestamptz"]);
  });

  it("changes the column type", async () => {
    const { user, store } = renderCombobox();

    await openCombobox(user, "varchar(40)");
    await user.click(screen.getByRole("option", { name: "uuid" }));

    expect(store.getState().document.columns.col_email?.type).toEqual({
      kind: "uuid",
    });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Type of column email uuid" }),
    );
  });

  it("keeps the length when switching from varchar to char", async () => {
    const { user, store } = renderCombobox();

    await openCombobox(user, "varchar(40)");
    await user.click(screen.getByRole("option", { name: "char" }));

    expect(store.getState().document.columns.col_email?.type).toEqual({
      kind: "char",
      length: 40,
    });
  });

  it("uses an enum as the column type", async () => {
    const { user, store } = renderCombobox();

    await openCombobox(user, "varchar(40)");
    await user.click(screen.getByRole("option", { name: "status" }));

    expect(store.getState().document.columns.col_email?.type).toEqual({
      kind: "enum",
      enumId: "enum_status",
    });
    expect(
      screen.getByRole("button", { name: "Type of column email status" }),
    ).toBeDefined();
  });

  it.each([
    ["text", { kind: "text" }, "text"],
    ["decimal", { scale: 2, precision: 10, kind: "decimal" }, "decimal(10,2)"],
  ] as const)(
    "does not dispatch when the same %s type is picked",
    async (kind, type, typeText) => {
      const { user, store } = renderCombobox(type);

      await openCombobox(user, typeText);
      await user.click(
        screen.getByRole("option", { name: `${kind} (current)` }),
      );

      expect(store.getState().history.past).toHaveLength(0);
    },
  );

  it("sets a custom type name", async () => {
    const { user, store } = renderCombobox();

    await openCombobox(user, "varchar(40)");
    await user.click(screen.getByRole("option", { name: "Custom type…" }));
    const field = screen.getByLabelText("Custom type name");
    expect(document.activeElement).toBe(field);
    await user.type(field, "citext{Enter}");

    expect(store.getState().document.columns.col_email?.type).toEqual({
      kind: "custom",
      name: "citext",
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Type of column email citext" }),
    );
  });

  it("returns focus to the trigger when closed with Escape", async () => {
    const { user } = renderCombobox();

    await openCombobox(user, "varchar(40)");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Type of column email varchar(40)" }),
    );
  });

  it("shows decimal parameters on the trigger", () => {
    renderCombobox({ kind: "decimal", precision: 10, scale: 2 });

    const trigger = screen.getByRole("button", {
      name: "Type of column email decimal(10,2)",
    });
    expect(within(trigger).getByText("decimal(10,2)")).toBeDefined();
  });

  it("searches enums by name and not by id", async () => {
    const { user } = renderCombobox();

    await openCombobox(user, "varchar(40)");
    const search = screen.getByRole("combobox", { name: "Search types" });
    await user.type(search, "enum_");

    expect(screen.queryAllByRole("option")).toEqual([]);
    expect(screen.getByText("No type found.")).toBeDefined();

    await user.clear(search);
    await user.type(search, "stat");

    expect(optionNames()).toEqual(["status"]);
  });

  it("marks the current enum for screen readers", async () => {
    const { user } = renderCombobox({ kind: "enum", enumId: "enum_role" });

    await openCombobox(user, "role");

    expect(
      screen.getByRole("option", { name: "role (current)" }),
    ).toBeDefined();
  });

  it("shows the full type name as the title of the trigger text", () => {
    renderCombobox({ kind: "custom", name: "geography(point, 4326)" });

    expect(
      screen.getByText("geography(point, 4326)").getAttribute("title"),
    ).toBe("geography(point, 4326)");
  });
});
