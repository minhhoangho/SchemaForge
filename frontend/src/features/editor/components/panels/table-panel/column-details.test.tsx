import type {
  Column,
  ColumnDefault,
  ColumnType,
  SchemaDocument,
} from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { renderWithProviders } from "@/testing/render-with-providers";

import { createEditorStore } from "../../../state/create-editor-store";
import type { EditorStore } from "../../../state/create-editor-store";
import { EditorStoreProvider } from "../../../state/editor-store-provider";
import { ColumnDetails } from "./column-details";

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
};

function createDocument(
  type: ColumnType,
  defaultValue: ColumnDefault | null,
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [
      makeColumn({
        id: "col_value",
        tableId: "tbl_users",
        name: "value",
        type,
        defaultValue,
      }),
    ],
  });
}

function renderDetails(
  type: ColumnType,
  defaultValue: ColumnDefault | null = null,
): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(type, defaultValue),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <ColumnDetails columnId="col_value" />
    </EditorStoreProvider>,
    { locale: "en" },
  );
  return { ...result, store };
}

function storedColumn(store: EditorStore): Column | undefined {
  return store.getState().document.columns.col_value;
}

function focusPathOf(element: HTMLElement): string | null {
  return element.getAttribute("data-focus-path");
}

describe("ColumnDetails", () => {
  it.each([
    ["timestamp", { kind: "timestamp" }, true],
    ["timestamptz", { kind: "timestamptz" }, true],
    ["date", { kind: "date" }, false],
  ] as const)(
    "offers currentTimestamp only for timestamp columns: %s",
    (_kind, type, isOffered) => {
      renderDetails(type);

      expect(
        screen.queryByRole("radio", { name: "Current timestamp" }) !== null,
      ).toBe(isOffered);
    },
  );

  it.each([
    ["uuid", { kind: "uuid" }, true],
    ["text", { kind: "text" }, false],
  ] as const)(
    "offers generateUuid only for uuid columns: %s",
    (_kind, type, isOffered) => {
      renderDetails(type);

      expect(
        screen.queryByRole("radio", { name: "Generated UUID" }) !== null,
      ).toBe(isOffered);
    },
  );

  it("offers no default kind for a binary column", () => {
    renderDetails({ kind: "binary" });

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "None" })).toBeDefined();
  });

  it("keeps showing a stored default that the type no longer allows", () => {
    renderDetails({ kind: "text" }, { kind: "generateUuid" });

    const radio = screen.getByRole("radio", { name: "Generated UUID" });
    expect(radio.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByRole("radiogroup", {
        name: "Default value",
        description:
          "The default value of column “value” cannot be used with its type.",
      }),
    ).toBeDefined();
  });

  it("stores a literal default", async () => {
    const { user, store } = renderDetails({ kind: "integer" });

    await user.click(screen.getByRole("radio", { name: "Value" }));
    expect(storedColumn(store)?.defaultValue).toEqual({
      kind: "literal",
      value: "",
    });

    await user.type(
      screen.getByRole("textbox", { name: "Literal default value" }),
      "42",
    );
    await user.tab();

    expect(storedColumn(store)?.defaultValue).toEqual({
      kind: "literal",
      value: "42",
    });
  });

  it("sets and clears an expression default", async () => {
    const { user, store } = renderDetails({ kind: "timestamp" });

    await user.click(screen.getByRole("radio", { name: "Current timestamp" }));
    expect(storedColumn(store)?.defaultValue).toEqual({
      kind: "currentTimestamp",
    });

    await user.click(screen.getByRole("radio", { name: "None" }));
    expect(storedColumn(store)?.defaultValue).toBeNull();
  });

  it("edits the length of a varchar column", async () => {
    const { user, store } = renderDetails({ kind: "varchar", length: 255 });

    const field = screen.getByLabelText("Length");
    await user.clear(field);
    await user.type(field, "80{Enter}");

    expect(storedColumn(store)?.type).toEqual({ kind: "varchar", length: 80 });
  });

  it("ignores a length that is not a positive whole number", async () => {
    const { user, store } = renderDetails({ kind: "char", length: 2 });

    const field = screen.getByLabelText<HTMLInputElement>("Length");
    await user.clear(field);
    await user.type(field, "1.5{Enter}");

    expect(store.getState().history.past).toHaveLength(0);
    expect(field.value).toBe("2");
  });

  it("edits precision and scale of a decimal column", async () => {
    const { user, store } = renderDetails({
      kind: "decimal",
      precision: 10,
      scale: 2,
    });

    const precision = screen.getByLabelText("Precision");
    await user.clear(precision);
    await user.type(precision, "12{Enter}");
    const scale = screen.getByLabelText("Scale");
    await user.clear(scale);
    await user.type(scale, "0{Enter}");

    expect(storedColumn(store)?.type).toEqual({
      kind: "decimal",
      precision: 12,
      scale: 0,
    });
  });

  it("edits the name of a custom type", async () => {
    const { user, store } = renderDetails({ kind: "custom", name: "citext" });

    const field = screen.getByLabelText("Custom type name");
    await user.clear(field);
    await user.type(field, "ltree{Enter}");

    expect(storedColumn(store)?.type).toEqual({
      kind: "custom",
      name: "ltree",
    });
  });

  it("stores the column comment", async () => {
    const { user, store } = renderDetails({ kind: "text" });

    await user.type(screen.getByLabelText("Column comment"), "Shown name");
    await user.tab();

    expect(storedColumn(store)?.comment).toBe("Shown name");
  });

  it("tags the type parameter fields with their issue paths", () => {
    renderDetails({ kind: "decimal", precision: 10, scale: 2 });

    expect(focusPathOf(screen.getByLabelText("Precision"))).toBe(
      JSON.stringify(["columns", "col_value", "type", "precision"]),
    );
    expect(focusPathOf(screen.getByLabelText("Scale"))).toBe(
      JSON.stringify(["columns", "col_value", "type", "scale"]),
    );
    expect(focusPathOf(screen.getByLabelText("Column comment"))).toBe(
      JSON.stringify(["columns", "col_value", "comment"]),
    );
  });

  it.each([
    ["length", { kind: "varchar", length: 20 }, "Length", "length"],
    [
      "custom name",
      { kind: "custom", name: "citext" },
      "Custom type name",
      "name",
    ],
  ] as const)(
    "tags the %s field with its issue path",
    (_field, type, label, segment) => {
      renderDetails(type);

      expect(focusPathOf(screen.getByLabelText(label))).toBe(
        JSON.stringify(["columns", "col_value", "type", segment]),
      );
    },
  );

  it("tags the checked default radio with the default value path", () => {
    renderDetails({ kind: "uuid" }, { kind: "generateUuid" });

    expect(
      focusPathOf(screen.getByRole("radio", { name: "Generated UUID" })),
    ).toBe(JSON.stringify(["columns", "col_value", "defaultValue"]));
    expect(focusPathOf(screen.getByRole("radio", { name: "None" }))).toBeNull();
  });

  it("tags the literal value field with the default value path", () => {
    renderDetails({ kind: "integer" }, { kind: "literal", value: "1" });

    expect(
      focusPathOf(
        screen.getByRole("textbox", { name: "Literal default value" }),
      ),
    ).toBe(JSON.stringify(["columns", "col_value", "defaultValue"]));
    expect(
      focusPathOf(screen.getByRole("radio", { name: "Value" })),
    ).toBeNull();
  });
});
