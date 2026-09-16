import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { ViewportControls } from "../../lib/viewport-controls";
import {
  VIEWPORT_TRANSITION_MS,
  ViewportControlsProvider,
} from "../../lib/viewport-controls";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { IssueListTab } from "./issue-list-tab";

const CURRENT_ZOOM = 1.5;

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly setCenter: ReturnType<typeof vi.fn<ViewportControls["setCenter"]>>;
};

type HarnessOptions = {
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
};

function createValidDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
  });
}

// Validation sorts issues by path: `enums` < `relations` < `tables`.
function createDocumentWithIssues(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users", position: { x: 10, y: 20 } }),
      makeTable({ id: "tbl_people", name: "users" }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
    columns: [
      makeColumn({
        id: "col_users_email",
        tableId: "tbl_users",
        name: "email",
      }),
      makeColumn({
        id: "col_orders_user",
        tableId: "tbl_orders",
        name: "user_email",
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_orders_users",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_orders_user", toColumnId: "col_users_email" },
        ],
      }),
    ],
    enums: [makeEnum({ id: "enum_status", name: "status", values: [] })],
  });
}

// Two indexes of "orders" share a name, so both report `index-name-duplicate`.
function createDocumentWithIndexIssue(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({
        id: "tbl_orders",
        name: "orders",
        position: { x: 30, y: 40 },
      }),
    ],
    columns: [
      makeColumn({
        id: "col_orders_code",
        tableId: "tbl_orders",
        name: "code",
      }),
    ],
    indexes: [
      makeIndex({
        id: "idx_orders_a",
        tableId: "tbl_orders",
        name: "orders_code_idx",
        columnIds: ["col_orders_code"],
      }),
      makeIndex({
        id: "idx_orders_b",
        tableId: "tbl_orders",
        name: "orders_code_idx",
        columnIds: ["col_orders_code"],
      }),
    ],
  });
}

function renderIssueList(
  document: SchemaDocument,
  options: HarnessOptions = {},
): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const setCenter = vi.fn<ViewportControls["setCenter"]>();
  const controls: ViewportControls = {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter,
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => CURRENT_ZOOM),
  };
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <ViewportControlsProvider controls={controls}>
        <IssueListTab />
      </ViewportControlsProvider>
    </EditorStoreProvider>,
    {
      locale: options.locale ?? "en",
      themePreference: options.themePreference ?? "light",
    },
  );
  return { ...result, store, setCenter };
}

const USERS_DUPLICATE_MESSAGE =
  "Another table or enum is already named “users”.";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IssueListTab", () => {
  it("shows the empty message when there is no issue", () => {
    renderIssueList(createValidDocument());

    expect(screen.getByText("No issues")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["en", `Go to: ${USERS_DUPLICATE_MESSAGE}`],
    ["vi", "Đi tới: Bảng “users” trùng tên với một bảng hoặc enum khác."],
  ] as const)(
    "shows a translated message with the element name in %s",
    (locale, name) => {
      renderIssueList(createDocumentWithIssues(), { locale });

      expect(screen.getAllByRole("button", { name })).toHaveLength(2);
    },
  );

  it("selects the table and centers it when a table issue is clicked", async () => {
    const { user, store, setCenter } = renderIssueList(
      createDocumentWithIssues(),
    );

    const [usersIssue] = screen.getAllByRole("button", {
      name: `Go to: ${USERS_DUPLICATE_MESSAGE}`,
    });
    if (usersIssue === undefined) {
      throw new Error("Expected an issue of the users table.");
    }
    // Paths sort by id, so `tbl_people` comes before `tbl_users`.
    await user.click(usersIssue);

    expect(store.getState().selection).toStrictEqual({
      tableIds: ["tbl_people"],
      relationIds: [],
    });
    expect(setCenter).toHaveBeenCalledExactlyOnceWith(0, 0, {
      zoom: CURRENT_ZOOM,
      duration: VIEWPORT_TRANSITION_MS,
    });
  });

  it("selects and centers the table of an index issue", async () => {
    const { user, store, setCenter } = renderIssueList(
      createDocumentWithIndexIssue(),
    );

    const [indexIssue] = screen.getAllByRole("button", {
      name: "Go to: Another index is already named “orders_code_idx”.",
    });
    if (indexIssue === undefined) {
      throw new Error("Expected an index issue.");
    }
    await user.click(indexIssue);

    expect(store.getState().selection).toStrictEqual({
      tableIds: ["tbl_orders"],
      relationIds: [],
    });
    expect(setCenter).toHaveBeenCalledExactlyOnceWith(30, 40, {
      zoom: CURRENT_ZOOM,
      duration: VIEWPORT_TRANSITION_MS,
    });
  });

  it("selects the relation of a relation issue", async () => {
    const { user, store, setCenter } = renderIssueList(
      createDocumentWithIssues(),
    );

    await user.click(
      screen.getByRole("button", { name: /points at column “user_email”/ }),
    );

    expect(store.getState().selection).toStrictEqual({
      tableIds: [],
      relationIds: ["rel_orders_users"],
    });
    expect(setCenter).not.toHaveBeenCalled();
  });

  it("opens the enums tab for an enum issue", async () => {
    const { user, store } = renderIssueList(createDocumentWithIssues());

    await user.click(
      screen.getByRole("button", { name: /Enum “status” has no values/ }),
    );

    expect(store.getState().leftPanelTab).toBe("enums");
  });

  it("requests focus on the path of the issue", async () => {
    const { user, store } = renderIssueList(createDocumentWithIssues());

    await user.click(
      screen.getByRole("button", { name: /Enum “status” has no values/ }),
    );

    expect(store.getState().focusRequest).toStrictEqual([
      "enums",
      "enum_status",
      "values",
    ]);
  });

  it("keeps the order of validateSchema", () => {
    renderIssueList(createDocumentWithIssues());

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toStrictEqual([
      "Go to: Enum “status” has no values.",
      "Go to: The relation points at column “user_email”, which is neither a primary key nor unique.",
      `Go to: ${USERS_DUPLICATE_MESSAGE}`,
      `Go to: ${USERS_DUPLICATE_MESSAGE}`,
    ]);
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderIssueList(createDocumentWithIssues(), {
        themePreference,
      });

      await expectNoAxeViolations(container);
    },
  );
});
