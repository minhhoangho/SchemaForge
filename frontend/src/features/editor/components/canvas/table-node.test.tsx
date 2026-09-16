import type { SchemaDocument } from "@schemaforge/core";
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
};

function renderCanvas(
  document: SchemaDocument,
  { themePreference = "light" }: RenderOptions = {},
): ReturnType<typeof renderWithProviders> {
  const store = createEditorStore({
    schemaId: SCHEMA_ID,
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
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
