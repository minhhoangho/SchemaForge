import type { Enum, SchemaDocument } from "@schemaforge/core";
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
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { ViewportControls } from "../../lib/viewport-controls";
import { ViewportControlsProvider } from "../../lib/viewport-controls";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { EnumListTab } from "./enum-list-tab";

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
};

function createDocument(enums: readonly Enum[]): SchemaDocument {
  return buildSchema({ name: "shop", enums });
}

function createDocumentWithEnumInUse(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [
      makeColumn({
        id: "col_users_status",
        tableId: "tbl_users",
        name: "status",
        type: { kind: "enum", enumId: "enum_status" },
      }),
    ],
    enums: [
      makeEnum({ id: "enum_status", name: "status", values: ["a", "A"] }),
      makeEnum({ id: "enum_empty", name: "empty", values: [] }),
    ],
  });
}

function renderEnumList(
  document: SchemaDocument,
  themePreference: ThemePreference = "light",
): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const controls: ViewportControls = {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter: vi.fn<ViewportControls["setCenter"]>(),
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => 1),
  };
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <ViewportControlsProvider controls={controls}>
        <EnumListTab />
      </ViewportControlsProvider>
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
  return { ...result, store };
}

function renderStatusEnum(values: readonly string[]): Harness {
  return renderEnumList(
    createDocument([makeEnum({ id: "enum_status", name: "status", values })]),
  );
}

function valuesOf(store: EditorStore): readonly string[] | undefined {
  return store.getState().document.enums.enum_status?.values;
}

function describedText(element: HTMLElement): string | null | undefined {
  const describedById = element.getAttribute("aria-describedby");
  return describedById === null
    ? null
    : document.getElementById(describedById)?.textContent;
}

