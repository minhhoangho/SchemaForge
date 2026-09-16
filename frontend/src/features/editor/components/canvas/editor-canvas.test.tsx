import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen } from "@testing-library/react";
import type * as XYFlow from "@xyflow/react";
import type { Connection, ReactFlowProps, Viewport } from "@xyflow/react";
import type { JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { RelationEdge } from "../../lib/to-relation-edges";
import type * as ViewportControlsModule from "../../lib/viewport-controls";
import type {
  ViewportControls,
  ViewportControlsProviderProps,
} from "../../lib/viewport-controls";
import type { TableNode } from "../../lib/to-table-nodes";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import { EditorCanvas } from "./editor-canvas";

type FlowProps = ReactFlowProps<TableNode, RelationEdge>;

// React Flow is the boundary jsdom cannot drive fully (it has no layout), so
// the real component renders while its props are recorded; tests call the
// handlers React Flow would call.
// The viewport commands are checked the same way: calls into the React Flow
// instance are recorded, and the controls the canvas builds are captured
// from its provider.
const { recordFlowProps, recordFlowCall, recordControls } = vi.hoisted(() => ({
  recordFlowProps: vi.fn<(props: FlowProps) => void>(),
  recordFlowCall:
    vi.fn<(method: string, parameters: readonly unknown[]) => void>(),
  recordControls: vi.fn<(controls: ViewportControls) => void>(),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XYFlow>();
  type FlowInstance = ReturnType<typeof actual.useReactFlow>;
  // useReactFlow returns a stable object, so its wrapper must be stable too.
  const wrappedFlows = new WeakMap<FlowInstance, FlowInstance>();
  function wrapFlow(flow: FlowInstance): FlowInstance {
    return {
      ...flow,
      zoomIn: (options) => {
        recordFlowCall("zoomIn", [options]);
        return flow.zoomIn(options);
      },
      zoomOut: (options) => {
        recordFlowCall("zoomOut", [options]);
        return flow.zoomOut(options);
      },
      fitView: (options) => {
        recordFlowCall("fitView", [options]);
        return flow.fitView(options);
      },
      setCenter: (x, y, options) => {
        recordFlowCall("setCenter", [x, y, options]);
        return flow.setCenter(x, y, options);
      },
      getZoom: () => {
        recordFlowCall("getZoom", []);
        return flow.getZoom();
      },
    };
  }
  function useRecordedReactFlow(): FlowInstance {
    const flow = actual.useReactFlow();
    const wrapped = wrappedFlows.get(flow) ?? wrapFlow(flow);
    wrappedFlows.set(flow, wrapped);
    return wrapped;
  }
  function RecordedReactFlow(props: FlowProps): JSX.Element {
    recordFlowProps(props);
    return <actual.ReactFlow {...props} />;
  }
  return {
    ...actual,
    ReactFlow: RecordedReactFlow,
    useReactFlow: useRecordedReactFlow,
  };
});

vi.mock("../../lib/viewport-controls", async (importOriginal) => {
  const actual = await importOriginal<typeof ViewportControlsModule>();
  function RecordedProvider(props: ViewportControlsProviderProps): JSX.Element {
    recordControls(props.controls);
    return <actual.ViewportControlsProvider {...props} />;
  }
  return { ...actual, ViewportControlsProvider: RecordedProvider };
});

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const MEASURED_SIZE = { inlineSize: 1000, blockSize: 800 };
const USERS_POSITION = { x: 0, y: 0 };
const POSTS_POSITION = { x: 400, y: 0 };
// Screen pixels equal canvas units, so a drag distance reads directly.
const IDENTITY_VIEWPORT = { x: 0, y: 0, zoom: 1 };

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

function createDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_users", name: "users", position: USERS_POSITION }),
      makeTable({ id: "tbl_posts", name: "posts", position: POSTS_POSITION }),
    ],
  });
}

