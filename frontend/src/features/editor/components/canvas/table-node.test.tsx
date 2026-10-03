import type { Operation, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { screen, within } from "@testing-library/react";
import type { Connection, Viewport } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { getTableAccentColor } from "../../lib/table-accent";
import { createEditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { EditorCanvas } from "./editor-canvas";
import { EditorFlowProvider } from "./editor-flow-provider";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const MEASURED_SIZE = { inlineSize: 1000, blockSize: 800 };

// jsdom's ResizeObserver stub never reports, so React Flow would keep every
// node hidden as unmeasured; this one reports each element once, right away.
class MeasuringResizeObserver implements ResizeObserver {
  readonly #callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    this.#callback(
      [
        {
          target,
          contentRect: new DOMRect(0, 0, 1000, 800),
          borderBoxSize: [MEASURED_SIZE],
          contentBoxSize: [MEASURED_SIZE],
          devicePixelContentBoxSize: [MEASURED_SIZE],
        },
      ],
      this,
    );
  }

  unobserve(): void {
    // Nothing is watched after the first report.
  }

  disconnect(): void {
    // Nothing is watched after the first report.
  }
}

type RenderOptions = {
  readonly themePreference?: ThemePreference;
  // Previewed as an AI proposal before the first render.
  readonly proposal?: Operation;
};

function renderCanvas(
  document: SchemaDocument,
  { themePreference = "light", proposal }: RenderOptions = {},
): ReturnType<typeof renderWithProviders> {
  const store = createEditorStore({
    schemaId: SCHEMA_ID,
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  if (proposal !== undefined) {
    const result = store.getState().startProposalPreview("msg_1", proposal);
    if (!result.isOk) {
      throw new Error(`The test proposal is ${result.error}.`);
    }
  }
  return renderWithProviders(
    <EditorStoreProvider store={store}>
      <EditorFlowProvider>
        <div style={{ width: 1000, height: 800 }}>
          <EditorCanvas
            defaultViewport={null}
            onMoveEnd={vi.fn<(viewport: Viewport) => void>()}
            onAddTable={vi.fn<() => void>()}
            onConnect={vi.fn<(connection: Connection) => void>()}
          />
        </div>
      </EditorFlowProvider>
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
}

function getTableNode(name: RegExp): HTMLElement {
  return screen.getByRole("group", { name });
}

function createUsersDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        comment: "Everyone who can sign in",
        primaryKeyColumnIds: ["col_user_id"],
      }),
    ],
    columns: [
      makeColumn({
        id: "col_user_id",
        tableId: "tbl_users",
        name: "id",
        isAutoIncrement: true,
      }),
      makeColumn({
        id: "col_user_email",
        tableId: "tbl_users",
        name: "email",
        type: { kind: "varchar", length: 255 },
        isUnique: true,
      }),
      makeColumn({
        id: "col_user_nickname",
        tableId: "tbl_users",
        name: "nickname",
        type: { kind: "text" },
        isNullable: true,
      }),
    ],
  });
}

function createShopDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_users", name: "users", position: { x: 0, y: 0 } }),
      makeTable({
        id: "tbl_orders",
        name: "orders",
        position: { x: 400, y: 0 },
      }),
    ],
    columns: [
      makeColumn({ id: "col_user_email", tableId: "tbl_users", name: "email" }),
      makeColumn({
        id: "col_user_nickname",
        tableId: "tbl_users",
        name: "nickname",
        type: { kind: "text" },
      }),
    ],
  });
}

const DIFF_PROPOSAL: Operation = {
  type: "batch",
  operations: [
    {
      type: "addTable",
      table: {
        id: "tbl_tags",
        name: "tags",
        comment: "",
        position: { x: 0, y: 400 },
        subjectAreaId: null,
      },
    },
    {
      type: "addColumn",
      column: makeColumn({
        id: "col_tag_id",
        tableId: "tbl_tags",
        name: "id",
      }),
      insertAt: 0,
    },
    {
      type: "setPrimaryKey",
      tableId: "tbl_tags",
      columnIds: ["col_tag_id"],
    },
    { type: "updateTable", tableId: "tbl_users", changes: { name: "members" } },
    {
      type: "updateColumn",
      columnId: "col_user_email",
      changes: { type: { kind: "text" } },
    },
    { type: "removeColumn", columnId: "col_user_nickname" },
    { type: "removeTable", tableId: "tbl_orders" },
  ],
};