describe("EnumListTab", () => {
  it("shows the empty message when there is no enum", () => {
    renderEnumList(createDocument([]));

    expect(screen.getByText("No enums yet.")).toBeDefined();
  });

  it("renames an enum on blur", async () => {
    const { user, store } = renderStatusEnum(["active"]);

    const field = screen.getByLabelText("Enum name");
    await user.clear(field);
    await user.type(field, "state");
    await user.tab();

    expect(store.getState().document.enums.enum_status?.name).toBe("state");
    expect(store.getState().history.past).toHaveLength(1);
  });

  it("adds a value and focuses the new field", async () => {
    const { user, store } = renderStatusEnum(["active"]);

    await user.click(screen.getByRole("button", { name: "Add value" }));

    expect(valuesOf(store)).toStrictEqual(["active", "value_1"]);
    expect(document.activeElement).toBe(screen.getByLabelText("Value 2"));
  });

  it("changes a value with the whole list of values", async () => {
    const { user, store } = renderStatusEnum(["active", "banned"]);

    const field = screen.getByLabelText("Value 2");
    await user.clear(field);
    await user.type(field, "blocked{Enter}");

    expect(store.getState().history.past[0]?.operation).toStrictEqual({
      type: "updateEnum",
      enumId: "enum_status",
      changes: { values: ["active", "blocked"] },
    });
  });

  it("moves a value up and down with one dispatch each", async () => {
    const { user, store } = renderStatusEnum(["a", "b", "c"]);

    await user.click(
      screen.getByRole("button", { name: "Move value 2 (b) up" }),
    );
    expect(valuesOf(store)).toStrictEqual(["b", "a", "c"]);
    expect(store.getState().history.past).toHaveLength(1);

    await user.click(
      screen.getByRole("button", { name: "Move value 2 (a) down" }),
    );
    expect(valuesOf(store)).toStrictEqual(["b", "c", "a"]);
    expect(store.getState().history.past).toHaveLength(2);
  });

  it("keeps focus on the moved value", async () => {
    const { user } = renderStatusEnum(["a", "b", "c"]);

    await user.click(
      screen.getByRole("button", { name: "Move value 3 (c) up" }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Move value 2 (c) up" }),
    );
  });

  it("moves focus to the other move button when the moved value reaches an end", async () => {
    const { user } = renderStatusEnum(["a", "b", "c"]);

    await user.click(
      screen.getByRole("button", { name: "Move value 2 (b) up" }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Move value 1 (b) down" }),
    );
  });

  it("keeps focus on the moved value when it moves down to the end", async () => {
    const { user } = renderStatusEnum(["a", "b", "c"]);

    await user.click(
      screen.getByRole("button", { name: "Move value 2 (b) down" }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Move value 3 (b) up" }),
    );
  });

  it("names the buttons of an empty value with a placeholder word", () => {
    renderStatusEnum([""]);

    expect(
      screen.getByRole("button", { name: "Remove value 1 (empty)" }),
    ).toBeDefined();
  });

  it("names the group of an enum without a name after the name field", () => {
    renderEnumList(
      createDocument([
        makeEnum({ id: "enum_status", name: "", values: ["a"] }),
      ]),
    );

    expect(screen.getByRole("group", { name: "Enum name" })).toBeDefined();
  });

  it.each([
    ["name", ["enums", "enum_status", "name"], "Enum name"],
    ["second value", ["enums", "enum_status", "values", 1], "Value 2"],
  ] as const)(
    "exposes the focus path of the %s field",
    (_field, path, label) => {
      renderStatusEnum(["a", "b"]);

      expect(screen.getByLabelText(label).getAttribute("data-focus-path")).toBe(
        JSON.stringify(path),
      );
    },
  );

  it("disables move up on the first value", () => {
    renderStatusEnum(["a", "b"]);

    expect(
      screen.getByRole("button", { name: "Move value 1 (a) up" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Move value 2 (b) up" }),
    ).toHaveProperty("disabled", false);
  });

  it("disables move down on the last value", () => {
    renderStatusEnum(["a", "b"]);

    expect(
      screen.getByRole("button", { name: "Move value 2 (b) down" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Move value 1 (a) down" }),
    ).toHaveProperty("disabled", false);
  });

  it("removes a value", async () => {
    const { user, store } = renderStatusEnum(["a", "b", "c"]);

    await user.click(
      screen.getByRole("button", { name: "Remove value 2 (b)" }),
    );

    expect(valuesOf(store)).toStrictEqual(["a", "c"]);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Remove value 2 (c)" }),
    );
  });

  it("moves focus to the add value button after removing the only value", async () => {
    const { user, store } = renderStatusEnum(["a"]);

    await user.click(
      screen.getByRole("button", { name: "Remove value 1 (a)" }),
    );

    expect(valuesOf(store)).toStrictEqual([]);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add value" }),
    );
  });

  it("disables deleting an enum that is in use and lists the columns", () => {
    renderEnumList(createDocumentWithEnumInUse());

    const group = screen.getByRole("group", { name: "status" });
    const deleteButton = within(group).getByRole("button", {
      name: "Delete enum",
    });
    expect(deleteButton).toHaveProperty("disabled", true);
    expect(describedText(deleteButton)).toContain("users.status");
  });

  it("deletes an unused enum and focuses the next enum name", async () => {
    const { user, store } = renderEnumList(createDocumentWithEnumInUse());

    const group = screen.getByRole("group", { name: "empty" });
    await user.click(
      within(group).getByRole("button", { name: "Delete enum" }),
    );

    expect(store.getState().document.enums.enum_empty).toBeUndefined();
    expect(document.activeElement).toBe(
      within(screen.getByRole("group", { name: "status" })).getByLabelText(
        "Enum name",
      ),
    );
  });

  it("moves focus to the empty message after deleting the last enum", async () => {
    const { user } = renderStatusEnum(["a"]);

    await user.click(screen.getByRole("button", { name: "Delete enum" }));

    expect(document.activeElement).toBe(screen.getByText("No enums yet."));
  });

  it("shows the translated issue of an empty enum", () => {
    renderEnumList(createDocumentWithEnumInUse());

    const group = screen.getByRole("group", { name: "empty" });
    expect(
      within(group).getByText("Enum “empty” has no values."),
    ).toBeDefined();
  });

  it("shows the translated issue on the duplicated value field", () => {
    renderEnumList(createDocumentWithEnumInUse());

    const field = screen.getByLabelText("Value 2");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(describedText(field)).toBe(
      "Enum “status” lists the value “A” more than once.",
    );
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      renderEnumList(createDocumentWithEnumInUse(), themePreference);

      await expectNoAxeViolations(document.body);
    },
  );
});