function createTestStore(document: SchemaDocument): EditorStore {
  return createEditorStore({
    schemaId: SCHEMA_ID,
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
}

type CanvasCallbacks = {
  readonly onMoveEnd: (viewport: Viewport) => void;
  readonly onAddTable: () => void;
  readonly onConnect: (connection: Connection) => void;
};

function createCallbacks(): CanvasCallbacks {
  return {
    onMoveEnd: vi.fn<(viewport: Viewport) => void>(),
    onAddTable: vi.fn<() => void>(),
    onConnect: vi.fn<(connection: Connection) => void>(),
  };
}

function renderCanvas(
  store: EditorStore,
  callbacks: CanvasCallbacks = createCallbacks(),
  defaultViewport: Viewport | null = null,
): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <EditorStoreProvider store={store}>
      <div style={{ width: 1000, height: 800 }}>
        <EditorCanvas defaultViewport={defaultViewport} {...callbacks} />
      </div>
    </EditorStoreProvider>,
    { locale: "en" },
  );
}

// d3-drag, which React Flow drags with, reads `event.view`; jsdom rejects the
// test window in the MouseEvent constructor, so the view is set afterwards.
function dispatchMouseEvent(
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  Object.defineProperty(event, "view", { value: window });
  act(() => {
    target.dispatchEvent(event);
  });
}

// React Flow pans automatically when the pointer nears the edge of a canvas
// it measures as 0x0 in jsdom, which would shift every drag.
function giveCanvasItsSize(): void {
  vi.spyOn(
    screen.getByRole("application"),
    "getBoundingClientRect",
  ).mockReturnValue(new DOMRect(0, 0, 1000, 800));
}

function getFlowProps(): FlowProps {
  const props = recordFlowProps.mock.lastCall?.[0];
  if (props === undefined) {
    throw new Error("React Flow has not rendered yet.");
  }
  return props;
}

function getControls(): ViewportControls {
  const controls = recordControls.mock.lastCall?.[0];
  if (controls === undefined) {
    throw new Error("The canvas has not provided viewport controls yet.");
  }
  return controls;
}

function stubReducedMotion(): void {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: media === "(prefers-reduced-motion: reduce)",
    media,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function createRelatedDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        position: USERS_POSITION,
        primaryKeyColumnIds: ["col_user_id"],
      }),
      makeTable({ id: "tbl_posts", name: "posts", position: POSTS_POSITION }),
      makeTable({ id: "tbl_tags", name: "tags", position: { x: 0, y: 400 } }),
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
  });
}

function getNodes(): readonly TableNode[] {
  return getFlowProps().nodes ?? [];
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MeasuringResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  recordFlowProps.mockClear();
  recordFlowCall.mockClear();
  recordControls.mockClear();
});