function getColumnRow(name: string): HTMLElement {
  const row = within(getTableNode(/^Table members/))
    .getByText(name)
    .closest("li");
  if (row === null) {
    throw new Error(`Column ${name} has no row.`);
  }
  return row;
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MeasuringResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TableNode", () => {
  it("shows the table name and the column count in its label", () => {
    renderCanvas(createUsersDocument());

    expect(
      within(getTableNode(/^Table users, 3 columns$/)).getByText("users"),
    ).toBeDefined();
  });

  it("paints the table header with the accent of its table id", () => {
    renderCanvas(createUsersDocument());

    const header = within(getTableNode(/^Table users/)).getByText(
      "users",
    ).parentElement;

    expect(header?.style.backgroundColor).toBe(
      getTableAccentColor("tbl_users"),
    );
  });

  it("shows a comment icon with the comment in a tooltip", async () => {
    const { user } = renderCanvas(createUsersDocument());

    await user.hover(
      screen.getByRole("img", { name: "Comment: Everyone who can sign in" }),
    );

    expect((await screen.findByRole("tooltip")).textContent).toContain(
      "Everyone who can sign in",
    );
  });

  it("shows the full column name in a tooltip", async () => {
    const { user } = renderCanvas(createUsersDocument());

    await user.hover(
      within(getTableNode(/^Table users/)).getByText("nickname"),
    );

    expect((await screen.findByRole("tooltip")).textContent).toContain(
      "nickname",
    );
  });

  it("shows an issue badge with the number of issues of the table and its columns", () => {
    renderCanvas(
      buildSchema({
        tables: [
          makeTable({
            id: "tbl_users",
            name: "users",
            primaryKeyColumnIds: ["col_user_id"],
          }),
        ],
        columns: [
          // A nullable primary key column and an empty column name: one
          // issue each, both counted on the table.
          makeColumn({
            id: "col_user_id",
            tableId: "tbl_users",
            name: "id",
            isNullable: true,
          }),
          makeColumn({ id: "col_user_email", tableId: "tbl_users", name: "" }),
        ],
      }),
    );

    expect(
      within(getTableNode(/^Table users/)).getByRole("img", {
        name: "2 issues",
      }),
    ).toBeDefined();
  });

  it("marks a primary key column with an icon and screen reader text", () => {
    renderCanvas(createUsersDocument());

    const row = within(getTableNode(/^Table users/))
      .getByText("id")
      .closest("li");

    expect(row?.textContent).toContain("Primary key");
  });

  it("numbers the columns of a composite primary key", () => {
    renderCanvas(
      buildSchema({
        tables: [
          makeTable({
            id: "tbl_members",
            name: "members",
            primaryKeyColumnIds: ["col_member_team", "col_member_user"],
          }),
        ],
        columns: [
          makeColumn({
            id: "col_member_user",
            tableId: "tbl_members",
            name: "user_id",
          }),
          makeColumn({
            id: "col_member_team",
            tableId: "tbl_members",
            name: "team_id",
          }),
        ],
      }),
    );

    expect([
      screen.getByText("Primary key, position 1").closest("li")?.textContent,
      screen.getByText("Primary key, position 2").closest("li")?.textContent,
    ]).toEqual([
      expect.stringContaining("team_id"),
      expect.stringContaining("user_id"),
    ]);
  });

  it("marks a foreign key column", () => {
    renderCanvas(
      buildSchema({
        tables: [
          makeTable({
            id: "tbl_users",
            name: "users",
            primaryKeyColumnIds: ["col_user_id"],
          }),
          makeTable({ id: "tbl_posts", name: "posts" }),
        ],
        columns: [
          makeColumn({ id: "col_user_id", tableId: "tbl_users", name: "id" }),
          makeColumn({
            id: "col_post_author",
            tableId: "tbl_posts",
            name: "author_id",
          }),
        ],
        relations: [
          makeRelation({
            id: "rel_posts_users",
            fromTableId: "tbl_posts",
            toTableId: "tbl_users",
            columnPairs: [
              { fromColumnId: "col_post_author", toColumnId: "col_user_id" },
            ],
          }),
        ],
      }),
    );

    expect(
      within(getTableNode(/^Table posts/))
        .getByText("Foreign key")
        .closest("li")?.textContent,
    ).toContain("author_id");
  });

  it("marks unique, nullable and auto increment columns", () => {
    renderCanvas(createUsersDocument());
    const node = within(getTableNode(/^Table users/));

    expect({
      isIdAutoIncrement: node
        .getByText("id")
        .closest("li")
        ?.textContent.includes("Auto increment"),
      isEmailUnique: node
        .getByText("email")
        .closest("li")
        ?.textContent.includes("Unique"),
      isNicknameNullable: node
        .getByText("nickname")
        .closest("li")
        ?.textContent.includes("Nullable"),
    }).toEqual({
      isIdAutoIncrement: true,
      isEmailUnique: true,
      isNicknameNullable: true,
    });
  });

  it("renders one row per column in the stored order", () => {
    renderCanvas(createUsersDocument());

    expect(
      within(getTableNode(/^Table users/))
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining("id"),
      expect.stringContaining("email"),
      expect.stringContaining("nickname"),
    ]);
  });

  it.each([
    { table: /^Table tags/, label: "New" },
    { table: /^Table members/, label: "Changed" },
    { table: /^Table orders/, label: "Removed" },
  ])(
    "labels a table with its diff state in text ($label)",
    ({ table, label }) => {
      renderCanvas(createShopDocument(), { proposal: DIFF_PROPOSAL });

      expect(within(getTableNode(table)).getByText(label)).toBeDefined();
    },
  );

  it("marks a removed table with a dashed border and keeps its text opaque", () => {
    renderCanvas(createShopDocument(), { proposal: DIFF_PROPOSAL });

    expect(
      within(getTableNode(/^Table orders/))
        .getByText("orders")
        .closest(".table-node-card")
        ?.classList.contains("border-dashed"),
    ).toBe(true);
    expect(document.querySelector(".opacity-60")).toBeNull();
  });

  it("prefixes a changed column with a symbol and hidden text", () => {
    renderCanvas(createShopDocument(), { proposal: DIFF_PROPOSAL });
    const row = getColumnRow("email");

    expect({
      symbol: within(row).getByText("~").getAttribute("aria-hidden"),
      hiddenText: within(row).getByText("Changed column").className,
    }).toStrictEqual({ symbol: "true", hiddenText: "sr-only" });
  });

  it("strikes through a removed column", () => {
    renderCanvas(createShopDocument(), { proposal: DIFF_PROPOSAL });
    const row = getColumnRow("nickname");

    expect({
      hiddenText: within(row).queryByText("Removed column") !== null,
      isNameStruck: within(row)
        .getByText("nickname")
        .classList.contains("line-through"),
      isTypeStruck: within(row)
        .getByText("text")
        .classList.contains("line-through"),
    }).toStrictEqual({
      hiddenText: true,
      isNameStruck: true,
      isTypeStruck: true,
    });
  });

  it("reads issue counts from the current document during a preview", () => {
    // The proposal clears the issue (an empty column name), but the badge
    // keeps counting the document the user has, not the preview.
    renderCanvas(
      buildSchema({
        tables: [makeTable({ id: "tbl_users", name: "users" })],
        columns: [
          makeColumn({ id: "col_user_email", tableId: "tbl_users", name: "" }),
        ],
      }),
      {
        proposal: {
          type: "updateColumn",
          columnId: "col_user_email",
          changes: { name: "email" },
        },
      },
    );

    expect(
      within(getTableNode(/^Table users/)).getByRole("img", {
        name: "1 issue",
      }),
    ).toBeDefined();
  });

  it.each<ThemePreference>(["light", "dark"])(
    "has no axe violations for a table node with diff marks in the %s theme",
    async (themePreference) => {
      const { container } = renderCanvas(createShopDocument(), {
        themePreference,
        proposal: DIFF_PROPOSAL,
      });

      await expectNoAxeViolations(container);
    },
  );

  it.each<ThemePreference>(["light", "dark"])(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderCanvas(createUsersDocument(), {
        themePreference,
      });

      await expectNoAxeViolations(container);
    },
  );
});
