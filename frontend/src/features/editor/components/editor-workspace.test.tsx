import { createEmptySchema } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { buildSchema, makeColumn, makeTable } from "@schemaforge/core/testing";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type * as XYFlow from "@xyflow/react";
import type { ReactFlowProps } from "@xyflow/react";
import type { JSX } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import type { ViewportRecord } from "@/lib/storage/records";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import { formatColumnHandleId, formatTableHandleId } from "../lib/handle-ids";
import { EditorWorkspace } from "./editor-workspace";

type FlowProps = ReactFlowProps;

// React Flow cannot lay out or animate in jsdom, so the real component renders
// while its props and the calls into its instance are recorded.
const { recordFlowProps, recordFlowCall } = vi.hoisted(() => ({
  recordFlowProps: vi.fn<(props: FlowProps) => void>(),
  recordFlowCall: vi.fn<(method: string) => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn<() => void>() }),
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
        recordFlowCall("zoomIn");
        return flow.zoomIn(options);
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

function createRepository(): SchemaRepository {
  return {
    listSchemas: vi.fn<SchemaRepository["listSchemas"]>(),
    createSchema: vi.fn<SchemaRepository["createSchema"]>(),
    openSchema: vi.fn<SchemaRepository["openSchema"]>(),
    saveDocument: vi
      .fn<SchemaRepository["saveDocument"]>()
      .mockResolvedValue(undefined),
    renameSchema: vi.fn<SchemaRepository["renameSchema"]>(),
    deleteSchema: vi.fn<SchemaRepository["deleteSchema"]>(),
    readViewport: vi.fn<SchemaRepository["readViewport"]>(),
    saveViewport: vi
      .fn<SchemaRepository["saveViewport"]>()
      .mockResolvedValue(undefined),
  };
}

type RenderInput = {
  readonly repository: SchemaRepository;
  readonly document?: SchemaDocument;
  readonly viewport?: ViewportRecord | null;
  readonly themePreference?: "light" | "dark";
};

function renderWorkspace({
  repository,
  document = createEmptySchema("Billing"),
  viewport = null,
  themePreference = "light",
}: RenderInput): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <EditorWorkspace
      schemaId={SCHEMA_ID}
      document={document}
      viewport={viewport}
      repository={repository}
    />,
    { locale: "en", themePreference },
  );
}

// "orders" holds a user_id column that can reference the key of "users".
function createShopDocument(): SchemaDocument {
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
        position: { x: 400, y: 0 },
      }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
      makeColumn({
        id: "col_orders_user_id",
        tableId: "tbl_orders",
        name: "user_id",
      }),
    ],
  });
}

function renderShop(): ReturnType<typeof renderWithProviders> {
  return renderWorkspace({
    repository: createRepository(),
    document: createShopDocument(),
  });
}

// Hidden elements count too, so rows stay reachable behind an open dialog.
function getOutline(): HTMLElement {
  return screen.getByRole("complementary", {
    name: "Schema outline",
    hidden: true,
  });
}

// The row's name also holds its column count, so it is matched by prefix.
function getOutlineRow(tableName: string): HTMLElement {
  return within(getOutline()).getByRole("button", {
    name: new RegExp(`^${tableName} `),
  });
}

function queryOutlineRow(tableName: string): HTMLElement | null {
  return within(getOutline()).queryByRole("button", {
    name: new RegExp(`^${tableName} `),
    hidden: true,
  });
}

function getCanvasRegion(): HTMLElement {
  return screen.getByRole("main", { name: "Schema canvas", hidden: true });
}

function focusCanvasRegion(): void {
  act(() => {
    getCanvasRegion().focus();
  });
}

function getFlowProps(): FlowProps {
  const props = recordFlowProps.mock.lastCall?.[0];
  if (props === undefined) {
    throw new Error("React Flow has not rendered yet.");
  }
  return props;
}

