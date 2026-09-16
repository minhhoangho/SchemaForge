import type { ColumnType, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { screen } from "@testing-library/react";
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

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const MEASURED_SIZE = { inlineSize: 1000, blockSize: 800 };

// jsdom's ResizeObserver stub never reports, so React Flow would keep every
// node unmeasured and draw no edge; this one reports each element right away.
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

function renderCanvas(
  document: SchemaDocument,
  themePreference: ThemePreference = "light",
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
      <div style={{ width: 1000, height: 800 }}>
        <EditorCanvas
          defaultViewport={null}
          onMoveEnd={vi.fn<(viewport: Viewport) => void>()}
          onAddTable={vi.fn<() => void>()}
          onConnect={vi.fn<(connection: Connection) => void>()}
        />
      </div>
    </EditorStoreProvider>,
    { locale: "en", themePreference },
  );
}

type PostsDocumentOptions = {
  readonly authorType?: ColumnType;
  readonly isComposite?: boolean;
};

function createPostsDocument({
  authorType = { kind: "integer" },
  isComposite = false,
}: PostsDocumentOptions = {}): SchemaDocument {
  const userKey = isComposite
    ? (["col_user_id", "col_user_org"] as const)
    : (["col_user_id"] as const);
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        position: { x: 0, y: 0 },
        primaryKeyColumnIds: [...userKey],
      }),
      makeTable({ id: "tbl_posts", name: "posts", position: { x: 400, y: 0 } }),
    ],
    columns: [
      makeColumn({ id: "col_user_id", tableId: "tbl_users", name: "id" }),
      makeColumn({ id: "col_user_org", tableId: "tbl_users", name: "org_id" }),
      makeColumn({
        id: "col_post_author",
        tableId: "tbl_posts",
        name: "author_id",
        type: authorType,
      }),
      makeColumn({ id: "col_post_org", tableId: "tbl_posts", name: "org_id" }),
    ],
    relations: [
      makeRelation({
        id: "rel_posts_users",
        fromTableId: "tbl_posts",
        toTableId: "tbl_users",
        columnPairs: isComposite
          ? [
              { fromColumnId: "col_post_author", toColumnId: "col_user_id" },
              { fromColumnId: "col_post_org", toColumnId: "col_user_org" },
            ]
          : [{ fromColumnId: "col_post_author", toColumnId: "col_user_id" }],
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

describe("RelationEdge", () => {
  it("labels a one-to-many relation with both endpoints", () => {
    renderCanvas(createPostsDocument());

    expect({
      edge: screen.getByRole("group", {
        name: "posts.author_id → users.id, one-to-many",
      }).tagName,
      kindLabel: screen.getByText("1-n").tagName,
    }).toEqual({ edge: "g", kindLabel: "SPAN" });
  });

  it("shows the column count for a composite foreign key", () => {
    renderCanvas(createPostsDocument({ isComposite: true }));

    expect({
      label: screen.getByText("2 columns").tagName,
      edge: screen.getByRole("group", {
        name: "posts.author_id → users.id, one-to-many, 2 columns",
      }).tagName,
    }).toEqual({ label: "SPAN", edge: "g" });
  });

  it("marks an edge whose relation has an issue", () => {
    renderCanvas(createPostsDocument({ authorType: { kind: "text" } }));

    expect(
      screen.getByRole("group", {
        name: "posts.author_id → users.id, one-to-many, has issues",
      }).tagName,
    ).toBe("g");
  });

  it("hides the visible edge label from screen readers", () => {
    renderCanvas(createPostsDocument());

    expect(
      screen.getByText("1-n").closest("[aria-hidden='true']"),
    ).not.toBeNull();
  });

  it.each<ThemePreference>(["light", "dark"])(
    "reports no axe violations for keys, issues and relations in the %s theme",
    async (themePreference) => {
      const { container } = renderCanvas(
        createPostsDocument({
          authorType: { kind: "text" },
          isComposite: true,
        }),
        themePreference,
      );

      await expectNoAxeViolations(container);
    },
  );

  it("reports no axe violations while a tooltip is open", async () => {
    const { user } = renderCanvas(createPostsDocument());

    await user.hover(screen.getByText("author_id"));
    await screen.findByRole("tooltip");

    await expectNoAxeViolations(document.body);
  });
});
