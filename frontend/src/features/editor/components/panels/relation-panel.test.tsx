import type {
  ColumnPair,
  ReferentialAction,
  SchemaDocument,
} from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { EMPTY_SELECTION } from "../../lib/selection";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { RelationPanel } from "./relation-panel";

const RELATION_ID = "rel_orders_users";

const USER_ID_PAIR: ColumnPair = {
  fromColumnId: "col_orders_user_id",
  toColumnId: "col_users_id",
};

const NOTE_PAIR: ColumnPair = {
  fromColumnId: "col_orders_note",
  toColumnId: "col_users_email",
};

type DocumentOptions = {
  readonly columnPairs?: readonly ColumnPair[];
  readonly userIdType?: "integer" | "text";
  readonly onUpdate?: ReferentialAction;
  readonly isEmailUnique?: boolean;
};

function createDocument(options: DocumentOptions = {}): SchemaDocument {
  return buildSchema({
    name: "shop",
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
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
      makeColumn({
        id: "col_users_email",
        tableId: "tbl_users",
        name: "email",
        type: { kind: "text" },
        isUnique: options.isEmailUnique ?? true,
      }),
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
      makeColumn({
        id: "col_orders_user_id",
        tableId: "tbl_orders",
        name: "user_id",
        type: { kind: options.userIdType ?? "integer" },
      }),
      makeColumn({
        id: "col_orders_note",
        tableId: "tbl_orders",
        name: "note",
        type: { kind: "text" },
      }),
    ],
    relations: [
      makeRelation({
        id: RELATION_ID,
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: options.columnPairs ?? [USER_ID_PAIR],
        onUpdate: options.onUpdate ?? "noAction",
      }),
    ],
  });
}

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly onDeleted: ReturnType<typeof vi.fn<() => void>>;
};

type HarnessOptions = {
  readonly document?: SchemaDocument;
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
};

function renderPanel(options: HarnessOptions = {}): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: options.document ?? createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  store.getState().setSelection({ tableIds: [], relationIds: [RELATION_ID] });
  const onDeleted = vi.fn<() => void>();
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <RelationPanel relationId={RELATION_ID} onDeleted={onDeleted} />
    </EditorStoreProvider>,
    {
      locale: options.locale ?? "en",
      themePreference: options.themePreference ?? "light",
    },
  );
  return { ...result, store, onDeleted };
}

function currentRelation(store: EditorStore): unknown {
  return store.getState().document.relations[RELATION_ID];
}

