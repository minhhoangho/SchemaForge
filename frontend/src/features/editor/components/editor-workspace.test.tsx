import { createEmptySchema } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { buildSchema, makeTable } from "@schemaforge/core/testing";
import { act, screen, waitFor } from "@testing-library/react";
import type * as XYFlow from "@xyflow/react";
import type { ReactFlowProps } from "@xyflow/react";
import type { JSX } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import type { ViewportRecord } from "@/lib/storage/records";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

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

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MeasuringResizeObserver);
});

afterEach(() => {
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

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderWorkspace({
        repository: createRepository(),
        themePreference,
      });

      await expectNoAxeViolations(container);
    },
  );
});