describe("EditorCanvas", () => {
  it("renders one node per table", () => {
    renderCanvas(createTestStore(createDocument()));

    expect(
      screen
        .getAllByRole("group", { name: /^Table / })
        .map((node) => node.getAttribute("aria-label")),
    ).toEqual(["Table posts, 0 columns", "Table users, 0 columns"]);
  });

  it("keeps the node object of a table another change did not touch", () => {
    const store = createTestStore(createDocument());
    renderCanvas(store);
    const usersNodeBefore = getNodes().find((node) => node.id === "tbl_users");

    act(() => {
      store.getState().dispatch({
        type: "updateTable",
        tableId: "tbl_posts",
        changes: { name: "articles" },
      });
    });

    expect(getNodes().find((node) => node.id === "tbl_users")).toBe(
      usersNodeBefore,
    );
  });

  it("ignores remove changes from react flow", () => {
    const store = createTestStore(createDocument());
    renderCanvas(store);

    act(() => {
      getFlowProps().onNodesChange?.([{ type: "remove", id: "tbl_users" }]);
      getFlowProps().onEdgesChange?.([{ type: "remove", id: "rel_missing" }]);
    });

    expect({
      tableIds: Object.keys(store.getState().document.tables).toSorted(),
      nodeCount: getNodes().length,
      canUndo: store.getState().history.past.length > 0,
    }).toEqual({
      tableIds: ["tbl_posts", "tbl_users"],
      nodeCount: 2,
      canUndo: false,
    });
  });

  it("blocks every delete react flow starts on its own", async () => {
    renderCanvas(createTestStore(createDocument()));

    await expect(
      getFlowProps().onBeforeDelete?.({ nodes: [...getNodes()], edges: [] }),
    ).resolves.toBe(false);
    expect(getFlowProps().deleteKeyCode).toBeNull();
  });

  it("dispatches one moveElements when a drag stops", () => {
    const store = createTestStore(createDocument());
    renderCanvas(store, createCallbacks(), IDENTITY_VIEWPORT);
    giveCanvasItsSize();
    const node = screen.getByRole("group", { name: "Table users, 0 columns" });

    // The first move past the threshold only starts the drag.
    dispatchMouseEvent(node, "mousedown", 100, 100);
    dispatchMouseEvent(document, "mousemove", 150, 130);
    dispatchMouseEvent(document, "mousemove", 200, 160);
    dispatchMouseEvent(document, "mousemove", 250, 190);
    dispatchMouseEvent(document, "mouseup", 250, 190);

    expect({
      position: store.getState().document.tables.tbl_users?.position,
      entryCount: store.getState().history.past.length,
      dragPositions: store.getState().dragPositions,
    }).toEqual({
      position: { x: 100, y: 60 },
      entryCount: 1,
      dragPositions: {},
    });
  });

  it("shows a table at its drag position while it is dragged", () => {
    const store = createTestStore(createDocument());
    renderCanvas(store);

    act(() => {
      getFlowProps().onNodesChange?.([
        {
          type: "position",
          id: "tbl_users",
          position: { x: 50, y: 30 },
          dragging: true,
        },
      ]);
    });

    expect({
      dragPositions: store.getState().dragPositions,
      nodePosition: getNodes().find((node) => node.id === "tbl_users")
        ?.position,
      storedPosition: store.getState().document.tables.tbl_users?.position,
    }).toEqual({
      dragPositions: { tbl_users: { x: 50, y: 30 } },
      nodePosition: { x: 50, y: 30 },
      storedPosition: USERS_POSITION,
    });
  });

  it("does not dispatch when a drag ends at the same position", () => {
    const store = createTestStore(createDocument());
    renderCanvas(store, createCallbacks(), IDENTITY_VIEWPORT);
    giveCanvasItsSize();
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    const node = screen.getByRole("group", { name: "Table users, 0 columns" });

    dispatchMouseEvent(node, "mousedown", 100, 100);
    dispatchMouseEvent(document, "mousemove", 150, 130);
    dispatchMouseEvent(document, "mousemove", 200, 160);
    dispatchMouseEvent(document, "mousemove", 150, 130);
    dispatchMouseEvent(document, "mouseup", 150, 130);

    expect({
      dispatchCount: dispatch.mock.calls.length,
      dragPositions: store.getState().dragPositions,
    }).toEqual({ dispatchCount: 0, dragPositions: {} });
  });

  it("coalesces arrow key moves", async () => {
    const store = createTestStore(createDocument());
    const { user } = renderCanvas(store);

    act(() => {
      screen.getByRole("group", { name: "Table users, 0 columns" }).focus();
    });
    await user.keyboard("{Enter}{ArrowRight}{ArrowRight}{ArrowDown}");

    expect({
      position: store.getState().document.tables.tbl_users?.position,
      entryCount: store.getState().history.past.length,
    }).toEqual({ position: { x: 10, y: 5 }, entryCount: 1 });
  });

  it("stores the selection in the editor store", async () => {
    const store = createTestStore(createDocument());
    const { user } = renderCanvas(store);

    act(() => {
      screen.getByRole("group", { name: "Table posts, 0 columns" }).focus();
    });
    await user.keyboard("{Enter}");

    expect(store.getState().selection).toEqual({
      tableIds: ["tbl_posts"],
      relationIds: [],
    });
  });

  it("saves the viewport on move end", () => {
    const callbacks = createCallbacks();
    renderCanvas(createTestStore(createDocument()), callbacks);

    getFlowProps().onMoveEnd?.(null, { x: 12, y: -8, zoom: 1.5 });

    expect(callbacks.onMoveEnd).toHaveBeenCalledWith({
      x: 12,
      y: -8,
      zoom: 1.5,
    });
  });

  it("uses the stored viewport as the default viewport", () => {
    renderCanvas(createTestStore(createDocument()), createCallbacks(), {
      x: 40,
      y: 20,
      zoom: 0.5,
    });

    expect({
      defaultViewport: getFlowProps().defaultViewport,
      fitView: getFlowProps().fitView,
    }).toEqual({
      defaultViewport: { x: 40, y: 20, zoom: 0.5 },
      fitView: false,
    });
  });

  it("shows the empty state and adds a table from it", async () => {
    const callbacks = createCallbacks();
    const { user } = renderCanvas(createTestStore(buildSchema({})), callbacks);

    await user.click(screen.getByRole("button", { name: "Add table" }));

    expect(callbacks.onAddTable).toHaveBeenCalledOnce();
  });

  it("passes a connection to onConnect", () => {
    const callbacks = createCallbacks();
    renderCanvas(createTestStore(createDocument()), callbacks);
    const connection = {
      source: "tbl_posts",
      sourceHandle: "table:tbl_posts:left",
      target: "tbl_users",
      targetHandle: "table:tbl_users:right",
    };

    getFlowProps().onConnect?.(connection);

    expect(callbacks.onConnect).toHaveBeenCalledWith(connection);
  });

  it("keeps the edge object of a relation another change did not touch", () => {
    const store = createTestStore(createRelatedDocument());
    renderCanvas(store);
    const edgeBefore = getFlowProps().edges?.[0];

    act(() => {
      store.getState().dispatch({
        type: "updateTable",
        tableId: "tbl_tags",
        changes: { name: "labels" },
      });
    });

    expect({
      isSameEdge: getFlowProps().edges?.[0] === edgeBefore,
      tagsLabel: getNodes().find((node) => node.id === "tbl_tags")?.ariaLabel,
    }).toEqual({ isSameEdge: true, tagsLabel: "Table labels, 0 columns" });
  });

  it("maps the viewport controls to react flow", () => {
    renderCanvas(createTestStore(createDocument()));
    const controls = getControls();

    act(() => {
      controls.zoomIn();
      controls.zoomOut();
      controls.fitView();
      controls.setCenter(10, 20, { zoom: 1.5, duration: 0 });
    });
    const zoom = controls.getZoom();

    expect({ calls: recordFlowCall.mock.calls, zoom }).toEqual({
      calls: [
        ["zoomIn", [{ duration: 200 }]],
        ["zoomOut", [{ duration: 200 }]],
        ["fitView", [{ padding: 0.2, duration: 200 }]],
        ["setCenter", [10, 20, { zoom: 1.5, duration: 0 }]],
        ["getZoom", []],
      ],
      zoom: 1.5,
    });
  });

  it("uses no viewport transition when reduced motion is requested", () => {
    stubReducedMotion();
    renderCanvas(createTestStore(createDocument()));
    const controls = getControls();

    act(() => {
      controls.zoomIn();
      controls.zoomOut();
      controls.fitView();
    });

    expect(recordFlowCall.mock.calls).toEqual([
      ["zoomIn", [{ duration: 0 }]],
      ["zoomOut", [{ duration: 0 }]],
      ["fitView", [{ padding: 0.2, duration: 0 }]],
    ]);
  });

  it("reports no axe violations on the empty state", async () => {
    const { container } = renderCanvas(createTestStore(buildSchema({})));

    await expectNoAxeViolations(container);
  });
});