async function choose(
  user: UserEvent,
  fieldName: string,
  optionName: string,
): Promise<void> {
  await user.click(screen.getByRole("combobox", { name: fieldName }));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("RelationPanel", () => {
  it("changes the relation kind", async () => {
    const { user, store } = renderPanel();

    await choose(user, "Relation type", "One to one");

    expect(currentRelation(store)).toMatchObject({ kind: "oneToOne" });
    expect(store.getState().history.past).toHaveLength(1);
  });

  it("offers only one-to-one and one-to-many", async () => {
    const { user } = renderPanel();

    await user.click(screen.getByRole("combobox", { name: "Relation type" }));
    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toStrictEqual([
      "One to many",
      "One to one",
    ]);
  });

  it("shows both table names", () => {
    renderPanel();

    expect(screen.getByText("orders")).toBeDefined();
    expect(screen.getByText("users")).toBeDefined();
    expect(
      screen.getByText(
        "To connect other tables, remove this relation and create a new one.",
      ),
    ).toBeDefined();
  });

  it("changes a column pair", async () => {
    const { user, store } = renderPanel();

    await choose(user, "From column, pair 1", "note");

    expect(currentRelation(store)).toMatchObject({
      columnPairs: [
        { fromColumnId: "col_orders_note", toColumnId: "col_users_id" },
      ],
    });
    expect(store.getState().history.past).toHaveLength(1);
  });

  it("offers only columns that no other pair uses", async () => {
    const { user } = renderPanel({
      document: createDocument({ columnPairs: [USER_ID_PAIR, NOTE_PAIR] }),
    });

    await user.click(
      screen.getByRole("combobox", { name: "From column, pair 2" }),
    );
    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toStrictEqual([
      "id",
      "note",
    ]);
  });

  it("adds a column pair", async () => {
    const { user, store } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Add column pair" }));

    expect(currentRelation(store)).toMatchObject({
      columnPairs: [
        USER_ID_PAIR,
        { fromColumnId: "col_orders_id", toColumnId: "col_users_email" },
      ],
    });
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: "From column, pair 2" }),
    );
  });

  it("disables adding a column pair when a table has no unpaired column", () => {
    renderPanel({
      document: createDocument({ columnPairs: [USER_ID_PAIR, NOTE_PAIR] }),
    });

    expect(
      screen
        .getByRole("button", { name: "Add column pair" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("removes a column pair and focuses the pair that takes its place", async () => {
    const { user, store } = renderPanel({
      document: createDocument({ columnPairs: [USER_ID_PAIR, NOTE_PAIR] }),
    });

    await user.click(
      screen.getByRole("button", { name: "Remove column pair 1" }),
    );

    expect(currentRelation(store)).toMatchObject({ columnPairs: [NOTE_PAIR] });
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: "From column, pair 1" }),
    );
  });

  it("disables removing the last column pair", () => {
    renderPanel();

    const button = screen.getByRole("button", {
      name: "Remove column pair 1",
      description: "A relation keeps at least one column pair.",
    });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("changes ON DELETE and ON UPDATE", async () => {
    const { user, store } = renderPanel();

    await choose(user, "On delete", "CASCADE");
    await choose(user, "On update", "RESTRICT");

    expect(currentRelation(store)).toMatchObject({
      onDelete: "cascade",
      onUpdate: "restrict",
    });
    expect(store.getState().history.past).toHaveLength(2);
  });

  it("offers all five referential actions", async () => {
    const { user } = renderPanel();

    await user.click(screen.getByRole("combobox", { name: "On delete" }));
    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toStrictEqual([
      "NO ACTION",
      "RESTRICT",
      "CASCADE",
      "SET NULL",
      "SET DEFAULT",
    ]);
  });

  it("shows the translated type mismatch issue on the column pairs", () => {
    renderPanel({ document: createDocument({ userIdType: "text" }) });

    const message =
      "Column “user_id” has a different type from the column it points at.";
    const field = screen.getByRole("combobox", {
      name: "From column, pair 1",
      description: message,
    });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(
      screen
        .getByRole("combobox", { name: "Relation type" })
        .hasAttribute("aria-invalid"),
    ).toBe(false);
  });

  it("shows a whole list issue once and marks every to column invalid", () => {
    renderPanel({
      document: createDocument({
        columnPairs: [
          { fromColumnId: "col_orders_user_id", toColumnId: "col_users_email" },
        ],
        isEmailUnique: false,
      }),
    });

    const mismatch =
      "Column “user_id” has a different type from the column it points at.";
    const notUnique =
      "The relation points at column “user_id”, which is neither a primary key nor unique.";
    expect(screen.getAllByText(mismatch)).toHaveLength(1);
    expect(screen.getAllByText(notUnique)).toHaveLength(1);
    const toField = screen.getByRole("combobox", {
      name: "To column, pair 1",
      description: `${mismatch} ${notUnique}`,
    });
    expect(toField.getAttribute("aria-invalid")).toBe("true");
    expect(toField.getAttribute("data-focus-path")).toBe(
      JSON.stringify(["relations", RELATION_ID, "columnPairs"]),
    );
    expect(
      screen.getByRole("combobox", {
        name: "From column, pair 1",
        description: mismatch,
      }),
    ).toBeDefined();
  });

  it("shows a referential action issue under its field", () => {
    renderPanel({ document: createDocument({ onUpdate: "setNull" }) });

    const message =
      "Column “user_id” has to allow NULL before the relation can set it to NULL.";
    expect(
      screen.getByRole("combobox", { name: "On update", description: message }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("combobox", { name: "On delete" })
        .hasAttribute("aria-invalid"),
    ).toBe(false);
  });

  it("removes the relation and clears the selection", async () => {
    const { user, store, onDeleted } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Remove relation" }));

    expect(store.getState().document.relations).toStrictEqual({});
    expect(store.getState().selection).toStrictEqual(EMPTY_SELECTION);
    expect(store.getState().history.past).toHaveLength(1);
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "en",
      [
        "Relation type",
        "From column, pair 1",
        "To column, pair 1",
        "On delete",
        "On update",
      ],
      ["Remove column pair 1", "Add column pair", "Remove relation"],
    ],
    [
      "vi",
      [
        "Loại quan hệ",
        "Cột nguồn, cặp 1",
        "Cột đích, cặp 1",
        "Khi xóa",
        "Khi cập nhật",
      ],
      ["Bỏ cặp cột 1", "Thêm cặp cột", "Xóa quan hệ"],
    ],
  ] as const)("names every field in %s", (locale, fieldNames, buttonNames) => {
    renderPanel({ locale });

    expect(
      fieldNames.map((name) => screen.getByRole("combobox", { name })),
    ).toHaveLength(fieldNames.length);
    expect(
      buttonNames.map((name) => screen.getByRole("button", { name })),
    ).toHaveLength(buttonNames.length);
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderPanel({ themePreference });

      await expectNoAxeViolations(container);
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations with an issue shown in the %s theme",
    async (themePreference) => {
      const { container } = renderPanel({
        document: createDocument({ userIdType: "text" }),
        themePreference,
      });

      await expectNoAxeViolations(container);
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations with a select open in the %s theme",
    async (themePreference) => {
      const { user } = renderPanel({ themePreference });

      await user.click(screen.getByRole("combobox", { name: "On delete" }));
      await screen.findAllByRole("option");

      await expectNoAxeViolations(document.body);
    },
  );
});