// The toolbar has an "Add table" button too; the empty state's comes later in
// the document, after the toolbar.
function getEmptyStateAddButton(): HTMLElement {
  const button = screen.getAllByRole("button", { name: "Add table" }).at(-1);
  if (button === undefined) {
    throw new Error("The empty state has no add table button.");
  }
  return button;
}

type OpenedRelationDialog = {
  readonly user: ReturnType<typeof renderShop>["user"];
  // The table panel button the dialog was opened from, which focus must
  // return to when it closes.
  readonly opener: HTMLElement;
  readonly dialog: HTMLElement;
};

// Opens the create relation dialog the way a keyboard user does: from the
// table panel button, with Enter.
async function openRelationDialogFromTablePanel(): Promise<OpenedRelationDialog> {
  const { user } = renderShop();
  await user.click(getOutlineRow("orders"));
  const opener = screen.getByRole("button", { name: "Add relation" });
  act(() => {
    opener.focus();
  });
  await user.keyboard("{Enter}");
  const dialog = screen.getByRole("dialog", { name: "Create relation" });
  return { user, opener, dialog };
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MeasuringResizeObserver);
});

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  recordFlowProps.mockClear();
  recordFlowCall.mockClear();
});

describe("EditorWorkspace", () => {
  it("zooms react flow from the toolbar", async () => {
    const { user } = renderWorkspace({ repository: createRepository() });

    await user.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(recordFlowCall.mock.calls).toEqual([["zoomIn"]]);
  });

  it("adds a table from the empty state and saves it", async () => {
    const repository = createRepository();
    const { user } = renderWorkspace({ repository });

    await user.click(getEmptyStateAddButton());

    await waitFor(() => {
      expect(repository.saveDocument).toHaveBeenCalledOnce();
    });
    const savedDocument = vi.mocked(repository.saveDocument).mock.calls[0]?.[1];
    expect({
      tableCount: Object.keys(savedDocument?.tables ?? {}).length,
      hasEmptyState:
        screen.queryByText("This schema has no tables yet") !== null,
    }).toEqual({ tableCount: 1, hasEmptyState: false });
  });

  it("uses the stored viewport as the default viewport", () => {
    renderWorkspace({
      repository: createRepository(),
      document: buildSchema({ tables: [makeTable({ id: "tbl_users" })] }),
      viewport: { schemaId: SCHEMA_ID, x: 40, y: 20, zoom: 0.5 },
    });

    expect({
      defaultViewport: getFlowProps().defaultViewport,
      fitView: getFlowProps().fitView,
    }).toEqual({
      defaultViewport: { x: 40, y: 20, zoom: 0.5 },
      fitView: false,
    });
  });

  it("saves the viewport when a move ends", () => {
    const repository = createRepository();
    renderWorkspace({ repository });

    getFlowProps().onMoveEnd?.(null, { x: 12, y: -8, zoom: 1.5 });

    expect(repository.saveViewport).toHaveBeenCalledWith({
      schemaId: SCHEMA_ID,
      x: 12,
      y: -8,
      zoom: 1.5,
    });
  });

  it("logs a failed viewport save without showing it", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const repository = createRepository();
    const quotaError = new Error("Quota exceeded.");
    quotaError.name = "QuotaExceededError";
    vi.mocked(repository.saveViewport).mockRejectedValue(quotaError);
    renderWorkspace({ repository });

    await act(async () => {
      getFlowProps().onMoveEnd?.(null, { x: 1, y: 2, zoom: 1 });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith("editor.viewport-save-failed", {
        errorName: "QuotaExceededError",
      });
    });
    expect(screen.queryByText(/Browser storage is full/)).toBeNull();
  });

  it("saves no viewport after unmount", () => {
    const repository = createRepository();
    const { unmount } = renderWorkspace({ repository });
    const { onMoveEnd } = getFlowProps();

    unmount();
    onMoveEnd?.(null, { x: 1, y: 2, zoom: 1 });

    expect(repository.saveViewport).not.toHaveBeenCalled();
  });

  it("renders the toolbar, both panels and the canvas as landmarks", async () => {
    const { user } = renderShop();

    await user.click(getOutlineRow("users"));

    expect({
      banner: within(screen.getByRole("banner")).getAllByRole("button", {
        name: "Add table",
      }).length,
      outline: getOutline().tagName,
      canvas: getCanvasRegion().tagName,
      properties: screen.getByRole("complementary", { name: "Properties" })
        .tagName,
    }).toEqual({
      banner: 1,
      outline: "ASIDE",
      canvas: "MAIN",
      properties: "ASIDE",
    });
  });

  it("renders the canvas region as a focusable main around react flow", () => {
    const { container } = renderShop();

    const canvasRegion = getCanvasRegion();
    const flowRoot = container.querySelector(".react-flow");

    expect({
      tabIndex: canvasRegion.tabIndex,
      holdsFlow: flowRoot !== null && canvasRegion.contains(flowRoot),
      closestFocusable: flowRoot?.closest("[tabindex]"),
    }).toEqual({
      tabIndex: -1,
      holdsFlow: true,
      closestFocusable: canvasRegion,
    });
  });

  it("moves focus to the properties panel through the skip link", async () => {
    const { user } = renderShop();
    await user.click(getOutlineRow("users"));

    act(() => {
      screen.getByRole("link", { name: "Skip the canvas" }).focus();
    });
    await user.keyboard("{Enter}");

    expect(document.activeElement).toBe(
      screen.getByRole("complementary", { name: "Properties" }),
    );
  });

  it("moves focus to the left panel through the skip link without a selection", async () => {
    const { user } = renderShop();

    act(() => {
      screen.getByRole("link", { name: "Skip the canvas" }).focus();
    });
    await user.keyboard("{Enter}");

    const { activeElement } = document;
    expect({
      isBody: activeElement === document.body,
      holdsOutline: activeElement?.contains(getOutline()),
    }).toEqual({ isBody: false, holdsOutline: true });
  });

  it("does not undo while focus is on a button of the rename dialog", async () => {
    const { user } = renderShop();
    await user.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Add table",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Schema name shop" }));

    act(() => {
      within(screen.getByRole("dialog", { name: "Rename schema" }))
        .getByRole("button", { name: "Cancel" })
        .focus();
    });
    await user.keyboard("{Control>}z{/Control}");

    expect(queryOutlineRow("table_1")).not.toBeNull();
  });

  it("deletes the table from the table panel with an undo toast", async () => {
    const { user } = renderShop();
    await user.click(getOutlineRow("users"));

    await user.click(screen.getByRole("button", { name: "Delete table" }));
    const toastRegion = screen.getByRole("region", { name: /Notifications/ });
    const toastText = await within(toastRegion).findByText(
      "Deleted table users",
    );
    const isRowGone = queryOutlineRow("users") === null;
    const isCanvasFocused = document.activeElement === getCanvasRegion();
    await user.click(within(toastRegion).getByRole("button", { name: "Undo" }));

    expect({
      hasToast: toastText.isConnected,
      isRowGone,
      isCanvasFocused,
      isRestored: queryOutlineRow("users") !== null,
    }).toEqual({
      hasToast: true,
      isRowGone: true,
      isCanvasFocused: true,
      isRestored: true,
    });
  });

  it("deletes the selection with the Delete key when focus is in the canvas", async () => {
    const { user } = renderShop();
    await user.click(getOutlineRow("users"));

    focusCanvasRegion();
    await user.keyboard("{Delete}");

    expect(await screen.findByText("Deleted table users")).toBeDefined();
    expect({
      row: queryOutlineRow("users"),
      properties: screen.queryByRole("complementary", { name: "Properties" }),
      activeElement: document.activeElement,
    }).toEqual({
      row: null,
      properties: null,
      activeElement: getCanvasRegion(),
    });
  });

  it("does not delete while focus is in a text field", async () => {
    const { user } = renderShop();
    await user.click(getOutlineRow("users"));

    await user.click(screen.getByRole("textbox", { name: "Table name" }));
    await user.keyboard("{Delete}");

    expect(queryOutlineRow("users")).not.toBeNull();
  });

  it("does not delete while the create relation dialog is open", async () => {
    const { user } = renderShop();
    await user.click(getOutlineRow("orders"));
    await user.click(screen.getByRole("button", { name: "Add relation" }));

    // Focus is trapped in the dialog, so the key is sent to the canvas itself
    // to reach the check for an open dialog.
    fireEvent.keyDown(getCanvasRegion(), { key: "Delete" });

    expect({
      isDialogOpen: screen.queryByRole("dialog", { name: "Create relation" })
        ?.isConnected,
      hasRow: queryOutlineRow("orders") !== null,
    }).toEqual({ isDialogOpen: true, hasRow: true });
  });

  it("undoes the deletion from the toast action", async () => {
    const { user } = renderShop();
    await user.click(getOutlineRow("users"));
    focusCanvasRegion();
    await user.keyboard("{Delete}");

    const toastRegion = screen.getByRole("region", { name: /Notifications/ });
    await user.click(
      await within(toastRegion).findByRole("button", { name: "Undo" }),
    );

    expect(getOutlineRow("users")).toBeDefined();
  });

  it("opens the create relation dialog prefilled from a connection", () => {
    renderShop();

    act(() => {
      getFlowProps().onConnect?.({
        source: "tbl_orders",
        target: "tbl_users",
        sourceHandle: formatColumnHandleId("col_orders_user_id", "right"),
        targetHandle: formatTableHandleId("tbl_users", "left"),
      });
    });

    const dialog = screen.getByRole("dialog", { name: "Create relation" });
    expect({
      referencedTable: within(dialog).getByRole("combobox", {
        name: "Referenced table",
      }).textContent,
      foreignKeyColumn: within(dialog).getByRole("combobox", {
        name: "Foreign key column 1",
      }).textContent,
    }).toEqual({ referencedTable: "users", foreignKeyColumn: "user_id" });
  });

  it("opens the create relation dialog from the table panel button", async () => {
    const { user } = renderShop();
    await user.click(getOutlineRow("orders"));

    await user.click(screen.getByRole("button", { name: "Add relation" }));

    const dialog = screen.getByRole("dialog", { name: "Create relation" });
    expect(
      within(dialog).getByRole("combobox", { name: "Referenced table" })
        .textContent,
    ).toBe("users");
  });

  it("focuses the table name field after adding a table", async () => {
    const { user } = renderShop();

    await user.click(
      within(screen.getByRole("banner")).getByRole("button", {
        name: "Add table",
      }),
    );

    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Table name" }),
    );
  });

  it("returns focus to the table panel button when Escape closes the relation dialog", async () => {
    const { user, opener } = await openRelationDialogFromTablePanel();

    await user.keyboard("{Escape}");

    expect(document.activeElement).toBe(opener);
  });

  it("returns focus to the table panel button when the relation dialog is dismissed", async () => {
    const { user, opener, dialog } = await openRelationDialogFromTablePanel();

    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(document.activeElement).toBe(opener);
  });

  it("returns focus to the table panel button after the relation is created", async () => {
    const { user, opener, dialog } = await openRelationDialogFromTablePanel();

    await user.click(
      within(dialog).getByRole("button", { name: "Create relation" }),
    );

    expect(document.activeElement).toBe(opener);
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container, user } = renderWorkspace({
        repository: createRepository(),
        document: createShopDocument(),
        themePreference,
      });
      await user.click(getOutlineRow("users"));

      await expectNoAxeViolations(container);
    },
  );
});
